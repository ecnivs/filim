"use client";

import { useQuery, useInfiniteQuery } from "@tanstack/react-query";
import { api } from "@/lib/http";
import Link from "next/link";
import Image from "next/image";
import { ShowCard, type ShowSummaryCard as ShowSummary } from "@/components/ShowCard";
import { SectionRow } from "@/components/SectionRow";
import { useSearchParams } from "next/navigation";
import { ContinueCard } from "@/components/ContinueCard";
import { useEffect, useMemo } from "react";
import { useInView } from "react-intersection-observer";
import { usePreferences } from "@/hooks/usePreferences";
import { useProfile } from "@/lib/profile-context";

type ContinueWatchingItem = {
    show_id: string;
    episode: string;
    progress: number;
    position_seconds?: number;
    duration_seconds?: number;
    show_title?: string | null;
    cover_image_url?: string | null;
};

type RecommendationSection = {
    id: string;
    title: string;
    items: ShowSummary[];
};

type DiscoveryPage = {
    sections: RecommendationSection[];
    next_cursor: number | null;
};

import { GridView } from "@/components/GridView";
import { FilimLoadingSurface } from "@/components/FilimLoadingSurface";

export default function HomePage() {
    const { profile, isReady } = useProfile();
    const searchParams = useSearchParams();
    const urlQuery = searchParams.get("q") || "";
    const urlGenres = searchParams.get("genres") || "";

    const continueWatching = useQuery({
        queryKey: ["continue-watching", profile?.id],
        enabled: isReady && !!profile?.id && !profile?.is_guest,
        queryFn: async () => {
            const res = await api.get<{ items: ContinueWatchingItem[] }>(
                "/user/continue-watching"
            );
            return res.data.items;
        },
        staleTime: 30 * 1000,
    });

    const recommendations = useQuery({
        queryKey: ["recommendations", profile?.id],
        queryFn: async () => {
            const res = await api.get<{ sections: RecommendationSection[] }>(
                "/user/recommendations"
            );
            return res.data.sections;
        }
    });

    const discovery = useInfiniteQuery({
        queryKey: ["discovery", profile?.id],
        queryFn: async ({ pageParam = 0 }) => {
            const res = await api.get<DiscoveryPage>(
                "/user/recommendations/discovery",
                { params: { cursor: pageParam, limit: 3 } }
            );
            return res.data;
        },
        getNextPageParam: (lastPage, allPages) => {
            if (allPages.length >= 50) return undefined;
            if (lastPage.next_cursor == null) return undefined;
            return lastPage.next_cursor;
        },
        initialPageParam: 0,
    });

    const discoverySections = useMemo(() => {
        const flat = discovery.data?.pages.flatMap((p) => p.sections) ?? [];
        const seen = new Set<string>();
        return flat.filter((s) => {
            const k = s.title.trim().toLowerCase();
            if (seen.has(k)) return false;
            seen.add(k);
            return true;
        });
    }, [discovery.data?.pages]);

    const { ref, inView } = useInView({
        threshold: 0,
        rootMargin: "400px",
    });

    useEffect(() => {
        if (
            !inView ||
            !discovery.data ||
            discovery.isLoading ||
            !discovery.hasNextPage ||
            discovery.isFetchingNextPage
        ) {
            return;
        }
        void discovery.fetchNextPage();
    }, [inView, discovery]);

    const searchResults = useInfiniteQuery({
        queryKey: ["search", urlQuery, urlGenres],
        enabled: urlQuery.length > 0 || urlGenres.length > 0,
        queryFn: async ({ pageParam = 1 }) => {
            const res = await api.get<{ items: ShowSummary[] }>("/catalog/search", {
                params: { 
                    q: urlQuery, 
                    genres: urlGenres,
                    mode: "sub", 
                    page: pageParam 
                }
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

    const featuredShow = useMemo(() => {
        const inProgressIds = new Set(continueWatching.data?.map((i) => i.show_id) ?? []);

        // Primary pool: profile-specific recommendations. Fallback: discovery sections.
        const recItems = recommendations.data?.flatMap((s) => s.items) ?? [];
        const discoveryItems = discoverySections.flatMap((s) => s.items);
        const allItems = recItems.length > 0 ? recItems : discoveryItems;

        const candidates = allItems.filter((a) => !inProgressIds.has(a.id));
        if (candidates.length === 0) return undefined;

        const withBanners = candidates.filter((a) => a.banner_image_url?.startsWith("http"));
        const withPosters = candidates.filter((a) => a.poster_image_url?.startsWith("http"));
        const pool = withBanners.length > 0 ? withBanners : withPosters.length > 0 ? withPosters : candidates;

        // Rotate daily, vary by profile — stable within a session.
        const dayIndex = Math.floor(Date.now() / 86_400_000);
        const profileSeed = profile?.id
            ? profile.id.charCodeAt(0) + profile.id.charCodeAt(profile.id.length - 1)
            : 0;
        return pool[(dayIndex + profileSeed) % Math.min(pool.length, 5)];
    }, [recommendations.data, discoverySections, continueWatching.data, profile?.id]);

    const billboardResumeHref = (() => {
        if (!featuredShow) return "#";
        const progress = continueWatching.data?.find(item => item.show_id === featuredShow.id);
        if (progress && progress.episode) {
            return `/watch/${featuredShow.id}/${progress.episode}`;
        }
        return `/watch/${featuredShow.id}/1`;
    })();

    const isInitialLoading = recommendations.isLoading;

    return (
        <div className="min-h-screen">
            {urlQuery || urlGenres ? (
                <GridView
                    title={urlGenres ? `Genre: ${urlGenres}` : `Search results for "${urlQuery}"`}
                    infiniteQuery={searchResults as any}
                    emptyMessage="No results found."
                />
            ) : (
                <>
                    <FilimLoadingSurface show={isInitialLoading} className="z-[90]" />
                    {(isInitialLoading || (discovery.isLoading && !featuredShow)) ? (
                        <section className="relative w-full h-[56vh] md:h-[80vh] min-h-[320px] md:min-h-[500px] overflow-hidden bg-neutral-900">
                            <div className="absolute inset-0 animate-pulse bg-gradient-to-br from-neutral-800 via-neutral-900 to-neutral-800" />
                            <div className="absolute inset-0 bg-gradient-to-r from-background via-background/60 to-transparent" />
                            <div className="absolute inset-0 bg-gradient-to-t from-background via-transparent to-transparent" />
                            <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-background to-transparent" />
                            <div className="relative z-10 flex h-full items-end pb-16 md:pb-24 lg:pb-32 px-[4%]">
                                <div className="max-w-lg space-y-3 md:space-y-4">
                                    <div className="h-10 md:h-14 w-72 md:w-96 rounded bg-neutral-700/60 animate-pulse" />
                                    <div className="space-y-2">
                                        <div className="h-3 w-80 rounded bg-neutral-700/50 animate-pulse" />
                                        <div className="h-3 w-60 rounded bg-neutral-700/50 animate-pulse" />
                                    </div>
                                    <div className="flex items-center gap-2 md:gap-3 pt-1">
                                        <div className="h-11 w-24 rounded bg-neutral-700/60 animate-pulse" />
                                        <div className="h-11 w-32 rounded bg-neutral-700/60 animate-pulse" />
                                    </div>
                                </div>
                            </div>
                        </section>
                    ) : featuredShow ? (
                        <section className="relative w-full h-[56vh] md:h-[80vh] min-h-[320px] md:min-h-[500px]">
                            <div className="absolute inset-0">
                                {featuredShow.banner_image_url || featuredShow.poster_image_url ? (
                                    <Image
                                        src={featuredShow.banner_image_url || (featuredShow.poster_image_url as string)}
                                        alt={featuredShow.title}
                                        fill
                                        priority
                                        sizes="100vw"
                                        className="object-cover"
                                    />
                                ) : null}
                                <div className="absolute inset-0 bg-gradient-to-r from-background via-background/60 to-transparent" />
                                <div className="absolute inset-0 bg-gradient-to-t from-background via-transparent to-transparent" />
                                <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-background to-transparent" />
                            </div>
                            <div className="relative z-10 flex h-full items-end pb-16 md:pb-24 lg:pb-32 px-[4%]">
                                <div className="max-w-lg animate-fade-in-up space-y-3 md:space-y-4">
                                    <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-black text-white leading-[1.1] drop-shadow-[0_2px_8px_rgba(0,0,0,0.8)]">
                                        {featuredShow.title}
                                    </h1>
                                    {featuredShow.synopsis && (
                                        <p className="text-xs md:text-sm lg:text-base text-neutral-200 line-clamp-2 md:line-clamp-3 leading-relaxed">
                                            {featuredShow.synopsis}
                                        </p>
                                    )}
                                    <div className="flex items-center gap-2 md:gap-3 pt-1">
                                        <Link
                                            href={billboardResumeHref}
                                            className="inline-flex items-center gap-2 rounded bg-ncyan px-5 md:px-6 py-2.5 md:py-2.5 text-sm font-bold text-black hover:bg-ncyan-light transition-colors shadow-lg shadow-ncyan/20 min-h-[44px]"
                                        >
                                            <svg viewBox="0 0 24 24" className="w-4 h-4 md:w-5 md:h-5 shrink-0" fill="currentColor">
                                                <path d="M6 4l15 8-15 8V4z" />
                                            </svg>
                                            Play
                                        </Link>
                                        <Link
                                            href={`/show/${featuredShow.id}`}
                                            className="flex items-center gap-2 rounded bg-neutral-500/50 px-4 md:px-6 py-2.5 md:py-2.5 text-xs md:text-sm font-bold text-white transition hover:bg-neutral-500/70 backdrop-blur-md min-h-[44px]"
                                        >
                                            <svg viewBox="0 0 24 24" className="w-4 h-4 md:w-5 md:h-5 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                <circle cx="12" cy="12" r="10" />
                                                <line x1="12" y1="16" x2="12" y2="12" />
                                                <line x1="12" y1="8" x2="12.01" y2="8" />
                                            </svg>
                                            More Info
                                        </Link>
                                    </div>
                                </div>
                            </div>
                        </section>
                    ) : null}

                    <div className="relative z-10 -mt-10 md:-mt-16 space-y-4 md:space-y-6 pb-4">
                        {continueWatching.data && continueWatching.data.length > 0 && (
                            <SectionRow title="Continue Watching">
                                {continueWatching.data
                                    .filter(
                                        (item) =>
                                            item.show_id &&
                                            item.show_id !== "undefined" &&
                                            item.episode &&
                                            item.episode !== "undefined"
                                    )
                                    .map((item) => {
                                        return (
                                            <ContinueCard
                                                key={`${item.show_id}-${item.episode}`}
                                                title={
                                                    item.show_title && item.show_title.length > 0
                                                        ? item.show_title
                                                        : `Episode ${item.episode}`
                                                }
                                                subtitle={`Episode ${item.episode}`}
                                                href={`/watch/${item.show_id}/${item.episode}`}
                                                coverImageUrl={item.cover_image_url ?? undefined}
                                                progress={item.progress}
                                                positionSeconds={item.position_seconds}
                                                durationSeconds={item.duration_seconds}
                                                isInList={isInList(item.show_id)}
                                                onToggleList={() => handleToggleList(item.show_id)}
                                                showId={item.show_id}
                                            />
                                        );
                                    })}
                            </SectionRow>
                        )}

                        {recommendations.data?.filter(section => section.items.length > 0).map((section) => (
                            <SectionRow key={section.id} title={section.title}>
                                {section.items.map((row) => (
                                    <ShowCard
                                        key={row.id}
                                        show={row}
                                        isInList={isInList(row.id)}
                                        onToggleList={() => handleToggleList(row.id)}
                                    />
                                ))}
                            </SectionRow>
                        ))}


                        {discoverySections.map((section) => (
                            <SectionRow key={section.id} title={section.title}>
                                {section.items.map((row) => (
                                    <ShowCard
                                        key={row.id}
                                        show={row}
                                        isInList={isInList(row.id)}
                                        onToggleList={() => handleToggleList(row.id)}
                                    />
                                ))}
                            </SectionRow>
                        ))}

                        <div ref={ref} className="min-h-[100px] flex items-center justify-center w-full">
                            {discovery.isFetchingNextPage ? (
                                <div className="flex flex-col items-center gap-2 py-8">
                                    <div className="flex gap-1.5">
                                        <div className="w-2 h-2 bg-ncyan rounded-full animate-bounce [animation-delay:-0.3s]"></div>
                                        <div className="w-2 h-2 bg-ncyan rounded-full animate-bounce [animation-delay:-0.15s]"></div>
                                        <div className="w-2 h-2 bg-ncyan rounded-full animate-bounce"></div>
                                    </div>
                                    <p className="text-[10px] font-bold text-ncyan/50 uppercase tracking-[0.2em] mt-2">Discovering</p>
                                </div>
                            ) : !discovery.hasNextPage && discovery.data && discoverySections.length > 0 ? (
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
