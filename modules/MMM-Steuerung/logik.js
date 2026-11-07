/* Reine Logik der Steuerzentrale, ohne Hardware und ohne MagicMirror².
 * Dadurch lässt sie sich mit «node --test» prüfen (siehe logik.test.js).
 */

const TAGE = ["so", "mo", "di", "mi", "do", "fr", "sa"];
const MODI = ["an", "sensor", "aus"];

const STANDARD_EINSTELLUNGEN = {
	standard: "sensor",
	wochenplan: {
		mo: [{ von: "06:30", bis: "08:00", modus: "an" }, { von: "22:00", bis: "24:00", modus: "aus" }, { von: "00:00", bis: "06:00", modus: "aus" }],
		di: [{ von: "06:30", bis: "08:00", modus: "an" }, { von: "22:00", bis: "24:00", modus: "aus" }, { von: "00:00", bis: "06:00", modus: "aus" }],
		mi: [{ von: "06:30", bis: "08:00", modus: "an" }, { von: "22:00", bis: "24:00", modus: "aus" }, { von: "00:00", bis: "06:00", modus: "aus" }],
		do: [{ von: "06:30", bis: "08:00", modus: "an" }, { von: "22:00", bis: "24:00", modus: "aus" }, { von: "00:00", bis: "06:00", modus: "aus" }],
		fr: [{ von: "06:30", bis: "08:00", modus: "an" }, { von: "22:30", bis: "24:00", modus: "aus" }, { von: "00:00", bis: "06:00", modus: "aus" }],
		sa: [{ von: "07:30", bis: "09:30", modus: "an" }, { von: "22:30", bis: "24:00", modus: "aus" }, { von: "00:00", bis: "07:00", modus: "aus" }],
		so: [{ von: "07:30", bis: "09:30", modus: "an" }, { von: "22:00", bis: "24:00", modus: "aus" }, { von: "00:00", bis: "07:00", modus: "aus" }]
	},
	sensor: {
		schwelleCm: 100,   // näher als das gilt als anwesend
		verweilenSek: 2,   // so lange muss jemand stehen bleiben, damit der TV angeht (Durchgangsbereich)
		ruheStd: 4,        // nach so langer Ruhe geht der TV bei der ersten Bewegung sofort an (Morgengruss)
		nachlaufMin: 2,    // so lange bleibt der TV nach der letzten Anwesenheit an
		nahCm: 15          // näher als das gilt als Hand für Gesten
	},
	gesten: true
};

/**
 * «HH:MM» in Minuten seit Mitternacht, «24:00» ergibt 1440.
 * @param {string} zeit Uhrzeit
 * @returns {number} Minuten
 */
function minuten (zeit) {
	const [h, m] = zeit.split(":").map(Number);
	return h * 60 + m;
}

/**
 * Einstellungen aus der App prüfen und bereinigen. Wirft bei ungültigen Werten.
 * @param {object} eingabe Einstellungen
 * @returns {object} bereinigte Einstellungen
 */
function pruefen (eingabe) {
	const zeitOk = (z) => typeof z === "string" && /^([01]\d|2[0-3]):[0-5]\d$|^24:00$/.test(z);
	if (!MODI.includes(eingabe.standard)) throw new Error("Ungültige Standard-Betriebsart");
	const wochenplan = {};
	for (const tag of TAGE) {
		const fenster = eingabe.wochenplan?.[tag] || [];
		if (!Array.isArray(fenster) || fenster.length > 12) throw new Error(`Ungültiger Plan für ${tag}`);
		wochenplan[tag] = fenster.map((f) => {
			if (!zeitOk(f.von) || !zeitOk(f.bis) || !MODI.includes(f.modus)) throw new Error(`Ungültiges Zeitfenster am ${tag}`);
			if (minuten(f.von) >= minuten(f.bis)) throw new Error(`Zeitfenster am ${tag}: «von» muss vor «bis» liegen`);
			return { von: f.von, bis: f.bis, modus: f.modus };
		});
	}
	const zahl = (wert, min, max, name) => {
		const n = Number(wert);
		if (!Number.isFinite(n) || n < min || n > max) throw new Error(`${name} muss zwischen ${min} und ${max} liegen`);
		return n;
	};
	return {
		standard: eingabe.standard,
		wochenplan,
		sensor: {
			schwelleCm: zahl(eingabe.sensor?.schwelleCm, 20, 400, "Schwelle"),
			verweilenSek: zahl(eingabe.sensor?.verweilenSek ?? STANDARD_EINSTELLUNGEN.sensor.verweilenSek, 0, 30, "Verweilen"),
			ruheStd: zahl(eingabe.sensor?.ruheStd ?? STANDARD_EINSTELLUNGEN.sensor.ruheStd, 0, 24, "Ruhezeit"),
			nachlaufMin: zahl(eingabe.sensor?.nachlaufMin, 0.5, 60, "Nachlauf"),
			nahCm: zahl(eingabe.sensor?.nahCm, 3, 40, "Gestengrenze")
		},
		gesten: Boolean(eingabe.gesten)
	};
}

/**
 * Betriebsart laut Plan zu einem Zeitpunkt. Das erste passende Fenster gewinnt.
 * @param {object} einstellungen Einstellungen
 * @param {Date} datum Zeitpunkt (Ortszeit)
 * @returns {{modus: string, quelle: string, fenster: object|null}} Betriebsart und Herkunft
 */
