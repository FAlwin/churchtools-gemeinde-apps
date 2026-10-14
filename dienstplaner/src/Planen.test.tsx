// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { diensteAus } from '@shared/ct/dienste';
import { planAus } from '@shared/dienstplan/plan';
import type { RohTermin } from '@shared/dienstplan/termine';
import { Planen } from './Planen';
import { ladeWerKann } from './ladeWerKann';

vi.mock('./ladeWerKann', () => ({ ladeWerKann: vi.fn() }));

const DIENSTE = diensteAus([
  { id: 1, name: 'Predigt', serviceGroupId: 1 },
  { id: 6, name: 'Ton', serviceGroupId: 3 },
  { id: 7, name: 'Licht', serviceGroupId: 3 },
]);
const GRUPPEN = [
  { id: 1, name: 'Programm', fuerAlle: false },
  { id: 3, name: 'Technik', fuerAlle: false },
];

const ROH = [
  {
    id: 10,
    name: 'Gottesdienst',
    startDate: '2026-10-18T08:00:00Z',
    endDate: '2026-10-18T09:30:00Z',
    eventServices: [
      { serviceId: 6, personId: 5, name: 'Anna Test', isAccepted: true },
      { serviceId: 7, personId: null, name: null },
      { serviceId: 1, personId: null, name: 'Gastprediger', isAccepted: true },
    ],
  },
  {
    id: 11,
    name: 'Gebetsabend',
    startDate: '2026-10-21T17:00:00Z',
    endDate: '2026-10-21T18:30:00Z',
    isCanceled: true,
    eventServices: [{ serviceId: 6, personId: -2, name: 'Echter Name', isAccepted: false }],
  },
] as RohTermin[];

// Technik plant man, Programm nicht.
const PLAN = planAus(ROH, {
  ichId: 1,
  dienste: DIENSTE,
  dienstgruppen: GRUPPEN,
  zeitzone: 'Europe/Berlin',
  planbar: (d) => d.dienstgruppeId === 3,
  ganzSichtbar: () => true,
});

function zeige(handy = false) {
  const onMehr = vi.fn();
  render(
    <Planen
      zustand={{ art: 'fertig', zeilen: [], plan: PLAN, wochen: 8 }}
      handy={handy}
      onNochmal={() => {}}
      onMehr={onMehr}
    />,
  );
  return { onMehr };
}

const tabelle = () => within(screen.getByRole('table'));
const zeileVon = (dienst: string) => screen.getByRole('rowheader', { name: dienst }).closest('tr')!;

describe('Planen – Tabelle (E3-4)', () => {
  it('Spalten: Name, Wochentag · Uhrzeit, Stand („1 frei“ / „abgesagt“)', () => {
    zeige();
    const koepfe = screen.getAllByRole('columnheader').slice(1);
    expect(koepfe.map((k) => k.textContent)).toEqual([
      '18OKTSo · 10:00Gottesdienst1 frei',
      '21OKTMi · 19:00Gebetsabendabgesagt',
    ]);
  });

  it('was man plant, ist aufgeklappt (Technik), der Rest zu (Programm) – „du planst“ an der Gruppe', () => {
    zeige();
    expect(
      tabelle()
        .getByRole('button', { name: /Technik/ })
        .getAttribute('aria-expanded'),
    ).toBe('true');
    expect(tabelle().getByRole('button', { name: /Technik/ }).textContent).toContain('du planst');
    expect(
      tabelle()
        .getByRole('button', { name: /Programm/ })
        .getAttribute('aria-expanded'),
    ).toBe('false');
    expect(screen.queryByRole('rowheader', { name: 'Predigt' })).toBeNull();
  });

  it('Aufklappen zeigt die Dienste; Gast als „Gast“', () => {
    zeige();
    fireEvent.click(tabelle().getByRole('button', { name: /Programm/ }));
    expect(within(zeileVon('Predigt')).getByText('Gast')).toBeTruthy();
    expect(within(zeileVon('Predigt')).getByText('Gastprediger')).toBeTruthy();
  });

  it('Zellen: Name mit Zusage, „frei“, „–“ wo nicht vorgesehen; verborgene Person ohne Namen', () => {
    zeige();
    const ton = within(zeileVon('Ton'));
    expect(ton.getByText('Anna Test')).toBeTruthy();
    expect(ton.getByText('Nicht sichtbar')).toBeTruthy();
    expect(screen.queryByText('Echter Name')).toBeNull();
    const licht = within(zeileVon('Licht'));
    expect(licht.getByText('frei')).toBeTruthy();
    expect(licht.getByLabelText('nicht vorgesehen')).toBeTruthy();
  });

  it('Gruppenzeile: freie Plätze je Termin, Haken wenn besetzt, „—“ wo die Gruppe nichts hat', () => {
    zeige();
    const technik = tabelle()
      .getByRole('button', { name: /Technik/ })
      .closest('tr')!;
    const zellen = within(technik)
      .getAllByRole('cell')
      .map((c) => c.textContent || c.querySelector('[aria-label]')?.getAttribute('aria-label'));
    expect(zellen).toEqual(['1 frei', 'alles besetzt']);
    const programm = tabelle()
      .getByRole('button', { name: /Programm/ })
      .closest('tr')!;
    expect(
      within(programm)
        .getAllByRole('cell')
        .map((c) => c.textContent || c.querySelector('[aria-label]')?.getAttribute('aria-label')),
    ).toEqual(['alles besetzt', '—']);
  });

  it('„Weitere Termine laden“', () => {
    const { onMehr } = zeige();
    fireEvent.click(screen.getByRole('button', { name: 'Weitere Termine laden' }));
    expect(onMehr).toHaveBeenCalled();
  });
});

