"use client";

import { useMutation, useQuery, useQueryClient, useInfiniteQuery } from "@tanstack/react-query";
import { api } from "@/lib/http";
import Link from "next/link";
import Image from "next/image";
import { AnimeCard, type AnimeSummaryCard as AnimeSummary } from "@/components/AnimeCard";
import { SectionRow } from "@/components/SectionRow";
import { useSearchParams } from "next/navigation";
import { ContinueCard } from "@/components/ContinueCard";
import { useEffect } from "react";
import { useInView } from "react-intersection-observer";
import { usePreferences } from "@/hooks/usePreferences";

type ContinueWatchingItem = {
    anime_id: string;
    episode: string;
    progress: number;
    position_seconds?: number;
    duration_seconds?: number;
    anime_title?: string | null;
    cover_image_url?: string | null;
};

type RecommendationSection = {
    id: string;
    title: string;
    items: AnimeSummary[];
};

type PreferenceItem = {
    anime_id: string;
    in_list: boolean;
};

type PreferencesResponse = {
    items: PreferenceItem[];
};

import { GridView } from "@/components/GridView";

export default function HomePage() {
    const queryClient = useQueryClient();
    const searchParams = useSearchParams();
    const urlQuery = searchParams.get("q") || "";

    const continueWatching = useQuery({
        queryKey: ["continue-watching"],
        queryFn: async () => {
            const res = await api.get<{ items: ContinueWatchingItem[] }>(
                "/user/continue-watching"
            );
            return res.data.items;
        },
        staleTime: 0,
        refetchOnMount: "always",
    });

    const recommendations = useQuery({
        queryKey: ["recommendations"],
        queryFn: async () => {
            const res = await api.get<{ sections: RecommendationSection[] }>(
                "/user/recommendations"
            );
            return res.data.sections;
        }
    });



    const discovery = useInfiniteQuery({
        queryKey: ["discovery"],
        queryFn: async ({ pageParam = 1 }) => {
            const res = await api.get<{ sections: RecommendationSection[] }>(
                "/user/recommendations/discovery",
                { params: { page: pageParam, limit: 3 } }
            );
            return res.data.sections;
        },
        getNextPageParam: (lastPage, allPages) => {
            if (allPages.length >= 50) return undefined;
            if (lastPage && lastPage.length === 0 && allPages.length > 5) return undefined;
            return allPages.length + 1;
        },
        initialPageParam: 1,
    });

    const { ref, inView } = useInView({
        threshold: 0,
        rootMargin: "400px",
    });

    useEffect(() => {
        if (inView && discovery.hasNextPage && !discovery.isFetchingNextPage) {
            void discovery.fetchNextPage();
        }
    }, [inView, discovery.hasNextPage, discovery.isFetchingNextPage, discovery.fetchNextPage]);

    const searchResults = useInfiniteQuery({
        queryKey: ["search", urlQuery],
        enabled: urlQuery.length > 0,
        queryFn: async ({ pageParam = 1 }) => {
            const res = await api.get<{ items: AnimeSummary[] }>("/catalog/search", {
                params: { q: urlQuery, mode: "sub", page: pageParam }
            });
            return res.data;
        },
        getNextPageParam: (lastPage, allPages) => {
            if (!lastPage || lastPage.items.length === 0) return undefined;
            return allPages.length + 1;
        },
        initialPageParam: 1,
    });

    const { handleToggleList, isInList } = usePreferences();

    const featuredAnime = (() => {
        const candidates = [
            ...(recommendations.data?.flatMap((s) => s.items) || [])
        ];
        const withBanners = candidates.filter((a) => a.banner_image_url && a.banner_image_url.startsWith("http"));
        const withPosters = candidates.filter((a) => a.poster_image_url && a.poster_image_url.startsWith("http"));

        return withBanners[0] || withPosters[0];
    })();

    const billboardResumeHref = (() => {
        if (!featuredAnime) return "#";
        const progress = continueWatching.data?.find(item => item.anime_id === featuredAnime.id);
        if (progress && progress.episode) {
            return `/watch/${featuredAnime.id}/${progress.episode}`;
        }
        return `/watch/${featuredAnime.id}/1`;
    })();

    const isInitialLoading = recommendations.isLoading || discovery.isLoading;

    return (
        <div className="min-h-screen">
            {urlQuery ? (
                <GridView
                    title={`Search results for "${urlQuery}"`}
                    infiniteQuery={searchResults as any}
                    emptyMessage="No results found."
                />
            ) : (
                <>
                    {featuredAnime && (
                        <section className="relative w-full h-[56vh] md:h-[80vh] min-h-[320px] md:min-h-[500px]">
                            <div className="absolute inset-0">
                                {featuredAnime.banner_image_url || featuredAnime.poster_image_url ? (
                                    <Image
                                        src={featuredAnime.banner_image_url || (featuredAnime.poster_image_url as string)}
                                        alt={featuredAnime.title}
                                        fill
                                        priority
                                        sizes="100vw"
                                        className="object-cover"
                                        unoptimized
                                    />
                                ) : null}
                                <div className="absolute inset-0 bg-gradient-to-r from-background via-background/60 to-transparent" />
                                <div className="absolute inset-0 bg-gradient-to-t from-background via-transparent to-transparent" />
                                <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-background to-transparent" />
                            </div>
                            <div className="relative z-10 flex h-full items-end pb-16 md:pb-24 lg:pb-32 px-[4%]">
                                <div className="max-w-lg animate-fade-in-up space-y-3 md:space-y-4">
                                    <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-black text-white leading-[1.1] drop-shadow-[0_2px_8px_rgba(0,0,0,0.8)]">
                                        {featuredAnime.title}
                                    </h1>
                                    {featuredAnime.synopsis && (
                                        <p className="text-xs md:text-sm lg:text-base text-neutral-200 line-clamp-2 md:line-clamp-3 leading-relaxed">
                                            {featuredAnime.synopsis}
                                        </p>
                                    )}
                                    <div className="flex items-center gap-2 md:gap-3 pt-1">
                                        <Link
                                            href={billboardResumeHref}
                                            className="inline-flex items-center gap-2 rounded bg-ncyan px-5 md:px-6 py-2.5 md:py-2.5 text-sm font-bold text-black hover:bg-ncyan-light transition-colors shadow-lg shadow-ncyan/20 min-h-[44px]"
                                        >
                                            <span className="text-base md:text-lg">▶</span> Play
                                        </Link>
                                        <Link
                                            href={`/anime/${featuredAnime.id}`}
                                            className="flex items-center gap-2 rounded bg-neutral-500/50 px-4 md:px-6 py-2.5 md:py-2.5 text-xs md:text-sm font-bold text-white transition hover:bg-neutral-500/70 backdrop-blur-md min-h-[44px]"
                                        >
                                            <span className="text-base md:text-lg">ⓘ</span>
                                            More Info
                                        </Link>
                                    </div>
                                </div>
                            </div>
                        </section>
                    )}

                    <div className="relative z-10 -mt-10 md:-mt-16 space-y-4 md:space-y-6 pb-4">
                        {continueWatching.data && continueWatching.data.length > 0 && (
                            <SectionRow title="Continue Watching">
                                {continueWatching.data
                                    .filter(
                                        (item) =>
                                            item.anime_id &&
                                            item.anime_id !== "undefined" &&
                                            item.episode &&
                                            item.episode !== "undefined"
                                    )
                                    .map((item) => {
                                        return (
                                            <ContinueCard
                                                key={`${item.anime_id}-${item.episode}`}
                                                title={
                                                    item.anime_title && item.anime_title.length > 0
                                                        ? item.anime_title
                                                        : `Episode ${item.episode}`
                                                }
                                                subtitle={`Episode ${item.episode}`}
                                                href={`/watch/${item.anime_id}/${item.episode}`}
                                                coverImageUrl={item.cover_image_url ?? undefined}
                                                progress={item.progress}
                                                positionSeconds={item.position_seconds}
                                                durationSeconds={item.duration_seconds}
                                                isInList={isInList(item.anime_id)}
                                                onToggleList={() => handleToggleList(item.anime_id)}
                                                animeId={item.anime_id}
                                            />
                                        );
                                    })}
                            </SectionRow>
                        )}

                        {recommendations.data?.filter(section => section.items.length > 0).map((section) => (
                            <SectionRow key={section.id} title={section.title}>
                                {section.items.map((anime) => (
                                    <AnimeCard
                                        key={anime.id}
                                        anime={anime}
                                        isInList={isInList(anime.id)}
                                        onToggleList={() => handleToggleList(anime.id)}
                                    />
                                ))}
                            </SectionRow>
                        ))}



                        {/* Infinite Discovery Rows */}
                        {discovery.data?.pages.map((page) =>
                            page.map((section) => (
                                <SectionRow key={section.id} title={section.title}>
                                    {section.items.map((anime) => (
                                        <AnimeCard
                                            key={anime.id}
                                            anime={anime}
                                            isInList={isInList(anime.id)}
                                            onToggleList={() => handleToggleList(anime.id)}
                                        />
                                    ))}
                                </SectionRow>
                            ))
                        )}

                        {/* Intersection Observer Trigger & Completion Message */}
                        <div ref={ref} className="min-h-[100px] flex items-center justify-center w-full">
                            {discovery.isFetchingNextPage || isInitialLoading ? (
                                <div className="flex flex-col items-center gap-2 py-8">
                                    <div className="flex gap-1.5">
                                        <div className="w-2 h-2 bg-ncyan rounded-full animate-bounce [animation-delay:-0.3s]"></div>
                                        <div className="w-2 h-2 bg-ncyan rounded-full animate-bounce [animation-delay:-0.15s]"></div>
                                        <div className="w-2 h-2 bg-ncyan rounded-full animate-bounce"></div>
                                    </div>
                                    <p className="text-[10px] font-bold text-ncyan/50 uppercase tracking-[0.2em] mt-2">Discovering</p>
                                </div>
                            ) : !discovery.hasNextPage && discovery.data && discovery.data.pages.flat().length > 0 ? (
                                <div className="py-12 text-center animate-fade-in w-full max-w-2xl mx-auto px-4">
                                    <div className="h-px w-full bg-gradient-to-r from-transparent via-neutral-800 to-transparent mb-8" />
                                    <div className="space-y-3">
                                        <h3 className="text-lg md:text-xl font-black text-white/80">
                                            That’s all for now.
                                        </h3>
                                        <p className="text-[10px] md:text-xs text-neutral-600 font-bold max-w-md mx-auto uppercase tracking-[0.3em]">
                                            Catalog Exhausted
                                        </p>
                                    </div>
                                    <button
                                        onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
                                        className="mt-8 text-[10px] font-bold text-neutral-500 hover:text-ncyan transition-all uppercase tracking-[0.2em] border border-neutral-800 hover:border-ncyan/30 px-6 py-2 rounded-full bg-neutral-900/50"
                                    >
                                        Back to Top ↑
                                    </button>
                                </div>
                            ) : null}
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}