function modusLautPlan (einstellungen, datum) {
	const tag = TAGE[datum.getDay()];
	const jetzt = datum.getHours() * 60 + datum.getMinutes();
	for (const f of einstellungen.wochenplan[tag] || []) {
		if (jetzt >= minuten(f.von) && jetzt < minuten(f.bis)) return { modus: f.modus, quelle: "zeitplan", fenster: f };
	}
	return { modus: einstellungen.standard, quelle: "standard", fenster: null };
}

/**
 * Entscheidet, ob der TV an sein soll.
 * @param {object} p Parameter
 * @param {object} p.einstellungen Einstellungen
 * @param {Date} p.datum jetzt
 * @param {object|null} p.uebersteuerung { modus: "an"|"aus", bis: ms }
 * @param {number|null} p.letzteAnwesenheit Zeitpunkt der letzten Anwesenheit (ms)
 * @param {number|null} p.anwesendSeit Beginn der laufenden Anwesenheit (ms), null wenn niemand da
 * @param {number|null} p.ruhigSeit Ende der Anwesenheit davor (ms), null wenn unbekannt
 * @param {boolean} p.tvAn ob der TV gerade an ist
 * @param {boolean} p.sensorOk ob der Sensor Werte liefert
 * @returns {{an: boolean, modus: string, grund: string}} Entscheid
 */
function entscheiden ({ einstellungen, datum, uebersteuerung, letzteAnwesenheit, anwesendSeit = null, ruhigSeit = null, tvAn = false, sensorOk }) {
	const jetzt = datum.getTime();
	if (uebersteuerung && uebersteuerung.bis > jetzt) {
		return { an: uebersteuerung.modus === "an", modus: uebersteuerung.modus, grund: "manuell" };
	}
	const plan = modusLautPlan(einstellungen, datum);
	if (plan.modus === "an") return { an: true, modus: "an", grund: plan.quelle };
	if (plan.modus === "aus") return { an: false, modus: "aus", grund: plan.quelle };
	if (!sensorOk) return { an: false, modus: "sensor", grund: "sensor fehlt" };
	const s = einstellungen.sensor;

	// Läuft der TV schon, bleibt er an, bis der Nachlauf ohne Anwesenheit abgelaufen ist
	if (tvAn) {
		const nochDa = letzteAnwesenheit !== null && jetzt - letzteAnwesenheit < s.nachlaufMin * 60 * 1000;
		return { an: nochDa, modus: "sensor", grund: nochDa ? "sensor" : "niemand da" };
	}
	if (anwesendSeit === null) return { an: false, modus: "sensor", grund: "niemand da" };

	// Morgengruss: erste Bewegung nach langer Ruhe schaltet sofort ein, auch im Vorbeigehen
	const langeRuhig = s.ruheStd > 0 && (ruhigSeit === null || anwesendSeit - ruhigSeit >= s.ruheStd * 3600 * 1000);
	if (langeRuhig) return { an: true, modus: "sensor", grund: "morgengruss" };

	// Durchgangsbereich: nur wer stehen bleibt, weckt den Spiegel
	const verweilt = jetzt - anwesendSeit >= s.verweilenSek * 1000;
	return { an: verweilt, modus: "sensor", grund: verweilt ? "sensor" : "vorbeigehend" };
}

/**
 * Erkennt Gesten aus einer Folge von Distanzmessungen eines Ultraschallsensors.
 * Tippen: Hand kurz nah vor den Sensor halten und wegziehen.
 * Halten: Hand mindestens 2 Sekunden nah halten (wird einmal gemeldet).
 */
class GestenErkennung {
	constructor ({ tippenMinMs = 150, tippenMaxMs = 1200, haltenMs = 2000, pauseMs = 1000 } = {}) {
		Object.assign(this, { tippenMinMs, tippenMaxMs, haltenMs, pauseMs });
		this.werte = [];
		this.nahSeit = null;
		this.gehalten = false;
		this.sperreBis = 0;
	}

	/**
	 * Eine Messung verarbeiten.
	 * @param {number} zeit Zeitpunkt in ms
	 * @param {number|null} distanz Distanz in cm, null ohne Echo
	 * @param {number} nahCm Grenze für «nah»
	 * @returns {string|null} "tippen", "halten" oder null
	 */
	messung (zeit, distanz, nahCm) {
		// Median der letzten drei Werte glättet einzelne Fehlmessungen
		this.werte.push(distanz ?? Infinity);
		if (this.werte.length > 3) this.werte.shift();
		const median = [...this.werte].sort((a, b) => a - b)[Math.floor(this.werte.length / 2)];
		const nah = median < nahCm;

		if (nah) {
			if (this.nahSeit === null) {
				this.nahSeit = zeit;
				this.gehalten = false;
			}
			if (!this.gehalten && zeit - this.nahSeit >= this.haltenMs && zeit >= this.sperreBis) {
				this.gehalten = true;
				this.sperreBis = zeit + this.pauseMs;
				return "halten";
			}
			return null;
		}

		if (this.nahSeit !== null) {
			const dauer = zeit - this.nahSeit;
			const warGehalten = this.gehalten;
			this.nahSeit = null;
			this.gehalten = false;
			if (!warGehalten && dauer >= this.tippenMinMs && dauer <= this.tippenMaxMs && zeit >= this.sperreBis) {
				this.sperreBis = zeit + this.pauseMs;
				return "tippen";
			}
		}
		return null;
	}
}

module.exports = { STANDARD_EINSTELLUNGEN, TAGE, MODI, minuten, pruefen, modusLautPlan, entscheiden, GestenErkennung };
