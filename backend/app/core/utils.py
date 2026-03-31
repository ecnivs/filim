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
