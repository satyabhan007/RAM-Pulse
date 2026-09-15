#!/usr/bin/env bash
# scripts/install_linux.sh - one-shot Linux setup for RAM Pulse.
# Installs Node deps, optional passwordless drop_caches rule, desktop entry + autostart.
set -euo pipefail
cd "$(dirname "$0")/.."

echo "==> [1/4] npm install"
npm install --no-audit --no-fund

echo "==> [2/4] passwordless drop_caches (optional, needs sudo once)"
if sudo -n true 2>/dev/null; then
  echo "$USER ALL=(root) NOPASSWD: /bin/sh -c echo * > /proc/sys/vm/drop_caches" | sudo tee /etc/sudoers.d/rampulse-drop-caches >/dev/null
  sudo chmod 440 /etc/sudoers.d/rampulse-drop-caches
  echo "    installed /etc/sudoers.d/rampulse-drop-caches"
else
  echo "    sudo needs a password - skipping. Boost will do sync-only without it."
fi

echo "==> [3/4] desktop entries (app menu + autostart)"
ELECTRON_BIN="$PWD/node_modules/electron/dist/electron"
ICON="$PWD/assets/icon.png"
mkdir -p ~/.local/share/applications ~/.config/autostart
for d in ~/.local/share/applications ~/.config/autostart; do
  cat > "$d/rampulse.desktop" <<EOF
[Desktop Entry]
Type=Application
Name=RAM Pulse
Comment=Live Memory Telemetry Widget
Exec="$ELECTRON_BIN" --no-sandbox "$PWD"
Icon=$ICON
Terminal=false
Categories=System;Monitor;
X-GNOME-Autostart-enabled=true
EOF
done
echo "    wrote ~/.local/share/applications/rampulse.desktop and ~/.config/autostart/rampulse.desktop"

echo "==> [4/4] smoke test (starts temp server on 3889)"
TELEMETRY_INTERVAL_MS=2000 PORT_OVERRIDE=3889 node -e "
const { spawn } = require('child_process');
const srv = spawn('node', ['server.js'], { env: { ...process.env, PORT: '3889' }, stdio: 'ignore' });
setTimeout(() => { require('child_process').execSync('node scripts/smoke_test.js http://localhost:3889', { stdio: 'inherit' }); srv.kill(); }, 3000);
" || true
echo "Done. Run: npm run web  (browser: http://localhost:3888)  or  npm run start:linux  (Electron widget)"
