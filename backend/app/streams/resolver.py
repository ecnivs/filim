from __future__ import annotations

import asyncio
from dataclasses import dataclass
from typing import Optional

import httpx

from app.core.config import settings
from app.core.flaresolverr import flarefetch
from app.sources import StreamCandidateModel


@dataclass
class ResolvedStream:
    url: str
    kind: str
    resolution: Optional[str] = None


class StreamResolverError(RuntimeError):
    pass


class StreamResolver:
    """Resolve provider URLs into direct media URLs using external tools.

    Refactored to be fully asynchronous to prevent event loop blocking on
    platforms like Raspberry Pi. Includes a semaphore to limit heavy
    subprocess concurrency.
    """

    _semaphore = asyncio.Semaphore(8)

    def __init__(self, yt_dlp_binary: str = "yt-dlp") -> None:
        self.yt_dlp_binary = yt_dlp_binary

    async def _fetch_clock_json(self, clock_url: str) -> dict:
        headers = {
            "User-Agent": (
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36"
            ),
            "Referer": settings.allanime_referer,
        }
        try:
            async with httpx.AsyncClient(timeout=30.0, headers=headers) as client:
                resp = await client.get(clock_url)
                if resp.status_code != 403:
                    resp.raise_for_status()
                    return resp.json()
        except Exception:
            pass

        data = await flarefetch(clock_url)
        if not data:
            raise StreamResolverError(f"Failed to resolve provider clock URL: {clock_url}")
        return data

    async def resolve(
        self, candidate: StreamCandidateModel, preferred_quality: Optional[str] = None
    ) -> ResolvedStream:
        """Return a direct media URL for a given provider candidate.

        Args:
            candidate: Provider candidate returned by the catalog stream adapter.
            preferred_quality: Optional quality hint such as "1080p" or "720p".

        Raises:
            StreamResolverError: If the URL cannot be resolved into a media stream.
        """

        url = candidate.url

        if "apivtwo/clock" in url:
            clock_url = url
            if "/clock/dr" in clock_url:
                clock_url = clock_url.replace("/clock/dr", "/clock.json")
            elif "/clock" in clock_url and "/clock.json" not in clock_url:
                clock_url = clock_url.replace("/clock", "/clock.json")

            data = await self._fetch_clock_json(clock_url)
            links = data.get("links") or []
            if not links:
                raise StreamResolverError("Provider clock JSON contained no links")

            def resolution_score(entry: dict) -> int:
                label = str(entry.get("resolutionStr") or "").lower()
                for token in ("2160", "1440", "1080", "720", "480", "360"):
                    if token in label:
                        return int(token)
                return 0

            chosen_entry = max(links, key=resolution_score)
            stream_url = chosen_entry.get("link") or chosen_entry.get("src")
            if not stream_url:
                raise StreamResolverError("Provider clock link entry missing URL")

            kind = "hls" if ".m3u8" in stream_url else "file"
            return ResolvedStream(
                url=stream_url,
                kind=kind,
                resolution=chosen_entry.get("resolutionStr") or candidate.resolution,
            )

        if any(
            ext in url for ext in (".m3u8", ".mp4", ".webm", ".mkv", ".avi", ".mov")
        ):
            kind = "hls" if ".m3u8" in url else "file"
            return ResolvedStream(url=url, kind=kind, resolution=candidate.resolution)

        format_selector = "best"
        if preferred_quality:
            h = "".join(ch for ch in preferred_quality if ch.isdigit())
            if h:
                format_selector = f"best[height<={h}]/best"

        cmd = [
            self.yt_dlp_binary,
            "-g",
            "-f",
            format_selector,
            url,
        ]

        try:
            async with self._semaphore:
                proc = await asyncio.create_subprocess_exec(
                    *cmd,
                    stdout=asyncio.subprocess.PIPE,
                    stderr=asyncio.subprocess.PIPE,
                )
                stdout, stderr = await asyncio.wait_for(proc.communicate(), timeout=60)
        except asyncio.TimeoutExpired as exc:
            try:
                proc.kill()
            except Exception:
                pass
            raise StreamResolverError(f"yt-dlp resolution timed out: {exc}") from exc
        except (OSError, Exception) as exc:
            raise StreamResolverError(
                f"yt-dlp failed to start or error occurred: {exc}"
            ) from exc

        if proc.returncode != 0:
            err_msg = (stderr.decode() or "").strip()
            raise StreamResolverError(
                f"yt-dlp failed with code {proc.returncode}: {err_msg}"
            )

        out_text = (stdout.decode() or "").strip()
        if not out_text:
            raise StreamResolverError("yt-dlp returned no URLs")

        resolved_url = out_text.splitlines()[0].strip()
        if not resolved_url:
            raise StreamResolverError("yt-dlp produced an empty URL")

        kind = "hls" if ".m3u8" in resolved_url else "file"
        return ResolvedStream(
            url=resolved_url, kind=kind, resolution=candidate.resolution
        )
