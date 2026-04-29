"use client";

import { ReactNode, useEffect, useState } from "react";

const UNLOCK_KEY = "filim.appUnlocked";

export function AppLockGate({ children }: { children: ReactNode }) {
    const [state, setState] = useState<"checking" | "locked" | "unlocked">("checking");
    const [password, setPassword] = useState("");
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        async function check() {
            try {
                if (sessionStorage.getItem(UNLOCK_KEY)) {
                    setState("unlocked");
                    return;
                }
                const res = await fetch("/api/v1/admin/public");
                if (res.ok) {
                    const data = await res.json();
                    setState(data.app_lock_enabled ? "locked" : "unlocked");
                    return;
                }
            } catch {}
            setState("unlocked");
        }
        void check();
    }, []);

    const handleUnlock = async () => {
        if (!password || loading) return;
        setLoading(true);
        setError(null);
        try {
            const res = await fetch("/api/v1/admin/verify-lock", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ password }),
            });
            if (res.ok) {
                sessionStorage.setItem(UNLOCK_KEY, "1");
                setState("unlocked");
            } else {
                setError("Incorrect password");
                setPassword("");
            }
        } catch {
            setError("Connection error");
        } finally {
            setLoading(false);
        }
    };

    if (state === "checking") {
        return <div className="bg-background min-h-screen" />;
    }

    if (state === "locked") {
        return (
            <div className="fixed inset-0 z-[99999] bg-background flex flex-col items-center justify-center px-6">
                <div className="w-full max-w-xs space-y-8 text-center">
                    <div className="space-y-2">
                        <div className="text-ncyan text-4xl font-black tracking-tighter uppercase">
                            Filim
                        </div>
                        <p className="text-neutral-500 text-sm">Enter password to continue</p>
                    </div>

                    <div className="space-y-3">
                        <input
                            type="password"
                            value={password}
                            onChange={(e) => { setPassword(e.target.value); setError(null); }}
                            onKeyDown={(e) => e.key === "Enter" && handleUnlock()}
                            className="dialog-input text-center"
                            placeholder="Password"
                            autoFocus
                        />
                        {error && (
                            <p className="text-nred text-xs font-medium">{error}</p>
                        )}
                    </div>

                    <button
                        onClick={handleUnlock}
                        disabled={loading || !password}
                        className="w-full bg-ncyan text-black font-bold py-3 rounded-lg hover:bg-ncyan-dark disabled:opacity-40 transition-all active:scale-95"
                    >
                        {loading ? "Unlocking…" : "Unlock"}
                    </button>
                </div>
            </div>
        );
    }

    return <>{children}</>;
}
