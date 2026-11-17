// @vitest-environment jsdom
import type { ComponentProps } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { planAus } from '@shared/dienstplan/plan';
import type { Entwurf } from '@shared/dienstplan/entwuerfe';
import type { RohTermin } from '@shared/dienstplan/termine';
import type { GruppenStand, PersonenDaten } from '@shared/dienstplan/personenDaten';
import { daten, entwurf, nachgebaut } from './entwurfAnschluss.testutil';
import type { EntwuerfeDaten } from './ladeEntwuerfe';
import { ladeWerKann } from './ladeWerKann';
import { Planen } from './Planen';
import { ganzSichtbar, planbar } from './start';
import { startFuer } from './start.testutil';

vi.mock('./ladeWerKann', () => ({ ladeWerKann: vi.fn(), vergissWerKann: vi.fn() }));

/**
 * **P2z:** Der Zauberstab im Kopf jedes Dienst-Blocks in „Personen“ – dieselbe Funktion (`onZauberstab`) und dasselbe
 * Fenster wie in der Matrix, nur auf einen Dienst beschränkt. Echter Plan, echte Ansichten, ChurchTools nachgebaut.
 *
 * Heute 16.11. Termine: 13.11. (vorbei), 20.11., 22.11., 06.12. (abgesagt). Technik (Ton 6, Licht 7), Musik (Gesang 9 –
 * ohne Schublade, dort darf man nicht ändern).
 */
const START = startFuer();
const p = (serviceId: number, personId: number | null, name: string | null, index: number) => ({
  serviceId,
  personId,
  name,
  isAccepted: true,
  index,
});
const ROH = [
  {
    id: 19,
    name: 'Gottesdienst',
    startDate: '2026-11-13T18:00:00Z',
    endDate: '2026-11-13T19:30:00Z',
    eventServices: [p(6, null, null, 1)],
  },
  {
    id: 20,
    name: 'Gottesdienst',
    startDate: '2026-11-20T18:00:00Z',
    endDate: '2026-11-20T19:30:00Z',
    eventServices: [
      p(6, 5, 'Anna Test', 1),
      p(6, null, null, 2),
      p(7, null, null, 1),
      p(9, null, null, 1),
    ],
  },
  {
    id: 21,
    name: 'Gottesdienst',
    startDate: '2026-11-22T09:00:00Z',
    endDate: '2026-11-22T10:30:00Z',
    eventServices: [p(6, null, null, 1), p(6, null, null, 2), p(7, 8, 'Ben Test', 1)],
  },
  {
    id: 24,
    name: 'Gottesdienst',
    startDate: '2026-12-06T09:00:00Z',
    endDate: '2026-12-06T10:30:00Z',
    isCanceled: true,
    eventServices: [p(6, null, null, 1), p(7, null, null, 1)],
  },
] as RohTermin[];
const planVon = (roh: RohTermin[]) =>
  planAus(roh, {
    ichId: START.ichId,
    dienste: START.dienste,
    dienstgruppen: START.dienstgruppen,
    zeitzone: 'Europe/Berlin',
    planbar: (d) => planbar(START, d),
    ganzSichtbar: (d) => ganzSichtbar(START, d),
  });
const PLAN = planVon(ROH);

const person = (id: number, name: string) => ({
  id,
  name,
  bild: null,
  initialen: name.slice(0, 2),
});
const da = (mitglieder: ReturnType<typeof person>[]): GruppenStand => ({
  art: 'da',
  mitglieder,
  abwesenheiten: [],
});
const STAND: PersonenDaten = new Map<number, GruppenStand>([
  [7, da([person(5, 'Anna Test'), person(8, 'Ben Test'), person(12, 'Daniel Test')])],
  [9, da([person(12, 'Daniel Test')])],
]);

/** Die Kandidaten von ChurchTools (`possiblepersons`) – Daniel, Eva, Frank. */
const KANDIDATEN = [
  { person: { domainIdentifier: '12', title: 'Daniel Test' }, score: 0 },
  { person: { domainIdentifier: '13', title: 'Eva Test' }, score: -5 },
  { person: { domainIdentifier: '14', title: 'Frank Test' }, score: -10 },
];

