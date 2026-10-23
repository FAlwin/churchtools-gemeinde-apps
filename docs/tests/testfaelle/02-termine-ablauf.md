# Termine und Ablauf ansehen

### TF-ABLAUF-01 · Termin öffnen und den Ablauf ansehen

**Das muss passieren:** Die Liste zeigt die kommenden Gottesdienste mit Datum und Uhrzeit. Im Ablauf
stehen alle Punkte in derselben Reihenfolge wie in ChurchTools, mit Uhrzeit links, Dauer und
Bemerkung.

1. Unten auf **Termine** tippen.
2. Den nächsten Gottesdienst antippen.
3. Die Liste von oben nach unten durchsehen.

<details><summary>Technisches</summary>

- **Priorität:** kritisch
- **Betrifft:** `client/src/pages/Agenda.tsx`, `client/src/pages/Setlist.tsx`, `client/src/components/AgendaFullView.tsx`, `ui/ablauf/AblaufListe.tsx`, `server/src/services/setlistBuilder.ts`, `server/src/controllers/setlistController.ts`
- **Automatisiert:** teilweise – `server/src/services/setlistBuilder.test.ts` (Daten), Anzeige nicht
- **Historie:** –

</details>

### TF-ABLAUF-02 · Lied antippen öffnet das RICHTIGE Lied

**Das brauchst du:** Einen Ablauf, in dem **zwischen** den Liedern andere Punkte stehen (Begrüßung,
Predigt). Ohne solche Zwischenpunkte fällt ein Zählfehler gar nicht auf.

**Das muss passieren:** Genau das Lied erscheint, das du angetippt hast. Wenn stattdessen ein
anderes kommt, zählt die App die Zwischenpunkte fälschlich mit.

1. Einen Termin öffnen.
2. Suche das **dritte Lied** von oben (Zwischenpunkte nicht mitzählen).
3. Dieses Lied antippen.
4. Oben den Titel lesen.

<details><summary>Technisches</summary>

- **Priorität:** kritisch
- **Betrifft:** `client/src/components/AgendaFullView.tsx`, `ui/ablauf/AblaufListe.tsx`, `client/src/pages/ChordChart.tsx`, `client/src/hooks/useChartNavigation.ts`
- **Automatisiert:** ja – `client/src/components/AgendaFullView.test.tsx`, `ui/ablauf/AblaufListe.test.tsx`
- **Historie:** –

</details>

### TF-ABLAUF-03 · Zuständige: Namen und offene Dienste

**Das brauchst du:** Einen Ablauf mit besetzten **und** unbesetzten Diensten. Dazu in ChurchTools bei
einem Punkt eine Person **von Hand ins Textfeld** eintragen (nicht über einen Dienst zuweisen).

**Das muss passieren:** Besetzte Plätze stehen als Name da. Unbesetzte sind erkennbar als
„Musik ?". Die von Hand eingetragene Person **fehlt nicht** – die steht in ChurchTools an einer
anderen Stelle und wurde früher übersehen.

1. Einen Termin öffnen.
2. Bei jedem Punkt die Zeile unter dem Titel ansehen (kleines Personen-Symbol).

<details><summary>Technisches</summary>

- **Priorität:** normal
- **Betrifft:** `ui/ablauf/AblaufTeile.tsx`, `shared/ct/ablaufZeile.ts`, `server/src/services/agendaFormat.ts`
- **Automatisiert:** ja – `ui/ablauf/AblaufTeile.test.tsx`, `shared/ct/ablaufZeile.test.ts`, `server/src/services/setlistBuilder.test.ts`
- **Historie:** #38

</details>

### TF-ABLAUF-04 · Zwei Termine am selben Tag stehen richtig herum

**Das brauchst du:** Zwei Gottesdienste am selben Tag zu verschiedenen Uhrzeiten.

**Das muss passieren:** Der frühere steht oben.

1. Unten auf **Termine** tippen.
2. Die beiden Termine des Tages ansehen.

<details><summary>Technisches</summary>

- **Priorität:** normal
- **Betrifft:** `server/src/services/setlistBuilder.ts`, `shared/ct/mapEvent.ts`, `client/src/pages/Agenda.tsx`
- **Automatisiert:** nein – braucht zwei echte Termine am selben Tag
- **Historie:** #36

</details>

### TF-ABLAUF-05 · Blauer Punkt zeigt, dass sich etwas geändert hat

