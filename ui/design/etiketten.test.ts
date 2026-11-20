import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { relative } from 'node:path';
import { dateien, WURZEL } from './quelltexte.testutil';

/**
 * **Ruhige Bedienung: Status-Etiketten kommen aus `ui/bedienung/Etikett`, nicht aus der eigenen Pille** (Bauplan R9/E24,
 * B8b, 20.11.2026). Am 19.11. gab es in den Erweiterungen sechs Formen für „Entwurf“, „Leitung“, „eingerichtet“ …:
 * `chip`, `pille`, `Marke`, `marke`, `rolle`, `etikett` – je App in eigener Größe und eigenem Rot.
 *
 * Eine Etikett-Form ist eine **Kapsel** (`border-radius: 999px`). Dieser Test zählt je App die Kapseln in den
 * Stildateien. Was übrig ist, sind **Knöpfe und Wähler** (Platzhalter-Knopf, Schnellwahl, Auswahl-Chip), keine
 * Anzeige – eine Anzeige ist ein `<Etikett>`:
 *  - Steigt eine Zahl, schlägt der Test fehl: nimm `Etikett` (Anzeige) oder einen Knopf-Baustein aus `ui/bedienung`.
 *  - Fällt sie, verlangt der Test die niedrigere Obergrenze. **Obergrenzen nie erhöhen.**
 * Die Musik-App (`client`) ist seit B8c dabei; ihre Etiketten aus `ui/abwesenheiten`/`ui/ablauf` zählen hier nicht (die
 * Wähler `.chip` sind Knöpfe, `aenderungsTag`/`verdecktKnopf` gehören zum Ablauf).
 */
const APPS = [
  'anmeldungen',
  'protokolle',
  'dienstplaner',
  'organigramm',
  'website',
  'gebetsabend',
  'formular',
  'client',
] as const;
type App = (typeof APPS)[number];

/** Stand 20.11.2026 nach B8b/B8c. */
const OBERGRENZE: Record<App, number> = {
  anmeldungen: 10,
  protokolle: 1,
  dienstplaner: 2,
  organigramm: 1,
  website: 0,
  gebetsabend: 0,
  formular: 0,
  // Musik-App (B8c): Werkzeugleiste Zeichnen (5), Spendenknopf (1), Seitenwähler und Vorschau-Schalter im Liedblatt (3) – alles
  // Knöpfe und Schalter, keine Anzeige. „Kein Ablauf“ und „Standard“ sind `<Etikett>`, „nur ansehen“ (Vorlagen) auch.
  client: 9,
};

/** Kapseln in einem SCSS-Text: `border-radius` mit 99px oder mehr, ohne Kommentare. */
export function kapseln(scss: string): number {
  const text = scss.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|\s)\/\/.*$/gm, '$1');
  return [...text.matchAll(/border-radius\s*:\s*(\d+)px/g)].filter((m) => Number(m[1]) >= 99)
    .length;
}

describe('Ruhige Bedienung: Status-Etiketten aus ui/bedienung (B8b)', () => {
  it('Kapseln in den Stildateien je App: höchstens die Obergrenze – und nicht darunter', () => {
    const meldungen: string[] = [];
    for (const app of APPS) {
      const dichte: [string, number][] = [];
      let ist = 0;
      for (const p of dateien(`${app}/src`, /\.scss$/)) {
        const n = kapseln(readFileSync(p, 'utf8'));
        if (n) dichte.push([relative(WURZEL, p), n]);
        ist += n;
      }
      const grenze = OBERGRENZE[app];
      const wo = dichte.map(([d, n]) => `${d} (${n})`).join(', ');
      if (ist > grenze)
        meldungen.push(
          `${app}: ${ist} Kapseln, erlaubt ${grenze}. Eine Anzeige ist ein <Etikett> aus ui/bedienung, ein Knopf ` +
            `ein Knopf-Baustein – keine eigene Pille. Fundstellen: ${wo}`,
        );
      else if (ist < grenze)
        meldungen.push(`Obergrenze für ${app} auf ${ist} senken (bisher ${grenze}).`);
    }
    expect(meldungen).toEqual([]);
  });

  it('jede App der Liste hat Stildateien (Tippfehler im Namen wäre sonst eine stille Null)', () => {
    for (const app of APPS) expect(dateien(`${app}/src`, /\.scss$/).length).toBeGreaterThan(0);
  });

  it('die Zählung erkennt Kapseln, nicht Ecken und nicht Kommentare', () => {
    expect(kapseln('.a { border-radius: 999px; }')).toBe(1);
    expect(kapseln('.a { border-radius: 99px; } .b { border-radius: 100px }')).toBe(2);
    expect(kapseln('.a { border-radius: var(--r-ctrl); } .b { border-radius: 4px; }')).toBe(0);
    expect(kapseln('.a { // border-radius: 999px;\n /* border-radius: 999px */ }')).toBe(0);
  });
});
