import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError, NichtUebernommen } from '@ui/ct/fehler';
import { _vergissModul } from '@ui/ct/modulPort';
import { ctAnfrage, ctDaten } from '@ui/ct/verbindung';
import { leitungAusWerten } from '@shared/website/mailWerte';
import type { Wert } from '@shared/ct/modulDaten';
import { sollRechte, type Kategorien } from '@shared/website/rechte';
import { datenRechteNummernAus, type Recht } from '@shared/ct/rollenRechte';
import { LeitungNichtFestgehalten } from './leitungFehler';
import { ladeRollen, ladeWerDarfWas, pruefeRechte, rechteSetzen } from './rechte';

vi.mock('@ui/ct/verbindung', async (original) => ({
  ...(await original<typeof import('@ui/ct/verbindung')>()),
  ctDaten: vi.fn(),
  ctAnfrage: vi.fn(),
}));

/** Ein nachgestelltes ChurchTools: Definitionen, Rollen und die Rechte je Rolle; jeder Schreibaufruf wird mitgeschrieben. */
const DEFINITIONEN = {
  modules: [
    {
      key: 'website',
      permissions: [
        { authId: 2080, key: 'view' },
        { authId: 2081, key: 'view custom category' },
        { authId: 2085, key: 'view custom data' },
        { authId: 2086, key: 'create custom data' },
        { authId: 2087, key: 'edit custom data' },
        { authId: 2088, key: 'delete custom data' },
      ],
    },
  ],
};
const N = datenRechteNummernAus(DEFINITIONEN, 'website')!;
const KAT: Kategorien = { entwuerfe: 104, veroeffentlicht: 107 };
const GRUPPE = 344;
const ROLLEN = [
  { id: 3290, name: 'Leiter', isLeader: true, isActive: true },
  { id: 3287, name: 'Mitarbeiter', isLeader: false, isActive: true },
  { id: 3296, name: 'Coach', isLeader: false, isActive: true },
  { id: 3299, name: 'Alt', isLeader: false, isActive: false },
];

let rechte: Recht[];
let aufrufe: string[];
/** Optionen des Nachbaus: Aufrufnummer, die scheitern soll; Methode, die ChurchTools „übernimmt“, ohne etwas zu tun. */
let scheitereBei: number | null;
let ignoriere: 'PUT' | 'DELETE' | null;
let leseFehler: boolean;
let schreibAufrufe: number;
/** Die Werte der Kategorie „Entwürfe“ (dort liegt `website-leitung`) und die Schreibaufrufe darauf – getrennt von den Rechten. */
let werte: Wert[];
let wertAufrufe: string[];
/** Optionen: Der Schreibaufruf auf die Werte scheitert (503) / gilt als abgemeldet (401). */
let wertFehler: 503 | 401 | null;
/** Was von den Rechten gesetzt war, als der Leitungs-Wert geschrieben wurde. */
let rechteBeimWertSchreiben: Recht[] | null;
const MODUL = 7;
const WERTE_PFAD = `/custommodules/${MODUL}/customdatacategories/${KAT.entwuerfe}/customdatavalues`;

const r = (rolle: number, authId: number, dataId: number | null = null): Recht => ({
  rolle,
  authId,
  dataId,
});

