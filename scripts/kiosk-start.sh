#!/usr/bin/env bash
# Startet Chromium im Kiosk-Modus mit der schwarzen Warteseite.
# Wird beim Anmelden (Autostart) sowie von kiosk-modus.sh und update.sh aufgerufen.
# Protokoll: ~/.cache/kiosk.log
REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
LOG="$HOME/.cache/kiosk.log"
mkdir -p "$(dirname "$LOG")"
echo "$(date '+%F %T') Kiosk-Start" >> "$LOG"

BROWSER="$(command -v chromium || command -v chromium-browser)"
if [ -z "$BROWSER" ]; then
	echo "Chromium nicht gefunden" >> "$LOG"
	exit 1
fi

# Chromium lässt nur eine Instanz zu: alte beenden und warten, bis sie weg ist
pkill -f -- "--kiosk" 2>/dev/null
for _ in $(seq 20); do pgrep -f -- "--kiosk" >/dev/null || break; sleep 0.5; done

# Beim Aufruf per SSH fehlen die Angaben zur Bildschirmsitzung
export XDG_RUNTIME_DIR="${XDG_RUNTIME_DIR:-/run/user/$(id -u)}"
if [ -z "${WAYLAND_DISPLAY:-}" ]; then
	WAYLAND_DISPLAY="$(ls "$XDG_RUNTIME_DIR" 2>/dev/null | grep -m1 -E '^wayland-[0-9]+$')"
	export WAYLAND_DISPLAY
fi

exec "$BROWSER" --kiosk --noerrdialogs --disable-infobars --incognito \
	--password-store=basic --no-first-run --disable-features=Translate,MediaRouter \
	--disable-component-update --check-for-update-interval=31536000 \
	"file://$REPO_DIR/scripts/warten.html" >> "$LOG" 2>&1
