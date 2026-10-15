import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { _bremseLoesen, _vergissCsrf } from '@ui/ct/verbindung';
import { ortSchluessel, type Entwurf } from '@shared/dienstplan/entwuerfe';
import { _vergissWerKann } from './ladeWerKann';
import { ladeSendeHinweise } from './sendeHinweise';

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

const person = (id: number) => ({
  title: `P${id}`,
  domainIdentifier: String(id),
  domainAttributes: { firstName: 'P', lastName: String(id) },
});
const kandidat = (id: number, o: { abwesend?: string; amTag?: string[] } = {}) => ({
  person: person(id),
  score: 0,
  scoreHints: [],
  monthlyUtilization: {},
  absences: o.abwesend ? [{ absenceReason: { nameTranslated: o.abwesend } }] : [],
  servicesOnSameDay: (o.amTag ?? []).map((serviceName) => ({ eventService: { serviceName } })),
});

const entwurf = (eventId: number, ziel: Entwurf['ziel']): Entwurf => ({
  ort: { eventId, serviceId: 6, index: null },
  ziel,
  modus: 'anfrage',
  gesehen: { art: 'frei' },
  von: { personId: 1, name: 'Alwin' },
  zeit: '2026-10-15T08:00:00.000Z',
  version: 1,
});
const zeile = (eventId: number, personId: number) => ({
  entwurf: entwurf(eventId, { art: 'person', personId, name: `P${personId}` }),
  tag: '2026-10-25',
});
const k = (eventId: number) => ortSchluessel({ eventId, serviceId: 6, index: null });

beforeEach(() => {
  _vergissCsrf();
  _bremseLoesen();
  _vergissWerKann();
  vi.stubGlobal('window', {
    settings: { base_url: 'https://ct.test/' },
    location: { origin: 'https://ct.test' },
  });
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('ladeSendeHinweise', () => {
  it('abwesend / am Tag schon → Text wie im „Wer kann?“-Fach; sonst kein Hinweis; Gäste nicht abgefragt', async () => {
    const spy = vi.spyOn(globalThis, 'fetch').mockImplementation((input) => {
      const ev = Number(/events\/(\d+)\//.exec(String(input))![1]);
      const daten: Record<number, unknown[]> = {
        20: [kandidat(46, { abwesend: 'Urlaub' })],
        21: [kandidat(47, { amTag: ['Licht'] })],
        22: [kandidat(48)],
      };
      return Promise.resolve(json(200, { data: daten[ev] }));
    });
    const h = await ladeSendeHinweise([
      zeile(20, 46),
      zeile(21, 47),
      zeile(22, 48),
      { entwurf: entwurf(23, { art: 'gast', name: 'Max' }), tag: '2026-10-25' },
    ]);
    expect(h.get(k(20))).toEqual({ text: 'abwesend: Urlaub' });
    expect(h.get(k(21))).toEqual({ text: 'am Tag schon: Licht' });
    expect(h.get(k(22))).toBeNull();
    expect(h.has(k(23))).toBe(false);
    expect(spy).toHaveBeenCalledTimes(3);
  });

  it('Abfrage scheitert → „ungeprüft“ für genau diese Zeile, die anderen gehen', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation((input) =>
      Promise.resolve(
        String(input).includes('/events/20/')
          ? json(502, { message: 'weg' })
          : json(200, { data: [kandidat(47, { abwesend: 'Krank' })] }),
      ),
    );
    const h = await ladeSendeHinweise([zeile(20, 46), zeile(21, 47)]);
    expect(h.get(k(20))).toEqual({ ungeprueft: true });
    expect(h.get(k(21))).toEqual({ text: 'abwesend: Krank' });
  });

  it('höchstens 4 Abfragen gleichzeitig', async () => {
    let laufen = 0;
    let hoechstens = 0;
    vi.spyOn(globalThis, 'fetch').mockImplementation(async () => {
      laufen++;
      hoechstens = Math.max(hoechstens, laufen);
      await new Promise((r) => setTimeout(r, 5));
      laufen--;
      return json(200, { data: [] });
    });
    await ladeSendeHinweise([20, 21, 22, 23, 24, 25, 26].map((ev) => zeile(ev, 46)));
    expect(hoechstens).toBe(4);
  });
});
