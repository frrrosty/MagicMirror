/* Gemeinsamer Webserver der Spiegel-App (Standard Port 8081).
 * Bewusst getrennt vom MagicMirror²-Server, der nur lokal erreichbar bleibt:
 * Dessen /config gibt die ganze Konfiguration samt Kalenderlinks heraus.
 * Die node_helper der Module melden hier ihre Schnittstellen an (route) und
 * teilen sich so einen Server, eine Anmeldung und eine Handy-App.
 *
 * Sicherheit:
 * - Anmeldung einmal pro Gerät mit der PIN aus secrets.js (pinnwandPin). Dafür gibt es
 *   ein zufälliges Geräte-Token (X-Token), das jede weitere Anfrage braucht, auch das Lesen.
 *   Ohne PIN in secrets.js lässt der Server niemanden herein.
 * - Nur die Anmeldung zählt Fehlversuche: nach 5 falschen PINs ist die Adresse 5 Minuten
 *   gesperrt, nach 20 falschen insgesamt innert 10 Minuten jede neue Anmeldung.
 *   Bereits angemeldete Geräte sind von Sperren nie betroffen.
 * - Der Host-Name wird geprüft (Schutz vor DNS-Rebinding). Erlaubt sind IP-Adressen,
 *   localhost, der Name des Pi (auch mit .local) und Tailscale-Namen (.ts.net).
 * - Token und PIN stehen in eigenen Headern bzw. im Körper; fremde Webseiten können
 *   den Token-Header ohne CORS-Freigabe nicht senden (Schutz vor Cross-Site-Anfragen).
 * - Ausgeliefert werden nur fest benannte Dateien.
 *
 * Umgebungsvariablen: APP_PORT (Standard 8081), APP_ADRESSE (Standard 0.0.0.0;
 * 127.0.0.1, wenn die App nur noch über «tailscale serve» erreichbar sein soll).
 */
const crypto = require("node:crypto");
const fs = require("node:fs");
const http = require("node:http");
const net = require("node:net");
const os = require("node:os");
const path = require("node:path");
const Log = require("logger");
const speicher = require("./speicher.js");

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
const TOKEN_DATEI = path.join(os.homedir(), ".config", "magicmirror-app-geraete.json");
const TOKEN_GUELTIG_MS = 365 * 24 * 60 * 60 * 1000;
const MAX_GERAETE = 50;

/**
 * PIN aus secrets.js lesen, leer bedeutet: niemand kommt herein.
 * @returns {string} PIN
 */
function pinLesen () {
	for (const ort of SECRETS) {
		let wert;
		try {
			delete require.cache[require.resolve(ort)];
			wert = require(ort).pinnwandPin;
		} catch {
			continue; // nächsten Ort versuchen
		}
		if (wert === undefined || wert === "") return "";
		if (typeof wert !== "string") {
			// z. B. 0123 ohne Anführungszeichen wäre eine Oktalzahl und ergäbe eine andere PIN
			Log.error("pinnwandPin in secrets.js muss in Anführungszeichen stehen, z. B. \"482915\". Die App bleibt gesperrt.");
			return "";
		}
		if (wert.length < 6) Log.warn("pinnwandPin ist kürzer als 6 Zeichen. Empfohlen sind mindestens 6 Ziffern.");
		return wert;
	}
	return "";
}

/**
 * Zeitkonstanter Vergleich, auch bei unterschiedlicher Länge.
 * @param {string} a erster Wert
 * @param {string} b zweiter Wert
 * @returns {boolean} gleich
 */
function gleich (a, b) {
	const ha = crypto.createHash("sha256").update(String(a)).digest();
	const hb = crypto.createHash("sha256").update(String(b)).digest();
	return crypto.timingSafeEqual(ha, hb);
}

/**
 * Hash eines Tokens, gespeichert wird nur dieser.
 * @param {string} token Token
 * @returns {string} Hash
 */
const tokenHash = (token) => crypto.createHash("sha256").update(token).digest("hex");

