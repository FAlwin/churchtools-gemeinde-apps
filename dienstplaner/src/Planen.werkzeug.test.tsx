// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { planAus } from '@shared/dienstplan/plan';
import { diensteAus } from '@shared/ct/dienste';
import type { RohTermin } from '@shared/dienstplan/termine';
import { mehrEintrag, mehrEintragOder, oeffneMehr } from './mehrMenue.testutil';

/**
 * **Die Werkzeugzeile von „Planen“** (R5/R6/R12, E9, „Ruhige Bedienung“ B3): wer wo steht, am Rechner und am Handy, und dass
 * jeder Eintrag im „⋯“-Menü etwas tut. (Die Eintrags-Wirkungen im Einzelnen – Erinnern, Teilen, Ablauf – prüfen die Tests
 * der jeweiligen Funktion; hier: dass sie vom Menü aus erreichbar sind und das Menü danach zu ist.)
 */
vi.mock('./PlanTeilenFenster', () => ({
  PlanTeilenFenster: ({ onClose }: { onClose: () => void }) => (
    <div role="dialog" aria-label="Plan teilen">
      <button type="button" onClick={onClose}>
        Zu
      </button>
    </div>
  ),
}));

const { Planen } = await import('./Planen');

const DIENSTE = diensteAus([
  { id: 1, name: 'Predigt', serviceGroupId: 1 },
  { id: 6, name: 'Ton', serviceGroupId: 3 },
]);
const ROH = [
  {
    id: 10,
    name: 'Gottesdienst',
    startDate: '2026-10-18T08:00:00Z',
    endDate: '2026-10-18T09:30:00Z',
    eventServices: [
      { serviceId: 6, personId: 5, name: 'Anna Test', isAccepted: true },
      { serviceId: 1, personId: null, name: null },
    ],
  },
  {
    id: 11,
    name: 'Gebetsabend',
    startDate: '2026-10-21T17:00:00Z',
    endDate: '2026-10-21T18:30:00Z',
    eventServices: [{ serviceId: 6, personId: null, name: null }],
  },
] as RohTermin[];
const PLAN = planAus(ROH, {
  ichId: 1,
  dienste: DIENSTE,
  dienstgruppen: [
    { id: 1, name: 'Programm', fuerAlle: false },
    { id: 3, name: 'Technik', fuerAlle: false },
  ],
  zeitzone: 'Europe/Berlin',
  planbar: () => true,
  ganzSichtbar: () => true,
});

function zeige(handy: boolean, onVorlagen: (() => void) | null = () => {}) {
  localStorage.setItem('dienstplaner.planen.ansicht', JSON.stringify({ unteransicht: 'matrix' }));
  return render(
    <Planen
      zustand={{ art: 'fertig', zeilen: [], plan: PLAN, wochen: 8 }}
      handy={handy}
      onNochmal={() => {}}
      onMehr={() => {}}
      mehrMoeglich={false}
      ladeZeitraum={() => new Promise<never>(() => {})}
      heute="2026-10-14"
      onVorlagen={onVorlagen ?? undefined}
    />,
  );
}
const zeile = () => screen.getByRole('toolbar', { name: 'Werkzeuge' });

beforeEach(() => localStorage.clear());
afterEach(cleanup);

