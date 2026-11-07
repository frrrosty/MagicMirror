/* Ansichten (Seiten) auf dem Spiegel. Welche Module auf welcher Seite erscheinen,
 * steht in config.js über die Klassen der Module, z. B. classes: "seite-uebersicht seite-woche".
 * Module ohne seite-Klasse sind immer sichtbar. Gesten und die Handy-App wechseln die Seite.
 */
Module.register("MMM-Steuerung", {
	defaults: {
		seiten: [
			{ name: "Übersicht", klasse: "seite-uebersicht" },
			{ name: "Woche", klasse: "seite-woche" },
			{ name: "Spiegel", klasse: "seite-spiegel" }
		],
		// Was eine Geste bewirkt: "spiegel" (alles Unnötige weg / wieder da), "weiter", "zurueck"
		gestenBelegung: { tippen: "spiegel", halten: "weiter", rechts: "weiter", links: "zurueck", hoch: "spiegel", runter: "spiegel" },
		rueckkehrSek: 60,      // danach zurück zur ersten Seite, 0 = nie
		anzeigeSek: 3          // so lange wird der Seitenname nach einem Wechsel gezeigt
	},

	getStyles () {
		return ["MMM-Steuerung.css"];
	},

	start () {
		this.index = 0;
		this.anzeigen = false;
		this.melden();
	},

	notificationReceived (notification) {
		if (notification === "DOM_OBJECTS_CREATED") this.seiteZeigen(0, false);
	},

	socketNotificationReceived (notification, payload) {
		if (notification === "STEUERUNG_SEITE") {
			this.seiteZeigen(payload.index, true);
		} else if (notification === "STEUERUNG_GESTE") {
			this.geste(payload.geste);
		}
	},

	geste (name) {
		const anzahl = this.config.seiten.length;
		const spiegel = this.config.seiten.findIndex((s) => s.klasse === "seite-spiegel");
		const aktion = this.config.gestenBelegung[name];
		if (aktion === "spiegel" && spiegel >= 0) {
			this.seiteZeigen(this.index === spiegel ? 0 : spiegel, true);
		} else if (aktion === "weiter") {
			this.seiteZeigen((this.index + 1) % anzahl, true);
		} else if (aktion === "zurueck") {
			this.seiteZeigen((this.index - 1 + anzahl) % anzahl, true);
		}
	},

	seiteZeigen (index, mitAnzeige) {
		if (index >= this.config.seiten.length) return;
		this.index = index;
		const klasse = this.config.seiten[index].klasse;
		// Für Seiten-abhängiges CSS, z. B. grösserer Wochenplan auf der Seite «Woche»
		document.body.dataset.seite = klasse;
		this.sendNotification("STEUERUNG_SEITE_GEWECHSELT", { klasse });
		for (const modul of MM.getModules()) {
			const klassen = String(modul.data.classes || "").split(/\s+/);
			if (modul === this || !klassen.some((k) => k.startsWith("seite-"))) continue;
			if (klassen.includes(klasse)) modul.show(600, { lockString: this.identifier });
			else modul.hide(600, { lockString: this.identifier });
		}

		clearTimeout(this.rueckkehr);
		if (index !== 0 && this.config.rueckkehrSek > 0) {
			this.rueckkehr = setTimeout(() => this.seiteZeigen(0, true), this.config.rueckkehrSek * 1000);
		}
		if (mitAnzeige) {
			this.anzeigen = true;
			clearTimeout(this.ausblenden);
			this.ausblenden = setTimeout(() => {
				this.anzeigen = false;
				this.updateDom(800);
			}, this.config.anzeigeSek * 1000);
		}
		this.updateDom(300);
		this.melden();
	},

	melden () {
		this.sendSocketNotification("STEUERUNG_SEITEN", { index: this.index, namen: this.config.seiten.map((s) => s.name) });
	},

	getDom () {
		const wrapper = document.createElement("div");
		wrapper.className = "steuerung";
		if (!this.anzeigen) return wrapper;
		const name = document.createElement("div");
		name.className = "st-name bright";
		name.textContent = this.config.seiten[this.index].name;
		const punkte = document.createElement("div");
		punkte.className = "st-punkte";
		this.config.seiten.forEach((_, i) => {
			const punkt = document.createElement("span");
			if (i === this.index) punkt.className = "aktiv";
			punkte.appendChild(punkt);
		});
		wrapper.append(name, punkte);
		return wrapper;
	}
});
