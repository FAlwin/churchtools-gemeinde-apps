# Protokolle – ChurchTools-Erweiterung

> **Stand: S4-3a (26.10.2026)** – Lesen und Schreiben. Die **Startseite** zeigt „Heute“, „Meine offenen To-Dos“, „Nächste
> Sitzungen“ und „Deine Gruppen“; der Reiter **„Sitzungen“** zeigt je Gruppe Kommend und Protokolle zum Lesen; die
> **Lupe** oben rechts sucht in allem (ohne Suchbegriff: alle Beschlüsse); Admins richten im Reiter **„Verwaltung“**
> Gruppen ein und pflegen die Vorlagen. Die **Leitung schreibt** Protokolle im Entwurf direkt im Editor, mit
> Aufgaben (= To-Dos), Beschlüssen, Terminen und festen Punkten. Abschnitt ziehen, Sitzung anlegen, Freigabe und PDF
> folgen (Bauplan S4-3b–S9 in `protokolle-planung/docs/bauplan.md`). Diese Anleitung wächst mit.

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
- Erweiterung: `protokolle/` (`npm run dev -w protokolle`, dann `http://localhost:5192/ccm/protokolle/?demo`;
  weitere Fälle `?demo=leer`, `?demo=ohne-modul`, `?demo=fehler`, `?demo=gesperrt`).
- Release: Tag `protokolle-vX.Y.Z` (Workflow `protokolle-release.yml`, immer `make_latest: false`).
