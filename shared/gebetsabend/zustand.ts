/**
 * **Was der Player eines Zuhörers gerade tut** (Bauplan Gebetsabend G1) – aus den Meldungen, die VDO.Ninja per
 * `postMessage` an die Seite schickt. Damit sagt die Seite selbst „Noch keine Übertragung“, „Läuft“ oder
 * „Unterbrochen“, statt einen schwarzen Kasten zu zeigen.
 *
 * Gemessen (Messung S0b und G0, 05.11.2026) – die Meldungen kommen als `{ action, value, UUID?, streamID? }`:
 *  - `requested-stream`: Player wartet auf den Sender (auch wieder nach einer Unterbrechung).
 *  - `new-stream-added` / `new-video-track-added`: Sender ist da. `new-audio-track-added`: Ton kommt an.
 *  - `view-connection: false` / `end-view-connection`: Sender weg – der Player wartet danach **von selbst** neu.
 *  - `loudness`: Pegel (gemessen 0–27), erst nach dem Befehl `{ getLoudness: true }`.
 */

export type PlayerZustand = 'verbindet' | 'wartet' | 'laeuft' | 'ton' | 'unterbrochen';

export interface Meldung {
  action: string;
  value: unknown;
}

/** Eine Meldung von VDO.Ninja – alles andere (fremde Nachrichten, Statistik ohne `action`) ist `null`. */
export function meldungAus(daten: unknown): Meldung | null {
  if (!daten || typeof daten !== 'object') return null;
  const d = daten as { action?: unknown; value?: unknown };
  return typeof d.action === 'string' ? { action: d.action, value: d.value } : null;
}

/**
 * Der nächste Zustand. Nach einer Unterbrechung meldet VDO.Ninja wieder `requested-stream` – das bleibt
 * „unterbrochen“, bis der Sender zurück ist (sonst sähe es aus wie „hat noch nicht angefangen“).
 */
export function naechsterZustand(z: PlayerZustand, m: Meldung): PlayerZustand {
  switch (m.action) {
    case 'requested-stream':
      return z === 'verbindet' ? 'wartet' : z;
    case 'new-stream-added':
    case 'new-video-track-added':
      return z === 'ton' ? 'ton' : 'laeuft';
    case 'new-audio-track-added':
      return 'ton';
    case 'view-connection':
      return m.value === false ? 'unterbrochen' : z;
    case 'end-view-connection':
      return 'unterbrochen';
    default:
      return z;
  }
}

/** Der Befehl, mit dem die Seite die Pegel-Meldungen einschaltet. */
export const PEGEL_AN = { getLoudness: true } as const;
