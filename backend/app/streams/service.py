from __future__ import annotations

import asyncio
from typing import Optional

from pydantic import BaseModel

from app.sources import AllanimeCatalogAdapter, StreamCandidateModel
from app.streams.resolver import ResolvedStream, StreamResolver, StreamResolverError

_PARALLEL_CANDIDATES = 3  # race this many candidates concurrently


class StreamVariantModel(BaseModel):
    id: str
    resolution: Optional[str] = None
    provider: Optional[str] = None
    bitrate_kbps: Optional[int] = None
    kind: str


async def _resolve_first(
    candidates: list[StreamCandidateModel],
    resolver: StreamResolver,
    preferred_quality: Optional[str],
) -> tuple[ResolvedStream | None, StreamCandidateModel | None]:
    """Race candidates concurrently; return first successful resolution."""
    if not candidates:
        return None, None

    tasks: dict[asyncio.Task, StreamCandidateModel] = {
        asyncio.create_task(
            resolver.resolve(c, preferred_quality=preferred_quality)
        ): c
        for c in candidates
    }
    pending = set(tasks)

    while pending:
        done, pending = await asyncio.wait(pending, return_when=asyncio.FIRST_COMPLETED)
        for t in done:
            try:
                resolved = t.result()
                chosen = tasks[t]
                for p in pending:
                    p.cancel()
                await asyncio.gather(*pending, return_exceptions=True)
                return resolved, chosen
            except Exception:
                continue

    return None, None


class StreamService:
    def __init__(self, source: AllanimeCatalogAdapter | None = None) -> None:
        self.source = source or AllanimeCatalogAdapter()
        self.resolver = StreamResolver()

    async def get_hls_manifest_for_episode(
        self,
        show_id: str,
        episode: str,
        mode: str,
        preferred_quality: Optional[str],
        device_token: Optional[str],
        variant_id: Optional[str] = None,
    ) -> tuple[str, list[StreamVariantModel]]:
        # Stream candidates are cached upstream (900 s). Resolved URLs (CDN/wixmp)
        # expire on their own schedule — don't cache them here or stale URLs break playback.
        candidates = await self.source.get_stream_candidates(
            show_id=show_id,
            episode=episode,
            mode=mode,
        )

        if not candidates:
            raise RuntimeError("No stream candidates available")

        # Candidates are already sorted by API priority (descending) from the source.
        def provider_rank(c: StreamCandidateModel) -> float:
            return -c.priority  # negate for ascending sort (highest priority first)

        ordered = sorted(candidates, key=provider_rank)

        if variant_id and variant_id.startswith("v") and len(variant_id) > 1:
            try:
                pick_idx = int(variant_id[1:])
                if 0 <= pick_idx < len(ordered):
                    chosen = ordered[pick_idx]
                    ordered = [chosen] + [
                        c for i, c in enumerate(ordered) if i != pick_idx
                    ]
            except ValueError:
                pass

        resolved: ResolvedStream | None = None
        chosen_source: StreamCandidateModel | None = None

        # Race top-N candidates concurrently; fall back sequentially for the rest.
        resolved, chosen_source = await _resolve_first(
            ordered[:_PARALLEL_CANDIDATES], self.resolver, preferred_quality
        )

        if resolved is None:
            for cand in ordered[_PARALLEL_CANDIDATES:]:
                try:
                    resolved = await self.resolver.resolve(
                        cand, preferred_quality=preferred_quality
                    )
                    chosen_source = cand
                    break
                except StreamResolverError:
                    continue

        if resolved is None or chosen_source is None:
            raise RuntimeError("No resolvable stream candidates available")

        manifest_url = resolved.url

        variants: list[StreamVariantModel] = []
        for idx, c in enumerate(ordered):
            variants.append(
                StreamVariantModel(
                    id=f"v{idx}",
                    resolution=c.resolution,
                    provider=c.provider,
                    bitrate_kbps=None,
                    kind="hls" if resolved.kind == "hls" else "file",
                )
            )

        return manifest_url, variants
