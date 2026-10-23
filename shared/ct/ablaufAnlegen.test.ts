import { describe, expect, it, vi } from 'vitest';
import type { AblaufAnlegenRegel } from '../types/index';
import {
  ABLAUF_SCHON_DA,
  ablaufAnlegen,
  brauchtAblauf,
  fensterOhneAblauf,
  kalenderAus,
  termineOhneAblauf,
  vorlagenAus,
} from './ablaufAnlegen';
import type { CtLeser } from './setlistKern';
import type { CtSchreiber, SchreibAuftrag } from './schreibKern';
import type { CtAgenda, CtEvent } from './typen';

/**
 * „Ablauf anlegen" (13.10.2026). Die Attrappen verhalten sich wie an der Test-Instanz gemessen:
 * Ohne Ablauf antwortet `GET …/agenda` mit 404; `PUT …/agenda` legt an.
 */
class Fehler extends Error {
  constructor(
    public status: number,
    m: string,
  ) {
    super(m);
  }
}

function ev(id: number, name: string, kalender: string, start = '2026-10-25T09:00:00Z'): CtEvent {
  return {
    id,
    name,
    startDate: start,
    endDate: start,
    calendar: { title: 'Gottesdienst', domainIdentifier: kalender },
  };
}

const REGEL: AblaufAnlegenRegel = { kalenderIds: [2], suchwort: 'Gottesdienst' };

describe('brauchtAblauf – welche Veranstaltungen ohne Ablauf erscheinen', () => {
  it('Kalender und Suchwort müssen passen (Gebetsabend im selben Kalender bleibt draußen)', () => {
    expect(brauchtAblauf(ev(1, 'Gottesdienst', '2'), REGEL)).toBe(true);
    expect(brauchtAblauf(ev(2, 'Gebetsabend', '2'), REGEL)).toBe(false);
    expect(brauchtAblauf(ev(3, 'Gottesdienst', '3'), REGEL)).toBe(false);
  });

  it('Suchwort ohne Rücksicht auf Groß-/Kleinschreibung, auch mitten im Namen', () => {
    expect(brauchtAblauf(ev(1, 'Jugendgottesdienst', '2'), REGEL)).toBe(true);
    expect(brauchtAblauf(ev(1, 'GOTTESDIENST mit Taufe', '2'), REGEL)).toBe(true);
  });

  it('leeres Suchwort = alle Termine der gewählten Kalender', () => {
    expect(brauchtAblauf(ev(2, 'Gebetsabend', '2'), { kalenderIds: [2], suchwort: ' ' })).toBe(
      true,
    );
  });

  it('ohne gewählte Kalender oder ohne Regel: aus', () => {
    expect(brauchtAblauf(ev(1, 'Gottesdienst', '2'), { kalenderIds: [], suchwort: '' })).toBe(
      false,
    );
    expect(brauchtAblauf(ev(1, 'Gottesdienst', '2'), undefined)).toBe(false);
  });

  it('ein Termin ohne lesbaren Kalender gehört nie dazu', () => {
    const ohne = { ...ev(1, 'Gottesdienst', '2'), calendar: undefined };
    expect(brauchtAblauf(ohne, REGEL)).toBe(false);
  });
});

function leser(events: CtEvent[], agenda: (id: number) => Promise<CtAgenda>): CtLeser {
  return {
    events: vi.fn(() => Promise.resolve(events)),
    agenda: vi.fn(agenda),
    song: vi.fn(),
    alleLieder: vi.fn(),
    untertitel: vi.fn(),
    dateiText: vi.fn(),
    fehler: (s, m) => new Fehler(s, m),
    istUeberlastet: (e) => e instanceof Fehler && e.status === 503,
    zeitzone: 'Europe/Berlin',
  };
}

const keinAblauf = () => Promise.reject(new Fehler(404, 'kein Ablauf'));

