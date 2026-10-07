# Umsetzungsplan – ChurchTools-Extension (zweite Auslieferung derselben Codebasis)

> Status: **Phase 1 (#333), 2 (#334) und 3a (#335, Lesen) erledigt, 07.10.2026.** Ablage = Personen-Dateien
> (§2b). Phase 4 (#336, Anteasern) und 5 (#337, Paket) erledigt. 3b (Schreiben) läuft in Scheiben:
> **3b-1 Ablauf + Tempo** und **3b-2 Lieder/Notenblätter** gebaut; offen Abwesenheiten, Team-Notizen +
> Einstellungen, SongSelect.
> Ziel: dieselbe App zusätzlich als **ChurchTools-Extension** unter `/ccm/<key>/` ausliefern –
> ohne eigenen Server, ohne zweite Anmeldung, installierbar von jeder Gemeinde.
> Die bestehende Server-/PWA-Variante (NAS, `musik.ecg-donrath.de`) **bleibt** und ist der Weg für
> alles, was die Extension nicht kann.

## 1. Ziel & Abgrenzung

**Ziel** (mit Alwin am 10.08.2026 festgelegt, alle vier Punkte gleichrangig):

1. **Keine zweite Anmeldung** – wer in ChurchTools angemeldet ist, ist in der App drin.
2. **Kein eigener Server/NAS** – ChurchTools liefert die App aus; kein Docker, kein Reverse Proxy,
   kein Zertifikat.
3. **Menüpunkt in ChurchTools** – die App liegt dort, wo die Musiker ohnehin arbeiten.
4. **Für andere Gemeinden verteilbar** – ZIP installieren, fertig.

**Leitentscheidung:** Wo die Extension Grenzen setzt, wird die Funktion **weggelassen und
angeteasert** – nicht mühsam nachgebaut. Der Teaser verweist auf die Server-Variante.

**Bewusst NICHT Teil dieses Vorhabens**

- Offline-Nutzung im Saal (siehe §6 – der Grund ist technisch, nicht Faulheit).
- Ablösen der NAS-Installation der ECG. Die läuft weiter; ob und wann die ECG selbst auf die
  Extension wechselt, ist eine **eigene** Entscheidung nach dem ersten Praxiseindruck.

## 2. Getroffene Entscheidungen

| Thema            | Entscheidung                                                                                                                                                                                                   |
| ---------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Repo             | **Ein Repo, zwei Auslieferungen.** Kein zweites Repo, kein Fork-Abgleich (Begründung §4)                                                                                                                       |
| Build            | `npm run build` = PWA + Server (wie heute) · `npm run build:extension` = ZIP für ChurchTools                                                                                                                   |
| Schalter         | **Genau ein** Modus-Schalter, abgefragt **nur in der Service-Schicht** – nie in einer Komponente                                                                                                               |
| Datenspeicher    | **Personen-Dateien** (`/files/person/<eigene id>`): Zeichnungen als Bild je Seite, alles andere in **einer** kleinen Datei je Person (§2b, Alwin 07.10.2026). Die Custom-Module-Daten werden **nicht** genutzt |
| Anmeldung        | Sitzung des CT-Kontexts; `login`/`logout` entfallen in der Extension                                                                                                                                           |
| Offline          | **Fällt weg** und wird angeteasert (§6)                                                                                                                                                                        |
| Server-Variante  | **Bleibt** im Repo – Ziel des Teasers und Rückfallebene der ECG                                                                                                                                                |
| Vorlage          | Der Fork von bwl21 (§3) als **Vorlage**, nicht als Grundlage – er steht auf v2.13.5                                                                                                                            |
| Schreibschutz    | **Je Person** – fremde Dateien ändern/löschen → 403 (§2b). Der fehlende Schutz je Eintrag der Custom-Module-Daten (§2a) ist damit kein Thema mehr                                                              |
| Team-Anmerkungen | **Immer sichtbar** für alle, die die Person sehen dürfen – Personen-Dateien lassen sich per API nicht verstecken (§2b). Von Alwin für Zeichnungen hingenommen; die Anleitung sagt es offen                     |
| Branding         | Gemeindename aus `GET /api/info` (`siteName`, ohne Anmeldung). Logo: nicht über die API gefunden                                                                                                               |

## 2a. Ergebnisse Spike #333 (gemessen 07.10.2026)

Test-Instanz, ChurchTools 3.137.1. Testmodul `ecg-musik-test` per API angelegt
(`POST /api/custommodules` – verlangt `inMenu`), zwei Kategorien („Benutzerdaten", „Team"), dazu die
Person „Spike Musiker" **ohne Adminrechte**. Gemessen mit deren eigenem Login-Token, nicht mit dem
Admin-Konto.

| Frage                                           | Ergebnis                                                                                                                                                                         |
| ----------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Darf ein Nicht-Admin Werte schreiben und lesen? | **Ja**, mit den Rechten „Daten in Kategorie sehen / erstellen / bearbeiten / löschen" – vergeben **je Kategorie**                                                                |
| Ist ein Eintrag vor anderen geschützt?          | **Nein.** Spike überschrieb den Wert des Admins (200). Wer eine Kategorie bearbeiten darf, darf **jeden** Eintrag darin ändern und löschen                                       |
| Gibt es eine Zuordnung zur Person?              | **Nein.** `domainId`/`domainType` werden angenommen und **stillschweigend verworfen** – gespeichert sind nur `id`, `dataCategoryId`, `value`. Die Person muss **im Wert** stehen |
| Gibt es einen gemeinsam beschreibbaren Wert?    | **Ja** – jede Kategorie ist gemeinsam; eine Kategorie „Team" genügt                                                                                                              |
| Braucht ein Musiker „Kategorien sehen"?         | **Ja.** Ohne das Recht liefert die Kategorienliste **200 mit leerer Liste** – kein Fehler. Die IDs unterscheiden sich je Installation, also muss die App sie finden können       |
| Muss ein Musiker Kategorien anlegen dürfen?     | **Nein** – und er soll es nicht. Die Kategorien legt die Gemeinde (oder der erste Start durch einen Admin) an                                                                    |
| Antwort bei fehlendem Recht                     | **401** mit „Die Session ist abgelaufen" – obwohl die Sitzung gültig ist. ⚠️ Darf in der Extension **nicht** als „abgemeldet" gelten                                             |
| Termine, Ablauf, Dienste lesbar?                | **Ja** (mit den üblichen Events-Rechten)                                                                                                                                         |
| ChordPro-Datei hoch- und herunterladen?         | **Ja.** Herunterladen über die `fileUrl` nur **mit Sitzungs-Cookie** – der Login-Token-Header endet in einer Weiterleitungsschleife. Im Browser unter `/ccm/` ist das Cookie da  |
| Gemeindename über die API?                      | **Ja**, `GET /api/info` → `siteName`, sogar ohne Anmeldung                                                                                                                       |
| Fremde Login-Token als Admin abrufbar?          | **Nein** (403) – ein Testkonto braucht einen von Hand erzeugten Token                                                                                                            |

**Folgen für die Phasen** (Stand nach §2a – für den Speicher **überholt durch §2b**, die Lehren zu 401 und
zur leeren Liste gelten weiter für jeden Aufruf):

- **Fehler in der Vorlage von bwl21:** Ihr `readUserValues` filtert auf `domainId === personId` – das
  Feld kommt nie zurück, die Extension fände ihre eigenen gespeicherten Werte **nie wieder**. Phase 2
  (#334) muss die Person in den Wert schreiben.
- **Eigene Einträge nur über die eigene Person ändern:** `ctStore` liest vor dem Ändern, ob der Eintrag
  dieselbe Person trägt. Das ist kein Schutz gegen Absicht (ChurchTools lässt es zu), aber gegen Versehen.
- **Kategorien nie automatisch anlegen, wenn der Nutzer kein Recht dazu hat** – die leere Liste ist
  kein Zeichen für „gibt es nicht", sondern oft für „darf ich nicht sehen". Ein Anlegeversuch endet
  im 401 „Session abgelaufen".
- **Installationsanleitung (#337)** nennt den kleinsten Rechte-Satz für Musiker: Modul sehen,
  Kategorien sehen, Daten sehen/erstellen/bearbeiten/löschen – und offen den fehlenden Schutz je Eintrag.

**Browser-Teil** – eine Probeseite (nicht im Repo) als ZIP in das per API angelegte Modul geladen
(Administration → Erweiterungen → Stift beim Modul → ZIP-Datei), geöffnet als Admin und als Spike:

| Frage                                       | Ergebnis                                                                                                                                                                                                                                                                                                            |
| ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Nimmt ein per API angelegtes Modul ein ZIP? | **Ja.** Das ZIP enthält den Ordner `dist/`; ChurchTools liefert dessen Inhalt unter `/ccm/<Kürzel>/` aus – nur angemeldet, sonst kommt die Login-Seite                                                                                                                                                              |
| `/whoami` ohne eigene Anmeldung             | **Ja**, `id > 0` – als Admin `id 1`, als Spike `id 16`. Der Menüpunkt erscheint auch bei Spike                                                                                                                                                                                                                      |
| `window.settings.base_url`                  | **Gesetzt** (`https://<instanz>/`)                                                                                                                                                                                                                                                                                  |
| Schreiben aus dem Browser                   | **Ja** (201) mit der Sitzung der Seite. Ging auch **ohne** `CSRF-Token`-Header – die App schickt ihn trotzdem mit (der offizielle Client tut es)                                                                                                                                                                    |
| Kleinster Rechte-Satz für Musiker           | **Belegt:** Modul sehen + **Kategorien sehen** + Daten sehen/erstellen/bearbeiten/löschen (je Kategorie). Ohne „Kategorien sehen" findet die Seite den Bereich nicht (200, leer)                                                                                                                                    |
| ⚠️ Einbettung                               | ChurchTools übernimmt **nur den Inhalt** der `index.html` in die eigene Seite und setzt `<base href="https://<instanz>/">`. Folgen: (1) **relative Pfade zeigen ins Leere** – alles absolut unter `/ccm/<Kürzel>/` (Vite `base`); (2) `<style>` im Kopf **fällt weg** – CSS als Datei einbinden und am Gerät prüfen |
| CSP der Seite                               | `script-src 'self'` + Nonce – **kein Inline-Script**; Skripte als Datei. `connect-src *`, `img-src *`                                                                                                                                                                                                               |

## 2b. Messung für #334: Wertgröße und Personen-Dateien (07.10.2026)

Beim Zuschnitt von Phase 2 gemessen (Test-Instanz, danach abgeräumt). Anlass: Die Zeichnungen speichert
die App als **PNG-Bild** (`toDataURL('image/png', 0.7)`), nicht als Strichliste.

**Custom-Module-Daten – taugen nicht als Hauptspeicher:**

| Frage                        | Ergebnis                                                                                                                                                                 |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Wie groß darf ein Wert sein? | **Höchstens 10.000 Zeichen** (Zeichen, nicht Bytes) – sonst 400 `validation.length`. Ein Seitenbild passt nicht hinein                                                   |
| Lässt sich gezielt laden?    | **Nein.** `GET …/customdatavalues` ignoriert `limit`, `page`, `ids[]` und Wertfilter; ein Einzel-GET antwortet 405. Man lädt immer die **ganze Kategorie aller Musiker** |

**Personen-Dateien** (`/files/person/<id>`) – gemessen mit einem Konto, das **nur Mitglieds-Rechte** hatte
(der Status „Mitglied" bringt dort „Eigene Personendaten bearbeiten" mit):

| Frage                                      | Ergebnis                                                                                                                                                        |
| ------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| An sich selbst hochladen?                  | **Ja** (200); 300 KB problemlos                                                                                                                                 |
| Gezielt laden?                             | **Ja** – `GET /files/person/<id>` listet nur die Dateien dieser Person; Herunterladen über die `fileUrl` mit Sitzungs-Cookie                                    |
| Fremde Dateien ändern, löschen, anhängen?  | **Nein** – 403 „Forbidden to edit person files". **Schutz je Person**                                                                                           |
| Fremde Dateien lesen?                      | **Ja** – wer die Person sehen darf, sieht und lädt ihre Dateien                                                                                                 |
| Lässt sich das verstecken?                 | **Nein.** `PATCH /files/<id> {securityLevelId}` antwortet **204, ändert aber nichts** (nachgelesen); ein Feld beim Hochladen wird ignoriert. ⚠️ Lügender Erfolg |
| Überschreiben?                             | Gibt es nicht – neue Fassung hochladen, **nachlesen, ob sie da ist**, dann die alte löschen                                                                     |
| Dateien am Modul (`/files/custom_module`)? | **Scheidet aus:** 500 – und die Datei liegt trotzdem da. Diese Domäne gehört dem Erweiterungs-Paket                                                             |

**Nachtrag (07.10.2026):** In der Oberfläche heißen die Personen-Dateien **„Anhänge“** (Person öffnen →
ganz unten „Anhänge >>“); die Liste dort bietet eine **Sicherheitsstufe** zur Auswahl. Ob sich darüber
die Sichtbarkeit einschränken lässt, ist **nicht geprüft** – Kandidat für 3b.

**Entscheidung (Alwin, 07.10.2026): alles als Personen-Dateien.** Ein Speicherweg statt zwei, gezieltes
Laden statt „alle Musiker bei jedem Öffnen", Schutz je Person, und **keine Zusatzrechte** für die
Gemeinde. Der Preis: Ersetzen ist ein Doppelschritt, die Dateien sind bei der Person in ChurchTools
sichtbar, und andere Mitglieder können sie lesen.

## 3. Ausgangslage: der Fork von bwl21

`bwl21/churchtools-musik-app`, Branch `feat/churchtools-extension`, **ein** Commit vom 22.07.2026,
17 Dateien, ausschließlich im Client. Er hat den Weg **bewiesen** – das ist der Wert dieses Forks.
Was er gelöst hat und wir übernehmen:

- `@churchtools/churchtools-client` mit `window.settings.base_url` als Laufzeit-Anbindung.
- `base: /ccm/<VITE_KEY>/` im Vite-Build, Service Worker im Extension-Modus aus.
- Custom-Module-Daten als personenbezogener Speicher (`customdatavalues`, `domainType: 'person'`).
- Packaging: Build + ZIP nach `releases/`.

**Was dort fehlt – und bei uns nicht fehlen darf:**

| Lücke                                                                                      | Folge                                                                 |
| ------------------------------------------------------------------------------------------ | --------------------------------------------------------------------- |
| `markSetlistSeen` gibt im Extension-Modus `{ ok: true }` zurück, **ohne zu speichern**     | Das „Ablauf geändert"-Kennzeichen (#143) geht nie wieder weg          |
| `writeUserValue` liest vor **jedem** Schreiben **alle** Werte des Moduls                   | Genau die Last, die er selbst kritisiert – wächst mit jedem Lied      |
| Keine 429-Notbremse (die aus #300 sitzt im Server)                                         | Fünf Geräte überfahren die CT-Instanz wie im Juli                     |
| Teilen von Anmerkungen, fremde Anmerkungen ansehen, Branding, Update-Check nicht behandelt | Funktionen laufen ins Leere statt sauber wegzufallen                  |
| Stand v2.13.5 (16.07.)                                                                     | v2.14–v2.17 fehlen: Vollbild (#319), Metronom (#145), Härtung #273ff. |

Der Fork wird also **gelesen, nicht gemergt**.

## 4. Architektur: ein Repo, zwei Auslieferungen

Der gemeinsame Anteil ist riesig: Oberfläche, ChordPro-Verarbeitung, Transponieren, PDF-Erzeugung,
Zeichnen, Zoom, Blättern. Unterschiedlich ist einzig, **woher die Daten kommen**.

Ein zweites Repo hieße, jeden Fix am Liedblatt zweimal einzubauen. **Der Beweis liegt vor:** der Fork
ist nach drei Wochen vier Minor-Versionen zurück. Das ist die Fehlerklasse „dieselbe Regel an zwei
Stellen, Korrektur nur an einer" – in diesem Projekt schon dreimal teuer bezahlt (siehe `CLAUDE.md`).

**Die Weiche steht ausschließlich in der Service-Schicht.** Erfreulicher Befund der Voruntersuchung:
alle betroffenen Aufrufe liegen dort schon heute gebündelt –
`client/src/services/churchtoolsApi.ts`, `teamNotes.ts`, `siteConfigApi.ts`, `updateApi.ts`,
`annotations.ts`, `userSettings.ts`, `offline.ts`. Keine Komponente ruft `/api/...` direkt auf.

```
                     ┌───────────────────────────────┐
   Komponenten  ───► │  Service-Schicht (die Weiche) │ ───► ChurchTools direkt   (Extension)
   Hooks, UI         └───────────────────────────────┘ ───► eigener Server /api  (PWA/NAS)
   (kennen den Modus nicht)
```

Neu entstehen dabei:

- `client/src/services/ctRuntime.ts` – Modus-Erkennung + konfigurierter CT-Client (**die einzige
  Stelle, die `import.meta.env.MODE` liest**).
- `client/src/services/personenAblage.ts` – der Speicher in den Personen-Dateien (§2b).
- `client/src/services/ctSetlist.ts` – der Setlist-Aufbau im Browser (heute serverseitig).

## 5. Die fünf Phasen

Jede Phase hat ein Issue: **#333** (Spike) · **#334** (Speicher) · **#335** (CT-Aufrufe) ·
**#336** (Anteasern) · **#337** (Paket/Release). #333 blockiert alle übrigen.

### Phase 1 – Machbarkeits-Spike auf der Test-Instanz (#333)

Klärt die eine Frage, an der der halbe Funktionsumfang hängt. Klein halten: ein Build, ein Upload,
eine Stunde.

- [ ] Minimaler Extension-Build aus dem aktuellen `main`, eigener Key (z. B. `ecg-musik-test`)
- [ ] Custom Module in der Test-Instanz anlegen, ZIP hochladen, Menüpunkt öffnen
- [ ] Belegen – jeweils am **Netzwerk-Mitschnitt**, nicht am Gefühl:
  - [ ] `/whoami` liefert ohne eigene Anmeldung den angemeldeten Nutzer
        ⚠️ Prüfen heißt hier: **`id > 0`**, nicht „hat geantwortet". Ohne gültige Session antwortet
        ChurchTools mit 200 und `{"id":-1,"lastName":"Anonymous"}` (#381, gemessen 03.09.2026).
  - [ ] Rechte lesbar (`/permissions/global`)
  - [ ] Termine, Ablauf und eine ChordPro-Datei ladbar
  - [ ] **Ein Wert in den Custom-Module-Daten schreib- und lesbar mit einem Konto OHNE
        Adminrechte** ← die Kernfrage; mit deinem Admin-Konto beweist sie nichts
  - [ ] Gibt es einen **global** (nicht personenbezogen) beschreibbaren Wert? → entscheidet, ob
        „Team-Anmerkungen teilen" überhaupt möglich ist
  - [ ] Liefert ChurchTools Gemeindename/Logo über die API? → entscheidet über das Branding
- [ ] Ergebnisse als Entscheidungstabelle in §2 dieses Plans nachtragen

**Wenn normale Nutzer nicht schreiben dürfen**, fallen Anmerkungen und persönliche Einstellungen in
der Extension weg. Dann ist die Extension eine **Ansicht** – immer noch nützlich, aber ein anderes
Produkt. Deshalb steht diese Prüfung vor allem anderen.

### Phase 2 – `personenAblage`: der Speicher (#334)

Zugeschnitten nach der Messung in §2b.

- [x] `personenAblage.ts` als **einzige** Stelle, die Personen-Dateien liest und schreibt
- [x] Zeichnungen: **ein Bild je Seite**, Dateiname aus dem Server-Schlüssel (`shared/keys`, keine zweite
      Grammatik); Einstellungen, Zoom, Textnotizen und „gesehen": **eine** JSON-Datei je Person
- [x] **Dateiliste einmal laden, danach im Speicher halten** – vor dem Schreiben wird nicht neu gelistet
      (nur danach, zum Nachlesen); das regelmäßige Holen liest sie frisch
- [x] **Ersetzen = hochladen → nachlesen → alte löschen.** Gelöscht wird erst, wenn die neue Fassung in
      der Liste steht (Lehre 11.08.2026). Liegen mehrere Fassungen da, werden sie Feld für Feld
      zusammengeführt (Bilder: die neueste)
- [x] „Gesehen" speichert wirklich (`merkeGesehen`/`holeGesehen`). **Der Aufruf aus `markSetlistSeen`
      kommt mit Phase 3:** Den Fingerabdruck der Setlist rechnet heute der Server, im Browser erst nach
      #335. Bis dahin gibt es in der Extension keinen Weg dorthin – also auch keine Attrappe
- [x] Fehlendes Recht (401 „Session abgelaufen", 403 von ChurchTools) → `KeinSpeicherRecht`: Abgleich
      aus, Meldung, Merker bleiben – **kein** Abmelden. 401 ohne Person → abgemeldet, 401 mit unklarer
      Antwort und 403 ohne ChurchTools-Rumpf → vorübergehend (#273/#275)
- [x] Tests gegen ein nachgebautes ChurchTools (`ctFake.testutil.ts`); **16 Gegenproben**, jede Härtung
      einzeln zurückgenommen – jede machte mindestens einen Test rot
- [x] **Live gegen die Test-Instanz** (07.10.2026, als Konto ohne Adminrechte, Sitzungs-Cookie wie im
      Browser): Einstellungen, Zeichnung (7,5 KB) samt Zoom und „gesehen" hin und zurück; nach mehrfachem
      Ersetzen lagen genau **ein** Bild und **eine** Daten-Datei an der Person. Danach abgeräumt

### Phase 3 – Die ChurchTools-Aufrufe im Browser (#335)

**Neu zugeschnitten am 07.10.2026** (Alwin): Die Bestandsaufnahme fand rund **45** Aufrufe an den
eigenen Server, davon etwa 20 schreibende – deutlich mehr als gedacht. Deshalb drei Teile.

**Bauregel:** Die Logik des Servers wird nach `shared/ct/` **verschoben**, nicht kopiert. Server und
Extension nutzen dieselben Funktionen; unterschiedlich ist nur der `CtLeser` (Server: Cookie,
Zwischenspeicher, `HttpError`; Browser: Sitzung der Seite, Bremse, `ApiError`).

#### 3a – Lesen (erledigt 07.10.2026, in der Test-Instanz durchgeklickt)

- [x] Ablauf-Aufbau, Fingerabdruck-Text, Diff, Rechte, Retry-After, Zeitfenster, Zwischenspeicher,
      Datei-Adresse und Content-Type-Härtung (#138) in `shared/ct/` bzw. `shared/dateien` – die alten
      Server-Pfade leiten weiter, die Server-Tests laufen unverändert (Gegenprobe: Regel im Kern
      verändert → Server-Tests rot)
- [x] Fingerabdruck: Server `node:crypto`, Browser `crypto.subtle` – dasselbe sha256 (Test vergleicht)
- [x] **Bremse gerätweit** (`ctRuntime`): nach einem 429 keine Anfrage mehr bis `Retry-After` bzw.
      120 s; Zeitgrenzen 15 s/60 s. Die Terminliste **wirft** bei Drosselung als Ganzes statt lückenhaft
      zurückzukommen – gilt seitdem auch für die Server-Variante
- [x] Lesen in `client/src/services/ctLesen.ts`; Weiche in `churchtoolsApi`, `fileDownload`,
      `siteConfigApi`, `updateApi`, `availability`, `teamNotes`, `offline`, `reachability`. Was es noch
      nicht gibt, meldet `ohneServer` (501) ehrlich
- [x] „Gesehen" verdrahtet: `markSetlistSeen` → `merkeGesehen`, „geändert"-Punkte aus `holeGesehen`
- [x] Dokumente über `ladeDokument()` in beiden Auslieferungen (Bilder aus Bytes statt über eine Adresse)
- [x] `npm run build:extension -w client`: `base: /ccm/<VITE_KEY>/`, kein Service Worker,
      Skripte/Styles aus dem Kopf in den Inhalt, ZIP mit `dist/` nach `client/releases/`

**Befunde beim Durchklick** (Test-Instanz, 07.10.2026):

| Befund                                                                                      | Lösung                                                                                  |
| ------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| ChurchTools verbietet Worker aus `blob:` (CSP `child-src * data`) – das Liedblatt hing      | Extension-Build tauscht `./pdfWorker` gegen `pdfWorkerDatei.ts` (Worker als Datei)      |
| Die App liegt **unter** der ChurchTools-Leiste (56 px); `position: fixed` rutschte darunter | `.ct-extension #root { transform }` – der App-Bereich ist Bezugsrahmen                  |
| Logos mit Wurzel-Pfad (`/logo…`) zeigten ins Leere                                          | `import.meta.env.BASE_URL`                                                              |
| Inline-Skripte der `index.html` blockiert (CSP)                                             | Nur der Boot-Hinweis; die App selbst braucht keine                                      |
| Unsere globalen Regeln (`*`, `html`/`body`, `:root`) verbogen die ChurchTools-Menüs (Alwin) | Extension-Build schreibt sie auf `#root` um (`buildHilfen/cssBereich.ts`), Packen prüft |
| Die Erweiterung erscheint **nicht** in der ChurchTools-App (iPhone, Alwin)                  | geht nicht – siehe §7, Punkt 6                                                          |

#### 3b – Schreiben (in Scheiben, Alwin 07.10.2026)

Rund 3.800 Zeilen Server-Logik. Geschnitten in fünf Scheiben, jede ein eigener PR und für sich
nutzbar – nach jeder kann man aufhören. Muster wie beim Lesen: Regeln nach `shared/ct/schreibKern.ts`
(Anschluss `CtSchreiber`), der Server schreibt über `ctWrite.schreibe`, der Browser über
`client/src/services/ctSchreiben.ts` (`ctAnfrage`: Sitzung, CSRF, Bremse, Zeitgrenze).

- [x] **3b-1 Ablauf + Tempo:** Reihenfolge, Punkte anlegen/ändern/löschen, Vorlauf, Tempo speichern.
      Nur offizielle `/api`. Die Regeln (frisch lesen, Rumpf aus dem Ist-Zustand, Reihenfolge-Schutz,
      Standard-Titel, „Aufheben leert den Titel") lagen zum Teil im Controller und stehen jetzt im Kern.
      Das Tempo hat ein **eigenes Recht `canEditTempo`** (dasselbe ChurchTools-Recht wie
      `canEditSongs`, eigens benannt): So geht es in der Extension, während die Liedverwaltung noch
      verborgen ist – und das Tempo-Menü behauptet keine fehlende Berechtigung. **Beim Durchklick
      gefunden:** Die Liedtext-Vorschau (Auge in der Lied-Auswahl) wurde mit dem Bearbeiten erst
      erreichbar und lief ins Leere – jetzt auch in der Extension (`@shared/ct/liedtext`, ein Lied +
      eine Datei, kein Massenlauf)
- [x] **3b-2 Lieder:** Lieder, Arrangements, Versionen, Notenblätter, Dateien, Kategorien, Quellen.
      Regeln in `shared/ct/liedVerwaltung.ts` (Anschluss `CtVerwalter`), `notenblaetter.ts`
      (`CtNotenSchreiber`, Hochladen beim Aufrufer – `shared` kennt kein `FormData`), `stammdaten.ts`
      (Kategorien/Quellen, Rückfall), `altSchnittstelle.ts` (Antwort der alten Schnittstelle). Server
      über `ctVerwalter.ts`. **Gemessen:** `getMasterData` geht aus dem Browser mit CSRF-Token (ohne →
      401). `findeArrangement` ist in `arrangementAus` aufgegangen (eigene Meldung als Parameter).
      **Unterwegs behoben:** Eine Version ändern löschte die alte Datei VOR dem Hochladen der neuen –
      jetzt umgekehrt; der Browser verwarf ein abgelehntes CSRF-Token nie (#298 fehlte dort); bei 429
      fiel der Server bei den Kategorien auf die Liederliste zurück (#300). SongSelect bleibt bis 3b-5
      maskiert (`canUseCcli`)
- [ ] **3b-3 Abwesenheiten** (Gründe ebenfalls über `ctAjax`; Termin-Arten-Filter hängt an 3b-4)
- [ ] **3b-4 Team-Notizen + Gemeinde-Einstellungen:** Wer zählt als Musiker? Die Server-Variante hat
      dafür `site.json` – Vorschlag: die eigenen Daten des Moduls (Custom-Data, §2a). Danach „Notizen
      von …" aus den Personen-Dateien der anderen. Dazu gehört auch `standardAnsicht` (Akkorde/PDF
      zuerst, 07.10.2026) – in der Extension gilt bis dahin nur der automatische Teil
- [ ] **3b-5 SongSelect** (`ctAjax`, braucht `use ccli`)

#### 3c – Massenläufe (entschieden: weglassen)

Lied-Statistik (~250 Anfragen) und Liedtext-Suche (jede Lieddatei) bündelt der Server **einmal für
alle**. Im Browser liefe das **auf jedem Gerät einzeln** – fünf iPads wären fünfmal 250 Anfragen, genau
der Auslöser von #300. **In der Extension weglassen und auf die Server-Variante verweisen** (Phase 4).

### Phase 4 – Was wegfällt, sauber angeteasert (#336) – erledigt 07.10.2026

Siehe §6. Kein toter Knopf, keine Fehlermeldung – ein Satz, der sagt, warum und wohin. Entwurf von
Alwin abgenommen, in der Test-Instanz durchgeklickt.

- [x] **`client/src/services/funktionen.ts`** – was es in dieser Auslieferung gibt (Offline,
      Installieren, Abmelden, Verwaltung, Statistik, Liedtext-Suche, Hinweis). Komponenten fragen
      **diese Flags**, nie den Modus
- [x] **Bearbeiten** über die Rechte: `ctLesen.meineRechte` meldet, was noch fehlt, als `false` –
      die Knöpfe verschwinden von selbst (seit 3b-1 nur noch `canEditSongs`, `canUseCcli`)
- [x] **Der eine Hinweis** (`ServerVarianteHinweis`) unten in „Mehr"; „Mehr erfahren" springt in den
      README-Abschnitt „Für andere Gemeinden"
- [x] Inline-Start-Skript der `index.html` im Extension-Paket entfernt (CSP blockiert es ohnehin)
- [x] **Nachtrag (Alwin, 07.10.2026):** Das Tempo-Menü machte aus dem ausgeschalteten Bearbeiten
      „Dir fehlt die Berechtigung" – falsch. Übergangsweise fragte es `funktionen.schreibenInChurchTools`
      („… speichern kommt noch"); seit 3b-1 speichert die Extension das Tempo selbst, die Angabe ist weg

### Phase 5 – Paket, Anleitung, Release (#337)

- [x] `npm run build:extension -w client` + ZIP-Bau (seit 3a); Kürzel über `VITE_KEY`, **für die
      Verteilung fest `musik-app`** – der Pfad `/ccm/<Kürzel>/` steckt im Build, die Anleitung nennt
      genau dieses Kürzel
- [x] Installationsanleitung `docs/betrieb/ERWEITERUNG.md` (Vergleich mit der Server-Variante,
      Installieren, Rechte, Datenschutz der Personen-Dateien, Aktualisieren, Entfernen); README verweist
      darauf im Abschnitt „Für andere Gemeinden" (dorthin springt auch der Hinweis in der App)
- [x] CI baut **beide** Auslieferungen; der Release-Workflow hängt `musik-app-<Tag>.zip` an das
      GitHub-Release (`fail_on_unmatched_files`)
- [x] `CLAUDE.md`: Weiche nur in der Service-Schicht, Komponenten fragen `funktionen.ts` (seit 3a/4)

## 6. Was in der Extension wegfällt

| Funktion                           | Warum                                                                                                                                                     | Umgang                                                     |
| ---------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| **Für offline speichern** (#32)    | Füllt den **Service-Worker-Cache** mit den PDFs/Bildern. Unter `/ccm/…` liefert CT die Seite aus – ein eigener Service Worker ist dort bestenfalls fragil | Knopf entfällt, Hinweis auf Server-Variante                |
| **Team-Anmerkungen teilen**        | Personen-Dateien sind für Mitglieder **immer** lesbar (§2b) – ein Schalter „teilen" könnte nichts verbergen                                               | Schalter entfällt; Hinweis, dass Zeichnungen sichtbar sind |
| **Fremde Anmerkungen ansehen**     | Die Dateien der anderen sind lesbar (§2b)                                                                                                                 | **Bleibt** – aus den Personen-Dateien                      |
| **Update-Hinweis**                 | Ohne Service Worker kein Update-Balken; ein Hinweis in „Mehr“ braucht nur die neueste Version                                                             | Bleibt: Der Browser fragt GitHub selbst (#337, Alwin)      |
| **Branding** (Gemeindename/Logo)   | Kein `site.json` ohne Server                                                                                                                              | Name aus `GET /api/info`; Logo nicht in der API (§2a)      |
| **Login-Bildschirm, Rate-Limit**   | Die Anmeldung macht ChurchTools                                                                                                                           | Entfällt – ein Gewinn                                      |
| **Lied-Statistik, Liedtext-Suche** | Massenläufe – im Browser je Gerät statt einmal für alle (#300)                                                                                            | Weglassen, Hinweis auf Server-Variante (3c)                |

**Der Teaser** (eine Formulierung, an einer Stelle, nicht sechs verschiedene): kurz, ohne
Werbeton, mit Verweis darauf, dass es die App auch mit eigenem Server gibt und wo man fragen kann.

## 7. Risiken & offene Fragen

1. **Schreibrechte für normale Nutzer** – **geklärt 07.10.2026 (§2a, §2b):** Personen-Dateien gehen mit
   Mitglieds-Rechten, geschützt je Person. **Annahme:** Das Recht „Eigene Personendaten bearbeiten" kam
   auf der Test-Instanz über den Status „Mitglied" – bei anderen Gemeinden kann es fehlen. Die App muss
   das freundlich melden, die Anleitung (#337) es nennen.
2. **Last auf der CT-Instanz.** Ohne Server-Bündelung geht jede Anfrage direkt von jedem Gerät an CT.
   #300 hat gezeigt, dass das eine Instanz lahmlegen kann. Die Notbremse ist **Pflicht**, kein Extra.
3. **Für die ECG bedeutet Extension: im Saal ohne Netz keine Liedblätter.** Muss jetzt nicht
   entschieden werden – die NAS-App läuft weiter –, kommt aber am Ende auf den Tisch.
4. **Zwei Datenwelten.** Anmerkungen der Extension liegen in ChurchTools, die der PWA auf dem NAS.
   Es wird **nichts migriert**. Wer wechselt, fängt bei den Anmerkungen neu an. Bewusst so.
5. **Doppelte Arbeit mit bwl21.** Er baut parallel. **Entschieden (Alwin, 07.10.2026):** Wir schicken
   den Plan nicht vorab, sondern bauen unsere Fassung fertig und zeigen sie ihm danach.
6. **Nicht in der ChurchTools-App (geklärt 07.10.2026).** Erweiterungen haben nur Einbaustellen im
   **Web** (`churchtools/churchtools-extension-points`: Hauptmenü, Admin, Finanz-Reiter, Termin-Dialog);
   die native App kennt sie nicht (Forum 2021, ChurchTools-Mitarbeiter: „nicht in der App möglich").
   Getestet: Ein Link im Startseiten-Widget „Links" (seit CT 3.125) öffnet am iPhone nur den Browser.
   **Folge:** Für die ECG bleibt die PWA der Weg (Homescreen, offline, angemeldet). Die Extension ist
   für Gemeinden ohne eigenen Server gedacht – dort im Browser bzw. am iPad über ChurchTools. Alwin
   hat trotzdem entschieden, sie fertig zu bauen (Phase 4/5, 3b danach).

## 8. Verifikation

- Beide Auslieferungen durch **dieselbe** Testsuite; Lint/Build/Tests am **Exit-Code** prüfen.
- Die Extension in der Test-Instanz **durchklicken** – die Lehre aus #283: 672 grüne Tests und eine
  kaputte Bedienung sind kein Widerspruch.
- Manuelle Testfälle (`docs/tests/README.md`) um die Extension-Fälle ergänzen; die weggefallenen
  Funktionen dort als „nur Server-Variante" kennzeichnen.
