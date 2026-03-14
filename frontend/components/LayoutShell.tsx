"use client";

import Link from "next/link";
import { ReactNode, useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ProfileProvider, useProfile } from "@/lib/profile-context";
import { Suspense, useRef } from "react";

const NAV_ITEMS: { href: string; label: string }[] = [
    { href: "/", label: "Home" }
];

function LayoutShellInner({ children }: { children: ReactNode }) {
    const pathname = usePathname();
    const router = useRouter();
    const searchParams = useSearchParams();
    const { profile, isReady } = useProfile();
    const [scrolled, setScrolled] = useState(false);
    const [isSearchExpanded, setIsSearchExpanded] = useState(false);
    const [searchQuery, setSearchQuery] = useState(searchParams.get("q") || "");
    const searchInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (!isReady) return;
        if (!profile && pathname !== "/profiles") {
            router.replace("/profiles");
        }
    }, [isReady, profile, pathname, router]);

    useEffect(() => {
        const onScroll = () => setScrolled(window.scrollY > 10);
        window.addEventListener("scroll", onScroll, { passive: true });
        return () => window.removeEventListener("scroll", onScroll);
    }, []);

    // 1. Sync state FROM URL (External changes like Back button)
    useEffect(() => {
        const urlQuery = searchParams.get("q") || "";
        if (urlQuery !== searchQuery) {
            if (urlQuery) {
                setSearchQuery(urlQuery);
                setIsSearchExpanded(true);
            } else if (pathname === "/") {
                setSearchQuery("");
                setIsSearchExpanded(false);
            }
        }
    }, [searchParams, pathname]);

    // 2. Push state TO URL (Debounced typing)
    useEffect(() => {
        const timer = setTimeout(() => {
            const urlQuery = searchParams.get("q") || "";
            if (searchQuery === urlQuery) return;

            if (searchQuery.trim()) {
                router.push(`/?q=${encodeURIComponent(searchQuery.trim())}`);
            } else if (urlQuery) {
                router.push("/");
            }
        }, 500);

        return () => clearTimeout(timer);
    }, [searchQuery, router]);

    useEffect(() => {
        if (isSearchExpanded) {
            searchInputRef.current?.focus();
        }
    }, [isSearchExpanded]);

    const handleSearchSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (searchQuery.trim()) {
            router.push(`/?q=${encodeURIComponent(searchQuery.trim())}`);
        }
    };

    const toggleSearch = () => {
        if (!isSearchExpanded) {
            setIsSearchExpanded(true);
        } else {
            searchInputRef.current?.focus();
        }
    };

    if (pathname.startsWith("/watch/")) {
        return <>{children}</>;
    }

    return (
        <div className="min-h-screen bg-background text-foreground">
            <header
                className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 select-none ${scrolled
                    ? "bg-background/95 backdrop-blur-md shadow-[0_2px_20px_rgba(0,0,0,0.5)]"
                    : "bg-gradient-to-b from-black/80 via-black/40 to-transparent"
                    }`}
            >
                <div className="flex h-16 items-center justify-between px-[4%]">
                    <div className="flex items-center gap-6">
                        <Link
                            href="/"
                            className="text-ncyan text-2xl font-black tracking-tighter uppercase p-0 m-0 leading-none select-none"
                        >
                            Filim
                        </Link>
                        <nav className="hidden md:flex items-center gap-6 text-sm">
                            {NAV_ITEMS.map((item) => {
                                const isActive =
                                    item.href === "/"
                                        ? pathname === "/"
                                        : pathname.startsWith(item.href);
                                return (
                                    <Link
                                        key={item.label}
                                        href={item.href}
                                        className={`font-medium transition-colors select-none ${isActive
                                            ? "text-white"
                                            : "text-neutral-300 hover:text-white"
                                            }`}
                                    >
                                        {item.label}
                                    </Link>
                                );
                            })}
                        </nav>
                    </div>
                    <div className="flex items-center gap-4">
                        <div className={`relative flex items-center transition-all duration-300 ${isSearchExpanded ? "w-64" : "w-8"}`}>
                            <button
                                type="button"
                                onClick={toggleSearch}
                                className="text-white hover:text-neutral-300 transition-colors p-1 z-10 select-none"
                                aria-label="Toggle search"
                            >
                                <svg
                                    xmlns="http://www.w3.org/2000/svg"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="2.5"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    className="w-5 h-5"
                                >
                                    <circle cx="11" cy="11" r="8"></circle>
                                    <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                                </svg>
                            </button>
                            <form
                                onSubmit={handleSearchSubmit}
                                className={`absolute left-0 top-1/2 -translate-y-1/2 w-full transition-all duration-300 overflow-hidden ${isSearchExpanded ? "opacity-100 pl-8" : "opacity-0 pointer-events-none"}`}
                            >
                                <input
                                    ref={searchInputRef}
                                    type="text"
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    onBlur={() => !searchQuery && setIsSearchExpanded(false)}
                                    placeholder="Titles, genres..."
                                    className="w-full bg-black/60 border border-white/20 backdrop-blur-md rounded py-1 pl-2 pr-4 text-sm text-white focus:outline-none focus:border-white/40"
                                />
                            </form>
                        </div>
                        {profile && (
                            <Link href="/profiles" className="flex items-center gap-2 group">
                                <div className="h-8 w-8 rounded bg-ncyan flex items-center justify-center text-sm font-bold text-black group-hover:ring-2 group-hover:ring-white transition-all">
                                    {profile.name.slice(0, 1).toUpperCase()}
                                </div>
                            </Link>
                        )}
                    </div>
                </div>
            </header>
            <main>{children}</main>
        </div>
    );
}

export function LayoutShell({ children }: { children: ReactNode }) {
    return (
        <Suspense fallback={<div className="min-h-screen bg-background" />}>
            <LayoutShellInner>{children}</LayoutShellInner>
        </Suspense>
    );
}