describe('Planen – Handy (E3-4)', () => {
  it('Datumsleiste; der gewählte Termin zeigt nur seine Dienste', () => {
    zeige(true);
    const leiste = within(screen.getByRole('group', { name: 'Termine' }));
    expect(leiste.getAllByRole('button').map((b) => b.getAttribute('aria-pressed'))).toEqual([
      'true',
      'false',
    ]);
    expect(screen.getByText('Anna Test')).toBeTruthy();
    fireEvent.click(leiste.getAllByRole('button')[1]);
    expect(screen.queryByText('Anna Test')).toBeNull();
    expect(screen.getByText('Nicht sichtbar')).toBeTruthy();
    // Am Gebetsabend gibt es keinen Licht-Dienst – also keine Zeile dafür.
    expect(screen.queryByText('Licht')).toBeNull();
  });
});

describe('Planen – Zustände', () => {
  it('keine Termine → sagt es; Ladefehler → Fehlerkasten', () => {
    render(
      <Planen
        zustand={{ art: 'fertig', zeilen: [], plan: { spalten: [], gruppen: [] }, wochen: 8 }}
        handy={false}
        onNochmal={() => {}}
        onMehr={() => {}}
      />,
    );
    expect(screen.getByText('In den nächsten 8 Wochen stehen keine Termine an.')).toBeTruthy();
  });
});

// ── E3-5: Terminleiste, Filter, Breite, „Wer wie oft?“ ──────────────────────
const t = (id: number, name: string, startDate: string, eventServices: object[] = []) =>
  ({ id, name, startDate, endDate: startDate, eventServices }) as RohTermin;

