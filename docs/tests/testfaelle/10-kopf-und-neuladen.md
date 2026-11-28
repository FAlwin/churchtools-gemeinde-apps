# Kopfbereich und Neuladen (alle Bildschirme)

Seit dem 22.09.2026 haben alle Bildschirme **denselben Aufbau**: keine Titel-Leiste, die Überschrift
steht groß im Inhalt und scrollt mit weg. Grund ist das Unschärfe-Band, das iOS 26/27 hinter der
Statusleiste über die App legt – Text darin wirkt verschmiert. Gebaut ist das Muster **einmal**, im
`SeitenGeruest`; diese Fälle prüfen, dass es überall gleich ankommt.

**Nur am Gerät prüfbar:** Das Band gibt es ausschließlich in der **installierten** App (Home-Bildschirm)
unter iOS 26 oder neuer. Im Safari-Tab und am Schreibtisch sieht man es nicht.

### TF-KOPF-01 · Jeder Bildschirm trägt seine Überschrift im Inhalt

**Das brauchst du:** iPhone mit iOS 26/27, die App vom **Home-Bildschirm** (nicht im Safari-Tab).

**Das muss passieren:** Oben gibt es keinen farbigen Balken und keine Titel-Leiste. Jeder Bildschirm
beginnt mit seiner großen Überschrift, und die ist im Ruhezustand **scharf** – sie steht unterhalb
des Bandes.

1. App vom Home-Bildschirm starten. Tab **Termine**: **keine** Überschrift „Termine“ (das sagt der Reiter, seit
   28.10.2026) – ganz oben **eine Werkzeugzeile** (seit B8, 20.11.2026): links „Kommende | Vergangene“ auf einer **grauen Schiene**
   (der nicht gewählte ist klar als Knopf erkennbar, 02.10.2026; am Handy der blaue Knopf „Kommende ⌄“, ein Tipp klappt „Vergangene“
   auf), rechts der **Filter** ohne Rand (am Handy mit Rand). **Vollbild** steht in der Erweiterung am iPad/Rechner ganz rechts in
   der **Reiterzeile** (nicht mehr in der Werkzeugzeile), am Handy rechts oben im Seitenkopf. Über der Zeile ist nichts – der Inhalt
   läuft bis unter die Uhr.
2. **Lieder:** ganz oben das Suchfeld (am iPad/Rechner der grüne Knopf „+ Neues Lied“ daneben), darunter die Sortierung in einer Werkzeugzeile (am Handy der Knopf „A–Z ⌄“) – keine Überschrift. **Mehr:** ganz
   oben die Gemeinde-Karte (Vollbild am Handy oben rechts daneben, am iPad/Rechner in der Reiterzeile) – keine Überschrift. **Abwesenheiten** (Reiter nur in der
   eigenen App): ganz oben die Werkzeugzeile (seit B4): „Termine | Einträge“ links, in der Mitte der Zeitraum mit ‹ ›, rechts „Filter“ und am iPad grün „+ Zeitraum eintragen“ – keine Überschrift. Wähler, Suchfeld und Karte enden rechts bündig mit der
   Liste darunter.
   2a. **ChurchTools-App vom Home-Bildschirm** (iPhone, Erweiterung): Der Kopf jeder Seite beginnt **knapp** unter der
   blauen ChurchTools-Leiste, kein leerer Streifen dazwischen (vorher ~36 pt). Das runde **grüne Plus** (seit B8 grün; Abwesenheiten, Lieder, Vorlagen,
   Ablauf im Bearbeiten) steht wie in der ChurchTools-App rechts 16 pt vom Rand und 16 pt über der Reiterleiste bzw. über
   dem Home-Strich; ganz nach unten gescrollt liegt es nicht auf dem Stift des letzten Eintrags.
   2b. **Unterer Rand in der installierten App und in der ChurchTools-App** (29.10.2026): Die Reiterleiste endet an der
   Bildschirmkante (nichts ragt darunter), die Beschriftung steht wie vorher ~20 pt über der Kante. Im Lied stehen die
   Pfeile der Fußleiste deutlich über dem Home-Strich (62 pt in der installierten App, ~40 pt in der ChurchTools-App).
   Das Plus steht in **Abwesenheiten** und im **Ablauf** gleich weit über dem, was darunter liegt – auch in **„Verfügbarkeit“ des
   Dienstplaners** (Handy, B8a): fest unten rechts über der Reiterleiste, nicht am Listenende unter dem Bildschirmrand. Nach dem
   Abhaken klebt dort auch die Speichern-Leiste unten am Bildschirm.
