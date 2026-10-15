import { describe, expect, it } from 'vitest';
import type { Entwurf } from '@shared/dienstplan/entwuerfe';
import type { SendeErgebnis } from '@shared/dienstplan/senden';
import { aktionText, ergebnisText, wiederholbar } from './sendenTexte';

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
