import React, { useState } from 'react';
import { motion } from 'motion/react';
import { X, ShieldCheck, LogIn, LogOut, AlertCircle, Sparkles, CheckCircle2 } from 'lucide-react';
import { auth, googleProvider, signInWithPopup, signOut } from '../lib/firebase';
import { useStore, useUI } from '../context/AppContext';
import { triggerHaptic } from '../lib/haptics';

export const AuthModal: React.FC = () => {
  const store = useStore();
  const ui = useUI();
  const [isLoading, setIsLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  const currentUser = store.user;
  const isAuthorizedOwner = currentUser?.email === 'ahatley094@gmail.com';

  const handleSignIn = async () => {
    triggerHaptic('medium');
    setIsLoading(true);
    setAuthError(null);
    try {
      await signInWithPopup(auth, googleProvider);
      triggerHaptic('heavy');
      ui.setAuthModalOpen(false);
    } catch (err: any) {
      console.error('Sign-in error:', err);
      setAuthError(err?.message || 'Failed to sign in. If popups are blocked in your browser/iframe, please allow popups or open in a new tab.');
      triggerHaptic('light');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignOut = async () => {
    triggerHaptic('medium');
    setIsLoading(true);
    try {
      await signOut(auth);
      triggerHaptic('light');
    } catch (err: any) {
      console.error('Sign-out error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#151234]/85 backdrop-blur-md"
      onClick={() => ui.setAuthModalOpen(false)}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 15 }}
        className="bg-[#F5E1C8] border-[3px] border-[#2C194D] shadow-[8px_8px_0_#2C194D] rounded-3xl w-full max-w-md flex flex-col overflow-hidden text-[#2C194D]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b-[3px] border-[#2C194D] bg-[#9D7FE3]">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-2xl bg-[#F5E1C8] border-[2px] border-[#2C194D] flex items-center justify-center text-[#2C194D] shadow-[2px_2px_0_#2C194D]">
              <ShieldCheck size={20} strokeWidth={2.5} />
            </div>
            <div>
              <h2 className="text-lg font-extrabold text-[#2C194D] leading-tight">Sanctuary Gate</h2>
              <p className="text-[11px] font-bold text-[#2C194D]/75">Firebase Single-User Authentication</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => ui.setAuthModalOpen(false)}
            className="p-2 text-[#2C194D] hover:bg-[#F198B7] border-[2px] border-[#2C194D] rounded-xl transition-all shadow-[2px_2px_0_#2C194D] cursor-pointer"
          >
            <X size={18} strokeWidth={2.5} />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-5">
          {currentUser ? (
            <div className="space-y-4">
              <div className="p-4 rounded-2xl bg-[#F198B7]/30 border-[2px] border-[#2C194D] flex items-center gap-3.5 shadow-[2px_2px_0_#2C194D]">
                {currentUser.photoURL ? (
                  <img
                    src={currentUser.photoURL}
                    alt={currentUser.displayName || 'User'}
                    className="w-12 h-12 rounded-full border-[2px] border-[#2C194D] object-cover"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <div className="w-12 h-12 rounded-full bg-[#9D7FE3] border-[2px] border-[#2C194D] flex items-center justify-center font-bold text-lg text-[#2C194D]">
                    {currentUser.displayName?.[0] || currentUser.email?.[0] || 'U'}
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className="font-extrabold text-sm truncate">{currentUser.displayName || 'Sanctuary Owner'}</span>
                    {isAuthorizedOwner && (
                      <CheckCircle2 size={16} className="text-emerald-700 shrink-0" strokeWidth={2.5} />
                    )}
                  </div>
                  <p className="text-xs font-semibold text-[#2C194D]/75 truncate">{currentUser.email}</p>
                  <span className={`inline-block mt-1 text-[10px] font-extrabold px-2 py-0.5 rounded-full border ${
                    isAuthorizedOwner ? 'bg-emerald-100 text-emerald-800 border-emerald-600' : 'bg-amber-100 text-amber-800 border-amber-600'
                  }`}>
                    {isAuthorizedOwner ? '✓ Verified Sanctuary Owner' : '⚠️ Unauthorized Account'}
                  </span>
                </div>
              </div>

              {!isAuthorizedOwner && (
                <div className="p-3 rounded-xl bg-amber-50 border-[2px] border-amber-700 text-amber-900 text-xs font-semibold flex items-start gap-2">
                  <AlertCircle size={16} className="shrink-0 mt-0.5 text-amber-700" />
                  <span>Only <strong className="font-bold">ahatley094@gmail.com</strong> is authorized to generate responses and access this sanctuary. Please sign in with that Google account.</span>
                </div>
              )}

              <button
                type="button"
                onClick={handleSignOut}
                disabled={isLoading}
                className="w-full py-3 px-4 rounded-2xl bg-[#F5E1C8] hover:bg-[#F198B7]/40 border-[3px] border-[#2C194D] text-[#2C194D] font-extrabold text-sm shadow-[0_4px_0_0_#2C194D] active:translate-y-0.5 flex items-center justify-center gap-2 transition-all cursor-pointer"
              >
                <LogOut size={16} strokeWidth={2.5} />
                <span>{isLoading ? 'Signing out...' : 'Sign Out'}</span>
              </button>
            </div>
          ) : (
            <div className="space-y-4 text-center">
              <div className="w-16 h-16 mx-auto rounded-3xl bg-[#9D7FE3] border-[3px] border-[#2C194D] flex items-center justify-center text-[#2C194D] shadow-[4px_4px_0_#2C194D]">
                <Sparkles size={32} strokeWidth={2} />
              </div>

              <div>
                <h3 className="text-base font-extrabold text-[#2C194D]">Welcome to the Sanctuary</h3>
                <p className="text-xs font-semibold text-[#2C194D]/80 mt-1 max-w-xs mx-auto">
                  Sign in with your authorized Google Account (<span className="font-bold underline">ahatley094@gmail.com</span>) to unlock conversations, tools, and sync your state.
                </p>
              </div>

              {authError && (
                <div className="p-3 rounded-xl bg-red-100 border-[2px] border-red-600 text-red-900 text-xs font-semibold text-left flex items-start gap-2">
                  <AlertCircle size={16} className="shrink-0 mt-0.5 text-red-700" />
                  <span>{authError}</span>
                </div>
              )}

              <button
                type="button"
                onClick={handleSignIn}
                disabled={isLoading}
                className="w-full py-3.5 px-4 rounded-2xl bg-[#9D7FE3] hover:bg-[#8e6fd7] border-[3px] border-[#2C194D] text-[#2C194D] font-extrabold text-sm shadow-[0_4px_0_0_#2C194D] active:translate-y-0.5 flex items-center justify-center gap-2.5 transition-all cursor-pointer"
              >
                <LogIn size={18} strokeWidth={2.5} />
                <span>{isLoading ? 'Connecting to Google...' : 'Sign In with Google'}</span>
              </button>
            </div>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
};
