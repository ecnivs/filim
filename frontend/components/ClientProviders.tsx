"use client";

import { ReactNode, useEffect, useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ProfileProvider } from "@/lib/profile-context";

const queryClient = new QueryClient();

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
            <ProfileProvider>{children}</ProfileProvider>
        </QueryClientProvider>
    );
}
