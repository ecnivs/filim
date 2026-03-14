"use client";

import Link from "next/link";
import { ReactNode, useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { ProfileProvider, useProfile } from "@/lib/profile-context";

const NAV_ITEMS: { href: string; label: string }[] = [
    { href: "/", label: "Home" }
];

function LayoutShellInner({ children }: { children: ReactNode }) {
    const pathname = usePathname();
    const router = useRouter();
    const { profile, isReady } = useProfile();
    const [scrolled, setScrolled] = useState(false);
    const [isSearchExpanded, setIsSearchExpanded] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");

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

    const handleSearchSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (searchQuery.trim()) {
            router.push(`/?q=${encodeURIComponent(searchQuery.trim())}`);
        }
    };

    if (pathname.startsWith("/watch/")) {
        return <>{children}</>;
    }

    return (
        <div className="min-h-screen bg-background text-foreground">
            <header
                className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 ${scrolled
                    ? "bg-background/95 backdrop-blur-md shadow-[0_2px_20px_rgba(0,0,0,0.5)]"
                    : "bg-gradient-to-b from-black/80 via-black/40 to-transparent"
                    }`}
            >
                <div className="flex h-16 items-center justify-between px-[4%]">
                    <div className="flex items-center gap-6">
                        <Link
                            href="/"
                            className="text-ncyan text-2xl font-black tracking-tighter uppercase p-0 m-0 leading-none"
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
                                        className={`font-medium transition-colors ${isActive
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
                                onClick={() => setIsSearchExpanded(!isSearchExpanded)}
                                className="text-white hover:text-neutral-300 transition-colors p-1 z-10"
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
                                    type="text"
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    onBlur={() => !searchQuery && setIsSearchExpanded(false)}
                                    placeholder="Titles, genres..."
                                    className="w-full bg-black/60 border border-white/20 backdrop-blur-md rounded py-1 pl-2 pr-4 text-sm text-white focus:outline-none focus:border-white/40"
                                    autoFocus={isSearchExpanded}
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
    return <LayoutShellInner>{children}</LayoutShellInner>;
}
