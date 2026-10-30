// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { neueAufgabe, type Aufgabe } from '@shared/protokolle/aufgaben';
import type { ProtokollGruppe } from '@shared/protokolle/gruppen';
import * as L from './lesen';
import * as M from './mitglieder';
import * as S from './aufgabenSchreiben';
import { MERK } from './useToDoEinstellungen';
import { ToDos } from './ToDos';

/**
 * Board der To-Dos (S7-3) – das Ziehen selbst ist eine Attrappe (was beim Loslassen geschieht, prüft
 * `ToDoZiehen.test.ts`); hier: was die Seite daraus macht (schreiben, nachfragen, merken).
 */
const zieh = vi.hoisted(() => ({
  ablegen: null as null | ((karte: string, von: string, nach: string) => void),
  umordnen: null as null | ((spalte: string, karte: string, vor: string | null) => void),
}));
vi.mock('./ToDoZiehen', () => ({
  ToDoZiehBereich: (p: {
    zwischen: boolean;
    children: React.ReactNode;
    onAblegen: typeof zieh.ablegen;
    onUmordnen: typeof zieh.umordnen;
  }) => {
    if (p.zwischen) zieh.ablegen = p.onAblegen;
    zieh.umordnen = p.onUmordnen;
    return <div>{p.children}</div>;
  },
  ZiehSpalte: (p: { children: React.ReactNode }) => <div>{p.children}</div>,
  ZiehKarte: (p: { children: React.ReactNode }) => <li>{p.children}</li>,
}));
vi.mock('./lesen', async (orig) => ({
  ...(await orig<typeof import('./lesen')>()),
  ladeUebersicht: vi.fn(),
}));
vi.mock('./mitglieder', () => ({ ladeGruppenMitglieder: vi.fn() }));
vi.mock('./aufgabenSchreiben', async (orig) => ({
  ...(await orig<typeof import('./aufgabenSchreiben')>()),
  aufgabeAendern: vi.fn(),
}));
afterEach(cleanup);

const LT: ProtokollGruppe = {
  id: 11,
  name: 'Leitungsteam',
  lage: 'eingerichtet',
  protokolle: 60,
  mitarbeit: 61,
};
const JG: ProtokollGruppe = {
  id: 194,
  name: 'Jugend',
  lage: 'eingerichtet',
  protokolle: 62,
  mitarbeit: 65,
};
const a = (id: string, t: Partial<Aufgabe> = {}): Aufgabe => ({
  ...neueAufgabe({ id, gruppe: 11, sitzung: null, text: id, von: 1, am: '2026-10-01T10:00:00Z' }),
  ...t,
});
const BEAMER = a('Beamer', { wer: [1] });
const ZEBRA = a('Zebra', { wer: [1] });
const ARBEIT = a('Abendmahl', { wer: [23], status: 'arbeit' });
const uebersicht = (lt: Aufgabe[]): L.GruppenUebersicht[] =>
  [LT, JG].map((gruppe, i) => ({
    gruppe,
    sitzungen: {
      kommend: [],
      protokolle: [],
      teile: [],
      kalender: 4,
      treffenNichtFreigegeben: false,
    },
    aufgaben: i === 0 ? lt : [],
  }));
/** Einstellungen vorab ins Gerät legen (wie zuletzt gemerkt). */
const merke = (w: Record<string, unknown>) =>
  localStorage.setItem(
    MERK,
    JSON.stringify({
      v: 1,
      felder: Object.fromEntries(Object.entries(w).map(([k, x]) => [k, { w: x, t: 1 }])),
    }),
  );
const gemerkt = () =>
  JSON.parse(localStorage.getItem(MERK)!).felder as Record<string, { w: unknown }>;
const zeige = (schreibbar = [60]) =>
  render(
    <ToDos
      modul={24}
      ich={{ person: 1, name: 'Alwin' }}
      gruppen={[LT, JG]}
      schreibbar={schreibbar}
      onSitzung={vi.fn()}
    />,
  );
const spalte = (name: string) => screen.getByRole('group', { name });
const karten = (name: string) =>
  within(spalte(name))
    .queryAllByRole('listitem')
    .map((li) => li.querySelector('button')?.textContent);

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  zieh.ablegen = null;
  zieh.umordnen = null;
  vi.mocked(L.ladeUebersicht).mockResolvedValue(uebersicht([ZEBRA, BEAMER, ARBEIT]));
  vi.mocked(M.ladeGruppenMitglieder).mockImplementation((g) =>
    Promise.resolve(
      g === 11
        ? [
            { id: 1, name: 'Alwin Friesen', bild: null, initialen: 'AF' },
            { id: 23, name: 'Johann Becker', bild: null, initialen: 'JB' },
          ]
        : 'verborgen',
    ),
  );
  vi.mocked(S.aufgabeAendern).mockImplementation((_o, id, f) =>
    Promise.resolve(f([ZEBRA, BEAMER, ARBEIT].find((x) => x.id === id)!)),
  );
});

