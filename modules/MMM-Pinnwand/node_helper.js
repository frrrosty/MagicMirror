/* Pinnwand: kleiner eigener Webserver fürs Handy (Standard Port 8081).
 * Bewusst getrennt vom MagicMirror²-Server, der nur lokal erreichbar bleibt:
 * Dessen /config gibt die ganze Konfiguration samt Kalenderlinks heraus.
 * Daten liegen in ~/.config/magicmirror-pinnwand.json, die PIN in secrets.js.
 */
const fs = require("node:fs");
const http = require("node:http");
const os = require("node:os");
const path = require("node:path");
const crypto = require("node:crypto");
const NodeHelper = require("node_helper");
const Log = require("logger");

const DATEI = path.join(os.homedir(), ".config", "magicmirror-pinnwand.json");
const SECRETS = [
	path.join(os.homedir(), "magicmirror-setup", "config", "secrets.js"),
	path.join(process.cwd(), "config", "secrets.js")
];
const ERLEDIGT_BEHALTEN_MS = 7 * 24 * 60 * 60 * 1000;
const MAX_TODO = 120;
const MAX_NACHRICHT = 200;

/**
 * PIN aus secrets.js lesen, leer bedeutet ohne PIN.
 * @returns {string} PIN
 */
function pinLesen () {
	for (const ort of SECRETS) {
		try {
			return String(require(ort).pinnwandPin || "");
		} catch {
			// nächsten Ort versuchen
		}
	}
	return "";
}

module.exports = NodeHelper.create({
	start () {
		Log.log(`Starting node helper for: ${this.name}`);
		this.daten = this.laden();
		this.pin = pinLesen();
		if (!this.pin) Log.warn("Keine PIN in secrets.js (pinnwandPin), Änderungen sind ohne PIN möglich.");
		const port = Number(process.env.PINNWAND_PORT || 8081);
		this.server = http.createServer((req, res) => this.anfrage(req, res));
		this.server.on("error", (error) => Log.error(`Server: ${error.message}`));
		this.server.listen(port, "0.0.0.0", () => Log.log(`Fürs Handy erreichbar auf Port ${port}`));
		// Abgelaufene Nachrichten und alte erledigte Einträge regelmässig aufräumen
		setInterval(() => this.aufraeumen(true), 5 * 60 * 1000);
	},

	stop () {
		this.server?.close();
	},

	socketNotificationReceived (notification) {
		if (notification === "PINNWAND_HOLEN") this.senden();
	},

	laden () {
		try {
			return JSON.parse(fs.readFileSync(DATEI, "utf8"));
		} catch {
			return { todos: [], nachricht: null };
		}
	},

	speichern () {
		fs.mkdirSync(path.dirname(DATEI), { recursive: true });
		fs.writeFileSync(DATEI, JSON.stringify(this.daten, null, "\t"));
	},

	aufraeumen (mitSenden) {
		const jetzt = Date.now();
		const vorher = JSON.stringify(this.daten);
		this.daten.todos = this.daten.todos.filter((t) => !t.erledigt || jetzt - t.erledigt < ERLEDIGT_BEHALTEN_MS);
		if (this.daten.nachricht && this.daten.nachricht.bis < jetzt) this.daten.nachricht = null;
		if (JSON.stringify(this.daten) !== vorher) {
			this.speichern();
			if (mitSenden) this.senden();
		}
	},

	senden () {
		this.aufraeumen(false);
		this.sendSocketNotification("PINNWAND_DATEN", this.daten);
	},

	geaendert () {
		this.speichern();
		this.senden();
	},

	antwort (res, status, inhalt, typ = "application/json") {
		res.writeHead(status, { "Content-Type": `${typ}; charset=utf-8`, "Cache-Control": "no-store" });
		res.end(typ === "application/json" ? JSON.stringify(inhalt) : inhalt);
	},

	koerper (req) {
		return new Promise((resolve, reject) => {
			let text = "";
			req.on("data", (teil) => {
				text += teil;
				if (text.length > 10000) reject(new Error("zu gross"));
			});
			req.on("end", () => {
				try {
					resolve(text ? JSON.parse(text) : {});
				} catch {
					reject(new Error("ungültiges JSON"));
				}
			});
		});
	},

	async anfrage (req, res) {
		const url = new URL(req.url, "http://pinnwand");
		const teile = url.pathname.split("/").filter(Boolean);

		try {
			if (req.method === "GET" && (url.pathname === "/" || url.pathname === "/index.html")) {
				return this.antwort(res, 200, fs.readFileSync(path.join(__dirname, "handy.html"), "utf8"), "text/html");
			}
			if (teile[0] !== "api") return this.antwort(res, 404, { fehler: "Nicht gefunden" });

			if (req.method === "GET" && teile.length === 1) {
				this.aufraeumen(false);
				return this.antwort(res, 200, { ...this.daten, pinNoetig: Boolean(this.pin) });
			}

			// Alles, was etwas ändert, braucht die PIN
			const pin = String(req.headers["x-pin"] || "");
			if (this.pin && (pin.length !== this.pin.length || !crypto.timingSafeEqual(Buffer.from(pin), Buffer.from(this.pin)))) {
				return this.antwort(res, 403, { fehler: "Falsche PIN" });
			}
			const body = req.method === "POST" ? await this.koerper(req) : {};
			const von = String(body.von || "").trim().slice(0, 20);

			if (teile[1] === "todos" && teile.length === 2 && req.method === "POST") {
				const text = String(body.text || "").trim().slice(0, MAX_TODO);
				if (!text) return this.antwort(res, 400, { fehler: "Text fehlt" });
				this.daten.todos.push({ id: crypto.randomUUID(), text, von, erstellt: Date.now(), erledigt: null });
				this.geaendert();
				return this.antwort(res, 200, this.daten);
			}

			if (teile[1] === "todos" && teile.length === 3) {
				const todo = this.daten.todos.find((t) => t.id === teile[2]);
				if (!todo) return this.antwort(res, 404, { fehler: "Eintrag nicht gefunden" });
				if (req.method === "DELETE") {
					this.daten.todos = this.daten.todos.filter((t) => t !== todo);
				} else if (req.method === "POST") {
					todo.erledigt = body.erledigt ? Date.now() : null;
				}
				this.geaendert();
				return this.antwort(res, 200, this.daten);
			}

			if (teile[1] === "nachricht" && req.method === "POST") {
				const text = String(body.text || "").trim().slice(0, MAX_NACHRICHT);
				if (!text) return this.antwort(res, 400, { fehler: "Text fehlt" });
				const stunden = Math.min(Math.max(Number(body.stunden) || 4, 0.5), 24 * 7);
				this.daten.nachricht = { text, von, erstellt: Date.now(), bis: Date.now() + stunden * 3600 * 1000 };
				this.geaendert();
				return this.antwort(res, 200, this.daten);
			}

			if (teile[1] === "nachricht" && req.method === "DELETE") {
				this.daten.nachricht = null;
				this.geaendert();
				return this.antwort(res, 200, this.daten);
			}

			return this.antwort(res, 404, { fehler: "Nicht gefunden" });
		} catch (error) {
			Log.warn(`Anfrage fehlgeschlagen: ${error.message}`);
			return this.antwort(res, 400, { fehler: error.message });
		}
	}
});
