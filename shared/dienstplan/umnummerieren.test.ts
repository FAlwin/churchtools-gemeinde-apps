import { describe, expect, it } from 'vitest';
import type { Wert } from '../ct/modulDaten';
import { anzahlAendern } from './anzahl';
import { Fehler, nachbau } from './einteilen.testutil';
import { KAT, MODUL, speicher } from './entwuerfe.testutil';
import { inhaltAusWerten, ortSchluessel, type Entwurf } from './entwuerfe';
import { entwuerfeMitnehmen, platzStaende, umzuegeRechnen, type PlatzStand } from './umnummerieren';
import type { RohPlatz } from './termine';

const EVENT = 7;
const DIENST = 9;

type Art = 'frei' | 'person';
/** Die Plätze des Dienstes, wie ChurchTools sie liefert: IDs 1, 2, 3 …; `index` null bei nur einem Platz. */
const plaetze = (arten: Art[]): RohPlatz[] =>
  arten.map((a, i) => ({
    id: i + 1,
    serviceId: DIENST,
    index: arten.length === 1 ? null : i + 1,
    personId: a === 'person' ? 40 + i : null,
    name: a === 'person' ? `Person ${i + 1}` : null,
  }));

const entwurfAn = (index: number | null, x: Partial<Entwurf> = {}): Entwurf => ({
  ort: { eventId: EVENT, serviceId: DIENST, index },
  ziel: { art: 'person', personId: 99, name: 'Anna Test' },
  modus: 'anfrage',
  gesehen: { art: 'frei' },
  von: { personId: 1, name: 'Alwin' },
  zeit: '2026-11-19T10:00:00.000Z',
  version: 1,
  ...x,
});

/**
 * Vorher/nachher von dem Erzeuger, der sie auch in der App liefert (`anzahlAendern` gegen den Nachbau von ChurchTools –
 * der nummeriert wie gemessen neu), dann die Rechnung. Ergebnis: von → nach je Umzug, plus die Nummern ohne Platz.
 */
async function lauf(arten: Art[], neu: number, entwuerfeAn: (number | null)[]) {
  const c = nachbau(plaetze(arten));
  const r = await anzahlAendern(c.port, EVENT, DIENST, arten.length, neu);
  if (!r.ok || !r.plaetze) throw new Error('Änderung hat nicht geklappt');
  const plan = umzuegeRechnen({
    eventId: EVENT,
    serviceId: DIENST,
    vorher: r.plaetze.vorher,
    nachher: r.plaetze.nachher,
    entwuerfe: entwuerfeAn.map((i) => entwurfAn(i)),
  });
  return {
    umzuege: plan.umzuege.map((u) => [u.entwurf.ort.index, u.nach.index]),
    ohnePlatz: plan.ohnePlatz.map((e) => e.ort.index),
  };
}

