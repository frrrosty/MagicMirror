#!/usr/bin/env bash
# Schaltet den Samsung TV über HDMI-CEC (Anynet+) ein oder in den Standby.
# Aufruf: bildschirm.sh ein | aus | status
# Fallback ohne CEC: MODUS=signal bildschirm.sh aus  (schaltet nur das HDMI-Signal ab)
set -euo pipefail

MODUS="${MODUS:-cec}"
AUSGANG="${AUSGANG:-HDMI-A-1}"

cec() {
	echo "$1" | cec-client -s -d 1
}

signal() {
	# Wayland (labwc/wayfire); funktioniert auch per SSH und cron
	local runtime="/run/user/$(id -u)"
	local socket
	socket="$(ls "$runtime" 2>/dev/null | grep -m1 -E '^wayland-[0-9]+$' || true)"
	WAYLAND_DISPLAY="${WAYLAND_DISPLAY:-$socket}" XDG_RUNTIME_DIR="$runtime" \
		wlr-randr --output "$AUSGANG" "$1"
}

case "${1:-}" in
	ein)
		if [ "$MODUS" = signal ]; then signal --on; else cec "on 0"; cec "as"; fi
		;;
	aus)
		if [ "$MODUS" = signal ]; then signal --off; else cec "standby 0"; fi
		;;
	status)
		cec "pow 0"
		;;
	*)
		echo "Aufruf: $0 ein | aus | status" >&2
		exit 1
		;;
esac
