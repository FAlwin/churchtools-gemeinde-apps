# Dunkelmodus wie ChurchTools

Seit 14.10.2026 (Alwin: „so einen Dunkelmodus wie die ChurchTools-App … so dokumentieren, dass die anderen
Apps z. B. die Musik-App auch diesen Modus anpassen kann“). **Umgestellt ist bisher nur die Erweiterung
„Anmeldungen“.** Die Musik-App und der Dienstplaner nutzen weiter ihren bisherigen Stand (Musik-App: eigenes
blaugraues Dunkel und eigener Schalter Hell/Dunkel/Auto; Dienstplaner: immer hell).

## Was ChurchTools macht (gemessen in der Test-Instanz, 14.10.2026)

- Die Wahl steht im `localStorage` unter `theme` (`light` / `dark`) und als **Klasse an `<body>`**:
  `<body class="cts … light">` bzw. `… dark`.
- Sie ist **unabhängig vom Gerät**: Mac im Dunkelmodus, ChurchTools auf hell → `body.light`. Maßgeblich ist
  also die Klasse, **nicht** `prefers-color-scheme`.
- Die Farben sind die von Tailwind 4. Die wichtigsten im Dunkeln:

| ChurchTools-Variable         | Wert                | bei uns                            |
| ---------------------------- | ------------------- | ---------------------------------- |
| `--color-background-primary` | zinc-900 `#18181b`  | `--bg` (Seite)                     |
| `--color-foreground-primary` | zinc-800 `#27272a`  | `--surface2`, `--nav-bg`           |
| `--color-basic-divider`      | zinc-700 `#3f3f46`  | `--border`, `--hair`, `--surface3` |
| `--color-basic-interactive`  | zinc-600 `#52525b`  | `--track-off`                      |
| (eine Stufe heller)          | zinc-500 `#71717a`  | `--seg-on` (das Gewählte)          |
| `--color-basic-primary`      | slate-50 `#f8fafc`  | `--text`                           |
| `--color-basic-secondary`    | slate-300 `#cad5e2` | `--text2`                          |
| `--color-basic-tertiary`     | slate-400 `#90a1b9` | `--text3`                          |
| `--color-accent-bright`      | blue-500 `#2b7fff`  | `--blue`                           |
| `--color-link`               | `#669cff`           | `--blue-ink`                       |
| `--color-accent-b-pale`      | blue-900 `#1c398e`  | `--blue-tile`                      |
| Knopf „Gruppe erstellen“     | green-600 `#00a63e` | `--green`                          |

## Wie es gebaut ist

1. **Farben:** `ui/design/_variables.scss`, Block `html[data-theme='dark'][data-dunkel='churchtools']`.
   Er steht **neben** dem bisherigen Dunkel (`html[data-theme='dark']`) und gewinnt, weil er genauer ist.
   Komponenten ändern sich nicht: Sie nutzen nur die Tokens (`--bg`, `--surface2` …).
   `color-scheme: dark` sorgt dafür, dass auch Auswahllisten, Datumsfelder und Rollbalken dunkel werden.
2. **Umschalten:** `ui/design/thema.ts` → `folgeChurchToolsThema()`. Die Funktion setzt
   `data-dunkel="churchtools"` und `data-theme` passend zur Klasse an `<body>` auf `<html>` und zieht mit,
   wenn ChurchTools umschaltet (MutationObserver). Außerhalb von ChurchTools (Entwickeln mit `?demo`)
   gilt das Gerät.
3. **Erweiterungs-Bau:** `ui/erweiterung/cssBereich.ts` schreibt `html[…][…]` auf
   `html[…][…] <App-Bereich>` um. Die Farben gelten also nur in unserer App, nicht in ChurchTools.

## Eine App umstellen

### Erweiterung (z. B. Dienstplaner)

In `main.tsx` direkt nach `classList.add('ct-extension')`:

```ts
import { folgeChurchToolsThema } from '@ui/design/thema';
folgeChurchToolsThema();
```

Danach jede Seite im Dunkeln ansehen (`npm run dev -w <app>`, `?demo`, Browser auf dunkel). Zu suchen sind
**feste Farben** in den `.module.scss` (`#fff`, `#…`, `rgba(…)`), die nicht aus den Tokens kommen. `#fff` auf
blauen Knöpfen ist in Ordnung. Absichtlich helle Flächen (die Formular-Vorschau im Baukasten, die weiße
Notenseite) bleiben hell.

### Musik-App

Sie hat einen eigenen Schalter (Einstellungen: Hell / Dunkel / Auto, `client/src/hooks/useSettings.ts`), der
`data-theme` setzt. Zu entscheiden ist zweierlei:

1. **Welches Dunkel?** Nur die ChurchTools-Farben übernehmen: in `useSettings` zusätzlich
   `document.documentElement.dataset.dunkel = 'churchtools'` setzen. Der Schalter bleibt, wie er ist.
   Achtung: Die `theme-color` für iOS liest `--nav-bg` – sie zieht automatisch mit (`#27272a`).
2. **Wer entscheidet in der Erweiterung?** In ChurchTools könnte „Auto“ der ChurchTools-Wahl folgen statt dem
   Gerät: `churchToolsThema()` aus `ui/design/thema.ts` liefert `light` / `dark` (oder `null` außerhalb von
   ChurchTools). In der installierten App bleibt „Auto“ beim Gerät.

Steigen alle Apps um, wird der ChurchTools-Block zum einzigen Dunkel: den alten Block löschen, das Attribut
`data-dunkel` aus dem Selektor nehmen, `thema.ts` behalten.
