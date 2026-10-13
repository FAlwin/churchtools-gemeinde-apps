// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { neueEinstellungen } from '@shared/anmeldung/vorlagen';
import type { OeffentlicheEinstellungen } from '@shared/anmeldung/formular';
import * as FF from './formularFelder';
import { FormularReiter } from './FormularReiter';

vi.mock('./formularFelder', async (original) => {
  const echt = await original<typeof import('./formularFelder')>();
  return {
    ...echt,
    feldSpeichern: vi.fn(),
    feldEntfernen: vi.fn(),
    reihenfolgeSpeichern: vi.fn(),
    ctFelderLesen: vi.fn(),
    antwortenZaehlen: vi.fn(),
  };
});
const m = vi.mocked(FF);

function mitShirt(): OeffentlicheEinstellungen {
  const e = neueEinstellungen('einfach');
  e.formular.person.push({
    id: 'f1',
    art: 'eigen',
    typ: 'select',
    frage: 'T-Shirt',
    hilfe: '',
    zustand: 'freiwillig',
    antworten: ['S', 'M'],
  });
  e.ctFelder = { ...e.ctFelder, f1: 501 };
  return e;
}

function zeigen(e = mitShirt(), darf = true) {
  const gespeichert = vi.fn();
  render(<FormularReiter id={91} einstellungen={e} darf={darf} onGespeichert={gespeichert} />);
  return gespeichert;
}

describe('Reiter „Formular“ (A5)', () => {
  it('feste Felder ohne „Bearbeiten“; Platzanzeige; ohne Recht keine Bausteine', () => {
    zeigen();
    const kontakt = screen.getByRole('region', { name: 'Einmal pro Anmeldung' });
    const zeilen = within(kontakt).getAllByRole('listitem');
    expect(within(zeilen[0]).queryByRole('button', { name: 'Bearbeiten' })).toBeNull(); // Name
    expect(within(zeilen[2]).getByRole('button', { name: 'Bearbeiten' })).toBeTruthy(); // Telefon
    expect(screen.getByText(/% belegt/)).toBeTruthy();
  });

  it('ohne Recht: lesen ja, Bausteine und Bearbeiten nein', () => {
    zeigen(mitShirt(), false);
    expect(screen.queryByRole('region', { name: 'Bausteine' })).toBeNull();
    expect(screen.queryAllByRole('button', { name: 'Bearbeiten' })).toHaveLength(0);
  });

  it('Baustein antippen → neues Feld im gewählten Bereich, gespeichert mit eigener Kennung', async () => {
    m.feldSpeichern.mockResolvedValue({} as never);
    const gespeichert = zeigen();
    fireEvent.click(screen.getByRole('button', { name: 'Einmal pro Anmeldung' }));
    fireEvent.click(screen.getByRole('button', { name: 'Ja / Nein' }));
    fireEvent.change(screen.getByLabelText('Frage'), {
      target: { value: 'Kommst du mit dem Auto?' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Speichern' }));
    await waitFor(() => expect(m.feldSpeichern).toHaveBeenCalled());
    const [id, bereich, feld] = m.feldSpeichern.mock.calls[0];
    expect([id, bereich]).toEqual([91, 'anmeldung']);
    expect(feld).toMatchObject({
      id: 'f2',
      art: 'eigen',
      typ: 'janein',
      frage: 'Kommst du mit dem Auto?',
    });
    await waitFor(() =>
      expect(gespeichert).toHaveBeenCalledWith('„Kommst du mit dem Auto?“ gespeichert.'),
    );
  });

  it('vorhandene Auswahl: Antworten mit ihren ChurchTools-IDs; entfernte gewählte Antwort → Hinweis „ausgeblendet“', async () => {
    m.ctFelderLesen.mockResolvedValue(
      new Map([
        [
          501,
          {
            id: 501,
            name: 'T-Shirt',
            options: [
              { id: '7', name: 'S' },
              { id: '8', name: 'M' },
            ],
          },
        ],
      ]),
    );
    m.antwortenZaehlen.mockResolvedValue(
      new Map([[501, { gesamt: 2, jeOption: new Map([['8', 2]]) }]]),
    );
    m.feldSpeichern.mockResolvedValue({} as never);
    zeigen();
    const person = screen.getByRole('region', { name: 'Für jede Person' });
    fireEvent.click(
      within(within(person).getAllByRole('listitem').at(-1)!).getByRole('button', {
        name: 'Bearbeiten',
      }),
    );
    expect(await screen.findByText(/2 Anmeldungen haben hier schon geantwortet/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: '+ Antwort' }));
    fireEvent.change(screen.getByLabelText('Antwort 3'), { target: { value: 'L' } });
    fireEvent.click(screen.getByRole('button', { name: 'Antwort 2 entfernen' }));
    expect(screen.getByText(/„M“ hat schon jemand gewählt/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Speichern' }));
    await waitFor(() => expect(m.feldSpeichern).toHaveBeenCalled());
    expect(m.feldSpeichern.mock.calls[0][3]).toEqual([
      { text: 'S', altId: '7' },
      { text: 'L', altId: undefined },
    ]);
    expect(screen.queryByRole('button', { name: 'Feld entfernen' })).toBeNull();
  });

  it('mit Antworten heißt der Knopf „Ausblenden“; das Ergebnis steht in der Leiste', async () => {
    m.ctFelderLesen.mockResolvedValue(new Map([[501, { id: 501, name: 'T-Shirt', options: [] }]]));
    m.antwortenZaehlen.mockResolvedValue(new Map([[501, { gesamt: 3, jeOption: new Map() }]]));
    m.feldEntfernen.mockResolvedValue({ art: 'ausgeblendet', antworten: 3 });
    const gespeichert = zeigen();
    const person = screen.getByRole('region', { name: 'Für jede Person' });
    fireEvent.click(
      within(within(person).getAllByRole('listitem').at(-1)!).getByRole('button', {
        name: 'Bearbeiten',
      }),
    );
    fireEvent.click(await screen.findByRole('button', { name: 'Ausblenden (Antworten bleiben)' }));
    await waitFor(() =>
      expect(gespeichert).toHaveBeenCalledWith(
        '„T-Shirt“ ausgeblendet – die 3 Antworten bleiben in ChurchTools.',
      ),
    );
  });

  it('verschieben: tauscht mit dem Nachbarn; feste Felder bleiben, wo sie sind', async () => {
    m.reihenfolgeSpeichern.mockResolvedValue();
    zeigen();
    fireEvent.click(screen.getByRole('button', { name: 'Bemerkungen nach oben' }));
    await waitFor(() => expect(m.reihenfolgeSpeichern).toHaveBeenCalled());
    expect(m.reihenfolgeSpeichern.mock.calls[0]).toEqual([
      91,
      'anmeldung',
      ['name', 'mail', 'note', 'tel', 'price', 'priv'],
    ]);
    expect(screen.queryByRole('button', { name: 'Name nach oben' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Telefon nach oben' })).toHaveProperty(
      'disabled',
      true,
    );
  });
});
