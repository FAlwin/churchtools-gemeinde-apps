import { describe, expect, it } from 'vitest';
import type { Entwurf } from '@shared/dienstplan/entwuerfe';
import type { SendeErgebnis } from '@shared/dienstplan/senden';
import { aktionText, bisherHinweis, ergebnisText, wegHinweis, wiederholbar } from './sendenTexte';

const e = (x: Partial<Entwurf> = {}): Entwurf => ({
  ort: { eventId: 7, serviceId: 6, index: null },
  ziel: { art: 'person', personId: 46, name: 'Anna Test' },
  modus: 'anfrage',
  gesehen: { art: 'frei' },
  von: { personId: 1, name: 'Alwin' },
  zeit: '2026-10-15T08:00:00.000Z',
  version: 1,
  ...x,
});
const gast = e({ ziel: { art: 'gast', name: 'Max' } });

describe('aktionText', () => {
  it('Anfrage, direkt, Gast', () => {
    expect(aktionText(e())).toBe('Anfrage an Anna Test');
    expect(aktionText(e({ modus: 'direkt' }))).toBe('Direkt zuteilen: Anna Test');
    expect(aktionText(gast)).toBe('Gast eintragen: Max');
    expect(aktionText(e({ ziel: { art: 'frei' } }))).toBe('Zurückziehen');
  });
});

describe('E4-5: belegter Platz – zurückziehen und ersetzen', () => {
  const anna = { art: 'anfrage', personId: 46 } as const;
  it('„Zurückziehen: Ben“, „… statt Anna“ – „statt“ nur, wo jemand stand', () => {
    expect(aktionText(e({ ziel: { art: 'frei' }, gesehen: anna }), 'Ben Test')).toBe(
      'Zurückziehen: Ben Test',
    );
    expect(aktionText(e({ gesehen: anna }), 'Anna X')).toBe('Anfrage an Anna Test statt Anna X');
    expect(aktionText(e({ gesehen: anna, modus: 'direkt' }), 'Anna X')).toBe(
      'Direkt zuteilen: Anna Test statt Anna X',
    );
    expect(aktionText({ ...gast, gesehen: anna }, 'Anna X')).toBe(
      'Gast eintragen: Max statt Anna X',
    );
    // Am freien Platz kein „statt“, auch wenn ein Name mitkommt.
    expect(aktionText(e(), 'Anna X')).toBe('Anfrage an Anna Test');
    expect(ergebnisText({ art: 'gesendet' }, e({ ziel: { art: 'frei' } }))).toBe('zurückgezogen');
  });

  it('was die bisherige Person mitbekommt (gemessen 15.10.): zurückziehen nichts, ersetzen „ausgetragen“', () => {
    expect(bisherHinweis({ art: 'frei' }, anna, 'Ben')).toEqual({
      text: 'ChurchTools sagt Ben nicht Bescheid – sag es am besten selbst.',
      warnung: true,
    });
    expect(bisherHinweis(e().ziel, { art: 'zusage', personId: 46 }, 'Ben')).toEqual({
      text: 'Ben bekommt von ChurchTools „Du wurdest … ausgetragen“.',
      warnung: false,
    });
    // Ein Gast bekommt nie etwas; am freien Platz und ohne Namen gibt es niemanden zu warnen.
    expect(bisherHinweis({ art: 'frei' }, { art: 'gast', name: 'Max' }, 'Max')).toBeNull();
    expect(bisherHinweis(e().ziel, { art: 'frei' }, 'Ben')).toBeNull();
    expect(bisherHinweis({ art: 'frei' }, anna, null)).toBeNull();
    expect(wegHinweis('zurueckziehen', anna, 'Ben')).toEqual(
      bisherHinweis({ art: 'frei' }, anna, 'Ben'),
    );
  });
});

describe('wiederholbar („Erneut senden“)', () => {
  it('nur nicht versucht, vorübergehend, nicht angekommen, abgemeldet', () => {
    const ja: SendeErgebnis[] = [
      { art: 'nicht-versucht' },
      { art: 'nicht-gesendet', grund: 'voruebergehend' },
      { art: 'nicht-gesendet', grund: 'nicht-angekommen' },
      { art: 'nicht-gesendet', grund: 'abgemeldet' },
    ];
    const nein: (SendeErgebnis | undefined)[] = [
      undefined,
      { art: 'gesendet' },
      { art: 'gesendet', entwurfBlieb: 'voruebergehend' },
      { art: 'nicht-gesendet', grund: 'konflikt' },
      { art: 'nicht-gesendet', grund: 'entwurf-geaendert' },
      { art: 'nicht-gesendet', grund: 'weg' },
      { art: 'nicht-gesendet', grund: 'kein-recht' },
    ];
    expect(ja.map(wiederholbar)).toEqual(ja.map(() => true));
    expect(nein.map(wiederholbar)).toEqual(nein.map(() => false));
  });
});

describe('ergebnisText', () => {
  it('gesendet je nach Art; „Entwurf blieb“ sagt, wo man ihn los wird', () => {
    expect(ergebnisText({ art: 'gesendet' }, e())).toBe('angefragt');
    expect(ergebnisText({ art: 'gesendet' }, e({ modus: 'direkt' }))).toBe('direkt zugeteilt');
    expect(ergebnisText({ art: 'gesendet' }, gast)).toBe('als Gast eingetragen');
    expect(ergebnisText({ art: 'gesendet', entwurfBlieb: 'voruebergehend' }, e())).toMatch(
      /^angefragt – der Entwurf blieb stehen/,
    );
  });

  it('jeder Grund hat seinen eigenen Text; „bleibt“ nur, wo der Entwurf wirklich bleibt', () => {
    const gruende = [
      'konflikt',
      'entwurf-geaendert',
      'weg',
      'kein-recht',
      'abgemeldet',
      'voruebergehend',
      'nicht-angekommen',
    ] as const;
    const texte = gruende.map((grund) => ergebnisText({ art: 'nicht-gesendet', grund }, e()));
    expect(new Set(texte).size).toBe(gruende.length);
    expect(texte[0]).toMatch(/veraltet/);
    expect(texte[4]).toMatch(/neu laden/);
    expect(ergebnisText({ art: 'nicht-versucht' }, e())).toMatch(/bleibt/);
  });
});
