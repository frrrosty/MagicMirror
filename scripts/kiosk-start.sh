#!/usr/bin/env bash
# Startet Chromium im Kiosk-Modus mit der schwarzen Warteseite und startet es
# neu, falls es sich beendet (z. B. wenn der TV kurz als Bildschirm verschwindet).
# Wird beim Anmelden (Autostart) sowie von kiosk-modus.sh und update.sh aufgerufen.
# Protokoll: ~/.cache/kiosk.log
REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
LOG="$HOME/.cache/kiosk.log"
mkdir -p "$(dirname "$LOG")"
# Protokoll klein halten (auch bei jedem Neustart von Chromium, siehe Schleife unten)
kuerzen () {
	if [ -f "$LOG" ] && [ "$(stat -c %s "$LOG")" -gt 1000000 ]; then
		tail -c 200000 "$LOG" > "$LOG.tmp" && mv "$LOG.tmp" "$LOG"
	fi
}
kuerzen
echo "$(date '+%F %T') Kiosk-Start" >> "$LOG"

BROWSER="$(command -v chromium || command -v chromium-browser)"
if [ -z "$BROWSER" ]; then
	echo "Chromium nicht gefunden" >> "$LOG"
	exit 1
fi

# Ältere Überwachungen dieses Skripts beenden, sonst starten zwei Chromium um die Wette
for pid in $(pgrep -f "scripts/kiosk-start.sh"); do
	[ "$pid" != "$$" ] && kill "$pid" 2>/dev/null
done

# Chromium lässt nur eine Instanz zu: alte beenden und warten, bis sie weg ist
pkill -f -- "--kiosk" 2>/dev/null
for _ in $(seq 20); do pgrep -f -- "--kiosk" >/dev/null || break; sleep 0.5; done

# Beim Aufruf per SSH fehlen die Angaben zur Bildschirmsitzung
export XDG_RUNTIME_DIR="${XDG_RUNTIME_DIR:-/run/user/$(id -u)}"
if [ -z "${WAYLAND_DISPLAY:-}" ]; then
	WAYLAND_DISPLAY="$(ls "$XDG_RUNTIME_DIR" 2>/dev/null | grep -m1 -E '^wayland-[0-9]+$')"
	export WAYLAND_DISPLAY
fi
# Grafiksystem ausdrücklich wählen: Per SSH gestartet hält Chromium die Sitzung
# sonst für eine Textkonsole und versucht vergeblich X11
if [ -n "$WAYLAND_DISPLAY" ]; then
	PLATTFORM="--ozone-platform=wayland"
else
	export DISPLAY="${DISPLAY:-:0}"
	PLATTFORM="--ozone-platform=x11"
fi
echo "$(date '+%F %T') Sitzung: ${WAYLAND_DISPLAY:-X11 $DISPLAY}" >> "$LOG"

# Fenstergrösse ausdrücklich setzen: Per SSH gestartet übernimmt Chromium sonst
# das Querformat, auch wenn der Bildschirm ins Hochformat gedreht ist
FENSTER=()
if [ -n "$WAYLAND_DISPLAY" ] && command -v wlr-randr >/dev/null; then
	RANDR="$(wlr-randr 2>/dev/null)"
	MODUS="$(echo "$RANDR" | grep -m1 "(current)" | grep -oE '[0-9]+x[0-9]+')"
	DREHUNG="$(echo "$RANDR" | grep -m1 "Transform:" | awk '{print $2}')"
	if [ -n "$MODUS" ]; then
		B="${MODUS%x*}"
		H="${MODUS#*x}"
		case "$DREHUNG" in 90|270|flipped-90|flipped-270) read -r B H <<< "$H $B" ;; esac
		FENSTER=(--window-position=0,0 "--window-size=$B,$H")
		echo "$(date '+%F %T') Fenster: ${B}x${H}" >> "$LOG"
	fi
fi

while true; do
	"$BROWSER" "$PLATTFORM" "${FENSTER[@]}" --kiosk --noerrdialogs --disable-infobars --incognito \
		--password-store=basic --no-first-run --disable-features=Translate,MediaRouter \
		--disable-component-update --check-for-update-interval=31536000 \
		"file://$REPO_DIR/scripts/warten.html" >> "$LOG" 2>&1
	code=$?
	kuerzen
	echo "$(date '+%F %T') Chromium beendet (Code $code), Neustart in 5 Sekunden" >> "$LOG"
	sleep 5
done
