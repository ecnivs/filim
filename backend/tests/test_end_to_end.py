from fastapi.testclient import TestClient

from app.main import app


client = TestClient(app)


def test_catalog_search_smoke():
    response = client.get(
        "/api/v1/catalog/search", params={"q": "naruto", "mode": "sub"}
    )
    assert response.status_code in (200, 502, 503)


def test_progress_flow(monkeypatch):
    # Fake adapter responses to avoid hitting external AllAnime during tests.
    from app.sources import (
        AllAnimeSourceAdapter,
        AnimeSummaryModel,
        EpisodeSummaryModel,
    )

    async def fake_search_shows(self, query: str, mode: str = "sub"):
        return [
            AnimeSummaryModel(
                id="test-anime",
                title="Test Anime",
                episode_count=1,
                synopsis=None,
                tags=[],
                poster_image_url=None,
            )
        ]

    async def fake_get_episode_list(self, show_id: str, mode: str = "sub"):
        return [EpisodeSummaryModel(number="1")]

    monkeypatch.setattr(AllAnimeSourceAdapter, "search_shows", fake_search_shows)
    monkeypatch.setattr(
        AllAnimeSourceAdapter, "get_episode_list", fake_get_episode_list
    )

    with TestClient(app) as _client:
        # Create a test profile to satisfy the foreign key constraint.
        profile_res = _client.post(
            "/api/v1/profiles",
            json={"name": "Test User", "avatarUrl": None},
        )
        assert profile_res.status_code == 200
        profile_id = profile_res.json()["id"]

        progress = _client.post(
            "/api/v1/user/progress",
            headers={"X-Profile-Id": profile_id},
            json={
                "anime_id": "test-anime",
                "episode": "1",
                "position_seconds": 60.0,
                "duration_seconds": 120.0,
                "is_finished": False,
            },
        )
        assert progress.status_code == 200

        cont = _client.get(
            "/api/v1/user/continue-watching",
            headers={"X-Profile-Id": profile_id},
        )
    assert cont.status_code == 200
    assert isinstance(cont.json().get("items"), list)
