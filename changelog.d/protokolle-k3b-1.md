### Neu (Protokolle, K3b-1)

- **Unterpunkte mit Nummer in bis zu vier Ebenen** (Entwurf `k3b-v1`, Alwin 04.11.2026): Tab macht aus einem
  Tagesordnungspunkt einen Unterpunkt (4.1), nochmal Tab eine Ebene tiefer (4.1.1) – bis 4.1.1.1.1. Umschalt+Tab geht
  zurück bis zum Tagesordnungspunkt. Ein Unterpunkt steht höchstens eine Ebene unter dem Punkt davor; der erste Punkt
  bleibt Punkt. Dasselbe unter „Absatz ▾ → Einrücken/Ausrücken“.
- **Die Nummern stehen überall gleich:** im Editor, beim Lesen, in den Bereichen (Beschlüsse · To-Dos · Termine) und in
  der Suche – Beschluss, To-Do und Termin unter einem Unterpunkt heißen dort „Punkt 4.2 · Essen“. Die Suche schreibt
  auch bei Tagesordnungspunkten „Punkt 4 · …“ (vorher „4. …“) und springt auch zu einem Unterpunkt.
- **Mehrere markierte Zeilen** rücken gemeinsam ein und aus.

### Behoben (Protokolle, K3b-1)

- **Tab auf einem Tagesordnungspunkt** hängte ihn als eingerückten Block unter den Text davor: Er verlor seine Nummer,
  wurde übergroß, und Beschlüsse und To-Dos darunter zählten in den Bereichen zum Punkt davor.
- **Mehrere markierte Zeilen** ließen sich mit Tab nicht einrücken – der Editor gab Tab bei einer Markierung an eine
  eigene Formatleiste weiter, die wir gar nicht zeigen.

### Intern (K3b-1)

- Eine Zählung für alle (`ableiten` in `shared/protokolle/dokument.ts`): `punktEbene`, `stufeDerEbene`,
  `punktNummer`, `punktBeschriftung`. Unterpunkte sind Überschriften der Stufe 2/4/5/6; **Stufe 3 bleibt „Überschrift“**,
  damit kein gespeichertes Protokoll seine Bedeutung ändert. Eine Überschrift 2 aus älteren Protokollen zählt jetzt als
  Unterpunkt.
- Der Editor zeigt die Nummern aus derselben Ableitung (`punktNummern.ts`, ProseMirror-Dekoration) statt aus einem
  eigenen CSS-Zähler; dafür sind `prosemirror-state`/`prosemirror-view` direkte Abhängigkeiten der Protokolle (gleiche
  Fassung wie in BlockNote, eine Kopie).
- Abschnitte ziehen und „Nach oben/unten“ rechnen nach Rang (Punkt › 4.1 › … › 4.1.1.1.1 › Überschrift), nicht nach
  gespeicherter Stufe – eine „Überschrift“ zerschneidet keinen Unterpunkt 4.1.1.
- Tab/Umschalt+Tab und die Leiste nutzen dieselbe Regel (`einruecken.ts`); in Tabellen bleibt Tab beim Zellenwechsel.
