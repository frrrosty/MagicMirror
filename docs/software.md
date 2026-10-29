# Software

## 1. Raspberry Pi OS vorbereiten

1. Mit dem [Raspberry Pi Imager](https://www.raspberrypi.com/software/) «Raspberry Pi OS (64-bit)» mit Desktop auf die microSD-Karte schreiben.
2. Im Imager unter «Einstellungen» bereits Hostname (z. B. `spiegel`), Benutzer, WLAN, Zeitzone `Europe/Zurich` und SSH aktivieren.
3. Karte einsetzen, Pi per HDMI am Samsung TV anschliessen und starten.
4. Per SSH verbinden:

```bash
ssh pi@spiegel.local
```

## 2. Dieses Repository und MagicMirror² installieren

```bash
git clone https://github.com/frrrosty/MagicMirror.git ~/magicmirror-setup
```

```bash
bash ~/magicmirror-setup/scripts/install.sh
```

Das Skript installiert Node.js, lädt MagicMirror² nach `~/MagicMirror`, verlinkt die Konfiguration aus diesem Repository und richtet den Autostart mit `pm2` ein. Änderungen an `config/config.js` werden danach mit einem Neustart aktiv:

```bash
pm2 restart MagicMirror
```

## 3. Bildschirm drehen (bei Hochformat)

Unter Raspberry Pi OS Bookworm: *Einstellungen > Screen Configuration*, Ausgang `HDMI-A-1` anklicken und unter *Orientation* «left» oder «right» wählen. Ein Fernseher im Hochformat sollte vorher auf Eignung geprüft werden, da nicht jeder Standfuss bzw. jede VESA-Halterung dafür gedacht ist.

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

Für den Familienkalender wird die private iCal-Adresse benötigt:

- **Google Kalender:** Einstellungen > Kalender auswählen > «Privatadresse im iCal-Format»
- **iCloud:** Kalender freigeben > «Öffentlicher Kalender» (Achtung: Link ist dann für alle mit der Adresse lesbar)

Die Adresse wird in `config/config.js` beim Modul `calendar` eingetragen. Solche Links sind wie Passwörter zu behandeln und sollten nicht in einem öffentlichen Repository landen. Darum liest die Konfiguration sie aus der Datei `config/secrets.js`, die per `.gitignore` ausgeschlossen ist. Eine Vorlage liegt unter `config/secrets.example.js`.
