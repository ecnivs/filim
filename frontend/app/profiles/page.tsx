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
    <main className="min-h-screen bg-black text-white flex items-center justify-center">
      <div className="w-full max-w-3xl px-4 py-10 space-y-8">
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold">Who&apos;s watching?</h1>
          {profile && (
            <p className="text-sm text-neutral-400">
              Currently active: <span className="font-semibold">{profile.name}</span>
            </p>
          )}
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-6 justify-items-center">
          {profiles.data?.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => handleSelectProfile(p)}
              className="group flex flex-col items-center gap-2"
            >
              <div className="h-24 w-24 rounded-md bg-neutral-800 group-hover:bg-neutral-700 flex items-center justify-center text-3xl font-bold">
                {p.name.slice(0, 1).toUpperCase()}
              </div>
              <div className="text-sm font-medium">{p.name}</div>
              {p.is_locked && (
                <div className="text-[0.7rem] uppercase tracking-wide text-red-400">
                  Locked
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
            className="group flex flex-col items-center gap-2"
          >
            <div className="h-24 w-24 rounded-md border border-dashed border-neutral-600 text-4xl flex items-center justify-center group-hover:border-white group-hover:text-white">
              +
            </div>
            <div className="text-sm font-medium">Add profile</div>
          </button>
        </div>

        {isCreating && (
          <div className="fixed inset-0 bg-black/70 flex items-center justify-center">
            <div className="w-full max-w-sm rounded-lg bg-neutral-950 border border-neutral-800 px-5 py-5 space-y-4">
              <h2 className="text-lg font-semibold">Add profile</h2>
              <div className="space-y-2">
                <label className="block text-xs text-neutral-300">
                  Name
                </label>
                <input
                  type="text"
                  value={createName}
                  onChange={(e) => setCreateName(e.target.value)}
                  className="w-full rounded bg-neutral-900 border border-neutral-700 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-cyan"
                />
              </div>
              <div className="space-y-2">
                <label className="block text-xs text-neutral-300">
                  PIN (optional)
                </label>
                <input
                  type="password"
                  inputMode="numeric"
                  maxLength={6}
                  value={createPin}
                  onChange={(e) =>
                    setCreatePin(e.target.value.replace(/\\D/g, ""))
                  }
                  className="w-full rounded bg-neutral-900 border border-neutral-700 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-cyan"
                />
              </div>
              {createError && (
                <p className="text-xs text-red-400">{createError}</p>
              )}
              <div className="flex justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => {
                    setIsCreating(false);
                    setCreateName("");
                    setCreatePin("");
                    setCreateError(null);
                  }}
                  className="text-xs text-neutral-400 hover:text-neutral-200"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleCreateSubmit}
                  className="rounded bg-white px-4 py-1.5 text-xs font-semibold text-black hover:bg-neutral-200"
                >
                  Continue
                </button>
              </div>
            </div>
          </div>
        )}

        {unlockingProfile && (
          <div className="fixed inset-0 bg-black/70 flex items-center justify-center">
            <div className="w-full max-w-xs rounded-lg bg-neutral-950 border border-neutral-800 px-5 py-4 space-y-3">
              <h2 className="text-lg font-semibold">
                Enter PIN for {unlockingProfile.name}
              </h2>
              <input
                type="password"
                inputMode="numeric"
                maxLength={6}
                value={pinInput}
                onChange={(e) => setPinInput(e.target.value.replace(/\\D/g, ""))}
                className="w-full rounded bg-neutral-900 border border-neutral-700 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-cyan"
              />
              {pinError && (
                <p className="text-xs text-red-400">
                  {pinError}
                </p>
              )}
              <div className="flex justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => {
                    setUnlockingProfile(null);
                    setPinInput("");
                    setPinError(null);
                  }}
                  className="text-xs text-neutral-400 hover:text-neutral-200"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (!unlockingProfile) return;
                    verifyPin.mutate({ profile: unlockingProfile, pin: pinInput });
                  }}
                  className="rounded bg-white px-3 py-1 text-xs font-semibold text-black hover:bg-neutral-200"
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

