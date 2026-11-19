// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { NACHWEIS_FELDER, type NachweisEinstellungen } from '@shared/anmeldung/nachweise';
import { antragVorgabe, type NachweisAntrag } from '@shared/anmeldung/nachweisAntrag';
import { NACHWEIS_SCHRITTE, type NachweisArt, type NachweisErgebnis } from './nachweisArten';
import * as Arten from './nachweisArten';
import * as Bild from './antragBild';
import { NachweisSeite } from './NachweisSeite';

/**
 * Der Abschnitt „Antrag“ im Fenster „Nachweis-Art“ (N1c) mit ersetztem `nachweisArten` und `antragBild` – was ChurchTools
 * tut, prüfen `nachweisAntrag.speichern.test.ts` und `nachweisArten.test.ts`; hier geht es um das, was die Person sieht
 * und anstößt.
 */
vi.mock('./nachweisArten', async (original) => ({
  ...(await original<typeof import('./nachweisArten')>()),
  nachweiseSeiteLaden: vi.fn(),
  nachweisArtSichern: vi.fn(),
  ichLaden: vi.fn(),
  gemeindeLogoLaden: vi.fn(),
  antragLaden: vi.fn(),
}));
vi.mock('./antragBild', async (original) => ({
  ...(await original<typeof import('./antragBild')>()),
  antragBildLaden: vi.fn(),
}));
const arten = vi.mocked(Arten);
const bild = vi.mocked(Bild);

const PNG =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';
const JPG = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////';
const LOGO = 'https://ecg.church.tools/images/558/logo.png';

const MIT: NachweisAntrag = { ...antragVorgabe('ECG Donrath'), logo: 'eigen', vorlageId: 17 };
const E: NachweisEinstellungen = {
  gueltigJahre: 3,
  ab: 'ausstellung',
  betreff: 'Bitte Führungszeugnis beantragen',
  text: 'Hallo [Vorname], bitte beantrage ein Führungszeugnis.',
};
const FZ_MIT: NachweisArt = {
  id: 61,
  gruppenName: 'Nachweis: Führungszeugnis',
  name: 'Führungszeugnis',
  einstellungen: { ...E, antrag: MIT },
  vertrauen: [{ personId: 7, name: 'Anna Leitung' }],
};
const FZ_OHNE: NachweisArt = { ...FZ_MIT, id: 62, name: 'JuLeiCa', einstellungen: E };

const alles: NachweisErgebnis = {
  gruppeId: 99,
  vorlageId: 17,
  erledigt: [...NACHWEIS_SCHRITTE],
  fehler: null,
  befund: {
    gruppeId: 99,
    gruppenName: 'Nachweis: Führungszeugnis',
    felder: NACHWEIS_FELDER.map((f) => f.name),
    vertrauen: [{ personId: 7, name: 'Anna Leitung' }],
    ablauf: { an: true, schritte: 4 },
    antrag: { vorlageId: 17, haengt: true },
  },
};

const seite = (liste: NachweisArt[]) =>
  arten.nachweiseSeiteLaden.mockResolvedValue({
    grundlage: { typId: 11, rechtFehlt: false, darfEinrichten: true },
    arten: liste,
  });
const oeffnen = () =>
  render(<NachweisSeite gemeinde="ECG Donrath" onZurueck={() => {}} onGeaendert={() => {}} />);
const neueArt = async () => {
  seite([]);
  oeffnen();
  fireEvent.click(await screen.findByRole('button', { name: 'Neue Nachweis-Art' }));
  return await screen.findByRole('dialog');
};
const bearbeiten = async (name: string) => {
  oeffnen();
  fireEvent.click(await screen.findByRole('button', { name: `${name} bearbeiten` }));
  return await screen.findByRole('dialog');
};
/** Der Wert eines Eingabefelds (Testing Library liefert nur `HTMLElement`). */
const wert = (el: HTMLElement): string => (el as unknown as { value: string }).value;
const vorschau = () => screen.getByTestId('antrag-vorschau');
const aufruf = () => arten.nachweisArtSichern.mock.calls[0][0];

beforeEach(() => {
  arten.ichLaden.mockReset().mockResolvedValue({ personId: 7, name: 'Anna Leitung' });
  arten.gemeindeLogoLaden.mockReset().mockResolvedValue(LOGO);
  arten.antragLaden
    .mockReset()
    .mockResolvedValue({ logo: PNG, unterschrift: JPG, hintergrund: null });
  arten.nachweisArtSichern.mockReset().mockResolvedValue(alles);
  bild.antragBildLaden.mockReset().mockResolvedValue(PNG);
});

