### Geändert (alle Apps)

- **Fenster nur zum Ansehen oder Wählen haben unten kein „Schließen“ mehr** (Alwin, 02.11.2026: „Schließen und X ist
  doppelt in dem Fenster“; Entwurf „Fenster mit Zurück“, abgenommen). Geschlossen wird mit dem X oben rechts, wie in
  ChurchTools; die Fenster werden kürzer. Das gilt auch für „Fertig“ und „Abbrechen“, wo sie nur schlossen
  (Tonart, Kapo, Abschnitte, Dateien, „Wer kann?“, Bausteine im Baukasten, Gruppe und Person im Organigramm …), und
  für Fenster, die gerade keinen eigenen Knopf haben (Ergebnis nach dem Senden, Laden). Fenster zum Bearbeiten
  behalten „Abbrechen“ neben „Speichern“.

### Neu (Musik-App)

- **„‹“ zurück ins Lied-Menü:** Transponieren, Kapo, Abschnitte, „Dateien verwalten“ und „Stammdaten …“ haben vor dem
  Titel einen Zurück-Pfeil; das X schließt ganz. Über den Stammdaten führen „‹“ und „Abbrechen“ im Arrangement-Fenster
  zurück zu den Stammdaten, ebenso beim Umbenennen zurück zu den Dateien; das X schließt beide. Im Liederheft führt
  „‹“ aus dem Formular „Neues Lied“ zurück zur Suche.
- **Version umbenennen zeigt den Dateinamen:** Unter dem Feld steht, wie die Datei in ChurchTools heißen wird
  („Datei in ChurchTools: Lied — Akustik (App).chordpro“). Alwin fragte, warum bei der einen Datei die Endung steht
  und bei der anderen nicht – bei einer Version setzt die App Liedtitel, „(App)“ und Endung selbst.

### Intern (alle Apps)

- `Sheet`: ohne eigene Knöpfe (`knoepfe={null}`) keine Fußzeile; neu `onAbbrechen` für Fenster über einem Fenster.
  `fensterAufbau.test.ts` meldet ein `cancelLabel` neben `knoepfe={null}` (16 tote Beschriftungen entfernt).
  `versionLiedTitel` liest den Liedtitel mit demselben Muster wie `versionNameOf`. Der Board-Test der Protokolle
  („Alphabetisch“) hing an einem festen Datum und fiel seit dem 02.11.2026 – die Fälligkeiten liegen jetzt weit in der
  Zukunft. Gegenprobe: 15 Teile einzeln zurückgenommen, jeder macht Tests rot. TF-EINST-21.
- Dienstplaner, Anmeldungen, Organigramm und Protokolle: Fensterwechsel und Schritte mit „‹“ folgen in einer zweiten
  Scheibe.
