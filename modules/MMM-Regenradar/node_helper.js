/* Holt die Liste der Radarbilder von RainViewer (kostenlos, ohne Schlüssel). */
const NodeHelper = require("node_helper");
const Log = require("logger");

module.exports = NodeHelper.create({
	start () {
		Log.log(`Starting node helper for: ${this.name}`);
		this.timer = null;
	},

	socketNotificationReceived (notification, payload) {
		if (notification !== "RADAR_START") return;
		clearInterval(this.timer);
		this.holen(payload.apiUrl);
		this.timer = setInterval(() => this.holen(payload.apiUrl), payload.updateInterval);
	},

	async holen (apiUrl) {
		try {
			const response = await fetch(apiUrl, { signal: AbortSignal.timeout(15000) });
			if (!response.ok) throw new Error(`HTTP ${response.status}`);
			const data = await response.json();
			const radar = data.radar || {};
			const bilder = [
				...(radar.past || []).map((f) => ({ ...f, prognose: false })),
				...(radar.nowcast || []).map((f) => ({ ...f, prognose: true }))
			];
			this.sendSocketNotification("RADAR_DATEN", { host: data.host, bilder });
		} catch (error) {
			Log.warn(`Radarbilder nicht geladen: ${error.message}`);
			this.sendSocketNotification("RADAR_FEHLER");
		}
	}
});
