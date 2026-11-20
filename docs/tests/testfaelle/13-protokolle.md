# Protokolle

Die Erweiterung „Protokolle“ (Kürzel `protokolle`, Anleitung `docs/betrieb/PROTOKOLLE.md`). Getestet wird in der
**Test-Instanz**, nie in der Live-Instanz der Gemeinde, und nur mit eigenen Test-To-Dos (Text beginnt mit „TEST“). Das
Paket baut `npm run build -w protokolle` und `npm run paket -w protokolle`; hochladen unter **Administration →
Erweiterungen → Stift beim Modul → ZIP-Datei**.

### TF-PROT-01 · To-Do im Board mit dem Finger ziehen

**Das brauchst du:** Ein iPhone oder iPad, in der Test-Instanz eine Gruppe mit Protokollen und darin zwei eigene
Test-To-Dos (z. B. „TEST Ziehen A“ und „TEST Ziehen B“, beide „Offen“).

**Das muss passieren:** Ein kurzes Wischen über die Karten blättert nur die Seite – keine Karte geht mit. Erst wenn der
Finger etwa eine halbe Sekunde liegt, hebt sich die Karte an. Das Bild unter dem Finger ist **genauso breit wie die
Karte**, der Text darin bricht nicht anders um. Nach dem Loslassen in einer anderen Spalte steht das To-Do dort, auch
nach dem Neuladen.

1. In ChurchTools im Menü auf **Protokolle**, unten auf **To-Dos**.
2. Oben **Board** wählen (im **Filter** steht „Spalten nach“ auf **Status**).
3. Mit dem Finger schnell über die Karten in „Offen“ wischen: Die Seite blättert, keine Karte bewegt sich.
4. Auf „TEST Ziehen A“ den Finger legen und liegen lassen, bis die Karte sich anhebt.
5. In die Spalte **In Arbeit** ziehen und loslassen: Die Karte steht dort.
6. Die Seite neu laden: „TEST Ziehen A“ steht weiter in „In Arbeit“.
7. Oben **Filter → Reihenfolge → Manuell** wählen und in „Offen“ „TEST Ziehen B“ über eine andere Karte ziehen: Die Reihenfolge
   ändert sich und bleibt nach dem Neuladen.
8. Am iPhone die Werkzeugzeile ansehen: links **Liste ⌄** (blau hinterlegt), rechts das **Filter**-Symbol und das grüne **+**, alles mit
   Rahmen in einer Zeile; kein Wort ist abgeschnitten. Das Filter-Fenster antippen: Es steht ganz im Bild (nicht abgeschnitten) und enthält
   „Spalten nach“, „Reihenfolge“, „Zuständig“ (mit **Alle** und **Nur meine**) und „Gruppen“. Nach „Manuell“ steht keine Zahl am Filter – nur
   ausgeblendete To-Dos zählen.

<details><summary>Technisches</summary>

- **Priorität:** hoch
- **Betrifft:** `protokolle/src/ToDoZiehen.tsx`, `protokolle/src/toDoZiehenRegel.ts`, `protokolle/src/ToDos.tsx`, `protokolle/src/ToDos.module.scss`, `ui/bedienung/useZiehSensoren.ts`, `ui/bedienung/FilterKnopf.tsx`, `ui/bedienung/useMenueImBild.ts`
- **Automatisiert:** teilweise – `ui/bedienung/FilterKnopf.test.tsx`, `ui/bedienung/menueLage.test.ts` (Wort ausblendbar, Menü rückt ins Bild), `protokolle/src/toDoZiehenRegel.test.ts`, `protokolle/src/ToDoZiehen.test.tsx`, `protokolle/src/ToDos.board.test.tsx`, `ui/bedienung/useZiehSensoren.test.ts` (Regeln und Sensoren); das echte Liegenlassen des Fingers und die Breite des Zieh-Bilds nur am Gerät
- **Historie:** #811 (30.10.2026: Zieh-Bild am iPhone breiter als die Karte; ein To-Do mit zwei Zuständigen verlor beim Umordnen eine Person; 18.11.2026: „Sortieren“ am Handy abgeschnitten, sein Menü ragte links aus dem Bild, „+“ stand allein in einer Zeile; 20.11.2026 B6: „Sortieren“ und „Gruppieren“ liegen im Filter-Fenster, `WahlKnopf` entfällt)

</details>

### TF-PROT-02 · Die Einstellungen der To-Do-Seite kommen auf dem zweiten Gerät an

**Das brauchst du:** Zwei Geräte mit demselben ChurchTools-Konto (z. B. iPhone und iPad oder Laptop).

**Das muss passieren:** Was man auf dem einen Gerät einstellt – Liste oder Board, Einteilung nach Status oder Person,
Reihenfolge, Filter, die eigene Reihenfolge –, steht nach kurzer Zeit auch auf dem anderen Gerät so da. Ohne Netz bleibt
die Einstellung auf dem Gerät und geht mit, sobald das Netz wieder da ist.

1. Auf Gerät 1 im Menü auf **Protokolle**, unten auf **To-Dos**.
2. Oben **Board**, im **Filter** **Spalten nach → Person** und **Reihenfolge → Alphabetisch** wählen.
3. Ein paar Sekunden warten.
4. Auf Gerät 2 die To-Dos öffnen (bzw. neu laden): Board, Person und Alphabetisch sind eingestellt.
5. Auf Gerät 2 zurück auf **Liste** stellen, auf Gerät 1 neu laden: Gerät 1 zeigt die Liste.

<details><summary>Technisches</summary>

- **Priorität:** normal
- **Betrifft:** `protokolle/src/useToDoEinstellungen.ts`, `protokolle/src/todoEinstellungen.ts`, `shared/ct/personenAblage.ts`, `ui/ct/ablagePort.ts`
- **Automatisiert:** teilweise – `protokolle/src/useToDoEinstellungen.test.ts` (wann abgeglichen wird, nichts geht verloren), `shared/ct/personenAblage.daten.test.ts` (Zusammenführen, Ersetzen); das Zusammenspiel zweier echter Geräte nur von Hand
- **Historie:** #811 (S7-3, 30.10.2026)

</details>

### TF-PROT-03 · Geteiltes Gerät: die zweite Person bekommt nicht die Einstellungen der ersten

**Das brauchst du:** Ein Gerät und zwei Personen. In der Test-Instanz geht „Person simulieren“ (nur mit der Testperson,
nie mit echten Gemeindegliedern).

**Das muss passieren:** Die zweite Person sieht die To-Do-Seite in **ihrer** Einstellung (beim ersten Mal: Liste, nach
Status) – nicht in der der ersten. An ihrem Konto entsteht dabei keine Einstellungs-Datei mit den Werten der ersten
Person.

1. Als Person A die To-Dos öffnen und **Board** und im Filter **Spalten nach → Person** wählen, ein paar Sekunden warten.
2. Als Person B anmelden (oder B simulieren), im Menü auf **Protokolle**, unten auf **To-Dos**.
3. B sieht ihre eigene Einstellung, nicht Board/Person von A.
4. Zurück als A: Board und Person sind wieder da.

<details><summary>Technisches</summary>

- **Priorität:** normal
- **Betrifft:** `protokolle/src/useToDoEinstellungen.ts`
- **Automatisiert:** ja – `protokolle/src/useToDoEinstellungen.test.ts` („je Person …“, „Übernahme aus S7-1 einmal“); von Hand bleibt der echte Personenwechsel in ChurchTools
- **Historie:** #811 (30.10.2026: Spiegel im Gerät war je Browser statt je Person – B bekam As Einstellungen, auch in seine Datei); dieselbe Lücke in der Musik-App: TF-AUTH-09, #813

</details>

### TF-PROT-04 · Werkzeugleiste am iPhone: Farbe und Textart treffen den markierten Text

**Das brauchst du:** Ein iPhone, in der Test-Instanz ein eigenes Test-Protokoll im Entwurf (Titel beginnt mit „TEST“).

**Das muss passieren:** Die Leiste zeigt vorn Rückgängig, Wiederholen, **B** und **Aa**, dahinter drei Zeichen mit
Pfeil (Stift, Zeilen, Plus) – nichts ragt rechts hinaus. Ein Menü klappt unter seinem Zeichen auf und passt auf den
Bildschirm. Tippt man darin eine Farbe oder Textart, wirkt sie **auf den vorher markierten Text** – die Markierung geht
beim Tippen ins Menü nicht verloren.

1. In ChurchTools im Menü auf **Protokolle**, das Test-Protokoll öffnen (Schreiben).
2. Ins Blatt doppeltippen, um zu schreiben: Die Seite **zoomt nicht** hinein. Danach in einer Zeile ein Wort markieren
   (lange drücken, Griffe ziehen).
3. Auf den **Stift** tippen: Das Menü zeigt „Hintergrund“ und „Schrift“ mit je zehn Feldern.
4. Unter „Hintergrund“ **Grün** tippen: Das Menü geht zu, das Wort ist grün hinterlegt.
5. Das Wort wieder markieren, Stift, unter „Schrift“ **Rot**: Das Wort ist rot.
6. In eine leere Zeile tippen, **Aa → Unterpunkt**: Die Zeile ist eine kleine Überschrift.
7. **Plus → Tabelle**: Eine Tabelle mit drei Spalten und fett gesetzter Kopfzeile erscheint.
8. **Plus → Termin**, ein Datum wählen und einen langen Text tippen (auch ein langes Wort ohne Leerzeichen): Das Datum
   steht links, der Text bricht **daneben** im blauen Kasten um – keine Buchstabensäule rechts, die Seite lässt sich
   nicht seitlich schieben.
9. Oben **Lesen**: Grün, Rot, die Tabelle und der Termin sehen aus wie im Editor.

<details><summary>Technisches</summary>

- **Priorität:** hoch
- **Betrifft:** `protokolle/src/Werkzeugleiste.tsx`, `protokolle/src/Werkzeugleiste.module.scss`, `protokolle/src/farben.ts`, `protokolle/src/tabelleEinfuegen.ts`, `protokolle/src/ProtokollAnsicht.tsx`, `protokolle/src/EditorBloecke.module.scss`, `protokolle/src/ProtokollAnsicht.module.scss`, `ui/fenster/tippZoom.ts`
- **Automatisiert:** teilweise – `protokolle/src/Werkzeugleiste.test.tsx` (Menüs, Farben, Tabelle, Handy-Aufbau mit echtem Editor), `protokolle/src/editorSchema.test.tsx`, `protokolle/src/farben.test.ts`, `ui/fenster/tippZoom.test.ts`; ob die Markierung beim Tippen am iPhone erhalten bleibt und wie der Termin umbricht, nur am Gerät
- **Historie:** K3a (04.11.2026: Leiste in Gruppen, Variante B; am iPhone gefunden: Termin-Text 0 px breit als Buchstabensäule neben dem Kasten – die Handy-Regel der To-Do-Schildchen galt für alle Schildchen, seit S4-2; Safari zoomte beim Antippen leicht hinein – Schrift unter 16 px, jetzt `maximum-scale=1` auf iOS in allen Apps)

</details>

### TF-PROT-05 · Unterpunkte: Tab macht 4.1, die Nummern stehen überall gleich

**Das brauchst du:** Einen Rechner mit Tastatur, in der Test-Instanz ein eigenes Test-Protokoll im Entwurf (Titel
beginnt mit „TEST“) mit vier Tagesordnungspunkten, unter dem vierten ein Beschluss.

**Das muss passieren:** Tab macht aus einem Tagesordnungspunkt einen Unterpunkt mit Nummer (4.1, 4.1.1 …), Umschalt+Tab
wieder einen Punkt. Der Punkt rutscht dabei nicht eingerückt unter den Text davor. Editor, Lesen, Bereiche und Suche
zeigen dieselbe Nummer.

1. In ChurchTools im Menü auf **Protokolle**, das Test-Protokoll öffnen (Schreiben).
2. Cursor in den **ersten** Tagesordnungspunkt, **Tab**: Nichts passiert, er bleibt „1.“.
3. Cursor in den **vierten** Punkt, **Tab**: Er heißt jetzt „3.1“, steht bündig wie vorher, nur kleiner. Unten unter
   „Beschlüsse“ steht beim Beschluss **„Punkt 3.1 · …“**.
4. Gleich nochmal **Tab**: Nichts passiert (über „3.1“ steht kein Unterpunkt, unter den er rücken könnte). In den dritten
   Punkt, Tab: „2.1“; zurück in den vierten, Tab: **„2.1.1“**.
5. **Umschalt+Tab** zweimal auf dem Punkt „2.1.1“: erst „2.2“, dann wieder **„3.“**.
6. Drei Textzeilen unter einem Punkt markieren, **Tab**: Alle drei rücken gemeinsam ein; Umschalt+Tab holt sie zurück.
7. Einen Punkt wieder zu „3.1“ machen, oben **Lesen**: Dort steht „3.1“ mit demselben Titel. Speichern abwarten, dann
   die **Lupe**, ein Wort aus dem Beschluss suchen: Der Treffer nennt „Punkt 3.1 · …“; ein Klick springt zum Unterpunkt.
8. Am Handy: dasselbe über **Zeilen ▾ → Einrücken / Ausrücken**.

<details><summary>Technisches</summary>

- **Priorität:** hoch
- **Betrifft:** `shared/protokolle/dokument.ts`, `shared/protokolle/abschnitte.ts`, `protokolle/src/einruecken.ts`, `protokolle/src/punktNummern.ts`, `protokolle/src/editorSchema.ts`, `protokolle/src/Werkzeugleiste.tsx`, `protokolle/src/ProtokollAnsicht.tsx`, `protokolle/src/Bereiche.tsx`, `protokolle/src/Suche.tsx`
- **Automatisiert:** ja – `protokolle/src/einruecken.test.ts` (Tab mit dem echten Editor), `protokolle/src/punktNummern.test.ts`, `shared/protokolle/dokument.test.ts`, `shared/protokolle/abschnitte.test.ts`, `protokolle/src/Werkzeugleiste.test.tsx`, `protokolle/src/ProtokollAnsicht.test.tsx`; die Gegenprobe zeigt: ohne die eigene Tab-Taste rücken auch dort mehrere markierte Zeilen nicht ein
- **Historie:** K3b-1 (04.11.2026: Tab auf einem Tagesordnungspunkt hängte ihn als Kind unter den Block davor – Nummer weg, Beschlüsse darunter zählten zum Punkt davor; markierte Zeilen ließen sich nicht einrücken)

</details>

### TF-PROT-06 · Früheres Protokoll wählen, ansehen und öffnen

