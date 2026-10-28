### Behoben (Organigramm, Anmeldungen)

- **Mitgliedschaften: Anlegen und Ändern sind jetzt zwei Aufrufe** – ChurchTools meldete per Mail „Nutzung veralteter
  APIs“ (`PUT /groups/{id}/members/{personId}` → `PATCH`). Gemessen 28.10.2026 in der Test-Instanz: `PATCH` legt
  **keine** Mitgliedschaft an (404), `PUT` mit `only_add: true` legt an und lehnt ab, wenn es sie schon gibt (403).
  Veraltet ist nur das **Ändern** per `PUT` – und das löschte dabei still **Kommentar und Enddatum**, wenn sie nicht
  mitgeschickt wurden.
  - Organigramm: „Rolle ändern“, „Austragen“ und deren „Rückgängig“ per `PATCH`; „Aufnehmen“ legt neu an (`PUT` mit
    `only_add`) oder ändert, wer früher schon dabei war. Bisher verlor eine Mitgliedschaft beim Rolle-Ändern ihren
    Kommentar und ein gesetztes Enddatum.
  - Anmeldungen: „Von Hand anmelden“ und „Rückgängig“ nach einer Absage legen nur noch an (`only_add`) – ist die
    Person inzwischen doch dabei, wird ihre Anmeldung nicht überschrieben. „Leitung“ beim Freigeben: wer schon in der
    Gruppe ist, wird per `PATCH` zur Leitung, alle anderen werden angelegt.

### Intern (Organigramm, Anmeldungen)

- `MitgliedZugriff.schreiben` aufgeteilt in `anlegen` und `aendern`. Die Test-Nachbauten (Regeln, App, Anmeldungen) und
  die Organigramm-Demo verhalten sich wie ChurchTools: `PUT` ohne `only_add` ist ein Fehler, `PATCH` ohne
  Mitgliedschaft 404. Gegenprobe: jeder der sieben Teile einzeln zurückgenommen – es fallen 1 bis 8 Tests.
