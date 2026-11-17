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
		bildDauer: 700,          // Millisekunden pro Bild
		pauseAmEnde: 6000,       // Standbild auf dem neuesten Bild
		animation: true,         // false: nur das neueste Bild zeigen
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
			// Gleiche Daten nochmals erhalten (z. B. weil sich ein zweiter Browser verbunden hat):
			// nicht neu aufbauen, sonst springt die Animation zurück
			const neu = payload.bilder.at(-1)?.zeit;
			if (this.daten && this.daten.bilder.at(-1)?.zeit === neu) return;
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
		this.durchlauf = (this.durchlauf || 0) + 1;

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
			img.style.visibility = i === this.index ? "visible" : "hidden";
			karte.appendChild(img);
			return img;
		});

		const punkt = document.createElement("div");
		punkt.className = "rr-punkt";
		karte.appendChild(punkt);

		this.zeitEl = document.createElement("div");
		this.zeitEl.className = "rr-zeit";
		karte.appendChild(this.zeitEl);

		// Zeitachse: zeigt, dass ein Rückblick abläuft und wo er gerade steht
		const achse = document.createElement("div");
		achse.className = "rr-achse";
		this.marken = this.daten.bilder.map(() => {
			const m = document.createElement("span");
			achse.appendChild(m);
			return m;
		});
		if (this.config.animation && this.marken.length > 1) karte.appendChild(achse);

		const quelle = document.createElement("div");
		quelle.className = "rr-quelle";
		quelle.textContent = "Quelle: MeteoSchweiz · Karte: swisstopo";
		karte.appendChild(quelle);

		wrapper.appendChild(karte);
		this.zeitZeigen();
		// Erst abspielen, wenn alle Bilder dekodiert sind. Sonst bleiben auf dem Pi 3
		// im ersten Durchlauf Bilder leer und der Regen flackert.
		const durchlauf = this.durchlauf;
		Promise.all(this.ebenen.map((img) => img.decode().catch(() => {}))).then(() => {
			if (durchlauf === this.durchlauf && !this.pausiert) this.animieren();
		});
		return wrapper;
	},

	zeitZeigen () {
		const bild = this.daten.bilder[this.index];
		if (!bild || !this.zeitEl) return;
		const minuten = Math.round((Date.now() - bild.zeit * 1000) / 60000);
		this.zeitEl.textContent = `${moment(bild.zeit * 1000).format("HH:mm")} · ${minuten <= 7 ? "aktuell" : `vor ${minuten} Min.`}`;
		(this.marken || []).forEach((m, i) => m.classList.toggle("aktiv", i === this.index));
	},

	zeigeBild (index) {
		this.ebenen[this.index].style.visibility = "hidden";
		this.index = index;
		this.ebenen[this.index].style.visibility = "visible";
		this.zeitZeigen();
	},

	// Ausgeblendet (andere Ansicht, Spiegel-Modus): Animation anhalten, spart Rechenzeit
	suspend () {
		this.pausiert = true;
		clearTimeout(this.animation);
	},

	resume () {
		this.pausiert = false;
		if (!this.daten || !this.ebenen) return;
		clearTimeout(this.animation);
		this.zeigeBild(this.ebenen.length - 1);
		this.animieren();
	},

	animieren () {
		const anzahl = this.ebenen.length;
		clearTimeout(this.animation);
		if (!this.config.animation || anzahl < 2) return;
		const weiter = () => {
			this.zeigeBild((this.index + 1) % anzahl);
			this.animation = setTimeout(weiter, this.index === anzahl - 1 ? this.config.pauseAmEnde : this.config.bildDauer);
		};
		this.animation = setTimeout(weiter, this.config.pauseAmEnde);
	}
});
