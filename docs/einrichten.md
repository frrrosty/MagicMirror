# Spiegel einrichten und anpassen

So sieht der Spiegel mit der aktuellen Konfiguration aus (Beispieldaten):

![Vorschau des Spiegels](vorschau.png)

| Bereich | Inhalt |
| --- | --- |
| Oben links | Uhr mit Datum und Kalenderwoche |
| Oben rechts | Aktuelles Wetter in Ermatingen |
| Mitte | Frei fürs Spiegelbild, darunter ein Spruch in Mundart (je nach Tageszeit, Wetter, Feiertag und Geburtstag) |
| Unten links | Die nächsten Stunden und Prognose für fünf Tage |
| Unten rechts | Zug ab Ermatingen, Bus ab Friedhof nach Weinfelden (eigenes Modul `MMM-OeV`), Entsorgung |
| Unten, volle Breite | Wochenplan der Familie für die nächsten sieben Tage (eigenes Modul `MMM-Wochenplan`) |
| Ganz unten | SRF News |

Das Layout ist fürs Hochformat ausgelegt. Mit `AUSRICHTUNG = "quer"` oben in `config/config.js` verteilt es sich automatisch für ein Querformat.

## 1. Neuesten Stand auf den Pi holen

Per SSH auf dem Pi:

```bash
cd ~/magicmirror-setup && git pull
```

Da seit der Installation neue Bestandteile dazugekommen sind (ÖV-Modul, automatischer Kiosk-Modus auf dem Pi 3), einmal das Installationsskript laufen lassen. Diesmal geht es schneller, weil vieles schon da ist:

```bash
bash ~/magicmirror-setup/scripts/install.sh
```

Künftig reicht für Änderungen dieser kurze Befehl:

```bash
bash ~/magicmirror-setup/scripts/update.sh
```

## 2. Persönliche Angaben eintragen

Alles Persönliche steht in `config/secrets.js`. Diese Datei existiert nur auf dem Pi und wird nie ins öffentliche Repository hochgeladen.

```bash
cp ~/magicmirror-setup/config/secrets.example.js ~/magicmirror-setup/config/secrets.js
```

```bash
nano ~/magicmirror-setup/config/secrets.js
```

| Eintrag | Was hinein gehört | Wo man es findet |
| --- | --- | --- |
| `calendars` | ICS-Link des Outlook-Kalenders | Outlook.com: Einstellungen > Kalender > Freigegebene Kalender > Kalender veröffentlichen |
| `geburtstage` | Namen und Daten der Familie | Format `{ name: "Anna", datum: "03-15" }` |
| `entsorgung` | ICS-Link des Abfallkalenders | Website der Gemeinde Ermatingen, Rubrik Entsorgung, nach «Kalender abonnieren» oder «iCal» suchen |
| `gehzeitHaltestelle` | Minuten bis zum Bahnhof | Verbindungen, die man nicht mehr erreicht, werden ausgeblendet |

Danach neu laden:

```bash
pm2 restart MagicMirror
```

## 3. Eigene Note geben

Alles Folgende steht in `config/config.js` und wird am besten am PC bearbeitet, committet und dann mit `update.sh` auf den Pi geholt.

- **Sprüche:** Im Block `sprueche` eigene Sätze ergänzen, zum Beispiel Familienwitze oder Sprüche, die die Kinder lustig finden. Schlüssel wie `"....-12-06"` gelten an einem bestimmten Tag jedes Jahr.
- **Kalendersymbole:** Unter `customEvents` Stichworte und Symbole ergänzen. Enthält ein Termin das Stichwort, erscheint das Symbol. Symbole gibt es unter [fontawesome.com/icons](https://fontawesome.com/search?ic=free).
- **Haltestelle:** `HALTESTELLE` oben in der Datei. Für eine Bushaltestelle den genauen Namen aus dem SBB-Fahrplan verwenden, z. B. `"Ermatingen, Bahnhof"`.
- **Farben und Grössen:** In `config/custom.css`. Hinter dem Spiegel wirkt alles dunkler als am normalen Bildschirm, darum Änderungen immer erst hinter der Scheibe beurteilen.

## Ideen für später

- Thurgauer Schulferien als eigener Kalender
- Wassertemperatur des Bodensees
- Morgens und abends unterschiedliche Module (z. B. Abfahrten nur morgens)
- Anwesenheitssensor, siehe `docs/bewegungssensor.md`
