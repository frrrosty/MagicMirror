/* Wochenraster der Familientermine. Nutzt die Termine, die das calendar-Modul
 * per CALENDAR_EVENTS verteilt, und braucht darum keine eigene Datenquelle.
 */
Module.register("MMM-Wochenplan", {
	defaults: {
		days: 7,                 // Anzahl Tage
		startToday: true,        // true: ab heute, false: ab Montag dieser Woche
		maxPerDay: 4,            // weitere Termine werden als «+2» zusammengefasst
		calendars: [],           // nur diese Kalendernamen, leer = alle
		maxTitleLength: 40
	},

	getStyles () {
		return ["MMM-Wochenplan.css"];
	},

	start () {
		this.events = [];
		// Regelmässig neu zeichnen, damit der Tageswechsel stimmt
		setInterval(() => this.updateDom(), 10 * 60 * 1000);
	},

	notificationReceived (notification, payload) {
		if (notification === "STEUERUNG_SEITE_GEWECHSELT") {
			// Auf der Seite «Woche» doppelt so viele Termine pro Tag
			this.gross = payload.klasse === "seite-woche";
			this.updateDom(300);
			return;
		}
		if (notification !== "CALENDAR_EVENTS") return;
		const erlaubt = this.config.calendars;
		this.events = payload
			.filter((ev) => !erlaubt.length || erlaubt.includes(ev.calendarName))
			.map((ev) => ({ ...ev, start: Number(ev.startDate), end: Number(ev.endDate) }));
		this.updateDom(500);
	},

	tage () {
		const erster = moment().startOf("day");
		if (!this.config.startToday) erster.startOf("isoWeek");
		return Array.from({ length: this.config.days }, (_, i) => erster.clone().add(i, "days"));
	},

	termineAm (tag) {
		const von = tag.valueOf();
		const bis = tag.clone().add(1, "day").valueOf();
		return this.events
			.filter((ev) => ev.start < bis && ev.end > von)
			.sort((a, b) => Number(b.fullDayEvent) - Number(a.fullDayEvent) || a.start - b.start);
	},

	getDom () {
		const wrapper = document.createElement("div");
		wrapper.className = "wochenplan";
		const jetzt = Date.now();
		const maxPerDay = this.gross ? this.config.maxPerDay * 2 : this.config.maxPerDay;

		for (const tag of this.tage()) {
			const spalte = document.createElement("div");
			spalte.className = "wp-tag";
			if (tag.isSame(moment(), "day")) spalte.classList.add("wp-heute");
			if (tag.isoWeekday() >= 6) spalte.classList.add("wp-wochenende");

			const kopf = document.createElement("div");
			kopf.className = "wp-kopf";
			kopf.innerHTML = `<span class="wp-name">${tag.format("dd")}</span> <span class="wp-datum">${tag.format("D.")}</span>`;
			spalte.appendChild(kopf);

			const termine = this.termineAm(tag);
			for (const ev of termine.slice(0, maxPerDay)) {
				const eintrag = document.createElement("div");
				eintrag.className = ev.fullDayEvent ? "wp-termin wp-ganztag" : "wp-termin";
				if (!ev.fullDayEvent && ev.end < jetzt) eintrag.classList.add("wp-vorbei");

				if (!ev.fullDayEvent) {
					const zeit = document.createElement("div");
					zeit.className = "wp-zeit";
					zeit.textContent = moment(ev.start).isBefore(tag) ? "…" : moment(ev.start).format("HH:mm");
					eintrag.appendChild(zeit);
				}
				const titel = document.createElement("div");
				titel.className = "wp-titel";
				const text = ev.title.length > this.config.maxTitleLength ? `${ev.title.slice(0, this.config.maxTitleLength - 1)}…` : ev.title;
				titel.textContent = text;
				if (ev.color) eintrag.style.borderLeftColor = ev.color;
				eintrag.appendChild(titel);
				spalte.appendChild(eintrag);
			}
			if (termine.length > maxPerDay) {
				const mehr = document.createElement("div");
				mehr.className = "wp-mehr";
				mehr.textContent = `+${termine.length - maxPerDay}`;
				spalte.appendChild(mehr);
			}
			wrapper.appendChild(spalte);
		}
		return wrapper;
	}
});
