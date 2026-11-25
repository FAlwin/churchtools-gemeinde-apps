import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { neueAufgabe } from '@shared/protokolle/aufgaben';
import {
  istTerminStand,
  neuerTerminStand,
  terminStandGeloescht,
  terminStandId,
  type TerminStand,
} from '@shared/protokolle/terminStand';
import { NichtUebernommen } from '@ui/ct/fehler';
import { ladeMitarbeit } from './lesen';
import { MODUL, nachbauEnde, nachbauStarten, werteVon, type Nachbau } from './nachbau.testhilfe';
import { termineAbgleichen, terminMarkieren, terminVermerken } from './terminStandSchreiben';

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

describe('termineAbgleichen – ein Termin-Baustein wird aus dem Protokoll entfernt (beim Speichern)', () => {
  const ablegen = (s: TerminStand): TerminStand => {
    werteVon(ct, KAT).push({ id: ct.naechste++, value: JSON.stringify(s) });
    return s;
  };
  const stand = (sitzung: string, block: string, st: TerminStand['stand'] = 'offen') =>
    ablegen(
      neuerTerminStand(
        { gruppe: 194, sitzung, block },
        st,
        st === 'imKalender' ? KAL : null,
        7,
        '2026-11-20T10:00:00Z',
      ),
    );
  const VERMERK = { von: 1, am: AM };
  const putUndDelete = () => ct.aufrufe.filter((a) => /^(PUT|DELETE) /.test(a));

  it('entfernt → als gelöscht vermerkt (auch ein doppelter), nie hart; verbleibende und andere Sitzungen unberührt', async () => {
    const bleibt = stand('s1', 'b1', 'imKalender');
    stand('s1', 'b2', 'imKalender');
    stand('s1', 'b2', 'offen'); // doppelt aus einem abgebrochenen Anlegen
    const fremd = stand('s9', 'b2', 'nichtEintragen');
    const anzahl = werteVon(ct, KAT).length;

    await termineAbgleichen(ORT, 's1', new Set(['b1']), 1, AM);

    expect(werteVon(ct, KAT)).toHaveLength(anzahl);
    expect(ct.aufrufe.filter((a) => a.startsWith('DELETE'))).toEqual([]);
    const s1 = staende().filter((s) => s.sitzung === 's1');
    expect(s1[0]).toEqual(bleibt);
    expect(s1.slice(1).map((s) => [s.block, s.stand, s.geloescht])).toEqual([
      ['b2', 'imKalender', VERMERK],
      ['b2', 'offen', VERMERK],
    ]);
    // Der Kalender-Eintrag bleibt am Stand – nur der Vermerk kommt dazu.
    expect(s1[1].kalender).toEqual(KAL);
    expect(staende().filter((s) => s.sitzung === 's9')).toEqual([fremd]);
  });

  it('zurückgeholt (Rückgängig) → der Vermerk fällt weg, der Stand bleibt', async () => {
    const alt = stand('s1', 'b1', 'imKalender');
    werteVon(ct, KAT).at(-1)!.value = JSON.stringify(terminStandGeloescht(alt, 19, AM));
    await termineAbgleichen(ORT, 's1', new Set(['b1']), 1, AM);
    expect(staende()).toEqual([alt]);
  });

  it('nichts zu tun: ein Lesen, kein Schreiben (das Speichern läuft alle paar Sekunden)', async () => {
    stand('s1', 'b1');
    ablegen(
      terminStandGeloescht(
        neuerTerminStand({ gruppe: 194, sitzung: 's1', block: 'b2' }, 'offen', null, 7, AM),
        19,
        AM,
      ),
    );
    ct.aufrufe.length = 0;
    await termineAbgleichen(ORT, 's1', new Set(['b1']), 1, AM);
    expect(ct.aufrufe.filter((a) => a.startsWith('GET'))).toHaveLength(1);
    expect(putUndDelete()).toEqual([]);
  });

  it('Nachlesen: sagt ChurchTools „geändert“ und der Vermerk fehlt, wird geworfen', async () => {
    const s = stand('s1', 'b1');
    ct.schlucken.add('PUT WERT');
    await expect(termineAbgleichen(ORT, 's1', new Set(), 1, AM)).rejects.toBeInstanceOf(
      NichtUebernommen,
    );
    expect(staende()).toEqual([s]);
  });

  it('vorübergehender Fehler (502): geworfen, kein Stand verändert – der nächste Versuch vollendet', async () => {
    const s = stand('s1', 'b1', 'imKalender');
    ct.fehlerBei = { methode: 'PUT', status: 502 };
    await expect(termineAbgleichen(ORT, 's1', new Set(), 1, AM)).rejects.toThrow();
    expect(staende()).toEqual([s]);
    ct.fehlerBei = null;
    await termineAbgleichen(ORT, 's1', new Set(), 1, AM);
    expect(staende()).toEqual([terminStandGeloescht(s, 1, AM)]);
  });
});
