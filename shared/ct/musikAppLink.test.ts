import { describe, expect, it } from 'vitest';
import { direktLinkAus, musikAppDirektLink } from './musikAppLink';

describe('Direktlink in die Musik-App (E6-O O4)', () => {
  it('hin und zurück gleich – aus der Adresse der Musik-App, ein alter Hash fällt weg', () => {
    const link = musikAppDirektLink('https://x.church.tools/ccm/musik-app/#/alt', 151, 7);
    expect(link).toBe('https://x.church.tools/ccm/musik-app/#/termin/151/punkt/7');
    expect(direktLinkAus(new URL(link).hash)).toEqual({ terminId: 151, punktId: 7 });
  });

  it('alles andere ist kein Direktlink', () => {
    for (const h of [
      '',
      '#/termin/151',
      '#/termin/x/punkt/7',
      '#/termin/151/punkt/7/mehr',
      '#/termine',
    ])
      expect(direktLinkAus(h)).toBeNull();
  });
});
