import { describe, expect, it } from 'vitest';
import { diensteAus } from '../ct/dienste';
import { gruppeHatDienste, offeneTermine, terminZaehlt, termineFuerAbfrage } from './erinnern';
import { planAus, type Plan, type PlanGruppe } from './plan';
import type { RohTermin } from './termine';

/**
 * R-1: „offen“ als eine Regel (`offeneTermine`) und die Termine einer Abfrage (`termineFuerAbfrage`). Die Rechnung in
 * `fehlendeInGruppe` ist durch `erinnern.test.ts` bewacht (unverändert grün); hier die Regel allein – so, wie die Startseite
 * sie aus eigenen Daten füttert.
 *
 * Musik (4): Gitarre. Technik (3): Ton. Termine: 1 = 06.12. (Musik + Technik) · 2 = 13.12. (Musik, abgesagt) ·
 * 3 = 20.12. (Musik) · 4 = 23.12. (nur Technik) · 5 = 05.12. (Musik).
 */
const DIENSTE = diensteAus([
  { id: 6, name: 'Ton', serviceGroupId: 3, groupIds: [7], sortKey: 1 },
  { id: 10, name: 'Gitarre', serviceGroupId: 4, groupIds: [100], sortKey: 2 },
]);
const GRUPPEN = [
  { id: 3, name: 'Technik', fuerAlle: false },
  { id: 4, name: 'Musik', fuerAlle: false },
];
const platz = (serviceId: number) => ({
  serviceId,
  personId: null,
  name: null,
  isAccepted: false,
  index: null,
});
const termin = (id: number, start: string, dienste: number[], extra: Partial<RohTermin> = {}) =>
  ({
    id,
    name: 'Gottesdienst',
    startDate: start,
    endDate: start.replace('T08:00', 'T10:00'),
    eventServices: dienste.map(platz),
    ...extra,
  }) as RohTermin;
const PLAN: Plan = planAus(
  [
    termin(1, '2026-12-06T08:00:00Z', [10, 6]),
    termin(2, '2026-12-13T08:00:00Z', [10], { isCanceled: true }),
    termin(3, '2026-12-20T08:00:00Z', [10]),
    termin(4, '2026-12-23T08:00:00Z', [6]),
    termin(5, '2026-12-05T08:00:00Z', [10]),
  ],
  {
    ichId: 1,
    dienste: DIENSTE,
    dienstgruppen: GRUPPEN,
    zeitzone: 'Europe/Berlin',
    planbar: () => true,
    ganzSichtbar: () => true,
  },
);
const gruppe = (id: number): PlanGruppe => PLAN.gruppen.find((g) => g.gruppe?.id === id)!;

describe('terminZaehlt', () => {
  it.each([
    ['2026-12-01', '2026-12-01', undefined, true], // heute zählt
    ['2026-12-02', '2026-12-01', undefined, true],
    ['2026-11-30', '2026-12-01', undefined, false], // vorbei
    ['2026-12-02', '2026-12-01', true, false], // abgesagt
  ])('Termin %s, heute %s, abgesagt %s → %s', (tag, heute, abgesagt, soll) => {
    expect(terminZaehlt({ tag, abgesagt }, heute)).toBe(soll);
  });
});

describe('offeneTermine', () => {
  const t = (id: number, tag: string, abgesagt = false) => ({ id, tag, abgesagt });
  const TERMINE = [t(1, '2026-12-06'), t(2, '2026-12-13'), t(3, '2026-12-20')];
  const nie = () => false;
  const ids = (r: { id: number }[]) => r.map((x) => x.id);
  const rechne = (
    teil: Partial<Parameters<typeof offeneTermine<(typeof TERMINE)[number]>>[0]> = {},
  ) =>
    offeneTermine({
      termine: TERMINE,
      heute: '2026-12-01',
      beantwortet: nie,
      eingeteilt: nie,
      pausiert: nie,
      ...teil,
    });

  it('ohne irgendeine Antwort ist alles offen – in der Reihenfolge der Termine', () => {
    expect(ids(rechne().offen)).toEqual([1, 2, 3]);
    expect(rechne().pausiert).toEqual([]);
  });

  it('Antwort (Ja/Vielleicht/Abwesenheit) → der Termin ist nicht offen', () => {
    expect(ids(rechne({ beantwortet: (x) => x.id === 2 }).offen)).toEqual([1, 3]);
  });

  it('eingeteilt → nicht offen', () => {
    expect(ids(rechne({ eingeteilt: (x) => x.id === 1 }).offen)).toEqual([2, 3]);
  });

  it('Pause → nicht offen, aber als „nur wegen Pause“ gemeldet', () => {
    const r = rechne({ pausiert: (x) => x.tag <= '2026-12-13' });
    expect(ids(r.offen)).toEqual([3]);
    expect(ids(r.pausiert)).toEqual([1, 2]);
  });

  it('Pause bei einem beantworteten Termin zählt nicht als „ausgelassen“', () => {
    const r = rechne({ beantwortet: () => true, pausiert: () => true });
    expect(r).toEqual({ offen: [], pausiert: [] });
  });

  it('vergangener Termin (tag < heute) zählt nicht, der von heute schon', () => {
    expect(ids(rechne({ heute: '2026-12-13' }).offen)).toEqual([2, 3]);
    expect(ids(rechne({ heute: '2026-12-14' }).offen)).toEqual([3]);
  });

  it('abgesagter Termin zählt nicht', () => {
    const r = offeneTermine({
      termine: [t(1, '2026-12-06'), t(2, '2026-12-13', true)],
      heute: '2026-12-01',
      beantwortet: nie,
      eingeteilt: nie,
      pausiert: nie,
    });
    expect(ids(r.offen)).toEqual([1]);
  });

  it('Termin ohne Dienste der Gruppe (`vorgesehen`) zählt nicht', () => {
    expect(ids(rechne({ vorgesehen: (x) => x.id !== 1 }).offen)).toEqual([2, 3]);
  });

  it('die Fragen kommen je Termin: wer an einem Termin antwortet, antwortet nicht für die anderen', () => {
    const geantwortet = new Set([1, 3]);
    expect(ids(rechne({ beantwortet: (x) => geantwortet.has(x.id) }).offen)).toEqual([2]);
  });
});

