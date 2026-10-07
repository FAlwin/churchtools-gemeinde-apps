import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { agendaItemWritePayload } from '@shared/ct/agendaPayload';
import { arrangementWritePayload } from '@shared/ct/arrangementPayload';
import type { CtAgenda, CtSong } from '@shared/ct/typen';
import { ApiError } from './api';
import { punkt, punktNeu, punktWeg, reihenfolge, tempo, vorBeginn } from './ctSchreiben';
import { _bremseLoesen, _vergissCsrf, ChurchToolsBremst, KeinSpeicherRecht } from './ctRuntime';
import { FakeCt } from './ctFake.testutil';

/**
 * Der Schreib-Weg der Extension (#335, Phase 3b): Ablauf und Tempo direkt aus dem Browser, mit den
 * geteilten Regeln aus `@shared/ct/schreibKern`. Erwartet wird gegen die **Erzeuger**
 * (`agendaItemWritePayload`, `arrangementWritePayload`), nicht gegen abgeschriebene Rümpfe – sonst
 * bliebe der Test bei genau der Herabstufung grün, gegen die er steht.
 */
let ct: FakeCt;

const AGENDA: CtAgenda = {
  calendarId: 2,
  eventStartPosition: 1,
  items: [
    { id: 1, title: 'Vorspiel', type: 'normal', position: 0, duration: 300 },
    {
      id: 2,
      title: 'Lied',
      type: 'song',
      position: 1,
      responsible: { text: '[Musik]' },
      song: { songId: 7, arrangementId: 70, title: 'Lied', arrangement: 'A', key: 'G', bpm: 72 },
    },
    { id: 3, title: 'Predigt', type: 'normal', position: 2 },
  ],
};

const LIED: CtSong = {
  id: 7,
  name: 'Lied',
  author: null,
  ccli: null,
  arrangements: [
    {
      id: 70,
      name: 'A',
      key: 'G',
      keyOfArrangement: 'G',
      bpm: '72',
      tempo: 72,
      duration: 240,
      beat: '4/4',
      files: [],
    },
  ],
};

