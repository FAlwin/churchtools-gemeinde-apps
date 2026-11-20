import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { relative } from 'node:path';
import { dateien, WURZEL } from './quelltexte.testutil';

/**
 * **Ruhige Bedienung: Knöpfe kommen aus `ui/bedienung`, nicht aus der eigenen Klasse** (Bauplan B1, 20.11.2026).
 *
 * Am 19.11. standen rund 430 rohe `<button>` in den Apps und 15 verschiedene feste Knopfhöhen trotz `--knopf-hoehe` –
 * deshalb sahen Reiter, Knöpfe und Werkzeugzeilen in jeder Erweiterung ein bisschen anders und alle gleich laut aus.
 * Dieser Test zählt je App
 *  (a) rohe `<button` in `.tsx` (ohne Testdateien, ohne `ui/` – dort sind sie das Innere der Bausteine) und
 *  (b) feste Pixelhöhen (`height`/`min-height`) in SCSS-Regeln, die zu einem Knopf gehören: der Selektor nennt
 *      „button/knopf/btn“, oder die Klasse hängt an einem `<button className=…>` derselben App.
 * Nicht jeder rohe Knopf ist ein Fehler (Tabellenzellen, Zeichenwerkzeuge, Listenzeilen als Knopf) – deshalb gilt
 * keine Null, sondern der **heutige Stand als Obergrenze**:
 *  - Steigt eine Zahl, schlägt der Test fehl: nimm `KopfKnopf`, `ZeilenKnopf`, `FensterKnopf`, `KnopfMitMenue`,
 *    `FilterKnopf` oder `HinzufuegenMenue` aus `ui/bedienung`.
 *  - Fällt sie, schlägt er ebenfalls fehl und verlangt die niedrigere Obergrenze – so wird die Liste mit jeder
 *    Scheibe kürzer und kann nicht wieder wachsen. **Obergrenzen nie erhöhen.**
 */
export const APPS = [
  'client',
  'anmeldungen',
  'protokolle',
  'dienstplaner',
  'organigramm',
  'website',
  'gebetsabend',
  'formular',
] as const;
type App = (typeof APPS)[number];

/** Stand 20.11.2026 (`origin/main` `2ef414a0`, B1: ohne die Lupe der Protokolle, die nach `ui/bedienung` gezogen ist). */
const OBERGRENZE: Record<App, { knoepfe: number; hoehen: number }> = {
  client: { knoepfe: 110, hoehen: 21 },
  anmeldungen: { knoepfe: 102, hoehen: 6 },
  protokolle: { knoepfe: 81, hoehen: 27 },
  dienstplaner: { knoepfe: 79, hoehen: 23 },
  organigramm: { knoepfe: 62, hoehen: 2 },
  website: { knoepfe: 12, hoehen: 3 },
  gebetsabend: { knoepfe: 0, hoehen: 0 },
  formular: { knoepfe: 2, hoehen: 0 },
};

/** Rohe `<button` in einem Quelltext (ohne `<ButtonX`, ohne `<buttonGroup`-artige Namen). */
export function rohKnoepfe(text: string): number {
  return (text.match(/<button(?=[\s>/])/g) ?? []).length;
}

