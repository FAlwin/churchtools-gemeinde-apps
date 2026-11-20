// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { NACHWEIS_FELDER, type NachweisEinstellungen } from '@shared/anmeldung/nachweise';
import {
  antragVorgabe,
  pdfFeldStil,
  type NachweisAntrag,
  type PdfSeite,
} from '@shared/anmeldung/nachweisAntrag';
import { ApiError } from '@ui/ct/fehler';
import { NACHWEIS_SCHRITTE, type NachweisArt, type NachweisErgebnis } from './nachweisArten';
import * as Arten from './nachweisArten';
import * as Bild from './antragBild';
import * as Pdf from './antragPdf';
import { NachweisSeite } from './NachweisSeite';

/**
 * „Eigene PDF“ im Fenster „Nachweis-Art“ (N1d) mit ersetztem `nachweisArten`, `antragBild` und `antragPdf` – was ChurchTools tut,
 * prüfen `nachweisAntrag.pdf.speichern.test.ts`; hier geht es um das, was die Person sieht und anstößt.
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
vi.mock('./antragPdf', async (original) => ({
  ...(await original<typeof import('./antragPdf')>()),
  antragPdfLaden: vi.fn(),
}));
const arten = vi.mocked(Arten);
const bild = vi.mocked(Bild);
const pdf = vi.mocked(Pdf);

const PNG =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';
const JPG = 'data:image/jpeg;base64,/9j/4AAQkZJRgABAQEASABIAAD/2wBDAP//////////////////';
const SEITE_ALT: PdfSeite = {
  breiteMm: 210,
  hoeheMm: 297,
  felder: [{ id: 'f1', art: 'Vorname', x: 20, y: 30, pt: 13 }],
};
const E: NachweisEinstellungen = {
  gueltigJahre: 3,
  ab: 'ausstellung',
  betreff: 'Bitte Führungszeugnis beantragen',
  text: 'Hallo [Vorname], bitte beantrage ein Führungszeugnis.',
};
const BAUKASTEN: NachweisAntrag = { ...antragVorgabe('ECG Donrath'), logo: 'ohne', vorlageId: 17 };
const MIT_PDF: NachweisAntrag = { ...BAUKASTEN, art: 'pdf', pdf: SEITE_ALT };
const art = (antrag: NachweisAntrag): NachweisArt => ({
  id: 61,
  gruppenName: 'Nachweis: Führungszeugnis',
  name: 'Führungszeugnis',
  einstellungen: { ...E, antrag },
  vertrauen: [{ personId: 7, name: 'Anna Leitung' }],
});
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
    arten: liste.map((a) => ({ ...a, personen: [] })),
  });
const oeffnen = () =>
  render(
    <NachweisSeite
      gemeinde="ECG Donrath · Hauptstr. 1 · 53797 Lohmar"
      onZurueck={() => {}}
      onGeaendert={() => {}}
    />,
  );
const neueArt = async () => {
  seite([]);
  oeffnen();
  fireEvent.click(await screen.findByRole('button', { name: 'Neue Nachweis-Art' }));
  const f = await screen.findByRole('dialog');
  await within(f).findByText('Anna Leitung');
  fireEvent.change(within(f).getByPlaceholderText('Führungszeugnis'), { target: { value: 'FZ' } });
  return f;
};
const bearbeiten = async (a: NachweisArt) => {
  seite([a]);
  oeffnen();
  // „Nachweis-Art bearbeiten“ liegt im ⋯-Menü der Karte (N2a, R6).
  fireEvent.click(await screen.findByRole('button', { name: `${a.name}: Mehr` }));
  fireEvent.click(screen.getByText('Nachweis-Art bearbeiten'));
  return await screen.findByRole('dialog');
};
const aufruf = () => arten.nachweisArtSichern.mock.calls[0][0];
const chip = (id: string) => document.querySelector<HTMLElement>(`[data-feld="${id}"]`);
const speichern = (f: HTMLElement) =>
  fireEvent.click(within(f).getByRole('button', { name: 'Speichern' }));
const pdfWaehlen = (f: HTMLElement, name = 'antrag.pdf') =>
  fireEvent.change(within(f).getByLabelText('PDF hochladen'), {
    target: { files: [new File(['%PDF'], name, { type: 'application/pdf' })] },
  });

beforeEach(() => {
  arten.ichLaden.mockReset().mockResolvedValue({ personId: 7, name: 'Anna Leitung' });
  arten.gemeindeLogoLaden.mockReset().mockResolvedValue(null);
  arten.antragLaden
    .mockReset()
    .mockResolvedValue({ logo: null, unterschrift: PNG, hintergrund: JPG });
  arten.nachweisArtSichern.mockReset().mockResolvedValue(alles);
  bild.antragBildLaden.mockReset().mockResolvedValue(PNG);
  pdf.antragPdfLaden
    .mockReset()
    .mockResolvedValue({ hintergrund: JPG, breiteMm: 297, hoeheMm: 210, seiten: 1 });
});

describe('Gestaltung wählen', () => {
  it('der Umschalter „Baukasten | Eigene PDF“ erscheint nur mit „Mit Antrag“', async () => {
    const f = await neueArt();
    expect(within(f).getByRole('button', { name: 'Eigene PDF' })).toBeTruthy();
    expect(within(f).getByRole('button', { name: 'Baukasten' }).getAttribute('aria-pressed')).toBe(
      'true',
    );
    fireEvent.click(within(f).getByRole('button', { name: 'Mit Antrag' }));
    expect(within(f).queryByRole('button', { name: 'Eigene PDF' })).toBeNull();
  });

  it('Wechseln verliert nichts vom anderen, solange das Fenster offen ist', async () => {
    const f = await neueArt();
    fireEvent.change(within(f).getByLabelText('Überschrift'), {
      target: { value: 'Meine Überschrift' },
    });
    fireEvent.click(within(f).getByRole('button', { name: 'Eigene PDF' }));
    expect(within(f).queryByLabelText('Überschrift')).toBeNull();
    pdfWaehlen(f);
    await waitFor(() => expect(chip('f1')).not.toBeNull());
    // Platzhalter verschieben, zurück zum Baukasten und wieder her
    fireEvent.keyDown(chip('f1')!, { key: 'ArrowRight', shiftKey: true });
    fireEvent.click(within(f).getByRole('button', { name: 'Baukasten' }));
    expect((within(f).getByLabelText('Überschrift') as unknown as { value: string }).value).toBe(
      'Meine Überschrift',
    );
    fireEvent.click(within(f).getByRole('button', { name: 'Eigene PDF' }));
    expect(chip('f1')!.style.left).toBe('38%');
    expect(within(f).getByText('antrag.pdf')).toBeTruthy();
  });
});

describe('PDF wählen', () => {
  it('erste Seite als Hintergrund, Format aus der PDF, Vorgabe-Platzhalter (Ort aus dem Briefkopf)', async () => {
    const f = await neueArt();
    fireEvent.click(within(f).getByRole('button', { name: 'Eigene PDF' }));
    expect(within(f).getByText('Noch keine PDF')).toBeTruthy();
    pdfWaehlen(f);
    await waitFor(() => expect(chip('f1')).not.toBeNull());
    const seiteEl = screen.getByTestId('pdf-seite');
    // Querformat aus der PDF (297 × 210), nicht fest A4
    expect(seiteEl.style.width).toBe('297mm');
    expect(seiteEl.style.height).toBe('210mm');
    expect(seiteEl.querySelector('img')?.getAttribute('src')).toBe(JPG);
    expect(document.querySelectorAll('[data-feld]')).toHaveLength(5);
    expect(chip('f4')!.textContent).toMatch(/^Lohmar, /);
    expect(pdf.antragPdfLaden).toHaveBeenCalledOnce();
    expect(within(f).getByRole('button', { name: 'Andere PDF' })).toBeTruthy();
  });

  it('mehrseitige PDF: Hinweis „Nur die erste Seite wird verwendet“', async () => {
    pdf.antragPdfLaden.mockResolvedValue({
      hintergrund: JPG,
      breiteMm: 210,
      hoeheMm: 297,
      seiten: 3,
    });
    const f = await neueArt();
    fireEvent.click(within(f).getByRole('button', { name: 'Eigene PDF' }));
    pdfWaehlen(f);
    expect(
      await within(f).findByText(/3 Seiten – nur die erste Seite wird verwendet/),
    ).toBeTruthy();
  });

  it('kaputte PDF: verständliche Meldung, nichts verändert (kein Seitenbild, kein Platzhalter)', async () => {
    pdf.antragPdfLaden.mockRejectedValue(
      new ApiError(422, 'Diese PDF lässt sich nicht lesen (beschädigt oder kein Formular).'),
    );
    const f = await neueArt();
    fireEvent.click(within(f).getByRole('button', { name: 'Eigene PDF' }));
    pdfWaehlen(f);
    expect((await within(f).findByRole('alert')).textContent).toMatch(/lässt sich nicht lesen/);
    expect(document.querySelectorAll('[data-feld]')).toHaveLength(0);
    expect(within(f).getByRole('button', { name: 'PDF wählen' })).toBeTruthy();
  });

  it('eine andere PDF behält die schon gesetzten Platzhalter, ersetzt Bild und Format', async () => {
    const f = await bearbeiten(art(MIT_PDF));
    await waitFor(() => expect(chip('f1')).not.toBeNull());
    pdfWaehlen(f, 'neu.pdf');
    await waitFor(() => expect(screen.getByTestId('pdf-seite').style.width).toBe('297mm'));
    expect(document.querySelectorAll('[data-feld]')).toHaveLength(1);
    expect(chip('f1')!.style.left).toBe('20%');
    expect(within(f).getByText('neu.pdf')).toBeTruthy();
  });
});

describe('Speichern mit eigener PDF', () => {
  it('schickt art „pdf“, Format und Platzhalter im Block – das Bild nur als „neu“, nie im Block', async () => {
    const f = await neueArt();
    fireEvent.click(within(f).getByRole('button', { name: 'Eigene PDF' }));
    pdfWaehlen(f);
    await waitFor(() => expect(chip('f1')).not.toBeNull());
    // Platzhalter verschieben: neue Position wird gespeichert
    fireEvent.keyDown(chip('f2')!, { key: 'ArrowDown', shiftKey: true });
    speichern(f);
    await waitFor(() => expect(arten.nachweisArtSichern).toHaveBeenCalledOnce());
    const antrag = aufruf().einstellungen.antrag!;
    expect(antrag.art).toBe('pdf');
    expect(antrag.pdf).toMatchObject({ breiteMm: 297, hoeheMm: 210 });
    expect(antrag.pdf!.felder).toHaveLength(5);
    expect(antrag.pdf!.felder[1].y).toBe(25.1);
    expect(JSON.stringify(antrag)).not.toContain('data:image');
    expect(aufruf().antragBilder?.hintergrund).toEqual({ art: 'neu', src: JPG });
  });

  it('ohne gewählte PDF ist Speichern gesperrt und der Hinweis nennt den Grund', async () => {
    const f = await neueArt();
    fireEvent.click(within(f).getByRole('button', { name: 'Eigene PDF' }));
    const knopf = within(f).getByRole('button', { name: 'Speichern' });
    expect(knopf.hasAttribute('disabled')).toBe(true);
    expect(within(f).getByText('Bitte eine PDF mit dem Antragsformular wählen.')).toBeTruthy();
    fireEvent.click(knopf);
    expect(arten.nachweisArtSichern).not.toHaveBeenCalled();
  });

  it('die Unterschrift wird für die PDF genauso hochgeladen („neu“) und erscheint auf der Seite', async () => {
    const f = await neueArt();
    fireEvent.click(within(f).getByRole('button', { name: 'Eigene PDF' }));
    pdfWaehlen(f);
    await waitFor(() => expect(chip('f5')).not.toBeNull());
    expect(chip('f5')!.querySelector('img')).toBeNull();
    fireEvent.change(within(f).getByLabelText('Unterschrift hochladen'), {
      target: { files: [new File(['x'], 'u.png', { type: 'image/png' })] },
    });
    await waitFor(() => expect(chip('f5')!.querySelector('img')?.getAttribute('src')).toBe(PNG));
    speichern(f);
    await waitFor(() => expect(arten.nachweisArtSichern).toHaveBeenCalledOnce());
    expect(aufruf().antragBilder?.unterschrift).toEqual({ art: 'neu', src: PNG });
  });
});

describe('Art mit gespeicherter PDF bearbeiten', () => {
  it('Positionen und Hintergrund sind wieder da; Speichern lässt das Seitenbild „unverändert“', async () => {
    const f = await bearbeiten(art(MIT_PDF));
    await waitFor(() => expect(chip('f1')).not.toBeNull());
    expect(within(f).getByRole('button', { name: 'Eigene PDF' }).getAttribute('aria-pressed')).toBe(
      'true',
    );
    expect(chip('f1')!.style.left).toBe(pdfFeldStil(SEITE_ALT.felder[0]).left);
    expect(chip('f1')!.style.top).toBe(pdfFeldStil(SEITE_ALT.felder[0]).top);
    await waitFor(() =>
      expect(screen.getByTestId('pdf-seite').querySelector('img')?.getAttribute('src')).toBe(JPG),
    );
    expect(within(f).getByText('Gespeicherte PDF')).toBeTruthy();
    speichern(f);
    await waitFor(() => expect(arten.nachweisArtSichern).toHaveBeenCalledOnce());
    expect(aufruf().antragBilder?.hintergrund).toEqual({ art: 'unveraendert' });
    expect(aufruf().einstellungen.antrag?.pdf).toEqual(SEITE_ALT);
  });

  it('das bisherige Seitenbild lässt sich nicht lesen: Hinweis, und Speichern schickt „unverändert“ – nicht „keins“', async () => {
    arten.antragLaden.mockResolvedValue(null);
    const f = await bearbeiten(art(MIT_PDF));
    expect(await within(f).findAllByText(/bleibt beim Speichern, wie es ist/)).not.toHaveLength(0);
    speichern(f);
    await waitFor(() => expect(arten.nachweisArtSichern).toHaveBeenCalledOnce());
    expect(aufruf().antragBilder?.hintergrund).toEqual({ art: 'unveraendert' });
  });

  it('eine Art mit Baukasten bleibt Baukasten (keine art im Block, Seitenbild „keins“)', async () => {
    const f = await bearbeiten(art(BAUKASTEN));
    await within(f).findByLabelText('Überschrift');
    speichern(f);
    await waitFor(() => expect(arten.nachweisArtSichern).toHaveBeenCalledOnce());
    expect(aufruf().einstellungen.antrag?.art).toBeUndefined();
    expect(aufruf().einstellungen.antrag?.pdf).toBeUndefined();
    expect(aufruf().antragBilder?.hintergrund).toEqual({ art: 'keins' });
  });
});
