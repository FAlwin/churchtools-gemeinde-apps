import { describe, expect, it } from 'vitest';
import { adresseInInstanz, sichererLink } from './sichereAdresse';

/** Die eine Prüfung für Adressen aus fremden Daten (#849). */
describe('sichererLink', () => {
  it('http(s) geht durch – wie geschrieben, nur ohne Leerraum außen', () => {
    expect(sichererLink('https://example.org')).toBe('https://example.org');
    expect(sichererLink('  http://example.org/a?b=1 ')).toBe('http://example.org/a?b=1');
    expect(sichererLink('HTTPS://EXAMPLE.ORG')).toBe('HTTPS://EXAMPLE.ORG');
  });

  it('javascript:, data:, vbscript: und Verkleidungen davon nie', () => {
    for (const a of [
      'javascript:alert(1)',
      'JavaScript:alert(1)',
      '  javascript:alert(1)',
      'java\tscript:alert(1)',
      'data:text/html,<script>alert(1)</script>',
      'vbscript:msgbox(1)',
    ])
      expect(sichererLink(a)).toBeNull();
  });

  it('mailto nur, wenn ausdrücklich erlaubt', () => {
    expect(sichererLink('mailto:a@b.de')).toBeNull();
    expect(sichererLink('mailto:a@b.de', { mailto: true })).toBe('mailto:a@b.de');
  });

  it('kein Text, leer oder keine Adresse → null', () => {
    for (const a of [null, undefined, 7, '', 'www.example.org', '/relativ'])
      expect(sichererLink(a)).toBeNull();
  });
});

describe('adresseInInstanz', () => {
  const BASIS = 'https://gemeinde.church.tools';

  it('nur Adressen der eigenen Instanz', () => {
    expect(adresseInInstanz(`${BASIS}/images/558/x`, BASIS)).toBe(`${BASIS}/images/558/x`);
    expect(adresseInInstanz('https://fremd.example/images/x', BASIS)).toBeNull();
  });

  it('kein Trick mit ähnlichem Host, anderem Protokoll oder Anmeldedaten', () => {
    expect(adresseInInstanz('https://gemeinde.church.tools.fremd.de/x', BASIS)).toBeNull();
    expect(adresseInInstanz('http://gemeinde.church.tools/x', BASIS)).toBeNull();
    expect(adresseInInstanz('https://gemeinde.church.tools@fremd.de/x', BASIS)).toBeNull();
    expect(adresseInInstanz('javascript:alert(1)', BASIS)).toBeNull();
  });
});