**Das brauchst du:** Zugang zu ChurchTools im Browser, während die App offen ist.

**Das muss passieren:** In Schritt 4 hat der Termin einen **blauen Punkt** – wie eine ungelesene
Nachricht. In Schritt 5 erscheint unten kurz „Ablauf aktualisiert · 1 geändert" und der Punkt trägt
das Schildchen **geändert**. Beim allerersten Öffnen eines Termins darf **nichts** markiert sein, sonst
trüge die ganze Liste Schildchen.

1. Einen Termin öffnen und wieder zurück zur Liste (damit gilt er als gesehen).
2. Im Browser in ChurchTools ein Lied dieses Ablaufs austauschen.
3. In der App unten auf **Termine** tippen.
4. Auf den Termin in der Liste schauen.
5. Den Termin öffnen und die geänderte Zeile ansehen.

<details><summary>Technisches</summary>

- **Priorität:** hoch
- **Betrifft:** `shared/ct/agendaDiff.ts`, `server/src/services/kontoAblage.ts`, `shared/ct/personenAblage.ts`, `client/src/pages/Agenda.tsx`, `client/src/components/AgendaFullView.tsx`, `client/src/hooks/useSetlistLiveSync.ts`
- **Automatisiert:** teilweise – `server/src/services/setlistBuilder.test.ts` (Vergleichslogik)
- **Historie:** #143, #161

</details>

### TF-ABLAUF-06 · Hinweis „Ablauf aktualisiert" nennt Neues und Entferntes

**Das brauchst du:** Zugang zu ChurchTools, App mit geöffnetem Ablauf daneben – am besten **auch in der
ChurchTools-Erweiterung**, dort blieb die frühere Animation hängen.

**Das muss passieren:** Unten erscheint ein dunkler Hinweis „Ablauf aktualisiert · 1 neu", darunter
„Entfernt: ~~Titel~~" für den gelöschten Punkt. Nach etwa 6 Sekunden verschwindet er von selbst. Der
neue Punkt trägt das Schildchen **neu** – genauso lange, es verschwindet mit dem Hinweis. Nichts blinkt, nichts zerfällt,
die Seite bleibt bedienbar. Öffnest du den Termin später noch einmal, kommt **derselbe** Hinweis nicht
wieder – auch nicht in der Erweiterung, wenn du dazwischen die ChurchTools-Seite gewechselt hast.

1. Einen Termin in der App öffnen und offen lassen.
2. In ChurchTools einen Punkt **aus der Mitte** löschen und einen neuen Punkt anlegen.
3. In der App warten (bis zu einer Minute) und auf den Ablauf schauen; 6 Sekunden weiter warten.
4. In ChurchTools noch einen Punkt ändern → der Hinweis kommt wieder, jetzt nur mit „1 geändert";
   nur dieser Punkt trägt ein Schildchen, der neue von vorhin nicht mehr.
5. Zu einer anderen ChurchTools-Seite wechseln (Erweiterung) bzw. zurück zu den Terminen, dann den
   Termin wieder öffnen → kein Hinweis, keine Schildchen.

<details><summary>Technisches</summary>

- **Priorität:** normal
- **Betrifft:** `client/src/components/AgendaFullView.tsx`, `client/src/components/AblaufHinweis.tsx`, `client/src/hooks/useKurzerHinweis.ts`, `client/src/utils/ablaufAenderungen.ts`, `client/src/utils/vanishedRows.ts`, `client/src/hooks/useSetlistLiveSync.ts`, `shared/ct/agendaDiff.ts`
- **Automatisiert:** teilweise – `client/src/components/AgendaFullView.test.tsx` (Hinweis, Schildchen, Verschwinden), `client/src/hooks/useMarkSeenAfterShown.test.tsx` (Gesehen-Merken); das Zusammenspiel mit ChurchTools nicht
- **Historie:** #161, #178; 12.10.2026 erst eine Leiste über der Liste (sah aus wie ein Ablaufpunkt), dann Hinweis unten (Variante C) mit Schildchen für den ganzen Besuch, ab v2.34.1 verschwinden die Schildchen mit dem Hinweis. „Gesehen" seit v2.34.0 nach dem Anzeigen statt beim Verlassen.

</details>

### TF-ABLAUF-07 · Änderungen aus ChurchTools erscheinen von selbst

**Das muss passieren:** Die neue Tonart erscheint innerhalb etwa einer Minute **von allein**. Du
sollst nicht wischen, neu laden oder die App wechseln müssen.

