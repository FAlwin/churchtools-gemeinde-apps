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
installieren", keinen Bereich „Offline", keine Verwaltung und kein „Abmelden" – dafür unten den Hinweis
„Erweiterung für ChurchTools" mit **Mehr erfahren**. Bei **Lieder** gibt es keine Reiter
„Häufigkeit/Zuletzt", kein „Neues Lied", keinen Stift und kein Plus am Lied, und ein langer
Suchbegriff bietet keine Suche im Liedtext an. Bei den Terminen fehlt das Wolken-Symbol „Für offline
speichern". (Ablauf bearbeiten und Tempo speichern gibt es seit 3b-1 – siehe TF-EXT-04.)

1. Unten auf **Mehr**, ganz nach unten scrollen, auf **Mehr erfahren** tippen – es öffnet sich die
   Projektseite beim Abschnitt „Für andere Gemeinden".
2. Unten auf **Lieder**, in die Suche einen Satz aus einem Lied tippen.
3. Unten auf **Termine**: kein Wolken-Symbol an den Gottesdiensten.

<details><summary>Technisches</summary>

- **Priorität:** normal
- **Betrifft:** `client/src/services/funktionen.ts`, `client/src/components/ServerVarianteHinweis.tsx`, `client/src/pages/Settings.tsx`, `client/src/services/ctLesen.ts`
- **Automatisiert:** teilweise – `Settings.extension.test.tsx` (Mehr) und `ctLesen.test.ts`
  (Liedverwaltung aus); Lieder, Suche und Termine nur hier
- **Historie:** #336; #335 (3b-1: Tempo-Menü und „Ablauf bearbeiten" nach TF-EXT-04 gewandert)

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
