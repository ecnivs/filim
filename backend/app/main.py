from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware


def create_app() -> FastAPI:
    """Application factory for the Filim backend."""

    app = FastAPI(
        title="Filim Backend",
        version="0.1.0",
        docs_url="/api/docs",
        openapi_url="/api/openapi.json",
    )

    # CORS – liberal for LAN usage by default, tighten in production if needed.
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # Routers will be imported and mounted here to avoid circular imports.
    from app.api import router as api_router  # type: ignore[import-not-found]

    app.include_router(api_router, prefix="/api/v1")

    return app


app = create_app()
