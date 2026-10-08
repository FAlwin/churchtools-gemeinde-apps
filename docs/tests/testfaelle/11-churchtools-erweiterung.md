# ChurchTools-Erweiterung

Dieselbe App, als Erweiterung direkt in ChurchTools (Plan: `docs/entwicklung/plan-extension.md`).
Getestet wird in der **Test-Instanz**, nie in der Live-Instanz der Gemeinde. Das Paket baut
`npm run build:extension -w client` (mit `VITE_KEY` = Kürzel des Moduls); hochladen unter
**Administration → Erweiterungen → Stift beim Modul → ZIP-Datei**.

### TF-EXT-01 · Erweiterung öffnen, Ablauf und Liedblatt ansehen

**Das brauchst du:** In der Test-Instanz ein Modul (z. B. „Musik App (Test)", Kürzel
`musik-app-test`) mit dem aktuellen Paket, einen Gottesdienst mit Ablauf und ein Lied mit
ChordPro-Datei.

**Das muss passieren:** Du bist ohne eigene Anmeldung drin. Termine, Ablauf und Liedblatt erscheinen
**unter** der ChurchTools-Leiste – kein Fenster rutscht darunter. Das Liedblatt zeigt Akkorde und Text
(es bleibt nicht bei „Lieder werden vorbereitet…" hängen).

1. In ChurchTools im Menü auf **Musik App (Test)** tippen.
2. Bei **Termine** einen Gottesdienst öffnen (alte Termine: **Vergangene** → **Mehr laden**).
3. Ein Lied im Ablauf antippen – das Liedblatt erscheint.
4. Unten auf **Lieder**: Die Liste zeigt die Lieder der Gemeinde. Beim Stift an einem Lied öffnet sich
   ein Fenster – es beginnt unter der ChurchTools-Leiste, die nicht abgedunkelt wird.
5. Unten auf **Mehr**: Oben steht der Name der Gemeinde aus ChurchTools.

<details><summary>Technisches</summary>

- **Priorität:** hoch
- **Betrifft:** `client/src/services/ctLesen.ts`, `client/src/services/ctRuntime.ts`, `client/src/services/modus.ts`, `client/src/pdfSetup.ts`, `client/src/pdfWorkerDatei.ts`, `client/src/styles/main.scss`, `client/vite.config.ts`, `shared/ct/setlistKern.ts`
- **Automatisiert:** teilweise – `ctLesen.test.ts` und `ctRuntime.test.ts` gegen ein nachgebautes
  ChurchTools; was nur in der echten Einbettung auffällt (CSP, `<base href>`, Kopf verworfen, Leiste
  von 56 px), prüft nur dieser Fall
- **Historie:** #335 (Durchklick 07.10.2026: blob-Worker von der CSP blockiert, Vollbild-Fenster unter
  der Leiste – beides behoben)

</details>

### TF-EXT-02 · Anmerkungen wandern über ChurchTools auf ein anderes Gerät

**Das brauchst du:** TF-EXT-01 auf zwei Geräten (oder zwei Browsern) mit demselben Konto.

**Das muss passieren:** Was du auf Gerät A malst, siehst du auf Gerät B nach dem Öffnen desselben
Lieds. In ChurchTools hängt an deiner Person unter **Anhänge** je bemalter Seite **ein** Bild
`musikapp_….png` und **eine** Datei `musikapp_daten.json` – auch nach mehrmaligem Ändern nicht mehr.

1. Gerät A: Liedblatt öffnen, oben auf den **Stift**, etwas malen, den Stift wieder schließen.
2. Gerät B: dasselbe Lied öffnen.
3. Gerät A: noch etwas dazumalen. Gerät B: Lied neu öffnen.
4. In ChurchTools oben im Menü **Personen** (nicht „Mein Profil“), dich in der Liste anklicken, in der
   aufgeklappten Ansicht ganz unten **„Anhänge >>“**.

<details><summary>Technisches</summary>

- **Priorität:** hoch
- **Betrifft:** `client/src/services/personenAblage.ts`, `client/src/services/annotations.ts`, `client/src/services/userSettings.ts`
- **Automatisiert:** teilweise – `personenAblage.test.ts` (16 Gegenproben); der Weg über die echte
  Einbettung nur hier
- **Historie:** #334, #335

</details>