**Das brauchst du:** In der Test-Instanz ein eigenes Test-Protokoll im Entwurf (Titel beginnt mit „TEST“) in einer Gruppe
mit mindestens zwei freigegebenen Protokollen.

**Das muss passieren:** Einfügen fragt, welches Protokoll; der Titel passt zur Wahl. „Ändern“ wählt ein anderes,
„Ansehen“ zeigt es im kleinen Fenster, „Öffnen“ springt dorthin, „Zurück“ wieder zum Test-Protokoll.

1. In ChurchTools im Menü auf **Protokolle**, das Test-Protokoll öffnen (Schreiben).
2. In eine leere Zeile, **Einfügen → Früheres Protokoll**: Ein Fenster listet die freigegebenen Protokolle, neueste oben,
   das letzte ist gewählt und als „letzte Sitzung“ markiert.
3. Ein **älteres** wählen, **Einfügen**: Der neue Punkt heißt „Protokoll vom …“ mit dessen Datum, der Kasten zeigt es.
4. Am Kasten des Punkts „Protokoll der letzten Sitzung“ aus der Vorlage steht „immer die letzte Sitzung“. **Ändern** →
   ein anderes wählen → **Übernehmen**: Titel und Kasten wechseln.
5. **Ansehen**: Das kleine Fenster zeigt das Protokoll. **Öffnen**: Die Seite wechselt zu diesem Protokoll (vorher wird
   gespeichert).
6. Oben **Sitzungen** (Zurück): Man ist wieder im Test-Protokoll, nicht in der Liste.
7. Am Handy: Beim Kasten stehen „Ändern“ und „Ansehen“ unter dem Text, der Text steht lesbar in einer Zeile.

<details><summary>Technisches</summary>

- **Priorität:** hoch
- **Betrifft:** `shared/protokolle/festePunkte.ts`, `protokolle/src/fruehesProtokoll.ts`, `protokolle/src/FruehesWahl.tsx`, `protokolle/src/FestePunkteRahmen.tsx`, `protokolle/src/FesterPunkt.tsx`, `protokolle/src/EditorBloecke.tsx`, `protokolle/src/ProtokollSchreiben.tsx`, `protokolle/src/Sitzungen.tsx`
- **Automatisiert:** ja – `protokolle/src/fruehesProtokoll.test.tsx` (Einfügen, Ändern, Ansehen, Öffnen mit dem echten Editor), `protokolle/src/Sitzungen.test.tsx` (Öffnen und Zurück), `protokolle/src/ProtokollSchreiben.test.tsx` (erst speichern und Sperre lösen), `shared/protokolle/festePunkte.test.ts`; wie der Kasten am Handy umbricht, nur am Gerät
- **Historie:** K3b-2 (05.11.2026)

</details>

### TF-PROT-07 · Anwesenheit: von selbst vorbelegt, tippen, Gäste, Gruppentreffen anlegen

**Das brauchst du:** In der Test-Instanz ein eigenes Test-Protokoll im Entwurf (Titel beginnt mit „TEST“), dessen Termin
Zu- und Absagen hat; für den zweiten Teil eins ohne Gruppentreffen. Nach dem Test in ChurchTools am Gruppentreffen
nachsehen.

**Das muss passieren:** Der Punkt „Anwesenheit“ zeigt alle Mitglieder; Zusagen sind anwesend, Absagen abwesend. Jeder
Tipp steht sofort im ChurchTools-Gruppentreffen, nochmal tippen macht wieder offen. Gäste stehen nur im Protokoll.

1. In ChurchTools im Menü auf **Protokolle**, das Test-Protokoll öffnen (Schreiben).
2. Im Punkt **Anwesenheit**: Wer zugesagt hat, steht auf „Anwesend“, wer abgesagt hat, auf „Abwesend“, der Rest ist offen.
   Oben steht „Anwesend n · Abwesend n · Offen n“.
3. Bei einer zugesagten Person **Abwesend** tippen; bei einer offenen **Anwesend**. Die Liste springt dabei nicht.
4. Bei der anwesenden Person nochmal **Anwesend** tippen: wieder offen.
5. **Gast hinzufügen** – einen Namen eintippen, **Hinzufügen**: Er steht als „Gast“ in der Liste; mit × wieder weg.
6. Oben **Lesen**: Der Punkt ist zugeklappt und zeigt „Anwesend (n): … · Abwesend: … · Gäste: …“.
7. In ChurchTools die Gruppe → Gruppentreffen dieses Tages öffnen: Dort steht dieselbe Anwesenheit, die Gäste nicht.
8. Im Test-Protokoll ohne Gruppentreffen: Der Punkt sagt „noch kein Gruppentreffen“ – **Gruppentreffen anlegen**: Die
   Mitglieder erscheinen; keine Mail.

<details><summary>Technisches</summary>

- **Priorität:** hoch
- **Betrifft:** `shared/protokolle/anwesenheit.ts`, `protokolle/src/anwesenheitSchreiben.ts`, `protokolle/src/Anwesenheit.tsx`, `protokolle/src/FesterPunkt.tsx`, `protokolle/src/EditorBloecke.tsx`, `protokolle/src/FestePunkteRahmen.tsx`, `protokolle/src/ProtokollSchreiben.tsx`, `protokolle/src/schreiben.ts`, `shared/protokolle/einrichten.ts`, `shared/protokolle/vorlagen.ts`
- **Automatisiert:** ja – `protokolle/src/Anwesenheit.test.tsx` (mit dem ChurchTools-Nachbau: Vorbelegung, Tippen, Gäste, Treffen anlegen, abgeschlossen, Lesen), `protokolle/src/anwesenheitSchreiben.test.ts`, `shared/protokolle/anwesenheit.test.ts`, `protokolle/src/schreiben.test.ts`, `protokolle/src/ProtokollSchreiben.test.tsx`; ob Nicht-Admins mit 10124/10111 eintragen dürfen, nur in der Test-Instanz mit einer Leitungsperson ohne Admin-Rechte
- **Historie:** S5-3 (05.11.2026)

</details>

### TF-PROT-08 · Punkt vorschlagen, übernehmen, ablehnen, direkt eintragen

**Das brauchst du:** In der Test-Instanz die Testgruppe mit einer kommenden Sitzung und einem eigenen Test-Protokoll im
Entwurf (Titel beginnt mit „TEST“), dazu eine zweite Person ohne Leitung (z. B. „Benutzer simulieren“). Danach die
Test-Vorschläge zurückziehen bzw. das Test-Protokoll aufräumen.

**Das muss passieren:** Ein Mitglied schlägt einen Punkt vor und sieht ihn mit Stand. Die Leitung übernimmt ihn beim
Schreiben – er steht vor „Verschiedenes“ mit „vorgeschlagen von …“ – oder lehnt ab; wer vorschlug, sieht die
Begründung. Bei „Direkt eintragen“ steht der Punkt beim Öffnen schon drin, nie doppelt.

1. Als Mitglied in ChurchTools auf **Protokolle** → Reiter **Sitzungen** → grüner Knopf **Neu ⌄** → **Punkt vorschlagen**.
2. Sitzung lassen, Thema „TEST Vorschlag“ eintippen, **Vorschlagen**: Er steht in der Karte „Vorschläge“ unter seiner
   Sitzung (eine Zeile mit Titel). Antippen klappt ihn auf: **Ändern** und **Zurückziehen** stehen erst dort; in der
   Sitzungszeile steht „1 Vorschlag offen“.
3. Als Leitung das Test-Protokoll öffnen (Schreiben): Oben steht „Vorschläge · 1“. **Übernehmen**: Der Punkt steht vor
   „Verschiedenes“, darunter „vorgeschlagen von …“; oben „gespeichert“. Der Kasten ist weg.
4. Zurück zu „Sitzungen“: Der Vorschlag steht nicht mehr in der Karte; die Sitzung in „Kommend“ zeigt „1 Vorschlag
   übernommen“. Den Kopf der Karte antippen: Sie klappt zu, nach dem Neuladen bleibt sie zu.
5. Einen zweiten Vorschlag als Mitglied machen; als Leitung im Protokoll **Ablehnen** mit einem Satz. Als Mitglied:
   in der Karte unter „Abgelehnt · verschwindet nach 7 Tagen“ steht „Grund: …“ und „noch 7 Tage sichtbar“, aufgeklappt
   die ganze Begründung, kein Ändern mehr. Ein anderes Mitglied sieht ihn nicht. Das **×** blendet ihn aus.
6. In den Einstellungen die Gruppe auf **Direkt eintragen** stellen, als Mitglied einen dritten Vorschlag machen, als
   Leitung das Protokoll öffnen: Der Punkt steht schon drin, oben „Ein Vorschlag wurde … eingefügt“. Zurück und noch
   einmal öffnen: nicht doppelt. Die Gruppe danach wieder auf **Vorschlagen** stellen.

<details><summary>Technisches</summary>

- **Priorität:** normal
- **Betrifft:** `shared/protokolle/vorschlaege.ts`, `protokolle/src/vorschlaegeSchreiben.ts`, `protokolle/src/mitarbeitWerte.ts`, `protokolle/src/Vorschlaege.tsx`, `protokolle/src/vorschlaegeMerken.ts`, `protokolle/src/VorschlagFenster.tsx`, `protokolle/src/Sitzungen.tsx`, `protokolle/src/ProtokollSchreiben.tsx`, `protokolle/src/DokumentEditor.tsx`, `protokolle/src/lesen.ts`
- **Automatisiert:** ja – `shared/protokolle/vorschlaege.test.ts` (Ziel, Weiterrutschen, Stände, Karte nur mit Offenen, übernommen je Sitzung, Abgelehnt 7 Tage und Sichtbarkeit, Einklapp-Standard, Einfügestelle), `protokolle/src/vorschlaegeSchreiben.test.ts` und `protokolle/src/lesen.test.ts` (mit dem ChurchTools-Nachbau), `protokolle/src/Sitzungen.test.tsx` (Kurzform, Einklappen mit und ohne Gerätespeicher, Abgelehnt, ×), `protokolle/src/ProtokollSchreiben.test.tsx` (einfügen, erst gespeichert dann vermerkt, nicht doppelt, Speichern scheitert); ob Mitglieder ohne Leitung in „Mitarbeit“ schreiben dürfen, nur in der Test-Instanz
- **Historie:** S5-4 (06.11.2026)

</details>

### TF-PROT-09 · Protokoll freigeben und die Freigabe zurücknehmen

**Das brauchst du:** In der Test-Instanz ein eigenes Test-Protokoll im Entwurf (Titel beginnt mit „TEST“) mit einem
Gruppentreffen, bei dem jemand noch „offen“ ist, und einem To-Do ohne Zuständigen. Danach Test-Protokoll und Treffen
aufräumen.

**Das muss passieren:** Das Fenster nennt die offene Anwesenheit und das To-Do ohne Zuständigen, freigeben geht
trotzdem. Danach ist das Protokoll fest, das Gruppentreffen abgeschlossen, oben „freigegeben am … von …“. Zurücknehmen
macht es wieder zum Entwurf mit Vermerk; das Treffen bleibt abgeschlossen.

1. In ChurchTools auf **Protokolle** → **Sitzungen** → das Test-Protokoll öffnen (Schreiben).
2. Oben **Freigeben**: Das Fenster zeigt „Anwesenheit: 1 noch offen – geprüft?“ mit dem Namen und „1 To-Do ohne
   Zuständigen“. **Ansehen** beim To-Do: Fenster zu, das To-Do ist im Blick.
3. Noch einmal **Freigeben** → **Freigeben**: Das Protokoll öffnet sich zum Lesen, oben „freigegeben am … von <dein Name>“.
4. In ChurchTools die Gruppe → Gruppentreffen dieses Tages: abgeschlossen, Kommentar (falls vorhanden) noch da.
5. Zurück in den Protokollen: **Freigabe zurücknehmen** → **Zurücknehmen**: Der Editor öffnet sich, darüber „Freigabe
   zurückgenommen am … von … – vorher freigegeben am … von …“.
6. Als Mitglied ohne Leitung (z. B. Spike): bei einem freigegebenen Protokoll kein „Freigabe zurücknehmen“.

<details><summary>Technisches</summary>

- **Priorität:** hoch
- **Betrifft:** `shared/protokolle/freigabe.ts`, `shared/protokolle/festePunkte.ts`, `protokolle/src/schreiben.ts`, `protokolle/src/anwesenheitSchreiben.ts`, `protokolle/src/FreigabeFenster.tsx`, `protokolle/src/FreigabeVermerk.tsx`, `protokolle/src/ProtokollSchreiben.tsx`, `protokolle/src/SitzungAnsicht.tsx`, `protokolle/src/Sitzungen.tsx`
- **Automatisiert:** ja – `shared/protokolle/freigabe.test.ts` (Hinweise, Kopf, Verlauf, Vermerk, Festhalten/Lösen), `protokolle/src/schreiben.test.ts` und `protokolle/src/anwesenheitSchreiben.test.ts` (mit dem ChurchTools-Nachbau: Reihenfolge, Abweisung, Nachlesen, Treffen ganz zurück), `protokolle/src/ProtokollSchreiben.test.tsx`, `protokolle/src/Sitzungen.test.tsx`; ob Nicht-Admins mit 10124 abschließen dürfen, nur in der Test-Instanz
- **Historie:** S6-1 (11.11.2026)

</details>

### TF-PROT-10 · Beim Freigeben in der Gruppe Bescheid geben

**Das brauchst du:** In der Test-Instanz ein eigenes Test-Protokoll im Entwurf (Titel beginnt mit „TEST“) in einer
Gruppe, deren Typ Beiträge erlaubt und in der du „Beitrag gruppenintern erstellen“ hast, dazu ein Test-Protokoll in
Gruppe 194 (Typ „Anmeldung“, ohne Beiträge). Danach Beitrag und Test-Protokolle aufräumen. Achtung: Ein Beitrag kann
die Mitglieder der Gruppe benachrichtigen – nur in einer Gruppe nur mit dir (und Spike) testen.

**Das muss passieren:** Wo Beiträge gehen, hat das Freigabe-Fenster das Häkchen „In der Gruppe Bescheid geben“ (an) mit
Vorschau; nach dem Freigeben steht der Beitrag in der Gruppe, und „Protokoll öffnen“ führt direkt in die Sitzung. In
Gruppe 194 gibt es kein Häkchen.

