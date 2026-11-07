/* Sicheres Lesen und Schreiben der JSON-Dateien in ~/.config.
 * Schreiben ist atomar (temporäre Datei, fsync, umbenennen), damit ein Stromausfall
 * keine halbe Datei hinterlässt. Eine unlesbare Datei wird zur Analyse beiseitegelegt
 * statt still überschrieben. Dateien sind nur für den eigenen Benutzer lesbar.
 */
const fs = require("node:fs");
const path = require("node:path");
const Log = require("logger");

/**
 * JSON-Datei lesen.
 * @param {string} datei Pfad
 * @returns {object|null} Inhalt, null wenn nicht vorhanden oder unlesbar
 */
function lesen (datei) {
	let text;
	try {
		text = fs.readFileSync(datei, "utf8");
	} catch {
		return null; // gibt es noch nicht
	}
	try {
		return JSON.parse(text);
	} catch (error) {
		const kaputt = `${datei}.kaputt-${Date.now()}`;
		try {
			fs.renameSync(datei, kaputt);
		} catch {
			// beiseitelegen ist ein Bonus
		}
		Log.error(`${path.basename(datei)} war unlesbar (${error.message}), beiseitegelegt als ${kaputt}`);
		return null;
	}
}

/**
 * JSON-Datei atomar schreiben, nur für den eigenen Benutzer lesbar.
 * @param {string} datei Pfad
 * @param {object} inhalt Daten
 */
function schreiben (datei, inhalt) {
	fs.mkdirSync(path.dirname(datei), { recursive: true });
	const tmp = `${datei}.tmp`;
	const fd = fs.openSync(tmp, "w", 0o600);
	try {
		fs.writeSync(fd, JSON.stringify(inhalt, null, "\t"));
		fs.fsyncSync(fd);
	} finally {
		fs.closeSync(fd);
	}
	fs.renameSync(tmp, datei);
}

module.exports = { lesen, schreiben };
