### Neu (Protokolle, S6-2)

- **In der Gruppe Bescheid geben** (Entwurf `s6-freigabe-pdf-v1`, Alwin 09./11.11.2026): Beim Freigeben gibt es das
  Häkchen „In der Gruppe Bescheid geben“ (vorbelegt an, mit Vorschau) – nur, wo man in ChurchTools Beiträge schreiben
  darf. Dann entsteht ein Beitrag in der Gruppe „Protokoll vom … ist freigegeben“ mit dem Link **„Protokoll öffnen“**.
  Klappt der Beitrag nicht, ist das Protokoll trotzdem frei („Nochmal versuchen“); ist unklar, ob er schon da ist,
  bittet das Fenster, in der Gruppe nachzusehen, statt ihn doppelt zu schicken.
- **Direkt zu einer Sitzung:** `#/sitzungen/<Gruppe>/<Sitzung>` öffnet die Protokolle gleich bei dieser Sitzung.

### Intern (S6-2)

- Gemessen 11.11.2026: `GET /post/groups` listet die Gruppen, in denen man schreiben darf (`type: 'postPossible'`);
  `POST /posts` (Markdown, Absatz = Leerzeile) → ID → nachgelesen.
- Regel `shared/protokolle/beitrag.ts` (Text, Markdown-sicherer Titel, Gruppen aus `/post/groups`); Schreiben
  `protokolle/src/beitragSchreiben.ts` mit `abgelehnt` aus `planen.ts` (abgelehnt → wiederholbar, unklar → `Unklar`,
  angelegt → der nächste Versuch liest nur nach).
- Das Freigabe-Fenster arbeitet die Folgeschritte (Treffen, Beitrag) einzeln ab; „Nochmal versuchen“ wiederholt nur,
  was gescheitert ist und sich gefahrlos wiederholen lässt.
- Den Listenschlüssel einer Sitzung mit Protokoll (`p:<Sitzung>`) bilden jetzt alle Stellen über `protokollSchluessel`
  (vorher fünfmal von Hand).
