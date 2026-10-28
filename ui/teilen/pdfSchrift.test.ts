// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';

describe('schriftImDokument', () => {
  it('scheitert das Anmelden, wird beim nächsten Mal neu versucht – nicht der Fehler gemerkt', async () => {
    const angemeldet: string[] = [];
    let versuche = 0;
    vi.stubGlobal(
      'FontFace',
      class {
        constructor(
          readonly family: string,
          _daten: ArrayBuffer,
          readonly art: { weight: string },
        ) {}
        load() {
          versuche++;
          return versuche === 1
            ? Promise.reject(new Error('vorübergehend'))
            : Promise.resolve(this);
        }
      },
    );
    Object.defineProperty(document, 'fonts', {
      configurable: true,
      value: {
        add: (f: { family: string; art: { weight: string } }) =>
          angemeldet.push(`${f.family} ${f.art.weight}`),
      },
    });
    const { schriftImDokument } = await import('./pdfSchrift');
    await expect(schriftImDokument()).rejects.toThrow('vorübergehend');
    await schriftImDokument();
    expect(angemeldet).toEqual(['LatoPdf 400', 'LatoPdf 700']);
    // Einmal angemeldet, bleibt es dabei.
    await schriftImDokument();
    expect(angemeldet).toHaveLength(2);
    vi.unstubAllGlobals();
  });
});
