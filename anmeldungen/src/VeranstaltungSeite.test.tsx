// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { neueEinstellungen } from '@shared/anmeldung/vorlagen';
import { geburtsdatumAn, type OeffentlicheEinstellungen } from '@shared/anmeldung/formular';
import { ApiError } from '@ui/ct/fehler';
import * as E from './einrichten';
import * as G from './gemeinde';
import { VeranstaltungSeite } from './VeranstaltungSeite';
import { NeueVeranstaltung } from './NeueVeranstaltung';

vi.mock('./einrichten', async (original) => {
  const echt = await original<typeof import('./einrichten')>();
  return {
    ...echt,
    kopfVon: vi.fn(),
    einstellungenVon: vi.fn(),
    anmeldungVon: vi.fn(),
    darfVeranstaltungEinrichten: vi.fn(),
    freigeben: vi.fn(),
    leitungsKandidaten: vi.fn(),
    meineId: vi.fn(),
    stammdaten: vi.fn(),
    anmeldenVorbereiten: vi.fn(),
    anmeldeBedingungen: vi.fn(),
    aendereEinstellungen: vi.fn(),
    speichereAnmeldung: vi.fn(),
    kalenderListe: vi.fn(),
    termineIn: vi.fn(),
    legeTerminAn: vi.fn(),
    legeVeranstaltungAn: vi.fn(),
    kopiereVeranstaltung: vi.fn(),
    veranstaltungenVon: vi.fn(),
    anmeldungenZahl: vi.fn(),
    teamVon: vi.fn(),
    istGruppenAdmin: vi.fn(),
    wiederherstellen: vi.fn(),
    aenderePreise: vi.fn(),
    speichereBezahlung: vi.fn(),
  };
});
const m = vi.mocked(E);
vi.mock('./gemeinde', () => ({ gemeindeVorgaben: vi.fn() }));
const gm = vi.mocked(G);
// „Neue Veranstaltung“ legt danach die Spalten an (A5) – hier nicht Gegenstand.
vi.mock('./formularFelder', () => ({ felderAnlegen: vi.fn().mockResolvedValue(undefined) }));

const ZONE = 'Europe/Berlin';

function stelle(
  darf: boolean,
  statusId = 2,
  einstellungen: Partial<OeffentlicheEinstellungen> = {},
) {
  m.kopfVon.mockResolvedValue({ name: 'Gemeindeessen', statusId, bildUrl: null });
  m.einstellungenVon.mockResolvedValue({ ...neueEinstellungen('einfach'), ...einstellungen });
  m.anmeldungVon.mockResolvedValue({ maxPlaetze: null, warteliste: false, ab: null, bis: null });
  m.darfVeranstaltungEinrichten.mockResolvedValue(darf);
  m.aendereEinstellungen.mockResolvedValue(neueEinstellungen('einfach'));
  m.kalenderListe.mockResolvedValue([
    { id: 2, name: 'Gottesdienst', schreiben: false },
    { id: 1, name: 'Sonstige Veranstaltung', schreiben: true },
  ]);
  m.termineIn.mockResolvedValue([]);
  m.anmeldungenZahl.mockResolvedValue(0);
  m.teamVon.mockResolvedValue({ id: 9, name: 'Lobpreisteam' });
  m.istGruppenAdmin.mockResolvedValue(false);
}

function zeigen(formularAdresse: string | null = 'https://anmeldung.beispiel.de/') {
  render(
    <VeranstaltungSeite
      id={91}
      zeitzone={ZONE}
      formularAdresse={formularAdresse}
      onZurueck={() => {}}
    />,
  );
}

const STAMM = {
  status: [{ id: 2, name: 'status.potential', nameTranslated: 'Interessent', isMember: false }],
  standorte: [{ id: 0, name: 'Zentrale' }],
  bereiche: [{ id: 1, name: 'Gemeindeliste' }],
};
beforeEach(() => {
  vi.stubGlobal('window', Object.assign(window, { settings: { base_url: 'https://ct.test/' } }));
  // Freigeben (A6-2): Leitung, Vorgaben für neue Personen, Prüfung danach.
  m.leitungsKandidaten.mockResolvedValue([
    { personId: 1, name: 'Alwin Friesen', leitung: false },
    { personId: 2, name: 'Bea Team', leitung: false },
  ]);
  m.meineId.mockResolvedValue(1);
  m.stammdaten.mockResolvedValue(STAMM);
  gm.gemeindeVorgaben.mockResolvedValue({ statusId: 2, campusId: 0, departmentId: 1 });
  m.anmeldenVorbereiten.mockResolvedValue();
  m.anmeldeBedingungen.mockResolvedValue([]);
});

