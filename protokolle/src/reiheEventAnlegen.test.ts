import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError, Unklar } from '@ui/ct/fehler';
import { eventsFuer } from '@shared/protokolle/terminEvents';
import { reiheEintrag, type EventAnlegenEingabe } from '@shared/protokolle/reiheEventAnlegen';
import type { ReiheEvent } from '@shared/protokolle/themenreihe';
import { eventZumTerminLesen } from './eventsLesen';
import { reiheEventsAnlegen } from './reiheEventAnlegen';
import { schonImKalender, terminLegen } from './terminEintragen';

vi.mock('./terminEintragen', () => ({ schonImKalender: vi.fn(), terminLegen: vi.fn() }));
vi.mock('./eventsLesen', () => ({ eventZumTerminLesen: vi.fn() }));

/** Das Anlegen der Events einer Reihe: nacheinander, nie doppelt, Event erst übernehmen, wenn es nachgelesen ist. */
const ZONE = 'Europe/Berlin';
const EINGABE: EventAnlegenEingabe & { kalender: number } = {
  kalender: 4,
  titel: 'Jugendabend',
  von: '19:30',
  bis: '21:30',
  vorlage: 0,
};
const ABENDE = [
  { id: 'a', tag: '2027-01-27' },
  { id: 'b', tag: '2027-02-03' },
  { id: 'c', tag: '2027-02-10' },
];
const event = (id: number, tag: string): ReiheEvent => ({
  id,
  name: 'Jugendabend',
  startDate: `${tag}T18:30:00Z`,
  tag,
  kalenderId: 4,
});
const los = (abende = ABENDE) =>
  reiheEventsAnlegen({ abende, eingabe: EINGABE, kalenderName: 'Jugend', zeitzone: ZONE });

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(schonImKalender).mockResolvedValue(null);
  let nr = 700;
  vi.mocked(terminLegen).mockImplementation(async () => ({
    art: 'angelegt',
    id: nr++,
    events: { fehlend: [], unklar: false },
  }));
  vi.mocked(eventZumTerminLesen).mockImplementation(async (q) => event(q.termin + 100, q.tag));
});

