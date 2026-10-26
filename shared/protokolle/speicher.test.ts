import { describe, expect, it } from 'vitest';
import { MAX_ZEICHEN } from '../ct/modulDaten';
import type { Block } from './dokument';
import { BLOCKNOTE_DOKUMENT } from './dokument.testdaten';
import {
  dokumentAusTeilen,
  dokumentDerSitzung,
  istKopf,
  istTeil,
  kuerzelLesen,
  kuerzelMitarbeit,
  kuerzelProtokolle,
  schreibLage,
  sitzungAusWerten,
  sperreLage,
  sperreVon,
  teileBauen,
  type ProtokollKopf,
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

  it('zählt einen doppelt liegenden Teil desselben Stands einmal (S4-1: Aufräumen gescheitert, gleicher Text erneut gespeichert)', () => {
    const { stand, werte } = teileBauen(langesProtokoll(), 's6');
    const alle = teile(werte);
    expect(dokumentAusTeilen({ sitzung: 's6', stand }, [...alle, ...alle])).toEqual(
      dokumentAusTeilen({ sitzung: 's6', stand }, alle),
    );
    expect(dokumentAusTeilen({ sitzung: 's6', stand }, [...alle, alle[0]])).not.toBeNull();
  });

  it('meldet kaputte Daten als null statt zu werfen', () => {
    const { stand, werte } = teileBauen(BLOCKNOTE_DOKUMENT, 's5');
    const kaputt = teile(werte).map((t) => ({ ...t, daten: t.daten.slice(0, -5) }));
    expect(dokumentAusTeilen({ sitzung: 's5', stand }, kaputt)).toBeNull();
  });
});

describe('dokumentDerSitzung (S3-4)', () => {
  const { stand, werte } = teileBauen(BLOCKNOTE_DOKUMENT, 's6');
  const t = teile(werte);

  it('entworfen oder freigegeben: das Dokument aus den Teilen', () => {
    expect(dokumentDerSitzung({ sitzung: 's6', stand, status: 'entwurf' }, t)).toEqual(
      BLOCKNOTE_DOKUMENT,
    );
    expect(dokumentDerSitzung({ sitzung: 's6', stand, status: 'frei' }, t)).toEqual(
      BLOCKNOTE_DOKUMENT,
    );
  });

  it('geplant oder ohne Kopf: kein Dokument – auch wenn Teile da sind', () => {
    expect(dokumentDerSitzung({ sitzung: 's6', stand, status: 'geplant' }, t)).toBeNull();
    expect(dokumentDerSitzung(null, t)).toBeNull();
  });
});

describe('sperreLage', () => {
  const jetzt = new Date('2026-10-22T19:30:00Z');
  const ich = { person: 1, fenster: 'f1' };
  const sperre = (von: number, seit: string, fenster = 'f1') => ({
    von,
    name: 'X',
    seit,
    fenster,
  });
  it('unterscheidet frei, meine und fremd', () => {
    expect(sperreLage(null, ich, jetzt)).toBe('frei');
    expect(sperreLage(sperre(1, '2026-10-22T19:25:00Z'), ich, jetzt)).toBe('meine');
    expect(sperreLage(sperre(2, '2026-10-22T19:25:00Z'), ich, jetzt)).toBe('fremd');
  });
  it('ich selbst in einem anderen Fenster (oder ohne Fenster-Kennung) zählt als fremd (S4-1)', () => {
    expect(sperreLage(sperre(1, '2026-10-22T19:25:00Z', 'f2'), ich, jetzt)).toBe('fremd');
    expect(sperreLage({ von: 1, name: 'X', seit: '2026-10-22T19:25:00Z' }, ich, jetzt)).toBe(
      'fremd',
    );
  });
  it('lässt eine verlassene oder kaputte Sperre verfallen', () => {
    expect(sperreLage(sperre(2, '2026-10-22T19:19:59Z'), ich, jetzt)).toBe('frei');
    expect(sperreLage(sperre(2, '2026-10-22T19:20:00Z'), ich, jetzt)).toBe('fremd');
    expect(sperreLage(sperre(2, 'unsinn'), ich, jetzt)).toBe('frei');
  });
  it('sperreVon erzeugt eine Sperre, die für dasselbe Fenster „meine“ ist', () => {
    const s = sperreVon({ person: 1, name: 'Alwin', fenster: 'f1' }, jetzt);
    expect(s).toEqual({ von: 1, name: 'Alwin', seit: '2026-10-22T19:30:00.000Z', fenster: 'f1' });
    expect(sperreLage(s, ich, jetzt)).toBe('meine');
  });
});

