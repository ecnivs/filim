"use client";

import Link from "next/link";
import { ReactNode, useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ProfileProvider, useProfile } from "@/lib/profile-context";
import { Suspense, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/http";

const NAV_ITEMS: { href: string; label: string }[] = [
    { href: "/", label: "Home" },
    { href: "/shows", label: "Shows" },
    { href: "/movies", label: "Movies" },
    { href: "/trending", label: "Trending" },
    { href: "/mylist", label: "My List" }
];

function LayoutShellInner({ children }: { children: ReactNode }) {
    const pathname = usePathname();
    const router = useRouter();
    const searchParams = useSearchParams();
    const { profile, isReady, logout, setProfile } = useProfile();
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
                <div className="flex h-12 md:h-16 items-center justify-between px-[4%]">
                    <div className="flex items-center gap-4 md:gap-6">
                        <Link
                            href="/"
                            className="text-ncyan text-xl md:text-2xl font-black tracking-tighter uppercase p-0 m-0 leading-none select-none"
                        >
                            Filim
                        </Link>
                        {pathname !== "/profiles" && (
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
                        )}
                    </div>
                    <div className="flex items-center gap-3 md:gap-4">
                        {/* Search — inline on desktop, full-width overlay on mobile */}
                        {pathname !== "/profiles" && (
                            <div className={`relative flex items-center transition-all duration-300 ${isSearchExpanded ? "md:w-64 w-[calc(100vw-7rem)]" : "w-8"}`}>
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
                                        className="w-full bg-black/60 border border-white/20 backdrop-blur-md rounded py-1.5 md:py-1 pl-2 pr-4 text-sm text-white focus:outline-none focus:border-white/40"
                                    />
                                </form>
                            </div>
                        )}
                        {pathname !== "/profiles" && profile && (
                            <div className="relative group">
                                <button
                                    type="button"
                                    className="focus:outline-none flex items-center group/btn"
                                >
                                    <div className="h-8 w-8 md:h-9 md:w-9 rounded bg-ncyan flex items-center justify-center text-sm md:text-base font-bold text-black transition-all">
                                        {profile.name.slice(0, 1).toUpperCase()}
                                    </div>
                                </button>

                                {/* Dropdown Menu */}
                                <div className="absolute right-0 mt-2 w-56 origin-top-right rounded-lg bg-surface border border-neutral-800 shadow-[0_16px_60px_rgba(0,0,0,0.8)] opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-[60] overflow-hidden">
                                    <div className="py-2">
                                        {/* Other Profiles */}
                                        <div className="px-3 py-2 space-y-2">
                                            <p className="text-[10px] uppercase font-bold text-neutral-500 tracking-widest mb-1">Switch Profile</p>
                                            <ProfileDropdownItems currentId={profile?.id} />
                                        </div>

                                        <div className="border-t border-neutral-800 my-1" />

                                        <button
                                            onClick={() => logout()}
                                            className="w-full text-left px-4 py-3 text-sm font-medium text-white hover:bg-white/5 transition-colors"
                                        >
                                            Sign out of Filim
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </header>
            {/* Mobile Navigation - Scrollable Absolute Overlay (part of page content) */}
            {pathname !== "/profiles" && !searchParams.get("q") && (
                <nav className="absolute top-0 left-0 right-0 z-40 flex md:hidden overflow-x-auto scrollbar-none items-center gap-3 pt-14 pb-2 px-[4%] transition-all duration-300">
                    <div className="flex items-center gap-2 flex-nowrap">
                        {NAV_ITEMS.filter(item => item.label !== "Home").map((item) => {
                            const isActive =
                                item.href === "/"
                                    ? pathname === "/"
                                    : pathname.startsWith(item.href);
                            return (
                                <Link
                                    key={item.label}
                                    href={item.href}
                                    className={`px-4 py-1.5 rounded-full text-sm font-bold transition-all select-none border whitespace-nowrap ${isActive
                                        ? "bg-white text-black border-white"
                                        : "bg-black/20 text-white border-white/40 hover:bg-white/10"
                                        }`}
                                >
                                    {item.label}
                                </Link>
                            );
                        })}
                    </div>
                </nav>
            )}
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

const AVATAR_COLORS = [
    "from-nred to-red-800",
    "from-blue-600 to-blue-900",
    "from-emerald-600 to-emerald-900",
    "from-amber-500 to-amber-800",
    "from-purple-600 to-purple-900",
    "from-pink-600 to-pink-900",
    "from-teal-500 to-teal-800",
    "from-orange-500 to-orange-800"
];

function ProfileDropdownItems({ currentId }: { currentId?: string }) {
    const { setProfile } = useProfile();
    const router = useRouter();

    const { data: profiles } = useQuery({
        queryKey: ["profiles"],
        queryFn: async () => {
            const res = await api.get<{ items: { id: string, name: string }[] }>("/profiles");
            return res.data.items;
        }
    });

    const others = profiles?.filter(p => p.id !== currentId) || [];

    return (
        <div className="space-y-1">
            {others.map((p, i) => (
                <button
                    key={p.id}
                    onClick={() => {
                        setProfile({ id: p.id, name: p.name });
                        window.location.href = "/";
                    }}
                    className="w-full flex items-center gap-2 group/item px-1 py-1 rounded hover:bg-white/5 transition-colors"
                >
                    <div className={`h-6 w-6 rounded bg-gradient-to-br ${AVATAR_COLORS[(i + 1) % AVATAR_COLORS.length]} flex items-center justify-center text-[10px] font-bold text-white`}>
                        {p.name.slice(0, 1).toUpperCase()}
                    </div>
                    <span className="text-xs font-medium text-neutral-400 group-hover/item:text-white transition-colors">
                        {p.name}
                    </span>
                </button>
            ))}
        </div>
    );
}
