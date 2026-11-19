// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '@ui/ct/fehler';
import {
  ANTRAG_HINTERGRUND_DPI,
  ANTRAG_HINTERGRUND_MAX,
  ANTRAG_PDF_MAX,
  antragPdfLaden,
  antragPdfMasse,
  antragPdfPruefen,
  hintergrundErzeugen,
} from './antragPdf';
import { beispielPdf } from './testdaten/beispielPdf';

/**
 * Die eigene PDF (N1d): prüfen, erste Seite zeichnen, Format übernehmen. pdf.js ist ersetzt (jsdom kann nicht zeichnen);
 * das Parsen der Beispiel-PDF mit dem echten pdf.js prüft `beispielPdf` im Test unten.
 */
const oeffnen = vi.hoisted(() => vi.fn());
vi.mock('@ui/teilen/pdfSeiten', () => ({ pdfSeiteOeffnen: (...a: unknown[]) => oeffnen(...a) }));

const JPG = (n: number) => `data:image/jpeg;base64,${'A'.repeat(n)}`;
// jsdom kennt `File.arrayBuffer()` nicht (Browser schon) – hier mit acht Byte nachgestellt.
const datei = (typ = 'application/pdf', groesse = 1000) => {
  const f = new File([new Uint8Array(8)], 'antrag.pdf', { type: typ });
  Object.defineProperty(f, 'size', { value: groesse });
  Object.defineProperty(f, 'arrayBuffer', { value: async () => new ArrayBuffer(8) });
  return f;
};
const flaeche = (n: number) => ({ toDataURL: vi.fn(() => JPG(n)) });

describe('antragPdfPruefen', () => {
  it('nur application/pdf, höchstens 15 MB', () => {
    expect(() => antragPdfPruefen(datei())).not.toThrow();
    expect(() => antragPdfPruefen(datei('image/png'))).toThrow(/PDF-Datei/);
    expect(() => antragPdfPruefen(datei('', 100))).toThrow(/PDF-Datei/);
    expect(() => antragPdfPruefen(datei('application/pdf', ANTRAG_PDF_MAX + 1))).toThrow(/15 MB/);
    expect(() => antragPdfPruefen(datei('application/pdf', ANTRAG_PDF_MAX))).not.toThrow();
  });
});

describe('Seitenformat: pt → mm', () => {
  it('A4 hoch, Querformat und US Letter kommen mit ihrem Format heraus', () => {
    expect(antragPdfMasse(595.276, 841.89)).toEqual({ breiteMm: 210, hoeheMm: 297 });
    expect(antragPdfMasse(841.89, 595.276)).toEqual({ breiteMm: 297, hoeheMm: 210 });
    expect(antragPdfMasse(612, 792)).toEqual({ breiteMm: 215.9, hoeheMm: 279.4 });
  });
  it('winzige und riesige Seiten werden abgewiesen', () => {
    expect(() => antragPdfMasse(20, 20)).toThrow(/Seitenformat/);
    expect(() => antragPdfMasse(5000, 800)).toThrow(/Seitenformat/);
    expect(() => antragPdfMasse(NaN, 800)).toThrow(/Seitenformat/);
  });
});

describe('JPEG-Grenze mit Neuversuch bei kleinerer Auflösung', () => {
  it('passt es gleich, bleibt es bei 150 dpi (ein Versuch)', async () => {
    const zeichne = vi.fn(async () => flaeche(100));
    expect(await hintergrundErzeugen(zeichne)).toBe(JPG(100));
    expect(zeichne.mock.calls.map((c) => (c as unknown as number[])[0])).toEqual([150]);
  });

  it('zu groß: erneut mit der nächstgröberen Auflösung, bis es passt', async () => {
    const groesse: Record<number, number> = { 150: 3000, 120: 2500, 100: 900, 72: 100 };
    const zeichne = vi.fn(async (dpi: number) => flaeche(groesse[dpi]));
    expect(await hintergrundErzeugen(zeichne, 2000)).toBe(JPG(900));
    expect(zeichne.mock.calls.map((c) => c[0])).toEqual([150, 120, 100]);
  });

  it('die Reihenfolge der Auflösungen geht von scharf nach grob, Qualität 0,85', async () => {
    expect([...ANTRAG_HINTERGRUND_DPI]).toEqual([150, 120, 100, 72]);
    const f = flaeche(10);
    await hintergrundErzeugen(async () => f);
    expect(f.toDataURL).toHaveBeenCalledWith('image/jpeg', 0.85);
  });

  it('hilft auch die gröbste nicht, kommt eine Meldung (413) – kein Bild', async () => {
    const zeichne = vi.fn(async () => flaeche(5000));
    const fehler = await hintergrundErzeugen(zeichne, 2000).catch((e: unknown) => e);
    expect(fehler).toBeInstanceOf(ApiError);
    expect((fehler as ApiError).status).toBe(413);
    expect(zeichne).toHaveBeenCalledTimes(ANTRAG_HINTERGRUND_DPI.length);
  });

  it('die Grenze liegt bei 2 MB; genau auf der Grenze zählt noch', async () => {
    expect(ANTRAG_HINTERGRUND_MAX).toBe(2 * 1024 * 1024);
    const rand = ANTRAG_HINTERGRUND_MAX - 'data:image/jpeg;base64,'.length;
    const zeichne = vi.fn(async () => flaeche(rand));
    await expect(hintergrundErzeugen(zeichne)).resolves.toHaveLength(ANTRAG_HINTERGRUND_MAX);
    expect(zeichne).toHaveBeenCalledOnce();
  });

  it('liefert der Browser kein JPEG (leere Leinwand: „data:,“), wird nichts gespeichert', async () => {
    const zeichne = async () => ({ toDataURL: () => 'data:,' });
    await expect(hintergrundErzeugen(zeichne)).rejects.toBeInstanceOf(ApiError);
  });
});

