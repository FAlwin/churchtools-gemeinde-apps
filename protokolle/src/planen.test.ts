import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { istKopf, type ProtokollKopf } from '@shared/protokolle/speicher';
import { Unklar } from '@ui/ct/fehler';
import { fehlerMeldung } from '@ui/ct/fehlerMeldung';
import { NACHSEHEN, sitzungFestlegen, UNKLAR } from './planen';
import { ladeSitzungen } from './lesen';
import { MODUL, nachbauEnde, nachbauStarten, werteVon, type Nachbau } from './nachbau.testhilfe';

/** „Nächste Sitzung festlegen“ (S5-2) gegen die nachgestellte ChurchTools-Instanz. */
let ct: Nachbau;
const KAT = 62;
const ZONE = 'Europe/Berlin';
const BEGINN = '2027-04-14T17:30:00Z';

const koepfe = (): ProtokollKopf[] =>
  werteVon(ct, KAT)
    .map((w) => JSON.parse(w.value) as unknown)
    .filter(istKopf);
const treffen = () => ct.treffen.get(194) ?? [];
const angelegt = (art: string) => ct.aufrufe.filter((a) => a.startsWith('POST') && a.includes(art));

const festlegen = (eingeladen = [1, 19]) =>
  sitzungFestlegen({
    modul: MODUL,
    kategorie: KAT,
    gruppe: 194,
    kalender: 4,
    titel: ' Leitungssitzung ',
    beginn: BEGINN,
    ende: '2027-04-14T19:30:00Z',
    eingeladen,
    zeitzone: ZONE,
    neueId: () => 'neu',
  });

beforeEach(() => {
  ct = nachbauStarten();
  ct.kategorien.push({ id: KAT, shorty: 'protokolle-g194', name: 'Protokolle · Technik' });
  werteVon(ct, KAT).push({
    id: 1,
    value: JSON.stringify({
      art: 'einstellung',
      fassung: 1,
      gruppe: 194,
      rollen: [],
      punkte: 'vorschlagen',
      kalender: 4,
    }),
  });
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});
afterEach(nachbauEnde);

