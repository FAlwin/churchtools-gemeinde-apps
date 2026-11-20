// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { neueAufgabe, type Aufgabe } from '@shared/protokolle/aufgaben';
import type { ProtokollGruppe } from '@shared/protokolle/gruppen';
import * as L from './lesen';
import * as M from './mitglieder';
import { merkSchluessel } from './useToDoEinstellungen';
import { ToDos } from './ToDos';
import { gruppiereNach, imFilter, offenesFilter, ordneNach } from './todosFilter.testutil';

/**
 * Die Werkzeugzeile der To-Dos (B6, „Ruhige Bedienung“, Entwurf Organigramm/Protokolle v2): links die Ansicht, rechts Filter und
 * der eine grüne Knopf. „Spalten nach“, „Reihenfolge“ und „Nur meine“ liegen im Filter-Fenster – jede Wahl wird einzeln
 * angeklickt und im Gemerkten wiedergefunden (Lehre 05.08.2026: Aktion und Schließen dürfen sich nicht aufheben).
 */
vi.mock('./ToDoZiehen', () => ({
  ToDoZiehBereich: (p: { children: React.ReactNode }) => <div>{p.children}</div>,
  ZiehSpalte: (p: { children: React.ReactNode }) => <div>{p.children}</div>,
  ZiehKarte: (p: { children: React.ReactNode }) => <li>{p.children}</li>,
}));
vi.mock('./lesen', async (orig) => ({
  ...(await orig<typeof import('./lesen')>()),
  ladeUebersicht: vi.fn(),
}));
vi.mock('./mitglieder', () => ({ ladeGruppenMitglieder: vi.fn() }));
vi.mock('./useToDoEinstellungen', async (orig) =>
  (await import('./ohneAbgleich.testutil')).ohneAbgleich(orig),
);
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const LT: ProtokollGruppe = {
  id: 11,
  name: 'Leitungsteam',
  lage: 'eingerichtet',
  protokolle: 60,
  mitarbeit: 61,
};
const a = (id: string, t: Partial<Aufgabe> = {}): Aufgabe => ({
  ...neueAufgabe({ id, gruppe: 11, sitzung: null, text: id, von: 1, am: '2026-10-01T10:00:00Z' }),
  ...t,
});
const gemerkt = () =>
  JSON.parse(localStorage.getItem(merkSchluessel(1))!).felder as Record<string, { w: unknown }>;
const zeige = (schreibbar: number[] = [60]) =>
  render(
    <ToDos
      modul={24}
      ich={{ person: 1, name: 'Alwin' }}
      gruppen={[LT]}
      schreibbar={schreibbar}
      onSitzung={vi.fn()}
    />,
  );
/** Handy-Breite vortäuschen (`useMedienAbfrage(HANDY_BREITE)`). */
const handy = () =>
  vi.stubGlobal('matchMedia', (q: string) => ({
    matches: q.includes('max-width'),
    media: q,
    addEventListener: () => {},
    removeEventListener: () => {},
  }));

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  vi.mocked(L.ladeUebersicht).mockResolvedValue([
    {
      gruppe: LT,
      sitzungen: {
        kommend: [],
        protokolle: [],
        teile: [],
        kalender: 4,
        treffenNichtFreigegeben: false,
        punkte: 'vorschlagen',
      },
      aufgaben: [a('Eins', { wer: [1] }), a('Zwei', { wer: [23] })],
    },
  ]);
  vi.mocked(M.ladeGruppenMitglieder).mockResolvedValue([
    { id: 1, name: 'Alwin Friesen', bild: null, initialen: 'AF' },
    { id: 23, name: 'Johann Becker', bild: null, initialen: 'JB' },
  ]);
});

