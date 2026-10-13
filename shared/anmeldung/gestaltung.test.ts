import { describe, expect, it } from 'vitest';
import {
  VORLAGEN_GESTALTUNG,
  geaendertSeitVorlage,
  mitVorgaben,
  vorlageVon,
  vorlageWechseln,
} from './gestaltung';
import { neueEinstellungen } from './vorlagen';
import { einstellungenEntpacken, einstellungenPacken } from './formular';

describe('Gestaltung: Vorlagen sind Startpunkte (A5, Entwurf v3)', () => {
  it('neue Veranstaltungen bekommen alle Werte ihres Startpunkts (eine Stelle)', () => {
    const kinder = neueEinstellungen('kinder').gestaltung;
    expect(kinder).toMatchObject({ ...vorlageVon('bunt').werte, vorlage: 'bunt', logo: 'ct' });
    expect(neueEinstellungen('einfach').gestaltung.vorlage).toBe('klassisch');
    expect(neueEinstellungen('freizeit').gestaltung.vorlage).toBe('foto');
    expect(geaendertSeitVorlage(kinder)).toEqual([]);
  });

  it('Startpunkt wechseln: alle Werte der neuen Vorlage; Logo, Begrüßung, Breite bleiben', () => {
    const g = {
      ...neueEinstellungen('einfach').gestaltung,
      text: 'Hallo',
      breite: 'breit' as const,
      logo: 'keins' as const,
      seitenfarbe: '#000000',
    };
    const neu = vorlageWechseln(g, 'bunt');
    expect(neu).toMatchObject({ ...vorlageVon('bunt').werte, vorlage: 'bunt' });
    expect([neu.text, neu.breite, neu.logo]).toEqual(['Hallo', 'breit', 'keins']);
  });

  it('was seit dem Startpunkt geändert ist, wird gezählt', () => {
    const g = {
      ...neueEinstellungen('einfach').gestaltung,
      muster: 'sterne' as const,
      gross: true,
    };
    expect(geaendertSeitVorlage(g)).toEqual(['muster', 'gross']);
  });

  it('jede Vorlage füllt jeden Wert (keiner fehlt)', () => {
    const schluessel = Object.keys(vorlageVon('klassisch').werte).sort();
    for (const v of VORLAGEN_GESTALTUNG) expect(Object.keys(v.werte).sort()).toEqual(schluessel);
  });
});

describe('Ältere Einstellungen bleiben lesbar (A5)', () => {
  it('nur Vorlage, Farbe, Feldstil, Knöpfe, Text → der Rest aus der Vorlage; eigene Werte bleiben', () => {
    const e = neueEinstellungen('einfach');
    const alt = {
      ...e,
      gestaltung: {
        vorlage: 'bunt',
        farbe: '#123456',
        feldstil: 'linie',
        knoepfe: 'rund',
        text: 'Hallo',
        gemeindename: true, // aus einem Zwischenstand – wird weggelassen
        seitenfarbe: null, // „wie Vorlage“ aus einem Zwischenstand
      },
    };
    const g = einstellungenEntpacken(einstellungenPacken(alt as never))!.gestaltung;
    expect(g).toMatchObject({
      ...vorlageVon('bunt').werte,
      farbe: '#123456',
      feldstil: 'linie',
      knoepfe: 'rund',
      text: 'Hallo',
      logo: 'ct',
      logoOrt: 'oben',
      breite: 'normal',
    });
    expect(g).not.toHaveProperty('gemeindename');
  });

  it('nur Hex-Farben und nur https-Adressen fürs Logo (beides landet in Attributen)', () => {
    const e = neueEinstellungen('einfach');
    expect(() =>
      einstellungenPacken({ ...e, gestaltung: { ...e.gestaltung, seitenfarbe: 'red;x' } }),
    ).toThrow();
    expect(() =>
      einstellungenPacken({
        ...e,
        gestaltung: { ...e.gestaltung, logoUrl: 'javascript:alert(1)' },
      }),
    ).toThrow();
    expect(
      mitVorgaben({
        vorlage: 'gross',
        farbe: '#000000',
        feldstil: 'kasten',
        knoepfe: 'eckig',
        text: '',
      }).gross,
    ).toBe(true);
  });
});

describe('Platz (A5)', () => {
  it('gespeichert wird nur, was vom Startpunkt abweicht – der Code passt in EIN Sicherungsfeld', () => {
    for (const v of ['einfach', 'kinder', 'freizeit'] as const) {
      const e = neueEinstellungen(v);
      expect(einstellungenPacken(e).length).toBeLessThan(1000);
      expect(einstellungenEntpacken(einstellungenPacken(e))).toEqual(e);
    }
    const e = neueEinstellungen('kinder');
    const anders = { ...e, gestaltung: { ...e.gestaltung, muster: 'wellen' as const } };
    expect(einstellungenEntpacken(einstellungenPacken(anders))!.gestaltung.muster).toBe('wellen');
  });
});
