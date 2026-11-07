/* Zeigt die nächsten Abfahrten einer Haltestelle in der Schweiz an. */
Module.register("MMM-OeV", {
	defaults: {
		station: "Ermatingen",
		apiBase: "https://transport.opendata.ch/v1",
		transportations: [],     // z. B. ["train"] oder ["bus"], leer = alle
		limit: 5,                // angezeigte Abfahrten
		fetchLimit: 15,          // geladene Abfahrten, damit nach dem Filtern genug übrig bleiben
		walkingTime: 0,          // Minuten bis zur Haltestelle; was nicht mehr erreichbar ist, wird ausgeblendet
		countdownMinutes: 20,    // bis zu dieser Wartezeit «in X Min.» statt Uhrzeit
		updateInterval: 60 * 1000
	},

	getStyles () {
		return ["MMM-OeV.css"];
	},

	start () {
		this.departures = null;
		this.failed = false;
		this.sendSocketNotification("OEV_START", { id: this.identifier, config: this.config });
		// Jede halbe Minute neu zeichnen, damit der Countdown stimmt
		setInterval(() => this.updateDom(), 30 * 1000);
	},

	socketNotificationReceived (notification, payload) {
		if (payload.id !== this.identifier) return;
		if (notification === "OEV_DATA") {
			this.departures = payload.departures;
			this.failed = false;
			if (!this.data.header) this.data.header = payload.station;
		} else if (notification === "OEV_ERROR") {
			this.failed = true;
		}
		this.updateDom(500);
	},

	getDom () {
		const wrapper = document.createElement("div");
		wrapper.className = "oev";

		if (!this.departures) {
			wrapper.className += " dimmed light small";
			wrapper.textContent = this.failed ? "Fahrplan nicht erreichbar" : "Fahrplan wird geladen …";
			return wrapper;
		}

		const now = Date.now();
		const reachable = this.departures
			.filter((dep) => dep.departure + dep.delay * 60000 - now >= this.config.walkingTime * 60000)
			.slice(0, this.config.limit);

		const table = document.createElement("table");
		table.className = "small";
		reachable.forEach((dep, index) => {
			const row = document.createElement("tr");
			row.style.opacity = String(1 - index * (0.6 / Math.max(1, this.config.limit)));

			const line = document.createElement("td");
			const badge = document.createElement("span");
			badge.className = `oev-line oev-${dep.category.toLowerCase()}`;
			badge.textContent = dep.line;
			line.appendChild(badge);

			const to = document.createElement("td");
			to.className = "oev-to bright";
			to.textContent = dep.to;

			const time = document.createElement("td");
			time.className = "oev-time";
			const minutes = Math.round((dep.departure + dep.delay * 60000 - now) / 60000);
			if (minutes <= 0) {
				time.textContent = "jetzt";
			} else if (minutes <= this.config.countdownMinutes) {
				time.textContent = `${minutes} Min.`;
			} else {
				time.textContent = moment(dep.departure).format("HH:mm");
			}
			if (dep.delay > 0) {
				const delay = document.createElement("span");
				delay.className = "oev-delay";
				delay.textContent = ` +${dep.delay}`;
				time.appendChild(delay);
			}

			row.append(line, to, time);
			table.appendChild(row);
		});

		wrapper.appendChild(table);
		return wrapper;
	}
});
