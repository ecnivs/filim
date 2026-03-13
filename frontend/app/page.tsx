"use client";

import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useDevice } from "@/lib/device-context";
import { api } from "@/lib/http";
import Link from "next/link";
import Image from "next/image";
import { AnimeCard, type AnimeSummaryCard as AnimeSummary } from "@/components/AnimeCard";
import { SectionRow } from "@/components/SectionRow";

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
  const { deviceToken } = useDevice();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const searchInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    const id = setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => clearTimeout(id);
  }, [search]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (
        event.key === "/" &&
        !event.metaKey &&
        !event.ctrlKey &&
        !event.altKey
      ) {
        const active = document.activeElement;
        if (
          active &&
          (active.tagName === "INPUT" ||
            active.tagName === "TEXTAREA" ||
            (active as HTMLElement).isContentEditable)
        ) {
          return;
        }
        event.preventDefault();
        searchInputRef.current?.focus();
      }
    };

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

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
    queryKey: ["recommendations", deviceToken],
    enabled: !!deviceToken,
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

  const featuredAnime = (
    trending.data?.[0] ?? recommendations.data?.[0]?.items[0]
  ) as AnimeSummary | undefined;

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

  const handleSetRating = (animeId: string, rating: "like" | "dislike") => {
    const current = getPreferenceForAnime(animeId);
    const nextRating = current?.rating === rating ? null : rating;
    updateRating.mutate({ animeId, rating: nextRating });
  };

  return (
    <main className="space-y-10 pb-10">
      {featuredAnime && (
        <section className="relative mb-4 h-[55vh] min-h-[340px] w-full overflow-hidden rounded-lg">
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
            <div className="absolute inset-0 bg-gradient-to-t from-black via-black/60 to-transparent" />
          </div>
          <div className="relative z-10 flex h-full items-end">
            <div className="max-w-xl space-y-4 pb-10 px-4 sm:px-8">
              <h1 className="text-4xl sm:text-5xl font-extrabold drop-shadow-lg">
                {featuredAnime.title}
              </h1>
              {featuredAnime.synopsis && (
                <p className="text-sm sm:text-base text-neutral-200 line-clamp-3">
                  {featuredAnime.synopsis}
                </p>
              )}
              <div className="flex flex-wrap items-center gap-3">
                <Link
                  href={`/anime/${featuredAnime.id}`}
                  className="inline-flex items-center justify-center rounded bg-white px-5 py-2 text-sm font-semibold text-black hover:bg-neutral-200"
                >
                  Play
                </Link>
                <Link
                  href={`/anime/${featuredAnime.id}`}
                  className="inline-flex items-center justify-center rounded bg-neutral-500/70 px-5 py-2 text-sm font-semibold text-white hover:bg-neutral-500"
                >
                  More info
                </Link>
              </div>
            </div>
          </div>
        </section>
      )}

      <section className="space-y-3">
        <p className="text-sm text-neutral-300">
          Self-hosted LAN streaming for your anime collection.
        </p>
        <div className="max-w-xl">
          <div className="relative">
            <input
              ref={searchInputRef}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search for anime, tags, or episodes"
              className="w-full rounded-md bg-neutral-900 border border-neutral-700 px-3 py-2 text-sm text-white placeholder:text-neutral-500 focus:outline-none focus:ring-2 focus:ring-cyan"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch("")}
                className="absolute inset-y-0 right-2 flex items-center text-xs text-neutral-400 hover:text-white"
              >
                Clear
              </button>
            )}
          </div>
          <p className="mt-1 text-[0.7rem] text-neutral-500">
            Press <span className="rounded bg-neutral-800 px-1 py-0.5">/</span>{" "}
            to focus search.
          </p>
        </div>
      </section>

      {debouncedSearch ? (
        <SectionRow title={`Search results for “${debouncedSearch}”`}>
          {searchResults.isLoading && (
            <div className="text-sm text-neutral-400">Searching…</div>
          )}
          {searchResults.isError && (
            <div className="text-sm text-red-400">
              Something went wrong while searching. Please try again.
            </div>
          )}
          {searchResults.data &&
            (searchResults.data.length > 0 ? (
              searchResults.data.map((anime) => (
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
                  href={`/anime/${anime.id}?q=${encodeURIComponent(
                    debouncedSearch
                  )}`}
                />
              ))
            ) : (
              <div className="text-sm text-neutral-400">
                No results found. Try a different title.
              </div>
            ))}
        </SectionRow>
      ) : (
        <>
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
                  const title =
                    item.anime_title && item.anime_title.length > 0
                      ? item.anime_title
                      : `Episode ${item.episode}`;
                  const subtitle = `Episode ${item.episode}`;
                  const pref = getPreferenceForAnime(item.anime_id);
                  return (
                    <Card
                      key={`${item.anime_id}-${item.episode}`}
                      title={title}
                      subtitle={subtitle}
                      href={`/watch/${item.anime_id}/${item.episode}`}
                      coverImageUrl={item.cover_image_url ?? undefined}
                      episode={item.episode}
                      progress={item.progress}
                      positionSeconds={item.position_seconds}
                      durationSeconds={item.duration_seconds}
                      isInList={pref?.in_list ?? false}
                      rating={pref?.rating ?? null}
                      onToggleList={() => handleToggleList(item.anime_id)}
                      onSetRating={(next: "like" | "dislike" | null) => {
                        if (!next) return;
                        handleSetRating(item.anime_id, next);
                      }}
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
            <SectionRow title="Trending now">
              {trending.data.map((anime) => (
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
          )}
        </>
      )}
    </main>
  );
}

