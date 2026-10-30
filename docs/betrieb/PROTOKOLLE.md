# Protokolle – ChurchTools-Erweiterung

> **Stand: S5-2 (28.10.2026)** – Lesen und Schreiben. Die **Startseite** zeigt „Heute“, „Meine offenen To-Dos“, „Nächste
> Sitzungen“ und „Deine Gruppen“; der Reiter **„Sitzungen“** zeigt je Gruppe Kommend und Protokolle zum Lesen; die
> **Lupe** oben rechts sucht in allem (ohne Suchbegriff: alle Beschlüsse); Admins richten im Reiter **„Verwaltung“**
> Gruppen ein und pflegen die Vorlagen. Die **Leitung schreibt** Protokolle im Entwurf direkt im Editor, mit
> Aufgaben (= To-Dos), Beschlüssen, Terminen und festen Punkten, beginnen Protokolle zu Terminen und Treffen und legen
> die nächste Sitzung fest. Anwesenheit, Vorschläge, Freigabe und PDF folgen (Bauplan S5-3–S9 in
> `protokolle-planung/docs/bauplan.md`). Diese Anleitung wächst mit.

Die Protokolle sind für Gruppen wie den Leitungskreis: **Protokolle als Dokument** (wie Word, Loop oder Notion),
daraus gesammelt Beschlüsse, To-Dos und Termine. **Alles liegt in ChurchTools** – es gibt keinen eigenen Server,
keine Push-Mitteilungen und keine eigenen Mails.

## Installieren

