// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { planAus } from '@shared/dienstplan/plan';
import type { RohTermin } from '@shared/dienstplan/termine';
import type { GruppenStand, PersonenDaten } from '@shared/dienstplan/personenDaten';
import { abwesenheitenAus } from '@shared/dienstplan/personenDaten';
import { diensteAus } from '@shared/ct/dienste';
import { ApiError } from '@ui/ct/fehler';
import { daten, entwurf, nachgebaut } from './entwurfAnschluss.testutil';
import type { PersonenLader } from './ladePersonen';
import { Planen } from './Planen';
import { ganzSichtbar, planbar } from './start';
import { startFuer } from './start.testutil';

/**
 * Die Ansicht „Personen“ in „Planen“ (Wunsch 5, P1): echter Plan (`planAus` + `start.ts`), ChurchTools nur als Lader
 * nachgebaut. Die Rechnung selbst prüft `shared/dienstplan/personenRaster.test.ts`; hier geht es um Umschalter,
 * Laden, Fehler im Block und Bedienung.
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
  {
    id: 21,
    name: 'Gebetsabend',
    startDate: '2026-10-21T17:00:00Z',
    endDate: '2026-10-21T18:30:00Z',
    eventServices: [{ serviceId: 9, personId: null, name: 'Gastsänger', index: null }],
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
const STAND: PersonenDaten = new Map<number, GruppenStand>([
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
          startDate: '2026-10-10',
          endDate: '2026-10-19', // beginnt vor dem Zeitraum und deckt den ersten Termin
        },
      ]),
    ),
  ],
]);

const ZUSATZ = {
  mehrMoeglich: false,
  ladeZeitraum: vi.fn(() => new Promise<never>(() => {})),
  heute: '2026-10-14',
};

function zeige(
  lader: PersonenLader | undefined,
  extra: Partial<React.ComponentProps<typeof Planen>> = {},
) {
  localStorage.setItem('dienstplaner.planen.ansicht', JSON.stringify({ unteransicht: 'raster' }));
  return render(
    <Planen
      zustand={{ art: 'fertig', zeilen: [], plan: PLAN, wochen: 8 }}
      handy={false}
      onNochmal={() => {}}
      onMehr={() => {}}
      {...ZUSATZ}
      ladePersonen={lader}
      {...extra}
    />,
  );
}

const raster = () => screen.findByRole('table', { name: 'Personen und ihre Einsätze' });
const namen = (t: HTMLElement) =>
  within(t)
    .getAllByRole('rowheader')
    .map((r) => r.textContent);

/** Steht der Name in einer Zeile? (Der Zeilenkopf trägt auch Initialen und „auch …“.) */
const hat = (t: HTMLElement, name: string) => namen(t).some((n) => n?.includes(name));

afterEach(() => {
  vi.unstubAllGlobals();
  cleanup();
  localStorage.clear();
  ZUSATZ.ladeZeitraum.mockClear();
});

describe('Planen – Umschalter mit drei Ansichten', () => {
  it('Matrix | Personen | Wer wie oft? – Personen ist der neue Knopf', () => {
    zeige(undefined);
    const gruppe = screen.getByRole('group', { name: 'Ansicht' });
    expect(
      within(gruppe)
        .getAllByRole('button')
        .map((b) => b.textContent),
    ).toEqual(['Matrix', 'Personen', 'Wer wie oft?']);
    expect(
      within(gruppe).getByRole('button', { name: 'Personen' }).getAttribute('aria-pressed'),
    ).toBe('true');
  });

  it('ein früher gemerktes „personen“ (damals „Wer wie oft?“) zeigt weiter „Wer wie oft?“', async () => {
    localStorage.setItem(
      'dienstplaner.planen.ansicht',
      JSON.stringify({ unteransicht: 'personen' }),
    );
    // „Wer wie oft?“ hat einen eigenen Zeitraum und lädt ihn selbst.
    const ladeZeitraum = vi.fn(() => Promise.resolve({ zeilen: [] as [], plan: PLAN }));
    render(
      <Planen
        zustand={{ art: 'fertig', zeilen: [], plan: PLAN, wochen: 8 }}
        handy={false}
        onNochmal={() => {}}
        onMehr={() => {}}
        {...ZUSATZ}
        ladeZeitraum={ladeZeitraum}
      />,
    );
    const gruppe = screen.getByRole('group', { name: 'Ansicht' });
    expect(
      within(gruppe).getByRole('button', { name: 'Wer wie oft?' }).getAttribute('aria-pressed'),
    ).toBe('true');
    expect(await screen.findByText(/^Einsätze \(Ø/)).toBeTruthy();
    expect(screen.queryByRole('table', { name: 'Personen und ihre Einsätze' })).toBeNull();
  });

  it('das Raster nutzt den Zeitraum der Matrix – es lädt keinen eigenen', async () => {
    zeige(vi.fn(() => Promise.resolve(STAND)));
    await raster();
    expect(ZUSATZ.ladeZeitraum).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: /^Zeitraum:/ }).getAttribute('aria-label')).toMatch(
      /passend zur Fensterbreite$/,
    );
  });
});

