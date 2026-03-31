from __future__ import annotations

# Relationship Types
REL_SEQUEL = "sequel"
REL_PREQUEL = "prequel"
REL_SIDE_STORY = "side_story"
REL_PARENT_STORY = "parent_story"
REL_ALTERNATIVE_SETTING = "alternative_setting"

SUPPORTED_RELATIONS = {
    REL_SEQUEL,
    REL_PREQUEL,
    REL_SIDE_STORY,
    REL_PARENT_STORY,
    REL_ALTERNATIVE_SETTING,
}

# Translation Modes
MODE_SUB = "sub"
MODE_DUB = "dub"

# Default HTTP Settings
DEFAULT_USER_AGENT = (
    "Mozilla/5.0 (X11; Linux x86_64) "
    "AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/122.0 Safari/537.36"
)