describe('Veranstaltung laden scheitert – gemeinsamer Fehlerkasten (ui/erweiterung)', () => {
  it('vorübergehend (502) → „antwortet gerade nicht“, „Erneut versuchen“ lädt neu', async () => {
    stelle(true);
    m.kopfVon.mockRejectedValueOnce(new ApiError(502, 'x'));
    zeigen();
    expect(await screen.findByText(/antwortet gerade nicht/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Erneut versuchen' }));
    expect(await screen.findByText('Gemeindeessen')).toBeTruthy();
    expect(m.kopfVon).toHaveBeenCalledTimes(2);
  });

  it('abgemeldet (401) → Hinweis ohne „Erneut versuchen“, der Weg zurück bleibt', async () => {
    stelle(true);
    m.kopfVon.mockRejectedValueOnce(new ApiError(401, 'x'));
    zeigen();
    expect(await screen.findByText(/nicht mehr angemeldet/)).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Erneut versuchen' })).toBeNull();
    expect(screen.getByRole('button', { name: /Übersicht/ })).toBeTruthy();
  });
});

describe('Veranstaltung einrichten (A3, #486)', () => {
  it('ohne Recht: alles sichtbar, aber kein Bearbeiten und kein Freigeben', async () => {
    stelle(false);
    zeigen();
    expect(await screen.findByText(/Einrichten und freigeben kann die Leitung/)).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Bearbeiten' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Freigeben' })).toBeNull();
  });

  it('mit Recht: Entwurf freigeben (nach Rückfrage) – erst Leitung und Vorgaben, dann frei, dann neu geladen', async () => {
    stelle(true);
    m.freigeben.mockResolvedValue();
    zeigen();
    fireEvent.click(await screen.findByRole('button', { name: 'Freigeben' }));
    // Wer freigibt, ist als Leitung vorgewählt; die Vorgaben stehen in Worten da.
    expect(
      (await screen.findByRole('button', { name: 'Alwin Friesen' })).getAttribute('aria-pressed'),
    ).toBe('true');
    expect(screen.getByText(/Interessent · Zentrale · Gemeindeliste/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Bea Team' }));
    fireEvent.click(screen.getByRole('button', { name: 'Jetzt freigeben' }));
    await waitFor(() =>
      expect(m.anmeldenVorbereiten).toHaveBeenCalledWith(91, [1, 2], {
        statusId: 2,
        campusId: 0,
        departmentId: 1,
      }),
    );
    await waitFor(() => expect(m.freigeben).toHaveBeenCalledWith(91));
    expect(m.anmeldenVorbereiten.mock.invocationCallOrder[0]).toBeLessThan(
      m.freigeben.mock.invocationCallOrder[0],
    );
    await waitFor(() => expect(m.kopfVon).toHaveBeenCalledTimes(2));
  });

  it('nimmt ChurchTools danach noch nicht an, sagt das Fenster, was fehlt', async () => {
    stelle(true);
    m.freigeben.mockResolvedValue();
    m.anmeldeBedingungen.mockResolvedValue([
      'Der Anmeldezeitraum hat noch nicht begonnen oder ist vorbei.',
    ]);
    zeigen();
    fireEvent.click(await screen.findByRole('button', { name: 'Freigeben' }));
    await screen.findByRole('button', { name: 'Alwin Friesen' });
    fireEvent.click(screen.getByRole('button', { name: 'Jetzt freigeben' }));
    expect(await screen.findByText('Freigegeben – aber noch nicht offen')).toBeTruthy();
    expect(screen.getByText(/Anmeldezeitraum hat noch nicht begonnen/)).toBeTruthy();
  });

  it('ohne vollständige Vorgaben für neue Personen: Hinweis, Freigeben gesperrt', async () => {
    stelle(true);
    gm.gemeindeVorgaben.mockResolvedValue({ statusId: 2 });
    zeigen();
    fireEvent.click(await screen.findByRole('button', { name: 'Freigeben' }));
    expect(
      await screen.findByText(/legt ein Gruppen-Admin einmal für die Gemeinde fest/),
    ).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Jetzt freigeben' })).toHaveProperty(
      'disabled',
      true,
    );
  });

  it('ohne Adresse der Formular-Seite: Hinweis, Freigeben gesperrt', async () => {
    stelle(true);
    zeigen(null);
    fireEvent.click(await screen.findByRole('button', { name: 'Freigeben' }));
    await screen.findByRole('button', { name: 'Alwin Friesen' });
    expect(screen.getByText(/keine Adresse für das Anmeldeformular/)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Jetzt freigeben' })).toHaveProperty(
      'disabled',
      true,
    );
  });

  it('ohne gewählte Leitung lässt sich nicht freigeben', async () => {
    stelle(true);
    zeigen();
    fireEvent.click(await screen.findByRole('button', { name: 'Freigeben' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Alwin Friesen' }));
    expect(screen.getByRole('button', { name: 'Jetzt freigeben' })).toHaveProperty(
      'disabled',
      true,
    );
  });

  it('Freigabe scheitert → Meldung im Fenster, das Fenster bleibt offen', async () => {
    stelle(true);
    m.freigeben.mockRejectedValue(new E.NichtUebernommen('die Freigabe'));
    zeigen();
    fireEvent.click(await screen.findByRole('button', { name: 'Freigeben' }));
    await screen.findByRole('button', { name: 'Alwin Friesen' });
    fireEvent.click(screen.getByRole('button', { name: 'Jetzt freigeben' }));
    expect(await screen.findByText(/ChurchTools hat die Freigabe nicht übernommen/)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Jetzt freigeben' })).toBeTruthy();
  });

  it('neuer Termin: nur beschreibbare Kalender, Ortszeit, danach in die Einstellungen übernommen', async () => {
    stelle(true, 2, {
      termin: { beginn: '2026-11-15T12:00', ende: '2026-11-15T14:00', ort: 'Saal', terminId: null },
    });
    m.legeTerminAn.mockResolvedValue({
      id: 61,
      startDate: '2026-11-15T11:00:00Z',
      endDate: '2026-11-15T13:00:00Z',
      address: { name: 'Saal' },
    });
    zeigen();
    const termin = await screen.findByRole('region', { name: 'Termin' });
    fireEvent.click(within(termin).getByRole('button', { name: 'Bearbeiten' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Neu anlegen' }));
    const kalender = await screen.findByRole('combobox', { name: 'Kalender' });
    expect([...kalender.querySelectorAll('option')].map((o) => o.textContent)).toEqual([
      'Sonstige Veranstaltung',
    ]);
    fireEvent.click(screen.getByRole('button', { name: 'Termin anlegen und übernehmen' }));
    await waitFor(() =>
      expect(m.legeTerminAn).toHaveBeenCalledWith({
        kalenderId: 1,
        titel: 'Gemeindeessen',
        beginn: '2026-11-15T12:00',
        ende: '2026-11-15T14:00',
        ort: 'Saal',
        // Der Link beginnt mit der Formular-Seite der Gemeinde (A6-2), nicht mit einer festen Adresse.
        link: 'https://anmeldung.beispiel.de/#ct.test/91',
        zeitzone: ZONE,
      }),
    );
    await waitFor(() => expect(m.aendereEinstellungen).toHaveBeenCalled());
    const aendern = m.aendereEinstellungen.mock.calls[0][1];
    expect(aendern(neueEinstellungen('einfach')).termin).toEqual({
      beginn: '2026-11-15T12:00',
      ende: '2026-11-15T14:00',
      ort: 'Saal',
      terminId: 61,
      // A5: der Kalender wird mit gemerkt – das Termin-Fenster beginnt dann dort.
      kalenderId: 1,
    });
  });

  it('das Termin-Fenster beginnt beim Kalender des gewählten Termins (A5)', async () => {
    stelle(true, 2, {
      termin: { beginn: '2026-11-15T12:00', ende: null, ort: '', terminId: 7, kalenderId: 1 },
    });
    m.kalenderListe.mockResolvedValue([
      { id: 2, name: 'Bandproben', schreiben: false },
      { id: 1, name: 'Sonstige Veranstaltung', schreiben: true },
    ]);
    zeigen();
    const termin = await screen.findByRole('region', { name: 'Termin' });
    fireEvent.click(within(termin).getByRole('button', { name: 'Bearbeiten' }));
    const kalender = await screen.findByRole('combobox', { name: 'Kalender' });
    expect(kalender).toHaveProperty('value', '1');
    await waitFor(() =>
      expect(m.termineIn).toHaveBeenCalledWith(1, expect.any(String), expect.any(String)),
    );
  });

  it('Ende vor Beginn → „anlegen“ gesperrt, mit Hinweis', async () => {
    stelle(true, 2, {
      termin: { beginn: '2026-11-15T19:00', ende: null, ort: '', terminId: null },
    });
    zeigen();
    const termin = await screen.findByRole('region', { name: 'Termin' });
    fireEvent.click(within(termin).getByRole('button', { name: 'Bearbeiten' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Neu anlegen' }));
    expect(await screen.findByText('Das Ende muss nach dem Beginn liegen.')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Termin anlegen und übernehmen' })).toHaveProperty(
      'disabled',
      true,
    );
  });

  it('vorhandener Termin: Link zur Anmeldung als Text zu sehen und mit einem Knopf zu kopieren', async () => {
    stelle(true);
    const kopieren = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: kopieren },
      configurable: true,
    });
    zeigen();
    const termin = await screen.findByRole('region', { name: 'Termin' });
    fireEvent.click(within(termin).getByRole('button', { name: 'Bearbeiten' }));
    const link = await screen.findByRole('textbox', { name: 'Link zur Anmeldung' });
    expect(link).toHaveProperty('value', 'https://anmeldung.beispiel.de/#ct.test/91');
    fireEvent.click(screen.getByRole('button', { name: 'Link kopieren' }));
    expect(await screen.findByRole('button', { name: 'Link kopiert' })).toBeTruthy();
    expect(kopieren).toHaveBeenCalledWith('https://anmeldung.beispiel.de/#ct.test/91');
  });

  it('Kopieren verweigert → Link bleibt markiert, mit Hinweis zum Kopieren von Hand', async () => {
    stelle(true);
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: vi.fn().mockRejectedValue(new Error('nein')) },
      configurable: true,
    });
    zeigen();
    const termin = await screen.findByRole('region', { name: 'Termin' });
    fireEvent.click(within(termin).getByRole('button', { name: 'Bearbeiten' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Link kopieren' }));
    expect(await screen.findByText(/kopiere ihn von Hand/)).toBeTruthy();
    expect(screen.getByRole('textbox', { name: 'Link zur Anmeldung' })).toBeTruthy();
  });

  it('Anmeldung: Beginn 0:00 und Schluss 23:59 in Ortszeit, als UTC gespeichert', async () => {
    stelle(true);
    m.speichereAnmeldung.mockResolvedValue();
    zeigen();
    const karte = await screen.findByRole('region', { name: 'Anmeldung' });
    fireEvent.click(within(karte).getByRole('button', { name: 'Bearbeiten' }));
    fireEvent.change(screen.getByLabelText('Anmeldung ab'), { target: { value: '2026-10-20' } });
    fireEvent.change(screen.getByLabelText('Anmeldeschluss'), { target: { value: '2026-11-12' } });
    fireEvent.change(screen.getByLabelText('Plätze (leer = unbegrenzt)'), {
      target: { value: '60' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Speichern' }));
    await waitFor(() =>
      expect(m.speichereAnmeldung).toHaveBeenCalledWith(91, {
        maxPlaetze: 60,
        warteliste: false,
        ab: '2026-10-19T22:00:00Z',
        bis: '2026-11-12T22:59:00Z',
      }),
    );
  });
});

describe('Bezahlung, Freigeben, Geburtsdatum (A4)', () => {
  const zwoelfEuro = {
    ...neueEinstellungen('einfach').preis,
    grundpreis: { ...neueEinstellungen('einfach').preis.grundpreis, betragCent: 1200 },
  };

  it('Preise ohne Bankverbindung: Karte sagt „fehlt noch“, Freigeben weist darauf hin', async () => {
    stelle(true, 2, { preis: zwoelfEuro });
    zeigen();
    const karte = await screen.findByRole('region', { name: 'Bezahlung' });
    expect(within(karte).getByText('fehlt noch')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Freigeben' }));
    expect(screen.getByText(/Es gibt Preise, aber noch keine Bankverbindung/)).toBeTruthy();
  });

  it('kostenlos: kein Konto nötig, kein Hinweis', async () => {
    stelle(true);
    zeigen();
    const karte = await screen.findByRole('region', { name: 'Bezahlung' });
    expect(within(karte).getByText('keine (kostenlos)')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Freigeben' }));
    expect(screen.queryByText(/noch keine Bankverbindung/)).toBeNull();
  });

  it('Bezahlung: falsche IBAN → Meldung, Speichern gesperrt; richtige → gespeichert wie eingegeben', async () => {
    stelle(true, 2, { preis: zwoelfEuro });
    m.speichereBezahlung.mockResolvedValue();
    zeigen();
    const karte = await screen.findByRole('region', { name: 'Bezahlung' });
    fireEvent.click(within(karte).getByRole('button', { name: 'Bearbeiten' }));
    fireEvent.change(screen.getByLabelText('Kontoinhaber'), { target: { value: 'Gemeinde e.V.' } });
    fireEvent.change(screen.getByLabelText('IBAN'), {
      target: { value: 'DE89 3704 0044 0532 0130 01' },
    });
    expect(screen.getByText(/Die IBAN stimmt nicht/)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Speichern' })).toHaveProperty('disabled', true);
    fireEvent.change(screen.getByLabelText('IBAN'), {
      target: { value: 'DE89 3704 0044 0532 0130 00' },
    });
    expect(screen.getByText(/IBAN stimmt \(Prüfziffer passt\)/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Speichern' }));
    await waitFor(() =>
      expect(m.speichereBezahlung).toHaveBeenCalledWith(91, {
        kontoinhaber: 'Gemeinde e.V.',
        iban: 'DE89370400440532013000',
        bic: '',
        fristTage: 14,
        zweck: '[Nachname]',
      }),
    );
  });

  it('Wer meldet sich an?: Geburtsdatum einschalten schreibt es ins Formular (setzeGeburtsdatum)', async () => {
    stelle(true);
    zeigen();
    const karte = await screen.findByRole('region', { name: 'Wer meldet sich an?' });
    expect(within(karte).getByText('wird nicht abgefragt')).toBeTruthy();
    fireEvent.click(within(karte).getByRole('button', { name: 'Bearbeiten' }));
    fireEvent.click(screen.getByRole('button', { name: 'Pflicht' }));
    fireEvent.click(screen.getByRole('button', { name: 'Speichern' }));
    await waitFor(() => expect(m.aendereEinstellungen).toHaveBeenCalled());
    const aendern = m.aendereEinstellungen.mock.calls[0][1];
    expect(geburtsdatumAn(aendern(neueEinstellungen('einfach')).formular)).toBe(true);
  });

  it('Preise nach Alter ohne Geburtsdatum: „Geburtsdatum abfragen“ öffnet „Wer meldet sich an?“ mit Warnung', async () => {
    stelle(true, 2, {
      preis: { ...zwoelfEuro, alter: [{ von: 0, bis: 2, art: 'frei', wert: 0 }] },
    });
    zeigen();
    fireEvent.click(await screen.findByRole('button', { name: 'Geburtsdatum abfragen' }));
    expect(screen.getByText(/Ohne Geburtsdatum kann das Formular sie nicht rechnen/)).toBeTruthy();
  });

  it('Anmeldungen werden gezählt und im Preis-Fenster genannt', async () => {
    stelle(true, 2, { preis: zwoelfEuro });
    m.anmeldungenZahl.mockResolvedValue(12);
    zeigen();
    const karte = await screen.findByRole('region', { name: 'Preise' });
    fireEvent.click(within(karte).getByRole('button', { name: /Grundpreis/ }));
    expect(screen.getByText(/Es gibt schon 12 Anmeldungen/)).toBeTruthy();
  });
});

describe('Rückgängig nach dem Speichern (A4-Nachtrag)', () => {
  it('jedes Fenster meldet die Änderung mit dem Stand VOR dem Speichern als Weg zurück', async () => {
    stelle(true);
    m.aendereEinstellungen.mockResolvedValue(neueEinstellungen('einfach'));
    const geaendert = vi.fn();
    render(
      <VeranstaltungSeite id={91} zeitzone={ZONE} onZurueck={() => {}} onGeaendert={geaendert} />,
    );
    const karte = await screen.findByRole('region', { name: 'Datenschutz' });
    fireEvent.click(within(karte).getByRole('button', { name: 'Bearbeiten' }));
    fireEvent.change(screen.getByLabelText('Monate nach dem Ende (1–36)'), {
      target: { value: '6' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Speichern' }));
    await waitFor(() => expect(geaendert).toHaveBeenCalled());
    const [a, weg] = geaendert.mock.calls[0];
    expect(a.text).toBe('Löschfrist gespeichert.');
    expect(weg).toBe(false);
    await a.rueckgaengig();
    expect(m.wiederherstellen).toHaveBeenCalledWith(91, {
      name: 'Gemeindeessen',
      statusId: 2,
      einstellungen: neueEinstellungen('einfach'),
      anmeldung: { maxPlaetze: null, warteliste: false, ab: null, bis: null },
    });
  });

  it('„Verwalten“ nur mit Recht', async () => {
    stelle(false);
    zeigen();
    await screen.findByText(/Einrichten und freigeben kann die Leitung/);
    expect(screen.queryByRole('button', { name: 'Verwalten' })).toBeNull();
  });
});

describe('Neue Veranstaltung (A3, #486)', () => {
  const TEAMS = [{ id: 7, name: 'Technik', leitung: false }];
  it('Vorlage: legt mit Name, Team, Art und Vorlage an', async () => {
    m.legeVeranstaltungAn.mockResolvedValue(91);
    const fertig = vi.fn();
    render(<NeueVeranstaltung teams={TEAMS} artId={5} onFertig={fertig} onClose={() => {}} />);
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: ' Kindertag ' } });
    fireEvent.click(screen.getByRole('button', { name: /Kinder-Event/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Anlegen' }));
    await waitFor(() => expect(fertig).toHaveBeenCalledWith(91));
    expect(m.legeVeranstaltungAn).toHaveBeenCalledWith({
      name: 'Kindertag',
      teamId: 7,
      artId: 5,
      vorlage: 'kinder',
    });
  });
  it('wie eine frühere: kopiert die gewählte Veranstaltung des Teams', async () => {
    m.veranstaltungenVon.mockResolvedValue([
      { id: 40, name: 'Kindertag 2026' },
      { id: 41, name: 'Sommerfest' },
    ]);
    m.kopiereVeranstaltung.mockResolvedValue(95);
    const fertig = vi.fn();
    render(<NeueVeranstaltung teams={TEAMS} artId={5} onFertig={fertig} onClose={() => {}} />);
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Kindertag 2027' } });
    fireEvent.click(screen.getByRole('button', { name: /Wie eine frühere/ }));
    fireEvent.change(await screen.findByLabelText('Welche?'), { target: { value: '41' } });
    fireEvent.click(screen.getByRole('button', { name: 'Anlegen' }));
    await waitFor(() => expect(fertig).toHaveBeenCalledWith(95));
    expect(m.kopiereVeranstaltung).toHaveBeenCalledWith(41, 'Kindertag 2027');
  });
  it('ohne Namen nicht anlegbar', () => {
    render(<NeueVeranstaltung teams={TEAMS} artId={5} onFertig={() => {}} onClose={() => {}} />);
    expect(screen.getByRole('button', { name: 'Anlegen' })).toHaveProperty('disabled', true);
  });
});
