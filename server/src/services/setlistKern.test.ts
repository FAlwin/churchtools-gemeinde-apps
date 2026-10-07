import { describe, it, expect, vi } from 'vitest';
import { liedBlatt, termineMitAblauf, type CtLeser } from '@shared/ct/setlistKern';
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

/**
 * Versionsnamen bei Bindestrich im Liedtitel (07.10.2026, Durchklick 3b-2): „Testlied 3b-2 — Akustik"
 * ist die Version „Akustik", nicht „2 — Akustik". Der Schlüssel bis dahin kommt als `alterKey` mit –
 * daran hängt der Umzug von Tonart und Anmerkungen im Liedblatt.
 */
describe('liedBlatt – Versionen mit Bindestrich im Liedtitel', () => {
  it('richtiger Name, richtiger Schlüssel – und der alte als alterKey', async () => {
    const l = leser(() => Promise.reject(new Error('nicht gebraucht')));
    l.song = () =>
      Promise.resolve({
        id: 24,
        name: 'Testlied 3b-2',
        author: null,
        ccli: null,
        arrangements: [
          {
            id: 30,
            name: 'Standard',
            isDefault: true,
            key: 'E',
            keyOfArrangement: 'E',
            bpm: null,
            beat: null,
            files: [
              { name: 'Testlied 3b-2.chordpro', fileUrl: 'https://ct.test/?id=1' },
              { name: 'Testlied 3b-2 — Akustik (App).chordpro', fileUrl: 'https://ct.test/?id=2' },
            ],
          },
        ],
      });
    l.dateiText = () => Promise.resolve('[E]Text');
    const blatt = await liedBlatt(l, 24, 30);
    expect(blatt.versions.map((v) => [v.name, v.key, v.alterKey])).toEqual([
      ['Akustik', 'akustik', '2-akustik'],
    ]);
  });

  it('ohne Bindestrich im Titel gibt es keinen alterKey', async () => {
    const l = leser(() => Promise.reject(new Error('nicht gebraucht')));
    l.song = () =>
      Promise.resolve({
        id: 7,
        name: 'Treu',
        author: null,
        ccli: null,
        arrangements: [
          {
            id: 70,
            name: 'Standard',
            isDefault: true,
            key: 'C',
            keyOfArrangement: 'C',
            bpm: null,
            beat: null,
            files: [{ name: 'Treu — Akustik (App).chordpro', fileUrl: 'https://ct.test/?id=2' }],
          },
        ],
      });
    l.dateiText = () => Promise.resolve('[C]Text');
    const blatt = await liedBlatt(l, 7, 70);
    expect(blatt.versions[0]).not.toHaveProperty('alterKey');
  });
});
