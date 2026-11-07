#!/usr/bin/env python3
"""Regenradar von MeteoSchweiz (Open Government Data) für den Spiegel.

Holt die neuesten PRECIP-Kompositbilder (rzc, alle 5 Minuten, 1 km Auflösung),
schneidet den Bereich um den Standort aus und rendert transparente PNG-Bilder.
Dazu eine abgedunkelte Landeskarte von swisstopo im selben Koordinatensystem
(LV95), darum passen Radar und Karte ohne Umrechnung übereinander.

Aufruf: radar.py AUSGABEORDNER E N BREITE_KM HOEHE_KM BREITE_PX HOEHE_PX ANZAHL
Ergebnis: AUSGABEORDNER/meta.json, karte.png und frame-*.png
Quellen: MeteoSchweiz (CC BY), swisstopo
"""
import datetime as dt
import io
import json
import sys
import urllib.request
from pathlib import Path

import h5py
import numpy as np
from PIL import Image, ImageFilter

STAC = "https://data.geo.admin.ch/api/stac/v1/collections/ch.meteoschweiz.ogd-radar-precip/items/{tag}-ch"
WMS = ("https://wms.geo.admin.ch/?SERVICE=WMS&VERSION=1.3.0&REQUEST=GetMap"
       "&LAYERS={ebene}&STYLES=&CRS=EPSG:2056&TRANSPARENT=true"
       "&BBOX={e0},{n0},{e1},{n1}&WIDTH={w}&HEIGHT={h}&FORMAT=image/png")

# Raster des Schweizer Radarkomposits (CCS4) in LV95, erste Zeile = Norden
RASTER_E0 = 2255000
RASTER_N_OBEN = 1480000
ZELLE_M = 1000

# Niederschlag in mm/h und Farbe (RGBA), angelehnt an die üblichen Radarfarben
STUFEN = [
	(0.1, (130, 180, 255, 130)),
	(0.5, (70, 130, 255, 165)),
	(1.0, (40, 190, 210, 185)),
	(2.0, (60, 200, 90, 200)),
	(4.0, (240, 225, 60, 210)),
	(8.0, (255, 150, 40, 220)),
	(16.0, (240, 60, 40, 230)),
	(32.0, (200, 70, 210, 240)),
]


def laden(url, ziel=None, timeout=60):
	with urllib.request.urlopen(url, timeout=timeout) as antwort:
		daten = antwort.read()
	if ziel:
		Path(ziel).write_bytes(daten)
	return daten


def neueste_dateien(anzahl):
	"""Namen und Adressen der neuesten rzc-Dateien, über Mitternacht (UTC) hinweg."""
	heute = dt.datetime.now(dt.timezone.utc).date()
	gefunden = []
	for tag in (heute, heute - dt.timedelta(days=1)):
		try:
			item = json.loads(laden(STAC.format(tag=tag.strftime("%Y%m%d"))))
		except Exception:
			continue
		for name, asset in item.get("assets", {}).items():
			if name.startswith("rzc") and name.endswith(".001.h5"):
				gefunden.append((name, asset["href"]))
		if len(gefunden) >= anzahl:
			break
	# Dateiname enthält Jahr, Tag im Jahr und Uhrzeit, sortiert also zeitlich
	return sorted(set(gefunden))[-anzahl:]


def zeitpunkt(datei):
	with h5py.File(datei) as f:
		what = f["what"].attrs
		text = what["date"].decode() + what["time"].decode()
	return int(dt.datetime.strptime(text, "%Y%m%d%H%M%S").replace(tzinfo=dt.timezone.utc).timestamp())


def rendern(datei, ziel, ausschnitt, groesse):
	e0, n0, e1, n1 = ausschnitt
	with h5py.File(datei) as f:
		daten = f["dataset1/data1/data"][:]
	z0 = (RASTER_N_OBEN - n1) // ZELLE_M
	z1 = (RASTER_N_OBEN - n0) // ZELLE_M
	s0 = (e0 - RASTER_E0) // ZELLE_M
	s1 = (e1 - RASTER_E0) // ZELLE_M
	feld = np.nan_to_num(daten[z0:z1, s0:s1].astype("float32"), nan=0.0)
	# Weich vergrössern, damit die 1-km-Zellen nicht als Klötze erscheinen
	gross = np.asarray(Image.fromarray(feld, mode="F").resize(groesse, Image.BILINEAR))
	bild = np.zeros((groesse[1], groesse[0], 4), dtype=np.uint8)
	for grenze, farbe in STUFEN:
		bild[gross >= grenze] = farbe
	Image.fromarray(bild, "RGBA").save(ziel, optimize=True)


