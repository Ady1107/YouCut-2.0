import React, { useState } from 'react';
import { useNavigation } from '../context/NavigationContext';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { LinkIcon, YouTubeIcon, InstagramIcon, FacebookIcon, ScissorsIcon, DownloadIcon } from '../components/Icons';
import { readClipboardText } from '../utils/clipboard';

export const Home: React.FC = () => {
  const [inputUrl, setInputUrl] = useState('');
  const { navigate, showToast } = useNavigation();

  const handleRouteByUrl = (urlToRoute: string) => {
    const trimmed = urlToRoute.trim();
    if (!trimmed) {
      showToast('Please paste a video URL', 'info');
      return;
    }

    if (trimmed.includes('youtube.com') || trimmed.includes('youtu.be')) {
      navigate('youtube', { url: trimmed, autoFetch: true });
    } else if (trimmed.includes('instagram.com')) {
      navigate('instagram', { url: trimmed, autoFetch: true });
    } else if (trimmed.includes('facebook.com') || trimmed.includes('fb.watch')) {
      navigate('facebook', { url: trimmed, autoFetch: true });
    } else {
      // Default to YouTube with toast notice
      showToast('URL detected, opening YouTube clipper', 'info');
      navigate('youtube', { url: trimmed, autoFetch: true });
    }
  };

  const handlePaste = async () => {
    try {
      const text = await readClipboardText();
      if (text && text.trim()) {
        const cleanText = text.trim();
        setInputUrl(cleanText);
        handleRouteByUrl(cleanText);
      } else {
        showToast('Clipboard is empty or does not contain text', 'info');
      }
    } catch {
      showToast('Could not access clipboard', 'error');
    }
  };

  return (
    <div className="flex-1 flex flex-col gap-6 p-8 overflow-y-auto max-w-6xl mx-auto w-full box-border">
      {/* Hero Welcome */}
      <div className="flex flex-col gap-2 pt-2">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#2A1B19] text-[#FF8C7E] text-xs font-semibold w-fit">
          <ScissorsIcon size={14} className="stroke-[#FF8C7E]" />
          <span>Desktop Video & Audio Clipper</span>
        </div>
        <h1 className="font-display text-3xl font-bold tracking-tight text-foreground">
          Welcome to YouCut
        </h1>
        <p className="text-foreground-muted text-sm max-w-xl leading-relaxed">
          Clip, trim and download high-quality videos and audio directly to your computer. Frame-accurate cuts without bloat, ads, or web servers.
        </p>
      </div>

      {/* Central Quick-Paste Box with Auto-routing */}
      <Card className="p-6 bg-[#14161D] border-border-strong shadow-lg">
        <div className="text-xs font-semibold tracking-wider text-foreground-muted uppercase mb-3">
          Instant Clip from Any Platform
        </div>
        <div className="flex items-center gap-3">
          <label className="flex-1 h-[52px] box-border flex items-center gap-3 px-4 rounded-[14px] bg-[#0F1116] border border-border-strong focus-within:border-accent transition-colors">
            <LinkIcon size={18} className="text-foreground-muted flex-none" />
            <input
              type="text"
              value={inputUrl}
              onChange={(e) => setInputUrl(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleRouteByUrl(inputUrl);
              }}
              placeholder="Paste any YouTube, Instagram or Facebook URL..."
              className="flex-1 bg-transparent border-0 outline-none text-foreground font-sans text-[15px] placeholder-foreground-muted"
            />
          </label>

          <Button variant="secondary" size="lg" onClick={handlePaste} className="px-5">
            Paste
          </Button>

          <Button
            variant="primary"
            size="lg"
            onClick={() => handleRouteByUrl(inputUrl)}
            className="px-6"
          >
            Open & Trim
          </Button>
        </div>
        <div className="flex items-center gap-4 mt-3 text-xs text-foreground-muted px-1">
          <span>Supported: YouTube Videos & Shorts · Instagram Reels · Facebook Videos</span>
        </div>
      </Card>

      {/* Supported Platforms Cards */}
      <div>
        <div className="font-display text-base font-semibold text-foreground mb-3 px-1">
          Platforms
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* YouTube Card */}
          <div
            onClick={() => navigate('youtube')}
            className="group cursor-pointer p-5 rounded-[18px] bg-card border border-border hover:border-accent hover:bg-[#1B1E27]/80 transition-all flex flex-col justify-between"
          >
            <div>
              <div className="flex items-center justify-between mb-3">
                <div className="w-10 h-10 rounded-[12px] bg-[#2A1B19] border border-accent/30 flex items-center justify-center text-accent">
                  <YouTubeIcon size={22} className="stroke-accent" />
                </div>
                <span className="text-[11px] font-semibold text-status-success bg-status-success/10 px-2 py-0.5 rounded-full">
                  Available
                </span>
              </div>
              <div className="font-display text-lg font-semibold text-foreground group-hover:text-accent transition-colors">
                YouTube
              </div>
              <p className="text-xs text-foreground-muted mt-1 leading-relaxed">
                Full videos, Shorts, audio extraction (MP3/WAV), frame-accurate trimming, and chapter splitting.
              </p>
            </div>
            <div className="mt-4 pt-3 border-t border-border/60 flex items-center justify-between text-xs font-semibold text-foreground-subtle group-hover:text-foreground">
              <span>Open Clipper</span>
              <span>→</span>
            </div>
          </div>

          {/* Instagram Card */}
          <div
            onClick={() => navigate('instagram')}
            className="group cursor-pointer p-5 rounded-[18px] bg-card border border-border hover:border-[#F28BB8] hover:bg-[#1B1E27]/80 transition-all flex flex-col justify-between"
          >
            <div>
              <div className="flex items-center justify-between mb-3">
                <div className="w-10 h-10 rounded-[12px] bg-[#2B1A26] border border-[#F28BB8]/30 flex items-center justify-center text-[#F28BB8]">
                  <InstagramIcon size={22} className="stroke-[#F28BB8]" />
                </div>
                <span className="text-[11px] font-semibold text-foreground-muted bg-surface px-2 py-0.5 rounded-full">
                  Coming Next
                </span>
              </div>
              <div className="font-display text-lg font-semibold text-foreground group-hover:text-[#F28BB8] transition-colors">
                Instagram
              </div>
              <p className="text-xs text-foreground-muted mt-1 leading-relaxed">
                Reels and posts clipper. Vertical framing preview and high-definition video downloads.
              </p>
            </div>
            <div className="mt-4 pt-3 border-t border-border/60 flex items-center justify-between text-xs font-semibold text-foreground-subtle group-hover:text-foreground">
              <span>View Status</span>
              <span>→</span>
            </div>
          </div>

          {/* Facebook Card */}
          <div
            onClick={() => navigate('facebook')}
            className="group cursor-pointer p-5 rounded-[18px] bg-card border border-border hover:border-[#8DB4FF] hover:bg-[#1B1E27]/80 transition-all flex flex-col justify-between"
          >
            <div>
              <div className="flex items-center justify-between mb-3">
                <div className="w-10 h-10 rounded-[12px] bg-[#17233D] border border-[#8DB4FF]/30 flex items-center justify-center text-[#8DB4FF]">
                  <FacebookIcon size={22} className="stroke-[#8DB4FF]" />
                </div>
                <span className="text-[11px] font-semibold text-foreground-muted bg-surface px-2 py-0.5 rounded-full">
                  Coming Next
                </span>
              </div>
              <div className="font-display text-lg font-semibold text-foreground group-hover:text-[#8DB4FF] transition-colors">
                Facebook
              </div>
              <p className="text-xs text-foreground-muted mt-1 leading-relaxed">
                Facebook public videos, watch clips, and reels trimming with audio and video formats.
              </p>
            </div>
            <div className="mt-4 pt-3 border-t border-border/60 flex items-center justify-between text-xs font-semibold text-foreground-subtle group-hover:text-foreground">
              <span>View Status</span>
              <span>→</span>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Downloads (Empty State) */}
      <Card title="Recent Downloads" subtitle="Videos and clips saved to your library">
        <div className="py-8 flex flex-col items-center justify-center text-center gap-2 text-foreground-muted">
          <DownloadIcon size={28} className="text-foreground-muted/60 mb-1" />
          <div className="text-sm font-semibold text-foreground-subtle">
            No recent downloads yet
          </div>
          <div className="text-xs max-w-sm">
            Paste a link above or open any platform from the sidebar to trim and download your first clip.
          </div>
        </div>
      </Card>
    </div>
  );
};
