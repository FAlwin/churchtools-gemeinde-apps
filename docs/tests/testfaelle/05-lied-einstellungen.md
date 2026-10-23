# Tonart, Kapo und Darstellung

Zwei Menüs, die hier immer wieder vorkommen:

- **Lied-Menü** – oben auf den **Liedtitel** tippen. Darin: Tonart, Kapo, Version, Transponieren.
- **Darstellung** – oben rechts **Werkzeuge → Aussehen**. Darin: Schriftgröße und Spalten.

### TF-EINST-01 · Tonart und Kapo ändern

**Das muss passieren:** Nach Schritt 3 stehen **alle** Akkorde zwei Halbtöne höher – auch geteilte
wie `E/G#`. Nach Schritt 5 zeigt die Kopfzeile Tonart **und** Kapo an, und die Griffe sind
entsprechend verschoben.

1. Ein Lied öffnen.
2. Oben auf den **Liedtitel** tippen.
3. Auf **Transponieren** tippen, im Fenster „Tonart wählen" eine Tonart zwei Halbtöne höher wählen
   (z. B. von G nach A) und das Menü schließen.
4. Wieder auf den Titel tippen.
5. Bei **Kapo** die 2 wählen und schließen.

<details><summary>Technisches</summary>

- **Priorität:** kritisch
- **Betrifft:** `client/src/pages/ChordChart.tsx`, `client/src/components/SongMenu.tsx`, `client/src/utils/chartSettings.ts`, `client/src/utils/transpose.ts`, `client/src/components/KeyPicker.tsx`, `client/src/components/CapoPicker.tsx`, `client/src/utils/chordPdf.ts`, `client/src/hooks/useSongSettings.ts`, `client/src/utils/activeSongView.ts`, `client/src/components/ChartOverlays.tsx`
- **Automatisiert:** teilweise – `client/src/utils/transpose.test.ts`, `client/src/hooks/useSongSettings.test.tsx`
  und seit #314 `client/src/utils/activeSongView.test.ts` (Kapo wird ABGEZOGEN – „klingt A, Kapo 2 →
  Griff G"; dazu die Info-Zeile im Kopf)
- **Historie:** –

</details>

### TF-EINST-02 · Jede Version hat ihre eigenen Einstellungen

**Das brauchst du:** Ein Lied mit mindestens **zwei Fassungen** – also Original plus eine selbst
angelegte Version (siehe TF-VER-01).

**Das muss passieren:** Bei Schritt 5 stehen **die eigenen, noch unberührten Werte** der zweiten
Version – nicht die vom Original. Nach Schritt 8 sind beim Original Tonart, Kapo 2 und zwei Spalten
**unverändert** da.

Das ist der wichtigste Fall in dieser Datei: Geht er schief, steht im Gottesdienst die falsche
Tonart auf dem Blatt.

1. Ein Lied mit zwei Fassungen öffnen. Sicherstellen, dass **Original** gewählt ist (Liedtitel
   antippen → Version).
2. Tonart um +2 ändern.
3. Kapo auf 2 setzen.
4. Über **Werkzeuge → Aussehen** auf **2 Spalten** stellen.
5. Liedtitel antippen → **Version** → die zweite Fassung wählen. Hinschauen.
6. Dort Kapo auf **4** setzen.
7. Über **Werkzeuge → Aussehen** auf **1 Spalte** stellen.
8. Liedtitel antippen → **Version** → zurück auf **Original**. Hinschauen.

<details><summary>Technisches</summary>

- **Priorität:** hoch
- **Betrifft:** `client/src/pages/ChordChart.tsx`, `client/src/utils/chartSettings.ts`, `client/src/utils/songVersions.ts`, `client/src/hooks/useSongSettings.ts`, `client/src/utils/activeSongView.ts`
- **Automatisiert:** ja – `client/src/hooks/useSongSettings.test.tsx`
- **Historie:** –

</details>

### TF-EINST-03 · Version und PDF gelten fürs ganze Lied

**Das brauchst du:** Ein Lied mit hochgeladenem PDF **und** mit mehreren Fassungen.

**Das muss passieren:** Nach Schritt 4 ist **weiterhin das PDF** zu sehen – es darf nicht zu den
Akkorden zurückspringen. Nach Schritt 6 sind dieselbe Version und wieder das PDF aktiv.

1. Das Lied öffnen.
2. Oben auf den **Liedtitel** tippen.
3. Unter der Liste der Dateien das **PDF** wählen.
4. Wieder auf den Titel tippen → **Version** → die andere Fassung wählen. Hinschauen.
5. Die App schließen und neu öffnen.
6. Dasselbe Lied aufrufen.

<details><summary>Technisches</summary>

- **Priorität:** hoch
- **Betrifft:** `client/src/pages/ChordChart.tsx`, `client/src/utils/chartSettings.ts`, `client/src/utils/songVersions.ts`, `client/src/hooks/useSongSettings.ts`, `client/src/utils/activeSongView.ts`, `client/src/hooks/useChartEditor.ts`
- **Automatisiert:** ja – `client/src/hooks/useSongSettings.test.tsx`
- **Historie:** –

</details>

### TF-EINST-04 · Spalten, Schriftgröße und „Nur Text"