describe('Planen – Werkzeugzeile am Rechner', () => {
  it('links die Ansichtswahl, in der Mitte der gerahmte Zeitraum, rechts Lupe (ohne Platz im Kopf hier), Filter und „Mehr“', () => {
    zeige(false);
    const knoepfe = within(zeile())
      .getAllByRole('button')
      .map((b) => b.getAttribute('aria-label') ?? b.textContent);
    expect(knoepfe).toEqual([
      'Matrix',
      'Personen',
      'Wer wie oft?',
      'Einen Termin zurück',
      expect.stringMatching(/^Zeitraum: /),
      'Einen Termin weiter',
      'Person hervorheben',
      'Filter',
      'Mehr',
    ]);
  });

  it('der Zeitraum ist EIN Element mit seinen Pfeilen; „＋“ stehen nicht mehr daneben, sondern im Zeitraum-Fenster', () => {
    zeige(false);
    const gruppe = screen.getByRole('group', { name: 'Zeitraum' });
    expect(within(gruppe).getAllByRole('button')).toHaveLength(3);
    expect(screen.queryByRole('button', { name: /dazunehmen/ })).toBeNull();
    fireEvent.click(within(gruppe).getByRole('button', { name: /^Zeitraum: / }));
    expect(screen.getByRole('button', { name: 'Früheren Termin dazunehmen' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Späteren Termin dazunehmen' })).toBeTruthy();
  });

  it('keine Knöpfe „Vorlagen“, „Erinnern“, „Teilen“, „?“ oder „Ablauf bearbeiten“ mehr in der Zeile – sie liegen im Menü, in dieser Reihenfolge, mit Linien dazwischen', () => {
    zeige(false);
    for (const name of [/Vorlagen/, /Erinnern/, /Teilen/, /^Hilfe/, /Ablauf bearbeiten/])
      expect(within(zeile()).queryByRole('button', { name })).toBeNull();
    const menue = oeffneMehr();
    // Ohne Anschluss „erinnern“ und ohne Ablauf gibt es nur diese Einträge – und nur die Linien, die Gruppen trennen.
    const eintraege = within(menue).getAllByRole('menuitem');
    expect(eintraege.map((e) => e.textContent)).toEqual(['Vorlagen', 'Teilen', 'Hilfe']);
    for (const e of eintraege) expect(e.querySelector('svg')).not.toBeNull();
  });

  it('jeder Eintrag wirkt, und das Menü ist danach zu: Vorlagen (Rückruf), Teilen und Hilfe (Fenster)', async () => {
    const vorlagen = vi.fn();
    zeige(false, vorlagen);
    mehrEintrag('Vorlagen');
    expect(vorlagen).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('menu', { name: 'Mehr' })).toBeNull();
    mehrEintrag('Teilen');
    expect(await screen.findByRole('dialog', { name: 'Plan teilen' })).toBeTruthy();
    expect(screen.queryByRole('menu', { name: 'Mehr' })).toBeNull();
    mehrEintrag('Hilfe');
    expect(screen.getByRole('dialog', { name: 'Hilfe · Planen' })).toBeTruthy();
  });

  it('ohne Anschluss „Vorlagen“ fehlt der Eintrag', () => {
    zeige(false, null);
    expect(mehrEintragOder('Vorlagen')).toBeNull();
    expect(mehrEintragOder('Teilen')).not.toBeNull();
  });

  it('der Filter-Knopf zählt aktive Filter, nicht die Anzeige (Breite Spalten)', () => {
    zeige(false);
    fireEvent.click(screen.getByRole('button', { name: 'Filter' }));
    const filter = within(screen.getByRole('dialog', { name: 'Filter' }));
    fireEvent.click(filter.getByRole('checkbox', { name: 'Breite Spalten' }));
    expect(screen.getByRole('button', { name: 'Filter' })).toBeTruthy();
    fireEvent.click(filter.getByRole('checkbox', { name: 'Programm' }));
    expect(screen.getByRole('button', { name: 'Filter, 1 ausgeblendet' })).toBeTruthy();
  });

  it('Personen und „Wer wie oft?“: dieselbe Zeile – ohne Anzeige-Abschnitt („Breite Spalten“ gibt es nur in der Matrix)', () => {
    zeige(false);
    const ansicht = within(screen.getByRole('group', { name: 'Ansicht' }));
    for (const name of ['Personen', 'Wer wie oft?']) {
      fireEvent.click(ansicht.getByRole('button', { name }));
      expect(screen.getByRole('toolbar', { name: 'Werkzeuge' })).toBeTruthy();
      expect(screen.getByRole('button', { name: 'Mehr' })).toBeTruthy();
      const knopf = screen.queryByRole('button', { name: /^Filter/ });
      if (knopf) {
        fireEvent.click(knopf);
        expect(screen.queryByRole('checkbox', { name: 'Breite Spalten' })).toBeNull();
        fireEvent.click(knopf);
      }
    }
  });
});

describe('Planen – Werkzeugzeile am Handy (E9, R12)', () => {
  it('oben ein Knopf mit der Ansicht (kein Umschalter), rechts Lupe, Filter, „Mehr“; darunter der Zeitraum', () => {
    zeige(true);
    expect(screen.queryByRole('group', { name: 'Ansicht' })).toBeNull();
    const knoepfe = within(zeile())
      .getAllByRole('button')
      .map((b) => b.getAttribute('aria-label') ?? b.textContent);
    expect(knoepfe).toEqual([
      'Ansicht: Matrix',
      'Person hervorheben',
      'Filter',
      'Mehr',
      expect.stringMatching(/^Zeitraum: /),
    ]);
  });

  it('die Ansichtswahl klappt die drei Ansichten auf – Personen wechselt die Ansicht und merkt sie', () => {
    zeige(true);
    fireEvent.click(screen.getByRole('button', { name: 'Ansicht: Matrix' }));
    const blatt = within(screen.getByRole('dialog', { name: 'Ansicht' }));
    expect(blatt.getAllByRole('button').map((b) => b.textContent)).toEqual(
      expect.arrayContaining(['Matrix', 'Personen', 'Wer wie oft?']),
    );
    fireEvent.click(blatt.getByRole('button', { name: 'Personen' }));
    expect(screen.getByRole('button', { name: 'Ansicht: Personen' })).toBeTruthy();
    expect(JSON.parse(localStorage.getItem('dienstplaner.planen.ansicht')!)).toMatchObject({
      unteransicht: 'raster',
    });
  });

  it('das „⋯“-Menü ist am Handy ein Blatt; jeder Eintrag wirkt und das Blatt ist danach zu', async () => {
    const vorlagen = vi.fn();
    zeige(true, vorlagen);
    expect(oeffneMehr().getAttribute('role')).toBe('dialog');
    fireEvent.click(
      within(screen.getByRole('dialog', { name: 'Mehr' })).getByRole('button', { name: 'Teilen' }),
    );
    expect(await screen.findByRole('dialog', { name: 'Plan teilen' })).toBeTruthy();
    expect(screen.queryByRole('dialog', { name: 'Mehr' })).toBeNull();
    mehrEintrag('Hilfe');
    expect(screen.getByRole('dialog', { name: 'Hilfe · Planen' })).toBeTruthy();
    mehrEintrag('Vorlagen');
    expect(vorlagen).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('dialog', { name: 'Mehr' })).toBeNull();
    // „Ablauf bearbeiten“ gibt es am Handy hier nicht (dort der Stift am Termin).
    expect(mehrEintragOder('Ablauf bearbeiten')).toBeNull();
  });

  it('am Handy keine „＋“-Zeilen im Zeitraum-Fenster (dort blättert die Datumsleiste)', () => {
    zeige(true);
    fireEvent.click(screen.getByRole('button', { name: /^Zeitraum: / }));
    expect(screen.queryByRole('button', { name: /dazunehmen/ })).toBeNull();
  });
});
