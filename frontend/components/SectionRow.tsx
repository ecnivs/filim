"use client";

import { Children, ReactNode, useState } from "react";

type SectionRowProps = {
  title: string;
  children: ReactNode;
  browseLabel?: string;
};

export function SectionRow({
  title,
  children,
  browseLabel = "Browse all"
}: SectionRowProps) {
  const [isOpen, setIsOpen] = useState(false);
  const hasItems = Children.count(children) > 0;

  return (
    <>
      <section className="relative z-40 space-y-3">
        <div className="mx-auto flex max-w-6xl items-baseline px-1">
          <h2 className="text-lg sm:text-xl font-semibold text-white">{title}</h2>
          {hasItems && (
            <button
              type="button"
              onClick={() => setIsOpen(true)}
              className="ml-4 inline-flex items-center gap-1 text-[0.7rem] sm:text-xs text-neutral-400 hover:text-white"
            >
              <span>{browseLabel}</span>
              <span aria-hidden>›</span>
            </button>
          )}
        </div>
        <div className="relative mx-auto max-w-6xl">
          <div className="flex gap-3 overflow-x-auto overflow-y-visible pb-6 snap-x snap-mandatory scroll-smooth scrollbar-none">
            {children}
          </div>
        </div>
      </section>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex h-full w-full items-center justify-center bg-black/80 px-4 py-6">
          <div className="relative flex h-full max-h-[80vh] w-full max-w-6xl flex-col overflow-hidden rounded-2xl border border-neutral-900/80 bg-gradient-to-b from-neutral-950 via-black to-neutral-950 shadow-[0_28px_80px_rgba(0,0,0,0.9)]">
            <div className="flex items-center justify-between border-b border-neutral-900/80 px-6 py-4">
              <div className="space-y-1">
                <p className="text-[0.65rem] uppercase tracking-[0.18em] text-neutral-400">
                  Explore all
                </p>
                <h2 className="text-xl sm:text-2xl font-semibold text-white">
                  {title}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="rounded-full border border-neutral-700/80 px-3 py-1.5 text-xs font-medium text-neutral-300 hover:border-white hover:text-white hover:bg-neutral-900"
              >
                Close
              </button>
            </div>
            <div className="relative flex-1 overflow-y-auto px-6 py-5">
              <div className="grid grid-cols-2 gap-5 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
                {children}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

