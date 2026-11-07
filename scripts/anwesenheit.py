#!/usr/bin/env python3
"""Schaltet den Spiegel ein, sobald jemand davor steht.

Liest den Grove Ultrasonic Ranger V2.0 direkt am GPIO (ohne GrovePi+) und
ruft bildschirm.sh auf. Einstellungen über Umgebungsvariablen:

  SENSOR_PIN    GPIO-Nummer der gelben Signalleitung (Standard 17)
  SCHWELLE_CM   Ab dieser Distanz gilt jemand als anwesend (Standard 100)
  NACHLAUF_S    So lange bleibt der TV nach der letzten Erkennung an (Standard 120)
  RUHEZEIT      Stunden ohne automatisches Einschalten, z. B. "22-6" (Standard)
"""
import os
import statistics
import subprocess
import sys
import time

import lgpio

PIN = int(os.environ.get("SENSOR_PIN", 17))
SCHWELLE_CM = float(os.environ.get("SCHWELLE_CM", 100))
NACHLAUF_S = float(os.environ.get("NACHLAUF_S", 120))
RUHEZEIT = os.environ.get("RUHEZEIT", "22-6")
BILDSCHIRM = os.path.join(os.path.dirname(os.path.abspath(__file__)), "bildschirm.sh")

SCHALLGESCHWINDIGKEIT_CM_S = 34300
TIMEOUT_S = 0.03  # entspricht gut 5 m, danach gilt die Messung als leer


def messen(chip):
    """Eine Messung in cm oder None. Der Sensor nutzt einen Pin für Auslösen und Echo."""
    lgpio.gpio_claim_output(chip, PIN, 0)
    time.sleep(0.000002)
    lgpio.gpio_write(chip, PIN, 1)
    time.sleep(0.00001)
    lgpio.gpio_write(chip, PIN, 0)
    lgpio.gpio_claim_input(chip, PIN)

    start = time.perf_counter()
    while lgpio.gpio_read(chip, PIN) == 0:
        if time.perf_counter() - start > TIMEOUT_S:
            return None
    puls_start = time.perf_counter()
    while lgpio.gpio_read(chip, PIN) == 1:
        if time.perf_counter() - puls_start > TIMEOUT_S:
            return None
    dauer = time.perf_counter() - puls_start
    return dauer * SCHALLGESCHWINDIGKEIT_CM_S / 2


def distanz(chip):
    """Median aus drei Messungen, damit einzelne Ausreisser nichts auslösen."""
    werte = []
    for _ in range(3):
        wert = messen(chip)
        if wert is not None:
            werte.append(wert)
        time.sleep(0.06)
    return statistics.median(werte) if werte else None


def in_ruhezeit():
    von, bis = (int(teil) for teil in RUHEZEIT.split("-"))
    stunde = time.localtime().tm_hour
    if von <= bis:
        return von <= stunde < bis
    return stunde >= von or stunde < bis


def schalten(befehl):
    print(f"Bildschirm {befehl}", flush=True)
    subprocess.run([BILDSCHIRM, befehl], check=False)


def main():
    if "--test" in sys.argv:
        chip = lgpio.gpiochip_open(0)
        try:
            while True:
                wert = distanz(chip)
                print("keine Messung" if wert is None else f"{wert:.0f} cm", flush=True)
                time.sleep(0.5)
        finally:
            lgpio.gpiochip_close(chip)

    chip = lgpio.gpiochip_open(0)
    # Annahme beim Start: TV ist an und geht aus, wenn niemand kommt
    an = True
    zuletzt_gesehen = time.monotonic()
    try:
        while True:
            wert = distanz(chip)
            jetzt = time.monotonic()
            if wert is not None and wert < SCHWELLE_CM:
                zuletzt_gesehen = jetzt
                if not an and not in_ruhezeit():
                    schalten("ein")
                    an = True
            elif an and jetzt - zuletzt_gesehen > NACHLAUF_S:
                schalten("aus")
                an = False
            time.sleep(0.5)
    finally:
        lgpio.gpiochip_close(chip)


if __name__ == "__main__":
    main()
