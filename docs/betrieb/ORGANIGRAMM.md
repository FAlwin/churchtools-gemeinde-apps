# Organigramm – ChurchTools-Erweiterung

> **Stand: O9-3 (16.11.2026)** – der ganze Baum (Bereiche als Karten, Gruppen mit Personen, Leitung, Diensten und
> offenen Plätzen; Gruppenfenster), die **Präsentation** (für Gruppen-Admins auch die
> **neue Gliederung**), für Gruppen-Admins **Gruppen umhängen und anlegen** und den Reiter **Neue Gliederung** (Plan
> und Umbau) und – für alle, die es in ChurchTools dürfen – **Leitung und Mitglieder pflegen**. Für die **Leitung eines
> Bereichs** dazu die Reiter **Personen** und **Hinweise**. Seit O7b weitere Ansichten – von oben, von links, Mindmap
> und Liste, auch in der Präsentation und als PDF, überall auf Wunsch mit den Personen; Gruppen-Admins stellen ein, was
> das Organigramm für alle zeigt (O7b-7). Seit O9-2 der Reiter **Kinder & Jugend** (Gruppenwechsel der Kinder), seit O9-3 mit **Ausnahme setzen**. Diese Anleitung wächst mit.

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
| Gruppen-Admin                   | „Einstellungen“: was das Organigramm für alle zeigt (O7b-7)                                 | „Gruppen verwalten“ + Rechte der Kategorie    |
| Leitung einer Kindergruppe      | Reiter „Kinder & Jugend“ → „Meine Gruppe“ (O9-2)                                            | Rolle mit Leitung + Rechte am Gruppentyp      |
| Bereichsleitung Kinder & Jugend | Reiter „Kinder & Jugend“ → „Übersicht“ über alle Stufen (O9-2); Admins ebenso               | Leitung der Bereichsgruppe der Einrichtung    |

Seit #915 Scheibe C können Gruppen-Admins zusätzlich begrenzen, wie viel **Personen ohne Leitung** von den Personen
sehen (Abschnitt „Was das Organigramm für alle zeigt“). Das ist **nur eine Anzeige-Regel**: Die Tabelle oben bleibt
richtig – in ChurchTools selbst sieht jede Person weiter, was ihre Rechte erlauben. Das Organigramm zeigt nur weniger.

## Ansichten (ab O7b)

Über dem Baum wählt man, **wie** er aussieht:

- **Karten** – wie bisher: je Bereich eine Karte, darin die Gruppen mit Personen, Leitung und Diensten.
- **Von oben** – das klassische Organigramm: die Gemeinde oben, die Bereiche nebeneinander, darunter die Gruppen
  gestapelt. **Von links** – derselbe Baum zur Seite, jede Ebene eine Spalte. **Mindmap** – die Gemeinde in der Mitte,
  die Bereiche nach rechts und links verteilt. Im Kästchen steht vor dem Namen die **Kachel** der Gruppe – ihr
  Anfangsbuchstabe auf ihrer Farbe, wie in der Gruppenliste von ChurchTools (ab O7b-8; die eigene Farbe der Gruppe,
  sonst die ihres Gruppentyps – Gruppen ohne eigene Farbe sind daher oft gleich gefärbt). Die Gemeinde an der Spitze
  ist keine Gruppe und hat keine Kachel. Darunter auf Wunsch die Personen (siehe
  **Personen** unten); ein Klick (oder Enter) öffnet die Gruppe, das runde **+/−** klappt auf und zu (zugeklappt steht dort die Zahl der Untergruppen).
  **Ziehen** verschiebt, **Mausrad** oder **zwei Finger** zoomen, dazu **−**, **+** und **Ganz zeigen** (lässt unten den
  Streifen der Knöpfe frei, seit O7b-5). Passt alles lesbar hinein, ist anfangs alles zu sehen; sonst beginnt das Bild
  lesbar groß an der Spitze. Mit der Tastatur
  (Tab) springt das Bild zum gewählten Kästchen.
- **Liste** – die Gemeinde als Gliederung mit Linien, die Namen der Gruppen mit ihrer Kachel (auf Wunsch mit den
  Personen). Jede Gruppe
  mit Untergruppen klappt mit dem Pfeil auf und zu; anfangs sind die Gemeinde und die Bereiche offen, darunter steht
  „3 Untergruppen“. Gut am Handy.
- **Personen: Aus · Rollen · Alle** (Diagramme und Liste, seit O7b-6; rechts über dem Baum) – was unter dem
  Namen einer Gruppe steht. **Aus** (vorgegeben): nur der Name. **Rollen**: die Rollen der Gruppe genau wie in
  ChurchTools, darunter die Namen – die Leitung zuerst (Leiter, Co-Leiter), dann die übrigen Rollen in der Reihenfolge
  von ChurchTools (z. B. Coach, Organisator), die Standardrolle des Gruppentyps (Mitarbeiter bzw. Teilnehmer) zuletzt
  und nur als Zahl („6 Mitarbeiter“). **Alle**: auch die Standardrolle mit Namen. Nichts wird weggelassen oder dazu
  erfunden – auch eine in ChurchTools versteckte Rolle steht da. Wo ChurchTools einem die Mitglieder nicht zeigt, steht
  „Mitglieder nicht sichtbar“; eine Gruppe ohne eigene Mitglieder (oft eine Obergruppe) zeigt nur den Namen. Die
  Kästchen werden dann größer, der Blick fängt neu an. Die Wahl merkt sich das Gerät; sie gilt auch für die Diagramme
  der Präsentation (dort oben derselbe Umschalter) und gibt im PDF vor, ob das Häkchen **Personen** gesetzt ist.
