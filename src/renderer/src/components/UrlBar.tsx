import React, { useState, useEffect } from 'react';
import { LinkIcon, CheckIcon } from './Icons';
import { Button } from './Button';
import { Chip } from './Chip';
import { useNavigation } from '../context/NavigationContext';
import { readClipboardText } from '../utils/clipboard';

export interface UrlBarProps {
  platform: 'YouTube' | 'Instagram' | 'Facebook';
  initialUrl?: string;
  onFetch?: (url: string) => void;
  isLoading?: boolean;
}

export const UrlBar: React.FC<UrlBarProps> = ({
  platform,
  initialUrl = '',
  onFetch,
  isLoading = false
}) => {
  const [url, setUrl] = useState(initialUrl);
  const { navigate, showToast, params } = useNavigation();

  useEffect(() => {
    if (initialUrl) {
      setUrl(initialUrl);
    }
  }, [initialUrl]);

  const handlePaste = async () => {
    try {
      const text = await readClipboardText();
      if (text && text.trim()) {
        const cleanText = text.trim();
        setUrl(cleanText);
        // Auto-route if pasted URL is from another platform
        if (cleanText.includes('instagram.com') && platform !== 'Instagram') {
          navigate('instagram', { url: cleanText });
          return;
        }
        if ((cleanText.includes('facebook.com') || cleanText.includes('fb.watch')) && platform !== 'Facebook') {
          navigate('facebook', { url: cleanText });
          return;
        }
        if ((cleanText.includes('youtube.com') || cleanText.includes('youtu.be')) && platform !== 'YouTube') {
          navigate('youtube', { url: cleanText });
          return;
        }
      } else {
        showToast('Clipboard is empty or does not contain text', 'info');
      }
    } catch {
      showToast('Could not read from clipboard', 'error');
    }
  };

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!url.trim()) {
      showToast('Please enter a video URL', 'info');
      return;
    }
    if (onFetch) {
      onFetch(url.trim());
    }
  };

  const getPlatformChipVariant = () => {
    if (platform === 'YouTube') return 'platform-youtube';
    if (platform === 'Instagram') return 'platform-instagram';
    return 'platform-facebook';
  };

  return (
    <form onSubmit={handleSubmit} className="flex items-center gap-3 w-full">
      <label className="flex-1 h-[52px] box-border flex items-center gap-3 px-4 rounded-[14px] bg-[#14161D] border border-border-strong focus-within:border-accent transition-colors">
        <LinkIcon size={18} className="text-foreground-muted flex-none" />
        <span className="sr-only">Video URL</span>
        <input
          type="text"
          data-testid="url-input"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder={`Paste a ${platform} URL (video or Short)...`}
          className="flex-1 bg-transparent border-0 outline-none text-foreground font-sans text-[15px] placeholder-foreground-muted min-w-0"
        />
        {url.trim().length > 0 && (
          <div className="flex items-center gap-2 flex-none">
            <Chip variant={getPlatformChipVariant()}>{platform}</Chip>
            <CheckIcon size={18} className="text-status-success" strokeWidth={2.5} />
          </div>
        )}
      </label>

      <Button
        type="button"
        variant="secondary"
        size="lg"
        onClick={handlePaste}
        className="flex-none px-5"
      >
        Paste
      </Button>

      <Button
        type="submit"
        variant="primary"
        size="lg"
        disabled={isLoading || !url.trim()}
        className="flex-none px-6"
      >
        {isLoading ? 'Fetching...' : 'Fetch info'}
      </Button>
    </form>
  );
};
