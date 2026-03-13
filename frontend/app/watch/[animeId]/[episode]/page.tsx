"use client";

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { api } from "@/lib/http";
import { useDevice } from "@/lib/device-context";
import Link from "next/link";
import { Player } from "@/components/Player";
import { EpisodesPanel } from "@/components/EpisodesPanel";

type StreamVariant = {
  id: string;
  resolution?: string | null;
  bitrate_kbps?: number | null;
  kind: string;
};

type StreamResponse = {
  manifest_url: string;
  variants: StreamVariant[];
  audio_languages?: {
    id: string;
    code?: string | null;
    label: string;
    is_default?: boolean;
  }[];
};

type EpisodeSummary = {
  number: string;
  title?: string | null;
  duration_seconds?: number | null;
};

type AnimeDetails = {
  id: string;
  title: string;
  episode_count: number;
  episodes: EpisodeSummary[];
  synopsis?: string | null;
  cover_image_url?: string | null;
  tags?: string[];
  available_audio_languages?: string[];
};

export default function WatchPage() {
  const params = useParams<{ animeId: string; episode: string }>();
  const { deviceToken } = useDevice();
  const [error, setError] = useState<string | null>(null);
  const [manifestUrl, setManifestUrl] = useState<string | null>(null);
  const [variants, setVariants] = useState<StreamVariant[]>([]);
  const [selectedQualityId, setSelectedQualityId] = useState<string | null>(null);
  const [language, setLanguage] = useState<string>("ja");
  const [audioLanguages, setAudioLanguages] = useState<
    StreamResponse["audio_languages"] | undefined
  >(undefined);
  const [animeDetails, setAnimeDetails] = useState<AnimeDetails | null>(null);
  const [resumePositionSeconds, setResumePositionSeconds] = useState<number | null>(
    null
  );
  const [showEpisodes, setShowEpisodes] = useState(false);

  // Derive stable route IDs directly from the current URL so we are never
  // dependent on a transient `useParams` state (which has been observed to
  // occasionally yield the literal string "undefined" during navigation).
  const [routeIds, setRouteIds] = useState<{
    animeId: string;
    episode: string;
  } | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const parts = window.location.pathname.split("/");
    // Expecting ['', 'watch', animeId, episode]
    if (parts.length >= 4) {
      const animeId = parts[2];
      const episode = parts[3];
      if (animeId && animeId !== "undefined" && episode && episode !== "undefined") {
        setRouteIds({ animeId, episode });
        return;
      }
    }
    setRouteIds(null);
  }, []);

  const hasValidParams = !!routeIds;

  useEffect(() => {
    let cancelled = false;

    async function fetchAudioPreference() {
      try {
        const res = await api.get<{ item: { audio_language_id: string } | null }>(
          "/audio-preference"
        );
        if (cancelled) return;
        const pref = res.data.item?.audio_language_id;
        if (!pref) return;
        if (pref === "ja" || pref === "en") {
          setLanguage(pref);
        } else if (pref === "sub") {
          setLanguage("ja");
        } else if (pref === "dub") {
          setLanguage("en");
        }
      } catch {
        // ignore preference failures; the player will fall back to defaults
      }
    }

    void fetchAudioPreference();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    // Avoid calling the stream API with missing or placeholder route params.
    if (!hasValidParams || !routeIds) {
      setManifestUrl(null);
      setVariants([]);
      setAudioLanguages(undefined);
      return;
    }

    async function fetchStream(qualityId: string | null) {
      setError(null);
      const queryParams: Record<string, string | undefined> = {};
      if (deviceToken) {
        queryParams.device_token = deviceToken;
      }
      if (qualityId) {
        const variant = variants.find((v) => v.id === qualityId);
        if (variant?.resolution) {
          queryParams.quality = variant.resolution;
        }
      }
      if (language) {
        queryParams.language = language;
      }

      try {
        const res = await api.get<StreamResponse>(
          `/anime/${routeIds!.animeId}/episodes/${routeIds!.episode}/stream`,
          {
            params: queryParams
          }
        );
        setManifestUrl(res.data.manifest_url);
        setVariants(res.data.variants);
        setAudioLanguages(res.data.audio_languages);
      } catch (err: any) {
        // eslint-disable-next-line no-console
        console.error("Failed to load stream", err);
        const message =
          err?.response?.data?.detail ||
          "This episode is currently unavailable to stream.";
        setError(message);
      }
    }

    void fetchStream(selectedQualityId);
    // Intentionally do NOT depend on `variants`, otherwise setting them will
    // retrigger this effect and cause an infinite refetch/replay loop.
  }, [
    deviceToken,
    hasValidParams,
    routeIds?.animeId,
    routeIds?.episode,
    selectedQualityId,
    language
  ]);

  useEffect(() => {
    if (!hasValidParams || !routeIds) {
      return;
    }

    let cancelled = false;

    async function fetchDetailsAndProgress() {
      try {
        const [detailsRes, progressRes] = await Promise.all([
          api.get<AnimeDetails>(`/catalog/${routeIds!.animeId}`),
          api.get<{ items: ContinueWatchingItem[] }>("/user/continue-watching")
        ]);

        if (cancelled) return;

        setAnimeDetails(detailsRes.data);

        const match = progressRes.data.items.find(
          (item) =>
            item.anime_id === routeIds!.animeId && item.episode === routeIds!.episode
        );
        if (match && match.position_seconds > 0 && match.position_seconds < match.duration_seconds) {
          setResumePositionSeconds(match.position_seconds);
        } else {
          setResumePositionSeconds(null);
        }
      } catch (err) {
        // Swallow metadata and progress errors; the player can still function without them.
        // eslint-disable-next-line no-console
        console.warn("Failed to load anime details or progress", err);
      }
    }

    // Only attempt to fetch progress when we have a device token.
    if (deviceToken && routeIds) {
      void fetchDetailsAndProgress();
    } else {
      setAnimeDetails(null);
      setResumePositionSeconds(null);
    }

    return () => {
      cancelled = true;
    };
  }, [deviceToken, hasValidParams, routeIds?.animeId, routeIds?.episode]);

  type ContinueWatchingItem = {
    anime_id: string;
    episode: string;
    position_seconds: number;
    duration_seconds: number;
    progress: number;
  };

  const episodeMeta =
    animeDetails && routeIds
      ? animeDetails.episodes.find((ep) => ep.number === routeIds.episode) ?? null
      : null;

  const episodeLabel = episodeMeta
    ? `Episode ${episodeMeta.number}${
        episodeMeta.title ? ` • ${episodeMeta.title}` : ""
      }`
      : `Episode ${routeIds?.episode ?? "?"}`;

  const nextEpisode =
    animeDetails && episodeMeta
      ? (() => {
          const index = animeDetails.episodes.findIndex(
            (ep) => ep.number === episodeMeta.number
          );
          if (index === -1) return null;
          return animeDetails.episodes[index + 1] ?? null;
        })()
      : null;

  const nextEpisodeHref =
    animeDetails && nextEpisode
      ? `/watch/${animeDetails.id}/${nextEpisode.number}`
      : undefined;

  const nextEpisodeLabel =
    nextEpisode && animeDetails
      ? `Episode ${nextEpisode.number}${
          nextEpisode.title ? ` • ${nextEpisode.title}` : ""
        }`
      : undefined;

  const languageOptions =
    animeDetails?.available_audio_languages && animeDetails.available_audio_languages.length > 0
      ? animeDetails.available_audio_languages.map((code) => ({
          id: code,
          label: code === "en" ? "English" : "Japanese (日本語)"
        }))
      : [
          { id: "ja", label: "Japanese (日本語)" },
          { id: "en", label: "English" }
        ];

  const handleChangeLanguage = (nextId: string) => {
    setLanguage(nextId);
    void api
      .post("/audio-preference", {
        audio_language_id: nextId
      })
      .catch((err) => {
        // eslint-disable-next-line no-console
        console.warn("Failed to update audio preference", err);
      });
  };

  return (
    <main className="h-screen overflow-hidden bg-black text-white">
      <div className="flex h-full flex-col">
        <header className="flex items-center justify-between px-4 sm:px-8 py-3 bg-gradient-to-b from-black/90 via-black/60 to-transparent">
          <div className="flex items-center gap-4">
            <Link
              href="/"
              className="text-lg font-semibold tracking-tight hover:text-neutral-200"
            >
              Filim
            </Link>
            <button
              type="button"
              onClick={() => history.back()}
              className="text-xs text-neutral-300 hover:text-white"
            >
              Back
            </button>
          </div>
          <div className="flex items-center gap-3">
            {animeDetails && (
              <p className="hidden text-xs text-neutral-300 sm:block">
                {animeDetails.title}
              </p>
            )}
            {animeDetails && animeDetails.episodes.length > 0 && (
              <button
                type="button"
                onClick={() => setShowEpisodes(true)}
                className="rounded bg-neutral-900/80 px-3 py-1.5 text-xs font-medium text-neutral-100 hover:bg-neutral-800"
              >
                Episodes
              </button>
            )}
          </div>
        </header>

        <div className="relative flex-1 bg-black">
          {!error && manifestUrl && (
            <Player
              source={{ url: manifestUrl }}
              title={animeDetails?.title}
              episodeLabel={episodeLabel}
              audioLanguages={
                audioLanguages?.map((lang) => ({
                  id: lang.id,
                  label: lang.label,
                  code: lang.code ?? null,
                  isDefault: lang.is_default ?? false
                })) ?? undefined
              }
              languageOptions={languageOptions}
              currentLanguageId={language}
              onChangeLanguage={handleChangeLanguage}
              initialTimeSeconds={resumePositionSeconds ?? undefined}
              onProgress={(payload) => {
                if (!routeIds) {
                  return;
                }
                void api
                  .post("/user/progress", {
                    anime_id: routeIds.animeId,
                    episode: routeIds.episode,
                    position_seconds: payload.positionSeconds,
                    duration_seconds: payload.durationSeconds,
                    is_finished: payload.isFinished
                  })
                  .catch((err) => {
                    // eslint-disable-next-line no-console
                    console.warn("Failed to update watch progress", err);
                  });
              }}
              introEndSeconds={
                episodeMeta?.duration_seconds && episodeMeta.duration_seconds > 900
                  ? 90
                  : undefined
              }
              nextEpisodeHref={nextEpisodeHref}
              nextEpisodeLabel={nextEpisodeLabel}
              qualityOptions={[
                { id: "auto", label: "Auto", value: null },
                ...variants.map((variant) => ({
                  id: variant.id,
                  label: variant.resolution ?? "Source",
                  value: variant.resolution ?? null
                }))
              ]}
              currentQualityId={selectedQualityId ?? "auto"}
              onChangeQuality={(qualityId) => {
                if (qualityId === "auto") {
                  setSelectedQualityId(null);
                } else {
                  setSelectedQualityId(qualityId);
                }
              }}
            />
          )}

          {error && (
            <div className="flex h-full w-full items-center justify-center px-4 text-center">
              <div className="space-y-2">
                <p className="text-sm text-red-300">
                  {error}
                </p>
                <p className="text-xs text-neutral-300">
                  Try a different episode or title while we cannot load this one.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {animeDetails && (
        <EpisodesPanel
          animeId={animeDetails.id}
          animeTitle={animeDetails.title}
          episodes={animeDetails.episodes}
          currentEpisode={routeIds?.episode ?? ""}
          isOpen={showEpisodes}
          onClose={() => setShowEpisodes(false)}
        />
      )}
    </main>
  );
}

