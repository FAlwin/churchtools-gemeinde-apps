// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { ApiError } from '@ui/ct/fehler';
import type { RohKandidat } from '@shared/dienstplan/werKann';
import type { PersonenAntworten } from '@shared/dienstplan/personenAntworten';
import { antwortBereinigt, type Zusage } from '@shared/dienstplan/verfuegbarkeit';
import type { AntwortenLader } from './ladeAntworten';
import { WerKann, type FreierPlatz } from './WerKann';
import { ladeWerKann } from './ladeWerKann';

vi.mock('./ladeWerKann', () => ({ ladeWerKann: vi.fn(), vergissWerKann: vi.fn() }));
const laden = vi.mocked(ladeWerKann);
afterEach(() => {
  cleanup();
  laden.mockReset();
});

/** E5c-4: „Wer kann?“ Variante A – Abschnitte, Zahlen, eingeklappt, Notiz, ohne Antworten wie früher. Antworten aus `antwortBereinigt`. */
const TON = 6;
const GESANG = 9;
const TECHNIK = 3;
const TERMIN = 166;
const PLATZ: FreierPlatz = {
  eventId: TERMIN,
  serviceId: TON,
  dienst: 'Ton',
  termin: 'Gottesdienst',
  tag: 'So 08.11.',
  uhrzeit: '10:00',
  monat: '2026-11',
  monatName: 'November',
  nr: 1,
  von: 2,
  schonDa: [9],
  index: 1,
  gruppeId: TECHNIK,
};
const k = (id: number, name: string, o: Partial<RohKandidat> = {}): RohKandidat => ({
  person: { domainIdentifier: String(id), title: name },
  score: 0,
  ...o,
});
const antw = (a: Zusage, extra: { notiz?: string; dienste?: number[] } = {}) => ({
  [TERMIN]: antwortBereinigt({ a, tag: '2026-11-08', ...extra }),
});
const DATEN: PersonenAntworten = {
  jePerson: new Map([
    [1, antw('ja')],
    [2, antw('vielleicht', { notiz: 'erst ab 10 Uhr' })],
    [3, antw('ja', { dienste: [GESANG] })], // nur für Gesang
    [5, antw('ja')], // abwesend trotz Ja
  ]),
  sichtbar: new Set([TECHNIK]),
};
const LISTE = [
  k(1, 'Anna'),
  k(2, 'Ben'),
  k(3, 'Clara'),
  k(4, 'David'),
  k(5, 'Eva', { score: -1000, absences: [{ absenceReason: { nameTranslated: 'Urlaub' } }] }),
  k(9, 'Schon Da'),
];
const dienstName = (id: number) => (id === GESANG ? 'Gesang' : undefined);
const zeige = (lader: AntwortenLader, liste = LISTE) => {
  laden.mockResolvedValue(liste);
  return render(<WerKann platz={PLATZ} onClose={() => {}} antworten={{ lader, dienstName }} />);
};
const abschnitt = (titel: string) => screen.getByRole('region', { name: titel });
const namen = (titel: string) =>
  within(abschnitt(titel))
    .queryAllByRole('listitem')
    .map((li) => li.querySelector('b')?.textContent);

