import { describe, it, expect, vi } from 'vitest';
import { termineMitAblauf, type CtLeser } from '@shared/ct/setlistKern';
import type { CtEvent } from '@shared/ct/typen';

/**
 * Der geteilte Ablauf-Aufbau (#335) – hier der Teil, den die Server-Tests über `setlistBuilder` nicht
 * abdecken: Was passiert, wenn ChurchTools mitten in der Terminliste bremst (#300)?
 */
const UEBERLASTET = Object.assign(new Error('429'), { status: 503 });

function events(n: number): CtEvent[] {
  return Array.from({ length: n }, (_, i) => ({
    id: i + 1,
    name: `Termin ${i + 1}`,
    startDate: `2026-10-${String(i + 1).padStart(2, '0')}T08:00:00Z`,
    endDate: `2026-10-${String(i + 1).padStart(2, '0')}T10:00:00Z`,
  }));
}

function leser(agenda: CtLeser['agenda'], anzahl = 20): CtLeser {
  return {
    events: () => Promise.resolve(events(anzahl)),
    agenda,
    song: () => Promise.reject(new Error('nicht gebraucht')),
    alleLieder: () => Promise.resolve([]),
    untertitel: () => Promise.resolve(null),
    dateiText: () => Promise.resolve(''),
    fehler: (status, meldung) => Object.assign(new Error(meldung), { status }),
    istUeberlastet: (e) => e === UEBERLASTET,
    zeitzone: 'Europe/Berlin',
  };
}

describe('termineMitAblauf – Drosselung (#300/#335)', () => {
  it('bremst ChurchTools, wirft der ganze Lauf – keine lückenhafte Liste', async () => {
    const agenda = vi.fn((id: number) =>
      id === 3 ? Promise.reject(UEBERLASTET) : Promise.resolve({ items: [] }),
    );
    await expect(termineMitAblauf(leser(agenda), 'a', 'b')).rejects.toBe(UEBERLASTET);
  });

  it('nach der ersten Drosselung startet keine weitere Anfrage', async () => {
    const agenda = vi.fn(() => Promise.reject(UEBERLASTET));
    await expect(termineMitAblauf(leser(agenda, 20), 'a', 'b')).rejects.toBe(UEBERLASTET);
    // Acht laufen gleichzeitig los (mapLimit 8) – danach keine mehr.
    expect(agenda.mock.calls.length).toBeLessThanOrEqual(8);
  });

  it('ein fehlender Ablaufplan (404) bleibt ein stilles Überspringen', async () => {
    const agenda = vi.fn((id: number) =>
      id === 2
        ? Promise.reject(Object.assign(new Error('404'), { status: 404 }))
        : Promise.resolve({ items: [] }),
    );
    const rows = await termineMitAblauf(leser(agenda, 3), 'a', 'b');
    expect(rows.map((r) => r.service.id)).toEqual([1, 3]);
  });
});
