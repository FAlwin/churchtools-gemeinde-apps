import { describe, expect, it } from 'vitest';
import { ApiError } from '@ui/ct/fehler';
import {
  ANTRAG_BILD_KANTE,
  ANTRAG_BILD_QUELLE_MAX,
  antragBildGroesse,
  antragBildPruefen,
  antragBildTyp,
} from './antragBild';

describe('Bilder für den Antrag', () => {
  it('verkleinert auf die längste Seite, behält das Seitenverhältnis', () => {
    expect(antragBildGroesse(1600, 800)).toEqual({ breite: ANTRAG_BILD_KANTE, hoehe: 400 });
    expect(antragBildGroesse(600, 3000)).toEqual({ breite: 160, hoehe: ANTRAG_BILD_KANTE });
  });

  it('vergrößert nie, und nie unter einen Pixel', () => {
    expect(antragBildGroesse(200, 100)).toEqual({ breite: 200, hoehe: 100 });
    expect(antragBildGroesse(10000, 1)).toEqual({ breite: ANTRAG_BILD_KANTE, hoehe: 1 });
  });

  it('PNG bleibt PNG (Transparenz), JPG bleibt JPG, alles andere wird PNG', () => {
    expect(antragBildTyp('image/png')).toBe('image/png');
    expect(antragBildTyp('image/jpeg')).toBe('image/jpeg');
    for (const t of ['image/webp', 'image/gif', 'image/svg+xml', 'image/heic'])
      expect(antragBildTyp(t)).toBe('image/png');
  });

  it('kein Bild und zu große Dateien werden verständlich abgewiesen', () => {
    expect(() => antragBildPruefen({ type: 'application/pdf', size: 10 })).toThrow(/Bild/);
    try {
      antragBildPruefen({ type: 'image/png', size: ANTRAG_BILD_QUELLE_MAX + 1 });
      expect.unreachable();
    } catch (e) {
      expect(e).toBeInstanceOf(ApiError);
      expect((e as ApiError).status).toBe(413);
    }
    expect(() => antragBildPruefen({ type: 'image/jpeg', size: 1000 })).not.toThrow();
  });
});
