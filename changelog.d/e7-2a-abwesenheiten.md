### Intern (Dienstplaner + Musik-App)

- **Abwesenheiten direkt aus der Erweiterung – der Kern** (Dienstplaner E7-2a, Alwin 04.11.2026: nur noch die
  Erweiterung zählt, kein eigener Server). `shared/absences/abwesenheiten.ts` liest, trägt ein, ändert und löscht die
  eigenen Abwesenheiten über einen Anschluss (`ui/ct/abwesenheitPort.ts`) – für beide Apps; sichtbar wird er mit
  E7-2b/E7-2c. Gemessen 04.11.2026 als Spike:
  - **Ändern bleibt derselbe Eintrag** (`PUT`, ersetzt ganz) – der Server legt dafür noch neu an und löscht alt.
  - **Mit Uhrzeit gehen nur die Uhrzeiten mit:** Tage dazu lehnt ChurchTools mit 400 ab.
  - **Kein Doppel:** ChurchTools legt denselben Zeitraum zweimal an; der Kern prüft vorher – über alle eigenen
    Einträge, auch die in ChurchTools gemachten (kein Kennzeichen „[Musikteam]“ mehr, ein altes wird ausgeblendet und
    fällt beim Ändern weg).
  - **Einen Tag weiter lesen:** Einträge mit Uhrzeit liefert ChurchTools erst, wenn `to` nach ihrem Tag liegt – sonst
    fand die Doppel-Sperre ein Fenster am letzten Tag nie (in der Probe gegen die Test-Instanz gefunden).
  - **Löschen wird nachgelesen:** ChurchTools meldet immer Erfolg, auch ohne Wirkung.
  - **Gründe** aus `/event/masterdata` (deutsch, „Abwesend“ vorgewählt) statt über die alte Schnittstelle.
- `ladeAbwesenheiten` (Startseite des Dienstplaners) liest über denselben Anschluss.
