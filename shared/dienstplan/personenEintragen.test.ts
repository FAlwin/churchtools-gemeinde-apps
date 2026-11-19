import { describe, expect, it } from 'vitest';
import type { Entwurf } from './entwuerfe';
import type { PlanPlatz } from './plan';
import {
  abwesendText,
  eintragenWarnung,
  freiOhneEntwurf,
  freierPlatzAktion,
  gastAktion,
  gastNeuAktion,
  platzDazuText,
  platzFuerEintrag,
  schonEingeteiltText,
  vollText,
  zellenAktion,
  type PlatzEntwurf,
} from './personenEintragen';

const frei = (index: number | null): PlanPlatz => ({
  art: 'frei',
  belegung: { art: 'frei' },
  name: null,
  gast: false,
  verborgen: false,
  ich: false,
  personId: null,
  index,
});
const besetzt = (index: number | null, personId: number, name: string): PlanPlatz => ({
  art: 'zugesagt',
  belegung: { art: 'zusage', personId },
  name,
  gast: false,
  verborgen: false,
  ich: false,
  personId,
  index,
});
const entwurf = (index: number | null, personId: number, von = 1): Entwurf => ({
  ort: { eventId: 20, serviceId: 6, index },
  ziel: { art: 'person', personId, name: 'Daniel F.' },
  modus: 'anfrage',
  gesehen: { art: 'frei' },
  von: { personId: von, name: 'Planer' },
  zeit: '2026-11-16T10:00:00.000Z',
  version: 3,
});
/** Die Entwürfe der Matrix, nach `index` des Platzes. */
const suche =
  (liste: { entwurf: Entwurf; veraltet?: boolean }[]): PlatzEntwurf =>
  (p) => {
    const e = liste.find((x) => x.entwurf.ort.index === p.index);
    return e ? { entwurf: e.entwurf, veraltet: e.veraltet ?? false } : null;
  };
const ohne = suche([]);

describe('freiOhneEntwurf', () => {
  it('nur ein freier Platz ohne Entwurf – belegt oder mit Entwurf nicht, auch nicht mit veraltetem', () => {
    expect(freiOhneEntwurf(frei(1), null)).toBe(true);
    expect(freiOhneEntwurf(besetzt(1, 5, 'Anna'), null)).toBe(false);
    expect(freiOhneEntwurf(frei(1), { entwurf: entwurf(1, 12) })).toBe(false);
  });
});

/** „X zurückziehen“ am Platz `index` (X = Person 5, wie `besetzt`) – gesehen: der Platz, wie er in ChurchTools ist. */
const zurueck = (index: number | null, version = 7): Entwurf => ({
  ...entwurf(index, 0),
  ziel: { art: 'frei' },
  gesehen: { art: 'zusage', personId: 5 },
  version,
});

describe('platzFuerEintrag – welcher Platz ist für einen neuen Entwurf zu haben (P2a-2)', () => {
  const anna = besetzt(1, 5, 'Anna');

  it('ein freier Platz ohne Entwurf hat Vorrang – auch vor einem Zurückziehen-Platz davor', () => {
    const e = suche([{ entwurf: zurueck(1) }]);
    expect(platzFuerEintrag([anna, frei(2)], e)).toEqual({ nr: 2, ersetzt: null });
  });

  it('sonst der Platz mit gültigem „Zurückziehen“-Entwurf – mit dem Entwurf, den der Eintrag ersetzt', () => {
    const z = zurueck(1);
    expect(platzFuerEintrag([anna, besetzt(2, 6, 'Ben')], suche([{ entwurf: z }]))).toEqual({
      nr: 1,
      ersetzt: z,
    });
  });

  it('ein veralteter „Zurückziehen“-Entwurf, ein Ersetzen-Entwurf und ein Entwurf auf einen freien Platz geben nichts her', () => {
    const plaetze = [anna, frei(2)];
    expect(platzFuerEintrag([anna], suche([{ entwurf: zurueck(1), veraltet: true }]))).toBeNull();
    expect(platzFuerEintrag([anna], suche([{ entwurf: entwurf(1, 8) }]))).toBeNull();
    expect(platzFuerEintrag(plaetze, suche([{ entwurf: entwurf(2, 8) }]))).toBeNull();
    expect(platzFuerEintrag([anna], ohne)).toBeNull();
  });
});

