// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { ApiError } from '@ui/ct/fehler';
import { plusTage } from '@shared/ct/datum';
import { heuteImKalender } from '@shared/ct/zeit';
import { type NachweisEinstellungen } from '@shared/anmeldung/nachweise';
import { antragVorgabe } from '@shared/anmeldung/nachweisAntrag';
import { vermerkText } from '@shared/anmeldung/nachweisFaellige';
import { personStand, plusJahre } from '@shared/anmeldung/nachweisStand';
import * as Faellige from './nachweisFaellige';
import { FaelligeFenster } from './FaelligeFenster';
import { UnklarObVerschickt } from './rundmail';
import { offeneAufgabe } from './nachweisArten.testutil';
import type { NachweisPerson } from './nachweisPersonen';

/**
 * Das Fenster „Fällige anschreiben“ (N2c) mit ersetztem Laden und Senden – was ChurchTools tut, prüft
 * `nachweisFaellige.test.ts`; hier geht es um die Liste, die Sperren, den Knopf und das Verhalten bei Fehlern.
 */
vi.mock('./nachweisFaellige', async (original) => ({
  ...(await original<typeof import('./nachweisFaellige')>()),
  faelligeLaden: vi.fn(),
  faelligeSenden: vi.fn(),
}));
const laden = vi.mocked(Faellige.faelligeLaden);
const senden = vi.mocked(Faellige.faelligeSenden);

const HEUTE = heuteImKalender();
const E: NachweisEinstellungen = { gueltigJahre: 3, ab: 'ausstellung', betreff: 'B', text: 'T' };
const ART = { id: 61, name: 'Führungszeugnis', einstellungen: E };
const OTTO = { personId: 7, name: 'Otto Messnull' };

const P = (id: number, name: string, tage: number | null, p: Partial<NachweisPerson> = {}) => {
  const person: NachweisPerson = {
    personId: id,
    name,
    eingesehenAm: tage === null ? null : plusTage(HEUTE, -5),
    ausgestelltAm: tage === null ? null : plusJahre(plusTage(HEUTE, tage), E.gueltigJahre * -1),
    ergebnis: tage === null ? null : 'ohne',
    aufgabe: offeneAufgabe(plusTage(HEUTE, -3), 'Erneut einsehen', null, id * 10),
    profil: null,
    ...p,
  };
  return { ...person, ...personStand(person, E, HEUTE) };
};
const MIA = P(1, 'Mia Muster', 30);
const BEN = {
  ...P(2, 'Ben Alt', -20),
  // Der Hinweis kommt nur bei Arten mit Antrag (Regel in `antragLuecke`); hier fest vorgegeben.
  luecke: 'Antrag unvollständig: Adresse fehlt',
};
const TOM = P(3, 'Tom Leise', 10); // läuft ab, aber keine Mailadresse
const SARA = P(4, 'Sara Gültig', 900); // gültig – bekommt nichts
const LENA = P(5, 'Lena Fehlt', null, { aufgabe: offeneAufgabe(plusTage(HEUTE, -40)) });
const PERSONEN = [LENA, SARA, MIA, TOM, BEN];
const EMAILS = new Map<number, string | null>([
  [1, 'mia@x.test'],
  [2, 'ben@x.test'],
  [3, null],
  [4, 'sara@x.test'],
  [5, 'lena@x.test'],
]);

const onClose = vi.fn();
const onFertig = vi.fn();
const oeffnen = (personen = PERSONEN, art: typeof ART = ART) =>
  render(
    <FaelligeFenster
      art={art}
      personen={personen}
      heute={HEUTE}
      onClose={onClose}
      onFertig={onFertig}
    />,
  );
const knopf = () =>
  screen.getByRole<HTMLButtonElement>('button', {
    name: /Mails? senden|Keine Mails|Wird gesendet/,
  });
const haken = (name: string) =>
  screen.getByRole<HTMLInputElement>('checkbox', { name: new RegExp(name) });
const betreff = () => screen.getByLabelText<HTMLInputElement>('Betreff');
const text = () => screen.getByLabelText<HTMLTextAreaElement>('Text');

const ERGEBNIS = {
  gesendet: 2,
  bestaetigt: 2,
  adressen: 2,
  vermerkGewollt: true,
  vermerkt: ['Mia Muster', 'Ben Alt'],
  vermerkFehlt: [],
  ohneAufgabe: [],
  vermerkUnsicher: false,
  text: '2 Mails verschickt, Vermerk an beiden Aufgaben.',
};

beforeEach(() => {
  onClose.mockReset();
  onFertig.mockReset();
  laden.mockReset().mockResolvedValue({ emails: EMAILS, ich: OTTO });
  senden.mockReset().mockResolvedValue(ERGEBNIS);
});
afterEach(cleanup);

