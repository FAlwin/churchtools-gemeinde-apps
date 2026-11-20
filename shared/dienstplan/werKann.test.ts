import { describe, expect, it } from 'vitest';
import type { ZellenAntwort } from './personenAntworten';
import { BEGLEITUNG, liste } from './personenliste.testutil';
import {
  abschnitteAus,
  FRUEHER_ABGESAGT,
  kandidatenAus,
  kandidatHinweis,
  nachListe,
  pauseDerPerson,
  werKannTitel,
  type RohKandidat,
} from './werKann';

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
    // Der Abzug selbst bleibt erhalten – der Zauberstab zählt ihn (E5-2).
    expect(k.map((x) => x.frueherAbgesagt)).toEqual([-500, 0]);
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

  it('Hauptgrund = ChurchTools-Text zum größten Abzug, ohne „hat zuvor abgesagt“; ohne Abzug null', () => {
    const [anna, k] = kandidatenAus(
      [
        roh(1, 'Ben', {
          score: -780,
          scoreHints: [
            {
              score: -30,
              reason: 'preference.daytime',
              nameTranslated: 'Einteilung morgens gewünscht',
            },
            { score: -250, reason: 'service.same-day', nameTranslated: 'Heute bereits eingeteilt' },
            { score: -500, reason: FRUEHER_ABGESAGT, nameTranslated: 'Hat zuvor abgesagt' },
            { score: 10, reason: 'preference.with-partner', nameTranslated: 'Mit Partner' },
          ],
        }),
        roh(2, 'Anna', {
          scoreHints: [{ score: 10, reason: 'preference.daytime', nameTranslated: 'passt' }],
        }),
      ],
      O,
    );
    expect(k.name).toBe('Ben Test');
    expect(k.hauptGrund).toBe('Heute bereits eingeteilt');
    // Nur ein Zuschlag, kein Abzug → kein Grund.
    expect(anna.hauptGrund).toBeNull();
    expect(kandidatenAus([roh(2, 'Anna')], O)[0].hauptGrund).toBeNull();
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

describe('„Wer kann?“ mit Personenliste (PL-1)', () => {
  // Punkte bestimmen die bisherige Reihenfolge: Anna (1) vorn, dann Ben (2), Clara (3), Daniel (4) hinten.
  const kandidaten = () =>
    kandidatenAus(
      [
        roh(1, 'Anna', { score: 0 }),
        roh(2, 'Ben', { score: -1 }),
        roh(3, 'Clara', { score: -2 }),
        roh(4, 'Daniel', { score: -3 }),
      ],
      O,
    );
  const bezug = (x: Parameters<typeof liste>[0], tag: string | undefined = '2026-12-06') => ({
    liste: liste(x),
    tag,
  });
  const namen = (l: { name: string }[]) => l.map((k) => k.name.split(' ')[0]);

  it('Reihenfolge: ohne gespeicherte Reihenfolge bleibt „frei und selten dran“', () => {
    expect(namen(nachListe(kandidaten(), undefined))).toEqual(['Anna', 'Ben', 'Clara', 'Daniel']);
    expect(namen(nachListe(kandidaten(), bezug({ tags: [BEGLEITUNG] })))).toEqual([
      'Anna',
      'Ben',
      'Clara',
      'Daniel',
    ]);
  });

  it('Reihenfolge: mit gespeicherter Reihenfolge sortiert die Liste, wer fehlt danach alphabetisch', () => {
    expect(namen(nachListe(kandidaten(), bezug({ reihe: [4, 2] })))).toEqual([
      'Daniel',
      'Ben',
      'Anna',
      'Clara',
    ]);
  });

  it('Überschrift sagt, wonach sortiert ist', () => {
    expect(werKannTitel(undefined)).toBe('Wer kann? Oben: frei und selten dran');
    expect(werKannTitel(liste({ tags: [BEGLEITUNG] }))).toBe(
      'Wer kann? Oben: frei und selten dran',
    );
    expect(werKannTitel(liste({ reihe: [1] }))).toBe(
      'Wer kann? In der Reihenfolge der Personenliste',
    );
  });

  it('Pause: wer pausiert, steht hinten – auch ohne Reihenfolge; „bis“ gilt einschließlich', () => {
    const b = bezug({ pause: { '1': { bis: '2026-12-06' }, '2': { bis: '2026-12-05' } } });
    // Anna pausiert am 06.12. (einschließlich), Bens Pause ist am 06.12. vorbei.
    expect(namen(nachListe(kandidaten(), b))).toEqual(['Ben', 'Clara', 'Daniel', 'Anna']);
  });

  it('Pause: unter „Kann nicht / abwesend“, auch mit Ja-Antwort; Pausierte behalten die Reihenfolge der Liste', () => {
    const antworten = new Map<number, ZellenAntwort>([
      [1, { a: 'ja', gilt: true, notiz: null, nurFuer: null }],
    ]);
    const a = abschnitteAus(
      kandidaten(),
      antworten,
      bezug({ reihe: [3, 1, 2], pause: { '1': {}, '4': {} } }),
    );
    const von = (stufe: string) =>
      namen(a!.find((x) => x.stufe === stufe)!.personen.map((p) => p.kandidat));
    expect(von('ja')).toEqual([]);
    expect(von('kannNicht')).toEqual(['Anna', 'Daniel']);
    expect(von('keine')).toEqual(['Clara', 'Ben']);
  });

  it('Pause: ohne Liste stehen dieselben Leute in „Hat Ja gesagt“', () => {
    const antworten = new Map<number, ZellenAntwort>([
      [1, { a: 'ja', gilt: true, notiz: null, nurFuer: null }],
    ]);
    const a = abschnitteAus(kandidaten(), antworten);
    expect(namen(a!.find((x) => x.stufe === 'ja')!.personen.map((p) => p.kandidat))).toEqual([
      'Anna',
    ]);
  });

  it('Hinweis: „Pause bis …“ nach der Abwesenheit, vor „am Tag schon“; ohne Pause wie bisher', () => {
    const k = kandidaten()[0];
    expect(kandidatHinweis({ ...k, amTag: ['Ton'] }, { bis: '2027-01-31' })).toEqual({
      text: 'Pause bis 31.01.27',
      warnung: false,
    });
    expect(kandidatHinweis({ ...k, abwesend: 'Urlaub' }, {})).toEqual({
      text: 'abwesend: Urlaub',
      warnung: true,
    });
    expect(kandidatHinweis(k, null)).toEqual({ text: 'frei', warnung: false });
    expect(pauseDerPerson(bezug({ pause: { '1': {} } }), 1)).toEqual({});
    expect(pauseDerPerson(undefined, 1)).toBeNull();
  });
});
