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

**Das brauchst du:** Recht „Ablauf bearbeiten" für einen Kalender, in ChurchTools mindestens eine
**Ablauf-Vorlage** und kommende Veranstaltungen **ohne Ablauf** in diesem Kalender. **Nur in der Test-Instanz**
(Erweiterung oder lokaler Server): Staging hängt am echten ChurchTools und würde dort echte Abläufe anlegen.

**Das muss passieren:** Mit „auch ohne Ablauf“ im Filter stehen die Veranstaltungen ohne Ablauf aus diesem Kalender
mit grauer Datumskachel und „Kein Ablauf" in der Terminliste, rechts „Ablauf anlegen" – alle, ein Suchwort gibt es
nicht mehr. Im Fenster ist die erste Vorlage vorausgewählt (die des eigenen Kalenders zuerst). Nach „Anlegen" öffnet
sich der neue Ablauf mit den Punkten der Vorlage; in der Liste steht der Termin danach als normaler Termin – nur
einmal.

1. **Termine → Filter**: beim Kalender das eingerückte Häkchen **auch ohne Ablauf** setzen.
2. Die Veranstaltungen ohne Ablauf aus dem Kalender stehen da (z. B. auch ein Gebetsabend im selben Kalender).
3. Zeile antippen → Vorlage gewählt lassen → **Anlegen**. Der Ablauf öffnet sich; in ChurchTools nachsehen.
4. Für einen weiteren Termin **Wie eine frühere** wählen: Der Ablauf des letzten Sonntags kommt samt
   Liedern und Balken „Beginn" mit.