describe('Board (S7-3)', () => {
  it('„Board“ gewählt und gemerkt; nach Status drei Spalten, „+ Neues To-Do“ belegt den Status vor', async () => {
    zeige();
    fireEvent.click(await screen.findByRole('button', { name: 'Board' }));
    expect(gemerkt().ansicht.w).toBe('board');
    await screen.findByRole('region', { name: 'To-Dos als Board' });
    expect(karten('Offen')).toEqual(['Beamer', 'Zebra']);
    expect(karten('In Arbeit')).toEqual(['Abendmahl']);
    expect(karten('Erledigt')).toEqual([]);
    fireEvent.click(within(spalte('In Arbeit')).getByRole('button', { name: 'Neues To-Do' }));
    const fenster = screen.getByRole('dialog', { name: 'Neues To-Do' });
    expect(
      within(fenster)
        .getByRole('button', { name: /In Arbeit/ })
        .getAttribute('aria-pressed'),
    ).toBe('true');
  });

  it('ablegen nach Status: sofort in der neuen Spalte, geschrieben über den einen Weg (mit Verlauf)', async () => {
    merke({ ansicht: 'board' });
    zeige();
    await screen.findByRole('region', { name: 'To-Dos als Board' });
    zieh.ablegen!('11:Beamer', 'offen', 'erledigt');
    await waitFor(() => expect(karten('Erledigt')).toEqual(['Beamer']));
    const [ort, id, f] = vi.mocked(S.aufgabeAendern).mock.calls[0];
    expect([ort, id]).toEqual([{ modul: 24, kategorie: 61 }, 'Beamer']);
    expect(f(BEAMER)).toMatchObject({
      status: 'erledigt',
      verlauf: [{}, { art: 'status', von: 1 }],
    });
  });

  it('scheitert das Schreiben: zurück in die alte Spalte, mit Meldung', async () => {
    merke({ ansicht: 'board' });
    vi.mocked(S.aufgabeAendern).mockRejectedValue(new Error('weg'));
    zeige();
    await screen.findByRole('region', { name: 'To-Dos als Board' });
    zieh.ablegen!('11:Beamer', 'offen', 'erledigt');
    expect(await screen.findByRole('alert')).toBeTruthy();
    expect(karten('Offen')).toEqual(['Beamer', 'Zebra']);
  });

  it('nach Person (Leitung): nur die gezogene Person tauschen, Verlauf „Zuständig“, keine Rückfrage', async () => {
    merke({ ansicht: 'board', nach: 'person', aus: { gruppen: ['194'], zustaendig: [] } });
    zeige();
    await screen.findByRole('region', { name: 'To-Dos als Board' });
    expect(screen.getByRole('group', { name: 'Johann Becker' })).toBeTruthy();
    zieh.ablegen!('11:Beamer', 'p1', 'p23');
    await waitFor(() => expect(S.aufgabeAendern).toHaveBeenCalled());
    expect(screen.queryByRole('alertdialog')).toBeNull();
    expect(vi.mocked(S.aufgabeAendern).mock.calls[0][2](BEAMER)).toMatchObject({
      wer: [23],
      verlauf: [{}, { art: 'zustaendig', vorher: [1], nachher: [23] }],
    });
  });

  it('Mitglied gibt sein eigenes To-Do ab: erst die Rückfrage; Abbrechen schreibt nichts, Abgeben schon', async () => {
    merke({ ansicht: 'board', nach: 'person', aus: { gruppen: ['194'], zustaendig: [] } });
    zeige([]); // nirgends Leitung
    await screen.findByRole('region', { name: 'To-Dos als Board' });
    zieh.ablegen!('11:Beamer', 'p1', 'p23');
    const frage = await screen.findByRole('alertdialog', { name: 'To-Do abgeben?' });
    expect(frage.textContent).toMatch(/Danach siehst du „Beamer“ nicht mehr/);
    fireEvent.click(within(frage).getByRole('button', { name: 'Abbrechen' }));
    expect(S.aufgabeAendern).not.toHaveBeenCalled();
    zieh.ablegen!('11:Beamer', 'p1', 'p23');
    fireEvent.click(await screen.findByRole('button', { name: 'An Johann Becker abgeben' }));
    await waitFor(() => expect(S.aufgabeAendern).toHaveBeenCalledTimes(1));
  });

  it('Mitglied legt sein To-Do zu „Noch niemand“: bleibt sichtbar – keine Rückfrage', async () => {
    merke({ ansicht: 'board', nach: 'person', aus: { gruppen: ['194'], zustaendig: [] } });
    zeige([]);
    await screen.findByRole('region', { name: 'To-Dos als Board' });
    zieh.ablegen!('11:Beamer', 'p1', 'ohne');
    await waitFor(() => expect(S.aufgabeAendern).toHaveBeenCalled());
    expect(screen.queryByRole('alertdialog')).toBeNull();
  });

  it('Sortieren: Wahl gemerkt; „Manuell“ ordnet nach meiner Reihenfolge, Umordnen merkt sie', async () => {
    merke({ ansicht: 'board' });
    zeige();
    await screen.findByRole('region', { name: 'To-Dos als Board' });
    fireEvent.click(screen.getByRole('button', { name: /Sortieren/ }));
    fireEvent.click(screen.getByRole('radio', { name: 'Manuell' }));
    expect(gemerkt().sortierung.w).toBe('manuell');
    expect(screen.getByRole('button', { name: 'Sortieren: Manuell' }).textContent).toMatch(
      /Manuell/,
    );
    zieh.umordnen!('offen', '11:Zebra', '11:Beamer');
    await waitFor(() => expect(karten('Offen')).toEqual(['Zebra', 'Beamer']));
    expect(gemerkt().reihenfolge.w).toEqual(['11:Zebra', '11:Beamer']);
  });

  it('Liste: „Alphabetisch“ gilt auch dort', async () => {
    merke({ sortierung: 'alpha' });
    vi.mocked(L.ladeUebersicht).mockResolvedValue(
      uebersicht([ZEBRA, a('apfel', { wer: [1] }), BEAMER]),
    );
    zeige();
    await screen.findByText('Zebra');
    const offen = within(screen.getByRole('group', { name: 'Offen' }))
      .getAllByRole('listitem')
      .map((li) => li.querySelector('button')?.textContent);
    expect(offen).toEqual(['apfel', 'Beamer', 'Zebra']);
  });
});
