### Neu (Protokolle, K3b-2)

- **Früheres Protokoll** (Entwurf `k3b-v1`, Alwin 04.11.2026): „Einfügen ▾ → Früheres Protokoll“ (auch im „/“-Menü)
  fragt in einem Fenster, **welches** – alle freigegebenen Protokolle der Gruppe, neueste zuerst, das letzte vorgewählt.
  Der Punkt heißt dann „Protokoll der letzten Sitzung“ oder „Protokoll vom 09.09.2026“.
- Am Kasten **„Ändern“** (nur beim Schreiben): ein anderes Protokoll wählen; ein selbstgesetzter Titel zieht mit, ein
  eigener bleibt. Ein Kasten ohne Wahl (aus der Vorlage) sagt „immer die letzte Sitzung“.
- **„Ansehen“** zeigt das Protokoll im kleinen Fenster (bisher hieß der Knopf „Öffnen“); dort springt **„Öffnen“** zu
  dieser Sitzung – aus dem Editor erst nach dem Speichern. „Zurück“ führt wieder zum Protokoll, aus dem man kam.

### Behoben (Protokolle, K3b-2)

- **Kasten am Handy:** Mit zwei Knöpfen rutschen „Ändern“ und „Ansehen“ unter den Text, statt ihn zu einer schmalen
  Spalte zu quetschen (im Entwurf gefunden).

### Intern (K3b-2)

- Eine Regel in `shared/protokolle/festePunkte.ts`: `fruehereProtokolle`, `fruehererTitel`, `istFruehererTitel`,
  `festesProtokollWert` (die Freigabe schreibt `props.fest` jetzt über dieselbe Funktion) und `TITEL_LETZTES_PROTOKOLL`
  (vorher als Text in Vorlage und Anzeige). Die Wahl steht gleich in `props.fest` – kein neues Datenformat.
- Leiste und „/“-Menü fügen feste Punkte über `festenPunktAnbieten` ein (`fruehesProtokoll.ts`); die Punkte des
  „/“-Menüs stehen in `festeImMenue` und sind damit erstmals getestet.