class AppServer {
	constructor () {
		this.routen = [];
		this.pin = pinLesen();
		if (!this.pin) Log.warn("Keine gültige PIN in secrets.js (pinnwandPin): Die Spiegel-App lässt niemanden herein.");
		this.geraete = (speicher.lesen(TOKEN_DATEI) || {}).geraete || {};
		this.fehlversuche = new Map(); // Adresse -> { anzahl, sperreBis }
		this.globaleFehler = [];        // Zeitpunkte falscher PINs, alle Adressen
		const hostname = os.hostname().toLowerCase();
		this.erlaubteNamen = new Set(["localhost", "spiegel", "spiegel.local", hostname, `${hostname}.local`]);

		const port = Number(process.env.APP_PORT || process.env.PINNWAND_PORT || 8081);
		const adresse = process.env.APP_ADRESSE || "0.0.0.0";
		this.server = http.createServer((req, res) => {
			this.anfrage(req, res).catch((error) => {
				Log.error(`App-Server: ${error.message}`);
				try {
					res.writeHead(500);
					res.end();
				} catch {
					// Antwort war schon unterwegs
				}
			});
		});
		this.server.on("error", (error) => Log.error(`App-Server: ${error.message}`));
		this.server.listen(port, adresse, () => Log.log(`Spiegel-App erreichbar auf ${adresse}:${port}`));
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
			req.setEncoding("utf8");
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
			req.on("error", reject);
		});
	}

	/**
	 * Schutz vor DNS-Rebinding: Nur bekannte Namen und IP-Adressen sind erlaubt.
	 * @param {object} req Anfrage
	 * @returns {boolean} erlaubt
	 */
	hostErlaubt (req) {
		const host = String(req.headers.host || "").toLowerCase();
		const name = host.startsWith("[") ? host.slice(1, host.indexOf("]")) : host.replace(/:\d+$/, "");
		return net.isIP(name) !== 0 || this.erlaubteNamen.has(name) || name.endsWith(".ts.net");
	}

	/**
	 * Adresse für die Sperre. Hinter «tailscale serve» kommen alle Anfragen von 127.0.0.1,
	 * dann zählt die weitergereichte Herkunft des Geräts.
	 * @param {object} req Anfrage
	 * @returns {string} Adresse
	 */
	adresse (req) {
		const direkt = req.socket.remoteAddress || "?";
		const lokal = direkt === "127.0.0.1" || direkt === "::1" || direkt === "::ffff:127.0.0.1";
		const weitergereicht = String(req.headers["tailscale-user-login"] || req.headers["x-forwarded-for"] || "").split(",")[0].trim();
		return lokal && weitergereicht ? weitergereicht : direkt;
	}

	/**
	 * Gültiges Geräte-Token? Abgelaufene werden dabei entfernt.
	 * @param {object} req Anfrage
	 * @returns {boolean} angemeldet
	 */
	angemeldet (req) {
		const token = String(req.headers["x-token"] || "");
		if (!this.pin || token.length < 32) return false;
		const hash = tokenHash(token);
		const geraet = this.geraete[hash];
		if (!geraet) return false;
		if (Date.now() - geraet.erstellt > TOKEN_GUELTIG_MS) {
			delete this.geraete[hash];
			this.geraeteSpeichern();
			return false;
		}
		return true;
	}

	geraeteSpeichern () {
		speicher.schreiben(TOKEN_DATEI, { geraete: this.geraete });
	}

	/**
	 * Anmeldung mit PIN, gibt bei Erfolg ein neues Geräte-Token zurück.
	 * @param {object} req Anfrage
	 * @param {object} body { pin, name }
	 * @returns {{status: number, inhalt: object}} Antwort
	 */
	anmelden (req, body) {
		const jetzt = Date.now();
		const adresse = this.adresse(req);
		this.globaleFehler = this.globaleFehler.filter((t) => jetzt - t < 10 * 60 * 1000);
		const eintrag = this.fehlversuche.get(adresse) || { anzahl: 0, sperreBis: 0 };
		if (eintrag.sperreBis > jetzt || this.globaleFehler.length >= 20) {
			return { status: 429, inhalt: { fehler: "Zu viele falsche PINs, bitte in einigen Minuten erneut versuchen" } };
		}
		if (!this.pin) return { status: 503, inhalt: { fehler: "Auf dem Spiegel ist keine PIN gesetzt (pinnwandPin in secrets.js)" } };

		if (!gleich(String(body.pin || ""), this.pin)) {
			eintrag.anzahl += 1;
			this.globaleFehler.push(jetzt);
			if (eintrag.anzahl >= 5) {
				eintrag.anzahl = 0;
				eintrag.sperreBis = jetzt + 5 * 60 * 1000;
				Log.warn(`Spiegel-App: 5 falsche PINs von ${adresse}, für 5 Minuten gesperrt`);
			}
			this.fehlversuche.set(adresse, eintrag);
			return { status: 403, inhalt: { fehler: "Falsche PIN" } };
		}

		this.fehlversuche.delete(adresse);
		const token = crypto.randomBytes(32).toString("hex");
		const name = String(body.name || "").slice(0, 30);
		this.geraete[tokenHash(token)] = { name, erstellt: jetzt };
		// Älteste Geräte entfernen, falls es zu viele werden
		const sortiert = Object.entries(this.geraete).sort((a, b) => b[1].erstellt - a[1].erstellt);
		this.geraete = Object.fromEntries(sortiert.slice(0, MAX_GERAETE));
		this.geraeteSpeichern();
		Log.log(`Spiegel-App: neues Gerät angemeldet${name ? ` (${name})` : ""}`);
		return { status: 200, inhalt: { token } };
	}

	async anfrage (req, res) {
		let url;
		try {
			url = new URL(req.url, "http://spiegel");
		} catch {
			return this.antwort(res, 400, { fehler: "Ungültige Adresse" });
		}
		if (!this.hostErlaubt(req)) return this.antwort(res, 421, { fehler: "Unbekannter Host" });

		try {
			const datei = DATEIEN[url.pathname];
			if (req.method === "GET" && datei) {
				return this.antwort(res, 200, fs.readFileSync(path.join(__dirname, datei.name), "utf8"), datei.typ);
			}

			if (req.method === "POST" && url.pathname === "/api/anmelden") {
				const { status, inhalt } = this.anmelden(req, await this.koerper(req));
				return this.antwort(res, status, inhalt);
			}

			for (const route of this.routen) {
				const treffer = url.pathname.match(route.regex);
				if (!treffer || route.methode !== req.method) continue;
				if (!this.angemeldet(req)) return this.antwort(res, 401, { fehler: "Bitte anmelden" });
				const params = Object.fromEntries(route.namen.map((name, i) => [name, decodeURIComponent(treffer[i + 1])]));
				const body = req.method === "POST" ? await this.koerper(req) : {};
				return this.antwort(res, 200, await route.handler(params, body));
			}
			return this.antwort(res, 404, { fehler: "Nicht gefunden" });
		} catch (error) {
			if (error.status) return this.antwort(res, error.status, { fehler: error.message });
			// Interne Details (Pfade usw.) nicht nach aussen geben
			Log.error(`Anfrage ${req.method} ${url.pathname} fehlgeschlagen: ${error.stack || error.message}`);
			return this.antwort(res, 500, { fehler: "Interner Fehler" });
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
