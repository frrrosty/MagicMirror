#!/usr/bin/env python3
"""Misst fortlaufend die Distanz mit dem Grove Ultrasonic Ranger V2.0 direkt am GPIO.

Gibt jede Messung als JSON-Zeile aus, z. B. {"d": 87.3} oder {"d": null} ohne Echo.
Die Auswertung (Anwesenheit, Gesten) macht die Steuerzentrale MMM-Steuerung,
darum bleibt dieses Skript bewusst einfach. Anschluss siehe docs/bewegungssensor.md.

  SENSOR_PIN   GPIO-Nummer der gelben Signalleitung (Standard 17)
  --test       Distanz lesbar ausgeben statt JSON (zum Prüfen des Anschlusses)
"""
import json
import os
import sys
import time

try:
	import lgpio
except ImportError:
	print(json.dumps({"fehler": "lgpio fehlt (sudo apt install python3-lgpio)"}), flush=True)
	sys.exit(2)

PIN = int(os.environ.get("SENSOR_PIN", 17))
SCHALLGESCHWINDIGKEIT_CM_S = 34300
TIMEOUT_S = 0.03  # entspricht gut 5 m
TAKT_S = 0.1      # etwa 10 Messungen pro Sekunde


def messen(chip):
	"""Eine Messung in cm oder None. Der Sensor nutzt einen Pin für Auslösen und Echo."""
	lgpio.gpio_claim_output(chip, PIN, 0)
	time.sleep(0.000002)
	lgpio.gpio_write(chip, PIN, 1)
	time.sleep(0.00001)
	lgpio.gpio_write(chip, PIN, 0)
	# Pull-down: Ohne angeschlossenen Sensor bleibt der Eingang ruhig statt zufällige Echos zu liefern
	lgpio.gpio_claim_input(chip, PIN, lgpio.SET_PULL_DOWN)

	start = time.perf_counter()
	while lgpio.gpio_read(chip, PIN) == 0:
		if time.perf_counter() - start > TIMEOUT_S:
			return None
	puls_start = time.perf_counter()
	while lgpio.gpio_read(chip, PIN) == 1:
		if time.perf_counter() - puls_start > TIMEOUT_S:
			return None
	return (time.perf_counter() - puls_start) * SCHALLGESCHWINDIGKEIT_CM_S / 2


def main():
	test = "--test" in sys.argv
	try:
		chip = lgpio.gpiochip_open(0)
	except Exception as fehler:
		print(json.dumps({"fehler": f"GPIO nicht verfügbar: {fehler}"}), flush=True)
		sys.exit(3)
	try:
		while True:
			beginn = time.perf_counter()
			d = messen(chip)
			if test:
				print("keine Messung" if d is None else f"{d:.0f} cm", flush=True)
			else:
				print(json.dumps({"d": None if d is None else round(d, 1)}), flush=True)
			time.sleep(max(0.0, TAKT_S - (time.perf_counter() - beginn)))
	except (KeyboardInterrupt, BrokenPipeError):
		pass
	finally:
		lgpio.gpiochip_close(chip)


if __name__ == "__main__":
	main()
