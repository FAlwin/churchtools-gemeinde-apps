# Website

Die Erweiterung „Website“ (Kürzel `website`, Anleitung `docs/betrieb/WEBSITE.md`). Getestet wird in der **Test-Instanz**,
nie in der Live-Instanz der Gemeinde. Das Paket baut `npm run build -w website` und `npm run paket -w website`; hochladen unter
**Administration → Erweiterungen → Stift beim Modul → ZIP-Datei** (neues Modul: Kürzel genau `website`).

### TF-WEBSITE-01 · Einrichten legt beide Kategorien für die gewählte Gruppe an, ohne Admin gibt es nur den Hinweis

**Das brauchst du:** Die Erweiterung frisch installiert (noch nicht eingerichtet), ein Admin-Konto, in ChurchTools eine Gruppe
„Website“ und eine Person ohne Admin-Recht (z. B. über „Person simulieren“).

**Das muss passieren:** Der Admin sieht „Website einrichten“ mit der vorgewählten Gruppe „Website“ und dem Knopf
**Einrichten**. Danach steht der Hinweis „Diese Website hat noch keine Startseite“, und unter Administration → Berechtigungen
stehen bei der Erweiterung die Kategorien „Website: Entwürfe · Website“ und „Website: Veröffentlicht · Website“ – jede genau
einmal. Eine Person ohne Admin-Recht sieht keinen Einrichten-Knopf, sondern einen Hinweis.

1. Als Admin im Menü auf **Website**: „Website einrichten“, die Gruppe „Website“ ist gewählt.
2. **Einrichten** tippen: „Wird eingerichtet …“, danach der Rahmen mit den Reitern Seiten · Aussehen · Freigaben.
3. Die Seite neu laden: kein „Einrichten“ mehr.
4. Unter **Administration → Berechtigungen** bei „Website“: beide Kategorien, keine doppelt.
5. Eine Person ohne Admin-Recht simulieren und die Seite öffnen: Hinweis, kein Knopf. Simulation beenden.

<details><summary>Technisches</summary>

- **Priorität:** hoch
- **Betrifft:** `website/src/Einrichtung.tsx`, `website/src/einrichten.ts`, `website/src/start.ts`, `shared/website/einrichten.ts`
- **Automatisiert:** teilweise – `website/src/Einrichtung.test.tsx`, `website/src/start.test.ts`, `shared/website/einrichten.test.ts` (Regeln, Laden, Auswahl); das echte Anlegen und die Rechte-Seite von ChurchTools nur in der Test-Instanz
- **Historie:** neu mit W3a-1 (20.11.2026)

</details>

### TF-WEBSITE-02 · Zugang: nur Admins und die Leitung der Gruppe – Mitarbeiter bekommen einen Hinweis

**Das brauchst du:** Eingerichtete Website, die Gruppe „Website“ mit einer Leitung und einem Mitarbeiter, dazu die Rechte an
„Entwürfe“ für die Leiter-Rolle (siehe Anleitung, „Wer darf was“). Zum Probieren „Person simulieren“.

**Das muss passieren:** Admin und Leitung sehen den Rahmen mit den Reitern und die Seitenliste. Der Mitarbeiter (und jede andere
Person) sieht nur: „Die Website bearbeiten dürfen die Admins und die Leitung der Gruppe ‚Website‘.“ – keinen Editor. Hat die
Leitung die Rechte an den Kategorien noch nicht, steht „noch nicht eingerichtet, oder dir fehlt das Recht“.

1. Als Admin die Erweiterung öffnen: Reiter und Seitenliste.
2. Als **Leiter** der Gruppe simulieren: dasselbe.
3. Als **Mitarbeiter** der Gruppe simulieren: nur der Hinweis.
4. Als Person ohne Verbindung zur Gruppe simulieren: Hinweis („dir fehlt das Recht“ bzw. wer es darf).

<details><summary>Technisches</summary>

- **Priorität:** hoch
- **Betrifft:** `website/src/App.tsx`, `website/src/start.ts`, `shared/website/zugang.ts`
- **Automatisiert:** teilweise – `website/src/App.test.tsx`, `website/src/start.test.ts`, `shared/website/zugang.test.ts`; das echte Verhalten von Gruppenrollen und Kategorie-Rechten nur in der Test-Instanz
- **Historie:** neu mit W3a-1 (20.11.2026)