const speichern = () =>
  vi.fn(
    (
      _d: EntwuerfeDaten,
      _g: number,
      e: Omit<Entwurf, 'zeit' | 'version' | 'von'>,
      _erwartet: number | null,
    ) =>
      Promise.resolve({
        ok: true as const,
        entwurf: {
          ...e,
          von: { personId: 1, name: 'Alwin' },
          zeit: '2026-11-16T10:00:00.000Z',
          version: 1,
        },
      }),
  );

function zeige(
  extra: Partial<ComponentProps<typeof Planen>> = {},
  o: { ansicht?: 'raster' | 'matrix'; handy?: boolean } = {},
) {
  localStorage.setItem(
    'dienstplaner.planen.ansicht',
    JSON.stringify({ unteransicht: o.ansicht ?? 'raster' }),
  );
  return render(
    <Planen
      zustand={{ art: 'fertig', zeilen: [], plan: PLAN, wochen: 8 }}
      handy={o.handy ?? false}
      onNochmal={() => {}}
      onMehr={() => {}}
      mehrMoeglich={false}
      ladeZeitraum={() => new Promise<never>(() => {})}
      heute="2026-11-16"
      ladePersonen={vi.fn(() => Promise.resolve(STAND))}
      entwuerfe={nachgebaut({ speichern: speichern() })}
      {...extra}
    />,
  );
}

const zauber = (dienst: string) => `Zauberstab: ${dienst} für alle gezeigten Termine vorschlagen`;
const knopfName = () =>
  screen
    .queryAllByRole('button', { name: /^Zauberstab:/ })
    .map((b) => b.getAttribute('aria-label'));
const warteAufRaster = async () => {
  const t = await screen.findByRole('table', { name: 'Personen und ihre Einsätze' });
  await waitFor(() =>
    expect(within(t).getAllByText('Daniel Test', { selector: 'span' }).length).toBeGreaterThan(0),
  );
  return t;
};
/** Die Abfragen an ChurchTools: [Termin, Dienst]. */
const abfragen = () => vi.mocked(ladeWerKann).mock.calls.map((c) => [c[0], c[1]]);

afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.mocked(ladeWerKann).mockReset();
});