describe('schreibLage (S4-1)', () => {
  const jetzt = new Date('2026-10-22T19:30:00Z');
  const ich = { person: 1, fenster: 'f1' };
  const kopf: ProtokollKopf = {
    art: 'protokoll',
    fassung: 1,
    sitzung: 's1',
    titel: 'T',
    status: 'entwurf',
    beginn: '2026-10-22T17:00:00Z',
    termin: null,
    treffen: null,
    freigabe: null,
    sperre: null,
    stand: 'a',
  };
  it('ok bei freiem oder eigenem Entwurf auf demselben Stand', () => {
    expect(schreibLage(kopf, ich, 'a', jetzt)).toBe('ok');
    expect(
      schreibLage({ ...kopf, sperre: sperreVon({ ...ich, name: 'A' }, jetzt) }, ich, 'a', jetzt),
    ).toBe('ok');
  });
  it('weg, fest, gesperrt, verändert', () => {
    expect(schreibLage(null, ich, 'a', jetzt)).toBe('weg');
    expect(schreibLage({ ...kopf, status: 'frei' }, ich, 'a', jetzt)).toBe('fest');
    expect(schreibLage({ ...kopf, status: 'geplant' }, ich, 'a', jetzt)).toBe('fest');
    const fremd = sperreVon({ person: 2, name: 'J', fenster: 'g' }, jetzt);
    expect(schreibLage({ ...kopf, sperre: fremd }, ich, 'a', jetzt)).toBe('gesperrt');
    expect(schreibLage(kopf, ich, 'b', jetzt)).toBe('veraendert');
  });
  it('fremde Sperre geht vor verändertem Stand – sonst lüde das Fenster neu, statt „schreibt gerade“ zu zeigen', () => {
    const fremd = sperreVon({ person: 2, name: 'J', fenster: 'g' }, jetzt);
    expect(schreibLage({ ...kopf, sperre: fremd }, ich, 'b', jetzt)).toBe('gesperrt');
  });
});

describe('sitzungAusWerten (S4-1)', () => {
  it('findet Kopf (kleinste ID) und Teile der Sitzung, übergeht Fremdes und Kaputtes', () => {
    const { stand, werte } = teileBauen(BLOCKNOTE_DOKUMENT, 's1');
    const kopf = {
      art: 'protokoll',
      fassung: 1,
      sitzung: 's1',
      titel: 'T',
      status: 'entwurf',
      beginn: '2026-10-22T17:00:00Z',
      termin: null,
      treffen: null,
      freigabe: null,
      sperre: null,
      stand,
    };
    const liste = [
      { id: 9, value: JSON.stringify({ ...kopf, titel: 'zweiter' }) },
      { id: 3, value: JSON.stringify(kopf) },
      { id: 4, value: werte[0] },
      { id: 5, value: 'kaputt{' },
      { id: 6, value: JSON.stringify({ ...kopf, sitzung: 's2' }) },
      ...teileBauen(BLOCKNOTE_DOKUMENT, 's2').werte.map((value, i) => ({ id: 20 + i, value })),
    ];
    const s = sitzungAusWerten(liste, 's1');
    expect(s.kopf?.id).toBe(3);
    expect(s.kopf?.inhalt.titel).toBe('T');
    expect(s.teile.map((t) => t.id)).toEqual([4]);
    expect(sitzungAusWerten(liste, 'fehlt').kopf).toBeNull();
  });
});

describe('istKopf / istTeil (S3-1)', () => {
  const kopf = {
    art: 'protokoll',
    fassung: 1,
    sitzung: 's1',
    titel: 'Leitungssitzung',
    status: 'frei',
    beginn: '2026-10-14T17:00:00Z',
    termin: { kalender: 4, id: 114 },
    treffen: null,
    freigabe: { von: 1, am: '2026-10-15T08:00:00Z' },
    sperre: null,
    stand: 'abc',
  };
  it('erkennt den eigenen Kopf, auch ohne Termin', () => {
    expect(istKopf(kopf)).toBe(true);
    expect(istKopf({ ...kopf, termin: null, treffen: 15, status: 'geplant' })).toBe(true);
  });
  it('lehnt Fremdes und Kaputtes ab', () => {
    expect(istKopf(null)).toBe(false);
    expect(istKopf({ ...kopf, art: 'einstellung' })).toBe(false);
    expect(istKopf({ ...kopf, status: 'gelöscht' })).toBe(false);
    expect(istKopf({ ...kopf, beginn: 'morgen' })).toBe(false);
    expect(istKopf({ ...kopf, termin: { kalender: 4 } })).toBe(false);
  });
  it('erkennt die Teile, die teileBauen erzeugt', () => {
    const { werte } = teileBauen(BLOCKNOTE_DOKUMENT, 's1');
    expect(werte.map((w) => istTeil(JSON.parse(w)))).toEqual(werte.map(() => true));
    expect(istTeil({ ...(JSON.parse(werte[0]) as object), nr: 'eins' })).toBe(false);
    expect(istTeil(kopf)).toBe(false);
  });
});
