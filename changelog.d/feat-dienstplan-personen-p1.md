### Neu (Dienstplaner)

- **Planen: neue Ansicht „Personen“ (nur ansehen).** Dritter Knopf neben „Matrix“ und „Wer wie oft?“: dieselben Termine,
  derselbe Zeitraum und dieselben Filter wie die Matrix, aber als Raster – Zeilen = Personen, Spalten = Termine, ein Block
  je Dienst. So sieht man, wer wann eingeteilt, abwesend oder noch frei ist.
  - **Zeile je Person und Dienst** („auch Gesang“ neben dem Namen), mit **Einsätze** (zugesagt + angefragt in
    diesem Dienst). Zeilen sind die Mitglieder der ChurchTools-Gruppen des Dienstes (mehrere Gruppen werden zusammengeführt)
    und wer dort eingeteilt ist, ohne Mitglied zu sein.
  - **Zelle:** der Dienst als ChurchTools-Tag in der Farbe des Dienstes; Haken = zugesagt, Kreis mit ? = angefragt, Stift
    gestrichelt = Entwurf. Ein zweiter Dienst am selben Tag steht als „+ Gesang“, einer aus einer ausgeblendeten Gruppe
    blass als „+ Ton (Technik)“. Abwesend = grauer Tag mit dem Grund (auch mehrtägig, auch wenn sie vor dem Zeitraum
    begann); abwesend **und** eingeteilt zeigt beides mit rotem Rand.
  - **Gäste**-Zeile je Block, Fußzeile **„Noch offen“** (freie Plätze je Termin, gezählt wie in der Matrix). Maus über dem
    Namen hebt alle Zeilen der Person schwach hervor, Antippen nimmt sie in den Fokus (Wunsch 11). Am Handy dieselbe Tabelle, waagerecht scrollbar, die
    Namensspalte bleibt stehen. Ein Klick in eine Zelle tut noch nichts – Eintragen folgt.
  - **Abwesenheiten nur mit Recht:** „Abwesenheiten verwalten“ (global) oder „Abwesenheiten sehen“ in der Gruppe. Ohne
    Recht sagt der Block „Abwesenheiten nicht sichtbar“, statt leerer Zellen zu zeigen (ChurchTools liefert dann still eine
    leere Liste).
  - **Aussetzer zerstören nichts:** Scheitert eine Gruppe vorübergehend, steht im Block ein Hinweis mit „Nochmal
    versuchen“ (nur diese Gruppe wird neu geholt); der Rest bleibt nutzbar.
  - **Technik:** Rechnung in `shared/dienstplan/personenRaster.ts` (reine Funktionen aus Plan, Mitgliedern,
    Abwesenheiten, Entwürfen – dieselben Regeln wie die Matrix: `planAus`, `decktTermin`, Entwurf-am-Platz), Laden in
    `dienstplaner/src/ladePersonen.ts` (`GET /groups/{id}/members` und `/absences`, je Gruppe einmal, höchstens vier
    gleichzeitig), Farben an einer Stelle (`personenFarben.ts`). `PlanSpalte.ende` kommt aus derselben Regel wie
    `TerminZeile.ende` (`terminEnde`).
  - **Umbenannt:** Der gemerkte Wert `personen` (bisher „Wer wie oft?“) wird beim Lesen zu `werWieOft` übernommen – wer
    „Wer wie oft?“ gemerkt hatte, sieht weiter diese Ansicht. Das neue Raster heißt intern `raster`.
