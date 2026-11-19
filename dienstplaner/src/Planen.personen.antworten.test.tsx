// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { planAus } from '@shared/dienstplan/plan';
import type { RohTermin } from '@shared/dienstplan/termine';
import { abwesenheitenAus, type GruppenStand } from '@shared/dienstplan/personenDaten';
import type { PersonenAntworten } from '@shared/dienstplan/personenAntworten';
import { antwortBereinigt, type Antworten } from '@shared/dienstplan/verfuegbarkeit';
import { diensteAus } from '@shared/ct/dienste';
import { ApiError } from '@ui/ct/fehler';
import type { AntwortenLader } from './ladeAntworten';
import type { PersonenLader } from './ladePersonen';
import { Planen } from './Planen';
import { ganzSichtbar, planbar } from './start';
import { startFuer } from './start.testutil';

/**
 * Antworten aus „Wann kann ich?“ in der Ansicht „Personen“ (E5c-3): Farbe/Text der Zelle, Kopf, Legende, Hinweis im Block,
 * Fehlerzweige. Die Rechnung steht in `shared/dienstplan/personenRaster.antworten.test.ts`; die Antworten kommen aus
 * `antwortBereinigt` (Erzeuger). Plan wie in `Planen.personen.test.tsx`: Ton (Technik, Dienst 6), Gesang (Musik, Dienst 9).
 */
const START = startFuer({
  dienste: diensteAus([
    { id: 6, name: 'Ton', serviceGroupId: 3, groupIds: [7], sortKey: 1 },
    { id: 9, name: 'Gesang', serviceGroupId: 4, groupIds: [9], sortKey: 2 },
  ]),
  rechte: {
    planbareDienstgruppen: [3, 4],
    sichtbareDienstgruppen: null,
    ablaufKalender: [],
    terminKalender: [],
    abwesenheitenAller: false,
  },
});
const ROH = [
  {
    id: 20,
    name: 'Gottesdienst',
    startDate: '2026-10-18T08:00:00Z',
    endDate: '2026-10-18T09:30:00Z',
    eventServices: [
      { serviceId: 6, personId: 5, name: 'Anna Test', isAccepted: true, index: null },
    ],
  },
  {
    id: 21,
    name: 'Gebetsabend',
    startDate: '2026-10-21T17:00:00Z',
    endDate: '2026-10-21T18:30:00Z',
    eventServices: [{ serviceId: 9, personId: null, name: null, index: null }],
  },
] as RohTermin[];
const PLAN = planAus(ROH, {
  ichId: START.ichId,
  dienste: START.dienste,
  dienstgruppen: START.dienstgruppen,
  zeitzone: 'Europe/Berlin',
  planbar: (d) => planbar(START, d),
  ganzSichtbar: (d) => ganzSichtbar(START, d),
});

const person = (id: number, name: string) => ({
  id,
  name,
  bild: null,
  initialen: name.slice(0, 2),
});
const ANNA = person(5, 'Anna Test');
const BEN = person(8, 'Ben Test');
const CARLA = person(11, 'Carla Test');
const da = (
  mitglieder: ReturnType<typeof person>[],
  abwesenheiten: Extract<GruppenStand, { art: 'da' }>['abwesenheiten'] = [],
): GruppenStand => ({ art: 'da', mitglieder, abwesenheiten });
const PERSONEN: ReturnType<PersonenLader> = Promise.resolve(
  new Map<number, GruppenStand>([
    [7, da([ANNA])],
    [
      9,
      da(
        [ANNA, BEN, CARLA],
        abwesenheitenAus([
          {
            id: 1,
            person: { domainIdentifier: '11' },
            absenceReason: { nameTranslated: 'Urlaub' },
            startDate: '2026-10-18', // Carla ist am ersten Termin abwesend – trotz Ja
            endDate: '2026-10-18',
          },
        ]),
      ),
    ],
  ]),
);

const antw = (x: Parameters<typeof antwortBereinigt>[0][]): Antworten =>
  Object.fromEntries(x.map((e, i) => [String(20 + i), antwortBereinigt(e)]));
