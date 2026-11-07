#!/usr/bin/env bash
# Holt den neuesten Stand dieses Repositorys und lädt den Spiegel neu.
# Schneller als install.sh, weil MagicMirror² selbst nicht neu installiert wird.
set -euo pipefail

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
MM_DIR="$HOME/MagicMirror"

echo "==> Neuesten Stand holen"
git -C "$REPO_DIR" pull --ff-only

echo "==> Konfiguration und eigene Module verlinken"
ln -sf "$REPO_DIR/config/config.js" "$MM_DIR/config/config.js"
ln -sf "$REPO_DIR/config/custom.css" "$MM_DIR/config/custom.css"
for modul in "$REPO_DIR"/modules/*/; do
	ln -sfn "${modul%/}" "$MM_DIR/modules/$(basename "$modul")"
done
chmod +x "$REPO_DIR"/scripts/*.sh "$REPO_DIR"/scripts/*.py
# Persönliches nur für den eigenen Benutzer lesbar
[ -f "$REPO_DIR/config/secrets.js" ] && chmod 600 "$REPO_DIR/config/secrets.js"

echo "==> Spiegel neu laden"
pm2 restart MagicMirror
# Im Kiosk-Modus die Seite neu öffnen, damit neue Module und Styles erscheinen
KIOSK_DESKTOP="$HOME/.config/autostart/magicmirror-kiosk.desktop"
if [ -f "$KIOSK_DESKTOP" ]; then
	# Autostart immer auf das aktuelle Startskript zeigen lassen
	printf '[Desktop Entry]\nType=Application\nName=MagicMirror Kiosk\nExec=%s\n' "$REPO_DIR/scripts/kiosk-start.sh" > "$KIOSK_DESKTOP"
	setsid "$REPO_DIR/scripts/kiosk-start.sh" >/dev/null 2>&1 < /dev/null &
fi
echo "==> Fertig"
