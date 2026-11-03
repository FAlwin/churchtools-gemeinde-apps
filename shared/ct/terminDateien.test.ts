import { describe, expect, it } from 'vitest';
import {
  DATEI_MAX_BYTES,
  DATEI_NICHT_ANGEKOMMEN,
  dateiAdresse,
  dateienAus,
  dateienAusListe,
  dateienSchluessel,
  dateiHochladen,
  dateiLoeschen,
  dateiUmbenennen,
  linkAdresse,
  linkAnhaengen,
  pruefeTerminDatei,
  type TerminDatei,
  type TerminDateienPort,
} from './terminDateien';
import type { SchreibAuftrag } from './schreibKern';

const BASIS = 'https://test-ecg-donrath.church.tools';
const DOWNLOAD = `${BASIS}/?q=public/filedownload&id=1554&filename=d3751d33f9cd5049c4af2b462735457e4d3baf130bcbb87f389e349fbaeb20b9`;

/** `eventFiles` aus `GET /events…`, gemessen 02.11.2026 an Termin 166 (gekürzt um `apiUrl`, `icon` …). */
const EVENT_FILES = [
  {
    title: 'Probe Ä.txt',
    domainType: 'file',
    domainIdentifier: '1554',
    apiUrl: `${BASIS}/api/files/service/1554`,
    frontendUrl: DOWNLOAD,
    imageUrl: null,
    icon: 'file',
  },
  {
    title: 'Probe-Link',
    domainType: 'link',
    domainIdentifier: '1557',
    apiUrl: `${BASIS}/api/files/service/1557`,
    frontendUrl: 'https://example.org/x',
    imageUrl: null,
    icon: 'file',
  },
];

/** `data` aus `GET /files/service/166`, gemessen 02.11.2026 (gekürzt um `meta` …). */
const FILES = [
  {
    id: 1554,
    domainType: 'service',
    domainId: '166',
    name: 'Probe Ä.txt',
    fileUrl: DOWNLOAD,
    type: 'file',
    size: 5,
  },
  {
    id: 1557,
    domainType: 'service',
    domainId: '166',
    name: 'Probe-Link',
    fileUrl: 'https://example.org/x',
    type: 'link',
    size: null,
  },
];

describe('dateienAus (Terminliste, `eventFiles`)', () => {
  it('Dateien und Links wie gemessen – ID aus dem Text, ohne Größe', () => {
    expect(dateienAus({ eventFiles: EVENT_FILES })).toEqual([
      { id: 1554, name: 'Probe Ä.txt', art: 'datei', url: DOWNLOAD, groesse: null },
      { id: 1557, name: 'Probe-Link', art: 'link', url: 'https://example.org/x', groesse: null },
    ]);
  });

  it('ohne ID oder Adresse kein Eintrag; fehlt der Name, steht die Adresse da', () => {
    expect(
      dateienAus({
        eventFiles: [
          { title: 'ohne ID', domainType: 'file', frontendUrl: DOWNLOAD },
          { title: 'ohne Adresse', domainType: 'file', domainIdentifier: '9' },
          { title: 'kaputte ID', domainType: 'file', domainIdentifier: 'x', frontendUrl: DOWNLOAD },
          { domainType: 'link', domainIdentifier: '3', frontendUrl: 'https://example.org/z' },
        ],
      }),
    ).toEqual([
      {
        id: 3,
        name: 'https://example.org/z',
        art: 'link',
        url: 'https://example.org/z',
        groesse: null,
      },
    ]);
  });

  it('nichts geliefert → leer', () => {
    expect(dateienAus({})).toEqual([]);
    expect(dateienAus(null)).toEqual([]);
    expect(dateienAus({ eventFiles: 'x' })).toEqual([]);
  });
});

