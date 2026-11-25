# Website – ChurchTools-Erweiterung

> **Stand: W3b-4b-2 (25.11.2026) – noch kein Release.** Gebaut: Grundgerüst (Einrichten, Seitenliste, Vorschau, Seiten anlegen und
> löschen – W3a), **Aussehen** und **Einstellungen** (W3a-3), **Wer darf was** und **Freigabe** für Redakteure und Leitung (W3b-1/-2),
> **Mails im Freigabe-Weg** (W3b-3: Einreichen, Löschen anfragen, Zurückgeben, Freigeben), **Untergruppen einrichten** (W3b-4a: Kategorie
> und Rechte je Untergruppe, „Wer darf was“, Hinweis beim Start – Abschnitt „Untergruppen – Stand W3b-4a“), **Bereiche** (W3b-4b: Bereich
> je Seite, Untergruppen sehen nur ihre Seiten, Freigeben und Verschieben je Bereich – Abschnitt „Bereiche – Stand W3b-4b“) und
> der neue **Designer in der Vorschau** (W3c): Text direkt tippen, Bausteine und Abschnitte ziehen, Spaltenbreite und Abstand ziehen,
> Rückgängig/Wiederholen für die Seite – Abschnitte „Wer darf was“, „Freigabe“ und „Bearbeiten in der Vorschau“ unten. Noch **nicht**
> da: siehe „Was noch fehlt“. Das Bild der ganzen Website: Bauplan „Neue Website“
> (Second Brain, `ecg-donrath/website/bauplan-neue-website.md`).

Die Website einer Gemeinde wird in ChurchTools gepflegt – ohne Code. Die Erweiterung speichert Seiten, Menü und
Einstellungen im Speicher von ChurchTools; später baut ein Bau-Dienst daraus die fertigen Seiten für den Webspace. Es gibt
**keinen eigenen Server** in der Erweiterung. Die Vorschau erzeugt das HTML mit **demselben Code** (`shared/website/`), den
später der Bau-Dienst benutzt – so sieht die Vorschau aus wie die Website.

## Installieren

