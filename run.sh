#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT_DIR"

PIDS=()

cleanup() {
    echo "Shutting down..."
    for pid in "${PIDS[@]:-}"; do
        kill "$pid" 2>/dev/null || true
    done
}

trap cleanup INT TERM

# 1. Initialize Database (SQLite file will be created if not exists)
(cd backend && python3 -m app.db.init_db)

# 2. Start Services
echo "Starting backend and frontend..."
(cd backend && uvicorn app.main:app --reload --host 0.0.0.0 --port 8000) &
PIDS+=($!)

(cd frontend && npm run dev) &
PIDS+=($!)

wait "${PIDS[@]}"
