import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as V from '@ui/ct/verbindung';
import { ApiError, NichtUebernommen } from '@ui/ct/fehler';
import {
  NACHWEIS_ART,
  NACHWEIS_LEITER_RECHTE,
  NACHWEIS_TEILNEHMER_RECHTE,
} from '@shared/anmeldung/nachweise';
import { FalschesCt } from '@shared/ct/gruppenart.testutil';
import { nachweisGrundlageLesen, nachweisGrundlageSichern } from './nachweise';

/**
 * Die Grundlage für Nachweise gegen ein nachgestelltes ChurchTools (`FalschesCt`, so wie am 19.11.2026 gemessen): Der
 * Anschluss `@ui/ct/verbindung` ist ersetzt, `ctDaten` liest, `ctAnfrage` schreibt. Die Rechte kommen aus
 * `NACHWEIS_LEITER_RECHTE`, nicht aus abgeschriebenen Zahlen.
 */
vi.mock('@ui/ct/verbindung', () => ({ ctAnfrage: vi.fn(), ctDaten: vi.fn() }));
const ct = vi.mocked(V);

let falsch: FalschesCt;
/** Was `/permissions/global` liefert. */
let global: unknown;
/** Alle Lesezugriffe (auch auf `/permissions/global`). */
let gelesen: string[];

const ADMIN = { churchcore: { 'administer persons': true } };
const OHNE_ADMIN = { churchcore: { 'view birthdays': true }, churchdb: { 'view alldata': true } };

const alsRechte = (l: readonly { authId: number; dataId: number | null }[]) =>
  l.map(({ authId, dataId }) => ({ authId, dataId }));

function mitNachweisArt(
  rechte: { authId: number; dataId: number | null }[] = [],
  teilnehmer: { authId: number; dataId: number | null }[] = [],
) {
  falsch.typen = [{ id: 11, name: 'Nachweis', sortKey: 100 }];
  falsch.rollen = [
    { id: 53, groupTypeId: 11, isLeader: false, isDefault: true },
    { id: 56, groupTypeId: 11, isLeader: true },
  ];
  falsch.rechte.set(56, rechte);
  falsch.rechte.set(53, teilnehmer);
}

beforeEach(() => {
  falsch = new FalschesCt();
  global = ADMIN;
  gelesen = [];
  ct.ctDaten.mockReset().mockImplementation(async (pfad: string) => {
    gelesen.push(pfad);
    if (pfad === '/permissions/global') return global;
    return await falsch.holen(pfad);
  });
  ct.ctAnfrage.mockReset().mockImplementation(async (pfad: string, opt?: unknown) => {
    const o = opt as { method: 'POST' | 'PUT'; body?: string };
    const antwort = await falsch.schicken(
      pfad,
      o.method,
      o.body === undefined ? undefined : JSON.parse(o.body),
    );
    return { data: antwort };
  });
});

describe('nachweisGrundlageLesen', () => {
  it('Admin, Art und Rechte da: nichts fehlt', async () => {
    mitNachweisArt(alsRechte(NACHWEIS_LEITER_RECHTE), alsRechte(NACHWEIS_TEILNEHMER_RECHTE));
    expect(await nachweisGrundlageLesen()).toEqual({
      typId: 11,
      rechtFehlt: false,
      darfEinrichten: true,
    });
  });

  it('Recht fehlt: rechtFehlt true, und es wird nichts geschrieben', async () => {
    mitNachweisArt([{ authId: 777, dataId: null }]);
    expect(await nachweisGrundlageLesen()).toEqual({
      typId: 11,
      rechtFehlt: true,
      darfEinrichten: true,
    });
    expect(falsch.aufrufe).toEqual([]);
    expect(ct.ctAnfrage).not.toHaveBeenCalled();
  });

  it('(i) Leiter-Rechte da, aber das der Teilnehmer-Rolle fehlt: rechtFehlt true, nichts geschrieben', async () => {
    mitNachweisArt(alsRechte(NACHWEIS_LEITER_RECHTE));
    expect((await nachweisGrundlageLesen()).rechtFehlt).toBe(true);
    expect(falsch.aufrufe).toEqual([]);
  });

  it('keine Art: typId null, rechtFehlt null (es gibt nichts zu lesen)', async () => {
    expect(await nachweisGrundlageLesen()).toEqual({
      typId: null,
      rechtFehlt: null,
      darfEinrichten: true,
    });
  });

  it('ohne „Berechtigungen verwalten“: darfEinrichten false, die Rechte der Rolle werden nicht gelesen', async () => {
    mitNachweisArt();
    global = OHNE_ADMIN;
    expect(await nachweisGrundlageLesen()).toEqual({
      typId: 11,
      rechtFehlt: null,
      darfEinrichten: false,
    });
    expect(gelesen.some((p) => p.startsWith('/permissions/group_type_role'))).toBe(false);
    expect(gelesen.some((p) => p === '/group/roles')).toBe(false);
  });

  it('Rechte der Rolle nicht lesbar (Netz, 5xx): null – nicht „fehlt“', async () => {
    mitNachweisArt();
    ct.ctDaten.mockImplementation(async (pfad: string) => {
      if (pfad === '/permissions/global') return global;
      if (pfad.startsWith('/permissions/group_type_role'))
        throw new ApiError(504, 'ChurchTools antwortet nicht');
      return await falsch.holen(pfad);
    });
    expect(await nachweisGrundlageLesen()).toEqual({
      typId: 11,
      rechtFehlt: null,
      darfEinrichten: true,
    });
  });

  it('Liste der Gruppentypen nicht lesbar: wirft (ApiError), statt „gibt es nicht“ zu behaupten', async () => {
    ct.ctDaten.mockImplementation(async (pfad: string) => {
      if (pfad === '/permissions/global') return global;
      throw new ApiError(503, 'weg');
    });
    await expect(nachweisGrundlageLesen()).rejects.toBeInstanceOf(ApiError);
  });

  it('leere Rechte-Antwort ist ein Aussetzer, kein „keine Rechte“: wirft', async () => {
    global = {};
    await expect(nachweisGrundlageLesen()).rejects.toMatchObject({ status: 502 });
  });
});

