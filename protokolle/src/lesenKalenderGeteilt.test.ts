import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BLOCKNOTE_DOKUMENT } from '@shared/protokolle/dokument.testdaten';
import { teileBauen, type ProtokollKopf } from '@shared/protokolle/speicher';
import { gruppeEinrichten } from './einrichten';
import {
  koepfeAus,
  ladeSitzungen,
  ladeUebersicht,
  sitzungenNochOhneProtokoll,
  sitzungenOhneProtokoll,
} from './lesen';
import {
  kategorieVon,
  LEITER,
  MODUL,
  nachbauEnde,
  nachbauStarten,
  TEILNEHMER,
  werteVon,
  type Nachbau,
} from './nachbau.testhilfe';

/**
 * W4 „Das Gruppentreffen entscheidet“ – mehrere Gruppen teilen einen Kalender (live: Technik, Bildtechnik, Kamera …).
 * Gegen die nachgestellte ChurchTools-Instanz; Technik = 194 (die Gruppe, die liest), Bildtechnik = 195 (die andere).
 */
let ct: Nachbau;
const JETZT = new Date('2026-11-17T10:00:00Z'); // Di 17.11.2026
const ZONE = 'Europe/Berlin';
const ZEITRAUM = { von: '2026-11-01', bis: '2026-11-16' };

const einrichten = (id: number, name: string, kalender: number | null) =>
  gruppeEinrichten(
    MODUL,
    { id, name, versteckt: false },
    {
      rollen: [
        { rolle: LEITER, stufe: 'leitung' },
        { rolle: TEILNEHMER, stufe: 'mitglied' },
      ],
      punkte: 'vorschlagen',
      kalender,
    },
  );
const gruppe = (id: number) => ({
  id,
  protokolle: kategorieVon(ct, `protokolle-g${id}`),
  mitarbeit: kategorieVon(ct, `mitarbeit-g${id}`),
});
const protokollAblegen = (id: number, teil: Partial<ProtokollKopf> & { sitzung: string }) => {
  const { stand, werte } = teileBauen(BLOCKNOTE_DOKUMENT, teil.sitzung);
  const kopf: ProtokollKopf = {
    art: 'protokoll',
    fassung: 1,
    titel: 'Techniker Treffen',
    status: 'entwurf',
    beginn: KOMMEND,
    termin: null,
    treffen: null,
    freigabe: null,
    sperre: null,
    stand,
    ...teil,
  };
  const liste = werteVon(ct, gruppe(id).protokolle);
  for (const v of [JSON.stringify(kopf), ...werte]) liste.push({ id: ct.naechste++, value: v });
};
const anfragen = [{ person: 1, state: 'accepted' }];
const KOMMEND = '2026-11-24T18:00:00Z';
const KOMMEND2 = '2026-12-01T18:00:00Z';
const VORBEI = '2026-11-10T18:00:00Z';
const termin = (id: number, beginn: string) => ({
  kalender: 4,
  id,
  titel: 'Techniker Treffen',
  beginn,
  anfragen,
});
const kommend = async (id = 194) =>
  (await ladeSitzungen(MODUL, gruppe(id), ZONE, JETZT)).kommend.map(
    (s) => s.termin?.id ?? `treffen:${s.treffen}`,
  );
const nachtragen = async (id = 194) =>
  (
    await sitzungenOhneProtokoll({
      modul: MODUL,
      gruppe: id,
      kalender: 4,
      koepfe: [],
      zeitraum: ZEITRAUM,
      zeitzone: ZONE,
    })
  ).sitzungen.map((s) => s.termin?.id ?? `treffen:${s.treffen}`);
/** Alles, was ChurchTools über die andere Gruppe (195) gefragt wurde. */
const nachGruppe195 = () =>
  ct.aufrufe.filter(
    (a) =>
      a.includes('/groups/195/') || a.includes(`/customdatacategories/${gruppe(195).protokolle}/`),
  );

