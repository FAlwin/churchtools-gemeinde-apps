### Geändert (Dienstplaner)

- **Planen: ruhigere Werkzeugzeile.** Über der Tabelle steht jetzt eine Zeile statt dreien: links die Ansicht (Matrix ·
  Personen · Wer wie oft?), in der Fenstermitte der Zeitraum mit ‹ ›, rechts **Filter** und **⋯**. Am Handy ist sie
  zweizeilig: oben die Ansicht als blauer Knopf mit Pfeil, daneben Lupe, Filter und ⋯ (alle mit Rahmen), darunter der Zeitraum.
- **Gewohnheit: Erinnern und Teilen liegen jetzt im ⋯-Menü** – ebenso **Ablauf bearbeiten**, **Vorlagen** und **Hilfe**, jeweils
  mit Symbol und Wort. Wer „Ablauf bearbeiten“ einschaltet, sieht oben den blauen Knopf „Fertig“, bis er fertig ist. Nichts
  ist weggefallen, nur einen Klick tiefer.
- **Breite Spalten** steht im Filter unter „Anzeige“ (vorher zwei Symbole in der Zeile). Die Zahl am Filter zählt nur
  ausgeblendete Einträge, nicht die Anzeige. **＋ früheren / späteren Termin dazunehmen** liegt im Fenster des Zeitraums.
- **Person hervorheben** ist jetzt eine Lupe rechts neben den Reitern (am Handy in der Werkzeugzeile); ein Tipp klappt das
  Feld auf, Esc oder ✕ klappt es zu. Das Hervorheben selbst ist unverändert.
- **Freie Plätze leiser:** ein graues, gestricheltes Feld mit „＋ frei“. Rot ist nur noch die Zahl „N frei“ am Termin.
- **Zauberstab und Regler** in der Gruppenzeile erscheinen am Rechner erst, wenn die Maus auf der Zeile steht; am Handy sind
  sie immer sichtbar.

### Intern

- Neue Bausteine in `ui/bedienung`: `Werkzeugzeile` (links · Mitte · rechts, Handy zweizeilig mit Rahmen), `AnsichtWahl`,
  `MehrMenue` („⋯“-Menü; `Option` bekommt `symbol`, `gesperrt`, `gewaehlt`) und `HilfeFenster`; `FilterKnopf` bekommt `still`
  und Abschnitte vom Typ `anzeige`, `ZeitraumKnopf` den Bereich `dazu`, `SuchLupe` Namen, Tastenfang und Platz für Vorschläge.
  Neue Icons `mehr` und `hilfe`. Wächter `bedienKnoepfe`: Obergrenze Dienstplaner 83 → 81.
- Testhilfe `dienstplaner/src/mehrMenue.testutil.ts` (Menü öffnen, Eintrag antippen, Zeitraum-Fenster, Filter).
- `tsc -p ui`: zwei Altlasten in `KopfKnopf.test.tsx` und `SuchLupe.test.tsx` behoben.