describe('zellenAktion', () => {
  const o = { personId: 12, zustand: null, ichId: 1, entwurf: ohne } as const;

  it('leere Zelle: Entwurf auf den ersten freien Platz (1-basiert)', () => {
    expect(zellenAktion({ ...o, plaetze: [besetzt(1, 5, 'Anna'), frei(2), frei(3)] })).toEqual({
      art: 'eintragen',
      nr: 2,
    });
  });

  it('Plätze mit Entwurf werden übersprungen – auch ein veralteter Entwurf hält den Platz', () => {
    const e = suche([{ entwurf: entwurf(1, 7) }, { entwurf: entwurf(2, 8), veraltet: true }]);
    expect(zellenAktion({ ...o, entwurf: e, plaetze: [frei(1), frei(2), frei(3)] })).toEqual({
      art: 'eintragen',
      nr: 3,
    });
  });

  it('kein freier Platz: voll – mit der Platzzahl, auch wenn Entwürfe die letzten Plätze halten', () => {
    expect(zellenAktion({ ...o, plaetze: [besetzt(1, 5, 'Anna'), besetzt(2, 6, 'Ben')] })).toEqual({
      art: 'voll',
      von: 2,
    });
    const e = suche([{ entwurf: entwurf(2, 8) }]);
    expect(zellenAktion({ ...o, entwurf: e, plaetze: [besetzt(1, 5, 'Anna'), frei(2)] })).toEqual({
      art: 'voll',
      von: 2,
    });
  });

  it('voll auch mit einem veralteten Entwurf – „Platz dazunehmen“ gibt es trotzdem (19.11.2026: die Entwürfe gehen mit)', () => {
    const e = suche([{ entwurf: entwurf(2, 8), veraltet: true }]);
    expect(
      zellenAktion({ ...o, entwurf: e, plaetze: [besetzt(1, 5, 'Anna'), besetzt(2, 6, 'Ben')] }),
    ).toEqual({ art: 'voll', von: 2 });
  });

  it('voller Dienst mit „Zurückziehen“-Entwurf: Eintragen ersetzt ihn – `ersetzt` ist die Version (P2a-2)', () => {
    const e = suche([{ entwurf: zurueck(2, 9) }]);
    expect(
      zellenAktion({ ...o, entwurf: e, plaetze: [besetzt(1, 5, 'Anna'), besetzt(2, 5, 'X')] }),
    ).toEqual({
      art: 'eintragen',
      nr: 2,
      ersetzt: 9,
    });
  });

  it('Dienst an diesem Termin nicht vorgesehen: nichts', () => {
    expect(zellenAktion({ ...o, plaetze: null })).toBeNull();
  });

  it('eigener Entwurf als ANFRAGE: der Klick stellt auf direkt um – mit Platz und Entwurf (Version für den Schutz)', () => {
    const e = entwurf(2, 12);
    const r = zellenAktion({
      ...o,
      zustand: 'entwurf',
      entwurf: suche([{ entwurf: e }]),
      plaetze: [besetzt(1, 5, 'Anna'), frei(2)],
    });
    expect(r).toEqual({ art: 'direkt', nr: 2, entwurf: e });
  });

  it('eigener Entwurf, schon DIREKT: der Klick nimmt ihn weg (Zyklus Anfrage → direkt → weg)', () => {
    const e = { ...entwurf(2, 12), modus: 'direkt' as const };
    const r = zellenAktion({
      ...o,
      zustand: 'entwurf',
      entwurf: suche([{ entwurf: e }]),
      plaetze: [besetzt(1, 5, 'Anna'), frei(2)],
    });
    expect(r).toEqual({ art: 'wegnehmen', nr: 2, entwurf: e });
  });

  it('der Entwurf eines anderen Planers: auch das Umstellen auf direkt ist ihm vorbehalten – nichts', () => {
    expect(
      zellenAktion({
        ...o,
        zustand: 'entwurf',
        plaetze: [frei(1)],
        entwurf: suche([{ entwurf: entwurf(1, 12, 99) }]),
      }),
    ).toBeNull();
  });

  it('der Entwurf eines anderen Planers, ein Entwurf einer anderen Person und ein veralteter: nichts', () => {
    const plaetze = [frei(1), frei(2)];
    const base = { ...o, zustand: 'entwurf' } as const;
    expect(
      zellenAktion({ ...base, plaetze, entwurf: suche([{ entwurf: entwurf(1, 12, 99) }]) }),
    ).toBeNull();
    expect(
      zellenAktion({ ...base, plaetze, entwurf: suche([{ entwurf: entwurf(1, 77) }]) }),
    ).toBeNull();
    expect(
      zellenAktion({
        ...base,
        plaetze,
        entwurf: suche([{ entwurf: entwurf(1, 12), veraltet: true }]),
      }),
    ).toBeNull();
  });

  it('bestehende Einteilung (zugesagt, angefragt) ohne Entwurf: „belegt“ am Platz der Person (P2b)', () => {
    const plaetze = [frei(1), besetzt(2, 12, 'Daniel')];
    expect(zellenAktion({ ...o, zustand: 'zugesagt', plaetze })).toEqual({ art: 'belegt', nr: 2 });
    expect(zellenAktion({ ...o, zustand: 'angefragt', plaetze })).toEqual({
      art: 'belegt',
      nr: 2,
    });
  });

  it('bestehende Einteilung: ein Platz mit Entwurf zählt nicht – der nächste Platz der Person ohne Entwurf', () => {
    // Daniel steht an Platz 1 UND 2; Platz 1 hat einen (veralteten) Entwurf – dort gibt es in der Matrix keinen Knopf.
    const plaetze = [besetzt(1, 12, 'Daniel'), besetzt(2, 12, 'Daniel')];
    const e = suche([{ entwurf: zurueck(1), veraltet: true }]);
    expect(zellenAktion({ ...o, zustand: 'zugesagt', plaetze, entwurf: e })).toEqual({
      art: 'belegt',
      nr: 2,
    });
    // Nur ein Platz, veralteter Entwurf: wie in der Matrix gibt es nur das Schild – kein Klick.
    expect(
      zellenAktion({ ...o, zustand: 'zugesagt', plaetze: [plaetze[0]], entwurf: e }),
    ).toBeNull();
  });

  it('„zurueck“ (ein Entwurf nimmt die Person weg): öffnet den Entwurf an ihrem Platz – ein veralteter zählt nicht', () => {
    const plaetze = [frei(1), besetzt(2, 12, 'Daniel')];
    const e = suche([{ entwurf: { ...zurueck(2), gesehen: { art: 'zusage', personId: 12 } } }]);
    expect(zellenAktion({ ...o, zustand: 'zurueck', plaetze, entwurf: e })).toEqual({
      art: 'entwurfFach',
      nr: 2,
    });
    const alt = suche([{ entwurf: zurueck(2), veraltet: true }]);
    expect(zellenAktion({ ...o, zustand: 'zurueck', plaetze, entwurf: alt })).toBeNull();
  });
});