1. In ChurchTools auf **Protokolle** → **Sitzungen** → das Test-Protokoll der Gruppe mit Beiträgen öffnen → **Freigeben**.
2. Das Fenster zeigt **In der Gruppe Bescheid geben** (Häkchen an) und darunter „Protokoll vom … ist freigegeben“.
   Häkchen aus: Die Vorschau verschwindet. Wieder an.
3. **Freigeben**: Das Protokoll öffnet sich zum Lesen.
4. In ChurchTools die Gruppe → **Beiträge**: „Protokoll vom … ist freigegeben“ von dir, darunter der Satz und der Link
   „Protokoll öffnen“; Kommentare sind aus.
5. **Protokoll öffnen** antippen: Die Protokolle öffnen sich direkt bei dieser Sitzung; die Adresse endet danach auf
   `#/sitzungen`.
6. Test-Protokoll in Gruppe 194 → **Freigeben**: kein Häkchen „In der Gruppe Bescheid geben“.

<details><summary>Technisches</summary>

- **Priorität:** normal
- **Betrifft:** `shared/protokolle/beitrag.ts`, `protokolle/src/beitragSchreiben.ts`, `protokolle/src/FreigabeFenster.tsx`, `protokolle/src/ProtokollSchreiben.tsx`, `protokolle/src/reiter.ts`, `protokolle/src/App.tsx`
- **Automatisiert:** ja – `shared/protokolle/beitrag.test.ts` (Text, Markdown, `/post/groups`), `protokolle/src/beitragSchreiben.test.ts` (mit dem ChurchTools-Nachbau: anlegen und nachlesen, abgelehnt, unklar, Nachlesen scheitert, nicht übernommen), `protokolle/src/ProtokollSchreiben.test.tsx` (Häkchen, Vorschau, „Nochmal versuchen“ nur für Wiederholbares), `protokolle/src/reiter.test.ts`, `protokolle/src/App.test.tsx` (Direktlink); wie der Beitrag in ChurchTools aussieht und benachrichtigt, nur in der Test-Instanz
- **Historie:** S6-2 (11.11.2026)

</details>

### TF-PROT-11 · Protokoll als PDF teilen

**Das brauchst du:** In der Test-Instanz ein eigenes Test-Protokoll im Entwurf (Titel beginnt mit „TEST“) mit
Gruppentreffen, einem Beschluss, einem To-Do mit Zuständigem und Bis, einem Termin, etwas Fett/Kursiv/Textmarker und
einer festgelegten nächsten Sitzung, dazu ein freigegebenes Protokoll. Danach die Test-Protokolle aufräumen.

**Das muss passieren:** „Teilen / PDF“ gibt es oben in jeder Sitzung mit Protokoll – auch für Mitglieder ohne Leitung.
Das Fenster „Protokoll teilen“ zeigt die Seiten; das PDF hat Kopf, Inhalt wie beim Lesen und am Ende die Übersicht. Ein
Entwurf trägt „ENTWURF“ im Kasten, als Wasserzeichen und im Dateinamen; ein freigegebenes Protokoll nichts davon.

1. In ChurchTools auf **Protokolle** → **Sitzungen** → das Test-Protokoll im Entwurf öffnen (Schreiben) → **Teilen / PDF**.
2. Das Fenster „Protokoll teilen“ zeigt „Fertig · N Seiten · Protokoll <Gruppe> <JJJJ-MM-TT> ENTWURF.pdf“ und die
   Seiten: oben der Kasten „ENTWURF – NOCH NICHT FREIGEGEBEN“, schräg ein blasses „ENTWURF“ auf jeder Seite.
3. Im PDF stehen Anwesenheit (Kurzform), Punkte mit Nummern, der Beschluss grün, das To-Do mit Wer und Bis (ohne
   Status), der Termin blau, Fett/Kursiv/Textmarker wie im Editor; am Ende „Übersicht“ mit Beschlüssen, To-Dos,
   Terminen (je mit Punkt) und der nächsten Sitzung.
4. Etwas im Editor tippen und gleich **Teilen / PDF**: Das Getippte steht schon im PDF.
5. **Herunterladen**: Die Datei heißt wie angezeigt, das Fenster bleibt offen, „Heruntergeladen“ steht dabei. Am iPad
   oder Handy: **Teilen** öffnet das Teilen-Menü.
6. Das freigegebene Protokoll öffnen → **Teilen / PDF**: oben „Freigegeben am … von …“, kein Kasten, kein Wasserzeichen,
   kein „ENTWURF“ im Dateinamen.
7. Als Mitglied ohne Leitung (z. B. Spike) dasselbe freigegebene Protokoll: **Teilen / PDF** ist da; bei To-Dos stehen
   Namen oder „eine weitere Person“, nie „noch niemand“, wenn jemand zuständig ist.

<details><summary>Technisches</summary>

- **Priorität:** normal
- **Betrifft:** `shared/protokolle/protokollBlatt.ts`, `ui/teilen/protokollPdf.ts`, `ui/teilen/pdfSatz.ts`, `protokolle/src/ProtokollTeilenFenster.tsx`, `protokolle/src/ProtokollTeilen.tsx`, `protokolle/src/SitzungAnsicht.tsx`, `protokolle/src/ProtokollSchreiben.tsx`, `protokolle/src/Sitzungen.tsx`, `protokolle/src/App.tsx`
- **Automatisiert:** ja – `shared/protokolle/protokollBlatt.test.ts` (Inhalt, Banner, Dateiname, Zuständige ohne Namen), `ui/teilen/protokollPdf.test.ts` (Schnitte, Seiten, Banner, Wasserzeichen), `protokolle/src/ProtokollTeilenFenster.test.tsx` (frisch lesen, Lesefehler, kein zweites Lesen, kein Neubau bei gleichen Werten), `protokolle/src/Sitzungen.test.tsx` und `protokolle/src/ProtokollSchreiben.test.tsx` (Knopf, Ungespeichertes im PDF); wie die Seiten aussehen und das Teilen-Menü am Gerät, nur von Hand
- **Historie:** S6-3a (12.11.2026), S6-3b (12.11.2026)

</details>

### TF-PROT-12 · Mit KI füllen: Auftrag ohne Namen, Antwort, Übernahme

**Das brauchst du:** In der Test-Instanz eine eigene **TEST-Gruppe** (Gruppenname beginnt mit „TEST“) mit dir und Spike
als Mitglieder und ein Test-Protokoll im Entwurf (Titel beginnt mit „TEST“) mit Tagesordnung: 1 Andacht, 2 Gemeindeessen
mit Unterpunkt 2.1 Küche, 3 Verschiedenes – und im Titel von Punkt 3 einen Personennamen (z. B. „Besuch von Spike
Musiker“). Ein Transkript (als Text und als Word-Datei `.docx` mit Umlauten), in dem Mitglieder- und Personennamen
vorkommen. **Es läuft keine echte KI:** Die Antwort setzt Claude von Hand ein (nichts verlässt den Rechner). Danach die
Test-Protokolle und -To-Dos aufräumen.

**Das muss passieren:** „Mit KI füllen“ gibt es nur im Editor eines Entwurfs für die Leitung; der kopierte Auftrag
enthält keinen gefundenen Namen, die Vorschau zeigt sie wieder; die gewählten Einträge landen hinter dem Text der richtigen Punkte (bei Unterpunkten vor dem ersten),
das Protokoll speichert, und aus dem To-Do entsteht ein To-Do.

1. Test-Protokoll im Entwurf öffnen (Schreiben): Oben stehen **Freigeben · Mit KI füllen · Bearbeiten · Teilen / PDF**.
   Beim Umschalten auf **Lesen** ist der Knopf weg; in einem freigegebenen Protokoll gibt es ihn nicht.
2. **Mit KI füllen** → Transkript einfügen: Unter „Was die KI nicht sehen soll“ stehen die Namen mit Anzahl, Art und
   Platzhalter, auch der Name aus dem Titel von Punkt 3. Über „Weiteres verbergen“ steht der Hinweis „Namen werden
   automatisch ersetzt. Heikles (z. B. Krankheiten) hier selbst eintragen …“. Einen Begriff eintragen (z. B. eine
   Krankheit): Er erscheint als „eigener Begriff“.
3. „So geht es an die KI“ aufklappen: **kein gefundener Name** im Text, nur Platzhalter wie `[Person 1]`; die
   Tagesordnung steht mit Unterpunkt (2.1) darin. Häkchen bei einem Namen wegnehmen: Er steht dann im Auftrag.
4. **Auftrag kopieren** → „Kopiert ✓“, in einen Texteditor einfügen und prüfen (keine Namen). Dann **Weiter**: Es steht
   „Auftrag ist kopiert – in deine KI einfügen und die Antwort hier einfügen.“, „Auftrag anzeigen“ ist zu.
5. Eine **kaputte Antwort** einfügen („Gerne! Hier ist eine Zusammenfassung …“) → **Vorschau ansehen**: Meldung im Fenster,
   der eingefügte Text bleibt stehen.
6. Claude setzt die **richtige Antwort** ein (JSON mit den Platzhaltern aus dem Auftrag: Stichpunkte für 1 und 2.1, ein
   Beschluss für 2, ein To-Do für 2.1 mit Zuständigem aus der Gruppe und Bis-Datum, ein Termin, ein neuer Punkt, dazu je ein
   Eintrag für Punkt 9 und einen festen Punkt) → **Vorschau ansehen**: Die Namen sind wieder da (grün), je Zeile steht
   „→ 2.1 Küche“ usw.; die Einträge für Punkt 9 und den festen Punkt sind ausgegraut („Punkt 9 gibt es nicht“, „fester Punkt“).
7. Bei einem Eintrag das **Häkchen wegnehmen**, **Ausgewählte übernehmen**: Das Fenster geht zu, unten steht „N Einträge
   übernommen – das Protokoll speichert automatisch“. Im Blatt stehen die Stichpunkte als Aufzählung **hinter dem Text ihres
   Punkts** (bei Punkt 2 vor 2.1 – rechts unter „Beschlüsse“ steht beim Beschluss „Punkt 2“, nicht 2.1), Beschluss grün, Termin blau, das To-Do mit „– Name, bis …“, der neue Punkt am Ende (ohne Leerzeile davor); der
   abgewählte Eintrag fehlt.
8. Kurz warten: „gespeichert …“ erscheint. Die Sitzung neu öffnen: Alles steht noch da, und unter **To-Dos** gibt es das
   To-Do (Zuständiger = das Mitglied, ein Nicht-Mitglied als extern).
9. Noch einmal **Mit KI füllen** mit der **Word-Datei**: **Datei wählen** → der Text steht im Feld (Umlaute stimmen). Eine
   Datei, die keine Word-Datei ist (umbenannte Textdatei als `.docx`): Meldung im Fenster, das Feld bleibt.
10. Im Browser das Kopieren sperren (oder Seite ohne HTTPS öffnen): **Auftrag kopieren** springt zu Schritt 2, „Auftrag
    anzeigen“ ist offen, „Alles markieren“ markiert den Text.

<details><summary>Technisches</summary>

- **Priorität:** hoch
- **Betrifft:** `shared/protokolle/ki.ts`, `shared/protokolle/platzhalter.ts`, `shared/protokolle/docxText.ts`, `protokolle/src/KiFuellenFenster.tsx`, `protokolle/src/KiFuellen.tsx`, `protokolle/src/kiPersonen.ts`, `protokolle/src/ProtokollSchreiben.tsx`, `protokolle/src/demo.ts`
- **Automatisiert:** ja – `shared/protokolle/ki.test.ts`, `platzhalter.test.ts`, `docxText.test.ts` (Regeln), `protokolle/src/KiFuellenFenster.test.tsx` (ganzer Weg gegen die Erzeuger: kein Name im kopierten Auftrag, Name im Titel, Kopieren scheitert, kaputte Antwort, `.docx`/`.txt`, Häkchen, Reihenfolge der Einfügungen, Personenliste fehlt), `protokolle/src/kiPersonen.test.ts` (Blättern, Namen), `protokolle/src/ProtokollSchreiben.test.tsx` (Knopf nur im Entwurf mit Schreibrecht, Weg bis `einfuegen` und Speichern); die echte Übernahme in BlockNote, das Aussehen am Handy und das Kopieren in die Zwischenablage nur von Hand
- **Historie:** S8-2 (16.11.2026); Einfügestelle bei Unterpunkten und Schlusszeile nach dem ersten Lauf geändert (16.11.2026)

</details>

### TF-PROT-13 · Frühere Treffen: „Noch ohne Protokoll“ und „Protokoll nachtragen“

**Das brauchst du:** In der Test-Instanz eine eigene **TEST-Gruppe** (Gruppenname beginnt mit „TEST“) mit dir als Leitung
und Spike als Mitglied, mit eingerichteten Protokollen und Kalender. Dazu ein **vergangenes** Treffen (z. B. vor drei
Tagen) als **Kalender-Termin mit Besprechungsanfrage** (du und zwei Mitglieder eingeladen, eine Zusage, eine Absage) **und
Gruppentreffen zur selben Minute**, ohne Protokoll. Ein zweites vergangenes Gruppentreffen im Vormonat, im
ChurchTools-Gruppentreffen **abgeschlossen**, ebenfalls ohne Protokoll. Optional ein freigegebenes Protokoll von vor
zwei Wochen. Danach die Test-Protokolle, -Termine und -Treffen aufräumen.

**Das muss passieren:** Die Leitung findet vergangene Treffen ohne Protokoll im Block und im Fenster und kann daraus ein
Protokoll beginnen, das mit Termin und Gruppentreffen verknüpft ist; die Anwesenheit ist aus den Antworten vorbelegt; bei
einem abgeschlossenen Gruppentreffen steht sie fest; ein Mitglied sieht nichts davon.

1. Als Leitung den Reiter **Sitzungen** der TEST-Gruppe öffnen: Über „Kommend“ steht **Noch ohne Protokoll** mit dem
   Treffen von vor drei Tagen (Datum, Uhrzeit, „vor 3 Tagen“, Marken „Einladung“ und „Gruppentreffen“, „1 Zusage · 1
   Absage“). Der Untertitel nennt das letzte freigegebene Protokoll (gibt es keins: „In den letzten 28 Tagen …“). Das
   Treffen im Vormonat steht dort nicht, wenn es vor dem letzten freigegebenen Protokoll liegt oder älter als 28 Tage ist.
2. Oben rechts neben der Gruppen-Überschrift steht der grüne Knopf **Neu ⌄**; unter einer Linie am Ende seines Menüs steht
   **Protokoll nachtragen** (am Handy öffnet der Knopf ein Blatt von unten).
