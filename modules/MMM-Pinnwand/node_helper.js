/* Pinnwand: To-dos, Familiennachricht sowie Sprüche und Erinnerungen vom Handy.
 * Die Schnittstellen hängen am gemeinsamen App-Server (modules/spiegel-app).
 * Daten liegen in ~/.config/magicmirror-pinnwand.json.
 */
const os = require("node:os");
const path = require("node:path");
const crypto = require("node:crypto");
const NodeHelper = require("node_helper");
const Log = require("logger");
const app = require("../spiegel-app/server.js");
const speicher = require("../spiegel-app/speicher.js");

const DATEI = path.join(os.homedir(), ".config", "magicmirror-pinnwand.json");
const ERLEDIGT_BEHALTEN_MS = 7 * 24 * 60 * 60 * 1000;
const MAX_TODO = 120;
const MAX_NACHRICHT = 200;
const MAX_SPRUCH = 80;
const WANN = ["anytime", "morning", "afternoon", "evening"];
const MAX_TODOS = 200;
const MAX_SPRUECHE = 100;

/**
 * Heutiges Datum als JJJJ-MM-TT in Ortszeit.
 * @returns {string} Datum
 */
const heute = () => new Date().toLocaleDateString("sv-SE");

module.exports = NodeHelper.create({
	start () {
		Log.log(`Starting node helper for: ${this.name}`);
		this.daten = this.laden();
		this.schnittstellen(app.holen());
		// Abgelaufene Nachrichten und alte erledigte Einträge regelmässig aufräumen
		setInterval(() => this.aufraeumen(true), 5 * 60 * 1000);
	},

	schnittstellen (server) {
		server.route("GET", "/api/pinnwand", () => {
			this.aufraeumen(false);
			return this.daten;
		});

		server.route("POST", "/api/pinnwand/todos", (params, body) => {
			const text = String(body.text || "").trim().slice(0, MAX_TODO);
			if (!text) throw app.fehler(400, "Text fehlt");
			if (this.daten.todos.length >= MAX_TODOS) throw app.fehler(400, "Zu viele Einträge, bitte erledigte löschen");
			this.daten.todos.push({ id: crypto.randomUUID(), text, von: this.von(body), erstellt: Date.now(), erledigt: null });
			return this.geaendert();
		});

		server.route("POST", "/api/pinnwand/todos/:id", ({ id }, body) => {
			this.todo(id).erledigt = body.erledigt ? Date.now() : null;
			return this.geaendert();
		});

		server.route("DELETE", "/api/pinnwand/todos/:id", ({ id }) => {
			const todo = this.todo(id);
			this.daten.todos = this.daten.todos.filter((t) => t !== todo);
			return this.geaendert();
		});

		server.route("POST", "/api/pinnwand/nachricht", (params, body) => {
			const text = String(body.text || "").trim().slice(0, MAX_NACHRICHT);
			if (!text) throw app.fehler(400, "Text fehlt");
			const stunden = Math.min(Math.max(Number(body.stunden) || 4, 0.5), 24 * 7);
			this.daten.nachricht = { text, von: this.von(body), erstellt: Date.now(), bis: Date.now() + stunden * 3600 * 1000 };
			return this.geaendert();
		});

		server.route("DELETE", "/api/pinnwand/nachricht", () => {
			this.daten.nachricht = null;
			return this.geaendert();
		});

		server.route("POST", "/api/pinnwand/sprueche", (params, body) => {
			const text = String(body.text || "").trim().slice(0, MAX_SPRUCH);
			if (!text) throw app.fehler(400, "Text fehlt");
			const wann = WANN.includes(body.wann) ? body.wann : "anytime";
			const datum = /^\d{4}-\d{2}-\d{2}$/.test(body.datum || "") ? body.datum : null;
			if (datum && datum < heute()) throw app.fehler(400, "Datum liegt in der Vergangenheit");
			if (this.daten.sprueche.length >= MAX_SPRUECHE) throw app.fehler(400, "Zu viele Sprüche");
			this.daten.sprueche.push({ id: crypto.randomUUID(), text, wann, datum, von: this.von(body), erstellt: Date.now() });
			return this.geaendert();
		});

		server.route("DELETE", "/api/pinnwand/sprueche/:id", ({ id }) => {
			const vorher = this.daten.sprueche.length;
			this.daten.sprueche = this.daten.sprueche.filter((s) => s.id !== id);
			if (this.daten.sprueche.length === vorher) throw app.fehler(404, "Spruch nicht gefunden");
			return this.geaendert();
		});
	},

	von (body) {
		return String(body.von || "").trim().slice(0, 20);
	},

	todo (id) {
		const todo = this.daten.todos.find((t) => t.id === id);
		if (!todo) throw app.fehler(404, "Eintrag nicht gefunden");
		return todo;
	},

	socketNotificationReceived (notification) {
		if (notification === "PINNWAND_HOLEN") this.senden();
	},

	laden () {
		const d = speicher.lesen(DATEI) || {};
		return {
			todos: Array.isArray(d.todos) ? d.todos : [],
			nachricht: d.nachricht && typeof d.nachricht === "object" ? d.nachricht : null,
			sprueche: Array.isArray(d.sprueche) ? d.sprueche : []
		};
	},

	speichern () {
		speicher.schreiben(DATEI, this.daten);
	},

	aufraeumen (mitSenden) {
		const jetzt = Date.now();
		const vorher = JSON.stringify(this.daten);
		this.daten.todos = this.daten.todos.filter((t) => !t.erledigt || jetzt - t.erledigt < ERLEDIGT_BEHALTEN_MS);
		if (this.daten.nachricht && this.daten.nachricht.bis < jetzt) this.daten.nachricht = null;
		// Erinnerungen für vergangene Tage entfernen
		this.daten.sprueche = this.daten.sprueche.filter((s) => !s.datum || s.datum >= heute());
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
		return this.daten;
	}
});
