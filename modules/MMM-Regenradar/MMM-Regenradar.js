/* Animiertes Regenradar um den eigenen Standort. Ohne Kartenbibliothek:
 * Die Kacheln werden direkt aus den Koordinaten berechnet, das schont den Pi 3.
 * Radar: RainViewer, Karte: CARTO (dunkel) mit Daten von OpenStreetMap.
 */
Module.register("MMM-Regenradar", {
	defaults: {
		lat: 47.6703,
		lon: 9.0856,
		zoom: 7,                 // RainViewer liefert kostenlos höchstens Zoomstufe 7
		breite: 460,
		hoehe: 260,
		bilder: 7,               // Anzahl vergangener Bilder in der Animation (je 10 Min.)
		bildDauer: 600,          // Millisekunden pro Bild
		pauseAmEnde: 2500,       // Standbild auf dem neuesten Bild
		farbe: 2,                // Farbschema von RainViewer
		deckkraft: 0.8,
		apiUrl: "https://api.rainviewer.com/public/weather-maps.json",
		karte: "https://basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png",
		updateInterval: 10 * 60 * 1000
	},

	getStyles () {
		return ["MMM-Regenradar.css"];
	},

	start () {
		this.daten = null;
		this.fehler = false;
		this.index = 0;
		this.sendSocketNotification("RADAR_START", { apiUrl: this.config.apiUrl, updateInterval: this.config.updateInterval });
	},

	socketNotificationReceived (notification, payload) {
		if (notification === "RADAR_DATEN") {
			const vergangen = payload.bilder.filter((b) => !b.prognose).slice(-this.config.bilder);
			const prognose = payload.bilder.filter((b) => b.prognose);
			this.daten = { host: payload.host, bilder: [...vergangen, ...prognose] };
			this.fehler = false;
			this.index = vergangen.length - 1;
			this.updateDom(0);
		} else if (notification === "RADAR_FEHLER" && !this.daten) {
			this.fehler = true;
			this.updateDom(0);
		}
	},

	/**
	 * Weltkoordinaten in Pixeln (Web-Mercator) für die gewählte Zoomstufe.
	 * @returns {{x: number, y: number}} Position des Standorts
	 */
	standortPixel () {
		const n = 256 * 2 ** this.config.zoom;
		const lat = this.config.lat * Math.PI / 180;
		return {
			x: (this.config.lon + 180) / 360 * n,
			y: (1 - Math.log(Math.tan(lat) + 1 / Math.cos(lat)) / Math.PI) / 2 * n
		};
	},

	kacheln (vorlage) {
		const { breite, hoehe, zoom } = this.config;
		const mitte = this.standortPixel();
		const links = mitte.x - breite / 2;
		const oben = mitte.y - hoehe / 2;
		const ebene = document.createElement("div");
		ebene.className = "rr-ebene";
		for (let tx = Math.floor(links / 256); tx <= Math.floor((links + breite - 1) / 256); tx++) {
			for (let ty = Math.floor(oben / 256); ty <= Math.floor((oben + hoehe - 1) / 256); ty++) {
				const img = document.createElement("img");
				img.src = vorlage.replace("{z}", zoom).replace("{x}", tx).replace("{y}", ty);
				img.style.left = `${Math.round(tx * 256 - links)}px`;
				img.style.top = `${Math.round(ty * 256 - oben)}px`;
				img.onerror = () => (img.style.visibility = "hidden");
				ebene.appendChild(img);
			}
		}
		return ebene;
	},

	getDom () {
		const wrapper = document.createElement("div");
		wrapper.className = "regenradar";

		if (!this.daten) {
			wrapper.className += " dimmed light small";
			wrapper.textContent = this.fehler ? "Radar nicht erreichbar" : "Radar wird geladen …";
			return wrapper;
		}

		const karte = document.createElement("div");
		karte.className = "rr-karte";
		karte.style.width = `${this.config.breite}px`;
		karte.style.height = `${this.config.hoehe}px`;
		karte.appendChild(this.kacheln(this.config.karte));

		this.ebenen = this.daten.bilder.map((bild, i) => {
			const ebene = this.kacheln(`${this.daten.host}${bild.path}/256/{z}/{x}/{y}/${this.config.farbe}/1_1.png`);
			ebene.classList.add("rr-radar");
			ebene.style.opacity = i === this.index ? this.config.deckkraft : 0;
			karte.appendChild(ebene);
			return ebene;
		});

		const punkt = document.createElement("div");
		punkt.className = "rr-punkt";
		karte.appendChild(punkt);

		this.zeitEl = document.createElement("div");
		this.zeitEl.className = "rr-zeit";
		karte.appendChild(this.zeitEl);

		const quelle = document.createElement("div");
		quelle.className = "rr-quelle";
		quelle.textContent = "RainViewer · © CARTO · © OpenStreetMap";
		karte.appendChild(quelle);

		wrapper.appendChild(karte);
		this.zeitZeigen();
		this.animieren();
		return wrapper;
	},

	zeitZeigen () {
		const bild = this.daten.bilder[this.index];
		if (!bild || !this.zeitEl) return;
		const minuten = Math.round((bild.time * 1000 - Date.now()) / 60000);
		const relativ = minuten > 0 ? `in ${minuten} Min.` : minuten > -5 ? "jetzt" : `vor ${-minuten} Min.`;
		this.zeitEl.textContent = `${moment(bild.time * 1000).format("HH:mm")} · ${relativ}`;
		this.zeitEl.classList.toggle("rr-prognose", bild.prognose);
	},

	animieren () {
		clearTimeout(this.animation);
		const anzahl = this.daten.bilder.length;
		if (anzahl < 2) return;
		const letztes = this.daten.bilder.filter((b) => !b.prognose).length - 1;
		const weiter = () => {
			const alt = this.ebenen[this.index];
			this.index = (this.index + 1) % anzahl;
			if (alt) alt.style.opacity = 0;
			if (this.ebenen[this.index]) this.ebenen[this.index].style.opacity = this.config.deckkraft;
			this.zeitZeigen();
			const pause = this.index === letztes ? this.config.pauseAmEnde : this.config.bildDauer;
			this.animation = setTimeout(weiter, pause);
		};
		this.animation = setTimeout(weiter, this.config.pauseAmEnde);
	}
});
