import { describe, expect, it } from 'vitest';
import { FRUEHER_ABGESAGT, kandidatenAus, kandidatHinweis, type RohKandidat } from './werKann';

/** Ein Kandidat in der Form, die E4-0 gemessen hat. */
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
    ...o,
  };
}
const O = { monat: '2026-11', schonDa: new Set<number>() };

describe('kandidatenAus', () => {
  it('Reihenfolge nach Punkten, bei Gleichstand nach Namen', () => {
    const k = kandidatenAus(
      [roh(1, 'Clara', { score: -9 }), roh(2, 'Ben', { score: 0 }), roh(3, 'Anna', { score: 0 })],
      O,
    );
    expect(k.map((x) => x.name)).toEqual(['Anna Test', 'Ben Test', 'Clara Test']);
  });

  it('„Hat zuvor abgesagt“ zählt nicht (Alwin, 14.10.) – nur dieser Abzug, die übrigen bleiben', () => {
    const k = kandidatenAus(
      [
        roh(1, 'Ben', {
          score: -503,
          scoreHints: [
            { score: -3, reason: 'month.utilization.multiplier.2026-11' },
            { score: -500, reason: FRUEHER_ABGESAGT },
          ],
        }),
        roh(2, 'Anna', { score: -5 }),
      ],
      O,
    );
    expect(k.map((x) => [x.name, x.punkte])).toEqual([
      ['Ben Test', -3],
      ['Anna Test', -5],
    ]);
  });

  it('Abwesenheit: der Grund, nicht der (private) Kommentar', () => {
    const [k] = kandidatenAus(
      [
        roh(1, 'Greta', {
          absences: [
            {
              absenceReason: { nameTranslated: 'Krank', name: 'absent.reason.sick' },
              comment: 'OP',
            } as never,
          ],
        }),
      ],
      O,
    );
    expect(k.abwesend).toBe('Krank');
    expect(JSON.stringify(k)).not.toContain('OP');
  });

  it('Abwesenheit ohne lesbaren Grund heißt einfach „abwesend“', () => {
    expect(
      kandidatenAus([roh(1, 'Greta', { absences: [{ absenceReason: null }] })], O)[0].abwesend,
    ).toBe('abwesend');
  });

  it('Dienste am selben Tag ohne Doppelte; Einsätze im Monat des Termins', () => {
    const [k] = kandidatenAus(
      [
        roh(1, 'Alwin', {
          servicesOnSameDay: [
            { eventService: { serviceName: 'Ton' } },
            { eventService: { serviceName: 'Ton' } },
            { eventService: { serviceName: 'Licht' } },
          ],
          monthlyUtilization: { '2026-10': 4, '2026-11': 2 },
        }),
      ],
      O,
    );
    expect(k.amTag).toEqual(['Ton', 'Licht']);
    expect(k.imMonat).toBe(2);
  });

  it('wer an diesem Dienst schon eingeteilt ist, steht nicht da; Unbrauchbares fällt weg', () => {
    const k = kandidatenAus(
      [
        roh(1, 'Alwin'),
        roh(2, 'Anna'),
        { person: null },
        { person: { domainIdentifier: 'x', title: 'Ohne ID' } },
        { person: { domainIdentifier: '7', title: ' ' } },
      ],
      { monat: '2026-11', schonDa: new Set([1]) },
    );
    expect(k.map((x) => x.personId)).toEqual([2]);
    expect(kandidatenAus(null, O)).toEqual([]);
  });

  it('Name aus Vor- und Nachname, sonst aus dem Titel', () => {
    expect(
      kandidatenAus([{ person: { domainIdentifier: '5', title: 'Nur Titel' }, score: 0 }], O)[0]
        .name,
    ).toBe('Nur Titel');
  });

  it('für den Zauberstab (E5-1): Gründe, Abstand davor/danach, „höchstens N× im Monat“ (Form gemessen E5-0)', () => {
    const [k] = kandidatenAus(
      [
        roh(1, 'Ben', {
          score: -60,
          scoreHints: [
            { score: -50, reason: 'last.service.near' },
            { score: -10, reason: 'next.service.near' },
          ],
          serviceGroupPreferences: { maxPerMonth: 2 },
        }),
      ],
      O,
    );
    expect(k).toMatchObject({
      gruende: ['last.service.near', 'next.service.near'],
      abstandDavor: -50,
      abstandDanach: -10,
      hoechstensImMonat: 2,
    });
  });

  it('ohne Vorliebe oder mit unbrauchbarem Wert: `hoechstensImMonat` = null; „nie“ (0) bleibt 0', () => {
    const h = (wert: unknown) =>
      kandidatenAus(
        [
          roh(1, 'Ben', {
            serviceGroupPreferences: wert === undefined ? null : { maxPerMonth: wert },
          }),
        ],
        O,
      )[0].hoechstensImMonat;
    expect([h(undefined), h('2'), h(-1), h(1.5), h(0)]).toEqual([null, null, null, null, 0]);
    expect(kandidatenAus([roh(1, 'Ben')], O)[0]).toMatchObject({
      gruende: [],
      abstandDavor: 0,
      abstandDanach: 0,
    });
  });
});

describe('kandidatHinweis', () => {
  const k = kandidatenAus([roh(1, 'A')], O)[0];
  it('abwesend vor „am Tag schon“ vor „frei“', () => {
    expect(kandidatHinweis({ ...k, abwesend: 'Urlaub', amTag: ['Ton'] })).toEqual({
      text: 'abwesend: Urlaub',
      warnung: true,
    });
    expect(kandidatHinweis({ ...k, amTag: ['Ton', 'Licht'] })).toEqual({
      text: 'am Tag schon: Ton, Licht',
      warnung: true,
    });
    expect(kandidatHinweis(k)).toEqual({ text: 'frei', warnung: false });
  });
});
