# Sensor: Anwesenheit und Gesten

Der Spiegel hängt im Durchgangsbereich (Eingang, Treppe, Weg zur Küche). Der Sensor soll darum unterscheiden, ob jemand nur vorbeigeht oder stehen bleibt. Die ganze Auswertung macht die Steuerzentrale `MMM-Steuerung`, siehe [Konzept](konzept-steuerung.md).

## Hardware: Grove Ultrasonic Ranger V2.0

Direkt am GPIO, **ohne** GrovePi+. Die Software des GrovePi+ wird kaum mehr gepflegt, und der Sensor braucht nur eine Signalleitung.

Benötigt wird ein Grove-Kabel mit Buchsen für Steckbrücken (Grove auf Jumper) oder ein Grove-Kabel mit abgeschnittenem Stecker.

| Grove-Ader | Raspberry Pi |
| --- | --- |
| Rot (VCC) | **3,3 V** (Pin 1) |
| Schwarz (GND) | GND (Pin 9) |
| Gelb (SIG) | GPIO 17 (Pin 11) |
| Weiss | nicht verbunden |

**Wichtig:** an 3,3 V, nicht an 5 V. Bei 5 V liefert der Sensor ein 5-Volt-Signal zurück, das den GPIO des Pi beschädigen kann.

### Platzierung

Ultraschall misst nicht durch die Spiegelscheibe. Der Sensor gehört in den Rahmen, mit zwei Bohrungen von je etwa 16 mm, nach vorne gerichtet, auf einer Höhe, auf der er Erwachsene und Kinder erfasst. Für Gesten muss die Hand bequem vor den Sensor passen.

## Software

| Teil | Aufgabe |
| --- | --- |
| `scripts/sensor.py` | Misst etwa 10-mal pro Sekunde die Distanz und gibt sie aus, sonst nichts |
| `modules/MMM-Steuerung` | Startet `sensor.py` selbst, wertet Anwesenheit und Gesten aus, schaltet den TV |

`sensor.py` muss nicht von Hand gestartet werden. Die Steuerung startet es mit MagicMirror² und startet es neu, falls es abbricht. Fehlt der Sensor, läuft alles andere weiter, und die App zeigt «Sensor fehlt».

### Anschluss prüfen

Bevor die Steuerung den Sensor übernimmt, lässt er sich direkt prüfen. Dafür kurz MagicMirror² stoppen, weil nur ein Programm den GPIO lesen kann:

```bash
pm2 stop MagicMirror
```

```bash
python3 ~/magicmirror-setup/scripts/sensor.py --test
```

Die Hand vor dem Sensor bewegen, die angezeigte Distanz sollte folgen. Abbruch mit Ctrl+C, dann wieder starten:

```bash
pm2 start MagicMirror
```

## Regeln für den Durchgangsbereich

| Situation | Verhalten | Einstellung in der App |
| --- | --- | --- |
| Erste Bewegung nach langer Ruhe (z. B. morgens) | Sofort an, auch im Vorbeigehen («Morgengruss») | Morgengruss nach Ruhe von (Std.), Standard 4 |
| Jemand geht vorbei | Bleibt aus | – |
| Jemand bleibt stehen | An | Stehen bleiben (Sekunden), Standard 2 |
| Niemand mehr da | Nach dem Nachlauf aus | Nachlauf (Minuten), Standard 2 |
| Als anwesend gilt | Näher als die Schwelle | Anwesend näher als (cm), Standard 100 |

Diese Regeln gelten nur in der Betriebsart «Sensor». In «An» und «Aus» (Zeitplan oder manuell) wird der Sensor für das Ein- und Ausschalten ignoriert, Gesten funktionieren bei eingeschaltetem TV aber immer.

## Gesten

| Geste | Bewegung | Wirkung |
| --- | --- | --- |
| Tippen | Hand kurz näher als 15 cm vor den Sensor halten und wegziehen | Alles Unnötige weg, nochmals tippen holt alles zurück |
| Halten | Hand 2 Sekunden nah halten | Nächste Ansicht (z. B. «Woche») |

Belegung in `config/config.js` beim Modul `MMM-Steuerung` (`gestenBelegung`), die Grenze für «nah» in der App.