describe('termineFuerAbfrage', () => {
  const MUSIK = gruppe(4);
  const TECHNIK = gruppe(3);

  it('Musik im Zeitraum: Termine mit Plätzen, nicht abgesagt, Reihenfolge des Plans', () => {
    // Reihenfolge des Plans (nach Tag): 5 (05.12.), 1 (06.12.), 3 (20.12.)
    expect(termineFuerAbfrage(PLAN, MUSIK, '2026-12-01', '2026-12-31', '2026-12-01')).toEqual([
      5, 1, 3,
    ]);
  });

  it('Zeitraum: von und bis einschließlich', () => {
    expect(termineFuerAbfrage(PLAN, MUSIK, '2026-12-06', '2026-12-06', '2026-12-01')).toEqual([1]);
    expect(termineFuerAbfrage(PLAN, MUSIK, '2026-12-07', '2026-12-19', '2026-12-01')).toEqual([]);
    expect(termineFuerAbfrage(PLAN, MUSIK, '2026-12-06', '2026-12-20', '2026-12-01')).toEqual([
      1, 3,
    ]);
  });

  it('abgesagter Termin (13.12.) ist nie dabei', () => {
    expect(termineFuerAbfrage(PLAN, MUSIK, '2026-12-13', '2026-12-13', '2026-12-01')).toEqual([]);
  });

  it('vergangene Termine sind nicht dabei', () => {
    expect(termineFuerAbfrage(PLAN, MUSIK, '2026-12-01', '2026-12-31', '2026-12-10')).toEqual([3]);
  });

  it('nur Termine, an denen die Gruppe Dienste hat: Technik hat 1 und 4, nicht 3', () => {
    expect(termineFuerAbfrage(PLAN, TECHNIK, '2026-12-01', '2026-12-31', '2026-12-01')).toEqual([
      1, 4,
    ]);
  });

  it('dieselbe Auswahl wie „Erinnern“: `gruppeHatDienste` je Spalte', () => {
    const musikSpalten = PLAN.spalten.flatMap((s, i) => (gruppeHatDienste(MUSIK, i) ? [s.id] : []));
    expect(musikSpalten.sort()).toEqual([1, 2, 3, 5]); // der abgesagte (2) fällt erst durch `terminZaehlt` heraus
  });

  it('gruppeHatDienste: nur mit Plätzen – eine Zelle ohne Plätze („aus“) oder ohne Zelle zählt nicht', () => {
    const zeile = MUSIK.zeilen[0];
    const mitZellen = (zellen: (typeof zeile.zellen)[number][]): PlanGruppe => ({
      ...MUSIK,
      zeilen: [{ ...zeile, zellen }],
    });
    const einPlatz = zeile.zellen.find((z) => z !== null)!;
    expect(gruppeHatDienste(mitZellen([einPlatz]), 0)).toBe(true);
    expect(gruppeHatDienste(mitZellen([[]]), 0)).toBe(false);
    expect(gruppeHatDienste(mitZellen([null]), 0)).toBe(false);
    expect(gruppeHatDienste({ ...MUSIK, zeilen: [] }, 0)).toBe(false);
  });

  it('leerer Zeitraum ohne Termine → leer', () => {
    expect(termineFuerAbfrage(PLAN, MUSIK, '2027-01-01', '2027-01-31', '2026-12-01')).toEqual([]);
  });
});
