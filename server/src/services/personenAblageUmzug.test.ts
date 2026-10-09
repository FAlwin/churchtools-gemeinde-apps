import { describe, it, expect, beforeEach } from 'vitest';
import { erstellePersonenAblage, type Altbestand } from '@shared/ct/personenAblage';
import { GESEHEN_MAX_ALTER_MS } from '@shared/types/index';
import { AblageFake, BILD, BILD2 } from '../testHilfen/ablageFake.js';

/**
 * **Umzug der alten Server-Ablage nach ChurchTools** (09.10.2026) – die Regel im gemeinsamen Kern.
 * Alwin: „ChurchTools behalten" – was dort schon liegt (aus der Erweiterung), gewinnt; das Volume füllt
 * nur Lücken. Und: Bilder einzeln, Felder in EINEM Schreibvorgang (#300).
 */
const ICH = 7;
const SEITE_A = 'song1_a1_voriginal_0';
const SEITE_B = 'song2_a2_voriginal_0';

let fake: AblageFake;
const leer = (): Altbestand => ({ anmerkungen: {}, einstellungen: {}, gesehen: {}, teilen: null });

beforeEach(() => {
  fake = new AblageFake();
});

describe('uebernimmAltbestand', () => {
  it('überträgt Bilder, Texte, Zoom, Einstellungen, gesehen und Teilen – Felder in EINEM Schreibvorgang', async () => {
    const ablage = erstellePersonenAblage();
    const alt: Altbestand = {
      anmerkungen: {
        [SEITE_A]: {
          strokes: BILD,
          texts: [{ id: 1, fx: 0, fy: 0, text: 'x', color: '#000', sizeCqh: 2 }],
        },
        [SEITE_B]: { zoom: { x: 1, y: 2, scale: 2 } },
      },
      einstellungen: { worship_key_1_original: 'D' },
      gesehen: { 55: { hash: 'h', seenAt: Date.now() } },
      teilen: { an: true, name: 'Alwin' },
    };
    const bericht = await ablage.uebernimmAltbestand(fake.port(ICH), alt);
    expect(bericht).toEqual({ bilder: 1, felder: 5 });
    expect(fake.hochgeladen.filter((n) => n === 'musikapp_daten.json')).toHaveLength(1);
    const d = fake.daten(ICH);
    expect(Object.keys(d).sort()).toEqual(
      [
        `anno:${SEITE_A}:texts`,
        `anno:${SEITE_B}:zoom`,
        'einst:worship_key_1_original',
        'gesehen:55',
        'teilen',
      ].sort(),
    );
    expect(await ablage.pruefeAltbestand(fake.port(ICH), alt)).toEqual({ bilder: 0, felder: 0 });
  });

  it('ChurchTools gewinnt je Seite – auch eine dort gelöschte Seite kommt nicht zurück', async () => {
    const ablage = erstellePersonenAblage();
    // In der Erweiterung: Seite A neu gezeichnet, Seite B gezeichnet und wieder geleert (Grabstein).
    await ablage.schreibeAnmerkung(fake.port(ICH), SEITE_A, { strokes: BILD2 });
    await ablage.schreibeAnmerkung(fake.port(ICH), SEITE_B, {
      texts: [{ id: 1, fx: 0, fy: 0, text: 'y', color: '#000', sizeCqh: 2 }],
    });
    await ablage.schreibeAnmerkung(fake.port(ICH), SEITE_B, { texts: [] });
    fake.hochgeladen = [];

    const alt: Altbestand = {
      ...leer(),
      anmerkungen: { [SEITE_A]: { strokes: BILD }, [SEITE_B]: { strokes: BILD } },
    };
    expect(await ablage.uebernimmAltbestand(fake.port(ICH), alt)).toEqual({ bilder: 0, felder: 0 });
    expect(fake.hochgeladen).toEqual([]);
    const seiten = await ablage.holeAnmerkungen(fake.port(ICH), [1, 2]);
    expect(seiten[SEITE_A].strokes).toBe(BILD2); // der Stand aus ChurchTools, nicht der vom Volume
    expect(seiten[SEITE_B]).toBeUndefined();
  });

  it('ChurchTools gewinnt je Einstellung – auch eine dort zurückgesetzte', async () => {
    const ablage = erstellePersonenAblage();
    await ablage.schreibeEinstellungen(fake.port(ICH), {
      worship_key_1_original: 'E',
      worship_capo_1_original: null,
    });
    const alt: Altbestand = {
      ...leer(),
      einstellungen: {
        worship_key_1_original: 'D',
        worship_capo_1_original: '2',
        worship_key_2_original: 'G',
      },
    };
    expect(await ablage.uebernimmAltbestand(fake.port(ICH), alt)).toEqual({ bilder: 0, felder: 1 });
    expect(await ablage.holeEinstellungen(fake.port(ICH), [1, 2])).toEqual({
      worship_key_1_original: 'E',
      worship_key_2_original: 'G',
    });
  });

  it('zu alte „gesehen"-Stände ziehen nicht um', async () => {
    const ablage = erstellePersonenAblage();
    const alt: Altbestand = {
      ...leer(),
      gesehen: { 1: { hash: 'alt', seenAt: Date.now() - GESEHEN_MAX_ALTER_MS - 1 } },
    };
    expect(await ablage.uebernimmAltbestand(fake.port(ICH), alt)).toEqual({ bilder: 0, felder: 0 });
  });

  it('ein zweiter Lauf macht da weiter, wo der erste aufhörte', async () => {
    const ablage = erstellePersonenAblage();
    const alt: Altbestand = {
      ...leer(),
      anmerkungen: { [SEITE_A]: { strokes: BILD }, [SEITE_B]: { strokes: BILD } },
    };
    // Erster Lauf bricht nach dem ersten Bild ab (Drosselung).
    let n = 0;
    await expect(
      ablage.uebernimmAltbestand(fake.port(ICH), alt, () => {
        if (++n === 1) return Promise.reject(new Error('bremst'));
        return Promise.resolve();
      }),
    ).rejects.toThrow('bremst');
    expect(await ablage.pruefeAltbestand(fake.port(ICH), alt)).toEqual({ bilder: 1, felder: 0 });
    expect(await ablage.uebernimmAltbestand(fake.port(ICH), alt)).toEqual({ bilder: 1, felder: 0 });
    expect(await ablage.pruefeAltbestand(fake.port(ICH), alt)).toEqual({ bilder: 0, felder: 0 });
  });
});

describe('teilenStandVon', () => {
  it('unterscheidet „sagt noch nichts" (null) von „ausgeschaltet" (false)', async () => {
    const ablage = erstellePersonenAblage();
    expect(await ablage.teilenStandVon(fake.port(ICH), ICH)).toBeNull();
    await ablage.schreibeTeilen(fake.port(ICH), false, 'Alwin');
    expect(await ablage.teilenStandVon(fake.port(ICH), ICH)).toBe(false);
  });
});
