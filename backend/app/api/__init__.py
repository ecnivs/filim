from fastapi import APIRouter

router = APIRouter()

# Sub-routers are included individually so that one unfinished module
# does not prevent the others from being registered.

try:
    from app.api import catalog

    router.include_router(catalog.router, prefix="/catalog", tags=["catalog"])
except ImportError:
    # Catalog endpoints will be unavailable until their module is implemented.
    pass

try:
    from app.api import streams

    router.include_router(streams.router, prefix="/anime", tags=["streams"])
except ImportError:
    pass

try:
    from app.api import profiles

    router.include_router(profiles.router, prefix="/profiles", tags=["profiles"])
except ImportError:
    pass

try:
    from app.api import sessions

    # Sessions router defines both /devices/* and /user/* endpoints.
    router.include_router(sessions.router, tags=["devices", "sessions"])
except ImportError:
    pass

try:
    from app.api import recommendations

    router.include_router(
        recommendations.router, prefix="/user", tags=["recommendations"]
    )
except ImportError:
    pass

try:
    from app.api import preferences

    router.include_router(
        preferences.router,
        prefix="/user",
        tags=["preferences"],
    )
except ImportError:
    pass

try:
    from app.api import audio_preferences

    router.include_router(
        audio_preferences.router,
        prefix="/user",
        tags=["audio-preferences"],
    )
except ImportError:
    pass
