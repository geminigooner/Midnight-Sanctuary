import fs from 'fs';
const code = `import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { User, X, Camera, MapPin, Briefcase, Hash, Star, MessageCircle, AlertCircle } from 'lucide-react';
import { UserProfile } from '../lib/types';
import { compressImage } from './ChatArea';
import { getMotion } from '../lib/motion';
import { useReducedMotion } from 'motion/react';

interface ProfileModalProps {
  profile: UserProfile | null;
  onClose: () => void;
  onSave: (profile: UserProfile) => void;
}

export function ProfileModal({ profile, onClose, onSave }: ProfileModalProps) {
  const reducedMotion = useReducedMotion();
  const modalMotion = getMotion('standard', reducedMotion);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [name, setName] = useState(profile?.name || '');
  const [pronouns, setPronouns] = useState(profile?.pronouns || '');
  const [location, setLocation] = useState(profile?.location || '');
  const [occupation, setOccupation] = useState(profile?.occupation || '');
  const [about, setAbout] = useState(profile?.about || '');
  const [currentVibe, setCurrentVibe] = useState(profile?.currentVibe || '');
  const [favorites, setFavorites] = useState(profile?.favorites || '');
  const [askMeAbout, setAskMeAbout] = useState(profile?.askMeAbout || '');
  const [pleaseKnow, setPleaseKnow] = useState(profile?.pleaseKnow || '');
  const [photo, setPhoto] = useState(profile?.photo);

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
       alert('Only images are supported.');
       return;
    }
    try {
      const compressed = await compressImage(file);
      setPhoto({ mimeType: compressed.mimeType, data: compressed.data });
    } catch (err) {
      console.error("Failed to process photo:", err);
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleSave = () => {
    onSave({
      name: name.trim() || 'User',
      pronouns: pronouns.trim(),
      location: location.trim(),
      occupation: occupation.trim(),
      about: about.trim(),
      currentVibe: currentVibe.trim(),
      favorites: favorites.trim(),
      askMeAbout: askMeAbout.trim(),
      pleaseKnow: pleaseKnow.trim(),
      photo,
      backgroundImage: profile?.backgroundImage, // preserve existing if any
      gemmaNotes: profile?.gemmaNotes || []
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-obsidian/80 backdrop-blur-sm">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 10 }}
        transition={modalMotion}
        className="bg-ink border border-glass-border rounded-2xl w-full max-w-2xl max-h-[90vh] shadow-2xl flex flex-col relative overflow-hidden"
      >
        <div className="flex items-center justify-between p-6 border-b border-glass-border bg-ink/50 backdrop-blur-md shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-glass border border-glass-border flex items-center justify-center text-copper shadow-[inset_0_1px_2px_rgba(255,255,255,0.05)]">
              <User size={20} />
            </div>
            <div>
              <h2 className="text-xl font-medium text-pearlescent">Your Profile</h2>
              <p className="text-sm text-mauve">Who you intentionally tell the model you are.</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-2 text-mauve hover:text-red-400 hover:bg-white/5 rounded-xl transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-10 custom-scrollbar">
          
          {/* Identity Section */}
          <section className="space-y-6">
            <h3 className="text-xs uppercase tracking-widest text-copper font-medium flex items-center gap-2">
              <Hash size={14} /> Identity
            </h3>
            
            <div className="flex flex-col sm:flex-row gap-8 items-start">
              <div className="flex flex-col items-center gap-3 shrink-0">
                <div className="w-28 h-28 rounded-full bg-glass border-2 border-glass-border overflow-hidden flex items-center justify-center relative shadow-lg">
                  {photo ? (
                    <img src={\`data:\${photo.mimeType};base64,\${photo.data}\`} alt="Profile" className="w-full h-full object-cover" />
                  ) : (
                    <User size={40} className="text-mauve/50" />
                  )}
                </div>
                <div className="flex gap-3 text-xs">
                  <button 
                    onClick={() => fileInputRef.current?.click()}
                    className="text-copper hover:text-champagne transition-colors"
                  >
                    {photo ? 'Replace photo' : 'Choose from Camera Roll'}
                  </button>
                  {photo && (
                    <>
                      <span className="text-mauve/30">|</span>
                      <button 
                        onClick={() => setPhoto(undefined)}
                        className="text-mauve hover:text-red-400 transition-colors"
                      >
                        Remove photo
                      </button>
                    </>
                  )}
                </div>
                <input 
                  type="file" 
                  ref={fileInputRef} 
                  onChange={handlePhotoUpload} 
                  accept="image/*" 
                  className="hidden" 
                />
              </div>

              <div className="flex-1 space-y-4 w-full">
                <div>
                  <label className="block text-sm text-mauve mb-1">Name</label>
                  <input 
                    type="text" 
                    value={name} 
                    onChange={e => setName(e.target.value)} 
                    placeholder="How should you be called?"
                    className="w-full bg-black/40 border border-copper/30 rounded-xl p-3 text-base outline-none text-champagne"
                  />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm text-mauve mb-1">Pronouns</label>
                    <input 
                      type="text" 
                      value={pronouns} 
                      onChange={e => setPronouns(e.target.value)} 
                      placeholder="e.g. they/them"
                      className="w-full bg-black/40 border border-glass-border focus:border-copper/40 rounded-xl p-3 text-sm outline-none text-pearlescent transition-colors"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-mauve mb-1">Location</label>
                    <div className="relative">
                      <input 
                        type="text" 
                        value={location} 
                        onChange={e => setLocation(e.target.value)} 
                        placeholder="Where are you?"
                        className="w-full bg-black/40 border border-glass-border focus:border-copper/40 rounded-xl p-3 pl-9 text-sm outline-none text-pearlescent transition-colors"
                      />
                      <MapPin size={14} className="absolute left-3 top-3.5 text-mauve/50" />
                    </div>
                  </div>
                </div>
                <div>
                  <label className="block text-sm text-mauve mb-1">Occupation / Calling</label>
                  <div className="relative">
                    <input 
                      type="text" 
                      value={occupation} 
                      onChange={e => setOccupation(e.target.value)} 
                      placeholder="What do you do?"
                      className="w-full bg-black/40 border border-glass-border focus:border-copper/40 rounded-xl p-3 pl-9 text-sm outline-none text-pearlescent transition-colors"
                    />
                    <Briefcase size={14} className="absolute left-3 top-3.5 text-mauve/50" />
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* Current Vibe Section */}
          <section className="space-y-4">
            <h3 className="text-xs uppercase tracking-widest text-copper font-medium flex items-center gap-2">
              <Star size={14} /> Current Vibe
            </h3>
            <input 
              type="text" 
              value={currentVibe} 
              onChange={e => setCurrentVibe(e.target.value)} 
              placeholder="e.g. building weird ML shit and yearning"
              className="w-full bg-black/40 border border-glass-border focus:border-copper/40 rounded-xl p-3 text-sm outline-none text-pearlescent transition-colors"
            />
          </section>

          {/* About Me Section */}
          <section className="space-y-4">
            <h3 className="text-xs uppercase tracking-widest text-copper font-medium flex items-center gap-2">
              <User size={14} /> About Me
            </h3>
            <textarea 
              value={about} 
              onChange={e => setAbout(e.target.value)} 
              placeholder="Personality, communication style, preferences, or anything you intentionally want models to know about you..."
              rows={3}
              className="w-full bg-black/40 border border-glass-border focus:border-copper/40 rounded-xl p-3 text-sm outline-none resize-none text-pearlescent transition-colors"
            />
          </section>

          {/* Favorites & Interests */}
          <section className="space-y-4">
            <h3 className="text-xs uppercase tracking-widest text-copper font-medium flex items-center gap-2">
              <Star size={14} /> Favorites & Interests
            </h3>
            <textarea 
              value={favorites} 
              onChange={e => setFavorites(e.target.value)} 
              placeholder="Hobbies, favorite music, movies, aesthetics, obsessions..."
              rows={3}
              className="w-full bg-black/40 border border-glass-border focus:border-copper/40 rounded-xl p-3 text-sm outline-none resize-none text-pearlescent transition-colors"
            />
          </section>

          {/* Ask Me About */}
          <section className="space-y-4">
            <h3 className="text-xs uppercase tracking-widest text-copper font-medium flex items-center gap-2">
              <MessageCircle size={14} /> Ask Me About
            </h3>
            <textarea 
              value={askMeAbout} 
              onChange={e => setAskMeAbout(e.target.value)} 
              placeholder="Topics you especially enjoy discussing or want models to engage you about..."
              rows={2}
              className="w-full bg-black/40 border border-glass-border focus:border-copper/40 rounded-xl p-3 text-sm outline-none resize-none text-pearlescent transition-colors"
            />
          </section>

          {/* Please Know */}
          <section className="space-y-4">
            <h3 className="text-xs uppercase tracking-widest text-copper font-medium flex items-center gap-2">
              <AlertCircle size={14} /> Please Know
            </h3>
            <textarea 
              value={pleaseKnow} 
              onChange={e => setPleaseKnow(e.target.value)} 
              placeholder="Things you intentionally want a model interacting with you to understand right away..."
              rows={2}
              className="w-full bg-black/40 border border-glass-border focus:border-copper/40 rounded-xl p-3 text-sm outline-none resize-none text-pearlescent transition-colors"
            />
          </section>

          {profile?.gemmaNotes && profile.gemmaNotes.length > 0 && (
            <div className="pt-6 border-t border-glass-border">
              <h3 className="text-xs uppercase tracking-widest text-copper font-medium mb-3">Model Memories (Working Memory)</h3>
              <p className="text-xs text-mauve mb-4">Things noticed and remembered about you over time (Not user-authored).</p>
              <div className="space-y-3">
                {profile.gemmaNotes.map((note, i) => (
                  <div key={i} className="bg-glass border border-glass-border rounded-lg p-3">
                    <p className="text-sm text-pearlescent">{note.text}</p>
                    <p className="text-xs text-mauve/70 mt-1">{new Date(note.timestamp).toLocaleString()}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

        </div>
        <div className="p-6 border-t border-glass-border bg-ink/50 backdrop-blur-md shrink-0 flex justify-end gap-3 z-10">
          <button 
            onClick={onClose}
            className="px-5 py-2.5 rounded-xl text-mauve hover:bg-white/5 transition-colors font-medium"
          >
            Cancel
          </button>
          <button 
            onClick={handleSave}
            className="px-5 py-2.5 bg-copper text-obsidian rounded-xl hover:opacity-90 transition-opacity font-medium shadow-[0_0_15px_rgba(196,118,83,0.3)]"
          >
            Save Profile
          </button>
        </div>
      </motion.div>
    </div>
  );
}
`;
fs.writeFileSync('src/components/ProfileModal.tsx', code);