1. Einen Termin in der App öffnen und das Gerät liegen lassen.
2. In ChurchTools die Tonart eines Liedes in diesem Ablauf ändern.
3. Das Gerät **nicht anfassen** und auf den Bildschirm schauen.

<details><summary>Technisches</summary>

- **Priorität:** hoch
- **Betrifft:** `server/src/services/versionMemo.ts`, `server/src/controllers/setlistController.ts`, `client/src/hooks/useSetlistLiveSync.ts`
- **Automatisiert:** nein – braucht eine echte Änderung und Wartezeit
- **Historie:** #159

</details>

### TF-ABLAUF-08 · Nach dem Liederheft ist die Terminliste sofort aktuell

**Das muss passieren:** Auch nach einer längeren Pause im Liederheft zeigt die Terminliste beim
Zurückwechseln **sofort** den aktuellen Stand – kein alter Titel, keine alte Uhrzeit, kein Warten von
bis zu einer Minute. Kurzes Nachladen ist normal und gewollt.

1. Unten auf **Termine** tippen und sich merken, was beim nächsten Gottesdienst steht.
2. Einen Termin öffnen und ins **Liederheft** wechseln. Dort mindestens **fünf Minuten** bleiben
   (Gerät nicht sperren, App nicht wechseln – sonst greift eine andere Auffrischung).
3. In dieser Zeit in ChurchTools am nächsten Gottesdienst etwas ändern, das man in der Liste sieht –
   z. B. ein Lied hinzufügen.
4. Unten wieder auf **Termine** tippen und **sofort** hinsehen.

<details><summary>Technisches</summary>

- **Priorität:** hoch
- **Betrifft:** `client/src/hooks/useServices.ts`, `client/src/App.tsx`
- **Automatisiert:** teilweise – `client/src/hooks/useServices.poll.test.tsx` prüft den Hook; die
  Verdrahtung Tab/Ansicht → Takt in `App.tsx` deckt kein Test ab, genau die ist hier gemeint
- **Historie:** #306 (v2.16.2 pausierte den Takt, ohne beim Zurückkommen nachzuladen – in v2.16.3 behoben)

</details>

### TF-ABLAUF-09 · Ablauf abschließen und wieder öffnen

**Das brauchst du:** Ein Konto mit dem Recht, Abläufe zu bearbeiten, und einen Termin, dessen Ablauf du
kurz sperren darfst.

**Das muss passieren:** Abschließen und Öffnen gehen in der App. Ist der Ablauf abgeschlossen, sagt die
App das – nicht mehr „Keine Berechtigung".

