import React from 'react';
import { FolderHeart, X } from 'lucide-react';
import { useUI } from '../context/AppContext';
import { SharedModalShell, SharedModalIcon, SharedModalBody } from './SharedModalShell';
import { VaultDashboard } from './VaultDashboard';

export const SanctuaryVaultModal: React.FC = () => {
  const ui = useUI();
  const originId = ui.modalOrigins.sanctuaryVault;

  return (
    <SharedModalShell
      originId={originId}
      onClose={() => ui.closeModal('sanctuaryVault')}
      panelClassName="bg-[#151234] border-[3px] border-[#2C194D] shadow-[8px_8px_0_#2C194D] rounded-3xl w-full max-w-6xl max-h-[92vh] flex flex-col relative overflow-hidden"
    >
      {/* Header */}
      <div className="flex items-center justify-between p-4 sm:p-6 border-b-[3px] border-[#2C194D] bg-[#151234] shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <SharedModalIcon
            originId={originId}
            className="w-12 h-12 rounded-2xl bg-[#F198B7] border-[3px] border-[#2C194D] flex items-center justify-center text-[#2C194D] shadow-[2px_2px_0_#2C194D] shrink-0"
          >
            <FolderHeart size={22} strokeWidth={2.5} />
          </SharedModalIcon>
          <div className="min-w-0">
            <h2 className="text-xl sm:text-2xl font-extrabold text-[#F5E1C8] tracking-tight font-serif truncate">
              Sanctuary Vault Dashboard
            </h2>
            <p className="text-xs sm:text-sm font-bold text-[#B39DE5] truncate">
              Private Model-User storage folders &amp; Shared Sanctuary folder for common assets
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => ui.closeModal('sanctuaryVault')}
          className="p-2 text-[#B39DE5] hover:text-red-500 hover:bg-[#F198B7] border-[3px] border-transparent hover:border-[#2C194D] rounded-xl transition-all cursor-pointer"
        >
          <X size={20} />
        </button>
      </div>

      <SharedModalBody className="flex-1 overflow-y-auto custom-scrollbar">
        <VaultDashboard onCloseModal={() => ui.closeModal('sanctuaryVault')} />
      </SharedModalBody>
    </SharedModalShell>
  );
};