def wms_bild(ebene, ausschnitt, groesse):
	e0, n0, e1, n1 = ausschnitt
	url = WMS.format(ebene=ebene, e0=e0, n0=n0, e1=e1, n1=n1, w=groesse[0], h=groesse[1])
	return Image.open(io.BytesIO(laden(url)))


def seen_maske(ausschnitt, groesse):
	"""Deckung der Seeflächen (0 bis 1). Die Gewässer von swisstopo enthalten den ganzen
	Bodensee, aber auch alle Bäche: Ein Öffnen (erst schmälern, dann verbreitern) entfernt
	die dünnen Linien. Die Seen des BAFU ergänzen kleine Schweizer Seen in voller Form."""
	maske = np.zeros((groesse[1], groesse[0]), dtype="float32")
	try:
		gewaesser = wms_bild("ch.swisstopo.vec200-hydrography", ausschnitt, groesse).convert("RGBA").split()[3]
		flaechen = gewaesser.filter(ImageFilter.MinFilter(5)).filter(ImageFilter.MaxFilter(5))
		maske = np.maximum(maske, np.asarray(flaechen, dtype="float32") / 255)
	except Exception as fehler:
		print(f"Gewässer nicht geladen: {fehler}", file=sys.stderr)
	try:
		seen = wms_bild("ch.bafu.vec25-seen", ausschnitt, groesse).convert("RGBA").split()[3]
		maske = np.maximum(maske, np.asarray(seen, dtype="float32") / 255)
	except Exception as fehler:
		print(f"Seen nicht geladen: {fehler}", file=sys.stderr)
	return maske


def karte(ziel, ausschnitt, groesse):
	"""Graue Landeskarte invertiert und abgedunkelt, Seen dezent dunkelblau."""
	grau = np.asarray(wms_bild("ch.swisstopo.pixelkarte-grau", ausschnitt, groesse).convert("L"), dtype="float32")
	bild = np.repeat((12 + (255 - grau) * 0.42)[..., None], 3, axis=2)
	deckung = seen_maske(ausschnitt, groesse)[..., None] * 0.85
	bild = bild * (1 - deckung) + np.array([20, 45, 80]) * deckung
	Image.fromarray(bild.clip(0, 255).astype("uint8"), "RGB").save(ziel, optimize=True)


def main():
	ordner = Path(sys.argv[1])
	e, n, breite_km, hoehe_km, breite_px, hoehe_px, anzahl = (float(a) for a in sys.argv[2:9])
	anzahl = int(anzahl)
	groesse = (int(breite_px), int(hoehe_px))
	# Ausschnitt auf ganze Rasterzellen um den Standort
	halb_b, halb_h = int(breite_km * 500) // ZELLE_M * ZELLE_M, int(hoehe_km * 500) // ZELLE_M * ZELLE_M
	mitte_e, mitte_n = int(e) // ZELLE_M * ZELLE_M, int(n) // ZELLE_M * ZELLE_M
	ausschnitt = (mitte_e - halb_b, mitte_n - halb_h, mitte_e + halb_b, mitte_n + halb_h)

	ordner.mkdir(parents=True, exist_ok=True)
	(ordner / "h5").mkdir(exist_ok=True)
	kennung = f"karte-v2-{ausschnitt}-{groesse}"

	alt = {}
	meta_datei = ordner / "meta.json"
	if meta_datei.exists():
		alt = json.loads(meta_datei.read_text())
	if alt.get("kennung") != kennung or not (ordner / "karte.png").exists():
		karte(ordner / "karte.png", ausschnitt, groesse)
		for png in ordner.glob("frame-*.png"):
			png.unlink()

	bilder = []
	behalten = set()
	for name, url in neueste_dateien(anzahl):
		h5 = ordner / "h5" / name
		png = ordner / f"frame-{name.split('.')[0]}.png"
		behalten.update({h5.name, png.name})
		try:
			if not h5.exists():
				laden(url, h5)
			if not png.exists():
				rendern(h5, png, ausschnitt, groesse)
			bilder.append({"datei": png.name, "zeit": zeitpunkt(h5)})
		except Exception as fehler:
			print(f"{name}: {fehler}", file=sys.stderr)

	# Alte Dateien aufräumen
	for datei in list((ordner / "h5").iterdir()) + list(ordner.glob("frame-*.png")):
		if datei.name not in behalten:
			datei.unlink()

	meta = {"kennung": kennung, "karte": "karte.png", "bilder": bilder}
	meta_datei.write_text(json.dumps(meta))
	print(json.dumps({"bilder": len(bilder)}))


if __name__ == "__main__":
	main()
