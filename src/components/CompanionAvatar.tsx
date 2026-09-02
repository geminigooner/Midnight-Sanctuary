import React, { useState } from 'react';
import { ModelEntity } from '../lib/entitySystem';

export interface CompanionAvatarProps {
  entity: ModelEntity;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl';
  className?: string;
  showBadge?: boolean;
}

const sizeClasses = {
  xs: 'w-6 h-6 text-xs rounded-lg',
  sm: 'w-8 h-8 text-sm rounded-xl',
  md: 'w-10 h-10 text-base rounded-2xl',
  lg: 'w-12 h-12 text-xl rounded-2xl',
  xl: 'w-14 h-14 text-2xl sm:text-3xl rounded-2xl',
  '2xl': 'w-16 h-16 sm:w-20 sm:h-20 text-3xl sm:text-4xl rounded-3xl',
};

export const CompanionAvatar: React.FC<CompanionAvatarProps> = ({
  entity,
  size = 'md',
  className = '',
  showBadge = false,
}) => {
  const [imageFailed, setImageFailed] = useState(false);
  const sizeClass = sizeClasses[size] || sizeClasses.md;
  const hasValidPhoto = Boolean(entity.avatarUrl && !imageFailed);

  return (
    <div className="relative inline-block shrink-0">
      <div
        className={`${sizeClass} border-[2.5px] border-[#2C194D] flex items-center justify-center font-bold overflow-hidden shadow-[2px_2px_0_#2C194D] transition-transform select-none ${className}`}
        style={{
          backgroundColor: entity.themeColor || '#9D7FE3',
        }}
      >
        {hasValidPhoto ? (
          <img
            src={entity.avatarUrl}
            alt={entity.displayName}
            referrerPolicy="no-referrer"
            onError={() => setImageFailed(true)}
            className="w-full h-full object-cover"
          />
        ) : (
          <span className="leading-none flex items-center justify-center">
            {entity.avatarEmoji || '✨'}
          </span>
        )}
      </div>

      {showBadge && (
        <span
          className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-[#F198B7] border-2 border-[#2C194D] flex items-center justify-center text-[9px] shadow-sm"
          title={entity.roleTitle}
        >
          ✦
        </span>
      )}
    </div>
  );
};
