/* Tests der Steuerlogik. Ausführen mit: node --test modules/MMM-Steuerung/ */
const test = require("node:test");
const assert = require("node:assert/strict");
const { STANDARD_EINSTELLUNGEN, pruefen, modusLautPlan, entscheiden, GestenErkennung } = require("./logik.js");

const E = STANDARD_EINSTELLUNGEN;
// 9. November 2026 ist ein Montag
const am = (stunde, minute = 0, tag = 9) => new Date(2026, 10, tag, stunde, minute);

test("Zeitplan: Morgenfenster, Nachtruhe und Standard", () => {
	assert.equal(modusLautPlan(E, am(7, 0)).modus, "an");
	assert.equal(modusLautPlan(E, am(8, 0)).modus, "sensor"); // «bis» gehört nicht mehr dazu
	assert.equal(modusLautPlan(E, am(8, 0)).quelle, "standard");
	assert.equal(modusLautPlan(E, am(23, 30)).modus, "aus");
	assert.equal(modusLautPlan(E, am(3, 0)).modus, "aus");
	assert.equal(modusLautPlan(E, am(8, 0, 14)).modus, "an"); // Samstag 8 Uhr
});

test("Vorrang: Übersteuerung vor Plan, abgelaufene zählt nicht", () => {
	const datum = am(3, 0);
	const basis = { einstellungen: E, datum, letzteAnwesenheit: null, sensorOk: true };
	assert.equal(entscheiden({ ...basis, uebersteuerung: { modus: "an", bis: datum.getTime() + 1000 } }).an, true);
	assert.equal(entscheiden({ ...basis, uebersteuerung: { modus: "an", bis: datum.getTime() - 1 } }).an, false);
});

test("Sensorbetrieb: Nachlauf und fehlender Sensor", () => {
	const datum = am(10, 0);
	const t = datum.getTime();
	const basis = { einstellungen: E, datum, uebersteuerung: null, sensorOk: true, tvAn: true };
	assert.equal(entscheiden({ ...basis, letzteAnwesenheit: t - 60 * 1000 }).an, true);
	assert.equal(entscheiden({ ...basis, letzteAnwesenheit: t - 3 * 60 * 1000 }).an, false);
	assert.equal(entscheiden({ ...basis, letzteAnwesenheit: null }).an, false);
	assert.equal(entscheiden({ ...basis, letzteAnwesenheit: t, sensorOk: false }).grund, "sensor fehlt");
});

test("Durchgangsbereich: Vorbeigehen, Verweilen, Morgengruss", () => {
	const datum = am(10, 0);
	const t = datum.getTime();
	const basis = { einstellungen: E, datum, uebersteuerung: null, sensorOk: true, tvAn: false, letzteAnwesenheit: t };
	const kurzRuhig = t - 20 * 60 * 1000; // vor 20 Minuten war schon jemand da
	// Seit einer Sekunde da, vorher kurz ruhig: vorbeigehend
	assert.equal(entscheiden({ ...basis, anwesendSeit: t - 1000, ruhigSeit: kurzRuhig }).grund, "vorbeigehend");
	// Seit drei Sekunden da: stehen geblieben
	assert.equal(entscheiden({ ...basis, anwesendSeit: t - 3000, ruhigSeit: kurzRuhig }).an, true);
	// Erste Bewegung nach der Nacht: sofort an
	assert.equal(entscheiden({ ...basis, anwesendSeit: t - 200, ruhigSeit: t - 8 * 3600 * 1000 }).grund, "morgengruss");
	// Nach einem Neustart ohne Vorgeschichte gilt das wie ein Morgen
	assert.equal(entscheiden({ ...basis, anwesendSeit: t - 200, ruhigSeit: null }).an, true);
	// Niemand da
	assert.equal(entscheiden({ ...basis, anwesendSeit: null, ruhigSeit: kurzRuhig }).an, false);
});

test("Prüfung der Einstellungen", () => {
	assert.deepEqual(pruefen(E), E);
	assert.throws(() => pruefen({ ...E, standard: "vielleicht" }));
	assert.throws(() => pruefen({ ...E, wochenplan: { ...E.wochenplan, mo: [{ von: "09:00", bis: "08:00", modus: "an" }] } }));
	assert.throws(() => pruefen({ ...E, wochenplan: { ...E.wochenplan, mo: [{ von: "25:00", bis: "26:00", modus: "an" }] } }));
	assert.throws(() => pruefen({ ...E, sensor: { ...E.sensor, schwelleCm: 5 } }));
});

/**
 * Spielt eine Folge von [Dauer in ms, Distanz] im 100-ms-Takt ab.
 * @param {Array<[number, number|null]>} folge Abschnitte
 * @returns {string[]} erkannte Gesten
 */
function abspielen (folge) {
	const g = new GestenErkennung();
	const gesten = [];
	let zeit = 0;
	for (const [dauer, distanz] of folge) {
		for (let i = 0; i < dauer; i += 100) {
			const geste = g.messung(zeit, distanz, 15);
			if (geste) gesten.push(geste);
			zeit += 100;
		}
	}
	return gesten;
}

test("Gesten: Tippen, Halten und nichts", () => {
	assert.deepEqual(abspielen([[1000, 80], [500, 8], [1000, 80]]), ["tippen"]);
	assert.deepEqual(abspielen([[1000, 80], [3000, 8], [1000, 80]]), ["halten"]);
	assert.deepEqual(abspielen([[1000, 80], [100, 8], [1000, 80]]), []); // einzelner Ausreisser
	assert.deepEqual(abspielen([[5000, 60]]), []); // Person steht davor
	assert.deepEqual(abspielen([[1000, 80], [500, 8], [300, 80], [500, 8], [1000, 80]]), ["tippen"]); // zu schnell hintereinander
	assert.deepEqual(abspielen([[1000, 80], [500, 8], [1500, 80], [500, 8], [1000, 80]]), ["tippen", "tippen"]);
});
