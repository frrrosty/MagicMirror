#!/usr/bin/env bash
# Legt die Ausrichtung des Bildes dauerhaft fest und wendet sie sofort an.
# Aufruf: ausrichtung.sh hoch | hoch-links | quer
#   hoch        Bild um 90 Grad gedreht (TV im Uhrzeigersinn auf die Seite gelegt)
#   hoch-links  Bild um 270 Grad gedreht (TV gegen den Uhrzeigersinn gedreht)
#   quer        normale Ausrichtung
# Steht das Bild nach dem Aufruf auf dem Kopf, einfach die andere Hochformat-Variante wählen.
set -euo pipefail

AUSGANG="${AUSGANG:-HDMI-A-1}"
case "${1:-hoch}" in
	hoch) TRANSFORM=90 ;;
	hoch-links) TRANSFORM=270 ;;
	quer) TRANSFORM=normal ;;
	*) echo "Aufruf: $0 hoch | hoch-links | quer" >&2; exit 1 ;;
esac

# Raspberry Pi OS speichert die Bildschirmeinstellungen unter labwc mit kanshi
KANSHI="$HOME/.config/kanshi/config"
mkdir -p "$(dirname "$KANSHI")"
if [ -f "$KANSHI" ] && [ ! -f "$KANSHI.vor-spiegel" ]; then
	cp "$KANSHI" "$KANSHI.vor-spiegel"
fi
cat > "$KANSHI" <<EOF
profile {
	output $AUSGANG enable mode 1920x1080 position 0,0 transform $TRANSFORM
}
EOF
echo "==> Ausrichtung gespeichert: ${1:-hoch} (transform $TRANSFORM)"

# Sofort anwenden, falls ein Desktop läuft
RUNTIME_DIR="/run/user/$(id -u)"
WL_SOCKET="$(ls "$RUNTIME_DIR" 2>/dev/null | grep -m1 -E '^wayland-[0-9]+$' || true)"
if [ -n "$WL_SOCKET" ]; then
	WAYLAND_DISPLAY="$WL_SOCKET" XDG_RUNTIME_DIR="$RUNTIME_DIR" \
		wlr-randr --output "$AUSGANG" --mode 1920x1080 --transform "$TRANSFORM" || true
	echo "    Sofort angewendet."
fi
