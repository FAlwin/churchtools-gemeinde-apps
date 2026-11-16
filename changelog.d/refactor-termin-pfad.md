### Intern (Anmeldungen, Protokolle)

- **Termine eines Kalenders:** Den Pfad `/calendars/appointments?calendar_ids[]=…&from=…&to=…` baut jetzt überall
  `terminPfad` aus `shared/ct/kalenderTermine.ts` – Anmeldungen (Termine im Zeitraum) und Protokolle (Termine mit
  Besprechungsanfrage, Termin nach unklarer Antwort suchen, beim Bearbeiten) bauten ihn bis dahin selbst. Keine
  sichtbare Änderung. Neuer Test für `termineIn` (Anmeldungen) gegen eine nachgebaute Kalenderliste.
