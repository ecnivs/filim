## Frontend app (Next.js)

This directory will contain the Netflix-like LAN streaming UI.

### Stack

- **Framework**: Next.js (React, TypeScript).
- **Styling**: Tailwind CSS, dark theme (black background, cyan accents).
- **Video playback**: `hls.js` for HLS adaptive streaming, wrapped in a reusable React component.

### Planned routes

- `/` – Home screen with:
  - Continue Watching (per device/MAC).
  - Trending.
  - Recommendations For This Device.
  - Recently Added.
- `/anime/[id]` – Anime details and episode list with progress indicators.
- `/watch/[animeId]/[episode]` – Fullscreen-first HLS player view.

The frontend will communicate exclusively with the Python FastAPI backend and will not talk directly to ani-cli or ani-cli sources.

