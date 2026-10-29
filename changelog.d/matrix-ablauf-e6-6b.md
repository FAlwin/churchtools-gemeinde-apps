### Neu (Dienstplaner, E6-6b)

- **Punkte zwischen Terminen ziehen:** In der Planen-Matrix lässt sich im Bearbeiten (Stift in der Gruppe „Ablauf“) ein
  Punkt am Griff in einen anderen Termin ziehen. Eine gestrichelte Stelle „hier ablegen“ zeigt, wo er landet – am
  Beginn-Balken davor (dann läuft er im Vorlauf) oder dahinter. Beim Loslassen fragt die Matrix „„Begrüßung“
  verschieben? Vom So, 01.11. zum So, 08.11. – nach „Way Maker““ mit **Abbrechen / Kopieren / Verschieben**. Entwurf
  `e6-6-entwurf-2.html` Bild 3, abgenommen von Alwin am 28.10.2026.
- **Rückgängig** wie beim Löschen (Alwin, 29.10.2026): Verschieben legt den Punkt im alten Termin an der alten Stelle
  wieder an (samt Vorlauf und „weggelassen“) und löscht ihn im neuen; Kopieren löscht die Kopie.
- **Wohin nicht:** in Termine **ohne Ablauf** (Alwin, 29.10.2026: erst „+ Ablauf anlegen“, dann hineinziehen), in
  abgeschlossene Abläufe, aus abgeschlossenen heraus und zwischen zwei Terminen, die sich **einen** Ablauf teilen. Dort
  erscheint keine Stelle; beim Loslassen sagt ein Hinweis, warum.
- Ein im alten Termin weggelassener Punkt steht im neuen sichtbar – „weggelassen“ gilt je Termin (gemessen E6-6-0).
- Am Handy bleibt das Ziehen innerhalb des Termins (der Handy-Plan zeigt nur einen).

### Geändert (Dienstplaner – Durchklicken Alwin, 29.10.2026)

- **Deutlichere Trennung zwischen Ablauf und Diensten** in der Matrix (Entwurf `e6-6-trennung.html`, Variante C): Unter
  jedem Ablauf steht ein grauer Balken **„Ende“** mit der Uhrzeit, zu der der letzte Punkt aufhört (Beginn + Dauer aus
  ChurchTools; ChurchTools zeigt diese Zeit selbst nicht an) – auch im Bearbeiten, damit nichts springt. Darunter teilt
  ein Streifen in der Seitenfarbe die Tabelle, darüber leise **„Dienste“**. Vorher folgte auf den letzten Punkt sofort
  „Programm“, und man sah nicht, wo der Ablauf endet (Alwin). Termin-Ansicht und Musik-App bleiben, wie sie sind.

### Intern (E6-6b)

- Neu `shared/ct/punktUebertragen.ts`: verschieben/kopieren über den Schreibkern – Merkzettel wie beim Löschen
  (`merkzettelAus`, jetzt eine Stelle für `punktLoeschen` und das Übertragen) → im Ziel anlegen und nachlesen
  (`punktWiederherstellen`, liefert jetzt die neue ID) → **erst dann** im alten Termin löschen. Abgeschlossen und
  geteilt werden vor dem ersten Schreiben geprüft; scheitert nur das Löschen, sagt die Meldung, dass der Punkt doppelt
  steht. „Rückgängig“ in derselben Reihenfolge (erst zurückholen, dann im Ziel löschen). Geteilt erkennt
  `teilenAblauf` (Ablauf-ID oder `verbundeneTermine`, dieselbe Regel wie „Neu aufsetzen“).
- Neu `ui/ablauf/AblaufZiehBereich.tsx` + `ablaufZiehen.ts`: EIN Zieh-Bereich für alle Spalten der Matrix; jede
  Bearbeiten-Liste meldet sich mit `useAblaufBearbeiten({ ziehen })` an (Zieh-IDs Spalte + Punkt, sonst wären sie bei
  geteiltem Ablauf doppelt). Wo der Punkt landet, rechnet `platzIn`. Ohne Bereich (Musik-App, Termin-Ansicht, Handy)
  zieht jede Liste wie bisher für sich.
- Neu `ui/fenster/BodyPortal.tsx`: an `body` hängen **mit** dem Bereichs-Attribut – ohne es fehlten dort in der
  Erweiterung die Farben (das Zieh-Bild war beim Durchklicken durchsichtig). Frage und Zieh-Bild stehen so außerhalb der
  Tabelle; den versteckten Screenreader-Text von dnd-kit hängt der Bereich ebenfalls an `body` (sonst ein `div` in
  `tbody`).
- Der Sperr-Hinweis des Dienstplaners (`GESPERRT`) steht jetzt in `ablaufAktionen.ts` – eine Stelle für die
  Bearbeiten-Liste und das Ziehen.
- Demo (`?demo`): Termin 103 hat einen Ablauf (zum Ziehen zwischen zwei Terminen), alle Termine nennen ihren Kalender
  wie in ChurchTools (vorher scheiterte „Ablauf anlegen“ in der Matrix-Demo mit „Kalender unbekannt“).
