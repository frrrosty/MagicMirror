/* Gemeinsamer Webserver der Spiegel-App (Standard Port 8081).
 * Bewusst getrennt vom MagicMirror²-Server, der nur lokal erreichbar bleibt:
 * Dessen /config gibt die ganze Konfiguration samt Kalenderlinks heraus.
 * Die node_helper der Module melden hier ihre Schnittstellen an (route) und
 * teilen sich so einen Server, eine PIN und eine Handy-App.
 *
 * Sicherheit:
 * - Jede Schnittstelle (lesen und ändern) braucht die PIN aus secrets.js (pinnwandPin).
 *   Ohne PIN in secrets.js verweigert der Server jeden Zugriff.
 * - Nach 5 falschen PINs ist die Adresse 5 Minuten gesperrt, nach 20 falschen
 *   insgesamt innert 10 Minuten der ganze Server.
 * - Die PIN steht in einem eigenen Header; Webseiten fremder Herkunft können ihn
 *   ohne CORS-Freigabe nicht senden (Schutz vor Cross-Site-Anfragen).
 * - Ausgeliefert werden nur fest benannte Dateien.
 */
const crypto = require("node:crypto");
const fs = require("node:fs");
const http = require("node:http");
const os = require("node:os");
const path = require("node:path");
const Log = require("logger");

// Ausgelieferte Dateien der App (bewusst eine feste Liste, kein Ordner)
const DATEIEN = {
	"/": { name: "app.html", typ: "text/html" },
	"/index.html": { name: "app.html", typ: "text/html" },
	"/manifest.webmanifest": { name: "manifest.webmanifest", typ: "application/manifest+json" },
	"/icon.svg": { name: "icon.svg", typ: "image/svg+xml" }
};

const SECRETS = [
	path.join(os.homedir(), "magicmirror-setup", "config", "secrets.js"),
	path.join(process.cwd(), "config", "secrets.js")
];

/**
 * PIN aus secrets.js lesen, leer bedeutet ohne PIN.
 * @returns {string} PIN
 */
function pinLesen () {
	for (const ort of SECRETS) {
		try {
			delete require.cache[require.resolve(ort)];
			return String(require(ort).pinnwandPin || "");
		} catch {
			// nächsten Ort versuchen
		}
	}
	return "";
}

class AppServer {
	constructor () {
		this.routen = [];
		this.pin = pinLesen();
		if (!this.pin) Log.warn("Keine PIN in secrets.js (pinnwandPin): Die Spiegel-App bleibt gesperrt, bis eine PIN gesetzt ist.");
		this.fehlversuche = new Map(); // Adresse -> { anzahl, sperreBis }
		this.globaleFehler = [];        // Zeitpunkte falscher PINs, alle Adressen
		const port = Number(process.env.PINNWAND_PORT || 8081);
		this.server = http.createServer((req, res) => this.anfrage(req, res));
		this.server.on("error", (error) => Log.error(`App-Server: ${error.message}`));
		this.server.listen(port, "0.0.0.0", () => Log.log(`Spiegel-App erreichbar auf Port ${port}`));
	}

	/**
	 * Schnittstelle anmelden. Platzhalter wie :id landen in params.
	 * @param {string} methode GET, POST oder DELETE
	 * @param {string} muster z. B. "/api/pinnwand/todos/:id"
	 * @param {Function} handler (params, body) => Antwort-Objekt; Fehler mit status werfen
	 */
	route (methode, muster, handler) {
		const namen = [];
		const regex = new RegExp(`^${muster.replace(/:(\w+)/g, (_, name) => {
			namen.push(name);
			return "([^/]+)";
		})}$`);
		this.routen.push({ methode, regex, namen, handler });
	}

	antwort (res, status, inhalt, typ = "application/json") {
		res.writeHead(status, {
			"Content-Type": `${typ}; charset=utf-8`,
			"Cache-Control": "no-store",
			"X-Content-Type-Options": "nosniff",
			"X-Frame-Options": "DENY",
			"Referrer-Policy": "no-referrer",
			"Content-Security-Policy": "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'"
		});
		res.end(typ === "application/json" ? JSON.stringify(inhalt) : inhalt);
	}

