#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT_DIR"

export ENVIRONMENT=production

PIDS=()

cleanup() {
    echo "Shutting down..."
    for pid in "${PIDS[@]:-}"; do
        kill "$pid" 2>/dev/null || true
    done
}

trap cleanup INT TERM

# Ensure no lingering processes are holding the ports
echo "Terminating any existing processes on ports 3000 and 8000..."
fuser -k 8000/tcp 2>/dev/null || true
fuser -k 3000/tcp 2>/dev/null || true

# 1. Initialize Database (SQLite file will be created if not exists)
(cd backend && python3 -m app.db.init_db)

# 2. Start Services
echo "Starting backend and frontend..."
(cd backend && uvicorn app.main:app --workers 4 --host 0.0.0.0 --port 8000) &
PIDS+=($!)

(cd frontend && npm run build && npm run start) &
PIDS+=($!)

wait "${PIDS[@]}"