beforeEach(() => {
  vi.stubEnv('BASE_URL', '/ccm/website/');
  _vergissModul();
  werte = [];
  wertAufrufe = [];
  wertFehler = null;
  rechteBeimWertSchreiben = null;
  rechte = [];
  aufrufe = [];
  scheitereBei = null;
  ignoriere = null;
  leseFehler = false;
  schreibAufrufe = 0;
  vi.mocked(ctDaten).mockImplementation((pfad: string) => {
    aufrufe.push(`GET ${pfad}`);
    if (leseFehler) return Promise.reject(new ApiError(504, 'weg'));
    if (pfad === '/permissions/definitions') return Promise.resolve(DEFINITIONEN as never);
    if (pfad === '/custommodules')
      return Promise.resolve([{ id: MODUL, shorty: 'website' }] as never);
    if (pfad === WERTE_PFAD) return Promise.resolve(werte.map((w) => ({ ...w })) as never);
    if (pfad === `/groups/${GRUPPE}/roles`) return Promise.resolve(ROLLEN as never);
    const rolle = Number(/group_role\/(\d+)$/.exec(pfad)?.[1]);
    return Promise.resolve(
      rechte
        .filter((x) => x.rolle === rolle)
        .map((x) => ({ authId: x.authId, dataId: x.dataId, type: 'grant' })) as never,
    );
  });
  vi.mocked(ctAnfrage).mockImplementation((pfad: string, init) => {
    if (pfad.startsWith(WERTE_PFAD)) {
      const methode = init?.method ?? 'GET';
      wertAufrufe.push(methode);
      if (wertFehler === 503) return Promise.reject(new ApiError(503, 'kurz weg'));
      if (wertFehler === 401) return Promise.reject(new ApiError(401, 'abgemeldet'));
      rechteBeimWertSchreiben = rechte.map((x) => ({ ...x }));
      const j = JSON.parse(String(init?.body)) as { id?: number; value: string };
      if (methode === 'POST')
        werte.push({ id: 900 + werte.length, dataCategoryId: KAT.entwuerfe, value: j.value });
      else werte = werte.map((w) => (w.id === j.id ? { ...w, value: j.value } : w));
      return Promise.resolve(null as never);
    }
    schreibAufrufe += 1;
    if (scheitereBei === schreibAufrufe) return Promise.reject(new ApiError(503, 'kurz weg'));
    const rolle = Number(/group_role\/(\d+)$/.exec(pfad)?.[1]);
    const j = JSON.parse(String(init?.body)) as { authId: number; dataId?: number[] };
    const methode = init?.method as 'PUT' | 'DELETE';
    aufrufe.push(`${methode} ${rolle} ${j.authId}:${j.dataId?.[0] ?? '-'}`);
    if (methode !== ignoriere) {
      const dataId = j.dataId?.[0] ?? null;
      const i = rechte.findIndex(
        (x) => x.rolle === rolle && x.authId === j.authId && x.dataId === dataId,
      );
      if (methode === 'PUT' && i < 0) rechte.push({ rolle, authId: j.authId, dataId });
      if (methode === 'DELETE' && i >= 0) rechte.splice(i, 1);
    }
    return Promise.resolve(null as never);
  });
});

const soll = (...p: [number, 'keine' | 'redakteur' | 'leitung'][]) =>
  sollRechte(
    p.map(([rolle, stufe]) => ({ rolle, stufe })),
    KAT,
    N,
  );
const schl = (x: Recht) => `${x.rolle}:${x.authId}:${x.dataId ?? '-'}`;
const sortiert = (l: Recht[]) => l.map(schl).sort();