describe('dateienAusListe (`GET /files/service/{id}`)', () => {
  it('mit Größe; Links ohne', () => {
    expect(dateienAusListe(FILES)).toEqual([
      { id: 1554, name: 'Probe Ä.txt', art: 'datei', url: DOWNLOAD, groesse: 5 },
      { id: 1557, name: 'Probe-Link', art: 'link', url: 'https://example.org/x', groesse: null },
    ]);
  });

  it('Größe auch als Text, 0 bleibt 0, Unlesbares ist unbekannt', () => {
    const mit = (size: unknown) => dateienAusListe([{ ...FILES[0], size }])[0].groesse;
    expect(mit('2048')).toBe(2048);
    expect(mit(0)).toBe(0);
    expect(mit('viel')).toBeNull();
    expect(mit(undefined)).toBeNull();
  });

  it('kein Array → leer', () => {
    expect(dateienAusListe(null)).toEqual([]);
  });

  it('wann und von wem angehängt – wie gemessen in `meta`; ohne Datum nichts, ohne Person nur das Datum', () => {
    const meta = {
      createdDate: '2026-11-02T21:28:45Z',
      createdPerson: { title: 'Alwin Friesen', domainType: 'person', domainIdentifier: '1' },
    };
    expect(dateienAusListe([{ ...FILES[0], meta }])[0].angelegt).toEqual({
      am: '2026-11-02T21:28:45Z',
      von: 'Alwin Friesen',
    });
    expect(
      dateienAusListe([
        { ...FILES[0], meta: { createdDate: '2026-11-02T21:28:45Z', createdPerson: { id: -5 } } },
      ])[0].angelegt,
    ).toEqual({ am: '2026-11-02T21:28:45Z', von: null });
    expect(dateienAusListe([FILES[0]])[0]).not.toHaveProperty('angelegt');
  });
});

describe('dateiAdresse – wohin ein Tipp führt', () => {
  const [datei, link] = dateienAus({ eventFiles: EVENT_FILES });
  it('Datei der eigenen Instanz und http(s)-Link: ja', () => {
    expect(dateiAdresse(datei, BASIS)).toBe(DOWNLOAD);
    expect(dateiAdresse(link, BASIS)).toBe('https://example.org/x');
    expect(dateiAdresse({ ...link, url: 'http://example.org/' }, BASIS)).toBe(
      'http://example.org/',
    );
  });
  it('Datei auf fremdem Host (die Sitzung ginge mit) und Link ohne http(s): nein', () => {
    expect(
      dateiAdresse({ ...datei, url: 'https://boese.example/?q=public/filedownload' }, BASIS),
    ).toBeNull();
    // Ähnlich klingender Host – nur `${basis}/` zählt.
    expect(dateiAdresse({ ...datei, url: `${BASIS}.boese.example/x` }, BASIS)).toBeNull();
    expect(dateiAdresse({ ...link, url: 'javascript:alert(1)' }, BASIS)).toBeNull();
    expect(dateiAdresse({ ...link, url: 'example.org/y' }, BASIS)).toBeNull();
  });
});

describe('dateienSchluessel', () => {
  it('ändert sich bei neuer, fehlender oder umbenannter Datei – nicht bei anderer Größe', () => {
    const a = dateienAusListe(FILES);
    const s = dateienSchluessel(a);
    expect(dateienSchluessel(dateienAus({ eventFiles: EVENT_FILES }))).toBe(s);
    expect(dateienSchluessel(a.slice(1))).not.toBe(s);
    expect(dateienSchluessel([{ ...a[0], name: 'neu.txt' }, a[1]])).not.toBe(s);
  });
});

// ── Ändern (T2b) ─────────────────────────────────────────────────────────────

class Fehler extends Error {
  constructor(
    readonly status: number,
    meldung: string,
  ) {
    super(meldung);
  }
}

/**
 * ChurchTools nachgebaut wie gemessen (02.11.2026): Hochladen/Link legen eine Datei mit neuer ID an, `PATCH` benennt
 * um, `DELETE` löscht – eine schon gelöschte Datei gibt 404. Schalter für die Fälle, die es zu prüfen gilt.
 */
class CtDateien implements TerminDateienPort {
  dateien: TerminDatei[] = [];
  naechsteId = 100;
  hochgeladen: { name: string; groesse: number }[] = [];
  schreiben: { pfad: string; auftrag: SchreibAuftrag }[] = [];
  /** Erfolg melden, aber nichts übernehmen. */
  stumm = false;
  /** Übernehmen, aber danach mit diesem Fehler antworten (Zeitüberschreitung nach dem Hochladen). */
  danachFehler: Error | null = null;
  /** Nicht übernehmen und mit diesem Fehler antworten. */
  fehlerStatt: Error | null = null;
  /** Lesen scheitert ab jetzt. */
  lesenKaputt = false;