describe('umzuegeRechnen – die gemessenen Fälle (19.11.2026)', () => {
  it('1 → 2: aus „ohne Nummer“ wird Platz 1', async () => {
    expect(await lauf(['frei'], 2, [null])).toEqual({ umzuege: [[null, 1]], ohnePlatz: [] });
  });

  it('2 → 1: der übrige Platz verliert seine Nummer; der Entwurf geht mit', async () => {
    expect(await lauf(['person', 'frei'], 1, [1])).toEqual({ umzuege: [[1, null]], ohnePlatz: [] });
  });

  it('2 → 1: der Entwurf auf dem weggefallenen freien Platz hat kein Ziel (kein anderer freier) → ohne Platz', async () => {
    expect(await lauf(['person', 'frei'], 1, [2])).toEqual({ umzuege: [], ohnePlatz: [2] });
  });

  it('2 → 3: nichts verschiebt sich', async () => {
    expect(await lauf(['person', 'frei'], 3, [1, 2])).toEqual({ umzuege: [], ohnePlatz: [] });
  });

  it('3 → 2 mit freiem Platz in der Mitte: der Entwurf auf Platz 3 rückt auf Platz 2', async () => {
    expect(await lauf(['person', 'frei', 'person'], 2, [3])).toEqual({
      umzuege: [[3, 2]],
      ohnePlatz: [],
    });
  });

  it('mehrere rücken auf, aufsteigend nach neuer Nummer (5 → 3, freie 2 und 3 fallen weg)', async () => {
    expect(await lauf(['person', 'frei', 'frei', 'person', 'person'], 3, [5, 4])).toEqual({
      umzuege: [
        [4, 2],
        [5, 3],
      ],
      ohnePlatz: [],
    });
  });

  it('weggefallener Platz mit Entwurf → auf einen übrig gebliebenen freien Platz OHNE Entwurf (kleinste Nummer zuerst)', async () => {
    // 4 → 3: Platz 4 (frei, von hinten) fällt weg; 1 hat einen Entwurf, 2 ist frei und leer.
    expect(await lauf(['frei', 'frei', 'frei', 'frei'], 3, [1, 4])).toEqual({
      umzuege: [[4, 2]],
      ohnePlatz: [],
    });
  });

  it('kein freier Platz ohne Entwurf übrig → der Entwurf bleibt, wo er ist (ohne Platz)', async () => {
    expect(await lauf(['frei', 'frei', 'frei'], 2, [1, 2, 3])).toEqual({
      umzuege: [],
      ohnePlatz: [3],
    });
  });

  it('ein Entwurf, der schon vorher keinen Platz hatte, wird nicht angefasst', async () => {
    expect(await lauf(['person', 'frei', 'person'], 2, [3, 9])).toEqual({
      umzuege: [[3, 2]],
      ohnePlatz: [9],
    });
  });

  it('Entwürfe an anderen Terminen und Diensten bleiben unberührt', async () => {
    const c = nachbau(plaetze(['person', 'frei', 'person']));
    const r = await anzahlAendern(c.port, EVENT, DIENST, 3, 2);
    if (!r.ok || !r.plaetze) throw new Error('Änderung hat nicht geklappt');
    const fremd = [
      entwurfAn(3, { ort: { eventId: 8, serviceId: DIENST, index: 3 } }),
      entwurfAn(3, { ort: { eventId: EVENT, serviceId: 5, index: 3 } }),
    ];
    expect(
      umzuegeRechnen({
        eventId: EVENT,
        serviceId: DIENST,
        vorher: r.plaetze.vorher,
        nachher: r.plaetze.nachher,
        entwuerfe: fremd,
      }),
    ).toEqual({ umzuege: [], ohnePlatz: [] });
  });

  it('nie ein Umzug auf einen besetzten Ort – auch nicht auf den eines Entwurfs, der liegen bleibt', () => {
    // Von Hand gebaut, ChurchTools liefert das so nicht: a (Nr. 1) fällt weg, b rückt von 2 auf 1.
    const vorher: PlatzStand[] = [
      { id: 1, index: 1, frei: true },
      { id: 2, index: 2, frei: true },
    ];
    const nachher: PlatzStand[] = [{ id: 2, index: 1, frei: true }];
    const plan = umzuegeRechnen({
      eventId: EVENT,
      serviceId: DIENST,
      vorher,
      nachher,
      entwuerfe: [entwurfAn(1), entwurfAn(2)],
    });
    expect(plan.umzuege).toEqual([]);
    expect(plan.ohnePlatz.map((e) => e.ort.index)).toEqual([1, 2]);
  });
});

describe('platzStaende', () => {
  it('nur dieser Dienst, nur Plätze mit numerischer ID; frei nach dem Namen', () => {
    const roh: RohPlatz[] = [
      ...plaetze(['person', 'frei']),
      { id: 'x', serviceId: DIENST, index: 3, name: null },
      { id: 77, serviceId: 5, index: 1, name: null },
    ];
    expect(platzStaende(roh, DIENST)).toEqual([
      { id: 1, index: 1, frei: false },
      { id: 2, index: 2, frei: true },
    ]);
  });
});

