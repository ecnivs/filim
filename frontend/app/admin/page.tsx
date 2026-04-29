"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
    adminFetch,
    clearAdminToken,
    getAdminToken,
    setAdminToken,
} from "@/lib/admin-context";

// ── Types ─────────────────────────────────────────────────────────────────────

type Settings = {
    allow_creating_profiles: boolean;
    guest_profile_enabled: boolean;
    max_profiles: number | null;
    require_profile_pins: boolean;
};

type ProfileEntry = {
    id: string;
    name: string;
    is_locked: boolean;
    is_guest: boolean;
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function Toggle({
    checked,
    onChange,
    disabled,
}: {
    checked: boolean;
    onChange: (v: boolean) => void;
    disabled?: boolean;
}) {
    return (
        <button
            type="button"
            role="switch"
            aria-checked={checked}
            onClick={() => !disabled && onChange(!checked)}
            className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors focus:outline-none ${
                disabled ? "opacity-40 cursor-not-allowed" : "cursor-pointer"
            } ${checked ? "bg-ncyan" : "bg-neutral-700"}`}
        >
            <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                    checked ? "translate-x-6" : "translate-x-1"
                }`}
            />
        </button>
    );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
    return (
        <div className="bg-surface border border-neutral-800 rounded-xl p-6 space-y-5">
            <h2 className="text-sm font-bold text-neutral-400 uppercase tracking-widest">
                {title}
            </h2>
            {children}
        </div>
    );
}

function FieldRow({ label, sub, children }: { label: string; sub?: string; children: React.ReactNode }) {
    return (
        <div className="flex items-center justify-between gap-4">
            <div>
                <p className="text-sm font-medium text-foreground">{label}</p>
                {sub && <p className="text-xs text-neutral-500 mt-0.5">{sub}</p>}
            </div>
            {children}
        </div>
    );
}

// ── Login ─────────────────────────────────────────────────────────────────────

function LoginScreen({ onLogin }: { onLogin: () => void }) {
    const [password, setPassword] = useState("");
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);

    const handleLogin = async () => {
        if (!password || loading) return;
        setLoading(true);
        setError(null);
        try {
            const data = await adminFetch<{ token: string }>("/login", {
                method: "POST",
                body: JSON.stringify({ password }),
            });
            setAdminToken(data.token);
            onLogin();
        } catch (e: any) {
            setError(e.status === 401 ? "Incorrect password" : "Connection error");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-background flex items-center justify-center px-6">
            <div className="w-full max-w-xs space-y-8 text-center">
                <div>
                    <div className="text-ncyan text-3xl font-black tracking-tighter uppercase mb-1">
                        Filim
                    </div>
                    <p className="text-neutral-400 text-sm">Admin Panel</p>
                </div>

                <div className="space-y-3">
                    <input
                        type="password"
                        value={password}
                        onChange={(e) => { setPassword(e.target.value); setError(null); }}
                        onKeyDown={(e) => e.key === "Enter" && handleLogin()}
                        className="dialog-input text-center"
                        placeholder="Admin password"
                        autoFocus
                    />
                    {error && <p className="text-nred text-xs font-medium">{error}</p>}
                </div>

                <button
                    onClick={handleLogin}
                    disabled={loading || !password}
                    className="w-full bg-white text-black font-bold py-3 rounded-lg hover:bg-neutral-200 disabled:opacity-40 transition-all active:scale-95"
                >
                    {loading ? "Signing in…" : "Sign In"}
                </button>

                <Link href="/" className="block text-xs text-neutral-600 hover:text-neutral-400 transition-colors">
                    ← Back to Filim
                </Link>
            </div>
        </div>
    );
}

// ── Dashboard ─────────────────────────────────────────────────────────────────