3. **Neu ⌄ → Protokoll nachtragen**: Das Fenster zeigt den laufenden Monat; **›** ist gesperrt. Mit **‹** in den Vormonat: Dort
   steht das abgeschlossene Treffen mit der Marke „Gruppentreffen abgeschlossen“ und „Anwesenheit steht in ChurchTools
   fest“. Ein Monat ohne Treffen: „Im … gibt es nichts nachzutragen – kein Treffen ohne Protokoll.“ Treffen mit Protokoll
   (auch ein Entwurf) stehen nirgends.
4. Im aktuellen Monat die Zeile vom Treffen mit Einladung antippen: Das Fenster wechselt zu **Protokoll beginnen** (Hinweis
   „… mit diesem Termin und dem Gruppentreffen verknüpft … aus den Antworten auf die Einladung vorbelegt“, „Wie letztes
   Mal“ nur, wenn davor ein freigegebenes Protokoll liegt). **‹** führt zurück zur Auswahl. Wieder wählen, **Beginnen**:
   Der Editor öffnet sich als Entwurf mit dem Titel des Termins und dem Datum des Treffens.
5. Im Protokoll unter **Anwesenheit**: Die Zusage ist anwesend, die Absage abwesend, wer nicht geantwortet hat offen;
   nachprüfen im ChurchTools-Gruppentreffen. Einen Namen antippen ändert ihn dort sofort.
6. Zurück zu **Sitzungen**: Das Treffen steht nicht mehr im Block, sondern als Entwurf unter „Kommend“. In ChurchTools
   (Kalender-Termin und Gruppentreffen) ist nichts verändert.
7. Das Treffen im Vormonat über „Protokoll nachtragen“ → beginnen: In der Anwesenheit sind die Namen **nicht** antippbar
   (das Gruppentreffen ist abgeschlossen), es steht der Hinweis „Das Gruppentreffen ist abgeschlossen …“.
8. Den ChurchTools-Server kurz unerreichbar machen (oder offline gehen) und die Seite neu laden: Im Block steht ein Hinweis
   mit „Erneut versuchen“, „Kommend“ und „Protokolle“ funktionieren, im Fenster steht beim Blättern der Hinweis statt
   „nichts nachzutragen“.
9. Als **Mitglied** (Spike) anmelden: Es gibt weder den Block „Noch ohne Protokoll“ noch den Eintrag „Protokoll nachtragen“ im Menü „Neu ⌄“;
   bei den Sitzungen kein „Protokoll beginnen“.

<details><summary>Technisches</summary>

- **Priorität:** hoch
- **Betrifft:** `shared/protokolle/fruehere.ts`, `shared/protokolle/sitzungen.ts`, `protokolle/src/lesen.ts`, `protokolle/src/NochOhneProtokoll.tsx`, `protokolle/src/ProtokollNachtragen.tsx`, `protokolle/src/FruehereText.tsx`, `protokolle/src/ProtokollBeginnen.tsx`, `protokolle/src/Sitzungen.tsx`, `protokolle/src/demo.ts`
- **Automatisiert:** ja – `shared/protokolle/fruehere.test.ts` (Zeitraum seit dem letzten Protokoll / 28 Tage / bis gestern, „ohne Protokoll“, Serie, Zeitzone), `protokolle/src/lesenFruehere.test.ts` (gegen den ChurchTools-Nachbau: Zeitraum der Aufrufe, Termin + Treffen = eine Sitzung, `isCompleted`, Antworten für vergangene Termine), `protokolle/src/FruehereTreffen.test.tsx` (Block und Fenster: nur Leitung, Blättern, Monat, Fehler, Beginnen), `protokolle/src/ProtokollBeginnen.test.tsx` und `beginnen.test.ts` („Wie letztes Mal“ vor dem Treffen, Verknüpfung); die echte Anwesenheit in ChurchTools, das Aussehen am Handy und der abgeschlossene Zustand in ChurchTools nur von Hand
- **Historie:** v1.0.1 (17.11.2026)

</details>

### TF-PROT-14 · Anwesenheit: Person aus dem Protokoll nehmen · Mit KI füllen: direkt zur Antwort

**Das brauchst du:** In der Test-Instanz eine eigene **TEST-Gruppe** (Gruppenname beginnt mit „TEST“) mit dir als Leitung
und drei Mitgliedern (z. B. Spike, ein „Gemeinschaftskonto“ und eine weitere Person), eingerichteten Protokollen und
einem Gruppentreffen mit Protokoll-Entwurf, der den festen Punkt **Anwesenheit** enthält. Dazu eine Antwort einer KI im
Aufbau von „Mit KI füllen“ (Beispiel unten), die Platzhalter wie `[Person 1]` und `[Person 2]` enthält, ein To-Do mit
`[Person 2]` als Zuständigem und einen Stichpunkt mit `[Person 1]`. Danach Test-Protokoll und -Treffen aufräumen.

**Das muss passieren:** Eine Person lässt sich aus der Anwesenheit dieses Protokolls nehmen, ohne dass sich im
ChurchTools-Gruppentreffen etwas ändert, und wieder zurückholen; sie fehlt beim Lesen, im PDF und bei den Hinweisen zum
Freigeben. „Mit KI füllen“ nimmt eine fertige Antwort ohne Transkript an, lässt Platzhalter Namen zuordnen und warnt in
der Vorschau vor den übrigen.

1. Das Protokoll öffnen, bei **Anwesenheit** auf **„Gemeinschaftskonto aus dem Protokoll nehmen“** tippen (Auge-Symbol am
   Zeilenende): Die Zeile verschwindet, unter der Liste steht **„1 ausgeblendet“**, die Zahlen oben („Anwesend … ·
   Abwesend … · Offen …“) zählen die Person nicht mehr.
2. Im ChurchTools-**Gruppentreffen** nachsehen: Das Gemeinschaftskonto steht dort unverändert und ist nicht angetippt
   worden.
3. **Zeigen** antippen: Die Person steht mit „nicht im Protokoll“ und **„Zurückholen“** da. **Zurückholen** tippen: Sie ist
   wieder in der Liste, die Zeile „ausgeblendet“ ist weg. Danach sie erneut ausblenden.
4. Die Seite neu laden: Die Person ist weiter ausgeblendet (gespeichert im Protokoll).
5. **Freigeben** antippen: Ist die ausgeblendete Person im Gruppentreffen „offen“, nennt der Hinweis „Anwesenheit: … noch
   offen“ sie **nicht**. Fenster mit „Abbrechen“ schließen.
6. **Teilen** → PDF ansehen und den Entwurf lesen (Reiter „Protokolle“ → Protokoll öffnen): Die Person steht in der
   Anwesenheit nirgends, auch nicht unter „Offen“.
7. Ein **neues** Protokoll über **„Wie letztes Mal“** von diesem beginnen: Dort steht die Person wieder in der
   Anwesenheit (das Ausblenden gilt nur für ein Protokoll). Danach das neue Test-Protokoll wieder aufräumen.
8. **Mit KI füllen** öffnen. In Schritt 1 steht oben **„Antwort schon da? Direkt einfügen“** – antippen: Schritt 2 öffnet
   sich ohne Transkript, es gibt **kein** „Auftrag anzeigen“ und keinen Hinweis zum Kopieren. **Zurück** führt zu Schritt 1.
9. Wieder „Direkt einfügen“, die Beispiel-Antwort einfügen: Unter dem Feld steht **„Platzhalter zuordnen“** mit `[Person 1]`
   und `[Person 2]`. Bei `[Person 2]` einen Mitgliedsnamen aus den Vorschlägen wählen, `[Person 1]` leer lassen, **Vorschau
   ansehen**.
10. In der Vorschau: Oben steht ein Hinweis „[Person 1] ist keinem Namen zugeordnet – nach dem Übernehmen selbst
    ersetzen.“ Beim To-Do steht der gewählte Mitgliedsname (ohne „extern“). Mit `[Person 2]` leer gelassen stünde dort
    „niemand zuständig“. **Ausgewählte übernehmen**: Der Stichpunkt enthält noch „[Person 1]“, das To-Do hat das Mitglied
    als Zuständigen.

Beispiel-Antwort:

```json
{
  "punkte": [{ "nr": "1", "stichpunkte": ["[Person 1] hält die Andacht."] }],
  "todos": [{ "nr": "1", "text": "TEST Zusagen einholen", "wer": ["[Person 2]"] }]
}
```

<details><summary>Technisches</summary>

- **Priorität:** normal
- **Betrifft:** `shared/protokolle/anwesenheit.ts`, `shared/protokolle/protokollBlatt.ts`, `shared/protokolle/freigabe.ts`, `shared/protokolle/ki.ts`, `shared/protokolle/platzhalter.ts`, `protokolle/src/Anwesenheit.tsx`, `protokolle/src/Anwesenheit.module.scss`, `protokolle/src/FesterPunkt.tsx`, `protokolle/src/EditorBloecke.tsx`, `protokolle/src/ProtokollAnsicht.tsx`, `protokolle/src/editorSchema.ts`, `protokolle/src/anwesenheitSchreiben.ts`, `protokolle/src/KiFuellenFenster.tsx`, `protokolle/src/KiFuellen.module.scss`
- **Automatisiert:** teilweise – `shared/protokolle/anwesenheit.test.ts`, `protokollBlatt.test.ts`, `freigabe.test.ts`, `ki.test.ts`, `vorlagen.test.ts` (Lesen/Schreiben von `props.ohne`, „Wie letztes Mal“ ohne Ausgeblendete, Filter in Blatt, Freigabe-Hinweis und Vorbelegung, unzugeordnete Platzhalter), `protokolle/src/Anwesenheit.test.tsx` (Knopf, „ausgeblendet“/„Zeigen“/„Zurückholen“, Lesen, abgeschlossenes Treffen, Editor), `protokolle/src/KiFuellenFenster.test.tsx` (Direkt-Link, „Platzhalter zuordnen“, Hinweis in der Vorschau, Übernahme); das echte Gruppentreffen in ChurchTools, das PDF und das Aussehen am Handy nur von Hand
- **Historie:** 17.11.2026 (Anlass: Gemeinschaftskonto „Technik“ stand als Gruppenmitglied in jeder Anwesenheit)

</details>

### TF-PROT-15 · Mit KI füllen: leeres Protokoll aus einer Antwort nur mit neuen Punkten füllen

**Das brauchst du:** In der Test-Instanz eine eigene **TEST-Gruppe** (Gruppenname beginnt mit „TEST“) mit dir als Leitung,
eingerichteten Protokollen und einem **leeren** Protokoll-Entwurf (ohne Tagesordnungspunkte). Dazu die Beispiel-Antwort
unten.

**Das muss passieren:** „Mit KI füllen“ nimmt die Antwort an, auch wenn das Protokoll keinen Punkt hat. Die Vorschau zeigt
unter „Neue Punkte“ zwei Punkte mit je **einem** Häkchen und darunter Stichpunkte, Beschlüsse, To-Dos (mit Zuständigem und
Datum) und Termine. Nach „Ausgewählte übernehmen“ stehen im Protokoll zwei nummerierte Tagesordnungspunkte, und
Beschluss, To-Do und Termin gehören zu „1. TEST Parkplatz“ (auch in den Bereichen „Beschlüsse“, „To-Dos“ und „Termine“).

1. Das leere Test-Protokoll öffnen und **Mit KI füllen** antippen.
2. In Schritt 1 **„Antwort schon da? Direkt einfügen“** antippen und die Beispiel-Antwort einfügen, dann **Vorschau
   ansehen**.
3. In der Vorschau steht unter **Neue Punkte** „TEST Parkplatz“ mit „Hinweisschilder fehlen.“, einem Beschluss, einem
   To-Do („Maria Test (extern)“, „bis 30.11.2026“) und einem Termin „12.12.2026“; „TEST Verschiedenes“ steht darunter mit
   einem Stichpunkt. Es gibt genau **zwei** Häkchen, keins an Beschluss, To-Do oder Termin.
4. Bei „TEST Verschiedenes“ das Häkchen wegnehmen: Der Knopf zeigt **„Ausgewählte übernehmen (1)“**. Das Häkchen wieder
   setzen und **Ausgewählte übernehmen** tippen.
5. Im Protokoll prüfen: Punkt **1.** „TEST Parkplatz“ mit Stichpunkt, Beschluss, To-Do und Termin, danach Punkt **2.**
   „TEST Verschiedenes“.
6. Das Protokoll speichern lassen und in „Beschlüsse“, „To-Dos“ und „Termine“ nachsehen: Alle drei stehen bei Punkt 1. Das
   To-Do hat „Maria Test“ als externen Namen und das Datum 30.11.2026.
7. Das Test-Protokoll wieder leeren oder löschen (und das TEST-To-Do entfernen).

Beispiel-Antwort:

```json
{
  "neue_punkte": [
    {
      "titel": "TEST Parkplatz",
      "stichpunkte": ["Hinweisschilder fehlen."],
      "beschluesse": ["Wir bestellen drei Schilder."],
      "todos": [{ "text": "TEST Entwurf zeigen", "wer": ["Maria Test"], "bis": "2026-11-30" }],
      "termine": [{ "datum": "2026-12-12", "text": "Aufbau ab 15 Uhr" }]
    },
    { "titel": "TEST Verschiedenes", "stichpunkte": ["Nichts weiter."] }
  ]
}
```

<details><summary>Technisches</summary>

- **Priorität:** normal
- **Betrifft:** `shared/protokolle/ki.ts`, `protokolle/src/KiFuellenFenster.tsx`, `protokolle/src/KiFuellen.module.scss`
- **Automatisiert:** teilweise – `shared/protokolle/ki.test.ts` (Lesen der neuen Felder, `offenePlatzhalter`, Übernahme in Blöcken, Auftrag mit Beispiel und Zeile bei leerer Tagesordnung), `protokolle/src/KiFuellenFenster.test.tsx` (Vorschau mit einem Häkchen, Übernahme in ein leeres Protokoll); das Aussehen am Handy, das Speichern und die Bereiche nach dem Speichern nur von Hand
- **Historie:** 17.11.2026 (Anlass: Ein leeres Protokoll ließ sich nicht füllen – Beschlüsse, To-Dos und Termine brauchten die Nummer eines vorhandenen Punkts)

</details>

### TF-PROT-16 · Mehrere Gruppen, ein Kalender: der Termin steht nur dort, wo das Gruppentreffen ist

**Das brauchst du:** In der Test-Instanz **zwei TEST-Gruppen** (Gruppenname beginnt mit „TEST“, z. B. „TEST Technik“ und
„TEST Bildtechnik“) mit dir als Leitung, **beide in Protokolle eingerichtet und mit demselben Kalender**. Im Kalender zwei
Termine mit Besprechungsanfrage in der Zukunft („TEST Treffen A“, „TEST Treffen B“), dazu ein Termin „TEST Treffen C“ vor
etwa einer Woche.

