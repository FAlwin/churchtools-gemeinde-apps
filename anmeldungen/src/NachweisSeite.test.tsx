// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { ApiError, NichtUebernommen } from '@ui/ct/fehler';
import { NACHWEIS_FELDER, type NachweisEinstellungen } from '@shared/anmeldung/nachweise';
import { NACHWEIS_SCHRITTE, type NachweisArt, type NachweisErgebnis } from './nachweisArten';
import * as Arten from './nachweisArten';
import { NachweisSeite } from './NachweisSeite';

/**
 * Seite „Nachweise“ und Fenster „Nachweis-Art“ (N1b) mit ersetztem `nachweisArten` – was ChurchTools tut, prüft
 * `nachweisArten.test.ts`; hier geht es um das, was die Person sieht und anstößt.
 */
vi.mock('./nachweisArten', async (original) => ({
  ...(await original<typeof import('./nachweisArten')>()),
  nachweiseSeiteLaden: vi.fn(),
  nachweisArtSichern: vi.fn(),
  ichLaden: vi.fn(),
}));
const arten = vi.mocked(Arten);

const E: NachweisEinstellungen = {
  gueltigJahre: 3,
  ab: 'ausstellung',
  betreff: 'Bitte Führungszeugnis beantragen',
  text: 'Hallo [Vorname], bitte beantrage ein Führungszeugnis.',
};
const FZ: NachweisArt = {
  id: 61,
  gruppenName: 'Nachweis: Führungszeugnis',
  name: 'Führungszeugnis',
  einstellungen: E,
  vertrauen: [
    { personId: 7, name: 'Anna Leitung' },
    { personId: 8, name: 'Ben Leitung' },
  ],
};
const grundlage = (darfEinrichten: boolean) => ({
  typId: 11,
  rechtFehlt: false,
  darfEinrichten,
});

const alles: NachweisErgebnis = {
  gruppeId: 99,
  erledigt: [...NACHWEIS_SCHRITTE],
  fehler: null,
  befund: {
    gruppeId: 99,
    gruppenName: 'Nachweis: JuLeiCa',
    felder: NACHWEIS_FELDER.map((f) => f.name),
    vertrauen: [{ personId: 7, name: 'Anna Leitung' }],
    ablauf: { an: true, schritte: 4 },
  },
};

const seite = (g = grundlage(true), liste: NachweisArt[] = [FZ]) =>
  arten.nachweiseSeiteLaden.mockResolvedValue({ grundlage: g, arten: liste });
const oeffnen = () => render(<NachweisSeite onZurueck={() => {}} onGeaendert={() => {}} />);

beforeEach(() => {
  arten.ichLaden.mockResolvedValue({ personId: 7, name: 'Anna Leitung' });
});

describe('Seite „Nachweise“', () => {
  it('zeigt die Arten mit Gültigkeit und Vertrauenspersonen', async () => {
    seite();
    oeffnen();
    expect(await screen.findByText('Führungszeugnis')).toBeTruthy();
    expect(screen.getByText('Gültig 3 Jahre ab Ausstellung')).toBeTruthy();
    expect(screen.getByText('Vertrauenspersonen: Anna Leitung, Ben Leitung')).toBeTruthy();
  });

  it('mit „Berechtigungen verwalten“: „Neue Nachweis-Art“ und „Bearbeiten“', async () => {
    seite();
    oeffnen();
    await screen.findByText('Führungszeugnis');
    expect(screen.getByRole('button', { name: 'Neue Nachweis-Art' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Führungszeugnis bearbeiten' })).toBeTruthy();
  });

  it('ohne das Recht (Vertrauensperson): nur ansehen – und der Hinweis sagt, wer anlegen darf', async () => {
    seite(grundlage(false));
    oeffnen();
    await screen.findByText('Führungszeugnis');
    expect(screen.queryByRole('button', { name: 'Neue Nachweis-Art' })).toBeNull();
    expect(screen.queryByRole('button', { name: /bearbeiten/ })).toBeNull();
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
    expect(within(stand).getAllByText(/fehlt noch/)).toHaveLength(1);

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
    fireEvent.click(await screen.findByRole('button', { name: 'Führungszeugnis bearbeiten' }));
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
    fireEvent.click(await screen.findByRole('button', { name: 'Führungszeugnis bearbeiten' }));
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
