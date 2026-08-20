import React from 'react';
import { UserProfile } from '../lib/types';
import { MapPin, Briefcase, Hash, Star, MessageCircle, AlertCircle, User } from 'lucide-react';

export function ProfileView({ profile }: { profile: UserProfile }) {
  return (
    <div id="capture-profile-view" className="bg-ink border-2 border-copper/30 rounded-3xl w-[600px] overflow-hidden flex flex-col relative text-pearlescent font-sans">
      {/* Background Image / Cover */}
      {profile.backgroundImage ? (
        <div 
          className="h-40 w-full bg-cover bg-center"
          style={{ backgroundImage: `url(data:${profile.backgroundImage.mimeType};base64,${profile.backgroundImage.data})` }}
        />
      ) : (
        <div className="h-40 w-full bg-gradient-to-br from-copper/20 via-plum/30 to-obsidian" />
      )}
      
      <div className="px-8 pb-8 relative">
        {/* Photo Avatar */}
        <div className="absolute -top-16 left-8">
          <div className="w-32 h-32 rounded-full border-4 border-ink bg-obsidian overflow-hidden flex items-center justify-center shadow-xl">
            {profile.photo ? (
              <img src={`data:${profile.photo.mimeType};base64,${profile.photo.data}`} alt="Avatar" className="w-full h-full object-cover" />
            ) : (
              <User size={48} className="text-copper" />
            )}
          </div>
        </div>

        <div className="pt-20 space-y-6">
          <div>
            <h1 className="text-3xl font-serif text-champagne tracking-wide">{profile.name || 'Anonymous User'}</h1>
            {profile.pronouns && <p className="text-mauve text-sm uppercase tracking-widest mt-1">{profile.pronouns}</p>}
          </div>

          <div className="flex flex-wrap gap-4 text-sm text-mauve">
            {profile.location && (
              <div className="flex items-center gap-2 bg-glass px-3 py-1.5 rounded-full border border-glass-border">
                <MapPin size={14} className="text-copper" />
                {profile.location}
              </div>
            )}
            {profile.occupation && (
              <div className="flex items-center gap-2 bg-glass px-3 py-1.5 rounded-full border border-glass-border">
                <Briefcase size={14} className="text-copper" />
                {profile.occupation}
              </div>
            )}
          </div>

          {profile.about && (
            <div className="bg-black/20 p-4 rounded-xl border border-glass-border">
              <h3 className="text-xs uppercase tracking-widest text-copper mb-2 flex items-center gap-2">
                <User size={12} /> About Me
              </h3>
              <p className="text-sm leading-relaxed text-pearlescent/90">{profile.about}</p>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            {profile.currentVibe && (
              <div className="bg-glass p-4 rounded-xl border border-glass-border">
                <h3 className="text-xs uppercase tracking-widest text-copper mb-2 flex items-center gap-2"><Star size={12}/> Current Vibe</h3>
                <p className="text-sm">{profile.currentVibe}</p>
              </div>
            )}
            {profile.favorites && (
              <div className="bg-glass p-4 rounded-xl border border-glass-border">
                <h3 className="text-xs uppercase tracking-widest text-copper mb-2 flex items-center gap-2"><Hash size={12}/> Favorites</h3>
                <p className="text-sm">{profile.favorites}</p>
              </div>
            )}
            {profile.askMeAbout && (
              <div className="bg-glass p-4 rounded-xl border border-glass-border">
                <h3 className="text-xs uppercase tracking-widest text-copper mb-2 flex items-center gap-2"><MessageCircle size={12}/> Ask Me About</h3>
                <p className="text-sm">{profile.askMeAbout}</p>
              </div>
            )}
            {profile.pleaseKnow && (
              <div className="bg-glass p-4 rounded-xl border border-glass-border">
                <h3 className="text-xs uppercase tracking-widest text-copper mb-2 flex items-center gap-2"><AlertCircle size={12}/> Please Know</h3>
                <p className="text-sm">{profile.pleaseKnow}</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
