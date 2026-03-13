"use client";

import Link from "next/link";
import Image from "next/image";
import { useState } from "react";

export type AnimeSummaryCard = {
  id: string;
  title: string;
  episode_count?: number;
  poster_image_url?: string | null;
  synopsis?: string | null;
  tags?: string[];
  available_audio_languages?: string[];
};

export type AnimeCardProps = {
  anime: AnimeSummaryCard;
  href?: string;
  isInList?: boolean;
  rating?: "like" | "dislike" | null;
  onToggleList?: () => void;
  onSetRating?: (rating: "like" | "dislike" | null) => void;
};

export function AnimeCard({
  anime,
  href,
  isInList,
  rating,
  onToggleList,
  onSetRating
}: AnimeCardProps) {
  const targetHref = href ?? `/anime/${anime.id}`;
  const subtitle =
    typeof anime.episode_count === "number" && anime.episode_count > 0
      ? `${anime.episode_count} episodes`
      : undefined;

  const [imageFailed, setImageFailed] = useState(false);

  return (
    <Link
      href={targetHref}
      className="group relative min-w-[180px] max-w-[200px] flex-shrink-0 snap-start"
    >
      {/* Base tile */}
      <div className="relative aspect-[2/3] w-full overflow-hidden rounded-md bg-neutral-900 transition-transform duration-150 ease-out group-hover:scale-[1.03]">
        {anime.poster_image_url && !imageFailed ? (
          <Image
            src={anime.poster_image_url}
            alt={anime.title}
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
          <div className="text-[0.8rem] font-semibold text-white line-clamp-2 drop-shadow">
            {anime.title}
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
              {anime.poster_image_url && !imageFailed ? (
                <Image
                  src={anime.poster_image_url}
                  alt={anime.title}
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
                    {anime.title}
                  </p>
                  {subtitle && (
                    <p className="text-[0.7rem] text-neutral-300">{subtitle}</p>
                  )}
                </div>
              </div>

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
              {anime.tags && anime.tags.length > 0 && (
                <div className="flex flex-wrap gap-1 text-[0.65rem] text-neutral-300">
                  {anime.tags.slice(0, 3).map((tag) => (
                    <span
                      key={tag}
                      className="rounded-full bg-neutral-900/80 px-2 py-0.5"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </Link>
  );
}

