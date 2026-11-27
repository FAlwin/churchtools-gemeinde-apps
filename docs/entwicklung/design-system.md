# Design-System (Look der ChurchTools-Weboberfläche)

Verbindliche Regeln für das Aussehen. Ziel: Farben/Rundungen/Abstände kommen aus **einer Quelle**,
damit nichts „durchsickert" (z. B. früher Orange).

**Seit #654 (22.10.2026) ist das Vorbild die ChurchTools-Weboberfläche – für ALLE Apps, auch die Musik-App
als PWA** (Alwin: „CT-Web-Look für alle“, Geltung „überall“). Das löst #393 ab (19.09.2026: Look der
ChurchTools-App). Werte gemessen in der Test-Instanz (`body.light`, ChurchTools' eigene Tokens
`--color-background-*`, `--color-basic-*`, `--color-accent-*`, `--radius-*`, `--font-sans`): Seite slate-100,
weiße Karten mit 8 px Rundung, Rand slate-200 und leichtem Schatten, Text slate-900/600/400, Blau blue-600
`#155DFC`, Knöpfe 4 px, Schrift **Lato**. Nachgeschärft wird NUR in `_variables.scss` – vorher dort messen.
Das Dunkel ist seit #565 das von ChurchTools (`dunkelmodus.md`).

## Farben – nur über Tokens

Einzige Quelle: `ui/design/_variables.scss` (Light = `:root`, Dark = `html[data-theme='dark']` – die Farben von
ChurchTools). Die hellen Werte selbst stehen seit O7b-4 im Mixin `hell` in `ui/design/_farben.scss`: `:root` bindet
ihn ein, und Papier (Organigramm-PDF, `organigramm/src/Blatt.module.scss`) ebenfalls – so bleibt ein Blatt auch im
Dunkelmodus hell, ohne dass ein Wert zweimal dasteht.
**Einzige Ausnahme: `--sat`** (Safe-Area oben) wird in JS gemessen – siehe Tabelle unten und die Regel
am Ende dieses Dokuments.
**Keine rohen Hex-/rgba-Werte in Komponenten** (Ausnahmen: reine Schatten, Overlays, `#fff` auf farbigen Flächen).