**Das muss passieren:** Zwei Spalten brauchen **weniger** Seiten, größere Schrift **mehr** – die
Seitenzahl unten rechts ändert sich entsprechend. „Nur Text" blendet die Akkorde aus, der Liedtext
bleibt vollständig.

1. Ein mehrseitiges Lied öffnen und die Seitenzahl unten rechts merken.
2. Oben rechts **Werkzeuge → Aussehen → 2 Spalten**. Seitenzahl vergleichen.
3. Dreimal auf **A+** tippen. Seitenzahl vergleichen.
4. Liedtitel antippen → **Nur Text** einschalten.

<details><summary>Technisches</summary>

- **Priorität:** hoch
- **Betrifft:** `client/src/pages/ChordChart.tsx`, `client/src/utils/chartSettings.ts`, `client/src/utils/chordPdf.ts`, `client/src/utils/chartPdfOptions.ts`, `client/src/hooks/useSongSettings.ts`, `client/src/utils/activeSongView.ts`, `client/src/utils/chartPageKeys.ts`
- **Automatisiert:** teilweise – `client/src/utils/chordPdf.test.ts` und seit #314
  `client/src/utils/chartPageKeys.test.ts`: dass „Nur Text" eine EIGENE Notiz-Ebene hat und der
  Wechsel erst mit den sichtbaren Seiten greift (nicht schon beim Umschalten). Von Hand bleibt, dass
  der Umbruch auf dem Gerät gut aussieht.
- **Historie:** –

</details>

### TF-EINST-05 · Nur einen Abschnitt transponieren

**Das muss passieren:** Nur der Refrain steht höher, die Verse bleiben wie sie waren. Nach Schritt 6
ist wieder alles einheitlich.

1. Ein Lied öffnen, oben auf den **Liedtitel** tippen.
2. **Abschnitte transponieren** wählen.
3. Beim **Refrain** auf +2 stellen, die Verse auf 0 lassen.
4. Schließen und das Blatt ansehen.
5. Wieder in **Abschnitte transponieren** gehen.
6. Den Refrain zurück auf **0** stellen und schließen.

<details><summary>Technisches</summary>

- **Priorität:** normal
- **Betrifft:** `client/src/components/SectionTransposeSheet.tsx`, `client/src/utils/chartSettings.ts`, `client/src/pages/ChordChart.tsx`, `client/src/utils/chordPdf.ts`, `client/src/hooks/useSongSettings.ts`, `client/src/components/ChartOverlays.tsx`
- **Automatisiert:** nein
- **Historie:** #16

</details>

### TF-EINST-06 · Einstellungen sind auf dem zweiten Gerät da

**Das brauchst du:** Zwei Geräte, beide mit demselben Konto angemeldet.

**Das muss passieren:** Alle drei Lieder sehen auf Gerät B genauso aus wie auf A.

1. Auf **Gerät A** drei verschiedene Lieder öffnen und bei jedem Tonart, Kapo und Schriftgröße
   ändern.
2. Eine Minute warten.
3. Auf **Gerät B** die App schließen und neu öffnen.
4. Dieselben drei Lieder nacheinander aufrufen.

<details><summary>Technisches</summary>

- **Priorität:** hoch
- **Betrifft:** `client/src/services/userSettings.ts`, `server/src/services/userSettings.ts`, `server/src/controllers/userSettingsController.ts`
- **Automatisiert:** teilweise – `server/src/services/userSettings.test.ts`
- **Historie:** #195, #213

</details>

### TF-EINST-07 · Geteiltes PDF sieht aus wie der Bildschirm (auch mit Kapo)

**Das brauchst du:** Ein Lied mit Akkorden. Am besten ein Gerät, auf dem du das PDF gleich ansehen
kannst.

