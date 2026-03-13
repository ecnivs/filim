from typing import Optional

from fastapi import APIRouter, HTTPException, Query

from app.models.streams import AudioLanguageModel, StreamResponseModel
from app.streams.service import StreamService


router = APIRouter()


def _get_stream_service() -> StreamService:
    return StreamService()


def _resolve_language_and_mode(
    mode: str,
    language: Optional[str],
) -> tuple[str, str]:
    """Map legacy `mode` and explicit `language` into a concrete pair.

    The external AllAnime API still exposes `translationType` as \"sub\"/\"dub\",
    but for the UI we want stable language codes like \"ja\"/\"en\". When a
    `language` query param is provided, it wins; otherwise we derive a
    reasonable default from the requested `mode`.
    """

    if language in {"ja", "en"}:
        resolved_language = language
    else:
        # Default to Japanese audio for \"sub\" and English audio for \"dub\".
        resolved_language = "en" if mode == "dub" else "ja"

    effective_mode = "dub" if resolved_language == "en" else "sub"
    return resolved_language, effective_mode


@router.get("/{anime_id}/episodes/{episode}/stream")
async def get_episode_stream(
    anime_id: str,
    episode: str,
    mode: str = Query("sub", pattern="^(sub|dub)$"),
    language: Optional[str] = Query(None, pattern="^(ja|en)$"),
    quality: Optional[str] = Query(None),
    device_token: Optional[str] = Query(None),
) -> StreamResponseModel:
    service = _get_stream_service()

    resolved_language, effective_mode = _resolve_language_and_mode(
        mode=mode,
        language=language,
    )

    try:
        manifest_url, variants = await service.get_hls_manifest_for_episode(
            anime_id=anime_id,
            episode=episode,
            mode=effective_mode,
            preferred_quality=quality,
            device_token=device_token,
        )
    except RuntimeError as exc:
        # Surface a clean API error instead of a 500 traceback when the
        # upstream source has no playable streams for this episode.
        raise HTTPException(
            status_code=404,
            detail=str(exc) or "No stream candidates available",
        ) from exc

    # Expose a single logical audio language using stable codes so the
    # frontend can present explicit English/Japanese labels.
    if resolved_language == "en":
        audio_label = "English"
    else:
        audio_label = "Japanese (日本語)"

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
