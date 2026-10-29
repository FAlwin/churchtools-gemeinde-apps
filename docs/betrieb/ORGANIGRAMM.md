# Organigramm – ChurchTools-Erweiterung

> **Stand: O7b-6b (29.10.2026)** – der ganze Baum (Bereiche als Karten, Gruppen mit Personen, Leitung, Diensten und
> offenen Plätzen; Gruppenfenster; Gruppentypen ausblendbar), die **Präsentation** (für Gruppen-Admins auch die
> **neue Gliederung**), für Gruppen-Admins **Gruppen umhängen und anlegen** und den Reiter **Neue Gliederung** (Plan
> und Umbau) und – für alle, die es in ChurchTools dürfen – **Leitung und Mitglieder pflegen**. Für die **Leitung eines
> Bereichs** dazu die Reiter **Personen** und **Hinweise**. Seit O7b weitere Ansichten – von oben, von links, Mindmap
> und Liste, auch in der Präsentation und als PDF, überall auf Wunsch mit den Personen. Als Nächstes: sichtbare Gruppen
> zentral einstellen (O7b-7), danach (O8) der echte Umbau der Gemeindestruktur. Diese Anleitung wächst mit.

Das Organigramm zeigt die Gemeinde als Baum – Bereiche, Gruppen, Personen – so, wie die Gruppen-Hierarchie in
ChurchTools steht, und hilft, die Organisation darin weiterzubauen. **Alles liegt in ChurchTools** – es gibt keinen
eigenen Server.

## Installieren

