import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { jsPDF } from 'jspdf';

/**
 * **Gemeinde Sans** (16.11.2026, `schrift/HERKUNFT.md`): Lato, gekürzt, damit das Protokolle-ZIP in ChurchTools passt.
 * Wer die Auswahl weiter kürzt, darf keine Zeichen verlieren, die in Namen und Protokollen vorkommen – und die
 * gekürzte Fassung darf nicht „Lato“ heißen (SIL OFL, reservierter Name).
 */

const SCHNITTE = [
  'GemeindeSans-Regular.ttf',
  'GemeindeSans-Bold.ttf',
  'GemeindeSans-Italic.ttf',
  'GemeindeSans-BoldItalic.ttf',
];

/** Zeichen, die sicher in jedem Schnitt stehen müssen. */
const NOETIG = [
  ...'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789',
  ...'ÄÖÜäöüßẞ'.replace('ẞ', ''), // großes ẞ hat Lato nicht – kein Anspruch
  ...'.,;:!?()[]/&%+-=*@#§°²³½',
  ...'„“‚‘”’«»–—…•·€№™',
  ...'ÉéÈèÀàÇçÑñÅåØøŁłŚśŻżŹźČčŘřŠšŽžĚěŮů', // Namen aus Nachbarländern
  ...'АБВГДЕЁЖЗИЙКЛМНОПРСТУФХЦЧШЩЪЫЬЭЮЯабвгдеёжзийклмнопрстуфхцчшщъыьэюя', // Russisch
  ...'ЄєІіЇїҐґ', // Ukrainisch
];

const metadaten = (datei: string) => {
  const d = new jsPDF();
  const roh = readFileSync(new URL(`./schrift/${datei}`, import.meta.url)).toString('base64');
  d.addFileToVFS(datei, roh);
  d.addFont(datei, 'Probe', 'normal');
  d.setFont('Probe', 'normal');
  return (
    d.getFont() as unknown as {
      metadata: {
        cmap: { unicode: { codeMap: Record<number, number> } };
        name: Record<string, unknown>;
      };
    }
  ).metadata;
};

/**
 * Ein Namenseintrag als Text – jsPDF liefert die meisten Einträge je Plattform roh (UTF-16, Nullbytes dazwischen),
 * manche als einfachen Text.
 */
const text = (v: unknown): string =>
  Array.isArray(v)
    ? v
        .map((e: { raw?: string }) => (e.raw ?? '').split(String.fromCharCode(0)).join(''))
        .join(' | ')
    : typeof v === 'string'
      ? v
      : '';

describe('Gemeinde Sans', () => {
  for (const datei of SCHNITTE) {
    it(`${datei}: alle nötigen Zeichen, nicht „Lato“ genannt`, () => {
      const m = metadaten(datei);
      const fehlt = NOETIG.filter((z) => !m.cmap.unicode.codeMap[z.codePointAt(0)!]);
      expect(fehlt).toEqual([]);
      const namen = [
        'fontFamily',
        'uniqueSubfamily',
        'fontName',
        'postscriptName',
        'preferredFamily',
      ];
      for (const feld of namen) expect(text(m.name[feld]), feld).not.toMatch(/lato/i);
      expect(text(m.name.fontFamily)).toMatch(/^Gemeinde Sans( \| Gemeinde Sans)*$/);
      expect(text(m.name.postscriptName)).toMatch(/^GemeindeSans-/);
      // Der Ursprung bleibt genannt (Lizenz verlangt Copyright und Lizenz in der veränderten Fassung).
      expect(text(m.name.copyright)).toMatch(/Reserved Font Name "Lato"/);
    });
  }

  it('gekürzt: Griechisch ist nicht mehr drin (sonst wäre die Datei wieder groß)', () => {
    expect(metadaten('GemeindeSans-Regular.ttf').cmap.unicode.codeMap[0x3a9]).toBeUndefined();
  });
});
