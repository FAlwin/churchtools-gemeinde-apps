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
ChurchTools).
**Einzige Ausnahme: `--sat`** (Safe-Area oben) wird in JS gemessen – siehe Tabelle unten und die Regel
am Ende dieses Dokuments.
**Keine rohen Hex-/rgba-Werte in Komponenten** (Ausnahmen: reine Schatten, Overlays, `#fff` auf farbigen Flächen).

| Token                                               | Zweck                                                                                                                                                           |
| --------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `--bg`                                              | Seitenhintergrund                                                                                                                                               |
| `--surface2`                                        | Karten / Listen / Header                                                                                                                                        |
| `--surface3`                                        | Sekundärflächen auf **weißen** Flächen (Kacheln, Pills, Tipp-Zustände). Im Hellen exakt `--bg` – direkt auf der Seite unsichtbar, deshalb nie für Felder        |
| `--border` / `--hair`                               | Rahmen / 1px-Trenner                                                                                                                                            |
| `--text` / `--text2` / `--text3`                    | Primär / Sekundär / Tertiär                                                                                                                                     |
| `--blue` / `--blue-ink` / `--blue-soft`             | **Primär**: Buttons, Links, aktive Tabs, Akzente                                                                                                                |
| `--blue-tile` / `--blue-tile-text`                  | Datumskachel (Tag / Monat) – hellblau mit dunkler Schrift wie „Anstehende Termine" in der App                                                                   |
| `--section`                                         | Band hinter Gruppen-Überschriften (für Listen im Stil „Dienste")                                                                                                |
| `--red`                                             | **Destruktiv**: Abmelden, Löschen, offene Dienste, Abwesend                                                                                                     |
| `--green`                                           | Bestätigt / offline vorhanden / Etikett (vorher drei verschiedene Fallback-Werte in drei Dateien)                                                               |
| `--r-card` / `--r-tile` / `--r-ctrl` / `--r-dialog` | **Rundungen** (8 / 6 / 4 / 8 px, wie ChurchTools `--radius-lg/md/sm`): Karten, Kacheln, Bedienelemente, Dialoge – keine nackten Pixelwerte in neuen Komponenten |
| `--seg-on` / `--track-off`                          | aktives Segment / Toggle-Schiene                                                                                                                                |
| `--scrim`                                           | Overlay hinter Sheets/Dialogen                                                                                                                                  |
| `--nav-bg` / `--shadow`                             | Leisten (deckend, = `theme-color`) / Karten-Schatten                                                                                                            |
| `--ui`                                              | System-Schriftfamilie (kein Web-Font)                                                                                                                           |
| `--kb`                                              | **Höhe der iOS-Tastatur** – wird von `ui/fenster/useOverlayKeyboardInset` am `visualViewport` gemessen (nur auf Dialog-Overlays gesetzt, siehe Regel unten)     |
| `--sat`                                             | **stabile iOS-Safe-Area oben** – Ausnahme: wird in `client/src/main.tsx` per verstecktem Probe-Element **in JS gemessen**, steht NICHT in `_variables.scss`     |

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
  Gerüst JEDES Bildschirms: Überschrift, runde Knöpfe, Scrollen, Neuladen – seit 22.09.2026 der
  Normalweg, `Screen`/`Scroll`/`GrosseUeberschrift`/`KnopfReihe` sind seine Bausteine; `RundKnopf`
  für Aktionen in Detailansichten), `TabBar` (Reiter der Musik-App in der gemeinsamen
  `ui/bedienung/ReiterLeiste`),
  `Sheet`, `ConfirmDialog`, **`SchwebePlus`** (das runde Plus unten rechts – Abwesenheiten und Ablauf),
  `SongFields` (die Stammdaten-Felder eines Liedes – von „Neues Lied" und
  „Stammdaten ändern" gemeinsam genutzt, damit es die fünf Felder nur einmal gibt).
- **Lied suchen – ein Feld, eine Zeile, ein Angebot** (#378): `LiedSucheKopf` (nur das Suchfeld, Lupe
  innen, `m.eingabefeld`), **`LiedZeile`** (die Liedzeile mit Auge = Vorschau und Plus = einfügen; ohne
  `aktion` eine Pfeil-Zeile – dieselbe Optik für Bibliothek, SongSelect und Liedtexte, vorher drei
  verschiedene) und `SucheAngebot` (die dezente gestrichelte Zeile „Bei SongSelect nach …" / „Auch in den
  Liedtexten nach …" am Listenende – ein Weg, keine Aktion). `LiedTreffer.module.scss` trägt nur noch
  Gruppen-Überschrift (`.kopf`) und Hinweise (`.hinweis`). Vorher hatte jede Ansicht ihre eigene Kopie des
  Suchfelds; seit dem 03.09.2026 nutzt auch das Liederheft diese Bausteine. **Regel daraus:** Wer eine
  vierte Suche oder eine weitere Liedliste braucht, nimmt diese drei, statt ihre Optik nachzubauen. Zwei
  frühere Anläufe (Quellen-`Segment` über der Liste, blaue Angebots-Knöpfe darunter) sind weg.

## Fenster wie ChurchTools (E6-O F1, #716) – verbindlich für neue und umgezogene Fenster

Entwurf `dienstplaner-planung/entwurf/fenster-entwurf.html`, abgenommen 23.10.2026 (Vorbild: Fenster der
ChurchTools-Weboberfläche):

- **Kopf:** Titel links, **X rechts** zum Schließen (für Screenreader „Fenster schließen“, damit es sich vom Knopf
  „Schließen“ unterscheidet). **Fußzeile:** Knöpfe **rechts unten**, „Abbrechen“ mit Rahmen und blauer Schrift,
  daneben der Hauptknopf – am Rechner keine Knöpfe über die ganze Breite. **Am Handy** (≤ 480 px) stehen sie
  untereinander über die volle Breite, der Hauptknopf oben (`m.fensterKnopfZeile`, E6-O F2 #720).
- **`Sheet` mit `knoepfe`** bekommt diesen Aufbau; Kopf und Fuß stehen, der Inhalt dazwischen scrollt (die _eine_
  Scrollfläche des Fensters). Ohne `knoepfe` bleibt der alte Aufbau, bis das Fenster umgezogen ist – App für App in
  eigenen Scheiben (Dienstplaner F2, Musik-App F3; Anmeldungen, Organigramm und Protokolle folgen). Der Test
  `ui/fenster/fensterAufbau.test.ts` hält fest, welche Apps umgezogen sind – ein neues Fenster ohne `knoepfe` fällt
  dort auf. Der Hauptknopf zieht dabei aus dem Inhalt in `knoepfe` (statt `m.hauptKnopfBreit`). Fenster nur
  zum Ansehen reichen `knoepfe={null}` – unten steht dann nur „Schließen“. Aktionen, die zum Inhalt gehören (in einer
  Liste, „Andere Person wählen“ am Entwurf), bleiben im Inhalt; ein Nebenweg wie „Neu vorschlagen“ steht als Link
  (`m.textKnopf`) am Ergebnis, nicht unten. **Zwei gleichwertige Wege** (PDF: Herunterladen / Teilen; Zeitraum:
  löschen / anpassen) stehen beide unten: zweiter Weg `hell` oder `gefahr`, Hauptweg zuletzt (Alwin, F3 #726).
  Fenster mit Formular und weiteren Bereichen („Lied bearbeiten“, „Arrangement“) haben „Speichern“ unten; seltene,
  folgenreiche Wege („Zum Standard machen“, „Löschen …“) bleiben getrennt im Inhalt.
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

Betroffene Module: `ui/design/_variables.scss` (`--bar-pad-top`), `components/AblaufChangedBanner.module.scss`,
`components/ChordEditor.module.scss`, `pages/ChordChart.module.scss` (Header + beide Dropdowns).

## Dialoge über der Tastatur (Safe Area unten) – verbindlich

Jedes Vollbild-Overlay mit Eingabefeldern (`Sheet`, `ItemActionSheet`, `ChordEditor`) ist
**`position: fixed`** – NIE `absolute`, sonst scrollt es mit dem Dokument mit, wenn iOS beim
Fokussieren die Seite hochschiebt – und spart die Tastatur aus:

```scss
padding-bottom: calc(16px + var(--kb, 0px));
```

`--kb` liefert der Hook `ui/fenster/useOverlayKeyboardInset` (Messung am `visualViewport`); er holt zusätzlich den
von iOS hinterlassenen Dokument-Scroll zurück. Ohne beides liegen Trefferlisten und Knöpfe unter der
Tastatur, und die Kopfleiste bleibt nach dem Schließen verrutscht (#207).
