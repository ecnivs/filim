## Filim backend

Python FastAPI backend for the LAN-only streaming platform. It reimplements the behavior of the original `ani-cli` script as HTTP APIs and integrates with a local HLS media pipeline.

### Structure

- `app/main.py` – FastAPI application entrypoint.
- `app/core/config.py` – configuration and settings.
- `app/db/session.py` – database engine and session factory.
- `app/models/` – SQLAlchemy models for devices, watch progress, and catalog.
- `app/sources/` – adapters for external content sources (e.g. AllAnime).
- `app/streams/` – stream resolution and HLS integration.
- `app/sessions/` – MAC-based device identity and watch progress services.
- `app/recommendations/` – rule-based recommendation logic.
- `app/api/` – FastAPI routers exposing HTTP endpoints.

The backend is designed to run behind a reverse proxy (e.g. Nginx or Caddy) that also serves the `/hls/` directory for HLS assets.

