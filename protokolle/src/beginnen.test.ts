import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Block } from '@shared/protokolle/dokument';
import { istAufgabe } from '@shared/protokolle/aufgaben';
import { anfangsDokument } from '@shared/protokolle/beginnen';
import {
  dokumentDerSitzung,
  istKopf,
  istTeil,
  teileBauen,
  type ProtokollKopf,
} from '@shared/protokolle/speicher';
import { STANDARD_VORLAGEN } from '@shared/protokolle/vorlagen';
import { fehlerMeldung } from '@ui/ct/fehlerMeldung';
import { protokollBeginnen } from './beginnen';
import { MODUL, nachbauEnde, nachbauStarten, werteVon, type Nachbau } from './nachbau.testhilfe';

/** „Protokoll beginnen“ (S5-1) gegen die nachgestellte ChurchTools-Instanz. */
let ct: Nachbau;
const KAT = 62;
const MIT = 65;
const SITZUNG = {
  titel: 'Leitungssitzung',
  beginn: '2026-11-11T18:00:00Z',
  termin: { kalender: 4, id: 114 },
  treffen: 15,
  kopf: null,
};
let n = 0;
const neueId = () => `id${++n}`;
const DOK: Block[] = anfangsDokument({ art: 'vorlage', vorlage: STANDARD_VORLAGEN[0] }, neueId);

const koepfe = (): ProtokollKopf[] =>
  werteVon(ct, KAT)
    .map((w) => JSON.parse(w.value) as unknown)
    .filter(istKopf);
const teile = () =>
  werteVon(ct, KAT)
    .map((w) => JSON.parse(w.value) as unknown)
    .filter(istTeil);
const todos = () =>
  werteVon(ct, MIT)
    .map((w) => JSON.parse(w.value) as unknown)
    .filter(istAufgabe);
const schreibAufrufe = () => ct.aufrufe.filter((a) => !a.startsWith('GET'));

const kopfAblegen = (k: Partial<ProtokollKopf>) =>
  werteVon(ct, KAT).push({
    id: ct.naechste++,
    value: JSON.stringify({
      art: 'protokoll',
      fassung: 1,
      sitzung: 'alt',
      titel: 'Leitungssitzung',
      status: 'entwurf',
      beginn: SITZUNG.beginn,
      termin: null,
      treffen: null,
      freigabe: null,
      sperre: null,
      stand: 'x',
      ...k,
    } satisfies ProtokollKopf),
  });

const beginnen = (sitzung: Parameters<typeof protokollBeginnen>[0]['sitzung'] = SITZUNG) =>
  protokollBeginnen({
    modul: MODUL,
    kategorie: KAT,
    mitarbeit: { modul: MODUL, kategorie: MIT },
    gruppe: 194,
    sitzung,
    dokument: DOK,
    von: { person: 1, name: 'Alwin' },
    neueId: () => 'neu',
    jetzt: new Date('2026-11-11T18:05:00Z'),
  });

beforeEach(() => {
  ct = nachbauStarten();
  ct.kategorien.push(
    { id: KAT, shorty: 'protokolle-g194', name: 'Protokolle · Technik' },
    { id: MIT, shorty: 'mitarbeit-g194', name: 'Mitarbeit · Technik' },
  );
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});
afterEach(nachbauEnde);

describe('protokollBeginnen', () => {
  it('legt Teile und Kopf an (Entwurf, mit Termin und Treffen) – das Dokument liest sich gleich zurück', async () => {
    expect(await beginnen()).toEqual({ art: 'ok', sitzung: 'neu', hinweis: null });
    const [kopf] = koepfe();
    expect(kopf).toMatchObject({
      sitzung: 'neu',
      status: 'entwurf',
      titel: 'Leitungssitzung',
      beginn: SITZUNG.beginn,
      termin: SITZUNG.termin,
      treffen: 15,
      sperre: null,
      stand: teileBauen(DOK, 'neu').stand,
    });
    expect(dokumentDerSitzung(kopf, teile())).toEqual(DOK);
  });

  it('die feste Aufgabe der Vorlage ist sofort ein To-Do dieser Sitzung', async () => {
    await beginnen();
    expect(todos().map((t) => [t.text, t.sitzung, t.gruppe, t.status])).toEqual([
      ['Raum für die nächste Sitzung prüfen', 'neu', 194, 'offen'],
    ]);
  });

  it('hat inzwischen jemand anderes begonnen (gleiches Treffen): nichts schreiben, dessen Protokoll nennen', async () => {
    kopfAblegen({ sitzung: 'fremd', treffen: 15 });
    expect(await beginnen()).toEqual({ art: 'schon', sitzung: 'fremd' });
    expect(schreibAufrufe()).toEqual([]);
  });

  it('Serientermin: ein Protokoll zu einem anderen Termin der Serie zählt nicht', async () => {
    kopfAblegen({
      sitzung: 'vorige-woche',
      termin: { kalender: 4, id: 114 },
      beginn: '2026-11-04T18:00:00Z',
    });
    expect((await beginnen({ ...SITZUNG, treffen: null })).art).toBe('ok');
    expect(
      koepfe()
        .map((k) => k.sitzung)
        .sort(),
    ).toEqual(['neu', 'vorige-woche']);
  });

  it('ein geplantes Protokoll wird begonnen – derselbe Kopf, kein zweiter', async () => {
    kopfAblegen({ sitzung: 'geplant-1', status: 'geplant', treffen: 15 });
    const geplant = koepfe()[0];
    const r = await beginnen({ ...SITZUNG, kopf: geplant });
    expect(r).toMatchObject({ art: 'ok', sitzung: 'geplant-1' });
    expect(koepfe()).toHaveLength(1);
    expect(koepfe()[0]).toMatchObject({
      sitzung: 'geplant-1',
      status: 'entwurf',
      stand: teileBauen(DOK, 'geplant-1').stand,
    });
  });

  it('übernimmt ChurchTools den Kopf nicht: Fehler statt „begonnen“', async () => {
    ct.schluckeWert = (v) => v.includes('"art":"protokoll"') && !v.includes('protokoll-teil');
    // So steht es im Fenster – nicht „ChurchTools antwortet gerade nicht“ (beim Bau von S5-2 gefunden).
    expect(fehlerMeldung(await beginnen().catch((e: unknown) => e)).text).toMatch(
      /neue Protokoll nicht übernommen/,
    );
    expect(koepfe()).toEqual([]);
  });

  it('scheitern nur die To-Dos: Protokoll steht, Hinweis statt Fehler (vorübergehend ist nicht ungültig)', async () => {
    ct.schluckeWert = (v) => v.includes('"art":"aufgabe"');
    const r = await beginnen();
    expect(r).toMatchObject({ art: 'ok', sitzung: 'neu' });
    expect(r.art === 'ok' && r.hinweis).toMatch(/nächsten Speichern/);
    expect(koepfe()[0].status).toBe('entwurf');
  });
});
