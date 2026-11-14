import React from 'react';
import { useNavigation } from '../context/NavigationContext';
import { Card } from '../components/Card';
import { Button } from '../components/Button';
import { InstagramIcon, YouTubeIcon, ScissorsIcon, CheckIcon } from '../components/Icons';

export const InstagramRoute: React.FC = () => {
  const { navigate, params } = useNavigation();

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-8 overflow-y-auto max-w-4xl mx-auto w-full box-border">
      <Card className="max-w-xl w-full p-8 bg-[#14161D] border-border-strong flex flex-col items-center text-center gap-6 shadow-xl">
        {/* Instagram Icon Badge */}
        <div className="w-16 h-16 rounded-[20px] bg-gradient-to-tr from-[#FF543E] via-[#F28BB8] to-[#9B51E0] flex items-center justify-center shadow-lg">
          <InstagramIcon size={32} className="text-white" strokeWidth={2.4} />
        </div>

        {/* Title & Status */}
        <div className="flex flex-col gap-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#2B1A26] text-[#F28BB8] text-xs font-semibold mx-auto">
            <span>Coming in v2.1</span>
          </div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-foreground">
            Instagram Clipper
          </h1>
          <p className="text-foreground-muted text-sm leading-relaxed max-w-md">
            Support for clipping Instagram Reels, public video posts, and carousels will be available in the upcoming YouCut v2.1 release.
          </p>
        </div>

        {params.url && (
          <div className="w-full p-3 rounded-[12px] bg-[#0F1116] border border-border text-xs font-mono text-foreground-subtle truncate">
            Received URL: {params.url}
          </div>
        )}

        {/* Feature Preview List */}
        <div className="w-full grid grid-cols-1 gap-2.5 text-left pt-2">
          <div className="flex items-center gap-3 p-3 rounded-[12px] bg-[#0F1116] border border-border">
            <div className="w-6 h-6 rounded-full bg-[#2B1A26] flex items-center justify-center text-[#F28BB8] flex-none">
              <CheckIcon size={14} />
            </div>
            <div className="text-xs text-foreground-subtle">
              <span className="font-semibold text-foreground">Reels & Video Downloads:</span> Highest quality 1080p MP4 directly saved.
            </div>
          </div>

          <div className="flex items-center gap-3 p-3 rounded-[12px] bg-[#0F1116] border border-border">
            <div className="w-6 h-6 rounded-full bg-[#2B1A26] flex items-center justify-center text-[#F28BB8] flex-none">
              <CheckIcon size={14} />
            </div>
            <div className="text-xs text-foreground-subtle">
              <span className="font-semibold text-foreground">Audio Extraction:</span> Instant extraction to high-fidelity MP3, M4A or WAV.
            </div>
          </div>

          <div className="flex items-center gap-3 p-3 rounded-[12px] bg-[#0F1116] border border-border">
            <div className="w-6 h-6 rounded-full bg-[#2B1A26] flex items-center justify-center text-[#F28BB8] flex-none">
              <CheckIcon size={14} />
            </div>
            <div className="text-xs text-foreground-subtle">
              <span className="font-semibold text-foreground">Frame-Accurate Cuts:</span> Same desktop precision clipping engine.
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-3 w-full pt-2">
          <Button
            variant="secondary"
            size="lg"
            onClick={() => navigate('home')}
            className="flex-1"
          >
            Back to Home
          </Button>

          <Button
            variant="primary"
            size="lg"
            onClick={() => navigate('youtube')}
            className="flex-1 flex items-center justify-center gap-2"
          >
            <YouTubeIcon size={18} />
            <span>Open YouTube Clipper</span>
          </Button>
        </div>
      </Card>
    </div>
  );
};
