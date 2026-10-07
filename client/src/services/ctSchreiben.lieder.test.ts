import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ApiError } from './api';
import {
  _bremseLoesen,
  _vergissCsrf,
  ctAltAnfrage,
  ctAnfrage,
  KeinSpeicherRecht,
} from './ctRuntime';
import { _vergissStammdaten, bearbeitbareKategorien } from './ctLesen';
import { arrangementNeu, arrangementWeg, dateiNeu, liedNeu } from './ctSchreiben';
import { BASIS, FakeCt } from './ctFake.testutil';

/**
 * Die Liedverwaltung der Extension (#335, Phase 3b-2): Lieder, Arrangements und Dateien direkt aus dem
 * Browser – mit den geteilten Regeln aus `@shared/ct/liedVerwaltung` und `notenblaetter`. Die Regeln
 * selbst prüfen die Server-Tests (über den Anschluss des Servers); hier geht es um den Weg des Browsers:
 * alte Schnittstelle, Upload, Fehler, CSRF.
 */
let ct: FakeCt;
const AJAX = 'POST /index.php?q=churchservice/ajax';

const STAMMDATEN = {
  status: 'success',
  data: {
    songcategory: [
      { id: '0', bezeichnung: 'Aktive Songs', sortkey: 1 },
      { id: '1', bezeichnung: 'Neue Lieder', sortkey: 2 },
    ],
    songsource: { '3': { id: '3', name: 'Feiert Jesus', shorty: 'FJ', sortkey: 1 } },
  },
};

const ARR = (id: number, isDefault: boolean) => ({
  id,
  name: isDefault ? 'Standard' : 'Akustik',
  isDefault,
  key: 'G',
  keyOfArrangement: 'G',
  bpm: null,
  beat: null,
  files: [],
});

function json(body: unknown, status = 200): () => Response {
  return () =>
    new Response(JSON.stringify(body), {
      status,
      headers: { 'Content-Type': 'application/json' },
    });
}

