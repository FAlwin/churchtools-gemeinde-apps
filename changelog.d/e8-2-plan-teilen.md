### Neu (Dienstplaner)

- **Plan teilen** (Bauplan E8-2, Entwurf `e8-teilen.html`): In „Planen“ steht in der Werkzeugleiste „Teilen“. Das
  Fenster „Plan teilen“ bietet den **ganzen Plan** (je Gruppe eine Tabelle), **nur eine Gruppe** (z. B. für den
  Gruppenchat) oder **„Wir suchen noch …“** – nur die offenen Dienste je Termin, ohne Namen, zum Rumschicken. Geteilt
  werden die Termine und Gruppen, die „Planen“ gerade zeigt; nur Gesendetes, keine Entwürfe. Dazu die Seiten als
  Vorschau, „Herunterladen“ und „Teilen“; das Gerät merkt sich die Wahl.
- Das Blatt im selben Look wie das Termin-Blatt: Kopf mit Zeitraum, Gemeinde und Stand, Namen, „(angefragt)“, freie
  Plätze rot, keine leeren Spalten, ab sechs Spalten quer.

### Intern

- Der Satz der Blätter (`ui/teilen/pdfSatz.ts`: Schrift, Zellen, Spaltenbreiten, Tabellenkopf, Kopf und Fuß) und das
  Gemeinsame der Teilen-Fenster (`pdfFenster.tsx`, `pdfFensterZustand.ts`: PDF bauen, Status, Vorschau, Knöpfe) aus dem
  Termin-Blatt herausgelöst – Termin- und Plan-Blatt nutzen sie beide. Das Plan-Fenster lädt erst beim Antippen.
