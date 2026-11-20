// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { ApiError } from '@ui/ct/fehler';
import { plusTage, tagPunkt } from '@shared/ct/datum';
import { heuteImKalender } from '@shared/ct/zeit';
import {
  ERGEBNIS_EINTRAG,
  ERGEBNIS_OHNE,
  NACHWEIS_AUFGABE_ERNEUT,
  NACHWEIS_AUFGABE_ERSTE,
  type NachweisEinstellungen,
} from '@shared/anmeldung/nachweise';
import { personStand, plusJahre } from '@shared/anmeldung/nachweisStand';
import * as Einsicht from './nachweisEinsicht';
import { EinsichtFenster } from './EinsichtFenster';
import { offeneAufgabe } from './nachweisArten.testutil';
import type { NachweisPerson, PersonMitStand } from './nachweisPersonen';

/**
 * Das Fenster „Einsicht festhalten“ (N2b) mit ersetztem Schreiben – was ChurchTools tut, prüft `nachweisEinsicht.test.ts`;
 * hier geht es um Vorbelegung, Prüftexte, den blauen Kasten und das Verhalten bei Fehlern.
 */
vi.mock('./nachweisEinsicht', async (original) => ({
  ...(await original<typeof import('./nachweisEinsicht')>()),
  einsichtFesthalten: vi.fn(),
}));
const schreiben = vi.mocked(Einsicht.einsichtFesthalten);

const HEUTE = heuteImKalender();
const E: NachweisEinstellungen = { gueltigJahre: 3, ab: 'ausstellung', betreff: 'B', text: 'T' };
const ART = { id: 61, name: 'Führungszeugnis', einstellungen: E };
const AUSGESTELLT = plusTage(HEUTE, -8);
const BIS = plusJahre(AUSGESTELLT, 3);

const mitStand = (p: Partial<NachweisPerson>, e = E): PersonMitStand => {
  const person: NachweisPerson = {
    personId: 10,
    name: 'Paula Messnull',
    eingesehenAm: null,
    ausgestelltAm: null,
    ergebnis: null,
    aufgabe: null,
    profil: null,
    ...p,
  };
  return { ...person, ...personStand(person, e, HEUTE) };
};
const PAULA = mitStand({ aufgabe: offeneAufgabe(plusTage(HEUTE, -3)) });
/** Mia: eingesehen vor Jahren, Gültig bis in 30 Tagen, „Erneut einsehen“ offen. */
const MIA = mitStand({
  name: 'Mia Muster',
  eingesehenAm: plusJahre(plusTage(HEUTE, 30), -3),
  ausgestelltAm: plusJahre(plusTage(HEUTE, 30), -3),
  ergebnis: 'ohne',
  aufgabe: offeneAufgabe(plusTage(HEUTE, -20), NACHWEIS_AUFGABE_ERNEUT),
});
const JONAS = mitStand({
  name: 'Jonas Weber',
  eingesehenAm: plusTage(HEUTE, -9),
  ausgestelltAm: plusTage(HEUTE, -17),
  ergebnis: 'eintrag',
});

const onClose = vi.fn();
const onFertig = vi.fn();
const oeffnen = (person: PersonMitStand, art = ART) =>
  render(
    <EinsichtFenster
      art={art}
      person={person}
      heute={HEUTE}
      onClose={onClose}
      onFertig={onFertig}
    />,
  );
const knopf = () =>
  screen.getByRole<HTMLButtonElement>('button', { name: /Festhalten|Wird festgehalten/ });
const datum = (name: string) => screen.getByLabelText<HTMLInputElement>(new RegExp(name));
const aendern = (name: string, wert: string) =>
  fireEvent.change(datum(name), { target: { value: wert } });
const kasten = () => screen.queryByLabelText('Was passiert')?.textContent ?? null;

beforeEach(() => {
  onClose.mockReset();
  onFertig.mockReset();
  schreiben.mockReset();
});
afterEach(cleanup);