describe('Die Liste „An“', () => {
  it('nur läuft ab und abgelaufen, abgelaufen zuerst; alle mit Adresse vorausgewählt; je Zeile wann und die Lücke im Antrag', async () => {
    oeffnen();
    await screen.findByText('Ben Alt');
    const namen = screen.getAllByRole('checkbox').map((c) => c.closest('label')!.textContent);
    expect(namen).toHaveLength(4); // drei Personen + „Vermerk“
    expect(screen.queryByText('Sara Gültig')).toBeNull();
    expect(screen.queryByText('Lena Fehlt')).toBeNull();
    const ben = haken('Ben Alt');
    expect(ben.closest('label')!.textContent).toMatch(/abgelaufen seit \d\d\.\d\d\.\d{4}/);
    expect(ben.closest('label')!.textContent).toContain('Antrag unvollständig');
    expect(haken('Mia Muster').closest('label')!.textContent).toMatch(/läuft ab am/);
    // Reihenfolge: Ben (abgelaufen) vor Mia (läuft ab), Tom (läuft ab, bald) – nach Name innerhalb der Gruppe.
    const reihe = screen
      .getAllByRole('checkbox')
      .slice(0, 3)
      .map((c) => c.closest('label')!.querySelector('b')!.textContent);
    expect(reihe).toEqual(['Ben Alt', 'Mia Muster', 'Tom Leise']);
    expect(haken('Ben Alt').checked).toBe(true);
    expect(haken('Mia Muster').checked).toBe(true);
  });

  it('ohne Mailadresse: grau, nicht gewählt, nicht wählbar, mit Hinweis – und nicht im Zähler', async () => {
    oeffnen();
    await screen.findByText('Tom Leise');
    const tom = haken('Tom Leise');
    expect(tom.disabled).toBe(true);
    expect(tom.checked).toBe(false);
    expect(tom.closest('label')!.textContent).toMatch(/keine Mailadresse/);
    expect(screen.getByText(/Wer keine Mailadresse hat, steht grau da/)).toBeTruthy();
    expect(knopf().textContent).toBe('2 Mails senden');
  });

  it('Abwählen senkt die Zahl im Knopf; bei einer Person heißt es „1 Mail senden“; bei keiner ist der Knopf gesperrt', async () => {
    oeffnen();
    await screen.findByText('Ben Alt');
    fireEvent.click(haken('Ben Alt'));
    expect(knopf().textContent).toBe('1 Mail senden');
    expect(knopf().disabled).toBe(false);
    fireEvent.click(haken('Mia Muster'));
    expect(knopf().textContent).toBe('Keine Mails zu senden');
    expect(knopf().disabled).toBe(true);
    fireEvent.click(haken('Mia Muster'));
    expect(knopf().textContent).toBe('1 Mail senden');
  });

  it('alle fälligen ohne Adresse: nichts wählbar, Senden gesperrt', async () => {
    oeffnen([TOM]);
    await screen.findByText('Tom Leise');
    expect(knopf().disabled).toBe(true);
  });
});

describe('Betreff und Text', () => {
  it('vorgegeben mit dem Namen der Art, dem Weg zum Antrag (nur mit Antrag) und dem Gruß der angemeldeten Person', async () => {
    oeffnen();
    await screen.findByText('Ben Alt');
    expect(betreff().value).toBe('Dein Nachweis „Führungszeugnis“ läuft ab');
    expect(text().value).toContain('Hallo [Vorname],');
    expect(text().value).toContain('Viele Grüße\nOtto');
    expect(text().value).not.toContain('Meine Gruppen');
    cleanup();
    oeffnen(PERSONEN, { ...ART, einstellungen: { ...E, antrag: antragVorgabe('ECG') } });
    await screen.findByText('Ben Alt');
    expect(text().value).toContain(
      '„Meine Gruppen“ → „Nachweis: Führungszeugnis“ → Bescheinigungen',
    );
  });

  it('änderbar; leer oder unbekannter Platzhalter sperrt „Senden“ und sagt warum', async () => {
    oeffnen();
    await screen.findByText('Ben Alt');
    fireEvent.change(betreff(), { target: { value: '' } });
    expect(knopf().disabled).toBe(true);
    expect(screen.getByText('Bitte einen Betreff eintragen.')).toBeTruthy();
    fireEvent.change(betreff(), { target: { value: 'Neu' } });
    expect(knopf().disabled).toBe(false);
    fireEvent.change(text(), { target: { value: 'Hallo [Betrag]' } });
    expect(knopf().disabled).toBe(true);
    expect(screen.getByText(/Im Text steht/).textContent).toMatch(/nur \[Vorname\] kennt/);
    fireEvent.change(text(), { target: { value: '' } });
    expect(knopf().disabled).toBe(true);
    fireEvent.change(text(), { target: { value: 'Hallo [Vorname]' } });
    expect(knopf().disabled).toBe(false);
  });

  it('„[Vorname]“ lässt sich einfügen', async () => {
    oeffnen();
    await screen.findByText('Ben Alt');
    fireEvent.change(text(), { target: { value: 'Hallo ' } });
    fireEvent.click(screen.getByRole('button', { name: '[Vorname]' }));
    expect(text().value).toBe('Hallo [Vorname]');
  });

  it('Absender und Vermerk-Text stehen da: Name der angemeldeten Person, heute', async () => {
    oeffnen();
    await screen.findByText('Ben Alt');
    expect(screen.getByText(/Absender: Otto Messnull \(du\)/)).toBeTruthy();
    expect(screen.getByText(`„${vermerkText(HEUTE, OTTO.name)}“`)).toBeTruthy();
  });
});

