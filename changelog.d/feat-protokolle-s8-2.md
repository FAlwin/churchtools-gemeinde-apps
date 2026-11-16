### Neu (Protokolle, S8-2)

- **Mit KI füllen** (Entwurf `s8-ki-v1`, Alwin 16.11.2026): Im Editor eines Entwurfs gibt es für die Leitung neben
  „Freigeben“ den Knopf **„Mit KI füllen“**. Das Fenster führt in drei Schritten: **Auftrag** (Transkript einfügen oder
  eine `.txt`-/`.docx`-Datei wählen; die Erweiterung findet Namen – auch in den Titeln der Tagesordnung – und ersetzt sie
  durch Platzhalter, je Name abwählbar, eigene Begriffe unter „Weiteres verbergen“; „Auftrag kopieren“), **Antwort**
  (die Antwort der KI einfügen; klappt das Kopieren nicht, zeigt „Auftrag anzeigen“ den Text zum Markieren) und
  **Vorschau** (Stichpunkte, Beschlüsse, To-Dos, Termine und neue Punkte mit Häkchen und Ziel; die echten Namen sind
  wieder eingesetzt). „Ausgewählte übernehmen“ fügt alles hinter den Text des jeweiligen Punkts ein (bei einem Punkt mit Unterpunkten vor den ersten Unterpunkt, damit es zu diesem Punkt zählt), neue Punkte ans Ende der Tagesordnung; das Protokoll speichert
  danach wie bei jeder Eingabe von selbst, die To-Dos entstehen beim Speichern. Das Fenster nennt keine bestimmte KI.
  Transkript, gefundene Namen und Zuordnung bleiben im Fenster – nichts davon wird gespeichert oder an ChurchTools
  geschickt. Kopiert werden kann erst, wenn die Personenliste und die Gruppenmitglieder geladen sind (sonst gingen
  Namen unersetzt hinaus); lässt sich die Personenliste nicht laden, sagt das Fenster es und lässt Namen von Hand
  eintragen.

### Intern (S8-2)

- Fenster `protokolle/src/KiFuellenFenster.tsx`, nachgeladen über `KiFuellen.tsx` (`fflate`, `docxText` und `ki.ts`
  liegen nicht im Haupt-Bundle); Personen aus `GET /persons` seitenweise (`kiPersonen.ts`, `ctAlleSeiten`, 200 je
  Seite). Neue Symbole `funke` und `kopieren` in `ui/icons`. „Auftrag kopieren“ nutzt den gemeinsamen Baustein `useKopieren` (`ui/bedienung`); `kopieren()` meldet jetzt zusätzlich, ob es geklappt hat (bisherige Aufrufer unverändert). Einfügen „ans Ende“ (auch bei übernommenen Vorschlägen) geht jetzt vor die leere Schlusszeile des Editors statt dahinter (`vorSchlusszeilen` in `dokument.ts`, `bloeckeEinfuegen.ts`) – vorher stand eine Leerzeile vor dem Neuen. Demo: `/api/persons` mit `meta.pagination`.
