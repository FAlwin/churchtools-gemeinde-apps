// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { jsPDF } from 'jspdf';
import type { GebautesPdf } from './TeilenFenster';

vi.mock('../utils/sharePdf', () => ({ sharePdf: vi.fn(() => Promise.resolve()) }));
const { sharePdf } = await import('../utils/sharePdf');
const { TeilenFenster } = await import('./TeilenFenster');
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
});