describe('Senden', () => {
  it('schickt Gruppe, die Gewählten (mit Adresse), Betreff, Text, Vermerk=an, Absender, heute – und meldet das Ergebnis', async () => {
    oeffnen();
    await screen.findByText('Ben Alt');
    fireEvent.click(haken('Mia Muster'));
    fireEvent.click(knopf());
    await waitFor(() => expect(onFertig).toHaveBeenCalled());
    expect(senden).toHaveBeenCalledTimes(1);
    const e = senden.mock.calls[0][0];
    expect(e.gruppeId).toBe(61);
    expect(e.an.map((x) => [x.personId, x.email, x.aufgabeId])).toEqual([[2, 'ben@x.test', 20]]);
    expect(e).toMatchObject({
      betreff: betreff().value,
      text: text().value,
      vermerk: true,
      absenderName: OTTO.name,
      heute: HEUTE,
    });
    expect(onFertig).toHaveBeenCalledWith(ERGEBNIS.text, ERGEBNIS);
  });

  it('das Häkchen „Vermerk“ abgewählt: Vermerk=aus', async () => {
    oeffnen();
    await screen.findByText('Ben Alt');
    fireEvent.click(screen.getByRole('checkbox', { name: /An der offenen Aufgabe vermerken/ }));
    fireEvent.click(knopf());
    await waitFor(() => expect(senden).toHaveBeenCalled());
    expect(senden.mock.calls[0][0].vermerk).toBe(false);
  });

  it('während des Sendens: „Wird gesendet …“, Knopf gesperrt, kein zweites Senden durch Doppelklick', async () => {
    let fertig!: (v: typeof ERGEBNIS) => void;
    senden.mockReturnValue(new Promise((r) => (fertig = r)));
    oeffnen();
    await screen.findByText('Ben Alt');
    fireEvent.click(knopf());
    await waitFor(() => expect(knopf().textContent).toBe('Wird gesendet …'));
    expect(knopf().disabled).toBe(true);
    fireEvent.click(knopf());
    expect(senden).toHaveBeenCalledTimes(1);
    fertig(ERGEBNIS);
    await waitFor(() => expect(onFertig).toHaveBeenCalled());
  });

  it('Fehler (nichts verschickt): steht im Fenster, das Fenster bleibt, „Senden“ geht wieder', async () => {
    senden.mockRejectedValueOnce(new ApiError(403, 'Verschickt wurde nichts.'));
    oeffnen();
    await screen.findByText('Ben Alt');
    fireEvent.click(knopf());
    expect((await screen.findByRole('alert')).textContent).toBe('Verschickt wurde nichts.');
    expect(onFertig).not.toHaveBeenCalled();
    expect(knopf().disabled).toBe(false);
  });

  it('Verbindungsfehler (503): „antwortet nicht“ – und noch einmal senden ist erlaubt (es ging sicher nichts raus)', async () => {
    senden.mockRejectedValueOnce(new ApiError(503, 'weg'));
    oeffnen();
    await screen.findByText('Ben Alt');
    fireEvent.click(knopf());
    expect((await screen.findByRole('alert')).textContent).toMatch(/antwortet gerade nicht/);
    expect(knopf().disabled).toBe(false);
  });

  it('unklar, ob verschickt: ehrliche Meldung, „Senden“ und alle Eingaben gesperrt – kein zweiter Versuch', async () => {
    senden.mockRejectedValueOnce(new UnklarObVerschickt());
    oeffnen();
    await screen.findByText('Ben Alt');
    fireEvent.click(knopf());
    expect((await screen.findByRole('alert')).textContent).toMatch(
      /ob die Mails rausgingen, ist unklar/,
    );
    expect(knopf().disabled).toBe(true);
    expect(betreff().disabled).toBe(true);
    expect(text().disabled).toBe(true);
    expect(haken('Mia Muster').disabled).toBe(true);
    fireEvent.click(knopf());
    expect(senden).toHaveBeenCalledTimes(1);
    expect(onFertig).not.toHaveBeenCalled();
  });
});

describe('Laden', () => {
  it('Adressen nicht lesbar: Fehler mit „Erneut versuchen“ – nicht eine Liste, in der alle grau sind', async () => {
    laden.mockRejectedValueOnce(new ApiError(503, 'weg'));
    oeffnen();
    expect((await screen.findByRole('alert')).textContent).toMatch(/antwortet gerade nicht/);
    expect(screen.queryByRole('checkbox')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Erneut versuchen' }));
    await screen.findByText('Ben Alt');
    expect(laden).toHaveBeenCalledTimes(2);
  });

  it('gelesen werden die Adressen der fälligen Personen – nicht die der anderen', async () => {
    oeffnen();
    await screen.findByText('Ben Alt');
    // In der Reihenfolge der Seite: Mia, Tom, Ben (Sara ist gültig, Lena fehlt – beide bekommen keine Mail).
    expect(laden).toHaveBeenCalledWith([1, 3, 2]);
  });
});
