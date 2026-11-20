import { describe, expect, it } from 'vitest';
import { BAUSTEIN_TYPEN } from '@shared/website/modell';
import { VORLAGEN } from '@shared/website/vorlagen';
import { ankerMeldung, pfadEingabe, sichtbareVorlagen, waehlbareTypen, zielWert } from './regeln';

describe('Rechte: „Eigenes HTML“ nur für die Leitung', () => {
  it('Vorlagen: ohne Recht fehlt genau „html“, mit Recht sind alle da', () => {
    expect(sichtbareVorlagen({ html: true })).toHaveLength(VORLAGEN.length);
    const ohne = sichtbareVorlagen({ html: false }).map((v) => v.name);
    expect(ohne).not.toContain('html');
    expect(ohne).toHaveLength(VORLAGEN.length - 1);
  });

  it('Bausteintypen: ohne Recht fehlt genau „html“', () => {
    expect(waehlbareTypen({ html: true })).toEqual(BAUSTEIN_TYPEN);
    const ohne = waehlbareTypen({ html: false });
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