describe('Seite „Nachweise“: Antrag in der Liste', () => {
  it('jede Art sagt „Mit Antrag“ oder „Ohne Antrag“', async () => {
    seite([FZ_MIT, FZ_OHNE]);
    oeffnen();
    await screen.findByText('Führungszeugnis');
    expect(screen.getAllByText('Mit Antrag')).toHaveLength(1);
    expect(screen.getAllByText('Ohne Antrag')).toHaveLength(1);
  });
});

describe('Neue Art', () => {
  it('„Mit Antrag“ ist an; Briefkopf ist der Name der Gemeinde, Überschrift und Text sind die Vorgabe', async () => {
    const fenster = await neueArt();
    const schalter = within(fenster).getByRole('button', { name: 'Mit Antrag' });
    expect(schalter.getAttribute('aria-pressed')).toBe('true');
    expect(wert(within(fenster).getByLabelText(/^Briefkopf/))).toBe('ECG Donrath');
    expect(wert(within(fenster).getByLabelText('Überschrift'))).toBe(
      'Bestätigung zur Vorlage bei der Meldebehörde',
    );
    expect(wert(within(fenster).getByLabelText('Text des Antrags'))).toMatch(
      /§ 30a Abs\. 1 Nr\. 2b BZRG/,
    );
  });

  it('die Vorschau zeigt die Beispielperson und das Logo der Gemeinde', async () => {
    await neueArt();
    await waitFor(() => expect(vorschau().querySelector('img')?.getAttribute('src')).toBe(LOGO));
    expect(vorschau().textContent).toContain('Lena Probst');
    expect(vorschau().textContent).toContain('Bachweg 7, 53797 Lohmar');
    expect(vorschau().textContent).toContain('Bestätigung zur Vorlage bei der Meldebehörde');
    expect(vorschau().textContent).toContain('Unterschrift / Stempel der Gemeinde');
    expect(vorschau().textContent).not.toContain('{{');
  });

  it('die Vorschau folgt jeder Eingabe, und Nutzertext wird nicht als HTML gelesen', async () => {
    const fenster = await neueArt();
    fireEvent.change(within(fenster).getByLabelText('Überschrift'), {
      target: { value: 'Neue <b>Überschrift</b>' },
    });
    fireEvent.change(within(fenster).getByLabelText('Text des Antrags'), {
      target: { value: 'Hallo [Vorname]\n\n<script>alert(1)</script>' },
    });
    expect(vorschau().textContent).toContain('Neue <b>Überschrift</b>');
    expect(vorschau().querySelector('script')).toBeNull();
    expect(vorschau().querySelector('h1 b')).toBeNull();
    expect(vorschau().textContent).toContain('Hallo Lena');
    expect(vorschau().querySelectorAll('p')).toHaveLength(2);
  });

  it('die Pille „[Nachname]“ setzt den Platzhalter in den Text', async () => {
    const fenster = await neueArt();
    fireEvent.change(within(fenster).getByLabelText('Text des Antrags'), { target: { value: '' } });
    fireEvent.click(within(fenster).getByRole('button', { name: '[Nachname]' }));
    expect(wert(within(fenster).getByLabelText('Text des Antrags'))).toBe('[Nachname]');
    expect(vorschau().textContent).toContain('Probst');
  });

  it('ein unbekannter Platzhalter im Antrag sperrt das Speichern und sagt es', async () => {
    const fenster = await neueArt();
    await within(fenster).findByText('Anna Leitung');
    fireEvent.change(within(fenster).getByPlaceholderText('Führungszeugnis'), {
      target: { value: 'X' },
    });
    fireEvent.change(within(fenster).getByLabelText('Text des Antrags'), {
      target: { value: 'Hallo [Straße]' },
    });
    expect(within(fenster).getAllByText(/Das kennt der Antrag nicht/).length).toBeGreaterThan(0);
    expect(
      within(fenster).getByRole('button', { name: 'Speichern' }).hasAttribute('disabled'),
    ).toBe(true);
  });

  it('die Mail nennt den Weg zur Bescheinigung mit dem Namen der Art – bis jemand selbst schreibt', async () => {
    const fenster = await neueArt();
    const text = () => wert(within(fenster).getByLabelText('Text'));
    fireEvent.change(within(fenster).getByPlaceholderText('Führungszeugnis'), {
      target: { value: 'JuLeiCa' },
    });
    expect(text()).toContain('„Meine Gruppen“ → „Nachweis: JuLeiCa“ → Bescheinigungen');
    fireEvent.change(within(fenster).getByLabelText('Text'), { target: { value: 'Mein Text' } });
    fireEvent.change(within(fenster).getByPlaceholderText('Führungszeugnis'), {
      target: { value: 'Anderes' },
    });
    expect(text()).toBe('Mein Text');
  });

  it('ohne Antrag: die Felder und die Vorschau verschwinden, gespeichert wird ohne Antrag', async () => {
    const fenster = await neueArt();
    await within(fenster).findByText('Anna Leitung');
    fireEvent.change(within(fenster).getByPlaceholderText('Führungszeugnis'), {
      target: { value: 'Ohne' },
    });
    fireEvent.click(within(fenster).getByRole('button', { name: 'Mit Antrag' }));
    expect(within(fenster).queryByLabelText(/^Briefkopf/)).toBeNull();
    expect(screen.queryByTestId('antrag-vorschau')).toBeNull();
    // die Mail nennt dann keinen Weg zur Bescheinigung
    expect(wert(within(fenster).getByLabelText('Text'))).not.toContain('Bescheinigungen');
    fireEvent.click(within(fenster).getByRole('button', { name: 'Speichern' }));
    await waitFor(() => expect(arten.nachweisArtSichern).toHaveBeenCalledOnce());
    expect(aufruf().einstellungen.antrag).toBeUndefined();
  });

  it('Logo „Ohne Logo“ nimmt das Bild aus der Vorschau; „Eigenes Bild“ zeigt Hochladen', async () => {
    const fenster = await neueArt();
    await waitFor(() => expect(vorschau().querySelector('img')).not.toBeNull());
    fireEvent.click(within(fenster).getByRole('button', { name: 'Ohne Logo' }));
    expect(vorschau().querySelector('img')).toBeNull();
    fireEvent.click(within(fenster).getByRole('button', { name: 'Eigenes Bild' }));
    expect(within(fenster).getByLabelText('Logo hochladen')).toBeTruthy();
  });

  it('die Unterschrift hochladen: die Vorschau zeigt sie, Speichern schickt sie als „neu“ – nicht als Gruppenbild', async () => {
    const fenster = await neueArt();
    await within(fenster).findByText('Anna Leitung');
    fireEvent.change(within(fenster).getByPlaceholderText('Führungszeugnis'), {
      target: { value: 'U' },
    });
    const datei = new File(['x'], 'unterschrift.png', { type: 'image/png' });
    fireEvent.change(within(fenster).getByLabelText('Unterschrift hochladen'), {
      target: { files: [datei] },
    });
    await waitFor(() =>
      expect(
        vorschau().querySelector(
          'img[alt="Unterschrift im Antrag"], img[data-nachweis="unterschrift"]',
        ),
      ).not.toBeNull(),
    );
    expect(bild.antragBildLaden).toHaveBeenCalledWith(datei);
    fireEvent.click(within(fenster).getByRole('button', { name: 'Speichern' }));
    await waitFor(() => expect(arten.nachweisArtSichern).toHaveBeenCalledOnce());
    expect(aufruf().antragBilder).toEqual({
      logo: { art: 'keins' },
      unterschrift: { art: 'neu', src: PNG },
      hintergrund: { art: 'keins' },
    });
  });

  it('ein Bild, das sich nicht verwenden lässt, meldet es verständlich und ändert nichts', async () => {
    bild.antragBildLaden.mockRejectedValue(new Error('x'));
    const { ApiError } = await import('@ui/ct/fehler');
    bild.antragBildLaden.mockRejectedValue(
      new ApiError(413, 'Das Bild ist auch verkleinert noch zu groß.'),
    );
    const fenster = await neueArt();
    fireEvent.change(within(fenster).getByLabelText('Unterschrift hochladen'), {
      target: { files: [new File(['x'], 'a.png', { type: 'image/png' })] },
    });
    expect(await within(fenster).findByText(/noch zu groß/)).toBeTruthy();
    expect(within(fenster).queryByRole('button', { name: 'Unterschrift entfernen' })).toBeNull();
  });
});

