### Intern

- **E2E-Rauchtest für jede Erweiterung** (#845): Anmeldungen, Dienstplaner, Organigramm, Protokolle und Gebetsabend starten im
  E2E-Lauf je mit eigenem Dev-Server im Demo-Modus; je App werden Startseite, ein Hauptweg und „keine Seiten- oder
  Konsolenfehler“ geprüft (`e2e/erweiterungen-rauch.spec.ts`). Bisher gab es E2E nur für die Musik-App.
- **Der Gebetsabend startet wie die anderen Erweiterungen über `erweiterungStarten`** (#845). #872 und #877 waren
  einzeln grün, zusammen schlug der Wächter `tippZoomAufruf.test.ts` an – genau dafür ist er da.
