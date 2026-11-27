import { describe, expect, it } from 'vitest';
import {
  INFOS_NICHT_ANGEKOMMEN,
  infosSpeichern,
  type TerminInfosPort,
} from '@shared/ct/terminInfos';
import {
  abschnitt,
  neueThemenreihe,
  neueZeile,
  vorschau,
  type ReiheZeile,
} from '@shared/protokolle/themenreihe';
import { ApiError, NichtUebernommen } from '@ui/ct/fehler';
import type { FrischesEvent } from '@ui/ct/terminInfosPort';
import {
  ladeEventLagen,
  uebertragen,
  type Auftrag,
  type UebertragenPort,
} from './reiheUebertragen';

const zeile = (id: string, datum: string, eventId: number | null, thema = id): ReiheZeile => ({
  ...neueZeile(id, datum),
  eventId,
  thema,
});
const reihe = neueThemenreihe({
  id: 'r',
  gruppe: 5,
  name: 'Jona',
  zeilen: [
    zeile('a', '2027-01-13', 10),
    zeile('b', '2027-01-20', 11),
    zeile('c', '2027-01-27', 12),
    zeile('d', '2027-02-03', null),
  ],
  von: 1,
  am: 'x',
});

/** Ein nachgestelltes ChurchTools mit Events – nur `/events/{id}`; protokolliert Lesen und Schreiben der Reihe nach. */
function nachbau(events: Record<number, FrischesEvent>) {
  const log: string[] = [];
  const ct: Record<number, FrischesEvent> = structuredClone(events);
  const fehlerBeiSchreiben = new Map<number, unknown>();
  const fehlerBeiLesen = new Map<number, unknown>();
  const dazwischen = new Map<number, string>();
  const infosPort: TerminInfosPort = {
    termin: async (id) => {
      log.push(`lies ${id}`);
      if (dazwischen.has(id)) ct[id] = { ...ct[id], description: dazwischen.get(id) };
      dazwischen.delete(id);
      return ct[id];
    },
    schreibe: async (pfad, auftrag) => {
      const id = Number(pfad.split('/').pop());
      log.push(`schreibe ${id}`);
      if (fehlerBeiSchreiben.has(id)) throw fehlerBeiSchreiben.get(id);
      ct[id] = {
        ...ct[id],
        description: (auftrag.json as { description: string | null }).description,
      };
      return null;
    },
    fehler: (status, meldung) =>
      meldung === INFOS_NICHT_ANGEKOMMEN
        ? new NichtUebernommen('die Infos')
        : new ApiError(status, meldung),
  };
  const port: UebertragenPort = {
    event: async (id) => {
      log.push(`event ${id}`);
      if (fehlerBeiLesen.has(id)) throw fehlerBeiLesen.get(id);
      return ct[id];
    },
    speichern: (id, neu, gesehen) => infosSpeichern(infosPort, id, neu, gesehen),
  };
  return { ct, log, port, fehlerBeiSchreiben, fehlerBeiLesen, dazwischen };
}

const EVENT = (
  kalender: number,
  description = '',
  extra: Partial<FrischesEvent> = {},
): FrischesEvent => ({
  name: 'Jugendabend',
  startDate: '2027-01-13T18:30:00Z',
  description,
  isCanceled: false,
  calendar: { domainIdentifier: String(kalender) },
  ...extra,
});

/** Aufträge so, wie das Fenster sie baut: aus `vorschau` über die frisch gelesenen Lagen (die Erzeuger, keine Literale). */
async function auftraegeAus(n: ReturnType<typeof nachbau>, kalender: number[] = [4]) {
  const lagen = await ladeEventLagen(n.port, reihe, { kalender, ich: 1 });
  const vor = reihe.zeilen.map((z, i) => ({
    z,
    v: vorschau(reihe, i, z.eventId === null ? null : (lagen.get(z.eventId)?.lage ?? null)),
  }));
  const auftraege: Auftrag[] = vor.flatMap(({ z, v }) =>
    (v.art === 'neu' || v.art === 'geaendert') && z.eventId !== null
      ? [{ eventId: z.eventId, neuerText: v.neuerText!, gesehen: v.alterText! }]
      : [],
  );
  return { lagen, vor, auftraege };
}

