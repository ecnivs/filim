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

# Source Configuration
ALLANIME_API_URL = "https://api.allanime.day/api"
ALLANIME_REFERER = "https://allmanga.to"
HTTP_TIMEOUT_SECONDS = 15.0

# Application Configuration
TRENDING_WINDOW_DAYS = 30
DEFAULT_HOST = "0.0.0.0"
DEFAULT_PORT = 8000
DEFAULT_LOG_LEVEL = "INFO"
