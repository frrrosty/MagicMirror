#!/usr/bin/env bash
# Schaltet den Samsung TV über HDMI-CEC (Anynet+) ein oder in den Standby.
# Aufruf: bildschirm.sh ein | aus | status
# Bevorzugt cec-ctl (Paket v4l-utils), sonst cec-client (Paket cec-utils).
# Fallback ohne CEC: MODUS=signal bildschirm.sh aus  (schaltet nur das HDMI-Signal ab)
set -euo pipefail

MODUS="${MODUS:-cec}"
AUSGANG="${AUSGANG:-HDMI-A-1}"
GERAET="${CEC_GERAET:-$(ls /dev/cec* 2>/dev/null | head -n1)}"

cec_ctl () {
	# Einmal als Wiedergabegerät anmelden, sonst darf der Pi keine Befehle senden
	cec-ctl -d "$GERAET" --playback >/dev/null
	cec-ctl -d "$GERAET" "$@"
}

cec_client () {
	echo "$1" | cec-client -s -d 1
}

signal () {
	# Wayland (labwc/wayfire); funktioniert auch per SSH und cron
	local runtime="/run/user/$(id -u)"
	local socket
	socket="$(ls "$runtime" 2>/dev/null | grep -m1 -E '^wayland-[0-9]+$' || true)"
	WAYLAND_DISPLAY="${WAYLAND_DISPLAY:-$socket}" XDG_RUNTIME_DIR="$runtime" \
		wlr-randr --output "$AUSGANG" "$1"
}

if [ "$MODUS" = signal ]; then
	case "${1:-}" in
		ein) signal --on ;;
		aus) signal --off ;;
		*) echo "Aufruf: MODUS=signal $0 ein | aus" >&2; exit 1 ;;
	esac
	exit 0
fi

if command -v cec-ctl >/dev/null && [ -n "$GERAET" ]; then
	case "${1:-}" in
		ein) cec_ctl --to 0 --image-view-on ;;
		aus) cec_ctl --to 0 --standby ;;
		status) cec_ctl --to 0 --give-device-power-status ;;
		*) echo "Aufruf: $0 ein | aus | status" >&2; exit 1 ;;
	esac
else
	case "${1:-}" in
		ein) cec_client "on 0"; cec_client "as" ;;
		aus) cec_client "standby 0" ;;
		status) cec_client "pow 0" ;;
		*) echo "Aufruf: $0 ein | aus | status" >&2; exit 1 ;;
	esac
fi
