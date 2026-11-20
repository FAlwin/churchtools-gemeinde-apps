import { describe, expect, it } from 'vitest';
import { BAUSTEIN_TYPEN } from '@shared/website/modell';
import { VORLAGEN } from '@shared/website/vorlagen';
import {
  ankerMeldung,
  lebenszeichenAlter,
  pfadEingabe,
  sichtbareVorlagen,
  waehlbareTypen,
  zielAusWert,
  zielWert,
} from './regeln';

describe('Rechte: „Eigenes HTML“ nur für die Leitung', () => {
  it('Vorlagen: ohne Recht fehlt genau „html“, mit Recht sind alle da', () => {
    expect(sichtbareVorlagen({ html: true, menue: true })).toHaveLength(VORLAGEN.length);
    const ohne = sichtbareVorlagen({ html: false, menue: true }).map((v) => v.name);
    expect(ohne).not.toContain('html');
    expect(ohne).toHaveLength(VORLAGEN.length - 1);
  });

  it('Bausteintypen: ohne Recht fehlt genau „html“', () => {
    expect(waehlbareTypen({ html: true, menue: true })).toEqual(BAUSTEIN_TYPEN);
    const ohne = waehlbareTypen({ html: false, menue: true });
    expect(ohne).not.toContain('html');
    expect(ohne).toHaveLength(BAUSTEIN_TYPEN.length - 1);
  });
});

describe('Sprungmarke und Adresse', () => {
  it('ankerMeldung: gut, leer, ungültig, reserviert, doppelt', () => {
    expect(ankerMeldung('', [])).toBe('');
    expect(ankerMeldung('gottesdienst', ['anderer'])).toBe('');
    expect(ankerMeldung('Gottesdienst', [])).toMatch(/Kleinbuchstaben/);
    expect(ankerMeldung('a--b', [])).toMatch(/Kleinbuchstaben/);
    expect(ankerMeldung('x'.repeat(61), [])).toMatch(/Kleinbuchstaben/);
    expect(ankerMeldung('inhalt', [])).toMatch(/belegt/);
    expect(ankerMeldung('w-menue', [])).toMatch(/belegt/);
    expect(ankerMeldung('termine', ['termine'])).toMatch(/schon ein anderer/);
  });

  it('pfadEingabe: Kleinbuchstaben, Fremdes wird zum Bindestrich', () => {
    expect(pfadEingabe('Unsere Gruppen')).toBe('unsere-gruppen');
    expect(pfadEingabe('a/b?c')).toBe('a-b-c');
  });

  it('zielWert: Seite, Sprung, andere Adresse', () => {
    expect(zielWert({ art: 'seite', seiteId: 'x' })).toBe('seite:x');
    expect(zielWert({ art: 'anker', anker: 'oben' })).toBe('anker:oben');
    expect(zielWert({ art: 'extern', url: 'https://a.de' })).toBe('extern');
  });
});

describe('lebenszeichenAlter: „vor 3 Minuten“ für die Rückfrage beim Übernehmen', () => {
  const jetzt = new Date('2026-11-20T10:00:00Z');
  const vor = (s: number) => new Date(jetzt.getTime() - s * 1000).toISOString();
  it('Minuten, eine Minute, weniger als eine', () => {
    expect(lebenszeichenAlter(vor(5), jetzt)).toBe('vor weniger als einer Minute');
    expect(lebenszeichenAlter(vor(60), jetzt)).toBe('vor einer Minute');
    expect(lebenszeichenAlter(vor(3 * 60 + 20), jetzt)).toBe('vor 3 Minuten');
  });
  it('kaputte Zeit: kein „NaN“', () => {
    expect(lebenszeichenAlter('kaputt', jetzt)).toBe('vor weniger als einer Minute');
  });
});

describe('zielAusWert', () => {
  it('Seite und Sprungmarke aus dem Wert; „extern“ behält eine schon getippte Adresse', () => {
    expect(zielAusWert('seite:abc', null, '')).toEqual({ art: 'seite', seiteId: 'abc' });
    expect(zielAusWert('anker:a:b', null, '')).toEqual({ art: 'anker', anker: 'a:b' });
    const alt = { art: 'extern' as const, url: 'https://x.example' };
    expect(zielAusWert('extern', alt, '')).toBe(alt);
    expect(zielAusWert('extern', { art: 'seite', seiteId: 's' }, 'https://neu.example')).toEqual({
      art: 'extern',
      url: 'https://neu.example',
    });
    expect(zielAusWert('extern', null, '')).toEqual({ art: 'extern', url: '' });
  });

  it('ist die Umkehrung von zielWert', () => {
    for (const z of [
      { art: 'seite' as const, seiteId: 's1' },
      { art: 'anker' as const, anker: 'termine' },
    ])
      expect(zielAusWert(zielWert(z), null, '')).toEqual(z);
  });
});
