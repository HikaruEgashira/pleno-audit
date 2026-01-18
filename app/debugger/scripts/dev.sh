#!/bin/bash
# Development script with graceful cleanup

export DEBUG_PORT=9223

cleanup() {
  echo "[dev] Cleaning up..."
  # Graceful shutdown: SIGTERM first
  pkill -15 -f tmp-web-ext 2>/dev/null
  sleep 2
  # Force kill if still running
  pkill -9 -f tmp-web-ext 2>/dev/null
  echo "[dev] Cleanup complete"
}

trap cleanup EXIT INT TERM

# Build battacker first
echo "[dev] Building battacker-extension..."
pnpm -C app/battacker-extension build

# Start dev environment
echo "[dev] Starting dev environment on port $DEBUG_PORT..."
concurrently --kill-others \
  -n debug,ext,logs \
  -c blue,green,yellow \
  "pnpm -C app/debugger start server" \
  "sleep 2 && pnpm -C app/extension dev" \
  "sleep 2 && pnpm -C app/debugger start logs"
