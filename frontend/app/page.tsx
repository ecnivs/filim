"use client";

import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/http";
import Link from "next/link";
import Image from "next/image";
import { AnimeCard, type AnimeSummaryCard as AnimeSummary } from "@/components/AnimeCard";
import { SectionRow } from "@/components/SectionRow";
import { useRouter, useSearchParams } from "next/navigation";

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

    const [debouncedSearch, setDebouncedSearch] = useState("");

    useEffect(() => {
        const id = setTimeout(() => setDebouncedSearch(urlQuery.trim()), 300);
        return () => clearTimeout(id);
    }, [urlQuery]);


    const continueWatching = useQuery({
        queryKey: ["continue-watching"],
        queryFn: async () => {
            const res = await api.get<{ items: ContinueWatchingItem[] }>(
                "/user/continue-watching"
            );
            return res.data.items;
        }
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
        queryKey: ["search", debouncedSearch],
        enabled: debouncedSearch.length > 0,
        queryFn: async () => {
            const res = await api.get<{ items: AnimeSummary[] }>("/catalog/search", {
                params: { q: debouncedSearch, mode: "sub" }
            });
            return res.data.items;
        }
    });

    const featuredAnime = (() => {
        const candidates = [
            ...(trending.data || []),
            ...(recommendations.data?.flatMap((s) => s.items) || [])
        ];
        // Guardrail: Skip items with no thumbnail to avoid broken billboard
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
            {debouncedSearch ? (
                <div className="px-[4%] pt-24 pb-12">
                    <h2 className="text-2xl font-black text-white mb-6">
                        Search results for "{debouncedSearch}"
                    </h2>
                    {searchResults.isLoading ? (
                        <p className="text-sm text-neutral-400">Searching…</p>
                    ) : searchResults.isError ? (
                        <p className="text-sm text-red-400">Something went wrong. Please try again.</p>
                    ) : searchResults.data && searchResults.data.length > 0 ? (
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
                            {searchResults.data.map((anime) => (
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

                        {recommendations.data?.map((section) => (
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

function ContinueCard({
    title,
    href,
    subtitle,
    coverImageUrl,
    progress,
    positionSeconds,
    durationSeconds,
    isInList,
    rating,
    onToggleList,
    onSetRating,
    animeId
}: {
    title: string;
    href: string;
    subtitle?: string;
    coverImageUrl?: string;
    progress?: number;
    positionSeconds?: number;
    durationSeconds?: number;
    isInList?: boolean;
    rating?: "like" | "dislike" | null;
    onToggleList?: () => void;
    onSetRating?: (rating: "like" | "dislike" | null) => void;
    animeId?: string;
}) {
    const router = useRouter();
    const [imageFailed, setImageFailed] = useState(false);
    const hasActions = !!(onToggleList || onSetRating);

    const handleCardClick = () => {
        router.push(href);
    };
    return (
        <div
            className="group/card relative flex-shrink-0 w-[calc(92vw/2)] sm:w-[calc(92vw/3)] md:w-[calc(92vw/4)] lg:w-[calc(92vw/5)] xl:w-[calc(92vw/6)] transition-all duration-300 hover:z-50 cursor-pointer"
            onClick={handleCardClick}
        >
            <div className="relative aspect-[2/3] w-full overflow-hidden rounded-[4px] bg-surface transition-transform duration-300 ease-out group-hover/card:scale-[1.25] group-hover/card:z-30 group-hover/card:delay-[100ms]">
                {coverImageUrl && !imageFailed ? (
                    <Image
                        src={coverImageUrl}
                        alt={title}
                        unoptimized
                        fill
                        sizes="(max-width: 640px) 46vw, (max-width: 1024px) 23vw, 15vw"
                        className="object-cover"
                        onError={() => setImageFailed(true)}
                    />
                ) : (
                    <div className="w-full h-full bg-neutral-800 flex items-center justify-center">
                        <span className="text-7xl font-black text-neutral-700">{title.slice(0, 1)}</span>
                    </div>
                )}

                {/* Overlay elements only visible on hover */}
                <div className="absolute inset-0 opacity-0 group-hover/card:opacity-100 transition-opacity duration-300 flex flex-col justify-between p-3 bg-gradient-to-t from-black/95 via-black/20 to-black/40 z-40">
                    {/* Top Row: Branding */}
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1 scale-[0.8] origin-top-left">
                            <span className="text-ncyan font-black text-sm tracking-tighter">FILIM</span>
                        </div>
                    </div>

                    {/* Bottom Section: Actions & Info */}
                    <div className="space-y-3">
                        {/* Action Buttons */}
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <button
                                    type="button"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        router.push(href);
                                    }}
                                    className="flex h-8 w-8 items-center justify-center rounded-full bg-white text-black text-xs hover:bg-neutral-200 transition-colors pl-0.5"
                                >
                                    <svg viewBox="0 0 24 24" className="w-4 h-4" fill="currentColor">
                                        <path d="M6 4l15 8-15 8V4z" />
                                    </svg>
                                </button>
                                {onToggleList && (
                                    <button
                                        type="button"
                                        onClick={(e) => {
                                            e.preventDefault();
                                            e.stopPropagation();
                                            onToggleList();
                                        }}
                                        className={`flex h-8 w-8 items-center justify-center rounded-full border-2 text-xs transition-colors ${isInList
                                            ? "border-white bg-white text-black"
                                            : "border-neutral-500 text-neutral-400 hover:border-white hover:text-white"
                                            }`}
                                    >
                                        {isInList ? (
                                            <svg viewBox="0 0 24 24" className="w-4 h-4" fill="currentColor">
                                                <path d="M9 16.2L4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4L9 16.2z" />
                                            </svg>
                                        ) : (
                                            <svg viewBox="0 0 24 24" className="w-4 h-4" fill="currentColor">
                                                <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z" />
                                            </svg>
                                        )}
                                    </button>
                                )}
                                {onSetRating && (
                                    <div className="flex items-center gap-2">
                                        <button
                                            type="button"
                                            onClick={(e) => {
                                                e.preventDefault();
                                                e.stopPropagation();
                                                onSetRating(rating === "like" ? null : "like");
                                            }}
                                            className={`flex h-8 w-8 items-center justify-center rounded-full border-2 transition-colors ${rating === "like"
                                                ? "border-white bg-white text-black"
                                                : "border-neutral-500 text-neutral-400 hover:border-white hover:text-white"
                                                }`}
                                            aria-label="Like"
                                        >
                                            <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="currentColor">
                                                <path d="M1 21h4V9H1v12zm22-11c0-1.1-.9-2-2-2h-6.31l.95-4.57.03-.32c0-.41-.17-.79-.44-1.06L14.17 1 7.59 7.59C7.22 7.95 7 8.45 7 9v10c0 1.1.9 2 2 2h9c.83 0 1.54-.5 1.84-1.22l3.02-7.05c.09-.23.14-.47.14-.73v-2z" />
                                            </svg>
                                        </button>
                                        <button
                                            type="button"
                                            onClick={(e) => {
                                                e.preventDefault();
                                                e.stopPropagation();
                                                onSetRating(rating === "dislike" ? null : "dislike");
                                            }}
                                            className={`flex h-8 w-8 items-center justify-center rounded-full border-2 transition-colors ${rating === "dislike"
                                                ? "border-white bg-white text-black"
                                                : "border-neutral-500 text-neutral-400 hover:border-white hover:text-white"
                                                }`}
                                            aria-label="Dislike"
                                        >
                                            <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 rotate-180" fill="currentColor">
                                                <path d="M1 21h4V9H1v12zm22-11c0-1.1-.9-2-2-2h-6.31l.95-4.57.03-.32c0-.41-.17-.79-.44-1.06L14.17 1 7.59 7.59C7.22 7.95 7 8.45 7 9v10c0 1.1.9 2 2 2h9c.83 0 1.54-.5 1.84-1.22l3.02-7.05c.09-.23.14-.47.14-.73v-2z" />
                                            </svg>
                                        </button>
                                    </div>
                                )}
                                <button
                                    type="button"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        router.push(`/anime/${animeId}`);
                                    }}
                                    className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-neutral-500 text-neutral-400 hover:border-white hover:text-white transition-colors"
                                >
                                    <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="3">
                                        <path d="M19 9l-7 7-7-7" strokeLinecap="round" strokeLinejoin="round" />
                                    </svg>
                                </button>
                            </div>
                        </div>

                        {/* Metadata */}
                        <div className="space-y-1" onClick={(e) => e.stopPropagation()}>
                            <p className="text-[0.65rem] font-black text-white leading-tight line-clamp-2 drop-shadow-[0_1px_3px_rgba(0,0,0,0.8)]">
                                {title}
                            </p>
                            {subtitle && (
                                <p className="text-[0.6rem] text-neutral-300 font-medium">{subtitle}</p>
                            )}
                            {typeof positionSeconds === "number" &&
                                typeof durationSeconds === "number" &&
                                durationSeconds > 0 && (
                                    <p className="text-[0.55rem] text-neutral-400 font-medium tracking-tight">
                                        {formatTime(positionSeconds)} of {formatTime(durationSeconds)}
                                    </p>
                                )}
                        </div>
                    </div>
                </div>

                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent h-1/3 opacity-100 sm:group-hover/card:opacity-0 transition-opacity duration-200 group-hover/card:pointer-events-none" />
                <div className="absolute inset-x-0 bottom-0 p-2.5 opacity-100 sm:group-hover/card:opacity-0 transition-opacity duration-200 group-hover/card:pointer-events-none">
                    <p className="text-[0.75rem] font-semibold text-white line-clamp-1 drop-shadow-[0_1px_3px_rgba(0,0,0,0.9)]">{title}</p>
                    {subtitle && (
                        <p className="text-[0.6rem] text-neutral-300 mt-0.5">{subtitle}</p>
                    )}
                    {/* Progress bar remains visible on non-hover */}
                    {typeof progress === "number" && (
                        <div className="mt-1.5 h-[3px] w-full rounded-full bg-neutral-700 overflow-hidden">
                            <div
                                className="h-full bg-ncyan rounded-full transition-all"
                                style={{ width: `${Math.round(progress * 100)}%` }}
                            />
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

function formatTime(totalSeconds: number): string {
    const seconds = Math.max(0, Math.floor(totalSeconds));
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;

    const two = (n: number) => n.toString().padStart(2, "0");

    if (h > 0) {
        return `${h}:${two(m)}:${two(s)}`;
    }
    return `${m}:${two(s)}`;
}