describe('gastAktion', () => {
  it('belegter Gast: Fenster am belegten Platz; Entwurf: Entwurfs-Fenster; veraltet: nichts', () => {
    expect(gastAktion({ nr: 2, klick: 'belegt' })).toEqual({ art: 'belegt', nr: 2 });
    expect(gastAktion({ nr: 3, klick: 'entwurf' })).toEqual({ art: 'entwurfFach', nr: 3 });
    expect(gastAktion({ nr: 1, klick: null })).toBeNull();
  });
});

describe('gastNeuAktion (leere Gäste-Zelle, P2d)', () => {
  it('trägt auf den ersten freien Platz ein – dieselbe Wahl wie bei einer leeren Personen-Zelle', () => {
    const plaetze = [besetzt(1, 5, 'Anna'), frei(2), frei(3)];
    expect(gastNeuAktion(plaetze, ohne)).toEqual({ art: 'eintragen', nr: 2 });
    expect(gastNeuAktion(plaetze, ohne)).toEqual(
      zellenAktion({ plaetze, personId: 12, zustand: null, entwurf: ohne, ichId: 1 }),
    );
  });

  it('ein Platz mit „Zurückziehen“-Entwurf wird ersetzt, ein belegter Platz bleibt unberührt', () => {
    const plaetze = [besetzt(1, 5, 'Anna'), besetzt(2, 8, 'Ben')];
    const zurueck: Entwurf = { ...entwurf(2, 8), ziel: { art: 'frei' } };
    expect(gastNeuAktion(plaetze, suche([{ entwurf: zurueck }]))).toEqual({
      art: 'eintragen',
      nr: 2,
      ersetzt: 3,
    });
  });

  it('voll: alle Plätze belegt oder von einem Entwurf gehalten', () => {
    const plaetze = [besetzt(1, 5, 'Anna'), besetzt(2, 8, 'Ben')];
    expect(gastNeuAktion(plaetze, ohne)).toEqual({ art: 'voll', von: 2 });
    expect(
      gastNeuAktion([besetzt(1, 5, 'Anna'), frei(2)], suche([{ entwurf: entwurf(2, 12) }])),
    ).toEqual({
      art: 'voll',
      von: 2,
    });
  });

  it('ein Gast-Entwurf hält seinen Platz – der zweite Gast kommt auf den nächsten freien', () => {
    const gast: Entwurf = { ...entwurf(1, 0), ziel: { art: 'gast', name: 'Max Gast' } };
    expect(gastNeuAktion([frei(1), frei(2)], suche([{ entwurf: gast }]))).toEqual({
      art: 'eintragen',
      nr: 2,
    });
  });

  it('Dienst an diesem Termin nicht vorgesehen: nichts', () => {
    expect(gastNeuAktion(null, ohne)).toBeNull();
    expect(freierPlatzAktion([frei(1)], ohne)).toEqual({ art: 'eintragen', nr: 1 });
  });
});

