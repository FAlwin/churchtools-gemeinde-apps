# Protokolle – ChurchTools-Erweiterung

> **Stand: v1.1.0 (19.11.2026: Hinweis auf fällige To-Dos – Band auf der Startseite, roter Zähler am Reiter „To-Dos“, in der Verwaltung einstellbar; v1.0.9 18.11.2026: Seite springt nach dem Antippen eines Feldes am iPhone sofort zurück statt langsam zu ruckeln; v1.0.8 Gruppe über die Überschrift wählen statt Reiterleiste, Fenster ruckeln bei offener iPhone-Tastatur nicht mehr; v1.0.7 To-Dos am Handy – Kopfzeile aufgeräumt, Sortieren und Filter bleiben im Bild; v1.0.6 im Text weder „+“ noch Griff, außer an Tabellen; v1.0.5 Punkte ordnen im eigenen Fenster statt Ziehen im Text; v1.0.4 Protokoll löschen, To-Dos „Alle“ und gekürzte Zuständige, ein Termin gehört der Gruppe mit dem Gruppentreffen; v1.0.3 „Mit KI füllen“ legt neue Punkte mit Beschlüssen, To-Dos und Terminen an; v1.0.2 Person aus der Anwesenheit nehmen, „Mit KI füllen“ direkt zur Antwort; v1.0.1 Protokoll zu früheren Treffen nachtragen; erste Version v1.0.0 vom selben Tag).** Die Erweiterung lässt sich installieren; ein Admin richtet je Gruppe die
> Rechte ein. Die **Startseite** zeigt „Heute“, „Meine offenen To-Dos“, „Nächste Sitzungen“ und „Deine Gruppen“; der
> Reiter **„Sitzungen“** zeigt je Gruppe Kommend, Vorschläge und Protokolle; der Reiter **„To-Dos“** zeigt alle To-Dos der
> eigenen Gruppen als Liste oder Board; die **Lupe** oben rechts sucht in allem (ohne Suchbegriff: alle Beschlüsse).
> Die **Leitung schreibt** Protokolle im Entwurf direkt im Editor – mit Aufgaben (= To-Dos), Beschlüssen, Terminen,
> Anwesenheit und festen Punkten –, beginnt Protokolle zu Terminen und Treffen (auch zu vergangenen – „Noch ohne Protokoll“, „Protokoll nachtragen“), legt die nächste Sitzung fest, füllt
> auf Wunsch mit **KI-Vorschlägen** aus einem Transkript und gibt Protokolle frei (mit Beitrag in der Gruppe); Mitglieder
> schlagen Punkte vor. Jedes Protokoll lässt sich als **PDF teilen**. Admins richten im Reiter **„Verwaltung“** Gruppen
> ein und pflegen die Vorlagen.

Die Protokolle sind für Gruppen wie den Leitungskreis: **Protokolle als Dokument** (wie Word, Loop oder Notion),
daraus gesammelt Beschlüsse, To-Dos und Termine. **Alles liegt in ChurchTools** – es gibt keinen eigenen Server,
keine Push-Mitteilungen und keine eigenen Mails.

## Installieren

