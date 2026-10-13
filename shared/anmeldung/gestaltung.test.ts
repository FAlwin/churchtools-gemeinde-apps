import { describe, expect, it } from 'vitest';
import { VORLAGEN_GESTALTUNG, vorlageWechseln } from './gestaltung';
import { neueEinstellungen } from './vorlagen';

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
