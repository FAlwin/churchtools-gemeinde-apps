import { describe, expect, it } from 'vitest';
import {
  abfrageZustand,
  abfragenAus,
  erinnerungsTage,
  geltenderPlan,
  laufendeAbfrage,
  STANDARD_PLAN,
  type Abfrage,
  type AbfragenInhalt,
  type Erinnerungsplan,
  type Erinnerungspunkt,
} from './abfragen';

/**
 * R-1: die Regeln der Abfragen. Beispiel: Zeitraum 1.2.–31.3.2027, Frist 5.1., Öffnen 20.12.2026.
 */
const ABFRAGE: Abfrage = {
  id: 'a1',
  von: '2027-02-01',
  bis: '2027-03-31',
  frist: '2027-01-05',
  oeffnen: '2026-12-20',
  termine: [1, 2, 3],
  gestartet: { personId: 7, name: 'Alex', zeit: '2026-12-01T10:00:00.000Z' },
  beendet: null,
};
const mit = (teil: Partial<Abfrage>): Abfrage => ({ ...ABFRAGE, ...teil });
const plan = (...punkte: Erinnerungspunkt[]): Erinnerungsplan => ({ punkte, mail: null });
const HEUTE_FRUEH = '2026-12-01'; // vor dem Öffnen: nichts fällt wegen „heute“ weg

describe('erinnerungsTage', () => {
  it('Standardplan: öffnen, 2 Tage vor Frist, Frist, danach täglich höchstens 3-mal – aufsteigend', () => {
    expect(erinnerungsTage(STANDARD_PLAN, ABFRAGE, HEUTE_FRUEH)).toEqual([
      '2026-12-20',
      '2027-01-03',
      '2027-01-05',
      '2027-01-06',
      '2027-01-07',
      '2027-01-08',
    ]);
  });

  it('leerer Plan → keine Tage', () => {
    expect(erinnerungsTage(plan(), ABFRAGE, HEUTE_FRUEH)).toEqual([]);
  });

  describe('„heute“', () => {
    const p = plan({ art: 'oeffnen' }, { art: 'frist' });
    it('Tag = heute zählt mit (der Öffnen-Tag: Mail geht sofort raus)', () => {
      expect(erinnerungsTage(p, ABFRAGE, '2026-12-20')).toEqual(['2026-12-20', '2027-01-05']);
    });
    it('Tag < heute fällt weg (sonst liefen mehrere „warten bis“ sofort durch)', () => {
      expect(erinnerungsTage(p, ABFRAGE, '2026-12-21')).toEqual(['2027-01-05']);
    });
    it('Frist heute: nur noch der Tag der Frist und danach', () => {
      expect(erinnerungsTage(STANDARD_PLAN, ABFRAGE, '2027-01-05')).toEqual([
        '2027-01-05',
        '2027-01-06',
        '2027-01-07',
        '2027-01-08',
      ]);
    });
    it('alles vorbei → keine Tage', () => {
      expect(erinnerungsTage(STANDARD_PLAN, ABFRAGE, '2027-01-09')).toEqual([]);
    });
  });

  describe('Beginn des Zeitraums (`von`)', () => {
    const a = mit({ von: '2027-01-08' }); // Frist 5.1. → nachFrist 6., 7., 8.
    it('Tag = von fällt weg (nur Tage strikt davor)', () => {
      expect(
        erinnerungsTage(plan({ art: 'nachFrist', alleTage: 1, hoechstens: 5 }), a, HEUTE_FRUEH),
      ).toEqual(['2027-01-06', '2027-01-07']);
    });
    it('nachFrist läuft bis kurz vor `von` und nicht weiter, auch bei höchstens 14', () => {
      const tage = erinnerungsTage(
        plan({ art: 'nachFrist', alleTage: 2, hoechstens: 14 }),
        mit({ von: '2027-01-12' }),
        HEUTE_FRUEH,
      );
      expect(tage).toEqual(['2027-01-07', '2027-01-09', '2027-01-11']);
    });
    it('nachFrist: höchstens m Tage, auch wenn der Zeitraum später beginnt', () => {
      expect(
        erinnerungsTage(
          plan({ art: 'nachFrist', alleTage: 7, hoechstens: 2 }),
          ABFRAGE,
          HEUTE_FRUEH,
        ),
      ).toEqual(['2027-01-12', '2027-01-19']);
    });
  });

  it('Doppel: derselbe Tag aus zwei Punkten steht einmal da', () => {
    const t = erinnerungsTage(
      plan(
        { art: 'frist' },
        { art: 'frist' },
        { art: 'vorFrist', tage: 2 },
        { art: 'vorFrist', tage: 2 },
      ),
      ABFRAGE,
      HEUTE_FRUEH,
    );
    expect(t).toEqual(['2027-01-03', '2027-01-05']);
  });

  it('Doppel: Öffnen-Tag fällt mit „n Tage vor Frist“ zusammen', () => {
    const a = mit({ oeffnen: '2027-01-03' });
    expect(
      erinnerungsTage(plan({ art: 'oeffnen' }, { art: 'vorFrist', tage: 2 }), a, HEUTE_FRUEH),
    ).toEqual(['2027-01-03']);
  });

  it('kein Tag vor dem Öffnen (kurze Laufzeit: „2 Tage vor“ läge vor der Öffnungs-Mail)', () => {
    const a = mit({ oeffnen: '2027-01-04' });
    expect(
      erinnerungsTage(plan({ art: 'oeffnen' }, { art: 'vorFrist', tage: 2 }), a, HEUTE_FRUEH),
    ).toEqual(['2027-01-04']);
  });

  it('vorFrist über den Jahreswechsel und Schaltjahr (Datumsrechnung aus datum.ts)', () => {
    const a = mit({ frist: '2028-03-02', von: '2028-04-01', oeffnen: '2028-02-01' });
    expect(erinnerungsTage(plan({ art: 'vorFrist', tage: 3 }), a, '2028-01-01')).toEqual([
      '2028-02-28',
    ]);
  });

  it('beendete Abfrage erinnert nie', () => {
    expect(erinnerungsTage(STANDARD_PLAN, mit({ beendet: '2026-12-22' }), HEUTE_FRUEH)).toEqual([]);
  });

  it('geltenderPlan: ohne eigenen Plan der Standard', () => {
    expect(geltenderPlan({ plan: null })).toBe(STANDARD_PLAN);
    const eigener = plan({ art: 'frist' });
    expect(geltenderPlan({ plan: eigener })).toBe(eigener);
  });
});

