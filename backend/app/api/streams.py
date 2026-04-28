from typing import Optional
from urllib.parse import unquote

import httpx
from fastapi import APIRouter, HTTPException, Query, Request
from fastapi.responses import StreamingResponse

from app.core.config import settings
from app.core.constants import DEFAULT_USER_AGENT
from app.models.streams import AudioLanguageModel, StreamResponseModel
from app.streams.service import StreamService

_PROXY_HEADERS = {
    "User-Agent": DEFAULT_USER_AGENT,
    "Referer": settings.allanime_referer,
    "Origin": settings.allanime_referer.rstrip("/"),
}
# Only forward safe response headers to the client
_FORWARD_RESPONSE_HEADERS = {
    "content-type",
    "content-length",
    "content-range",
    "accept-ranges",
    "cache-control",
    "last-modified",
    "etag",
}

# Shared client reuses TCP connections across proxy requests.
_proxy_client = httpx.AsyncClient(
    timeout=30.0,
    follow_redirects=True,
    limits=httpx.Limits(max_connections=50, max_keepalive_connections=20),
)

router = APIRouter()


def _get_stream_service() -> StreamService:
    return StreamService()


def _resolve_language_and_mode(
    mode: str,
    language: Optional[str],
) -> tuple[str, str]:
    """Map legacy `mode` and explicit `language` into a concrete pair.

    The upstream GraphQL API still exposes `translationType` as \"sub\"/\"dub\",
    but for the UI we want stable language codes like \"ja\"/\"en\". When a
    `language` query param is provided, it wins; otherwise we derive a
    reasonable default from the requested `mode`.
    """

    if language in {"ja", "en"}:
        resolved_language = language
    else:
        resolved_language = "en" if mode == "dub" else "ja"

    effective_mode = "dub" if resolved_language == "en" else "sub"
    return resolved_language, effective_mode


@router.get("/proxy")
async def proxy_stream(request: Request, url: str = Query(...)) -> StreamingResponse:
    """Proxy a CDN media URL with the correct Referer/UA headers.

    Required because providers like tools.fast4speed.rsvp enforce hotlink
    protection — only requests with Referer: allanime.to are allowed.
    The browser cannot set Referer arbitrarily, so we proxy here.
    Supports Range requests for seeking.
    """
    target_url = unquote(url)
    if not target_url.startswith("http"):
        raise HTTPException(status_code=400, detail="Invalid URL")

    upstream_headers = dict(_PROXY_HEADERS)
    range_header = request.headers.get("range")
    if range_header:
        upstream_headers["Range"] = range_header

    async def _stream():
        async with _proxy_client.stream("GET", target_url, headers=upstream_headers) as resp:
            async for chunk in resp.aiter_bytes(chunk_size=65536):
                yield chunk

    try:
        head_resp = await _proxy_client.head(target_url, headers=upstream_headers)
        status = head_resp.status_code
        if status >= 400:
            raise HTTPException(status_code=status, detail="Upstream returned error")
        forward = {
            k: v
            for k, v in head_resp.headers.items()
            if k.lower() in _FORWARD_RESPONSE_HEADERS
        }
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Proxy error: {exc}") from exc

    return StreamingResponse(
        _stream(),
        status_code=206 if range_header else 200,
        headers=forward,
        media_type=forward.get("content-type", "application/octet-stream"),
    )


@router.get("/{show_id}/episodes/{episode}/stream")
async def get_episode_stream(
    request: Request,
    show_id: str,
    episode: str,
    mode: str = Query("sub", pattern="^(sub|dub)$"),
    language: Optional[str] = Query(None, pattern="^(ja|en)$"),
    quality: Optional[str] = Query(None),
    variant: Optional[str] = Query(
        None,
        description="Preferred stream variant id from the API list (e.g. v0, v1).",
        pattern="^v[0-9]+$",
    ),
    device_token: Optional[str] = Query(None),
) -> StreamResponseModel:
    service = _get_stream_service()

    resolved_language, effective_mode = _resolve_language_and_mode(
        mode=mode,
        language=language,
    )

    try:
        manifest_url, variants = await service.get_hls_manifest_for_episode(
            show_id=show_id,
            episode=episode,
            mode=effective_mode,
            preferred_quality=quality,
            device_token=device_token,
            variant_id=variant,
        )
    except RuntimeError as exc:
        raise HTTPException(
            status_code=404,
            detail=str(exc) or "No stream candidates available",
        ) from exc

    # Direct MP4/file URLs require hotlink-correct headers the browser can't set.
    # Route them through the backend proxy so Referer/UA are injected server-side.
    is_hls = ".m3u8" in manifest_url
    if not is_hls:
        from urllib.parse import quote
        base = str(request.base_url).rstrip("/")
        manifest_url = f"{base}/api/v1/stream/proxy?url={quote(manifest_url, safe='')}"

    if resolved_language == "en":
        audio_label = "English"
    else:
        audio_label = "日本語"

    audio_languages = [
        AudioLanguageModel(
            id=resolved_language,
            code=resolved_language,
            label=audio_label,
            is_default=True,
        )
    ]

    return StreamResponseModel(
        manifest_url=manifest_url,
        variants=variants,
        audio_languages=audio_languages,
    )