**Das muss passieren:** Ein Termin steht nur in der Gruppe, die ein Gruppentreffen zur selben Startzeit hat. Hat keine
Gruppe eins, steht er in beiden. Auch bei „Noch ohne Protokoll“ und „Protokoll nachtragen“.

1. Im Reiter **Sitzungen** nacheinander „TEST Technik“ und „TEST Bildtechnik“ öffnen (über die Überschrift, siehe TF-PROT-20): Unter **Kommend** stehen in beiden
   Gruppen „TEST Treffen A“ und „TEST Treffen B“, außerdem bei der Leitung oben **Noch ohne Protokoll** mit „TEST Treffen C“.
2. In ChurchTools in der Gruppe „TEST Bildtechnik“ ein **Gruppentreffen** anlegen, das zur selben Uhrzeit beginnt wie
   „TEST Treffen A“ (gleicher Tag, gleiche Minute).
3. Die Seite „Protokolle“ neu laden. In „TEST Bildtechnik“ steht „TEST Treffen A“ weiter unter **Kommend** (jetzt mit dem
   Gruppentreffen), in „TEST Technik“ **fehlt** es; „TEST Treffen B“ steht in beiden.
4. In „TEST Bildtechnik“ ein Protokoll zu „TEST Treffen B“ beginnen („Protokoll beginnen“). In „TEST Technik“ fehlt „TEST
   Treffen B“ jetzt ebenfalls.
5. Ein Gruppentreffen in „TEST Technik“ zur Startzeit von „TEST Treffen A“ anlegen und neu laden: „TEST Treffen A“ steht
   jetzt in **beiden** Gruppen (jede hat ihr eigenes Treffen).
6. Das Gruppentreffen in „TEST Bildtechnik“ zu „TEST Treffen C“ (vor einer Woche) anlegen: In „TEST Technik“ fehlt „TEST
   Treffen C“ unter **Noch ohne Protokoll** und im Fenster **Protokoll nachtragen**, in „TEST Bildtechnik“ steht es.
7. Alles aufräumen: die Test-Gruppentreffen, das Test-Protokoll und die Test-Termine löschen.

<details><summary>Technisches</summary>

- **Priorität:** normal
- **Betrifft:** `shared/protokolle/sitzungen.ts`, `protokolle/src/lesen.ts`, `protokolle/src/NochOhneProtokoll.tsx`, `protokolle/src/ProtokollNachtragen.tsx`, `protokolle/src/Sitzungen.tsx`, `protokolle/src/demo.ts`
- **Automatisiert:** größtenteils – `shared/protokolle/fremdeTermine.test.ts` (die Regel: Treffen zur selben Minute, Kopf zum Termin, Serie, eigenes Treffen/Kopf bleibt, nie ohne Termin), `protokolle/src/lesenKalenderGeteilt.test.ts` (gegen den ChurchTools-Nachbau: Kommend, Startseite, „Noch ohne Protokoll“, „Protokoll nachtragen“; kein Recht und vorübergehender Fehler bei der anderen Gruppe lassen den Termin stehen; keine Zusatzabrufe ohne Termin-Sitzungen), `protokolle/src/demoKalenderGeteilt.test.ts` (der Fall in `?demo`); die echten Rechte in ChurchTools (was ein Mitglied sieht, das die andere Gruppe nicht lesen darf) nur von Hand
- **Historie:** 17.11.2026 (Anlass: Technik, Bildtechnik, Kamera, Stream und Tontechnik nutzen den Kalender „Technik“ – jeder Termin stand in allen fünf Gruppen, und es entstand ein zweites Protokoll in der falschen Gruppe)

</details>

### TF-PROT-17 · To-Dos: „Alle“ bei den Zuständigen und gekürzte Anzeige

**Das brauchst du:** In der Test-Instanz eine **TEST-Gruppe** (Gruppenname beginnt mit „TEST“) mit dir als Leitung und
mindestens **fünf** Mitgliedern, eingerichtete Protokolle und ein To-Do „TEST Alle ran“.

**Das muss passieren:** Der Schalter „Alle (N)“ wählt alle Mitglieder an und wieder ab. Die Karte zeigt höchstens drei
Bilder und Namen, danach „+N“; der Tooltip nennt alle. Im PDF stehen alle Namen.

1. Im Reiter **To-Dos** „TEST Alle ran“ antippen. Bei **Zuständig** steht oben **Alle (N)**, N = Zahl der Mitglieder.
2. **Alle** antippen: Alle Mitglieder sind angehakt. Einen Haken wegnehmen: **Alle** ist aus. Wieder setzen: **Alle** ist an.
3. **Alle** abschalten: Niemand ist angehakt. Wieder einschalten und **Speichern**.
4. In der Liste zeigt die Karte höchstens **drei** Bilder und Namen und dahinter **+N**; mit der Maus darüber steht die volle
   Liste. Bei **Person** (Filter → Gruppieren nach) steht das To-Do in der Spalte jeder Person.
5. In einem Protokoll-Entwurf der Gruppe einen To-Do-Punkt mit dem Schildchen **Wer?** öffnen: Dort steht ebenfalls oben
   **Alle (N)** mit demselben Verhalten; das Schildchen zeigt drei Namen und **+N**.
6. Beim Einladen (**Nächste Sitzung festlegen**) gibt es **kein** „Alle“.
7. Das Protokoll freigeben und als PDF ansehen: Beim To-Do stehen **alle** Namen.
8. Das TEST-To-Do wieder entfernen.

<details><summary>Technisches</summary>

- **Priorität:** normal
- **Betrifft:** `shared/protokolle/aufgaben.ts`, `protokolle/src/Planungsfelder.tsx`, `protokolle/src/ToDoFenster.tsx`, `protokolle/src/EditorBloecke.tsx`, `protokolle/src/ToDos.tsx`, `protokolle/src/FesterPunkt.tsx`
- **Automatisiert:** teilweise – `shared/protokolle/aufgaben.test.ts`, `protokolle/src/Planungsfelder.test.tsx`, `ToDoFenster.test.tsx`, `EditorBloecke.test.tsx`, `ToDos.test.tsx`, `SitzungFestlegen.test.tsx`; Aussehen am Handy, Tooltip und PDF nur von Hand
- **Historie:** 17.11.2026 (Anlass: ein To-Do für alle 17 Mitglieder brauchte 17 Klicks und machte die Karte unlesbar)

</details>

### TF-PROT-18 · Protokoll löschen: mit To-Dos, Termin und Gruppentreffen – und wenn es mittendrin hakt

**Das brauchst du:** In der Test-Instanz eine **TEST-Gruppe** (Gruppenname beginnt mit „TEST“) mit dir als Leitung,
eingerichtete Protokolle und ein Kalender. **Nur Test-Daten, nichts aus der echten Gemeinde.** Dazu zwei Sitzungen, die du
löschen darfst: **A** („TEST Löschen A“) mit **Termin** und **Gruppentreffen**, einem begonnenen **Protokoll** (Entwurf)
und **zwei To-Dos** darin („TEST Löschen eins“, „TEST Löschen zwei“); **B** („TEST Löschen B“) mit einem **freigegebenen**
Protokoll und einem To-Do. **Achtung: „Termin löschen“ verschickt eine echte Mail „Termin gelöscht“ an alle
Eingeladenen** – in der Test-Instanz nur Termine **ohne fremde Eingeladene** (nur du selbst oder ein eigenes
Test-Konto) benutzen.

**Das muss passieren:** „Löschen“ fragt nach, nennt Titel · Datum · Status und sagt, dass es sich nicht rückgängig machen
lässt. Was man anhakt, wird gelöscht – nicht mehr und nicht weniger. Danach steht die Liste der Sitzungen mit „Protokoll
gelöscht“ da; bleiben Termin und Gruppentreffen bestehen, steht die Sitzung wieder „ohne Protokoll“ da.

1. Sitzung **A** öffnen (Entwurf, im Editor). Im Kopf steht rot **Löschen**, neben **Bearbeiten**. Antippen: Das Fenster
   „Protokoll löschen?“ nennt „TEST Löschen A · Datum · Entwurf“ und „Das lässt sich nicht rückgängig machen.“
2. Darin steht **To-Dos aus diesem Protokoll (2)** mit **Mitlöschen** (gewählt, „im Verlauf vermerkt“) und **Behalten**,
   dazu **In ChurchTools außerdem löschen** mit den Häkchen **Termin „…“** (mit „N Eingeladene bekommen die Mail …“ bzw. „Niemand
   sonst ist eingeladen – es geht keine Mail raus“) und **Gruppentreffen** – **alle Häkchen sind aus**.
3. **Behalten** wählen, **keine** Häkchen setzen, **Löschen**. Die Liste erscheint mit „Protokoll gelöscht“. Sitzung A steht
   unter **Kommend** wieder **ohne Protokoll** (Termin und Treffen sind noch da). Im Reiter **To-Dos** stehen „TEST Löschen
   eins“ und „zwei“ weiter, mit „Aus einer älteren Sitzung“.
4. Sitzung A öffnen, **Protokoll beginnen** (neu, mit einem To-Do „TEST Löschen drei“), im Kopf **Löschen**: jetzt **Mitlöschen**
   lassen, **Gruppentreffen** anhaken, **Löschen**. In ChurchTools: das Gruppentreffen ist weg, der Termin steht noch; „TEST
   Löschen drei“ steht nicht mehr in der To-Do-Liste (in ChurchTools-Verlauf als gelöscht vermerkt).
5. **Vorbereitung für ein späteres Protokoll:** Eine Sitzung **C** (später als B, „TEST Löschen C“) mit einem Protokoll beginnen,
   darin den festen Punkt **Protokoll der letzten Sitzung** einfügen (er zeigt B) und C **freigeben**.
6. Sitzung **B** öffnen (freigegeben, nur Ansicht): Im Kopf steht **Löschen** neben **Teilen / PDF** und **Freigabe
   zurücknehmen**. Antippen: Status „freigegeben“; **Termin** anhaken (nur mit Test-Termin ohne fremde Eingeladene!),
   **Löschen**. Der Termin ist in ChurchTools gelöscht, das Protokoll ist aus der Liste „Protokolle“ weg.
   Dann Sitzung **C** öffnen: Beim festen Punkt steht „Das damalige Protokoll gibt es nicht mehr“, die Seite bleibt
   bedienbar; das PDF von C hat denselben Satz.
7. **Schreibt jemand?** Mit einem zweiten Test-Konto (oder einem zweiten Fenster) im Protokoll einer Sitzung tippen. Im
   ersten Fenster **Löschen** → Meldung „… schreibt gerade am Protokoll – es wurde nicht gelöscht“; nichts ist weg.
8. **Mittendrin hakt es:** Bei einer Sitzung mit **Termin** den Termin vorher in ChurchTools mit einer **Anmeldung** versehen
   (der Termin lässt sich dann hier nicht löschen): **Termin** ist gesperrt mit dem Grund. Alternativ die Verbindung kurz
   kappen (Flugmodus) und **Löschen** drücken: Das Fenster bleibt offen und sagt, was schon erledigt ist und was nicht;
   Verbindung zurück, **Nochmal versuchen**: Es klappt, nichts ist doppelt (ein To-Do-Verlauf zeigt „gelöscht“ nur einmal, es
   kam nur eine Mail).
9. **Terminserie:** Bei einer Serie „TEST Serie“ (wöchentlich) ein Protokoll beginnen, **Löschen**: Beim Termin steht „Nur diese
   Sitzung fällt aus der Serie … Ohne Mail“. Anhaken, **Löschen**: Nur dieser Tag fehlt in der Serie, die anderen bleiben.
10. Alles Übrige aufräumen (Test-Termine, -Treffen, -To-Dos, -Protokolle).

<details><summary>Technisches</summary>

- **Priorität:** normal
- **Betrifft:** `shared/protokolle/loeschen.ts`, `protokolle/src/loeschen.ts`, `protokolle/src/ProtokollLoeschen.tsx`, `protokolle/src/bearbeiten.ts`, `protokolle/src/Sitzungen.tsx`, `protokolle/src/SitzungAnsicht.tsx`, `protokolle/src/ProtokollSchreiben.tsx`, `protokolle/src/schreibSteuerung.ts`, `protokolle/src/demo.ts`, `ui/bedienung/KopfKnopf.tsx`
- **Automatisiert:** größtenteils – `shared/protokolle/loeschen.test.ts` (welche To-Dos, Zahl der Eingeladenen, Texte), `protokolle/src/loeschen.test.ts` (der Ablauf gegen den ChurchTools-Nachbau: nur Protokoll, To-Dos mitlöschen/behalten, Termin, Treffen, Serie „nur diese“, fremde Sperre, Fehler mittendrin und zweiter Versuch, Nachlesen, Kopf zuletzt), `protokolle/src/loeschenListe.test.ts` (die Sitzung steht danach „ohne Protokoll“ da), `protokolle/src/ProtokollLoeschen.test.tsx` (Rückfrage, Häkchen anfangs aus, Knopf nur für die Leitung und nur mit Protokoll), `protokolle/src/SitzungenLoeschen.test.tsx`, `protokolle/src/ProtokollSchreiben.test.tsx` und `schreibSteuerung.test.ts` (Editor hält sein Speichern an), `protokolle/src/FesterPunkt.test.tsx` (feste Punkte nach dem Löschen), `protokolle/src/demoLoeschen.test.ts` (`?demo`); gemessen in der Test-Instanz 18.11.2026: ein gelöschtes Gruppentreffen liefert beim Nachlesen 404, ein zweites Löschen ebenfalls 404 (Löschen selbst 204); **echtes ChurchTools sonst nur von Hand:** die echte Mail „Termin gelöscht“, die Anmeldung am Termin
- **Historie:** 17.11.2026 (Anlass: ein falsch begonnenes Protokoll ließ sich nur über „Absagen“ als Entwurf stehen lassen oder gar nicht entfernen)

</details>

### TF-PROT-19 · Punkte ordnen: im Fenster umstellen, im Text nicht mehr ziehbar

