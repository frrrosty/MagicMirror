/* Steuerzentrale: Zeitplan, Sensor, Gesten und manuelle Übersteuerung.
 * Liest den Sensor über scripts/sensor.py, entscheidet regelmässig, ob der TV
 * an sein soll, schaltet ihn über scripts/bildschirm.sh und bietet die
 * Schnittstellen für die Handy-App (modules/spiegel-app).
 *
 * Umgebungsvariablen zum Testen:
 *   STEUERUNG_TROCKEN=1     nicht schalten, nur protokollieren
 *   STEUERUNG_SENSOR=pfad   anderes Sensorprogramm (z. B. eine Simulation)
 */
const { execFile, spawn } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const readline = require("node:readline");
const NodeHelper = require("node_helper");
const Log = require("logger");
const app = require("../spiegel-app/server.js");
const speicher = require("../spiegel-app/speicher.js");
const { STANDARD_EINSTELLUNGEN, pruefen, entscheiden, GestenErkennung } = require("./logik.js");

const DATEI = path.join(os.homedir(), ".config", "magicmirror-steuerung.json");
const SKRIPTE = path.join(__dirname, "..", "..", "scripts");
const TAKT_MS = 5000;
const MIN_ABSTAND_MS = 15000;      // zwischen zwei Schaltvorgängen
const SENSOR_STUMM_MS = 10000;     // ohne Messung so lange gilt der Sensor als ausgefallen
const LUECKE_MS = 1500;            // kürzere Aussetzer zählen noch zur gleichen Anwesenheit
const WIEDERHOLEN_MS = 60000;      // nach einem gescheiterten Schaltbefehl frühestens dann erneut

