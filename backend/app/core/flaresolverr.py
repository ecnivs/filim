from __future__ import annotations

import json
import logging
from typing import Any

import httpx

FLARESOLVERR_URL = "http://localhost:8191/v1"
_TIMEOUT = 90.0


async def flarefetch(url: str, params: dict[str, str] | None = None) -> dict[str, Any]:
    """Fetch a Cloudflare-protected URL through FlareSolverr.

    Builds the full URL with query params (FlareSolverr only supports GET via
    the `url` field), sends it to the local FlareSolverr instance, and returns
    the parsed JSON body from the page response.

    Returns an empty dict on any failure so callers degrade gracefully.
    """
    if params:
        from urllib.parse import urlencode
        full_url = f"{url}?{urlencode(params)}"
    else:
        full_url = url

    payload = {
        "cmd": "request.get",
        "url": full_url,
        "maxTimeout": 60000,
    }

    try:
        async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
            resp = await client.post(FLARESOLVERR_URL, json=payload)
            resp.raise_for_status()
    except Exception as exc:
        logging.error(f"FlareSolverr request failed: {exc}")
        return {}

    fs_data = resp.json()
    if fs_data.get("status") != "ok":
        logging.error(f"FlareSolverr returned error: {fs_data.get('message')}")
        return {}

    body = fs_data.get("solution", {}).get("response", "")
    if not body:
        logging.error("FlareSolverr solution contained no response body")
        return {}

    # FlareSolverr wraps plain JSON responses in <html><body><pre>...</pre></body></html>
    # Strip the wrapper if present before parsing.
    import re as _re
    pre_match = _re.search(r"<pre[^>]*>([\s\S]*?)</pre>", body, _re.IGNORECASE)
    if pre_match:
        body = pre_match.group(1).strip()

    try:
        return json.loads(body)
    except json.JSONDecodeError:
        logging.error(f"FlareSolverr response is not JSON (first 200 chars): {body[:200]}")
        return {}