describe('rechteSetzen', () => {
  it('setzt je Stufe genau das Soll an den zwei Kategorien – Leiter-Rolle Leitung, Mitarbeiter Redakteur', async () => {
    await rechteSetzen(GRUPPE, KAT, [
      { rolle: 3290, stufe: 'leitung' },
      { rolle: 3287, stufe: 'redakteur' },
      { rolle: 3296, stufe: 'keine' },
    ]);
    expect(sortiert(rechte)).toEqual(sortiert(soll([3290, 'leitung'], [3287, 'redakteur'])));
    // Der Redakteur darf in „Veröffentlicht“ nur lesen.
    const red = rechte.filter((x) => x.rolle === 3287 && x.dataId === KAT.veroeffentlicht);
    expect(red.map((x) => x.authId).sort()).toEqual([N.kategorieSehen, N.datenSehen].sort());
  });

  it('erneut setzen ändert nichts (Soll gegen Ist): keine Schreibaufrufe', async () => {
    const wahl = [
      { rolle: 3290, stufe: 'leitung' as const },
      { rolle: 3287, stufe: 'redakteur' as const },
    ];
    await rechteSetzen(GRUPPE, KAT, wahl);
    schreibAufrufe = 0;
    aufrufe = [];
    await rechteSetzen(GRUPPE, KAT, wahl);
    expect(aufrufe.filter((a) => !a.startsWith('GET'))).toEqual([]);
  });

  it('Herabstufen entzieht nur UNSERE Kategorien; Fremdes und Zusatzrechte bleiben; danach folgt ein PUT', async () => {
    rechte = [
      ...soll([3290, 'leitung']),
      r(3290, N.datenAnlegen, 999), // fremde Kategorie von Hand
      r(3290, 10119), // Zusatzrecht von Hand
    ];
    await rechteSetzen(GRUPPE, KAT, [{ rolle: 3290, stufe: 'redakteur' }]);
    expect(rechte.some((x) => x.dataId === 999)).toBe(true);
    expect(rechte.some((x) => x.authId === 10119)).toBe(true);
    expect(
      rechte.some((x) => x.dataId === KAT.veroeffentlicht && x.authId === N.datenAnlegen),
    ).toBe(false);
    const schreib = aufrufe.filter((a) => !a.startsWith('GET'));
    const letzteDelete = schreib.map((a) => a.split(' ')[0]).lastIndexOf('DELETE');
    expect(schreib[schreib.length - 1].startsWith('PUT')).toBe(true);
    expect(letzteDelete).toBeGreaterThanOrEqual(0);
    expect(letzteDelete).toBeLessThan(schreib.length - 1);
  });

  it('Rollen, die nicht zu dieser Gruppe gehören (oder nicht genannt sind), bleiben unberührt', async () => {
    rechte = [...soll([4711, 'leitung']), ...soll([3296, 'redakteur'])];
    await rechteSetzen(GRUPPE, KAT, [
      { rolle: 3290, stufe: 'redakteur' },
      { rolle: 4711, stufe: 'keine' }, // fremde Rolle – wird ignoriert
    ]);
    expect(sortiert(rechte.filter((x) => x.rolle === 4711))).toEqual(
      sortiert(soll([4711, 'leitung'])),
    );
    // Coach wird nicht genannt → bleibt, wie er ist.
    expect(sortiert(rechte.filter((x) => x.rolle === 3296))).toEqual(
      sortiert(soll([3296, 'redakteur'])),
    );
  });

  it('übernimmt ChurchTools ein PUT nicht (204 ohne Wirkung): NichtUebernommen – ein 204 ist kein Beleg', async () => {
    ignoriere = 'PUT';
    await expect(rechteSetzen(GRUPPE, KAT, [{ rolle: 3290, stufe: 'leitung' }])).rejects.toThrow(
      NichtUebernommen,
    );
  });

  it('übernimmt ChurchTools ein DELETE nicht: NichtUebernommen', async () => {
    rechte = soll([3290, 'leitung']);
    ignoriere = 'DELETE';
    await expect(rechteSetzen(GRUPPE, KAT, [{ rolle: 3290, stufe: 'keine' }])).rejects.toThrow(
      NichtUebernommen,
    );
  });

  it('vorübergehender Fehler beim Setzen: wird geworfen, nichts wird entzogen oder zurückgenommen; der nächste Versuch macht den Rest', async () => {
    rechte = [r(3290, N.datenAnlegen, KAT.veroeffentlicht)]; // soll weg (Redakteur)
    scheitereBei = 2;
    await expect(
      rechteSetzen(GRUPPE, KAT, [{ rolle: 3290, stufe: 'redakteur' }]),
    ).rejects.toMatchObject({ status: 503 });
    expect(aufrufe.some((a) => a.startsWith('DELETE'))).toBe(false);
    expect(rechte).toContainEqual(r(3290, N.datenAnlegen, KAT.veroeffentlicht));
    expect(rechte.length).toBeGreaterThan(1); // das erste PUT blieb stehen
    scheitereBei = null;
    await rechteSetzen(GRUPPE, KAT, [{ rolle: 3290, stufe: 'redakteur' }]);
    expect(sortiert(rechte)).toEqual(sortiert(soll([3290, 'redakteur'])));
  });

  it('Lesefehler: wird geworfen, es wird nichts geschrieben (kein „keine Rechte“)', async () => {
    leseFehler = true;
    await expect(rechteSetzen(GRUPPE, KAT, [{ rolle: 3290, stufe: 'leitung' }])).rejects.toThrow();
    expect(schreibAufrufe).toBe(0);
  });

  it('fehlen die Rechte des Moduls in ChurchTools: klare Meldung, nichts geschrieben', async () => {
    vi.mocked(ctDaten).mockImplementationOnce(() => Promise.resolve({ modules: [] } as never));
    await expect(rechteSetzen(GRUPPE, KAT, [{ rolle: 3290, stufe: 'leitung' }])).rejects.toThrow(
      /Die Rechte der Erweiterung „Website“ fehlen/,
    );
    expect(schreibAufrufe).toBe(0);
  });

  it('Schreiben ohne Recht: Meldung nennt „Personen administrieren“', async () => {
    await rechteSetzen(GRUPPE, KAT, [{ rolle: 3290, stufe: 'leitung' }]);
    const init = vi.mocked(ctAnfrage).mock.calls[0][1];
    expect(init?.verweigert).toMatch(/Personen administrieren/);
  });
});