describe('sitzungFestlegen', () => {
  it('Termin mit Anfragen, Gruppentreffen und geplanter Kopf – in der Liste eine Sitzung', async () => {
    const r = await festlegen();
    expect(r).toEqual({
      sitzung: 'neu',
      termin: { kalender: 4, id: expect.any(Number) as number },
      treffen: expect.any(Number) as number,
      fehlend: [],
      hinweise: [],
    });
    expect(ct.termine).toEqual([
      expect.objectContaining({
        titel: 'Leitungssitzung',
        beginn: BEGINN,
        anfragen: [
          { person: 1, state: 'accepted' },
          { person: 19, state: 'pending' },
        ],
      }),
    ]);
    expect(treffen()).toEqual([{ id: r.treffen, startDate: BEGINN }]);
    expect(koepfe()).toEqual([
      expect.objectContaining({
        sitzung: 'neu',
        status: 'geplant',
        titel: 'Leitungssitzung',
        beginn: BEGINN,
        termin: r.termin,
        treffen: r.treffen,
      }),
    ]);
    const { kommend } = await ladeSitzungen(
      MODUL,
      { id: 194, protokolle: KAT },
      ZONE,
      new Date('2027-04-01T10:00:00Z'),
    );
    expect(kommend.map((s) => [s.schluessel, s.kopf?.status, s.termin, s.treffen])).toEqual([
      ['p:neu', 'geplant', r.termin, r.treffen],
    ]);
    expect(kommend[0].anfragen).toHaveLength(2);
    // Das Ende kommt aus der Kalenderliste – daraus wird die Dauer der übernächsten Sitzung.
    expect(kommend[0].ende).toBe('2027-04-14T19:30:00Z');
  });

  it('ChurchTools lehnt den Termin ab (kein Recht): nichts weiter angelegt, kein Nachsehen', async () => {
    ct.terminFehler = { status: 403, angelegt: false, ctVerbot: true };
    await expect(festlegen()).rejects.toThrow(/keine Termine anlegen/);
    expect(angelegt('/meetings')).toEqual([]);
    expect(koepfe()).toEqual([]);
    expect(ct.terminAnfrage).toBeNull();
  });

  it('unklare Antwort, aber angelegt: wird im Kalender gefunden und weiter festgelegt – kein zweiter Termin', async () => {
    ct.terminFehler = { status: 504, angelegt: true };
    const r = await festlegen();
    expect(ct.termine).toHaveLength(1);
    expect(r.termin.id).toBe(ct.termine[0].id);
    expect(r.hinweise).toEqual([]);
    expect(koepfe()).toHaveLength(1);
  });

  it('unklare Antwort und nicht da: „bitte nachsehen“ statt „noch einmal versuchen“, nichts weiter', async () => {
    ct.terminFehler = { status: 504, angelegt: false };
    const e: unknown = await festlegen().catch((x: unknown) => x);
    expect(e).toBeInstanceOf(Unklar);
    // So erscheint es im Fenster – nicht „versuch es gleich noch einmal“.
    expect(fehlerMeldung(e)).toEqual({ text: UNKLAR, nochmal: false });
    expect(angelegt('/meetings')).toEqual([]);
    expect(koepfe()).toEqual([]);
  });

  it('ein 403 ohne ChurchTools-Rumpf (Proxy) ist unklar, nicht abgelehnt – es wird nachgesehen', async () => {
    ct.terminFehler = { status: 403, angelegt: true };
    expect((await festlegen()).termin.id).toBe(ct.termine[0].id);
  });

  it('Termin angelegt, aber nicht nachzulesen: „im Kalender nachsehen“, kein Treffen, kein Kopf', async () => {
    ct.terminLesenFehler = true;
    expect(fehlerMeldung(await festlegen().catch((x: unknown) => x))).toEqual({
      text: NACHSEHEN,
      nochmal: false,
    });
    expect(ct.termine).toHaveLength(1);
    expect(angelegt('/meetings')).toEqual([]);
    expect(koepfe()).toEqual([]);
  });

  it('nimmt ChurchTools eine Einladung nicht an, wird sie gemeldet', async () => {
    ct.anfrageVerschluckt.add(19);
    expect((await festlegen()).fehlend).toEqual([19]);
  });

  it('ohne Einladung: kein Nachlesen der Anfragen, nichts fehlt', async () => {
    const r = await festlegen([]);
    expect(r.fehlend).toEqual([]);
    expect(ct.aufrufe.some((a) => a.endsWith('/meetingrequests'))).toBe(false);
  });

  it('kein Recht auf Gruppentreffen: Termin und Kopf stehen, Hinweis statt Fehler (nie zurückrollen)', async () => {
    ct.treffenFehler = { status: 403, angelegt: false, ctVerbot: true };
    const r = await festlegen();
    expect(r.treffen).toBeNull();
    expect(r.hinweise).toEqual([expect.stringMatching(/Recht.*Gruppentreffen/)]);
    expect(ct.termine).toHaveLength(1);
    expect(ct.aufrufe.some((a) => a.startsWith('DELETE'))).toBe(false);
    expect(koepfe()[0]).toMatchObject({ status: 'geplant', treffen: null, termin: r.termin });
  });

  it('Treffen mit unklarer Antwort, aber angelegt: beim Nachlesen gefunden, kein Hinweis', async () => {
    ct.treffenFehler = { status: 502, angelegt: true };
    const r = await festlegen();
    expect(r.treffen).toBe(treffen()[0].id);
    expect(r.hinweise).toEqual([]);
  });

  it('Treffen scheitert vorübergehend: Hinweis „nachtragen“, nicht „Recht fehlt“', async () => {
    ct.treffenFehler = { status: 502, angelegt: false };
    const r = await festlegen();
    expect(r.treffen).toBeNull();
    expect(r.hinweise).toEqual([expect.stringMatching(/nicht geantwortet/)]);
  });

  it('der Kopf wird nicht übernommen: Hinweis, Sitzung ohne ID – der Termin bleibt', async () => {
    ct.schluckeWert = (v) => v.includes('"status":"geplant"');
    const r = await festlegen();
    expect(r.sitzung).toBeNull();
    expect(r.hinweise).toEqual([expect.stringMatching(/noch nicht vermerkt/)]);
    expect(ct.termine).toHaveLength(1);
    expect(ct.aufrufe.some((a) => a.startsWith('DELETE'))).toBe(false);
  });
});
