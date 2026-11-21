### Neu (Protokolle)

- **Tabellenzellen farbig füllen (W11).** Im Menü an Zelle, Zeile und Spalte der Tabelle steht jetzt **„Farben“** (nur der Hintergrund, die neun Farben des Editors).
  Lese-Ansicht und PDF zeigen die Farbe, die Ansicht auch im Dunkelmodus. Die Schriftfarbe je Zelle gibt es bewusst nicht (das PDF kennt sie nicht; markierter
  Text hat seine eigene Farbe).
- **Aufzählungen in Tabellenzellen (W11).** Eine Zelle nimmt nur Text, keine Listenblöcke – darum ist die Aufzählung dort Text: „- “ oder „\* “ am Zeilenanfang
  (Zellanfang oder nach einem Zeilenumbruch) wird „• “, „1. “ bleibt „1. “. **Enter** auf so einer Zeile setzt die Aufzählung in **derselben Zelle** fort („• “ bzw. die
  nächste Nummer), **Enter auf einer leeren Aufzählungszeile** nimmt das Zeichen weg und beendet sie. Wo keine Aufzählung steht, springt Enter weiter wie bisher in die
  Zelle darunter; Umschalt+Enter macht wie bisher nur einen Zeilenumbruch. Die Regel steht in `shared/protokolle/zellenListe.ts`.

### Geändert (Protokolle)

- **Aufzählungszeichen überall gleich (W11): • ◦ –.** Ebene 1 „•“, Ebene 2 „◦“, Ebene 3 und tiefer „–“ – im Editor, in der Lese-Ansicht und im PDF. Vorher
  zeigte der Editor • ◦ ▪, die Lese-Ansicht Scheibe/Kreis/Quadrat und das PDF auf jeder Ebene „•“. Eine Quelle (`aufzaehlungsZeichen`), das PDF kennt jetzt die Ebene einer
  Aufzählung; ein Wächter-Test vergleicht die Zeichen in den beiden Stilen. Die Schrift der PDFs hat „◦“ nicht – es wird als kleiner Kreis gezeichnet.
- **Zeilenumbrüche in der Lese-Ansicht:** Ein Zeilenumbruch im Text (Umschalt+Enter, Zeilen einer Aufzählung in der Zelle) erschien dort bisher als Leerzeichen und
  steht jetzt als Umbruch. Im PDF war er schon immer einer; eine am Ende leere Zeile in einer Zelle (nach beendeter Aufzählung) erzeugt dort keine Leerzeile mehr.
