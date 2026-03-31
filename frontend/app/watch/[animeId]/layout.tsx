"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useState, useMemo, useCallback } from "react";
import { api } from "@/lib/http";
import { Player } from "@/components/Player";
import { WatchProvider, useWatch } from "./WatchContext";

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

function WatchLayoutInner({ children }: { children: React.ReactNode }) {
    const params = useParams<{ animeId: string; episode: string }>();
    const router = useRouter();
    const { state } = useWatch();
    
    const [language, setLanguage] = useState<string>("ja");
    const [selectedQualityId, setSelectedQualityId] = useState<string | null>(null);
    const [animeDetails, setAnimeDetails] = useState<AnimeDetails | null>(null);
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

    // Fetch Anime Details (Once per animeId)
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

                // Fetch series/seasons
                try {
                    const seriesRes = await api.get<{ items: { id: string; title: string }[] }>(
                        `/catalog/${routeIds.animeId}/series`
                    );
                    if (cancelled) return;
                    setSeasons(prev => {
                        const newList = [...seriesRes.data.items];
                        if (!newList.find(s => s.id === res.data.id)) {
                            newList.unshift({ id: res.data.id, title: res.data.title });
                        }
                        return newList;
                    });
                } catch { /* ignore */ }
            } catch (err) {
                console.warn("Failed to load anime details", err);
            }
        }
        void fetchDetails();
        return () => { cancelled = true; };
    }, [routeIds?.animeId]);

    // Audio Preference
    useEffect(() => {
        async function fetchAudioPreference() {
            try {
                const res = await api.get<{ item: { audio_language_id: string } | null }>(
                    "/audio-preference"
                );
                const pref = res.data.item?.audio_language_id;
                if (!pref) return;
                if (pref === "ja" || pref === "en") setLanguage(pref);
                else if (pref === "sub") setLanguage("ja");
                else if (pref === "dub") setLanguage("en");
            } catch { /* ignore */ }
        }
        void fetchAudioPreference();
    }, []);

    const episodeMeta = useMemo(() => {
        if (!animeDetails || !routeIds) return null;
        return animeDetails.episodes.find((ep) => {
            const epNum = String(ep.number).toLowerCase().replace(/^e/, '');
            const routeNum = String(routeIds.episode).toLowerCase().replace(/^e/, '');
            return epNum === routeNum || epNum.padStart(2, '0') === routeNum.padStart(2, '0');
        }) ?? null;
    }, [animeDetails, routeIds]);

    const episodeLabel = episodeMeta
        ? `E${episodeMeta.number}${episodeMeta.title ? ` • ${episodeMeta.title}` : ""}`
        : `E${routeIds?.episode ?? "?"}`;

    const nextEpisode = useMemo(() => {
        if (!animeDetails || !episodeMeta) return null;
        const index = animeDetails.episodes.findIndex((ep) => ep.number === episodeMeta.number);
        return animeDetails.episodes[index + 1] ?? null;
    }, [animeDetails, episodeMeta]);

    const nextEpisodeHref = nextEpisode ? `/watch/${animeDetails?.id}/${nextEpisode.number}` : undefined;
    const nextEpisodeLabel = nextEpisode ? `Episode ${nextEpisode.number}${nextEpisode.title ? ` • ${nextEpisode.title}` : ""}` : undefined;

    const languageOptions = useMemo(() => {
        if (animeDetails?.available_audio_languages?.length) {
            return animeDetails.available_audio_languages.map(code => ({
                id: code,
                label: code === "en" ? "English" : "Japanese (日本語)"
            }));
        }
        return [{ id: "ja", label: "Japanese (日本語)" }, { id: "en", label: "English" }];
    }, [animeDetails]);

    const handleChangeLanguage = useCallback((nextId: string) => {
        setLanguage(nextId);
        api.post("/audio-preference", { audio_language_id: nextId }).catch(() => {});
    }, []);

    const stableQualityOptions = useMemo(() => [
        { id: "auto", label: "Auto", value: null },
        ...state.variants.map((v) => ({
            id: v.id,
            label: v.resolution ? `${v.resolution} (${v.provider || "Source"})` : (v.provider || "Source"),
            value: v.resolution ?? null
        }))
    ], [state.variants]);

    const handleProgress = useCallback((payload: any) => {
        if (!routeIds) return;
        api.post("/user/progress", {
            anime_id: routeIds.animeId,
            episode: routeIds.episode,
            position_seconds: payload.positionSeconds,
            duration_seconds: payload.durationSeconds,
            is_finished: payload.isFinished
        }).catch(() => {});
    }, [routeIds]);

    const handleBack = useCallback(() => router.back(), [router]);

    return (
        <main className="h-screen w-screen overflow-hidden bg-black text-white">
            <div className="relative h-full w-full bg-black">
                {!state.error && (
                    <Player
                        source={state.manifestUrl ? { url: state.manifestUrl } : undefined}
                        title={animeDetails?.title}
                        episodeLabel={episodeLabel}
                        onBack={handleBack}
                        audioLanguages={state.audioLanguages?.map(l => ({ 
                            id: l.id, label: l.label, code: l.code ?? null, isDefault: l.is_default ?? false 
                        }))}
                        languageOptions={languageOptions}
                        currentLanguageId={language}
                        onChangeLanguage={handleChangeLanguage}
                        initialTimeSeconds={state.resumePositionSeconds ?? undefined}
                        onProgress={handleProgress}
                        introEndSeconds={episodeMeta?.duration_seconds && episodeMeta.duration_seconds > 900 ? 90 : undefined}
                        nextEpisodeHref={nextEpisodeHref}
                        nextEpisodeLabel={nextEpisodeLabel}
                        qualityOptions={stableQualityOptions}
                        currentQualityId={selectedQualityId ?? "auto"}
                        onChangeQuality={setSelectedQualityId}
                        animeId={animeDetails?.id || routeIds?.animeId}
                        episodes={animeDetails?.episodes || []}
                        seasons={seasons}
                        isMovie={animeDetails?.episode_count === 1}
                    />
                )}

                {state.error && (
                    <div className="flex h-full w-full items-center justify-center px-4 text-center">
                        <div className="space-y-2">
                            <p className="text-sm text-red-300">{state.error}</p>
                            <p className="text-xs text-neutral-300">Try a different episode or title.</p>
                        </div>
                    </div>
                )}
            </div>
            
            {/* Hidden layer for children (page) to process its side-effects */}
            <div className="hidden">{children}</div>
        </main>
    );
}

export default function WatchLayout({ children }: { children: React.ReactNode }) {
    return (
        <WatchProvider>
            <WatchLayoutInner>{children}</WatchLayoutInner>
        </WatchProvider>
    );
}