describe('Vorbelegung', () => {
  it('Paula (keine Einsicht): heute, Ausgestellt leer, Ergebnis leer – „Festhalten“ gesperrt, Prüftext da', () => {
    oeffnen(PAULA);
    expect(datum('Eingesehen am').value).toBe(HEUTE);
    expect(datum('Ausgestellt am').value).toBe('');
    expect(screen.getByLabelText<HTMLInputElement>(ERGEBNIS_OHNE).checked).toBe(false);
    expect(screen.getByLabelText<HTMLInputElement>(ERGEBNIS_EINTRAG).checked).toBe(false);
    expect(knopf().disabled).toBe(true);
    expect(screen.getByText('Bitte das Datum auf dem Zeugnis eintragen.')).toBeTruthy();
    expect(screen.queryByText(/^Bisher:/)).toBeNull();
  });

  it('Mia (läuft ab): neue Einsicht heute, Ausgestellt leer, das bisherige Ergebnis; „Bisher“ steht da', () => {
    oeffnen(MIA);
    expect(datum('Eingesehen am').value).toBe(HEUTE);
    expect(datum('Ausgestellt am').value).toBe('');
    expect(screen.getByLabelText<HTMLInputElement>(ERGEBNIS_OHNE).checked).toBe(true);
    expect(screen.getByText(/^Bisher: eingesehen/).textContent).toContain(
      `gültig bis ${tagPunkt(plusTage(HEUTE, 30))}`,
    );
  });

  it('Jonas (Rücksprache): die gespeicherten Werte; „Bisher“ nennt das Ergebnis statt Gültig bis', () => {
    oeffnen(JONAS);
    expect(datum('Eingesehen am').value).toBe(JONAS.eingesehenAm);
    expect(datum('Ausgestellt am').value).toBe(JONAS.ausgestelltAm);
    expect(screen.getByLabelText<HTMLInputElement>(ERGEBNIS_EINTRAG).checked).toBe(true);
    expect(screen.getByText(/^Bisher:/).textContent).toContain('Ergebnis „Eintragung“');
    expect(screen.getByText(/^Bisher:/).textContent).not.toContain('gültig bis');
  });

  it('Kopf: Name, Art und Stand-Etikett', () => {
    oeffnen(PAULA);
    expect(screen.getByText('Paula Messnull')).toBeTruthy();
    expect(screen.getByText(/angefordert am/)).toBeTruthy();
    expect(screen.getByRole('dialog').textContent).toContain('Führungszeugnis');
  });

  it('Antrag unvollständig: roter Kasten mit Link nach ChurchTools', () => {
    oeffnen({ ...PAULA, luecke: 'Antrag unvollständig: Geburtsdatum und Adresse fehlen' });
    expect(screen.getByText(/Antrag unvollständig: Geburtsdatum und Adresse fehlen/)).toBeTruthy();
    const link = screen.getByRole('link', { name: /Person in ChurchTools öffnen/ });
    expect(link.getAttribute('href')).toMatch(/\/\?q=churchdb#PersonView\/searchEntry:%2310\/$/);
  });
});

describe('Prüftexte – jeder einzeln, „Festhalten“ bleibt gesperrt', () => {
  const vollstaendig = () => {
    oeffnen(PAULA);
    aendern('Ausgestellt am', AUSGESTELLT);
    fireEvent.click(screen.getByLabelText(ERGEBNIS_OHNE));
  };
  it('alles da: kein Prüftext, Knopf frei', () => {
    vollstaendig();
    expect(knopf().disabled).toBe(false);
  });
  it('Eingesehen leer', () => {
    vollstaendig();
    aendern('Eingesehen am', '');
    expect(screen.getByText('Bitte eintragen, wann du das Zeugnis gesehen hast.')).toBeTruthy();
    expect(knopf().disabled).toBe(true);
  });
  it('Eingesehen in der Zukunft', () => {
    vollstaendig();
    aendern('Eingesehen am', plusTage(HEUTE, 1));
    expect(screen.getByText('„Eingesehen am“ liegt in der Zukunft.')).toBeTruthy();
    expect(knopf().disabled).toBe(true);
  });
  it('Ausgestellt fehlt (Art ab Ausstellung)', () => {
    vollstaendig();
    aendern('Ausgestellt am', '');
    expect(screen.getByText('Bitte das Datum auf dem Zeugnis eintragen.')).toBeTruthy();
  });
  it('Ausgestellt nach der Einsicht', () => {
    vollstaendig();
    aendern('Eingesehen am', plusTage(HEUTE, -3));
    aendern('Ausgestellt am', plusTage(HEUTE, -1));
    expect(
      screen.getByText('Das Zeugnis kann nicht nach der Einsicht ausgestellt sein.'),
    ).toBeTruthy();
    expect(knopf().disabled).toBe(true);
  });
  it('kein Ergebnis', () => {
    oeffnen(PAULA);
    aendern('Ausgestellt am', AUSGESTELLT);
    expect(screen.getByText('Bitte ein Ergebnis wählen.')).toBeTruthy();
    expect(knopf().disabled).toBe(true);
  });
  it('Art ab Einsicht: „Ausgestellt am“ ist freiwillig', () => {
    const e: NachweisEinstellungen = { ...E, ab: 'einsicht' };
    oeffnen(mitStand({ aufgabe: offeneAufgabe(plusTage(HEUTE, -3)) }, e), {
      ...ART,
      einstellungen: e,
    });
    fireEvent.click(screen.getByLabelText(ERGEBNIS_OHNE));
    expect(knopf().disabled).toBe(false);
  });
});

describe('Der blaue Kasten: was in ChurchTools geschieht', () => {
  it('Paula: neue Einsicht – „Einsicht nehmen“ wird erledigt, die nächste bekommt das Datum', () => {
    oeffnen(PAULA);
    aendern('Ausgestellt am', AUSGESTELLT);
    fireEvent.click(screen.getByLabelText(ERGEBNIS_OHNE));
    expect(kasten()).toContain(
      `Neue Einsicht · gültig bis ${tagPunkt(BIS)} (3 Jahre ab Ausstellung).`,
    );
    expect(kasten()).toContain(
      `Die Aufgabe „${NACHWEIS_AUFGABE_ERSTE}“ wird erledigt. Die nächste „${NACHWEIS_AUFGABE_ERNEUT}“ bekommt den ${tagPunkt(BIS)}.`,
    );
  });
  it('Jonas: nur berichtigen – keine Aufgabe wird erledigt; Ergebnis „ohne“ löst die Rücksprache', () => {
    oeffnen(JONAS);
    fireEvent.click(screen.getByLabelText(ERGEBNIS_OHNE));
    expect(kasten()).toContain('Nur die Angaben werden berichtigt');
    expect(kasten()).toContain('Keine Aufgabe wird erledigt.');
    expect(kasten()).toContain('Danach ist der Stand wieder grün, die Rücksprache ist erledigt.');
  });
  it('Eintragung: Stand bleibt „Rücksprache“', () => {
    oeffnen(PAULA);
    aendern('Ausgestellt am', AUSGESTELLT);
    fireEvent.click(screen.getByLabelText(ERGEBNIS_EINTRAG));
    expect(kasten()).toContain('Stand bleibt „Rücksprache“ (rot)');
  });
  it('Mia: die Einsicht erledigt „Erneut einsehen“', () => {
    oeffnen(MIA);
    aendern('Ausgestellt am', AUSGESTELLT);
    expect(kasten()).toContain(`Die Aufgabe „${NACHWEIS_AUFGABE_ERNEUT}“ wird erledigt.`);
  });
  it('ohne gültige Eingaben kein Kasten; der Hinweis zu § 72a steht immer da', () => {
    oeffnen(PAULA);
    expect(kasten()).toBeNull();
    expect(screen.getByText(/§ 72a Abs. 5 SGB VIII/)).toBeTruthy();
  });
});

describe('Festhalten', () => {
  it('schickt die Eingaben ab und meldet den Text der Fertig-Meldung', async () => {
    schreiben.mockResolvedValue({
      neu: true,
      gueltigBis: BIS,
      erledigt: NACHWEIS_AUFGABE_ERSTE,
      verschoben: true,
      nachziehen: false,
      text: 'Einsicht bei Paula Messnull festgehalten.',
    });
    oeffnen(PAULA);
    aendern('Ausgestellt am', AUSGESTELLT);
    fireEvent.click(screen.getByLabelText(ERGEBNIS_OHNE));
    fireEvent.click(knopf());
    await waitFor(() =>
      expect(onFertig).toHaveBeenCalledWith('Einsicht bei Paula Messnull festgehalten.'),
    );
    expect(schreiben).toHaveBeenCalledWith(
      expect.objectContaining({
        art: ART,
        eingesehenAm: HEUTE,
        ausgestelltAm: AUSGESTELLT,
        ergebnis: 'ohne',
        heute: HEUTE,
        person: expect.objectContaining({ personId: 10 }),
      }),
    );
  });

  it('ein Fehler steht im Fenster, das Fenster bleibt offen und nichts wird gemeldet', async () => {
    schreiben.mockRejectedValue(new ApiError(403, 'Kein Recht dafür'));
    oeffnen(PAULA);
    aendern('Ausgestellt am', AUSGESTELLT);
    fireEvent.click(screen.getByLabelText(ERGEBNIS_OHNE));
    fireEvent.click(knopf());
    expect((await screen.findByRole('alert')).textContent).toBe('Kein Recht dafür');
    expect(onFertig).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
    expect(knopf().disabled).toBe(false);
  });

  it('ein vorübergehender Fehler (503): „antwortet gerade nicht“, ohne Statuszahl', async () => {
    schreiben.mockRejectedValue(new ApiError(503, 'weg'));
    oeffnen(PAULA);
    aendern('Ausgestellt am', AUSGESTELLT);
    fireEvent.click(screen.getByLabelText(ERGEBNIS_OHNE));
    fireEvent.click(knopf());
    expect((await screen.findByRole('alert')).textContent).toMatch(/antwortet gerade nicht/);
  });

  it('Teilerfolg: die Meldung steht im Fenster, und Schließen sagt der Seite, dass sie neu lesen soll', async () => {
    schreiben.mockRejectedValue(
      new Einsicht.EinsichtTeilweise('Die Angaben sind in ChurchTools gespeichert, aber …'),
    );
    oeffnen(PAULA);
    aendern('Ausgestellt am', AUSGESTELLT);
    fireEvent.click(screen.getByLabelText(ERGEBNIS_OHNE));
    fireEvent.click(knopf());
    expect((await screen.findByRole('alert')).textContent).toContain('gespeichert');
    fireEvent.click(screen.getByRole('button', { name: /Abbrechen/ }));
    expect(onClose).toHaveBeenCalledWith(true);
  });

  it('Abbrechen ohne etwas gespeichert: die Seite muss nicht neu lesen', () => {
    oeffnen(PAULA);
    fireEvent.click(screen.getByRole('button', { name: /Abbrechen/ }));
    expect(onClose).toHaveBeenCalledWith(false);
  });
});