describe('entwuerfeMitnehmen – der ganze Ablauf gegen Speicher und ChurchTools-Nachbau', () => {
  const wert = (id: number, e: Entwurf): Wert => ({
    id,
    dataCategoryId: KAT,
    value: JSON.stringify({ art: 'dienstplaner-entwurf', fassung: 1, ...e }),
  });

  /** Plätze ändern (wie die App) und die Entwürfe mitnehmen. */
  async function aendern(
    arten: Art[],
    neu: number,
    werte: Wert[],
    haken?: (s: ReturnType<typeof speicher>['s']) => void,
  ) {
    const c = nachbau(plaetze(arten));
    const sp = speicher(werte);
    haken?.(sp.s);
    const r = await anzahlAendern(c.port, EVENT, DIENST, arten.length, neu);
    if (!r.ok || !r.plaetze) throw new Error('Änderung hat nicht geklappt');
    const m = await entwuerfeMitnehmen(sp.port, MODUL, KAT, {
      eventId: EVENT,
      serviceId: DIENST,
      ...r.plaetze,
    });
    return { m, s: sp.s };
  }

  const orte = (werte: Wert[]) =>
    [...inhaltAusWerten(werte).je.values()].map((x) => [
      x.wert.id,
      x.entwurf.ort.index,
      x.entwurf.version,
    ]);

  it('trägt um: gleicher Wert, neuer Ort, Version + 1', async () => {
    const { m, s } = await aendern(['person', 'frei', 'person'], 2, [wert(100, entwurfAn(3))]);
    expect(m).toEqual({
      umgetragen: [ortSchluessel({ eventId: EVENT, serviceId: DIENST, index: 2 })],
      offen: 0,
      unklar: false,
    });
    expect(orte(s.werte)).toEqual([[100, 2, 2]]);
  });

  it('ohne Entwürfe an diesem Dienst wird nichts geschrieben', async () => {
    const { m, s } = await aendern(['person', 'frei', 'person'], 2, [
      wert(100, entwurfAn(3, { ort: { eventId: 8, serviceId: DIENST, index: 3 } })),
    ]);
    expect(m).toEqual({ umgetragen: [], offen: 0, unklar: false });
    expect(s.schreibvorgaenge).toEqual([]);
  });

  it('Entwurf ohne Ziel: bleibt liegen und zählt als „offen“', async () => {
    const { m, s } = await aendern(['person', 'frei'], 1, [wert(100, entwurfAn(2))]);
    expect(m).toEqual({ umgetragen: [], offen: 1, unklar: false });
    expect(orte(s.werte)).toEqual([[100, 2, 1]]);
  });

  it('ein Umzug scheitert vorübergehend → aufgehört, nichts gelöscht, Rest zählt als „offen“', async () => {
    const { m, s } = await aendern(
      ['person', 'frei', 'frei', 'person', 'person'],
      3,
      [wert(100, entwurfAn(4)), wert(101, entwurfAn(5))],
      (x) => {
        x.schreibenWirft = new Fehler(503);
      },
    );
    expect(m).toEqual({ umgetragen: [], offen: 2, unklar: false });
    expect(s.schreibvorgaenge).toHaveLength(1);
    expect(orte(s.werte)).toEqual([
      [100, 4, 1],
      [101, 5, 1],
    ]);
  });

  it('Schublade nicht lesbar → „unklar“, nichts geschrieben', async () => {
    const { m, s } = await aendern(
      ['person', 'frei', 'person'],
      2,
      [wert(100, entwurfAn(3))],
      (x) => {
        x.lesenWirft = new Fehler(503);
      },
    );
    expect(m).toEqual({ umgetragen: [], offen: 0, unklar: true });
    expect(s.schreibvorgaenge).toEqual([]);
  });
});
