# Magic Mirror aus einem alten Samsung TV

Ein smarter Spiegel für den Familienalltag: Ein ausgedienter Samsung-Fernseher wird hinter einer Spiegelscheibe montiert und zeigt Uhrzeit, Wetter, Familienkalender und Nachrichten an. Wo der Bildschirm schwarz ist, wirkt die Fläche wie ein normaler Spiegel.

## Grundprinzip

Der Fernseher dient nur noch als Monitor. Die eigentliche Intelligenz liefert ein Raspberry Pi, der per HDMI angeschlossen ist und die Open-Source-Software [MagicMirror²](https://magicmirror.builders) ausführt. Davor sitzt ein teildurchlässiger Spiegel (Spionspiegel), der helle Schrift durchlässt und dunkle Flächen spiegelt.

```
[ Spiegelscheibe ] -> [ Samsung TV ] <-HDMI- [ Raspberry Pi ] <-WLAN-> Internet
                         ^                        |
                         +-------- HDMI-CEC ------+  (TV ein/aus nach Zeitplan)
```

Die Smart-TV-Funktionen von Samsung (Tizen) werden bewusst nicht genutzt. Ältere Modelle erhalten keine Updates mehr, und ein Browser auf dem TV lässt sich kaum zuverlässig im Dauerbetrieb steuern.

## Projektstruktur

| Pfad | Inhalt |
| --- | --- |
| `docs/hardware.md` | Einkaufsliste, Vorbereitung des TVs, Rahmenbau, Sicherheit |
| `docs/software.md` | Installation von Raspberry Pi OS und MagicMirror² |
| `config/config.js` | MagicMirror²-Konfiguration (Deutsch, Standort Ermatingen) |
| `config/custom.css` | Anpassungen am Erscheinungsbild für Spiegelbetrieb |
| `scripts/install.sh` | Automatisierte Installation auf dem Raspberry Pi |
| `scripts/bildschirm.sh` | TV per HDMI-CEC ein- und ausschalten |
| `scripts/crontab.txt` | Zeitplan für das automatische Ein- und Ausschalten |

## Vorgehen in Etappen

1. **Software testen:** MagicMirror² zuerst am normalen Fernseher ohne Spiegel einrichten. So lassen sich Module und Layout bequem ausprobieren.
2. **TV prüfen:** Gewicht, Tiefe, Anschlüsse und Stromverbrauch des Geräts festhalten (siehe `docs/hardware.md`).
3. **Spiegel und Rahmen:** Erst bestellen, wenn die genauen Masse des Panels bekannt sind.
4. **Montage und Dauerbetrieb:** Zeitplan, Belüftung und Kabelführung abschliessen.

## Offene Punkte

Diese Angaben fehlen noch und beeinflussen die weitere Planung:

- Genaue Modellbezeichnung des Samsung TVs (Typenschild auf der Rückseite, z. B. `UE40D5000`)
- Gewünschter Standort (Flur, Küche, Badezimmer?) und Ausrichtung (hoch oder quer)
- Welcher Familienkalender soll angezeigt werden (Google, iCloud, Outlook)?
