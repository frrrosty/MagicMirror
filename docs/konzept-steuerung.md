# Konzept: Steuerzentrale mit Zeitplan, Sensor, Gesten und Handy-App

## Ziel

Der Spiegel soll sich im Alltag selbst verwalten und bei Bedarf bequem per Handy steuern lassen:

- **Zeitplan:** Zu festen Zeiten ist der Spiegel sicher an (z. B. morgens beim Bereitmachen) oder sicher aus (nachts).
- **Sensor:** Dazwischen ist er im Standby und wacht auf, sobald jemand davorsteht.
- **Gesten:** Mit der Hand vor dem Sensor lässt sich die Ansicht wechseln, ohne den Spiegel zu berühren.
- **Handy-App:** Zeitplan, Sensor und Ansicht lassen sich per Handy anpassen, dazu die bestehende Pinnwand.

## Grundidee: drei Betriebsarten

Jeder Zeitpunkt der Woche hat genau eine Betriebsart:

| Betriebsart | Verhalten | Typische Zeit |
| --- | --- | --- |
| **An** | TV ist an, egal ob jemand davorsteht | Morgens 6:30 bis 8:00 |
| **Sensor** (Standby) | TV ist aus und geht an, sobald jemand näher als die Schwelle kommt. Nach dem Nachlauf ohne Bewegung wieder aus. | Tagsüber und abends |
| **Aus** (Nachtruhe) | TV bleibt aus, der Sensor wird ignoriert | Nachts |

Der **Wochenplan** besteht pro Wochentag aus Zeitfenstern mit einer Betriebsart. Ausserhalb aller Zeitfenster gilt die **Standard-Betriebsart**, vorgesehen ist «Sensor». Überschneiden sich Fenster, gilt das zuerst eingetragene.

Darüber liegt eine **manuelle Übersteuerung** aus der App, zum Beispiel «Jetzt an für 1 Stunde» oder «Aus bis morgen früh». Sie läuft von selbst ab, danach gilt wieder der Plan.

Vorrang, von oben nach unten:

1. Manuelle Übersteuerung (bis sie abläuft)
2. Zeitfenster aus dem Wochenplan
3. Standard-Betriebsart

## Architektur

```
 Handy (Browser/App)                 Raspberry Pi
 ┌──────────────────┐   WLAN   ┌────────────────────────────────────────────────┐
 │ Spiegel-App      │ ───────► │ App-Server (Port 8081, modules/spiegel-app)    │
 │  · Pinnwand      │          │   /api/pinnwand/…  → MMM-Pinnwand (node_helper) │
 │  · Steuerung     │          │   /api/steuerung/… → MMM-Steuerung (node_helper)│
 └──────────────────┘          │                                                │
                               │ MMM-Steuerung (node_helper)                    │
 Ultraschallsensor ──GPIO──►   │   ◄── sensor.py (Distanz ~10× pro Sekunde)     │
                               │   Logik: Plan + Sensor + Übersteuerung         │
                               │   ──► bildschirm.sh ein/aus (HDMI-CEC) ──► TV  │
                               │   ──► Seitenwechsel ──► Spiegel im Browser     │
                               └────────────────────────────────────────────────┘
```

**Bausteine:**

| Baustein | Aufgabe |
| --- | --- |
| `modules/spiegel-app/server.js` | Gemeinsamer kleiner Webserver für die Handy-App. Module melden ihre Schnittstellen dort an. Änderungen brauchen die PIN aus `secrets.js`. |
| `modules/spiegel-app/app.html` | Die Handy-App mit den Reitern «Pinnwand» und «Steuerung» |
| `modules/MMM-Steuerung/logik.js` | Reine Logik ohne Hardware: Betriebsart zu einem Zeitpunkt, Gestenerkennung. Mit automatischen Tests. |
| `modules/MMM-Steuerung/node_helper.js` | Steuerzentrale: liest den Sensor, entscheidet alle paar Sekunden, schaltet den TV, speichert Einstellungen |
| `modules/MMM-Steuerung/MMM-Steuerung.js` | Auf dem Spiegel: wechselt die Ansicht (Seiten) und zeigt kurz an, welche Seite aktiv ist |
| `scripts/sensor.py` | Misst nur die Distanz und gibt sie fortlaufend aus. Die ganze Auswertung passiert in JavaScript, das lässt sich ohne Hardware testen. |

**Warum der Sensor nur misst:** Gestenerkennung und Anwesenheit sind Logik, die man ohne Sensor testen und verbessern will. Das Python-Skript bleibt damit klein und muss praktisch nie angepasst werden. Kommt später ein anderer Sensor dazu (siehe unten), ändert sich nur dieses eine Skript.

## Ansichten (Seiten)

Der Spiegel bekommt mehrere Seiten. Welche Module auf welcher Seite erscheinen, steht in `config.js` über CSS-Klassen der Module.