describe('rechteSetzen – wer die Leitung ist, wird festgehalten (W3b-3)', () => {
  const WAHL = [
    { rolle: 3290, stufe: 'leitung' as const },
    { rolle: 3287, stufe: 'redakteur' as const },
    { rolle: 3296, stufe: 'keine' as const },
  ];

  it('schreibt `website-leitung` in „Entwürfe“: genau die Rollen mit Stufe Leitung', async () => {
    await rechteSetzen(GRUPPE, KAT, [...WAHL, { rolle: 3296, stufe: 'leitung' }]);
    expect(leitungAusWerten(werte)).toEqual([3290, 3296]);
    expect(werte).toHaveLength(1);
  });

  it('erst NACH dem Setzen der Rechte – zu dem Zeitpunkt stehen sie schon so da', async () => {
    await rechteSetzen(GRUPPE, KAT, WAHL);
    expect(sortiert(rechteBeimWertSchreiben ?? [])).toEqual(
      sortiert(soll([3290, 'leitung'], [3287, 'redakteur'])),
    );
  });

  it('übernimmt ChurchTools die Rechte nicht (NichtUebernommen), wird die Leitung NICHT festgehalten', async () => {
    ignoriere = 'PUT';
    await expect(rechteSetzen(GRUPPE, KAT, WAHL)).rejects.toThrow(NichtUebernommen);
    expect(wertAufrufe).toEqual([]);
    expect(werte).toEqual([]);
  });

  it('Rollen fremder Gruppen kommen nicht in die Leitung', async () => {
    await rechteSetzen(GRUPPE, KAT, [...WAHL, { rolle: 4711, stufe: 'leitung' }]);
    expect(leitungAusWerten(werte)).toEqual([3290]);
  });

  it('erneut mit derselben Wahl: nichts wird noch einmal geschrieben', async () => {
    await rechteSetzen(GRUPPE, KAT, WAHL);
    wertAufrufe = [];
    await rechteSetzen(GRUPPE, KAT, WAHL);
    expect(wertAufrufe).toEqual([]);
  });

  it('ändert sich die Leitung, wird der vorhandene Wert geändert – kein zweiter angelegt', async () => {
    await rechteSetzen(GRUPPE, KAT, WAHL);
    await rechteSetzen(GRUPPE, KAT, [{ rolle: 3287, stufe: 'leitung' }]);
    expect(leitungAusWerten(werte)).toEqual([3287]);
    expect(werte).toHaveLength(1);
    expect(wertAufrufe).toEqual(['POST', 'PUT']);
  });

  it('scheitert das Festhalten (503): eigene Meldung – die Rechte STEHEN –, der nächste Versuch holt es nach', async () => {
    wertFehler = 503;
    const e = await rechteSetzen(GRUPPE, KAT, WAHL).catch((x: unknown) => x);
    expect(e).toBeInstanceOf(LeitungNichtFestgehalten);
    expect((e as Error).message).toMatch(/Die Rechte sind gesetzt/);
    expect(sortiert(rechte)).toEqual(sortiert(soll([3290, 'leitung'], [3287, 'redakteur'])));
    expect(werte).toEqual([]);
    wertFehler = null;
    await rechteSetzen(GRUPPE, KAT, WAHL);
    expect(leitungAusWerten(werte)).toEqual([3290]);
  });

  it('abgemeldet (401) beim Festhalten kommt unverändert an – nicht als „Leitung nicht festgehalten“', async () => {
    wertFehler = 401;
    await expect(rechteSetzen(GRUPPE, KAT, WAHL)).rejects.toMatchObject({ status: 401 });
  });
});

