// @vitest-environment jsdom
import type { ComponentProps } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { ApiError } from '@ui/ct/fehler';
import { diensteAus } from '@shared/ct/dienste';
import { planAus, type Plan } from '@shared/dienstplan/plan';
import type { Fehlermeldung } from '@ui/ct/fehlerMeldung';
import type { RohTermin } from '@shared/dienstplan/termine';
import type { Entwurf } from '@shared/dienstplan/entwuerfe';
import type { SendeErgebnis } from '@shared/dienstplan/senden';
import type { TerminStand } from './terminStand';
import type { EntwuerfeDaten, EntwurfAnschluss, Schublade } from './ladeEntwuerfe';
import { Planen } from './Planen';
import type { TermineZustand } from './Termine';
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

/** Was jeder Aufruf braucht: „ab heute“ ist ausgeschöpft, ein gewählter Zeitraum lädt nie fertig. */
const ZUSATZ = {
  mehrMoeglich: false,
  ladeZeitraum: () => new Promise<never>(() => {}),
  heute: '2026-10-14',
};

function zeige(handy = false) {
  const onMehr = vi.fn();
  render(
    <Planen
      zustand={{ art: 'fertig', zeilen: [], plan: PLAN, wochen: 8 }}
      handy={handy}
      onNochmal={() => {}}
      onMehr={onMehr}
      {...ZUSATZ}
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

  it('was man plant, ist aufgeklappt (Technik), der Rest zu (Programm) – „nur ansehen“ nur am Rest', () => {
    zeige();
    expect(
      tabelle()
        .getByRole('button', { name: /Technik/ })
        .getAttribute('aria-expanded'),
    ).toBe('true');
    expect(tabelle().getByRole('button', { name: /Technik/ }).textContent).not.toContain(
      'nur ansehen',
    );
    expect(tabelle().getByRole('button', { name: /Programm/ }).textContent).toContain(
      'nur ansehen',
    );
    expect(screen.queryByText('du planst')).toBeNull();
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

  it('kein „Weitere Termine laden“ mehr – das macht ＋ bzw. › am Ende (14.10.2026)', () => {
    zeige();
    expect(screen.queryByRole('button', { name: 'Weitere Termine laden' })).toBeNull();
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
        {...ZUSATZ}
      />,
    );
    expect(screen.getByText('In den nächsten 8 Wochen stehen keine Termine an.')).toBeTruthy();
  });
});

// ── E3-5: Terminleiste, Filter, Breite, „Wer wie oft?“ ──────────────────────
const t = (id: number, name: string, startDate: string, eventServices: object[] = []) =>
  ({ id, name, startDate, endDate: startDate, eventServices }) as RohTermin;

/** Drei Gottesdienste und ein Gebetsabend – die Gottesdienste sind die „Hauptveranstaltung“. */
const ROH2 = [
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
];
const OPT2 = {
  ichId: 1,
  dienste: DIENSTE,
  dienstgruppen: GRUPPEN,
  zeitzone: 'Europe/Berlin',
  planbar: () => true,
  ganzSichtbar: () => true,
};
const PLAN2 = planAus(ROH2, OPT2);

/** So breit, dass genau eine Spalte (M = 176 px) neben die Dienst-Spalte passt. */
function schmal(breite = 400) {
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
  vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(breite);
}

function zeige2() {
  render(
    <Planen
      zustand={{ art: 'fertig', zeilen: [], plan: PLAN2, wochen: 8 }}
      handy={false}
      onNochmal={() => {}}
      onMehr={() => {}}
      {...ZUSATZ}
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

  it('„passend“ ist nie breiter als der Platz – feste Breiten statt vom Inhalt gedehnter Spalten', () => {
    // 14.10.2026: Der Inhalt dehnte die Spalten, „passend“ ragte heraus; beim Wischen rutschte der erste
    // Termin unter die Dienst-Spalte. Die Tabelle trägt jetzt ihre Breite selbst.
    for (const platz of [400, 640, 1086]) {
      schmal(platz);
      const { unmount } = render(
        <Planen
          zustand={{ art: 'fertig', zeilen: [], plan: PLAN2, wochen: 8 }}
          handy={false}
          onNochmal={() => {}}
          onMehr={() => {}}
          {...ZUSATZ}
        />,
      );
      const breite = parseInt(screen.getByRole('table').style.width, 10);
      expect(breite).toBeGreaterThan(178);
      expect(breite).toBeLessThanOrEqual(platz);
      unmount();
      vi.restoreAllMocks();
    }
  });

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

  it('späteren dazunehmen → feste Anzahl; „Ab heute“ im Zeitraum-Menü führt zurück zu „passend“', () => {
    schmal();
    zeige2();
    const leiste = within(screen.getByRole('group', { name: 'Zeitraum' }));
    fireEvent.click(leiste.getByRole('button', { name: 'Späteren Termin dazunehmen' }));
    expect(spaltenNamen()).toEqual(['Gottesdienst', 'Gebetsabend']);
    const knopf = leiste.getByRole('button', { name: /^Zeitraum:/ });
    expect(knopf.textContent).toBe('18.10. – 21.10.20262 Termine');
    fireEvent.click(knopf);
    fireEvent.click(screen.getByRole('button', { name: /^Ab heute/ }));
    expect(spaltenNamen()).toEqual(['Gottesdienst']);
    expect(knopf.textContent).toBe('18.10.20261 Termin · passend zur Fensterbreite');
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
    fireEvent.click(screen.getByRole('button', { name: 'Filter' }));
    const arten = within(screen.getByRole('group', { name: 'Veranstaltungen' }));
    fireEvent.click(arten.getByRole('checkbox', { name: 'Weitere' }));
    expect(spaltenNamen()).toEqual(['Gottesdienst', 'Gottesdienst', 'Gottesdienst']);
  });

  it('Gruppenfilter blendet eine Gruppe aus – und bleibt im Gerät gemerkt', () => {
    const { unmount } = render(
      <Planen
        zustand={{ art: 'fertig', zeilen: [], plan: PLAN2, wochen: 8 }}
        handy={false}
        onNochmal={() => {}}
        onMehr={() => {}}
        {...ZUSATZ}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Filter' }));
    const gruppen = within(screen.getByRole('group', { name: 'Gruppen' }));
    fireEvent.click(gruppen.getByRole('checkbox', { name: 'Programm' }));
    expect(tabelle().queryByRole('button', { name: /Programm/ })).toBeNull();
    unmount();
    zeige2();
    expect(tabelle().queryByRole('button', { name: /Programm/ })).toBeNull();
    expect(tabelle().getByRole('button', { name: /Technik/ })).toBeTruthy();
  });

  it('alles ausgeblendet → sagt, wie man wieder einblendet', () => {
    zeige2();
    fireEvent.click(screen.getByRole('button', { name: 'Filter' }));
    const gruppen = within(screen.getByRole('group', { name: 'Gruppen' }));
    fireEvent.click(gruppen.getByRole('checkbox', { name: 'Programm' }));
    fireEvent.click(gruppen.getByRole('checkbox', { name: 'Technik' }));
    expect(screen.getByText(/Nichts eingeblendet – über „Filter“/)).toBeTruthy();
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
        {...ZUSATZ}
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

  // Alwin, 16.10.2026: „nur ansehen“ folgt derselben Regel wie die Knöpfe – Admin eines Termins zählt mit.
  it('„nur ansehen“: in der Tabelle nicht, sobald man an einem gezeigten Termin Admin ist', () => {
    zeige3();
    expect(screen.queryByText('nur ansehen')).toBeNull();
  });

  it('„nur ansehen“ am Handy je Termin: am Termin ohne Admin ja, am Termin mit Admin nein', () => {
    zeige3(true);
    const programm = () => screen.getByRole('button', { name: /Programm/ });
    expect(programm().textContent).toContain('nur ansehen');
    expect(screen.getByRole('button', { name: /Technik/ }).textContent).not.toContain(
      'nur ansehen',
    );
    const leiste = within(screen.getByRole('group', { name: 'Termine' }));
    fireEvent.click(leiste.getAllByRole('button')[1]);
    expect(programm().textContent).not.toContain('nur ansehen');
  });

  it('am Handy genauso', async () => {
    laden.mockResolvedValue([]);
    zeige3(true);
    fireEvent.click(screen.getByRole('button', { name: 'frei – Wer kann? (Platz 2 von 2)' }));
    expect(await screen.findByText(/schlägt ChurchTools niemanden vor/)).toBeTruthy();
    expect(laden).toHaveBeenCalledWith(20, 7);
  });
});

// ── Zeitraum-Knopf (14.10.2026) ──────────────────────────────────────────────
const knopf = () => screen.getByRole('button', { name: /^Zeitraum:/ });

describe('Planen – Zeitraum-Knopf (14.10.2026)', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    localStorage.clear();
  });

  type Daten = { zeilen: []; plan: Plan };
  const daten = (plan = PLAN2): Daten => ({ zeilen: [], plan });
  const waehle = (option: RegExp) => {
    fireEvent.click(knopf());
    fireEvent.click(screen.getByRole('button', { name: option }));
  };
  const zeigeZ = (ladeZeitraum: (von: string, bis: string) => Promise<Daten>) =>
    render(
      <Planen
        zustand={{ art: 'fertig', zeilen: [], plan: PLAN2, wochen: 8 }}
        handy={false}
        onNochmal={() => {}}
        onMehr={() => {}}
        {...ZUSATZ}
        ladeZeitraum={ladeZeitraum}
      />,
    );

  it('Monat: lädt genau den Monat und zeigt ALLE seine Termine; ‹ › springen um einen Monat; gemerkt', async () => {
    schmal(); // nur eine Spalte passt – im Monat stehen trotzdem alle
    const laden = vi.fn(() => Promise.resolve(daten()));
    zeigeZ(laden);
    waehle(/^Dieser Monat/);
    expect(laden).toHaveBeenLastCalledWith('2026-10-01', '2026-10-31');
    expect(
      await screen.findByRole('button', { name: 'Zeitraum: Oktober 2026, 4 Termine' }),
    ).toBeTruthy();
    expect(spaltenNamen()).toHaveLength(4);
    fireEvent.click(screen.getByRole('button', { name: 'Zeitraum danach' }));
    expect(laden).toHaveBeenLastCalledWith('2026-11-01', '2026-11-30');
    expect(JSON.parse(localStorage.getItem('dienstplaner.planen.ansicht')!).zeitraum).toEqual({
      art: 'monat',
      monat: '2026-11',
    });
    fireEvent.click(screen.getByRole('button', { name: 'Zeitraum davor' }));
    fireEvent.click(screen.getByRole('button', { name: 'Zeitraum davor' }));
    expect(laden).toHaveBeenLastCalledWith('2026-09-01', '2026-09-30');
    // Dieselben Knöpfe wie „ab heute“ gibt es dann nicht – kein „＋“.
    expect(screen.queryByRole('button', { name: 'Späteren Termin dazunehmen' })).toBeNull();
  });

  it('eigener Zeitraum: „Anzeigen“ erst bei gültigen Tagen; › schiebt um die eigene Länge', async () => {
    const laden = vi.fn(() => Promise.resolve(daten()));
    zeigeZ(laden);
    fireEvent.click(knopf());
    const anzeigen = screen.getByRole('button', { name: 'Anzeigen' });
    fireEvent.change(screen.getByLabelText('von'), { target: { value: '2026-11-10' } });
    fireEvent.change(screen.getByLabelText('bis'), { target: { value: '2026-10-20' } });
    expect(anzeigen).toHaveProperty('disabled', true);
    fireEvent.change(screen.getByLabelText('bis'), { target: { value: '2026-11-30' } });
    expect(anzeigen).toHaveProperty('disabled', false);
    fireEvent.click(anzeigen);
    expect(laden).toHaveBeenLastCalledWith('2026-11-10', '2026-11-30');
    expect(
      await screen.findByRole('button', { name: /^Zeitraum: 10\.11\. – 30\.11\.2026,/ }),
    ).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Zeitraum danach' }));
    expect(laden).toHaveBeenLastCalledWith('2026-12-01', '2026-12-21');
  });

  it('eine späte Antwort für einen schon verlassenen Zeitraum zählt nicht', async () => {
    const offen: Record<string, (d: Daten) => void> = {};
    zeigeZ((von) => new Promise<Daten>((r) => (offen[von] = r)));
    waehle(/^Dieser Monat/);
    fireEvent.click(screen.getByRole('button', { name: 'Zeitraum danach' }));
    await act(async () => offen['2026-11-01'](daten()));
    expect(spaltenNamen()).toHaveLength(4);
    await act(async () => offen['2026-10-01'](daten(planAus(ROH2.slice(1, 2), OPT2))));
    expect(spaltenNamen()).toHaveLength(4);
    expect(knopf().getAttribute('aria-label')).toBe('Zeitraum: November 2026, 4 Termine');
  });

  it('Ladefehler → Fehlerkasten, „Erneut versuchen“ lädt denselben Zeitraum noch einmal', async () => {
    const laden = vi
      .fn<(von: string, bis: string) => Promise<Daten>>()
      .mockRejectedValueOnce(new Error('weg'))
      .mockResolvedValue(daten());
    zeigeZ(laden);
    waehle(/^Dieser Monat/);
    fireEvent.click(await screen.findByRole('button', { name: 'Erneut versuchen' }));
    expect(laden).toHaveBeenCalledTimes(2);
    expect(laden).toHaveBeenLastCalledWith('2026-10-01', '2026-10-31');
    expect(await screen.findByRole('table')).toBeTruthy();
  });

  it('leerer Monat bzw. Zeitraum → sagt es mit dem Zeitraum', async () => {
    zeigeZ(() => Promise.resolve(daten({ spalten: [], gruppen: [] })));
    waehle(/^Nächster Monat/);
    expect(await screen.findByText('Im November 2026 stehen keine Termine an.')).toBeTruthy();
  });
});

describe('Planen – „ab heute“ lädt am Ende selbst nach (14.10.2026)', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    localStorage.clear();
  });

  const ZWEI = planAus(ROH2.slice(0, 2), OPT2);
  const fertig = (plan: Plan, wochen: number, nachladeFehler?: Fehlermeldung): TermineZustand => ({
    art: 'fertig',
    zeilen: [],
    plan,
    wochen,
    nachladeFehler,
  });
  function zeigeN(handy = false) {
    const onMehr = vi.fn();
    const el = (zustand: TermineZustand, mehrMoeglich = true) => (
      <Planen
        zustand={zustand}
        handy={handy}
        onNochmal={() => {}}
        onMehr={onMehr}
        {...ZUSATZ}
        mehrMoeglich={mehrMoeglich}
      />
    );
    const r = render(el(fertig(ZWEI, 8)));
    return { onMehr, neu: (z: TermineZustand, m = true) => r.rerender(el(z, m)) };
  }
  const weiter = () => screen.getByRole('button', { name: 'Einen Termin weiter' });

  it('› am letzten Termin lädt nach und geht dann einen weiter; solange steht „wird geladen“ da', () => {
    schmal();
    const { onMehr, neu } = zeigeN();
    fireEvent.click(weiter());
    expect(onMehr).not.toHaveBeenCalled(); // noch nicht am Ende
    fireEvent.click(weiter());
    expect(onMehr).toHaveBeenCalledTimes(1);
    expect(spaltenNamen()).toEqual(['Gebetsabend']);
    expect(knopf().textContent).toContain('weitere Termine werden geladen …');
    expect(weiter()).toHaveProperty('disabled', true);
    neu(fertig(PLAN2, 16));
    expect(spaltenNamen()).toEqual(['Gottesdienst']);
    expect(knopf().getAttribute('aria-label')).toBe(
      'Zeitraum: 25.10.2026, 1 Termin · passend zur Fensterbreite',
    );
  });

  it('kommt nichts dazu, wird weitergeladen (lange Lücke) – Schluss erst an der Ladegrenze', () => {
    schmal();
    const { onMehr, neu } = zeigeN();
    fireEvent.click(weiter());
    fireEvent.click(weiter());
    expect(onMehr).toHaveBeenCalledTimes(1);
    neu(fertig(ZWEI, 16)); // acht Wochen ohne Termin
    expect(onMehr).toHaveBeenCalledTimes(2);
    neu(fertig(ZWEI, 52), false); // Grenze erreicht, immer noch nichts
    expect(onMehr).toHaveBeenCalledTimes(2);
    expect(weiter()).toHaveProperty('disabled', true);
    expect(knopf().textContent).not.toContain('wird geladen');
  });

  it('Nachladefehler ist kein Ende: Fehlerkasten, › bleibt, „Erneut versuchen“ lädt wieder', () => {
    schmal();
    const { onMehr, neu } = zeigeN();
    fireEvent.click(weiter());
    fireEvent.click(weiter());
    neu(fertig(ZWEI, 8, { text: 'ChurchTools antwortet gerade nicht.', nochmal: true }));
    expect(onMehr).toHaveBeenCalledTimes(1); // kein stilles Wiederholen nach einem Fehler
    expect(screen.getByText('ChurchTools antwortet gerade nicht.')).toBeTruthy();
    expect(weiter()).toHaveProperty('disabled', false);
    fireEvent.click(screen.getByRole('button', { name: 'Erneut versuchen' }));
    expect(onMehr).toHaveBeenCalledTimes(2);
  });

  it('am Handy lädt der letzte Datums-Chip nach', () => {
    const { onMehr } = zeigeN(true);
    const chips = within(screen.getByRole('group', { name: 'Termine' })).getAllByRole('button');
    expect(onMehr).not.toHaveBeenCalled();
    fireEvent.click(chips[chips.length - 1]);
    expect(onMehr).toHaveBeenCalledTimes(1);
  });
});