beforeEach(() => {
  _vergissCsrf();
  _bremseLoesen();
  _vergissStammdaten();
  ct = new FakeCt();
  ct.installieren();
  // Darf nur in Kategorie 1 („Neue Lieder") – kein Admin.
  ct.liefere('/api/permissions/global', {
    data: { churchservice: { 'edit songcategory': [1], 'view songcategory': [0, 1] } },
  });
  ct.schreibAntworten[AJAX] = json(STAMMDATEN);
  ct.liefere('/api/songs', {
    data: [{ id: 7, name: 'Treu', ccli: '123', category: { id: 1, name: 'Neue Lieder' } }],
  });
  ct.liefere('/api/songs/7', {
    data: {
      id: 7,
      name: 'Treu',
      category: { id: 1 },
      arrangements: [ARR(70, true), ARR(71, false)],
    },
  });
  ct.schreibAntworten['POST /api/songs'] = json({ data: { id: 50 } }, 201);
  ct.schreibAntworten['POST /api/songs/50/arrangements'] = json({ data: { id: 500 } }, 201);
  ct.liefere('/api/songs/50', {
    data: { id: 50, name: 'Neu', category: { id: 1 }, arrangements: [ARR(500, true)] },
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const liedWrites = () => ct.geschrieben.filter((g) => g.was.includes('/api/songs'));

describe('Kategorien über die alte Schnittstelle', () => {
  it('nur die erlaubten – geholt mit CSRF-Token und X-Requested-With, einmal je Sitzung', async () => {
    expect(await bearbeitbareKategorien()).toEqual([{ id: 1, name: 'Neue Lieder' }]);
    await bearbeitbareKategorien();
    const ajax = ct.geschrieben.filter((g) => g.was === AJAX);
    expect(ajax).toHaveLength(1);
    expect(ajax[0]).toMatchObject({
      felder: { func: 'getMasterData' },
      csrf: 'csrf-123',
      xrw: 'XMLHttpRequest',
    });
  });

  it('eine HTML-Seite statt JSON (abgelaufene Sitzung) ist ein lesbarer Fehler, kein Absturz', async () => {
    ct.schreibAntworten[AJAX] = () => new Response('<html>Anmelden</html>', { status: 200 });
    await expect(ctAltAnfrage('getMasterData')).rejects.toMatchObject({ status: 502 });
  });
});

describe('Lied anlegen', () => {
  it('Lied, dann Arrangement – und am Ende nachgesehen', async () => {
    await expect(liedNeu({ name: 'Neu', categoryId: 1 })).resolves.toEqual({
      songId: 50,
      arrangementId: 500,
    });
    expect(liedWrites().map((g) => g.was)).toEqual([
      'POST /api/songs',
      'POST /api/songs/50/arrangements',
    ]);
  });

  it('in einer Kategorie ohne Recht → 403, nichts angelegt', async () => {
    await expect(liedNeu({ name: 'Neu', categoryId: 0 })).rejects.toMatchObject({ status: 403 });
    expect(liedWrites()).toHaveLength(0);
  });

  it('dieselbe CCLI-Nummer wie ein vorhandenes Lied → 409, nichts angelegt', async () => {
    await expect(liedNeu({ name: 'Neu', categoryId: 1, ccli: ' 123 ' })).rejects.toMatchObject({
      status: 409,
    });
    expect(liedWrites()).toHaveLength(0);
  });
});

describe('Arrangements', () => {
  it('eine Liednummer ohne Liederbuch → 400, nichts geschrieben', async () => {
    await expect(
      arrangementNeu(7, { name: 'Akustik 2', sourceReference: '12' }),
    ).rejects.toMatchObject({ status: 400 });
    expect(liedWrites()).toHaveLength(0);
  });

  it('das Standard-Arrangement lässt sich nicht löschen', async () => {
    await expect(arrangementWeg(7, 70)).rejects.toMatchObject({ status: 409 });
    expect(liedWrites()).toHaveLength(0);
  });
});

describe('Datei hochladen', () => {
  it('EIN Feld files[] mit Name und Art – an das Arrangement des Liedes', async () => {
    const datei = new File([new Uint8Array([1, 2, 3])], 'Treu - E.pdf', {
      type: 'application/pdf',
    });
    await dateiNeu(7, 70, datei);
    const upload = ct.geschrieben.find((g) => g.was.startsWith('POST /api/files/'));
    expect(upload?.was).toBe('POST /api/files/song_arrangement/70');
    expect(upload?.datei?.name).toBe('Treu - E.pdf');
    expect(upload?.datei?.type).toBe('application/pdf');
    expect(upload?.datei?.size).toBe(3);
  });

  it('eine leere Datei wird nicht hochgeladen', async () => {
    await expect(dateiNeu(7, 70, new File([], 'leer.pdf'))).rejects.toMatchObject({ status: 400 });
    expect(ct.geschrieben.filter((g) => g.was.startsWith('POST /api/files/'))).toHaveLength(0);
  });

  it('ein Arrangement eines ANDEREN Liedes → 404, nichts hochgeladen', async () => {
    const datei = new File(['x'], 'a.pdf', { type: 'application/pdf' });
    await expect(dateiNeu(7, 999, datei)).rejects.toMatchObject({ status: 404 });
    expect(ct.geschrieben.filter((g) => g.was.startsWith('POST /api/files/'))).toHaveLength(0);
  });
});

describe('CSRF-Token nach einer Ablehnung (#298, im Browser nachgezogen)', () => {
  it('der nächste Schreibversuch holt ein FRISCHES Token', async () => {
    ct.schreibAntworten['DELETE /api/songs/7'] = json(
      { message: 'Forbidden', messageKey: 'error.forbidden.delete' },
      403,
    );
    await expect(ctAnfrage('/songs/7', { method: 'DELETE' })).rejects.toBeInstanceOf(
      KeinSpeicherRecht,
    );
    await expect(ctAnfrage('/songs/7', { method: 'DELETE' })).rejects.toBeInstanceOf(ApiError);
    expect(ct.zaehle('GET /api/csrftoken')).toBe(2);
  });

  it('ohne Ablehnung bleibt das Token liegen', async () => {
    await ctAnfrage('/songs/8', { method: 'DELETE' });
    await ctAnfrage('/songs/9', { method: 'DELETE' });
    expect(ct.zaehle('GET /api/csrftoken')).toBe(1);
  });
});

void BASIS;
