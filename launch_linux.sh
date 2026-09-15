#!/usr/bin/env bash
# launch_linux.sh - start RAM Pulse on Ubuntu (Electron widget + web server fallback)
cd "$(dirname "$0")"
if [ ! -d node_modules ]; then
  echo "Installing dependencies first..."
  npm install --no-audit --no-fund
fi
# Web telemetry server in background (powers browser fallback + smoke tests)
if ! curl -s -m 2 http://localhost:3888/api/telemetry >/dev/null 2>&1; then
  echo "Starting web server on http://localhost:3888 ..."
  (nohup node server.js > /tmp/rampulse-server.log 2>&1 &)
  sleep 2
fi
echo "Launching Electron widget..."
exec ./node_modules/electron/dist/electron --no-sandbox --disable-gpu .
