import { describe, expect, it, vi } from 'vitest';
import { liveStandAus } from '@shared/ct/liveAgenda';
import type { CtAgendaItem } from '@shared/ct/typen';
import { ladeLiveLaeuft, type ladeLive } from './ladeLive';

/** „Läuft gerade“ – die Regel hinter dem roten Punkt (Termin und Startseite). Der Stand entsteht aus `liveStandAus`. */
const items: CtAgendaItem[] = [
  { id: 1, title: 'Begrüßung', type: 'text', duration: 300, startTimes: {} },
  { id: 2, title: 'Predigt', type: 'text', duration: 1800, startTimes: {} },
];
const mit = (pos: string | null) =>
  vi.fn<typeof ladeLive>(() =>
    Promise.resolve({
      ok: true,
      stand: liveStandAus({
        pos_id: pos,
        switchdate: pos === null ? null : '2026-11-29T09:00:00Z',
        addseconds: null,
        category_id: '2',
        currentTime: Date.now(),
      }),
    } as Awaited<ReturnType<typeof ladeLive>>),
  );

describe('ladeLiveLaeuft', () => {
  it('nicht gestartet: nein; im Ablauf: ja; über das letzte Stück hinaus: nein', async () => {
    expect(await ladeLiveLaeuft(7, 31, items, mit(null))).toBe(false);
    expect(await ladeLiveLaeuft(7, 31, items, mit('1'))).toBe(true);
    expect(await ladeLiveLaeuft(7, 31, items, mit('2'))).toBe(true);
    expect(await ladeLiveLaeuft(7, 31, items, mit('3'))).toBe(false);
  });

  it('Lesen nicht möglich (kein Recht, Fehler): nein', async () => {
    const lesen = vi.fn<typeof ladeLive>(() => Promise.resolve({ ok: false, grund: 'kein-recht' }));
    expect(await ladeLiveLaeuft(7, 31, items, lesen)).toBe(false);
  });
});
