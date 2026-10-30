import { describe, expect, it } from 'vitest';
import { farbWert, gruppenFarbe, sichtFarbe, TAILWIND_500, typFarbenAus } from './farbe';

const TYPEN = typFarbenAus([
  { id: 2, color: 'lime' },
  { id: 1, color: 'sky' },
  { id: 9, color: '' },
]);

describe('gruppenFarbe – eigene Farbe vor Typ', () => {
  it('eigene Farbe der Gruppe gewinnt (Stream: gray, Typ Dienstbereich: lime)', () => {
    expect(gruppenFarbe({ farbe: 'gray', typId: 2 }, TYPEN)).toBe(TAILWIND_500.gray);
  });

  it('ohne eigene Farbe → Farbe des Typs (neue Kleingruppe: sky)', () => {
    expect(gruppenFarbe({ farbe: null, typId: 1 }, TYPEN)).toBe(TAILWIND_500.sky);
  });

  it('unbekannter Farbname der Gruppe → Typfarbe statt kaputter Farbe', () => {
    expect(gruppenFarbe({ farbe: 'mauve', typId: 2 }, TYPEN)).toBe(TAILWIND_500.lime);
  });

  it('weder Gruppe noch Typ nennen eine Farbe → Schiefergrau', () => {
    expect(gruppenFarbe({ farbe: null, typId: 9 }, TYPEN)).toBe(TAILWIND_500.slate);
    expect(gruppenFarbe({ farbe: null, typId: null }, TYPEN)).toBe(TAILWIND_500.slate);
  });
});

describe('typFarbenAus / farbWert', () => {
  it('leerer Farbname → null; ID ohne Ganzzahl fällt weg', () => {
    const t = typFarbenAus([
      { id: 9, color: '' },
      { id: '3', color: 'red' },
    ]);
    expect(t.get(9)).toBeNull();
    expect(t.has(3)).toBe(false);
  });

  it('farbWert kennt nur Tailwind-Namen', () => {
    expect(farbWert('teal')).toBe('#00bba7');
    expect(farbWert('mauve')).toBeNull();
    expect(farbWert(null)).toBeNull();
  });
});

describe('sichtFarbe – die Kachel im Diagramm und in der Liste (O7b-8)', () => {
  const farbe = sichtFarbe(TYPEN);
  it('dieselbe Regel wie für Karten: eigene Farbe, sonst Typ, sonst Schiefergrau', () => {
    expect(farbe({ id: 7, farbe: 'pink', typId: 2 })).toBe(TAILWIND_500.pink);
    expect(farbe({ id: 7, farbe: null, typId: 2 })).toBe(
      gruppenFarbe({ farbe: null, typId: 2 }, TYPEN),
    );
    expect(farbe({ id: 7, farbe: null, typId: 9 })).toBe(TAILWIND_500.slate);
  });
  it('die Gemeinde ist keine Gruppe – keine Kachel', () => {
    expect(farbe({ id: null, farbe: null, typId: null })).toBeNull();
  });
});
