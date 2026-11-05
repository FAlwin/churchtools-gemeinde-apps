### Neu (Gebetsabend)

- **Neue Erweiterung „Gebetsabend“ (G1, Gerüst).** Sie überträgt künftig den Gebetsabend mit Bild und Ton an
  Gemeindeglieder, die nicht kommen können – nur mit ChurchTools-Zugang und Recht, ohne Link zum Weitergeben. In
  diesem ersten Schritt lässt sie sich installieren und mit einem Knopf **einrichten** (legt die Kategorien „Zugang“
  und „Einstellungen“ an); die Seite zeigt, ob sie eingerichtet ist und ob man zur Technik gehört. Zuhören und
  Übertragen folgen. Anleitung mit Rechte-Tabelle: `docs/betrieb/GEBETSABEND.md`.

### Intern (Gebetsabend)

- Regeln in `shared/gebetsabend/`: Zugangsdaten (nur Buchstaben und Ziffern, ohne Schieflage erzeugt), die
  VDO.Ninja-Adressen an einer Stelle, der Player-Zustand aus den VDO.Ninja-Meldungen und der Stand der Einrichtung –
  alles nach den Messungen S0/S0b/G0 vom 05.11.2026 (`gebetsabend-planung/s0-messung.md`).
- Eingetragen in Workspaces, Build, Lint, Testlauf, CI-Paket, Release-Weg `gebetsabend-v*`, Release-Notizen. Die
  CSS-Klassen-Prüfung (`client/src/cssKlassen.test.ts`) prüft jetzt auch das Organigramm, das dort fehlte.