  liste(): Promise<TerminDatei[]> {
    if (this.lesenKaputt) return Promise.reject(new Fehler(503, 'weg'));
    return Promise.resolve(this.dateien.map((d) => ({ ...d, groesse: d.groesse })));
  }
  private ausfuehren(tun: () => void): Promise<unknown> {
    if (this.fehlerStatt) return Promise.reject(this.fehlerStatt);
    if (!this.stumm) tun();
    return this.danachFehler ? Promise.reject(this.danachFehler) : Promise.resolve(null);
  }
  hochladen(
    _eventId: number,
    datei: { name: string; inhalt: Blob },
    fortschritt: (anteil: number) => void,
  ): Promise<unknown> {
    this.hochgeladen.push({ name: datei.name, groesse: datei.inhalt.size });
    fortschritt(0.5);
    fortschritt(1);
    return this.ausfuehren(() =>
      this.dateien.push({
        id: this.naechsteId++,
        name: datei.name,
        art: 'datei',
        url: `${BASIS}/?q=public/filedownload&id=${this.naechsteId}`,
        groesse: datei.inhalt.size,
      }),
    );
  }
  schreibe(pfad: string, auftrag: SchreibAuftrag): Promise<unknown> {
    this.schreiben.push({ pfad, auftrag });
    const json = auftrag.json as { name?: string; url?: string } | undefined;
    const id = Number(/^\/files\/(\d+)$/.exec(pfad)?.[1]);
    if (auftrag.method === 'POST') {
      return this.ausfuehren(() =>
        this.dateien.push({
          id: this.naechsteId++,
          name: json!.name!,
          art: 'link',
          url: json!.url!,
          groesse: null,
        }),
      );
    }
    if (!this.dateien.some((d) => d.id === id)) {
      if (auftrag.okBei404) return Promise.resolve(null);
      return Promise.reject(new Fehler(404, 'Objekt FileEntity nicht gefunden.'));
    }
    if (auftrag.method === 'PATCH') {
      return this.ausfuehren(() => {
        this.dateien = this.dateien.map((d) => (d.id === id ? { ...d, name: json!.name! } : d));
      });
    }
    return this.ausfuehren(() => {
      this.dateien = this.dateien.filter((d) => d.id !== id);
    });
  }
  fehler(status: number, meldung: string): Error {
    return new Fehler(status, meldung);
  }
}

const blob = (bytes: number) => new Blob([new Uint8Array(bytes)]);
const PDF: TerminDatei = {
  id: 7,
  name: 'Folien.pdf',
  art: 'datei',
  url: `${BASIS}/?q=public/filedownload&id=7`,
  groesse: 10,
};
const LINK: TerminDatei = {
  id: 8,
  name: 'Liedtexte',
  art: 'link',
  url: 'https://example.org/x',
  groesse: null,
};

describe('pruefeTerminDatei – vor der Übertragung (128 MiB, gemessen)', () => {
  it('genau 128 MiB geht, ein Byte mehr nicht; leer geht nicht', () => {
    expect(pruefeTerminDatei({ name: 'v.mp4', size: DATEI_MAX_BYTES }, [])).toBeNull();
    expect(pruefeTerminDatei({ name: 'v.mp4', size: DATEI_MAX_BYTES + 1 }, [])).toEqual({
      art: 'fehler',
      text: '„v.mp4" ist zu groß. Erlaubt sind bis zu 128 MB.',
    });
    expect(pruefeTerminDatei({ name: 'v.mp4', size: 0 }, [])?.art).toBe('fehler');
  });
  it('gleicher Name einer Datei warnt – ein gleichnamiger Link nicht', () => {
    expect(pruefeTerminDatei({ name: 'Folien.pdf', size: 1 }, [PDF])?.art).toBe('warnung');
    expect(pruefeTerminDatei({ name: 'Liedtexte', size: 1 }, [LINK])).toBeNull();
  });
});

