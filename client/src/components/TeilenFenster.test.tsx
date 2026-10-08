// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { jsPDF } from 'jspdf';
import type { GebautesPdf } from './TeilenFenster';

vi.mock('../utils/sharePdf', () => ({
  sharePdf: vi.fn(() => Promise.resolve()),
  downloadPdf: vi.fn(),
}));
// pdf.js zeichnet in jsdom nicht – die Vorschau bekommt Leinwand-Attrappen, je Seite eine.
const zeichnen = vi.hoisted(() => ({ fehlschlag: false }));
vi.mock('../utils/dokumentSeiten', () => {
  const blatt = (n: number) => ({ toDataURL: () => `data:image/jpeg;seite${n}` });
  return {
    renderPdfToCanvases: vi.fn(async (data: ArrayBuffer) => {
      if (zeichnen.fehlschlag) throw new Error('pdf.js');
      const seiten = (new TextDecoder().decode(data).match(/\/Type \/Page\b/g) ?? []).length;
      return Array.from({ length: seiten }, (_, i) => blatt(i + 1));
    }),
    renderPdfSeite: vi.fn(async (_d: ArrayBuffer, nr: number) => blatt(nr)),
  };
});
const { downloadPdf, sharePdf } = await import('../utils/sharePdf');
const { TeilenFenster } = await import('./TeilenFenster');
const { PdfSeitenVorschau } = await import('./PdfSeitenVorschau');
const { getTeilenMitAnmerkungen } = await import('../utils/devicePrefs');

/**
 * Das Teilen-Fenster (Alwin, 07.10.2026): Anmerkungen ja/nein, das PDF entsteht im Hintergrund,
 * „Teilen" erst, wenn es fertig ist (iOS öffnet das Teilen-Menü nur direkt nach einem Antippen).
 */
function offen() {
  const auftraege: { mit: boolean; fertig: (p: GebautesPdf) => void }[] = [];
  const bauen = vi.fn(
    (mit: boolean) =>
      new Promise<GebautesPdf>((fertig) => {
        auftraege.push({ mit, fertig });
      }),
  );
  const onClose = vi.fn();
  render(
    <TeilenFenster
      titel="Ablauf teilen"
      dateiname="Gottesdienst"
      bauen={bauen}
      onClose={onClose}
    />,
  );
  return { auftraege, bauen, onClose };
}
const pdf = (seiten: number, hinweis = ''): GebautesPdf => {
  const doc = new jsPDF();
  for (let i = 1; i < seiten; i++) doc.addPage();
  return { doc, hinweis };
};

beforeEach(() => {
  localStorage.clear();
  vi.clearAllMocks();
  zeichnen.fehlschlag = false;
});