describe('Texte', () => {
  it('schon eingeteilt: ein Dienst, mehrere mit „und“', () => {
    expect(schonEingeteiltText('Daniel F.', '2026-11-20', ['Gesang'])).toBe(
      'Daniel F. ist am Fr, 20.11. schon bei Gesang eingeteilt.',
    );
    expect(schonEingeteiltText('Daniel F.', '2026-11-20', ['Gesang', 'Bild', 'Licht'])).toBe(
      'Daniel F. ist am Fr, 20.11. schon bei Gesang, Bild und Licht eingeteilt.',
    );
  });

  it('abwesend: Grund und Zeitraum – ein Tag steht einmal', () => {
    expect(
      abwesendText('Daniel F.', '2026-11-29', {
        grund: 'Urlaub',
        von: '2026-11-28',
        bis: '2026-11-30',
      }),
    ).toBe('Daniel F. ist am So, 29.11. abwesend: Urlaub (28.11.–30.11.).');
    expect(
      abwesendText('Daniel F.', '2026-11-29', {
        grund: 'Abwesend',
        von: '2026-11-29',
        bis: '2026-11-29',
      }),
    ).toBe('Daniel F. ist am So, 29.11. abwesend: Abwesend (29.11.).');
  });

  it('voll', () => {
    expect(vollText('Ton', '2026-11-27', 2)).toBe('Ton am 27.11. ist voll (2 von 2).');
  });

  it('Platz dazunehmen: „… bekommt sofort einen dritten Platz …“ – bis zwölf ausgeschrieben, danach „13.“', () => {
    expect(platzDazuText('Ton', 3, 'Daniel F.')).toBe(
      'Ton bekommt sofort einen dritten Platz (in ChurchTools gespeichert). Daniel F. wird als Entwurf eingetragen.',
    );
    expect(platzDazuText('Ton', 1, 'X')).toContain('einen ersten Platz');
    expect(platzDazuText('Ton', 13, 'X')).toContain('einen 13. Platz');
  });
});

describe('eintragenWarnung', () => {
  const zelle = (x: Partial<Parameters<typeof eintragenWarnung>[0]['zelle']> = {}) => ({
    weitere: [],
    abwesend: null,
    ...x,
  });
  const w = (z: ReturnType<typeof zelle>) =>
    eintragenWarnung({ name: 'Daniel F.', dienst: 'Ton', tag: '2026-11-20', zelle: z });

  it('nichts zu warnen: null', () => {
    expect(w(zelle())).toBeNull();
  });

  it('anderer Dienst am Tag', () => {
    expect(w(zelle({ weitere: [{ dienst: 'Gesang', fremd: false, gruppe: null }] }))).toEqual({
      saetze: ['Daniel F. ist am Fr, 20.11. schon bei Gesang eingeteilt.'],
      frage: 'Trotzdem für Ton eintragen?',
    });
  });

  it('ein ausgeblendeter anderer Dienst warnt genauso', () => {
    expect(
      w(zelle({ weitere: [{ dienst: 'Bild', fremd: true, gruppe: 'Technik' }] }))?.saetze,
    ).toEqual(['Daniel F. ist am Fr, 20.11. schon bei Bild eingeteilt.']);
  });

  it('abwesend', () => {
    expect(
      w(zelle({ abwesend: { grund: 'Urlaub', von: '2026-11-18', bis: '2026-11-22' } })),
    ).toEqual({
      saetze: ['Daniel F. ist am Fr, 20.11. abwesend: Urlaub (18.11.–22.11.).'],
      frage: 'Trotzdem für Ton eintragen?',
    });
  });

  it('beides: ein Fenster mit beiden Sätzen und einer Frage', () => {
    const r = w(
      zelle({
        weitere: [{ dienst: 'Gesang', fremd: false, gruppe: null }],
        abwesend: { grund: 'Urlaub', von: '2026-11-20', bis: '2026-11-20' },
      }),
    );
    expect(r?.saetze).toHaveLength(2);
    expect(r?.frage).toBe('Trotzdem für Ton eintragen?');
  });
});
