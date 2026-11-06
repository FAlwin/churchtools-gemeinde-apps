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
  aendereEinstellungen: vi.fn(),
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
    erinnerung: OHNE_EIGENEN_TEXT,
  },
  qr: false,
  loeschDatum: null,
  anmeldeschluss: null,
  erinnerungen: [],
};

let gespeichert: ReturnType<typeof vi.fn<(text: string) => void>>;
function zeigen(stand = STAND, e = neueEinstellungen('kinder'), heute = '2026-11-04') {
  gespeichert = vi.fn<(text: string) => void>();
  render(
    <MailsFenster
      id={165}
      veranstaltung="Kinderfreizeit"
      e={e}
      stand={stand}
      heute={heute}
      onClose={() => {}}
      onGespeichert={gespeichert}
    />,
  );
}
/** Mit Termin am Fr, 20.11.2026 – und, wenn angegeben, schon gespeicherten Erinnerungen. */
const mitTermin = (tage?: number[]) => ({
  ...neueEinstellungen('kinder'),
  termin: { beginn: '2026-11-20T18:00', ende: null, ort: 'Freizeitgelände', terminId: 1 },
  ...(tage ? { erinnerungTage: tage } : {}),
});
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
      ['Check-in-Code (QR-Code)', '{{{groupMember.checkInCodeQr}}}'],
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

  it('lässt sich die Leitung nicht laden, steht der Fehler im Fenster', async () => {
    ei.leitungsKandidaten.mockRejectedValue(new TypeError('Failed to fetch'));
    zeigen();
    expect((await screen.findByRole('alert')).textContent).toMatch(/antwortet gerade nicht/);
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
    expect(ab.ablaeufeEinrichten).toHaveBeenCalledWith(
      165,
      9,
      {
        platz: STAND.eigen.platz,
        warte: { betreff: '', absatz: 'Wir melden uns.', gruss: '' },
        erinnerung: OHNE_EIGENEN_TEXT,
      },
      false,
    );
    // Tage unverändert: die Einstellungen bleiben unberührt.
    expect(ei.aendereEinstellungen).not.toHaveBeenCalled();
  });

  it('Check-in-Code (A9-2b): Schalter nur bei der Bestätigung, geht mit Speichern und Vorschau', async () => {
    zeigen();
    const schalter = screen.getByRole('button', { name: 'Check-in-Code (QR) mitschicken' });
    expect(schalter.getAttribute('aria-pressed')).toBe('false');
    fireEvent.click(screen.getByRole('button', { name: 'Warteliste' }));
    expect(screen.queryByRole('button', { name: 'Check-in-Code (QR) mitschicken' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Bestätigung' }));
    fireEvent.click(screen.getByRole('button', { name: 'Check-in-Code (QR) mitschicken' }));
    fireEvent.click(screen.getByRole('button', { name: 'Vorschau' }));
    await waitFor(() => expect(ru.vorschauLaden).toHaveBeenCalled());
    expect(ru.vorschauLaden.mock.calls[0][3]).toContain('groupMember.checkInCodeQr');
    // Eingeschaltet, aber noch nicht gespeichert: ChurchTools hat noch keine Codes.
    expect(await screen.findByText(/erst beim Speichern an/)).toBeTruthy();
    const wahl = screen.getByRole('combobox', { name: 'Absender' });
    await waitFor(() => expect(within(wahl).getAllByRole('option')).toHaveLength(2));
    fireEvent.click(screen.getByRole('button', { name: 'Speichern' }));
    await waitFor(() => expect(gespeichert).toHaveBeenCalled());
    expect(ab.ablaeufeEinrichten.mock.calls[0][3]).toBe(true);
  });

  it('Check-in-Code schon an: Schalter an, Ausschalten geht als „aus“ an ablaeufeEinrichten', async () => {
    zeigen({ ...STAND, qr: true });
    const schalter = screen.getByRole('button', { name: 'Check-in-Code (QR) mitschicken' });
    expect(schalter.getAttribute('aria-pressed')).toBe('true');
    fireEvent.click(schalter);
    const wahl = screen.getByRole('combobox', { name: 'Absender' });
    await waitFor(() => expect(within(wahl).getAllByRole('option')).toHaveLength(2));
    fireEvent.click(screen.getByRole('button', { name: 'Speichern' }));
    await waitFor(() => expect(gespeichert).toHaveBeenCalled());
    expect(ab.ablaeufeEinrichten.mock.calls[0][3]).toBe(false);
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

describe('MailsFenster – Erinnerung (A9-3b)', () => {
  const schalter = () => screen.getByRole('button', { name: 'Erinnerung vor dem Termin' });
  /** Was `aendereEinstellungen` aus den Einstellungen machen würde. */
  const geschriebeneTage = (vorher: ReturnType<typeof mitTermin>) => {
    const aendern = ei.aendereEinstellungen.mock.calls[0][1];
    return aendern(vorher).erinnerungTage;
  };

  it('einschalten: „3 Tage“ vorgewählt mit Tag; weitere dazu bis drei; Speichern schreibt erst die Tage, dann die Routinen', async () => {
    const e = mitTermin();
    ei.aendereEinstellungen.mockImplementation(async (_id, f) => f(e));
    zeigen(STAND, e);
    fireEvent.click(screen.getByRole('button', { name: 'Erinnerung' }));
    expect(schalter().getAttribute('aria-pressed')).toBe('false');
    expect(screen.queryByRole('textbox', { name: 'Betreff' })).toBeNull();
    fireEvent.click(schalter());
    expect(screen.getByText('Di, 17.11.2026')).toBeTruthy();
    const erste = screen.getByRole('group', { name: '1. Erinnerung: Tage vorher' });
    expect(within(erste).getByRole('button', { name: '3 Tage' }).getAttribute('aria-pressed')).toBe(
      'true',
    );
    fireEvent.click(screen.getByRole('button', { name: /Weitere Erinnerung/ }));
    fireEvent.click(screen.getByRole('button', { name: /Weitere Erinnerung/ }));
    expect(
      screen.getByRole<HTMLButtonElement>('button', { name: /Weitere Erinnerung/ }).disabled,
    ).toBe(true);
    expect(feld('Betreff').getAttribute('placeholder')).toBe('Bald ist es so weit: Kinderfreizeit');
    expect(screen.getByText(/Wer sich ab dem Fr, 06\.11\.2026 anmeldet/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Speichern' }));
    await waitFor(() => expect(gespeichert).toHaveBeenCalled());
    expect(geschriebeneTage(e)).toEqual([3, 14, 7]);
    expect(ei.aendereEinstellungen.mock.invocationCallOrder[0]).toBeLessThan(
      ab.ablaeufeEinrichten.mock.invocationCallOrder[0],
    );
  });

  it('eigene Zahl: 1–30, doppelt geht nicht – sonst Fehler und kein Speichern', async () => {
    zeigen(STAND, mitTermin([3]));
    fireEvent.click(screen.getByRole('button', { name: 'Erinnerung' }));
    const eigen = screen.getByRole('textbox', { name: '1. Erinnerung: eigene Zahl' });
    fireEvent.change(eigen, { target: { value: '40' } });
    expect(screen.getByText(/bitte 1 bis 30 Tage/)).toBeTruthy();
    expect(screen.getByRole<HTMLButtonElement>('button', { name: 'Speichern' }).disabled).toBe(
      true,
    );
    fireEvent.change(eigen, { target: { value: '10' } });
    expect(screen.getByText('Di, 10.11.2026')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /Weitere Erinnerung/ }));
    const zweite = screen.getByRole('textbox', { name: '2. Erinnerung: eigene Zahl' });
    fireEvent.change(zweite, { target: { value: '10' } });
    expect(screen.getByText(/Diese gibt es schon/)).toBeTruthy();
  });

  it('ausschalten: das Feld verschwindet aus den Einstellungen', async () => {
    const e = mitTermin([3, 14]);
    ei.aendereEinstellungen.mockImplementation(async (_id, f) => f(e));
    zeigen({ ...STAND, erinnerungen: [{ datum: '2026-11-06', an: true }] }, e);
    fireEvent.click(screen.getByRole('button', { name: 'Erinnerung' }));
    fireEvent.click(schalter());
    fireEvent.click(screen.getByRole('button', { name: 'Speichern' }));
    await waitFor(() => expect(gespeichert).toHaveBeenCalled());
    const aendern = ei.aendereEinstellungen.mock.calls[0][1];
    expect('erinnerungTage' in aendern(e)).toBe(false);
  });

  it('R7: vorbeie zeigen, ob sie noch an Spätangemeldete geht', () => {
    zeigen(STAND, mitTermin([14, 3, 1]), '2026-11-18');
    fireEvent.click(screen.getByRole('button', { name: 'Erinnerung' }));
    expect(screen.getByText('vorbei – aus')).toBeTruthy();
    expect(screen.getByText('vorbei – geht noch an Spätangemeldete')).toBeTruthy();
    expect(screen.getByText(/bekommt die Erinnerung vom Di, 17\.11\.2026 gleich mit/)).toBeTruthy();
  });

  it('ohne Termin: Schalter gesperrt, mit Hinweis', () => {
    zeigen();
    fireEvent.click(screen.getByRole('button', { name: 'Erinnerung' }));
    expect((schalter() as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText(/Ohne Termin gibt es keine Erinnerung/)).toBeTruthy();
  });

  it('Bestätigung und Erinnerung teilen sich die 1.000 Zeichen', () => {
    zeigen(STAND, mitTermin([3]));
    const lang = 'x'.repeat(480);
    fireEvent.change(feld('Eigener Absatz (freiwillig)'), { target: { value: lang } });
    fireEvent.click(screen.getByRole('button', { name: 'Erinnerung' }));
    expect(screen.getByText(/Bestätigung und Erinnerung zusammen/)).toBeTruthy();
    fireEvent.change(feld('Eigener Absatz (freiwillig)'), { target: { value: lang } });
    expect(screen.getByText(/zu lang/)).toBeTruthy();
  });

  it('Vorschau: die Erinnerung mit Datum, für eine Person mit Platz', async () => {
    zeigen(STAND, mitTermin([3]));
    fireEvent.click(screen.getByRole('button', { name: 'Erinnerung' }));
    const wahl = screen.getByRole('combobox', { name: 'Absender' });
    await waitFor(() => expect(within(wahl).getAllByRole('option')).toHaveLength(2));
    fireEvent.click(screen.getByRole('button', { name: 'Vorschau' }));
    await waitFor(() => expect(ru.vorschauLaden).toHaveBeenCalled());
    expect(ab.vorschauPerson).toHaveBeenCalledWith(165, 'platz', 7);
    expect(ru.vorschauLaden.mock.calls[0][2]).toBe('Bald ist es so weit: Kinderfreizeit');
    expect(ru.vorschauLaden.mock.calls[0][3]).toContain('ist bei „Kinderfreizeit“ dabei');
  });
});
