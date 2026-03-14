from __future__ import annotations

from dataclasses import dataclass
from typing import Optional
import subprocess

import httpx

from app.core.config import settings
from app.sources import StreamCandidateModel


@dataclass
class ResolvedStream:
    url: str
    kind: str  # "hls" or "file"
    resolution: Optional[str] = None


class StreamResolverError(RuntimeError):
    pass


class StreamResolver:
    """Resolve provider URLs into direct media URLs using external tools.

    This mirrors ani-cli's behaviour of handing embed/download pages off to
    tools like mpv/yt-dlp, but does so server-side so the frontend player can
    always receive a browser-playable URL.
    """

    def __init__(self, yt_dlp_binary: str = "yt-dlp") -> None:
        self.yt_dlp_binary = yt_dlp_binary

    def resolve(
        self, candidate: StreamCandidateModel, preferred_quality: Optional[str] = None
    ) -> ResolvedStream:
        """Return a direct media URL for a given provider candidate.

        Args:
            candidate: Provider candidate returned by AllAnimeSourceAdapter.
            preferred_quality: Optional quality hint such as "1080p" or "720p".

        Raises:
            StreamResolverError: If the URL cannot be resolved into a media stream.
        """

        url = candidate.url

        # 1) AllAnime /clock.json fast path (mirrors ani-cli's provider flow)
        # -------------------------------------------------------------------
        # When the URL points at AllAnime's clock endpoint, resolve it to a
        # direct MP4/HLS stream using the JSON API instead of delegating to
        # provider-specific pages.
        if "apivtwo/clock" in url:
            clock_url = url
            if "/clock/dr" in clock_url:
                clock_url = clock_url.replace("/clock/dr", "/clock.json")
            elif "/clock" in clock_url and "/clock.json" not in clock_url:
                clock_url = clock_url.replace("/clock", "/clock.json")

            try:
                with httpx.Client(
                    timeout=30.0,
                    headers={
                        "User-Agent": (
                            "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) "
                            "Gecko/20100101 Firefox/121.0"
                        ),
                        "Referer": settings.allanime_referer,
                    },
                ) as client:
                    resp = client.get(clock_url)
                    resp.raise_for_status()
            except httpx.HTTPError as exc:
                raise StreamResolverError(
                    f"Failed to resolve AllAnime clock URL: {exc}"
                ) from exc

            data = resp.json()
            links = data.get("links") or []
            if not links:
                raise StreamResolverError("AllAnime clock JSON contained no links")

            # Prefer links with an explicit numeric resolution when present;
            # otherwise fall back to the first entry.
            def resolution_score(entry: dict) -> int:
                label = str(entry.get("resolutionStr") or "").lower()
                for token in ("2160", "1440", "1080", "720", "480", "360"):
                    if token in label:
                        return int(token)
                return 0

            chosen_entry = max(links, key=resolution_score)
            stream_url = chosen_entry.get("link") or chosen_entry.get("src")
            if not stream_url:
                raise StreamResolverError("AllAnime clock link entry missing URL")

            kind = "hls" if ".m3u8" in stream_url else "file"
            return ResolvedStream(
                url=stream_url,
                kind=kind,
                resolution=chosen_entry.get("resolutionStr") or candidate.resolution,
            )

        # 2) Direct media URL fast path
        # -----------------------------
        # If the URL already looks like a direct media resource, bypass yt-dlp.
        if any(
            ext in url for ext in (".m3u8", ".mp4", ".webm", ".mkv", ".avi", ".mov")
        ):
            kind = "hls" if ".m3u8" in url else "file"
            return ResolvedStream(url=url, kind=kind, resolution=candidate.resolution)

        # 3) Generic fallback via yt-dlp
        # ------------------------------
        # For legacy or less common providers, delegate to yt-dlp to extract
        # the best available media URL.
        format_selector = "best"
        if preferred_quality:
            # Basic mapping: prefer streams at or below the requested height.
            h = "".join(ch for ch in preferred_quality if ch.isdigit())
            if h:
                format_selector = f"best[height<={h}]/best"

        cmd = [
            self.yt_dlp_binary,
            "-g",  # print direct URL(s)
            "-f",
            format_selector,
            url,
        ]

        try:
            proc = subprocess.run(
                cmd,
                check=False,
                capture_output=True,
                text=True,
                timeout=60,
            )
        except (OSError, subprocess.TimeoutExpired) as exc:
            raise StreamResolverError(
                f"yt-dlp failed to start or timed out: {exc}"
            ) from exc

        if proc.returncode != 0:
            stderr = (proc.stderr or "").strip()
            raise StreamResolverError(
                f"yt-dlp failed with code {proc.returncode}: {stderr}"
            )

        stdout = (proc.stdout or "").strip()
        if not stdout:
            raise StreamResolverError("yt-dlp returned no URLs")

        # yt-dlp can output multiple URLs separated by newlines; pick the first.
        resolved_url = stdout.splitlines()[0].strip()
        if not resolved_url:
            raise StreamResolverError("yt-dlp produced an empty URL")

        kind = "hls" if ".m3u8" in resolved_url else "file"
        return ResolvedStream(
            url=resolved_url, kind=kind, resolution=candidate.resolution
        )