1. Bei den [Releases](https://github.com/FAlwin/churchtools-gemeinde-apps/releases) die neueste Datei
   **`protokolle-v….zip`** herunterladen (nicht entpacken). Die Releases heißen „Protokolle v…“ – nicht verwechseln
   mit den Releases der Musik App, der Anmeldungen oder des Dienstplaners.
2. In ChurchTools: **Administration → Erweiterungen → Erweiterung hinzufügen**.
3. Ausfüllen:
   - **Name:** z. B. „Protokolle“ – so heißt der Menüpunkt.
   - **Kürzel:** genau **`protokolle`**. Die Erweiterung ist für diese Adresse gebaut (`/ccm/protokolle/`); mit einem
     anderen Kürzel lädt sie nicht.
   - **Im Menü anzeigen:** an.
   - **ZIP-Datei:** die heruntergeladene Datei.
4. **Speichern.**

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
- **Versteckte Gruppen** bleiben versteckt; ihre Mitglieder bekommen beim Einrichten zusätzlich „versteckte Gruppe
  sehen“. Ohne das sehen sie ihre eigene Gruppe in ChurchTools nicht (gemessen 22.10.2026).

**Vorlagen** (Reiter „Verwaltung“, Karte „Vorlagen“): gelten für alle Gruppen. Beim ersten Einrichten einer Gruppe
entstehen drei zum Anpassen (Leitungssitzung, Teamtreffen, Klausur). Je Vorlage: Name, Tagesordnungspunkte mit
vorbereitetem Text, feste Punkte („Offene To-Dos“, „Protokoll der letzten Sitzung“ – füllen sich selbst) und feste
Aufgaben, die bei jeder Sitzung mit dieser Vorlage angelegt werden. Lesen dürfen sie alle eingerichteten Gruppen,
ändern nur Admins.

**Startseite:** „Heute“ erscheint nur, wenn heute eine Sitzung ansteht. „Meine offenen To-Dos“ sind die mir
zugewiesenen, nicht erledigten aus allen Gruppen. „Nächste Sitzungen“ sind dieselben wie unter „Kommend“ im Reiter
„Sitzungen“ (Termine **mit Besprechungsanfrage**, Gruppentreffen, begonnene Protokolle), ab heute über alle Gruppen;
dahinter steht die eigene Antwort auf die Anfrage – wer nicht eingeladen ist, sieht keine. Ein Tipp öffnet die
Sitzung bzw. die Gruppe im Reiter „Sitzungen“.
„Alle anzeigen“ an „Meine offenen To-Dos“ öffnet den Reiter „To-Dos“.

**Reiter „To-Dos“ (S7-1):** alle To-Dos der eigenen Gruppen in einer Liste – **nach Status** (Überfällig · In Arbeit ·
Offen · Erledigt) oder **nach Person** (ich zuerst, dann nach Namen; „Außerhalb der Gruppe“, „Noch niemand
zuständig“), im Gerät gemerkt. Die **Leitung** sieht alle To-Dos ihrer Gruppen, **Mitglieder** ihre eigenen und die,
für die noch niemand zuständig ist. Die **Status-Marke** („◐ In Arbeit“) schaltet mit einem Tipp weiter – ohne ins
Protokoll zu springen, auch wenn es schon freigegeben ist. Der Filter blendet Gruppen und „Zuständig: Ich / Andere /
Noch niemand“ aus; Erledigte älter als 30 Tage zeigt der Schalter „Ältere erledigte zeigen“ am Ende der Liste. Ein
Tipp auf den Text öffnet das Protokoll, aus dem das To-Do stammt.

**Protokoll beginnen (Leitung, S5-1):** Eine Sitzung ohne Protokoll (Termin mit Besprechungsanfrage oder
Gruppentreffen) zeigt „Protokoll beginnen“. Im Fenster: eine Vorlage, „Wie letztes Mal“ (Tagesordnung des letzten
freigegebenen Protokolls) oder „Leer“. Danach öffnet sich der Editor; feste Aufgaben der Vorlage sind gleich To-Dos.
Hat jemand anderes inzwischen begonnen, öffnet sich dessen Protokoll. Ein Protokoll gehört zu genau einem Termin – bei
Serienterminen zu dem mit demselben Beginn.

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
als Entwurf ohne Termin. Termine mit Anmeldung ändert das Fenster nicht.
**Serien:** Einladungen gelten für die ganze Serie. Titel oder Zeit fragen „Nur diese Sitzung“ (wird aus der Serie
gelöst) oder „Ab dieser Sitzung“ (die Serie wird hier geteilt, frühere Termine bleiben; am ersten Termin ändert sich
die ganze Serie). Geteilt hat der neue Termin keine Einladungen – **alle bekommen „Neue Besprechungsanfrage“**.
Absagen: „Nur diese Sitzung“ und „Serie ab hier beenden“ ohne Mail, „Ganze Serie löschen“ mit Mail „Terminserie
gelöscht“ (auch vergangene Termine verschwinden aus dem Kalender; freigegebene Protokolle bleiben).

**Protokoll schreiben (Leitung, S4-1):** Ein Protokoll im Entwurf öffnet für alle, die in der Gruppe schreiben dürfen,
direkt im Editor – Mitglieder sehen es weiter nur zum Lesen. Gespeichert wird **automatisch** drei Sekunden nach der
letzten Eingabe; oben steht „gespeichert 19:42 Uhr“ oder „nicht gespeichert – wird erneut versucht“ (der Text bleibt
dabei im Editor). Mit der ersten Änderung entsteht eine **Schreibsperre**: Wer das Protokoll währenddessen öffnet,
sieht „Johann schreibt gerade“, liest den gespeicherten Stand mit (alle 30 Sekunden) und kann mit Rückfrage
**„Schreiben übernehmen“**. Das gilt auch für dieselbe Person in einem zweiten Fenster oder auf einem zweiten Gerät.
Eine Sperre ohne Lebenszeichen verfällt nach zehn Minuten. Aus Word eingefügte Listen bleiben Listen. Am Handy lässt
sich die Werkzeugleiste waagrecht wischen, am Rechner bricht sie um. Der Umschalter **„Schreiben | Lesen“** zeigt
dasselbe Protokoll als Lese-Ansicht – ohne Sperre; was noch nicht gespeichert war, wird beim Umschalten gespeichert.

**Aufgaben, Beschlüsse, Termine (S4-2):** über die Knöpfe der Werkzeugleiste, das „/“-Menü oder „[] “ + Leertaste
(Aufgabe). Eine Aufgabe mit Text ist beim nächsten Speichern ein **To-Do** – die Zuständigen sehen es sofort unter
„Meine offenen To-Dos“, auch solange das Protokoll Entwurf ist. An der Aufgabe: Status-Kreis (offen → in Arbeit →
erledigt), „Wer?“ (Mitglieder der Gruppe, dazu ein externer Name ohne eigenen Zugang) und „Bis“. Das Protokoll führt:
geänderter Text zieht ins To-Do mit; wird die Aufgabe gelöscht, wird das To-Do als gelöscht vermerkt (nie endgültig),
„Rückgängig“ holt es mit allen Angaben zurück. Ein Termin steht nur im Protokoll (kein Eintrag im Kalender).

**Feste Punkte (S4-3a):** „Offene To-Dos“ zeigt die offenen To-Dos der Gruppe aus früheren Sitzungen (überfällige
zuerst) mit Status-Kreis, Wer und Bis; darunter eingeklappt „Seit der Sitzung am … erledigt“. Im Editor hakt man sie
am Kreis ab, in der Lese-Ansicht ist es nur Anzeige. „Protokoll der letzten Sitzung“ zeigt das letzte **freigegebene**
Protokoll der Gruppe vor dieser Sitzung; „Öffnen“ zeigt es im Fenster. Beide füllen sich **bis zur Freigabe live**;
bei der Freigabe (S6) merkt sich das Protokoll, was sie zeigten. Einfügen über die Werkzeugleiste oder das „/“-Menü
(Gruppe „Feste Punkte“) – als Tagesordnungspunkt mit Titel, den man umbenennen kann.

**Punkte verschieben (S4-3b):** Eine Überschrift zieht am Griff ihren ganzen Abschnitt mit – alles bis zur nächsten
Überschrift gleicher oder höherer Stufe. Abgelegt wird nur an Abschnittsgrenzen: Lässt man mitten in einem anderen
Punkt los, rückt der Abschnitt an die nächste Grenze. Das Griff-Menü einer Überschrift hat „Nach oben“ und „Nach
unten“ (am Handy der Weg zum Umsortieren: auf die Überschrift tippen, dann auf den Griff). Andere Blöcke (Listen,
Aufgaben …) zieht man einzeln wie bisher.

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
das keine Rolle (sie hängen an den Kategorien), für die Anwesenheit später schon (gemessen 22.10.2026, S2-4).

## Für Entwickler

- Regeln (ohne Oberfläche, getestet): `shared/protokolle/` – Dokument und Ableitung (`dokument.ts`), Speicher mit
  Kopf und gepackten Teilen (`speicher.ts`), To-Dos (`aufgaben.ts`), Einrichten (`einrichten.ts`), Vorlagen
  (`vorlagen.ts`), Namen für die KI (`platzhalter.ts`), Meine Gruppen (`gruppen.ts`), Sitzungen (`sitzungen.ts`),
  Suche (`suche.ts`).
- Schreiben: `protokolle/src/schreiben.ts` (Sperre nehmen, speichern, übernehmen, freigeben – vorher frisch lesen,
  nachher nachlesen), `schreibSteuerung.ts` (wann gespeichert wird), Editor `DokumentEditor.tsx` + `editorSchema.ts`
  (BlockNote 0.56, fest gepinnt – Updates bewusst, die Schnittstellen ändern sich in 0.x noch), Word-Listen
  `wordListen.ts`. Der Editor wird erst beim Schreiben nachgeladen (eigene JS-/CSS-Datei im ZIP).
- To-Dos aus dem Protokoll: Regeln `aufgabenAbgleich` / `aufgabenIdsVergeben` (`shared/protokolle/aufgaben.ts`),
  Schreiben in „Mitarbeit“ `protokolle/src/aufgabenSchreiben.ts`; der Abgleich läuft in `speichern` nach der Sperr-Prüfung
  und vor dem ersten Schreiben am Protokoll. Die Blöcke `EditorBloecke.tsx` bekommen To-Dos und Mitglieder über
  `aufgabenKontext.ts`.
- Feste Punkte: Regel `shared/protokolle/festePunkte.ts` (`letztesProtokoll`, `offeneVonFrueher`,
  `festePunkteFesthalten` – die Freigabe in S6 muss es aufrufen, sonst bleiben die Punkte live), Baustein
  `FesterPunkt.tsx` für Editor und Lese-Ansicht, Kontext + Fenster `FestePunkteRahmen.tsx`. Festgehalten wird in
  `props.fest` des Verweis-Blocks; „wie letztes Mal“ und Vorlagen nehmen es nicht mit.
- Beginnen: Regel `shared/protokolle/beginnen.ts`, Zuordnung Kopf ↔ Termin/Treffen `gehoertZu` in
  `shared/protokolle/sitzungen.ts`, Schreiben `protokolle/src/beginnen.ts`, Fenster `ProtokollBeginnen.tsx`.
- Griff und Ziehen im Editor: Griff mittig zur ersten Textzeile (`protokolle/src/griffLage.ts`); beim Ziehen eines
  Abschnitts zeichnet BlockNote die Linie dort, wo er landet (`abschnittLinie` über `dropCursor.hooks.computeDropPosition`,
  dieselbe Rechnung `abschnittZiel` wie beim Ablegen).
- Wer/Bis vor dem Text: `props.vorab` am Aufgaben-Block (JSON), übernommen beim Anlegen des To-Dos (`vorabAnwenden` in
  `aufgabenAbgleich` und beim ersten Tipp); danach leert der Block es.
- Neues Protokoll (K2a): Fenster `ProtokollNeu.tsx` – schreibt über `protokollBeginnen` (Termin `null`), Treffen über
  `treffenAnlegen`; die Wahl des Anfangs ist `useAnfangWahl` (`AnfangWahl.tsx`, auch in „Protokoll beginnen“).
- Nächste Sitzung festlegen: Regel `shared/protokolle/planen.ts` (`vorbelegung`, `zeitraum`, `geplanterKopf`,
  `naechsteNach`), Schreiben `protokolle/src/planen.ts` (Termin → nachlesen → Treffen → Kopf; nach dem Termin nur
  noch Hinweise, nie zurückrollen; unklare Antwort → im Kalender nachsehen, Fehlerklasse `Unklar`), Fenster
  `SitzungFestlegen.tsx`, Kasten `NaechsteSitzung.tsx`. Gemessen: `protokolle-planung/docs/messung-s5-2-2026-10-28.md`.
- To-Do-Übersicht (S7): Regel `shared/protokolle/uebersicht.ts` (`sichtbarFuer`, `einteilen`, `langeErledigt`), Seite
  `protokolle/src/ToDos.tsx`, Marke `StatusMarke.tsx`; geschrieben wird über `aufgabeAendern`. Einteilung und Filter
  merkt `ui/bedienung/geraet.ts` im Gerät (vorher nur im Dienstplaner).
- Sitzung bearbeiten (K2b): Regel `shared/protokolle/bearbeiten.ts` (`aenderungVon`, `mailsVon`/`mailsSerie`,
  `terminRumpf` – ein Termin-`PUT` leert, was fehlt, darum geht der gelesene Termin vollständig zurück; Serien:
  `serienWeg`, `teilRumpf`, `ausnahmeRumpf`, `endeRumpf`, `verschoben`), Schreiben `protokolle/src/bearbeiten.ts`
  (Termin → Einladungen → Treffen → Köpfe; geteilt wird ohne Einladungsliste, dann einzeln eingeladen; ein schon
  herausgelöster Tag wird abgewiesen statt doppelt angelegt), Fenster `SitzungBearbeiten.tsx`, Felder
  `Planungsfelder.tsx`. Termin und Besprechungsanfragen liest `protokolle/src/termin.ts` (auch Liste und Festlegen);
  Protokolle mit Termin hinter den 180 Tagen der Liste liest `lesen.ts` gezielt nach (`termineJenseits`). Gemessen: `protokolle-planung/docs/messung-k2b-2026-10-29.md`, `messung-k2b2-2026-10-29.md`.
- Abschnitte: Regel `shared/protokolle/abschnitte.ts`, Anbindung `protokolle/src/abschnittZiehen.ts` (Loslassen hört
  das Blatt in der Einfangphase vor BlockNote ab; „Nach oben/unten“ im Griff-Menü von `DokumentEditor.tsx`). Der Griff
  sitzt ohne BlockNotes Überschriften-Versatz (`GRIFF_LAGE`).
- Erweiterung: `protokolle/` (`npm run dev -w protokolle`, dann `http://localhost:5192/ccm/protokolle/?demo`;
  weitere Fälle `?demo=leer`, `?demo=ohne-modul`, `?demo=fehler`, `?demo=gesperrt`).
- Release: Tag `protokolle-vX.Y.Z` (Workflow `protokolle-release.yml`, immer `make_latest: false`).
