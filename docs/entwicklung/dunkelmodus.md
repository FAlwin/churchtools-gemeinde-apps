# Dunkelmodus wie ChurchTools

Seit 14.10.2026 (Alwin: „so einen Dunkelmodus wie die ChurchTools-App … so dokumentieren, dass die anderen
Apps z. B. die Musik-App auch diesen Modus anpassen kann“). **Alle Apps nutzen es:** Anmeldungen (14.10.2026),
Dienstplaner (15.10.2026, #563) und die Musik-App (19.10.2026, #565 – Alwin: „wir haben da so ein dunkles Blau,
ChurchTools bleibt eher bei Schwarz“). Das frühere blaugraue Dunkel der Musik-App ist entfernt; es gibt nur noch
dieses eine.

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

1. **Farben:** `ui/design/_variables.scss`, Block `html[data-theme='dark']` – die Werte der Tabelle oben.
   Komponenten nutzen nur die Tokens (`--bg`, `--surface2` …). `color-scheme: dark` sorgt dafür, dass auch
   Auswahllisten, Datumsfelder und Rollbalken dunkel werden. Was immer hell bleibt (Papier – die Vorschau der
   Organigramm-PDF), bindet die hellen Werte über den Mixin `hell` aus `ui/design/_farben.scss` ein.
2. **Wer hell oder dunkel wählt:**
   - **Erweiterungen „Anmeldungen“ und „Dienstplaner“:** ChurchTools. `ui/design/thema.ts` →
     `folgeChurchToolsThema()` setzt `data-theme` auf `<html>` passend zur Klasse an `<body>` und zieht mit,
     wenn ChurchTools umschaltet (MutationObserver). Außerhalb von ChurchTools (Entwickeln mit `?demo`) gilt
     das Gerät.
   - **Musik-App (App und Erweiterung):** ihr eigener Schalter unter Mehr → Hell / Dunkel / Auto
     (`client/src/hooks/useSettings.ts`); „Auto“ folgt dem Gerät, auch in der Erweiterung (Alwin, 14.10.2026).
     Die `theme-color` für iOS liest `useSettings` aus `--nav-bg` – sie ist im Dunkeln `#27272a`.
3. **Erweiterungs-Bau:** `ui/erweiterung/cssBereich.ts` schreibt `html[…]` auf `html[…] <App-Bereich>` um. Die
   Farben gelten also nur in unserer App, nicht in ChurchTools.

**Bilder:** Was einen dunklen Grund im Bild trägt, muss mitziehen. Das runde Logo der Musik-App
(`client/public/logo-rund-dunkel.png`, Anmelden und Mehr) hatte einen blaugrauen Kreis `#16212a`; seit
19.10.2026 ist er `#27272a` wie die Karten (umgefärbt aus der hellen Fassung, damit an den Balken kein blauer
Saum bleibt).

## Eine neue App anschließen

Erweiterung: in `main.tsx` direkt nach `classList.add('ct-extension')`:

```ts
import { folgeChurchToolsThema } from '@ui/design/thema';
folgeChurchToolsThema();
```

Danach jede Seite im Dunkeln ansehen (`npm run dev -w <app>`, `?demo`, Browser auf dunkel). Zu suchen sind
**feste Farben** in den `.module.scss` (`#fff`, `#…`, `rgba(…)`), die nicht aus den Tokens kommen. `#fff` auf
blauen Knöpfen ist in Ordnung. Absichtlich helle Flächen (die Formular-Vorschau im Baukasten, die weiße
Notenseite) bleiben hell.
