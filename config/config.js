/* MagicMirror² Konfiguration für den Familienspiegel
 *
 * Dokumentation: https://docs.magicmirror.builders/configuration/introduction.html
 * Private Kalenderadressen gehören in secrets.js (siehe secrets.example.js).
 */
let secrets = { calendars: [] };
try {
	secrets = require("./secrets.js");
} catch (e) {
	// Ohne secrets.js läuft der Spiegel einfach ohne Familienkalender
}

// Ermatingen TG
const STANDORT = { lat: 47.6703, lon: 9.0856 };

const config = {
	address: "localhost",
	port: 8080,
	basePath: "/",
	ipWhitelist: ["127.0.0.1", "::ffff:127.0.0.1", "::1"],

	language: "de",
	locale: "de-CH",
	logLevel: ["INFO", "LOG", "WARN", "ERROR"],
	timeFormat: 24,
	units: "metric",

	modules: [
		{
			module: "alert"
		},
		{
			module: "clock",
			position: "top_left",
			config: {
				dateFormat: "dddd, D. MMMM YYYY",
				showWeek: true
			}
		},
		{
			module: "calendar",
			header: "Familie",
			position: "top_left",
			config: {
				maximumEntries: 8,
				maximumNumberOfDays: 14,
				fade: false,
				calendars: [
					...secrets.calendars,
					{
						// Feiertage Schweiz (öffentlicher Kalender von Google)
						name: "Feiertage",
						symbol: "flag",
						fetchInterval: 7 * 24 * 60 * 60 * 1000,
						url: "https://calendar.google.com/calendar/ical/de.ch%23holiday%40group.v.calendar.google.com/public/basic.ics"
					}
				]
			}
		},
		{
			module: "weather",
			position: "top_right",
			config: {
				weatherProvider: "openmeteo",
				type: "current",
				lat: STANDORT.lat,
				lon: STANDORT.lon,
				showSun: true
			}
		},
		{
			module: "weather",
			position: "top_right",
			header: "Prognose",
			config: {
				weatherProvider: "openmeteo",
				type: "forecast",
				lat: STANDORT.lat,
				lon: STANDORT.lon,
				maxNumberOfDays: 5,
				fade: false
			}
		},
		{
			module: "compliments",
			position: "lower_third",
			config: {
				compliments: {
					morning: ["Guten Morgen!", "Bereit für den Tag?", "Zähne putzen nicht vergessen!"],
					afternoon: ["Schönen Nachmittag!", "Zeit für eine Pause?"],
					evening: ["Schönen Abend!", "Gute Nacht, ihr zwei!", "Schlaf gut!"],
					snow: ["Es schneit! Schlittenzeit?"],
					rain: ["Regenjacke und Gummistiefel!"]
				}
			}
		},
		{
			module: "newsfeed",
			position: "bottom_bar",
			config: {
				feeds: [
					{
						// Adresse bei Bedarf unter https://www.srf.ch/allgemeines/rss-feeds prüfen
						title: "SRF News",
						url: "https://www.srf.ch/news/bnf/rss/1646"
					}
				],
				showSourceTitle: true,
				showPublishDate: true,
				updateInterval: 15 * 1000
			}
		}
	]
};

/*************** DO NOT EDIT THE LINE BELOW ***************/
if (typeof module !== "undefined") { module.exports = config; }
