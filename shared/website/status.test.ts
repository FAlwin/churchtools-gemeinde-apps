import { describe, expect, it, vi } from 'vitest';
import {
  ANMERKUNG_MAX,
  istStatusWert,
  statusAusWerten,
  statusEntfernen,
  statusSetzen,
  statusWert,
  type WebsiteStatus,
} from './status';
import { einheitLoeschen, seiteSpeichern, websiteAusWerten, websiteLesen } from './speicher';
import { fakeSpeicher, fehlerMit } from './speicher.testutil';
import { seiteMit, baustein } from './website.testdaten';

const ICH = { person: 5, name: 'Rita Redakteurin', fenster: 'f1' };
const LEITUNG = { person: 1, name: 'Helene Wiebe', fenster: 'f2' };
const T1 = new Date('2026-11-20T10:00:00Z');
const T2 = new Date('2026-11-20T11:00:00Z');

async function mitSeite() {
  const s = fakeSpeicher();
  await seiteSpeichern(s.ort, seiteMit([baustein('text')], { id: 'a', pfad: 'a', titel: 'A' }), T1);
  s.neuesLog();
  return s;
}

describe('Status schreiben, lesen, entfernen', () => {
  it('einreichen: Wer und wann stehen im Wert, die Seite selbst bleibt unberührt', async () => {
    const s = await mitSeite();
    const kopfVorher = s.werte.filter((w) => w.value.includes('"website-kopf"'));
    const st = await statusSetzen(s.ort, 'a', { zustand: 'eingereicht' }, ICH, T2);
    expect(st).toEqual({
      zustand: 'eingereicht',
      von: 5,
      name: 'Rita Redakteurin',
      zeit: T2.toISOString(),
    });
    expect(s.werte.filter((w) => w.value.includes('"website-kopf"'))).toEqual(kopfVorher);
    const stand = await websiteLesen(s.port, 7, 1);
    expect(stand.status.a).toEqual(st);
    expect(stand.probleme).toEqual([]);
  });

  it('zurückgeben: Anmerkung und Einreichende stehen im Wert; ein zweiter Status ersetzt den ersten (kein zweiter Wert)', async () => {
    const s = await mitSeite();
    await statusSetzen(s.ort, 'a', { zustand: 'eingereicht' }, ICH, T1);
    const st = await statusSetzen(
      s.ort,
      'a',
      {
        zustand: 'zurueck',
        anmerkung: 'Bitte das Foto tauschen.',
        einreicher: { von: 5, name: ICH.name },
      },
      LEITUNG,
      T2,
    );
    expect(st).toMatchObject({
      zustand: 'zurueck',
      von: 1,
      anmerkung: 'Bitte das Foto tauschen.',
      einreicher: { von: 5, name: 'Rita Redakteurin' },
    });
    expect(s.werte.filter((w) => istStatusWert(w))).toHaveLength(1);
  });

  it('Löschen anfragen: eigener Zustand, die Seite bleibt, wie sie ist', async () => {
    const s = await mitSeite();
    const seiteVorher = (await websiteLesen(s.port, 7, 1)).seiten;
    await statusSetzen(s.ort, 'a', { zustand: 'loeschenAngefragt' }, ICH, T2);
    const stand = await websiteLesen(s.port, 7, 1);
    expect(stand.status.a.zustand).toBe('loeschenAngefragt');
    expect(stand.seiten).toEqual(seiteVorher);
  });

  it('eine Zurückgabe ohne Anmerkung wird nicht geschrieben (und eine zu lange auch nicht)', async () => {
    const s = await mitSeite();
    await expect(
      statusSetzen(s.ort, 'a', { zustand: 'zurueck', anmerkung: '   ' }, LEITUNG, T2),
    ).rejects.toMatchObject({ status: 422 });
    await expect(
      statusSetzen(
        s.ort,
        'a',
        { zustand: 'zurueck', anmerkung: 'x'.repeat(ANMERKUNG_MAX + 1) },
        LEITUNG,
        T2,
      ),
    ).rejects.toMatchObject({ status: 422 });
    expect(s.schreibzugriffe()).toEqual([]);
  });

  it('für eine Seite, die es nicht gibt, wird nichts geschrieben', async () => {
    const s = await mitSeite();
    await expect(
      statusSetzen(s.ort, 'weg', { zustand: 'eingereicht' }, ICH, T2),
    ).rejects.toMatchObject({
      status: 404,
    });
    expect(s.schreibzugriffe()).toEqual([]);
  });

  it('wird beim Schreiben nachgelesen: ein 201, das nichts anlegt, ist KEIN Erfolg', async () => {
    const s = await mitSeite();
    // Der Speicher „schluckt“ den Wert still (Zusage ohne Ergebnis).
    const echt = s.port.schreibe;
    s.port.schreibe = (pfad, a) => {
      if ((a.json as { value?: string } | undefined)?.value?.includes('website-status'))
        return Promise.resolve();
      return echt(pfad, a);
    };
    await expect(
      statusSetzen(s.ort, 'a', { zustand: 'eingereicht' }, ICH, T2),
    ).rejects.toMatchObject({
      status: 502,
    });
  });

  it('scheitert das Schreiben vorübergehend (503), bleibt der bisherige Status unverändert', async () => {
    const s = await mitSeite();
    const alt = await statusSetzen(s.ort, 'a', { zustand: 'eingereicht' }, ICH, T1);
    s.steuerung.ausfall = (z) => (z.art === 'PUT' ? fehlerMit(503) : undefined);
    await expect(
      statusSetzen(s.ort, 'a', { zustand: 'zurueck', anmerkung: 'x' }, LEITUNG, T2),
    ).rejects.toMatchObject({ status: 503 });
    expect((await websiteLesen(s.port, 7, 1)).status.a).toEqual(alt);
  });

  it('entfernen: danach ist die Seite wieder Entwurf; ohne Status ist es kein Fehler', async () => {
    const s = await mitSeite();
    await statusEntfernen(s.ort, 'a');
    await statusSetzen(s.ort, 'a', { zustand: 'eingereicht' }, ICH, T2);
    await statusEntfernen(s.ort, 'a');
    expect((await websiteLesen(s.port, 7, 1)).status).toEqual({});
    expect(s.werte.filter((w) => istStatusWert(w))).toHaveLength(0);
  });

  it('entfernen: bleibt der Wert trotz Zusage liegen, wird das gemeldet', async () => {
    const s = await mitSeite();
    await statusSetzen(s.ort, 'a', { zustand: 'eingereicht' }, ICH, T2);
    const echt = s.port.schreibe;
    s.port.schreibe = (pfad, a) => (a.method === 'DELETE' ? Promise.resolve() : echt(pfad, a));
    await expect(statusEntfernen(s.ort, 'a')).rejects.toMatchObject({ status: 502 });
  });
});