### TF-EXT-03 · Was es in der Erweiterung nicht gibt, ist nicht zu sehen

**Das brauchst du:** TF-EXT-01, mit einem Admin-Konto (dann sähe man am meisten).

**Das muss passieren:** Kein Knopf führt ins Leere. Unter **Mehr** gibt es kein „Als App
installieren", keinen Bereich „Offline" und kein „Abmelden" – dafür unten den Hinweis „Erweiterung für
ChurchTools" mit **Mehr erfahren**. In der **Verwaltung** fehlen „Organisation / Name" und
„Abwesenheiten: Termin-Arten" (der Rest: TF-EXT-06, TF-EXT-07). Bei **Lieder** gibt es keine Reiter
„Häufigkeit/Zuletzt", und ein langer Suchbegriff bietet keine Suche im Liedtext an. Bei den Terminen
fehlt das Wolken-Symbol „Für offline speichern". (Ablauf und Tempo gibt es seit 3b-1 – TF-EXT-04; Lieder
verwalten seit 3b-2 – TF-EXT-05.)

1. Unten auf **Mehr**, ganz nach unten scrollen, auf **Mehr erfahren** tippen – es öffnet sich die
   Projektseite beim Abschnitt „Für andere Gemeinden".
2. Unten auf **Lieder**, in die Suche einen Satz aus einem Lied tippen.
3. Unten auf **Termine**: kein Wolken-Symbol an den Gottesdiensten.

<details><summary>Technisches</summary>

- **Priorität:** normal
- **Betrifft:** `client/src/services/funktionen.ts`, `client/src/components/ServerVarianteHinweis.tsx`, `client/src/pages/Settings.tsx`, `client/src/services/ctLesen.ts`
- **Automatisiert:** teilweise – `Settings.extension.test.tsx` (Mehr) und `ctLesen.test.ts`
  (Liedverwaltung aus); Lieder, Suche und Termine nur hier
- **Historie:** #336; #335 (3b-1: Tempo-Menü und „Ablauf bearbeiten" nach TF-EXT-04 gewandert; 3b-2:
  Liedverwaltung nach TF-EXT-05; 3b-4a: Verwaltung nach TF-EXT-06)

</details>

### TF-EXT-04 · Ablauf bearbeiten und Tempo speichern in der Erweiterung

**Das brauchst du:** TF-EXT-01 mit einem Konto, das in ChurchTools den Ablauf bearbeiten und Lieder
bearbeiten darf, und einen **Test-Gottesdienst** mit Ablauf und mindestens einem Lied.

**Das muss passieren:** Jede Änderung steht danach **auch in ChurchTools** (Ablauf dort neu laden) –
mit derselben Reihenfolge, denselben Liedern und unveränderter Verantwortlichkeit. Ein Lied-Punkt
bleibt ein Lied (er wird nicht zu einem Textpunkt). Das gespeicherte Tempo steht in ChurchTools am
Arrangement, **Tonart und Dauer des Arrangements sind unverändert**.

