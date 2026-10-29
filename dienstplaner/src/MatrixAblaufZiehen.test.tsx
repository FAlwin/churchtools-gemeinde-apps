// @vitest-environment jsdom
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { _bremseLoesen, _vergissCsrf } from '@ui/ct/verbindung';
import { Bereich, type Ablegen, type ZiehSpalte } from '@ui/ablauf/ablaufZiehen';
import { ABLAUF_GETEILT } from '@shared/ct/punktUebertragen';
import { planAus } from '@shared/dienstplan/plan';
import type { RohTermin } from '@shared/dienstplan/termine';
import { GESPERRT } from './ablaufAktionen';
import { startFuer } from './start.testutil';
import { Planen } from './Planen';

/**
 * **Ziehen zwischen Terminen in der Matrix** (E6-6b, Entwurf `e6-6-entwurf-2.html` Bild 3). Das Ziehen selbst (dnd-kit)
 * ist im Browser geprüft – in jsdom haben Elemente keine Maße. Hier wird der Zieh-Bereich durch einen ersetzt, der nur
 * mitschreibt: welche Spalten sich anmelden (mit ihren echten Punkten aus der Bearbeiten-Liste) und was die Matrix ihm
 * gibt (`darfAblegen`, `onAblegen`, `onHinweis`). Den Kern (`punktUebertragen`) prüft `punktUebertragen.test.ts`; hier
 * nur, dass die Matrix ihn richtig ruft, danach neu liest und „Rückgängig“ anbietet.
 */
const bereich = vi.hoisted(() => ({
  props: null as null | {
    darfAblegen: (von: number, nach: number) => true | string;
    onAblegen: (a: Ablegen) => void;
    onHinweis: (text: string) => void;
  },
  spalten: new Map<number, () => ZiehSpalte>(),
}));

vi.mock('@ui/ablauf/AblaufZiehBereich', async (echt) => ({
  ...(await echt<typeof import('@ui/ablauf/AblaufZiehBereich')>()),
  AblaufZiehBereich: (p: NonNullable<typeof bereich.props> & { children: ReactNode }) => {
    bereich.props = p;
    return (
      <Bereich.Provider
        value={{
          anmelden: (s, lies) => {
            bereich.spalten.set(s, lies);
            return () => {};
          },
          platz: null,
        }}
      >
        {p.children}
      </Bereich.Provider>
    );
  },
}));

const kern = vi.hoisted(() => ({ uebertragen: vi.fn(), zurueck: vi.fn() }));
vi.mock('@shared/ct/punktUebertragen', async (echt) => ({
  ...(await echt<typeof import('@shared/ct/punktUebertragen')>()),
  punktUebertragen: kern.uebertragen,
  uebertragenZuruecknehmen: kern.zurueck,
}));

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

const termin = (id: number, tag: string, kalender: string, name = 'Gottesdienst') => ({
  id,
  name,
  startDate: `${tag}T08:00:00Z`,
  calendar: { domainIdentifier: kalender },
  eventServices: [{ serviceId: 6, personId: null, name: null }],
});
const ROH = [
  termin(10, '2026-10-18', '2'), // Quelle
  termin(13, '2026-10-25', '2'), // Ziel
  termin(11, '2026-10-21', '5', 'Gebetsabend'), // nur ansehen (Kalender 5)
  termin(14, '2026-11-01', '2'), // abgeschlossen
  termin(15, '2026-11-08', '2'), // teilt den Ablauf mit 10
  termin(12, '2026-11-15', '2'), // kein Ablauf
] as RohTermin[];

const START = startFuer({ rechte: { ...startFuer().rechte, ablaufKalender: [2] } });
const PLAN = planAus(ROH, {
  ichId: 1,
  dienste: START.dienste,
  dienstgruppen: START.dienstgruppen,
  zeitzone: 'Europe/Berlin',
  planbar: () => true,
  ganzSichtbar: () => true,
});

