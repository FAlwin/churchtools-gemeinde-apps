import { describe, expect, it } from 'vitest';
import {
  anfangsOffen,
  anordnen,
  sichtbarerBaum,
  type SichtKnoten,
} from '@shared/organigramm/ansichten';
import type { Knoten } from '@shared/organigramm/gruppen';
import {
  einpassen,
  flaeche,
  GROESSTE_PT,
  listenSeiten,
  massstab,
  PAPIERE,
  papierFuer,
  pdfDateiname,
  schriftPt,
  ZEILE,
} from './blatt';

const g = (id: number, name: string, kinder: Knoten[] = []): Knoten => ({
  gruppe: { id, name, typId: 2, statusId: 1, farbe: null },
  kinder,
});
const breite = (k: SichtKnoten) => 60 + k.name.length * 7;
const papier = (id: string) => PAPIERE.find((p) => p.id === id)!;

/** Viele Bereiche nebeneinander – „von oben“ wird breit. */
const BREIT: Knoten[] = Array.from({ length: 8 }, (_, i) =>
  g(i + 1, `Bereich ${i + 1}`, [g(100 + i, 'Team')]),
);
/** Ein Bereich mit langer Liste darunter – „von oben“ wird hoch. */
const HOCH: Knoten[] = [
  g(
    1,
    'Gottesdienst',
    Array.from({ length: 30 }, (_, i) => g(10 + i, `Gruppe ${i + 1}`)),
  ),
];
const alles = (baum: Knoten[]) =>
  sichtbarerBaum(baum, 'Beispielgemeinde', null, anfangsOffen(baum), true);

describe('Papier „passend“', () => {
  it('ein breites Diagramm quer, ein hohes hoch – jeweils das A4, auf dem es größer wird', () => {
    const breit = anordnen('oben', alles(BREIT), breite).rahmen;
    const hoch = anordnen('oben', alles(HOCH), breite).rahmen;
    expect(papierFuer('passend', breit).id).toBe('a4-quer');
    expect(papierFuer('passend', hoch).id).toBe('a4-hoch');
    expect(massstab(hoch, papier('a4-hoch'))).toBeGreaterThan(massstab(hoch, papier('a4-quer')));
  });

  it('eine Liste steht hoch; eine feste Wahl gilt, wie sie ist', () => {
    expect(papierFuer('passend', null).id).toBe('a4-hoch');
    const r = anordnen('oben', alles(BREIT), breite).rahmen;
    expect(papierFuer('a3-hoch', r).id).toBe('a3-hoch');
  });
});

describe('Diagramm auf dem Blatt', () => {
  it('ein kleines Diagramm wird nicht aufgeblasen: höchstens 11 pt', () => {
    const klein = anordnen('oben', alles([g(1, 'Café')]), breite).rahmen;
    const s = massstab(klein, papier('a3-quer'));
    expect(schriftPt(s)).toBeCloseTo(GROESSTE_PT, 6);
  });

  it('es steht mittig zwischen Kopf und Fuß und ragt nirgends hinaus', () => {
    for (const p of PAPIERE) {
      const r = anordnen('mindmap', alles(BREIT), breite).rahmen;
      const { x, y, massstab: s } = einpassen(r, p);
      const f = flaeche(p);
      const links = x + r.x * s;
      const oben = y + r.y * s;
      const rechts = links + r.breite * s;
      const unten = oben + r.hoehe * s;
      expect(links).toBeGreaterThanOrEqual(f.x);
      expect(rechts).toBeLessThanOrEqual(f.x + f.breite + 1e-9);
      expect(oben).toBeGreaterThanOrEqual(f.y);
      expect(unten).toBeLessThanOrEqual(f.y + f.hoehe + 1e-9);
      expect((links + rechts) / 2).toBeCloseTo(f.x + f.breite / 2, 6);
      expect((oben + unten) / 2).toBeCloseTo(f.y + f.hoehe / 2, 6);
    }
  });
});

describe('Liste auf Seiten', () => {
  it('in Leserichtung, so viele Zeilen je Seite wie zwischen Kopf und Fuß passen – nichts fehlt, nichts doppelt', () => {
    const s = alles(HOCH);
    const p = papier('a4-hoch');
    const seiten = listenSeiten(s, p);
    const proSeite = Math.floor(flaeche(p).hoehe / ZEILE);
    expect(seiten.length).toBe(Math.ceil(31 / proSeite));
    expect(seiten.slice(0, -1).every((z) => z.length === proSeite)).toBe(true);
    const namen = seiten.flat().map((z) => z.knoten.name);
    expect(namen).toEqual([
      'Beispielgemeinde',
      'Gottesdienst',
      ...HOCH[0].kinder.map((k) => k.gruppe.name),
    ]);
    expect(
      seiten
        .flat()
        .map((z) => z.tiefe)
        .slice(0, 3),
    ).toEqual([0, 1, 2]);
  });

  it('quer passen weniger Zeilen auf eine Seite als hoch', () => {
    const s = alles(HOCH);
    expect(listenSeiten(s, papier('a4-quer')).length).toBeGreaterThan(
      listenSeiten(s, papier('a4-hoch')).length,
    );
  });
});

describe('pdfDateiname', () => {
  it('nur Buchstaben, Ziffern und Striche, mit Datum', () => {
    expect(pdfDateiname('Gottesdienst | Gottesdienste', new Date(2026, 9, 28))).toBe(
      'Organigramm-Gottesdienst-Gottesdienste-2026-10-28.pdf',
    );
    expect(pdfDateiname('Evangeliumschristen- Gemeinde e.V.', new Date(2026, 0, 5))).toBe(
      'Organigramm-Evangeliumschristen-Gemeinde-e-V-2026-01-05.pdf',
    );
    expect(pdfDateiname('Café & Bistro', new Date(2026, 9, 28))).toBe(
      'Organigramm-Café-Bistro-2026-10-28.pdf',
    );
    expect(pdfDateiname(' / ', new Date(2026, 9, 28))).toBe('Organigramm-Gemeinde-2026-10-28.pdf');
  });
});
