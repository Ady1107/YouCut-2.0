import React, { useState, useEffect, useRef } from 'react';
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
  VolumeXIcon,
  GaugeIcon,
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
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const timelineTrackRef = useRef<HTMLDivElement>(null);
  const isSelectionPlayingRef = useRef(false);

  // Mode and format states
  const [mediaType, setMediaType] = useState<'video' | 'audio'>('video');
  const [selectedFormat, setSelectedFormat] = useState<string>('MP4');
  const [selectedResolution, setSelectedResolution] = useState<string>('Best available');
  const [isFullVideo, setIsFullVideo] = useState(false);
  const [frameAccurate, setFrameAccurate] = useState(false);
  const [startTime, setStartTime] = useState('00:00:00');
  const [endTime, setEndTime] = useState('00:00:00');
  const [playheadSec, setPlayheadSec] = useState<number>(0);
  const [draggingTarget, setDraggingTarget] = useState<'start' | 'end' | 'playhead' | null>(null);
  const [fileName, setFileName] = useState('');
  const [saveFolder, setSaveFolder] = useState('C:\\Users\\User\\Downloads\\YouCut\\YouTube');

  // Playback states
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [volume, setVolume] = useState<number>(100);
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1);
  const [isSpeedMenuOpen, setIsSpeedMenuOpen] = useState(false);

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

  const isVideoLoaded = Boolean(videoInfo);
  const totalDuration = videoInfo ? videoInfo.duration : 0;
  const startSec = hmsToSeconds(startTime);
  const endSec = hmsToSeconds(endTime) || totalDuration;
  const clipDuration = Math.max(0, endSec - startSec);

  // Load real default save folder from native system
  useEffect(() => {
    if (typeof window !== 'undefined' && window.api?.getDefaultDownloadDir) {
      window.api.getDefaultDownloadDir('YouTube').then((dir) => {
        if (dir) setSaveFolder(dir);
      }).catch(() => {});
    }
  }, []);

  // Sync player postMessage events
  useEffect(() => {
    const handleWindowMessage = (e: MessageEvent) => {
      try {
        const data = typeof e.data === 'string' ? JSON.parse(e.data) : e.data;
        if (data?.event === 'onStateChange') {
          if (data.info === 1) {
            setIsPlaying(true);
          } else if (data.info === 2 || data.info === 0) {
            setIsPlaying(false);
          }
        } else if (data?.event === 'infoDelivery' && data?.info?.currentTime !== undefined) {
          const cur = Math.round(data.info.currentTime);
          setPlayheadSec(cur);
        }
      } catch {}
    };
    window.addEventListener('message', handleWindowMessage);
    return () => window.removeEventListener('message', handleWindowMessage);
  }, []);

  // Update playhead smoothly while playing
  useEffect(() => {
    let timer: any = null;
    if (isPlaying) {
      timer = setInterval(() => {
        setPlayheadSec((prev) => {
          const next = prev + 1;
          if (isSelectionPlayingRef.current && next >= endSec) {
            sendPlayerCommand('pauseVideo');
            setIsPlaying(false);
            isSelectionPlayingRef.current = false;
            return endSec;
          }
          if (next >= totalDuration && totalDuration > 0) {
            setIsPlaying(false);
            return totalDuration;
          }
          return next;
        });
        sendPlayerCommand('getCurrentTime');
      }, 1000);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [isPlaying, endSec, totalDuration]);

  // Window drag listeners for Start, End handles and Playhead knob
  useEffect(() => {
    if (!draggingTarget) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (!timelineTrackRef.current || totalDuration === 0) return;
      const rect = timelineTrackRef.current.getBoundingClientRect();
      const fraction = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
      const targetSec = Math.round(fraction * totalDuration);

      if (draggingTarget === 'start') {
        const newStart = Math.max(0, Math.min(targetSec, endSec - 1));
        setStartTime(secondsToHms(newStart));
        setPlayheadSec(newStart);
        sendPlayerCommand('seekTo', [newStart, true]);
      } else if (draggingTarget === 'end') {
        const newEnd = Math.min(totalDuration, Math.max(targetSec, startSec + 1));
        setEndTime(secondsToHms(newEnd));
        setPlayheadSec(newEnd);
        sendPlayerCommand('seekTo', [newEnd, true]);
      } else if (draggingTarget === 'playhead') {
        const newPlayhead = Math.max(0, Math.min(totalDuration, targetSec));
        setPlayheadSec(newPlayhead);
        sendPlayerCommand('seekTo', [newPlayhead, true]);
      }
    };

    const handleMouseUp = () => {
      setDraggingTarget(null);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [draggingTarget, totalDuration, startSec, endSec]);

  // Active cut mode per Lesson 4
  const isCutExact = frameAccurate || (totalDuration > 0 && totalDuration <= 600);
  const cutModeText = isCutExact
    ? (frameAccurate ? 'Cut: Exact (Forced)' : 'Cut: Exact (Auto ≤10m)')
    : 'Cut: Fast (keyframes)';

  // Calculate estimated file size
  const estimateFileSizeMb = (): number => {
    if (!videoInfo || totalDuration === 0) return 0;
    const dur = isFullVideo ? totalDuration : clipDuration;
    if (mediaType === 'audio') {
      return Math.round((dur / 60) * 2.5 * 10) / 10;
    }
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

    if (trimmed.includes('instagram.com')) {
      setWrongPlatform('Instagram');
    } else if (trimmed.includes('facebook.com') || trimmed.includes('fb.watch')) {
      setWrongPlatform('Facebook');
    } else {
      setWrongPlatform(null);
    }

    if (trimmed.includes('list=') || trimmed.includes('playlist?')) {
      setShowPlaylistNotice(true);
    } else {
      setShowPlaylistNotice(false);
    }
  };

  // Only fetches when user explicitly clicks Fetch info or enters URL
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
        setPlayheadSec(0);
        setIsPlaying(false);
        isSelectionPlayingRef.current = false;
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

  // Send command to embedded iframe player via postMessage
  const sendPlayerCommand = (func: string, args: any[] = []) => {
    if (iframeRef.current && iframeRef.current.contentWindow) {
      try {
        iframeRef.current.contentWindow.postMessage(
          JSON.stringify({ event: 'command', func, args }),
          '*'
        );
      } catch (e) {
        console.warn('postMessage to player failed:', e);
      }
    }
  };

  // Player controls
  const handleTogglePlay = () => {
    if (!videoInfo) return;
    if (!isPlaying) {
      setIsPlaying(true);
      sendPlayerCommand('playVideo');
    } else {
      setIsPlaying(false);
      sendPlayerCommand('pauseVideo');
    }
  };

  // Keyboard shortcuts: 'i' for IN (start), 'o' for OUT (end), Space for play/pause, Arrows for seek
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const isInputActive =
        target?.tagName === 'INPUT' ||
        target?.tagName === 'TEXTAREA' ||
        target?.isContentEditable;

      if (isInputActive) return;

      const key = e.key.toLowerCase();

      // 'i' key: In point (set START to playhead)
      if (key === 'i') {
        e.preventDefault();
        if (!videoInfo || isFullVideo) return;
        const newStart = Math.min(playheadSec, endSec);
        setStartTime(secondsToHms(newStart));
        return;
      }

      // 'o' key: Out point (set END to playhead)
      if (key === 'o') {
        e.preventDefault();
        if (!videoInfo || isFullVideo) return;
        const newEnd = Math.max(playheadSec, startSec);
        setEndTime(secondsToHms(newEnd));
        return;
      }

      // Spacebar: Play / Pause toggle
      if (e.code === 'Space') {
        e.preventDefault();
        handleTogglePlay();
        return;
      }

      // Left Arrow: Rewind 5s
      if (e.code === 'ArrowLeft') {
        e.preventDefault();
        handleSeekRelative(-5);
        return;
      }

      // Right Arrow: Forward 5s
      if (e.code === 'ArrowRight') {
        e.preventDefault();
        handleSeekRelative(5);
        return;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [videoInfo, isFullVideo, playheadSec, startSec, endSec, isPlaying]);

  const handleSeekRelative = (delta: number) => {
    if (!videoInfo) return;
    const target = Math.max(0, Math.min(totalDuration, playheadSec + delta));
    setPlayheadSec(target);
    sendPlayerCommand('seekTo', [target, true]);
  };

  const handleToggleMute = () => {
    const nextMute = !isMuted;
    setIsMuted(nextMute);
    if (nextMute) {
      sendPlayerCommand('mute');
    } else {
      sendPlayerCommand('unMute');
      sendPlayerCommand('setVolume', [volume || 80]);
    }
  };

  const handleVolumeChange = (val: number) => {
    setVolume(val);
    if (val === 0) {
      setIsMuted(true);
      sendPlayerCommand('mute');
    } else {
      if (isMuted) {
        setIsMuted(false);
        sendPlayerCommand('unMute');
      }
      sendPlayerCommand('setVolume', [val]);
    }
  };

  const handleSetPlaybackSpeed = (spd: number) => {
    setPlaybackSpeed(spd);
    setIsSpeedMenuOpen(false);
    sendPlayerCommand('setPlaybackRate', [spd]);
  };

  const handlePlaySelection = () => {
    if (!videoInfo) return;
    isSelectionPlayingRef.current = true;
    setIsPlaying(true);
    setPlayheadSec(startSec);
    sendPlayerCommand('seekTo', [startSec, true]);
    sendPlayerCommand('playVideo');
  };

  // Timeline track click
  const handleTimelineClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!timelineTrackRef.current || totalDuration === 0 || isFullVideo) return;
    const rect = timelineTrackRef.current.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const fraction = Math.max(0, Math.min(1, clickX / rect.width));
    const targetSec = Math.round(fraction * totalDuration);
    setPlayheadSec(targetSec);
    sendPlayerCommand('seekTo', [targetSec, true]);
  };

  // Timecode direct inputs
  const handleStartTimeInputChange = (val: string) => {
    setStartTime(val);
    const sec = hmsToSeconds(val);
    if (!isNaN(sec) && sec >= 0 && sec < endSec) {
      setPlayheadSec(sec);
      sendPlayerCommand('seekTo', [sec, true]);
    }
  };

  const handleStartTimeBlur = () => {
    const sec = hmsToSeconds(startTime);
    if (isNaN(sec) || sec < 0) {
      setStartTime('00:00:00');
    } else if (sec >= endSec) {
      setStartTime(secondsToHms(Math.max(0, endSec - 1)));
    } else {
      setStartTime(secondsToHms(sec));
    }
  };

  const handleEndTimeInputChange = (val: string) => {
    setEndTime(val);
    const sec = hmsToSeconds(val);
    if (!isNaN(sec) && sec > startSec && sec <= totalDuration) {
      setPlayheadSec(sec);
      sendPlayerCommand('seekTo', [sec, true]);
    }
  };

  const handleEndTimeBlur = () => {
    const sec = hmsToSeconds(endTime);
    if (isNaN(sec) || sec > totalDuration) {
      setEndTime(secondsToHms(totalDuration));
    } else if (sec <= startSec) {
      setEndTime(secondsToHms(Math.min(totalDuration, startSec + 1)));
    } else {
      setEndTime(secondsToHms(sec));
    }
  };

  // "Use playhead" button handlers
  const handleUsePlayhead = (target: 'start' | 'end') => {
    if (target === 'start') {
      const newStart = Math.min(playheadSec, endSec);
      setStartTime(secondsToHms(newStart));
    } else {
      const newEnd = Math.max(playheadSec, startSec);
      setEndTime(secondsToHms(newEnd));
    }
  };

  // Adjust time by +/- 1 second
  const handleAdjustTime = (target: 'start' | 'end', delta: number) => {
    if (target === 'start') {
      const cur = hmsToSeconds(startTime);
      const next = Math.max(0, Math.min(cur + delta, endSec));
      setStartTime(secondsToHms(next));
      setPlayheadSec(next);
      sendPlayerCommand('seekTo', [next, true]);
    } else {
      const cur = hmsToSeconds(endTime);
      const next = Math.max(startSec, Math.min(cur + delta, totalDuration));
      setEndTime(secondsToHms(next));
      setPlayheadSec(next);
      sendPlayerCommand('seekTo', [next, true]);
    }
  };

  // Preset buttons handler
  const handleApplyPreset = (presetName: string) => {
    if (!videoInfo || totalDuration === 0) return;

    if (presetName === 'First 30s') {
      setStartTime('00:00:00');
      setEndTime(secondsToHms(Math.min(30, totalDuration)));
      setPlayheadSec(0);
    } else if (presetName === 'First 60s') {
      setStartTime('00:00:00');
      setEndTime(secondsToHms(Math.min(60, totalDuration)));
      setPlayheadSec(0);
    } else if (presetName === 'Middle 50%') {
      const s = Math.round(totalDuration * 0.25);
      const e = Math.round(totalDuration * 0.75);
      setStartTime(secondsToHms(s));
      setEndTime(secondsToHms(e));
      setPlayheadSec(s);
    } else if (presetName === 'Last 30s') {
      const s = Math.max(0, totalDuration - 30);
      setStartTime(secondsToHms(s));
      setEndTime(secondsToHms(totalDuration));
      setPlayheadSec(s);
    } else if (presetName === 'Reset') {
      setStartTime('00:00:00');
      setEndTime(secondsToHms(totalDuration));
      setPlayheadSec(0);
    }
  };

  // Chapters handler
  const handleSelectChapter = (ch: Chapter) => {
    setStartTime(secondsToHms(ch.start_time));
    setEndTime(secondsToHms(ch.end_time));
    setPlayheadSec(ch.start_time);
    setIsFullVideo(false);
    sendPlayerCommand('seekTo', [ch.start_time, true]);
  };

  const handleAddAllChapters = async (chapters: Chapter[]) => {
    if (!videoInfo) return;
    for (const ch of chapters) {
      const item = {
        id: Math.random().toString(36).substring(2, 9),
        title: `${videoInfo.title} - ${ch.title}`,
        url: currentUrl,
        platform: 'youtube' as const,
        format: selectedFormat,
        quality: selectedResolution,
        startSec: ch.start_time,
        endSec: ch.end_time,
        isFullVideo: false,
        frameAccurate,
        saveFolder,
        fileName: sanitizeFilename(`${videoInfo.title}_${ch.title}`, 60)
      };
      if (window.api && window.api.addToQueue) {
        await window.api.addToQueue(item);
      }
    }
    showToast(`Added ${chapters.length} chapter clips to queue`, 'success');
  };

  // Add to Queue handler
  const handleAddToQueue = async () => {
    if (!videoInfo) return;
    const finalStart = isFullVideo ? 0 : startSec;
    const finalEnd = isFullVideo ? totalDuration : endSec;

    const item = {
      id: Math.random().toString(36).substring(2, 9),
      title: videoInfo.title,
      url: currentUrl,
      platform: 'youtube' as const,
      format: selectedFormat,
      quality: selectedResolution,
      startSec: finalStart,
      endSec: finalEnd,
      isFullVideo,
      frameAccurate,
      saveFolder,
      fileName,
      thumbnail: videoInfo.thumbnail,
      duration: totalDuration
    };

    if (window.api && window.api.addToQueue) {
      await window.api.addToQueue(item);
      // Immediately navigate to queue tab per user request (no toast popup)
      navigate('queue');
    } else {
      showToast('Queue API not available. Please restart the app.', 'error');
    }
  };

  // Download Clip handler (adds to queue and navigates to queue view)
  const handleDownloadNow = async () => {
    await handleAddToQueue();
  };

  const handleBrowseFolder = async () => {
    if (window.api && window.api.openDirectoryDialog) {
      const selected = await window.api.openDirectoryDialog(saveFolder);
      if (selected) {
        setSaveFolder(selected);
        showToast(`Save folder updated: ${selected}`, 'success');
      }
    } else {
      showToast('Native directory selector is not available', 'error');
    }
  };

  // Sync currentUrl from navigation parameters without auto-fetching
  useEffect(() => {
    if (params.url) {
      setCurrentUrl(params.url);
      handleUrlChange(params.url);
    }
  }, [params.url]);

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
                    ? `${videoInfo.isVertical ? 'Vertical Short' : '1080p'} · ${videoInfo.durationFormatted}`
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
                <div className="flex flex-col items-center gap-3 text-center p-6">
                  <div className="w-10 h-10 border-2 border-accent border-t-transparent rounded-full animate-spin" />
                  <div className="text-sm font-semibold text-foreground">Fetching video details...</div>
                  <div className="text-xs text-foreground-muted">Extracting resolutions, chapters, and audio streams</div>
                </div>
              ) : fetchError ? (
                <div className="flex flex-col items-center gap-3 text-center p-6 max-w-md">
                  <div className="w-10 h-10 rounded-full bg-[#2A1B19] text-accent flex items-center justify-center font-bold">
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
                /* Interactive Player Frame */
                <div className="relative w-full h-full flex items-center justify-center bg-black overflow-hidden">
                  <iframe
                    ref={iframeRef}
                    id="yt-player-iframe"
                    src={`https://www.youtube.com/embed/${videoInfo.id}?enablejsapi=1&origin=${encodeURIComponent(typeof window !== 'undefined' ? window.location.origin : 'http://localhost')}&widgetid=1&rel=0&autoplay=0`}
                    title={videoInfo.title}
                    className={`w-full h-full border-0 ${videoInfo.isVertical ? 'max-w-[300px] mx-auto rounded-[8px]' : ''}`}
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                  />
                </div>
              ) : (
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
                  onClick={handleTogglePlay}
                  className="w-9 h-9 rounded-full bg-accent text-[#1A0805] flex items-center justify-center disabled:opacity-40 disabled:cursor-not-allowed hover:brightness-110 transition-all shadow-sm"
                  aria-label="Play or Pause"
                >
                  {isPlaying ? <PauseIcon size={16} /> : <PlayIcon size={16} className="ml-0.5" />}
                </button>
                <button
                  type="button"
                  disabled={!isVideoLoaded}
                  onClick={() => handleSeekRelative(-5)}
                  className="w-8 h-8 rounded-full bg-[#1B1E27] text-foreground-muted flex items-center justify-center disabled:opacity-40 disabled:cursor-not-allowed hover:text-foreground transition-all"
                  aria-label="Rewind 5 seconds"
                >
                  <Rewind5Icon size={16} />
                </button>
                <button
                  type="button"
                  disabled={!isVideoLoaded}
                  onClick={() => handleSeekRelative(5)}
                  className="w-8 h-8 rounded-full bg-[#1B1E27] text-foreground-muted flex items-center justify-center disabled:opacity-40 disabled:cursor-not-allowed hover:text-foreground transition-all"
                  aria-label="Forward 5 seconds"
                >
                  <Forward5Icon size={16} />
                </button>
                <div className="text-xs font-mono pl-2 text-foreground-muted select-none">
                  <span className="font-bold text-foreground">{secondsToMs(playheadSec)}</span> / {videoInfo ? secondsToMs(totalDuration) : '00:00'}
                </div>
              </div>

              {/* Play Selection Pill */}
              <button
                type="button"
                disabled={!isVideoLoaded || isFullVideo}
                onClick={handlePlaySelection}
                className="h-8 px-4 rounded-full border border-accent text-accent bg-[#2A1B19]/30 text-xs font-semibold disabled:opacity-30 disabled:cursor-not-allowed hover:bg-accent hover:text-[#1A0805] transition-all"
              >
                Play selection
              </button>

              <div className="flex items-center gap-2.5">
                {/* Speed Selector Dropdown */}
                <div className="relative">
                  <button
                    type="button"
                    disabled={!isVideoLoaded}
                    onClick={() => setIsSpeedMenuOpen(!isSpeedMenuOpen)}
                    className={`h-8 px-2.5 rounded-full bg-[#1B1E27] text-xs font-mono font-semibold flex items-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed transition-all ${
                      playbackSpeed !== 1 ? 'text-accent border border-accent/40 bg-accent/10' : 'text-foreground-muted hover:text-foreground'
                    }`}
                    title="Playback Speed"
                  >
                    <GaugeIcon size={14} />
                    <span>{playbackSpeed}x</span>
                  </button>

                  {isSpeedMenuOpen && (
                    <div className="absolute right-0 bottom-full mb-2 bg-[#14161D] border border-border-strong rounded-[10px] shadow-2xl p-1 flex flex-col gap-0.5 z-40 min-w-[95px]">
                      {[0.5, 0.75, 1, 1.25, 1.5, 1.75, 2].map((spd) => (
                        <button
                          key={spd}
                          type="button"
                          onClick={() => handleSetPlaybackSpeed(spd)}
                          className={`w-full text-left px-2.5 py-1.5 text-xs font-mono rounded-[6px] transition-colors ${
                            playbackSpeed === spd
                              ? 'bg-accent text-[#1A0805] font-bold'
                              : 'text-foreground-subtle hover:bg-[#1B1E27] hover:text-foreground'
                          }`}
                        >
                          {spd}x {spd === 1 ? '(Normal)' : ''}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Volume Button & Slider */}
                <div className="flex items-center gap-1.5 bg-[#1B1E27] px-2 py-1 rounded-full border border-border-subtle">
                  <button
                    type="button"
                    disabled={!isVideoLoaded}
                    onClick={handleToggleMute}
                    className={`w-6 h-6 rounded-full flex items-center justify-center disabled:opacity-40 disabled:cursor-not-allowed transition-all ${
                      isMuted ? 'text-accent' : 'text-foreground-muted hover:text-foreground'
                    }`}
                    aria-label={isMuted ? 'Unmute' : 'Mute'}
                    title={isMuted ? 'Unmute' : 'Mute'}
                  >
                    {isMuted ? <VolumeXIcon size={14} /> : <VolumeIcon size={14} />}
                  </button>

                  <input
                    type="range"
                    min="0"
                    max="100"
                    disabled={!isVideoLoaded}
                    value={isMuted ? 0 : volume}
                    onChange={(e) => handleVolumeChange(Number(e.target.value))}
                    className="w-16 h-1.5 accent-accent bg-[#0A0B0E] rounded-full cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                    title={`Volume: ${isMuted ? 0 : volume}%`}
                  />
                </div>

                {/* Fullscreen Button */}
                <button
                  type="button"
                  disabled={!isVideoLoaded}
                  onClick={() => {
                    if (iframeRef.current?.requestFullscreen) {
                      iframeRef.current.requestFullscreen();
                    }
                  }}
                  className="w-8 h-8 rounded-full bg-[#1B1E27] text-foreground-muted flex items-center justify-center disabled:opacity-40 disabled:cursor-not-allowed hover:text-foreground transition-all"
                  aria-label="Fullscreen"
                  title="Fullscreen"
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
                <div className="flex items-center gap-2.5">
                  <h2 className="font-display font-bold text-base text-foreground">Trim your clip</h2>
                  <span className="text-[11px] text-foreground-muted font-mono bg-[#1B1E27] px-2.5 py-0.5 rounded-full border border-border">
                    <span className="text-accent font-bold">I</span> for In · <span className="text-accent font-bold">O</span> for Out · <span className="text-accent font-bold">Space</span> Play/Pause
                  </span>
                </div>
                <p className={`text-xs mt-0.5 ${isFullVideo ? 'text-accent font-medium' : 'text-foreground-muted'}`}>
                  {isFullVideo
                    ? 'Clipping is off. The whole video will be downloaded.'
                    : 'Drag the handles as you watch or press I / O to set In / Out trim points.'}
                </p>
              </div>

              <div className="flex items-center gap-2.5">
                {/* Chapters Popover */}
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

                {/* Duration badge */}
                <span className="px-3 py-1 rounded-full bg-[#1B1E27] text-foreground-subtle text-xs font-mono font-medium">
                  {isFullVideo
                    ? `Full video · ${videoInfo ? videoInfo.durationFormatted : '00:00'}`
                    : `Clip ${secondsToMs(clipDuration)} of ${videoInfo ? videoInfo.durationFormatted : '00:00'}`}
                </span>
              </div>
            </div>

            {/* Filmstrip / Interactive Timeline */}
            <div
              ref={timelineTrackRef}
              onClick={handleTimelineClick}
              className={`relative h-20 rounded-[12px] bg-[#0A0B0E] border ${isFullVideo ? 'border-accent' : 'border-border'} flex flex-col justify-between p-2 select-none overflow-hidden transition-all cursor-pointer`}
            >
              {/* Ruler ticks top */}
              <div className="flex justify-between items-center text-[10px] font-mono text-foreground-muted opacity-60 px-2 pointer-events-none">
                <span>00:00</span>
                <span>{secondsToMs(totalDuration * 0.25)}</span>
                <span>{secondsToMs(totalDuration * 0.5)}</span>
                <span>{secondsToMs(totalDuration * 0.75)}</span>
                <span>{videoInfo ? secondsToMs(totalDuration) : '01:00'}</span>
              </div>

              {/* Central Filmstrip track with selection handles */}
              <div className="relative h-9 rounded-[8px] bg-[#12141A] border border-border-subtle flex items-center justify-center overflow-hidden">
                {isFullVideo ? (
                  <div className="w-full h-full bg-accent/15 border-2 border-accent flex items-center justify-center rounded-[6px]">
                    <span className="text-[11px] font-semibold text-accent">Entire video selected ({videoInfo?.durationFormatted})</span>
                  </div>
                ) : (
                  <div className="relative w-full h-full flex items-center justify-center">
                    {/* Active Trim Selection Range */}
                    <div
                      className="absolute top-0 bottom-0 bg-accent/25 border-y-2 border-accent z-10"
                      style={{
                        left: `${totalDuration > 0 ? (startSec / totalDuration) * 100 : 0}%`,
                        right: `${totalDuration > 0 ? Math.max(0, 100 - (endSec / totalDuration) * 100) : 0}%`
                      }}
                    >
                      {/* Left Handle */}
                      <div
                        onMouseDown={(e) => {
                          e.stopPropagation();
                          e.preventDefault();
                          setDraggingTarget('start');
                        }}
                        className="absolute -left-1.5 top-0 bottom-0 w-3 bg-accent rounded-l cursor-ew-resize hover:scale-110 active:scale-110 transition-transform shadow-md z-30"
                      >
                        <div className="absolute -top-5 left-1/2 -translate-x-1/2 px-1.5 py-0.5 rounded bg-accent text-[#1A0805] text-[9px] font-mono font-bold whitespace-nowrap shadow select-none pointer-events-none">
                          {secondsToMs(startSec)}
                        </div>
                      </div>

                      {/* Right Handle */}
                      <div
                        onMouseDown={(e) => {
                          e.stopPropagation();
                          e.preventDefault();
                          setDraggingTarget('end');
                        }}
                        className="absolute -right-1.5 top-0 bottom-0 w-3 bg-accent rounded-r cursor-ew-resize hover:scale-110 active:scale-110 transition-transform shadow-md z-30"
                      >
                        <div className="absolute -top-5 left-1/2 -translate-x-1/2 px-1.5 py-0.5 rounded bg-accent text-[#1A0805] text-[9px] font-mono font-bold whitespace-nowrap shadow select-none pointer-events-none">
                          {secondsToMs(endSec)}
                        </div>
                      </div>
                    </div>

                    {/* Playhead indicator line */}
                    {totalDuration > 0 && (
                      <div
                        className="absolute top-0 bottom-0 w-0.5 bg-white shadow-xl pointer-events-none z-20"
                        style={{ left: `${(playheadSec / totalDuration) * 100}%` }}
                      >
                        <div
                          onMouseDown={(e) => {
                            e.stopPropagation();
                            e.preventDefault();
                            setDraggingTarget('playhead');
                          }}
                          className="w-3.5 h-3.5 rounded-full bg-white -ml-1.5 -top-1.5 absolute shadow-md cursor-grab active:cursor-grabbing pointer-events-auto hover:scale-125 transition-transform"
                        />
                      </div>
                    )}

                    <span className="text-[11px] text-foreground-muted select-none">
                      {videoInfo ? `Clip selection: ${secondsToMs(clipDuration)}` : 'Timeline filmstrip will render here'}
                    </span>
                  </div>
                )}
              </div>

              {/* Bottom ruler ticks */}
              <div className="flex justify-between items-center text-[9px] font-mono text-foreground-muted opacity-40 px-3 pointer-events-none">
                {Array.from({ length: 15 }).map((_, i) => (
                  <div key={i} className="w-[1px] h-1.5 bg-foreground-muted" />
                ))}
              </div>
            </div>

            {/* Start and End Cards */}
            <div className={`grid grid-cols-2 gap-3 transition-opacity ${isFullVideo ? 'opacity-40 pointer-events-none' : ''}`}>
              {/* START Card */}
              <div className="p-3.5 rounded-[12px] bg-[#0F1116] border border-border flex flex-col gap-2">
                <div className="text-[11px] font-semibold text-foreground-muted tracking-wide flex items-center justify-between">
                  <span>START</span>
                  <span className="text-[10px] text-foreground-muted/70 font-mono">{secondsToMs(startSec)}</span>
                </div>
                <input
                  type="text"
                  value={isFullVideo ? '00:00:00' : startTime}
                  disabled={isFullVideo || !isVideoLoaded}
                  onChange={(e) => handleStartTimeInputChange(e.target.value)}
                  onBlur={handleStartTimeBlur}
                  className="font-mono text-2xl font-bold text-foreground bg-transparent border-0 outline-none p-0 focus:text-accent disabled:opacity-40"
                />
                <div className="flex items-center gap-2 pt-1">
                  <button
                    type="button"
                    disabled={isFullVideo || !isVideoLoaded}
                    onClick={() => handleAdjustTime('start', -1)}
                    className="flex-1 h-8 rounded-[8px] bg-surface border border-border text-foreground-muted text-xs font-medium hover:text-foreground hover:bg-surface-hover transition-colors disabled:opacity-40"
                  >
                    -1s
                  </button>
                  <button
                    type="button"
                    disabled={isFullVideo || !isVideoLoaded}
                    onClick={() => handleAdjustTime('start', 1)}
                    className="flex-1 h-8 rounded-[8px] bg-surface border border-border text-foreground-muted text-xs font-medium hover:text-foreground hover:bg-surface-hover transition-colors disabled:opacity-40"
                  >
                    +1s
                  </button>
                  <button
                    type="button"
                    disabled={isFullVideo || !isVideoLoaded}
                    onClick={() => handleUsePlayhead('start')}
                    className="flex-1 h-8 rounded-[8px] bg-[var(--accent-tint)] text-[var(--accent-tint-text)] border border-accent/20 text-xs font-semibold hover:bg-accent hover:text-[#1A0805] transition-all disabled:opacity-40"
                    title="Set start trim point to playhead (Shortcut: I)"
                  >
                    Use playhead (I)
                  </button>
                </div>
              </div>

              {/* END Card */}
              <div className="p-3.5 rounded-[12px] bg-[#0F1116] border border-border flex flex-col gap-2">
                <div className="text-[11px] font-semibold text-foreground-muted tracking-wide flex items-center justify-between">
                  <span>END</span>
                  <span className="text-[10px] text-foreground-muted/70 font-mono">{secondsToMs(endSec)}</span>
                </div>
                <input
                  type="text"
                  value={isFullVideo && videoInfo ? videoInfo.durationFormatted : endTime}
                  disabled={isFullVideo || !isVideoLoaded}
                  onChange={(e) => handleEndTimeInputChange(e.target.value)}
                  onBlur={handleEndTimeBlur}
                  className="font-mono text-2xl font-bold text-foreground bg-transparent border-0 outline-none p-0 focus:text-accent disabled:opacity-40"
                />
                <div className="flex items-center gap-2 pt-1">
                  <button
                    type="button"
                    disabled={isFullVideo || !isVideoLoaded}
                    onClick={() => handleAdjustTime('end', -1)}
                    className="flex-1 h-8 rounded-[8px] bg-surface border border-border text-foreground-muted text-xs font-medium hover:text-foreground hover:bg-surface-hover transition-colors disabled:opacity-40"
                  >
                    -1s
                  </button>
                  <button
                    type="button"
                    disabled={isFullVideo || !isVideoLoaded}
                    onClick={() => handleAdjustTime('end', 1)}
                    className="flex-1 h-8 rounded-[8px] bg-surface border border-border text-foreground-muted text-xs font-medium hover:text-foreground hover:bg-surface-hover transition-colors disabled:opacity-40"
                  >
                    +1s
                  </button>
                  <button
                    type="button"
                    disabled={isFullVideo || !isVideoLoaded}
                    onClick={() => handleUsePlayhead('end')}
                    className="flex-1 h-8 rounded-[8px] bg-[var(--accent-tint)] text-[var(--accent-tint-text)] border border-accent/20 text-xs font-semibold hover:bg-accent hover:text-[#1A0805] transition-all disabled:opacity-40"
                    title="Set end trim point to playhead (Shortcut: O)"
                  >
                    Use playhead (O)
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
                    className="h-7 px-2.5 rounded-[8px] bg-surface border border-border text-[11px] text-foreground-muted font-medium hover:text-foreground hover:bg-surface-hover hover:border-border-muted transition-all select-none disabled:opacity-40"
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
              onClick={handleAddToQueue}
              className="w-full flex items-center justify-center gap-2"
            >
              <QueueIcon size={18} />
              <span>Add to queue</span>
            </Button>

            <Button
              variant="primary"
              size="lg"
              disabled={!isVideoLoaded}
              onClick={handleDownloadNow}
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