describe('Status beim Lesen', () => {
  it('der Status-Wert ist kein „Problem“ – wie die Sperre', async () => {
    const s = await mitSeite();
    await statusSetzen(s.ort, 'a', { zustand: 'eingereicht' }, ICH, T2);
    expect(websiteAusWerten(s.werte).probleme).toEqual([]);
  });

  it('ein Status ohne Seite wird ignoriert und beim nächsten Setzen aufgeräumt', async () => {
    const s = await mitSeite();
    const waise: WebsiteStatus = {
      art: 'website-status',
      fassung: 1,
      id: 'gibt-es-nicht',
      zustand: 'eingereicht',
      von: 5,
      name: 'X',
      zeit: T1.toISOString(),
    };
    s.lege(JSON.stringify(waise));
    expect(websiteAusWerten(s.werte).status).toEqual({});
    await statusSetzen(s.ort, 'a', { zustand: 'eingereicht' }, ICH, T2);
    expect(s.werte.some((w) => statusWert(w)?.id === 'gibt-es-nicht')).toBe(false);
    expect(s.werte.some((w) => statusWert(w)?.id === 'a')).toBe(true);
  });

  it('das Aufräumen darf scheitern – das Setzen gilt trotzdem', async () => {
    const s = await mitSeite();
    s.lege(
      JSON.stringify({
        art: 'website-status',
        fassung: 1,
        id: 'weg',
        zustand: 'eingereicht',
        von: 1,
        name: 'X',
        zeit: T1.toISOString(),
      }),
    );
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    s.steuerung.ausfall = (z) => (z.art === 'DELETE' ? fehlerMit(503) : undefined);
    await expect(
      statusSetzen(s.ort, 'a', { zustand: 'eingereicht' }, ICH, T2),
    ).resolves.toBeTruthy();
  });

  it('bei mehreren Werten für dieselbe Seite gilt der mit der kleinsten ID', () => {
    const w = (id: number, zustand: string) => ({
      id,
      dataCategoryId: 1,
      value: JSON.stringify({
        art: 'website-status',
        fassung: 1,
        id: 'a',
        zustand,
        von: 1,
        name: 'X',
        zeit: T1.toISOString(),
      }),
    });
    expect(statusAusWerten([w(9, 'zurueck'), w(3, 'eingereicht')]).a.zustand).toBe('eingereicht');
  });

  it('ein beschädigter Status-Wert gilt nicht als Status (und wird als „gehört nicht dazu“ gemeldet, nicht gelöscht)', () => {
    const kaputt = {
      id: 1,
      dataCategoryId: 1,
      value: JSON.stringify({
        art: 'website-status',
        fassung: 1,
        id: 'a',
        zustand: 'frei',
        von: 1,
        name: 'X',
        zeit: 'jetzt',
      }),
    };
    expect(istStatusWert(kaputt)).toBe(false);
    expect(websiteAusWerten([kaputt]).probleme).toHaveLength(1);
  });
});

describe('Seite löschen räumt den Status mit auf', () => {
  it('einheitLoeschen entfernt den Status der Seite – und nur ihren', async () => {
    const s = await mitSeite();
    await seiteSpeichern(
      s.ort,
      seiteMit([baustein('text')], { id: 'b', pfad: 'b', titel: 'B' }),
      T1,
    );
    await statusSetzen(s.ort, 'a', { zustand: 'eingereicht' }, ICH, T2);
    await statusSetzen(s.ort, 'b', { zustand: 'eingereicht' }, ICH, T2);
    await einheitLoeschen(s.ort, 'seite', 'a');
    expect(s.werte.some((w) => statusWert(w)?.id === 'a')).toBe(false);
    expect(s.werte.some((w) => statusWert(w)?.id === 'b')).toBe(true);
  });
});