describe('dateiHochladen', () => {
  it('lädt hoch, meldet Fortschritt und liefert die nachgelesene Liste', async () => {
    const ct = new CtDateien();
    ct.dateien = [PDF];
    const anteile: number[] = [];
    const nachher = await dateiHochladen(
      ct,
      160,
      { name: 'Plakat.png', size: 3, inhalt: blob(3) },
      (a) => anteile.push(a),
    );
    expect(nachher.map((d) => d.name)).toEqual(['Folien.pdf', 'Plakat.png']);
    expect(anteile).toEqual([0.5, 1]);
  });

  it('der Name wird wie in der Musik-App gereinigt (kein Pfadtrenner)', async () => {
    const ct = new CtDateien();
    await dateiHochladen(ct, 160, { name: '../a/b:c.pdf', size: 1, inhalt: blob(1) });
    expect(ct.hochgeladen[0].name).toBe('..abc.pdf');
  });

  it('zu groß oder leer: Fehler 400 ohne Übertragung', async () => {
    const ct = new CtDateien();
    await expect(
      dateiHochladen(ct, 160, { name: 'v.mp4', size: DATEI_MAX_BYTES + 1, inhalt: blob(1) }),
    ).rejects.toMatchObject({ status: 400, message: expect.stringMatching(/128 MB/) });
    await expect(
      dateiHochladen(ct, 160, { name: 'leer.txt', size: 0, inhalt: blob(0) }),
    ).rejects.toMatchObject({ status: 400 });
    expect(ct.hochgeladen).toHaveLength(0);
  });

  it('Erfolg gemeldet, aber nichts da → 502 „nicht übernommen“', async () => {
    const ct = new CtDateien();
    ct.stumm = true;
    await expect(
      dateiHochladen(ct, 160, { name: 'a.pdf', size: 1, inhalt: blob(1) }),
    ).rejects.toMatchObject({ status: 502, message: DATEI_NICHT_ANGEKOMMEN });
  });

  it('Zeitüberschreitung, die Datei ist aber angekommen → Erfolg (nicht zum zweiten Hochladen einladen)', async () => {
    const ct = new CtDateien();
    ct.danachFehler = new Fehler(504, 'Zeitüberschreitung');
    const nachher = await dateiHochladen(ct, 160, { name: 'a.pdf', size: 1, inhalt: blob(1) });
    expect(nachher.map((d) => d.name)).toEqual(['a.pdf']);
  });

  it('Fehler und nichts angekommen → der ursprüngliche Fehler; eine gleichnamige ALTE Datei zählt nicht', async () => {
    const ct = new CtDateien();
    ct.dateien = [{ ...PDF, name: 'a.pdf' }];
    ct.fehlerStatt = new Fehler(504, 'Zeitüberschreitung');
    await expect(
      dateiHochladen(ct, 160, { name: 'a.pdf', size: 1, inhalt: blob(1) }),
    ).rejects.toMatchObject({ status: 504 });
  });

  it('Fehler und auch das Nachlesen scheitert → der ursprüngliche Fehler', async () => {
    const ct = new CtDateien();
    ct.fehlerStatt = new Fehler(403, 'kein Recht');
    const hochladen = ct.hochladen.bind(ct);
    ct.hochladen = (...a) => {
      ct.lesenKaputt = true;
      return hochladen(...a);
    };
    await expect(
      dateiHochladen(ct, 160, { name: 'a.pdf', size: 1, inhalt: blob(1) }),
    ).rejects.toMatchObject({ status: 403 });
  });
});

