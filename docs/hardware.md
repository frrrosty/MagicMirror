# Hardware

## Einkaufsliste

| Teil | Empfehlung | Bemerkung |
| --- | --- | --- |
| Rechner | Raspberry Pi 4 (2 GB) oder Raspberry Pi 5 | Pi 4 reicht, wird weniger warm |
| Netzteil | Offizielles USB-C-Netzteil | Billignetzteile führen zu Abstürzen |
| Speicher | microSD 32 GB, Markenprodukt (A1/A2) | Alternativ SSD per USB für mehr Langlebigkeit |
| Kabel | Micro-HDMI auf HDMI, möglichst kurz | Pi 4 und 5 haben Micro-HDMI |
| Spiegel | Spionspiegel aus Glas oder Acryl | siehe Abschnitt «Spiegelscheibe» |
| Rahmen | Holzrahmen aus Leisten, Tiefe nach TV | siehe Abschnitt «Rahmen» |
| Kleinteile | Steckdosenleiste, Kabelkanal, Schrauben, Filzstreifen | |

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

## Rahmen

- Holzleisten so wählen, dass Spiegel, TV und Kabel Platz finden (Tiefe des TVs plus etwa 3 cm)
- Lüftungsschlitze oben und unten einplanen, damit warme Luft abziehen kann
- Den TV mit der VESA-Halterung an der Wand befestigen und den Rahmen davor setzen, statt das ganze Gewicht am Rahmen aufzuhängen
- Raspberry Pi mit Klett oder Halterung an der TV-Rückseite fixieren, nicht lose hängen lassen
