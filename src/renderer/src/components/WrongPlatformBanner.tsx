import React from 'react';
import { Button } from './Button';
import { InstagramIcon, FacebookIcon } from './Icons';

export interface WrongPlatformBannerProps {
  detectedPlatform: 'Instagram' | 'Facebook';
  onSwitch: () => void;
  onDismiss: () => void;
}

export const WrongPlatformBanner: React.FC<WrongPlatformBannerProps> = ({
  detectedPlatform,
  onSwitch,
  onDismiss
}) => {
  const isInstagram = detectedPlatform === 'Instagram';

  return (
    <div
      role="alert"
      className="w-full p-3 px-4 rounded-[14px] bg-[#1A1822] border border-[#3E2B40] flex items-center justify-between gap-4 animate-in fade-in duration-200"
    >
      <div className="flex items-center gap-3">
        <div className={`w-8 h-8 rounded-[10px] flex items-center justify-center ${isInstagram ? 'bg-[#2B1A26] text-[#F28BB8]' : 'bg-[#17233D] text-[#8DB4FF]'}`}>
          {isInstagram ? <InstagramIcon size={18} /> : <FacebookIcon size={18} />}
        </div>
        <div>
          <div className="text-xs font-semibold text-foreground">
            {detectedPlatform} link detected
          </div>
          <div className="text-[11px] text-foreground-muted">
            You are currently on the YouTube clipper. Would you like to switch to {detectedPlatform}?
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Button
          variant="secondary"
          size="sm"
          onClick={onDismiss}
          className="text-xs px-3"
        >
          Dismiss
        </Button>
        <Button
          variant="primary"
          size="sm"
          onClick={onSwitch}
          className="text-xs px-4 font-bold"
        >
          Switch to {detectedPlatform}
        </Button>
      </div>
    </div>
  );
};

export const PlaylistNoticeBanner: React.FC<{ onDismiss?: () => void }> = ({ onDismiss }) => {
  return (
    <div
      role="status"
      className="w-full p-2.5 px-4 rounded-[12px] bg-[#2A2315] border border-[#52411F] flex items-center justify-between gap-3 text-xs text-[#F2C94C]"
    >
      <div className="flex items-center gap-2 font-medium">
        <span className="w-1.5 h-1.5 rounded-full bg-[#F2C94C]" />
        <span>Playlists aren't supported yet. Clipping this video only.</span>
      </div>
      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          className="text-[11px] underline opacity-80 hover:opacity-100"
        >
          Got it
        </button>
      )}
    </div>
  );
};
