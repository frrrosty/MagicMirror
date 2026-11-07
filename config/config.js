/* MagicMirror² Konfiguration für den Familienspiegel
 *
 * Dokumentation: https://docs.magicmirror.builders/configuration/introduction.html
 * Persönliches (Kalender, Geburtstage, Entsorgung) gehört in secrets.js,
 * siehe secrets.example.js. Ohne secrets.js läuft der Spiegel trotzdem.
 */
let secrets = {};
try {
	secrets = require("./secrets.js");
} catch (e) {
	// Ohne secrets.js fehlen nur die persönlichen Inhalte
}

// Ermatingen TG
const STANDORT = { lat: 47.6703, lon: 9.0856 };
const HALTESTELLE = "Ermatingen";

/* Sprüche in Mundart, je nach Tageszeit, Wetter und Datum.
 * Wetterschlüssel siehe https://docs.magicmirror.builders/modules/compliments.html
 */
const sprueche = {
	anytime: [
		"Hoi zäme!",
		"Du gsehsch guet us!",
		"Hüt wird en guete Tag.",
		"Lächle, es chunnt guet."
	],
	morning: [
		"Guete Morge!",
		"Händ ihr guet gschlofe?",
		"Zähnli putze nöd vergässe!",
		"En Kafi, und dänn los."
	],
	afternoon: [
		"En schöne Namittag!",
		"Ziit für es Zvieri?",
		"Halbziit, wiiter so!"
	],
	evening: [
		"En schöne Abig!",
		"Guet Nacht, ihr zwei!",
		"Schlofed guet und tröimed süess.",
		"Pyjama-Ziit!"
	],
	// Wetter
	day_sunny: ["Sunnebrülle nöd vergässe!", "Perfekts Wätter für de Spielplatz."],
	night_clear: ["Lueg mol, d Stärne!"],
	day_showers: ["Rägejagge und Gummistifel!", "Pfütze-Hüpf-Wätter!"],
	day_sprinkle: ["Es tröpfelet, lieber en Schirm mitnäh."],
	day_thunderstorm: ["Es chlöpft dusse, lieber dinne bliibe."],
	"day_snow-wind": ["Es schneit! Schlitte-Ziit!", "Händsche und Chappe aalegge!"],
	day_fog: ["Nebel am See, obe isch d Sunne."],
	// Feste Tage
	"....-01-01": ["Es guets Neus!"],
	"....-02-14": ["Schöne Valentinstag!"],
	"....-08-01": ["Schöne Nationalfiirtig!"],
	"....-12-06": ["Hüt chunnt de Samichlaus!"],
	"....-12-24": ["Schöni Wiehnachte!"],
	"....-12-25": ["Schöni Wiehnachte!"],
	"....-12-31": ["En guete Rutsch!"]
};

// Geburtstage aus secrets.js ergänzen, z. B. { name: "Anna", datum: "03-15" }
for (const { name, datum } of secrets.geburtstage || []) {
	const schluessel = `....-${datum}`;
	sprueche[schluessel] = [...(sprueche[schluessel] || []), `Happy Birthday, ${name}!`, `Alles Gueti zum Geburtstag, ${name}!`];
}

const modules = [
	{
		module: "alert"
	},

	// Oben links: Zeit und Familie
	{
		module: "clock",
		position: "top_left",
		config: {
			dateFormat: "dddd, D. MMMM",
			displaySeconds: false,
			showWeek: true,
			showSunTimes: false
		}
	},
	{
		module: "calendar",
		header: "Familie",
		position: "top_left",
		config: {
			maximumEntries: 7,
			maximumNumberOfDays: 21,
			fade: true,
			fadePoint: 0.5,
			wrapEvents: true,
			maxTitleLength: 30,
			timeFormat: "relative",
			getRelative: 12,
			urgency: 2,
			dateFormat: "dd, D. MMM",
			fullDayEventDateFormat: "dd, D. MMM",
			showEnd: false,
			customEvents: [
				{ keyword: "Geburtstag", symbol: "cake-candles" },
				{ keyword: "Arzt", symbol: "stethoscope" },
				{ keyword: "Spielgruppe", symbol: "children" },
				{ keyword: "Kita", symbol: "children" },
				{ keyword: "Ferien", symbol: "umbrella-beach" },
				{ keyword: "Training", symbol: "person-running" }
			],
			calendars: [
				...(secrets.calendars || []),
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

	// Oben rechts: Wetter am See
	{
		module: "weather",
		position: "top_right",
		config: {
			weatherProvider: "openmeteo",
			type: "current",
			lat: STANDORT.lat,
			lon: STANDORT.lon,
			showSun: true,
			showFeelsLike: true,
			showHumidity: "feelslike",
			showUVIndex: true,
			roundTemp: true,
			degreeLabel: true
		}
	},
	{
		module: "weather",
		position: "top_right",
		header: "Die nächsten Stunden",
		config: {
			weatherProvider: "openmeteo",
			type: "hourly",
			lat: STANDORT.lat,
			lon: STANDORT.lon,
			maxEntries: 6,
			showPrecipitationProbability: true,
			roundTemp: true,
			fade: false,
			colored: true
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
			showPrecipitationAmount: true,
			roundTemp: true,
			fade: false,
			colored: true
		}
	},

	// Unten links: Abfahrten und Entsorgung
	{
		module: "MMM-OeV",
		position: "bottom_left",
		header: `Abfahrten ${HALTESTELLE}`,
		config: {
			station: HALTESTELLE,
			limit: 4,
			walkingTime: secrets.gehzeitHaltestelle || 0
		}
	},

	// Mitte: Platz fürs Spiegelbild, darunter ein Spruch
	{
		module: "compliments",
		position: "lower_third",
		config: {
			compliments: sprueche,
			updateInterval: 60 * 1000,
			fadeSpeed: 3000,
			morningEndTime: 11,
			afternoonEndTime: 18,
			specialDayUnique: true
		}
	},

	// Ganz unten: Nachrichten
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
			showDescription: false,
			updateInterval: 20 * 1000
		}
	}
];

// Entsorgungskalender der Gemeinde, nur wenn in secrets.js hinterlegt
if (secrets.entsorgung) {
	modules.splice(modules.findIndex((m) => m.module === "compliments"), 0, {
		module: "calendar",
		header: "Entsorgung",
		position: "bottom_left",
		config: {
			maximumEntries: 3,
			maximumNumberOfDays: 14,
			fade: false,
			dateFormat: "dd, D. MMM",
			fullDayEventDateFormat: "dd, D. MMM",
			timeFormat: "absolute",
			showEnd: false,
			broadcastEvents: false,
			customEvents: [
				{ keyword: "Papier", symbol: "newspaper" },
				{ keyword: "Karton", symbol: "box" },
				{ keyword: "Grün", symbol: "leaf" },
				{ keyword: "Kehricht", symbol: "trash" }
			],
			calendars: [{ name: "Entsorgung", symbol: "recycle", url: secrets.entsorgung }]
		}
	});
}

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

	modules
};

/*************** DO NOT EDIT THE LINE BELOW ***************/
if (typeof module !== "undefined") { module.exports = config; }