describe('ladeWerDarfWas – die Stufe kommt aus den Rechten', () => {
  it('liest die aktiven Rollen und leitet je Rolle die Stufe ab; Mischzustand als „abweicht“', async () => {
    rechte = [
      ...soll([3290, 'leitung']),
      ...soll([3287, 'redakteur']),
      r(3296, N.datenSehen, KAT.entwuerfe), // nur ein einzelnes Recht – weicht ab
    ];
    const w = await ladeWerDarfWas(GRUPPE, KAT);
    expect(w.rollen.map((x) => x.name)).toEqual(['Leiter', 'Mitarbeiter', 'Coach']); // „Alt“ ist inaktiv
    expect(w.ist).toEqual([
      { rolle: 3290, stufe: 'leitung' },
      { rolle: 3287, stufe: 'redakteur' },
      { rolle: 3296, stufe: 'abweicht' },
    ]);
  });

  it('es wird nichts geschrieben', async () => {
    await ladeWerDarfWas(GRUPPE, KAT);
    expect(schreibAufrufe).toBe(0);
  });

  it('Lesefehler wird geworfen', async () => {
    leseFehler = true;
    await expect(ladeWerDarfWas(GRUPPE, KAT)).rejects.toThrow();
  });
});

describe('ladeRollen / pruefeRechte', () => {
  it('ladeRollen: aktive Rollen mit Leiter-Kennzeichen', async () => {
    expect(await ladeRollen(GRUPPE)).toEqual([
      { id: 3290, name: 'Leiter', leitung: true },
      { id: 3287, name: 'Mitarbeiter', leitung: false },
      { id: 3296, name: 'Coach', leitung: false },
    ]);
  });

  it('pruefeRechte: nichts gesetzt → „nichts“; Soll gesetzt → null; abweichend → mit Namen', async () => {
    expect(await pruefeRechte(GRUPPE, KAT)).toEqual({ art: 'nichts' });
    rechte = [...soll([3290, 'leitung']), ...soll([3287, 'redakteur'])];
    expect(await pruefeRechte(GRUPPE, KAT)).toBeNull();
    rechte.push(r(3287, N.datenAnlegen, KAT.veroeffentlicht));
    expect(await pruefeRechte(GRUPPE, KAT)).toEqual({ art: 'abweicht', rollen: ['Mitarbeiter'] });
  });

  it('pruefeRechte: ein Lesefehler macht keinen Hinweis (und keinen Fehler)', async () => {
    leseFehler = true;
    expect(await pruefeRechte(GRUPPE, KAT)).toBeNull();
  });
});
