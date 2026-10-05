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

1. App vom Home-Bildschirm starten. Tab **Termine**: Überschrift „Termine", darunter
   „Kommende | Vergangene", darunter die Liste. Beide Knöpfe liegen auf einer **grauen Schiene**,
   der nicht gewählte ist klar als Knopf erkennbar, nicht nur als Text (02.10.2026). Über der Überschrift ist nichts – der Inhalt läuft
   bis unter die Uhr.
2. Dasselbe in **Lieder** („Lieder", darunter Suchfeld und Sortierung), **Abwesenheiten**
   („Abwesenheiten") und **Mehr** („Mehr").
3. In jedem der vier: **hochschieben**. Die Überschrift wandert nach oben, läuft unter das Band und
   wird dabei weich – das ist der native Effekt von iOS, kein Fehler. Nichts bleibt oben kleben.
4. Einen **Termin öffnen**: Oben gibt es **keine weiße Leiste** mehr. Direkt unter Uhr und Band
   schweben **runde Knöpfe** – links der Pfeil zurück, rechts Teilen und Bearbeiten –, alle
   **scharf**. Name und Datum des Gottesdienstes stehen groß darunter. Den Ablauf hochschieben: Die
   Knöpfe bleiben stehen, der Inhalt läuft unter ihnen durch. Der Pfeil führt zurück zu den
   Terminen (02.10.2026, Vorbild die iPhone-Einstellungen).
5. **Ein Lied öffnen (Liedblatt):** Auch hier keine weiße Leiste. Unter dem Band: links der runde
   Pfeil zurück, daneben eine weiße **Kapsel mit dem Liedtitel** (darunter Tonart, Fassung, Tempo),
   rechts **ein** runder **Werkzeuge**-Knopf (drei Regler). Alles scharf, der Titel deutlich länger
   lesbar als vorher. Werkzeuge antippen → Menü mit **Aussehen, Tempo, Anmerken** (mit Team-Recht
   zusätzlich „Notizen von …", reingezoomt zusätzlich „Zoom zurücksetzen"). Puls einschalten → der
   Knopf ist blau. **Anmerken** → der Knopf wird zum blauen Haken, ein Tipp darauf beendet das
   Zeichnen. Solange das Werkzeuge-Menü (oder Aussehen/Tempo) offen ist, ist der Knopf **hellblau**;
   ebenso die Titel-Kapsel bei offenem Lied-Menü. Titel und Infos stehen in der Kapsel **mittig**.
   Beim ersten Öffnen erscheint die Einführung neu, mit einem Schritt „Werkzeuge".
   **iPad hochkant / breites Fenster (05.10.2026):** Statt des einen Knopfs stehen **Aa, Tempo,
   Anmerken** (ggf. Notizen von …, Zoom) einzeln rechts neben der Kapsel; Aussehen und Tempo öffnen
   unter ihrem Knopf. Am iPad im **Stage Manager** das Fenster schmal ziehen → die Knöpfe wandern hinter
   den einen Werkzeuge-Knopf, sobald der Titel zu eng würde; wieder breit ziehen → sie stehen wieder
   einzeln (ein offenes Werkzeuge-Menü schließt dabei).
   **iPad quer, zwei Lieder nebeneinander (#421):** Über jeder Hälfte stehen Titel-Kapsel UND die
   Werkzeuge (Aa, Tempo, Notizen von …, Anmerken) einzeln, mittig über dem Lied – auch auf einem
   kleinen iPad und quer auf dem iPhone (dort wird der Titel gekürzt). Das aktive Lied trägt einen
   blauen Ring, das andere ist blass. Tipp auf die blasse Kapsel → dieses Lied ist aktiv, **kein**
   Vollbild. Tipp auf „Aa" des blassen Lieds → es wird aktiv UND „Aussehen" geht auf. Lied-Menü,
   Aussehen und Tempo öffnen **unter ihrem Knopf**. Tipp aufs Blatt → nur Vollbild, das aktive Lied
   bleibt. Der Bereich oben ist am iPad so schmal wie vor
   v2.26.0.
6. **Ganz nach oben:** In einer langen Liste (z. B. Mehr) weit nach unten scrollen, dann unten auf
   den **Tab tippen, in dem du schon bist** → die Ansicht springt an den Anfang. (Der Tipp auf die
   Uhrzeit oben tut in einer Web-App nichts – das kann iOS nicht weitergeben.)
7. **Ganz nach unten (#408):** In Termine, Lieder, Abwesenheiten, Mehr und im Ablauf bis ans Ende
   scrollen. Der letzte Eintrag steht überall mit **derselben** Luft über der Tab-Leiste bzw. dem
   Home-Strich; bei den Abwesenheiten verdeckt das Plus ihn nicht.

<details><summary>Technisches</summary>

- **Priorität:** hoch
- **Betrifft:** `client/src/components/SeitenGeruest.tsx`, `client/src/components/KnopfReihe.tsx`, `client/src/components/ChartHeader.tsx`, `client/src/components/WerkzeugMenu.tsx`, `client/src/utils/onboarding.ts`, `client/src/components/Segment.tsx`, `client/src/components/GrosseUeberschrift.tsx`, `client/src/components/Screen.tsx`, `client/src/components/Screen.module.scss`, `client/src/components/TabBar.tsx`, `client/index.html`, `client/src/styles/_variables.scss`
- **Automatisiert:** teilweise – `client/src/components/SeitenGeruest.test.tsx` (Überschrift im Inhalt, runde Knöpfe nur mit Zurück/Aktionen und außerhalb des Scroll-Bereichs, Überlagerung ebenso), `client/src/components/ChartHeader.test.tsx` (Werkzeuge-Menü je Bedingung, Haken beim Zeichnen, Personen-Knopf beim Ansehen, kein Schließen nach einem Eintrag, Hochformat nach Breite samt Wechsel beim Größerziehen und Regel `werkzeugeEinzeln`), `e2e/chart-tempo.spec.ts` und `e2e/auth-flow.spec.ts` (Tempo und Anmerken über das Menü), `e2e/chart-querformat.spec.ts` (Querformat: Wahl per Kapsel ohne Vollbild, Werkzeug des anderen Lieds, Blatt = nur Vollbild), `client/src/components/Screen.zumAnfang.test.tsx` (aktiver Tab scrollt nach oben); von Hand bleibt, wie es unter dem echten Unschärfe-Band aussieht
- **Historie:** Kopfzeilen-Umbau 21./22.09.2026; runde Knöpfe, Liedblatt mit einem Werkzeuge-Knopf und sichtbare Umschalter-Schiene 02.10.2026 (am selben Tag am Gerät widerlegt: eine deckende Statusleiste beseitigt das milchige Band nicht); Werkzeuge im Hochformat einzeln nach Fensterbreite 05.10.2026

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

### TF-KOPF-03 · Schalter im Tab „Mehr" schalten mit einem Tipp

**Das brauchst du:** Ein Gerät mit der App; für den dritten Schalter ein Konto mit Team-Notizen.

**Das muss passieren:** Jeder Schalter springt bei **einem** Tipp um – egal ob auf die Beschriftung
oder auf den Schalter selbst. Die Zeilen sehen aus wie vorher (Umbau #407, 23.09.2026: die Seite ist
in Bausteine geteilt, die Schalter sind jetzt je ein einziger Knopf).

1. Tab **Mehr**. Auf den **Text** „Display aktiv halten" tippen → der Schalter springt um. Noch einmal
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