const p = (id: number, title: string, termine: number[], vor = false) => ({
  id,
  title,
  type: 'normal',
  duration: 300,
  isBeforeEvent: vor,
  startTimes: Object.fromEntries(termine.map((t) => [String(t), '2026-10-18T08:00:00Z'])),
});
const ABLAEUFE: Record<string, unknown> = {
  10: {
    id: 70,
    isLocked: false,
    items: [
      p(1, 'Soundcheck', [10, 15], true),
      p(2, 'Begrüßung', [10, 15]),
      p(3, 'Lied', [10, 15]),
    ],
  },
  13: { id: 71, isLocked: false, items: [p(21, 'Gebet', [13]), p(22, 'Way Maker', [13])] },
  11: { id: 72, isLocked: false, items: [p(31, 'Lobpreis', [11])] },
  14: { id: 73, isLocked: true, items: [p(41, 'Segen', [14])] },
  15: {
    id: 70,
    isLocked: false,
    items: [
      p(1, 'Soundcheck', [10, 15], true),
      p(2, 'Begrüßung', [10, 15]),
      p(3, 'Lied', [10, 15]),
    ],
  },
};

function ct() {
  const gelesen: string[] = [];
  vi.spyOn(globalThis, 'fetch').mockImplementation((input) => {
    const url = new URL(String(input));
    const agenda = /^\/api\/events\/(\d+)\/agenda$/.exec(url.pathname);
    if (agenda) {
      gelesen.push(agenda[1]);
      const a = ABLAEUFE[agenda[1]];
      return Promise.resolve(a ? json(200, { data: a }) : json(404, { message: 'Not found.' }));
    }
    return Promise.resolve(json(200, { data: url.pathname.endsWith('/whoami') ? { id: 1 } : [] }));
  });
  return { gelesen };
}

async function bearbeiten() {
  const c = ct();
  render(
    <Planen
      zustand={{ art: 'fertig', zeilen: [], plan: PLAN, wochen: 8 }}
      handy={false}
      onNochmal={() => {}}
      onMehr={() => {}}
      mehrMoeglich={false}
      ladeZeitraum={() => new Promise<never>(() => {})}
      heute="2026-10-14"
      ablauf={{ start: START, zeitzone: 'Europe/Berlin' }}
    />,
  );
  await waitFor(() => expect(screen.getAllByText('3 Punkte').length).toBe(2));
  fireEvent.click(
    screen.getByRole('button', { name: 'Ablauf bearbeiten – alle gezeigten Termine' }),
  );
  await waitFor(() => expect(bereich.spalten.get(13)?.().items.length).toBe(2));
  return c;
}

/** Was die Matrix nach dem Loslassen bekommt – mit den echten Spalten der Bearbeiten-Listen. */
function ablegen(itemId: number, hinterId: number | null, vorBeginn = false): Ablegen {
  const quelle = bereich.spalten.get(10)!();
  const ziel = bereich.spalten.get(13)!();
  const hinter = hinterId === null ? null : ziel.items.find((i) => i.id === hinterId)!;
  return {
    von: 10,
    nach: 13,
    punkt: quelle.items.find((i) => i.id === itemId)!,
    hinter,
    ablage: { nachId: hinterId, vorBeginn },
    quelle,
    ziel,
  };
}

const ERGEBNIS = { art: 'verschieben', quelleId: 10, zielId: 13, neuId: 99, zurueck: null };