describe('WerKann mit Antworten (E5c-4)', () => {
  it('Abschnitte mit Zahlen; „Kann nicht / abwesend“ ist eingeklappt und lässt sich aufklappen', async () => {
    zeige(() => Promise.resolve(DATEN));
    await screen.findByRole('region', { name: 'Hat Ja gesagt' });
    expect(namen('Hat Ja gesagt')).toEqual(['Anna']);
    expect(namen('Vielleicht')).toEqual(['Ben']);
    expect(namen('Keine Antwort')).toEqual(['David']);
    expect(abschnitt('Hat Ja gesagt').querySelector('h3')?.textContent).toBe('Hat Ja gesagt 1');
    expect(abschnitt('Vielleicht').querySelector('h3')?.textContent).toBe('Vielleicht 1');
    expect(abschnitt('Keine Antwort').querySelector('h3')?.textContent).toBe('Keine Antwort 1');
    const kopf = screen.getByRole('button', { name: /Kann nicht \/ abwesend 2/ });
    expect(kopf.getAttribute('aria-expanded')).toBe('false');
    expect(namen('Kann nicht / abwesend')).toEqual([]); // eingeklappt: keine Zeilen
    fireEvent.click(kopf);
    expect(kopf.getAttribute('aria-expanded')).toBe('true');
    expect(namen('Kann nicht / abwesend')).toEqual(['Clara', 'Eva']);
    expect(screen.getByText(/Die Antwort ersetzt nicht die Prüfung von ChurchTools/)).toBeTruthy();
  });

  it('die Notiz steht als zweite Zeile; „nur für Gesang“ und „abwesend trotz Ja“ ebenso', async () => {
    zeige(() => Promise.resolve(DATEN));
    await screen.findByRole('region', { name: 'Hat Ja gesagt' });
    fireEvent.click(screen.getByRole('button', { name: /Kann nicht/ }));
    const ben = within(abschnitt('Vielleicht')).getByRole('listitem');
    expect(ben.textContent).toBe('BenfreiVielleicht: „erst ab 10 Uhr“0× im November');
    const kannNicht = within(abschnitt('Kann nicht / abwesend')).getAllByRole('listitem');
    expect(kannNicht[0].textContent).toBe('ClarafreiJa – nur für Gesang0× im November');
    expect(kannNicht[1].textContent).toBe('Evaabwesend: UrlaubJa – aber abwesend0× im November');
  });

  it('Suche (ab 7 Kandidaten) filtert über alle Abschnitte, leere Abschnitte fallen weg, der eingeklappte zählt mit', async () => {
    const viele = [...LISTE.slice(0, 5), ...['Fritz', 'Gabi', 'Hans'].map((n, i) => k(20 + i, n))];
    zeige(() => Promise.resolve(DATEN), viele);
    const suche = await screen.findByRole('searchbox', { name: 'Name suchen' });
    fireEvent.change(suche, { target: { value: 'a' } }); // Anna, Clara, David, Eva, Gabi, Hans
    expect(screen.queryByRole('region', { name: 'Vielleicht' })).toBeNull(); // Ben passt nicht
    expect(namen('Hat Ja gesagt')).toEqual(['Anna']);
    expect(namen('Keine Antwort')).toEqual(['David', 'Gabi', 'Hans']);
    // Clara + Eva stehen im eingeklappten Abschnitt – die Zahl im Kopf zählt sie mit.
    expect(screen.getByRole('button', { name: /Kann nicht \/ abwesend 2/ })).toBeTruthy();
    fireEvent.change(suche, { target: { value: 'fritz' } });
    expect(screen.queryByRole('region', { name: 'Kann nicht / abwesend' })).toBeNull();
    expect(namen('Keine Antwort')).toEqual(['Fritz']);
  });

  it('Antworten dieser Dienstgruppe nicht sichtbar: die eine Liste wie bisher, nichts als „Keine Antwort“', async () => {
    zeige(() => Promise.resolve({ jePerson: new Map(), sichtbar: new Set() }));
    const liste = await screen.findByRole('list', { name: 'Wer kann?' });
    expect(screen.getByText('Wer kann? Oben: frei und selten dran')).toBeTruthy();
    expect(within(liste).getAllByRole('listitem')).toHaveLength(5);
    expect(screen.queryByRole('region')).toBeNull();
    expect(screen.queryByText(/gerade nicht geladen/)).toBeNull(); // kein Fehler, nur nicht sichtbar
  });

  it('ohne Lader (kein Plan-Recht): wie bisher, ohne Hinweis', async () => {
    laden.mockResolvedValue(LISTE);
    render(<WerKann platz={PLATZ} onClose={() => {}} />);
    await screen.findByRole('list', { name: 'Wer kann?' });
    expect(screen.queryByRole('region')).toBeNull();
  });

  it('Antworten scheitern vorübergehend: Liste trotzdem da, Hinweis, nie alle unter „Keine Antwort“', async () => {
    const lader = vi
      .fn<AntwortenLader>()
      .mockRejectedValueOnce(new ApiError(503, 'Gerade nicht'))
      .mockResolvedValueOnce(DATEN);
    zeige(lader);
    const liste = await screen.findByRole('list', { name: 'Wer kann?' });
    expect(within(liste).getAllByRole('listitem')).toHaveLength(5);
    expect(screen.queryByRole('region')).toBeNull();
    expect(screen.getByText(/Antworten aus „Wann kann ich\?“ gerade nicht geladen/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Nochmal versuchen' }));
    await screen.findByRole('region', { name: 'Hat Ja gesagt' });
    expect(screen.queryByText(/gerade nicht geladen/)).toBeNull();
  });

  it('401 bei den Antworten: die Liste steht trotzdem, der Hinweis ohne „Nochmal“', async () => {
    zeige(() => Promise.reject(new ApiError(401, 'abgemeldet')));
    await waitFor(() => expect(screen.getByRole('list', { name: 'Wer kann?' })).toBeTruthy());
    // 401: kein „Nochmal“ (nicht wiederholbar), aber der Hinweis steht.
    expect(screen.getByText(/gerade nicht geladen/)).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Nochmal versuchen' })).toBeNull();
  });

  it('lädt die Antworten der Dienstgruppe des Platzes', async () => {
    const lader = vi.fn<AntwortenLader>(() => Promise.resolve(DATEN));
    zeige(lader);
    await screen.findByRole('region', { name: 'Hat Ja gesagt' });
    expect(lader).toHaveBeenCalledWith([TECHNIK]);
  });
});