describe('Art mit Antrag bearbeiten', () => {
  it('die bisherigen Bilder werden aus ChurchTools geladen und gezeigt; Speichern lässt sie „unverändert“', async () => {
    seite([FZ_MIT]);
    const fenster = await bearbeiten('Führungszeugnis');
    expect(arten.antragLaden).toHaveBeenCalledWith(17);
    await waitFor(() =>
      expect(
        vorschau().querySelector('img[data-nachweis="unterschrift"]')?.getAttribute('src'),
      ).toBe(JPG),
    );
    expect(vorschau().querySelector('img[data-nachweis="logo"]')?.getAttribute('src')).toBe(PNG);
    fireEvent.click(within(fenster).getByRole('button', { name: 'Speichern' }));
    await waitFor(() => expect(arten.nachweisArtSichern).toHaveBeenCalledOnce());
    expect(aufruf().antragBilder).toEqual({
      logo: { art: 'unveraendert' },
      unterschrift: { art: 'unveraendert' },
      hintergrund: { art: 'keins' },
    });
    expect(aufruf().einstellungen.antrag).toMatchObject({ an: true, vorlageId: 17 });
  });

  it('der Antrag lässt sich nicht lesen: das Fenster sagt, dass die Unterschrift bleibt – und schickt „unverändert“, nicht „keins“', async () => {
    arten.antragLaden.mockResolvedValue(null);
    seite([FZ_MIT]);
    const fenster = await bearbeiten('Führungszeugnis');
    // Logo (eigenes) und Unterschrift sagen es beide.
    expect(await within(fenster).findAllByText(/bleibt beim Speichern, wie es ist/)).toHaveLength(
      2,
    );
    fireEvent.click(within(fenster).getByRole('button', { name: 'Speichern' }));
    await waitFor(() => expect(arten.nachweisArtSichern).toHaveBeenCalledOnce());
    expect(aufruf().antragBilder?.unterschrift).toEqual({ art: 'unveraendert' });
  });

  it('„Entfernen“ der Unterschrift schickt „keins“', async () => {
    seite([FZ_MIT]);
    const fenster = await bearbeiten('Führungszeugnis');
    fireEvent.click(await within(fenster).findByRole('button', { name: 'Unterschrift entfernen' }));
    expect(vorschau().querySelector('img[data-nachweis="unterschrift"]')).toBeNull();
    fireEvent.click(within(fenster).getByRole('button', { name: 'Speichern' }));
    await waitFor(() => expect(arten.nachweisArtSichern).toHaveBeenCalledOnce());
    expect(aufruf().antragBilder?.unterschrift).toEqual({ art: 'keins' });
  });

  it('„Mit Antrag“ ausschalten behält die Nummer der Vorlage (abgehängt, nicht gelöscht)', async () => {
    seite([FZ_MIT]);
    const fenster = await bearbeiten('Führungszeugnis');
    fireEvent.click(within(fenster).getByRole('button', { name: 'Mit Antrag' }));
    fireEvent.click(within(fenster).getByRole('button', { name: 'Speichern' }));
    await waitFor(() => expect(arten.nachweisArtSichern).toHaveBeenCalledOnce());
    expect(aufruf().einstellungen.antrag).toMatchObject({ an: false, vorlageId: 17 });
  });

  it('eine Art aus N1b (ohne Antrag) bleibt ohne, bis man „Mit Antrag“ einschaltet; dann gilt die Vorgabe', async () => {
    seite([FZ_OHNE]);
    const fenster = await bearbeiten('JuLeiCa');
    expect(arten.antragLaden).not.toHaveBeenCalled();
    expect(
      within(fenster).getByRole('button', { name: 'Mit Antrag' }).getAttribute('aria-pressed'),
    ).toBe('false');
    fireEvent.click(within(fenster).getByRole('button', { name: 'Speichern' }));
    await waitFor(() => expect(arten.nachweisArtSichern).toHaveBeenCalledOnce());
    expect(aufruf().einstellungen.antrag).toBeUndefined();
    // Mail-Text bleibt der gespeicherte
    expect(aufruf().einstellungen.text).toBe(E.text);
  });
});