| Seite | Inhalt | Wofür |
| --- | --- | --- |
| **Übersicht** | Alles | Normalbetrieb |
| **Woche** | Uhr, aktuelles Wetter, Wochenplan, To-dos | Planung am Abend |
| **Spiegel** | Nur Uhr und allfällige Nachricht | Einfach nur Spiegel |

Nach einer Minute ohne Geste kehrt der Spiegel von selbst zur Übersicht zurück.

## Gesten

### Mit dem vorhandenen Ultraschallsensor

Ein einzelner Ultraschallsensor misst nur eine Distanz. Er kann darum nicht erkennen, ob eine Hand nach links oder rechts wischt. Machbar sind Gesten über die **Nähe**:

| Geste | Bewegung | Wirkung |
| --- | --- | --- |
| **Tippen** | Hand kurz (0,15 bis 1,2 Sekunden) näher als 15 cm vor den Sensor halten und wegziehen | **Alles Unnötige weg** (Seite «Spiegel»), nochmals tippen holt alles zurück |
| **Halten** | Hand mindestens 2 Sekunden nah vor dem Sensor halten | Nächste Seite, z. B. «Woche» |

Die Belegung ist in `config.js` beim Modul `MMM-Steuerung` unter `gestenBelegung` einstellbar.

Wer einfach vor dem Spiegel steht, ist typischerweise 40 cm oder weiter weg und löst keine Geste aus. Die Grenze von 15 cm ist in der App einstellbar.

### Ausbau: echte Wischgesten

Für Wischen nach links, rechts, oben und unten gibt es fertige Gestensensoren. Passend zu deinem Grove-Material zum Beispiel der **Grove Gesture Sensor (PAJ7620U2)**, der 9 Gesten erkennt, für etwa CHF 15. Er misst im Bereich von 5 bis 15 cm und wird über I2C angeschlossen. Die Software ist darauf vorbereitet: Ein zusätzliches Skript meldet dann `links`, `rechts`, `hoch`, `runter`, und die Steuerzentrale ordnet sie Seitenwechseln zu.

**Wichtig für beide Sensoren:** Infrarot und Ultraschall gehen nicht durch die Spiegelscheibe. Die Sensoren gehören in den Rahmen, mit Öffnungen. Beim Gestensensor reicht ein kleines Fenster von etwa 1 cm.

## Handy-App

Eine Web-App, die vom Pi kommt und sich auf dem Handy wie eine App auf den Startbildschirm legen lässt. Zwei Reiter:

**Pinnwand** (wie bisher): To-dos und Nachricht an die Familie.

**Steuerung:**

- **Status:** TV an oder aus, warum (Zeitplan, Sensor, manuell), aktuelle Betriebsart, letzte Messung des Sensors
- **Sofort:** «Jetzt an» (30 Min., 1 Std., 3 Std.), «Jetzt aus» (1 Std., bis morgen), «Automatik» (Übersteuerung aufheben)
- **Ansicht:** Seite direkt wählen
- **Wochenplan:** pro Tag Zeitfenster mit Betriebsart hinzufügen, ändern, löschen; einen Tag auf alle Werktage oder aufs Wochenende kopieren
- **Sensor:** Schwelle für Anwesenheit, Nachlauf, Grenze für Gesten, Gesten ein/aus

## Sicherheit und Robustheit

- Der App-Server ist nur im Heimnetz erreichbar. Lesen geht ohne PIN, alles Ändernde braucht die PIN aus `secrets.js`.
- Einstellungen liegen in `~/.config/magicmirror-steuerung.json` und überleben Neustarts und Updates.
- Zwischen zwei Schaltvorgängen liegen mindestens 15 Sekunden, damit der TV bei wackligen Messungen nicht flackert.
- Fällt der Sensor aus oder ist keiner angeschlossen, verhält sich «Sensor» wie «Aus», und die App zeigt «Sensor fehlt». Zeitplan und App funktionieren weiter.
- Für Tests ohne TV gibt es einen Trockenmodus (`STEUERUNG_TROCKEN=1`), der nur protokolliert statt zu schalten.

## Etappen

| Etappe | Inhalt | Stand |
| --- | --- | --- |
| 1 | Konzept | erledigt |
| 2 | Prototyp: Steuerzentrale, Zeitplan, Sensor, Gesten Tippen/Halten, Seiten, App | dieser Schritt |
| 3 | Sensor anschliessen und Schwellen im Alltag einstellen | nach Prototyp |
| 4 | Gestensensor PAJ7620 für echte Wischgesten | optional |
| 5 | Zugriff von unterwegs (Tailscale) | optional |

## Offene Fragen

- Wo genau sitzt der Sensor im Rahmen (Höhe, Abstand zu den Kindern)?
- Sollen die Kinder den Spiegel per Geste bedienen dürfen, oder stört das eher?
- Braucht es weitere Seiten, zum Beispiel eine «Morgen-Seite» mit Abfahrten und Wetter gross?
