import { describe, expect, it } from 'vitest';
import { direktLinkAus, musikAppDirektLink } from './musikAppLink';

describe('Direktlink in die Musik-App (E6-O O4)', () => {
  it('hin und zurück gleich – aus der Adresse der Musik-App, ein alter Hash fällt weg', () => {
    const link = musikAppDirektLink('https://x.church.tools/ccm/musik-app/#/alt', 151, 7);
    expect(link).toBe('https://x.church.tools/ccm/musik-app/#/termin/151/punkt/7');
    expect(direktLinkAus(new URL(link).hash)).toEqual({ terminId: 151, punktId: 7 });
  });

  it('mit dem Tag des Termins – damit die Musik-App ihn auch außerhalb ihrer Wochen findet', () => {
    const link = musikAppDirektLink(
      'https://x.church.tools/ccm/musik-app/',
      142,
      196,
      '2026-10-18',
    );
    expect(link).toBe('https://x.church.tools/ccm/musik-app/#/termin/142/punkt/196?am=2026-10-18');
    expect(direktLinkAus(new URL(link).hash)).toEqual({
      terminId: 142,
      punktId: 196,
      am: '2026-10-18',
    });
  });

  it('nur der Termin (Knopf „Musik-App“ in der Termin-Ansicht, 30.10.2026): sein Ablauf, mit und ohne Tag', () => {
    const link = musikAppDirektLink(
      'https://x.church.tools/ccm/musik-app/#/alt',
      151,
      null,
      '2026-11-01',
    );
    expect(link).toBe('https://x.church.tools/ccm/musik-app/#/termin/151?am=2026-11-01');
    expect(direktLinkAus(new URL(link).hash)).toEqual({ terminId: 151, am: '2026-11-01' });
    expect(direktLinkAus('#/termin/151')).toEqual({ terminId: 151 });
  });

  it('alles andere ist kein Direktlink', () => {
    for (const h of [
      '',
      '#/termin/',
      '#/termin/151/',
      '#/termin/151/punkt/',
      '#/termin/x/punkt/7',
      '#/termin/151/punkt/7/mehr',
      '#/termin/151/punkt/7?am=18.10.2026',
      '#/termine',
    ])
      expect(direktLinkAus(h)).toBeNull();
  });
});