const ANTWORTEN: PersonenAntworten = {
  jePerson: new Map<number, Antworten>([
    // Anna: Ja am 20 · Vielleicht mit Notiz am 21
    [
      5,
      antw([
        { a: 'ja', tag: '2026-10-18' },
        { a: 'vielleicht', tag: '2026-10-21', notiz: 'nur bis 12 Uhr' },
      ]),
    ],
    // Ben: Ja am 20 – aber nur für Ton (im Gesang weiß) · Ja am 21
    [
      8,
      antw([
        { a: 'ja', tag: '2026-10-18', dienste: [6] },
        { a: 'ja', tag: '2026-10-21' },
      ]),
    ],
    // Carla: Ja am 20, aber abwesend (rot schlägt grün) · keine Antwort am 21
    [11, antw([{ a: 'ja', tag: '2026-10-18' }])],
  ]),
  sichtbar: new Set([3, 4]),
};

function zeige(antwortenLader: AntwortenLader | undefined) {
  localStorage.setItem('dienstplaner.planen.ansicht', JSON.stringify({ unteransicht: 'raster' }));
  return render(
    <Planen
      zustand={{ art: 'fertig', zeilen: [], plan: PLAN, wochen: 8 }}
      handy={false}
      onNochmal={() => {}}
      onMehr={() => {}}
      mehrMoeglich={false}
      ladeZeitraum={vi.fn(() => new Promise<never>(() => {}))}
      heute="2026-10-14"
      ladePersonen={() => PERSONEN}
      ladeAntworten={antwortenLader}
    />,
  );
}
const raster = () => screen.findByRole('table', { name: 'Personen und ihre Einsätze' });
/** Die Terminzellen (ohne „Einsätze“) der Zeile einer Person im Block des Dienstes (0 = Ton, 1 = Gesang). */
const zellen = (t: HTMLElement, personId: number, block: number) =>
  [
    ...[...t.querySelectorAll(`tr[data-person="${personId}"]`)][
      block
    ].querySelectorAll<HTMLElement>('td'),
  ].slice(1);

afterEach(() => {
  cleanup();
  localStorage.clear();
});

