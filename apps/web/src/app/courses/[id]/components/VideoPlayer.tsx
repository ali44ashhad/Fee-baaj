'use client';

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import Hls, { ManifestLoadedData } from 'hls.js';
import { FaPlay, FaPause, FaVolumeMute, FaExpand } from 'react-icons/fa';
import { IoSettingsOutline } from 'react-icons/io5';
import { FaVolumeLow } from 'react-icons/fa6';
import isEqual from 'lodash/isEqual';
import { useMute } from '@/hooks/MuteContext';
import Skeleton from 'react-loading-skeleton';

interface VideoPlayerProps {
  videoId: string;
  playlistUrl: string;
  videoPopups: {
    id?: string;
    link: string;
    popupDuration?: number;
    triggerAt?: number;
  }[];
  shouldPlay: boolean;
}

type Level = {
  // original hls level index in hls.levels array (or -1 for Auto)
  hlsIndex: number;
  bitrate: number;
  width?: number;
  height?: number;
  name: string;
};

const VideoPlayer: React.FC<VideoPlayerProps> = ({ videoId, videoPopups, playlistUrl, shouldPlay }) => {
  const [loading, setLoading] = useState(true);
  const [isPlaying, setIsPlaying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [levels, setLevels] = useState<Level[]>([]);
  const [currentResolution, setCurrentResolution] = useState('Auto');
  const [showResolutions, setShowResolutions] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const [overlayIcon, setOverlayIcon] = useState<'play' | 'pause' | 'sound' | null>(null);
  const showOverlay = useCallback((icon: 'play' | 'pause' | 'sound') => {
    setOverlayIcon(icon);
    setTimeout(() => setOverlayIcon(null), 500);
  }, []);

  const { muted, toggleMute } = useMute();
  const [showControls, setShowControls] = useState(true);
  const hideTimer = useRef<ReturnType<typeof setTimeout>>();
  const resetHideTimer = useCallback(() => {
    setShowControls(true);
    clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => setShowControls(false), 4000);
  }, []);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const hlsRef = useRef<Hls | null>(null);
  const previousLevelsRef = useRef<Level[]>([]);

  useEffect(() => {
    const vid = videoRef.current;
    if (!vid) return;
    const handleCanPlay = () => setLoading(false);
    const handleWaiting = () => setLoading(true);
    vid.addEventListener('canplay', handleCanPlay);
    vid.addEventListener('waiting', handleWaiting);
    return () => {
      vid.removeEventListener('canplay', handleCanPlay);
      vid.removeEventListener('waiting', handleWaiting);
    };
  }, [playlistUrl]);
  

  const togglePlay = useCallback(
    (e?: React.MouseEvent) => {
      if (e) e.stopPropagation();
      const vid = videoRef.current;
      if (!vid) return;

      if (vid.paused) {
        if (muted) toggleMute();
        vid
          .play()
          .then(() => setIsPlaying(true))
          .catch((err) => {
            console.warn('Play interrupted:', (err as any)?.name || err);
            setIsPlaying(false);
          });
        showOverlay('play');
      } else {
        vid.pause();
        setIsPlaying(false);
        showOverlay('pause');
      }
    },
    [muted, toggleMute, showOverlay],
  );

  // inside VideoPlayer component
  useEffect(() => {
    const el = containerRef.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;

    const obs = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          const v = videoRef.current;
          if (!v) return;

          if (!entry.isIntersecting) {
            // left viewport -> pause if playing
            if (!v.paused) {
              try {
                v.pause();
              } catch {}
              setIsPlaying(false);
            }
          } else {
            // entered viewport -> play (only if parent wants the video to play)
            // this avoids auto-playing videos that the parent intentionally disabled
            if (shouldPlay) {
              if (v.paused) {
                v.play()
                  .then(() => {
                    setIsPlaying(true);
                  })
                  .catch((err) => {
                    // Autoplay can be blocked. If muted, try again silently.
                    // If not muted, attempt to mute then play (best-effort).
                    try {
                      if (!v.muted) v.muted = true;
                    } catch {}
                    v.play()
                      .then(() => setIsPlaying(true))
                      .catch(() => {
                        // ignore failures (user interaction required)
                      });
                  });
              }
            }
          }
        });
      },
      { threshold: 0.6 }, // require ~60% visible to consider "in view"
    );

    obs.observe(el);

    return () => {
      try {
        obs.disconnect();
      } catch {}
    };
  }, [shouldPlay]); // re-evaluate when parent changes shouldPlay

  // Only obey the parent's shouldPlay prop (no global/localStorage autoplay)
  useEffect(() => {
    const vid = videoRef.current;
    if (!vid) return;

    if (shouldPlay) {
      vid
        .play()
        .then(() => setIsPlaying(true))
        .catch((e) => {
          console.warn('Error playing video:', (e as any)?.name || e);
          setIsPlaying(false);
        });
    } else {
      try {
        vid.pause();
      } catch {
        // ignore
      }
      setIsPlaying(false);
    }
  }, [shouldPlay]);

  useEffect(() => {
    const c = containerRef.current!;
    c?.addEventListener('mousemove', resetHideTimer);
    c?.addEventListener('keydown', resetHideTimer);
    resetHideTimer();
    return () => {
      c?.removeEventListener('mousemove', resetHideTimer);
      c?.removeEventListener('keydown', resetHideTimer);
      clearTimeout(hideTimer.current);
    };
  }, [resetHideTimer]);

  const handleToggleMute = useCallback(() => {
    const vid = videoRef.current;
    if (!vid) return;
    if (muted) {
      toggleMute();
      vid
        .play()
        .then(() => setIsPlaying(true))
        .catch(() => {});
      showOverlay('sound');
    } else {
      toggleMute();
    }
  }, [muted, toggleMute, showOverlay]);

  useEffect(() => {
    if (videoRef.current) videoRef.current.muted = muted;
  }, [muted]);

  useEffect(() => {
    const savedTime = localStorage.getItem(`videoProgress-${videoId}`);
    if (savedTime) {
      const parsedTime = parseFloat(savedTime);
      if (!isNaN(parsedTime) && videoRef.current) videoRef.current.currentTime = parsedTime;
    }
  }, [videoId]);

  useEffect(() => {
    const interval = setInterval(() => {
      if (currentTime >= 15) localStorage.setItem(`videoProgress-${videoId}`, currentTime.toString());
    }, 15000);
    return () => clearInterval(interval);
  }, [currentTime, videoId]);

  useEffect(() => {
    return () => {
      if (currentTime >= 15) localStorage.setItem(`videoProgress-${videoId}`, currentTime.toString());
    };
  }, [currentTime, videoId]);

  // HLS attach / manifest parsing
  useEffect(() => {
    let hls: Hls | null = null;

    const destroy = () => {
      if (hls) {
        try {
          hls.stopLoad();
          hls.detachMedia();
          hls.destroy();
        } catch (e) {
          /* ignore */
        }
        hlsRef.current = null;
        hls = null;
      }
      if (videoRef.current) {
        try {
          videoRef.current.pause();
          videoRef.current.src = '';
        } catch (e) {
          /* ignore */
        }
      }
    };

    if (!playlistUrl || !videoRef.current) return;

    // Use hls.js when supported
    if (Hls.isSupported()) {
      hls = new Hls({ lowLatencyMode: true, enableWorker: true });
      hlsRef.current = hls;
      hls.loadSource(playlistUrl);
      hls.attachMedia(videoRef.current);

      const onManifest = (_evt: any, data: ManifestLoadedData) => {
        // Build levels with original hls index -> do not lose the original index mapping
        const rawLevels = data.levels || [];
        // map original levels
        const mapped: Level[] = rawLevels.map((lvl, idx) => {
          const height = typeof lvl.height === 'number' ? lvl.height : undefined;
          const width = typeof lvl.width === 'number' ? lvl.width : undefined;
          const name =
            (height && `${height}p`) ||
            (lvl.bitrate ? `${Math.round((lvl.bitrate || 0) / 1000)} kbps` : `level ${idx}`);
          return { hlsIndex: idx, bitrate: lvl.bitrate || 0, width, height, name };
        });

        // sort descending by height then bitrate
        const sorted = mapped.slice().sort((a, b) => {
          const ah = a.height ?? 0;
          const bh = b.height ?? 0;
          if (bh !== ah) return bh - ah;
          return (b.bitrate || 0) - (a.bitrate || 0);
        });

        // final list: Auto + sorted levels
        const finalLevels: Level[] = [{ hlsIndex: -1, bitrate: 0, name: 'Auto' }, ...sorted];

        if (!isEqual(previousLevelsRef.current, finalLevels)) {
          previousLevelsRef.current = finalLevels;
          setLevels(finalLevels);
        }

        // default to Auto mode (let hls adapt)
        if (hls) {
          hls.currentLevel = -1; // auto
          try {
            hls.autoLevelEnabled = true;
          } catch {
            // older hls versions may not have the setter
          }
        }
        setCurrentResolution('Auto');
      };

      const onLevelSwitched = (_evt: any, data: any) => {
        const lvlIdx = data.level;
        // guard
        if (!hls) return;
        const lvl = hls.levels && hls.levels[lvlIdx];
        if (lvl) {
          const name =
            typeof lvl.height === 'number'
              ? `${lvl.height}p`
              : lvl.name || `${Math.round((lvl.bitrate || 0) / 1000)} kbps`;
          setCurrentResolution(name);
        } else {
          // no explicit level (maybe auto) -> attempt to read from hls.nextLevel or show 'Auto'
          setCurrentResolution(hls.autoLevelEnabled ? 'Auto' : 'Unknown');
        }
      };

      const onError = (_evt: any, data: any) => {
        if (data && data.fatal) {
          destroy();
          setError('Fatal playback error');
        }
      };

      hls.on(Hls.Events.MANIFEST_LOADED, onManifest);
      hls.on(Hls.Events.LEVEL_SWITCHED, onLevelSwitched);
      hls.on(Hls.Events.ERROR, onError);
    } else if (videoRef.current.canPlayType('application/vnd.apple.mpegurl')) {
      // native HLS (mobile Safari). set video src and let browser handle
      try {
        videoRef.current.src = playlistUrl;
      } catch (e) {
        console.warn('native HLS attach failed', e);
      }
      // levels UI won't be available with native HLS (can't enumerate levels)
      setLevels([{ hlsIndex: -1, bitrate: 0, name: 'Auto' }]);
      setCurrentResolution('Auto');
    } else {
      setError('HLS not supported in this browser');
    }

    return () => {
      destroy();
      setLevels([]);
      setCurrentResolution('Auto');
      setError(null);
    };
    // we intentionally only re-run when playlistUrl changes
  }, [playlistUrl]);

  // meta/timeupdate/ended handlers
  useEffect(() => {
    const vid = videoRef.current;
    if (!vid) return;

    const handlePlay = () => setIsPlaying(true);
    const handlePause = () => setIsPlaying(false);
    const onMeta = () => setDuration(isFinite(vid.duration) ? vid.duration : 0);
    const onTime = () => {
      setCurrentTime(vid.currentTime);
      setDuration(isFinite(vid.duration) ? vid.duration : 0);
    };
    const onEnd = () => {
      setCurrentTime(vid.duration || 0);
      setIsPlaying(false);
    };

    vid.addEventListener('play', handlePlay);
    vid.addEventListener('pause', handlePause);
    vid.addEventListener('loadedmetadata', onMeta);
    vid.addEventListener('timeupdate', onTime);
    vid.addEventListener('ended', onEnd);

    return () => {
      vid.removeEventListener('play', handlePlay);
      vid.removeEventListener('pause', handlePause);
      vid.removeEventListener('loadedmetadata', onMeta);
      vid.removeEventListener('timeupdate', onTime);
      vid.removeEventListener('ended', onEnd);
    };
  }, []);

  useEffect(() => {
    const fn = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', fn);
    return () => document.removeEventListener('fullscreenchange', fn);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const vid = videoRef.current;
      if (!vid) return;
      switch (e.key) {
        case ' ':
          e.preventDefault();
          togglePlay();
          break;
        case 'm':
          handleToggleMute();
          break;
        case 'ArrowRight':
          vid.currentTime = Math.min(vid.currentTime + 5, duration);
          break;
        case 'ArrowLeft':
          vid.currentTime = Math.max(vid.currentTime - 5, 0);
          break;
        case 'Home':
          vid.currentTime = 0;
          break;
        case 'End':
          vid.currentTime = duration;
          break;
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [togglePlay, handleToggleMute, duration]);

  // resolution switcher: match selected Level to correct hls level index
  const changeResolution = useCallback((level: Level) => {
    const hls = hlsRef.current;
    setShowResolutions(false);

    if (!hls) {
      // native HLS -> nothing to do, just set label
      setCurrentResolution(level.name);
      return;
    }

    if (level.hlsIndex === -1) {
      // Auto
      try {
        hls.autoLevelEnabled = true;
      } catch {
        // some versions: set currentLevel = -1
        hls.currentLevel = -1;
      }
      hls.currentLevel = -1;
      setCurrentResolution('Auto');
      return;
    }

    // Try to find a matching index in hls.levels (based on height/width/bitrate)
    const found = hls.levels.findIndex((lvl) => {
      const height = typeof lvl.height === 'number' ? lvl.height : undefined;
      const width = typeof lvl.width === 'number' ? lvl.width : undefined;
      const bitrate = lvl.bitrate || 0;

      // strong match: height & bitrate match
      if (level.height && height && level.height === height) return true;
      // fallback: bitrate match
      if (level.bitrate && bitrate && Math.abs(level.bitrate - bitrate) <= 1000) return true;
      return false;
    });

    // If not found by heuristics, fallback to the provided hlsIndex (should be valid)
    const targetIndex = found >= 0 ? found : level.hlsIndex;

    try {
      hls.autoLevelEnabled = false;
    } catch {
      // ignore
    }
    hls.currentLevel = targetIndex;
    // update UI label
    setCurrentResolution(level.name);
  }, []);

  const handleTimeChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const t = parseFloat(e.target.value);
      const clamped = Math.max(0, Math.min(t, duration));
      setCurrentTime(clamped);
      if (videoRef.current) videoRef.current.currentTime = clamped;
    },
    [duration],
  );

  const toggleFullscreen = useCallback(() => {
    const vidEl = videoRef.current as any;
    const container = containerRef.current as any;
    const doc = document as any;
    if (vidEl && typeof vidEl.webkitEnterFullscreen === 'function') {
      if (!vidEl.webkitDisplayingFullscreen) {
        vidEl.webkitEnterFullscreen();
      } else if (typeof vidEl.webkitExitFullscreen === 'function') {
        vidEl.webkitExitFullscreen();
      }
      return;
    }
    if (!doc.fullscreenElement) {
      if (container.requestFullscreen) container.requestFullscreen().catch(console.error);
    } else {
      if (doc.exitFullscreen) doc.exitFullscreen().catch(console.error);
    }
  }, []);

  const trackBackground = useMemo(
    () => ({
      background: `linear-gradient(to right, #FF0000 ${duration > 0 ? Math.min(100, (currentTime / duration) * 100) : 0}%, #464646 ${
        duration > 0 ? Math.min(100, (currentTime / duration) * 100) : 0
      }%)`,
    }),
    [currentTime, duration],
  );

  const preventRightClick = useCallback((e: React.MouseEvent) => e.preventDefault(), []);

  const activePopup = videoPopups.find((p) => {
    const at = p.triggerAt ?? 0;
    const dur = p.popupDuration ?? 5;
    return currentTime >= at && currentTime <= at + dur;
  });

  return (
    <div
      ref={containerRef}
      onContextMenu={preventRightClick}
      tabIndex={0}
      className="relative h-full w-full max-w-full mx-auto"
    >
      <div
        className={`relative ${!isFullscreen ? 'h-full min-h-[200px]' : 'h-auto'} w-full overflow-hidden`}
        style={{ minHeight: '200px' }}
      >
        {loading && (
          <div
            className={`absolute inset-0 transition-opacity duration-300 ${
              loading ? 'opacity-100' : 'opacity-0 pointer-events-none'
            }`}
          >
            <Skeleton className="w-full h-full" />
          </div>
        )}

        {/* For hls.js we do NOT set src attribute — hls.attachMedia() will handle it.
            For native HLS we set src so the browser plays it. */}
        <video
          ref={videoRef}
          // @ts-ignore conditional src; when Hls is used we leave src empty
          {...(Hls.isSupported() ? {} : { src: playlistUrl })}
          muted={muted}
          controls={false}
          onContextMenu={preventRightClick}
          className={`${isFullscreen ? 'w-full h-screen object-contain' : 'w-full object-cover h-full'} ${loading ? 'opacity-0' : 'opacity-100'} bg-black`}
          playsInline
          onClick={togglePlay}
          preload="auto"
          autoPlay={shouldPlay}
          onDoubleClick={toggleFullscreen}
        />

        {/* SEEK BAR */}
        <div
          className={`flex items-center absolute bottom-10 left-0 w-full text-white justify-between transition-opacity duration-300 ${showControls ? 'opacity-100' : 'opacity-0'} space-x-1`}
        >
          <input
            type="range"
            min={0}
            max={isNaN(duration) ? 0 : duration}
            step="any"
            value={isNaN(currentTime) ? 0 : currentTime}
            onChange={(e) => {
              const t = parseFloat(e.target.value);
              setCurrentTime(t);
              videoRef.current!.currentTime = t;
            }}
            style={trackBackground}
          />
        </div>

        {/* CONTROLS */}
        <div
          className={`absolute bottom-0 left-0 w-full bg-black/10 text-white p-1 flex items-center justify-between transition-opacity duration-300 ${showControls ? 'opacity-100' : 'opacity-0'}`}
        >
          <div className="flex items-center gap-2">
            <button onClick={togglePlay} className="p-2 text-xl">
              {isPlaying ? <FaPause size={17} /> : <FaPlay size={17} />}
            </button>
            <button onClick={handleToggleMute} className="p-2 text-xl">
              {muted ? <FaVolumeMute size={19} /> : <FaVolumeLow size={19} />}
            </button>
            <div>
              <span style={{ fontSize: '12px' }}>{`${Math.floor(currentTime / 60)}:${Math.floor(currentTime % 60)
                .toString()
                .padStart(2, '0')}`}</span>{' '}
              :{' '}
              <span style={{ fontSize: '12px' }}>{`${Math.floor(duration / 60)}:${Math.floor(duration % 60)
                .toString()
                .padStart(2, '0')}`}</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative">
              <button onClick={() => setShowResolutions((s) => !s)} className="p-2 text-xl">
                <IoSettingsOutline size={19} />
              </button>

              {showResolutions && (
                <div className="absolute bottom-[70%] right-0 bg-black/70 shadow-lg rounded-md py-1 min-w-[70px] z-50 flex flex-col">
                  {levels.map((level) => (
                    <button
                      key={level.hlsIndex + '-' + level.name}
                      onClick={() => changeResolution(level)}
                      className={`block w-full px-3 py-1 text-sm hover:bg-white/20 ${currentResolution === level.name ? 'font-bold bg-white/10' : ''}`}
                    >
                      {level.name}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <button onClick={toggleFullscreen} className="p-2 text-xl">
              <FaExpand size={19} />
            </button>
          </div>
        </div>
      </div>

      {/* Overlays */}
      <div className="youtube-overlay">
        {overlayIcon === 'play' && (
          <img src="/play.svg" alt="Play" className="youtube-overlay__icon" onClick={togglePlay} />
        )}
        {overlayIcon === 'pause' && (
          <img src="/pause.svg" alt="Pause" className="youtube-overlay__icon" onClick={togglePlay} />
        )}
      </div>

      {isPlaying && muted && (
        <div className="absolute top-[45%] z-[6999] left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-center text-white p-4 rounded-full">
          <button onClick={handleToggleMute}>
            <FaVolumeMute size={35} />
          </button>
          <p className="whitespace-nowrap">Sound On করুন</p>
        </div>
      )}

      {activePopup && (
        <div
          className={
            isFullscreen
              ? 'absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-[60%] text-center p-4'
              : 'absolute top-[5vh] bottom-20 left-0 w-full p-4 text-center'
          }
        >
          <img src="/alam.png" width={90} height={90} alt="ALAM" className="mx-auto" />
          <a href={activePopup.link} target="_blank" rel="noopener noreferrer">
            <div
              style={{ backgroundColor: '#FF0000', borderRadius: 3 }}
              className="px-3 py-1 mt-3 text-white w-[70%] mx-auto font-semibold shadow-md hover:bg-red-600 transition"
            >
              Join Live Course
            </div>
          </a>
        </div>
      )}

      {/* optional error UI */}
      {error && (
        <div className="absolute inset-0 z-[10000] flex items-center justify-center text-white bg-black/60">
          <div className="bg-white/5 p-3 rounded">{error}</div>
        </div>
      )}
    </div>
  );
};

export default VideoPlayer;
