### Neu (Organigramm)

- **Organigramm: Gruppenwechsel einrichten – jetzt wird geschrieben** (Bauplan O9-5d, nur mit „Berechtigungen verwalten“).
  Der Hauptknopf im Fenster „Gruppenwechsel einrichten“ bzw. „Stufen ändern“ legt an und schreibt, was die Vorschau gezeigt hat –
  in der gemessenen Reihenfolge: Gruppentyp → Rechte der Leitung → Wechsel-Gruppen → Routinen → Regeln → Status → Regeln der
  Kindergruppen → Status → neu berechnen → Einrichtung speichern. **Jeder Schritt wird sofort nachgelesen**; ein „angenommen“ von
  ChurchTools allein zählt nicht. Beim ersten Fehler wird aufgehört, im Schritt „Fertig“ steht je Baustein ✓, ✗ mit Grund oder
  „noch nicht geschrieben“.
  - **„Nochmal versuchen“** liest alles neu und schreibt nur, was fehlt. Zeitüberschreitung, Serverfehler, Drosselung und
    Netz gelten als vorübergehend: Nichts wird zurückgerollt oder gelöscht. Fehlt ein Recht, steht das da.
  - **Nie eine zweite Wechsel-Gruppe:** Die Einrichtung wird sofort nach jeder neu angelegten Wechsel-Gruppe gespeichert.
    Bricht es genau dazwischen ab, zeigt die Seite „Einrichtung“ die Gruppe als ⚠ („nicht in der Einrichtung eingetragen“), und
    „Nochmal versuchen“ übernimmt sie, statt eine neue anzulegen.
  - **Status „aktiv“:** Alle Wechsel-Gruppen und Kindergruppen werden auf „aktiv“ gestellt – nur aktive Gruppen rechnet ChurchTools
    von selbst neu. Die Seite „Einrichtung“ meldet „manual“ und „inactive“ jetzt als ⚠ „rechnet nicht von selbst neu“.
  - **Stufen ändern:** Fällt eine Stufe weg, gehen nur **unsere** Regeln aus ihr (fremde bleiben); nicht mehr gebrauchte
    Wechsel-Gruppen werden **nicht gelöscht**, „Fertig“ nennt sie. Die Bereichsgruppe ist beim Ändern gesperrt (nur Anzeige;
    wechseln in ChurchTools).
  - **Läuft heute schon ein Wechsel**, steht in der Vorschau gelb „Der Wechsel <Jahr> läuft gerade – nach dem Schreiben kommen N
    Kinder sofort in die Wechsel-Gruppe bzw. werden verschoben.“ (kein Stopp).
  - **„Damit die Leitungen den Reiter sehen“:** Im Schritt „Fertig“ steht, welche Leserechte (Organigramm, Kategorien „Gruppenwechsel“
    und „Was das Organigramm zeigt“, Ferienkalender) an welchen Rollen fehlen können – gesetzt wird das nicht.
- **Organigramm: „Wechseltage nachtragen …“** (Seite „Wechseltage“ beim gelben Hinweis und Seite „Einrichtung“ bei ⚠ „Wechseltage in
  den Regeln“). Ein kurzes Fenster Vorschau › Fertig, das nur die Regeln aller Gruppen um die neuen Jahre aus dem Ferienkalender
  ergänzt; Ausnahmen bleiben, fremde Regeln halten auf.
- **Organigramm: „Rechte setzen …“** (Seite „Einrichtung“ bei ⚠ „Rechte der Leitung“, wenn eines der drei Rechte fehlt). Zeigt die
  Rechte, setzt nach dem Haken „geprüft“ nur die fehlenden und liest nach; nichts wird entzogen.

### Geändert (Organigramm)

- **Organigramm: Der Stand „Regeln der Gruppen“ verlangt Status „aktiv“.** Bisher galt alles außer „none“ als gut – bei „manual“
  oder „inactive“ hätte ChurchTools am Wechseltag aber niemanden von selbst verschoben.

### Intern (Organigramm)

- **Organigramm:** `schreibeEinrichtung` (`organigramm/src/einrichtenSchreiben.ts`) führt `einrichtungsPlan` aus; der Plan hat
  dafür die Schritte „unsere Regeln entfernen“ und „Einrichtung speichern“ und nennt nicht mehr gebrauchte Wechsel-Gruppen.
  Gemeinsame Bausteine: `kuenftigeWechseljahre`, `offenesFenster`, `waiseKandidaten` (Stand und Wiederholen nutzen dieselbe
  Regel), `werTeil`, `FremdHinweise`, `WerTabelle`. Tests laufen gegen ein gefälschtes ChurchTools, nie gegen eine Instanz.