1. Bei den [Releases](https://github.com/FAlwin/churchtools-gemeinde-apps/releases) die neueste Datei
   **`organigramm-v….zip`** herunterladen (nicht entpacken). Die Organigramm-Releases heißen „Organigramm v…“.
2. In ChurchTools: **Administration → Erweiterungen → Erweiterung hinzufügen**.
3. Ausfüllen:
   - **Name:** z. B. „Organigramm“ – so heißt der Menüpunkt.
   - **Kürzel:** genau **`organigramm`**. Die Erweiterung ist für diese Adresse gebaut (`/ccm/organigramm/`);
     mit einem anderen Kürzel lädt sie nicht.
   - **Im Menü anzeigen:** an.
   - **ZIP-Datei:** die heruntergeladene Datei.
4. **Speichern.**

**Aktualisieren:** beim Eintrag auf den Stift und die neue ZIP hochladen, sonst nichts ändern.

> ⚠️ Es gibt eine andere Organigramm-Erweiterung mit dem Kürzel `organigram` (ohne zweites „m“, von Dritten).
> Beide können nebeneinander installiert sein, heißen dann aber im Menü gleich – im Namen unterscheiden.

## Rechte

Die Erweiterung kann nichts, was die Person in ChurchTools nicht auch selbst dürfte – sie arbeitet mit deren
Sitzung. **Ein eigenes Rechte-System gibt es nicht.** Gemessen an der Test-Instanz (19. und 22.10.2026):

| Wer                             | Sieht / darf                                                                                | Woher (ChurchTools)                           |
| ------------------------------- | ------------------------------------------------------------------------------------------- | --------------------------------------------- |
| alle mit Zugang zur Erweiterung | die Gruppen, die ChurchTools ihnen zeigt, und den Baum                                      | Erweiterung „Organigramm“ sehen               |
| Mitglied einer Gruppe           | deren Mitglieder **und die aller Untergruppen** – nicht die der Obergruppe                  | Mitgliedschaft (Rechte wirken nur nach unten) |
| Leitung einer Gruppe            | Personen aufnehmen, Rollen ändern (O6) – **nicht** austragen, umhängen oder Gruppen anlegen | Rolle mit Leitung                             |
| Leitung einer Gruppe            | Reiter Personen und Hinweise für diese Gruppe **samt Untergruppen** (O3)                    | Rolle mit Leitung                             |
| Gruppen-Admin                   | alle Personen und Hinweise (O3); umhängen und anlegen (O5); alles an Mitgliedern (O6)       | „Gruppen verwalten“ / „Gruppen bearbeiten“    |

## Ansichten (ab O7b)

Über dem Baum wählt man, **wie** er aussieht:

- **Karten** – wie bisher: je Bereich eine Karte, darin die Gruppen mit Personen, Leitung und Diensten.
- **Von oben** – das klassische Organigramm: die Gemeinde oben, die Bereiche nebeneinander, darunter die Gruppen
  gestapelt. **Von links** – derselbe Baum zur Seite, jede Ebene eine Spalte. **Mindmap** – die Gemeinde in der Mitte,
  die Bereiche nach rechts und links verteilt. Im Kästchen steht der Name – auf Wunsch darunter die Personen (siehe
  **Personen** unten); ein Klick (oder Enter) öffnet die Gruppe, das runde **+/−** klappt auf und zu (zugeklappt steht dort die Zahl der Untergruppen).
  **Ziehen** verschiebt, **Mausrad** oder **zwei Finger** zoomen, dazu **−**, **+** und **Ganz zeigen** (lässt unten den
  Streifen der Knöpfe frei, seit O7b-5). Passt alles lesbar hinein, ist anfangs alles zu sehen; sonst beginnt das Bild
  lesbar groß an der Spitze. Mit der Tastatur
  (Tab) springt das Bild zum gewählten Kästchen.
- **Liste** – die Gemeinde als Gliederung mit Linien, die Namen der Gruppen (auf Wunsch mit den Personen). Jede Gruppe
  mit Untergruppen klappt mit dem Pfeil auf und zu; anfangs sind die Gemeinde und die Bereiche offen, darunter steht
  „3 Untergruppen“. Gut am Handy.
- **Personen: Aus · Rollen · Alle** (Diagramme und Liste, seit O7b-6; rechts neben den Gruppentypen) – was unter dem
  Namen einer Gruppe steht. **Aus** (vorgegeben): nur der Name. **Rollen**: die Rollen der Gruppe genau wie in
  ChurchTools, darunter die Namen – die Leitung zuerst (Leiter, Co-Leiter), dann die übrigen Rollen in der Reihenfolge
  von ChurchTools (z. B. Coach, Organisator), die Standardrolle des Gruppentyps (Mitarbeiter bzw. Teilnehmer) zuletzt
  und nur als Zahl („6 Mitarbeiter“). **Alle**: auch die Standardrolle mit Namen. Nichts wird weggelassen oder dazu
  erfunden – auch eine in ChurchTools versteckte Rolle steht da. Wo ChurchTools einem die Mitglieder nicht zeigt, steht
  „Mitglieder nicht sichtbar“; eine Gruppe ohne eigene Mitglieder (oft eine Obergruppe) zeigt nur den Namen. Die
  Kästchen werden dann größer, der Blick fängt neu an. Die Wahl merkt sich das Gerät; sie gilt auch für die Diagramme
  der Präsentation (dort oben derselbe Umschalter) und gibt im PDF vor, ob das Häkchen **Personen** gesetzt ist.
- **Alle aufklappen** / **Alle zuklappen** (Liste und Diagramme) wirken nur unter der Spitze.
- **Anfangen bei:** die ganze Gemeinde oder ein Bereich – dann zeigen alle Ansichten nur ihn. Im Gruppenfenster jeder
  Gruppe mit Untergruppen steht **„Im Organigramm hier anfangen“**; die Gruppe steht dann zusätzlich in der Auswahl.
  Blendet der Typ-Filter die Spitze aus, gilt wieder die ganze Gemeinde.
- Die gewählte Ansicht **merkt sich das Gerät** (wie den Typ-Filter). Ohne Wahl: am Handy die Liste, sonst **von
  oben**. Als PDF gibt es die Ansichten seit O7b-4, in der Präsentation seit O7b-5.
- Eine Gruppe mit zwei Obergruppen steht wie in ChurchTools unter beiden und klappt an jeder Stelle für sich.

## Als PDF speichern und drucken (ab O7b-4)

Im Reiter Organigramm oben rechts **„PDF / Drucken“** (am Handy nur das Symbol). Das Fenster übernimmt Ansicht,
„Anfangen bei“ und was aufgeklappt ist, und zeigt das Blatt als **Vorschau** – genau diese Seiten werden zur PDF:

- **Ansicht:** von oben, von links, Mindmap oder Liste (Karten gibt es auf Papier nicht – dann von oben).
- **Ausschnitt:** ganze Gemeinde, ein Bereich oder die Gruppe aus „Hier anfangen“.
- **Papier:** **Passend** (vorgegeben: das A4, quer oder hoch, auf dem das Diagramm am größten wird; eine Liste steht
  hoch), A4 quer, A4 hoch, A3 quer oder A3 hoch. Ein Diagramm steht auf **einer Seite**, die Schrift wird höchstens
  11 pt groß; unter 6 pt rät das Fenster zu A3, einem Ausschnitt oder „Alles aufgeklappt“ aus. Eine Liste läuft über
  mehrere Seiten (in der Vorschau zum Blättern).
- **Alles aufgeklappt** (vorgegeben) – sonst so, wie es im Reiter auf- und zugeklappt ist.
- **Personen** (ab O7b-6b) – unter jeder Gruppe ihre Rollen und Personen wie im Reiter, im Diagramm und in der Liste
  (dort etwas eingerückt unter dem Namen, vor den Untergruppen). Angehakt ist es, wenn der Reiter Personen zeigt; es
  zeigt dann dieselbe Stufe – steht der Reiter auf „Aus“, die **Rollen** (Standardrolle als Zahl). Kursiv gibt es auf
  Papier nicht (eingebettet ist nur Lato normal und fett); der Text ist derselbe.
- **Logo der Gemeinde** – das Logo aus ChurchTools (Einstellung „Logo“, dasselbe wie oben links in der Leiste) steht
  oben links. Ohne Logo in ChurchTools gibt es die Wahl nicht.
- Auf jeder Seite: oben „Organigramm“, Gemeinde (und Ausschnitt), Stand-Datum; unten Gemeinde und „Seite x von y“.
  Schrift Lato wie in ChurchTools; immer hell, auch wenn ChurchTools dunkel eingestellt ist.
- **PDF öffnen** zeigt die PDF in einem neuen Tab – von dort **drucken** (Querformat bleibt quer, ohne Adresse und
  Datum des Browsers am Rand) oder sichern. Am iPad dort „Teilen“ → „Drucken“ oder „In Dateien sichern“. Sperrt der
  Browser das neue Fenster, wird die PDF heruntergeladen. **Herunterladen** speichert sie direkt
  (`Organigramm-<Ausschnitt>-<Datum>.pdf`).

Warum eine eigene PDF statt des Druckfensters des Browsers: Safari hielt sich beim Drucken nicht an das Querformat und
druckte Adresse und Datum an den Rand (Test 28.10.2026, `organigramm-planung/docs/messung-o7b-4-2026-10-28.md`).

## Präsentation (ab O4)

Im Reiter Organigramm steht oben rechts neben „Hallo …“ **„Präsentieren“** (am Handy nur das Symbol) – für alle, die
die Erweiterung sehen. Die Präsentation legt sich über
ChurchTools:

- **Übersicht:** die Bereiche als Kacheln mit Leitung, Gruppen und Zahl der Personen. Klick auf eine Kachel öffnet
  den Bereich.
- **Bereich:** jede Gruppe als Spalte mit allen Personen darunter (jede einmal, Leitung zuerst); die Untergruppen
  lassen sich aufklappen.
- **Weiter/Zurück** unten, oder mit der Tastatur: Pfeile, Bild auf/ab, Leertaste · **Pos1** = Übersicht · **Esc** =
  zurück zur Übersicht, dort schließen · **F** = Vollbild (am Laptop; am iPad gibt es den Knopf nicht).
- **Ansichten** (ab O7b-5): oben **Kacheln · Von oben · Von links · Mindmap**. Die Seiten bleiben dieselben –
  Übersicht, dann Bereich für Bereich –, der Umschalter ändert nur, wie eine Seite aussieht: **Kacheln** wie oben
  beschrieben, die Diagramme zeigen auf der Übersicht die ganze Gemeinde und auf einer Bereichs-Seite den Bereich als
  Baum (anfangs ganz aufgeklappt, mit **+/−** zuklappbar, ziehen und zoomen wie im Reiter). Im Diagramm der Übersicht
  öffnet ein Klick auf einen Bereich seine Seite. Die gewählte Ansicht merkt sich das Gerät. In den Diagrammen steht oben
  zusätzlich **Personen: Aus · Rollen · Alle** (ab O7b-6b) – dieselbe Wahl wie im Reiter, hier geändert gilt sie auch
  dort. Neue Gruppen der neuen Gliederung haben noch niemanden und zeigen nur den Namen.
- Es gilt dieselbe Auswahl der Gruppentypen wie im Baum (z. B. Verteiler ausgeblendet).
- Wer nicht alle Mitglieder sehen darf, sieht dort „Mitglieder nicht sichtbar“ – „gesucht“ steht nur, wo wirklich
  niemand eingetragen ist.
- **Neue Gliederung | Heute** (ab O7-4, nur Gruppen-Admins mit einem Plan): Oben in der Präsentation umschalten. Sie
  beginnt mit der **neuen Gliederung** – neue Gruppen und neue Namen aus dem Plan, Gruppen, die archiviert werden,
  fehlen. Neue Gruppen haben noch niemanden („Mitarbeitende gesucht“). Wer kein Gruppen-Admin ist oder wenn es keinen
  Plan gibt, sieht den Stand **heute** in ChurchTools, ohne Umschalter.

## Personen und Hinweise (ab O3)

Nur für die **Leitung eines Bereichs**: Wer eine Gruppe leitet, sieht deren Personen und Hinweise samt allen
Untergruppen; Gruppen-Admins sehen alles; wer nichts leitet, sieht nur den Baum.

- **Einsätze** kommen aus den Terminen der letzten 6 und der nächsten 3 Monate – **soweit ChurchTools sie der Person
  zeigt**. Gezählt wird jede Einteilung (zugesagt oder angefragt). Nicht gezählt: abgesagte Termine, „Namen
  verbergen“, Gäste ohne Person.
- **Offene Plätze** („x offen“ im Baum) sind freie Plätze in kommenden Terminen; gehört ein Dienst zu mehreren
  Gruppen, steht die Zahl nur an der ersten.
- **Hinweise:** Teams ohne Leitung · Personen, die fast jede Woche dienen (ab 24 Einsätzen in 6 Monaten) · Personen in
  einem Dienst-Team ohne Einsatz · offene Mitgliedsanfragen (annehmen oder ablehnen in ChurchTools).
- Lassen sich die Termine gerade nicht laden, steht das da („Erneut versuchen“); die Hinweise, die Einsätze brauchen,
  entfallen dann.

## Gruppen umhängen und anlegen (ab O5)

Nur wer es in ChurchTools darf: Gruppen-Admins („Gruppen verwalten“) oder wer die Gruppe bzw. ihren Gruppentyp
bearbeiten darf; anlegen nur in den Typen, für die man das Recht „Gruppen anlegen“ hat. **Leitungen dürfen das in
ChurchTools nicht** – bei ihnen fehlen die Knöpfe.

Im **Gruppenfenster** (Klick auf eine Gruppe) unter „Gehört zu“:

- **Ändern** – die Gruppe bekommt eine andere Obergruppe. Gewählt wird aus einer Liste mit Suche; die Gruppe selbst,
  ihre Untergruppen und ihre jetzigen Obergruppen stehen nicht darin.
- **Lösen** – die Gruppe hängt nicht mehr unter dieser Obergruppe. War es die letzte, ist sie danach ein eigener Bereich.
- **＋ Weitere Obergruppe** – ChurchTools erlaubt mehrere Obergruppen; die Gruppe steht dann unter beiden.
- **＋ Untergruppe anlegen** – Name und Gruppentyp (vorbelegt mit dem Typ der Obergruppe), Status „aktiv“. Leitung und
  Mitglieder kommen danach in ChurchTools dazu.

Vor jeder Änderung steht, was sich an den **Rechten** ändert: Rechte wirken in ChurchTools nach unten – wer in der neuen
Obergruppe ist, sieht danach auch diese Gruppe samt Untergruppen; wer sie nur über die alte sah, sieht sie nicht mehr.
Danach zeigt das Fenster **„Rückgängig“** (auch eine neue Gruppe lässt sich so wieder löschen).

## Leitung und Mitglieder pflegen (ab O6)

Im **Gruppenfenster** – für alle, die es in ChurchTools dürfen. Die Erweiterung fragt ChurchTools je Gruppe, was die
eigene Rolle dort erlaubt; Gruppen-Admins dürfen alles. In der Test-Instanz dürfen **Leitungen aufnehmen und Rollen
ändern, aber nicht austragen** (dann fehlt der Knopf).

- **＋ Person aufnehmen** – Namen suchen (mindestens zwei Buchstaben), Person wählen, Rolle wählen (vorbelegt mit der
  Standardrolle, z. B. „Mitarbeiter“), **Aufnehmen**. Nur Personen, die es in ChurchTools schon gibt; wer schon dabei
  ist, steht als „schon dabei“ da.
- **Rolle** an einer Person – z. B. zur Leitung machen. Zur Wahl stehen die Rollen des Gruppentyps.
- **Austragen** an einer Person – die Mitgliedschaft **endet heute**. Sie wird nicht gelöscht: In ChurchTools steht sie
  weiter in der Historie der Person.
- Nach jeder Änderung steht im Fenster **„Rückgängig“**.

## Neue Gliederung (ab O7-2)

Nur für **Gruppen-Admins**: Im Reiter **Neue Gliederung** entsteht der Plan, wie die Gemeinde künftig gegliedert ist.
**ChurchTools ändert sich dabei nicht** – das geschieht erst im **Umbau** (siehe unten).

- **Plan anlegen** kopiert die heutige Gliederung. Es gibt **einen** Plan für alle Gruppen-Admins; oben steht, wer
  zuletzt gespeichert hat.
- **Klick auf eine Gruppe:** im Plan **umbenennen**, **woanders einhängen** (Liste mit Suche; die eigenen Untergruppen
  stehen nicht zur Wahl), eine **Untergruppe** anlegen, **archivieren** (in ChurchTools später Status „archiviert“,
  nichts wird gelöscht) – oder eine neue Gruppe wieder **aus dem Plan nehmen**. **Wie heute** nimmt alle Änderungen an
  der Gruppe zurück.
- **＋ Neuer Bereich** legt eine oberste Gruppe im Plan an.
- Marken zeigen, was anders ist als heute: **neu**, **umgehängt**, **umbenannt**, **wird archiviert** – darunter steht,
  wie es vorher war.
- Jede Änderung wird **sofort gespeichert**. Hat ein anderer Admin gleichzeitig gespeichert, wird **nichts
  überschrieben**: Ein Hinweis nennt ihn, der Plan zeigt seinen Stand, und **Nochmal auf dem neuen Stand** wendet die
  eigene Änderung darauf an.
- In ChurchTools inzwischen angelegte Gruppen erscheinen von selbst im Plan.
- **Plan verwerfen** löscht den Plan für alle (nach einer Rückfrage). ChurchTools bleibt, wie es ist.

### Umbau (ab O7-3)

Oben neben dem Plan steht **Umbau · N offen**: die Schritte vom Plan nach ChurchTools, in dieser Reihenfolge
**1 neue Gruppen anlegen · 2 umhängen · 3 umbenennen · 4 archivieren**, mit Fortschritt („3 von 7 erledigt“).

- **Ausführen** ändert ChurchTools **sofort** und liest danach nach. Danach steht **Rückgängig** da (für den zuletzt
  ausgeführten Schritt: neue Gruppe wieder löschen, alte Obergruppe, alter Name, alter Status).
- **Alle offenen nacheinander ausführen** (nach einer Rückfrage) macht alles, was geht – auch Schritte, die erst
  dadurch frei werden. Bei einem Fehler hält der Umbau an und sagt, nach wie vielen Schritten. Danach gibt es kein
  Rückgängig.
- Ein Schritt **wartet**, wenn er eine Gruppe braucht, die erst noch angelegt wird („wartet auf …“). **Archivieren
  wartet**, solange in ChurchTools noch Gruppen darunter hängen – sonst stünden sie danach als eigene Bereiche da.
- **Erledigt** ist ein Schritt, sobald ChurchTools so aussieht wie der Plan – auch wenn ihn jemand direkt in
  ChurchTools gemacht hat. Gibt es eine neue Gruppe dort schon (gleicher Name, gleiche Obergruppe), steht „gibt es schon
  in ChurchTools“ mit **Im Plan übernehmen**.
- **Archivieren** setzt den Status „archiviert“ – nichts wird gelöscht, Mitglieder und Historie bleiben (gemessen
  24.10.2026; keine Mail). Archivierte Gruppen zeigt ChurchTools nicht mehr im Baum.

## Was die Erweiterung speichert

Pro Gerät wird nur gemerkt, welche Gruppentypen ausgeblendet sind. Ab O7 liegt der **Plan „neue Gliederung“** im
Speicher der Erweiterung: als ein Eintrag in der Kategorie **„Plan „neue Gliederung““** (Kürzel `plan`), die die
Erweiterung beim ersten Speichern anlegt. Darin stehen nur die Änderungen gegenüber heute (neue Gruppen, Umhängen,
Umbenennen, Archivieren) und wer zuletzt gespeichert hat. Alles andere liegt in ChurchTools.

> **Rechte der Kategorie** (wie beim Dienstplaner gemessen): Wer die Kategorie anlegt, bekommt sofort alle Rechte
> darauf. Danach in ChurchTools den **anderen Gruppen-Admins** die Rechte auf die Kategorie „Plan“ geben: **Daten
> sehen** und **Daten anlegen, ändern, löschen** – sonst niemandem.
>
> **Vorsicht:** ChurchTools nimmt dasselbe Kürzel zweimal an. Sieht ein Admin die Kategorie nur nicht, weil ihm das
> Sehrecht fehlt, legt sein erstes Speichern eine zweite an. Deshalb zuerst die Rechte geben. Gibt es doch zwei, nimmt
> die Erweiterung die mit der kleinsten Nummer.
