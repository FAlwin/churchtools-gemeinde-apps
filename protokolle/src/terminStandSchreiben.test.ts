import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { neueAufgabe } from '@shared/protokolle/aufgaben';
import {
  istTerminStand,
  neuerTerminStand,
  terminStandId,
  type TerminStand,
} from '@shared/protokolle/terminStand';
import { ladeMitarbeit } from './lesen';
import { MODUL, nachbauEnde, nachbauStarten, werteVon, type Nachbau } from './nachbau.testhilfe';
import { terminMarkieren, terminVermerken } from './terminStandSchreiben';

/** Der Stand der Termin-Bausteine in „Mitarbeit“ (W14) gegen die nachgestellte ChurchTools-Instanz. */
let ct: Nachbau;
const KAT = 66;
const ORT = { modul: MODUL, kategorie: KAT };
const ZIEL = { gruppe: 194, sitzung: 's1', block: 'b1' };
const KAL = { kalender: 4, id: 160, name: 'Gemeindeleitung', zeit: 'ganztägig' };
const AM = '2026-11-21T10:00:00Z';
const staende = (): TerminStand[] =>
  werteVon(ct, KAT)
    .map((w) => JSON.parse(w.value) as unknown)
    .filter(istTerminStand);

beforeEach(() => {
  ct = nachbauStarten();
  ct.kategorien.push({ id: KAT, shorty: 'mitarbeit-g194', name: 'Mitarbeit · Technik' });
});
afterEach(nachbauEnde);

describe('terminVermerken', () => {
  it('legt den Vermerk an, liest nach – und ein zweiter Versuch legt keinen zweiten an', async () => {
    const s = await terminVermerken(ORT, ZIEL, KAL, 1, AM);
    expect(s).toEqual(neuerTerminStand(ZIEL, 'imKalender', KAL, 1, AM));
    await terminVermerken(ORT, ZIEL, KAL, 1, AM);
    expect(staende()).toEqual([s]);
  });

  it('gilt über ein „Nicht eintragen“ hinweg: der Termin steht ja in ChurchTools', async () => {
    await terminMarkieren(ORT, ZIEL, 'nichtEintragen', 7, AM);
    await terminVermerken(ORT, ZIEL, KAL, 1, AM);
    expect(staende()).toHaveLength(1);
    expect(staende()[0]).toMatchObject({ stand: 'imKalender', kalender: KAL });
  });

  it('ChurchTools nimmt den Vermerk nicht an (201, aber nichts gespeichert): Fehler – nichts gilt als vermerkt', async () => {
    ct.schluckeWert = () => true;
    await expect(terminVermerken(ORT, ZIEL, KAL, 1, AM)).rejects.toThrow(/nicht übernommen/);
    expect(staende()).toEqual([]);
  });

  it('ein vorübergehender Fehler (503) beim Schreiben: Fehler, kein Zustand verändert', async () => {
    ct.fehlerBei = { methode: 'POST', status: 503 };
    await expect(terminVermerken(ORT, ZIEL, KAL, 1, AM)).rejects.toThrow();
    expect(staende()).toEqual([]);
  });
});

describe('terminMarkieren', () => {
  it('„Nicht eintragen“ und „Wieder anzeigen“ ändern denselben Wert – nie ein zweiter, nie gelöscht', async () => {
    const a = await terminMarkieren(ORT, ZIEL, 'nichtEintragen', 7, AM);
    expect(a).toMatchObject({ stand: 'nichtEintragen', kalender: null, von: 7 });
    const b = await terminMarkieren(ORT, ZIEL, 'offen', 1, AM);
    expect(b.stand).toBe('offen');
    expect(werteVon(ct, KAT)).toHaveLength(1);
    expect(ct.aufrufe.some((x) => x.startsWith('DELETE'))).toBe(false);
  });

  it('ein Eintrag im Kalender bleibt, wie er ist – „Nicht eintragen“ einer zweiten Person ändert nichts', async () => {
    const drin = await terminVermerken(ORT, ZIEL, KAL, 1, AM);
    const r = await terminMarkieren(ORT, ZIEL, 'nichtEintragen', 7, AM);
    expect(r).toEqual(drin);
    expect(staende()).toEqual([drin]);
    await terminMarkieren(ORT, ZIEL, 'offen', 7, AM);
    expect(staende()).toEqual([drin]);
  });

  it('ein Baustein hat seinen eigenen Wert – andere Bausteine bleiben unberührt', async () => {
    await terminMarkieren(ORT, ZIEL, 'nichtEintragen', 7, AM);
    await terminMarkieren(ORT, { ...ZIEL, block: 'b2' }, 'nichtEintragen', 7, AM);
    expect(staende().map((s) => s.id)).toEqual([
      terminStandId('s1', 'b1'),
      terminStandId('s1', 'b2'),
    ]);
  });

  it('der Wert wird nicht übernommen oder ChurchTools antwortet nicht: Fehler, nichts markiert', async () => {
    ct.schluckeWert = () => true;
    await expect(terminMarkieren(ORT, ZIEL, 'nichtEintragen', 7, AM)).rejects.toThrow(
      /nicht übernommen/,
    );
    ct.schluckeWert = null;
    ct.fehlerBei = { methode: 'POST', status: 502 };
    await expect(terminMarkieren(ORT, ZIEL, 'nichtEintragen', 7, AM)).rejects.toThrow();
    expect(staende()).toEqual([]);
  });
});

describe('ladeMitarbeit liest den Stand mit – To-Dos und Kaputtes bleiben, wo sie sind', () => {
  it('termine: nur Stände; aufgaben: keine Stände', async () => {
    await terminVermerken(ORT, ZIEL, KAL, 1, AM);
    werteVon(ct, KAT).push(
      {
        id: ct.naechste++,
        value: JSON.stringify(
          neueAufgabe({ id: 't1', gruppe: 194, sitzung: null, text: 'x', von: 1, am: AM }),
        ),
      },
      { id: ct.naechste++, value: 'kaputt' },
    );
    const m = await ladeMitarbeit(MODUL, { mitarbeit: KAT });
    expect(m.termine?.map((t) => t.id)).toEqual([terminStandId('s1', 'b1')]);
    expect(m.aufgaben.map((a) => a.id)).toEqual(['t1']);
    expect(m.todoVorschlaege).toEqual([]);
    expect(m.vorschlaege).toEqual([]);
  });

  it('ohne Mitarbeit-Kategorie: keine Stände', async () => {
    expect((await ladeMitarbeit(MODUL, { mitarbeit: null })).termine).toEqual([]);
  });
});
