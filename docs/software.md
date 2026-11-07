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
| SSH (Reiter «Dienste») | aktivieren, «Nur Public-Key-Authentifizierung» mit dem eigenen Schlüssel |

Alles auf der Karte wird dabei überschrieben.

Falls auf dem PC noch kein SSH-Schlüssel existiert, vorher einen erzeugen (Windows PowerShell oder Mac/Linux-Terminal, alle Fragen mit Enter bestätigen oder eine Passphrase setzen):

```bash
ssh-keygen -t ed25519
```

Der Imager übernimmt den öffentlichen Schlüssel (`id_ed25519.pub`) danach meist automatisch. Andernfalls den Inhalt dieser Datei ins Feld einfügen. Die Datei ohne `.pub` ist der private Schlüssel und bleibt auf dem PC.

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

## Kein Bild auf dem Pi 3

Läuft der Server (`curl -s localhost:8080` liefert HTML), aber der TV zeigt nur den Desktop, kommt der eingebaute Browser Electron nicht mit dem Grafikchip zurecht. Im Protokoll steht dann `GPU process launch failed`. Abhilfe schafft die Anzeige über Chromium im Kiosk-Modus:

```bash
git -C ~/magicmirror-setup pull
```

```bash
bash ~/magicmirror-setup/scripts/kiosk-modus.sh
```

Danach läuft MagicMirror² nur noch als Server, und Chromium zeigt den Spiegel im Vollbild an, auch nach jedem Neustart.

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

## Zugang von einem weiteren Gerät (z. B. Laptop)

Der Pi akzeptiert nur hinterlegte Schlüssel. Ein neues Gerät muss darum einmal von einem Gerät aus eingetragen werden, das bereits Zugang hat.

1. Auf dem Laptop einen Schlüssel erzeugen, falls `~/.ssh/id_ed25519.pub` noch nicht existiert:

```bash
ssh-keygen -t ed25519 -C "laptop"
```

2. Den öffentlichen Schlüssel des Laptops anzeigen und die ganze Zeile kopieren (sie beginnt mit `ssh-ed25519`), zum Beispiel per Mail an sich selbst oder über OneDrive auf den Desktop bringen:

```bash
cat ~/.ssh/id_ed25519.pub
```

3. Vom **Desktop** aus auf den Pi verbinden und die Zeile anhängen. Den Platzhalter durch die kopierte Zeile ersetzen, die Anführungszeichen bleiben:

```bash
echo "ssh-ed25519 AAAA...laptop" >> ~/.ssh/authorized_keys
```

4. Auf dem Laptop in `~/.ssh/config` den Eintrag ergänzen (Datei bei Bedarf neu anlegen):

```
Host spiegel
    HostName spiegel.local
    User admin
```

Danach verbindet sich der Laptop mit `ssh spiegel`. Nur den öffentlichen Schlüssel (`.pub`) weitergeben, den privaten nie.

## Ausrichtung

Der Spiegel hängt im Hochformat. Das Installationsskript dreht das Bild dauerhaft um 90 Grad. Steht es auf dem Kopf, weil der TV andersherum gedreht wurde, die andere Richtung wählen:

```bash
bash ~/magicmirror-setup/scripts/ausrichtung.sh hoch-links
```

Mit `hoch` geht es zurück, mit `quer` wird das Bild wieder normal. Die Einstellung wirkt sofort und bleibt nach einem Neustart erhalten. Passend dazu steht oben in `config/config.js` die Einstellung `AUSRICHTUNG` (`"hoch"` oder `"quer"`), die das Layout bestimmt.

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
