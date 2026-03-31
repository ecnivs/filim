"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/http";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { AnimeCard, type AnimeSummaryCard } from "./AnimeCard";
import { useState } from "react";
import { useProfile } from "@/lib/profile-context";

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
};

interface AnimeDetailViewProps {
    id: string;
    initialData?: AnimeDetails;
}

export function AnimeDetailView({ id, initialData }: AnimeDetailViewProps) {
    const queryClient = useQueryClient();
    const router = useRouter();
    const { profile } = useProfile();

    const {
        data,
        isLoading
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
        enabled: !!id && !profile?.is_guest,
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
        enabled: !profile?.is_guest,
        queryFn: async () => {
            const res = await api.get<{ items: PreferenceItem[] }>("/user/preferences");
            return res.data.items;
        }
    });

    const continueWatching = useQuery({
        queryKey: ["continue-watching"],
        enabled: !profile?.is_guest,
        queryFn: async () => {
            const res = await api.get<{ items: { anime_id: string; episode: string }[] }>("/user/continue-watching");
            return res.data.items;
        }
    });

    const animeProgress = useQuery({
        queryKey: ["anime-progress", id],
        enabled: !!id && !profile?.is_guest,
        queryFn: async () => {
            const res = await api.get<{ items: { anime_id: string; episode: string; progress: number }[] }>(`/user/progress/${id}`);
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
    const [showAllEpisodes, setShowAllEpisodes] = useState(false);

    if (isLoading || !data) {
        return (
            <div className="w-full bg-background min-h-[600px] flex flex-col">
                <div className="relative aspect-video w-full bg-neutral-900 animate-shimmer" />
                <div className="p-4 md:p-8 space-y-6">
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



    const sortedEpisodes = [...data.episodes].sort((a, b) => {
        const numA = parseFloat(a.number);
        const numB = parseFloat(b.number);
        return numA - numB;
    });

    const progress = continueWatching.data?.find(item => item.anime_id === data?.id);
    const hasProgress = !!progress?.episode;

    const resumeHref = (() => {
        if (!data) return "#";
        if (hasProgress) {
            return `/watch/${data.id}/${progress.episode}`;
        }
        return `/watch/${data.id}/${sortedEpisodes[0]?.number || "1"}`;
    })();

    return (
        <div className="w-full bg-background flex flex-col rounded-xl overflow-hidden">
            {/* Banner Section */}
            <section className="relative aspect-[16/9] md:aspect-video w-full overflow-hidden">
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
                <div className="absolute bottom-0 left-0 right-0 p-4 md:p-8 flex flex-col gap-3 md:gap-4">
                    <h1 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-black text-white drop-shadow-2xl">
                        {data.title}
                    </h1>
                    <div className="flex items-center gap-2 md:gap-3">
                        <Link
                            href={resumeHref}
                            className="inline-flex items-center gap-2 rounded bg-ncyan px-5 md:px-8 py-2.5 md:py-2.5 text-sm md:text-base font-bold text-black hover:bg-ncyan-light transition-colors shadow-lg shadow-ncyan/20 min-h-[44px]"
                        >
                            <svg viewBox="0 0 24 24" className="w-5 h-5 md:w-6 md:h-6" fill="currentColor">
                                <path d="M6 4l15 8-15 8V4z" />
                            </svg>
                            {hasProgress ? "Resume" : "Play"}
                        </Link>
                        {!profile?.is_guest && (
                            <button
                                onClick={() => handleToggleList(data.id)}
                                className="flex h-9 w-9 md:h-11 md:w-11 items-center justify-center rounded-full border-2 border-neutral-400 text-white hover:border-white transition-colors bg-black/40"
                            >
                                {getPreferenceForAnime(data.id)?.in_list ? (
                                    <svg viewBox="0 0 24 24" className="w-5 h-5 md:w-6 md:h-6" fill="currentColor">
                                        <path d="M9 16.2L4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4L9 16.2z" />
                                    </svg>
                                ) : (
                                    <svg viewBox="0 0 24 24" className="w-5 h-5 md:w-6 md:h-6" fill="currentColor">
                                        <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z" />
                                    </svg>
                                )}
                            </button>
                        )}
                    </div>
                </div>
            </section>

            {/* Content Section */}
            <div className="p-4 md:p-8 space-y-8 md:space-y-12">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-8">
                    <div className="md:col-span-2 space-y-4 md:space-y-6">
                        <div className="flex items-center gap-2 text-xs md:text-sm text-neutral-400 font-semibold">
                            <span>{new Date().getFullYear()}</span>
                            <span>{data.episode_count} Episodes</span>
                        </div>
                        <div className="text-[13px] md:text-lg text-white leading-relaxed whitespace-pre-wrap">
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
                <section className="space-y-4 md:space-y-6">
                    <div className="flex items-center justify-between">
                        <div className="flex flex-col gap-1">
                            <h2 className="text-xl md:text-3xl font-black text-white uppercase tracking-tight">
                                {filteredSeasons.length > 1 ? currentSeason?.title : "Episodes"}
                            </h2>
                        </div>
                        {filteredSeasons.length > 1 && (
                            <select
                                value={data.id}
                                onChange={(e) => {
                                    router.push(`/anime/${e.target.value}`, { scroll: false });
                                }}
                                className="bg-neutral-800 text-white text-[0.65rem] md:text-xs font-black uppercase tracking-widest py-2 md:py-2.5 px-3 md:px-4 rounded border border-white/10 outline-none hover:bg-neutral-700 transition-colors cursor-pointer"
                            >
                                {filteredSeasons.map(item => (
                                    <option key={item.id} value={item.id}>{item.title}</option>
                                ))}
                            </select>
                        )}
                    </div>

                    <div className="flex flex-col gap-1">
                        {(showAllEpisodes ? sortedEpisodes : sortedEpisodes.slice(0, 10)).map((ep, idx) => {
                            const epProgress = animeProgress.data?.find(p => p.episode === ep.number);
                            const progressPercent = epProgress ? Math.min(Math.max(epProgress.progress * 100, 0), 100) : 0;

                            return (
                                <Link
                                    key={ep.number}
                                    href={`/watch/${data.id}/${ep.number}`}
                                    className="group flex items-center text-left gap-3 md:gap-6 p-3 py-4 md:p-4 rounded-lg bg-neutral-900/50 hover:bg-neutral-800 active:bg-neutral-700 transition-colors border-b border-neutral-800/50 last:border-0"
                                >
                                    <span className="text-lg md:text-2xl font-black text-neutral-600 w-6 md:w-8 text-center shrink-0">
                                        {idx + 1}
                                    </span>

                                    {/* Thumbnail — hidden on very small screens */}
                                    <div className="relative aspect-video w-28 sm:w-36 md:w-48 overflow-hidden rounded bg-neutral-800 flex-shrink-0 hidden sm:block">
                                        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/40 z-10">
                                            <svg viewBox="0 0 24 24" className="w-8 md:w-10 h-8 md:h-10 text-white" fill="currentColor">
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
                                        {progressPercent > 0 && (
                                            <div className="absolute bottom-0 left-0 right-0 h-1 md:h-1.5 bg-neutral-600/50 z-20">
                                                <div
                                                    className="h-full bg-ncyan transition-all duration-300"
                                                    style={{ width: `${progressPercent}%` }}
                                                />
                                            </div>
                                        )}
                                    </div>

                                    <div className="flex-1 min-w-0 py-1 md:py-2 flex flex-col justify-center">
                                        <div className="flex items-center justify-between gap-2 md:gap-4 mb-1 md:mb-2">
                                            <h3 className="text-sm md:text-base font-bold text-white truncate">
                                                {ep.title || `Episode ${ep.number}`}
                                            </h3>
                                            {/* Mobile play indicator */}
                                            <svg viewBox="0 0 24 24" className="w-4 h-4 text-neutral-500 shrink-0 sm:hidden" fill="currentColor">
                                                <path d="M6 4l15 8-15 8V4z" />
                                            </svg>
                                        </div>
                                        <p className="text-xs md:text-sm text-neutral-400 line-clamp-1 md:line-clamp-2 leading-relaxed hidden sm:block">
                                            Watch the latest episode of {data.title}. Continuous high-quality streaming experience.
                                        </p>
                                        {/* Mobile progress bar */}
                                        {progressPercent > 0 && (
                                            <div className="mt-2 h-1 w-full bg-neutral-600/50 rounded overflow-hidden sm:hidden">
                                                <div
                                                    className="h-full bg-ncyan transition-all duration-300"
                                                    style={{ width: `${progressPercent}%` }}
                                                />
                                            </div>
                                        )}
                                    </div>
                                </Link>
                            );
                        })}
                    </div>

                    {sortedEpisodes.length > 10 && (
                        <button
                            onClick={() => setShowAllEpisodes(!showAllEpisodes)}
                            className="w-full flex items-center justify-center py-4 mt-2 border border-white/10 rounded-lg bg-neutral-900/40 hover:bg-neutral-800 transition-colors text-white group"
                        >
                            <span className="text-sm font-semibold mr-2">{showAllEpisodes ? "Show Less" : "Show More"}</span>
                            <svg viewBox="0 0 24 24" className={`w-5 h-5 transition-transform duration-300 ${showAllEpisodes ? "rotate-180" : "group-hover:translate-y-1"}`} fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                        </button>
                    )}
                </section>

                {/* More Like This */}
                {moreLikeThis && moreLikeThis.items.filter(item => item.id !== data.id).length > 0 && (
                    <section className="space-y-4 md:space-y-6">
                        <h2 className="text-xl md:text-2xl font-black text-white">More Like This</h2>
                        <div className="grid grid-cols-3 sm:grid-cols-3 gap-x-2 gap-y-4 md:gap-4">
                            {moreLikeThis.items.filter(item => item.id !== data.id).slice(0, 6).map(anime => (
                                <AnimeCard
                                    key={anime.id}
                                    anime={anime}
                                    isInList={getPreferenceForAnime(anime.id)?.in_list ?? false}
                                    onToggleList={() => handleToggleList(anime.id)}
                                    widthClassName="w-full"
                                    variant="simple"
                                />
                            ))}
                        </div>
                    </section>
                )}
            </div>
        </div>
    );
}
