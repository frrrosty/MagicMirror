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

echo "==> Spiegel neu laden"
pm2 restart MagicMirror
# Im Kiosk-Modus die Seite neu öffnen, damit neue Module und Styles erscheinen
if [ -f "$HOME/.config/autostart/magicmirror-kiosk.desktop" ]; then
	pkill -f -- "--kiosk" || true
	# Chromium lässt nur eine Instanz zu: warten, bis die alte wirklich beendet ist
	for _ in $(seq 20); do pgrep -f -- "--kiosk" >/dev/null || break; sleep 0.5; done
	RUNTIME_DIR="/run/user/$(id -u)"
	WL_SOCKET="$(ls "$RUNTIME_DIR" 2>/dev/null | grep -m1 -E '^wayland-[0-9]+$' || true)"
	EXEC="$(sed -n 's/^Exec=sh -c //p' "$HOME/.config/autostart/magicmirror-kiosk.desktop" | sed "s/^'//; s/'$//")"
	WAYLAND_DISPLAY="$WL_SOCKET" XDG_RUNTIME_DIR="$RUNTIME_DIR" setsid sh -c "$EXEC" >/dev/null 2>&1 < /dev/null &
fi
echo "==> Fertig"
