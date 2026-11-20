// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import { planAus } from '@shared/dienstplan/plan';
import type { RohTermin } from '@shared/dienstplan/termine';
import type { GruppenStand, PersonenDaten } from '@shared/dienstplan/personenDaten';
import { diensteAus } from '@shared/ct/dienste';
import { BEGLEITUNG, liste } from '@shared/dienstplan/personenliste.testutil';
import { daten, nachgebaut } from './entwurfAnschluss.testutil';
import { Planen } from './Planen';
import { ganzSichtbar, planbar } from './start';
import { startFuer } from './start.testutil';

/**
 * Die Personenliste in der Ansicht „Personen“ (PL-1): Reihenfolge, „unten und blass“ mit Zwischenzeile, Kürzel am Bild,
 * Legende „Tags:“. Die Liste kommt wie in der App aus den geladenen Entwurfs-Daten (`EntwuerfeDaten.personenlisten`); die
 * Rechnung selbst prüft `shared/dienstplan/personenRaster.test.ts`.
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
      { serviceId: 9, personId: 5, name: 'Anna Test', isAccepted: false, index: 1 },
      { serviceId: 9, personId: null, name: null, index: 2 },
    ],
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
const da = (mitglieder: ReturnType<typeof person>[]): GruppenStand => ({
  art: 'da',
  mitglieder,
  abwesenheiten: [],
});
const STAND: PersonenDaten = new Map<number, GruppenStand>([
  [7, da([ANNA])],
  [9, da([ANNA, BEN, CARLA])],
]);

function zeige(l?: Parameters<typeof liste>[0]) {
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
      ladePersonen={vi.fn(() => Promise.resolve(STAND))}
      entwuerfe={nachgebaut({
        laden: vi.fn(() => Promise.resolve(daten([], {}, l ? [[4, liste(l)]] : []))),
      })}
    />,
  );
}

const raster = () => screen.findByRole('table', { name: 'Personen und ihre Einsätze' });
/** Die Zeilen des Gesang-Blocks in Reihenfolge: Personenzeilen mit Namen, die Zwischenzeile mit ihrem Text. */
const gesang = (t: HTMLElement): string[] => {
  const zeilen = [...t.querySelectorAll('tbody tr')];
  const start = zeilen.findIndex(
    (z) => z.textContent?.includes('Gesang') && !z.hasAttribute('data-person'),
  );
  const ende = zeilen.findIndex((z, i) => i > start && z.textContent?.startsWith('Plätze'));
  return zeilen
    .slice(start + 1, ende)
    .filter(
      (z) =>
        z.hasAttribute('data-person') || /In Pause oder ganz abwesend/.test(z.textContent ?? ''),
    )
    .map((z) =>
      z.hasAttribute('data-person')
        ? (z.querySelector('th')?.textContent ?? '')
        : (z.textContent ?? ''),
    );
};

afterEach(() => {
  cleanup();
  localStorage.clear();
});

describe('Ansicht „Personen“ mit Personenliste (PL-1)', () => {
  it('Reihenfolge der Liste; wer pausiert (und nicht eingeteilt ist), steht unten unter der Zwischenzeile, mit „Pause“', async () => {
    zeige({ reihe: [11, 8], pause: { '8': {} } });
    const t = await raster();
    await waitFor(() => expect(gesang(t).length).toBeGreaterThan(1));
    const z = gesang(t);
    expect(z[0]).toContain('Carla Test');
    expect(z[1]).toContain('Anna Test');
    expect(z[2]).toBe('In Pause oder ganz abwesend · 1');
    expect(z[3]).toContain('Ben Test');
    expect(z[3]).toContain('Pause');
    expect(z[3]).not.toContain('Pause bis');
    // Die Zeile ist blass markiert, die Zellen bleiben im DOM (einteilbar).
    const ben = t.querySelector('tr[data-person="8"]') as HTMLElement;
    expect(ben.className).toMatch(/ruhend/);
  });

  it('Pause mit Datum: „Pause bis …“ statt „auch …“', async () => {
    zeige({ pause: { '5': { bis: '2026-10-18' } } });
    const t = await raster();
    await waitFor(() =>
      expect(within(t).getAllByText(/Pause bis 18\.10\.26/).length).toBeGreaterThan(0),
    );
    // Anna steht in Gesang UND Ton: dort sonst „auch Ton“ bzw. „auch Gesang“.
    expect(within(t).queryByText('auch Ton')).toBeNull();
  });

  it('Kürzel am Bild mit den vollen Namen im Titel, Legende „Tags:“', async () => {
    zeige({ tags: [BEGLEITUNG], tagsVon: { '9|5': ['b'] } });
    const t = await raster();
    const kuerzel = await within(t).findByTitle('Begleitung');
    expect(kuerzel.textContent).toBe('B');
    expect(kuerzel.closest('tr')?.getAttribute('data-person')).toBe('5');
    // Nur in dieser Zeile (Gesang), nicht in der Ton-Zeile derselben Person.
    expect(within(t).getAllByTitle('Begleitung')).toHaveLength(1);
    const legende = await screen.findByRole('group', { name: 'Legende zu den Tags' });
    expect(legende.textContent).toContain('Tags:');
    expect(legende.textContent).toContain('BBegleitung');
  });

  it('ohne Personenliste: alphabetisch, nichts unten, kein Kürzel, keine Legende', async () => {
    zeige();
    const t = await raster();
    await waitFor(() => expect(gesang(t).length).toBeGreaterThan(1));
    const z = gesang(t);
    expect(z.map((x) => x.slice(0, 11))).toEqual(['AnAnna Test', 'BeBen Test', 'CaCarla Tes']);
    expect(t.textContent).not.toContain('In Pause oder ganz abwesend');
    expect(screen.queryByText('Tags:')).toBeNull();
  });
});
