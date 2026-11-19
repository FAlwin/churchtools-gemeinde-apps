// @vitest-environment jsdom
/// <reference lib="dom" />
/// <reference lib="dom.iterable" />
import { describe, it, expect } from 'vitest';
import { renderSeite } from './render';
import { BEISPIELE, seite, kontext, einstellungen } from './bauhilfen';
import { markdownZuHtml } from './markdown';
import { seiteAlsText, seiteAusText } from './modell';

const BOESE = `"><img src=x onerror=alert(1)>'<script>alert(2)</script>`;
function boesartig(x: unknown): unknown {
  if (typeof x === 'string') return x + BOESE;
  if (Array.isArray(x)) return x.map(boesartig);
  if (x && typeof x === 'object')
    return Object.fromEntries(
      Object.entries(x).map(([k, v]) => [
        k,
        k === 'typ' || k === 'art' || k === 'ebene' || k === 'bildSeite' || k === 'zeigen'
          ? v
          : boesartig(v),
      ]),
    );
  return x;
}
describe('Angriffe über Daten (unabhängige Gegenprüfung zu den Einzeltests)', () => {
  it('kein Tag/Attribut aus Daten in irgendeinem Baustein', () => {
    const bs = Object.values(BEISPIELE).map((f, i) => boesartig(f('b' + i)) as never);
    const html = renderSeite(
      seite({ titel: 'T' + BOESE, bausteine: bs }),
      kontext({ einstellungen: einstellungen({ name: 'G' + BOESE }) }),
    );
    const doc = new DOMParser().parseFromString(html, 'text/html');
    expect(doc.querySelectorAll('script').length).toBe(0);
    expect(doc.querySelectorAll('[onerror]').length).toBe(0);
    for (const a of doc.querySelectorAll('[href]'))
      expect(a.getAttribute('href')).not.toMatch(/^\s*javascript/i);
  });
  it('dynamische Daten', () => {
    const bs = Object.values(BEISPIELE).map((f, i) => f('b' + i));
    const html = renderSeite(
      seite({ bausteine: bs }),
      kontext({
        bildAdresse: () => 'x' + BOESE,
        beitraege: [
          boesartig({
            id: '1',
            titel: 't',
            text: 'x',
            datum: '2026-07-01T10:00:00Z',
            bild: { id: 'b' },
          }) as never,
        ],
        termine: [
          {
            ...(boesartig({ titel: 't', ort: 'o' }) as object),
            beginn: '2026-07-01T10:00:00Z',
            ende: '2026-07-01T11:00:00Z',
            ganztaegig: false,
            kalenderId: 2,
          } as never,
        ],
        sliderFolien: [
          {
            bild: { id: 'b' },
            alt: 'a' + BOESE,
            link: { art: 'extern', url: 'javascript:alert(1)' },
          } as never,
        ],
        livestream: {
          aktuell: {
            id: '1',
            titel: 'v' + BOESE,
            datum: '2026-07-01T10:00:00Z',
            adresse: 'javascript:alert(1)',
            vorschaubild: { id: 'b' },
          },
          archiv: [],
        },
        gruppen: [boesartig({ id: 1, name: 'g', beschreibung: 'b', gruppentypId: 1 }) as never],
      }),
    );
    expect(html).toContain('&lt;script&gt;');
    const doc = new DOMParser().parseFromString(html, 'text/html');
    expect(doc.querySelectorAll('script,iframe').length).toBe(0);
    expect(doc.querySelectorAll('[onerror]').length).toBe(0);
    for (const a of doc.querySelectorAll('[href]'))
      expect(a.getAttribute('href')).not.toMatch(/^\s*javascript/i);
  });
  it('markdown-Fallen', () => {
    for (const m of [
      '[x](javascript:alert(1))',
      '[x](JaVaScRiPt:alert(1))',
      '[x](//evil.com)',
      '[x](/\\evil.com)',
      '[x](data:text/html,hi)',
      '**<b>**',
      '[**x](https://a.de)**',
    ]) {
      const d = new DOMParser().parseFromString(markdownZuHtml(m), 'text/html');
      for (const a of d.querySelectorAll('a'))
        expect(a.getAttribute('href')).toMatch(/^(https:|\/[^/\\])/);
      expect(d.querySelectorAll('b,script').length).toBe(0);
    }
  });
  it('rundreise', () => {
    const s = seite({ bausteine: Object.values(BEISPIELE).map((f, i) => f('b' + i)) });
    const r = seiteAusText(seiteAlsText(s));
    expect(r.ok && r.wert).toEqual(s);
  });
});