**Das brauchst du:** In der Test-Instanz ein eigenes Test-Protokoll im Entwurf (Titel beginnt mit „TEST“) mit dieser
Tagesordnung: **1 Anwesenheit** (der feste Punkt), **2 Andacht** mit zwei Stichpunkten, **3 Rückblick** mit drei
Stichpunkten und einem To-Do („TEST Lautstärke messen“), **4 Abläufe** mit den Unterpunkten **4.1 Ton**, **4.2 Bild**
(darunter ein Beschluss) und **4.3 Stream**, **5 Ausblick**. Dazu ein Rechner mit Maus und Tastatur, ein Handy oder iPad.

**Das muss passieren:** Tagesordnungspunkte lassen sich im Text nicht mehr ziehen; im Fenster „Punkte ordnen“ stellt man
sie um. Ein Punkt nimmt seine Unterpunkte und seinen Inhalt mit, die Ebene bleibt, die Nummern folgen der Reihenfolge.
Erst „Übernehmen“ ändert das Protokoll – als ein Schritt.

1. Das Test-Protokoll öffnen (Schreiben). Die Maus über die Überschrift **2 Andacht** halten, dann über einen Stichpunkt
   und ein To-Do: Links steht **weder „+“ noch Griff**. Rechts außen in der Werkzeugleiste steht **Punkte ordnen**.
2. **Punkte ordnen** antippen. Das Fenster zeigt alle Punkte mit Nummer, Titel und einer Zeile darunter, z. B. „3 Stichpunkte ·
   1 To-Do“, bei Punkt 1 „fester Punkt · Anwesenheitsliste“, bei Punkt 4 „3 Unterpunkte“; die Unterpunkte stehen eingerückt.
   **Übernehmen** und **Rückgängig** sind grau.
3. Bei **Andacht** den Pfeil **nach unten** drücken: Andacht steht jetzt an Stelle 3, die Nummern haben sich angepasst, darüber
   steht „„Andacht“ nach unten verschoben (jetzt 3.)“, **Übernehmen** und **Rückgängig** sind bedienbar. **Rückgängig**:
   Andacht steht wieder an Stelle 2, **Übernehmen** ist wieder grau.
4. **Abläufe** am **Griff** mit der Maus ganz nach oben ziehen: Beim Ziehen folgt der Punkt der Maus, eine blaue Linie zeigt
   die Stelle. Loslassen: Abläufe steht oben, **mit** Ton, Bild und Stream darunter. Beim Ziehen **Esc** drücken: Der Zug wird
   abgebrochen, das Fenster bleibt offen.
5. **Stream** nach ganz oben ziehen: Er springt nur an die erste Stelle **unter Abläufe** (4.1), nicht aus dem Punkt heraus;
   die Linie zeigt nur Stellen innerhalb von Abläufe. Mit der Tastatur: den Griff von **Bild** anklicken, **Pfeil hoch** – Bild
   rückt eine Stelle, der Fokus bleibt auf dem Griff.
6. **Anwesenheit** (fester Punkt) mit dem Pfeil nach unten verschieben: Er wandert ganz normal mit seiner Liste.
7. Jetzt nicht „Abbrechen“, sondern **Esc** drücken: Es erscheint „Erst „Übernehmen“ oder „Abbrechen“ wählen.“ Auch
   ein Tipp neben das Fenster und das X schließen es nicht.
8. **Übernehmen**: Im Text stehen die Punkte in der neuen Reihenfolge, die Nummern stimmen, die Stichpunkte, der Beschluss und
   das To-Do sind mit ihren Punkten mitgewandert; unter **To-Dos** steht „TEST Lautstärke messen“ weiter mit demselben
   Zuständigen. Im Text **Strg+Z** (Mac: Cmd+Z): Mit einem Schritt ist die ursprüngliche Reihenfolge zurück.
9. Wieder **Punkte ordnen**, einen Punkt verschieben, **Abbrechen**: Das Protokoll ist unverändert.
10. Über **Einfügen → Tabelle** eine Tabelle einfügen und die Maus darüber halten: Nur sie hat links einen Griff; sein Menü
    zeigt **Kopfzeile**, **Kopfspalte** und **Löschen**. Mit **Löschen** die Tabelle wieder entfernen. Direkt hinter einer
    Überschrift mit festem Punkt darunter **Entf** drücken: Der feste Punkt ist weg (Strg+Z holt ihn zurück).
11. Mit nur **einem** Punkt im Protokoll (ohne Unterpunkte): **Punkte ordnen** ist grau, der Hinweis beim Darüberhalten sagt,
    dass es mindestens zwei Punkte braucht.
12. **Am Handy** (oder schmalem Fenster): **Punkte ordnen** steht als Erstes in der Leiste; das Fenster füllt den Bildschirm,
    die Pfeile sind groß genug zum Tippen, es gibt kein seitliches Wischen. Einen Punkt mit dem Finger **kurz halten, dann
    ziehen**: Er löst sich und folgt dem Finger; wer sofort wischt, blättert nur die Liste.

<details><summary>Technisches</summary>

- **Priorität:** hoch
- **Betrifft:** `shared/protokolle/gliederung.ts`, `shared/protokolle/abschnitte.ts`, `protokolle/src/PunkteOrdnen.tsx`, `protokolle/src/usePunkteZiehen.ts`, `protokolle/src/punkteUebernehmen.ts`, `protokolle/src/Werkzeugleiste.tsx`, `protokolle/src/DokumentEditor.tsx`, `protokolle/src/zeilenGriff.ts`, `ui/fenster/Sheet.tsx`
- **Automatisiert:** größtenteils – `shared/protokolle/gliederung.test.ts` (Regel gegen die Ableitung: mitwandern, Ebene bleibt, Vorspann oben, feste Punkte, „Überschrift“), `shared/protokolle/abschnitte.test.ts`, `protokolle/src/punkteUebernehmen.test.ts` (echter Editor: IDs, ein Schritt, veralteter Stand), `protokolle/src/PunkteOrdnen.test.tsx` (Knöpfe, Tastatur, Esc, Ziehen mit nachgestellter Lage, Übernehmen/Abbrechen), `protokolle/src/Werkzeugleiste.test.tsx` (Knopf, Weg bis in den Editor); **nur von Hand:** die echte Lage der Linie, das Halten mit dem Finger, die Bildschirmfüllung am Handy, dass im Text außer an Tabellen kein „+“/Griff erscheint (`zeilenGriff.test.ts` prüft nur die Regel `hatGriff`)
- **Historie:** W7 (18.11.2026: Tagesordnungspunkte im Text zu verschieben „landet falsch, ist hakelig, unklar, was passiert“); nach v1.0.5 auch „+“ und Griff an Zeilen entfernt, außer an Tabellen (Alwin 18.11.2026)

</details>

### TF-PROT-20 · Sitzungen: die Gruppe über die Überschrift wählen

**Das brauchst du:** In der Test-Instanz mindestens **drei Gruppen**, die in Protokolle eingerichtet sind und die du sehen darfst
(am besten sieben, wie die Technik-Gruppen), dazu ein Rechner und ein Handy (oder das Browserfenster auf 390 px Breite). Außerdem
ein Konto, das nur **eine** Gruppe sieht.

**Das muss passieren:** Die Überschrift im Reiter **Sitzungen** ist der Knopf zur Gruppenwahl („Bildtechnik ▾“). Es gibt keine
Leiste mit einem Knopf je Gruppe mehr, die Seite lässt sich am Handy nicht seitlich verschieben.

1. Reiter **Sitzungen** öffnen: Oben steht der Name der Gruppe mit einem kleinen Pfeil nach unten, sonst nichts daneben.
2. Auf die Überschrift tippen: Eine Liste mit allen Gruppen klappt unter ihr auf, die aktuelle hat ein **Häkchen** und ist
   fett. Der Pfeil zeigt nach oben.
3. Eine andere Gruppe wählen: Die Liste schließt, die Überschrift nennt die neue Gruppe, darunter stehen deren Sitzungen.
4. Wieder aufklappen und **Esc** drücken (am Rechner) oder daneben tippen: Die Liste schließt, die Gruppe bleibt.
5. Am Handy (390 px): Die Liste liegt ganz im Bild (mindestens 16 px Rand), ist bei vielen Gruppen selbst scrollbar, und die
   **Seite** lässt sich nicht nach rechts schieben. Ein sehr langer Gruppenname bricht um.
6. Mit der Tastatur: Tab bis zur Überschrift, Eingabe öffnet, Tab/Umschalt+Tab wandert durch die Gruppen, Eingabe wählt. Danach
   steht der Fokus wieder auf der Überschrift. Ein Screenreader liest „Gruppe wählen: …“.
7. Mit dem Konto, das nur eine Gruppe sieht: Die Überschrift ist **kein** Knopf, kein Pfeil.

<details><summary>Technisches</summary>

- **Priorität:** normal
- **Betrifft:** `ui/bedienung/TitelWahl.tsx`, `ui/bedienung/TitelWahl.module.scss`, `protokolle/src/Sitzungen.tsx`
- **Automatisiert:** größtenteils – `ui/bedienung/TitelWahl.test.tsx` (öffnen, wählen, Häkchen, Esc und Tipp daneben, eine Möglichkeit = keine Schaltfläche), `protokolle/src/Sitzungen.test.tsx` (Gruppe wechseln lädt deren Sitzungen); wie es am Handy aussieht (Breite, Rand, Scrollen), nur am Gerät
- **Historie:** 18.11.2026 (Anlass: Die Gruppen-Leiste mit sieben Knöpfen war am Handy 600 px breit und schob die ganze Seite seitlich; Alwin entschied sich für die Überschrift als Auswahlknopf, Variante A)

</details>

### TF-PROT-21 · Hinweis auf fällige To-Dos: Band, roter Zähler und die Einstellung im Reiter „Einstellungen“

**Das brauchst du:** In der Test-Instanz ein **Admin-Konto** (für die Einstellungen) und eine eingerichtete Gruppe, in der du
Mitglied bist. Lege dir als Test-To-Dos an (Text beginnt mit „TEST“, du bist zuständig): „TEST Überfällig“ (Bis **gestern**),
„TEST Bald“ (Bis **übermorgen**), „TEST Später“ (Bis in **zehn Tagen**) und „TEST Erledigt“ (Bis gestern, auf **Erledigt**). Dazu ein
Rechner und ein Handy (oder das Browserfenster auf 390 px Breite).

**Das muss passieren:** Beim Öffnen steht auf der Startseite ein Band, am Reiter „To-Dos“ eine rote Zahl – beides zählt nur
**deine** offenen To-Dos. Die Einstellungen stellen ein, ab wann ein To-Do „bald fällig“ ist; ohne Einstellung gelten **3 Tage**.

1. **Protokolle** öffnen (ohne Einstellung gespeichert zu haben, falls möglich): Unter der Begrüßung steht ein **rotes Band**
   „**1 To-Do überfällig**, 1 bis … fällig“ mit „Zu meinen To-Dos“. Am Reiter **To-Dos** steht eine **rote 2**.
   „TEST Später“ und „TEST Erledigt“ zählen nicht.
2. Am Computer steht die Zahl am Reiter oben, am Handy am Reiter **unten**. Wechsle auf **Sitzungen** und **Start**: Die Zahl
   bleibt auf jeder Seite. Ein Screenreader liest „To-Dos, 2 fällig“.
3. „Zu meinen To-Dos“ antippen: Der Reiter **To-Dos** öffnet sich. Setze dort „TEST Überfällig“ auf **Erledigt**: Die Zahl am
   Reiter wird **1**. Gehe zurück auf **Start**: Das Band sagt jetzt nur noch „**1 To-Do** bis … fällig“ und ist **blau**, nicht rot.
4. Als Admin: **Einstellungen → Hinweis auf fällige To-Dos**: Das Feld zeigt „Überfällige und 3 Tage vorher“. Wähle **„Nur Überfällige“**
   → „Hinweis gespeichert“. Zurück auf **Start**: Kein Band mehr (nichts überfällig), die Zahl am Reiter ist weg. Wähle
   **„Überfällige und 14 Tage vorher“**: Jetzt zählt auch „TEST Später“ (Zahl 2).
5. Wähle **„Aus (kein Hinweis, kein Zähler)“**: Weder Band noch Zahl – auch nicht nach dem Neuladen und nicht bei einem anderen
   Konto in derselben Gruppe. Stelle danach wieder **3 Tage** ein.
6. Ein Konto **ohne** eigene To-Dos: Weder Band noch Zahl. Öffne die Erweiterung mit **#/sitzungen** in der Adresse: Die Zahl erscheint
   nach kurzer Zeit auch dort.

<details><summary>Technisches</summary>

- **Priorität:** normal
- **Betrifft:** `shared/protokolle/hinweis.ts`, `protokolle/src/todoHinweis.ts`, `protokolle/src/useFaellige.ts`, `protokolle/src/FaelligBand.tsx`, `protokolle/src/TodoHinweisKarte.tsx`, `protokolle/src/App.tsx`, `protokolle/src/Startseite.tsx`, `protokolle/src/ToDos.tsx`, `protokolle/src/reiter.ts`, `ui/bedienung/ReiterLeiste.tsx`, `ui/bedienung/ReiterZaehler.tsx`
- **Automatisiert:** größtenteils – `shared/protokolle/hinweis.test.ts` (Grenzen heute/heute+N, erledigt, fremd, „Aus“, „Nur überfällig“, Band-Texte, Wächter, Standard bei kaputtem Wert), `protokolle/src/todoHinweis.test.ts` (lesen/speichern gegen den ChurchTools-Nachbau, Lesefehler → Standard, verschlucktes Speichern), `protokolle/src/TodoHinweisKarte.test.tsx`, `protokolle/src/FaelligBand.test.tsx`, `protokolle/src/App.test.tsx` (Zähler am Computer und Handy, Ladeaufwand, Folge der Einstellungen), `ui/bedienung/ReiterLeiste.test.tsx`; **nur von Hand:** Aussehen (rotes Band, Zähler in beiden Leisten, Dunkelmodus), echter Wechsel der Einstellung zwischen zwei Konten
- **Historie:** 19.11.2026 (Alwin: ChurchTools hat keine zeitgesteuerten Erinnerungen, darum ein Hinweis beim Öffnen; Einstellung für die ganze Erweiterung, Standard 3 Tage)

</details>

### TF-PROT-22 · Haken statt Weiterschalten, „Rückgängig“ an der Karte und „Jeder für sich“

**Das brauchst du:** In der Test-Instanz eine eingerichtete Gruppe mit mindestens **zwei Mitgliedern** und zwei Konten (du als
**Leitung** und ein **Mitglied**). Lege dir als Test-To-Dos an: „TEST Haken“ (nur du zuständig), „TEST Jeder“ (du und das andere
Konto zuständig) und „TEST Gemeinsam“ (beide zuständig). Dazu ein Rechner und ein Handy (oder das Browserfenster auf 390 px Breite).

