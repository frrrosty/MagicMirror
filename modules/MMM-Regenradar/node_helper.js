/* Ruft alle paar Minuten radar.py auf (Radar von MeteoSchweiz, Karte von swisstopo)
 * und schickt Karte und Radarbilder als Daten-URLs an den Spiegel.
 */
const { execFile } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const NodeHelper = require("node_helper");
const Log = require("logger");

const ORDNER = path.join(os.homedir(), ".cache", "magicmirror-radar");

/**
 * WGS84 in Schweizer Landeskoordinaten LV95 (Näherungsformel von swisstopo, auf etwa 1 m genau).
 * @param {number} lat Breite
 * @param {number} lon Länge
 * @returns {{e: number, n: number}} Ost- und Nordwert
 */
function lv95 (lat, lon) {
	const p = (lat * 3600 - 169028.66) / 10000;
	const l = (lon * 3600 - 26782.5) / 10000;
	return {
		e: 2600072.37 + 211455.93 * l - 10938.51 * l * p - 0.36 * l * p * p - 44.54 * l ** 3,
		n: 1200147.07 + 308807.95 * p + 3745.25 * l * l + 76.63 * p * p - 194.56 * l * l * p + 119.79 * p ** 3
	};
}

const alsDatenUrl = (datei) => `data:image/png;base64,${fs.readFileSync(path.join(ORDNER, datei)).toString("base64")}`;

module.exports = NodeHelper.create({
	start () {
		Log.log(`Starting node helper for: ${this.name}`);
		this.timer = null;
		this.zuletzt = null;
	},

	socketNotificationReceived (notification, config) {
		if (notification !== "RADAR_START") return;
		this.config = config;
		this.zuletzt = null; // neu verbundener Browser bekommt alles
		clearInterval(this.timer);
		this.aktualisieren();
		this.timer = setInterval(() => this.aktualisieren(), config.updateInterval);
	},

	aktualisieren () {
		const c = this.config;
		const { e, n } = lv95(c.lat, c.lon);
		const argumente = [path.join(__dirname, "radar.py"), ORDNER, e, n, c.breiteKm, c.hoeheKm, c.breite, c.hoehe, c.bilder].map(String);
		execFile("python3", argumente, { timeout: 120000 }, (fehler, stdout, stderr) => {
			if (stderr) Log.warn(stderr.trim());
			if (fehler) {
				const hinweis = /No module named/.test(stderr) ? " (fehlende Pakete: sudo apt install python3-h5py python3-numpy python3-pil)" : "";
				Log.warn(`Radar nicht aktualisiert: ${fehler.message}${hinweis}`);
				if (!this.zuletzt) this.sendSocketNotification("RADAR_FEHLER");
				return;
			}
			this.senden();
		});
	},

	senden () {
		try {
			const meta = JSON.parse(fs.readFileSync(path.join(ORDNER, "meta.json"), "utf8"));
			if (!meta.bilder.length) throw new Error("keine Radarbilder");
			const neuestes = meta.bilder.at(-1).zeit;
			if (neuestes === this.zuletzt) return;
			this.zuletzt = neuestes;
			this.sendSocketNotification("RADAR_DATEN", {
				karte: alsDatenUrl(meta.karte),
				bilder: meta.bilder.map((b) => ({ bild: alsDatenUrl(b.datei), zeit: b.zeit }))
			});
		} catch (error) {
			Log.warn(`Radarbilder nicht gelesen: ${error.message}`);
		}
	}
});
