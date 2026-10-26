import { describe, expect, it } from 'vitest';
import { alsGeloescht, neueAufgabe, statusSetzen, type Aufgabe } from './aufgaben';
import { BLOCK, type Block } from './dokument';
import {
  festeAufgabenAus,
  festePunkteFesthalten,
  festesProtokollAus,
  letztesProtokoll,
  offeneVonFrueher,
} from './festePunkte';
import { STANDARD_VORLAGEN, startDokument, wieLetztesMal } from './vorlagen';

const aufgabe = (id: string, extra: Partial<Parameters<typeof neueAufgabe>[0]> = {}): Aufgabe =>
  neueAufgabe({
    id,
    gruppe: 11,
    sitzung: 'alt',
    text: id,
    von: 1,
    am: '2026-09-01T18:00:00Z',
    ...extra,
  });
const erledigt = (a: Aufgabe, am: string): Aufgabe => statusSetzen(a, 'erledigt', 1, am);

const sitzung = (id: string, beginn: string, status: string) => ({
  beginn,
  kopf: { sitzung: id, status },
});

describe('letztesProtokoll', () => {
  const liste = [
    sitzung('sept', '2026-09-09T17:00:00Z', 'frei'),
    sitzung('okt', '2026-10-14T17:00:00Z', 'frei'),
    sitzung('okt-entwurf', '2026-10-20T17:00:00Z', 'entwurf'),
    sitzung('nov', '2026-11-11T17:00:00Z', 'frei'),
  ];

  it('nimmt das letzte freigegebene vor dieser Sitzung – Entwürfe und spätere zählen nicht', () => {
    expect(
      letztesProtokoll(liste, sitzung('neu', '2026-10-28T17:00:00Z', 'entwurf'))?.kopf.sitzung,
    ).toBe('okt');
  });

  it('zählt die Sitzung selbst nie mit, auch freigegeben', () => {
    expect(letztesProtokoll(liste, liste[1])?.kopf.sitzung).toBe('sept');
  });

  it('ohne frühere: null', () => {
    expect(letztesProtokoll(liste, sitzung('neu', '2026-09-01T17:00:00Z', 'entwurf'))).toBeNull();
  });
});

describe('offeneVonFrueher', () => {
  const q = {
    gruppe: 11,
    sitzung: 'heute',
    seit: '2026-10-14T17:00:00Z',
    heute: '2026-10-28',
    fest: null,
  };

  it('live: offene der Gruppe aus früheren Sitzungen – nicht aus dieser, keine fremde Gruppe, keine gelöschten', () => {
    const r = offeneVonFrueher({
      ...q,
      aufgaben: [
        aufgabe('frueher'),
        aufgabe('ohne-sitzung', { sitzung: null }),
        aufgabe('hier', { sitzung: 'heute' }),
        aufgabe('fremd', { gruppe: 99 }),
        alsGeloescht(aufgabe('weg'), 1, '2026-10-01T00:00:00Z'),
        erledigt(aufgabe('fertig'), '2026-10-01T00:00:00Z'),
      ],
    });
    expect(r.offen.map((a) => a.id).sort()).toEqual(['frueher', 'ohne-sitzung']);
  });

  it('live: überfällig zuerst (Reihenfolge wie überall)', () => {
    const r = offeneVonFrueher({
      ...q,
      aufgaben: [
        aufgabe('spaeter', { bis: '2026-12-01' }),
        aufgabe('ueber', { bis: '2026-10-01' }),
      ],
    });
    expect(r.offen.map((a) => a.id)).toEqual(['ueber', 'spaeter']);
  });

  it('live: erledigt seit der letzten Sitzung, zuletzt erledigt zuerst; davor erledigte nicht', () => {
    const r = offeneVonFrueher({
      ...q,
      aufgaben: [
        erledigt(aufgabe('davor'), '2026-10-10T00:00:00Z'),
        erledigt(aufgabe('erst'), '2026-10-15T00:00:00Z'),
        erledigt(aufgabe('dann'), '2026-10-20T00:00:00Z'),
        erledigt(aufgabe('hier', { sitzung: 'heute' }), '2026-10-21T00:00:00Z'),
      ],
    });
    expect(r.erledigt.map((a) => a.id)).toEqual(['dann', 'erst']);
    expect(r.seit).toBe(q.seit);
  });

  it('live ohne frühere Sitzung: keine Erledigt-Zeile', () => {
    const r = offeneVonFrueher({
      ...q,
      seit: null,
      aufgaben: [erledigt(aufgabe('fertig'), '2026-10-20T00:00:00Z')],
    });
    expect(r.erledigt).toEqual([]);
  });

  it('festgehalten: genau die gemerkten – mit heutigem Stand; neue fehlen, gelöschte fallen weg', () => {
    const r = offeneVonFrueher({
      ...q,
      seit: '2026-11-11T00:00:00Z', // gilt nicht – das festgehaltene „seit“ zählt
      fest: { offen: ['a', 'weg', 'unbekannt'], erledigt: ['b'], seit: '2026-10-14T17:00:00Z' },
      aufgaben: [
        erledigt(aufgabe('a'), '2026-11-01T00:00:00Z'),
        erledigt(aufgabe('b'), '2026-10-20T00:00:00Z'),
        aufgabe('neu'),
        alsGeloescht(aufgabe('weg'), 1, '2026-11-02T00:00:00Z'),
      ],
    });
    expect(r.offen.map((a) => [a.id, a.status])).toEqual([['a', 'erledigt']]);
    expect(r.erledigt.map((a) => a.id)).toEqual(['b']);
    expect(r.seit).toBe('2026-10-14T17:00:00Z');
  });
});

