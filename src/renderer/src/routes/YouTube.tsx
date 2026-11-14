import React, { useState, useEffect } from 'react';
import { useNavigation } from '../context/NavigationContext';
import { UrlBar } from '../components/UrlBar';
import { Card } from '../components/Card';
import { Button } from '../components/Button';
import { Chip } from '../components/Chip';
import { SegmentedToggle } from '../components/SegmentedToggle';
import { Field } from '../components/Field';
import { FullVideoCheckbox } from '../components/Badge';
import { ChaptersPopover, Chapter } from '../components/ChaptersPopover';
import { WrongPlatformBanner, PlaylistNoticeBanner } from '../components/WrongPlatformBanner';
import { secondsToHms, secondsToMs, hmsToSeconds, formatHumanDuration } from '../utils/time';
import { sanitizeFilename } from '../utils/filename';
import {
  PlayIcon,
  PauseIcon,
  Rewind5Icon,
  Forward5Icon,
  VolumeIcon,
  FullscreenIcon,
  FilmIcon,
  FolderIcon,
  ChevronDownIcon,
  DownloadIcon,
  QueueIcon,
  RefreshCwIcon
} from '../components/Icons';

export interface FetchedVideo {
  id: string;
  title: string;
  duration: number;
  durationFormatted: string;
  uploader: string;
  thumbnail: string;
  webpageUrl: string;
  isVertical?: boolean;
  isPlaylist?: boolean;
  availableResolutions?: string[];
  chapters?: Chapter[];
}