describe('termineOhneAblauf', () => {
  it('nur passende Veranstaltungen OHNE Ablauf, nach Beginn sortiert, mit Kalender', async () => {
    const l = leser(
      [
        ev(3, 'Gottesdienst', '2', '2026-11-01T09:00:00Z'),
        ev(1, 'Gottesdienst', '2', '2026-10-25T09:00:00Z'),
        ev(2, 'Gebetsabend', '2', '2026-10-28T17:00:00Z'),
        ev(4, 'Gottesdienst', '2', '2026-11-08T09:00:00Z'),
      ],
      (id) => (id === 4 ? Promise.resolve({ items: [] }) : keinAblauf()),
    );
    const liste = await termineOhneAblauf(l, '2026-10-13', '2026-11-24', REGEL);

    expect(liste.map((s) => s.id)).toEqual([1, 3]);
    expect(liste[0]).toMatchObject({ songCount: 0, kalenderId: 2, name: 'Gottesdienst' });
  });

  it('fragt nur die passenden nach ihrem Ablauf – nicht jeden Termin', async () => {
    const l = leser([ev(1, 'Gottesdienst', '2'), ev(2, 'Gebetsabend', '2')], keinAblauf);
    await termineOhneAblauf(l, 'a', 'b', REGEL);
    expect(l.agenda).toHaveBeenCalledTimes(1);
    expect(l.agenda).toHaveBeenCalledWith(1);
  });

  it('ohne Regel: keine einzige Anfrage', async () => {
    const l = leser([ev(1, 'Gottesdienst', '2')], keinAblauf);
    expect(await termineOhneAblauf(l, 'a', 'b', { kalenderIds: [], suchwort: '' })).toEqual([]);
    expect(l.events).not.toHaveBeenCalled();
  });

  it('bremst ChurchTools, scheitert der ganze Lauf – keine lückenhafte Liste', async () => {
    const l = leser([ev(1, 'Gottesdienst', '2'), ev(2, 'Gottesdienst', '2')], (id) =>
      id === 2 ? Promise.reject(new Fehler(503, 'gebremst')) : keinAblauf(),
    );
    await expect(termineOhneAblauf(l, 'a', 'b', REGEL)).rejects.toMatchObject({ status: 503 });
  });

  it('ein anderer Fehler lässt NUR diese Veranstaltung weg (nicht raten, ob sie einen hat)', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const l = leser([ev(1, 'Gottesdienst', '2'), ev(2, 'Gottesdienst', '2')], (id) =>
      id === 2 ? Promise.reject(new Fehler(403, 'kein Recht')) : keinAblauf(),
    );
    expect((await termineOhneAblauf(l, 'a', 'b', REGEL)).map((s) => s.id)).toEqual([1]);
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });
});

describe('fensterOhneAblauf', () => {
  it('ab heute bis zum Ende der Terminliste (6 Wochen)', () => {
    expect(fensterOhneAblauf(new Date('2026-10-13T10:00:00Z'))).toEqual({
      from: '2026-10-13',
      to: '2026-11-24',
    });
  });
});

describe('vorlagenAus / kalenderAus', () => {
  it('Vorlagen: ID als Zahl, Name sortiert, Punkte gezählt, Einträge ohne ID fallen weg', () => {
    expect(
      vorlagenAus([
        { id: 30, name: 'Sonntag', calendarId: 2, items: [{}, {}] },
        { id: 28, name: 'Abendmahl', calendarId: null },
        { id: 'x' as unknown as number, name: 'kaputt' },
      ]),
    ).toEqual([
      { id: 28, name: 'Abendmahl', kalenderId: null, punkte: 0 },
      { id: 30, name: 'Sonntag', kalenderId: 2, punkte: 2 },
    ]);
  });

  it('Vorlage ohne Namen bekommt einen, damit die Auswahl nicht leer dasteht', () => {
    expect(vorlagenAus([{ id: 5, name: '  ' }])[0].name).toBe('Vorlage 5');
  });

  it('Kalender: nach Namen sortiert', () => {
    expect(
      kalenderAus([
        { id: 3, name: 'Jugend' },
        { id: 2, name: 'Gottesdienst' },
      ]),
    ).toEqual([
      { id: 2, name: 'Gottesdienst' },
      { id: 3, name: 'Jugend' },
    ]);
  });

  it('nichts geliefert → leere Liste', () => {
    expect(vorlagenAus(null)).toEqual([]);
    expect(kalenderAus(undefined)).toEqual([]);
  });
});

