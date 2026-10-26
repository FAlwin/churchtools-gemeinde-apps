// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { neueEinstellungen } from '@shared/anmeldung/vorlagen';
import { SYSTEMFELDER } from '@shared/anmeldung/formular';
import { OHNE_EIGENEN_TEXT } from '@shared/anmeldung/ablaeufe';
import * as AB from './ablaeufe';
import * as E from './einrichten';
import * as R from './rundmail';
import { MailsFenster } from './MailsFenster';

/** Fenster „Mails“ (A9-2a): eigener Text je Mail, Absender aus der Leitung, Vorschau mit dem Text im Fenster. */
vi.mock('./ablaeufe', async (original) => ({
  ...(await original<typeof import('./ablaeufe')>()),
  ablaeufeEinrichten: vi.fn(),
  vorschauPerson: vi.fn(),
}));
vi.mock('./einrichten', async (original) => ({
  ...(await original<typeof import('./einrichten')>()),
  leitungsKandidaten: vi.fn(),
}));
vi.mock('./rundmail', async (original) => ({
  ...(await original<typeof import('./rundmail')>()),
  platzhalterLaden: vi.fn(),
  vorschauLaden: vi.fn(),
}));
const ab = vi.mocked(AB);
const ei = vi.mocked(E);
const ru = vi.mocked(R);

const STAND: AB.AblaufStand = {
  platz: true,
  warte: true,
  standardMail: false,
  absender: 'Anna Leitung',
  absenderId: 7,
  eigen: {
    platz: { betreff: '', absatz: 'Bitte Schlafsack mitbringen.', gruss: '' },
    warte: OHNE_EIGENEN_TEXT,
  },
};

let gespeichert: ReturnType<typeof vi.fn<(text: string) => void>>;
function zeigen(stand = STAND) {
  gespeichert = vi.fn<(text: string) => void>();
  render(
    <MailsFenster
      id={165}
      veranstaltung="Kinderfreizeit"
      e={neueEinstellungen('kinder')}
      stand={stand}
      onClose={() => {}}
      onGespeichert={gespeichert}
    />,
  );
}
const feld = (name: string) => screen.getByRole<HTMLTextAreaElement>('textbox', { name });

beforeEach(() => {
  vi.clearAllMocks();
  ei.leitungsKandidaten.mockResolvedValue([
    { personId: 4, name: 'Bea Team', leitung: false },
    { personId: 7, name: 'Anna Leitung', leitung: true },
    { personId: 9, name: 'Ben Leitung', leitung: true },
  ]);
  ab.ablaeufeEinrichten.mockResolvedValue();
  ab.vorschauPerson.mockResolvedValue({ personId: 41, echt: true });
  ru.platzhalterLaden.mockResolvedValue(
    new Map([
      ...SYSTEMFELDER.map((f, i): [string, string] => [f.name, `{{{groupMemberField.f${i}}}}`]),
      ['Wartelistenplatz', '{{{groupMember.waitinglistPosition}}}'],
    ]),
  );
  ru.vorschauLaden.mockResolvedValue({ betreff: 'B', html: '<p>gerendert</p>' });
});

describe('MailsFenster', () => {
  it('zeigt den gespeicherten Text; Standard-Betreff als Platzhalter; je Mail ein eigener Text', async () => {
    zeigen();
    expect(feld('Eigener Absatz (freiwillig)').value).toBe('Bitte Schlafsack mitbringen.');
    expect(feld('Betreff').getAttribute('placeholder')).toBe('Kinderfreizeit: Anmeldung bestätigt');
    fireEvent.click(screen.getByRole('button', { name: 'Warteliste' }));
    expect(feld('Eigener Absatz (freiwillig)').value).toBe('');
    expect(feld('Betreff').getAttribute('placeholder')).toBe('Kinderfreizeit: Warteliste');
  });

  it('Absender: nur die Leitung der Veranstaltung zur Wahl', async () => {
    zeigen();
    const wahl = screen.getByRole('combobox', { name: 'Absender' });
    await waitFor(() =>
      expect(
        within(wahl)
          .getAllByRole('option')
          .map((o) => o.textContent),
      ).toEqual(['Anna Leitung', 'Ben Leitung']),
    );
    expect((wahl as HTMLSelectElement).value).toBe('7');
  });

  it('Speichern: beide Texte und der gewählte Absender gehen an ablaeufeEinrichten', async () => {
    zeigen();
    fireEvent.click(screen.getByRole('button', { name: 'Warteliste' }));
    fireEvent.change(feld('Eigener Absatz (freiwillig)'), { target: { value: 'Wir melden uns.' } });
    const wahl = screen.getByRole('combobox', { name: 'Absender' });
    await waitFor(() => expect(within(wahl).getAllByRole('option')).toHaveLength(2));
    fireEvent.change(wahl, { target: { value: '9' } });
    fireEvent.click(screen.getByRole('button', { name: 'Speichern' }));
    await waitFor(() => expect(gespeichert).toHaveBeenCalledWith('Mails gespeichert.'));
    expect(ab.ablaeufeEinrichten).toHaveBeenCalledWith(165, 9, {
      platz: STAND.eigen.platz,
      warte: { betreff: '', absatz: 'Wir melden uns.', gruss: '' },
    });
  });

  it('zu lang: Hinweis statt Zähler, Speichern gesperrt', () => {
    zeigen();
    fireEvent.change(feld('Eigener Absatz (freiwillig)'), { target: { value: 'x'.repeat(1001) } });
    expect(screen.getByText(/zu lang \(\d+ Zeichen zu viel\)/)).toBeTruthy();
    expect(screen.getByRole<HTMLButtonElement>('button', { name: 'Speichern' }).disabled).toBe(
      true,
    );
  });

  it('Vorschau: rechnet ChurchTools mit dem Text, der gerade im Fenster steht – für eine echte Anmeldung', async () => {
    zeigen();
    fireEvent.change(feld('Eigener Absatz (freiwillig)'), {
      target: { value: 'Neu: Taschenlampe.' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Vorschau' }));
    await waitFor(() => expect(ru.vorschauLaden).toHaveBeenCalled());
    const [gruppe, person, betreff, html] = ru.vorschauLaden.mock.calls[0];
    expect([gruppe, person, betreff]).toEqual([165, 41, 'Kinderfreizeit: Anmeldung bestätigt']);
    expect(html).toContain('<p>Neu: Taschenlampe.</p>');
    expect(ab.vorschauPerson).toHaveBeenCalledWith(165, 'platz', 7);
    expect(await screen.findByTitle('Vorschau der Mail')).toBeTruthy();
  });
});
