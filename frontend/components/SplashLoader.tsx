"use client";

import { useEffect, useState } from "react";

export function SplashLoader({ onComplete }: { onComplete?: () => void }) {
    const [isVisible, setIsVisible] = useState(true);
    const [shouldRender, setShouldRender] = useState(true);

    useEffect(() => {
        const timerOut = setTimeout(() => {
            setIsVisible(false);
            if (onComplete) onComplete();
        }, 2200);
        const timerRender = setTimeout(() => setShouldRender(false), 2700);

        return () => {
            clearTimeout(timerOut);
            clearTimeout(timerRender);
        };
    }, [onComplete]);

    if (!shouldRender) return null;

    return (
        <div
            className={`fixed inset-0 z-[100] flex items-center justify-center bg-black transition-opacity duration-500 ease-in-out ${
                isVisible ? "opacity-100" : "opacity-0 pointer-events-none"
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
