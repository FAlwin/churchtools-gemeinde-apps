### Intern

- **Anmeldungen: Schritte im Baukasten** (Etappe F, Scheibe F2c; noch nicht freigegeben, veröffentlicht wird erst nach
  Etappe F). Nach dem abgenommenen Entwurf `f2-schritte-v1`, Klick-Runden 7 und 8:
  - Neuer Baustein **„Neuer Schritt“** in der Leiste (Gestaltung) – geht überall, auch mitten in den Fragen je Person.
    Der Name ist vorbelegt und Pflicht (höchstens 60 Zeichen); beim Bearbeiten nur Name und „Nur zeigen, wenn …“.
  - Im Baukasten steht ein Schritt als **Balken „Schritt 2 · Name“** zwischen den Feldern, verschiebbar wie jeder
    Baustein; bedingte zählen mit, ein Schritt ohne Fragen sagt „Noch keine Fragen in diesem Schritt“
    (`schrittImBaukasten`).
  - Sobald es einen Schritt gibt, steht oben der **feste Balken „Schritt 1“** – Name änderbar (`ersterSchritt`; leer
    gilt nicht, der Standardname „Deine Angaben“ wird nicht gespeichert), nicht verschiebbar, nicht zu entfernen.
  - **Bedingung am Schritt:** Fenster, Regel-Liste und Meldungen nennen ihn Schritt „Name“ und sagen, dass er mit allen
    Fragen darin übersprungen wird. Die Benennung steht an EINER Stelle (`feldName`, für Fehler, Sperre beim
    Verschieben, weggefallene Bedingungen); der Satz „… erscheint nur, wenn …“ ebenso (`zeigeSatz`, vorher im Fenster
    am Feld und im Regel-Fenster doppelt).
