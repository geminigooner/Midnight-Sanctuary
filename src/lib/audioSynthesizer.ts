// Web Audio API Synthesizer & WAV Exporter for Midnight Sanctuary Companions

export interface NoteEvent {
  pitch: string; // e.g. "C4", "E4", "G4", "C4+E4+G4", "Rest"
  duration: number; // Duration in beats (e.g., 0.5 = eighth, 1 = quarter, 2 = half, 4 = whole)
  instrument?: 'piano' | 'lofi_piano' | 'ambient_pad' | 'dream_synth' | 'music_box' | 'chiptune' | 'acoustic_guitar' | 'bass' | 'bell' | string;
  velocity?: number; // 0.1 to 1.0 (defaults to 0.8)
}

export interface SanctuaryMusicTrack {
  id?: string;
  title: string;
  description?: string;
  genre?: string;
  tempo?: number; // BPM (default 85)
  key?: string;
  notes: NoteEvent[];
  reason?: string;
  authorModelId?: string;
  authorDisplayName?: string;
  timestamp?: number;
}

// Frequency map for musical notes
const NOTE_SEMITONES: Record<string, number> = {
  'C': 0, 'C#': 1, 'DB': 1, 'D': 2, 'D#': 3, 'EB': 3,
  'E': 4, 'F': 5, 'F#': 6, 'GB': 6, 'G': 7, 'G#': 8,
  'AB': 8, 'A': 9, 'A#': 10, 'BB': 10, 'B': 11,
};