describe('Ergebnis und „Nochmal“', () => {
  it('nennt die Bescheinigung mit der Nummer der Vorlage', async () => {
    const fenster = await neueArt();
    await within(fenster).findByText('Anna Leitung');
    fireEvent.change(within(fenster).getByPlaceholderText('Führungszeugnis'), {
      target: { value: 'FZ' },
    });
    fireEvent.click(within(fenster).getByRole('button', { name: 'Speichern' }));
    expect(await screen.findByText(/Antrag als Bescheinigung \(Vorlage Nummer 17\)/)).toBeTruthy();
  });

  it('nach einem Teilerfolg schickt „Nochmal“ die Nummer der Vorlage mit (keine zweite)', async () => {
    arten.nachweisArtSichern
      .mockResolvedValueOnce({
        ...alles,
        vorlageId: 55,
        erledigt: NACHWEIS_SCHRITTE.filter((s) => s !== 'antrag'),
        fehler: new Error('x'),
        befund: null,
      })
      .mockResolvedValueOnce(alles);
    const fenster = await neueArt();
    await within(fenster).findByText('Anna Leitung');
    fireEvent.change(within(fenster).getByPlaceholderText('Führungszeugnis'), {
      target: { value: 'FZ' },
    });
    fireEvent.click(within(fenster).getByRole('button', { name: 'Speichern' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Nochmal' }));
    await waitFor(() => expect(arten.nachweisArtSichern).toHaveBeenCalledTimes(2));
    expect(arten.nachweisArtSichern.mock.calls[1][0]).toMatchObject({
      gruppeId: 99,
      einstellungen: { antrag: { vorlageId: 55 } },
    });
  });
});
