#!/usr/bin/env bash
# Stellt die Anzeige von Electron auf Chromium im Kiosk-Modus um.
# Gedacht für schwächere Modelle wie den Pi 3, auf denen Electron kein Bild zeigt.
# MagicMirror² läuft danach nur noch als Server, Chromium zeigt die Seite an.
set -euo pipefail

MM_DIR="$HOME/MagicMirror"
REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

# Chromium muss vorhanden sein
if ! command -v chromium >/dev/null && ! command -v chromium-browser >/dev/null; then
	sudo apt-get install -y chromium
fi
chmod +x "$REPO_DIR/scripts/kiosk-start.sh"

echo "==> MagicMirror² als reinen Server starten"
pm2 delete MagicMirror >/dev/null 2>&1 || true
pm2 start npm --name MagicMirror --cwd "$MM_DIR" -- run server
pm2 save

echo "==> Chromium-Kiosk beim Anmelden starten"
# Startbefehl als eigenes Skript: Desktop-Dateien vertragen keine verschachtelten Anführungszeichen
mkdir -p "$HOME/.config/autostart"
cat > "$HOME/.config/autostart/magicmirror-kiosk.desktop" <<EOF
[Desktop Entry]
Type=Application
Name=MagicMirror Kiosk
Exec=$REPO_DIR/scripts/kiosk-start.sh
EOF

echo "==> Kiosk jetzt sofort starten"
setsid "$REPO_DIR/scripts/kiosk-start.sh" >/dev/null 2>&1 < /dev/null &
echo "    Der Spiegel sollte in Kürze auf dem TV erscheinen. Protokoll: ~/.cache/kiosk.log"
