import { describe, expect, it } from 'vitest';
import { antwortenFuerPlatz, type PersonenAntworten } from './personenAntworten';
import { antwortBereinigt } from './verfuegbarkeit';
import type { RohKandidat } from './werKann';
import { bewerte, vorschlagen, type ZauberPlatz } from './zauberstab';

/**
 * E5c-4: Der Zauberstab bevorzugt Ja (Alwin 19.11.2026). Antworten kommen aus `antwortBereinigt` und gehen durch
 * `antwortenFuerPlatz` – dieselbe Einordnung wie in „Wer kann?“.
 */
const roh = (id: number, vorname: string, o: Partial<RohKandidat> = {}): RohKandidat => ({
  person: { title: vorname, domainIdentifier: String(id) },
  score: 0,
  ...o,
});
const TON = 6;
const GESANG = 9;
const MUSIK = 4;
const TERMIN = 20;
const ANNA = 1;
const BEN = 2;
const CLARA = 3;

function antworten(je: Record<number, { a: 'ja' | 'vielleicht'; dienste?: number[] }>) {
  const daten: PersonenAntworten = {
    jePerson: new Map(
      Object.entries(je).map(([id, x]) => [
        Number(id),
        { [TERMIN]: antwortBereinigt({ ...x, tag: '2026-12-06' }) },
      ]),
    ),
    sichtbar: new Set([MUSIK]),
  };
  return antwortenFuerPlatz(daten, {
    gruppeId: MUSIK,
    terminId: TERMIN,
    dienstId: TON,
    dienstName: (id) => (id === GESANG ? 'Gesang' : undefined),
  });
}
const platz = (kandidaten: RohKandidat[], a?: ReturnType<typeof antworten>): ZauberPlatz => ({
  schluessel: 'a',
  terminId: TERMIN,
  serviceId: TON,
  tag: '2026-12-06',
  schonDa: [],
  roh: kandidaten,
  ...(a ? { antworten: a } : {}),
});

describe('Zauberstab mit Antworten (E5c-4)', () => {
  it('Stufen vor Punkten: Ja mit schlechteren Punkten schlägt Vielleicht und keine Antwort mit besseren', () => {
    const k = [
      roh(ANNA, 'Anna', { score: 0 }), // keine Antwort
      roh(BEN, 'Ben', { score: -5 }), // Vielleicht
      roh(CLARA, 'Clara', { score: -40 }), // Ja
    ];
    const a = antworten({ [BEN]: { a: 'vielleicht' }, [CLARA]: { a: 'ja' } });
    expect(bewerte(platz(k, a), []).map((b) => b.name)).toEqual(['Clara', 'Ben', 'Anna']);
    expect(vorschlagen([platz(k, a)]).get('a')).toBe(CLARA);
  });

  it('innerhalb der Stufe wie bisher: Punkte, dann imLauf, dann Name', () => {
    const k = [
      roh(BEN, 'Ben', { score: -3 }),
      roh(ANNA, 'Anna', { score: -3 }),
      roh(CLARA, 'Clara', { score: -1 }),
    ];
    const a = antworten({ [ANNA]: { a: 'ja' }, [BEN]: { a: 'ja' }, [CLARA]: { a: 'ja' } });
    expect(bewerte(platz(k, a), []).map((b) => b.name)).toEqual(['Clara', 'Anna', 'Ben']);
    // imLauf: Ben ist schon einmal (anderer Monat, ohne Abzug) im Lauf eingeplant → Anna vor Ben bleibt, Ben nicht davor.
    const lauf = bewerte(platz(k, a), [{ personId: ANNA, tag: '2027-06-01' }]);
    expect(lauf.map((b) => b.name)).toEqual(['Clara', 'Ben', 'Anna']);
  });

  it('die Grenze −100 bleibt: eine Ja-Person darunter wird nicht genommen', () => {
    const k = [roh(ANNA, 'Anna', { score: 0 }), roh(BEN, 'Ben', { score: -150 })];
    const a = antworten({ [BEN]: { a: 'ja' } });
    const b = bewerte(platz(k, a), []);
    expect(b.find((x) => x.personId === BEN)?.passt).toBe(false);
    expect(vorschlagen([platz(k, a)]).get('a')).toBe(ANNA); // ohne Antwort, aber über der Grenze
    expect(vorschlagen([platz([roh(BEN, 'Ben', { score: -150 })], a)]).get('a')).toBeNull();
  });

  it('„nur andere Dienste“: wird für diesen Dienst nicht genommen, mit Grund', () => {
    const k = [roh(ANNA, 'Anna', { score: 0 }), roh(BEN, 'Ben', { score: 50 })];
    const a = antworten({ [BEN]: { a: 'ja', dienste: [GESANG] } });
    const ben = bewerte(platz(k, a), []).find((x) => x.personId === BEN);
    expect(ben?.passt).toBe(false);
    expect(ben?.laufGrund).toBe('andere-dienste');
    expect(vorschlagen([platz(k, a)]).get('a')).toBe(ANNA);
    // Für den Dienst, auf den sich das Ja bezieht, gilt es (Ton=6 hier, Beschränkung auf Ton → Stufe Ja).
    const fuerTon = antworten({ [BEN]: { a: 'ja', dienste: [TON] } });
    expect(vorschlagen([platz(k, fuerTon)]).get('a')).toBe(BEN);
  });

  it('ohne sichtbare Antworten wie bisher: nur die Punkte, keine Stufe', () => {
    const k = [roh(ANNA, 'Anna', { score: -9 }), roh(BEN, 'Ben', { score: -3 })];
    const b = bewerte(platz(k), []);
    expect(b.map((x) => x.name)).toEqual(['Ben', 'Anna']);
    expect(b.every((x) => x.stufe === null && x.antwort === null)).toBe(true);
    expect(vorschlagen([platz(k)]).get('a')).toBe(BEN);
  });
});
