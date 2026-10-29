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
  namenX,
  PERSON_ZEILE,
  personenX,
  schriftPt,
  ZEILE,
  EINRUECKEN,
  type ListenZeile,
} from './blatt';
import type { KastenInhalt } from './kastenPersonen';

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
    const namen = seiten.flat().map((z) => (z.art === 'gruppe' ? z.knoten.name : z.text));
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

describe('Liste mit Personen (O7b-6b)', () => {
  /** In mm: jedes Zeichen 1,5 mm breit (fett 1,6) – reicht, um Umbruch und Lage zu prüfen. */
  const mass = (t: string, fett: boolean) => t.length * (fett ? 1.6 : 1.5);
  const TEAM: KastenInhalt = {
    art: 'rollen',
    gruppen: [
      { rolle: 'Leiter', namen: ['Alwin Friesen'], nurZahl: false },
      { rolle: 'Mitarbeiter', namen: ['Bea Berg', 'Carl Clau'], nurZahl: true },
    ],
  };
  const text = (z: ListenZeile) =>
    z.art === 'gruppe' ? z.knoten.name : `${z.rolle ?? ''}|${z.text}`;

  it('unter jeder Gruppe ihre Rollen – die Rolle nur in der ersten Zeile, die Standardrolle als Zahl', () => {
    const s = alles([g(1, 'Gottesdienst', [g(2, 'Technik')])]);
    const seiten = listenSeiten(s, papier('a4-hoch'), {
      inhalt: (id) =>
        id === 2 ? TEAM : id === 1 ? { art: 'hinweis', text: 'Mitglieder nicht sichtbar' } : null,
      mass,
    });
    expect(seiten).toHaveLength(1);
    expect(seiten[0].map(text)).toEqual([
      'Beispielgemeinde',
      'Gottesdienst',
      '|Mitglieder nicht sichtbar',
      'Technik',
      'LEITER|Alwin Friesen',
      'MITARBEITER|2 Mitarbeiter',
    ]);
    const hinweis = seiten[0][2];
    expect(hinweis).toMatchObject({ art: 'person', kursiv: true, linien: 2 });
    // Unter Technik (ohne Untergruppen) läuft nur die Linie der Ebenen darüber weiter.
    expect(seiten[0][4]).toMatchObject({ art: 'person', tiefe: 2, linien: 2 });
  });

  it('viele Namen brechen nach Kommas um – die Folgezeilen ohne Rolle, an derselben Stelle', () => {
    const namen = Array.from({ length: 30 }, (_, i) => `Person Nummer ${i + 1}`);
    const s = alles([g(1, 'Gottesdienst')]);
    const [seite] = listenSeiten(s, papier('a4-hoch'), {
      inhalt: () => ({ art: 'rollen', gruppen: [{ rolle: 'Teilnehmer', namen, nurZahl: false }] }),
      mass,
    });
    const leute = seite.filter((z) => z.art === 'person');
    expect(leute.length).toBeGreaterThan(3);
    expect(leute.map((z) => z.rolle)).toEqual(['TEILNEHMER', ...leute.slice(1).map(() => null)]);
    expect(new Set(leute.map((z) => z.ab)).size).toBe(1);
    expect(
      leute
        .map((z) => z.text)
        .join(' ')
        .split(', '),
    ).toHaveLength(30);
    const f = flaeche(papier('a4-hoch'));
    for (const z of leute)
      expect(personenX(f, 1) + z.ab + mass(z.text, false)).toBeLessThanOrEqual(f.x + f.breite);
  });

  it('Personen stehen unter dem Namen, aber vor den Untergruppen', () => {
    const f = flaeche(papier('a4-hoch'));
    for (const t of [0, 1, 3]) {
      expect(personenX(f, t)).toBeGreaterThan(namenX(f, t));
      expect(personenX(f, t)).toBeLessThan(namenX(f, t + 1));
      // Rechts von der Linie der eigenen Ebene (sie liegt 2 mm hinter dem Einzug).
      expect(personenX(f, t)).toBeGreaterThan(f.x + t * EINRUECKEN + 2);
    }
  });

  it('der Name einer Gruppe bleibt nie allein unten auf der Seite – er wandert mit seiner ersten Personen-Zeile', () => {
    const p = papier('a4-hoch');
    const hoehe = flaeche(p).hoehe;
    // Vorne leere Gruppen (je eine Zeile) und Gruppen mit einem Hinweis (Zeile + Personen-Zeile), so gewählt, dass für
    // „Team“ noch Platz bleibt, aber nicht für „Team“ samt erster Person.
    const lage = (() => {
      for (let mitHinweis = 0; mitHinweis < 6; mitHinweis++)
        for (let leer = 0; leer < 40; leer++) {
          const rest = hoehe - (2 + leer) * ZEILE - mitHinweis * (ZEILE + PERSON_ZEILE);
          if (rest >= ZEILE && rest < ZEILE + PERSON_ZEILE) return { leer, mitHinweis };
        }
      return null;
    })();
    expect(lage).not.toBeNull();
    const { leer, mitHinweis } = lage!;
    const baum = [
      g(1, 'Bereich', [
        ...Array.from({ length: leer }, (_, i) => g(10 + i, `Leer ${i}`)),
        ...Array.from({ length: mitHinweis }, (_, i) => g(60 + i, `Verborgen ${i}`)),
        g(99, 'Team'),
      ]),
    ];
    const seiten = listenSeiten(alles(baum), p, {
      inhalt: (id) =>
        id === 99 ? TEAM : id >= 60 && id < 70 ? { art: 'hinweis', text: 'nicht sichtbar' } : null,
      mass,
    });
    expect(seiten[0].map(text)).not.toContain('Team');
    expect(seiten[1].map(text).slice(0, 2)).toEqual(['Team', 'LEITER|Alwin Friesen']);
  });

  it('ohne Personen genau wie bisher', () => {
    const s = alles(HOCH);
    const p = papier('a4-hoch');
    expect(listenSeiten(s, p, { inhalt: () => null, mass })).toEqual(listenSeiten(s, p));
  });
});
