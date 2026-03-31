"use client";

import { useEffect, useState } from "react";

export function SplashLoader({
    onComplete,
    isLoading = false
}: {
    onComplete?: () => void;
    isLoading?: boolean;
}) {
    const [isVisible, setIsVisible] = useState(true);
    const [shouldRender, setShouldRender] = useState(true);
    const [minTimePassed, setMinTimePassed] = useState(false);
    const [stableLoading, setStableLoading] = useState(true);

    useEffect(() => {
        if (isLoading) {
            setStableLoading(true);
        } else {
            const timer = setTimeout(() => {
                setStableLoading(false);
            }, 800);
            return () => clearTimeout(timer);
        }
    }, [isLoading]);

    useEffect(() => {
        const timer = setTimeout(() => {
            setMinTimePassed(true);
        }, 1200);
        return () => clearTimeout(timer);
    }, []);

    useEffect(() => {
        if (!stableLoading && minTimePassed) {
            setIsVisible(false);

            const doneTimer = setTimeout(() => {
                if (onComplete) onComplete();
                setShouldRender(false);
            }, 500);

            return () => clearTimeout(doneTimer);
        }
    }, [stableLoading, minTimePassed, onComplete]);

    if (!shouldRender) return null;

    return (
        <div
            className={`fixed inset-0 z-[100] flex items-center justify-center bg-black transition-opacity duration-500 ease-in-out ${isVisible ? "opacity-100" : "opacity-0 pointer-events-none"
                }`}
        >
            <div className="flex flex-col items-center justify-center">
                <h1 className="text-ncyan text-6xl md:text-8xl lg:text-9xl font-black tracking-tighter uppercase drop-shadow-[0_0_25px_rgba(6,182,212,0.6)] animate-splash-logo will-change-transform">
                    Filim
                </h1>
            </div>
        </div>
    );
}
