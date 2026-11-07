/* Animiertes Regenradar von MeteoSchweiz um den eigenen Standort.
 * Die Bilder rechnet radar.py auf dem Pi, der Browser spielt sie nur ab.
 */
Module.register("MMM-Regenradar", {
	defaults: {
		lat: 47.6703,
		lon: 9.0856,
		breiteKm: 150,           // Ausschnitt in Kilometern
		hoeheKm: 85,
		breite: 440,             // Grösse auf dem Spiegel in Pixeln
		hoehe: 250,
		bilder: 12,              // Anzahl Radarbilder (je 5 Min., also 1 Stunde)
		bildDauer: 400,          // Millisekunden pro Bild
		pauseAmEnde: 3000,       // Standbild auf dem neuesten Bild
		updateInterval: 5 * 60 * 1000
	},

	getStyles () {
		return ["MMM-Regenradar.css"];
	},

	start () {
		this.daten = null;
		this.fehler = false;
		this.sendSocketNotification("RADAR_START", this.config);
	},

	socketNotificationReceived (notification, payload) {
		if (notification === "RADAR_DATEN") {
			this.daten = payload;
			this.fehler = false;
			this.index = payload.bilder.length - 1;
			this.updateDom(0);
		} else if (notification === "RADAR_FEHLER" && !this.daten) {
			this.fehler = true;
			this.updateDom(0);
		}
	},

	getDom () {
		const wrapper = document.createElement("div");
		wrapper.className = "regenradar";
		clearTimeout(this.animation);

		if (!this.daten) {
			wrapper.className += " dimmed light small";
			wrapper.textContent = this.fehler ? "Radar nicht erreichbar" : "Radar wird geladen …";
			return wrapper;
		}

		const karte = document.createElement("div");
		karte.className = "rr-karte";
		karte.style.width = `${this.config.breite}px`;
		karte.style.height = `${this.config.hoehe}px`;

		const grund = document.createElement("img");
		grund.src = this.daten.karte;
		karte.appendChild(grund);

		this.ebenen = this.daten.bilder.map((b, i) => {
			const img = document.createElement("img");
			img.src = b.bild;
			img.className = "rr-radar";
			img.style.opacity = i === this.index ? 1 : 0;
			karte.appendChild(img);
			return img;
		});

		const punkt = document.createElement("div");
		punkt.className = "rr-punkt";
		karte.appendChild(punkt);

		this.zeitEl = document.createElement("div");
		this.zeitEl.className = "rr-zeit";
		karte.appendChild(this.zeitEl);

		const quelle = document.createElement("div");
		quelle.className = "rr-quelle";
		quelle.textContent = "Quelle: MeteoSchweiz · Karte: swisstopo";
		karte.appendChild(quelle);

		wrapper.appendChild(karte);
		this.zeitZeigen();
		this.animieren();
		return wrapper;
	},

	zeitZeigen () {
		const bild = this.daten.bilder[this.index];
		if (!bild || !this.zeitEl) return;
		const minuten = Math.round((Date.now() - bild.zeit * 1000) / 60000);
		this.zeitEl.textContent = `${moment(bild.zeit * 1000).format("HH:mm")} · ${minuten <= 7 ? "aktuell" : `vor ${minuten} Min.`}`;
	},

	animieren () {
		const anzahl = this.daten.bilder.length;
		if (anzahl < 2) return;
		const weiter = () => {
			this.ebenen[this.index].style.opacity = 0;
			this.index = (this.index + 1) % anzahl;
			this.ebenen[this.index].style.opacity = 1;
			this.zeitZeigen();
			this.animation = setTimeout(weiter, this.index === anzahl - 1 ? this.config.pauseAmEnde : this.config.bildDauer);
		};
		this.animation = setTimeout(weiter, this.config.pauseAmEnde);
	}
});