describe('Personen – Zauberstab im Block-Kopf (P2z)', () => {
  it('Knopf nur an Blöcken, in denen es etwas zu füllen gibt und man ändern darf (Gesang: keine Schublade)', async () => {
    zeige();
    await warteAufRaster();
    await waitFor(() => expect(knopfName()).toEqual([zauber('Licht'), zauber('Ton')]));
    expect(screen.getByRole('button', { name: /^Gesang, / })).toBeTruthy();
  });

  it('kein Knopf, wenn jeder freie Platz im Zeitraum einen Entwurf hat', async () => {
    // Licht: Platz 1 am 20.11. (22.11. belegt, 06.12. abgesagt) – ein Entwurf darauf, dann ist Licht nicht mehr zu füllen.
    const eLicht = entwurf({ ort: { eventId: 20, serviceId: 7, index: 1 } });
    zeige({ entwuerfe: nachgebaut({ laden: () => Promise.resolve(daten([eLicht])) }) });
    await warteAufRaster();
    await waitFor(() => expect(knopfName()).toEqual([zauber('Ton')]));
  });

  it('kein Knopf, wenn nur abgesagte oder vergangene Termine frei sind', async () => {
    // Ton nur am vergangenen 13.11. und am abgesagten 06.12. frei; Licht nur am abgesagten.
    const roh = [ROH[0], { ...ROH[3], eventServices: [p(6, null, null, 1), p(7, null, null, 1)] }];
    zeige({
      zustand: { art: 'fertig', zeilen: [], plan: planVon(roh), wochen: 8 },
    });
    await warteAufRaster();
    expect(knopfName()).toEqual([]);
  });

  it('kein Knopf, wo die Schublade nur lesbar ist', async () => {
    zeige({
      entwuerfe: nachgebaut({ laden: () => Promise.resolve(daten([], { stand: 'nur-lesen' })) }),
    });
    await warteAufRaster();
    expect(knopfName()).toEqual([]);
  });

  it('Klick: das Fenster zeigt nur diesen Dienst, an gezeigten Terminen – nicht vergangen, nicht abgesagt', async () => {
    vi.mocked(ladeWerKann).mockResolvedValue(KANDIDATEN);
    zeige();
    await warteAufRaster();
    fireEvent.click(await screen.findByRole('button', { name: zauber('Ton') }));
    await screen.findByText('Automatische Planung · Ton');
    // Abgefragt wird nur Ton (6) am 20. und 22.11. – weder Licht (7) noch Gesang (9), weder der 13.11. noch der 06.12.
    await waitFor(() => expect(abfragen()).toHaveLength(2));
    expect(abfragen()).toEqual(
      expect.arrayContaining([
        [20, 6],
        [21, 6],
      ]),
    );
    const orte = await screen.findAllByRole('region');
    expect(orte.map((r) => r.getAttribute('aria-label'))).toEqual([
      expect.stringContaining('20'),
      expect.stringContaining('22'),
    ]);
  });

  it('Übernehmen legt Entwürfe an – nur für Ton – und sie stehen in „Personen“ (blau, Stift), „Noch offen“ zählt mit', async () => {
    vi.mocked(ladeWerKann).mockResolvedValue(KANDIDATEN);
    const s = speichern();
    zeige({ entwuerfe: nachgebaut({ speichern: s }) });
    const t = await warteAufRaster();
    const offen = (pos: number) =>
      [
        ...screen
          .getByText('Noch offen')
          .closest('tr')!
          .querySelectorAll('td')
          [1 + pos].querySelectorAll('span > span'),
      ].map((x) => x.textContent);
    // Termine: 13.11., 20.11., 22.11., 06.12. – Ton ist am 20. (1) und 22. (2) frei.
    expect(offen(1)).toEqual(['Licht', 'Ton', 'Gesang']);
    expect(offen(2)).toEqual(['Ton ×2']);
    fireEvent.click(await screen.findByRole('button', { name: zauber('Ton') }));
    fireEvent.click(await screen.findByRole('button', { name: /als Entwurf übernehmen$/ }));
    await waitFor(() => expect(s).toHaveBeenCalledTimes(3));
    expect(
      s.mock.calls.map((c) => [c[1], c[2].ort.eventId, c[2].ort.serviceId, c[2].ort.index]),
    ).toEqual([
      [3, 20, 6, 2],
      [3, 21, 6, 1],
      [3, 21, 6, 2],
    ]);
    await screen.findByText('3 Vorschläge als Entwurf eingetragen – noch nicht gesendet.');
    await waitFor(() =>
      expect(within(t).getAllByRole('img', { name: 'Ton, Entwurf' })).toHaveLength(3),
    );
    expect(offen(1)).toEqual(['Licht', 'Gesang']);
    expect(offen(2)).toEqual([]);
    // Ton ist jetzt überall voll: kein Zauberstab mehr im Ton-Block, Licht bleibt.
    await waitFor(() => expect(knopfName()).toEqual([zauber('Licht')]));
  });

  it('Handy: der Knopf ist im Block-Kopf auch am schmalen Bildschirm da und öffnet dasselbe Fenster', async () => {
    vi.mocked(ladeWerKann).mockResolvedValue(KANDIDATEN);
    zeige({}, { handy: true });
    await warteAufRaster();
    fireEvent.click(await screen.findByRole('button', { name: zauber('Licht') }));
    await screen.findByText('Automatische Planung · Licht');
    await waitFor(() => expect(abfragen()).toEqual([[20, 7]]));
  });
});

describe('Matrix – Zauberstab unverändert', () => {
  it('Gruppenzeile: alle Dienste der Gruppe, alle gezeigten Termine – Titel mit dem Gruppennamen', async () => {
    vi.mocked(ladeWerKann).mockResolvedValue(KANDIDATEN);
    zeige({}, { ansicht: 'matrix' });
    fireEvent.click(
      await screen.findByRole('button', {
        name: 'Automatische Planung Technik für alle gezeigten Termine',
      }),
    );
    await screen.findByText('Automatische Planung · Technik');
    await waitFor(() => expect(abfragen()).toHaveLength(3));
    expect(abfragen()).toEqual(
      expect.arrayContaining([
        [20, 6],
        [21, 6],
        [20, 7],
      ]),
    );
    // In der Matrix gibt es die Zauberstäbe „je Block“ nicht.
    expect(knopfName()).toEqual([]);
  });
});
