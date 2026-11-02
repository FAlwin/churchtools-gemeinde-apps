import { describe, expect, it } from 'vitest';
import { dateiAdresse, dateienAus, dateienAusListe, dateienSchluessel } from './terminDateien';

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
