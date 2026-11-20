# Schriftdateien der Website (Bauplan Website E-W14/E-W15)

Die feste Schriftauswahl aus `../schriften.ts` – **einmal** am 20.11.2026 von Fontsource geladen (`npm pack`, keine
Abhängigkeit im Repo), jeweils nur der Zeichensatz **Latin** (Westeuropa inkl. Umlaute, ß, typografische Anführungszeichen, €:
`U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122,
U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD`). Alle variabel (eine Datei je Schrift), außer Caveat Brush (ein Schnitt).

Die Lizenz jeder Schrift liegt als `<paket>.LICENSE.txt` daneben und muss mit der Schrift weitergegeben werden (auch im
Bau-Paket der Website, W5). Neue Schrift: Eintrag in `schriften.ts`, Datei + Lizenz hier, Zeile unten – der Wächter
`schriftdateien.test.ts` prüft, dass alles zusammenpasst.

| Datei                      | Quelle                                        | Datei im Paket                                   | Lizenz      |
| -------------------------- | --------------------------------------------- | ------------------------------------------------ | ----------- |
| quicksand-var.woff2        | `@fontsource-variable/quicksand@5.3.0`        | `files/quicksand-latin-wght-normal.woff2`        | SIL OFL 1.1 |
| noto-sans-var.woff2        | `@fontsource-variable/noto-sans@5.3.0`        | `files/noto-sans-latin-wght-normal.woff2`        | SIL OFL 1.1 |
| montserrat-var.woff2       | `@fontsource-variable/montserrat@5.3.0`       | `files/montserrat-latin-wght-normal.woff2`       | SIL OFL 1.1 |
| open-sans-var.woff2        | `@fontsource-variable/open-sans@5.3.0`        | `files/open-sans-latin-wght-normal.woff2`        | SIL OFL 1.1 |
| source-sans-3-var.woff2    | `@fontsource-variable/source-sans-3@5.3.1`    | `files/source-sans-3-latin-wght-normal.woff2`    | SIL OFL 1.1 |
| nunito-var.woff2           | `@fontsource-variable/nunito@5.3.0`           | `files/nunito-latin-wght-normal.woff2`           | SIL OFL 1.1 |
| inter-var.woff2            | `@fontsource-variable/inter@5.3.0`            | `files/inter-latin-wght-normal.woff2`            | SIL OFL 1.1 |
| raleway-var.woff2          | `@fontsource-variable/raleway@5.3.0`          | `files/raleway-latin-wght-normal.woff2`          | SIL OFL 1.1 |
| roboto-slab-var.woff2      | `@fontsource-variable/roboto-slab@5.3.0`      | `files/roboto-slab-latin-wght-normal.woff2`      | Apache 2.0  |
| merriweather-var.woff2     | `@fontsource-variable/merriweather@5.3.0`     | `files/merriweather-latin-wght-normal.woff2`     | SIL OFL 1.1 |
| lora-var.woff2             | `@fontsource-variable/lora@5.3.0`             | `files/lora-latin-wght-normal.woff2`             | SIL OFL 1.1 |
| playfair-display-var.woff2 | `@fontsource-variable/playfair-display@5.3.0` | `files/playfair-display-latin-wght-normal.woff2` | SIL OFL 1.1 |
| caveat-var.woff2           | `@fontsource-variable/caveat@5.3.0`           | `files/caveat-latin-wght-normal.woff2`           | SIL OFL 1.1 |
| caveat-brush.woff2         | `@fontsource/caveat-brush@5.3.0`              | `files/caveat-brush-latin-400-normal.woff2`      | SIL OFL 1.1 |