/** Drei Gottesdienste und ein Gebetsabend – die Gottesdienste sind die „Hauptveranstaltung“. */
const PLAN2 = planAus(
  [
    t(1, 'Gottesdienst', '2026-10-18T08:00:00Z', [
      { serviceId: 6, personId: 5, name: 'Anna Test', isAccepted: true },
    ]),
    t(2, 'Gebetsabend', '2026-10-21T17:00:00Z', [
      { serviceId: 6, personId: 5, name: 'Anna Test', isAccepted: true },
    ]),
    t(3, 'Gottesdienst', '2026-10-25T09:00:00Z', [
      { serviceId: 6, personId: 8, name: 'Ben Test', isAccepted: false },
    ]),
    t(4, 'Gottesdienst', '2026-11-01T09:00:00Z', [{ serviceId: 1, personId: null, name: null }]),
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

function zeige2() {
  render(
    <Planen
      zustand={{ art: 'fertig', zeilen: [], plan: PLAN2, wochen: 8 }}
      handy={false}
      onNochmal={() => {}}
      onMehr={() => {}}
    />,
  );
}

const spaltenNamen = () =>
  screen
    .getAllByRole('columnheader')
    .slice(1)
    .map((k) => k.querySelector('span[title]')?.textContent);

describe('Planen – Terminleiste (E3-5)', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    localStorage.clear();
  });

  /** So breit, dass genau eine Spalte (M = 176 px) neben die Dienst-Spalte passt. */
  function schmal() {
    vi.stubGlobal(
      'ResizeObserver',
      class {
        constructor(private cb: () => void) {}
        observe() {
          this.cb();
        }
        disconnect() {}
      },
    );
    vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(400);
  }

  it('passend zur Fensterbreite; weiter/zurück verschiebt um einen Termin', () => {
    schmal();
    zeige2();
    const leiste = within(screen.getByRole('group', { name: 'Zeitraum' }));
    expect(spaltenNamen()).toEqual(['Gottesdienst']);
    expect(leiste.getByText('1 Termin · passend zur Fensterbreite')).toBeTruthy();
    expect(leiste.getByRole('button', { name: 'Einen Termin zurück' })).toHaveProperty(
      'disabled',
      true,
    );
    fireEvent.click(leiste.getByRole('button', { name: 'Einen Termin weiter' }));
    expect(spaltenNamen()).toEqual(['Gebetsabend']);
    fireEvent.click(leiste.getByRole('button', { name: 'Einen Termin zurück' }));
    expect(spaltenNamen()).toEqual(['Gottesdienst']);
  });

  it('späteren dazunehmen → feste Anzahl; „an Fensterbreite anpassen“ führt zurück', () => {
    schmal();
    zeige2();
    const leiste = within(screen.getByRole('group', { name: 'Zeitraum' }));
    fireEvent.click(leiste.getByRole('button', { name: 'Späteren Termin dazunehmen' }));
    expect(spaltenNamen()).toEqual(['Gottesdienst', 'Gebetsabend']);
    expect(leiste.getByText('18.10. – 21.10.2026')).toBeTruthy();
    fireEvent.click(leiste.getByRole('button', { name: 'an Fensterbreite anpassen' }));
    expect(spaltenNamen()).toEqual(['Gottesdienst']);
  });
});

describe('Planen – Filter, Breite, abgesetzt (E3-5)', () => {
  afterEach(() => localStorage.clear());

  it('Termine einer anderen Veranstaltung als der häufigsten sind abgesetzt', () => {
    zeige2();
    const koepfe = screen.getAllByRole('columnheader').slice(1);
    expect(koepfe.map((k) => k.hasAttribute('data-neben'))).toEqual([false, true, false, false]);
  });

  it('Filter nach Veranstaltung blendet Spalten aus – „Weitere“ = die Einzeltermine', () => {
    zeige2();
    const arten = within(screen.getByRole('group', { name: 'Veranstaltungen' }));
    fireEvent.click(arten.getByRole('button', { name: 'Weitere' }));
    expect(spaltenNamen()).toEqual(['Gottesdienst', 'Gottesdienst', 'Gottesdienst']);
  });

  it('Gruppenfilter blendet eine Gruppe aus – und bleibt im Gerät gemerkt', () => {
    const { unmount } = render(
      <Planen
        zustand={{ art: 'fertig', zeilen: [], plan: PLAN2, wochen: 8 }}
        handy={false}
        onNochmal={() => {}}
        onMehr={() => {}}
      />,
    );
    const gruppen = within(screen.getByRole('group', { name: 'Gruppen' }));
    fireEvent.click(gruppen.getByRole('button', { name: 'Programm' }));
    expect(tabelle().queryByRole('button', { name: /Programm/ })).toBeNull();
    unmount();
    zeige2();
    expect(tabelle().queryByRole('button', { name: /Programm/ })).toBeNull();
    expect(tabelle().getByRole('button', { name: /Technik/ })).toBeTruthy();
  });

  it('alles ausgeblendet → sagt, wie man wieder einblendet', () => {
    zeige2();
    const gruppen = within(screen.getByRole('group', { name: 'Gruppen' }));
    fireEvent.click(gruppen.getByRole('button', { name: 'Programm' }));
    fireEvent.click(gruppen.getByRole('button', { name: 'Technik' }));
    expect(screen.getByText(/Nichts eingeblendet/)).toBeTruthy();
  });

  it('Spaltenbreite S/M/L wird gemerkt', () => {
    zeige2();
    fireEvent.click(
      within(screen.getByRole('group', { name: 'Spaltenbreite' })).getByRole('button', {
        name: 'L',
      }),
    );
    expect(JSON.parse(localStorage.getItem('dienstplaner.planen.ansicht')!)).toMatchObject({
      breite: 'l',
    });
  });
});