describe('abfrageZustand – alle vier Übergänge', () => {
  it.each([
    ['2026-12-19', 'geplant'], // Tag vor dem Öffnen
    ['2026-12-20', 'offen'], // Öffnen-Tag
    ['2027-01-05', 'offen'], // Frist-Tag zählt noch
    ['2027-01-06', 'fristVorbei'], // Tag nach der Frist
    ['2027-01-31', 'fristVorbei'], // Tag vor Beginn
    ['2027-02-01', 'beendet'], // Beginn des Zeitraums
    ['2027-04-01', 'beendet'],
  ] as const)('heute %s → %s', (heute, soll) => {
    expect(abfrageZustand(ABFRAGE, heute)).toBe(soll);
  });

  it('von einem Planer beendet → beendet, egal wann', () => {
    expect(abfrageZustand(mit({ beendet: '2026-12-21' }), '2026-12-21')).toBe('beendet');
    expect(abfrageZustand(mit({ beendet: '2026-12-21' }), '2026-12-01')).toBe('beendet');
  });
});

describe('laufendeAbfrage', () => {
  const inhalt = (...abfragen: Abfrage[]): AbfragenInhalt => ({ plan: null, abfragen });
  it('keine Abfrage → null', () => {
    expect(laufendeAbfrage(inhalt(), '2026-12-25')).toBeNull();
  });
  it('geplant, offen und Frist vorbei sind laufend', () => {
    for (const heute of ['2026-12-01', '2026-12-25', '2027-01-20'])
      expect(laufendeAbfrage(inhalt(ABFRAGE), heute)).toBe(ABFRAGE);
  });
  it('Zeitraum begonnen oder beendet → null', () => {
    expect(laufendeAbfrage(inhalt(ABFRAGE), '2027-02-01')).toBeNull();
    expect(laufendeAbfrage(inhalt(mit({ beendet: '2026-12-21' })), '2026-12-25')).toBeNull();
  });
  it('zwischen alten und der laufenden findet sie die laufende', () => {
    const alt = mit({
      id: 'alt',
      von: '2026-11-01',
      bis: '2026-11-30',
      frist: '2026-10-05',
      oeffnen: '2026-09-20',
    });
    expect(laufendeAbfrage(inhalt(alt, ABFRAGE), '2026-12-25')?.id).toBe('a1');
  });
});

