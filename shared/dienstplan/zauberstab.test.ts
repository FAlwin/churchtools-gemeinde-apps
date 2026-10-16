import { describe, expect, it } from 'vitest';
import { FRUEHER_ABGESAGT, type RohKandidat } from './werKann';
import {
  abstandsAbzug,
  bewerte,
  GRENZE,
  monatsAbzug,
  vorschlagen,
  type ZauberPlatz,
} from './zauberstab';

/** Ein Kandidat in der Form, die E4-0/E5-0 gemessen haben. */
function roh(id: number, vorname: string, o: Partial<RohKandidat> = {}): RohKandidat {
  return {
    person: {
      title: `${vorname} Test`,
      domainIdentifier: String(id),
      domainAttributes: { firstName: vorname, lastName: 'Test' },
    },
    score: 0,
    scoreHints: [],
    monthlyUtilization: {},
    absences: [],
    servicesOnSameDay: [],
    serviceGroupPreferences: null,
    ...o,
  };
}

const platz = (
  schluessel: string,
  tag: string,
  kandidaten: RohKandidat[],
  o: Partial<ZauberPlatz> = {},
): ZauberPlatz => ({
  schluessel,
  terminId: Number(tag.replaceAll('-', '')),
  serviceId: 6,
  tag,
  schonDa: [],
  roh: kandidaten,
  ...o,
});

const ANNA = 1;
const BEN = 2;
const CLARA = 3;

describe('Zauberstab – die Regel von ChurchTools', () => {
  it('nimmt die höchste Punktzahl', () => {
    const v = vorschlagen([
      platz('a', '2026-10-25', [roh(ANNA, 'Anna', { score: -9 }), roh(BEN, 'Ben', { score: -3 })]),
    ]);
    expect(v.get('a')).toBe(BEN);
  });

  it('nur über −100: genau −100 ist schon zu wenig (ChurchTools: `-100 < e`) → frei', () => {
    expect(GRENZE).toBe(-100);
    const v = vorschlagen([
      platz('a', '2026-10-25', [
        roh(ANNA, 'Anna', { score: -100 }),
        roh(BEN, 'Ben', { score: -1000 }),
      ]),
      platz('b', '2026-11-01', [roh(ANNA, 'Anna', { score: -99 })]),
    ]);
    expect(v.get('a')).toBeNull();
    expect(v.get('b')).toBe(ANNA);
  });

  it('wer am Dienst schon eingeteilt ist, steht nicht zur Wahl', () => {
    const v = vorschlagen([
      platz('a', '2026-10-25', [roh(ANNA, 'Anna'), roh(BEN, 'Ben', { score: -5 })], {
        schonDa: [ANNA],
      }),
    ]);
    expect(v.get('a')).toBe(BEN);
  });

  it('„hat zuvor abgesagt“ zählt hier mit – wie im ChurchTools-Zauberstab (Alwin, 16.10.)', () => {
    const platzA = platz('a', '2026-10-25', [
      roh(ANNA, 'Anna', { score: -500, scoreHints: [{ score: -500, reason: FRUEHER_ABGESAGT }] }),
      roh(BEN, 'Ben', { score: -5 }),
    ]);
    expect(vorschlagen([platzA]).get('a')).toBe(BEN);
    const [, anna] = bewerte(platzA, []);
    expect(anna).toMatchObject({ punkte: 0, frueherAbgesagt: -500, wert: -500, passt: false });
  });
});

