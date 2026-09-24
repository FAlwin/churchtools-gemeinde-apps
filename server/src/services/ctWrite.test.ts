import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  uploadChordpro,
  uploadFile,
  reorderAgenda,
  createAgendaItem,
  updateAgendaItem,
  deleteAgendaItem,
  setAgendaItemVorBeginn,
  deleteFile,
  updateArrangementTempo,
  createAbsence,
  deleteAbsence,
  fuerChurchTools,
  createSong,
  updateSong,
  deleteSong,
  createArrangement,
  updateArrangement,
  setDefaultArrangement,
  deleteArrangement,
} from './ctWrite.js';
import * as ctWriteModul from './ctWrite.js';
import { __resetSessionMemosForTests } from './ctSessionMemos.js';

/**
 * #280: Alle Schreiboperationen teilen sich seit dem Aufteilen EINEN Helfer (`schreibe`). Vorher stand
 * das Ritual – Token holen, mitschicken, bei 401/403 über `csrfWriteDenied` melden – **siebenmal
 * wortgleich** im Code. Seit #321 sind es acht – `uploadFile` kam als allgemeiner Datei-Upload hinzu.
 * Am 24.09.2026 kamen die beiden Abwesenheits-Schreiber dazu (#177), die hier bis dahin fehlten –
 * ausgerechnet in dem Test, der vor genau dieser Lücke warnt. Dasselbe galt für die Lied- und
 * Arrangement-Schreiber (#322, #396): Sie nutzen `schreibe` seit August, standen hier aber erst ab
 * dem 07.10.2026. Damit die Liste nicht wieder still veraltet, prüft ein eigener Test unten, dass
 * JEDE exportierte Funktion entweder hier steht oder ausdrücklich keine Schreiboperation ist.
 *
 * Dieser Test prüft die Regel für **jede einzelne** dieser Funktionen, nicht für eine
 * stellvertretend. Genau darum geht es: Die Fehlerklasse dieses Projekts ist „die Regel gilt für A, B,
 * C – C fehlt". Ein Test, der nur `deleteFile` prüft, hätte eine vergessene achte Stelle nie bemerkt.
 *
 * Geprüft wird das **beobachtbare Verhalten**: Nach einer Ablehnung muss der nächste Versuch ein
 * FRISCHES Token holen. Bliebe das abgelehnte liegen, wäre das eine Sackgasse, aus der nur ein
 * Neustart hülfe (#298).
 */
const COOKIE = 'ChurchTools_sid=abc';

/** Ein Ablaufpunkt, wie ChurchTools ihn liefert – reicht für die Nutzlast-Erzeugung. */
const PUNKT = { id: 1, title: 'Lied', position: 0, type: 'song' };

/** Das Lied #7 mit Arrangement #70 – `updateSong` und `updateArrangement` lesen es vor dem Schreiben. */
const LIED = {
  id: 7,
  name: 'Treu',
  category: { id: 0 },
  arrangements: [
    {
      id: 70,
      name: 'Standard',
      key: 'C',
      keyOfArrangement: 'C',
      bpm: '120',
      beat: '4/4',
      duration: 300,
      description: '',
      files: [],
    },
  ],
};