- **Welche Rollen** (seit #915, neben **Personen**, sobald Personen gezeigt werden) – ein Häkchen je Rolle, so benannt
  wie in ChurchTools; „Leiter“ steht einmal, auch wenn es die Rolle bei mehreren Gruppentypen gibt. Angeboten wird nur,
  was bei den sichtbaren Mitgliedern vorkommt. Dazu **Alle** und **Nur Leitung**. Abgewählte Rollen fehlen in den
  Kästchen und Zeilen; darunter steht klein, was fehlt („Mitarbeiter (6) ausgeblendet“) – ist alles abgewählt, nur
  dieser Hinweis. Der Knopf zeigt „Alle“ oder „3 von 5“. Das Gerät merkt sich die abgewählten Rollen; eine neue Rolle
  in ChurchTools ist so von selbst zu sehen. Gilt auch in der Präsentation und gibt den Filter im PDF vor.
- **Alle aufklappen** / **Alle zuklappen** (Liste und Diagramme) wirken nur unter der Spitze.
- **Anfangen bei:** die ganze Gemeinde oder **jede Gruppe** (seit #915, z. B. nur das Café-Team samt Untergruppen) –
  dann zeigen alle Ansichten nur sie. Die Auswahl klappt eine Liste auf, nach Ebene eingerückt wie im Baum, oben ein
  **Suchfeld**: Beim Tippen stehen nur die Treffer da, darunter klein ihre Obergruppen (gleichnamige Gruppen bleiben
  unterscheidbar). Mit der Maus springt man gleich ins Suchfeld (Pfeiltasten, Enter); am Handy nicht, sonst verdeckte
  die Tastatur die Liste. Eine Gruppe mit zwei Obergruppen steht einmal, an ihrer ersten Stelle. Im Gruppenfenster jeder
  Gruppe mit Untergruppen steht weiter **„Im Organigramm hier anfangen“**. Ist die Spitze für alle ausgeblendet, gilt
  wieder die ganze Gemeinde; was für alle ausgeblendet ist, steht nicht in der Auswahl.
- Die gewählte Ansicht **merkt sich das Gerät**. Ohne Wahl: am Handy die Liste, sonst **von
  oben**. Als PDF gibt es die Ansichten seit O7b-4, in der Präsentation seit O7b-5.
- Eine Gruppe mit zwei Obergruppen steht wie in ChurchTools unter beiden und klappt an jeder Stelle für sich.

## Was das Organigramm für alle zeigt (ab O7b-7)

Gruppen-Admins sehen oben rechts **„Einstellungen“**. Das Fenster **„Was das Organigramm zeigt“** blendet für **alle**
aus, die das Organigramm öffnen – im Reiter, in der Präsentation und in der PDF:

- **Gruppentypen** (z. B. Merkmale oder Verteiler) – ein ausgeblendeter Typ verschwindet samt allem, was darunter hängt.
- **Einzelne Gruppen** (mit Suche) – eine ausgeblendete Gruppe nimmt ihre Untergruppen mit; die stehen im Fenster dann
  ausgegraut da („mit der Obergruppe“ bzw. „Typ ausgeblendet“).
- Über dem Baum steht dann für alle „Für alle ausgeblendet: … – eingestellt von Gruppen-Admins“.
- Eigene Typ-Schildchen je Gerät gibt es seit 30.10.2026 nicht mehr: Ein abgewählter Typ ging samt allem darunter –
  und weil oben meist Dienstbereiche stehen, war nach einem Klick fast alles weg. Ausblenden geht nur noch hier.
- Ausgeblendet heißt nur: hier nicht zu sehen. In ChurchTools bleibt alles, wie es ist. Die Reiter **Personen**,
  **Hinweise** und **Neue Gliederung** zeigen weiter alle Gruppen – dort wird mit der ganzen Struktur gearbeitet.
- Hat inzwischen ein anderer Admin gespeichert, wird nichts überschrieben: Das Fenster zeigt dann dessen Stand.
- Lässt sich die Einstellung gerade nicht lesen (Netz, ChurchTools antwortet nicht), sind alle Gruppen zu sehen, mit
  Hinweis und **Erneut versuchen** – Personen aber vorsichtshalber **ohne Namen** (Stufe „Nur Zahlen“), außer in
  Gruppen, die man leitet; Gruppen-Admins sehen alles. Fehlt einer Person das Leserecht auf die Kategorie, gilt für sie
  nichts davon – sie sieht alles, ohne Hinweis (siehe unten). Davor warnt das Fenster, sobald eine Stufe gewählt ist.

### Personen für alle ohne Leitung (ab #915 Scheibe C)

Im selben Fenster legen Gruppen-Admins fest, was Personen, **die nichts leiten**, höchstens von den Personen sehen –
in Kästchen und Liste, auf den Karten („Leitung: …“), in der Präsentation (Kacheln, Spalten, Diagramme), in der PDF
und im Gruppenfenster:

| Stufe              | Zu sehen                                                                                  |
| ------------------ | ----------------------------------------------------------------------------------------- |
| **Alle Namen**     | wie bisher (Vorgabe, auch für alles, was vor Scheibe C gespeichert wurde)                 |
| **Wie „Rollen“**   | Namen in den besonderen Rollen (Leitung, Organisator …); Mitarbeiter/Teilnehmer als Zahl  |
| **Nur Zahlen**     | keine Namen, auch nicht die der Leitung – z. B. „1 Leiter, 6 Mitarbeiter“                 |
| **Keine Personen** | in Kästchen, Listen und Gruppenfenster nichts; die Leitung auf Karten und Kacheln gezählt |

- **Wer eine Gruppe leitet**, sieht deren Personen samt aller Untergruppen voll – dieselbe Grenze wie bei den Reitern
  Personen und Hinweise (`sichtbereich`). **Gruppen-Admins** sehen alles.
- Die eigene Wahl „Personen: Aus · Rollen · Alle“ bleibt; sie gilt nur höchstens bis zur Stufe. Die Zahlen („12
  Personen“) zählen weiter alle – sie nennen niemanden.
- Die Leitung fällt **streng** unter die Stufe (Alwin 12.11.2026): Bei „Nur Zahlen“ steht auf der Kachel „1 Leiter“
  statt des Namens; „Leitung wird noch gesucht“ steht nur, wo es wirklich keine gibt.
- Über dem Baum steht für alle, was gilt („Für alle ausgeblendet: die Namen von Personen – eingestellt von
  Gruppen-Admins“), im Gruppenfenster „Namen sind hier ausgeblendet“.
- Ein unbekannter Wert im Speicher (etwa von einer späteren Fassung) gilt als „Nur Zahlen“ – im Zweifel weniger zeigen.

## Als PDF speichern und drucken (ab O7b-4)

Im Reiter Organigramm oben rechts **„PDF / Drucken“** (am Handy nur das Symbol). Das Fenster übernimmt Ansicht,
„Anfangen bei“ und was aufgeklappt ist, und zeigt das Blatt als **Vorschau** – genau diese Seiten werden zur PDF:

- **Ansicht:** von oben, von links, Mindmap oder Liste (Karten gibt es auf Papier nicht – dann von oben).
- **Ausschnitt:** ganze Gemeinde oder jede Gruppe – dieselbe Auswahl mit Suche wie „Anfangen bei“ (#915).
- **Papier:** **Passend** (vorgegeben: das A4, quer oder hoch, auf dem das Diagramm am größten wird; eine Liste steht
  hoch), A4 quer, A4 hoch, A3 quer oder A3 hoch. Ein Diagramm steht auf **einer Seite**, die Schrift wird höchstens
  11 pt groß; unter 6 pt rät das Fenster zu A3, einem Ausschnitt oder „Alles aufgeklappt“ aus. Eine Liste läuft über
  mehrere Seiten (in der Vorschau zum Blättern).
- **Alles aufgeklappt** (vorgegeben) – sonst so, wie es im Reiter auf- und zugeklappt ist.
- **Personen** (ab O7b-6b) – unter jeder Gruppe ihre Rollen und Personen wie im Reiter, im Diagramm und in der Liste
  (dort etwas eingerückt unter dem Namen, vor den Untergruppen). Angehakt ist es, wenn der Reiter Personen zeigt; es
  zeigt dann dieselbe Stufe – steht der Reiter auf „Aus“, die **Rollen** (Standardrolle als Zahl). Kursiv gibt es auf
  Papier nicht (eingebettet sind dort nur normal und fett der PDF-Schrift); der Text ist derselbe.
- **Welche Rollen** (seit #915, nur mit Personen) – übernimmt die Wahl aus dem Reiter; hier geändert gilt sie nur für
  diese PDF (wie der Ausschnitt).
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
- **Welche Rollen** (seit #915; in den Kacheln immer, in den Diagrammen mit Personen) – derselbe Filter wie im Reiter,
  hier geändert auch dort. Er gilt für die Kästchen und für die Personenlisten der Spalten: Dort bleibt, wer in der
  Gruppe **oder einer ihrer Untergruppen** eine gewählte Rolle hat – „Nur Leitung“ bei Technik zeigt also auch die
  Leitung von Ton und Stream. Darunter steht, wie viele ausgeblendet sind. Die Zahlen („12 Personen“) und die Leitung
  auf den Kacheln zählen weiter alle – nur die Stufe „Personen für alle ohne Leitung“ (Scheibe C) kann die Leitung dort
  zählen statt nennen.
- **Kopfleiste** (seit 16.11.2026, #945): oben der Name der Gemeinde mit **Vollbild** und **Schließen**, darunter die
  Bedienung – sie bricht bei Bedarf um, der Name wird nicht mehr von ihr verdrängt.
- Es gilt dasselbe wie im Baum: Was Gruppen-Admins für alle ausgeblendet haben, fehlt auch hier.
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

## Kinder & Jugend: Gruppenwechsel (ab O9-2, Ausnahme ab O9-3)

Der Reiter **Kinder & Jugend** zeigt, welche Kinder zum neuen Schuljahr in die nächste Gruppe wechseln. Ausnahmen
(„bleibt noch ein Jahr“) setzt man seit O9-3 hier, im Fenster des Kindes (siehe „Ausnahme setzen“ unten).

- **Wer ihn sieht:** Leitungen der Kindergruppen (**Meine Gruppe**), die Leitung der Bereichsgruppe und Admins
  (**Übersicht** mit einer Kachel je Gruppe). Ohne Einrichtung (siehe unten) gibt es den Reiter nicht – **außer für Leute mit
  „Berechtigungen verwalten“**: Sie sehen ihn immer und erfahren dort, wie es um die Einrichtung steht (siehe „Einrichtung
  (O9-5c)“ unten).
- **Jahresband:** Angekündigt · Wechseltag · Stichtag. Der **Wechseltag** ist der erste Montag nach den
  Sommerferien; er kommt **live aus dem Kalender „Schulferien NRW“**. Der **Stichtag** zählt fürs Alter.
- **Je Gruppe:** wer wechselt, wer bleibt (auch als Ausnahme), wer neu dazukommt. Leitungen sehen neue Kinder erst
  ab der Ankündigung, die Bereichsleitung schon vorher als Vorschau.
- **Daten pflegen:** Kinder ohne Geburtstag (die wechseln nie von selbst) und – nur für die Bereichsleitung – wer
  bis zum Stichtag 18 wird.
- **Wechseltage:** nur für Bereichsleitung und Admins – die Termine, bis wann sie in ChurchTools stehen und der Text für
  die Leitungen (siehe „Wechseltage“ unten).
- **Einrichtung:** nur für Leute mit „Berechtigungen verwalten“ – die Stufen und was in ChurchTools davon wirklich steht
  (siehe „Einrichtung (O9-5c)“ unten).

**Rechte am Gruppentyp der Kindergruppen** (Rechteverwaltung → Gruppentyp → Kindergruppe → „Globale Berechtigungen“
→ Leiter → Bearbeiten; gemessen 12.11.2026 in der Test-Instanz):

- organigramm → **„Organigramm“ sehen**
- organigramm → **Kategorien sehen** und **Daten in Kategorie sehen** → je **Gruppenwechsel** und **Was das
  Organigramm zeigt** (nicht „-- Alle --“, nicht den Plan)
- Kalender → Einzelnen Kalender sehen → Gemeindekalender → **Schulferien NRW**

Fehlt der Kalender, zeigt der Reiter einen Hinweis statt leerer Listen.

### Wechseltage (O9-4, Bereichsleitung und Admins)

Der Unterreiter **Wechseltage** zeigt je Jahr, das der Ferienkalender schon kennt: Sommerferien, Ankündigung, Wechseltag
(mit Wochentag) und Stichtag. Stehen die Wechseltage für mehr als das nächste Jahr in den Regeln, steht unter der
Überschrift „nichts zu tun – ChurchTools verschiebt von selbst“; sonst (und ohne das Recht) fehlt die Zeile, damit sie
nichts Ungeprüftes verspricht. Die Bereichsleitung sieht diese
Tabelle; die Spalte „In den Regeln“ und die Erinnerung sehen nur Leute mit dem Recht **„Berechtigungen verwalten“**
(`churchcore: administer persons` – nicht dasselbe wie „Gruppen verwalten“).

- **Quelle: die Regeln in ChurchTools** (O9-F8). Es gibt kein eigenes Merkfeld. Wer das Recht hat, dessen Erweiterung liest
  je Wechsel-Gruppe die Regeln (`GET /dynamicgroups/{id}/ruleset`) und prüft je Jahr, ob das Fenster darin steht, das
  die Erweiterung selbst schreiben würde (`kinderFenster`). Ein von Hand geschriebenes Fenster, das davon abweicht, zählt
  nicht.
- **Spalte „In den Regeln“:** **eingetragen** (das Fenster steht in den Regeln jeder Wechsel-Gruppe), **unvollständig –
  fehlt bei …** (nur in einem Teil der Gruppen), **fehlt noch** (in keiner; auch wenn eine Gruppe gar keine Regeln hat –
  ChurchTools antwortet dann mit 404), **nicht prüfbar** (Netz, Serverfehler, fehlendes Recht: nichts wird behauptet oder
  verändert).
- **Erinnerung:** Reichen die lückenlos eingetragenen Jahre ab dem nächsten Wechsel nur noch bis zu dessen Jahr, steht
  gelb „Wechseltage fehlen bald. Die Regeln reichen nur noch bis …“; fehlt schon das nächste Jahr, „Ab … fehlen
  Wechseltage in den Regeln …“. Derselbe Hinweis steht kurz in der **Übersicht** (Regel `wechseltageStand` in
  `shared/organigramm/wechseltage.ts`). Ist der Status nicht prüfbar, gibt es keine Erinnerung.
- **Leitungen Bescheid geben:** ChurchTools verschickt zur Ankündigung nichts. Ab der Ankündigung steht auf der Seite
  ein Text mit Wechseltag und je Übergang der Zahl der Kinder, die wechseln (ohne Ausnahmen – dieselbe Zahl wie in der
  Übersicht), zum Kopieren („Text kopieren“; geht das nicht, ist der Text markiert). Vor der Ankündigung steht nur,
  ab wann es ihn gibt, nach dem Wechseltag nichts mehr.

### Einrichtung (O9-5c, nur „Berechtigungen verwalten“)

Wer in ChurchTools **„Berechtigungen verwalten“** hat (`churchcore: administer persons` – nicht dasselbe wie „Gruppen
verwalten“), sieht den Reiter **Kinder & Jugend** immer, auch ohne Einrichtung und auch ohne Kindergruppe oder
Bereichsleitung. Was er dort sieht, hängt davon ab, wie sich der gespeicherte Wert (Kategorie „Gruppenwechsel“) lesen
lässt. Vier Fälle, die nie ineinander übergehen (`ladeEinrichtung` in `gruppenwechselSpeicher.ts`):

| Fall                    | Was es ist                                                                         | Was der Reiter zeigt (nur mit dem Recht)                                                                                               | Alle anderen |
| ----------------------- | ---------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- | ------------ |
| **eingerichtet**        | Wert da, Format stimmt                                                             | der Reiter wie gewohnt, dazu der Unterreiter **Einrichtung**                                                                           | wie bisher   |
| **keine**               | Kategorie fehlt oder ohne Wert                                                     | „Gruppenwechsel noch nicht eingerichtet“ mit Erklärung und dem Knopf **„Einrichten …“** (öffnet das Fenster, siehe unten)              | kein Reiter  |
| **unlesbar**            | Es steht etwas da, aber nicht in diesem Format (andere Fassung, kein JSON, kaputt) | „Die gespeicherte Einrichtung ließ sich nicht lesen. Es wird nichts überschrieben.“ – **nie** wie „keine“                              | kein Reiter  |
| **gerade nicht lesbar** | Netz, Server, abgemeldet, kein Recht                                               | „Die Einrichtung ließ sich gerade nicht lesen. Es wird nichts verändert.“ mit „Erneut versuchen“ – **nicht** „noch nicht eingerichtet“ | kein Reiter  |

Warum die Trennung: Wer ein „unlesbares“ oder „gerade nicht lesbares“ für „nicht eingerichtet“ hielt und später neu
einrichtete, überschriebe etwas, das da ist. Vorübergehend ist nicht ungültig.

> **Grenze:** Sieht ein Konto die Kategorie „Gruppenwechsel“ nicht (Leserecht fehlt), zeigt ChurchTools sie ihm gar nicht –
> das ist von „keine Kategorie“ nicht zu unterscheiden. „Berechtigungen verwalten“ sieht alle Kategorien; bei anderen
> Konten gilt: Vor dem Einrichten (O9-5c-2) die Rechte an der Kategorie prüfen.

Der Unterreiter **Einrichtung** liest selbst nur und verändert nichts – geschrieben wird in Fenstern, die er öffnet (seit
O9-5d): **„Stufen ändern …“**, bei ⚠ „Rechte der Leitung“ **„Rechte setzen …“** und bei ⚠ „Wechseltage“ **„Nachtragen …“**
(siehe „Schreiben (O9-5d)“ unten):

- **Karte „Stufen“:** die Kette der Stufen mit „ab N Jahren“, darunter die Bereichsgruppe, unter der die Wechsel-Gruppen
  hängen, der Ferienkalender, der Stichtag und die Ankündigung; darunter der Knopf **„Stufen ändern …“**.
- **Karte „Stand in ChurchTools“:** eine Zeile je Prüfung – **in Ordnung**, **stimmt nicht** (mit Text) oder **nicht
  prüfbar**. Ein Lesefehler (kein Recht, Netz, Serverfehler, unbekannte Antwort) wird nie zu „fehlt“. Oben steht ein
  gelber Sammelhinweis („Eine Sache braucht dich.“), wenn etwas nicht stimmt; „nicht prüfbar“ zählt nicht mit. „Rechte
  setzen …“ steht nur, wenn sich die Rechte lesen ließen **und** eines der drei fehlt (ein bloß zusätzliches Recht ist ⚠,
  aber nichts zum Setzen – entzogen wird nie etwas); „Nachtragen …“ steht bei ⚠ „Wechseltage in den Regeln“.

  | Zeile                     | Soll (kommt aus den Erzeugern, nicht abgeschrieben)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  | Gelesen über                                                          |
  | ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------- |
  | Gruppentyp                | alle Wechsel-Gruppen haben denselben Typ, Rollen Leiter und Teilnehmer sind da                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       | Gruppen aus dem Start, `GET /groups/{id}/roles`                       |
  | Rechte der Leitung am Typ | genau `LEITER_RECHTE` bei der Leiter-Rolle, keine bei der Teilnehmer-Rolle (geerbte zählen als vorhanden, werden aber nicht als „zusätzlich“ gemeldet)                                                                                                                                                                                                                                                                                                                                                                                                                               | `GET /permissions/group_type_role/{rolle}`                            |
  | Wechsel-Gruppen           | je Übergang eine, sichtbar und unter der Bereichsgruppe; **angelegt, aber nicht eingetragen** (O9-5d: Gruppe mit dem Namen des Übergangs, Typ „Gruppenwechsel“, unter der Bereichsgruppe, nicht in der Einrichtung) ist ⚠ mit Nummer                                                                                                                                                                                                                                                                                                                                                 | Gruppen und Hierarchie aus dem Start                                  |
  | Wechseltage in den Regeln | wie im Unterreiter „Wechseltage“ (`jahrStaende`, `regelnReichenBis`, `wechseltageStand`) – derselbe Abruf, nicht ein zweiter                                                                                                                                                                                                                                                                                                                                                                                                                                                         | `ladeRegelStand`                                                      |
  | Regeln der Gruppen        | je Wechsel-Gruppe Kinder- und Leitungs-Regel, je Stufe Aufnahme (außer der ersten) und Austragen (außer der letzten) aus `alleRegeln`; die **Austrag-Regel** muss Zeichen für Zeichen dem Erzeuger gleichen, sonst ⚠ „veraltet“ (O9-6-1: sie trägt nur **Teilnehmer** der alten Gruppe aus, Leitungen bleiben – über den ChurchQuery-Operator `person--group`); **keine fremden Regeln** (ein Schreiben würde sie ersetzen); Status **„aktiv“** (O9-5d: nur aktive Gruppen rechnet ChurchTools von selbst neu – bei „manual“ oder „inactive“ steht ⚠ „rechnet nicht von selbst neu“) | `GET /dynamicgroups/{id}/ruleset` (404 = keine Regeln) und `…/status` |
  | Routinen                  | je Wechsel-Gruppe die Aufräum-Routine aus `aufraeumRoutine` (Teilnehmer, aktiv, wartet `aufraeumenTage` Tage, trägt aus; ChurchTools liefert `actionData: null` statt `{}` – beides gleich)                                                                                                                                                                                                                                                                                                                                                                                          | `GET /groups/{id}/members/routines`                                   |

  Die Abfragen laufen gedrosselt (vier Gruppen zugleich). 401 ist hier fehlendes Recht, kein Abmelden.

### Fenster „Gruppenwechsel einrichten“ / „Stufen ändern“ (O9-5c-2, O9-5d)

Zwei Knöpfe öffnen dasselbe Fenster (immer ein Modal, nur für „Berechtigungen verwalten“): **„Einrichten …“** auf der
Seite „noch nicht eingerichtet“ und **„Stufen ändern …“** unter der Karte „Stufen“. Oben steht die Schrittanzeige
**Stufen › Vorschau › Fertig**. Der Hauptknopf der Vorschau („Jetzt einrichten“ bzw. „Änderungen schreiben“) ist an, sobald
alles gelesen und gut ist (`darfSchreiben`); er schreibt (siehe „Schreiben (O9-5d)“ unten). Solange geschrieben wird, lässt
sich das Fenster nicht schließen.

**Schritt „Stufen“** – vorbelegt mit der gespeicherten Einrichtung (Ändern) bzw. den Grundwerten und zwei leeren Zeilen
(Einrichten):

- **Wechsel-Gruppen anlegen unter:** die Bereichsgruppe (wählt man wie „Anfangen bei“ mit Suche; `SpitzenAuswahl`). Sie darf
  keine Stufe sein. **Beim Ändern ist sie gesperrt** (O9-F11): nur Anzeige mit dem Satz „Lässt sich hier nicht
  ändern. Zum Wechseln in ChurchTools die Wechsel-Gruppen unter die neue Gruppe hängen.“ – die Wechsel-Gruppen hängen schon darunter, und „Einrichten“ hängt
  nichts um.
- **Stufen, jüngste zuerst:** je Zeile die Gruppe, „ab N Jahren“, nach oben, nach unten, entfernen (mindestens zwei);
  „Stufe hinzufügen“ nimmt das Alter der letzten + 3. Dieselbe Gruppe darf nicht zweimal vorkommen, das Alter muss steigen.
- **Weitere Einstellungen** (zugeklappt): Stichtag („30.09.“), Ankündigung **in Wochen** (gespeichert wird in Tagen, 8 Wochen
  = 56 Tage; eine von Hand gespeicherte Zahl, die keine ganze Woche ist, bleibt, solange das Feld unberührt ist), wie lange
  die neue Gruppe aufnimmt (Tage), wann die Wechsel-Gruppe aufräumt (Tage), der Ferienkalender (aus den sichtbaren Kalendern;
  ein gespeicherter, aber nicht sichtbarer Kalender bleibt in der Liste) mit dem Hinweis „Sommerferien gefunden bis …“.
- „Weiter zur Vorschau“ geht nur, wenn nichts fehlt – sonst bleibt das Fenster stehen, und die Hinweise stehen am Feld bzw.
  über der Liste. Dieselbe Prüfung gilt beim Lesen der gespeicherten Einrichtung (`einrichtungFehler`), damit nichts
  gelesen wird, was das Fenster nie geschrieben hätte.

**Schritt „Vorschau“** – liest nur:

- **Wer wechselt wann wohin:** Jahr × Übergang mit der Zahl der Kinder (aus den aktiven Teilnehmern der gewählten Stufen und
  `werWechselt`), „Namen für <erstes Jahr> zeigen“ zum Aufklappen. Die Jahre kommen aus dem gewählten Ferienkalender, ab
  dem nächsten Wechsel. Gelber Hinweis, wenn Kinder keinen Geburtstag haben (sie wechseln nie von selbst). Die Zahlen späterer
  Jahre sind der heutige Stand.
- **Das legt die Erweiterung in ChurchTools an:** je Baustein **neu**, **vorhanden** oder **ändern** – Gruppentyp
  „Gruppenwechsel“ (vorhanden, wenn `GET /group/grouptypes` einen Typ dieses Namens liefert), Rechte der Rolle „Leiter“
  (`LEITER_RECHTE`; Teilnehmer bekommen keine), Wechsel-Gruppen (vorhanden nur für genau diesen Übergang **und** nur, wenn es
  die Gruppe noch gibt), Routinen, Regeln in allen Stufen und Wechsel-Gruppen. Das ist `einrichtungsPlan` – **der Plan, den
  das Schreiben ausführt**, mit den Schritten in der Reihenfolge der Messung vom 16.11.2026: Typ → Rechte → Wechsel-Gruppen →
  Routinen → Regeln der Wechsel-Gruppen → Status → Regeln der Stufen → Status → unsere Regeln aus Stufen entfernen, die
  keine mehr sind → neu berechnen → Einrichtung speichern. Was sich nicht lesen ließ
  (Gruppentyp, Stand der bisherigen Einrichtung), wird nie zu „fehlt“ oder „neu“: Es steht als „Nicht alles ließ sich
  prüfen“ da und hält das Schreiben auf.
- **Fremde Regeln = Stopp:** Hat eine gewählte Gruppe Regeln, deren Kurzname nicht zu dieser Erweiterung gehört (`REGELN`),
  steht ein roter Hinweis mit Gruppe und Zahl, der Haken ist aus, und das Schreiben bleibt aus – es würde die Regeln
  ersetzen. Ließen sich die Regeln nicht lesen („ließen sich nicht prüfen“, mit „Nochmal prüfen“), gilt dasselbe.
- **Läuft heute schon ein Wechsel?** Liegt heute im Fenster eines Jahres (Ankündigung bis Ende der Aufnahme), steht ganz oben
  gelb „Der Wechsel <Jahr> läuft gerade – nach dem Schreiben kommen N Kinder sofort in die Wechsel-Gruppe bzw. werden
  verschoben.“ (N aus derselben Rechnung wie die Tabelle, `offenesFenster`). Kein Stopp – aber nichts, was man übersehen soll:
  Die Regeln wirken sofort.
- **Keine Mail** (gemessen 16.11.2026): Der Hinweis nennt die Ankündigung des ersten Jahres.
- **Haken** „Ich habe die Rechte der Leitung geprüft …“ nur beim Einrichten (O9-F4).

Gelesen wird, wie überall hier, gedrosselt; 401 ist fehlendes Recht, kein Abmelden.

### Schreiben (O9-5d)

Geschrieben wird mit der Sitzung der Seite (nur „Berechtigungen verwalten“, immer nach einer Vorschau) – `schreibeEinrichtung`
in `organigramm/src/einrichtenSchreiben.ts`. Es führt die Schritte des Plans aus `einrichtungsPlan` aus, in der Reihenfolge der
Messung vom 16.11.2026 (**die Routine vor den Regeln**: Für Kinder, die schon aktiv waren, entsteht sonst kein Lauf):

| Schritt                       | Was geschrieben wird                                                                                                             | Was danach nachgelesen wird                                           |
| ----------------------------- | -------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| Gruppentyp                    | `POST /group/grouptypes` („Gruppenwechsel“, Kürzel GW, ohne Beiträge, kein Pflicht-Leiter, nicht für neue Personen, Farbe grau)¹ | Typ in der Liste, beide Rollen (`GET /group/roles`)                   |
| Rechte der Leitung            | `PUT /permissions/group_type_role/{Leiter}` je **fehlendem** Recht – nur ergänzen, nie entziehen                                 | alle drei Rechte stehen da                                            |
| Wechsel-Gruppen               | `POST /groups` (Typ, Status aktiv, `parentGroupId` = Bereich, versteckt)                                                         | Typ, Name und Obergruppe; **danach sofort die Einrichtung speichern** |
| Routinen                      | `POST /routines` + `PATCH` der Schritte (`aufraeumRoutine`); eine vorhandene wird mit ihren Schritt-Nummern angepasst            | `routineBefund` gegen den Erzeuger (`actionData` `null` = `{}`)       |
| Regeln der Wechsel-Gruppen    | `PUT /dynamicgroups/{id}/ruleset` (alle Regeln der Gruppe, `alleRegeln` mit allen künftigen Jahren)                              | Zeichen für Zeichen dasselbe (ChurchTools gibt sie byte-genau zurück) |
| Status                        | `PUT /dynamicgroups/{id}/status` → **„active“** (nur aktive Gruppen rechnet ChurchTools von selbst neu)                          | Status „active“                                                       |
| Regeln und Status der Stufen  | wie oben                                                                                                                         | wie oben                                                              |
| Alte Stufen / Wechsel-Gruppen | unsere Regeln (`REGELN`) werden entfernt, fremde bleiben; bleibt nichts übrig, Status „none“                                     | Rest steht da                                                         |
| Neu berechnen                 | `POST /dynamicgroups/{id}/refresh` je Wechsel-Gruppe                                                                             | ChurchTools meldet die Gruppe mit `created/updated/deleted`           |
| Einrichtung speichern         | Kategorie „Gruppenwechsel“ mit der gelesenen Version (`dokumentSpeichern`); fehlt die Kategorie, wird sie angelegt               | wie bei allen Speicherwerten (Version, Nachlesen)                     |

¹ Vorläufig: an der Test-Instanz gemessen (O9-0), vor O9-6 noch einmal prüfen.

- **Jeder Schritt schreibt und liest sofort nach.** Ein `200`/`201` allein ist kein Beleg; erst was beim Nachlesen dasteht, zählt.
  Beim **ersten Fehler** wird aufgehört, der Rest bleibt „offen“. Vor dem ersten Schreiben prüft der Lauf noch einmal alles
  frisch (fremde Regeln, Ferienkalender, Plan nicht „unsicher“, gespeicherte Einrichtung unverändert) – er verlässt sich nicht
  auf den Knopf.
- **Vorübergehend ist nicht ungültig:** Zeitüberschreitung, 5xx, Drosselung, Netz und ein 403 ohne ChurchTools-Antwort heißen
  „vorübergehend“ – nichts wird zurückgerollt oder gelöscht, „Nochmal versuchen“ liest den Stand neu, rechnet den Plan neu und
  schreibt nur, was fehlt. 401/403 von ChurchTools heißt „abgelehnt“ („dir fehlt das Recht …“).
- **Nie eine zweite Wechsel-Gruppe für denselben Übergang:** Die Einrichtung wird **sofort nach jeder neu angelegten
  Wechsel-Gruppe** gespeichert und am Ende noch einmal (ohne neue Version, wenn sich nichts geändert hat). **Die eine Lücke:**
  Bricht es nach dem Anlegen und vor dem Speichern ab (oder geht die Antwort auf das Anlegen verloren), steht die Gruppe in
  ChurchTools, aber nicht in der Einrichtung. Die Seite „Einrichtung“ zeigt sie dann als ⚠ („Gruppe N steht unter … nicht
  in der Einrichtung eingetragen“), und **„Nochmal versuchen“ übernimmt sie** (gleicher Name, Typ „Gruppenwechsel“, direkt unter
  der Bereichsgruppe), statt eine zweite anzulegen. Gibt es mehrere solche Gruppen, wird nicht geraten, sondern angehalten.
- **Konflikt:** Hat jemand anderes die Einrichtung inzwischen geändert (der Lauf erwartet genau die, aus der das Fenster stammt
  bzw. die der letzte eigene Versuch gespeichert hat), wird nichts überschrieben.
- **Nichts wird gelöscht.** Nicht mehr gebrauchte Wechsel-Gruppen (Stufen geändert) bleiben mit Kindern, Ausnahmen und Routine
  stehen; „Fertig“ nennt sie. Rechte werden nur ergänzt.
- **Fertig:** Liste je Baustein mit ✓ (nachgelesen), ✗ (mit Grund) oder „noch nicht geschrieben“; bei Fehlern „Später“ und
  „Nochmal versuchen“. Beim Schließen nach einem Schreiben lädt die Seite die Einrichtung und die Gruppen neu.

**Leserechte der Leitungen (O9-F12):** „Einrichten“ setzt sie **nicht**. Im Schritt „Fertig“ steht der Kasten „Damit die
Leitungen den Reiter sehen“ – nur Text: **„Organigramm“ sehen**, die Kategorien **„Gruppenwechsel“** und **„Was das
Organigramm zeigt“** (Kategorie sehen und Daten sehen) und der **Ferienkalender** (z. B. „Schulferien NRW“) sehen, und zwar an
den **Leitern der Stufen-Gruppen** und der **Leitung der Bereichsgruppe**. Das setzt ein Admin in ChurchTools (siehe „Rechte
am Gruppentyp der Kindergruppen“ oben).

**Wechseltage nachtragen** (Knopf bei ⚠ „Wechseltage in den Regeln“ und auf der Seite „Wechseltage“ beim gelben Hinweis): Ein
kurzes Fenster Vorschau › Fertig. Es zeigt die neuen Jahre aus dem Ferienkalender und schreibt **nur die Regeln** aller Stufen
und Wechsel-Gruppen mit allen künftigen Jahren – keine Gruppen, Routinen, Status oder Einrichtung. Ausnahmen („zu löschen“)
bleiben: Die Regeln fassen sie nie an. Fremde Regeln in einer Stufe halten auch hier auf.

**Rechte setzen** (Knopf bei ⚠ „Rechte der Leitung“, wenn eines der drei fehlt): Ein kurzes Fenster Vorschau › Fertig mit den
drei Rechten (das fehlende als „ergänzen“) und dem Haken „geprüft“ (O9-F4); gesetzt werden nur die fehlenden, danach wird
nachgelesen. Andere Rechte an der Rolle bleiben.

**Demo** (`npm run dev -w organigramm`, `…/ccm/organigramm/?demo=…`): Schreiben spielt nur im Speicher der Demo, nichts geht
nach außen. `?demo=neu` (Einrichten durchklicken), `?demo=rechte` („Rechte setzen …“), `?demo=nachtragen` („Nachtragen …“),
`?demo=schreibfehler` (das erste Schreiben der Regeln scheitert einmal – „Nochmal versuchen“).

**Grenzen:** Das Umhängen der Wechsel-Gruppen bei einer anderen Bereichsgruppe gibt es nicht (O9-F11: von Hand in ChurchTools).
Beim Anpassen einer vorhandenen Routine schickt der Lauf die Schritt-Nummern mit; ob ChurchTools damit auch bei laufenden
Abläufen alles richtig übernimmt, ist nur für neue Routinen gemessen – weicht etwas ab, meldet es das Nachlesen.

### Ausnahme setzen (O9-3)

Ein Kind antippen, dann den Schalter **„Bleibt noch ein Jahr in …“**. Eine **Ausnahme** ist der Status „zu löschen“ des
Kindes in der **Wechsel-Gruppe** – die Regeln in ChurchTools lassen es dann in Ruhe, und die Ausnahme bleibt stehen,
bis jemand sie aufhebt. Der Schalter speichert sofort und liest nach; **„Rückgängig“** steht im Fenster.

- **Wer ab wann:** Entscheidend ist das **Recht an der Wechsel-Gruppe** in ChurchTools, nicht die Rolle in der App.
  Ist das Kind dort schon Mitglied (ab der Ankündigung), braucht man das Recht, **den Status zu ändern** – das haben
  die Leitungen der Wechsel-Gruppe. Ist es noch nicht dort, braucht man das Recht, **Personen aufzunehmen** – das
  haben Bereichsleitung und Admins; sie tragen eine Ausnahme schon **vor** der Ankündigung ein, das Kind wird dann
  gleich als „zu löschen“ mit der Teilnehmer-Rolle der Wechsel-Gruppe aufgenommen („Rückgängig“ trägt es wieder
  aus). Leitungen sehen vor der Ankündigung „Eine Ausnahme kannst du ab dem … eintragen.“
- **Ab dem Wechseltag** gibt es keinen Schalter mehr: Dann kommt die Ausnahme zu spät, das Kind ist schon in der neuen
  Gruppe. Den Schalter gibt es nur für Kinder, die in diesem Jahr dran wären.
- **Ausnahme vom letzten Jahr:** Wurde der Status **vor dem Wechseltag des Vorjahres** gesetzt (Tag in der Zeit der
  Gemeinde), zeigt der Reiter einen gelben Chip „Ausnahme vom letzten Jahr“, die Gruppenseite einen gelben Hinweis,
  und das Fenster nennt den Wechseltag, falls man sie aufhebt. Eine Ausnahme, die die Bereichsleitung in diesem Jahr
  schon vor der Ankündigung einträgt, gehört zu diesem Jahr. Den Wechseltag des Vorjahres liest der Reiter aus dem
  Ferienkalender (geladen ab 1. Januar des Vorjahres); fehlt er dort, wird nichts gelb.
- **Fehler:** Es wird nie etwas von selbst wiederholt. Fehlt das Recht, steht ChurchTools' Meldung im Fenster;
  antwortet ChurchTools nicht, steht „Gerade nicht gespeichert“, und der Stand bleibt wie er war.

## Was die Erweiterung speichert

Pro Gerät wird gemerkt, welche Ansichten gewählt sind, ob Personen gezeigt werden und welche Rollen abgewählt sind. Ab O7 liegt der **Plan „neue Gliederung“** im
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

Ab O7b-7 liegt dort auch **„Was das Organigramm zeigt“**: ein Eintrag in der Kategorie **„Was das Organigramm zeigt“**
(Kürzel `sichtbar`), angelegt beim ersten Speichern unter „Einstellungen“. Darin stehen nur die IDs der für alle
ausgeblendeten Gruppentypen und Gruppen, die Stufe „Personen für alle ohne Leitung“ (seit #915 C, Feld `personen`)
und wer zuletzt gespeichert hat.

> **Rechte dieser Kategorie – anders als beim Plan:** **Daten sehen** brauchen **alle**, die das Organigramm öffnen
> (sonst sehen sie alles, auch was ausgeblendet sein soll); **Daten anlegen, ändern, löschen** nur die Gruppen-Admins.
> Dieselbe Vorsicht wie oben: den anderen Admins das Sehrecht geben, bevor sie zum ersten Mal speichern.

Ab O9-2 liegt dort auch die **Einrichtung des Gruppenwechsels**: ein Eintrag in der Kategorie **„Gruppenwechsel“**
(Kürzel `gruppenwechsel`). Darin stehen die Stufen (Gruppe und Alter ab), die Bereichsgruppe, je Übergang die
Wechsel-Gruppe und die Fristen (Ankündigung, Aufnahme). Die Wechseltage selbst stehen **nicht** darin – sie kommen
jedes Mal aus dem Ferienkalender. Lesen: ob er fehlt, nicht lesbar ist oder gerade nicht gelesen werden konnte, siehe „Einrichtung (O9-5c)“. Geschrieben wird er von
„Einrichten“ und „Stufen ändern“ (O9-5d, siehe „Schreiben (O9-5d)“): mit der gelesenen Version, nie über den Wert eines anderen.

> **Rechte dieser Kategorie:** **Daten sehen** brauchen alle Kinder-Leitungen und die Bereichsleitung (am Gruppentyp,
> siehe oben); ändern nur Admins.