**Das muss passieren:** Der Haken (Kreis vorn an der Karte) hakt ab und nimmt zurück – nie springt er auf „in Arbeit“. Eine eben abgehakte Karte bleibt
5 Sekunden an ihrem Platz, mit „Rückgängig“ an der Karte. Bei „Jeder für sich“ hakt jeder nur seinen Teil ab; fertig ist das To-Do,
wenn alle fertig sind.

1. **To-Dos → Liste, Filter → Gruppieren nach → Status.** Tippe bei „TEST Haken“ auf den **Kreis** vorn: Er wird **grün mit Haken**, der Titel ist
   durchgestrichen und die Karte bleibt **an ihrem Platz**, in der Fußzeile steht **„Rückgängig“**. Warte 5 Sekunden: Die Karte rutscht zu **Erledigt**
   und zeigt dort „Erledigt von dir am …“.
2. Tippe bei „TEST Haken“ (jetzt erledigt) noch einmal auf den Kreis: **Offen**, kein „Rückgängig“. Hake wieder ab und tippe diesmal
   gleich auf **„Rückgängig“**: Das To-Do ist wieder offen und bleibt es auch nach 5 Sekunden und nach dem Neuladen.
3. Öffne „TEST Haken“ (Titel antippen), stelle den Status auf **In Arbeit** und speichere: Die Karte zeigt das Schild **„in Arbeit“**. Ein Tipp auf
   den Kreis hakt ab (**Erledigt**), nicht „weiter“. Im **Board** lässt sich die Karte in die Spalte „In Arbeit“ ziehen (dort ohne Schild).
4. Öffne „TEST Jeder“: Unter „Zuständig“ steht **„So wird es erledigt“** mit **Gemeinsam | Jeder für sich** (bei nur einem Zuständigen
   fehlt der Umschalter). Wähle **Jeder für sich**: Statt „Status“ steht **„Wer ist fertig?“** mit beiden Namen, beide „offen“.
   Speichere. Die Karte zeigt in der Fußzeile **☑ 0/2** (kein Schild „in Arbeit“).
5. Tippe auf der Karte auf den Kreis: Es ist **dein Teil** (☑ 0/2 → ☑ 1/2), „Rückgängig“ erscheint. Tippe auf **☑ 1/2**: Es klappt auf, wer fertig ist
   (du mit „✓ Datum“, der andere „offen“). Auf der
   **Startseite** steht das To-Do jetzt **nicht** mehr unter „Meine offenen To-Dos“; das andere Konto sieht es dort weiter, mit „1 von 2 fertig“.
6. Mit dem **Mitglied-Konto**: Das To-Do öffnen. In „Wer ist fertig?“ ist **nur der eigene Name** zum Anhaken frei, der andere Name ist ausgegraut.
   Eigenen Teil abhaken, speichern: Die Karte steht auf **Erledigt (2/2)**, im Verlauf stehen beide Teile und „Status: erledigt“.
7. Als **Leitung** („TEST Jeder“ öffnen): Du kannst den Teil des Mitglieds zurücknehmen → Gesamtstand **In Arbeit**. Im Board lässt sich die
   Karte **nicht** in eine andere Status-Spalte ziehen (sie wandert von selbst); nach Person zu ziehen geht weiter.
8. Beide Konten haken kurz nacheinander ab (mehrmals, auch gleichzeitig am Rechner und Handy): Keiner löscht den Teil des anderen.
9. Im **Protokoll-Editor** (Entwurf): An einer Aufgabe mit zwei Zuständigen steht beim Schildchen „Wer?“ der Haken **„Jeder hakt für sich
   ab“**. Der runde Haken vorne hakt ab bzw. nimmt zurück (bei „Jeder für sich“ **mein Teil**, mit „1/2“ daneben); ebenso in „Offene To-Dos“
   (fester Punkt) – nie auf „in Arbeit“.

<details><summary>Technisches</summary>

- **Priorität:** hoch
- **Betrifft:** `shared/protokolle/aufgaben.ts`, `shared/protokolle/uebersicht.ts`, `protokolle/src/Haken.tsx`, `protokolle/src/ToDos.tsx`, `protokolle/src/ToDoFenster.tsx`, `protokolle/src/EditorBloecke.tsx`, `protokolle/src/FesterPunkt.tsx`, `protokolle/src/todoSchreiben.ts`, `protokolle/src/Startseite.tsx`
- **Automatisiert:** größtenteils – `shared/protokolle/aufgaben.test.ts` („Jeder für sich“: Gesamtstand, Zuständige, Modus, Rechte-Regel, „für mich offen“, Teile aus zwei Ständen, Haken-Schritte), `shared/protokolle/hinweis.test.ts` (Hinweis/Zähler), `shared/protokolle/uebersicht.test.ts` (Ziehen), `protokolle/src/ToDos.haken.test.tsx` (Haken, 5 s und „Rückgängig“ mit Fake-Timern, mein Teil, nur Anzeige), `protokolle/src/todoSchreiben.test.ts` (zwei Teile nacheinander, Rechte im Schreibweg), `protokolle/src/ToDoFenster.test.tsx`, `protokolle/src/EditorBloecke.test.tsx`, `protokolle/src/FesterPunkt.test.tsx`, `protokolle/src/Startseite.test.tsx`; **nur von Hand:** Aussehen, echtes gleichzeitiges Abhaken zweier Konten, Handy
- **Historie:** 19.11.2026 (W8a: Alwin wollte bei „Alle“ auch „jeder für sich“; der Status-Knopf sprang beim Klick weiter)

</details>

### TF-PROT-23 · To-Do-Übersicht: Karte, Frist in Worten, Tabelle am Computer und die Kopfzeile

**Das brauchst du:** In der Test-Instanz **zwei** eingerichtete Gruppen, in der ersten mindestens **drei Mitglieder** (du als **Leitung**). Lege
dir Test-To-Dos an: „TEST Heute“ (Bis heute), „TEST Morgen“, „TEST Samstag“ (Bis in 2 bis 6 Tagen), „TEST Spät“ (Bis in zwei Wochen),
„TEST Alt“ (Bis vor einer Woche), „TEST Ohne“ (ohne Bis), „TEST Jeder“ (alle drei zuständig, **Jeder für sich**, einer hat schon abgehakt), „TEST Notiz“
(mit zwei Notizen, bei der letzten **Auf Karte anzeigen**), ein To-Do in der zweiten Gruppe und eins, das jemand anderes erledigt hat. Ein Rechner
mit breitem Fenster und ein Handy (oder das Browserfenster auf 390 px Breite).

**Das muss passieren:** Frist, Gesichter und Symbole stehen auf Karte und Tabelle gleich; am Computer ist die Liste eine Tabelle mit festen
Spalten, am Handy bleiben es Karten; „Nur meine“ und „Gruppieren nach“ stehen im Filter-Fenster der Werkzeugzeile.

1. **To-Dos → Liste** am **Handy**: Jede Karte hat vorn den Kreis, darüber klein und blau die Gruppe (weil zwei Gruppen im Spiel sind), darunter den Titel;
   darunter die Fußzeile: links das **Frist-Kästchen**, rechts die **Gesichter**. „TEST Alt“ zeigt **„seit …“ rot umrandet**, „TEST Heute“ und „TEST Morgen“
   **orange** mit den Worten „heute“ bzw. „morgen“, „TEST Samstag“ den **Wochentag** („Samstag“), „TEST Spät“ das **Datum**. Halte den Finger auf dem Kästchen
   (am Computer: Maus darauf): Es erscheint das volle Datum.
2. „TEST Jeder“: In der Fußzeile steht **☑ 1/3** (und kein Schild „in Arbeit“). Tippe darauf: Eine Liste klappt auf mit allen drei Namen, „✓ Datum“ oder
   „offen“. Noch ein Tipp klappt sie zu. „TEST Notiz“ zeigt unter dem Titel die **letzte Notiz** in einer leisen Zeile und die **Sprechblase mit 2**.
   Ein To-Do aus einer Sitzung zeigt das **Dokument-Symbol**; ein Tipp darauf springt in das Protokoll.
3. Das erledigte To-Do zeigt statt der Fußzeile **„Erledigt von … am …“** mit dem Gesicht, der Titel ist durchgestrichen und grau.
4. Am **Computer** (breites Fenster) sieht die Liste wie eine **Tabelle** aus: Haken · Aufgabe · Gruppe · Fällig · Zuständig · Stand · Überblick. Der Titel ist
   einzeilig abgeschnitten. „Stand“ zeigt „offen“ (grau), „in Arbeit“ (blau), „1 von 3 fertig“, bei Erledigten Gesicht und Datum. Mache das Fenster **schmaler**:
   Zuerst verschwindet die Spalte **Gruppe**, noch schmaler (unter etwa 720 px Breite des Kastens) werden es wieder **Karten**. Nichts läuft seitlich über.
   Hake in der Tabelle ein To-Do ab: Die Zeile bleibt 5 Sekunden, mit **Rückgängig** in der Zeile.
5. Das **Board** besteht auch am Computer aus Karten, die Fußzeile ist durch eine feine Linie abgesetzt. In der Spalte „In Arbeit“ fehlt das Schild „in Arbeit“.
6. Werkzeugzeile: Öffne **Filter** und tippe unter „Zuständig“ auf **Nur meine**: Es bleiben nur To-Dos, bei denen du zuständig bist; „Andere“ und „Noch niemand“
   sind abgehakt – es ist derselbe Filter, am Knopf steht die Zahl **2**. Nimm „Andere“ wieder dazu: Die Zahl wird **1**. **Alle** zeigt wieder alles.
7. **Filter → Gruppieren nach → Fälligkeit**: Die Bereiche heißen Überfällig · Diese Woche · Später · Ohne Frist · Erledigt, „TEST Heute“ steht in „Diese Woche“. Im **Board** gibt es
   nur „Status“ und „Person“ (die Wahl heißt dort „Spalten nach“). Neu laden: Die Wahl bleibt.
8. Öffne ein To-Do (Titel antippen): Die Felder stehen in der Reihenfolge **Was · Gruppe/Bis · Zuständig · So wird es erledigt · Status · Notiz**. Bei einem erledigten
   gemeinsamen To-Do steht unter dem Status „Erledigt von … am …“.
9. **Start**: „Meine offenen To-Dos“ zeigen vorn denselben Kreis (nur Anzeige) und dasselbe Frist-Kästchen; die Zeile bleibt als Ganzes antippbar.

<details><summary>Technisches</summary>

- **Priorität:** normal
- **Betrifft:** `shared/protokolle/frist.ts`, `shared/protokolle/uebersicht.ts`, `protokolle/src/ToDos.tsx`, `protokolle/src/ToDoKarte.tsx`, `protokolle/src/ToDoBausteine.tsx`, `protokolle/src/FristKaestchen.tsx`, `protokolle/src/useKastenBreite.ts`, `protokolle/src/Haken.tsx`, `protokolle/src/ToDoFenster.tsx`, `protokolle/src/Startseite.tsx`, `protokolle/src/todoEinstellungen.ts`
- **Automatisiert:** größtenteils – `shared/protokolle/frist.test.ts` (Frist in Worten je Zweig, Fälligkeits-Fächer), `shared/protokolle/uebersicht.test.ts` (Nach Fälligkeit, Board ohne Fälligkeit, Schnellfilter), `protokolle/src/useKastenBreite.test.ts` (Karten/Tabelle/Gruppe nach Breite), `protokolle/src/ToDos.karte.test.tsx` (Karte, Tabelle, Filter), `protokolle/src/ToDos.werkzeug.test.tsx` (Werkzeugzeile: jede Wahl im Filter einzeln, Handy), `protokolle/src/ToDos.test.tsx` (Gesichter, Symbole, Notizzeile), `protokolle/src/ToDoFenster.test.tsx` (Reihenfolge, „Erledigt von“), `protokolle/src/Startseite.test.tsx`; **nur von Hand:** Aussehen und Abstände (Handy, Tablet, Computer, Dunkelmodus), echte Breitenwechsel beim Verkleinern des Fensters
- **Historie:** 20.11.2026 (W8b: Karte zweiteilig, Frist in Worten, Tabelle am Computer, „Alle | Meine“, Nach Fälligkeit – Entwurf `todos-vorschlaege-v2`, von Alwin abgenommen)

</details>

### TF-PROT-24 · Werkzeugzeile der To-Dos und ein grüner Knopf „Neu ⌄“ in den Sitzungen

**Das brauchst du:** In der Test-Instanz eine eingerichtete Gruppe mit Kalender, du als **Leitung**, dazu ein **Mitglied** (z. B. „Benutzer
simulieren“) und ein Rechner und ein Handy (oder das Browserfenster auf 390 px Breite). Ein paar Test-To-Dos und -Sitzungen. Alles, was du anlegst,
beginnt mit „TEST“ und wird danach aufgeräumt.

**Das muss passieren:** Über den To-Dos steht **eine** Zeile (Ansicht links, Filter und „Neues To-Do“ rechts), über den Sitzungen steht **ein** grüner Knopf
**Neu ⌄** für alles, was etwas hinzufügt. Keine Funktion fehlt – was früher eine Zeile war, liegt einen Klick tiefer.

1. **To-Dos** am **Rechner**: Unter den Reitern steht nur eine Zeile: links **Liste | Board**, rechts **Filter** und der grüne Knopf **Neues To-Do**. Es gibt keine Überschrift
   „To-Dos“, keine Pillen „Alle | Meine“ und keine Knöpfe „Sortieren“ oder „Gruppieren“ mehr.
2. **Filter** öffnen: Oben stehen **Gruppieren nach** (Status · Fälligkeit · Person; im Board **Spalten nach** mit Status und Person) und **Reihenfolge**
   (Dringlichkeit · Bis-Datum · Alphabetisch · Manuell), dann **Zuständig** (mit den Kurzwegen **Alle** und **Nur meine**) und **Gruppen**. Wähle jede Möglichkeit einmal: Die Liste ändert sich
   sofort, das Fenster bleibt offen, nach dem Neuladen gilt die Wahl noch. Am Knopf steht **keine** Zahl, solange nichts ausgeblendet ist; nach **Nur meine** steht dort **2**.
3. **Handy**: Links steht ein blau hinterlegter Knopf **Liste ⌄**, rechts der **Filter** mit Rahmen und das grüne **+**. **Liste ⌄**
   antippen: Ein Blatt von unten bietet Liste und Board an; **Board** wählen: Das Blatt geht zu, das Board steht da.
