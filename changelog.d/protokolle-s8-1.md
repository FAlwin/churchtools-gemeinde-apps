### Intern (S8-1)

- **Regeln für „Mit KI füllen“** (Bauplan S8-1, Entwurf `s8-ki-v1`, ohne Oberfläche): `shared/protokolle/ki.ts` baut die
  Tagesordnung mit Unterpunkten (feste Punkte als „nichts zuordnen“) und den Auftrag an die KI (Sitzungsdatum mit
  Wochentag, Platzhalter-Regel, JSON-Aufbau), liest die Antwort tolerant (Codeblock, Text drumherum, Nummer als Zahl;
  Namen kommen zurück, Zuständige: Gruppenmitglied oder extern, ungültige Daten werden verworfen) und plant die
  Übernahme als Aufrufe für `EditorGriff.einfuegen` (hinter den Text des Punkts, vor den nächsten Punkt – bei Unterpunkten vor den ersten; neue Punkte ans Ende). Dazu
  `shared/protokolle/docxText.ts` (Text einer Word-Datei mit `fflate`). Getestet gegen die echten Blockarten und
  `namenFinden`, u. a. „kein gefundener Name im Auftrag“.
