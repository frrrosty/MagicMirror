#!/usr/bin/env bash
# Installiert MagicMirror² auf einem Raspberry Pi (Raspberry Pi OS Bookworm, 64-bit)
# und verknüpft die Konfiguration aus diesem Repository.
set -euo pipefail

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
MM_DIR="$HOME/MagicMirror"

echo "==> Systempakete"
sudo apt-get update
sudo apt-get install -y git curl cec-utils wlr-randr

echo "==> Node.js 22 LTS"
if ! command -v node >/dev/null || [ "$(node -v | cut -d. -f1 | tr -d v)" -lt 22 ]; then
	curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
	sudo apt-get install -y nodejs
fi

echo "==> MagicMirror²"
if [ ! -d "$MM_DIR" ]; then
	git clone --depth=1 https://github.com/MagicMirrorOrg/MagicMirror "$MM_DIR"
fi
(cd "$MM_DIR" && npm run install-mm)

echo "==> Konfiguration verlinken"
ln -sf "$REPO_DIR/config/config.js" "$MM_DIR/config/config.js"
ln -sf "$REPO_DIR/config/custom.css" "$MM_DIR/css/custom.css"
if [ ! -f "$REPO_DIR/config/secrets.js" ]; then
	echo "    Hinweis: config/secrets.js fehlt, Familienkalender bleibt leer."
fi

echo "==> Autostart mit pm2"
sudo npm install -g pm2
pm2 delete MagicMirror >/dev/null 2>&1 || true
pm2 start npm --name MagicMirror --cwd "$MM_DIR" -- run start:wayland
pm2 save
sudo env PATH="$PATH" pm2 startup systemd -u "$USER" --hp "$HOME"

chmod +x "$REPO_DIR/scripts/bildschirm.sh"
echo "==> Fertig. Status: pm2 status"