describe('antragPdfLaden (pdf.js ersetzt)', () => {
  const geoeffnet = (teil: Record<string, unknown> = {}) => {
    const schliessen = vi.fn();
    const zeichnen = vi.fn(async () => flaeche(500));
    oeffnen.mockResolvedValue({
      seiten: 1,
      breitePt: 595.276,
      hoehePt: 841.89,
      zeichnen,
      schliessen,
      ...teil,
    });
    return { schliessen, zeichnen };
  };
  beforeEach(() => {
    oeffnen.mockReset();
  });

  it('erste Seite als JPEG, Format aus der PDF, nur Seite 1 geöffnet, Dokument wieder geschlossen', async () => {
    const { schliessen, zeichnen } = geoeffnet({ breitePt: 612, hoehePt: 792 });
    const r = await antragPdfLaden(datei());
    expect(r).toEqual({ hintergrund: JPG(500), breiteMm: 215.9, hoeheMm: 279.4, seiten: 1 });
    expect(oeffnen.mock.calls[0][1]).toBe(1);
    // 150 dpi = Maßstab 150 / 72 (1 pt = 1/72 Zoll)
    expect(zeichnen).toHaveBeenCalledWith(150 / 72);
    expect(schliessen).toHaveBeenCalledOnce();
  });

  it('mehrseitig: die Seitenzahl wird gemeldet (die Oberfläche sagt „nur die erste Seite“), gezeichnet wird eine', async () => {
    const { zeichnen } = geoeffnet({ seiten: 3 });
    const r = await antragPdfLaden(datei());
    expect(r.seiten).toBe(3);
    expect(zeichnen).toHaveBeenCalledTimes(1);
  });

  it('kaputte PDF: verständliche Meldung, nichts wird geliefert', async () => {
    oeffnen.mockImplementation(async () => {
      throw Object.assign(new Error('Invalid PDF structure'), { name: 'InvalidPDFException' });
    });
    await expect(antragPdfLaden(datei())).rejects.toThrow(
      /lässt sich nicht lesen.*nichts verändert/,
    );
  });

  it('verschlüsselte PDF: eigene Meldung', async () => {
    oeffnen.mockImplementation(async () => {
      throw Object.assign(new Error('No password given'), { name: 'PasswordException' });
    });
    await expect(antragPdfLaden(datei())).rejects.toThrow(/Kennwort/);
  });

  it('falscher Dateityp: abgewiesen, pdf.js wird gar nicht erst angefasst', async () => {
    await expect(antragPdfLaden(datei('text/plain'))).rejects.toThrow(/PDF-Datei/);
    expect(oeffnen).not.toHaveBeenCalled();
  });

  it('die Seite lässt sich nicht zeichnen: Meldung, Dokument trotzdem geschlossen', async () => {
    const { schliessen } = geoeffnet({
      zeichnen: vi.fn(async () => {
        throw new Error('render');
      }),
    });
    await expect(antragPdfLaden(datei())).rejects.toThrow(/nicht zeichnen/);
    expect(schliessen).toHaveBeenCalledOnce();
  });

  it('unmögliches Seitenformat: abgewiesen, Dokument geschlossen', async () => {
    const { schliessen } = geoeffnet({ breitePt: 3000, hoehePt: 3000 });
    await expect(antragPdfLaden(datei())).rejects.toThrow(/Seitenformat/);
    expect(schliessen).toHaveBeenCalledOnce();
  });
});

describe('Beispiel-PDF (selbst erzeugt)', () => {
  it('ist eine gültige PDF mit dem verlangten Format und der verlangten Seitenzahl (echtes pdf.js)', async () => {
    const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
    const dok = await pdfjs.getDocument({
      data: beispielPdf({ seiten: 2, breitePt: 595.276, hoehePt: 841.89 }),
    }).promise;
    expect(dok.numPages).toBe(2);
    const vp = (await dok.getPage(1)).getViewport({ scale: 1 });
    expect(antragPdfMasse(vp.width, vp.height)).toEqual({ breiteMm: 210, hoeheMm: 297 });
  });
});
