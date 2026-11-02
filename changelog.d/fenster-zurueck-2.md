### Geändert (alle Erweiterungen)

- **„‹“ auch in Dienstplaner, Anmeldungen, Organigramm und Protokolle** (Alwin, 02.11.2026: „Wechselt ein Screen im
  Fenster, soll es einen Zurück-Pfeil geben“; Scheibe 2 nach dem Entwurf „Fenster mit Zurück“). Wo ein Fenster ein
  anderes ersetzt oder seine Seite wechselt, steht vor dem Titel „‹“ – ein Schritt zurück; das X schließt alles.
  - **Dienstplaner:** „Wer kann?“ aus einem Entwurf oder einem belegten Platz führt mit „‹“ dorthin zurück. Die
    Lied-Ansicht aus dem Punkt-Fenster hat „‹“ statt „Zurück“ unten, und kein „Schließen“ mehr neben dem X.
  - **Anmeldungen:** „Person dazu“ und „Zurückholen“ führen zur Anmeldung zurück, aus der sie kamen; die Bausteine
    „Nach Alter“, „Rabatt“, „Extra“ zu „Baustein hinzufügen“; „Veranstaltung verwalten“ hat zum ersten Mal einen Weg
    zurück zur Auswahl. Mail schreiben, Rundmail-Vorschau, „Anmeldung von Hand“ und „Sofort löschen?“: „‹“ statt
    „Zurück“ unten.
  - **Organigramm:** Von der Person zur Gruppe, weiter zur Ober- oder Untergruppe – „‹“ geht jeweils einen Schritt
    zurück. In den Schritten der Gruppe (Ändern, Aufnehmen, Rolle …) „‹“ statt „Zurück“ unten; aus „Umhängen?“ zurück
    zur Wahl des Ziels.
  - **Protokolle:** „Sitzung absagen“ mit „‹“ zurück zur Sitzung.
  - **Punkt-Fenster** (Musik-App und Dienstplaner): „Einfügen nach“ und „Zuständig“ mit „‹“; „Lied verknüpfen“ führt
    mit „‹“ zum Eintrag zurück.
- **Unten jetzt „Abbrechen · …“ wie in ChurchTools.** Bei einer Rückfrage („1 Mail jetzt senden?“, „Sitzung
  absagen“, „Umhängen?“) führt „Abbrechen“ dorthin zurück, wo man herkam – Geschriebenes geht nicht verloren. Bei
  einem Schritt nach vorn („Neue Person anlegen → Weiter“) bricht es ab wie das X.

### Intern (alle Erweiterungen)

- Wächter in `fensterAufbau.test.ts`: kein „Zurück“-Knopf unten mehr (das Muster erkennt auch `onClick={() => …}` –
  ein erster Entwurf hätte genau das übersehen, die Gegenprobe fand es). Organigramm mit einem Verlauf der Fenster,
  Dienstplaner merkt sich, woher „Wer kann?“ kam; `PreisFenster` trägt `ausNeu`. Gegenprobe: 24 Teile einzeln
  zurückgenommen, jeder macht Tests rot.