export function pitchToFrequency(pitchStr: string): number {
  const clean = pitchStr.trim().toUpperCase();
  if (clean === 'REST' || clean === '_' || clean === '' || clean === 'PAUSE') {
    return 0;
  }

  const match = clean.match(/^([A-G][#B]?)(-?\d+)$/);
  if (!match) {
    // If just note name without octave, default to octave 4
    const letterMatch = clean.match(/^([A-G][#B]?)$/);
    if (letterMatch && NOTE_SEMITONES[letterMatch[1]] !== undefined) {
      const semitone = NOTE_SEMITONES[letterMatch[1]];
      return 440 * Math.pow(2, (semitone - 9 + (4 - 4) * 12) / 12);
    }
    return 440; // fallback A4
  }

  const note = match[1];
  const octave = parseInt(match[2], 10);
  const semitone = NOTE_SEMITONES[note];
  if (semitone === undefined) return 440;

  // A4 = 440 Hz (octave 4, semitone 9)
  const midiNumber = (octave + 1) * 12 + semitone;
  return 440 * Math.pow(2, (midiNumber - 69) / 12);
}

// Shared AudioContext instance (lazy initialized on user interaction)
let sharedAudioCtx: AudioContext | null = null;

export function getAudioContext(): AudioContext {
  if (!sharedAudioCtx || sharedAudioCtx.state === 'closed') {
    const AudioCtxClass = window.AudioContext || (window as any).webkitAudioContext;
    sharedAudioCtx = new AudioCtxClass();
  }
  if (sharedAudioCtx.state === 'suspended') {
    sharedAudioCtx.resume().catch(() => {});
  }
  return sharedAudioCtx;
}

/**
 * Plays a single synthesis voice / note on a given AudioContext destination.
 */
export function playSyntheticNote(
  ctx: AudioContext | OfflineAudioContext,
  freq: number,
  startTime: number,
  durationSec: number,
  instrument: string = 'piano',
  velocity: number = 0.8,
  destination?: AudioNode
) {
  if (freq <= 0) return; // Rest
  const dest = destination || ctx.destination;
  const inst = instrument.toLowerCase();
  const clampedVel = Math.max(0.1, Math.min(1.0, velocity));

  if (inst.includes('music_box') || inst.includes('bell')) {
    // Crisp sine with high harmonics and metallic ping
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, startTime);

    const harmonic = ctx.createOscillator();
    const harmGain = ctx.createGain();
    harmonic.type = 'sine';
    harmonic.frequency.setValueAtTime(freq * 2.76, startTime); // Inharmonic metallic ping

    gain.gain.setValueAtTime(0.001, startTime);
    gain.gain.linearRampToValueAtTime(clampedVel * 0.4, startTime + 0.005);
    gain.gain.exponentialRampToValueAtTime(0.0001, startTime + durationSec * 1.5 + 0.3);

    harmGain.gain.setValueAtTime(clampedVel * 0.15, startTime);
    harmGain.gain.exponentialRampToValueAtTime(0.0001, startTime + 0.2);

    osc.connect(gain);
    harmonic.connect(harmGain);
    gain.connect(dest);
    harmGain.connect(dest);

    osc.start(startTime);
    harmonic.start(startTime);
    osc.stop(startTime + durationSec * 1.5 + 0.35);
    harmonic.stop(startTime + 0.25);
  } else if (inst.includes('pad') || inst.includes('ambient') || inst.includes('dream')) {
    // Lush dual-saw/triangle warm pad with gentle filter and slow attack
    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const filter = ctx.createBiquadFilter();
    const gain = ctx.createGain();

    osc1.type = 'sawtooth';
    osc2.type = 'triangle';
    osc1.frequency.setValueAtTime(freq, startTime);
    osc2.frequency.setValueAtTime(freq * 1.006, startTime); // Subtle detune

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(freq * 2.5, startTime);
    filter.Q.setValueAtTime(2, startTime);

    const attack = Math.min(0.2, durationSec * 0.3);
    const release = Math.min(0.6, durationSec * 0.4);

    gain.gain.setValueAtTime(0.0001, startTime);
    gain.gain.linearRampToValueAtTime(clampedVel * 0.25, startTime + attack);
    gain.gain.setValueAtTime(clampedVel * 0.22, startTime + Math.max(attack, durationSec - release));
    gain.gain.exponentialRampToValueAtTime(0.0001, startTime + durationSec + release);

    osc1.connect(filter);
    osc2.connect(filter);
    filter.connect(gain);
    gain.connect(dest);

    osc1.start(startTime);
    osc2.start(startTime);
    osc1.stop(startTime + durationSec + release + 0.1);
    osc2.stop(startTime + durationSec + release + 0.1);
  } else if (inst.includes('chiptune') || inst.includes('retro') || inst.includes('8bit')) {
    // Retro square wave with percussive envelope
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(freq, startTime);

    gain.gain.setValueAtTime(clampedVel * 0.25, startTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, startTime + durationSec * 0.95);

    osc.connect(gain);
    gain.connect(dest);

    osc.start(startTime);
    osc.stop(startTime + durationSec);
  } else if (inst.includes('acoustic') || inst.includes('guitar') || inst.includes('harp')) {
    // Plucked string simulation using damped triangle + noise burst
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const filter = ctx.createBiquadFilter();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(freq, startTime);

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(freq * 4, startTime);
    filter.frequency.exponentialRampToValueAtTime(freq * 1.2, startTime + durationSec);

    gain.gain.setValueAtTime(0.0001, startTime);
    gain.gain.linearRampToValueAtTime(clampedVel * 0.35, startTime + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, startTime + durationSec * 1.2 + 0.1);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(dest);

    osc.start(startTime);
    osc.stop(startTime + durationSec * 1.2 + 0.15);
  } else if (inst.includes('bass')) {
    // Deep punchy bass
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const filter = ctx.createBiquadFilter();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq * 0.5, startTime); // One octave down

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(400, startTime);

    gain.gain.setValueAtTime(0.001, startTime);
    gain.gain.linearRampToValueAtTime(clampedVel * 0.45, startTime + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, startTime + durationSec + 0.1);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(dest);

    osc.start(startTime);
    osc.stop(startTime + durationSec + 0.15);
  } else {
    // Default: Warm Lofi Electric / Acoustic Piano
    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const filter = ctx.createBiquadFilter();
    const gain = ctx.createGain();

    osc1.type = 'triangle';
    osc2.type = 'sine';
    osc1.frequency.setValueAtTime(freq, startTime);
    osc2.frequency.setValueAtTime(freq * 2, startTime); // 1st overtone

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(Math.min(freq * 3.5, 3200), startTime);
    filter.frequency.exponentialRampToValueAtTime(Math.min(freq * 1.5, 1200), startTime + durationSec);

    const mainGain = clampedVel * 0.32;
    gain.gain.setValueAtTime(0.0001, startTime);
    gain.gain.linearRampToValueAtTime(mainGain, startTime + 0.01);
    gain.gain.exponentialRampToValueAtTime(mainGain * 0.4, startTime + 0.15);
    gain.gain.exponentialRampToValueAtTime(0.0001, startTime + durationSec * 1.2 + 0.2);

    osc1.connect(filter);
    osc2.connect(filter);
    filter.connect(gain);
    gain.connect(dest);

    osc1.start(startTime);
    osc2.start(startTime);
    osc1.stop(startTime + durationSec * 1.2 + 0.25);
    osc2.stop(startTime + durationSec * 1.2 + 0.25);
  }
}

/**
 * Calculates the total runtime duration in seconds for a track.
 */
export function calculateTrackDuration(track: SanctuaryMusicTrack): number {
  const bpm = Math.max(40, Math.min(240, track.tempo || 85));
  const secondsPerBeat = 60 / bpm;
  let totalBeats = 0;

  for (const note of track.notes || []) {
    const dur = Math.max(0.1, Number(note.duration) || 1);
    totalBeats += dur;
  }

  return totalBeats * secondsPerBeat;
}

/**
 * Plays an entire music track in real-time, calling `onNoteStep` for visual updates.
 * Returns a handle with a `stop()` method.
 */
export function playMusicTrack(
  track: SanctuaryMusicTrack,
  options?: {
    volume?: number;
    onNoteStep?: (noteIndex: number, note: NoteEvent) => void;
    onComplete?: () => void;
    loop?: boolean;
  }
): { stop: () => void; pause: () => void } {
  const ctx = getAudioContext();
  const masterGain = ctx.createGain();
  const volume = options?.volume ?? 0.8;
  masterGain.gain.setValueAtTime(volume, ctx.currentTime);
  masterGain.connect(ctx.destination);

  const bpm = Math.max(40, Math.min(240, track.tempo || 85));
  const secondsPerBeat = 60 / bpm;
  let isCancelled = false;
  const timeoutIds: number[] = [];

  const playSequence = () => {
    if (isCancelled) return;
    const now = ctx.currentTime + 0.05;
    let currentBeatTime = 0;

    track.notes.forEach((note, index) => {
      const durBeats = Math.max(0.1, Number(note.duration) || 1);
      const startSec = now + (currentBeatTime * secondsPerBeat);
      const noteDurSec = durBeats * secondsPerBeat;
      const instrument = note.instrument || track.genre || 'piano';
      const velocity = note.velocity ?? 0.8;

      // Handle chords e.g. "C4+E4+G4"
      const pitches = (note.pitch || 'C4').split('+').map(p => p.trim());
      pitches.forEach(p => {
        const freq = pitchToFrequency(p);
        playSyntheticNote(ctx, freq, startSec, noteDurSec, instrument, velocity, masterGain);
      });

      // Schedule UI callback for active note step
      const delayMs = Math.max(0, (startSec - ctx.currentTime) * 1000);
      const tid = window.setTimeout(() => {
        if (!isCancelled && options?.onNoteStep) {
          options.onNoteStep(index, note);
        }
      }, delayMs);
      timeoutIds.push(tid);

      currentBeatTime += durBeats;
    });

    const totalDurationSec = currentBeatTime * secondsPerBeat;
    const endTid = window.setTimeout(() => {
      if (isCancelled) return;
      if (options?.loop) {
        playSequence();
      } else {
        if (options?.onComplete) options.onComplete();
      }
    }, Math.max(0, (totalDurationSec + 0.1) * 1000));
    timeoutIds.push(endTid);
  };

  playSequence();

  return {
    stop: () => {
      isCancelled = true;
      timeoutIds.forEach(id => clearTimeout(id));
      masterGain.gain.linearRampToValueAtTime(0.0001, ctx.currentTime + 0.05);
      setTimeout(() => {
        masterGain.disconnect();
      }, 100);
    },
    pause: () => {
      isCancelled = true;
      timeoutIds.forEach(id => clearTimeout(id));
      masterGain.gain.linearRampToValueAtTime(0.0001, ctx.currentTime + 0.05);
    }
  };
}

/**
 * Synthesizes and renders a track offline into a standard 16-bit PCM WAV Blob for download.
 */
export async function renderTrackToWavBlob(track: SanctuaryMusicTrack): Promise<Blob> {
  const bpm = Math.max(40, Math.min(240, track.tempo || 85));
  const secondsPerBeat = 60 / bpm;
  const totalDuration = Math.max(1, calculateTrackDuration(track) + 1.5);
  const sampleRate = 44100;

  const offlineCtx = new OfflineAudioContext(2, Math.ceil(sampleRate * totalDuration), sampleRate);
  let currentBeatTime = 0;

  track.notes.forEach((note) => {
    const durBeats = Math.max(0.1, Number(note.duration) || 1);
    const startSec = currentBeatTime * secondsPerBeat;
    const noteDurSec = durBeats * secondsPerBeat;
    const instrument = note.instrument || track.genre || 'piano';
    const velocity = note.velocity ?? 0.8;

    const pitches = (note.pitch || 'C4').split('+').map(p => p.trim());
    pitches.forEach(p => {
      const freq = pitchToFrequency(p);
      playSyntheticNote(offlineCtx, freq, startSec, noteDurSec, instrument, velocity);
    });

    currentBeatTime += durBeats;
  });

  const renderedBuffer = await offlineCtx.startRendering();
  return audioBufferToWav(renderedBuffer);
}

// Convert AudioBuffer to WAV format
function audioBufferToWav(buffer: AudioBuffer): Blob {
  const numChannels = buffer.numberOfChannels;
  const sampleRate = buffer.sampleRate;
  const format = 1; // PCM
  const bitDepth = 16;

  const resultBuffers: Float32Array[] = [];
  for (let c = 0; c < numChannels; c++) {
    resultBuffers.push(buffer.getChannelData(c));
  }

  const length = resultBuffers[0].length * numChannels * (bitDepth / 8);
  const headerLength = 44;
  const outBuffer = new ArrayBuffer(headerLength + length);
  const view = new DataView(outBuffer);

  /* RIFF identifier */
  writeString(view, 0, 'RIFF');
  /* RIFF chunk length */
  view.setUint32(4, 36 + length, true);
  /* RIFF type */
  writeString(view, 8, 'WAVE');
  /* format chunk identifier */
  writeString(view, 12, 'fmt ');
  /* format chunk length */
  view.setUint32(16, 16, true);
  /* sample format (raw) */
  view.setUint16(20, format, true);
  /* channel count */
  view.setUint16(22, numChannels, true);
  /* sample rate */
  view.setUint32(24, sampleRate, true);
  /* byte rate (sample rate * block align) */
  view.setUint32(28, sampleRate * numChannels * (bitDepth / 8), true);
  /* block align (channel count * bytes per sample) */
  view.setUint16(32, numChannels * (bitDepth / 8), true);
  /* bits per sample */
  view.setUint16(34, bitDepth, true);
  /* data chunk identifier */
  writeString(view, 36, 'data');
  /* data chunk length */
  view.setUint32(40, length, true);

  // Write interleaved PCM samples
  let offset = 44;
  const channelCount = resultBuffers.length;
  const sampleCount = resultBuffers[0].length;

  for (let i = 0; i < sampleCount; i++) {
    for (let channel = 0; channel < channelCount; channel++) {
      let sample = resultBuffers[channel][i];
      // Clamping
      sample = Math.max(-1, Math.min(1, sample));
      // 16-bit signed integer conversion
      const intSample = sample < 0 ? sample * 0x8000 : sample * 0x7FFF;
      view.setInt16(offset, intSample, true);
      offset += 2;
    }
  }

  return new Blob([outBuffer], { type: 'audio/wav' });
}

function writeString(view: DataView, offset: number, string: string) {
  for (let i = 0; i < string.length; i++) {
    view.setUint8(offset + i, string.charCodeAt(i));
  }
}
