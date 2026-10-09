# Ablauf bearbeiten

⚠️ **Achtung: Diese Tests ändern echte Daten in ChurchTools.** Bitte an einem Test-Termin
durchführen, nicht am Gottesdienst des kommenden Sonntags.

In den Bearbeiten-Modus kommst du so: **Termin öffnen → oben rechts auf Bearbeiten tippen.**

### TF-EDIT-01 · Lied verknüpfen und wieder lösen

**Das brauchst du:** Einen **Test-Termin** mit einem Punkt, an dem noch kein Lied hängt.

**Das muss passieren:** In ChurchTools ist der Punkt danach ein richtiger **Lied-Punkt** mit
Arrangement – er darf nicht zu einem einfachen Text-Punkt geworden sein.

Das ist der heikelste Schreibvorgang der App: Wird ein Lied-Punkt versehentlich zu Text
herabgestuft, lässt sich das **in ChurchTools nicht rückgängig machen**. Deshalb steht dieser Fall
bei jedem Testlauf mit dabei.

1. Test-Termin öffnen, oben rechts **Bearbeiten**.
2. Den Punkt ohne Lied antippen – der Dialog **Eintrag bearbeiten** geht auf.
3. Auf **Lied verknüpfen** tippen.
4. Einen Liedtitel eintippen und einen Treffer antippen.
5. **Speichern**.
6. In ChurchTools im Browser denselben Ablauf öffnen und den Punkt ansehen.
7. Zurück in der App: den Punkt wieder antippen → **Verknüpfung aufheben** → **Speichern**.
8. Nochmal in ChurchTools nachsehen.

<details><summary>Technisches</summary>

- **Priorität:** kritisch
- **Betrifft:** `server/src/services/agendaPayload.ts`, `server/src/services/ctWrite.ts`, `client/src/components/ItemActionSheet.tsx`, `client/src/components/SongPicker.tsx`
- **Automatisiert:** teilweise – `server/src/services/agendaPayload.test.ts`
- **Historie:** –

</details>

### TF-EDIT-02 · Den Titel eines Lied-Punkts ändern

**Das muss passieren:** In der Liste steht **„Eingangslied – <Liedname>"**, also beides. Wenn du in
Schritt 6 genau den Liednamen einträgst, steht er nur **einmal** da, nicht doppelt.

1. Test-Termin öffnen, **Bearbeiten**.
2. Einen **Lied**-Punkt antippen.
3. Ins Feld **Titel** tippen, alles löschen, „Eingangslied" eintragen.
4. **Speichern**.
5. Die Zeile in der Liste ansehen.
6. Denselben Punkt nochmal öffnen und als Titel **genau den Liednamen** eintragen, speichern.

<details><summary>Technisches</summary>

- **Priorität:** hoch
- **Betrifft:** `client/src/components/ItemActionSheet.tsx`, `client/src/utils/agendaItemTitle.ts`, `client/src/utils/agendaItemChanges.ts`, `client/src/components/AgendaRowParts.tsx`
- **Automatisiert:** ja – `client/src/utils/agendaItemTitle.test.ts`, `client/src/utils/agendaItemChanges.test.ts`
- **Historie:** #200

</details>

### TF-EDIT-03 · Dauer, Zuständig, Bemerkung

