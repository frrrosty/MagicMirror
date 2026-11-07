# Checkliste: Steuerzentrale in Betrieb nehmen und Sensor testen

Alles per SSH (`ssh spiegel`), in dieser Reihenfolge. Dauer etwa 30 Minuten.

## 1. Neuen Stand holen

```bash
cd ~/magicmirror-setup && git pull
```

```bash
bash ~/magicmirror-setup/scripts/update.sh
```

Der Spiegel sieht danach aus wie bisher, neu erscheint beim Seitenwechsel kurz der Name der Ansicht oben in der Mitte.

## 2. PIN prüfen

Die App braucht jetzt die PIN auch zum Lesen. Ohne PIN in `secrets.js` bleibt sie gesperrt.

```bash
grep pinnwandPin ~/magicmirror-setup/config/secrets.js
```

Steht dort keine Zeile, PIN setzen (`1451` durch eigene ersetzen):

```bash
sed -i 's/^module.exports = {/module.exports = {\n\tpinnwandPin: "1451",/' ~/magicmirror-setup/config/secrets.js && pm2 restart MagicMirror
```

## 3. App auf dem Handy

Adresse wie bisher, die Pinnwand-Seite ist jetzt die neue App mit zwei Reitern:

```
http://192.168.1.125:8081
```

- Reiter **Pinnwand:** To-dos, Nachricht, neu **Sprüche und Erinnerungen**
- Reiter **Steuerung:** Status, Sofort an/aus, Ansicht, Wochenplan, Sensor

Am besten gleich «Zum Startbildschirm hinzufügen».

Im Reiter Steuerung steht jetzt «Sensor: keine Messung». Das ist richtig, solange kein Sensor dran ist. Im Sensorbetrieb bleibt der TV dann aus, Zeitplan und «Sofort» funktionieren aber.

## 4. Sensor anschliessen

Pi herunterfahren, bevor etwas an die Stiftleiste kommt:

```bash
sudo shutdown -h now
```

Anschluss gemäss [Sensor-Dokumentation](bewegungssensor.md): Rot an **3,3 V** (Pin 1), Schwarz an GND (Pin 9), Gelb an GPIO 17 (Pin 11). Dann Pi wieder einschalten.

## 5. Sensor direkt prüfen

```bash
pm2 stop MagicMirror
```

```bash
python3 ~/magicmirror-setup/scripts/sensor.py --test
```

Hand vor dem Sensor bewegen, die Zahlen sollten folgen (z. B. 12 cm, 45 cm, 120 cm). Ctrl+C, dann:

```bash
pm2 start MagicMirror
```

## 6. Steuerung testen

In der App, Reiter Steuerung:

1. **Sensorwert:** Unter dem Status steht «Sensor: … cm», und der Wert ändert sich mit der Hand.
2. **Gesten** (der Spiegel muss an sein, sonst «Sofort: An»): Hand kurz vor den Sensor und weg, alles verschwindet bis auf Uhr und Spruch. Nochmals, alles ist zurück. Hand 2 Sekunden halten, Ansicht «Woche».
3. **Sensorbetrieb:** «Sofort: Automatik» drücken. Wenn gerade kein Zeitfenster gilt, arbeitet der Spiegel im Sensorbetrieb: weggehen, nach dem Nachlauf (2 Min.) geht der TV aus. Kurz vorbeigehen: bleibt aus. Stehen bleiben: nach 2 Sekunden an.
4. **Wochenplan:** eure Zeiten eintragen und speichern.

Falls etwas klemmt:

```bash
pm2 logs MagicMirror --lines 100 --nostream | grep -E "Steuerung|Sensor|Geste|TV "
```

## 7. Zugriff von unterwegs (wenn gewünscht)

Einmalig ein kostenloses Konto bei [Tailscale](https://tailscale.com) anlegen, dann auf dem Pi:

```bash
bash ~/magicmirror-setup/scripts/fernzugriff.sh
```

Auf den Handys die Tailscale-App installieren und mit demselben Konto anmelden. Die App ist danach unter der angezeigten `https://spiegel….ts.net`-Adresse überall erreichbar, verschlüsselt und nur für eure Geräte. **Niemals** «tailscale funnel» verwenden, das würde die App ins offene Internet stellen.
