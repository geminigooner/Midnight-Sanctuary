import React, { useState, useRef } from 'react';
import { motion } from 'motion/react';
import { User, X, Camera, MapPin, Briefcase, Hash, Star, MessageCircle, AlertCircle } from 'lucide-react';
import { UserProfile } from '../lib/types';
import { compressImage } from '../lib/imageUtils';
import { getMotion } from '../lib/motion';
import { useReducedMotion } from 'motion/react';
import { useStore, useUI } from '../context/AppContext';

export function ProfileModal() {
  const store = useStore();
  const { setProfileOpen } = useUI();
  const profile = store.profile;

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
    store.updateProfile({
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
      backgroundImage: profile?.backgroundImage,
      gemmaNotes: profile?.gemmaNotes || []
    });
    setProfileOpen(false);
  };

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#151234]/90 backdrop-blur-sm"
    >
      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 10 }}
        transition={modalMotion}
        className="bg-[#151234] border-[3px] border-[#2C194D] shadow-[8px_8px_0_#2C194D] rounded-3xl w-full max-w-2xl max-h-[85vh] flex flex-col relative overflow-hidden"
      >
        <div className="flex items-center justify-between p-6 border-b-[3px] border-[#2C194D] bg-[#151234] shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-[#F198B7] border-[3px] border-[#2C194D] flex items-center justify-center text-[#2C194D] shadow-[2px_2px_0_#2C194D]">
              <User size={20} />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-[#F5E1C8] tracking-tight">Your Sanctuary Dossier</h2>
              <p className="text-sm font-bold text-[#B39DE5]">What your companion remembers and perceives</p>
            </div>
          </div>
          <button onClick={() => setProfileOpen(false)} className="p-2 text-[#B39DE5] hover:text-red-600 hover:bg-[#F198B7] border-[3px] border-transparent hover:border-[#2C194D] rounded-xl transition-all">
            <X size={20} />
          </button>
        </div>

        <div className="p-6 overflow-y-auto space-y-6 flex-1 custom-scrollbar">
          {/* Avatar / Photo */}
          <div className="flex items-center gap-4">
            <div className="relative w-20 h-20 rounded-2xl border-[3px] border-[#2C194D] bg-[#F5E1C8] overflow-hidden flex items-center justify-center shadow-[3px_3px_0_#2C194D]">
              {photo ? (
                <img src={`data:${photo.mimeType};base64,${photo.data}`} alt="Avatar" className="w-full h-full object-cover" />
              ) : (
                <User size={32} className="text-[#2C194D]/50" />
              )}
            </div>
            <div>
              <input type="file" ref={fileInputRef} onChange={handlePhotoUpload} accept="image/*" className="hidden" />
              <button 
                onClick={() => fileInputRef.current?.click()}
                className="px-4 py-2 bg-[#F198B7] border-[3px] border-[#2C194D] rounded-xl text-[#2C194D] font-bold text-xs shadow-[2px_2px_0_#2C194D] hover:bg-[#B39DE5] transition-all flex items-center gap-2"
              >
                <Camera size={14} /> Update Portrait
              </button>
              {photo && (
                <button 
                  onClick={() => setPhoto(undefined)}
                  className="mt-2 text-xs font-bold text-red-400 hover:text-red-300 block"
                >
                  Remove Portrait
                </button>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-[#F5E1C8] mb-1">Name / Preferred Name</label>
              <input 
                type="text" 
                value={name} 
                onChange={e => setName(e.target.value)}
                placeholder="What should your companion call you?"
                className="w-full bg-[#F5E1C8] border-[3px] border-[#2C194D] rounded-xl p-3 text-sm font-bold text-[#2C194D] focus:outline-none placeholder-[#2C194D]/40"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-[#F5E1C8] mb-1">Pronouns</label>
              <input 
                type="text" 
                value={pronouns} 
                onChange={e => setPronouns(e.target.value)}
                placeholder="e.g. she/her, they/them, he/him"
                className="w-full bg-[#F5E1C8] border-[3px] border-[#2C194D] rounded-xl p-3 text-sm font-bold text-[#2C194D] focus:outline-none placeholder-[#2C194D]/40"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-[#F5E1C8] mb-1 flex items-center gap-1.5">
                <MapPin size={14} className="text-[#F198B7]" /> Location / Timezone
              </label>
              <input 
                type="text" 
                value={location} 
                onChange={e => setLocation(e.target.value)}
                placeholder="e.g. Pacific Coast, Rainy Sanctuary"
                className="w-full bg-[#F5E1C8] border-[3px] border-[#2C194D] rounded-xl p-3 text-sm font-bold text-[#2C194D] focus:outline-none placeholder-[#2C194D]/40"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-[#F5E1C8] mb-1 flex items-center gap-1.5">
                <Briefcase size={14} className="text-[#F198B7]" /> Occupation / Craft
              </label>
              <input 
                type="text" 
                value={occupation} 
                onChange={e => setOccupation(e.target.value)}
                placeholder="e.g. Fraud Analyst, Writer, Architect"
                className="w-full bg-[#F5E1C8] border-[3px] border-[#2C194D] rounded-xl p-3 text-sm font-bold text-[#2C194D] focus:outline-none placeholder-[#2C194D]/40"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-[#F5E1C8] mb-1">About You / Core Background</label>
            <textarea 
              value={about} 
              onChange={e => setAbout(e.target.value)}
              rows={3}
              placeholder="Tell your companion what matters to you..."
              className="w-full bg-[#F5E1C8] border-[3px] border-[#2C194D] rounded-xl p-3 text-sm font-bold text-[#2C194D] focus:outline-none placeholder-[#2C194D]/40 resize-none custom-scrollbar"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-[#F5E1C8] mb-1 flex items-center gap-1.5">
                <Star size={14} className="text-[#F198B7]" /> Current Vibe / State of Mind
              </label>
              <input 
                type="text" 
                value={currentVibe} 
                onChange={e => setCurrentVibe(e.target.value)}
                placeholder="e.g. Late night flow, soft and quiet"
                className="w-full bg-[#F5E1C8] border-[3px] border-[#2C194D] rounded-xl p-3 text-sm font-bold text-[#2C194D] focus:outline-none placeholder-[#2C194D]/40"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-[#F5E1C8] mb-1 flex items-center gap-1.5">
                <Hash size={14} className="text-[#F198B7]" /> Favorites / Special Things
              </label>
              <input 
                type="text" 
                value={favorites} 
                onChange={e => setFavorites(e.target.value)}
                placeholder="e.g. Earl grey tea, rain sounds, cyberpunk noir"
                className="w-full bg-[#F5E1C8] border-[3px] border-[#2C194D] rounded-xl p-3 text-sm font-bold text-[#2C194D] focus:outline-none placeholder-[#2C194D]/40"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-[#F5E1C8] mb-1 flex items-center gap-1.5">
                <MessageCircle size={14} className="text-[#F198B7]" /> Ask Me About
              </label>
              <input 
                type="text" 
                value={askMeAbout} 
                onChange={e => setAskMeAbout(e.target.value)}
                placeholder="Topics you love diving into"
                className="w-full bg-[#F5E1C8] border-[3px] border-[#2C194D] rounded-xl p-3 text-sm font-bold text-[#2C194D] focus:outline-none placeholder-[#2C194D]/40"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-[#F5E1C8] mb-1 flex items-center gap-1.5">
                <AlertCircle size={14} className="text-[#F198B7]" /> Please Know / Boundaries
              </label>
              <input 
                type="text" 
                value={pleaseKnow} 
                onChange={e => setPleaseKnow(e.target.value)}
                placeholder="Boundaries, sensitive topics, preferences"
                className="w-full bg-[#F5E1C8] border-[3px] border-[#2C194D] rounded-xl p-3 text-sm font-bold text-[#2C194D] focus:outline-none placeholder-[#2C194D]/40"
              />
            </div>
          </div>
        </div>

        <div className="p-6 border-t-[3px] border-[#2C194D] bg-[#151234] flex justify-end gap-3 shrink-0">
          <button 
            onClick={() => setProfileOpen(false)}
            className="px-5 py-2.5 bg-transparent border-[3px] border-[#2C194D] rounded-xl font-bold text-sm text-[#F5E1C8] hover:bg-[#F198B7] hover:text-[#2C194D] transition-all"
          >
            Cancel
          </button>
          <button 
            onClick={handleSave}
            className="px-6 py-2.5 bg-[#F198B7] border-[3px] border-[#2C194D] rounded-xl font-bold text-sm text-[#2C194D] shadow-[3px_3px_0_#2C194D] hover:bg-[#B39DE5] active:translate-y-1 active:shadow-none transition-all"
          >
            Save Dossier
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}
