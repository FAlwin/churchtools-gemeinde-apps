import { describe, expect, it } from 'vitest';
import type { SpeicherGrund } from '../ct/versionierterWert';
import { beendet, senderBleibt, speicherFehlerText, technikStand } from './technik';
import { neuerZugang } from './zugang';

// Mit erzeugten Zugängen, nicht mit abgeschriebenen Werten.
const laeuft = () => neuerZugang(true, '2026-11-12T18:30:00.000Z');

describe('technikStand', () => {
  it('ohne Zugang oder ohne „läuft seit“ → aus, auch wenn hier noch ein Sender gemerkt ist', () => {
    const z = laeuft();
    expect(technikStand(null, null)).toBe('aus');
    expect(technikStand(beendet(z), z)).toBe('aus');
  });

  it('läuft mit demselben Zugang, den dieses Gerät sendet → hier', () => {
    const z = laeuft();
    expect(technikStand(z, { ...z })).toBe('hier');
  });

  it('läuft, aber dieses Gerät sendet nicht (neu geladen, anderes Gerät) → woanders – nie von selbst „hier“', () => {
    expect(technikStand(laeuft(), null)).toBe('woanders');
  });

  it('läuft mit anderen Daten, als dieses Gerät sendet (anderswo neu gestartet) → woanders', () => {
    expect(technikStand(laeuft(), laeuft())).toBe('woanders');
  });
});

describe('senderBleibt', () => {
  it('dieselbe Übertragung → bleibt', () => {
    const z = laeuft();
    expect(senderBleibt(z, { ...z })).toBe(true);
  });

  it('beendet, gelöscht, neue StreamID, neues Passwort oder Bild ↔ Ton → hört auf', () => {
    const z = laeuft();
    expect(senderBleibt(z, beendet(z))).toBe(false);
    expect(senderBleibt(z, null)).toBe(false);
    expect(senderBleibt(z, { ...z, streamId: laeuft().streamId })).toBe(false);
    expect(senderBleibt(z, { ...z, passwort: laeuft().passwort })).toBe(false);
    expect(senderBleibt(z, { ...z, mitBild: false })).toBe(false);
  });
});

describe('beendet', () => {
  it('nimmt nur „läuft seit“ weg – die Daten bleiben, der nächste Start erzeugt neue', () => {
    const z = laeuft();
    expect(beendet(z)).toEqual({ ...z, laeuftSeit: null });
  });
});

describe('speicherFehlerText', () => {
  it('hat für jeden Grund einen Satz; vorübergehend sagt, was NICHT passiert ist', () => {
    const gruende: SpeicherGrund[] = [
      'konflikt',
      'abgemeldet',
      'kein-recht',
      'voruebergehend',
      'nicht-angekommen',
      'zu-gross',
    ];
    for (const g of gruende) expect(speicherFehlerText(g, 'gestartet', 'Zugang')).toBeTruthy();
    expect(speicherFehlerText('voruebergehend', 'gestartet', 'Zugang')).toContain(
      'nicht gestartet',
    );
    expect(speicherFehlerText('kein-recht', 'gestartet', 'Gebetsabend: Zugang')).toContain(
      '„Gebetsabend: Zugang“',
    );
    expect(speicherFehlerText('konflikt', 'beendet', 'Zugang', 'Jakob')).toContain('Jakob');
  });
});
