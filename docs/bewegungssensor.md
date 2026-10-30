# Bewegungssensor

Der TV soll nur laufen, wenn jemand davor steht. Das spart den grössten Teil des Stroms. Der Zeitplan in `scripts/crontab.txt` bleibt als Rahmen bestehen (z. B. nachts nie einschalten).

## Sensorwahl

| Sensor | Prinzip | Preis | Bemerkung |
| --- | --- | --- | --- |
| HC-SR501 | Passiv-Infrarot (PIR) | ca. CHF 5 | Klassiker, sieht aber **nicht durch Glas oder Acryl** |
| AM312 | PIR, Miniatur | ca. CHF 5 | Klein, gut in den Rahmen einzulassen, gleiche Einschränkung |
| HLK-LD2410C | Radar 24 GHz | ca. CHF 5 bis 10 | Erkennt auch ruhig stehende Personen, Reichweite einstellbar |

**Wichtig:** Ein PIR-Sensor hinter der Spiegelscheibe funktioniert nicht, weil Glas die Wärmestrahlung blockiert. Auch Radar wird durch die metallische Beschichtung des Spionspiegels stark gedämpft. Der Sensor gehört darum in den Holzrahmen, mit einer kleinen Bohrung (PIR) oder verdeckt hinter dünnem Holz (Radar).

Empfehlung: **LD2410C** im unteren Rahmenteil. Er schaltet nicht ab, während man still vor dem Spiegel steht und sich die Zähne putzt, was bei PIR-Sensoren ein bekanntes Ärgernis ist.

## Anschluss am Raspberry Pi

| Sensor-Pin | Raspberry Pi |
| --- | --- |
| VCC | 5 V (Pin 2) |
| GND | GND (Pin 6) |
| OUT | GPIO 17 (Pin 11) |

Der Ausgang beider Sensortypen liefert 3,3 V und kann direkt an den GPIO.

## Software

Für MagicMirror² gibt es das Modul [MMM-Pir](https://github.com/bugsounet/MMM-Pir). Es liest den Sensor aus und schaltet nach einer einstellbaren Zeit ohne Bewegung den Bildschirm ab. Einbau und Konfiguration folgen, sobald der Spiegel mit dem Pi grundsätzlich läuft. Zu prüfen ist dann, ob sich das Modul mit unserer CEC-Steuerung in `scripts/bildschirm.sh` verträgt. Häufiges Ein- und Ausschalten per CEC dauert beim Samsung jeweils einige Sekunden, eventuell ist das reine Abschalten des HDMI-Signals angenehmer.
