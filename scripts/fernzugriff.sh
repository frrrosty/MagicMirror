#!/usr/bin/env bash
# Richtet Tailscale ein: ein privates, verschlüsseltes Netz zwischen Pi und Handys.
# Danach ist die Spiegel-App auch unterwegs erreichbar, ohne Port im Router zu öffnen.
# Zusätzlich stellt «tailscale serve» die App unter einer https-Adresse bereit.
set -euo pipefail

if ! command -v tailscale >/dev/null; then
	echo "==> Tailscale installieren"
	curl -fsSL https://tailscale.com/install.sh | sh
fi

echo "==> Pi im eigenen Tailscale-Netz anmelden"
echo "    Es erscheint ein Link: im Browser öffnen und mit dem Tailscale-Konto bestätigen."
sudo tailscale up --hostname=spiegel

echo "==> Spiegel-App verschlüsselt im Tailscale-Netz bereitstellen"
sudo tailscale serve --bg 8081

echo "==> Fertig. Adressen der App:"
sudo tailscale serve status
echo "    Auf den Handys die Tailscale-App installieren und mit demselben Konto anmelden."
