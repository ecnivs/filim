"use client";

import { ReactNode, useEffect, useState } from "react";
import { QueryClient, QueryClientProvider, useIsFetching } from "@tanstack/react-query";
import { ProfileProvider, useProfile } from "@/lib/profile-context";
import { SplashLoader } from "./SplashLoader";
import { AppLockGate } from "./AppLockGate";

const queryClient = new QueryClient({
    defaultOptions: {
        queries: {
            staleTime: 5 * 60 * 1000,
            gcTime: 30 * 60 * 1000,
            refetchOnWindowFocus: false,
            retry: 1
        }
    }
});

function SplashManager({ children }: { children: ReactNode }) {
    const isFetching = useIsFetching();
    const { isReady: profileReady } = useProfile();
    const [splashDone, setSplashDone] = useState(false);

    return (
        <>
            {!splashDone && (
                <SplashLoader
                    isLoading={isFetching > 0 || !profileReady}
                    onComplete={() => setSplashDone(true)}
                />
            )}
            {children}
        </>
    );
}

export function ClientProviders({ children }: { children: ReactNode }) {
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    if (!mounted) {
        return <div className="bg-background min-h-screen" />;
    }

    return (
        <QueryClientProvider client={queryClient}>
            <AppLockGate>
                <ProfileProvider>
                    <SplashManager>
                        {children}
                    </SplashManager>
                </ProfileProvider>
            </AppLockGate>
        </QueryClientProvider>
    );
}
