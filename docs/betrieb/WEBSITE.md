# Website – ChurchTools-Erweiterung

> **Stand: W3a-2 (20.11.2026) – noch kein Release.** Gebaut sind das Grundgerüst (Einrichten, Seitenliste, Vorschau, Seiten
> anlegen und löschen – W3a-1) und das **Bearbeiten direkt in der Vorschau**: Abschnitte einfügen, gestalten, verschieben,
> kopieren, löschen, Bausteine bearbeiten, hinzufügen, entfernen, Seite einstellen mit Menü, dazu die **Sperre** (eine Person
> bearbeitet) und das **Speichern von selbst**. Noch **nicht** da: Aussehen – Farben, Schriften, Logo (W3a-3), Bilder (W4),
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

1. In ChurchTools eine **Gruppe „Website“** anlegen (oder eine vorhandene wählen) – dort arbeitet das Website-Team. Die
   **Leitung** dieser Gruppe darf die Website bearbeiten.
2. Die Erweiterung öffnen. Sie zeigt „Website einrichten“ mit einer Auswahl der Gruppen (eine Gruppe namens „Website“ ist
   vorgewählt) und dem Knopf **Einrichten**.
3. **Einrichten** legt zwei Kategorien im Speicher der Erweiterung an – nacheinander, jede erst nach Nachsehen und danach
   nachgelesen:
   - **„Website: Entwürfe · <Gruppe>“** (Kürzel `entwuerfe-g<ID>`) – die Arbeitsfassung.
   - **„Website: Veröffentlicht · <Gruppe>“** (Kürzel `veroeffentlicht-g<ID>`) – die freigegebene Fassung; in W3a-1 noch leer.

   Die **Gruppe steckt im Kürzel**: So erfährt die Erweiterung, welche Gruppe gewählt wurde, ohne etwas Zusätzliches zu
   speichern. Gibt es mehrere solcher Kategorien, gilt die mit der kleinsten Kategorie-ID.

4. Ist nur eine der beiden Kategorien da (ein früherer Versuch ist abgebrochen), ergänzt **Einrichten** die fehlende – die
   Gruppe steht dann fest.

## Wer darf was – Stand W3a-2

| Wer                                                    | sieht / darf                                                                                             |
| ------------------------------------------------------ | -------------------------------------------------------------------------------------------------------- |
| **Admin** („Gruppen verwalten“)                        | einrichten, alle Seiten sehen, anlegen, bearbeiten (auch „Eigenes HTML“), löschen                        |
| **Leitung der gewählten Gruppe** (Rolle mit „Leitung“) | alle Seiten sehen, anlegen, bearbeiten, löschen – **sobald ChurchTools ihr die Kategorie zeigt** (s. u.) |
| Mitarbeiter der Gruppe, alle anderen                   | freundlicher Hinweis, wer die Website bearbeiten darf; kein Editor                                       |

**Wichtig – zwei getrennte Schichten:**

1. Die **Oberfläche** zeigt den Editor nur Admins und der Leitung der Gruppe (`shared/website/zugang.ts`). Leitung ist, wer
   eine **aktive** Mitgliedschaft mit einer Rolle hat, die ChurchTools als Leitung führt (`isLeader`). Die Rechteabfrage
   `GET /permissions/internal/groups/{id}` taugt dafür nicht: Sie meldet einzelne Rechte (z. B. `+create group`), die auch
   Organisatoren haben, die keine Leitung sind.
2. Der **Schutz der Daten** sind allein die **Rechte an den Kategorien** in ChurchTools. Die setzt in W3a-1 **die Verwaltung von
   Hand**: unter _Administration → Berechtigungen_ bei der Erweiterung „Website“ für die **Leiter-Rolle der Gruppe**
   „Modul sehen“ und für die Kategorie „Entwürfe“ „Daten sehen“, „anlegen“, „ändern“, „löschen“. Ohne diese Rechte sieht die
   Leitung die Kategorien nicht – die Erweiterung zeigt ihr dann „noch nicht eingerichtet, oder dir fehlt das Recht“. Das
   Setzen an den Rollen übernimmt mit **W3b** die Erweiterung selbst (wie beim Organigramm).