beforeEach(async () => {
  ct = nachbauStarten();
  await einrichten(194, 'Technik', 4);
  await einrichten(195, 'Bildtechnik', 4);
  ct.aufrufe.length = 0;
});
afterEach(nachbauEnde);

describe('ladeSitzungen – „Kommend“', () => {
  it('Regel 1: ein Termin, zu dem nur Bildtechnik ein Gruppentreffen hat, fehlt bei Technik – die anderen bleiben', async () => {
    ct.termine = [termin(114, KOMMEND), termin(115, KOMMEND2)];
    ct.treffen.set(195, [{ id: 61, startDate: KOMMEND }]);
    expect(await kommend()).toEqual([115]);
    // … und bei Bildtechnik steht er (mit dem eigenen Treffen) weiter da.
    expect(await kommend(195)).toEqual([114, 115]);
  });

  it('Regel 2: ein Protokoll-Kopf von Bildtechnik zu diesem Termin blendet ihn bei Technik aus', async () => {
    ct.termine = [termin(114, KOMMEND), termin(115, KOMMEND2)];
    protokollAblegen(195, { sitzung: 'b', termin: { kalender: 4, id: 114 }, beginn: KOMMEND });
    expect(await kommend()).toEqual([115]);
  });

  it('Regel 3: hat Technik selbst Treffen oder Kopf, bleibt der Termin – auch wenn Bildtechnik ebenfalls eins hat', async () => {
    ct.termine = [termin(114, KOMMEND), termin(115, KOMMEND2)];
    ct.treffen.set(194, [{ id: 31, startDate: KOMMEND }]);
    ct.treffen.set(195, [
      { id: 61, startDate: KOMMEND },
      { id: 62, startDate: KOMMEND2 },
    ]);
    protokollAblegen(194, { sitzung: 't', termin: { kalender: 4, id: 115 }, beginn: KOMMEND2 });
    protokollAblegen(195, { sitzung: 'b', termin: { kalender: 4, id: 115 }, beginn: KOMMEND2 });
    expect(await kommend()).toEqual([114, 115]);
  });

  it('Regel 4: ein eigenes Gruppentreffen ohne Termin bleibt immer', async () => {
    ct.treffen.set(194, [{ id: 31, startDate: KOMMEND }]);
    ct.treffen.set(195, [{ id: 61, startDate: KOMMEND }]);
    expect(await kommend()).toEqual(['treffen:31']);
  });

  it('eine Gruppe mit anderem Kalender oder ohne Einrichtung nimmt Technik nichts weg', async () => {
    await einrichten(196, 'Kamera', 9);
    ct.termine = [termin(114, KOMMEND)];
    ct.treffen.set(196, [{ id: 71, startDate: KOMMEND }]);
    // Eine Kategorie ohne Einstellung (nicht eingerichtet) zählt ebenfalls nicht.
    ct.kategorien.push({ id: ct.naechste++, shorty: 'protokolle-g197', name: 'Protokolle · Alt' });
    expect(await kommend()).toEqual([114]);
  });

  it('Regel 5, kein Recht (403 auf die Gruppentreffen der anderen Gruppe): der Termin bleibt, es wird gewarnt', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    ct.termine = [termin(114, KOMMEND)];
    ct.treffen.set(195, [{ id: 61, startDate: KOMMEND }]);
    ct.treffenVerbotenFuer.add(195);
    expect(await kommend()).toEqual([114]);
    expect(warn).toHaveBeenCalledTimes(1);
    expect(String(warn.mock.calls[0][0])).toMatch(/nicht lesbar/);
  });

  it('Regel 5, kein Recht auf die Kategorie der anderen Gruppe: der Termin bleibt', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    ct.termine = [termin(114, KOMMEND)];
    ct.treffen.set(195, [{ id: 61, startDate: KOMMEND }]);
    ct.werteVerbotenFuer.add(gruppe(195).protokolle);
    expect(await kommend()).toEqual([114]);
    expect(warn).toHaveBeenCalledTimes(1);
    expect(String(warn.mock.calls[0][0])).toMatch(/kein Recht/);
  });

  it('Regel 5, vorübergehender Fehler (502) bei den Treffen: der Termin bleibt UND die Liste lädt', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    ct.termine = [termin(114, KOMMEND), termin(115, KOMMEND2)];
    ct.treffen.set(195, [{ id: 61, startDate: KOMMEND }]);
    ct.treffenLesenFehlerFuer.set(195, 502);
    expect(await kommend()).toEqual([114, 115]);
    expect(String(warn.mock.calls[0][0])).toMatch(/Status 502/);
  });

  it('Regel 5, vorübergehender Fehler (502) bei der Kategorie: der Termin bleibt UND die Liste lädt', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    ct.termine = [termin(114, KOMMEND)];
    ct.treffen.set(195, [{ id: 61, startDate: KOMMEND }]);
    ct.werteLesenFehlerFuer.set(gruppe(195).protokolle, 502);
    expect(await kommend()).toEqual([114]);
    expect(String(warn.mock.calls[0][0])).toMatch(/Status 502/);
  });

  it('Regel 5, vorübergehender Fehler (502) bei der Liste der Kategorien: der Termin bleibt UND die Liste lädt', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    ct.termine = [termin(114, KOMMEND)];
    ct.treffen.set(195, [{ id: 61, startDate: KOMMEND }]);
    // Die eigene Gruppe ist schon gelesen (`kommend` liest die Kategorie-Werte, nicht die Liste) – nur die Liste scheitert.
    ct.kategorienLesenFehler = 502;
    expect(await kommend()).toEqual([114]);
    expect(String(warn.mock.calls[0][0])).toMatch(/Status 502/);
  });

  it('eine unlesbare andere Gruppe verdirbt die lesbare nicht', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    await einrichten(196, 'Kamera', 4);
    ct.termine = [termin(114, KOMMEND), termin(115, KOMMEND2)];
    ct.treffen.set(196, [{ id: 71, startDate: KOMMEND2 }]);
    ct.treffenLesenFehlerFuer.set(195, 502);
    expect(await kommend()).toEqual([114]);
  });

  it('keine Zusatzabrufe, wenn nichts zu prüfen ist (kein Termin / alle Termine mit eigenem Treffen oder Kopf / kein Kalender)', async () => {
    // Kein Termin.
    await kommend();
    expect(nachGruppe195()).toEqual([]);
    // Alle Termine haben bei Technik selbst etwas.
    ct.termine = [termin(114, KOMMEND), termin(115, KOMMEND2)];
    ct.treffen.set(194, [{ id: 31, startDate: KOMMEND }]);
    protokollAblegen(194, { sitzung: 't', termin: { kalender: 4, id: 115 }, beginn: KOMMEND2 });
    ct.aufrufe.length = 0;
    expect(await kommend()).toEqual([114, 115]);
    expect(nachGruppe195()).toEqual([]);
    expect(ct.aufrufe.some((a) => a.endsWith('/customdatacategories'))).toBe(false);
  });

  it('ohne Kalender: keine Termine, keine Zusatzabrufe', async () => {
    await einrichten(194, 'Technik', null);
    ct.aufrufe.length = 0;
    await kommend();
    expect(nachGruppe195()).toEqual([]);
  });

  it('wird nur gefragt, wenn es etwas zu prüfen gibt – und dann je andere Gruppe einmal', async () => {
    ct.termine = [termin(114, KOMMEND)];
    await kommend();
    expect(nachGruppe195().filter((a) => a.includes('/meetings'))).toHaveLength(1);
  });
});