**Das muss passieren:** Die Akkorde im PDF sind **dieselben** wie auf dem Bildschirm. Auch die
Kopfzeile („Tonart – …") stimmt überein. Bis Version 2.14 stand im geteilten PDF bei gesetztem Kapo
eine andere Tonart als auf dem Blatt – bei Kapo 2 zwei Halbtöne zu hoch.

1. Ein Lied öffnen und oben auf den **Liedtitel** tippen.
2. Bei **Kapo** die 2 wählen.
3. Die Akkorde der ersten Zeile auf dem Bildschirm aufschreiben oder merken.
4. Wieder auf den Titel tippen und **Als PDF teilen** wählen – im Fenster „Lied teilen" warten, bis
   „Fertig" steht, dann **Teilen**.
5. Das PDF ansehen (z. B. in Dateien speichern oder sich selbst schicken).
6. Die erste Zeile im PDF mit dem Zettel aus Schritt 3 vergleichen.
7. Zur Gegenprobe: Kapo zurück auf **0**, noch einmal teilen – auch dann müssen Bildschirm und PDF
   übereinstimmen.

<details><summary>Technisches</summary>

- **Priorität:** hoch
- **Betrifft:** `client/src/pages/ChordChart.tsx`, `client/src/utils/chartPdfOptions.ts`, `client/src/utils/songPdfOpts.ts`, `ui/teilen/sharePdf.ts`, `client/src/utils/chordPdf.ts`, `client/src/hooks/useAppLogo.ts`
- **Automatisiert:** teilweise – `client/src/utils/chartPdfOptions.test.ts` (die Rechnung inkl. Kapo und der Weg über den Speicher); von Hand bleibt der Teilen-Dialog des Geräts und das Ansehen der fertigen Datei
- **Historie:** #239

</details>
### TF-EINST-08 · Ohne Netz geänderte Tonart übersteht das Schließen der App

**Das brauchst du:** Ein iPad/iPhone mit der App als PWA und ein zweites Gerät (oder denselben
Browser am Rechner), um gegenzuprüfen. Ein Lied, dessen Tonart du gefahrlos ändern kannst.

**Das muss passieren:** Die ohne Netz geänderte Tonart ist nach dem Neustart **noch da** und landet
auf dem Konto. Bis Version 2.16 war sie still weg: Der Merker für den ausstehenden Upload lebte nur
im Speicher, und beim nächsten Öffnen spiegelte der Abgleich den älteren Server-Stand zurück. Die
Anmerkungen hatten diesen Schutz schon, die Einstellungen nicht.

1. Das Lied öffnen und die aktuelle Tonart notieren.
2. **Flugmodus einschalten** (oder WLAN aus – die App muss wirklich ohne Netz sein).
3. Auf den Liedtitel tippen und eine **andere Tonart** wählen. Sie gilt sofort auf dem Blatt.
4. Die App **ganz schließen** (App-Umschalter, nach oben wegwischen – nicht nur in den Hintergrund).
5. Flugmodus wieder aus.
6. Die App öffnen und dasselbe Lied ansehen: Es muss die **in Schritt 3 gewählte** Tonart stehen.
7. Gegenprobe auf dem zweiten Gerät (bzw. nach Ab- und Neuanmelden): Dort muss ebenfalls die neue
   Tonart erscheinen – dann ist sie wirklich auf dem Konto und nicht nur auf dem ersten Gerät.

**Zweiter Durchgang (kürzer):** Schritte 1–3 wiederholen, dann die App **sofort** wegwischen, ohne
eine halbe Sekunde zu warten. Auch das darf die Änderung nicht kosten (iOS friert dabei die
Sammel-Pause ein).

<details><summary>Technisches</summary>

- **Priorität:** hoch
- **Betrifft:** `client/src/services/userSettings.ts`, `client/src/services/pendingKeys.ts`, `client/src/services/appHidden.ts`, `client/src/pages/ChordChart.tsx`, `client/src/hooks/useChartSync.ts`
- **Automatisiert:** teilweise – `client/src/services/userSettings.pending.test.ts` (Merker, Abgleich-Schutz, Flush beim Weglegen) und `client/src/services/pendingKeys.test.ts`; von Hand bleiben der echte Flugmodus, das echte Beenden durch iOS und das Zusammenspiel zweier Geräte
- **Historie:** #275 (Vorbild: #245/#256 bei den Anmerkungen)

</details>

### TF-EINST-09 · Dateien eines Arrangements verwalten

**Das brauchst du:** Ein Konto, das Lieder in ChurchTools bearbeiten darf, und ein Lied mit
mindestens einer Datei. **Am besten auf einem Testlied** – hier wird wirklich in ChurchTools
geschrieben.

**Das muss passieren:** Im Lied-Menü steht **„Dateien …"**. Dahinter liegt alles, was am Arrangement
hängt – auch Dateien, die die App sonst nirgends zeigt (z. B. eine MP3).

1. **Liste:** Oben steht die sprechende Bezeichnung („Notenblatt (ChordPro)", „Version „Akustik""),
   klein darunter der echte Dateiname. Bei PDF und Bild ist der Dateiname die Überschrift.
   Wo ChurchTools keine Größe liefert, steht **nichts** – kein Gedankenstrich.
2. **Herunterladen:** Eine Zeile antippen → auf dem iPad öffnet sich das Teilen-Menü, am Rechner
   wird geladen. Die Datei ist vollständig und lässt sich öffnen.
3. **Hochladen:** „Datei hinzufügen …", ein PDF wählen → es erscheint in der Liste **und** im
   Lied-Menü unter „Anzeige" als weiteres Dokument.
4. **Gleicher Name:** Dieselbe Datei nochmal wählen → Warnung, dass ChurchTools **nicht ersetzt**
   und sie danach zweimal daliegt. Abbrechen → nichts passiert.
5. **Zu groß:** Eine Datei über 50 MB wählen → Meldung **bevor** etwas übertragen wird.
6. **Löschen:** Papierkorb rechts → die Rückfrage nennt die **Folge**. Beim Original-ChordPro muss
   dort stehen, dass die App danach keine Akkorde mehr zeigt. Abbrechen → nichts passiert.
7. **Ohne Berechtigung** (Konto ohne „Lieder bearbeiten") erscheint „Dateien …" gar nicht.
8. **Ohne Netz** (Flugmodus): Das Blatt sagt „Keine Verbindung zum Server", nicht endlos
   „wird geladen".

<details><summary>Technisches</summary>

- **Priorität:** hoch
- **Warum:** schreibt in ChurchTools
- **Betrifft:** `client/src/components/ArrangementFilesSheet.tsx`, `client/src/hooks/useArrangementDateien.ts`, `client/src/utils/dateiVerwaltung.ts`, `server/src/services/setlistBuilder.ts`, `server/src/services/arrangementFiles.ts`
- **Automatisiert:** weitgehend – `ArrangementFilesSheet.test.tsx` (die drei leeren Fälle, beide
  Knöpfe je Zeile), `dateiVerwaltung.test.ts` (Größe, Doppel, Wortlaut der Rückfrage),
  `useArrangementDateien.test.tsx` (Meldung hängt nicht am Auffrischen),
  `arrangementFileVerwaltung.test.ts` (Zugehörigkeit, Reihenfolge). Von Hand bleiben das
  **Teilen-Menü auf dem iPad** (Punkt 2) und der Blick nach ChurchTools (Punkt 3).
- **Historie:** #321

</details>

### TF-EINST-10 · Notenblatt aus CCLI SongSelect holen

**Das brauchst du:** Ein Lied mit **CCLI-Nummer** in einem Arrangement **ohne** Notenblatt, und eine
Gemeinde mit aktiver SongSelect-Integration. **Achtung: Der Abruf wird bei CCLI vermerkt.**

**Das muss passieren:** In „Dateien …" steht **„Notenblatt aus SongSelect holen …"** – aber **nur**,
wenn noch keines da ist.

1. **Arrangement ohne Notenblatt** → der Knopf ist da. Rückfrage lesen: Sie nennt Lied,
   CCLI-Nummer, Arrangement und dass die Tonart **des Arrangements** verwendet wird.
2. **Holen** → Meldung „Notenblatt aus SongSelect geholt", die Datei erscheint, der Knopf
   **verschwindet**. Das Lied zeigt Akkorde.
3. **Tonart prüfen:** Hat das Arrangement z. B. D, müssen die Akkorde in D stehen – nicht in der
   Standard-Tonart des Liedes.
4. **Zweites Arrangement** mit anderer Tonart → dort kommt die eigene Fassung.
5. **Kein zweiter Knopf:** Wo schon ein Notenblatt liegt, erscheint er nicht.
6. **Ohne CCLI-Nummer** am Lied erscheint er ebenfalls nicht.
7. **In ChurchTools nachsehen:** Genau **eine** ChordPro-Datei im Arrangement – keine Doppel.

Erscheint nach dem Holen **keine** Datei, obwohl Erfolg gemeldet wurde: **melden.** Genau dieser
Fall hat schon einmal ein vorhandenes Notenblatt gekostet (#322).

<details><summary>Technisches</summary>

- **Priorität:** hoch
- **Warum:** schreibt in ChurchTools und wird bei CCLI vermerkt
- **Betrifft:** `server/src/services/ctSongSelect.ts`, `server/src/services/ctAjax.ts`, `server/src/services/setlistBuilder.ts`, `client/src/components/ArrangementFilesSheet.tsx`, `client/src/hooks/useArrangementDateien.ts`
- **Automatisiert:** weitgehend – `ctSongSelect.test.ts` (Antwortformen, Lizenz, keine Interna nach
  außen), `arrangementFileVerwaltung.test.ts` (erst holen/hochladen, dann löschen; nichts löschen
  ohne Text). Von Hand bleibt der Blick nach ChurchTools und auf die **echte Tonart** im Blatt.
- **Historie:** #322

</details>

### TF-EINST-11 · Im Editor in der angezeigten Tonart arbeiten

**Das brauchst du:** Ein Lied, dessen Original in einer Tonart steht (z. B. G), und das Recht,
Versionen anzulegen. Ein Testlied ist besser als ein echtes – Versionen landen in ChurchTools.

**Das muss passieren:** Der Editor zeigt dieselben Akkorde wie das Blatt, und nach dem Speichern
stimmt das Blatt weiter – ohne dass du irgendwo rechnen musst.

1. Das Lied öffnen, auf den Titel tippen und die Tonart auf **D** stellen. Das Blatt zeigt
   D-Akkorde.
2. Titel → **Neue Version**. Der Editor zeigt **D-Akkorde** (nicht G), im Kopf unter dem Titel steht
   „Tonart **D**". Im Text steht eine Zeile `{key: D}`.
3. Einen Akkord ändern, bei **Fassung** einen Namen eingeben, **Speichern**. Das Blatt zeigt die neue Version
   **in D** – nicht plötzlich in G.
4. Diese Version erneut bearbeiten: Der Editor zeigt wieder D. Die Vorschau rechts steht auf ±0
   und sieht aus wie das Blatt.
5. Bei der Version die Tonart auf **A** stellen, dann bearbeiten: Der Editor zeigt A-Akkorde und
   „Tonart **A**". Speichern → das Blatt zeigt A, und in ChurchTools steht in der Datei `{key: A}`.
6. **Kapo:** Bei der Version Kapo 2 setzen. Das Blatt zeigt gegriffene Akkorde (eine Tonart
   tiefer). Bearbeiten: Der Editor zeigt trotzdem die **klingende** Tonart und sagt „mit Kapo 2
   gegriffen als …".
7. **Gleiche Tonart, nichts umgeschrieben:** Ein Lied mit b-Akkorden (z. B. Bb, Eb) in seiner
   eigenen Tonart bearbeiten, ohne zu transponieren. Der Editor zeigt die Akkorde **genauso
   geschrieben** wie in der Datei – kein Bb wird zu A#.
8. **Bestehende Version in anderer Tonart:** Eine Version, deren Text in D steht, während das
   Original in G ist, und die noch keine `{key}`-Zeile hat, zeigt weiterhin die alte Anzeige. Sie
   einmal öffnen und speichern – dann bekommt sie ihre `{key}`-Zeile und wird ab da richtig
   angezeigt.

<details><summary>Technisches</summary>

- **Priorität:** hoch
- **Betrifft:** `client/src/hooks/useChartEditor.ts`, `client/src/utils/transpose.ts`, `client/src/utils/songVersions.ts`, `client/src/utils/chartPdfOptions.ts`, `client/src/utils/activeSongView.ts`, `client/src/components/ChordEditor.tsx`, `server/src/services/setlistBuilder.ts`
- **Automatisiert:** teilweise – `client/src/utils/transpose.test.ts` (ganzer Text, `{key}`-Zeile, 0 Halbtöne buchstäblich), `client/src/utils/songVersions.test.ts` (Tonart je Version), `client/src/utils/chartPdfOptions.test.ts` (Versatz je Version), `client/src/hooks/useChartEditor.test.ts` (öffnet in Blatt-Tonart, Wahl geht in neue Version mit), `client/src/components/ChordEditor.test.tsx` (Tonart-Zeile), `server/src/services/buildSong.head.test.ts` (`writtenKey` aus der Versions-Datei); von Hand bleibt, dass ChurchTools die Datei mit der `{key}`-Zeile wirklich so ablegt
- **Historie:** #398 (20.09.2026), Wunsch Alwin nach einem Abend Zurückrechnen

</details>

### TF-EINST-12 · Teilen mit oder ohne Anmerkungen, auch mit PDFs aus ChurchTools – mit Vorschau und Herunterladen

**Das brauchst du:** Einen Ablauf mit einem Lied mit Akkorden und einem Lied, das sein **PDF** zeigt
(nur PDF in ChurchTools, oder im Liedmenü aufs PDF umgestellt). Auf beiden etwas angemerkt (Stift und
Text). Ein iPad/iPhone und, wenn möglich, einen Drucker.

**Das muss passieren:** Ohne Anmerkungen ist das PDF sauber; mit Anmerkungen stehen Striche und Texte
**an derselben Stelle** wie auf dem Bildschirm – auf der Akkord-Seite UND auf der PDF-Seite. Das Lied
mit PDF fehlt nicht. Auf dem iPhone/iPad öffnet „Teilen" das Teilen-Menü (kein stiller Download).
Vor dem Teilen zeigt das Fenster die Seiten; „Herunterladen" speichert ohne Teilen-Menü.

1. Ablauf öffnen, oben auf das **Teilen**-Symbol → Fenster „Ablauf teilen", nach kurzer Zeit
   „Fertig · N Seiten". **Teilen** → Teilen-Menü → in Dateien sichern, ansehen: keine Anmerkungen.
2. Noch einmal, **Meine Anmerkungen** einschalten → warten bis „Fertig" → **Teilen** → ansehen:
   Anmerkungen da, an der richtigen Stelle, auch auf der PDF-Seite.
3. Fenster schließen, wieder öffnen → der Schalter steht noch auf „an" (das Gerät merkt es sich).
4. Ein Lied öffnen, das sein PDF zeigt, Titel antippen → **Als PDF teilen** gibt es jetzt auch hier.
5. Eine Gemeinde/ein Ablauf **nur mit PDFs** (keine Akkorde): Das Teilen-Symbol im Ablauf ist da.
6. **Vorschau:** Im Fenster stehen die Seiten als kleine Blätter. Eine antippen → sie erscheint groß,
   **‹ ›** blättert, **Alle Seiten** führt zurück. **Meine Anmerkungen** umschalten → die Vorschau zeigt
   das neue PDF (mit bzw. ohne Striche).
7. **Herunterladen** → die Datei landet ohne Teilen-Menü auf dem Gerät (iPad im Browser: Dateien →
   Downloads; in der App vom Homescreen kann iOS eine Ansicht mit Teilen-Knopf zeigen). Das Fenster
   bleibt offen und zeigt „Heruntergeladen".

<details><summary>Technisches</summary>

- **Priorität:** hoch
- **Betrifft:** `client/src/components/TeilenFenster.tsx`, `client/src/components/PdfSeitenVorschau.tsx`, `ui/teilen/sharePdf.ts`, `ui/teilen/shareFile.ts`, `client/src/utils/ablaufPdf.ts`, `client/src/utils/anmerkungsEbene.ts`, `client/src/utils/dokumentSeiten.ts`, `client/src/pages/Setlist.tsx`, `client/src/pages/ChordChart.tsx`, `client/src/components/SongMenu.tsx`
- **Automatisiert:** teilweise – `ablaufPdf.test.ts` (Reihenfolge, Dokument-Seiten, Ersatz/Fehlen,
  Seitenbesitzer und Ebene je Seite), `TeilenFenster.test.tsx` (Vorgabe, Merken, veraltetes PDF, Vorschau, Großansicht, Herunterladen);
  gegen den ChurchTools-Stub durchgeklickt und das heruntergeladene PDF angesehen. Von Hand bleibt das
  Teilen-Menü auf iOS (frisches Antippen) und ein Ausdruck
- **Historie:** Anfrage BG Korntal (Teilen-Knopf fehlte ohne ChordPro), Alwin 07.10.2026 (Anmerkungen
  wählbar), Alwin 08.10.2026 (Vorschau und Herunterladen)

</details>

### TF-EINST-13 · Versionen bei Liedern mit Bindestrich im Titel

**Das brauchst du:** Ein Lied mit Bindestrich im Titel (z. B. „Herr-lich") mit einer Version, an der
schon Tonart und Anmerkungen hängen – angelegt mit einer App **vor** dem Update.

**Das muss passieren:** Nach dem Update heißt die Version richtig („Akustik", nicht „lich — Akustik").
Beim ersten Öffnen ist die Version weiter gewählt, Tonart und Anmerkungen sind da – auch auf einem
zweiten Gerät.

1. Lied öffnen, auf den **Titel** tippen → unter **Version** steht der richtige Name, mit Haken.
2. Tonart und Anmerkungen ansehen – wie vor dem Update.
3. Version **umbenennen** → der Name wird nicht länger, in ChurchTools liegt genau eine Datei.

<details><summary>Technisches</summary>

- **Priorität:** normal
- **Betrifft:** `shared/ct/arrangementFiles.ts`, `shared/ct/setlistKern.ts`, `shared/ct/notenblaetter.ts`, `client/src/utils/versionMigration.ts`, `client/src/pages/ChordChart.tsx`
- **Automatisiert:** weitgehend – `versionMigration.test.ts` (Erkennung, Kopien, gewählte Version),
  `setlistKern.test.ts` (`alterKey`), `ctWrite.test.ts` (Version über den alten Schlüssel gefunden).
  Von Hand: dass der Umzug VOR dem Lesen der Einstellungen läuft (erstes Öffnen) und ein zweites Gerät
- **Historie:** Durchklick 3b-2 (07.10.2026)

</details>

### TF-EINST-14 · Lied-Editor: neuer Aufbau auf iPad und Handy

**Das brauchst du:** Das Recht, Versionen anzulegen; ein iPad (oder breites Fenster) und ein Handy. Ein
Testlied ist besser als ein echtes – Versionen landen in ChurchTools.

**Das muss passieren:** Der Editor sieht aus wie ChurchTools (weißer Kopf statt blauer Leiste), und am
Text ändert sich durch den neuen Aufbau nichts.

1. Ein Lied öffnen, Titel → **Neue Version**. Oben steht ein weißer Kopf: **Abbrechen**, der Titel, darunter
   die Tonart, rechts **Speichern**.
2. **iPad:** Links die Karte **Fassung** mit Namensfeld, darunter **Akkord**, **Format** und rechts
   **Rückgängig / Wiederholen**, darunter der Text. Rechts daneben die **Vorschau** mit Transponieren.
3. **Handy:** Unter dem Kopf der Umschalter **Text | Vorschau**. Der Titel ist ganz zu lesen. Etwas tippen,
   auf **Vorschau** und zurück auf **Text** wechseln: Der Text und **Rückgängig** sind noch da.
4. Speichern, die Version erneut bearbeiten: Der Text steht genau so da wie vorher – keine Zeile mehr oder
   weniger.
5. **Dunkelmodus** einschalten und den Editor öffnen: dunkler Kopf und dunkle Karten, alles lesbar.

<details><summary>Technisches</summary>

- **Priorität:** normal
- **Betrifft:** `client/src/components/ChordEditor.tsx`, `client/src/components/ChordEditor.module.scss`, `client/src/dev/DemoEditor.tsx`
- **Automatisiert:** weitgehend – `ChordEditor.test.tsx` (breit beide Karten, schmal Umschalter und Text-Karte
  bleibt erhalten, Rückgängig in der Text-Karte), `e2e/editor-aufbau.spec.ts` (iPad- und Handy-Breite, Titel
  nicht abgeschnitten, Speichern liefert den Text Zeichen für Zeichen). Von Hand: echtes iPad/Handy mit
  Bildschirmtastatur, Dunkelmodus
- **Historie:** Neuer Lied-Editor, Scheibe L1 (22.10.2026, Entwurf C); Alwin: „zu kompliziert und zu altbacken"

</details>

### TF-EINST-15 · Lied-Editor: Akkorde als Kärtchen, Teile als Band – am echten iPad

**Das brauchst du:** Ein iPad (und gern ein Handy) mit Bildschirmtastatur, das Recht, Versionen anzulegen, und
ein Testlied. **Auf Staging nicht speichern** – Staging hängt am echten ChurchTools.

**Das muss passieren:** Im Text stehen keine Klammern mehr: Akkorde sind blaue Kärtchen, jeder Teil beginnt mit
einem grauen Band, `----` ist die Linie „Pedal hält hier“. Tippen, Löschen und Rückgängig verhalten sich rund um
ein Kärtchen so, wie man es erwartet – ein Kärtchen verschwindet immer ganz oder gar nicht.

1. Ein Lied öffnen → Version bearbeiten. Akkorde sind Kärtchen, „VERS“ / „CHORUS“ stehen als Band darüber.
2. Mit dem Finger **direkt hinter** ein Kärtchen tippen, auf der Bildschirmtastatur **Löschen**: das ganze
   Kärtchen ist weg (nicht nur ein Teil, kein Buchstabe davor). **Rückgängig** → es ist wieder da.
3. **Direkt vor** ein Kärtchen tippen und ein Wort schreiben: es steht vor dem Akkord, das Kärtchen bleibt heil.
4. Mitten in einem Wort hinter einem Kärtchen **Diktieren** und einen Satz sprechen; **Autokorrektur** ein
   Wort ersetzen lassen: Kärtchen bleiben, wo sie waren.
5. Im Ablauf einen Chorus dazu: Am Band steht „2× im Ablauf“.
6. **ChordPro-Text** antippen: der rohe Text mit `[E]` und `{comment: Vers}`; noch einmal → wieder Kärtchen.

<details><summary>Technisches</summary>

- **Priorität:** hoch
- **Betrifft:** `client/src/components/ChordProInput.tsx`, `client/src/components/ChordEditor.tsx`, `client/src/utils/chordpro.ts`
- **Automatisiert:** teilweise – `e2e/editor-text.spec.ts` (Kärtchen und Bänder, Rücktaste löscht den ganzen
  Akkord, Rückgängig, Tippen davor, „× im Ablauf“, rohe Ansicht; Chromium in der CI, WebKit/Mac-Safari von Hand
  am 22.10.2026 grün). **Von Hand bleibt das echte iPad**: Bildschirmtastatur, Diktieren, Autokorrektur – die
  lassen sich nicht nachbilden (Messung L0). Klappt Schritt 2 nicht, liegt im Versuchszweig `spike/editor-l0`
  ein eigener Lösch-Griff (`kaertchenLoeschen`) bereit.
- **Historie:** Neuer Lied-Editor, Scheibe L3 (22.10.2026) – vor dem Mergen von L3 am echten iPad zu prüfen

</details>

### TF-EINST-16 · Lied-Editor: Akkorde einfügen mit der Leiste – am echten iPad

**Das brauchst du:** Ein iPad mit Bildschirmtastatur, das Recht, Versionen anzulegen, und ein Testlied mit Tonart.
**Auf Staging nicht speichern** – Staging hängt am echten ChurchTools.

**Das muss passieren:** Unter der Werkzeugleiste stehen die Akkorde der Tonart (in E: E, F#m, G#m, A, B, C#m),
daneben „Im Lied“ und „Anderer Akkord“. Ein Tipp setzt den Akkord an die Cursorstelle; die Tastatur bleibt dabei
offen, und man kann direkt weiterschreiben.

1. Lied öffnen → Version bearbeiten. In den Text tippen (Tastatur geht auf), dann in der Leiste **A** antippen:
   Das Kärtchen „A“ steht an der Cursorstelle, **die Tastatur bleibt offen**, weitertippen geht dahinter.
2. **E** in der Leiste **gedrückt halten**: Es erscheinen „Varianten von E“ (Em, E7, Em7, Esus4 …), kein
   iOS-Menü (Kopieren/Nachschlagen). **Esus4** antippen → gesetzt. Nur E selbst wurde nicht gesetzt.
3. **Anderer Akkord** → `em7` eintippen → Eingabetaste: Das Fenster schließt, „Em7“ steht im Text und
   vorne unter **Im Lied**. Kein zusätzlicher Zeilenumbruch.
4. **Anderer Akkord** → G, sus4, /B antippen: Die Vorschau zeigt „Gsus4/B“; **Einfügen** ist ohne Scrollen zu
   sehen.
5. Etwas Unlesbares eintippen (`Vers`) → rot, „Einfügen“ gesperrt.

<details><summary>Technisches</summary>

- **Priorität:** hoch
- **Betrifft:** `client/src/components/AkkordLeiste.tsx`, `client/src/components/AkkordFenster.tsx`, `client/src/components/ChordEditor.tsx`, `client/src/utils/transpose.ts`, `client/src/utils/chordpro.ts`
- **Automatisiert:** weitgehend – `transpose.test.ts` (`tonartAkkorde`, `akkordLesen`, `akkordTeile`),
  `chordpro.test.ts` (`akkordeImText`), `AkkordLeiste.test.tsx` (Gruppen, Gedrückthalten mit Fake-Timern),
  `AkkordFenster.test.tsx`, `ChordEditor.test.tsx` (Tonart aus `{key}`), `e2e/editor-akkorde.spec.ts`
  (antippen + weitertippen, eintippen + Eingabetaste ohne Zeilenumbruch, Gedrückthalten). **Von Hand bleibt das
  echte iPad**: Tastatur bleibt offen, Gedrückthalten mit dem Finger ohne iOS-Menü.
- **Historie:** Neuer Lied-Editor, Scheibe L5-1 (22.10.2026), Entwurf Variante A; Alwin: „Akkorde einfügen ist
  noch nicht so intuitiv“

</details>

### TF-EINST-17 · Lied-Editor: Akkord-Kärtchen antippen – am echten iPad

**Das brauchst du:** Ein iPad, das Recht, Versionen anzulegen, und ein Testlied mit Akkorden. **Auf Staging nicht
speichern** – Staging hängt am echten ChurchTools.

**Das muss passieren:** Ein Tipp auf ein Akkord-Kärtchen setzt **nicht** den Cursor, sondern öffnet darunter ein
kleines Menü (‹ › Ändern Entfernen); das Kärtchen ist blau umrahmt. Die Tastatur geht dabei nicht auf und nicht zu.

1. Lied öffnen → Version bearbeiten. Mit dem Finger auf ein Kärtchen (z. B. „A“) tippen: Menü erscheint, das
   Kärtchen ist umrahmt, **kein Cursor** springt davor oder dahinter, kein iOS-Menü (Auswählen/Einsetzen).
2. Dreimal **›** antippen: Das Kärtchen wandert Buchstabe für Buchstabe nach rechts, Menü und Rahmen gehen mit.
   Steht ein anderer Akkord direkt daneben, springt es über ihn hinweg.
3. **Rückgängig** → ein Schritt zurück.
4. Kärtchen antippen → in der Leiste **C#m** antippen: Das Kärtchen wird zu C#m (kein zweiter Akkord).
5. Kärtchen antippen → **Ändern** → Art „7“ → **Übernehmen**. Kärtchen antippen → **Entfernen**.
6. Neben das Menü in den Text tippen: Menü zu, Cursor steht dort.

<details><summary>Technisches</summary>

- **Priorität:** hoch
- **Betrifft:** `client/src/components/ChordProInput.tsx`, `client/src/components/AkkordMenue.tsx`, `client/src/components/ChordEditor.tsx`, `client/src/utils/chordpro.ts`
- **Automatisiert:** weitgehend – `chordpro.test.ts` (`akkordVerschieben`: Nachbarzeichen, Nachbar-Akkord,
  Zeilenrand), `e2e/editor-akkord-menue.spec.ts` (schieben + Menü wandert mit + Rahmen, Rückgängig, Entfernen,
  Ändern, Leiste und „Anderer Akkord“ ersetzen, Zeilenrand gesperrt). **Von Hand bleibt das echte iPad**: Auf
  dem Touchscreen könnte iOS beim Tipp aufs Kärtchen selbst einen Cursor setzen oder die Tastatur öffnen, bevor
  der Editor den Tipp sieht – das lässt sich am Mac nicht nachstellen.
- **Historie:** Neuer Lied-Editor, Scheibe L5-2 (23.10.2026), Entwurf Variante A

</details>

### TF-EINST-18 · Lied-Editor: Schreibansicht bei offener Tastatur – am echten iPad

**Das brauchst du:** Ein iPad (quer und hochkant) und gern ein Handy, das Recht, Versionen anzulegen, ein Testlied.
**Auf Staging nicht speichern** – Staging hängt am echten ChurchTools.

**Das muss passieren:** Sobald du in den Liedtext tippst und die Tastatur aufgeht, verschwinden Ablauf, Fassung und
„ChordPro-Text“. Format, die Akkorde der Tonart, **Im Lied ▾**, **+** und Rückgängig stehen in einer Zeile über dem
Text. Über der Tastatur ist Platz für deutlich mehr als zwei Zeilen. Tastatur zu → alles wie vorher.

1. Lied öffnen → Version bearbeiten → in den Text tippen. Die Ansicht räumt auf, die eine Zeile passt am iPad quer
   ganz (nichts abgeschnitten).
2. **Im Lied** antippen → die übrigen Akkorde des Lieds klappen auf; einen antippen → er steht an der Cursorstelle,
   die Tastatur bleibt offen. Noch einmal **Im Lied** → zu.
3. **Format** antippen → das Menü öffnet, die Tastatur bleibt offen; „Weiterschalt-Punkt“ wählen.
4. Ein Akkord-Kärtchen **direkt über der Tastatur** antippen: Das Menü klappt **nach oben** auf, nicht unter die
   Tastatur.
5. Tastatur schließen (Taste unten rechts): Ablauf und Fassung sind wieder da. Ins Feld **Fassung** tippen:
   Die Ansicht bleibt, wie sie ist (nur der Liedtext löst die Schreibansicht aus).
6. Mit angesteckter Hardware-Tastatur: keine Schreibansicht (es ist ja Platz).
7. **Mehrmals hintereinander** (Tastatur zu, wieder in den Text tippen; auch nach Drehen des iPads und nach „Im
   Lied“/„Format“): Die eine Zeile kommt **jedes Mal** – nicht nur manchmal.

<details><summary>Technisches</summary>

- **Priorität:** hoch
- **Betrifft:** `client/src/components/ChordEditor.tsx`, `client/src/components/AkkordLeiste.tsx`, `client/src/components/AkkordMenue.tsx`, `client/src/components/ChordProInput.tsx`, `ui/fenster/useTastaturOffen.ts`
- **Automatisiert:** weitgehend – `useTastaturOffen.test.tsx` (Formel, Schwelle für die Hardware-Tastatur-Leiste),
  `e2e/editor-schreiben.spec.ts` mit nachgestellter Tastatur (`visualViewport` schrumpft): Ablauf/Fassung weg, eine
  Zeile, Platz für den Text, „Im Lied“ auf/zu/einfügen, Menü klappt über das Kärtchen, iOS verkleinert das
  Fenster statt die Tastatur darüberzulegen, kurzer Fokusverlust, Tastatur für die Fassung. **Von Hand bleibt das echte
  iPad**: ob Format/Rückgängig/„Im Lied“ die Tastatur wirklich offen lassen, Hardware-Tastatur.
- **Historie:** Alwin am iPad, 23.10.2026 („das Bearbeitungsfenster ist bei aufgeklappter Tastatur deutlich zu
  klein“), Entwurf A mit „Im Lied“ als Ausklappmenü; Lied-Editor L5-3. Nachtest am selben Abend: „manchmal
  funktioniert's mit der einen Zeile, manchmal nicht“ → gegen die eingefrorene App-Höhe messen, Ansicht bis
  Tastatur-zu halten

</details>