describe('linkAnhaengen', () => {
  it('nur vollständige http(s)-Adressen bis 255 Zeichen – wie ChurchTools prüft', () => {
    expect(linkAdresse(' https://example.org/a ')).toBe('https://example.org/a');
    expect(linkAdresse('http://x.de')).toBe('http://x.de');
    expect(linkAdresse('example.org/y')).toBeNull();
    expect(linkAdresse('javascript:alert(1)')).toBeNull();
    expect(linkAdresse('https://')).toBeNull();
    expect(linkAdresse(`https://example.org/${'a'.repeat(235)}`)).toHaveLength(255);
    expect(linkAdresse(`https://example.org/${'a'.repeat(236)}`)).toBeNull();
  });

  it('hängt an und liest nach; ohne Namen ist die Adresse der Name', async () => {
    const ct = new CtDateien();
    const nachher = await linkAnhaengen(ct, 160, { name: ' ', url: 'https://example.org/l' });
    expect(ct.schreiben[0]).toMatchObject({
      pfad: '/files/service/160/link',
      auftrag: {
        method: 'POST',
        json: { name: 'https://example.org/l', url: 'https://example.org/l' },
      },
    });
    expect(nachher).toMatchObject([{ art: 'link', url: 'https://example.org/l' }]);
  });

  it('ungültige Adresse: 400, nichts geschrieben', async () => {
    const ct = new CtDateien();
    await expect(linkAnhaengen(ct, 160, { name: 'x', url: 'example.org' })).rejects.toMatchObject({
      status: 400,
    });
    expect(ct.schreiben).toHaveLength(0);
  });

  it('gemeldet, aber nicht da → 502', async () => {
    const ct = new CtDateien();
    ct.stumm = true;
    await expect(
      linkAnhaengen(ct, 160, { name: 'x', url: 'https://example.org/' }),
    ).rejects.toMatchObject({ status: 502 });
  });
});

describe('dateiUmbenennen', () => {
  it('Datei: die Endung bleibt, auch wenn man sie wegtippt oder mittippt', async () => {
    const ct = new CtDateien();
    ct.dateien = [PDF];
    await dateiUmbenennen(ct, 160, 7, 'Predigt');
    expect(ct.dateien[0].name).toBe('Predigt.pdf');
    await dateiUmbenennen(ct, 160, 7, 'Predigt neu.pdf');
    expect(ct.dateien[0].name).toBe('Predigt neu.pdf');
    expect(ct.schreiben[0]).toMatchObject({
      pfad: '/files/7',
      auftrag: { method: 'PATCH', json: { name: 'Predigt.pdf' } },
    });
  });

  it('Link: ohne Endung, nur getrimmt', async () => {
    const ct = new CtDateien();
    ct.dateien = [LINK];
    await dateiUmbenennen(ct, 160, 8, '  Texte  ');
    expect(ct.dateien[0].name).toBe('Texte');
  });

  it('gleicher Name: nichts geschrieben; leer: 400; schon vergeben: 409; nicht (mehr) da: 404', async () => {
    const ct = new CtDateien();
    ct.dateien = [PDF, { ...PDF, id: 9, name: 'Andere.pdf' }];
    await dateiUmbenennen(ct, 160, 7, 'Folien');
    expect(ct.schreiben).toHaveLength(0);
    await expect(dateiUmbenennen(ct, 160, 7, ' ')).rejects.toMatchObject({ status: 400 });
    await expect(dateiUmbenennen(ct, 160, 7, 'Andere')).rejects.toMatchObject({ status: 409 });
    await expect(dateiUmbenennen(ct, 160, 99, 'x')).rejects.toMatchObject({ status: 404 });
    expect(ct.schreiben).toHaveLength(0);
  });

  it('gemeldet, aber alter Name noch da → 502', async () => {
    const ct = new CtDateien();
    ct.dateien = [PDF];
    ct.stumm = true;
    await expect(dateiUmbenennen(ct, 160, 7, 'Neu')).rejects.toMatchObject({ status: 502 });
  });
});

describe('dateiLoeschen', () => {
  it('löscht und liest nach – „schon weg“ (404) ist kein Fehler', async () => {
    const ct = new CtDateien();
    ct.dateien = [PDF, LINK];
    expect(await dateiLoeschen(ct, 160, 7)).toEqual([LINK]);
    expect(ct.schreiben[0]).toMatchObject({
      pfad: '/files/7',
      auftrag: { method: 'DELETE', okBei404: true },
    });
  });

  it('gehört nicht (mehr) zum Termin: nichts geschrieben', async () => {
    const ct = new CtDateien();
    ct.dateien = [LINK];
    expect(await dateiLoeschen(ct, 160, 7)).toEqual([LINK]);
    expect(ct.schreiben).toHaveLength(0);
  });

  it('gemeldet, aber noch da → 502', async () => {
    const ct = new CtDateien();
    ct.dateien = [PDF];
    ct.stumm = true;
    await expect(dateiLoeschen(ct, 160, 7)).rejects.toMatchObject({ status: 502 });
  });
});
