import { describe, it, expect, vi } from 'vitest';
import {
  ABLAUF_ABGESCHLOSSEN,
  ABLAUF_VERWEIGERT,
  ablaufAbschliessen,
  punktLoeschen,
  type CtSchreiber,
} from '@shared/ct/schreibKern';
import { termineMitAblauf } from '@shared/ct/setlistKern';

/**
 * **Abgeschlossener Ablauf** (Alwin, 09.10.2026). ChurchTools verweigert in einem abgeschlossenen Ablauf
 * jedes Ändern mit 403 – dieselbe Antwort wie bei einem fehlenden Recht (gemessen an der Test-Instanz).
 * Die App meldete deshalb „Keine Berechtigung", und niemand kam auf den Abschluss.
 */
function schreiber(opts: {
  abgeschlossen?: boolean;
  agendaFehler?: boolean;
  verweigert?: boolean;
}) {
  const schreibe = vi.fn((_pfad: string, _auftrag: unknown) =>
    opts.verweigert ? Promise.reject(new Error(ABLAUF_VERWEIGERT)) : Promise.resolve(null),
  );
  const s: CtSchreiber = {
    agenda: () =>
      opts.agendaFehler
        ? Promise.reject(new Error('Netz weg'))
        : Promise.resolve({ items: [], isLocked: opts.abgeschlossen }),
    song: () => Promise.reject(new Error('nicht gebraucht')),
    schreibe,
    fehler: (status, meldung) => Object.assign(new Error(meldung), { status }),
  };
  return { s, schreibe };
}

describe('Schreiben im abgeschlossenen Ablauf', () => {
  it('verweigert + abgeschlossen → die richtige Meldung (423), nicht „Keine Berechtigung"', async () => {
    const { s } = schreiber({ verweigert: true, abgeschlossen: true });
    await expect(punktLoeschen(s, 1, 5)).rejects.toMatchObject({
      status: 423,
      message: ABLAUF_ABGESCHLOSSEN,
    });
  });

  it('verweigert + offen → es bleibt beim fehlenden Recht', async () => {
    const { s } = schreiber({ verweigert: true, abgeschlossen: false });
    await expect(punktLoeschen(s, 1, 5)).rejects.toThrow(ABLAUF_VERWEIGERT);
  });

  it('lässt sich der Ablauf gerade nicht lesen, bleibt der ursprüngliche Fehler – geraten wird nicht', async () => {
    const { s } = schreiber({ verweigert: true, agendaFehler: true });
    await expect(punktLoeschen(s, 1, 5)).rejects.toThrow(ABLAUF_VERWEIGERT);
  });
});

describe('ablaufAbschliessen', () => {
  it('abschließen = POST …/agenda/lock, öffnen = …/unlock (gemessen 09.10.2026)', async () => {
    const { s, schreibe } = schreiber({});
    await ablaufAbschliessen(s, 7, true);
    await ablaufAbschliessen(s, 7, false);
    expect(schreibe.mock.calls.map((c) => [c[0], c[1]])).toEqual([
      ['/events/7/agenda/lock', expect.objectContaining({ method: 'POST', json: {} })],
      ['/events/7/agenda/unlock', expect.objectContaining({ method: 'POST', json: {} })],
    ]);
  });
});

describe('Terminliste', () => {
  it('trägt den Abschluss am Termin (ablaufAbgeschlossen) – aus dem Ablauf, der ohnehin gelesen wird', async () => {
    const ev = (id: number) => ({
      id,
      name: 'Gottesdienst',
      startDate: '2026-10-11T08:00:00Z',
      endDate: '2026-10-11T09:30:00Z',
    });
    const services = await termineMitAblauf(
      {
        events: () => Promise.resolve([ev(1), ev(2)]),
        agenda: (id: number) => Promise.resolve({ items: [], isLocked: id === 1 }),
        untertitel: () => Promise.resolve(null),
        zeitzone: 'Europe/Berlin',
        istUeberlastet: () => false,
        fehler: (st: number, m: string) => new Error(`${st} ${m}`),
      } as never,
      '2026-10-01',
      '2026-10-31',
    );
    expect(services.map((r) => [r.service.id, r.service.ablaufAbgeschlossen])).toEqual([
      [1, true],
      [2, false],
    ]);
  });
});