describe('Planen – Wer wie oft? (E3-5)', () => {
  afterEach(() => localStorage.clear());

  it('Einsätze je Person im Zeitraum, meiste zuerst, mit Schnitt', () => {
    zeige2();
    fireEvent.click(
      within(screen.getByRole('group', { name: 'Ansicht' })).getByRole('button', {
        name: 'Wer wie oft?',
      }),
    );
    const zeilen = within(screen.getByRole('table'))
      .getAllByRole('rowheader')
      .map((r) => r.textContent);
    expect(zeilen).toEqual(['Anna Test', 'Ben Test']);
    expect(screen.getByText('Einsätze (Ø 1,5)')).toBeTruthy();
  });
});

describe('Planen – freien Platz antippen → „Wer kann?“ (E4-2)', () => {
  const laden = vi.mocked(ladeWerKann);
  afterEach(() => laden.mockReset());

  // Licht (Technik, planbar) ist frei; Predigt (Programm, nicht planbar) ist an Termin 21 frei, und an
  // Termin 22 ist man Admin.
  const ROH3 = [
    {
      id: 20,
      name: 'Gottesdienst',
      startDate: '2026-11-08T09:00:00Z',
      endDate: '2026-11-08T10:30:00Z',
      eventServices: [
        { serviceId: 7, personId: 5, name: 'Anna Test', isAccepted: true, index: 1 },
        { serviceId: 7, personId: null, name: null, index: 2 },
        { serviceId: 1, personId: null, name: null },
      ],
    },
    {
      id: 22,
      name: 'Gottesdienst',
      startDate: '2026-11-15T09:00:00Z',
      endDate: '2026-11-15T10:30:00Z',
      adminIds: [1],
      eventServices: [{ serviceId: 1, personId: null, name: null }],
    },
  ] as RohTermin[];
  const PLAN3 = planAus(ROH3, {
    ichId: 1,
    dienste: DIENSTE,
    dienstgruppen: GRUPPEN,
    zeitzone: 'Europe/Berlin',
    planbar: (d) => d.dienstgruppeId === 3,
    ganzSichtbar: () => true,
  });
  const zeige3 = (handy = false) =>
    render(
      <Planen
        zustand={{ art: 'fertig', zeilen: [], plan: PLAN3, wochen: 8 }}
        handy={handy}
        onNochmal={() => {}}
        onMehr={() => {}}
      />,
    );

  it('nur wo man planen darf, ist ein freier Platz ein Knopf – oder als Admin des Termins', () => {
    zeige3();
    fireEvent.click(screen.getByRole('button', { name: /Programm/, expanded: false })); // zu → auf
    const licht = within(zeileVon('Licht'));
    expect(licht.getAllByRole('button', { name: /Wer kann\?/ })).toHaveLength(1);
    const predigt = zeileVon('Predigt').querySelectorAll('td');
    expect(within(predigt[0] as HTMLElement).queryByRole('button')).toBeNull();
    expect(within(predigt[0] as HTMLElement).getByText('frei')).toBeTruthy();
    expect(
      within(predigt[1] as HTMLElement).getByRole('button', { name: /Wer kann\?/ }),
    ).toBeTruthy();
  });

  it('Antippen öffnet das Fach für genau diesen Platz; wer schon dort ist, steht nicht zur Wahl', async () => {
    laden.mockResolvedValue([
      { person: { domainIdentifier: '5', title: 'Anna Test' }, score: 0 },
      { person: { domainIdentifier: '6', title: 'Ben Test' }, score: 0 },
    ]);
    zeige3();
    fireEvent.click(
      within(zeileVon('Licht')).getByRole('button', { name: 'frei – Wer kann? (Platz 2 von 2)' }),
    );
    expect(screen.getByText('Licht · So, 08.11.')).toBeTruthy();
    expect(screen.getByText('Gottesdienst um 10:00 Uhr · Platz 2 von 2')).toBeTruthy();
    const liste = await screen.findByRole('list', { name: 'Wer kann?' });
    expect(
      within(liste)
        .getAllByRole('listitem')
        .map((li) => li.textContent),
    ).toEqual(['Ben Testfrei0× im November']);
    expect(laden).toHaveBeenCalledWith(20, 7);
    fireEvent.click(screen.getByRole('button', { name: 'Schließen' }));
    expect(screen.queryByRole('list', { name: 'Wer kann?' })).toBeNull();
  });

  it('am Handy genauso', async () => {
    laden.mockResolvedValue([]);
    zeige3(true);
    fireEvent.click(screen.getByRole('button', { name: 'frei – Wer kann? (Platz 2 von 2)' }));
    expect(await screen.findByText(/schlägt ChurchTools niemanden vor/)).toBeTruthy();
    expect(laden).toHaveBeenCalledWith(20, 7);
  });
});