beforeEach(() => {
  _vergissCsrf();
  _bremseLoesen();
  localStorage.clear();
  bereich.props = null;
  bereich.spalten.clear();
  kern.uebertragen.mockReset();
  kern.zurueck.mockReset();
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('Matrix: wohin ein Punkt darf (E6-6b)', () => {
  it('nur in einen anderen Termin mit Ablauf, den man bearbeiten darf, offen und nicht geteilt', async () => {
    await bearbeiten();
    const darf = bereich.props!.darfAblegen;
    expect(darf(10, 13)).toBe(true);
    expect(darf(10, 12)).toMatch(/noch keinen Ablauf – erst „\+ Ablauf anlegen“/);
    expect(darf(10, 11)).toMatch(/nicht bearbeiten/);
    expect(darf(10, 14)).toBe(GESPERRT);
    expect(darf(14, 10)).toBe(GESPERRT);
    expect(darf(10, 15)).toBe(ABLAUF_GETEILT);
  });

  it('der Hinweis beim Loslassen steht unten', async () => {
    await bearbeiten();
    act(() => bereich.props!.onHinweis('Dieser Termin hat noch keinen Ablauf.'));
    expect(screen.getByText('Dieser Termin hat noch keinen Ablauf.')).toBeTruthy();
  });
});

describe('Matrix: Verschieben / Kopieren (E6-6b)', () => {
  it('fragt mit Termin und Stelle wie im Entwurf', async () => {
    await bearbeiten();
    act(() => bereich.props!.onAblegen(ablegen(3, 22)));
    const frage = screen.getByRole('alertdialog');
    expect(within(frage).getByText('„Lied“ verschieben?')).toBeTruthy();
    expect(
      within(frage).getByText('Vom So, 18.10. zum So, 25.10. – nach „Way Maker“.'),
    ).toBeTruthy();
    expect(
      within(frage).getByText('„Kopieren“ lässt ihn zusätzlich am So, 18.10. stehen.'),
    ).toBeTruthy();
    expect(
      within(frage)
        .getAllByRole('button')
        .map((b) => b.textContent),
    ).toEqual(expect.arrayContaining(['Abbrechen', 'Kopieren', 'Verschieben']));
  });

  it('ganz vorne: „ganz an den Anfang“; Abbrechen schreibt nichts', async () => {
    await bearbeiten();
    act(() => bereich.props!.onAblegen(ablegen(3, null, true)));
    expect(screen.getByText('Vom So, 18.10. zum So, 25.10. – ganz an den Anfang.')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Abbrechen' }));
    expect(screen.queryByRole('alertdialog')).toBeNull();
    expect(kern.uebertragen).not.toHaveBeenCalled();
  });

  it('Verschieben ruft den Kern, liest beide Termine neu und bietet in der Ziel-Spalte „Rückgängig“ an', async () => {
    const { gelesen } = await bearbeiten();
    kern.uebertragen.mockResolvedValue(ERGEBNIS);
    kern.zurueck.mockResolvedValue(undefined);
    act(() => bereich.props!.onAblegen(ablegen(3, 22)));
    const vorher = gelesen.length;
    fireEvent.click(
      within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Verschieben' }),
    );
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull());
    expect(kern.uebertragen).toHaveBeenCalledWith(expect.anything(), 'verschieben', 10, 3, 13, {
      nachId: 22,
      vorBeginn: false,
    });
    await waitFor(() => expect(gelesen.slice(vorher).sort()).toEqual(['10', '13']));

    expect(await screen.findByText('„Lied“ verschoben')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Rückgängig' }));
    await waitFor(() =>
      expect(kern.zurueck).toHaveBeenCalledWith(expect.anything(), ERGEBNIS, 'Lied'),
    );
    await waitFor(() => expect(gelesen.slice(vorher).sort()).toEqual(['10', '10', '13', '13']));
  });

  it('Kopieren: Art „kopieren“, Hinweis „kopiert“', async () => {
    await bearbeiten();
    kern.uebertragen.mockResolvedValue({ ...ERGEBNIS, art: 'kopieren' });
    act(() => bereich.props!.onAblegen(ablegen(2, 21, false)));
    fireEvent.click(
      within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Kopieren' }),
    );
    expect(await screen.findByText('„Begrüßung“ kopiert')).toBeTruthy();
    expect(kern.uebertragen).toHaveBeenCalledWith(expect.anything(), 'kopieren', 10, 2, 13, {
      nachId: 21,
      vorBeginn: false,
    });
  });

  it('nach einem Fehler: die Meldung und nur „OK“ – ein zweiter Versuch könnte doppelt anlegen; beide neu gelesen', async () => {
    const { gelesen } = await bearbeiten();
    kern.uebertragen.mockRejectedValue(new Error('„Lied“ steht jetzt in beiden Terminen.'));
    act(() => bereich.props!.onAblegen(ablegen(3, 22)));
    const vorher = gelesen.length;
    fireEvent.click(
      within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Verschieben' }),
    );
    const meldung = await screen.findByText('„Lied“ steht jetzt in beiden Terminen.');
    const frage = meldung.closest('[role="alertdialog"]') as HTMLElement;
    expect(
      within(frage)
        .getAllByRole('button')
        .map((b) => b.textContent),
    ).toEqual(['OK']);
    await waitFor(() => expect(gelesen.slice(vorher).sort()).toEqual(['10', '13']));
    fireEvent.click(within(frage).getByRole('button', { name: 'OK' }));
    expect(screen.queryByRole('alertdialog')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Rückgängig' })).toBeNull();
  });
});
