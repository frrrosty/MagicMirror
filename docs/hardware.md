# Hardware

## Einkaufsliste

| Teil | Empfehlung | Bemerkung |
| --- | --- | --- |
| Rechner | Vorhandener Raspberry Pi 3 | siehe Abschnitt «Welcher Raspberry Pi?» |
| Netzteil | Offizielles Micro-USB-Netzteil 2,5 A | Billignetzteile führen zu Abstürzen |
| Speicher | microSD 32 GB, Markenprodukt (A1/A2) | |
| Kabel | HDMI, möglichst kurz | Pi 3 hat einen normalen HDMI-Anschluss |
| Spiegel | Spionspiegel aus Glas oder Acryl | siehe Abschnitt «Spiegelscheibe» |
| Rahmen | Holzrahmen aus Leisten, Tiefe nach TV | siehe Abschnitt «Rahmen» |
| Kleinteile | Steckdosenleiste, Kabelkanal, Schrauben, Filzstreifen | |

## Welcher Raspberry Pi?

| Modell | RAM | Eignung |
| --- | --- | --- |
| Pi Zero 2 W | 512 MB | Knapp. MagicMirror² läuft im Browser (Electron bzw. Chromium), und 512 MB reichen dafür kaum. Ruckeln und Abstürze sind wahrscheinlich. |
| Pi 3 | 1 GB | Ausreichend bei 1080p und einer überschaubaren Anzahl Module. Vorhanden, kostet nichts. |
| Pi 4 / Pi 5 | 2 GB und mehr | Komfortabel, aber für einen Spiegel überdimensioniert. |

Entscheid: Wir starten mit dem vorhandenen **Pi 3** und installieren Raspberry Pi OS **64-bit**. Erst wenn er sich als zu langsam erweist, lohnt sich eine Neuanschaffung. Ein Pi Zero 2 W wäre dann nicht die richtige Wahl, eher ein Pi 4 mit 2 GB.

## Den Samsung TV prüfen

Bevor Geld in Spiegel und Rahmen fliesst, lohnt sich eine nüchterne Bestandesaufnahme:

- **Modellnummer** vom Typenschild notieren. Daraus lassen sich Panelmasse, Gewicht und Leistungsaufnahme ableiten.
- **Bildtechnik:** LED/LCD-Geräte eignen sich gut. Alte Plasma-Geräte sind schwer, werden heiss, brauchen viel Strom und neigen zu eingebranntem Bild. Davon würde ich abraten.
- **Gewicht und Tiefe:** Ein 40-Zoll-TV mit Glasspiegel wiegt schnell über 20 kg. Die Wand muss das tragen können.
- **Stromverbrauch:** Bei 80 W und 16 Stunden Betrieb täglich sind es rund 470 kWh pro Jahr. Ein Zeitplan, der den TV nachts und tagsüber bei Abwesenheit ausschaltet, ist darum Pflicht.
- **HDMI-CEC (Anynet+):** Im TV-Menü unter *System > Anynet+ (HDMI-CEC)* aktivieren. Damit kann der Raspberry Pi den Fernseher ein- und ausschalten.

### Empfohlene TV-Einstellungen

- Bildmodus «Film» oder «Standard», Hintergrundbeleuchtung so hell wie nötig
- Öko-Sensor und automatische Abschaltung (Auto-Power-Off, Timer) deaktivieren
- Bildformat auf «An Bildschirm anpassen» bzw. «Screen Fit», sonst wird der Rand abgeschnitten
- Eingangsname des HDMI-Anschlusses auf «PC» setzen, das reduziert Verzögerung und Nachbearbeitung

## Gehäuse öffnen oder nicht?

Viele Anleitungen zeigen, wie man das Kunststoffgehäuse entfernt, um den Spiegel bündiger zu montieren. Das spart Tiefe, bringt aber Risiken: Netzteilplatine mit Netzspannung liegt offen, Garantie und Typenprüfung sind hinfällig und das Panel ist sehr bruchempfindlich. Für eine erste Version empfehle ich, den TV im Gehäuse zu belassen und den Rahmen entsprechend tiefer zu bauen. Bei Kindern im Haushalt ist ein geschlossenes Gerät ohnehin die sicherere Wahl.

## Spiegelscheibe

| Variante | Vorteile | Nachteile |
| --- | --- | --- |
| Spionspiegelglas | Sehr gute Spiegelung, kratzfest, verzerrt nicht | Schwer, teurer, bruchgefährdet |
| Spionspiegel-Acryl | Leicht, bruchsicher | Kann sich wölben und verzerrt dann das Spiegelbild |
| Spiegelfolie auf Glas | Günstig | Blasen und Kratzer, wirkt selten hochwertig |

Für Haushalte mit Kleinkindern spricht viel für Acryl mit mindestens 3 mm Stärke. Wenn das Budget es zulässt, ist Glas optisch klar besser. Die Scheibe sollte rund 5 bis 10 cm grösser als die sichtbare Bildfläche sein, damit ein Spiegelrand bleibt.

Wichtig: Die Fläche hinter dem Spiegel, die nicht vom Bildschirm abgedeckt ist, muss mit schwarzem Karton oder matter Folie abgeklebt werden. Sonst scheint Licht durch und der Spiegeleffekt geht verloren.

## Wandmontage an Backstein

Backstein trägt die rund 30 kg gut, solange die Dübel passen. In der Schweiz sind die meisten Backsteine Lochziegel mit Hohlkammern. Darauf ist zu achten:

- Bohrhammer bzw. Schlagfunktion **ausschalten**, sonst brechen die dünnen Stege zwischen den Kammern und der Dübel findet keinen Halt
- Lange Dübel für Lochsteine verwenden (z. B. Fischer DuoPower 10 × 80 mm), bei Unsicherheit Injektionsmörtel mit Siebhülse
- Der Dübel muss im Stein sitzen, nicht im Verputz: Verputzdicke beim Bohren prüfen und Dübel entsprechend länger wählen
- Vorher mit einem Leitungssucher prüfen, besonders senkrecht und waagrecht über Steckdosen und Schaltern
- Alle vier VESA-Punkte der Wandhalterung nutzen und die Traglast der Halterung beachten
- Der Spiegelrahmen bekommt eigene Befestigungspunkte, zum Beispiel eine Aufhängeleiste (French Cleat)

## Rahmen

- Holzleisten so wählen, dass Spiegel, TV und Kabel Platz finden (Tiefe des TVs plus etwa 3 cm)
- Lüftungsschlitze oben und unten einplanen, damit warme Luft abziehen kann
- Den TV mit der VESA-Halterung an der Wand befestigen und den Rahmen davor setzen, statt das ganze Gewicht am Rahmen aufzuhängen
- Raspberry Pi mit Klett oder Halterung an der TV-Rückseite fixieren, nicht lose hängen lassen
