// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, act } from '@testing-library/react';

/**
 * Die PDF-Vorschau des Editors holt ihr Logo über den Liedzugriff der App (LW1b-1, 06.11.2026) – vorher direkt aus der
 * Musik-App (`useAppLogo`). Geprüft wird, dass das Logo des Zugriffs beim Blatt ankommt; sonst stünde der Text in der
 * Vorschau wieder höher als auf dem fertigen Blatt (19.10.2026).
 */
const pdf = vi.hoisted(() => ({ optionen: [] as { logo?: unknown }[] }));
vi.mock('../chordPdf', () => ({
  generateChordPdf: (_lied: unknown, optionen: { logo?: unknown }) => {
    pdf.optionen.push(optionen);
    // Danach bricht die Vorschau ab („ungültiger Zwischenstand") – pdf.js braucht dieser Test nicht.
    throw new Error('nur mitschreiben');
  },
}));
vi.mock('pdfjs-dist', () => ({}));
vi.mock('../../teilen/pdfSetup', () => ({}));

const { LiedZugriffKontext } = await import('../liedZugriff');
const { PdfPreview } = await import('./PdfPreview');

const LOGO = { erkennung: 'Logo der Gemeinde' } as unknown as HTMLImageElement;

beforeEach(() => {
  vi.useFakeTimers();
  pdf.optionen.length = 0;
  globalThis.ResizeObserver = class {
    observe() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
});
afterEach(() => {
  vi.useRealTimers();
});

describe('PdfPreview – Logo aus dem Liedzugriff', () => {
  it('gibt das Logo des Zugriffs an das Blatt weiter', () => {
    const zugriff = { useBlattLogo: () => LOGO } as unknown as import('../liedZugriff').LiedZugriff;
    render(
      <LiedZugriffKontext.Provider value={zugriff}>
        <PdfPreview title="Treu" text={'{title: Treu}\n[D]Zeile'} semitones={0} />
      </LiedZugriffKontext.Provider>,
    );
    // Die Vorschau wartet 350 ms, bis das Tippen ruht.
    act(() => {
      vi.advanceTimersByTime(400);
    });
    expect(pdf.optionen).toHaveLength(1);
    expect(pdf.optionen[0].logo).toBe(LOGO);
  });

  it('ohne Logo (lädt noch, fehlt, ausgeblendet) entsteht das Blatt ohne', () => {
    const zugriff = { useBlattLogo: () => null } as unknown as import('../liedZugriff').LiedZugriff;
    render(
      <LiedZugriffKontext.Provider value={zugriff}>
        <PdfPreview title="Treu" text={'{title: Treu}\n[D]Zeile'} semitones={0} />
      </LiedZugriffKontext.Provider>,
    );
    act(() => {
      vi.advanceTimersByTime(400);
    });
    expect(pdf.optionen[0].logo).toBeNull();
  });
});
