"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useCallback, Fragment, ReactNode } from "react";
import Hls from "hls.js";
import { Listbox, Transition } from "@headlessui/react";
import {
    ArrowLeft,
    Play,
    Pause,
    RotateCcw,
    RotateCw,
    Volume2,
    VolumeX,
    Maximize,
    Minimize,
    Settings,
    MessageSquare,
    Monitor,
    Check,
    Layers,
    SkipForward,
    Gauge,
    ChevronDown
} from "lucide-react";
import { EpisodesPanel } from "./EpisodesPanel";

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
    source?: PlayerSource;
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
    onBack?: () => void;
    onShowEpisodes?: () => void;
    animeId?: string;
    episodes?: { number: string; title?: string | null; season?: number }[];
    seasons?: { id: string; title: string }[];
    isMovie?: boolean;
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
    nextEpisodeLabel,
    onBack,
    onShowEpisodes,
    animeId,
    episodes,
    seasons,
    isMovie = false
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
    const [isPlayerReady, setIsPlayerReady] = useState(false);
    const [isScrubbing, setIsScrubbing] = useState(false);
    const [scrubPercent, setScrubPercent] = useState(0);
    const [bufferedPercent, setBufferedPercent] = useState(0);
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
    const [activeMenu, setActiveMenu] = useState<string | null>(null);
    const [playbackSpeed, setPlaybackSpeed] = useState(1);
    const episodesTimeoutRef = useRef<number | null>(null);
    const lastTimeRef = useRef<number>(0);
    const hasAppliedInitialTime = useRef(false);
    const lastSourceUrlRef = useRef<string | null>(null);
    const seekBarRef = useRef<HTMLDivElement | null>(null);
    const [isMobileDevice, setIsMobileDevice] = useState(false);
    const [isCssLandscape, setIsCssLandscape] = useState(false);

    const onProgressRef = useRef(onProgress);
    onProgressRef.current = onProgress;
    const durationRef = useRef(duration);
    durationRef.current = duration;
    const onEndedRef = useRef(onEnded);
    onEndedRef.current = onEnded;
    const onErrorRef = useRef(onError);
    onErrorRef.current = onError;
    const isScrubbingRef = useRef(isScrubbing);
    isScrubbingRef.current = isScrubbing;
    const hasSkippedIntroRef = useRef(hasSkippedIntro);
    hasSkippedIntroRef.current = hasSkippedIntro;
    const introEndSecondsRef = useRef(introEndSeconds);
    introEndSecondsRef.current = introEndSeconds;
    const currentLanguageIdRef = useRef(currentLanguageId);
    currentLanguageIdRef.current = currentLanguageId;
    const initialTimeSecondsRef = useRef(initialTimeSeconds);
    initialTimeSecondsRef.current = initialTimeSeconds;

    const [selectedAudioLanguageId, setSelectedAudioLanguageId] = useState<string | null>(
        () =>
            audioLanguages && audioLanguages.length > 0
                ? audioLanguages.find((lang) => lang.isDefault)?.id ?? audioLanguages[0]?.id
                : null
    );

    useEffect(() => {
        if (typeof window === "undefined" || !navigator) return;

        const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
        setIsMobileDevice(isMobile);

        const checkOrientation = () => {
            if (isMobile && window.innerHeight > window.innerWidth) {
                setIsCssLandscape(true);
            } else {
                setIsCssLandscape(false);
            }
        };

        if (isMobile) {
            checkOrientation();
            window.addEventListener("resize", checkOrientation);
            void enforceMobileFullscreen();
        }

        return () => {
            window.removeEventListener("resize", checkOrientation);
        };
    }, []);

    useEffect(() => {
        const video = videoRef.current;
        if (!video) return;


        const savedTime = lastTimeRef.current;

        if (hlsRef.current) {
            hlsRef.current.destroy();
            hlsRef.current = null;
        }

        if (!source || !source.url) {
            setIsBuffering(true);
            return;
        }

        const isHls = source.isHls ?? source.url.includes(".m3u8");
        const isSourceSwitch = lastSourceUrlRef.current != null && lastSourceUrlRef.current !== source.url;

        const resumeTime = isSourceSwitch && savedTime > 0
            ? savedTime
            : (initialTimeSecondsRef.current ?? 0);

        const applyResumeTime = () => {
            if (resumeTime > 0 && (!video.duration || resumeTime < video.duration)) {
                video.currentTime = resumeTime;
                setCurrentTime(resumeTime);
                lastTimeRef.current = resumeTime;
            }
            lastSourceUrlRef.current = source.url;
        };

        if (isHls && Hls.isSupported()) {
            const hls = new Hls({

                startPosition: resumeTime > 0 ? resumeTime : -1,
            });
            hlsRef.current = hls;
            hls.loadSource(source.url);
            hls.attachMedia(video);

            hls.on(Hls.Events.ERROR, (_event, _data) => {
            });

            hls.on(Hls.Events.MANIFEST_PARSED, (_event, _data) => {
                // Apply resume position here — HLS is guaranteed to be ready to seek
                applyResumeTime();
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

                const defaultId = currentLanguageIdRef.current === "ja" ? 0 : -1;
                setCurrentSubtitleId(defaultId);
                const anyHls = hls as any;
                anyHls.subtitleTrack = defaultId;
            });

            hls.on(Hls.Events.SUBTITLE_TRACK_SWITCH, (_event: any, data: any) => {
                setCurrentSubtitleId(typeof data.id === "number" ? data.id : null);
            });

            hls.on(Hls.Events.NON_NATIVE_TEXT_TRACKS_FOUND, (_event, _data: any) => {
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
            if (!isHls) {
                applyResumeTime();
            }
        };

        const handleTimeUpdate = () => {
            if (!isScrubbingRef.current) {
                const t = video.currentTime || 0;
                setCurrentTime(t);
                lastTimeRef.current = t;

                const introEnd = introEndSecondsRef.current;
                if (
                    !hasSkippedIntroRef.current &&
                    introEnd &&
                    video.duration &&
                    video.duration > 600 &&
                    t > 5 &&
                    t < introEnd
                ) {
                    setShowSkipIntro(true);
                } else if (t >= (introEnd ?? 0)) {
                    setShowSkipIntro(false);
                }
            }
        };

        const handleProgress = () => {
            if (video.buffered.length > 0 && video.duration) {
                let currentBuffered = 0;
                const currentTime = video.currentTime;
                for (let i = 0; i < video.buffered.length; i++) {
                    if (video.buffered.start(i) <= currentTime && video.buffered.end(i) >= currentTime) {
                        currentBuffered = video.buffered.end(i);
                        break;
                    }
                }
                setBufferedPercent((currentBuffered / video.duration) * 100);
            }
        };

        const handlePlaying = () => {
            setIsPlaying(true);
            setIsBuffering(false);
        };

        const handlePause = () => {
            setIsPlaying(false);
            if (durationRef.current && onProgressRef.current) {
                onProgressRef.current({
                    positionSeconds: video.currentTime || lastTimeRef.current,
                    durationSeconds: durationRef.current,
                    isFinished: video.ended || false
                });
            }
        };

        const handleWaiting = () => {
            setIsBuffering(true);
        };

        const handleEnded = () => {
            setIsPlaying(false);
            setIsBuffering(false);
            setCurrentTime(video.duration || 0);
            setHasEnded(true);
            onProgressRef.current?.({
                positionSeconds: video.duration || 0,
                durationSeconds: video.duration || 0,
                isFinished: true
            });
            onEndedRef.current?.();
        };

        const handleCanPlay = () => {
            setIsPlayerReady(true);
        };

        video.addEventListener("loadedmetadata", handleLoadedMetadata);
        video.addEventListener("timeupdate", handleTimeUpdate);
        video.addEventListener("playing", handlePlaying);
        video.addEventListener("pause", handlePause);
        video.addEventListener("waiting", handleWaiting);
        video.addEventListener("progress", handleProgress);
        video.addEventListener("ended", handleEnded);
        video.addEventListener("canplay", handleCanPlay);

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
            video.removeEventListener("progress", handleProgress);
            video.removeEventListener("ended", handleEnded);
            video.removeEventListener("canplay", handleCanPlay);
            if (hlsRef.current) {
                hlsRef.current.destroy();
                hlsRef.current = null;
            }
        };
    }, [source?.url]);

    useEffect(() => {
        const video = videoRef.current;
        if (!video || hasAppliedInitialTime.current) return;
        if (!initialTimeSeconds || initialTimeSeconds <= 0) return;

        const durationSeconds = video.duration || duration;
        if (durationSeconds && initialTimeSeconds >= durationSeconds) {
            return;
        }

        video.currentTime = initialTimeSeconds;
        setCurrentTime(initialTimeSeconds);
        hasAppliedInitialTime.current = true;
    }, [initialTimeSeconds, duration]);

    useEffect(() => {
        if (!onProgress || !source?.url) return;

        const video = videoRef.current;
        if (!video) return;

        const id = window.setInterval(() => {
            const currentDuration = video.duration || durationRef.current;
            if (!currentDuration) return;
            onProgress({
                positionSeconds: video.currentTime,
                durationSeconds: currentDuration,
                isFinished: false
            });
        }, PROGRESS_INTERVAL_MS);

        return () => {
            window.clearInterval(id);
            if (durationRef.current > 0) {
                onProgress({
                    positionSeconds: lastTimeRef.current,
                    durationSeconds: durationRef.current,
                    isFinished: false // Close enough on unmount
                });
            }
        };
    }, [onProgress, source?.url]);

    useEffect(() => {
        const handleUnloadOrHide = () => {
            if (durationRef.current > 0 && onProgressRef.current) {
                onProgressRef.current({
                    positionSeconds: lastTimeRef.current,
                    durationSeconds: durationRef.current,
                    isFinished: false
                });
            }
        };

        window.addEventListener("pagehide", handleUnloadOrHide);
        window.addEventListener("beforeunload", handleUnloadOrHide);
        document.addEventListener("visibilitychange", () => {
            if (document.visibilityState === "hidden") {
                handleUnloadOrHide();
            }
        });

        return () => {
            window.removeEventListener("pagehide", handleUnloadOrHide);
            window.removeEventListener("beforeunload", handleUnloadOrHide);
            // removing anonymous visibilitychange is tricky without a ref, but it's fine for the Player lifetime
        };
    }, []);

    useEffect(() => {
        const video = videoRef.current;
        if (!video) return;

        const syncTracks = () => {
            const nativeTracks = Array.from(video.textTracks).map((track, index) => ({
                id: index + 100,
                name: track.label || track.language || `Track ${index + 1}`
            }));

            if (nativeTracks.length > 0) {
                setSubtitleTracks(prev => {
                    if (prev.length > 0) return prev;
                    return nativeTracks;
                });
            }
        };

        video.textTracks.addEventListener("addtrack", syncTracks);
        syncTracks();

        return () => {
            video.textTracks.removeEventListener("addtrack", syncTracks);
        };
    }, []);

    useEffect(() => {
        if (!isPlaying || isBuffering) {
            setControlsVisible(true);
            if (containerRef.current) {
                containerRef.current.style.cursor = "default";
            }
            return;
        }

        let timeout: number | null = null;

        const resetTimer = () => {
            setControlsVisible(true);
            if (containerRef.current) {
                containerRef.current.style.cursor = "default";
            }
            if (timeout !== null) {
                window.clearTimeout(timeout);
            }
            timeout = window.setTimeout(() => {
                if (activeMenu) {
                    resetTimer();
                    return;
                }
                setControlsVisible(false);
                if (containerRef.current && isPlaying) {
                    containerRef.current.style.cursor = "none";
                }
            }, 3000);
        };

        resetTimer();

        const el = containerRef.current;
        if (el) {
            el.addEventListener("mousemove", resetTimer);
            el.addEventListener("touchstart", resetTimer);
            el.addEventListener("mousedown", resetTimer);
        }

        return () => {
            if (timeout !== null) {
                window.clearTimeout(timeout);
            }
            if (el) {
                el.removeEventListener("mousemove", resetTimer);
                el.removeEventListener("touchstart", resetTimer);
                el.removeEventListener("mousedown", resetTimer);
                el.style.cursor = "default";
            }
        };
    }, [isPlaying, activeMenu]);

    useEffect(() => {
        const handleFullscreenChange = () => {
            const fsElement =
                document.fullscreenElement ||
                (document as any).webkitFullscreenElement;
            setIsFullscreen(!!fsElement);
        };

        document.addEventListener("fullscreenchange", handleFullscreenChange);
        document.addEventListener("webkitfullscreenchange", handleFullscreenChange);

        return () => {
            document.removeEventListener("fullscreenchange", handleFullscreenChange);
            document.removeEventListener("webkitfullscreenchange", handleFullscreenChange);
        };
    }, []);

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

    const enforceMobileFullscreen = async () => {
        const container = containerRef.current;
        const video = videoRef.current;
        if (!container || !video || typeof window === "undefined" || !navigator) return;

        const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
        if (!isMobile) return;

        try {
            const isFs =
                document.fullscreenElement ||
                (document as any).webkitFullscreenElement;

            if (!isFs) {
                if (container.requestFullscreen) {
                    await container.requestFullscreen();
                } else if ((container as any).webkitRequestFullscreen) {
                    await (container as any).webkitRequestFullscreen();
                } else if ((video as any).webkitEnterFullscreen) {
                    (video as any).webkitEnterFullscreen();
                }
            }

            if (window.screen && window.screen.orientation && (window.screen.orientation as any).lock) {
                await (window.screen.orientation as any).lock("landscape");
            } else {
                if (window.innerHeight > window.innerWidth) {
                    setIsCssLandscape(true);
                }
            }
        } catch (err) {
            console.warn("Could not enforce mobile fullscreen or landscape", err);
            if (window.innerHeight > window.innerWidth) {
                setIsCssLandscape(true);
            }
        }
    };

    const togglePlay = () => {
        const video = videoRef.current;
        if (!video) return;
        if (video.paused) {
            void video.play();
            setIsPlaying(true);
            void enforceMobileFullscreen();
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
        lastTimeRef.current = t;
        if (introEndSeconds && t >= introEndSeconds) {
            setShowSkipIntro(false);
            setHasSkippedIntro(true);
        }
        setIsScrubbing(false);
    };

    const getSeekPercent = (e: React.MouseEvent<HTMLDivElement>) => {
        const bar = seekBarRef.current;
        if (!bar) return 0;
        const rect = bar.getBoundingClientRect();
        const x = Math.max(0, Math.min(e.clientX - rect.left, rect.width));
        return (x / rect.width) * 100;
    };

    const handleSeekBarClick = (e: React.MouseEvent<HTMLDivElement>) => {
        const percent = getSeekPercent(e);
        setScrubPercent(percent);
        handleSeekCommit(percent);
    };

    const handleSeekBarMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
        handleSeekStart();
        const percent = getSeekPercent(e);
        setScrubPercent(percent);

        const handleMouseMove = (moveEvent: MouseEvent) => {
            const bar = seekBarRef.current;
            if (!bar) return;
            const rect = bar.getBoundingClientRect();
            const x = Math.max(0, Math.min(moveEvent.clientX - rect.left, rect.width));
            const p = (x / rect.width) * 100;
            setScrubPercent(p);
        };

        const handleMouseUp = (upEvent: MouseEvent) => {
            const bar = seekBarRef.current;
            if (bar) {
                const rect = bar.getBoundingClientRect();
                const x = Math.max(0, Math.min(upEvent.clientX - rect.left, rect.width));
                const p = (x / rect.width) * 100;
                handleSeekCommit(p);
            }
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };

        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('mouseup', handleMouseUp);
    };

    const toggleFullscreen = () => {
        const container = containerRef.current;
        if (!container) return;

        const isFs =
            document.fullscreenElement ||
            (document as any).webkitFullscreenElement;

        if (isFs) {
            if (document.exitFullscreen) {
                void document.exitFullscreen();
            } else if ((document as any).webkitExitFullscreen) {
                void (document as any).webkitExitFullscreen();
            }
        } else {
            if (container.requestFullscreen) {
                void container.requestFullscreen();
            } else if ((container as any).webkitRequestFullscreen) {
                void (container as any).webkitRequestFullscreen();
            }
        }
    };

    const togglePictureInPicture = async () => {
        const video = videoRef.current;
        if (!video) return;

        try {
            if (document.pictureInPictureElement) {
                await document.exitPictureInPicture();
            } else if (document.pictureInPictureEnabled && !video.disablePictureInPicture) {
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

    const changePlaybackSpeed = (speed: number) => {
        const video = videoRef.current;
        if (!video) return;
        video.playbackRate = speed;
        setPlaybackSpeed(speed);
    };

    return (
        <div
            className={`fixed inset-0 z-50 bg-black ${isCssLandscape ? "landscape-fallback" : ""}`}
        >
            <style dangerouslySetInnerHTML={{
                __html: `
                .landscape-fallback {
                    width: 100vh !important;
                    height: 100vw !important;
                    transform: rotate(90deg) translate(100%, 0) !important;
                    transform-origin: top right !important;
                    position: fixed !important;
                    top: 0 !important;
                    right: 100% !important;
                    overflow: hidden !important;
                }
            `}} />
            <div
                ref={containerRef}
                className="relative flex h-full w-full flex-col bg-black text-white overflow-hidden"
                onClick={() => {
                    const isMobile = typeof navigator !== 'undefined' && /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
                    if (isMobile) {
                        void enforceMobileFullscreen();
                    }

                    if (!controlsVisible) {
                        setControlsVisible(true);
                    } else {
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
                <Transition
                    show={controlsVisible}
                    as={Fragment}
                    enter="transition-opacity duration-300"
                    enterFrom="opacity-0"
                    enterTo="opacity-100"
                    leave="transition-opacity duration-500"
                    leaveFrom="opacity-100"
                    leaveTo="opacity-0"
                >
                    <div className="pointer-events-none absolute inset-0">
                        <div className="absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-black/80 via-black/40 to-transparent" />
                        <div className="absolute inset-x-0 bottom-0 h-64 bg-gradient-to-t from-black/90 via-black/40 to-transparent" />
                    </div>
                </Transition>

                {/* Top metadata bar */}
                <Transition
                    show={controlsVisible}
                    as={Fragment}
                    enter="transition duration-300 ease-out"
                    enterFrom="opacity-0 -translate-y-4"
                    enterTo="opacity-100 translate-y-0"
                    leave="transition duration-500 ease-in"
                    leaveFrom="opacity-100 translate-y-0"
                    leaveTo="opacity-0 -translate-y-4"
                >
                    <div className="pointer-events-auto absolute inset-x-0 top-0 flex items-start justify-between px-4 sm:px-12 pt-8 text-sm">
                        <div className="flex items-start gap-6">
                            <button
                                onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    if (durationRef.current > 0 && onProgressRef.current) {
                                        onProgressRef.current({
                                            positionSeconds: lastTimeRef.current,
                                            durationSeconds: durationRef.current,
                                            isFinished: false
                                        });
                                    }
                                    if (onBack) {
                                        onBack();
                                    } else {
                                        history.back();
                                    }
                                }}
                                className="mt-1 transition-opacity opacity-80 hover:opacity-100 active:scale-95"
                                aria-label="Back"
                            >
                                <ArrowLeft className="h-8 w-8 text-white drop-shadow-md" strokeWidth={2.5} />
                            </button>
                            <div className="space-y-1.5 flex-1">
                                {title && (
                                    <p className="max-w-2xl text-xl font-bold sm:text-3xl tracking-tight text-white drop-shadow-md">
                                        {title}
                                    </p>
                                )}
                            </div>
                        </div>
                        <div
                            className="flex items-center gap-4"
                            onClick={(e) => e.stopPropagation()}
                        >
                            {qualityOptions && qualityOptions.length > 0 && (
                                <Menu
                                    label="Quality"
                                    icon={<Settings className="h-6 w-6" />}
                                    value={currentQualityId ?? "auto"}
                                    options={qualityOptions.map(o => ({ id: o.id, label: o.label }))}
                                    onChange={(id) => onChangeQuality?.(id === "auto" ? null : id)}
                                    isOpen={activeMenu === "quality"}
                                    onToggle={(open) => {
                                        if (open) setActiveMenu("quality");
                                        else if (activeMenu === "quality") setActiveMenu(null);
                                    }}
                                    placement="top"
                                    noScale={true}
                                />
                            )}
                        </div>
                    </div>
                </Transition>

                {/* Center play/pause indicator */}
                <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                    {!isPlaying && !isBuffering && isPlayerReady && (
                        <div className="flex h-24 w-24 items-center justify-center rounded-full bg-black/60 border-2 border-white/20 backdrop-blur-md transition-transform hover:scale-110 shadow-[0_0_30px_rgba(0,0,0,0.5)]">
                            <Play className="h-10 w-10 text-white fill-white ml-2 drop-shadow-lg" />
                        </div>
                    )}
                    {(isBuffering || (!isPlayerReady && !hasEnded)) && (
                        <div className="flex h-24 w-24 items-center justify-center">
                            <svg className="animate-spin h-16 w-16 text-ncyan drop-shadow-[0_0_15px_rgba(6,182,212,0.8)]" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-20" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                <path className="opacity-100" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                            <span className="sr-only">Loading</span>
                        </div>
                    )}
                </div>

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
                <Transition
                    show={controlsVisible}
                    as={Fragment}
                    enter="transition duration-300 ease-out"
                    enterFrom="opacity-0 translate-y-8"
                    enterTo="opacity-100 translate-y-0"
                    leave="transition duration-500 ease-in"
                    leaveFrom="opacity-100 translate-y-0"
                    leaveTo="opacity-0 translate-y-8"
                >
                    <div
                        className="pointer-events-auto absolute inset-x-0 bottom-0 px-4 pb-8 pt-2 sm:px-12 sm:pb-12"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="space-y-6">
                            {/* Seek bar */}
                            <div className="group relative flex items-center py-2 h-6">
                                <div
                                    ref={seekBarRef}
                                    className="relative h-1 w-full flex-1 bg-white/10 transition-all group-hover:h-1.5 rounded-full overflow-visible cursor-pointer"
                                    onClick={handleSeekBarClick}
                                    onMouseDown={handleSeekBarMouseDown}
                                >
                                    {/* Buffered Bar */}
                                    <div
                                        className="absolute h-full bg-white/20 transition-all duration-300 rounded-full"
                                        style={{ width: `${bufferedPercent}%` }}
                                    />
                                    {/* Progress Bar */}
                                    <div
                                        className="absolute h-full bg-ncyan shadow-[0_0_10px_rgba(30,215,96,0.3)] rounded-full"
                                        style={{ width: `${effectivePercent}%` }}
                                    />
                                    {/* Netflix-style scrub dot */}
                                    <div
                                        className="absolute top-1/2 -translate-y-1/2 h-3.5 w-3.5 rounded-full bg-ncyan opacity-0 group-hover:opacity-100 transition-opacity shadow-[0_0_6px_rgba(30,215,96,0.5)] pointer-events-none z-10"
                                        style={{ left: `${effectivePercent}%`, transform: `translate(-50%, -50%)` }}
                                    />
                                </div>
                                <div className="ml-4 tabular-nums text-xs font-medium text-white/80">
                                    {formatTime(duration - currentTime)}
                                </div>
                            </div>

                            {/* Main controls row */}
                            <div className="grid grid-cols-[1fr_auto_1fr] items-center w-full">
                                {/* Left controls: Play, Rewind, Forward, Volume */}
                                <div className="flex items-center gap-4 sm:gap-6 justify-start">
                                    <button
                                        type="button"
                                        onClick={togglePlay}
                                        className="group flex h-10 w-10 items-center justify-center transition-all hover:scale-110 active:scale-90 focus:outline-none focus:ring-0"
                                        aria-label={isPlaying ? "Pause" : "Play"}
                                    >
                                        {isPlaying ? (
                                            <Pause className="h-8 w-8 text-white fill-white" />
                                        ) : (
                                            <Play className="h-8 w-8 text-white fill-white ml-0.5" />
                                        )}
                                    </button>

                                    <div className="flex items-center gap-4">
                                        <button
                                            type="button"
                                            onClick={() => seekRelative(-10)}
                                            className="group relative flex items-center justify-center transition-all hover:scale-110 active:scale-90 focus:outline-none focus:ring-0"
                                            aria-label="Rewind 10 seconds"
                                        >
                                            <RotateCcw className="h-7 w-7 text-white" />
                                            <span className="absolute text-[0.6rem] font-black text-white mt-1">10</span>
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => seekRelative(10)}
                                            className="group relative flex items-center justify-center transition-all hover:scale-110 active:scale-90 focus:outline-none focus:ring-0"
                                            aria-label="Forward 10 seconds"
                                        >
                                            <RotateCw className="h-7 w-7 text-white" />
                                            <span className="absolute text-[0.6rem] font-black text-white mt-1">10</span>
                                        </button>
                                    </div>

                                    {/* Volume cluster: reveal on hover */}
                                    <div className="group relative flex items-center gap-2">
                                        <button
                                            type="button"
                                            onClick={toggleMute}
                                            className="transition-transform hover:scale-110 active:scale-95 focus:outline-none focus:ring-0"
                                            aria-label={isMuted ? "Unmute" : "Mute"}
                                        >
                                            {isMuted || volume === 0 ? (
                                                <VolumeX className="h-7 w-7 text-white" />
                                            ) : (
                                                <Volume2 className="h-7 w-7 text-white" />
                                            )}
                                        </button>
                                        <div className="w-0 overflow-hidden transition-all duration-300 group-hover:w-24 group-hover:ml-2">
                                            <input
                                                type="range"
                                                min={0}
                                                max={100}
                                                value={Math.round(volume * 100)}
                                                onChange={(event) => handleVolumeChange(Number(event.target.value))}
                                                className="w-20 cursor-pointer accent-ncyan h-1.5 appearance-none rounded-full bg-white/20 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white"
                                                aria-label="Volume"
                                            />
                                        </div>
                                    </div>
                                </div>

                                {/* Center: Metadata (Title + Episode Label) */}
                                <div className="flex flex-col items-center justify-center text-center px-4 overflow-hidden">
                                    <div className="flex flex-col items-center justify-center text-center gap-1">
                                        <span className="text-[10px] sm:text-xs font-bold text-neutral-400 uppercase tracking-[0.15em] opacity-80">
                                            {title}
                                        </span>
                                        <span className="text-xs sm:text-sm font-semibold text-white tracking-wide truncate max-w-[250px] sm:max-w-xl">
                                            {episodeLabel}
                                        </span>
                                    </div>
                                </div>

                                {/* Right controls: Next, Episodes, Audio/Subs, Speed, Fullscreen */}
                                <div
                                    className="flex items-center gap-3 sm:gap-5 justify-end"
                                    onClick={(e) => e.stopPropagation()}
                                >
                                    {!isMovie && (
                                        <>
                                            <Link
                                                href={nextEpisodeHref || "#"}
                                                className={`flex items-center justify-center p-2 text-white transition-all hover:scale-110 active:scale-95 focus:outline-none focus:ring-0 ${!nextEpisodeHref ? "opacity-20 grayscale pointer-events-none" : "hover:text-white"}`}
                                            >
                                                <SkipForward className="h-7 w-7 fill-current" />
                                            </Link>

                                            <div
                                                className="relative"
                                                onMouseEnter={() => {
                                                    if (episodesTimeoutRef.current) window.clearTimeout(episodesTimeoutRef.current);
                                                    setActiveMenu("episodes");
                                                }}
                                                onMouseLeave={() => {
                                                    episodesTimeoutRef.current = window.setTimeout(() => {
                                                        if (activeMenu === "episodes") setActiveMenu(null);
                                                    }, 200);
                                                }}
                                            >
                                                <button
                                                    type="button"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        if (activeMenu === "episodes") setActiveMenu(null);
                                                        else setActiveMenu("episodes");
                                                        onShowEpisodes?.();
                                                    }}
                                                    className={`flex items-center gap-2 rounded-full p-2 text-white transition-all hover:scale-110 active:scale-95 focus:outline-none focus:ring-0 ${activeMenu === "episodes" ? "text-ncyan" : ""}`}
                                                    aria-label="Episodes"
                                                >
                                                    <Layers className="h-7 w-7" />
                                                </button>

                                                <EpisodesPanel
                                                    animeId={animeId || ""}
                                                    animeTitle={title || "Episodes"}
                                                    episodes={episodes || []}
                                                    currentEpisode={episodeLabel || ""}
                                                    isOpen={activeMenu === "episodes"}
                                                    onClose={() => setActiveMenu(null)}
                                                    seasons={seasons}
                                                />
                                            </div>
                                        </>
                                    )}

                                    {(subtitleTracks.length > 0 || (languageOptions && languageOptions.length > 0)) && (
                                        <TwoColumnMenu
                                            label="Audio & Subtitles"
                                            icon={<MessageSquare className="h-7 w-7" />}
                                            sections={[
                                                {
                                                    title: "Audio",
                                                    options: (languageOptions || []).map(o => ({ id: `audio-${o.id}`, label: o.label }))
                                                },
                                                {
                                                    title: "Subtitles",
                                                    options: [
                                                        { id: "sub--1", label: "Off" },
                                                        ...subtitleTracks.map(t => ({ id: `sub-${t.id}`, label: t.name }))
                                                    ]
                                                }
                                            ]}
                                            activeIds={[
                                                `audio-${currentLanguageId}`,
                                                `sub-${currentSubtitleId ?? -1}`
                                            ]}
                                            onSelect={(id) => {
                                                if (id.startsWith("audio-")) {
                                                    const langId = id.replace("audio-", "");
                                                    setSelectedAudioLanguageId(langId);
                                                    onChangeLanguage?.(langId);
                                                } else if (id.startsWith("sub-")) {
                                                    const subId = Number(id.replace("sub-", ""));
                                                    const video = videoRef.current;
                                                    const hls = hlsRef.current;

                                                    if (subId >= 100 && video) {
                                                        // Handle native text tracks
                                                        const nativeIdx = subId - 100;
                                                        for (let i = 0; i < video.textTracks.length; i++) {
                                                            video.textTracks[i].mode = i === nativeIdx ? "showing" : "disabled";
                                                        }
                                                        setCurrentSubtitleId(subId);
                                                    } else if (hls) {
                                                        // Handle HLS tracks
                                                        (hls as any).subtitleTrack = subId;
                                                        setCurrentSubtitleId(subId);
                                                    }
                                                }
                                            }}
                                            isOpen={activeMenu === "audio"}
                                            onToggle={(open) => {
                                                if (open) setActiveMenu("audio");
                                                else if (activeMenu === "audio") setActiveMenu(null);
                                            }}
                                        />
                                    )}

                                    <Menu
                                        label="Playback Speed"
                                        icon={<Gauge className="h-7 w-7" />}
                                        value={playbackSpeed.toString()}
                                        options={[
                                            { id: "0.5", label: "0.5x" },
                                            { id: "0.75", label: "0.75x" },
                                            { id: "1", label: "Normal" },
                                            { id: "1.25", label: "1.25x" },
                                            { id: "1.5", label: "1.5x" },
                                            { id: "2", label: "2x" }
                                        ]}
                                        onChange={(id) => changePlaybackSpeed(Number(id))}
                                        isOpen={activeMenu === "speed"}
                                        onToggle={(open) => {
                                            if (open) setActiveMenu("speed");
                                            else if (activeMenu === "speed") setActiveMenu(null);
                                        }}
                                        activeIds={[playbackSpeed.toString()]}
                                    />

                                    {/* Hide the fullscreen button exclusively for mobile users, per Netflix UI */}
                                    {!isMobileDevice && (
                                        <button
                                            type="button"
                                            onClick={toggleFullscreen}
                                            className="text-white transition-transform hover:scale-110 active:scale-95 focus:outline-none focus:ring-0"
                                            aria-label={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
                                        >
                                            {isFullscreen ? (
                                                <Minimize className="h-7 w-7" />
                                            ) : (
                                                <Maximize className="h-7 w-7" />
                                            )}
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                </Transition>
            </div>
        </div>
    );
}

// Custom Menu Component
function Menu({
    label,
    icon,
    value,
    options,
    onChange,
    isOpen,
    onToggle,
    activeIds,
    placement = "bottom",
    noScale
}: {
    label: string;
    icon: ReactNode;
    value: string | null;
    options: { id: string; label: string }[];
    onChange: (id: string) => void;
    isOpen: boolean;
    onToggle: (open: boolean) => void;
    activeIds?: string[];
    placement?: "top" | "bottom";
    noScale?: boolean;
}) {
    const timeoutRef = useRef<number | null>(null);

    const handleMouseEnter = () => {
        if (timeoutRef.current) window.clearTimeout(timeoutRef.current);
        onToggle(true);
    };

    const handleMouseLeave = () => {
        timeoutRef.current = window.setTimeout(() => {
            if (isOpen) {
                onToggle(false);
            }
        }, 150);
    };

    return (
        <div
            className="relative"
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
        >
            <button
                type="button"
                onClick={(e) => {
                    e.stopPropagation();
                    onToggle(!isOpen);
                }}
                className={`flex items-center gap-2 rounded-full p-2 text-white transition-all focus:outline-none focus:ring-0 ${noScale ? "" : "hover:scale-110"}`}
            >
                {icon}
            </button>

            <Transition
                show={isOpen}
                as={Fragment}
                enter="transition duration-150 ease-out"
                enterFrom="opacity-0 scale-95 translate-y-2"
                enterTo="opacity-100 scale-100 translate-y-0"
                leave="transition duration-100 ease-in"
                leaveFrom="opacity-100 scale-100 translate-y-0"
                leaveTo="opacity-0 scale-95 translate-y-2"
            >
                <div className={`absolute ${placement === "top" ? "top-full" : "bottom-full"} right-0 ${placement === "top" ? "mt-4" : "mb-4"} w-48 max-h-[70vh] overflow-y-auto rounded-lg bg-[#141414]/95 backdrop-blur-3xl border border-white/10 p-2 shadow-2xl ring-1 ring-white/5 z-50`}>
                    <div className="px-3 py-2 text-[0.65rem] font-black uppercase tracking-[0.2em] text-neutral-500 border-b border-white/5 mb-1">
                        {label}
                    </div>
                    {options.map(opt => (
                        <MenuOption
                            key={opt.id}
                            active={activeIds ? activeIds.includes(opt.id) : value === opt.id}
                            onClick={() => { onChange(opt.id); onToggle(false); }}
                        >
                            {opt.label}
                        </MenuOption>
                    ))}
                </div>
            </Transition>
        </div>
    );
}

function TwoColumnMenu({
    label,
    icon,
    sections,
    isOpen,
    onToggle,
    activeIds,
    onSelect
}: {
    label: string;
    icon: ReactNode;
    sections: { title: string; options: { id: string; label: string }[] }[];
    isOpen: boolean;
    onToggle: (open: boolean) => void;
    activeIds: string[];
    onSelect: (id: string) => void;
}) {
    const timeoutRef = useRef<number | null>(null);

    const handleMouseEnter = () => {
        if (timeoutRef.current) window.clearTimeout(timeoutRef.current);
        onToggle(true);
    };

    const handleMouseLeave = () => {
        timeoutRef.current = window.setTimeout(() => {
            if (isOpen) {
                onToggle(false);
            }
        }, 150);
    };

    return (
        <div
            className="relative"
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
        >
            <button
                type="button"
                onClick={(e) => {
                    e.stopPropagation();
                    onToggle(!isOpen);
                }}
                className="flex items-center gap-2 rounded-full p-2 text-white transition-all hover:scale-110 focus:outline-none focus:ring-0"
            >
                {icon}
            </button>

            <Transition
                show={isOpen}
                as={Fragment}
                enter="transition duration-150 ease-out"
                enterFrom="opacity-0 scale-95 translate-y-2"
                enterTo="opacity-100 scale-100 translate-y-0"
                leave="transition duration-100 ease-in"
                leaveFrom="opacity-100 scale-100 translate-y-0"
                leaveTo="opacity-0 scale-95 translate-y-2"
            >
                <div className="absolute bottom-full right-0 mb-4 flex w-[480px] max-h-[75vh] overflow-hidden rounded-lg bg-[#141414]/95 backdrop-blur-3xl border border-white/10 shadow-2xl ring-1 ring-white/5 z-50">
                    {sections.map((section, idx) => (
                        <div key={section.title} className={`flex-1 flex flex-col min-w-0 ${idx === 0 ? "border-r border-white/10" : ""}`}>
                            <div className="px-8 py-6 text-xl font-black uppercase tracking-[0.2em] text-neutral-500 border-b border-white/5">
                                {section.title}
                            </div>
                            <div className="flex-1 overflow-y-auto px-2 pb-6 space-y-0.5 custom-scrollbar">
                                {section.options.map(opt => {
                                    const isActive = activeIds.includes(opt.id);
                                    return (
                                        <button
                                            key={opt.id}
                                            onClick={() => { onSelect(opt.id); }}
                                            className={`group relative flex w-full items-center gap-8 px-6 py-2.5 text-lg text-left transition-colors focus:outline-none focus:ring-0 ${isActive
                                                ? "text-white font-bold"
                                                : "text-neutral-400 hover:text-white"
                                                }`}
                                        >
                                            <div className="w-6 flex shrink-0 justify-center">
                                                {isActive && <Check className="h-6 w-6 text-white stroke-[3px]" />}
                                            </div>
                                            <span className="truncate">{opt.label}</span>

                                            {!isActive && (
                                                <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-0 bg-ncyan transition-all group-hover:h-3/4 rounded-r-full shadow-[0_0_8px_rgba(30,215,96,0.4)]" />
                                            )}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    ))}
                </div>
            </Transition>
        </div>
    );
}



function MenuOption({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
    return (
        <button
            onClick={onClick}
            className={`flex w-full items-center justify-between px-3 py-2 text-sm text-left rounded-md transition-colors focus:outline-none focus:ring-0 ${active
                ? "bg-white/10 text-white font-bold"
                : "text-neutral-400 hover:bg-white/5 hover:text-white"
                }`}
        >
            <span>{children}</span>
            {active && <Check className="h-4 w-4 text-white stroke-[4px]" />}
        </button>
    );
}

