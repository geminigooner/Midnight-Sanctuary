import React, { useState } from 'react';
import { Gift as GiftType } from '../lib/types';
import { X, Gift } from 'lucide-react';
import { motion, useReducedMotion, AnimatePresence } from 'motion/react';
import { getMotion } from '../lib/motion';

interface GiftsArchiveProps {
  gifts: GiftType[];
  onClose: () => void;
}

export function GiftsArchive({ gifts, onClose }: GiftsArchiveProps) {
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const reducedMotion = useReducedMotion();
  const modalMotion = getMotion('heavy', reducedMotion);

  return (
    <>
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
        className="bg-[#151234] border-[3px] border-[#2C194D] shadow-[8px_8px_0_#2C194D] rounded-3xl w-full max-w-4xl max-h-[85vh] flex flex-col relative overflow-hidden"
      >
        <div className="flex items-center justify-between p-6 border-b-[3px] border-[#2C194D] bg-[#151234] shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-[#F198B7] border-[3px] border-[#2C194D] flex items-center justify-center text-[#2C194D] shadow-[2px_2px_0_#2C194D]">
              <Gift size={20} />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-[#F5E1C8] tracking-tight">Gifts Archive</h2>
              <p className="text-sm font-bold text-[#B39DE5]">Moments held onto</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-glass rounded-full transition-colors text-[#2C194D] hover:text-[#2C194D]">
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
          {gifts.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-mauve opacity-50 space-y-4 min-h-[40vh]">
              <Gift size={48} className="opacity-20" />
              <p className="tracking-widest uppercase text-sm">No gifts received yet.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {gifts.map(gift => (
                <div key={gift.id} className="bg-[#F5E1C8] border-[3px] border-[#2C194D] rounded-2xl p-5 hover:shadow-[4px_4px_0_#2C194D] transition-colors flex flex-col gap-3 group">
                  {gift.inlineData && (
                    <div 
                      className="w-full h-32 overflow-hidden rounded-lg mb-2 cursor-pointer hover:opacity-80 transition-opacity"
                      onClick={() => setSelectedImage(`data:${gift.inlineData!.mimeType};base64,${gift.inlineData!.data}`)}
                    >
                      <img src={`data:${gift.inlineData.mimeType};base64,${gift.inlineData.data}`} className="w-full h-full object-cover" alt="gift" />
                    </div>
                  )}
                  <div className="flex-1 text-[#2C194D] prose prose-p:leading-relaxed prose-sm max-w-none">
                    {gift.content}
                  </div>
                  
                  <div className="flex flex-col gap-1 mt-2 pt-3 border-t border-glass-border border-dashed">
                    <span className="text-xs text-[#F198B7] uppercase tracking-widest font-bold bg-[#2C194D] px-2 py-1 rounded w-max">
                      {gift.gift_type}
                    </span>
                    {gift.reason && (
                      <span className="text-[10px] text-mauve opacity-0 group-hover:opacity-100 transition-opacity duration-300 italic">
                        {gift.reason}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </motion.div>
    </motion.div>

      <AnimatePresence>
        {selectedImage && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setSelectedImage(null)}
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/95 backdrop-blur-xl cursor-pointer"
          >
            <button className="absolute top-6 right-6 p-2 text-mauve hover:text-white transition-colors bg-white/10 rounded-full">
              <X size={24} />
            </button>
            <motion.img 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              src={selectedImage}
              alt="Full screen gift"
              className="max-w-full max-h-[90vh] object-contain rounded-xl shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
