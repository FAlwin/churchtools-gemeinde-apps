// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { _bremseLoesen, _vergissCsrf } from '../ct/verbindung';
import { browserAlsVorlageZugriff } from './browserAblaufZugriff';

/**
 * **Der Browser-Zugriff für „Als Vorlage …“** (E10-V5) – mit dem echten Kern, ChurchTools nachgebaut. Geprüft wird, dass
 * Termin, Vorlage und `gesehen` in der richtigen Reihenfolge ankommen: `ersetzen` liest die Vorlage und den Ablauf **dieses**
 * Termins, ein abweichender Stempel ergibt 412 ohne Schreiben.
 */
function json(body: unknown): Response {
  return new Response(JSON.stringify({ data: body }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

let gelesen: string[];
let geschrieben: string[];
beforeEach(() => {
  _vergissCsrf();
  _bremseLoesen();
  gelesen = [];
  geschrieben = [];
  vi.spyOn(globalThis, 'fetch').mockImplementation((input, init) => {
    const p = new URL(String(input)).pathname;
    const m = init?.method ?? 'GET';
    if (p.endsWith('/csrftoken')) return Promise.resolve(json('tok'));
    if (m !== 'GET') {
      geschrieben.push(`${m} ${p}`);
      return Promise.resolve(json({ id: 50 }));
    }
    gelesen.push(p);
    if (p === '/api/events/9/agenda')
      return Promise.resolve(json({ items: [{ id: 1, type: 'normal', title: 'A' }] }));
    if (p === '/api/agendatemplates/5') {
      return Promise.resolve(
        json({
          id: 5,
          name: 'V',
          calendarId: 2,
          meta: { modifiedDate: 'neu' },
          items: [{ id: 7, type: 'normal', title: 'A' }],
        }),
      );
    }
    if (p === '/api/agendatemplates/50')
      return Promise.resolve(json({ id: 50, items: [{ id: 8 }] }));
    return Promise.resolve(json([]));
  });
});
afterEach(() => vi.restoreAllMocks());

describe('browserAlsVorlageZugriff', () => {
  it('speichern: liest den Ablauf des Termins und legt EINE Vorlage an', async () => {
    await expect(
      browserAlsVorlageZugriff(9).speichern({ name: 'Neu', kalenderId: 2 }),
    ).resolves.toBe(50);
    expect(gelesen).toContain('/api/events/9/agenda');
    expect(geschrieben).toEqual(['POST /api/agendatemplates']);
  });

  it('ersetzen mit passendem Stempel: ein PUT an die Vorlage', async () => {
    await browserAlsVorlageZugriff(9).ersetzen(5, 'neu');
    expect(geschrieben).toEqual(['PUT /api/agendatemplates/5']);
  });

  it('ersetzen mit abweichendem Stempel: 412, nichts geschrieben', async () => {
    await expect(browserAlsVorlageZugriff(9).ersetzen(5, 'alt')).rejects.toMatchObject({
      status: 412,
    });
    expect(geschrieben).toEqual([]);
  });

  it('stand liest Vorlagen und Kalender frisch', async () => {
    await browserAlsVorlageZugriff(9).stand();
    expect(gelesen).toEqual(expect.arrayContaining(['/api/agendatemplates', '/api/calendars']));
  });
});
