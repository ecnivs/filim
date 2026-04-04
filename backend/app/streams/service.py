from __future__ import annotations

from typing import Optional

from pydantic import BaseModel

from app.core.cache import cache_response
from app.sources import AllanimeCatalogAdapter, StreamCandidateModel
from app.streams.resolver import ResolvedStream, StreamResolver, StreamResolverError


class StreamVariantModel(BaseModel):
    id: str
    resolution: Optional[str] = None
    provider: Optional[str] = None
    bitrate_kbps: Optional[int] = None
    kind: str


class StreamService:
    def __init__(self, source: AllanimeCatalogAdapter | None = None) -> None:
        self.source = source or AllanimeCatalogAdapter()
        self.resolver = StreamResolver()

    @cache_response(ttl_seconds=1800)
    async def get_hls_manifest_for_episode(
        self,
        show_id: str,
        episode: str,
        mode: str,
        preferred_quality: Optional[str],
        device_token: Optional[str],
        variant_id: Optional[str] = None,
    ) -> tuple[str, list[StreamVariantModel]]:
        candidates = await self.source.get_stream_candidates(
            show_id=show_id,
            episode=episode,
            mode=mode,
        )

        if not candidates:
            raise RuntimeError("No stream candidates available")

        preferred_providers = [
            "fm-hls",
            "vn-hls",
            "s-mp4",
            "mp4",
            "ok",
            "uni",
            "yt-mp4",
            "ak",
            "luf-mp4",
        ]

        def provider_rank(c: StreamCandidateModel) -> int:
            name = (c.provider or "").lower()
            try:
                return preferred_providers.index(name)
            except ValueError:
                return len(preferred_providers)

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

        for cand in ordered:
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
