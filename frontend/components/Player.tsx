/* eslint-disable jsx-a11y/media-has-caption */
"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import Hls from "hls.js";

type PlayerSource = {
  url: string;
  isHls?: boolean;
};

type ProgressPayload = {
  positionSeconds: number;
  durationSeconds: number;
  isFinished: boolean;
};

type QualityOption = {
  id: string;
  label: string;
  value: string | null;
};

type PlayerProps = {
  source: PlayerSource;
  title?: string;
  episodeLabel?: string;
  initialTimeSeconds?: number;
  audioLanguages?: {
    id: string;
    label: string;
    code?: string | null;
    isDefault?: boolean;
  }[];
  languageOptions?: { id: string; label: string }[];
  currentLanguageId?: string | null;
  onChangeLanguage?: (languageId: string) => void;
  onProgress?: (payload: ProgressPayload) => void;
  onEnded?: () => void;
  onError?: (error: Error) => void;
  qualityOptions?: QualityOption[];
  currentQualityId?: string | null;
  onChangeQuality?: (qualityId: string | null) => void;
  introEndSeconds?: number;
  nextEpisodeHref?: string;
  nextEpisodeLabel?: string;
};

const PROGRESS_INTERVAL_MS = 15000;

export function Player({
  source,
  title,
  episodeLabel,
  initialTimeSeconds,
  audioLanguages,
  languageOptions,
  currentLanguageId,
  onChangeLanguage,
  onProgress,
  onEnded,
  onError,
  qualityOptions,
  currentQualityId,
  onChangeQuality,
  introEndSeconds,
  nextEpisodeHref,
  nextEpisodeLabel
}: PlayerProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const hlsRef = useRef<Hls | null>(null);

  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isBuffering, setIsBuffering] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [volume, setVolume] = useState(1);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [controlsVisible, setControlsVisible] = useState(true);
  const [isScrubbing, setIsScrubbing] = useState(false);
  const [scrubPercent, setScrubPercent] = useState(0);
  const [showSkipIntro, setShowSkipIntro] = useState(false);
  const [hasSkippedIntro, setHasSkippedIntro] = useState(false);
  const [subtitleTracks, setSubtitleTracks] = useState<
    { id: number; name: string }[]
  >([]);
  const [currentSubtitleId, setCurrentSubtitleId] = useState<number | null>(null);
  const [audioTracks, setAudioTracks] = useState<{ id: number; name: string }[]>(
    []
  );
  const [currentAudioId, setCurrentAudioId] = useState<number | null>(null);
  const [hasEnded, setHasEnded] = useState(false);
  const [selectedAudioLanguageId, setSelectedAudioLanguageId] = useState<string | null>(
    () =>
      audioLanguages && audioLanguages.length > 0
        ? audioLanguages.find((lang) => lang.isDefault)?.id ?? audioLanguages[0]?.id
        : null
  );

  // Setup media source (HLS or direct)
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    // Cleanup any existing instance
    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }

    const isHls = source.isHls ?? source.url.includes(".m3u8");

    if (isHls && Hls.isSupported()) {
      const hls = new Hls();
      hlsRef.current = hls;
      hls.loadSource(source.url);
      hls.attachMedia(video);

      hls.on(Hls.Events.ERROR, (_event, data) => {
        if (data.fatal) {
          const err = new Error(data.error?.message || "Fatal HLS error");
          onError?.(err);
        }
      });

      hls.on(Hls.Events.SUBTITLE_TRACKS_UPDATED, (_event, data: any) => {
        const tracks = (data.subtitleTracks || []).map(
          (track: any, index: number) => ({
            id: index,
            name: track.name || track.lang || `Track ${index + 1}`
          })
        );
        setSubtitleTracks(tracks);

        if (tracks.length === 0) {
          setCurrentSubtitleId(null);
          const anyHls = hls as any;
          anyHls.subtitleTrack = -1;
          return;
        }

        // Default subtitles: on for Japanese audio, off for English.
        const defaultId = currentLanguageId === "ja" ? 0 : -1;
        setCurrentSubtitleId(defaultId);
        const anyHls = hls as any;
        anyHls.subtitleTrack = defaultId;
      });

      hls.on(Hls.Events.SUBTITLE_TRACK_SWITCH, (_event, data: any) => {
        setCurrentSubtitleId(typeof data.id === "number" ? data.id : null);
      });

      hls.on(Hls.Events.AUDIO_TRACKS_UPDATED, (_event, data: any) => {
        const tracks = (data.audioTracks || []).map(
          (track: any, index: number) => ({
            id: index,
            name: track.name || track.lang || `Track ${index + 1}`
          })
        );
        setAudioTracks(tracks);
        if (tracks.length === 0) {
          setCurrentAudioId(null);
          return;
        }

        // When we have a persisted audio language preference, try to pick a
        // track whose language matches; otherwise fall back to the first track.
        const preferred = audioLanguages?.find((lang) => lang.id === selectedAudioLanguageId);
        if (preferred && preferred.code) {
          const matchByCode = (data.audioTracks || []).findIndex(
            (track: any) => track.lang === preferred.code || track.name === preferred.code
          );
          if (matchByCode >= 0) {
            const anyHls = hls as any;
            anyHls.audioTrack = matchByCode;
            setCurrentAudioId(matchByCode);
            return;
          }
        }

        setCurrentAudioId(0);
      });

      hls.on(Hls.Events.AUDIO_TRACK_SWITCHED, (_event, data: any) => {
        setCurrentAudioId(typeof data.id === "number" ? data.id : null);
      });
    } else {
      video.src = source.url;
    }

    const handleLoadedMetadata = () => {
      setDuration(video.duration || 0);
      if (
        initialTimeSeconds &&
        initialTimeSeconds > 0 &&
        (!video.duration || initialTimeSeconds < video.duration)
      ) {
        video.currentTime = initialTimeSeconds;
        setCurrentTime(initialTimeSeconds);
      }
    };

    const handleTimeUpdate = () => {
      if (!isScrubbing) {
        const t = video.currentTime || 0;
        setCurrentTime(t);

        if (
          !hasSkippedIntro &&
          introEndSeconds &&
          video.duration &&
          video.duration > 600 &&
          t > 5 &&
          t < introEndSeconds
        ) {
          setShowSkipIntro(true);
        } else if (t >= (introEndSeconds ?? 0)) {
          setShowSkipIntro(false);
        }
      }
    };

    const handlePlaying = () => {
      setIsPlaying(true);
      setIsBuffering(false);
    };

    const handlePause = () => {
      setIsPlaying(false);
    };

    const handleWaiting = () => {
      setIsBuffering(true);
    };

      const handleEnded = () => {
        setIsPlaying(false);
        setIsBuffering(false);
        setCurrentTime(video.duration || 0);
        setHasEnded(true);
        onProgress?.({
          positionSeconds: video.duration || 0,
          durationSeconds: video.duration || 0,
          isFinished: true
        });
        onEnded?.();
      };

    video.addEventListener("loadedmetadata", handleLoadedMetadata);
    video.addEventListener("timeupdate", handleTimeUpdate);
    video.addEventListener("playing", handlePlaying);
    video.addEventListener("pause", handlePause);
    video.addEventListener("waiting", handleWaiting);
    video.addEventListener("ended", handleEnded);

    // Try to autoplay; if blocked, leave paused state
    void video
      .play()
      .then(() => setIsPlaying(true))
      .catch(() => {
        setIsPlaying(false);
      });

    return () => {
      video.removeEventListener("loadedmetadata", handleLoadedMetadata);
      video.removeEventListener("timeupdate", handleTimeUpdate);
      video.removeEventListener("playing", handlePlaying);
      video.removeEventListener("pause", handlePause);
      video.removeEventListener("waiting", handleWaiting);
      video.removeEventListener("ended", handleEnded);
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
    };
  }, [
    source.url,
    source.isHls,
    initialTimeSeconds,
    introEndSeconds,
    isScrubbing,
    hasSkippedIntro,
    onEnded,
    onError,
    onProgress,
    currentLanguageId
  ]);

  // Apply late-arriving initialTimeSeconds (e.g. resume from "Continue watching")
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    if (!initialTimeSeconds || initialTimeSeconds <= 0) return;

    const durationSeconds = video.duration || duration;
    if (durationSeconds && initialTimeSeconds >= durationSeconds) {
      return;
    }

    // Only seek if we are still near the beginning, so we do not fight user scrubbing.
    if (video.currentTime < 1) {
      video.currentTime = initialTimeSeconds;
      setCurrentTime(initialTimeSeconds);
    }
  }, [initialTimeSeconds, duration]);

  // Periodic progress reporting
  useEffect(() => {
    if (!onProgress) return;

    const video = videoRef.current;
    if (!video) return;

    const id = window.setInterval(() => {
      if (!video.duration) return;
      onProgress({
        positionSeconds: video.currentTime,
        durationSeconds: video.duration,
        isFinished: false
      });
    }, PROGRESS_INTERVAL_MS);

    return () => window.clearInterval(id);
  }, [onProgress, source.url]);

  // Auto-hide controls when playing
  useEffect(() => {
    if (!isPlaying) {
      setControlsVisible(true);
      return;
    }

    let timeout: number | null = null;

    const resetTimer = () => {
      setControlsVisible(true);
      if (timeout !== null) {
        window.clearTimeout(timeout);
      }
      timeout = window.setTimeout(() => {
        setControlsVisible(false);
      }, 2500);
    };

    resetTimer();

    const el = containerRef.current;
    if (el) {
      el.addEventListener("mousemove", resetTimer);
      el.addEventListener("touchstart", resetTimer);
    }

    return () => {
      if (timeout !== null) {
        window.clearTimeout(timeout);
      }
      if (el) {
        el.removeEventListener("mousemove", resetTimer);
        el.removeEventListener("touchstart", resetTimer);
      }
    };
  }, [isPlaying]);

  // Fullscreen tracking
  useEffect(() => {
    const handleFullscreenChange = () => {
      const fsElement =
        document.fullscreenElement ||
        // @ts-expect-error vendor-prefixed fullscreen element
        document.webkitFullscreenElement;
      setIsFullscreen(!!fsElement);
    };

    document.addEventListener("fullscreenchange", handleFullscreenChange);
    // @ts-expect-error vendor-prefixed event
    document.addEventListener("webkitfullscreenchange", handleFullscreenChange);

    return () => {
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
      // @ts-expect-error vendor-prefixed event
      document.removeEventListener("webkitfullscreenchange", handleFullscreenChange);
    };
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable)
      ) {
        return;
      }

      if (event.key === " " || event.key === "k") {
        event.preventDefault();
        togglePlay();
      } else if (event.key === "ArrowLeft") {
        event.preventDefault();
        seekRelative(-10);
      } else if (event.key === "ArrowRight") {
        event.preventDefault();
        seekRelative(10);
      } else if (event.key === "ArrowUp") {
        event.preventDefault();
        changeVolume(0.1);
      } else if (event.key === "ArrowDown") {
        event.preventDefault();
        changeVolume(-0.1);
      } else if (event.key === "f") {
        event.preventDefault();
        toggleFullscreen();
      } else if (event.key === "m") {
        event.preventDefault();
        toggleMute();
      }
    };

    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  });

  const togglePlay = () => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) {
      void video.play();
      setIsPlaying(true);
    } else {
      video.pause();
      setIsPlaying(false);
    }
  };

  const toggleMute = () => {
    const video = videoRef.current;
    if (!video) return;
    const next = !video.muted;
    video.muted = next;
    setIsMuted(next);
  };

  const changeVolume = (delta: number) => {
    const video = videoRef.current;
    if (!video) return;
    const next = Math.min(1, Math.max(0, video.volume + delta));
    video.volume = next;
    setVolume(next);
    if (next === 0) {
      video.muted = true;
      setIsMuted(true);
    } else if (video.muted) {
      video.muted = false;
      setIsMuted(false);
    }
  };

  const handleVolumeChange = (value: number) => {
    const video = videoRef.current;
    if (!video) return;
    const vol = value / 100;
    video.volume = vol;
    video.muted = vol === 0;
    setVolume(vol);
    setIsMuted(vol === 0);
  };

  const seekRelative = (deltaSeconds: number) => {
    const video = videoRef.current;
    if (!video || !video.duration) return;
    const next = Math.min(video.duration, Math.max(0, video.currentTime + deltaSeconds));
    video.currentTime = next;
    setCurrentTime(next);
  };

  const handleSeekStart = () => {
    setIsScrubbing(true);
  };

  const handleSeekCommit = (percent: number) => {
    const video = videoRef.current;
    if (!video || !duration) return;
    const t = (percent / 100) * duration;
    video.currentTime = t;
    setCurrentTime(t);
    if (introEndSeconds && t >= introEndSeconds) {
      setShowSkipIntro(false);
      setHasSkippedIntro(true);
    }
    setIsScrubbing(false);
  };

  const toggleFullscreen = () => {
    const container = containerRef.current;
    if (!container) return;

    const isFs =
      document.fullscreenElement ||
      // @ts-expect-error vendor-prefixed fullscreen element
      document.webkitFullscreenElement;

    if (isFs) {
      if (document.exitFullscreen) {
        void document.exitFullscreen();
        // @ts-expect-error vendor-prefixed exit
      } else if (document.webkitExitFullscreen) {
        // @ts-expect-error vendor-prefixed exit
        void document.webkitExitFullscreen();
      }
    } else {
      if (container.requestFullscreen) {
        void container.requestFullscreen();
        // @ts-expect-error vendor-prefixed request
      } else if (container.webkitRequestFullscreen) {
        // @ts-expect-error vendor-prefixed request
        void container.webkitRequestFullscreen();
      }
    }
  };

  const togglePictureInPicture = async () => {
    const video = videoRef.current;
    if (!video) return;

    try {
      // @ts-expect-error Picture-in-Picture API
      if (document.pictureInPictureElement) {
        // @ts-expect-error Picture-in-Picture API
        await document.exitPictureInPicture();
        // @ts-expect-error Picture-in-Picture API
      } else if (document.pictureInPictureEnabled && !video.disablePictureInPicture) {
        // @ts-expect-error Picture-in-Picture API
        await video.requestPictureInPicture();
      }
    } catch (err) {
      if (err instanceof Error) {
        onError?.(err);
      }
    }
  };

  const formatTime = (seconds: number) => {
    if (!Number.isFinite(seconds)) return "0:00";
    const s = Math.floor(seconds);
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    const padded = `${m.toString().padStart(1, "0")}:${sec.toString().padStart(2, "0")}`;
    if (h > 0) {
      return `${h.toString()}:${m.toString().padStart(2, "0")}:${sec
        .toString()
        .padStart(2, "0")}`;
    }
    return padded;
  };

  const progressPercent = duration ? (currentTime / duration) * 100 : 0;
  const effectivePercent = isScrubbing ? scrubPercent : progressPercent;

  const formatAudioLabel = () => {
    if (languageOptions && languageOptions.length > 0) {
      const current =
        languageOptions.find((lang) => lang.id === currentLanguageId) ??
        languageOptions[0];
      return current.label;
    }
    return "Audio";
  };

  return (
    <div
      ref={containerRef}
      className="relative flex h-full w-full flex-col bg-black text-white"
      onClick={(event) => {
        // Only toggle play when clicking on the background, not on controls
        if ((event.target as HTMLElement).tagName === "VIDEO") {
          togglePlay();
        }
      }}
    >
      <video
        ref={videoRef}
        className="h-full w-full bg-black object-contain"
        playsInline
        controls={false}
      />

      {/* Gradient overlays */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-black/80 via-black/30 to-transparent sm:h-40" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-black/80 via-black/30 to-transparent sm:h-40" />

      {/* Top metadata bar */}
      {controlsVisible && (
        <div className="pointer-events-auto absolute inset-x-0 top-0 flex items-start justify-between px-4 sm:px-8 pt-4 text-sm">
          <div className="space-y-1">
            {episodeLabel && (
              <p className="text-[0.7rem] uppercase tracking-wide text-neutral-300">
                {episodeLabel}
              </p>
            )}
            {title && (
              <p className="max-w-md text-base font-semibold sm:text-lg">{title}</p>
            )}
          </div>
        </div>
      )}

      {/* Center play/pause indicator */}
      {controlsVisible && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          {!isPlaying && (
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-black/60 text-2xl font-semibold shadow-lg">
              ▶
            </div>
          )}
          {isBuffering && isPlaying && (
            <div className="flex h-10 w-10 items-center justify-center rounded-full border-2 border-white/60 border-t-transparent text-sm">
              <span className="sr-only">Buffering</span>
            </div>
          )}
        </div>
      )}

      {/* Skip intro */}
      {showSkipIntro && !hasSkippedIntro && introEndSeconds && (
        <div className="pointer-events-auto absolute bottom-28 right-6">
          <button
            type="button"
            onClick={() => {
              const video = videoRef.current;
              if (!video || !duration) return;
              const target = Math.min(duration, introEndSeconds);
              video.currentTime = target;
              setCurrentTime(target);
              setShowSkipIntro(false);
              setHasSkippedIntro(true);
            }}
            className="rounded bg-white px-4 py-2 text-xs font-semibold text-black shadow-lg hover:bg-neutral-200"
          >
            Skip intro
          </button>
        </div>
      )}

      {/* Next episode overlay */}
      {hasEnded && nextEpisodeHref && (
        <div className="pointer-events-auto absolute inset-0 flex items-center justify-end px-6 pb-10">
          <div className="max-w-xs rounded-lg bg-black/80 p-4 text-sm shadow-xl backdrop-blur">
            <p className="text-xs text-neutral-300">Up next</p>
            {nextEpisodeLabel && (
              <p className="mt-1 text-sm font-semibold text-white">
                {nextEpisodeLabel}
              </p>
            )}
            <div className="mt-3 flex gap-2">
              <Link
                href={nextEpisodeHref}
                className="inline-flex flex-1 items-center justify-center rounded bg-white px-3 py-1.5 text-xs font-semibold text-black hover:bg-neutral-200"
              >
                Play next episode
              </Link>
              <button
                type="button"
                onClick={() => setHasEnded(false)}
                className="rounded bg-neutral-900 px-3 py-1.5 text-xs text-neutral-200 hover:bg-neutral-800"
              >
                Stay
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bottom controls */}
      {controlsVisible && (
        <div className="pointer-events-auto absolute inset-x-0 bottom-0 px-3 pb-3 pt-2 sm:px-8 sm:pb-6">
          <div className="space-y-2 rounded-lg bg-gradient-to-t from-black/95 via-black/75 to-transparent p-2.5 sm:p-3 backdrop-blur-md">
            {/* Seek bar */}
            <div className="flex items-center gap-3">
              <input
                type="range"
                min={0}
                max={100}
                value={effectivePercent}
                onChange={(event) => {
                  const val = Number(event.target.value);
                  setScrubPercent(val);
                }}
                onMouseDown={handleSeekStart}
                onMouseUp={(event) => {
                  const val = Number((event.target as HTMLInputElement).value);
                  handleSeekCommit(val);
                }}
                onTouchStart={handleSeekStart}
                onTouchEnd={(event) => {
                  const val = Number((event.target as HTMLInputElement).value);
                  handleSeekCommit(val);
                }}
                className="w-full accent-cyan"
              />
            </div>

            {/* Main controls row */}
            <div className="flex flex-wrap items-center gap-3 text-xs sm:text-sm">
              {/* Left controls */}
              <div className="flex items-center gap-2 sm:gap-3">
                <button
                  type="button"
                  onClick={() => seekRelative(-10)}
                  aria-label="Rewind 10 seconds"
                  className="hidden h-8 w-8 items-center justify-center rounded-full bg-white/10 text-[0.7rem] hover:bg-white/20 sm:flex"
                >
                  -10
                </button>
                <button
                  type="button"
                  onClick={togglePlay}
                  aria-label={isPlaying ? "Pause" : "Play"}
                  className="flex h-9 w-9 items-center justify-center rounded-full bg-white text-black text-sm font-semibold hover:bg-neutral-200"
                >
                  {isPlaying ? (
                    <span className="flex gap-0.5">
                      <span className="h-4 w-[3px] bg-black" />
                      <span className="h-4 w-[3px] bg-black" />
                    </span>
                  ) : (
                    "▶"
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => seekRelative(10)}
                  aria-label="Forward 10 seconds"
                  className="hidden h-8 w-8 items-center justify-center rounded-full bg-white/10 text-[0.7rem] hover:bg-white/20 sm:flex"
                >
                  +10
                </button>

                <div className="flex items-center gap-1 text-[0.7rem] tabular-nums text-neutral-300 sm:text-xs">
                  <span>{formatTime(currentTime)}</span>
                  <span className="text-neutral-500">/</span>
                  <span>{formatTime(duration)}</span>
                </div>
              </div>

              {/* Center spacer */}
              <div className="flex-1" />

              {/* Volume */}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={toggleMute}
                  aria-label={isMuted ? "Unmute" : "Mute"}
                  className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10 hover:bg-white/20"
                >
                  {isMuted || volume === 0 ? "🔇" : volume < 0.5 ? "🔈" : "🔊"}
                </button>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={Math.round(volume * 100)}
                  onChange={(event) => handleVolumeChange(Number(event.target.value))}
                  className="hidden w-20 accent-cyan sm:block"
                  aria-label="Volume"
                />
              </div>

              {/* Quality & language cluster */}
              <div className="flex items-center gap-2">
                {qualityOptions && qualityOptions.length > 0 && (
                  <div className="relative">
                    <select
                      className="rounded bg-white/10 px-2 py-1 text-[0.7rem] text-white hover:bg-white/20"
                      value={currentQualityId ?? ""}
                      onChange={(event) => {
                        const val = event.target.value || null;
                        onChangeQuality?.(val);
                      }}
                      aria-label="Quality"
                      title="Video quality"
                    >
                      {qualityOptions.map((opt) => (
                        <option key={opt.id} value={opt.id}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {(subtitleTracks.length > 0 ||
                  (languageOptions && languageOptions.length > 0)) && (
                  <div className="flex items-center gap-1">
                    {subtitleTracks.length > 0 && (
                      <div className="relative">
                        <select
                          className="rounded bg-white/10 px-2 py-1 text-[0.7rem] text-white hover:bg-white/20"
                          value={currentSubtitleId ?? -1}
                          onChange={(event) => {
                            const id = Number(event.target.value);
                            const hls = hlsRef.current as any;
                            if (!hls) return;
                            hls.subtitleTrack = id;
                            setCurrentSubtitleId(id);
                          }}
                          aria-label="Subtitles"
                          title="Subtitles"
                        >
                          <option value={-1}>Subtitles: Off</option>
                          {subtitleTracks.map((track) => (
                            <option key={track.id} value={track.id}>
                              {track.name}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}

                    {languageOptions && languageOptions.length > 0 && onChangeLanguage && (
                      <div className="relative">
                        <select
                          className="rounded bg-white/10 px-2 py-1 text-[0.7rem] text-white hover:bg-white/20"
                          value={currentLanguageId ?? languageOptions[0]?.id ?? ""}
                          onChange={(event) => {
                            const next = event.target.value;
                            setSelectedAudioLanguageId(next);
                            onChangeLanguage(next);
                          }}
                          aria-label="Audio language"
                          title={formatAudioLabel()}
                        >
                          {languageOptions.map((opt) => (
                            <option key={opt.id} value={opt.id}>
                              {opt.label}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Utility buttons */}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={togglePictureInPicture}
                  className="hidden h-8 w-8 items-center justify-center rounded-full bg-white/10 text-[0.7rem] hover:bg-white/20 sm:flex"
                  aria-label="Picture in picture"
                >
                  PiP
                </button>
                <button
                  type="button"
                  onClick={toggleFullscreen}
                  className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-[0.7rem] hover:bg-white/20"
                  aria-label={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
                >
                  {isFullscreen ? "⤢" : "⤢"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

