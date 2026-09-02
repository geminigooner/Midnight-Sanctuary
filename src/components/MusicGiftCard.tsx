import React, { useState, useEffect, useRef } from 'react';
import { Play, Pause, RotateCcw, Download, Sparkles, Volume2, VolumeX, Music, Disc, Repeat } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { MusicTrackData } from '../lib/types';
import { playMusicTrack, renderTrackToWavBlob, calculateTrackDuration, NoteEvent } from '../lib/audioSynthesizer';
import { triggerHaptic } from '../lib/haptics';

export interface MusicGiftCardProps {
  track: MusicTrackData;
  className?: string;
  isCompact?: boolean;
}

const GENRE_THEMES: Record<string, {
  name: string;
  icon: string;
  badgeBg: string;
  tapeColor: string;
  cardBg: string;
  accent: string;
}> = {
  ambient_pad: {
    name: 'Ambient Pad',
    icon: '🌌',
    badgeBg: 'bg-[#9D7FE3]/20 text-[#2C194D]',
    tapeColor: '#9D7FE3',
    cardBg: 'from-[#EBDCF9] to-[#F5E1C8]',
    accent: '#9D7FE3',
  },
  dream_synth: {
    name: 'Dream Synth',
    icon: '✨',
    badgeBg: 'bg-[#F198B7]/25 text-[#2C194D]',
    tapeColor: '#F198B7',
    cardBg: 'from-[#FCE7F0] to-[#F5E1C8]',
    accent: '#F198B7',
  },
  lofi_piano: {
    name: 'Lofi Piano',
    icon: '🎹',
    badgeBg: 'bg-[#C47653]/20 text-[#2C194D]',
    tapeColor: '#C47653',
    cardBg: 'from-[#FBE9D9] to-[#F5E1C8]',
    accent: '#C47653',
  },
  music_box: {
    name: 'Music Box',
    icon: '🔔',
    badgeBg: 'bg-[#F9D48C]/30 text-[#2C194D]',
    tapeColor: '#F9D48C',
    cardBg: 'from-[#FEF5E7] to-[#F5E1C8]',
    accent: '#E6A33E',
  },
  chiptune: {
    name: '8-Bit Chiptune',
    icon: '👾',
    badgeBg: 'bg-[#6EE7B7]/25 text-[#2C194D]',
    tapeColor: '#6EE7B7',
    cardBg: 'from-[#E0F9ED] to-[#F5E1C8]',
    accent: '#10B981',
  },
  acoustic_guitar: {
    name: 'Acoustic Guitar',
    icon: '🎸',
    badgeBg: 'bg-[#D97706]/20 text-[#2C194D]',
    tapeColor: '#D97706',
    cardBg: 'from-[#FDF2E9] to-[#F5E1C8]',
    accent: '#D97706',
  },
  bass: {
    name: 'Warm Bass',
    icon: '🔊',
    badgeBg: 'bg-[#8B5CF6]/20 text-[#2C194D]',
    tapeColor: '#8B5CF6',
    cardBg: 'from-[#EDE9FE] to-[#F5E1C8]',
    accent: '#8B5CF6',
  },
};