3. In jedem der vier: **hochschieben**. Die Überschrift wandert nach oben, läuft unter das Band und
   wird dabei weich – das ist der native Effekt von iOS, kein Fehler. Nichts bleibt oben kleben.
4. Einen **Termin öffnen**: Der Kopf ist eine **weiße Karte** unter Uhr und Band – links **„← Termine“**, rechts
   **Teilen** und (mit Recht) **Bearbeiten** – beide grau mit Rahmen (seit 28.10.2026; vorher war Bearbeiten blau gefüllt), in der Erweiterung ganz rechts Vollbild; darunter Name und
   Datum des Gottesdienstes. Am iPad stehen die Knöpfe mit Beschriftung, am Handy nur als Symbol (Zurück behält
   „Termine“). Alles **scharf**; beim Hochschieben scrollt die Karte mit (wie in ChurchTools). Im Bearbeiten heißt
   der blaue Knopf „Fertig“, daneben „Abschließen“ bzw. hellblau „Öffnen“ (Scheibe S, 26.10.2026).
   4a. **Reiter:** Am iPad/Rechner steht ganz oben klein der App-Name **„Musik-App“** (seit B8c, wie „Dienstplaner“ in den
   anderen Erweiterungen), darunter Termine · Lieder · Abwesenheiten · **Einstellungen** als Text, der gewählte blau unterstrichen
   („Einstellungen“ – bis 20.11.2026 „Mehr“ – bleibt der letzte Reiter: dort liegen Darstellung, Links, Team-Notizen, Hilfe; die Ablaufvorlagen liegen im **⋯** der Termine); am Handy unten
   mit Symbolen, der gewählte mit blauer Linie oben, **ohne App-Namen** – die Seite beginnt gleich mit ihrem Kopf.
   4b. **Knöpfe in Listen (Scheibe S2):** In **Lieder** stehen rechts in jeder Zeile **Plus** und **Stift** als
   eckige Knöpfe mit Rahmen (nicht rund); ebenso das Plus in der Liedsuche des Ablaufs. Bei einem Termin ohne Ablauf steht
   rechts das **leise gestrichelte Feld „+ Ablauf anlegen“** (B8; wer nichts anlegen darf, sieht das Etikett „Kein Ablauf“).
   **Zwei Arten von „+“:** Zum Anlegen steht am iPad/Rechner oben ein **grüner** Knopf mit Text (Ablauf im Bearbeiten,
   Abwesenheiten, Neues Lied) – wie „+ Gruppe erstellen“ in ChurchTools; am Handy derselbe Zweck als grüner Kreis. Grau und
   gestrichelt heißt „hier fehlt etwas“.
5. **Ein Lied öffnen (Liedblatt, Scheibe B1+B2):** Oben eine **Fläche in Kartenfarbe bis an den oberen Rand** (unter die
   Uhr bzw. bis an die ChurchTools-Leiste, keine schwebende Karte mit Rand – seit 29.10.2026); Inhalt scharf unter dem Band.
   Am Handy hochkant sind Liedtitel und Knöpfe größer als am iPad.
   **Lied-Editor** (Lied-Menü → Bearbeiten → Im Editor öffnen): Abbrechen · Titel · Speichern stehen ebenfalls unter
   dem Band, scharf – nicht direkt unter der Uhr (seit 29.10.2026).
   **iPad quer und hochkant:** erste Zeile **„← Ablauf“**, der Termin („Gottesdienst – Sonntag, 01. Nov · 10:00“), in der
   Erweiterung ganz rechts Vollbild. Darunter in **einer** Zeile links die **Lied-Leiste** (alle Lieder nummeriert,
   mit Trennstrichen; die sichtbaren grau, das gewählte blau unterstrichen mit Tonart · Fassung · Tempo und Pfeil) und
   rechts die Knöpfe **Aussehen, Tempo, Anmerken** (mit Recht „Notizen von …“, reingezoomt „Zoom zurücksetzen“).
   **Handy hochkant:** keine Titelzeile – Zurück und Vollbild als Symbol links und rechts der Leiste, darunter die
   Knöpfe als Raster mit Symbol und Kurzwort. **Handy quer:** alles in einer Zeile, Knöpfe nur als Symbol – das Blatt
   bleibt so groß wie vorher.
   - In die Leiste **wischen** → sie scrollt, das Blatt blättert NICHT. Ein Lied antippen, das nicht zu sehen ist → das
     Blatt springt hin, das Lied ist gewählt. **Blättern** (Wischen, Pfeile, Pedal) → die Leiste scrollt mit, das
     gewählte Lied bleibt zu sehen.
   - **Querformat:** das zweite sichtbare Lied antippen → es ist gewählt, das Blatt bleibt stehen, kein Vollbild. Das
     gewählte noch einmal antippen → das Lied-Menü öffnet als Fenster **in der Mitte** (TF-EINST-21).
   - **Tempo** → das Fenster öffnet unter dem Knopf, der Knopf ist hellblau; Puls an → „Tempo“ blau umrandet.
     **Anmerken** → der Knopf heißt „Anmerken beenden“ (Haken). **Notizen von …** → nur noch „Zurück zu den eigenen
     Notizen“; das gewählte Lied öffnet dann kein Lied-Menü.
   - Kein Fenster liegt über der Kopfkarte; der Hinweis „Ablauf geändert“ steht darunter.
   - **Aus der Liederliste** ein Lied öffnen → „← Lieder“, der Liedname als Titel, in der Leiste nur dieses Lied
     ohne Nummer.
   - In der Erweiterung ist unter den Pfeilen unten kein großer leerer Streifen mehr.
