# Website – ChurchTools-Erweiterung

> **Stand: W3b-1 (20.11.2026) – noch kein Release.** W3b-1: Rechte beim Einrichten (Stufen je Rolle), „Wer darf was“ im Fenster „Einstellungen“, Zugang aus den eigenen Rechten, Redakteure in der Oberfläche – siehe „Wer darf was – Stand W3b-1“. Davor W3a-3c: die Seiten-Vorschau zieht nach dem Speichern im Fenster „Einstellungen“ sofort nach (siehe dort). Davor (W3a-3b) neu: der letzte Reiter **Einstellungen** (Fenster) – siehe „Einstellungen (W3a-3b)“ unten. Davor (W3a-3a): der Reiter **Aussehen** (Farben, Schriften, Logo-Hinweis,
> eigenes CSS) und die Schriften in der Vorschau – siehe „Aussehen“ unten. Gebaut sind das Grundgerüst (Einrichten, Seitenliste, Vorschau, Seiten
> anlegen und löschen – W3a-1) und das **Bearbeiten direkt in der Vorschau**: Abschnitte einfügen, gestalten, verschieben,
> kopieren, löschen, Bausteine bearbeiten, hinzufügen, entfernen, Seite einstellen mit Menü, dazu die **Sperre** (eine Person
> bearbeitet) und das **Speichern von selbst**. Noch **nicht** da: Bilder und Logo ändern (W4),
> Freigabe und Rechte für Redakteure (W3b), Veröffentlichen (W5). Das Bild der ganzen Website: Bauplan „Neue Website“
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
nach dem Nachlesen „gesetzt“. **Entzogen wird nur, was auf die beiden Kategorien der Website zeigt**; Rechte an anderen Kategorien
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

## Freigabe – Stand W3b-2

**Der Weg einer Seite:** Ein Redakteur ändert sie in „Entwürfe“ und **reicht sie zur Prüfung ein**; die Leitung sieht sie im Reiter
**Freigaben**, schaut sich die Vorschau an und **gibt frei** – oder **gibt sie mit einer Anmerkung zurück**. Freigeben heißt: der Entwurf
wird **unverändert** nach „Veröffentlicht“ geschrieben. Die Leitung kann auch **direkt veröffentlichen** (Reiter „Seiten“, Menü „⋯“ →
„Veröffentlichen“). Die Mail beim Einreichen und Zurückgeben folgt mit W3b-3, die Untergruppen mit W3b-4.

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

**Offen / bewusst noch nicht:** Mail beim Einreichen und Zurückgeben (W3b-3); Untergruppen und „Seite einem Bereich zuordnen“ (W3b-4: die Regel
`freigabeListe` und `darfFreigeben` sind die Stellen, an denen der Bereich ergänzt wird). Nimmt die Leitung eine Seite offline, bleibt der
**veröffentlichte Menüpunkt** bestehen, bis das Menü unter „Freigaben“ veröffentlicht wird (der Entwurf des Menüs ist schon ohne die Seite).

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

### Bearbeiten in der Vorschau (W3a-2)

Die Vorschau ist zugleich die Arbeitsfläche. Fährt man über einen Abschnitt (am Handy: tippt man ihn an), erscheint seine
**Leiste**: Gestalten · nach oben · nach unten · kopieren · löschen. Zwischen den Abschnitten (und in einer leeren Seite) steht
**Abschnitt einfügen**, in jeder Spalte **+ Baustein**; ein Klick auf einen Baustein öffnet ihn. Alle Fenster sind die
gewohnten Fenster der Erweiterungen (`Sheet`, mittig):

| Fenster             | Inhalt                                                                                                                                                          |
| ------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Abschnitt einfügen  | die Vorlagen als Kacheln mit Schema-Bild; „Eigenes HTML“ nur mit dem Recht                                                                                      |
| Abschnitt gestalten | Hintergrund (Hell, Sanft, Hauptfarbe, Akzent, eigene Farbe, Foto mit Abdunkeln), Spalten, Abstand, Breite, Höhe, Ausrichtung, senkrecht, Textfarbe, Sprungmarke |
| Baustein bearbeiten | Felder je Art (alle 15); Entfernen (fragt nach), Abbrechen, Fertig                                                                                              |
| Baustein hinzufügen | die Arten zur Auswahl; der neue Baustein ist ein Platzhalter (`neuerBaustein`, dieselben Erzeuger wie die Vorlagen) und öffnet sich gleich zum Bearbeiten       |
| Seite einstellen    | Titel, Adresse (die Startseite hat immer „/“), Beschreibung, „Im Menü zeigen“, Reihenfolge im Menü, Seite löschen                                               |

- **Änderungen sieht man sofort** in der Vorschau; **„Abbrechen“ stellt den Stand vor dem Öffnen wieder her** (auch X). Erst
  „Fertig“ prüft und speichert. Leistenaktionen (verschieben, kopieren, einfügen, löschen) speichern gleich.
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

**Nachrichten aus der Vorschau (W3a-2).** Die Bearbeiten-Ebene (`website/src/ebene.css`, `ebene.skript.txt`) läuft im selben
`iframe` und meldet per `postMessage`, was angeklickt wurde – **nur als Zahlen** (Abschnitt, Spalte, Baustein in der Reihenfolge
der Seite). Weil der Baustein „Eigenes HTML“ im selben `iframe` läuft und Nachrichten **fälschen** könnte, gilt:

1. Die Erweiterung nimmt **nur** Nachrichten an, deren `event.source` genau dieses `iframe` ist (`Vorschau.tsx`).
2. Die Form wird geprüft (`nachricht.ts`, zod): bekannte Art, nur ganze Zahlen; **nichts** außer diesen Zahlen wird übernommen.
3. Die Zahlen werden gegen die Seite geprüft: Einen Abschnitt, den es nicht gibt, gibt es nicht.
4. Eine Nachricht löst nie mehr aus als ein Klick: ein Fenster öffnen, verschieben, kopieren. **Löschen fragt immer erst nach.**

Die Ebene wird **nur** in die Vorschau gehängt (`vorschauHtml(…, { scroll })`), nie in den Bau; der Renderer hat dafür keinen
Sonderweg (kein `data-w-id`: die Ebene findet Abschnitte, Spalten und Bausteine an der Reihenfolge im Dokument). Das Skript liegt
als Textdatei (`.txt`), weil die Prüfung des Repos (`eslint .`) TypeScript liest und kein Fremdskript für das `iframe`.

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

W3b-3 Mail · W3b-4 Untergruppen · W4 Bilder · W5 Bau-Dienst und Veröffentlichen · Release
(`website-v…`; Tag erst nach grünem Merge, siehe `.github/workflows/website-release.yml`).

## Release

Wie bei den anderen Erweiterungen: erst in main mergen (CI grün), dann `git tag website-vX.Y.Z && git push origin
website-vX.Y.Z` – der Workflow baut, packt und legt einen Release mit der ZIP an (`make_latest: false`).
