### Neu (Protokolle, S4-3b)

- **Ein Tagesordnungspunkt zieht seinen Abschnitt mit** (Alwin 28.10.2026, Entwurf 7): Wer eine Überschrift am Griff
  zieht, verschiebt alles bis zur nächsten Überschrift gleicher oder höherer Stufe – Text, Aufgaben, Beschlüsse, Termine
  und feste Punkte. Überschrift 2 und 3 nach derselben Regel.
- **Abgelegt wird nur an Abschnittsgrenzen:** Lässt man mitten in einem anderen Punkt los, rückt der Abschnitt an die
  nächste Grenze – ein anderer Punkt wird nie zerschnitten. Einmal „Rückgängig“ holt alles zurück.
- **„Nach oben“ / „Nach unten“** im Griff-Menü einer Überschrift: springt um einen ganzen Abschnitt – auch der Weg am
  Handy, wo Ziehen mit dem Finger meist nicht geht.

### Behoben (Protokolle)

- Der Griff an einer Überschrift stand eine halbe Zeile tiefer, neben dem nächsten Block – wer „Punkt 2“ greifen
  wollte, zog Punkt 1 (seit S4-1: BlockNote verschiebt ihn passend zu seinen großen Überschriften, unsere sind kleiner).

### Intern (Protokolle, S4-3b)

- Regel `shared/protokolle/abschnitte.ts` (`abschnittEnde`, `ablegeStelle`, `nachbarStelle`, `abschnittVerschoben`);
  Anbindung `protokolle/src/abschnittZiehen.ts`: Beim Ziehen markiert sie den Abschnitt (BlockNote zieht dann alle
  markierten Blöcke im Bild), beim Loslassen setzt sie ihn selbst in einem Schritt. Die Markierung wird vorher
  aufgehoben – beim Durchklicken gefunden: „Rückgängig“ holte sie sonst zurück, und ein danach gezogener einzelner Block
  nahm die ganze Markierung mit. Blöcke ohne Überschrift legt BlockNote weiter frei ab.
