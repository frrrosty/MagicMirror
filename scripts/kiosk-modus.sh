#!/usr/bin/env bash
# Stellt die Anzeige von Electron auf Chromium im Kiosk-Modus um.
# Gedacht für schwächere Modelle wie den Pi 3, auf denen Electron kein Bild zeigt.
# MagicMirror² läuft danach nur noch als Server, Chromium zeigt die Seite an.
set -euo pipefail

MM_DIR="$HOME/MagicMirror"
RUNTIME_DIR="/run/user/$(id -u)"

BROWSER="$(command -v chromium || command -v chromium-browser || true)"
if [ -z "$BROWSER" ]; then
	sudo apt-get install -y chromium
	BROWSER="$(command -v chromium)"
fi

echo "==> MagicMirror² als reinen Server starten"
pm2 delete MagicMirror >/dev/null 2>&1 || true
pm2 start npm --name MagicMirror --cwd "$MM_DIR" -- run server
pm2 save

echo "==> Chromium-Kiosk beim Anmelden starten"
KIOSK_CMD="until curl -s localhost:8080 >/dev/null; do sleep 2; done; $BROWSER --kiosk --noerrdialogs --disable-infobars --incognito --password-store=basic --check-for-update-interval=31536000 http://localhost:8080"
mkdir -p "$HOME/.config/autostart"
cat > "$HOME/.config/autostart/magicmirror-kiosk.desktop" <<EOF
[Desktop Entry]
Type=Application
Name=MagicMirror Kiosk
Exec=sh -c '$KIOSK_CMD'
EOF

echo "==> Kiosk jetzt sofort starten"
WL_SOCKET="$(ls "$RUNTIME_DIR" 2>/dev/null | grep -m1 -E '^wayland-[0-9]+$' || true)"
if [ -n "$WL_SOCKET" ]; then
	pkill -f -- "--kiosk" >/dev/null 2>&1 || true
	WAYLAND_DISPLAY="$WL_SOCKET" XDG_RUNTIME_DIR="$RUNTIME_DIR" \
		setsid sh -c "$KIOSK_CMD" >/dev/null 2>&1 < /dev/null &
	echo "    Der Spiegel sollte in etwa einer Minute auf dem TV erscheinen."
else
	echo "    Kein Desktop gefunden. Nach einem Neustart erscheint der Spiegel automatisch."
fi