> **Vorher einmalig:** Erweiterungen muss der ChurchTools-Support für eure Instanz freischalten. Fehlt unter
> _Administration_ der Punkt „Erweiterungen“, beim Support melden – siehe
> [Erweiterungen freischalten](ERWEITERUNG.md#erweiterungen-freischalten).

1. Bei den [Releases](https://github.com/FAlwin/churchtools-gemeinde-apps/releases) die neueste Datei
   **`protokolle-v….zip`** herunterladen (nicht entpacken). Die Releases heißen „Protokolle v…“ – nicht verwechseln
   mit den Releases der Musik App, des Dienstplaners oder der anderen Erweiterungen.
2. In ChurchTools: **Administration → Erweiterungen → Erweiterung hinzufügen**.
3. Ausfüllen:
   - **Name:** z. B. „Protokolle“ – so heißt der Menüpunkt.
   - **Kürzel:** genau **`protokolle`**. Die Erweiterung ist für diese Adresse gebaut (`/ccm/protokolle/`); mit einem
     anderen Kürzel lädt sie nicht.
   - **Im Menü anzeigen:** an.
   - **ZIP-Datei:** die heruntergeladene Datei.
4. **Speichern.**

**Danach:** Ein Admin richtet jede Gruppe einmal im Reiter „Verwaltung“ ein (siehe „Rechte“) – vorher sehen
Mitglieder die Gruppe nicht.

**Aktualisieren:** beim Eintrag auf den Stift und die neue ZIP hochladen, sonst nichts ändern.

## Rechte

Die Erweiterung kann nichts, was die Person in ChurchTools nicht auch selbst dürfte – sie arbeitet mit deren
Sitzung. **Ein eigenes Rechte-System gibt es nicht.** Protokolle sind vertraulich und werden von ChurchTools selbst
geschützt, nicht nur in der Oberfläche (gemessen 16.10.2026):

- Je Gruppe gibt es zwei Kategorien im Speicher der Erweiterung: **„Protokolle · <Gruppe>“** (Kürzel
  `protokolle-g<ID>`, nur die Leitung schreibt) und **„Mitarbeit · <Gruppe>“** (`mitarbeit-g<ID>`, To-Dos und
  Vorschläge). Dazu gemeinsam **„Vorlagen“** (`vorlagen`).
- Die Rechte hängen an **„Rolle X in Gruppe Y“** und folgen einem Rollenwechsel sofort. Setzen kann sie nur ein
  **Admin** (ChurchTools-Recht „Personen administrieren“) – deshalb wird jede Gruppe einmal von einem Admin
  eingerichtet: Reiter **„Verwaltung“** (nur für Admins sichtbar) → Gruppe antippen → je Rolle „Kein Zugriff“,
  „Lesen + eigene To-Dos“ oder „Leitung“, dazu „Vorschlagen“/„Direkt eintragen“ und der Kalender → **Einrichten**.
  Das dauert einige Sekunden (jeder Schritt wird nachgelesen); scheitert es, bleibt das Fenster offen und sagt warum.
- Beim Einrichten bekommt jede Rolle mit Zugriff: „Modul sehen“, Lesen in allen drei Kategorien, Schreiben in
  „Mitarbeit“; die **Leitung** zusätzlich Schreiben und Löschen in „Protokolle“ und „Termine bearbeiten“ im gewählten
  Kalender (alle anderen: „ansehen“). Gelöscht wird in „Mitarbeit“ nie – ein To-Do wird nur als gelöscht markiert.
- Wird eine Rolle herabgestuft, entzieht das Einrichten die Rechte auf die eigenen Kategorien **sofort wirksam**.
  Kalender-Rechte und „versteckte Gruppe sehen“ entzieht es nur, wenn die Verwaltung sie **selbst gesetzt** hat
  (sie merkt sich das in der Einstellung der Gruppe); was ein Admin vorher von Hand gesetzt hatte, bleibt.
  Diese Merkliste steht in der Kategorie „Protokolle“, die die Leitung beschreiben darf. Darum zählt beim Einrichten
  nur, was die Verwaltung dort selbst eingetragen haben kann – Zusatzrechte an Rollen **dieser** Gruppe (frisch aus
  ChurchTools gelesen), Kalenderrechte nur am alten oder neuen Kalender der Gruppe (Security-Review 16.11.2026,
  `vergebenPruefen`). Ein untergeschobener Eintrag führt so nie dazu, dass ein Admin Rechte anderer Gruppen entzieht.
- **Versteckte Gruppen** bleiben versteckt; ihre Mitglieder bekommen beim Einrichten zusätzlich „versteckte Gruppe
  sehen“. Ohne das sehen sie ihre eigene Gruppe in ChurchTools nicht (gemessen 22.10.2026).
- **Beitrag nach der Freigabe** (S6-2): Das Häkchen „In der Gruppe Bescheid geben“ erscheint nur, wo man in
  ChurchTools Beiträge schreiben darf – der **Gruppentyp** muss Beiträge erlauben (Typ „Anmeldung“ tut es nicht) und
  die Rolle braucht das gruppeninterne Recht **„Beitrag gruppenintern erstellen“**. Das Einrichten vergibt es **nicht**
  (Entscheidung 11.11.2026) – ein Admin setzt es in ChurchTools selbst, wo es gewünscht ist.

**Vorlagen** (Reiter „Verwaltung“, Karte „Vorlagen“): gelten für alle Gruppen. Beim ersten Einrichten einer Gruppe
entstehen drei zum Anpassen (Leitungssitzung, Teamtreffen, Klausur). Je Vorlage: Name, Tagesordnungspunkte mit
vorbereitetem Text, feste Punkte („Offene To-Dos“, „Protokoll der letzten Sitzung“ – füllen sich selbst) und feste
Aufgaben, die bei jeder Sitzung mit dieser Vorlage angelegt werden. Lesen dürfen sie alle eingerichteten Gruppen,
ändern nur Admins.

**Hinweis auf fällige To-Dos** (Reiter „Verwaltung“, Karte „Hinweis auf fällige To-Dos“, nur Admins, gilt für die ganze
Erweiterung): ChurchTools kann keine zeitgesteuerten Erinnerungen schicken, die Erweiterung läuft nur im Browser – darum
weist sie **beim Öffnen** hin (siehe unten, Startseite). Der Admin wählt, was „bald fällig“ heißt: **Aus** (kein Band, kein
Zähler) · **Nur Überfällige** · **Überfällige und 1 / 3 / 7 / 14 Tage vorher**. **Standard: 3 Tage**, solange nichts eingestellt
ist. Die Wahl wird sofort gespeichert (und nachgelesen). Sie liegt als eigener Wert (`art: "todo-hinweis"`, `fassung: 1`,
`vorlauf`) in der Kategorie „Vorlagen“ – lesen darf jede Person mit einer eingerichteten Gruppe, schreiben nur ein Admin,
genau wie bei den Vorlagen; die Vorlagen-Liste überliest den Wert. **Wer den Wert nicht lesen kann** (kein Recht, Netz- oder
Serverfehler, kaputter Wert), arbeitet mit dem **Standard von 3 Tagen** – nie mit „Aus“, und die Seite wartet nie darauf.

**Startseite:** „Heute“ erscheint nur, wenn heute eine Sitzung ansteht. „Meine offenen To-Dos“ sind die mir
zugewiesenen, nicht erledigten aus allen Gruppen. „Nächste Sitzungen“ sind dieselben wie unter „Kommend“ im Reiter
„Sitzungen“ (Termine **mit Besprechungsanfrage**, Gruppentreffen, begonnene Protokolle), ab heute über alle Gruppen – zurückliegende
Sitzungen ohne Protokoll stehen dort nicht, sondern in „Noch ohne Protokoll“ (Reiter „Sitzungen“, nur Leitung);
dahinter steht die eigene Antwort auf die Anfrage – wer nicht eingeladen ist, sieht keine. Ein Tipp öffnet die
Sitzung bzw. die Gruppe im Reiter „Sitzungen“.
„Alle anzeigen“ an „Meine offenen To-Dos“ öffnet den Reiter „To-Dos“.

**Hinweis auf fällige To-Dos:** Hat man **eigene** offene To-Dos (mir zugewiesen, nicht erledigt, aus allen Gruppen – dieselbe
Menge wie „Meine offenen To-Dos“), die überfällig oder bald fällig sind (Einstellung der Verwaltung, siehe oben), steht unter der
Begrüßung ein **Band**: „**2 To-Dos überfällig**, 1 bis Sa, 21.11. fällig“ – rot, solange etwas überfällig ist; sind nur bald
fällige da, ruhig blau („**3 To-Dos** in den nächsten 7 Tagen fällig“). „Zu meinen To-Dos“ öffnet den Reiter „To-Dos“. Dazu zeigt
der Reiter „To-Dos“ auf **jeder Seite** eine **rote Zahl** (überfällig + bald fällig; unten in der Leiste am Handy, oben im
Umschalter am Computer; für Vorleser „To-Dos, 3 fällig“). Nichts fällig oder „Aus“: weder Band noch Zahl. **Woher die Zahlen
kommen:** Start und Reiter „To-Dos“ lesen die To-Dos ohnehin und geben sie weiter – es kostet keinen zusätzlichen Abruf, und die
Zahl stimmt nach jedem Neuladen und jeder Änderung dort (Abhaken, Ziehen, Speichern im Fenster). Nur wer die Erweiterung gleich
im Reiter „Sitzungen“ oder „Verwaltung“ öffnet, löst einmal beim Start einen leichten Abruf aus (je Gruppe die „Mitarbeit“-Werte);
scheitert er, gibt es keine Zahl. Ändert man To-Dos direkt im Protokoll (Reiter „Sitzungen“), zieht die Zahl beim nächsten Besuch
von Start oder „To-Dos“ nach.

**Reiter „To-Dos“ (S7-1):** alle To-Dos der eigenen Gruppen in einer Liste – **nach Status** (Überfällig · In Arbeit ·
Offen · Erledigt) oder **nach Person** (ich zuerst, dann nach Namen; „Außerhalb der Gruppe“, „Noch niemand
zuständig“). Die **Leitung** sieht alle To-Dos ihrer Gruppen, **Mitglieder** ihre eigenen und die,
für die noch niemand zuständig ist. Der **Haken** an der Karte („◐ In Arbeit“, „○ Offen“) hakt mit einem Tipp ab (offen oder in Arbeit → erledigt) und
nimmt zurück (erledigt → offen) – **nie** weiter auf „in Arbeit“; das stellt man im Fenster ein oder zieht im Board. Nach dem Abhaken
bleibt die Karte **5 Sekunden an ihrem Platz** (durchgestrichen) mit **„Rückgängig“ direkt an der Karte**, dann rutscht sie zu „Erledigt“.
Das geht ohne ins Protokoll zu springen, auch wenn es schon freigegeben ist. Bei **„Jeder für sich“** (siehe Fenster „To-Do“) ist der
Haken **mein Teil**, daneben steht der Fortschritt („2/4“); wer nicht zuständig ist, sieht nur den Fortschritt. Der Filter blendet Gruppen und „Zuständig: Ich / Andere /
Noch niemand“ aus; Erledigte älter als 30 Tage zeigt der Schalter „Ältere erledigte zeigen“ am Ende der Liste.

**Board und Sortieren (S7-3):** „Liste | Board“ oben. Das Board zeigt **nach Status** die Spalten Offen · In Arbeit ·
Erledigt (Überfällige rot in ihrer Spalte), **nach Person** je Person (bei genau einer Gruppe im Filter auch deren
Mitglieder ohne To-Do), „Außerhalb der Gruppe“ und „Noch niemand zuständig“; je Spalte „+ Neues To-Do“ mit
vorbelegtem Status bzw. Zuständigen. **Ziehen:** mit der Maus die ganze Karte, mit dem Finger **lange drücken** (~0,4 s)
– vorher blättert ein Wischen. Nach Status ändert Ziehen den Status (bei „Jeder für sich“ nicht – der Gesamtstand ergibt sich aus den Teilen), nach Person **tauscht es nur die gezogene Person**
(„Außerhalb“ nimmt nichts an). Gibt ein Mitglied sein eigenes To-Do ab (danach sieht es es nicht mehr), fragt die Seite
vorher. Jeder Wechsel der Zuständigen steht im **Verlauf** („Zuständig: Spike → Johann“) – im Board, im Fenster, im
Editor und beim Verschieben in eine andere Gruppe. **Sortieren** (ein Knopf, gilt für alle Spalten und Abschnitte):
Dringlichkeit (Vorgabe) · Bis-Datum (Erledigte nach „erledigt am“) · Alphabetisch · **Manuell** – dann ordnet man innerhalb
einer Spalte per Ziehen (auch in der Liste); die Reihenfolge gilt nur für einen selbst, neue To-Dos kommen ans Ende.
**Gemerkt je Benutzer, auf allen Geräten:** Ansicht, Einteilung, Filter, Sortierung und die eigene Reihenfolge liegen in
`protokolle_einstellungen.json` am eigenen ChurchTools-Konto (andere können die Datei lesen – drin stehen nur Ansicht und
To-Do-Kennungen). Im Gerät liegt **je Person** ein Spiegel für den sofortigen Start; ohne Netz bleibt alles dort und wird nachgeholt.

**Fenster „To-Do“ (S7-2a):** Ein Tipp auf den Text öffnet das To-Do: Text, Gruppe, Bis, Status, Zuständige (auch
niemand – dann ist es ein To-Do der Gruppe – oder jemand außerhalb der Gruppe, nur als Name), neue Notiz, Verlauf und
„Löschen“ (nur vermerkt, mit Rückfrage). Bei den Zuständigen steht oben **„Alle (N)“**: das wirkt, als hätte man alle
Mitglieder der Liste von Hand angehakt (ein Haken weniger schaltet „Alle“ wieder aus; gleich im Editor am Schildchen
„Wer?“). Ab **zwei Zuständigen** wählt **„So wird es erledigt“**: **Gemeinsam** (einer erledigt es für alle – wie bisher) oder
**Jeder für sich** (jeder hakt seinen Teil selbst ab). Dann ersetzt die Liste **„Wer ist fertig?“** den Status-Umschalter: Name, „✓ am …“ bzw. „offen“;
den eigenen Teil hakt man selbst ab, **für andere nur die Leitung** (z. B. wenn jemand Bescheid sagt). Der **Gesamtstand läuft von selbst**:
niemand fertig = offen, einige = in Arbeit, alle = erledigt (so stehen die Karten im Board in der richtigen Spalte). Auf der Startseite
und im To-Do-Hinweis steht ein solches To-Do nur, **solange mein Teil fehlt**. Im Protokoll-Editor schaltet das Schildchen „Wer?“ den Modus
(„Jeder hakt für sich ab“, sobald das To-Do existiert und zwei Personen zuständig sind). Die Regel „nur den eigenen Teil“ prüft die Erweiterung beim Schreiben
– ChurchTools kennt dafür kein eigenes Recht. Karten, feste Punkte und das Schildchen zeigen bei vielen Zuständigen **höchstens drei Namen und „+N“** (die
volle Liste im Tooltip); im Lesen und im PDF steht immer die ganze Liste. Je Abschnitt „Notizen“ und „Aus welcher Sitzung“ ein Schalter **„Auf Karte
anzeigen“** – für alle gespeichert. **„Neues To-Do“** legt eins ohne Protokoll an (Leitung und Mitglieder). Eine andere
Gruppe wählen **verschiebt** das To-Do: neu in der anderen Gruppe, das alte wird als gelöscht vermerkt; die Verbindung
zur Sitzung entfällt. Steht ein To-Do noch in einem **Protokoll-Entwurf** (dort führt das Protokoll), werden Text,
Gruppe und Löschen im Entwurf **nachgezogen** (S7-2b): Text ändert sich mit, Löschen nimmt die Aufgabe heraus, eine
andere Gruppe macht daraus einen Absatz „… – an „Jugend“ abgegeben“. Dafür nimmt das Fenster kurz die Schreibsperre
des Protokolls; schreibt dort gerade jemand, wird nichts gespeichert und das Fenster nennt den Namen. Wer als Mitglied sich selbst nicht einträgt, sieht das To-Do danach nicht mehr – das
Fenster sagt es vorher. Gespeichert wird nur, was im Fenster geändert wurde. **Namen für Mitglieder:** Mitglieder dürfen die
Mitgliederliste oft nicht lesen. Deshalb speichert jeder, der ein To-Do schreibt, seinen Vornamen an seinen
Verlaufseinträgen mit (`name`). Angezeigt wird erst die Mitgliederliste, dann man selbst, dann dieser Name; wer nie
schrieb, erscheint als „eine weitere Person“, im Verlauf als „jemand“.

**Protokoll beginnen (Leitung, S5-1):** Eine Sitzung ohne Protokoll (Termin mit Besprechungsanfrage oder
Gruppentreffen) zeigt „Protokoll beginnen“. Im Fenster: eine Vorlage, „Wie letztes Mal“ (Tagesordnung des letzten
freigegebenen Protokolls) oder „Leer“. Danach öffnet sich der Editor; feste Aufgaben der Vorlage sind gleich To-Dos.
Hat jemand anderes inzwischen begonnen, öffnet sich dessen Protokoll. Ein Protokoll gehört zu genau einem Termin – bei
Serienterminen zu dem mit demselben Beginn.

**Frühere Treffen (Leitung, v1.0.1):** „Kommend“ zeigt Termine und Treffen ohne Protokoll nur **ab heute**. Für
vergangene gibt es zwei Wege (nur für die Leitung, Mitglieder sehen beides nicht):

- **„Noch ohne Protokoll“** über „Kommend“: zurückliegende Sitzungen ohne Protokoll **seit dem letzten freigegebenen
  Protokoll** der Gruppe (dessen Tag zählt nicht mehr; gibt es keins: die letzten 28 Tage), **bis gestern** – heute
  steht schon in „Kommend“, so erscheint keine Sitzung doppelt oder gar nicht. Je Zeile „Protokoll beginnen“ (dasselbe
  Fenster wie bei kommenden Sitzungen). Leer → kein Block. Wird für sich geladen: Scheitert es, steht im Block ein
  Hinweis, der Rest bleibt nutzbar. Gerechnet wird in der Zeitzone der Gemeinde.
- **„Protokoll nachtragen“** (Kopfzeile von „Kommend“): Fenster mit ‹ Monat ›, Start im laufenden Monat, vorwärts nicht
  darüber hinaus, **liest nur den gezeigten Monat** (bis gestern). Eine Zeile → „Protokoll beginnen“ im selben Fenster
  („‹“ zurück). „Wie letztes Mal“ nimmt das letzte freigegebene Protokoll **vor** diesem Treffen. Die Zeile zeigt Art
  (Einladung / Gruppentreffen / beides), Zusagen und Absagen und einen Hinweis zur Anwesenheit: aus den Antworten
  vorbelegt, von Hand einzutragen (Gruppentreffen ohne Einladung) oder – bei abgeschlossenem Gruppentreffen – „steht in
  ChurchTools fest“.
  „Ohne Protokoll“ heißt: Kein Protokoll-Kopf (Entwurf, geplant oder freigegeben) verweist auf den Termin oder das
  Gruppentreffen – dieselbe Zuordnung wie in der Liste. Termin und Gruppentreffen zur selben Minute sind **eine** Sitzung.
  Beim Lesen eines einzelnen Monats gilt jeder Termin als möglicher Serientermin (ein Kopf gehört nur dem Termin mit
  demselben Beginn). Grenze: Wurde ein Termin nach Beginn des Protokolls verschoben, steht er (vergangen) wieder als „ohne
  Protokoll“ da; „Protokoll beginnen“ legt dann ein zweites an – beim Verschieben über „Sitzung bearbeiten“ passiert das nicht.

**Gruppe wählen (Reiter „Sitzungen“):** Die Überschrift mit dem Gruppennamen ist der Auswahlknopf („Bildtechnik ▾“) – ein Tipp klappt
die Liste aller Gruppen auf, die aktuelle trägt ein Häkchen. Wer nur eine Gruppe sieht, sieht eine einfache Überschrift.

**Neues Protokoll (Leitung, K2a):** „Neues Protokoll“ auf der Startseite und im Reiter „Sitzungen“ legt ein Protokoll
**ohne Termin** an – Gruppe wählen, Titel, Datum/Uhrzeit (auch nachträglich), Vorlage / „Wie letztes Mal“ / leer, auf
Wunsch mit Gruppentreffen für die Anwesenheit. Keine Mail; der Editor öffnet sich gleich.

**Nächste Sitzung festlegen (Leitung, S5-2):** Oben im Bereich „Termine“ eines Protokolls steht die nächste Sitzung
(mit Einladungen und Zusagen); ist keine festgelegt, hat die Leitung dort „Nächste Sitzung festlegen“. Außerordentlich
geht dasselbe über **„Neue Sitzung“** im Reiter „Sitzungen“ – beides nur, wenn für die Gruppe ein Kalender gewählt
ist. Das Fenster ist vorbelegt wie die letzte Sitzung (Titel, Uhrzeit, Dauer; Datum im Abstand der letzten beiden,
sonst vier Wochen; bei „Neue Sitzung“ zählt nur, was schon stattgefunden hat). Eingeladen sind alle aktiven Mitglieder,
abwählbar. **Die Einladungen gehen sofort per Mail raus**
(ChurchTools-Besprechungsanfrage); wer festlegt und sich selbst einlädt, hat gleich zugesagt und bekommt keine Mail.
Angelegt werden Termin, Gruppentreffen und eine **geplante Sitzung**, die beides verknüpft. Fehlt das Recht
„Gruppentreffen pflegen“, steht der Termin trotzdem und das Fenster sagt es. **Nicht einfach wiederholen**, wenn das
Fenster „bitte im Kalender nachsehen“ sagt – sonst kommen die Einladungen doppelt. Einen falsch angelegten Termin in
ChurchTools löschen schickt allen Eingeladenen die Mail „Termin gelöscht“.

**Sitzung bearbeiten und absagen (Leitung, K2b):** „Bearbeiten“ in der Sitzungsansicht und im Kopf des Editors bzw.
„Ändern“ im Kasten „Nächste Sitzung“ öffnet ein Fenster mit Titel, Datum, Uhrzeit, Dauer und den Eingeladenen (frisch vom Termin
gelesen). Termin, Gruppentreffen und Protokoll ziehen mit. **Vor dem Speichern sagt das Fenster, wer welche Mail
bekommt:** neue Zeit mit „Alle neu einladen“ (vorgewählt) – „Termin geändert“, die Zusagen gehen zurück; abgewählt
still. Nur der Titel: still. Einladen: „Neue Besprechungsanfrage“, ausladen: „Termin gelöscht“. „Sitzung absagen“
löscht Termin und Gruppentreffen (Mail „Termin gelöscht“); ein geplantes Protokoll verschwindet, ein begonnenes bleibt
als Entwurf ohne Termin (**das Protokoll selbst löschen** geht über „Löschen“, siehe unten). Termine mit Anmeldung ändert das Fenster nicht.
**Serien:** Einladungen gelten für die ganze Serie. Titel oder Zeit fragen „Nur diese Sitzung“ (wird aus der Serie
gelöst) oder „Ab dieser Sitzung“ (die Serie wird hier geteilt, frühere Termine bleiben; am ersten Termin ändert sich
die ganze Serie). Geteilt hat der neue Termin keine Einladungen – **alle bekommen „Neue Besprechungsanfrage“**.
Absagen: „Nur diese Sitzung“ und „Serie ab hier beenden“ ohne Mail, „Ganze Serie löschen“ mit Mail „Terminserie
gelöscht“ (auch vergangene Termine verschwinden aus dem Kalender; freigegebene Protokolle bleiben).

**Protokoll löschen (Leitung, W6):** Etwas anderes als „Sitzung absagen“: Dort bleibt ein begonnenes Protokoll als Entwurf
stehen – hier **verschwindet das Protokoll selbst**, Entwurf oder freigegeben, ohne Umweg über „Freigabe zurücknehmen“.
Der Knopf **„Löschen“** (rot) steht im Kopf der Sitzung neben „Bearbeiten“ und „Teilen / PDF“, in der Ansicht und im
Editor; nur für die Leitung (wer hier schreiben darf) und nur bei einem Protokoll im Entwurf oder freigegeben – ein bloß
geplantes hat keinen Text und verschwindet mit „Sitzung absagen“. Die Rückfrage „Protokoll löschen?“ zeigt Titel, Datum
und Status und sagt: **Das lässt sich nicht rückgängig machen.** Darin:

- **To-Dos aus diesem Protokoll (N)** – nur, wenn es welche gibt (die in dieser Sitzung entstanden sind; schon gelöschte
  zählen nicht): **Mitlöschen** (vorgewählt; sie werden wie beim Löschen im To-Do-Fenster **als gelöscht vermerkt**, nie hart
  gelöscht, und stehen so im Verlauf) oder **Behalten** (sie bleiben in der To-Do-Liste, ohne Protokoll dahinter).
- **In ChurchTools außerdem löschen** – je ein Häkchen, **anfangs aus**, nur wo es das gibt: den **Termin** (mit der Zahl
  der Eingeladenen, die die Mail „Termin gelöscht“ **sofort** bekommen; bei einer Terminserie fällt nur diese Sitzung aus
  der Serie, **ohne Mail**; ein Termin mit Anmeldung lässt sich hier nicht löschen) und das **Gruppentreffen** (ist es
  abgeschlossen, geht die Anwesenheit mit verloren).

**Reihenfolge:** erst prüfen, ob jemand anderes (oder ein anderes eigenes Fenster) schreibt – dann wird **nichts**
gelöscht –, dann die To-Dos, dann Termin und Gruppentreffen (jeweils nachgelesen: ein „gelöscht“ von ChurchTools ist kein
Beleg), **zuletzt das Protokoll**: erst alle Textteile, dann der Kopf der Sitzung. Bricht es dazwischen ab, steht der Kopf
noch da (ohne lesbaren Text: „nicht vollständig lesbar“), das Fenster bleibt offen und sagt, was schon erledigt ist und
was nicht; **„Nochmal versuchen“** macht nichts doppelt (ein vermerktes To-Do, ein schon gelöschter Termin oder ein
schon gelöschtes Treffen zählt als erledigt). Danach geht es zurück zur Liste mit dem Hinweis „Protokoll gelöscht“; bleiben
Termin und Treffen bestehen, steht die Sitzung wieder als **„ohne Protokoll“** da und lässt sich neu beginnen.
**Folgen anderswo:** Ein späteres Protokoll, das das gelöschte als „Protokoll der letzten Sitzung“ **festgehalten** hat,
zeigt dort „Das damalige Protokoll gibt es nicht mehr“ (auch im PDF); ohne Festhalten gilt das davor als „letztes“. Bei
„Behalten“ steht an den übrigen To-Dos „Aus einer älteren Sitzung“. Ein Beitrag in der Gruppe („In der Gruppe Bescheid
geben“) bleibt stehen – sein Link führt dann auf die Liste. Vorschläge, die schon „im Protokoll“ standen, bleiben gespeichert; in der Liste stehen sie ohnehin nicht mehr (nur als
Marke „übernommen“ an der Sitzung).

**Mehrere Gruppen, ein Kalender – „das Gruppentreffen entscheidet“ (W4):** Nutzen mehrere Gruppen denselben Kalender
(live: Technik, Bildtechnik, Kamera, Stream, Tontechnik im Kalender „Technik“), steht ein Termin daraus nicht in allen
Gruppen unter „Kommend“, „Noch ohne Protokoll“ und „Protokoll nachtragen“. Ein Termin, zu dem eine Gruppe **weder ein
eigenes Gruppentreffen noch ein eigenes Protokoll** hat, wird dort **ausgeblendet**, sobald eine **andere Gruppe mit
demselben Kalender** ein Gruppentreffen zur selben Startzeit (auf die Minute) oder ein Protokoll zu genau diesem Termin
hat. Wer selbst ein Treffen oder Protokoll dazu hat, sieht den Termin weiter – auch wenn eine andere Gruppe ebenfalls
eins hat. Gruppentreffen und Protokolle ohne Termin sind nie betroffen.

- **Trifft sich nur ein Teilteam** (z. B. nur Bildtechnik): in der **Teilgruppe** ein **Gruppentreffen** zur Startzeit des
  Termins anlegen (ChurchTools → Gruppe → Treffen). Danach gehört der Termin dieser Gruppe und verschwindet bei den
  anderen. „Neue Sitzung“ in der Teilgruppe legt Termin und Gruppentreffen dort von selbst richtig an.
- **Trifft sich das ganze Technikteam:** das Gruppentreffen in der Gruppe anlegen, die das Protokoll führt (z. B. „Technik“).
  Gibt es noch keins, steht der Termin in allen Gruppen – bis eins ein Treffen oder Protokoll dazu anlegt.
- **Was gelesen werden kann, zählt:** Die App fragt die anderen Gruppen desselben Kalenders nur, wenn es überhaupt Termine
  ohne eigenes Treffen/Protokoll gibt. Darf die Person die andere Gruppe nicht lesen (keine Rechte auf deren Kategorie
  oder Gruppentreffen) oder antwortet ChurchTools gerade nicht, **zählt diese Gruppe nicht** – der Termin bleibt sichtbar
  (im Browser-Log steht dann eine Warnung mit dem Grund). Ein normales Mitglied von Bildtechnik, das Technik nicht sehen
  darf, sieht deshalb unter Umständen mehr Termine, als es sollte; die Gruppen sieht die App nur über die Kategorien
  „Protokolle“, die für die Person sichtbar sind.

**Protokoll schreiben (Leitung, S4-1):** Ein Protokoll im Entwurf öffnet für alle, die in der Gruppe schreiben dürfen,
direkt im Editor – Mitglieder sehen es weiter nur zum Lesen. Gespeichert wird **automatisch** drei Sekunden nach der
letzten Eingabe; oben steht „gespeichert 19:42 Uhr“ oder „nicht gespeichert – wird erneut versucht“ (der Text bleibt
dabei im Editor). Mit der ersten Änderung entsteht eine **Schreibsperre**: Wer das Protokoll währenddessen öffnet,
sieht „Johann schreibt gerade“, liest den gespeicherten Stand mit (alle 30 Sekunden) und kann mit Rückfrage
**„Schreiben übernehmen“**. Das gilt auch für dieselbe Person in einem zweiten Fenster oder auf einem zweiten Gerät.
Eine Sperre ohne Lebenszeichen verfällt nach zehn Minuten. Aus Word eingefügte Listen und Tabellen bleiben Listen und
Tabellen. Der Umschalter **„Schreiben | Lesen“** zeigt dasselbe Protokoll als Lese-Ansicht – ohne Sperre; was noch
nicht gespeichert war, wird beim Umschalten gespeichert.

**Die Werkzeugleiste (K3a, W7):** vorn Rückgängig/Wiederholen, die **Textart** (Text · Tagesordnungspunkt · Unterpunkt ·
Überschrift) und Fett · Kursiv · Unterstrichen · Durchgestrichen · Formatierung entfernen; dahinter drei Menüs:
**Markieren** (Hintergrund und Schrift in den neun Farben des Editors, „keine“/„auto“ nimmt sie weg), **Absatz**
(Aufzählung, Nummerierung, Aus- und Einrücken, Zitat) und **Einfügen** (To-Do, Beschluss, Termin, Tabelle, die festen
Punkte, Trennlinie). **Punkte ordnen** steht rechts außen (siehe unten). Am Rechner steht alles in einer Zeile. Am Handy steht „Punkte ordnen“
als Erstes, dann Fett und „Aa“ (Textart, Kursiv & Co.), die drei Menüs nur als Zeichen. Die **Checkliste** gibt es nicht mehr zum Einfügen – nur noch To-Dos; alte Checklisten
bleiben lesbar und lassen sich über die Textart in Text verwandeln. Eine **Tabelle** hat eine Kopfzeile; Zeilen und
Spalten kommen über die Griffe an der Tabelle dazu, „Kopfzeile“/„Kopfspalte“ schaltet man im Griff-Menü links.

**Unterpunkte und Einrücken (K3b-1):** **Tab** (oder „Absatz → Einrücken“) macht aus einem Tagesordnungspunkt einen
**Unterpunkt** (4.1), nochmal Tab eine Ebene tiefer (4.1.1) – bis 4.1.1.1.1. **Umschalt+Tab** („Ausrücken“) geht zurück
bis zum Tagesordnungspunkt. Ein Unterpunkt steht höchstens eine Ebene unter dem Punkt davor, und der erste Punkt bleibt
Punkt. Die Nummern stehen im Editor, beim Lesen, in den Bereichen und in der Suche gleich; was unter einem Unterpunkt
steht, heißt dort „Punkt 4.2 · Essen“. Text rückt wie gewohnt ein – auch mehrere markierte Zeilen auf einmal. Die
Textart „Überschrift“ hat keine Nummer.

**Anwesenheit (S5-3):** ein fester Punkt wie „Offene To-Dos“ – über „Einfügen → Anwesenheit“, das „/“-Menü oder
schon in der Vorlage (die Standard-Vorlage „Leitungssitzung“ beginnt damit). Er zeigt die Mitglieder aus dem
ChurchTools-**Gruppentreffen** mit ihrer Antwort auf die Einladung; beim Schreiben je Person **Anwesend / Abwesend**
(nochmal tippen = wieder offen). Jeder Tipp steht sofort im Gruppentreffen. Beim ersten Öffnen ist er **von selbst
vorbelegt** (Zusage = anwesend, Absage = abwesend), solange am Treffen noch niemand etwas eingetragen hat. **Gäste**
trägt man als freien Namen ein; sie stehen nur im Protokoll. Zugeklappt (beim Lesen von selbst) steht die Kurzform
„Anwesend (n): … · Abwesend: …“. Gibt es zur Sitzung kein Gruppentreffen, legt „Gruppentreffen anlegen“ eins an (ohne
Mail). Eintragen darf, wer in der Gruppe „Gruppentreffen pflegen“ hat – das gibt „Gruppe einrichten“ der Leitung.

**Person aus der Anwesenheit nehmen:** Beim Schreiben hat jede Personenzeile einen kleinen Knopf **„… aus dem Protokoll
nehmen“** – gedacht für Gemeinschaftskonten oder Mitglieder, die nie dabei sind, aber als Gruppenmitglied in jedem
Gruppentreffen stehen. Das gilt **nur für dieses Protokoll** (gespeichert im festen Punkt, `props.ohne`); im
ChurchTools-Gruppentreffen ändert sich nichts. Unter der Liste steht **„n ausgeblendet“** mit **„Zeigen“**; dort holt
**„Zurückholen“** eine Person wieder herein. Ausgeblendete fehlen in den Zahlen, in der Kurzform, beim Lesen und im PDF,
zählen beim Freigeben nicht als „noch offen“ und werden von der automatischen Vorbelegung nicht angefasst. Das Ausblenden
geht auch, wenn das Gruppentreffen schon abgeschlossen ist (das Tippen von Anwesend/Abwesend dann nicht mehr). Ein neues
Protokoll über „Wie letztes Mal“ übernimmt die ausgeblendeten Personen **nicht** – dort steht wieder die ganze Gruppe.

**Punkte vorschlagen (S5-4):** Im Reiter „Sitzungen“ steht bei „Kommend“ **„Punkt vorschlagen“** – für alle, die die
Gruppe sehen. Man wählt die Sitzung (vorbelegt die nächste; ohne festgelegte heißt sie „Nächste Sitzung“, der
Vorschlag rutscht dann von selbst dorthin), ein Thema und freiwillig ein, zwei Sätze. Die Karte **„Vorschläge“** unter
„Kommend“ zeigt die **offenen** Vorschläge der Gruppe in der Kurzform (W8c): Titel, darunter höchstens eine Zeile Text
und „von …“. **Antippen klappt den Vorschlag auf** – dann stehen der ganze Text und die Knöpfe da (eigene, offene:
**Ändern**, **Zurückziehen**; Leitung: **Übernehmen**, **Nächstes Mal**, **Ablehnen**); aufgeklappt ist immer nur einer.
Der Kopf **„Vorschläge · n offen“** klappt die ganze Karte zu und auf: Standard offen, wenn es offene gibt, sonst zu –
die Wahl merkt sich das Gerät (je Person und Gruppe). **Übernommene** verschwinden aus der Liste: In „Kommend“ trägt die
Sitzung dafür die Marke **„n Vorschläge übernommen“** (neben „n Vorschläge offen“). **Zurückgezogene** stehen nicht
mehr in der Liste. **Abgelehnte** stehen **7 Tage** in einer kleinen Gruppe „Abgelehnt · verschwindet nach 7 Tagen“
– nur für den, der vorschlug, und die Leitung – mit „Grund: …“ und „noch n Tage sichtbar“; ein **×** blendet einen
früher aus (nur auf diesem Gerät). Gespeichert bleibt alles, nichts wird gelöscht. Was nach dem Vorschlagen passiert,
stellt „Gruppe einrichten“ ein:

- **Vorschlagen:** Die Leitung sieht beim Schreiben oben „Vorschläge · n“ – **Übernehmen** setzt einen Punkt vor
  „Verschiedenes“ (sonst ans Ende), **Nächstes Mal** schiebt ihn zur Sitzung danach, **Ablehnen** fragt nach einer
  freiwilligen Begründung, die der Vorschlagende sieht. Übernehmen geht auch in der Karte; eingefügt wird dann beim
  nächsten Öffnen des Protokolls.
- **Direkt eintragen:** Beim Öffnen des Protokolls stehen die Vorschläge schon als Punkte vor „Verschiedenes“.

Unter dem Punkt steht kursiv „vorgeschlagen von …“ (änderbar wie jeder Text). Ein offener Vorschlag, dessen Sitzung
abgesagt oder ohne ihn freigegeben wurde, rutscht zur nächsten Sitzung weiter.

**Früheres Protokoll (K3b-2):** „Einfügen → Früheres Protokoll“ (auch im „/“-Menü) fragt, **welches** – alle
freigegebenen Protokolle der Gruppe, das letzte vorgewählt. Der Kasten zeigt es mit **„Ansehen“** im kleinen Fenster;
dort springt **„Öffnen“** zu dieser Sitzung (aus dem Editor wird vorher gespeichert), „Zurück“ führt wieder her. Beim
Schreiben wählt **„Ändern“** am Kasten ein anderes. Der Kasten aus der Vorlage zeigt „immer die letzte Sitzung“, bis man
ändert; bei der Freigabe wird festgehalten, welches es war.

**Aufgaben, Beschlüsse, Termine (S4-2):** über „Einfügen“ in der Werkzeugleiste, das „/“-Menü oder „[] “ + Leertaste
(Aufgabe; in Leiste und Menü heißt sie seit K3a „To-Do“). Eine Aufgabe mit Text ist beim nächsten Speichern ein **To-Do** – die Zuständigen sehen es sofort unter
„Meine offenen To-Dos“, auch solange das Protokoll Entwurf ist. An der Aufgabe: der Haken (abhaken ↔ wieder offen; „in Arbeit“ stellt man im Fenster „To-Do“ ein), „Wer?“ (Mitglieder der Gruppe, dazu ein externer Name ohne eigenen Zugang) und „Bis“. Das Protokoll führt:
geänderter Text zieht ins To-Do mit; wird die Aufgabe gelöscht, wird das To-Do als gelöscht vermerkt (nie endgültig),
„Rückgängig“ holt es mit allen Angaben zurück. Ein Termin steht nur im Protokoll (kein Eintrag im Kalender).

**Feste Punkte (S4-3a):** „Offene To-Dos“ zeigt die offenen To-Dos der Gruppe aus früheren Sitzungen (überfällige
zuerst) mit Haken, Wer und Bis; darunter eingeklappt „Seit der Sitzung am … erledigt“. Im Editor hakt man sie
am Haken ab, in der Lese-Ansicht ist es nur Anzeige. „Protokoll der letzten Sitzung“ zeigt das letzte **freigegebene**
Protokoll der Gruppe vor dieser Sitzung; „Öffnen“ zeigt es im Fenster. Beide füllen sich **bis zur Freigabe live**;
bei der Freigabe merkt sich das Protokoll, was sie zeigten (wird die Freigabe zurückgenommen, sind sie wieder live; ein
bewusst gewähltes früheres Protokoll bleibt). Einfügen über „Einfügen“ in der Werkzeugleiste oder das „/“-Menü
(Gruppe „Feste Punkte“) – als Tagesordnungspunkt mit Titel, den man umbenennen kann.

**Freigeben (S6-1):** Im Editor oben **„Freigeben“** (blau, nur die Leitung, solange niemand anders schreibt). Das
Fenster zeigt **Hinweise**, ohne zu zwingen: wer in der Anwesenheit noch offen ist („geprüft?“), To-Dos ohne
Zuständigen, noch offene Vorschläge (sie rutschen zur nächsten Sitzung) – „Ansehen“ springt an die Stelle – und eine
Zusammenfassung. **Freigeben** speichert zuerst, hält die festen Punkte fest, macht das Protokoll **fest** und schließt
das **Gruppentreffen** in ChurchTools ab (danach lässt sich die Anwesenheit dort nicht mehr ändern; Kommentar und Gäste
bleiben). Klappt das Abschließen nicht, ist das Protokoll trotzdem frei und das Fenster bietet „Nochmal versuchen“.
To-Dos bleiben abhakbar. Danach steht oben **„freigegeben am … von …“**.

**In der Gruppe Bescheid geben (S6-2):** Darf man in der Gruppe Beiträge schreiben (siehe Rechte), hat das Fenster
das Häkchen **„In der Gruppe Bescheid geben“** – vorbelegt an, mit Vorschau. Beim Freigeben entsteht ein Beitrag in der
Gruppe (gruppenintern, ohne Kommentare, Absender ist man selbst): „Protokoll vom … ist freigegeben“ mit dem Link
**„Protokoll öffnen“**, der direkt in diese Sitzung führt (`…/ccm/<Kürzel>/#/sitzungen/<Gruppe>/<Sitzung>`). Ob
ChurchTools die Mitglieder per Mail oder App benachrichtigt, hängt an deren Einstellungen. Klappt der Beitrag nicht, ist
das Protokoll trotzdem frei: „Nochmal versuchen“ – außer ChurchTools hat nicht geantwortet; dann ist unklar, ob er schon
da ist, und das Fenster bittet, in der Gruppe nachzusehen (sonst stünde er doppelt da). Zurücknehmen lässt den Beitrag
stehen.

**Freigabe zurücknehmen (S6-1):** Bei einem freigegebenen Protokoll sieht die Leitung **„Freigabe zurücknehmen“**
(mit Rückfrage). Es wird wieder ein Entwurf; über dem Protokoll steht „Freigabe zurückgenommen am … von … – vorher
freigegeben am … von …“. Das Gruppentreffen bleibt abgeschlossen. Beim nächsten Freigeben wird neu festgehalten.

**Teilen / PDF (S6-3):** Oben in jeder Sitzung mit Protokoll – beim Lesen und beim Schreiben, für alle, die es lesen
dürfen – öffnet **„Teilen / PDF“** das Fenster „Protokoll teilen“ mit den Seiten, „Herunterladen“ und „Teilen“ (am
Handy/iPad das Teilen-Menü). Das PDF hat oben Gruppe, Titel, Datum und „Freigegeben am … von …“, dann das Protokoll wie
beim Lesen (Anwesenheit kurz, To-Dos mit Wer und Bis, ohne Status; bei „Offene To-Dos von früher“ die seither erledigten
ausgeschrieben) und am Ende die Übersicht mit Beschlüssen, To-Dos, Terminen und der nächsten Sitzung. Ein **Entwurf**
trägt „ENTWURF – NOCH NICHT FREIGEGEBEN“ im Kasten, ein blasses „ENTWURF“ auf jeder Seite und „ENTWURF“ im Dateinamen
(`Protokoll <Gruppe> <JJJJ-MM-TT> ENTWURF.pdf`). Im Editor kommt auch noch nicht Gespeichertes mit. Wer die
Mitgliederliste nicht sieht, bekommt bei To-Dos die Namen aus dem Verlauf oder „eine weitere Person“.

**Mit KI füllen (Leitung, S8-2):** Im Editor eines Entwurfs steht neben „Freigeben“ der Knopf **„Mit KI füllen“** (nur
die Leitung, nur solange man schreiben darf, nicht beim Lesen). Aus der Aufnahme einer Sitzung entstehen so Stichpunkte,
Beschlüsse, To-Dos und Termine – du prüfst alles, bevor es ins Protokoll kommt. In drei Schritten:

1. **Auftrag:** Transkript einfügen oder eine Datei (`.txt` oder Word `.docx`) wählen. Die Erweiterung sucht Namen
   (volle Namen aller Personen, die du in ChurchTools sehen darfst, Vornamen der Gruppe, „Familie …“, „Herr …“,
   „Frau …“) – auch in den Titeln der Tagesordnung – und zeigt sie mit Platzhalter. Ein Häkchen weg lässt den Namen
   stehen. Unter **„Weiteres verbergen“** trägst du eigene Begriffe ein. **Heikles (z. B. Krankheiten) trägst du selbst
   ein oder nimmst es vorher aus dem Text** – gefunden werden nur Namen. „So geht es an die KI“ zeigt den fertigen
   Auftrag. **„Auftrag kopieren“** legt ihn in die Zwischenablage.
2. **Antwort:** Den Auftrag in die KI deiner Wahl einfügen und die **ganze** Antwort hier einfügen. Klappt das Kopieren
   nicht, hilft „Auftrag anzeigen“: Text markieren und von Hand kopieren. Ist die Antwort nicht lesbar, steht die Meldung
   im Fenster und dein Text bleibt.
   **Antwort schon da?** In Schritt 1 führt **„Antwort schon da? Direkt einfügen“** ohne Transkript gleich hierher (dann
   gibt es keinen Auftrag zu kopieren; „Zurück“ geht zu Schritt 1). Kommen in der Antwort Platzhalter wie `[Person 1]`
   vor, die das Fenster nicht kennt – etwa weil die Antwort aus einem früheren Lauf stammt –, steht darunter **„Platzhalter
   zuordnen“**: je Platzhalter ein Feld für einen Namen, mit den Gruppenmitgliedern als Vorschlag. Leer lassen = der
   Platzhalter bleibt stehen. Ein gewähltes Mitglied wird bei To-Dos zur zuständigen Person, jeder andere Name zum externen.
   Ohne Transkript kennt das Fenster gar keine Platzhalter-Nummern, dann ist jeder Platzhalter der Antwort Handarbeit.
3. **Vorschau:** Jede Zeile hat ein Häkchen (an) und zeigt klein, wohin sie kommt („→ 3.1 Küche“). Was zu keinem Punkt
   passt oder zu einem festen Punkt gehört, ist ausgegraut und wird nicht übernommen. Die echten Namen sind wieder
   eingesetzt (grün). **„Ausgewählte übernehmen“** fügt die Stichpunkte, Beschlüsse, To-Dos und Termine **hinter den Text
   ihres Punkts** ein (hat er Unterpunkte: vor den ersten, damit sie zu diesem Punkt zählen), neue Punkte ans Ende der
   Tagesordnung. Danach speichert das Protokoll von selbst; die To-Dos entstehen
   beim Speichern (Zuständige aus der Gruppe als Mitglied, alle anderen als extern). Bitte kurz im Blatt prüfen.
   Bleiben Platzhalter ohne Namen stehen, nennt ein Hinweis oben alle auf einmal („… ist keinem Namen zugeordnet – nach
   dem Übernehmen selbst ersetzen“). Ein To-Do, dessen Zuständiger so ein Platzhalter war, bekommt **niemanden**
   („niemand zuständig“) – der Platzhalter wird nicht als externer Name übernommen.
   **Neue Punkte** tragen nicht nur Stichpunkte, sondern auch **Beschlüsse, To-Dos und Termine**: Die Vorschau zeigt sie
   unter dem Punkt (mit Zuständigen und Datum) – **ein** Häkchen gilt für den ganzen Punkt. Beim Übernehmen entstehen
   Tagesordnungspunkt, Stichpunkte, Beschlüsse, To-Dos und Termine in genau dieser Reihenfolge, in denselben Blöcken wie bei
   einem vorhandenen Punkt. So lässt sich auch ein **leeres Protokoll ohne Tagesordnung** füllen: Der Auftrag bittet die KI
   dann, den Inhalt selbst in Punkte zu gliedern (`neue_punkte`), mit Beschlüssen, To-Dos und Terminen beim jeweiligen
   Punkt. Antworten im alten Aufbau (neue Punkte nur mit Stichpunkten) gehen weiter.

**Datenschutz:** Transkript, gefundene Namen und die Zuordnung bleiben **nur im Fenster** – nichts wird in ChurchTools
oder im Browser gespeichert, Schließen heißt weg. Zur KI geht nur der Text, den du selbst kopierst und einfügst, mit
Platzhaltern statt Namen. Die Erweiterung ruft keine KI selbst auf. Der Auftrag lässt sich erst kopieren, wenn
Personenliste und Gruppenmitglieder geladen sind; lässt sich die Personenliste nicht laden, steht ein Hinweis im Fenster
und Namen müssen von Hand unter „Weiteres verbergen“ eingetragen werden. Wer die Mitgliederliste nicht sehen darf, bekommt
Vornamen nicht von selbst ersetzt (volle Namen weiterhin).

**Punkte ordnen (W7, seit S4-3b im Text, jetzt im Fenster):** Tagesordnungspunkte und Unterpunkte stellt man **nur noch
im Fenster „Punkte ordnen“** um – der Knopf steht **rechts in der Werkzeugleiste** (am Handy als Erstes) und ist
ausgegraut, solange es nichts zu ordnen gibt (weniger als zwei Punkte unter demselben Punkt). Das Fenster listet alle
Punkte mit Nummer, Titel und einer Zeile, was mitwandert („3 Stichpunkte · 1 To-Do · 1 Beschluss“; ein fester Punkt
trägt „fester Punkt“). **Ein Punkt nimmt seine Unterpunkte und seinen ganzen Inhalt mit, die Ebene bleibt:** Unterpunkte
nur innerhalb ihres Punkts, Tagesordnungspunkte nur zwischen Tagesordnungspunkten; feste Punkte wandern normal mit; eine
„Überschrift“ (ohne Nummer) wandert mit ihrem Abschnitt; Text vor dem ersten Punkt bleibt oben. Bedienung: am **Griff
ziehen** (Maus sofort, Finger nach kurzem Halten – eine blaue Linie zeigt nur erlaubte Stellen), **↑ ↓** an jeder Zeile,
auf dem Griff die **Pfeiltasten**; „Rückgängig“ im Fenster nimmt den letzten Schritt zurück. Erst **„Übernehmen“** (erst
nach einer Änderung bedienbar) ändert das Protokoll – als **ein** Schritt: ein Strg+Z im Editor holt alles zurück; die
Blöcke behalten ihre IDs (To-Dos bleiben verbunden). „Abbrechen“ ändert nichts; mit nicht übernommener Änderung schließen
weder X noch Esc noch ein Tipp daneben das Fenster. Am Handy füllt das Fenster den Bildschirm. **Im Text** gibt es
links weder „+“ noch Griff (seit v1.0.6, Alwin: „Verschieben der Punkte nur noch über Punkte ordnen“) – eingefügt wird
über **„Einfügen“** und „/“, gelöscht mit Entf/Rücktaste (Entf am Ende einer Überschrift löscht auch einen festen Punkt
darunter). Nur **Tabellen** haben noch einen Griff: sein Menü schaltet Kopfzeile/Kopfspalte und löscht die Tabelle.

**Suche (Lupe oben rechts):** sucht in Beschlüssen, To-Dos, Terminen und im Protokolltext aller eigenen Gruppen –
auch im Tagesordnungspunkt und im Sitzungstitel; alle Wörter müssen vorkommen. Filter nach Art und Gruppe. Ohne
Suchbegriff stehen dort **alle Beschlüsse**. Beschlüsse, Termine und Text kommen nur aus **freigegebenen**
Protokollen, To-Dos aus allen. Ein Treffer öffnet die Sitzung am Tagesordnungspunkt.

Auf der Startseite stehen nur Gruppen, deren Protokolle man sehen darf – eine Gruppe ohne Zugriff (oder noch nicht
eingerichtet) fehlt dort; den Stand aller Gruppen sehen Admins in der Verwaltung.

| Stand auf der Startseite   | Bedeutung                                                         |
| -------------------------- | ----------------------------------------------------------------- |
| eingerichtet               | beide Kategorien der Gruppe sind sichtbar                         |
| unvollständig eingerichtet | nur die Protokoll-Kategorie ist sichtbar – Einrichten wiederholen |

**Versteckte Gruppen und Gruppentypen:** „versteckte Gruppe sehen“ hilft nur, wenn die Rolle die Gruppe überhaupt
sehen darf – das legt der **Gruppentyp** fest. In einem Typ, dessen Teilnehmer die Gruppe nicht sehen (in der
Test-Instanz „Anmeldung“), sehen sie auch nach dem Einrichten die Mitglieder nicht. Für die Protokolle selbst spielt
das keine Rolle (sie hängen an den Kategorien), für die Anwesenheit schon (gemessen 22.10.2026, S2-4).

## Für Entwickler

- Regeln (ohne Oberfläche, getestet): `shared/protokolle/` – Dokument und Ableitung (`dokument.ts`), Speicher mit
  Kopf und gepackten Teilen (`speicher.ts`), To-Dos (`aufgaben.ts`), Einrichten (`einrichten.ts`), Vorlagen
  (`vorlagen.ts`), Namen für die KI (`platzhalter.ts`), Meine Gruppen (`gruppen.ts`), Sitzungen (`sitzungen.ts`; darin `fremdeTermineAus`, die Regel „das Gruppentreffen entscheidet“ – angewandt in
  `protokolle/src/lesen.ts` für `ladeSitzungen` und `sitzungenOhneProtokoll`, nur dort),
  Suche (`suche.ts`), Beitrag nach der Freigabe (`beitrag.ts`), das Protokoll als Blatt fürs PDF (`protokollBlatt.ts`,
  gezeichnet in `ui/teilen/protokollPdf.ts` auf dem gemeinsamen `PdfSatz`; S6-3a; Fenster `ProtokollTeilenFenster.tsx`,
  nachgeladen über `ProtokollTeilen.tsx`, S6-3b).
- Mit KI füllen (S8-1 Regeln, S8-2 Fenster): `shared/protokolle/ki.ts` – `tagesordnung`
  (Punkte und Unterpunkte mit Nummer wie im Protokoll, feste Punkte = „nichts zuordnen“), `auftragBauen` (bekommt das schon
  mit `platzhalter.ts` ersetzte Transkript), `antwortLesen` (tolerant bei Codeblock/Drumherum/`nr` als Zahl, streng bei
  Typen; kaputt → `{ ok: false, meldung }`, wirft nie; Namen über `zuruecksetzen`, Zuständige: Person der Gruppe → Mitglied,
  sonst extern) und `uebernahmePlanen` (je Ziel ein Aufruf `{ vor, bloecke }` für `EditorGriff.einfuegen`: vor den nächsten
  Punkt – bei Unterpunkten vor den ersten, damit es zum Punkt zählt –, später im Dokument zuerst, neue Punkte zuletzt; To-Do-Blöcke tragen `props.vorab`, keine To-Do-ID).
  `shared/protokolle/docxText.ts` – Text einer `.docx` (`docxText(bytes)` → `{ ok, text } | { ok: false, meldung }`, mit
  `fflate`, ohne DOM).
  Das Fenster (S8-2): `protokolle/src/KiFuellenFenster.tsx`, nachgeladen über `KiFuellen.tsx` (Knopf `KiKnopf` im Kopf
  von `ProtokollSchreiben.tsx`, Bedingung `darfKi` = Freigeben-Bedingung und nicht in der Lese-Ansicht des Editors).
  Es verbindet nur: Personen `kiPersonen.ts` (`ladePersonen`, `ctAlleSeiten('/persons', 200)`), `gruppe` = die Personen
  der Liste, die Mitglied sind (verborgen/`null` → keine; solange `null` oder die Liste lädt, ist Kopieren gesperrt),
  `namenFinden` über Transkript + Tagesordnungstitel + Gruppenname, `auftragBauen`/`antwortLesen`/`uebernahmePlanen` mit
  `EditorGriff.einfuegen` (Einfügungen in der gelieferten Reihenfolge, Plan mit frisch gelesenem Dokument, neue Block-IDs
  `crypto.randomUUID()`). Zustand nur im Fenster; ein Tipp neben das Fenster schließt es nicht, solange Text drinsteht.
  Platzhalter von Hand (17.11.2026): `unzugeordnet` (welche Platzhalter die Zuordnung nicht kennt) und
  `zuordnungErgaenzen` (führt die gewählten Namen mit der Zuordnung zusammen) in `platzhalter.ts`, `offenePlatzhalter`
  (was in der Vorschau offen bleibt) in `ki.ts`; ein Platzhalter ohne Namen steht bei einem To-Do in `Eintrag.offen`, nie in
  `wer`. Ohne Transkript rechnet das Fenster mit leerer Zuordnung und ohne Funde.
- Anwesenheit ohne bestimmte Personen (17.11.2026): `props.ohne` am Verweis-Block „anwesenheit“ (JSON-Liste von
  Personen-IDs, `ohneAus`/`ohneWert` in `shared/protokolle/anwesenheit.ts`). `ohneAusgeblendete` nimmt sie aus dem
  `TreffenStand` und ist die einzige Stelle dafür – benutzt von `Anwesenheit.tsx`, `protokollBlatt.ts` (Lesen, PDF,
  Teilen), `freigabeHinweise` (liest `ohne` am ersten Anwesenheits-Block des Dokuments) und `vorbelegung`/`vorbelegen`.
  Wer eine neue Stelle baut, die Personen der Anwesenheit zeigt, zählt oder prüft, geht darüber.
- Schreiben: `protokolle/src/schreiben.ts` (Sperre nehmen, speichern, übernehmen, freigeben – vorher frisch lesen,
  nachher nachlesen), `schreibSteuerung.ts` (wann gespeichert wird), Editor `DokumentEditor.tsx` + `editorSchema.ts`
  (BlockNote 0.56, fest gepinnt – Updates bewusst, die Schnittstellen ändern sich in 0.x noch), Word-Listen
  `wordListen.ts`. Der Editor wird erst beim Schreiben nachgeladen (eigene JS-/CSS-Datei im ZIP).
- To-Dos aus dem Protokoll: Regeln `aufgabenAbgleich` / `aufgabenIdsVergeben` (`shared/protokolle/aufgaben.ts`),
  Schreiben in „Mitarbeit“ `protokolle/src/aufgabenSchreiben.ts`; der Abgleich läuft in `speichern` nach der Sperr-Prüfung
  und vor dem ersten Schreiben am Protokoll. Die Blöcke `EditorBloecke.tsx` bekommen To-Dos und Mitglieder über
  `aufgabenKontext.ts`.
- Feste Punkte: Regel `shared/protokolle/festePunkte.ts` (`letztesProtokoll`, `offeneVonFrueher`,
  `festePunkteFesthalten` über `festhaltenFuerFreigabe` bei der Freigabe, `festePunkteLoesen` beim Zurücknehmen),
  Baustein
  `FesterPunkt.tsx` für Editor und Lese-Ansicht, Kontext + Fenster `FestePunkteRahmen.tsx`. Festgehalten wird in
  `props.fest` des Verweis-Blocks; „wie letztes Mal“ und Vorlagen nehmen es nicht mit.
- Beginnen: Regel `shared/protokolle/beginnen.ts`, Zuordnung Kopf ↔ Termin/Treffen `gehoertZu` in
  `shared/protokolle/sitzungen.ts`, Schreiben `protokolle/src/beginnen.ts`, Fenster `ProtokollBeginnen.tsx`.
- Griff im Editor: nur noch an Tabellen (`hatGriff` in `protokolle/src/zeilenGriff.ts`, `Griff` in `DokumentEditor.tsx`,
  ohne „+“), mittig zur ersten Textzeile (`protokolle/src/griffLage.ts`); enthält die Markierung eine Überschrift, zieht er
  nur die Tabelle (`nurDieseZeile`) – sonst nähme BlockNote die ganze Markierung samt Überschrift mit.
- Wer/Bis vor dem Text: `props.vorab` am Aufgaben-Block (JSON), übernommen beim Anlegen des To-Dos (`vorabAnwenden` in
  `aufgabenAbgleich` und beim ersten Tipp); danach leert der Block es.
- Frühere Treffen (v1.0.1): Regeln `shared/protokolle/fruehere.ts` (`ohneProtokollZeitraum`, `monatsZeitraum`,
  `ohneProtokoll` auf `sitzungenZusammenfuehren` aus `sitzungen.ts`, `vorZeit`), Lesen `protokolle/src/lesen.ts`
  (`sitzungenOhneProtokoll` – dieselben `termineMitAnfrage`/`treffenLesen` wie `ladeSitzungen`, für beliebige Tage;
  `sitzungenNochOhneProtokoll` für den Block; `treffenLesen` nimmt `isCompleted` als `abgeschlossen` mit), Block
  `NochOhneProtokoll.tsx`, Fenster `ProtokollNachtragen.tsx`, gemeinsame Zeile `FruehereText.tsx`; „Protokoll beginnen“
  (`ProtokollBeginnen`, Eigenschaften `frueher`/`zurueck`) und `protokollBeginnen` sind unverändert dieselben. Ein
  Protokoll zu einem vergangenen Termin liest die Antworten auf die Einladung wie die hinter den 180 Tagen
  (`termineAusserhalb` in `lesen.ts`), sonst bliebe die Anwesenheits-Vorbelegung leer.
- Neues Protokoll (K2a): Fenster `ProtokollNeu.tsx` – schreibt über `protokollBeginnen` (Termin `null`), Treffen über
  `treffenAnlegen`; die Wahl des Anfangs ist `useAnfangWahl` (`AnfangWahl.tsx`, auch in „Protokoll beginnen“).
- Nächste Sitzung festlegen: Regel `shared/protokolle/planen.ts` (`vorbelegung`, `zeitraum`, `geplanterKopf`,
  `naechsteNach`), Schreiben `protokolle/src/planen.ts` (Termin → nachlesen → Treffen → Kopf; nach dem Termin nur
  noch Hinweise, nie zurückrollen; unklare Antwort → im Kalender nachsehen, Fehlerklasse `Unklar`), Fenster
  `SitzungFestlegen.tsx`, Kasten `NaechsteSitzung.tsx`. Gemessen: `protokolle-planung/docs/messung-s5-2-2026-10-28.md`.
- To-Do-Übersicht (S7): Regel `shared/protokolle/uebersicht.ts` (`sichtbarFuer`, `einteilen`, `langeErledigt`), Seite
  `protokolle/src/ToDos.tsx`, Haken `Haken.tsx` (Übersicht, Editor, feste Punkte – Regel `hakenSchritt`), Fenster `ToDoFenster.tsx`; Regeln `bearbeiten`, `verschieben`, `letzteNotiz`, „Jeder für sich“ (`istJeder`, `teilSetzen`, `gesamtstandNeu`, `modusSetzen`, `istFuerMichOffen`, `erledigtVon`) in
  `shared/protokolle/aufgaben.ts`; geschrieben wird über `protokolle/src/todoSchreiben.ts` (`aufgabeAendern`; beide Schreibtore stempeln den eigenen Vornamen per `mitNamen`; neue IDs
  entstehen beim Öffnen des Fensters – ein zweiter Versuch legt nichts doppelt an). Nachziehen im Entwurf (S7-2b):
  Regel `shared/protokolle/nachziehen.ts` (`aufgabeNachziehen`), Ablauf `protokolle/src/nachziehen.ts`
  (`imEntwurfNachziehen`: Sperre nehmen → Dokument ändern → `speichern` mit dem normalen Abgleich → Sperre freigeben).
  Board und Sortieren (S7-3): Regeln `spalten`, `ablegen`, `sortieren`, `umordnen` in `shared/protokolle/uebersicht.ts`,
  Ziehen `protokolle/src/ToDoZiehen.tsx` (Regel `toDoZiehenRegel.ts`, Sensoren `useZiehSensorenLangDruecken` in
  `ui/bedienung/useZiehSensoren.ts`), Verlauf „Zuständig“ `zustaendigSetzen` in `shared/protokolle/aufgaben.ts`.
  Einstellungen je Benutzer: `protokolle/src/useToDoEinstellungen.ts` über `@shared/ct/personenAblage` (`mischeEin`,
  eigenes Präfix `protokolle_`) und den Browser-Anschluss `ui/ct/ablagePort.ts` (mit der Musik-App geteilt).
- Sitzung bearbeiten (K2b): Regel `shared/protokolle/bearbeiten.ts` (`aenderungVon`, `mailsVon`/`mailsSerie`,
  `terminRumpf` – ein Termin-`PUT` leert, was fehlt, darum geht der gelesene Termin vollständig zurück; Serien:
  `serienWeg`, `teilRumpf`, `ausnahmeRumpf`, `endeRumpf`, `verschoben`), Schreiben `protokolle/src/bearbeiten.ts`
  (Termin → Einladungen → Treffen → Köpfe; geteilt wird ohne Einladungsliste, dann einzeln eingeladen; ein schon
  herausgelöster Tag wird abgewiesen statt doppelt angelegt), Fenster `SitzungBearbeiten.tsx`, Felder
  `Planungsfelder.tsx`. Termin und Besprechungsanfragen liest `protokolle/src/termin.ts` (auch Liste und Festlegen);
  Protokolle mit Termin hinter den 180 Tagen der Liste liest `lesen.ts` gezielt nach (`termineAusserhalb`, seit v1.0.1 auch Termine vor dem Fenster). Gemessen: `protokolle-planung/docs/messung-k2b-2026-10-29.md`, `messung-k2b2-2026-10-29.md`.
- Punkte ordnen (W7): Abschnitts-Regel `shared/protokolle/abschnitte.ts` (`abschnittEnde`, `abschnittVerschoben`),
  Gliederung und Umstellen mit Ebenen-Regel `shared/protokolle/gliederung.ts` (`gliederung`, `punktVerschieben`,
  `gibtZuOrdnen`; Nummern aus `ableiten`), Fenster `PunkteOrdnen.tsx` mit dem Ziehen in `usePunkteZiehen.ts`, Übernehmen
  in den Editor `punkteUebernehmen.ts` (`reihenfolgeUebernehmen`: ein `transact`, nur die geänderte Spanne, nur auf dem
  Stand, von dem das Fenster ausging). Der Knopf hängt in `Werkzeugleiste.tsx`; `Sheet` hat dafür `handyVoll`. Der Griff
  sitzt ohne BlockNotes Überschriften-Versatz (`GRIFF_LAGE`).
- Bauplan und Messungen liegen in einem Planungsordner außerhalb des Repos – die Verweise auf `protokolle-planung/…` in
  dieser Anleitung meinen diesen Ordner.
- Erweiterung: `protokolle/` (`npm run dev -w protokolle`, dann `http://localhost:5192/ccm/protokolle/?demo`;
  weitere Fälle `?demo=leer`, `?demo=ohne-modul`, `?demo=fehler`, `?demo=gesperrt`).
- Release: Tag `protokolle-vX.Y.Z` (Workflow `protokolle-release.yml`, immer `make_latest: false`).