describe('ladeEventLagen', () => {
  it('liest jedes Event frisch, nacheinander und je Event nur einmal', async () => {
    const n = nachbau({ 10: EVENT(4), 11: EVENT(4), 12: EVENT(4) });
    await ladeEventLagen(
      n.port,
      { zeilen: [...reihe.zeilen, zeile('e', '2027-02-10', 10)] },
      { kalender: [4], ich: 1 },
    );
    expect(n.log).toEqual(['event 10', 'event 11', 'event 12']);
  });

  it('leitet das Recht aus Kalender und Termin-Admins des frischen Events ab', async () => {
    const n = nachbau({
      10: EVENT(4),
      11: EVENT(9),
      12: EVENT(9, '', { adminIds: [1] }),
    });
    const lagen = await ladeEventLagen(n.port, reihe, { kalender: [4], ich: 1 });
    expect(lagen.get(10)?.lage?.darf).toBe(true);
    expect(lagen.get(11)?.lage?.darf).toBe(false);
    expect(lagen.get(12)?.lage?.darf).toBe(true);
    expect(lagen.get(10)).toMatchObject({ name: 'Jugendabend', startDate: '2027-01-13T18:30:00Z' });
  });

  it('ein nicht lesbares Event (503) ist „nicht gelesen“ – nicht „aktuell“; die anderen werden gelesen', async () => {
    const n = nachbau({ 10: EVENT(4), 11: EVENT(4), 12: EVENT(4) });
    n.fehlerBeiLesen.set(11, new ApiError(503, 'x'));
    const lagen = await ladeEventLagen(n.port, reihe, { kalender: [4], ich: 1 });
    expect(lagen.get(11)).toMatchObject({ lage: null });
    expect(lagen.get(11)?.fehler).toMatch(/antwortet gerade nicht/);
    expect(lagen.get(10)?.lage).not.toBeNull();
    expect(lagen.get(12)?.lage).not.toBeNull();
  });
});

