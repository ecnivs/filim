"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/http";
import { useProfile } from "@/lib/profile-context";

type Profile = {
    id: string;
    name: string;
    is_locked: boolean;
};

type ProfilesResponse = {
    items: Profile[];
};

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

export default function ProfilesPage() {
    const router = useRouter();
    const { profile, setProfile } = useProfile();
    const queryClient = useQueryClient();
    const [isCreating, setIsCreating] = useState(false);
    const [createName, setCreateName] = useState("");
    const [createPin, setCreatePin] = useState("");
    const [createError, setCreateError] = useState<string | null>(null);
    const [pinInput, setPinInput] = useState("");
    const [pinError, setPinError] = useState<string | null>(null);
    const [unlockingProfile, setUnlockingProfile] = useState<Profile | null>(null);

    const profiles = useQuery({
        queryKey: ["profiles"],
        queryFn: async () => {
            const res = await api.get<ProfilesResponse>("/profiles");
            return res.data.items;
        }
    });

    const createProfile = useMutation({
        mutationFn: async (payload: { name: string; pin?: string | null }) => {
            const res = await api.post<Profile>("/profiles", {
                name: payload.name,
                pin: payload.pin ?? null
            });
            return res.data;
        },
        onSuccess: () => {
            void queryClient.invalidateQueries({ queryKey: ["profiles"] });
            setIsCreating(false);
            setCreateName("");
            setCreatePin("");
            setCreateError(null);
        }
    });

    const verifyPin = useMutation({
        mutationFn: async (payload: { profile: Profile; pin: string }) => {
            await api.post(`/profiles/${payload.profile.id}/verify-pin`, {
                pin: payload.pin
            });
        },
        onSuccess: (_data, variables) => {
            setPinError(null);
            setUnlockingProfile(null);
            setPinInput("");
            setProfile({ id: variables.profile.id, name: variables.profile.name });
            router.push("/");
        },
        onError: () => {
            setPinError("Incorrect PIN. Try again.");
        }
    });

    const handleSelectProfile = (p: Profile) => {
        if (p.is_locked) {
            setUnlockingProfile(p);
            setPinInput("");
            setPinError(null);
            return;
        }
        setProfile({ id: p.id, name: p.name });
        router.push("/");
    };

    const handleCreateSubmit = () => {
        const trimmed = createName.trim();
        if (!trimmed) {
            setCreateError("Please enter a name.");
            return;
        }
        setCreateError(null);
        createProfile.mutate({
            name: trimmed,
            pin: createPin.trim() || null
        });
    };

    return (
        <main className="min-h-screen bg-background text-white flex items-center justify-center">
            <div className="w-full max-w-4xl px-4 py-10 space-y-10">
                <div className="text-center space-y-2 animate-fade-in-up">
                    <h1 className="text-3xl sm:text-4xl font-bold">Who&apos;s watching?</h1>
                    {profile && (
                        <p className="text-sm text-neutral-500">
                            Currently: <span className="text-neutral-300 font-medium">{profile.name}</span>
                        </p>
                    )}
                </div>

                <div className="flex flex-wrap justify-center gap-6 sm:gap-8">
                    {profiles.data?.map((p, i) => (
                        <button
                            key={p.id}
                            type="button"
                            onClick={() => handleSelectProfile(p)}
                            className="group flex flex-col items-center gap-3 animate-fade-in-up"
                            style={{ animationDelay: `${i * 100}ms` }}
                        >
                            <div className={`h-28 w-28 sm:h-32 sm:w-32 rounded-md bg-gradient-to-br ${AVATAR_COLORS[i % AVATAR_COLORS.length]} flex items-center justify-center text-4xl sm:text-5xl font-black text-white/90 transition-all duration-200 group-hover:ring-4 group-hover:ring-white group-hover:scale-105`}>
                                {p.name.slice(0, 1).toUpperCase()}
                            </div>
                            <div className="text-sm font-medium text-neutral-400 group-hover:text-white transition-colors">
                                {p.name}
                            </div>
                            {p.is_locked && (
                                <div className="text-[0.65rem] uppercase tracking-wider text-neutral-600 flex items-center gap-1">
                                    🔒 Locked
                                </div>
                            )}
                        </button>
                    ))}

                    <button
                        type="button"
                        onClick={() => {
                            setIsCreating(true);
                            setCreateName("");
                            setCreatePin("");
                            setCreateError(null);
                        }}
                        className="group flex flex-col items-center gap-3 animate-fade-in-up"
                        style={{ animationDelay: `${(profiles.data?.length ?? 0) * 100}ms` }}
                    >
                        <div className="h-28 w-28 sm:h-32 sm:w-32 rounded-md border-2 border-dashed border-neutral-700 text-5xl text-neutral-700 flex items-center justify-center transition-all duration-200 group-hover:border-white group-hover:text-white group-hover:scale-105">
                            +
                        </div>
                        <div className="text-sm font-medium text-neutral-400 group-hover:text-white transition-colors">
                            Add Profile
                        </div>
                    </button>
                </div>

                {isCreating && (
                    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center px-4">
                        <div className="w-full max-w-sm rounded-lg bg-surface border border-neutral-800 px-6 py-6 space-y-5 shadow-[0_16px_60px_rgba(0,0,0,0.8)]">
                            <h2 className="text-xl font-bold">Add Profile</h2>
                            <div className="space-y-2">
                                <label className="block text-xs text-neutral-400 font-medium">Name</label>
                                <input
                                    type="text"
                                    value={createName}
                                    onChange={(e) => setCreateName(e.target.value)}
                                    className="w-full rounded bg-neutral-800 border border-neutral-700 px-4 py-2.5 text-sm text-white focus:outline-none focus:border-white transition-colors"
                                    placeholder="Enter name"
                                    autoFocus
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="block text-xs text-neutral-400 font-medium">PIN (optional)</label>
                                <input
                                    type="password"
                                    inputMode="numeric"
                                    maxLength={6}
                                    value={createPin}
                                    onChange={(e) =>
                                        setCreatePin(e.target.value.replace(/\\D/g, ""))
                                    }
                                    className="w-full rounded bg-neutral-800 border border-neutral-700 px-4 py-2.5 text-sm text-white focus:outline-none focus:border-white transition-colors"
                                    placeholder="••••"
                                />
                            </div>
                            {createError && (
                                <p className="text-xs text-red-400">{createError}</p>
                            )}
                            <div className="flex justify-end gap-3">
                                <button
                                    type="button"
                                    onClick={() => {
                                        setIsCreating(false);
                                        setCreateName("");
                                        setCreatePin("");
                                        setCreateError(null);
                                    }}
                                    className="text-sm text-neutral-500 hover:text-white transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="button"
                                    onClick={handleCreateSubmit}
                                    className="rounded bg-white px-5 py-2 text-sm font-bold text-black hover:bg-neutral-200 transition-colors"
                                >
                                    Save
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {unlockingProfile && (
                    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center px-4">
                        <div className="w-full max-w-xs rounded-lg bg-surface border border-neutral-800 px-6 py-6 space-y-4 shadow-[0_16px_60px_rgba(0,0,0,0.8)]">
                            <div className="text-center space-y-2">
                                <div className={`h-16 w-16 mx-auto rounded-md bg-gradient-to-br ${AVATAR_COLORS[0]} flex items-center justify-center text-2xl font-black text-white/90`}>
                                    {unlockingProfile.name.slice(0, 1).toUpperCase()}
                                </div>
                                <h2 className="text-lg font-bold">{unlockingProfile.name}</h2>
                                <p className="text-xs text-neutral-500">Enter your PIN to continue</p>
                            </div>
                            <input
                                type="password"
                                inputMode="numeric"
                                maxLength={6}
                                value={pinInput}
                                onChange={(e) => setPinInput(e.target.value.replace(/\\D/g, ""))}
                                className="w-full rounded bg-neutral-800 border border-neutral-700 px-4 py-2.5 text-sm text-white text-center tracking-[0.5em] focus:outline-none focus:border-white transition-colors"
                                autoFocus
                                onKeyDown={(e) => {
                                    if (e.key === "Enter" && unlockingProfile) {
                                        verifyPin.mutate({ profile: unlockingProfile, pin: pinInput });
                                    }
                                }}
                            />
                            {pinError && (
                                <p className="text-xs text-red-400 text-center">{pinError}</p>
                            )}
                            <div className="flex justify-center gap-3">
                                <button
                                    type="button"
                                    onClick={() => {
                                        setUnlockingProfile(null);
                                        setPinInput("");
                                        setPinError(null);
                                    }}
                                    className="text-sm text-neutral-500 hover:text-white transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="button"
                                    onClick={() => {
                                        if (!unlockingProfile) return;
                                        verifyPin.mutate({ profile: unlockingProfile, pin: pinInput });
                                    }}
                                    className="rounded bg-white px-5 py-2 text-sm font-bold text-black hover:bg-neutral-200 transition-colors"
                                >
                                    Unlock
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </main>
    );
}