describe('Werkzeugzeile der To-Dos (B6)', () => {
  it('eine Zeile: Ansicht, Filter, ein grüner Knopf – kein Titel, keine Pillen, kein „Sortieren“ und „Gruppieren“', async () => {
    zeige();
    const zeile = await screen.findByRole('toolbar', { name: 'To-Dos' });
    const knoepfe = within(zeile)
      .getAllByRole('button')
      .map((k) => k.getAttribute('aria-label') ?? k.textContent);
    expect(knoepfe).toEqual(['Liste', 'Board', 'Filter', 'Neues To-Do – auch ohne Protokoll']);
    expect(screen.queryByRole('heading', { name: 'To-Dos' })).toBeNull();
    expect(screen.queryByRole('group', { name: 'Zuständigkeit' })).toBeNull();
    expect(screen.queryByRole('button', { name: /^(Sortieren|Gruppieren)/ })).toBeNull();
    // Genau ein gefüllter grüner Knopf (R1/R3).
    const gruen = screen
      .getAllByRole('button')
      .filter((k) => /(^|[\s_])neu([\s_]|$)/.test(k.className));
    expect(gruen.map((k) => k.getAttribute('aria-label'))).toEqual([
      'Neues To-Do – auch ohne Protokoll',
    ]);
  });

  it('Mitglied ohne Mitarbeit: kein grüner Knopf, der Rest der Zeile bleibt', async () => {
    vi.mocked(L.ladeUebersicht).mockResolvedValue([]);
    render(
      <ToDos
        modul={24}
        ich={{ person: 1, name: 'Alwin' }}
        gruppen={[{ ...LT, mitarbeit: null }]}
        schreibbar={[]}
        onSitzung={vi.fn()}
      />,
    );
    await screen.findByRole('toolbar', { name: 'To-Dos' });
    expect(screen.queryByRole('button', { name: /Neues To-Do/ })).toBeNull();
    expect(screen.getByRole('button', { name: 'Filter' })).toBeTruthy();
  });

  it.each([
    ['Dringlichkeit', 'dringlichkeit'],
    ['Bis-Datum', 'bis'],
    ['Alphabetisch', 'alpha'],
    ['Manuell', 'manuell'],
  ] as const)('Reihenfolge „%s“ im Filter: gemerkt, Wahl bleibt gesetzt', async (name, wert) => {
    // Erst auf etwas anderes, damit „Dringlichkeit“ (die Vorgabe) auch eine Änderung ist.
    localStorage.setItem(
      merkSchluessel(1),
      JSON.stringify({ v: 1, felder: { sortierung: { w: 'alpha', t: 1 } } }),
    );
    zeige();
    await screen.findByText('Eins');
    ordneNach(name);
    await waitFor(() => expect(gemerkt().sortierung.w).toBe(wert));
    expect(imFilter().getByRole('radio', { name })).toHaveProperty('checked', true);
  });

  it.each([
    ['Status', 'status'],
    ['Fälligkeit', 'frist'],
    ['Person', 'person'],
  ] as const)('Liste: „Gruppieren nach“ – „%s“ im Filter, gemerkt', async (name, wert) => {
    localStorage.setItem(
      merkSchluessel(1),
      JSON.stringify({
        v: 1,
        felder: { nach: { w: wert === 'status' ? 'person' : 'status', t: 1 } },
      }),
    );
    zeige();
    await screen.findByText('Eins');
    expect(offenesFilter().getByRole('group', { name: 'Gruppieren nach' })).toBeTruthy();
    gruppiereNach(name);
    await waitFor(() => expect(gemerkt().nach.w).toBe(wert));
  });

  it('Spalten nach, Reihenfolge und Zuständig zählen nicht als Filter – nur was ausgeblendet ist', async () => {
    zeige();
    await screen.findByText('Eins');
    gruppiereNach('Person');
    ordneNach('Alphabetisch');
    expect(screen.getByRole('button', { name: 'Filter' })).toBeTruthy();
    fireEvent.click(imFilter().getByLabelText('Andere'));
    expect(screen.getByRole('button', { name: /Filter, 1 ausgeblendet/ })).toBeTruthy();
  });

  it('Ansicht: Liste ↔ Board gemerkt; am Rechner ein Umschalter', async () => {
    zeige();
    await screen.findByText('Eins');
    fireEvent.click(screen.getByRole('button', { name: 'Board' }));
    await screen.findByRole('region', { name: 'To-Dos als Board' });
    await waitFor(() => expect(gemerkt().ansicht.w).toBe('board'));
    fireEvent.click(screen.getByRole('button', { name: 'Liste' }));
    expect(await screen.findByRole('region', { name: 'To-Dos' })).toBeTruthy();
    expect(screen.queryByRole('region', { name: 'To-Dos als Board' })).toBeNull();
  });

  describe('Handy', () => {
    beforeEach(handy);

    it('die Ansicht ist ein Knopf mit Blatt – Board gewählt, das Blatt geht zu und die Ansicht bleibt', async () => {
      zeige();
      await screen.findByText('Eins');
      expect(screen.queryByRole('button', { name: 'Board' })).toBeNull();
      fireEvent.click(screen.getByRole('button', { name: 'Ansicht: Liste' }));
      const blatt = screen.getByRole('dialog', { name: 'Ansicht' });
      fireEvent.click(within(blatt).getByRole('button', { name: 'Board' }));
      expect(screen.queryByRole('dialog', { name: 'Ansicht' })).toBeNull();
      expect(await screen.findByRole('region', { name: 'To-Dos als Board' })).toBeTruthy();
      expect(screen.getByRole('button', { name: 'Ansicht: Board' })).toBeTruthy();
    });

    it('Filter und „Neues To-Do“ stehen in der Zeile; „Neues To-Do“ öffnet sein Fenster', async () => {
      zeige();
      await screen.findByText('Eins');
      const zeile = screen.getByRole('toolbar', { name: 'To-Dos' });
      expect(within(zeile).getByRole('button', { name: 'Filter' })).toBeTruthy();
      fireEvent.click(within(zeile).getByRole('button', { name: /Neues To-Do/ }));
      expect(screen.getByRole('dialog', { name: 'Neues To-Do' })).toBeTruthy();
    });
  });
});
