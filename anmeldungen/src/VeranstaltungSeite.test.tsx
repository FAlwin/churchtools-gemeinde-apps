// @vitest-environment jsdom
import { beforeEach, describe, expect, it, onTestFinished, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { neueEinstellungen } from '@shared/anmeldung/vorlagen';
import { geburtsdatumAn, type OeffentlicheEinstellungen } from '@shared/anmeldung/formular';
import { ApiError } from '@ui/ct/fehler';
import { ZEITRAUM_ZU } from '@shared/anmeldung/vorbereiten';
import * as E from './einrichten';
import * as G from './gemeinde';
import * as FF from './formularFelder';
import * as NP from './nachpruefung';
import * as MG from './mitglieder';
import * as ZA from './zahlung';
import * as AB from './ablaeufe';
import { OHNE_EIGENEN_TEXT } from '@shared/anmeldung/ablaeufe';
import * as TP from '@ui/teilen/sharePdf';
import * as TF from '@ui/teilen/shareFile';
import {
  e as eListe,
  mitglieder as mitgliederListe,
  stand as standListe,
} from '@shared/anmeldung/liste.testdaten';
import { VeranstaltungSeite, type Reiter } from './VeranstaltungSeite';
import { NeueVeranstaltung } from './NeueVeranstaltung';
import { fensterKnoepfe, knopfFolge } from '@ui/fenster/fenster.testutil';

vi.mock('./einrichten', async (original) => {
  const echt = await original<typeof import('./einrichten')>();
  return {
    ...echt,
    kopfVon: vi.fn(),
    belegungNachziehen: vi.fn().mockResolvedValue(false),
    einstellungenVon: vi.fn(),
    anmeldungVon: vi.fn(),
    darfVeranstaltungEinrichten: vi.fn(),
    darfAblaeufeEinrichten: vi.fn(),
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
vi.mock('./ablaeufe', async (original) => ({
  ...(await original<typeof import('./ablaeufe')>()),
  ablaeufeEinrichten: vi.fn(),
  ablaeufeLesen: vi.fn(),
  ablaeufeAbgleichen: vi.fn(),
}));
const ab = vi.mocked(AB);
const gm = vi.mocked(G);
// „Neue Veranstaltung“ legt danach die Spalten an (A5) – hier nicht Gegenstand.
// Freigeben zieht ältere Veranstaltungen nach (#597).
vi.mock('./formularFelder', () => ({
  felderAnlegen: vi.fn().mockResolvedValue(undefined),
  pflichtNachziehen: vi.fn().mockResolvedValue(undefined),
}));
const ff = vi.mocked(FF);
// A6-5c/A7-1: Mitglieder laden und nachprüfen – hier nachgestellt (gerechnet wird in `shared`, dort getestet).
vi.mock('./mitglieder', () => ({ ladeMitglieder: vi.fn().mockResolvedValue(null) }));
const mg = vi.mocked(MG);
vi.mock('./nachpruefung', () => ({ nachpruefungAus: vi.fn() }));
const np = vi.mocked(NP);
const STAND = { mitglieder: [], absagen: [], verlaufGekuerzt: false };
// A7-2: Zahlung schreiben – hier nur, ob die Seite danach richtig neu lädt.
vi.mock('./zahlung', () => ({
  zahlungSpeichern: vi.fn().mockResolvedValue(undefined),
  betragAendern: vi.fn(),
  betragWiederherstellen: vi.fn(),
}));
const za = vi.mocked(ZA);
vi.mock('@ui/teilen/sharePdf', () => ({ sharePdf: vi.fn(), downloadPdf: vi.fn() }));
const tp = vi.mocked(TP);
vi.mock('@ui/teilen/shareFile', async (original) => ({
  ...(await original<typeof import('@ui/teilen/shareFile')>()),
  shareOrDownload: vi.fn(),
}));
const tf = vi.mocked(TF);
// jsdom kann keine Leinwand – das PNG kommt nachgestellt, das Muster bleibt echt.
vi.mock('@ui/teilen/qr', async (original) => ({
  ...(await original<typeof import('@ui/teilen/qr')>()),
  qrPng: vi.fn(() => Promise.resolve(new Blob(['png'], { type: 'image/png' }))),
}));
const PRUEF_OK = {
  plaetze: { belegt: 9, wartend: 0, max: 10 },
  auswahl: null,
  betraege: [],
  geprueft: 3,
  hinweise: 0,
};
const PRUEF_HINWEISE = {
  ...PRUEF_OK,
  plaetze: { belegt: 9, wartend: 2, max: 10 },
  betraege: [
    {
      grund: 'abweichend' as const,
      nr: 'K9P2XR',
      name: 'Erna Beispiel',
      personId: 7,
      gemeldetCent: 0,
      sollCent: 9000,
    },
    {
      grund: 'auswahl' as const,
      nr: '25QKHU',
      name: 'Erna Nummer',
      personId: 8,
      gemeldetCent: 1500,
      sollCent: null,
      auswahl: null,
    },
  ],
  hinweise: 3,
};

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

/**
 * Die Karten stehen seit U1 im Bereich „Vorbereiten“ – die meisten Tests öffnen ihn darum ausdrücklich. `undefined`
 * = wie ohne Angabe in der Adresse (je nach Stand).
 */
function zeigen(
  formularAdresse: string | null = 'https://anmeldung.beispiel.de/',
  reiter: Reiter | undefined = 'vorbereiten',
) {
  render(
    <VeranstaltungSeite
      id={91}
      reiter={reiter}
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
  // A9-1: Bestätigungsmails – Recht da, eingerichtet.
  m.darfAblaeufeEinrichten.mockResolvedValue(true);
  ab.ablaeufeEinrichten.mockResolvedValue();
  ab.ablaeufeLesen.mockResolvedValue({
    platz: true,
    warte: true,
    standardMail: false,
    absender: 'Alwin Friesen',
    absenderId: 1,
    eigen: { platz: OHNE_EIGENEN_TEXT, warte: OHNE_EIGENEN_TEXT },
    qr: false,
    loeschDatum: null,
    anmeldeschluss: null,
  });
  // A9-2a: Wer einrichten darf, gleicht ab – hier liefert der Abgleich, was ChurchTools hat.
  ab.ablaeufeAbgleichen.mockImplementation((id: number) => ab.ablaeufeLesen(id));
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

  it('A6-5b: mit Recht wird die Belegung der Auswahl beim Öffnen nachgezogen, ohne Recht nicht', async () => {
    m.belegungNachziehen.mockClear();
    stelle(false);
    zeigen();
    await screen.findByText(/Einrichten und freigeben kann die Leitung/);
    expect(m.belegungNachziehen).not.toHaveBeenCalled();
    cleanup();
    stelle(true);
    zeigen();
    await waitFor(() => expect(m.belegungNachziehen).toHaveBeenCalledWith(91));
  });

  it('A6-5b: Nachziehen scheitert → die Seite bleibt, kein Fehler', async () => {
    stelle(true);
    m.belegungNachziehen.mockRejectedValueOnce(new Error('503'));
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    zeigen();
    await waitFor(() => expect(warn).toHaveBeenCalled());
    expect(screen.getByRole('region', { name: 'Anmeldung' })).toBeTruthy();
    warn.mockRestore();
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
    // A9-1: Bestätigungsmails vor dem Freigeben einrichten – Absender ist, wer freigibt (Alwin, 1).
    expect(ab.ablaeufeEinrichten).toHaveBeenCalledWith(91, 1);
    expect(ab.ablaeufeEinrichten.mock.invocationCallOrder[0]).toBeGreaterThan(
      m.anmeldenVorbereiten.mock.invocationCallOrder[0],
    );
    expect(ab.ablaeufeEinrichten.mock.invocationCallOrder[0]).toBeLessThan(
      m.freigeben.mock.invocationCallOrder[0],
    );
    // #597: vor dem Freigeben „Pflicht“ von den Spalten der Anmeldung nehmen.
    expect(ff.pflichtNachziehen).toHaveBeenCalledWith(91);
    expect(ff.pflichtNachziehen.mock.invocationCallOrder[0]).toBeLessThan(
      m.freigeben.mock.invocationCallOrder[0],
    );
    await waitFor(() => expect(m.kopfVon).toHaveBeenCalledTimes(2));
  });

  it('A9-1: ohne Recht „Routinen verwalten“ trotzdem freigegeben – ohne Mails, die Meldung sagt es', async () => {
    stelle(true);
    m.freigeben.mockResolvedValue();
    m.darfAblaeufeEinrichten.mockResolvedValue(false);
    ab.ablaeufeEinrichten.mockClear();
    const gemeldet = vi.fn();
    render(
      <VeranstaltungSeite
        id={91}
        reiter="vorbereiten"
        zeitzone={ZONE}
        formularAdresse="https://anmeldung.beispiel.de/"
        onZurueck={() => {}}
        onGeaendert={gemeldet}
      />,
    );
    fireEvent.click(await screen.findByRole('button', { name: 'Freigeben' }));
    await screen.findByRole('button', { name: 'Alwin Friesen' });
    fireEvent.click(screen.getByRole('button', { name: 'Jetzt freigeben' }));
    await waitFor(() => expect(m.freigeben).toHaveBeenCalledWith(91));
    expect(ab.ablaeufeEinrichten).not.toHaveBeenCalled();
    await waitFor(() =>
      expect(gemeldet).toHaveBeenCalledWith(
        expect.objectContaining({
          text: expect.stringMatching(/Routinen verwalten.*Standard-Mail/),
        }),
        false,
      ),
    );
  });

  it('A9-1: Karte „Mails“ – Entwurf, eingerichtet, noch nicht eingerichtet', async () => {
    stelle(true, 2);
    zeigen();
    const karte = await screen.findByRole('region', { name: 'Mails' });
    expect(within(karte).getByText('wird beim Freigeben eingerichtet')).toBeTruthy();
    expect(ab.ablaeufeLesen).not.toHaveBeenCalled();
    cleanup();
    stelle(true, 1);
    zeigen();
    const fertig = await screen.findByRole('region', { name: 'Mails' });
    await waitFor(() => expect(within(fertig).getByText('✓ Mitteilung mit Platz')).toBeTruthy());
    expect(within(fertig).getByText('Alwin Friesen')).toBeTruthy();
    // A9-2b: der Check-in-Code steht in der Karte – aus, solange er in ChurchTools aus ist.
    expect(within(fertig).getByText('Check-in-Code').nextSibling?.textContent).toBe('aus');
    cleanup();
    ab.ablaeufeLesen.mockResolvedValue({
      platz: false,
      warte: false,
      standardMail: true,
      absender: null,
      absenderId: null,
      eigen: { platz: OHNE_EIGENEN_TEXT, warte: OHNE_EIGENEN_TEXT },
      qr: false,
      loeschDatum: null,
      anmeldeschluss: null,
    });
    stelle(true, 1);
    zeigen();
    const alt = await screen.findByRole('region', { name: 'Mails' });
    await waitFor(() => expect(within(alt).getByText('noch nicht eingerichtet')).toBeTruthy());
    expect(within(alt).getByText(/Standard-Mail – ohne Betrag/)).toBeTruthy();
    // Noch nicht eingerichtet: nichts zu bearbeiten (das richtet erst A9-5 ein).
    expect(within(alt).queryByRole('button', { name: 'Bearbeiten' })).toBeNull();
  });

  it('A9-2a: mit Recht wird abgeglichen, ohne nur gelesen; „Bearbeiten“ öffnet das Fenster „Mails“', async () => {
    stelle(false, 1);
    zeigen();
    const nurLesen = await screen.findByRole('region', { name: 'Mails' });
    await waitFor(() => expect(within(nurLesen).getByText('✓ Mitteilung mit Platz')).toBeTruthy());
    expect(ab.ablaeufeAbgleichen).not.toHaveBeenCalled();
    expect(within(nurLesen).queryByRole('button', { name: 'Bearbeiten' })).toBeNull();
    cleanup();
    stelle(true, 1);
    zeigen();
    const karte = await screen.findByRole('region', { name: 'Mails' });
    await waitFor(() => expect(ab.ablaeufeAbgleichen).toHaveBeenCalledWith(91));
    fireEvent.click(await within(karte).findByRole('button', { name: 'Bearbeiten' }));
    expect(await screen.findByRole('dialog', { name: 'Mails' })).toBeTruthy();
    expect(screen.getByRole('textbox', { name: 'Betreff' })).toBeTruthy();
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

  it('freigegeben: Karte „Anmeldelink“ oben – Kopieren (kurz „Kopiert“), Öffnen, Teilen', async () => {
    stelle(true, 1);
    const kopieren = vi.fn().mockResolvedValue(undefined);
    const teilen = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: kopieren },
      configurable: true,
    });
    Object.defineProperty(navigator, 'share', { value: teilen, configurable: true });
    // Auch wenn der Test scheitert: Das Teilen-Menü darf nicht in den nächsten Test durchsickern.
    onTestFinished(() => void delete (navigator as { share?: unknown }).share);
    zeigen();
    const karte = await screen.findByRole('region', { name: 'Anmeldelink' });
    const LINK = 'https://anmeldung.beispiel.de/#ct.test/91';
    expect(await within(karte).findByRole('textbox', { name: 'Anmeldelink' })).toHaveProperty(
      'value',
      LINK,
    );
    expect(within(karte).getByRole('link', { name: 'Öffnen' }).getAttribute('href')).toBe(LINK);
    vi.useFakeTimers();
    try {
      fireEvent.click(within(karte).getByRole('button', { name: 'Kopieren' }));
      await act(async () => {});
      expect(kopieren).toHaveBeenCalledWith(LINK);
      expect(within(karte).getByRole('button', { name: 'Kopiert' })).toBeTruthy();
      await act(async () => {
        vi.advanceTimersByTime(1600);
      });
      expect(within(karte).getByRole('button', { name: 'Kopieren' })).toBeTruthy();
    } finally {
      vi.useRealTimers();
    }
    fireEvent.click(within(karte).getByRole('button', { name: 'Teilen' }));
    expect(teilen).toHaveBeenCalledWith({ title: 'Gemeindeessen', url: LINK });
  });

  it('Anmeldelink: nicht im Entwurf, nicht ohne Formular-Adresse; ohne Teilen-Menü kein „Teilen“', async () => {
    stelle(true, 2);
    zeigen();
    await screen.findByRole('region', { name: 'Termin' });
    expect(screen.queryByRole('region', { name: 'Anmeldelink' })).toBeNull();
    cleanup();
    stelle(true, 1);
    zeigen(null);
    await screen.findByRole('region', { name: 'Termin' });
    expect(screen.queryByRole('region', { name: 'Anmeldelink' })).toBeNull();
    cleanup();
    stelle(true, 1);
    zeigen();
    const karte = await screen.findByRole('region', { name: 'Anmeldelink' });
    await within(karte).findByRole('button', { name: 'Kopieren' });
    expect(within(karte).queryByRole('button', { name: 'Teilen' })).toBeNull();
  });

  it('Anmeldelink: nimmt ChurchTools nichts an → kein Link, was fehlt, „Jetzt einrichten“ öffnet das Freigeben', async () => {
    stelle(true, 1);
    m.anmeldeBedingungen.mockResolvedValue(['Die Gruppe hat keine Leitung.']);
    zeigen();
    const karte = await screen.findByRole('region', { name: 'Anmeldelink' });
    expect(await within(karte).findByText('Die Gruppe hat keine Leitung.')).toBeTruthy();
    expect(within(karte).queryByRole('textbox', { name: 'Anmeldelink' })).toBeNull();
    expect(m.anmeldeBedingungen).toHaveBeenCalledWith(91);
    fireEvent.click(within(karte).getByRole('button', { name: 'Jetzt einrichten' }));
    expect(await screen.findByRole('button', { name: 'Jetzt freigeben' })).toBeTruthy();
  });

  it('Anmeldelink: nach „Jetzt einrichten“ prüft die Karte neu und zeigt den Link', async () => {
    stelle(true, 1);
    m.freigeben.mockResolvedValue();
    // Erst gesperrt (Karte), danach nimmt ChurchTools an (Fenster nach dem Freigeben, Karte nach dem Neuladen).
    m.anmeldeBedingungen.mockResolvedValueOnce(['Die Gruppe hat keine Leitung.']);
    zeigen();
    const karte = await screen.findByRole('region', { name: 'Anmeldelink' });
    fireEvent.click(await within(karte).findByRole('button', { name: 'Jetzt einrichten' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Jetzt freigeben' }));
    await waitFor(() => expect(m.freigeben).toHaveBeenCalledWith(91));
    expect(
      await within(await screen.findByRole('region', { name: 'Anmeldelink' })).findByRole(
        'textbox',
        { name: 'Anmeldelink' },
      ),
    ).toBeTruthy();
    expect(screen.queryByText('Die Gruppe hat keine Leitung.')).toBeNull();
  });

  it('Anmeldelink: ohne Recht kein „Jetzt einrichten“, sondern wer es kann', async () => {
    stelle(false, 1);
    m.anmeldeBedingungen.mockResolvedValue(['Die Gruppe hat keine Leitung.']);
    zeigen();
    const karte = await screen.findByRole('region', { name: 'Anmeldelink' });
    expect(await within(karte).findByText('Einrichten kann die Leitung der Gruppe.')).toBeTruthy();
    expect(within(karte).queryByRole('button', { name: 'Jetzt einrichten' })).toBeNull();
  });

  it('Anmeldelink: fehlt nur der laufende Zeitraum → Link bleibt, mit Hinweis', async () => {
    stelle(true, 1);
    m.anmeldeBedingungen.mockResolvedValue([ZEITRAUM_ZU]);
    zeigen();
    const karte = await screen.findByRole('region', { name: 'Anmeldelink' });
    expect(await within(karte).findByRole('textbox', { name: 'Anmeldelink' })).toBeTruthy();
    expect(within(karte).getByText(/funktioniert, sobald er beginnt/)).toBeTruthy();
    expect(within(karte).queryByRole('alert')).toBeNull();
  });

  it('Anmeldelink: Prüfung scheitert vorübergehend → Link bleibt (nicht verstecken), mit Hinweis', async () => {
    stelle(true, 1);
    m.anmeldeBedingungen.mockRejectedValue(new ApiError(503, 'kurz weg'));
    zeigen();
    const karte = await screen.findByRole('region', { name: 'Anmeldelink' });
    expect(await within(karte).findByRole('textbox', { name: 'Anmeldelink' })).toBeTruthy();
    expect(within(karte).getByText(/ließ sich gerade nicht prüfen/)).toBeTruthy();
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

  it('Kontakt für Rückfragen (A6-4): ungültig → Speichern gesperrt; gültig → in die Einstellungen, auf der Karte', async () => {
    stelle(true);
    m.speichereAnmeldung.mockResolvedValue();
    zeigen();
    const karte = await screen.findByRole('region', { name: 'Anmeldung' });
    expect(within(karte).getByText('Kontakt')).toBeTruthy();
    fireEvent.click(within(karte).getByRole('button', { name: 'Bearbeiten' }));
    const feld = screen.getByLabelText('Kontakt für Rückfragen (E-Mail)');
    fireEvent.change(feld, { target: { value: 'kinder@' } });
    expect(screen.getByText('Bitte eine gültige E-Mail-Adresse eintragen.')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Speichern' })).toHaveProperty('disabled', true);
    fireEvent.change(feld, { target: { value: ' kinder@gemeinde.test ' } });
    fireEvent.click(screen.getByRole('button', { name: 'Speichern' }));
    await waitFor(() => expect(m.aendereEinstellungen).toHaveBeenCalled());
    const aendern = m.aendereEinstellungen.mock.calls[0][1];
    expect(aendern(neueEinstellungen('einfach')).kontakt).toBe('kinder@gemeinde.test');
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

  it('Bezahlung: Zahlarten der Gemeinde an- und abwählen (A7-2); keine gewählt → Speichern gesperrt', async () => {
    stelle(true, 2);
    m.speichereBezahlung.mockResolvedValue();
    zeigen();
    const karte = await screen.findByRole('region', { name: 'Bezahlung' });
    expect(within(karte).getByText('Überweisung, Bar, PayPal')).toBeTruthy();
    fireEvent.click(within(karte).getByRole('button', { name: 'Bearbeiten' }));
    fireEvent.click(screen.getByRole('button', { name: '✓ PayPal' }));
    expect(screen.getByRole('button', { name: 'PayPal' })).toHaveProperty('ariaPressed', 'false');
    fireEvent.click(screen.getByRole('button', { name: '✓ Überweisung' }));
    fireEvent.click(screen.getByRole('button', { name: '✓ Bar' }));
    expect(screen.getByText('Bitte mindestens eine Zahlart wählen.')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Speichern' })).toHaveProperty('disabled', true);
    fireEvent.click(screen.getByRole('button', { name: 'Bar' }));
    fireEvent.click(screen.getByRole('button', { name: 'Speichern' }));
    await waitFor(() =>
      expect(m.speichereBezahlung).toHaveBeenCalledWith(
        91,
        expect.objectContaining({ ohneZahlarten: ['PayPal', 'Überweisung'] }),
      ),
    );
  });

  it('Bezahlung: abgewählte Zahlarten fehlen auf der Karte (A7-2)', async () => {
    stelle(true, 2, {
      bezahlung: { ...neueEinstellungen('einfach').bezahlung, ohneZahlarten: ['PayPal'] },
    });
    zeigen();
    const karte = await screen.findByRole('region', { name: 'Bezahlung' });
    expect(within(karte).getByText('Überweisung, Bar')).toBeTruthy();
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
        ohneZahlarten: [],
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
      <VeranstaltungSeite
        id={91}
        reiter="vorbereiten"
        zeitzone={ZONE}
        onZurueck={() => {}}
        onGeaendert={geaendert}
      />,
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

describe('Nachprüfung (A6-5c, #623)', () => {
  const karten = () =>
    [...document.querySelectorAll('section[aria-label]')].map((x) => x.getAttribute('aria-label'));

  it('Entwurf → keine Nachprüfung, nichts geladen', async () => {
    mg.ladeMitglieder.mockClear();
    stelle(true, 2);
    zeigen();
    await screen.findByRole('region', { name: 'Anmeldung' });
    expect(mg.ladeMitglieder).not.toHaveBeenCalled();
    expect(screen.queryByRole('region', { name: 'Nachprüfung' })).toBeNull();
  });

  it('alles stimmt → klein unten bei den Anmeldungen (U1), „Alles stimmt ✓“; unter „Vorbereiten“ nicht', async () => {
    stelle(true, 1);
    mg.ladeMitglieder.mockResolvedValue(STAND);
    np.nachpruefungAus.mockReturnValue(PRUEF_OK);
    zeigen(undefined, 'anmeldungen');
    expect(await screen.findByText('Alles stimmt ✓')).toBeTruthy();
    expect(screen.getByText('Alle 3 Beträge stimmen.')).toBeTruthy();
    expect(karten().indexOf('Nachprüfung')).toBeGreaterThan(karten().indexOf('Anmeldungen'));
    cleanup();
    zeigen();
    await screen.findByRole('region', { name: 'Anmeldung' });
    expect(screen.queryByRole('region', { name: 'Nachprüfung' })).toBeNull();
  });

  it('mit Hinweisen → oben unter dem Anmeldelink, mit Grund und Beträgen', async () => {
    stelle(true, 1);
    mg.ladeMitglieder.mockResolvedValue(STAND);
    np.nachpruefungAus.mockReturnValue(PRUEF_HINWEISE);
    zeigen();
    expect(await screen.findByText('3 Hinweise')).toBeTruthy();
    // Auswahl fehlt: keine geratene Zahl.
    const nummer = screen.getByText(/Keine Auswahl gespeichert/).closest('li')!;
    expect(nummer.textContent).toMatch(/gemeldet 15,00 €$/);
    expect(karten().indexOf('Nachprüfung')).toBeLessThan(karten().indexOf('Anmeldung'));
    // „Platz frei – jemand wartet“ steht seit U2-1 in der Kachel und im Reiter Warteliste, nicht in der Nachprüfung.
    expect(screen.queryByText(/Platz ist frei, aber/)).toBeNull();
    expect(screen.getByText('Betrag weicht von den Regeln ab – bitte prüfen')).toBeTruthy();
    expect(screen.getByText(/gemeldet nichts|gemeldet 0,00 €/)).toBeTruthy();
  });

  it('auch ohne Bearbeiten-Recht sichtbar; Mitglieder nicht lesbar (null) → keine Karte', async () => {
    stelle(false, 1);
    mg.ladeMitglieder.mockResolvedValue(null);
    zeigen();
    await screen.findByText(/Einrichten und freigeben kann die Leitung/);
    await waitFor(() => expect(mg.ladeMitglieder).toHaveBeenCalled());
    expect(screen.queryByRole('region', { name: 'Nachprüfung' })).toBeNull();
  });

  it('„Neu prüfen“: die Karte bleibt während des Prüfens oben (springt nicht)', async () => {
    stelle(true, 1);
    let fertig: (n: typeof STAND) => void = () => {};
    np.nachpruefungAus.mockReturnValue(PRUEF_HINWEISE);
    mg.ladeMitglieder
      .mockResolvedValueOnce(STAND)
      .mockImplementationOnce(() => new Promise((r) => (fertig = r)));
    zeigen();
    await screen.findByText('3 Hinweise');
    fireEvent.click(screen.getByRole('button', { name: 'Neu prüfen' }));
    expect(await screen.findByRole('button', { name: 'Prüft …' })).toHaveProperty('disabled', true);
    expect(karten().indexOf('Nachprüfung')).toBeLessThan(karten().indexOf('Anmeldung'));
    await act(async () => fertig(STAND));
    expect(screen.getByText('3 Hinweise')).toBeTruthy();
  });

  it('scheitert vorübergehend → Meldung, „Neu prüfen“ lädt noch einmal', async () => {
    stelle(true, 1);
    np.nachpruefungAus.mockReturnValue(PRUEF_OK);
    mg.ladeMitglieder.mockRejectedValueOnce(new Error('502')).mockResolvedValueOnce(STAND);
    zeigen(undefined, 'anmeldungen');
    expect(await screen.findByText(/Ließ sich gerade nicht prüfen/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Neu prüfen' }));
    expect(await screen.findByText('Alles stimmt ✓')).toBeTruthy();
  });
});

describe('Reiter Anmeldungen (A7-2)', () => {
  it('nach „bezahlt“ lädt die Seite auch die Einstellungen neu – das erste „bezahlt“ kann das Feld „Zahlart“ anlegen', async () => {
    stelle(true, 1, eListe());
    mg.ladeMitglieder.mockResolvedValue({
      ...standListe(mitgliederListe('AAAAAA', [true, true], 10)),
      verlaufGekuerzt: false,
    });
    np.nachpruefungAus.mockReturnValue(PRUEF_OK);
    render(
      <VeranstaltungSeite
        id={91}
        reiter="anmeldungen"
        zeitzone={ZONE}
        formularAdresse="https://anmeldung.beispiel.de/"
        onZurueck={() => {}}
      />,
    );
    fireEvent.click(await screen.findByRole('button', { name: /Maria Beispiel/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Als bezahlt markieren' }));
    await waitFor(() => expect(za.zahlungSpeichern).toHaveBeenCalled());
    await waitFor(() => expect(m.einstellungenVon).toHaveBeenCalledTimes(2));
    // Das Fenster bleibt dabei offen.
    expect(screen.getByText(/Für die ganze Anmeldung/)).toBeTruthy();
  });
});

describe('QR-Code und Aushang (A8-4)', () => {
  it('vierter Knopf der Karte: QR zum Link, Bild teilen, Aushang mit Termin und Anmeldeschluss in Ortszeit', async () => {
    stelle(true, 1, {
      termin: { beginn: '2026-11-21T12:00', ende: null, ort: 'Gemeindehaus', terminId: null },
    });
    // 0:30 Uhr Ortszeit am 11.11. ist in UTC noch der 10.11. – gezeigt wird der Tag in Ortszeit.
    m.anmeldungVon.mockResolvedValue({
      maxPlaetze: null,
      warteliste: false,
      ab: null,
      bis: '2026-11-10T23:30:00Z',
    });
    zeigen();
    const karte = await screen.findByRole('region', { name: 'Anmeldelink' });
    fireEvent.click(await within(karte).findByRole('button', { name: 'QR-Code' }));
    const LINK = 'https://anmeldung.beispiel.de/#ct.test/91';
    expect(screen.getByRole('img', { name: `QR-Code zu ${LINK}` })).toBeTruthy();
    const aushang = await screen.findByRole('button', { name: 'Aushang als PDF' });
    // Fenster wie ChurchTools (E6-O F4): beide Wege unten rechts, der Aushang als Hauptknopf zuletzt.
    expect(fensterKnoepfe()[0]).toBe('Fenster schließen');
    expect(fensterKnoepfe().slice(-3)).toEqual([
      'Abbrechen',
      'QR-Code als Bild',
      'Aushang als PDF',
    ]);
    fireEvent.click(screen.getByRole('button', { name: 'QR-Code als Bild' }));
    expect(tf.shareOrDownload.mock.calls[0][1]).toBe('Gemeindeessen – QR-Code.png');
    fireEvent.click(aushang);
    const [doc, name] = tp.sharePdf.mock.calls[0];
    expect(name).toBe('Gemeindeessen – Aushang');
    const roh = doc.output();
    for (const t of [
      '(Gemeindeessen)',
      '(Sa, 21.11.2026 · Gemeindehaus)',
      '(Jetzt anmelden)',
      `(${LINK})`,
      '(Anmeldung bis Mi, 11.11.2026)',
    ])
      expect(roh).toContain(t);
  });
});

/** Fenster wie ChurchTools (E6-O F4): X oben rechts, die Knöpfe unten rechts – der Hauptknopf zuletzt. */
describe('Fenster der Veranstaltung im ChurchTools-Aufbau', () => {
  const oeffne = async (karte: string) => {
    zeigen();
    const k = await screen.findByRole('region', { name: karte });
    fireEvent.click(within(k).getByRole('button', { name: 'Bearbeiten' }));
  };

  it('Anmeldung, Wer meldet sich an?, Bezahlung, Datenschutz: unten „Abbrechen · Speichern“', async () => {
    for (const karte of ['Anmeldung', 'Wer meldet sich an?', 'Bezahlung', 'Datenschutz']) {
      stelle(true);
      await oeffne(karte);
      expect(fensterKnoepfe()[0]).toBe('Fenster schließen');
      expect(fensterKnoepfe().slice(-2)).toEqual(['Abbrechen', 'Speichern']);
      cleanup();
    }
  });

  it('Termin: „Aus dem Kalender“ wählt per Tipp – unten nur „Abbrechen“; „Neu anlegen“ mit Hauptknopf', async () => {
    stelle(true);
    await oeffne('Termin');
    // Erst wenn der Kalender geladen ist, gäbe es überhaupt einen Hauptknopf – davor prüfen hieße nichts prüfen.
    await screen.findByRole('textbox', { name: 'Link zur Anmeldung' });
    expect(fensterKnoepfe().at(-1)).toBe('Abbrechen');
    fireEvent.click(await screen.findByRole('button', { name: 'Neu anlegen' }));
    expect(fensterKnoepfe().slice(-2)).toEqual(['Abbrechen', 'Termin anlegen und übernehmen']);
  });

  it('Freigeben: „Abbrechen · Jetzt freigeben“; danach „noch nicht offen“ nur „Verstanden“', async () => {
    stelle(true);
    m.freigeben.mockResolvedValue();
    m.anmeldeBedingungen.mockResolvedValue(['Der Anmeldezeitraum hat noch nicht begonnen.']);
    zeigen();
    fireEvent.click(await screen.findByRole('button', { name: 'Freigeben' }));
    await screen.findByRole('button', { name: 'Alwin Friesen' });
    expect(fensterKnoepfe().slice(-2)).toEqual(['Abbrechen', 'Jetzt freigeben']);
    fireEvent.click(screen.getByRole('button', { name: 'Jetzt freigeben' }));
    await screen.findByText('Freigegeben – aber noch nicht offen');
    expect(fensterKnoepfe()).toEqual(['Fenster schließen', 'Verstanden']);
  });

  it('Freigeben: während es läuft, sind X und „Abbrechen“ gesperrt', async () => {
    stelle(true);
    m.freigeben.mockReturnValue(new Promise(() => {}));
    zeigen();
    fireEvent.click(await screen.findByRole('button', { name: 'Freigeben' }));
    await screen.findByRole('button', { name: 'Alwin Friesen' });
    fireEvent.click(screen.getByRole('button', { name: 'Jetzt freigeben' }));
    await screen.findByRole('button', { name: 'Wird freigegeben …' });
    expect(screen.getByRole('button', { name: 'Fenster schließen' })).toHaveProperty(
      'disabled',
      true,
    );
    expect(
      within(screen.getByRole('dialog')).getByRole('button', { name: 'Abbrechen' }),
    ).toHaveProperty('disabled', true);
  });

  it('Neue Veranstaltung: unten „Abbrechen · Anlegen“', () => {
    render(
      <NeueVeranstaltung
        teams={[{ id: 7, name: 'Technik', leitung: false }]}
        artId={5}
        onFertig={() => {}}
        onClose={() => {}}
      />,
    );
    expect(knopfFolge()[0]).toBe('Fenster schließen');
    expect(knopfFolge().slice(-2)).toEqual(['Abbrechen', 'Anlegen']);
  });
});

describe('Löschen (A9-3a)', () => {
  /** Termin weit in der Vergangenheit bzw. Zukunft – damit die Tests nicht am heutigen Datum hängen. */
  const termin = (tag: string) => ({
    termin: { beginn: `${tag}T10:00`, ende: `${tag}T18:00`, ort: '', terminId: 1 },
  });
  const stand = (x: Partial<AB.AblaufStand>) =>
    ab.ablaeufeLesen.mockResolvedValue({
      platz: true,
      warte: true,
      standardMail: false,
      absender: 'Alwin Friesen',
      absenderId: 1,
      eigen: { platz: OHNE_EIGENEN_TEXT, warte: OHNE_EIGENEN_TEXT },
      qr: false,
      loeschDatum: null,
      anmeldeschluss: null,
      ...x,
    });
  const karte = () => screen.findByRole('region', { name: 'Datenschutz' });

  it('Karte: das Datum aus ChurchTools; ohne Termin kein Löschdatum; erreicht und nicht eingetragen → Hinweis', async () => {
    stand({ loeschDatum: '2099-04-15' });
    stelle(true, 1, termin('2099-01-15'));
    zeigen();
    await waitFor(async () =>
      expect((await karte()).textContent).toMatch(
        /15\.04\.2099.*entfernt ChurchTools alle.*Anmeldeschluss ist darum spätestens .*14\.04\.2099\./,
      ),
    );
    cleanup();
    stelle(true, 1);
    zeigen();
    expect((await karte()).textContent).toMatch(/kein Löschdatum.*Ohne Termin/);
    cleanup();
    stand({ loeschDatum: '2099-04-15', loeschenOffen: '2020-04-15' });
    stelle(true, 1, termin('2020-01-15'));
    zeigen();
    await waitFor(async () =>
      expect((await karte()).textContent).toMatch(/15\.04\.2020 – schon erreicht/),
    );
    cleanup();
    // Schon eingetragen und erreicht (nach „Jetzt löschen“): nicht mehr „dann entfernt …“.
    stand({ loeschDatum: '2020-04-15' });
    stelle(true, 1, termin('2020-01-15'));
    zeigen();
    await waitFor(async () =>
      expect((await karte()).textContent).toMatch(
        /15\.04\.2020ChurchTools hat die Anmeldungen entfernt, die Anmeldung ist geschlossen\./,
      ),
    );
  });

  it('Frist so, dass das Datum erreicht ist: Rückfrage mit Zahl; „Zurück“ speichert nichts, „Jetzt … löschen“ ohne Rückgängig', async () => {
    stand({ loeschDatum: '2099-04-15' });
    stelle(true, 1, termin('2020-01-15'));
    m.anmeldungenZahl.mockResolvedValue(3);
    const geaendert = vi.fn();
    render(
      <VeranstaltungSeite
        id={91}
        reiter="vorbereiten"
        zeitzone={ZONE}
        onZurueck={() => {}}
        onGeaendert={geaendert}
      />,
    );
    const k = await karte();
    await waitFor(() => expect(within(k).getByRole('button', { name: 'Bearbeiten' })).toBeTruthy());
    fireEvent.click(within(k).getByRole('button', { name: 'Bearbeiten' }));
    expect(
      screen.getByText(
        /^Am .* entfernt ChurchTools alle Anmeldungen mit allen Angaben.*Anmeldeschluss ist darum spätestens/,
      ),
    ).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Speichern' }));
    expect(screen.getByText('Sofort löschen?')).toBeTruthy();
    expect(screen.getByText(/sofort alle 3 Anmeldungen/)).toBeTruthy();
    expect(screen.getByText(/die Anmeldung wird geschlossen/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Zurück' }));
    expect(m.aendereEinstellungen).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Speichern' }));
    fireEvent.click(screen.getByRole('button', { name: 'Jetzt 3 Anmeldungen löschen' }));
    await waitFor(() => expect(geaendert).toHaveBeenCalled());
    expect(ab.ablaeufeEinrichten).toHaveBeenCalledWith(91, 1, undefined, undefined, {
      loeschenBestaetigt: true,
      heute: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
    });
    expect(geaendert.mock.calls[0][0]).toEqual({
      text: 'Löschfrist gespeichert – die Anmeldungen sind entfernt.',
      rueckgaengig: null,
    });
  });

  it('Rückfrage bei einer einzigen Anmeldung: „die eine Anmeldung“, nicht „alle 1 Anmeldungen“', async () => {
    stand({ loeschDatum: '2099-04-15' });
    stelle(true, 1, termin('2020-01-15'));
    m.anmeldungenZahl.mockResolvedValue(1);
    zeigen();
    const k = await karte();
    await waitFor(() => expect(within(k).getByRole('button', { name: 'Bearbeiten' })).toBeTruthy());
    fireEvent.click(within(k).getByRole('button', { name: 'Bearbeiten' }));
    fireEvent.click(screen.getByRole('button', { name: 'Speichern' }));
    expect(screen.getByText(/sofort die eine Anmeldung/)).toBeTruthy();
    expect(screen.queryByText(/alle 1 Anmeldungen/)).toBeNull();
    expect(screen.getByRole('button', { name: 'Jetzt eine Anmeldung löschen' })).toBeTruthy();
  });

  it('Datum in der Zukunft: ohne Rückfrage gespeichert und in die Abläufe geschrieben, mit Rückgängig', async () => {
    stand({ loeschDatum: '2099-04-15' });
    stelle(true, 1, termin('2099-01-15'));
    const geaendert = vi.fn();
    render(
      <VeranstaltungSeite
        id={91}
        reiter="vorbereiten"
        zeitzone={ZONE}
        onZurueck={() => {}}
        onGeaendert={geaendert}
      />,
    );
    const k = await karte();
    await waitFor(() => expect(within(k).getByRole('button', { name: 'Bearbeiten' })).toBeTruthy());
    fireEvent.click(within(k).getByRole('button', { name: 'Bearbeiten' }));
    fireEvent.change(screen.getByLabelText('Monate nach dem Ende (1–36)'), {
      target: { value: '6' },
    });
    expect(screen.getByText(/15\.07\.2099/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Speichern' }));
    await waitFor(() => expect(geaendert).toHaveBeenCalled());
    expect(screen.queryByText('Sofort löschen?')).toBeNull();
    expect(ab.ablaeufeEinrichten).toHaveBeenCalledWith(91, 1, undefined, undefined, {
      loeschenBestaetigt: false,
      heute: expect.any(String),
    });
    expect(geaendert.mock.calls[0][0].rueckgaengig).toBeTypeOf('function');
  });

  it('Abgleich zieht den Anmeldeschluss vor → die Karte „Anmeldung“ zeigt ihn gleich, ohne neu zu laden', async () => {
    stand({ loeschDatum: '2099-04-15', anmeldeschluss: '2099-04-14T21:59:00Z' });
    stelle(true, 1, termin('2099-01-15'));
    m.anmeldungVon.mockResolvedValue({
      maxPlaetze: null,
      warteliste: false,
      ab: '2099-01-01T00:00:00Z',
      bis: null,
    });
    zeigen();
    const k = await screen.findByRole('region', { name: 'Anmeldung' });
    await waitFor(() => expect(k.textContent).toMatch(/bis .*14\.04\.2099/));
    expect(m.anmeldungVon).toHaveBeenCalledTimes(1);
  });

  it('Fenster „Anmeldung“ mit Löschdatum: Schluss nur bis zum Vortag – leer oder später lässt sich nicht speichern', async () => {
    stand({ loeschDatum: '2099-04-15', anmeldeschluss: '2099-04-14T21:59:00Z' });
    stelle(true, 1, termin('2099-01-15'));
    m.speichereAnmeldung.mockResolvedValue();
    zeigen();
    const k = await screen.findByRole('region', { name: 'Anmeldung' });
    await waitFor(() => expect(k.textContent).toMatch(/14\.04\.2099/));
    fireEvent.click(within(k).getByRole('button', { name: 'Bearbeiten' }));
    const schluss = screen.getByLabelText('Anmeldeschluss');
    expect(schluss.getAttribute('max')).toBe('2099-04-14');
    expect(screen.getByText(/entfernt ChurchTools alle Anmeldungen \(Datenschutz\)/)).toBeTruthy();
    const speichern = () => screen.getByRole('button', { name: 'Speichern' });
    fireEvent.change(schluss, { target: { value: '' } });
    expect(speichern()).toHaveProperty('disabled', true);
    fireEvent.change(schluss, { target: { value: '2099-04-15' } });
    expect(speichern()).toHaveProperty('disabled', true);
    fireEvent.change(schluss, { target: { value: '2099-04-14' } });
    expect(speichern()).toHaveProperty('disabled', false);
    fireEvent.click(speichern());
    await waitFor(() =>
      expect(m.speichereAnmeldung).toHaveBeenCalledWith(
        91,
        expect.objectContaining({ bis: '2099-04-14T21:59:00Z' }),
      ),
    );
  });

  it('im Entwurf: nur die Frist – die Abläufe richtet erst das Freigeben ein', async () => {
    stelle(true, 2, termin('2020-01-15'));
    zeigen();
    const k = await karte();
    expect(k.textContent).toMatch(/wird beim Freigeben eingerichtet/);
    fireEvent.click(within(k).getByRole('button', { name: 'Bearbeiten' }));
    fireEvent.click(screen.getByRole('button', { name: 'Speichern' }));
    await waitFor(() => expect(m.aendereEinstellungen).toHaveBeenCalled());
    expect(screen.queryByText('Sofort löschen?')).toBeNull();
    expect(ab.ablaeufeEinrichten).not.toHaveBeenCalled();
  });
});

describe('Seitengerüst (U1): zwei Bereiche, Einstieg je nach Stand', () => {
  const seite = (reiter?: Reiter) => {
    const onReiter = vi.fn();
    render(
      <VeranstaltungSeite
        id={91}
        reiter={reiter}
        onReiter={onReiter}
        zeitzone={ZONE}
        formularAdresse="https://anmeldung.beispiel.de/"
        onZurueck={() => {}}
      />,
    );
    return onReiter;
  };
  const bereich = (name: string) =>
    within(screen.getByRole('navigation', { name: 'Bereiche' })).getByRole('button', { name });

  it('Entwurf ohne Angabe → „Vorbereiten“ mit der Schrittleiste; „Anmeldungen“ führt in die Liste', async () => {
    stelle(true, 2);
    const onReiter = seite();
    expect(await screen.findByRole('region', { name: 'Termin' })).toBeTruthy();
    expect(screen.getByRole('region', { name: 'Nächster Schritt' })).toBeTruthy();
    expect(screen.queryByRole('region', { name: 'Kennzahlen' })).toBeNull();
    expect(bereich('Vorbereiten').getAttribute('aria-pressed')).toBe('true');
    fireEvent.click(bereich('Anmeldungen'));
    expect(onReiter).toHaveBeenCalledWith('anmeldungen');
  });

  it('freigegeben ohne Angabe → „Anmeldungen“ mit den Kennzahlen, ohne Schrittleiste', async () => {
    stelle(true, 1, eListe());
    mg.ladeMitglieder.mockResolvedValue({
      ...standListe(mitgliederListe('AAAAAA', [true, false], 10)),
      verlaufGekuerzt: false,
    });
    np.nachpruefungAus.mockReturnValue(PRUEF_OK);
    seite();
    expect(await screen.findByRole('region', { name: 'Kennzahlen' })).toBeTruthy();
    expect(bereich('Anmeldungen').getAttribute('aria-pressed')).toBe('true');
    expect(screen.queryByRole('region', { name: 'Termin' })).toBeNull();
    expect(screen.queryByRole('region', { name: 'Nächster Schritt' })).toBeNull();
  });

  it('Kachel „Warteliste“ → Bereich „Anmeldungen“, die Liste beginnt mit der Warteliste', async () => {
    stelle(true, 1, eListe());
    mg.ladeMitglieder.mockResolvedValue({
      ...standListe(mitgliederListe('AAAAAA', [true, false], 10)),
      verlaufGekuerzt: false,
    });
    np.nachpruefungAus.mockReturnValue(PRUEF_OK);
    const onReiter = seite('anmeldungen');
    const kz = await screen.findByRole('region', { name: 'Kennzahlen' });
    await waitFor(() => expect(within(kz).getByText('1 Anmeldung')).toBeTruthy());
    const chip = () =>
      within(screen.getByRole('region', { name: 'Anmeldungen' })).getByRole('button', {
        name: /^Warteliste/,
      });
    expect(chip().getAttribute('aria-pressed')).toBe('false');
    fireEvent.click(within(kz).getByText('Warteliste'));
    expect(onReiter).toHaveBeenCalledWith('anmeldungen');
    expect(chip().getAttribute('aria-pressed')).toBe('true');
  });

  it('Karte „Formular“ öffnet den Baukasten; „‹ Zurück“ und der Reiter „Vorbereiten“ führen zurück', async () => {
    stelle(true, 2);
    const onReiter = seite('vorbereiten');
    const karte = await screen.findByRole('region', { name: 'Formular' });
    fireEvent.click(within(karte).getByRole('button', { name: 'Bearbeiten' }));
    expect(onReiter).toHaveBeenCalledWith('formular');
    cleanup();
    const zurueck = seite('formular');
    fireEvent.click(await screen.findByRole('button', { name: 'Zurück' }));
    expect(zurueck).toHaveBeenCalledWith('vorbereiten');
    expect(bereich('Vorbereiten').getAttribute('aria-pressed')).toBe('true');
    zurueck.mockClear();
    fireEvent.click(bereich('Vorbereiten'));
    expect(zurueck).toHaveBeenCalledWith('vorbereiten');
  });

  it('Schrittleiste: der Knopf des nächsten Schritts öffnet sein Fenster', async () => {
    stelle(true, 2, { termin: null });
    seite();
    fireEvent.click(await screen.findByRole('button', { name: 'Termin wählen' }));
    expect(await screen.findByRole('dialog', { name: 'Termin' })).toBeTruthy();
  });
});