function Dashboard({ onLogout }: { onLogout: () => void }) {
    const [tab, setTab] = useState<"profiles" | "security">("profiles");
    const [settings, setSettings] = useState<Settings | null>(null);
    const [profiles, setProfiles] = useState<ProfileEntry[]>([]);
    const [loadingSettings, setLoadingSettings] = useState(true);
    const [saving, setSaving] = useState(false);
    const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);

    const showToast = (msg: string, ok = true) => {
        setToast({ msg, ok });
        setTimeout(() => setToast(null), 3000);
    };

    const fetchSettings = async () => {
        try {
            const data = await adminFetch<Settings>("/settings");
            setSettings(data);
        } catch {
            showToast("Failed to load settings", false);
        } finally {
            setLoadingSettings(false);
        }
    };

    const fetchProfiles = async () => {
        try {
            const data = await adminFetch<{ items: ProfileEntry[] }>("/profiles");
            setProfiles(data.items);
        } catch {}
    };

    useEffect(() => {
        void fetchSettings();
        void fetchProfiles();
    }, []);

    const patchSettings = async (patch: Partial<Record<string, unknown>>) => {
        setSaving(true);
        try {
            const res = await adminFetch<{ status: string; password_changed?: boolean }>(
                "/settings",
                { method: "PATCH", body: JSON.stringify(patch) }
            );
            if (res.password_changed) {
                showToast("Password changed — please sign in again");
                clearAdminToken();
                setTimeout(onLogout, 1500);
                return;
            }
            await fetchSettings();
            showToast("Saved");
        } catch (e: any) {
            showToast(e.message ?? "Error", false);
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="min-h-screen bg-background">
            <header className="sticky top-0 z-50 bg-background/95 backdrop-blur border-b border-neutral-800">
                <div className="flex items-center justify-between px-6 h-14">
                    <div className="flex items-center gap-3">
                        <Link
                            href="/"
                            className="text-neutral-500 hover:text-white transition-colors"
                            aria-label="Back to app"
                        >
                            <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <polyline points="15 18 9 12 15 6" />
                            </svg>
                        </Link>
                        <span className="text-ncyan font-black tracking-tighter uppercase text-lg">Filim</span>
                        <span className="text-neutral-600 text-sm">/ Admin</span>
                    </div>
                    <button
                        onClick={() => { clearAdminToken(); onLogout(); }}
                        className="text-xs text-neutral-500 hover:text-white transition-colors"
                    >
                        Sign out
                    </button>
                </div>
            </header>

            <div className="border-b border-neutral-800 px-6">
                <div className="flex gap-1">
                    {(["profiles", "security"] as const).map((t) => (
                        <button
                            key={t}
                            onClick={() => setTab(t)}
                            className={`py-3 px-4 text-sm font-medium capitalize border-b-2 transition-colors -mb-px ${
                                tab === t
                                    ? "border-ncyan text-ncyan"
                                    : "border-transparent text-neutral-500 hover:text-white"
                            }`}
                        >
                            {t}
                        </button>
                    ))}
                </div>
            </div>

            <div className="max-w-xl mx-auto px-6 py-8 space-y-6">
                {loadingSettings ? (
                    <div className="text-neutral-600 text-sm">Loading…</div>
                ) : !settings ? (
                    <div className="text-nred text-sm">
                        Failed to load settings.{" "}
                        <button onClick={() => { void fetchSettings(); void fetchProfiles(); }} className="underline">
                            Retry
                        </button>
                    </div>
                ) : tab === "profiles" ? (
                    <ProfilesTab
                        settings={settings}
                        profiles={profiles}
                        onPatch={patchSettings}
                        onRefreshProfiles={fetchProfiles}
                        saving={saving}
                        showToast={showToast}
                    />
                ) : (
                    <SecurityTab settings={settings} onPatch={patchSettings} saving={saving} />
                )}
            </div>

            {toast && (
                <div
                    className={`fixed bottom-6 left-1/2 -translate-x-1/2 px-5 py-3 rounded-lg text-sm font-medium shadow-dialog transition-all ${
                        toast.ok ? "bg-ncyan text-black" : "bg-nred text-white"
                    }`}
                >
                    {toast.msg}
                </div>
            )}
        </div>
    );
}

// ── Profiles Tab ──────────────────────────────────────────────────────────────

