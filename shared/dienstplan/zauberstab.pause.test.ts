import { describe, expect, it } from 'vitest';
import { liste } from './personenliste.testutil';
import { antwortenFuerPlatz, type PersonenAntworten } from './personenAntworten';
import { pauseSetzen, leereListe, type Personenliste } from './personenliste';
import { antwortBereinigt } from './verfuegbarkeit';
import type { RohKandidat } from './werKann';
import { bewerte, vorschlagen, type ZauberPlatz } from './zauberstab';

/**
 * PL-3: Pause wirkt im Zauberstab. Die Liste kommt über `personenlisteAus` (Test-Hilfe `liste`) und die Pause über
 * `pauseSetzen` – die Erzeuger, nicht handgeschriebene Endstrukturen.
 */
const roh = (id: number, vorname: string, score = 0): RohKandidat => ({
  person: { title: vorname, domainIdentifier: String(id) },
  score,
});
const ANNA = 1;
const BEN = 2;
const TAG = '2026-12-06';
const MUSIK = 4;
const TERMIN = 20;
const TON = 6;

/** Liste mit Pause für eine Person (`bis` fehlt = unbefristet) – gebaut mit `pauseSetzen`, gelesen mit `personenlisteAus`. */
const mitPause = (personId: number, bis?: string): Personenliste =>
  liste(pauseSetzen(leereListe(), personId, bis ? { bis } : {}));

const platz = (personenliste?: Personenliste | null, mitAntworten = false): ZauberPlatz => {
  const daten: PersonenAntworten = {
    jePerson: new Map([[ANNA, { [TERMIN]: antwortBereinigt({ a: 'ja', tag: TAG }) }]]),
    sichtbar: new Set([MUSIK]),
  };
  return {
    schluessel: 'a',
    terminId: TERMIN,
    serviceId: TON,
    tag: TAG,
    schonDa: [],
    // Anna hat die besseren Punkte – ohne Pause wäre sie die Wahl.
    roh: [roh(ANNA, 'Anna', 0), roh(BEN, 'Ben', -20)],
    ...(mitAntworten
      ? {
          antworten:
            antwortenFuerPlatz(daten, {
              gruppeId: MUSIK,
              terminId: TERMIN,
              dienstId: TON,
              dienstName: () => undefined,
            }) ?? undefined,
        }
      : {}),
    ...(personenliste !== undefined ? { personenliste } : {}),
  };
};

describe('Zauberstab: Pause (PL-3)', () => {
  it('ohne Liste und ohne Pause bleibt alles wie vorher: Anna wird vorgeschlagen', () => {
    expect(vorschlagen([platz()]).get('a')).toBe(ANNA);
    expect(vorschlagen([platz(null)]).get('a')).toBe(ANNA);
    expect(vorschlagen([platz(liste())]).get('a')).toBe(ANNA);
    expect(bewerte(platz(), []).every((b) => b.pause === null)).toBe(true);
  });

  it('eine unbefristete Pause: die Person wird übersprungen, die nächste genommen', () => {
    const p = platz(mitPause(ANNA));
    expect(vorschlagen([p]).get('a')).toBe(BEN);
    const anna = bewerte(p, []).find((b) => b.personId === ANNA)!;
    expect(anna.passt).toBe(false);
    expect(anna.pause).toEqual({});
  });

  it('sind alle pausiert, schlägt er niemanden vor (nicht „irgendwen“)', () => {
    const l = liste(pauseSetzen(pauseSetzen(leereListe(), ANNA, {}), BEN, {}));
    expect(vorschlagen([platz(l)]).get('a')).toBeNull();
  });

  it('„bis“ gilt einschließlich: am letzten Tag pausiert, einen Tag danach nicht mehr', () => {
    expect(vorschlagen([platz(mitPause(ANNA, TAG))]).get('a')).toBe(BEN);
    expect(vorschlagen([platz(mitPause(ANNA, '2026-12-05'))]).get('a')).toBe(ANNA);
  });

  it('eine Pause, die vor dem Termin endet, wirkt nicht', () => {
    const p = platz(mitPause(ANNA, '2026-11-30'));
    expect(vorschlagen([p]).get('a')).toBe(ANNA);
    expect(bewerte(p, []).find((b) => b.personId === ANNA)!.pause).toBeNull();
  });

  it('die Pause einer ANDEREN Person wirkt nicht auf Anna – und eine Pause gilt nur für die Liste des Platzes (andere Gruppe = andere Liste, hier keine)', () => {
    expect(vorschlagen([platz(mitPause(BEN))]).get('a')).toBe(ANNA);
    // Anna pausiert in der Liste einer anderen Dienstgruppe; dieser Platz bekommt die Liste SEINER Gruppe (hier keine).
    expect(vorschlagen([platz(null)]).get('a')).toBe(ANNA);
  });

  it('mit sichtbaren Antworten: auch eine Ja-Person in Pause kommt nicht vor – sie steht unter „Kann nicht“', () => {
    const p = platz(mitPause(ANNA), true);
    expect(vorschlagen([p]).get('a')).toBe(BEN);
    const anna = bewerte(p, []).find((b) => b.personId === ANNA)!;
    expect(anna.stufe).toBe('kannNicht');
    expect(anna.passt).toBe(false);
  });

  it('die Pause gilt je Termin des Laufs: Anna pausiert nur bis zum ersten Termin, am zweiten ist sie dran', () => {
    const l = mitPause(ANNA, '2026-12-06');
    const p1 = { ...platz(l), schluessel: 'a', tag: '2026-12-06' };
    const p2 = { ...platz(l), schluessel: 'b', tag: '2026-12-13' };
    const v = vorschlagen([p1, p2]);
    expect(v.get('a')).toBe(BEN);
    expect(v.get('b')).toBe(ANNA);
  });
});
