### Neu (Dienstplaner und Musik-App, E6-4 – Alwin, 30.10.2026)

- **Infos je Dienstgruppe** („Technik: Mikro 1“, „Musik: Intro leise“) – in ChurchTools gab es sie schon, die Apps
  zeigten sie nicht. Entwurf `e6-infos-spalten.html`, abgenommen 30.10.2026.
  - **Ansehen am Rechner:** Neben „Bearbeiten“ steht der Knopf **„Spalten“**. Er listet die Dienstgruppen, deren Infos
    man in ChurchTools sieht, mit der Zahl der Punkte, an denen schon etwas steht. Angehakt = eigene Spalte rechts im
    Ablauf, wie im Ablaufplan von ChurchTools. Die Wahl merkt sich das Gerät; ohne Haken bleibt alles wie bisher.
  - **Am Handy:** Die angehakten Gruppen stehen als Zeile „Technik: …“ unter dem Punkt.
  - **Bearbeiten im Punkt-Fenster:** Unter „Bemerkung“ der Abschnitt „Infos je Gruppe“ mit einem Feld je sichtbarer
    Gruppe; leer lassen = keine Info. Gespeichert wird je Gruppe einzeln – die Infos anderer Gruppen bleiben
    unangetastet. Hat jemand dieselbe Info inzwischen geändert, fragt das Fenster wie bei den übrigen Feldern.
  - **In der Matrix keine Infos** (dort ist kein Platz für Spalten je Gruppe).
- **Bekannt:** Bearbeitet jemand einen Punkt in der Ablauf-Ansicht von ChurchTools selbst, löscht ChurchTools alle
  Infos dieses Punkts (gemessen 22.10.2026, gemeldet als Entwurf `docs/churchtools-meldung-gruppen-infos.md`).

### Intern (E6-4)

- `ablaufZeileAus` liefert `infos` (aus `serviceGroupNotes`, dieselbe Auswahl wie beim Mitschreiben); `punktStand`
  vergleicht sie beim Speichern je geänderter Gruppe.
- Schreibkern: `PunktAenderung.infos` (Gruppe → Text, leer = löschen) schreibt je Gruppe über
  `PUT/DELETE …/items/{id}/servicegroups/{gruppe}` (gemessen E6-4-0); nur Infos geändert → der Punkt selbst wird nicht
  geschrieben. Das Server-Schema der Musik-App lässt `infos` durch.
- Welche Gruppen man sieht, steht an EINER Stelle (`infoGruppen`, `dienstgruppenSichtAus` in `shared/ct/dienstRechte.ts`)
  – für den Dienstplaner und für die Rechte der Musik-App (Server und Erweiterung, neues Feld `infoGruppen`).
- Neu `ui/ablauf/InfoSpalten.tsx` (Knopf) und `infoSpaltenWahl.ts` (Wahl, gemerkt über den gemeinsamen Gerätespeicher
  `ui/bedienung/geraet.ts`, dort neu `zahlen` neben `texte`); `AblaufListe` mit
  `infoSpalten`. Demo: Infos an drei Punkten, Schreiben je Gruppe wie gemessen.
