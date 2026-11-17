import { describe, expect, it } from 'vitest';
import {
  modusFuerDienst,
  modusWort,
  vorgabeFuerAlle,
  vorgabeSetzen,
  vorgabeText,
} from './modusVorgabe';

describe('Vorgabe Anfrage | direkt je Dienst (P2m)', () => {
  it('ohne Eintrag beginnt ein neuer Entwurf als Anfrage; die Dienste in der Liste beginnen direkt', () => {
    expect(modusFuerDienst([], 6)).toBe('anfrage');
    expect(modusFuerDienst([7], 6)).toBe('anfrage');
    expect(modusFuerDienst([7, 6], 6)).toBe('direkt');
  });

  it('vorgabeSetzen: direkt nimmt den Dienst auf (ohne Doppelte), Anfrage nimmt ihn heraus, andere bleiben', () => {
    expect(vorgabeSetzen([7], 6, 'direkt')).toEqual([7, 6]);
    expect(vorgabeSetzen([7, 6], 6, 'direkt')).toEqual([7, 6]);
    expect(vorgabeSetzen([7, 6], 6, 'anfrage')).toEqual([7]);
    expect(vorgabeSetzen([], 6, 'anfrage')).toEqual([]);
  });

  it('vorgabeFuerAlle: alle genannten Dienste direkt oder alle als Anfrage – fremde Einträge bleiben', () => {
    expect(vorgabeFuerAlle([99], [6, 7, 7], 'direkt')).toEqual([99, 6, 7]);
    expect(vorgabeFuerAlle([6, 99], [6, 7], 'anfrage')).toEqual([99]);
    expect(vorgabeFuerAlle([6], [6, 7], 'direkt').sort()).toEqual([6, 7]);
  });

  it('die Wörter: überall „direkt“ und „Anfrage“ – der Tooltip des Symbols sagt es mit dem Dienst', () => {
    expect(modusWort('direkt')).toBe('direkt');
    expect(modusWort('anfrage')).toBe('Anfrage');
    expect(vorgabeText('Ton', 'anfrage')).toBe('Neue Einteilungen für Ton: Anfrage – ändern');
    expect(vorgabeText('Predigt', 'direkt')).toBe('Neue Einteilungen für Predigt: direkt – ändern');
  });
});
