### Neu (Website)

- **Untergruppen einrichten (W3b-4a):** Jede **direkte** Untergruppe der Gruppe „Website“ erscheint unter Einstellungen → **Wer darf was** mit
  eigenem Abschnitt (Enkel nicht). Ist sie noch nicht eingerichtet, steht das dort mit der Vorbelegung (Leiter = Leitung, sonst Redakteur);
  **Rechte setzen** legt ihre Kategorie „Website: Veröffentlicht · …“ an (eine schon vorhandene wird wiederverwendet), vergibt die Rechte ihrer
  Rollen und zieht **danach** die Rollen der Website nach – mit den Stufen, die sie schon haben. Eingerichtete Untergruppen zeigen ihre Stufen
  aus ChurchTools und „Weicht ab“ wie die Website.
- **Rechte der Untergruppen:** Rollen einer Untergruppe schreiben in „Entwürfe“ (eine gemeinsame Kategorie), **lesen „Veröffentlicht“ der
  Website** und ihre eigene Kategorie; ihre Leitung schreibt **nur** in die eigene Kategorie. Die Leitung der Website schreibt in alle,
  Redakteure der Website lesen alle. „Rechte setzen“ bei der Website entzieht die Rechte an den Untergruppen nicht.
- **Hinweis beim Start** (nur Admins mit „Personen administrieren“): auch, wenn eine Untergruppe noch nicht eingerichtet ist oder ihre Rechte
  abweichen.
- **Bis W3b-4b** arbeiten Mitglieder einer Untergruppe in der Oberfläche noch als Redakteur der ganzen Website (Bereich je Seite, gefilterte
  Listen und Freigeben je Bereich folgen).

### Geändert (Website)

- **Welche Website man sieht, bestimmt nur noch die Kategorie `entwuerfe-g<ID>`:** Eine Veröffentlicht-Kategorie einer Untergruppe wird nie als
  Website erkannt – auch nicht, wenn ihre ID kleiner ist. Wer nur eine Veröffentlicht-Kategorie sieht, sieht keine Website.

### Intern (Website)

- `website-leitung` wird je Gruppe geführt: Der Wert der Website bleibt **ohne** `gruppe` (abwärtskompatibel), Untergruppen tragen `gruppe`.
- Die direkten Untergruppen kommen aus der Hierarchie-Auswertung des Organigramms (`kinderVon` neben `elternAus` in
  `shared/organigramm/gruppen.ts`), nicht aus einem Nachbau.
