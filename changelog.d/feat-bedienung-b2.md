### Geändert (Dienstplaner + Organigramm + Protokolle + Website)

- **Ruhigere Reiter am Computer.** Die Bereiche oben (z. B. Start · Dienste · Planen) stehen jetzt als Text mit blauer
  Unterstreichung unter dem App-Namen, wie in ChurchTools und in der Musik-App – nicht mehr als Kasten-Umschalter.
  Am Handy bleibt die Leiste unten. Nichts ist weggefallen, nur das Aussehen ist leiser. In den Protokollen steht die
  Lupe am Computer rechts neben den Reitern, der rote Zähler am Reiter „To-Dos“ ist unverändert.

### Intern

- Die Reiter zeichnet `ErweiterungsSeite` selbst (`bereiche`, `handy`, `lupe`) – eine Stelle für alle Apps statt vier
  Kopien. Neuer Wächter `ui/design/reiterUnterstrichen.test.ts`: kein `Segment` mit dem Namen „Bereiche“.
