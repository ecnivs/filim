#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT_DIR"

export ENVIRONMENT=development

PIDS=()

cleanup() {
    echo "Shutting down..."
    for pid in "${PIDS[@]:-}"; do
        kill "$pid" 2>/dev/null || true
    done
}

trap cleanup INT TERM

(cd backend && python3 -m app.db.init_db)

echo "Starting backend and frontend in development mode..."
(cd backend && uvicorn app.main:app --reload --host 127.0.0.1 --port 8000) &
PIDS+=($!)

(cd frontend && npm run dev) &
PIDS+=($!)

wait "${PIDS[@]}"
