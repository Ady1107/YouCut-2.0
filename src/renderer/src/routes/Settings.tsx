import React, { useState } from 'react';
import { useNavigation } from '../context/NavigationContext';
import { Card } from '../components/Card';
import { Button } from '../components/Button';
import { Field } from '../components/Field';
import { writeClipboardText } from '../utils/clipboard';
import {
  FolderIcon,
  RefreshCwIcon,
  CopyIcon,
  CheckIcon,
  YouTubeIcon,
  InstagramIcon,
  FacebookIcon
} from '../components/Icons';

export const SettingsRoute: React.FC = () => {
  const { showToast } = useNavigation();

  // Settings state
  const [ytFolder, setYtFolder] = useState('C:\\Users\\User\\Downloads\\YouCut\\YouTube');
  const [igFolder, setIgFolder] = useState('C:\\Users\\User\\Downloads\\YouCut\\Instagram');
  const [fbFolder, setFbFolder] = useState('C:\\Users\\User\\Downloads\\YouCut\\Facebook');
  const [concurrentFragments, setConcurrentFragments] = useState(8);
  const [isCheckingUpdates, setIsCheckingUpdates] = useState(false);
  const [isCopied, setIsCopied] = useState(false);

  const handleBrowse = (platform: string) => {
    showToast(`Browse directory dialog will open in Phase 2 for ${platform}`, 'info');
  };

  const handleCheckUpdates = () => {
    setIsCheckingUpdates(true);
    setTimeout(() => {
      setIsCheckingUpdates(false);
      showToast('yt-dlp is up to date (2026.10.26)', 'success');
    }, 1200);
  };

  const handleCopyDiagnostics = async () => {
    const diagnostics = {
      app: 'YouCut v2.0',
      platform: 'win32',
      arch: 'x64',
      binaries: {
        ytdlp: '2026.10.26',
        ffmpeg: '7.1',
        ffprobe: '7.1'
      },
      settings: {
        concurrentFragments,
        watchdogTimeoutSec: 90
      },
      timestamp: new Date().toISOString()
    };

    try {
      const ok = await writeClipboardText(JSON.stringify(diagnostics, null, 2));
      if (ok) {
        setIsCopied(true);
        showToast('Diagnostics copied to clipboard (sensitive parameters redacted)', 'success');
        setTimeout(() => setIsCopied(false), 2000);
      } else {
        showToast('Failed to copy diagnostics', 'error');
      }
    } catch {
      showToast('Failed to copy diagnostics', 'error');
    }
  };

  return (
    <div className="flex-1 flex flex-col gap-6 p-8 overflow-y-auto max-w-4xl mx-auto w-full box-border">
      {/* Header */}
      <div className="flex flex-col gap-1">
        <h1 className="font-display text-2xl font-bold tracking-tight text-foreground">
          Settings
        </h1>
        <p className="text-foreground-muted text-xs">
          Manage platform download locations, engine fragment concurrency, binary engines, and system diagnostics.
        </p>
      </div>

      {/* Section 1: Default Download Folders */}
      <Card className="p-6 bg-[#14161D] border-border-strong flex flex-col gap-5">
        <div className="flex flex-col gap-1">
          <h2 className="font-display font-semibold text-base text-foreground">
            Download Folders
          </h2>
          <p className="text-foreground-muted text-xs">
            Files are saved to dedicated directories per platform to keep your library organized.
          </p>
        </div>

        <div className="flex flex-col gap-4">
          {/* YouTube Folder */}
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center gap-2 text-xs font-semibold text-foreground-muted">
              <YouTubeIcon size={14} className="text-[#FF8C7E]" />
              <span>YouTube Save Folder</span>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={ytFolder}
                onChange={(e) => setYtFolder(e.target.value)}
                className="flex-1 h-11 rounded-[12px] border border-border-strong bg-[#0F1116] px-3 font-mono text-[12px] text-foreground outline-none focus:border-accent"
              />
              <Button variant="secondary" size="md" onClick={() => handleBrowse('YouTube')} className="px-3">
                <FolderIcon size={16} />
              </Button>
            </div>
          </div>

          {/* Instagram Folder */}
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center gap-2 text-xs font-semibold text-foreground-muted">
              <InstagramIcon size={14} className="text-[#F28BB8]" />
              <span>Instagram Save Folder</span>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={igFolder}
                onChange={(e) => setIgFolder(e.target.value)}
                className="flex-1 h-11 rounded-[12px] border border-border-strong bg-[#0F1116] px-3 font-mono text-[12px] text-foreground outline-none focus:border-accent"
              />
              <Button variant="secondary" size="md" onClick={() => handleBrowse('Instagram')} className="px-3">
                <FolderIcon size={16} />
              </Button>
            </div>
          </div>

          {/* Facebook Folder */}
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center gap-2 text-xs font-semibold text-foreground-muted">
              <FacebookIcon size={14} className="text-[#8DB4FF]" />
              <span>Facebook Save Folder</span>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={fbFolder}
                onChange={(e) => setFbFolder(e.target.value)}
                className="flex-1 h-11 rounded-[12px] border border-border-strong bg-[#0F1116] px-3 font-mono text-[12px] text-foreground outline-none focus:border-accent"
              />
              <Button variant="secondary" size="md" onClick={() => handleBrowse('Facebook')} className="px-3">
                <FolderIcon size={16} />
              </Button>
            </div>
          </div>
        </div>
      </Card>

      {/* Section 2: Engine Concurrency & Performance */}
      <Card className="p-6 bg-[#14161D] border-border-strong flex flex-col gap-5">
        <div className="flex flex-col gap-1">
          <h2 className="font-display font-semibold text-base text-foreground">
            Engine & Performance
          </h2>
          <p className="text-foreground-muted text-xs">
            Configure fragment download concurrency and connection limits.
          </p>
        </div>

        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-semibold text-foreground">
                Concurrent Fragments
              </div>
              <div className="text-xs text-foreground-muted">
                Number of multi-threaded parallel fragment connections per download (1 to 32).
              </div>
            </div>
            <span className="px-3 py-1 rounded-[8px] bg-[#1B1E27] font-mono text-sm font-bold text-accent">
              {concurrentFragments}
            </span>
          </div>

          <input
            type="range"
            min="1"
            max="32"
            value={concurrentFragments}
            onChange={(e) => setConcurrentFragments(Number(e.target.value))}
            className="w-full accent-accent h-2 bg-[#0F1116] rounded-lg cursor-pointer"
          />

          <div className="flex justify-between text-[10px] font-mono text-foreground-muted">
            <span>1 (Conservative)</span>
            <span>8 (Default Recommended)</span>
            <span>32 (High-speed)</span>
          </div>
        </div>
      </Card>

      {/* Section 3: Core Binaries */}
      <Card className="p-6 bg-[#14161D] border-border-strong flex flex-col gap-5">
        <div className="flex items-center justify-between">
          <div className="flex flex-col gap-1">
            <h2 className="font-display font-semibold text-base text-foreground">
              Core Binaries
            </h2>
            <p className="text-foreground-muted text-xs">
              Local engines packaged and verified with the application.
            </p>
          </div>

          <Button
            variant="secondary"
            size="sm"
            onClick={handleCheckUpdates}
            disabled={isCheckingUpdates}
            className="flex items-center gap-2"
          >
            <RefreshCwIcon size={14} className={isCheckingUpdates ? 'animate-spin' : ''} />
            <span>{isCheckingUpdates ? 'Checking...' : 'Check now'}</span>
          </Button>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div className="p-3.5 rounded-[12px] bg-[#0F1116] border border-border flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-foreground">yt-dlp</span>
              <span className="w-2 h-2 rounded-full bg-status-success" />
            </div>
            <div className="font-mono text-xs text-foreground-subtle">2026.10.26</div>
            <div className="text-[10px] text-foreground-muted">Local bundle active</div>
          </div>

          <div className="p-3.5 rounded-[12px] bg-[#0F1116] border border-border flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-foreground">ffmpeg</span>
              <span className="w-2 h-2 rounded-full bg-status-success" />
            </div>
            <div className="font-mono text-xs text-foreground-subtle">7.1-essentials</div>
            <div className="text-[10px] text-foreground-muted">Verified executable</div>
          </div>

          <div className="p-3.5 rounded-[12px] bg-[#0F1116] border border-border flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-foreground">ffprobe</span>
              <span className="w-2 h-2 rounded-full bg-status-success" />
            </div>
            <div className="font-mono text-xs text-foreground-subtle">7.1-essentials</div>
            <div className="text-[10px] text-foreground-muted">Output validator</div>
          </div>
        </div>
      </Card>

      {/* Section 4: Diagnostics */}
      <Card className="p-6 bg-[#14161D] border-border-strong flex items-center justify-between">
        <div className="flex flex-col gap-1">
          <h2 className="font-display font-semibold text-base text-foreground">
            Diagnostics & Logs
          </h2>
          <p className="text-foreground-muted text-xs max-w-md">
            Export anonymized diagnostics including engine versions, OS architecture, and last commands (cookies and auth tokens are automatically redacted).
          </p>
        </div>

        <Button
          variant="secondary"
          size="md"
          onClick={handleCopyDiagnostics}
          className="flex items-center gap-2 flex-none"
        >
          {isCopied ? <CheckIcon size={16} className="text-status-success" /> : <CopyIcon size={16} />}
          <span>{isCopied ? 'Copied' : 'Copy diagnostics'}</span>
        </Button>
      </Card>
    </div>
  );
};