describe('festePunkteFesthalten', () => {
  const dok: Block[] = [
    { id: 'p', type: 'heading', props: { level: 1 }, content: [], children: [] },
    { id: 'v1', type: BLOCK.verweis, props: { art: 'offene-aufgaben', fest: '' }, children: [] },
    {
      id: 'l',
      type: 'bulletListItem',
      content: [],
      children: [
        { id: 'v2', type: BLOCK.verweis, props: { art: 'letztes-protokoll' }, children: [] },
      ],
    },
  ];
  const offen = {
    offen: [aufgabe('a')],
    erledigt: [erledigt(aufgabe('b'), '2026-10-20T00:00:00Z')],
    seit: '2026-10-14T17:00:00Z',
  };

  it('merkt sich je Verweis, was er zeigt – auch eingerückt', () => {
    const neu = festePunkteFesthalten(dok, { offen, letztes: 'okt' });
    expect(festeAufgabenAus(neu[1].props?.fest)).toEqual({
      offen: ['a'],
      erledigt: ['b'],
      seit: '2026-10-14T17:00:00Z',
    });
    expect(festesProtokollAus(neu[2].children?.[0].props?.fest)).toEqual({ sitzung: 'okt' });
    expect(neu[0]).toEqual(dok[0]);
  });

  it('lässt schon Festgehaltenes, wie es ist', () => {
    const einmal = festePunkteFesthalten(dok, { offen, letztes: 'okt' });
    const zweimal = festePunkteFesthalten(einmal, {
      offen: { offen: [], erledigt: [], seit: null },
      letztes: null,
    });
    expect(zweimal).toEqual(einmal);
  });

  it('ohne Festgehaltenes gilt live (leer, kaputt → null)', () => {
    expect(festeAufgabenAus('')).toBeNull();
    expect(festeAufgabenAus(undefined)).toBeNull();
    expect(festeAufgabenAus('{kaputt')).toBeNull();
    expect(festesProtokollAus('')).toBeNull();
  });

  it('„wie letztes Mal“ und Vorlagen übernehmen nichts Festgehaltenes', () => {
    const fest = festePunkteFesthalten(
      [{ id: 'v', type: BLOCK.verweis, props: { art: 'offene-aufgaben' }, children: [] }],
      { offen, letztes: 'okt' },
    );
    const kopie = wieLetztesMal(fest, () => 'neu');
    expect(kopie[0].props).toEqual({ art: 'offene-aufgaben' });
    const vorlage = { ...STANDARD_VORLAGEN[0], bloecke: fest };
    expect(startDokument(vorlage, () => 'neu')[0].props).toEqual({ art: 'offene-aufgaben' });
  });
});