6. **Ganz nach oben:** In einer langen Liste (z. B. Mehr) weit nach unten scrollen, dann unten auf
   den **Tab tippen, in dem du schon bist** → die Ansicht springt an den Anfang. (Der Tipp auf die
   Uhrzeit oben tut in einer Web-App nichts – das kann iOS nicht weitergeben.)
7. **Ganz nach unten (#408):** In Termine, Lieder, Abwesenheiten, Einstellungen und im Ablauf bis ans Ende
   scrollen. Der letzte Eintrag steht überall mit **derselben** Luft über der Tab-Leiste bzw. dem
   Home-Strich; bei den Abwesenheiten verdeckt das Plus ihn nicht.

<details><summary>Technisches</summary>

- **Priorität:** hoch
- **Betrifft:** `client/src/components/SeitenGeruest.tsx`, `client/src/components/SeitenKopf.tsx`, `ui/bedienung/KopfKnopf.tsx`, `ui/bedienung/ZeilenKnopf.tsx`, `ui/bedienung/ReiterLeiste.tsx`, `client/src/components/BlattKopf.tsx`, `client/src/components/AblaufLeiste.tsx`, `client/src/utils/werkzeuge.ts`, `client/src/utils/onboarding.ts`, `ui/bedienung/Segment.tsx`, `client/src/components/Screen.tsx`, `client/src/components/Screen.module.scss`, `client/src/components/TabBar.tsx`, `client/src/components/VollbildOrt.ts`, `client/src/pages/Agenda.tsx`, `ui/bedienung/SchwebePlus.tsx`, `ui/bedienung/LeisesPlus.tsx`, `ui/erweiterung/ErweiterungsSeite.tsx`, `client/index.html`, `ui/design/_variables.scss`
- **Automatisiert:** teilweise – `client/src/components/SeitenGeruest.test.tsx` (Überschrift im Inhalt, Kopfkarte nur mit Zurück, „← Ziel“ mit Text, Vollbild ganz rechts, Überlagerung neben dem Scroll-Bereich), `ui/bedienung/KopfKnopf.test.tsx`, `ui/bedienung/ReiterLeiste.test.tsx` (oben ohne Symbole, Vollbild rechts), `client/src/pages/Agenda.werkzeug.test.tsx` (Werkzeugzeile der Termine), `ui/bedienung/SchwebePlus.test.tsx` und `ui/design/stufenPlus.test.ts` (grünes Plus, Fläche), `ui/erweiterung/ErweiterungsRahmen.test.tsx` (Plus nie im Rollbereich), `client/src/components/BlattKopf.test.tsx` (Knöpfe je Zustand, Tempo-Angabe und Puls, breit/kompakt/flach, Leiste: Nummern, sichtbar/gewählt, Tipp, Mitscrollen, gemessene Unterkante), `e2e/blatt-leiste.spec.ts` (viele Lieder: Sprung, Mitscrollen beim Blättern, Wischen blättert nicht, Querformat wählen ohne Sprung, eine Zeile am iPad hochkant, Fenster unter der Karte, Einzellied ohne Nummer), `e2e/chart-tempo.spec.ts` und `e2e/auth-flow.spec.ts` (Tempo und Anmerken über das Menü), `e2e/chart-querformat.spec.ts` (Querformat: Wahl in der Leiste ohne Vollbild, Lied-Menü am gewählten, Blatt = nur Vollbild), `client/src/components/Screen.zumAnfang.test.tsx` (aktiver Tab scrollt nach oben); von Hand bleibt, wie es unter dem echten Unschärfe-Band aussieht
- **Historie:** Kopfzeilen-Umbau 21./22.09.2026; runde Knöpfe, Liedblatt mit einem Werkzeuge-Knopf und sichtbare Umschalter-Schiene 02.10.2026 (am selben Tag am Gerät widerlegt: eine deckende Statusleiste beseitigt das milchige Band nicht); Werkzeuge im Hochformat einzeln nach Fensterbreite 05.10.2026; Seitenkopf im ChurchTools-Look + Reiter oben am iPad (Scheibe S, 26.10.2026); Liedblatt-Kopf als Kopfkarte mit Lied-Leiste und beschrifteten Knöpfen 28.10.2026 (Scheibe B1+B2)

</details>

### TF-KOPF-02 · Runterziehen zum Aktualisieren – überall gleich

**Das brauchst du:** Dasselbe Gerät, dazu ChurchTools in einem zweiten Fenster, um etwas zu ändern.

**Das muss passieren:** In **Termine**, **Lieder** und **Abwesenheiten** lädt das Runterziehen neu.
Der Kreisel bleibt sichtbar, **bis die Daten da sind** – und blitzt auch bei einer schnellen Antwort
nicht bloß auf. Der Hinweistext erscheint nur, solange man zieht.

1. Tab **Termine**, ganz oben. Langsam nach unten ziehen: Ab etwa einem Zentimeter erscheint der
   Pfeil mit „Zum Aktualisieren nach unten ziehen", weiter unten wechselt der Text auf „Loslassen
   zum Aktualisieren". Loslassen → Kreisel, dann ist die Liste aktuell.
2. **Ohne zu ziehen** steht dort **kein** Hinweistext – am Listenanfang ist nichts.
3. Dasselbe in **Lieder** und in **Abwesenheiten** (dort lädt es **beides**: die Termine und die
   eigenen Einträge).
4. **Gegenprobe mit echten Daten:** In ChurchTools einen Gottesdienst umbenennen, in der App
   Termine runterziehen → der neue Name steht da. In den Abwesenheiten einen Eintrag in ChurchTools
   löschen, runterziehen → der Haken ist weg.
5. Im **Ablauf** eines Gottesdienstes ebenfalls ziehen. Im **Bearbeiten-Modus** (Stift) ist das
   Ziehen bewusst aus – sonst führe es beim Sortieren ins Leere.

<details><summary>Technisches</summary>

- **Priorität:** hoch
- **Betrifft:** `client/src/hooks/usePullToRefresh.ts`, `client/src/components/Screen.tsx`, `client/src/components/SeitenGeruest.tsx`, `client/src/pages/Availability.tsx`, `client/src/pages/Agenda.tsx`, `client/src/pages/AllSongs.tsx`, `client/src/pages/Setlist.tsx`
- **Automatisiert:** teilweise – `client/src/components/Screen.pull.test.tsx` (Hinweis nur während der Geste, Anzeige wartet auf den Abruf, blitzt nicht auf), `client/src/pages/Availability.test.tsx` (wartet auf Einträge UND Termine); von Hand bleibt die Geste selbst und dass ChurchTools wirklich frische Daten liefert
- **Historie:** Alwin 22.09.2026 („bei Abwesenheit und Termine ist das Neuladen nicht richtig")

</details>

### TF-KOPF-03 · Schalter im Reiter „Einstellungen“ schalten mit einem Tipp

**Das brauchst du:** Ein Gerät mit der App; für den dritten Schalter ein Konto mit Team-Notizen.

**Das muss passieren:** Jeder Schalter springt bei **einem** Tipp um – egal ob auf die Beschriftung
oder auf den Schalter selbst. Die Zeilen sehen aus wie vorher (Umbau #407, 23.09.2026: die Seite ist
in Bausteine geteilt, die Schalter sind jetzt je ein einziger Knopf).

1. Reiter **Einstellungen**. Auf den **Text** „Display aktiv halten" tippen → der Schalter springt um. Noch einmal
   auf den **Schalter** tippen → er springt zurück.
2. Dasselbe mit „Kommende Gottesdienste offline halten".
3. Mit Team-Notizen-Recht: dasselbe mit „Meine Anmerkungen teilen".
4. Als Admin: Unter **Verwaltung** jede Zeile einmal öffnen und schließen – Organisation / Name,
   Links, Termin-Arten, Anmerkungen (darin Gruppen- und Rollen-Zuweisung).
5. Mit VoiceOver (optional): Ein Schalter wird als „Taste, ausgewählt" bzw. „nicht ausgewählt"
   angesagt.

<details><summary>Technisches</summary>

- **Priorität:** normal
- **Betrifft:** `client/src/pages/Settings.tsx`, `client/src/components/SchalterZeile.tsx`, `client/src/components/VerwaltungZeilen.tsx`, `client/src/components/VerwaltungFenster.tsx`, `client/src/hooks/useVerwaltung.ts`, `client/src/components/InstallierenHinweis.tsx`, `client/src/components/VersionsFuss.tsx`
- **Automatisiert:** teilweise – `client/src/pages/Settings.test.tsx` (vor dem Aufteilen geschrieben: Bereiche je Recht, ein Tipp = ein Umschalten, Fenster öffnen mit dem gespeicherten Stand, „Speichern" nur nach einer Änderung); von Hand bleibt das Aussehen und das Antippen am Gerät
- **Historie:** #407

</details>

### TF-KOPF-04 · Dunkelmodus sieht aus wie ChurchTools

**Das brauchst du:** Die installierte App auf dem iPhone und – zum Vergleich – ChurchTools im Dunkeln.

**Das muss passieren:** Im Dunkeln ist die App fast schwarz mit grauen Karten und Leisten, kein Blaustich – wie
ChurchTools, Anmeldungen und Dienstplaner. Die Statusleiste oben hat dieselbe Farbe wie die Leiste darunter (keine
Kante). Die Notenseite bleibt weiß.

1. Reiter **Einstellungen** → **Dunkel**. Das Logo oben hat einen grauen Kreis, keinen blauen.
2. **Termine**, einen Ablauf und ein Lied öffnen: überall grau-schwarz, Datumskacheln dunkelblau wie in ChurchTools.
3. In der installierten App: oben unter der Uhr kein farbiger Streifen, der sich von der Leiste abhebt.
4. **Auto** wählen und das Gerät auf hell/dunkel umstellen → die App folgt.
5. Abmelden: Die Anmeldeseite ist ebenfalls grau-schwarz, das Logo grau umrandet.

<details><summary>Technisches</summary>

- **Priorität:** normal
- **Betrifft:** `ui/design/_variables.scss`, `client/src/hooks/useSettings.ts`, `client/public/logo-rund-dunkel.png`
- **Automatisiert:** teilweise – `client/src/hooks/useSettings.test.tsx` (theme-color aus `--nav-bg`); von Hand bleibt das Aussehen am Gerät
- **Historie:** #565

</details>

### TF-KOPF-05 · Am iPad steht der Kopf unter dem milchigen Band

**Das brauchst du:** Ein iPad mit iPadOS 26 oder neuer, die Musik-App vom **Home-Bildschirm** (nicht im Safari-Tab).

**Das muss passieren:** Seit iPadOS 26 legt auch das iPad oben ein milchiges Band über die installierte App. Jeder
Kopf ohne Reiter beginnt unterhalb davon und ist im Ruhezustand **scharf** – Knöpfe und Überschrift wirken nicht
verschwommen. Erst beim Scrollen läuft der Inhalt unter das Band und wird dort weich (so gewollt).

1. App vom Home-Bildschirm starten, **Termine** → einen Termin öffnen. Der Kopf mit **‹ Termine**, der Überschrift
   und den Knöpfen rechts steht deutlich unter Uhr und Akku und ist scharf.
2. **Bearbeiten** tippen: Der Kopf mit „Eintrag hinzufügen“, „Abschließen“, „Fertig“ ist ebenfalls scharf.
3. Ein Lied öffnen: Der Kopf des Liedblatts ist scharf, das Lied-Menü und „Aussehen“ öffnen direkt darunter.
4. Zurück zu den Reitern **Termine**/**Lieder**: Die Reiter oben sind scharf und stehen ebenfalls unter dem Band.
5. Gegenprobe im Safari-Tab: Dort gibt es kein Band, der Kopf steht knapp unter der Adressleiste.

<details><summary>Technisches</summary>

- **Priorität:** normal
- **Betrifft:** `ui/design/_variables.scss`, `client/src/components/SeitenKopf.module.scss`, `ui/bedienung/ReiterLeiste.module.scss`
- **Automatisiert:** teilweise – `ui/design/reiterObenRand.test.ts` (eine Unterkante `--band-unten` für Köpfe und Reiter, keine Geräte-Ausnahme); von Hand bleibt, ob es am Gerät scharf aussieht
- **Historie:** #931, #932 (Reiter), #1174 (Köpfe ohne Reiter, Alwin am iPad 26.11.2026)

</details>

### TF-KOPF-06 · Leere Datumsfelder sind am iPhone und iPad normal hoch

**Das brauchst du:** Ein iPhone oder iPad (Safari oder installierte App), in der Musik-App das Recht für die
Lied-Statistik; im Dienstplaner das Planer-Recht.

**Das muss passieren:** Ein Datumsfeld ohne Datum ist so hoch wie dasselbe Feld mit Datum – kein flacher Strich.
Ein gewähltes Datum steht senkrecht mittig im Feld.

1. Musik-App, **Lieder** → **Häufigkeit**: **Von** und **Bis** sind leer und so hoch wie der Knopf **Alle** daneben.
2. In **Von** ein Datum wählen: Das Feld bleibt gleich hoch, das Datum steht mittig. Mit **Alle** wieder leeren –
   die Höhe bleibt.
3. Dienstplaner (ab dem Release nach dienstplan-v1.1.1): **Planen → ⋯ → Abfrage …** – leere Datumsfelder sind normal
   hoch. **Planen → Personen** → eine Person → Feld „bis“ leer: ebenfalls normal hoch.
4. Protokolle: To-Do öffnen, Feld **Bis** leer und gefüllt – gleich hoch, Datum mittig.

<details><summary>Technisches</summary>

- **Priorität:** normal
- **Betrifft:** `ui/design/_mixins.scss`, `ui/lied/SongStatsBar.module.scss`, `dienstplaner/src/AbfrageFenster.module.scss`, `dienstplaner/src/PersonFenster.module.scss`, `protokolle/src/Fensterfelder.module.scss`
- **Automatisiert:** teilweise – `ui/design/datumsfeld.test.ts` (Regel im Baustein `datumsfeld`); das Layout prüft jsdom nicht, gemessen im iPad-Simulator (iOS 27.2)
- **Historie:** #1103 (Datum mittig), #1182 (leere Felder, Alwin am iPad 26.11.2026)

</details>

### TF-KOPF-07 · Fenster bleiben unter dem milchigen Band – auch mit Tastatur

**Das brauchst du:** Ein iPad (oder iPhone) mit iPadOS 26 oder neuer, die Musik-App vom **Home-Bildschirm**, einen
Termin mit Ablauf und das Recht, ihn zu bearbeiten.

**Das muss passieren:** Ein Fenster beginnt immer unterhalb des milchigen Bands unter Uhr und Akku – auch wenn die
Tastatur aufgeht und das Fenster dafür nach oben rückt. Sein Kopf (z. B. „‹ Lied verknüpfen ✕“) ist scharf. Die
Liedsuche öffnet am iPad und Handy **ohne** Tastatur, damit die ganze Liederliste zu sehen ist.

1. **Termine** → Termin öffnen → **Bearbeiten** → bei einem Punkt **Lied verknüpfen**. Das Fenster öffnet, die
   Tastatur bleibt zu, die Liederliste ist ganz zu sehen.
2. Ins Suchfeld tippen: Die Tastatur geht auf, das Fenster rückt nach oben – sein Kopf steht aber **unter** dem Band
   und ist scharf, nicht verschwommen.
3. **Lieder** → **Neues Lied**: Auch hier öffnet die Suche ohne Tastatur.
4. Gegenprobe am Rechner: **Neues Lied** öffnen – der Cursor steht sofort im Suchfeld.

<details><summary>Technisches</summary>

- **Priorität:** normal
- **Betrifft:** `ui/fenster/Sheet.module.scss`, `ui/lied/LiedSucheKopf.tsx`, `ui/bedienung/useMedienAbfrage.ts`
- **Automatisiert:** teilweise – `ui/design/fensterUnterBand.test.ts` (Rand oben mindestens `--band-unten`, mit und
  ohne Tastatur), `ui/lied/LiedSucheKopf.test.tsx` (Finger ohne Autofokus, Maus mit); von Hand bleibt, wie es unter
  dem echten Band und mit der echten Tastatur aussieht
- **Historie:** #1203 (Alwin am iPad 27.11.2026, am iPad bestätigt 28.11.2026)

</details>