describe('ladeUebersicht – Startseite und „Nächste Sitzungen“', () => {
  it('nimmt dieselbe Regel: jede Gruppe zeigt den Termin nur, wo das Treffen ist', async () => {
    ct.termine = [termin(114, KOMMEND), termin(115, KOMMEND2)];
    ct.treffen.set(195, [{ id: 61, startDate: KOMMEND }]);
    const gruppen = [194, 195].map((id) => ({
      ...gruppe(id),
      name: id === 194 ? 'Technik' : 'Bildtechnik',
      lage: 'eingerichtet' as const,
    }));
    const u = await ladeUebersicht(MODUL, gruppen, ZONE, JETZT);
    expect(u.map((g) => g.sitzungen.kommend.map((s) => s.termin?.id))).toEqual([[115], [114, 115]]);
  });
});

describe('sitzungenOhneProtokoll – „Noch ohne Protokoll“ und „Protokoll nachtragen“', () => {
  it('Regel 1: der Termin von Bildtechnik fehlt bei Technik (Serie: nur diese Woche)', async () => {
    ct.termine = [termin(114, VORBEI), termin(115, '2026-11-03T18:00:00Z')];
    ct.treffen.set(195, [{ id: 61, startDate: VORBEI }]);
    expect(await nachtragen()).toEqual([115]);
  });

  it('Regel 2: ein Kopf von Bildtechnik zum Termin blendet ihn aus', async () => {
    ct.termine = [termin(114, VORBEI), termin(115, '2026-11-03T18:00:00Z')];
    protokollAblegen(195, { sitzung: 'b', termin: { kalender: 4, id: 114 }, beginn: VORBEI });
    expect(await nachtragen()).toEqual([115]);
  });

  it('Regel 3: mit eigenem Treffen bleibt er', async () => {
    ct.termine = [termin(114, VORBEI)];
    ct.treffen.set(194, [{ id: 31, startDate: VORBEI }]);
    ct.treffen.set(195, [{ id: 61, startDate: VORBEI }]);
    expect(await nachtragen()).toEqual([114]);
  });

  it('Regel 5: 403 bei der anderen Gruppe → Termin bleibt', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    ct.termine = [termin(114, VORBEI)];
    ct.treffen.set(195, [{ id: 61, startDate: VORBEI }]);
    ct.treffenVerbotenFuer.add(195);
    expect(await nachtragen()).toEqual([114]);
  });

  it('Regel 5: 502 bei der anderen Gruppe → Termin bleibt und die Liste lädt', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    ct.termine = [termin(114, VORBEI)];
    ct.treffen.set(195, [{ id: 61, startDate: VORBEI }]);
    ct.treffenLesenFehlerFuer.set(195, 502);
    expect(await nachtragen()).toEqual([114]);
  });

  it('keine Zusatzabrufe, wenn nur Gruppentreffen oder kein Kalender', async () => {
    ct.treffen.set(194, [{ id: 31, startDate: VORBEI }]);
    expect(await nachtragen()).toEqual(['treffen:31']);
    expect(nachGruppe195()).toEqual([]);
    ct.termine = [termin(114, VORBEI)];
    ct.aufrufe.length = 0;
    await sitzungenOhneProtokoll({
      modul: MODUL,
      gruppe: 194,
      kalender: null,
      koepfe: [],
      zeitraum: ZEITRAUM,
      zeitzone: ZONE,
    });
    expect(nachGruppe195()).toEqual([]);
  });

  it('der Block „Noch ohne Protokoll“ nimmt dieselbe Regel', async () => {
    ct.termine = [termin(114, VORBEI), termin(115, '2026-11-12T18:00:00Z')];
    ct.treffen.set(195, [{ id: 61, startDate: VORBEI }]);
    const daten = await ladeSitzungen(MODUL, gruppe(194), ZONE, JETZT);
    const s = await sitzungenNochOhneProtokoll(MODUL, { id: 194 }, daten, ZONE, JETZT);
    expect(s.map((x) => x.termin?.id)).toEqual([115]);
    expect(koepfeAus(daten)).toEqual([]);
  });
});
