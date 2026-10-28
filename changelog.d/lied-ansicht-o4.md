### Neu (Dienstplaner, E6-O O4)

- **Lied-Ansicht:** Ein Lied im Ablauf antippen öffnet ein Fenster wie die Song-Seite der ChurchTools-App – Autor ·
  Verlag · CCLI, Arrangement, Tonart · Tempo und die **Dateien** des Arrangements (antippbar, sie öffnen sich aus
  ChurchTools; die Versionen, die die Musik-App selbst ablegt, stehen nicht darin). Auch im Bearbeiten: Im Punkt-Fenster
  hat die Zeile „Lied“ jetzt einen Pfeil und zeigt die Ansicht an seiner Stelle; „Zurück“ kehrt mit allen ungespeicherten
  Eingaben zurück (Alwin, 28.10.2026: an beiden Stellen).
- **„In der Musik-App öffnen“ führt direkt zum Blatt dieses Lieds** im Ablauf dieses Termins. Ist die Musik-App in der
  Gemeinde nicht installiert, steht der Knopf ausgegraut da – mit dem Hinweis, dass ein ChurchTools-Admin sie installiert
  (Alwin).

### Neu (Musik-App, E6-O O4)

- **Direktlink** `…/ccm/<musik-app>/#/termin/<Termin>/punkt/<Ablaufpunkt>?am=<Tag>`: öffnet das Blatt des Lieds dieses
  Punkts (Punkt ohne Lied: den Ablauf) und nimmt den Link danach aus der Adresse, damit ein Neuladen nicht wieder
  hinspringt. **Auch für Termine außerhalb der geladenen Wochen** (vergangen oder weiter als sechs Wochen voraus): Den
  Tag holt die App dann eigens nach. In der Test-Instanz landete ein Termin von vor zehn Tagen sonst in der Übersicht.

### Behoben (Musik-App)

- **Wiederherstellung nach dem Start wartet auf die Rechte:** Solange sie unterwegs waren, galt die Terminliste schon als
  „fertig“, und die App gab den gemerkten Termin auf und landete in der Übersicht (gefunden mit dem Direktlink, in den
  E2E-Läufen ohne den Fix 1 von 3 grün).

### Intern (E6-O O4)

- Neu `shared/ct/musikAppLink.ts` (Direktlink bauen und lesen – eine Regel für beide Apps) und
  `client/src/utils/liedZumPunkt.ts` (welches Blatt gehört zu einem Punkt – dieselbe Zählung wie die Blätter).
- Ein Direktlink wird beim Start nur **gelesen**, aus der Adresse genommen erst danach in einem Effekt: React ruft
  Startwerte im StrictMode zweimal auf, und das frühere Löschen ließ den zweiten Aufruf leer ausgehen.
- Symbol, Art und Anzeige einer Datei (`DATEI_SYMBOL`, `DATEI_ART`, `dateiZeilen`, `dateiGroesse`) liegen jetzt in
  `ui/lied/` – die Lied-Ansicht nutzt dieselben wie die Dateiverwaltung der Musik-App.
- Dienstplaner: `ladeLiedAutoren` → `ladeLiedDaten` (dieselbe eine Abfrage, behält jetzt das ganze Lied); die Ablaufzeile
  trägt `songId` und den Namen des Arrangements; `AblaufListe.onLied` meldet auch den Punkt; `PunktFenster.liedAnsehen`.
- Musik-App: Der Direktlink wird in `useDirektLink` gelesen (vor der Terminabfrage, die ihn zum Nachladen braucht) und an
  `useAppNav` gereicht; neu `useTermineAm(tag)` (`from`=Tag, `to`=Folgetag – ChurchTools zählt `to` nicht mit,
  gemessen 28.10.2026).
- E2E `e2e/direktlink-lied.spec.ts` (auch ein vergangener Termin, mit und ohne Tag). Der CT-Stub filtert `/api/events`
  jetzt wie ChurchTools nach `from`/`to` und hat einen vergangenen Termin mit Lied. Die Tests laden erst neu, wenn der
  Anmeldestatus gespeichert ist: Der Abfrage-Speicher schreibt höchstens einmal je Sekunde, und `['me']` gilt 60 s als
  frisch – wer früher neu lädt, sieht wieder das Anmelden (parallel in jedem zweiten bis dritten Lauf).