</details>

### TF-WEBSITE-03 · Startseite anlegen, neue Seite, Seite löschen – und die Vorschau

**Das brauchst du:** Die eingerichtete Website (Admin oder Leitung), noch ohne Seite.

**Das muss passieren:** Ohne Seite steht der Hinweis mit dem Knopf **Startseite anlegen** – nichts wird von selbst angelegt. Der
Knopf legt eine Startseite aus der Vorlage an; die Vorschau zeigt sie (Schriftzug), der Umschalter wechselt zwischen **Computer**
und **Handy** (schmaler Rahmen). **Neue Seite** nimmt einen Titel, zeigt die Adresse darunter und legt eine leere Seite an. **Seite
löschen** fragt erst nach. Nach dem Neuladen der Seite steht alles unverändert da.

1. Die Erweiterung öffnen: „Diese Website hat noch keine Startseite“. **Startseite anlegen**.
2. Die Vorschau zeigt die Startseite; **Handy** tippen, dann **Computer**.
3. **Neue Seite**, Titel „Über uns“: darunter steht die Adresse `/ueber-uns/`; **Anlegen**. Die Seite steht unter „Weitere Seiten“.
4. Noch eine Seite „Über uns“ anlegen: ihre Adresse ist `/ueber-uns-2/`.
5. Die zweite Seite wählen, **Seite löschen**, erst **Abbrechen** (nichts passiert), dann noch einmal und **Löschen**.
6. Die Seite neu laden: die Startseite und „Über uns“ stehen da, die gelöschte nicht.
7. In ChurchTools unter _Administration → Erweiterungen → Website_ in der Kategorie „Entwürfe“: je Seite ein Kopf-Wert und ein oder mehrere Teil-Werte.

<details><summary>Technisches</summary>

- **Priorität:** hoch
- **Betrifft:** `website/src/Seiten.tsx`, `website/src/NeueSeite.tsx`, `website/src/Vorschau.tsx`, `shared/website/speicher.ts`, `shared/website/seitenListe.ts`
- **Automatisiert:** teilweise – `website/src/Seiten.test.tsx`, `shared/website/speicher.test.ts`, `shared/website/seitenListe.test.ts`; das echte Speichern in ChurchTools nur in der Test-Instanz
- **Historie:** neu mit W3a-1 (20.11.2026)

</details>

### TF-WEBSITE-04 · Die Vorschau ist abgeschottet und lädt nichts nach

**Das brauchst du:** Eine Website mit Startseite (Test-Instanz), die Entwicklerwerkzeuge des Browsers.

**Das muss passieren:** Das Vorschau-Fenster ist ein `iframe` mit `sandbox="allow-scripts"` (kein `allow-same-origin`). Die Vorschau
sieht gestaltet aus (Stylesheet greift), Bilder sind graue Platzhalter, es werden keine Schriftdateien und keine Bilder von
ChurchTools geladen.

1. Die Startseite in der Vorschau ansehen: gestaltet, mit grauen Platzhalter-Bildern.
2. In den Entwicklerwerkzeugen das `iframe` prüfen: Attribut `sandbox` ist genau `allow-scripts`.
3. Reiter „Netzwerk“: beim Wechsel zwischen Seiten entstehen keine Anfragen für Schrift- oder Bilddateien.
4. Zeigt die Vorschau gar nichts oder ungestaltet: das ist der Hinweis, dass die Content-Security-Policy von ChurchTools
   `data:`-Adressen für Stylesheets sperrt – dann bitte melden (Ausweichlösung ist vorbereitet, `website/src/vorschauHtml.ts`).

<details><summary>Technisches</summary>

- **Priorität:** hoch
- **Betrifft:** `website/src/Vorschau.tsx`, `website/src/vorschauHtml.ts`, `shared/website/website.css`
- **Automatisiert:** teilweise – `website/src/Vorschau.test.tsx` (Attribut, `srcdoc`, `data:`-Adressen), `shared/website/stylesheet.test.ts`; wie ChurchTools das eingebettete Dokument behandelt (CSP) nur in der Test-Instanz
- **Historie:** neu mit W3a-1 (20.11.2026)

</details>
