import { describe, expect, it } from 'vitest';
import { nachNachfrage, PLAYER_GUT, PLAYER_TEXT, vorStart, zuhoererName } from './zuhoeren';
import { istVdoMeldung } from './zustand';
import { VDO_BASIS } from './links';
import { neuerZugang } from './zugang';

/** Geprüft wird gegen erzeugte Zugänge, nicht gegen abgeschriebene Werte. */
const gestartet = neuerZugang(true, '2026-11-12T18:32:00.000Z');

describe('vorStart', () => {
  it('ohne Zugang oder ohne „läuft seit“: keine Übertragung', () => {
    expect(vorStart(null)).toEqual({ art: 'aus' });
    expect(vorStart({ ...gestartet, laeuftSeit: null })).toEqual({ art: 'aus' });
  });

  it('mit „läuft seit“: läuft', () => {
    expect(vorStart(gestartet)).toEqual({ art: 'laeuft', seit: '2026-11-12T18:32:00.000Z' });
  });
});

describe('nachNachfrage – was mit einem offenen Player passiert', () => {
  it('gleiche Übertragung → weiter (der Player verbindet sich selbst neu)', () => {
    expect(nachNachfrage(gestartet, { ...gestartet })).toBe('weiter');
  });

  it('neu gestartet (neue Daten) → Player neu laden', () => {
    expect(nachNachfrage(gestartet, neuerZugang(true, '2026-11-12T18:50:00.000Z'))).toBe('neu');
  });

  it('auf „Nur Ton“ umgestellt → neu laden, sonst bliebe der Player beim Bild', () => {
    expect(nachNachfrage(gestartet, { ...gestartet, mitBild: false })).toBe('neu');
  });

  it('beendet oder kein Zugang mehr → beendet', () => {
    expect(nachNachfrage(gestartet, { ...gestartet, laeuftSeit: null })).toBe('beendet');
    expect(nachNachfrage(gestartet, null)).toBe('beendet');
  });
});

describe('Texte', () => {
  it('jeder Player-Zustand hat Text und Farbe; nur „läuft“ und „Ton“ sind grün', () => {
    for (const z of ['verbindet', 'wartet', 'laeuft', 'ton', 'unterbrochen'] as const) {
      expect(PLAYER_TEXT[z]).toBeTruthy();
    }
    expect(
      Object.entries(PLAYER_GUT)
        .filter(([, gut]) => gut)
        .map(([z]) => z),
    ).toEqual(['laeuft', 'ton']);
  });

  it('Name für „Wer hört zu?“: Vor- und Nachname, ohne Nachnamen nur der Vorname', () => {
    expect(zuhoererName(' Helene ', ' Wiebe ')).toBe('Helene Wiebe');
    expect(zuhoererName('Helene', undefined)).toBe('Helene');
    expect(zuhoererName('', '')).toBe('');
  });
});

describe('istVdoMeldung – nur Nachrichten aus dem eigenen Player', () => {
  const herkunft = new URL(VDO_BASIS).origin;
  const player = { name: 'unser iframe' };

  it('eigenes iframe und Herkunft vdo.ninja → ja', () => {
    expect(herkunft).toBe('https://vdo.ninja');
    expect(istVdoMeldung({ origin: herkunft, source: player }, player, herkunft)).toBe(true);
  });

  it('fremde Herkunft, fremdes Fenster oder kein Player → nein', () => {
    expect(
      istVdoMeldung({ origin: 'https://boese.example', source: player }, player, herkunft),
    ).toBe(false);
    expect(istVdoMeldung({ origin: herkunft, source: { anderes: 1 } }, player, herkunft)).toBe(
      false,
    );
    expect(istVdoMeldung({ origin: herkunft, source: null }, null, herkunft)).toBe(false);
  });
});
