import { describe, expect, it } from 'vitest';
import {
  adresseGueltig,
  hinweisLinks,
  hinweisTeile,
  linkEntfernen,
  linkSetzen,
} from './hinweisLinks';

/** F5b – Links in Hinweistexten (Klick-Runde 6, Entwurf f5b-links-v1, Variante A). */

const TEXT = 'Bitte lies die Anmeldebedingungen und das Schutzkonzept.';

describe('Links in Hinweistexten (F5b)', () => {
  it('zerlegt Text und Links – auch mehrere', () => {
    const t =
      'Lies die [Bedingungen](https://ac-zeltlager.de/b) und das [Konzept](https://ecg-donrath.de/k).';
    expect(hinweisTeile(t)).toEqual([
      { art: 'text', text: 'Lies die ' },
      { art: 'link', text: 'Bedingungen', adresse: 'https://ac-zeltlager.de/b' },
      { art: 'text', text: ' und das ' },
      { art: 'link', text: 'Konzept', adresse: 'https://ecg-donrath.de/k' },
      { art: 'text', text: '.' },
    ]);
  });

  it('ohne Link: ein Stück Text, leer: nichts', () => {
    expect(hinweisTeile(TEXT)).toEqual([{ art: 'text', text: TEXT }]);
    expect(hinweisTeile('')).toEqual([]);
  });

  it('nur https wird ein Link – http, javascript: und Adressen ohne Rechnernamen bleiben Text', () => {
    for (const a of [
      'http://ecg-donrath.de',
      'javascript:alert(1)',
      'https://localhost',
      'https://x y.de',
    ])
      expect(hinweisTeile(`[hier](${a})`).every((t) => t.art === 'text')).toBe(true);
    expect(adresseGueltig(' https://ecg-donrath.de/anmeldung?x=1 ')).toBe(true);
    expect(adresseGueltig('https://ecg-donrath.de)')).toBe(false);
  });

  it('Link setzen über die Markierung; der Linktext verliert ] und Zeilenumbrüche', () => {
    const von = TEXT.indexOf('Anmeldebedingungen');
    expect(
      linkSetzen(TEXT, von, von + 18, 'Anmeldebedingungen', ' https://ac-zeltlager.de/b '),
    ).toBe('Bitte lies die [Anmeldebedingungen](https://ac-zeltlager.de/b) und das Schutzkonzept.');
    expect(linkSetzen('x', 0, 1, 'a]b\nc', 'https://a.de')).toBe('[a b c](https://a.de)');
  });

  it('ungültige Adresse oder leerer Text: kein Link (null)', () => {
    expect(linkSetzen(TEXT, 0, 5, 'Bitte', 'http://a.de')).toBeNull();
    expect(linkSetzen(TEXT, 0, 5, '  ', 'https://a.de')).toBeNull();
  });

  it('ändern ersetzt den vorhandenen Link, entfernen lässt den Text stehen', () => {
    const t = 'Siehe [hier](https://a.de) bitte.';
    const [l] = hinweisLinks(t);
    expect(l).toEqual({ von: 6, bis: 26, text: 'hier', adresse: 'https://a.de' });
    expect(linkSetzen(t, l.von, l.bis, 'dort', 'https://b.de')).toBe(
      'Siehe [dort](https://b.de) bitte.',
    );
    expect(linkEntfernen(t, l)).toBe('Siehe hier bitte.');
  });
});
