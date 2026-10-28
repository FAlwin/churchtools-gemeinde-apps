import { describe, expect, it } from 'vitest';
import { logoAdresse } from './logo';

const BASIS = 'https://test.church.tools';

describe('logoAdresse', () => {
  it('der Pfad aus /api/config wird zur Adresse der Instanz (gemessen 28.10.2026)', () => {
    expect(logoAdresse({ site_logo: 'images/558/0d5b' }, BASIS)).toBe(`${BASIS}/images/558/0d5b`);
    expect(logoAdresse({ site_logo: '/images/1/a' }, BASIS)).toBe(`${BASIS}/images/1/a`);
  });

  it('eine volle Adresse bleibt – ob sie zur Instanz gehört, prüft das Laden (`ctDatei`)', () => {
    expect(logoAdresse({ site_logo: 'https://cdn.example/logo.png' }, BASIS)).toBe(
      'https://cdn.example/logo.png',
    );
  });

  it('kein Logo eingestellt oder unerwartete Antwort → null', () => {
    expect(logoAdresse({ site_logo: '' }, BASIS)).toBeNull();
    expect(logoAdresse({ site_logo: null }, BASIS)).toBeNull();
    expect(logoAdresse({}, BASIS)).toBeNull();
    expect(logoAdresse(null, BASIS)).toBeNull();
  });
});
