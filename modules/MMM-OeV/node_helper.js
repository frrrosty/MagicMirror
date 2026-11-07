/* Holt Abfahrten von transport.opendata.ch (Fahrplandaten der SBB, ohne API-Schlüssel). */
const NodeHelper = require("node_helper");
const Log = require("logger");

/**
 * Liniennummer wie «S1» oder «B940». Lange Zahlen sind Zugnummern, keine Linien,
 * dann bleibt nur die Kategorie.
 * @param {object} journey Eintrag aus dem stationboard
 * @returns {string} Bezeichnung für die Anzeige
 */
function lineLabel (journey) {
	const category = journey.category || "";
	const number = String(journey.number || "");
	if (!number || number === category || /^\d{4,}$/.test(number)) return category;
	return number.startsWith(category) ? number : `${category}${number}`;
}

module.exports = NodeHelper.create({
	start () {
		Log.log(`Starting node helper for: ${this.name}`);
		this.timers = {};
	},

	socketNotificationReceived (notification, payload) {
		if (notification !== "OEV_START") return;
		const { id, config } = payload;
		clearInterval(this.timers[id]);
		this.fetchDepartures(id, config);
		this.timers[id] = setInterval(() => this.fetchDepartures(id, config), config.updateInterval);
	},

	async fetchDepartures (id, config) {
		const params = new URLSearchParams({ station: config.station, limit: String(config.fetchLimit) });
		for (const type of config.transportations) params.append("transportations[]", type);
		const url = `${config.apiBase}/stationboard?${params}`;

		try {
			const response = await fetch(url, { signal: AbortSignal.timeout(15000) });
			if (!response.ok) throw new Error(`HTTP ${response.status}`);
			const data = await response.json();
			const destinations = config.destinations.map((ziel) => ziel.toLowerCase());
			const departures = (data.stationboard || [])
				.filter((journey) => !destinations.length || destinations.some((ziel) => (journey.to || "").toLowerCase().includes(ziel)))
				.map((journey) => ({
					line: lineLabel(journey),
					category: journey.category || "",
					to: journey.to,
					departure: journey.stop.departureTimestamp * 1000,
					delay: journey.stop.delay || 0,
					platform: journey.stop.platform || ""
				}));
			this.sendSocketNotification("OEV_DATA", { id, station: data.station?.name || config.station, departures });
		} catch (error) {
			Log.warn(`[MMM-OeV] Abfahrten für ${config.station} nicht geladen: ${error.message}`);
			this.sendSocketNotification("OEV_ERROR", { id });
		}
	}
});
