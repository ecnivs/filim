"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/http";
import Link from "next/link";
import Image from "next/image";
import { AnimeCard, type AnimeSummaryCard as AnimeSummary } from "@/components/AnimeCard";
import { SectionRow } from "@/components/SectionRow";
import { useSearchParams } from "next/navigation";
import { ContinueCard } from "@/components/ContinueCard";

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
    rating?: "like" | "dislike" | null;
};

type PreferencesResponse = {
    items: PreferenceItem[];
};

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

    const preferences = useQuery({
        queryKey: ["preferences"],
        queryFn: async () => {
            const res = await api.get<PreferencesResponse>("/user/preferences");
            return res.data.items;
        }
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

    const trending = useQuery({
        queryKey: ["trending"],
        queryFn: async () => {
            const res = await api.get<{ items: AnimeSummary[] }>("/catalog/trending");
            return res.data.items;
        }
    });

    const searchResults = useQuery({
        queryKey: ["search", urlQuery],
        enabled: urlQuery.length > 0,
        queryFn: async () => {
            const res = await api.get<{ items: AnimeSummary[] }>("/catalog/search", {
                params: { q: urlQuery, mode: "sub" }
            });
            return res.data.items;
        }
    });

    const featuredAnime = (() => {
        const candidates = [
            ...(trending.data || []),
            ...(recommendations.data?.flatMap((s) => s.items) || [])
        ];
        return candidates.find((a) => a.poster_image_url && a.poster_image_url.startsWith("http"));
    })() as AnimeSummary | undefined;

    const billboardResumeHref = (() => {
        if (!featuredAnime) return "#";
        const progress = continueWatching.data?.find(item => item.anime_id === featuredAnime.id);
        if (progress && progress.episode) {
            return `/watch/${featuredAnime.id}/${progress.episode}`;
        }
        return `/watch/${featuredAnime.id}/1`;
    })();

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

    const handleToggleList = (animeId: string) => {
        const current = getPreferenceForAnime(animeId);
        const nextInList = !current?.in_list;
        toggleList.mutate({ animeId, inList: nextInList });
    };

    const handleSetRating = (animeId: string, rating: "like" | "dislike" | null) => {
        updateRating.mutate({ animeId, rating });
    };

    return (
        <div className="pb-16">
            {urlQuery ? (
                <div className="px-[4%] pt-24 pb-12">
                    <h2 className="text-2xl font-black text-white mb-6">
                        Search results for "{urlQuery}"
                    </h2>
                    {searchResults.isLoading ? (
                        <p className="text-sm text-neutral-400">Searching…</p>
                    ) : searchResults.isError ? (
                        <p className="text-sm text-red-400">Something went wrong. Please try again.</p>
                    ) : searchResults.data && searchResults.data.length > 0 ? (
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                            {searchResults.data.map((anime) => (
                                <AnimeCard
                                    key={anime.id}
                                    anime={anime}
                                    isInList={getPreferenceForAnime(anime.id)?.in_list ?? false}
                                    rating={getPreferenceForAnime(anime.id)?.rating ?? null}
                                    onToggleList={() => handleToggleList(anime.id)}
                                    widthClassName="w-full"
                                    onSetRating={(next: "like" | "dislike" | null) => {
                                        if (!next) return;
                                        handleSetRating(anime.id, next);
                                    }}
                                />
                            ))}
                        </div>
                    ) : (
                        <p className="text-sm text-neutral-500">No results found.</p>
                    )}
                </div>
            ) : (
                <>
                    {featuredAnime && (
                        <section className="relative w-full h-[80vh] min-h-[500px]">
                            <div className="absolute inset-0">
                                {featuredAnime.poster_image_url && (
                                    <Image
                                        src={featuredAnime.poster_image_url}
                                        alt={featuredAnime.title}
                                        fill
                                        priority
                                        sizes="100vw"
                                        className="object-cover"
                                        unoptimized
                                    />
                                )}
                                <div className="absolute inset-0 bg-gradient-to-r from-background via-background/60 to-transparent" />
                                <div className="absolute inset-0 bg-gradient-to-t from-background via-transparent to-transparent" />
                                <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-background to-transparent" />
                            </div>
                            <div className="relative z-10 flex h-full items-end pb-24 sm:pb-32 px-[4%]">
                                <div className="max-w-lg animate-fade-in-up space-y-4">
                                    <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black text-white leading-[1.1] drop-shadow-[0_2px_8px_rgba(0,0,0,0.8)]">
                                        {featuredAnime.title}
                                    </h1>
                                    {featuredAnime.synopsis && (
                                        <p className="text-sm sm:text-base text-neutral-200 line-clamp-3 leading-relaxed">
                                            {featuredAnime.synopsis}
                                        </p>
                                    )}
                                    <div className="flex items-center gap-3 pt-1">
                                        <Link
                                            href={billboardResumeHref}
                                            className="inline-flex items-center gap-2 rounded bg-ncyan px-6 py-2.5 text-sm font-bold text-black hover:bg-ncyan-light transition-colors shadow-lg shadow-ncyan/20"
                                        >
                                            <span className="text-lg">▶</span> Play
                                        </Link>
                                        <Link
                                            href={`/anime/${featuredAnime.id}`}
                                            className="flex items-center gap-2 rounded bg-neutral-500/50 px-4 sm:px-6 py-2 sm:py-2.5 text-xs sm:text-sm font-bold text-white transition hover:bg-neutral-500/70 backdrop-blur-md"
                                        >
                                            <span className="text-lg">ⓘ</span>
                                            More Info
                                        </Link>
                                    </div>
                                </div>
                            </div>
                        </section>
                    )}

                    <div className="relative z-10 -mt-16 space-y-12 pb-20">
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
                                        const pref = getPreferenceForAnime(item.anime_id);
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
                                                isInList={pref?.in_list ?? false}
                                                rating={pref?.rating ?? null}
                                                onToggleList={() => handleToggleList(item.anime_id)}
                                                onSetRating={(next: "like" | "dislike" | null) => {
                                                    handleSetRating(item.anime_id, next);
                                                }}
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
                                        isInList={getPreferenceForAnime(anime.id)?.in_list ?? false}
                                        rating={getPreferenceForAnime(anime.id)?.rating ?? null}
                                        onToggleList={() => handleToggleList(anime.id)}
                                        onSetRating={(next: "like" | "dislike" | null) => {
                                            if (!next) return;
                                            handleSetRating(anime.id, next);
                                        }}
                                    />
                                ))}
                            </SectionRow>
                        ))}

                        {trending.data && trending.data.length > 0 && (
                            <SectionRow title="Trending Now">
                                {trending.data.map((anime) => (
                                    <AnimeCard
                                        key={anime.id}
                                        anime={anime}
                                        isInList={getPreferenceForAnime(anime.id)?.in_list ?? false}
                                        rating={getPreferenceForAnime(anime.id)?.rating ?? null}
                                        onToggleList={() => handleToggleList(anime.id)}
                                        onSetRating={(next: "like" | "dislike" | null) => {
                                            handleSetRating(anime.id, next);
                                        }}
                                    />
                                ))}
                            </SectionRow>
                        )}
                    </div>
                </>
            )}
        </div>
    );
}