| Token                                                          | Zweck                                                                                                                                                                                                                                                                                     |
| -------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `--bg`                                                         | Seitenhintergrund                                                                                                                                                                                                                                                                         |
| `--surface2`                                                   | Karten / Listen / Header                                                                                                                                                                                                                                                                  |
| `--surface3`                                                   | Sekundärflächen auf **weißen** Flächen (Kacheln, Pills, Tipp-Zustände). Im Hellen exakt `--bg` – direkt auf der Seite unsichtbar, deshalb nie für Felder                                                                                                                                  |
| `--border` / `--hair`                                          | Rahmen / 1px-Trenner                                                                                                                                                                                                                                                                      |
| `--text` / `--text2` / `--text3`                               | Primär / Sekundär / Tertiär                                                                                                                                                                                                                                                               |
| `--blue` / `--blue-ink` / `--blue-soft`                        | **Primär**: Buttons, Links, aktive Tabs, Akzente                                                                                                                                                                                                                                          |
| `--blue-tile` / `--blue-tile-text`                             | Datumskachel (Tag / Monat) – hellblau mit dunkler Schrift wie „Anstehende Termine" in der App                                                                                                                                                                                             |
| `--section`                                                    | Band hinter Gruppen-Überschriften (für Listen im Stil „Dienste")                                                                                                                                                                                                                          |
| `--red`                                                        | **Destruktiv**: Abmelden, Löschen, offene Dienste, Abwesend                                                                                                                                                                                                                               |
| `--green`                                                      | Bestätigt / offline vorhanden / Etikett (vorher drei verschiedene Fallback-Werte in drei Dateien)                                                                                                                                                                                         |
| `--r-card` / `--r-tile` / `--r-ctrl` / `--r-dialog`            | **Rundungen** (8 / 6 / 4 / 8 px, wie ChurchTools `--radius-lg/md/sm`): Karten, Kacheln, Bedienelemente, Dialoge – keine nackten Pixelwerte in neuen Komponenten                                                                                                                           |
| `--knopf-hoehe`                                                | **Höhe aller Knöpfe und Bedienelemente einer Reihe** (38 px, 28.10.2026): Kopf-, Zeilen- und Fensterknöpfe, Umschalter (`Segment`, eine Reihe), Auswahl- und Suchfelder in Leisten. Vorher standen im Organigramm 30–40 px nebeneinander. Neue Knöpfe nehmen diesen Wert, nicht `padding` |
| `--track-off`                                                  | Toggle-Schiene (aus). Das **Gewählte** eines Umschalters hat seit 30.10.2026 keine eigene Farbe mehr: `auswahlKnopfAn` = Rand `--blue`, Fläche `--blue-soft`, Schrift `--blue-ink` (Variante B)                                                                                           |
| `--ebene-fenster` / `--ebene-bestaetigung` / `--ebene-hinweis` | **Stapelreihenfolge der Fenster** (20.11.2026): Fenster 2600 < Bestätigung 2700 < Hinweis 2800, über dem Vollbild (`--ebene-vollflaeche`) und unter der Einführung (3000). Wirken, weil `FensterEbene` die Fenster unter `#root` zeichnet (Regel „Fenster liegen immer ganz oben“)        |
| `--scrim`                                                      | Overlay hinter Sheets/Dialogen                                                                                                                                                                                                                                                            |
| `--nav-bg` / `--shadow`                                        | Leisten (deckend, = `theme-color`) / Karten-Schatten                                                                                                                                                                                                                                      |
| `--ui`                                                         | System-Schriftfamilie (kein Web-Font)                                                                                                                                                                                                                                                     |
| `--kb`                                                         | **Höhe der iOS-Tastatur** – wird von `ui/fenster/useOverlayKeyboardInset` am `visualViewport` gemessen (nur auf Dialog-Overlays gesetzt, siehe Regel unten)                                                                                                                               |
| `--sat`                                                        | **stabile iOS-Safe-Area oben** – Ausnahme: wird in `client/src/main.tsx` per verstecktem Probe-Element **in JS gemessen**, steht NICHT in `_variables.scss`                                                                                                                               |

**Es gibt bewusst KEIN `--orange`, `--teal`, `--chord`.** Akzent = Blau, Destruktiv = Rot.
Wer eine „auffällige" Farbe braucht: `--blue` (Aktion) oder `--red` (Warnung/Destruktiv).

Akkorde/Anmerkungen: Akkorde im Chart sind **schwarz/fett** (SongSelect-Stil). Die
Anmerkungs-Stiftfarben (Palette inline in `pages/ChordChart.tsx`) sind
**Rot `#bb2946`, Blau `#0062ac`, Türkis `#1bb0a2`, Orange `#fb8f00`** – Standard Blau,
plus freier Farbwähler.

## Schrift

**Lato** über `var(--ui)` wie ChurchTools. In ChurchTools ist sie geladen; die Musik-App als PWA und das
öffentliche Formular bringen sie selbst mit (`ui/design/schrift.ts`, Paket `@fontsource/lato`, offline im Service
Worker) – kein Google-Font-Import. Erweiterungen laden sie **nicht** (eine zweite `@font-face` „Lato“ träfe
ChurchTools). Ausnahme: der ChordPro-**Editor** nutzt bewusst Monospace (`'JetBrains Mono', monospace`) für die Roh-Bearbeitung.

## Wiederverwendbare Bausteine

- **SCSS-Mixins** (`ui/design/_mixins.scss`): `card-list` (Rand + `--r-card`), `group-header`, `list-row`,
  `key-pill`, `neues-lied-aktion` (die ruhige Textaktion „Neues Lied" – im Liederheft **und** in der
  Liedsuche des Ablaufs, deshalb geteilt), **`eingabefeld`** (05.10.2026: das EINE Aussehen aller
  Eingabefelder – weiß, feiner Rand, Fokus blau; `$innen: true` für einen Rahmen um Lupe + Eingabe.
  Vorher neun Kopien mit 1 bzw. 1,5 px Rand, und Suchfeld/Von–Bis trugen `--surface3`, waren auf der
  Seite also unsichtbar). In Modulen:
  `@use '@ui/design/mixins' as m;` → `@include m.card-list;`.
- **Komponenten:** `Segment` (Auswahl 2–3 Optionen), `NoteTile` (Noten-Kachel),
  `Icon` (`ui/icons/icons.tsx`, Line-Icons – keine Emojis in der UI), **`SeitenGeruest`** (das
  Gerüst JEDES Bildschirms: Seitenkopf, Scrollen, Neuladen – seit 22.09.2026 der
  Normalweg, `Screen`/`Scroll`/`SeitenKopf` sind seine Bausteine; **`KopfKnopf`/`KopfZurueck`**
  (`ui/bedienung`, Scheibe S 26.10.2026) für Aktionen und Zurück im Kopf – eckig mit Rahmen und
  Beschriftung wie in ChurchTools, am Handy nur Symbol; `neu` = grün zum Anlegen wie „+ Gruppe erstellen“,
  S2; `raster` = Symbol über Kurzwort im Liedblatt am Handy, `offen` = sein Fenster ist offen, B1; die runden
  Knöpfe `RundKnopf`/`KnopfReihe` sind seit B1 gelöscht), **`BlattKopf`/`AblaufLeiste`** (Kopfkarte des Liedblatts,
  B1+B2: breit/kompakt/flach nach `kopfAufbau`), **`ZeilenKnopf`** (S2: eckige Knöpfe mit Rahmen in Listenzeilen –
  Plus, Stift), **`FilterKnopf`/`ZeitraumKnopf`** (`ui/bedienung`, seit 28.10.2026 aus dem Dienstplaner herausgelöst –
  Dienstplaner › Termine/Planen und Abwesenheiten der Musik-App; das Aufklappen regelt `useAufklapp`, auch für
  `HinzufuegenMenue`), **`AuswahlFenster`/`HinzufuegenMenue`** (`ui/bedienung/OptionWaehlen`, S2: „Option wählen“ – am Handy ein Fenster
  (`Sheet`, seit 20.11.2026 – vorher Blatt von unten), am iPad/Rechner Menü unter dem grünen Knopf),
  **`MehrfachWahl`** (`ui/bedienung`, 27.11.2026: Feld mit Häkchen-Liste nach Gruppen, mehrere auf einmal – am Handy ein
  Fenster, sonst im Fluss unter dem Feld; Protokolle „Ressourcen wählen“; Pfeil der Auswahlfelder: Mixin `auswahlpfeil`), `TabBar`
  (Reiter der Musik-App in der gemeinsamen `ui/bedienung/ReiterLeiste` – am Handy unten, sonst `oben` als
  Textreiter; Grenze `HANDY_BREITE` für alle Apps),
  `Sheet`, `ConfirmDialog`, **`SchwebePlus`** (das runde Plus unten rechts – Abwesenheiten, Lieder und Ablauf; seit S2
  in der Musik-App nur am Handy; „etwas anlegen“ groß grün / Handy Plus baut **`useNeuAnlegen`** für alle Seiten),
  `SongFields` (die Stammdaten-Felder eines Liedes – von „Neues Lied" und
  „Stammdaten ändern" gemeinsam genutzt, damit es die fünf Felder nur einmal gibt).
- **Ruhige Bedienung (Bauplan `bedienung-planung`, Scheibe B1, 20.11.2026):**
  - **Stille Stufe:** `KopfKnopf still` – ohne Rand und Fläche, Schrift in der Knopffarbe, erst beim Darüberfahren
    (nur Maus) hellblau hinterlegt; in Werkzeugzeilen der Normalfall (R2). `still` und `haupt`/`neu`/`gefahr`
    schließen sich im Typ aus; `offen`/`aktiv` behalten ihre hellblaue Fläche. **Am Handy** (Grenze `HANDY_BREITE`)
    bekommt der stille Knopf von selbst Rand und Fläche zurück (R12 – „kein Knopf ohne Rahmen“); dafür gibt es keine
    eigene Angabe. Seit B3 nutzen sie die Werkzeugzeilen (`MehrMenue`, `FilterKnopf still`).
  - **Am Handy zeigt `KopfKnopf` nur das Symbol** (R12). **Ausnahme `wortAmHandy`:** für kurze Karten-Aktionen, bei denen ein Symbol allein nicht reicht – das Wort bleibt stehen, der Knopf wird so breit wie nötig, am Rechner sieht er aus wie ohne das Merkmal. Beispiel: „Ablauf & Dienste“ und „Live“ in „Als Nächstes“ auf der Startseite des Dienstplaners. Nicht für Werkzeugzeilen.
  - **Seitenkopf der Erweiterungen** (`ErweiterungsSeite`, B8b; R8/E24): EINE Stelle für alle Apps – oben klein der App-Name (ohne
    Gemeindenamen, der steht in der ChurchTools-Leiste), darunter die unterstrichenen Reiter (am Handy unten), **„Hallo …“ nur auf der
    Startseite** (= der erste Reiter ist aktiv; `gruss={false}` sperrt es zusätzlich, z. B. in der Suche), volle Breite (Wächter
    `seitenBreite`). **Einstellungen als letzter Reiter** (E24): die App gibt nur `einstellungen={{ onOeffnen, offen }}` – Name, Zahnrad und
    Platz (ganz rechts) kommen vom Rahmen; ohne eigene Reiter entsteht davor ein einzelner Start-Reiter (`startName`). Der Reiter öffnet das
    Fenster der App (E18), hat keine eigene Adresse; wer die Einstellungen nicht öffnen darf, gibt nichts – kein Recht, kein Reiter.
  - **`Etikett`** (`ui/bedienung`, aus `anmeldungen/src/Etikett.tsx` gehoben; R9/E24): das eine Status-Etikett – eine Kapsel, vier Töne
    (`neutral` grau, `blau` deine Rolle/in Arbeit/wartet, `gruen` fertig, `rot` Aufmerksamkeit). Nur Anzeige: Was man antippt, ist ein
    Knopf; ein Zähler am Reiter ist `ReiterZaehler`. Wächter `etiketten.test.ts` zählt je App die Kapseln (`border-radius: 999px`) in
    den Stildateien und kennt nur noch Knöpfe/Wähler (Obergrenzen, nie erhöhen). Seit B8c auch für die Musik-App (`client`): „Kein Ablauf“,
    „Standard“ (Arrangement) und „nur ansehen“ (Ablaufvorlagen) sind `Etikett`; Tonart-Pille (Daten), Wähler-`chip` und Ablauf-Tags bleiben.
    Die Musik-App zeichnet ihre Reiter selbst (`TabBar` → `ReiterLeiste`): `appName` setzt den kleinen App-Namen über die Reiter, nur
    oben (iPad/Rechner), nie am Handy.
  - **`SuchLupe`** (`ui/bedienung`, aus der `SuchLeiste` der Protokolle gehoben; R7): Lupe rechts neben den Reitern,
    ein Tipp klappt das Feld auf und setzt den Cursor hinein; ✕ oder Esc (`useEscape`) klappt zu. Die App hält
    `offen` und `begriff` selbst. Feste Suchfelder auf Seiten (nicht in Fenstern) wechseln später darauf: Organigramm
    `Personen`, Dienstplaner `Fokus`/`WerKann`, Anmeldungen `AnmeldungenReiter`/`BaukastenLeiste`, Musik-App
    `LiedSucheKopf`.
  - **`Werkzeugzeile`** (`ui/bedienung`, B3; R5/R12/E6/E9): die eine Zeile über dem Inhalt einer Arbeitsansicht – `links` (Ansicht),
    `mitte` (Zeitraum, bleibt in der Fenstermitte: Raster `1fr auto 1fr`), `rechts` (Filter, „⋯“). Am Handy zweizeilig (oben
    Ansicht und Werkzeuge, darunter der Zeitraum über die ganze Breite) und mit Rahmen um jedes Element der rechten Seite. Dazu
    **`AnsichtWahl`** (Rechner: `Segment verbunden`; Handy: blauer Knopf in Wortbreite mit Pfeil, öffnet ein `AuswahlFenster`) und
    **`FilterKnopf still`** (ohne Rand; Abschnitt `anzeige` für Schalter wie „Breite Spalten“ – zählt nicht in die Zahl am Knopf).
    Der Zeitraum ist ein gerahmtes Element ‹ Zeitraum ›; „＋ früherer / späterer Termin“ liegen im Fenster des `ZeitraumKnopf`
    (`dazu`). Wer eine Werkzeugzeile braucht, nimmt diese Bausteine (B4–B8) und hängt nichts Eigenes an.
  - **`MehrMenue`** (`ui/bedienung`, B3; R6/E3): das „⋯“-Menü für Seltenes. Rechner: kleines Menü (`KnopfMitMenue`), Handy: ein
    Fenster (`AuswahlFenster`). Jeder Eintrag (`Option`) mit `symbol` und Wort, `gesperrt` für „gerade nicht möglich“; Linien
    zwischen Gruppen über `trenner`. **Erst schließt das Menü, dann läuft die Aktion** – eine Aktion, die ein Fenster öffnet, wird
    sonst vom Schließen zurückgesetzt (Lehre 05.08.2026); jeder Eintrag bekommt einen eigenen Test (`MehrMenue.test.tsx`).
    Fenster, die ein Eintrag öffnet, gehören der Seite (eigener Zustand), nicht dem Menü (`HilfeFenster`).
  - **`ZeitraumLeiste`** (`ui/bedienung`, B4; R5): ‹ Zeitraum › als EIN gerahmter Baustein für die Mitte der Werkzeugzeile; die Pfeile
    bekommen vom Aufrufer Name, Zustand und Wirkung („Planen“: `Terminleiste`, „Verfügbarkeit“: `AbwesenheitenSeite`). Statt eines
    Zeitraums für „Dienste“ lässt man `mitte` weg – `rechts` bleibt trotzdem rechts. **`TextKnopf`** (B4; R2): ein stiller Knopf als
    blaues Wort („Weitere Wochen laden“, „Alle Termine zeigen“). **Merker an einer Ansicht** (E24): `AnsichtWahl` mit `zahl` zeigt einen
    blau gefüllten Kreis (`ReiterZaehler ton="blau"`) direkt hinter dem Wort; Rot bleibt dem Alarm („fällig“) vorbehalten.
  - **Wächter `ui/design/bedienKnoepfe.test.ts`:** zählt je App rohe `<button>` und feste Pixelhöhen in Knopf-Regeln
    und hält den Stand als Obergrenze fest. Steigt eine Zahl, nimm einen Baustein aus `ui/bedienung`; fällt sie,
    verlangt der Test die niedrigere Obergrenze – **Obergrenzen nie erhöhen**.
- **Lied suchen – ein Feld, eine Zeile, ein Angebot** (#378): `LiedSucheKopf` (nur das Suchfeld, Lupe
  innen, `m.eingabefeld`), **`LiedZeile`** (die Liedzeile mit Auge = Vorschau und Plus = einfügen; ohne
  `aktion` eine Pfeil-Zeile – dieselbe Optik für Bibliothek, SongSelect und Liedtexte, vorher drei
  verschiedene) und `SucheAngebot` (die dezente gestrichelte Zeile „Bei SongSelect nach …" / „Auch in den
  Liedtexten nach …" am Listenende – ein Weg, keine Aktion). `LiedTreffer.module.scss` trägt nur noch
  Gruppen-Überschrift (`.kopf`) und Hinweise (`.hinweis`). Vorher hatte jede Ansicht ihre eigene Kopie des
  Suchfelds; seit dem 03.09.2026 nutzt auch das Liederheft diese Bausteine. **Regel daraus:** Wer eine
  vierte Suche oder eine weitere Liedliste braucht, nimmt diese drei, statt ihre Optik nachzubauen. Zwei
  frühere Anläufe (Quellen-`Segment` über der Liste, blaue Angebots-Knöpfe darunter) sind weg.

## Ruhige Bedienung: Regeln R1–R13

Die dreizehn Regeln aus dem Bauplan (R13 kam am 20.11.2026 dazu) `bedienung-planung/docs/bauplan.md` (freigegeben 20.11.2026). Sie legen fest, **wie viele**
Bedienelemente über einer Ansicht stehen und **wie laut** sie sein dürfen. Farben und Schrift bleiben ChurchTools. Keine Funktion
fällt dabei weg, sie liegt höchstens einen Klick tiefer.

Die Tabelle nennt je Regel den Baustein in `ui/bedienung`, der sie umsetzt, und den Wächter-Test in `ui/design`, der sie prüft.
Die Einzelheiten der Bausteine stehen im Abschnitt „Wiederverwendbare Bausteine“ (Unterpunkt „Ruhige Bedienung“) und werden
hier nicht wiederholt. Ein Wächter zählt Obergrenzen oder Stile; wo kein Wächter die Regel prüft, steht „–“.

| Nr. | Regel in einfacher Sprache                                                                                                                                                                                                                                                                                                                                         | Baustein                                                                                               | Wächter                                                  |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------ | -------------------------------------------------------- |
| R1  | Pro Ansicht ist höchstens **ein** Knopf gefüllt: die Hauptaktion, blau oder grün.                                                                                                                                                                                                                                                                                  | `KopfKnopf` (Stufe `haupt` oder `neu`)                                                                 | – (`bedienKnoepfe.test.ts` zählt nur rohe Knöpfe je App) |
| R2  | Es gibt drei Knopf-Stufen: gefüllt (Haupt), weiß mit Rand (Neben), ohne Rand (Still). In Werkzeugzeilen ist Still der Normalfall. Ein stilles blaues Wort ist ein `TextKnopf`, eine ganze Zeile als Knopf ist eine `KlickZeile`.                                                                                                                                   | `KopfKnopf` (`haupt`, `neu`, `gefahr`, `still`), `TextKnopf`, `KlickZeile`                             | `bedienKnoepfe.test.ts`                                  |
| R3  | Grün heißt immer **hinzufügen**: je Ansicht höchstens einmal, am Rechner oben rechts (bei mehreren Dingen „Neu ⌄“), am Handy der schwebende grüne Kreis mit „+“. Blau gefüllt ist die Hauptaktion. Rot steht nur für Löschen und Verwerfen – als Text; **Ausnahme:** ein Knopf der Stufe `gefahr` am `KopfKnopf` darf einen roten Rand haben (wie in ChurchTools). | `useNeuAnlegen`, `HinzufuegenMenue` (in `OptionWaehlen.tsx`), `SchwebePlus` – `KopfKnopf neu` nur dort | `stufenPlus.test.ts`, `neuNurSchwebend.test.ts`          |
| R4  | Bereichs-Reiter sind **unterstrichen**, in allen Erweiterungen gleich. Der Kasten-Umschalter (`Segment`) ist nur für die Ansichtswahl da, höchstens einer je Zeile.                                                                                                                                                                                                | `ReiterLeiste`, `ErweiterungsSeite` (liegt in `ui/erweiterung`), `AnsichtWahl`                         | `reiterUnterstrichen.test.ts`                            |
| R5  | Über dem Inhalt steht **eine** Werkzeugzeile: links die Ansicht, in der Fenstermitte der Zeitraum (ein gerahmtes Element), rechts Filter und „⋯“.                                                                                                                                                                                                                  | `Werkzeugzeile`, `AnsichtWahl`, `ZeitraumLeiste`, `FilterKnopf`                                        | –                                                        |
| R6  | Seltenes steht im **„⋯“-Menü** (jeder Eintrag mit Symbol und Wort). Schalter und Sortierungen stehen im Filter; der Filter-Knopf zeigt die Zahl aktiver Filter.                                                                                                                                                                                                    | `MehrMenue`, `FilterKnopf`                                                                             | –                                                        |
| R7  | Die **Suche ist eine Lupe** rechts neben den Reitern. Ein Klick klappt das Feld auf, Esc oder ✕ klappt es zu.                                                                                                                                                                                                                                                      | `SuchLupe`                                                                                             | –                                                        |
| R8  | Ein **Seitenkopf** für alle Erweiterungen: gleiche Breite, klein der App-Name oben, Einstellungen als letzter Reiter. „Hallo …“ steht nur auf der Startseite.                                                                                                                                                                                                      | `ErweiterungsSeite` (liegt in `ui/erweiterung`)                                                        | – (`seitenBreite.test.ts` prüft nur die Breite)          |
| R9  | Ein **Status-Etikett** in einer Form und vier Farben: grau, blau, grün, rot.                                                                                                                                                                                                                                                                                       | `Etikett`                                                                                              | `etiketten.test.ts`                                      |
| R10 | Fehlt an einer Stelle etwas, steht dort ein **leises gestricheltes „+“**. Es hat keine Farbe und keine Fläche; die Farbe trägt nur die Zahl in der Überschrift.                                                                                                                                                                                                    | `LeisesPlus`                                                                                           | `stufenPlus.test.ts`                                     |
| R11 | **Zeilen-Werkzeuge erst bei Bedarf:** ein „⋯“ je Zeile. Am Rechner erscheint es erst beim Darüberfahren, am Handy ist es immer sichtbar.                                                                                                                                                                                                                           | `ZeilenKnopf`, `KnopfMitMenue` (in `OptionWaehlen.tsx`)                                                | –                                                        |
| R12 | **Am Handy steht kein Knopf frei.** Jedes Bedienelement der Werkzeugzeile hat dort einen Rahmen.                                                                                                                                                                                                                                                                   | `Werkzeugzeile`, `KopfKnopf` (Still bekommt am Handy Rahmen und Fläche)                                | –                                                        |
| R13 | **Höchstens ein Reiter „Einstellungen“ je Erweiterung, immer der letzte, nur Einstellungen** (dazu Hilfe, Version und Abmelden erlaubt). Arbeitsseiten (z. B. die Ablaufvorlagen) gehören in den Reiter, zu dem sie fachlich gehören, meist ins „⋯“. Grund: die ChurchTools Dev Platform sieht je Erweiterung eine Einstellungsseite vor.                          | `ErweiterungsSeite` (Prop `einstellungen`), `TabBar` der Musik-App                                     | `einstellungenReiter.test.ts`                            |

## Fenster wie ChurchTools (E6-O F1, #716) – verbindlich für neue und umgezogene Fenster

Entwurf `dienstplaner-planung/entwurf/fenster-entwurf.html`, abgenommen 23.10.2026 (Vorbild: Fenster der
ChurchTools-Weboberfläche):

- **Kopf:** Titel links, **X rechts** zum Schließen (für Screenreader „Fenster schließen“, damit es sich vom Knopf
  „Schließen“ unterscheidet). **Fußzeile:** Knöpfe **rechts unten**, „Abbrechen“ mit Rahmen und blauer Schrift,
  daneben der Hauptknopf – am Rechner keine Knöpfe über die ganze Breite. **Am Handy** (≤ 480 px) stehen sie
  untereinander über die volle Breite, der Hauptknopf oben (`m.fensterKnopfZeile`, E6-O F2 #720). Passen sie auch am
  Rechner nicht nebeneinander (drei lange Knöpfe), stehen sie ebenso untereinander – die Zeile misst sich selbst
  (`useKnopfZeile`, F3 #726).
- **Fenster sind immer Modale – und liegen immer ganz oben** (Alwin, 20.11.2026: „alles mit Modalen machen und nicht mit Drawer“; am iPhone lag das schwebende Plus über „Zeitraum eintragen“). Es gibt **kein Blatt von unten** mehr: Auswahlen („⋯“, „Matrix ⌄“, „Neu ⌄“) öffnen am Handy ein `AuswahlFenster`, also ein `Sheet`. `Sheet` und `ConfirmDialog` zeichnen sich über **`FensterEbene`** (`ui/fenster/FensterEbene.tsx`) als Kind direkt unter `#root` – nicht dort, wo die Seite sie aufruft: Jeder Kasten darüber mit `z-index`, `transform`, `opacity` oder `filter` (die klebende Leiste in „Wann kann ich?“ hatte `position: sticky; z-index: 2`) macht einen eigenen Stapel auf und sperrt das Fenster samt seiner 100 darin ein. Die Zahlen stehen als `--ebene-fenster` & Co. in `_variables.scss`; Wächter `ui/design/ebeneFenster.test.ts` und `ui/fenster/FensterEbene.test.tsx`. Ein neues Fenster ist ein `Sheet` – nie ein eigenes `position: fixed` mit `--scrim`.
- **`Sheet` mit `knoepfe`** bekommt diesen Aufbau; Kopf und Fuß stehen, der Inhalt dazwischen scrollt (die _eine_
  Scrollfläche des Fensters). Umgezogen wurde App für App (Dienstplaner F2, Musik-App F3, Anmeldungen F4,
  Organigramm und Protokolle F5); seit F5 hat **jedes** Fenster `knoepfe`. Der Test `ui/fenster/fensterAufbau.test.ts`
  prüft alle Apps – ein neues Fenster ohne `knoepfe` fällt dort auf. Der Hauptknopf zieht dabei aus dem Inhalt in `knoepfe` (statt `m.hauptKnopfBreit`). Fenster nur
  zum Ansehen oder Wählen reichen `knoepfe={null}` – sie haben **keine Fußzeile**, geschlossen wird mit dem X (Alwin,
  02.11.2026: „Schließen und X ist doppelt“). Das gilt auch, wenn ein Fenster nur gerade keinen eigenen Knopf hat
  (Ergebnis nach dem Senden, Laden). `fensterAufbau.test.ts` meldet ein `cancelLabel` neben `knoepfe={null}`. Aktionen, die zum Inhalt gehören (in einer
  Liste, „Andere Person wählen“ am Entwurf), bleiben im Inhalt; ein Nebenweg wie „Neu vorschlagen“ steht als Link
  (`m.textKnopf`) am Ergebnis, nicht unten. **Zwei gleichwertige Wege** (PDF: Herunterladen / Teilen; Zeitraum:
  löschen / anpassen) stehen beide unten: zweiter Weg `hell` oder `gefahr`, Hauptweg zuletzt (Alwin, F3 #726).
  Fenster mit Formular und weiteren Bereichen („Lied bearbeiten“, „Arrangement“) haben „Speichern“ unten; seltene,
  folgenreiche Wege („Zum Standard machen“, „Löschen …“, „Baustein entfernen“) bleiben getrennt im Inhalt.
- **Zurück-Pfeil „‹“** (Alwin, 02.11.2026: „Wechselt ein Screen im Fenster, soll es einen Zurück-Pfeil geben“;
  Entwurf `musik-planung/entwurf/fenster-zurueck-v1/`): Geht ein Fenster aus einem anderen auf oder wechselt es seine
  Seite, steht vor dem Titel „‹“ (`Sheet zurueck`) – ein Schritt zurück zum Vorgänger; das X schließt alles. Liegt
  das Fenster **über** einem anderen (Umbenennen über den Dateien, Arrangement über den Stammdaten), führen „‹“ und
  „Abbrechen“ zurück (`onAbbrechen`), das X schließt beide. Ein „Zurück“-Knopf unten gehört nicht mehr dorthin.
- **Feldliste „Beschriftung | Feld“** (Punkt-Fenster, E6-O O3, Variante B): in einer umrandeten Fläche, eine feine
  Linie je Zeile; alle Felder auf einmal bearbeitbar, unten einmal „Speichern“. Werte, die eine eigene Auswahl
  brauchen (Lied, Zuständig), sind **Zeilen mit Pfeil**, die IM Fenster öffnen; leer steht „+ Hinzufügen“. Ja/Nein als
  Schalter in der Zeile. Mit `mittel` (560 px); „Eintrag löschen“ als `links` mit `FensterKnopf art="loeschen"`. Hat
  das Fenster ungespeicherte Änderungen, reicht es `onHintergrund`, damit ein Tipp daneben nichts verwirft;
  ‹ › zum Nachbarn sind dann gesperrt (Alwin, 28.10.2026), und beim Blättern gilt `einblenden={false}`.
- **Mehrstufige Fenster** (Assistent, Rückfrage im Fenster, Vorschau): **„‹“ oben** führt einen Schritt zurück, unten
  „Abbrechen“ und der Hauptknopf (seit 02.11.2026, Entwurf „Fenster mit Zurück“; vorher „Zurück“ unten, F4 #734 –
  `fensterAufbau.test.ts` meldet einen „Zurück“-Knopf unten). „Abbrechen“ bricht einen **vorwärts gerichteten** Schritt
  ganz ab (wie das X; bei „Person dazu“ zurück in die Anmeldung). Bei einer **Rückfrage oder Unterseite** („1 Mail jetzt
  senden?“, „Sitzung absagen“, „Umhängen?“, „Zuständig“) führt „Abbrechen“ wie in ChurchTools dorthin zurück, wo man
  herkam (`onAbbrechen`) – nie geht dabei Geschriebenes verloren. Ersetzt eine Rückfrage den Inhalt eines Fensters
  („Absagen?“ im Fenster einer Anmeldung), heißt ihr Weg zurück „Abbrechen“ und führt zur Ansicht davor, nicht aus dem
  Fenster. Ein Schritt **ersetzt** den Inhalt, statt unter ihm zu hängen –
  sonst stünde „Austragen“ unten sichtbar, während die Frage weggescrollt ist (Alwin, F5: Gruppenfenster im
  Organigramm). Hängt der Hauptknopf am Zustand des Schritts (gewählte Rolle), hält das Fenster diesen Zustand; ein
  Formular im Schritt schickt der Fußknopf mit `type="submit" form={id}` ab. Öffnet ein Knopf etwas (`mailto:`), ist er
  ein `FensterLink`. Textknöpfe im Fließtext („Erneut versuchen“, „Wie heute“) nutzen `m.textKnopf`, keine eigene
  Kopie.
- **Während etwas läuft** (senden, speichern …) bekommt `Sheet` `beschaeftigt`: X, „Abbrechen“ und der Klick daneben
  sind gesperrt, wie im `ConfirmDialog`. Was gerade passiert, zeigt der Hauptknopf oder der Titel – nicht mehr ein
  Abbrechen-Knopf mit „Bitte warten …“.
- **`FensterKnopf`** (`ui/fenster/FensterKnopf`) ist die EINE Bauart dieser Knöpfe: `haupt` (blau), `gefahr` (rot),
  `zweit` (Rahmen, „Abbrechen“), `hell` (hellblau, ein zweiter Weg). Fenster gestalten ihre Knöpfe nicht selbst.
- **`ConfirmDialog`** ist schon umgezogen: Titel und Text linksbündig, X rechts (nicht, wenn es kein Abbrechen
  gibt), Knöpfe rechts unten; drei Wege (E6-5b) nebeneinander.
- **Felder:** fette Beschriftung über dem Feld, gerahmte Eingabe (`m.eingabefeld`), im Fokus blauer Rand **mit
  Schein**.

## Theme

Hell/Dunkel/Auto über `useSettings` → `data-theme` auf `<html>`. Komponenten dürfen sich
**nicht** selbst um Dark Mode kümmern – die Tokens schalten um. Falls doch nötig:
`:global(html[data-theme='dark'])` nur als letzte Option.

**Dunkel wie ChurchTools** – seit 19.10.2026 (#565) das einzige Dunkel, in allen Apps. Die Erweiterungen
Anmeldungen und Dienstplaner folgen der ChurchTools-Wahl (`ui/design/thema.ts`), die Musik-App ihrem eigenen
Schalter. Einzelheiten: [dunkelmodus.md](dunkelmodus.md).

## Abstand nach oben (Safe Area) – verbindlich

Kopfleisten und alles, was direkt unter der Statusleiste sitzt (Banner, Dropdowns), verwenden
**immer**:

```scss
padding-top: max(20px, var(--sat, env(safe-area-inset-top, 0px)));
// bzw. bei absolut positionierten Elementen:
top: calc(max(20px, var(--sat, env(safe-area-inset-top, 0px))) + Npx);
```

**Nie `env(safe-area-inset-top)` direkt** (#187): iOS setzt den Wert beim Schließen eines modalen
Dialogs kurz auf `0` zurück – mit `env()` schrumpft die Leiste im Transient von ~59px auf 20px und
die ganze Kopfleiste springt sichtbar. `client/src/main.tsx` misst den echten Wert über ein
verstecktes Probe-Element und hält ihn stabil in `--sat`; nur eine echte Orientierungsänderung darf
ihn senken (im Querformat gibt es oben oft keine Safe Area). Der `20px`-Boden fängt zusätzlich den
Safari-Tab-Fall ab (`env()` ist dort immer `0`), `env()` bleibt Fallback, solange `--sat` noch nicht
gemessen wurde → keine Regression auf Geräten ohne Safe Area.

Gerechnet wird damit nur noch in `ui/design/_variables.scss`: `--sat` steckt in `--inhalt-pad-top` (installierte App
am iPhone: Safe-Area + 36px, unter dem Unschärfe-Band) und `--bar-pad-top` (nur noch Grundlage des iPad-Werts). Jeder
Kopf beginnt mit `--inhalt-pad-top`; seit 29.10.2026 auch der Lied-Editor (`ui/lied/editor/ChordEditor.module.scss`), und
das Tempo-Menü rechnet seine Höhe mit der gemessenen Kopf-Unterkante statt mit einem Nachbau (`obenBand.test.ts`).

## Dialoge über der Tastatur (Safe Area unten) – verbindlich

Jedes Vollbild-Overlay mit Eingabefeldern (`Sheet`, `ItemActionSheet`, `ChordEditor`) ist
**`position: fixed`** – NIE `absolute`, sonst scrollt es mit dem Dokument mit, wenn iOS beim
Fokussieren die Seite hochschiebt – und spart die Tastatur aus:

```scss
padding-bottom: calc(16px + var(--kb, 0px));
```

`--kb` liefert der Hook `ui/fenster/useOverlayKeyboardInset` (Messung am `visualViewport`); er holt zusätzlich den
von iOS hinterlassenen Dokument-Scroll zurück. Ohne beides liegen Trefferlisten und Knöpfe unter der
Tastatur, und die Kopfleiste bleibt nach dem Schließen verrutscht (#207). Ohne Feld, in dem geschrieben wird, ist
`--kb` immer 0 – iOS meldet die Tastatur manchmal noch, wenn sie längst zu ist, und das Fenster behielt dann 0 px
(nur der Schleier, 30.10.2026). Ein Overlay behält außerdem immer `FENSTER_PLATZ_PX` (160 px).

**Ruhe statt Pixel-Verfolgung** (18.11.2026): `--kb` gilt erst `TASTATUR_RUHE_MS` nach dem letzten
`visualViewport`-Ereignis (iOS feuert beim Hochfahren der Tastatur viele); Schließen (0) gilt sofort. Solange die Tastatur
offen ist, setzt der Hook `data-tastatur` auf den Overlay – `Sheet.module.scss` verankert das Fenster dann oben
(`align-items: flex-start`, Rand 8 px, `max-height: 100%`), und das fokussierte Feld wird ins Bild geholt.
