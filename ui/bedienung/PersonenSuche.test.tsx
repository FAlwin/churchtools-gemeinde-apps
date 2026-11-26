// @vitest-environment jsdom
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { personenSuchen, type Gefunden } from '../ct/personen';
import { PersonenSuche } from './PersonenSuche';

vi.mock('../ct/personen', () => ({ personenSuchen: vi.fn() }));
const suchen = vi.mocked(personenSuchen);

const person = (personId: number, vor: string, nach: string): Gefunden => ({
  personId,
  vor,
  nach,
  geburtstag: null,
  email: null,
  adresse: null,
});
const K = { form: 'f', feld: 'e', liste: 'l', zeile: 'z', leer: 'n', fehler: 'x' };

beforeEach(() => suchen.mockReset());

function zeigen(extra: Partial<Parameters<typeof PersonenSuche>[0]> = {}) {
  const onWahl = vi.fn();
  render(
    <PersonenSuche
      klassen={K}
      onWahl={onWahl}
      zeile={(p) => <span>{`${p.vor} ${p.nach}`}</span>}
      {...extra}
    />,
  );
  return onWahl;
}
const tippen = (text: string, label = 'Name') =>
  fireEvent.change(screen.getByRole('searchbox', { name: label }), { target: { value: text } });

describe('PersonenSuche', () => {
  it('sucht erst ab zwei Zeichen, zeigt die Treffer und meldet die Wahl', async () => {
    suchen.mockResolvedValue([person(1, 'Hanna', 'Handtest'), person(2, 'Otto', 'Ohne')]);
    const onWahl = zeigen();
    tippen('H');
    expect(screen.getByRole('button', { name: 'Suchen' })).toHaveProperty('disabled', true);
    fireEvent.submit(screen.getByRole('searchbox').closest('form')!);
    expect(suchen).not.toHaveBeenCalled();
    tippen('Ha');
    fireEvent.click(screen.getByRole('button', { name: 'Suchen' }));
    const liste = await screen.findByRole('list', { name: 'Gefunden' });
    expect(suchen).toHaveBeenCalledWith('Ha');
    fireEvent.click(within(liste).getByRole('button', { name: 'Otto Ohne' }));
    expect(onWahl).toHaveBeenCalledWith(expect.objectContaining({ personId: 2 }));
  });

  it('gesperrte Treffer sind nicht wählbar; „Niemand gefunden.“ bei leerer Antwort', async () => {
    suchen.mockResolvedValueOnce([person(1, 'Hanna', 'Handtest')]);
    zeigen({ gesperrt: (p) => p.personId === 1 });
    tippen('Hanna');
    fireEvent.click(screen.getByRole('button', { name: 'Suchen' }));
    const knopf = await screen.findByRole('button', { name: 'Hanna Handtest' });
    expect(knopf).toHaveProperty('disabled', true);
    suchen.mockResolvedValueOnce([]);
    tippen('Nie');
    fireEvent.click(screen.getByRole('button', { name: 'Suchen' }));
    expect(await screen.findByText('Niemand gefunden.')).toBeTruthy();
  });

  it('Fehler von ChurchTools steht als Meldung da; `danach` bekommt den Suchtext', async () => {
    suchen.mockRejectedValueOnce(new Error('kaputt'));
    zeigen({ label: 'Person suchen', danach: (s) => <li>neu: {s}</li> });
    tippen('Hanna', 'Person suchen');
    fireEvent.click(screen.getByRole('button', { name: 'Suchen' }));
    expect(await screen.findByRole('alert')).toBeTruthy();
    suchen.mockResolvedValueOnce([]);
    fireEvent.click(screen.getByRole('button', { name: 'Suchen' }));
    await waitFor(() => expect(screen.queryByRole('alert')).toBeNull());
    expect(screen.getByText('neu: Hanna')).toBeTruthy();
  });
});