describe('abfragenAus – streng, nie halb', () => {
  const gut = (): unknown =>
    JSON.parse(JSON.stringify({ plan: STANDARD_PLAN, abfragen: [ABFRAGE] }));
  const kaputt = (
    aendere: (i: {
      plan: { punkte: unknown[]; mail: unknown };
      abfragen: Record<string, unknown>[];
    }) => void,
  ) => {
    const i = gut() as Parameters<typeof aendere>[0];
    aendere(i);
    return abfragenAus(i);
  };

  it('gültig: Standard-Plan, Plan null, ohne Abfragen – gelesen wie geschrieben (gegen die Erzeuger)', () => {
    expect(abfragenAus(gut())).toEqual({ plan: STANDARD_PLAN, abfragen: [ABFRAGE] });
    expect(abfragenAus({ plan: null, abfragen: [] })).toEqual({ plan: null, abfragen: [] });
    expect(
      abfragenAus({ plan: { punkte: [], mail: { betreff: 'B', text: 'T' } }, abfragen: [] }),
    ).toMatchObject({ plan: { mail: { betreff: 'B', text: 'T' } } });
  });

  it.each([
    null,
    undefined,
    'x',
    [],
    {},
    { plan: null },
    { abfragen: [] },
    { plan: 1, abfragen: [] },
  ])('%j ist ungültig', (roh) => {
    expect(abfragenAus(roh)).toBeNull();
  });

  it('unbekanntes Feld → ganz unlesbar (nichts wird stillschweigend weggeworfen)', () => {
    expect(abfragenAus({ ...(gut() as object), neu: 1 })).toBeNull();
    expect(kaputt((i) => (i.abfragen[0].extra = 1))).toBeNull();
  });

  describe('Grenzen des Plans', () => {
    const mitPunkt = (p: unknown) => kaputt((i) => (i.plan.punkte = [p]));
    it.each([
      [{ art: 'vorFrist', tage: 1 }, true],
      [{ art: 'vorFrist', tage: 60 }, true],
      [{ art: 'vorFrist', tage: 0 }, false],
      [{ art: 'vorFrist', tage: 61 }, false],
      [{ art: 'vorFrist', tage: 1.5 }, false],
      [{ art: 'vorFrist' }, false],
      [{ art: 'nachFrist', alleTage: 1, hoechstens: 1 }, true],
      [{ art: 'nachFrist', alleTage: 60, hoechstens: 14 }, true],
      [{ art: 'nachFrist', alleTage: 0, hoechstens: 3 }, false],
      [{ art: 'nachFrist', alleTage: 61, hoechstens: 3 }, false],
      [{ art: 'nachFrist', alleTage: 1, hoechstens: 0 }, false],
      [{ art: 'nachFrist', alleTage: 1, hoechstens: 15 }, false],
      [{ art: 'oeffnen' }, true],
      [{ art: 'oeffnen', tage: 1 }, false],
      [{ art: 'frist' }, true],
      [{ art: 'gibtEsNicht' }, false],
    ])('Punkt %j → gültig: %s', (p, gueltig) => {
      expect(mitPunkt(p) !== null).toBe(gueltig);
    });

    it('höchstens 10 Punkte', () => {
      expect(kaputt((i) => (i.plan.punkte = Array(10).fill({ art: 'frist' })))).not.toBeNull();
      expect(kaputt((i) => (i.plan.punkte = Array(11).fill({ art: 'frist' })))).toBeNull();
    });

    it.each([{ betreff: '', text: 'T' }, { betreff: 'B', text: '  ' }, { betreff: 'B' }, 'x'])(
      'Mail %j ist ungültig',
      (m) => {
        expect(kaputt((i) => (i.plan.mail = m))).toBeNull();
      },
    );
  });

  describe('Datumsformat streng', () => {
    it.each([
      '2027-1-5',
      '05.01.2027',
      '2027-01-05T00:00:00Z',
      '2027-02-30',
      '2027-13-01',
      // Kalender prüfen, auch wo die Reihenfolge der Tage sonst stimmen würde (Jan. 2027 < von, > oeffnen):
      '2027-01-32',
      '2027-01-00',
      '2027-02-29', // 2027 ist kein Schaltjahr
      '',
      20270105,
    ])('frist %j ist ungültig', (t) => {
      expect(kaputt((i) => (i.abfragen[0].frist = t))).toBeNull();
    });
    it('ein Schalttag ist ein echter Tag', () => {
      const a = {
        von: '2028-03-01',
        bis: '2028-03-31',
        frist: '2028-02-29',
        oeffnen: '2028-02-01',
      };
      expect(kaputt((i) => Object.assign(i.abfragen[0], a))).not.toBeNull();
    });
    it('beendet: Datum oder null, sonst nichts', () => {
      expect(kaputt((i) => (i.abfragen[0].beendet = '2026-12-22'))).not.toBeNull();
      expect(kaputt((i) => (i.abfragen[0].beendet = 'gestern'))).toBeNull();
      expect(kaputt((i) => delete i.abfragen[0].beendet)).toBeNull();
    });
  });

  describe('Reihenfolge der Tage', () => {
    it('von = bis ist ein Zeitraum (ein Tag)', () => {
      expect(kaputt((i) => (i.abfragen[0].bis = i.abfragen[0].von as string))).not.toBeNull();
    });
    it('von > bis ist ungültig', () => {
      expect(kaputt((i) => (i.abfragen[0].bis = '2027-01-31'))).toBeNull();
    });
    it('frist = von ist ungültig (die Antworten sollen VOR dem Zeitraum da sein)', () => {
      expect(kaputt((i) => (i.abfragen[0].frist = '2027-02-01'))).toBeNull();
      expect(kaputt((i) => (i.abfragen[0].frist = '2027-01-31'))).not.toBeNull();
    });
    it('öffnen nach der Frist ist ungültig, öffnen = Frist gültig', () => {
      expect(kaputt((i) => (i.abfragen[0].oeffnen = '2027-01-06'))).toBeNull();
      expect(kaputt((i) => (i.abfragen[0].oeffnen = '2027-01-05'))).not.toBeNull();
    });
  });

  it('Termine: ganze positive Zahlen', () => {
    expect(kaputt((i) => (i.abfragen[0].termine = []))).not.toBeNull();
    expect(kaputt((i) => (i.abfragen[0].termine = [1, 'x']))).toBeNull();
    expect(kaputt((i) => (i.abfragen[0].termine = [0]))).toBeNull();
    expect(kaputt((i) => (i.abfragen[0].termine = [1.5]))).toBeNull();
  });

  it('eine kaputte unter zwei Abfragen macht den ganzen Wert unlesbar (nie halb)', () => {
    const zweite = { ...ABFRAGE, id: 'a2', frist: 'kaputt' };
    expect(abfragenAus({ plan: null, abfragen: [ABFRAGE, zweite] })).toBeNull();
  });

  it('doppelte IDs sind ungültig', () => {
    expect(abfragenAus({ plan: null, abfragen: [ABFRAGE, ABFRAGE] })).toBeNull();
  });
});
