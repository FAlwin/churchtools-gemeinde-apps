### Neu (Website)

- **Ziehen in der Vorschau:** Abschnitte und Bausteine lassen sich am Griff ziehen – auch in eine andere Spalte, in einen anderen Abschnitt und in eine leere
  Spalte. Eine Linie zeigt die Stelle, die Zielspalte ist gestrichelt, am Rand scrollt die Seite von selbst, **Esc** bricht ab. Die Pfeiltasten am Griff
  verschieben weiter. Die Knöpfe „nach oben/unten“ fallen am Computer weg (am Handy bleiben sie).
- **Rückgängig und Wiederholen** für Änderungen an der Seite (Verschieben, Einfügen, Kopieren, Löschen, getippter Text, „Fertig“ im Fenster): zwei stille Knöpfe in
  der Kopfzeile und Strg/Cmd+Z, Umschalt+Strg/Cmd+Z, solange kein Textfeld offen ist. Der Verlauf gilt für die offene Seite in dieser Sitzung; hat jemand anderes
  inzwischen gespeichert, wird nicht darüber geschrieben.

### Intern (Website)

- Das Verschieben rechnet an **einer** Stelle (`abschnittVerschiebenNach`, `bausteinVerschieben` in `shared/website/bearbeiten.ts`); `abschnittVerschieben` (hoch/runter)
  rechnet darüber. Neue Nachricht `verschieben` (nur Zahlen), `hoch`/`runter` entfallen; `rueckgaengig`/`wiederholen` für Tasten im `iframe`.
