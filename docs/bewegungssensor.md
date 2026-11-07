# Anwesenheitssensor

Der TV soll nur laufen, wenn jemand vor dem Spiegel steht. Das spart den grössten Teil des Stroms.

## Unsere Lösung: Grove Ultrasonic Ranger V2.0

Vorhanden aus einem früheren Projekt, kostet also nichts. Ein Distanzsensor hat gegenüber einem Bewegungsmelder einen Vorteil: Er löst erst aus, wenn jemand näher als etwa einen Meter vor dem Spiegel steht. Wer nur vorbeigeht, schaltet den TV nicht ein.

### Ohne GrovePi+

Das vorhandene GrovePi+ wird bewusst **nicht** verwendet:

- Auf dem GrovePi+ sitzt ein eigener Mikrocontroller, mit dem der Pi über I2C spricht. Die Software dazu (Dexter Industries) wird seit Jahren kaum mehr gepflegt und lässt sich auf aktuellem Raspberry Pi OS nur mit Mühe installieren.
- Der Ultraschallsensor braucht nur ein einziges Signalkabel. Direkt am GPIO angeschlossen ist er einfacher und robuster.

### Anschluss

Benötigt wird ein Grove-Kabel mit Buchsen für Steckbrücken auf der anderen Seite (Grove auf Jumper), oder ein Grove-Kabel, bei dem man den Stecker abschneidet.

| Grove-Ader | Raspberry Pi |
| --- | --- |
| Rot (VCC) | **3,3 V** (Pin 1) |
| Schwarz (GND) | GND (Pin 9) |
| Gelb (SIG) | GPIO 17 (Pin 11) |
| Weiss | nicht verbunden |

**Wichtig:** Den Sensor an 3,3 V betreiben, nicht an 5 V. Bei 5 V liefert er auch ein 5-Volt-Signal zurück, und das beschädigt den GPIO des Pi. Der V2.0 ist für 3,2 bis 5,2 V ausgelegt, bei 3,3 V ist die Reichweite etwas geringer, für einen Spiegel aber mehr als ausreichend.

### Platzierung

Ultraschall misst **nicht durch die Spiegelscheibe**, der Schall prallt am Glas ab. Der Sensor gehört in den unteren Teil des Rahmens, mit zwei Bohrungen von je etwa 16 mm für die beiden Schallwandler. Er sollte nach vorne schauen, leicht nach oben geneigt, damit er Erwachsene und Kinder erfasst.

## Software

Das Skript `scripts/anwesenheit.py` misst zweimal pro Sekunde, nimmt jeweils den Median aus drei Messungen und schaltet den TV über `scripts/bildschirm.sh` ein und aus.

Zuerst den Sensor testen (Abbruch mit Ctrl+C):

```bash
python3 ~/magicmirror-setup/scripts/anwesenheit.py --test
```

Die Hand vor dem Sensor bewegen, die Distanz sollte sich entsprechend ändern. Funktioniert das, als Dienst mit pm2 starten:

```bash
pm2 start ~/magicmirror-setup/scripts/anwesenheit.py --name Anwesenheit --interpreter python3
```

```bash
pm2 save
```

Damit startet der Sensor nach jedem Neustart automatisch mit, gleich wie MagicMirror².

### Einstellungen

| Variable | Standard | Bedeutung |
| --- | --- | --- |
| `SCHWELLE_CM` | 100 | Näher als diese Distanz gilt als anwesend |
| `NACHLAUF_S` | 120 | Sekunden, die der TV nach der letzten Erkennung an bleibt |
| `RUHEZEIT` | 22-6 | In diesen Stunden schaltet der Sensor den TV nicht ein |
| `SENSOR_PIN` | 17 | GPIO-Nummer der Signalleitung |

Anpassen beim Start, zum Beispiel:

```bash
SCHWELLE_CM=80 NACHLAUF_S=180 pm2 start ~/magicmirror-setup/scripts/anwesenheit.py --name Anwesenheit --interpreter python3
```

### Verhältnis zum Zeitplan

Mit dem Sensor braucht es den Zeitplan aus `scripts/crontab.txt` nicht mehr. Die Ruhezeit übernimmt dessen Aufgabe in der Nacht. Beides gleichzeitig zu betreiben, führt dazu, dass sich Sensor und Zeitplan gegenseitig übersteuern.

### Zu beachten

Das Ein- und Ausschalten per HDMI-CEC dauert beim Samsung jeweils einige Sekunden. Wer vor den Spiegel tritt, wartet also kurz, bis das Bild erscheint. Ist das störend, kann der Nachlauf verlängert werden, damit der TV seltener ganz ausschaltet.
