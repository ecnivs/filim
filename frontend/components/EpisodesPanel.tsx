"use client";

import Link from "next/link";
import { useState, useEffect, Fragment } from "react";
import { ChevronLeft, Check, Play } from "lucide-react";
import { Transition } from "@headlessui/react";

type EpisodeSummary = {
    number: string;
    title?: string | null;
    description?: string | null;
    thumbnail_url?: string | null;
    duration_seconds?: number | null;
    progress_percent?: number;
};

type EpisodesPanelProps = {
    animeId: string;
    animeTitle?: string;
    episodes: EpisodeSummary[];
    currentEpisode: string;
    isOpen: boolean;
    onClose: () => void;
    seasons?: { id: string; title: string }[];
};

export function EpisodesPanel({
    animeId,
    animeTitle,
    episodes: initialEpisodes,
    currentEpisode,
    isOpen,
    onClose,
    seasons = []
}: EpisodesPanelProps) {
    const [mode, setMode] = useState<"episodes" | "seasons">("episodes");
    const [focusedEpisode, setFocusedEpisode] = useState<string | null>(null);

    useEffect(() => {
        if (isOpen) {
            setMode("episodes");
            setFocusedEpisode(currentEpisode);
        }
    }, [isOpen, currentEpisode]);

    // Filter seasons to only include actual seasons (e.g. "Season", "S1", "Part")
    // and exclude unrelated series titles.
    const filteredSeasons = seasons.filter(s =>
        /season|s\d+|part|cour/i.test(s.title) ||
        s.id === animeId
    );

    // Find the current season title
    const currentSeason = filteredSeasons.find((s) => s.id === animeId) || filteredSeasons[0];

    return (
        <Transition
            show={isOpen}
            as={Fragment}
            enter="transition duration-150 ease-out"
            enterFrom="opacity-0 scale-95 translate-y-2"
            enterTo="opacity-100 scale-100 translate-y-0"
            leave="transition duration-100 ease-in"
            leaveFrom="opacity-100 scale-100 translate-y-0"
            leaveTo="opacity-0 scale-95 translate-y-2"
        >
            <div
                className="absolute bottom-full right-0 mb-4 w-[280px] sm:w-[400px] max-h-[70vh] flex flex-col rounded-lg bg-[#141414]/95 backdrop-blur-3xl border border-white/10 shadow-[0_20px_50px_rgba(0,0,0,0.5)] ring-1 ring-white/10 z-50 overflow-hidden"
                onClick={(e) => e.stopPropagation()}
            >
                {mode === "episodes" ? (
                    <div className="flex flex-col min-h-0">
                        {/* Header for Episodes Mode */}
                        <div className="flex items-center gap-4 border-b border-white/5 px-6 py-5">
                            {filteredSeasons.length > 1 ? (
                                <button
                                    onClick={() => setMode("seasons")}
                                    className="group flex items-center gap-2 text-white transition-colors"
                                    aria-label="Select season"
                                >
                                    <span className="text-lg font-black uppercase tracking-[0.1em]">
                                        {currentSeason?.title || "Season 1"}
                                    </span>
                                    <ChevronLeft className="h-5 w-5 stroke-[3px] group-hover:text-neutral-400 -rotate-90" />
                                </button>
                            ) : (
                                <span className="text-lg font-black uppercase tracking-[0.1em] text-white">
                                    {currentSeason?.title || "Episodes"}
                                </span>
                            )}
                        </div>

                        {/* Episode List */}
                        <div className="flex-1 overflow-y-auto px-2 py-3 space-y-1 custom-scrollbar">
                            {initialEpisodes.map((ep) => {
                                const isCurrent = ep.number === currentEpisode;
                                const isFocused = focusedEpisode === ep.number;

                                return (
                                    <div
                                        key={ep.number}
                                        onMouseEnter={() => setFocusedEpisode(ep.number)}
                                        className={`group rounded-md transition-all duration-200 ${isFocused ? "bg-white/10 ring-1 ring-white/5" : ""
                                            }`}
                                    >
                                        <Link
                                            href={`/watch/${animeId}/${ep.number}`}
                                            className="block p-3"
                                            onClick={onClose}
                                        >
                                            <div className="flex items-start gap-3">
                                                <span className={`text-sm font-bold tabular-nums shrink-0 w-5 ${isCurrent ? "text-white" : "text-neutral-500"}`}>
                                                    {ep.number}
                                                </span>

                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center justify-between gap-2">
                                                        <span className={`text-sm font-bold truncate ${isCurrent ? "text-white font-black" : "text-neutral-200"}`}>
                                                            {ep.title || `Episode ${ep.number}`}
                                                        </span>
                                                        {isCurrent && <Play className="h-2.5 w-2.5 fill-white shrink-0" />}
                                                    </div>

                                                    {isFocused && (
                                                        <div className="mt-2 space-y-2 animate-fade-in">
                                                            {ep.thumbnail_url && (
                                                                <div className="relative aspect-video w-full rounded bg-white/5 overflow-hidden">
                                                                    <img
                                                                        src={ep.thumbnail_url}
                                                                        alt={ep.title || ""}
                                                                        className="h-full w-full object-cover"
                                                                    />
                                                                    {ep.progress_percent !== undefined && ep.progress_percent > 0 && (
                                                                        <div className="absolute bottom-0 left-0 h-1 bg-neutral-600 w-full">
                                                                            <div
                                                                                className="h-full bg-white"
                                                                                style={{ width: `${ep.progress_percent}%` }}
                                                                            />
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            )}
                                                            {ep.description && (
                                                                <p className="text-[0.65rem] text-neutral-500 line-clamp-2 leading-relaxed font-medium">
                                                                    {ep.description}
                                                                </p>
                                                            )}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </Link>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                ) : (
                    <div className="flex flex-col min-h-0">
                        {/* Header for Seasons Mode */}
                        <div className="border-b border-white/5 px-6 py-6 bg-white/5">
                            <h2 className="text-sm font-black text-neutral-500 uppercase tracking-[0.2em]">
                                {animeTitle}
                            </h2>
                        </div>

                        {/* Season List */}
                        <div className="flex-1 overflow-y-auto py-1 custom-scrollbar">
                            {filteredSeasons.map((s) => {
                                const isActive = s.id === animeId;
                                return (
                                    <button
                                        key={s.id}
                                        onClick={() => {
                                            if (isActive) {
                                                setMode("episodes");
                                            } else {
                                                window.location.href = `/watch/${s.id}/1`;
                                            }
                                        }}
                                        className={`flex items-center justify-between w-full px-6 py-4 text-sm font-bold transition-all uppercase tracking-wider ${isActive
                                            ? "text-white"
                                            : "text-neutral-500 hover:text-white"
                                            }`}
                                    >
                                        <span>{s.title}</span>
                                        {isActive && <Check className="h-5 w-5 stroke-[4px]" />}
                                    </button>
                                );
                            })}
                        </div>

                        <div className="p-4 border-t border-white/5">
                            <button
                                onClick={() => setMode("episodes")}
                                className="w-full py-2.5 rounded-md bg-white/5 text-xs text-neutral-400 font-bold hover:bg-white/10 hover:text-white transition-all uppercase tracking-[0.2em]"
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </Transition>
    );
}
