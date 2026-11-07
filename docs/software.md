# Software

Die ganze Einrichtung läuft vom Desktop-PC aus per SSH. Am Pi braucht es weder Tastatur noch Maus, nur HDMI zum TV, Strom und Netzwerk.

## 1. SD-Karte vorbereiten (am PC)

Mit dem [Raspberry Pi Imager](https://www.raspberrypi.com/software/) auswählen: Gerät «Raspberry Pi 3», Betriebssystem «Raspberry Pi OS (64-bit)» **mit Desktop** (nicht Lite). Bei der Frage nach angepassten Einstellungen «Ja» wählen und eintragen:

| Einstellung | Wert |
| --- | --- |
| Hostname | `spiegel` |
| Benutzer und Passwort | frei wählbar |
| WLAN | Netzname und Passwort (Pi 3 kann nur 2,4 GHz) |
| Zeitzone / Tastatur | Europe/Zurich / ch |
| SSH (Reiter «Dienste») | aktivieren, Anmeldung mit Passwort |

Alles auf der Karte wird dabei überschrieben.

## 2. Verbinden (am PC)

Karte in den Pi, HDMI an den TV, Strom anschliessen. Nach zwei bis drei Minuten vom PC aus (Windows: PowerShell, Mac/Linux: Terminal) verbinden, Benutzername anpassen:

```bash
ssh deinbenutzer@spiegel.local
```

Klappt `spiegel.local` nicht, im Router nach der IP-Adresse des Geräts «spiegel» suchen und stattdessen diese verwenden.

## 3. Installieren (per SSH)

```bash
git clone https://github.com/frrrosty/MagicMirror.git ~/magicmirror-setup
```

```bash
bash ~/magicmirror-setup/scripts/install.sh
```

Das dauert auf dem Pi 3 etwa 20 bis 40 Minuten. Das Skript installiert Node.js und MagicMirror², verlinkt die Konfiguration, schaltet den Bildschirmschoner aus, stellt die Ausgabe auf 1080p und richtet den Autostart ein. Wichtig: Der Desktop muss auf dem TV angemeldet sein, was nach dem ersten Start automatisch der Fall ist. Zum Schluss einmal neu starten:

```bash
sudo reboot
```

Nach dem Neustart sollte der Spiegel von selbst auf dem TV erscheinen.

## Alltag per SSH

Status und Fehlermeldungen anzeigen:

```bash
pm2 status
```

```bash
pm2 logs MagicMirror
```

Konfiguration bearbeiten (speichern mit Ctrl+O, beenden mit Ctrl+X) und danach neu laden:

```bash
nano ~/magicmirror-setup/config/config.js
```

```bash
pm2 restart MagicMirror
```

Neue Version dieses Repositorys holen:

```bash
cd ~/magicmirror-setup && git pull && pm2 restart MagicMirror
```

Bequemer geht das Bearbeiten mit Visual Studio Code und der Erweiterung «Remote - SSH». Damit öffnest du den Ordner auf dem Pi direkt im Editor am PC.

## Ausrichtung (falls Hochformat)

Solange Hoch- oder Querformat nicht entschieden ist, bleibt das Bild quer. Für einen Test im Hochformat per SSH:

```bash
WAYLAND_DISPLAY=wayland-0 XDG_RUNTIME_DIR=/run/user/$(id -u) wlr-randr --output HDMI-A-1 --transform 90
```

Das gilt nur bis zum nächsten Neustart. Die dauerhafte Einstellung richten wir ein, sobald der Entscheid gefallen ist.

## 4. TV automatisch ein- und ausschalten

Das Skript `scripts/bildschirm.sh` steuert den Samsung TV über HDMI-CEC:

```bash
~/magicmirror-setup/scripts/bildschirm.sh aus
```

```bash
~/magicmirror-setup/scripts/bildschirm.sh ein
```

Funktioniert das, kann der Zeitplan aus `scripts/crontab.txt` übernommen werden:

```bash
crontab ~/magicmirror-setup/scripts/crontab.txt
```

Reagiert der TV nicht, ist meist Anynet+ im TV-Menü ausgeschaltet. Als Rückfallebene kann das Skript stattdessen nur das HDMI-Signal abschalten. Viele Samsung-Geräte gehen dann nach einigen Minuten selbst in den Standby.

## 5. Kalender einbinden

Für den Familienkalender wird eine ICS-Adresse benötigt. Unser Kalender liegt bei Outlook.com (Hotmail):

1. Auf [outlook.live.com](https://outlook.live.com) mit dem Konto anmelden, dem der Kalender gehört.
2. *Einstellungen (Zahnrad) > Kalender > Freigegebene Kalender > Kalender veröffentlichen*
3. Kalender auswählen, Berechtigung «Kann alle Details anzeigen» und *Veröffentlichen* klicken.
4. Den **ICS-Link** kopieren (nicht den HTML-Link).

Ein Kalender, der nur mit einem anderen Konto geteilt wurde, lässt sich so nicht abonnieren. Die Veröffentlichung muss die Person vornehmen, der der Kalender gehört. Bei mehreren Kalendern (z. B. je einer pro Elternteil) wird jeder einzeln veröffentlicht und eingetragen. Outlook aktualisiert veröffentlichte Kalender mit etwas Verzögerung, neue Termine erscheinen darum nicht sofort.

Solche Links sind wie Passwörter zu behandeln und dürfen nicht in dieses öffentliche Repository gelangen. Darum liest die Konfiguration sie aus der Datei `config/secrets.js`, die per `.gitignore` ausgeschlossen ist und nur auf dem Pi existiert. Per SSH anlegen und den ICS-Link eintragen:

```bash
cp ~/magicmirror-setup/config/secrets.example.js ~/magicmirror-setup/config/secrets.js
```

```bash
nano ~/magicmirror-setup/config/secrets.js
```

```bash
pm2 restart MagicMirror
```