1. Den Ablauf öffnen und oben auf den **Stift** tippen (Bearbeiten).
2. Das **Schloss** oben antippen → Rückfrage „Ablauf abschließen?" → **Abschließen**.
3. Oben rechts steht statt des Schlosses jetzt das **offene Schloss** („Ablauf öffnen", blau gefüllt); es
   gibt keinen Kasten über dem Ablauf. In ChurchTools ist der Ablauf ebenfalls abgeschlossen.
4. Einen Punkt antippen, einen Punkt ziehen und das **Plus** antippen → jedes Mal erscheint unten
   „Dieser Ablauf ist in ChurchTools abgeschlossen. Zum Ändern oben rechts das Schloss antippen." –
   es öffnet sich kein Fenster, der gezogene Punkt springt zurück.
5. Das **offene Schloss** antippen (ohne Rückfrage) → oben steht wieder das Schloss zum Abschließen,
   Bearbeiten geht wie vorher.
6. Gegenprobe von außen: In ChurchTools den Ablauf abschließen, in der App (noch im Bearbeiten) einen
   Punkt löschen → statt „Keine Berechtigung" erscheint die Meldung „abgeschlossen", und kurz danach
   oben das offene Schloss.
7. Außerhalb des Bearbeitens zeigt die Ansicht bewusst keinen Hinweis.

<details><summary>Technisches</summary>

- **Priorität:** normal
- **Betrifft:** `shared/ct/schreibKern.ts`, `shared/ct/setlistKern.ts`, `client/src/pages/Setlist.tsx`, `server/src/controllers/setlistController.ts`
- **Automatisiert:** teilweise – `server/src/services/ablaufAbschluss.test.ts`, `client/src/pages/Setlist.abschluss.test.tsx`, `client/src/services/ctSchreiben.test.ts`; von Hand bleibt echtes ChurchTools
- **Historie:** Alwin 09.10.2026; seit 13.10.2026 ohne Kasten, Öffnen als Knopf oben rechts (Alwin)

</details>

### TF-ABLAUF-10 · Löschen und Verschieben lassen sich rückgängig machen

**Das brauchst du:** Recht „Ablauf bearbeiten", einen Ablauf, in dem ein Punkt **Zuständige**, eine
**Notiz** und eine **Dienstgruppen-Notiz** hat (in ChurchTools eintragen).

**Das muss passieren:** Nach dem Löschen steht unten „„Titel" gelöscht · Rückgängig". Ein Tipp holt den
Punkt **an dieselbe Stelle** zurück – mit Dauer, Notiz, Zuständigen und Dienstgruppen-Notiz. Nach dem
Verschieben gilt dasselbe für die alte Reihenfolge. Nach etwa 8 Sekunden oder mit „Fertig" verschwindet
das Angebot. Wird ein Punkt **vor dem Gottesdienstbeginn** gelöscht, rutscht der erste Punkt des
Gottesdienstes **nicht** in den Vorlauf (der Balken „Beginn" bleibt, wo er hingehört).

1. Ablauf öffnen, „Ablauf bearbeiten" tippen.
2. Den vorbereiteten Punkt antippen → „Eintrag löschen" → „Löschen".
3. Unten auf **Rückgängig** tippen; in ChurchTools nachsehen, ob alles wieder da ist.
4. Einen Punkt am Griff verschieben, dann **Rückgängig**.
5. Einen Punkt aus dem Vorlauf löschen und auf den Balken „Beginn" achten; danach Rückgängig.
6. Mit **zwei** Punkten im Vorlauf den **ersten** löschen und Rückgängig: Beide stehen wieder vor dem Balken „Beginn"
   (#700 – vorher fiel der zweite aus dem Vorlauf).

<details><summary>Technisches</summary>

- **Priorität:** hoch
- **Betrifft:** `shared/ct/schreibKern.ts`, `shared/ct/agendaPayload.ts`, `client/src/pages/Setlist.tsx`, `ui/bedienung/useRueckgaengig.ts`, `client/src/components/Toast.tsx`, `server/src/controllers/setlistController.ts`
- **Automatisiert:** teilweise – `server/src/services/ablaufRueckgaengig.test.ts`, `client/src/pages/Setlist.rueckgaengig.test.tsx`, `ui/bedienung/useRueckgaengig.test.ts`, `e2e/ablauf-rueckgaengig.spec.ts`; gegen echtes ChurchTools nur von Hand
- **Historie:** 12.10.2026 (Alwin). Nicht zurück kommt eine in ChurchTools ausgeblendete Uhrzeit – die Schnittstelle kennt das Feld nicht. #700 (23.10.2026): der erste/mittlere Vorlauf-Punkt zurück schob die übrigen aus dem Vorlauf.

</details>

### TF-ABLAUF-11 · Ablauf direkt in der App anlegen

**Das brauchst du:** Admin für die Verwaltung, Recht „Ablauf bearbeiten", in ChurchTools mindestens eine
**Ablauf-Vorlage** und kommende Veranstaltungen **ohne Ablauf** – darunter eine, die nicht passen soll
(z. B. ein Gebetsabend im selben Kalender). **Nur in der Test-Instanz** (Erweiterung oder lokaler Server):
Staging hängt am echten ChurchTools und würde dort echte Abläufe anlegen.

**Das muss passieren:** Veranstaltungen ohne Ablauf aus den gewählten Kalendern stehen mit grauer
Datumskachel und „Kein Ablauf" in der Terminliste, rechts „Ablauf anlegen". Termine, deren Name das
Suchwort nicht enthält, fehlen. Im Fenster ist die erste Vorlage vorausgewählt (die des eigenen
Kalenders zuerst). Nach „Anlegen" öffnet sich der neue Ablauf mit den Punkten der Vorlage; in der Liste
steht der Termin danach als normaler Termin – nur einmal.

1. **Mehr → Termine ohne Ablauf**: den Kalender anhaken, Suchwort „Gottesdienst", Speichern.
2. **Termine**: Der Gottesdienst ohne Ablauf steht da, der Gebetsabend nicht.
3. Zeile antippen → Vorlage gewählt lassen → **Anlegen**. Der Ablauf öffnet sich; in ChurchTools nachsehen.
4. Für einen weiteren Termin **Wie eine frühere** wählen: Der Ablauf des letzten Sonntags kommt samt
   Liedern und Balken „Beginn" mit.
5. Für einen dritten **Leer**: ein leerer Ablauf, Punkte über das Plus hinzufügen.
6. Ohne Recht „Ablauf bearbeiten" **für diesen Kalender** (anderes Konto): Die Termine stehen mit „Kein Ablauf"
   da, aber ohne „Ablauf anlegen". Ist das Konto **Admin des Termins**, gibt es „Ablauf anlegen" trotzdem (#635).

<details><summary>Technisches</summary>

- **Priorität:** normal
- **Betrifft:** `shared/ct/ablaufAnlegen.ts`, `shared/ct/ablaufRecht.ts`, `client/src/pages/Agenda.tsx`, `client/src/components/AblaufAnlegenFenster.tsx`, `ui/ablauf/AblaufAnlegenFenster.tsx`, `client/src/components/AblaufAnlegenManager.tsx`, `shared/ct/ablaufVorschlaege.ts`, `server/src/controllers/setlistController.ts`
- **Automatisiert:** teilweise – `shared/ct/ablaufAnlegen.test.ts`, `client/src/components/AblaufAnlegenFenster.test.tsx`, `client/src/pages/Agenda.ohneAblauf.test.tsx` (auch: Recht je Termin, #635), `shared/ct/ablaufVorschlaege.test.ts`, `e2e/ablauf-anlegen.spec.ts`; gegen echtes ChurchTools nur von Hand
- **Historie:** 13.10.2026 (Alwin). Gemessen: `PUT /events/{id}/agenda` mit `template_id` / `event_id` / ohne legt an; auf einen vorhandenen Ablauf antwortet es 200 und ändert nichts – die App liest trotzdem vorher nach.

</details>

### TF-ABLAUF-12 · Der Ablauf sieht aus wie in der ChurchTools-App

**Das brauchst du:** Einen Test-Termin mit Vorlauf (z. B. Soundcheck), einer Überschrift, einem Lied mit Arrangement
(Tonart, Tempo) und Zuständigen – mindestens drei Personen bei einem Punkt, eine davon mit Foto in ChurchTools.

**Das muss passieren:** Musik-App und Dienstplaner zeigen den Ablauf gleich: eine Liste mit feinen Linien (keine
Karten), links die Uhrzeit fett und die Dauer klein darunter, der Titel fett, die Zuständigen grau darunter (offene
Dienste rot mit „?“), rechts runde Kreise – Foto oder Kürzel, ab drei Personen „+N“. Überschriften und „Beginn“ stehen
als graue Balken, das Lied mit blauem Streifen und einer Lied-Karte (Liedname, Tonart · Tempo · Autor).

1. Termin in der Musik-App öffnen: Ansicht wie beschrieben; das Lied antippen öffnet das Blatt.
2. Denselben Termin im Dienstplaner öffnen: dieselbe Liste; die Lied-Karte nennt auch den Autor.
3. **Bearbeiten**: Griff links, Uhrzeit und Dauer wie in der Ansicht, rechts nur der Stift (keine Kreise); ein
   weggelassener Punkt bleibt blass.
4. Dunkelmodus in ChurchTools einschalten: alles lesbar, Kreise und Balken passen sich an.

<details><summary>Technisches</summary>

- **Priorität:** normal
- **Betrifft:** `ui/ablauf/AblaufListe.tsx`, `ui/ablauf/AblaufTeile.tsx`, `ui/ablauf/AgendaSortableRow.tsx`, `shared/ct/agendaFormat.ts`, `shared/ct/ablaufZeile.ts`, `dienstplaner/src/TerminAnsicht.tsx`, `dienstplaner/src/ladeBeiwerk.ts`, `client/src/components/AgendaFullView.tsx`
- **Automatisiert:** ja – `ui/ablauf/AblaufListe.test.tsx` (Dauer, Lied-Karte, Kreise, Balken), `ui/ablauf/useAblaufBearbeiten.test.tsx` (blass im Bearbeiten), `shared/ct/agendaFormat.test.ts` (Kürzel, Foto), `dienstplaner/src/TerminAnsicht.test.tsx` (Autor per Sammelabfrage, Fehlschlag), `client/src/components/AgendaFullView.test.tsx`; von Hand bleibt der Blick auf echte Fotos
- **Historie:** #710 (23.10.2026, Entwurf `e6-optik-entwurf.html`, gemessen E6-O0)

</details>