/**
 * **Die zweite Bedienart `beimTippen`** (Feld „Im Auftrag von“): kein Knopf, die Suche startet 300 ms nach dem letzten
 * Zeichen. Alle Zeitaufgaben laufen über Fake-Timer – mit echten Timern erledigte der Debounce die Arbeit, die diese Tests
 * ihm zuschreiben, und sie wären auch ohne ihn grün.
 */
describe('PersonenSuche – beim Tippen', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  const feld = (name = 'Name') => screen.getByRole('combobox', { name });
  const eingabe = (text: string) => fireEvent.change(feld(), { target: { value: text } });
  const warten = (ms: number) => act(() => vi.advanceTimersByTimeAsync(ms));
  /** Eine Antwort, die der Test selbst erfüllt – so lassen sich späte Antworten nachstellen. */
  function offen() {
    let erfuellen!: (t: Gefunden[]) => void;
    let ablehnen!: (e: unknown) => void;
    const zusage = new Promise<Gefunden[]>((ja, nein) => {
      erfuellen = ja;
      ablehnen = nein;
    });
    return { zusage, erfuellen, ablehnen };
  }

  it('hat keinen Suchknopf und sucht erst 300 ms nach dem letzten Zeichen (jedes Zeichen setzt die Wartezeit neu)', async () => {
    suchen.mockResolvedValue([person(1, 'Alwin', 'Friesen')]);
    zeigen({ beimTippen: true });
    expect(screen.queryByRole('button', { name: 'Suchen' })).toBeNull();
    eingabe('Al');
    await warten(299);
    expect(suchen).not.toHaveBeenCalled();
    eingabe('Alw');
    await warten(299);
    expect(suchen).not.toHaveBeenCalled();
    await warten(1);
    expect(suchen).toHaveBeenCalledTimes(1);
    expect(suchen).toHaveBeenCalledWith('Alw');
    expect(
      within(screen.getByRole('listbox', { name: 'Gefunden' })).getByText('Alwin Friesen'),
    ).toBeTruthy();
  });

  it('sucht erst ab zwei Zeichen und nimmt die Treffer weg, wenn der Text wieder kürzer wird', async () => {
    suchen.mockResolvedValue([person(1, 'Alwin', 'Friesen')]);
    zeigen({ beimTippen: true });
    eingabe('A');
    await warten(1000);
    expect(suchen).not.toHaveBeenCalled();
    eingabe('Al');
    await warten(300);
    expect(screen.getByRole('listbox')).toBeTruthy();
    eingabe('A');
    expect(screen.queryByRole('listbox')).toBeNull();
    eingabe('  ');
    await warten(1000);
    expect(suchen).toHaveBeenCalledTimes(1);
  });

  it('eine späte Antwort auf „Al“ überschreibt die Treffer für „Alwin“ nicht', async () => {
    const al = offen();
    const alwin = offen();
    suchen.mockReturnValueOnce(al.zusage).mockReturnValueOnce(alwin.zusage);
    zeigen({ beimTippen: true });
    eingabe('Al');
    await warten(300);
    eingabe('Alwin');
    await warten(300);
    expect(suchen.mock.calls.map((c) => c[0])).toEqual(['Al', 'Alwin']);
    await act(async () => alwin.erfuellen([person(1, 'Alwin', 'Friesen')]));
    await act(async () => al.erfuellen([person(2, 'Alina', 'Alt'), person(3, 'Albert', 'Alt')]));
    const liste = screen.getByRole('listbox');
    expect(
      within(liste)
        .getAllByRole('option')
        .map((o) => o.textContent),
    ).toEqual(['Alwin Friesen']);
  });

  it('ein später Fehler der alten Suche zeigt keine Meldung, und eine alte Antwort kommt nach kürzerem Text nicht mehr an', async () => {
    const al = offen();
    suchen.mockReturnValueOnce(al.zusage);
    zeigen({ beimTippen: true });
    eingabe('Al');
    await warten(300);
    eingabe('A');
    await act(async () => al.ablehnen(new Error('kaputt')));
    expect(screen.queryByRole('alert')).toBeNull();
    const spaet = offen();
    suchen.mockReturnValueOnce(spaet.zusage);
    eingabe('Ali');
    await warten(300);
    eingabe('A');
    await act(async () => spaet.erfuellen([person(2, 'Alina', 'Alt')]));
    expect(screen.queryByRole('listbox')).toBeNull();
  });

  it('Klick auf einen Treffer wählt ihn; gesperrte sind nicht wählbar; „Niemand gefunden.“ und `danach` stehen in der Liste', async () => {
    suchen.mockResolvedValueOnce([person(1, 'Hanna', 'Handtest'), person(2, 'Otto', 'Ohne')]);
    const onWahl = zeigen({
      beimTippen: true,
      gesperrt: (p) => p.personId === 1,
      danach: (t) => <li>neu: {t}</li>,
    });
    eingabe('Ha');
    await warten(300);
    fireEvent.click(screen.getByRole('option', { name: 'Hanna Handtest' }));
    expect(onWahl).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('option', { name: 'Otto Ohne' }));
    expect(onWahl).toHaveBeenCalledWith(expect.objectContaining({ personId: 2 }));
    expect(screen.getByText('neu: Ha')).toBeTruthy();
    suchen.mockResolvedValueOnce([]);
    eingabe('Nie');
    await warten(300);
    expect(screen.getByText('Niemand gefunden.')).toBeTruthy();
  });

  it('Fehler von ChurchTools steht als Meldung da', async () => {
    suchen.mockRejectedValueOnce(new Error('kaputt'));
    zeigen({ beimTippen: true });
    eingabe('Hanna');
    await warten(300);
    expect(screen.getByRole('alert')).toBeTruthy();
  });

  it('Tastatur: ↓/↑ wandern durch die Treffer, Enter wählt, Escape schließt nur die Liste', async () => {
    suchen.mockResolvedValue([
      person(1, 'Anna', 'Eins'),
      person(2, 'Berta', 'Zwei'),
      person(3, 'Clara', 'Drei'),
    ]);
    const onWahl = zeigen({ beimTippen: true });
    const amDokument = vi.fn();
    document.addEventListener('keydown', amDokument);
    eingabe('An');
    await warten(300);
    const aktiv = () =>
      screen
        .getAllByRole('option')
        .filter((o) => o.getAttribute('aria-selected') === 'true')
        .map((o) => o.textContent);
    expect(aktiv()).toEqual(['Anna Eins']);
    fireEvent.keyDown(feld(), { key: 'ArrowDown' });
    fireEvent.keyDown(feld(), { key: 'ArrowDown' });
    expect(aktiv()).toEqual(['Clara Drei']);
    fireEvent.keyDown(feld(), { key: 'ArrowDown' });
    expect(aktiv()).toEqual(['Anna Eins']);
    fireEvent.keyDown(feld(), { key: 'ArrowUp' });
    expect(aktiv()).toEqual(['Clara Drei']);
    expect(feld().getAttribute('aria-activedescendant')).toBe(
      screen.getByRole('option', { name: 'Clara Drei' }).id,
    );
    fireEvent.keyDown(feld(), { key: 'Enter' });
    expect(onWahl).toHaveBeenCalledWith(expect.objectContaining({ personId: 3 }));
    fireEvent.keyDown(feld(), { key: 'Escape' });
    expect(screen.queryByRole('listbox')).toBeNull();
    // Die Taste ging nicht weiter ans Fenster dahinter …
    expect(
      amDokument.mock.calls.filter((c) => (c[0] as KeyboardEvent).key === 'Escape'),
    ).toHaveLength(0);
    // … ohne offene Liste geht Escape wieder durch.
    fireEvent.keyDown(feld(), { key: 'Escape' });
    expect(
      amDokument.mock.calls.filter((c) => (c[0] as KeyboardEvent).key === 'Escape'),
    ).toHaveLength(1);
    // Neue Eingabe öffnet die Liste wieder.
    eingabe('Ann');
    await warten(300);
    expect(screen.getByRole('listbox')).toBeTruthy();
    document.removeEventListener('keydown', amDokument);
  });
});
