"use client";

import { useParams, useSearchParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/http";
import Link from "next/link";
import Image from "next/image";
import {
  AnimeCard,
  type AnimeSummaryCard
} from "@/components/AnimeCard";
import { SectionRow } from "@/components/SectionRow";

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

export default function AnimeDetailsPage() {
  const params = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const id = params.id;
  const queryClient = useQueryClient();

  const {
    data,
    isLoading,
    isError
  } = useQuery({
    queryKey: ["anime", id],
    queryFn: async () => {
      const searchQuery = searchParams.get("q") || undefined;
      const res = await api.get<AnimeDetails>(`/catalog/${id}`, {
        params: searchQuery ? { q: searchQuery } : undefined
      });
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

  type PreferenceItem = {
    anime_id: string;
    in_list: boolean;
    rating?: "like" | "dislike" | null;
  };

  const preferences = useQuery({
    queryKey: ["preferences"],
    queryFn: async () => {
      const res = await api.get<{ items: PreferenceItem[] }>("/user/preferences");
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

  if (isError) {
    return (
      <main className="space-y-6 pb-10">
        <section className="rounded-lg bg-neutral-950 border border-red-900/60 px-6 py-5">
          <h1 className="text-lg font-semibold text-red-300">
            Something went wrong loading this anime.
          </h1>
          <p className="mt-1 text-sm text-neutral-300">
            Please check your connection and try again.
          </p>
          <div className="mt-4 flex gap-3">
            <Link
              href="/"
              className="inline-flex items-center justify-center rounded bg-white px-4 py-1.5 text-sm font-semibold text-black hover:bg-neutral-200"
            >
              Back to home
            </Link>
          </div>
        </section>
      </main>
    );
  }

  if (isLoading || !data) {
    return (
      <main className="space-y-10 pb-10">
        <section className="relative w-full overflow-hidden rounded-lg min-h-[60vh] bg-neutral-950">
          <div className="absolute inset-0 bg-gradient-to-t from-black via-black/80 to-transparent" />
          <div className="relative z-10 flex h-full items-end">
            <div className="max-w-3xl space-y-4 pb-10 px-4 sm:px-8">
              <div className="h-10 w-2/3 rounded bg-neutral-800" />
              <div className="flex flex-wrap gap-2">
                <div className="h-5 w-16 rounded-full bg-neutral-800" />
                <div className="h-5 w-24 rounded-full bg-neutral-800" />
                <div className="h-5 w-20 rounded-full bg-neutral-800" />
              </div>
              <div className="space-y-2">
                <div className="h-4 w-full rounded bg-neutral-800" />
                <div className="h-4 w-5/6 rounded bg-neutral-800" />
                <div className="h-4 w-4/6 rounded bg-neutral-800" />
              </div>
              <div className="mt-4 h-9 w-32 rounded bg-neutral-800" />
            </div>
          </div>
        </section>
        <section className="space-y-3">
          <div className="h-6 w-32 rounded bg-neutral-800" />
          <div className="space-y-2">
            <div className="h-12 rounded bg-neutral-900" />
            <div className="h-12 rounded bg-neutral-900" />
            <div className="h-12 rounded bg-neutral-900" />
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="space-y-10 pb-10">
      <section className="relative w-full overflow-hidden rounded-lg min-h-[60vh]">
        <div className="absolute inset-0">
          {data.cover_image_url && (
            <Image
              src={data.cover_image_url}
              alt={data.title}
              fill
              priority
              sizes="100vw"
              className="object-cover"
              unoptimized
            />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black via-black/80 to-transparent" />
        </div>
        <div className="relative z-10 flex h-full items-end">
          <div className="max-w-3xl space-y-4 pb-10 px-4 sm:px-8">
            <h1 className="text-4xl sm:text-5xl font-extrabold text-white drop-shadow-lg">
              {data.title}
            </h1>
            {data.tags && data.tags.length > 0 && (
              <div className="flex flex-wrap gap-2 text-xs text-neutral-200">
                {data.tags.map((tag) => (
                  <span
                    key={tag}
                    className="px-2 py-1 rounded-full bg-neutral-900/80 border border-neutral-700"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            )}
            {data.synopsis && (
              <p className="text-sm sm:text-base text-neutral-200 max-w-2xl line-clamp-5">
                {data.synopsis}
              </p>
            )}
            <div className="flex flex-wrap items-center gap-3 pt-2">
              {data.id &&
                data.id !== "undefined" &&
                data.episodes[0] &&
                data.episodes[0].number &&
                data.episodes[0].number !== "undefined" && (
                  <Link
                    href={`/watch/${data.id}/${data.episodes[0].number}`}
                    className="inline-flex items-center justify-center rounded bg-white px-5 py-2 text-sm font-semibold text-black hover:bg-neutral-200"
                  >
                    Play
                  </Link>
                )}
              {data.id && (
                <>
                  <button
                    type="button"
                    onClick={() => handleToggleList(data.id)}
                    className="inline-flex items-center justify-center rounded bg-neutral-800 px-4 py-2 text-sm font-semibold text-white hover:bg-neutral-700"
                  >
                    {getPreferenceForAnime(data.id)?.in_list ? "✓ My List" : "+ My List"}
                  </button>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleSetRating(data.id, "like")}
                      className={`inline-flex items-center justify-center rounded-full px-3 py-1 text-xs font-medium ${
                        getPreferenceForAnime(data.id)?.rating === "like"
                          ? "bg-white text-black"
                          : "bg-neutral-800 text-white hover:bg-neutral-700"
                      }`}
                    >
                      Like
                    </button>
                    <button
                      type="button"
                      onClick={() => handleSetRating(data.id, "dislike")}
                      className={`inline-flex items-center justify-center rounded-full px-3 py-1 text-xs font-medium ${
                        getPreferenceForAnime(data.id)?.rating === "dislike"
                          ? "bg-white text-black"
                          : "bg-neutral-800 text-white hover:bg-neutral-700"
                      }`}
                    >
                      Dislike
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-white">Episodes</h2>
        </div>
        <ul className="space-y-2">
          {data.episodes
            .filter(
              (ep) =>
                ep.number &&
                ep.number !== "undefined" &&
                data.id &&
                data.id !== "undefined"
            )
            .map((ep) => (
              <li
                key={ep.number}
                className="flex items-center justify-between rounded bg-neutral-900 px-3 py-2 hover:bg-neutral-800 transition"
              >
                <div>
                  <span className="font-medium text-white">
                    Episode {ep.number}
                  </span>
                  {ep.title && (
                    <span className="ml-2 text-sm text-neutral-300">
                      {ep.title}
                    </span>
                  )}
                </div>
                <Link
                  href={`/watch/${data.id}/${ep.number}`}
                  className="text-sm text-cyan hover:underline"
                >
                  Play
                </Link>
              </li>
            ))}
        </ul>
      </section>

      {moreLikeThis && moreLikeThis.items.length > 0 && (
        <SectionRow title="More like this">
          {moreLikeThis.items.map((anime) => (
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
    </main>
  );
}

