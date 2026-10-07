import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createHash } from 'node:crypto';
import { fingerprintRohtext } from '@shared/ct/agendaDiff';
import {
  ablaufStand,
  datei,
  fingerabdruck,
  gemeindeKonfiguration,
  meinStatus,
  meineRechte,
  termine,
} from './ctLesen';
import { _bremseLoesen, _vergissCsrf, ChurchToolsBremst, ctAnfrage } from './ctRuntime';
import { _zuruecksetzen, merkeGesehen } from './personenAblage';
import { BASIS, FakeCt } from './ctFake.testutil';

/**
 * Der Lese-Weg der Extension (#335): dieselben geteilten Regeln wie der Server, nur über die Sitzung
 * der Seite. Geprüft gegen das nachgebaute ChurchTools aus `ctFake.testutil.ts`.
 */
let ct: FakeCt;

const AGENDA = {
  items: [
    { id: 1, title: 'Begrüßung', type: 'normal' },
    {
      id: 2,
      title: 'Lied',
      type: 'song',
      song: { songId: 7, arrangementId: 70, title: 'Lied', arrangement: 'A', key: 'G', bpm: 72 },
    },
  ],
};

beforeEach(() => {
  _zuruecksetzen();
  _vergissCsrf();
  _bremseLoesen();
  ct = new FakeCt();
  ct.installieren();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe('Fingerabdruck', () => {
  it('ist derselbe Wert wie im Server (sha256 über denselben Text)', async () => {
    const text = fingerprintRohtext(AGENDA.items);
    const server = createHash('sha256').update(text).digest('hex');
    expect(await fingerabdruck(text)).toBe(server);
  });

  it('leerer Ablauf → leerer Fingerabdruck, wie im Server', async () => {
    expect(await fingerabdruck('')).toBe('');
  });
});

describe('Terminliste', () => {
  beforeEach(() => {
    ct.liefere('/api/events', {
      data: [{ id: 500, name: 'Gottesdienst', startDate: '2026-10-11T08:00:00Z', endDate: '' }],
    });
    ct.liefere('/api/events/500/agenda', { data: AGENDA });
  });

  it('ohne gemerkten Stand ist nichts „geändert" (kein Fehlalarm bei Erstnutzung)', async () => {
    const [t] = await termine();
    expect(t.id).toBe(500);
    expect(t.setlistChanged).toBe(false);
  });

  it('gleicher Stand → nicht geändert, anderer Stand → geändert', async () => {
    const { hash } = await ablaufStand(500);
    await merkeGesehen(500, { hash });
    expect((await termine())[0].setlistChanged).toBe(false);
    await merkeGesehen(500, { hash: 'alt' });
    expect((await termine())[0].setlistChanged).toBe(true);
  });
});

describe('Anmeldung', () => {
  it('id -1 (#381) heißt: nicht angemeldet', async () => {
    ct.liefere('/api/whoami', { data: { id: -1, lastName: 'Anonymous' } });
    expect(await meinStatus()).toEqual({ authenticated: false });
  });

  it('angemeldet: Person aus ChurchTools, ohne eigene Anmeldung', async () => {
    ct.liefere('/api/whoami', { data: { id: 19, firstName: 'Spike', lastName: 'Musiker' } });
    expect(await meinStatus()).toEqual({
      authenticated: true,
      user: { id: 19, firstName: 'Spike', lastName: 'Musiker' },
    });
  });
});

describe('Rechte', () => {
  it('Ablauf und Tempo gelten, wie ChurchTools sie meldet; Liedverwaltung und SongSelect noch aus (#335)', async () => {
    ct.liefere('/api/permissions/global', {
      data: {
        churchservice: {
          'view songcategory': [1],
          'view agenda': [1],
          'edit agenda': [1],
          'edit songcategory': [1],
          'use ccli': true,
        },
      },
    });
    const r = await meineRechte();
    expect(r.canViewSongs).toBe(true);
    expect(r.canViewAgendas).toBe(true);
    expect(r.canEditAgendas).toBe(true);
    // Das Tempo hängt am Lied-Recht, ist aber eigens benannt – sonst verschwände der Knopf mit der
    // noch fehlenden Liedverwaltung, oder das Menü behauptete „fehlende Berechtigung" (07.10.2026).
    expect(r.canEditTempo).toBe(true);
    expect(r.canEditSongs).toBe(false);
    expect(r.canUseCcli).toBe(false);
  });
});

describe('Gemeindename', () => {
  it('kommt aus /api/info', async () => {
    ct.liefere('/api/info', { siteName: 'Evangeliumschristen-Gemeinde' });
    expect((await gemeindeKonfiguration()).orgName).toBe('Evangeliumschristen-Gemeinde');
  });

  it('scheitert die Abfrage, bleibt der Standard – die App startet trotzdem', async () => {
    ct.liefere('/api/info', {}, 500);
    expect((await gemeindeKonfiguration()).orgName).toBe('Meine Gemeinde');
  });
});

describe('Dateien eines Lieds', () => {
  function liedMitDatei(fileId: number): void {
    ct.liefere('/api/songs/7', {
      data: {
        id: 7,
        name: 'Lied',
        arrangements: [
          {
            id: 70,
            name: 'A',
            files: [{ name: 'x.pdf', fileUrl: `${BASIS}/?q=public/filedownload&id=${fileId}` }],
          },
        ],
      },
    });
  }

  it('eine fremde Datei-ID gehört nicht zum Lied → 404, nichts geladen', async () => {
    liedMitDatei(300);
    await expect(datei(7, 999)).rejects.toMatchObject({ status: 404 });
    expect(ct.zaehle('GET /?q=public/filedownload')).toBe(0);
  });

  it('der Typ wird gehärtet wie im Datei-Proxy (#138): HTML wird zum Download', async () => {
    const id = ct.ablegen('boese.html', '<script>alert(1)</script>');
    liedMitDatei(id);
    ct.antworten[`/?q=public/filedownload&id=${id}`] = () =>
      new Response('<script>alert(1)</script>', { headers: { 'Content-Type': 'text/html' } });
    const blob = await datei(7, id);
    expect(blob.type).toBe('application/octet-stream');
  });
});

describe('Bremse (#300)', () => {
  it('nach einem 429 geht KEINE Anfrage mehr raus, bis die Sperrfrist um ist', async () => {
    vi.useFakeTimers();
    ct.liefere('/api/events', { message: 'Too Many Requests' }, 429, { 'Retry-After': '30' });
    await expect(ctAnfrage('/events')).rejects.toBeInstanceOf(ChurchToolsBremst);
    const vorher = ct.aufrufe.length;
    await expect(ctAnfrage('/whoami')).rejects.toBeInstanceOf(ChurchToolsBremst);
    expect(ct.aufrufe.length).toBe(vorher); // gar nicht erst gefragt
    vi.advanceTimersByTime(31_000);
    await expect(ctAnfrage('/whoami')).resolves.toBeTruthy();
  });

  it('eine Datei von einem fremden Host wird nicht geladen (Sitzung bleibt bei ChurchTools)', async () => {
    ct.liefere('/api/songs/7', {
      data: {
        id: 7,
        name: 'Lied',
        arrangements: [
          { id: 70, name: 'A', files: [{ name: 'x.pdf', fileUrl: 'https://fremd.test/?id=5' }] },
        ],
      },
    });
    await expect(datei(7, 5)).rejects.toMatchObject({ status: 502 });
  });
});
