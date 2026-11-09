import { describe, expect, it } from 'vitest';
import { anmeldungenAus } from '@shared/anmeldung/liste';
import { personSchluessel } from '@shared/anmeldung/tabelle';
import { STICHTAG, absage, dazu, e, mitglieder, stand } from '@shared/anmeldung/liste.testdaten';
import { listenAnsicht, type ListenWahl } from './listenAnsicht';

/**
 * `listenAnsicht` (#845, 4c-2) – die Regeln, die man in der Tabelle nicht oder nur mühsam sieht. Was man sieht (Suche,
 * Reiter, Anheften, Zahlen), prüft `AnmeldungenReiter.test.tsx`. Die Daten kommen aus den Erzeugern der Liste.
 */
const wahl = (w: Partial<ListenWahl> = {}): ListenWahl => ({
  filter: 'alle',
  suche: '',
  sortierung: null,
  jePerson: false,
  oben: new Set(),
  ...w,
});

/**
 * A: Jonas mit Platz, Lena wartet auf Platz 2 (Zahlung offen). B: meldet sich später an, beide warten – auf Platz 1
 * und 3 (alle warten – nichts offen). Dazu zwei Absagen, die ältere zuerst im Verlauf.
 */
function lage() {
  const a = mitglieder('AAAAAA', [true, false], 10).map((m) =>
    m.groupMemberStatus === 'waiting' ? { ...m, waitinglistPosition: 2 } : m,
  );
  const b = mitglieder('BBBBBB', [false, false], 20).map((m, i) => ({
    ...m,
    waitinglistPosition: i === 0 ? 1 : 3,
  }));
  const [alt] = mitglieder('CCCCCC', [true], 30);
  const [neu] = mitglieder('DDDDDD', [true], 40);
  const st = stand(
    [...a, ...b],
    [
      dazu(10, '2026-10-17'),
      dazu(20, '2026-10-18'),
      absage(alt, '2026-10-01', 30),
      absage(neu, '2026-10-15', 40),
    ],
  );
  const liste = anmeldungenAus(e(), st, STICHTAG);
  return { liste, absagen: st.absagen };
}

describe('listenAnsicht', () => {
  it('die Wartenden nach Warteplatz – nicht nach Anmeldetag', () => {
    const { liste, absagen } = lage();
    const { wartende } = listenAnsicht(e(), liste, absagen, wahl());
    expect(wartende.map((w) => [w.p.personId, w.p.warteplatz])).toEqual([
      [20, 1],
      [11, 2],
      [21, 3],
    ]);
  });

  it('Absagen: die neueste zuerst', () => {
    const { liste, absagen } = lage();
    const r = listenAnsicht(e(), liste, absagen, wahl({ filter: 'abgesagt' }));
    expect(r.absagen.map((b) => b.personId)).toEqual([40, 30]);
    expect(r.absageZeilen.map((b) => b.personId)).toEqual([40, 30]);
  });

  it('Warteliste ohne eigene Sortierung: nach Warteplatz – je Anmeldung und je Person', () => {
    const { liste, absagen } = lage();
    const r = listenAnsicht(e(), liste, absagen, wahl({ filter: 'warte' }));
    expect(r.zeilen.map((x) => x.nr)).toEqual(['BBBBBB', 'AAAAAA']);
    const p = listenAnsicht(e(), liste, absagen, wahl({ filter: 'warte', jePerson: true }));
    expect(p.personenGezeigt.map((y) => y.p.personId)).toEqual([20, 11, 21]);
    // Unter „Alle“ bleibt der Anmeldetag.
    expect(listenAnsicht(e(), liste, absagen, wahl()).zeilen.map((x) => x.nr)).toEqual([
      'AAAAAA',
      'BBBBBB',
    ]);
  });

  it('je Person, Zahlung offen: alle Personen der Anmeldungen mit offener Zahlung – und nur die', () => {
    const { liste, absagen } = lage();
    const r = listenAnsicht(e(), liste, absagen, wahl({ filter: 'offen', jePerson: true }));
    expect(r.personenGezeigt.map((y) => y.p.personId)).toEqual([10, 11]);
    expect(r.zahlen).toEqual({ alle: 4, offen: 2, warte: 3 });
    // Je Anmeldung zählen die Reiter Anmeldungen.
    expect(listenAnsicht(e(), liste, absagen, wahl()).zahlen).toEqual({
      alle: 2,
      offen: 1,
      warte: 2,
    });
  });

  it('nur gerechnet, was gezeigt wird: im Reiter „Abgesagt“ keine Zeilen, ohne „je Person“ keine Personen', () => {
    const { liste, absagen } = lage();
    const ab = listenAnsicht(e(), liste, absagen, wahl({ filter: 'abgesagt', jePerson: true }));
    expect(ab.zeilen).toEqual([]);
    expect(ab.personenGezeigt).toEqual([]);
    expect(listenAnsicht(e(), liste, absagen, wahl()).personenGezeigt).toEqual([]);
  });

  it('Angeheftetes zuerst – je Anmeldung und je Person', () => {
    const { liste, absagen } = lage();
    const b = liste.find((x) => x.nr === 'BBBBBB')!;
    expect(
      listenAnsicht(e(), liste, absagen, wahl({ oben: new Set([b.schluessel]) })).zeilen[0].nr,
    ).toBe('BBBBBB');
    const p = listenAnsicht(e(), liste, absagen, wahl({ jePerson: true }));
    const letzte = p.personenGezeigt.at(-1)!;
    const angeheftet = listenAnsicht(
      e(),
      liste,
      absagen,
      wahl({ jePerson: true, oben: new Set([personSchluessel(letzte)]) }),
    );
    expect(angeheftet.personenGezeigt[0]).toEqual(letzte);
  });
});
