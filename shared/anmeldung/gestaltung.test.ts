import { describe, expect, it } from 'vitest';
import { VORLAGEN_GESTALTUNG, vorlageWechseln } from './gestaltung';
import { neueEinstellungen } from './vorlagen';
import { GESTALTUNG_FEIN, einstellungenEntpacken, einstellungenPacken } from './formular';

describe('Gestaltung (A5)', () => {
  it('neue Veranstaltungen bekommen die Vorgaben ihrer Formular-Vorlage (eine Stelle)', () => {
    const kinder = neueEinstellungen('kinder').gestaltung;
    const bunt = VORLAGEN_GESTALTUNG.find((v) => v.id === 'bunt')!;
    expect(kinder).toMatchObject({
      vorlage: 'bunt',
      farbe: bunt.farbe,
      feldstil: bunt.feldstil,
      knoepfe: bunt.knoepfe,
    });
    expect(neueEinstellungen('einfach').gestaltung.vorlage).toBe('klassisch');
    expect(neueEinstellungen('freizeit').gestaltung.vorlage).toBe('foto');
  });

  it('Vorlage wechseln: Vorgaben der neuen – außer, was das Team selbst gewählt hat', () => {
    const g = neueEinstellungen('einfach').gestaltung; // klassisch, Vorgaben
    const nachBunt = vorlageWechseln(g, 'bunt');
    expect(nachBunt).toMatchObject({
      vorlage: 'bunt',
      farbe: '#0369a1',
      feldstil: 'gefuellt',
      knoepfe: 'rund',
    });
    const eigen = vorlageWechseln({ ...g, farbe: '#6d4bc4', knoepfe: 'rund' }, 'gross');
    expect(eigen).toMatchObject({
      vorlage: 'gross',
      farbe: '#6d4bc4',
      feldstil: 'kasten',
      knoepfe: 'rund',
    });
    expect(eigen.text).toBe(g.text);
  });
});

describe('Feinheiten der Gestaltung (A5)', () => {
  it('ältere Einstellungen ohne die neuen Angaben bleiben lesbar und bekommen die Standardwerte', () => {
    const e = neueEinstellungen('einfach');
    const alt = {
      ...e,
      gestaltung: {
        vorlage: e.gestaltung.vorlage,
        farbe: e.gestaltung.farbe,
        feldstil: e.gestaltung.feldstil,
        knoepfe: e.gestaltung.knoepfe,
        text: '',
      },
    };
    const gelesen = einstellungenEntpacken(einstellungenPacken(alt as never));
    expect(gelesen?.gestaltung).toMatchObject(GESTALTUNG_FEIN);
  });

  it('nur Hex-Farben (sie landen in einem style-Attribut)', () => {
    const e = neueEinstellungen('einfach');
    e.gestaltung.seitenfarbe = 'red; background:url(x)';
    expect(() => einstellungenPacken(e)).toThrow();
  });

  it('Vorlage wechseln: eigene Farben für Seite, Formular und Schrift fallen weg', () => {
    const g = {
      ...neueEinstellungen('einfach').gestaltung,
      seitenfarbe: '#000000',
      kartenfarbe: '#111111',
      schriftfarbe: '#ffffff',
      schrift: 'rund' as const,
    };
    const neu = vorlageWechseln(g, 'bunt');
    expect([neu.seitenfarbe, neu.kartenfarbe, neu.schriftfarbe]).toEqual([null, null, null]);
    expect(neu.schrift).toBe('rund');
  });
});