**Das muss passieren:** Alles steht danach auch in ChurchTools. Nach Schritt 6 ist die Dauer aus der
Zeile verschwunden (in ChurchTools steht dann 0 Minuten – „keine Dauer" kennt ChurchTools nicht).

1. Test-Termin öffnen, **Bearbeiten**, einen Punkt antippen.
2. **Dauer (Minuten)** auf 7 setzen.
3. Bei **Zuständig** einen Namen eintragen.
4. Bei **Bemerkung** „Test" eintragen.
5. **Speichern** und die Zeile ansehen.
6. Punkt erneut öffnen, das Feld **Dauer** ganz leeren, **Speichern**.

<details><summary>Technisches</summary>

- **Priorität:** normal
- **Betrifft:** `client/src/components/ItemActionSheet.tsx`, `client/src/utils/agendaItemChanges.ts`, `client/src/components/ResponsibleField.tsx`
- **Automatisiert:** teilweise – `client/src/utils/agendaItemChanges.test.ts`
- **Historie:** – (der frühere Schritt „Uhrzeit ausblenden" ist mit #423 entfallen, siehe TF-EDIT-08)

</details>

### TF-EDIT-04 · Reihenfolge per Ziehen ändern

**Das muss passieren:** Der Punkt landet an der neuen Stelle, und so steht es auch in ChurchTools.
Beim Ziehen ans untere Ende **scrollt die Liste von selbst mit**. Schritt 5 öffnet den Dialog –
tippen auf den Titel darf **kein** Ziehen auslösen.

1. Test-Termin öffnen, **Bearbeiten**.
2. Einen Punkt am **Griff rechts** (die drei Striche) anfassen.
3. Zwei Positionen nach unten ziehen und loslassen.
4. Denselben Punkt bis ans **untere Ende** der Liste ziehen.
5. Auf den **Titel** einer Zeile tippen (nicht auf den Griff).
6. Dialog schließen, in ChurchTools die Reihenfolge prüfen.

<details><summary>Technisches</summary>

- **Priorität:** hoch
- **Betrifft:** `client/src/components/AgendaSortableRow.tsx`, `client/src/pages/Setlist.tsx`, `client/src/utils/dndAutoScroll.ts`
- **Automatisiert:** nein – Ziehen mit dem Finger
- **Historie:** –

</details>

### TF-EDIT-05 · Punkt hinzufügen und löschen

**Das muss passieren:** Das **runde blaue Plus** schwebt unten rechts über dem Ablauf (nur im
Bearbeiten-Modus) und öffnet **dasselbe Fenster wie das Bearbeiten**, nur mit „Neuer Eintrag" und dem
Umschalter **Programmpunkt · Überschrift** (vorgewählt: Programmpunkt). Ein Lied ist ein Programmpunkt
mit **Lied verknüpfen** – nach der Wahl steht der Liedname als Titel drin, Dauer und Zuständige lassen
sich gleich setzen; ein zweites Fenster danach gibt es nicht mehr. Die Rückfrage beim Löschen nennt den Punkt **genauso wie die Liste** – also
„Lied – Du großer Gott", nicht nur den Liednamen. Der gelöschte Punkt zerfällt sichtbar an seiner
Stelle. Alles steht danach so in ChurchTools.

1. Test-Termin öffnen, **Bearbeiten**. Das Plus erscheint unten rechts; es verdeckt den Stift des
   letzten Punkts nicht.
2. **Plus** tippen → das Fenster **„Neuer Eintrag"** ist offen, **Programmpunkt** ist gewählt. Titel
   eintragen, **Dauer** auf 7 setzen, **Hinzufügen**.
3. Erneut **Plus** → **Lied verknüpfen** → ein Lied wählen: Der Liedname steht als Titel drin.
   **Dauer** auf 4 setzen, **Hinzufügen**.
4. Erneut **Plus**, oben **Überschrift**: nur das Titelfeld. Titel eintragen, **Hinzufügen**.
5. Alle drei stehen am Ende des Ablaufs.
6. Einen **Lied**-Punkt antippen und **Eintrag löschen** wählen.
7. Die Rückfrage lesen, dann bestätigen.
8. Zusehen, wie die Zeile verschwindet.

<details><summary>Technisches</summary>

- **Priorität:** normal
- **Betrifft:** `client/src/components/ItemActionSheet.tsx`, `client/src/utils/agendaItemChanges.ts`, `client/src/components/SchwebePlus.tsx`, `client/src/pages/Setlist.tsx`, `client/src/components/ConfirmDialog.tsx`
- **Automatisiert:** teilweise – `e2e/ablauf-hinzufuegen.spec.ts` (Plus nur im Bearbeiten-Modus, Text anlegen, steht in der Liste, Löschen), `client/src/components/ItemActionSheet.test.tsx` (Neuer Eintrag: Suche sofort offen, Titel = Liedname, Überschrift nur Titel, Fehler bleibt im Fenster), `client/src/utils/agendaItemChanges.test.ts` (`neuerAgendaPunkt`); von Hand bleibt das Schreiben nach ChurchTools
- **Historie:** schwebendes Plus und einheitlicher Dialog 05.10.2026 (vorher eigenes „Hinzufügen"-Blatt mit drei Formularen)

</details>

### TF-EDIT-06 · Die Tastatur verdeckt den Dialog nicht

**Das brauchst du:** Ein **iPhone** – auf dem kleinen Bildschirm zeigt sich das Problem am
deutlichsten.

**Das muss passieren:** In Schritt 4 sind die **Treffer sichtbar** und antippbar, ohne dass du erst
nach oben wischen musst. Nach Schritt 6 sitzt die obere Leiste wieder normal – keine Lücke, keine
verschobenen Symbole.

1. Test-Termin öffnen, **Bearbeiten**, einen Punkt antippen.
2. Ins Feld **Titel** tippen – die Tastatur geht auf.
3. Auf **Lied verknüpfen** tippen.
4. Zwei, drei Buchstaben eintippen und auf die Trefferliste schauen.
5. Einen Treffer antippen.
6. **Speichern** und auf die obere Leiste schauen.

<details><summary>Technisches</summary>

- **Priorität:** hoch
- **Betrifft:** `ui/fenster/useOverlayKeyboardInset.ts`, `client/src/components/ItemActionSheet.tsx`, `ui/fenster/Sheet.tsx`
- **Automatisiert:** teilweise – `ui/fenster/useOverlayKeyboardInset.test.tsx`
- **Historie:** #207

</details>

### TF-EDIT-07 · Beim Verknüpfen ein neues Lied anlegen

⚠️ **Legt ein echtes Lied in ChurchTools an** – hinterher dort wieder wegräumen (die App kann Lieder nur
über das Stammdaten-Blatt löschen, TF-LIB-04).

**Das brauchst du:** Einen **Test-Termin** mit einem Punkt ohne Lied und ein Konto mit dem Recht, Lieder
zu bearbeiten.

**Das muss passieren:** Das neue Lied entsteht **ohne** neuen Ablaufpunkt und hängt nach „Speichern" an
dem Punkt, den du bearbeitet hast – in ChurchTools ein Lied-Punkt mit Arrangement, der Ablauf hat
**keinen** Punkt mehr als vorher.

1. Test-Termin öffnen → **Bearbeiten** → den Punkt ohne Lied antippen → **Lied verknüpfen**.
2. Einen Titel eintippen, den es bei euch nicht gibt. Oben rechts steht **„Neues Lied"**, mit
   SongSelect-Lizenz erscheint darunter auch die SongSelect-Gruppe.
3. **„Neues Lied"** antippen: Das Formular ist mit dem Suchbegriff als Titel vorbelegt. Kategorie wählen,
   **Lied anlegen**.
4. Die Erfolgsansicht sagt „… ist angelegt **und wird mit dem Eintrag gespeichert**". Es
   gibt **„Zurück zum Eintrag"** und „Notenblatt schreiben", aber **kein** „Noch ein Lied anlegen".
5. **Zurück zum Eintrag** (oder „Fertig"): Du bist wieder in **Eintrag bearbeiten**, im Feld „Lied" steht
   der neue Name mit dem Hinweis **„Wird beim Speichern verknüpft."**
6. **Speichern**. In ChurchTools nachsehen: Punkt ist ein Lied-Punkt, Anzahl der Punkte unverändert.
7. Gegenprobe Abbruch: Schritte 1–3 mit „Abbrechen" im Formular verlassen → zurück in der Suche, im Dialog
   ist **nichts** vorgemerkt.
8. Mit einem Konto **ohne** das Recht, Lieder zu bearbeiten: im Verknüpfen-Fenster weder „Neues Lied"
   noch SongSelect.

<details><summary>Technisches</summary>

- **Priorität:** hoch
- **Betrifft:** `client/src/components/ItemActionSheet.tsx`, `client/src/components/NewSongSheet.tsx`, `client/src/components/SongPicker.tsx`
- **Automatisiert:** teilweise – `client/src/components/ItemActionSheet.test.tsx` (Weg nur mit Recht, ohne `eventId`, Vormerken statt Schreiben, Abbruch merkt nichts vor), `client/src/components/NewSongSheet.test.tsx` (Erfolgsansicht mit `onVerknuepfen`: Satz, „Zurück zum Eintrag" und „Fertig" tragen die Verknüpfung, kein „Noch ein Lied anlegen"); von Hand bleibt der Schreibvorgang gegen ChurchTools
- **Historie:** #391 (18.09.2026)

</details>

### TF-EDIT-08 · Soundcheck vor dem Gottesdienstbeginn

**Das brauchst du:** Einen **Test-Termin**, der um 10:00 beginnt, mit einem Punkt „Soundcheck"
(45 Minuten) ganz oben und mindestens zwei Punkten darunter.

**Das muss passieren:** Der Soundcheck läuft **vor** dem Beginn. Er steht bei 09:15, der Punkt danach
bei 10:00, und dazwischen steht die Linie **„Beginn · 10:00 Uhr"**. Der Termin selbst bleibt um 10:00, in
der App wie im ChurchTools-Kalender.

1. Test-Termin öffnen → **Bearbeiten** → **Soundcheck** antippen.
2. **Vor Gottesdienstbeginn** einschalten. Der Hinweis darunter lautet „Dieser und alle Punkte darüber
   laufen vor dem Beginn." **Speichern**.
3. Die Linie „Beginn · 10:00 Uhr" steht unter dem Soundcheck. Mit **Fertig** zurück in die Ansicht: Dort
   steht sie an derselben Stelle, der Soundcheck zeigt 09:15 in grauer Schrift.
4. In ChurchTools im Browser den Ablauf öffnen: Der Soundcheck steht vor dem Veranstaltungsbeginn, der
   Termin beginnt weiter um 10:00.
5. Zurück in der App: **Bearbeiten**, den **Punkt direkt unter der Linie** über die Linie nach oben
   ziehen. Die Linie bleibt an ihrem Platz, der gezogene Punkt steht jetzt darüber und läuft vor dem
   Beginn, der Soundcheck rutscht darunter. (So rechnet ChurchTools: Die Grenze ist ein Platz, kein
   Punkt.) Reihenfolge wieder zurückziehen.
6. **Soundcheck** öffnen, **Vor Gottesdienstbeginn** ausschalten, **Speichern**: Die Linie verschwindet,
   der Soundcheck steht wieder bei 10:00.
7. Im Bearbeiten-Dialog gibt es **keinen** Schalter „Uhrzeit ausblenden" mehr.

<details><summary>Technisches</summary>

- **Priorität:** hoch
- **Betrifft:** `client/src/components/ItemActionSheet.tsx`, `client/src/components/AgendaFullView.tsx`, `client/src/pages/Setlist.tsx`, `client/src/utils/vorlauf.ts`, `server/src/services/ctWrite.ts`, `server/src/services/agendaPayload.ts`
- **Automatisiert:** teilweise – `e2e/ablauf-vorlauf.spec.ts` (Schalter → Grenze im Stub → Linie in Bearbeiten-Liste und Ansicht, wieder aus), `client/src/utils/vorlauf.test.ts`, `server/src/services/agendaPayload.test.ts`, `server/src/services/ctWrite.test.ts`; von Hand bleiben die echten Uhrzeiten aus ChurchTools und das Ziehen über die Linie (Schritt 5)
- **Historie:** #423 (05.10.2026)

</details>
