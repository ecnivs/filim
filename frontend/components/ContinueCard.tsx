"use client";

import { useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { formatTime } from "@/lib/utils";

type ContinueCardProps = {
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
    widthClassName?: string;
};

export function ContinueCard({
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
    animeId,
    widthClassName = "w-[calc(92vw/2)] sm:w-[calc(92vw/3)] md:w-[calc(92vw/4)] lg:w-[calc(92vw/5)] xl:w-[calc(92vw/6)]"
}: ContinueCardProps) {
    const router = useRouter();
    const [imageFailed, setImageFailed] = useState(false);

    const handleCardClick = () => {
        router.push(href);
    };

    return (
        <div
            className={`group/card relative flex-shrink-0 ${widthClassName} transition-all duration-300 hover:z-50 cursor-pointer select-none`}
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