export function MusicGiftCard({ track, className = '', isCompact = false }: MusicGiftCardProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [activeNoteIdx, setActiveNoteIdx] = useState<number | null>(null);
  const [currentNote, setCurrentNote] = useState<NoteEvent | null>(null);
  const [isLooping, setIsLooping] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);

  const playbackRef = useRef<{ stop: () => void; pause: () => void } | null>(null);

  const genreKey = (track.genre || 'lofi_piano').toLowerCase().replace(/\s+/g, '_');
  const theme = GENRE_THEMES[genreKey] || GENRE_THEMES.lofi_piano;
  const authorName = track.authorDisplayName || track.authorModelId?.split('/').pop()?.replace(/^gemma/, 'Gemma')?.replace(/^gemini/, 'Gemini') || 'Your Companion';
  const durationSec = Math.round(calculateTrackDuration(track));

  const notesList = track.notes || [];

  const handlePlayToggle = () => {
    triggerHaptic('light');

    if (isPlaying) {
      if (playbackRef.current) {
        playbackRef.current.stop();
        playbackRef.current = null;
      }
      setIsPlaying(false);
      setActiveNoteIdx(null);
      setCurrentNote(null);
    } else {
      setIsPlaying(true);
      playbackRef.current = playMusicTrack(track, {
        volume: isMuted ? 0 : 0.8,
        loop: isLooping,
        onNoteStep: (idx, note) => {
          setActiveNoteIdx(idx);
          setCurrentNote(note);
        },
        onComplete: () => {
          setIsPlaying(false);
          setActiveNoteIdx(null);
          setCurrentNote(null);
          playbackRef.current = null;
        }
      });
    }
  };

  const handleRestart = (e: React.MouseEvent) => {
    e.stopPropagation();
    triggerHaptic('light');
    if (playbackRef.current) {
      playbackRef.current.stop();
    }
    setIsPlaying(true);
    playbackRef.current = playMusicTrack(track, {
      volume: isMuted ? 0 : 0.8,
      loop: isLooping,
      onNoteStep: (idx, note) => {
        setActiveNoteIdx(idx);
        setCurrentNote(note);
      },
      onComplete: () => {
        setIsPlaying(false);
        setActiveNoteIdx(null);
        setCurrentNote(null);
        playbackRef.current = null;
      }
    });
  };

  const handleDownloadWav = async (e: React.MouseEvent) => {
    e.stopPropagation();
    triggerHaptic('medium');
    try {
      setIsDownloading(true);
      const wavBlob = await renderTrackToWavBlob(track);
      const url = URL.createObjectURL(wavBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${(track.title || 'sanctuary-melody').toLowerCase().replace(/\s+/g, '-')}.wav`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Failed to render WAV audio:', err);
    } finally {
      setIsDownloading(false);
    }
  };

  // Clean up on unmount
  useEffect(() => {
    return () => {
      if (playbackRef.current) {
        playbackRef.current.stop();
      }
    };
  }, []);

  return (
    <div
      className={`relative group/music overflow-hidden rounded-2xl border-[3px] border-[#2C194D] bg-gradient-to-b ${theme.cardBg} p-3.5 sm:p-4 shadow-[4px_4px_0_#2C194D] transition-all select-none ${className}`}
    >
      {/* Top Tape Pin */}
      <div 
        className="absolute -top-1.5 left-1/2 -translate-x-1/2 w-20 h-3.5 rounded-sm border border-[#2C194D]/30 shadow-sm rotate-[1.5deg] pointer-events-none z-10 opacity-90"
        style={{ backgroundColor: theme.tapeColor }}
      />

      {/* Header */}
      <div className="flex items-start justify-between gap-3 mb-3 pt-1">
        <div className="flex items-center gap-2.5 min-w-0">
          <div
            className={`w-10 h-10 rounded-xl border-[2.5px] border-[#2C194D] flex items-center justify-center text-lg shrink-0 shadow-[2px_2px_0_#2C194D] transition-transform ${isPlaying ? 'animate-spin' : ''}`}
            style={{ 
              backgroundColor: theme.accent, 
              animationDuration: '4s',
              animationTimingFunction: 'linear'
            }}
          >
            {isPlaying ? <Disc size={20} className="text-[#2C194D]" /> : <Music size={20} className="text-[#2C194D]" />}
          </div>

          <div className="min-w-0">
            <h4 className="text-sm font-black text-[#2C194D] truncate tracking-tight">
              {track.title || 'Original Melody'}
            </h4>
            <p className="text-[10px] font-bold text-[#2C194D]/75 truncate">
              Composed by <strong className="text-[#2C194D] font-black">{authorName}</strong>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <span className={`text-[10px] font-black px-2 py-0.5 rounded-full border border-[#2C194D]/30 bg-white/70 ${theme.badgeBg} shadow-sm flex items-center gap-1`}>
            <span>{theme.icon}</span>
            <span>{theme.name}</span>
          </span>
        </div>
      </div>

      {/* Audio Waveform / Piano Visualizer Stage */}
      <div className="relative rounded-xl border-[2px] border-[#2C194D]/50 bg-[#151234] p-3 shadow-inner overflow-hidden mb-3">
        {/* Animated Background Pulse when playing */}
        <div className="flex items-center justify-between gap-1 h-12 px-1 relative z-10">
          {notesList.slice(0, 24).map((note, idx) => {
            const isActive = activeNoteIdx === idx;
            const isPast = activeNoteIdx !== null && idx < activeNoteIdx;
            
            // Random bar height based on pitch frequency approximation
            const pitchChar = note.pitch.charCodeAt(0) || 65;
            const barBaseHeight = 25 + ((pitchChar * (idx + 1)) % 55);

            return (
              <div 
                key={idx}
                className="flex-1 flex flex-col items-center justify-end h-full gap-0.5"
                title={`${note.pitch} (${note.duration} beats)`}
              >
                <motion.div 
                  className={`w-full rounded-sm transition-all duration-150 ${
                    isActive 
                      ? 'bg-[#F198B7] shadow-[0_0_8px_#F198B7]' 
                      : isPast 
                        ? 'bg-[#9D7FE3]/60' 
                        : 'bg-[#B39DE5]/30'
                  }`}
                  style={{
                    height: isActive ? '90%' : isPlaying ? `${Math.max(20, (barBaseHeight + (idx % 3) * 15))}%` : `${barBaseHeight}%`,
                  }}
                  animate={isPlaying && isActive ? { scaleY: [1, 1.3, 1] } : {}}
                  transition={{ repeat: Infinity, duration: 0.3 }}
                />
                <span className="text-[7px] font-bold text-[#F5E1C8]/60 truncate w-full text-center">
                  {note.pitch.replace(/\+.*$/, '')}
                </span>
              </div>
            );
          })}
        </div>

        {/* Currently Sounding Note Badge */}
        <div className="flex items-center justify-between text-[10px] font-mono text-[#F5E1C8]/80 mt-2 pt-1.5 border-t border-[#2C194D]">
          <div className="flex items-center gap-1.5 font-bold">
            <span className="text-[#F198B7]">TEMPO:</span>
            <span>{track.tempo || 85} BPM</span>
            {track.key && (
              <>
                <span className="text-[#B39DE5]/60">•</span>
                <span className="text-[#F198B7]">KEY:</span>
                <span>{track.key}</span>
              </>
            )}
          </div>

          <div className="flex items-center gap-1 font-bold">
            <span className="text-[#B39DE5]">DURATION:</span>
            <span>~{durationSec}s ({notesList.length} notes)</span>
          </div>
        </div>
      </div>

      {/* Description / Dedication Note */}
      {(track.reason || track.description) && (
        <div className="mb-3 px-2.5 py-1.5 rounded-lg bg-white/50 border border-[#2C194D]/20 text-[11px] font-bold text-[#2C194D] italic leading-snug">
          "{track.reason || track.description}"
        </div>
      )}

      {/* Controls Bar */}
      <div className="flex items-center justify-between gap-2 pt-1 border-t border-[#2C194D]/20">
        <div className="flex items-center gap-2">
          {/* Main Play/Pause Button */}
          <button
            type="button"
            onClick={handlePlayToggle}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-xl border-[2.5px] border-[#2C194D] font-extrabold text-xs shadow-[2px_2px_0_0_#2C194D] active:shadow-none active:translate-y-0.5 transition-all cursor-pointer ${
              isPlaying 
                ? 'bg-[#F198B7] text-[#2C194D]' 
                : 'bg-[#9D7FE3] text-[#2C194D] hover:bg-[#9D7FE3]/90'
            }`}
          >
            {isPlaying ? <Pause size={14} fill="#2C194D" /> : <Play size={14} fill="#2C194D" />}
            <span>{isPlaying ? 'Pause' : 'Play Song'}</span>
          </button>

          {/* Restart */}
          <button
            type="button"
            onClick={handleRestart}
            className="p-2 rounded-xl border-[2px] border-[#2C194D] bg-[#F5E1C8] hover:bg-[#f7e5cb] text-[#2C194D] shadow-[2px_2px_0_0_#2C194D] active:translate-y-0.5 transition-all"
            title="Replay from start"
          >
            <RotateCcw size={13} />
          </button>

          {/* Loop Toggle */}
          <button
            type="button"
            onClick={() => { triggerHaptic('light'); setIsLooping(!isLooping); }}
            className={`p-2 rounded-xl border-[2px] border-[#2C194D] shadow-[2px_2px_0_0_#2C194D] active:translate-y-0.5 transition-all ${
              isLooping ? 'bg-[#F198B7] text-[#2C194D]' : 'bg-[#F5E1C8] text-[#2C194D]/70 hover:text-[#2C194D]'
            }`}
            title={isLooping ? 'Looping enabled' : 'Enable loop'}
          >
            <Repeat size={13} />
          </button>
        </div>

        {/* Download WAV */}
        <button
          type="button"
          onClick={handleDownloadWav}
          disabled={isDownloading}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border-[2px] border-[#2C194D] bg-[#F5E1C8] hover:bg-white text-[#2C194D] font-bold text-xs shadow-[2px_2px_0_0_#2C194D] active:translate-y-0.5 transition-all cursor-pointer"
          title="Download audio file (.WAV)"
        >
          <Download size={13} />
          <span className="hidden sm:inline">{isDownloading ? 'Rendering...' : 'Save WAV'}</span>
        </button>
      </div>
    </div>
  );
}