/** Die Klassen, die an einem `<button className=…>` hängen (`styles.x`, `styles['x']`, auch in Vorlagen-Texten). */
export function knopfKlassen(text: string): Set<string> {
  const klassen = new Set<string>();
  for (const m of text.matchAll(/<button(?=[\s>/])/g)) {
    // Bis zum schließenden `>` der Start-Marke lesen – Klammern `{ }` (Pfeilfunktionen mit `>`) überspringen.
    let tiefe = 0;
    let ende = m.index + m[0].length;
    for (; ende < text.length; ende++) {
      const z = text[ende];
      if (z === '{') tiefe++;
      else if (z === '}') tiefe--;
      else if (z === '>' && tiefe === 0) break;
    }
    const marke = text.slice(m.index, ende);
    for (const k of marke.matchAll(/styles\.(\w+)|styles\[\s*['"]([\w-]+)['"]\s*\]/g))
      klassen.add(k[1] ?? k[2]);
  }
  return klassen;
}

const KNOPF_NAME = /button|knopf|btn/i;

/** Feste Pixelhöhen in Knopf-Regeln eines SCSS-Textes. `klassenAnKnopf`: Klassen, die irgendwo an einem `<button>` hängen. */
export function knopfHoehen(scss: string, klassenAnKnopf: ReadonlySet<string>): number {
  const text = scss
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|\s)\/\/.*$/gm, '$1')
    .replace(/#\{[^}]*\}/g, '');
  const kopf: string[] = [];
  let zaehler = 0;
  let schnipsel = '';
  const knopfRegel = () =>
    kopf.some((k) => {
      if (KNOPF_NAME.test(k)) return true;
      for (const m of k.matchAll(/\.([\w-]+)/g)) if (klassenAnKnopf.has(m[1])) return true;
      return false;
    });
  const erklaerung = () => {
    if (
      /^(?:min-)?height\s*:\s*\d+(?:\.\d+)?px\s*(?:!important)?$/.test(schnipsel.trim()) &&
      knopfRegel()
    )
      zaehler++;
    schnipsel = '';
  };
  for (const z of text) {
    if (z === '{') {
      kopf.push(schnipsel.trim());
      schnipsel = '';
    } else if (z === '}') {
      erklaerung();
      kopf.pop();
    } else if (z === ';') erklaerung();
    else schnipsel += z;
  }
  return zaehler;
}

interface Stand {
  knoepfe: number;
  hoehen: number;
  proDatei: Map<string, { knoepfe: number; hoehen: number }>;
}

function zaehle(app: App): Stand {
  const tsx = dateien(`${app}/src`, /\.tsx$/).filter((p) => !/\.test\.tsx$/.test(p));
  const scss = dateien(`${app}/src`, /\.scss$/);
  const texte = new Map(tsx.map((p) => [p, readFileSync(p, 'utf8')]));
  const klassen = new Set<string>();
  for (const t of texte.values()) for (const k of knopfKlassen(t)) klassen.add(k);
  const proDatei: Stand['proDatei'] = new Map();
  const eintrag = (p: string) => {
    const rel = relative(WURZEL, p);
    if (!proDatei.has(rel)) proDatei.set(rel, { knoepfe: 0, hoehen: 0 });
    return proDatei.get(rel)!;
  };
  let knoepfe = 0;
  let hoehen = 0;
  for (const [p, t] of texte) {
    const n = rohKnoepfe(t);
    if (n) eintrag(p).knoepfe = n;
    knoepfe += n;
  }
  for (const p of scss) {
    const n = knopfHoehen(readFileSync(p, 'utf8'), klassen);
    if (n) eintrag(p).hoehen = n;
    hoehen += n;
  }
  return { knoepfe, hoehen, proDatei };
}

/** Die dichtesten Dateien einer App für die Fehlermeldung. */
function dichteste(stand: Stand, art: 'knoepfe' | 'hoehen'): string {
  return [...stand.proDatei]
    .filter(([, v]) => v[art] > 0)
    .sort((a, b) => b[1][art] - a[1][art])
    .slice(0, 8)
    .map(([d, v]) => `${d} (${v[art]})`)
    .join(', ');
}

describe('Ruhige Bedienung: Knöpfe aus ui/bedienung (B1)', () => {
  const staende = Object.fromEntries(APPS.map((a) => [a, zaehle(a)])) as Record<App, Stand>;

  for (const art of ['knoepfe', 'hoehen'] as const) {
    const was = art === 'knoepfe' ? 'rohe <button>' : 'feste Knopfhöhen (height/min-height in px)';
    it(`${was}: je App höchstens die Obergrenze – und nicht darunter`, () => {
      const meldungen: string[] = [];
      for (const app of APPS) {
        const ist = staende[app][art];
        const grenze = OBERGRENZE[app][art];
        if (ist > grenze)
          meldungen.push(
            `${app}: ${ist} ${was}, erlaubt ${grenze}. Nimm einen Baustein aus ui/bedienung ` +
              `(KopfKnopf, ZeilenKnopf, FensterKnopf, KnopfMitMenue …) und schreibe keinen neuen Knopf ` +
              `mit eigener Klasse. Dichteste Dateien: ${dichteste(staende[app], art)}`,
          );
        else if (ist < grenze)
          meldungen.push(
            `Obergrenze für ${app} auf ${ist} senken (${art}: bisher ${grenze}) – die Liste soll mit jeder Scheibe kürzer werden.`,
          );
      }
      expect(meldungen).toEqual([]);
    });
  }

  it('jede App der Liste hat einen Quellordner (Tippfehler im Namen wäre sonst eine stille Null)', () => {
    for (const app of APPS) expect(dateien(`${app}/src`, /\.tsx$/).length).toBeGreaterThan(0);
  });
});

describe('die Zählung selbst (Gegenprobe gegen die Erkennung)', () => {
  it('rohe Knöpfe: `<button` zählt, Bausteine und Wortanfänge nicht', () => {
    expect(rohKnoepfe('<button type="button">A</button>\n<button\n  onClick={f}>B</button>')).toBe(
      2,
    );
    expect(rohKnoepfe('<ButtonGruppe /> <buttons> <KopfKnopf />')).toBe(0);
  });

  it('Klassen am Knopf: auch bei Pfeilfunktionen in der Start-Marke und bei `styles[…]`', () => {
    const k = knopfKlassen(
      `<button type="button" onClick={() => setX(a > b)} className={\`\${styles.zeile} \${styles['aktiv-x']}\`}>t</button>
       <div className={styles.kachel}><button className={styles.eins}>e</button></div>`,
    );
    expect([...k].sort()).toEqual(['aktiv-x', 'eins', 'zeile']);
    expect(k.has('kachel')).toBe(false);
  });

  it('Knopfhöhen: nur Regeln mit Knopf-Bezug, nur feste Pixel, auch verschachtelt', () => {
    const k = new Set(['zeile']);
    expect(knopfHoehen('.knopf { height: 32px; }', k)).toBe(1);
    expect(knopfHoehen('.addBtn { min-height: 30px; }', k)).toBe(1);
    expect(knopfHoehen('.zeile { height: 28px; }', k)).toBe(1); // Klasse hängt an einem <button>
    expect(knopfHoehen('.kopf { .knopf { height: 24px; } }', k)).toBe(1);
    expect(
      knopfHoehen(
        'button { height: 30px; }\n.x { @media (a) { .y button { min-height: 44px } } }',
        k,
      ),
    ).toBe(2);
    expect(knopfHoehen('.kachel { height: 48px; }', k)).toBe(0); // keine Knopf-Regel
    expect(
      knopfHoehen('.knopf { height: var(--knopf-hoehe); min-height: calc(1px + 2px); }', k),
    ).toBe(0);
    expect(knopfHoehen('.knopf { line-height: 20px; max-height: 30px; }', k)).toBe(0);
    expect(knopfHoehen('.knopf { // height: 30px;\n  /* height: 31px; */ }', k)).toBe(0);
  });
});
