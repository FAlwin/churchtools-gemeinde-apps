// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { jsPDF } from 'jspdf';

// pdf.js zeichnet in jsdom nicht – Leinwand-Attrappen, je Seite eine; Fehlschläge stellt der Test ein.
const zeichnen = vi.hoisted(() => ({ klein: false, gross: false }));
vi.mock('./pdfSeiten', () => {
  const blatt = (n: number) => ({ toDataURL: () => `data:image/jpeg;seite${n}` });
  return {
    renderPdfToCanvases: vi.fn(async (data: ArrayBuffer) => {
      if (zeichnen.klein) throw new Error('pdf.js');
      const seiten = (new TextDecoder().decode(data).match(/\/Type \/Page\b/g) ?? []).length;
      return Array.from({ length: seiten }, (_, i) => blatt(i + 1));
    }),
    renderPdfSeite: vi.fn(async (_d: ArrayBuffer, nr: number) => {
      if (zeichnen.gross) throw new Error('pdf.js');
      return blatt(nr);
    }),
  };
});
const { PdfSeitenVorschau } = await import('./PdfSeitenVorschau');

const pdf = (seiten: number) => {
  const doc = new jsPDF();
  for (let i = 1; i < seiten; i++) doc.addPage();
  return doc;
};

beforeEach(() => {
  zeichnen.klein = false;
  zeichnen.gross = false;
});

/** Die Vorschau im Teilen-Fenster (#845: seit Scheibe 3 über `useLaden`). */
describe('PdfSeitenVorschau', () => {
  it('klappt das Zeichnen nicht, verschwindet die Vorschau ganz – kein ewiges „lädt“', async () => {
    zeichnen.klein = true;
    const { container } = render(<PdfSeitenVorschau doc={pdf(2)} />);
    await act(async () => undefined);
    expect(container.innerHTML).toBe('');
  });

  it('eine Seite antippen zeigt sie groß; lässt sie sich nicht zeichnen, zurück zur Übersicht', async () => {
    render(<PdfSeitenVorschau doc={pdf(2)} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Seite 2 vergrößern' }));
    expect(await screen.findByRole('img', { name: 'Seite 2' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /Alle Seiten/ }));

    zeichnen.gross = true;
    fireEvent.click(await screen.findByRole('button', { name: 'Seite 1 vergrößern' }));
    expect(await screen.findAllByRole('button', { name: /vergrößern/ })).toHaveLength(2);
    expect(screen.queryByText(/Seite 1 von/)).toBeNull();
  });

  it('ein neues PDF schließt die Großansicht und zeigt dessen Seiten', async () => {
    const { rerender } = render(<PdfSeitenVorschau doc={pdf(2)} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Seite 2 vergrößern' }));
    expect(await screen.findByText('Seite 2 von 2')).toBeTruthy();
    rerender(<PdfSeitenVorschau doc={pdf(3)} />);
    expect(await screen.findAllByRole('button', { name: /vergrößern/ })).toHaveLength(3);
    expect(screen.queryByText(/von 2/)).toBeNull();
  });
});