export const YouTubeRoute: React.FC = () => {
  const { params, navigate, setStatus, showToast } = useNavigation();

  // Mode and format states
  const [mediaType, setMediaType] = useState<'video' | 'audio'>('video');
  const [selectedFormat, setSelectedFormat] = useState<string>('MP4');
  const [selectedResolution, setSelectedResolution] = useState<string>('Best available');
  const [isFullVideo, setIsFullVideo] = useState(false);
  const [frameAccurate, setFrameAccurate] = useState(false);
  const [startTime, setStartTime] = useState('00:00:00');
  const [endTime, setEndTime] = useState('00:00:00');
  const [fileName, setFileName] = useState('');
  const [saveFolder, setSaveFolder] = useState('C:\\Users\\User\\Downloads\\YouCut\\YouTube');

  // Video data & fetch states
  const [currentUrl, setCurrentUrl] = useState(params.url || '');
  const [videoInfo, setVideoInfo] = useState<FetchedVideo | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);

  // Platform detection banners
  const [wrongPlatform, setWrongPlatform] = useState<'Instagram' | 'Facebook' | null>(null);
  const [showPlaylistNotice, setShowPlaylistNotice] = useState(false);

  // Dropdown states
  const [isQualityDropdownOpen, setIsQualityDropdownOpen] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);

  const isVideoLoaded = Boolean(videoInfo);
  const totalDuration = videoInfo ? videoInfo.duration : 0;
  const startSec = hmsToSeconds(startTime);
  const endSec = hmsToSeconds(endTime) || totalDuration;
  const clipDuration = Math.max(0, endSec - startSec);

  // Active cut mode per Lesson 4: Exact when <= 10m (600s) or frameAccurate is true
  const isCutExact = frameAccurate || (totalDuration > 0 && totalDuration <= 600);
  const cutModeText = isCutExact
    ? (frameAccurate ? 'Cut: Exact (Forced)' : 'Cut: Exact (Auto ≤10m)')
    : 'Cut: Fast (keyframes)';

  // Calculate estimated file size
  const estimateFileSizeMb = (): number => {
    if (!videoInfo || totalDuration === 0) return 0;
    const dur = isFullVideo ? totalDuration : clipDuration;
    if (mediaType === 'audio') {
      // Audio ~ 2.5 MB per minute
      return Math.round((dur / 60) * 2.5 * 10) / 10;
    }
    // Video ~ 18 MB per minute for 1080p
    return Math.round((dur / 60) * 18 * 10) / 10;
  };

  const handleMediaTypeChange = (type: 'video' | 'audio') => {
    setMediaType(type);
    if (type === 'video') {
      setSelectedFormat('MP4');
      setSelectedResolution('Best available · 1080p');
    } else {
      setSelectedFormat('MP3');
      setSelectedResolution('320 kbps (High)');
    }
  };

  const handleUrlChange = (url: string) => {
    setCurrentUrl(url);
    const trimmed = url.trim();

    // Check wrong platform
    if (trimmed.includes('instagram.com')) {
      setWrongPlatform('Instagram');
    } else if (trimmed.includes('facebook.com') || trimmed.includes('fb.watch')) {
      setWrongPlatform('Facebook');
    } else {
      setWrongPlatform(null);
    }

    // Check playlist
    if (trimmed.includes('list=') || trimmed.includes('playlist?')) {
      setShowPlaylistNotice(true);
    } else {
      setShowPlaylistNotice(false);
    }
  };

  const handleFetchInfo = async (urlToFetch?: string) => {
    const targetUrl = (urlToFetch || currentUrl).trim();
    if (!targetUrl) {
      showToast('Please enter a YouTube video URL', 'info');
      return;
    }

    handleUrlChange(targetUrl);
    setIsLoading(true);
    setFetchError(null);
    setStatus({ state: 'fetching', text: 'Fetching info' });

    try {
      if (window.api && typeof window.api.fetchVideoInfo === 'function') {
        const data = await window.api.fetchVideoInfo(targetUrl);
        setVideoInfo(data);
        setFileName(sanitizeFilename(data.title, 50));
        setStartTime('00:00:00');
        setEndTime(secondsToHms(data.duration));
        setSelectedResolution(
          data.availableResolutions && data.availableResolutions.length > 0
            ? `Best available · ${data.availableResolutions[0]}`
            : 'Best available · 1080p'
        );

        if (data.isPlaylist) {
          setShowPlaylistNotice(true);
        }

        setStatus({ state: 'ready', text: 'Ready to clip' });
        showToast(`Loaded: ${data.title}`, 'success');
      } else {
        showToast('Native video fetcher is not available. Please restart the app.', 'error');
      }
    } catch (err: any) {
      console.error('[YouTube] Fetch error:', err);
      setFetchError(err.message || 'Failed to fetch video information');
      setStatus({ state: 'ready', text: 'Ready to clip' });
      showToast(err.message || 'Failed to fetch video details', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  // Preset buttons handler
  const handleApplyPreset = (presetName: string) => {
    if (!videoInfo || totalDuration === 0) return;

    if (presetName === 'First 30s') {
      setStartTime('00:00:00');
      setEndTime(secondsToHms(Math.min(30, totalDuration)));
    } else if (presetName === 'First 60s') {
      setStartTime('00:00:00');
      setEndTime(secondsToHms(Math.min(60, totalDuration)));
    } else if (presetName === 'Middle 50%') {
      setStartTime(secondsToHms(totalDuration * 0.25));
      setEndTime(secondsToHms(totalDuration * 0.75));
    } else if (presetName === 'Last 30s') {
      setStartTime(secondsToHms(Math.max(0, totalDuration - 30)));
      setEndTime(secondsToHms(totalDuration));
    } else if (presetName === 'Reset') {
      setStartTime('00:00:00');
      setEndTime(secondsToHms(totalDuration));
    }
  };

  // Adjust time by +/- 1 second
  const handleAdjustTime = (target: 'start' | 'end', delta: number) => {
    if (target === 'start') {
      const cur = hmsToSeconds(startTime);
      const next = Math.max(0, Math.min(cur + delta, totalDuration));
      setStartTime(secondsToHms(next));
    } else {
      const cur = hmsToSeconds(endTime);
      const next = Math.max(0, Math.min(cur + delta, totalDuration));
      setEndTime(secondsToHms(next));
    }
  };

  // Chapters handlers
  const handleSelectChapter = (ch: Chapter) => {
    setStartTime(secondsToHms(ch.start_time));
    setEndTime(secondsToHms(ch.end_time));
    setIsFullVideo(false);
    showToast(`Trim set to chapter: "${ch.title}"`, 'info');
  };

  const handleAddAllChapters = (chapters: Chapter[]) => {
    showToast(`Added ${chapters.length} chapter clips to queue`, 'success');
  };

  const handleBrowseFolder = () => {
    showToast('Folder selector dialog will open native directory picker', 'info');
  };

  // Auto-fetch if navigated with autoFetch
  useEffect(() => {
    if (params.url) {
      setCurrentUrl(params.url);
      handleUrlChange(params.url);
      if (params.autoFetch) {
        handleFetchInfo(params.url);
      }
    }
  }, [params.url, params.autoFetch]);

  return (
    <div className="flex-1 flex flex-col gap-3.5 p-5 overflow-y-auto max-w-[1300px] mx-auto w-full box-border">
      {/* Top URL Bar */}
      <UrlBar
        platform="YouTube"
        initialUrl={currentUrl}
        onFetch={(url) => {
          handleUrlChange(url);
          handleFetchInfo(url);
        }}
        isLoading={isLoading}
      />

      {/* Wrong Platform Banner */}
      {wrongPlatform && (
        <WrongPlatformBanner
          detectedPlatform={wrongPlatform}
          onSwitch={() => navigate(wrongPlatform.toLowerCase() as any, { url: currentUrl })}
          onDismiss={() => setWrongPlatform(null)}
        />
      )}

      {/* Playlist Notice Banner */}
      {showPlaylistNotice && (
        <PlaylistNoticeBanner onDismiss={() => setShowPlaylistNotice(false)} />
      )}

      {/* Main 2-Column Grid */}
      <div className="flex-1 flex gap-4 min-h-0">
        {/* Left Column: Preview + Trim Cards */}
        <div className="flex-1 flex flex-col gap-4 min-w-0">
          {/* Preview Card */}
          <Card className="flex flex-col bg-[#14161D] border-border-strong p-4 gap-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-1 rounded-full bg-[#1B1E27] text-foreground-subtle text-xs font-semibold">
                  Preview
                </span>
                <span className="px-2.5 py-1 rounded-full bg-[#1B1E27] text-foreground-muted text-xs font-mono">
                  {videoInfo
                    ? `${videoInfo.isVertical ? 'Vertical Short' : 'Landscape'} · ${videoInfo.durationFormatted}`
                    : 'Waiting for video'}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-foreground-muted">Live preview</span>
                <div className={`w-2 h-2 rounded-full ${videoInfo ? 'bg-status-success' : 'bg-foreground-muted'}`} />
              </div>
            </div>

            {/* Viewport Frame */}
            <div className="relative aspect-video w-full rounded-[14px] bg-[#0A0B0E] border border-border flex flex-col items-center justify-center overflow-hidden">
              {isLoading ? (
                /* Fetching loading state */
                <div className="flex flex-col items-center gap-3 text-center p-6">
                  <div className="w-10 h-10 border-2 border-accent border-t-transparent rounded-full animate-spin" />
                  <div className="text-sm font-semibold text-foreground">Fetching video details...</div>
                  <div className="text-xs text-foreground-muted">Extracting resolutions, chapters, and audio streams</div>
                </div>
              ) : fetchError ? (
                /* Error state with Retry */
                <div className="flex flex-col items-center gap-3 text-center p-6 max-w-md">
                  <div className="w-10 h-10 rounded-full bg-[#2A1B19] text-accent flex items-center justify-center">
                    !
                  </div>
                  <div className="text-sm font-semibold text-foreground">Could not load video</div>
                  <div className="text-xs text-foreground-muted leading-relaxed">{fetchError}</div>
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => handleFetchInfo()}
                    className="flex items-center gap-2 mt-1"
                  >
                    <RefreshCwIcon size={14} />
                    <span>Retry fetch</span>
                  </Button>
                </div>
              ) : videoInfo ? (
                /* Loaded state (Shorts/Landscape adaptive) */
                <div className={`relative w-full h-full flex items-center justify-center bg-black ${videoInfo.isVertical ? 'py-1' : ''}`}>
                  {videoInfo.thumbnail ? (
                    <img
                      src={videoInfo.thumbnail}
                      alt={videoInfo.title}
                      className={`h-full ${videoInfo.isVertical ? 'aspect-[9/16] object-cover rounded-[8px] shadow-2xl border border-white/10' : 'w-full object-cover'}`}
                    />
                  ) : null}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-transparent to-black/30 pointer-events-none" />

                  {/* Play overlay button */}
                  <button
                    type="button"
                    onClick={() => setIsPlaying(!isPlaying)}
                    className="absolute z-10 w-14 h-14 rounded-full bg-accent/90 text-[#1A0805] flex items-center justify-center hover:scale-110 active:scale-95 transition-transform shadow-xl"
                  >
                    {isPlaying ? <PauseIcon size={24} /> : <PlayIcon size={24} className="ml-1" />}
                  </button>

                  <div className="absolute bottom-3 left-4 right-4 flex items-center justify-between text-xs text-white z-10">
                    <span className="font-semibold truncate max-w-[75%] drop-shadow">{videoInfo.title}</span>
                    <span className="font-mono bg-black/75 px-2.5 py-0.5 rounded text-[11px] font-bold">
                      {videoInfo.durationFormatted}
                    </span>
                  </div>
                </div>
              ) : (
                /* Empty state */
                <div className="flex flex-col items-center gap-2 text-center p-6 max-w-sm">
                  <div className="w-12 h-12 rounded-full bg-[#1B1E27] flex items-center justify-center text-foreground-muted">
                    <FilmIcon size={24} />
                  </div>
                  <div className="text-sm font-semibold text-foreground">No Video Loaded</div>
                  <div className="text-xs text-foreground-muted leading-relaxed">
                    Paste a YouTube video or Shorts link in the bar above and click Fetch info to load player & timeline.
                  </div>
                </div>
              )}
            </div>

            {/* Player Control Bar */}
            <div className="flex items-center justify-between pt-1">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={!isVideoLoaded}
                  onClick={() => setIsPlaying(!isPlaying)}
                  className="w-9 h-9 rounded-full bg-accent text-[#1A0805] flex items-center justify-center disabled:opacity-40 disabled:cursor-not-allowed hover:brightness-110 transition-all shadow-sm"
                  aria-label="Play"
                >
                  {isPlaying ? <PauseIcon size={16} /> : <PlayIcon size={16} className="ml-0.5" />}
                </button>
                <button
                  type="button"
                  disabled={!isVideoLoaded}
                  onClick={() => handleAdjustTime('start', -5)}
                  className="w-8 h-8 rounded-full bg-[#1B1E27] text-foreground-muted flex items-center justify-center disabled:opacity-40 disabled:cursor-not-allowed hover:text-foreground transition-all"
                  aria-label="Rewind 5 seconds"
                >
                  <Rewind5Icon size={16} />
                </button>
                <button
                  type="button"
                  disabled={!isVideoLoaded}
                  onClick={() => handleAdjustTime('end', 5)}
                  className="w-8 h-8 rounded-full bg-[#1B1E27] text-foreground-muted flex items-center justify-center disabled:opacity-40 disabled:cursor-not-allowed hover:text-foreground transition-all"
                  aria-label="Forward 5 seconds"
                >
                  <Forward5Icon size={16} />
                </button>
                <div className="text-xs font-mono pl-2 text-foreground-muted select-none">
                  <span className="font-bold text-foreground">{secondsToMs(startSec)}</span> / {videoInfo ? secondsToMs(totalDuration) : '00:00'}
                </div>
              </div>

              {/* Play Selection Pill */}
              <button
                type="button"
                disabled={!isVideoLoaded || isFullVideo}
                className="h-8 px-4 rounded-full border border-accent text-accent bg-[#2A1B19]/30 text-xs font-semibold disabled:opacity-30 disabled:cursor-not-allowed hover:bg-accent hover:text-[#1A0805] transition-all"
              >
                Play selection
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={!isVideoLoaded}
                  className="w-8 h-8 rounded-full bg-[#1B1E27] text-foreground-muted flex items-center justify-center disabled:opacity-40 disabled:cursor-not-allowed hover:text-foreground transition-all"
                  aria-label="Mute"
                >
                  <VolumeIcon size={16} />
                </button>
                <button
                  type="button"
                  disabled={!isVideoLoaded}
                  className="w-8 h-8 rounded-full bg-[#1B1E27] text-foreground-muted flex items-center justify-center disabled:opacity-40 disabled:cursor-not-allowed hover:text-foreground transition-all"
                  aria-label="Fullscreen"
                >
                  <FullscreenIcon size={16} />
                </button>
              </div>
            </div>
          </Card>

          {/* Trim Card */}
          <Card className="flex flex-col bg-[#14161D] border-border-strong p-4 gap-4">
            {/* Trim Header */}
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-display font-bold text-base text-foreground">Trim your clip</h2>
                <p className={`text-xs mt-0.5 ${isFullVideo ? 'text-accent font-medium' : 'text-foreground-muted'}`}>
                  {isFullVideo
                    ? 'Clipping is off. The whole video will be downloaded.'
                    : 'Drag the handles as you watch. Only that part is downloaded.'}
                </p>
              </div>

              <div className="flex items-center gap-2.5">
                {/* Chapters Popover Chip (Appears only when chapters exist) */}
                {videoInfo && videoInfo.chapters && videoInfo.chapters.length > 0 && (
                  <ChaptersPopover
                    chapters={videoInfo.chapters}
                    onSelectChapter={handleSelectChapter}
                    onAddAllChapters={handleAddAllChapters}
                  />
                )}

                {/* Full Video Checkbox Pill */}
                <FullVideoCheckbox
                  checked={isFullVideo}
                  onChange={setIsFullVideo}
                />

                {/* Clip / Full video badge */}
                <span className="px-3 py-1 rounded-full bg-[#1B1E27] text-foreground-subtle text-xs font-mono font-medium">
                  {isFullVideo
                    ? `Full video · ${videoInfo ? videoInfo.durationFormatted : '00:00'}`
                    : `Clip ${secondsToMs(clipDuration)} of ${videoInfo ? videoInfo.durationFormatted : '00:00'}`}
                </span>
              </div>
            </div>

            {/* Filmstrip / Timeline container */}
            <div className={`relative h-20 rounded-[12px] bg-[#0A0B0E] border ${isFullVideo ? 'border-accent' : 'border-border'} flex flex-col justify-between p-2 select-none overflow-hidden transition-all`}>
              {/* Ruler ticks top */}
              <div className="flex justify-between items-center text-[10px] font-mono text-foreground-muted opacity-60 px-2">
                <span>00:00</span>
                <span>{secondsToMs(totalDuration * 0.25)}</span>
                <span>{secondsToMs(totalDuration * 0.5)}</span>
                <span>{secondsToMs(totalDuration * 0.75)}</span>
                <span>{videoInfo ? secondsToMs(totalDuration) : '01:00'}</span>
              </div>

              {/* Central Filmstrip track */}
              <div className="relative h-9 rounded-[8px] bg-[#12141A] border border-border-subtle flex items-center justify-center overflow-hidden">
                {isFullVideo ? (
                  <div className="w-full h-full bg-accent/15 border-2 border-accent flex items-center justify-center rounded-[6px]">
                    <span className="text-[11px] font-semibold text-accent">Entire video selected ({videoInfo?.durationFormatted})</span>
                  </div>
                ) : (
                  <div className="relative w-full h-full flex items-center justify-center">
                    {/* Simulated selection range */}
                    <div
                      className="absolute top-0 bottom-0 bg-accent/20 border-y-2 border-accent"
                      style={{
                        left: `${totalDuration > 0 ? (startSec / totalDuration) * 100 : 0}%`,
                        right: `${totalDuration > 0 ? Math.max(0, 100 - (endSec / totalDuration) * 100) : 0}%`
                      }}
                    >
                      <div className="absolute -left-1 top-0 bottom-0 w-2 bg-accent rounded-l cursor-ew-resize" />
                      <div className="absolute -right-1 top-0 bottom-0 w-2 bg-accent rounded-r cursor-ew-resize" />
                    </div>
                    <span className="text-[11px] text-foreground-muted z-10">
                      {videoInfo ? `Clip selection: ${secondsToMs(clipDuration)}` : 'Timeline filmstrip will render here'}
                    </span>
                  </div>
                )}
              </div>

              {/* Bottom ruler ticks */}
              <div className="flex justify-between items-center text-[9px] font-mono text-foreground-muted opacity-40 px-3">
                {Array.from({ length: 15 }).map((_, i) => (
                  <div key={i} className="w-[1px] h-1.5 bg-foreground-muted" />
                ))}
              </div>
            </div>

            {/* Start and End Cards */}
            <div className={`grid grid-cols-2 gap-3 transition-opacity ${isFullVideo ? 'opacity-40 pointer-events-none' : ''}`}>
              {/* START Card */}
              <div className="p-3.5 rounded-[12px] bg-[#0F1116] border border-border flex flex-col gap-2">
                <div className="text-[11px] font-semibold text-foreground-muted tracking-wide">
                  START
                </div>
                <div className="font-mono text-2xl font-bold text-foreground">
                  {isFullVideo ? '00:00:00' : startTime}
                </div>
                <div className="flex items-center gap-2 pt-1">
                  <button
                    type="button"
                    disabled={isFullVideo || !isVideoLoaded}
                    onClick={() => handleAdjustTime('start', -1)}
                    className="flex-1 h-8 rounded-[8px] bg-[#1B1E27] text-foreground-muted text-xs font-medium hover:text-foreground disabled:opacity-40"
                  >
                    -1s
                  </button>
                  <button
                    type="button"
                    disabled={isFullVideo || !isVideoLoaded}
                    onClick={() => handleAdjustTime('start', 1)}
                    className="flex-1 h-8 rounded-[8px] bg-[#1B1E27] text-foreground-muted text-xs font-medium hover:text-foreground disabled:opacity-40"
                  >
                    +1s
                  </button>
                  <button
                    type="button"
                    disabled={isFullVideo || !isVideoLoaded}
                    onClick={() => setStartTime('00:00:00')}
                    className="flex-1 h-8 rounded-[8px] bg-[#2A1B19] text-[#FF8C7E] text-xs font-semibold hover:bg-accent hover:text-[#1A0805] transition-all disabled:opacity-40"
                  >
                    Use playhead
                  </button>
                </div>
              </div>

              {/* END Card */}
              <div className="p-3.5 rounded-[12px] bg-[#0F1116] border border-border flex flex-col gap-2">
                <div className="text-[11px] font-semibold text-foreground-muted tracking-wide">
                  END
                </div>
                <div className="font-mono text-2xl font-bold text-foreground">
                  {isFullVideo && videoInfo ? videoInfo.durationFormatted : endTime}
                </div>
                <div className="flex items-center gap-2 pt-1">
                  <button
                    type="button"
                    disabled={isFullVideo || !isVideoLoaded}
                    onClick={() => handleAdjustTime('end', -1)}
                    className="flex-1 h-8 rounded-[8px] bg-[#1B1E27] text-foreground-muted text-xs font-medium hover:text-foreground disabled:opacity-40"
                  >
                    -1s
                  </button>
                  <button
                    type="button"
                    disabled={isFullVideo || !isVideoLoaded}
                    onClick={() => handleAdjustTime('end', 1)}
                    className="flex-1 h-8 rounded-[8px] bg-[#1B1E27] text-foreground-muted text-xs font-medium hover:text-foreground disabled:opacity-40"
                  >
                    +1s
                  </button>
                  <button
                    type="button"
                    disabled={isFullVideo || !isVideoLoaded}
                    onClick={() => setEndTime(secondsToHms(totalDuration))}
                    className="flex-1 h-8 rounded-[8px] bg-[#2A1B19] text-[#FF8C7E] text-xs font-semibold hover:bg-accent hover:text-[#1A0805] transition-all disabled:opacity-40"
                  >
                    Use playhead
                  </button>
                </div>
              </div>
            </div>

            {/* Presets Row & Frame Accurate Toggle */}
            <div className="flex items-center justify-between pt-1">
              {/* Presets */}
              <div className={`flex items-center gap-1.5 transition-opacity ${isFullVideo || !isVideoLoaded ? 'opacity-40 pointer-events-none' : ''}`}>
                {['First 30s', 'First 60s', 'Middle 50%', 'Last 30s', 'Reset'].map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    disabled={isFullVideo || !isVideoLoaded}
                    onClick={() => handleApplyPreset(preset)}
                    className="h-7 px-2.5 rounded-[8px] bg-[#1B1E27] border border-border text-[11px] text-foreground-muted font-medium hover:text-foreground hover:border-border-muted transition-all select-none disabled:opacity-40"
                  >
                    {preset}
                  </button>
                ))}
              </div>

              {/* Frame-accurate slower toggle + Cut Mode Pill */}
              <div className="flex items-center gap-3">
                <span className="px-2.5 py-0.5 rounded-[6px] bg-[#1B1E27] text-[10px] font-mono text-foreground-muted border border-border">
                  {cutModeText}
                </span>

                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <span className="text-xs text-foreground-muted font-medium">
                    Frame-accurate <span className="opacity-60">· slower</span>
                  </span>
                  <input
                    type="checkbox"
                    checked={frameAccurate}
                    onChange={(e) => setFrameAccurate(e.target.checked)}
                    className="w-4 h-4 rounded bg-[#0F1116] border-border-strong text-accent focus:ring-0 focus:ring-offset-0 cursor-pointer"
                  />
                </label>
              </div>
            </div>
          </Card>
        </div>

        {/* Right Column: Info + Quality/Format + Save + Bottom Actions */}
        <div className="w-[300px] flex-none flex flex-col gap-4">
          {/* Info Card */}
          <Card className="flex flex-col bg-[#14161D] border-border-strong p-4 gap-2">
            <div className="flex items-center justify-between">
              <span className={`text-xs font-semibold ${videoInfo ? 'text-status-success' : 'text-foreground-muted'}`}>
                {videoInfo ? `Video found · ${formatHumanDuration(videoInfo.duration)}` : 'Ready'}
              </span>
            </div>
            <h3 className="font-display font-semibold text-sm text-foreground line-clamp-2">
              {videoInfo ? videoInfo.title : 'No video loaded'}
            </h3>
            <p className="text-xs text-foreground-muted">
              {videoInfo
                ? `${videoInfo.uploader} · YouTube`
                : 'Paste a YouTube video or Shorts link to inspect formats and clip.'}
            </p>
          </Card>

          {/* Quality and Format Card */}
          <Card className="flex flex-col bg-[#14161D] border-border-strong p-4 gap-4">
            <div className="text-xs font-semibold text-foreground-muted uppercase tracking-wider">
              Quality and Format
            </div>

            {/* Segmented Toggle: Video | Audio only */}
            <SegmentedToggle
              value={mediaType}
              onChange={handleMediaTypeChange}
              options={[
                { value: 'video', label: 'Video' },
                { value: 'audio', label: 'Audio only' }
              ]}
            />

            {/* Quality Select Dropdown */}
            <div className="relative">
              <div className="text-xs font-semibold text-foreground-muted mb-2 tracking-wide">
                Quality
              </div>
              <button
                type="button"
                disabled={!isVideoLoaded}
                onClick={() => setIsQualityDropdownOpen(!isQualityDropdownOpen)}
                className="w-full h-11 rounded-[12px] border border-border-strong bg-[#0F1116] px-3 flex items-center justify-between text-[13px] text-foreground select-none disabled:opacity-40"
              >
                <span>{selectedResolution}</span>
                <ChevronDownIcon size={16} className={`text-foreground-muted transition-transform ${isQualityDropdownOpen ? 'rotate-180' : ''}`} />
              </button>

              {isQualityDropdownOpen && isVideoLoaded && (
                <div className="absolute left-0 right-0 top-full mt-1 bg-[#14161D] border border-border-strong rounded-[12px] shadow-xl z-30 p-1 flex flex-col gap-0.5">
                  {(mediaType === 'video'
                    ? (videoInfo?.availableResolutions || ['1080p', '720p', '480p'])
                    : ['320 kbps (High)', '256 kbps (Medium)', '192 kbps', '128 kbps (Standard)']
                  ).map((res) => (
                    <button
                      key={res}
                      type="button"
                      onClick={() => {
                        setSelectedResolution(res);
                        setIsQualityDropdownOpen(false);
                      }}
                      className="w-full text-left px-3 py-2 text-xs rounded-[8px] hover:bg-[#1B1E27] text-foreground-subtle hover:text-foreground transition-colors"
                    >
                      {res}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Format Chips */}
            <div>
              <div className="text-xs font-semibold text-foreground-muted mb-2 tracking-wide">
                Format
              </div>
              <div className="flex items-center gap-2">
                {mediaType === 'video' ? (
                  <>
                    <Chip
                      variant="format"
                      selected={selectedFormat === 'MP4'}
                      onClick={() => setSelectedFormat('MP4')}
                    >
                      MP4
                    </Chip>
                    <Chip
                      variant="format"
                      selected={selectedFormat === 'MOV'}
                      onClick={() => setSelectedFormat('MOV')}
                    >
                      MOV
                    </Chip>
                    <Chip
                      variant="format"
                      selected={selectedFormat === 'GIF'}
                      onClick={() => setSelectedFormat('GIF')}
                    >
                      GIF
                    </Chip>
                  </>
                ) : (
                  <>
                    <Chip
                      variant="format"
                      selected={selectedFormat === 'MP3'}
                      onClick={() => setSelectedFormat('MP3')}
                    >
                      MP3
                    </Chip>
                    <Chip
                      variant="format"
                      selected={selectedFormat === 'M4A'}
                      onClick={() => setSelectedFormat('M4A')}
                    >
                      M4A
                    </Chip>
                    <Chip
                      variant="format"
                      selected={selectedFormat === 'WAV'}
                      onClick={() => setSelectedFormat('WAV')}
                    >
                      WAV
                    </Chip>
                  </>
                )}
              </div>
            </div>
          </Card>

          {/* Save Card */}
          <Card className="flex flex-col bg-[#14161D] border-border-strong p-4 gap-3">
            <div className="text-xs font-semibold text-foreground-muted uppercase tracking-wider">
              Save To
            </div>

            <Field
              label="File name"
              value={fileName}
              onChange={(e) => setFileName(e.target.value)}
              placeholder="video_title"
              suffix={<span className="text-xs font-mono text-foreground-muted">.{selectedFormat.toLowerCase()}</span>}
            />

            <div>
              <div className="text-xs font-semibold text-foreground-muted mb-2 tracking-wide">
                Folder
              </div>
              <div className="flex items-center gap-2">
                <div
                  title={saveFolder}
                  className="flex-1 h-11 rounded-[12px] border border-border-strong bg-[#0F1116] px-3 flex items-center text-[12px] text-foreground-subtle font-mono truncate select-none"
                >
                  {saveFolder}
                </div>
                <Button
                  variant="secondary"
                  size="md"
                  onClick={handleBrowseFolder}
                  className="px-3"
                >
                  <FolderIcon size={16} />
                </Button>
              </div>
            </div>
          </Card>

          {/* Summary Line */}
          <div className="flex items-center justify-between px-1 text-xs select-none">
            <span className="text-foreground-subtle font-medium">
              {videoInfo
                ? (isFullVideo
                  ? `Full video · ${selectedFormat}`
                  : `Clip ${secondsToMs(clipDuration)} · ${selectedFormat}`)
                : `Clip 00:00 · ${selectedFormat}`}
            </span>
            <span className="text-foreground-muted font-mono">
              ≈ {estimateFileSizeMb()} MB
            </span>
          </div>

          {/* Pinned Action Buttons */}
          <div className="flex flex-col gap-2 mt-auto pt-2">
            <Button
              variant="secondary"
              size="lg"
              disabled={!isVideoLoaded}
              onClick={() => showToast(`Added "${fileName}" to queue`, 'success')}
              className="w-full flex items-center justify-center gap-2"
            >
              <QueueIcon size={18} />
              <span>Add to queue</span>
            </Button>

            <Button
              variant="primary"
              size="lg"
              disabled={!isVideoLoaded}
              onClick={() => showToast(`Starting download: ${fileName}.${selectedFormat.toLowerCase()}`, 'success')}
              className="w-full flex items-center justify-center gap-2 font-bold"
            >
              <DownloadIcon size={18} />
              <span>{isFullVideo ? 'Download full video' : 'Download clip'}</span>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};