describe('TeilenFenster', () => {
  it('Vorgabe ohne Anmerkungen; „Teilen" erst, wenn das PDF fertig ist', async () => {
    const { auftraege } = offen();
    expect(auftraege.map((a) => a.mit)).toEqual([false]);
    expect(screen.getByText('PDF wird erstellt …')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Teilen' })).toBeNull();
    await act(async () => auftraege[0].fertig(pdf(3)));
    expect(screen.getByText('Fertig · 3 Seiten')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Teilen' }));
    expect(sharePdf).toHaveBeenCalledWith(expect.anything(), 'Gottesdienst');
  });

  it('Umschalten baut neu MIT Anmerkungen und merkt die Wahl auf dem Gerät', async () => {
    const { auftraege } = offen();
    fireEvent.click(screen.getByRole('button', { name: /Meine Anmerkungen/ }));
    expect(auftraege.map((a) => a.mit)).toEqual([false, true]);
    expect(getTeilenMitAnmerkungen()).toBe(true);
  });

  it('ein veraltetes PDF (zur alten Wahl) wird verworfen, auch wenn es später fertig wird', async () => {
    const { auftraege } = offen();
    fireEvent.click(screen.getByRole('button', { name: /Meine Anmerkungen/ }));
    await act(async () => auftraege[1].fertig(pdf(2)));
    await act(async () => auftraege[0].fertig(pdf(7)));
    expect(screen.getByText('Fertig · 2 Seiten')).toBeTruthy();
  });

  it('ein Hinweis auf fehlende Lieder steht neben „Fertig"', async () => {
    const { auftraege } = offen();
    await act(async () => auftraege[0].fertig(pdf(1, 'Nicht geladen, fehlt im PDF: Lied X')));
    expect(screen.getByText('Fertig · 1 Seite. Nicht geladen, fehlt im PDF: Lied X')).toBeTruthy();
  });

  it('„Herunterladen" lädt direkt herunter – ohne Teilen-Menü, das Fenster bleibt offen', async () => {
    const { auftraege, onClose } = offen();
    await act(async () => auftraege[0].fertig(pdf(2)));
    fireEvent.click(screen.getByRole('button', { name: 'Herunterladen' }));
    expect(downloadPdf).toHaveBeenCalledWith(expect.anything(), 'Gottesdienst');
    expect(sharePdf).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByText('Fertig · 2 Seiten. Heruntergeladen')).toBeTruthy();
  });

  it('„Herunterladen" geht erst, wenn das PDF fertig ist', () => {
    offen();
    const knopf = screen.getByRole('button', { name: 'Herunterladen' });
    expect((knopf as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(knopf);
    expect(downloadPdf).not.toHaveBeenCalled();
  });
});

describe('Vorschau im Teilen-Fenster (08.10.2026)', () => {
  it('zeigt jede Seite als Blatt; Antippen zeigt sie groß, blättern und zurück', async () => {
    const { auftraege } = offen();
    await act(async () => auftraege[0].fertig(pdf(3)));
    const blaetter = await screen.findAllByRole('button', { name: /^Seite \d vergrößern$/ });
    expect(blaetter).toHaveLength(3);
    fireEvent.click(blaetter[1]);
    expect(await screen.findByText('Seite 2 von 3')).toBeTruthy();
    expect((await screen.findByAltText('Seite 2')).getAttribute('src')).toBe(
      'data:image/jpeg;seite2',
    );
    fireEvent.click(screen.getByRole('button', { name: 'Nächste Seite' }));
    expect(await screen.findByText('Seite 3 von 3')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Nächste Seite' })).toHaveProperty('disabled', true);
    fireEvent.click(screen.getByRole('button', { name: /Alle Seiten/ }));
    expect(await screen.findAllByRole('button', { name: /vergrößern/ })).toHaveLength(3);
  });

  it('umschalten: die Vorschau zeigt das NEUE PDF', async () => {
    const { auftraege } = offen();
    await act(async () => auftraege[0].fertig(pdf(3)));
    expect(await screen.findAllByRole('button', { name: /vergrößern/ })).toHaveLength(3);
    fireEvent.click(screen.getByRole('button', { name: /Meine Anmerkungen/ }));
    await act(async () => auftraege[1].fertig(pdf(5)));
    expect(await screen.findAllByRole('button', { name: /vergrößern/ })).toHaveLength(5);
  });

  it('klappt die Vorschau nicht, bleiben Teilen und Herunterladen', async () => {
    zeichnen.fehlschlag = true;
    const { auftraege } = offen();
    await act(async () => auftraege[0].fertig(pdf(2)));
    expect(screen.queryByRole('button', { name: /vergrößern/ })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Teilen' }));
    expect(sharePdf).toHaveBeenCalled();
  });

  it('die Vorschau selbst folgt einem neuen PDF, auch ohne neu eingehängt zu werden', async () => {
    // Im Teilen-Fenster sorgt schon das Neu-Einhängen beim Umschalten dafür (Gegenprobe 08.10.2026) –
    // dieser Test bewacht die Vorschau für sich, falls sie einmal woanders steht.
    const { rerender } = render(<PdfSeitenVorschau doc={pdf(3).doc} />);
    expect(await screen.findAllByRole('button', { name: /vergrößern/ })).toHaveLength(3);
    rerender(<PdfSeitenVorschau doc={pdf(5).doc} />);
    expect(await screen.findAllByRole('button', { name: /vergrößern/ })).toHaveLength(5);
  });
});