describe('Personen-Raster mit Antworten', () => {
  it('Ja grün, Vielleicht gelblich, abwesend schlägt Ja (rot), „nur für Ton“ bleibt im Gesang weiß; Tooltip und aria nennen Antwort, Notiz und Beschränkung', async () => {
    zeige(vi.fn<AntwortenLader>(() => Promise.resolve(ANTWORTEN)));
    const t = await raster();
    await waitFor(() => expect(zellen(t, 5, 1)[0].className).toMatch(/antwortJa/));
    // Anna im Gesang-Block: 20 = Ja (grün), 21 = Vielleicht (gelb) mit Notiz.
    const [annaJa, annaViel] = zellen(t, 5, 1);
    expect(annaJa.className).toMatch(/antwortJa/);
    expect(annaViel.className).toMatch(/antwortVielleicht/);
    expect(annaViel.title).toBe('Vielleicht – nur bis 12 Uhr');
    expect(annaViel.getAttribute('aria-label')).toBe('Vielleicht – nur bis 12 Uhr');
    // Ben im Gesang: „Ja nur für Ton“ → weiß, aber der Text sagt es; am 21 Ja → grün.
    const ben = zellen(t, 8, 0);
    expect(ben[0].className).not.toMatch(/antwort(Ja|Vielleicht)/);
    expect(ben[0].title).toBe('Ja – nur für Ton');
    expect(ben[1].className).toMatch(/antwortJa/);
    // Carla: Ja, aber abwesend → rot schraffiert (kein Grün); am 21 keine Antwort → weiß, ohne Tooltip.
    const carla = zellen(t, 11, 0);
    expect(carla[0].className).toMatch(/abwZelle/);
    expect(carla[0].className).not.toMatch(/antwortJa/);
    expect(carla[1].className).not.toMatch(/antwort(Ja|Vielleicht)|abwZelle/);
    expect(carla[1].title).toBe('');
  });

  it('Spaltenkopf: „n ja · m vielleicht“ – Anna steht in zwei Blöcken und zählt einmal; abwesend zählt nicht', async () => {
    zeige(vi.fn<AntwortenLader>(() => Promise.resolve(ANTWORTEN)));
    const t = await raster();
    // Termin 20: Anna ja, Ben ja (nur Ton – zählt trotzdem), Carla abwesend → 2 ja. Termin 21: Ben ja, Anna vielleicht.
    expect(await within(t).findByText('2 ja · 0 vielleicht')).toBeTruthy();
    expect(within(t).getByText('1 ja · 1 vielleicht')).toBeTruthy();
  });

  it('Legende mit allen fünf Einträgen – erst, wenn Antworten sichtbar geladen sind', async () => {
    zeige(vi.fn<AntwortenLader>(() => Promise.resolve(ANTWORTEN)));
    await raster();
    const legende = await screen.findByRole('group', { name: 'Legende zu den Farben' });
    expect(legende.textContent).toBe(
      'Antwort der Person:JaVielleichtkeine AntwortNein oder abwesendEntwurf',
    );
  });

  it('Dienstgruppe nicht sichtbar: Hinweis im Block (nur dort), Zellen ohne Farbe – nicht als „keine Antwort“', async () => {
    zeige(vi.fn<AntwortenLader>(() => Promise.resolve({ ...ANTWORTEN, sichtbar: new Set([4]) })));
    const t = await raster();
    await waitFor(() => expect(within(t).getAllByText('Antworten nicht sichtbar')).toHaveLength(1));
    // Anna im Ton-Block (Technik, nicht sichtbar): keine Farbe, kein Tooltip.
    const annaTon = zellen(t, 5, 0)[0];
    expect(annaTon.className).not.toMatch(/antwort(Ja|Vielleicht)/);
    expect(annaTon.title).toBe('');
    // Im Gesang (sichtbar) gibt es sie.
    expect(zellen(t, 5, 1)[0].className).toMatch(/antwortJa/);
  });

  it('ohne Antworten-Lader: keine Legende, kein Kopf, kein Hinweis (das alte Verhalten)', async () => {
    zeige(undefined);
    const t = await raster();
    await waitFor(() => expect(within(t).getAllByText('Ben Test').length).toBeGreaterThan(0));
    expect(screen.queryByRole('group', { name: 'Legende zu den Farben' })).toBeNull();
    expect(within(t).queryByText(/ja · .* vielleicht/)).toBeNull();
    expect(within(t).queryByText('Antworten nicht sichtbar')).toBeNull();
  });
});

describe('Personen-Raster mit Antworten – Fehler zerstören nichts', () => {
  it('erster Abruf scheitert vorübergehend: Fehlerkasten mit „Erneut versuchen“, weder Farbe noch Legende noch Kopf; danach da', async () => {
    const lader = vi
      .fn<AntwortenLader>()
      .mockRejectedValueOnce(new ApiError(503, 'Gerade nicht'))
      .mockResolvedValueOnce(ANTWORTEN);
    zeige(lader);
    const t = await raster();
    const kasten = await screen.findByRole('alert');
    expect(kasten.textContent).toMatch(
      /Antworten aus „Wann kann ich\?“ konnten nicht geladen werden/,
    );
    expect(screen.queryByRole('group', { name: 'Legende zu den Farben' })).toBeNull();
    expect(within(t).queryByText(/ja · .* vielleicht/)).toBeNull();
    expect(within(t).queryByText('Antworten nicht sichtbar')).toBeNull(); // „nicht sichtbar“ wäre die falsche Aussage
    fireEvent.click(within(kasten).getByRole('button', { name: 'Erneut versuchen' }));
    await waitFor(() => expect(zellen(t, 5, 1)[0].className).toMatch(/antwortJa/));
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('abgemeldet (401): Fehlerkasten ohne „Erneut versuchen“', async () => {
    zeige(vi.fn<AntwortenLader>(() => Promise.reject(new ApiError(401, 'ab'))));
    expect((await screen.findByRole('alert')).textContent).toMatch(/nicht mehr angemeldet/);
    expect(screen.queryByRole('button', { name: 'Erneut versuchen' })).toBeNull();
  });
});
