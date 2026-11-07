/* Zeigt To-dos und eine Familiennachricht vom Handy auf dem Spiegel an.
 * Zwei Instanzen mit unterschiedlicher anzeige ("todos" oder "nachricht")
 * teilen sich dieselben Daten.
 */
Module.register("MMM-Pinnwand", {
	defaults: {
		anzeige: "todos",          // "todos" oder "nachricht"
		maxTodos: 6,
		spruchAusblenden: true     // compliments ausblenden, solange eine Nachricht da ist
	},

	getStyles () {
		return ["MMM-Pinnwand.css"];
	},

	start () {
		this.daten = { todos: [], nachricht: null, sprueche: [] };
		this.sendSocketNotification("PINNWAND_HOLEN");
		// Ablaufende Nachrichten auch ohne neue Daten ausblenden
		setInterval(() => this.anwenden(), 60 * 1000);
	},

	notificationReceived (notification) {
		if (notification === "DOM_OBJECTS_CREATED") {
			this.domBereit = true;
			this.anwenden();
		}
	},

	socketNotificationReceived (notification, payload) {
		if (notification !== "PINNWAND_DATEN") return;
		this.daten = payload;
		this.anwenden();
	},

	offen () {
		return this.daten.todos.filter((t) => !t.erledigt);
	},

	nachricht () {
		const n = this.daten.nachricht;
		return n && n.bis > Date.now() ? n : null;
	},

	anwenden () {
		// Ein- und Ausblenden geht erst, wenn alle Module gezeichnet sind
		if (!this.domBereit) return;
		const leer = this.config.anzeige === "todos" ? this.offen().length === 0 : !this.nachricht();
		if (leer) this.hide(500, { lockString: this.identifier });
		else this.show(500, { lockString: this.identifier });

		if (this.config.anzeige === "nachricht") {
			for (const modul of MM.getModules().withClass("compliments")) {
				this.spruecheEinsetzen(modul);
				if (!this.config.spruchAusblenden) continue;
				if (this.nachricht()) modul.hide(500, { lockString: this.identifier });
				else modul.show(500, { lockString: this.identifier });
			}
		}
		this.updateDom(500);
	},

	/**
	 * Sprüche aus der App zu den festen Sprüchen aus config.js hinzufügen.
	 * Mit Datum gelten sie nur an diesem Tag (und verdrängen dann die übrigen),
	 * sonst zur gewählten Tageszeit oder immer.
	 * @param {object} modul das compliments-Modul
	 */
	spruecheEinsetzen (modul) {
		if (!modul.pinnwandBasis) modul.pinnwandBasis = JSON.parse(JSON.stringify(modul.config.compliments));
		const sprueche = JSON.parse(JSON.stringify(modul.pinnwandBasis));
		for (const s of this.daten.sprueche || []) {
			const schluessel = s.datum || s.wann || "anytime";
			sprueche[schluessel] = [...(sprueche[schluessel] || []), s.text];
		}
		// Nur bei einer Änderung sofort neu zeichnen, sonst wechselt der Spruch im eigenen Takt
		if (JSON.stringify(sprueche) !== JSON.stringify(modul.config.compliments)) {
			modul.config.compliments = sprueche;
			modul.updateDom(1000);
			// Beim Start laufen gleichzeitig die Einblend-Animationen der Seiten; ein Neuzeichnen
			// in dieser Phase geht verloren, darum einmal verzögert nachziehen
			if (!this.spruecheGesetzt) setTimeout(() => modul.updateDom(1000), 3000);
			this.spruecheGesetzt = true;
		}
	},

	getDom () {
		const wrapper = document.createElement("div");
		wrapper.className = `pinnwand pinnwand-${this.config.anzeige}`;

		if (this.config.anzeige === "nachricht") {
			const n = this.nachricht();
			if (!n) return wrapper;
			const text = document.createElement("div");
			text.className = "pw-nachricht bright";
			text.textContent = n.text;
			const info = document.createElement("div");
			info.className = "pw-von dimmed";
			info.textContent = `${n.von ? `${n.von}, ` : ""}${moment(n.erstellt).format("dd HH:mm")}`;
			wrapper.append(text, info);
			return wrapper;
		}

		const offen = this.offen();
		const liste = document.createElement("ul");
		for (const todo of offen.slice(0, this.config.maxTodos)) {
			const punkt = document.createElement("li");
			punkt.textContent = todo.text;
			liste.appendChild(punkt);
		}
		wrapper.appendChild(liste);
		if (offen.length > this.config.maxTodos) {
			const mehr = document.createElement("div");
			mehr.className = "pw-mehr dimmed";
			mehr.textContent = `und ${offen.length - this.config.maxTodos} weitere`;
			wrapper.appendChild(mehr);
		}
		return wrapper;
	}
});
