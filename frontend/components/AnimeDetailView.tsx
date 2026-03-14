"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/http";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { AnimeCard, type AnimeSummaryCard } from "./AnimeCard";
import { useState } from "react";

type Episode = {
    number: string;
    title?: string | null;
};

type AnimeDetails = {
    id: string;
    title: string;
    episode_count: number;
    episodes: Episode[];
    synopsis?: string | null;
    cover_image_url?: string | null;
    tags?: string[];
    available_audio_languages?: string[];
};

type RecommendationSection = {
    id: string;
    title: string;
    items: AnimeSummaryCard[];
};

type PreferenceItem = {
    anime_id: string;
    in_list: boolean;
    rating?: "like" | "dislike" | null;
};

interface AnimeDetailViewProps {
    id: string;
    initialData?: AnimeDetails;
    onClose?: () => void;
}

export function AnimeDetailView({ id, initialData, onClose }: AnimeDetailViewProps) {
    const queryClient = useQueryClient();
    const router = useRouter();

    const {
        data,
        isLoading,
        isError
    } = useQuery({
        queryKey: ["anime", id],
        initialData,
        queryFn: async () => {
            const res = await api.get<AnimeDetails>(`/catalog/${id}`);
            return res.data;
        }
    });

    const recs = useQuery({
        queryKey: ["anime-recs", id],
        enabled: !!id,
        queryFn: async () => {
            const res = await api.get<{ sections: RecommendationSection[] }>(
                "/user/recommendations"
            );
            return res.data.sections;
        }
    });

    const moreLikeThis =
        recs.data?.find((s) => s.id !== "trending") ?? recs.data?.[0];

    const preferences = useQuery({
        queryKey: ["preferences"],
        queryFn: async () => {
            const res = await api.get<{ items: PreferenceItem[] }>("/user/preferences");
            return res.data.items;
        }
    });

    const continueWatching = useQuery({
        queryKey: ["continue-watching"],
        queryFn: async () => {
            const res = await api.get<{ items: { anime_id: string; episode: string }[] }>("/user/continue-watching");
            return res.data.items;
        }
    });

    const getPreferenceForAnime = (animeId: string): PreferenceItem | undefined => {
        return preferences.data?.find((item) => item.anime_id === animeId);
    };

    const toggleList = useMutation({
        mutationFn: async (payload: { animeId: string; inList: boolean }) => {
            await api.post("/user/preferences/list", {
                anime_id: payload.animeId,
                in_list: payload.inList
            });
        },
        onSuccess: () => {
            void queryClient.invalidateQueries({ queryKey: ["preferences"] });
        }
    });

    const updateRating = useMutation({
        mutationFn: async (payload: { animeId: string; rating: "like" | "dislike" | null }) => {
            await api.post("/user/preferences/rating", {
                anime_id: payload.animeId,
                rating: payload.rating
            });
        },
        onSuccess: () => {
            void queryClient.invalidateQueries({ queryKey: ["preferences"] });
        }
    });

    const series = useQuery({
        queryKey: ["anime-series", id],
        enabled: !!id,
        queryFn: async () => {
            const res = await api.get<{ items: AnimeSummaryCard[] }>(
                `/catalog/${id}/series`
            );
            return res.data.items;
        }
    });

    const filteredSeasons = (series.data || []).filter(s =>
        /season|s\d+|part|cour/i.test(s.title) ||
        s.id === id
    );

    const currentSeason = filteredSeasons.find(s => s.id === id) || filteredSeasons[0];

    const [synopsisExpanded, setSynopsisExpanded] = useState(false);

    if (isLoading || !data) {
        return (
            <div className="w-full bg-background min-h-[600px] flex flex-col">
                <div className="relative aspect-video w-full bg-neutral-900 animate-shimmer" />
                <div className="p-8 space-y-6">
                    <div className="h-8 w-64 bg-neutral-800 rounded animate-shimmer" />
                    <div className="space-y-2">
                        <div className="h-4 w-full bg-neutral-800 rounded animate-shimmer" />
                        <div className="h-4 w-5/6 bg-neutral-800 rounded animate-shimmer" />
                    </div>
                </div>
            </div>
        );
    }

    const cleanSynopsis = data.synopsis?.replace(/\(Source:.*?\)/g, "").trim();

    const handleToggleList = (animeId: string) => {
        const current = getPreferenceForAnime(animeId);
        const nextInList = !current?.in_list;
        toggleList.mutate({ animeId, inList: nextInList });
    };

    const handleSetRating = (animeId: string, rating: "like" | "dislike") => {
        const current = getPreferenceForAnime(animeId);
        const nextRating = current?.rating === rating ? null : rating;
        updateRating.mutate({ animeId, rating: nextRating });
    };

    const sortedEpisodes = [...data.episodes].sort((a, b) => {
        const numA = parseFloat(a.number);
        const numB = parseFloat(b.number);
        return numA - numB;
    });

    const resumeHref = (() => {
        if (!data) return "#";
        const progress = continueWatching.data?.find(item => item.anime_id === data.id);
        if (progress && progress.episode) {
            return `/watch/${data.id}/${progress.episode}`;
        }
        return `/watch/${data.id}/${sortedEpisodes[0]?.number || "1"}`;
    })();

    return (
        <div className="w-full bg-background flex flex-col rounded-xl overflow-hidden">
            {/* Banner Section */}
            <section className="relative aspect-video w-full overflow-hidden">
                {data.cover_image_url && (
                    <Image
                        src={data.cover_image_url}
                        alt={data.title}
                        fill
                        priority
                        className="object-cover"
                        unoptimized
                    />
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-background via-black/20 to-transparent" />
                <div className="absolute bottom-0 left-0 right-0 p-8 flex flex-col gap-4">
                    <h1 className="text-4xl md:text-5xl font-black text-white drop-shadow-2xl">
                        {data.title}
                    </h1>
                    <div className="flex items-center gap-3">
                        <Link
                            href={resumeHref}
                            className="inline-flex items-center gap-2 rounded bg-ncyan px-8 py-2.5 text-base font-bold text-black hover:bg-ncyan-light transition-colors shadow-lg shadow-ncyan/20"
                        >
                            <svg viewBox="0 0 24 24" className="w-6 h-6" fill="currentColor">
                                <path d="M6 4l15 8-15 8V4z" />
                            </svg>
                            Resume
                        </Link>
                        <button
                            onClick={() => handleToggleList(data.id)}
                            className="flex h-11 w-11 items-center justify-center rounded-full border-2 border-neutral-400 text-white hover:border-white transition-colors bg-black/40"
                        >
                            {getPreferenceForAnime(data.id)?.in_list ? (
                                <svg viewBox="0 0 24 24" className="w-6 h-6" fill="currentColor">
                                    <path d="M9 16.2L4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4L9 16.2z" />
                                </svg>
                            ) : (
                                <svg viewBox="0 0 24 24" className="w-6 h-6" fill="currentColor">
                                    <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z" />
                                </svg>
                            )}
                        </button>
                        <button
                            onClick={() => handleSetRating(data.id, "like")}
                            className={`flex h-11 w-11 items-center justify-center rounded-full border-2 transition-colors bg-black/40 ${getPreferenceForAnime(data.id)?.rating === "like"
                                ? "border-white bg-white text-black"
                                : "border-neutral-400 text-white hover:border-white"
                                }`}
                        >
                            <svg viewBox="0 0 24 24" className="w-5 h-5" fill="currentColor">
                                <path d="M1 21h4V9H1v12zm22-11c0-1.1-.9-2-2-2h-6.31l.95-4.57.03-.32c0-.41-.17-.79-.44-1.06L14.17 1 7.59 7.59C7.22 7.95 7 8.45 7 9v10c0 1.1.9 2 2 2h9c.83 0 1.54-.5 1.84-1.22l3.02-7.05c.09-.23.14-.47.14-.73v-2z" />
                            </svg>
                        </button>
                    </div>
                </div>
            </section>

            {/* Content Section */}
            <div className="p-8 space-y-12">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                    <div className="md:col-span-2 space-y-6">
                        <div className="flex items-center gap-2 text-sm text-neutral-400 font-semibold">
                            <span>{new Date().getFullYear()}</span>
                            <span>{data.episode_count} Episodes</span>
                        </div>
                        <div className="text-lg text-white leading-relaxed whitespace-pre-wrap">
                            {synopsisExpanded ? (
                                <>
                                    {cleanSynopsis}
                                    {(cleanSynopsis?.length || 0) > 300 && (
                                        <button
                                            onClick={() => setSynopsisExpanded(false)}
                                            className="ml-1 text-neutral-400 hover:text-white font-bold transition-colors inline-block"
                                        >
                                            less
                                        </button>
                                    )}
                                </>
                            ) : (cleanSynopsis?.length || 0) <= 300 ? (
                                cleanSynopsis
                            ) : (
                                <>
                                    {cleanSynopsis?.slice(0, 300)}...
                                    <button
                                        onClick={() => setSynopsisExpanded(true)}
                                        className="ml-1 text-neutral-400 hover:text-white font-bold transition-colors inline-block"
                                    >
                                        more
                                    </button>
                                </>
                            )}
                        </div>
                    </div>
                    <div className="space-y-4">
                        <div className="space-y-1">
                            <span className="text-xs text-neutral-500 font-bold">Genres:</span>
                            <div className="flex flex-wrap gap-2">
                                {data.tags?.map(tag => (
                                    <span key={tag} className="text-xs text-white hover:underline cursor-pointer">{tag}</span>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Episodes Section */}
                <section className="space-y-6">
                    <div className="flex items-center justify-between">
                        <div className="flex flex-col gap-1">
                            <h2 className="text-3xl font-black text-white uppercase tracking-tight">
                                {filteredSeasons.length > 1 ? currentSeason?.title : "Episodes"}
                            </h2>
                        </div>
                        {filteredSeasons.length > 1 && (
                            <select
                                value={data.id}
                                onChange={(e) => {
                                    router.push(`/anime/${e.target.value}`, { scroll: false });
                                }}
                                className="bg-neutral-800 text-white text-xs font-black uppercase tracking-widest py-2.5 px-4 rounded border border-white/10 outline-none hover:bg-neutral-700 transition-colors cursor-pointer"
                            >
                                {filteredSeasons.map(item => (
                                    <option key={item.id} value={item.id}>{item.title}</option>
                                ))}
                            </select>
                        )}
                    </div>

                    <div className="flex flex-col gap-1">
                        {sortedEpisodes.map((ep, idx) => (
                            <Link
                                key={ep.number}
                                href={`/watch/${data.id}/${ep.number}`}
                                className="group flex flex-col sm:flex-row items-start sm:items-center text-left gap-6 p-4 rounded-lg bg-neutral-900/50 hover:bg-neutral-800 transition-colors border-b border-neutral-800/50 last:border-0"
                            >
                                <span className="text-2xl font-black text-neutral-600 w-8 text-center hidden sm:block">
                                    {idx + 1}
                                </span>
                                <div className="relative aspect-video w-full sm:w-48 overflow-hidden rounded bg-neutral-800 flex-shrink-0">
                                    <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/40">
                                        <svg viewBox="0 0 24 24" className="w-10 h-10 text-white" fill="currentColor">
                                            <path d="M6 4l15 8-15 8V4z" />
                                        </svg>
                                    </div>
                                    {data.cover_image_url && (
                                        <Image
                                            src={data.cover_image_url}
                                            alt={ep.title || `Episode ${ep.number}`}
                                            fill
                                            className="object-cover opacity-60"
                                            unoptimized
                                        />
                                    )}
                                </div>
                                <div className="flex-1 min-w-0 py-2">
                                    <div className="flex items-center justify-between gap-4 mb-2">
                                        <h3 className="text-base font-bold text-white truncate">
                                            {ep.title || `Episode ${ep.number}`}
                                        </h3>
                                    </div>
                                    <p className="text-sm text-neutral-400 line-clamp-2 leading-relaxed">
                                        Watch the latest episode of {data.title}. Continuous high-quality streaming experience.
                                    </p>
                                </div>
                            </Link>
                        ))}
                    </div>
                </section>

                {/* More Like This */}
                {moreLikeThis && moreLikeThis.items.length > 0 && (
                    <section className="space-y-6">
                        <h2 className="text-2xl font-black text-white">More Like This</h2>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                            {moreLikeThis.items.slice(0, 6).map(anime => (
                                <AnimeCard
                                    key={anime.id}
                                    anime={anime}
                                    isInList={getPreferenceForAnime(anime.id)?.in_list ?? false}
                                    rating={getPreferenceForAnime(anime.id)?.rating ?? null}
                                    onToggleList={() => handleToggleList(anime.id)}
                                    onSetRating={(next) => next && handleSetRating(anime.id, next)}
                                    widthClassName="w-full"
                                />
                            ))}
                        </div>
                    </section>
                )}
            </div>
        </div>
    );
}
