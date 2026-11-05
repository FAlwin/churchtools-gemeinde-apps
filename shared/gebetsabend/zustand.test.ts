import { describe, expect, it } from 'vitest';
import { meldungAus, naechsterZustand, type PlayerZustand } from './zustand';

/** Die Meldungen der Reihe nach durchspielen – Startzustand „verbindet“. */
function ablauf(daten: unknown[]): PlayerZustand[] {
  let z: PlayerZustand = 'verbindet';
  const zustaende: PlayerZustand[] = [];
  for (const d of daten) {
    const m = meldungAus(d);
    if (m) z = naechsterZustand(z, m);
    zustaende.push(z);
  }
  return zustaende;
}

describe('Player-Zustand aus den VDO.Ninja-Meldungen', () => {
  it('gemessener Ablauf (S0b, 14:28–14:31): warten → Sender da → Ton → Sender weg → wartet still neu', () => {
    expect(
      ablauf([
        { action: 'requested-stream', value: 'gebetabc' },
        { action: 'hss-connection', value: 'connected' },
        { action: 'new-view-connection', value: true, UUID: 'u1' },
        { action: 'new-stream-added', value: true, UUID: 'u1' },
        { action: 'new-video-track-added', value: true, UUID: 'u1' },
        { action: 'new-audio-track-added', value: true, UUID: 'u1' },
        { loudness: { gebetabc: 27 }, action: 'loudness', value: 27 },
        { action: 'view-connection', value: false, UUID: 'u1' },
        { action: 'end-view-connection', value: 'gebetabc' },
        { action: 'requested-stream', value: 'gebetabc' },
      ]),
    ).toEqual([
      'wartet',
      'wartet',
      'wartet',
      'laeuft',
      'laeuft',
      'ton',
      'ton',
      'unterbrochen',
      'unterbrochen',
      'unterbrochen',
    ]);
  });

  it('nach der Unterbrechung kommt der Sender zurück → läuft wieder', () => {
    expect(
      ablauf([
        { action: 'end-view-connection', value: 'x' },
        { action: 'new-stream-added', value: true },
        { action: 'new-audio-track-added', value: true },
      ]).at(-1),
    ).toBe('ton');
  });

  it('Ton vor Bild (Mikro zuerst gewählt): ein spätes Bild nimmt „Ton kommt an“ nicht zurück', () => {
    expect(
      ablauf([
        { action: 'new-audio-track-added', value: true },
        { action: 'new-video-track-added', value: true },
      ]).at(-1),
    ).toBe('ton');
  });

  it('fremde Nachrichten und Statistik ohne `action` ändern nichts', () => {
    expect(meldungAus('hallo')).toBeNull();
    // Die Verbindung (UUID) kommt mit – der Sender braucht sie für „Wer hört zu?“ (G4).
    expect(meldungAus({ action: 'push-connection', value: true, UUID: 'u1' })).toEqual({
      action: 'push-connection',
      value: true,
      uuid: 'u1',
    });
    expect(meldungAus({ action: 'x', value: 1, UUID: 7 })).toEqual({ action: 'x', value: 1 });
    expect(meldungAus(null)).toBeNull();
    expect(meldungAus({ stats: { inbound: {} } })).toBeNull();
    expect(ablauf([{ stats: {} }, 'x', { action: 'aspect-ratio', value: '1.33' }])).toEqual([
      'verbindet',
      'verbindet',
      'verbindet',
    ]);
  });
});
