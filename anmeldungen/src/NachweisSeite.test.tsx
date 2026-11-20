// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { ApiError, NichtUebernommen } from '@ui/ct/fehler';
import { HANDY_BREITE } from '@ui/bedienung/useMedienAbfrage';
import { plusTage } from '@shared/ct/datum';
import { heuteImKalender } from '@shared/ct/zeit';
import { NACHWEIS_FELDER, type NachweisEinstellungen } from '@shared/anmeldung/nachweise';
import { antragVorgabe } from '@shared/anmeldung/nachweisAntrag';
import { plusJahre } from '@shared/anmeldung/nachweisStand';
import { NACHWEIS_SCHRITTE, type NachweisErgebnis } from './nachweisArten';
import * as Arten from './nachweisArten';
import * as Einsicht from './nachweisEinsicht';
import type { NachweisArtMitPersonen, NachweisPerson } from './nachweisPersonen';
import { offeneAufgabe } from './nachweisArten.testutil';
import { NachweisSeite, type NachweisFilter } from './NachweisSeite';

/**
 * Seite „Nachweise“ und Fenster „Nachweis-Art“ (N1b) mit ersetztem `nachweisArten` – was ChurchTools tut, prüft
 * `nachweisArten.test.ts`; hier geht es um das, was die Person sieht und anstößt.
 */
vi.mock('./nachweisArten', async (original) => ({
  ...(await original<typeof import('./nachweisArten')>()),
  nachweiseSeiteLaden: vi.fn(),
  nachweisArtSichern: vi.fn(),
  ichLaden: vi.fn(),
  gemeindeLogoLaden: vi.fn(),
  antragLaden: vi.fn(),
}));
vi.mock('./nachweisEinsicht', async (original) => ({
  ...(await original<typeof import('./nachweisEinsicht')>()),
  einsichtFesthalten: vi.fn(),
}));
const einsichtSchreiben = vi.mocked(Einsicht.einsichtFesthalten);
const arten = vi.mocked(Arten);

const E: NachweisEinstellungen = {
  gueltigJahre: 3,
  ab: 'ausstellung',
  betreff: 'Bitte Führungszeugnis beantragen',
  text: 'Hallo [Vorname], bitte beantrage ein Führungszeugnis.',
};
const FZ: NachweisArtMitPersonen = {
  id: 61,
  gruppenName: 'Nachweis: Führungszeugnis',
  name: 'Führungszeugnis',
  einstellungen: E,
  vertrauen: [
    { personId: 7, name: 'Anna Leitung' },
    { personId: 8, name: 'Ben Leitung' },
  ],
  personen: [],
};
const grundlage = (darfEinrichten: boolean) => ({
  typId: 11,
  rechtFehlt: false,
  darfEinrichten,
});

const alles: NachweisErgebnis = {
  gruppeId: 99,
  vorlageId: null,
  erledigt: [...NACHWEIS_SCHRITTE],
  fehler: null,
  befund: {
    gruppeId: 99,
    gruppenName: 'Nachweis: JuLeiCa',
    felder: NACHWEIS_FELDER.map((f) => f.name),
    vertrauen: [{ personId: 7, name: 'Anna Leitung' }],
    ablauf: { an: true, schritte: 4 },
    antrag: null,
  },
};

const seite = (g = grundlage(true), liste: NachweisArtMitPersonen[] = [FZ]) =>
  arten.nachweiseSeiteLaden.mockResolvedValue({ grundlage: g, arten: liste });
const oeffnen = (
  filter: NachweisFilter = 'alle',
  onFilter: (f: NachweisFilter) => void = () => {},
) =>
  render(
    <NachweisSeite
      filter={filter}
      onFilter={onFilter}
      onZurueck={() => {}}
      onGeaendert={() => {}}
    />,
  );

beforeEach(() => {
  arten.ichLaden.mockResolvedValue({ personId: 7, name: 'Anna Leitung' });
  arten.gemeindeLogoLaden.mockResolvedValue('https://ct.example/images/1/logo.png');
  arten.antragLaden.mockResolvedValue(null);
});

