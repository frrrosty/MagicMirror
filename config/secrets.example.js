/* Vorlage: Kopieren nach secrets.js und eigene Angaben eintragen.
 * secrets.js wird von git ignoriert und nie hochgeladen. Alles ist optional:
 * Was fehlt oder leer bleibt, wird auf dem Spiegel einfach nicht angezeigt.
 */
module.exports = {
	// Familienkalender (ICS-Links), siehe docs/software.md
	calendars: [
		{
			name: "Familie",
			symbol: "house",
			// ICS-Link aus Outlook.com: Einstellungen > Kalender > Freigegebene Kalender > Kalender veröffentlichen
			url: "https://outlook.live.com/owa/calendar/HIER_ADRESSE/calendar.ics"
		}
		// Weitere Kalender einfach anhängen, z. B. mit eigener Farbe:
		// { name: "Papi", symbol: "user", color: "#9cf", url: "https://..." }
	],

	// Geburtstage für die Sprüche am jeweiligen Tag (Monat-Tag)
	geburtstage: [
		// { name: "Anna", datum: "03-15" },
		// { name: "Ben", datum: "09-02" }
	],

	// PIN für die Spiegel-App auf dem Handy (Port 8081), in Anführungszeichen,
	// mindestens 6 Ziffern. Ohne PIN lässt die App niemanden herein.
	pinnwandPin: "",

	// Gehzeit zur Haltestelle in Minuten; Verbindungen, die nicht mehr erreichbar sind, werden ausgeblendet
	gehzeitHaltestelle: 5
};
