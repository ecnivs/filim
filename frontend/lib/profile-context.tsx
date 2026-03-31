import {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useState,
    ReactNode
} from "react";
import { useRouter } from "next/navigation";

type ActiveProfile = {
    id: string;
    name: string;
};

type ProfileContextValue = {
    profile: ActiveProfile | null;
    setProfile: (profile: ActiveProfile | null) => void;
    logout: () => void;
    isReady: boolean;
};

const STORAGE_KEY = "filim.activeProfile";

const ProfileContext = createContext<ProfileContextValue | undefined>(undefined);

export function ProfileProvider({ children }: { children: ReactNode }) {
    const [profile, setProfileState] = useState<ActiveProfile | null>(null);
    const [isReady, setIsReady] = useState(false);
    const router = useRouter();

    useEffect(() => {
        if (typeof window === "undefined") return;

        async function init() {
            try {
                const raw = window.localStorage.getItem(STORAGE_KEY);
                if (raw) {
                    const parsed = JSON.parse(raw) as ActiveProfile;
                    if (parsed?.id && parsed?.name) {
                        const res = await fetch(`/api/v1/profiles/${parsed.id}`, {
                            headers: { "X-Profile-Id": parsed.id }
                        });

                        if (res.ok) {
                            setProfileState(parsed);
                        } else {
                            window.localStorage.removeItem(STORAGE_KEY);
                            setProfileState(null);
                        }
                    }
                }
            } catch (err) {
                console.error("Profile validation failed", err);
            } finally {
                setIsReady(true);
            }
        }

        void init();
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

    const logout = useCallback(() => {
        setProfile(null);
        router.push("/profiles");
    }, [setProfile, router]);

    return (
        <ProfileContext.Provider value={{ profile, setProfile, logout, isReady }}>
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

