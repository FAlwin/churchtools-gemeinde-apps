// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * `pdfSeiteOeffnen` (N1d): Seitenzahl, Maße und ein Zeichner für beliebigen Maßstab. pdf.js und sein Worker sind ersetzt –
 * jsdom kann weder Worker noch Leinwand zeichnen.
 */
const doc = vi.hoisted(() => ({
  numPages: 3,
  getPage: vi.fn(),
  destroy: vi.fn(),
}));
vi.mock('pdfjs-dist', () => ({
  getDocument: vi.fn(() => ({ promise: Promise.resolve(doc) })),
}));
vi.mock('./pdfSetup', () => ({}));

import { pdfSeiteOeffnen } from './pdfSeiten';

const seite = (breite: number, hoehe: number) => ({
  getViewport: ({ scale }: { scale: number }) => ({ width: breite * scale, height: hoehe * scale }),
  render: vi.fn(() => ({ promise: Promise.resolve() })),
});

beforeEach(() => {
  doc.numPages = 3;
  doc.destroy.mockReset();
  doc.getPage.mockReset().mockResolvedValue(seite(595.276, 841.89));
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(
    {} as CanvasRenderingContext2D,
  );
});

describe('pdfSeiteOeffnen', () => {
  it('liefert Seitenzahl und Maße in pt (Maßstab 1 = 72 dpi) und öffnet nur die gewünschte Seite', async () => {
    const s = await pdfSeiteOeffnen(new ArrayBuffer(8), 1);
    expect(s).toMatchObject({ seiten: 3, breitePt: 595.276, hoehePt: 841.89 });
    expect(doc.getPage).toHaveBeenCalledTimes(1);
    expect(doc.getPage).toHaveBeenCalledWith(1);
  });

  it('zeichnet mit dem verlangten Maßstab (150 dpi = 150 / 72) – mehrmals, ohne das Dokument neu zu laden', async () => {
    const s = await pdfSeiteOeffnen(new ArrayBuffer(8));
    const gross = await s.zeichnen(150 / 72);
    const klein = await s.zeichnen(72 / 72);
    expect(gross.width).toBe(Math.ceil((595.276 * 150) / 72));
    expect(klein.width).toBe(Math.ceil(595.276));
    expect(gross.height).toBeGreaterThan(klein.height);
  });

  it('schließen gibt das Dokument frei', async () => {
    const s = await pdfSeiteOeffnen(new ArrayBuffer(8));
    expect(doc.destroy).not.toHaveBeenCalled();
    s.schliessen();
    expect(doc.destroy).toHaveBeenCalledOnce();
  });

  it('lässt sich die Seite nicht öffnen, wird das Dokument freigegeben und der Fehler weitergegeben', async () => {
    doc.getPage.mockRejectedValue(new Error('Seite fehlt'));
    await expect(pdfSeiteOeffnen(new ArrayBuffer(8), 9)).rejects.toThrow('Seite fehlt');
    expect(doc.destroy).toHaveBeenCalledOnce();
  });
});
