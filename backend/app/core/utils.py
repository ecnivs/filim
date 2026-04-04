from __future__ import annotations

import re

TITLE_CLEANUP_REGEXES = [
    (re.compile(r"\s*\(.*?\)\s*"), " "),
    (re.compile(r"\s+"), " "),
]


def normalize_title(title: str) -> str:
    """Standardize title for consistent deduplication and matching."""
    if not title:
        return ""

    clean = title
    for pattern, replacement in TITLE_CLEANUP_REGEXES:
        clean = pattern.sub(replacement, clean)

    return clean.strip().lower()


_GENRE_ANIME_SUFFIX = re.compile(r"\s+anime\s*$", re.IGNORECASE)


def normalize_genre_label(label: str) -> str:
    """Strip trailing ' Anime' from provider genre labels (e.g. Comedy Anime -> Comedy)."""
    if not label or not label.strip():
        return ""
    s = " ".join(label.split())
    s = _GENRE_ANIME_SUFFIX.sub("", s).strip()
    return s


def normalize_genre_list(genres: list[str] | None) -> list[str]:
    """Normalize, dedupe while preserving order."""
    if not genres:
        return []
    seen_lower: set[str] = set()
    out: list[str] = []
    for g in genres:
        n = normalize_genre_label(g)
        if not n:
            continue
        key = n.lower()
        if key in seen_lower:
            continue
        seen_lower.add(key)
        out.append(n)
    return out
