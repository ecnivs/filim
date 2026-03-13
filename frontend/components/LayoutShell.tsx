"use client";

import Link from "next/link";
import { ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { ProfileProvider, useProfile } from "@/lib/profile-context";

const NAV_ITEMS: { href: string; label: string }[] = [
  { href: "/", label: "Home" }
];

function LayoutShellInner({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { profile, isReady } = useProfile();

  useEffect(() => {
    // Redirect to profile picker when no active profile is selected. Allow
    // the profiles page itself so that users can create/select one.
    if (!isReady) {
      return;
    }
    if (!profile && pathname !== "/profiles") {
      router.replace("/profiles");
    }
  }, [isReady, profile, pathname, router]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-black via-neutral-950 to-black text-foreground flex flex-col">
      <header className="sticky top-0 z-40 border-b border-neutral-800 bg-gradient-to-b from-black/80 via-black/60 to-transparent backdrop-blur">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-10 flex h-14 items-center justify-between">
          <div className="flex items-center gap-8">
            <Link
              href="/"
              className="text-2xl font-semibold tracking-tight text-white"
            >
              Filim
            </Link>
            <nav className="hidden md:flex items-center gap-4 text-sm text-neutral-300">
              {NAV_ITEMS.map((item) => {
                const isActive =
                  item.href === "/"
                    ? pathname === "/"
                    : pathname.startsWith(item.href);
                return (
                  <Link
                    key={item.label}
                    href={item.href}
                    className={`transition-colors ${
                      isActive
                        ? "text-white font-semibold"
                        : "hover:text-white"
                    }`}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </nav>
          </div>
        </div>
      </header>
      <div className="flex-1">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-10 py-6">
          {children}
        </div>
      </div>
    </div>
  );
}

export function LayoutShell({ children }: { children: ReactNode }) {
  return (
    <ProfileProvider>
      <LayoutShellInner>{children}</LayoutShellInner>
    </ProfileProvider>
  );
}

