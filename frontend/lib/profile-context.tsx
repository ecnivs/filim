"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  ReactNode
} from "react";

type ActiveProfile = {
  id: string;
  name: string;
};

type ProfileContextValue = {
  profile: ActiveProfile | null;
  setProfile: (profile: ActiveProfile | null) => void;
  isReady: boolean;
};

const STORAGE_KEY = "filim.activeProfile";

const ProfileContext = createContext<ProfileContextValue | undefined>(undefined);

export function ProfileProvider({ children }: { children: ReactNode }) {
  const [profile, setProfileState] = useState<ActiveProfile | null>(null);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as ActiveProfile;
        if (parsed?.id && parsed?.name) {
          setProfileState(parsed);
        }
      }
    } catch {
      // ignore broken storage
    } finally {
      setIsReady(true);
    }
  }, []);

  const setProfile = useCallback((next: ActiveProfile | null) => {
    setProfileState(next);
    if (typeof window === "undefined") return;
    if (next) {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } else {
      window.localStorage.removeItem(STORAGE_KEY);
    }
  }, []);

  return (
    <ProfileContext.Provider value={{ profile, setProfile, isReady }}>
      {children}
    </ProfileContext.Provider>
  );
}

export function useProfile(): ProfileContextValue {
  const ctx = useContext(ProfileContext);
  if (!ctx) {
    throw new Error("useProfile must be used within a ProfileProvider");
  }
  return ctx;
}

export function getActiveProfileIdFromStorage(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ActiveProfile;
    return parsed?.id ?? null;
  } catch {
    return null;
  }
}

