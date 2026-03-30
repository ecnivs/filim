"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useState, useMemo, useCallback } from "react";
import { api } from "@/lib/http";
import { Player } from "@/components/Player";

type StreamVariant = {
    id: string;
    resolution?: string | null;
    provider?: string | null;
    bitrate_kbps?: number | null;
    kind: string;
};

type StreamResponse = {
    manifest_url: string;
    variants: StreamVariant[];
    audio_languages?: {
        id: string;
        code?: string | null;
        label: string;
        is_default?: boolean;
    }[];
};

type EpisodeSummary = {
    number: string;
    title?: string | null;
    duration_seconds?: number | null;
};

type AnimeDetails = {
    id: string;
    title: string;
    episode_count: number;
    episodes: EpisodeSummary[];
    synopsis?: string | null;
    cover_image_url?: string | null;
    tags?: string[];
    available_audio_languages?: string[];
};

export default function WatchPage() {
    const params = useParams<{ animeId: string; episode: string }>();
    const router = useRouter();
    const [error, setError] = useState<string | null>(null);
    const [manifestUrl, setManifestUrl] = useState<string | null>(null);
    const [variants, setVariants] = useState<StreamVariant[]>([]);
    const [selectedQualityId, setSelectedQualityId] = useState<string | null>(null);
    const [language, setLanguage] = useState<string>("ja");
    const [audioLanguages, setAudioLanguages] = useState<
        StreamResponse["audio_languages"] | undefined
    >(undefined);
    const [animeDetails, setAnimeDetails] = useState<AnimeDetails | null>(null);
    const [resumePositionSeconds, setResumePositionSeconds] = useState<number | null>(
        null
    );
    const [seasons, setSeasons] = useState<{ id: string; title: string }[]>([]);

    const routeIds = useMemo(() => {
        const { animeId, episode } = params;
        if (animeId && animeId !== "undefined" && episode && episode !== "undefined") {
            return {
                animeId: decodeURIComponent(animeId),
                episode: decodeURIComponent(episode)
            };
        }
        return null;
    }, [params.animeId, params.episode]);

    const hasValidParams = !!routeIds;

    useEffect(() => {
        let cancelled = false;

        async function fetchAudioPreference() {
            try {
                const res = await api.get<{ item: { audio_language_id: string } | null }>(
                    "/audio-preference"
                );
                if (cancelled) return;
                const pref = res.data.item?.audio_language_id;
                if (!pref) return;
                if (pref === "ja" || pref === "en") {
                    setLanguage(pref);
                } else if (pref === "sub") {
                    setLanguage("ja");
                } else if (pref === "dub") {
                    setLanguage("en");
                }
            } catch {
                // ignore preference failures; the player will fall back to defaults
            }
        }

        void fetchAudioPreference();

        return () => {
            cancelled = true;
        };
    }, []);

    useEffect(() => {
        if (!hasValidParams || !routeIds) {
            setManifestUrl(null);
            setVariants([]);
            setAudioLanguages(undefined);
            return;
        }

        async function fetchStream(qualityId: string | null) {
            setError(null);
            const queryParams: Record<string, string | undefined> = {};
            if (qualityId) {
                const variant = variants.find((v) => v.id === qualityId);
                if (variant?.resolution) {
                    queryParams.quality = variant.resolution;
                }
            }
            if (language) {
                queryParams.language = language;
            }

            try {
                const res = await api.get<StreamResponse>(
                    `/anime/${routeIds!.animeId}/episodes/${routeIds!.episode}/stream`,
                    {
                        params: queryParams
                    }
                );
                setManifestUrl(res.data.manifest_url);
                setVariants(res.data.variants);
                setAudioLanguages(res.data.audio_languages);
            } catch (err: any) {
                // eslint-disable-next-line no-console
                console.error("Failed to load stream", err);
                const message =
                    err?.response?.data?.detail ||
                    "This episode is currently unavailable to stream.";
                setError(message);
            }
        }

        void fetchStream(selectedQualityId);

    }, [
        hasValidParams,
        routeIds?.animeId,
        routeIds?.episode,
        selectedQualityId,
        language
    ]);

    useEffect(() => {
        let cancelled = false;
        async function fetchDetails() {
            if (!routeIds?.animeId) return;
            try {
                const res = await api.get<AnimeDetails>(`/catalog/${routeIds.animeId}`);
                if (cancelled) return;
                const sortedEpisodes = (res.data.episodes || []).sort((a, b) => {
                    const aNum = parseFloat(String(a.number).replace(/[^0-9.]/g, ""));
                    const bNum = parseFloat(String(b.number).replace(/[^0-9.]/g, ""));
                    return aNum - bNum;
                });
                setAnimeDetails({ ...res.data, episodes: sortedEpisodes });

                try {
                    const seriesRes = await api.get<{ items: { id: string; title: string }[] }>(
                        `/catalog/${routeIds.animeId}/series`
                    );
                    if (cancelled) return;

                    setSeasons((prev) => {
                        const newList = [...seriesRes.data.items];
                        if (!newList.find(s => s.id === res.data.id)) {
                            newList.unshift({ id: res.data.id, title: res.data.title });
                        }


                        const combined = [...prev];
                        newList.forEach(item => {
                            if (!combined.find(c => c.id === item.id)) {
                                combined.push(item);
                            }
                        });
                        return combined.length > 0 ? combined : newList;
                    });
                } catch { /* ignore */ }
            } catch (err) {
                console.warn("Failed to load anime details", err);
            }
        }
        void fetchDetails();
        return () => { cancelled = true; };
    }, [routeIds?.animeId]);

    useEffect(() => {
        let cancelled = false;
        async function fetchProgress() {
            if (!routeIds?.animeId || !routeIds?.episode) return;
            try {
                const res = await api.get<{ items: ContinueWatchingItem[] }>(`/user/progress/${routeIds.animeId}`);
                if (cancelled) return;
                const match = res.data.items.find(
                    (item) => item.episode === routeIds.episode
                );
                setResumePositionSeconds(
                    match && match.position_seconds > 0 && match.position_seconds < match.duration_seconds
                        ? match.position_seconds
                        : null
                );
            } catch { /* ignore */ }
        }
        void fetchProgress();
        return () => { cancelled = true; };
    }, [routeIds?.animeId, routeIds?.episode]);

    type ContinueWatchingItem = {
        anime_id: string;
        episode: string;
        position_seconds: number;
        duration_seconds: number;
        progress: number;
    };

    const episodeMeta =
        animeDetails && routeIds
            ? animeDetails.episodes.find((ep) => {
                const epNum = String(ep.number).toLowerCase().replace(/^e/, '');
                const routeNum = String(routeIds.episode).toLowerCase().replace(/^e/, '');
                return epNum === routeNum || epNum.padStart(2, '0') === routeNum.padStart(2, '0');
            }) ?? null
            : null;

    const episodeLabel = episodeMeta
        ? `E${episodeMeta.number}${episodeMeta.title ? ` • ${episodeMeta.title}` : ""}`
        : `E${routeIds?.episode ?? "?"}`;

    const nextEpisode =
        animeDetails && episodeMeta
            ? (() => {
                const index = animeDetails.episodes.findIndex((ep) => {
                    const epNum = String(ep.number).toLowerCase().replace(/^e/, '');
                    const metaNum = String(episodeMeta.number).toLowerCase().replace(/^e/, '');
                    return epNum === metaNum || epNum.padStart(2, '0') === metaNum.padStart(2, '0');
                });
                if (index === -1) return null;
                return animeDetails.episodes[index + 1] ?? null;
            })()
            : null;

    const nextEpisodeHref =
        animeDetails && nextEpisode
            ? `/watch/${animeDetails.id}/${nextEpisode.number}`
            : undefined;

    const nextEpisodeLabel =
        nextEpisode && animeDetails
            ? `Episode ${nextEpisode.number}${nextEpisode.title ? ` • ${nextEpisode.title}` : ""
            }`
            : undefined;

    const languageOptions =
        animeDetails?.available_audio_languages && animeDetails.available_audio_languages.length > 0
            ? animeDetails.available_audio_languages.map((code) => ({
                id: code,
                label: code === "en" ? "English" : "Japanese (日本語)"
            }))
            : [
                { id: "ja", label: "Japanese (日本語)" },
                { id: "en", label: "English" }
            ];

    const handleChangeLanguage = useCallback((nextId: string) => {
        setLanguage(nextId);
        void api
            .post("/audio-preference", {
                audio_language_id: nextId
            })
            .catch((err) => {
                console.warn("Failed to update audio preference", err);
            });
    }, []);

    const handleChangeQuality = useCallback((qualityId: string | null) => {
        if (qualityId === "auto") {
            setSelectedQualityId(null);
        } else {
            setSelectedQualityId(qualityId);
        }
    }, []);

    const stableSource = useMemo(() => manifestUrl ? { url: manifestUrl } : null, [manifestUrl]);

    const stableAudioLanguages = useMemo(() => {
        return audioLanguages?.map((lang) => ({
            id: lang.id,
            label: lang.label,
            code: lang.code ?? null,
            isDefault: lang.is_default ?? false
        })) ?? undefined;
    }, [audioLanguages]);

    const stableQualityOptions = useMemo(() => [
        { id: "auto", label: "Auto", value: null },
        ...variants.map((variant) => {
            let label = variant.resolution;
            if (!label || label === "Source") {
                label = variant.provider ? `Source (${variant.provider})` : "Source";
            } else if (variant.provider) {
                label = `${label} (${variant.provider})`;
            }
            return {
                id: variant.id,
                label: label,
                value: variant.resolution ?? null
            };
        })
    ], [variants]);

    const stableEpisodes = useMemo(() => {
        if (!animeDetails?.episodes) return [];
        return [...animeDetails.episodes].sort((a, b) => {
            const numA = parseFloat(a.number);
            const numB = parseFloat(b.number);
            return (isNaN(numA) ? 0 : numA) - (isNaN(numB) ? 0 : numB);
        });
    }, [animeDetails?.episodes]);

    const handleProgress = useCallback((payload: { positionSeconds: number; durationSeconds: number; isFinished: boolean }) => {
        if (!routeIds) return;
        void api
            .post("/user/progress", {
                anime_id: routeIds.animeId,
                episode: routeIds.episode,
                position_seconds: payload.positionSeconds,
                duration_seconds: payload.durationSeconds,
                is_finished: payload.isFinished
            })
            .catch((err) => {
                console.warn("Failed to update watch progress", err);
            });
    }, [routeIds]);

    const handleBack = useCallback(() => {

        router.back();
    }, [router]);

    return (
        <main className="h-screen w-screen overflow-hidden bg-black text-white">
            <div className="relative h-full w-full bg-black">
                {!error && (
                    <Player
                        source={stableSource || undefined}
                        title={animeDetails?.title}
                        episodeLabel={episodeLabel}
                        onBack={handleBack}
                        audioLanguages={stableAudioLanguages}
                        languageOptions={languageOptions}
                        currentLanguageId={language}
                        onChangeLanguage={handleChangeLanguage}
                        initialTimeSeconds={resumePositionSeconds ?? undefined}
                        onProgress={handleProgress}
                        introEndSeconds={
                            episodeMeta?.duration_seconds && episodeMeta.duration_seconds > 900
                                ? 90
                                : undefined
                        }
                        nextEpisodeHref={nextEpisodeHref}
                        nextEpisodeLabel={nextEpisodeLabel}
                        qualityOptions={stableQualityOptions}
                        currentQualityId={selectedQualityId ?? "auto"}
                        onChangeQuality={handleChangeQuality}
                        animeId={animeDetails?.id || routeIds?.animeId}
                        episodes={stableEpisodes}
                        seasons={seasons}
                        isMovie={animeDetails?.episode_count === 1}
                    />
                )}

                {error && (
                    <div className="flex h-full w-full items-center justify-center px-4 text-center">
                        <div className="space-y-2">
                            <p className="text-sm text-red-300">
                                {error}
                            </p>
                            <p className="text-xs text-neutral-300">
                                Try a different episode or title while we cannot load this one.
                            </p>
                        </div>
                    </div>
                )}
            </div>


        </main>
    );
}

