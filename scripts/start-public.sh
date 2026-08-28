#!/bin/bash
# One-command way to run DailyFlow and expose it on a free public URL
# (via a Cloudflare quick tunnel), so you can open it on your phone from
# anywhere, not just your home Wi-Fi.
#
# Requires cloudflared: brew install cloudflared

set -e
cd "$(dirname "$0")/.."

if ! command -v cloudflared >/dev/null 2>&1; then
  echo "cloudflared isn't installed. Run: brew install cloudflared"
  exit 1
fi

cleanup() {
  echo ""
  echo "Shutting down..."
  kill $(jobs -p) 2>/dev/null
}
trap cleanup EXIT INT TERM

echo "Starting the app..."
npm run dev > /tmp/dailyflow-dev.log 2>&1 &
DEV_PID=$!

# Wait for the dev server to actually be up before starting the tunnel
for i in $(seq 1 30); do
  if curl -s http://localhost:3000 > /dev/null 2>&1; then
    break
  fi
  sleep 1
done

echo "Starting the tunnel..."
echo "(Your public URL will appear below — look for the trycloudflare.com line)"
echo ""
cloudflared tunnel --url http://localhost:3000

wait $DEV_PID