function Card({
  title,
  href,
  subtitle,
  coverImageUrl,
  episode,
  progress,
  positionSeconds,
  durationSeconds,
  isInList,
  rating,
  onToggleList,
  onSetRating
}: {
  title: string;
  href: string;
  subtitle?: string;
  coverImageUrl?: string;
  episode?: string;
  progress?: number;
  positionSeconds?: number;
  durationSeconds?: number;
  isInList?: boolean;
  rating?: "like" | "dislike" | null;
  onToggleList?: () => void;
  onSetRating?: (rating: "like" | "dislike" | null) => void;
}) {
  const [imageFailed, setImageFailed] = useState(false);
  return (
    <Link
      href={href}
      className="group relative min-w-[180px] max-w-[200px] flex-shrink-0 snap-start"
    >
      {/* Base tile */}
      <div className="relative aspect-[2/3] w-full overflow-hidden rounded-md bg-neutral-900 transition-transform duration-150 ease-out group-hover:scale-[1.03]">
        {coverImageUrl && !imageFailed ? (
          <Image
            src={coverImageUrl}
            alt={title}
            unoptimized
            fill
            sizes="(max-width: 768px) 40vw, 200px"
            className="object-cover"
            onError={() => setImageFailed(true)}
          />
        ) : (
          <div className="w-full h-full bg-neutral-800" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent" />
        <div className="absolute inset-x-0 bottom-0 p-2 space-y-1">
          <div className="text-[0.8rem] font-semibold text-white line-clamp-2">
            {title}
          </div>
          {subtitle && (
            <div className="text-[0.7rem] text-neutral-300 line-clamp-1">
              {subtitle}
            </div>
          )}
        </div>
      </div>

      {/* Hover popover (desktop) */}
      {(onToggleList || onSetRating) && (
        <div className="pointer-events-none absolute inset-0 top-0 hidden sm:block">
          <div className="pointer-events-auto absolute left-0 top-0 z-[999] w-[280px] -translate-y-6 scale-95 overflow-hidden rounded-xl bg-neutral-950 shadow-[0_24px_80px_rgba(0,0,0,0.85)] ring-1 ring-neutral-800 opacity-0 transition-all duration-200 ease-out group-hover:translate-y-0 group-hover:scale-100 group-hover:opacity-100">
            <div className="relative h-40 w-full overflow-hidden bg-neutral-900">
              {coverImageUrl && !imageFailed ? (
                <Image
                  src={coverImageUrl}
                  alt={title}
                  unoptimized
                  fill
                  sizes="280px"
                  className="object-cover"
                  onError={() => setImageFailed(true)}
                />
              ) : (
                <div className="w-full h-full bg-neutral-800" />
              )}
            </div>
            <div className="space-y-2 p-3 text-xs">
              <div className="flex items-start justify-between gap-2">
                <div className="space-y-1">
                  <p className="text-sm font-semibold text-white line-clamp-2">
                    {title}
                  </p>
                  {(episode || typeof progress === "number") && (
                    <p className="text-[0.7rem] text-neutral-300">
                      {episode && `Episode ${episode}`}
                      {episode && typeof progress === "number" && " • "}
                      {typeof progress === "number" &&
                        `${Math.round(progress * 100)}% watched`}
                    </p>
                  )}
                </div>
              </div>

              {typeof positionSeconds === "number" &&
                typeof durationSeconds === "number" &&
                durationSeconds > 0 && (
                  <p className="text-[0.65rem] text-neutral-300">
                    {formatTime(positionSeconds)} / {formatTime(durationSeconds)}
                  </p>
                )}

              <div className="flex items-center gap-2 pt-1">
                {onToggleList && (
                  <button
                    type="button"
                    onClick={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                      onToggleList();
                    }}
                    className="inline-flex items-center justify-center rounded-full bg-white px-3 py-1 text-[0.7rem] font-semibold text-black hover:bg-neutral-200"
                  >
                    {isInList ? "✓ My List" : "+ My List"}
                  </button>
                )}
                {onSetRating && (
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={(event) => {
                        event.preventDefault();
                        event.stopPropagation();
                        onSetRating(rating === "like" ? null : "like");
                      }}
                      className={`rounded-full px-2 py-0.5 text-[0.7rem] ${
                        rating === "like"
                          ? "bg-white text-black"
                          : "bg-neutral-800 text-white hover:bg-neutral-700"
                      }`}
                    >
                      Like
                    </button>
                    <button
                      type="button"
                      onClick={(event) => {
                        event.preventDefault();
                        event.stopPropagation();
                        onSetRating(rating === "dislike" ? null : "dislike");
                      }}
                      className={`rounded-full px-2 py-0.5 text-[0.7rem] ${
                        rating === "dislike"
                          ? "bg-white text-black"
                          : "bg-neutral-800 text-white hover:bg-neutral-700"
                      }`}
                    >
                      Dislike
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </Link>
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