function jsonRes(data: unknown, status = 200): Response {
  return new Response(JSON.stringify({ data }), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

/**
 * **Lesen gelingt immer** – scheitern soll erst der Schreibvorgang. Einige Schreiber lesen vorher
 * (Ablauf, Lied, Arrangement); scheiterte schon das Lesen, holte niemand ein Token, und der Test
 * bewiese nichts über `schreibe`. Eine Stelle für beide Attrappen unten.
 */
function lesen(u: string, method: string): Response | null {
  if (method !== 'GET') return null;
  if (u.includes('/agenda')) return jsonRes({ items: [PUNKT] });
  if (u.includes('/api/songs/')) return jsonRes(LIED);
  return null;
}

/**
 * Beantwortet Token- und Lese-Abrufe normal, lässt aber **jeden Schreibvorgang** an einem 403
 * scheitern. Zählt dabei mit, wie oft ein Token geholt wurde.
 */
function mockMitAblehnung() {
  const zaehler = { token: 0 };
  vi.spyOn(globalThis, 'fetch').mockImplementation((url, init) => {
    const u = String(url);
    const method = init?.method ?? 'GET';
    if (u.includes('/api/csrftoken')) {
      zaehler.token++;
      return Promise.resolve(jsonRes(`token-${zaehler.token}`));
    }
    const gelesen = lesen(u, method);
    if (gelesen) return Promise.resolve(gelesen);
    return Promise.resolve(jsonRes(null, 403)); // der eigentliche Schreibvorgang
  });
  return zaehler;
}

/** Die Schreiboperationen, jede mit gültigen Argumenten. */
const SCHREIBER: Array<[string, () => Promise<void>]> = [
  ['uploadChordpro', () => uploadChordpro(COOKIE, 5, 'lied.cho', 'inhalt')],
  [
    'uploadFile',
    () => uploadFile(COOKIE, 5, { filename: 'blatt.pdf', mime: 'application/pdf', inhalt: 'x' }),
  ],
  ['reorderAgenda', () => reorderAgenda(COOKIE, 9, [1])],
  ['createAgendaItem', () => createAgendaItem(COOKIE, 9, { type: 'header', title: 'Neu' })],
  ['updateAgendaItem', () => updateAgendaItem(COOKIE, 9, 1, { title: 'Anders' })],
  ['deleteAgendaItem', () => deleteAgendaItem(COOKIE, 9, 1)],
  ['setAgendaItemVorBeginn', () => setAgendaItemVorBeginn(COOKIE, 9, 1, true)],
  ['deleteFile', () => deleteFile(COOKIE, 42)],
  [
    'createAbsence',
    async () => {
      await createAbsence(COOKIE, 5, {
        startDate: '2026-10-08',
        endDate: '2026-10-08',
        absenceReasonId: 1,
        comment: '',
      });
    },
  ],
  ['deleteAbsence', () => deleteAbsence(COOKIE, 5, 9)],
  [
    'createSong',
    async () => {
      await createSong(COOKIE, { name: 'Neu', categoryId: 1 });
    },
  ],
  [
    'updateSong',
    async () => {
      await updateSong(COOKIE, 7, { author: 'Anders' });
    },
  ],
  ['deleteSong', () => deleteSong(COOKIE, 7)],
  [
    'createArrangement',
    async () => {
      await createArrangement(COOKIE, 7, { name: 'Akustik' });
    },
  ],
  ['updateArrangement', () => updateArrangement(COOKIE, 7, 70, { tempo: 96 })],
  ['setDefaultArrangement', () => setDefaultArrangement(COOKIE, 7, 70)],
  ['deleteArrangement', () => deleteArrangement(COOKIE, 7, 70)],
  // Läuft über `updateArrangement` – steht trotzdem drin, damit ein späterer Umbau auffällt.
  ['updateArrangementTempo', () => updateArrangementTempo(COOKIE, 7, 70, 96)],
];

/**
 * Exporte von `ctWrite`, die **keine** Schreiboperation sind – jede andere Funktion gehört in
 * `SCHREIBER`. `fuerChurchTools` formt nur einen Rumpf um und schreibt selbst nichts.
 */
const KEINE_SCHREIBER = ['fuerChurchTools'];

/**
 * **Die Liste selbst wird geprüft** (07.10.2026). Zweimal fehlten hier Schreiber, die längst über
 * `schreibe` liefen (Abwesenheiten, Lieder/Arrangements) – der Test war grün, weil er nur kannte, was
 * jemand von Hand eingetragen hatte. Jetzt fällt eine neue exportierte Funktion auf, bis sie hier
 * eingeordnet ist: entweder als Schreiber mit Aufruf oder ausdrücklich als keiner.
 */
describe('SCHREIBER ist vollständig', () => {
  it('jede exportierte Funktion aus ctWrite ist eingeordnet', () => {
    const exportiert = Object.entries(ctWriteModul)
      .filter(([, wert]) => typeof wert === 'function')
      .map(([name]) => name)
      .filter((name) => !KEINE_SCHREIBER.includes(name))
      .sort();
    expect(SCHREIBER.map(([name]) => name).sort()).toEqual(exportiert);
  });
});

beforeEach(() => __resetSessionMemosForTests());
afterEach(() => vi.restoreAllMocks());

describe('Jede Schreiboperation verwirft das Token bei einer Ablehnung (#280/#298)', () => {
  it.each(SCHREIBER)('%s', async (_name, aufrufen) => {
    const z = mockMitAblehnung();

    await expect(aufrufen()).rejects.toThrow(); // 403 → Fehler, nicht stiller Erfolg
    expect(z.token).toBe(1);

    // Der zweite Versuch darf NICHT dasselbe abgelehnte Token wiederverwenden.
    await expect(aufrufen()).rejects.toThrow();
    expect(z.token).toBe(2);
  });
});

describe('Ohne Ablehnung bleibt das Token liegen – sonst spart der Speicher nichts', () => {
  it.each(SCHREIBER)('%s', async (_name, aufrufen) => {
    const zaehler = { token: 0 };
    vi.spyOn(globalThis, 'fetch').mockImplementation((url, init) => {
      const u = String(url);
      const method = init?.method ?? 'GET';
      if (u.includes('/api/csrftoken')) {
        zaehler.token++;
        return Promise.resolve(jsonRes(`token-${zaehler.token}`));
      }
      const gelesen = lesen(u, method);
      if (gelesen) return Promise.resolve(gelesen);
      // Mit ID: Die Anlege-Funktionen verlangen sie (`neueId`), die übrigen übergehen sie.
      return Promise.resolve(jsonRes({ id: 1 }, 200));
    });

    await aufrufen();
    await aufrufen();
    expect(zaehler.token).toBe(1); // beide Male dasselbe Token
  });
});

/**
 * #321, Schritt 1: `uploadChordpro` war auf ChordPro zugeschnitten (`text/plain` festverdrahtet).
 * Für die Dateiverwaltung braucht es beliebige Arten – als **gemeinsame** Funktion, nicht als zweite
 * Fassung daneben.
 *
 * Geprüft wird deshalb nicht nur, dass `uploadFile` funktioniert, sondern dass `uploadChordpro`
 * WIRKLICH darüber läuft und dabei sein Verhalten behält. Sonst stünden hinterher doch zwei
 * Fassungen da, nur eine davon getestet.
 */
describe('uploadFile – die einzige Stelle, die einen Datei-Upload zusammenbaut (#321)', () => {
  /** Fängt den Schreibvorgang ab und gibt die gesendete Datei zurück. */
  function mockUpload() {
    const gesendet: { url: string; datei: File | null } = { url: '', datei: null };
    vi.spyOn(globalThis, 'fetch').mockImplementation((url, init) => {
      const u = String(url);
      if (u.includes('/api/csrftoken')) return Promise.resolve(jsonRes('token-1'));
      gesendet.url = u;
      const body = init?.body;
      const teil = body instanceof FormData ? body.get('files[]') : null;
      gesendet.datei = teil instanceof File ? teil : null;
      return Promise.resolve(jsonRes(null, 200));
    });
    return gesendet;
  }

  it('schickt die übergebene Art mit – nicht text/plain', async () => {
    const g = mockUpload();
    await uploadFile(COOKIE, 7, {
      filename: 'Treu - E.pdf',
      mime: 'application/pdf',
      inhalt: new Uint8Array([1, 2, 3]),
    });

    expect(g.url).toContain('/api/files/song_arrangement/7');
    expect(g.datei?.name).toBe('Treu - E.pdf');
    expect(g.datei?.type).toBe('application/pdf');
    // Bytes, nicht Text: Ein PDF darf nicht als Zeichenkette verstümmelt werden.
    expect(g.datei?.size).toBe(3);
  });

  it('uploadChordpro läuft darüber und bleibt bei text/plain', async () => {
    const g = mockUpload();
    await uploadChordpro(COOKIE, 7, 'Treu — Akustik (App).chordpro', '{title: Treu}');

    expect(g.datei?.name).toBe('Treu — Akustik (App).chordpro');
    expect(g.datei?.type).toBe('text/plain');
  });

  it('meldet einen Fehlschlag, statt still zu tun als wäre gespeichert', async () => {
    // #270: Ein vorübergehender Fehler darf nicht wie Erfolg aussehen – sonst hält der Nutzer die
    // Datei für hochgeladen und sie ist nirgends.
    vi.spyOn(globalThis, 'fetch').mockImplementation((url) =>
      Promise.resolve(String(url).includes('/api/csrftoken') ? jsonRes('t') : jsonRes(null, 504)),
    );
    await expect(
      uploadFile(COOKIE, 7, { filename: 'a.pdf', mime: 'application/pdf', inhalt: 'x' }),
    ).rejects.toThrow(/Hochladen nach ChurchTools fehlgeschlagen \(504\)/);
  });

  it('die ChordPro-Meldung bleibt wortgleich, nicht die allgemeine', async () => {
    // „Speichern" ist beim Bearbeiten einer Version die richtige Handlung; „Hochladen" wäre für den
    // Nutzer etwas anderes. Die Verallgemeinerung darf den Wortlaut nicht mitverändern.
    vi.spyOn(globalThis, 'fetch').mockImplementation((url) =>
      Promise.resolve(String(url).includes('/api/csrftoken') ? jsonRes('t') : jsonRes(null, 504)),
    );
    await expect(uploadChordpro(COOKIE, 7, 'a.chordpro', 'x')).rejects.toThrow(
      /Speichern in ChurchTools fehlgeschlagen \(504\)/,
    );
  });
});

/**
 * **Der Tempo-Weg – gefunden durch eine Gegenprobe, die GRÜN blieb** (#396, 20.09.2026).
 *
 * `updateArrangementTempo` geht seit #396 durch `updateArrangement`, statt den Lese-Schreib-Zyklus
 * nachzubauen. Die Gegenprobe zu diesem Umbau – das übergebene Tempo durch einen festen Wert
 * ersetzen – ließ **alle** Tests grün: Es gab keinen, der belegt, dass der eingestellte Wert
 * überhaupt in ChurchTools ankommt. Der Endpunkt war über seine Fehlerpfade geprüft, nicht über
 * seine Wirkung.
 *
 * Geprüft wird deshalb der **gesendete Rumpf**: Das neue Tempo steht drin, und die übrigen Felder
 * stehen ebenfalls drin – ein `PUT` ersetzt den ganzen Datensatz, ein unvollständiger Rumpf löscht
 * Tonart und Dauer für das ganze Team (gemessen 08.08.2026).
 */
describe('updateArrangementTempo – der Wert kommt wirklich an', () => {
  /** Das Arrangement #70 am Lied #7, wie ChurchTools es liefert. */
  const ARR = {
    id: 70,
    name: 'Standard',
    key: 'C',
    keyOfArrangement: 'C',
    bpm: '120',
    beat: '4/4',
    duration: 300,
    description: 'Kapo 2',
    files: [],
  };

  function mockCt(): Map<string, string> {
    const ruempfe = new Map<string, string>();
    vi.spyOn(globalThis, 'fetch').mockImplementation((url, init) => {
      const u = String(url);
      const m = String(init?.method ?? 'GET');
      if (u.includes('/api/csrftoken')) return Promise.resolve(jsonRes('token'));
      if (m === 'GET') {
        return Promise.resolve(
          jsonRes({ id: 7, name: 'Treu', category: { id: 0 }, arrangements: [ARR] }),
        );
      }
      if (init?.body !== undefined) ruempfe.set(m, String(init.body));
      return Promise.resolve(jsonRes({}, 200));
    });
    return ruempfe;
  }

  it('schreibt das übergebene Tempo – nicht irgendeines', async () => {
    const ruempfe = mockCt();
    await updateArrangementTempo(COOKIE, 7, 70, 96);
    const rumpf = JSON.parse(ruempfe.get('PUT') ?? '{}') as Record<string, unknown>;
    expect(rumpf.tempo).toBe(96);
  });

  it('nimmt dabei die übrigen Felder mit – sonst löscht der PUT sie', async () => {
    const ruempfe = mockCt();
    await updateArrangementTempo(COOKIE, 7, 70, 96);
    const rumpf = JSON.parse(ruempfe.get('PUT') ?? '{}') as Record<string, unknown>;
    expect(rumpf.name).toBe('Standard');
    expect(rumpf.key).toBe('C');
    expect(rumpf.beat).toBe('4/4');
    expect(rumpf.duration).toBe(300);
    expect(rumpf.description).toBe('Kapo 2');
  });
});

/**
 * **Abwesenheiten mit Uhrzeit: die Tage gehen als Zeitpunkte hinaus** (24.09.2026). ChurchTools
 * lehnt seitdem `endDate: 2026-10-08` + `startTime: 2026-10-08T09:00:00Z` ab („'endDate' darf nicht
 * vor 'startTime' liegen"), nimmt die Tage als Zeitpunkte aber an – gemessen an der Test-Instanz.
 */
describe('createAbsence – was an ChurchTools geht', () => {
  function mockCt(): { rumpf: () => Record<string, unknown> } {
    let gesendet = '{}';
    vi.spyOn(globalThis, 'fetch').mockImplementation((url, init) => {
      if (String(url).includes('/api/csrftoken')) return Promise.resolve(jsonRes('token'));
      gesendet = String(init?.body ?? '{}');
      return Promise.resolve(jsonRes({ id: 77 }, 201));
    });
    return { rumpf: () => JSON.parse(gesendet) as Record<string, unknown> };
  }

  it('mit Uhrzeit: Anfangs- und Endtag sind die Zeitpunkte', async () => {
    const ct = mockCt();
    await createAbsence(COOKIE, 5, {
      startDate: '2026-10-08',
      endDate: '2026-10-08',
      startTime: '2026-10-08T09:00:00Z',
      endTime: '2026-10-08T12:00:00Z',
      absenceReasonId: 1,
      comment: '',
    });
    expect(ct.rumpf()).toMatchObject({
      startDate: '2026-10-08T09:00:00Z',
      endDate: '2026-10-08T12:00:00Z',
      startTime: '2026-10-08T09:00:00Z',
      endTime: '2026-10-08T12:00:00Z',
    });
  });

  it('ganztägig: die Tage bleiben reine Tage', async () => {
    const ct = mockCt();
    await createAbsence(COOKIE, 5, {
      startDate: '2026-10-08',
      endDate: '2026-10-09',
      absenceReasonId: 1,
      comment: '',
    });
    expect(ct.rumpf()).toMatchObject({ startDate: '2026-10-08', endDate: '2026-10-09' });
    expect('startTime' in ct.rumpf()).toBe(false);
  });

  it('fuerChurchTools lässt den Rumpf der App unangetastet', () => {
    const body = {
      startDate: '2026-10-08',
      endDate: '2026-10-08',
      startTime: '2026-10-08T09:00:00Z',
      endTime: '2026-10-08T12:00:00Z',
    };
    fuerChurchTools(body);
    expect(body.startDate).toBe('2026-10-08');
  });
});

/**
 * #423: Der Vorlauf wird als **Grenze** geschrieben – nur `calendarId` und `eventStartPosition`,
 * ohne `items`. Gemessen an der Test-Instanz (05.10.2026): So bleiben alle Punkte unberührt. Ginge
 * die Liste mit, würde jeder Punkt neu geschrieben, nur um eine Zahl zu ändern.
 */
describe('setAgendaItemVorBeginn – nur die Grenze, auf frischem Stand', () => {
  /** Ablauf mit drei Punkten, Grenze 1 (Punkt 10 ist Vorlauf). Merkt sich, was geschrieben wurde. */
  function mockAblauf(eventStartPosition = 1) {
    const geschrieben: { url: string; rumpf: Record<string, unknown> }[] = [];
    vi.spyOn(globalThis, 'fetch').mockImplementation((url, init) => {
      const u = String(url);
      const method = init?.method ?? 'GET';
      if (u.includes('/api/csrftoken')) return Promise.resolve(jsonRes('token'));
      if (method === 'GET' && u.includes('/agenda')) {
        return Promise.resolve(
          jsonRes({
            calendarId: 2,
            eventStartPosition,
            items: [
              { id: 10, title: 'Soundcheck', position: 0 },
              { id: 11, title: 'Begrüßung', position: 1 },
              { id: 12, title: 'Predigt', position: 2 },
            ],
          }),
        );
      }
      geschrieben.push({
        url: u,
        rumpf: JSON.parse(String(init?.body ?? '{}')) as Record<string, unknown>,
      });
      return Promise.resolve(jsonRes(null, 200));
    });
    return geschrieben;
  }

  it('schreibt nur calendarId + eventStartPosition, ohne items', async () => {
    const g = mockAblauf();
    await setAgendaItemVorBeginn(COOKIE, 9, 11, true);
    expect(g).toHaveLength(1);
    expect(g[0].url).toContain('/api/events/9/agenda');
    expect(g[0].rumpf).toEqual({ calendarId: 2, eventStartPosition: 2 });
  });

  it('rechnet mit der Position aus dem frischen Ablauf', async () => {
    const g = mockAblauf(3); // alle drei Vorlauf
    await setAgendaItemVorBeginn(COOKIE, 9, 11, false);
    expect(g[0].rumpf).toEqual({ calendarId: 2, eventStartPosition: 1 });
  });

  it('steht der Punkt schon so, wird nichts geschrieben', async () => {
    const g = mockAblauf();
    await setAgendaItemVorBeginn(COOKIE, 9, 10, true);
    expect(g).toHaveLength(0);
  });

  it('fehlt der Punkt im frischen Ablauf: 409 statt einer geratenen Grenze', async () => {
    const g = mockAblauf();
    await expect(setAgendaItemVorBeginn(COOKIE, 9, 99, true)).rejects.toMatchObject({
      status: 409,
    });
    expect(g).toHaveLength(0);
  });
});