describe('Planen – Ansicht „Personen“', () => {
  it('lädt die Gruppen der gezeigten Dienste über den geladenen Zeitraum und zeigt Blöcke, Zeilen, Einsätze', async () => {
    const lader = vi.fn<PersonenLader>(() => Promise.resolve(STAND));
    zeige(lader);
    const t = await raster();
    await waitFor(() => expect(hat(t, 'Ben Test')).toBe(true));
    expect(lader).toHaveBeenCalledWith([7, 9], '2026-10-18', '2026-10-21');
    // Blöcke in Reihenfolge der Matrix: Ton, Gesang; darin alphabetisch; ein Mitglied ohne Einsatz hat eine Zeile.
    expect(namen(t).filter((n) => n && !/^(Gäste|Plätze|Noch offen|Name)$/.test(n))).toEqual([
      'AnAnna Testauch Gesang', // Ton: Anna (Mitglied beider Gruppen)
      'AnAnna Testauch Ton', // Gesang
      'BeBen Test',
      'CaCarla Test',
    ]);
    // Einsätze: Anna im Gesang einmal (angefragt), im Ton einmal.
    const annaGesang = screen.getAllByText('Anna Test')[1].closest('tr')!;
    expect(within(annaGesang).getAllByRole('cell')[0].textContent).toBe('1');
    // Gäste und „Noch offen“.
    expect(screen.getByText('Gastsänger')).toBeTruthy();
    expect(screen.getByRole('rowheader', { name: 'Noch offen' })).toBeTruthy();
  });

  it('der Zustand steckt im Tag: Anna ist im Ton zugesagt, im Gesang angefragt; am selben Tag „+ Gesang“', async () => {
    zeige(vi.fn(() => Promise.resolve(STAND)));
    const t = await raster();
    await waitFor(() => expect(hat(t, 'Ben Test')).toBe(true));
    expect(within(t).getByRole('img', { name: 'Ton, zugesagt' })).toBeTruthy();
    expect(within(t).getByRole('img', { name: 'Gesang, angefragt' })).toBeTruthy();
    expect(within(t).getAllByText('+ Gesang').length).toBeGreaterThan(0);
    expect(within(t).getAllByText('+ Ton').length).toBeGreaterThan(0);
  });

  it('Abwesenheit mit Grund (mehrtägig, vor dem Zeitraum begonnen)', async () => {
    zeige(vi.fn(() => Promise.resolve(STAND)));
    const t = await raster();
    const carla = await within(t).findByRole('img', { name: 'Abwesend: Urlaub' });
    expect(carla.closest('tr')!.textContent).toContain('Carla Test');
  });

  it('ohne Abwesenheitsrecht: „Abwesenheiten nicht sichtbar“ im Block statt leerer Zellen', async () => {
    const ohne: PersonenDaten = new Map<number, GruppenStand>([
      [7, da([ANNA], 'nichtSichtbar')],
      [9, da([ANNA, BEN], 'nichtSichtbar')],
    ]);
    zeige(vi.fn(() => Promise.resolve(ohne)));
    const t = await raster();
    await waitFor(() =>
      expect(within(t).getAllByText('Abwesenheiten nicht sichtbar')).toHaveLength(2),
    );
    expect(within(t).queryByRole('img', { name: /Abwesend/ })).toBeNull();
  });

  it('Entwurf aus den geladenen Entwürfen: Stift-Tag in der Zeile der Person', async () => {
    // Ben bekommt den freien Platz 2 des Gesangs am 18.10. als Entwurf.
    const e = entwurf({
      ort: { eventId: 20, serviceId: 9, index: 2 },
      ziel: { art: 'person', personId: 8, name: 'Ben Test' },
    });
    zeige(
      vi.fn(() => Promise.resolve(STAND)),
      {
        entwuerfe: nachgebaut({ laden: vi.fn(() => Promise.resolve(daten([e]))) }),
      },
    );
    const t = await raster();
    const tag = await within(t).findByRole('img', { name: 'Gesang, Entwurf, Anfrage' });
    expect(tag.closest('tr')!.textContent).toContain('Ben Test');
  });

  it('ohne Anschluss für Entwürfe tut ein Klick in eine Zelle nichts – kein Fenster, kein Entwurf (Eintragen: Planen.p2a.test.tsx)', async () => {
    zeige(
      vi.fn(() => Promise.resolve(STAND)),
      { entwuerfe: undefined },
    );
    const t = await raster();
    await waitFor(() => expect(hat(t, 'Ben Test')).toBe(true));
    const zellen = within(t).getAllByRole('cell');
    for (const z of zellen) fireEvent.click(z);
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.queryAllByRole('button', { name: / eintragen$/ })).toHaveLength(0);
  });

  it('Antippen eines Namens hebt alle Zeilen der Person hervor – noch einmal antippen nimmt es zurück', async () => {
    zeige(vi.fn(() => Promise.resolve(STAND)));
    const t = await raster();
    await waitFor(() => expect(hat(t, 'Ben Test')).toBe(true));
    // Nur die Namenknöpfe (`aria-pressed`) – die Zellen mit Einteilung sind seit P2b auch Knöpfe („Anna Test für Ton …“).
    const annaKnoepfe = within(t)
      .getAllByRole('button', { name: /Anna Test/ })
      .filter((k) => k.hasAttribute('aria-pressed'));
    expect(annaKnoepfe).toHaveLength(2); // Zeile je Person UND Dienst
    fireEvent.click(annaKnoepfe[0]);
    for (const k of annaKnoepfe) expect(k.getAttribute('aria-pressed')).toBe('true');
    const ben = within(t).getByRole('button', { name: /Ben Test/ });
    expect(ben.getAttribute('aria-pressed')).toBe('false');
    fireEvent.click(annaKnoepfe[1]);
    for (const k of annaKnoepfe) expect(k.getAttribute('aria-pressed')).toBe('false');
  });

  it('Maus über dem Namen hebt die Zeilen der Person hervor, ein Fingertipp-Eintreten nicht (nur echte Maus)', async () => {
    // jsdom kennt `PointerEvent` nicht – ohne ginge `pointerType` beim Auslösen verloren.
    vi.stubGlobal(
      'PointerEvent',
      class extends MouseEvent {
        pointerType: string;
        constructor(typ: string, init: MouseEventInit & { pointerType?: string } = {}) {
          super(typ, init);
          this.pointerType = init.pointerType ?? '';
        }
      },
    );
    zeige(vi.fn(() => Promise.resolve(STAND)));
    const t = await raster();
    await waitFor(() => expect(hat(t, 'Ben Test')).toBe(true));
    const anna = () =>
      [...t.querySelectorAll('tr[data-person="5"]')].map((r) => /hervor/.test(r.className));
    const knopf = within(t).getAllByRole('button', { name: /Anna Test/ })[0];
    expect(anna()).toEqual([false, false]);
    fireEvent.pointerEnter(knopf, { pointerType: 'touch' });
    expect(anna()).toEqual([false, false]);
    fireEvent.pointerEnter(knopf, { pointerType: 'mouse' });
    expect(anna()).toEqual([true, true]);
    fireEvent.pointerLeave(knopf, { pointerType: 'mouse' });
    expect(anna()).toEqual([false, false]);
  });

  it('ohne Lader: nur die Eingeteilten, mit Hinweis', async () => {
    zeige(undefined);
    const t = await raster();
    expect(screen.getByText(/stehen hier nicht zur Verfügung/)).toBeTruthy();
    expect(namen(t).some((n) => n?.includes('Ben Test'))).toBe(false);
    expect(namen(t).some((n) => n?.includes('Anna Test'))).toBe(true);
  });
});