describe('nachweisGrundlageSichern', () => {
  it('legt Art an und ergänzt das Recht (Rollen aus der Vorgabe der Art)', async () => {
    falsch.typen = [{ id: 2, name: 'Dienst', sortKey: 7 }];
    const r = await nachweisGrundlageSichern();
    expect(r).toEqual({ typId: 11, teilnehmerRolle: 53, leiterRolle: 54 });
    const post = falsch.aufrufe.find((a) => a.pfad === '/group/grouptypes');
    expect(post?.json).toMatchObject({ name: NACHWEIS_ART.name, shorty: NACHWEIS_ART.shorty });
    expect(falsch.rechte.get(54)).toEqual(alsRechte(NACHWEIS_LEITER_RECHTE));
    // M6: die Teilnehmer-Rolle bekommt genau „Gruppeninfos sehen“ (Stufe 1) – sonst nichts
    expect(falsch.rechte.get(53)).toEqual(alsRechte(NACHWEIS_TEILNEHMER_RECHTE));
  });

  it('Art und Rechte schon da: nichts geschrieben; zweiter Lauf ändert nichts', async () => {
    mitNachweisArt(alsRechte(NACHWEIS_LEITER_RECHTE), alsRechte(NACHWEIS_TEILNEHMER_RECHTE));
    expect(await nachweisGrundlageSichern()).toEqual({
      typId: 11,
      leiterRolle: 56,
      teilnehmerRolle: 53,
    });
    expect(falsch.aufrufe).toEqual([]);
  });

  it('fremde Rechte an der Leiter-Rolle bleiben', async () => {
    mitNachweisArt([{ authId: 777, dataId: 2 }]);
    await nachweisGrundlageSichern();
    expect(falsch.rechte.get(56)).toEqual([
      { authId: 777, dataId: 2 },
      ...NACHWEIS_LEITER_RECHTE.map(({ authId, dataId }) => ({ authId, dataId })),
    ]);
  });

  it('ChurchTools schluckt das Recht (200, nichts übernommen): NichtUebernommen', async () => {
    mitNachweisArt();
    falsch.ignoriere = ['PUT /permissions'];
    const e = await nachweisGrundlageSichern().catch((x: unknown) => x);
    expect(e).toBeInstanceOf(NichtUebernommen);
    // Die Namen kommen aus den Rechten, nicht aus einem abgeschriebenen Satz.
    expect((e as Error).message).toBe(
      `ChurchTools hat ${NACHWEIS_LEITER_RECHTE.map((r) => `„${r.name}“`).join(', ')} nicht übernommen. Bitte noch einmal versuchen.`,
    );
  });

  it('Rollen fehlen: ApiError mit verständlichem Text – 422, nicht 502 (sonst liest die Anzeige „ChurchTools antwortet nicht“)', async () => {
    falsch.typen = [{ id: 11, name: 'Nachweis', sortKey: 1 }];
    const e = await nachweisGrundlageSichern().catch((x: unknown) => x);
    expect(e).toBeInstanceOf(ApiError);
    expect((e as ApiError).status).toBe(422);
    expect((e as Error).message).toContain('nicht beide Rollen');
  });
});