	koerper (req) {
		return new Promise((resolve, reject) => {
			let text = "";
			req.on("data", (teil) => {
				text += teil;
				if (text.length > 50000) {
					reject(Object.assign(new Error("Anfrage zu gross"), { status: 413 }));
					req.destroy();
				}
			});
			req.on("end", () => {
				try {
					resolve(text ? JSON.parse(text) : {});
				} catch {
					reject(Object.assign(new Error("Ungültiges JSON"), { status: 400 }));
				}
			});
		});
	}

	pinStimmt (req) {
		if (!this.pin) return false;
		const pin = String(req.headers["x-pin"] || "");
		return pin.length === this.pin.length && crypto.timingSafeEqual(Buffer.from(pin), Buffer.from(this.pin));
	}

	/**
	 * Prüft die PIN mit Sperre gegen Durchprobieren.
	 * @param {object} req Anfrage
	 * @returns {{ok: boolean, status?: number, fehler?: string}} Ergebnis
	 */
	zugang (req) {
		const jetzt = Date.now();
		const adresse = req.socket.remoteAddress || "?";
		this.globaleFehler = this.globaleFehler.filter((t) => jetzt - t < 10 * 60 * 1000);
		const eintrag = this.fehlversuche.get(adresse) || { anzahl: 0, sperreBis: 0 };
		if (eintrag.sperreBis > jetzt || this.globaleFehler.length >= 20) {
			return { ok: false, status: 429, fehler: "Zu viele falsche PINs, bitte später erneut versuchen" };
		}
		if (!this.pin) return { ok: false, status: 503, fehler: "Keine PIN gesetzt (pinnwandPin in secrets.js)" };
		if (this.pinStimmt(req)) {
			this.fehlversuche.delete(adresse);
			return { ok: true };
		}
		// Ohne mitgeschickte PIN zählt es nicht als Versuch (erster Aufruf der App)
		if (req.headers["x-pin"]) {
			eintrag.anzahl += 1;
			this.globaleFehler.push(jetzt);
			if (eintrag.anzahl >= 5) {
				eintrag.anzahl = 0;
				eintrag.sperreBis = jetzt + 5 * 60 * 1000;
				Log.warn(`Spiegel-App: 5 falsche PINs von ${adresse}, für 5 Minuten gesperrt`);
			}
			this.fehlversuche.set(adresse, eintrag);
		}
		return { ok: false, status: 403, fehler: "Falsche PIN" };
	}

	async anfrage (req, res) {
		const url = new URL(req.url, "http://spiegel");
		try {
			const datei = DATEIEN[url.pathname];
			if (req.method === "GET" && datei) {
				return this.antwort(res, 200, fs.readFileSync(path.join(__dirname, datei.name), "utf8"), datei.typ);
			}
			for (const route of this.routen) {
				const treffer = url.pathname.match(route.regex);
				if (!treffer || route.methode !== req.method) continue;
				const zugang = this.zugang(req);
				if (!zugang.ok) return this.antwort(res, zugang.status, { fehler: zugang.fehler });
				const params = Object.fromEntries(route.namen.map((name, i) => [name, decodeURIComponent(treffer[i + 1])]));
				const body = req.method === "POST" ? await this.koerper(req) : {};
				return this.antwort(res, 200, await route.handler(params, body));
			}
			return this.antwort(res, 404, { fehler: "Nicht gefunden" });
		} catch (error) {
			Log.warn(`Anfrage ${req.method} ${url.pathname} fehlgeschlagen: ${error.message}`);
			return this.antwort(res, error.status || 400, { fehler: error.message });
		}
	}
}

let instanz = null;

module.exports = {
	/**
	 * Der eine gemeinsame Server, beim ersten Aufruf gestartet.
	 * @returns {AppServer} Server
	 */
	holen () {
		if (!instanz) instanz = new AppServer();
		return instanz;
	},
	/**
	 * Fehler mit HTTP-Status für route-Handler.
	 * @param {number} status HTTP-Status
	 * @param {string} meldung Text für die App
	 * @returns {Error} Fehler
	 */
	fehler (status, meldung) {
		return Object.assign(new Error(meldung), { status });
	}
};
