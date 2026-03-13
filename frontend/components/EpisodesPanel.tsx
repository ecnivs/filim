"use client";

import Link from "next/link";

type EpisodeSummary = {
  number: string;
  title?: string | null;
};

type EpisodesPanelProps = {
  animeId: string;
  animeTitle?: string;
  episodes: EpisodeSummary[];
  currentEpisode: string;
  isOpen: boolean;
  onClose: () => void;
};

export function EpisodesPanel({
  animeId,
  animeTitle,
  episodes,
  currentEpisode,
  isOpen,
  onClose
}: EpisodesPanelProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-40 flex justify-end bg-black/40 backdrop-blur-sm">
      <div className="flex h-full w-full max-w-md flex-col bg-neutral-950/95 border-l border-neutral-800">
        <div className="flex items-center justify-between border-b border-neutral-800 px-4 py-3">
          <div>
            <p className="text-xs uppercase tracking-wide text-neutral-400">
              Episodes
            </p>
            {animeTitle && (
              <p className="text-sm font-semibold text-white line-clamp-1">
                {animeTitle}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full bg-neutral-900 px-2 py-1 text-xs text-neutral-300 hover:bg-neutral-800"
          >
            Close
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-3 py-3">
          <ul className="space-y-2">
            {episodes
              .filter(
                (ep) =>
                  animeId &&
                  animeId !== "undefined" &&
                  ep.number &&
                  ep.number !== "undefined"
              )
              .map((ep) => {
                const isCurrent = ep.number === currentEpisode;
                return (
                  <li key={ep.number}>
                    <Link
                      href={`/watch/${animeId}/${ep.number}`}
                      className={`flex items-center justify-between rounded-md px-3 py-2 text-sm transition ${
                        isCurrent
                          ? "bg-cyan text-black"
                          : "bg-neutral-900 text-neutral-100 hover:bg-neutral-800"
                      }`}
                      onClick={onClose}
                    >
                      <div className="flex flex-col">
                        <span className="font-medium">
                          Episode {ep.number}
                        </span>
                        {ep.title && !isCurrent && (
                          <span className="text-xs text-neutral-300 line-clamp-1">
                            {ep.title}
                          </span>
                        )}
                      </div>
                      {!isCurrent && (
                        <span className="text-[0.7rem] text-neutral-300">
                          Play
                        </span>
                      )}
                    </Link>
                  </li>
                );
              })}
          </ul>
        </div>
      </div>
    </div>
  );
}