/** Ein Schreiber, der sich wie ChurchTools verhält: PUT auf `…/agenda` legt den Ablauf an. */
function schreiber(start: { hatAblauf: boolean; anlegenWirkt?: boolean; leseFehler?: number }) {
  let hat = start.hatAblauf;
  const geschrieben: { pfad: string; auftrag: SchreibAuftrag }[] = [];
  const s: CtSchreiber = {
    agenda: vi.fn(() => {
      if (start.leseFehler) return Promise.reject(new Fehler(start.leseFehler, 'Lesefehler'));
      return hat ? Promise.resolve({ items: [] }) : keinAblauf();
    }),
    song: vi.fn(),
    vorlage: vi.fn(),
    schreibe: vi.fn((pfad: string, auftrag: SchreibAuftrag) => {
      geschrieben.push({ pfad, auftrag });
      if (start.anlegenWirkt !== false) hat = true;
      return Promise.resolve(null);
    }),
    fehler: (st, m) => new Fehler(st, m),
  };
  return { s, geschrieben };
}

describe('ablaufAnlegen', () => {
  it('aus einer Vorlage: PUT mit template_id und dem Kalender im Rumpf', async () => {
    const { s, geschrieben } = schreiber({ hatAblauf: false });
    await ablaufAnlegen(s, 148, 2, { art: 'vorlage', vorlageId: 28 });
    expect(geschrieben).toHaveLength(1);
    expect(geschrieben[0].pfad).toBe('/events/148/agenda?template_id=28');
    expect(geschrieben[0].auftrag).toMatchObject({ method: 'PUT', json: { calendarId: 2 } });
  });

  it('als Kopie: event_id; leer: ohne Zusatz', async () => {
    const a = schreiber({ hatAblauf: false });
    await ablaufAnlegen(a.s, 151, 2, { art: 'kopie', eventId: 1 });
    expect(a.geschrieben[0].pfad).toBe('/events/151/agenda?event_id=1');

    const b = schreiber({ hatAblauf: false });
    await ablaufAnlegen(b.s, 160, 2, { art: 'leer' });
    expect(b.geschrieben[0].pfad).toBe('/events/160/agenda');
  });

  it('gibt es schon einen Ablauf: 409 und KEIN Schreiben (PUT würde ihn ändern)', async () => {
    const { s, geschrieben } = schreiber({ hatAblauf: true });
    await expect(ablaufAnlegen(s, 148, 2, { art: 'leer' })).rejects.toMatchObject({
      status: 409,
      message: ABLAUF_SCHON_DA,
    });
    expect(geschrieben).toHaveLength(0);
  });

  it('meldet ChurchTools Erfolg, ohne dass ein Ablauf da ist: 502 statt „angelegt"', async () => {
    const { s } = schreiber({ hatAblauf: false, anlegenWirkt: false });
    await expect(ablaufAnlegen(s, 148, 2, { art: 'leer' })).rejects.toMatchObject({ status: 502 });
  });

  it('lässt sich vorher nicht lesen (nicht 404): nichts schreiben, Fehler weitergeben', async () => {
    const { s, geschrieben } = schreiber({ hatAblauf: false, leseFehler: 503 });
    await expect(ablaufAnlegen(s, 148, 2, { art: 'leer' })).rejects.toMatchObject({ status: 503 });
    expect(geschrieben).toHaveLength(0);
  });
});