4. **Sitzungen** als Leitung am Rechner: Rechts neben dem Gruppennamen steht der grüne Knopf **Neu ⌄**, sonst **kein** grüner Knopf auf der Seite; in der Karte „Kommend“ stehen keine
   Knöpfe mehr. Das Menü zeigt **Neues Protokoll · Neue Sitzung · Punkt vorschlagen** und, hinter einer Linie, **Protokoll nachtragen**. Jeder Eintrag öffnet sein
   Fenster (Neues Protokoll, Neue Sitzung mit Einladen, Punkt vorschlagen, Protokoll nachtragen) und das Menü ist dabei zu.
5. Am Handy dieselben Einträge im Blatt **Neu**; der Knopf zeigt dort Plus und Pfeil. **Hinweis:** Der schwebende Kreis unten rechts kommt in den Protokollen noch nicht vor
   (er folgt mit der Musik-App-Scheibe).
6. Als **Mitglied** (ohne Leitung): **Neu ⌄** bietet nur **Punkt vorschlagen**; fehlt die Mitarbeit-Kategorie der Gruppe, gibt es den Knopf gar nicht. In den To-Dos sieht das Mitglied
   dieselbe Zeile.

<details><summary>Technisches</summary>

- **Priorität:** normal
- **Betrifft:** `protokolle/src/ToDos.tsx`, `protokolle/src/ToDos.module.scss`, `protokolle/src/Sitzungen.tsx`, `ui/bedienung/OptionWaehlen.tsx`, `ui/bedienung/KopfKnopf.tsx`, `ui/bedienung/AnsichtWahl.tsx`, `ui/bedienung/Werkzeugzeile.tsx`, `ui/bedienung/FilterKnopf.tsx`
- **Automatisiert:** größtenteils – `protokolle/src/ToDos.werkzeug.test.tsx` (eine Zeile, jede Wahl im Filter einzeln und gemerkt, Zähler, Handy-Blatt), `protokolle/src/ToDos.karte.test.tsx` und `ToDos.board.test.tsx` (Nur meine als Kurzweg, Reihenfolge Manuell), `protokolle/src/SitzungFestlegen.test.tsx` (ein grüner Knopf, Reihenfolge der Einträge, Handy-Blatt), `protokolle/src/FruehereTreffen.test.tsx` und `Sitzungen.test.tsx` (nachtragen, Vorschlagen, nur mit Recht), `ui/bedienung/HinzufuegenMenue.test.tsx` (jeder Eintrag einzeln, Aktion bleibt nach dem Schließen), `ui/bedienung/KopfKnopf.test.tsx` (Pfeil); **nur von Hand:** Aussehen am Handy und Abstände
- **Historie:** 20.11.2026 (B6 „Ruhige Bedienung“, Entwurf Organigramm/Protokolle v2, E14: „Immer wenn was Grünes kommt, ist es etwas hinzufügen“)

</details>

### TF-PROT-25 · Rechte im To-Do: Mitarbeiter-Sicht

**Das brauchst du:** In der Test-Instanz eine eingerichtete Gruppe mit mindestens **drei Mitgliedern**, dazu zwei Konten: du als **Leitung** und ein
**Mitglied** (ohne Protokoll-Schreibrecht; z. B. „Benutzer simulieren“ – danach wieder beenden und in `/api/logs` nach „simulates“ sehen, dass nichts hängen blieb).
Lege als Leitung vier Test-To-Dos an: „TEST Eigen“ (nur das Mitglied zuständig), „TEST Geteilt“ (Mitglied und eine weitere Person), „TEST Niemand“ (niemand
zuständig) und „TEST Fremd“ (nur eine andere Person). Dazu ein Rechner und ein Handy (oder das Browserfenster auf 390 px Breite). In der Entwicklung zeigt
`?demo=mitglied` dieselbe Sicht.

**Das muss passieren:** Das Mitglied ändert nur, was zu seinem To-Do passt. Was es nicht ändern darf, steht als **normaler Text** im Fenster (kein ausgegrautes Feld),
ein Satz mit Schloss sagt, wer es ändert.

1. Als **Mitglied** in **To-Dos**: „TEST Fremd“ ist **nicht** zu sehen; „TEST Niemand“ hat vorn **keinen Haken** und rechts den Knopf **„Das mache ich“**
   (am Rechner in der Spalte „Zuständig“, am Handy unten rechts in der Karte).
2. „TEST Eigen“ öffnen: Text, Bis und Notiz sind **Felder**, unten links steht **Löschen**, bei „Zuständig“ steht der eigene Name als Text und darunter
   **„Abgeben an“**. Ändere Frist und Status auf **In Arbeit**, speichere: Es klappt. Wähle bei „Abgeben an“ ein anderes Mitglied: Es steht da, dass es danach nicht
   mehr zu sehen ist; speichere – das To-Do ist weg. (Als Leitung ist es jetzt bei dem anderen Mitglied zuständig; stelle es für die nächsten Schritte zurück.)
3. „TEST Geteilt“ öffnen: **Was ist zu tun?**, **Gruppe**, **Bis** und **Zuständig** stehen als **Text**, es gibt **kein** Löschen und keine Zuständigen-Liste. Unten
   ein Satz mit Schloss: „Hier hängen auch andere dran – Text, Frist und Zuständige ändert die Leitung.“ Notiz schreiben und **Erledigt** wählen, speichern: Es klappt.
4. „TEST Niemand“ öffnen: Unten steht **„Das mache ich“** statt „Speichern“, Status steht als Text, es gibt keine Notiz. Tippe darauf: Das Fenster geht zu, das
   To-Do ist **deins** (Haken wieder da, dein Gesicht statt des Knopfes). Öffne es noch einmal: Jetzt sind Text, Frist und Notiz Felder, **Löschen** ist da.
5. **Board** (nach Person): Ziehe „TEST Geteilt“ in die Spalte einer anderen Person: Es passiert nichts außer dem Hinweis **„Die Zuständigen ändert nur die Leitung.“**
   Ziehe „TEST Eigen“ nach **Noch niemand zuständig**: Hinweis „Du kannst es nur an ein anderes Mitglied abgeben.“ Ziehe ein To-Do ohne Zuständigen in **deine** Spalte:
   Du bist eingetragen.
6. **Neues To-Do** als Mitglied: Oben steht **„Wofür? Für mich | Vorschlag an die Gruppe“**; bei „Für mich“ steht bei „Zuständig“ fest dein Name (keine Liste, kein
   Feld für Externe) und „Anlegen“ legt es für dich an. („Vorschlag an die Gruppe“: siehe TF-PROT-26.)
7. Als **Leitung**: Alle vier To-Dos zeigen alle Felder, „Löschen“, die Zuständigen-Liste und „So wird es erledigt“ – kein Schloss-Satz.
8. **Entwurf:** Hat „TEST Eigen“ eine Aufgabe in einem Protokoll-**Entwurf**, steht beim Mitglied dort **Text als Text**, **kein Löschen** und ein Satz, dass die Leitung
   das im Entwurf macht; die Frist bleibt änderbar.
9. **Schreibweg:** Öffne als Mitglied „TEST Niemand“ und lass in der Leitungs-Sitzung „TEST Niemand“ inzwischen jemand anderem zuweisen; tippe dann „Das mache ich“: Eine
   Meldung sagt, dass das To-Do jemand anderem gehört – nichts wird überschrieben.

<details><summary>Technisches</summary>

- **Priorität:** hoch
- **Betrifft:** `shared/protokolle/aufgaben.ts`, `shared/protokolle/uebersicht.ts`, `protokolle/src/todoSchreiben.ts`, `protokolle/src/ToDoFenster.tsx`, `protokolle/src/ToDoKarte.tsx`, `protokolle/src/ToDos.tsx`, `protokolle/src/loeschen.ts`
- **Automatisiert:** größtenteils – `shared/protokolle/aufgaben.rechte.test.ts` (`toDoRechte`, `aenderungVerboten`, `anlegenVerboten`: jeder Fall, jedes Feld), `protokolle/src/todoSchreiben.test.ts` (Schreibweg: 409 für Text, Frist, Zuständige, Modus, Löschen, Anlegen, Verschieben; frisch gelesener Stand), `protokolle/src/ToDoFenster.test.tsx` (Mitarbeiter-Sicht: Text statt Feld, kein Löschen, „Abgeben an“, „Das mache ich“, neues To-Do für mich), `protokolle/src/ToDos.rechte.test.tsx` (Karte/Zeile: „Das mache ich“, Haken), `protokolle/src/ToDos.board.test.tsx` (Ziehen nur mit Recht); **nur von Hand:** Aussehen am Handy, echtes Zweikonto-Rennen
- **Historie:** 20.11.2026 (W9a, Alwin simulierte Manuel als Mitarbeiter und durfte in v1.2.0 alles ändern)

</details>

### TF-PROT-26 · To-Dos vorschlagen, übernehmen, ablehnen

**Das brauchst du:** In der Test-Instanz eine eingerichtete Gruppe mit zwei Konten: du als **Leitung** und ein **Mitglied** (ohne Protokoll-Schreibrecht; z. B. „Benutzer
simulieren“ – danach wieder beenden und in `/api/logs` nach „simulates“ sehen, dass nichts hängen blieb). Ein Rechner und ein Handy (oder Browser auf 375 px). In der
Entwicklung zeigt `?demo` die Leitungs-Sicht, `?demo=mitglied` die Mitglieder-Sicht (Gruppe „Technik-Team“).

**Das muss passieren:** Ein Vorschlag ist **kein To-Do**, bis die Leitung ihn übernimmt – er steht nur im Bereich „Vorgeschlagen“ über der Liste, in keiner Zahl und in keiner
Spalte. Aus demselben Eintrag wird beim Übernehmen ein gewöhnliches To-Do.

1. Als **Mitglied** in **To-Dos** auf **+ Neues To-Do**: Oben steht **„Wofür?“** mit **Für mich** und **Vorschlag an die Gruppe**. Wähle den Vorschlag: Die Überschrift heißt
   **„To-Do vorschlagen“**, es gibt **keine** Zuständigen-Liste, dafür **„Warum? (optional)“** und den Satz „Wer es macht, legt die Leitung fest, wenn sie den Vorschlag
   übernimmt.“ Der Knopf **Vorschlagen** geht erst mit Text. Schreibe „TEST Vorschlag A“, Bis in einer Woche, Warum „zum Testen“, **Vorschlagen**.
2. Über der Liste steht **„Vorgeschlagen · 1 offen“** mit „TEST Vorschlag A“ und **„wartet auf die Leitung“**; darunter der Satz „Übernimmt die Leitung deinen Vorschlag, wird er
   ein To-Do der Gruppe und verschwindet hier.“ „TEST Vorschlag A“ steht **nicht** in der Liste, nicht im Board (umschalten) und **nicht** in „Meine offenen To-Dos“ auf der
   Startseite; bei einem anderen Mitglied ist es gar nicht zu sehen.
3. Zeile antippen: **Ändern** (Fenster „Vorschlag ändern“, vorausgefüllt; ändere das Warum) und **Zurückziehen** (der Vorschlag verschwindet; mache danach einen neuen).
4. Als **Leitung**: Der Bereich zeigt **„Vorgeschlagen · 1 warten auf dich“** mit dem Vorschlag, „von <Name>“ und der Frist. Zeile antippen: **Übernehmen …** und
   **Ablehnen …** – kein Ändern, kein Zurückziehen.
5. **Übernehmen …**: Das Fenster heißt **„Vorschlag übernehmen“**, Text und Bis sind vorausgefüllt, oben steht „Vorschlag von <Name>. Wähle die Zuständigen – danach ist es ein
   To-Do der Gruppe und der Vorschlag verschwindet.“, unten **Übernehmen**, kein Löschen. Wähle eine Person, **Übernehmen**: Der Vorschlag ist aus dem Bereich weg und steht
   als gewöhnliches To-Do in der Liste (mit der Notiz „zum Testen“ im Verlauf: „hat das vorgeschlagen“, „hat den Vorschlag übernommen“). Das Mitglied sieht es jetzt (wenn es
   zuständig ist) mit Haken.
6. Vorschlag B (als Mitglied) → als Leitung **Ablehnen …**: Das Fenster fragt „Begründung (freiwillig – sieht <Name> 7 Tage lang)“. Schreibe „Haben wir schon“, **Ablehnen**. Als
   **Mitglied** steht B jetzt unter **„Abgelehnt · verschwindet nach 7 Tagen“** mit „Grund: Haben wir schon“ und „noch 7 Tage sichtbar“; **×** blendet ihn aus (bleibt nach dem
   Neuladen aus). Die Leitung sieht ihn dort auch.
7. **Als Leitung** zeigt „+ Neues To-Do“ die Wahl **„Wofür?“ nicht** – sie legt wie bisher an.
8. **Handy (375 px):** Der Bereich, die Zeilen und beide Fenster stehen ganz im Bild, nichts läuft über.
9. **Schreibweg:** Öffne als Mitglied einen eigenen offenen Vorschlag, lass inzwischen als Leitung **ablehnen**, dann im Fenster **Speichern**: eine Meldung sagt, dass der
   Vorschlag nicht mehr offen ist – nichts wird überschrieben.

<details><summary>Technisches</summary>

- **Priorität:** hoch
- **Betrifft:** `shared/protokolle/todoVorschlag.ts`, `shared/protokolle/aufgaben.ts`, `protokolle/src/todoVorschlagSchreiben.ts`, `protokolle/src/aufgabenSchreiben.ts`, `protokolle/src/lesen.ts`, `protokolle/src/mitarbeitWerte.ts`, `protokolle/src/ToDoVorschlaege.tsx`, `protokolle/src/ToDoFenster.tsx`, `protokolle/src/ToDos.tsx`
- **Automatisiert:** größtenteils – `shared/protokolle/todoVorschlag.test.ts` (Regeln, Rechte, Sichtbarkeit), `protokolle/src/todoVorschlagSchreiben.test.ts` (Schreibweg und Leser gegen die nachgestellte ChurchTools-Instanz: 409, Übernehmen, Nachlesen), `protokolle/src/todoVorschlagLeser.test.tsx` (Reiter To-Dos, Startseite, Zähler), `protokolle/src/ToDos.vorschlaege.test.tsx` (Bereich, Fenster, Wahl), `protokolle/src/ProtokollSchreiben.test.tsx` (feste Punkte); **nur von Hand:** Aussehen am Handy, echtes Zweikonto-Rennen
- **Historie:** 20.11.2026 (W9b, Entwurf `todos-rechte-w9-v1`)

</details>
