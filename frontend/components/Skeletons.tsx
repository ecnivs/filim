"use client";

export function RowSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="space-y-3">
      <div className="h-5 w-32 rounded bg-neutral-800" />
      <div className="flex gap-3 overflow-hidden">
        {Array.from({ length: count }).map((_, index) => (
          <div
            // eslint-disable-next-line react/no-array-index-key
            key={index}
            className="min-w-[180px] max-w-[200px] aspect-[2/3] rounded-md bg-neutral-900"
          />
        ))}
      </div>
    </div>
  );
}