module.exports = NodeHelper.create({
	start () {
		Log.log(`Starting node helper for: ${this.name}`);
		const gespeichert = this.laden();
		this.einstellungen = gespeichert.einstellungen;
		this.uebersteuerung = gespeichert.uebersteuerung;
		this.letzteAnwesenheit = null;
		this.anwesendSeit = null;      // Beginn der laufenden Anwesenheit
		this.ruhigSeit = null;         // Ende der Anwesenheit davor (für den Morgengruss)
		this.letzteMessung = null;
		this.distanz = null;
		this.sensorFehler = null;
		this.tvAn = null;              // unbekannt bis zum ersten Schalten
		this.letzterWechsel = 0;
		this.befehlLaeuft = false;     // es läuft höchstens ein Schaltbefehl gleichzeitig
		this.wunsch = null;            // danach auszuführender Zustand
		this.fehlerBis = 0;            // nach Fehlern erst ab diesem Zeitpunkt erneut versuchen
		this.letzteWerte = [];         // für den Median gegen Phantom-Echos
		this.beendet = false;
		this.entscheid = null;
		this.seite = { index: 0, namen: [] };
		this.gesten = new GestenErkennung();
		this.trocken = process.env.STEUERUNG_TROCKEN === "1";

		this.schnittstellen(app.holen());
		this.sensorStarten();
		setInterval(() => this.pruefen(), TAKT_MS);
		setTimeout(() => this.pruefen(), 2000);
	},

	stop () {
		this.beendet = true;
		this.sensor?.kill();
	},

	// ----- Einstellungen -------------------------------------------------

	laden () {
		const d = speicher.lesen(DATEI);
		let einstellungen = structuredClone(STANDARD_EINSTELLUNGEN);
		// Ältere Dateien enthielten nur die Einstellungen, neuere zusätzlich die Übersteuerung
		const roh = d?.einstellungen || d;
		if (roh) {
			try {
				einstellungen = pruefen(roh);
			} catch (error) {
				Log.error(`Gespeicherte Einstellungen ungültig (${error.message}), es gelten die Standardwerte`);
			}
		}
		const u = d?.uebersteuerung;
		const uebersteuerung = u && (u.modus === "an" || u.modus === "aus") && u.bis > Date.now() ? { modus: u.modus, bis: u.bis } : null;
		return { einstellungen, uebersteuerung };
	},

	speichern () {
		speicher.schreiben(DATEI, { einstellungen: this.einstellungen, uebersteuerung: this.uebersteuerung });
	},

	// ----- Sensor --------------------------------------------------------

	sensorStarten () {
		const programm = process.env.STEUERUNG_SENSOR || path.join(SKRIPTE, "sensor.py");
		if (!fs.existsSync(programm)) {
			this.sensorFehler = "Sensorprogramm fehlt";
			return;
		}
		const prozess = spawn(programm.endsWith(".py") ? "python3" : programm, programm.endsWith(".py") ? [programm] : [], { stdio: ["ignore", "pipe", "pipe"] });
		this.sensor = prozess;
		readline.createInterface({ input: prozess.stdout }).on("line", (zeile) => this.sensorZeile(zeile));
		prozess.stderr.on("data", (d) => Log.warn(`Sensor: ${String(d).trim()}`));
		let neustartGeplant = false;
		const neustarten = (grund) => {
			if (neustartGeplant) return;
			neustartGeplant = true;
			this.sensor = null;
			if (this.beendet) return;
			if (!this.sensorFehler) this.sensorFehler = grund;
			Log.warn(`${this.sensorFehler}, neuer Versuch in 60 Sekunden`);
			setTimeout(() => this.sensorStarten(), 60000);
		};
		prozess.on("error", (error) => neustarten(`Sensorprogramm nicht startbar: ${error.message}`));
		prozess.on("exit", (code) => neustarten(`Sensorprogramm beendet (Code ${code})`));
	},

	sensorZeile (zeile) {
		let daten;
		try {
			daten = JSON.parse(zeile);
		} catch {
			return;
		}
		if (daten.fehler) {
			this.sensorFehler = daten.fehler;
			return;
		}
		const jetzt = Date.now();
		this.sensorFehler = null;
		this.letzteMessung = jetzt;
		this.distanz = daten.d;

		// Eigene Gesten-Sensoren können Gesten direkt melden, z. B. {"geste": "links"}
		const geste = daten.geste || (this.einstellungen.gesten ? this.gesten.messung(jetzt, daten.d, this.einstellungen.sensor.nahCm) : null);
		// Median der letzten drei Messungen: Ein einzelnes Phantom-Echo zählt nicht als Anwesenheit
		this.letzteWerte.push(typeof daten.d === "number" ? daten.d : Infinity);
		if (this.letzteWerte.length > 3) this.letzteWerte.shift();
		const median = [...this.letzteWerte].sort((a, b) => a - b)[Math.floor(this.letzteWerte.length / 2)];
		const da = this.letzteWerte.length === 3 && median < this.einstellungen.sensor.schwelleCm;
		if (da) {
			const neu = this.letzteAnwesenheit === null || jetzt - this.letzteAnwesenheit > LUECKE_MS;
			if (neu) {
				this.ruhigSeit = this.letzteAnwesenheit;
				this.anwesendSeit = jetzt;
			}
			this.letzteAnwesenheit = jetzt;
			// Solange der TV aus ist, laufend prüfen: Verweilen und Morgengruss sollen schnell greifen
			if (!this.tvAn) this.pruefen();
		} else if (this.anwesendSeit !== null && jetzt - this.letzteAnwesenheit > LUECKE_MS) {
			this.anwesendSeit = null;
		}
		if (geste) this.gesteAusloesen(geste);
	},

	sensorOk () {
		return !this.sensorFehler && this.letzteMessung !== null && Date.now() - this.letzteMessung < SENSOR_STUMM_MS;
	},

	gesteAusloesen (geste) {
		Log.log(`Geste: ${geste}`);
		if (this.tvAn) this.sendSocketNotification("STEUERUNG_GESTE", { geste });
	},

	// ----- Entscheiden und schalten -------------------------------------

	pruefen () {
		if (this.uebersteuerung && this.uebersteuerung.bis <= Date.now()) {
			this.uebersteuerung = null;
			this.speichern();
		}
		this.entscheid = entscheiden({
			einstellungen: this.einstellungen,
			datum: new Date(),
			uebersteuerung: this.uebersteuerung,
			letzteAnwesenheit: this.letzteAnwesenheit,
			anwesendSeit: this.anwesendSeit,
			ruhigSeit: this.ruhigSeit,
			tvAn: Boolean(this.tvAn),
			sensorOk: this.sensorOk()
		});
		this.schalten(this.entscheid.an, this.entscheid.grund);
	},

	schalten (an, grund, sofort = false) {
		if (an === this.tvAn && !this.befehlLaeuft) return;
		const jetzt = Date.now();
		if (!sofort && jetzt < this.fehlerBis) return;
		// Einschalten sofort, Ausschalten erst nach dem Mindestabstand (gegen Flackern)
		if (!sofort && !an && this.tvAn !== null && jetzt - this.letzterWechsel < MIN_ABSTAND_MS) return;
		// Läuft schon ein Befehl, nur den Wunsch merken: CEC verträgt keine gleichzeitigen Befehle
		if (this.befehlLaeuft) {
			this.wunsch = { an, grund };
			return;
		}
		if (an === this.tvAn) return;
		this.befehlAusfuehren(an, grund);
	},

	befehlAusfuehren (an, grund) {
		this.tvAn = an;
		this.letzterWechsel = Date.now();
		Log.log(`TV ${an ? "ein" : "aus"} (${grund})${this.trocken ? " [trocken]" : ""}`);
		this.sendSocketNotification("STEUERUNG_TV", { an });
		if (this.trocken) return;
		this.befehlLaeuft = true;
		execFile(path.join(SKRIPTE, "bildschirm.sh"), [an ? "ein" : "aus"], { timeout: 30000 }, (fehler, stdout, stderr) => {
			this.befehlLaeuft = false;
			if (fehler) {
				// Zustand unbekannt: beim nächsten Takt erneut versuchen, aber höchstens jede Minute
				Log.warn(`bildschirm.sh ${an ? "ein" : "aus"}: ${fehler.message} ${stderr}`.trim());
				this.tvAn = null;
				this.fehlerBis = Date.now() + WIEDERHOLEN_MS;
			} else {
				this.fehlerBis = 0;
			}
			const wunsch = this.wunsch;
			this.wunsch = null;
			if (wunsch && wunsch.an !== this.tvAn) this.befehlAusfuehren(wunsch.an, wunsch.grund);
		});
	},

	// ----- Spiegel (Frontend) -------------------------------------------

	socketNotificationReceived (notification, payload) {
		if (notification === "STEUERUNG_SEITEN") this.seite = payload;
	},

	// ----- Handy-App -----------------------------------------------------

	status () {
		const jetzt = Date.now();
		return {
			einstellungen: this.einstellungen,
			status: {
				tvAn: this.tvAn,
				modus: this.entscheid?.modus ?? null,
				grund: this.entscheid?.grund ?? null,
				uebersteuerung: this.uebersteuerung,
				sensorOk: this.sensorOk(),
				sensorFehler: this.sensorFehler,
				distanz: this.sensorOk() ? this.distanz : null,
				anwesendVorSek: this.letzteAnwesenheit === null ? null : Math.round((jetzt - this.letzteAnwesenheit) / 1000),
				seite: this.seite,
				trocken: this.trocken
			}
		};
	},

	schnittstellen (server) {
		server.route("GET", "/api/steuerung", () => this.status());

		server.route("POST", "/api/steuerung/einstellungen", (params, body) => {
			try {
				this.einstellungen = pruefen(body);
			} catch (error) {
				throw app.fehler(400, error.message);
			}
			this.speichern();
			this.pruefen();
			return this.status();
		});

		server.route("POST", "/api/steuerung/sofort", (params, body) => {
			if (body.aktion === "auto") {
				this.uebersteuerung = null;
			} else if (body.aktion === "an" || body.aktion === "aus") {
				const minuten = Math.min(Math.max(Number(body.minuten) || 60, 1), 24 * 60);
				this.uebersteuerung = { modus: body.aktion, bis: Date.now() + minuten * 60000 };
			} else {
				throw app.fehler(400, "Unbekannte Aktion");
			}
			this.speichern();
			this.pruefen();
			// Auf einen ausdrücklichen Wunsch hin nicht auf den Mindestabstand warten
			if (this.entscheid.an !== this.tvAn) this.schalten(this.entscheid.an, this.entscheid.grund, true);
			return this.status();
		});

		server.route("POST", "/api/steuerung/seite", (params, body) => {
			const index = Number(body.index);
			const anzahl = this.seite.namen.length || 1;
			if (!Number.isInteger(index) || index < 0 || index >= anzahl) throw app.fehler(400, "Ungültige Seite");
			this.sendSocketNotification("STEUERUNG_SEITE", { index });
			this.seite = { ...this.seite, index };
			return this.status();
		});
	}
});