beforeEach(() => {
  _vergissCsrf();
  _bremseLoesen();
  ct = new FakeCt();
  ct.installieren();
  ct.liefere('/api/events/500/agenda', { data: AGENDA });
  ct.liefere('/api/songs/7', { data: LIED });
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe('Reihenfolge', () => {
  it('schreibt die ganze Liste in neuer Folge – der Lied-Punkt bleibt ein Lied', async () => {
    await reihenfolge(500, [3, 1, 2]);
    expect(ct.geschrieben).toHaveLength(1);
    const { was, json, csrf } = ct.geschrieben[0];
    expect(was).toBe('PUT /api/events/500/agenda');
    expect(csrf).toBe('csrf-123');
    const [a, b, c] = AGENDA.items;
    expect(json).toEqual({
      items: [
        { id: 3, ...agendaItemWritePayload(c, { position: 0 }) },
        { id: 1, ...agendaItemWritePayload(a, { position: 1 }) },
        { id: 2, ...agendaItemWritePayload(b, { position: 2 }) },
      ],
    });
    // Die Herabstufungs-Falle (#212): top-level arrangementId + type 'song'.
    expect((json as { items: Record<string, unknown>[] }).items[2]).toMatchObject({
      type: 'song',
      arrangementId: 70,
    });
  });

  it('hat sich der Ablauf inzwischen geändert → 409, nichts geschrieben', async () => {
    await expect(reihenfolge(500, [2, 1])).rejects.toMatchObject({ status: 409 });
    expect(ct.geschrieben).toHaveLength(0);
  });
});

describe('Punkte', () => {
  it('neuer Punkt ohne Titel bekommt den Standard der Art, Dauer in Sekunden', async () => {
    await punktNeu(500, { type: 'song', arrangementId: 70, durationMin: 4 });
    expect(ct.geschrieben[0]).toMatchObject({
      was: 'POST /api/events/500/agenda/items',
      json: { type: 'song', title: 'Lied', arrangementId: 70, duration: 240 },
    });
  });

  it('Verknüpfung aufheben leert den Titel und macht den Punkt zu Text', async () => {
    await punkt(500, 2, { unlink: true });
    const { was, json } = ct.geschrieben[0];
    expect(was).toBe('PUT /api/events/500/agenda/items/2');
    expect(json).toEqual(agendaItemWritePayload(AGENDA.items[1], { title: '', unlink: true }));
    expect(json).toMatchObject({ type: 'text', title: '' });
    expect(json).not.toHaveProperty('arrangementId');
  });

  it('ändert nur das Genannte – Verantwortlich bleibt erhalten', async () => {
    await punkt(500, 2, { note: 'leise' });
    expect(ct.geschrieben[0].json).toMatchObject({
      note: 'leise',
      responsible: '[Musik]',
      arrangementId: 70,
    });
  });

  it('Punkt gibt es nicht mehr → 404, nichts geschrieben', async () => {
    await expect(punkt(500, 99, { title: 'x' })).rejects.toMatchObject({ status: 404 });
    expect(ct.geschrieben).toHaveLength(0);
  });

  it('Löschen: „schon weg" ist kein Fehler', async () => {
    ct.schreibAntworten['DELETE /api/events/500/agenda/items/3'] = () =>
      new Response(JSON.stringify({ message: 'Not found' }), { status: 404 });
    await expect(punktWeg(500, 3)).resolves.toEqual({ ok: true });
  });
});

describe('Vorlauf (#423)', () => {
  it('schreibt nur die Grenze, nicht die Punkte', async () => {
    await vorBeginn(500, 2, true);
    expect(ct.geschrieben[0]).toEqual({
      was: 'PUT /api/events/500/agenda',
      json: { calendarId: 2, eventStartPosition: 2 },
      csrf: 'csrf-123',
    });
  });

  it('steht schon so → gar kein Schreibvorgang', async () => {
    await vorBeginn(500, 1, true);
    expect(ct.geschrieben).toHaveLength(0);
  });
});

describe('Tempo', () => {
  it('schreibt das ganze Arrangement aus dem frisch gelesenen Stand – Tonart und Dauer bleiben', async () => {
    await expect(tempo(7, 70, 96)).resolves.toEqual({ tempo: 96 });
    const { was, json } = ct.geschrieben[0];
    expect(was).toBe('PUT /api/songs/7/arrangements/70');
    expect(json).toEqual(arrangementWritePayload(LIED.arrangements[0], { tempo: 96 }));
    expect(json).toMatchObject({ key: 'G', duration: 240, tempo: 96 });
  });

  it('unbekanntes Arrangement → 404, nichts geschrieben', async () => {
    await expect(tempo(7, 71, 96)).rejects.toMatchObject({ status: 404 });
    expect(ct.geschrieben).toHaveLength(0);
  });
});

describe('Fehler beim Schreiben – die Zweige einzeln', () => {
  const SCHREIBEN = 'PUT /api/songs/7/arrangements/70';

  it('fehlendes Recht (401, aber angemeldet) → KeinSpeicherRecht mit der Meldung des Auftrags', async () => {
    ct.schreibAntworten[SCHREIBEN] = () =>
      new Response(JSON.stringify({ message: 'Session abgelaufen' }), { status: 401 });
    const e: unknown = await tempo(7, 70, 96).catch((x: unknown) => x);
    expect(e).toBeInstanceOf(KeinSpeicherRecht);
    expect((e as Error).message).toBe('Keine Berechtigung, das Tempo in ChurchTools zu ändern.');
  });

  it('wirklich abgemeldet (401, whoami -1) → 401 bleibt 401, kein „Schreibfehler"', async () => {
    ct.schreibAntworten[SCHREIBEN] = () => new Response('{}', { status: 401 });
    ct.liefere('/api/whoami', { data: { id: -1 } });
    await expect(tempo(7, 70, 96)).rejects.toMatchObject({ status: 401 });
  });

  it('anderer Fehlschlag → 502 mit „… fehlgeschlagen (Status)" wie im Server', async () => {
    ct.schreibAntworten[SCHREIBEN] = () => new Response('{}', { status: 500 });
    const e: unknown = await tempo(7, 70, 96).catch((x: unknown) => x);
    expect(e).toBeInstanceOf(ApiError);
    expect(e).toMatchObject({ status: 502, message: 'Tempo speichern fehlgeschlagen (500).' });
  });

  it('Drosselung (429) bleibt „ChurchTools bremst" – und danach geht nichts mehr raus', async () => {
    ct.schreibAntworten[SCHREIBEN] = () =>
      new Response('{}', { status: 429, headers: { 'Retry-After': '30' } });
    await expect(tempo(7, 70, 96)).rejects.toBeInstanceOf(ChurchToolsBremst);
    const vorher = ct.aufrufe.length;
    await expect(punkt(500, 2, { note: 'x' })).rejects.toBeInstanceOf(ChurchToolsBremst);
    expect(ct.aufrufe.length).toBe(vorher);
  });
});