1. Gottesdienst öffnen, **Ablauf bearbeiten**: zwei Punkte per Ziehen vertauschen, fertig.
2. **Neuer Eintrag** → **Lied verknüpfen**: beim Lied das **Auge** antippen – der Liedtext erscheint
   (kein „gibt es noch nicht"). Dann das Lied übernehmen und den Eintrag anlegen.
3. Einen Punkt antippen, die Notiz ändern, speichern.
4. Einen Punkt antippen, **Vor Gottesdienstbeginn** einschalten, speichern – er und alle darüber
   rutschen in den Vorlauf.
5. Den neuen Punkt wieder löschen.
6. Ein Lied öffnen, oben das **Metronom**, ein anderes Tempo einstellen, **… in ChurchTools speichern**.
7. In ChurchTools den Ablauf und das Lied ansehen.

<details><summary>Technisches</summary>

- **Priorität:** hoch
- **Betrifft:** `client/src/services/ctSchreiben.ts`, `shared/ct/schreibKern.ts`, `shared/ct/liedtext.ts`, `shared/ct/agendaPayload.ts`, `shared/ct/arrangementPayload.ts`, `client/src/services/ctRuntime.ts`, `client/src/components/TempoMenu.tsx`
- **Automatisiert:** teilweise – `ctSchreiben.test.ts` gegen ein nachgebautes ChurchTools (Rümpfe
  gegen die Erzeuger, Fehlerzweige einzeln); ob ChurchTools die Rümpfe aus dem Browser genauso annimmt
  wie vom Server, nur hier
- **Historie:** #335 (3b-1)

</details>

### TF-EXT-05 · Lieder, Arrangements, Notenblätter und Dateien in der Erweiterung

**Das brauchst du:** TF-EXT-01 mit einem Konto, das Lieder bearbeiten darf (in mindestens einer
Kategorie), eine kleine PDF-Datei. Alles, was du anlegst, am Ende wieder löschen.

**Das muss passieren:** Jede Änderung steht danach **auch in ChurchTools** (Lied dort öffnen). Die
Auswahl der Kategorie zeigt nur die, in denen du Lieder bearbeiten darfst. Kein Knopf führt ins Leere;
SongSelect ist nirgends zu sehen.

1. **Lieder** → **Neues Lied**: Name, Kategorie, Tonart → anlegen. Das Lied öffnet sich.
2. Ein zweites Lied mit **derselben CCLI-Nummer** wie ein vorhandenes anlegen → die App lehnt ab.
3. Am Lied über den Stift die **Stammdaten** ändern (Autor) → gespeichert.
4. **Arrangements**: ein zweites anlegen, zum **Standard** machen, das alte löschen. Eine Liednummer
   ohne Liederbuch → die App sagt, dass erst das Liederbuch nötig ist.
5. **Notenblatt bearbeiten** (Original) → speichern. Dann **Neue Version…** anlegen, umbenennen,
   löschen. In ChurchTools liegt danach je Version genau eine Datei.
6. **Dateien**: die PDF hochladen, herunterladen, löschen.
7. Das Lied löschen.

<details><summary>Technisches</summary>

- **Priorität:** hoch
- **Betrifft:** `client/src/services/ctSchreiben.ts`, `client/src/services/ctLesen.ts`, `client/src/services/ctRuntime.ts`, `shared/ct/liedVerwaltung.ts`, `shared/ct/notenblaetter.ts`, `shared/ct/stammdaten.ts`, `shared/ct/altSchnittstelle.ts`
- **Automatisiert:** teilweise – die Regeln über die Server-Tests (laufen durch den Kern),
  `ctSchreiben.lieder.test.ts` für den Weg des Browsers (alte Schnittstelle, Upload, CSRF); ob
  ChurchTools Upload und alte Schnittstelle aus der Einbettung genauso annimmt, nur hier
- **Historie:** #335 (3b-2)

</details>

### TF-EXT-06 · Gemeinde-Einstellungen in der Erweiterung

**Das brauchst du:** TF-EXT-01 mit einem Admin-Konto, dazu ein zweites Konto **ohne** Admin-Rechte
(ein Musiker) und ein Lied mit PDF und ChordPro in ChurchTools.

**Das muss passieren:** Was der Admin unter **Mehr → Verwaltung** einstellt, steht danach in ChurchTools
und gilt auf jedem Gerät – auch für den Musiker, sobald seine Gruppe die Kategorie sehen darf. Ohne
dieses Recht bekommt der Musiker „Akkorde", aber keine Fehlermeldung.

1. Als Admin unter **Mehr → Verwaltung → Liedblatt: Standard-Ansicht** auf **PDF zuerst** stellen →
   **Speichern**. Unter **Links verwalten** einen Link anlegen → **Speichern**.
2. Seite neu laden: Der Link steht unter **Weitere Angebote**, die Standard-Ansicht zeigt „PDF zuerst".
3. Als Musiker die Erweiterung öffnen, das Lied öffnen → es zeigt die **Akkorde** (Recht fehlt noch).
4. Unter **Berechtigungen** der Gruppe des Musikers für die Musik App „view custom category" und „view
   custom data" für „Einstellungen der Musik App" geben. Als Musiker neu laden, ein anderes Lied mit PDF
   öffnen → es zeigt das **PDF**.
5. Den Link als Admin wieder löschen und die Standard-Ansicht zurückstellen.

<details><summary>Technisches</summary>

- **Priorität:** hoch
- **Betrifft:** `client/src/services/ctEinstellungen.ts`, `client/src/services/ctLesen.ts`, `client/src/services/siteConfigApi.ts`, `client/src/components/VerwaltungZeilen.tsx`, `shared/ct/einstellungen.ts`
- **Automatisiert:** teilweise – `ctEinstellungen.test.ts` (Anlegen, Ändern, Nachlesen, fremde Werte,
  fehlendes Recht, vorübergehender Fehler, Prüfung beim Lesen), `Settings.extension.test.tsx` (welche
  Zeilen); ob die Rechte in ChurchTools so greifen, nur hier
- **Historie:** #335 (3b-4a)

</details>

### TF-EXT-07 · Team-Notizen in der Erweiterung

**Das brauchst du:** TF-EXT-06, ein Admin-Konto und ein zweites Konto (Musiker), beide **aktive
Mitglieder** einer Gruppe mit einer Rolle; der Musiker mit Rechten für Lieder (Bereich Events) und auf
„Team-Notizen der Musik App" mit „view custom category", „view custom data", „create custom data" und
„delete custom data". Ein Lied mit ChordPro.

**Das muss passieren:** Wer teilt, dessen Anmerkungen sieht der andere im Lied unter „Notizen von …" –
an derselben Stelle, in der Ansicht der teilenden Person. Wer nicht (mehr) teilt, taucht dort nicht auf.

1. Als Admin unter **Mehr → Verwaltung → Anmerkungen** die Gruppe wählen und die Rolle freigeben →
   **Speichern**. Unter **Mehr** erscheint „Team-Notizen" mit „Meine Anmerkungen teilen".
2. Als Musiker die Erweiterung öffnen, **Meine Anmerkungen teilen** einschalten, das Lied öffnen und
   etwas zeichnen.
3. Als Admin dasselbe Lied öffnen → Knopf **Notizen von …** → den Musiker antippen: Seine Striche stehen
   auf dem Blatt.
4. Als Musiker das Teilen ausschalten. Als Admin das Lied neu öffnen → der Musiker steht nicht mehr unter
   „Notizen von …".
5. Eine Person ohne Mitgliedschaft (oder mit nicht freigegebener Rolle) sieht unter **Mehr** keine
   „Team-Notizen".

<details><summary>Technisches</summary>

- **Priorität:** hoch
- **Betrifft:** `client/src/services/ctTeilen.ts`, `client/src/services/personenAblage.ts`, `client/src/services/ctModulDaten.ts`, `client/src/services/ctLesen.ts`, `client/src/services/teamNotes.ts`, `shared/ct/gruppen.ts`
- **Automatisiert:** teilweise – `ctTeilen.test.ts` (Verzeichnis, Reihenfolge, Gegenprüfung an der
  eigenen Datei, Name, ohne Zoom, Recht aus Gruppe/Rolle), `siteConfigApi.extension.test.ts` (Admin
  legt das Verzeichnis an); ob die Rechte in ChurchTools so greifen und die Striche richtig liegen, nur
  hier
- **Historie:** #335 (3b-4b)

</details>

### TF-EXT-09 · Ohne Rechte für Lieder und Abläufe: klarer Hinweis

**Das brauchst du:** Ein Konto, das den Menüpunkt der Musik App sehen darf, aber im Bereich **Events**
weder „Lieder sehen" (`view songcategory`) noch „Abläufe sehen" (`view agenda`) hat.

**Das muss passieren:** Nach ein paar Sekunden (die App versucht es erst automatisch erneut) steht da:
„Dir fehlen in ChurchTools die Rechte für Lieder und Abläufe. Bitte frag die Verantwortlichen deiner
Gemeinde." – mit Schloss und „Erneut versuchen". NICHT „Berechtigungen konnten nicht geladen werden".

1. Mit diesem Konto die Erweiterung öffnen und warten.
2. In ChurchTools „Lieder sehen" für eine Kategorie geben, in der App **Erneut versuchen** → die App
   öffnet sich mit dem Tab „Lieder".
3. Gilt genauso in der Server-Variante (Anmeldung mit einem solchen Konto).

<details><summary>Technisches</summary>

- **Priorität:** normal
- **Betrifft:** `shared/ct/rechte.ts`, `client/src/services/churchtoolsApi.ts`, `client/src/App.tsx`
- **Automatisiert:** teilweise – `churchtools.test.ts` (echte Antwort vs. leere, an der gemessenen Form),
  `churchtoolsApi.rechte.test.ts` (Fehlertyp); der Text im Fehlerschirm nur hier
- **Historie:** #444

</details>
