import { describe, expect, it } from 'vitest';
import { aufzaehlungsZeichen } from './aufzaehlung';
import {
  enterInZelle,
  markeDerZeile,
  naechsteMarke,
  wirdZuPunkt,
  zeileVorCursor,
  ZELLEN_PUNKT,
} from './zellenListe';

describe('Aufzählung in Zellen: die Regel', () => {
  it('das Zeichen ist das der obersten Listenebene', () => {
    expect(ZELLEN_PUNKT).toBe(aufzaehlungsZeichen(0));
  });

  it('markeDerZeile: Punkt und Nummer, sonst nichts', () => {
    expect(markeDerZeile('• Brot')).toEqual({ marke: { art: 'punkt' }, laenge: 2 });
    expect(markeDerZeile('12. Brot')).toEqual({ marke: { art: 'nummer', nr: 12 }, laenge: 4 });
    for (const z of ['Brot', '•Brot', '1.Brot', '1) Brot', ' • Brot', '2026. Brot', '- Brot', '']) {
      expect(markeDerZeile(z)).toBeNull();
    }
  });

  it('naechsteMarke zählt mit', () => {
    expect(naechsteMarke({ art: 'punkt' })).toBe('• ');
    expect(naechsteMarke({ art: 'nummer', nr: 1 })).toBe('2. ');
    expect(naechsteMarke({ art: 'nummer', nr: 9 })).toBe('10. ');
  });

  it('zeileVorCursor: ab dem letzten Zeilenumbruch', () => {
    expect(zeileVorCursor('a\nb\n- ')).toBe('- ');
    expect(zeileVorCursor('abc')).toBe('abc');
    expect(zeileVorCursor('a\n')).toBe('');
  });

  it('wirdZuPunkt: nur „-“ oder „*“ allein vor dem Cursor', () => {
    expect(wirdZuPunkt('-')).toBe(true);
    expect(wirdZuPunkt('*')).toBe(true);
    for (const z of ['', 'a-', '--', '- ', '1', '•']) expect(wirdZuPunkt(z)).toBe(false);
  });

  it('enterInZelle', () => {
    // Zeile mit Text: nächste Marke
    expect(enterInZelle('• eins', '• eins')).toEqual({ tun: 'weiter', vorsatz: '• ' });
    expect(enterInZelle('3. drei', '3. drei')).toEqual({ tun: 'weiter', vorsatz: '4. ' });
    // leere Aufzählungszeile: beenden
    expect(enterInZelle('• ', '• ')).toEqual({ tun: 'beenden', laenge: 2 });
    expect(enterInZelle('10. ', '10. ')).toEqual({ tun: 'beenden', laenge: 4 });
    // keine Aufzählung: bisheriges Verhalten
    expect(enterInZelle('eins', 'eins')).toEqual({ tun: 'nichts' });
    expect(enterInZelle('', '')).toEqual({ tun: 'nichts' });
    // Cursor in der Marke: bisheriges Verhalten
    expect(enterInZelle('• eins', '•')).toEqual({ tun: 'nichts' });
  });
});
