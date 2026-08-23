import React from 'react';
import { UserProfile } from '../lib/types';
import { MapPin, Briefcase, Hash, Star, MessageCircle, AlertCircle, User } from 'lucide-react';

export function ProfileView({ profile }: { profile: UserProfile }) {
  return (
    <div id="capture-profile-view" className="bg-[#151234] border-[3px] border-[#2C194D] rounded-3xl shadow-[8px_8px_0_#2C194D] w-[600px] overflow-hidden flex flex-col relative text-[#2C194D] font-sans">
      {/* Background Image / Cover */}
      {profile.backgroundImage ? (
        <div 
          className="h-40 w-full bg-cover bg-center"
          style={{ backgroundImage: `url(data:${profile.backgroundImage.mimeType};base64,${profile.backgroundImage.data})` }}
        />
      ) : (
        <div className="h-40 w-full bg-gradient-to-br from-[#B39DE5] via-[#F198B7] to-[#151234]" />
      )}
      
      <div className="px-8 pb-8 relative">
        {/* Photo Avatar */}
        <div className="absolute -top-16 left-8">
          <div className="w-32 h-32 rounded-full border-4 border-[#2C194D] bg-[#151234] border-[3px] overflow-hidden flex items-center justify-center shadow-xl">
            {profile.photo ? (
              <img src={`data:${profile.photo.mimeType};base64,${profile.photo.data}`} alt="Avatar" className="w-full h-full object-cover" />
            ) : (
              <User size={48} className="text-[#F198B7]" />
            )}
          </div>
        </div>

        <div className="pt-20 space-y-6">
          <div>
            <h1 className="text-3xl font-serif text-[#F5E1C8] font-bold tracking-wide">{profile.name || 'Anonymous User'}</h1>
            {profile.pronouns && <p className="text-[#B39DE5] text-sm uppercase tracking-widest mt-1">{profile.pronouns}</p>}
          </div>

          <div className="flex flex-wrap gap-4 text-sm text-[#B39DE5]">
            {profile.location && (
              <div className="flex items-center gap-2 bg-[#F5E1C8] px-3 py-1.5 rounded-full border-[3px] border-[#2C194D] font-bold">
                <MapPin size={14} className="text-[#F198B7]" />
                {profile.location}
              </div>
            )}
            {profile.occupation && (
              <div className="flex items-center gap-2 bg-[#F5E1C8] px-3 py-1.5 rounded-full border-[3px] border-[#2C194D] font-bold">
                <Briefcase size={14} className="text-[#F198B7]" />
                {profile.occupation}
              </div>
            )}
          </div>

          {profile.about && (
            <div className="bg-[#F5E1C8] p-4 rounded-xl border-[3px] border-[#2C194D] font-bold">
              <h3 className="text-xs uppercase tracking-widest text-[#F198B7] mb-2 flex items-center gap-2">
                <User size={12} /> About Me
              </h3>
              <p className="text-sm leading-relaxed text-[#2C194D] font-bold">{profile.about}</p>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            {profile.currentVibe && (
              <div className="bg-[#F5E1C8] p-4 rounded-xl border-[3px] border-[#2C194D] font-bold">
                <h3 className="text-xs uppercase tracking-widest text-[#F198B7] mb-2 flex items-center gap-2"><Star size={12}/> Current Vibe</h3>
                <p className="text-sm">{profile.currentVibe}</p>
              </div>
            )}
            {profile.favorites && (
              <div className="bg-[#F5E1C8] p-4 rounded-xl border-[3px] border-[#2C194D] font-bold">
                <h3 className="text-xs uppercase tracking-widest text-[#F198B7] mb-2 flex items-center gap-2"><Hash size={12}/> Favorites</h3>
                <p className="text-sm">{profile.favorites}</p>
              </div>
            )}
            {profile.askMeAbout && (
              <div className="bg-[#F5E1C8] p-4 rounded-xl border-[3px] border-[#2C194D] font-bold">
                <h3 className="text-xs uppercase tracking-widest text-[#F198B7] mb-2 flex items-center gap-2"><MessageCircle size={12}/> Ask Me About</h3>
                <p className="text-sm">{profile.askMeAbout}</p>
              </div>
            )}
            {profile.pleaseKnow && (
              <div className="bg-[#F5E1C8] p-4 rounded-xl border-[3px] border-[#2C194D] font-bold">
                <h3 className="text-xs uppercase tracking-widest text-[#F198B7] mb-2 flex items-center gap-2"><AlertCircle size={12}/> Please Know</h3>
                <p className="text-sm">{profile.pleaseKnow}</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
