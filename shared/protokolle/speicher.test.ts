import { describe, expect, it } from 'vitest';
import { MAX_ZEICHEN } from '../ct/modulDaten';
import type { Block } from './dokument';
import { BLOCKNOTE_DOKUMENT } from './dokument.testdaten';
import {
  dokumentAusTeilen,
  kuerzelLesen,
  kuerzelMitarbeit,
  kuerzelProtokolle,
  sperreLage,
  teileBauen,
  type ProtokollTeil,
} from './speicher';

/**
 * Wie in S0: ein langes Protokoll mit gut 300 Blöcken. Der Text ist zufällig (fest gesät), sonst packt sich die
 * Wiederholung auf einen einzigen Teil und der Test prüft das Aufteilen gar nicht.
 */
function langesProtokoll(): Block[] {
  let s = 42;
  const zufall = (): number => (s = (s * 1103515245 + 12345) % 2 ** 31) / 2 ** 31;
  const wort = (): string =>
    Array.from({ length: 3 + Math.floor(zufall() * 8) }, () =>
      String.fromCharCode(97 + Math.floor(zufall() * 26)),
    ).join('');
  const satz = (n: number): string => Array.from({ length: n }, wort).join(' ');
  const out: Block[] = [];
  for (let i = 0; i < 310; i++)
    out.push(
      i % 20 === 0
        ? {
            id: `h${i}`,
            type: 'heading',
            props: { level: 1 },
            content: [{ type: 'text', text: satz(4), styles: {} }],
            children: [],
          }
        : {
            id: `p${i}`,
            type: 'paragraph',
            props: {},
            content: [{ type: 'text', text: satz(30), styles: { bold: i % 3 === 0 } }],
            children: [],
          },
    );
  return out;
}

const teile = (werte: string[]): ProtokollTeil[] =>
  werte.map((w) => JSON.parse(w) as ProtokollTeil);

describe('Kürzel', () => {
  it('liest zurück, was es baut', () => {
    expect(kuerzelLesen(kuerzelProtokolle(11))).toEqual({ art: 'protokolle', gruppe: 11 });
    expect(kuerzelLesen(kuerzelMitarbeit(7))).toEqual({ art: 'mitarbeit', gruppe: 7 });
  });
  it('lässt fremde Kategorien weg', () => {
    for (const k of ['vorlagen', 'protokolle-g', 'protokolle-g0', 'protokolle-g12x', 'entwuerfe-3'])
      expect(kuerzelLesen(k)).toBeNull();
  });
});

describe('teileBauen / dokumentAusTeilen', () => {
  it('bringt das echte Dokument unverändert zurück', () => {
    const { stand, werte } = teileBauen(BLOCKNOTE_DOKUMENT, 's1');
    expect(werte).toHaveLength(1);
    expect(dokumentAusTeilen({ sitzung: 's1', stand }, teile(werte))).toEqual(BLOCKNOTE_DOKUMENT);
  });

  it('teilt ein langes Protokoll auf, jeder Teil unter der Grenze, und setzt es wieder zusammen', () => {
    const dok = langesProtokoll();
    const roh = JSON.stringify(dok).length;
    const { stand, werte } = teileBauen(dok, 's2');
    expect(roh).toBeGreaterThan(3 * MAX_ZEICHEN);
    expect(werte.every((w) => w.length <= MAX_ZEICHEN)).toBe(true);
    expect(werte.length).toBeLessThan(roh / MAX_ZEICHEN);
    expect(dokumentAusTeilen({ sitzung: 's2', stand }, teile(werte).reverse())).toEqual(dok);
  });

  it('nimmt keinen halben Stand: fehlender Teil, fremder Stand, andere Sitzung', () => {
    const { stand, werte } = teileBauen(langesProtokoll(), 's3');
    const alle = teile(werte);
    expect(alle.length).toBeGreaterThan(1);
    expect(dokumentAusTeilen({ sitzung: 's3', stand }, alle.slice(1))).toBeNull();
    expect(dokumentAusTeilen({ sitzung: 's3', stand: 'anders' }, alle)).toBeNull();
    expect(dokumentAusTeilen({ sitzung: 'andere', stand }, alle)).toBeNull();
  });

  it('nimmt bei Teilen aus zwei Ständen nur den zum Kopf passenden', () => {
    const alt = teileBauen(BLOCKNOTE_DOKUMENT, 's4');
    const neuDok = BLOCKNOTE_DOKUMENT.slice(0, 2);
    const neu = teileBauen(neuDok, 's4');
    const gemischt = [...teile(alt.werte), ...teile(neu.werte)];
    expect(dokumentAusTeilen({ sitzung: 's4', stand: neu.stand }, gemischt)).toEqual(neuDok);
    expect(dokumentAusTeilen({ sitzung: 's4', stand: alt.stand }, gemischt)).toEqual(
      BLOCKNOTE_DOKUMENT,
    );
  });

  it('meldet kaputte Daten als null statt zu werfen', () => {
    const { stand, werte } = teileBauen(BLOCKNOTE_DOKUMENT, 's5');
    const kaputt = teile(werte).map((t) => ({ ...t, daten: t.daten.slice(0, -5) }));
    expect(dokumentAusTeilen({ sitzung: 's5', stand }, kaputt)).toBeNull();
  });
});

describe('sperreLage', () => {
  const jetzt = new Date('2026-10-22T19:30:00Z');
  it('unterscheidet frei, meine und fremd', () => {
    expect(sperreLage(null, 1, jetzt)).toBe('frei');
    expect(sperreLage({ von: 1, name: 'Alwin', seit: '2026-10-22T19:25:00Z' }, 1, jetzt)).toBe(
      'meine',
    );
    expect(sperreLage({ von: 2, name: 'Johann', seit: '2026-10-22T19:25:00Z' }, 1, jetzt)).toBe(
      'fremd',
    );
  });
  it('lässt eine verlassene oder kaputte Sperre verfallen', () => {
    expect(sperreLage({ von: 2, name: 'Johann', seit: '2026-10-22T19:19:59Z' }, 1, jetzt)).toBe(
      'frei',
    );
    expect(sperreLage({ von: 2, name: 'Johann', seit: 'unsinn' }, 1, jetzt)).toBe('frei');
  });
});
