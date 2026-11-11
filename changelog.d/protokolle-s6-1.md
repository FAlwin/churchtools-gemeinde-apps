### Neu (Protokolle, S6-1)

- **Protokoll freigeben** (Entwurf `s6-freigabe-pdf-v1`, Alwin 09./11.11.2026): Im Editor oben „Freigeben“ (nur die
  Leitung). Das Fenster zeigt **Hinweise, ohne zu zwingen** – offene Anwesenheit („geprüft?“), To-Dos ohne Zuständigen,
  offene Vorschläge – mit „Ansehen“ (springt an die Stelle) und einer Zusammenfassung.
- **Freigeben** speichert, hält die festen Punkte fest, macht das Protokoll fest und **schließt das Gruppentreffen** in
  ChurchTools ab (Kommentar und Gäste bleiben erhalten). Scheitert nur das Abschließen, ist das Protokoll trotzdem frei
  – „Nochmal versuchen“. To-Dos bleiben abhakbar. Oben steht danach **„freigegeben am … von …“**.
- **Freigabe zurücknehmen** (nur die Leitung, mit Rückfrage): wieder Entwurf, die festen Punkte zeigen wieder den
  aktuellen Stand; über dem Protokoll „Freigabe zurückgenommen am … von … – vorher freigegeben am … von …“. Das
  Gruppentreffen bleibt abgeschlossen.

### Intern (S6-1)

- Gemessen 11.11.2026 (`messung-s6-0-2026-11-11.md`): Abschließen braucht `startDate`, ein schlankes `PUT` leert
  Kommentar und Gäste → ganz lesen, alles zurück. Ein Baustein `treffenAendern` für Verschieben (K2b) und Abschließen.
- Regel `shared/protokolle/freigabe.ts` (Hinweise aus `ableiten`, Kopf frei/zurück, Verlauf mit Namen im Kopf,
  Vermerk); `festhaltenFuerFreigabe` und `festePunkteLoesen` in `festePunkte.ts` – die Freigabe markiert ihr
  „Letztes Protokoll“, eine bewusste Wahl (K3b-2) bleibt beim Zurücknehmen.
- Speichern in Bausteine geteilt (`teileSichern`, `alteTeileWeg`); Freigeben und Zurücknehmen nutzen dieselbe
  Reihenfolge (neue Teile → nachlesen → Kopf → nachlesen → alte weg). Der To-Do-Abgleich ist eine Funktion für Speichern
  und Freigeben.
- Der Test-Nachbau verhält sich beim Treffen wie gemessen (Pflicht `startDate`, leert Gäste, abgeschlossen = gesperrt).
