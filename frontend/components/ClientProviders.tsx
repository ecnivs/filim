"use client";

import { ReactNode, useEffect, useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ProfileProvider } from "@/lib/profile-context";
import { SplashLoader } from "./SplashLoader";

const queryClient = new QueryClient();

export function ClientProviders({ children }: { children: ReactNode }) {
    const [mounted, setMounted] = useState(false);
    const [splashDone, setSplashDone] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    if (!mounted) {
        return <div className="bg-background min-h-screen" />;
    }

    return (
        <QueryClientProvider client={queryClient}>
            <ProfileProvider>
                {!splashDone && <SplashLoader onComplete={() => setSplashDone(true)} />}
                {children}
            </ProfileProvider>
        </QueryClientProvider>
    );
}