describe('reiheEventsAnlegen', () => {
  it('legt je Abend einen Termin mit Event an und gibt das nachgelesene Event zurück', async () => {
    const r = await los();
    expect(r.map((x) => x.art)).toEqual(['angelegt', 'angelegt', 'angelegt']);
    expect(r[0]).toMatchObject({ id: 'a', art: 'angelegt', event: { id: 800 } });
    expect(r[2]).toMatchObject({ id: 'c', event: { id: 802 } });
  });

  it('der Eintrag ist der des Erzeugers: Titel, Kalender, nur dieser Tag mit der Vorlage 0 – ohne Einladung', async () => {
    await los([ABENDE[0]]);
    const q = vi.mocked(terminLegen).mock.calls[0][0];
    expect(q.eintrag).toEqual({ ...reiheEintrag(EINGABE, '2027-01-27'), kalender: 4 });
    expect(q.zeitzone).toBe(ZONE);
    expect(q.eingeladen).toBeUndefined();
    expect(q.bild).toBeUndefined();
    // Gelesen wird das Event mit genau dem Beginn, den der Erzeuger der Events rechnet.
    const gewollt = eventsFuer(q.eintrag, ZONE)[0];
    expect(vi.mocked(eventZumTerminLesen).mock.calls[0][0]).toMatchObject({
      termin: 700,
      tag: '2027-01-27',
      startDate: gewollt.startDate,
    });
  });

  it('NACHEINANDER: der nächste Abend fängt erst an, wenn der vorige fertig ist (nie zwei Anfragen zugleich)', async () => {
    let aktiv = 0;
    let hoechstens = 0;
    const mitZaehler =
      <A extends unknown[], T>(f: (...a: A) => Promise<T>) =>
      async (...a: A) => {
        aktiv++;
        hoechstens = Math.max(hoechstens, aktiv);
        await new Promise((r) => setTimeout(r, 5));
        try {
          return await f(...a);
        } finally {
          aktiv--;
        }
      };
    const reihenfolge: string[] = [];
    vi.mocked(schonImKalender).mockImplementation(
      mitZaehler(async (e) => {
        reihenfolge.push(`prüfen ${e.tag}`);
        return null;
      }),
    );
    vi.mocked(terminLegen).mockImplementation(
      mitZaehler(async (q) => {
        reihenfolge.push(`anlegen ${q.eintrag.tag}`);
        return { art: 'angelegt', id: 1, events: { fehlend: [], unklar: false } } as never;
      }),
    );
    vi.mocked(eventZumTerminLesen).mockImplementation(
      mitZaehler(async (q) => {
        reihenfolge.push(`lesen ${q.tag}`);
        return event(5, q.tag);
      }),
    );
    await los();
    expect(hoechstens).toBe(1);
    expect(reihenfolge).toEqual(
      ABENDE.flatMap((a) => [`prüfen ${a.tag}`, `anlegen ${a.tag}`, `lesen ${a.tag}`]),
    );
  });

  it('steht am Tag schon ein ähnlicher Termin: NICHTS angelegt für diesen Tag, die anderen laufen weiter', async () => {
    vi.mocked(schonImKalender).mockImplementation(async (e) =>
      e.tag === '2027-02-03' ? { id: 55, titel: 'Jugendabend extra', beginn: 'x' } : null,
    );
    const r = await los();
    expect(r.map((x) => x.art)).toEqual(['angelegt', 'schonDa', 'angelegt']);
    expect(r[1]).toMatchObject({ titel: 'Jugendabend extra', kalender: 'Jugend' });
    expect(vi.mocked(terminLegen).mock.calls.map((c) => c[0].eintrag.tag)).toEqual([
      '2027-01-27',
      '2027-02-10',
    ]);
  });

  it('wirft die Prüfung „steht schon da?“, wird für diesen Tag NICHTS angelegt – Fehler gemeldet, andere Tage laufen', async () => {
    vi.mocked(schonImKalender).mockImplementation(async (e) => {
      if (e.tag === '2027-01-27') throw new ApiError(503, 'weg');
      return null;
    });
    const r = await los();
    expect(r.map((x) => x.art)).toEqual(['fehler', 'angelegt', 'angelegt']);
    expect(vi.mocked(terminLegen).mock.calls.map((c) => c[0].eintrag.tag)).not.toContain(
      '2027-01-27',
    );
  });

  it('ein abgelehntes Anlegen (kein Recht) ist ein Fehler an diesem Tag – die anderen laufen weiter', async () => {
    vi.mocked(terminLegen).mockRejectedValueOnce(new ApiError(422, 'abgelehnt'));
    const r = await los();
    expect(r.map((x) => x.art)).toEqual(['fehler', 'angelegt', 'angelegt']);
  });

  it('eine unklare Antwort beim Anlegen: kein zweites Anlegen für diesen Abend, Meldung mit dem Text von ChurchTools', async () => {
    vi.mocked(terminLegen).mockRejectedValueOnce(new Unklar('Bitte erst im Kalender nachsehen.'));
    const r = await los();
    expect(r[0]).toMatchObject({ art: 'unklar', text: 'Bitte erst im Kalender nachsehen.' });
    expect(
      vi.mocked(terminLegen).mock.calls.filter((c) => c[0].eintrag.tag === '2027-01-27'),
    ).toHaveLength(1);
    expect(r[1].art).toBe('angelegt');
  });

  it('ein 201 ist kein Beleg: findet das Nachlesen kein Event, bleibt die Zeile ohne Event', async () => {
    vi.mocked(eventZumTerminLesen).mockResolvedValue(null);
    const r = await los([ABENDE[0]]);
    expect(r[0].art).toBe('ohneEvent');
  });

  it('meldet schon das Nachlesen in terminLegen „fehlt“ oder „unklar“, wird das Event gar nicht erst gelesen', async () => {
    vi.mocked(terminLegen).mockResolvedValueOnce({
      art: 'angelegt',
      id: 1,
      events: { fehlend: ['2027-01-27'], unklar: false },
    });
    vi.mocked(terminLegen).mockResolvedValueOnce({
      art: 'angelegt',
      id: 2,
      events: { fehlend: [], unklar: true },
    });
    const r = await los([ABENDE[0], ABENDE[1]]);
    expect(r.map((x) => x.art)).toEqual(['ohneEvent', 'ohneEvent']);
    expect(eventZumTerminLesen).not.toHaveBeenCalled();
  });

  it('scheitert das Nachlesen des Events (vorübergehend): nichts übernommen, kein zweites Anlegen', async () => {
    vi.mocked(eventZumTerminLesen).mockRejectedValue(new ApiError(503, 'weg'));
    const r = await los([ABENDE[0]]);
    expect(r[0].art).toBe('ohneEvent');
    expect(terminLegen).toHaveBeenCalledTimes(1);
  });

  it('ein Termin, der sich nicht nachlesen lässt (Unklar aus terminLegen), ist unklar – ohne Event, ohne zweites Anlegen', async () => {
    vi.mocked(terminLegen).mockRejectedValue(
      new Unklar('Der Termin wurde angelegt, ließ sich aber nicht nachlesen.'),
    );
    const r = await los([ABENDE[0]]);
    expect(r[0].art).toBe('unklar');
    expect(terminLegen).toHaveBeenCalledTimes(1);
    expect(eventZumTerminLesen).not.toHaveBeenCalled();
  });
});
