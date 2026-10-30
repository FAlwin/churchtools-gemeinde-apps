# Changelog

Alle nennenswerten Änderungen an diesem Projekt werden hier festgehalten.
Format angelehnt an [Keep a Changelog](https://keepachangelog.com/de/1.1.0/),
Versionierung nach [SemVer](https://semver.org/lang/de/):
`MAJOR.MINOR.PATCH` – z. B. `v2.1.0` = Feature, `v2.1.1` = Bugfix, `v3.0.0` = größere Umstellung.

## [Unreleased]

## [2.38.0] – 2026-10-30

**Überblick.** Musik-App: der **Lied-Editor** L1–L6 (Akkorde als Kärtchen, Ablauf, Liedinfo aus ChurchTools, Akkord-Leiste,
„Einfügen“, „Nur Text“); **Seiten und Liedblatt im ChurchTools-Look** (Seitenköpfe, Kopf mit Lied-Leiste, Fußleiste
„Zurück · Nächstes Lied · Weiter“, Lied-Menü als Fenster in der Mitte); **„zuletzt gesungen“** in den Liedlisten und im
Lied-Menü; Abwesenheiten wie im Dienstplaner; am iPhone gemessener unterer Rand, Plus wie in ChurchTools, Editor-Kopf
unter dem Band, keine hängenden Hover-Farben. Alle Apps: Fenster im Aufbau von ChurchTools (F1–F5). Aus dem anderen
Teil des Repos (eigene Erweiterungen): Dienstplaner E6 (Ablauf in der Planen-Matrix, Infos je Dienstgruppe),
Anmeldungen A8–A9 und U1–U2, Protokolle S2–S7 und K1–K2, Organigramm O2–O7b.

### Geändert (Musik-App)

- **Einführung im Liedblatt nachgezogen (Scheibe B5).** Schritt 1 nennt jetzt auch „Weiter“ und „Zurück“ unten,
  Schritt 2 das neue Fenster des Lieds (Tonart und Kapo, Akkorde oder nur Text, Version, „Bearbeiten“, zuletzt
  gesungen). Die Einführung bleibt bei Version `chart-v9` – nur neue Nutzer sehen sie automatisch (Alwin, 28.10.2026).

### Intern (Musik-App)

- `e2e/blatt-einfuehrung.spec.ts` klickt die Einführung im Liedblatt in allen Größen und im Scroll-Modus durch: Fehlt
  das Ziel eines Schritts, überspringt sie ihn sonst stillschweigend.

### Neu (Protokolle, S7-2b)

- **To-Dos aus einem Protokoll-Entwurf im Fenster ändern** (Alwin 30.10.2026): Text, Löschen und Gruppe gehen jetzt
  auch dort – der Entwurf wird nachgezogen. Text ändert sich mit, Löschen nimmt die Aufgabe heraus, eine andere Gruppe
  macht daraus einen Absatz „… – an „Jugend“ abgegeben“ (das To-Do lebt dort weiter).
- Schreibt gerade jemand am Protokoll, wird nichts gespeichert; das Fenster sagt, wer.

### Intern

- Kein eigener Schreibweg: Sperre nehmen, Dokument per reiner Regel (`shared/protokolle/nachziehen.ts`) ändern, normal
  speichern mit dem Abgleich des Editors, Sperre freigeben – auch nach einem Fehler.

### Intern (alle Apps)

- **Die CI prüft jetzt auch die manuellen Testfälle** (`npm run testplan -- --pruefen`). Der Schritt fehlte: TF-EDIT-14
  kam mit der ungültigen Priorität „mittel“ auf main – lokal rot, in der CI grün. Priorität auf „normal“ gesetzt.

### Behoben (Musik-App)

- **Scroll-Modus: Ganz unten ist das letzte Lied gewählt** (Scheibe B4, 30.10.2026). Gewählt wird das Lied in der
  Bildmitte; ein kurzes letztes Lied (kürzer als eine halbe Bildschirmhöhe) erreichte die Mitte nie – ganz unten
  zeigten Kopf und Ablauf-Leiste das vorletzte Lied. Jetzt gilt am Rand das erste bzw. letzte Lied
  (`seiteInDerMitte`).

### Intern (Musik-App)

- B4 durchgesehen: Ablauf-Leiste folgt im Scroll-Modus und scrollt mit (neuer E2E-Test), Tipp in die Mitte, Pedal,
  Dunkelmodus und Logo unverändert.

### Neu (Protokolle, S7-2a)

- **Fenster „To-Do“** (Alwin 30.10.2026): Ein Tipp auf ein To-Do im Reiter „To-Dos“ öffnet es – Text, Gruppe, Bis,
  Status, Zuständige (auch niemand oder jemand außerhalb der Gruppe), neue Notiz, Verlauf und Löschen (nur vermerkt).
  Gespeichert wird nur, was geändert wurde – hat inzwischen jemand anderes abgehakt, bleibt das.
- **„Auf Karte anzeigen“**: je ein Schalter bei „Notizen“ und „Aus welcher Sitzung“ – dann zeigt die Karte die letzte
  Notiz bzw. die Sitzung (mit Sprung ins Protokoll). Für alle gespeichert.
- **„Neues To-Do“** ohne Protokoll, für Leitung und Mitglieder; ohne Zuständige ist es ein To-Do der Gruppe.
- **Gruppe wechseln** verschiebt das To-Do (neu in der anderen Gruppe, das alte als gelöscht vermerkt).
- To-Dos aus einem **Protokoll-Entwurf**: Text, Gruppe und Löschen ändern sich dort (das Nachziehen aus dem Fenster
  folgt mit S7-2b).

- **Namen statt „Person 1“** (Test-Instanz 30.10.2026): Mitglieder sehen die Mitgliederliste oft nicht und sahen
  deshalb im Fenster, auf der Karte, im Editor und bei „Nach Person“ nur Nummern. Jetzt speichert, wer schreibt, seinen
  Vornamen am Verlauf mit; man selbst ist immer bekannt. Wer nie schrieb: „eine weitere Person“ bzw. „jemand“.

- „Auf Karte anzeigen“ bei „Aus welcher Sitzung“ nur noch, wenn das To-Do aus einer Sitzung stammt. Ist die Sitzung
  älter als die geladene Übersicht, steht „Aus einer älteren Sitzung.“ statt fälschlich „Ohne Sitzung angelegt.“.

### Intern

- Ein Schreibweg für To-Dos aus der Übersicht (`protokolle/src/todoSchreiben.ts`) – auch die Status-Marke nutzt ihn.
- Verschieben legt erst an (nachgelesen), dann wird das alte vermerkt; scheitert das Zweite, steht es doppelt statt
  nirgends, mit Hinweis.
- Ein Ort für den Namen im Verlauf: `mitNamen` in den beiden Schreibtoren (`aufgabenSchreiben`, `aufgabeAendern`),
  angezeigt über `nameFuer`/`nameAusListe`/`weitereZustaendige` – Karte, Fenster, Editor und fester Punkt gleich.

### Neu (Dienstplaner und Musik-App, E6-4 – Alwin, 30.10.2026)

- **Infos je Dienstgruppe** („Technik: Mikro 1“, „Musik: Intro leise“) – in ChurchTools gab es sie schon, die Apps
  zeigten sie nicht. Entwurf `e6-infos-spalten.html`, abgenommen 30.10.2026.
  - **Ansehen am Rechner:** Neben „Bearbeiten“ steht der Knopf **„Spalten“**. Er listet die Dienstgruppen, deren Infos
    man in ChurchTools sieht, mit der Zahl der Punkte, an denen schon etwas steht. Angehakt = eigene Spalte rechts im
    Ablauf, wie im Ablaufplan von ChurchTools. Die Wahl merkt sich das Gerät; ohne Haken bleibt alles wie bisher.
  - **Am Handy:** Die angehakten Gruppen stehen als Zeile „Technik: …“ unter dem Punkt.
  - **Bearbeiten im Punkt-Fenster:** Unter „Bemerkung“ der Abschnitt „Infos je Gruppe“ mit einem Feld je sichtbarer
    Gruppe; leer lassen = keine Info. Gespeichert wird je Gruppe einzeln – die Infos anderer Gruppen bleiben
    unangetastet. Hat jemand dieselbe Info inzwischen geändert, fragt das Fenster wie bei den übrigen Feldern.
  - **In der Matrix keine Infos** (dort ist kein Platz für Spalten je Gruppe).
- **Bekannt:** Bearbeitet jemand einen Punkt in der Ablauf-Ansicht von ChurchTools selbst, löscht ChurchTools alle
  Infos dieses Punkts (gemessen 22.10.2026, gemeldet als Entwurf `docs/churchtools-meldung-gruppen-infos.md`).

### Intern (E6-4)

- `ablaufZeileAus` liefert `infos` (aus `serviceGroupNotes`, dieselbe Auswahl wie beim Mitschreiben); `punktStand`
  vergleicht sie beim Speichern je geänderter Gruppe.
- Schreibkern: `PunktAenderung.infos` (Gruppe → Text, leer = löschen) schreibt je Gruppe über
  `PUT/DELETE …/items/{id}/servicegroups/{gruppe}` (gemessen E6-4-0); nur Infos geändert → der Punkt selbst wird nicht
  geschrieben. Das Server-Schema der Musik-App lässt `infos` durch.
- Welche Gruppen man sieht, steht an EINER Stelle (`infoGruppen`, `dienstgruppenSichtAus` in `shared/ct/dienstRechte.ts`)
  – für den Dienstplaner und für die Rechte der Musik-App (Server und Erweiterung, neues Feld `infoGruppen`).
- Neu `ui/ablauf/InfoSpalten.tsx` (Knopf) und `infoSpaltenWahl.ts` (Wahl, gemerkt über den gemeinsamen Gerätespeicher
  `ui/bedienung/geraet.ts`, dort neu `zahlen` neben `texte`); `AblaufListe` mit
  `infoSpalten`. Demo: Infos an drei Punkten, Schreiben je Gruppe wie gemessen.

### Geändert (Musik-App)

- **Liedblatt-Fußleiste im ChurchTools-Look (Scheibe B3).** Unten stehen jetzt „‹ Zurück“ mit Rahmen, in der Mitte
  „Nächstes Lied: …“ und „Weiter ›“ in Blau – dieselben Knöpfe wie im Kopf. Am Handy nur die beiden Pfeile und
  „Nächstes: …“. Die Punktreihe ist weg: Zu einem Lied springt man über die Ablauf-Leiste oben. Die Seitenangabe bei
  mehrseitigen Liedern bleibt als Schild auf dem Blatt (Alwin, 30.10.2026).

### Intern (alle Apps)

- `KopfKnopf` kann `symbolHinten` (Symbol hinter dem Wort, „Weiter ›“).

### Neu (Anmeldungen, U2-4 – Zeilen anheften)

- **Stecknadel am Zeilenanfang** im Bereich „Anmeldungen“ (je Anmeldung und je Person): heftet eine Zeile oben an. Sie
  bleibt beim Sortieren oben (darunter gilt die Sortierung weiter) und steht nur in den Reitern, in die sie ohnehin
  gehört. Gemerkt nur auf diesem Gerät, je Veranstaltung; was es nicht mehr gibt, fällt beim nächsten Anheften aus dem
  Speicher. Mit Maus erscheint die Nadel beim Darüberfahren, am Handy steht sie immer da; die Nadel-Spalte bleibt links
  stehen, auch am Handy. Bei „Abgesagt“ gibt es keine Nadel.

### Intern (U2-4)

- **Ein Gerätespeicher für die Erweiterungen:** Das Organigramm hatte eine eigene Kopie von „Im Gerät merken“ – es nutzt
  jetzt wie Dienstplaner und Protokolle `ui/bedienung/geraet.ts`, die Anmeldungen ebenso. Test des Bausteins selbst in
  `ui/bedienung/geraet.test.ts`. Die Musik-App behält `lokalSpeicher.ts` (meldet zusätzlich einen vollen Speicher).
- `personSchluessel` (`tabelle.ts`): ein Schlüssel je Personenzeile für Zeile und Nadel.

### Behoben (Protokolle)

- **To-Dos: Hover-Farben nur mit Maus** – drei `:hover`-Regeln aus S7-1 (#795) standen nicht in `@media (hover: hover)`
  (Status-Marke, Aufgabentext, „Ältere erledigte zeigen“). Am Handy wäre die Farbe nach dem Antippen hängen geblieben; der
  Wächter `ui/design/hoverNurMaus.test.ts` (#776) hatte main deshalb rot gemeldet.

### Geändert (Organigramm)

- **Keine Typ-Schildchen mehr über dem Baum** (Dienstbereich, Kleingruppe, Verteiler …). Ein abgewählter Typ ging
  samt allem darunter – seit dem Umbau stehen oben nur Dienstbereiche, also war nach einem Klick alles weg. Was nicht
  zu sehen sein soll, blenden Gruppen-Admins über „Einstellungen“ für alle aus (O7b-7). Ein früher im Gerät
  ausgeblendeter Typ ist wieder zu sehen; der alte Merk-Eintrag wird nicht mehr gelesen.

### Neu (Protokolle, S7-1)

- **Reiter „To-Dos“** (Alwin 30.10.2026, Entwurf `s7-todos-v2.html`): alle To-Dos der eigenen Gruppen in einer Liste,
  **nach Status oder nach Person** eingeteilt (im Gerät gemerkt). Die Leitung sieht alle To-Dos ihrer Gruppen,
  Mitglieder ihre eigenen und die, für die noch niemand zuständig ist. Der Status steht als **Marke mit Zeichen und
  Wort** („◐ In Arbeit“) und schaltet mit einem Tipp weiter – abhaken, ohne ins Protokoll zu springen, auch bei schon
  freigegebenen Protokollen. Filter für Gruppen und Zuständige; Erledigte älter als 30 Tage per Schalter. Ein Tipp auf
  den Text öffnet das Protokoll, aus dem das To-Do stammt.
- **Startseite:** „Alle anzeigen“ an „Meine offenen To-Dos“ öffnet den Reiter.

### Intern

- „Im Gerät merken“ (`leseImGeraet`/`merkeImGeraet`) liegt jetzt in `ui/bedienung/geraet.ts` statt nur im Dienstplaner.
- Ältere Erledigte sind bewusst **kein** Filter: Sonst stünde am Filter-Knopf ab Werk eine „1“.
- Mitglieder sehen die Mitgliederliste oft nicht – bei ihren eigenen To-Dos steht trotzdem ihr Name (beim Prüfen in der
  Test-Instanz gefunden: dort stand „eine weitere Person“).

### Behoben (alle Apps)

- **Am Handy bleibt nach dem Antippen keine Farbe mehr hängen** (Alwin am iPhone, 29.10.2026). Touch-Geräte halten den
  Maus-Zustand auf dem zuletzt angetippten Element fest – in der Liedleiste blieb so das vorher angetippte Lied
  hellblau und sah aus wie gewählt. Hover-Farben gelten jetzt nur noch mit Maus (`@media (hover: hover)`): 71 Regeln
  in 42 Dateien aller Apps (Musik-App, gemeinsame Knöpfe und Fenster, Dienstplaner, Organigramm, Protokolle,
  Anmeldungen, Anmeldeformular).

### Intern (alle Apps)

- Wächter `ui/design/hoverNurMaus.test.ts`: Jede `:hover`-Regel muss in `@media (hover: hover)` stehen.
- Hover- und Home-Strich-Wächter (`homeStrich.test.ts`) holen ihre Ordner jetzt aus `quelltexte.testutil.ts` statt aus
  einer eigenen Liste – der fehlte die App `formular`, eine neue App wäre ebenso ungeprüft geblieben.

### Neu (Anmeldungen, U2-3 – Spalten wählen)

- **Fenster „Spalten“** im Bereich „Anmeldungen“, je Ansicht (je Anmeldung, je Person): Häkchen zeigt eine Spalte,
  Pfeile ordnen, die **Stecknadel** heftet sie links an – mehrere möglich, in der Reihenfolge des Anheftens; am Handy
  bleibt nur die erste stehen. „Wie zu Beginn“ holt die Vorgabe zurück. Je Person stehen auch die Fragen der Anmeldung
  zur Wahl; ihre Summe zählt jede Anmeldung einmal.
- Die Wahl gilt **fürs ganze Team**: neues, freiwilliges Feld `tabelle` in den Einstellungen der Veranstaltung, wie die
  Druckliste (`druck`) – nur, was von der Vorgabe abweicht, und nur von dem, der die Veranstaltung bearbeiten darf.
  Gelöschte Fragen fallen weg (`nurVorhandene`, dieselbe Bereinigung wie die Druckliste), neue stehen hinten. Die Kopie
  einer Veranstaltung übernimmt die Wahl.
- Ohne Wahl angeheftet: der Name, je Person Vor- und Nachname (Entwurf). Der Warteplatz steht im Reiter Warteliste
  gleich hinter den angehefteten Spalten.

### Intern (U2-3)

- `ZeilenKnopf` kann an und aus sein (`an` → `aria-pressed`, blau); neue Symbole `nadel` und `chev-up`.
- Die Spalten der Tabelle kommen aus `spaltenKatalog`/`gezeigteSpalten` (`tabelle.ts`) statt aus festen Listen;
  Geburtsdatum sortiert nach dem Datum.

### Geändert (Dienstplaner, E6-Abschluss – Alwin, 30.10.2026)

- **Termin-Ansicht: „Bearbeiten“ mit Wort.** Über dem Ablauf steht statt des runden Stifts ein grauer Knopf
  **„Bearbeiten“**, im Bearbeiten das blaue **„Fertig“** – wie in der Musik-App und in der Matrix. Der Stift allein war
  leicht zu übersehen.
- **„Musik-App“ öffnet den Ablauf dieses Termins.** Der Knopf über dem Ablauf öffnete bisher nur die Musik-App selbst;
  jetzt springt sie direkt in den Ablauf genau dieses Termins (auch außerhalb ihrer üblichen Wochen).

- **Der Zeitraum-Knopf springt nicht mehr** (Alwin, 30.10.2026): Er hat jetzt eine feste Breite. Vorher wuchs er mit
  seinem Text – wechselte „5 Termine · passend zur Fensterbreite“ zu „6 Termine“, wurde er 39 px schmaler, und ＋ ›
  daneben rutschten beim mehrmaligen Klicken unter dem Finger weg. Gilt auch für die Abwesenheiten der Musik-App
  (derselbe Knopf). Am Handy bleibt er über die volle Breite.

### Geändert (Musik-App)

- Die Musik-App versteht den Direktlink jetzt auch **ohne Punkt** (`#/termin/<ID>`): Dann öffnet sie den Ablauf des
  Termins statt eines Lieds. Gebraucht vom Knopf „Musik-App“ im Dienstplaner.

### Intern

- `shared/ct/musikAppLink.ts`: `punktId` ist optional (`musikAppDirektLink(app, termin, null, tag)`); eine Stelle für
  beide Apps wie bisher. `useAppNav` öffnet ohne Punkt die Ablauf-Ansicht.

### Neu (Anmeldungen, U2-2 – je Person)

- **Umschalter „Je Anmeldung / Je Person“** im Bereich „Anmeldungen“ – je Person eine Zeile mit Vor- und Nachname,
  Status (Platz oder Warteplatz), Alter, jeder Frage der Person, „Angemeldet von“, Anmelde-Nr. und Betrag/Bezahlt der
  Anmeldung. Die Spalten kommen aus dem Katalog der Druckliste (`teilnehmerSpalten`, Zellen über `teilnehmerZelle`).
  Die Reiter zählen dann Personen; ein Klick öffnet die Anmeldung der Person. Bei „Abgesagt“ gibt es keinen Umschalter
  (Absagen sind je Person).
- **Summen je Person** – Personen mit Platz (+ Warteliste), Fragen der Person nach ihrer Art, Alter in den Altersstufen
  der Preise (`altersregel`, dieselbe Regel wie die Rechnung). Betrag und Bezahlt zählen jede Anmeldung **einmal**, auch
  wenn sie bei jeder Person steht.
- Sortieren je Person und je Anmeldung über dieselbe Regel (`ordnen` in `tabelle.ts`).

### Neu (Musik-App)

- **Wann ein Lied zuletzt gesungen wurde, steht jetzt immer da** (Alwin beim Planen, 30.10.2026: „Irgendwie fehlt mir
  die Anzeige, wann das Lied das letzte Mal gesungen wurde“). In der Liederliste und in der Lied-Auswahl beim
  Hinzufügen steht unter jedem Lied grau „zuletzt 12.10.2026“ bzw. „noch nie gesungen“ – in jeder Sortierung, auch
  bei A–Z; bei „Häufigkeit“ mit der Anzahl davor. Oben im Lied-Menü steht „Zuletzt gesungen“. Das Datum zählt über
  alle Termine, nicht nur über den eingestellten Zeitraum. Wie bisher nur mit dem ChurchTools-Recht für die
  Lied-Statistik.

### Geändert (Musik-App)

- Die Statistik in den Liedzeilen ist keine blaue Kapsel mehr (in der Lied-Auswahl stand sie rechts neben der
  Tonart), sondern eine graue Zeile unter Titel und Autor – an beiden Stellen gleich (`liedNotiz`).

### Neu (Musik-App)

- **Lied-Editor: „Nur Text“** (Alwin, 29.10.2026). Vorn in der Werkzeugleiste steht der Umschalter „Akkorde & Text |
  Nur Text“ – dieselben Wörter wie unter „Anzeige“ im Lied-Menü. Bei „Nur Text“ sind die Akkord-Kärtchen und die
  Akkord-Leiste weg; man bearbeitet nur Text und Zeilenumbrüche. Die Akkorde bleiben im Lied: Eine einzelne
  Rücktaste neben einem unsichtbaren Akkord löscht den Buchstaben, nicht den Akkord. Wer ein Wort samt Akkord
  markiert und löscht, löscht den Akkord mit (so entschieden). Leerzeichen und Akkorde am Zeilenende – SongSelect
  richtet Akkorde mit Leerzeichen aus – sind ganz unsichtbar; am iPhone brachen sie sonst in eine leere zweite Zeile
  um (Alwin, 30.10.2026: „Warum ist da jetzt so ein Abstand?“).

### Geändert (Musik-App)

- Die Knöpfe im Editor (Abbrechen, Speichern, Löschen, Einfügen, ChordPro-Text, Rückgängig) sind so hoch wie überall
  (`--knopf-hoehe`); vorher standen 34er- und 36er-Knöpfe in einer Reihe.

### Behoben (Protokolle)

- **Griff im Editor auf einer Höhe mit dem „+“** (Alwin 29.10.2026: „sitzt zu hoch“): Der Griff (⠿) neben Absätzen und
  Tagesordnungspunkten stand 2 px über dem „+“ und damit über der Zeilenmitte – er steckte in einem Inline-Element und
  stand auf dessen Grundlinie. In Safari und Chrome nachgemessen; jetzt sitzen beide auf der Mitte der ersten Zeile.

### Geändert (Musik-App)

- **Lied-Menü als Fenster in der Mitte, mit Unterseiten** (Alwin am iPhone, 29.10.2026). Vorher klappte es unter dem
  gewählten Lied der Leiste auf und stand je nach Lied an einer anderen Stelle. Jetzt öffnet es wie alle
  ChurchTools-Fenster in der Mitte. Die Übersicht hat die Gruppen **Tonart** (Transponieren · Kapo · Abschnitte ›),
  **Anzeige** (Akkorde & Text · Nur Text · PDF ›), **Version** (die gewählte Fassung ›), **Bearbeiten** („Im Editor
  öffnen“ direkt, rechts „als neue Version“ oder der Name der Version · Dateien · Stammdaten ›) und **Teilen** („Als
  PDF teilen“). Seltenes liegt eine Ebene tiefer, „‹“ führt zurück. Eine Unterseite mit nur einem Punkt entfällt; der
  Punkt steht dann direkt in der Übersicht (etwa „Kapo“, wenn ein PDF gezeigt wird).

### Intern (alle Apps)

- `Sheet` kann `zurueck`: „‹“ vor dem Titel für Unterseiten eines Fensters.
- Die Messung der Lied-Mitte (`--liedmenue-x`) und die Stile des alten Aufklappmenüs sind entfernt.

### Behoben (Musik-App)

- **Lied-Editor: Der Kopf steht unter dem Band, nicht mehr unter der Uhr** (Alwin am iPhone, 29.10.2026: „das
  Fenster ist zu hoch“). In der installierten App lagen Abbrechen, Titel und Speichern direkt unter der Uhr im
  Unschärfe-Band von iOS und wirkten weich. Jetzt beginnt der Kopf wie jeder andere unter dem Band. Er war der letzte
  mit der alten Regel; ein Messkasten am Gerät zeigte, dass sonst nichts verschoben war.

### Intern (Musik-App)

- Das Tempo-Menü rechnet seine größte Höhe mit der gemessenen Unterkante des Kopfs statt mit einem Nachbau der alten
  Regel (Safe-Area oder 20px + 78px).
- Wächter `ui/design/obenBand.test.ts`: Niemand außer `_variables.scss` (und der Messung in `main.tsx`) rechnet selbst
  aus der Safe-Area oben.

### Neu (Organigramm, O7b-7, #736)

- **Was das Organigramm für alle zeigt:** Gruppen-Admins blenden unter **„Einstellungen“** Gruppentypen und einzelne
  Gruppen für alle aus – im Reiter, in der Präsentation und in der PDF; eine ausgeblendete Gruppe nimmt ihre
  Untergruppen mit (Entwurf `o7b-6-7-v1.html`, entschieden 29.10.2026). Über dem Baum steht dann „Für alle
  ausgeblendet: …“; die Typ-Schildchen je Gerät bleiben zusätzlich. Gespeichert im Speicher der Erweiterung (Kategorie
  „Was das Organigramm zeigt“, Kürzel `sichtbar`) mit Version und Konfliktschutz; Lesen müssen es alle dürfen, ändern
  nur Gruppen-Admins (Rechte der Kategorie). In ChurchTools ändert sich nichts.

### Intern (Organigramm)

- Anschluss, Modulsuche und das Lesen eines Dokuments aus einer Kategorie stehen jetzt an einer Stelle
  (`organigramm/src/speicher.ts`) für Plan und Einstellung; die Fehlertexte beim Speichern ebenso (`planFehlerText`).
- `baumOhneTypen` blendet auch einzelne Gruppen aus – EIN Filter für Schildchen und Einstellung.

### Neu (Protokolle, K2b-Folgepunkte)

- **„Bearbeiten“ auch im Editor** (Alwin 29.10.2026): Ein Protokoll im Entwurf hat oben denselben Knopf wie die
  Sitzungsansicht – Zeit, Titel, Eingeladene der eigenen Sitzung ändern oder sie absagen. Danach zeigt der Kopf des
  Editors gleich den neuen Stand; der Text im Editor bleibt, wie er ist.

### Behoben

- Sitzungen mehr als 180 Tage voraus kamen ohne Einladungen und Zusagen in den Kasten „Nächste Sitzung“ und auf die
  Startseite – die Liste fragt den Kalender nur so weit. Für geplante und begonnene Protokolle mit Termin dahinter liest
  sie Termin und Einladungen jetzt gezielt nach (bemerkt beim Prüfen von K2b).

### Intern

- Termin und Besprechungsanfragen werden an einer Stelle gelesen (`protokolle/src/termin.ts`) – vorher las die Liste,
  das Festlegen und das Bearbeiten sie je selbst. Die Zeit einer Sitzung aus dem Termin (bei Serien: Beginn der Sitzung,
  Dauer vom Termin) ist `zeitAusTermin`. Der Test-Nachbau beachtet jetzt den gefragten Zeitraum des Kalenders.

### Intern (Musik-App)

- **Wackelnder E2E „Schreibansicht am Handy“ stabil.** Die Editor-Tests setzten den Cursor per Klick auf die halbe
  Höhe einer Zeile, gemessen, bevor die Schrift Lato geladen war. Mit der Ersatzschrift bricht die Zeile am Handy um
  (62 statt 31 px); kam die Schrift zwischen Messen und Klicken, lag am Klickpunkt die nächste Zeile, und Playwright
  versuchte es bis zum Timeout – unter Last gelegentlich, auch auf main. Die Klick-Folge stand viermal kopiert in den
  Editor-Tests; jetzt einmal als `cursorInZeile` in `e2e/werkzeug.ts`: erst auf die Schrift warten, dann in die erste
  Bildschirmzeile klicken. Neuer Test hält die Schrift gezielt zurück (alter Klick-Weg: rot, neuer: grün).

### Geändert (Anmeldungen, U2-1 – Tabelle)

- **Die Liste ist eine Tabelle** (Entwurf `u2-tabelle-v1`, abgenommen 29.10.2026) – eine Zeile je Anmeldung mit Name,
  Nr., Personen, jeder Frage der Anmeldung als Spalte, Betrag, Bezahlt und Anmeldetag. Kopf und Summenzeile bleiben beim
  Scrollen stehen, der Name links. Ein Tipp auf eine Überschrift sortiert (auf, ab, zurück zum Anmeldetag). Die
  Summenzeile zählt Anmeldungen, Personen mit Platz, Beträge (gesamt, offen, eingegangen – wie die Kacheln) und jede Frage
  nach ihrer Art (Zahl: Summe, Ja/Nein: Anzahl Ja, Auswahl: je Antwort, Text: ausgefüllt). Die Fragen kommen aus
  demselben Katalog wie die Spalten der Druckliste (`fragen`, `frageAntwort` in `druckliste.ts`), gerechnet wird in
  `shared/anmeldung/tabelle.ts`.
- **Reiter statt Filter-Chips**, mit der Zahl ihrer Zeilen; die Warteliste zeigt Anmeldungen mit Spalte „Warteplatz“,
  „Abgesagt“ eine Tabelle der Absagen (mit „Zurückholen“, wer ändern darf). `ReiterLeiste` kann dafür eine Anzahl
  hinter dem Text und einen eigenen Namen für Vorleser.
- **Leiste im ChurchTools-Stil** – eckige Suche (Name oder Nr.) in Knopfhöhe; Druckliste und Rundmail mit
  Linien-Symbol (neu in `ui/icons`: `drucker`, `brief`), am Handy nur das Symbol, damit „＋ Von Hand“ nicht mehr
  umbricht (Fund U1). ⎙ und ✉ stehen jetzt auf der Liste der Behelfszeichen.
- **Nach der echten Prüfung:** Spaltenüberschriften höchstens zwei Zeilen (die ganze Frage beim Darüberfahren) – der
  Prüfstand war 3.279 px breit; die Reiterleiste oben lässt sich wischen, wenn sie nicht passt (am Handy war
  „Abgesagt“ abgeschnitten).
- **„Platz frei – jemand wartet“ nur noch zweimal** – in der Kachel „Warteliste“ und im Reiter „Warteliste“ (mit
  „… nachrücken lassen“). Über der Liste und in der Nachprüfung fällt er weg; die Nachprüfung zählt ihn nicht mehr als
  Hinweis.

### Geändert (Dienstplaner – Durchklicken Alwin, 29.10.2026)

- **Nur noch zwei Spaltenbreiten, als Symbole:** Statt „S | M | L“ stehen oben zwei Symbole – **schmal** (vier Spalten
  im Rahmen, 176 px wie bisher M) und **breit** (zwei Spalten, 256 px wie bisher L). Beim Zeigen steht der Name dabei.
  S fällt weg: Dort waren die Titel im Ablauf abgeschnitten. Ein gemerktes S oder M wird „schmal“, L wird „breit“.
  Entwurf `e6-6-breiten-plus.html`.
- **Das grüne Plus in der Zeile „Ablauf“ ist kleiner:** 26 px statt voller Knopfhöhe – so groß wie Zauberstab und Regler
  der Dienstgruppen. Vorher füllte es die Zeile ganz aus („zu groß und nicht schön“).

### Intern (Spaltenbreite/Plus)

- `SPALTENBREITE` heißt jetzt `{ schmal, breit }`; `leseAnsicht` übernimmt gemerkte S/M/L-Werte.
- `Segment`: Optionen können einen `name` tragen (Screenreader und Tooltip) – für Optionen, die nur ein Symbol zeigen.
- `KopfKnopf` kann `klein` (nur Symbol, 26 px); `HinzufuegenMenue` reicht es durch (statt `nurSymbol`).
- Neue Symbole `spalten-schmal` und `spalten-breit`.

### Neu (Organigramm, O7b-8, #736)

- **Farbe in Diagrammen und Liste:** Vor jedem Gruppennamen steht die Kachel der Gruppe – Anfangsbuchstabe auf ihrer
  Farbe, wie in der Gruppenliste von ChurchTools (Wunsch Alwin 29.10.2026: „bunter … an den Gruppenansichten
  orientieren“; Entwurf `o7b-8-farbe-v1.html`, Variante „Kachel“). Gilt für Von oben, Von links, Mindmap, Liste, die
  Diagramme der Präsentation und die PDF. Die Farbe kommt wie bei den Karten aus der Gruppe, sonst aus ihrem Typ.

### Behoben (Organigramm)

- In der PDF saßen alle mittig gesetzten Texte im Diagramm (Namen, Rollen, Personen) zu hoch: Das Blatt wurde zum
  Messen der Grundlinie auf etwa 1 px verkleinert, der Browser rundete den Versatz dabei auf 0 (seit O7b-4; aufgefallen
  neben der Kachel). Gemessen wird jetzt am groß gezeichneten Blatt.

### Intern

- Die PDF übernimmt Rundungen, die per Stil kommen (`rx: var(--r-tile)`), damit die Kachel auch auf Papier rund ist
  und die Rundung nur an einer Stelle steht.

### Neu (Protokolle, K2b-2)

- **Serientermine bearbeiten und absagen** (Alwin 29.10.2026): Bei einer Sitzung aus einer Terminserie gelten
  Einladungen für die ganze Serie. Titel oder Zeit fragt **„Nur diese Sitzung“** (wird aus der Serie gelöst) oder
  **„Ab dieser Sitzung“** (die Serie wird hier geteilt, frühere Termine bleiben; spätere Protokolle und Gruppentreffen
  ziehen mit; am ersten Termin ändert sich die ganze Serie). Der neue Termin bekommt alle Eingeladenen neu – das Fenster
  sagt die Mails „Neue Besprechungsanfrage“ vorher an (gemessen 29.10.2026, `messung-k2b2-2026-10-29.md`).
- **Absagen bei Serien:** „Nur diese Sitzung“ und „Serie ab hier beenden“ ohne Mail, „Ganze Serie löschen“ mit Mail
  „Terminserie gelöscht“ und der Zahl der kommenden Termine. Gruppentreffen vergangener Termine bleiben.
- Das Fenster zeigt bei einer Serie die Zeit **dieser** Sitzung, nicht die des ersten Termins.

### Intern

- Geteilt wird ohne Einladungsliste und danach einzeln eingeladen – mit Liste mailt ChurchTools „Wöchentlicher Termin
  … bis <altes Ende> wurde geändert“, auch für einen einzelnen herausgelösten Termin.
- Ein zweiter Versuch legt keinen zweiten Termin an: Gehört der Tag nicht mehr zur Serie, sagt das Fenster es.
- Bleibt von einer Serie nur ein Termin übrig, macht ChurchTools daraus einen Einzeltermin. Die Erweiterung erkennt das
  (beim Prüfen in der Test-Instanz gefunden: „Serie ab hier beenden“ galt sonst als „nicht übernommen“, und ein zweiter
  Versuch hätte den übrigen Termin gelöscht). „Nur diese“ / „ab hier“ löschen nie.
- `docs/betrieb/PROTOKOLLE.md` beschreibt jetzt „Sitzung bearbeiten“ (K2b-1 und K2b-2).

### Neu (Protokolle, K2b-1)

- **Sitzung bearbeiten** (Alwin 29.10.2026): Die Leitung ändert eine Sitzung über „Bearbeiten“ in der Sitzungsansicht
  oder „Ändern“ im Kasten „Nächste Sitzung“ – Titel, Datum, Uhrzeit, Dauer und wer eingeladen ist. Termin,
  Gruppentreffen und Protokoll ziehen mit. Das Fenster sagt vor dem Speichern, wer welche Mail bekommt (gemessen
  29.10.2026, `messung-k2b-2026-10-29.md`):
  - neue Zeit: **„Alle neu einladen“** (vorgewählt) – ChurchTools schickt „Termin geändert“ und setzt die Zusagen
    zurück; abgewählt wird still verschoben, die Zusagen bleiben;
  - nur der Titel: still; einladen: „Neue Besprechungsanfrage“; ausladen: „Termin gelöscht“ an die Person.
- **Sitzung absagen**: Termin und Gruppentreffen werden gelöscht (Mail „Termin gelöscht“ an die Eingeladenen); ein nur
  geplantes Protokoll verschwindet, ein begonnenes bleibt als Entwurf ohne Termin.
- Serientermine und Termine mit Anmeldung ändert das Fenster noch nicht – es sagt das (Serien folgen mit K2b-2).
- Das Fenster liest Zeit, Dauer und Eingeladene beim Öffnen frisch vom Termin – auch für Sitzungen mehr als 180 Tage
  voraus (die Liste liest nur so weit) und wenn inzwischen jemand zugesagt hat.

### Intern

- Ein Termin-`PUT` leert, was fehlt (Beschreibung, Ort, Link; beim Gruppentreffen der Kommentar) – der gelesene Termin
  geht unverändert zurück, nur Titel und Zeit sind neu (Rundreise gemessen).
- Titel/Datum/Uhrzeit/Dauer und die Einladeliste als ein Baustein `Planungsfelder` für „Neue Sitzung“, „Neues
  Protokoll“ und „Sitzung bearbeiten“; `abgelehnt` aus `planen.ts` gemeinsam genutzt.

### Geändert (Dienstplaner, E6-6c – Durchklicken Alwin, 29.10.2026)

- **Neuer Punkt in der Matrix ohne Blatt von unten:** Im Bearbeiten steht je Termin ein grünes **„+“** neben „N Punkte“
  in der Gruppenzeile „Ablauf“. Es klappt direkt darunter ein kleines Menü auf („Programmpunkt hinzufügen“, „Überschrift
  hinzufügen“) – wie „+ Eintrag hinzufügen“ in der Musik-App. Vorher stand „+ Punkt“ unter jedem Ablauf und öffnete auch
  am Rechner das Blatt „Option wählen“ über die ganze Breite unten am Bildschirm. Der neue Punkt landet wie in
  ChurchTools am Ende. Bei einem abgeschlossenen Ablauf steht statt des Plus das Schloss. Entwurf
  `e6-6-neuer-punkt.html` Variante A.
- **„Ablauf bearbeiten“ mit Wort, oben in der Leiste:** Statt des kleinen Stifts links neben „Ablauf“ steht oben neben
  S/M/L und Filter ein grauer Knopf **„Ablauf bearbeiten“** wie in der Musik-App; im Bearbeiten wird er zum blauen
  „Fertig“. Neben „Ablauf“ passte ein Knopf mit Wort nicht in die erste Spalte (178 px) – Alwin wollte lieber die Leiste
  als eine breitere Spalte. Er gilt weiter für alle gezeigten Termine, so bleibt das Ziehen zwischen Terminen. Am Handy
  bleibt alles, wie es ist.

### Intern (E6-6c)

- `useAblaufBearbeiten`: Mit `plusImKopf` liefert auch die schmale Form (`schmal`) ihren `kopfKnopf` – nur als Symbol,
  mit `plusName` als Namen („Eintrag hinzufügen – Gottesdienst, So, 01.11.“). Die Matrix stellt ihn per Portal an seinen
  Platz in der Gruppenzeile; Optionen, Sperr-Hinweis und Punkt-Fenster bleiben an EINER Stelle in der Liste. Das „+ Punkt“
  am Listenende ist entfernt (in der Matrix ist die schmale Form nie am Handy).
- `HinzufuegenMenue` kann `nurSymbol` und `title`. Den Leisten-Knopf liefert `AblaufBearbeitenKnopf` aus
  `MatrixAblauf.tsx` – dort steht auch die Regel, wer bearbeiten darf.

### Neu (Organigramm, O7b-6b, #736)

- **Personen in der Präsentation:** In den Diagrammen (Von oben, Von links, Mindmap) oben **Personen: Aus · Rollen ·
  Alle** – dieselbe gemerkte Wahl wie im Reiter, hier geändert gilt sie auch dort. Neue Gruppen der neuen Gliederung
  zeigen nur den Namen.
- **Personen im PDF:** Häkchen **Personen** im PDF-Fenster (Alwin, 29.10.2026). Angehakt, wenn der Reiter Personen
  zeigt, und mit dessen Stufe – steht der Reiter auf „Aus“, die Rollen. Im Diagramm wie am Bildschirm; in der Liste
  stehen die Rollen etwas eingerückt unter dem Gruppennamen, und kein Gruppenname bleibt allein unten auf einer Seite.

### Behoben (Organigramm)

- Personen-Zeilen brachen eine Zeile zu früh um, wenn der letzte Name gerade noch passte: Gemessen wurde ein Komma, das
  nach dem letzten Namen gar nicht steht.

### Intern (Organigramm)

- Umbruch und Kürzen der Namen an einer Stelle (`umbruch.ts`) für Kästchen und PDF-Liste; „was unter dem Namen steht“
  an einer Stelle (`personenInhalt`) für Reiter, Präsentation und PDF; wo ein Name in der PDF-Liste steht (`namenX`)
  ebenso.

### Neu (Dienstplaner, E6-6b)

- **Punkte zwischen Terminen ziehen:** In der Planen-Matrix lässt sich im Bearbeiten (Stift in der Gruppe „Ablauf“) ein
  Punkt am Griff in einen anderen Termin ziehen. Eine gestrichelte Stelle „hier ablegen“ zeigt, wo er landet – am
  Beginn-Balken davor (dann läuft er im Vorlauf) oder dahinter. Beim Loslassen fragt die Matrix „„Begrüßung“
  verschieben? Vom So, 01.11. zum So, 08.11. – nach „Way Maker““ mit **Abbrechen / Kopieren / Verschieben**. Entwurf
  `e6-6-entwurf-2.html` Bild 3, abgenommen von Alwin am 28.10.2026.
- **Rückgängig** wie beim Löschen (Alwin, 29.10.2026): Verschieben legt den Punkt im alten Termin an der alten Stelle
  wieder an (samt Vorlauf und „weggelassen“) und löscht ihn im neuen; Kopieren löscht die Kopie.
- **Wohin nicht:** in Termine **ohne Ablauf** (Alwin, 29.10.2026: erst „+ Ablauf anlegen“, dann hineinziehen), in
  abgeschlossene Abläufe, aus abgeschlossenen heraus und zwischen zwei Terminen, die sich **einen** Ablauf teilen. Dort
  erscheint keine Stelle; beim Loslassen sagt ein Hinweis, warum.
- Ein im alten Termin weggelassener Punkt steht im neuen sichtbar – „weggelassen“ gilt je Termin (gemessen E6-6-0).
- Am Handy bleibt das Ziehen innerhalb des Termins (der Handy-Plan zeigt nur einen).

### Geändert (Dienstplaner – Durchklicken Alwin, 29.10.2026)

- **Deutlichere Trennung zwischen Ablauf und Diensten** in der Matrix (Entwurf `e6-6-trennung.html`, Variante C): Unter
  jedem Ablauf steht ein grauer Balken **„Ende“** mit der Uhrzeit, zu der der letzte Punkt aufhört (Beginn + Dauer aus
  ChurchTools; ChurchTools zeigt diese Zeit selbst nicht an) – auch im Bearbeiten, damit nichts springt. Darunter teilt
  ein Streifen in der Seitenfarbe die Tabelle, darüber leise **„Dienste“**. Vorher folgte auf den letzten Punkt sofort
  „Programm“, und man sah nicht, wo der Ablauf endet (Alwin). Termin-Ansicht und Musik-App bleiben, wie sie sind.

### Intern (E6-6b)

- Neu `shared/ct/punktUebertragen.ts`: verschieben/kopieren über den Schreibkern – Merkzettel wie beim Löschen
  (`merkzettelAus`, jetzt eine Stelle für `punktLoeschen` und das Übertragen) → im Ziel anlegen und nachlesen
  (`punktWiederherstellen`, liefert jetzt die neue ID) → **erst dann** im alten Termin löschen. Abgeschlossen und
  geteilt werden vor dem ersten Schreiben geprüft; scheitert nur das Löschen, sagt die Meldung, dass der Punkt doppelt
  steht. „Rückgängig“ in derselben Reihenfolge (erst zurückholen, dann im Ziel löschen). Geteilt erkennt
  `teilenAblauf` (Ablauf-ID oder `verbundeneTermine`, dieselbe Regel wie „Neu aufsetzen“).
- Neu `ui/ablauf/AblaufZiehBereich.tsx` + `ablaufZiehen.ts`: EIN Zieh-Bereich für alle Spalten der Matrix; jede
  Bearbeiten-Liste meldet sich mit `useAblaufBearbeiten({ ziehen })` an (Zieh-IDs Spalte + Punkt, sonst wären sie bei
  geteiltem Ablauf doppelt). Wo der Punkt landet, rechnet `platzIn`. Ohne Bereich (Musik-App, Termin-Ansicht, Handy)
  zieht jede Liste wie bisher für sich.
- Neu `ui/fenster/BodyPortal.tsx`: an `body` hängen **mit** dem Bereichs-Attribut – ohne es fehlten dort in der
  Erweiterung die Farben (das Zieh-Bild war beim Durchklicken durchsichtig). Frage und Zieh-Bild stehen so außerhalb der
  Tabelle; den versteckten Screenreader-Text von dnd-kit hängt der Bereich ebenfalls an `body` (sonst ein `div` in
  `tbody`).
- Der Sperr-Hinweis des Dienstplaners (`GESPERRT`) steht jetzt in `ablaufAktionen.ts` – eine Stelle für die
  Bearbeiten-Liste und das Ziehen.
- Demo (`?demo`): Termin 103 hat einen Ablauf (zum Ziehen zwischen zwei Terminen), alle Termine nennen ihren Kalender
  wie in ChurchTools (vorher scheiterte „Ablauf anlegen“ in der Matrix-Demo mit „Kalender unbekannt“).

### Geändert (Musik-App, Liedblatt)

- **Kopf im Lied bis an den oberen Rand:** Statt einer kleinen Karte, die im dunklen Rand schwebte, reicht die Fläche
  jetzt bis an den oberen Bildschirmrand (in der installierten App unter die Uhr, in ChurchTools bis an die Leiste).
  Am Handy sind Liedtitel und Knöpfe größer; quer bleibt der Kopf schmal, damit das Blatt Platz hat.

### Neu (Organigramm, O7b-6a, #736)

- **Personen im Diagramm und in der Liste:** rechts neben den Gruppentypen **Personen: Aus · Rollen · Alle**. Unter dem
  Namen einer Gruppe stehen ihre Rollen genau wie in ChurchTools mit den Personen – Leitung zuerst, dann wie ChurchTools
  sortiert, die Standardrolle (Mitarbeiter/Teilnehmer) zuletzt, bei „Rollen“ als Zahl („6 Mitarbeiter“), bei „Alle“ mit
  Namen (Wunsch Alwin 28.10.2026: „nichts weglassen oder hinzufügen“; Entwurf `o7b-6-7-v1.html`, entschieden
  29.10.2026). Ohne Leserecht steht „Mitglieder nicht sichtbar“ wie in der Präsentation. Vorgabe „Aus“, die Wahl merkt
  sich das Gerät. Präsentation und PDF folgen in O7b-6b.
- Die drei Diagramme ordnen dafür **Kästchen unterschiedlicher Höhe** an: von oben beginnt das Gestapelte unter dem
  hohen Kästchen, zur Seite (von links, Mindmap) schiebt ein hohes Kästchen die nächste Zeile weiter. Die Linien treffen
  immer die Zeile mit dem Namen.

### Geändert (Musik-App, Lieder)

- **„Neues Lied“ wie jedes Anlegen:** Am iPad und Rechner steht oben rechts der grüne Knopf **„+ Neues Lied“**, am Handy
  das runde **Plus** unten rechts – wie „Zeitraum eintragen“ bei den Abwesenheiten und „Eintrag hinzufügen“ im
  Ablauf. Der blaue Text-Link über der Liste ist weg. Beides baut jetzt ein gemeinsamer Baustein.

### Behoben (Anmeldungen)

- **„Zahlung offen“ auf der Startseite zählt wie Liste und Kennzahlen** – bisher zählte die Startseite jede aktive
  Person ohne Haken „bezahlt“, auch ohne Betrag; Liste und Kacheln zählen Anmeldungen mit offenem Betrag. Beim TEST
  Lobpreisabend stand so „5 Zahlungen offen“ neben „0,00 €“ (Fund der echten Prüfung von U1, 29.10.2026). `belegungAus`
  geht jetzt durch dieselbe Kette wie die Liste (`mitgliederstandAus` → `anmeldungenAus` → `listenZahlen`), aus den
  Mitgliedern, die die Startseite ohnehin lädt – keine Abfrage mehr. Getestet gegen die Daten, aus denen die Liste
  rechnet. Bekannte Lücke: Hat die erste Person einer Anmeldung abgesagt, fehlt deren Zahlung auf der Startseite (sie
  steht nur im Verlauf).

### Behoben (alle Apps, iPhone)

- **Unten saß alles mal zu tief, mal zu hoch:** In der installierten App meldet iOS die Fensterhöhe je nach Start
  verschieden (gemessen am Gerät, iOS 18.7: mal mit, mal ohne die Höhe der Statusleiste). Die App ragte dadurch mal
  34 pt unter die Bildschirmkante, mal blieb unten ein leerer Streifen. Jetzt richtet sie sich nach der Größe des
  Bildschirms selbst. Die Reiterleiste sieht aus wie vorher, die **Fußleiste im Lied** (Pfeile, „Nächstes Lied“)
  steht wieder deutlich über dem Home-Strich.
- **ChurchTools-App vom Home-Bildschirm:** iOS meldet dort keinen Home-Strich, obwohl er über dem Inhalt liegt. Die
  Apps messen das jetzt selbst – Reiterleiste, Fußleiste, Plus und Meldungen unten halten Abstand zum Strich.
- **Das runde Plus steht überall gleich:** wie in der ChurchTools-App 16 pt vom rechten Rand und 16 pt über der
  Reiterleiste bzw. über dem Home-Strich – vorher in den Abwesenheiten zu hoch, im Ablauf zu tief.

### Neu (Protokolle, K2a)

- **Neues Protokoll ohne Termin** (Alwin 29.10.2026): Knopf „Neues Protokoll“ auf der Startseite (bei „Nächste
  Sitzungen“) und im Reiter „Sitzungen“ – für alle, die in einer Gruppe schreiben dürfen. Im Fenster wählt man die
  Gruppe (nur die, in denen man schreiben darf), Titel, Datum und Uhrzeit (vorbelegt wie „Neue Sitzung“; auch
  nachträglich möglich) und Vorlage / „Wie letztes Mal“ / leer. Auf Wunsch wird ein **Gruppentreffen** für die
  Anwesenheit mit angelegt. Kein Kalendertermin, keine Mail; danach öffnet sich das Protokoll gleich im Editor.

### Geändert (Protokolle)

- „Neue Sitzung“ und „Neues Protokoll“ im Reiter „Sitzungen“ sind die gemeinsamen grünen Knöpfe der Apps (`KopfKnopf`,
  wie „+ Gruppe erstellen“ in ChurchTools) statt eines eigenen kleineren Knopfs.

### Behoben (Protokolle)

- „Wie letztes Mal“ war nicht vorbelegt, wenn die Vorlagen schneller geladen waren als die Protokolle der Gruppe – dann
  stand die erste Vorlage fest. Die Vorbelegung folgt jetzt dem aktuellen Stand (eine Wahl für „Protokoll beginnen“
  und „Neues Protokoll“, `useAnfangWahl`).

### Intern

- Felder der Protokoll-Fenster an einer Stelle (`Fensterfelder.module.scss`); `planungFehler` kennt `zukunft: false`.

### Geändert (Anmeldungen, U1 – Seitengerüst)

- **Zwei Bereiche statt drei Reiter** – „Vorbereiten“ (Termin, Anmeldung, „Wer meldet sich an?“, Formular, Preise,
  Bezahlung, Mails, Datenschutz, nach der Freigabe der Anmeldelink) und „Anmeldungen“. Ohne Angabe in der Adresse öffnet
  ein Entwurf „Vorbereiten“, eine freigegebene Veranstaltung „Anmeldungen“ (Alwin, 28.10.2026, Entwurf `ux-umbau-v1`).
  Der Baukasten öffnet sich über die Karte „Formular“; „‹ Zurück“ oder der Reiter „Vorbereiten“ führen zurück.
- **Einstieg je nach Stand** (Variante D) – vor der Freigabe eine Schrittleiste mit dem nächsten Schritt und einem
  Knopf dafür (Termin, Anmeldebeginn, Bankverbindung, Freigeben); danach Kennzahlen (Plätze, Warteliste, Zahlung offen,
  Anmeldeschluss), ein Klick öffnet die passende Ansicht der Liste. Hervorgehoben nur die Warteliste, wenn trotz freiem
  Platz jemand wartet. Die Zahlen standen vorher oben im Reiter „Anmeldungen“ – gezählt wird weiter mit `listenZahlen`.
- **Einheitliche Knöpfe** – die eigenen Knopfarten der Erweiterung sind durch die gemeinsamen aus `ui/` ersetzt
  (`FensterKnopf`/`FensterLink`, `KopfKnopf`, `ZeilenKnopf`); eine Dauerprüfung (`ui/design/knoepfeAnmeldungen.test.ts`)
  meldet jede neue eigene Knopfart. Die Nachprüfung ohne Hinweise steht jetzt unten bei den Anmeldungen.

### Neu (Organigramm, O7b-5, #736)

- **Präsentation mit Ansichten:** oben **Kacheln · Von oben · Von links · Mindmap**. Die Seiten bleiben dieselben
  (Übersicht, dann Bereich für Bereich – Alwin: „Seiten bleiben“), der Umschalter ändert nur die Darstellung: Kacheln
  und Personen-Spalten wie bisher, oder die Seite als Diagramm – auf der Übersicht die ganze Gemeinde, auf einer
  Bereichs-Seite der Bereich, anfangs ganz aufgeklappt. Im Diagramm der Übersicht öffnet ein Klick auf einen Bereich
  seine Seite. Die gewählte Ansicht merkt sich das Gerät.

### Behoben (Organigramm)

- **„Ganz zeigen“** lässt unten den Streifen der Knöpfe frei – vorher lagen − / + / „Ganz zeigen“ über dem untersten
  Kästchen (Reiter und Präsentation; gemeldet von Alwin 28.10.2026). Gilt auch für die Startansicht.
- Die Leertaste auf einem +/− im Diagramm der Präsentation klappt nur und blättert nicht zusätzlich weiter.
- „Neue Gliederung | Heute“ in der Präsentation steht auf einer Schiene wie die übrigen Umschalter: 38 px hoch,
  einzeilig – am iPad quer (1024 px) war es zweizeilig und 41 px hoch. Ebenso „Plan | Umbau“ im Reiter „Neue Gliederung“.
  Eine Dauerprüfung (`ui/design/umschalterVerbunden.test.ts`) hält fest, dass jeder Umschalter des Organigramms so gebaut ist.

- Reiter „Neue Gliederung“: **„Neuer Bereich“** (grün wie „+ Gruppe erstellen“ in ChurchTools) und **„Plan verwerfen“**
  sind wieder richtige Knöpfe, so hoch wie der Umschalter daneben. „Neuer Bereich“ zeigte seit O7b-3 auf eine
  gestrichene Stilklasse und stand als bloßer Text da; „Plan verwerfen“ war 31 statt 38 px hoch.

### Intern (Organigramm)

- Dauerprüfung `ui/design/stilKlassen.test.ts`: Jede benutzte Klasse einer `*.module.scss` muss es dort geben (für alle
  Apps; einziger Fund war der oben).

- Die Namen der Ansichten stehen an einer Stelle (`ANSICHT_NAMEN` in `auswahl.ts`) statt je einer Liste in Reiter
  und PDF-Fenster.

### Behoben (Protokolle, K1 – beim Durchklicken 28.10.2026 gefunden)

- **Datum am Termin:** Das Feld zum Wählen öffnete nach links und wurde am Rand des Blatts abgeschnitten – jetzt öffnet
  es nach rechts unter dem Datum.
- **Griff sitzt auf der Zeile:** Der Griff zum Ziehen stand an der Oberkante des Blocks, je nach Art 6 bis 9 px über der
  ersten Textzeile, und sah aus wie der der Zeile darüber. Jetzt steht er mittig neben der ersten Zeile – bei
  Tagesordnungspunkten, To-Dos, Beschlüssen, Terminen und festen Punkten.
- **Ziehen landet, wo die Linie steht:** Beim Ziehen eines Tagesordnungspunkts zeigte der Editor seine Linie zwischen
  zwei beliebigen Zeilen, abgelegt wurde aber an der nächsten Abschnittsgrenze. Jetzt steht die Linie genau dort, wo
  der Punkt landet; über dem eigenen Abschnitt erscheint keine (dort bewegt sich nichts).

### Geändert (Protokolle)

- **Wer und Bis vor dem Text:** An einem neuen To-Do lassen sich „Wer?“ und „Bis“ wählen, bevor Text dasteht. Die Wahl
  wird am Block gemerkt und übernommen, sobald das To-Do mit dem ersten Text entsteht – es gibt kein leeres To-Do bei
  den Zuständigen. Den Status gibt es weiter erst mit Text.

### Neu (Dienstplaner, E6-6a)

- **Der Ablauf in der Planen-Matrix:** Oben, über den Dienstgruppen, steht die Gruppe „Ablauf“ – je Termin „N Punkte“
  bzw. „kein Ablauf“, darunter der Ablauf in einer schmalen Form (Uhrzeit, Dauer, Titel; Lieder mit blauem Streifen,
  Überschriften und „Beginn“ als graue Balken – ohne Zuständige und Kürzel, dafür ist die Spalte zu schmal). Ein Lied
  antippen öffnet die Lied-Ansicht. Entwurf `e6-6-entwurf-2.html`, abgenommen von Alwin am 28.10.2026.
- **Ein Stift für alle gezeigten Termine** (Variante A): links in der Gruppenzeile, wo bei den Dienstgruppen der
  Zauberstab für alle Termine sitzt. Danach Griffe zum Ziehen innerhalb eines Termins, Zeile antippen öffnet das
  Punkt-Fenster, „+ Punkt“ am Ende, „+ Ablauf anlegen“ bei Terminen ohne Ablauf. Abgesagte Termine und solche, die man
  nicht bearbeiten darf, tragen ein Schloss. „Neu aufsetzen …“ bleibt in der Termin-Ansicht.
- **Zugeklappt merkt sich das Gerät** – lange Abläufe schieben die Dienste sonst weit nach unten (Alwin).
- **Am Handy** steht der Ablauf des gewählten Termins wie in der Termin-Ansicht (mit Zuständigen und Lied-Karte).

### Intern (E6-6a)

- Neu `dienstplaner/src/TerminAblauf.tsx`: der Ablauf eines Termins (Lieder nachladen, Ansicht, Bearbeiten-Liste,
  Lied-Ansicht, „Ablauf anlegen“/„Neu aufsetzen“, Neu-Lesen nach dem Speichern) – vorher fest in der Termin-Ansicht,
  jetzt dieselbe Stelle für die Termin-Ansicht und jede Spalte der Matrix. Matrix-Teil in `MatrixAblauf.tsx` und
  `useMatrixAblauf.ts` (lädt nur die gezeigten Termine, je Termin eine Abfrage; ein Ladefehler bleibt nicht hängen,
  „Erneut versuchen“).
- `ui/ablauf`: `AblaufListe`, `SortableRow` und `useAblaufBearbeiten` kennen `schmal` (ohne Zuständige/Kürzel/Notiz/
  Lied-Karte, Titel höchstens zwei Zeilen mit Silbentrennung; statt des schwebenden Plus „+ Punkt“ am Ende der Liste).
- Kalender und Admins eines Termins (Bearbeiten-Regel des Ablaufs) stehen an der Matrix-Spalte (`PlanSpalte.ablaufTermin`,
  dazu `beginn`), gelesen über `ablaufTerminVon` – vorher nur für den Einzeltermin; `TerminDaten.ablaufTermin` ist
  entfallen. `PlanenAnsicht.ablaufZu` neu.
- Der Hinweis-Stil der Termin-Ansicht liegt als Mixin in `_terminTexte.scss` (`composes … from` geht über SCSS-Dateien
  nicht).

### Geändert (Dienstplaner, Musik-App – Durchklicken Alwin, 28.10.2026)

- **Zeitraum-Leiste gleich hoch:** Zeitraum-Knopf (vorher 40 px), ‹ ＋ ＋ › (32 px) und Filter (34 px) nehmen alle die
  gemeinsame Knopfhöhe (38 px); der Zeitraum bleibt zweizeilig. Gilt mit Zeitraum- und Filter-Knopf auch für die
  Abwesenheiten der Musik-App. Wächter `ui/bedienung/leistenKnoepfe.test.ts`.
- **S/M/L ist die Spaltenbreite:** 124/176/256 px fest, nicht mehr auf die volle Breite gestreckt – vorher sahen S und M
  fast gleich aus und gar nicht verschieden, wenn alle Termine passten. Wie viele Termine passen, ergibt sich aus der
  Breite (S mehr, L weniger).

### Geändert (Musik-App, Seitenköpfe)

- **Keine doppelten Überschriften mehr:** Termine, Lieder, Abwesenheiten und Mehr zeigen oben nicht mehr groß ihren
  Namen – den sagt schon der markierte Reiter. An seiner Stelle steht jetzt, was man dort zuerst braucht: bei Termine
  „Kommende | Vergangene“, bei Lieder das Suchfeld, bei Abwesenheiten „Termine | Einträge“, bei Mehr die Gemeinde-Karte;
  Vollbild bzw. „+ Zeitraum eintragen“ rechts daneben. So macht es auch die ChurchTools-App bei „Kalender“ und
  „Beiträge“. Die Liste beginnt dadurch rund 50 px weiter oben. Seiten mit Zurück (Ablauf, Liedblatt) behalten ihren
  Titel.

### Behoben (alle Erweiterungen, iPhone)

- **Köpfe in der ChurchTools-App nicht mehr zu tief:** Wer ChurchTools vom Home-Bildschirm öffnet, sah über jedem
  Seitenkopf rund 36 pt leeren Platz. Den Abstand braucht nur unsere eigene installierte App (unter dem milchigen
  iOS-Band); in den Erweiterungen beginnt der Kopf jetzt 12 pt unter der ChurchTools-Leiste.
- **Das runde Plus sitzt nicht mehr in der Ecke:** Es steht jetzt 24 px vom rechten Rand und mindestens 40 px über der
  Unterkante – vorher lag es in der Geräte-Rundung auf Höhe des Home-Strichs. Listen darunter halten passend mehr Platz
  frei, damit das Plus nicht auf dem letzten Eintrag liegt.

### Neu (Protokolle, S5-2)

- **Nächste Sitzung festlegen** (Alwin 28.10.2026, Entwurf 7): Im Protokoll steht oben im Bereich „Termine“ die nächste
  Sitzung – mit Einladungen und Zusagen; ist noch keine festgelegt, hat die Leitung dort den Knopf **„Nächste Sitzung
  festlegen“**. Das Fenster ist vorbelegt **wie die letzte Sitzung** (Titel, Uhrzeit, Dauer; Datum im Abstand der
  letzten beiden Sitzungen, sonst vier Wochen, frühestens morgen). Eingeladen sind **alle aktiven Mitglieder**, einzeln
  abwählbar; das Fenster sagt vorher, dass die Einladung **sofort** per Mail rausgeht (wer festlegt und sich einlädt,
  hat gleich zugesagt und bekommt keine). Angelegt werden der **Kalendertermin mit Besprechungsanfrage**, das
  **Gruppentreffen** und die **geplante Sitzung**, die beides verknüpft – „Protokoll beginnen“ macht daraus später den
  Entwurf.
- **Neue Sitzung** (außerordentlich): derselbe Ablauf über den Knopf „Neue Sitzung“ im Reiter „Sitzungen“ – nur für die
  Leitung und nur, wenn die Gruppe einen Kalender hat; vorbelegt wie die letzte Sitzung, die schon stattgefunden hat
  (nicht nach einer schon geplanten). Danach öffnet sich die neue Sitzung.
- **Nie doppelt einladen:** Ist unklar, ob ChurchTools den Termin angelegt hat (keine Antwort, Zeitüberschreitung),
  sieht die Erweiterung im Kalender nach und macht mit dem gefundenen Termin weiter; findet sie keinen, sagt sie „bitte
  im Kalender nachsehen“ statt „noch einmal versuchen“. Scheitern danach Gruppentreffen oder Verknüpfung, bleibt der
  Termin stehen und das Fenster sagt, was fehlt – zurückgerollt wird nie (einen Termin zu löschen schickt allen
  Eingeladenen „Termin gelöscht“, gemessen 28.10.2026).

### Behoben (Protokolle)

- „Protokoll beginnen“ (S5-1): Übernahm ChurchTools das neue Protokoll nicht, stand im Fenster „ChurchTools antwortet
  gerade nicht“ statt der eigentlichen Meldung – jetzt „ChurchTools hat das neue Protokoll nicht übernommen“. Beim Bau
  von S5-2 gefunden.

### Intern

- Gruppentreffen werden über **eine** Abfrage gelesen (`treffenLesen`): ChurchTools zählt `end_date` nicht mit (gemessen
  28.10.2026). Beim ersten Prüfen in der Test-Instanz fand das Nachlesen nach dem Anlegen das Treffen deshalb nie;
  „Kommend“ ließ den letzten Tag aus.

- `@ui/ct/fehler`: neue Klasse `Unklar` – für Fälle, in denen ein zweiter Versuch Schaden anrichtet; `fehlerMeldung`
  zeigt ihre Meldung ohne „Erneut versuchen“.
- Termine bringen ihr Ende mit (`Termin.ende`, `Sitzung.ende`) – für die Dauer der nächsten Sitzung.

### Neu (Organigramm, O7b-4, #736)

- **Organigramm als PDF:** Knopf „PDF / Drucken“ im Seitenkopf (neben „Präsentieren“). Das Fenster übernimmt Ansicht,
  „Anfangen bei“ und was aufgeklappt ist, mit **Vorschau**: Ansicht (von oben, von links, Mindmap, Liste),
  Ausschnitt, Papier („Passend“ – das A4, auf dem das Diagramm am größten wird –, A4 quer/hoch, A3 quer/hoch),
  „Alles aufgeklappt“ und „Logo der Gemeinde“. Ein Diagramm steht auf einer Seite (Schrift höchstens 11 pt, unter 6 pt
  ein Hinweis), eine Liste läuft über mehrere Seiten.
- Das Blatt (Entwurf `o7b-4-pdf-v1.html`): oben Logo aus ChurchTools, „Organigramm“, Gemeinde und Stand, unten Gemeinde
  und Seitenzahl; Lato wie in ChurchTools, immer hell. **PDF öffnen** zeigt die PDF in einem neuen Tab – von dort
  drucken; **Herunterladen** speichert sie. Eine eigene PDF statt des Druckfensters des Browsers, weil Safari dort das
  Querformat nicht hielt und Adresse und Datum an den Rand druckte (Test 28.10.2026).

### Intern

- `ui/teilen/svgSeitenPdf.ts`: Seiten, die als SVG am Bildschirm stehen, werden zur PDF (svg2pdf.js, jede Seite in
  ihrem Format) – die ausgerechneten Stile wandern als Attribute mit, die Grundlinie mittig gesetzter Texte misst der
  Browser. `ui/teilen/pdfSchrift.ts`: Lato (unverändert, OFL) für PDFs, auch im Dokument unter eigenem Namen
  `LatoPdf`. `oeffnePdf` in `ui/teilen/sharePdf.ts`. `ui/ct/logo.ts`: Logo der Gemeinde (`/api/config` →
  `site_logo`).
- Die hellen Farben stehen jetzt im Mixin `hell` (`ui/design/_farben.scss`); `:root` bindet ihn ein (gebautes CSS
  unverändert), ebenso das Blatt – so bleibt Papier im Dunkelmodus hell, ohne zweite Werte.
- Organigramm: `DiagrammBild.tsx` zeichnet Bildschirm und PDF gleich (auf Papier mit dem Linienstück, wo sonst das +/−
  sitzt – `schalterStummel` im Ansichten-Kern), `messung.ts` misst an einer Stelle, `spitzenWahl` liefert die Auswahl
  für „Anfangen bei“ und „Ausschnitt“. Neue Abhängigkeiten im Organigramm: `jspdf` (wie Musik-App/Anmeldungen),
  `svg2pdf.js` – beide erst beim Öffnen des PDF-Fensters geladen.

### Neu (Anmeldungen, A9-3a)

- **Daten löschen nach Datum** – beide Abläufe in ChurchTools bekommen „warten bis zum Löschdatum“ und „entfernen“
  (Löschdatum = Ende des Termins, sonst Beginn, plus Frist in Monaten; `loeschDatum`). Die Karte „Datenschutz“ zeigt das
  Datum, wie es in ChurchTools steht; ohne Termin „kein Löschdatum“.
- **Rückfrage vor dem sofortigen Löschen** – liegt das neue Datum heute oder früher, entfernt ChurchTools beim Speichern
  alle Anmeldungen (gemessen 28.10.2026). Das Fenster „Daten löschen“ fragt darum mit der Zahl („Jetzt 3 Anmeldungen
  löschen“, ohne „Rückgängig“); der Abgleich beim Öffnen schreibt so ein Datum nie und zeigt stattdessen „schon
  erreicht“ (Alwin, 28.10.2026, E3).
- **Schon Angemeldete werden mit gelöscht** – ihr Ablauf war abgeschlossen; die Erweiterung bringt sie beim Einrichten
  ohne Mail ins Warten (Mail kurz aus, `restart: ['finished']`, Mail wieder an – auch nach einem Fehler; E6).
- Termin oder Frist geändert → der Abgleich zieht das Datum nach. Termin entfernt → Warten und Entfernen fallen weg,
  Wartende werden beendet (`finish`), nicht entfernt.
- **Anmeldeschluss vor dem Löschdatum** – steht die Anmeldung am Löschdatum noch offen, bekäme eine neue Anmeldung „Du bist
  dabei!“ und wäre im selben Augenblick entfernt (echte Prüfung 28.10.2026). Mit dem Löschdatum zieht die Erweiterung den
  Anmeldeschluss darum auf den Tag davor (23:59 Uhr), wenn keiner oder ein späterer gesetzt ist – vor den Routinen
  geschrieben und nachgelesen; der Abgleich zieht ihn wieder vor, falls jemand die Anmeldung erneut öffnet. Karte, Rückfrage
  und die Fenster „Daten löschen“ und „Anmeldung“ sagen es; dort lässt sich kein späterer Schluss speichern.

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
- E2E `e2e/direktlink-lied.spec.ts` (auch ein vergangener Termin, mit und ohne Tag, und der Sprung auf ein **späteres**
  Lied am Rechner und am Handy – ein Sprung auf Lied 1 beweist nichts, dort steht das Blatt ohnehin). Der CT-Stub filtert
  `/api/events` jetzt wie ChurchTools nach `from`/`to` und hat einen vergangenen Termin mit zwei Liedern. Die Tests laden erst neu, wenn der
  Anmeldestatus gespeichert ist: Der Abfrage-Speicher schreibt höchstens einmal je Sekunde, und `['me']` gilt 60 s als
  frisch – wer früher neu lädt, sieht wieder das Anmelden (parallel in jedem zweiten bis dritten Lauf).

### Geändert (Musik-App, Ablauf)

- **„Bearbeiten“ ist nicht mehr blau:** Der Knopf steht jetzt grau mit Rahmen wie „Teilen“ – er wirkte zu aufdringlich.
  Blau ist erst **„Fertig“**, solange man den Ablauf bearbeitet.

### Geändert (Musik-App, Abwesenheiten wie im Dienstplaner)

- **Zeitraum statt Monats-Kapseln:** Oben steht jetzt derselbe Zeitraum-Knopf wie in Dienstplaner › Planen – ab heute
  (die nächsten vier Wochen), dieser Monat, nächster Monat oder ein eigener Zeitraum von–bis, höchstens ein Jahr
  voraus. Die Termine stehen nach Monaten überschrieben darunter.
- **Filter mit Häkchen:** Statt der Kapseln „Alle · Gottesdienst · …“ gibt es den Knopf „Filter“ wie im Dienstplaner.
  Je Termin-Art ein Häkchen; man kann jetzt auch mehrere Arten ausblenden. Die Zahl am Knopf zeigt, wie viele gerade
  ausgeblendet sind. Eine bisher gemerkte Wahl („nur Gottesdienst“) wird übernommen.

### Intern

- `ZeitraumKnopf`, `FilterKnopf` und `useAufklapp` liegen jetzt in `ui/bedienung` (vorher im Dienstplaner), die
  Zeitraum-Regel in `shared/ct/zeitraum.ts`; das „+ … hinzufügen“-Menü aus S2 nutzt denselben Aufklapp-Baustein statt
  einer eigenen Kopie. Die Jahresgrenze für Termine (`MAX_VORAUS_TAGE`) steht in `shared/absences` für Server und App.

### Behoben (Organigramm, Anmeldungen)

- **Mitgliedschaften: Anlegen und Ändern sind jetzt zwei Aufrufe** – ChurchTools meldete per Mail „Nutzung veralteter
  APIs“ (`PUT /groups/{id}/members/{personId}` → `PATCH`). Gemessen 28.10.2026 in der Test-Instanz: `PATCH` legt
  **keine** Mitgliedschaft an (404), `PUT` mit `only_add: true` legt an und lehnt ab, wenn es sie schon gibt (403).
  Veraltet ist nur das **Ändern** per `PUT` – und das löschte dabei still **Kommentar und Enddatum**, wenn sie nicht
  mitgeschickt wurden.
  - Organigramm: „Rolle ändern“, „Austragen“ und deren „Rückgängig“ per `PATCH`; „Aufnehmen“ legt neu an (`PUT` mit
    `only_add`) oder ändert, wer früher schon dabei war. Bisher verlor eine Mitgliedschaft beim Rolle-Ändern ihren
    Kommentar und ein gesetztes Enddatum.
  - Anmeldungen: „Von Hand anmelden“ und „Rückgängig“ nach einer Absage legen nur noch an (`only_add`) – ist die
    Person inzwischen doch dabei, wird ihre Anmeldung nicht überschrieben. „Leitung“ beim Freigeben: wer schon in der
    Gruppe ist, wird per `PATCH` zur Leitung, alle anderen werden angelegt.

### Intern (Organigramm, Anmeldungen)

- `MitgliedZugriff.schreiben` aufgeteilt in `anlegen` und `aendern`. Die Test-Nachbauten (Regeln, App, Anmeldungen) und
  die Organigramm-Demo verhalten sich wie ChurchTools: `PUT` ohne `only_add` ist ein Fehler, `PATCH` ohne
  Mitgliedschaft 404. Gegenprobe: jeder der sieben Teile einzeln zurückgenommen – es fallen 1 bis 8 Tests.

### Geändert (Musik-App, Liedblatt im ChurchTools-Look – Scheiben B1 und B2)

- **Neuer Kopf im Liedblatt:** ein Kopf im Look der Ablaufpläne in ChurchTools statt der runden Knöpfe und
  Titel-Kapseln. Am iPad steht oben „← Ablauf“ mit dem Termin, darunter in einer Zeile die **Lied-Leiste** und die
  beschrifteten Knöpfe **Aussehen, Tempo, Anmerken** (mit Recht „Notizen von …“). Am Handy ist die Karte kompakt:
  Zurück und Vollbild als Symbol neben der Leiste, die Knöpfe mit Kurzwort darunter; am Handy quer steht alles in
  einer Zeile.
- **Lied-Leiste:** alle Lieder des Ablaufs nebeneinander, nummeriert. Die sichtbaren sind grau hinterlegt, das
  gewählte ist blau unterstrichen und zeigt Tonart, Fassung und Tempo. Ein Tipp springt zu einem Lied; im Querformat
  wählt er das zweite sichtbare Lied, ohne dass das Blatt springt; ein Tipp auf das gewählte öffnet sein Lied-Menü.
  Die Leiste lässt sich seitwärts wischen und scrollt beim Blättern mit.
- Die Knöpfe wirken auf das gewählte Lied – im Querformat gibt es keine eigenen Knöpfe je Hälfte mehr. Beim Zeichnen
  heißt der Knopf „Anmerken beenden“, beim Ansehen fremder Notizen steht nur „Zurück zu den eigenen Notizen“.
- Aus der Liederliste: „← Lieder“, der Liedname als Titel, in der Leiste nur dieses Lied.
- In der ChurchTools-Erweiterung ist unter der Fußleiste kein großer leerer Streifen mehr – das Blatt wird dadurch
  etwas größer.
- Die Einführung im Liedblatt zeigt auf die neue Leiste und die Knöpfe (wer sie schon kennt, sieht sie nicht neu).
- Ablauf bearbeiten: Der Einführungs-Schritt zum Plus beschreibt jetzt „Option wählen“ (Programmpunkt, Lied,
  Überschrift) statt des alten Umschalters im Fenster.

### Neu (Protokolle, S5-1)

- **Protokoll beginnen** (Alwin 28.10.2026, Entwurf 7): Hat eine Sitzung (Termin mit Besprechungsanfrage oder
  Gruppentreffen) noch kein Protokoll, bietet die Sitzungsansicht der Leitung „Protokoll beginnen“ an. Im Fenster wählt
  man eine **Vorlage**, **„Wie letztes Mal“** (Tagesordnung des letzten freigegebenen Protokolls, ohne dessen Notizen)
  oder **„Leer“** – vorbelegt ist „Wie letztes Mal“, sonst die erste Vorlage. Danach öffnet sich das Protokoll gleich
  im Editor; die festen Aufgaben der Vorlage sind sofort To-Dos.
- Hat inzwischen jemand anderes dasselbe Protokoll begonnen, sagt das Fenster das und öffnet dessen Protokoll – es
  entsteht kein zweites.

### Behoben (Protokolle)

- **Serientermine:** Ein Protokoll hing an allen Terminen einer Serie (sie haben in ChurchTools dieselbe ID) – jetzt
  nur am Termin zu seinem Beginn; ein einzelner, verschobener Termin bleibt bei seinem Protokoll. Beim Bau von S5-1
  gefunden, bevor es auftreten konnte (bisher legte die Erweiterung keine Köpfe zu Terminen an).

### Intern (Protokolle, S5-1)

- Regel `shared/protokolle/beginnen.ts` (`anfangsDokument`, `neuerKopf`), Zuordnung `gehoertZu` in
  `shared/protokolle/sitzungen.ts` (eine Stelle für `sitzungenOrdnen` und „beginnen“); Schreiben
  `protokolle/src/beginnen.ts`: frisch lesen → Teile → nachlesen → Kopf → nachlesen → To-Dos (scheitern nur diese, steht
  das Protokoll und das nächste Speichern holt sie nach). Ein geplanter Kopf wird umgestellt statt ein zweiter angelegt.

### Neu (Organigramm, O7b-3, #736)

- **Drei Diagramme** im Reiter Organigramm: **Von oben** (das klassische Organigramm), **Von links** und **Mindmap**.
  Im Kästchen nur der Name; Klick oder Enter öffnet die Gruppe, das runde **+/−** klappt auf und zu (zugeklappt mit
  der Zahl der Untergruppen). **Ziehen** verschiebt, **Mausrad** und **zwei Finger** zoomen, dazu − / + / **Ganz
  zeigen**. Das Bild fängt lesbar groß an der Spitze an, wenn nicht alles lesbar passt; Auf- und Zuklappen lässt den
  Blick stehen. Mit der Tastatur springt das Bild zum gewählten Kästchen.
- **Startansicht** ohne Wahl: am Laptop **Von oben**, am Handy die Liste. **Alle auf-/zuklappen** und **Anfangen bei**
  gelten auch für die Diagramme.

### Geändert (alle Apps)

- **Eine Höhe für alle Knöpfe und Bedienelemente einer Reihe** (`--knopf-hoehe`, 38 px): Kopf-, Zeilen- und
  Fensterknöpfe, der Umschalter (`Segment`, bisher 40 px, jetzt auch im Dienstplaner und in den Protokollen 38 px) und
  die Auswahlfelder. Die Beschriftung im Umschalter bricht nicht mehr um („Neue Gliederung“ stand in zwei Zeilen);
  passt er nicht in die Breite, rutschen ganze Knöpfe in eine zweite, gleich hohe Reihe.
- **Organigramm:** In der Leiste standen fünf Höhen nebeneinander (30–40 px) – jetzt alles 38 px. **„Präsentieren“
  steht im Seitenkopf rechts neben „Hallo …“** (wie „+ Gruppe erstellen“ in ChurchTools), damit die Leiste auch bei
  1280 px in eine Zeile passt; „Alle auf-/zuklappen“ sind Kopfknöpfe, die Zoomknöpfe Zeilen- bzw. Kopfknöpfe (am
  Handy nur Symbole). Auch das Suchfeld bei Personen, die Knöpfe der Präsentation und die Felder im Gruppenfenster
  haben diese Höhe. Der lange Name der Gemeinde an der Spitze eines Diagramms wird nicht mehr gekürzt.

### Intern (Protokolle)

- **Wackelnder Test, zweiter Anlauf:** `abschnittZiehen.test.ts` (S4-3b) hängte echte Editoren ein und nie wieder aus –
  dieselbe Ursache wie bei `editorSchema.test.tsx` (26.10.2026); die CI scheiterte am 28.10.2026 wieder mit „document
  is not defined“. Der Helfer zum Aushängen stand nur in der einen Testdatei. Jetzt liegt er an einer Stelle,
  `protokolle/src/editorTest.testutil.ts`: `einhaengen(editor)` hängt den Editor ein und nach dem Test von selbst
  wieder aus. Beide Testdateien nutzen ihn.
- **Dauerprüfung** `ui/design/editorEinhaengen.test.ts`: Kein Test und keine Test-Hilfe in den Apps, `ui/` und
  `shared/` darf `.mount(` selbst aufrufen, nur der Helfer. Ein neuer Test prüft außerdem, dass das Aushängen ohne
  eigenes `afterEach` passiert.

### Neu (Anmeldungen, A9-2b)

- **Check-in-Code in der Bestätigung** – Schalter „Check-in-Code (QR) mitschicken“ im Fenster „Mails“ (Reiter
  Bestätigung, Standard aus). Er schaltet den Check-in der Gruppe in ChurchTools ein und **in demselben Aufruf** dessen
  eigene Mail „Dein Check-in-Code“ aus – gemessen 26.10.2026: sonst zwei Mails je Person und beim Einschalten eine an
  alle schon Angemeldeten. Der Code kommt als Bild in die Bestätigung, nur wenn die Person einen hat (`{{#if}}`,
  gemessen 28.10.2026). Nachgelesen wird danach. Die Karte „Mails“ zeigt den Stand; schaltet jemand den Check-in in
  ChurchTools um, zieht der Abgleich beim Öffnen die Mail nach und stellt die Code-Mail wieder ab. (Wer sie in
  ChurchTools bei laufendem Check-in einschaltet, verschickt sie dort sofort an alle – echte Prüfung 28.10.2026.)

### Geändert (Anmeldungen, A9-2b)

- **„Mail schreiben“ entfällt** nach Nachrücken, Von Hand, Person dazu und Zurückholen, wenn die Mails eingerichtet
  sind – die Bestätigung kommt von selbst. Nach einer Absage bleibt es. Die Regel steht an einer Stelle
  (`mailAnbieten`).
- „Leitung benachrichtigen“ (geplant für A9-2b) ist **gestrichen**: `informLeader` schickte in keinem Versuch eine Mail,
  auch nicht an eine zweite Leitung (gemessen 26./28.10.2026).

### Geändert (Ablauf in Musik-App und Dienstplaner, E6-O O3, #747)

- **Das Punkt-Fenster sieht aus wie ChurchTools** (Variante B des Fenster-Entwurfs, abgenommen 23.10.2026): Titel des
  Punkts links, X rechts; darunter „Position 2 von 8 · 10:00 – 10:04“ mit **‹ ›** zum vorigen und nächsten Eintrag.
  Die Felder stehen als **Liste „Beschriftung | Feld“** in einer umrandeten Fläche, alle gleichzeitig bearbeitbar;
  unten links **„Eintrag löschen“** (rot), rechts „Abbrechen · Speichern“. Am Handy stehen die Knöpfe untereinander.
- **‹ › blättern nur, wenn nichts ungespeichert ist** – sonst sind sie gesperrt, mit dem Hinweis „Zum Blättern erst
  speichern oder abbrechen.“ (Alwin). Beim Blättern blendet das Fenster nicht neu ein.
- **„Zuständig“ ist eine Zeile mit Pfeil** (Alwin): Sie zeigt die Dienste ohne Klammern und die eingeteilten Personen;
  ein Tipp öffnet die Bearbeitung im Fenster („Zurück · Übernehmen“). Gespeichert wird weiter erst mit „Speichern“.
- **„Lied“ ist eine Zeile mit Pfeil** (Musik-App): öffnet „Lied verknüpfen“ – jetzt ebenfalls ein Fenster im
  ChurchTools-Aufbau („Abbrechen“ führt zurück, das X schließt ganz). Leer steht „+ Hinzufügen“ da.
- Ein Tipp neben das Fenster schließt weiterhin nur, wenn nichts geändert ist.

### Geändert (Dienstplaner)

- **Am Rechner und iPad steht das grüne „+“ oben rechts im Ablauf** (wie „+ Termin“ im ChurchTools-Kalender, mit Menü
  „Programmpunkt · Überschrift hinzufügen“) statt des blauen Punkts unten rechts; am Handy bleibt der Punkt (Alwin,
  28.10.2026 – wie die Musik-App seit S2).
- **Der Reiter „Termine“ heißt jetzt „Dienste“** (Alwin) – oben in der Leiste, am Handy unten, als Überschrift der
  Liste und im Zurück-Knopf eines Termins. Die Adresse bleibt `#/termine`, gemerkte Links gehen weiter.

### Intern (E6-O O3)

- `Sheet` kann mehr: `links` (ein Knopf ganz links in der Fußzeile, auch im Dokument zuerst), `mittel` (560 px),
  `onHintergrund` (eigener Weg für den Tipp daneben) und `einblenden={false}` (ohne Einblenden, wenn ein Fenster ein
  gleiches ersetzt). Neue Knopf-Art `FensterKnopf art="loeschen"`.
- Das Punkt-Fenster war ein eigenes Overlay und fiel deshalb nie unter `fensterAufbau.test.ts`; jetzt ist es ein
  `Sheet`, ebenso die Liedwahl der Musik-App. `zeitPlus` und `zustaendigText` liegen in `shared/ct/ablaufZeile.ts`.
- `LiedKarte` kennt `flach` (ohne Rahmen, für die Feldliste).

### Intern (Protokolle)

- **Wackelnder Test behoben:** Die Tests der Suche (`Suche.test.tsx`) warteten nur auf die Überschrift („Treffer“,
  „Alle Beschlüsse“) und prüften dann sofort die Liste. Die Überschrift steht aber schon über „Wird geladen …“ – unter
  der Last der Gesamtsuite war die Liste am 28.10.2026 noch leer. Jetzt warten sie, bis das Laden fertig ist.
  Gegenprobe: Mit 50 ms Ladezeit fielen vorher 7 von 11 Tests, jetzt keiner. Für Nutzer kein Fehler – während des
  Ladens steht unter der Überschrift „Wird geladen …“, keine leere Liste.

### Neu (Protokolle, S4-3b)

- **Ein Tagesordnungspunkt zieht seinen Abschnitt mit** (Alwin 28.10.2026, Entwurf 7): Wer eine Überschrift am Griff
  zieht, verschiebt alles bis zur nächsten Überschrift gleicher oder höherer Stufe – Text, Aufgaben, Beschlüsse, Termine
  und feste Punkte. Überschrift 2 und 3 nach derselben Regel.
- **Abgelegt wird nur an Abschnittsgrenzen:** Lässt man mitten in einem anderen Punkt los, rückt der Abschnitt an die
  nächste Grenze – ein anderer Punkt wird nie zerschnitten. Einmal „Rückgängig“ holt alles zurück.
- **„Nach oben“ / „Nach unten“** im Griff-Menü einer Überschrift: springt um einen ganzen Abschnitt – auch der Weg am
  Handy, wo Ziehen mit dem Finger meist nicht geht.

### Behoben (Protokolle)

- Der Griff an einer Überschrift stand eine halbe Zeile tiefer, neben dem nächsten Block – wer „Punkt 2“ greifen
  wollte, zog Punkt 1 (seit S4-1: BlockNote verschiebt ihn passend zu seinen großen Überschriften, unsere sind kleiner).

### Intern (Protokolle, S4-3b)

- Regel `shared/protokolle/abschnitte.ts` (`abschnittEnde`, `ablegeStelle`, `nachbarStelle`, `abschnittVerschoben`);
  Anbindung `protokolle/src/abschnittZiehen.ts`: Beim Ziehen markiert sie den Abschnitt (BlockNote zieht dann alle
  markierten Blöcke im Bild), beim Loslassen setzt sie ihn selbst in einem Schritt. Die Markierung wird vorher
  aufgehoben – beim Durchklicken gefunden: „Rückgängig“ holte sie sonst zurück, und ein danach gezogener einzelner Block
  nahm die ganze Markierung mit. Blöcke ohne Überschrift legt BlockNote weiter frei ab.

### Geändert (Musik-App, Knöpfe im ChurchTools-Look – Scheibe S2)

- **„Eintrag hinzufügen“ wie in der ChurchTools-App:** Im Bearbeiten des Ablaufs fragt das Plus zuerst
  **„Option wählen“** – Programmpunkt, Lied oder Überschrift. Am Handy schwebt weiter das runde blaue Plus und öffnet
  ein Blatt von unten; am iPad und Rechner steht oben ein grüner Knopf **„+ Eintrag hinzufügen“** mit einem kleinen
  Menü (wie „+ Gruppe erstellen“ in ChurchTools). „Lied hinzufügen“ öffnet gleich die Liedsuche; wer sie ohne Lied
  verlässt, hat nichts angelegt. Escape schließt Menü und Blatt.
- **Abwesenheiten:** Am iPad und Rechner steht „+ Zeitraum eintragen“ grün oben rechts, am Handy bleibt das Plus.
- **Knöpfe in Listen eckig mit Rahmen** statt rund: Plus und Stift in der Liederliste, das Plus in der Liedsuche des
  Ablaufs und „+ Anlegen“ bei Terminen ohne Ablauf.

### Geändert (Dienstplaner)

- Das Plus im Ablauf fragt ebenfalls erst **„Option wählen“** (Programmpunkt oder Überschrift).

### Neu (Organigramm, O7b-2, #736)

- **Ansicht wählen** über dem Baum: **Karten** wie bisher oder die neue **Liste** – die Gemeinde als Gliederung mit
  Linien, nur Namen, jede Gruppe klappt auf und zu (anfangs Gemeinde und Bereiche offen), dazu **Alle auf-/zuklappen**.
  Die Wahl merkt sich das Gerät; ohne Wahl startet das Handy mit der Liste.
- **Anfangen bei** einem Bereich – Karten und Liste zeigen dann nur ihn. Im Gruppenfenster **„Im Organigramm hier
  anfangen“** für jede Gruppe mit Untergruppen (auch aus den Reitern Personen und Hinweise). Blendet der Typ-Filter
  die Spitze aus, gilt wieder die ganze Gemeinde.

### Intern (Organigramm)

- Der gefilterte, sortierte Baum wird einmal in `App` gerechnet und an Karten, Liste und „Hier anfangen“ gegeben.
- `auswahl.ts`: Lesen und Merken im Gerät über eine gemeinsame Stelle (Typ-Filter und Ansicht).

### Geändert (Organigramm und Protokolle, E6-O F5, #741)

- **Die letzten Fenster im ChurchTools-Aufbau:** im Organigramm das Fenster einer Gruppe und einer Person, in den
  Protokollen „Gruppe einrichten“ und „Vorlage“ – Titel links, **X rechts**, Knöpfe **rechts unten** (am Handy
  untereinander, Hauptknopf oben). Damit haben alle Fenster aller Apps diesen Aufbau.
- **Fenster einer Gruppe (Organigramm):** Austragen, Rolle ändern, Person aufnehmen, Obergruppe ändern/lösen/dazu und
  Untergruppe anlegen **ersetzen jetzt den Inhalt**, statt unter der Mitgliederliste zu erscheinen (Alwin). Unten
  stehen nur „Zurück“ und der Hauptknopf („Austragen“, „Ändern“, „Aufnehmen“, „Umhängen“ …); „Zurück“ führt zur
  Gruppe, ganz zu geht es über das X. Während etwas gespeichert wird, sind X und „Zurück“ gesperrt.
- **Vorlage (Protokolle):** „Speichern“ steht unten; „Vorlage löschen“ bleibt getrennt im Inhalt.
- Textknöpfe im Organigramm („Erneut versuchen“, „Wie heute“) sehen aus wie im Dienstplaner: halbfett statt
  unterstrichen, gesperrt blasser.

### Intern (E6-O F5)

- `ui/fenster/fensterAufbau.test.ts` prüft jetzt **alle** Apps – die Ausnahmeliste (`NOCH_NICHT_UMGEZOGEN`) ist weg,
  dazu ein Test, dass wirklich alle Apps im Blick sind.
- Die Schritt-Bausteine im Organigramm (`StrukturSchritte`, `MitgliedSchritte`) zeigen nur noch den Inhalt; Auswahl
  (Person, Rolle) und Knöpfe hält `GruppenFenster`, „Anlegen“ schickt das Formular per `form=` ab.
- Drei gleiche `.link`-Stile (Organigramm) nutzen `m.textKnopf`; entfernt: `.primaer` in „Gruppe einrichten“ und
  „Vorlage“.

### Intern (Protokolle)

- **Wackelnder Test behoben:** `editorSchema.test.tsx` hängte zwei echte Editoren ein und nie wieder aus. Ein später
  Zeitgeber von ProseMirror (20 ms) fasste dann nach dem Abbau von jsdom `document` an – die CI scheiterte mit
  „document is not defined“, obwohl alle Tests grün waren (26.10.2026). Jetzt werden eingehängte Editoren nach jedem
  Test ausgehängt (und damit zerstört); ein eigener Test prüft, dass ein ausgehängter Editor `document` nicht mehr
  anfasst.

### Geändert (Musik-App, Seitenköpfe im ChurchTools-Look)

- **Seitenköpfe wie in ChurchTools** statt runder Knöpfe: Der Ablauf hat oben eine weiße Kopfkarte mit
  „← Termine“, **Teilen**, **Abschließen** und **Bearbeiten** (am Handy nur als Symbol; blau ist erst **Fertig** im
  Bearbeiten); Übersichten zeigen
  ihren Titel links und Vollbild rechts. Der Kopf scrollt mit dem Inhalt.
- **Reiter oben am iPad und Rechner:** Termine · Lieder · Abwesenheiten · Mehr stehen dort oben als Text, der gewählte
  blau unterstrichen – wie die Reiter in ChurchTools „Events“. Am Handy bleibt die Leiste unten; der gewählte Reiter
  hat jetzt eine blaue Linie oben (in allen Apps mit dieser Leiste).

### Neu (Anmeldungen, A9-2a)

- **Mails bearbeiten** – „Bearbeiten“ an der Karte „Mails“ öffnet das Fenster „Mails“ (im ChurchTools-Aufbau) mit den
  Reitern **Bestätigung** und **Warteliste**: je Mail eigener Betreff, eigener Absatz und Gruß; der **Absender** ist
  aus der Leitung der Veranstaltung wählbar. Termin, Betrag, Bankdaten, Link und Kontakt bleiben fest (Alwin,
  24.10.2026: fester Rahmen + eigener Absatz). **Vorschau** über ChurchTools mit dem Text im Fenster – für eine echte
  Anmeldung mit passendem Status, sonst für den Absender.
- Der eigene Text steht in der **Beschreibung der Routine** (Alwin, 26.10.2026; gemessen: bis 1.000 Zeichen, bleibt beim
  Neuschreiben der Schritte stehen) – nicht öffentlich. Das Fenster zählt mit und sperrt „Speichern“, wenn es zu lang ist.
- **Die Mails bleiben aktuell:** Beim Öffnen einer Veranstaltung gleicht die Erweiterung die Mails mit den Einstellungen
  ab und schreibt sie neu, wenn Termin, Bezahlung, Kontakt, Preise oder Name sich geändert haben (auch über
  „Rückgängig“ oder in ChurchTools selbst) – mit Absender und eigenem Text von dort. Nur, wo beide Abläufe an sind.
- **Kopien** merken sich ihre Vorlage (`kopieVon`) und übernehmen beim Freigeben deren eigenen Mailtext.

### Geändert (Anmeldungen, A9-2a)

- Die Bestätigung nennt nur noch den Betrag, nicht mehr die Aufschlüsselung – sie kam in einer Zeile an (echte Prüfung
  A9-1, 24.10.2026; Alwin, 26.10.2026).

### Neu (Organigramm, O7b-1, #736)

- **Ansichten-Kern** (noch ohne Oberfläche, `shared/organigramm/ansichten.ts`): was von der Gemeinde zu sehen ist –
  Spitze ist die Gemeinde (in ChurchTools keine Gruppe, nur ihr Name) oder eine Gruppe („Anfangen bei“), jede Gruppe
  klappt auf und zu (anfangs Gemeinde und Bereiche offen), „Alle auf-/zuklappen“ nur unter der Spitze. Eine Gruppe mit
  zwei Obergruppen steht unter beiden und klappt an jeder Stelle für sich.
- **Drei Anordnungen** als reine Rechnung: **von oben** (Bereiche nebeneinander, darunter gestapelt), **von links**
  und **Mindmap** (Bereiche nach Zeilen auf rechts und links verteilt) – Kästchen, Linien, Rahmen und wo der Blick
  anfängt. Die Textbreite misst die Oberfläche; gezeichnet wird ab O7b-3.

### Neu (Protokolle, S4-3a)

- **Feste Punkte zeigen jetzt etwas** (Alwin 26.10.2026, Entwurf 7): **„Offene To-Dos“** listet die offenen To-Dos der
  Gruppe aus früheren Sitzungen mit Status-Kreis, Wer und Bis (überfällige zuerst); darunter eingeklappt **„Seit der
  Sitzung am … erledigt“**. Im Editor hakt man sie direkt am Kreis ab, in der Lese-Ansicht ist es nur Anzeige.
  **„Protokoll der letzten Sitzung“** zeigt das letzte freigegebene Protokoll der Gruppe; **„Öffnen“** zeigt es in
  einem Fenster, ohne den Editor zu verlassen.
- Feste Punkte lassen sich nachträglich einfügen – über zwei Knöpfe in der Werkzeugleiste und im **„/“-Menü** (Gruppe
  „Feste Punkte“): Tagesordnungspunkt mit Titel, darunter der Punkt und eine Zeile für Notizen.
- **Umschalter „Schreiben | Lesen“** im Editor: zeigt dasselbe Protokoll als ruhige Lese-Ansicht, ohne Werkzeugleiste.
  Lesen setzt keine Sperre; was noch nicht gespeichert war, wird beim Umschalten sofort gespeichert.
- **Werkzeugleiste bricht am Rechner um** statt rechts abgeschnitten zu sein – Zitat, Trennlinie und die festen Punkte
  waren mit der Maus nicht erreichbar (ohne sichtbaren Rollbalken). Am Handy bleibt sie wischbar.

### Intern (Protokolle, S4-3a)

- Regel `shared/protokolle/festePunkte.ts`: `letztesProtokoll`, `offeneVonFrueher` (nutzt `offene`/`erledigtSeit`) und
  `festePunkteFesthalten` für die Freigabe (S6) – **bis zur Freigabe live, danach festgehalten** in `props.fest` des
  Verweis-Blocks. „Wie letztes Mal“ und Vorlagen übernehmen nichts Festgehaltenes.
- Ein Baustein `FesterPunkt` für Editor und Lese-Ansicht, `FestePunkteRahmen` (Kontext + Fenster). Titel der festen
  Punkte an einer Stelle (`FESTE_PUNKTE`, auch fürs Vorlagen-Fenster).
- Ein Klick in einen festen Punkt im Editor setzt weder Cursor noch Markierung (beim Durchklicken gefunden: Tippen
  danach ersetzte den Punkt bzw. zog zwei Tagesordnungspunkte zusammen) – Test für beide Hälften.
- `Sheet` kann `breit` (bis 760 px) für Fenster zum Lesen; neues Symbol `todo-liste`.

### Geändert (Anmeldungen, E6-O F4)

- **Alle Fenster der Anmeldungen im ChurchTools-Aufbau** (#734): Titel links, **X rechts**, Knöpfe **rechts unten**,
  am Handy – und wenn sie nicht nebeneinander passen – untereinander mit dem Hauptknopf oben. Betroffen sind 33
  Fenster: Neue Veranstaltung, Verwalten (Umbenennen, Freigabe zurücknehmen, anderes Team, Löschen), Archiv, Termin,
  Anmeldung, Wer meldet sich an?, Bezahlung, Daten löschen, alle Preis-Fenster, Einstellungen der Gemeinde, Freigeben,
  QR-Code, Druckliste, Rundmail, Anmeldung von Hand, Zurückholen und das Fenster einer Anmeldung.
- **Mehrstufige Fenster haben unten nur „Zurück“ und den Hauptknopf**, ganz zu geht es über das X (Alwin): Anmeldung
  von Hand, Rundmail-Vorschau und „… jetzt senden?“, im Fenster einer Anmeldung „Nachrücken?“, „Absagen?“ (dort
  führt „Abbrechen“ zurück zur Anmeldung) und die fertige Mail.
- **Zwei Wege unten nebeneinander:** QR-Code „als Bild“ / „Aushang als PDF“, Druckliste „Herunterladen“ / „Teilen …“,
  Rundmail „Vorschau“ / „Senden …“, „Gibt es schon“ „Zurück“ / „Trotzdem neu anlegen“. „Baustein entfernen“ in den
  Preis-Fenstern bleibt getrennt im Inhalt.
- **Während etwas gespeichert, gesendet oder freigegeben wird**, sind X und „Abbrechen“ gesperrt.
- „Heruntergeladen“ in der Druckliste steht jetzt über den Knöpfen statt zwischen ihnen.

### Intern (E6-O F4)

- `anmeldungen/src` ist aus der Ausnahmeliste von `ui/fenster/fensterAufbau.test.ts` heraus – übrig sind Organigramm
  und Protokolle (F5).
- Neu: `FensterLink` (`ui/fenster/FensterKnopf`) – derselbe Knopf als Link, für „Im Mailprogramm öffnen“ (`mailto:`).
- Neuer Test-Helfer `ui/fenster/fenster.testutil.ts` (`knopfFolge`, `fensterKnoepfe`); er ersetzt 19 gleichlautende
  Kopien in den Tests von Dienstplaner und Musik-App.
- Entfernt: `.knoepfe` und `.gefahrKnopf` (Anmeldungen) – die Rückfragen reichen ihre Knöpfe als `FrageKnoepfe` bzw.
  `MailKnoepfe` an das Fenster.

### Behoben (Anmeldungen)

- **Kopie einer älteren Veranstaltung nahm keine Anmeldungen an** – „Wie eine frühere Veranstaltung“ übernahm den
  Bestätigungsmodus der Vorlage. Stand der auf „alle bestätigen“ (ältere Veranstaltungen), scheiterte das Formular schon
  beim ersten Schritt mit „PersonId or eMail must be present“. Der Modus „Unbekannte ohne Bestätigungsmail“ wird jetzt
  beim Anlegen, beim Kopieren und beim Freigeben gesetzt – eine Stelle (`ohneBestaetigungsmail`), jedes Mal
  nachgelesen. Das Freigeben repariert damit auch Kopien, die schon so entstanden sind. Gefunden bei der echten Prüfung
  von A9-1 (24.10.2026).

### Neu (Anmeldungen, A9-1)

- **Bestätigungsmails über ChurchTools** – beim Freigeben richtet die Erweiterung zwei Abläufe (Routinen) ein: „Platz“
  schickt nach dem Anmelden und beim Nachrücken eine Bestätigung mit Termin, Anmelde-Nr., Betrag, Bankdaten und dem
  Link zu „Deine Anmeldung“; „Warteliste“ nennt den Platz auf der Warteliste. Die Standard-Mail von ChurchTools geht
  danach aus. Absender ist, wer freigibt (wenn Leitung), sonst die erste gewählte Leitung. Gemessen 24.10.2026
  (`messung-a9-2026-10-24.md`), Entwurf `a9-ablaeufe-v1`.
- Betrag und Bankdaten stehen nur in der Mail zur ersten Person einer Anmeldung (dort liegt der Betrag), die Anrede an
  den Kontakt ebenso; Anmeldungen durchs Team bekommen die Bestätigung auch – ohne Link (Alwin, 24.10.2026).
- Neues Systemfeld **„Link zur Anmeldung“**: Das Formular schreibt beim Anmelden den Link mit dem Schlüssel der Person
  hinein (`abmeldeLink`) – die Routine-Mail kennt keinen Platzhalter für den Abmelde-Schlüssel.
- Karte **„Mails“** im Reiter „Veranstaltung“ (nur ansehen): eingerichtet, noch nicht eingerichtet (Standard-Mail), im
  Entwurf „wird beim Freigeben eingerichtet“.
- Fehlt das Recht „Routinen verwalten“, wird trotzdem freigegeben; die Meldung sagt, dass ChurchTools seine
  Standard-Mail schickt. Eine eigene Routine aus ChurchTools an derselben Stelle fasst die Erweiterung nicht an.
- „Rückgängig“ nach dem Absagen sagt jetzt, dass ChurchTools beim Wiedereintragen die Bestätigung noch einmal schickt;
  nach dem Rückgängigmachen verschwindet der Satz.
- Die Fenster „Nachrücken“, „Von Hand“ und „Zurückholen“ sagen, was ChurchTools schickt – mit eingerichteten Mails die
  Bestätigung, sonst wie bisher (`mailHinweis`, eine Stelle). Gefunden bei der echten Prüfung in der Test-Instanz.

### Intern (Anmeldungen, A9-1)

- `shared/anmeldung/ablaeufe.ts` baut die Mails (eine Stelle), `anmeldungen/src/ablaeufe.ts` schreibt und liest nach.
- Bankdaten-Zeilen an einer Stelle (`bankZeilen`) – Bescheid nach dem Nachrücken, Rundmail und Bestätigung nutzen
  dieselbe; `htmlSicher` aus der Rundmail für alle.

### Neu (Protokolle, S4-2)

- **Aufgaben im Protokoll sind To-Dos** (Alwin 24.10.2026): Eine Aufgabe mit Text wird beim Speichern sofort zum
  To-Do in „Mitarbeit“ – die Zuständigen sehen sie gleich unter „Meine offenen To-Dos“, auch solange das Protokoll
  Entwurf ist. **Das Protokoll führt:** Text ändern zieht ins To-Do mit; Aufgabe löschen vermerkt das To-Do als
  gelöscht (nie hart, mit Verlauf), „Rückgängig“ holt es mit Wer/Bis/Status zurück.
- An der Aufgabe wie in Entwurf 7: **Status-Kreis** vorne (offen → in Arbeit → erledigt), Schildchen **„Wer?“** (Häkchen
  je Gruppenmitglied + externer Name, z. B. „Hausmeister Müller“) und **„Bis“** (Datum, überfällig rot). Geändert wird
  direkt das To-Do, nicht das Protokoll.
- **Beschluss** und **Termin** (mit Datum-Schildchen, nur im Protokoll) als eigene Blöcke; Aufgabe, Beschluss und
  Termin haben Knöpfe in der Werkzeugleiste und Einträge im „/“-Menü. **„[] “ + Leertaste macht eine Aufgabe** (die
  einfache Checkliste gibt es weiter über Textart und „/“-Menü).

### Intern (Protokolle, S4-2)

- Regeln `aufgabenAbgleich`, `aufgabenIdsVergeben`, `alsWiederhergestellt` in `shared/protokolle/aufgaben.ts`;
  `protokolle/src/aufgabenSchreiben.ts` (frisch lesen, auf diesem Stand planen, schreiben, nachlesen) – auch
  `ladeAufgaben` liest jetzt darüber. Der Abgleich läuft beim Speichern **nach** der Sperr-Prüfung und **vor** dem
  ersten Schreiben am Protokoll: ein Fenster ohne Sperre fasst die To-Dos nie an.
- Aufgaben-IDs werden außerhalb des Rückgängig-Verlaufs vergeben (sonst nahm „Rückgängig“ die ID weg und das To-Do
  wäre als gelöscht vermerkt worden – beim Durchklicken gefunden, Test gegen den echten Editor).
- `ladeGruppenMitglieder` (nur aktive Mitglieder; `mitgliederAus` liefert die Angefragten mit – Test).
- Neue Symbole `kreis`, `kreis-halb`, `kreis-haken`, `aufgabe`, `stempel`; Baustein `StatusKreis`.

### Neu (Protokolle, S4-1)

- **Protokolle schreiben** (Bauplan S4-1, Entwurf 7). Öffnet die Leitung ein Protokoll im Entwurf, steht sie gleich im
  Editor (BlockNote 0.56, fest gepinnt): Text, Tagesordnungspunkt (Überschrift 1, nummeriert) und Überschrift 2/3,
  Aufzählung, Nummerierung, Checkliste, Zitat, Trennlinie, Einrücken beliebig tief (Tab/Umschalt+Tab), „/“-Menü,
  Kürzel wie „- “, Griffe zum Verschieben (nicht an normalem Text). Feste **Werkzeugleiste** oben – am Handy waagrecht
  wischbar – mit Rückgängig, Textart, fett/kursiv/unterstrichen/durchgestrichen, Markieren, Formatierung entfernen,
  Listen, Ein-/Ausrücken, Zitat, Trennlinie. Die Bereiche Beschlüsse · To-Dos · Termine darunter folgen dem Text live.
  Der Editor wird erst geladen, wenn jemand schreibt – wer nur liest, lädt ihn nie.
- **Automatisch speichern** (Alwin 24.10.2026): drei Sekunden nach der letzten Eingabe, oben „gespeichert 19:42“;
  scheitert es (Netz, ChurchTools), bleibt der Text im Editor, „nicht gespeichert – wird erneut versucht“, neuer Versuch
  nach zehn Sekunden. Gespeichert wird als Kopf + gepackte Teile in der Reihenfolge „neue Teile → nachlesen → Kopf →
  nachlesen → alte Teile löschen“; vor jedem Schritt wird frisch gelesen, nach jedem nachgelesen.
- **Schreibsperre** („Johann schreibt gerade“): entsteht mit der ersten Änderung – wer nur reinschaut, blockiert
  niemanden. Wer währenddessen öffnet, liest den gespeicherten Stand mit (alle 30 Sekunden) und kann das Schreiben mit
  Rückfrage **übernehmen**; das andere Fenster hört beim nächsten Speichern auf und behält seinen ungespeicherten Rest
  sichtbar. Dieselbe Person in zwei Fenstern oder auf zwei Geräten sperrt sich ebenso („Du schreibst gerade in einem
  anderen Fenster“). Hat inzwischen jemand anderes gespeichert, überschreibt das Fenster nichts, sondern bietet „Aktuellen
  Stand laden“ an. Verlassen mit Ungespeichertem fragt nach.
- **Einfügen aus Word:** Aufzählungen und Nummerierungen aus Word kommen als echte, verschachtelte Listen an (vorher
  Absätze mit „·“).
- **Markieren** und **Trennlinie** erscheinen auch in der Lese-Ansicht (neuer Wert `--markiert`); ein Test hält fest,
  dass die Lese-Ansicht jede Blockart zeigt, die der Editor kennt.

### Intern (Protokolle, S4-1)

- `protokolle/src/schreiben.ts` (Sperre nehmen, speichern, übernehmen, freigeben), `schreibSteuerung.ts` (Zeitregeln,
  mit Fake-Timern getestet), Regeln `schreibLage`, `sitzungAusWerten`, `sperreVon`, `wertInhalt` in
  `shared/protokolle/speicher.ts`; die Sperre trägt jetzt eine Fenster-Kennung. `dokumentAusTeilen` zählt einen doppelt
  liegenden Teil desselben Stands nur einmal. `fremdeTypen`: Protokolle mit Blöcken, die der Editor nicht kennt, öffnen
  nur zum Lesen, damit nichts verloren geht.
- Die Bereiche (Beschlüsse · To-Dos · Termine) sind ein gemeinsamer Baustein `Bereiche.tsx` für Ansicht und Editor.
- `modulRechteAus` liegt jetzt in `shared/ct/modulRechte.ts` (vorher im Dienstplaner) – die Protokolle lesen damit, wer
  schreiben darf.
- Pack-Prüfung der Erweiterungen herausgelöst nach `scripts/globaleCss.mjs` und getestet: Selektoren mit Klasse/ID gelten
  wie in `cssBereich.ts` als unbedenklich, Kommas in `:is(…)` teilen nicht mehr (vorher ~260 Fehlalarme durch
  BlockNote/Mantine).
- Neue Linien-Symbole für die Werkzeugleiste (`liste`, `nummern`, `zitat`, `trennlinie`, `einruecken`, `ausruecken`,
  `format-weg`).

### Geändert (Musik-App, E6-O F3)

- **Alle Fenster der Musik-App im ChurchTools-Aufbau** (#726): Titel links, **X rechts**, Knöpfe **rechts unten**, am
  Handy untereinander mit dem Hauptknopf oben. Betroffen sind 24 Fenster: Kapo, Tonart, Akkord, Abschnitte
  transponieren, Abwesenheit, Teil eines Zeitraums, PDF teilen, Notizen von …, Zum Ablauf hinzufügen, Dateien, Neues
  Lied, Lied bearbeiten, Arrangement, „Lied gibt es schon“ und alle Fenster der Verwaltung.
- **„Speichern“ steht unten** – auch bei „Lied bearbeiten“ und „Arrangement“, wo es vorher mitten im Fenster stand.
  „Zum Standard machen“ und „Löschen …“ bleiben getrennt im Inhalt.
- **Zwei Wege unten nebeneinander:** PDF „Herunterladen“ / „Teilen“, Zeitraum „löschen“ (rot) / „anpassen“, „Lied gibt
  es schon“: „Trotzdem neu anlegen“ / „… verwenden“.
- **Nach „Lied angelegt“** stehen alle nächsten Schritte unten: Fertig · Noch ein Lied · Notenblatt · Lied öffnen bzw.
  Zurück zum Eintrag.
- Speichern-Knöpfe zeigen „Wird gespeichert …“ statt eines Kreisels.

### Geändert (alle Apps, E6-O F3)

- **Passen die Knöpfe unten nicht nebeneinander, stehen sie untereinander** – auch am Rechner, der Hauptknopf oben
  (Alwin). Vorher rutschte bei drei langen Knöpfen der Hauptknopf allein in eine zweite Zeile. Gilt für alle Fenster
  und Bestätigungen, z. B. auch den Zauberstab im Dienstplaner bei vielen Vorschlägen.

### Intern (E6-O F3)

- „Links verwalten“, „Termin-Arten“ und „Termine ohne Ablauf“ zeichnen ihr Fenster selbst, damit „Speichern“ in die
  Fußzeile kann.
- Neuer Dauer-Test `ui/fenster/fensterAufbau.test.ts`: In umgezogenen Apps fällt jedes Fenster ohne `knoepfe` auf; die
  Liste der noch nicht umgezogenen Apps (Anmeldungen, Organigramm, Protokolle) muss ehrlich bleiben.
- `FensterKnopf` kann ein Symbol neben der Beschriftung zeigen. Neuer Hook `ui/fenster/useKnopfZeile` (misst die
  Knopfzeile, `data-stapel`/`data-messen` im Mixin `fensterKnopfZeile`). Entfernt: `TeilenFenster.module.scss` und die
  nachgebauten Hauptknöpfe (`.orgSave`, `.save`, `.primaryWide` u. a.).

### Neu (Organigramm, O7-4, #719)

- **Präsentation „Neue Gliederung | Heute“** für Gruppen-Admins mit einem Plan (wie im Entwurf vom 19.10.2026): Die
  Präsentation beginnt mit der neuen Gliederung – neue Gruppen und neue Namen aus dem Plan, archivierte Gruppen fehlen
  (ihre Untergruppen rücken hoch), neue Gruppen stehen als „Mitarbeitende gesucht“ da. Oben umschalten auf „Heute“;
  der Wechsel führt zur Übersicht. Ohne Plan, ohne Admin-Recht oder wenn der Plan gerade nicht lesbar ist: nur „Heute“.
- Die Kopfleiste der Präsentation bricht am Handy um, statt „Schließen“ über den Rand zu schieben.

### Intern (Organigramm)

- `planAlsBaum` (`shared/organigramm/plan.ts`): der Plan als dieselben Knoten wie heute – die Präsentation rechnet
  nichts nach.

### Neu (Organigramm, O7-3, #719)

- **Umbau** im Reiter „Neue Gliederung“ (Umschalter „Plan | Umbau · N offen“): die Schritte vom Plan nach ChurchTools –
  neue Gruppen anlegen, umhängen, umbenennen, archivieren – mit Fortschritt. **Ausführen** ändert ChurchTools sofort
  und liest nach; danach **Rückgängig** für den letzten Schritt. **Alle offenen nacheinander ausführen** (nach
  Rückfrage) liest vor jedem Schritt neu, macht auch, was erst dadurch frei wird, und hält beim ersten Fehler an.
- **Archivieren wartet**, solange in ChurchTools noch Gruppen darunter hängen (Alwin, 24.10.2026). Archivieren setzt
  den Status „archiviert“ – Mitglieder und Historie bleiben.
- Erledigt ist, was ChurchTools schon so zeigt; eine neue Gruppe, die es dort schon gibt, lässt sich **im Plan
  übernehmen**. Vom Umbau angelegte Gruppen bleiben als erledigt in der Liste – ebenso ein Umbenennen, wenn die Gruppe
  danach archiviert wurde (gefunden in der Test-Instanz).

### Intern (Organigramm)

- Messung `organigramm-planung/docs/messung-o7-3-2026-10-24.md`: Umbenennen/Archivieren per `PATCH /groups/{id}`;
  archivierte Gruppen fehlen in `GET /groups` und in der Hierarchie (eigens über `group_status_ids[]`), ChurchTools
  nimmt auch einen leeren Namen an.
- `shared/organigramm/umbau.ts` (Schritt ausführen/zurücknehmen), `obergruppenGenau` und `archivStatus` in
  `struktur.ts`, Anlegen ohne Obergruppe; `umbauSchritte` mit archivierten Gruppen als eigener Liste; der Nachbau von
  ChurchTools für Tests liegt jetzt an einer Stelle (`struktur.testutil.ts`); `ladeGruppenbaum` für Start und Umbau.

### Geändert (Musik-App, Lied-Editor L6)

- **„Einfügen“ statt „Format“** im Lied-Editor: Ein Menü mit den Teilen (Vers, Refrain, Pre-Chorus, Bridge, Intro,
  Zwischenspiel, Outro, Ende), dem **Pedal-Halt** und – abgesetzt – „Nur für andere Programme“ (Kapo, neue Spalte,
  neue Seite, Untertitel; mit dem Hinweis, dass sie in der App nichts bewirken). Ein neuer Teil kommt als Band
  **unter** die Zeile, in der der Cursor steht, mit einer leeren Zeile zum Lostippen; „Vers“ nummeriert sich selbst
  („Vers 2“), die übrigen nur, wenn es den Namen schon gibt. Titel, Interpret, Tonart, Tempo, Takt, CCLI und Copyright
  stehen im Abschnitt **Liedinfo**: Ein Tipp öffnet die Liedinfo bei genau diesem Feld (die Werte stehen in
  ChurchTools); wo es keine Liedinfo gibt, kommt die Angabe wie früher in den Text. Teile mit **eigenem Namen**
  (z. B. Tag, Instrumental) über „Eigener Name …“.
- **Ruhigerer Text:** Die Zeile `{key: …}` und die Ende-Marken `{end_of_verse}` & Co. sind im Editor ausgeblendet –
  die Tonart nennen Kopf und Akkord-Leiste, das Band markiert den Anfang jedes Teils. Im „ChordPro-Text“ sind beide
  zu sehen, gespeichert bleiben sie unverändert.

### Behoben (Musik-App, Lied-Editor L6)

- **Kapo und Untertitel einfügen:** Der Cursor stand hinter der Klammer statt davor – aus einer eingetippten „2“
  wurde `{capo: }2`. Schon im alten Format-Menü so; gefunden beim Prüfen in der Test-Instanz.

### Neu (Organigramm, O7-2, #719)

- **Reiter „Neue Gliederung“** – nur für Gruppen-Admins (Entwurf `o7-plan-v1`): **Plan anlegen** kopiert die heutige
  Gliederung; per Klick auf eine Gruppe im Plan umbenennen, woanders einhängen (Liste mit Suche, ohne Kreis), Untergruppe
  anlegen, archivieren oder eine neue Gruppe wieder herausnehmen, **Wie heute** nimmt alles zurück; **＋ Neuer Bereich**.
  Marken „neu“, „umgehängt“, „umbenannt“, „wird archiviert“ mit „vorher …“. ChurchTools selbst ändert sich nicht.
- Jede Änderung wird sofort gespeichert. Speichert ein anderer Admin gleichzeitig, wird **nichts überschrieben**: Der
  Hinweis nennt ihn, und **Nochmal auf dem neuen Stand** wendet die eigene Änderung auf seinen Stand an. Ebenso nach
  einer Zeitüberschreitung; bei fehlendem Recht auf die Kategorie sagt der Hinweis, welches Recht fehlt.
- **Plan verwerfen** (nach Rückfrage) löscht den Plan für alle.
- Eine Gruppe, die im Plan und in ChurchTools gegenläufig gehängt ist (Kreis), verschwindet nicht aus dem Plan.

### Intern (Organigramm)

- `shared/organigramm/plan.ts`: `planBaum`, `planUnterschied`, `planZiele` für die Ansicht; Demo (`?demo`) mit Speicher
  der Erweiterung, `?demo=konflikt` mit einem gleichzeitigen zweiten Admin.

### Geändert (Dienstplaner, E6-O F2)

- **Alle Fenster des Dienstplaners im ChurchTools-Aufbau** (#720): Titel links, **X rechts**, Knöpfe **rechts unten**.
  „Einteilungen senden“, „Alte Entwürfe“, „Vorlieben“ und der Zauberstab haben ihren Hauptknopf jetzt unten rechts
  neben „Abbrechen“. „Wer kann?“, belegter Platz, Entwurf und „Plätze“ haben unten nur „Schließen“.
- **Während etwas läuft** (senden, verwerfen, speichern, eintragen, Plätze ändern) sind X und „Abbrechen“ sichtbar
  gesperrt. Was gerade passiert, zeigt der Hauptknopf oder der Titel – kein „Bitte warten …“ mehr im Abbrechen-Knopf.
- **Zauberstab:** „Neu vorschlagen“ steht als Link oben neben „N Vorschläge“, unten nur noch Abbrechen und Übernehmen.
- **Vorlieben:** Die Auswahlfelder bekommen im Fokus den blauen Rand mit Schein wie alle Felder.

### Geändert (alle Apps, E6-O F2)

- **Am Handy stehen die Knöpfe unten in jedem Fenster untereinander**, über die volle Breite, der Hauptknopf oben – auch
  in allen Bestätigungen. Am Rechner bleibt alles nebeneinander rechts unten.
- Das X oben rechts heißt für Screenreader jetzt „Fenster schließen“, damit es sich vom Knopf „Schließen“ unterscheidet.

### Intern (E6-O F2)

- Neue Mixins `fensterX`, `fensterKnopfZeile` und `textKnopf` in `ui/design/_mixins.scss` statt je einer Kopie in
  `Sheet`, `ConfirmDialog` und den Fenstern; die vier nachgebauten `.primaer`-Knöpfe der Dienstplaner-Fenster sind weg.
- `Sheet` hat `beschaeftigt` (wie `ConfirmDialog`) und nimmt `knoepfe={null}` für Fenster nur zum Ansehen.

### Neu (Organigramm, O7-1, #719)

- **Plan-Kern für die „neue Gliederung“** (noch ohne Oberfläche): Der Plan speichert nur die **Änderungen gegenüber
  heute** – neue Gruppen, Umhängen, Umbenennen, Archivieren. „Plan anlegen“ ist damit eine Kopie von heute, und später
  direkt in ChurchTools angelegte Gruppen erscheinen von selbst im Plan (`shared/organigramm/plan.ts`).
- **Umbau-Schritte** aus dem Unterschied zu heute, in der Reihenfolge neu anlegen → umhängen → umbenennen → archivieren;
  „wartet auf …“, wenn etwas in eine noch nicht angelegte Gruppe soll; **erledigt**, sobald ChurchTools so aussieht wie
  der Plan (auch wenn es jemand direkt dort gemacht hat; eine neue Gruppe gilt als angelegt bei gleichem Namen unter
  derselben Obergruppe).
- Gespeichert als **ein Wert in der Kategorie „Plan“** mit Versionsnummer: Hat ein anderer Admin inzwischen gespeichert,
  wird nichts überschrieben (Konflikt); nach dem Schreiben wird nachgelesen. Gespeicherter Inhalt wird geprüft – kaputte
  Teile fallen weg, statt die Seite zu brechen.

### Intern (gemeinsam)

- Neuer Baustein `shared/ct/versionierterWert.ts`: ein Dokument im Speicher der Erweiterung mit Version, Konflikt und
  Nachlesen – nach dem Vorbild der Dienstplaner-Entwürfe. `ui/ct/modulPort.ts`: `versionPortFuer` (der Dienstplaner
  nutzt denselben Anschluss weiter als `entwurfPortFuer`).
- `untergruppenVon` (Organigramm) arbeitet mit beliebigen Schlüsseln – der Plan kennt neben ChurchTools-IDs eigene für
  neue Gruppen.

### Neu (Musik-App, Lied-Editor L4)

- **Liedinfo im Editor:** rechts umschaltbar **Vorschau | Liedinfo** (am Handy Reiter **Infos**) mit Titel,
  Interpret/Autor, Tonart, Tempo, Takt, CCLI-Nummer und Copyright – aus ChurchTools, gespeichert mit „Speichern“
  oben. Steht im Notenblatt etwas anderes, zeigt das Feld „Im Notenblatt steht: …“ mit **übernehmen**; ist das Feld
  in ChurchTools leer, wird es aus dem Notenblatt vorbelegt. Ohne Recht auf die Stammdaten nur zum Ansehen.
- **Die Kopfzeilen `{title}`, `{artist}`, `{tempo}`, `{time}`, `{ccli}`, `{copyright}` wandern beim Speichern nach
  ChurchTools** und verlassen das Notenblatt – aber erst, wenn ChurchTools den Wert nachweislich hat. Scheitert das
  Speichern in ChurchTools, wird gar nichts gespeichert. `{key}` (notierte Tonart) bleibt. Lieder, die nie im
  Editor gespeichert werden, bleiben wie sie sind. Im Text sind diese Zeilen ausgeblendet, im „ChordPro-Text“
  sichtbar. Die Vorschau zeigt das Blatt, wie es nach dem Speichern aussieht.
- **SongSelect-Import:** Leere ChurchTools-Felder werden aus dem importierten Notenblatt gefüllt (vorhandene nie
  überschrieben), danach verlassen die Kopfzeilen das Notenblatt. Klappt das Füllen nicht, kommt das Notenblatt
  trotzdem unverändert an.

### Intern (Lied-Editor L4)

- `shared/ct/liedinfo.ts` (Felder, Vergleich, `liedinfoZeilenEntfernen`, `LIEDINFO_ZEILE` – eine Grammatik für
  Entfernen und Ausblenden, `tempoAusText`), `shared/ct/liedinfoImport.ts`, `client/src/utils/liedinfoFormular.ts`
  (auf den Formularen des Stammdaten-Blatts), `useLiedinfoQuelle`. `metaWerte` liest alle Zeilen eines Felds
  (SongSelect bringt zwei `{artist}`).

### Geändert (alle Apps, E6-O F1)

- **Fenster wie ChurchTools, erster Schritt** (#716, Entwurf `fenster-entwurf.html`, abgenommen 23.10.2026). Der
  gemeinsame Fenster-Baustein kann jetzt den Aufbau der ChurchTools-Fenster: Titel links, **X rechts**, Knöpfe **rechts
  unten** („Abbrechen“ mit Rahmen, daneben der blaue Hauptknopf). Die Fenster ziehen App für App um; als erstes
  **„Ablauf anlegen“** (Musik-App und Dienstplaner).
- **Alle Bestätigungen** (Löschen, Ersetzen, Teilen …) stehen schon im neuen Aufbau: Text linksbündig, X oben rechts,
  Knöpfe rechts unten. Beim geteilten Ablauf stehen die drei Wege nebeneinander, am Handy untereinander.
- **Eingabefelder** bekommen beim Antippen zum blauen Rand einen hellblauen Schein, in allen Apps.
- Neuer Baustein `ui/fenster/FensterKnopf` – die eine Bauart der Knöpfe unten im Fenster.

### Neu (Protokolle, S3-4b)

- **Suche mit der Lupe** (Alwin, 23.10.2026): oben rechts im Kopf; ein Tipp klappt die Suchleiste neben den Reitern
  aus, ist es zu schmal (Handy), bekommt sie eine eigene Zeile. ✕ oder Esc schließt sie wieder, ein Reiter auch.
- **Eine Suche für alles:** Beschlüsse, To-Dos, Termine und Protokolltext aller Gruppen, filterbar nach Art und Gruppe;
  die Fundstellen sind markiert. **Ohne Suchbegriff stehen dort alle Beschlüsse** – die Beschluss-Übersicht über alle
  Sitzungen. Beschlüsse, Termine und Text kommen nur aus freigegebenen Protokollen, To-Dos aus allen.
- **Ein Treffer öffnet seine Sitzung und springt zum Tagesordnungspunkt**, der kurz hervorgehoben wird.

### Behoben (Protokolle)

- Ein Sprung von der Startseite in eine Sitzung ging verloren, wenn die Sitzungen zweimal kurz hintereinander geladen
  wurden (React-Prüfmodus, „Erneut versuchen“): Jedes Laden merkt sich sein Ziel jetzt selbst.

### Intern (Protokolle)

- `statusText()` in `shared/protokolle/aufgaben.ts` ist die eine Stelle für „in Arbeit“ – vorher stand der Text an
  drei Stellen (Protokoll, Sitzung, Startseite) und wäre mit der Suche die vierte geworden.

### Neu (Organigramm, O6, #709)

- **Leitung und Mitglieder pflegen** im Gruppenfenster – für alle, die es in ChurchTools dürfen: global (Gruppen-Admin,
  „Mitgliedschaften bearbeiten“ für die Gruppe oder ihren Typ) ODER mit der eigenen Rolle in der Gruppe
  (`/permissions/internal/groups/{id}`). Gemessen: Leitungen dürfen aufnehmen und Rollen ändern, aber nicht austragen –
  dann fehlt bei ihnen „Austragen“.
- **＋ Person aufnehmen**: Suche wie bei den Anmeldungen (nur bestehende Personen), „schon dabei“ gesperrt, Rolle =
  Standardrolle des Gruppentyps, wählbar.
- An jeder Person **Rolle** (nur Rollen des Gruppentyps, ohne versteckte; bei einer Leitungsrolle ein Hinweis auf die
  Rechte) und **Austragen** = Mitgliedschaft **beenden** (Enddatum heute), nicht löschen – die Historie in ChurchTools
  bleibt (Alwin, 23.10.2026).
- Nach jedem Schreiben wird nachgelesen; danach lädt nur diese Gruppe neu. **Rückgängig im Fenster**: Aufnehmen wird
  gelöscht (war die Person nie dabei) bzw. der alte Stand zurückgesetzt, Rolle zurück, Enddatum wieder leer.
- Rechte je Gruppe nicht ladbar → Knöpfe bleiben zu, ein Hinweis sagt es.

### Intern (gemeinsam)

- Personensuche (`personenSuchen`, `personenRoh`) aus den Anmeldungen nach `ui/ct/personen.ts` gezogen – EINE Suche für
  alle Erweiterungen; die Anmeldungen leiten weiter, ihre Oberfläche bleibt gleich.
- Rollen tragen jetzt Gruppentyp, Standard und versteckt (`rollenFuerTyp`, `standardRolle`).

### Intern (Protokolle, S3-4a)

- **Such-Kern für die globale Suche** (`shared/protokolle/suche.ts`, noch ohne Oberfläche): ein Index über
  Beschlüsse, Termine und Protokolltext aus **freigegebenen** Protokollen und über die To-Dos **aller** Protokolle
  (gelöschte nie), je mit Gruppe, Sitzung und Tagesordnungspunkt aus derselben Ableitung wie im Protokoll. Suchen
  nach Art und Gruppe, alle Wörter müssen vorkommen (auch im Punkt und im Sitzungstitel); ohne Suchbegriff die
  Beschlüsse. Dazu die Fundstellen zum Hervorheben.
- `dokumentDerSitzung()` in `shared/protokolle/speicher.ts` ist die eine Stelle für „ein geplantes Protokoll hat noch
  kein Dokument“ – vorher stand die Regel in der Ansicht, jetzt nutzen Ansicht und Suche dieselbe.

### Geändert (Musik-App + Dienstplaner, E6-O1, #710)

- **Der Ablauf sieht aus wie in der ChurchTools-App** (Entwurf `e6-optik-entwurf.html`, abgenommen 23.10.2026):
  - Liste mit feinen Linien statt Karten.
  - Uhrzeit fett, **Dauer klein darunter**; Titel fett, die Zuständigen grau darunter.
  - Rechts **Fotos oder Kürzel**, ab drei Personen „+N“.
  - Überschriften und **„Beginn“ als graue Balken**.
  - Lieder mit blauem Streifen und einer **Lied-Karte** (Liedname, Tonart · Tempo · Autor). Heißt der Punkt wie sein
    Lied, steht der Name nur einmal.
- Das Bearbeiten zeigt dieselbe Zeile: Griff links, Uhrzeit und Dauer wie in der Ansicht, rechts nur der Stift.
- Fotos und Kürzel kommen mit dem Ablauf, es gibt keine Abfrage je Person (gemessen E6-O0).
- Den Autor holt der Dienstplaner mit **einer** Sammelabfrage je Ablauf. Die Musik-App hat ihn schon.

### Behoben (Musik-App + Dienstplaner)

- **Weggelassene Punkte** standen im Bearbeiten nicht blass da. Ein fester Wert der Zieh-Bibliothek überschrieb das
  Blass-Machen, seit E6-3b.

### Geändert (Musik-App, Lied-Editor L5)

- **Mehr Platz beim Schreiben am iPad und Handy** (Alwin: „das Bearbeitungsfenster ist bei aufgeklappter Tastatur
  deutlich zu klein“): Solange im Liedtext getippt wird und die Bildschirmtastatur offen ist, verschwinden Ablauf,
  Fassung und „ChordPro-Text“; Format, die Akkorde der Tonart, **Im Lied** (als Ausklappmenü, darin auch „Anderer
  Akkord“) und Rückgängig stehen in einer Zeile. Tastatur zu → alles wie vorher. Eine angesteckte Hardware-Tastatur
  löst das nicht aus. Die Ansicht greift auch, wenn iOS das Fenster mit der Tastatur verkleinert, und springt nicht
  zurück, wenn ein Knopf dem Text kurz den Fokus nimmt.

### Behoben (Musik-App, Lied-Editor L5)

- **Das Menü eines Akkord-Kärtchens lag unter der Tastatur**, wenn das Kärtchen weit unten stand – es klappt jetzt
  über das Kärtchen.

### Geändert (Musik-App, Lied-Editor L5)

- **Akkord-Kärtchen antippen:** Ein Tipp auf einen Akkord im Text öffnet ein kleines Menü – **‹ ›** schieben ihn
  Buchstabe für Buchstabe (über einen Nachbar-Akkord springt er ganz hinweg, nicht über den Zeilenrand),
  **Ändern** öffnet das Akkord-Fenster mit diesem Akkord, **Entfernen** nimmt ihn heraus. Das Kärtchen ist dabei
  umrahmt. Solange das Menü offen ist, ersetzt ein Akkord aus der Leiste (oder „Anderer Akkord“) das Kärtchen.

### Geändert (Musik-App, Lied-Editor L5)

- **Akkorde einfügen ohne Menü:** Unter der Werkzeugleiste stehen die Akkorde der Tonart (in E: E, F#m, G#m, A,
  B, C#m) und unter **Im Lied** die übrigen, die das Lied schon benutzt – ein Tipp setzt den Akkord an die
  Cursorstelle. **Gedrückt halten** zeigt Varianten desselben Grundtons (Em7, Esus4 …). **Anderer Akkord**
  öffnet ein Fenster zum Eintippen (`em7`, `d/f#`, deutsches H) oder Zusammenstellen mit Vorschau; eingefügt
  wird einmal, fertig. Das Menü „Akkord ▾“, das Art und Bass an den zuletzt gesetzten Akkord anhängte, ist weg.

### Neu (Anmeldungen, A8-4)

- **QR-Code und Aushang** – vierter Knopf „QR-Code“ in der Karte „Anmeldelink“ (Alwin, 23.10.2026): QR-Code zum Link,
  „QR-Code als Bild“ (PNG zum Teilen) und „Aushang als PDF“ (A4: Gemeinde, Titel, Termin, QR-Code, Link,
  Anmeldeschluss in Ortszeit). Gegenprobe: Der QR-Code auf dem gerenderten Aushang wird vom QR-Leser von macOS als
  genau dieser Link gelesen.
- Neuer Baustein `ui/teilen/qr.ts` (Muster über `qrcode-generator`, MIT, ohne weitere Abhängigkeiten; gezeichnet als
  SVG, PNG und direkt ins PDF).
- Die Terminzeile („Sa, 21.11.2026 · Gemeindehaus“) liegt jetzt in `shared/anmeldung/termin.ts` – Formular und Aushang
  nutzen dieselbe; die eigene Datumsfunktion des Formulars (Kopie von `datumText`) ist weg.

### Geändert (Musik-App, Lied-Editor L3)

- **Der Text im Editor ohne Klammern:** Akkorde stehen als blaue Kärtchen im Text, jeder Teil beginnt mit einem
  Band („VERS“, „CHORUS“ – mit „2× im Ablauf“, sobald es einen Ablauf gibt), der Weiterschalt-Punkt `----` ist
  die Linie „Pedal hält hier“. Ein Kärtchen ist eins: Die Rücktaste löscht den ganzen Akkord, der Cursor springt
  darüber. **ChordPro-Text** zeigt den rohen Text wie bisher. Gespeichert wird weiter derselbe Text, Zeichen für
  Zeichen. Die Angaben oben (`{title}` …) bleiben sichtbar, bis die Liedinfo sie übernimmt.
- **Ablauf-Karte am iPad eingeklappt** (Alwin: mit Tastatur blieb für den Text zu wenig Platz): eine Zeile mit
  „Wie im Text“ oder der Marke **Eigener Ablauf** und der Reihenfolge; **Bearbeiten** klappt auf, **Fertig** zu.
  Am Handy bleibt der eigene Reiter.

### Behoben (Musik-App, Lied-Editor)

- **Ablauf-Kärtchen verziehen sich beim Ziehen nicht mehr** – verschieden breite Kärtchen wurden auf die Größe
  des Nachbarn gestreckt.

### Neu (Protokolle, S3-3)

- **Startseite** (Entwurf 7): links **„Heute“** – steht heute eine Sitzung an, mit Uhrzeit, „2 von 3 zugesagt“ und
  „Sitzung öffnen“ – und **„Meine offenen To-Dos“** über alle Gruppen (mir zugewiesen, nicht erledigt; überfällig
  zuerst und rot, dann in Arbeit, dann offen). Rechts **„Nächste Sitzungen“** über alle Gruppen, früheste zuerst, mit
  der eigenen Antwort auf die Besprechungsanfrage („du hast zugesagt“, „noch nicht beantwortet“), und **„Deine
  Gruppen“** mit der Zahl offener To-Dos. Am Handy eine Spalte.
- **Von der Startseite in die Sitzung:** Ein Tipp auf eine Sitzung oder ein To-Do öffnet den Reiter „Sitzungen“ mit
  der Gruppe und gleich der Sitzung; ein Tipp auf eine Gruppe öffnet ihre Liste. Wer danach über die Reiter wechselt,
  landet wieder in der normalen Liste.
- Scheitert das Laden der Übersicht vorübergehend, gibt es „Erneut versuchen“ – nicht „Nichts offen“.

### Intern (Protokolle)

- `offene()` in `shared/protokolle/aufgaben.ts` ist die eine Regel für „offen“ (nicht erledigt, nicht gelöscht);
  „Meine offenen“ und der Zähler je Gruppe nutzen sie. Die Antworten der Besprechungsanfragen (`accepted`,
  `declined`, `pending`, `tentative` laut OpenAPI der Instanz) liest der Lese-Kern jetzt mit (`ladeUebersicht`).

### Neu (Anmeldungen, A8-3)

- **Druckliste „Zahlungen“** (vorn, wenn die Veranstaltung etwas kostet): je Zahlung eine Zeile – die der Anmeldung und
  die eigenen (nachgerückt, dazu angemeldet, zurückgeholt) –, Betrag, bezahlt mit Tag und Zahlart oder „offen“, wer nur
  wartet „wartet“ (ohne Betrag leer, wie im Reiter). Unten: zusammen, da, offen – dieselbe Rechnung wie oben im Reiter.
- Der Titel einer Zahlung („Anmeldung (Maria)“, „Lena – nachgerückt“) kommt jetzt für Fenster und Druckliste aus
  `zahlungTitel` (`shared/anmeldung/zahlung.ts`) statt aus dem Reiter.

### Neu (Organigramm, O5, #694)

- **Gruppen umhängen und anlegen** im Gruppenfenster – für alle, die es in ChurchTools dürfen (Gruppen-Admin, oder
  „Gruppe bearbeiten“ für die Gruppe bzw. ihren Typ; Anlegen nur in freigegebenen Typen). Leitungen dürfen das in
  ChurchTools nicht und sehen keine Knöpfe.
- Unter „Gehört zu“: **Ändern** (Obergruppe ersetzen), **Lösen** (bei der letzten wird die Gruppe ein eigener Bereich)
  und **＋ Weitere Obergruppe**; das Ziel kommt aus einer Liste mit Suche und Pfad („Gottesdienst › Technik“). Die Gruppe
  selbst, ihre Untergruppen (das wäre ein Kreis) und ihre jetzigen Obergruppen stehen nicht zur Wahl.
- Vor jeder Änderung sagt das Fenster, was sich an den Rechten ändert (Rechte wirken in ChurchTools nach unten).
- **＋ Untergruppe anlegen** mit Name und Gruppentyp (vorbelegt mit dem Typ der Obergruppe); Status „aktiv“ über den
  internen Namen aus `/person/masterdata`, nicht über eine feste Zahl.
- Umhängen schreibt erst die neue Obergruppe, dann löst es die alte – die Gruppe hängt nie unter keiner. „Bereits
  gesetzt“ (400) zählt als erledigt. **Nach jedem Schreiben wird nachgelesen**; stimmt der Stand nicht, sagt das
  Fenster genau das. Danach lädt der Baum neu (Mitglieder nur für neue Gruppen); lädt er gerade nicht, bleibt der
  bisherige Stand stehen und das Fenster sagt es.
- **Rückgängig im Fenster** für jede Änderung (auch: neue Gruppe wieder löschen).
- Bei der Abnahme in der Test-Instanz (23.10.2026, leere Übungsgruppen) gefunden und behoben: Ohne Obergruppe heißt es
  „unter …“ / „Einhängen“ statt „zusätzlich“ / „auch“; liegt die neue Obergruppe unter der alten (oder bleibt eine
  darunter), sagt das Fenster „sieht es weiterhin“ statt „sieht es nicht mehr“ (`weiterSichtbarUeber`). „Eigener
  Bereich“ zählt jetzt alle Obergruppen, auch die, die man nicht sehen darf.

### Intern (gemeinsam)

- „Rückgängig im Fenster“ (`RueckgaengigImFenster`) samt Ablauf (`useAenderungZurueck`) aus den Anmeldungen nach
  `ui/fenster/` gezogen – EINE Umsetzung für alle Erweiterungen; die Leiste unten bleibt in den Anmeldungen.
- `ladeMitglieder`: Nachladen bestimmter Gruppen an einer Stelle (`fehlendeNachladen`, neu `neueGruppenNachladen`).

### Behoben (Dienstplaner)

- **Weitere Termine laden, wenn es scheitert:** Im ersten Bild mit „Erneut versuchen“ stand der Knopf noch auf „wird
  geladen …“ und gesperrt – in „Planen“ das ＋ samt „weitere Termine werden geladen …“, in „Termine“ „Weitere Termine
  laden“. Ein Effekt räumte den Ladezustand erst ein Bild später weg. Jetzt ist er mit der Antwort (oder dem Fehler)
  schon in diesem Bild vorbei. Gefunden, weil ein Test genau dieses eine Bild unter Last mal sah und mal nicht; die
  Tests prüfen es jetzt in jedem Commit (React-`Profiler`) und sind damit nicht mehr vom Zufall abhängig.

### Intern

- **Staging baut nur noch auf Zuruf – auch `main`** (Alwin, 23.10.2026): Merges anderer Sitzungen nach `main`
  hatten zweimal an einem Nachmittag den Stand überschrieben, den Alwin gerade am iPad prüfte. Bauen:
  `gh workflow run staging.yml --ref <zweig>` (vor einem Release `--ref main`). Doku nachgezogen, darunter zwei
  Stellen, die noch den Stand vor dem 22.10. beschrieben.

### Neu (Anmeldungen, A8-2)

- **Weitere Drucklisten: Küche & Allergien, Zimmer, Abholliste.** Vorn stehen die Listen, die zum Formular passen
  (Küche bei „Allergien & Essen“, Zimmer bei einer Auswahl im Preis – benannt wie die Auswahl –, Abholliste bei
  „Erziehungsberechtigte“); „＋ weitere“ öffnet die übrigen, mit Hinweis und leerer Spalte zum Ausfüllen von Hand.
  Küche: Zahlen oben (Personen, Kinder unter 12 / unter 3), darunter nur, wer einen Hinweis hat. Zimmer: je Option die
  Anmeldungen. Abholliste: je Kind die Erziehungsberechtigten mit Telefon und „Abgeholt von / Uhrzeit“.
- Leere Liste (niemand mit Hinweis, alle auf der Warteliste): ein Satz statt einer leeren Tabelle (echter Test
  23.10.2026).
- Teilnehmer, Küche und Abholliste teilen sich eine Zeilen-Regel (Platz, Warteliste, Summe); `listenPdf` kann eine fette
  Zeile über der Tabelle (`oben`, nur Seite 1).

### Neu (Anmeldungen, A8-1)

- **Druckliste: Teilnehmer als PDF** (Entwurf `a8-druckliste-v1`, abgenommen 23.10.2026). Knopf „⎙ Druckliste“ im
  Reiter „Anmeldungen“: Spalten aus den Fragen des Formulars, Sortierung (Nachname, Alter, Anmeldung), Warteliste
  zuschaltbar, Vorschau im Fenster, „Teilen …“ und „Herunterladen“. Kopf mit Gemeinde · Veranstaltung · Liste, Fuß mit
  Stand und „Seite x von y“ auf jeder Seite; der Tabellenkopf wiederholt sich, ab sechs Spalten quer. Die Wahl der
  Spalten merkt sich die Veranstaltung (neues, freiwilliges Feld `druck` in den Einstellungen).
- Neuer Baustein `ui/teilen/listenPdf.ts` für Listen als PDF (jsPDF wird erst beim Öffnen geladen); die Antwort als Text
  (`antwortText`) teilen sich jetzt das Fenster einer Anmeldung und die Druckliste.

### Neu (Protokolle, S3-2)

- **Reiter „Sitzungen“** (Entwurf 7): je Gruppe **Kommend** (Termine mit Besprechungsanfrage, Gruppentreffen,
  begonnene Protokolle) und **Protokolle** (freigegeben, neueste zuerst), bei mehreren Gruppen oben umschaltbar.
  Hinweise, wenn kein Kalender gewählt ist oder ChurchTools die Gruppentreffen nicht zeigt.
- **Eine Sitzung ansehen:** das Protokoll als Dokument in einer **eigenen, schlanken Darstellung** (Alwin,
  23.10.2026) – nummerierte Tagesordnungspunkte, Formatierung, verschachtelte Listen, Zitate, Links (nur Web- und
  Mail-Adressen), Aufgaben mit Stand und Frist aus „Mitarbeit“, Beschlüsse, Termine; unbekannte Blöcke zeigen ihren
  Text. Darunter die Bereiche **Beschlüsse · To-Dos · Termine** aus derselben Ableitung wie das Dokument. Ist ein
  Protokoll gerade nicht vollständig lesbar, steht das da statt eines halben Dokuments.

### Geändert (gemeinsam)

- **Listen in ChurchTools mit Punkten und Nummern:** ChurchTools (Tailwind) nimmt `ul`/`ol` ihre Zeichen – im
  Protokoll fehlten so die Aufzählungszeichen (nur in ChurchTools sichtbar, nicht in der Demo). Die Regel steht jetzt
  einmal als `listenMitZeichen` in `ui/design/_mixins.scss`; die zwei Einzelstellen der Anmeldungen nutzen sie mit.
  Die Hauptknöpfe der Protokolle-Fenster nutzen den vorhandenen `hauptKnopfBreit` statt einer eigenen Kopie.

### Neu (Protokolle, S3-1)

- **Lese-Kern ohne Oberfläche** (`protokolle/src/lesen.ts`, Regel `shared/protokolle/sitzungen.ts`): die Sitzungen
  einer Gruppe aus Protokoll-Köpfen, Terminen im Kalender der Gruppe und Gruppentreffen – „Kommend“ (alles noch
  nicht Freigegebene) und „Protokolle“ (freigegeben, neueste zuerst). **Nur Termine mit Besprechungsanfrage**
  (Alwin, 23.10.2026); ChurchTools zeigt das nur je Termin (`…/meetingrequests`, gemessen – auch Mitglieder dürfen
  es lesen). Termin und Treffen zur selben Minute sind eine Sitzung. Darf jemand die Gruppentreffen nicht sehen
  (403, je nach Gruppentyp), fehlen nur die Treffen, und das wird gemeldet. Dazu die Aufgaben einer Gruppe (ohne
  gelöschte) und Prüfer für Kopf und Teil (`istKopf`, `istTeil`). Gegen die Test-Instanz mit Test-Protokollen im
  echten Speicherformat geprüft. Die Oberfläche folgt mit S3-2.

### Geändert (Protokolle, S2-4)

- **„Deine Gruppen“ zeigt nur noch Gruppen, deren Protokolle man sehen darf** (Alwin, 22.10.2026). Vorher sah ein
  Mitglied ohne Zugriff seine eingerichtete Gruppe als „nicht eingerichtet“ – die Erweiterung kann die beiden Fälle
  nicht unterscheiden. Darunter steht jetzt immer: „Fehlt eine Gruppe? Ein Admin richtet sie ein oder gibt dir
  Zugriff.“ Den Stand aller Gruppen sehen Admins in der Verwaltung.
- Prüfung mit drei Rollen in der Test-Instanz (Admin, Leitung, Mitglied per „Benutzer simulieren“, dazu „Kein
  Zugriff“ und versteckte Gruppe), jeweils über die Schnittstelle gegengeprüft: Ein Mitglied ohne Recht liest das
  Protokoll nicht (401), Herabstufen wirkt sofort, „versteckte Gruppe sehen“ kommt und geht mit dem Zugriff.
  Anleitung `docs/betrieb/PROTOKOLLE.md` auf Stand S2 gebracht.

### Behoben (Musik-App)

- **Symbole im Lied-Menü und in Hinweisen** (Alwin am iPad: „Bearbeiten“-Symbol kaputt): Statt Behelfszeichen
  und Emoji (🖉 ⤴ 📎 ⚠️ 📴 📅 🎵 …), die je Gerät anders oder gar nicht dargestellt werden, stehen überall die
  Symbole aus `ui/icons` – Menü, Dateien-Liste, Links, Hinweis-Seiten, Ablauf-Liste, Fehlermeldungen am Blatt.

### Intern

- Neue Dauerprüfung `ui/design/keineBehelfszeichen.test.ts`: findet Behelfszeichen/Emoji im Oberflächen-Code.
  Gemeinsamer Datei-Sammler `ui/design/quelltexte.testutil.ts` (auch von `festeWerte.test.ts` genutzt).

### Neu (Organigramm, O4, #683)

- **Präsentation** (z. B. Mitgliederversammlung), wie im Entwurf am 19.10.2026 abgenommen: Knopf „Präsentieren“
  über dem Baum – für alle, im Rahmen ihrer ChurchTools-Rechte, sobald die Mitglieder geladen sind.
- **Übersicht:** die Bereiche als Kacheln in derselben Reihenfolge wie der Baum (`bereicheSortiert`, eine Regel für
  beide), mit Leitung samt Bild, Gruppen und Zahl der Personen.
- **Bereich:** seine Gruppen als Spalten; jede Spalte listet jede Person ihres Teilbaums einmal (Leitung zuerst, mit
  Rolle), die Untergruppen aufklappbar mit Pfad. Ein Bereich ohne Untergruppen ist selbst die Spalte.
- **Ehrlich bei fehlenden Rechten:** „Mitarbeitende gesucht“ / „Leitung wird noch gesucht“ nur, wo man die Gruppe
  samt Untergruppen sehen darf – sonst „Mitglieder nicht sichtbar“.
- Liegt über der Leiste von ChurchTools; „Vollbild“ (Browser) nur, wo es das gibt (Laptop am Beamer, nicht iPad).
  Tasten: Pfeile, Bild auf/ab, Leertaste, Pos1 = Übersicht, Esc = zurück/schließen, F = Vollbild.
- Blendet dieselben Gruppentypen aus wie der Baum (Alwin, 22.10.2026) – die Wahl liegt dafür jetzt in `App`.
- Nur „Heute“: „Neue Gliederung“ kommt mit dem Plan in O7.
- Gemeinsam für Baum und Präsentation: `gruppenLeitung` (Leitung einer Gruppe) statt einer Zeile im Baum; der Baum
  nimmt die lesbaren Mitglieder aus `App`, statt sie ein zweites Mal zusammenzustellen.

### Intern (gemeinsam)

- **Staging nur noch auf Zuruf:** Die Test-Instanz baut von selbst nur `main`; ein Zweig kommt mit
  `gh workflow run staging.yml --ref <zweig>` drauf. Die Version nennt den Zweig (`staging-feat-…-<sha>`).
  Vorher überschrieb jeder Push jeder Sitzung die eine Test-Instanz (Alwin: „da haben sich wieder andere
  vorgedrängelt“).
- **CHANGELOG-Einträge als Dateien je PR** in `changelog.d/`; der Release führt sie mit
  `npm run changelog -- --version X.Y.Z` zusammen. Damit gibt es beim Mergen keine CHANGELOG-Konflikte mehr
  zwischen gleichzeitigen PRs. Die CI prüft das Format (`npm run changelog -- --pruefen`).

### Behoben (Musik-App + Dienstplaner, #700)

- **Rückgängig nach dem Löschen** eines Punkts **vor dem Gottesdienstbeginn**: Kam der erste oder ein mittlerer
  Vorlauf-Punkt zurück, fielen die übrigen aus dem Vorlauf (Uhrzeit und Lage zum Beginn stimmten nicht mehr). Die Grenze
  ist in ChurchTools eine Platznummer – sie rückt jetzt beim Zurückholen um eins mit. Gefunden bei der Messung E6-6-0,
  in der Test-Instanz nachgestellt und nach dem Fix dort geprüft. Betraf die Musik-App seit v2.34.1.

### Neu (Musik-App + Dienstplaner, E6-5b-2, #691)

- **„Neu aufsetzen …“** im Bearbeiten (rechts in der Hinweiszeile; Entwurf `e6-5b-entwurf.html`, abgenommen 23.10.2026):
  ersetzt einen bestehenden Ablauf aus einer **Vorlage**, **wie ein früherer Termin** oder **leer** – im selben
  Fenster wie „Ablauf anlegen“, danach eine klare Nachfrage mit der Zahl der Punkte („Ablauf ersetzen?“ / „Ablauf
  leeren?“). **Kein Rückgängig.** Ist der Ablauf leer, geht nichts verloren – dann ohne Nachfrage.
- **Geteilter Ablauf** (in ChurchTools teilen sich mehrere Termine einen Ablauf): Die Nachfrage nennt die anderen
  Termine und bietet **„Für alle ersetzen“** oder **„Nur für diesen Termin neu“** – dann behalten die anderen den
  bisherigen Ablauf.
- Hat jemand den Ablauf seit der Nachfrage geändert, wird nichts ersetzt: Meldung, Liste neu geladen. Abgeschlossen
  zeigt der Knopf den Sperr-Hinweis wie das Plus.
- Ersetzen braucht keinen Kalender des Termins mehr (gemessen); nur „Nur für diesen Termin neu“ nimmt ihn, sonst den
  des bisherigen Ablaufs.

### Intern (Ablauf neu aufsetzen, E6-5b-1, #691)

- **Kern für „Neu aufsetzen“** (`shared/ct/ablaufNeu.ts`, noch ohne Oberfläche): einen bestehenden Ablauf aus einer
  Vorlage, wie ein anderer Termin oder leer neu aufsetzen – gemessen (E6-5b-0) ersetzt ChurchTools dabei still und
  bei einem **geteilten** Ablauf für alle Termine. Darum wird vorher mit dem Stand der Nachfrage verglichen (412,
  nichts geschrieben), abgeschlossen gibt 423, und hinterher wird nachgelesen (Zahl der Punkte, kein alter übrig –
  sonst 502). Bei geteiltem Ablauf geht auch „nur für diesen Termin“: Verbindung lösen, dann eigener Ablauf.
- Wege dafür: Dienstplaner im Browser, Musik-App als Erweiterung und über den eigenen Server
  (`GET /api/services/:id/agenda/bestand`, `PUT /api/services/:id/agenda/neu`). Der Schreib-Anschluss
  `CtSchreiber` liest dazu auch eine Vorlage frisch (`vorlage`).

### Neu (Anmeldungen, A7-5)

- **Rundmail** (Entwurf `a7-5-rundmail-v1`, abgenommen 22.10.2026): „✉ Rundmail“ im Reiter Anmeldungen – an alle
  Anmeldungen, „Zahlung offen“ oder „Warteliste“, **je Anmeldung eine Mail** an den Kontakt (Alwin). ChurchTools
  verschickt (gemessen: Absender „Name <noreply@churchtools.de>“, Antworten an die Absenderin, jede Familie ihre eigene
  Mail) über die Schnittstelle, die auch sein Mail-Editor nutzt (`churchhome/ajax` → `sendEMailToPersonIds`, nicht
  dokumentiert) – über `ctAltAnfrage`, dieselbe Stelle wie Lied-Kategorien und SongSelect (jetzt mit Modul und
  JSON-Rumpf; `AltFehler` sagt, ob ChurchTools ausdrücklich abgelehnt hat).
- Platzhalter lesbar in eckigen Klammern (`[Betrag]`, `[Anmelde-Nr.]`, `[Angemeldet von]` …) – beim Senden zu den
  Platzhaltern von ChurchTools (`/placeholders/group/{id}`); unbekannte werden genannt und sperren das Senden.
- Vorlagen „Leer“, „Zahlungserinnerung“ (Bankdaten aus „Bezahlung“) und „Infos vorab“ (Datum und Ort aus dem Termin);
  eigener Text wird nicht still überschrieben. Vorschau je Familie über ChurchTools (`/emails/preview`). „Kopie an mich“
  (aus zu Beginn).
- Rückfrage mit Anzahl, danach **im Protokoll von ChurchTools nachgelesen**. Antwortet ChurchTools beim Senden nicht und
  steht nichts im Protokoll, heißt es „unklar, ob verschickt“ – ohne zweites Senden (sonst doppelte Mails).
- Beim echten Test gefunden: Die Vorschau-Antwort von ChurchTools steht direkt da (`{subject, html}`), nicht in `data`;
  Platzhalter der Person ([Vorname], [Wartelistenplatz]) gelten für die Person, an die die Mail geht – Hinweis im Fenster.

### Neu (Dienstplaner, E6-5a, #681)

- **Ablauf anlegen in der Termin-Ansicht:** Bei einem Termin ohne Ablauf steht für alle, die den Ablauf bearbeiten
  dürfen, „Ablauf anlegen“ – mit denselben drei Wegen wie in der Musik-App: **aus einer Vorlage** (die des eigenen
  Kalenders zuerst und vorausgewählt), **wie ein früherer Termin** (derselbe Kalender, bis 12 Wochen zurück, nur
  Termine mit Ablauf, jüngster zuerst) oder **leer**. Danach steht der Ablauf da, und man ist gleich im Bearbeiten.
  Angelegt wird über den vorhandenen Kern (prüft vorher, ob es schon einen gibt, und liest nachher nach).

### Intern (Ablauf-Baustein, E6-5a, #681)

- Das Fenster „Ablauf anlegen“ ist ein gemeinsamer Baustein (`ui/ablauf/AblaufAnlegenFenster`); die Musik-App behält
  eine Hülle mit ihren Abfragen. Die Auswahl-Regeln stehen in `shared/ct/ablaufVorschlaege.ts` (vorher
  `client/src/utils/`), der blaue Hauptknopf als Mixin `hauptKnopfBreit`. Fotos des Fensters (Vorlage, früher, leer)
  sind vorher und nachher byte-gleich. Neu getestet: „Kalender unbekannt“ in der Musik-App legt nichts an.

### Neu (Protokolle, S2-3)

- **Vorlagen bearbeiten** (Verwaltung, nur Admins): Karte „Vorlagen“ unter den Gruppen mit Umfang und Punkten je
  Vorlage; das Fenster wie im Entwurf – Name, Tagesordnungspunkte mit vorbereitetem Text und Reihenfolge, feste
  Punkte („Offene To-Dos“, „Protokoll der letzten Sitzung“ – Titel änderbar), feste Aufgaben; „Neue Vorlage“ beginnt
  mit „Gebet“ und „Offene To-Dos“; Löschen mit Rückfrage. Jeder Schreibschritt nachgelesen, zu lange Vorlagen
  werden vorher abgelehnt.
- Die drei Standard-Vorlagen entstehen nur noch, wenn die Kategorie „Vorlagen“ **neu angelegt** wird – hat ein Admin
  alle gelöscht, kommen sie beim nächsten Einrichten nicht wieder (vorher: immer, wenn die Kategorie leer war).

### Neu (Organigramm, O3, #672)

- **Reiter Organigramm · Personen · Hinweise** (am Handy unten): Personen und Hinweise gibt es nur für die **Leitung
  eines Bereichs** – wer eine Gruppe leitet, sieht sie samt allen Untergruppen; Gruppen-Admins sehen alles; wer nichts
  leitet, sieht nur den Baum (auch nicht über die Adresse `#personen`). Das ist die Richtung, in der ChurchTools selbst
  Rechte vererbt (O0 §5).
- **Personen:** jede Person einmal, mit ihren Gruppen (Leitung hervorgehoben), Einsätzen der letzten 6 Monate (mit
  Balken) und Einteilungen der nächsten 3. Filter „Fast jede Woche“ (ab 24 Einsätzen), „In 3+ Gruppen“, „Ohne
  Einsatz“ (in einem Dienst-Team, aber weder vergangen noch kommend eingeteilt), „Leitung“; Suche nach Namen.
- **Personenfenster:** Gruppen mit Rolle (zum Weiterklicken), Einsätze je Dienst, letzter Einsatz, „In ChurchTools
  öffnen“.
- **Hinweise:** Teams ohne Leitung (Gruppe mit Mitgliedern, niemand mit Leitungs-Rolle), Personen, die fast jede
  Woche dienen, Personen in einem Dienst-Team ohne Einsatz, offene Mitgliedsanfragen. Filter und Hinweise nutzen
  DIESELBEN Regeln (`fastJedeWoche`, `dienstTeamOhneEinsatz`).
- **Offene Plätze** im Baum („x offen“): freie Plätze in kommenden Terminen – bei Diensten mit mehreren Gruppen nur an
  der ersten. Ein Platz ist frei nach der Regel des Dienstplaners (`istFrei`); „Namen verbergen“ (`-2`), Gäste,
  abgesagte Termine und ungültige Plätze zählen für niemanden.
- **Einsätze laden** (`/events?include=eventServices`, 6 Monate zurück, 3 voraus) läuft neben dem Baum. Scheitert es
  vorübergehend, sagen Personen und Hinweise das („Erneut versuchen“ lädt nur die Einsätze) – „fast jede Woche“ und
  „ohne Einsatz“ entfallen dann, statt jede Person als „ohne Einsatz“ zu melden. Keine Liste von ChurchTools gilt als
  Fehler, nicht als „niemand hat Einsätze“. Abgemeldet → Hinweis für die ganze Seite.
- **Mitglieder:** angefragte (`requested`) kommen getrennt für den Hinweis; wartende und beendete fallen weg.

### Neu (Musik-App, Lied-Editor L2)

- **Ablauf als Kärtchen** (Alwin: „wie in ProPresenter“): Über dem Text stehen die Teile des Lieds als
  Kärtchen in der Reihenfolge, in der gesungen wird. Am Griff ziehen verschiebt, **×** entfernt, **+ Vers 1**
  usw. hängt einen Teil an, **Wie im Text** stellt die Reihenfolge des Texts wieder her; Rückgängig wirkt wie
  beim Tippen. Ein Name, zu dem es keinen Teil gibt, ist rot markiert („fehlt im Text“). Am Handy ist
  „Ablauf“ ein eigener Bereich neben Text und Vorschau. Gespeichert wird wie bisher die `{flow: …}`-Zeile –
  im Text ist sie jetzt unsichtbar, und „Format → Ablauf“ entfällt.

### Intern (gemeinsam)

- Die Zieh-Einstellungen für umsortierbare Listen stehen einmal in `ui/bedienung/useZiehSensoren.ts` statt
  in jeder Liste (Ablauf-Liste, Links der Verwaltung, Ablauf-Kärtchen).

### Geändert (Musik-App, Lied-Editor L1)

- **Der Lied-Editor im ChurchTools-Look** (erste Scheibe des neuen Editors; Alwin: „zu kompliziert und zu
  altbacken"): weißer Kopf statt blauer Leiste – Abbrechen, Titel mit Tonart darunter, Speichern. Darunter
  Karten: am iPad links der Text (Fassung, Akkord, Format, Rückgängig/Wiederholen), rechts die Vorschau; am
  Handy ein Umschalter **Text | Vorschau**. Der Umschalter „Editor / Beide / Vorschau" entfällt. Am Text und
  am Speichern ändert sich nichts. Weitere Scheiben (Ablauf als Kärtchen, Akkorde als Kärtchen) folgen.

### Neu (Protokolle, S2-2)

- **Reiter „Verwaltung“** (nur wer in ChurchTools Rechte vergeben darf): alle Gruppen der Gemeinde als Liste,
  versteckte markiert, je Gruppe „eingerichtet“ oder „Einrichten“. Ein Tipp öffnet **„Gruppe einrichten“** wie im
  Entwurf: je Rolle Kein Zugriff · Lesen + eigene To-Dos · Leitung, Tagesordnungspunkte vorschlagen oder direkt
  eintragen, Kalender. Scheitert das Speichern, bleibt das Fenster offen und sagt warum; fehlt nach einem
  abgebrochenen Versuch die Einstellung, sagt es „unvollständig“. Am Computer Reiter oben, am Handy unten.
- Kalender-Rechte und „versteckte Gruppe sehen“ entzieht das Einrichten jetzt wieder (Herabstufen,
  Kalenderwechsel) – **nur die selbst gesetzten**, von Hand gesetzte bleiben (Alwin, 22.10.2026).

### Geändert (gemeinsam)

- Der Reiter in der Adresse (`#/termine`) steht jetzt in `ui/bedienung/reiterAdresse.ts` – Dienstplaner und
  Protokolle nutzen dieselbe Regel (vorher nur im Dienstplaner).

### Neu (Protokolle, S2-1)

- **Gruppe einrichten – der Kern ohne Oberfläche** (`protokolle/src/einrichten.ts`, Bauplan Protokolle S2-1): legt
  die Kategorien „Protokolle · <Gruppe>“, „Mitarbeit · <Gruppe>“ und „Vorlagen“ an, richtet die Rechte je Rolle aus
  (Leitung · Lesen + eigene To-Dos · Kein Zugriff, Kalender, „versteckte Gruppe sehen“), schreibt erst danach die
  Einstellung der Gruppe und legt beim ersten Mal die drei Standard-Vorlagen an. **Jeder Schritt nachgelesen**;
  erneut aufrufen ist gefahrlos. Gegen die Test-Instanz mit dem echten Code geprüft: ein entzogenes Leserecht wirkt
  sofort (Messung `messung-s2-1-2026-10-22.md`: ein `PUT` an irgendeiner Rolle leert den Rechte-Zwischenspeicher
  von ChurchTools). Jede Rolle mit Zugriff bekommt jetzt auch „Modul sehen“ (ohne das fehlt der Menüpunkt). Die Oberfläche folgt
  mit S2-2.

### Geändert (gemeinsam)

- `NichtUebernommen` („ChurchTools hat … nicht übernommen“) steht jetzt in `ui/ct/fehler.ts`, und
  `ui/ct/fehlerMeldung.ts` kennt den Fall für alle Erweiterungen (vorher nur in den Anmeldungen).

### Neu (Musik-App + Dienstplaner, #676)

- **Hinweis für Bearbeitende, die nicht alle Dienstgruppen sehen:** „Du siehst nicht alle Dienstgruppen. ChurchTools
  löscht beim Speichern oder Verschieben die Infos der Gruppen, die du nicht siehst.“ – über der Bearbeiten-Liste und
  im Fenster eines Punkts. Gemessen 22.10.2026: ChurchTools zeigt jedem nur die Gruppen-Infos der Dienstgruppen, die er
  sieht, und ersetzt sie beim Speichern eines Punkts; einen schonenden Schreibweg gibt es nicht. Wer alle sieht (oder
  wenn die Dienstgruppen gerade nicht lesbar sind), sieht keinen Hinweis. Regel `siehtAlleDienstgruppen` in
  `shared/ct/dienstRechte.ts`, für die Musik-App in den Rechten (`siehtAlleDienstgruppen`, Server und Erweiterung).

### Neu (Anmeldungen, A7-4c)

- **Abgesagte zurückholen** (Entwurf `a7-4-von-hand-v1`): im Filter „Abgesagt“ (Zeile anklicken), im Fenster einer
  Anmeldung unter „Abgesagt“ und in der Suche von „＋ Von Hand“ („hat abgesagt – zurückholen“). Die Person kommt mit
  allen Antworten von damals zurück (aus dem Verlauf; eine Auswahl wird wieder als Options-Nummer geschrieben, eine
  Antwort, die es nicht mehr gibt, bleibt leer und wird genannt). Platz nach der Regel des Formulars.
- **Zahlung** (Alwin, 22.10.2026): Besteht die Anmeldung noch, bekommt sie eine eigene Zahlung wie bei „Person dazu“
  (Kopf „Zurückgeholt am …“, dieselbe Rechnung); Kontakt, Unterschrift und Auswahl bleiben bei der Anmeldung. War sie
  allein, wird die Zahlung der Anmeldung nach den Regeln neu gerechnet und ist offen – hatte sie schon bezahlt, steht
  der Hinweis „Rückzahlung prüfen“ da.
- „Platz und Betrag“ ist ein Baustein für „Von Hand“, „Person dazu“ und „Zurückholen“ (`PlatzWahl`).
- Titel eigener Zahlungen als Tabelle je Art („nachgerückt“, „dazu angemeldet“, „zurückgeholt“) – beim Durchklicken
  stand die Zahlung einer Zurückgeholten als „Anmeldung (…)“ da.

### Behoben (Musik-App + Dienstplaner, #671)

- **Feldgrenzen eines Ablaufpunkts wie ChurchTools** (gemessen 22.10.2026: Titel bis 100, Zuständig bis 1000,
  Bemerkung und Gruppen-Info je bis 4000 Zeichen). Der Server der Musik-App lehnte Bemerkungen über **2000** Zeichen
  ab, obwohl ChurchTools 4000 annimmt (die Erweiterung ohne Server konnte schon mehr); Titel bis **255** ließ er
  durch, ChurchTools lehnte sie dann ohne Grund ab („… fehlgeschlagen (400)“). Jetzt eine Quelle
  (`ABLAUFPUNKT_GRENZEN` in `shared/types`) für die Server-Prüfung (Ändern, Anlegen, „Rückgängig“) und das
  Punkt-Fenster beider Apps, das nicht mehr Zeichen zulässt, als ChurchTools speichert.

### Neu (Organigramm, O2, #664)

- **Der ganze Baum:** je Bereich (oberste Gruppe) eine Karte – große Bereiche zuerst –, darin die Gruppen als Zeilen
  mit Baumlinien, in der Farbe der Gruppe, mit Zahl der Personen, Leitung und den Diensten der Gruppe; im Kopf des
  Bereichs die Personen des ganzen Bereichs (jede einmal) und die Leitung mit Bild.
- **Gruppenfenster** (Klick auf eine Gruppe): Mitglieder nach Rollen in der Reihenfolge von ChurchTools, Ober- und
  Untergruppen zum Weiterklicken, Dienste, „In ChurchTools öffnen“. Nur ansehen.
- **Leitung aus ChurchTools:** `isLeader`, `sortKey`, `nameTranslated` der Gruppenrollen (gemessen 22.10.2026) –
  die Namensliste aus O1 („Leiter“, „leader“, „Co-Leiter“) ist weg; die Rollen kommen aus dem Abruf, den `ladeIch`
  ohnehin macht.
- **Mitglieder aller Gruppen**, höchstens 4 Abrufe gleichzeitig. Ohne Leserecht (403) bleibt die Gruppe im Baum
  („Mitglieder nicht sichtbar“); ein vorübergehender Fehler ist **kein** „nicht sichtbar“, sondern steht als solcher
  da – mit „Erneut versuchen“, das nur die gescheiterten Gruppen nachlädt. Abgemeldet → Hinweis für alles.
- **Gruppentypen ein-/ausblenden** (z. B. Verteiler), pro Gerät gemerkt; der Code kennt keinen Typ beim Namen.
- Neue gemeinsame Bausteine `ui/bedienung/PersonBild` (Bild oder Initialen wie in ChurchTools) und
  `ui/bedienung/GruppenKachel`. Die Dienste (`/services`) sind Beiwerk: fehlen sie, steht der Baum ohne Schildchen.
- Nicht in O2: offene Plätze und Einsätze (kommen mit O3, sie brauchen die Termine).

### Neu (Anmeldungen, A7-4b)

- **Person zur Anmeldung dazu** (Entwurf `a7-4-von-hand-v1`): „＋ Person dazu“ im Fenster einer Anmeldung (nur mit
  Anmelde-Nr.). Suchen oder neu anlegen wie bei A7-4a, dann nur die Fragen der Person – Kontakt, Unterschrift und
  Auswahl stehen schon bei der Anmeldung. Gleiche Anmelde-Nr., Platz nach der Regel des Formulars.
- **Eigene Zahlung** (Alwin, 22.10.2026) wie beim Nachrücken: um so viel wird die Anmeldung nach den Regeln teurer
  (Kopfzeile „Dazu angemeldet am …“). Die Rechnung steht jetzt an EINER Stelle für Nachrücken und Person dazu
  (`eigeneZahlung`); Liste und Nachprüfung erkennen beide Arten eigener Zahlung (`istEigeneZahlung`). Wer wartet,
  bekommt noch keine Zahlung – sie folgt beim Nachrücken.
- Danach „Mail schreiben“ (an die Adresse der Anmeldung) und „Rückgängig“ im Fenster; Abbrechen führt zurück in die
  Anmeldung.
- Unter einer eigenen Zahlung steht „Gilt nur für <Name>“ statt „Gilt für die ganze Anmeldung“ (auch bei
  Nachgerückten; gefunden beim Durchklicken am 22.10.2026).
- „Rückgängig“ im Fenster bricht in schmalen Fenstern (Handy) um – „Mail schreiben“ und „Rückgängig“ liefen dort
  rechts aus dem Fenster.

## [2.37.0] – 2026-10-22

### Geändert (Musik-App, #554)

- **Team-Notizen auch in großen Gemeinden schnell** (Frage aus dem ChurchTools-Dev-Stammtisch: „Wie
  funktioniert das bei 6000 Mitgliedern?"): Der Eintrag im Verzeichnis „Wer teilt" nennt jetzt auch die Lieder,
  zu denen jemand Anmerkungen hat; er wird nach dem Speichern eigener Anmerkungen nachgeführt (nur wenn sich die
  Lieder ändern – sonst kostet es nichts). „Notizen von …" liest beim Öffnen eines Lieds deshalb nur noch die
  Dateien derer, die zu diesen Liedern etwas haben, statt die aller Teilenden (bei 200 Teilenden waren das ~400
  Anfragen je Öffnen). Ob jemand wirklich teilt und unter welchem Namen, steht weiter in seiner eigenen Datei und
  wird dort geprüft. Einträge älterer Fassungen werden gelesen wie bisher.

### Geändert (Musik-App, #557)

- **Weniger Last auf ChurchTools:** Ein offener Ablauf bzw. eine offene Liedansicht fragt jetzt alle 30 Sekunden
  statt alle 8 Sekunden nach, ob sich der Ablauf geändert hat (Frage aus dem ChurchTools-Dev-Stammtisch). Das war
  der größte Posten der Grundlast – je Gerät etwa 2 statt 7,5 Anfragen pro Minute. Eine Änderung am Ablauf kommt
  dadurch nach höchstens 30 Sekunden an. Terminliste (1 Minute) und Liedtexte (1 Minute) bleiben, wie sie sind.

### Geändert (alle Apps, #654)

- **Look der ChurchTools-Weboberfläche für alle Apps** – Erweiterungen und die Musik-App als PWA (Alwin, 22.10.2026;
  löst #393 „Look der ChurchTools-App“ ab). Erste Scheibe: nur die Werte in `ui/design/_variables.scss`, gemessen in
  der Test-Instanz an ChurchTools' eigenen Tokens: Seite slate-100, Karten weiß mit 8 px Rundung, Rand slate-200 und
  leichtem Schatten, Text slate-900/600/400, Blau `#155DFC`, Knöpfe/Felder 4 px, Kacheln 6 px, Dialoge 8 px,
  Schrift **Lato**. Rot und Grün eine Stufe dunkler als ChurchTools' Knopffarben, weil sie bei uns auch Text tragen.
  Das Dunkel bleibt (seit #565 schon das von ChurchTools); Rundungen und Schrift gelten auch dort.
- **Lato** bringen die Musik-App als PWA und das öffentliche Formular selbst mit (`ui/design/schrift.ts`,
  `@fontsource/lato`, OFL; offline im Service Worker). In ChurchTools ist sie schon geladen – Erweiterungen laden
  sie nicht. Ladebildschirm, Notfallansicht und die Schrift der Anmerkungstexte ziehen mit; die Ersatzwerte im
  Baukasten der Anmeldungen ebenso.
- **Rundungen nur noch über die gemeinsamen Werte** (Alwin: „einmal geändert, überall geändert“): 181 feste
  Rundungen in Musik-App, Anmeldungen, Dienstplaner, Formular und `ui/` stehen jetzt auf `--r-ctrl` (Knöpfe,
  Felder, Schildchen – 4 px), `--r-tile` (Kacheln – 6 px), `--r-card` (Flächen, Kästen – 8 px) oder `--r-dialog`
  (Fenster – 8 px), zugeordnet nach Bedeutung, nicht nach der alten Zahl. Werkzeugleisten und Schalter sind
  Kapseln (`999px`). Bewusst fest mit Vermerk: der Handy-Rahmen in der Formular-Vorschau und die wählbaren
  Knopfformen des Anmeldeformulars; dessen übrige Rundungen hängen an seinem eigenen Wert `--p-r`.
- **Neue Dauerprüfung** `ui/design/festeWerte.test.ts`: eine feste Rundung ab 4 px außerhalb von
  `_variables.scss` lässt den Testlauf (und die CI) scheitern – außer mit Vermerk „bewusst fest“ und Grund.
- Unverändert (eigene Gestaltung): das Aussehen des öffentlichen Anmeldeformulars je Veranstaltung (`--p-*`,
  wählbare Farbe) und die Notenblätter.

### Neu (Organigramm, O1, #649)

- **Neue Erweiterung „Organigramm“** (Kürzel `organigramm`, nur Erweiterung – Bauplan Organigramm, entschieden
  22.10.2026). O1 „leer, aber echt“: lädt Person, Gemeinde, alle sichtbaren Gruppen (alle Seiten), Gruppentypen,
  Hierarchie und Rechte und zeigt die **Bereiche** (oberste Gruppen) mit der Zahl ihrer Gruppen darunter, jede in
  der **Farbe der Gruppe** (eigene Farbe vor Typfarbe, Alwin 19.10.2026). Gruppen-Admins sehen, dass sie Gruppen
  verwalten dürfen. Eigener Release-Weg (Tag `organigramm-v*`, `make_latest: false`), Anleitung
  `docs/betrieb/ORGANIGRAMM.md`; Staging baut `feat/organigramm-**` nicht.
- **Regeln in `shared/organigramm/`** (aus dem abgenommenen Entwurf): Baum aus Gruppen + Hierarchie (Obergruppe
  nicht sichtbar → Gruppe wird Wurzel; zwei Obergruppen → unter beiden; Kreise brechen nicht), Gruppenfarbe,
  „jede Person einmal“ für Obergruppen (Leitung zuerst, auch die englische Rolle `leader`), Rechte aus `churchdb`.

### Neu (Protokolle, S1)

- **Neue Erweiterung „Protokolle“** (Bauplan Protokolle, Grundgerüst): Protokolle und To-Dos für Gruppen wie den
  Leitungskreis. In S1 zeigt sie, wer angemeldet ist, und **„Deine Gruppen“** mit dem Stand der Einrichtung
  (eingerichtet · unvollständig · nicht eingerichtet) – auch für versteckte Gruppen, deren Mitglieder sie in
  ChurchTools selbst nicht sehen (die Gruppen kommen aus den sichtbaren Kategorien `protokolle-g<ID>`).
  Anleitung: `docs/betrieb/PROTOKOLLE.md`. Eigener Release-Weg: Tag `protokolle-vX.Y.Z` (`make_latest: false`).
- Regeln ohne Oberfläche in `shared/protokolle/`: Protokoll als Dokument im Format des Editors (BlockNote) mit EINER
  Ableitung für Tagesordnungspunkte, Beschlüsse, Aufgaben und Termine; Speicher als Kopf + gepackte Teile (je Wert
  höchstens 10.000 Zeichen, gemessen); To-Dos (nie hart löschen); Rechte je Rolle beim Einrichten (nur Admin,
  Ausrichten Soll/Ist); Vorlagen; Namen finden und ersetzen für „Mit KI füllen“.

### Geändert (gemeinsam)

- Packen von Text in einen ChurchTools-Wert (deflate + Base64url) steht jetzt an EINER Stelle (`shared/ct/packen.ts`);
  die Anmeldungen nutzen sie für ihre Einstellungen (vorher eine private Kopie in `formular.ts`).
- `modulId(wer)` in `ui/ct/modulPort.ts` nennt die Erweiterung in der Meldung „… ist in ChurchTools nicht zu finden“
  (stand fest auf „Anmeldungen“).
- Zweige `feat/protokolle-**` / `fix/protokolle-**` bauen kein Staging-Image der Musik-App.

### Behoben (Musik-App)

- **Scroll-Modus: Eigene Textnotizen im Lied blieben beim Einschalten des Stifts nicht erhalten** (gefunden beim
  Bau von #626, nur im unveröffentlichten Malen auf der langen Seite, #608): Beim Öffnen der Mal-Ebene wurde
  einmal eine leere Textliste gespeichert, und die eigenen Texte im Liedbereich verschwanden von der A4-Seite –
  auch im Konto. Zwei Ursachen, beide behoben: Die Anmerkungen starten jetzt gleich mit den gespeicherten
  Texten statt leer, und der Entwurf der langen Seite wird neu angelegt, wenn die Mal-Ebene erneut eingehängt
  wird. Beim Blättern ging dasselbe kurz hinaus, wurde aber sofort überschrieben.

### Neu (Musik-App + Dienstplaner, E6-3c, #659)

- **Nichts wird still überschrieben, wenn zwei gleichzeitig bearbeiten** (entschieden mit Alwin 22.10.2026: nur bei
  echtem Konflikt). Hat jemand – in der anderen App, auf einem anderen Gerät oder in ChurchTools – **denselben Punkt**
  in einem Feld geändert, das ich im offenen Fenster auch ändere, fragt das Fenster: „Dieser Punkt wurde eben woanders
  geändert … Trotzdem speichern oder verwerfen?“; die Liste dahinter ist schon neu geladen, meine Eingaben stehen noch
  im Fenster. Hat jemand **umsortiert**, während ich ziehe, wird nicht auf der alten Reihenfolge geschrieben: Hinweis,
  neu geladen, noch einmal ziehen. Änderungen an **anderen** Punkten oder Feldern gehen ohne Rückfrage durch.
- Verglichen wird frisch vor dem Schreiben, Feld für Feld so, wie die Zeile es zeigt; ein Lied über sein Arrangement.
  Vorlauf und Auge setzen einen Zielzustand und brauchen keinen Vergleich.

### Neu (Anmeldungen, A7-4a)

- **Anmeldung von Hand** (Entwurf `a7-4-von-hand-v1`, abgenommen 22.10.2026): Knopf „＋ Von Hand“ im Reiter
  „Anmeldungen“ – für Telefon, Papier und nach dem Anmeldeschluss. Erst in ChurchTools suchen (wer schon dabei ist, ist
  gesperrt), sonst neu anlegen: mit den Vorgaben der Veranstaltung und der Zustimmung zum Datenschutz („außerhalb von
  ChurchTools“, Person selbst oder Elternteil). Gleicher Name → Rückfrage „dieselbe Person?“ (`force` nur auf Wunsch).
- Dieselben Fragen wie im Formular (`FeldEingabe` in den Farben der Erweiterung), E-Mail freiwillig; geschrieben wird
  mit derselben Regel wie im Formular (`anmeldungAufbauen`: Felder, Betrag, Aufschlüsselung, Anmelde-Nr.).
- **Unterschrift:** Schalter „liegt auf Papier vor“ → „✓ auf Papier – vermerkt von <Name>, <Tag>“; sonst leer (Alwin,
  22.10.2026).
- **Platz** nach der Regel des Formulars (wartet jemand oder voll → hinten an); „Trotzdem einen Platz geben“ erhöht bei
  voller Gruppe die Plätze. Fehlt bei einer vorhandenen Person das Geburtsdatum, wird es nachgetragen.
- Danach öffnet sich die neue Anmeldung mit **„Mail schreiben“** (fertiger Text: Platz mit Betrag und Bankdaten bzw.
  Warteliste) und **„Rückgängig“** (nimmt die Person wieder heraus, setzt erhöhte Plätze zurück). Gemessen 19.10.2026:
  Anlegen und Eintragen schicken keine Mail. Jeder Schritt wird nachgelesen; scheitert das Eintragen, werden die Plätze
  zurückgesetzt.
- Das Fenster einer Anmeldung zeigt „· von Hand“, wenn das Team sie eingetragen hat (Verlauf `origin: default`).

### Behoben (Anmeldungen, beim Durchklicken von A7-4a am 22.10.2026)

- Wer abgesagt hatte und später **mit neuer Anmelde-Nr.** wieder angemeldet wird (von Hand), bekam den alten
  Anmeldetag – das hätte auch Frühbucher-Preise verschoben. Der Tag bleibt jetzt nur beim Zurückholen mit derselben
  Nr. („Rückgängig“ nach einer Absage).
- Liste: Warten alle Personen einer Anmeldung, steht „Betrag beim Nachrücken“ statt „0,00 €“ (das Formular schreibt
  bei der Warteliste 0,00 €).
- „Mail schreiben“ ohne E-Mail-Adresse sagt jetzt „Text kopieren und anders weitergeben“ statt „Öffnet dein
  Mailprogramm“; bei „gibt es schon“ ist „Diese nehmen“ der hervorgehobene Weg, „Trotzdem neu anlegen“ nicht mehr.

### Neu (Musik-App + Dienstplaner, E6-3b, #652)

- **Auge „An diesem Termin weglassen“** im Fenster eines Ablaufpunkts (Schalter unter „Vor Gottesdienstbeginn“,
  gespeichert mit „Speichern“) – wie das Auge in ChurchTools: Der Punkt bleibt im Ablauf, hat an diesem Termin keine
  Uhrzeit, und ChurchTools rechnet seine Zeit nicht mit (die Punkte darunter rücken vor). Gilt nur für diesen
  Termin, auch wenn sich mehrere Termine den Ablauf teilen.
- **Weggelassene Punkte sieht man jetzt:** grau, „—“ statt der Uhrzeit und „an diesem Termin weggelassen“ – in
  Ansicht und Bearbeiten-Liste beider Apps. Vorher stand ein in ChurchTools ausgeblendeter Punkt nur ohne Uhrzeit da.

### Behoben (Musik-App, E6-3b, #652)

- „Rückgängig“ nach dem Löschen holte einen weggelassenen Punkt **als gezeigten** zurück – das Auge ging verloren
  (der Schreibweg war bis zur Messung E6-3-0 unbekannt). Jetzt wird es wieder gesetzt; der Server lässt das Feld im
  Merkzettel durch (zod hätte es sonst still gestrichen – der Test prüft das Schema jetzt gegen den echten
  Merkzettel).

### Neu (Dienstplaner, E6-3a, #645)

- **Ablauf in der Termin-Ansicht bearbeiten:** Wer in ChurchTools den Ablauf des Termins bearbeiten darf (Recht
  „Ablauf bearbeiten“ für den Kalender des Termins oder Admin des Termins – dieselbe Regel wie in der Musik-App),
  bekommt einen Stift. Danach dieselbe Liste wie in der Musik-App: am Griff ziehen, Punkt antippen und im Fenster
  ändern, „Eintrag hinzufügen“, Löschen mit Rückfrage, „Rückgängig“ für Verschieben und Löschen, „vor Beginn“.
  Lieder stehen nur da – ein Lied wählt man in der Musik-App. Gespeichert wird sofort in ChurchTools, danach wird der
  Ablauf frisch gelesen; ist er abgeschlossen, ändert sich nichts und ein Hinweis sagt warum. War ein Punkt
  inzwischen woanders gelöscht oder der Ablauf geändert, wird ebenfalls frisch gelesen.

### Intern (Schreibweg, E6-3a, #645)

- Der Schreiber des Browsers für die Ablauf-Regeln (`browserSchreiber`, samt Fehler-Übersetzung) steht jetzt in
  `ui/ct/schreiber.ts` – Musik-App (Erweiterung) und Dienstplaner schreiben über denselben; die Regeln bleiben im
  Schreibkern (`shared/ct/schreibKern.ts`). Den Kalender eines Termins liest eine Stelle (`kalenderVon`, vorher
  zweimal nachgebaut).
- Erweiterungsrahmen mit Reiterleiste (Handy): Die Fläche über der Leiste ist jetzt der Bezug für Schwebendes – das
  Plus des Ablaufs stand sonst hinter der Leiste (im Browser gefunden und geprüft; der Dienstplaner hat keine E2E).
- Demo des Dienstplaners (`?demo`): Der Ablauf des ersten Termins lässt sich bearbeiten (nur im Speicher), Uhrzeiten
  rechnet die Demo wie ChurchTools.

### Neu (Anmeldungen, A7-3)

- **Nachrücken lassen** (Entwurf `a7-3-nachruecken-v1`, entschieden 19.10.2026): an jeder wartenden Person im Fenster
  und im Hinweis „Plätze frei – N warten“, mit Rückfrage. Ist alles voll, werden die Plätze dabei erhöht (Alwin: „dann
  ändert sich auch das Limit“). Die Nachgerückte bekommt **eine eigene Zahlung** („als ob ein Kind neu angemeldet
  wurde“) – der Betrag, um den die Anmeldung nach den Regeln teurer wird. **Kein Rückgängig** (zurück auf die
  Warteliste löst in ChurchTools die Mail „Du stehst auf der Warteliste“ aus – gemessen).
- **Absagen** je Person, mit Rückfrage: Die Zahlung der Anmeldung wird neu gerechnet, eine Rückzahlung steht in der
  Aufschlüsselung (Zeile „Abgesagt am …“, auch wenn jemand Wartendes absagt und der Betrag bleibt); sagt die erste
  Person ab, gehen Kontakt, Unterschrift und Zahlung an die nächste. **Rückgängig im
  Fenster** holt die Person mit allen Antworten zurück (gemessen: ohne Mail). Scheitert ein Schritt, wird
  Halbgeschriebenes zurückgenommen.
- **„Mail schreiben“** nach dem Nachrücken bzw. Absagen: fertiger Text (Betrag, Frist, Bankdaten bzw. Rückzahlung),
  öffnet das Mailprogramm (`mailto:`) – ChurchTools selbst schickt nur „war erfolgreich“ bzw. nichts.
- Eine Anmeldung kann **mehrere Zahlungen** haben (Fenster: „Zahlungen“); Liste, „Zahlung offen“ und Nachprüfung zählen
  sie zusammen. „Betrag nach den Regeln“ steht an EINER Stelle (`sollBetrag`), die Nachprüfung, Nachrücken und Absagen
  nutzen.

### Behoben (Anmeldungen, A7-3)

- Anmeldetag aus dem Verlauf: Einträge derselben Sekunde nach ihrer Nummer; wer vom Team wieder aufgenommen wird,
  behält ihn (gemessen 19.10.2026: Entfernen und Wieder-Aufnehmen tragen dieselbe Sekunde).
- Weiße Seite, sobald „Rückgängig“ im Fenster verschwand (z. B. „Mail schreiben“, Fenster schließen; seit A7-2):
  Chrome 152 gibt bei `scrollIntoView` ein Promise zurück, der Effekt reichte es als Aufräum-Funktion an React weiter.
  ESLint verbietet solche Effekt-Rümpfe jetzt im ganzen Repo (`no-restricted-syntax`); vier harmlose Stellen
  (Baukasten, Dienstplaner-Termine, Formular) entsprechend umgestellt.

### Intern (Ablauf-Baustein, E6-2b-3, #643)

- **Die Bearbeiten-Liste des Ablaufs ist ein gemeinsamer Baustein** (`ui/ablauf/useAblaufBearbeiten.tsx`, für Nutzer
  unsichtbar): Ziehen, Punkt-Fenster, Plus, Löschen mit Rückfrage, „Rückgängig“ und der Hinweis bei abgeschlossenem
  Ablauf – die Musik-App steckt ihre Liedwahl ein (`LiedVerknuepfen`, vorher `ItemActionSheet`), der Dienstplaner
  nutzt die Liste ab E6-3. Mit umgezogen: `ConfirmDialog` (`ui/fenster`), `SchwebePlus` und die Ziehen-Hilfen
  (`ui/bedienung`), die Vorlauf-Regel beim Umsortieren (`vorlaufNachUmsortieren`, jetzt neben `beginnStelle` in
  `shared/ct/ablaufZeile.ts`). Fotos von Bearbeiten-Liste, „Eintrag bearbeiten“, Lösch-Rückfrage und „Neuer
  Eintrag“ sind vorher und nachher byte-gleich.

### Behoben (Musik-App, #643)

- Scheiterte beim Bearbeiten des Ablaufs das **Verschieben oder Löschen**, standen danach längst entfernte Punkte
  (die grauen „entfernt“-Platzhalter aus der Ansicht) wieder in der Bearbeiten-Liste. Ändern und „Rückgängig“
  rollten schon richtig zurück – jetzt alle vier über dieselbe Stelle.

### Intern (Ablauf-Baustein, E6-2b-2, #641)

- **Das Punkt-Fenster ist ein gemeinsamer Baustein** (`ui/ablauf/PunktFenster.tsx`, für Nutzer unsichtbar): Titel,
  Art, Dauer, Zuständig, Bemerkung, Vorlauf, Speichern, Löschen – ohne Dienste der Musik-App. Lieder verknüpfen
  und lösen gibt es nur über den **Steckplatz `liedWahl`**: Die Musik-App steckt dort ihre Liedsuche ein
  (`ItemActionSheet` ist jetzt eine dünne Hülle), der Dienstplaner lässt ihn leer und zeigt Lieder nur an (Alwin,
  17.10.2026). Fotos von „Eintrag bearbeiten“, „Neuer Eintrag“ und „Lied verknüpfen“ sind vorher und nachher
  byte-gleich.

### Intern (Ablauf-Baustein, E6-2b-1, #638)

- **Bearbeiten-Bausteine des Ablaufs gemeinsam** (für Nutzer unsichtbar, Vorbereitung für das Bearbeiten im
  Dienstplaner, E6-3): die Feld-Regeln des Punkt-Fensters nach `shared/ct/agendaItemChanges.ts` (React-frei;
  vergleichen nur noch die vier Felder, die sie brauchen), „Rückgängig“ nach `ui/bedienung/useRueckgaengig.ts`, das
  Zuständig-Feld nach `ui/ablauf/ResponsibleField.tsx` und die Zeile zum Ziehen nach `ui/ablauf/AgendaSortableRow.tsx`
  (Styles 1:1 aus `Setlist.module.scss`). Das Bildschirmfoto der Bearbeiten-Liste ist vorher und nachher
  byte-gleich; ein E2E-Test prüft am Griff `touch-action: none` und die Breite (ohne ließe er sich am Handy nicht
  ziehen).

### Geändert (Musik-App, E6-2a, #635)

- **Ablauf bearbeiten – je Termin, wie in ChurchTools** (Alwin, 19.10.2026: „wie ChurchTools“): Den Stift im
  Ablauf, „Ablauf anlegen“ und „Zu Ablauf hinzufügen“ gibt es jetzt genau dort, wo ChurchTools das Bearbeiten
  auch erlaubt – als Admin, mit „Abläufe bearbeiten“ (`edit agenda`) **für den Kalender dieses Termins** oder als
  **Admin dieses Termins** (gemessen 17.10.2026). Bisher galt „irgendein Kalender“: Termin-Admins ohne
  Kalender-Recht konnten nicht bearbeiten, und wer nur für einen anderen Kalender durfte, sah Knöpfe, die mit
  „verboten“ endeten. Bei „Zu Ablauf hinzufügen“ stehen nur noch Termine zur Wahl, deren Ablauf man bearbeiten darf.
- Kennt ein älterer Server den Kalender eines Termins noch nicht, bleibt es wie bisher (irgendein Recht genügt,
  ChurchTools entscheidet) – niemand verliert den Stift.
- Die Regel steht an **einer** Stelle (`shared/ct/ablaufRecht.ts`, `darfAblaufBearbeiten`); der Dienstplaner nutzt
  sie ab E6-3, die Termin-Admins liest er schon darüber (`terminAdminIds`). Die Termine tragen die Admin-IDs als
  Tatsache mit (`terminAdminIds`, kein zusätzlicher Abruf – `GET /events` liefert sie, gemessen 19.10.2026);
  verglichen wird erst im Browser mit der eigenen Person. Neuer E2E-Test `e2e/ablauf-recht.spec.ts`.

### Neu (Anmeldungen, A7-2)

- **Zahlung im Fenster einer Anmeldung** (Entwurf `a7-anmeldungen-v2`): **als bezahlt markieren** mit Zahlart und Tag,
  **zurücksetzen**, **Betrag ändern** – jeweils mit „Rückgängig“ **im Fenster selbst** (Alwin, 19.10.2026: „Rückgängig
  bitte immer bei modalen im modal direkt rein“ – die Leiste unten lag hinter dem Fenster; `RueckgaengigImFenster`, ein
  gemeinsamer Ablauf mit der Leiste). Geschrieben wird bei der ersten Person der Anmeldung
  (`zahlungBei`), nachgelesen nach jedem Schreiben. Gemessen 19.10.2026: `PATCH /groups/{id}/members/{personId}` mit
  `{fields: {…}}` ändert nur die geschickten Felder, keine Mail. Hat die erste Person abgesagt, wird nichts geschrieben
  (kommt mit A7-3).
- **Zahlarten** (Alwin, 19.10.2026: „je Gemeinde + je Veranstaltung“): Liste in den Einstellungen der Gemeinde
  (vorbelegt Überweisung, Bar, PayPal), je Veranstaltung abwählbar (Karte „Bezahlung“, `ohneZahlarten` – nur gespeichert,
  wenn etwas abgewählt ist). Neues Systemfeld **„Zahlart“**; ältere Veranstaltungen bekommen es beim ersten „bezahlt“
  (`systemfelderNachziehen`, dieselbe Stelle wie beim Freigeben).
- **Betrag von Hand:** In der Aufschlüsselung steht dann „Von Hand geändert am …“; die Nachprüfung meldet ihn danach
  nicht mehr als abweichend (`vonHandZeile`/`vonHandBetrag`).
- „TT.MM.JJJJ“ steht an EINER Stelle (`tagPunkt`) – Unterschrift, Zahlung und Reiter hatten je eine eigene Fassung.
- Nach einer Zahlungsänderung lädt die Seite auch die Einstellungen neu (echter Test 19.10.2026: Das erste „bezahlt“ legte
  das Feld „Zahlart“ an, ohne dessen Nummer fehlte die Zahlart in der Anzeige).

### Neu (Dienstplaner, E6-1b, #625)

- **Termin-Ansicht – Ablauf und Dienste eines Termins** (Bauplan E6-1b, Entwurf `e6-entwurf.html`): Eine Zeile in
  „Termine“, „Ablauf & Dienste“ bei „Als Nächstes“ auf der Startseite oder der Name im Spaltenkopf der Matrix (am
  Handy „Ablauf & Dienste“ im Kopf des Termins) öffnet den Termin – mit eigener Adresse (`#/termin/<id>`), Neuladen
  und Zurück gehen also. Oben Datum, Beginn und „Ende ca.“, ‹ › blättert durch die geladenen Termine; „zurück“ führt
  zum Reiter, von dem man kam (der bleibt hervorgehoben). Darunter **der Ablauf wie in der Musik-App** (Alwin,
  17.10.2026: „so wie bei der Musik App, die Dauer bitte neben Zeit“) – mit Vorlauf und Linie „Beginn“, Notizen und
  Zuständigen; Lieder nur zum Ansehen. Darunter **die Dienste** nach Gruppe, mit denselben Plätzen wie in „Planen“.
  Nur ansehen – Bearbeiten kommt mit E6-3.
- **Musik-App (sichtbar unverändert):** Die Ablauf-Ansicht und die sortierbare Zeile nutzen jetzt denselben Baustein
  `ui/ablauf/AblaufListe` (vorher fest in `AgendaFullView`, Styles 1:1 aus `Setlist.module.scss` verschoben).
- Ein Ablauf ohne Punkte-Liste zählt als leer – an einer Stelle (`ladeAblauf`), die auch die Lieder der Startseite
  nutzen; vorher prüfte jeder Aufrufer selbst.

### Neu (Anmeldungen, A7-1)

- **Reiter „Anmeldungen“** (Entwurf `a7-anmeldungen-v2`, nur ansehen): eine Zeile je Anmeldung (Anmelde-Nr.; ohne Nr.
  je Person) mit Personen, Alter am ersten Tag, Warteplatz, Betrag und Zahlung; oben Plätze, Warteliste und offene
  Zahlungen, dazu der Hinweis „Plätze frei – N warten“ (dieselbe Regel wie die Nachprüfung, `wartenTrotzPlatz`). Filter
  Alle / Zahlung offen / Warteliste / Abgesagt, Suche. Das Fenster einer Anmeldung zeigt alle Antworten – was für die
  ganze Anmeldung gilt (Kontakt, Erziehungsberechtigte, **Unterschrift als Bild**), einmal oben (Alwin, 19.10.2026).
  Adresse `#/v/<Nummer>/anmeldungen`.
- **Abgesagt aus dem Verlauf** (`/groups/{id}/members/history`, gemessen 19.10.2026): Er behält alle Antworten. Hat die
  erste Person einer Anmeldung abgesagt, kommen Betrag, Kontakt und Unterschrift von dort.
- Liste und Nachprüfung laden die Mitglieder **einmal gemeinsam** (`mitglieder.ts`, Rechnen in `shared/anmeldung/liste.ts`);
  Auswahl-Felder erscheinen als Text statt als Options-Nummer.

### Behoben (Anmeldungen, A7-1)

- **Nachprüfung: Anmeldetag nach dem Nachrücken.** Gemessen 19.10.2026: Beim Nachrücken setzt ChurchTools das
  Eintrittsdatum auf den Tag des Nachrückens. Die Nachprüfung nahm es als Anmeldetag – eine nachgerückte Anmeldung galt
  so als später angemeldet (Frühbucher, „Preise nach der Anmeldung geändert“ wurde zu „weicht ab“). Jetzt kommt der
  Anmeldetag aus dem Verlauf.

### Neu (Anmeldungen, A6-5c, #623)

- **Nachprüfung** (Entwurf `a6-5c-nachpruefung-v1`, Alwin 17.10.2026: „nachrechnen + markieren“) – neue Karte auf der
  Veranstaltungsseite, geprüft beim Öffnen und mit „Neu prüfen“, **nichts wird automatisch geändert**:
  - **Plätze** wie ChurchTools (ohne Leitung) und ein Hinweis, wenn Plätze frei sind, aber jemand wartet – ChurchTools
    lässt dann niemanden von selbst nachrücken (#619).
  - **Belegung je Auswahl** – ausgebucht, überbucht (rot).
  - **Betrag je Anmeldung** (Anmelde-Nr.), nachgerechnet mit derselben Regel wie im Formular (`betragAus`) aus dem, was
    in ChurchTools steht (Geburtstag, Auswahl, Extras, wer einen Platz hat, Anmeldetag): **nachgerückt** (neuer
    Betrag), **Preise nach der Anmeldung geändert** (nur Info), **weniger als gemeldet** (hat jemand abgesagt?),
    **weicht ab** (rot, bitte prüfen), **Auswahl fehlt** (die gespeicherte Auswahl gibt es nicht mehr – keine
    geratene Zahl; echter Test: Preise von „fest“ auf „nach Auswahl“ umgestellt). Anmeldungen ohne Anmelde-Nr. (vor dem 17.10.2026) werden beim Betrag nicht
    geprüft – dort wäre jede Prüfung ein Fehlalarm.
  - Mit Hinweisen steht die Karte oben unter dem Anmeldelink, sonst klein unten; in Entwürfen gibt es keine.
- Die Erweiterung merkt sich, **wann die Preise zuletzt geändert** wurden (`preiseGeaendert`).
- **Startseite und „Es gibt schon N Anmeldungen“ zählen ohne Leitung** – bisher zählte die Leitung als Teilnehmer
  mit, eine Veranstaltung konnte so zu früh „voll“ wirken (gemessen: ChurchTools zählt nur Teilnehmer).
- „Heute“ steht an EINER Stelle (`heuteImKalender`) – das Formular und die Startseite hatten je eine eigene Fassung.

### Behoben (Anmeldungen, #619)

- **Wer wartet, kommt zuerst:** Gemessen 17.10.2026 – wartet jemand, stellt ChurchTools jede neue Anmeldung hinten an,
  auch wenn Plätze frei sind (mehr Plätze lassen niemanden nachrücken). Das Formular rechnete nur `max − belegt` und
  zeigte „✓ angemeldet“ samt Betrag, obwohl ChurchTools auf die Warteliste setzte. Jetzt gibt es für Gäste keinen
  freien Platz, solange jemand wartet (`platzStandAus`, die eine Stelle für Anzeige, Hinweis, Betrag und Ergebnis).

### Neu (Anmeldungen, A6-5b, #616)

- **Kontingent je Auswahl** (Alwin, 17.10.2026): Je Option „Wie oft buchbar“ – jede Anmeldung mit dieser Option
  belegt eins (z. B. 6 Zweibettzimmer → 6) – und freiwillig „Für wie viele Personen“ (z. B. 2). Meldet jemand mehr
  Personen an, sagt das Formular „… ist für 2 Personen gedacht – ihr meldet 3 an. Passt das?“; anmelden geht trotzdem.
- **Ausgebucht → nicht mehr wählbar** („– ausgebucht“); vorausgewählt ist die erste freie Option, sind alle voll, geht
  keine Anmeldung. Beim Absenden prüft das Formular den frischen Stand noch einmal und schickt sonst nichts.
- Gemessen: Gäste können die Belegung nicht lesen (`/groups/{id}/statistics` 401). Deshalb **zählt die Erweiterung
  beim Öffnen der Veranstaltung** (wer bearbeiten darf; je Anmelde-Nr. mit mindestens einer Person mit Platz,
  `optionenBelegt`) und schreibt `belegt` in die Einstellungen – nur wenn sich etwas geändert hat; scheitert es, bleibt
  der alte Stand. Sichtbar wird die Belegung mit der Nachprüfung (A6-5c).
- „Ausgebucht“ ist EINE Regel (`optionRest`) – auch `berechnePreis` nutzt sie. Der alte Satz „… kommt auf die
  Warteliste“ stimmte nicht (ChurchTools kennt keine Warteliste je Auswahl) und ist ersetzt.
- **Formular-Paket mit aktualisieren.**

### Neu (Anmeldungen, A6-5a, #612)

- **Anmelde-Nr. je Person** (Alwin, 17.10.2026): Seit #602 wird jede Person einzeln angemeldet – damit man in
  ChurchTools sieht, wer zusammengehört, steht bei **jeder** Person derselbe Wert im neuen Systemfeld „Anmelde-Nr.“
  (sechs Zeichen ohne 0/O/1/I/L, z. B. „7K2P9X“; auch bei „noch einmal“ dieselbe). Grundlage für die Nachprüfung
  (A6-5c) und die Liste (A7). Ältere Veranstaltungen ohne das Feld: Das Formular schickt ohne Nr. weiter;
  „Freigeben“ legt das Feld an.
- **Betrag nur für Personen mit Platz** (Alwin: „15 €, Rest beim Nachrücken“): Wer auf die Warteliste kommt, zählt
  nicht im Betrag; die Aufschlüsselung nennt „<Name>: Warteliste – Betrag folgt beim Nachrücken“. Kommt niemand
  unter, ist der Betrag 0 (auch keine Gebühr je Anmeldung). Formular-Anzeige und Feld „Betrag“ nutzen dieselbe Regel
  (`betragAus`).
- **Formular-Paket mit aktualisieren.**

### Neu (Musik-App, Verwaltung)

- **Liedblatt: Logo zeigen** (Alwin, 19.10.2026): Unter Mehr → Verwaltung schaltet ein Admin das App-Logo oben
  rechts auf dem Liedblatt für die ganze Gemeinde aus oder wieder an. Es gilt überall, wo ein Liedblatt entsteht –
  Anzeige, „Als PDF teilen“, Liederheft im Ablauf und Editor-Vorschau. Ohne Logo rückt der Liedtext oben etwas nach
  oben. Vorgabe bleibt „an“. In der Erweiterung wird die Einstellung wie die übrigen in ChurchTools gespeichert.
- **Editor-Vorschau mit Logo:** Bisher zeigte die Vorschau beim Bearbeiten nie ein Logo – der Text stand dort höher
  als auf dem fertigen Blatt. Jetzt holt sie es wie das Blatt selbst.

### Geändert (Musik-App)

- **Dunkelmodus wie ChurchTools** (#565, Alwin: „wir haben da so ein dunkles Blau, ChurchTools bleibt eher bei
  Schwarz“): Im Dunkeln hat die Musik-App jetzt die Farben von ChurchTools – fast schwarzer Grund, graue Karten und
  Leisten, ChurchTools-Blau –, genau wie Anmeldungen und Dienstplaner. Das frühere blaugraue Dunkel ist entfernt; es
  gibt nur noch ein Dunkel für alle Apps. Auch der Kreis um das Logo (Anmelden, Mehr) ist jetzt grau statt blau, und
  die iPhone-Statusleiste zieht mit. Der Schalter Hell / Dunkel / Auto unter Mehr bleibt; „Auto“ folgt dem Gerät.
  Die Notenseite bleibt weiß.

### Neu (Musik-App)

- **Pedal Teil für Teil** (#609, Rückmeldung des Musik-Bereichsleiters): Im Scroll-Modus holt ein Pedal-Tritt
  den nächsten Teil des Lieds an den oberen Rand – bzw. die nächste Stelle mit einem Weiterschalt-Punkt `----`.
  Ist ein Teil länger als der Bildschirm (Emporen-Monitor), geht es erst um ⅔ weiter, damit keine Zeile
  übersprungen wird. Zurück springt an den Anfang des aktuellen bzw. vorigen Teils. Die Pfeile unten tun dasselbe.
  Über dem Teil bleibt etwas Luft, ohne dass von der Zeile davor oder vom Titelkopf ein Streifen hereinschaut –
  auch auf schmalen Handys. Hochgeladene PDFs scrollen weiter um ⅔.
- **Scroll-Modus: je Lied eine lange Seite** (#607, Rückmeldung des Musik-Bereichsleiters): Statt
  aneinandergehängter A4-Seiten ist jedes Lied beim Scrollen eine durchgehende Seite in einer Spalte – keine
  Lücke mehr, wenn ein Teil nicht mehr auf die Seite passte, und die CCLI-Angabe steht direkt unter dem
  letzten Teil. **Die Anmerkungen sind dieselben wie beim Blättern** (#614): Die lange Seite zeigt sie
  umgerechnet an derselben Stelle im Teil; was beim Blättern in einer Lücke am Seitenende steht, erscheint am
  Ende des Teils davor; was unten auf der letzten Seite unter dem letzten Teil steht, steht auf der langen Seite
  genauso weit darunter – die Seite wird dafür so lang wie nötig, und dort lässt sich auch malen und mit dem Lasso
  zurechtrücken (#626); aus 2-Spalten-Liedern werden sie übernommen, stehen aber nur ungefähr (zurechtrücken
  kommt mit dem Lasso, #615). Im Scroll-Modus gibt es keinen Spalten-Schalter. **Malen direkt auf der langen
  Seite** (#608): Stift an – ein Finger oder der Pencil malt, **zwei Finger scrollen**; gemalt wird auf dem
  Lied in der Bildmitte, ein Tipp auf ein anderes (abgeblendetes) Lied macht es zum Mal-Lied; Stift, Marker,
  Radierer, Text, Rückgängig und Löschen wie beim Blättern. Gespeichert wird auf den A4-Seiten, beim Blättern
  steht es also am selben Teil. Was beim Blättern in einer Lücke steht, greift auf der langen Seite das Lasso
  (siehe unten). Hochgeladene PDFs
  bleiben Seiten. Die **Vorschau im Editor** zeigt im Scroll-Modus ebenfalls die lange Seite. Sehr lange
  Seiten werden auf iPhone/iPad etwas weniger scharf gezeichnet statt gar nicht (Leinwand-Grenze von iOS).
- **Lasso** (#615, Alwin 17.10.2026): neues Werkzeug in der Anmerken-Leiste, beim Blättern und auf der langen
  Seite. Einkreisen wählt Striche und Texte aus; im Rahmen ziehen verschiebt, der blaue Punkt unten rechts
  vergrößert oder verkleinert gleichmäßig; daneben tippen, ein anderes Werkzeug oder Stift aus legt ab.
  **Rückgängig** nimmt die ganze Bewegung auf einmal zurück. Auf der langen Seite greift das Lasso auch, was beim
  Blättern in einer Lücke am Seitenende steht und hier über dem nächsten Teil liegt – zurechtgerückt steht es danach
  auch beim Blättern am neuen Platz (und nicht mehr in der Lücke). Wo es auf A4 keine Stelle gibt (bei
  2-Spalten-Liedern rechts neben dem schmalen Streifen), lässt sich nichts ablegen – das Abgelegte wäre beim
  Speichern verloren. Das Lasso sagt das („Hier wird nichts gespeichert“) und lässt die Auswahl schweben; muss es
  doch ablegen (Stift aus), kehrt sie an ihre alte Stelle zurück.
- **Flow-Zeile `{flow: …}`** (#606, Rückmeldung des Musik-Bereichsleiters): Steht im ChordPro z. B.
  `{flow: Intro, Vers 1, Chorus 1, Vers 2, Chorus 1, Bridge, Chorus 1, Outro}`, zeigt das Blatt die Teile in
  genau dieser Reihenfolge – Wiederholungen voll, nicht genannte Teile fallen weg. Die Namen sind die
  Überschriften der Teile (Groß-/Kleinschreibung egal). Der Ablauf steht als Wegweiser im Kopf des Blatts.
  Gilt beim Blättern, im Teilen-PDF und in der Editor-Vorschau. Eine Abschnitts-Transponierung bleibt am
  Teil, auch wenn er wiederkehrt. Passt kein einziger Name, bleibt das Blatt wie im Text.
- **Editor → Format:** „Ablauf (Reihenfolge der Teile)“ setzt die Flow-Zeile nach den allgemeinen Angaben
  vor den ersten Teil, vorbefüllt mit den vorhandenen Teilen (gibt es schon eine, springt der Cursor
  dorthin). Namen ohne passenden Teil nennt ein Hinweis unter der Werkzeugleiste.
- **Weiterschalt-Punkt `----`** (#606): vier Bindestriche allein in einer Zeile (Editor → Format →
  „Weiterschalt-Punkt fürs Pedal“). Auf dem Blatt, in der Liedtext-Vorschau und in der Suche erscheint er
  nicht; die Stelle wird für das Weiterschalten Teil für Teil gemerkt (#609).

### Behoben (Anmeldungen, #602)

- **Anmeldung mit mehreren Personen stürzte in ChurchTools ab** (500 `updatePerson … null`) – gefunden beim echten
  Test mit zwei Kindern. Gemessen: Weitere Personen in **einer** Anmeldung brauchen eine Beziehung zur ersten; ohne
  stürzt ChurchTools ab, mit „Kind“ würde das erste Kind zur Mutter des zweiten. Jetzt wird **jede Person einzeln**
  angemeldet (eigener Token, eigene Mail, eigener „Austreten“-Link); Betrag, „Angemeldet von“, Telefon … stehen wie
  bisher bei der ersten.
- **Plätze schon beim Hinzufügen** (Alwin, Entwurf `a6-mehrere-personen-v2`): „+ Weiteres Kind“ fragt die freien
  Plätze frisch ab. Mit Warteliste steht an der Person „Warteliste“ samt Satz; ohne Warteliste ist der Knopf
  gesperrt, sobald alles vergeben ist („Kein Platz mehr frei“). Alles belegt → Hinweis oben, Knopf „Auf die
  Warteliste“. Die Regel steht an einer Stelle (`platzPlan`) – Formular und Absenden nutzen sie.
- **Ergebnis je Person:** Vor jeder Person wird frisch nachgesehen (gemessen: genau so vergibt ChurchTools Platz oder
  Warteliste). Ändert sich dazwischen etwas, zeigt die Danke-Seite je Person „angemeldet“, „Warteliste“, „kein Platz
  mehr“ oder „nicht angemeldet“; „… noch einmal anmelden“ schickt **nur die Offenen**.
- **500 sagt nicht mehr „antwortet gerade nicht“**, sondern „ChurchTools hat einen Fehler gemeldet … sonst der
  Gemeinde Bescheid geben“.
- Farben `--p-ok` / `--p-warn` im Formular als Tokens statt Einzelwerten.
- **Formular-Paket mit aktualisieren.**

### Behoben (Anmeldungen, #597)

- **Anmeldung mit zwei oder mehr Personen scheiterte** („Das Feld darf nicht leer sein“) – gefunden beim echten Test
  von A6-4. Felder der Anmeldung (Telefon, Erziehungsberechtigte, Unterschrift …) waren in ChurchTools „Pflicht“;
  ChurchTools prüft das bei **jeder** Person, die Antworten der Anmeldung stehen aber nur bei der ersten. Jetzt sind
  diese Spalten in ChurchTools nie Pflicht (geprüft wird im Formular), Personen-Felder bleiben wie bisher (Alwin:
  „In CT nicht Pflicht“). **Ältere Veranstaltungen zieht „Freigeben“ nach** (`pflichtNachziehen`, über
  `feldSpeichern` und nachgelesen). Bereits freigegebene: das Feld im Baukasten einmal speichern (dieselbe Regel).
- Fuß des Formulars: statt „Fragen … als Antwort auf die Bestätigungsmail“ (die Mail kommt von noreply) steht der
  **Kontakt der Veranstaltung**, wenn einer eingetragen ist.

### Neu (Anmeldungen, A6-4, #595)

- **„Deine Anmeldung“** (Alwin, 16.10.2026: „Unsere Seite“, Entwurf `a6-4-deine-anmeldung-v1`). Gemessen: ChurchTools
  schickt nach dem Anmelden seine Standard-Mail („Hallo … Austreten“, je Person eine, Text nicht änderbar); wohin
  „Austreten“ führt, bestimmt `signOutUrlTemplate` beim Anmelden. Das Formular schickt es jetzt mit – der Link führt
  auf `…/#<instanz>/<gruppe>/abmelden/<schlüssel>` auf unserer Seite, im Design der Veranstaltung (gemeinsamer
  `FormularRahmen` mit dem Formular, keine Kopie der Gestaltungsregeln):
  - **Angemeldet:** jede Person mit „Absagen“ und Rückfrage darunter. Nach dem Absagen (`signout`, 204) wird
    **nachgelesen** – steht die Person noch da, gibt es eine Fehlermeldung statt „abgesagt“. Vorübergehende Fehler
    lassen die Rückfrage offen, ein zweiter Klick versucht es erneut.
  - **Bezahlung:** Bankdaten und Verwendungszweck, wenn die Veranstaltung etwas kostet und ein Konto hat (den Betrag
    gibt ChurchTools ohne Login nicht heraus).
  - **Etwas ändern?** Ändern geht ohne Login nicht – die Seite nennt den **Kontakt für Rückfragen** (neu je
    Veranstaltung im Fenster „Anmeldung“, auf der Karte zu sehen) und bietet „Weitere Person anmelden“.
  - Falscher oder verbrauchter Link → „Dieser Link gilt nicht“; Veranstaltung nicht mehr lesbar → Seite schlicht,
    Absagen geht trotzdem.
  - **Formular-Paket mit aktualisieren** – erst ein neues Paket schickt den Link mit.
  - „Absagen“ je Person als rote Pille wie im Entwurf (erst als grauer Link gebaut, Alwin: „Absagen-Knopf rot“).

### Neu (Anmeldungen, A6-3, #593)

- **Spam-Schutz im öffentlichen Formular – unsichtbar** (Alwin, 16.10.2026: „nur unsichtbar“). Gemessen: ChurchTools
  hat beim öffentlichen Anmelden keinen eigenen Schutz. Ein Captcha ohne eigenen Server ließe sich nicht prüfen (ein
  Bot schickt dann direkt an ChurchTools) – deshalb:
  - **Honigtopf:** ein Feld außerhalb des Bildschirms, ohne Tabulator, für Vorleser verborgen. Gefüllt → nichts
    geschickt, mit **sichtbarer** Meldung („Seite neu laden“) – nie still „Danke“, falls ein Browser es doch füllt.
  - **Mindest-Ausfüllzeit 3 Sekunden:** schneller → „Bitte kurz prüfen und noch einmal tippen“; beim zweiten Tippen
    geht es durch.
  - Doppel-Absenden verhindert schon „Wird gesendet …“ (gegengeprüft; eine zusätzliche Sperre wäre wirkungslos).
  - Regeln in `shared/anmeldung/spamschutz.ts`; Vorschau, Probelauf und Baukasten sind nicht betroffen.

### Neu (Anmeldungen, A6-2b, #574)

- **Bausteine „Erziehungsberechtigte“ und „Unterschrift“** (Alwin, 14./15.10.2026, Entwurf `a6-2b-entwurf-v2`).
  Empfohlene Bausteine, je einmal je Anmeldung, in der Vorlage „Kinder-Event“ schon als Pflicht dabei.
  - **Erziehungsberechtigte:** Name und Telefon (erste Person Pflicht, zweite freiwillig), Häkchen
    „erziehungsberechtigt und einverstanden“. In ChurchTools eine lesbare Spalte.
  - **Unterschrift** mit Finger oder Maus; **am Handy im Vollbild** („Tippen zum Unterschreiben“, quer groß,
    „Abbrechen“ stellt die vorige wieder her). Gemessen: Ein ChurchTools-Feld fasst höchstens **4.000 Zeichen**,
    nicht anhebbar (`maxLength` höher → 200, ignoriert). Gespeichert werden deshalb die geglätteten Striche
    (`shared/anmeldung/unterschrift.ts`, meist einige hundert Zeichen; wird es zu lang, stärker geglättet). In
    ChurchTools **zwei Spalten** (Alwin): „Unterschrift“ lesbar („✓ Erna Muster, 15.10.2026“) und „Unterschrift
    (Daten)“. Ein Feld kann dafür jetzt weitere Spalten haben (`ctZusatzSpalten`, in `ctFelder` als `sign.daten`).
  - Spalten anlegen/ändern und nachlesen steht an EINER Stelle (`spalteSpeichern`), die Hauptspalte und die
    weitere nutzen sie.
  - **Formular-Paket mit aktualisieren:** Ein älteres Paket kennt die neuen Feldtypen nicht.
- **Formular hochladen per Skript** (`npm run formular:hochladen`, Alwin: Zugangsdaten im Mac-Schlüsselbund): FTPS
  mit `curl`, Passwort nur aus dem Schlüsselbund (über die Standardeingabe, nie in der Befehlszeile); erst neue
  Dateien, dann `index.html`, dann Prüfung im Netz, dann alte Dateien löschen.
- **Aktionen sehen klickbar aus** (Alwin, 16.10.2026: „die Einstellungsbuttons sehen irgendwie ausgegraut und nicht
  klickbar aus“): „Veranstaltung verwalten“ zeigt weiße Zeilen mit dunkler Schrift und Pfeil („Löschen“ rot);
  „Bearbeiten“, „Verwalten“, „Link kopieren“ und die kleinen Knöpfe in den Preisen haben dunkle Schrift und werden beim
  Darüberfahren hellblau. Neue Knopf-Art `aktionKnopf` in `ui/design/_mixins.scss` – grau bleibt nur, was eine
  **Wahl** ist (`auswahlKnopf`: Vorlage, Schrift, Filter).
- `useMedienAbfrage` meldet sich bei älteren Safari (vor iOS 14, nur `addListener`) richtig an statt abzustürzen –
  das öffentliche Formular öffnen Gäste mit allen möglichen Handys.

### Neu (Dienstplaner)

- **Stift – Vorlieben einer Person** (#600, Bauplan E5-3, Entwurf `e5-entwurf.html`): Neben jedem Namen im
  Zauberstab-Fenster und in „Wer kann?“ steht der Stift (Symbol aus ChurchTools, `fa-pen`). Er öffnet die drei
  Vorlieben, die ChurchTools beim Zauberstab nutzt – wie oft höchstens, Tageszeit, mit Ehepartner – für diese
  Dienstgruppe. Gespeichert wird **sofort in ChurchTools** und **nachgelesen**: Ohne Recht meldet ChurchTools zwar
  Erfolg, übernimmt aber nichts (gemessen 16.10.2026) – dann steht das im Fenster, und die Eingabe bleibt. Danach
  rechnet „Wer kann?“ bzw. der Zauberstab mit den neuen Punkten neu; von Hand Gewähltes bleibt. Den Stift gibt es nur,
  wo man die Dienstgruppe plant (nicht als bloßer Admin eines Termins). Keine eigenen Vorlieben (Alwin, 16.10.).

- **Zauberstab – automatische Planung** (#591, Bauplan E5-2, Entwurf `e5-entwurf.html`, Alwin 16.10.2026): In der
  Gruppenzeile je Termin und im Gruppenkopf für alle gezeigten Termine steht der Zauberstab – mit **genau dem Symbol
  aus ChurchTools** (`fa-magic` aus der Schrift, die ChurchTools schon lädt; nichts kopiert, Font Awesome Pro). Er
  lädt „Wer kann?“ für alle freien Plätze (mit Fortschritt, abbrechbar) und zeigt die Vorschläge zum Prüfen: je
  Platz eine Auswahl, oben „Passt“, darunter „Passt eher nicht“ mit dem Grund von ChurchTools. „Neu vorschlagen“
  rechnet mit den von Hand gewählten Namen neu; „Übernehmen“ legt **Entwürfe** an (gesendet wird wie immer mit
  „Ansehen und senden“). **„Hat zuvor abgesagt“ zieht der Zauberstab ab wie ChurchTools** (−500, also „passt eher
  nicht“ – Alwin, 16.10., nach der Prüfung an der Test-Instanz; „Wer kann?“ bleibt ohne diesen Abzug). Weil
  ChurchTools eine Absage nicht von „vom Planer herausgenommen“ unterscheidet, heißt der Grund ehrlich „hat zuvor
  abgesagt oder wurde herausgenommen“; bewusst wählen geht trotzdem. Plätze mit Entwurf bleiben, wie sie sind;
  vorhandene Entwürfe der Gruppe zählen mit. Ein
  Konflikt mit einem anderen Planer steht an der Zeile und sofort in der Matrix. Die Eingabe eines neuen Entwurfs
  kommt jetzt für „Wer kann?“, Zurückziehen, Art ändern und Zauberstab aus **einer** Funktion.

- **Dunkelmodus wie ChurchTools** (#563, Alwin: „genauso“ wie bei den Anmeldungen): Der Dienstplaner ist hell oder
  dunkel, je nachdem, was in ChurchTools gewählt ist, und schaltet ohne Neuladen mit um (`folgeChurchToolsThema()`
  aus `ui/design/thema.ts`). Bisher war er immer hell. Der Hinweiskasten in „Wer kann?“ und im Entwurfs-Fach hatte
  als Einziges feste Farben (Gelb) – er nutzt jetzt wie die Warnungen der Anmeldungen `--red` aus den Tokens. Alle
  Seiten hell und dunkel durchgesehen (Start, Termine, Planen, Fächer, Menüs, Handy).

### Hinzugefügt (Dienstplaner)

- **Entwürfe ohne Platz und alte Entwürfe** (#582, Entwurf `entwuerfe-ohne-platz.html`): Ein Entwurf findet seinen
  Platz über Termin, Dienst und Platznummer. Ändert jemand in ChurchTools die Platzzahl (die Plätze werden dabei neu
  nummeriert – gemessen), steht jetzt beim Dienst am Termin ein Schild **„Entwurf ohne Platz“**; antippen nennt den
  Grund und bietet „Entwurf verwerfen“. Gehört der Dienst nicht mehr zum Termin, ist der Termin **vorbei** oder
  **gelöscht** (ChurchTools antwortet 404 – gemessen), zeigt ein Hinweis über der Matrix „N alte Entwürfe“; die Liste
  hat „Alle verwerfen“ (einer nach dem anderen, Ergebnis je Zeile). Termine außerhalb des Zeitraums fragt der
  Dienstplaner einmal nach (höchstens 4 gleichzeitig); ein künftiger Termin dort ist normal, ein Fehler beim Fragen
  meldet nichts als alt. Den Hinweis sehen alle Planer der Gruppe, die deren Entwürfe ändern dürfen (Alwin,
  15.10.2026). Bisher blieben solche Entwürfe unsichtbar für immer in der Schublade.
- **Anzahl der Plätze ändern** (#580, Bauplan E4-5-3, Entwurf `e4-5-entwurf.html`): Regler-Symbol in der Gruppenzeile
  je Termin (nur wo man einen Dienst der Gruppe plant, nicht an abgesagten Terminen) → Fenster „Technik · Plätze“
  mit − / + je Dienst. Jeder Tipp gilt **sofort** (Alwin, 15.10.2026): frisch lesen, mit der gesehenen Zahl
  vergleichen (sonst „Jemand hat die Zahl eben geändert“), schreiben, nachlesen – nie automatisch wiederholt.
  Belegte Plätze lassen sich nicht wegnehmen. **Liegen an einem Dienst Entwürfe, bleibt seine Zahl** („erst
  senden oder entfernen“) – gemessen nummeriert ChurchTools die Plätze beim Ändern neu (ein einzelner Platz hat keine
  Nummer, ab zwei heißen sie 1, 2, …), ein Entwurf fände seinen Platz sonst nicht mehr. ChurchTools verschickt dabei
  nichts (gemessen). Kein „Auf Vorlage zurücksetzen“: Ein Termin verweist nicht auf seine Vorlage (gemessen). Danach lädt
  die Matrix leise neu – dieselbe Funktion wie nach dem Senden.
- **Belegten Platz zurückziehen oder ersetzen** (#578, Bauplan E4-5-2, Entwurf `e4-5-entwurf.html`): Wo man plant,
  ist jetzt auch ein belegter Platz antippbar. Ein Fenster zeigt, wer dort steht und wie (angefragt, zugesagt, Gast),
  dazu „Andere Person wählen“ und „Zurückziehen“ – beides wird ein **Entwurf** und geht erst mit „Ansehen und
  senden“ an ChurchTools (Alwin, 15.10.2026). Vorher steht da, was die Person mitbekommt (gemessen):
  Zurückziehen – ChurchTools sagt **nicht** Bescheid; Ersetzen – „Du wurdest … ausgetragen“. In der Matrix steht
  Zurückziehen rot gestrichelt mit durchgestrichenem Namen, Ersetzen als „Greta statt Anna“; das Entwurfs-Fach und
  das Senden-Fach („Zurückziehen: Ben“, „Anfrage an Greta statt Anna“, Satz oben und Hinweis je Zeile) sagen
  dasselbe. Die Texte zur Mitteilung stehen an einer Stelle (`bisherHinweis`). Verborgene Namen und Plätze mit
  einem veralteten Entwurf sind kein Knopf. Fenster als Modal, auch am Handy.
- **Entwürfe senden** (#573, Bauplan E4-4-2, Entwurf `e4-4-entwurf.html`): Die Leiste unten heißt jetzt
  „Ansehen und senden“. Das Fach listet die Entwürfe nach Terminen mit **Häkchen je Zeile** (abgewählte bleiben
  Entwurf), auch die anderer Planer („von Spike“), und sagt vorher, was passiert: Anfragen und direkt Zugeteilte
  bekommen eine Mitteilung in der ChurchTools-App, Gäste stehen nur mit Namen im Plan. **Vorher geprüft**: Ist
  jemand an dem Tag abwesend oder schon eingeteilt, steht das rot an der Zeile (aus „Wer kann?“, höchstens 4
  Abfragen gleichzeitig); ließ sich das nicht prüfen, steht „Hinweise nicht geprüft“. Gesendet wird einer nach dem
  anderen mit Fortschritt, das Fenster lässt sich dabei nicht schließen. Danach das Ergebnis je Zeile (gesendet,
  oder warum nicht); nichts wird verworfen, „Erneut senden“ versucht nur, was sich lohnt (vorübergehend, nicht
  angekommen, abgemeldet). Ist etwas gesendet, laden Matrix und Entwürfe danach leise neu. Gezählt und gesendet wird nach **einer**
  Regel: gültige Entwürfe im geladenen Zeitraum, wo man planen und die Entwürfe der Gruppe ändern darf.
  Damit ist die Leiste aus E4-3-3 („Senden folgt“) aktiv.

### Geändert (Dienstplaner)

- **Planen: „nur ansehen“ statt „du planst“** (#586) – das Schild „du planst“ an jeder planbaren Dienstgruppe war
  unklar und stand je nach Namenslänge woanders. Jetzt tragen planbare Gruppen kein Schild mehr (dort sind die Plätze
  antippbar); ein graues „nur ansehen“ steht nur dort, wo man an keinem der gezeigten Termine einteilen darf –
  dieselbe Regel wie die Knöpfe (Gruppe planbar oder Admin des Termins), am Handy je Termin.

### Behoben (Dienstplaner)

- **„Platz x von y“ nach der Platznummer** (#604, gefunden beim E5-Vergleich mit dem ChurchTools-Zauberstab, 16.10.2026):
  ChurchTools liefert die Plätze eines Dienstes nicht immer in ihrer Reihenfolge (gemessen: Gesang 2 vor Gesang 1). Die
  Matrix zeigte sie so, und „Platz x von y“ zählte nach der Position – der freie Gesang 2 hieß „Platz 1 von 2“. Jetzt
  sortiert `planAus` die Plätze nach ihrer Nummer; gespeichert wurde schon vorher richtig.

- **Drei Anzeige-Funde aus der Prüfung mit zwei Planern** (#584, 16.10.2026, Messprotokoll): **a)** Nach einem Konflikt im
  Entwurfs-Fach zeigt das Fach die neue Fassung des anderen Planers, und der Hinweis nennt sie mit Art („Spike hat
  diesen Entwurf eben geändert: Direkt zuteilen: Anna“) – vorher stand dort die alte Fassung und nur der Name.
  **b)** Geht beim Senden nichts durch, hat sich aber etwas geändert (Konflikt, Entwurf geändert oder weg, Platz
  weg), lädt die Matrix nach dem Schließen trotzdem neu (`neuLaden`) – vorher zeigte sie den Entwurf weiter als
  gültig. **c)** Hat ein anderer Planer den Entwurf eben gesendet oder entfernt, heißt es jetzt genau das („Den
  Entwurf gibt es nicht mehr …“, neuer Grund `entwurf-weg` im Senden-Kern) statt „eben geändert“.

### Intern (Dienstplaner)

- **Ablauf-Zeile als gemeinsamer Baustein** (#620, Bauplan E6-1a – für Nutzer unsichtbar): Die Regeln einer Ablaufzeile
  (Uhrzeit mit „Auge“, Vorlauf, Dauer, Notiz, Zuständige, Bezeichnung mit Lied, Linie „Beginn“) liegen jetzt in
  `shared/ct/ablaufZeile.ts`, die Bausteine (Bezeichnung, Zuständige, Beginn-Linie) in `ui/ablauf/AblaufTeile` – vorher
  in der Musik-App (`utils/agendaItemTitle`, `utils/vorlauf`, `components/AgendaRowParts`). Die Musik-App nutzt sie
  unverändert; der Dienstplaner bekommt sie für die Termin-Ansicht (E6-1b) statt eines Nachbaus.
- **Behoben dabei (Musik-App):** Die Uhrzeit im Ablauf war fest auf `Europe/Berlin` gerechnet (`formatBerlinTime`),
  obwohl der Leser die Zeitzone der Gemeinde kennt (#414). Jetzt gilt die Zeitzone der Gemeinde; für die ECG ändert
  sich nichts. `formatBerlinTime` entfällt.

- **Zauberstab-Kern** (#588, Bauplan E5-1 – noch ohne Oberfläche, `shared/dienstplan/zauberstab.ts`): Vorschläge für
  freie Plätze nach der Regel des ChurchTools-Zauberstabs (höchste Punktzahl über −100, Punkte rechnet ChurchTools,
  Kandidaten aus derselben Funktion wie „Wer kann?“; „hat zuvor abgesagt“ zählt hier mit, s. E5-2). Über mehrere Termine zählen die eigenen Vorschläge, von Hand
  gewählte Namen und vorhandene Entwürfe **wie echte Einteilungen mit den Abzügen von ChurchTools selbst** (Alwin,
  16.10.2026: „mitzählen“): selber Tag −250, Monat −3/−2/−1, Abstand −50/−10 (der nähere zählt), „höchstens N× im
  Monat“ erreicht −100; bei Gleichstand zuerst, wer im Lauf seltener dran ist. Laden mit höchstens 4 Abfragen
  gleichzeitig, Fortschritt und Abbrechen; ein Fehler hält den Lauf an. `monateBis` neben `tageBis` in
  `shared/ct/datum.ts`.
- **Gemessen** (16.10.2026, E5-0): Der ChurchTools-Zauberstab arbeitet nur je Termin; die Abzüge für Monat (−3 je
  Dienst im Monat, −2 / −1 daneben) und Abstand (−50 unter 7, −10 unter 14 Tagen) und die Form der Vorlieben in „Wer
  kann?“ (`serviceGroupPreferences.maxPerMonth` …) stehen im Messprotokoll.
- **Kern für die Platzzahl** (#580, `shared/dienstplan/anzahl.ts`) mit derselben Fehler-Zuordnung wie der
  Schreibkern (`lesegrund`, eine Stelle statt zwei). Der ChurchTools-Nachbau der Tests kann jetzt auch die
  Platzzahl (mehr → neue freie Plätze, weniger → leere zuerst weg), und im Planen-Test gibt es nur noch **einen**
  nachgebauten Anschluss statt dreier Kopien.
- **Zurückziehen und Ersetzen im Kern** (#576, Bauplan E4-5-1 – noch ohne Oberfläche): Ein Entwurf kann jetzt auch
  „frei“ als Ziel haben (die Einteilung zurückziehen; beim Senden `decline`) und an einem belegten Platz eine andere
  Person eintragen (ersetzen). Neue Regel `gleicherStand` für beide Stellen – Schild „veraltet“ und Prüfung vor dem
  Schreiben: Hat eine angefragte Person inzwischen zugesagt, ist das eine Änderung; der Entwurf wird nicht gesendet
  (Alwin, 15.10.2026). Bisher zählte eine Zusage derselben Person als „unverändert“. Anzeige-Texte für das neue Ziel
  aus einer Stelle (`zielText`).
- **Gemessen** (15.10.2026, E4-5-0): Ersetzen schickt der bisherigen Person die Push-Mitteilung „Dienstaustragung – Du
  wurdest aus dem Dienst … ausgetragen“ (angefragt wie zugesagt); Zurückziehen schickt nichts; die Platzzahl ändern
  verschickt nichts. Keine Mails.
- **Senden-Kern** (#570, Bauplan E4-4-1 – noch ohne Oberfläche): `shared/dienstplan/senden.ts` macht aus Entwürfen
  echte Einteilungen. Je Eintrag, einer nach dem anderen: Entwurf noch in derselben Fassung? → einteilen mit dem
  Schreibkern (frisch lesen, schreiben, nachlesen; `gesehen` als erwartete Belegung) → **erst danach** den Entwurf
  entfernen. Ergebnis je Eintrag (gesendet, ggf. „Entwurf blieb“; nicht gesendet mit Grund; nicht versucht). Bei
  „abgemeldet“ und vorübergehenden Fehlern wird angehalten, der Rest bleibt Entwurf; nichts wird automatisch
  wiederholt oder verworfen. Echt an der Test-Instanz geprüft (direkt zugeteilt + Gast, danach ausgetragen).
- **Gemessen** (15.10.2026): „Direkt zuteilen“ über die Schnittstelle löst die Push-Mitteilung „Diensteinteilung“
  aus wie eine Anfrage; Austragen durch einen Planer benachrichtigt die Person **nicht**.
- Die ChurchTools-Nachbauten der Tests (`einteilen.testutil.ts`, `entwuerfe.testutil.ts`) nutzen Schreibkern,
  Entwürfe und Senden gemeinsam statt in Kopien.
- **Browser-Anschluss des Schreibkerns** (#573, `dienstplaner/src/dienstPort.ts`): Termin frisch lesen und Platz
  schreiben mit der Sitzung der Seite. Liefert ChurchTools einen Termin ohne Platzliste, gilt das als
  „vorübergehend“, nicht als „Platz weg“. Die Hinweise vor dem Senden nutzen `mapLimit` (keine eigene Kopie).
  Die Demo (`?demo`) spielt jetzt auch das Einteilen nach (neue Platz-ID je Schreiben, wie gemessen).

### Neu (Anmeldungen)

- **Dunkelmodus wie ChurchTools** (Alwin, 14.10.2026). Die Anmeldungen sind hell oder dunkel, je nachdem, was
  in ChurchTools eingestellt ist (gemessen: Klasse `light`/`dark` an `<body>`, unabhängig vom Gerät), und
  schalten mit um. Die Farben sind die von ChurchTools (Tailwind 4: zinc-900 Seite, zinc-800 Karten …).
  Die Formular-Vorschau im Baukasten bleibt in ihrem eigenen Design. Gemeinsamer Baustein für alle Apps:
  `ui/design/thema.ts` und ein eigener Farbblock in `_variables.scss`; die Musik-App und der Dienstplaner
  bleiben, wie sie sind, bis sie umsteigen (`docs/entwicklung/dunkelmodus.md`). Der Erweiterungs-Bau
  schreibt dafür jetzt auch Selektoren mit mehreren Attributen am `html` richtig um.
- **Zahnrad wie in ChurchTools:** Der Knopf „Einstellungen“ zeigt das Zahnrad von „System-Einstellungen“
  (Font Awesome „gear“, solid; CC BY 4.0). Stehen „Einstellungen“ und „Neue Veranstaltung“ beide im Kopf,
  bleiben sie zusammen rechts (vorher schwebte „Einstellungen“ mitten in der Zeile).
- **Formular-Adresse zum Testen:** Neben `https://…` ist auch `http://localhost:<Port>` erlaubt (das Formular auf
  dem eigenen Rechner), bis die eigene Adresse der Gemeinde steht.
- **Karte „Anmeldelink“** (Entwurf `link-kopieren-v2`, Alwin: „B – bitte mit einheitlichen Buttons“): Ist eine
  Veranstaltung freigegeben und die Formular-Adresse eingerichtet, steht oben auf ihrer Seite der Link als Text,
  dazu drei gleiche Knöpfe **Kopieren** (danach kurz „Kopiert“), **Öffnen** (neuer Tab) und **Teilen** (Teilen-Menü
  des Geräts; fehlt, wo der Browser keins hat). Vorher stand der Link nur im Termin-Fenster. Das Kopieren beider
  Stellen läuft über einen gemeinsamen Hook (`useLinkKopieren.ts`).
  **Erst geprüft, dann gezeigt** (Alwin, 15.10.2026): Die Karte fragt wie ein Gast bei ChurchTools nach. Nimmt
  ChurchTools nichts an (z. B. vor A6-2 freigegeben und nicht öffentlich – der Link führte zu „nicht geöffnet“),
  steht statt des Links, was fehlt, und „Jetzt einrichten“ öffnet das Freigeben-Fenster; danach prüft sie neu.
  Fehlt nur der laufende Anmeldezeitraum oder lässt sich gerade nicht prüfen, bleibt der Link mit Hinweis.
- **„Erst einrichten“ mit Nummern:** Die Schritte waren in ChurchTools ohne Zahlen (ChurchTools nimmt Listen
  die Nummern).
- **Demo** (`?demo`) kennt die Gemeinde-Einstellungen (Formular-Adresse, Vorgaben); `?demo=einrichten`
  zeigt den Zustand davor. Seit A6-2 blieb die Demo sonst bei „Erst einrichten“ stehen.
- **Echt anmelden** (A6-2, #548). Gemessen 14.10.2026 an der Test-Instanz (`messung-a6-2026-10-14.md`):
  Familie, Kind allein, Geschwister mit derselben Adresse, dieselbe Person doppelt.
  - **Öffentliches Formular:** Token → Formular-Aufbau (Feldnummern) → Anmeldung, ohne Login. **Variante A**
    (Alwin): Mitglied werden nur die Teilnehmenden; was es einmal je Anmeldung gibt (neues Systemfeld „Angemeldet
    von“, Telefon, Bemerkungen, Betrag, Aufschlüsselung, Auswahl, Extras), steht bei der ersten Person. Antworten
    im Format von ChurchTools (Auswahl als Options-ID, Ankreuzen `1`, Mehrfachauswahl als Text). Passt etwas nicht
    zu ChurchTools, wird nichts geschickt. Schon bekannt → „Fast geschafft, bitte per Mail bestätigen“. Fehler
    einzeln, die Eingaben bleiben. `?probe` = Trockenlauf.
  - **Freigeben** wählt die Leitung (ohne nimmt ChurchTools nichts an), setzt die Vorgaben für neue Personen –
    **flach** (`newPersonStatusId/CampusId/DepartmentId`; `newMember: {…}` meldet 200 und speichert nichts) –,
    ergänzt fehlende Systemfelder und fragt danach wie ein Gast, ob Anmeldungen angenommen werden.
  - **Einstellungen der Gemeinde** (Gruppen-Admins): Vorgaben für neue Personen einmal je Gemeinde, im
    Datenbereich der Erweiterung; ohne Einstellung der Vorschlag. Ein Aussetzer beim Lesen wirft, statt still den
    Vorschlag zu nehmen. Anschluss an den Datenbereich über `modulPortFuer` (`ui/ct/modulPort.ts`, derselbe wie
    beim Dienstplaner; beim Zusammenführen mit E4-3 lagen zwei Fassungen vor – jetzt eine).
  - **Formular auf dem eigenen Webspace jeder Gemeinde** (Alwin, 14.10.2026: „Voraussetzung für diese Extension,
    auf keinen Fall soll unsere Domain da sichtbar werden“). Statt einer festen Adresse (`FORMULAR_ADRESSE`,
    GitHub Pages) trägt ein Gruppen-Admin unter „Einstellungen“ die Adresse der Formular-Seite ein; die
    Erweiterung prüft, ob sie antwortet und in ChurchTools als erlaubte Herkunft steht. Ohne Adresse zeigt die
    Startseite nur „Erst einrichten“, Freigeben ist gesperrt, und es gibt keinen Link. Am Release hängt das
    Formular als `anmeldungen-formular-v….zip`; der Pages-Workflow ist weg. Gemessen: In ChurchTools selbst geht
    es nicht (Erweiterungsseiten und ihre Dateien nur mit Login, kein Recht für nicht angemeldete Besucher,
    Wiki-Dateien mit `Content-Security-Policy: sandbox`).
  - Die Preis-Buchung aus den Antworten steht an EINER Stelle (`buchungAus`) – angezeigter und gespeicherter
    Betrag können nicht auseinanderlaufen. Ein Test zählte die Systemfelder als Literal – jetzt gegen die Liste.

### Intern (Musik-App)

- **Tote Hülle `server/src/utils/mapEvent.ts` entfernt** (für Nutzer unsichtbar): Sie reichte nur
  `mapEventToService` aus `shared/ct/mapEvent.ts` mit der Zeitzone aus `config` weiter, wurde aber seit dem Umzug
  der Regel nach `shared/` (#335) nirgends mehr importiert – auch nicht in Tests. Die Aufrufer
  (`setlistKern`, `ablaufAnlegen`) geben die Zeitzone selbst mit. Die Testfälle TF-ABLAUF-04 und TF-VERF-08
  verweisen unter »Betrifft« jetzt auf `shared/ct/mapEvent.ts`.

## [2.36.0] – 2026-10-15

### Neu

- **Scroll-Modus: Lieder untereinander statt blättern** (#551, Idee vom ChurchTools-Dev-Stammtisch):
  - Unter **Mehr → Während des Spielens → Liedansicht** gibt es **Blättern** (wie bisher) und
    **Scrollen**. Die Wahl gilt nur für dieses Gerät.
  - Beim Scrollen stehen alle Seiten des Ablaufs untereinander, nahtlos und jede so breit wie der
    Bildschirm – quer am iPad eine Seite statt zwei, die Schrift wird dadurch deutlich größer.
  - Es sind dieselben Seiten wie beim Blättern: Anmerkungen und „Notizen von …“ stehen an derselben Stelle.
  - Die Kopfzeile und die Punkte unten zeigen das Lied in der Bildmitte; ein Punkt holt sein Lied nach oben.
  - Ein Tipp aufs Blatt blendet die Leisten aus und wieder ein.
  - Pedal und Pfeile unten scrollen ⅔ Bildschirm weiter; eine gestrichelte Linie zeigt kurz, wo der
    Bildschirm vorher endete.
  - Zum Malen öffnet der Stift die sichtbare Seite einzeln (alle Werkzeuge wie gewohnt); danach geht es
    an derselben Stelle weiter.
- **Pedale:** Die Liedansicht versteht jetzt auch ↓/↑, Bild↓/Bild↑ und die Leertaste (Umschalt+Leertaste
  zurück) – vorher nur ←/→, viele Bluetooth-Pedale taten darum nichts. Gedrückt gehaltene Tasten lösen
  keinen Dauerlauf mehr aus. Gilt fürs Blättern wie fürs Scrollen.

### Hinzugefügt (Dienstplaner)

- **Entwürfe ändern und entfernen** (#564, Bauplan E4-3-3): Einen Entwurf in der Matrix antippen öffnet sein Fach –
  wer, „Eingetragen von Spike, heute 18:42“, „Beim Senden: Anfrage senden | Direkt zuteilen“ (nicht bei Gästen),
  „Andere Person wählen“ (ersetzt ihn, „direkt“ bleibt) und „Entfernen“. Ein Konflikt mit einem anderen Planer
  steht da, mit „So lassen“ oder bewusst „Trotzdem …“.
- **Veraltete Entwürfe** (Alwin: Schild am Platz): Steht in ChurchTools inzwischen etwas anderes als beim
  Eintragen, zeigt die Matrix ChurchTools und darunter ein kleines Schild „Entwurf veraltet“. Antippen sagt, was
  dort jetzt steht, und bietet „Entwurf verwerfen“. Verglichen wird mit derselben Regel wie beim Einteilen – jeder
  Platz trägt dazu seine Belegung aus `belegungAus`.
- **Leiste unten:** „N Entwürfe noch nicht gesendet“ (nur gültige im geladenen Zeitraum, am Handy kurz „N
  Entwürfe · Senden folgt“). Senden selbst kommt mit E4-4.
- **Als Entwurf eintragen** (#561, Bauplan E4-3-2, Entwurf `e4-3-entwurf.html`): Im Fach „Wer kann?“ sind die
  Personen jetzt antippbar – sie stehen danach **als Entwurf** im Plan (blau gestrichelt mit Stift), **noch ohne
  Anfrage**. Darunter „Jemand ohne ChurchTools-Konto“ für einen Gast. Fremde Entwürfe tragen den Namen des
  Planers, Gäste das Schild „Gast“. Hat jemand anderes den Platz eben geändert, steht das da – mit „Entwurf von X
  lassen“ oder „Trotzdem … eintragen“ (Alwin). Fehlt einer Dienstgruppe der Speicher, bietet der Dienstplaner
  „Einrichten“ an (nur wer in ChurchTools Kategorien anlegen darf), sonst sagt er genau, welches Recht fehlt.
  Gesendet wird noch nichts – das kommt mit E4-4.

### Intern

- **Gemeinsame Bausteine statt Kopien** (#561): Der Browser-Anschluss an den Speicher der Erweiterung
  (`ui/ct/modulPort.ts`), das Kürzel aus der Bau-Adresse (`ui/erweiterung/kuerzel.ts`) und der Hinweis-Toast
  (`ui/fenster/Toast.tsx`, `useToast.ts`) standen nur in der Musik-App; jetzt nutzen beide Apps dieselben. Die
  Musik-App reicht sie nur weiter, ihr Verhalten bleibt gleich. `kategorieAusListe` hält die Regel „bei gleichem
  Kürzel die kleinste ID“ für eine schon geladene Liste – ohne sie nachzubauen.
- Die Demo (`?demo`) spielt den Speicher nach (Kategorien, Werte, Rechte des Anlegers) und hat einen Entwurf von
  Spike.

### Behoben

- **Gleiche Kategorie, verschiedene Geräte** (#558): ChurchTools nimmt dasselbe Kürzel für zwei Kategorien an
  (gemessen 14.10.2026). `kategorieSuchen` nahm bisher die erste in der Liste – je nach Antwort hätten zwei
  Geräte in verschiedene Kategorien geschrieben. Jetzt nehmen alle die mit der kleinsten ID. Gilt auch für die
  Einstellungen und Team-Notizen der Musik-App.

### Intern

- **Speicher-Kern für Entwürfe** (#558, Bauplan E4-3, erste Scheibe – noch ohne Oberfläche):
  `shared/dienstplan/entwuerfe.ts`. Noch nicht gesendete Einteilungen liegen im Speicher der Erweiterung,
  **eine Kategorie je Dienstgruppe** (Alwin), ein Wert je Platz (Termin + Dienst + `index`, nie die flüchtige
  Platz-ID) mit Version, „von wem“ und dem, was beim Eintragen in ChurchTools stand. Speichern und Entfernen
  lesen frisch, vergleichen die Version und lesen nach – eine andere Version ist ein Konflikt, nie ein stilles
  Überschreiben; kein Schreibvorgang wird automatisch wiederholt. Doppelte Werte (zwei gleichzeitige
  Anlegen) bekommen einen festen Gewinner. Ein Entwurf ist veraltet, sobald in ChurchTools etwas anderes
  steht – dieselbe Regel wie beim Einteilen (`gleichePerson`). Der Stand der Schublade (fehlt, einrichtbar,
  nur lesen, bereit) kommt aus den Rechten. Echt an der Test-Instanz geprüft (Wegwerf-Kategorie, danach
  gelöscht).
- **`modulSuchen`** meldet ein fehlendes Modul mit dem Namen des Aufrufers statt fest „Die Musik App“ (#558).

## [2.35.1] – 2026-10-14

### Hinzugefügt (Dienstplaner)

- **Zeitraum wählen** (#549, Alwin: „was heißt weitere Termine laden? Macht man das nicht über das + oben?“):
  - Der Datumsbereich in der Terminleiste der Matrix ist ein Knopf mit Menü: **Ab heute** (wie bisher,
    passend zur Fensterbreite), **Dieser Monat**, **Nächster Monat** oder ein **eigener Zeitraum** von–bis.
    Bei einem Monat oder eigenen Zeitraum stehen alle seine Termine in der Matrix; ‹ › springen um einen
    Monat bzw. um die eigene Länge. Das Gerät merkt sich die Wahl.
  - „Weitere Termine laden“ unter der Matrix entfällt: Bei „ab heute“ laden ＋ und › am Ende selbst nach,
    am Handy der letzte Datums-Chip. Kommt nichts dazu (lange Lücke, oder ein Filter auf eine selten
    eingesetzte Gruppe), wird weitergeladen, bis ein Jahr erreicht ist.
  - Nachladen ist jetzt still: Das Bisherige bleibt stehen, statt dass die Seite neu lädt. Ein Fehler
    dabei zeigt einen Fehlerkasten neben der Liste, und „Erneut versuchen“ lädt genau einen Schritt.
    In „Termine“ zeigt der Knopf solange „wird geladen …“.
  - Den Text einer Spanne („18.10. – 08.11.2026“) gab es zweimal, einmal ohne Jahreswechsel. Jetzt
    nutzen beide `spanneText`, und ein einzelner Tag heißt „18.10.2026“ statt „18.10. – 18.10.2026“.

### Behoben (Dienstplaner)

- **Matrix am Computer** (#546, Alwin):
  - „Passend zur Fensterbreite“ ragte heraus, weil der Kopf (Datumskachel + „Mi · 19:00“) die Spalten
    dehnte. Beim Wischen rutschte dann der erste Termin unter die Dienst-Spalte. Jetzt hat die Tabelle
    feste Breiten, und die Uhrzeit bricht in schmalen Spalten um.
  - Die Dienst-Namen klebten am linken Rand, weil eine allgemeinere Tabellen-Regel den Abstand nahm.
  - Nach „＋“ wurde die Terminleiste höher, weil „an Fensterbreite anpassen“ eine eigene Zeile bekam.
    Mit #549 entfällt dieser Knopf: Zurück zu „passend“ geht es über „Ab heute“ im Zeitraum-Menü.

### Geändert (Dienstplaner)

- **Weniger Knopf-Formen** (#541, Alwin am Handy: „zu viele verschiedene Buttons“; Entwurf A aus drei):
  - Statt zweier Reihen Filter-Pillen gibt es einen Knopf **„Filter“** mit Menü: je Abschnitt
    (Veranstaltungen, Gruppen) eine Überschrift und Häkchen. Angehakt heißt „wird gezeigt“. Die Zahl am
    Knopf sagt, wie viel ausgeblendet ist.
  - Die Umschalter (Reiter oben, Matrix | Wer wie oft?, Meine | Alle, S/M/L) sind **verbunden** (eine
    Schiene).
  - Die Status-Schildchen in der Termine-Liste sind schlichter Text statt getönter Pillen.
  - Die Funktion bleibt unverändert, ebenso der Zustand, den das Gerät sich merkt. Die Musik-App behält
    ihre Umschalter: Die neue Bauart `verbunden` am gemeinsamen `Segment` greift nur, wo sie angegeben ist.
  - `FilterChips` entfällt (ersetzt durch `FilterKnopf`).

### Intern

- **Bausteine für den Zeitraum** (#549): `plusTage`, `monatPlus` und `letzterTag` liegen jetzt in
  `shared/ct/datum.ts`. Die Musik-App holt sie von dort (`client/src/utils/monate.ts` und `wochen.ts`
  geben sie nur weiter). Die Regeln des Zeitraums stehen in `shared/dienstplan/zeitraum.ts`. Das
  Aufklapp-Menü (zu bei Tipp daneben oder Escape) ist ein gemeinsamer Hook `useAufklapp` für Filter- und
  Zeitraum-Knopf. Die Demo (`?demo`) beachtet jetzt `from`/`to` wie ChurchTools.
- **Monatsnamen an einer Stelle** (#535): Sie standen viermal von Hand im Code (`shared/ct/datum.ts`,
  `client/src/utils/monate.ts`, `client/src/pages/Agenda.tsx`, `shared/ct/mapEvent.ts`), und
  `kachel()` bildete die Kurzform noch einmal selbst. Jetzt gibt es `MONATE` und daraus abgeleitet
  `MONATE_KURZ` (die ersten drei Buchstaben, bei allen zwölf Monaten gleich) in `shared/ct/datum.ts`,
  alle anderen Stellen nutzen sie. Die Anzeige bleibt gleich: Die neuen Tests über alle zwölf Monate sind
  auch gegen den alten Code grün.

### Behoben

- **Endlosschleife beim ersten Öffnen eines Ablaufs** (#555, kritisch): Hatte jemand für einen Ablauf noch
  keinen „gesehen“-Stand – also bei jedem neuen Gottesdienst beim ersten Öffnen –, speicherte die App den
  Stand immer wieder, solange die Ablauf-Ansicht offen war: rund **6 ChurchTools-Anfragen pro Sekunde** je
  Gerät (gemessen in der Test-Instanz: 280 Anfragen in 45 s). Seit v2.34.1 (#484) in Web-App und
  Erweiterung. Ursache: Nach dem Speichern setzte die App nur die markierten Punkte im Speicher auf
  „gesehen“; Punkte ganz ohne Angabe blieben so – und das galt wieder als „noch nie gesehen“. Jetzt
  bekommt jeder Punkt „gesehen“; ein Test verdrahtet den Ablauf wie die App selbst und zählt: genau ein
  Schreiben.

- **Datumsfelder am iPhone** (#539): Safari gibt Datumsfeldern eine eigene Mindestbreite und mittigen Text –
  im Anmeldeformular ragte das Geburtsdatum dadurch über die Nachbarfelder (Bildschirmfoto von Alwin). In der
  Musik-App betraf es „Abwesenheit eintragen“ (Von/Bis zweispaltig) und den Zeitraum der Statistik. Neuer
  gemeinsamer Baustein `datumsfeld` in `ui/design/_mixins.scss`; die Spalten der Abwesenheit sind jetzt
  `minmax(0, 1fr)`. Weil die Statistik-Felder leer starten, haben sie eine feste Höhe (sonst fiele ein leeres
  Feld am iPhone zusammen). In Chrome in Handygröße nachgemessen, Höhen wie vorher; am iPhone zu bestätigen.
- **Scrollen im Scrollen** (#537, Alwin am Handy): In „Wer kann?“ (Dienstplaner), „Zum Ablauf hinzufügen“
  und „Abschnitte transponieren“ (Musik-App) hatte die Liste eine eigene Scrollfläche im ohnehin scrollenden
  Fenster. Jetzt scrollt nur das Fenster. Die Regel steht am gemeinsamen Baustein `ui/fenster/Sheet.tsx`.

### Neu (Dienstplaner, E4-2)

- **Fach „Wer kann?“** (#533, Entwurf v17): Einen freien Platz in der Matrix antippen, am Computer wie am
  Handy, zeigt die Leute aus der ChurchTools-Gruppe des Dienstes. Oben stehen die, die frei und selten
  dran sind. Bei jeder Person steht „frei“, „abwesend: Grund“ oder „am Tag schon: Dienst“, dazu
  „N× im Monat“; ab 7 Personen gibt es ein Suchfeld. Antippbar sind freie Plätze nur dort, wo man den
  Dienst planen darf oder Admin des Termins ist. Vorerst nur zum Ansehen, Einteilen kommt mit E4-3.
  **Frühere Absagen werden nicht gezeigt und zählen nicht für die Reihenfolge** (Alwin, 14.10.2026):
  ChurchTools unterscheidet über die Schnittstelle nicht zwischen „hat abgesagt“ und „vom Planer
  herausgenommen“, rechnet aber −500 Punkte ab. Den privaten Kommentar einer Abwesenheit zeigt das Fach
  nicht. Geladen wird erst beim Öffnen (`possiblepersons` je Dienst) und zwei Minuten gemerkt.
- Intern: `shared/dienstplan/werKann.ts` (Regeln), `PlanPlatz.index` und `PlanZeile.planbar`,
  `monatName` in `shared/ct/datum.ts`.

### Neu (Dienstplaner, E4-1)

- **Schreibkern zum Einteilen** (#531, noch ohne Oberfläche): `shared/dienstplan/einteilen.ts` bringt einen
  Platz sicher auf eine neue Belegung (Anfrage, Zusage, Gast oder frei). Dafür wird erst frisch gelesen.
  Steht inzwischen jemand anderes da, gibt es einen Konflikt statt eines Überschreibens. Dann wird
  geschrieben, und danach wird nachgelesen: Erfolg ist erst, wer am Platz steht. Gemessen in E4-0:
  Jedes Schreiben vergibt eine neue Platz-ID, deshalb wird der Platz über Dienst und `index` gemerkt.
  Leeren per PUT lehnt ChurchTools ab, Zurückziehen geht über `decline`. Kein Schreibvorgang wird
  automatisch wiederholt. Bei einem vorübergehenden Fehler wird nachgelesen, statt nochmal zu senden.
  Jeder Fehlerfall hat einen eigenen Ausgang. Echt geprüft am Mess-Termin der Test-Instanz.

### Behoben (Dienstplaner)

- **Matrix zeigte halbe Dienstgruppen** (#525, gefunden bei der Prüfung mit drei Rollen in der
  Test-Instanz): Wer eine Dienstgruppe nicht ganz sehen darf, bekommt von ChurchTools daraus nur die
  eigenen Einträge. Die Matrix stellte die übrigen Plätze dann als „nicht vorgesehen“ dar, und bei
  „Wer wie oft?“ fehlten Leute. Jetzt zeigen Matrix, Gruppen-Filter, Kopfzeile und „Wer wie oft?“ nur
  Dienste, die ChurchTools vollständig liefert: Dienstgruppe für alle sichtbar, Recht zum Sehen oder
  Bearbeiten, oder Leitung einer Gruppe des Dienstes (`siehtDienstGanz`, eine Regel). Die eigenen
  Dienste stehen weiter unter Start und Termine. Die Prüfung mit drei Rollen (Admin, Leitung von
  Technik, Mitglied) war sonst ohne Befund.
- „Wer wie oft?“ brach im Reiter Planen bei mittlerer Breite zweizeilig um (#529).

### Geprüft (Dienstplaner, E3)

- **E3 abgeschlossen** (14.10.2026): lesend an der Live-Instanz mit Alwins Konto gegengeprüft, nur GET,
  mit den Regeln des Dienstplaners über die echten Antworten. 18 Termine in 8 Wochen (217 KB, 0,2 s),
  7 Dienstgruppen, 199 Plätze. Kein unbekannter Dienst, Kopfzeile und Zeilen zählen gleich, „Wer wie
  oft?“ zählt jeden besetzten Platz genau einmal. Uhrzeiten stimmen über die Zeitumstellung hinweg.

### Neu (Dienstplaner, E3-5)

- **Die Matrix wird bedienbar** (#523, Entwurf v17): Terminleiste ‹ ＋ Zeitraum ＋ › – „passend zur
  Fensterbreite“ oder fest, mit „an Fensterbreite anpassen“ zurück –, Spaltenbreite S/M/L, Filter nach
  Veranstaltung (aus den Terminnamen, wie in der Termine-Liste) und nach Gruppe, beides im Gerät gemerkt.
  Termine einer anderen als der häufigsten Veranstaltung sind leicht abgesetzt (bei der ECG die
  Gebetsabende), die Kopfzeile ist einheitlich hoch. **„Wer wie oft?“**: Einsätze je Person im sichtbaren
  Zeitraum und in den sichtbaren Gruppen, mit Schnitt. „Abgesagt“ und die Monatsauslastung kommen mit E4
  (aus `possiblepersons`, 2,6 s und 508 KB je Termin – nur bei Bedarf).
- Intern: `FilterChips` (eine Gestaltung für Termine-Liste und Matrix), `geraet.ts` (Merken im Gerät an
  einer Stelle, auch für die Termine-Liste), `useBreite` misst per Callback-Ref – mit `useRef` maß es nie,
  weil der Bereich erst nach dem Laden erscheint (im Browser gefunden).

### Neu (Dienstplaner, E3-4)

- **Planen-Matrix** (#521, Entwurf v17, nur lesen): Termine als Spalten (Füllstand, „N frei“, abgesagt
  blass), Dienstgruppen als aufklappbare Zeilen mit freien Plätzen je Termin – was man plant, ist offen und
  „du planst“ –, darunter je Dienst die Plätze: zugesagt, angefragt, frei, Gast, „Nicht sichtbar“ (Namen
  verbergen). Am Handy eine Datumsleiste und ein Termin. Dieselbe Abfrage wie Start und Termine.
- **Wer planen darf** (gemessen in E0): globales Recht auf die Dienstgruppe **oder** Leitung einer
  ChurchTools-Gruppe des Dienstes **oder** Admin des Termins (`darfDienstPlanen`, eine Regel für Reiter,
  Startseite, Termine und Matrix). Vorher zählte nur das globale Recht – Gruppenleiter sahen „Planen“ nicht.
  Bei der ECG ist jeder Dienst einer Gruppe zugeordnet (live gemessen, nur lesend).

### Neu (Anmeldungen)

- **Öffentliches Formular anzeigen** (A6-1, #542 – erste von fünf Scheiben von A6). Die Seite `formular/` liest
  die Veranstaltung **ohne Login** aus ChurchTools (`/publicgroups/{id}`, `/info`) und zeigt sie mit demselben
  Formular wie der Baukasten. Link wie gehabt `…/#<instanz>/<gruppe>` (`ortAusLink` ist das Gegenstück zu
  `anmeldeLink`, nur Rechnername und Nummer). Abschicken ist noch ein **Probelauf** – echt anmelden kommt in A6-2.
  - Fehlerfälle einzeln: nicht freigegeben (403), nicht gefunden (404), keine Anmeldung hinterlegt, vorübergehend
    (429/5xx/Zeitüberschreitung nach 15 s → „Noch einmal versuchen“), keine Verbindung (Netz weg oder Seite für
    diese Gemeinde nicht freigeschaltet – sieht für den Browser gleich aus). Nimmt ChurchTools gerade keine
    Anmeldungen an (`canSignUp`), steht das oben.
  - **Freigeben macht die Anmeldung für Gäste lesbar** (`visibility: 'public'`, nachgelesen). Gemessen 14.10.:
    Ohne das liefert `/publicgroups` ohne Login 403, auch freigegeben – alle freigegebenen Testgruppen waren
    unsichtbar. Eine Liste aller öffentlichen Gruppen gibt es nicht (404); gefunden wird eine Anmeldung nur über
    ihren Link. Die Regel steht in `setzeStatus`, weil auch „Verwalten“ und „Rückgängig“ darüber freigeben.
  - Die Tests von `formular/` liefen bisher gar nicht mit – jetzt im gemeinsamen Testlauf.

- **Design frei einstellbar** (Entwurf v3, Alwin, 13.10.2026: „Diese Vorlagen sollten nicht so starr sein …
  gefällt mir sehr gut, gerne so umsetzen“). Die sechs Vorlagen sind nur noch **Startpunkte**; danach ist alles
  einzeln änderbar: Aufbau (Kopfband, Bild über alles, zweigeteilt, Karte), Kopfhöhe und Ausrichtung, Logo
  (Gemeindelogo aus ChurchTools – oben in der Mitte oder links daneben – oder keins), Hintergrund (Farbe, Muster
  Punkte/Konfetti/Sterne/Wellen/Raster in eigener Farbe, Titelbild), Haupt-, Seiten-, Formular- und
  Schriftfarbe, Schrift für Überschriften und Text, größere Schrift, Ecken, Schatten, Rahmen, bunte Abschnitte,
  Eingabefelder, Knopf. Die Leiste zeigt, was seit dem Startpunkt geändert ist. Ältere Einstellungen bekommen
  das Fehlende aus ihrer Vorlage; gespeichert wird nur, was abweicht (sonst brauchte die Sicherung zwei Felder).
  - Gemessen: Das Gemeindelogo steht angemeldet in `/config` (`site_logo`), ohne Login nicht; die Bildadresse
    selbst ist öffentlich – die Erweiterung übernimmt sie in die Gestaltung.
  - Ziehen ruckelt nicht mehr: Felder gleiten an ihren Platz, Mitscrollen gleichmäßig.
  - Steht das Logo oben in der Mitte, steht auch der Titel mittig (Alwin, 14.10.2026) – sonst wirkt der Kopf
    schief.
  - Der Name im Baukasten bricht um, statt am Handy abgeschnitten zu werden; Enter speichert wie bisher.
  - Beim Ziehen verschwindet das Feld, an seiner Stelle steht nur „Hier loslassen“ (Alwin, 14.10.2026: „muss
    nicht mehr in grau angezeigt werden“). Ausgeblendet wird erst nach dem Start des Ziehens – während
    `dragstart` bricht Chrome sonst ab; mit echter Maus geprüft (versteckt nach 9 ms, Ablegen 1 s später).
  - **Datumsfeld am iPhone** (Alwin, 14.10.2026, Bildschirmfoto): Das Geburtsdatum ragte rechts über die
    anderen Felder hinaus – Safari gibt Datums- und Zeitfeldern eine eigene Mindestbreite. Gemeinsamer Baustein
    `datumsfeld` in `ui/design/_mixins.scss`, eingesetzt im Anmeldeformular und in den Fenstern der Anmeldungen;
    gleiche Höhe wie die anderen Felder. In Chrome nachgemessen, am iPhone noch zu bestätigen.
  - **Klarere Linien, am Handy kein Ziehen** (Entwurf v6, Alwin 14.10.2026: „mich verwirren die vielen
    gestrichelten Linien“, „die 6 Punkte funktionieren nicht“, „am Handy passieren ungewollte Sachen“):
    - Keine Rahmen mehr um Felder: Maus darüber = hellblau, gewählt = kräftiger blau (immer das
      ChurchTools-Blau, nicht die Farbe des Designs). Gestrichelt ist nur noch die Lücke beim Ziehen.
    - Der Personen-Teil ist grau hinterlegt; im Baukasten steht „wiederholt sich für jedes Kind“.
      „+ Weitere Person“ und das Antwort-Muster sind nicht mehr gestrichelt (auch im öffentlichen Formular).
    - Die 6 Punkte (Griff) sind weg; gezogen wird am ganzen Feld.
    - Pfeile, Kopieren, Entfernen erscheinen **nur am gewählten Feld** (unten im Feld), nicht mehr beim
      Darüberfahren – am Handy blieben sie nach dem Antippen über der Frage hängen. Name und E-Mail lassen sich
      dafür wählen (nur ↑ ↓, „gehört immer dazu“).
    - **Am Handy** (`pointer: coarse`) lässt sich nichts ziehen – Ziehen und Scrollen kamen sich in die Quere.
      Feld antippen, ↑ ↓; ein neuer Baustein landet unter dem gewählten Feld.
    - ⓘ auch an „Kontakt“ (einmal je Anmeldung); das ⓘ hängt am letzten Wort der Überschrift.
  - **Woher kommt was?** (Alwin, 14.10.2026: „nicht ganz klar, was woher kommt und was warum Pflicht ist“;
    Entwurf v5 nach einem verworfenen v4 mit Schlössern und Schildchen). Ein kleines ⓘ an Name, E-Mail, Name
    jeder Person, Geburtsdatum, Datenschutz und an „Wer nimmt teil?“ / „Auswahl und Extras“; antippen zeigt
    den Grund. Im Feld ist der Inhalt `inert` – der Tipp landet bei der Hülle, die das ⓘ an der Stelle sucht
    (im Browser mit echter Maus geprüft). **„Wer meldet sich an?“** und „Geburtsdatum abfragen“ stehen jetzt
    auch oben in der Leiste.
  - Beim Bauen gefunden: Ob die Preise das Geburtsdatum brauchen, stand dreimal im Code – im Feld-Bearbeiten
    ohne den Geschwister-Rabatt. Jetzt eine Stelle (`wozuGeburtsdatum`); ebenso „Wer meldet sich an?“ ändern
    (`mitWer`) für Reiter und Leiste.
  - **Eigenes Logo** (Alwin, 14.10.2026): unter „Logo → Eigenes“ die bisherigen Logos zur Auswahl und „Neues
    hochladen“. Gemessen: ChurchTools kennt je Gruppe nur ein Bild, Anhänge sind nur vorübergehend und ohne
    Bildadresse. Deshalb liegt jedes Logo als Bild einer Hilfsgruppe, die gleich archiviert angelegt wird (Art
    und Team wie die Veranstaltung, also dieselben Rechte). Das Bild ist ohne Login abrufbar, auch archiviert;
    wird die Gruppe gelöscht, ist es weg (404). Die Gruppen tragen eine Kennung und erscheinen weder in der
    Übersicht noch im Archiv. Klappt das Hochladen nicht, wird die halbe Gruppe wieder entfernt. Entfernen nur
    für Gruppen-Admins, mit Warnung; von selbst wird nichts gelöscht, weil Kopien dasselbe Logo nutzen.

- **Feinheiten am Baukasten** (Alwin, 13.10.2026: „wenn du es genauso schaffst zu bauen, bin ich echt happy“).
  - **Alles verschiebbar** – auch Name, E-Mail und Bemerkungen (jeweils in ihrem Bereich). Nur Preisbereich und
    Datenschutz bleiben direkt vor dem Absenden. Das Formular zeigt die Anmeldung in der gespeicherten
    Reihenfolge.
  - **Beim Ziehen öffnet sich eine Lücke** „Hier loslassen“ (wie bei Campflow) statt der blauen Linie.
  - **Mehr Design (wie Jotform):** Schrift (Rund, Mit Serifen, Klassisch, Gut lesbar – nur Systemschriften,
    nichts von Google), eigene Farben für Seite, Formular und Schrift (zurück auf „wie Vorlage“), Breite des
    Formulars. Ein Vorlagenwechsel nimmt die eigenen Farben zurück.
  - **Kopf:** Preis, Plätze und Anmeldeschluss mit Symbol. Gemeindename und Zeichen im Kopf sind weg (Alwin).
    „Titelbild ändern“ steht nur noch im Bild (dort auch „entfernen“), nicht mehr zusätzlich unter „Design“.
  - **Titelbild scharf:** ChurchTools liefert als `imageUrl` ein Vorschaubild mit 150×150 Pixeln – das Bild war
    verzogen und unscharf (Alwin). Jetzt in voller Breite über den Bilddienst (`?w=1600&h=0`, ohne Login
    abrufbar, Seitenverhältnis bleibt; gemessen).
  - **Ziehen** (Alwin: „Lücke springt“, „hakelig“): Die Stelle wird an den Plätzen vom Start des Ziehens
    gerechnet, nicht an den Feldern, die die Lücke gerade verschoben hat – so springt sie nicht mehr hin und her
    (wie SortableJS). Das ganze Feld lässt sich greifen, nicht nur der Griff; am Rand scrollt die Seite mit; ein
    vorhandenes Feld wird beim Ziehen blass (ausblenden bricht das Ziehen in Chrome ab – kurz so ausgeliefert,
    „geht jetzt gar nicht mehr“, mit echter Maus nachgestellt); „ganz unten“ im Kontakt heißt beim Ziehen
    wirklich unter die Bemerkungen.
  - **Leiste:** Gruppen zum Einklappen mit Zahlen („5 von 8 im Formular“), Haken an Bausteinen, die schon
    drin sind, Kacheln heben sich beim Zeigen.
  - **Fragetyp ändern** unten im Feld – solange niemand geantwortet hat. ChurchTools ändert den Typ einer
    Spalte nicht (PATCH antwortet 200 und lässt ihn, gemessen); deshalb neue Spalte statt alter.

- **Formular-Baukasten mit Design und Vorschau** (Bauplan A5) – ein Reiter „Formular“, aufgebaut nach Alwins
  Vorbildern vom 13.10.2026 (Baukasten wie Campflow, Design wie Jotform, Bearbeiten wie Google Forms).
  - **In der Mitte das echte Formular** – dieselbe Darstellung wie für Gäste. Bausteine aus der Leiste rechts
    an die richtige Stelle **ziehen** (eine blaue Linie zeigt, wo sie landen) oder **antippen** (unter das
    gewählte Feld). Felder **direkt im Formular bearbeiten**: Frage, Hilfetext, Antworten, „Pflicht“.
    Verschieben am Griff oder mit den Pfeilen (Handy, Tastatur), kopieren, entfernen. Name und
    Begrüßungstext direkt im Kopf, „Titelbild ändern“ im Bild.
  - **Bausteine:** empfohlene mit fester Bedeutung (Geburtsdatum, Telefon, Anschrift, Notfallkontakt,
    Allergien, Gesundheit, Foto-Erlaubnis, Bemerkungen – je einmal), eigene Fragen (Text, Ja/Nein,
    Ankreuzen, Auswahl, Mehrfachauswahl, Datum, Zahl) und Gestaltung (Überschrift, Hinweistext,
    Trennlinie). Suche, Platzanzeige, ausgeblendete Felder lassen sich zurückholen.
  - **Design** in derselben Leiste: sechs Vorlagen mit Vorschaubild, Farben, Feldstil, Knöpfe,
    Titelbild (Gruppenbild), Gemeindename. Jede Änderung sieht man sofort im Formular. Umschalter
    Computer/Handy und „Vorschau“ zum Ausprobieren mit Musterdaten. Schriften ohne Google (Datenschutz).
  - **Gespeichert wird von selbst** – nach dem Ziehen, beim Verlassen eines Felds, nach einer kurzen
    Pause beim Tippen –, eins nach dem anderen, mit „Rückgängig“; scheitert etwas, steht es oben mit
    „Nochmal“.
  - Die Leiste **„Rückgängig“ schwebt jetzt unten** über der Seite (in der ganzen Erweiterung), statt oben
    Platz zu nehmen – beim Speichern von selbst schob sie sonst jedes Mal das Formular nach unten.
  - **Jedes Feld wird eine Spalte der Mitgliederliste** auf Sicherheitsstufe 3 (Alwin: „nur das Team“).
    Antworten umbenennen behält die Wahl der Personen – auch wenn man umbenennt, bevor die Antworten aus
    ChurchTools geladen sind; **entfernen mit vorhandenen Antworten blendet nur aus** (Alwin) – gemessen:
    Löschen hätte die Antworten still entfernt. Empfohlene Felder werden nur ausgeschaltet.
  - **Einstellungen unsichtbar** (Alwin: der Datenblock in „Infos“ „sieht nicht gut aus“): dort
    steht nur noch ein Satz, die Einstellungen stehen gepackt als unsichtbare Markdown-Zeile darunter
    (gemessen: ChurchTools zeigt sie nicht an). Gepackt ist der Block rund ein Drittel so lang – auch
    große Freizeiten passen (ungepackt 5.532 von 5.000 Zeichen). **Sicherung** in den Beschreibungen
    der Systemfelder; überschreibt jemand die Beschreibung in ChurchTools (der Editor wirft die
    unsichtbare Zeile weg – gemessen), stellt die Erweiterung sie selbst wieder her und behält den
    neuen Text. Ältere Veranstaltungen werden beim Öffnen umgestellt.
  - Termin-Fenster beginnt beim Kalender des gewählten Termins; Admins lesen auf der Startseite
    „Freigeben kannst du als Admin“ (beides aus der A3-Abnahme).

## [2.35.0] – 2026-10-13

### Neu

- **Ablauf direkt in der App anlegen** (Wunsch Alwin, 13.10.2026): Bisher musste man für eine Veranstaltung
  ohne Ablauf erst in ChurchTools einen anlegen. Jetzt stehen kommende Veranstaltungen ohne Ablauf mit
  „Kein Ablauf" in der Terminliste, und „Ablauf anlegen" erzeugt ihn – **aus einer Vorlage**
  (vorausgewählt, die des eigenen Kalenders zuerst), **wie eine frühere Veranstaltung** (meist der letzte
  Sonntag, samt Liedern) oder **leer**. Danach öffnet sich der neue Ablauf. Welche Veranstaltungen
  erscheinen, legt die Verwaltung unter **Termine ohne Ablauf** fest: Kalender und, wenn nötig, ein Wort im
  Namen (bei der ECG liegen Gottesdienst und Gebetsabend im selben Kalender). Ohne Recht „Ablauf
  bearbeiten" sieht man die Termine, aber ohne „Ablauf anlegen". Die App liest vor dem Anlegen nach, ob es
  schon einen Ablauf gibt, und danach, ob er wirklich da ist.

### Geändert

- **Abgeschlossener Ablauf: Öffnen als Knopf oben rechts** (Alwin, 13.10.2026): Statt des großen Kastens
  über dem Ablauf steht beim Bearbeiten oben rechts das offene Schloss („Ablauf öffnen", ohne Rückfrage).
  Will man trotzdem etwas ändern – Punkt antippen, ziehen oder das Plus –, sagt ein Hinweis unten, dass
  der Ablauf abgeschlossen ist und erst wieder geöffnet werden muss.
- **Reiterleiste in den ChurchTools-Erweiterungen schmaler** (#504, Musik-App und Dienstplaner): Im
  Handy-Browser fällt das Polster für den Home-Strich weg (nur noch der echte Abstand des Geräts + 6 px,
  ~60 statt 88 px). Die installierte Musik-App bleibt, wie sie ist. Die Höhe steht jetzt als Token
  `--reiter-polster` an einer Stelle; der Update-Hinweis, der über der Leiste schwebt, rechnet damit statt
  mit einer eigenen Kopie der Formel.

### Behoben

- **Ein leerer Ablauf ließ sich nicht bearbeiten:** Ohne einen einzigen Punkt fehlte oben der Stift – ein
  Ablauf ohne Punkte (etwa „Leer" angelegt) war eine Sackgasse. Der Stift steht jetzt immer da.
- **Verwaltung erst mit geladenen Einstellungen** (beim Bau von „Ablauf anlegen" gefunden, 13.10.2026):
  Öffnete man direkt nach dem Start ein Fenster der Verwaltung, bevor die Einstellungen vom Server da
  waren, zeigte es die Vorgaben („nichts gewählt") – und ein Speichern hätte die echte Einstellung
  überschrieben. Das galt für alle Fenster (Name, Links, Termin-Arten, Gruppen, Rollen). Die Verwaltung
  erscheint jetzt erst, wenn die Einstellungen geladen sind.

### Intern

- **Wächter für CSS-Klassen** (`client/src/cssKlassen.test.ts`): Jede in einer Komponente benutzte Klasse
  eines CSS-Moduls muss in dessen Stildatei stehen – sonst steht das Element still ungestylt da. Anlass:
  Beim Zusammenführen zog die Datumskachel nach `ui/bedienung/DatumKachel` um, die neue Zeile „Kein
  Ablauf" nutzte noch die alten Klassen (vor dem Release gefunden; die Kachel hat jetzt `gedimmt`). Dabei
  zwei alte Reste entfernt: `feld.form` (gab es nie) und `styles.verse` (seit dem Redesign weg).

### Neu (Dienstplaner, E3-3)

- **Startseite** (#518, Entwurf v17): „Als Nächstes“ mit deinem Dienst, dem Team (fünf Namen, dann „und N
  weitere“; „Namen verbergen“ wird beachtet), den Liedern aus dem Ablauf, dem Ende und dem Knopf zur
  Musik-App, wenn sie installiert ist; „Für dich offen“ (deine Anfragen, mit Warnung bei Abwesenheit);
  „Deine nächsten Dienste“ (→ Termine, Meine); Abwesenheiten (Anzahl); für Planer freie Plätze je
  Dienstgruppe in den nächsten 6 Wochen. Start und Termine laden dieselbe Liste einmal. Was nicht lesbar
  ist (Ablauf, Abwesenheiten), fehlt – statt „kein Ablauf“ oder „nichts eingetragen“ zu behaupten.
  Die Gruppenkarte aus E2 entfällt (nicht im Entwurf).

### Neu (Dienstplaner, E3-2)

- **Termine** (#511, Entwurf v17): Liste nach Monaten mit „Meine | Alle“ (Vorgabe Meine), Filter nach
  Veranstaltung – jeder Terminname, der mindestens zweimal vorkommt, wird ein Filter, einzelne fallen unter
  „Weitere“ (nichts fest eingebaut). Plaketten mit den eigenen Diensten (zugesagt/angefragt), „abgesagt“;
  Planer sehen „N frei“ ihrer Dienstgruppen oder einen Haken, wenn alles besetzt ist. Geladen wird in
  Schritten von 8 Wochen („Weitere Termine laden“), beim Wechseln der Reiter nicht neu. Die Wahl bleibt im
  Gerät gemerkt.

### Intern (E3-2)

- **Eine Zeitrechnung:** `ortszeitAus`/`utcAus` liegen jetzt in `shared/ct/zeit.ts`, `tagAusIso` rechnet
  darüber (vorher eigene Formatierer in `zeit.ts` und `shared/anmeldung/termin.ts`, dort ohne die Regel
  „ohne Zeitzone nicht umrechnen“). `termin.ts` leitet weiter.
- Neu geteilt: `shared/ct/datum.ts` (Wochentag, Kachel, Monat – auch für die Anmeldungen),
  `shared/ct/dienste.ts` (`/services` mit Dienstgruppe und Gruppen), `shared/dienstplan/termine.ts` (die
  Regeln der Liste) und `ui/bedienung/DatumKachel` – die Kachel der Terminliste der Musik-App, die sie jetzt
  ebenfalls nutzt (CSS unverändert).

### Neu (Anmeldungen)

- **Preise, „Probe rechnen“ und Bezahlung** (#507, Bauplan A4).
  - **Karte „Preise“** auf der Seite einer Veranstaltung: Grundpreis (fest oder nach Auswahl, z. B. Zimmer
    mit Kontingent), nach Alter, Rabatte und Zuschläge (immer, Frühbucher, ab dem n-ten Kind), Extras zum
    Ankreuzen. Ein Fenster je Baustein; Beträge mit Komma („12,50“). Was nicht stimmt (`pruefeRegeln`),
    steht im Fenster und wird nicht gespeichert.
  - **„Probe rechnen“:** eine Beispiel-Anmeldung durch dieselbe Rechnung wie im Formular
    (`berechnePreis`), für alle, die die Veranstaltung sehen. Gespeichert wird nichts.
  - **Preise ändern, wenn es schon Anmeldungen gibt**, ist erlaubt (Alwin, 13.10.2026). Das Fenster
    nennt die Zahl der Anmeldungen und sagt, dass ihr Betrag bleibt.
  - **Geburtsdatum** unter „Wer meldet sich an?“ ein- und ausschalten. Gibt es Preise nach Alter oder
    einen Geschwister-Rabatt ohne Geburtsdatum, warnen Karte und Fenster.
  - **Karte „Bezahlung“:** Kontoinhaber, IBAN (Prüfziffer wird geprüft), BIC freiwillig,
    Zahlungsfrist, Verwendungszweck mit `[Nachname]`. Neue Veranstaltungen bekommen ihren Namen in den
    Verwendungszweck. Die Angaben sind öffentlich lesbar (das Formular braucht sie), deshalb nur das
    Gemeindekonto eintragen. Freigeben weist darauf hin, wenn es Preise, aber kein Konto gibt.
  - Einstellungsformat: `bezahlung` mit Standardwert, ältere Veranstaltungen bleiben lesbar.

- **Veranstaltungen verwalten, mit „Rückgängig“** (#507, Alwin 13.10.2026: „alles muss möglich sein …
  immer mit Warnungen und Rückgängig-Knöpfen“).
  - **„Verwalten“** auf der Seite einer Veranstaltung: umbenennen, Freigabe zurücknehmen, in ein anderes
    Team verschieben, löschen. Jede Aktion sagt vorher, was passiert (auch wie viele Anmeldungen
    betroffen sind).
  - **Löschen schiebt ins Archiv** (Alwin: „erst Archiv“). Unter „Gelöschte Veranstaltungen (Archiv)“
    auf der Startseite lässt sich alles wiederherstellen; es kommt als Entwurf zurück. **Endgültig
    löschen** nur aus dem Archiv, nur für Gruppen-Admins und erst, wenn man den Namen eintippt.
  - **Leiste „Rückgängig“** nach jeder Änderung, auch nach dem Speichern eines Fensters (Termin,
    Anmeldung, Preise, Bezahlung …): Sie schreibt den Stand von vorher zurück (`wiederherstellen`,
    eine Stelle für alle Fenster). Ein im Kalender neu angelegter Termin bleibt dabei bestehen.
  - **Der Verwendungszweck folgt dem Namen:** Steht der alte Name darin, ersetzen Umbenennen und
    „wie eine frühere“ ihn durch den neuen („Freizeit 2027 [Nachname]“ statt „Freizeit 2026 …“). Beim
    Durchklicken in der Test-Instanz gefunden, ebenso: „Rückgängig“ wurde nach dem Neuladen der
    Übersicht erneut angeboten, und das zweite „Endgültig löschen“ hintereinander blieb auf
    „Wird gelöscht …“ stehen – beides behoben, je mit Test.
  - **Rechte, gemessen:** Umbenennen, Status und Archiv darf, wer einrichten darf. Verschieben und
    endgültig Löschen erlaubt ChurchTools nur Gruppen-Admins; für alle anderen sind die Knöpfe gesperrt,
    mit Grund.

### Behoben (Anmeldungen)

- **Zu lange Einstellungen meldeten „ChurchTools antwortet gerade nicht“** (beim Bau von A4 gefunden).
  Sprengen die Einstellungen die 5.000 Zeichen der Gruppen-Beschreibung, sagt die Seite jetzt genau das;
  eine zu lange Einzelangabe hat eine eigene Meldung. Beides wird nicht gespeichert.
- **„kostenlos“ in der Liste, obwohl Extras oder Altersstufen etwas kosten:** `preisKurz` sagt
  „kostenlos“ nur noch, wenn wirklich nichts kostet (`kannEtwasKosten`), sonst „Preis je nach Angaben“.
  Eine Auswahl zeigt immer „p. P.“.

## [2.34.2] – 2026-10-13

### Neu (Dienstplaner)

- **Grundgerüst des Dienstplaners** (#495, Bauplan E2): neue ChurchTools-Erweiterung `dienstplaner/` (Kürzel
  `dienstplaner`). Sie zeigt, wer angemeldet ist, die Gemeinde, die eigenen Gruppen mit Leitung/Mitglied
  und welche Dienstgruppen man laut ChurchTools-Recht „Dienste einer Dienstgruppe bearbeiten“ plant.
  Scheitert das Laden vorübergehend, gibt es „Erneut versuchen“; abgemeldet ist ein eigener Zweig. Demo
  ohne ChurchTools nur im Dev-Build (`?demo`, `?demo=mitglied`, `?demo=fehler`). Eigener Release-Weg:
  Tag `dienstplan-v*` über die neue gemeinsame Vorlage `erweiterung-release.yml` (`make_latest: false`
  fest darin). Für die Musik-App und die Anmeldungen ändert sich nichts.

- **Reiter Start · Termine · Planen · Abwesenheiten** (#502, E3-1, wie im Entwurf v17): am Computer oben
  neben dem Namen, am Handy unten als Leiste wie in der Musik-App. „Planen“ nur mit Planer-Recht (vorerst
  das globale; Gruppenleitung und Termin-Admin folgen), der Gruß nur auf Start. Der Reiter steht in der
  Adresse (`#/termine`), Neuladen und Zurück funktionieren. Termine, Planen und Abwesenheiten zeigen noch
  einen Platzhalter.

### Intern (Dienstplaner)

- **Geteilt statt nachgebaut** (#502): Die untere Leiste der Musik-App ist jetzt `ui/bedienung/ReiterLeiste`
  (die `TabBar` füllt sie mit ihren Reitern, Hochscrollen und Einführungs-Ziel; die Leiste ist jetzt ein
  `<nav>` mit `aria-pressed`). `ui/bedienung/useMedienAbfrage` ersetzt zwei handgeschriebene
  `matchMedia`-Muster (Notizen-Editor, Design „System“). Gebautes CSS der Musik-App (PWA und Erweiterung)
  mit `main` verglichen: gleich bis auf Hash-Kürzel. Neu getestet: das Einführungs-Ziel der Leiste und
  „Design System folgt dem dunklen System“ (beides vorher ohne Test).

- **Geteilt statt nachgebaut** (Dienstplaner E2): `ui/ct/ich.ts` (wer angemeldet ist, Gemeinde, Gruppen –
  wirft auch, wenn ChurchTools die Gruppen ohne Liste liefert, statt „keine Gruppen“ zu zeigen),
  `ui/ct/fehlerMeldung.ts` (was bei Fehlern gesagt wird) und `ui/erweiterung/ErweiterungsSeite.tsx`
  (Rahmen: Kopf, Laden, Fehler, Version).
- `shared/ct/rechte.ts`: `idsAusRecht` (Rechte in Listenform, mit der `Number(null)`-Falle) und
  `rechteAntwortPruefen` (leere Antwort = Aussetzer) herausgezogen; `parseSongEditRight` und `rechteAus`
  nutzen sie, der Dienstplaner auch (`shared/ct/dienstRechte.ts`, `shared/ct/dienstgruppen.ts`).
- Staging baut `feat/dienstplaner-**` und `fix/dienstplaner-**` nicht (sie überschrieben sonst das
  `:staging` der Musik-App).

### Intern (Anmeldungen)

- **Die Anmeldungen nutzen die gemeinsamen Bausteine** (#498): Fehlertexte (`ui/ct/fehlerMeldung.ts`, nur
  `NichtUebernommen` bleibt eigener Sonderfall), wer angemeldet ist (`ui/ct/ich.ts`) und der Seitenrahmen
  (`ErweiterungsSeite`, `ErweiterungsRahmen`, `FehlerKasten` – neu mit Platz für einen Knopf neben dem
  Gruß und einen Hinweis unter dem Kopf). `anmeldungen/src/App.module.scss` ist weg, die Regeln stehen nur
  noch in `ui/erweiterung/`. Einzige sichtbare Änderung: Liefert ChurchTools die Gruppen ohne Liste, steht
  „antwortet gerade nicht“ mit „Erneut versuchen“ da statt still „keine Gruppen“. Neu getestet: der
  Ladefehler der Veranstaltungsseite und das Datum neben dem Gruß.

### Behoben

- **Erweiterung: Ein Aussetzer von ChurchTools meldet nicht mehr ab** (#491): Lieferte ChurchTools bei
  „Wer bin ich?" etwas Unlesbares (etwa eine Wartungsseite), zeigte die Musik-App in ChurchTools
  „nicht angemeldet", und Anmerkungen wurden bis zum Neuladen nur noch auf dem Gerät gespeichert. Jetzt
  gilt das als vorübergehend: Die App bietet „Erneut versuchen" an, der Abgleich läuft weiter.
- **Antwortet ChurchTools nicht, sagt die App das jetzt auch** (#489): Lief eine Anfrage an ChurchTools in
  die Zeitgrenze, meldete die Web-App beim Laden, Speichern und Anmelden „Interner Serverfehler" (und
  schrieb einen Stacktrace ins Log). Jetzt kommt überall „ChurchTools antwortet gerade nicht. Bitte
  später erneut versuchen." – wie in der Erweiterung. Ursache: Der Server sprach ChurchTools an neun
  Stellen mit eigenem `fetch` an, und nur der Datei-Download übersetzte die Zeitüberschreitung. Jetzt
  läuft alles über **eine** Funktion (`ctFetch`), die Zeitgrenze, Drosselung (429) und
  Zeitüberschreitung regelt.
- **Liedtext-Index hört bei einer Zeitüberschreitung auf** (gefunden bei #489): Lief ein Datei-Download
  beim Bau des Index in die Zeitgrenze, erkannte der Lauf das nicht als „ChurchTools kann gerade nicht"
  und schickte weiter Anfragen. Jetzt bricht er ab wie bei einer Drosselung.
- **Einstellungen aus der `.env` kamen nicht im Container an** (beim Doku-Abgleich gefunden, 12.10.2026):
  Die Compose-Vorlagen reichten `ERWEITERUNG_KUERZEL` und `ABLAGE_UMZUG` gar nicht durch, die
  Basis-Vorlage `deploy/docker-compose.yml` auch `COOKIE_SECURE` nicht – obwohl `.env.example` und die
  Doku genau das empfahlen. Wer dort `COOKIE_SECURE=true` gesetzt hatte, bekam trotzdem ein Cookie
  ohne „Secure" (das Log warnte). Alle drei Vorlagen reichen die Variablen jetzt mit denselben
  Standardwerten durch, die der Server annimmt. **Wer eine ältere Kopie der Compose-Datei nutzt**, ergänzt
  die Zeilen unter `environment:` (UPDATE.md).

### Intern

- **Abfrage-Schlüssel an einer Stelle** (#492): Die Schlüssel des Zwischenspeichers standen rund 70-mal
  von Hand im Code; ein Tippfehler beim Erneuern wäre still geblieben. `useSongChart` baute seinen
  Schlüssel selbst, obwohl `chartQueryKey` genau dafür angelegt war. Jetzt stehen alle mehrfach
  genutzten Schlüssel in `hooks/abfrageSchluessel.ts`, die engeren bauen auf den weiteren auf, und Ablauf
  und Liedblatt haben je eine `queryOptions`-Fabrik für Anzeige, Vorladen und Offline-Vorrat. Namen
  unverändert – der gespeicherte Zwischenspeicher bleibt gültig.
- **Text-Anmerkungen haben nur noch einen Typ** (#490): `PageTextObj` war eine Kopie von `AnnotationText`.
  Ein neues Formatfeld wäre gezeichnet und lokal gespeichert, beim Sync vom Server aber abgeschnitten
  worden (das Muster von #115). Jetzt ist `PageTextObj` ein Alias, `TextAlign`/`TextStyle` sind daraus
  abgeleitet; das ungenutzte Feld `author` entfiel. Das `_text`-Suffix der Speicherschlüssel bilden und
  entfernen jetzt nur noch `textSchluessel`/`ohneTextSuffix` – vorher von Hand an über zehn Stellen.
  `usePageDraw` liest die Texte über `readPageTexts` statt zweimal mit eigenem Code. Gespeichertes
  Format unverändert.
- **Alte Schreibfunktionen der Volume-Ablage entfernt:** `putAnnotation`, `deleteAnnotation`,
  `putSettings` und `markSeenSetlist` (samt Konto-Obergrenzen #139/#195) wurden seit dem Umzug nach
  ChurchTools (v2.33.0) nicht mehr aufgerufen, nur noch von Tests. Die Dienste lesen jetzt nur noch den
  Altbestand für den Umzug und löschen ihn danach; Tests legen Altdaten über `testHilfen/altbestand.ts` an.

### Doku

- Betriebs-Doku an den Stand angeglichen: DEPLOYMENT.md beschreibt die Prod-Vorlage (fertiges Image, nur
  hinter einem Reverse Proxy) statt eines Baus aus dem Quellcode; „Nicht angemeldet" liegt an
  `COOKIE_SECURE=true` bei HTTP, nicht an HTTP an sich; Anmerkungen liegen in ChurchTools, nicht auf dem
  Volume; Testkonzept, README (Ablauf bearbeiten, Funktionen der Erweiterung), CLAUDE.md und
  Konfigurationsmanagement nachgezogen.

### Neu (Anmeldungen)

- **Veranstaltungen anlegen und einrichten** (#486, Bauplan A3 – der erste Schritt, der in ChurchTools
  schreibt). Eigene Gruppenart „Anmeldung“; Veranstaltungen ohne Anmeldung bleiben, wie sie sind.
  - **„Neue Veranstaltung“** für Leitung, Co-Leitung und Organisatoren eines Teams (nach den Rechten, die
    ChurchTools meldet): Vorlage (einfaches Event, Kinder-Event, Freizeit) oder **„wie eine frühere“** –
    die Kopie bekommt die neuen Feldnummern, ihr Datum wird geleert. Angelegt wird ein Entwurf unter dem
    Team, mit den Feldern Betrag, Aufschlüsselung, Auswahl, Extras, Bezahlt, Bezahlt am.
  - **Seite einer Veranstaltung** mit Termin, Anmeldung (Zeitraum, Plätze, Warteliste, freie Plätze
    zeigen), „Wer meldet sich an?“, Löschfrist – und **Freigeben**. Wer nicht einrichten darf, sieht alles
    ohne „Bearbeiten“.
  - **Termin immer aus dem Kalender:** vorhandenen wählen oder neu anlegen (nur in Kalendern, in die man
    schreiben darf). Neue Termine bekommen den Link zur Anmeldung; vorhandene bleiben unangetastet (ChurchTools
    ersetzt beim Ändern den ganzen Termin), dort gibt es „Link zur Anmeldung kopieren“. Datum und Ort werden
    kopiert, nicht verknüpft.
  - **Jeder Schreibschritt wird nachgelesen;** übernimmt ChurchTools etwas nicht, sagt die Seite genau
    das, statt „gespeichert“ zu melden.
  - Einrichtung in ChurchTools (Gruppenart, Anlegen, Rechte in den Veranstaltungen, Kalender) Schritt für
    Schritt in `docs/betrieb/ANMELDUNGEN.md`.

### Behoben (Anmeldungen)

- **Ältere Einstellungen bleiben lesbar:** Neue Angaben im Einstellungsformat (`loeschfristMonate`,
  `termin`) haben Standardwerte – sonst wären Veranstaltungen, die vorher angelegt wurden, als „unlesbar“
  aus der Liste gefallen (an der Test-Instanz beim Bauen aufgefallen).
- **Veranstaltungen, in denen man selbst Mitglied ist, stehen nicht mehr unter „Deine Gruppen“**
  (ChurchTools liefert sie dort mit, gemessen).
- **Die Erweiterungen lassen sich wieder scrollen, Anmeldungen und Dienstplaner** (Abnahme A3, 13.10.2026:
  am Handy ging es nicht; der Fehler steckt seit dem Grundgerüst drin). `#root { overflow-y: auto }` in
  den `main.scss` verlor gegen die Grundregel `.ct-extension #root { overflow: hidden }`, weil Klasse + ID
  schwerer wiegt. Alles unterhalb des Fensterrands war abgeschnitten. Jetzt scrollt der gemeinsame
  Seitenrahmen (`ui/erweiterung`, `.rolle`). `#root` bleibt der feste Rahmen, deshalb wandern die Fenster
  beim Scrollen nicht mit (im Browser gemessen).
- **Link zur Anmeldung als Text:** Bei einem vorhandenen Termin steht der Link jetzt in voller Länge da,
  darunter „Link kopieren“. Lässt der Browser das Kopieren nicht zu, ist der Link markiert und es gibt
  einen Hinweis.

## [2.34.1] – 2026-10-12

### Geändert

- **Schildchen „neu"/„geändert" verschwinden mit dem Hinweis** (Alwin, 12.10.2026: „nur ein kurzer Hinweis
  und fertig"): Sie stehen nur noch die etwa 6 Sekunden, die auch der Hinweis unten steht, statt bis man
  den Termin verlässt. Hinweis und Schildchen zeigen dabei nur, was diese eine Aktualisierung gebracht
  hat – kommt eine weitere Änderung, trägt nur der neu betroffene Punkt ein Schildchen.

### Behoben

- **Derselbe Hinweis kam nach einem Neuladen noch einmal** (12.10.2026): Die App zeigte ihren
  gespeicherten Ablauf samt der alten Markierungen, solange er als frisch galt (30 s) – in der
  Erweiterung schon nach einem kurzen Wechsel der ChurchTools-Seite. Nach dem Gesehen-Merken sind die
  Markierungen jetzt auch im Speicher weg. Gemerkt wird erst, wenn die Ablauf-Ansicht wirklich steht
  (sie wird nachgeladen; die Daten kamen sonst vorher an und galten als gesehen, bevor sie zu sehen
  waren).

### Neu (Anmeldungen)

- **Startseite der Anmeldungen: Veranstaltungen der eigenen Gruppen** (#480, Bauplan A2 – nur lesen).
  Eine Veranstaltung ist eine **Untergruppe der Gruppe, die sie anbietet** (entschieden 12.10.2026); die
  Rechte regelt damit ChurchTools („Berechtigung für die Untergruppen“, Anleitung in
  `docs/betrieb/ANMELDUNGEN.md`). Wie im Entwurf:
  - **Braucht deine Aufmerksamkeit:** Entwurf wartet auf Freigabe, Plätze frei bei Warteliste
    („Wer rückt nach?“), offene Zahlungen (nur für die Leitung), Einstellungen nicht lesbar.
  - **Veranstaltungen:** _Anstehend · Entwürfe · Vorbei_ mit Zähler, Gruppen-Filter, Monatsüberschriften;
    je Zeile Datum, Gruppe, Preis, Stand der Anmeldung, Anmeldeschluss, Belegung, Link zur Gruppe.
  - **Deine Gruppen:** Leitung/Mitglied, Anzahl; „Untergruppen für dich nicht freigegeben“ statt einer
    falschen leeren Liste, wenn ChurchTools sie verbirgt.
  - Datum und Ort stehen als Kopie in den öffentlichen Einstellungen (`termin`) – der Termin wird bewusst
    nicht verknüpft (A0).
  - Geprüft gegen die Test-Instanz mit dem echten Code: 7 Abfragen für die ganze Übersicht.

- `ctAlleSeiten` (`ui/ct/verbindung.ts`): ChurchTools-Listen über alle Seiten – `members` und `groups`
  liefern sonst nur 10 Einträge (gemessen). Mehr als erlaubt → Fehler statt still abgeschnitten. Die
  Liederliste der Musik-App nutzt es jetzt auch (bisher eigene Schleife, ohne Test – jetzt mit).

## [2.34.0] – 2026-10-12

### Geändert

- **Ablauf-Änderungen ohne Animation** (Alwin, 12.10.2026): Statt aufleuchtender Punkte und zerfallender
  Zeilen erscheint unten ein dunkler Hinweis „Ablauf aktualisiert · 1 neu · 2 geändert", darunter jeder
  entfernte Punkt durchgestrichen; er verschwindet nach etwa 6 Sekunden von selbst. Neue und geänderte
  Punkte tragen ein Schildchen „neu"/„geändert", solange man im Termin ist. Das Zerfallen fotografierte
  die ganze Seite ab (`html2canvas`) – in der ChurchTools-Erweiterung ist das die komplette
  ChurchTools-Seite, die dabei hängen blieb. Die direkte Abhängigkeit `html2canvas` ist entfallen (jsPDF
  bringt es weiter als eigenen Teil mit, der nur für `doc.html()` geladen würde – die App ruft das nicht
  auf).
- **„Gesehen" gilt nach dem Anzeigen, nicht erst beim Verlassen** (12.10.2026): In der Erweiterung
  verlässt man meist die ganze ChurchTools-Seite – dann wurde nichts gemerkt, und dieselben Änderungen
  kamen beim nächsten Öffnen wieder. Gemerkt wird jetzt, sobald der frisch geholte Ablauf mit
  Änderungen angezeigt wurde (und nur dann – in der Erweiterung ist jedes Merken ein Schreiben).
- **Hinweise unten hängen jetzt an der Seite, nicht am Inhalt** (12.10.2026): Mitten im Inhalt gezeichnet,
  saß ein Hinweis oben statt unten – der Bereich „Zum Aktualisieren nach unten ziehen" verschiebt per
  `transform`. `Toast` hängt deshalb wie die Einführung per Portal an `body`.

### Neu

- **Rückgängig nach Löschen und Verschieben** (Alwin, 12.10.2026): Im Bearbeiten-Modus steht danach unten
  „„Titel" gelöscht · Rückgängig" bzw. „… verschoben · Rückgängig", etwa 8 Sekunden lang. Ein gelöschter
  Punkt kommt an seine Stelle zurück – mit Dauer, Notiz, Zuständigen, Dienstgruppen-Notizen und Vorlauf
  (gemessen an der Test-Instanz); er hat danach eine neue ID. Eine in ChurchTools ausgeblendete Uhrzeit
  kommt nicht zurück, die Schnittstelle kennt das Feld nicht.

### Behoben

- **Seitenwechsel im Liedblatt: Text-Anmerkungen kamen einen Frame zu spät** (12.10.2026, Fehlerklasse
  #113): `usePageDraw` merkte sich den vorigen Seitenschlüssel in einem Ref und lud die Texte der neuen
  Seite noch während des Renderns. Rendert React zweimal (StrictMode im Entwicklungs-Build,
  unterbrochenes Rendern), war der Ref nach dem ersten Durchlauf schon umgestellt – das Laden ging
  verloren, die Seite stand einen Frame ohne Texte da. Jetzt liegt der Schlüssel im Zustand; ein Test
  unter StrictMode misst den ersten übernommenen Frame. Projektweit nach demselben Muster gesucht:
  sonst nur `AgendaFullView` (dort mit dem Ablauf-Umbau behoben).
- **Bearbeiten löschte die Notizen je Dienstgruppe:** ChurchTools leert sie bei einem Ändern ohne dieses
  Feld (gemessen 12.10.2026) – die App schickte es nicht mit. Gab es seit dem Bearbeiten-Dialog.
- **Löschen eines Vorlauf-Punkts schob den Gottesdienst in den Vorlauf:** ChurchTools zieht die Grenze
  „Beginn" beim Löschen nicht mit (gemessen 12.10.2026); der erste Punkt des Gottesdienstes rutschte samt
  Uhrzeiten davor. Die App rückt die Grenze jetzt selbst nach.

### Intern

- **Anmeldungen, erster Baustein: die Preisberechnung** (#474, Bauplan Anmeldungen A1 Teil 1). Neue App
  im Repo (Jotform-Ersatz für alle Gemeinden); hier zunächst nur die Regel ohne Oberfläche:
  `shared/anmeldung/preis.ts` rechnet Grundpreis (fest oder nach Auswahl mit Kontingent) → Alter →
  Rabatte/Zuschläge (immer, Frühbucher, ab dem n-ten Kind) → Extras, **in Cent**, und prüft die Regeln
  (`pruefeRegeln`). Formular, Erweiterung und Druckliste nutzen später genau diese eine Rechnung.
  21 Tests mit von Hand nachgerechneten Beträgen aus dem Entwurf; jede der sieben Rechenregeln einzeln
  gegengeprüft (eine Lücke dabei gefunden und mit einem Test geschlossen). Die Tests laufen im
  Client-Testlauf mit, wie die von `ui/`. Für die Musik-App ändert sich nichts.
- **Anmeldungen, zweiter Baustein: das Formular-Modell** (#474, A1 Teil 2): `shared/anmeldung/formular.ts`
  mit Feldern und Baukasten-Typen, Pflichtprüfung, Alter am ersten Tag, Zuordnung zu ChurchTools
  (Gruppen- oder Personenfeld) nach den Messungen an der Test-Instanz – „Mehrere Antworten“ als Text,
  weil ChurchTools bei der Anmeldung ohne Login nur einen Wert annimmt; Betrag als Text, weil Zahlen in
  Mails als „180.8“ erscheinen – und die öffentlichen Einstellungen als geprüftes JSON in der
  Gruppen-Beschreibung (höchstens 5.000 Zeichen, sonst Fehlermeldung statt Abschneiden). 23 Tests, acht
  Regeln einzeln gegengeprüft.
- **ChurchTools-Verbindung und Erweiterungs-Bau für alle Apps im Repo** (#474): Damit die Anmeldungen sie
  nicht nachbauen, liegen die Verbindung einer Erweiterung zu ChurchTools (Fehler-Übersetzung, Bremse,
  CSRF, Zeitgrenzen) jetzt in `ui/ct/verbindung.ts` und der Erweiterungs-Bau (`cssBereich`,
  `kopfInDenInhalt`) in `ui/erweiterung/`; das Packen (`scripts/paket-erweiterung.mjs`) liest das Kürzel
  aus dem gebauten `index.html`. Die Musik-App stellt die Verbindung in `ctRuntime.ts` ein (Meldung bei
  fehlendem Recht, „nicht erreichbar"), für sie ändert sich nichts. Das Attribut für Elemente außerhalb
  von `#root` heißt jetzt `data-gemeinde-app` und steht nur noch an einer Stelle (`BEREICH_ATTRIBUT`).
  Neue Tests für die Einstellung, fünf Gegenproben.
- **Anmeldungen: Grundgerüst** (#474, A1 Teil 3). Zwei neue Bereiche im Repo, für die Musik-App ändert
  sich nichts:
  - `anmeldungen/` – die ChurchTools-Erweiterung (Kürzel `anmeldungen`). Sie zeigt bisher, wer angemeldet
    ist, die Gemeinde und die eigenen Gruppen mit „Leitung"/„Mitglied" (gemessen an der Test-Instanz:
    Name aus `group.title`, Leitung aus `GET /api/group/roles` → `isLeader`; ohne Admin-Rechte lesbar).
    Sind Person oder Gruppen nicht lesbar, sagt sie es und bietet „Erneut versuchen" – statt „keine
    Gruppen" zu behaupten. Ansehen ohne ChurchTools: `npm run dev -w anmeldungen`, `…/?demo`.
  - `formular/` – Platzhalter des öffentlichen Formulars (statische Seite für GitHub Pages).
  - Eigener Release-Weg: Tag `anmeldung-v*` → ZIP am Release, **nie „latest"**; Formular-Veröffentlichung
    vorerst nur von Hand. Anleitung: `docs/betrieb/ANMELDUNGEN.md`.
  - Geteilt statt kopiert: die Gruppen-Regel (`meineGruppen` in `shared/ct/gruppen.ts`), der Gemeindename
    (`shared/ct/info.ts`, nutzt jetzt auch die Musik-App), die Grundregeln der Stile
    (`ui/design/_grundregeln.scss`, aus der `main.scss` der Musik-App – gebautes CSS Regel für Regel
    unverändert) und der Erweiterungs-Bau (`ui/erweiterung/viteErweiterung.ts`, nutzt jetzt auch die
    Musik-App). Das Packen prüft zusätzlich, dass kein Skript im `<head>` zurückbleibt.
  - Tests: 17 neue; zehn Gegenproben an den Regeln und zwei am Bau, jede schlägt an.

## [2.33.0] – 2026-10-12

**Beim Update bitte beachten (Server-App):** Anmerkungen, Lied-Einstellungen, „gesehen" und das Teilen
liegen jetzt in **ChurchTools** – als Anhänge an der eigenen Person, dieselben wie in der Erweiterung.
Dafür braucht jedes Konto das ChurchTools-Recht **„Eigene Personendaten bearbeiten"** (bei der ECG über den
Status „Mitglied"); fehlt es, sagt die App beim Speichern, dass ChurchTools es nicht erlaubt. Was bisher
auf dem Daten-Volume lag, zieht beim ersten Öffnen jedes Kontos von selbst um; das Volume **nicht
löschen** – die alten Dateien eines Kontos räumt die App 3 Monate nach seinem geprüften Umzug selbst weg.
Ohne Erweiterung in ChurchTools: `ERWEITERUNG_KUERZEL` muss nicht gesetzt werden.

### Neu

- **Ablage in ChurchTools – App und Erweiterung sehen dieselben Notizen** (Alwin, 09.10.2026: „so viel wie
  möglich bei ChurchTools"). Bisher sah die Erweiterung die Anmerkungen aus der Server-App nicht und
  umgekehrt. Jetzt schreibt der Server mit der Anmeldung der Person in ihre Personen-Dateien.
  - **Umzug beim ersten Öffnen:** im Hintergrund, Bild für Bild mit Pause (#300), bei einer
    ChurchTools-Bremse später fortgesetzt. Was in ChurchTools schon liegt (aus der Erweiterung), gewinnt
    – je Seite und je Einstellung; das Volume füllt nur Lücken. Bis der Umzug fertig ist, zeigt die App
    die fehlenden Seiten weiter vom Volume. Fertig ist er erst, wenn ChurchTools frisch gelesen nichts
    mehr vermisst.
  - **Team-Notizen:** dieselbe Liste „Wer teilt" wie die Erweiterung; ohne Erweiterung die bisherige
    Liste. Wer in der Server-App geteilt hat und seitdem nicht angemeldet war, bleibt sichtbar.
  - **Staging zieht nicht um** – bei der ECG hängt es am echten ChurchTools, seine Volume-Notizen sind
    Testreste (`ABLAGE_UMZUG` übersteuert).
- **Ablauf abschließen und öffnen** (Alwin, 09.10.2026): Im Bearbeiten-Modus schließt ein Schloss-Knopf
  den Ablauf in ChurchTools ab (nach Rückfrage); ist er abgeschlossen, sagt die App das und bietet
  „Ablauf öffnen" an – statt der irreführenden Meldung „Keine Berechtigung", die bisher beim Löschen
  oder Ändern kam. Server-App und Erweiterung; nur mit dem Recht „Ablauf bearbeiten". Die Einführung
  im Bearbeiten-Modus hat dafür einen Schritt mehr.

### Behoben (Ablage)

- **Woanders Gelöschtes verschwindet jetzt auch hier:** Wurde eine Seite auf einem anderen Gerät oder in
  der Erweiterung ganz geleert – oder eine Einstellung zurückgesetzt –, behielt ein Gerät, das sie schon
  geladen hatte, seine alte Kopie. Gab es schon mit der NAS-Ablage, fiel aber erst auf, seit App und
  Erweiterung dieselbe Ablage teilen. Entfernt wird nur, was auf dem Konto fehlt und nicht noch auf das
  Hochladen wartet.

Code-Check vom 09.10.2026 abgearbeitet (#455–#466).

### Behoben

- **Ein Netz-Aussetzer meldet nicht mehr ab** (#455): Lief die ChurchTools-Sitzung ab und war genau
  beim stillen Erneuern das Netz kurz weg, meldete die App ab und leerte das Gerät samt Offline-Liedern.
  Jetzt bleibt man angemeldet, und der nächste Versuch fragt neu. Auch der Abgleich von Anmerkungen und
  Einstellungen schaltete sich in diesem Fall still ab.
- **Voller Gerätespeicher verhindert kein Speichern aufs Konto mehr** (#457): Textnotizen, übernommene
  Team-Notizen und Lied-Einstellungen (Tonart, Version) gingen bei vollem Speicher nicht ans Konto; bei Textnotizen konnte es
  laut Code sogar zum Fehlerbildschirm führen (nicht nachgestellt). Jetzt kommt einmal der Hinweis „Speicher voll", und alles
  wird trotzdem gesichert.
- **Liedtext-Suche nur für Lieder, die man sehen darf** (#458): Treffer und Vorschau kamen aus einem
  Suchverzeichnis für alle, ohne die Lied-Rechte der fragenden Person zu prüfen. Jetzt nur aus der
  eigenen Liederliste in ChurchTools. Dabei behoben: Baute ein Mitglied (Liederbuch) das Verzeichnis,
  fehlten den Musikern eine Stunde lang Lieder – fehlende werden jetzt nachgeladen.
- **Liedtext-Suche während einer ChurchTools-Bremse** (#456): Mit älterem Verzeichnis lud jede Suche
  alle Notenblätter neu und verlängerte die Bremse. Jetzt wird das ältere Verzeichnis benutzt.
- **Login-Bremse je Anschluss statt für alle gemeinsam** (#459): Hinter Docker sah der Server sehr
  wahrscheinlich für jede Anfrage dieselbe Adresse (das Docker-Gateway) – 50 Fehlversuche von außen
  hätten dann die Anmeldung für die ganze Gemeinde gesperrt. Aus Aufbau und Code geschlossen, am NAS
  noch zu bestätigen: TF-AUTH-07.
- **Lied-Statistik prüft die Rechte gemerkt** (#466) statt bei jedem Aufruf mit zwei Anfragen an
  ChurchTools.

### Sicherheit

- **Abmelden beendet die Anmeldung auch serverseitig** (#460): Eine vor dem Abmelden kopierte
  App-Sitzung konnte sich mit dem Anmeldeschlüssel bis zu 90 Tage lang selbst wiederbeleben. Andere
  Geräte derselben Person bleiben angemeldet. Neue Datei im Daten-Volume: `abmeldungen.json`.
- **Abhängigkeit `proxy-addr` 2.0.8** (#461, GHSA-jqcg-44mw-7w3h), `npm audit` ohne Funde.
- **Betriebs-Doku: `SESSION_SECRET` ist ein Master-Passwort** (#462) – was die App in ChurchTools
  anlegt (persönlicher Anmeldeschlüssel) und was beim Wechseln des Geheimnisses passiert
  (`docs/betrieb/DEPLOYMENT.md`).

### Intern

- **Design und Icons liegen jetzt in `ui/`** (#469, Dienstplaner E1 Teil 1): Tokens und Mixins
  (`ui/design/`) und die Line-Icons (`ui/icons/icons.tsx`) sind aus `client/src` umgezogen, damit
  Musik-App und Dienstplaner dieselbe Quelle nutzen. Neuer Alias `@ui` (Vite, Vitest, tsconfig),
  `ui/` wird mit gelintet und im Build typgeprüft. Gebaute PWA und Erweiterung sind inhaltlich
  gleich wie vorher (CSS und JS verglichen).
- **Grundbausteine der Oberfläche liegen jetzt in `ui/`** (#469, E1 Teil 2): Fenster (`Sheet`,
  Tastatur-Aussparung, App-Höhe) in `ui/fenster/`, `Segment`, `Schalter`, `KnopfReihe` in
  `ui/bedienung/`, `shareFile`/`sharePdf` in `ui/teilen/`. Die Tests in `ui/` laufen im Client-Testlauf
  mit (vorher und nachher 150 Dateien, 1589 Tests); die Mock-Pfade der Tests sind mitgewandert.
  `ui/package.json` (`"type": "module"`) sorgt dafür, dass React hier genauso eingebunden wird wie im
  Client. Gebaute PWA und Erweiterung entsprechen dem Stand vor E1 (nur Hash-Kürzel und die
  Reihenfolge einer Vorlade-Liste weichen ab). Ablauf, Abwesenheiten und Seitengerüst ziehen erst in
  der Etappe um, in der der Dienstplaner sie nutzt.
- **Regel-Dopplungen zusammengeführt** (#463): ein Baustein für „Versprechen merken, bei Fehlschlag
  vergessen" (statt fünf Kopien, eine davon ohne Schutz gegen das Löschen eines neueren Eintrags), die
  whoami-Regel für Server und Erweiterung (zwei Stellen nahmen eine ID als Text nicht an), eine Adresse
  für Lied-Dateien (Offline-Vorrat und Betrachter müssen dieselbe nehmen), `mapLimit`,
  Vollbild-Knopf, JSON-Lesen.
- **Große Dateien aufgeteilt** (#465): Der Server-Controller (843 Zeilen) nach Fachbereich in fünf
  Dateien; das Liedblatt gibt Fenster-Zustand, Werkzeug-Knöpfe, Tempo und die Schlüssel-Umzüge an
  eigene Hooks ab (1.092 → 960 Zeilen; Umzüge jetzt per `useLayoutEffect` statt im `useMemo`).
- **Veraltete Kommentare** zur Lied-Statistik (~250 Anfragen) und Lücken in `eslint.config.mjs`
  berichtigt (#464).

### Geändert

- **Repo umbenannt in `FAlwin/churchtools-gemeinde-apps`** (09.10.2026, Vorbereitung Dienstplaner). Für Nutzer
  ändert sich nichts: GitHub leitet alte Links, die Update-Abfrage und git weiter (vorher gemessen); das
  Docker-Image heißt weiter `ghcr.io/falwin/churchtools-musik-app`. Links in Doku, Release-Text und
  „Für andere Gemeinden“ zeigen jetzt direkt auf den neuen Namen.

## [2.32.0] – 2026-10-09

**Beim Update bitte beachten (Server-Variante):** Die Lied-Statistik („Häufigkeit", „Zuletzt") braucht
jetzt das ChurchTools-Recht **„Song-Statistik sehen"** (`view song statistics`, Bereich Veranstaltungen).
Bisher reichte „Abläufe sehen" – wer das neue Recht nicht hat, sieht die Statistik nach dem Update
nicht mehr. Am besten dort vergeben, wo die Musiker ihre Lied-Rechte bekommen (z. B. ihre Gruppe).
**Erweiterung:** neue ZIP einspielen; für die Statistik dasselbe Recht (alle Rechte:
`docs/betrieb/ERWEITERUNG.md`). Sonst ist nichts zu tun. Einführung: ein einmaliger Hinweis auf den
neuen Vollbild-Knopf (nur Erweiterung).

### Neu

- **Vollbild-Knopf in der ChurchTools-Erweiterung:** Auf jeder Seite an derselben Stelle, ganz rechts
  oben – auch im Liedblatt, dort abgesetzt von den Werkzeugen und am iPhone nicht im Menü versteckt
  (man braucht ihn zum Ein- und Ausschalten). Er legt die App über die Leiste von ChurchTools – in jedem Browser,
  auch am iPhone. Mit ChurchTools als Homescreen-App füllt die App damit den ganzen Bildschirm. Der
  Zustand bleibt beim Wechsel zwischen Liste, Ablauf und Liedblatt. Nach dem Update weist ein
  einmaliger Hinweis darauf hin. (Ein erster Versuch mit dem
  Vollbild des Browsers war am iPad unruhiger – Safari-X, Hinweis, Flackern – und wurde verworfen.)

- **Lied-Statistik jetzt auch in der ChurchTools-Erweiterung:** „Häufigkeit" und „Zuletzt" bei den
  Liedern und in der Lied-Auswahl. Möglich, weil die App die Statistik jetzt aus ChurchTools selbst holt
  (siehe unten). Zu sehen ist sie nur mit dem Recht „Song-Statistik sehen" – die ECG gibt es nur den
  Musikern. Wer es nicht hat, bekommt die Reiter gar nicht angezeigt, und der Server gibt die Statistik
  auch nicht aus seinem Zwischenspeicher heraus.

### Geändert

- **Umschalter sind jetzt sichtbar getrennte Knöpfe** (Alwin): A–Z/Häufigkeit/Zuletzt, Kommende/
  Vergangene, Abwesenheiten, Mehr und die Liedblatt-Menüs (Spalten, Zählweise, Puls). Auch die nicht
  gewählten Teile haben einen eigenen Rand; der gewählte ist hell und abgehoben wie bisher. Die
  Liedblatt-Menüs hatten eine eigene, blaue Bauart – jetzt gibt es eine für die ganze App.
- **Die Lied-Statistik kommt aus ChurchTools selbst – ein Aufruf statt rund 250** (Alwin): Bisher las die
  App für jeden Termin der letzten vier Jahre den Ablauf – der Lauf, der ChurchTools schon einmal
  ausgebremst hat (#300). ChurchTools führt dieselbe Statistik selbst; die App holt sie jetzt mit einem
  einzigen Aufruf. Gegen die echten Daten der ECG verglichen: 62 von 64 Liedern identisch, die zwei
  Abweichungen an einem Tag mit zwei Gottesdiensten. Die Grenze von vier Jahren entfällt. **Für die
  Server-Variante:** Wer die Statistik sehen soll, braucht in ChurchTools das Recht „Song-Statistik
  sehen" (`view song statistics`).

### Behoben

- **Lied aus der Liederliste sprang sofort zurück** (Alwin, Test-Instanz): Die App merkt sich den
  zuletzt geöffneten Gottesdienst für einen Neustart. Stand der nicht mehr in der Terminliste, setzte
  die Suche danach jede Ansicht zurück – auch ein gerade geöffnetes Lied aus der Liederliste. Jetzt
  greift sie nur noch für Ablauf und Liederheft eines Gottesdienstes.

## [2.31.0] – 2026-10-08

**Beim Update ist nichts zu tun.** ChurchTools-Erweiterung: neue ZIP einspielen; für SongSelect braucht
es dort das Recht „SongSelect nutzen" (siehe `docs/betrieb/ERWEITERUNG.md`). Keine neue Einführung.

### Neu

- **Erweiterung: CCLI SongSelect (#335, 3b-5):** In der ChurchTools-Erweiterung lassen sich jetzt auch
  SongSelect-Lieder suchen, ansehen, anlegen und Notenblätter aus SongSelect holen – mit dem
  SongSelect-Abo der Gemeinde in ChurchTools und dem Recht „SongSelect nutzen". Die Regeln dafür liegen
  jetzt in `shared/ct/songselect.ts` und gelten für beide Varianten.

### Behoben

- **SongSelect zeigte „Keine Treffer", wenn CCLI innen einen Fehler meldete** (beim Durchklick der
  Erweiterung: „Treu" ergab einmal nichts, gleich danach 100 Treffer). ChurchTools packt die Antwort von
  CCLI in eine eigene Hülle, die auch bei einem CCLI-Fehler „success" sagt. Jetzt prüft die App den
  inneren Status und meldet „SongSelect hat nicht geantwortet … Bitte gleich noch einmal versuchen." Galt
  auch für die Server-Variante.
- **Ohne Rechte für Lieder und Abläufe stand „Berechtigungen konnten nicht geladen werden"** (#444) –
  „Erneut versuchen" half nie, weil ein Recht fehlte, kein Netz. Jetzt sagt die App „Dir fehlen in
  ChurchTools die Rechte für Lieder und Abläufe". Unterschieden wird an der Antwort: ChurchTools schickt
  immer alle Module, auch leer (gemessen); ist irgendwo ein anderes Recht gesetzt, ist sie echt. Beim
  Aussetzer aus #99 war nichts gesetzt – dann bleibt es beim alten Text, und die automatischen Versuche
  bleiben in beiden Fällen.

### Intern

- **Neu: `docs/betrieb/songselect-kontingent.md`** – was bei SongSelect aufs Kontingent zählt (CCLI: 200
  Lieder je Abo-Jahr, Texte unbegrenzt) und was die App dabei abfragt. Die Aussage „offen, ob CCLI einen
  Textabruf verbucht" ist an allen Stellen präzisiert: aufs Kontingent zählt er laut CCLI nicht.

- **„Ohne Tonart nicht raten" ist jetzt getestet:** Beim Holen eines Notenblatts aus SongSelect bricht
  die App ab, wenn weder das Arrangement noch CCLI eine Tonart nennt. Die Regel galt schon, hatte aber
  keinen Test (beim Umzug nach `shared` gefunden).

## [2.30.0] – 2026-10-08

**Beim Update ist nichts zu tun.** ChurchTools-Erweiterung: neue ZIP einspielen.

### Neu

- **Teilen als PDF: Vorschau und Herunterladen** (Alwin): Ist das PDF fertig, zeigt das Fenster seine
  Seiten als kleine Blätter – antippen zeigt eine Seite groß, mit Blättern. Neben „Teilen" gibt es
  **„Herunterladen"**: Die Datei landet direkt auf dem Gerät, ohne Teilen-Menü; das Fenster bleibt
  offen, man kann danach noch teilen. Klappt die Vorschau einmal nicht, gehen Teilen und Herunterladen
  trotzdem.

### Intern

- **Staging baut auch `feat/…`-Branches:** Die Branches hießen längst so und kamen nie auf die
  Test-Instanz. Dazu fehlte auf dem NAS der Watchtower der Test-Instanz (am 07.10. beim Neu-Anlegen
  verloren) – wieder gestartet, Staging zieht wieder selbst.

## [2.29.0] – 2026-10-08

**Beim Update ist nichts zu tun.** Neu ist eine Einstellung für Admins (**Mehr → Verwaltung →
„Liedblatt: Standard-Ansicht"**, Vorgabe wie bisher „Akkorde"). Die Einführung zeigt den Schritt „Als
PDF teilen" einmal neu. **ChurchTools-Erweiterung:** neue ZIP einspielen; für Gemeinde-Einstellungen und
Team-Notizen brauchen die Musiker zusätzliche Rechte – siehe `docs/betrieb/ERWEITERUNG.md`.

### Neu

- **Erweiterung: Ablauf bearbeiten und Tempo speichern (#335, 3b-1):** Wer in ChurchTools die Rechte
  hat, kann in der ChurchTools-Erweiterung jetzt den Ablauf umsortieren, Punkte anlegen, ändern und
  löschen, den Vorlauf setzen und das Tempo eines Lieds speichern – wie in der Server-Variante. Die
  Regeln dafür (frisch lesen, nichts nebenbei überschreiben, Lied-Punkte bleiben Lieder) liegen jetzt
  in `shared/ct/schreibKern.ts` und gelten für beide Auslieferungen; der Server nutzt sie unverändert.
  Dazu die Liedtext-Vorschau beim Hinzufügen eines Lieds (das Auge in der Lied-Auswahl) – sie wäre in
  der Erweiterung sonst ins Leere gelaufen.

- **Erweiterung: Lieder verwalten und Notenblätter bearbeiten (#335, 3b-2):** In der
  ChurchTools-Erweiterung lassen sich jetzt Lieder anlegen, ändern und löschen, Arrangements verwalten,
  Notenblätter und Versionen bearbeiten und Dateien hochladen – mit denselben Regeln wie in der
  Server-Variante (Recht an der Kategorie, keine doppelte CCLI-Nummer, Liednummer nur mit Liederbuch).
  Die Regeln liegen in `shared/ct/` und gelten für beide. SongSelect fehlt in der Erweiterung noch.

- **Erweiterung: Team-Notizen (#335, 3b-4b):** In der ChurchTools-Erweiterung gibt es jetzt auch
  „Notizen von …" und „Meine Anmerkungen teilen" – wer mitmacht, legt ein Admin unter **Mehr →
  Verwaltung → Anmerkungen** über Gruppen und Rollen fest, wie in der Server-Variante. Wer teilt, steht
  in einem Verzeichnis in den Daten der Erweiterung; gilt aber nur, wenn die Person es in ihrer eigenen
  Datei bestätigt. Die nötigen Rechte stehen in `docs/betrieb/ERWEITERUNG.md`. Die Regeln für Gruppen,
  Rollen und Mitgliedschaften liegen jetzt in `shared/ct/gruppen.ts` und gelten für beide.

- **Lieder ohne ChordPro öffnen ihr PDF – und „PDF zuerst" für die ganze Gemeinde:** Angefragt von
  einer Gemeinde ohne SongSelect Premium, die nur PDFs in ChurchTools hat: Bisher öffnete jedes Lied in
  der leeren Akkord-Ansicht, und jeder musste bei jedem Lied umstellen. Jetzt zeigt ein Lied ohne
  ChordPro von selbst sein PDF (sonst ein Bild). Dazu unter **Mehr → Verwaltung → „Liedblatt:
  Standard-Ansicht"** die Wahl **Akkorde** (Standard) oder **PDF zuerst**. Wer an einem Lied selbst
  umstellt, behält seine Wahl. Das Gerät merkt sich die Einstellung – sie gilt auch offline und nach
  dem Abmelden. Auch in der ChurchTools-Erweiterung (siehe „Gemeinde-Einstellungen").

- **Erweiterung: Gemeinde-Einstellungen (#335, 3b-4a):** Admins finden in der ChurchTools-Erweiterung
  jetzt unter **Mehr → Verwaltung** die Links und die Standard-Ansicht. Gespeichert wird in ChurchTools,
  in den Daten der Erweiterung (Kategorie „Einstellungen der Musik App"). Damit Musiker die Einstellungen
  bekommen, braucht ihre Gruppe dort die Rechte „view custom category" und „view custom data" – das
  steht in der Verwaltung dabei und in `docs/betrieb/ERWEITERUNG.md`. Prüfen und Zusammensetzen der
  Einstellungen liegen jetzt in `shared/ct/einstellungen.ts` und gelten für beide Auslieferungen; die
  Erweiterung prüft auch beim Lesen und liest nach dem Speichern nach. Scheitert das Speichern, nennen
  die Fenster der Verwaltung jetzt den Grund (etwa das fehlende Recht) statt nur „Speichern
  fehlgeschlagen.".

- **Teilen als PDF: mit oder ohne Anmerkungen, und auch mit den PDFs aus ChurchTools:** Teilen öffnet
  jetzt ein kleines Fenster mit dem Schalter **Meine Anmerkungen** (Striche und Texte so, wie sie auf
  dem Blatt stehen – etwa zum Üben digital, beim Auftritt auf Papier). Das Gerät merkt sich die Wahl;
  am Anfang ist sie aus. Jedes Lied kommt so ins PDF, wie es angezeigt wird – Akkorde oder sein
  PDF/Bild aus ChurchTools. Bisher fehlte der Teilen-Knopf ganz, wenn kein Lied im Ablauf eine
  ChordPro-Datei hatte (gemeldet von einer Gemeinde ohne SongSelect Premium). Im Liedblatt gibt es
  „Als PDF teilen" jetzt auch, wenn das Lied sein PDF zeigt.

### Behoben

- **Erweiterung: ChurchTools-Stile in der App** (gemeldet von Alwin): Die Einführung verdeckte das
  Liedblatt (Folge der CSS-Eingrenzung: das Overlay bekam die Seitenfläche), das „Aa" im Liedblatt-Kopf
  war dunkel auf dunkel (ChurchTools färbt fett gesetzten Text), und Symbole rutschten aus der Zeile
  (das „+" bei „Weiteres Arrangement", der Stift im Liedmenü – ChurchTools macht Symbole zu Blöcken).
- **Versionen bei Liedern mit Bindestrich im Titel hießen falsch** (beim Durchklick von 3b-2 gefunden,
  betraf auch die Server-Variante): Aus „Testlied 3b-2 — Akustik" wurde die Version „2 — Akustik" –
  und damit ein falscher Schlüssel für Tonart und Anmerkungen; Umbenennen machte den Namen jedes Mal
  länger. Jetzt zählt der letzte „ — " vor dem Kürzel. **Beim Update ist nichts zu tun:** Öffnet man
  ein betroffenes Lied, nimmt die App Tonart, Anmerkungen und die gewählte Version vom alten auf den
  neuen Schlüssel mit (kopiert, nichts wird gelöscht).
- **Eine Version ändern konnte sie verlieren:** Die alte Datei wurde gelöscht, BEVOR die neue
  hochgeladen war – scheiterte das Hochladen (Netz, Zeitüberschreitung), war die Version weg. Jetzt
  erst hochladen, dann löschen (beim Umzug der Regeln nach `shared/ct/` gefunden).
- **Erweiterung: ein abgelehntes CSRF-Token wurde nie verworfen** (die Lehre aus #298 fehlte im
  Browser) – nach einer neuen ChurchTools-Sitzung scheiterte dann jeder Schreibversuch bis zum Neuladen.
- **Lied-Kategorien bei Drosselung:** Bremste ChurchTools (429), wich der Server auf die ganze
  Liederliste aus – genau die Last, die ChurchTools gerade abwehrte (#300). Jetzt meldet er die Bremse.
- **Erweiterung: ChurchTools-Menüs sahen anders aus (gemeldet von Alwin):** Die allgemeinen Stilregeln
  der App (Abstände, Schrift, Seitenfarbe, `--shadow`) galten in der Erweiterung für die ganze
  ChurchTools-Seite – gemessen: Schrift Lato → unsere, Menü-Polster 8 → 0 px. Der Erweiterungs-Build
  grenzt sie jetzt auf den App-Bereich ein, und das Packen bricht ab, falls je wieder eine Regel die
  ganze Seite trifft. Die Server-Variante ist unverändert.

### Geändert

- **Eigenes Recht `canEditTempo`:** dasselbe ChurchTools-Recht wie „Lieder bearbeiten", aber eigens
  benannt – das Tempo-Menü fragt jetzt dieses. Für die Server-Variante ändert sich nichts.
- **Einführung „Als PDF teilen"** nennt die Wahl mit oder ohne Anmerkungen und die PDFs aus ChurchTools
  (Tour-Version `setlist-v2`, erscheint einmal neu).
- **Fehlermeldungen beim Speichern in der Verwaltung** nennen den Grund (z. B. ein fehlendes Recht)
  statt nur „Speichern fehlgeschlagen.".

### Intern

- **Release-Seite:** Über den automatischen Notizen steht ein fester Hinweis zur Erweiterung (ZIP unter
  Assets, was ins ChurchTools-Formular gehört) (#434).

## [2.28.0] – 2026-10-07

**Beim Update ist nichts zu tun** – keine neue Einstellung, keine neue Einführung. Für eure App ändert
sich sichtbar nichts; neu ist die Möglichkeit, sie zusätzlich als ChurchTools-Erweiterung zu betreiben
(für Gemeinden ohne eigenen Server, siehe unten).

### Neu

- **Die App als ChurchTools-Erweiterung (#333–#337):** Für Gemeinden ohne eigenen Server hängt an
  jedem Release jetzt zusätzlich `musik-app-<Version>.zip` – in ChurchTools unter Administration →
  Erweiterungen hochladen, angemeldet ist man dann über ChurchTools. Sie zeigt Termine, Ablauf,
  Liedblatt und Lieder und speichert Anmerkungen an der eigenen Person; Offline, Statistik und
  Bearbeiten gibt es nur mit eigenem Server. Neue Versionen meldet die Erweiterung unter „Mehr“
  (sie fragt dafür selbst bei GitHub nach). Anleitung: `docs/betrieb/ERWEITERUNG.md`.

### Geändert

- **Terminliste bei überlasteter ChurchTools-Instanz:** Bremst ChurchTools (HTTP 429 oder
  Zeitüberschreitung) mitten im Laden der Terminliste, bricht der Lauf jetzt ab, statt eine
  lückenhafte Liste auszuliefern. Die App zeigt dann weiter den letzten vollständigen Stand, statt
  dass Gottesdienste kurz verschwinden (#300, #335).

### Intern

- **Test für alle 18 Schreibvorgänge (#426):** Lehnt ChurchTools einen Schreibvorgang ab (401/403),
  holt der nächste Versuch ein frisches CSRF-Token, statt am abgelehnten hängenzubleiben (#298) –
  vorher nur für einen Teil der Schreiber geprüft. Ein Wächter meldet jede neue Schreibfunktion, die im
  Test fehlt.
- **Vorbereitung ChurchTools-Erweiterung, Phase 2 (#334):** Neuer Speicherweg für den späteren
  Betrieb als Erweiterung: Anmerkungen, Einstellungen und „gesehen" werden dort als Dateien an der
  eigenen Person in ChurchTools abgelegt (`personenAblage.ts`, `ctRuntime.ts`). Für die
  Server-Variante ändert sich nichts – die Weiche in `annotations.ts`/`userSettings.ts` wählt den Weg,
  alle bisherigen Absicherungen gelten für beide. Gemessen auf der Test-Instanz am 07.10.2026 (Plan
  §2a/§2b). Die Regel „zu welchem Lied gehört ein Schlüssel" und der „gesehen"-Stand liegen jetzt in
  `shared/` statt dreifach von Hand im Server.
- **Vorbereitung ChurchTools-Erweiterung, Phase 3a – Lesen (#335):** Die Erweiterung liest Termine,
  Ablauf, Liedblatt, Lieder und Rechte direkt aus ChurchTools – mit denselben Regeln wie der Server,
  die dafür nach `shared/ct/` gewandert sind (nicht kopiert). Gerätweite Bremse nach einem 429.
  `npm run build:extension -w client` baut das Paket. In der Test-Instanz durchgeklickt; dabei
  behoben: pdf.js-Worker (CSP), Vollbild-Fenster unter der ChurchTools-Leiste. Für die
  Server-Variante ändert sich außer der Terminliste oben nichts.
- **ChurchTools-Erweiterung, Phase 4 (#336):** Was es in der Erweiterung nicht gibt (Offline,
  Installieren, Abmelden, Verwaltung, Lied-Statistik, Liedtext-Suche, vorerst Bearbeiten), wird dort
  nicht mehr angezeigt; stattdessen ein Hinweis in „Mehr" auf die App mit eigenem Server. Gesteuert
  über `services/funktionen.ts` – für die Server-Variante bleibt alles, wie es ist.

## [2.27.0] – 2026-10-05

**Beim Update ist nichts zu tun** – keine neue Einstellung. Die Einführungen zum Ablauf-Bearbeiten und
zum Liedblatt erscheinen einmal neu. Wer nach dem Update noch eine alte App offen hat, bekommt bei
„Neues Lied" im Ablauf die Bitte, neu zu laden (angelegt wird dabei nichts) – ein Neuladen genügt.

### Neu

- **Vorlauf vor dem Gottesdienstbeginn** (#423). Im Bearbeiten-Dialog eines Punkts gibt es den
  Schalter **„Vor Gottesdienstbeginn"**: Ein Soundcheck läuft damit vor dem Beginn, ChurchTools rechnet
  seine Uhrzeit rückwärts, und der Gottesdienst bleibt um 10:00 – auch im Kalender. Bisher half nur, im
  Browser die Uhrzeit umzustellen. Weil ChurchTools nur eine Grenze kennt, gilt der Schalter für einen
  Block: an – dieser und alle Punkte darüber, aus – dieser und alle darunter. Im Ablauf und in der
  Bearbeiten-Liste steht zwischen Vorlauf und Gottesdienst die Linie „Beginn · 10:00 Uhr". Die Einführung
  zum Bearbeiten erscheint einmal neu.

### Geändert

- **Liedblatt: Auch im Hochformat stehen die Werkzeuge einzeln oben**, solange der Titel genug Platz
  behält – am iPad hochkant und im breiten Fenster also Aa, Tempo, Anmerken (und ggf. Notizen von …)
  direkt neben dem Titel, ohne Umweg über das Menü. Erst wenn das Fenster zu schmal wird (iPhone,
  kleines Stage-Manager-Fenster am iPad), wandern sie hinter den einen Werkzeuge-Knopf. Gemessen wird
  laufend an der echten Breite. Die Einführung zum Liedblatt erscheint einmal neu.

- **Ablauf: Hinzufügen über ein schwebendes Plus, im selben Fenster wie das Bearbeiten.** Das runde
  Plus schwebt im Bearbeiten-Modus unten rechts über dem Ablauf (vorher „Eintrag hinzufügen" am
  Listenende) – auch bei einem leeren Ablauf, der sich bisher gar nicht füllen ließ. Es öffnet
  „Neuer Eintrag" mit denselben Feldern wie „Eintrag bearbeiten" und dem Umschalter Programmpunkt ·
  Überschrift. Ein Lied ist ein Programmpunkt mit „Lied verknüpfen" – der Liedname wird zum Titel,
  Dauer und Zuständige setzt man gleich mit. Das frühere Hinzufügen-Blatt mit drei eigenen Formularen und der zweite Dialog
  nach einem neuen Lied entfallen. Das Plus der Abwesenheiten ist derselbe Baustein.
- **„Neues Lied" trägt nichts mehr selbst in den Ablauf ein.** Der Server legt nur noch Lied und
  Arrangement an (`POST /api/songs` ohne `eventId`, Antwort ohne `imAblauf`); in den Ablauf kommt es
  über „Neuer Eintrag". Eine noch nicht aktualisierte App, die `eventId` mitschickt, bekommt **410**
  mit der Bitte, neu zu laden – statt dass das Lied still nicht im Ablauf landet.

- **Eingabefelder sind überall als Felder zu erkennen.** Suchfeld, Von/Bis und „Alle" im Liederheft
  waren auf dem grauen Hintergrund unsichtbar – ihre Farbe war exakt die Seitenfarbe. Alle
  Eingabefelder der App teilen jetzt EIN Aussehen (weiß, feiner Rand, beim Antippen blau); vorher gab
  es neun Kopien mit leicht verschiedenen Rändern und Rundungen.

### Entfernt

- **Der Schalter „Uhrzeit ausblenden"** (#423). Er war falsch beschriftet: Das Auge in ChurchTools
  versteckt nicht die Uhrzeit, sondern nimmt den Punkt aus der Zeitrechnung – alle Punkte danach
  rücken auf. In ChurchTools gesetzte Augen zeigt die App weiter (der Punkt steht ohne Uhrzeit da).

## [2.26.1] – 2026-10-03

**Beim Update ist nichts zu tun.** Die Einführung zum Liedblatt erscheint einmal neu (Querformat mit
Titel und Werkzeugen je Lied). Am iPad gemeldete Fehler, behoben vor dem ersten Prod-Deploy von
v2.26.0 – beide Versionen gehen zusammen raus.

### Geändert

- **Querformat: Jedes Lied hat seinen eigenen Titel und seine Werkzeuge oben** (#421). Stehen zwei
  Lieder nebeneinander, sitzt über jeder Hälfte eine Titel-Kapsel mit Aussehen, Tempo, Notizen von …
  und Anmerken als einzelnen Knöpfen – auch auf kleinen iPads mittig über dem Lied. Das aktive Lied
  trägt einen blauen Ring; ein Tipp auf den blassen Titel oder eines seiner Werkzeuge wählt dieses
  Lied (und öffnet das Werkzeug gleich). Lied-Menü, Aussehen und Tempo öffnen unter ihrem Knopf, also
  über dem richtigen Lied. Vorher wählte man es mit einem
  Tipp aufs Blatt – und landete dabei im Vollbild, sodass man die Auswahl erst nach dem Zurückschalten
  sah. Der Tipp aufs Blatt schaltet jetzt nur noch das Vollbild.
- **iPad: Der Bereich oben ist wieder so schmal wie vorher.** Das milchige Band gibt es dort nicht;
  der zusätzliche Abstand gilt nur noch auf dem iPhone.

### Behoben

- **Zoom verrutschte beim Vollbild und beim Drehen** (#420). Wer mit zwei Fingern hineingezoomt
  hatte und dann ins Vollbild wechselte oder das iPad drehte, sah danach einen anderen Ausschnitt,
  das Blatt war seitlich angeschnitten und größer. Der Zoom wurde als Pixel-Verschiebung gemerkt;
  das Blatt wird bei einer neuen Fläche aber neu eingepasst. Jetzt merkt sich die App, **welche
  Stelle des Blatts** in der Mitte steht: Nach Vollbild oder Drehen steht dieselbe Stelle wieder
  dort, die Schrift bleibt gleich groß, und am Rand rutscht nichts heraus. Ältere gespeicherte
  Zooms werden wenigstens am Rand begrenzt.

## [2.26.0] – 2026-10-02

**Beim Update ist nichts zu tun.** Die Einführung zum Liedblatt erscheint einmal neu, weil die
Werkzeuge jetzt hinter einem Knopf stecken.

### Geändert

- **Die Setlist hat oben keine milchige Leiste mehr.** Seit iOS 26/27 legt das iPhone über den
  oberen Bildschirmrand ein Unschärfe-Band, das sich nicht abschalten lässt; die weiße Leiste mit
  „‹ Termine", Teilen und Bearbeiten lag darin und wirkte milchig und verwaschen. Jetzt schweben
  dort **runde Knöpfe** direkt unter dem Band – wie in den iPhone-Einstellungen –, scharf, und sie
  bleiben beim Scrollen stehen.
- **Das Liedblatt hat oben einen Knopf für alle Werkzeuge.** Auch hier lag der Kopf im milchigen
  iOS-Band, und vier Werkzeug-Knöpfe nahmen dem Liedtitel den Platz. Jetzt: runder Zurück-Pfeil, der
  Titel als Kapsel (deutlich länger lesbar) und **ein** Werkzeuge-Knopf mit Aussehen, Tempo, Anmerken
  und – wenn freigeschaltet – „Notizen von …". Läuft der Puls, ist er blau; beim Zeichnen wird er zum
  Haken, mit dem man fertig ist. Ist ein Menü offen, sind sein Knopf bzw. die Titel-Kapsel hellblau
  hinterlegt; Titel und Infos stehen mittig. Die Einführung zum Liedblatt erscheint dafür einmal neu.
- **Umschalter sind als Knöpfe erkennbar.** Bei „Kommende | Vergangene" und den anderen Umschaltern
  sah der nicht gewählte Knopf aus wie bloßer Text: Die Schiene dahinter hatte genau die Farbe des
  Seitenhintergrunds. Sie ist jetzt grau wie beim iPhone. Die Abwesenheiten hatten einen eigenen,
  nachgebauten Umschalter – sie nutzen jetzt denselben wie der Rest der App.
- **Der Server läuft auf Express 5** (#415). Reine Wartung, damit Express 4 nicht irgendwann unter
  Zeitdruck ersetzt werden muss – für Nutzer ändert sich nichts. Drei Stellen mussten angepasst
  werden, alle vorher an Express 5 nachgestellt: die Rückfall-Route, die jede Adresse der Web-App auf
  die Startseite leitet (neue Schreibweise `/{*splat}`), der Start (bei belegtem Port meldete der
  Server sonst „läuft", obwohl er nicht lief – jetzt bricht er mit einer Meldung ab) und ein Test.
  Nebenbei liest Express 5 Adress-Parameter einfacher: Aus `?a[b]=1` wird kein Objekt mehr.

### Behoben

- **Im Vollbild war die Seitenanzeige unten abgeschnitten.** „Seite 1 / 2" saß fest am unteren Rand
  der Blattfläche – im Vollbild also unter Home-Strich und runder Bildschirmecke des iPhones. Sie rückt
  dort jetzt um den Sicherheitsabstand nach oben. (Bestand schon vor dieser Version.)

## [2.25.4] – 2026-09-24

**Beim Update ist nichts zu tun.** Jede Person meldet sich nach dem Update **noch ein letztes Mal**
an, sobald ihre bisherige ChurchTools-Sitzung abläuft – den Anmelde-Schlüssel holt die App erst beim
Anmelden. Danach bleibt man angemeldet. Die neue Einstellung `ZEITZONE` ist optional (Standard
`Europe/Berlin`) und nur außerhalb Deutschlands nötig.

### Behoben

- **Einzelne Termine ließen sich nicht mehr als abwesend eintragen.** Seit dem 24.09.2026 lehnt
  ChurchTools jeden Abwesenheits-Eintrag mit Uhrzeit ab, den die App schickt – ohne neue
  Versionsnummer; am 22.09. nahm dieselbe Instanz genau diesen Aufruf noch an. Wer einen Termin
  abhakte, bekam beim Speichern eine Fehlermeldung. Die App schickt die Tage jetzt in der Form, die
  ChurchTools annimmt. Ganztägige Einträge (Urlaub über das Plus) waren nicht betroffen.
- **Termine kurz nach Mitternacht standen am Vortag** (#414). Ein Termin um 0:30 Uhr erschien in der
  Terminliste, im Ablauf und bei den Abwesenheiten am Tag davor, weil ChurchTools die Zeiten in UTC
  liefert. Jetzt zählt der Tag in der Gemeinde – so, wie ChurchTools selbst ihn anlegt.

### Neu

- **Einstellung `ZEITZONE`** (optional, Standard `Europe/Berlin`): die Zeitzone der Gemeinde. Nur
  außerhalb Deutschlands nötig; ein Tippfehler verhindert den Start, mit einer Meldung, was gemeint
  ist.

### Geändert

- **Man bleibt angemeldet – auch nach einem Update oder einer Pause.** Alwin am 23.09.2026: „Warum
  muss man sich nach jedem Update neu anmelden? Für die User wäre das schwierig, sie vergessen ihre
  Passwörter." Das lag nicht am Update, sondern an ChurchTools: Die App bewahrte nur die
  ChurchTools-Sitzung auf, und die endet nach rund **einem Tag** (gemessen). Wer die App länger nicht
  öffnete, sah deshalb den Login – nach einem Update eben meistens. Jetzt holt sich die App beim
  Anmelden den persönlichen **Anmelde-Schlüssel** des ChurchTools-Kontos und damit still eine neue
  Sitzung, wenn ChurchTools die alte beendet. Unsere Grenzen bleiben: 30 Tage ohne Nutzung, spätestens
  90 Tage nach dem Anmelden. **Neu ist auch:** Ein Abmelden in ChurchTools im Browser meldet die App
  nicht mehr ab – dafür „Mehr → Abmelden" in der App. Konten, die ihren Schlüssel nicht abrufen
  dürfen, verhalten sich wie bisher.
- **Ein Schalter für die ganze App** (#413). Die Schalter in „Mehr", bei den Links („Auch auf
  Login-Seite zeigen") und in „Uhrzeit ausblenden" waren drei verschieden große, mit zwei
  verschiedenen Farben für „aus". Jetzt ist es überall derselbe (48 × 29 wie bisher in „Mehr").
  Nebenbei meldet der Links-Schalter Screenreadern jetzt, ob er an oder aus ist.

## [2.25.3] – 2026-09-23

**Beim Update ist nichts zu tun.** Gemeinden, die die App über HTTPS betreiben, sollten prüfen, ob
`COOKIE_SECURE=true` gesetzt ist – fehlt es, steht seit dieser Version eine Warnung im Container-Log.

### Behoben

- **Abmelden räumt das Gerät auch ohne Netz** (#403). Bisher blieben Abläufe samt Personennamen und
  die Anmerkungen liegen, wenn der Server beim Abmelden nicht erreichbar war – ausgerechnet auf den
  geteilten Gemeindegeräten. Schwerer wog das Anmelde-Cookie, das nur der Server löschen kann: Die
  nächste Person wäre als die vorige angemeldet gewesen. Jetzt wird das Gerät immer geräumt; hat der
  Server nicht geantwortet, holt die App das Abmelden beim nächsten Start nach, bevor sie irgendwem
  ein Konto zeigt.
- **Rechte-Zwischenspeicher und „gesehene Abläufe" können bei einem Lesefehler nicht mehr gelöscht
  werden** (#404). Ein beschädigter oder unlesbarer Speicher galt bisher als „leer" und wurde beim
  nächsten Schreiben so zurückgeschrieben – die Einträge aller Konten waren weg. Beide nutzen jetzt
  den gehärteten gemeinsamen Speicher, wie alle anderen Ablagen.

### Geändert

- **Für Gemeinden mit HTTPS:** Fehlt `COOKIE_SECURE=true`, steht jetzt **einmalig** eine Warnung im
  Container-Log (#409), und `INSTALL.md` nennt die Einstellung im Kapitel „Externer Zugriff" – dort
  fehlte sie bisher ganz. Für die ECG ist sie gesetzt.
- **Der Abstand am Ende jeder Liste ist überall gleich** (#408) – bisher 16, 32 oder 36 px je nach
  Bildschirm. Unter den Abwesenheiten ist damit auch mehr Luft, bevor das Plus darüber schwebt.
- **Die Schalter im Tab „Mehr"** sind je ein einziger Knopf, den Screenreader mit seinem Zustand
  ansagen (#407).

### Intern

- `Settings.tsx` (623 Zeilen) in Bausteine geteilt, abgesichert durch Tests, die vor dem Umbau
  gegen den alten Stand geschrieben wurden (#407).
- Lint mit null Warnungen, erzwungen (#406); vier kleine Dopplungen zusammengeführt (#410).
- Abhängigkeiten: vitest 4.1.11, body-parser, qs und dompurify gehoben – `npm audit` meldet
  **keine** Lücke mehr (#405). Express 5 war dafür nicht mehr nötig.

## [2.25.2] – 2026-09-23

**Beim Update ist nichts zu tun:** keine neue Variable, kein Neu-Hinzufügen zum Home-Bildschirm. Die
Statusleisten-Einstellung der App ist dieselbe wie in v2.25.1; alles andere liest iOS beim Start.

### Geändert

- **Oben gibt es keinen Titel-Balken mehr – der Titel steht groß im Inhalt.** Unter iOS 26/27 legt
  das System hinter der Statusleiste ein Unschärfe-Band über jede App (Liquid Glass), und dort
  wirkte unser Titel verschmiert und doppelt; einen Schalter dagegen gibt es nicht (Alwin,
  21./22.09.2026, mit Screenshots). Termine, Lieder, Abwesenheiten und Mehr beginnen jetzt mit
  ihrer großen Überschrift, die beim Blättern mitwandert – wie in WhatsApp oder den Apple-Apps. Die
  Ablauf-Ansicht behält oben Zurück-Pfeil und Knöpfe, Name und Datum stehen darunter. Unverändert
  ist die Lied-Anzeige: An ihrem Titel hängt das Lied-Menü.
- **Die Leisten sind deckend statt milchig.** Kopf- und Tab-Leiste sowie Kopf und Fuß der
  Lied-Anzeige haben genau die Farbe, mit der iOS den Streifen hinter der Uhr färbt – vorher lag
  dort ein feiner Strich. Diese Farbe folgt jetzt dem **Farbschema der App**, nicht dem des Geräts:
  Wer die App auf Hell stellt, während das Telefon dunkel ist, bekommt keinen dunklen Balken mehr.
- **Ein Tipp auf den Tab, in dem man schon ist, scrollt nach oben.** Der Tipp auf die Uhrzeit, den
  iOS-Apps kennen, erreicht eine Web-App nicht; der aktive Tab ist der Ersatz dafür.
- **Termine am selben Tag lassen sich einzeln als abwesend markieren** (Alwin: „manchmal hab ich
  morgens keine Zeit, kann aber nachmittags"). Ein Haken trägt in ChurchTools jetzt die **Uhrzeit
  des Termins** ein statt des ganzen Tages. Ganztägige Einträge – Urlaub über das Plus, alles von
  früher, alles direkt in ChurchTools Eingetragene – gelten weiterhin für jeden Termin des Tages;
  nimmt man bei einem Termin einen solchen Eintrag weg, fragt die App nach und nennt die anderen
  Termine, die er ebenfalls abdeckt. Unter „Einträge" steht die Uhrzeit mit dabei.
- **Die Datumsfelder bei „Häufigkeit" und „Zuletzt" sind beschriftet** („Von", „Bis") – leer
  zeigte iOS dort nur zwei Kästen mit einem Strich.

### Behoben

- **Runterziehen zum Aktualisieren** verhielt sich auf den Bildschirmen verschieden (Alwin:
  „bei Abwesenheit und Termine ist das Neuladen nicht richtig, bei Lied stimmt es"). Bei den
  Abwesenheiten verschwand der Kreisel, bevor die Daten da waren; bei einer schnellen Antwort
  blitzte er nur auf; und bei kurzen Listen klebte der Hinweis oben im Unschärfe-Band, während er
  bei langen Listen zufällig herausrutschte. Jetzt steht der Hinweis auf jedem Bildschirm an
  derselben festen Stelle, erscheint nur während man zieht, und der Kreisel bleibt, bis geladen ist.

### Intern

- Alle Bildschirme bauen Kopf, Scrollen und Neuladen über **ein** Gerüst
  (`components/SeitenGeruest.tsx`) statt jeder für sich – genau dort waren sie auseinandergelaufen.
  Das Neuladen muss sein Versprechen zurückgeben; eine Funktion ohne Rückgabe lehnt der Compiler ab.
- Die Regel „deckt diese Abwesenheit diesen Termin?" steht einmal in `shared/absences` und wird von
  App (Häkchen) und Server (Doppel-Erkennung) geteilt. Uhrzeiten werden als Zeitpunkte verglichen,
  Zeitzonen-Angaben angenommen.
- **Ein Wächter, der auch bei optionalen Feldern anschlägt** (`server/src/utils/schemaSpiegel.ts`):
  Er bricht den Build, wenn ein Zod-Eingangsschema ein Feld des geteilten Typs nicht kennt – sonst
  entfernt Zod es beim Speichern stillschweigend. Der ältere Wächter konnte das bei optionalen
  Feldern nicht; so war die Uhrzeit der Abwesenheiten beim ersten Anlauf verlorengegangen.
  Nachgestellt zeigte sich, dass auch der ursprüngliche Wächter bei den Anmerkungen **genau den
  Fehler nicht gefangen hätte, gegen den er geschrieben wurde** (#115, `bold`). Anmerkungen,
  Arrangements und Abwesenheiten nutzen jetzt denselben Baustein; jede Stelle bricht nachweislich.
- Code-Check vor dem Release: zwölf Funde behoben, vier als Issues festgehalten (#407–#410).

## [2.25.1] – 2026-09-21

### Behoben

- **Ein unsinniges Tempo aus ChurchTools hätte beim Speichern eines Arrangements das Tempo für das
  ganze Team gelöscht.** Stand in `bpm` etwas, das keine Zahl ist, rechnete der Schreib-Payload
  daraus ein `NaN` – über JSON wird daraus `null`. Gefunden im Code-Check am 21.09.2026: Dieselbe
  Umrechnung stand an **drei** Stellen, eine war falsch, eine zweite fing den Fehler sechs Zeilen
  weiter zufällig wieder auf. Jetzt gibt es sie einmal (`arrangementTempo`), und der Doppelschutz
  daneben ist weg – er hätte die nächste Kopie wieder unauffindbar gemacht.

- **Zwischen Mitternacht und 2 Uhr galt der Vortag als „heute".** Sechs Stellen im Client rechneten
  „heute" in UTC (`toISOString`), die Abwesenheiten dagegen lokal. Wer um 0:30 Uhr die Termine
  öffnete, sah den gerade zu Ende gegangenen Gottesdienst noch als anstehend, und das Aufräumen der
  Offline-Reserve ließ ihn stehen. Es gibt jetzt eine Stelle dafür (`utils/heute.ts`, lokal), und ein
  Test stellt die Zeitzone dafür ausdrücklich auf Europe/Berlin – in UTC wären beide Rechenwege
  gleich, und der Fehler wäre auf der CI unsichtbar geblieben.

- **Das Formular nahm ein Tempo an, das danach kein Puls spielen konnte.** Das Arrangement-Fenster
  erlaubte 1 bis 999 Schläge, Metronom, Tipp-Tempo und der Tempo-Endpunkt aber nur 20 bis 300 – zwei
  Bereiche für dieselbe Sache, beide im geteilten Verzeichnis. Der Bereich kommt jetzt aus
  `@shared/tempo`, und das Fenster sagt es **vor** dem Speichern.

- **Sicherheit: `SESSION_SECRET` wurde nur auf „nicht leer" geprüft.** Der Beispielwert aus
  `.env.example` ist 36 Zeichen lang und wäre damit in Produktion durchgegangen – aus ihm werden die
  Signatur des Sitzungs-Cookies **und** der Schlüssel für das darin verschlüsselte
  ChurchTools-Cookie abgeleitet. In Produktion verlangt die App jetzt 32 Zeichen und lehnt die
  bekannten Platzhalter ab; in der Entwicklung bleibt der Komfort-Rückfall. **Für Gemeinden mit
  einem kurzen Geheimnis heißt das: Die App startet nach dem Update nicht, bis ein neues eingetragen
  ist** – der Weg dazu steht in `UPDATE.md`.

- **Sicherheit: `.dockerignore` deckte nur `.env`, nicht `.env.*`.** Bei einem lokalen Build hätte
  `COPY . .` die Zugangsdaten der Test-Instanz in einen Image-Layer gelegt. Dieselbe Lehre stand in
  `.gitignore` schon, samt Begründung – nur nebenan nicht. Mit aufgenommen: `.e2e-data`,
  `.entwuerfe`, `test-results`, `data`.

- **Abhängigkeiten: vier hohe Meldungen aus `npm audit` sind weg** (`browserslist`, `fast-uri`,
  `js-yaml`, `nanoid` – alle in Build- und Entwicklungsketten, aber im ausgelieferten Image
  enthalten). `express` ist auf dem neuesten Stand der 4er-Reihe. Offen bleiben sechs mittlere, die
  einen Hauptversionssprung brauchen (`express` 5, `vitest` 4) – eigene Runde.

### Geändert

- **Aufräumen nach dem Code-Check (21.09.2026), lauter Stellen, an denen dieselbe Regel zweimal
  stand:** `ArrangementOverrides` ist jetzt derselbe Typ wie `ArrangementAuftrag` statt einer
  feldgleichen zweiten Aufzählung (ein Test hält die Zod-Form dagegen); die Grenzen der Termin-Arten
  und Links kommen aus `SITE_CONFIG_GRENZEN` statt aus vier handgeschriebenen Zahlen; `genId` war in
  zwei Managern wortgleich kopiert und heißt jetzt `neueId`; die Datums-Formatierung des Servers
  stand dreifach und liegt jetzt in `utils/isoTag.ts`. Verhalten unverändert, aber die nächste
  Änderung trifft nur noch eine Stelle.

## [2.25.0] – 2026-09-21

### Neu

- **Abwesenheiten: Termine nach Art filtern (#400).** Unter der Monatsleiste stehen jetzt Knöpfe
  für die **Termin-Arten** der Gemeinde – „Alle · Gottesdienst · Gebetsabend · …". Ein Tipp zeigt
  nur diese Termine – **genau eine Art oder alles** (Alwin, nach einem Nachmittag mit
  Mehrfachauswahl: „entweder eins oder alles"); ein zweiter Tipp auf denselben Knopf oder auf
  „Alle" zeigt wieder alles. Die Zahl „n Termine" zählt mit, die App **merkt sich die Wahl auf dem Gerät**. Die Arten
  pflegt der Admin unter **Mehr → Verwaltung → „Abwesenheiten: Termin-Arten"**: je ein Name (der
  Knopf) und ein Suchwort; ein Termin gehört zur ersten Art, deren Suchwort in seinem Namen
  vorkommt, alles Übrige fällt unter „Sonstige". Ohne gepflegte Arten gibt es keinen Filter.
  Vorgemerkte Häkchen hängen am Tag und überstehen jeden Filterwechsel; „Einträge" bleibt
  unberührt. Alwins Wunsch vom 20.09.2026. Ein erster Bau filterte nach ChurchTools-Kalender –
  bei der ECG liegen Gottesdienst und Gebetsabend im selben Kalender, und eine eigene Kategorie
  kennt ChurchTools an Terminen nicht (gemessen); deshalb Suchwörter. Geführte Einführung
  `verfuegbarkeit-v5` mit dem neuen Schritt „Nur bestimmte Termine".

- **Arrangements in der App verwalten (#396).** Im **Stammdaten-Blatt** eines Liedes (Liederheft →
  Stift) steht jetzt der Abschnitt **„Arrangements"**: alle Arrangements mit Tonart, Tempo, Takt,
  Länge und Quelle, der Standard gekennzeichnet. Ein Tipp öffnet dasselbe Fenster, das ChurchTools
  dafür hat – **alle acht Felder**: Name, Quelle, Liednummer, Tonart, Tempo, Takt, Länge und
  Beschreibung. Dazu **„Zum Standard machen"**, **„Weiteres Arrangement"** und **Löschen mit
  Rückfrage**, die die Folgen nennt (Notenblätter, eigene Fassungen und, falls vorhanden, die Anzahl
  der Dateien). Alwins Wunsch vom 19.09.2026.

  Zwei Geländer, die ChurchTools selbst nicht hat: Das **letzte** Arrangement lässt sich nicht
  löschen (ein Lied ohne Arrangement ist unbrauchbar), und das **Standard-Arrangement** erst, wenn
  ein anderes den Platz eingenommen hat. Die Knöpfe fehlen dort einfach, statt in eine Fehlermeldung
  zu führen.

  **Was hier gemessen wurde, statt es zu glauben:** Ein erster Messlauf kam zum Schluss, „zum
  Standard machen" und Quelle/Liednummer gingen über die Schnittstelle gar nicht. Das war richtig
  gemessen, aber an den falschen Wegen – die ChurchTools-Oberfläche selbst nimmt andere, und die
  standen in ihrem JavaScript. Der Standard wechselt über einen eigenen Pfad (ein `PUT` meldet
  Erfolg und ändert nichts), eine Quelle braucht eine gültige ID aus der alten Schnittstelle (eine
  unbekannte verwirft ChurchTools stillschweigend), und eine **Liednummer speichert ChurchTools nur
  zusammen mit einer Quelle**. Das sagt die App jetzt **vor** dem Speichern, statt die Eingabe
  verschwinden zu lassen. Der Standardwechsel wird nach dem Schreiben **nachgesehen**: Ein
  Erfolgssignal ist kein Beleg.

  Neu ist auch eine kurze **Einführung** beim ersten Öffnen des Stammdaten-Blattes (`lied-stammdaten-v1`).

- **„Dieses Lied gibt es schon" – fragen statt abweisen (#395).** Trägt ein Lied der Bibliothek schon
  dieselbe **CCLI-Nummer**, öffnet vor dem Anlegen ein Dialog mit Name, Autor, Nummer und Tonart des
  vorhandenen Liedes. Drei Wege, und alle führen irgendwohin: **verwenden** (einfügen, verknüpfen oder
  öffnen – je nachdem, woher man kam), **trotzdem neu anlegen** (dann ohne CCLI-Nummer; ChurchTools
  vergibt sie nur einmal) oder **zurück zum Formular**. Bisher lief dieser Fall in eine Sackgasse: Der
  Server lehnte mit einer Fehlermeldung ab, und der einzige Ausweg war Abbrechen. Die Blockade bleibt
  beim Server (`songVerwaltung.ts`) – die App nimmt ihm nichts ab, sie kommt ihm nur zuvor. Das
  **Notenblatt kommt auch beim zweiten Lied**: Ohne Nummer im Formular nimmt `notenblattPlan` die des
  SongSelect-Treffers. Die Regel, wie CCLI-Nummern verglichen werden (getrimmter Text, nie eine Zahl),
  liegt jetzt als `ccliSchluessel` in `@shared/lieder` – eine Quelle für App und Server.

- **Tab „Abwesenheiten" – eigene Abwesenheiten in der App (#177, Phase 1 / PR 1).** Wer aktives
  Mitglied einer unter „Anmerkungen → Gruppen-Zuweisung" gewählten Gruppe ist, bekommt einen vierten
  Tab (Person mit Schrägstrich, das Symbol von ChurchTools). Aufbau nach **acht Runden** anfassbarer
  Entwürfe mit Alwin (05.09.–19.09.2026) – Vorbild ist die kleine Abwesenheits-App, die das Musikteam
  gern benutzt: „an diesem Sonntag kann ich nicht" ist ein Häkchen, kein Fenster.

  - **Termine des Monats mit Abhakfeld:** Monatsleiste oben (laufender Monat, sechs voraus, „Heute"
    zurück, der Pfeil klappt zwölf Monate auf – nur nach vorn). Je Termin ein Kästchen „Abwesend".
  - **Vorgemerkt bis „Speichern":** Kein Bearbeiten-Modus – die Kästchen sind immer aktiv, aber ein
    Haken bekommt nur einen blauen Ring. Sobald etwas vorgemerkt ist, erscheint unten die Leiste
    „Verwerfen · n Änderungen vorgemerkt · Speichern"; erst Speichern schreibt **alle** Häkchen auf
    einmal nach ChurchTools (erst anlegen, dann löschen, nacheinander). Entscheidung Alwin und seine
    Frau, 19.09.2026: so nah wie möglich am alten Planner, ohne dass ein Fehltipp sofort etwas löscht.
  - **Zeitraum mit Rückfrage:** Ein Termin in einem mehrtägigen Zeitraum (Urlaub) lässt sich nicht
    stumm herausnehmen – ein Fenster fragt: Zeitraum löschen (vorgemerkt) oder anpassen.
  - **Ein rundes Plus** trägt ganze Zeiträume ein: ein Fenster mit **Schnellauswahl** (nur dieser Tag,
    Wochenende, 1 Woche, 2 Wochen) und Von–Bis, verschwindet, solange etwas vorgemerkt ist.
  - **„Einträge":** die eigenen Abwesenheiten, **Anstehend** (mit den Terminen, die ein Eintrag trifft)
    und **Früher** (ein Jahr zurück, nur zum Ansehen). Ein Tipp öffnet „Abwesenheit ändern" mit
    Zeitraum, Kommentar, Grund und Löschen. Weil ChurchTools kein Ändern kennt, legt der Server erst den
    neuen Eintrag an und entfernt dann den alten.
  - Die Liste zeigt **alle** Termine aus ChurchTools – wer eingeteilt ist, spielt keine Rolle (die
    Dienst-Einteilung kennt die App nicht; sie ist Phase 2).

  **Alle eigenen Abwesenheiten sind bearbeitbar – auch die aus ChurchTools.** Zuerst durften nur
  Einträge mit dem Kommentar-Marker `[Musikteam]` angefasst werden; eine Messung an der ECG-Instanz
  zeigte, dass **keiner** der 31 Bestände diesen Marker trägt – die Regel hätte praktisch alles
  gesperrt. In der App ist man mit seinem eigenen Konto angemeldet: Was in ChurchTools erlaubt ist, ist
  hier erlaubt. Vor dem Löschen eines Eintrags, der nicht aus der App stammt, fragt die App nach. Der
  Marker bleibt Herkunftskennzeichen für den späteren Excel-Sync.

  **Der Grund gehört dazu.** Das Fenster zeigt die Gründe **der Gemeinde** (Abwesend, Urlaub, Krank
  oder was dort eingestellt ist); beim Ändern bleibt der Grund erhalten, neue Einträge bekommen den
  konfigurierten Standard. Löst die Weboberfläche des alten Musik-Planners ab. **Kein Excel in der
  App** – der Abgleich mit der ECG-Excel wird ein eigener Dienst (PR 2); Release erst mit beiden.
  - Server: `GET/POST /api/absences`, `PUT/DELETE /api/absences/:id`, `GET /api/absences/events?to=`
    (von heute bis zu einem Tag, höchstens ein Jahr; Personen-ID immer aus der Sitzung), neues Recht
    `canUseAvailability`, Env `CHURCHTOOLS_ABSENCE_REASON_ID` (Standard 1 = „Abwesend").
  - Geführte Einführung für den neuen Bereich (`verfuegbarkeit-v4`; mit #400 in diesem Release auf
    `verfuegbarkeit-v5`).

- **Der Editor arbeitet in der Tonart, die auf dem Blatt steht – und jede Version kennt ihre
  eigene Tonart (#398).** Wer ein Lied auf D transponiert hat und dann „Bearbeiten" oder „Neue
  Version" wählt, sieht im Editor D-Akkorde, nicht mehr die Original-Tonart. Über dem Text steht,
  in welcher Tonart er steht (mit Kapo auch, wie gegriffen wird). **Gespeichert wird, was man
  sieht:** Der Text bleibt in dieser Tonart und bekommt eine `{key: …}`-Zeile; die App liest bei
  jeder Version ihre eigene Tonart und transponiert von dort aus. Bis jetzt galt die Tonart der
  Original-Datei für **alle** Versionen – eine in D geschriebene Fassung eines G-Liedes wurde von G
  aus verschoben und stimmte nur, solange niemand die Tonart anfasste. Alwins Wunsch vom
  20.09.2026, nach einem Abend Zurückrechnen. Entschieden: kein heimliches Zurückrechnen beim
  Speichern (das hätte Schreibweisen wie Eb/D# verändert), das Original bleibt immer in seiner
  Tonart (vom Blatt aus wird es ohnehin nie überschrieben), der Kapo bleibt eine Anzeige-Sache.
  Eine neue Version aus einer transponierten Ansicht übernimmt die gewählte Tonart – sonst sähe man
  nach dem Speichern die ChurchTools-Zieltonart statt dessen, was man eben getippt hat. Geführte
  Einführung `chart-v6`: Der Schritt „Lied-Optionen" nennt jetzt die Tonart, in der der Editor arbeitet.

### Geändert

- **Look der ChurchTools-App statt des Web-Clients (#393).** Entscheidung Alwin (19.09.2026) anhand von
  Screenshots der App: kräftigeres Blau (`#2563EB` statt `#0061A1`), Seitenhintergrund und Text wie in der App,
  weiße Karten mit 12 px Rundung und feinem Rand statt Schatten, hellblaue Datumskacheln mit dunkler Schrift
  („21 / Sep" statt „21 / SEP" in Blau), Gruppen-Überschriften in normaler Schreibung. Alles über die Tokens in
  `styles/_variables.scss` – neu: `--blue-tile`, `--section`, `--green` und die Rundungen `--r-card`/`--r-tile`/
  `--r-ctrl`/`--r-dialog`; die Mixins `card-list`, `group-header` und `key-pill` tragen sie in alle Listen.
  Mitgezogen: PWA-Manifest (`theme_color`, `background_color`), `theme-color`-Meta, Lade-Bildschirm,
  Fehlerseite. **Drei Grün-Kopien zusammengeführt:** `--green` gab es nicht, drei Dateien hatten je einen
  eigenen Fallback-Wert (`#168a16`, `#168a16`, `#1bb0a2`). Das Logo (`logo.svg`/`favicon.svg`) behält seine
  Balkenfarben – es ist Markenzeichen, kein UI-Token.

- **„Neues Lied" und SongSelect auch in „Lied verknüpfen" (#391).** Wer im Ablauf einem vorhandenen
  Punkt ein Lied zuordnet, kann es jetzt an derselben Stelle anlegen – oben rechts „Neues Lied" (der
  Suchbegriff wird zum Titel) oder über einen SongSelect-Treffer, wie beim Hinzufügen. Das Lied
  entsteht ohne neuen Ablaufpunkt; danach steht es im Dialog **vorgemerkt** („Wird beim Speichern
  verknüpft.") und wird erst mit „Speichern" geschrieben – ein Fenster, ein Speicherweg. Die
  Erfolgsansicht bietet weiter „Notenblatt schreiben" an; „Zurück zum Eintrag" wie „Fertig" nehmen die
  Verknüpfung mit. Bisher gab es diesen Weg nur beim Hinzufügen und im Liederheft – bewusst, weil der
  Anlege-Weg nur einen neuen Punkt schreiben konnte (`docs/entwicklung/entscheidungen.md`). Geführte
  Einführung `setlist-edit-v4`.

### Behoben

- **`deploy/docker-compose.yml` reichte `CHURCHTOOLS_ABSENCE_REASON_ID` nicht durch.** Die Prod- und
  Staging-Compose taten es, die einfache Datei für andere Gemeinden (auf die `INSTALL.md` verweist)
  nicht – wer die Variable nach `.env.example` setzte, sah keine Wirkung. Gefunden beim Doku-Abgleich
  für dieses Release.
- **Ein Test, der in der CI mal grün, mal rot war – und der Grund war nicht, was er zuerst schien.**
  Im Lauf zu PR #397 fielen zwei Anmerkungs-Tests: einer an der Zeitgrenze, der nächste mit
  `ENOTEMPTY` beim Aufräumen. Derselbe Stand lief zur selben Zeit im Push-Workflow grün. Der erste
  Verdacht – ein Verzeichnisname aus der Prozess-ID, der zwei Läufe kollidieren lässt – war eine
  Hypothese und blieb es: Die Messung zeigte eine einfachere Kette. Der Test schreibt absichtlich
  rund 275 MB, um eine 50-MB-Grenze zu erreichen (lokal 1,2 s, auf dem Runner über 5 s); läuft er in
  die Zeitgrenze, schreibt seine Schleife **weiter**, während der nächste Test schon aufräumt – und
  `fs.rm` mit `force` schützt nur gegen „gibt es nicht", **nicht** gegen „ist nicht leer"
  (nachgestellt in 60 von 60 Durchgängen). Drei Änderungen, alle nur an der Testumgebung: Die beiden
  langsamen Tests bekommen eine begründete Zeitgrenze von 30 s; ein gemeinsamer Helfer
  (`testHilfen/tempAblage.ts`) würfelt für **alle sieben** Testdateien mit diesem Muster ein
  eindeutiges Verzeichnis je Lauf, räumt mit Wiederholungen und am Ende von selbst auf. Am
  Produktivcode der Anmerkungen ist nichts geändert.

- **Drei Stellen, an denen dieselbe Regel ein zweites Mal stand (#396).** Gefunden bei der
  Dopplungs-Suche zum Arrangement-Umbau, alle drei ohne sichtbare Auswirkung – aber alle drei von
  der Sorte, die später teuer wird:
  - Das **Tempo-Speichern** baute den Lese-Schreib-Zyklus nach, statt die gemeinsame Funktion zu
    benutzen – und zwar die gefährlichste Regel des Projekts (ein unvollständiger Schreibvorgang
    löscht Tonart und Dauer für das ganze Team).
  - Die **Liedquellen** wurden bei jedem geöffneten Lied neu geholt, während dieselbe Antwort für
    die Abwesenheitsgründe längst eine Minute gemerkt wird.
  - Dabei fiel auf: Das **Abmelden** räumte die Abwesenheitsgründe nicht weg. Sie kamen mit #177
    dazu und wurden in die Aufräum-Liste nicht eingetragen – in genau dem Modul, das gegen diesen
    Fehler gebaut wurde. Jetzt prüft es ein Test.

  Dazu eine Testlücke, die nur eine Gegenprobe zeigen konnte: Niemand belegte, dass das eingestellte
  **Tempo** in ChurchTools ankommt. Der Endpunkt war über seine Fehlerpfade geprüft, nicht über
  seine Wirkung.

- **„Neues Lied" warnte während des Anlegens vor dem eigenen Werk (#395).** Wer ein Lied aus SongSelect
  anlegte, sah für ein paar Sekunden „„<Titel>" gibt es schon. Anlegen geht trotzdem …" – für ein Lied,
  das es vorher nicht gab. `useLiedAnlegen` verwirft die Bibliothek, sobald das Lied in ChurchTools
  steht; danach läuft aber noch der Notenblatt-Download, und solange bleibt das Formular sichtbar. Die
  Warnung fand also den eben angelegten Eintrag. Sie ruht jetzt, solange das Anlegen läuft – wer
  gedrückt hat, kann den Namen ohnehin nicht mehr ändern. Beim **Ändern** eines Liedes gab es den
  Fehler nicht: Dort schließt das Blatt sofort, und das eigene Lied ist von der Suche ausgenommen.

## [2.24.1] – 2026-09-05

### Behoben

- **429 ist eine Drosselung – jetzt an allen sechs Stellen (#383).** `ctAjax` (SongSelect-Suche und
  -Download, Lied-Kategorien, Liedtext-Vorschau) und das CSRF-Token machten aus einer Drosselung von
  ChurchTools einen „abgelehnt"-Serverfehler; der Wiederholversuch beim Token schickte 300 ms später
  die nächste Anfrage in dieselbe Bremse. Beide werfen jetzt wie `ctGet`, Datei-Download, Schreibpfad
  und Anmeldung `CtOverloadedError` mit `Retry-After`; die Drosselung wird nicht wiederholt.

### Geändert

- **Prod-Update mit Trockenlauf (#387).** `UPDATE.md`, `docs/betrieb/DEPLOYMENT.md`, die
  Störungshilfe und die Entwickler-Notizen beschreiben denselben Schritt 0: **erst**
  `docker pull …:2`, **dann** den laufenden Container anfassen – und was `denied: denied` bedeutet
  (`docker logout ghcr.io`). Die Doppelklick-Skripte `update.command`/`update.bat` machten es schon
  richtig (`compose pull` bricht vor `up -d` ab).
- **Staging-Image auch für `fix/**`-Branches (#386)\*\* – Fehlerbehebungen sind vor dem Merge auf der
  Test-Instanz durchklickbar.
- **`container_name` der ECG-Prod-Compose heißt `worship-charts` (#385)** – wie der laufende Container.
- **`CHURCHTOOLS_LOGIN_TOKEN` ist als reines Entwickler-Werkzeug gekennzeichnet (#384).** Der Server
  liest die Variable nicht; `.env.example` sagt das jetzt, damit hostende Gemeinden keinen zwecklosen
  Token anlegen.

## [2.24.0] – 2026-09-05

### Neu

- **Nach dem Anlegen gleich das Notenblatt schreiben (#322, 04.09.2026).** Ein selbst eingetipptes Lied
  war bisher nach dem Anlegen **leer** – man musste es öffnen, eine Version anlegen und dann den Text
  tippen. Jetzt steht in der Erfolgsansicht **„Notenblatt schreiben"**: Der Editor öffnet sich mit Titel,
  Tonart und CCLI-Nummer als Gerüst, Speichern legt das **Original**-Notenblatt an – im Liederheft wie im
  Ablauf. Bei einem Lied aus SongSelect heißt der Knopf **„Notenblatt bearbeiten"** und zeigt das geholte
  Blatt zum Anpassen.

  **Ein Angebot, kein Schritt** (Entscheidung Alwin): Der Editor öffnet sich nur auf den Knopf, nie von
  selbst – wer den Text später tippt oder gar keinen braucht, wird nicht aufgehalten.

  **Auch im Stammdaten-Blatt** (Stift im Liederheft, „Stammdaten …" im Lied-Menü) steht jetzt
  **„Notenblatt bearbeiten"** – der Weg zum Text ohne den Umweg Öffnen → Neue Version. Geschrieben wird
  das Original des Arrangements; eigene Fassungen bleiben unangetastet.

  Technisch schreibt das dieselbe Stelle wie der SongSelect-Import: pro Arrangement genau ein Original,
  erst hochladen, dann das alte ersetzen, die eigenen Fassungen bleiben unangetastet.

## [2.23.0] – 2026-09-04

### Neu

- **Liedtext-Vorschau beim Einfügen (#379).** Heißen mehrere Lieder gleich und ist der Autor
  unbekannt oder ebenfalls gleich, war die Entscheidung ohne Öffnen nicht zu treffen. Jetzt zeigt ein
  Antippen im Dialog **„Lied hinzufügen"** zuerst den **Liedtext**, und darin steht der Knopf zum
  Einfügen – nach dem Vorbild von ProPresenter. Der Text ist damit die Entscheidungsgrundlage, nicht
  eine Randnotiz.

  Bei **SongSelect** wirkt das am stärksten: Eine Titelsuche liefert dort bis zu 100 Treffer, viele mit
  demselben Namen. Die Vorschau zeigt CCLIs Text **mit den Abschnitten** („Vers 1", „Chorus 1"), dazu
  Autoren, CCLI-Nummer und den Lizenzhinweis von CCLI, der mit jedem Text mitkommt.

  **Der kurze Weg bleibt:** In der Bibliotheksliste steht neben jedem Lied weiter ein **„+"** – ein
  Tipp, sofort im Ablauf, ohne Umweg. Im Gottesdienst zählt das.

  **Abgerufen wird nur, was du wirklich ansiehst.** Beim Durchsehen der Liste entsteht keine einzige
  Anfrage, und ein Lied, das du zweimal öffnest, wird nur einmal geholt. Für die eigenen Lieder nutzt
  der Server ohnehin den Bestand, den die Liedtextsuche schon angelegt hat.

  **Der ganze Text, mit Abschnitten** (04.09.2026): Bei eigenen Liedern zeigte die Vorschau erst nur
  einen gekürzten Anfang in einer Zeile. Jetzt steht der komplette Liedtext da – Vers 1, Chorus, Bridge,
  so wie das Blatt sie kennt –, scrollbar. Alwin: „Manchmal braucht man genau den Chorus und die eine
  Passage, um auf das Lied zu kommen."

  **Der Pfeil in der Vorschau führt zur Liste, der Knopf unten heißt „Abbrechen"** (04.09.2026) – er
  verlässt die Suche. Vorher hieß er beim Verknüpfen „Zurück" und tat dasselbe wie der Pfeil scheinbar,
  in Wahrheit aber etwas anderes: Er warf einen zwei Schritte zurück.

- **„Neues Lied" im Liederheft öffnet zuerst die Suche (#378, 04.09.2026).** Dieselbe Suche wie im
  Ablauf: Titel oder CCLI-Nummer tippen. Liegt das Lied schon bei euch, öffnet ein Tipp das Blatt – nichts
  anzulegen. Ein SongSelect-Treffer führt ins vorbelegte Formular, **„Selbst eintippen"** oben rechts ins
  leere – mit dem Suchbegriff als Titel, denn was man getippt und nirgends gefunden hat, ist mit hoher
  Wahrscheinlichkeit der Titel. Vorher kam hier direkt das leere Formular.

- **Ein Suchfeld, eine Liste, zwei Knöpfe je Zeile (#378).** Beim Einfügen eines Liedes tippst du Titel,
  Autor **oder CCLI-Nummer** – und das Lied erscheint. Eigene Lieder stehen oben, SongSelect-Treffer
  darunter mit eigener Überschrift und der Nummer in der Zeile, damit man die Herkunft sieht. **Jede Zeile
  hat ein Auge und ein Plus:** Das Auge (oder ein Tipp auf die Zeile) öffnet die Liedtext-Vorschau, das
  Plus fügt sofort ein – bei einem SongSelect-Treffer öffnet es „Neues Lied" vorbelegt, du wählst die
  Kategorie, und das Lied steht angelegt im Ablauf.

  **Die CCLI-Nummer gehört jetzt zur Bibliothekssuche.** Liegt das Lied schon bei euch, findet es die
  Bibliothek über seine Nummer – SongSelect wird dann gar nicht gefragt und es entsteht kein Doppel.

  **Findet die Bibliothek nichts, sucht SongSelect von selbst mit** – dann ist die Anfrage ja nötig.
  Findet sie etwas, steht am Ende der Liste eine dezente Zeile **„Bei SongSelect nach … suchen"**; ein
  Tipp darauf oder die Eingabetaste holt die Treffer nach. Ebenso dezent am Ende: **„Auch in den Liedtexten
  nach … suchen"**. So kostet der häufigste Fall („das Lied ist bei uns") keine einzige Anfrage an CCLI.

  Zwei Anläufe davor: ein **Umschalter** „Bibliothek · Liedtexte · SongSelect" über der Liste (verlangte
  die Entscheidung, _wo_ gesucht wird, vor dem Tippen) und danach **Angebots-Knöpfe** unter der Liste
  (wirkten wie Aktionen zwischen den Treffern). Beides nach Alwins Rückmeldung am 03./04.09.2026 wieder
  ausgebaut – jetzt ist es eine Liste, in der das Lied einfach erscheint.

  **SongSelect gibt es nur dort, wo aus einem Treffer ein Lied werden kann:** in „Lied hinzufügen". Beim
  **Verknüpfen** und im **Liederheft** fehlt es mit Absicht – einem vorhandenen Ablaufpunkt kann kein neu
  angelegtes Lied zugeordnet werden, und im Liederheft schlägt man nach. Ohne SongSelect-Lizenz erscheint
  das Angebot ebenfalls nicht. Die Liedtexte gibt es überall – Suchen darf jeder.

  **Das Blatt „Neues Lied" ist dadurch einfacher geworden:** Die vorgeschaltete Frage „Bei SongSelect
  suchen oder selbst eintippen?" ist weg. „Neues Lied" führt direkt ins leere Formular, und ein Treffer
  aus SongSelect öffnet dasselbe Formular gefüllt. Damit gibt es die SongSelect-Suche genau **einmal**.

  Kleinigkeit am Rand: Der Zähler schreibt bei einem einzigen Lied jetzt **„1 Lied"** statt „1 Lieder";
  der Fehler stand seit #322 drin und fiel bei 49 Liedern nie auf.

### Geändert

- **Die Suche im Liedtext gibt es jetzt auch beim Einfügen (#378)** – als dasselbe Angebot wie im
  Liederheft: **„Auch in den Liedtexten nach … suchen"** unter der Liste, ab **drei Zeichen**. Sie läuft
  nie von selbst, denn beim ersten Mal holt sie jeden Liedtext einmal von ChurchTools. Das bleibt der
  schonende Weg gegenüber ChurchTools, das uns bei zu vielen Anfragen bremst.

### Behoben

- **Die Suche im Liedtext konnte die falsche Fassung eines Liedes durchsuchen (#379).** Wer über die App
  eine eigene Fassung eines Notenblatts angelegt hat, hatte am Arrangement zwei ChordPro-Dateien: das
  Original und die bearbeitete Fassung. Der Suchindex sollte immer das Original nehmen, erkannte aber nur
  das heutige Namensmuster – **ältere Bestandsfassungen** („… (ECG).chordpro", „… — Bearbeitet.chordpro")
  gingen als Original durch. Stand so eine Datei in der Antwort von ChurchTools vor dem Original, wurde
  der bearbeitete Text durchsucht statt des echten.

  Gefunden beim Bau der Vorschau, weil dieselbe Regel dort noch einmal gebraucht wurde – und sie gab es
  längst als geprüfte Funktion. Jetzt nutzen beide Stellen sie, statt sie nachzubauen.

## [2.22.0] – 2026-09-03

### Neu

- **Bei der Liedsuche stehen Titel-Treffer zuerst.** Gesucht wird in Titel **und** Autor; bisher stand
  die Liste rein alphabetisch, ein Lied mit dem Wort nur im Autor konnte also vor dem stehen, das es im
  Titel hat. Wer ein Wort eintippt, meint fast immer den Titel.

  Bei **Häufigkeit** und **Zuletzt** gewinnen weiter die Zahlen – sonst wäre der Umschalter wirkungslos.
  Dort entscheidet die Trefferart nur bei Gleichstand.

- **Man kann jetzt im Liedtext suchen (#322).** Wer nur eine Zeile im Kopf hat, aber nicht den Titel,
  tippt sie ins Suchfeld im Liederheft und wählt darunter **„Auch im Liedtext nach … suchen"**. Die
  Treffer erscheinen mit der **Fundstelle**, sodass man sieht, warum ein Lied dabei ist.

  Beim ersten Mal dauert es einen Moment: Die App holt dafür jeden Liedtext einmal von ChurchTools.
  Danach ist es sofort da – der Bestand wird eine Stunde vorgehalten.

  **Warum es nicht einfach mitläuft:** Weder ChurchTools noch CCLI können im Liedtext suchen – gemessen
  am 13.08.2026: Ein Wort aus dem Text ergab bei ChurchTools 0 Treffer, dasselbe Wort aus dem Titel 1.
  Die Texte liegen dort als Datei am Arrangement. Unsere App durchsucht sie deshalb selbst, und das
  kostet einmal einen Durchgang durch alle Lieder. Ein Angebot auf Knopfdruck statt bei jedem
  Tastendruck ist der schonende Weg – auch gegenüber ChurchTools, das uns bei zu vielen Anfragen
  bremst.

- **Die Stammdaten eines Liedes lassen sich in der App ändern (#322).** Im Lied-Menü steht unter
  „Dateien …" nun **„Stammdaten …"**, und im Liederheft gibt es je Zeile einen Stift. Dort ändert man
  **Name, Kategorie, Autor, CCLI-Nummer und Copyright** – ohne den Umweg über ChurchTools.

  **Gespeichert wird nur, was du geändert hast.** Ein Feld, das du leerst, wird auch in ChurchTools
  leer; alles andere bleibt unangetastet. Das ist kein Selbstläufer: ChurchTools ersetzt beim
  Speichern den **ganzen** Datensatz, und alles, was nicht mitgeschickt wird, ist danach weg. Die App
  liest deshalb vor jedem Speichern den aktuellen Stand und legt nur deine Änderung darüber – wer
  einen Liednamen korrigiert, verliert dabei nicht den Autor.

  **Ein Lied kann hier auch gelöscht werden** – mit einer Rückfrage, die sagt, was mitgeht:
  Arrangements, Notenblätter und Dateien, und im Ablauf fehlt es danach. Über die App ist das nicht
  rückholbar. Nach dem Löschen aus einem geöffneten Lied heraus schließt sich die Ansicht.

  Zur Wahl stehen wieder nur die Kategorien, in denen ChurchTools dich arbeiten lässt – und zwar für
  **beide** Seiten: Du kannst nur Lieder ändern, die in einer deiner Kategorien liegen, und nur in
  eine deiner Kategorien verschieben. Eine CCLI-Nummer, die ein **anderes** Lied schon hat, wird
  abgelehnt; die eigene Nummer bleibt selbstverständlich erlaubt.

  **Ein Notiz-Feld gibt es bewusst nicht:** ChurchTools speichert die Lied-Notiz über diesen Weg gar
  nicht (gemessen) und hat sie selbst als veraltet markiert. Ein Feld, das nichts behält, wäre eine
  Falle.

- **Lieder lassen sich in der App anlegen (#322).** Im Liederheft steht rechts unter der Suche
  **„Neues Lied"**, und
  beim Bearbeiten eines Ablaufs gibt es unter „Hinzufügen → Lied" den Punkt **„Neues Lied anlegen …"**.
  Beides sieht nur, wer in ChurchTools Lieder bearbeiten darf.

  **Gesucht wird beim Tippen.** Ein Knopfdruck ist nicht mehr nötig; die App wartet kurz, bis man
  aufhört zu tippen, und sucht dann. Der Knopf bleibt daneben – er löst sofort aus.

  **Suchen geht mit dem Titel ODER mit der CCLI-Nummer** – im selben Feld. Text landet in der Suche
  nach dem Namen, reine Ziffern gehen direkt an die Nummer: Das ergibt genau einen Treffer statt einer
  langen Liste, denn die Titelsuche von SongSelect ist unscharf (147 Treffer für „Wo ich auch stehe"). Der
  Knopf heißt dann „Abfragen" statt „Suchen", und findet SongSelect zu der Nummer nichts, nennt der Hinweis
  den anderen Weg. Beim Tippen wird eine Nummer erst abgefragt, wenn sie **sieben Stellen** hat – so
  lang sind alle 46 Nummern im Bestand (nachgezählt). Sonst stünde viermal „nicht gefunden" da, während
  man noch tippt. Kürzere Nummern gehen weiter über den Knopf.

  **Zwei gleichrangige Wege.** Entweder **bei SongSelect suchen** – dann kommen Titel, Autoren, Nummer,
  Copyright und Tonart mit, und nach dem Anlegen holt die App auch gleich **das Notenblatt**, sodass
  das Lied sofort Akkorde hat. Oder **selbst eintippen**, für eigene Lieder, Übersetzungen und alles,
  was nicht bei CCLI steht. Ohne SongSelect-Lizenz gibt es nur den zweiten Weg – und keinen Knopf,
  der ins Leere führt.

  **Die Kategorie ist ein Pflichtfeld ohne Vorbelegung.** Zur Wahl stehen genau die Kategorien, in
  denen ChurchTools dich arbeiten lässt. Ist dir keine freigegeben, sagt die App das, statt ein
  Formular anzubieten, das am Ende abgelehnt würde.

  **Gleiche Namen sind erlaubt, gleiche CCLI-Nummern nicht.** Ein Lied darf so heißen wie ein
  vorhandenes – Übersetzungen und zweite Fassungen sind normal, es kommt nur eine Warnung. Eine
  CCLI-Nummer, die es schon gibt, lehnt die App ab und nennt das Lied, das sie hat.

  Nach dem Anlegen entscheidest du, wie es weitergeht: **Lied öffnen**, **noch ein Lied anlegen** oder
  **fertig**.

  **Was nicht glattgebügelt wird:** Ein Lied entsteht in ChurchTools in mehreren Schritten, und
  ChurchTools kennt dafür keine Transaktion. Klappt der Ablauf-Eintrag nicht oder kommt das Notenblatt
  nicht, steht das Lied trotzdem da – und die App sagt genau, was fehlt, statt einen Fehler zu melden,
  der wie „nichts passiert" aussieht. Nach einem unklaren Fehlschlag heißt der Knopf „Trotzdem erneut
  anlegen": Ein beiläufiger zweiter Versuch würde das Lied doppelt anlegen.

- **Das Notenblatt lässt sich aus CCLI SongSelect holen (#322).** Hat ein Lied eine CCLI-Nummer und
  eure Gemeinde die SongSelect-Integration, steht in „Dateien …" ein zweiter Knopf:
  **„Notenblatt aus SongSelect holen …"**. ChurchTools holt es dann bei CCLI – **in der Tonart des
  Arrangements**, denn CCLI transponiert beim Herunterladen.

  **Der Knopf erscheint nur, wenn das Arrangement noch kein Notenblatt hat.** Ist schon eines da,
  gäbe es nichts zu holen – er würde es durch dasselbe ersetzen. Zum Auffrischen bleibt der Weg über
  ChurchTools.

  Zum Transponieren braucht man ihn übrigens **nicht**: Die App rechnet die Tonart selbst um, sofort
  und ohne Netz. Verschiedene Tonarten gehören in **verschiedene Arrangements** – dort holt jedes
  seine eigene Fassung.

- **Die Dateien eines Liedes lassen sich in der App verwalten (#321).** Im Lied-Menü gibt es
  **„Dateien …"** – dort stehen alle Dateien des Arrangements: das Notenblatt als ChordPro, die
  Versionen, PDFs und Bilder. **Auch Dateien, die die App bisher gar nicht zeigte** (z. B. eine
  Aufnahme als MP3), sind dort zu sehen.

  Die Liste nennt jede Datei bei ihrem sprechenden Namen – **„Notenblatt (ChordPro)"** oder
  **„Version „Akustik""** –, den technischen Dateinamen klein darunter, damit man sie in ChurchTools
  wiederfindet. Die Größe steht nur dort, wo ChurchTools sie mitliefert.

  Antippen lädt eine Datei aufs Gerät (auf dem iPad über das Teilen-Menü). Über **„Datei
  hinzufügen …"** kommt eine neue hinein – ein neues PDF steht danach sofort im Menü unter
  „Anzeige" zur Auswahl. Der Papierkorb rechts löscht, **immer mit Rückfrage**, und die Rückfrage
  sagt, was danach fehlt: Beim ChordPro etwa, dass die App für dieses Arrangement keine Akkorde mehr
  zeigt.

  Sichtbar ist das nur, wer in ChurchTools Lieder bearbeiten darf. Zu große Dateien (über 50 MB)
  werden **vor** dem Hochladen abgelehnt, und bei einem Namen, den es schon gibt, kommt eine
  Warnung: ChurchTools ersetzt nicht, die Datei läge danach zweimal da.

### Behoben

- **Eine abgelaufene ChurchTools-Anmeldung führt wieder zur Anmeldemaske (#381).** Wer die App offen
  ließ, bis die ChurchTools-Sitzung ablief, landete in einer Sackgasse: Die App hielt einen für
  angemeldet, zeigte aber „kein Zugriff" – heraus kam man nur durch Löschen der Website-Daten.

  **Die Ursache lag nicht in der App: ChurchTools hat mit einer Aktualisierung sein
  Sitzungs-Merkmal umbenannt** und das alte dabei aktiv gelöscht. Die App suchte nach dem alten
  Namen und fand nichts – deshalb liess sich **gar nicht mehr anmelden** („Der Server antwortet
  gerade nicht"), obwohl das Passwort stimmte und ChurchTools selbst einwandfrei lief.

  Wer noch angemeldet war, war ab dem Moment mit einem entwerteten Merkmal unterwegs. Auf die Frage
  „wer ist angemeldet?" antwortete ChurchTools dann nicht mehr mit „niemand", sondern mit einem
  Platzhalter-Nutzer namens „Anonymous" – also scheinbar gültig. Der gesamte Schutz gegen Aussperren
  hing aber an dieser „niemand"-Antwort. Gemessen am 03.09.2026 an ChurchTools 3.136.2.

  Die App kennt jetzt beide Namensformen und bevorzugt die neuere – eine künftige dritte Fassung
  trägt sie damit von selbst.

  Erkennbar war das daran, dass beide Instanzen gleichzeitig betroffen waren, während die
  produktive App seit Wochen unveränderten Code auslieferte.

  Die App prüft jetzt an einer Stelle, ob die Antwort überhaupt eine Person beschreibt. Damit
  greifen alle vorhandenen Vorkehrungen wieder – ohne dass eine davon angefasst werden musste.

- **Ein fehlgeschlagener Login hinterlässt jetzt eine Spur im Protokoll (#381).** Zwei Fehlerfälle
  beim Anmelden waren stumm: Im Container-Protokoll stand nichts, obwohl die App „Der Server
  antwortet gerade nicht" zeigte. Damit war die häufigste Störung überhaupt nicht aufklärbar. Der
  echte ChurchTools-Statuscode steht nun im Protokoll und in der Meldung. Falsche Zugangsdaten
  werden weiterhin **nicht** protokolliert – das würde nur Rauschen erzeugen.

- **Auch beim Anmelden wird eine Drosselung als solche gemeldet (#381).** Bremste ChurchTools den
  Anmeldeversuch aus, stand da „am Passwort liegt es nicht" statt „bitte einen Moment warten".
  Damit gilt die Regel jetzt an allen vier Stellen: Lesen, Datei-Download, Schreiben und Anmelden.

- **Auch beim Speichern wird eine Drosselung jetzt als solche gemeldet.** Bremste ChurchTools einen
  Schreibvorgang aus (Lied anlegen, Datei hochladen, Tempo speichern), stand da „fehlgeschlagen" – statt
  „ChurchTools bremst uns gerade aus, bitte einen Moment warten". Das eine klingt nach einem Fehler, den
  man nicht lösen kann, das andere nach „gleich nochmal". Damit galt die Regel beim Lesen, beim
  Datei-Download und beim Schreiben – der Anmeldepfad kam mit #381 als vierte Stelle dazu.

- **Datei-Downloads erkannten eine Drosselung durch ChurchTools nicht.** Aufgefallen beim Bau der
  Textsuche: Ein `429` („zu viele Anfragen") wurde im Datei-Pfad wie ein normaler Serverfehler
  behandelt. Damit konnte ein Vorgang, der viele Dateien lädt, die Bremse nicht erkennen und schickte
  weiter Anfragen in ein erschöpftes Limit – genau das Muster, das im Juli die ganze App lahmgelegt hat.
  Die Regel gilt jetzt für Dateien genauso wie für alle anderen Abfragen.

- **Die Kopfzeile zeigte eine andere Überschrift als das Blatt** (gemeldet von Alwin). Sichtbar wurde
  es an einer überzähligen Klammer: „Die Schöpfung singt (Grosser Gott)**]**" oben, aber korrekt auf dem
  Blatt. Die Klammer steht tatsächlich im Original-ChordPro, das von CCLI kommt
  (`{title: … (Grosser Gott)]}`); die von der App gepflegte Version hat sie nicht.

  Der Fehler war, dass es **zwei Wege zur Überschrift** gab: Das Blatt las sie aus dem gerade
  angezeigten Text, die Kopfzeile aus dem Original. Bei einem Lied mit eigener Version standen damit
  zwei verschiedene Titel übereinander. Jetzt gehen beide durch dieselbe Funktion – wie es der
  Kommentar an dieser Funktion ohnehin versprach.

  **Die Klammer selbst bleibt sichtbar, wenn man das Original ansieht** – sie steht in der Datei, und
  die App zeigt, was drinsteht. Korrigieren lässt sie sich in ChurchTools oder in der Version.

- **„Neues Lied" sieht im Ablauf jetzt genauso aus wie im Liederheft**: eine ruhige Textaktion oben
  rechts statt einer breiten Karte, die neben der Liedliste wie ein eigener Menüpunkt wirkte. Der Stil
  liegt als gemeinsamer Baustein an einer Stelle.

- **Die Kopfzeilen waren unterschiedlich hoch** (gemeldet von Alwin). Bis auf 52 Pixel schrumpfte eine
  Leiste ohne Aktions-Knopf, während eine mit Knopf 63 Pixel hoch war – beim Wechsel zwischen
  „Termine", „Lieder" und „Mehr" sprang die Leiste sichtbar. Grund: Der Inhalt bestimmte die Höhe, und
  ein Knopf ist höher als eine Zeile Text.

  Jetzt hat die Kopfzeile eine feste Inhaltshöhe – gemessen mit dem echten CSS: **63 Pixel in allen
  Fällen**, mit Aktion, ohne Aktion und mit Untertitel. Aufgefallen ist es, als das Liederheft seine
  erste Kopfzeilen-Aktion bekam; betroffen war aber die ganze App.

- **„Neues Lied" sitzt nicht mehr in der Kopfzeile**, sondern im Listenkopf – **auf einer Höhe mit der
  Liedanzahl**, links „49 Lieder", rechts „Neues Lied". Die Zeile steht über dem Bereich, der beim
  Aktualisieren nach unten gezogen wird, und bleibt deshalb sichtbar: beim Blättern und auch dann, wenn
  die Suche **keinen Treffer** hat – also genau in dem Moment, in dem ein Lied fehlt.

- **Die CCLI-Suche stürzte beim ersten Treffer ab** (`e.map is not a function`, #322). Der Client
  erwartete eine Liste, der Server liefert `{treffer, gesamt, vollstaendig}` – und über die
  HTTP-Grenze prüft TypeScript nichts nach, `apiFetch<T>` ist dort nur eine Behauptung. Der Typ steht
  jetzt in `@shared/types` (`SongSelectSuchergebnis`), also nutzen Server und Oberfläche dieselbe
  Definition.

  Der Test hat es nicht gefunden, weil sein Mock **dieselbe falsche Annahme** hatte wie der Code.
  Die Testdaten sind jetzt gegen den geteilten Typ typisiert – so kann ein Mock die Form nicht mehr
  erfinden. Dazu drei Tests, die die Trefferliste wirklich rendern.

  Nebenbei aufgefallen: Der Hinweis „Liste unvollständig" rechnete mit einem geratenen
  `treffer.length >= 100`, obwohl der Server `vollstaendig` und `gesamt` mitliefert. Jetzt nennt der
  Hinweis die echte Zahl („CCLI hat 147 Treffer, angezeigt werden 100").

### Intern

- **Die Lied-Kategorien stehen der App zur Verfügung (#322, Schritt 7).** Grundlage für das Anlegen
  von Liedern: Der Server kennt die Kategorien der Instanz **mit Namen** und weiß, in welchen davon
  der Anmeldete arbeiten darf. Zu sehen ist das in der Kategorie-Auswahl des Anlege-Formulars.

  Bemerkenswert daran ist, wo die Namen herkommen: Einen `/api`-Endpunkt für Lied-Kategorien gibt es
  **nicht** (fünf Pfade geprüft, alle 404). Sie stecken in `getMasterData` der alten
  ChurchTools-Schnittstelle. Fällt die aus, werden die Kategorien aus den vorhandenen Liedern
  gebildet – das zeigt allerdings nur, was auch benutzt wird: Bei der ECG liegen alle 49 Lieder in
  „Aktive Songs", die Kategorie „Inaktive Songs" käme dort nicht vor.

- **`ctAjax.ts` ist die einzige Stelle, die die alte ChurchTools-Schnittstelle anspricht.** Sie stand
  privat in `ctSongSelect.ts`; mit den Kategorien kam ein zweiter Nutzer. Die Fehlermeldungen bleiben
  beim Aufrufer, damit ein Fehler beim Liedersuchen weiter anders klingt als einer beim Laden der
  Kategorien.

- **Der Server legt Lieder an (#322, Schritt 10a).** `POST /api/songs` legt ein Lied **samt
  Arrangement** an und trägt es auf Wunsch gleich in den Ablauf eines Termins ein.

  Die Sorgfalt steckt in den halben Durchläufen: ChurchTools kennt keine Transaktion. Scheitert das
  Arrangement, liegt dort ein Lied ohne eines – die Meldung sagt genau das und warnt vor einem
  zweiten Versuch, der es doppeln würde. Scheitert nur der Ablauf-Eintrag, ist das kein Fehler: Das
  Lied existiert, und die Antwort sagt beides. Doppelte CCLI-Nummern und fremde Kategorien lehnt der
  Server selbst ab, nicht erst das Formular.

- **Die Stammdaten-Felder gibt es genau einmal** (`SongFields`) – „Neues Lied" und „Stammdaten ändern"
  zeigen dieselben fünf Angaben. Als zwei Formulare nebeneinander wäre jede Korrektur an einem davon
  gelandet. Die Regeln beider Formulare liegen zusammen in `utils/liedFormular.ts`, der Schreibweg in
  `services/songVerwaltung.ts` (vorher `songErstellen.ts` – der Name stimmte nicht mehr).

- **`songWritePayload` baut den Lied-`PUT` aus dem gelesenen Ist-Zustand** – die dritte riskante reine
  Funktion des Projekts nach `agendaItemWritePayload` und `arrangementWritePayload`. Gemessen an der
  ChurchTools-Test-Instanz: Ein `PUT {name, categoryId}` setzte Autor, CCLI-Nummer und Copyright auf
  `null` und `shouldPractice` auf `false`.

  Beim Messen ist mir die Frage zuerst **falsch** geraten: Der erste Versuch schickte nur `{name}` und
  bekam 400, weil `categoryId` Pflicht ist – dass danach alle Felder noch standen, sah nach
  „ungefährlich" aus, obwohl gar nicht geschrieben worden war. Ein Messaufbau, der den geprüften
  Vorgang nicht auslöst, belegt nichts.

- **Auftrag, Ergebnis und Feldgrenzen des Anlegens stehen an EINER Stelle** (`@shared/types`:
  `LiedStammdaten`, `LiedAnlegenAuftrag`, `LiedAngelegt`, `LIED_GRENZEN`). Vorher hätte das Formular
  seine `maxLength` und der Server sein Zod-Schema je eigene Zahlen gehabt – zwei Listen über dieselben
  ChurchTools-Grenzen, von denen die zweite bei einer Änderung vergessen wird. `ctWrite.NeuesLied` ist
  jetzt nur ein anderer Name für `LiedStammdaten`.

- **Ein Lied aus dem Liederheft zu öffnen, passiert nur noch an einer Stelle** (`openLibrarySong` in
  `App.tsx`). Beim Antippen in der Liste und nach dem Anlegen sind es dieselben zwei Zustände; als
  zwei Kopien wäre die nächste Änderung an genau einer davon gelandet.

- **Die geführte Einführung nennt beide neuen Einstiege** (`termine-v3`, `setlist-edit-v2`).
  Nebenbefund dabei, gemessen im ausgelieferten Bundle: Produktiv läuft **v2.20.0**, nicht das in
  Doku und Code-Kommentaren behauptete v2.16.3. Damit ist `chart-v4` sehr wohl draußen – die nächste
  Textänderung an den Chart-Schritten braucht also `chart-v5`. Der irreführende Kommentar in
  `onboarding.ts` ist berichtigt.

## [2.21.0] – 2026-08-11

### Neu

- **Beim Ansehen fremder Notizen lässt sich das Arrangement direkt umschalten.** In der Leiste unten
  steht neben dem Personen-Knopf ein zweiter mit einem Notensymbol: Er führt sofort zur Auswahl der
  Arrangements und Versionen **derselben** Person. Bisher ging das nur über „Andere Person" – man
  musste dieselbe Person noch einmal antippen, obwohl man sie gar nicht wechseln wollte.

### Geändert

- **In „Notizen von …" sagt jetzt jede Angabe, was sie ist.** Eine Zeile hieß „Version „Original" ·
  Akkorde & Text" – drei Begriffe, durch Punkte getrennt, und keiner sagte, wofür er steht. Bei einem
  Lied mit zwei Arrangements sahen zwei verschiedene Zeilen dadurch **völlig gleich** aus.

  Jetzt steht das Arrangement oben, Version und Anzeige darunter – mit denselben Wörtern wie im
  Lied-Menü:

  > **Arrangement: Test**
  > Version: Original · Anzeige: Akkorde & Text

  Bei Liedern mit nur einem Arrangement bleibt die Zeile kurz; dort unterscheidet der Name nichts.
  Notizen aus der Zeit vor den Arrangements stehen unter **„Standard"**.

  Der blaue Streifen während des Ansehens und die Meldung nach dem Übernehmen benutzen **dieselben
  Wörter** – alle drei holen sie aus einer gemeinsamen Stelle, statt sie getrennt zu formulieren.

## [2.20.0] – 2026-08-11

### Behoben

- **Team-Notizen: Die Striche eines Kollegen sind auch dann zu finden, wenn er ein anderes
  Arrangement gewählt hat (#320).** Seit v2.19.0 gehören Anmerkungen zum Arrangement – beim Ansehen
  fremder Notizen fehlte diese Angabe aber noch, und man suchte unter einem Schlüssel, den es beim
  Kollegen nicht gab. In der Ebenen-Auswahl stehen zwei Arrangements mit gleichnamigen Versionen
  jetzt getrennt, statt zu einer Ebene zu verschmelzen.

  Betroffen war auch das **Übernehmen**: „Zusammenführen" und „Ersetzen" taten nichts, weil sie
  unter demselben unvollständigen Schlüssel lasen und schrieben.

- **Der Stift-Marker im Lied-Menü war verschwunden.** Neben einer Version zeigt ein kleiner Stift,
  dass du dort Notizen hast – seit v2.19.0 suchte er unter dem alten Schlüssel, während gespeichert
  längst mit Arrangement wird. Er erschien deshalb nie mehr, ohne Fehlermeldung.

## [2.19.0] – 2026-08-11

### Behoben

- **Das Vollbild behält jetzt die Vergrößerung (#319).** Wer hineingezoomt hat und in die Mitte
  tippt, bekommt die Leisten ausgeblendet und die Seite bildschirmfüllend – **die Vergrößerung
  bleibt, wie sie ist.** Bisher wurde sie dabei zurückgesetzt.

  Das war ein Missverständnis von mir: Der ursprüngliche Bericht („Text wird verdeckt") führte zu
  einem automatischen Einpassen beim Umschalten. Nötig war davon nur die eine Hälfte – dass die
  Seite ihren Rahmen nicht mehr überragt. Die erledigt eine andere Stelle; das Einpassen war
  überflüssig und ist entfallen.

### Neu

- **Das Arrangement lässt sich umschalten (#320).** Hat ein Lied mehrere, stehen sie im Lied-Menü
  unter **Arrangement** – über der Version, weil die Versionen ChordPro-Dateien _innerhalb_ eines
  Arrangements sind. Mit dem Wechsel gelten Tonart, Tempo und Dateien des neuen.

  **Der Wechsel gilt nur für dich.** In ChurchTools wird nichts geändert – ein Tippen im
  Gottesdienst stellt nicht den Ablauf des ganzen Teams um. Wer die andere Fassung für alle
  festlegen will, tut das beim Bearbeiten des Ablaufs. Die Wahl bleibt erhalten und folgt dir aufs
  zweite Gerät; die Wahl zurück auf das Arrangement aus dem Ablauf wird als „keine eigene Wahl"
  gemerkt – ändert das Team den Ablauf später, folgt die App wieder.

  **Der Wechsel geht flott.** Sobald das Lied-Menü offen ist, holt die App die anderen Arrangements
  im Hintergrund – meist ist das neue Blatt dann schon da, wenn man tippt. Dauert es doch, sagt eine
  Leiste „Arrangement wird geladen …"; das alte Blatt bleibt bis dahin stehen, denn ein leeres Blatt
  ist im Gottesdienst das Letzte, was man braucht.

  **Deine Anmerkungen gehören ab jetzt zum Arrangement.** Zwei Arrangements können je eine Version
  „Akustik" haben – gleicher Name, anderes Notenblatt. Bestehende Notizen wurden dem Arrangement
  zugeschlagen, das beim ersten Öffnen gilt; **kopiert, nicht verschoben**, der alte Stand bleibt
  als Sicherung liegen.

- **Das Arrangement steht in der Info-Zeile (#320).** Hat ein Lied in ChurchTools mehrere
  Arrangements („Band", „Akustik" …), sieht man jetzt im Liederheft, welches gerade gilt – neben
  Tonart und Tempo. Bei genau einem erscheint **nichts**: Der Name unterscheidet dann nichts und
  wäre nur Lärm auf einem Blatt, das im Gottesdienst gelesen wird.

  Am Arrangement hängen Tonart, Tempo, Taktart und die Dateien – es ist also nicht bloß ein
  Etikett. Bisher war es in der App unsichtbar. Das **Umschalten** kommt als nächster Schritt.

### Behoben

- **Zeigte ein Ablaufpunkt auf ein gelöschtes Arrangement, passte die gemeldete Nummer nicht zum
  gezeigten Blatt.** Der Server fällt in diesem Fall auf das erste Arrangement zurück, meldete aber
  weiter die Nummer aus dem Ablauf. Bisher kosmetisch – seit die Anmerkungs-Schlüssel diese Nummer
  tragen, hätten die Notizen unter einer falschen gelegen.

- **Die Zählweise folgte nicht aufs zweite Gerät.** Neu in v2.18.0 – und dabei war sie die einzige
  Lied-Einstellung, die nicht mit dem Konto wanderte: Tonart, Kapo, Spalten und Schriftgröße tun es
  längst. Gespeichert war sie, beim Abrufen fiel sie still heraus. Ursache war eine
  **Positivliste der Einstellungs-Namen, die zweimal im Code stand** – beim Hinzufügen wurde keine
  von beiden nachgezogen. Jetzt gibt es sie einmal, und ein Test läuft über die Liste selbst: Ein
  künftiger Name ist damit automatisch mitgeprüft.

## [2.18.0] – 2026-08-10

### Neu

- **Ein Menü für alles rund ums Tempo (#145).** Der Knopf oben rechts – jetzt ein **Metronom**
  statt einer Note – öffnet ein Menü statt nur den Puls zu schalten. Darin:
  - **Das Tempo einstellen** – eine Zahl, vier Wege dorthin: **−** und **+**, direkt **eintippen**
    oder im Takt **mittippen**. „Zurücksetzen" führt zurück auf das Tempo aus ChurchTools.
  - **Sichtbarer Puls** – der lautlose Punkt neben der Tempo-Angabe.
  - **Klick** – ein hörbares Ticken. **▶︎** startet und wird zu **⏸**, „Einzählen" klickt **zwei
    Takte** und hört von selbst auf. Die Eins ist höher und lauter. Der Takt kommt von der
    Audio-Uhr, nicht vom Bildtakt: Ein verspäteter Bildaufbau fällt dem Auge nicht auf, dem Ohr
    sofort.
  - **In ChurchTools speichern** – wer darf, legt das eingestellte Tempo dort ab; dann sehen es
    alle, die das Lied öffnen.

  **Puls und Klick laufen mit dem eingestellten Wert**, nicht mit dem gespeicherten. So hört man ein
  angetipptes Tempo erst und speichert es dann. Beim Blättern zum nächsten Lied gilt wieder dessen
  Tempo.

  **Wie viele Schläge je Takt gezählt werden, lässt sich einstellen.** Ein 6/8-Stück zählt man in
  Zweien und nicht als sechs Achtel; ein schnelles 4/4 zählt man in Zweien statt in Vieren. Im Menü
  steht dafür eine Reihe, und auf den Knöpfen steht die Zahl, die dabei herauskommt: bei 6/8 also
  **6 · 3 · 2**, bei 4/4 nur **4 · 2**. „Auto" fasst bei 6/8, 9/8 und 12/8 je drei Achtel zusammen
  (also 2, 3 bzw. 4 Schläge je Takt), sonst zählt es jeden Schlag. Was in der Taktart nicht aufgeht, trägt einen Strich und ist gesperrt.
  Darunter steht immer, wie schnell es dann tickt („klickt 40 ×/min"). Die Einstellung gilt **pro
  Lied und je Version** – wie Tonart und Spaltenzahl – und bleibt erhalten.

  Die Zahl im Tempo-Feld bleibt davon unberührt – sie geht so nach ChurchTools und bedeutet dort
  für jeden dasselbe, egal wie er zählt. Wer gröber mitzählt und mittippt, muss nichts umrechnen:
  Die App tut es.

  **Beide teilen sich einen Takt.** Wer den Puls laufen lässt und den Klick dazuschaltet, bekommt
  Blitz und Ton auf demselben Schlag – und die betonte Eins an derselben Stelle. Der Klick steigt
  dafür in das laufende Raster ein, statt bei sich selbst anzufangen; „Einzählen" wartet dabei auf
  den nächsten Taktanfang, weil „eins, zwei, drei, vier" nur ab einer Eins Sinn ergibt. Auch der
  **sichtbare Puls markiert jetzt die Eins** – ein deutlich weiterer Blitz zu Beginn jedes Takts.
  Ohne ihn sagt er nur, wie schnell es geht, nicht wo der Takt anfängt.

  Beides ist bewusst **nicht gemerkt**: Beim Öffnen des Liederhefts sind Puls und Klick aus. Ein
  Gerät, das im Gottesdienst von selbst losklickt, wäre eine Panne. Der Metronom-Knopf erscheint
  jetzt auch bei Liedern **ohne** hinterlegtes Tempo – genau dort will man eins nachtragen.

  Am iPhone kann der physische Stummschalter den Klick verstummen lassen; das ist eine Eigenheit
  von iOS und lässt sich aus der App heraus nicht umgehen. Der sichtbare Puls läuft weiter.

- **Tempo-Anzeige und Puls erscheinen auch ohne gespeichertes Tempo.** Bislang hing beides an dem,
  was in ChurchTools stand: Bei einem Lied ohne Tempo konnte man zwar eines antippen und der Klick
  lief damit – zu sehen war aber nichts, bis man gespeichert hatte.

### Behoben

- **Vollbild: Text wurde verdeckt (#319).** Beim Aus- und Einblenden der Leisten ändert sich die
  Höhe der Anzeigefläche – die Seite behielt aber ihre alte Größe und ragte dann hinter die
  Fußzeile. Sie wird jetzt neu eingepasst, auch wenn man direkt nach dem Zoomen tippt. Ein bewusst
  gesetzter Zoom geht dabei **nicht** verloren: Er kommt zurück, sobald man wieder auf die Seite
  blättert. Am deutlichsten war das in einem hohen Fenster am großen Bildschirm; am Handy im
  Hochformat begrenzt die Breite und der Fehler blieb unsichtbar. (Gemeldet direkt nach v2.17.0;
  zwei Anläufe davor griffen nicht, weil die Ursache eine dreifache war und nicht nur der Zoom.)

## [2.17.0] – 2026-08-07

### Behoben

- **Beim Abmelden werden jetzt alle Daten der Sitzung verworfen.** Der Server merkt sich zu jeder
  Anmeldung drei Dinge kurzzeitig: Konto-Nummer, Berechtigungen und ein Sicherheits-Token. Beim
  Abmelden wurde bisher nur das erste weggeworfen – die Berechtigungen blieben bis zu fünf Minuten
  stehen. Im Alltag fiel das nicht auf, weil die App-Sitzung beim Abmelden ohnehin endet; sauber war
  es nicht.

### Neu

- **Ein Tipp in die Mitte blendet die Leisten aus (#319).** Kopf- und Fußzeile verschwinden, das
  Liedblatt bekommt die ganze Fläche – nützlich auf dem Notenständer. Ein weiterer Tipp holt sie
  zurück; beim ersten Mal sagt ein kurzer Hinweis, wie. Die Ränder blättern weiter wie bisher, und
  im Anmerkungsmodus passiert nichts – dort gehört der Finger dem Stift. Beim Öffnen des
  Liederhefts sind die Leisten immer da.
- **Tempo-Puls zum Einzählen (#145).** Neben der Tempo-Angabe im Kopf pulst auf Wunsch ein kleiner
  Punkt im Takt des Lieds – lautlos, zum Einzählen, wenn kein Schlagzeuger da ist. Der Schalter `♩`
  sitzt oben rechts und erscheint nur, wenn im Lied ein Tempo hinterlegt ist. Beim Öffnen des
  Liederhefts ist er immer aus, damit im Gottesdienst nichts unerwartet blinkt. Bei sehr schnellen
  Liedern (über 180 Schläge) pulst jeder zweite Schlag – schneller zu blinken gilt als Auslöser für
  photosensitive Anfälle. Wer am Gerät „Bewegung reduzieren" eingestellt hat, bekommt denselben
  Takt ohne das Größerwerden.

### Intern

- **Der letzte Monolith ist aufgeteilt (#280).** `churchtools.ts` vereinte auf 1137 Zeilen das
  HTTP-Fundament, die Anmeldung, die Rechte-Policy, alle Rohdaten-Typen und zehn
  Schreiboperationen. Jetzt neun Module, deren Abhängigkeiten nur in eine Richtung zeigen; das
  größte hat 244 Zeilen. Dabei kam heraus, dass **sieben Schreibfunktionen dasselbe Ritual
  wortgleich enthielten** (Token holen, mitschicken, Ablehnung melden) – das steht jetzt einmal,
  und ein Test prüft die Regel für jede der sieben einzeln.
- **Sieben verwaiste Beschreibungen im Quelltext richtiggestellt** – Kommentare, die über einer
  Funktion standen, die sie gar nicht beschreiben (entsteht, wenn jemand später einen Block
  dazwischenschiebt). Neu `npm run doc-check`, jetzt Teil der CI: Zwei Doc-Kommentare direkt
  hintereinander lassen die Prüfung fehlschlagen.
- Drei weitere handgeschriebene Zwischenspeicher auf den gemeinsamen Baustein `ttlMemo` umgestellt
  (Konto-ID, Rechte, CSRF-Token). Dieselbe Map, dieselbe Ablaufprüfung, dasselbe Aufräumen stand
  viermal im Code – ein Kommentar verwies sogar ausdrücklich auf die Vorlage. Zwei der drei hatten
  **keinerlei Tests**; die gibt es jetzt (`churchtools.sessionMemos.test.ts`).
- **Auch der letzte Monolith im Client ist aufgeteilt (#314).** `ChordChart.tsx` hatte 860 Zeilen
  und **keinen einzigen Test** – und enthielt dabei die Entscheidung, auf welcher Ebene ein
  gezeichneter Strich landet. Ein Fehler dort heißt: Notizen am falschen Lied, an der falschen
  Version oder in der falschen Darstellungsart, bemerkt erst im Gottesdienst; genau das waren #199
  und #250. Jetzt 503 Zeilen – mit dem Vollbild oben aus demselben Release 547 –, und diese
  Entscheidung steht als reine, geprüfte Funktion in
  `utils/chartPageKeys.ts`. Dazu neu: `utils/activeSongView.ts`, die Hooks `useChartSync`,
  `useChartStream`, `useAppLogo` und die Komponenten `ChartHeader`, `ChartFooter`, `ChartOverlays`,
  `ChartTeamNotesBars`. Am Verhalten ändert sich nichts – im Browser durchgeklickt.
- **Die drei bereits ausgelagerten Chart-Hooks haben jetzt Tests** (`useChartNavigation`,
  `useChartEditor`, `useTeamNotesImport`). Sie waren seit Längerem eigene Dateien, aber ohne Netz –
  darunter die Querformat-Grenze („die letzte Seite darf nie allein links stehen") und die einzige
  Stelle der App, die fremde Daten in die eigenen schreibt.
- **Beim Aufteilen fiel auf, dass das App-Logo an drei Stellen vorgeladen wurde** – obwohl es dafür
  längst `loadAppLogo` gab, und nur diese Fassung den Fehlerfall behandelt. Jetzt gehen alle
  darüber.
- **Gerenderte Komponenten werden nach jedem Test wieder abgebaut.** Ohne das blieben sie samt
  ihrer Ereignis-Listener am Leben und mischten sich in spätere Tests derselben Datei ein – ein
  Test zählte dadurch acht Aufrufe statt einem. Betraf **jede** Datei mit `renderHook`, deshalb
  einmal zentral in `src/test-setup.ts` statt in jeder einzelnen.
- **Die Härtung der Test-Instanz ist jetzt wirklich angewendet (#196).** Die Änderungen lagen seit
  Anfang August im Repo, auf dem NAS lief aber noch die alte Fassung – die Test-Instanz lauschte
  weiter im ganzen WLAN, und das Sitzungs-Cookie mit der ChurchTools-Anmeldung lief dabei
  unverschlüsselt. Sie ist jetzt nur noch über eine eigene HTTPS-Adresse erreichbar. Für den
  Selbstbetrieb ist der Weg dorthin in `docs/betrieb/DEPLOYMENT.md` (Abschnitt 6) beschrieben,
  samt vier Prüfungen, mit denen sich nachweisen lässt, dass die Härtung wirklich greift.
- **Lücke in `.gitignore` geschlossen.** Bisher waren die Namen einzeln aufgezählt (`.env`,
  `.env.local`, `.env.*.local`). Eine neue Variante – etwa eine zweite Zugangsdatei – fiel durchs
  Raster und wäre samt Zugangsdaten im Repo gelandet. Jetzt greift die Regel für alle `.env.*`
  außer den Vorlagen. Betrifft alle, die den Quellcode selbst betreiben.
- **Tests: Client 565 · Server 347 · 5 E2E** (vorher 433 · 311 · 5).

## [2.16.3] – 2026-08-06

**Korrektur-Release zu v2.16.2.** v2.16.2 wurde getaggt, aber nie ausgeliefert – die Release-Prüfung
fand danach einen Rückschritt, den v2.16.2 selbst eingebaut hatte. Wer von v2.16.1 kommt, springt
direkt hierher; alles aus v2.16.2 ist enthalten.

### Behoben

- **Die Terminliste ist beim Zurückwechseln wieder sofort aktuell.** v2.16.2 hatte den
  Minutentakt pausiert, solange man die Liste nicht sieht – aber nicht dafür gesorgt, dass beim
  Zurückkommen nachgeladen wird. Nach zehn Minuten im Liederheft hätte man zehn Minuten alte Termine
  gesehen, und das noch bis zu einer Minute lang. Jetzt wird beim Wechsel zurück **einmal sofort**
  neu geladen – man wartet also höchstens eine Netzrunde statt bis zu zehn Minuten, bei deutlich
  weniger Anfragen als vor v2.16.2. (#306)

### Intern

- **Skripte werden jetzt mitgeprüft.** `server/scripts/` stand nicht in der TypeScript-Prüfung und war
  darum still verrottet: `test-pipeline.ts` (12 Fehler) und `test-editor.ts` (2) riefen längst
  gelöschte Funktionen auf. Sie sind entfernt, der Ordner wird geprüft – mit Gegenprobe, dass die
  Prüfung auch wirklich fehlschlagen kann.
- Ein doppeltes Erkundungs-Skript entfernt, das dieselbe Frage beantwortete wie ein bereits
  ausgeführtes und nie gelaufen war.
- Mehrere Falschaussagen in der Doku berichtigt: Skript-Zuordnung und Testzahlen im CHANGELOG, ein
  Selbstwiderspruch in `CLAUDE.md` (eine „wirksamste offene Optimierung", die wenige Absätze weiter
  bereits bewusst verworfen war), die OpenAPI-Aussage jetzt korrekt als Spezifikation **und**
  empirischer Lauf ausgewiesen, `api-referenz.md` von Stand v2.15.0 auf v2.16.3.
- **Tests: Client 433 · Server 311 · 5 E2E** (vorher 428 · 294 · 5).

## [2.16.2] – 2026-08-06

> ⚠️ **Getaggt, aber nie ausgeliefert.** Enthielt den unter v2.16.3 behobenen Rückschritt bei der
> Frische der Terminliste. Produktion ging von v2.16.1 direkt auf v2.16.3.

Kleines Nachfass-Release zu v2.16.1: Es senkt die **Dauerlast** auf ChurchTools deutlich – den Posten,
der sich nach dem letzten Release als der größere herausgestellt hat.

### Geändert

- **Die App fragt ChurchTools deutlich seltener.** Die Terminliste holte bei jeder Aktualisierung für
  jeden Termin **zwei** Dinge – den Ablauf und den Untertitel –, und das im Minutentakt, auch wenn man
  die Liste gar nicht ansah (etwa im Liederheft). Jetzt wird der Untertitel zehn Minuten
  zwischengespeichert, und der Takt läuft nur noch, wenn die Terminliste sichtbar ist. Für ein Gerät
  im Liederheft entfallen damit rund 17 ChurchTools-Anfragen pro Minute. (#306)

### Intern

- **Die Protokollzeile der Lied-Statistik zählt richtig.** Termine ohne Ablaufplan – im
  Vier-Jahres-Fenster der Normalfall – galten als „übersprungen" und ließen dauerhaft
  `vollständig=false` im Protokoll stehen. Eine Warnung, die immer leuchtet, wird ignoriert; und
  dieselbe Zahl sollte später einmal anzeigen, wenn die Statistik wirklich unvollständig ist. (#304)
- Zwei Bausteine zusammengeführt, bevor eine dritte Kopie entstand: der Zwischenspeicher mit
  Verfallszeit (`ttlMemo`, vorher handgeschrieben in `versionMemo`) und die Konto-Kennung für
  Speicher-Schlüssel (`accountKey`, stand wortgleich an zwei Stellen).
- Ein Erkundungs-Skript, das misst, wie viele Termine überhaupt einen Ablaufplan haben (nur lesend).
  Es hat die Zahlen geliefert, mit denen der Merker für „Termine ohne Lieder" bewusst verworfen wurde.

## [2.16.1] – 2026-08-06

Wartungs-Release: **elf Fehler behoben** – dazu die Codeprüfung deutlich verschärft.

Der wichtigste Fund kam beim Testen: **Die App hat ChurchTools selbst überlastet.** Die Statistik „wie
oft wurde dieses Lied gespielt" fragte für jeden Gottesdienst der letzten vier Jahre einzeln nach –
rund 250 Anfragen auf einen Schlag. ChurchTools bremste daraufhin **alles** aus, und plötzlich
scheiterten Anmelden, Berechtigungen und Speichern, obwohl ChurchTools einwandfrei lief. Genau das
waren die roten Meldungen, die im Test aufgetaucht sind.

Das rote Band durch fast alle übrigen Fehler: Ein **vorübergehendes** Problem (ChurchTools antwortet
nicht, Netz weg, Datei nicht lesbar) wurde als **endgültig** behandelt – Daten galten als leer, Erfolg
wurde gemeldet, wo nichts gespeichert war, und eine im Drosselungs-Sturm halb geladene Statistik galt
eine Stunde als Wahrheit.

An der Bedienung ändert sich nichts – die geführte Einführung bleibt unverändert. Neu sind nur
Meldungen, die man hoffentlich nie sieht.

### Behoben

- **Die App überlastet ChurchTools nicht mehr – und das war die Ursache fast aller Aussetzer.** Die
  Statistik „wie oft wurde dieses Lied gespielt" fragte für **jeden** Gottesdienst der letzten vier
  Jahre einzeln bei ChurchTools nach: rund **250 Anfragen auf einen Schlag**, bei fünf Geräten
  gleichzeitig über tausend. ChurchTools bremste daraufhin **alles** aus – Anmelden, Berechtigungen und
  Speichern bekamen Fehler, obwohl ChurchTools selbst einwandfrei lief. Behoben:
  - Bremst ChurchTools, **hört die Statistik sofort auf** statt weiter zu fragen.
  - Öffnen mehrere Geräte gleichzeitig die Liederliste, wird die Statistik **einmal** geholt statt für
    jedes Gerät neu.
  - **Das Vorbereiten des nächsten Gottesdienstes wirft die Statistik nicht mehr weg.** Vorher löste
    schon das Umbenennen eines Ablaufpunkts beim nächsten Blick in die Liederliste einen neuen
    250-Anfragen-Lauf aus – genau diese Schleife hat die Bremse ausgelöst.
  - Kam die Statistik nur halb an, wurde sie bisher **eine Stunde lang als Wahrheit angezeigt** (mit zu
    niedrigen Zahlen). Jetzt wird ein solcher Stand verworfen: Es bleibt der zuletzt bekannte stehen,
    und wenn es keinen gibt, sagt die App „–" statt „0× gespielt". Die Liederliste bleibt dabei
    vollständig. ⚠️ Fällt ein einzelner Termin mit einem anderen Fehler aus (kein Drosseln), sind die
    Zahlen wie bisher bis zu eine Stunde leicht zu niedrig – das bleibt offen. (#300)
- **Speichern belastet ChurchTools deutlich weniger.** Vor jedem Schreibvorgang holte die App ein
  Sicherheits-Token bei ChurchTools – bei **jedem** Speichern neu, beim Umsortieren mehrfach in Folge.
  Genau dieser Aufruf war es, der beim Testen zu mehreren reproduzierbar abgelehnt wurde. Das Token
  gilt jetzt eine Minute und wird bei gleichzeitigen Vorgängen nur einmal geholt. Lehnt ChurchTools
  einen Schreibvorgang ab, wird es sofort verworfen – es kann also kein altes Token hängen bleiben.
  (#298)
- **Ein einzelner ChurchTools-Zicker legt nicht mehr die ganze App lahm.** Schlug ein einzelner
  ChurchTools-Aufruf fehl (das Sicherheits-Token beim Speichern, eine Zeitüberschreitung), zeigte die
  App danach den Vollbild-Hinweis „ChurchTools antwortet gerade nicht" und teils den Login – obwohl
  der eigene Server lief und alles andere ging. Jetzt bleibt ein solcher Fehler auf die betroffene
  Aktion beschränkt. Die Speichern-Meldung nennt außerdem den ChurchTools-Statuscode, damit sich die
  Ursache einordnen lässt. (#296)
- **Das Speichern eines Ablaufeintrags gibt bei einem kurzen Aussetzer nicht mehr sofort auf.** Vor
  jedem Speichern holt die App ein Sicherheits-Token von ChurchTools. Ging das eine Mal daneben (ein
  kurzer ChurchTools-Schluckauf), erschien „CSRF-Token konnte nicht geholt werden." und man musste
  selbst noch einmal auf Speichern tippen. Jetzt versucht die App es einmal automatisch erneut. Das
  gilt für alle Schreibaktionen (Ablauf speichern und umsortieren, Eintrag ändern, Version
  hochladen). (#294)
- **Eine ohne Netz geänderte Einstellung übersteht jetzt auch das Schließen der App.** Wer im
  Flugmodus die Tonart oder den Kapo eines Lieds änderte und die App danach beendete (was iOS im
  Hintergrund von selbst tut), fand beim nächsten Öffnen den alten Wert vor – der Abgleich holte den
  älteren Stand vom Konto zurück. Die Anmerkungen hatten diesen Schutz seit v2.16.0, die
  Einstellungen nicht. Dazu behebt es zwei kleinere Wege zum selben Verlust: eine Änderung, die genau
  während des laufenden Uploads abgeglichen wurde, und eine Änderung direkt vor dem Weg-Wischen der
  App. (#275)
- **Eine nicht ladbare Akkord-Datei ergibt kein leeres Blatt mehr.** Antwortete ChurchTools beim Laden
  nicht (Zeitüberschreitung, Serverfehler), zeigte die App ein **leeres Blatt ohne ein Wort** – und in
  der Sammel-PDF fehlte das Lied ganz. Jetzt wird es gemeldet, und beim Teilen kommt eine Rückfrage.
  Ein Lied, dessen Datei in ChurchTools wirklich gelöscht wurde, bleibt wie bisher einfach leer. (#274)
- **Ein Lesefehler kann keine Kontodaten mehr vernichten.** Konnte der Server die Datei mit den
  Anmerkungen oder Einstellungen nicht lesen (Rechteproblem, beschädigter Inhalt), behandelte er sie
  als **leer** – und der nächste Speichervorgang schrieb diesen leeren Stand zurück. Damit waren alle
  Anmerkungen bzw. alle Lied-Einstellungen des Kontos weg. Umgestellt wurden vier Ablagen (zwei reine Zwischenspeicher bleiben bewusst tolerant), darunter die
  Teilen-Tabelle (die für **alle** gilt) und die Gemeinde-Einstellungen. (#273)
- **„Für offline speichern" meldet Erfolg nur noch, wenn wirklich alles geladen wurde.** Konnte ein
  Dokument nicht geladen werden (Serverfehler, ChurchTools-Aussetzer), wurde der Gottesdienst
  trotzdem als vollständig gespeichert eingetragen – wer sich darauf verließ, stand im Saal ohne
  Dokumente. Jetzt steht dort, wie viele Dokumente fehlen, und das Offline-Häkchen bleibt aus, bis es
  vollständig ist. Die schon geladenen Dateien bleiben erhalten; ein erneuter Versuch holt nur das
  Fehlende nach. (#277)
- **Ein unbrauchbares Anmelde-Cookie wird jetzt in allen Fällen entsorgt.** Nachtrag zu v2.16.0: Ein
  Sonderfall (unsigniertes Cookie) blieb liegen und wurde bis zu 30 Tage weiter mitgeschickt. (#281)
- **Entzogene Team-Notizen-Berechtigung wirkt sofort.** Der Rechte-Puffer, der kurze
  ChurchTools-Aussetzer überbrückt, hielt auch das Recht „fremde Notizen ansehen" bis zu 12 Stunden
  aufrecht. Wer aus der Musiker-Gruppe entfernt wurde, hätte in dieser Zeit weiter fremde Anmerkungen
  lesen können. Wie beim Admin-Recht (v2.16.0) wird es jetzt nicht mehr überbrückt. (#282)

- **„Teilen abschalten" meldet keinen Erfolg mehr, wenn nichts gespeichert wurde.** Scheiterte das
  Speichern, sagte die App „gespeichert" und der Schalter blieb aus – nach dem nächsten Neustart des
  Servers waren die Anmerkungen aber weiter für das Team sichtbar. Jetzt steht dort, dass es nicht
  geklappt hat, und dass weiter geteilt wird. (#276)

### Intern

- **Kleinere Aufräumarbeiten** (#283): Die fünf Auswahl-Overlays der Chart-Ansicht teilen jetzt EINEN
  Zustand statt fünf unabhängiger Schalter – zwei gleichzeitig offene Menüs sind damit nicht mehr
  darstellbar. **Dabei fiel ein Fehler auf, den nur das Durchklicken im Browser zeigte:** Das
  Lied-Menü rief erst die Aktion und dann sein Schließen auf; mit dem gemeinsamen Zustand hätte
  „Transponieren" das Menü geschlossen, **ohne** die Tonart-Auswahl zu öffnen. Reihenfolge korrigiert
  und mit einem Test festgehalten. Außerdem: Der gespeicherte Zoom wird beim Löschen jetzt auch unter
  dem alten Schlüssel vom Konto entfernt (vorher kam er beim nächsten Abgleich zurück), das
  Liederheft-PDF nimmt nur noch die Felder, die es wirklich braucht (ein Doppel-Cast weniger), toter
  Code entfernt und der Kurz-Puffer des Ablauf-Abgleichs erstmals getestet.

- **Die Codeprüfung erkennt jetzt Typ-Zusammenhänge** (`recommended-type-checked`). Damit greifen
  Regeln, die vorher nicht greifen konnten – vor allem „nicht abgewartetes Versprechen": Die Disziplin
  dafür wurde bisher überall von Hand gefahren. 114 Funde, davon **68 im Code behoben**; die restlichen
  waren React-Idiome (`onClick={async …}`) bzw. der normale Umgang mit fremden Daten in Tests und sind
  begründet abgeschaltet. Ein echter Fund dabei: `?songs=…` wurde an **drei** Stellen als String
  behandelt, obwohl Express dort auch ein Array oder Objekt liefert – jetzt EINE geprüfte Stelle
  (`utils/songIdsQuery.ts`). (#279)
- **ESLint 8 → 9, und aus vier Konfigurationen wurde eine** (`eslint.config.mjs` im
  Wurzelverzeichnis). ESLint 8 war am Ende des Supports. Vorher lag in jedem Paket eine fast
  identische Regelliste – `no-explicit-any` stand viermal da, und ob beim Ergänzen alle vier
  angefasst wurden, war Disziplin. `npm run lint` prüft jetzt in einem Lauf auch `scripts/`, das
  bisher niemand geprüft hatte (dort steckten sieben Fehler). Dabei kam heraus, dass fünf
  `eslint-disable no-console` im Server wirkungslos waren, weil die Regel nie aktiv war – sie ist es
  jetzt. Außerdem sind die beiden bekannten Schwachstellen in der Build-Kette (`brace-expansion`,
  `fast-uri`) mit dem Update verschwunden: `npm audit` meldet **0**. (#279)
- **`shared/` und `e2e/` werden jetzt mitgeprüft.** Beide fielen aus dem Lint heraus – `shared/` ohne
  `lint`-Skript (der Workspace wurde stillschweigend übersprungen) und ohne ESLint-Konfiguration, `e2e/`
  weil Client und Server nur ihr eigenes `src` prüfen. Betroffen war damit genau das Paket, das seit
  v2.16.0 Laufzeit-Code über die Prozessgrenze teilt. Zusätzlich deckt `shared`s eigene Typprüfung jetzt
  auch `keys/` ab. (#278)

## [2.16.0] – 2026-08-03

Aufräum- und Härtungs-Release nach dem Code-Check: **neun Fehler behoben, bei denen Daten still
verschwanden, die Anmeldung wegflog oder die App ausfallen konnte**, dazu die Verschlüsselung des
Sitzungs-Cookies und ein neuer automatischer Test für den ganzen Weg vom Anmelden bis zur
gespeicherten Anmerkung.

Zwei der Fehler fielen erst beim Prüfen auf der Test-Instanz auf (#270, #268) – der wichtigere davon
hätte bei einem kurzen ChurchTools-Aussetzer **alle gleichzeitig zum Neu-Anmelden gezwungen**.

An der Bedienung ändert sich nichts – die geführte Einführung bleibt deshalb unverändert. Neu ist nur
eine Meldung, die man hoffentlich nie sieht: „ChurchTools antwortet gerade nicht."

### Behoben

- **Eine Anmerkung übersteht jetzt auch das Schließen der App.** Zeichnete jemand ohne Netz und wurde
  die App danach beendet (was iOS im Hintergrund von selbst tut), war beim nächsten Start nicht mehr
  bekannt, dass der Strich noch nicht auf dem Konto liegt – der erste Abgleich holte den älteren Stand
  und der Strich war weg. Die offenen Uploads werden jetzt auf dem Gerät vermerkt und beim nächsten
  Öffnen nachgeholt. (#256)
- **Ein Netzaussetzer beim Zeichnen kostet keine Anmerkung mehr.** Scheiterte der Upload eines Strichs
  (kurzer WLAN-Aussetzer, Serverneustart), wurde er nicht wiederholt – und der nächste Abgleich holte
  den älteren Stand vom Server zurück, wodurch der Strich **sichtbar verschwand**. Jetzt wird der
  Stand zurückgelegt und erneut versucht, sobald der Server erreichbar ist; ein neuerer Strich gewinnt
  dabei gegen den zurückgelegten. Ist das Konto voll, erscheint jetzt ein Hinweis, statt die Anmerkung
  stillschweigend fallen zu lassen. (Der Fall „App wird zwischendurch geschlossen" kam mit #256 dazu.)
  (#245)
- **Ein kurzer ChurchTools-Aussetzer meldet nicht mehr alle ab.** Antwortete ChurchTools bei der
  Statusabfrage nicht (Zeitüberschreitung, Serverfehler, Netz-Schluckauf), verwarf der Server die
  Anmeldung – und weil das Cookie dabei weg war, half auch Warten nicht mehr: Im Gottesdienst hätten
  damit alle mitten im Lied ihre ChurchTools-Zugangsdaten neu eingeben müssen. Nur ein ausdrückliches
  „Sitzung ungültig" von ChurchTools beendet die Anmeldung jetzt noch; bei einem Aussetzer erscheint
  eine Meldung mit „Erneut versuchen", und die Anmeldung bleibt bestehen. Der Fehler steckte schon in
  v2.15.0, wurde durch die neuen Zeitgrenzen (#248) aber wahrscheinlicher. Die Offline-Reserve war
  dabei nie in Gefahr – die wird nur beim ausdrücklichen Abmelden geräumt. (#270)
- **Entzogene Admin-Rechte wirken sofort.** Der Rechte-Cache, der kurze ChurchTools-Aussetzer
  überbrückt, hielt seinen Stand bis zu **30 Tage** – und überbrückte dabei auch das Admin-Recht. Wem
  in ChurchTools die Verwaltung entzogen wurde, dessen Sitzung aber noch lief, hätte damit weiter
  Einstellungen ändern können. Das Fenster liegt jetzt bei 12 Stunden (der Zweck sind Aussetzer von
  Sekunden), und das **Admin-Recht wird grundsätzlich nicht mehr überbrückt**. (#249)

- **Ein Dokument, das nicht geladen werden kann, wird nicht mehr verschwiegen.** Wählte man zu einem
  Lied ein hochgeladenes PDF oder Bild und dessen Laden scheiterte, zeigte die App **ohne ein Wort**
  die Akkorde. Der Rückfall bleibt (lieber Akkorde als eine leere Seite), aber jetzt mit Hinweis. (#251)
- **Ein voller Gerätespeicher wird nicht mehr verschwiegen.** Passt eine Anmerkung nicht mehr in den
  Gerätespeicher, sagt die App das jetzt – einmal pro Sitzung, nicht bei jedem Strich. Die Anmerkung
  selbst ist nicht verloren: Sie geht weiter aufs Konto und kommt beim nächsten Abgleich zurück; nur
  der Offline-Vorrat funktioniert dann nicht. (#251)

- **Eine übergroße Datei in ChurchTools legt die App nicht mehr lahm.** Der Server hielt jede
  durchgereichte Datei vollständig im Speicher – ohne Obergrenze. Ein versehentlich hochgeladener
  Scan von einigen hundert MB hätte den Container umgelegt und damit die App für **alle
  gleichzeitig**. Jetzt ist bei 50 MB Schluss (weit über jedem realen Notenblatt), und wer so eine
  Datei öffnet, bekommt eine Meldung statt eines Ausfalls. Außerdem haben alle ChurchTools-Aufrufe
  jetzt eine Zeitgrenze: Antwortet ChurchTools nicht, endet die Anfrage nach 15 Sekunden (Dateien 60)
  mit einem verständlichen Hinweis, statt den Server mit hängenden Anfragen zu füllen. (#248)
- **„Notizen von …" zeigt wieder die Ansicht des Kollegen, nicht Standardwerte.** Hatte die andere
  Person ihre Spalten-/Schriftgröße noch unter einem älteren Schlüssel gespeichert, wurden diese Werte
  beim Ansehen ignoriert – man sah ihre Anmerkungen in der falschen Darstellung, wodurch sie
  verrutscht wirken konnten. Ursache: Die Umrechnung der Einstellungen gab es ein zweites Mal, ohne
  die Rückfälle auf die alten Schlüssel und ohne den Schutz gegen unsinnige Werte. Es gibt sie jetzt
  nur noch einmal. (#247)
- **Die einmalige Übernahme bestehender Anmerkungen aufs Konto verpasst sich nicht mehr.** Lief sie
  bei schlechtem Netz ins Leere, galt sie trotzdem als erledigt – die auf dem Gerät gesammelten
  Anmerkungen landeten damit **nie** auf dem Konto, still und ohne Meldung. Sie läuft genau einmal pro
  Gerät, es gab also keine zweite Chance. Jetzt wird der Merker nur gesetzt, wenn nichts
  netzbedingt gescheitert ist; ein einzelner zu großer Eintrag hält den Vorgang dagegen nicht auf
  (er würde auch beim nächsten Mal scheitern) und wird gemeldet. (#246)

### Geändert

- **Das ChurchTools-Cookie liegt nicht mehr lesbar im App-Cookie.** Wer das Sitzungs-Cookie in die
  Hände bekam – aus einem Backup, einem Proxy-Log oder einem verlorenen iPad –, konnte daraus die
  ChurchTools-Anmeldung herauslesen und damit **direkt in ChurchTools** arbeiten, also weit mehr als
  in der App möglich ist. Der Anteil ist jetzt verschlüsselt. **Niemand wird dadurch abgemeldet:**
  Bestehende Anmeldungen werden weiter gelesen und beim nächsten Aufruf automatisch umgestellt.
  ⚠️ Beim Deploy muss `SESSION_SECRET` unverändert bleiben – der Schlüssel wird daraus abgeleitet. (#194)
- **Eine unbrauchbare Anmeldung wird auf dem Gerät auch gelöscht, nicht nur ignoriert.** Ließ sich das
  Sitzungs-Cookie nicht mehr lesen (gewechseltes `SESSION_SECRET`, beschädigter Inhalt), behandelte
  der Server das als „nicht angemeldet" – ließ das tote Cookie aber liegen, sodass der Browser es bis
  zu 30 Tage bei jeder Anfrage weiter mitschickte. Kein Datenverlust, aber unnötiger Ballast; jetzt
  ist es nach dem ersten Aufruf weg. (#268)
- **Die Test-Instanz ist gehärtet** (betrifft nur die Einrichtung auf dem NAS, nicht die App): Ihr Port
  lauscht nur noch lokal statt im ganzen LAN, `COOKIE_SECURE` ist standardmäßig an, und der
  Auto-Update-Dienst ist auf eine feste Image-Fassung gepinnt. Vorher lief das Sitzungs-Cookie dort
  unverschlüsselt über HTTP durchs Netz. **Zum Anwenden ist ein Reverse Proxy auf die Test-Domain
  nötig** – die Anleitung in der Compose-Datei sagt, was zu tun ist. (#196)
- **Der Server beendet sich beim Neustart geordnet.** Bisher gab es kein Signal-Handling: Beim
  `docker stop` brach Node sofort ab, laufende Anfragen (z. B. ein gerade hochgeladener Strich)
  einfach mitten durch. Jetzt darf Laufendes fertig werden, untätige Verbindungen werden geschlossen,
  und nach 8 Sekunden greift eine Notbremse – in der Praxis ist er in rund einer Sekunde unten.
  Unbehandelte Promise-Fehler landen außerdem im Log statt still zu verpuffen. (#251)

### Intern

- **Die Schlüssel-Grammatik der Anmerkungen und Einstellungen liegt jetzt an EINER Stelle**
  (`shared/keys`), die Client und Server gemeinsam nutzen. Vorher wurden die Schlüssel an fünf Stellen
  von Hand zusammengesetzt und die Prüfmuster standen zweimal wortgleich über die Prozessgrenze – eine
  Abweichung hätte den Abgleich still lahmgelegt, wie es beim Querformat-Zoom schon einmal passiert
  ist. Für Mitspielende ändert sich nichts. (#250)
- **Der wichtigste Weg der App läuft jetzt automatisch durch:** Anmelden → Termin → Ablauf → Chart →
  Anmerkung → Abgleich, gegen einen kleinen ChurchTools-Ersatz (`e2e/ct-stub.mjs`), aber mit dem
  **echten** Server samt Sitzungs-, Rechte- und Proxy-Logik. Genau dort lagen die Fehler, die diese
  App am häufigsten getroffen haben (#186, #211, #245/#256) – geprüft wurde bisher nur das Rendern
  der Chart-Ansicht ohne Backend. (#174)
- **Tests: Client 383 · Server 205 · 5 E2E** (vorher 319 · 168 · 1). Neu abgedeckt: das
  Wiederholen fehlgeschlagener Uploads, die Dateigrenze und die Zeitgrenzen zu ChurchTools, die
  Cookie-Verschlüsselung samt Bestandsformaten, der Seitenstrom aus Akkorden und Dokumenten sowie die
  Zeichen-Werkzeugleiste. Vier Testfälle in `docs/tests/` ergänzt (58 insgesamt).
- **Aus den Funden dieses Releases wurden Regeln gemacht** statt nur Notizen: Nach jedem Fix wird per
  `grep` nach der **zweiten Stelle** derselben Regel gesucht, jeder neue Test wird durch Zurücknehmen
  des Fixes gegengeprüft, und Build/Lint/Tests werden am **Exit-Code** geprüft (ein `grep` auf die
  Ausgabe meldete einmal „0 Fehler", während die CI rot war).

## [2.15.0] – 2026-07-31

Sammel-Release: vier nutzersichtbare Korrekturen und eine große Aufräumrunde (#198 abgeschlossen).
Für Mitspielende ändert sich nichts an der Bedienung – die geführte Einführung bleibt deshalb
bewusst unverändert.

### Behoben

- **Eine eigene Überschrift über `{title: …}` wird jetzt übernommen.** Wer im Editor die Titelzeile
  änderte, sah den neuen Titel nur in der Vorschau rechts – auf dem fertigen Blatt stand weiter der
  Liedname aus ChurchTools. Tonart und Taktart aus der Datei hatten längst Vorrang, Titel und Autor
  waren dabei vergessen worden. Gilt nun auf dem Blatt, in der Kopfzeile, im Ablaufplan und im
  PDF-Export; eine Version mit eigener Überschrift trägt sie auch auf ihrem Blatt. Unter **Alle
  Lieder** bleibt bewusst der ChurchTools-Name, weil die Liste die Liedtexte nicht lädt. (#236)
- **Querformat wird auch erkannt, wenn die App aus dem Hintergrund zurückkommt.** Drehte man das
  iPad, während die App weggelegt war, kam kein `resize` – die Chart-Anzeige merkte es trotzdem, das
  Blättern aber nicht. Anzeige und Blättern waren dann unterschiedlicher Meinung darüber, ob eine
  oder zwei Seiten zu sehen sind. Alle drei Stellen nutzen jetzt dieselbe Erkennung. (#215)
- **Derselbe Ablauf-Titel wird überall gleich dargestellt.** Bei einem Punkt ohne verknüpftes Lied
  wurden führende/folgende Leerzeichen nicht entfernt, mit Lied schon – derselbe Titel sah dadurch
  je nach Stelle anders aus. (#215)
- **„Als PDF teilen" rechnet den Kapo mit.** Bei gesetztem Kapo war das geteilte PDF anders
  transponiert als der Bildschirm – bei Kapo 2 standen die Akkorde zwei Halbtöne zu hoch. Ursache
  waren drei Fassungen derselben Rechnung; einer fehlte der Kapo-Abzug. Es gibt sie jetzt nur noch
  einmal. Bei Kapo 0 war nichts zu sehen, deshalb fiel es lange nicht auf. (#239)

### Geändert

- **Einheitliche Code-Formatierung**, die auch geprüft wird: `npm run format:check` läuft in der CI
  vor dem Lint. Nötig, weil ESLint hier bewusst **nicht** greift (`eslint-config-prettier` schaltet
  alle Formatregeln ab) – der Stil war darum unbemerkt auseinandergelaufen (86 Dateien). Ändert nur
  Formatierung; gegengeprüft, indem alle geänderten Code-Dateien vor und nach dem Formatieren auf
  ihren Zeichen-Kern reduziert und verglichen wurden. (#233)

### Intern

- **Seiten-Engine aufgeteilt** (`PageDeck`: 1161 → 713 Zeilen). Die Anzeige verhält sich
  unverändert – am Gerät geprüft (Stift, Handballen, Zwei-Finger-Abbruch, Pinch-Zoom, Blättern,
  Querformat, Text). Herausgelöst: das Malen der Seiten, die Zoom-Steuerung, das Blättern, die
  Text-Ebene, der Blätter-Streifen und die Werkzeugleiste. Die abgeschalteten Hook-Prüfungen sind
  von 13 auf 1 gesunken; dabei kam eine stille Lücke ans Licht: Wechselte der Anmerkungs-Schlüssel
  einer Seite, ohne dass Seitenzahl oder Sync sich bewegten, blieb der alte Strich-Stand stehen.
  40 neue Tests. (#193)
- **Testmanagement für die Tests, die nur von Hand gehen** (`docs/tests/`): 56 Testfälle als
  Klickanleitung, aus den geschlossenen Fehler-Issues und der Doku rekonstruiert, jeder mit der
  Issue-Nummer, bei der es schon einmal wehgetan hat. Der Kern ist die Auswahl: `npm run testplan`
  vergleicht die Änderungen seit dem letzten Tag mit dem Feld **Betrifft** und trennt „immer prüfen"
  (12), „betroffen" und „übrige" – letztere nur als Zahl, damit sichtbar bleibt, was ausgelassen
  wurde. `--pruefen` findet Verweise auf verschobene Dateien; ohne das würde ein Fall nie wieder
  vorgeschlagen, ohne jede Fehlermeldung. (#234)
- **Ablauf-Ansicht aufgeteilt** (`Setlist`: 672 → 357 Zeilen): Zeilen-Bestandteile, der „poof"-Zerfall
  entfernter Punkte, die volle Ansicht und die sortierbare Zeile sind eigene Komponenten. +18 Tests,
  darunter zwei für die Stellen, die im Gottesdienst wehtun: Die Lied-Nummer beim Antippen zählt nur
  **Lieder**, nicht alle Ablaufpunkte, und ein gelöschter Punkt zerfällt dort, wo er stand. Dazu ein
  Test gegen den stillen Fehler dieser Art Umzug: Wäre der Pfad zum SCSS-Modul falsch, gäbe es keinen
  Fehler – die Zeilen ständen einfach ohne Layout da. (#232)
- **Persistenz raus aus den Komponenten** (#198): `useSongSettings` hält und speichert die
  Anzeige-Einstellungen; die Schlüsselbildung liegt an genau einer Stelle. Vorher wurden
  `worship_view_<id>`/`worship_ver_<id>` an je **zwei** Stellen zusammengesetzt – beim Lesen und beim
  Schreiben; ein Tippfehler auf einer Seite hätte die Einstellung still ins Leere laufen lassen. In
  `components/` und `pages/` steht jetzt kein einziger `localStorage`-Zugriff mehr. +12 Tests für die
  Regel, die man leicht verwechselt: Tonart, Kapo, Spalten, Schrift, Nur-Text und
  Abschnitts-Transponierung gelten **pro Version**, die gewählte Version selbst **pro Lied**. (#231)
- **Serverseitig aufgeteilt** (`setlistBuilder`: 660 → 447 Zeilen) in vier reine Module ohne
  Netzzugriff: Ablauf-Diff, Arrangement-Dateien, ChordPro-Kopfangaben, Ablauf-Formatierung. Die vier
  prozesslokalen Caches liegen jetzt beieinander statt zwischen Routing-Code, mit der Folge
  aufgeschrieben: Mit einer zweiten Instanz hinter einem Lastverteiler würde der Ablauf zwischen
  „geändert" und „unverändert" flackern. (#230)
- **Chart-Ansicht entlastet** (`ChordChart`: 1053 → 812 Zeilen) – der letzte offene Punkt von #198.
  Drei Komponenten heraus: Lied-Menü, Aussehen-Menü und der „Notizen von …"-Wähler. Das Lied-Menü
  schließt sich jetzt **selbst** nach jeder Auswahl; vorher stand derselbe Aufruf elf Mal in den
  Klick-Handlern. Die Schriftgrößen-Regel ist eine reine, geprüfte Funktion. +33 Tests. Dabei kam
  der Kapo-Fehler (#239) ans Licht: Die Aufteilung machte sichtbar, dass die PDF-Optionen an drei
  Stellen gerechnet wurden. `songPdfOpts` ist nun eine dünne Hülle über `loadSettings` +
  `pdfOptionsForSong`, samt zweiter Kopie von `loadSecShift` weniger. Beim Zusammenführen galt
  jeweils die robustere Fassung – dadurch macht Unsinn im Speicher (`capo: "kaputt"`) nun auch in
  der **Anzeige** keinen `NaN`-Versatz mehr. (#198, #239)
- **Kleinkram aus den Sammel-Issues**, zwölf Punkte, +36 Tests. Zusammengeführt statt kopiert
  (Querformat-Erkennung, Textstil-Regel, der letzte rohe `fetch` außerhalb von `services/`). Härter
  geworden: Der Rate-Limit-Schlüssel erkennt IPv4-mapped in jeder Schreibweise – vorher hätte ein
  Client über die ausgeschriebene Form **zwei** Kontingente gehabt; der Schlüssel-Filter der
  Lied-Einstellungen bekam einen End-Anker (bewusst nicht `_\d+$`, das hätte die versionsbezogenen
  Schlüssel still verworfen und Einstellungen geräteübergreifend gelöscht); die Tastatur-Aussparung
  nutzt einen Callback-Ref, sonst hätte ein zusätzlicher Wrapper sie still abgeschaltet. Endlich
  getestet: die einmalige Übernahme lokaler Anmerkungen ins Konto (Rest von #192) – der Merker darf
  nach einem 401 **nicht** gesetzt werden, sonst ist die Übernahme für immer verpasst. (#229, #215,
  #199, #192)

## [2.14.2] – 2026-07-26

### Behoben

- **Ein falsch getipptes Passwort löscht nicht mehr die Offline-Reserve.** Die App hielt einen
  fehlgeschlagenen Anmeldeversuch für eine abgelaufene Sitzung und räumte dabei alles vom Gerät –
  auch die für den Gottesdienst gespeicherten Lieder. Genau im schlechtesten Moment (im Saal, ohne
  Netz, einmal vertippt) waren die Charts damit weg. (#210)
- **Anmerkungen und Einstellungen werden nach einer erneuten Anmeldung wieder gespeichert.** Hatte
  die App zwischendurch automatisch abgemeldet, landeten sie bis zum Neustart nur noch auf dem Gerät
  und fehlten auf anderen Geräten – ohne jeden Hinweis. (#211)
- **Nach einer Offline-Phase findet die App von selbst zurück.** Bisher blieb der Hinweis „Keine
  Verbindung" stehen, und die Anmeldung scheiterte mit „Bitte E-Mail und Passwort prüfen", obwohl
  das Passwort stimmte – nur ein kompletter Neustart half. Die App prüft die Verbindung jetzt aktiv
  nach (auch beim Zurückkehren in die App), und die Meldung benennt die echte Ursache:
  Verbindungsproblem, falsche Zugangsdaten oder zu viele Versuche. (#218)
- **Das Liederheft blockiert die Bedienung nicht mehr.** Beim Ändern von Tonart, Spalten oder
  Schriftgröße wurde es mitten im Bildaufbau neu erzeugt – auf älteren Geräten stand die App
  solange. Jetzt reagiert die Oberfläche sofort, die bisherigen Seiten bleiben sichtbar, bis die
  neuen fertig sind. (#197)
- **Lied-Einstellungen: Aufräumen ist immer möglich**, auch wenn die Speichergrenze schon
  überschritten war (vorher kam man aus der Sackgasse nicht mehr heraus). Und wenn eine Einstellung
  nicht gespeichert werden kann, sagt die App das jetzt, statt sie stillschweigend zu verwerfen.
  (#213)

### Sicherheit

- **Schutz gegen Passwort-Rateversuche gehärtet:** Die Erkennung des Anschlusses hinter dem
  Reverse-Proxy hing an einer ungeprüften Annahme; sie ist jetzt korrekt und durch einen Test
  abgesichert. (#214)
- Abhängigkeiten aktualisiert – im ausgelieferten Stand sind **keine bekannten Schwachstellen**
  mehr offen. (#215)

### Intern

- **Tests an den Hotspots** (#192, #212): Der Schreibpfad, der eine Lied-Verknüpfung unwiderruflich
  zerstören könnte, ist jetzt abgesichert (11 Tests); die PDF-Erzeugung ging von 0 % auf 88 %
  Abdeckung, die Anmerkungs-Synchronisierung von 13 % auf 54 %.
- Nachschliff aus den Code-Checks (#198, #215): einheitlicher Sitzungs-Zugriff im Server statt 29
  stiller Typ-Zusicherungen, kein Session-Cookie mehr als Cache-Schlüssel, weniger Log-Rauschen,
  toter Code entfernt, eindeutigere Hook-Namen.
- Tests: Client 129 → 185, Server 133 → 150.

## [2.14.1] – 2026-07-26

### Behoben

- **Die Ansicht verrutscht nicht mehr, wenn die Tastatur aufgeht:** Beim Verknüpfen eines Lieds lagen
  die Suchtreffer hinter der Tastatur – man musste erst hochwischen, um das gefundene Lied antippen zu
  können. Und nach dem Speichern blieb die obere Leiste verschoben („Termine" und das Häkchen klebten
  oben, darunter eine Lücke). Die Dialoge sparen die Tastatur jetzt aus, und die Ansicht sitzt nach dem
  Schließen wieder normal. Betrifft alle Dialoge mit Eingabefeldern (Hinzufügen, Bearbeiten,
  Einstellungen). (#207)

## [2.14.0] – 2026-07-26

### Neu

- **Titel eines Lied-Punkts ist änderbar und wird immer angezeigt:** In ChurchTools hat ein
  Lied-Punkt im Ablauf einen eigenen Titel (bei uns meist schlicht „Lied") **und** ein verknüpftes
  Lied – und CT zeigt beides: „Lied – Du großer Gott". Die App zeigte bisher nur den Liednamen, und
  das Titelfeld war bei Liedern gesperrt. Jetzt lässt sich der Titel auch bei Liedern bearbeiten
  (z. B. „Lobpreis 1"), und der Ablauf zeigt Titel und Liedname gemeinsam. Fügt der Titel nichts
  hinzu (leer oder gleich dem Liednamen), bleibt es bei einer Angabe – keine Dopplung. (#200)

### Sicherheit

- **Lied-Einstellungen haben jetzt eine Obergrenze pro Konto** (20.000 Einträge / 5 MB, wie die
  Anmerkungen seit v2.11.0). Ohne Grenze hätte ein angemeldetes Gemeindeglied den Speicher des
  Servers mit beliebig vielen Einstellungen füllen können. Aufräumen bleibt immer möglich, auch
  wenn die Grenze erreicht ist. (#195)
- **Der Schutz gegen Passwort-Rateversuche greift jetzt auch bei IPv6.** Die Bremse am Login zählte
  pro IP-Adresse – bei IPv6 hat ein Anschluss aber Milliarden Adressen, sodass sie umgangen werden
  konnte. Gezählt wird jetzt pro Anschluss (IPv6-/64-Netz). (#146)
- **Datei-Abrufe folgen keinen Weiterleitungen mehr,** damit die ChurchTools-Anmeldung die eigene
  Instanz nicht verlassen kann. (Geprüft: ChurchTools liefert Dateien direkt aus – die
  Dokumenten-Anzeige bleibt unverändert.) (#199)

### Intern

- **Kleinkram aus dem Code-Check (#199):** Anmerkungen ermitteln die Konto-ID aus der eigenen
  Sitzung statt sie bei jedem Speichern erneut bei ChurchTools zu erfragen; der kurze Zwischen-
  speicher des Ablauf-Fingerabdrucks ist kontobezogen (vorher konnte ein Nicht-Berechtigter statt
  einer Absage einen Prüfwert erhalten); Fehlermeldungen verraten keine internen ChurchTools-Pfade
  mehr; `clearSession` spiegelt die Cookie-Attribute.
- Tests: Client 115 → 123, Server 116 → 133 (+25).

## [2.13.6] – 2026-07-26

### Behoben

- **Abgelaufene Anmeldung führt jetzt sauber zum Login statt in eine Sackgasse:** Wenn die
  ChurchTools-Sitzung im Hintergrund ablief, ließ sich der Ablauf nicht mehr laden („Ablauf konnte
  nicht geladen werden") bzw. das Speichern schlug mit einer technischen Meldung fehl
  („CSRF-Token konnte nicht geholt werden") – und „Erneut versuchen" half nicht weiter, nur
  Abmelden und neu Anmelden. Die App erkennt eine abgelaufene Sitzung jetzt an **jeder** Stelle
  und führt automatisch zur Anmeldung; danach ist alles wieder da. (#186)
- **Die Kopfleiste springt nicht mehr:** Auf iPhones mit Notch/Dynamic Island ruckte die obere
  Leiste kurz nach oben und zurück, wenn ein Dialog geschlossen wurde – etwa nach dem Verknüpfen
  eines Lieds und Speichern. Der Abstand nach oben bleibt jetzt stabil. (#187)

### Intern

- **Nachschliff aus dem Delta-Check zu v2.10.0 (#152):** Ein vorübergehendes „Kein Zugriff" von
  ChurchTools (403) löst keine Zwangs-Abmeldung mehr aus (wichtig zusammen mit #186); der
  Hinweis „Sitzung abgelaufen" bietet einen „Abmelden"-Knopf, falls das automatische Abmelden
  scheitert; die Team-Notiz-Endpunkte nutzen die Konto-ID aus der eigenen Sitzung statt sie jedes
  Mal bei ChurchTools zu erfragen (fallen bei einem CT-Aussetzer nicht mehr unnötig aus).
  Dazu 10 neue Wachtests (Beschneidung der öffentlichen Konfiguration, Update-Check-Cache,
  Weitertragen der Konto-ID) – Server-Tests 106 → 116.

## [2.13.5] – 2026-07-16

### Intern

- **Code-Check-Nachschliff (Note 1, 0 Sicherheitsfunde):** Zoom-Wiederherstellung in PageDeck
  entdupliziert (`restoreVisibleZoom`), localStorage-Schlüssel-Grammatik zentralisiert
  (`utils/annotationKeys` + Tests), Zeichen-Engine in `usePointerStrokes` ausgelagert
  (PageDeck 1355→1161 Z.), Redraw-Effekt entschärft, alle react-refresh-Lint-Warnungen beseitigt
  (Lint 0). Kein Verhaltensunterschied.

## [2.13.4] – 2026-07-16

### Behoben

- **Gelöschte Ablaufpunkte lösen sich jetzt immer sichtbar auf:** Ein Punkt, der erst nach dem
  Öffnen des Ablaufs hinzukam und dann wieder gelöscht wurde, verschwand bisher kommentarlos
  (er stand noch in keiner „gesehen"-Basislinie, daher kam kein Auflöse-Platzhalter vom Server).
  Die Ablauf-Ansicht erkennt solche Löschungen jetzt selbst und zeigt auch dafür die
  durchgestrichene Zeile mit Zerfalls-Effekt – nahtlos, ohne Aufblitzen. (#178)
- **Start-Fehlerschirm heilt sich selbst und ist diagnostizierbar:** Der Auffang-Schirm „Die App
  konnte nicht richtig starten" lädt bei einem Chunk-Ladefehler (typisch direkt nach einem Deploy)
  jetzt einmalig still neu, statt stehen zu bleiben; bei echten Fehlern zeigt er zusätzlich die
  Fehlermeldung an (ein Screenshot reicht zur Ferndiagnose). (#176)

### Intern

- **UI-Monolithen aufgeteilt (#140):** `PageDeck.tsx` (1552→1355 Z.) und `ChordChart.tsx`
  (1292→1093 Z.) – Zoom-Persistenz, iOS-Tastatur, Slide-Übergang und Team-Notizen-Import in eigene
  Hooks (`useZoomPersistence`/`useKeyboardInsets`/`useSlideTransition`/`useTeamNotesImport`),
  `mergeStrokes` nach `utils/strokes.ts`. Kein Verhaltensunterschied.
- **Interaktionskern getestet (#141):** Tests für `usePageDraw` (Undo/Redo, Push-Dedup, Key-Wechsel)
  und `Coachmarks`; Playwright-Render-Smoke (`?demo=chart`) als eigener CI-Job `e2e`; Coverage auch
  über `hooks/` + `services/`. Voller Auth-Flow-E2E bleibt offen (#174).

## [2.13.3] – 2026-07-15

### Behoben

- **Hinweis-Balken und Menüs sitzen im Browser wieder unter der Kopfleiste:** Nach dem
  Kopfleisten-Fix (2.13.1) konnten der „Ablauf wurde geändert"-Balken und die beiden
  Chart-Menüs (Aussehen/Modus) im Safari-Tab leicht in die höhere Kopfleiste hineinragen –
  sie halten jetzt denselben Mindestabstand. Installiert unverändert.

## [2.13.2] – 2026-07-15

### Geändert

- **Offline-Anzeige verständlicher:** Statt der technischen Zählung („X Datensätze · Y Dateien")
  zeigt der Mehr-Tab jetzt schlicht „Offline bereit ✓ · zuletzt gespeichert am <Datum, Uhrzeit>".

## [2.13.1] – 2026-07-15

### Behoben

- **Obere Leiste im Browser nicht mehr abgeschnitten:** Im Safari-Tab (nicht installiert) wurde der
  Titel oben von der Adress-/Statusleiste angeschnitten. Die Kopfleisten (Termine/Lieder-Titel,
  Chart-Ansicht, Akkord-Editor) halten jetzt einen ausreichenden Mindestabstand nach oben – im
  installierten Modus unverändert.

## [2.13.0] – 2026-07-15

### Hinzugefügt

- **Zeitfilter für Lied-Statistik (#158):** In der Lieder-Bibliothek lässt sich bei den
  Sortierungen „Häufigkeit" und „Zuletzt" jetzt ein Zeitraum wählen (Von–Bis oder „Alle"). Dann
  zählen und erscheinen nur die Lieder, die in diesem Zeitraum tatsächlich gespielt wurden – so
  siehst du z. B. „was lief in den letzten 3 Monaten am häufigsten". Die Sortierung „A–Z" bleibt
  davon unberührt und zeigt weiter alle Lieder. Nebenbei: „Zuletzt" bezieht sich jetzt auf das
  letzte tatsächlich gespielte Datum (geplante Zukunftstermine zählen nicht mehr als „gespielt").
- **Volle Lied-Auswahl beim Hinzufügen & Verknüpfen (#157):** Beim „Lied hinzufügen" und beim
  Verknüpfen eines Lieds an einen Ablaufpunkt werden jetzt sofort alle Lieder gezeigt (statt einer
  leeren Suche) – mit denselben Möglichkeiten wie in der Bibliothek: durchsuchen, sortieren nach
  A–Z / Häufigkeit / Zuletzt und Zeitfilter. So sieht man beim Planen direkt, was lange nicht dran
  war oder oft läuft. Ein Lied = eine Zeile (Standard-Arrangement); Start alphabetisch.

### Geändert

- **Eintrag bearbeiten – alles in einem Schwung:** Änderungen an einem Ablaufpunkt (Titel, Dauer,
  Zuständige, Bemerkung, Lied verknüpfen/aufheben) werden jetzt in einem einzigen Speichervorgang
  geschrieben statt Schritt für Schritt – schneller und ohne halb gespeicherte Zwischenstände.
  Ein geleertes Dauer-Feld entfernt die Dauer; ein versehentlicher Tipp neben den Dialog verwirft
  vorgemerkte Änderungen nicht mehr.
- **Intern:** Die Nutzungsstatistik liefert je Lied die vergangenen Spieltermine (bis zu 4 Jahre
  zurück); Häufigkeit und „zuletzt" für den gewählten Zeitraum rechnet die App daraus direkt aus –
  ohne erneute Server-Abfrage beim Verstellen des Zeitraums.

### Behoben

- **„Geändert"-Markierungen bleiben nach Updates erhalten:** Der zuletzt gesehene Ablauf-Stand
  wurde in der produktiven Installation nicht dauerhaft gespeichert und ging nach jedem Update
  verloren (der „geändert"-Punkt wäre danach fälschlich überall erschienen). Jetzt liegt er
  zuverlässig auf dem Daten-Volume.

### Sicherheit

- **Ablauf-Abgleich ohne Klartext:** Der Live-Abgleich des Ablaufs überträgt nur noch eine
  Prüfsumme statt der eigentlichen Inhalte (Titel/Notizen/Verantwortliche).
- **Dateien nur von der eigenen ChurchTools-Instanz:** Beim Laden von Datei-Anhängen wird die
  Anmelde-Sitzung ausschließlich an die eigene ChurchTools-Adresse gesendet, nie an fremde Ziele.

## [2.12.0] – 2026-07-14

### Hinzugefügt

- **Live-Aktualisierung:** Änderungen am Ablauf erscheinen jetzt fast sofort bei allen – egal ob
  sie in ChurchTools oder in der App gemacht wurden. Die sichtbare Terminliste aktualisiert sich
  jede Minute von selbst (der „geändert"-Punkt taucht ohne Zutun auf), ein geöffneter Ablauf
  gleicht sich alle paar Sekunden ab und sortiert sich bei Änderungen sofort um. Im geöffneten
  Liederheft springt dagegen nichts von selbst: Dort erscheint ein dezenter Hinweis „Ablauf wurde
  geändert" mit „Neu laden"-Knopf – mitten im Spielen bewegen sich die Seiten nie ungefragt.
- **Im Ablauf sichtbar, was sich geändert hat (#161):** Öffnest du einen Ablauf, in dem sich seit
  deinem letzten Blick etwas getan hat, leuchten die betroffenen Punkte kurz auf – neue, inhaltlich
  geänderte (Tonart, Verantwortliche, Dauer, Notiz) und verschobene Punkte pulsen dreimal in der
  Akzentfarbe. Entfernte Punkte erscheinen noch einen Moment durchgestrichen und lösen sich dann in
  vielen kleinen Teilchen auf („poof", wie beim Löschen einer Nachricht auf dem iPhone). So siehst
  du auf einen Blick, was passiert ist. Wer im Gerät „Bewegung reduzieren" aktiviert hat, bekommt
  eine ruhige, bleibende Hervorhebung statt der Animation.

## [2.11.0] – 2026-07-14

### Hinzugefügt

- **Hinweis, wenn sich ein Ablauf geändert hat (#143):** An der Termin-Karte erscheint ein
  dezenter blauer Punkt, sobald sich der Ablauf geändert hat, seit du den Termin zuletzt geöffnet
  hast – ähnlich wie bei ungelesenen Nachrichten. Er verschwindet, sobald du wieder reinschaust.
  Erfasst wird die ganze Ablauf-Struktur (Lieder, Reihenfolge, Tonart, aber auch verschobene oder
  umbenannte Punkte, Verantwortliche, Dauer, Notiz). Der Hinweis ist persönlich und gilt
  geräteübergreifend (einmal angeschaut, überall weg).

### Geändert

- **ChurchTools-Änderungen erscheinen zeitnah (#159):** Verschobene Ablaufpunkte oder geänderte
  Setlists waren bis zu 5 Minuten lang nicht sichtbar. Jetzt lädt die App die aktuellen Daten beim
  nächsten Öffnen / Zurückkehren nach; die Offline-Verfügbarkeit bleibt unverändert.

### Behoben

- **Update während geöffneter App führt nicht mehr zum Fehler-Bildschirm (#151):** Wird ein neues
  Release eingespielt, während die App gerade offen ist, konnte das erste Öffnen einer noch nicht
  geladenen Seite fehlschlagen (die alte Version verwies auf inzwischen ersetzte Dateien) – es
  erschien die Meldung „Die App konnte nicht richtig starten". Jetzt lädt die App in diesem Fall
  einmal automatisch neu und holt sich die aktuelle Version; ein zweites Fehlschlagen führt weiter
  zur verständlichen Meldung (kein endloses Neuladen). Dauert ein Nachladen ungewöhnlich lange,
  erscheint zusätzlich nach einigen Sekunden ein „Neu laden"-Knopf.

### Sicherheit

- **Datei-Proxy gehärtet (#138):** Aus ChurchTools durchgereichte Dateien werden nur noch als
  sichere Typen (PDF, Bilder, Klartext) direkt angezeigt; alles andere wird heruntergeladen statt
  ausgeführt. Verhindert, dass eine hochgeladene HTML-/Skript-Datei im App-Kontext läuft.
- **Speicher-Obergrenzen für Anmerkungen (#139):** Pro Konto gelten jetzt großzügige Höchstgrenzen
  (Anzahl + Gesamtgröße), und der Server-Zwischenspeicher ist gedeckelt – schützt Server-Speicher
  vor Missbrauch. Im Alltag nicht spürbar.

## [2.10.0] – 2026-07-13

### Geändert

- **Deutlich schnellerer Erststart (#142):** Die App lädt beim Start nur noch das Nötigste
  (Anmeldung + Terminliste, ~69 kB statt ~863 kB komprimiert). Die schweren Teile – v. a. die
  Chart-Anzeige mit dem PDF-Renderer – kommen erst beim ersten Öffnen nach (kurzer Lade-Moment,
  einmalig). Alle nachgeladenen Teile stecken weiter im Offline-Vorrat der installierten App:
  Einmal online geöffnet, funktioniert alles wie gehabt auch ohne Netz. Spürbar vor allem im
  langsamen Kirchen-WLAN.
- **Intern: Anmerkungs-Typen zu einer Quelle zusammengeführt (#137):** Die Datenform der
  Anmerkungen (Striche/Texte/Zoom) war an vier Stellen getrennt definiert und auf dem Server
  bereits veraltet (Format-Felder fehlten). Jetzt gibt es genau eine Definition in `shared/types`,
  und ein Compile-Wächter bricht den Build, falls Server-Prüfung und Typ je wieder
  auseinanderlaufen – Anmerkungsfelder können damit nicht mehr stillschweigend beim Speichern
  verloren gehen (die Bug-Klasse hinter #115). Keine sichtbare Änderung in der App.

### Behoben

- **Hängende ChurchTools-Anmeldung führt nicht mehr in die „Erneut versuchen"-Sackgasse (#149):**
  Liefert ChurchTools minutenlang leere Berechtigungen (realer Vorfall am 13.07.), überbrückt der
  Rechte-Speicher das jetzt zuverlässig – er kennt das Konto neuerdings direkt aus der Anmeldung
  und ist nicht mehr auf eine zweite ChurchTools-Abfrage angewiesen. Ist die ChurchTools-Sitzung
  wirklich unbrauchbar, führt die App automatisch zur Anmeldung, statt vergebliche „Erneut
  versuchen"-Knöpfe zu zeigen. Greift vollständig ab der ersten Neuanmeldung nach dem Update.

### Sicherheit

- **Feinschliff (#146, Teil 1):** Anmeldefelder längenbegrenzt; die öffentliche Konfigurations-
  Abfrage (Login-Screen) verrät keine internen Gruppen-/Rollen-Zuordnungen mehr; die
  Update-Prüfung fragt GitHub bei Netzwerkfehlern nicht mehr ungebremst an.

## [2.9.1] – 2026-07-10

### Behoben

- **Rechte-Änderungen greifen ohne Ab-/Neuanmelden:** Die Berechtigungen wurden auf dem Gerät bis
  zu 30 Minuten zwischengespeichert. Gab der Admin z. B. die Team-Notizen frei, sahen die anderen
  das erst nach langem Warten oder erst nach Abmelden/Neuanmelden. Jetzt wird der gespeicherte Stand
  zwar sofort angezeigt (kein Flackern), aber bei jedem App-Start frisch geprüft – geänderte Rechte
  erscheinen damit schon beim nächsten Neuladen.

## [2.9.0] – 2026-07-10

### Hinzugefügt

- **Team-Notizen (#124):** Anmerkungen bleiben persönlich – aber wer mag, **teilt** sie mit dem
  Team („Mehr → Team-Notizen → Meine Anmerkungen teilen"). Berechtigte wählen im Lied über den
  Personen-Knopf **„Notizen von …"** eine Person und dann eine ihrer Ebenen (Version +
  Darstellungsart, nur solche mit Anmerkungen) und sehen sie **schreibgeschützt in der Ansicht
  dieser Person** (Spalten, Schrift, Version), damit alles an der richtigen Stelle sitzt. Eine
  Leiste bietet **Ansehen / Zusammenführen / Ersetzen** mit **Live-Vorschau** direkt im Chart;
  erst **„Übernehmen"** kopiert die Anmerkungen in die eigenen (bei „Zusammenführen" zusätzlich zu
  den vorhandenen), zusammen mit der Ansicht dieser Ebene – die eigene Tonart bleibt. Wer
  Team-Notizen nutzen darf, legt der Admin unter „Mehr → Verwaltung → Anmerkungen" fest:
  **Gruppen-Zuweisung** (ChurchTools-Gruppen) + **Rollen-Zuweisung** (freigegebene Rollen je
  Gruppe; nichts angehakt = niemand). Die geführte Einführung der Chart-Ansicht wurde um den
  Schritt „Notizen von anderen" ergänzt.
- **Eigene Anmerkungen je Darstellungsart:** „Akkorde & Text" und „Nur Text" haben jetzt getrennte
  Anmerkungen (und eigenen Zoom) – beim Umschalten verrutscht nichts mehr. Bestehende Anmerkungen
  gelten als „Akkorde & Text". Im Lied-Menü zeigt ein kleines Stift-Symbol, welche Versionen und
  Darstellungsarten eigene Anmerkungen haben.
- **Anmerkungsleiste beweglich:** Die Werkzeugleiste lässt sich am Griff senkrecht verschieben und
  über den Pfeil zu einem kleinen Rand-Knopf einklappen (Position und Zustand bleiben pro Gerät
  erhalten).

### Behoben

- **Zoom bleibt nicht mehr in einer Hälfte stecken** beim Wechsel Hochformat ↔ Querformat oder nach
  dem Zurückkehren aus einer anderen App.
- **Anmerkungen auf der inaktiven Chart-Hälfte** (Querformat) lassen sich nicht mehr versehentlich
  auswählen oder bearbeiten – ein Tipp aktiviert dort nur die Seite.

## [2.8.1] – 2026-07-09

### Behoben

- **Kein fälschliches „keine Berechtigung" mehr bei ChurchTools-Aussetzern:** ChurchTools liefert
  gelegentlich für ein paar Sekunden leere Rechte zurück (während es die Berechtigungen einer
  Sitzung neu berechnet), obwohl der Nutzer normal berechtigt ist. Bisher sah man in diesem Moment
  den Hinweis „keine Berechtigung" bzw. musste die Seite mehrfach neu laden. Der Server merkt sich
  jetzt pro Konto die zuletzt gültigen Rechte und liefert sie während eines solchen Aussetzers aus –
  der Nutzer merkt nichts mehr davon. Ein dauerhaftes „keine Berechtigung" wird bewusst nie gemerkt,
  damit tatsächlich Nicht-Berechtigte weiterhin korrekt den Hinweis sehen. Die Rechte werden auf dem
  Daten-Volume abgelegt (überstehen Updates) und gelten bis zu 30 Tage als vertrauenswürdig.

## [2.8.0] – 2026-07-08

### Hinzugefügt

- **Hilfe „Als App installieren":** Der Mehr-Tab erklärt jetzt passend zum Gerät, wie man die App
  auf den Startbildschirm legt – auf iPhone/iPad („Teilen → Zum Home-Bildschirm"), auf dem Mac
  („Teilen → Zum Dock hinzufügen") und auf Android; unter Chrome/Edge erscheint ein echter
  „Installieren"-Knopf. Der Hinweis verschwindet, sobald die App bereits installiert läuft.

### Geändert

- **Deploy robuster gegen Datenverlust:** Die Compose-Dateien setzen den Projektnamen jetzt fest
  (`name:`). Damit bleibt das Daten-Volume (Gemeindename, Links, Anmerkungen) auch dann erhalten,
  wenn beim Aktualisieren im Container Manager versehentlich ein abweichender Projektname entsteht.
  (Hintergrund: Ein einmalig falsch benanntes Projekt hatte am 08.07. dazu geführt, dass die App
  ein leeres Volume einhängte und Werkseinstellungen zeigte – die Daten waren nie verloren.)

## [2.7.2] – 2026-07-08

### Sicherheit

- **Session-Cookie in Produktion nur über HTTPS:** In der Produktiv-Konfiguration trägt das
  Anmelde-Cookie jetzt das `Secure`-Flag und geht damit nie über eine unverschlüsselte Verbindung.
  (#45)
- **Restriktive Content-Security-Policy in Produktion:** Statt die CSP komplett abzuschalten gilt
  jetzt eine enge Richtlinie (nur eigene Quellen, kein eingeschleustes Fremd-Script; pdf.js-Worker
  und Anmerkungs-Bilder ausdrücklich erlaubt). Im reinen LAN-HTTP-Betrieb bleibt die App voll
  nutzbar. Zusätzliche Schutzschicht gegen Cross-Site-Scripting. (#47)

### Behoben

- **Neutraler Marker für bearbeitete Lieder:** Von der App gespeicherte Songversionen tragen jetzt
  den Zusatz „(App)" statt des gemeindespezifischen „(ECG)". Bestehende „(ECG)"-Dateien (und die
  ganz alten „— Bearbeitet"/„— ECG") werden weiterhin erkannt – es geht nichts verloren. (#34)
- **Einseitige Lieder mittig:** Ein Lied/Ablauf mit nur einer Seite wird im Querformat jetzt über
  die volle Breite zentriert statt links neben einer leeren Fläche angezeigt. (#128)

### Geändert

- **Direkt nachnutzbar für andere Gemeinden:** Die Produktiv- und Test-Compose-Dateien wurden von
  gemeindespezifischen Namen befreit (generische Container-/Watchtower-Namen), und die
  Installationsanleitung erklärt jetzt die drei Betriebs-Varianten (Basis / Produktiv / Test).
  Bestehende Instanzen behalten ihr Daten-Volume ohne Migration. (#35)

## [2.7.1] – 2026-07-07

### Sicherheit

- **Abmelden räumt jetzt vollständig auf:** Beim Logout wird auch die dahinterliegende
  ChurchTools-Sitzung serverseitig beendet (vorher blieb sie bis zu ihrem eigenen Ablauf gültig),
  und alle auf dem Gerät zwischengespeicherten Konto-Daten werden entfernt – Offline-Vorrat
  (Abläufe, Lieder, PDFs), lokale Anmerkungs-/Einstellungs-Caches. Wichtig für geteilte
  Gemeinde-Geräte: Der nächste Nutzer sieht keine Daten des vorherigen. Geräte-Einstellungen
  (z. B. „Einführung gesehen") bleiben erhalten.
- **Anmeldung läuft nach spätestens 90 Tagen ab:** Die automatische Verlängerung bei Nutzung
  verlängert nicht mehr unbegrenzt – 90 Tage nach dem Login ist eine Neuanmeldung nötig.
  Bestehende Anmeldungen bleiben beim Update erhalten (Frist zählt ab jetzt).

## [2.7.0] – 2026-07-07

### Hinzugefügt

- **Geführte Einführung für neue Nutzer:** Beim ersten Mal erklären kleine Hinweisblasen direkt am
  jeweiligen Knopf, was wofür da ist – in den Terminen (Terminliste, Liedblätter öffnen,
  Offline-Symbol, Bereiche), in der Ablauf-Ansicht (Lied öffnen, als PDF teilen, bearbeiten) samt
  Bearbeiten-Modus (Sortieren, Punkt bearbeiten, Hinzufügen) und in der Liedansicht (Blättern &
  Zoomen, Lied-Optionen, Darstellung, Anmerkungen). Jederzeit „Überspringen"; im Mehr-Tab lässt
  sich die Einführung erneut starten.

### Geändert

- **Termine-Ansicht aufgeräumt:** Die Liederanzahl steht jetzt als kleine Zahl am Noten-Knopf
  (vorher in der Textzeile abgeschnitten). Das Symbol zum Offline-Speichern ist eine Wolke mit
  Pfeil (statt eines Geräte-Download-Pfeils), passend zur „Wolke mit Haken" für „liegt offline vor".
- **„Vergangene" ohne Netz ausgegraut:** Vergangene Gottesdienste werden live geladen und sind
  offline nicht verfügbar – der Umschalter ist dann ausgegraut und erklärt das per kurzem Hinweis.

## [2.6.0] – 2026-07-06

### Hinzugefügt

- **Offline-Reserve (#32):** Gottesdienste sind im Saal auch ohne Netz verfügbar. Der **nächste**
  Gottesdienst wird automatisch komplett vorgehalten (Ablauf, Charts, PDFs/Bilder – Schalter im
  Mehr-Tab); weitere kommende Gottesdienste lassen sich per **Download-Knopf direkt am Termin**
  offline speichern und werden danach automatisch aktuell gehalten. Ein **Wolken-Symbol am Termin**
  zeigt dauerhaft, was offline bereitliegt. Ohne Netz werden nicht verfügbare Termine und die
  Liedersammlung **ausgegraut** (Tipp erklärt es kurz). Technik: React-Query-Persistenz in
  IndexedDB, Datei-Cache im Service Worker, PDF-Renderer komplett im App-Bundle; Dokumente werden
  als Ganzes geladen statt gestreamt – dadurch öffnen Lieder offline ohne die früheren ~10-Sekunden-
  Hänger. Das App-Logo in der Ecke der Akkord-Blätter ist jetzt fest eingebettet und erscheint
  daher auch offline (vorher fehlte es dort). Grenze: Ohne Netz kein neues Anmelden.
- **Verlässliche Offline-Erkennung & keine Sackgassen (#32):** Die App erkennt „offline" jetzt am
  tatsächlichen Server-Kontakt statt nur an der Netz-Anzeige des Geräts – so greift das Ausgrauen
  auch im Gemeinde-WLAN ohne Internet-/Server-Zugang. Beim Neustart wartet die App, bis der
  Offline-Speicher geladen ist (kein kurzer Anmelde-Bildschirm mehr, der gemerkte Gottesdienst
  bleibt erhalten). Lade- und Fehleransichten haben immer einen Rückweg, und der Anmelde-Bildschirm
  erklärt offline, dass eine Verbindung nötig ist – man bleibt nicht mehr in einer Schleife hängen.
- **Weißer Bildschirm beim Öffnen ohne Netz behoben (#32):** Nach dem kompletten Schließen blieb die
  App beim Wieder-Öffnen ohne Netz manchmal weiß. Ursache war ein „wartender" Hintergrund-Prozess
  (Service Worker), der auf iPad/iPhone beim Kaltstart die App-Hülle nicht auslieferte. Der neue
  Stand aktiviert sich jetzt sofort und zuverlässig – **ohne** die laufende App mitten im
  Gottesdienst neu zu laden. Zusätzliches Sicherheitsnetz: Startet die App einmal nicht, erscheint
  statt eines weißen Bildschirms eine Meldung mit „Neu laden".

### Geändert

- **„Aktualisieren"-Knopf im Lied entfernt:** Der Inhalt (Ablauf/Liedtexte) aktualisiert sich jetzt
  alle 60 Sekunden von selbst – auch wenn das Gerät dauerhaft offen im Lied bleibt. Neu gezeichnet
  wird nur bei echten Änderungen; ohne Netz scheitert das Nachladen lautlos.

## [2.5.2] – 2026-07-06

### Geändert

- **„Nach Updates suchen"-Knopf entfernt:** Er war überflüssig – beim (kompletten) Neu-Öffnen der App
  wird ohnehin automatisch die neueste Version geladen. Die stille Auto-Aktualisierung und der
  Versions-Hinweis bleiben.

### Behoben

- **Normaler Anmerkungs-Text wurde nach kurzer Zeit fett (#115):** Beim Server-Abgleich gingen die
  Format-Angaben (fett/kursiv/unterstrichen/Ausrichtung) verloren, weil sie serverseitig nicht
  gespeichert wurden – beim nächsten Laden wurde normaler Text fälschlich wieder fett. Die Formate
  werden jetzt vollständig mitgespeichert.
- **Gestrichelter Text-Rahmen blieb stehen (#114):** Beim Verlassen des Anmerkungsmodus wird die
  Text-Auswahl jetzt sofort aufgehoben – der Rahmen bleibt nicht mehr bis zum Seitenwechsel sichtbar.
- **Text-Anmerkungen blinkten beim Weiterwischen (#113):** Die Blätter-Animation nutzte einen
  doppelt breiten Schiebe-Streifen, der auf dem iPad (Retina) die maximale GPU-Texturbreite
  überschritt – WebKit zeichnete den Anmerkungs-Text dadurch verzögert (Striche/Seiten sind eigene
  Texturen und waren nicht betroffen), und vorwärts endete die Animation auf einer krummen Position.
  Jetzt werden alte und neue Seite als zwei getrennte, je bildschirmbreite Ebenen geschoben; beide
  Richtungen enden exakt deckungsgleich mit der Live-Ansicht. Zusätzlich: Text-Formatierung im
  Übergang exakt wie live (fett/normal/kursiv/…), Textebene wird beim Seitenwechsel synchron
  zurückgesetzt, Abdeckung steht garantiert vor dem ersten Frame.
- **Altes Lied blitzte bei sehr schnellem Blättern auf:** Startete ein neuer Übergang, während der
  vorherige noch lief (z. B. schnelles Tastatur-Blättern), blieb die alte Seiten-Grafik über der
  neuen liegen. Die Übergangs-Ebenen werden jetzt pro Blättern frisch aufgebaut.

## [2.5.1] – 2026-07-05

### Behoben

- **„Too many requests" im Gemeinde-WLAN behoben:** Das Anfrage-Limit galt versehentlich auch für
  statische Dateien und zählte pro IP – da im Gemeinde-WLAN alle Geräte über eine öffentliche IP
  laufen, teilte sich das ganze Team ein Kontingent und lief beim gemeinsamen Nutzen sofort voll.
  Das Limit greift jetzt nur noch für echte Aktionen und zählt **pro angemeldetem Nutzer**;
  Grenzwerte großzügiger.

## [2.5.0] – 2026-07-05

### Hinzugefügt

- **Update-Hinweis in der App:** Liegt eine neue Version bereit, erscheint ein dezenter Balken
  „Neue Version verfügbar" mit **Jetzt laden** (übernimmt sie sofort) und **Später**. Die App
  sucht dafür aktiv nach Updates – beim Start, bei Rückkehr in den Vordergrund und stündlich.
  Bisher blieben Geräte (v. a. iPhone/iPad-PWA) unbemerkt auf altem Stand hängen; so erreichte
  z. B. der Fix für das „keine Berechtigung"-Schloss die Geräte nie von selbst. Es wird weiterhin
  **nie ungefragt** mitten in der Nutzung neu geladen.
- **„Nach Updates suchen" im Mehr-Tab:** Ein Knopf unter der Versionszeile prüft sofort auf eine
  neue Version und **lädt sie direkt** (kurz „Aktualisiere…", dann neu geladen) bzw. meldet „Du bist
  auf dem neuesten Stand". Verlässlicher Hebel gerade auf dem iPhone, wo die automatische Suche
  beim App-Wechsel manchmal nicht anschlägt.

### Behoben

- **Kopfleiste rutschte beim Sortieren weg (iPhone):** Beim Ziehen eines Ablauf-Punkts mit
  Auto-Scroll verschwand die obere Leiste („‹ Termine" / „✓ Fertig") nach oben und war nur durch
  Drehen des Geräts zurückzuholen. Der Auto-Scroll bleibt jetzt auf die Liste begrenzt und die
  Ansicht wird nach dem Ziehen automatisch zurechtgerückt. (#56)
- **Abgelaufene Sitzung führt jetzt zum Login statt in eine Sackgasse:** War die App-Anmeldung noch
  gültig, die ChurchTools-Sitzung dahinter aber abgelaufen, zeigte die App „Berechtigungen konnten
  nicht geladen werden – Erneut versuchen" – was zwecklos war (nur Neu-Anmelden half). Jetzt erkennt
  die App die abgelaufene Sitzung, meldet automatisch ab und führt direkt zum Login. (#104)

## [2.4.1] – 2026-07-04

### Geändert

- **Spalten & Textgröße geräteübergreifend:** Diese Einstellungen sind jetzt auf allen Geräten
  gleich (über das Konto synchronisiert). Nur der **Zoom** bleibt bewusst pro Gerät getrennt
  (iPad/PC vs. iPhone).
- **Eintrag hinzufügen (Text):** zeigt jetzt dieselben Feld-Überschriften wie das Bearbeiten
  (Titel · Dauer · Zuständig · Bemerkung).
- **Verknüpfung aufheben:** entfernt jetzt auch den Titel (kein zurückbleibender Liedtitel), und
  der Bearbeiten-Dialog bleibt offen – so kann man den Punkt direkt neu benennen.
- **Ladekringel** ist ein weich auslaufender Ring statt eines harten Segments.

### Behoben

- **Sporadisches „keine Berechtigung"-Schloss:** Liefert ChurchTools kurzzeitig leere Rechte
  (ein bekannter Aussetzer, z. B. beim Neu-Laden), versucht die App es jetzt automatisch erneut,
  statt sofort das Schloss zu zeigen. Ein **Admin** bekommt zudem immer Zugriff.

## [2.4.0] – 2026-07-03

### Neu

- **PDFs mitten im Ablauf:** Hochgeladene Lied-PDFs/Bilder sind jetzt Teil des **durchgehenden
  Ablaufs** – man wischt nahtlos über alle Lieder (Akkorde und PDFs gemischt), und im Querformat
  stehen zwei Seiten nebeneinander (auch über Lied-Grenzen). Vorher war eine PDF eine isolierte
  Einzelansicht.
- **Weiche Blätter-Animation:** Beim Blättern schiebt sich die neue Seite horizontal herein (wie
  im Foto-Viewer) – ruhiger Übergang statt hartem Umschalten.
- **Anmerkungen im 2-Seiten-Modus:** Nur die **aktive** Seite ist beschreibbar und hervorgehoben,
  die andere ist ausgegraut und gesperrt; ein Tipp wechselt die aktive Seite (kein versehentliches
  Kritzeln auf der falschen Seite mehr).
- **Text-Anmerkungen direkt auf der Seite:** Antippen setzt einen Cursor genau an der Stelle
  (wie in Word) – lostippen, außerhalb tippen legt den Text fest. Zeilenumbrüche möglich;
  ausgewählten Text verschieben, Größe über einen Ziehknopf ändern (Anzeige in vertrauten „pt");
  ein Tipp auf einen bestehenden Text öffnet ihn direkt zum Bearbeiten.
- **Text formatieren:** Fett, Kursiv, Unterstrichen sowie linksbündig/zentriert/rechtsbündig –
  je Textblock, wirkt live auf den ausgewählten Text bzw. auf den nächsten neuen.
- **Dickere Strichstärken:** Stift, Marker und Radierer bieten zusätzliche, deutlich dickere
  Stufen (Radierer bis „Flächen-Format").
- **Akkorde per 1-Tipp:** Im Editor fügt ein Tipp auf den Grundton den Akkord sofort ein; Zusätze
  (m, 7, maj7, sus4 …) und Bass (Slash-Akkorde wie A/C#) hängen sich direkt an.
- **Staging-Version sichtbar:** Auf der Test-Instanz zeigt der „Mehr"-Tab den Build-Stand
  (`staging-<commit>`), damit man den geladenen Stand erkennt.

### Geändert

- **Zoom-/Blätter-Gesten neu:** **ein Finger blättert, zwei Finger zoomen und verschieben** – auch
  im Zeichenmodus (Zoomen/Verschieben kritzelt nicht mehr ins Dokument; beim Apple Pencil zeichnet
  der Stift, die Finger zoomen). Die „Zurück/Fertig"-Leiste entfällt – ein Pinch zoomt und speichert
  automatisch, Zurücksetzen über den Knopf in der Kopfleiste.
- **Anmerkungs-Werkzeugleiste** aufgeräumt: klare, einheitliche Icons, größere Knöpfe, ein
  Farbknopf mit aufklappender Farbreihe. Vier Farben (Rot, Blau, Grün, Orange) + eigener Farbwähler.
  Alle Werkzeuge einheitlich bedienbar: erster Tipp wählt, zweiter Tipp klappt die Einstellungen
  auf (Strichstärke bzw. Text-Einstellungen als eigener Balken), ein dezenter Punkt-Hinweis am
  aktiven Werkzeug zeigt das an. Die Einstellungen klappen jeweils auf Höhe ihres Werkzeugs auf.
- **Editor** aufgeräumt: kompakter Kopf, moderner Text-Look (proportional statt „Schreibmaschine",
  Akkorde farbig), mehrseitige und scharfe Vorschau.
- Die Fußzeilen-Punkte markieren im Querformat beide sichtbaren Lieder.

### Behoben

- **Zoom bleibt zuverlässig erhalten** – lokal wie serverseitig, über App-Wechsel/Neustart,
  Lied-/Seitenwechsel, Hochformat↔Querformat und das Öffnen/Schließen des Editors; kein
  Zurückspringen zur Mitte mehr, gleiche Seite links wie rechts.
- **Editor-Tastatur** schiebt nicht mehr die ganze Ansicht hoch – nur der Textbereich scrollt.
- **Text-Anmerkung auf dem iPad:** Die Bildschirmtastatur öffnet jetzt zuverlässig und schiebt
  die Ansicht nicht mehr weg – nur der Notenbereich hebt sich so weit, dass der Cursor sichtbar
  bleibt; kein hängender Balken beim Schließen der Tastatur mehr.
- **Sporadisches „keine Berechtigung"-Schloss behoben:** Eine kurzzeitig leere Rechte-Antwort von
  ChurchTools wird jetzt als Aussetzer erkannt und automatisch erneut versucht, statt fälschlich
  „keine Berechtigung für Lieder oder Abläufe" anzuzeigen.
- Einseitige PDF steht im Querformat an der richtigen Stelle (rechts neben dem Vorgänger).

## [2.3.2] – 2026-07-02

### Geändert

- **Länger angemeldet bleiben:** Die Anmeldung gilt jetzt **30 Tage** statt nur 12 Stunden und
  verlängert sich bei jeder Nutzung automatisch (gleitendes Ablaufdatum) – das ständige
  Neu-Anmelden entfällt bei regelmäßiger Nutzung. Hinweis: ChurchTools kann seine eigene Sitzung
  unabhängig davon früher beenden; auf dem iPhone/iPad (Web-App vom Home-Bildschirm) löscht iOS
  Cookies nach etwa 7 Tagen ohne Nutzung – beides liegt außerhalb der App.

## [2.3.1] – 2026-07-02

### Neu

- **Mehr Einstellungen beim Hinzufügen:** Das Fenster „Eintrag hinzufügen" hat für Text-Punkte
  jetzt ein Feld **Dauer (Minuten)** – vorher fehlte es hier.
- **Direkt weiterbearbeiten nach Lied-Hinzufügen:** Sobald ein Lied zum Ablauf hinzugefügt wurde,
  öffnet sich automatisch dessen Bearbeiten-Dialog, sodass Dauer, Zuständige, Bemerkung und die
  Uhrzeit-Anzeige gleich gesetzt werden können.

### Behoben

- **Überschriften im Bearbeiten-Modus wieder bearbeitbar:** Eine Überschrift lässt sich jetzt per
  Antippen (bzw. über den Stift) umbenennen; bisher war sie nur verschiebbar.

### Geändert

- **Optik im Bearbeiten-Modus:** Das unsauber dargestellte Zeichen „⠿" ist durch ein sauberes
  6-Punkte-Griff-Icon ersetzt; die Ziehgriffe sind kräftiger und der Bearbeiten-Stift in
  Akzent-Blau hervorgehoben.

## [2.3.0] – 2026-07-01

### Neu

- **Komfortabler ChordPro-Editor (neu gebaut):** Der Lied-Editor basiert jetzt auf CodeMirror und
  bietet Syntax-Farben (Akkorde blau, Direktiven teal), echtes **Rückgängig/Wiederholen**, sauberes
  Einfügen an der Cursorposition, **Auswahl-Menüs** für Akkorde (Dur/Moll/7) und Formate (deutsch
  beschriftet mit Erklärung), zuletzt genutzte Akkorde, Transponier-Regler und eine **echte
  PDF-Vorschau** („wie gedruckt") mit Umschalter **Editor · Beide · Vorschau** (je nach Fenstergröße). (#37)

### Geändert

- **Editor besser lesbar:** In den Info-Zeilen (`{title: …}`, `{artist: …}`, `{key: …}`) wird nur
  noch das Label dezent teal eingefärbt – der eigentliche Wert (Titel/Artist/Tonart) steht jetzt
  kräftig und gut lesbar in normaler Textfarbe. Liedtext etwas größer und luftiger.
- **Ablauf-Bearbeiten an die Ansicht angeglichen:** Der Bearbeiten-Modus sieht jetzt genauso aus wie
  die normale Ablauf-Ansicht (gleiche Positionen und Höhen) – kein Springen mehr beim Umschalten;
  Ziehgriff in der Zeit-Spalte, Bearbeiten per Stift.
- **Lied-Menü leichter auffindbar:** In der Akkord-Ansicht öffnet jetzt der gesamte Kopf-Bereich
  (Titel samt Tonart/Capo/Version/Tempo) das Lied-Menü – mit deutlich sichtbarem Auslöser, nicht
  mehr nur über den Titel. (#42)
- **Ablauf-Bearbeiten an die Ansicht angeglichen:** Beim Umschalten in den Bearbeiten-Modus bleiben
  Zeilenhöhe und Position gleich (die Uhrzeit-Spalte wird zum Ziehen-Griff, Dauer und Zuständige
  bleiben sichtbar). Lieder sind deutlich hervorgehoben, die Minutenangaben stehen auf einer Linie,
  ein Stift zeigt die Bearbeitbarkeit; Überschriften ohne Uhrzeit.

### Behoben

- Termine am gleichen Tag werden nach Uhrzeit sortiert. (#36)
- Manuell (als Freitext) zugeordnete Zuständige werden im Ablauf angezeigt. (#38)
- Beim Wechsel des Zeichenwerkzeugs schließt eine offene Textbearbeitung. (#39)
- Pinch-Zoom in der Akkord-Ansicht bleibt erhalten und friert beim Drehen (Hoch-/Querformat)
  nicht mehr ein. (#33)

### Behoben

- **Festhängender Zoom in der Akkord-Ansicht (iPad):** Ein reingezoomter Ausschnitt konnte beim
  Drehen bzw. über mehrere Lieder hinweg „kleben" bleiben oder fälschlich für alle Lieder gelten.
  Der Zoom wird jetzt pro Ausrichtung (Hoch-/Querformat) und pro Lied-Seite getrennt gemerkt. (#33)
- **Reihenfolge gleichzeitiger Termine:** Termine bzw. Einträge mit derselben Uhrzeit werden jetzt
  stabil und nachvollziehbar sortiert. (#36)
- **Zuständige als Freitext:** Frei eingetragene Namen (ohne Dienst-Klammern) werden im Ablauf jetzt
  mit angezeigt – nicht nur die über den Dienstplan zugewiesenen Personen. (#38)
- **Textfeld-Werkzeug:** Das Wechseln des Werkzeugs bzw. ein Tipp ins Leere schließt ein offenes
  Textfeld jetzt sauber und legt kein ungewolltes neues Feld an. (#39)

### Intern

- Anzeige- und Zustandslogik von `App` und `ChordChart` in eigene Hooks ausgelagert
  (`useAppNav`/`navStorage`, `useChartNavigation`, `useChartEditor`), tote Kopf-Styles entfernt –
  reine Wartbarkeit, ohne Funktionsänderung.
- GitHub-Actions auf Node-24-fähige Versionen gehoben (beseitigt die Node-20-Abkündigungswarnung).
- Die geplante **Offline-Reserve** (Issue #32) wurde bewusst wieder aus `main` herausgetrennt und
  liegt separat auf einem eigenen Branch – auf iPad noch nicht zuverlässig; wird später fortgesetzt.

## [2.2.0] – 2026-06-30

Großes Aufräum-, Verteilungs- und Härtungs-Release.

### Neu

- **Setup per Doppelklick** für andere Gemeinden: `deploy/setup.command` (macOS/Linux) und
  `deploy/setup.bat` (Windows) – prüfen Docker, fragen die ChurchTools-URL ab, erzeugen das
  Session-Secret und starten die App.
- **Update per Doppelklick:** neue Skripte `deploy/update.command` / `deploy/update.bat`
  (Daten bleiben erhalten).
- **Hilfeseite** `docs/betrieb/troubleshooting.md` mit Schritt-für-Schritt-Lösungen für die
  häufigsten Stolpersteine.
- **Update-Hinweis in der App:** Im „Mehr"-Tab erscheint dezent ein Hinweis, sobald eine neuere
  Version verfügbar ist – mit Link zu „Was ist neu". Quelle ist die neueste GitHub-Release-Note
  (serverseitig gecacht); jeder Release-Tag erzeugt nun automatisch ein GitHub Release.

### Geändert

- **Dokumentation & Repo-Struktur aufgeräumt:** Der Projekt-Root enthält nur noch das Nötigste
  (`README`, `INSTALL`, `UPDATE`, `CHANGELOG`, `LICENSE`, `CLAUDE.md`); die übrige Doku ist jetzt
  nach `docs/betrieb/`, `docs/entwicklung/` und `docs/archiv/` einsortiert.
- **Veraltete Doku-Inhalte korrigiert:** öffentliches Repo + MIT-Lizenz (statt „privat/proprietär"),
  White-Label als verworfen markiert, Doppelungen entfernt (Changelog und Backend-API jeweils nur noch
  an einer Stelle) und tote Verweise (gelöschte `WHITE-LABEL.md`) bereinigt.
- **Installation robuster:** Setup-Skripte unterscheiden „Docker nicht installiert" vs. „nicht
  gestartet", prüfen Compose v2 und halten das Fenster bei Fehlern offen; `INSTALL.md` erklärt den
  Doppelklick-Weg inkl. macOS-Gatekeeper- und Windows-SmartScreen-Hinweis.
- **Update-Strategie überarbeitet:** Releases tragen jetzt auch einen Major-Tag (`:2`); Gemeinde- und
  Prod-Instanz sind auf `:2` gepinnt (sichere Updates, kein ungewollter v3-Sprung). Das veraltete
  `containrrr/watchtower` wurde abgelöst – die Test-Instanz nutzt den gepflegten Fork
  `nickfedor/watchtower`, die Prod-Instanz aktualisiert bewusst (Hinweis künftig über das In-App-Banner).
- **Container-Healthcheck** im Docker-Image: Docker/Container-Manager erkennt jetzt, ob die App
  wirklich antwortet (prüft `/api/health`).
- **Automatische Tests für die ChurchTools-Anbindung** ergänzt (39 zusätzliche Server-Tests):
  Versions-Erkennung, Uhrzeit-Ausblenden, Zuständige, Zeitzonen-Umrechnung u. a. – fängt Fehler
  bei künftigen Änderungen früh ab, statt erst im Gottesdienst.

### Sicherheit

- **App läuft im Container jetzt als unprivilegierter Benutzer** (statt als root): zusätzliche
  Schutzschicht. Ein Entrypoint übereignet das Daten-Volume beim Start automatisch – auch
  bestehende Instanzen funktionieren ohne manuellen Eingriff weiter.
- **`SESSION_SECRET` ist in Produktion jetzt Pflicht** – kein unsicherer Fallback mehr (sonst wären
  die signierten Login-Cookies fälschbar). In der Entwicklung bleibt ein Komfort-Default.
- **Neues Flag `COOKIE_SECURE`** (Standard aus): Wer ausschließlich über HTTPS läuft (Reverse
  Proxy/Cloudflare), setzt es auf `true` und liefert das Login-Cookie dann nur noch über HTTPS aus.
  Im reinen LAN-HTTP-Betrieb bleibt es aus (unverändertes Verhalten).

## [2.1.7] – 2026-06-26

### Geändert

- **Bearbeiten-Hinweis** im Ablauf-Bearbeiten-Modus präzisiert: „Ziehen zum Sortieren · Eintrag antippen zum Bearbeiten" (vorher „Punkt …").

## [2.1.6] – 2026-06-26

### Neu

- **Neue Ablauf-Ansicht** in der Setlist (ersetzt die reine Lied-Liste): zeigt den kompletten Gottesdienst-Ablauf wie in ChurchTools – aufgeräumt mit Uhrzeit, Dauer je Punkt, Notizen und Zuständigen, auch Nicht-Lied-Positionen. Lieder darin sind antippbar und führen direkt zu den Charts.
- **Liederheft direkt aus der Terminübersicht:** Jede Termin-Karte hat (wenn Lieder vorhanden) rechts einen Noten-Button, der sofort die Lieder-Charts des Gottesdienstes öffnet – ohne Umweg über den Ablauf.
- **Uhrzeit pro Punkt ausblenden** (mit Bearbeiten-Recht): über das Bearbeiten-Fenster eines Punkts lässt sich die Uhrzeit aus-/einblenden (z. B. bei Soundcheck oder wenn mehrere Dinge gleichzeitig laufen) – **echt mit ChurchTools synchronisiert** (das „Auge"), in beide Richtungen. Der Punkt selbst bleibt mit Titel und Dauer erhalten.
- **Dauer pro Punkt bearbeiten** (mit Bearbeiten-Recht): über das Aktionsmenü eines Punkts die Dauer in Minuten setzen – schreibt nach ChurchTools, die Uhrzeiten verschieben sich automatisch.
- **Bemerkung bearbeiten** (mit Bearbeiten-Recht): Notiz/Beschreibung eines Eintrags im Bearbeiten- und Hinzufügen-Fenster setzen (wie „Bemerkung" in ChurchTools); wird im Ablauf angezeigt.

### Geändert

- **Einheitliche Dialoge:** Eintrag bearbeiten/hinzufügen sowie die Einstellungs-Dialoge (Organisation, Links verwalten) erscheinen jetzt als zentrierte Fenster mit allen Feldern auf einen Blick – statt der von unten einfahrenden Schublade. Konsistent und näher an ChurchTools.

### Behoben

- **Versionsanzeige im Mehr-Tab** zeigte fest „v2.0" statt der echten Version. Sie wird jetzt zur Build-Zeit aus dem Git-Tag gesetzt (`VITE_APP_VERSION`, vom CI als Build-Arg) und veraltet damit nicht mehr.

## [2.1.5] – 2026-06-26

### Neu

- **„Kaffee spendieren"-Bereich** im Mehr-Tab **und auf der Login-Seite**: dezente, freiwillige Unterstützung für den ehrenamtlichen Entwickler über PayPal mit vorgewählten Beträgen (1/3/5 €) und freier Eingabe. Bewusst zurückhaltend ganz unten platziert.

## [2.1.4] – 2026-06-26

### Geändert

- **Button „Punkt hinzufügen" → „Eintrag hinzufügen"** im Ablauf-Bearbeiten-Modus (passt besser, da auch Überschriften und Texte hinzugefügt werden).

## [2.1.3] – 2026-06-26

### Behoben

- **Unnötige Lücken bei breiten Akkorden:** Steht ein Akkord über einer kurzen Silbe (z. B. `E/G#`
  über „ler", `C#m` über „An"), wurde bisher immer mindestens die Akkordbreite freigehalten – auch
  wenn das nächste Wort gar keinen Akkord hat. Das erzeugte sichtbare Lücken („An␣␣␣den",
  „Ich␣␣␣glaube"). Jetzt darf ein breiter Akkord über die folgenden akkordlosen Wörter ragen (wie
  in Lead-Sheets üblich); Extra-Platz wird nur erzwungen, wenn direkt danach wieder ein Akkord
  käme – Akkorde überlappen also nie.
- **Einheitlich linksbündige Zeilen:** Zeilen, die im Quelltext nach dem ersten Akkord mit
  Leerzeichen beginnen (`[A]   Ich…`), starteten eingerückt, während andere bündig am Rand
  standen. Jetzt beginnt jede Zeile bündig am linken Rand. Mehrfach-Leerzeichen innerhalb der
  Zeile bleiben unberührt.

## [2.1.2] – 2026-06-26

### Behoben

- **Lücken in der „Akkorde & Text"-Ansicht:** Akkorde, die im Quelltext mit Leerzeichen vor dem
  Wort notiert sind („[C] wort"), landeten auf einem reinen Leerzeichen und wurden auf Akkordbreite
  aufgezogen – das erzeugte eine Lücke, über der der Akkord schwebte. Jetzt sitzt der Akkord bündig
  über dem zugehörigen Wort. Reine Instrumental-Akkorde ohne Text behalten ihren Abstand.
- **„Nur Text"-Ansicht sauber dargestellt:** Bisher wurden nur die Akkorde ausgeblendet, sodass
  Silbentrenner („Va - ter"), akkordbedingte Lücken und Einrückungen stehen blieben. Jetzt wird der
  reine Liedtext als ordentlicher, linksbündiger Fließtext gerendert – Silben werden zusammengeführt
  („Vater"), Mehrfach-Leerzeichen reduziert und Einrückungen entfernt. Die Akkord-Ansicht bleibt
  unverändert.

### Geändert

- **Zoom-Notausgang in die Kopfleiste:** Der Knopf „Zoom zurücksetzen" sitzt jetzt oben in der
  Menüleiste neben „Aa" (statt schwebend über dem Liedtext) und erscheint nur, wenn eine Seite
  reingezoomt ist. Neues Symbol (Lupe mit Rahmen-Ecken) passt zum übrigen Icon-Stil.
- **Seitenzahl nur bei mehrseitigen Liedern:** Die Anzeige unten rechts erscheint in der
  Strom-/Mehrseiten-Ansicht nur noch, wenn das aktuelle Lied mehr als eine Seite hat, und zählt
  lied-bezogen (z. B. „Seite 1 / 2"). Bei einseitigen Liedern entfällt sie – die Pfeile genügen.

## [2.1.1] – 2026-06-25

### Behoben

- **Festhängender Zoom in der Strom-/Mehrseiten-Ansicht (iPad):** Eine reingezoomte Seite konnte
  „kleben" bleiben – besonders, wenn ein gespeicherter Zoom beim Öffnen wiederhergestellt wurde
  (dann gab es keinen sichtbaren Ausweg). Neu erscheint ein Knopf **„Zoom zurücksetzen"**, sobald
  eine Seite vergrößert ist; ein Tipp setzt die Seite auf Normalgröße zurück **und** löscht ihren
  gespeicherten Zoom dauerhaft. Pinch-Zoom und das bewusste Speichern eines Ausschnitts bleiben
  unverändert.

## [2.1.0] – 2026-06-25

### Neu

- **Mehrere benannte Lied-Versionen:** Statt nur „Original/Bearbeitet" lassen sich pro Lied
  beliebig viele benannte Versionen anlegen (z. B. „Akustik", „Jugend"), umschalten, umbenennen
  und löschen. Versionen liegen im ChurchTools-Arrangement und sind für das ganze Team sichtbar.
  Tonart, Kapo, Spalten, Schrift, Abschnitts-Transponierung **und Anmerkungen gelten je Version**.
- **Persönliches Setup pro Konto (geräteübergreifend):** Anmerkungen (Stift/Text), Zoom sowie die
  Lied-Einstellungen werden jetzt am ChurchTools-Konto auf dem Server gespeichert und synchronisiert
  (vorher nur lokal pro Gerät). **Musikalische Einstellungen** (Tonart, Kapo, Abschnitte, gewählte
  Version, Nur-Text, Anzeige) gelten auf allen Geräten gleich. **Display-abhängige Einstellungen**
  (Spalten, Schrift, Zoom) werden **pro Gerätetyp** geteilt – Handy und „Tablet/Computer" getrennt,
  damit z. B. 2 Spalten vom iPad nicht auf dem Handy landen. Aktualisiert sich automatisch (alle
  30 s bzw. beim Zurückkehren zur App); vorhandene Geräte-Daten werden beim ersten Start übernommen.
- **Akkord-Ansicht als PDF (SongSelect-Look):** Jedes Lied wird aus dem ChordPro-Text als
  sauberes PDF erzeugt und angezeigt. Komplett **schwarz** (saubere S/W-Ausdrucke), deutliche
  Abschnitts-Labels (Vers/Refrain), Kopfzeile mit Tonart/Taktart/BPM und dem
  **ChurchTools-Musik-App-Logo oben rechts**. Lange Zeilen werden umbrochen, Abschnitte bleiben
  zusammen, 2-spaltiger Satz ohne Überlappung.
- **Zoom als Modus:** Pinch zum Zoomen, dann **✓ (Fertig) / ✗ (Zurück)** zum Festsetzen der
  Ansicht – danach funktionieren Wischen und Tippen wieder normal. Der Zoom wird **pro Lied-Seite
  dauerhaft gespeichert** (kein blauer Aktiv-Balken im Live-Betrieb).
- **2-Seiten-Querformat-Strom:** Im Querformat laufen zwei Seiten nebeneinander als ein Strom
  über den ganzen Ablauf; jede Seite ist ein eigener Bereich mit eigenem Zoom. Seiten auf leicht
  grauem Grund mit Mittelstreifen (Seitenränder beim Zeichnen sichtbar); eine einzelne Seite ist
  linksbündig, das letzte Lied steht nie allein (rechts, vorheriges links).
- **Volle Anmerkungen pro Lied-Seite:** Stift, Marker (glatter Leuchtstrich), Radierer (Farben
  Schwarz/Rot/Gelb), Textfelder sowie **Rückgängig/Wiederholen** – pro Version gespeichert.
- **Ablauf-Export als PDF** (Teilen-Symbol) – exportiert die Lieder genau wie angezeigt.

### Geändert

- **Viewer-Hintergrund** der Akkord-Ansicht jetzt leicht grau (statt weiß) + dezenter Seitenschatten,
  damit beim Zeichnen die Seitenränder klar erkennbar sind.
- **App-Logo** im PDF eng in die obere rechte Ecke gesetzt (eigene, zugeschnittene Logo-Variante
  ohne transparenten Rand; das App-Icon bleibt unverändert).
- **Auslieferung Test-Instanz:** Auto-Deploy über ein `:staging`-Image (GitHub-CI) + Watchtower auf
  dem NAS – kein manueller Container-Neubau mehr (siehe `deploy/docker-compose.staging.yml`).
- **Wartung:** Build-Werkzeug **Vite auf 8** angehoben (inkl. Vitest 3, `@vitejs/plugin-react`,
  `vite-plugin-pwa`). Behebt die zurückgestellten `npm audit`-Findings in `esbuild` (betrafen nur
  den lokalen Dev-Server, kein Produktivrisiko): von 7 Hinweisen (u. a. „high"/„critical") auf 1
  „low" (Windows-only Dev-Server). Build/Tests (44)/Lint grün. Keine Änderung am App-Verhalten.
- Basis-Image und CI auf **Node 22** (Vite 8 setzt Node ≥ 20.19 voraus).
- Vitest: deprecated `environmentMatchGlobs` entfernt – Komponenten-Tests setzen ihre
  jsdom-Umgebung per `// @vitest-environment`-Docblock.

### Behoben

- **Anmerkungen zuverlässiger:** kein Festhängen mehr (Pointer-Capture, nur Primär-Finger,
  Abbruch-Behandlung); über Textfeldern kann nun mit Stift/Marker gezeichnet werden.
- **Marker** zeichnet wieder einen glatten, gleichmäßigen Leuchtstrich (kein „Gepunktel" mehr).
- **Textfelder:** ließen sich nicht platzieren (Text-Ebene war 0×0) – behoben. Nach dem Eintippen
  ist der Text ausgewählt (Bearbeiten-/Verschieben-Rahmen); ein Klick ins Leere schließt nur das
  Eingabefeld bzw. hebt die Auswahl auf, statt ein neues Feld anzulegen oder den Text zu verschieben.
- **Auto-Auffrischung** überschreibt keine gerade gemachten Anmerkungen/Einstellungen mehr, bevor
  sie hochgeladen sind (Text bleibt stehen, „Alles löschen" wird nicht wieder zurückgeholt).
- **Letztes Lied** im 2-up-Querformat steht jetzt rechts (vorheriges links) statt allein links.
- **„Link hinzufügen"** stürzt nicht mehr ab, wenn die App über HTTP läuft (`crypto.randomUUID`
  nur im sicheren Kontext – Fallback ergänzt).
- Akkord-Seiten füllen im **Hoch- und Querformat** korrekt die Höhe (kein zu kleines Dokument).
- Rand-Tippen überspringt keine zweite Seite mehr; nach Rückkehr in die App stimmt die
  Querformat-Ansicht wieder.
- Liederliste: runder **Hinzufügen-Knopf** statt eckigem Kasten, einheitliche Zeilenhöhen;
  keine ungewollte vertikale Scroll-Bewegung der ganzen WebApp mehr.

## [2.0.1] – 2026-06-22

### Behoben

- **iOS-PWA-Layout (Homescreen/Standalone):** App füllt jetzt zuverlässig den vollen Bildschirm
  in **beiden** Ausrichtungen. Ursachen behoben:
  - `100dvh` aktualisierte sich beim Drehen nicht (Tab-Leiste rutschte im Querformat unter den
    Bildschirm) → App-Höhe wird jetzt aus `window.innerHeight` gesetzt (`--app-h`, mehrfach
    nachgesetzt bei `load`/`pageshow`/rAF) **plus** der unteren Safe-Area, die `innerHeight` im
    Standalone-Modus ausschließt (sonst dunkler Streifen unter der Leiste).
  - Detailansichten (Setlist/Chart) richteten ihr `position:absolute`-Layout am Layout-Viewport
    aus (ohne untere Safe-Area) → `#root` ist jetzt Bezugsrahmen, die Ansichten füllen die volle
    Höhe (kein leerer Balken / dunkler Streifen mehr).
  - Scrollbereiche bekommen unten Platz, damit der letzte Eintrag über den Home-Strich hinaus
    scrollbar ist.
- **Chord-Chart-Footer** springt nicht mehr zwischen 1- und 2-zeiligen „Nächstes Lied"-Titeln
  (feste Mindesthöhe, max. 2 Zeilen) und sitzt mit stabilem Abstand über dem Home-Strich.
- Tab-Leiste: Abstand der Symbole über dem Home-Strich vereinheitlicht und feinjustiert.

## [2.0.0] – 2026-06-19

Erster **öffentlicher** Release, für die Verteilung an andere Gemeinden
(jede Gemeinde betreibt ihre eigene, autarke Instanz desselben Codes).

### Geändert

- **ChurchTools-Look** als feste App-Optik (Tab-Navigation, neue Farb-/Schrift-Tokens,
  Light/Dark). Die frühere White-Label-Idee (Theming pro Gemeinde) ist verworfen.
- **Von ECG entkoppelt:** `CHURCHTOOLS_BASE_URL` ist Pflichtfeld ohne Default (die App
  startet nicht ohne eigene URL), Gemeindename-Default neutral, Titel generisch.
- Feature „bearbeitete Songversion" intern neutral benannt (vorher überall „ECG"); der
  Datei-Suffix heißt jetzt `— Bearbeitet.chordpro`. Alte `— ECG.chordpro`-Dateien werden
  weiterhin erkannt und beim nächsten Speichern automatisch übernommen.

### Hinzugefügt

- **Verteilung per fertigem Image:** automatischer Build bei jedem Versions-Tag
  (`v*`) → Multi-Arch-Image (amd64 **und** arm64) nach GHCR.
- End-User-Verteilpaket unter `deploy/` (image-basiertes `docker-compose.yml` + `.env.example`).
- **Frei konfigurierbare Links** (Mehr-Tab + optional Login-Seite), pro Instanz anpassbar.
- **Dokumentation:** `README.md`, `INSTALL.md`, `UPDATE.md` und interne Onboarding-Checkliste.
- **MIT-Lizenz** + Disclaimer (inoffizielles Community-Projekt, nicht mit der ChurchTools GmbH verbunden).

## [1.0.0] – 2026-06-18

- Internes/privates Release der App (Setlist aus ChurchTools, Auto-Transponierung,
  ChordPro-Editor, Dokumenten-Viewer, rechtebewusste UI). Produktiv für die ECG Donrath.