describe('Planen – Ansicht „Personen“: Fehler zerstören nichts', () => {
  const FEHLER: GruppenStand = {
    art: 'fehler',
    text: 'ChurchTools antwortet gerade nicht. Bitte versuch es gleich noch einmal.',
    nochmal: true,
  };

  it('Gruppe 9 scheitert vorübergehend: Hinweis und „Nochmal versuchen“ nur im Block Gesang – Ton bleibt; Nochmal holt nur diese Gruppe', async () => {
    const lader = vi
      .fn<PersonenLader>()
      .mockResolvedValueOnce(
        new Map<number, GruppenStand>([
          [7, da([ANNA, BEN])],
          [9, FEHLER],
        ]),
      )
      .mockResolvedValueOnce(new Map<number, GruppenStand>([[9, da([ANNA, CARLA])]]));
    zeige(lader);
    const t = await raster();
    const knopf = await within(t).findByRole('button', { name: 'Nochmal versuchen' });
    expect(within(t).getAllByRole('alert')).toHaveLength(1);
    // Ton hat seine Mitglieder (Ben), Gesang nur die Eingeteilten.
    expect(namen(t).some((n) => n?.includes('Ben Test'))).toBe(true);
    expect(namen(t).some((n) => n?.includes('Carla Test'))).toBe(false);

    fireEvent.click(knopf);
    await waitFor(() => expect(namen(t).some((n) => n?.includes('Carla Test'))).toBe(true));
    expect(lader).toHaveBeenLastCalledWith([9], '2026-10-18', '2026-10-21');
    expect(within(t).queryByRole('alert')).toBeNull();
    // Der Rest blieb stehen.
    expect(namen(t).some((n) => n?.includes('Ben Test'))).toBe(true);
  });

  it('scheitert auch das Wiederholen, steht der Fehler wieder am Block – der Rest bleibt', async () => {
    const lader = vi
      .fn<PersonenLader>()
      .mockResolvedValueOnce(
        new Map<number, GruppenStand>([
          [7, da([ANNA, BEN])],
          [9, FEHLER],
        ]),
      )
      .mockRejectedValueOnce(new ApiError(504, 'Zeitüberschreitung'));
    zeige(lader);
    const t = await raster();
    fireEvent.click(await within(t).findByRole('button', { name: 'Nochmal versuchen' }));
    await waitFor(() => expect(lader).toHaveBeenCalledTimes(2));
    expect(await within(t).findByRole('button', { name: 'Nochmal versuchen' })).toBeTruthy();
    expect(namen(t).some((n) => n?.includes('Ben Test'))).toBe(true);
  });

  it('abgemeldet (401): ein Fehlerkasten ohne „Erneut versuchen“, kein Raster mit falschen Daten', async () => {
    zeige(vi.fn(() => Promise.reject(new ApiError(401, 'ab'))));
    expect((await screen.findByRole('alert')).textContent).toMatch(/nicht mehr angemeldet/);
    expect(screen.queryByRole('button', { name: /Erneut versuchen/ })).toBeNull();
  });

  it('der erste Abruf scheitert vorübergehend (kein Gruppenfehler): Fehlerkasten mit „Erneut versuchen“, danach geladen', async () => {
    const lader = vi
      .fn<PersonenLader>()
      .mockRejectedValueOnce(new ApiError(504, 'Zeitüberschreitung'))
      .mockResolvedValueOnce(STAND);
    zeige(lader);
    fireEvent.click(await screen.findByRole('button', { name: 'Erneut versuchen' }));
    const t = await raster();
    await waitFor(() => expect(hat(t, 'Ben Test')).toBe(true));
  });
});
