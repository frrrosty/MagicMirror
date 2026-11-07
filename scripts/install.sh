#!/usr/bin/env bash
# Installiert MagicMirror² auf einem Raspberry Pi (Raspberry Pi OS 64-bit mit Desktop)
# und verknüpft die Konfiguration aus diesem Repository.
# Läuft komplett per SSH, solange der Desktop auf dem Pi angemeldet ist (Autologin).
set -euo pipefail

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
MM_DIR="$HOME/MagicMirror"
RUNTIME_DIR="/run/user/$(id -u)"

echo "==> Systempakete"
sudo apt-get update
sudo apt-get install -y git curl cec-utils wlr-randr python3-lgpio

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
# Ab MagicMirror² 2.30 liegt custom.css im config-Ordner
ln -sf "$REPO_DIR/config/custom.css" "$MM_DIR/config/custom.css"
# Eigene Module aus diesem Repository
for modul in "$REPO_DIR"/modules/*/; do
	ln -sfn "${modul%/}" "$MM_DIR/modules/$(basename "$modul")"
done
if [ ! -f "$REPO_DIR/config/secrets.js" ]; then
	echo "    Hinweis: config/secrets.js fehlt, Familienkalender bleibt leer."
fi

echo "==> Systemeinstellungen für den Spiegelbetrieb"
# Desktop mit automatischer Anmeldung starten
sudo raspi-config nonint do_boot_behaviour B4
# Bildschirmschoner aus, sonst wird das Bild nach 10 Minuten schwarz
sudo raspi-config nonint do_blanking 1
# 1080p statt 4K ausgeben (wirkt nach dem nächsten Neustart)
CMDLINE=/boot/firmware/cmdline.txt
if [ -f "$CMDLINE" ] && ! grep -q "video=HDMI-A-1" "$CMDLINE"; then
	sudo sed -i '1 s/$/ video=HDMI-A-1:1920x1080@60/' "$CMDLINE"
fi
# Spiegel hängt im Hochformat; mit AUSRICHTUNG=quer oder hoch-links übersteuerbar
bash "$REPO_DIR/scripts/ausrichtung.sh" "${AUSRICHTUNG:-hoch}"

echo "==> MagicMirror² mit pm2 starten"
sudo npm install -g pm2
pm2 delete MagicMirror >/dev/null 2>&1 || true
# Auf dem Pi 3 zeigt Electron kein Bild, dort übernimmt Chromium die Anzeige
ANZEIGE="${ANZEIGE:-}"
if [ -z "$ANZEIGE" ] && grep -q "Raspberry Pi 3" /proc/device-tree/model 2>/dev/null; then
	ANZEIGE=kiosk
fi
if [ "$ANZEIGE" = kiosk ]; then
	bash "$REPO_DIR/scripts/kiosk-modus.sh"
else
	# Per SSH fehlen die Angaben zur Bildschirmsitzung, darum hier ermitteln
	WL_SOCKET="$(ls "$RUNTIME_DIR" 2>/dev/null | grep -m1 -E '^wayland-[0-9]+$' || true)"
	if [ -n "$WL_SOCKET" ]; then
		WAYLAND_DISPLAY="$WL_SOCKET" XDG_RUNTIME_DIR="$RUNTIME_DIR" \
			pm2 start npm --name MagicMirror --cwd "$MM_DIR" -- run start:wayland
	else
		DISPLAY=:0 XAUTHORITY="$HOME/.Xauthority" \
			pm2 start npm --name MagicMirror --cwd "$MM_DIR" -- run start:x11
	fi
	pm2 save
fi

echo "==> Autostart nach der Desktop-Anmeldung"
# Bewusst kein systemd-Dienst: Der würde vor dem Desktop starten und kein Bild finden
mkdir -p "$HOME/.config/autostart"
cat > "$HOME/.config/autostart/magicmirror.desktop" <<EOF
[Desktop Entry]
Type=Application
Name=MagicMirror
Exec=pm2 resurrect
EOF

chmod +x "$REPO_DIR"/scripts/*.sh "$REPO_DIR"/scripts/*.py
echo "==> Fertig. Status: pm2 status | Protokoll: pm2 logs MagicMirror"
echo "    Für die 1080p-Ausgabe einmal neu starten: sudo reboot"