describe('Zauberstab – eigene Vorschläge zählen mit (Alwin, 16.10.), mit den Abzügen von ChurchTools', () => {
  it('die gemessenen Abzüge: Monat −3/−2/−1, Abstand −50 unter 7 Tagen, −10 bis 13 Tage', () => {
    expect([0, 1, 2, 3].map(monatsAbzug)).toEqual([-3, -2, -1, 0]);
    expect([1, 6, 7, 13, 14, 30].map(abstandsAbzug)).toEqual([-50, -50, -10, -10, 0, 0]);
  });

  it('selber Tag: kein zweiter Platz – 9- und 11-Uhr-Gottesdienst', () => {
    const k = [roh(ANNA, 'Anna'), roh(BEN, 'Ben', { score: -40 })];
    const v = vorschlagen([
      platz('neun', '2026-10-25', k, { terminId: 9 }),
      platz('elf', '2026-10-25', k, { terminId: 11 }),
    ]);
    expect([v.get('neun'), v.get('elf')]).toEqual([ANNA, BEN]);
    const [anna] = bewerte(platz('x', '2026-10-25', [roh(ANNA, 'Anna')]), [
      { personId: ANNA, tag: '2026-10-25' },
    ]);
    // −250 für den Tag, dazu −3 für den Monat – wie bei einer echten Einteilung.
    expect(anna).toMatchObject({ wert: -253, laufGrund: 'am-tag', passt: false });
  });

  it('selber Tag, den ChurchTools schon abgezogen hat, wird nicht doppelt abgezogen', () => {
    const [anna] = bewerte(
      platz('x', '2026-10-25', [
        roh(ANNA, 'Anna', {
          score: -250,
          scoreHints: [{ score: -250, reason: 'service.same-day' }],
        }),
      ]),
      [{ personId: ANNA, tag: '2026-10-25' }],
    );
    expect(anna.wert).toBe(-250 - 3); // nur der Monat kommt dazu
  });

  it('im selben Monat −3 je Vorschlag: am zweiten Sonntag kommt die nächste', () => {
    const k = [roh(ANNA, 'Anna'), roh(BEN, 'Ben', { score: -2 })];
    const v = vorschlagen([platz('a', '2026-11-01', k), platz('b', '2026-11-15', k)]);
    expect([v.get('a'), v.get('b')]).toEqual([ANNA, BEN]);
    const [, anna] = bewerte(platz('x', '2026-11-29', k), [{ personId: ANNA, tag: '2026-11-01' }]);
    expect(anna.wert).toBe(-3);
  });

  it('Monate daneben: −2, zwei daneben −1, weiter weg nichts (davor wie danach)', () => {
    const w = (tag: string) =>
      bewerte(platz('x', '2026-11-15', [roh(ANNA, 'Anna')]), [{ personId: ANNA, tag }])[0].wert;
    expect(w('2026-10-15')).toBe(-2);
    expect(w('2026-12-15')).toBe(-2);
    expect(w('2026-09-15')).toBe(-1);
    expect(w('2027-01-15')).toBe(-1);
    expect(w('2026-08-15')).toBe(0);
  });

  it('Abstand: ein naher Vorschlag ersetzt den ferneren echten Dienst – es zählt der nähere, nicht beide', () => {
    // Echter letzter Dienst 10 Tage davor (−10 in der Punktzahl); ein Vorschlag 4 Tage davor (−50) ersetzt ihn.
    const anna = roh(ANNA, 'Anna', {
      score: -10,
      scoreHints: [{ score: -10, reason: 'last.service.near' }],
    });
    const w = (tag: string) =>
      bewerte(platz('x', '2026-11-02', [anna]), [{ personId: ANNA, tag }])[0].wert;
    expect(w('2026-10-29')).toBe(-50 - 2); // −50 statt −10, dazu Oktober −2
    // Ist der Vorschlag weiter weg als der echte Dienst, bleibt der echte Abzug.
    expect(w('2026-10-12')).toBe(-10 - 2);
  });

  it('Abstand nach vorn: ein späterer, von Hand gewählter Name zählt für den früheren Platz', () => {
    const [anna] = bewerte(platz('x', '2026-11-01', [roh(ANNA, 'Anna')]), [
      { personId: ANNA, tag: '2026-11-04' },
    ]);
    expect(anna.wert).toBe(-50 - 3);
  });

  it('„höchstens N× im Monat“ erreicht: ausgeschlossen (−100), mit Grund', () => {
    const k = (hoechstens: number | null, imMonat: number, gruende: string[] = []) =>
      roh(ANNA, 'Anna', {
        serviceGroupPreferences: hoechstens === null ? null : { maxPerMonth: hoechstens },
        monthlyUtilization: { '2026-11': imMonat },
        scoreHints: gruende.map((reason) => ({ score: 0, reason })),
      });
    const eingeplant = [{ personId: ANNA, tag: '2026-11-01' }];
    const b = (r: RohKandidat) => bewerte(platz('x', '2026-11-29', [r]), eingeplant)[0];
    // 1 echter Dienst + 1 Vorschlag = 2 → bei „höchstens 2×“ ist Schluss.
    expect(b(k(2, 1))).toMatchObject({ wert: -3 - 100, laufGrund: 'hoechstens', passt: false });
    expect(b(k(3, 1))).toMatchObject({ wert: -3, laufGrund: null, passt: true });
    expect(b(k(null, 1)).wert).toBe(-3);
    // Hat ChurchTools es schon abgezogen, nicht doppelt.
    expect(b(k(2, 2, ['preference.max-reached'])).wert).toBe(-3);
  });

  it('Gleichstand: zuerst, wer im Lauf seltener dran ist, dann nach Namen', () => {
    const k = [roh(ANNA, 'Anna'), roh(BEN, 'Ben'), roh(CLARA, 'Clara')];
    // Anna war vor drei Monaten im Lauf dran – kostet keine Punkte mehr, zählt aber für den Gleichstand.
    const reihe = bewerte(platz('x', '2026-11-29', k), [{ personId: ANNA, tag: '2026-08-02' }]);
    expect(reihe.map((r) => [r.name, r.wert, r.imLauf])).toEqual([
      ['Ben Test', 0, 0],
      ['Clara Test', 0, 0],
      ['Anna Test', 0, 1],
    ]);
  });

  it('von Hand gewählt (`fest`) bleibt und zählt mit; `null` = bewusst frei', () => {
    const k = [
      roh(ANNA, 'Anna'),
      roh(BEN, 'Ben', { score: -40 }),
      roh(CLARA, 'Clara', { score: -60 }),
    ];
    const v = vorschlagen(
      [
        platz('neun', '2026-10-25', k, { terminId: 9 }),
        platz('elf', '2026-10-25', k, { terminId: 11 }),
        platz('abend', '2026-10-25', k, { terminId: 18 }),
      ],
      {
        fest: new Map([
          ['elf', ANNA],
          ['abend', null],
        ]),
      },
    );
    expect([v.get('neun'), v.get('elf'), v.get('abend')]).toEqual([BEN, ANNA, null]);
  });

  it('vorhandene Entwürfe (`eingeplant`) zählen wie Vorschläge', () => {
    const k = [roh(ANNA, 'Anna'), roh(BEN, 'Ben', { score: -40 })];
    const v = vorschlagen([platz('a', '2026-10-25', k)], {
      eingeplant: [{ personId: ANNA, tag: '2026-10-25' }],
    });
    expect(v.get('a')).toBe(BEN);
  });
});