5. Für einen dritten **Leer**: ein leerer Ablauf, Punkte über das Plus hinzufügen.
6. Ohne Recht „Ablauf bearbeiten" **für diesen Kalender** (anderes Konto): Der Filter bietet dort kein „auch ohne
   Ablauf“ an, die Termine ohne Ablauf erscheinen nicht. Ein Termin mit Ablauf, dessen **Admin** das Konto ist, lässt
   sich trotzdem bearbeiten (#635).
7. **Filter** → beim Kalender das Häkchen selbst wegnehmen: Alle Termine des Kalenders verschwinden, auch die mit
   Ablauf; am Knopf steht „1“. App neu laden: Die Wahl ist noch da (auf dem Gerät gemerkt).
8. **Mehr**: Die Zeile „Termine ohne Ablauf“ gibt es in der Verwaltung nicht mehr.

<details><summary>Technisches</summary>

- **Priorität:** normal
- **Betrifft:** `shared/ct/ablaufAnlegen.ts`, `shared/ct/ablaufRecht.ts`, `client/src/pages/Agenda.tsx`, `client/src/components/AblaufAnlegenFenster.tsx`, `ui/ablauf/AblaufAnlegenFenster.tsx`, `client/src/utils/kalenderFilter.ts`, `client/src/hooks/useTerminFilter.ts`, `ui/bedienung/FilterKnopf.tsx`, `shared/ct/ablaufVorschlaege.ts`, `server/src/controllers/setlistController.ts`
- **Automatisiert:** teilweise – `shared/ct/ablaufAnlegen.test.ts`, `client/src/components/AblaufAnlegenFenster.test.tsx`, `client/src/pages/Agenda.ohneAblauf.test.tsx` (auch: Recht je Termin, #635; Filter), `client/src/utils/kalenderFilter.test.ts`, `server/src/controllers/setlistController.ohneAblauf.test.ts`, `shared/ct/ablaufVorschlaege.test.ts`, `e2e/ablauf-anlegen.spec.ts`; gegen echtes ChurchTools nur von Hand
- **Historie:** 13.10.2026 (Alwin). Gemessen: `PUT /events/{id}/agenda` mit `template_id` / `event_id` / ohne legt an; auf einen vorhandenen Ablauf antwortet es 200 und ändert nichts – die App liest trotzdem vorher nach. 05.11.2026: Kalender je Person im Filter der Terminliste statt Verwaltung, Suchwort weg (Alwin: Frauentreff).

</details>

### TF-ABLAUF-12 · Der Ablauf sieht aus wie in der ChurchTools-App

**Das brauchst du:** Einen Test-Termin mit Vorlauf (z. B. Soundcheck), einer Überschrift, einem Lied mit Arrangement
(Tonart, Tempo) und Zuständigen – mindestens drei Personen bei einem Punkt, eine davon mit Foto in ChurchTools.

**Das muss passieren:** Musik-App und Dienstplaner zeigen den Ablauf gleich: eine Liste mit feinen Linien (keine
Karten), links die Uhrzeit fett und die Dauer klein darunter, der Titel fett, die Zuständigen grau darunter (offene
Dienste rot mit „?“), rechts runde Kreise – im Dienstplaner Foto oder Kürzel, in der Musik-App nur Kürzel (seit
02.11.2026), ab drei Personen „+N“. Die Kreise antippen → direkt am Knopf klappt „Zuständig · …“ auf, mit allen Personen und ihrem Dienst,
offene Dienste rot „offen“. Überschriften und „Beginn“ stehen
als graue Balken, das Lied mit blauem Streifen und einer Lied-Karte (Liedname, Tonart · Tempo · Autor).

1. Termin in der Musik-App öffnen: Ansicht wie beschrieben; das Lied antippen öffnet das Blatt, die Kreise daneben
   klappen die Zuständigen am Knopf auf (nicht das Blatt) – unten am Bildschirm nach oben; Scrollen, Escape oder ein
   Tipp daneben schließen. Beim Drüberfahren färben sich nur die Kreise blau. Kein leerer Kreis, auch bei Personen mit
   Foto.
2. Denselben Termin im Dienstplaner öffnen: dieselbe Liste; die Lied-Karte nennt auch den Autor.
3. **Bearbeiten**: Griff links, Uhrzeit und Dauer wie in der Ansicht, rechts nur der Stift (keine Kreise); ein
   weggelassener Punkt bleibt blass.
4. Dunkelmodus in ChurchTools einschalten: alles lesbar, Kreise und Balken passen sich an.

<details><summary>Technisches</summary>

- **Priorität:** normal
- **Betrifft:** `ui/ablauf/AblaufListe.tsx`, `ui/ablauf/AblaufTeile.tsx`, `ui/ablauf/ZustaendigeListe.tsx`, `ui/ablauf/AgendaSortableRow.tsx`, `shared/ct/agendaFormat.ts`, `shared/ct/ablaufZeile.ts`, `dienstplaner/src/TerminAnsicht.tsx`, `dienstplaner/src/ladeBeiwerk.ts`, `client/src/components/AgendaFullView.tsx`
- **Automatisiert:** ja – `ui/ablauf/AblaufListe.test.tsx` (Dauer, Lied-Karte, Kreise, Foto nur mit `fotos`, Ersatz bei kaputtem Foto, Zuständige am Knopf an `body` samt Aufklappen nach oben und Schließen beim Scrollen, Lied und Kreise getrennt, Balken), `ui/ablauf/useAblaufBearbeiten.test.tsx` (blass im Bearbeiten), `shared/ct/agendaFormat.test.ts` (Kürzel, Foto, Dienst), `dienstplaner/src/TerminAnsicht.test.tsx` (Autor per Sammelabfrage, Fehlschlag, Foto in ChurchTools), `client/src/components/AgendaFullView.test.tsx` (nur Kürzel auf dem eigenen Server); von Hand bleibt der Blick auf echte Fotos
- **Historie:** #710 (23.10.2026, Entwurf `e6-optik-entwurf.html`, gemessen E6-O0)

</details>

### TF-ABLAUF-13 · „Ablauf zeigen“ im Vollbild

**Das brauchst du:** Einen Test-Termin mit Ablauf (Vorlauf, Überschrift, ein Punkt mit Info für Technik), einen Rechner
und ein Handy.

**Das muss passieren:** Der Ablauf steht ruhig und groß da – Uhr, Titel, alle Punkte mit Zeit, Dauer, Zuständigen und
den Infos der unter „Spalten“ gewählten Gruppen. Nichts lässt sich verstellen, der Bildschirm bleibt an.

1. Dienstplaner → Termin öffnen → oben **„Ablauf zeigen“** → die Anzeige deckt alles ab: links die Uhr (läuft mit) und
   der heutige Tag, rechts Titel und „Beginn … · Ende …“ (Ende = wann der letzte Punkt vorbei ist); ein anderer Tag als
   heute steht vorne dabei.
2. Ohne Haken unter „Spalten“: keine Infos. Mit **Technik** angehakt: „Technik: …“ unter dem Punkt.
3. Weggelassene Punkte fehlen, „Beginn“ steht nach dem Vorlauf, Überschriften als Band.
4. Fenster verkleinern → die Schrift wird kleiner, bis alles passt; ganz klein wird gescrollt statt weiter verkleinert.
5. **Vollbild** (oder Taste F) → Vollbild; **Esc** beendet es. Noch einmal **Esc** oder **Schließen** → zurück im Termin.
6. Am iPhone: kein „Vollbild“-Knopf, nur „Schließen“; Handy drehen → die Anzeige bleibt offen und passt sich an. Der
   Bildschirm geht nicht aus.
7. Dunkelmodus in ChurchTools: die Anzeige ist dunkel. **Bearbeiten**: der Knopf „Ablauf zeigen“ ist weg.

<details><summary>Technisches</summary>

- **Priorität:** normal
- **Betrifft:** `dienstplaner/src/AblaufAnzeige.tsx`, `dienstplaner/src/TerminAblauf.tsx`, `dienstplaner/src/TerminAnsicht.tsx`, `ui/bedienung/useVollbild.ts`, `ui/bedienung/useWakeLock.ts`, `ui/erweiterung/ErweiterungsSeite.tsx`, `shared/ct/datum.ts`
- **Automatisiert:** ja – `dienstplaner/src/AblaufAnzeige.test.tsx` (Inhalt, Infos, Einpassen, Vollbild, Esc, Bildschirm wach), `dienstplaner/src/TerminAnsicht.test.tsx` (Knopf, nicht beim Bearbeiten), `ui/erweiterung/ErweiterungsRahmen.test.tsx` (bleibt beim Drehen offen); von Hand bleibt der Blick auf echten Geräten
- **Historie:** E6b-1 (30.10.2026, Entwurf `e6b-anzeige.html` abgenommen)

</details>

### TF-ABLAUF-14 · „Live“ folgt der Live-Agenda von ChurchTools

**Das brauchst du:** Einen Test-Termin **heute** mit abgeschlossenem Ablauf (ein Punkt mit Info für Technik, ein Punkt
weggelassen), daneben in ChurchTools die „Live-Agenda“ desselben Termins (Ablaufpläne → „Live-Agenda ansehen“) mit
einer Person, die dort steuern darf.

**Das muss passieren:** „Live“ im Dienstplaner zeigt immer denselben Stand wie die Live-Agenda von ChurchTools – Jetzt,
Dann, Restzeit, Abweichung – und folgt jedem Weiterschalten nach spätestens 2,5 Sekunden.

1. Dienstplaner → Termin öffnen → oben **„Live“** (Uhr-Symbol). Noch nicht gestartet: „Jetzt · nach Plan“ zeigt den
   Punkt, der laut Uhr dran ist, mit „Noch nicht gestartet – „Jetzt“ folgt der Uhr.“
2. In ChurchTools **›** → nach spätestens 2,5 s steht derselbe Punkt unter „Jetzt“, der Kreis zählt die Restzeit herunter,
   in der Liste ist er hervorgehoben, die Punkte davor haben einen Haken. Im Kopf leuchtet „Live“ rot.
3. Die Notiz des Punkts steht unter „Jetzt“ wie in ChurchTools. Unter „Spalten“ Technik angehakt → „Technik: …“.
   Am Handy steht „Musik-App“ im Kopf des Ablaufs nur als Symbol.
4. In ChurchTools **+** → die Restzeit springt eine Minute höher; **−** eine niedriger.
5. Zeit ablaufen lassen → der Kreis wird rot, „+0:…“ und „über der Zeit“.
6. „Gesamt“ zeigt die Abweichung wie ChurchTools, aber in Worten („2 Min. später“ statt „−2 Minuten“). Ausnahme: Steht
   vor dem Punkt ein weggelassener, rechnet ChurchTools dessen Dauer mit – der Dienstplaner nimmt die Zeit aus dem Ablauf.
7. Der weggelassene Punkt steht durchgestrichen in der Liste.
8. **Schließen** → zurück im Termin: der Knopf „Live“ hat jetzt einen roten Punkt. Ein anderer Tag: Knopf ohne Punkt.
9. WLAN kurz aus → „Keine Verbindung – Stand von … Uhr. Wird wieder versucht.“, Jetzt bleibt stehen; WLAN an → weiter.

<details><summary>Technisches</summary>

- **Priorität:** normal
- **Betrifft:** `dienstplaner/src/LiveAnsicht.tsx`, `dienstplaner/src/useLive.ts`, `dienstplaner/src/TerminAblauf.tsx`, `dienstplaner/src/TerminAnsicht.tsx`, `shared/ct/liveAgenda.ts`
- **Automatisiert:** ja – `dienstplaner/src/LiveAnsicht.test.tsx` (Lage, Takt, Uhrabgleich, Fehler, Sichtbarkeit, mit Fake-Timern), `dienstplaner/src/TerminAnsicht.test.tsx` (Knopf, roter Punkt nur am Tag), `shared/ct/liveAgenda.test.ts` (Kern); von Hand bleibt der Vergleich mit der echten Live-Agenda
- **Historie:** E6b-2 L2 (02.11.2026, Entwurf `e6b-2-live.html` Variante A)

</details>

### TF-ABLAUF-15 · „Live“ steuern

**Das brauchst du:** Einen Test-Termin mit Ablauf, an dem du in einem Dienst mit „Live-Agenda steuern“ (Stammdaten →
Dienste) eingeteilt bist; daneben die „Live-Agenda“ von ChurchTools desselben Termins. Eine zweite Person ohne dieses
Recht.

**Das muss passieren:** Wer steuern darf, schaltet im Dienstplaner – ChurchTools und alle anderen folgen. Wer nicht
darf, sieht keine Knöpfe.

1. Dienstplaner → Termin → **„Live“**. Noch nicht gestartet: nur **„Starten“**. Antippen → der erste Punkt steht sofort
   unter „Jetzt“; die Live-Agenda von ChurchTools zeigt ihn nach spätestens 2,5 s.
2. **Weiter** → nächster Punkt; Lieder ohne Dauer und weggelassene Punkte werden übersprungen. **Zurück** → voriger.
3. **+ 1 Min** / **− 1 Min** → die Restzeit ändert sich um eine Minute, der Punkt bleibt.
4. In ChurchTools **›** → der Dienstplaner folgt. Beide Seiten können abwechselnd schalten.
5. Nach dem letzten Punkt: „Ablauf vorbei“, **Weiter** gesperrt, **Zurück** geht.
6. Ablauf in ChurchTools wieder öffnen, einen Punkt **vor** dem aktuellen löschen, dann im Dienstplaner **+ 1 Min** →
   derselbe Punkt bleibt „Jetzt“ (die Stelle wird nachgezogen).
7. Mit der zweiten Person: „Live“ zeigt keine Knöpfe.
8. Am Handy: vier Symbolknöpfe ‹ › − + unter dem Kreis.

<details><summary>Technisches</summary>

- **Priorität:** normal
- **Betrifft:** `dienstplaner/src/LiveAnsicht.tsx`, `dienstplaner/src/useLive.ts`, `dienstplaner/src/TerminAblauf.tsx`, `shared/dienstplan/plan.ts`, `shared/ct/liveAgenda.ts`
- **Automatisiert:** ja – `dienstplaner/src/LiveAnsicht.test.tsx` (Starten, Weiter/Zurück, ±1, Ende, Nachziehen, Fehler, Sperren, alte Abfrage verworfen), `dienstplaner/src/TerminAnsicht.test.tsx` (Recht kommt an), `shared/dienstplan/plan.test.ts` (Recht je Termin); von Hand bleibt das Schalten gegen die echte Live-Agenda
- **Historie:** E6b-2 L3 (02.11.2026)

</details>

### TF-ABLAUF-16 · „Weitere Infos“ am Termin

**Das brauchst du:** Einen Test-Termin, an dem in ChurchTools unter „i“ (Weitere Infos) zwei Zeilen stehen; eine
Person, die den Termin ändern darf („Events bearbeiten“ für den Kalender oder Admin des Termins), und eine ohne.

**Das muss passieren:** Alle sehen die Infos wie in ChurchTools; wer darf, ändert sie im Dienstplaner – ChurchTools
zeigt danach denselben Text, und eine Absage bleibt bestehen.

1. Dienstplaner → Termin öffnen → unter Datum und Uhrzeit steht der Anfang der Infos in einer Zeile; oben ein ⓘ.
2. ⓘ (oder die Zeile) → Fenster „Weitere Infos“ mit dem ganzen Text samt Zeilen. Ohne Recht: kein „Bearbeiten“.
3. Mit Recht: **Bearbeiten** → Textfeld mit Zähler „… / 4000“; ändern → **Speichern** → das Fenster zeigt den neuen Text,
   die Zeile auch. In ChurchTools (Dienstplan → „i“) steht derselbe Text.
4. Einen **abgesagten** Termin: Infos ändern und speichern → in ChurchTools ist er weiterhin abgesagt.
5. In ChurchTools die Infos ändern, während das Fenster im Dienstplaner im Bearbeiten offen ist → **Speichern** →
   „Die Infos wurden eben woanders geändert“ mit dem Text aus ChurchTools; **Ihre übernehmen** bzw. **Meine
   speichern** tun, was sie sagen.
6. Mehr als 4000 Zeichen → Zähler rot, „Speichern“ gesperrt. Alles leeren und speichern → in ChurchTools leer.
7. Ein Termin ohne Infos, Person ohne Recht: kein ⓘ, keine Zeile. Mit Recht: ⓘ öffnet gleich das Textfeld, „Abbrechen“
   schließt das Fenster.

<details><summary>Technisches</summary>

- **Priorität:** normal
- **Betrifft:** `dienstplaner/src/InfosFenster.tsx`, `dienstplaner/src/TerminAnsicht.tsx`, `dienstplaner/src/ladeTerminInfos.ts`, `shared/ct/terminInfos.ts`, `shared/ct/dienstRechte.ts`, `shared/dienstplan/plan.ts`
- **Automatisiert:** ja – `shared/ct/terminInfos.test.ts` (Speichern mit `isCanceled`, leer, 4000, Konflikt, nachlesen, Recht), `dienstplaner/src/TerminAnsicht.test.tsx` (Zeile, ⓘ, Bearbeiten, Konflikt, „nicht übernommen“), `shared/ct/dienstRechte.test.ts`; von Hand bleibt der Vergleich mit ChurchTools
- **Historie:** T1 (02.11.2026, Entwurf `termin-einstellungen.html` Variante B; gemessen `messung-termin-einstellungen.md`)

</details>

### TF-ABLAUF-17 · „Infos & Dateien“ in der Matrix

**Das brauchst du:** Zwei Test-Termine im gezeigten Zeitraum, einer mit Infos (das „i“ in ChurchTools), einer ohne; eine
Person, die die Termine ändern darf, und eine ohne.

**Das muss passieren:** In „Planen“ steht über dem Ablauf die Gruppe „Infos & Dateien“ – je Termin oben die Knöpfe ⓘ
und Büroklammer wie in ChurchTools, darunter die ersten zwei Zeilen der Infos zum Lesen. Wer darf, schreibt sie über das
ⓘ direkt dort.

1. Planen → Matrix → oben die Gruppe **„Infos & Dateien“**, darunter „Ablauf“. Beim Termin mit Infos: ⓘ hellblau
   hinterlegt, darunter die ersten zwei Zeilen grau hinterlegt (nur zum Lesen, kein Knopf). Beim anderen nur ⓘ und
   Büroklammer (nur mit Recht; ohne Recht „–“).
2. **ⓘ** → dasselbe Fenster wie in der Termin-Ansicht; ohne Infos gleich das Textfeld → schreiben → Speichern → die
   Zelle zeigt den Text sofort; in ChurchTools steht er auch; ein abgesagter Termin bleibt abgesagt.
3. Gruppe zuklappen, Seite neu laden → bleibt zugeklappt.
4. Am Handy: beim gewählten Termin die Gruppe „Infos & Dateien“ über dem Ablauf.

<details><summary>Technisches</summary>

- **Priorität:** normal
- **Betrifft:** `dienstplaner/src/MatrixInfos.tsx`, `dienstplaner/src/useMatrixInfos.ts`, `dienstplaner/src/Planen.tsx`, `dienstplaner/src/planenAnsicht.ts`, `dienstplaner/src/InfosFenster.tsx`
- **Automatisiert:** ja – `dienstplaner/src/MatrixInfos.test.tsx` (Zellen, Recht, Speichern, Plan geht vor, Zuklappen gemerkt, Handy), `dienstplaner/src/MatrixAblauf.test.tsx` (Reihenfolge); von Hand bleibt der Blick in ChurchTools
- **Historie:** T1b (02.11.2026, Entwurf `matrix-infos.html` Variante 2)

</details>

### TF-ABLAUF-18 · Dateien am Termin ansehen

**Das brauchst du:** Einen Test-Termin, an dem in ChurchTools über die Büroklammer eine PDF-Datei und ein Link hängen,
und einen Termin ohne Dateien.

**Das muss passieren:** Wer den Termin sieht, sieht seine Dateien wie in ChurchTools – mit Zahl an der Büroklammer, in
der Matrix unter den Infos – und öffnet sie mit einem Tipp.

1. Dienstplaner → Termin mit Dateien → oben neben dem ⓘ die **Büroklammer mit „2“**. Beim Termin ohne Dateien keine.
2. Büroklammer → Fenster **„Dateien“**: die PDF mit „PDF · Größe“, der Link mit „Link · Adresse“. Antippen öffnet sie in
   einem neuen Tab (die PDF aus ChurchTools, ohne neue Anmeldung).
3. Planen → Matrix → Gruppe „Infos & Dateien“: unter den Infos **„Anhänge:“** mit je einer Zeile je Datei (höchstens drei,
   dann „+ N weitere“). Ohne Recht öffnet ein Tipp die Datei direkt; „+ N weitere“ öffnet das Fenster mit allen.
4. In ChurchTools eine dritte Datei anhängen, im Dienstplaner das Fenster noch einmal öffnen → sie steht da, und nach dem
   Schließen zeigt die Büroklammer „3“ bzw. die Matrix drei Zeilen.

<details><summary>Technisches</summary>

- **Priorität:** normal
- **Betrifft:** `shared/ct/terminDateien.ts`, `dienstplaner/src/DateienFenster.tsx`, `dienstplaner/src/TerminAnsicht.tsx`, `dienstplaner/src/MatrixInfos.tsx`, `dienstplaner/src/useMatrixInfos.ts`, `ui/dateien/DateiZeile.tsx`, `ui/bedienung/KopfKnopf.tsx`
- **Automatisiert:** ja – `shared/ct/terminDateien.test.ts` (gemessene Antworten, sichere Adressen), `dienstplaner/src/TerminAnsicht.test.tsx` (Büroklammer, Fenster, frische Liste, Fehler, fremde Adressen), `dienstplaner/src/MatrixInfos.test.tsx` (Zeilen, „+ N weitere“, frische Liste bis der Plan Neues bringt); von Hand bleibt das Öffnen aus ChurchTools
- **Historie:** T2a (02.11.2026, Entwurf `termin-einstellungen.html` Variante B, Matrix `matrix-infos.html` Variante 2)

</details>

### TF-ABLAUF-19 · Dateien am Termin hochladen, verlinken, umbenennen, löschen

**Das brauchst du:** Einen Test-Termin, den du ändern darfst („Events bearbeiten“ für den Kalender oder Admin des
Termins), eine PDF, eine Datei über 128 MB (z. B. ein Video) und eine größere Datei (20–100 MB) für den Fortschritt;
eine Person ohne dieses Recht.

**Das muss passieren:** Wer den Termin ändern darf, hängt Dateien und Links an, benennt sie um und löscht sie – wie mit
der Büroklammer in ChurchTools. ChurchTools zeigt danach dasselbe. Zu große Dateien gehen gar nicht erst hoch.

1. Termin ohne Dateien → oben die **Büroklammer ohne Zahl** → gleich **„Anhang hinzufügen“**. Ohne Recht: keine Büroklammer.
2. **Dateien hochladen:** die PDF und die über 128 MB wählen (oder hineinziehen) → die große steht rot da („zu groß …
   wird nicht hochgeladen“), der Knopf sagt „1 Datei hochladen“. Hochladen → die PDF erscheint in der Liste, die große
   bleibt rot stehen; ✕ nimmt sie weg.
3. Die 20–100-MB-Datei hochladen → ein **Balken mit %** läuft bis 100, danach steht sie mit Größe in der Liste.
4. **Link anhängen:** Name und Adresse ohne `https://` → Hinweis, Knopf grau; mit `https://…` → der Link steht in der
   Liste und öffnet sich in einem neuen Tab.
5. Die PDF in der Liste antippen → ihr **kleines Fenster** (wie in ChurchTools): „PDF · Größe“, „Angehängt am … von …“,
   **Öffnen** (neuer Tab), **Umbenennen**, **Löschen**. Umbenennen → die Endung „.pdf“ steht fest daneben; neuer Name →
   Umbenennen → die Liste zeigt ihn. „‹“ im Umbenennen führt zurück zum kleinen Fenster.
6. Den Link antippen → **Löschen** → Rückfrage „… löschen? Das lässt sich nicht rückgängig machen – nur durch erneutes
   Anhängen“ → Löschen → weg.
7. In ChurchTools (Dienstplan → Büroklammer bzw. Termin → Dateien) stehen dieselben Dateien mit denselben Namen; es ging
   **keine Mail** raus.
8. Matrix → „Infos & Dateien“: die **Büroklammer** oben in der Zelle (nur mit Recht) öffnet gleich „Anhang hinzufügen“;
   „‹“ führt zu den Dateien. Eine Datei unter „Anhänge:“ antippen → ihr kleines Fenster; „‹“ führt zu allen Dateien.
9. Aus der Matrix einen Termin öffnen, dort eine Datei anhängen oder die Infos ändern, mit **„‹ Planen“** zurück → die
   Matrix zeigt sofort den neuen Stand (ohne die Seite neu zu laden).

<details><summary>Technisches</summary>

- **Priorität:** normal
- **Betrifft:** `shared/ct/terminDateien.ts`, `shared/dateien/index.ts`, `ui/ct/verbindung.ts`, `dienstplaner/src/ladeTerminDateien.ts`, `dienstplaner/src/DateienFenster.tsx`, `dienstplaner/src/AnhangHinzufuegen.tsx`, `dienstplaner/src/TerminAnsicht.tsx`, `dienstplaner/src/MatrixInfos.tsx`, `dienstplaner/src/App.tsx`
- **Automatisiert:** ja – `shared/ct/terminDateien.test.ts` (Kern: 128 MiB, nachlesen, Zeitüberschreitung mit angekommener Datei, 404 beim Löschen), `ui/ct/verbindung.test.ts` (Hochladen mit Fortschritt, Stillstand-Zeitgrenze mit Fake-Timern, 403/413/429/Netz), `dienstplaner/src/DateienFenster.test.tsx` (ganze Kette bis ChurchTools), `TerminAnsicht.test.tsx`, `MatrixInfos.test.tsx`, `App.termin.test.tsx` (leise neu nach Änderungen); von Hand bleiben echte große Dateien, Ziehen & Ablegen und der Blick in ChurchTools
- **Historie:** T2b (02.11.2026, Alwin: Fortschritt in %; 03.11.2026 nach der Test-Instanz: Zelle und Datei-Fenster wie in
  ChurchTools, Entwurf `matrix-infos-bearbeiten.html` Variante D1 – statt Stift und Papierkorb)

</details>

### TF-ABLAUF-20 · Anfragen zusagen und absagen

**Das brauchst du:** Ein Konto **ohne** Admin-Recht mit zwei offenen Anfragen in der Test-Instanz (z. B. Spike,
angefragt über die Matrix); einen Dienst, bei dem in ChurchTools „Absagen erlaubt“ aus ist; die ChurchTools-App oder
die Dienstplan-Liste von ChurchTools zum Gegenprüfen.

**Das muss passieren:** Wer angefragt ist, sagt im Dienstplaner zu oder ab – ChurchTools zeigt danach dasselbe wie nach
einer Antwort in der App, und für zehn Minuten lässt sich die Antwort zurücknehmen.

1. Start → „Für dich offen“: an jeder Anfrage **Zusagen** und **Absagen**, oben **„Alle zusagen“** (ab zwei offenen).
2. **Zusagen** → die Zeile zeigt „zugesagt“ mit **Rückgängig**; die Plakette oben (Als Nächstes) sagt „zugesagt“. In
   ChurchTools ist der Dienst zugesagt. **Rückgängig** → wieder offen.
3. **Absagen** → Fenster „Anfrage absagen“ mit „Grund (optional)“ → Grund eintragen → Absagen → „abgesagt“ mit
   Rückgängig – **keine** Meldung „Den Termin oder Platz gibt es nicht mehr.“ In ChurchTools (als Planer) ist der
   Platz frei, der Grund steht daran. **Rückgängig** → wieder offen.
4. Beim Dienst ohne „Absagen erlaubt“: statt „Absagen“ der Hinweis „Absagen geht hier nicht – bitte sprich mit dem
   Planer.“
5. Dienste → Meine: am Termin „**Gesang zusagen**“ / „Absagen“; derselbe Stand wie auf der Startseite.
6. Nach zehn Minuten ist „Rückgängig“ weg; eine Zusage steht dann unter „Deine nächsten Dienste“ bzw. „Als Nächstes“.
7. Ein Planer zieht eine Anfrage zurück, bevor du antwortest → Antworten zeigt unten „Die Anfrage hat sich
   inzwischen geändert …“, nichts wird geschrieben, die Anfrage verschwindet aus der Liste.

<details><summary>Technisches</summary>

- **Priorität:** hoch
- **Betrifft:** `shared/dienstplan/antworten.ts`, `shared/dienstplan/einteilen.ts`, `shared/dienstplan/start.ts`, `shared/dienstplan/termine.ts`, `shared/ct/dienste.ts`, `dienstplaner/src/useAntworten.ts`, `dienstplaner/src/AntwortKnoepfe.tsx`, `dienstplaner/src/Startseite.tsx`, `dienstplaner/src/Termine.tsx`, `dienstplaner/src/App.tsx`
- **Automatisiert:** ja – `shared/dienstplan/antworten.test.ts` (Kern gegen den Nachbau wie gemessen: neue IDs, Grund, undo mit der richtigen ID, zu spät, Konflikt, ohne Recht auf den Dienst – der freie Platz ist dann unsichtbar), `dienstplaner/src/Antworten.test.tsx` (ganze Kette bis ChurchTools, zehn Minuten mit Fake-Timern), `shared/dienstplan/start.test.ts`; von Hand bleiben die Mitteilungen und der Blick in ChurchTools
- **Historie:** E7-1 (03.11.2026, Entwurf `e7-anfragen.html` Variante A)

</details>

### TF-ABLAUF-21 · Dienste tauschen

**Das brauchst du:** Zwei Konten ohne Admin-Recht (z. B. Spike und eine zweite Person) mit **demselben Dienst** an zwei
verschiedenen kommenden Terminen, in der Test-Instanz; zum Gegenprüfen die Dienstplan-Liste von ChurchTools.

**Das muss passieren:** Wer einen Dienst nicht wahrnehmen kann, bietet ihn jemandem mit demselben Dienst an einem
anderen Termin zum Tausch an (auch einem früheren). Getauscht wird erst, wenn die andere Person annimmt – dann sind beide zugesagt.

1. Als A: Start → „Deine nächsten Dienste“ (oder Dienste → Meine): am Dienst **„Tauschen“**. Bei einer offenen Anfrage
   steht es neben „Zusagen“/„Absagen“.
2. **Tauschen** → Fenster „Dienst tauschen“ mit allen, die denselben Dienst an einem anderen Termin haben (Name, Termin, Tag) – auch
   an früheren Terminen.
   „Tausch anfragen“ geht erst nach einer Wahl. B wählen → **Tausch anfragen** → am Dienst steht „**Tausch angefragt**
   bei B (Tag)“ mit „Zurückziehen“. Die Einteilungen in ChurchTools sind unverändert.
3. Als B: Start → „Für dich offen“: „**Tausch-Anfrage · Dienst** – A möchte tauschen: Du bekämst … am … und gibst
   deinen am … ab.“ mit **Annehmen** und **Ablehnen**.
4. **Ablehnen** → die Zeile verschwindet. Als A: am Dienst „B hat den Tausch **abgelehnt**“ mit „Andere fragen“.
5. Als A erneut anfragen; als B **Annehmen** → „Getauscht – du hast jetzt … am …“. In ChurchTools stehen A und B
   vertauscht, beide zugesagt; die Listen laden neu.
6. Als A anfragen, dann **Zurückziehen** → wieder „Tauschen“; bei B ist nichts mehr offen.
7. Als A den Termin öffnen (Termin-Ansicht): In der Karte „Dienste“ steht unter dem eigenen Platz „Tauschen“ bzw. der
   Stand der Anfrage – an keinem anderen Dienst.
8. Ein Dienst, den sonst niemand an einem anderen Termin hat → das Fenster sagt „Gerade hat niemand sonst … – frag … oder sag ab.“

<details><summary>Technisches</summary>

- **Priorität:** hoch
- **Betrifft:** `shared/dienstplan/tausch.ts`, `dienstplaner/src/tauschPort.ts`, `dienstplaner/src/useTausch.ts`, `dienstplaner/src/TauschTeile.tsx`, `dienstplaner/src/Startseite.tsx`, `dienstplaner/src/Termine.tsx`, `dienstplaner/src/TerminAnsicht.tsx`, `dienstplaner/src/App.tsx`
- **Automatisiert:** ja – `shared/dienstplan/tausch.test.ts` (Kern gegen den Nachbau wie gemessen: frische ID, eine Anfrage je Dienst, Nachlesen nach jedem Schreiben, Annehmen erst mit Tausch belegt), `dienstplaner/src/Tausch.test.tsx` (Fenster, Anfragen, Zurückziehen, Annehmen, Ablehnen, Leer- und Fehlerfall), `Startseite.test.tsx`/`Termine.test.tsx`/`TerminAnsicht.test.tsx` (Einbindung); von Hand bleiben die Mitteilungen von ChurchTools und der Blick in die Dienstplan-Liste
- **Historie:** E7-3 (04.11.2026, Entwurf `e7-3-tausch.html`)

</details>

### TF-ABLAUF-22 · Termin als PDF teilen

**Das brauchst du:** Einen Termin mit Ablauf (mit Vorlauf, Abschnitten, einem Lied mit Tonart) und Diensten in
mindestens zwei Gruppen, einer davon frei und einer angefragt; Infos einer Gruppe an mindestens einem Eintrag.

**Das muss passieren:** Das Termin-Blatt zeigt Dienste und Ablauf übersichtlich im ChurchTools-Look; was aufs Blatt
kommt, lässt sich im Fenster wählen, das Gerät merkt es sich.

1. Termin öffnen → hinter dem Titel **„Teilen“** (am Handy rechts in der Titelzeile, nichts verdeckt).
2. **Teilen** → „Termin teilen“ mit drei Zeilen: **Dienste** (Gruppen · über dem Ablauf), **Ablauf** (Uhrzeit, Dauer,
   Zuständig · Lieder mit Tonart), **Infos** (Gruppen wie unter „Spalten“ – wie in der Ansicht); darunter
   „Fertig · N Seiten · Titel TT.MM.JJJJ.pdf“ und die Seiten als Vorschau.
3. Vorschau antippen → Seite groß. Das Blatt: oben Titel, Datum mit Beginn–Ende, Gemeinde und Stand; Dienste je
   Gruppe in Spalten (Dienst grau, Person fett, „frei“ rot, „angefragt“ grau); Ablauf mit dunklem **Beginn** und
   **Ende** (mit Dauer), Vorlauf grau, Abschnitte mit „ca. … Min“, Lied mit Tonart-Schild; nur Info-Spalten mit Text;
   ganze Teams nur als Dienst-Name.
4. **Dienste** antippen → Unterseite mit ‹; „Dienste aufs Blatt“ aus → zurück: „nicht auf dem Blatt“, die Vorschau
   ohne Dienste. Wieder an, eine Gruppe abwählen, **Unter dem Ablauf** → Vorschau entsprechend.
5. **Ablauf** → „Zuständig: Unter dem Eintrag“, Notiz und Tempo an → Vorschau entsprechend.
6. **Infos** → eine Gruppe dazu → Hauptseite ohne „wie in der Ansicht“; **Wieder wie in der Ansicht** stellt zurück.
7. **Querformat** → Vorschau quer. Fenster schließen, neu öffnen → die Wahl ist noch da.
8. **Herunterladen** → PDF mit Dateiname „Titel TT.MM.JJJJ.pdf“; **Teilen** → Teilen-Menü (am Rechner Download).
9. Termin ohne Ablauf → Zeile „Ablauf“: „Dieser Termin hat keinen Ablauf.“, nicht antippbar; das Blatt nur mit Diensten.

<details><summary>Technisches</summary>

- **Priorität:** normal
- **Betrifft:** `shared/ct/terminBlatt.ts`, `ui/teilen/terminBlattPdf.ts`, `ui/teilen/TerminTeilenFenster.tsx`, `ui/teilen/terminBlattWahl.ts`, `ui/teilen/PdfSeitenVorschau.tsx`, `ui/teilen/pdfSeiten.ts`, `dienstplaner/src/TerminAnsicht.tsx`, `shared/dienstplan/terminBlattDienste.ts`, `dienstplaner/src/TerminAblauf.tsx`
- **Automatisiert:** ja – `shared/ct/terminBlatt.test.ts` (Beginn/Ende, Abschnittsdauer, Spalten ohne leere, Teams kurz, Einstellungen), `ui/teilen/terminBlattPdf.test.ts` (Kopf/Fuß je Seite, Zeit bricht nie um, Ende nie allein, quer), `ui/teilen/TerminTeilenFenster.test.tsx` (Hauptseite, Unterseiten, gemerkte Wahl), `dienstplaner/src/TerminAnsicht.test.tsx` (Knopf, Blatt aus echten Plan-Daten); von Hand bleiben Aussehen des PDF, Vorschau und Teilen-Menü am Gerät
- **Historie:** E8-1 (05.11.2026, Entwurf `e8-teilen.html` Version 5)

</details>

### TF-ABLAUF-23 · Plan teilen: ganzer Plan, eine Gruppe, „Wir suchen noch …“

**Das brauchst du:** „Planen“ mit mehreren Terminen und mindestens zwei Dienstgruppen, darunter freie und angefragte
Plätze; als Gegenprobe eine Gruppe im Filter ausgeblendet.

**Das muss passieren:** Aus „Planen“ lässt sich teilen, was dort gerade zu sehen ist – als ganzer Plan, je Gruppe oder
als Liste der offenen Dienste ohne Namen.

1. Planen → in der Werkzeugleiste **Teilen** (am Handy nur das Symbol) → „Plan teilen“ mit **Ganzer Plan**, **Nur
   <Gruppe>** je eingeblendeter Gruppe und **Wir suchen noch …**; darunter Zeitraum und Zahl der Termine – dieselben wie
   im Zeitraum-Knopf.
2. **Ganzer Plan** → Vorschau: je Gruppe ein graues Band und eine Tabelle (Termin, dann die Dienste); Namen, angefragte
   mit „(angefragt)“, freie Plätze rot „frei“; keine Spalte für einen Dienst, der an keinem Termin vorgesehen ist.
3. **Nur <Gruppe>** → Titel „Dienstplan <Gruppe>“, nur diese Tabelle. Fenster schließen und neu öffnen → die Wahl ist
   noch da. Die Gruppe im Filter ausblenden, neu öffnen → „Ganzer Plan“ ist gewählt.
4. **Wir suchen noch …** → nur Termine mit freien Plätzen, „Gesucht: Ton, Gesang ×2“, keine Namen; abgesagte Termine
   fehlen; ist alles besetzt, steht das da.
5. Viele Termine → mehrere Seiten, auf jeder Kopf, Tabellenkopf und „Seite x von y“; ab sechs Spalten quer.
6. **Herunterladen** → „Dienstplan <Gruppe> TT.MM.-TT.MM.JJJJ.pdf“; **Teilen** → Teilen-Menü.

<details><summary>Technisches</summary>

- **Priorität:** normal
- **Betrifft:** `shared/dienstplan/planBlatt.ts`, `ui/teilen/planBlattPdf.ts`, `ui/teilen/pdfSatz.ts`, `ui/teilen/pdfFenster.tsx`, `ui/teilen/pdfFensterZustand.ts`, `dienstplaner/src/PlanTeilenFenster.tsx`, `dienstplaner/src/Planen.tsx`
- **Automatisiert:** ja – `shared/dienstplan/planBlatt.test.ts` (aus `planAus`: Abschnitte, Namen/angefragt/frei, eine Gruppe, „Wir suchen noch“ ohne Namen und ohne Abgesagte, keine leeren Spalten, quer), `ui/teilen/planBlattPdf.test.ts` (Kopf/Fuß je Seite, Tabellenkopf nach Umbruch, Spaltenbreiten), `dienstplaner/src/Planen.teilen.test.tsx` (Knopf, Wahl, gemerkt, ausgeblendete Gruppe, verborgene Namen); von Hand bleiben Aussehen und Teilen-Menü am Gerät
- **Historie:** E8-2 (05.11.2026, Entwurf `e8-teilen.html`)

</details>

### TF-ABLAUF-24 · Meine Dienste teilen

**Das brauchst du:** Ein Konto mit mehreren kommenden Diensten – einer zugesagt, einer angefragt, einer davon weiter
weg als die geladenen Wochen.

**Das muss passieren:** Die eigenen kommenden Dienste kommen als PDF, z. B. für den Familienkalender.

1. Dienste → **Meine**: neben „Meine | Alle“ steht **Teilen** (bei „Alle“ nicht). Am Handy stehen Filter und Teilen
   nur als Symbol in derselben Zeile wie „Dienste | Meine | Alle“.
2. **Teilen** → „Meine Dienste teilen“, kurz „Deine Dienste werden geladen …“, dann „Fertig · 1 Seite · Meine Dienste
   <Name>.pdf“ und die Vorschau.
3. Das Blatt: Kopf „Meine Dienste“, darunter Name und Zeitraum; Tabelle Datum (mit Uhrzeit), Termin, Dienst, Stand –
   „zugesagt“ bzw. grau „angefragt“; nach Datum sortiert, auch Dienste nach den geladenen Wochen; abgesagte fehlen.
4. Ohne kommende Dienste → „Du hast keine kommenden Dienste.“
5. **Herunterladen** / **Teilen** wie bei den anderen Blättern.

<details><summary>Technisches</summary>

- **Priorität:** normal
- **Betrifft:** `shared/dienstplan/meineBlatt.ts`, `dienstplaner/src/MeineTeilenFenster.tsx`, `dienstplaner/src/Termine.tsx`, `dienstplaner/src/App.tsx`, `ui/ct/ich.ts`, `ui/teilen/planBlattPdf.ts`, `ui/bedienung/FilterKnopf.tsx`
- **Automatisiert:** ja – `shared/dienstplan/meineBlatt.test.ts` (aus `einteilungenAus`: Sortierung, Ortszeit, zugesagt/angefragt, leer), `dienstplaner/src/MeineTeilen.test.tsx` (Knopf nur bei „Meine“, frisch gelesen, Fehler mit „Erneut versuchen“), `ui/ct/ich.test.ts` und `dienstplaner/src/start.test.ts` (Nachname), `ui/bedienung/FilterKnopf.test.tsx` + `ui/bedienung/leistenKnoepfe.test.ts` (Filter am Handy nur Symbol); von Hand bleiben Aussehen und Teilen-Menü
- **Historie:** E8-3 (05.11.2026, Entwurf `e8-teilen.html`)

</details>

### TF-ABLAUF-25 · Planen: Monat anklicken, ＋ im Zeitraum, „Wer wie oft?“ mit eigenem Zeitraum, Scroll-Leiste

**Das brauchst du:** Planen am Rechner mit Terminen in mehreren Monaten, vergangene mit Einteilungen; eine Maus ohne
seitliches Rad (oder das Trackpad nicht benutzen).

**Das muss passieren:** Der Zeitraum lässt sich direkt per Monat wählen, um einzelne Termine erweitern, und „Wer wie
oft?“ hat einen eigenen Zeitraum für die Vergangenheit. Dass die Matrix seitlich weitergeht, sieht man an der Leiste.

1. Zeitraum-Knopf → Menü: **Ab heute**, darunter **Monat** mit Jahr ‹ › und zwölf Monatsfeldern (Punkt = laufender
   Monat), darunter **Eigener Zeitraum**. **Dez** → das Menü schließt, die Matrix zeigt alle Dezember-Termine. Mit ‹ beim
   Jahr gehen auch vergangene Monate.
2. Neben dem Knopf **＋** rechts → ein einzelner Termin nach dem Dezember kommt dazu (nicht der ganze Januar); der Knopf
   zeigt die Spanne und darunter „Dezember 2026 + 1 Termin · n Termine“. Die Matrix bleibt dabei stehen (kein „wird
   geladen“). **＋** links nimmt einen Termin davor dazu. Ausgeblendete Veranstaltungen (Filter) zählen nicht.
3. Im Menü ist der Dezember weiter blau. **›** springt zum Januar – das ＋ fällt weg.
4. **Wer wie oft?** → der Knopf zeigt „Letzte 3 Monate · n Termine“ mit der Spanne bis heute; gezählt wird dort. Im
   Menü oben **Letzte 3/6/12 Monate** statt „Ab heute“, darunter Monatsfelder und eigener Zeitraum.
5. Zurück auf **Matrix** → die Matrix hat ihren eigenen Zeitraum behalten. Seite neu laden → beide Zeiträume sind noch da.
6. Viele Termine (z. B. ein Monat mit Gebetsabenden): unten an der Matrix steht **immer** eine graue Scroll-Leiste, auch
   ohne zu scrollen; mit der Maus ziehen schiebt die Termine seitlich.
7. Abwesenheiten (Musik-App): dort sind die Monatsfelder vor dem laufenden Monat gesperrt.

<details><summary>Technisches</summary>

- **Priorität:** normal
- **Betrifft:** `shared/ct/zeitraum.ts`, `shared/dienstplan/plan.ts`, `ui/bedienung/ZeitraumKnopf.tsx`, `ui/abwesenheiten/AbwesenheitenSeite.tsx`, `dienstplaner/src/Planen.tsx`, `dienstplaner/src/planenAnsicht.ts`, `dienstplaner/src/Planen.module.scss`
- **Automatisiert:** ja – `shared/ct/zeitraum.test.ts` (Letzte N Monate, ＋ zählt nach Filter, Vorlauf, gemerkt), `shared/dienstplan/plan.test.ts` (`planAusschnitt` aus `planAus`), `ui/bedienung/ZeitraumKnopf.test.tsx` (Monatsfelder, Jahr, Vergangenheit, Grenzen), `dienstplaner/src/Planen.test.tsx` (Monat, ＋ ohne Vorgeladenes, leises Nachladen, eigener Zeitraum „Wer wie oft?“ getrennt gemerkt), `ui/design/matrixScrollLeiste.test.ts` (Regel für die Scroll-Leiste), `client/src/pages/Availability.test.tsx`; von Hand bleibt, ob die Leiste im Browser wirklich dauerhaft steht
- **Historie:** E9-3 (05.11.2026, Entwurf `e9-zeitraum-scrollen.html`, Wünsche aus dem ersten Planen in Live)

</details>

### TF-ABLAUF-26 · Filter nach Kalender (Dienste und Planen)

**Das brauchst du:** Dienstplaner mit Terminen aus mindestens zwei Kalendern (z. B. Gottesdienste und
Gemeindeveranstaltungen), darunter ein umbenannter Gottesdienst (z. B. „Ostergottesdienst“).

**Das muss passieren:** Im Filter steht oben „Kalender“; ein abgehakter Kalender blendet seine Termine aus, egal wie sie
heißen.

1. **Dienste** → „Alle“ → **Filter**: oben **Kalender** mit den Kalendern der Termine (nach Namen), darunter
   **Veranstaltungen**.
2. „Gemeindeveranstaltungen“ abhaken → Gebetsabend & Co. verschwinden, der umbenannte Gottesdienst bleibt. Unter
   „Veranstaltungen“ steht kein „Gebetsabend“ mehr. Am Knopf steht die Zahl der ausgeblendeten Häkchen.
3. Seite neu laden → die Wahl ist noch da.
4. **Planen** → **Filter**: Kalender, Veranstaltungen, Gruppen. Kalender abhaken → die Spalten fallen weg.
5. Zeitraum = ein Monat, **＋** rechts → der nächste Termin aus einem **angehakten** Kalender kommt dazu; ein Termin im
   abgehakten Kalender dazwischen wird übersprungen.
6. Liegen alle geladenen Termine in einem Kalender, fehlt der Abschnitt „Kalender“.

<details><summary>Technisches</summary>

- **Priorität:** normal
- **Betrifft:** `shared/ct/kalenderFilter.ts`, `shared/dienstplan/termine.ts`, `shared/dienstplan/plan.ts`, `dienstplaner/src/terminAbschnitte.ts`, `dienstplaner/src/Termine.tsx`, `dienstplaner/src/Planen.tsx`, `dienstplaner/src/usePlanZeitraum.ts`, `dienstplaner/src/auswahl.ts`, `dienstplaner/src/planenAnsicht.ts`, `client/src/utils/kalenderFilter.ts`
- **Automatisiert:** ja – `shared/ct/kalenderFilter.test.ts` (Name aus dem Termin, ohne Kalender sichtbar, ausgeblendete wählbar, gemerkte IDs), `shared/dienstplan/termine.test.ts` (Kalender am Termin, Veranstaltungen nur aus angehakten Kalendern, mit „Meine“), `dienstplaner/src/Termine.test.tsx` + `dienstplaner/src/Planen.test.tsx` (Abschnitt oben, blendet aus, gemerkt, ＋ überspringt, ohne zweiten Kalender kein Abschnitt), `dienstplaner/src/geraet.test.ts`, `client/src/utils/kalenderFilter.test.ts`; 15 Gegenproben einzeln rot; von Hand bleibt der Blick auf echte Kalender
- **Historie:** Wunsch 6 (09.11.2026, Entwurf `w6-kalender-filter.html`; Live gemessen: außer dem Kalender keine Kategorie am Termin)

</details>

### TF-ABLAUF-27 · Einteilen und senden direkt in der Termin-Ansicht

**Das brauchst du:** Dienstplaner als Planer einer Dienstgruppe; ein kommender Termin mit einem freien Platz in dieser
Gruppe; dazu an einem **anderen** Termin schon ein Entwurf (in „Planen“ angelegt). Test-Instanz verschickt echte
Mitteilungen – nur senden, wenn das gewollt ist.

**Das muss passieren:** In der Termin-Ansicht wird eingeteilt wie in der Matrix; gesendet wird nur, was an diesem Termin
steht.

1. Termin öffnen → unter „Dienste“ ist ein freier Platz der eigenen Gruppe rot **„frei“** und antippbar; im Kopf neben dem
   Teilen-Knopf steht die Hilfe **„?“** (öffnet „Hilfe · Termin“: „Freien Platz antippen zeigt „Wer kann?“ …“). Plätze fremder
   Gruppen sind nicht antippbar.
2. „frei“ antippen → **„Wer kann?“** (Titel „Dienst · Tag“), dasselbe Fenster wie in „Planen“. Jemanden wählen → das
   Fenster schließt, am Platz steht der Entwurf blau gestrichelt, Meldung „… eingetragen – noch nicht gesendet“.
3. Unten die Leiste **„1 Entwurf noch nicht gesendet · an diesem Termin“** mit **Alle verwerfen** und **Ansehen und senden**.
4. Einen belegten Platz antippen → zurückziehen oder ersetzen wie in der Matrix; den Entwurf antippen → Entwurfs-Fach.
5. In der Gruppenüberschrift rechts der **Zauberstab** → automatische Planung nur für diesen Termin.
6. **Ansehen und senden** → nur die Entwürfe dieses Termins; darunter „An einem anderen Termin liegen noch Entwürfe – die
   sendest du unter „Planen“.“ Senden → danach zeigt die Ansicht ohne Neuladen, was jetzt in ChurchTools steht; die
   Leiste ist weg. In „Planen“ steht der Entwurf des anderen Termins weiter da.
7. Ohne Planen-Recht (andere Person): Plätze nur ansehen, kein Hilfe-Knopf, kein Zauberstab, keine Leiste.
8. Am Handy: Leiste „1 Entwurf · Verwerfen · Ansehen & senden“, Fenster von unten.

<details><summary>Technisches</summary>

- **Priorität:** hoch
- **Betrifft:** `dienstplaner/src/useEinteilen.tsx`, `dienstplaner/src/TerminAnsicht.tsx`, `dienstplaner/src/PlanPlaetze.tsx`, `dienstplaner/src/Planen.tsx`, `dienstplaner/src/PlanAnsicht.tsx`, `dienstplaner/src/SendenFach.tsx`, `dienstplaner/src/useEntwuerfe.ts`, `dienstplaner/src/planEntwuerfe.ts`, `dienstplaner/src/App.tsx`
- **Automatisiert:** ja – `dienstplaner/src/TerminAnsicht.test.tsx` (Planer/kein Planer, Entwurf am Platz, Leiste „an diesem Termin“, nur dieser Termin gesendet, danach leise neu, Zauberstab, Handy, keine Nachfrage fremder Termine), `dienstplaner/src/planEntwuerfe.andere.test.ts`, `dienstplaner/src/Planen.test.tsx` (unverändert grün nach dem Umzug in `useEinteilen`); 15 Gegenproben einzeln rot; von Hand bleibt das echte Senden
- **Historie:** Fund F1 aus dem Test von v0.2.0 (08.11.2026), Entwurf `f1-termin-planen.html` (09.11.2026)

</details>

### TF-ABLAUF-28 · Von der Startseite direkt hin: Gruppe in Planen, Termin per Titel

**Das brauchst du:** Dienstplaner als Planer von mindestens zwei Dienstgruppen; auf der Startseite „Als Nächstes“ und
„Deine nächsten Dienste“ mit Einträgen.

**Das muss passieren:** Ein Tipp auf der Startseite führt ohne Umweg an die richtige Stelle.

1. Startseite → Karte **Planen** → eine Gruppe (z. B. „Technik · 27 Plätze frei“) antippen → Planen öffnet sich mit
   **nur dieser Gruppe** und dem Zeitraum **heute bis in 6 Wochen**; oben steht – **blau hinterlegt**, nicht rot –
   „Nur Technik · nächste 6 Wochen – von der Startseite, nur für jetzt.“ Die freien Plätze in der Matrix ergeben dieselbe
   Zahl wie auf der Startseite. Auch der Termin-Kopf (am Handy die Datumszettel) zählt **nur Technik**: „alles besetzt“,
   wenn Technik dort voll ist, auch wenn andere Gruppen noch Lücken haben; „—“, wo Technik an dem Termin keinen Dienst hat.
2. Einen Termin im Kopf antippen → Termin-Ansicht → „‹ Planen“ → wieder nur Technik, derselbe Zeitraum.
3. **Gewohnte Ansicht** → Planen mit dem eigenen gemerkten Filter und Zeitraum. Auch über den Reiter „Planen“ kommt der
   gewohnte Stand – der Besuch hat nichts verstellt. Spaltenbreite, die man währenddessen ändert, bleibt gemerkt.
4. Im Besuch im Filter eine zweite Gruppe anhaken → oben „Eigene Auswahl“, beide Gruppen sichtbar.
5. Startseite: Datum oder Titel unter **Als Nächstes** antippen → Termin-Ansicht dieses Termins. Ebenso in **Deine
   nächsten Dienste** und **Für dich offen** der Titel („Video Regie · Gottesdienst“) oder die Datumskachel; „Tauschen“,
   „Zusagen“ usw. bleiben eigene Knöpfe.
6. Planen am Handy: Datum oder Titel des Termins oben öffnen die Termin-Ansicht (wie „Ablauf & Dienste“); in der Tabelle
   öffnet auch die Datumskachel im Spaltenkopf den Termin.

<details><summary>Technisches</summary>

- **Priorität:** normal
- **Betrifft:** `dienstplaner/src/Startseite.tsx`, `dienstplaner/src/TerminLink.tsx`, `dienstplaner/src/reiter.ts`, `dienstplaner/src/App.tsx`, `dienstplaner/src/Planen.tsx`, `dienstplaner/src/PlanAnsicht.tsx`, `shared/dienstplan/start.ts`
- **Automatisiert:** ja – `shared/dienstplan/start.test.ts` (`planenZeitraum` gegen die Zählung der Karte), `dienstplaner/src/reiter.test.ts` (Adresse `#/planen/gruppe/<id>`), `dienstplaner/src/Planen.test.tsx` (Besuch: Zeitraum, nur eine Gruppe, Gemerktes bleibt, „Eigene Auswahl“, „Gewohnte Ansicht“; Titel/Kachel am Handy und im Tabellenkopf), `dienstplaner/src/App.test.tsx` (zurück aus dem Termin in den Besuch), `dienstplaner/src/Startseite.test.tsx` (Gruppe → Adresse, Titel und Kachel → Termin); 17 Gegenproben einzeln rot
- **Historie:** Wünsche 7 und 8 (Alwin 09.11.2026, Bild der Startseite v0.3.0; entschieden 11.11.2026)

</details>

### TF-ABLAUF-29 · Planen: Ansicht „Personen“ (Raster, nur ansehen)

**Das brauchst du:** Dienstplaner als Planer; Dienste, deren ChurchTools-Gruppen Mitglieder haben (am besten Musik mit
zwei Diensten, in denen dieselbe Person steht, und ein Dienst aus Technik); mindestens eine eingetragene Abwesenheit, die
einen Termin im Zeitraum trifft; ein Konto **mit** und eines **ohne** das Recht „Abwesenheiten sehen“ (bzw. „Abwesenheiten
verwalten“).

**Das muss passieren:** Dieselben Termine wie die Matrix als Raster – wer wann eingeteilt, abwesend oder noch frei ist.

1. **Planen** → oben **Matrix | Personen | Wer wie oft?** → **Personen**: Spalten = die Termine der Matrix (gleicher
   Zeitraum, gleiche Filter), davor **Name** und **Einsätze**; ein Block je Dienst, darin die Personen alphabetisch.
2. Eine Person, die in zwei Diensten Mitglied ist, steht in **beiden** Blöcken, jeweils mit „auch …“ neben dem Namen. Ist sie
   an einem Tag in beiden Diensten eingeteilt, steht in jeder Zelle der andere als grauer Text „+ Gesang“.
3. Die Zelle zeigt den Dienst als farbigen Tag: **Haken** = zugesagt, **Kreis mit ?** = angefragt, **blau** = Entwurf
   (gestrichelt mit „?“ = Anfrage, durchgezogen mit Haken = direkt; einen Entwurf in der Matrix anlegen, wieder zu „Personen“
   wechseln). „Einsätze“ zählt zugesagt + angefragt und gültige Entwürfe (seit P2a-2, TF-ABLAUF-33).
4. **Filter** → die Gruppe Technik ausblenden: Wer an einem Tag im Ton eingeteilt ist, zeigt in der Musik-Zeile blass und
   schräg „+ Ton (Technik)“.
5. Abwesenheit: grauer Tag mit dem **Grund**; eine mehrtägige, die vor dem Zeitraum begann, deckt den ersten Termin mit ab.
   Ist die Person dort zugleich eingeteilt, stehen beide da, der graue Tag mit **rotem Rand**.
6. Unten je Block eine Zeile **Gäste** (Plätze mit Namen ohne Person), ganz unten **Noch offen**: je Termin die freien Plätze
   als rote Tags („Gesang ×2“) – dieselbe Zahl wie „N frei“ im Kopf der Matrix. Ein Dienst mit „Namen verbergen“ zeigt nie
   einen Namen.
7. Maus über einem Namen (am Handy antippen) hebt **alle** Zeilen dieser Person hell hervor; noch einmal antippen nimmt es
   zurück. Wo man nicht eintragen darf (Dienst nur ansehen, Entwürfe nicht bereit), tut ein Klick in eine Zelle nichts
   (Eintragen per Klick: TF-ABLAUF-32; bestehende Einteilung anklicken: TF-ABLAUF-37).
8. Konto **ohne** das Recht: im Block steht ruhig „Abwesenheiten nicht sichtbar“ statt leerer Zellen.
9. Am Handy dieselbe Tabelle, **waagerecht scrollbar**, die Namensspalte bleibt stehen.
10. Verbindung kurz kappen oder ChurchTools bremsen lassen, Ansicht öffnen: Scheitert nur eine Gruppe, steht in **ihrem** Block
    ein Hinweis mit **„Nochmal versuchen“**, die anderen Blöcke bleiben; danach holt der Knopf nur diese Gruppe.
11. Hatte ein Gerät „Wer wie oft?“ gemerkt (vor 16.11.2026), zeigt es weiter „Wer wie oft?“, nicht das Raster.

<details><summary>Technisches</summary>

- **Priorität:** hoch
- **Betrifft:** `shared/dienstplan/personenRaster.ts`, `shared/dienstplan/personenDaten.ts`, `shared/dienstplan/plan.ts`, `shared/dienstplan/termine.ts`, `dienstplaner/src/PersonenRaster.tsx`, `dienstplaner/src/ladePersonen.ts`, `dienstplaner/src/usePersonenDaten.ts`, `dienstplaner/src/personenFarben.ts`, `dienstplaner/src/Planen.tsx`, `dienstplaner/src/planenAnsicht.ts`, `dienstplaner/src/usePlanZeitraum.ts`
- **Automatisiert:** ja – `shared/dienstplan/personenRaster.test.ts` (Blöcke und Zeilen, Mitglied ohne Einsatz, Eingeteilte ohne Mitgliedschaft, Café mit mehreren Gruppen, Einsätze, „+ …“ auch für ausgeblendete Gruppen, Abwesenheit mehrtägig/mit Uhrzeit/mit Warnung, Gäste, Verborgene, „Noch offen“ = `terminStand`, Entwürfe, Ladezustand), `shared/dienstplan/personenDaten.test.ts`, `dienstplaner/src/ladePersonen.test.ts` (Recht ja/nein, Seitenteilung, Fehlerzweige einzeln, höchstens vier gleichzeitig), `dienstplaner/src/usePersonenDaten.test.tsx`, `dienstplaner/src/Planen.personen.test.tsx` (Umschalter, Laden, Fehler im Block, Hervorheben, Klick ohne Wirkung), `dienstplaner/src/geraet.test.ts` (gemerktes „personen“ → „Wer wie oft?“); 22 Gegenproben einzeln rot; von Hand bleiben echte Rechte, echte Abwesenheiten und der Blick am Handy
- **Historie:** Wunsch 5 (Alwin 05./06.11.2026, Entwurf `e9-personen-v3.html`; P0 gemessen 13.11.2026), Scheibe P1
</details>

### TF-ABLAUF-30 · Planen: einzelne Dienste ausblenden, Block in „Personen“ zuklappen

**Das brauchst du:** Dienstplaner als Planer; eine Dienstgruppe mit mindestens drei Diensten (am besten Technik mit Ton,
Bild, Licht), in der an einem Tag dieselbe Person in zwei Diensten steht (z. B. Ton und Bild); danach zwei Termine mit
freien Plätzen in Bild.

**Das muss passieren:** Man blendet nur den Dienst aus, der stört – nicht gleich die ganze Gruppe – und sieht danach nur
noch, was zählt.

1. **Planen → Filter**: Unter **Gruppen** steht unter jeder Gruppe mit mehreren Diensten die Liste ihrer Dienste, eingerückt,
   jeder mit eigenem Haken. Eine Gruppe mit nur einem Dienst hat keine Liste.
2. **Bild** abhaken: Die Gruppe Technik zeigt einen **Strich** statt Haken, am Filter-Knopf steht **1**. In der **Matrix**
   fehlt die Zeile Bild; **Termin-Kopf**, Füllbalken und die Zeile der Gruppe („N frei“) zählen **ohne** Bild (am Handy auch der
   Zettel und die Datumsleiste); unten „Ansehen und senden“ ist davon unberührt.
3. **Personen**: Es gibt keinen Block Bild; in der Zeile der Person im Ton steht am selben Tag blass **„+ Bild“** (ohne
   „(Technik)“). **Noch offen** nennt Bild nicht. **Wer wie oft?** zählt Bild ebenfalls nicht mit.
4. Die ganze Gruppe Technik ausblenden: In „Personen“ steht bei Personen aus anderen Gruppen wie bisher „+ Ton (Technik)“.
5. Den **Gruppenhaken mit Strich** antippen: Alle Dienste der Gruppe sind wieder an. Den Haken noch einmal antippen: Gruppe
   aus, alle ihre Dienste abgehakt. Alle Dienste einer Gruppe **einzeln** abhaken: Der Gruppenhaken ist dann ebenfalls aus.
6. Das Gerät merkt sich die Wahl: App neu laden → derselbe Filter. Über **Teilen** → Plan: Der ausgeblendete Dienst steht
   weder im PDF noch unter „Wir suchen noch …“.
7. **Personen**: Den Kopf eines Dienstes („Ton · 5 Personen“) antippen → nur der Kopf bleibt, die Zeilen und Gäste sind weg,
   **Noch offen** zählt den Dienst weiter. Noch einmal antippen klappt auf. Zuklappen ist **kein** Ausblenden: Der Filter
   ändert sich nicht.
8. Von der Startseite aus **Planen** → eine Gruppe (z. B. „Technik“) antippen: Es stehen **alle** Dienste der Gruppe da, auch
   wenn Bild im Filter ausgeblendet ist. **Gewohnte Ansicht** → wieder ohne Bild. Im Besuch einen Dienst abhaken: oben „Eigene
   Auswahl“, danach ist der gemerkte Filter unverändert.
9. Der **Regler** in der Gruppenzeile (Plätze) zeigt weiter **alle** Dienste der Gruppe, auch den ausgeblendeten.

<details><summary>Technisches</summary>

- **Priorität:** normal
- **Betrifft:** `shared/dienstplan/planFilter.ts`, `shared/dienstplan/personenRaster.ts`, `shared/dienstplan/werWieOft.ts`, `shared/dienstplan/plan.ts`, `dienstplaner/src/Planen.tsx`, `dienstplaner/src/gruppenAbschnitt.ts`, `dienstplaner/src/planenAnsicht.ts`, `dienstplaner/src/PersonenRaster.tsx`, `dienstplaner/src/PlanAnsicht.tsx`, `dienstplaner/src/WerWieOft.tsx`, `ui/bedienung/FilterKnopf.tsx`
- **Automatisiert:** ja – `shared/dienstplan/planFilter.test.ts` (gezeigte Gruppen, freie Plätze neu gezählt, Termin-Stand, alle Dienste einzeln aus = Gruppe aus, Umschalten), `shared/dienstplan/personenRaster.test.ts` („+ Gesang“ blass ohne Gruppenzusatz, mit Gruppenzusatz bei ausgeblendeter Gruppe, „Noch offen“), `dienstplaner/src/Planen.dienstFilter.test.tsx` (Menü mit Strich, Matrix, Kopf/Füllbalken/Zettel, Personen, Block zuklappen, Wer wie oft?, Besuch von der Startseite, Lese-Toleranz), `dienstplaner/src/Planen.teilen.test.tsx`, `dienstplaner/src/Planen.plaetze.test.tsx`, `ui/bedienung/FilterKnopf.test.tsx`, `dienstplaner/src/geraet.test.ts`; 17 Gegenproben einzeln rot; von Hand bleibt der Blick am Handy und im echten ChurchTools
- **Historie:** Wunsch 10 (Alwin 16.11.2026: „Ich will z. B. nur Bild rausfiltern“)

</details>

### TF-ABLAUF-31 · Planen: Fokus-Modus – eine Person im ganzen Plan anleuchten

**Das brauchst du:** Dienstplaner als Planer; mehrere Termine im Zeitraum, in denen dieselbe Person in verschiedenen Diensten
steht (am besten einmal zugesagt, einmal angefragt, einmal als Entwurf), ein freier Platz und mindestens ein Gast.

**Das muss passieren:** Man sieht auf einen Blick, wo jemand eingeteilt ist – in allen Ansichten und an allen Terminen.

1. **Rechner, Matrix:** Mit der Maus über den Namen eines belegten Platzes fahren → rechts erscheint ein kleines
   **Fadenkreuz-Symbol**. Anklicken: Alle Plätze dieser Person sind **gelb umrandet** (zugesagt grün, angefragt „?“, Entwurf
   blau gestrichelt bleiben im Platz sichtbar), andere nicht. Das Fenster „zurückziehen oder ersetzen“ geht **nicht** auf. Oben
   steht „Fokus: <Name> · N Einsätze in M Terminen · 1 angefragt · 1 Entwurf“ und „Fokus aus“.
2. Einen **Gast** und einen Namen mit „Namen verbergen“ anfahren: kein Symbol. Den Namen **antippen** öffnet wie gewohnt das
   Fenster; dort oben **„Im Plan hervorheben“** (bei Gästen nicht) → Fenster zu, Fokus auf diese Person.
3. **Handy:** Einen belegten Platz **lang drücken** (eine halbe Sekunde, nicht wischen) → Fokus; kein Fenster. Kurz tippen
   öffnet das Fenster wie immer. Die Leiste bleibt beim Blättern zwischen den Terminen; auf dem Zettel ist der Platz umrandet.
4. **Personen** und **Wer wie oft?** wählen: Der Fokus **bleibt**. In „Personen“ sind **alle Zeilen** der Person (in jedem
   Dienst) gelb hinterlegt und umrandet, der Name fett. Einen anderen Namen antippen: Der Fokus wechselt (immer nur eine
   Person); denselben noch einmal antippen: Fokus aus.
5. **Suchfeld „Person hervorheben“** (Handy: Such-Symbol in der Leiste): „da“ tippen → Vorschläge mit Kreis, Name und Diensten
   (nur Eingeteilte, nur Treffer am Namensanfang); wählen → Fokus. Pfeiltasten und Enter gehen auch.
6. Im **Filter** einen Dienst ausblenden, in dem die fokussierte Person steht: Sie wird dort nicht umrandet (die Zeile fehlt),
   die Leiste zählt den Einsatz aber mit und sagt „· 1 ausgeblendet“. Ein **abgesagter** Termin zählt nicht mit.
7. **„Wer kann?“** an einem freien Platz öffnen: Unter jedem Namen steht „Im Plan, ±7 Tage: …“ mit seinen Einsätzen in der
   Nähe, oder „noch nichts“. **„im Plan zeigen“** bei einem Kandidaten → Fenster zu, die Person ist im Fokus, unter „Fokus aus“
   steht **„‹ Zurück zu ‚Wer kann?‘ für Ton · So, 20.12.“** (und **„Hier eintragen“**, wo du dort Entwürfe anlegen darfst).
8. **Zurück** → dasselbe Fenster für denselben Platz, der Fokus bleibt. Noch einmal „im Plan zeigen“ und **„Hier eintragen“** →
   Hinweis „… eingetragen – noch nicht gesendet“, der Entwurf steht im Platz, die Zeile „Zurück“ ist weg, der Fokus bleibt und
   zählt den Entwurf. (Nichts geht an ChurchTools, bevor du „Ansehen und senden“ wählst.)
9. **Fokus aus** → Umrandungen und Leiste sind weg. Fokus setzen, den Reiter wechseln (z. B. Start) und zurück zu Planen: Der
   Fokus ist **beendet**. App neu laden: auch nicht gemerkt.

<details><summary>Technisches</summary>

- **Priorität:** normal
- **Betrifft:** `shared/dienstplan/fokus.ts`, `dienstplaner/src/Planen.tsx`, `dienstplaner/src/Fokus.tsx`, `dienstplaner/src/PlanPlaetze.tsx`, `dienstplaner/src/useLangDruck.ts`, `dienstplaner/src/useEinteilen.tsx`, `dienstplaner/src/WerKann.tsx`, `dienstplaner/src/BelegtFach.tsx`, `dienstplaner/src/PersonenRaster.tsx`, `ui/design/_farben.scss`
- **Automatisiert:** ja – `shared/dienstplan/fokus.test.ts` (wer steht am Platz, Zählen mit abgesagten/ausgeblendeten/Entwurf, Vorschläge, Einsätze ±7 Tage, Texte), `dienstplaner/src/Planen.fokus.test.tsx` (Umrandung in Matrix/Zettel/Personen, Leiste, Fokus aus, Ansichtswechsel, Verlassen, Fenster-Knopf, Symbol ohne Fenster, langes Drücken mit Fake-Timern, Suchfeld, „Wer kann?“ Mini-Zeile/zeigen/Zurück/Hier eintragen gegen dieselbe Funktion wie die Wahl), `dienstplaner/src/Planen.personen.test.tsx`; 23 Gegenproben einzeln rot (die Sperre „Symbol öffnet kein Fenster“ ist doppelt gesichert – eigener Knopf neben dem Platz und `stopPropagation` – und nur beides zusammen entfernt macht Tests rot); von Hand bleiben das echte Hover-Symbol mit der Maus, das lange Drücken am Handy und das Aussehen in Hell und Dunkel
- **Historie:** Wunsch 11 (Alwin 16.11.2026, Entwurf `e11-fokus.html`, Farbe A Gelb)

</details>

### TF-ABLAUF-32 · Planen: Personen – Eintragen per Klick in die Zelle

**Das brauchst du:** Dienstplaner als Planer, der Entwürfe anlegen darf (Schublade der Dienstgruppe bereit); ein Dienst
(z. B. Ton) mit mindestens vier Terminen: einer mit freiem Platz, an dem niemand etwas Besonderes hat, einer, an dem eine
Person im Ton am selben Tag schon in einem anderen Dienst (z. B. Gesang) steht, einer, an dem ein Mitglied der Gruppe
abwesend ist, und einer, an dem der Dienst **voll** ist (alle Plätze besetzt). Dazu eine eingeteilte Person (zugesagt).

**Das muss passieren:** Ein Klick in eine leere Zelle trägt als Entwurf ein; nur bei einem Grund zum Nachdenken kommt vorher
ein Fenster.

1. **Planen → Personen.** Mit der **Maus** über eine leere Zelle im Block Ton fahren: blauer Rahmen, blasse blaue Fläche, ein
   **„+“** rechts. Über eine Zelle mit Einteilung (✓ oder ?): nur eine blasse Tönung, kein „+“ (Klick: TF-ABLAUF-37); in einem
   Dienst, den man nur ansehen darf: nichts.
2. **Klick** in die leere Zelle (Person ohne Besonderheit): sofort ein **Entwurf** (blau, gestrichelt, „?“ = Anfrage), Hinweis
   „… eingetragen – noch nicht gesendet“, unten die Leiste **Ansehen und senden** zählt mit. Kein Fenster. In der Matrix steht der
   Entwurf auf dem **ersten freien Platz** dieses Dienstes an diesem Termin.
3. **Klick auf den eigenen Entwurf** in der Zelle: er wird **direkt** (Klick-Zyklus, TF-ABLAUF-35); ein weiterer Klick nimmt ihn weg
   („Entwurf entfernt.“), die Zelle lädt wieder zum Eintragen ein.
4. Person mit **„+ Gesang“** am selben Tag: Klick → Fenster „Bitte prüfen“: „<Name> ist am Fr, 20.11. schon bei Gesang
   eingeteilt. Trotzdem für Ton eintragen?“ **Abbrechen** → nichts. Noch einmal klicken, **Trotzdem eintragen** → Entwurf.
5. Person, die **abwesend** ist (Zelle schraffiert, Grund als Text): Fenster mit Grund und Zeitraum („… abwesend: Urlaub (28.11.–30.11.)“), dazu die
   gleiche Frage. Ist sie zugleich in einem anderen Dienst eingeteilt: **ein** Fenster mit beiden Sätzen.
6. Termin, an dem der Dienst **voll** ist: Klick in eine leere Zelle → Fenster „Ton ist voll“: „Ton am 27.11. ist voll (2 von
   2).“ mit **Platz dazunehmen (3)** (TF-ABLAUF-38). **Abbrechen** → nichts wird eingetragen.
7. Klick auf eine **bestehende Einteilung** (zugesagt, angefragt): öffnet das Fenster „zurückziehen oder ersetzen“ (TF-ABLAUF-37).
   Klick auf den **Namen**: setzt weiter den Fokus; ein Klick in eine Zelle tut das nicht.
8. **Tastatur:** mit Tab zu einer leeren Zelle (Rahmen), Enter → dasselbe wie der Klick; der Vorleser nennt „Daniel F. für Ton am
   Fr, 20.11. eintragen“.
9. **Handy:** leere, eintragbare Zellen zeigen ein blasses „+“ (kein Hover); Antippen wie der Klick; die Fenster passen auf den
   Bildschirm.
10. Ein Konto, das den Dienst nur ansehen darf, oder ein Dienst ohne Entwurfs-Schublade: keine „+“, kein Rahmen, kein Klick.

<details><summary>Technisches</summary>

- **Priorität:** hoch
- **Betrifft:** `shared/dienstplan/personenEintragen.ts`, `shared/dienstplan/personenRaster.ts`, `dienstplaner/src/PersonenRaster.tsx`, `dienstplaner/src/PersonenRaster.module.scss`, `dienstplaner/src/useEinteilen.tsx`, `dienstplaner/src/planSicht.ts`, `dienstplaner/src/planEntwuerfe.ts`, `dienstplaner/src/Planen.tsx`
- **Automatisiert:** ja – `shared/dienstplan/personenEintragen.test.ts` (freier Platz ohne Entwurf, Aktion je Zelle: eintragen/voll/wegnehmen/nichts, Texte, Warnung einzeln und beides), `dienstplaner/src/Planen.p2a.test.tsx` (Klick → Entwurf mit denselben Angaben wie „Wer kann?“, Leiste, Entwurf wegnehmen mit Version, fremder Entwurf, Warnfenster anderer Dienst/abwesend/beides mit Abbrechen und „Trotzdem“, voll, kein Recht/keine Schublade/nicht geladen/nur lesen, Doppelklick, Fehlerhinweise, Klick neben dem Knopf, Fokus bleibt), `dienstplaner/src/Planen.personen.test.tsx`, `dienstplaner/src/Planen.fokus.test.tsx`; Gegenproben einzeln rot; von Hand bleiben Hover (Rahmen, „+“), Touch-„+“ und das Aussehen in Hell und Dunkel
- **Historie:** Wunsch 5 (Alwin 16.11.2026, Entwurf `e9-p2-eintragen.html`, Variante B), Scheibe P2a
</details>

### TF-ABLAUF-33 · Planen: Entwürfe zählen mit, abgesagte Termine nehmen keine Einträge an

**Das brauchst du:** Dienstplaner als Planer, der Entwürfe anlegen darf; ein Dienst (z. B. Ton) mit einem Termin, an dem **ein
Platz frei** ist, einer eingeteilten Person (zugesagt) im selben Dienst und **einem abgesagten Termin** mit freien Plätzen.

**Das muss passieren:** Zahlen und Knöpfe stimmen mit den Entwürfen überein – in der Matrix und in „Personen“ gleich.

1. **Matrix:** Am Termin mit einem freien Platz steht im Kopf „1 frei“, der Füllbalken ist nicht voll. Freien Platz antippen,
   jemanden als **Entwurf** eintragen: sofort „alles besetzt“, Balken voll, in der Gruppenzeile der Haken – **ohne** zu senden.
2. Den Entwurf wieder entfernen: „1 frei“ ist zurück.
3. Eine eingeteilte Person antippen → **zurückziehen** (Entwurf): am Termin steht „1 frei“ mehr. Stattdessen **ersetzen**:
   die Zahl der freien Plätze bleibt.
4. **Personen:** In einem Block (Ton) unter „Einsätze“ und in der Fußzeile **„Noch offen“** die Zahlen merken. Eine leere
   Zelle anklicken (Entwurf): „Einsätze“ der Person **+1**, „Noch offen“ dieses Termins **−1**. Den eigenen Entwurf anklicken
   (weg): beides wieder wie vorher.
5. Ein Entwurf, der **veraltet** ist (in ChurchTools hat inzwischen jemand anderes den Platz belegt): zählt nicht.
6. **Teilen / PDF:** „Plan teilen“ mit einem offenen Entwurf: „Wir suchen noch …“ und die roten „N frei“ zeigen weiter den
   Stand von ChurchTools (der Entwurf ist noch nicht verbindlich).
7. **Abgesagter Termin, Matrix:** der freie Platz ist **kein Knopf** (nichts öffnet „Wer kann?“); Namen und bestehende
   Einteilungen stehen da wie bisher. Der Zauberstab füllt ihn nicht.
8. **Abgesagter Termin, Personen:** in der abgesagten Spalte kein Rahmen, kein „+“, kein Eintragen; ein **eigener Entwurf**
   dort lässt sich per Klick wegnehmen. An den anderen Terminen unverändert. Ein **vergangener**, nicht abgesagter Termin: weiter eintragbar (Nachtragen).
9. **Handy:** Datumsleiste, Zeile unter dem Titel und Gruppenzeile zeigen dieselben Zahlen wie am Rechner.
10. **Platz übernehmen:** Dienst, der voll ist, bei einer Person „Zurückziehen“ (Matrix, Entwurf). In „Personen“ in die Zelle
    einer anderen Person klicken: kein Fenster „voll“, sondern Hinweis „Y statt X eingetragen – noch nicht gesendet“; in der
    Matrix steht dort „Y statt X“. Warnungen (abwesend, anderer Dienst) kommen wie sonst. Y wieder wegnehmen: der Platz ist
    wieder X (kein „Zurückziehen“ mehr). Gibt es zugleich einen freien Platz ohne Entwurf, bekommt der den Eintrag.

<details><summary>Technisches</summary>

- **Priorität:** hoch
- **Betrifft:** `shared/dienstplan/platzNachEntwurf.ts`, `shared/dienstplan/plan.ts`, `shared/dienstplan/personenRaster.ts`, `dienstplaner/src/PlanAnsicht.tsx`, `dienstplaner/src/PlanPlaetze.tsx`, `dienstplaner/src/useEinteilen.tsx`, `dienstplaner/src/planEntwuerfe.ts`
- **Automatisiert:** ja – `shared/dienstplan/platzNachEntwurf.test.ts` (Regel je Fall, passt zu `platzPerson`, `terminStand`/`gruppenFrei`, `PlanGruppe.frei` bleibt ChurchTools), `shared/dienstplan/personenRaster.test.ts` („Entwürfe zählen mit“), `dienstplaner/src/Planen.p2a2.test.tsx` (Kopf, Balken, Gruppenzeile, Handy, abgesagte Spalte in Matrix und „Personen“, Eintragen/Wegnehmen ändert die Zahlen), `dienstplaner/src/planEntwuerfe.zauber.test.ts`; Gegenproben je Stelle einzeln rot; von Hand bleiben Teilen/PDF und das Aussehen
- **Historie:** Wunsch 5 (Alwin 16.11.2026), Scheibe P2a-2
</details>

### TF-ABLAUF-34 · Planen: Personen – Zauberstab je Dienst

**Das brauchst du:** Dienstplaner als Planer; „Planen“ → **Personen**; mindestens zwei Dienste derselben Dienstgruppe (z. B. Ton
und Licht) mit freien Plätzen an **mehreren** kommenden Terminen, ein **abgesagter** Termin mit freien Plätzen im Zeitraum.

**Das muss passieren:** Der Zauberstab im Dienst-Block schlägt nur für diesen Dienst vor – im selben Fenster wie in der Matrix.

1. Im Kopf des Blocks **Ton** steht rechts neben „N Personen“ ein **Zauberstab**. Nur an Blöcken, in denen es etwas zu füllen
   gibt und in denen du planen darfst (Gruppen, die du nur ansehen darfst: kein Knopf).
2. Zauberstab antippen: das Fenster **„Automatische Planung · Ton“** zeigt nur Plätze von **Ton**, an allen gezeigten
   Terminen – **nicht** den abgesagten, nicht vergangene Termine, nicht Licht.
3. **Als Entwurf übernehmen:** die Vorschläge stehen in „Personen“ als **Entwurf** (blau, gestrichelt, „?“); „Einsätze“ und
   „Noch offen“ zählen mit; „Ansehen und senden“ zeigt sie. Gesendet ist noch nichts.
4. Sind in Ton alle freien Plätze besetzt oder haben einen Entwurf, ist **kein Zauberstab** mehr im Ton-Block; Licht behält seinen.
5. **Matrix:** der Zauberstab in der Gruppenzeile (und je Termin) arbeitet wie bisher – für alle Dienste der Gruppe.
6. **Handy:** der Block-Kopf klebt links beim waagerechten Scrollen; der Zauberstab ist erreichbar und öffnet dasselbe Fenster.

<details><summary>Technisches</summary>

- **Priorität:** normal
- **Betrifft:** `dienstplaner/src/PersonenRaster.tsx`, `dienstplaner/src/useEinteilen.tsx`, `dienstplaner/src/planEntwuerfe.ts`, `dienstplaner/src/planSicht.ts`
- **Automatisiert:** ja – `dienstplaner/src/Planen.p2z.test.tsx` (Knopf je Block da/nicht da, Fenster nur dieser Dienst und nur gezeigte, nicht abgesagte/vergangene Termine, Übernehmen legt Entwürfe an und die Zahlen ziehen mit, Handy, Matrix unverändert), `dienstplaner/src/planEntwuerfe.zauber.test.ts` (ein Dienst statt der Gruppe); Gegenproben je Teil einzeln rot; von Hand bleibt das Aussehen im Block-Kopf
- **Historie:** Wunsch 5 (Alwin 16./17.11.2026), Scheibe P2z
</details>

### TF-ABLAUF-35 · Planen: Anfrage oder direkt – Vorgabe je Dienst, Klick-Zyklus, Abwesenheit schraffiert

**Das brauchst du:** Dienstplaner als Planer, der Entwürfe anlegen darf; ein Dienst (z. B. Ton) mit mehreren freien Plätzen an
kommenden Terminen, ein zweiter Dienst derselben Gruppe (z. B. Licht); ein Mitglied, das an einem Termin **abwesend** ist, und
eine Person, die zugleich abwesend **und** eingeteilt ist. Am besten dieselbe Person in „Personen“ und in der Matrix ansehen; die
Prüfung in Hell **und** Dunkel, am Rechner und am Handy.

**Das muss passieren:** Ob neue Einteilungen als Anfrage oder direkt beginnen, entscheidet eine Einstellung je Dienst auf diesem
Gerät – nie ein Klick aus Versehen.

1. **Matrix:** Am Namen jedes planbaren Dienstes steht ein kleines **rundes Symbol**, blau: **„?“** (Umriss) = neue Einteilungen
   beginnen als Anfrage. Mit der Maus darüber: Tooltip „Neue Einteilungen für Ton: Anfrage – ändern“ und ein blasser Ring. In
   Diensten, die du nicht planen darfst, gibt es kein Symbol.
   Dasselbe Symbol steht in „Personen“ im **Kopf jedes Dienst-Blocks**, neben dem Zauberstab, und öffnet dasselbe Fenster.
2. Das Symbol **antippen**: es öffnet nur ein kleines Fenster **„Vorgabe · Ton“** mit **Anfrage | direkt**, dem Satz „direkt = ohne
   Rückfrage als zugesagt eintragen, z. B. für Prediger“, dem Link „Für alle Dienste übernehmen“ und dem Hinweis „Gilt auf diesem
   Gerät“. Es wird **nichts** umgeschaltet, bevor du im Fenster wählst. Auch am Handy gut zu treffen (die Tippfläche ist größer als das Symbol).
3. **direkt** wählen: das Symbol wird zum **gefüllten Haken**. Seite neu laden: es bleibt so (gemerkt auf diesem Gerät). Auf einem
   anderen Gerät oder Browser gilt es nicht. Licht bleibt „?“.
4. **„Für alle Dienste übernehmen (direkt)“**: jeder Dienst zeigt den Haken; mit „Anfrage“ und dem Link darunter geht alles zurück.
5. **Neue Entwürfe folgen der Vorgabe:** Ton auf direkt – in „Wer kann?“ eine Person wählen, den Zauberstab (Matrix oder Block
   „Personen“) übernehmen: die Entwürfe sind **direkt** (Matrix: Schild „direkt“; „Personen“: Haken). Bei Licht (Anfrage) entstehen
   Anfragen. **Bestehende Entwürfe bleiben**, wie sie waren.
6. **Personen, Klick-Zyklus** (Ton auf Anfrage): leere Zelle → 1. Klick: Entwurf **Anfrage** (gestrichelter Rahmen, „?“ im
   gefüllten Kreis – auch im Dunkelmodus gut lesbar); 2. Klick auf den Entwurf: **direkt** (durchgezogener Rahmen, Haken); 3. Klick: **weg**. Steht Ton auf direkt, entsteht beim 1. Klick
   gleich „direkt“, der 2. nimmt weg. Das **Warnfenster** (am Tag schon in einem anderen Dienst, abwesend) kommt nur beim 1. Klick.
7. **Ansehen und senden:** jede Zeile sagt **„Anfrage an …“** oder **„Direkt zuteilen: …“**, oben stehen beide Zahlen – zur Kontrolle.
   Das Wort heißt überall „direkt“, nirgends „fest“.
8. **Abwesenheit in „Personen“:** Die Zelle eines abwesenden Mitglieds ist **schraffiert**, der Grund steht als Text mit dem
   Abwesend-Symbol, **kein Kasten**. **Dunkelmodus:** dieselbe Schraffur in der helleren Farbe, der Text hell und gut lesbar.
9. **Warnfall** (abwesend UND eingeteilt oder Entwurf): die Zelle ist **rot schraffiert** mit einem **2 px roten Rahmen** rundherum; davor
   steht nur das **durchgestrichene Abwesend-Symbol** (kein Grund als Text – der steht im Tooltip und im Warnfenster); mit der Maus und per Tastatur ist die Zelle weiter klickbar wie vorher.

<details><summary>Technisches</summary>

- **Priorität:** hoch
- **Betrifft:** `shared/dienstplan/modusVorgabe.ts`, `shared/dienstplan/personenEintragen.ts`, `shared/dienstplan/personenRaster.ts`, `dienstplaner/src/VorgabeFach.tsx`, `dienstplaner/src/PlanAnsicht.tsx`, `dienstplaner/src/PersonenRaster.tsx`, `dienstplaner/src/PersonenRaster.module.scss`, `dienstplaner/src/useEinteilen.tsx`, `dienstplaner/src/planenAnsicht.ts`, `dienstplaner/src/Planen.tsx`, `dienstplaner/src/TerminAnsicht.tsx`, `ui/design/_farben.scss`, `ui/design/_variables.scss`
- **Automatisiert:** ja – `shared/dienstplan/modusVorgabe.test.ts`, `shared/dienstplan/personenEintragen.test.ts` (Zyklus-Entscheidung), `shared/dienstplan/personenRaster.test.ts` (Modus je Zelle), `dienstplaner/src/geraet.test.ts` (gemerkte Vorgabe lesen), `dienstplaner/src/Planen.p2m.test.tsx` (Symbol im Block-Kopf von „Personen“, Warnfall nur mit Symbol vor dem Tag, Zyklus mit Versions-Schutz, Warnfenster nur beim ersten Klick, Vorgabe → erster Klick, Symbol öffnet nur das Fenster, gemerkt nach Neuaufbau, „Für alle“, „Wer kann?“ und Zauberstab folgen der Vorgabe, Bestehendes bleibt, Abwesenheit und Warnfall als Klassen, Modus in der Zelle), `dienstplaner/src/TerminAnsicht.test.tsx` (Vorgabe gilt auch dort); Gegenproben je Teil einzeln rot; von Hand bleiben das Aussehen (Schraffur, roter Rahmen, Symbol, Hover-Ring) in Hell und Dunkel, am Rechner und am Handy
- **Historie:** Wunsch 2 und Wunsch 1 (Alwin 17.11.2026, Entwurf `e9-p2-modus.html`: Abwesend D, Matrix G4), Scheibe P2m
</details>

### TF-ABLAUF-36 · Hilfe „?“ statt langer Erklär-Absätze

**Das brauchst du:** Dienstplaner als Planer (für „Planen“ und die Termin-Ansicht), am Rechner und am Handy, Hell und Dunkel.

**Das muss passieren:** Unter den Seiten „Planen“, „Dienste“ und in der Termin-Ansicht steht kein langer Erklär-Absatz mehr.
Die Erklärung steht in einem Fenster hinter dem Knopf **„?“**, in kurzen Abschnitten mit zwei, drei Stichpunkten.

1. **Planen:** Unter der Tabelle steht kein Absatz. Rechts in der Werkzeugleiste, neben **Teilen**, steht der Knopf **„?“**
   (Tooltip „Hilfe zu Planen“) – gleich hoch wie die Knöpfe daneben, auch am Handy erreichbar.
2. Antippen → Fenster **„Hilfe · Planen“** mit den Abschnitten „Was du siehst“, „Eintragen“, „Anfrage oder direkt“,
   „Plätze und Zauberstab“, „Senden“, „Filter und Fokus“. Es scrollt, wenn es länger ist als der Bildschirm.
3. Schließen mit dem **X** oben rechts und mit **Esc**; ein Tipp daneben schließt ebenfalls.
4. **Dienste:** Rechts in der Kopfzeile (nach „Teilen“, falls „Meine“ gewählt ist) steht **„?“** → „Hilfe · Dienste“. Die Fußnote
   unter der Liste ist weg.
5. **Termin-Ansicht (nur als Planer):** neben dem Teilen-Symbol steht **„?“** → „Hilfe · Termin“. Ohne Planen-Recht gibt es
   den Knopf nicht.
6. **Bleibt, wo es ist:** kurze Hinweise in Fenstern und an Bedienelementen, Lade-, Fehler- und Leer-Texte und Warnungen
   („Hier liegt ein Entwurf …“, „Abwesenheiten nicht sichtbar“, „Noch keine …“).

<details><summary>Technisches</summary>

- **Priorität:** normal
- **Betrifft:** `ui/bedienung/HilfeKnopf.tsx`, `ui/bedienung/HilfeKnopf.module.scss`, `dienstplaner/src/hilfeTexte.ts`, `dienstplaner/src/Planen.tsx`, `dienstplaner/src/Termine.tsx`, `dienstplaner/src/TerminAnsicht.tsx`
- **Automatisiert:** ja – `ui/bedienung/HilfeKnopf.test.tsx` (Knopf, Fenster, X, Esc), `dienstplaner/src/Planen.test.tsx`, `dienstplaner/src/Termine.test.tsx`, `dienstplaner/src/TerminAnsicht.test.tsx` (Knopf da, Absatz weg, Kernsatz in der Hilfe); Gegenprobe (Knopf raus) rot; von Hand bleibt das Aussehen am Handy und im Dunkeln
- **Historie:** Wunsch Alwin 17.11.2026: „Muss der lange Text da stehen? Das wird niemals jemand lesen.“
</details>

### TF-ABLAUF-37 · Planen: Personen – bestehende Einteilung per Klick bearbeiten

**Das brauchst du:** Dienstplaner als Planer, der Entwürfe anlegen darf (Schublade der Dienstgruppe bereit); ein Termin, an dem
im Ton eine Person **zugesagt**, eine **angefragt** und ein **Gast** eingetragen ist. Dazu ein Konto, das den Dienst nur ansehen
darf (für Schritt 8).

**Das muss passieren:** Ein Klick auf eine bestehende Einteilung öffnet **dasselbe Fenster wie in der Matrix** beim Antippen
des belegten Platzes – keine zweite Logik, kein eigenes Fenster.

1. **Planen → Personen.** Klick auf die Zelle einer **zugesagten** Person (auch auf den Tag in der Zelle): Fenster
   „Ton · Fr, 20.11.“ mit „<Name> – hat zugesagt.“, **Andere Person wählen** und **Zurückziehen**. Genauso bei **angefragt**
   („angefragt, noch keine Antwort.“) und bei einem **Gast** in der Zeile „Gäste“.
2. **Zurückziehen** → Hinweis „<Name> wird beim Senden zurückgezogen – noch nicht gesendet.“ Die Zelle steht jetzt wie in der
   Matrix **rot gestrichelt**, mit rotem „−“ und **durchgestrichenem** Namen (Tooltip „Entwurf, wird zurückgezogen“); unten zählt die Leiste
   „Ansehen und senden“. In der Matrix steht derselbe Platz rot durchgestrichen.
3. **Klick auf die durchgestrichene Zelle** → das Entwurfs-Fenster der Matrix. **Entfernen** nimmt das Zurückziehen zurück: die
   Zelle ist wieder ein normales ✓ und anklickbar wie vorher.
4. Noch einmal die Einteilung anklicken → **Andere Person wählen** → „Wer kann?“ für genau diesen Platz („… statt <Name>“) →
   eine Person wählen. In „Personen“ steht die **neue Person als blauer Entwurf in ihrer Zeile**, die bisherige Person
   **durchgestrichen**. Klick auf die durchgestrichene Zelle öffnet den Ersetzen-Entwurf.
5. Ein **Gast**, den ein Entwurf wegnimmt, steht ebenfalls rot durchgestrichen in der Zeile „Gäste“; Klick → Entwurfs-Fenster.
6. Klick auf den **Namen** der Person setzt weiter den Fokus (kein Fenster); ein Klick auf den **eigenen** Entwurf einer Person
   (blau) bleibt der Zyklus Anfrage → direkt → weg (TF-ABLAUF-35).
7. **Abgesagter Termin:** Wie in der Matrix lässt sich ein belegter Platz dort weiter antippen (zurückziehen/ersetzen); neu
   eintragen geht dort nicht (TF-ABLAUF-33).
8. Konto, das den Dienst **nur ansehen** darf: die Zellen sind keine Knöpfe, ein Klick tut nichts. Dienst **ohne Schublade**
   (Entwürfe nicht bereit): das Fenster am belegten Platz geht auf, nennt Name und Stand und sagt, was fehlt – wie in der
   Matrix; die durchgestrichene Zelle ist dort kein Knopf.
9. **Tastatur:** Tab auf die Zelle, Enter → dasselbe wie der Klick; der Vorleser nennt „Anna Test für Ton am Fr, 20.11.:
   Einteilung öffnen“ bzw. „… Entwurf öffnen“. **Handy:** Antippen genauso, das Fenster passt auf den Bildschirm.

<details><summary>Technisches</summary>

- **Priorität:** hoch
- **Betrifft:** `shared/dienstplan/personenEintragen.ts`, `shared/dienstplan/personenRaster.ts`, `dienstplaner/src/PersonenRaster.tsx`, `dienstplaner/src/PersonenRaster.module.scss`, `dienstplaner/src/_zurueck.scss`, `dienstplaner/src/Planen.module.scss`, `dienstplaner/src/useEinteilen.tsx`, `dienstplaner/src/planSicht.ts`, `dienstplaner/src/hilfeTexte.ts`
- **Automatisiert:** ja – `shared/dienstplan/personenEintragen.test.ts` (Aktion `belegt`/`entwurfFach`, Platz ohne Entwurf, veraltet, `gastAktion`), `shared/dienstplan/personenRaster.test.ts` (Zustand `zurueck` bei Zurückziehen und Ersetzen, kein Warnfall, veraltet, Gast), `dienstplaner/src/Planen.p2b.test.tsx` (Klick → `BelegtFach`, Zurückziehen → durchgestrichen, Klick → `EntwurfFach`, Entfernen, angefragt, Gast, Andere Person wählen → Ersetzen-Entwurf, Fokus-Klick, ohne Recht, ohne Schublade); Gegenproben einzeln rot; von Hand bleibt das Aussehen (Rot gestrichelt, Hell/Dunkel, Handy)
- **Historie:** Wunsch 5 (Alwin 16./17.11.2026, Entwurf `e9-p2-eintragen.html` Fall 7), Scheibe P2b
</details>

### TF-ABLAUF-38 · Planen: Personen – Plätze einstellen und „Platz dazunehmen“

**Das brauchst du:** Dienstplaner als Planer, der Entwürfe anlegen darf; ein Dienst (Ton) mit einem Termin „2 von 3“ (ein Platz offen),
einem **vollen** Termin (2 von 2) und einem vollen Termin, an dem schon ein Entwurf liegt. Dazu ein Konto, das den Dienst nur ansehen darf.

**Das muss passieren:** Plätze lassen sich in „Personen“ sofort einstellen; „Platz dazunehmen“ erhöht den Platz in ChurchTools und
trägt die Person danach als Entwurf ein.

1. **Planen → Personen.** Am Ende des Blocks Ton steht die Zeile **„Plätze“**: je Termin „2 von 3“. Freie Plätze **rot**, voll grau,
   ohne Plätze **„aus“**. Ein Entwurf auf einem freien Platz zählt mit („3 von 3“) – genauso wie bei „Noch offen“.
2. **Klick** auf die Zahl (oder auf den roten Tag in „Noch offen“): Fenster „Plätze – Ton · Fr, 27.11.“ mit − / + und „belegt 2 · Plätze 3 · frei 1“.
   **−** → „Ton: jetzt 2 Plätze.“, **+** mehrmals geht ohne Obergrenze. Es gilt sofort, ChurchTools schickt nichts.
3. **−** ist **aus** (Hinweis „Erst jemanden herausnehmen“), wenn alle Plätze belegt sind. Liegt an Ton an diesem Termin ein **Entwurf**:
   − und + sind aus, „Hier liegt ein Entwurf – erst senden oder entfernen.“
4. Voller Termin, Klick in die leere Zelle einer Person → Fenster „Ton ist voll“ mit „Ton bekommt sofort einen dritten Platz (in
   ChurchTools gespeichert). <Name> wird als Entwurf eingetragen.“ → **Platz dazunehmen (3)**. Ergebnis: Ton hat 3 Plätze (Zeile
   „Plätze“), die Person steht als **Entwurf** in der Zelle, unten zählt die Leiste. In ChurchTools hat Ton jetzt 3 Plätze, die Person
   ist **nicht** eingeteilt.
5. Entwurf wieder wegnehmen: der dritte Platz **bleibt** (so gewollt).
6. Voller Termin **mit Entwurf**: Fenster „Erst senden oder Entwürfe entfernen“ mit **Ansehen und senden** (öffnet die Sende-Liste), kein Dazunehmen.
7. **Abgesagter Termin:** die Zahl steht da, ist aber kein Knopf. Konto **ohne Recht**: ebenfalls keine Knöpfe.
8. **Handy (375 px):** Zeile und Fenster sind benutzbar, nichts läuft aus dem Bild.

<details><summary>Technisches</summary>

- **Priorität:** hoch
- **Betrifft:** `shared/dienstplan/platzNachEntwurf.ts`, `shared/dienstplan/personenRaster.ts`, `shared/dienstplan/personenEintragen.ts`, `dienstplaner/src/PersonenRaster.tsx`, `dienstplaner/src/PlatzFenster.tsx`, `dienstplaner/src/PlatzRegler.tsx`, `dienstplaner/src/PlaetzeFach.tsx`, `dienstplaner/src/useAnzahlSetzen.ts`, `dienstplaner/src/usePlatzDazu.ts`, `dienstplaner/src/Planen.tsx`
- **Automatisiert:** ja – `shared/dienstplan/platzNachEntwurf.test.ts` (`plaetzeStand`), `shared/dienstplan/personenRaster.test.ts` (Zeile „Plätze“, `plaetzeZelleText`), `shared/dienstplan/personenEintragen.test.ts` (`voll` mit `entwuerfe`, `platzDazuText`), `dienstplaner/src/Planen.p2c.test.tsx` (Zeile, Fenster, Sperre, Dazunehmen, Fehlerzweige, Wartezeit, abgesagt, ohne Recht); Gegenproben einzeln rot; von Hand bleibt das Aussehen und der echte ChurchTools-Ablauf
- **Historie:** Wunsch 5 (Alwin 16./17.11.2026, Entwurf `e9-p2-eintragen.html` Fall 6 und 9), Scheibe P2c
</details>

### TF-ABLAUF-39 · Planen: Personen – Gäste von Hand eintragen

**Das brauchst du:** Dienstplaner als Planer, der Entwürfe anlegen darf; ein Dienst (Ton) mit einem Termin mit freien Plätzen, einem
Termin, an dem schon ein Gast steht, einem **vollen** Termin (2 von 2) und einem vollen Termin, an dem schon ein Entwurf liegt. Dazu ein
Konto, das den Dienst nur ansehen darf.

**Das muss passieren:** Ein Gast lässt sich in der Zeile „Gäste“ eintragen – als Entwurf auf einem freien Platz, ohne Anfrage.

1. **Planen → Personen.** Im Block Ton steht die Zeile **„Gäste“** – auch dort, wo noch kein Gast steht. Mit der Maus über eine leere
   Gäste-Zelle: blauer Rahmen und ein **„+“**; abgesagte Termine und Dienste, die du nur ansehen darfst: keine Knöpfe.
2. **Klick** in die leere Zelle: Fenster **„Gast eintragen – Ton · Fr, 20.11.“** mit dem Satz „Zum Beispiel ein Gastprediger …“ und dem
   Feld „z. B. Andreas Reimer“. Mit weniger als 2 Zeichen ist **Als Entwurf eintragen** aus; ab 2 Zeichen an; **Enter** trägt ein.
3. **Als Entwurf eintragen**: Hinweis „<Name> eingetragen – noch nicht gesendet.“, in der Zelle steht der Gast als **blaues Tag mit
   Stift** (durchgezogener Rahmen), die Zeile „Plätze“ und „Noch offen“ zählen ihn mit, unten die Leiste zählt mit. In der Matrix steht
   er auf dem **ersten freien Platz**. In ChurchTools ist noch nichts passiert.
4. Zelle mit Gast: ein kleines **„+“** neben dem Tag trägt einen **weiteren** Gast ein (nächster freier Platz). Klick auf einen
   **bestehenden** Gast: Fenster „Zurückziehen / Andere Person wählen“ (TF-ABLAUF-37); Klick auf einen **Gast-Entwurf**: Entwurfs-Fenster
   mit „Entfernen“.
5. **Voller Termin:** Klick in die leere Gäste-Zelle → dasselbe Fenster mit Feld **und** „Ton am 02.12. ist voll (2 von 2). Platz
   dazunehmen und eintragen?“; der Hauptknopf heißt **Platz dazunehmen (3)** (aus, bis ein Name da ist). Ergebnis: Ton hat 3 Plätze,
   der Gast steht als Entwurf auf dem neuen Platz (TF-ABLAUF-38). **Abbrechen** → nichts.
6. Voller Termin **mit Entwurf**: gleich das Fenster „Erst senden oder Entwürfe entfernen“ mit **Ansehen und senden**, kein Namensfeld.
7. **Handy (375 px):** leere Gäste-Zellen zeigen ein blasses „+“; Antippen öffnet das Fenster, es passt auf den Bildschirm.

<details><summary>Technisches</summary>

- **Priorität:** normal
- **Betrifft:** `shared/dienstplan/personenEintragen.ts`, `dienstplaner/src/PersonenRaster.tsx`, `dienstplaner/src/GastFenster.tsx`, `dienstplaner/src/GastFeld.tsx`, `dienstplaner/src/gastName.ts`, `dienstplaner/src/WerKann.tsx`, `dienstplaner/src/usePlatzDazu.ts`, `dienstplaner/src/useEinteilen.tsx`, `dienstplaner/src/planSicht.ts`
- **Automatisiert:** ja – `shared/dienstplan/personenEintragen.test.ts` (`gastNeuAktion`), `dienstplaner/src/Planen.p2d.test.tsx` (Zeile immer da, Fenster, 2 Zeichen, Platz, „+“, Gast-Tags wie P2b, voll, Dazunehmen, Sperre, Rechte, abgesagt); Gegenproben einzeln rot; von Hand bleibt das Aussehen und der echte ChurchTools-Ablauf
- **Historie:** Wunsch 5 (Alwin 16./17.11.2026, Entwurf `e9-p2-eintragen.html` Fall 8), Scheibe P2d
</details>

### TF-ABLAUF-40 · Planen: alle Entwürfe auf einmal verwerfen

**Das brauchst du:** Dienstplaner als Planer einer Dienstgruppe; in „Planen“ mindestens drei Entwürfe (z. B. zwei eigene über
„Wer kann?“ und ein Gast), am besten dazu einer von einer **anderen** Person, die dieselbe Gruppe plant. Nichts senden.

**Das muss passieren:** Wer neu anfangen will, wirft mit einem Knopf alle Entwürfe weg – ohne jede Person einzeln
herauszunehmen. In ChurchTools ändert sich dabei nichts.

1. Unten die Leiste **„N Entwürfe noch nicht gesendet“** mit rotem **Alle verwerfen** links neben **Ansehen und senden**.
2. **Alle verwerfen** → Rückfrage **„Alle N Entwürfe verwerfen?“**: „Die Entwürfe werden gelöscht, ohne gesendet zu werden – in
   ChurchTools ändert sich nichts.“; liegt ein fremder darunter, steht dort „1 davon stammt von anderen Planern.“; zum Schluss
   „Das lässt sich nicht rückgängig machen.“ **Abbrechen** (oder Escape) → nichts passiert, alle Entwürfe bleiben.
3. Noch einmal, dann **Verwerfen** → der Knopf heißt kurz „Wird verworfen …“, danach Hinweis **„N Entwürfe verworfen.“**; die
   Matrix zeigt wieder „frei“, die Leiste ist weg, auch die Entwürfe des anderen Planers sind fort. Bei ihm verschwinden sie nach
   dem Neuladen.
4. In ChurchTools (Termin ansehen) steht niemand neu und niemand ist weg; Mitteilungen gehen keine raus.
5. **Termin-Ansicht** mit Entwürfen an diesem und an einem anderen Termin: **Alle verwerfen** nimmt nur die dieses Termins, der
   andere steht in „Planen“ weiter da.
6. **Handy (375 px):** Leiste „N Entwürfe · Verwerfen · Ansehen & senden“ passt in eine Zeile.

<details><summary>Technisches</summary>

- **Priorität:** normal
- **Betrifft:** `dienstplaner/src/useEinteilen.tsx`, `dienstplaner/src/Planen.module.scss`, `dienstplaner/src/planEntwuerfe.ts`, `dienstplaner/src/ladeEntwuerfe.ts`
- **Automatisiert:** ja – `dienstplaner/src/Planen.test.tsx` (Rückfrage, alle gezählten entfernt samt fremden, mit Version, neu geladen, Bescheid; Abbrechen; Konflikt lässt die anderen weiterlaufen), Leisten-Texte in `Planen.test.tsx` und `TerminAnsicht.test.tsx`; vier Gegenproben einzeln rot; von Hand bleibt das Aussehen und der echte ChurchTools-Ablauf
- **Historie:** Wunsch Alwin 18.11.2026 („komplett zurücksetzen, nicht alle Personen einzeln“), Knopf in der Leiste, auch fremde Entwürfe
</details>