function ProfilesTab({
    settings,
    profiles,
    onPatch,
    onRefreshProfiles,
    saving,
    showToast,
}: {
    settings: Settings;
    profiles: ProfileEntry[];
    onPatch: (patch: Record<string, unknown>) => Promise<void>;
    onRefreshProfiles: () => Promise<void>;
    saving: boolean;
    showToast: (msg: string, ok?: boolean) => void;
}) {
    const [allowCreating, setAllowCreating] = useState(settings.allow_creating_profiles);
    const [guestEnabled, setGuestEnabled] = useState(settings.guest_profile_enabled);
    const [requirePins, setRequirePins] = useState(settings.require_profile_pins);
    const [limitProfiles, setLimitProfiles] = useState(settings.max_profiles !== null);
    const [maxProfiles, setMaxProfiles] = useState(settings.max_profiles ?? 5);

    const [newName, setNewName] = useState("");
    const [creating, setCreating] = useState(false);
    const [deletingId, setDeletingId] = useState<string | null>(null);

    useEffect(() => {
        setAllowCreating(settings.allow_creating_profiles);
        setGuestEnabled(settings.guest_profile_enabled);
        setRequirePins(settings.require_profile_pins);
        setLimitProfiles(settings.max_profiles !== null);
        setMaxProfiles(settings.max_profiles ?? 5);
    }, [settings]);

    const settingsChanged =
        allowCreating !== settings.allow_creating_profiles ||
        guestEnabled !== settings.guest_profile_enabled ||
        requirePins !== settings.require_profile_pins ||
        limitProfiles !== (settings.max_profiles !== null) ||
        (limitProfiles && maxProfiles !== (settings.max_profiles ?? 5));

    const saveProfileSettings = async () => {
        const patch: Record<string, unknown> = {
            allow_creating_profiles: allowCreating,
            guest_profile_enabled: guestEnabled,
            require_profile_pins: requirePins,
        };
        if (limitProfiles) {
            patch.max_profiles = maxProfiles;
        } else {
            patch.clear_max_profiles = true;
        }
        await onPatch(patch);
    };

    const createProfile = async () => {
        if (!newName.trim() || creating) return;
        setCreating(true);
        try {
            await adminFetch("/profiles", {
                method: "POST",
                body: JSON.stringify({ name: newName.trim() }),
            });
            setNewName("");
            await onRefreshProfiles();
            showToast("Profile created");
        } catch (e: any) {
            showToast(e.message ?? "Error", false);
        } finally {
            setCreating(false);
        }
    };

    const deleteProfile = async (id: string) => {
        setDeletingId(id);
        try {
            await adminFetch(`/profiles/${id}`, { method: "DELETE" });
            await onRefreshProfiles();
            showToast("Profile deleted");
        } catch (e: any) {
            showToast(e.message ?? "Error", false);
        } finally {
            setDeletingId(null);
        }
    };

    return (
        <>
            <Card title="Settings">
                <FieldRow label="Allow creating profiles" sub="Users can create new profiles from the profiles page">
                    <Toggle checked={allowCreating} onChange={setAllowCreating} />
                </FieldRow>

                <div className="border-t border-neutral-800" />

                <FieldRow label="Guest profile" sub="Show the Guest profile on the profiles page">
                    <Toggle checked={guestEnabled} onChange={setGuestEnabled} />
                </FieldRow>

                <div className="border-t border-neutral-800" />

                <FieldRow label="Require PINs" sub="All profiles must have a PIN to be created">
                    <Toggle checked={requirePins} onChange={setRequirePins} />
                </FieldRow>

                <div className="border-t border-neutral-800" />

                <FieldRow label="Limit profiles" sub="Set a maximum number of profiles (excluding guest)">
                    <Toggle checked={limitProfiles} onChange={setLimitProfiles} />
                </FieldRow>

                {limitProfiles && (
                    <div className="flex items-center gap-3">
                        <span className="text-sm text-neutral-400 shrink-0">Max profiles</span>
                        <input
                            type="number"
                            min={1}
                            max={50}
                            value={maxProfiles}
                            onChange={(e) => setMaxProfiles(Math.max(1, parseInt(e.target.value) || 1))}
                            className="dialog-input w-24 text-center"
                        />
                    </div>
                )}

                <button
                    onClick={saveProfileSettings}
                    disabled={saving || !settingsChanged}
                    className="w-full py-2.5 rounded-lg bg-white text-black text-sm font-bold hover:bg-neutral-200 disabled:opacity-40 transition-all"
                >
                    {saving ? "Saving…" : "Save"}
                </button>
            </Card>

            <Card title="Profiles">
                <div className="flex gap-2">
                    <input
                        type="text"
                        value={newName}
                        onChange={(e) => setNewName(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && createProfile()}
                        className="dialog-input flex-1"
                        placeholder="New profile name"
                        maxLength={30}
                    />
                    <button
                        onClick={createProfile}
                        disabled={creating || !newName.trim()}
                        className="px-4 py-2 rounded-lg bg-ncyan text-black text-sm font-bold hover:bg-ncyan-dark disabled:opacity-40 transition-all shrink-0"
                    >
                        {creating ? "…" : "Create"}
                    </button>
                </div>

                <div className="divide-y divide-neutral-800 -mx-6 px-6">
                    {profiles.length === 0 && (
                        <p className="text-neutral-600 text-sm py-2">No profiles yet.</p>
                    )}
                    {profiles.map((p) => (
                        <div key={p.id} className="flex items-center justify-between py-3">
                            <div className="flex items-center gap-3">
                                <div className="h-8 w-8 rounded bg-neutral-800 flex items-center justify-center text-sm font-bold text-white">
                                    {p.name.slice(0, 1).toUpperCase()}
                                </div>
                                <div>
                                    <span className="text-sm text-foreground">{p.name}</span>
                                    <div className="flex gap-1 mt-0.5">
                                        {p.is_guest && (
                                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-neutral-700 text-neutral-400 font-medium">
                                                Guest
                                            </span>
                                        )}
                                        {p.is_locked && (
                                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-neutral-700 text-neutral-400 font-medium">
                                                PIN
                                            </span>
                                        )}
                                    </div>
                                </div>
                            </div>
                            {!p.is_guest ? (
                                <button
                                    onClick={() => deleteProfile(p.id)}
                                    disabled={deletingId === p.id}
                                    className="text-neutral-600 hover:text-nred transition-colors disabled:opacity-40 p-1"
                                    aria-label={`Delete ${p.name}`}
                                >
                                    {deletingId === p.id ? (
                                        <span className="text-xs">…</span>
                                    ) : (
                                        <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                            <polyline points="3 6 5 6 21 6" />
                                            <path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" />
                                            <path d="M10 11v6M14 11v6" />
                                            <path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2" />
                                        </svg>
                                    )}
                                </button>
                            ) : (
                                <span className="text-xs text-neutral-700 pr-1">—</span>
                            )}
                        </div>
                    ))}
                </div>
            </Card>
        </>
    );
}

// ── Security Tab ──────────────────────────────────────────────────────────────

function SecurityTab({
    settings: _settings,
    onPatch,
    saving,
}: {
    settings: Settings;
    onPatch: (patch: Record<string, unknown>) => Promise<void>;
    saving: boolean;
}) {
    const [newPw, setNewPw] = useState("");
    const [confirmPw, setConfirmPw] = useState("");
    const [pwError, setPwError] = useState<string | null>(null);

    const savePassword = async () => {
        if (!newPw) return;
        if (newPw !== confirmPw) { setPwError("Passwords don't match"); return; }
        if (newPw.length < 4) { setPwError("Min 4 characters"); return; }
        setPwError(null);
        await onPatch({ admin_password: newPw });
        setNewPw("");
        setConfirmPw("");
    };

    const pwSaveEnabled = newPw.length >= 4 && confirmPw.length >= 4;

    return (
        <Card title="Admin Password">
            <div className="space-y-3">
                <input
                    type="password"
                    value={newPw}
                    onChange={(e) => { setNewPw(e.target.value); setPwError(null); }}
                    className="dialog-input"
                    placeholder="New password"
                />
                <input
                    type="password"
                    value={confirmPw}
                    onChange={(e) => { setConfirmPw(e.target.value); setPwError(null); }}
                    className="dialog-input"
                    placeholder="Confirm new password"
                />
                {pwError && <p className="text-nred text-xs">{pwError}</p>}
                <button
                    onClick={savePassword}
                    disabled={saving || !pwSaveEnabled}
                    className="w-full py-2.5 rounded-lg bg-white text-black text-sm font-bold hover:bg-neutral-200 disabled:opacity-40 transition-all"
                >
                    {saving ? "Saving…" : "Change Password"}
                </button>
            </div>
        </Card>
    );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function AdminPage() {
    const [authed, setAuthed] = useState<boolean | null>(null);

    useEffect(() => {
        setAuthed(!!getAdminToken());
    }, []);

    if (authed === null) {
        return <div className="min-h-screen bg-background" />;
    }

    if (!authed) {
        return <LoginScreen onLogin={() => setAuthed(true)} />;
    }

    return <Dashboard onLogout={() => setAuthed(false)} />;
}