describe('Seite „Nachweise“', () => {
  it('zeigt die Arten mit Gültigkeit und Vertrauenspersonen', async () => {
    seite();
    oeffnen();
    expect(await screen.findByText('Führungszeugnis')).toBeTruthy();
    expect(screen.getByText('3 Jahre ab Ausstellung · ohne Antrag')).toBeTruthy();
    expect(screen.getByText('Vertrauenspersonen: Anna Leitung, Ben Leitung')).toBeTruthy();
  });

  it('mit „Berechtigungen verwalten“: „Neue Nachweis-Art“ und „Nachweis-Art bearbeiten“ im ⋯-Menü', async () => {
    seite();
    oeffnen();
    await screen.findByText('Führungszeugnis');
    expect(screen.getByRole('button', { name: 'Neue Nachweis-Art' })).toBeTruthy();
    // Kein eigener „Bearbeiten“-Knopf mehr (R6): Seltenes liegt im Menü.
    expect(screen.queryByRole('button', { name: 'Führungszeugnis bearbeiten' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Führungszeugnis: Mehr' }));
    expect(screen.getByText('Nachweis-Art bearbeiten')).toBeTruthy();
  });

  it('ohne das Recht (Vertrauensperson): nur ansehen – und der Hinweis sagt, wer anlegen darf', async () => {
    seite(grundlage(false));
    oeffnen();
    await screen.findByText('Führungszeugnis');
    expect(screen.queryByRole('button', { name: 'Neue Nachweis-Art' })).toBeNull();
    expect(screen.queryByRole('button', { name: /Mehr/ })).toBeNull();
    expect(screen.queryByText('Nachweis-Art bearbeiten')).toBeNull();
    expect(screen.getByText(/„Berechtigungen verwalten“ hat/)).toBeTruthy();
  });

  it('keine Art: sagt es – und bietet das Anlegen an', async () => {
    seite(grundlage(true), []);
    oeffnen();
    expect(await screen.findByText('Es gibt noch keine Nachweis-Art.')).toBeTruthy();
    expect(screen.getByText(/legst du die erste an/)).toBeTruthy();
  });

  it('ChurchTools antwortet nicht: Fehlerkasten mit „Erneut versuchen“, keine leere Liste', async () => {
    arten.nachweiseSeiteLaden
      .mockRejectedValueOnce(new ApiError(503, 'weg'))
      .mockResolvedValueOnce({ grundlage: grundlage(true), arten: [FZ] });
    oeffnen();
    expect(await screen.findByText(/antwortet gerade nicht/)).toBeTruthy();
    expect(screen.queryByText('Es gibt noch keine Nachweis-Art.')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Erneut versuchen' }));
    expect(await screen.findByText('Führungszeugnis')).toBeTruthy();
  });

  it('„Rollen fehlen“ (422) sieht nicht aus wie „antwortet nicht“', async () => {
    arten.nachweiseSeiteLaden.mockRejectedValue(
      new ApiError(422, 'Der Gruppentyp „Nachweis“ hat nicht beide Rollen.'),
    );
    oeffnen();
    expect(await screen.findByText(/nicht beide Rollen/)).toBeTruthy();
    expect(screen.queryByText(/antwortet gerade nicht/)).toBeNull();
  });

  it('eine Art ohne Einstellungen heißt „noch nicht fertig eingerichtet“', async () => {
    seite(grundlage(true), [{ ...FZ, einstellungen: null }]);
    oeffnen();
    expect(await screen.findByText(/Noch nicht fertig eingerichtet/)).toBeTruthy();
  });

  it('Vertrauenspersonen nicht lesbar: sagt es, behauptet nicht „keine“', async () => {
    seite(grundlage(true), [{ ...FZ, vertrauen: null }]);
    oeffnen();
    expect(await screen.findByText(/für dich nicht sichtbar/)).toBeTruthy();
  });
});

/** „⋯“ der Art öffnen und „Nachweis-Art bearbeiten“ wählen. */
const bearbeiten = async () => {
  fireEvent.click(await screen.findByRole('button', { name: 'Führungszeugnis: Mehr' }));
  fireEvent.click(screen.getByText('Nachweis-Art bearbeiten'));
};

// ── Stand je Person (N2a) ────────────────────────────────────────────────────────────────────────────────────────

const HEUTE = heuteImKalender();
const P = (personId: number, name: string, p: Partial<NachweisPerson> = {}): NachweisPerson => ({
  personId,
  name,
  eingesehenAm: null,
  ausgestelltAm: null,
  ergebnis: null,
  aufgabe: null,
  profil: null,
  ...p,
});
/** Eingesehen; „Gültig bis“ liegt `tage` Tage nach heute (3 Jahre ab Ausstellung). */
const eingesehen = (tage: number, p: Partial<NachweisPerson> = {}): Partial<NachweisPerson> => ({
  eingesehenAm: plusTage(HEUTE, -5),
  ausgestelltAm: plusJahre(plusTage(HEUTE, tage), -3),
  ...p,
});
const LUECKE_PROFIL = { geburtstag: null, strasse: 'Hauptstr. 4', plz: '53797', ort: 'Lohmar' };
const MIT_ANTRAG: NachweisEinstellungen = { ...E, antrag: antragVorgabe('ECG Donrath') };

const LENA = P(1, 'Lena Probst', {
  aufgabe: offeneAufgabe(plusTage(HEUTE, -35)),
  profil: LUECKE_PROFIL,
});
const JONAS = P(2, 'Jonas Beispiel', eingesehen(900, { ergebnis: 'eintrag' }));
const MIA = P(3, 'Mia Muster', eingesehen(30));
const TOM = P(4, 'Tom Klein', eingesehen(900));
const PAULA = P(5, 'Paula Messnull', { aufgabe: offeneAufgabe(plusTage(HEUTE, -1)) });
const FZ_STAND: NachweisArtMitPersonen = {
  ...FZ,
  einstellungen: MIT_ANTRAG,
  personen: [TOM, PAULA, MIA, JONAS, LENA],
};
const JULEICA: NachweisArtMitPersonen = {
  ...FZ,
  id: 62,
  gruppenName: 'Nachweis: JuLeiCa',
  name: 'JuLeiCa',
  personen: [P(6, 'Sara Weber', eingesehen(900))],
};

const handyAn = () => {
  window.matchMedia = ((q: string) => ({
    matches: q === HANDY_BREITE,
    media: q,
    addEventListener: () => {},
    removeEventListener: () => {},
  })) as unknown as typeof window.matchMedia;
};
afterEach(() => {
  // @ts-expect-error jsdom hat von Haus aus kein matchMedia
  delete window.matchMedia;
});

describe('Seite „Nachweise“: Stand je Person', () => {
  it('je Art eine Karte mit ihrem Kopf: Name, Gültigkeit, Antrag, Vertrauenspersonen', async () => {
    seite(grundlage(true), [FZ_STAND, JULEICA]);
    oeffnen();
    expect(await screen.findByRole('heading', { name: 'Führungszeugnis' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'JuLeiCa' })).toBeTruthy();
    expect(screen.getByText('3 Jahre ab Ausstellung · mit Antrag')).toBeTruthy();
    expect(screen.getByText('3 Jahre ab Ausstellung · ohne Antrag')).toBeTruthy();
  });

  it('Tabelle: Name | Stand | Eingesehen am | Ausgestellt am | Gültig bis – wer dich braucht, oben', async () => {
    seite(grundlage(true), [FZ_STAND]);
    oeffnen();
    await screen.findByRole('table');
    const kopf = screen.getAllByRole('columnheader').map((c) => c.textContent);
    expect(kopf).toEqual(['Name', 'Stand', 'Eingesehen am', 'Ausgestellt am', 'Gültig bis']);
    const zeilen = screen.getAllByRole('row').slice(1);
    const namen = zeilen.map(
      (z) => within(z).getAllByRole('cell')[0].querySelector('b')?.textContent,
    );
    // rot (fehlt, Rücksprache; innerhalb nach Name), blau (läuft ab), angefordert, gültig
    expect(namen).toEqual([
      'Jonas Beispiel',
      'Lena Probst',
      'Mia Muster',
      'Paula Messnull',
      'Tom Klein',
    ]);
  });

  it('Stand als Etikett: Text und Farbe je Regel', async () => {
    seite(grundlage(true), [FZ_STAND]);
    oeffnen();
    await screen.findByRole('table');
    const zeile = (name: string) => screen.getByText(name).closest('tr')!;
    const etikett = (name: string) =>
      within(zeile(name)).getAllByRole('cell')[1].firstElementChild!;
    expect(etikett('Lena Probst').textContent).toBe('fehlt seit 5 Wochen');
    expect(etikett('Jonas Beispiel').textContent).toBe('Rücksprache');
    expect(etikett('Mia Muster').textContent).toMatch(/^läuft ab am \d\d\.\d\d\.$/);
    expect(etikett('Paula Messnull').textContent).toMatch(/^angefordert am \d\d\.\d\d\.$/);
    expect(etikett('Tom Klein').textContent).toBe('gültig');
    // Verschiedene Töne: „läuft ab“ (blau) ist nicht „fehlt“ (rot) und nicht „gültig“ (grün).
    const klassen = ['Lena Probst', 'Mia Muster', 'Tom Klein'].map((n) => etikett(n).className);
    expect(new Set(klassen).size).toBe(3);
  });

  it('Daten als TT.MM.JJJJ, leer als „–“; Gültig bis aus Ausstellung plus Jahre', async () => {
    seite(grundlage(true), [FZ_STAND]);
    oeffnen();
    await screen.findByRole('table');
    const zellen = within(screen.getByText('Lena Probst').closest('tr')!).getAllByRole('cell');
    expect(zellen.slice(2).map((c) => c.textContent)).toEqual(['–', '–', '–']);
    const mia = within(screen.getByText('Mia Muster').closest('tr')!).getAllByRole('cell');
    expect(mia[2].textContent).toMatch(/^\d\d\.\d\d\.\d{4}$/);
    expect(mia[4].textContent).toBe(plusTage(HEUTE, 30).split('-').reverse().join('.'));
  });

  it('die Lücke im Antrag steht rot unter dem Namen – nur bei Arten mit Antrag', async () => {
    seite(grundlage(true), [
      FZ_STAND,
      { ...JULEICA, personen: [{ ...LENA, personId: 9, name: 'Ohne Antrag' }] },
    ]);
    oeffnen();
    await screen.findByRole('table', { name: '' }).catch(() => null);
    expect(await screen.findByText('Antrag unvollständig: Geburtsdatum fehlt')).toBeTruthy();
    // JuLeiCa hat keinen Antrag – dort kommt der Hinweis nicht, obwohl das Profil dieselbe Lücke hat.
    expect(screen.getAllByText(/Antrag unvollständig/)).toHaveLength(1);
  });

  it('„Braucht Aufmerksamkeit“: nur die Fälle; Arten ohne Fälle fehlen; der Merker zählt sie', async () => {
    seite(grundlage(true), [FZ_STAND, JULEICA]);
    oeffnen('aufmerksam');
    await screen.findByRole('table');
    expect(
      screen
        .getAllByRole('row')
        .slice(1)
        .map((z) => within(z).getAllByRole('cell')[0].querySelector('b')?.textContent),
    ).toEqual(['Jonas Beispiel', 'Lena Probst', 'Mia Muster']);
    expect(screen.queryByRole('heading', { name: 'JuLeiCa' })).toBeNull();
    expect(screen.queryByText('Tom Klein')).toBeNull();
    // Der Merker an der Ansicht: 3 Fälle (die Zahl hängt am Namen der Ansicht).
    expect(screen.getByRole('button', { name: /Braucht Aufmerksamkeit, 3/ })).toBeTruthy();
  });

  it('der Umschalter meldet die gewählte Ansicht (die App legt sie in die Adresse)', async () => {
    seite(grundlage(true), [FZ_STAND]);
    const gewaehlt = vi.fn();
    oeffnen('alle', gewaehlt);
    await screen.findByRole('table');
    fireEvent.click(screen.getByRole('button', { name: /Braucht Aufmerksamkeit/ }));
    expect(gewaehlt).toHaveBeenCalledWith('aufmerksam');
  });

  it('„Braucht Aufmerksamkeit“ ohne Fälle: sagt es', async () => {
    seite(grundlage(true), [JULEICA]);
    oeffnen('aufmerksam');
    expect(await screen.findByText('Gerade braucht niemand etwas.')).toBeTruthy();
  });

  it('Personen nicht lesbar: sagt es, behauptet nicht „niemand“; leere Art: „Noch niemand eingetragen“', async () => {
    seite(grundlage(true), [
      { ...FZ, personen: null },
      { ...JULEICA, personen: [] },
    ]);
    oeffnen();
    expect(await screen.findByText('Die Personen sind für dich nicht sichtbar.')).toBeTruthy();
    expect(screen.getByText('Noch niemand eingetragen.')).toBeTruthy();
    expect(screen.queryByRole('table')).toBeNull();
  });

  it('Vertrauensperson ohne Admin-Recht sieht den Stand, aber kein ⋯-Menü', async () => {
    seite(grundlage(false), [FZ_STAND]);
    oeffnen();
    expect(await screen.findByText('Lena Probst')).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Mehr/ })).toBeNull();
  });

  it('am Handy: eine Liste statt Tabelle – Name, Etikett, EIN Datum, die Lücke', async () => {
    handyAn();
    seite(grundlage(true), [FZ_STAND]);
    oeffnen();
    expect(await screen.findByText('Lena Probst')).toBeTruthy();
    expect(screen.queryByRole('table')).toBeNull();
    const tom = screen.getByText('Tom Klein').closest('li')!;
    expect(within(tom).getByText('gültig')).toBeTruthy();
    expect(within(tom).getByText(/^Gültig bis \d\d\.\d\d\.\d{4}$/)).toBeTruthy();
    expect(screen.getByText('Antrag unvollständig: Geburtsdatum fehlt')).toBeTruthy();
  });
});

describe('Fenster „Nachweis-Art“', () => {
  const neueArt = async () => {
    seite(grundlage(true), []);
    oeffnen();
    fireEvent.click(await screen.findByRole('button', { name: 'Neue Nachweis-Art' }));
    return await screen.findByRole('dialog');
  };

  it('die anlegende Person ist als Vertrauensperson voreingestellt', async () => {
    const fenster = await neueArt();
    expect(await within(fenster).findByText('Anna Leitung')).toBeTruthy();
  });

  it('Speichern schickt Name, Gültigkeit, Aufforderung und Vertrauenspersonen – und zeigt das Nachgelesene', async () => {
    arten.nachweisArtSichern.mockResolvedValue(alles);
    const fenster = await neueArt();
    await within(fenster).findByText('Anna Leitung');
    fireEvent.change(within(fenster).getByLabelText('Jahre'), { target: { value: '5' } });
    fireEvent.click(within(fenster).getByRole('button', { name: 'Einsicht' }));
    fireEvent.change(within(fenster).getByPlaceholderText('Führungszeugnis'), {
      target: { value: 'JuLeiCa' },
    });
    fireEvent.click(within(fenster).getByRole('button', { name: 'Speichern' }));
    await waitFor(() => expect(arten.nachweisArtSichern).toHaveBeenCalledOnce());
    expect(arten.nachweisArtSichern.mock.calls[0]).toEqual([
      {
        gruppeId: null,
        name: 'JuLeiCa',
        einstellungen: expect.objectContaining({ gueltigJahre: 5, ab: 'einsicht' }),
        vertrauen: [7],
        entfernen: [],
        // Neue Art: „Mit Antrag“ ist vorbelegt, Bilder gibt es noch keine.
        antragBilder: {
          logo: { art: 'keins' },
          unterschrift: { art: 'keins' },
          hintergrund: { art: 'keins' },
        },
      },
      7,
    ]);
    expect(await screen.findByText('Nachweis-Art angelegt')).toBeTruthy();
    expect(screen.getByText(/Gruppe „Nachweis: JuLeiCa“/)).toBeTruthy();
    expect(screen.getByText(/Ablauf mit 4 Schritten, eingeschaltet/)).toBeTruthy();
  });

  it('ohne Namen lässt sich nicht speichern', async () => {
    const fenster = await neueArt();
    expect(
      within(fenster).getByRole('button', { name: 'Speichern' }).hasAttribute('disabled'),
    ).toBe(true);
  });

  it('Teilerfolg: sagt, was steht und was fehlt; „Nochmal“ schickt dieselbe Gruppe (nichts doppelt)', async () => {
    arten.nachweisArtSichern
      .mockResolvedValueOnce({
        gruppeId: 99,
        vorlageId: null,
        erledigt: ['grundlage', 'gruppe', 'einstellungen', 'felder', 'leitung'],
        fehler: new NichtUebernommen('den Ablauf'),
        befund: null,
      })
      .mockResolvedValueOnce(alles);
    const fenster = await neueArt();
    await within(fenster).findByText('Anna Leitung');
    fireEvent.change(within(fenster).getByPlaceholderText('Führungszeugnis'), {
      target: { value: 'JuLeiCa' },
    });
    fireEvent.click(within(fenster).getByRole('button', { name: 'Speichern' }));
    expect(await screen.findByText(/Noch nicht alles geschrieben/)).toBeTruthy();
    const stand = screen.getByRole('list', { name: 'Stand' });
    expect(within(stand).getAllByText(/steht in ChurchTools/)).toHaveLength(5);
    // Der Ablauf ist gescheitert, der Antrag danach nicht mehr erreicht worden.
    expect(within(stand).getAllByText(/fehlt noch/)).toHaveLength(2);

    fireEvent.click(screen.getByRole('button', { name: 'Nochmal' }));
    await waitFor(() => expect(arten.nachweisArtSichern).toHaveBeenCalledTimes(2));
    expect(arten.nachweisArtSichern.mock.calls[1][0]).toMatchObject({ gruppeId: 99 });
    expect(await screen.findByText('Nachweis-Art angelegt')).toBeTruthy();
  });

  it('Eingabefehler (z. B. „gibt es schon“) bleibt im Fenster, ohne „fertig“ zu melden', async () => {
    arten.nachweisArtSichern.mockRejectedValue(
      new ApiError(409, 'Die Nachweis-Art „X“ gibt es schon.'),
    );
    const fenster = await neueArt();
    await within(fenster).findByText('Anna Leitung');
    fireEvent.change(within(fenster).getByPlaceholderText('Führungszeugnis'), {
      target: { value: 'X' },
    });
    fireEvent.click(within(fenster).getByRole('button', { name: 'Speichern' }));
    expect(await screen.findByText(/gibt es schon/)).toBeTruthy();
    expect(screen.queryByText('Nachweis-Art angelegt')).toBeNull();
  });

  it('Bearbeiten: Entfernen einer gespeicherten Vertrauensperson geht erst beim Speichern – und nur auf Klick', async () => {
    seite();
    arten.nachweisArtSichern.mockResolvedValue(alles);
    oeffnen();
    await bearbeiten();
    const fenster = await screen.findByRole('dialog');
    // Ohne Klick wird niemand entfernt.
    fireEvent.click(within(fenster).getByRole('button', { name: 'Speichern' }));
    await waitFor(() => expect(arten.nachweisArtSichern).toHaveBeenCalledOnce());
    expect(arten.nachweisArtSichern.mock.calls[0][0]).toMatchObject({
      gruppeId: 61,
      vertrauen: [7, 8],
      entfernen: [],
    });
  });

  it('Bearbeiten: „Entfernen“ markiert, „Doch behalten“ nimmt es zurück, Speichern schickt die Wahl', async () => {
    seite();
    arten.nachweisArtSichern.mockResolvedValue(alles);
    oeffnen();
    await bearbeiten();
    const fenster = await screen.findByRole('dialog');
    fireEvent.click(within(fenster).getByRole('button', { name: 'Ben Leitung entfernen' }));
    expect(within(fenster).getByText(/wird beim Speichern entfernt/)).toBeTruthy();
    fireEvent.click(within(fenster).getByRole('button', { name: 'Ben Leitung doch behalten' }));
    expect(within(fenster).queryByText(/wird beim Speichern entfernt/)).toBeNull();
    fireEvent.click(within(fenster).getByRole('button', { name: 'Ben Leitung entfernen' }));
    fireEvent.click(within(fenster).getByRole('button', { name: 'Speichern' }));
    await waitFor(() => expect(arten.nachweisArtSichern).toHaveBeenCalledOnce());
    expect(arten.nachweisArtSichern.mock.calls[0][0]).toMatchObject({
      vertrauen: [7],
      entfernen: [8],
    });
  });

  it('Esc schließt das Fenster', async () => {
    const fenster = await neueArt();
    fireEvent.keyDown(fenster, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });
});

describe('Seite „Nachweise“: Einsicht festhalten öffnen (N2b)', () => {
  it('Rechner: ein Klick oder Eingabe auf der Zeile öffnet das Fenster dieser Person; der Hinweis steht unter der Tabelle', async () => {
    seite(grundlage(false), [FZ_STAND]);
    oeffnen();
    await screen.findByRole('table');
    expect(
      screen.getByText('Ein Klick auf eine Person öffnet „Einsicht festhalten“.'),
    ).toBeTruthy();
    // Die Zeile ist anklickbar und mit der Tastatur erreichbar (Tab, Eingabe) …
    const tom = screen.getByText('Tom Klein').closest('tr')!;
    expect(tom.getAttribute('tabindex')).toBe('0');
    fireEvent.keyDown(tom, { key: 'Enter' });
    expect(await screen.findByRole('dialog', { name: /Einsicht festhalten/ })).toBeTruthy();
    expect(screen.getByRole('dialog').textContent).toContain('Tom Klein');
    fireEvent.click(screen.getByRole('button', { name: /Abbrechen/ }));
    expect(screen.queryByRole('dialog')).toBeNull();
    // … ebenso ein Klick in eine Zelle – genau ein Fenster.
    fireEvent.click(
      within(screen.getByText('Paula Messnull').closest('tr')!).getAllByRole('cell')[1],
    );
    expect(screen.getAllByRole('dialog')).toHaveLength(1);
    expect(screen.getByRole('dialog').textContent).toContain('Paula Messnull');
  });

  it('Handy: die Zeile der Liste öffnet das Fenster', async () => {
    handyAn();
    seite(grundlage(false), [FZ_STAND]);
    oeffnen();
    fireEvent.click(await screen.findByRole('button', { name: /Lena Probst/ }));
    expect(await screen.findByRole('dialog', { name: /Einsicht festhalten/ })).toBeTruthy();
  });

  it('eine Art, die nicht fertig eingerichtet ist, und eine nicht sichtbare Art haben keine anklickbaren Zeilen', async () => {
    seite(grundlage(true), [
      { ...FZ_STAND, einstellungen: null },
      { ...JULEICA, personen: null },
    ]);
    oeffnen();
    await screen.findByRole('table');
    expect(screen.getByText('Tom Klein').closest('tr')!.getAttribute('tabindex')).toBeNull();
    expect(screen.queryByText(/Ein Klick auf eine Person/)).toBeNull();
    fireEvent.click(screen.getByText('Tom Klein'));
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('Festhalten: die Seite lädt neu und zeigt die Meldung', async () => {
    einsichtSchreiben.mockResolvedValue({
      neu: true,
      gueltigBis: null,
      erledigt: null,
      verschoben: false,
      nachziehen: false,
      text: 'Einsicht bei Tom Klein festgehalten – gültig bis 01.01.2030.',
    });
    seite(grundlage(false), [FZ_STAND]);
    const gemeldet = vi.fn();
    render(<NachweisSeite onZurueck={() => {}} onGeaendert={gemeldet} />);
    fireEvent.click((await screen.findByText('Tom Klein')).closest('tr')!);
    const aus = screen.getByLabelText(/Ausgestellt am/);
    fireEvent.change(aus, { target: { value: plusTage(HEUTE, -10) } });
    fireEvent.click(screen.getByLabelText(/Keine Eintragung/));
    fireEvent.click(screen.getByRole('button', { name: 'Festhalten' }));
    await waitFor(() =>
      expect(gemeldet).toHaveBeenCalledWith({
        text: 'Einsicht bei Tom Klein festgehalten – gültig bis 01.01.2030.',
        rueckgaengig: null,
      }),
    );
    expect(arten.nachweiseSeiteLaden.mock.calls.length).toBeGreaterThanOrEqual(2);
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});