describe('uebertragen', () => {
  it('schreibt nacheinander und liest danach nach; der Handtext im Event bleibt', async () => {
    const n = nachbau({ 10: EVENT(4, 'Treffpunkt 19 Uhr'), 11: EVENT(4), 12: EVENT(4) });
    const { auftraege, vor } = await auftraegeAus(n);
    expect(vor.map((x) => x.v.art)).toEqual(['neu', 'neu', 'neu', 'ohneEvent']);
    n.log.length = 0;
    const r = await uebertragen(n.port, auftraege);
    expect([...r.values()].map((x) => x.art)).toEqual(['ok', 'ok', 'ok']);
    // je Event: lesen, schreiben, nachlesen – und das nächste erst danach
    expect(n.log).toEqual([
      'lies 10',
      'schreibe 10',
      'lies 10',
      'lies 11',
      'schreibe 11',
      'lies 11',
      'lies 12',
      'schreibe 12',
      'lies 12',
    ]);
    expect(n.ct[10].description).toBe(`Treffpunkt 19 Uhr\n\n${abschnitt(reihe, 0)}`);
    expect(n.ct[11].description).toBe(abschnitt(reihe, 1));
  });

  it('ein Konflikt bei einem Event bricht die anderen nicht ab und überschreibt nichts', async () => {
    const n = nachbau({ 10: EVENT(4), 11: EVENT(4, 'alt'), 12: EVENT(4) });
    const { auftraege } = await auftraegeAus(n);
    n.dazwischen.set(11, 'inzwischen von Hand geändert');
    const r = await uebertragen(n.port, auftraege);
    expect(r.get(10)?.art).toBe('ok');
    expect(r.get(11)?.art).toBe('konflikt');
    expect(r.get(12)?.art).toBe('ok');
    expect(n.ct[11].description).toBe('inzwischen von Hand geändert');
    expect(n.log.filter((x) => x === 'schreibe 11')).toHaveLength(0);
  });

  it('ein 403 bei einem Event bricht die anderen nicht ab', async () => {
    const n = nachbau({ 10: EVENT(4), 11: EVENT(4), 12: EVENT(4) });
    const { auftraege } = await auftraegeAus(n);
    n.fehlerBeiSchreiben.set(10, new ApiError(403, 'verboten'));
    const r = await uebertragen(n.port, auftraege);
    expect(r.get(10)?.art).toBe('verweigert');
    expect(r.get(11)?.art).toBe('ok');
    expect(r.get(12)?.art).toBe('ok');
  });

  it('ein vorübergehender Fehler (504, Netz) heißt „nicht übertragen, noch einmal“ – nichts zerstört, die anderen laufen', async () => {
    const n = nachbau({ 10: EVENT(4, 'Hand'), 11: EVENT(4), 12: EVENT(4) });
    const { auftraege } = await auftraegeAus(n);
    n.fehlerBeiSchreiben.set(10, new ApiError(504, 'zu langsam'));
    n.fehlerBeiSchreiben.set(11, new TypeError('Failed to fetch'));
    const r = await uebertragen(n.port, auftraege);
    expect(r.get(10)).toMatchObject({ art: 'fehler' });
    expect((r.get(10) as { meldung: string }).meldung).toMatch(/antwortet gerade nicht/);
    expect(r.get(11)?.art).toBe('fehler');
    expect(r.get(12)?.art).toBe('ok');
    expect(n.ct[10].description).toBe('Hand');
  });

  it('ChurchTools meldet Erfolg, übernimmt den Text aber nicht: nichtUebernommen – die anderen laufen', async () => {
    const n = nachbau({ 10: EVENT(4), 11: EVENT(4), 12: EVENT(4) });
    const { auftraege } = await auftraegeAus(n);
    const echt = n.port.speichern;
    n.port.speichern = (id, neu, gesehen) => {
      if (id !== 10) return echt(id, neu, gesehen);
      // 200, aber nichts gespeichert – das Nachlesen deckt es auf
      const stumm: TerminInfosPort = {
        termin: async () => n.ct[10],
        schreibe: async () => null,
        fehler: (s, m) =>
          m === INFOS_NICHT_ANGEKOMMEN ? new NichtUebernommen('die Infos') : new ApiError(s, m),
      };
      return infosSpeichern(stumm, id, neu, gesehen);
    };
    const r = await uebertragen(n.port, auftraege);
    expect(r.get(10)?.art).toBe('nichtUebernommen');
    expect(r.get(12)?.art).toBe('ok');
  });

  it('meldet den Fortschritt je Event in der Reihenfolge der Aufträge', async () => {
    const n = nachbau({ 10: EVENT(4), 11: EVENT(4), 12: EVENT(4) });
    const { auftraege } = await auftraegeAus(n);
    const gesehen: number[] = [];
    await uebertragen(n.port, auftraege, (id) => gesehen.push(id));
    expect(gesehen).toEqual([10, 11, 12]);
  });
});

describe('Vorschau über die frischen Lagen', () => {
  it('ohne Recht kein Auftrag; ein Event ohne Änderung ebenso', async () => {
    const n = nachbau({ 10: EVENT(4), 11: EVENT(9), 12: EVENT(4, abschnitt(reihe, 2)) });
    const { vor, auftraege } = await auftraegeAus(n);
    expect(vor.map((x) => x.v.art)).toEqual(['neu', 'keinRecht', 'aktuell', 'ohneEvent']);
    expect(auftraege.map((a) => a.eventId)).toEqual([10]);
  });
});
