// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { HOEHE, SCHALTER, type SichtKnoten } from '@shared/organigramm/ansichten';
import { KACHEL, KACHEL_LINKS, messung, NAME_NACH_KACHEL } from './messung';
import type { KastenInhalt } from './kastenPersonen';

/** In jsdom gibt es keine Zeichenfläche – `textBreite` schätzt; das reicht, um die Regeln zu prüfen. */
const SCHRIFT = { name: 'Lato', stand: 0 };
const k = (id: number | null, name: string, ebene = 2): SichtKnoten => ({
  schluessel: String(id),
  id,
  name,
  farbe: null,
  typId: 2,
  ebene,
  kinderZahl: 0,
  offen: false,
  kinder: [],
});
const ROLLEN: KastenInhalt = {
  art: 'rollen',
  gruppen: [
    { rolle: 'Leiter', namen: ['Alwin Friesen'], nurZahl: false },
    {
      rolle: 'Organisator',
      namen: ['Bea Berg', 'Carl Clau', 'Dora Dorn', 'Emil Ernst', 'Finn Fuchs'],
      nurZahl: false,
    },
    { rolle: 'Mitarbeiter', namen: ['Gina Graf', 'Hugo Ilg'], nurZahl: true },
  ],
};

describe('messung – Kästchen mit Personen (O7b-6)', () => {
  it('ohne Personen: nur der Name, so hoch wie immer', () => {
    const { kasten } = messung(SCHRIFT);
    expect(kasten(k(7, 'Technik'))).toMatchObject({ hoehe: HOEHE, zeilen: [] });
    const mitLeer = messung(SCHRIFT, () => null).kasten(k(7, 'Technik'));
    expect(mitLeer).toMatchObject({ hoehe: HOEHE, zeilen: [] });
  });

  it('Rollen als Überschrift (wie in ChurchTools benannt), darunter die Namen; die Standardrolle als Zahl', () => {
    const { kasten } = messung(SCHRIFT, () => ROLLEN);
    const z = kasten(k(7, 'Technik')).zeilen;
    expect(z.filter((x) => x.art === 'rolle').map((x) => x.text)).toEqual([
      'LEITER',
      'ORGANISATOR',
      'MITARBEITER',
    ]);
    expect(z.find((x) => x.art === 'zahl')?.text).toBe('2 Mitarbeiter');
    // Jede Person steht da, ganz in genau einer Zeile – umgebrochen wird nur nach Kommas.
    const personen = z.filter((x) => x.art === 'person').map((x) => x.text);
    for (const n of [
      'Alwin Friesen',
      'Bea Berg',
      'Carl Clau',
      'Dora Dorn',
      'Emil Ernst',
      'Finn Fuchs',
    ])
      expect(
        personen.filter((p) => p.includes(n)),
        n,
      ).toHaveLength(1);
    expect(personen.length).toBeGreaterThan(2);
  });

  it('breiter als nur mit dem Namen, aber begrenzt; jede Zeile passt hinein', () => {
    const { kasten } = messung(SCHRIFT, () => ROLLEN);
    const ka = kasten(k(7, 'Ton'));
    expect(ka.breite).toBeGreaterThanOrEqual(150);
    expect(ka.breite).toBeLessThanOrEqual(260);
    for (const z of ka.zeilen)
      expect(z.text.length * 7.6 * (12.5 / 14)).toBeLessThanOrEqual(ka.breite);
  });

  it('die Zeilen liegen untereinander unter dem Namen – und das runde +/− am unteren Rand verdeckt keine', () => {
    const { kasten } = messung(SCHRIFT, () => ROLLEN);
    const ka = kasten(k(7, 'Technik'));
    const ys = ka.zeilen.map((z) => z.y);
    expect(ys).toEqual([...ys].sort((a, b) => a - b));
    expect(ys[0]).toBeGreaterThan(HOEHE);
    // Die letzte Zeile ist 16 hoch; darunter mindestens der Halbmesser des Schalters frei.
    expect(ys[ys.length - 1] + 8 + SCHALTER).toBeLessThanOrEqual(ka.hoehe);
  });

  it('„Mitglieder nicht sichtbar“ als eine Zeile ohne Rolle', () => {
    const { kasten } = messung(SCHRIFT, () => ({
      art: 'hinweis',
      text: 'Mitglieder nicht sichtbar',
    }));
    expect(kasten(k(12, 'Stream')).zeilen).toEqual([
      expect.objectContaining({ art: 'hinweis', text: 'Mitglieder nicht sichtbar' }),
    ]);
  });

  it('die Gemeinde ist keine Gruppe – nie Personen darunter', () => {
    const { kasten } = messung(SCHRIFT, () => ROLLEN);
    expect(kasten(k(null, 'ECG', 0)).zeilen).toEqual([]);
  });
});

describe('messung – die Kachel vor dem Namen (O7b-8)', () => {
  it('eine Gruppe wird breiter, damit der Name ganz bleibt; die Gemeinde nicht', () => {
    const { breite, kuerzen } = messung(SCHRIFT);
    const gruppe = k(7, 'Technik');
    // Dieselbe Ebene (gleich fett) – nur ohne Gruppe.
    const gemeinde = k(null, 'Technik');
    expect(breite(gruppe) - breite(gemeinde)).toBe(NAME_NACH_KACHEL - 14);
    expect(kuerzen(gruppe, breite(gruppe))).toBe('Technik');
  });
  it('die Kachel beginnt hinter dem runden +/−, das in der Mindmap links auf dem Rand sitzt', () => {
    expect(KACHEL_LINKS).toBeGreaterThanOrEqual(SCHALTER);
  });
  it('bei „von oben“ ragt das +/− unten nicht in die Kachel (Kästchen ohne Personen)', () => {
    // Die Kachel ist mittig in der Zeile des Namens; das +/− sitzt unten auf dem Rand.
    expect((HOEHE + KACHEL) / 2).toBeLessThanOrEqual(HOEHE - SCHALTER);
  });
});
