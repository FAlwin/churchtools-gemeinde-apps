import { vi } from 'vitest';
import { STANDARD } from '@shared/dienstplan/vorlieben';
import type { Entwurf } from '@shared/dienstplan/entwuerfe';
import type { SendeErgebnis } from '@shared/dienstplan/senden';
import type { EntwuerfeDaten, EntwurfAnschluss, Schublade } from './ladeEntwuerfe';

/**
 * **Der Entwurfs-Anschluss für Tests** – eine Stelle für „Planen“ und die Termin-Ansicht (F1, 09.11.2026; vorher nur in
 * `Planen.test.tsx`). Jede neue Funktion des Anschlusses kommt nur hier dazu.
 */
export const TECHNIK = { id: 3, name: 'Technik', fuerAlle: false };
export const ALWIN = { personId: 1, name: 'Alwin' };

/** Ein Entwurf – Vorgabe: Ben Test an Licht (Dienst 7), Platz 2 von Termin 20, als Anfrage von Alwin. */
export const entwurf = (x: Partial<Entwurf> = {}): Entwurf => ({
  ort: { eventId: 20, serviceId: 7, index: 2 },
  ziel: { art: 'person', personId: 46, name: 'Ben Test' },
  modus: 'anfrage',
  gesehen: { art: 'frei' },
  von: ALWIN,
  zeit: '2026-10-14T20:00:00.000Z',
  version: 1,
  ...x,
});

/** Geladene Entwürfe – mit der Schublade von Technik (Gruppe 3). */
export const daten = (
  entwuerfe: Entwurf[] = [],
  schublade: Partial<Schublade> = {},
): EntwuerfeDaten => ({
  modul: 16,
  schubladen: new Map([[3, { gruppe: TECHNIK, kategorie: 30, stand: 'bereit', ...schublade }]]),
  entwuerfe: new Map(
    entwuerfe.map((e) => [`${e.ort.eventId}|${e.ort.serviceId}|${e.ort.index ?? '-'}`, e]),
  ),
  gruppeJe: new Map(
    entwuerfe.map((e) => [`${e.ort.eventId}|${e.ort.serviceId}|${e.ort.index ?? '-'}`, 3]),
  ),
});

/** Der Anschluss zum Anfassen – `a` überschreibt einzelne Funktionen. */
export const nachgebaut = (a: Partial<EntwurfAnschluss> = {}): EntwurfAnschluss => ({
  ich: ALWIN,
  laden: vi.fn(() => Promise.resolve(daten())),
  speichern: vi.fn(),
  entfernen: vi.fn(),
  einrichten: vi.fn(() => Promise.resolve()),
  senden: vi.fn(),
  hinweise: vi.fn(() => Promise.resolve(new Map())),
  anzahl: vi.fn(),
  termine: vi.fn(() => Promise.resolve(new Map())),
  vorlieben: {
    lesen: vi.fn(() => Promise.resolve({ ok: true as const, vorliebe: STANDARD })),
    speichern: vi.fn(() => Promise.resolve({ ok: true as const })),
  },
  ...a,
});

/** Senden, das alles schafft – und dabei jeden Eintrag meldet wie der Kern. */
export const gesendet = () =>
  vi.fn(
    (
      _d: EntwuerfeDaten,
      eintraege: readonly unknown[],
      melde: (i: number, r: SendeErgebnis) => void,
    ) => {
      const r = eintraege.map((_, i): SendeErgebnis => {
        melde(i, { art: 'gesendet' });
        return { art: 'gesendet' };
      });
      return Promise.resolve(r);
    },
  );
