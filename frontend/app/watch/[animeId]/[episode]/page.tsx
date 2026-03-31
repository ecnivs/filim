"use client";

import { useParams } from "next/navigation";
import { useEffect, useMemo } from "react";
import { api } from "@/lib/http";
import { useWatch } from "../WatchContext";

export default function WatchPage() {
    const params = useParams<{ animeId: string; episode: string }>();
    const { setEpisodeData } = useWatch();

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

    useEffect(() => {
        if (!routeIds) return;

        let cancelled = false;

        async function fetchData() {
            setEpisodeData({ 
                isPageLoading: true, 
                error: null,
                manifestUrl: null,
                variants: []
            });
            
            try {
                // Fetch progress
                let resumePosition = null;
                try {
                    const progressRes = await api.get<{ items: any[] }>(`/user/progress/${routeIds!.animeId}`);
                    const match = progressRes.data.items.find(i => i.episode === routeIds!.episode);
                    if (match && match.position_seconds < match.duration_seconds) {
                        resumePosition = match.position_seconds;
                    }
                } catch { /* ignore */ }

                // Fetch stream
                const streamRes = await api.get<any>(
                    `/anime/${routeIds!.animeId}/episodes/${routeIds!.episode}/stream`
                );
                
                if (!cancelled) {
                    setEpisodeData({
                        manifestUrl: streamRes.data.manifest_url,
                        variants: streamRes.data.variants,
                        audioLanguages: streamRes.data.audio_languages,
                        resumePositionSeconds: resumePosition,
                        isPageLoading: false,
                        error: null
                    });
                }
            } catch (err: any) {
                if (!cancelled) {
                    setEpisodeData({
                        error: err?.response?.data?.detail || "Episode unavailable.",
                        isPageLoading: false
                    });
                }
            }
        }

        void fetchData();
        return () => { cancelled = true; };
    }, [routeIds?.animeId, routeIds?.episode, setEpisodeData]);

    return null; // The layout handles all rendering
}