„Eigenes HTML“ (wird unverändert auf die Website übernommen) darf nur die Leitung einfügen und ändern: Die Oberfläche fragt dafür
`darfEigenesHtml` (`shared/website/zugang.ts`); in W3a haben ohnehin nur Admins und die Leitung Zugang, W3b speist dort die Rolle
der Redakteure ein. Auch das ist die Regel der Oberfläche, nicht der Schutz der Daten.

Die Kategorie „Veröffentlicht“ bekommt in W3a keine Schreibrechte außer für Admins.

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

- **Reiter:** Seiten | Aussehen | Freigaben (am Computer oben, am Handy unten). „Aussehen“ und „Freigaben“ zeigen bisher
  nur einen Hinweis „kommt“.
- **Seiten:** links die Liste („Im Menü“ in der Reihenfolge des Menüs, „Weitere Seiten“; die Startseite ist markiert), rechts
  die **Vorschau** mit dem Umschalter **Computer | Handy** (390 px).
- **Neue Seite:** Titel eingeben; der Pfad (die Adresse) entsteht daraus (Umlaute ausgeschrieben, bei Streit `-2`). Die Seite
  ist leer.
- **Seite löschen:** steht im Fenster „Seite einstellen“; mit Rückfrage, steht sie im Menü, wird der Menüpunkt mit entfernt.
- **Startseite anlegen:** Hat die Website keine Startseite, steht ein Hinweis mit dem Knopf „Startseite anlegen“ (Vorlage
  `start-schriftzug`). Angelegt wird **nie von selbst**.
- Demo ohne ChurchTools (nur beim Entwickeln): `npm run dev -w website`, dann `…/ccm/website/?demo` (Fälle: siehe
  `website/src/demo.ts`; u. a. `?demo=seiten` zum Durchspielen des Bearbeitens, `?demo=gesperrt` – jemand anderes bearbeitet die
  Startseite –, `?demo=wackelt` – das erste Speichern scheitert vorübergehend). Im Demo-Modus geht **keine** Anfrage ins Netz:
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

- Das **Stylesheet** (`shared/website/website.css`) steckt als `data:`-Adresse im Dokument.
- **Keine Schriftdateien** in der Vorschau – die Seite fällt auf die Ersatzschrift zurück (Schriften kommen mit W3a-3).
- **Bilder** sind ein neutrales Platzhalter-Bild (echte Bilder: W4).
- Termine, Beiträge, Slider, Livestream und Gruppen sind in der Vorschau leer – der Renderer zeigt seine Leer-Hinweise.
- Links auf andere Seiten führen in der Vorschau nirgendwohin; mit der Bearbeiten-Ebene tut auch ein Klick auf einen Link und das
  Abschicken eines Formulars nichts.

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

## Das Stylesheet

`shared/website/website.css` ist das **eine** Stylesheet für alle Gemeinden (aus dem abgenommenen Entwurf). Farben und
Schriften kommen nur aus den Variablen in `:root`, die das Theme jeder Seite setzt (`shared/website/theme.ts`); die Werte im
Blatt sind eine neutrale Vorgabe. Es liegt in `shared/` und nicht in der Erweiterung, damit der Bau-Dienst (W5) dieselbe Datei
benutzt. Es ist **Gemeinde-Design, nicht ChurchTools-Design** – die Quelltext-Wächter der Oberfläche (`ui/design/*`) gelten
dafür nicht. `shared/website/stylesheet.test.ts` prüft, dass jede Klasse, die der Renderer ausgibt, im Blatt eine Regel hat (oder
mit Begründung bewusst keine).

## Was noch fehlt

W3a-3 Aussehen (Farben, Schriften, Logo) · W3b Redakteure,
Untergruppen, Freigabe, Rechte an den Gruppenrollen · W4 Bilder · W5 Bau-Dienst und Veröffentlichen · Release
(`website-v…`; Tag erst nach grünem Merge, siehe `.github/workflows/website-release.yml`).

## Release

Wie bei den anderen Erweiterungen: erst in main mergen (CI grün), dann `git tag website-vX.Y.Z && git push origin
website-vX.Y.Z` – der Workflow baut, packt und legt einen Release mit der ZIP an (`make_latest: false`).
