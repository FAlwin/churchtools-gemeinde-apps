import { describe, expect, it } from 'vitest';
import type { Dienstgruppe } from '../ct/dienstgruppen';
import { abfragenAus, fragtZusagen, type AbfragenInhalt } from './abfragen';
import { standardInhalt } from './abfragenSpeicher';
import { ansichtBeimOeffnen, zusagenGruppen, zusagenTermine } from './verfuegbarkeitAnsicht';

/**
 * **Die Ansichten von „Verfügbarkeit“ (V-3).** Die Dokumente kommen aus dem Erzeuger (`standardInhalt`, `abfragenAus`), nicht
 * aus handgeschriebenen Literalen – so bleibt der Test bei einer geänderten Art nicht stehen.
 */
const MUSIK: Dienstgruppe = { id: 1, name: 'Musik', fuerAlle: false };
const TECHNIK: Dienstgruppe = { id: 2, name: 'Technik', fuerAlle: false };
const KINDER: Dienstgruppe = { id: 3, name: 'Kinder', fuerAlle: false };
const GRUPPEN = [MUSIK, TECHNIK, KINDER];

const zusagen = (): AbfragenInhalt => ({ ...standardInhalt(), verfuegbarkeit: 'zusagen' });
const abwesend = (): AbfragenInhalt => ({ ...standardInhalt(), verfuegbarkeit: 'abwesend' });

describe('zusagenGruppen', () => {
  it('nimmt die Gruppen, die nach Zusagen fragen – in der Reihenfolge der eigenen Gruppen', () => {
    const doks = new Map([
      [1, zusagen()],
      [2, abwesend()],
      [3, zusagen()],
    ]);
    expect(zusagenGruppen(GRUPPEN, (id) => doks.get(id) ?? null).map((g) => g.id)).toEqual([1, 3]);
  });

  it('der Startwert (Dokument ohne Feld) fragt Zusagen – aus dem Erzeuger gelesen', () => {
    const alt = abfragenAus({ plan: null, abfragen: [] });
    expect(alt).not.toBeNull();
    expect(zusagenGruppen([MUSIK], () => alt)).toEqual([MUSIK]);
    // Derselbe Weg wie die eine Regel – kein zweites „zusagen“ im Code.
    expect(fragtZusagen(alt)).toBe(true);
  });

  it('ein nicht lesbares Dokument (null) gilt als Zusagen – nichts geht verloren', () => {
    expect(zusagenGruppen(GRUPPEN, () => null)).toEqual(GRUPPEN);
  });

  it('nur „Nur abwesend“ überall: keine Zusagen-Gruppe', () => {
    expect(zusagenGruppen(GRUPPEN, () => abwesend())).toEqual([]);
  });

  it('ohne eigene Gruppen: leer', () => {
    expect(zusagenGruppen([], () => zusagen())).toEqual([]);
  });
});

describe('ansichtBeimOeffnen', () => {
  it('ohne Abfrage: Abwesenheiten', () => {
    expect(ansichtBeimOeffnen(null, [MUSIK])).toBe('abwesenheiten');
  });
  it('über eine Abfrage einer Zusagen-Gruppe: Zusagen', () => {
    expect(ansichtBeimOeffnen(1, [MUSIK, KINDER])).toBe('zusagen');
  });
  it('über eine Abfrage einer Gruppe, die nur Abwesenheiten fragt: Abwesenheiten', () => {
    expect(ansichtBeimOeffnen(2, [MUSIK])).toBe('abwesenheiten');
  });
  it('ohne Zusagen-Gruppe nie Zusagen', () => {
    expect(ansichtBeimOeffnen(1, [])).toBe('abwesenheiten');
  });
  it('V-4: fragt die Gruppe der Abfrage „Nur abwesend“, gilt immer Abwesenheiten – auch wenn sie (Lesefehler = Zusagen) in der Liste steht', () => {
    expect(ansichtBeimOeffnen(2, [TECHNIK], 'abwesend')).toBe('abwesenheiten');
    // Gegenstück: dieselbe Lage mit Zusagen (oder ohne Angabe) öffnet Zusagen.
    expect(ansichtBeimOeffnen(2, [TECHNIK], 'zusagen')).toBe('zusagen');
    expect(ansichtBeimOeffnen(2, [TECHNIK])).toBe('zusagen');
    expect(ansichtBeimOeffnen(2, [TECHNIK], null)).toBe('zusagen');
  });
});

describe('zusagenTermine', () => {
  // Dienste: 10 Gesang, 11 Gitarre (Musik) · 20 Ton (Technik) · 30 Betreuung (Kinder)
  const gruppeVon = (serviceId: number): number | undefined =>
    ({ 10: 1, 11: 1, 20: 2, 30: 3 })[serviceId];
  const platz = (serviceId: unknown, isValid?: boolean) => ({
    serviceId,
    ...(isValid === undefined ? {} : { isValid }),
  });

  it('Termine, an denen eine Zusagen-Gruppe Dienste hat – mit dem Namen der Gruppe', () => {
    const r = zusagenTermine(
      [
        { id: 100, eventServices: [platz(10), platz(11), platz(20)] },
        { id: 101, eventServices: [platz(20)] },
        { id: 102, eventServices: [platz(30), platz(10)] },
        { id: 103, eventServices: [] },
        { id: 104 },
      ],
      gruppeVon,
      [MUSIK, KINDER],
    );
    expect([...r.entries()]).toEqual([
      [100, ['Musik']],
      [102, ['Musik', 'Kinder']],
    ]);
  });

  it('die Namen stehen in der Reihenfolge der Gruppen, nicht der Plätze', () => {
    const r = zusagenTermine([{ id: 1, eventServices: [platz(30), platz(10)] }], gruppeVon, [
      MUSIK,
      KINDER,
    ]);
    expect(r.get(1)).toEqual(['Musik', 'Kinder']);
  });

  it('ein ungültiger Platz zählt nicht (Dienst nicht mehr am Termin)', () => {
    const r = zusagenTermine([{ id: 1, eventServices: [platz(10, false)] }], gruppeVon, [MUSIK]);
    expect(r.size).toBe(0);
  });

  it('ein gültiger Platz mit isValid: true zählt', () => {
    const r = zusagenTermine([{ id: 1, eventServices: [platz(10, true)] }], gruppeVon, [MUSIK]);
    expect(r.get(1)).toEqual(['Musik']);
  });

  it('ein Dienst ohne bekannte Gruppe und eine Platz ohne Dienst-ID gehören keiner Gruppe', () => {
    const r = zusagenTermine(
      [{ id: 1, eventServices: [platz(999), platz(undefined), platz('10')] }],
      gruppeVon,
      GRUPPEN,
    );
    expect(r.size).toBe(0);
  });

  it('ohne Zusagen-Gruppen: keine Termine', () => {
    expect(zusagenTermine([{ id: 1, eventServices: [platz(10)] }], gruppeVon, []).size).toBe(0);
  });
});
