"use client";

export function RowSkeleton({ count = 7 }: { count?: number }) {
    return (
        <div className="space-y-2 px-[4%]">
            <div className="h-5 w-36 rounded bg-neutral-800 animate-shimmer" />
            <div className="flex gap-[0.3vw] overflow-hidden">
                {Array.from({ length: count }).map((_, index) => (
                    <div
                        key={index}
                        className="flex-shrink-0 w-[calc(92vw/2)] sm:w-[calc(92vw/3)] md:w-[calc(92vw/4)] lg:w-[calc(92vw/5)] xl:w-[calc(92vw/6)] aspect-[2/3] rounded-[4px] bg-neutral-800 animate-shimmer"
                        style={{ animationDelay: `${index * 100}ms` }}
                    />
                ))}
            </div>
        </div>
    );
}