// ── Eintragen als Entwurf (E4-3-2) ───────────────────────────────────────────
describe('Planen – Entwürfe (E4-3-2)', () => {
  const laden = vi.mocked(ladeWerKann);
  afterEach(() => {
    laden.mockReset();
    localStorage.clear();
  });

  // Licht: Platz 1 belegt (Anna), Platz 2 frei; Ton: ein freier Platz ohne index.
  const PLAN4 = planAus(
    [
      {
        id: 20,
        name: 'Gottesdienst',
        startDate: '2026-11-08T09:00:00Z',
        endDate: '2026-11-08T10:30:00Z',
        eventServices: [
          { serviceId: 7, personId: 5, name: 'Anna Test', isAccepted: true, index: 1 },
          { serviceId: 7, personId: null, name: null, index: 2 },
          { serviceId: 6, personId: null, name: null },
        ],
      },
    ] as RohTermin[],
    {
      ichId: 1,
      dienste: DIENSTE,
      dienstgruppen: GRUPPEN,
      zeitzone: 'Europe/Berlin',
      planbar: (d) => d.dienstgruppeId === 3,
      ganzSichtbar: () => true,
    },
  );
  const TECHNIK = { id: 3, name: 'Technik', fuerAlle: false };
  const ALWIN = { personId: 1, name: 'Alwin' };
  const entwurf = (x: Partial<Entwurf> = {}): Entwurf => ({
    ort: { eventId: 20, serviceId: 7, index: 2 },
    ziel: { art: 'person', personId: 46, name: 'Ben Test' },
    modus: 'anfrage',
    gesehen: { art: 'frei' },
    von: ALWIN,
    zeit: '2026-10-14T20:00:00.000Z',
    version: 1,
    ...x,
  });
  const daten = (
    entwuerfe: Entwurf[] = [],
    schublade: Partial<Schublade> = {},
  ): EntwuerfeDaten => ({
    modul: 16,
    schubladen: new Map([[3, { gruppe: TECHNIK, kategorie: 30, stand: 'bereit', ...schublade }]]),
    entwuerfe: new Map(
      entwuerfe.map((e) => [`${e.ort.eventId}|${e.ort.serviceId}|${e.ort.index ?? '-'}`, e]),
    ),
    gruppeJe: new Map(
      entwuerfe.map((e) => [`${e.ort.eventId}|${e.ort.serviceId}|${e.ort.index ?? '-'}`, 3]),
    ),
  });
  /** Der Anschluss zum Anfassen – eine Stelle für alle Tests (jede neue Funktion kommt nur hier dazu). */
  const nachgebaut = (a: Partial<EntwurfAnschluss> = {}): EntwurfAnschluss => ({
    ich: ALWIN,
    laden: vi.fn(() => Promise.resolve(daten())),
    speichern: vi.fn(),
    entfernen: vi.fn(),
    einrichten: vi.fn(() => Promise.resolve()),
    senden: vi.fn(),
    hinweise: vi.fn(() => Promise.resolve(new Map())),
    anzahl: vi.fn(),
    termine: vi.fn(() => Promise.resolve(new Map())),
    ...a,
  });
  function zeige4(
    a: Partial<EntwurfAnschluss>,
    props: Partial<ComponentProps<typeof Planen>> = {},
  ) {
    const anschluss = nachgebaut(a);
    render(
      <Planen
        zustand={{ art: 'fertig', zeilen: [], plan: PLAN4, wochen: 8 }}
        handy={false}
        onNochmal={() => {}}
        onMehr={() => {}}
        {...ZUSATZ}
        entwuerfe={anschluss}
        {...props}
      />,
    );
    return anschluss;
  }
  const entwuerfeInMatrix = () =>
    screen.queryAllByTitle(/^Entwurf von/).map((e) => `${e.title}: ${e.textContent}`);

  it('Entwurf am freien Platz statt „frei“: eigener ohne Namen, fremder mit „von“, Gast und direkt als Schild', async () => {
    zeige4({
      laden: () =>
        Promise.resolve(
          daten([
            entwurf({ von: { personId: 19, name: 'Spike' }, modus: 'direkt' }),
            entwurf({
              ort: { eventId: 20, serviceId: 6, index: null },
              ziel: { art: 'gast', name: 'Max' },
            }),
            // An Platz 1 steht in ChurchTools Anna – dort zeigt die Matrix ChurchTools, nie einen Entwurf.
            entwurf({
              ort: { eventId: 20, serviceId: 7, index: 1 },
              ziel: { art: 'gast', name: 'Zoe' },
            }),
          ]),
        ),
    });
    await waitFor(() => expect(entwuerfeInMatrix()).toHaveLength(2));
    expect(entwuerfeInMatrix()).toEqual([
      'Entwurf von Spike – noch nicht gesendet: Ben TestdirektSpike',
      'Entwurf von Alwin – noch nicht gesendet: MaxGast',
    ]);
    // Platz 1 (in ChurchTools belegt) bleibt, wie er ist.
    expect(screen.getByText('Anna Test')).toBeTruthy();
  });

  it('ein veralteter Entwurf (beim Eintragen stand dort jemand) wird nicht gezeigt – ChurchTools gilt', async () => {
    zeige4({
      laden: () =>
        Promise.resolve(
          daten([
            entwurf({ gesehen: { art: 'anfrage', personId: 9 } }),
            // Ein gültiger daneben – erst wenn er dasteht, ist fertig geladen (sonst wäre [] geschenkt).
            entwurf({
              ort: { eventId: 20, serviceId: 6, index: null },
              ziel: { art: 'gast', name: 'Max' },
            }),
          ]),
        ),
    });
    await waitFor(() => expect(entwuerfeInMatrix()).toHaveLength(1));
    expect(entwuerfeInMatrix()).toEqual(['Entwurf von Alwin – noch nicht gesendet: MaxGast']);
    expect(
      within(zeileVon('Licht')).getByRole('button', { name: 'frei – Wer kann? (Platz 2 von 2)' }),
    ).toBeTruthy();
  });

  it('Eintragen: richtiger Platz (Termin, Dienst, index), Anfrage, „gesehen: frei“, von mir – dann Fach zu, Hinweis, Entwurf im Plan', async () => {
    laden.mockResolvedValue([{ person: { domainIdentifier: '46', title: 'Ben Test' }, score: 0 }]);
    const speichern = vi.fn(
      (_d: EntwuerfeDaten, _g: number, eingabe: Omit<Entwurf, 'zeit' | 'version'>) =>
        Promise.resolve({ ok: true as const, entwurf: { ...eingabe, zeit: 'jetzt', version: 1 } }),
    );
    zeige4({ speichern });
    const licht = within(zeileVon('Licht'));
    fireEvent.click(await licht.findByRole('button', { name: 'frei – Wer kann? (Platz 2 von 2)' }));
    fireEvent.click(await screen.findByRole('button', { name: /Ben Test/ }));
    await waitFor(() => expect(speichern).toHaveBeenCalled());
    expect(speichern.mock.calls[0].slice(1)).toEqual([
      3,
      {
        ort: { eventId: 20, serviceId: 7, index: 2 },
        ziel: { art: 'person', personId: 46, name: 'Ben Test' },
        modus: 'anfrage',
        gesehen: { art: 'frei' },
        von: ALWIN,
      },
      null,
    ]);
    expect(await screen.findByText('Ben Test eingetragen – noch nicht gesendet.')).toBeTruthy();
    expect(screen.queryByRole('list', { name: 'Wer kann?' })).toBeNull();
    expect(entwuerfeInMatrix()).toEqual(['Entwurf von Alwin – noch nicht gesendet: Ben Test']);
  });

  it('Konflikt: Was jetzt dasteht, zeigt die Matrix sofort; das Fach bleibt offen', async () => {
    laden.mockResolvedValue([{ person: { domainIdentifier: '46', title: 'Ben Test' }, score: 0 }]);
    const spike = entwurf({
      von: { personId: 19, name: 'Spike' },
      ziel: { art: 'gast', name: 'Max' },
      version: 2,
    });
    zeige4({ speichern: () => Promise.resolve({ ok: false, grund: 'konflikt', jetzt: spike }) });
    fireEvent.click(
      await within(zeileVon('Licht')).findByRole('button', {
        name: 'frei – Wer kann? (Platz 2 von 2)',
      }),
    );
    fireEvent.click(await screen.findByRole('button', { name: /Ben Test/ }));
    expect(await screen.findByRole('button', { name: 'Entwurf von Spike lassen' })).toBeTruthy();
    expect(entwuerfeInMatrix()).toEqual(['Entwurf von Spike – noch nicht gesendet: MaxGastSpike']);
  });

  it('Schublade einrichtbar: „Einrichten“ legt sie für DIESE Gruppe an und lädt danach neu', async () => {
    laden.mockResolvedValue([]);
    const a = zeige4({
      laden: vi.fn(() => Promise.resolve(daten([], { kategorie: null, stand: 'einrichtbar' }))),
    });
    await waitFor(() => expect(a.laden).toHaveBeenCalledTimes(1));
    fireEvent.click(
      await within(zeileVon('Ton')).findByRole('button', { name: /frei – Wer kann/ }),
    );
    fireEvent.click(await screen.findByRole('button', { name: 'Einrichten' }));
    await waitFor(() => expect(a.laden).toHaveBeenCalledTimes(2));
    expect(a.einrichten).toHaveBeenCalledWith(TECHNIK);
  });

  it('fehlt / nur lesen / Laden gescheitert → eigener Text, keine Knöpfe an den Personen; „Erneut versuchen“ lädt neu', async () => {
    laden.mockResolvedValue([{ person: { domainIdentifier: '46', title: 'Ben Test' }, score: 0 }]);
    const oeffne = async () =>
      fireEvent.click(
        await within(zeileVon('Ton')).findByRole('button', { name: /frei – Wer kann/ }),
      );
    for (const [s, text] of [
      [
        { kategorie: null, stand: 'fehlt' },
        /noch keinen Platz für Entwürfe – oder dir fehlt das Recht/,
      ],
      [{ stand: 'nur-lesen' }, /ansehen, aber nicht ändern/],
      [{ fehler: 'voruebergehend' }, /antwortet gerade nicht/],
    ] as const) {
      zeige4({ laden: () => Promise.resolve(daten([], s as Partial<Schublade>)) });
      await oeffne();
      expect(await screen.findByText(text)).toBeTruthy();
      await screen.findByRole('list', { name: 'Wer kann?' });
      expect(screen.queryByRole('button', { name: /Ben Test/ })).toBeNull();
      cleanup();
    }
    const nochmal = vi
      .fn()
      .mockRejectedValueOnce(new ApiError(503, 'weg'))
      .mockResolvedValueOnce(daten());
    zeige4({ laden: nochmal });
    await oeffne();
    fireEvent.click(await screen.findByRole('button', { name: 'Erneut versuchen' }));
    await waitFor(() => expect(nochmal).toHaveBeenCalledTimes(2));
    expect(await screen.findByRole('button', { name: /Ben Test/ })).toBeTruthy();
  });
  // ── E4-3-3: Entwürfe ändern, entfernen, Leiste, veraltet ──────────────────
  const SPIKE = { personId: 19, name: 'Spike' };
  const offenTexte = () =>
    screen.queryByRole('status', { name: 'Noch nicht gesendet' })?.textContent ?? null;

  it('Entwurf antippen öffnet das Fach – nur wo man die Schublade ändern darf', async () => {
    zeige4({ laden: () => Promise.resolve(daten([entwurf({ von: SPIKE })])) });
    fireEvent.click(await screen.findByRole('button', { name: /^Entwurf von Spike/ }));
    expect(screen.getByText(/^Eingetragen von Spike, /)).toBeTruthy();
    cleanup();
    zeige4({
      laden: () => Promise.resolve(daten([entwurf({ von: SPIKE })], { stand: 'nur-lesen' })),
    });
    await waitFor(() => expect(entwuerfeInMatrix()).toHaveLength(1));
    expect(screen.queryByRole('button', { name: /^Entwurf von Spike/ })).toBeNull();
  });

  it('veraltet: ChurchTools steht da, darunter das Schild; antippen → „Entwurf verwerfen“ mit Version, danach weg', async () => {
    const entfernen = vi.fn(() => Promise.resolve({ ok: true as const, entwurf: null }));
    zeige4({
      laden: () =>
        Promise.resolve(
          daten([entwurf({ ort: { eventId: 20, serviceId: 7, index: 1 }, version: 4 })]),
        ),
      entfernen,
    });
    const schild = await screen.findByRole('button', {
      name: 'Entwurf veraltet: „Ben Test“ von Alwin',
    });
    expect(screen.getByText('Anna Test')).toBeTruthy();
    fireEvent.click(schild);
    expect(screen.getByText(/Anna Test hat dort zugesagt\./)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Entwurf verwerfen' }));
    await waitFor(() =>
      expect(entfernen).toHaveBeenCalledWith(
        expect.anything(),
        3,
        { eventId: 20, serviceId: 7, index: 1 },
        4,
      ),
    );
    expect(await screen.findByText('Entwurf verworfen.')).toBeTruthy();
    expect(screen.queryByRole('button', { name: /^Entwurf veraltet/ })).toBeNull();
  });

  it('auch veraltet: Beim Eintragen stand dort jemand, inzwischen ist der Platz frei – Schild statt Entwurf', async () => {
    zeige4({
      laden: () => Promise.resolve(daten([entwurf({ gesehen: { art: 'anfrage', personId: 9 } })])),
    });
    expect(await screen.findByRole('button', { name: /^Entwurf veraltet/ })).toBeTruthy();
    expect(
      within(zeileVon('Licht')).getByRole('button', { name: 'frei – Wer kann? (Platz 2 von 2)' }),
    ).toBeTruthy();
  });

  it('„Direkt zuteilen“ im Fach speichert denselben Entwurf mit neuem Modus und seiner Version', async () => {
    const speichern = vi.fn(
      (
        _d: EntwuerfeDaten,
        _g: number,
        e: Omit<Entwurf, 'zeit' | 'version'>,
        _erwartet: number | null,
      ) => Promise.resolve({ ok: true as const, entwurf: { ...e, zeit: 'jetzt', version: 2 } }),
    );
    zeige4({ laden: () => Promise.resolve(daten([entwurf({ von: SPIKE })])), speichern });
    fireEvent.click(await screen.findByRole('button', { name: /^Entwurf von Spike/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Direkt zuteilen' }));
    await waitFor(() => expect(speichern).toHaveBeenCalled());
    expect(speichern.mock.calls[0].slice(1)).toEqual([
      3,
      {
        ort: { eventId: 20, serviceId: 7, index: 2 },
        ziel: { art: 'person', personId: 46, name: 'Ben Test' },
        modus: 'direkt',
        gesehen: { art: 'frei' },
        von: ALWIN,
      },
      1,
    ]);
    expect(await screen.findByText('Ben Test wird beim Senden direkt zugeteilt.')).toBeTruthy();
    expect(entwuerfeInMatrix()).toEqual([
      'Entwurf von Alwin – noch nicht gesendet: Ben Testdirekt',
    ]);
  });

  it('„Andere Person wählen“: „Wer kann?“ ersetzt mit der Version und behält „direkt“; danach ist ein neues Eintragen wieder ohne Version', async () => {
    laden.mockResolvedValue([{ person: { domainIdentifier: '47', title: 'Finn Test' }, score: 0 }]);
    const speichern = vi.fn(
      (
        _d: EntwuerfeDaten,
        _g: number,
        e: Omit<Entwurf, 'zeit' | 'version'>,
        _erwartet: number | null,
      ) => Promise.resolve({ ok: true as const, entwurf: { ...e, zeit: 'jetzt', version: 8 } }),
    );
    zeige4({
      laden: () => Promise.resolve(daten([entwurf({ modus: 'direkt', version: 7 })])),
      speichern,
    });
    fireEvent.click(await screen.findByRole('button', { name: /^Entwurf von Alwin/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Andere Person wählen' }));
    fireEvent.click(await screen.findByRole('button', { name: /^Finn Test/ }));
    await waitFor(() => expect(speichern).toHaveBeenCalledTimes(1));
    expect(speichern.mock.calls[0][2]).toMatchObject({
      ziel: { art: 'person', personId: 47, name: 'Finn Test' },
      modus: 'direkt',
    });
    expect(speichern.mock.calls[0][3]).toBe(7);
    // Ein anderer freier Platz danach: wieder neu (ohne Version), nicht „ersetzen“.
    fireEvent.click(
      await within(zeileVon('Ton')).findByRole('button', { name: /frei – Wer kann/ }),
    );
    fireEvent.click(await screen.findByRole('button', { name: /^Finn Test/ }));
    await waitFor(() => expect(speichern).toHaveBeenCalledTimes(2));
    expect(speichern.mock.calls[1][3]).toBeNull();
    expect(speichern.mock.calls[1][2]).toMatchObject({ modus: 'anfrage' });
  });

  it('„Wer kann?“ zum Ersetzen geschlossen → das nächste Eintragen ist wieder neu', async () => {
    laden.mockResolvedValue([{ person: { domainIdentifier: '47', title: 'Finn Test' }, score: 0 }]);
    const speichern = vi.fn(() => Promise.resolve({ ok: true as const, entwurf: null }));
    zeige4({ laden: () => Promise.resolve(daten([entwurf({ version: 7 })])), speichern });
    fireEvent.click(await screen.findByRole('button', { name: /^Entwurf von Alwin/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Andere Person wählen' }));
    await screen.findByRole('button', { name: /^Finn Test/ });
    fireEvent.click(screen.getByRole('button', { name: 'Schließen' }));
    fireEvent.click(
      await within(zeileVon('Ton')).findByRole('button', { name: /frei – Wer kann/ }),
    );
    fireEvent.click(await screen.findByRole('button', { name: /^Finn Test/ }));
    await waitFor(() => expect(speichern).toHaveBeenCalledTimes(1));
    expect((speichern.mock.calls[0] as unknown[])[3]).toBeNull();
  });

  it('Leiste: zählt nur gültige Entwürfe, Einzahl/Mehrzahl, am Handy kurz; ohne Entwürfe keine Leiste', async () => {
    zeige4({
      laden: () =>
        Promise.resolve(
          daten([
            entwurf(),
            entwurf({
              ort: { eventId: 20, serviceId: 6, index: null },
              ziel: { art: 'gast', name: 'Max' },
            }),
            entwurf({ ort: { eventId: 20, serviceId: 7, index: 1 } }), // veraltet – zählt nicht
          ]),
        ),
    });
    await waitFor(() =>
      expect(offenTexte()).toBe('2 Entwürfe noch nicht gesendetAnsehen und senden'),
    );
    cleanup();
    zeige4({ laden: () => Promise.resolve(daten([entwurf()])) });
    await waitFor(() => expect(offenTexte()).toMatch(/^1 Entwurf noch nicht gesendet/));
    cleanup();
    const a = nachgebaut({ laden: () => Promise.resolve(daten([entwurf()])) });
    render(
      <Planen
        zustand={{ art: 'fertig', zeilen: [], plan: PLAN4, wochen: 8 }}
        handy
        onNochmal={() => {}}
        onMehr={() => {}}
        {...ZUSATZ}
        entwuerfe={a}
      />,
    );
    await waitFor(() => expect(offenTexte()).toBe('1 EntwurfAnsehen & senden'));
    cleanup();
    const leer = zeige4({});
    await waitFor(() => expect(leer.laden).toHaveBeenCalled());
    await screen.findAllByRole('button', { name: /frei – Wer kann/ });
    expect(offenTexte()).toBeNull();
  });

  // ── E4-4-2: Senden-Fach ──────────────────────────────────────────────────
  /** Senden, das alles schafft – und dabei jeden Eintrag meldet wie der Kern. */
  const gesendet = () =>
    vi.fn(
      (
        _d: EntwuerfeDaten,
        eintraege: readonly unknown[],
        melde: (i: number, r: SendeErgebnis) => void,
      ) => {
        const r = eintraege.map((_, i): SendeErgebnis => {
          melde(i, { art: 'gesendet' });
          return { art: 'gesendet' };
        });
        return Promise.resolve(r);
      },
    );

  it('„Ansehen und senden“ öffnet das Fach mit genau den gezählten Entwürfen (eine Regel), samt Kategorie', async () => {
    const senden = gesendet();
    zeige4({
      laden: () =>
        Promise.resolve(
          daten([entwurf(), entwurf({ ort: { eventId: 20, serviceId: 7, index: 1 } })]), // 2. veraltet
        ),
      senden,
    });
    await waitFor(() => expect(offenTexte()).toMatch(/^1 Entwurf/));
    fireEvent.click(screen.getByRole('button', { name: 'Ansehen und senden' }));
    expect(screen.getAllByRole('checkbox').map((c) => c.getAttribute('aria-label'))).toEqual([
      'Anfrage an Ben Test – Licht',
    ]);
    fireEvent.click(await screen.findByRole('button', { name: 'Jetzt senden (1)' }));
    await screen.findByText('Gesendet');
    expect(senden.mock.calls[0][1]).toEqual([{ entwurf: entwurf(), kategorie: 30 }]);
  });

  it('ohne Änderungsrecht auf die Schublade: keine Leiste – ein Entwurf ließe sich nach dem Senden nicht entfernen', async () => {
    const a = zeige4({
      laden: vi.fn(() => Promise.resolve(daten([entwurf()], { stand: 'nur-lesen' }))),
    });
    await waitFor(() => expect(a.laden).toHaveBeenCalled());
    await screen.findAllByRole('button', { name: /frei – Wer kann/ });
    expect(offenTexte()).toBeNull();
  });

  it('nach dem Senden: Entwürfe und Termine neu (ab heute über den Aufrufer); Abbrechen lädt nichts', async () => {
    const onAktualisieren = vi.fn();
    const laden = vi.fn(() => Promise.resolve(daten([entwurf()])));
    zeige4({ laden, senden: gesendet() }, { onAktualisieren });
    await waitFor(() => expect(offenTexte()).toMatch(/^1 Entwurf/));
    fireEvent.click(screen.getByRole('button', { name: 'Ansehen und senden' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Abbrechen' }));
    expect(laden).toHaveBeenCalledTimes(1);
    expect(onAktualisieren).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Ansehen und senden' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Jetzt senden (1)' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Schließen' }));
    await waitFor(() => expect(laden).toHaveBeenCalledTimes(2));
    expect(onAktualisieren).toHaveBeenCalledTimes(1);
  });

  it('nach dem Senden im gewählten Monat: denselben Zeitraum neu laden – leise, die Matrix bleibt stehen', async () => {
    localStorage.setItem(
      'dienstplaner.planen.ansicht',
      JSON.stringify({ zeitraum: { art: 'monat', monat: '2026-11' } }),
    );
    let antwort: ((d: { zeilen: []; plan: Plan }) => void) | null = null;
    const ladeZeitraum = vi
      .fn<(von: string, bis: string) => Promise<{ zeilen: []; plan: Plan }>>()
      .mockResolvedValueOnce({ zeilen: [], plan: PLAN4 })
      .mockImplementation(() => new Promise((r) => (antwort = r)));
    const onAktualisieren = vi.fn();
    zeige4(
      { laden: () => Promise.resolve(daten([entwurf()])), senden: gesendet() },
      { ladeZeitraum, onAktualisieren },
    );
    await waitFor(() => expect(offenTexte()).toMatch(/^1 Entwurf/));
    fireEvent.click(screen.getByRole('button', { name: 'Ansehen und senden' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Jetzt senden (1)' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Schließen' }));
    await waitFor(() => expect(ladeZeitraum).toHaveBeenCalledTimes(2));
    expect(ladeZeitraum).toHaveBeenLastCalledWith('2026-11-01', '2026-11-30');
    expect(onAktualisieren).not.toHaveBeenCalled();
    // Noch keine Antwort – die Matrix steht weiter da (kein „wird geladen“).
    expect(screen.getAllByRole('button', { name: /frei – Wer kann/ }).length).toBeGreaterThan(0);
    await act(async () => antwort!({ zeilen: [], plan: PLAN4 }));
  });

  // ── E4-5-2: belegter Platz – zurückziehen oder ersetzen ─────────────────────
  const ANNA_KNOPF = 'Anna Test – zugesagt: zurückziehen oder ersetzen';
  const gespeichert = () =>
    vi.fn((_d: EntwuerfeDaten, _g: number, e: Omit<Entwurf, 'version' | 'zeit'>) =>
      Promise.resolve({
        ok: true as const,
        entwurf: { ...e, zeit: '2026-10-15T10:00:00.000Z', version: 1 },
      }),
    );

  it('Belegten Platz antippen → Fenster; „Zurückziehen“ speichert „frei“ mit dem, was jetzt dort steht', async () => {
    const speichern = gespeichert();
    zeige4({ speichern });
    fireEvent.click(await screen.findByRole('button', { name: ANNA_KNOPF }));
    expect(screen.getByText(/– hat zugesagt\./)).toBeTruthy();
    expect(screen.getByText(/ChurchTools sagt Anna Test nicht Bescheid/)).toBeTruthy();
    expect(
      screen.getByText(/Anna Test bekommt von ChurchTools „Du wurdest … ausgetragen“/),
    ).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Zurückziehen' }));
    await waitFor(() => expect(speichern).toHaveBeenCalledTimes(1));
    expect(speichern.mock.calls[0].slice(1)).toEqual([
      3,
      {
        ort: { eventId: 20, serviceId: 7, index: 1 },
        ziel: { art: 'frei' },
        modus: 'anfrage',
        gesehen: { art: 'zusage', personId: 5 },
        von: ALWIN,
      },
      null,
    ]);
    expect(
      await screen.findByText('Anna Test wird beim Senden zurückgezogen – noch nicht gesendet.'),
    ).toBeTruthy();
    // Danach steht dort der Entwurf (rot, durchgestrichen) statt des Knopfs.
    expect(
      screen.getByRole('button', { name: 'Entwurf von Alwin: Anna Test zurückziehen' }),
    ).toBeTruthy();
    expect(screen.queryByRole('button', { name: ANNA_KNOPF })).toBeNull();
  });

  it('„Andere Person wählen“ → „Wer kann?“ mit „statt“; der Entwurf merkt sich, wer dort stand', async () => {
    laden.mockResolvedValue([{ person: { domainIdentifier: '46', title: 'Ben Test' }, score: 0 }]);
    const speichern = gespeichert();
    zeige4({ speichern });
    fireEvent.click(await screen.findByRole('button', { name: ANNA_KNOPF }));
    fireEvent.click(screen.getByRole('button', { name: 'Andere Person wählen' }));
    expect(await screen.findByText(/· statt Anna Test/)).toBeTruthy();
    fireEvent.click(await screen.findByRole('button', { name: /^Ben Test/ }));
    await waitFor(() => expect(speichern).toHaveBeenCalledTimes(1));
    expect((speichern.mock.calls[0][2] as Entwurf).gesehen).toEqual({ art: 'zusage', personId: 5 });
    expect(
      await screen.findByText('Ben Test statt Anna Test eingetragen – noch nicht gesendet.'),
    ).toBeTruthy();
    expect(
      screen.getByRole('button', { name: 'Entwurf von Alwin: Ben Test statt Anna Test' }),
    ).toBeTruthy();
  });

  it('liegt dort ein veralteter Entwurf, ist der Platz kein Knopf – erst den Entwurf verwerfen (Schild)', async () => {
    zeige4({
      laden: () =>
        Promise.resolve(daten([entwurf({ ort: { eventId: 20, serviceId: 7, index: 1 } })])),
    });
    expect(await screen.findByRole('button', { name: /^Entwurf veraltet/ })).toBeTruthy();
    expect(screen.queryByRole('button', { name: ANNA_KNOPF })).toBeNull();
  });

  it('Konflikt beim Zurückziehen (eben hat jemand einen Entwurf angelegt) → sagt es, Fenster bleibt', async () => {
    const speichern = vi.fn(() =>
      Promise.resolve({ ok: false as const, grund: 'konflikt' as const, jetzt: null }),
    );
    zeige4({ speichern });
    fireEvent.click(await screen.findByRole('button', { name: ANNA_KNOPF }));
    fireEvent.click(screen.getByRole('button', { name: 'Zurückziehen' }));
    expect((await screen.findByRole('alert')).textContent).toMatch(/eben jemand einen Entwurf/);
    expect(screen.getByRole('button', { name: 'Zurückziehen' })).toBeTruthy();
  });

  it('nicht antippbar: wo man nicht plant, bei verborgenem Namen – und ohne Änderungsrecht nur der Hinweis', async () => {
    const roh = (personId: number, name: string) =>
      [
        {
          id: 20,
          name: 'Gottesdienst',
          startDate: '2026-11-08T09:00:00Z',
          endDate: '2026-11-08T10:30:00Z',
          eventServices: [{ serviceId: 7, personId, name, isAccepted: true, index: null }],
        },
      ] as RohTermin[];
    const opt = (planbar: boolean) => ({
      ichId: 1,
      dienste: DIENSTE,
      dienstgruppen: GRUPPEN,
      zeitzone: 'Europe/Berlin',
      planbar: () => planbar,
      ganzSichtbar: () => true,
    });
    const anzeigen = (plan: Plan, laden = () => Promise.resolve(daten()), handy = false) =>
      render(
        <Planen
          zustand={{ art: 'fertig', zeilen: [], plan, wochen: 8 }}
          handy={handy}
          onNochmal={() => {}}
          onMehr={() => {}}
          {...ZUSATZ}
          entwuerfe={nachgebaut({ laden })}
        />,
      );
    anzeigen(planAus(roh(5, 'Anna Test'), opt(false)));
    // Was man nicht plant, ist zugeklappt – aufklappen, dann steht Anna da, aber nicht antippbar.
    fireEvent.click(await screen.findByRole('button', { name: /Technik/, expanded: false }));
    expect(await screen.findByText('Anna Test')).toBeTruthy();
    expect(screen.queryByRole('button', { name: /zurückziehen oder ersetzen/ })).toBeNull();
    cleanup();
    // Am Handy dieselbe Regel (eigene Stelle im Code) – erst mit Planrecht antippbar.
    anzeigen(planAus(roh(5, 'Anna Test'), opt(true)), undefined, true);
    expect(await screen.findByRole('button', { name: /^Anna Test – zugesagt/ })).toBeTruthy();
    cleanup();
    anzeigen(planAus(roh(5, 'Anna Test'), opt(false)), undefined, true);
    fireEvent.click(await screen.findByRole('button', { name: /Technik/, expanded: false }));
    expect(await screen.findByText('Anna Test')).toBeTruthy();
    expect(screen.queryByRole('button', { name: /zurückziehen oder ersetzen/ })).toBeNull();
    cleanup();
    anzeigen(planAus(roh(-2, 'Geheim'), opt(true)));
    expect(await screen.findByText('Nicht sichtbar')).toBeTruthy();
    expect(screen.queryByRole('button', { name: /zurückziehen oder ersetzen/ })).toBeNull();
    cleanup();
    anzeigen(planAus(roh(5, 'Anna Test'), opt(true)), () =>
      Promise.resolve(daten([], { stand: 'nur-lesen' })),
    );
    fireEvent.click(await screen.findByRole('button', { name: /^Anna Test – zugesagt/ }));
    await waitFor(() => expect(screen.getByText(/ansehen, aber nicht ändern/)).toBeTruthy());
    expect(screen.queryByRole('button', { name: 'Zurückziehen' })).toBeNull();
  });

  it('Senden-Fach: wer dort steht, kommt mit (aus derselben Matrix)', async () => {
    zeige4({
      laden: () =>
        Promise.resolve(
          daten([
            entwurf({
              ort: { eventId: 20, serviceId: 7, index: 1 },
              ziel: { art: 'frei' },
              gesehen: { art: 'zusage', personId: 5 },
            }),
          ]),
        ),
    });
    await waitFor(() => expect(offenTexte()).toMatch(/^1 Entwurf/));
    fireEvent.click(screen.getByRole('button', { name: 'Ansehen und senden' }));
    expect(screen.getByRole('checkbox', { name: 'Zurückziehen: Anna Test – Licht' })).toBeTruthy();
    expect(screen.getByText(/1 zurückgezogen/)).toBeTruthy();
  });

  // ── E4-5-3: Anzahl der Plätze (Regler) ───────────────────────────────────────
  it('Regler in der Gruppenzeile → Plätze-Fach; liegt an einem Dienst ein Entwurf, bleibt seine Zahl', async () => {
    zeige4({ laden: () => Promise.resolve(daten([entwurf()])) }); // Entwurf an Licht Platz 2
    await waitFor(() => expect(entwuerfeInMatrix()).toHaveLength(1));
    fireEvent.click(screen.getByRole('button', { name: 'Plätze Technik am So, 08.11. ändern' }));
    expect(screen.getByText('Technik · Plätze')).toBeTruthy();
    expect(screen.getByText('Gottesdienst · So, 08.11.')).toBeTruthy();
    expect(screen.getByLabelText('Licht: 2 Plätze')).toBeTruthy();
    expect(screen.getByLabelText('Ton: 1 Plätze')).toBeTruthy();
    // Licht: Entwurf an Platz 2 → weder weniger noch mehr (ChurchTools nummeriert die Plätze sonst neu).
    for (const k of ['Licht: ein Platz weniger', 'Licht: ein Platz mehr']) {
      expect(screen.getByRole('button', { name: k })).toHaveProperty('disabled', true);
    }
    expect(screen.getByText(/Hier liegt ein Entwurf/)).toBeTruthy();
    cleanup();
    // Auch ein Entwurf an einem belegten Platz (zurückziehen) sperrt die Zahl.
    zeige4({
      laden: () =>
        Promise.resolve(
          daten([
            entwurf({
              ort: { eventId: 20, serviceId: 7, index: 1 },
              ziel: { art: 'frei' },
              gesehen: { art: 'zusage', personId: 5 },
            }),
          ]),
        ),
    });
    expect(
      await screen.findByRole('button', { name: 'Entwurf von Alwin: Anna Test zurückziehen' }),
    ).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Plätze Technik am So, 08.11. ändern' }));
    expect(screen.getByRole('button', { name: 'Licht: ein Platz mehr' })).toHaveProperty(
      'disabled',
      true,
    );
    expect(screen.getByRole('button', { name: 'Ton: ein Platz weniger' })).toHaveProperty(
      'disabled',
      false,
    );
  });

  it('„+“ speichert über den Anschluss (Termin, Dienst, gesehen, neu); Schließen lädt die Termine leise neu', async () => {
    const onAktualisieren = vi.fn();
    const anzahl = vi.fn(() => Promise.resolve({ ok: true as const, anzahl: 2 }));
    zeige4({ anzahl }, { onAktualisieren });
    fireEvent.click(
      await screen.findByRole('button', { name: 'Plätze Technik am So, 08.11. ändern' }),
    );
    fireEvent.click(screen.getByRole('button', { name: 'Ton: ein Platz mehr' }));
    await waitFor(() => expect(anzahl).toHaveBeenCalledWith(20, 6, 1, 2));
    expect(await screen.findByText('Ton: jetzt 2 Plätze.')).toBeTruthy();
    expect(onAktualisieren).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Schließen' }));
    expect(onAktualisieren).toHaveBeenCalledTimes(1);
  });

  it('im Plätze-Fach nur die Dienste, die man plant (Planrecht je Dienst)', async () => {
    const plan = planAus(
      [
        {
          id: 20,
          name: 'Gottesdienst',
          startDate: '2026-11-08T09:00:00Z',
          endDate: '2026-11-08T10:30:00Z',
          eventServices: [
            { serviceId: 7, personId: null, name: null, index: null },
            { serviceId: 6, personId: null, name: null, index: null },
          ],
        },
      ] as RohTermin[],
      {
        ichId: 1,
        dienste: DIENSTE,
        dienstgruppen: GRUPPEN,
        zeitzone: 'Europe/Berlin',
        planbar: (d) => d.id === 7,
        ganzSichtbar: () => true,
      },
    );
    render(
      <Planen
        zustand={{ art: 'fertig', zeilen: [], plan, wochen: 8 }}
        handy={false}
        onNochmal={() => {}}
        onMehr={() => {}}
        {...ZUSATZ}
        entwuerfe={nachgebaut()}
      />,
    );
    fireEvent.click(
      await screen.findByRole('button', { name: 'Plätze Technik am So, 08.11. ändern' }),
    );
    expect(screen.getByLabelText('Licht: 1 Plätze')).toBeTruthy();
    expect(screen.queryByLabelText('Ton: 1 Plätze')).toBeNull();
  });

  it('kein Regler, wo man nicht plant und an abgesagten Terminen; ohne Änderung kein Neuladen', async () => {
    const roh = (abgesagt: boolean) =>
      [
        {
          id: 20,
          name: 'Gottesdienst',
          startDate: '2026-11-08T09:00:00Z',
          endDate: '2026-11-08T10:30:00Z',
          isCanceled: abgesagt,
          eventServices: [{ serviceId: 7, personId: null, name: null, index: null }],
        },
      ] as RohTermin[];
    const opt = (planbar: boolean) => ({
      ichId: 1,
      dienste: DIENSTE,
      dienstgruppen: GRUPPEN,
      zeitzone: 'Europe/Berlin',
      planbar: () => planbar,
      ganzSichtbar: () => true,
    });
    const anzeigen = (plan: Plan, handy = false, onAktualisieren = vi.fn()) => {
      render(
        <Planen
          zustand={{ art: 'fertig', zeilen: [], plan, wochen: 8 }}
          handy={handy}
          onNochmal={() => {}}
          onMehr={() => {}}
          {...ZUSATZ}
          entwuerfe={nachgebaut()}
          onAktualisieren={onAktualisieren}
        />,
      );
      return onAktualisieren;
    };
    const regler = () => screen.queryAllByRole('button', { name: /^Plätze .* ändern$/ });
    anzeigen(planAus(roh(false), opt(false)));
    await screen.findAllByText('Gottesdienst');
    expect(regler()).toEqual([]);
    cleanup();
    anzeigen(planAus(roh(true), opt(true)));
    await screen.findAllByText('Gottesdienst');
    expect(regler()).toEqual([]);
    cleanup();
    // Am Handy dieselbe Regel (eigene Stelle im Code); Öffnen und ohne Änderung schließen lädt nichts neu.
    const neu = anzeigen(planAus(roh(false), opt(true)), true);
    fireEvent.click(await screen.findByRole('button', { name: /^Plätze Technik am .* ändern$/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Schließen' }));
    expect(neu).not.toHaveBeenCalled();
  });

  // ── #582: Entwürfe ohne Platz und alte Entwürfe ─────────────────────────────
  it('Platznummer passt nicht mehr → Schild „Entwurf ohne Platz“; antippen → Grund, verwerfen mit der Gruppe', async () => {
    const entfernen = vi.fn(() => Promise.resolve({ ok: true as const, entwurf: null }));
    zeige4({
      laden: () =>
        Promise.resolve(
          daten([
            entwurf({ ort: { eventId: 20, serviceId: 7, index: 3 } }), // Licht hat nur 1 und 2
            entwurf({ ort: { eventId: 20, serviceId: 6, index: 1 } }), // Ton: ein Platz ohne Nummer
            entwurf(), // Licht Platz 2 – den gibt es: kein Schild, sondern der Entwurf selbst
          ]),
        ),
      entfernen,
    });
    const schilder = await screen.findAllByRole('button', { name: /^Entwurf ohne Platz/ });
    expect(schilder).toHaveLength(2);
    expect(
      within(zeileVon('Licht')).getAllByRole('button', { name: /^Entwurf ohne Platz/ }),
    ).toHaveLength(1);
    fireEvent.click(schilder[0]);
    expect(screen.getByText(/Diesen Platz gibt es so nicht mehr/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Entwurf verwerfen' }));
    await waitFor(() => expect(entfernen).toHaveBeenCalledTimes(1));
    expect((entfernen.mock.calls[0] as unknown[]).slice(1)).toEqual([
      3,
      { eventId: 20, serviceId: 7, index: 3 },
      1,
    ]);
    // Ohne passenden Platz zählt er nicht als „noch nicht gesendet“ (wird nie gesendet) – nur der gültige.
    expect(offenTexte()).toMatch(/^1 Entwurf/);
  });

  it('Termin nicht geladen → nachfragen: gelöscht und vorbei sind „alt“, künftig und unbekannt nicht', async () => {
    const termine = vi.fn(() =>
      Promise.resolve(
        new Map<number, TerminStand>([
          [90, { art: 'da', name: 'Gottesdienst', tag: '2026-10-04' }],
          [91, { art: 'weg' }],
          [92, { art: 'da', name: 'Gottesdienst', tag: '2026-12-06' }],
          [93, { art: 'unbekannt' }],
        ]),
      ),
    );
    zeige4({
      laden: () =>
        Promise.resolve(
          daten(
            [90, 91, 92, 93].map((ev) =>
              entwurf({ ort: { eventId: ev, serviceId: 7, index: null } }),
            ),
          ),
        ),
      termine,
    });
    expect((await screen.findByRole('status', { name: 'Alte Entwürfe' })).textContent).toMatch(
      /^2 alte Entwürfe/,
    );
    expect(termine).toHaveBeenCalledWith([90, 91, 92, 93]);
    expect(termine).toHaveBeenCalledTimes(1);
  });

  it('Dienst gehört nicht mehr zum Termin → alt; „Alle verwerfen“ mit der Gruppe der Schublade, danach neu laden', async () => {
    const plan = planAus(
      [
        {
          id: 20,
          name: 'Gottesdienst',
          startDate: '2026-11-08T09:00:00Z',
          endDate: '2026-11-08T10:30:00Z',
          eventServices: [{ serviceId: 6, personId: null, name: null, index: null }],
        },
        {
          id: 21,
          name: 'Gebetsabend',
          startDate: '2026-11-12T17:00:00Z',
          endDate: '2026-11-12T18:00:00Z',
          eventServices: [{ serviceId: 7, personId: null, name: null, index: null }],
        },
      ] as RohTermin[],
      {
        ichId: 1,
        dienste: DIENSTE,
        dienstgruppen: GRUPPEN,
        zeitzone: 'Europe/Berlin',
        planbar: (d) => d.dienstgruppeId === 3,
        ganzSichtbar: () => true,
      },
    );
    const laden = vi.fn(() =>
      Promise.resolve(daten([entwurf({ ort: { eventId: 21, serviceId: 6, index: null } })])),
    );
    const entfernen = vi.fn(() => Promise.resolve({ ok: true as const, entwurf: null }));
    render(
      <Planen
        zustand={{ art: 'fertig', zeilen: [], plan, wochen: 8 }}
        handy={false}
        onNochmal={() => {}}
        onMehr={() => {}}
        {...ZUSATZ}
        entwuerfe={nachgebaut({ laden, entfernen })}
      />,
    );
    fireEvent.click(await screen.findByRole('button', { name: 'Ansehen' }));
    expect(
      screen.getByText(/Gebetsabend, Do, 12\.11\. – Dienst gehört nicht mehr zum Termin/),
    ).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Verwerfen' }));
    await waitFor(() => expect(entfernen).toHaveBeenCalledTimes(1));
    expect((entfernen.mock.calls[0] as unknown[]).slice(1)).toEqual([
      3,
      { eventId: 21, serviceId: 6, index: null },
      1,
    ]);
    fireEvent.click(await screen.findByRole('button', { name: 'Schließen' }));
    await waitFor(() => expect(laden).toHaveBeenCalledTimes(2));
  });

  it('alte Entwürfe nur aus Schubladen, die man ändern darf', async () => {
    const termine = vi.fn(() =>
      Promise.resolve(new Map<number, TerminStand>([[91, { art: 'weg' }]])),
    );
    const a = zeige4({
      laden: vi.fn(() =>
        Promise.resolve(
          daten([entwurf({ ort: { eventId: 91, serviceId: 7, index: null } })], {
            stand: 'nur-lesen',
          }),
        ),
      ),
      termine,
    });
    await waitFor(() => expect(termine).toHaveBeenCalled());
    await waitFor(() => expect(a.laden).toHaveBeenCalled());
    expect(screen.queryByRole('status', { name: 'Alte Entwürfe' })).toBeNull();
  });

  // ── Prüfung mit zwei Planern (16.10.2026): Funde a und b ─────────────────────
  it('a) Konflikt im Entwurfs-Fach → das Fach zeigt die neue Fassung, der Hinweis nennt sie', async () => {
    const SPIKE_X = { personId: 19, name: 'Spike' };
    const neu = entwurf({ von: SPIKE_X, modus: 'direkt', version: 2 });
    const entfernen = vi.fn(() =>
      Promise.resolve({ ok: false as const, grund: 'konflikt' as const, jetzt: neu }),
    );
    zeige4({ laden: () => Promise.resolve(daten([entwurf({ von: SPIKE_X })])), entfernen });
    fireEvent.click(await screen.findByRole('button', { name: /^Entwurf von Spike/ }));
    expect(
      screen.getByRole('button', { name: 'Anfrage senden' }).getAttribute('aria-pressed'),
    ).toBe('true');
    fireEvent.click(screen.getByRole('button', { name: 'Entfernen' }));
    expect((await screen.findByRole('alert')).textContent).toContain(
      'Spike hat diesen Entwurf eben geändert: Direkt zuteilen: Ben Test.',
    );
    expect(
      screen.getByRole('button', { name: 'Direkt zuteilen' }).getAttribute('aria-pressed'),
    ).toBe('true');
  });

  it('b) Senden ohne Erfolg, aber mit Konflikt → Entwürfe und Termine laden trotzdem neu', async () => {
    const onAktualisieren = vi.fn();
    const laden = vi.fn(() => Promise.resolve(daten([entwurf()])));
    const senden = vi.fn(
      (_d: EntwuerfeDaten, e: readonly unknown[], melde: (i: number, r: SendeErgebnis) => void) => {
        const r: SendeErgebnis = { art: 'nicht-gesendet', grund: 'konflikt' };
        e.forEach((_, i) => melde(i, r));
        return Promise.resolve(e.map(() => r));
      },
    );
    zeige4({ laden, senden }, { onAktualisieren });
    await waitFor(() => expect(offenTexte()).toMatch(/^1 Entwurf/));
    fireEvent.click(screen.getByRole('button', { name: 'Ansehen und senden' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Jetzt senden (1)' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Schließen' }));
    await waitFor(() => expect(laden).toHaveBeenCalledTimes(2));
    expect(onAktualisieren).toHaveBeenCalledTimes(1);
  });
});