> **Vorher einmalig:** Erweiterungen muss der ChurchTools-Support für eure Instanz freischalten – siehe
> [Erweiterungen freischalten](ERWEITERUNG.md#erweiterungen-freischalten).

1. Das Paket bauen (`npm run build -w website && npm run paket -w website`, ergibt `website/releases/website-<Version>.zip`)
   oder – sobald es einen Release gibt – bei den [Releases](https://github.com/FAlwin/churchtools-gemeinde-apps/releases)
   die Datei **`website-v….zip`** herunterladen (nicht entpacken).
2. In ChurchTools: **Administration → Erweiterungen → Erweiterung hinzufügen**.
3. Ausfüllen:
   - **Name:** z. B. „Website“ – so heißt der Menüpunkt.
   - **Kürzel:** genau **`website`**. Die Erweiterung ist für diese Adresse gebaut (`/ccm/website/`); mit einem anderen
     Kürzel lädt sie nicht.
   - **Im Menü anzeigen:** an.
   - **ZIP-Datei:** die Datei aus Schritt 1.
4. **Speichern.**

**Aktualisieren:** beim Eintrag auf den Stift und die neue ZIP hochladen. ChurchTools speichert die Dateien einer Erweiterung
**7 Tage** im Browser zwischen; die Dateinamen tragen deshalb einen Fingerabdruck – unten auf der Seite steht die Version.

## Einrichten

Einmal, von einem **Admin** (Recht „Gruppen verwalten“, dazu bei der Erweiterung „Kategorien erstellen“):

1. In ChurchTools eine **Gruppe „Website“** anlegen (oder eine vorhandene wählen) – dort arbeitet das Website-Team. Wer dort
   eine Rolle mit Stufe „Redakteur“ oder „Leitung“ hat (Schritt 3), darf die Website bearbeiten.
2. Die Erweiterung öffnen. Sie zeigt „Website einrichten“ mit einer Auswahl der Gruppen (eine Gruppe namens „Website“ ist
   vorgewählt) und dem Knopf **Einrichten**.
3. **Einrichten** legt zwei Kategorien im Speicher der Erweiterung an – nacheinander, jede erst nach Nachsehen und danach
   nachgelesen:
   - **„Website: Entwürfe · <Gruppe>“** (Kürzel `entwuerfe-g<ID>`) – die Arbeitsfassung.
   - **„Website: Veröffentlicht · <Gruppe>“** (Kürzel `veroeffentlicht-g<ID>`) – die freigegebene Fassung; sie wird allein durch
     „Freigeben“ beschrieben (siehe „Freigabe“).

   Die **Gruppe steckt im Kürzel**: So erfährt die Erweiterung, welche Gruppe gewählt wurde, ohne etwas Zusätzliches zu
   speichern. Gibt es mehrere solcher Kategorien, gilt die mit der kleinsten Kategorie-ID.

4. Ist nur eine der beiden Kategorien da (ein früherer Versuch ist abgebrochen), ergänzt **Einrichten** die fehlende – die
   Gruppe steht dann fest.
5. **Rechte (W3b-1):** Wer in ChurchTools **„Personen administrieren“** hat, sieht vor dem Knopf **Einrichten** die Rollen der
   Gruppe mit einer Stufe je Rolle: **Kein Zugriff · Redakteur · Leitung** (vorbelegt: Rollen mit Leiter-Kennzeichen = Leitung, alle
   anderen = Redakteur; der Gruppentyp „Dienst“ hat Leiter, Co-Leiter, Mitarbeiter, Coach, Organisator). **Einrichten** legt die
   Kategorien an und **setzt danach die Rechte** – jeder Schritt nachgelesen. Scheitert das Setzen, stehen die Kategorien schon;
   „Erneut versuchen“ wiederholt beides gefahrlos. Wer das Recht nicht hat, richtet nur die Kategorien ein; die Rechte setzt später ein
   Admin mit diesem Recht (siehe „Wer darf was“).

## Wer darf was – Stand W3b-1

**Die Stufen** (je Rolle der Gruppe, vergibt ein Admin beim Einrichten und später unter Einstellungen → „Wer darf was“):

| Stufe                           | ChurchTools-Rechte der Rolle                                                                                                      | In der Oberfläche                                                                                           |
| ------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| **Kein Zugriff**                | nichts an den Kategorien der Website                                                                                              | Hinweis statt Editor                                                                                        |
| **Redakteur**                   | Modul sehen · **Entwürfe:** Kategorie sehen, Daten sehen/anlegen/ändern/löschen · **Veröffentlicht:** nur Kategorie + Daten sehen | Reiter „Seiten“ und „Freigaben“; **kein** Aussehen, **keine** Einstellungen, kein Menü, kein „Eigenes HTML“ |
| **Leitung**                     | wie Redakteur, dazu **Veröffentlicht** anlegen/ändern/löschen                                                                     | alles, auch Aussehen, Einstellungen, Menü, „Eigenes HTML“                                                   |
| **Admin** („Gruppen verwalten“) | unabhängig von der Rolle                                                                                                          | alles, dazu Einrichten                                                                                      |

**Online geht technisch nur, was eine Leitung in „Veröffentlicht“ schreibt** (der spätere Bau-Dienst liest nur diese Kategorie).
Redakteure lesen „Veröffentlicht“, damit die Oberfläche „online / geändert seit der Freigabe“ zeigen kann (gemessen W3b-0:
lesen `200`, schreiben `401`). Seit W3b-2 tut sie das (Abschnitt „Freigabe“).

**Wie die Oberfläche den Zugang bestimmt** (`shared/website/zugang.ts`, `website/src/start.ts`): aus den **eigenen Rechten** der
Person, `GET /permissions/global` → Block `website`. Wer in „Entwürfe“ **und** „Veröffentlicht“ schreiben darf (anlegen, ändern **und**
löschen – Speichern braucht alle drei), ist **Leitung**; nur in „Entwürfe“ = **Redakteur**; sonst hat sie keinen Zugang. Rechte an
fremden Kategorien zählen nicht. Die Gruppenrolle (Leiter-Kennzeichen) spielt dabei **keine** Rolle mehr; sie bestimmt nur die
Vorbelegung beim Einrichten und den Hinweis „Die Rechte für die Website sind noch nicht eingerichtet“, wenn jemand die Gruppe leitet,
aber keine Rechte hat. Auch das ist die Regel der Oberfläche; **den Schutz der Daten bilden die Rechte in ChurchTools**.

**„Wer darf was“ im Fenster „Einstellungen“** (nur sichtbar, wenn die Person „Personen administrieren“ hat):
`website/src/WerDarfWas.tsx` zeigt je aktiver Rolle die Stufe, **abgeleitet aus den Rechten in ChurchTools** (`stufeAus`) – die Stufe
wird nirgends zusätzlich gespeichert. Entspricht eine Rolle keiner Stufe genau (von Hand verändert, ein früherer Versuch ist
abgebrochen), steht dort „Weicht ab“; gewählt ist dann der Vorschlag der Rolle. **Rechte setzen** wirkt sofort (unabhängig vom
„Speichern“ der Einstellungen), richtet Soll gegen Ist aus (setzen, entziehen, ein Recht nachschieben, nachlesen) und meldet erst
nach dem Nachlesen „gesetzt“. **Entzogen wird nur, was auf die Kategorien der Website zeigt** (Entwürfe, Veröffentlicht und seit W3b-4a die Kategorien der
Untergruppen); Rechte an anderen Kategorien
oder Zusatzrechte bleiben. Berührt werden nur Rollen, die die Wahl nennt und die zur Gruppe gehören.

**Prüfung beim Start** (nur für diese Admins, `website/src/RechteHinweis.tsx`): Haben die Rollen keine Rechte an der Website oder
weicht eine von ihrer Stufe ab, steht oben ein ruhiger Hinweis mit dem Knopf „Wer darf was“. Lässt sich das nicht lesen, erscheint
kein Hinweis.

**Die Mechanik** (Rechte an Rollen lesen, Nummern aus `/permissions/definitions`, Soll gegen Ist, `nachschieben`, Nachlesen) steht in
`shared/ct/rollenRechte.ts` – gemeinsam mit den Protokollen (`shared/protokolle/einrichten.ts` hat nur noch deren Stufen und
Zusatzrechte). Die Website-Regeln (Stufen, Soll, Stufe aus Rechten, Hinweis) stehen in `shared/website/rechte.ts`, der Schreibteil in
`website/src/rechte.ts`. Bewusst getrennt bleibt `shared/ct/gruppenart.ts` (Rechte an **Gruppenart**-Rollen, `group_type_role`): Dort
wird nur ergänzt, nie entzogen; die Nummern-Suche (`modulRechtAus`) und der Schlüssel werden von dort benutzt.

„Eigenes HTML“ (wird unverändert auf die Website übernommen) und **Aussehen, Einstellungen, Menü** (eigenes CSS gilt für die ganze
Website) dürfen nur Leitung und Admin: `darfEigenesHtml` und `darfAussehenUndMenue` (`shared/website/zugang.ts`). Auch das ist die
Regel der Oberfläche, nicht der Schutz der Daten.

**Von Hand gesetzte Rechte (frühere Einrichtungen, z. B. die Test-Instanz):** Sie genügen weiter. Wer sie auf die neue Einrichtung
überführen will, öffnet „Wer darf was“, prüft die Stufen und drückt **Rechte setzen**. Stehen bei einer Rolle zusätzlich Rechte an
den beiden Kategorien, die zu keiner Stufe gehören, zeigt „Weicht ab“ das; „Rechte setzen“ entzieht sie.

## Untergruppen – Stand W3b-4a

**Was eine Untergruppe ist** (E-W28): jede **direkte** Untergruppe der Gruppe „Website“ in `GET /groups/hierarchies` – Kinder über `parents`
**und** `children` (die Auswertung des Organigramms: `elternAus`/`kinderVon` in `shared/organigramm/gruppen.ts`, für die Website
`untergruppenAus` in `shared/website/einrichten.ts`). **Enkel zählen nicht.** Eine neue Untergruppe erscheint unter „Wer darf was“ als
„noch nicht eingerichtet“; erst wenn der Admin dort ihre Stufen setzt, bekommt sie Kategorie und Rechte.

**Je Untergruppe eine Kategorie** `veroeffentlicht-g<Untergruppe>` („Website: Veröffentlicht · <Name der Untergruppe>“,
`untergruppenKategorie`) – **keine** eigene Entwürfe-Kategorie (E-W19: alle teilen sich „Entwürfe“). Eingerichtet heißt: diese Kategorie gibt
es (`untergruppenKategorienAus`). Eine schon angelegte (Test-Instanz: 117 aus der Messung W3b-4-0) wird wiederverwendet
(`kategorieSicherstellen`).

**Welche Website man sieht, bestimmt nur `entwuerfe-g<ID>`** (`einrichtungAus`): Neben `veroeffentlicht-g344` steht jetzt
`veroeffentlicht-g347`; eine Veröffentlicht-Kategorie wird deshalb **nie** als Website gewählt – auch nicht, wenn ihre ID kleiner ist. Wer nur
eine Veröffentlicht-Kategorie sieht, sieht keine Website (ein Admin richtet dann ein; vorhandene Kategorien werden wiederverwendet).

**Die Rechte** (`shared/website/rechte.ts`, eine Funktion `sollRechte` für alle – mit `unter` für die Rollen einer Untergruppe):

| Rollen der …      | Stufe     | Entwürfe  | Veröffentlicht der Website   | Veröffentlicht einer Untergruppe |
| ----------------- | --------- | --------- | ---------------------------- | -------------------------------- |
| Gruppe „Website“  | Redakteur | schreiben | lesen                        | **alle** lesen                   |
| Gruppe „Website“  | Leitung   | schreiben | schreiben                    | **alle** schreiben               |
| einer Untergruppe | Redakteur | schreiben | lesen (neu, Messung W3b-4-0) | nur die **eigene** lesen         |
| einer Untergruppe | Leitung   | schreiben | lesen                        | nur die **eigene** schreiben     |

Dazu jeweils „Modul sehen“. Eine Rolle einer Untergruppe schreibt **nie** in „Veröffentlicht“ der Website oder einer anderen Untergruppe.
**Uns gehören** (`verwaltetVon`, nur deren Daten-Rechte werden entzogen): Entwürfe, Veröffentlicht der Website und die Kategorien **aller**
eingerichteten Untergruppen. Die Untergruppen samt Kategorien werden bei jedem Lesen und Setzen **frisch** gelesen (`untergruppenLesen` in
`website/src/rechte.ts`) – darum gehören die Rechte der Website-Rollen an den Untergruppen immer zum Soll, und „Rechte setzen“ bei der Website
entzieht sie nicht. Eine Kategorie einer früheren Untergruppe (aus der Hierarchie gelöst) gehört nicht mehr dazu; ihre Rechte bleiben stehen.

**Einrichten einer Untergruppe** (`untergruppeRechteSetzen`, „Rechte setzen“ in ihrem Abschnitt – auch später zum Ändern der Stufen):

1. Ist sie noch direkte Untergruppe? (sonst `409`, nichts geschieht)
2. Kategorie sicherstellen (nachgelesen).
3. Rechte ihrer Rollen ausrichten (nachgelesen).
4. **Danach die Rollen der Website nachziehen** – mit ihren **heutigen** Stufen (`stufenZumNachziehen`: abgeleitet nur aus Entwürfe und
   Veröffentlicht der Website, nicht neu vorbelegt). Eine Rolle, die dort schon abweicht, bleibt unberührt (Hinweis „weicht ab“ bleibt).
5. Ihre Leitung festhalten (`website-leitung` mit `gruppe`).

Scheitert 3, ist die Untergruppe nicht eingerichtet („Noch nicht gesetzt – …“). Scheitert 4, sagt `WebsiteNichtNachgezogen`: „Die Untergruppe
„…“ ist eingerichtet. Die Rollen der Website haben ihre Rechte daran aber noch nicht bekommen …“; ein zweites „Rechte setzen“ holt es nach
(Soll gegen Ist ändert nur, was fehlt). Während ein Abschnitt setzt, warten die anderen.

**„Wer darf was“** (`website/src/WerDarfWas.tsx`): unter der Liste der Website je Untergruppe ein Abschnitt mit ihrem Namen (aus
`/groups/{id}`), dieselben Bausteine (`StufenBereich`, `RollenStufen`). **Hinweis beim Start** (`RechteHinweis.tsx`, `pruefeRechte`): auch für
jede nicht eingerichtete Untergruppe und jede, deren Rechte abweichen; eine eingerichtete Untergruppe, deren Rollen alle „Kein Zugriff“ haben,
ist eine Entscheidung und kein Hinweis. Lesefehler → kein Hinweis.

**`website-leitung` je Gruppe:** Der Wert der Website trägt **kein** `gruppe` (wie seit W3b-3 – abwärtskompatibel, die Mails der Website lesen
ihn unverändert); der Wert einer Untergruppe trägt `"gruppe": <ID>`. Die Rollen sind `group_role`-IDs der jeweiligen Gruppe. Gelesen wird
erst in W3b-4c (Mails je Bereich).

**Seit W3b-4b** sieht und bearbeitet eine Untergruppe nur ihre Seiten – nächster Abschnitt.

## Bereiche – Stand W3b-4b

**Bereich einer Seite:** Feld `bereich` an der Seite (`seiteSchema`, Gruppen-ID einer Untergruppe, steht am Ende des Seiten-Texts). **Fehlt
es, gehört die Seite der Gruppe „Website“** – alle Seiten von vor W3b-4b bleiben unverändert gültig. Ändern darf es nur die Leitung der Website
(**Seite einstellen → Bereich**: „Website“ und alle **eingerichteten** Untergruppen mit Namen; nicht eingerichtete stehen nicht zur Wahl;
„Website“ entfernt das Feld). Das Feld erscheint nur, wenn es eingerichtete Untergruppen gibt. Steht die Seite schon online, wandert die
veröffentlichte Fassung sofort mit (siehe „Bereich wechseln“ unten).

**Wer bin ich?** (`zugangFuer` in `shared/website/zugang.ts`, Ergebnis `{ sieht, leitet }` – je „alle“ oder eine Liste von Untergruppen):

| Wer                                                                   | sieht                       | gibt frei   |
| --------------------------------------------------------------------- | --------------------------- | ----------- |
| Admin; schreibt in Entwürfe **und** „Veröffentlicht“ der Website      | alle Seiten                 | alle Seiten |
| schreibt in Entwürfe und in die Kategorie einer/mehrerer Untergruppen | ihre + aus Mitgliedschaften | nur ihre    |
| schreibt nur in Entwürfe, Mitglied der Gruppe „Website“               | alle Seiten                 | –           |
| schreibt nur in Entwürfe, Mitglied eingerichteter Untergruppen        | Seiten dieser Untergruppen  | –           |
| schreibt nur in Entwürfe, in keiner dieser Gruppen                    | **keine** – Hinweis         | –           |

Den Bereich eines Redakteurs liefern die **eigenen Mitgliedschaften** (`/persons/{ich}/groups`, `group.domainIdentifier`, ausgewertet mit
`meineGruppen`); **die Website geht vor**. Wer in keiner Gruppe ist, sieht statt des Editors: „Du darfst an der Website mitarbeiten, bist
aber in keiner ihrer Gruppen eingetragen …“. Ist die Hierarchie oder sind die Mitgliedschaften nicht lesbar, zeigt der Start „Erneut
versuchen“ – es wird nie „kein Bereich“ geraten. Die Untergruppen beim Start: direkte Kinder (`/groups/hierarchies`), deren
`veroeffentlicht-g<ID>` man sieht; ihr Name kommt für die Leitung der Website frisch aus der Gruppe (wie in „Wer darf was“), sonst aus dem
Namen der Kategorie.

**Was jemand sieht und darf** (je eine Funktion in `zugang.ts`):

- **Seitenliste, „Im Menü“, „Freigaben“, Zähler:** nur Seiten der eigenen Bereiche (`sichtbareSeiten`, `freigabeListe`). Die **Vorschau**
  rendert mit allen Seiten, dem ganzen Menü und dem Aussehen – die Seite sieht aus wie online.
- **Aussehen, Einstellungen, Menü, eigenes HTML, „Startseite anlegen“, Bereich ändern:** nur Admin und Leitung der Website
  (`darfAussehenUndMenue`). Den Knopf „Startseite anlegen“ hatten bis W3b-4a auch Redakteure; jetzt lesen sie „Die Startseite legt die
  Leitung der Website an.“, Untergruppen sehen den Hinweis gar nicht.
- **Freigeben, direkt veröffentlichen, zurückgeben, „Löschen angefragt“ bestätigen, Seite löschen:** die Leitung der Website für alle Seiten,
  die Leitung einer Untergruppe nur für Seiten **ihres** Bereichs (`darfFreigeben(zugang, bereich)` – je Seite). Menü und Einstellungen stehen
  nur bei der Leitung der Website in „Freigaben“. Wer eine Untergruppe leitet und zugleich Mitglied der Website ist, sieht alle Seiten, ist für
  Website-Seiten aber Redakteur (einreichen).
- **Einreichen, Löschen anfragen:** Redakteure für die Seiten, die sie sehen (wie bisher).

**Neue Seite:** erbt den Bereich ihres Anlegers – wer alle Seiten sieht, legt für die Website an; wer nur über eine Untergruppe dabei ist, für
diese; wer in mehreren ist, wählt im Fenster „Neue Seite“ (`bereicheFuerNeueSeite`). **Adressen sind über alle Bereiche eindeutig** (E-W30):
„Neue Seite“ und die Prüfung vor dem Speichern bekommen **alle** Seiten, nicht nur die sichtbaren.

**Freigeben je Bereich** (`gibFrei` in `shared/website/freigabe.ts`): Menü und Einstellungen in die Kategorie der Website, eine Seite in die
Kategorie **ihres** Bereichs (`kategorieDesBereichs`). Ist ihr Bereich nicht eingerichtet (oder sieht man seine Kategorie nicht): „Die Seite
„…“ gehört zu einer Untergruppe, die noch nicht eingerichtet ist – es wurde nichts veröffentlicht …“, **nichts** geschrieben.

**Bereich wechseln (W3b-4b-2, E-W32):** Ändert die Leitung der Website in „Seite einstellen“ den Bereich einer Seite, die online steht, wird
**erst der Entwurf gespeichert und dann sofort die veröffentlichte Fassung verschoben** (`bereichWechseln` in `shared/website/freigabe.ts`,
ausgelöst von `Seitenarbeit` → `onBereichGewechselt`, nur nach einem gelungenen Speichern mit geändertem Bereich – nie beim Übernehmen eines
fremden Stands). Anlass: Bis dahin blieb die Seite online im alten Bereich; gab danach die Leitung der Untergruppe frei, landete sie in deren
Kategorie, die alte Kopie bei der Website durfte sie nicht löschen – die Seite stand **doppelt online**, und nur die Leitung der Website
hätte aufräumen können. Der Ablauf:

1. Alle Veröffentlicht-Kategorien **frisch** lesen (eine ohne Leserecht wird übersprungen; jeder andere Lesefehler bricht ab – „unbekannt“
   ist nie „nicht online“). Steht die Seite in keiner anderen als der des neuen Bereichs: nichts zu tun.
2. Die **Online-Fassung** nehmen (die Kopie im alten Bereich, sonst die jüngste), **nur `bereich` ändern** (`bereichSetzen` – dieselbe Regel
   wie der Entwurf, das Feld steht am Ende) und den Text sonst Zeichen für Zeichen lassen. **Nicht den Entwurf veröffentlichen** – der kann
   ungeprüfte Änderungen tragen. Nicht vollständig lesbar → nichts tun, Meldung.
3. Derselbe Ablauf wie beim Freigeben (`inBereichSchreiben`): neue Kategorie schreiben → nachlesen → **erst dann** aus allen anderen löschen.
   Der Status der Seite bleibt unberührt – freigegeben ist damit nichts.
4. Den Online-Stand neu lesen: Ist der Entwurf bis auf den Bereich gleich der Online-Fassung, steht danach „Online“.

**Fehler:** Scheitert Lesen oder Schreiben, bleibt online alles, wie es war; der Entwurf trägt den neuen Bereich (das Speichern gilt als
gelungen – eigene Meldung): „Der neue Bereich von „…“ ist gespeichert. Online steht die Seite aber vorerst noch im Bereich „…“ –
„Veröffentlichen“ verschiebt sie.“ Gelingt das Schreiben, aber das Löschen der alten nicht, steht die Seite in beiden – dieselbe Meldung wie
beim Freigeben (`bleibtHinweis`), und „Freigaben“ zeigt sie weiter als „Geändert“ (`verschieben`).

**Verschieben beim Freigeben:** Liegt eine Seite online noch in einer anderen Kategorie (das Verschieben beim Bereichswechsel scheiterte,
oder sie wurde vor W3b-4b-2 umgestellt), verschiebt sie das nächste Freigeben: in die neue Kategorie schreiben → nachlesen (Stand gleich) → **erst dann** aus jeder anderen Kategorie löschen, in der sie liegt
(`einheitLoeschen` liest selbst nach) → Status entfernen. Scheitert das Löschen der alten (z. B. die Leitung von Jugend darf in „Veröffentlicht“
der Website nicht schreiben), ist die Seite im neuen Bereich online, und die Meldung sagt: „„…“ steht zusätzlich noch online im Bereich
„Website“ – dort ließ sie sich gerade nicht entfernen …“. Das ist **kein** Fehler der Freigabe; unter „Freigaben“ bleibt die Seite als
„Geändert“ mit der Zeile „Steht online noch in einem anderen Bereich – Freigeben verschiebt sie“. Eine Kategorie ohne Leserecht wird
übersprungen.

**Regel für den Bau-Dienst (W5): eine Seite, mehrere Kopien.** Steht dieselbe Seiten-ID in mehreren Veröffentlicht-Kategorien (z. B. nach
einem halb gescheiterten Verschieben), gilt **nur die jüngste Kopie** (die Zeit im Kopf, `zeit`); die andere wird **nie ausgeliefert** und
als Warnung gemeldet. Das Feld `bereich` allein reicht zur Entscheidung nicht: Die alte Kopie bei der Website hat gar keins.

**Löschen und offline nehmen** (`seiteEntfernen`): aus **jeder** Veröffentlicht-Kategorie, in der die Seite steht, dann erst den Entwurf. Fehlt
das Recht in der Kategorie des **eigenen** Bereichs: „kein Recht“, nichts gelöscht. Fehlt es in einer **fremden** Kategorie, bleibt die Seite
dort; die Meldung nennt den Bereich, und die Leitung der Website sieht sie als „nur noch online“.

**Online-Vergleich je Bereich** (`onlineSicht`): gelesen werden alle Veröffentlicht-Kategorien, die man kennt (`ladeOnline` – eine ohne
Leserecht fehlt einfach, jeder andere Fehler heißt „Online-Stand unbekannt“). Der Stand einer Seite kommt aus der Kategorie ihres Bereichs;
liegt sie (auch) in einer anderen, gilt sie als „Geändert“ (`falsch`). Menü und Einstellungen kommen aus der Kategorie der Website.

**Mails (bis W3b-4c):** unverändert an die Leitung der Website-Gruppe. Ein Redakteur, der nur in einer Untergruppe ist, sieht deren
Mitglieder nicht (Messung W3b-4-0) – „niemand“, keine Mail, kein Hinweis. Die Leitung sieht die Seite trotzdem unter „Freigaben“ samt
Zähler. W3b-4c bringt die Mail an die Leitung der Untergruppe **und** der Website (E-W29).

**Demo:** `?demo=jugend-redakteur` (nur Jugend-Seiten, einreichen), `?demo=jugend-leitung` (Jugend-Seiten freigeben; „Freizeit 2027“
verschieben scheitert am Recht in der Website-Kategorie → Meldung), `?demo=bereiche` (Leitung der Website: Bereich-Feld, Verschieben gelingt; den Bereich einer online stehenden Seite wie „Impressum“ auf
„Website – Jugend“ stellen → sie wandert sofort mit, die Meldung sagt es).

## Freigabe – Stand W3b-2

**Der Weg einer Seite:** Ein Redakteur ändert sie in „Entwürfe“ und **reicht sie zur Prüfung ein**; die Leitung sieht sie im Reiter
**Freigaben**, schaut sich die Vorschau an und **gibt frei** – oder **gibt sie mit einer Anmerkung zurück**. Freigeben heißt: der Entwurf
wird **unverändert** nach „Veröffentlicht“ geschrieben. Die Leitung kann auch **direkt veröffentlichen** (Reiter „Seiten“, Menü „⋯“ →
„Veröffentlichen“). Die **Mails** in diesem Weg stehen im Abschnitt „Mails im Freigabe-Weg – Stand W3b-3“, die Untergruppen folgen mit W3b-4.

**Der Status** (`shared/website/status.ts`): je Seite ein **eigener Wert** `website-status` in „Entwürfe“ – wie die Sperre, damit das
Speichern der Seite und der Status nicht um denselben Wert streiten (der Kopf der Seite wird bei jedem Speichern neu geschrieben).
**Kein Wert = Entwurf.** Zustände: `eingereicht` · `zurueck` (mit Anmerkung, höchstens 1000 Zeichen, und wer eingereicht hatte) ·
`loeschenAngefragt`; jeweils mit **wer** (Person-ID + Name) und **wann**. Der Status wird vor dem Schreiben frisch gelesen und danach
**nachgelesen** – ein `201` ist kein Beleg. Ein Status, der auf eine nicht mehr vorhandene Seite zeigt, wird ignoriert (`websiteAusWerten`)
und beim nächsten Setzen eines Status aufgeräumt; beim Löschen einer Seite geht der Status mit. Das Lesen der Website meldet den
Status-Wert **nicht** als Problem.

**Der Online-Stand** (`shared/website/freigabe.ts`, `onlineVergleich`): Die Kategorie „Veröffentlicht“ wird wie „Entwürfe“ gelesen (alle
Rollen dürfen das), und je Einheit (Seite, Menü, Einstellungen) wird die **Prüfsumme** (`stand` im Kopf) verglichen – nicht die Zeit:
Wer eine Seite speichert, ohne etwas zu ändern, macht sie nicht „geändert“.

| Lage                          | Etikett     | Bedeutung                                              |
| ----------------------------- | ----------- | ------------------------------------------------------ |
| nie veröffentlicht            | Entwurf     | gibt es nur in „Entwürfe“                              |
| online, unverändert           | Online      | dieselbe Prüfsumme                                     |
| geändert seit der Freigabe    | Geändert    | online steht noch die frühere Fassung                  |
| online, aber Entwurf gelöscht | (Freigaben) | „Online, Entwurf gelöscht“ – Leitung nimmt sie offline |

Ein Status hat immer Vorrang vor dem Etikett der Lage („Eingereicht“, „Zurück“, „Löschen angefragt“). Ist „Veröffentlicht“ nicht
lesbar, zeigt die Oberfläche **nichts** an („nichts Falsches sagen“); Einreichen geht trotzdem.

**Redakteur** (Reiter „Seiten“): Etikett an der Seite; **„Zur Prüfung einreichen“** – nur, wenn sie vom Online-Stand abweicht oder nie
online war und nicht schon eingereicht ist; nach „zurück“ steht die **Anmerkung** der Leitung als Band an der Seite, und die Seite
lässt sich erneut einreichen. **Ändern nach dem Einreichen ist erlaubt** (E-W24): Der Status bleibt „eingereicht“, die Leitung sieht und
gibt immer den **neuesten** Entwurf frei. Einreichen geht nicht, solange an der Seite etwas nicht gespeichert ist. **Löschen:** Statt
„Seite löschen“ steht in „Seite einstellen“ **„Löschen anfragen“** (E-W23) – die Seite bleibt unverändert, der Menüeintrag auch; die Leitung
entscheidet. Redakteure löschen nie selbst; „Seite löschen“ (samt Menüeintrag entfernen) gibt es nur für Leitung und Admin.
Im Reiter **Freigaben** sieht ein Redakteur **nur seine eigenen** eingereichten, zurückgegebenen und zum Löschen angefragten Seiten
– zum Ansehen, ohne Knöpfe. Der **Zähler** am Reiter zählt seine zurückgegebenen Seiten.

**Leitung und Admin** (Reiter „Freigaben“, `website/src/Freigaben.tsx`): links alles, was vom Online-Stand abweicht, **gruppiert in
dieser Reihenfolge:** Eingereicht (die älteste Bitte oben) · Löschen angefragt · Zurückgegeben · Änderungen (eigene geänderte oder
neue Seiten – auch **nicht eingereichte Entwürfe**, die vielleicht noch nicht fertig sind) · Menü und Aussehen (Menü, Einstellungen) ·
Nur noch online. Rechts die **Vorschau** mit dem echten Renderer (Computer | Handy) und die Knöpfe:

- **Freigeben** (eingereicht) / **Veröffentlichen** (alles andere), **Mit Anmerkung zurück** (nur eingereichte; die Anmerkung ist Pflicht).
- **Löschen angefragt:** **Löschen und offline nehmen** (mit Rückfrage; erst das Menü ohne die Seite, dann aus „Veröffentlicht“
  entfernen, dann der Entwurf samt Status) oder **Ablehnen** (nur der Status geht, die Seite bleibt).
- **Online, aber Entwurf gelöscht:** **Offline nehmen** (mit Rückfrage).
- **Alles freigeben** (mit Rückfrage): nacheinander **die eingereichten Seiten, das Menü und die Einstellungen** – Seiten zuerst, damit das
  Menü nie auf eine Seite zeigt, die noch nicht online ist. **Nicht eingereichte Entwürfe gehören bewusst nicht dazu** (sie hat noch
  niemand zur Prüfung gegeben). Es **bricht beim ersten Fehler ab** und sagt, wie viele schon online sind und wie viele nicht mehr versucht wurden.
  Das Menü warnt vor dem Veröffentlichen, wenn es auf Seiten verweist, die noch nicht online sind.

Der **Zähler am Reiter** „Freigaben“: Leitung = eingereichte Seiten + „Löschen angefragt“; Redakteur = seine zurückgegebenen Seiten.
Er wird beim Öffnen, beim Wechsel des Reiters und nach jeder Handlung neu gelesen.

**Wie Freigeben schreibt** (`gibFrei`): (1) „Entwürfe“ frisch lesen, den **Text** der Einheit zusammensetzen (nicht lesbar → Abbruch);
(2) mit dem Schema prüfen – **Ungültiges geht nie nach „Veröffentlicht“**; (3) mit **demselben Anschluss wie das Speichern**
(`einheitSpeichern`: neue Teile → nachlesen → Kopf → nachlesen → alte Teile weg) nach „Veröffentlicht“ schreiben; (4) „Veröffentlicht“
**nachlesen: derselbe `stand`, vollständig lesbar?** – sonst Fehler, nichts gilt als online; (5) **erst dann** den Status entfernen, und nur,
wenn der Entwurf sich inzwischen **nicht weitergeändert** hat (sonst bleibt „eingereicht“ und die Meldung sagt es – E-W24). Kann der Status
nach erfolgreicher Freigabe nicht entfernt werden, ist die Seite trotzdem online; die Meldung sagt, dass er geblieben ist, ein neuer
Versuch räumt auf.

**Fehlerzweige:** Netz, 5xx, Bremse → Fehler; **nichts wird als „online“ gemeldet, der Status bleibt**, ein neuer Versuch ist möglich.
`401`/`403` beim Schreiben (oder Lesen) von „Veröffentlicht“ → die klare Meldung „Dafür fehlt dir das Recht …“ (nicht „abgemeldet“).
Bricht eine Freigabe mitten im Schreiben ab (Teile geschrieben, Kopf nicht), **bleibt der alte Online-Stand gültig** (Schreibreihenfolge
des Speichers); der nächste Versuch nutzt oder räumt die liegengebliebenen Teile.

**Der Rahmen** (`website/src/App.tsx`) liest „Entwürfe“ und „Veröffentlicht“ zusammen für Liste und Zähler (`ladeFreigaben`) – beim
Öffnen, beim Wechsel des Reiters und nach jeder Handlung; die bisherigen Daten bleiben stehen, bis neue da sind.

**Offen / bewusst noch nicht:** Untergruppen und „Seite einem Bereich zuordnen“ (W3b-4: die Regel
`freigabeListe` und `darfFreigeben` sind die Stellen, an denen der Bereich ergänzt wird). Nimmt die Leitung eine Seite offline, bleibt der
**veröffentlichte Menüpunkt** bestehen, bis das Menü unter „Freigaben“ veröffentlicht wird (der Entwurf des Menüs ist schon ohne die Seite).

## Mails im Freigabe-Weg – Stand W3b-3

**Wer bekommt wann eine Mail?** (Bauplan E-W20, Alwins Entscheidung 23.11.2026)

| Was geschieht                                 | Mail an                                                                                |
| --------------------------------------------- | -------------------------------------------------------------------------------------- |
| Redakteur **reicht eine Seite ein**           | die **Leitung** der Website-Gruppe                                                     |
| Redakteur **fragt das Löschen an**            | die **Leitung**                                                                        |
| Leitung **gibt mit Anmerkung zurück**         | die Person, die **eingereicht** hatte (steht im Status) – die Mail nennt die Anmerkung |
| Leitung **gibt eine eingereichte Seite frei** | die Person, die **eingereicht** hatte („ist jetzt freigegeben“)                        |

- **Bei „Alles freigeben“ eine Mail je Person**, die alle ihre jetzt freigegebenen Seiten nennt – nicht eine je Seite.
- **Nie an sich selbst:** Wer handelt, wird aus den Empfängern genommen (die Leitung, die selbst eingereicht hat und selbst freigibt,
  bekommt nichts). Bleibt niemand übrig, gibt es **keine Mail und keinen Fehler**. Freigeben ohne Einreichenden (eine Änderung, die nie
  eingereicht war) und „Veröffentlichen“ von Menü und Einstellungen schicken nichts.
- **Der Text ist kurz mit Link:** Betreff z. B. `Website: „Jugendabend“ wartet auf Freigabe` / `… zurückgegeben` / `… ist freigegeben` /
  `… – Löschen angefragt`; im Text wer, welche Seite, beim Zurückgeben die Anmerkung, dazu ein Link auf die Erweiterung
  (`erweiterungsLink`, `ui/erweiterung/kuerzel.ts`). **Der Reiter „Freigaben“ hat keine eigene Adresse** (Reiter sind ein Zustand der
  Seite, nicht der Adresse) – der Link führt auf die Startseite der Erweiterung, der Text sagt, wo man den Reiter findet. Seitentitel,
  Namen und Anmerkung gehen durch `htmlText` (`shared/website/html.ts`); der Betreff ist reiner, einzeiliger Text.
- **Die Regeln stehen rein in `shared/website/mail.ts`** (Empfänger, Bündeln, Texte – getestet in `mail.test.ts`), das **Senden** in
  `website/src/mailVersand.ts`, der **Versand selbst** im gemeinsamen Baustein `ui/ct/mailSenden.ts` (derselbe wie im Anmelde-Tool:
  `sendEMailToPersonIds`, danach im ChurchTools-Protokoll nachgelesen).

**Wer ist „Leitung“?** Die Stufe je Rolle steht nur in den ChurchTools-Rechten, die nur ein Admin lesen kann – ein Redakteur, der
einreicht, könnte also nicht wissen, wen er benachrichtigt. Darum gibt es den **eigenen Wert `website-leitung`** in „Entwürfe“
(`shared/website/mailWerte.ts`): die Rollen-IDs mit Stufe Leitung. **Einziger Schreiber ist der Admin, wo er die Stufen festlegt**
(Einrichten und „Wer darf was“ – beide über `rechteSetzen` in `website/src/rechte.ts`), **nach** dem erfolgreichen Setzen und Nachlesen
der Rechte. Fehlt der Wert (bestehende Installationen), gilt dieselbe **Vorbelegung** wie in „Wer darf was“ (`vorschlag` in
`shared/website/rechte.ts`: Rollen mit Leiter-Kennzeichen). Ein leerer Wert ist eine echte Aussage („niemand“) und wird nicht durch die
Vorbelegung ersetzt. Empfänger sind die aktiven Mitglieder der Website-Gruppe mit einer dieser Rollen (Mitglieder samt Rollen der
eigenen Gruppe sind auch für Redakteure lesbar – gemessen W3b-0). Gelingt das Setzen der Rechte, aber nicht das Festhalten, sagt die
Meldung das („Die Rechte sind gesetzt. …“); ein zweites „Rechte setzen“ holt es nach. **W3b-4 (Untergruppen):** Seit W3b-4a gibt es den Wert
je Gruppe (der Wert der Website bleibt ohne `gruppe`); mit W3b-4c kommt die Leitung des Bereichs der Seite dazu – an der Stelle
`leitungEmpfaenger`.

**Der Schalter** „Mails im Freigabe-Weg“ steht im Fenster **Einstellungen** (nur Leitung und Admin, E-W22), als Haken, und **wirkt
sofort**: eigener Wert `website-mail` in „Entwürfe“, **nicht** in der Einheit „Einstellungen“ (die geht erst über „Freigeben“ online).
**Kein Wert = an.** Er hat einen eigenen Speicher-Weg und eine eigene Meldung: Ein Fehler beim Schalter meldet die Einstellungen nie als
gescheitert und umgekehrt. Ist er aus, gibt es gar keinen Mail-Aufruf und keinen Hinweis.

**Ablauf und Hinweis:** Die Mail geht **erst, nachdem der Status geschrieben bzw. die Seite freigegeben und nachgelesen ist**. Scheitert
die Handlung, geht keine Mail. **Scheitert die Mail, gilt die Handlung trotzdem** – ein kurzer Hinweis unter der Werkzeugleiste bzw. in
der Meldung des Reiters „Freigaben“ nennt drei Ausgänge:

- **gesendet** – „Die Leitung ist per Mail benachrichtigt.“ (bzw. „Wer eingereicht hatte, …“);
- **nicht verschickt** (abgelehnt, kein Recht, gebremst, oder schon das Vorbereiten ist gescheitert) – mit Grund, und dass die Handlung
  trotzdem gilt;
- **unklar** (ChurchTools antwortet nicht, im Protokoll steht nichts) – „Ob die Mail … rausging, ist unklar. Bitte nicht noch einmal
  einreichen – die Leitung sieht die Seite auch im Reiter „Freigaben“.“ **Nichts wird automatisch wiederholt** (doppelte Mails).

**Rollen-Nummern (gemessen 23.11.2026):** Der Wert hält die `group_role`-IDs (z. B. 3290, daran hängen die Rechte), die Mitglieder
tragen die Rolle der Gruppenart (`groupTypeRoleId`, z. B. 16). `leitungsTypen` (`shared/website/mail.ts`) übersetzt über
`GET /groups/{id}/roles`, das beides je Zeile liefert. Die Mitgliederliste liefert **keine** Mail-Adressen (auch nicht dem Admin).
Weiß die Erweiterung die Adresse der Empfänger nicht (das ist der Normalfall), kann das Protokoll nicht nach der
Adresse durchsucht werden; dann bleibt „gesendet“ ohne Beleg (und bei fehlender Antwort „unklar“). **Das Mitlesen im Protokoll braucht
ein Recht, das nicht jeder hat** – ohne es gilt ebenfalls „gesendet, nicht belegt“.

## Wie die Daten im Speicher liegen

Alle Seiten, das Menü und die Einstellungen liegen in der Kategorie „Entwürfe“. **Ein Wert fasst höchstens 10.000 Zeichen**
(gemessen W0, 19.11.2026; Zeichen, nicht Bytes). Deshalb besteht jede **Einheit** (eine Seite, das Menü, die Einstellungen)
aus einem **Kopf** und **Teilen**:

- **Kopf** (`website-kopf`): Art der Einheit (`seite`, `menue`, `einstellungen`), ihre Kennung (bei Seiten die Seiten-ID, sonst
  fest `menue` / `einstellungen`), der **Stand** (Prüfsumme des Inhalts) und die Zeit der letzten Speicherung.
- **Teile** (`website-teil`): der Inhalt – der Text aus `shared/website/modell.ts` mit der Kennung `website:v1:` –, gepackt
  (deflate + Base64url) und in Stücke von höchstens 9.500 Zeichen geschnitten. Jeder Teil trägt Einheit, Kennung und denselben
  Stand wie der Kopf. Die Aufteilung ist dieselbe wie bei den Protokollen (`shared/ct/teile.ts`).

**Lesen:** die **ganze Kategorie mit einem Aufruf** (gemessen: 156 Werte in 81 ms, kein Blättern), daraus setzt die Erweiterung
alles zusammen. Zu einem Kopf gehören nur die Teile mit **seinem Stand** – ein halb abgebrochenes Speichern ist so nie sichtbar.
Was nicht passt (fremder oder beschädigter Wert, Teile fehlen, ein zweiter Kopf, ungültiger Inhalt, neuere Formatversion),
steht oben in der Seitenliste als Hinweis **„Mit manchen Daten stimmt etwas nicht“** – es wird **gemeldet, nie still verworfen
und nie gelöscht**.

**Schreiben** (Reihenfolge wie bei den Protokollen): neue Teile → nachlesen → Kopf umstellen → nachlesen → alte Teile löschen.
Bricht es unterwegs ab, zeigt der Kopf weiter auf einen vollständigen Stand; nur das Aufräumen darf scheitern (das nächste
Speichern räumt mit auf). Ein „201 Erstellt“ gilt nicht als Beleg: Jeder Schritt wird nachgelesen, sonst wirft die Erweiterung
einen Fehler.

**Vorübergehend ist nicht ungültig:** Ein Fehler beim Lesen (Netz, 502/503/504) zeigt „Erneut versuchen“ und verändert nichts;
ein Fehler beim Speichern lässt den bisherigen Stand unberührt, und das Fenster bleibt mit der Eingabe offen.

**Löschen einer Seite:** erst das Menü ohne ihren Eintrag speichern (falls sie im Menü steht), dann der Kopf der Seite, dann
ihre Teile. Bleiben Teile liegen, sind sie unschädlich („verwaist“).

**Gleichzeitiges Bearbeiten – die Sperre (W3a-2):** Der Speicher von ChurchTools kennt keine Versionen; speichern zwei Personen
dieselbe Seite gleichzeitig, gewinnt die spätere. Deshalb gilt je Seite: **eine Person bearbeitet, alle anderen sehen zu.**

- Die Regel (`sperreLage`, zehn Minuten ohne Lebenszeichen = verlassen, dieselbe Person in zwei Fenstern sperrt sich selbst) ist
  die der Protokolle und steht in `shared/ct/sperre.ts`.
- **Wo sie liegt:** als eigener Wert je Seite (`website-sperre`, `shared/website/sperre.ts`) in der Kategorie „Entwürfe“ – nicht
  im Kopf der Seite wie bei den Protokollen. Der Kopf wird bei **jedem Speichern** neu geschrieben; ein Lebenszeichen, das im
  selben Wert läge, würde mit diesem Schreiben um den Wert streiten (das spätere gewinnt, das andere ist still weg). Der eigene
  Wert hat genau einen Schreiber. Freigegeben wird, indem `sperre` auf `null` gesetzt wird; wird eine Seite gelöscht, geht ihr
  Sperr-Wert mit. Das Lesen der Website kennt die Werte und meldet sie nicht als Problem.
- **Genommen** wird die Sperre beim ersten Handgriff (nicht schon beim Ansehen), **erneuert** jede Minute und unmittelbar vor
  **jedem** Speichern, **freigegeben** beim Verlassen der Seite (so gut es geht – sonst verfällt sie nach zehn Minuten).
  Immer erst frisch lesen und prüfen, danach nachlesen (zwei fast gleichzeitige Nehmer: wessen Wert nachher dasteht, gewinnt).
- **Fremd gesperrt:** Hinweis „Gerade bearbeitet von <Name>“, nur ansehen (keine Bearbeiten-Ebene, „Seite einstellen“ gesperrt),
  „Erneut prüfen“.
- **Hat jemand die Seite inzwischen geändert** (etwa weil die eigene Sperre verfallen war), wird **nicht darüber geschrieben**:
  Der Hinweis bietet „Neu laden“ an (die eigenen, nicht gespeicherten Änderungen gehen dann bewusst verloren).
- Nicht gesperrt ist das **Menü**: Die Reihenfolge ändert man in „Seite einstellen“, gespeichert wird es zusammen mit der Seite;
  zwei Personen, die zugleich das Menü ändern (an verschiedenen Seiten), könnten sich überschreiben – die Menü-Sperre kommt,
  wenn das in der Praxis vorkommt.

**Zwei weitere eigene Werte (W3b-3):** `website-leitung` (welche Rollen die Leitung sind) und `website-mail` (der Schalter für die Mails) –
je ein Wert in „Entwürfe“, je ein Schreiber, vorher frisch lesen, nachher nachlesen (`shared/website/mailWerte.ts`). Beschädigt gilt
wie fehlend und wird – wie ein beschädigter Status – gemeldet, nie gelöscht. Das Lesen der Website überspringt beide (wie Status und
Sperre); siehe „Mails im Freigabe-Weg“.

**Der eine Anschluss:** Alles, was die Erweiterung vom Speicher von ChurchTools braucht, steht in
`shared/website/speicher.ts` (und dort über `shared/ct/modulDaten.ts`). Ändert ChurchTools die Ablage (Dev-Plattform, Bauplan
§5), ist es genau diese Datei.

## Die Oberfläche

- **Reiter:** Seiten | Aussehen | Freigaben (am Computer oben, am Handy unten), „Freigaben“ mit Zähler (siehe „Freigabe“).
  **Redakteure** sehen nur Seiten und Freigaben (kein Aussehen, kein Reiter „Einstellungen“).
- **Seiten:** links die Liste („Im Menü“ in der Reihenfolge des Menüs, „Weitere Seiten“; die Startseite ist markiert), rechts
  die **Vorschau** mit dem Umschalter **Computer | Handy** (390 px).
- **Neue Seite** (grüner Knopf unter der Seitenliste, am Handy das runde grüne Plus unten rechts): Titel eingeben; der Pfad (die Adresse) entsteht daraus (Umlaute ausgeschrieben, bei Streit `-2`). Die Seite
  ist leer.
- **Seite löschen:** steht im Fenster „Seite einstellen“ (nur Leitung und Admin); mit Rückfrage, steht sie im Menü, wird der Menüpunkt mit
  entfernt. Eine Seite, die schon online steht, bleibt dort, bis sie unter „Freigaben“ offline genommen wird. **Redakteure** sehen dort
  „Löschen anfragen“ (siehe „Freigabe“).
- **Startseite anlegen:** Hat die Website keine Startseite, steht ein Hinweis mit dem Knopf „Startseite anlegen“ (Vorlage
  `start-schriftzug`). Angelegt wird **nie von selbst**.
- Demo ohne ChurchTools (nur beim Entwickeln): `npm run dev -w website`, dann `…/ccm/website/?demo` (Fälle: siehe
  `website/src/demo.ts`; u. a. `?demo=seiten` zum Durchspielen des Bearbeitens, `?demo=gesperrt` – jemand anderes bearbeitet die
  Startseite –, `?demo=wackelt` – das erste Speichern scheitert vorübergehend; Rollen seit W3b-1: `?demo=redakteur` (mit einer zurückgegebenen Seite), `?demo=leitung` (mit zwei eingereichten Seiten und einer
  Löschen-Anfrage, Zähler 3),
  `?demo=leitung-ohne-rechte`, `?demo=rechte-leer`, `?demo=rechte-abweicht` – die Admin-Ansicht zeigt `?demo=seiten`). Im Demo-Modus geht **keine** Anfrage ins Netz:
  `fetch` wird ersetzt, was unbekannt ist, bekommt 404 und eine Warnung (`website/src/demo.test.ts`).

### Bearbeiten in der Vorschau (W3a-2, neu gestaltet in W3c-1)

Die Vorschau ist zugleich die Arbeitsfläche. **Am Computer** (W3c-1) liegt alles Bedienbare in **einer Schicht über der Seite**
und erscheint nur, wo die Maus ist – nie über Text und nie übereinander:

- **Abschnitt-Leiste** auf der Oberkante des Abschnitts (rechts am Inhaltsrand): Griff · Gestalten · kopieren · löschen. Der **Griff**
  verschiebt den Abschnitt durch **Ziehen** (siehe „Ziehen“), mit den **Pfeiltasten hoch/runter** am fokussierten Griff eine Stelle weiter.
  (Die Knöpfe „nach oben/unten“ gibt es am Computer nicht mehr; am **Handy** bleiben sie, dort gibt es kein Ziehen.)
- **Baustein-Leiste** (nur eine, hell): der **Griff** verschiebt den Baustein, der **Stift** öffnet das bisherige Fenster des Bausteins. Für
  „Eigenes HTML“ gibt es die Leiste – und damit den Griff – nur für die Leitung. Text-Bausteine tippt man direkt (siehe unten);
  alle anderen öffnen mit einem Klick auf den Baustein das Fenster.
- **Abstand-Pille** unten mittig („Abstand oben & unten: Normal“): **senkrecht ziehen** rastet auf Kein · Klein · Normal · Groß ein (siehe „Maße ziehen“),
  ein **Klick** ohne Ziehen öffnet das Fenster „Gestalten“.
- **Spalten-Griff** mittig in der Lücke zwischen zwei Spalten (nur am Abschnitt unter der Maus, nur wenn die Spalten nebeneinander stehen): siehe „Maße ziehen“.
- **Abschnitt einfügen** an der Grenze zwischen zwei Abschnitten (und auf einer leeren Seite), **+** in einer Lücke zwischen Bausteinen und
  **Baustein hinzufügen** in einer leeren Spalte öffnen das bisherige Hinzufügen.
- **Ziehen (W3c-2).** Den Griff greifen und ziehen (erst ab 4 px, sonst ist es ein Klick). Eine **Einfügelinie** zeigt die Stelle, vor der
  etwas landet; ein **Geist** neben dem Zeiger nennt „Typ: Anfang des Texts“; beim Baustein ist die **Zielspalte gestrichelt** markiert (auch
  eine leere Spalte ist ein Ziel), die Quelle ist abgeblendet. Am oberen und unteren Rand scrollt die Seite von selbst. **Esc** bricht ab
  (der Griff nimmt dazu den Fokus ins `iframe`). Beim Loslassen geht **eine** Nachricht `verschieben` raus. Die Rechnung dahinter steht
  an **einer** Stelle, `shared/website/bearbeiten.ts`: `abschnittVerschiebenNach(seite, von, nach)` und `bausteinVerschieben(seite, von, nach)`
  (`von` = wo er steht, `nach` = eine **Stelle** vor dem Herausnehmen gezählt: 0 … Anzahl; Baustein: `{ i, j, k }`, `k` = vor welchem Baustein der
  Zielspalte, bei einer leeren Spalte 0). Die Stelle direkt über und unter dem Element lässt es, wo es ist; ungültige Stellen ändern nichts.
  `abschnittVerschieben(hoch/runter)` rechnet darüber (`nach = i − 1` / `i + 2`). Nach dem Verschieben zeichnet die Vorschau neu – der Fokus am
  Griff geht dabei verloren; für die nächste Pfeiltaste muss man den Griff neu fokussieren.
- **Maße ziehen (W3c-3).** _Spaltenbreite:_ Der Griff rastet **nur** auf Aufteilungen mit **derselben Spaltenzahl** ein – die Liste `AUFTEILUNGEN`, gruppiert
  nach `spaltenAnzahl` (heute bei zwei Spalten `1-1`, `2-1`, `1-2`; bei drei und vier Spalten gibt es je nur eine, dort ist der Griff **gedämpft**, ohne Ziehen, mit
  kurzem Hinweis „nur eine Aufteilung – die Spaltenzahl änderst du über Gestalten“). Die **Anteile stehen im Namen** (`2-1` → 2/3 : 1/3); es gibt keine zweite Liste.
  Beim Ziehen zeigen **gestrichelte Rastlinien** die Aufteilungen (die gewählte durchgezogen), ein **Chip** „Aufteilung 2 : 1“ folgt dem Zeiger, die Spalten folgen live
  (`grid-template-columns`). **Esc** bricht ab; beim Loslassen geht **eine** Nachricht `aufteilung` raus – nichts, wenn es dieselbe Aufteilung bleibt. Da die Spaltenzahl gleich
  bleibt, geht kein Baustein verloren. _Abstand:_ Die Pille rastet beim senkrechten Ziehen (nach unten = mehr) auf die Stufen `kein/klein/normal/gross` des Schemas ein. Die
  **Pixelhöhe jeder Stufe wird am echten Stylesheet gemessen** (`K.stufenMessen`: je Stufe ein unsichtbarer Probe-Abschnitt mit den echten Klassen, gelesen wird der obere
  Innenabstand; bei jedem Ziehen neu, denn die Werte hängen an der Fensterbreite). Zwei **gestreifte Bänder** oben und unten zeigen die Abstandshöhe (hell gesäumt, auch auf Petrol
  und anderen dunklen Flächen sichtbar), der Chip nennt „Abstand oben und unten: Groß“ – **das Modell hat einen Abstand für oben und unten**. Erst ab 4 px ist es ein Zug; ein Klick
  öffnet „Gestalten“. Pfeil links/rechts am Spalten-Griff (nächste Aufteilung) und Pfeil hoch/runter an der Pille (eine Stufe) tun dasselbe mit der Tastatur. Die Rastung rechnet im
  Kern (`ebene.kern.txt`: `aufteilungRasten`, `abstandRasten`, `spaltenLage`, `teilerX`, `zeigerAnteil` – mit Tests); das Skript zeigt und sendet nur. Die Vorschau bleibt nach dem
  Loslassen stehen, bis sie neu gezeichnet wird; kommt keine neue Zeichnung (die Erweiterung hat die Änderung nicht übernommen), stellt die Ebene nach 2,5 s den Stand davor her.
  Beide Änderungen sind ein Schritt für Rückgängig/Wiederholen. **Redakteure dürfen beides** (Seiten-Maße, kein Aussehen der ganzen Website); fremd gesperrt gibt es keine Ebene und
  damit keine Griffe; am Handy bleibt es beim Fenster „Gestalten“. Der Spalten-Griff steht in der Rangordnung der Kollisionsregel an Stelle 3.
- **Rückgängig und Wiederholen (W3c-2).** Zwei stille Knöpfe ↶ ↷ in der Kopfzeile der Seite (nur Computer-Ansicht) und **Strg/Cmd+Z**,
  **Umschalt+Strg/Cmd+Z** (auch Strg+Y), solange **kein Textfeld offen ist** (im offenen Feld gilt der Verlauf des Feldes, siehe unten). Ein Schritt
  ist „Seite vorher, Seite nachher“ (`website/src/seitenVerlauf.ts`, rein): Verschieben, Einfügen, Kopieren, Löschen, übernommener getippter Text
  und ein Fenster mit „Fertig“. Rückgängig/Wiederholen laufen wie jede Änderung durch Sperre, Schema und Speicherschlange. Der Verlauf gilt **nur
  für die offene Seite und diese Sitzung** (beim Seitenwechsel leer), hält höchstens 100 Schritte und wird **geleert**, wenn der gespeicherte Stand
  ersetzt wird (Neu laden, „Bearbeitung übernehmen“) oder man mit „Seite einstellen“ Titel/Adresse/Menü ändert (die gehen nicht zurück).
  **Nichts Fremdes überschreiben:** Rückgängig geht nur, wenn die Seite genau so aussieht wie nach dem Schritt; sonst Hinweis, Verlauf weg. Hat
  jemand anderes inzwischen gespeichert, weist das Speichern selbst ab (Band „Neu laden“) – es wird nicht darüber geschrieben. Tasten im `iframe`
  meldet die Ebene als `rueckgaengig` / `wiederholen`.
- **Kollisionsregel** (`website/src/ebene.kern.txt`, `K.ordne`, mit Tests): Rangordnung Baustein-Leiste > Abschnitt-Leiste > Spalten-Griff > „+ Abschnitt“ >
  „+“ zwischen Bausteinen > Abstand-Pille. Jedes Element nennt Wunschplätze; genommen wird der erste, der weder eine Textzeile noch ein Bild
  noch einen Knopf noch ein höher eingestuftes Element berührt (und nicht unter dem festen Seitenkopf liegt). Geht keiner, weicht ein
  niedrigeres Element aus oder wird ausgeblendet; die beiden Leisten nehmen als Notlösung den Platz mit der geringsten Überdeckung, damit man
  sie immer erreicht. Die Farben sind fest (hell mit Rand und Schatten) – egal wie die Website aussieht.
- **Am Handy** (Ansicht „Handy“) gibt es nur die Abschnitt-Leiste und **Abschnitt einfügen**; ein Tippen auf einen Baustein öffnet das Fenster.
  Direktes Tippen im Text und die Baustein-Leiste gibt es nur am Computer (ein Hinweis über der Vorschau sagt es).
- **Fremd gesperrt** (jemand anderes bearbeitet die Seite): keine Schicht, nur ansehen. **Redakteure** haben keine Leiste und keinen Stift für
  „Eigenes HTML“ (`darfEigenesHtml`).

**Text direkt tippen (W3c-1).** Klick auf eine Überschrift, Akzentzeile, einen Text (auch in Bild+Text) oder eine Knopf-Beschriftung: Das Feld
bekommt einen blauen Ring und lässt sich schreiben.

- **Markieren** zeigt eine kleine Leiste: **F** fett · **K** kursiv · **Link** · **Liste** · **H** Zwischenüberschrift (`###`). Beim Link fragt ein
  Feld nach der Adresse; die Erweiterung prüft sie mit der echten Regel (`istLinkAdresse`, dieselbe wie beim Rendern) und antwortet dem iframe –
  nicht erlaubt → Hinweis im Feld, kein Link. (Das Link-Feld ist **kein** `<form>`: im abgeschotteten iframe ohne `allow-forms` käme nie ein
  „submit“.) Tastenkürzel für Fett/Kursiv gehen denselben Weg.
- **Esc** bricht ab (der alte Text steht wieder da). **Klick daneben** übernimmt; bei Überschrift, Akzentzeile und Knopf auch die
  **Eingabetaste**, im Text **Strg/Cmd+Eingabe** (die Eingabetaste macht dort einen neuen Absatz, Umschalt+Eingabe einen Zeilenumbruch). Ein Klick in
  ein anderes Textfeld übernimmt das alte und tippt dort gleich weiter. **Unverändert** → nichts wird gesendet, nichts gespeichert.
- **Während des Tippens wird nicht neu gezeichnet** (auch nicht, wenn sich die Seite inzwischen ändert – sie wird danach nachgezogen). Nach dem
  Übernehmen zeichnet die Vorschau immer neu: Was dort steht, ist das, was gespeichert wird.
- **Eingefügtes ist immer reiner Text**, einzeilig in Überschrift, Akzentzeile und Knopf, im Text Leerzeile = neuer Absatz.
- **Rückgängig/Wiederholen** (Strg/Cmd+Z, Umschalt+Strg/Cmd+Z, Strg+Y) gelten im Text mit Auszeichnung über einen **eigenen Verlauf**
  (Änderungen am DOM durch die Leiste zerstören den des Browsers; der Browser meldet „Wiederholen“ sonst nie). In den einzeiligen Feldern gilt der
  Verlauf des Browsers.
- **Ohne `execCommand`:** Das bearbeitete DOM wird in Blöcke gelesen (`p`, Zwischenüberschrift, Listenpunkte; Läufe mit fett/kursiv/Link), die
  Rechenschritte (fett umschalten, Link, Liste, Eingabe, Einfügen) laufen auf diesem Modell (`ebene.kern.txt`), danach wird neu gezeichnet und
  die Auswahl wieder eingestellt. Dasselbe Modell ist die Nachricht an die Erweiterung (`bloecke`).
- **Speichern wie jede Änderung:** `textUebernehmen` (`website/src/textAenderung.ts`) baut die neue Seite, `seitePruefen` prüft das Schema (zu
  lang, leere Überschrift → nicht übernommen, ruhiger Hinweis „Das geht so nicht“, die Vorschau zeigt wieder den gespeicherten Text), dann die
  Schlange. Scheitert das Speichern, steht „Nicht gespeichert“ mit „Erneut versuchen“ – der Text bleibt in der Vorschau. Die **Sperre** wird schon
  beim ersten Tippen genommen.

**Markdown und Escape (W3c-1).** Der Text der Bausteine „Text“ und „Bild und Text“ ist Markdown (`shared/website/markdown.ts`). Ein **Backslash** macht
das folgende Zeichen zum Zeichen: `\*`, `\_`, `\[`, `\]`, `\(`, `\)`, `\\`, `\#` überall, am Anfang einer Zeile auch `\-` und `1\.` (sonst wären sie Liste).
`***text***` ist fett und kursiv. Ein Backslash vor einem anderen Zeichen bleibt, wie er ist – vorhandene Texte rendern unverändert
(`shared/website/markdown.golden.json`, aus dem Stand vor dem Escape erzeugt). Der **Rückweg** vom getippten Text (`markdownAusBloecken`)
setzt die Backslashes, wo sie nötig sind, **an derselben Stelle** wie der Leser (eine Datei, eine Regel). Davor prüft `formatierungEindeutig`, ob
sich die Formatierung eindeutig schreiben lässt (zwei ausgezeichnete Stücke ohne Leerzeichen dazwischen – zum Beispiel kursiv direkt vor fett –
lassen sich nicht schreiben), danach `markdownSichtbarerText`, ob das Markdown genau den getippten Text zeigt; sonst wird **nichts**
übernommen. Im Fenster „Baustein bearbeiten“ (Markdown von Hand) gilt dieselbe Regel.

Alle Fenster sind die gewohnten Fenster der Erweiterungen (`Sheet`, mittig):

| Fenster             | Inhalt                                                                                                                                                          |
| ------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Abschnitt einfügen  | die Vorlagen als Kacheln mit Schema-Bild; „Eigenes HTML“ nur mit dem Recht                                                                                      |
| Abschnitt gestalten | Hintergrund (Hell, Sanft, Hauptfarbe, Akzent, eigene Farbe, Foto mit Abdunkeln), Spalten, Abstand, Breite, Höhe, Ausrichtung, senkrecht, Textfarbe, Sprungmarke |
| Baustein bearbeiten | Felder je Art (alle 15); Entfernen (fragt nach), Abbrechen, Fertig                                                                                              |
| Baustein hinzufügen | die Arten zur Auswahl; der neue Baustein ist ein Platzhalter (`neuerBaustein`, dieselben Erzeuger wie die Vorlagen) und öffnet sich gleich zum Bearbeiten       |
| Seite einstellen    | Titel, Adresse (die Startseite hat immer „/“), Beschreibung, „Im Menü zeigen“, Reihenfolge im Menü, Seite löschen                                               |

- **Änderungen sieht man sofort** in der Vorschau; **„Abbrechen“ stellt den Stand vor dem Öffnen wieder her** (auch X). Erst
  „Fertig“ prüft und speichert. Leistenaktionen (verschieben, kopieren, einfügen, löschen) und direkt getippter Text speichern gleich.
- **Weniger Spalten:** Die Inhalte der wegfallenden Spalten wandern hinten in die letzte – nie geht ein Baustein verloren
  (`aufteilungAendern`, getestet für jede Aufteilung in jede andere).
- **Bilder** sind in W3a-2 ein Platzhalter (klar beschriftet); die Bildwahl kommt mit W4. Beim Baustein „Termine“ kommt die
  Kalenderliste aus ChurchTools (`GET /calendars`, dieselbe wie bei den Ablaufvorlagen); geht das nicht, bleibt die Eingabe der
  Nummern. Ob ChurchTools dort nur öffentliche Kalender liefert, ist **nicht gemessen** – der Hinweis im Fenster sagt, dass auf
  der Website nur Termine aus öffentlichen Kalendern erscheinen.
- **Geprüft wird vor jedem Speichern** mit dem Schema (`seitePruefen`: Schema, doppelte Adressen, Kennungen und Sprungmarken);
  ungültig → die Meldung steht im Fenster, nichts wird gespeichert. Links auf Seiten oder Sprungmarken, die es nicht (mehr) gibt,
  blockieren **nicht** (das zeigt später die Freigabe). Als letzte Sicherung prüft auch `seiteSpeichern` mit dem Schema.
- **Speichern** (`shared/website/schlange.ts`): **nie zwei Speicherungen gleichzeitig**; kommt während einer Speicherung eine neue
  Änderung, geht danach nur der neueste Stand hinaus. Oben steht „Speichert … / Gespeichert / Nicht gespeichert“. **Ein
  vorübergehender Fehler zerstört nichts:** Die Änderung bleibt in der Vorschau, „Erneut versuchen“ schickt denselben Stand noch
  einmal, kein Neuladen. Solange etwas nicht gespeichert ist, lässt sich keine andere Seite wählen, und der Browser warnt vor dem
  Schließen des Tabs.

### Vorschau und Sicherheit

Die Vorschau ist ein `iframe` mit `srcdoc` und **`sandbox="allow-scripts"` – ohne `allow-same-origin`**. Der Baustein „Eigenes
HTML“ (nur für die Leitung) bringt fremden Code mit; in dieser Sandbox hat er einen eigenen, leeren Ursprung und kommt weder an
ChurchTools noch an die Sitzung noch an die Erweiterung (`website/src/Vorschau.test.tsx` prüft das Attribut). Folgen:

- Das **Stylesheet** (`shared/website/website.css`) steht als `<style>` im Dokument (`stylesheetText` im Renderer; der Bau
  gibt weiter ein `<link>` aus). Ein `<link>` auf eine `data:`-Adresse blockiert ChurchTools (siehe unten).
- Die Vorschau bekommt **kein Seiten-Skript** (`skriptAdresse` fehlt, es steht kein `<script src>` im Dokument).
- **Schriften** kommen als `data:`-Adresse ins Dokument (s. „Aussehen“); bis eine Datei geladen ist – und für eigene Schriften
  bis W4 – gilt die Ersatzschrift.
- **Bilder** sind ein neutrales Platzhalter-Bild (echte Bilder: W4).
- Termine, Beiträge, Slider, Livestream und Gruppen sind in der Vorschau leer – der Renderer zeigt seine Leer-Hinweise.
- Links auf andere Seiten führen in der Vorschau nirgendwohin; mit der Bearbeiten-Ebene tut auch ein Klick auf einen Link und das
  Abschicken eines Formulars nichts.

**Content-Security-Policy von ChurchTools (gemessen 20.11.2026, Test-Instanz, ChurchTools 3.138.x, Seite `/ccm/website/`).**
Das `iframe` mit `srcdoc` **erbt** die Policy der ChurchTools-Seite:

```
default-src 'self'; script-src 'self' js.stripe.com 'nonce-…' 'unsafe-eval'; style-src 'self' 'unsafe-inline' *.dev.churchtools.website;
font-src 'self' *.dev.churchtools.website data:; img-src * data: blob: *.church.tools; media-src 'self' https:; child-src * data;
connect-src *; object-src 'self' www.youtube.com; frame-ancestors 'self'
```

| Im iframe                                             | Ergebnis                                     |
| ----------------------------------------------------- | -------------------------------------------- |
| `<link rel=stylesheet href="data:text/css,…">`        | **blockiert** (die Vorschau war ungestaltet) |
| `<style>…</style>` im Dokument                        | wirkt                                        |
| `<script>` inline ohne Nonce, `<script src="data:…">` | **blockiert**                                |
| `<script nonce="…">` mit der Nonce der Seite          | läuft                                        |

Folgen:

- **Stylesheet** als `<style>` (s. o.). **Ebene:** Die Erweiterung liest die Nonce zur Laufzeit (`seitenNonce()` in `ebene.ts`:
  Eigenschaft `.nonce` von `script[nonce]`, das Attribut ist im DOM leer; sie wechselt bei jedem Laden der Seite), prüft sie
  (`^[A-Za-z0-9+/=_-]{8,200}$`) und setzt sie auf `<script>` und `<style>` der Ebene. Ohne Nonce (Demo, Entwicklung) bleibt das
  Attribut weg.
- **Kein stiller Ausfall:** Die Ebene meldet sich nach dem Laden per `postMessage` („bereit“). Bleibt das binnen 2 s aus, zeigt die
  Erweiterung über der Vorschau „Bearbeiten in der Vorschau ist gerade nicht möglich …“ und schreibt eine `console.warn`-Zeile.
- **„Eigenes HTML“:** Skripte darin laufen in der Vorschau in ChurchTools **nicht** (sie haben keine Nonce) – auf der echten
  Website schon. Das Baustein-Fenster sagt es dazu.
- **Schriften (W3a-3):** als `data:`-Adresse einbinden – `font-src` erlaubt `data:` (am 20.11.2026 gemessen, umgesetzt in
  W3a-3a). **Bilder:** `img-src *` erlaubt `data:`,
  `blob:` und Adressen im ganzen Netz – unkritisch.

**Nachrichten aus der Vorschau (W3a-2, W3c-1).** Die Bedien-Schicht (`website/src/ebene.css`, `ebene.kern.txt`, `ebene.skript.txt`) läuft
im selben `iframe` und meldet per `postMessage`, was angeklickt wurde – **als Zahlen** (Abschnitt, Spalte, Baustein in der Reihenfolge
der Seite); nur beim Text direkt tippen kommt auch der getippte Text mit (Punkt 5). Weil der Baustein „Eigenes HTML“ im selben `iframe` läuft und Nachrichten **fälschen** könnte, gilt:

1. Die Erweiterung nimmt **nur** Nachrichten an, deren `event.source` genau dieses `iframe` ist (`Vorschau.tsx`).
2. Die Form wird geprüft (`nachricht.ts`, zod): bekannte Art, nur ganze Zahlen; **nichts** außer diesen Zahlen wird übernommen.
3. Die Zahlen werden gegen die Seite geprüft: Einen Abschnitt, den es nicht gibt, gibt es nicht.
4. Eine Nachricht löst nie mehr aus als ein Klick: ein Fenster öffnen, verschieben, kopieren, einen Schritt zurück. **Löschen fragt immer erst nach.**
   **`verschieben`** (W3c-2) trägt nur Zahlen: `art: 'abschnitt'` mit `von`/`nach` als Zahl, oder `art: 'baustein'` mit `von`/`nach` als `{ i, j, k }`
   (keine fremden Felder). Beide Stellen müssen es auf der Seite geben (`abschnittDa`, `bausteinDa`, `einfuegeStelleDa`, `bausteinStelleDa`), sonst ist
   es keine Nachricht. Die Seitenarbeit verweigert zusätzlich das Verschieben von „Eigenes HTML“ ohne das Recht (auch bei einer gefälschten
   Nachricht). `hoch` und `runter` gibt es nicht mehr. `rueckgaengig` / `wiederholen` tragen nichts.
   **`aufteilung`** und **`abstand`** (W3c-3) tragen eine Zahl (Abschnitt) und einen **Namen aus den Listen des Modells** (`AUFTEILUNGEN`, die Stufen aus `gestaltungSchema`; keine
   fremden Felder). Der Abschnitt muss es geben, und eine Aufteilung muss **dieselbe Spaltenzahl** haben wie der Abschnitt (`aufteilungGleicheSpalten`) – sonst ist es keine
   Nachricht. Die Seitenarbeit prüft es nach dem Warten auf die Sperre noch einmal (`aufteilungZiehen`) und ändert den Abstand über `gestaltungAendern`, dieselbe Regel wie das Fenster „Gestalten“.
5. **Die eine Ausnahme: der getippte Text** (`text`). Er kommt nur an, wenn (a) die Stelle ein tippbares Feld ist (`textFeldGueltig`: Überschrift,
   Akzentzeile, Text, Bild+Text, Knopf-Beschriftung – nie „Eigenes HTML“), (b) die Form stimmt (feste Läufe aus Text, Fett, Kursiv, Link, nichts
   sonst, Längen begrenzt), (c) **jede Link-Adresse die echte Regel besteht** (sonst ist die ganze Nachricht ungültig) und (d) dasselbe Feld
   vorher als „wird getippt“ gemeldet wurde (nur einmal gültig). Der Text geht danach durch Schema und Schlange wie jede Änderung. Das schützt
   **nicht** vor dem Baustein „Eigenes HTML“ (der könnte „tippen“ und „text“ fälschen) – sein Spielraum ist aber nur, Text in einem Textfeld zu
   ändern, und das kann die Leitung, die ihn gebaut hat, ohnehin.

Die Schicht wird **nur** in die Vorschau gehängt (`vorschauHtml(…, { scroll, … })`), nie in den Bau; der Renderer hat dafür keinen
Sonderweg (kein `data-w-id`: die Ebene findet Abschnitte, Spalten und Bausteine an der Reihenfolge im Dokument). Skript und Kern liegen
als Textdateien (`.txt`), weil die Prüfung des Repos (`eslint .`) TypeScript liest und kein Fremdskript für das `iframe`; die Tests
spielen sie im Dokument der Testumgebung nach (`ebene.testutil.ts`).

## Aussehen (W3a-3a)

Der Reiter **Aussehen** (`website/src/Aussehen.tsx`) stellt die Einstellungen ein, die für die ganze Website gelten: **Farben**
(Hauptfarbe, Hauptfarbe dunkel, Akzent, Hintergrund, Sanft, Text – Farbwähler und Hex-Feld, in dem die geltende Farbe als Platzhalter steht, solange nichts gesetzt ist; nur gültige Werte werden übernommen;
ist „Hauptfarbe dunkel“ leer, wird sie aus der Hauptfarbe abgeleitet), **Schriften** (Text, Überschriften, Handschrift-Zeile aus
der festen Liste `shared/website/schriften.ts`), das **Logo** (nur Anzeige – ändern geht mit den Bildern, W4) und **Eigenes CSS**
(bis 20.000 Zeichen). Rechts die Vorschau der Startseite, eine andere Seite ist wählbar. Die Regeln dazu stehen rein und getestet
in `shared/website/aussehen.ts`.

- **Kontrast (E-W18):** `kontrast(a, b)` in `shared/website/theme.ts` (WCAG). Text auf Hintergrund und Text auf „Sanft“ unter
  **4,5 : 1** → ein ruhiger Hinweis, je Problem genau einer, gesammelt unter „Text“. **Es wird nichts gesperrt.**
- **Speichern:** Die Einstellungen sind eine Einheit (`einstellungen`) mit eigener Sperre (`website-sperre` mit `einheit:
einstellungen`, gelesen als `WebsiteStand.einstellungenSperre`). Der Ablauf ist derselbe wie bei den Seiten
  (`website/src/useSperrarbeit.ts`): erst die Sperre, dann prüfen (`einstellungenSchema`) und nach 0,7 s speichern – Ungültiges
  nie; „Erneut versuchen“; hat jemand inzwischen etwas geändert, wird nicht darüber geschrieben. Verlässt man den Reiter mit
  wartender Änderung, wird sie noch abgeschickt und die Sperre erst danach freigegeben. Lassen sich gespeicherte Einstellungen
  nicht lesen, bietet der Reiter nichts zum Ändern an (nichts wird überschrieben). Wer das eigene CSS ändern darf, regelt W3b –
  in W3a sieht ohnehin nur die Leitung den Editor.
- **Schriften laden (nur die gewählten):** Die 14 Dateien liegen in `shared/website/schriften/` (WOFF2, nur Latin, je Paket mit
  Lizenztext, Herkunft in `QUELLEN.md`; **Roboto Slab: Apache 2.0**, alle anderen SIL OFL 1.1; Wächter
  `shared/website/schriftdateien.test.ts`). Die Vorschau bekommt jede Schrift als **eigenen, nachgeladenen Teil** des Bündels
  (`website/src/schriftLader.ts`: `import.meta.glob(…, { query: '?inline' })` – Vite macht daraus `data:font/woff2;base64,…`),
  geladen wird erst, wenn die Schrift gewählt ist. Nach `npm run build -w website` liegen 14 Schrift-Teile in
  `dist-extension/assets/`, das Haupt-Bündel enthält keine Schrift. **Ein Ladefehler ist vorübergehend:** Ersatzschrift, leiser
  Hinweis mit „Erneut laden“, der nächste Bedarf versucht es wieder; nichts wird deswegen gespeichert oder verworfen.
- **`data:`-Adressen im Stylesheet:** `cssAdresse` (`theme.ts`) entschärft jede Schriftadresse und kodiert dabei `;`. Für
  `data:font/woff2;base64,…` wäre das fatal (die Schrift bliebe unsichtbar); genau diese **eine** Form, mit Base64-Zeichen und
  sonst nichts, bleibt unverändert.

## Einstellungen (W3a-3b)

Der letzte Reiter **Einstellungen** (`ErweiterungsSeite`, `einstellungen={{ onOeffnen, offen }}` – wie in allen Erweiterungen)
öffnet das Fenster `website/src/EinstellungenFenster.tsx`: **Name der Gemeinde**, **Links in der Fußzeile** (Titel + Ziel: eine
Seite der Website oder eine Adresse; hinzufügen, entfernen, nach oben/unten; höchstens 10), **Datenschutz-Link** (Seite, Adresse
oder keiner) und **Text des YouTube-Banners** (leer = Standardtext, der als Platzhalter zu sehen ist). Gibt es einen
Livestream-Baustein, aber keinen Datenschutz-Link, steht ein Hinweis da (`datenschutzFehlt` in `shared/website/modell.ts` – dieselbe
Regel wie die Gesamtprüfung `pruefeWebsite`). Kontaktformular-Adresse und `noindex` kommen mit W5/W6.

- **Gespeichert wird mit „Speichern“** (wie in den Fenstern von Gebetsabend, Organigramm, Anmeldungen), nicht bei jeder Eingabe –
  darum kein „Rückgängig“; Abbrechen/X verwirft. Ungültiges (leerer Name oder Titel, unerlaubte Adresse) wird nicht gespeichert, die
  Meldung nennt den Link („Fußzeile, Link 2: …“); das Fenster bleibt offen. Scheitert das Speichern, bleibt die Eingabe stehen.
- **Ein Zustand, ein Schreiber:** „Aussehen“ und das Fenster schreiben **dieselbe** Einheit `einstellungen`. Den Arbeitsstand, die
  Sperre und die Schlange hält darum der `EinstellungenProvider` (`website/src/EinstellungenQuelle.tsx`) über beiden; er steht, solange
  eines von beiden offen ist (danach ist die Sperre frei). Das Fenster legt beim Speichern nur Name, Fußzeile, Datenschutz-Link und
  Banner-Text auf den **neuesten** Stand (`formularAnwenden` in `shared/website/einstellungen.ts`) – Farben, Schriften und CSS bleiben,
  auch eine Änderung im Aussehen, die noch auf ihre Verzögerung wartet. Zwei getrennte Zustände überschrieben einander („die spätere
  gewinnt“).
- **Der Reiter „Seiten“ zieht nach (W3a-3c):** „Seiten“ liest die Website einmal beim Öffnen und hält die Einstellungen nur für die
  Vorschau. Der Server bleibt die **einzige Quelle**, „Seiten“ schreibt Einstellungen nie. Meldet der Provider ein **gelungenes**
  Speichern (`onGespeichert`, aus `nachSpeichern` der Schlange – nicht bei Fehler, Sperre oder „inzwischen geändert“), zählt `App`
  `einstellungenStand` hoch; `Seiten` liest daraufhin mit `ladeWebsite` neu und ersetzt im gelesenen Stand **ausschließlich**
  `einstellungen` (Seiten, Menü, Sperren und die offene Bearbeitung in `Seitenarbeit` bleiben). Der Zähler beim Öffnen löst nichts aus.
  Scheitert das Nachlesen, bleibt die alte Vorschau stehen, ein leiser Hinweis erscheint; die nächste gelungene Speicherung oder ein
  Reiterwechsel versucht es wieder. Test: `website/src/EinstellungenInSeiten.test.tsx`. Weitere Kopien der Einstellungen gibt es
  nicht (`Seitenarbeit`, `Vorschau`, `AbschnittGestalten` bekommen sie als Eigenschaft von `Seiten`).
- **Fremd gesperrt:** Das Fenster ist nur zum Lesen (Felder und „Speichern“ aus, Hinweis mit Namen).
- **„Mails im Freigabe-Weg“ (W3b-3)** ist ein Haken unter den Einstellungen und **wirkt sofort** – unabhängig von „Speichern“ und von der
  Sperre der Einstellungen (eigener Wert `website-mail`, siehe „Mails im Freigabe-Weg“).
- **„Wer darf was“ (W3b-1)** steht unter den Einstellungen im selben Fenster, nur für Admins mit „Personen administrieren“; es hat
  einen eigenen Knopf („Rechte setzen“, wirkt sofort) und ist von der Sperre der Einstellungen unabhängig (siehe „Wer darf was – Stand
  W3b-1“). Leitung sieht das Fenster ohne diesen Bereich; Redakteure sehen es gar nicht.
- **Regeln** (rein, getestet): `shared/website/einstellungen.ts` – Formular-Entwurf, Fußzeile hinzufügen/entfernen/verschieben,
  Grenze `FUSSZEILE_MAX`, `einstellungenMeldung` (Schema-Fehler in Worten; auch für „Aussehen“).

## Das Stylesheet

`shared/website/website.css` ist das **eine** Stylesheet für alle Gemeinden (aus dem abgenommenen Entwurf). Farben und
Schriften kommen nur aus den Variablen in `:root`, die das Theme jeder Seite setzt (`shared/website/theme.ts`); die Werte im
Blatt sind eine neutrale Vorgabe. Es liegt in `shared/` und nicht in der Erweiterung, damit der Bau-Dienst (W5) dieselbe Datei
benutzt. Es ist **Gemeinde-Design, nicht ChurchTools-Design** – die Quelltext-Wächter der Oberfläche (`ui/design/*`) gelten
dafür nicht. `shared/website/stylesheet.test.ts` prüft, dass jede Klasse, die der Renderer ausgibt, im Blatt eine Regel hat (oder
mit Begründung bewusst keine).

## Was noch fehlt

W3b-4c Mails je Bereich (bis dahin bekommt bei Seiten einer Untergruppe niemand eine Mail, siehe „Bereiche – Stand W3b-4b“) · W4 Bilder · W5 Bau-Dienst und Veröffentlichen · Release
(`website-v…`; Tag erst nach grünem Merge, siehe `.github/workflows/website-release.yml`).

## Release

Wie bei den anderen Erweiterungen: erst in main mergen (CI grün), dann `git tag website-vX.Y.Z && git push origin
website-vX.Y.Z` – der Workflow baut, packt und legt einen Release mit der ZIP an (`make_latest: false`).
