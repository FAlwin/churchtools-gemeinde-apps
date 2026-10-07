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
4. In ChurchTools: **Personen** → dich selbst öffnen → ganz unten **„Anhänge >>“** anklicken.

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
Suchbegriff bietet keine Suche im Liedtext an. Im Ablauf fehlt „Ablauf bearbeiten", bei den Terminen
das Wolken-Symbol „Für offline speichern". Im Tempo-Menü eines Liedblatts steht „In der Erweiterung
gilt das Tempo nur hier – in ChurchTools speichern kommt noch", **ohne** Speichern-Knopf – und nicht
„fehlt dir die Berechtigung" (gemeldet von Alwin am 07.10.2026).

1. Unten auf **Mehr**, ganz nach unten scrollen, auf **Mehr erfahren** tippen – es öffnet sich die
   Projektseite beim Abschnitt „Für andere Gemeinden".
2. Unten auf **Lieder**, in die Suche einen Satz aus einem Lied tippen.
3. Unten auf **Termine**, einen Gottesdienst öffnen, ein Lied antippen, oben das **Metronom**-Symbol.

<details><summary>Technisches</summary>

- **Priorität:** normal
- **Betrifft:** `client/src/services/funktionen.ts`, `client/src/components/ServerVarianteHinweis.tsx`, `client/src/pages/Settings.tsx`, `client/src/services/ctLesen.ts`, `client/src/components/TempoMenu.tsx`
- **Automatisiert:** teilweise – `Settings.extension.test.tsx` (Mehr), `TempoMenu.extension.test.tsx`
  und `ctLesen.test.ts` (Bearbeiten aus); Lieder, Suche und Termine nur hier
- **Historie:** #336

</details>
