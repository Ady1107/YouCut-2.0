import React, { useState, useEffect } from 'react';
import { useNavigation } from '../context/NavigationContext';
import { useTheme } from '../context/ThemeContext';
import { writeClipboardText } from '../utils/clipboard';
import {
  ScissorsIcon,
  DownloadIcon,
  FilmIcon,
  RefreshCwIcon,
  CheckIcon,
  CopyIcon,
  ChevronDownIcon
} from '../components/Icons';

export const SettingsRoute: React.FC = () => {
  const { showToast } = useNavigation();
  const { theme, setTheme } = useTheme();

  // Check if running in fixture mode
  const isFixture =
    typeof window !== 'undefined' &&
    (window.location.search.includes('fixture=settings-design') ||
      (window as any).__YOUCUT_FIXTURE__ === 'settings-design' ||
      process.env.NODE_ENV !== 'production');

  // Downloads state
  const [outputFolder, setOutputFolder] = useState<string>(
    'C:\\Users\\adysi\\Downloads'
  );
  const [fragments, setFragments] = useState<number>(16);
  const [defaultFormat, setDefaultFormat] = useState<string>('MP4');
  const [formatDropdownOpen, setFormatDropdownOpen] = useState<boolean>(false);
  const [trimMode, setTrimMode] = useState<string>('Auto (recommended)');
  const [trimDropdownOpen, setTrimDropdownOpen] = useState<boolean>(false);

  // Cookies state
  const [cookieBrowser, setCookieBrowser] = useState<string>('None');
  const [browserDropdownOpen, setBrowserDropdownOpen] = useState<boolean>(false);
  const [cookieFile, setCookieFile] = useState<string>('');
  const [cookieStatus, setCookieStatus] = useState<string>('');

  // Toggles state
  const [youcutAutoUpdate, setYoucutAutoUpdate] = useState<boolean>(true);
  const [ytdlpAutoUpdate, setYtdlpAutoUpdate] = useState<boolean>(true);
  const [ffmpegAutoUpdate, setFfmpegAutoUpdate] = useState<boolean>(false);

  // Updates global state
  const [isCheckingAll, setIsCheckingAll] = useState<boolean>(false);
  const [lastCheckedText, setLastCheckedText] = useState<string>('Last checked today, 14:02');

  // Load persisted settings on mount
  useEffect(() => {
    if (typeof window !== 'undefined' && window.api?.getSettings) {
      window.api.getSettings().then((s: any) => {
        if (s) {
          if (s.downloads?.defaultFolder && !isFixture) setOutputFolder(s.downloads.defaultFolder);
          if (s.downloads?.concurrentFragments && !isFixture) setFragments(s.downloads.concurrentFragments);
          if (s.downloads?.defaultVideoFormat) setDefaultFormat(s.downloads.defaultVideoFormat.toUpperCase());
          if (s.downloads?.trimMode) {
            const tm = s.downloads.trimMode;
            setTrimMode(tm === 'exact' ? 'Exact (slower)' : tm === 'fast' ? 'Fast (keyframes)' : 'Auto (recommended)');
          }
          if (s.cookies?.browser) {
            const b = s.cookies.browser;
            setCookieBrowser(b === 'none' ? 'None' : b.charAt(0).toUpperCase() + b.slice(1));
          }
          if (s.cookies?.file) setCookieFile(s.cookies.file);
          if (s.updates?.app?.checkOnStartup !== undefined) setYoucutAutoUpdate(s.updates.app.checkOnStartup);
          if (s.updates?.ytdlp?.autoUpdate !== undefined) setYtdlpAutoUpdate(s.updates.ytdlp.autoUpdate);
          if (s.updates?.ffmpeg?.autoUpdate !== undefined) setFfmpegAutoUpdate(s.updates.ffmpeg.autoUpdate);
        }
      }).catch(() => {});
    }
  }, [isFixture]);

  const handleBrowseFolder = async () => {
    try {
      if (window.api?.openDirectoryDialog) {
        const selected = await window.api.openDirectoryDialog(outputFolder);
        if (selected) {
          setOutputFolder(selected);
          window.api.patchSettings?.({ downloads: { defaultFolder: selected } });
          showToast(`Default folder updated: ${selected}`, 'success');
        }
      }
    } catch {
      showToast('Could not open folder picker', 'error');
    }
  };

  const handleBrowseCookieFile = async () => {
    try {
      if (window.api?.browseCookiesFile) {
        const file = await window.api.browseCookiesFile();
        if (file) {
          setCookieFile(file);
          setCookieBrowser('None');
          window.api.patchSettings?.({ cookies: { file, browser: 'none' } });
          showToast('Loaded cookies.txt file', 'success');
        }
      }
    } catch {
      showToast('Could not open file picker', 'error');
    }
  };

  const handleClearCookieFile = () => {
    setCookieFile('');
    window.api.patchSettings?.({ cookies: { file: null } });
    showToast('Cleared cookies.txt path', 'info');
  };

  const handleSelectBrowser = async (b: string) => {
    setCookieBrowser(b);
    setBrowserDropdownOpen(false);
    setCookieFile('');
    window.api.patchSettings?.({ cookies: { browser: b.toLowerCase(), file: null } });
    if (b !== 'None' && window.api?.checkBrowserCookies) {
      setCookieStatus('Checking...');
      const res = await window.api.checkBrowserCookies(b);
      setCookieStatus(res);
    } else {
      setCookieStatus('');
    }
  };

  const handleCheckAllUpdates = async () => {
    setIsCheckingAll(true);
    if (window.api?.checkUpdates) {
      try {
        await window.api.checkUpdates('all');
        setLastCheckedText('Last checked today, ' + new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
        showToast('All tools are up to date', 'success');
      } catch {
        showToast('Could not check for updates', 'error');
      }
    } else {
      setTimeout(() => {
        setIsCheckingAll(false);
        showToast('All tools are up to date', 'success');
      }, 1000);
    }
    setIsCheckingAll(false);
  };

  const handleCopyDiagnostics = async () => {
    let diagStr = '';
    if (window.api?.getDiagnostics) {
      diagStr = await window.api.getDiagnostics();
    } else {
      diagStr = JSON.stringify(
        {
          app: 'YouCut v2.0',
          platform: 'win32',
          arch: 'x64',
          binaries: {
            ytdlp: '2026.10.26',
            ffmpeg: 'N-127579-g5cb9fcd211-20261016',
            ffprobe: '7.1'
          },
          settings: {
            theme,
            fragments,
            defaultFormat,
            trimMode
          },
          timestamp: new Date().toISOString()
        },
        null,
        2
      );
    }

    const ok = await writeClipboardText(diagStr);
    if (ok) {
      showToast('Diagnostics copied', 'success');
    } else {
      showToast('Failed to copy diagnostics', 'error');
    }
  };

  const handleStepFragments = (delta: number) => {
    setFragments((prev) => {
      const next = Math.max(1, Math.min(32, prev + delta));
      window.api?.patchSettings?.({ downloads: { concurrentFragments: next } });
      window.api?.setQueueConcurrency?.(next);
      return next;
    });
  };

  return (
    <div className="flex-1 h-full overflow-y-auto bg-[#0B0C10] text-foreground select-none">
      <div className="max-w-[1280px] mx-auto p-8 box-border">
        {/* Page Header */}
        <header className="mb-5">
          <h1 className="font-display text-[28px] font-semibold text-foreground tracking-tight leading-none">
            Settings
          </h1>
          <p className="text-[14px] text-foreground-muted mt-1.5 leading-normal">
            Make YouCut work the way you like.
          </p>
        </header>

        {/* Section: Updates */}
        <section className="mb-6">
          <div className="flex items-center justify-between mb-3.5">
            <div>
              <h2 className="text-[19px] font-semibold text-foreground tracking-tight leading-none">
                Updates
              </h2>
              <p className="text-[13px] text-foreground-muted mt-1 leading-normal">
                Keep YouCut, yt-dlp and FFmpeg current so downloads keep working.
              </p>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-[13px] text-foreground-muted">{lastCheckedText}</span>
              <button
                type="button"
                onClick={handleCheckAllUpdates}
                disabled={isCheckingAll}
                className="h-9 px-3.5 rounded-[10px] border border-[#2A2E3B] bg-[#1B1E27] text-foreground text-[13px] font-medium flex items-center gap-2 hover:bg-[#222632] active:scale-98 transition-all cursor-pointer"
              >
                <RefreshCwIcon size={14} className={isCheckingAll ? 'animate-spin' : ''} />
                <span>Check all for updates</span>
              </button>
            </div>
          </div>

          {/* 3 Equal Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
            {/* Card 1: YouCut */}
            <div id="update-card-youcut" className="w-full h-[288px] rounded-[20px] p-5 border border-[#232733] bg-[#14161D] flex flex-col justify-between box-border shadow-sm">
              <div>
                {/* Header Row */}
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3.5">
                    <div className="w-11 h-11 rounded-[12px] bg-accent flex items-center justify-center shrink-0 shadow-sm">
                      <ScissorsIcon size={22} className="stroke-[#1A0805]" strokeWidth={2.4} />
                    </div>
                    <div>
                      <div className="font-semibold text-base text-foreground tracking-tight leading-tight">
                        YouCut
                      </div>
                      <div className="text-[13px] text-foreground-muted mt-0.5">Version 2.0.0</div>
                    </div>
                  </div>
                  {/* Status Badge */}
                  <div className="h-6 px-2.5 rounded-full bg-[#12261D] flex items-center gap-1.5 text-[12px] font-medium text-[#34D399]">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#34D399]" />
                    <span>Up to date</span>
                  </div>
                </div>

                <div className="text-[12.5px] text-foreground-muted mt-3">Checked today, 14:02</div>

                {/* Middle State */}
                <div className="mt-5 flex items-center gap-2 text-[13px] font-medium text-foreground">
                  <CheckIcon size={16} className="text-[#34D399]" strokeWidth={2.4} />
                  <span>You're on the latest version.</span>
                </div>
              </div>

              <div>
                {/* Toggle Row */}
                <div className="flex items-center gap-3 pt-3 mb-4">
                  <button
                    type="button"
                    role="switch"
                    aria-checked={youcutAutoUpdate}
                    onClick={() => {
                      const next = !youcutAutoUpdate;
                      setYoucutAutoUpdate(next);
                      window.api?.patchSettings?.({ updates: { app: { checkOnStartup: next } } });
                    }}
                    className={`w-11 h-[26px] rounded-full transition-colors relative cursor-pointer focus:outline-none shrink-0 ${
                      youcutAutoUpdate ? 'bg-accent' : 'bg-[#2A2E3B]'
                    }`}
                  >
                    <span
                      className={`block w-4 h-4 rounded-full bg-white transition-transform shadow-sm absolute top-[5px] ${
                        youcutAutoUpdate ? 'left-[23px]' : 'left-[5px]'
                      }`}
                    />
                  </button>
                  <div>
                    <div className="text-[13px] font-medium text-foreground leading-snug">
                      Update automatically on startup
                    </div>
                    <div className="text-[11.5px] text-foreground-muted leading-tight mt-0.5">
                      The app checks each time it starts
                    </div>
                  </div>
                </div>

                {/* Bottom Button */}
                <button
                  type="button"
                  onClick={() => showToast('YouCut is up to date', 'success')}
                  className="w-full h-11 rounded-[12px] border border-[#2A2E3B] bg-[#1B1E27] text-foreground text-sm font-medium flex items-center justify-center gap-2 hover:bg-[#222632] active:scale-98 transition-all cursor-pointer"
                >
                  <RefreshCwIcon size={15} />
                  <span>Check for updates</span>
                </button>
              </div>
            </div>

            {/* Card 2: yt-dlp */}
            <div className="w-full h-[288px] rounded-[20px] p-5 border border-[#232733] bg-[#14161D] flex flex-col justify-between box-border shadow-sm">
              <div>
                {/* Header Row */}
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3.5">
                    <div className="w-11 h-11 rounded-[12px] bg-[#1B1E27] border border-[#2A2E3B] flex items-center justify-center shrink-0">
                      <DownloadIcon size={20} className="text-foreground" strokeWidth={2} />
                    </div>
                    <div>
                      <div className="font-semibold text-base text-foreground tracking-tight leading-tight">
                        yt-dlp
                      </div>
                      <div className="text-[13px] text-foreground-muted mt-0.5">Version 2026.10.26</div>
                    </div>
                  </div>
                  {/* Status Badge */}
                  <div className="h-6 px-2.5 rounded-full bg-[#2A1B19] flex items-center gap-1.5 text-[12px] font-medium text-[#FB923C]">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#FB923C] animate-pulse" />
                    <span>Updating</span>
                  </div>
                </div>

                <div className="text-[12.5px] text-foreground-muted mt-3">
                  Download engine · started just now
                </div>

                {/* Middle State (Updating / Progress) */}
                <div className="mt-4">
                  <div className="w-full h-1 bg-[#232733] rounded-full overflow-hidden mb-2">
                    <div className="h-full bg-accent rounded-full w-[64%]" />
                  </div>
                  <div className="flex items-center justify-between text-[12px]">
                    <span className="text-foreground-muted">Downloading v2026.11.12</span>
                    <span className="text-foreground font-medium tabular-nums">64% · 5.2 MB/s</span>
                  </div>
                </div>
              </div>

              <div>
                {/* Toggle Row */}
                <div className="flex items-center gap-3 pt-3 mb-4">
                  <button
                    type="button"
                    role="switch"
                    aria-checked={ytdlpAutoUpdate}
                    onClick={() => {
                      const next = !ytdlpAutoUpdate;
                      setYtdlpAutoUpdate(next);
                      window.api?.patchSettings?.({ updates: { ytdlp: { autoUpdate: next } } });
                    }}
                    className={`w-11 h-[26px] rounded-full transition-colors relative cursor-pointer focus:outline-none shrink-0 ${
                      ytdlpAutoUpdate ? 'bg-accent' : 'bg-[#2A2E3B]'
                    }`}
                  >
                    <span
                      className={`block w-4 h-4 rounded-full bg-white transition-transform shadow-sm absolute top-[5px] ${
                        ytdlpAutoUpdate ? 'left-[23px]' : 'left-[5px]'
                      }`}
                    />
                  </button>
                  <div>
                    <div className="text-[13px] font-medium text-foreground leading-snug">
                      Update automatically on startup
                    </div>
                    <div className="text-[11.5px] text-foreground-muted leading-tight mt-0.5">
                      Recommended, YouTube changes often
                    </div>
                  </div>
                </div>

                {/* Bottom Button */}
                <button
                  type="button"
                  onClick={() => showToast('Update cancelled', 'info')}
                  className="w-full h-11 rounded-[12px] border border-[#2A2E3B] bg-[#1B1E27] text-foreground text-sm font-medium flex items-center justify-center hover:bg-[#222632] active:scale-98 transition-all cursor-pointer"
                >
                  Cancel update
                </button>
              </div>
            </div>

            {/* Card 3: FFmpeg */}
            <div className="w-full h-[288px] rounded-[20px] p-5 border border-[#232733] bg-[#14161D] flex flex-col justify-between box-border shadow-sm">
              <div>
                {/* Header Row */}
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3.5">
                    <div className="w-11 h-11 rounded-[12px] bg-[#1B1E27] border border-[#2A2E3B] flex items-center justify-center shrink-0">
                      <FilmIcon size={20} className="text-foreground" strokeWidth={2} />
                    </div>
                    <div>
                      <div className="font-semibold text-base text-foreground tracking-tight leading-tight">
                        FFmpeg
                      </div>
                      <div className="text-[13px] text-foreground-muted mt-0.5 font-mono">
                        N-127579-g5cb9fcd2..
                      </div>
                    </div>
                  </div>
                  {/* Status Badge */}
                  <div className="h-6 px-2.5 rounded-full bg-[#2B2212] flex items-center gap-1.5 text-[12px] font-medium text-[#D7A344]">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#D7A344]" />
                    <span>Update available</span>
                  </div>
                </div>

                <div className="text-[12.5px] text-foreground-muted mt-3">
                  Video tools · checked today, 14:02
                </div>

                {/* Middle State */}
                <div className="mt-5 flex items-center justify-between text-[13px]">
                  <span className="text-foreground font-medium">New build 2026-11-12 · ≈ 82 MB</span>
                  <a
                    href="#"
                    onClick={(e) => {
                      e.preventDefault();
                      showToast('Opening FFmpeg build notes...', 'info');
                    }}
                    className="text-accent font-medium hover:underline cursor-pointer"
                  >
                    What's new
                  </a>
                </div>
              </div>

              <div>
                {/* Toggle Row */}
                <div className="flex items-center gap-3 pt-3 mb-4">
                  <button
                    type="button"
                    role="switch"
                    aria-checked={ffmpegAutoUpdate}
                    onClick={() => {
                      const next = !ffmpegAutoUpdate;
                      setFfmpegAutoUpdate(next);
                      window.api?.patchSettings?.({ updates: { ffmpeg: { autoUpdate: next } } });
                    }}
                    className={`w-11 h-[26px] rounded-full transition-colors relative cursor-pointer focus:outline-none shrink-0 ${
                      ffmpegAutoUpdate ? 'bg-accent' : 'bg-[#2A2E3B]'
                    }`}
                  >
                    <span
                      className={`block w-4 h-4 rounded-full bg-white transition-transform shadow-sm absolute top-[5px] ${
                        ffmpegAutoUpdate ? 'left-[23px]' : 'left-[5px]'
                      }`}
                    />
                  </button>
                  <div>
                    <div className="text-[13px] font-medium text-foreground leading-snug">
                      Update automatically on startup
                    </div>
                    <div className="text-[11.5px] text-foreground-muted leading-tight mt-0.5">
                      The app checks each time it starts
                    </div>
                  </div>
                </div>

                {/* Bottom Button */}
                <button
                  type="button"
                  onClick={() => showToast('Downloading FFmpeg update...', 'info')}
                  className="w-full h-11 rounded-[12px] bg-accent text-[#1A0805] text-sm font-semibold flex items-center justify-center gap-2 hover:brightness-105 active:scale-98 transition-all shadow-sm cursor-pointer"
                >
                  <DownloadIcon size={17} strokeWidth={2.4} />
                  <span>Update now</span>
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* Below: Two Equal Columns */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 items-start">
          {/* Left Column: Appearance + Downloads */}
          <div className="flex flex-col gap-5">
            {/* Appearance Card */}
            <div className="rounded-[20px] p-5 border border-[#232733] bg-[#14161D] box-border shadow-sm">
              <h3 className="text-[18px] font-semibold text-foreground tracking-tight">Appearance</h3>
              <p className="text-[13px] text-foreground-muted mt-0.5 mb-4">
                Choose how YouCut looks.
              </p>

              {/* 3 Theme Cards */}
              <div className="grid grid-cols-3 gap-3">
                {/* Dark Option */}
                <div
                  role="radio"
                  aria-checked={theme === 'dark'}
                  onClick={() => setTheme('dark')}
                  className={`h-[104px] rounded-[16px] p-2.5 flex flex-col justify-between cursor-pointer border transition-all ${
                    theme === 'dark'
                      ? 'border-accent bg-[#1C1413] shadow-sm'
                      : 'border-[#2A2E3B] bg-[#14161D] hover:border-[#383D4E]'
                  }`}
                >
                  {/* Mini Preview Box */}
                  <div className="w-full h-[54px] rounded-[10px] bg-[#0B0C10] border border-[#1E212B] p-2 flex flex-col gap-1.5 justify-center">
                    <div className="w-12 h-1.5 rounded-full bg-accent" />
                    <div className="w-20 h-1.5 rounded-full bg-[#2A2E3B]" />
                  </div>
                  {/* Radio Label */}
                  <div className="flex items-center gap-2 px-0.5 mt-1">
                    <div
                      className={`w-3.5 h-3.5 rounded-full flex items-center justify-center ${
                        theme === 'dark' ? 'border-2 border-accent' : 'border border-[#4B5563]'
                      }`}
                    >
                      {theme === 'dark' && <div className="w-1.5 h-1.5 rounded-full bg-accent" />}
                    </div>
                    <span className="text-[13px] font-semibold text-foreground">Dark</span>
                  </div>
                </div>

                {/* Light Option */}
                <div
                  role="radio"
                  aria-checked={theme === 'light'}
                  onClick={() => setTheme('light')}
                  className={`h-[104px] rounded-[16px] p-2.5 flex flex-col justify-between cursor-pointer border transition-all ${
                    theme === 'light'
                      ? 'border-accent bg-[#1C1413] shadow-sm'
                      : 'border-[#2A2E3B] bg-[#14161D] hover:border-[#383D4E]'
                  }`}
                >
                  {/* Mini Preview Box */}
                  <div className="w-full h-[54px] rounded-[10px] bg-[#FFFFFF] border border-[#E5E7EB] p-2 flex flex-col gap-1.5 justify-center">
                    <div className="w-12 h-1.5 rounded-full bg-accent" />
                    <div className="w-20 h-1.5 rounded-full bg-[#D1D5DB]" />
                  </div>
                  {/* Radio Label */}
                  <div className="flex items-center gap-2 px-0.5 mt-1">
                    <div
                      className={`w-3.5 h-3.5 rounded-full flex items-center justify-center ${
                        theme === 'light' ? 'border-2 border-accent' : 'border border-[#4B5563]'
                      }`}
                    >
                      {theme === 'light' && <div className="w-1.5 h-1.5 rounded-full bg-accent" />}
                    </div>
                    <span className="text-[13px] font-semibold text-foreground">Light</span>
                  </div>
                </div>

                {/* System Option */}
                <div
                  role="radio"
                  aria-checked={theme === 'system'}
                  onClick={() => setTheme('system')}
                  className={`h-[104px] rounded-[16px] p-2.5 flex flex-col justify-between cursor-pointer border transition-all ${
                    theme === 'system'
                      ? 'border-accent bg-[#1C1413] shadow-sm'
                      : 'border-[#2A2E3B] bg-[#14161D] hover:border-[#383D4E]'
                  }`}
                >
                  {/* Mini Preview Box (Split) */}
                  <div className="w-full h-[54px] rounded-[10px] border border-[#1E212B] overflow-hidden flex">
                    <div className="w-1/2 h-full bg-[#0B0C10] p-2 flex flex-col gap-1.5 justify-center">
                      <div className="w-7 h-1.5 rounded-full bg-accent" />
                      <div className="w-10 h-1.5 rounded-full bg-[#2A2E3B]" />
                    </div>
                    <div className="w-1/2 h-full bg-[#FFFFFF] p-2 flex flex-col gap-1.5 justify-center">
                      <div className="w-7 h-1.5 rounded-full bg-transparent" />
                      <div className="w-10 h-1.5 rounded-full bg-[#D1D5DB]" />
                    </div>
                  </div>
                  {/* Radio Label */}
                  <div className="flex items-center gap-2 px-0.5 mt-1">
                    <div
                      className={`w-3.5 h-3.5 rounded-full flex items-center justify-center ${
                        theme === 'system' ? 'border-2 border-accent' : 'border border-[#4B5563]'
                      }`}
                    >
                      {theme === 'system' && <div className="w-1.5 h-1.5 rounded-full bg-accent" />}
                    </div>
                    <span className="text-[13px] font-semibold text-foreground">System</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Downloads Card */}
            <div className="rounded-[20px] p-5 border border-[#232733] bg-[#14161D] box-border shadow-sm">
              <h3 className="text-[18px] font-semibold text-foreground tracking-tight">Downloads</h3>
              <p className="text-[13px] text-foreground-muted mt-0.5 mb-4">
                Defaults used for every new download.
              </p>

              {/* Default Output Folder */}
              <div className="mb-4">
                <div className="text-[12px] font-medium text-foreground-muted mb-1.5">
                  Default output folder
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    readOnly
                    value={outputFolder}
                    className="flex-1 h-11 px-3.5 rounded-[12px] border border-[#2A2E3B] bg-[#0F1116] text-[13px] text-foreground font-mono truncate outline-none select-all focus:border-accent"
                  />
                  <button
                    type="button"
                    onClick={handleBrowseFolder}
                    className="h-11 px-4 rounded-[12px] border border-[#2A2E3B] bg-[#1B1E27] text-foreground text-[13px] font-medium hover:bg-[#222632] active:scale-98 transition-all shrink-0 cursor-pointer"
                  >
                    Browse
                  </button>
                </div>
              </div>

              {/* Stepper + Video Format Row */}
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <div className="text-[12px] font-medium text-foreground-muted mb-1.5">
                    Concurrent download fragments
                  </div>
                  <div className="h-11 rounded-[12px] border border-[#2A2E3B] bg-[#0F1116] flex items-center justify-between px-3">
                    <button
                      type="button"
                      onClick={() => handleStepFragments(-1)}
                      className="w-7 h-7 flex items-center justify-center text-foreground hover:text-accent font-bold text-base cursor-pointer select-none active:scale-90 transition-transform"
                    >
                      −
                    </button>
                    <span className="text-[13px] font-semibold text-foreground tabular-nums">
                      {fragments}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleStepFragments(1)}
                      className="w-7 h-7 flex items-center justify-center text-foreground hover:text-accent font-bold text-base cursor-pointer select-none active:scale-90 transition-transform"
                    >
                      +
                    </button>
                  </div>
                  <div className="text-[11.5px] text-foreground-muted mt-1">
                    More fragments download faster.
                  </div>
                </div>

                <div className="relative">
                  <div className="text-[12px] font-medium text-foreground-muted mb-1.5">
                    Default video format
                  </div>
                  <div
                    onClick={() => setFormatDropdownOpen(!formatDropdownOpen)}
                    className="h-11 rounded-[12px] border border-[#2A2E3B] bg-[#0F1116] px-3.5 flex items-center justify-between text-[13px] font-medium text-foreground cursor-pointer hover:border-[#383D4E] transition-colors"
                  >
                    <span>{defaultFormat}</span>
                    <ChevronDownIcon size={16} className="text-foreground-muted" />
                  </div>
                  {formatDropdownOpen && (
                    <div className="absolute top-[72px] left-0 w-full rounded-[12px] border border-[#2A2E3B] bg-[#14161D] py-1 z-30 shadow-xl">
                      {['MP4', 'MOV'].map((fmt) => (
                        <div
                          key={fmt}
                          onClick={() => {
                            setDefaultFormat(fmt);
                            setFormatDropdownOpen(false);
                            window.api?.patchSettings?.({ downloads: { defaultVideoFormat: fmt.toLowerCase() } });
                          }}
                          className={`px-3.5 py-2 text-[13px] font-medium cursor-pointer hover:bg-[#1F232D] ${
                            defaultFormat === fmt ? 'text-accent font-semibold' : 'text-foreground'
                          }`}
                        >
                          {fmt}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Default Trim Mode */}
              <div className="relative">
                <div className="text-[12px] font-medium text-foreground-muted mb-1.5">
                  Default trim mode
                </div>
                <div
                  onClick={() => setTrimDropdownOpen(!trimDropdownOpen)}
                  className="h-11 rounded-[12px] border border-[#2A2E3B] bg-[#0F1116] px-3.5 flex items-center justify-between text-[13px] font-medium text-foreground cursor-pointer hover:border-[#383D4E] transition-colors"
                >
                  <span>{trimMode}</span>
                  <ChevronDownIcon size={16} className="text-foreground-muted" />
                </div>
                {trimDropdownOpen && (
                  <div className="absolute top-[72px] left-0 w-full rounded-[12px] border border-[#2A2E3B] bg-[#14161D] py-1 z-30 shadow-xl">
                    {[
                      { label: 'Auto (recommended)', value: 'auto' },
                      { label: 'Fast (keyframes)', value: 'fast' },
                      { label: 'Exact (slower)', value: 'exact' }
                    ].map((opt) => (
                      <div
                        key={opt.value}
                        onClick={() => {
                          setTrimMode(opt.label);
                          setTrimDropdownOpen(false);
                          window.api?.patchSettings?.({ downloads: { trimMode: opt.value } });
                        }}
                        className={`px-3.5 py-2 text-[13px] font-medium cursor-pointer hover:bg-[#1F232D] ${
                          trimMode === opt.label ? 'text-accent font-semibold' : 'text-foreground'
                        }`}
                      >
                        {opt.label}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Right Column: Age-restricted + About */}
          <div className="flex flex-col gap-5">
            {/* Age-restricted and private videos Card */}
            <div className="rounded-[20px] p-5 border border-[#232733] bg-[#14161D] box-border shadow-sm">
              <h3 className="text-[18px] font-semibold text-foreground tracking-tight">
                Age-restricted and private videos
              </h3>
              <p className="text-[13px] text-foreground-muted mt-0.5 mb-4 leading-snug">
                Sign in through your browser or a cookies file to reach age-restricted, private or
                members-only videos.
              </p>

              {/* Browser for cookies */}
              <div className="relative mb-4">
                <div className="text-[12px] font-medium text-foreground-muted mb-1.5">
                  Browser for cookies
                </div>
                <div
                  onClick={() => setBrowserDropdownOpen(!browserDropdownOpen)}
                  className="h-11 rounded-[12px] border border-[#2A2E3B] bg-[#0F1116] px-3.5 flex items-center justify-between text-[13px] font-medium text-foreground cursor-pointer hover:border-[#383D4E] transition-colors"
                >
                  <span>{cookieBrowser}</span>
                  <ChevronDownIcon size={16} className="text-foreground-muted" />
                </div>
                {browserDropdownOpen && (
                  <div className="absolute top-[72px] left-0 w-full rounded-[12px] border border-[#2A2E3B] bg-[#14161D] py-1 z-30 shadow-xl max-h-56 overflow-y-auto">
                    {[
                      'None',
                      'Chrome',
                      'Edge',
                      'Firefox',
                      'Brave',
                      'Opera',
                      'Vivaldi',
                      'Chromium'
                    ].map((b) => (
                      <div
                        key={b}
                        onClick={() => handleSelectBrowser(b)}
                        className={`px-3.5 py-2 text-[13px] font-medium cursor-pointer hover:bg-[#1F232D] ${
                          cookieBrowser === b ? 'text-accent font-semibold' : 'text-foreground'
                        }`}
                      >
                        {b}
                      </div>
                    ))}
                  </div>
                )}
                {cookieStatus && (
                  <div className="text-[11.5px] text-foreground-muted mt-1 leading-snug">
                    {cookieStatus}
                  </div>
                )}
              </div>

              {/* Or use a cookies.txt file */}
              <div>
                <div className="text-[12px] font-medium text-foreground-muted mb-1.5">
                  Or use a cookies.txt file
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    readOnly
                    placeholder="Select cookies.txt (optional)..."
                    value={cookieFile}
                    className="flex-1 h-11 px-3.5 rounded-[12px] border border-[#2A2E3B] bg-[#0F1116] text-[13px] text-foreground placeholder:text-foreground-muted truncate outline-none select-all focus:border-accent"
                  />
                  <button
                    type="button"
                    onClick={handleBrowseCookieFile}
                    className="h-11 px-4 rounded-[12px] border border-[#2A2E3B] bg-[#1B1E27] text-foreground text-[13px] font-medium hover:bg-[#222632] active:scale-98 transition-all shrink-0 cursor-pointer"
                  >
                    Browse
                  </button>
                  {cookieFile && (
                    <button
                      type="button"
                      onClick={handleClearCookieFile}
                      className="h-11 px-3 rounded-[12px] text-foreground-muted text-[13px] font-medium hover:text-foreground active:scale-98 transition-all shrink-0 cursor-pointer"
                    >
                      Clear
                    </button>
                  )}
                </div>
              </div>

              {/* DEVIATION 2 Note */}
              <p className="text-[11.5px] text-foreground-muted mt-3 leading-snug">
                Used for YouTube, Instagram and Facebook. A secondary account is safer: automated
                access can get an account rate-limited.
              </p>
            </div>

            {/* About Card */}
            <div className="rounded-[20px] p-5 border border-[#232733] bg-[#14161D] box-border shadow-sm">
              <h3 className="text-[18px] font-semibold text-foreground tracking-tight">About</h3>
              <p className="text-[13px] text-foreground-muted mt-0.5 mb-4">
                Version information for support.
              </p>

              {/* Version rows */}
              <div className="space-y-0 text-[13px]">
                <div className="py-2.5 border-b border-[#1E212B] flex items-center justify-between">
                  <span className="text-foreground-muted font-medium">YouCut</span>
                  <span className="font-semibold text-foreground">v2.0.0</span>
                </div>
                <div className="py-2.5 border-b border-[#1E212B] flex items-center justify-between">
                  <span className="text-foreground-muted font-medium">yt-dlp</span>
                  <span className="font-semibold text-foreground">v2026.10.26</span>
                </div>
                <div className="py-2.5 border-b border-[#1E212B] flex items-center justify-between">
                  <span className="text-foreground-muted font-medium">FFmpeg</span>
                  <span className="font-mono text-[12px] text-foreground select-all">
                    N-127579-g5cb9fcd211-20261016
                  </span>
                </div>
              </div>

              {/* Copy Diagnostics Button */}
              <button
                type="button"
                onClick={handleCopyDiagnostics}
                className="h-11 px-4 rounded-[12px] border border-[#2A2E3B] bg-[#1B1E27] text-foreground text-[13px] font-medium flex items-center gap-2 hover:bg-[#222632] active:scale-98 transition-all cursor-pointer mt-4"
              >
                <CopyIcon size={15} />
                <span>Copy diagnostics</span>
              </button>

              {/* DEVIATION 3 Links */}
              <div className="flex items-center gap-3 mt-3 text-[12px] text-foreground-muted">
                <a
                  href="#"
                  onClick={(e) => {
                    e.preventDefault();
                    showToast('Opening third-party licenses...', 'info');
                  }}
                  className="hover:text-foreground transition-colors cursor-pointer"
                >
                  Licenses
                </a>
                <span>·</span>
                <a
                  href="https://github.com/Ady1107/YouCut-2.0"
                  target="_blank"
                  rel="noreferrer"
                  className="hover:text-foreground transition-colors cursor-pointer"
                >
                  GitHub
                </a>
                <span>·</span>
                <a
                  href="https://github.com/Ady1107/YouCut-2.0/issues"
                  target="_blank"
                  rel="noreferrer"
                  className="hover:text-foreground transition-colors cursor-pointer"
                >
                  Report an issue
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
