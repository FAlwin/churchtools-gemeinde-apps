import { afterEach, describe, expect, it, vi } from 'vitest';
import { rollenAus } from '@shared/organigramm/mitglieder';
import { ApiError } from '@ui/ct/fehler';
import { ChurchToolsBremst } from '@ui/ct/verbindung';
import type { GruppenStand } from '@shared/dienstplan/personenDaten';
import { GLEICHZEITIG, ladePersonen, type PersonenQuelle } from './ladePersonen';

const mitglied = (personId: number, name = `Person ${personId}`) => ({
  personId,
  person: { title: name, initials: 'P' },
  groupTypeRoleId: 15,
  groupMemberStatus: 'active',
});
const abwesenheit = (id: number, personId: number) => ({
  id,
  person: { domainIdentifier: String(personId) },
  absenceReason: { nameTranslated: 'Urlaub' },
  startDate: '2026-12-01',
  endDate: '2026-12-07',
});

/** Ein nachgebauter Anschluss, der alle Abfragen mitschreibt. */
function quelle(
  antworten: Record<string, unknown[] | Error> = {},
  rechte: unknown = {},
): PersonenQuelle & { pfade: string[]; rechteAufrufe: number } {
  const q = {
    pfade: [] as string[],
    rechteAufrufe: 0,
    liste: (pfad: string) => {
      q.pfade.push(pfad);
      const a = antworten[pfad];
      if (a instanceof Error) return Promise.reject(a);
      return Promise.resolve(a ?? []);
    },
    rechte: () => {
      q.rechteAufrufe++;
      return rechte instanceof Error ? Promise.reject(rechte) : Promise.resolve(rechte);
    },
  };
  return q;
}
const IM_GRUPPE = (...ids: number[]) =>
  Object.fromEntries(ids.map((id) => [String(id), { churchservice: { '+view absence': true } }]));
const ZEIT = { von: '2026-12-01', bis: '2026-12-31' };
const ABW = (g: number) => `/groups/${g}/absences?from=2026-12-01&to=2027-01-01`;

const da = (s: GruppenStand | undefined) => {
  if (s?.art !== 'da') throw new Error(`nicht „da“: ${JSON.stringify(s)}`);
  return s;
};

afterEach(() => vi.restoreAllMocks());

describe('ladePersonen – das Recht vorher prüfen', () => {
  it('mit dem globalen Recht („manage absent“): alle Gruppen, das Gruppenrecht wird gar nicht erst gefragt', async () => {
    const q = quelle({ '/groups/18/members': [mitglied(5)], [ABW(18)]: [abwesenheit(1, 5)] });
    const stand = await ladePersonen([18], { ...ZEIT, abwesenheitenAller: true, quelle: q });
    expect(q.rechteAufrufe).toBe(0);
    expect(da(stand.get(18)).abwesenheiten).toHaveLength(1);
  });

  it('ohne globales Recht entscheidet die Gruppe: mit Recht wird gefragt, ohne „nicht sichtbar“ – und gar nicht gefragt', async () => {
    const q = quelle(
      { '/groups/18/members': [mitglied(5)], [ABW(18)]: [abwesenheit(1, 5)] },
      IM_GRUPPE(18),
    );
    const stand = await ladePersonen([18, 19], { ...ZEIT, abwesenheitenAller: false, quelle: q });
    expect(da(stand.get(18)).abwesenheiten).toHaveLength(1);
    // Ohne Recht liefert ChurchTools still eine LEERE Liste – die darf nie als „niemand abwesend“ gelten.
    expect(da(stand.get(19)).abwesenheiten).toBe('nichtSichtbar');
    expect(q.pfade).toContain(ABW(18));
    expect(q.pfade).not.toContain(ABW(19));
    // Die Mitglieder werden trotzdem geladen.
    expect(q.pfade).toContain('/groups/19/members');
  });

  it('der Zeitraum geht an ChurchTools: von bis einen Tag nach `bis` (ChurchTools zählt `to` nicht mit)', async () => {
    const q = quelle();
    await ladePersonen([18], { ...ZEIT, abwesenheitenAller: true, quelle: q });
    expect(q.pfade).toContain('/groups/18/absences?from=2026-12-01&to=2027-01-01');
  });

  it('Rechteabfrage verweigert (403/404) → kein Recht (dauerhaft); vorübergehend → Fehler je Gruppe, nichts behauptet', async () => {
    const verweigert = await ladePersonen([18], {
      ...ZEIT,
      abwesenheitenAller: false,
      quelle: quelle({}, new ApiError(403, 'nein')),
    });
    expect(da(verweigert.get(18)).abwesenheiten).toBe('nichtSichtbar');

    const q = quelle({}, new ApiError(504, 'Zeitüberschreitung'));
    const vorueber = await ladePersonen([18, 19], {
      ...ZEIT,
      abwesenheitenAller: false,
      quelle: q,
    });
    for (const id of [18, 19]) {
      expect(vorueber.get(id)).toMatchObject({ art: 'fehler', nochmal: true });
    }
    // Es wurde nichts weiter abgefragt: ohne Recht-Antwort steht nichts fest.
    expect(q.pfade).toEqual([]);
  });

  it('Rechteabfrage 401 (abgemeldet) → wirft', async () => {
    await expect(
      ladePersonen([18], {
        ...ZEIT,
        abwesenheitenAller: false,
        quelle: quelle({}, new ApiError(401, 'ab')),
      }),
    ).rejects.toMatchObject({ status: 401 });
  });
});

describe('ladePersonen – je Gruppe einmal, Mitglieder', () => {
  it('jede CT-Gruppe einmal, auch wenn sie mehrfach genannt wird (Kamera Saal/Studio/Mobil)', async () => {
    const q = quelle();
    await ladePersonen([18, 18, 18, 41], { ...ZEIT, abwesenheitenAller: true, quelle: q });
    expect(q.pfade.filter((p) => p === '/groups/18/members')).toHaveLength(1);
    expect(q.pfade.filter((p) => p === ABW(18))).toHaveLength(1);
  });

  it('nur aktive, nicht beendete Mitglieder – jede Person einmal', async () => {
    const q = quelle({
      '/groups/18/members': [
        mitglied(5, 'Anna Gans'),
        mitglied(5, 'Anna Gans'),
        { ...mitglied(6), groupMemberStatus: 'requested' },
        { ...mitglied(7), memberEndDate: '2026-01-01' },
      ],
    });
    const stand = await ladePersonen([18], { ...ZEIT, abwesenheitenAller: true, quelle: q });
    const m = da(stand.get(18)).mitglieder;
    expect(m).not.toBe('verborgen');
    expect((m as { id: number }[]).map((x) => x.id)).toEqual([5]);
  });

  it('höchstens vier Gruppen gleichzeitig (ChurchTools bremst sonst)', async () => {
    let laeuft = 0;
    let max = 0;
    const q: PersonenQuelle = {
      rechte: () => Promise.resolve({}),
      liste: async () => {
        laeuft++;
        max = Math.max(max, laeuft);
        await new Promise((r) => setTimeout(r, 5));
        laeuft--;
        return [];
      },
    };
    // Je Gruppe zwei Abfragen gleichzeitig (Mitglieder + Abwesenheiten) → höchstens 2 × GLEICHZEITIG.
    await ladePersonen([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], {
      ...ZEIT,
      abwesenheitenAller: true,
      quelle: q,
    });
    expect(max).toBeGreaterThan(2);
    expect(max).toBeLessThanOrEqual(2 * GLEICHZEITIG);
  });
});

describe('ladePersonen – die Fehlerzweige einzeln', () => {
  const lade = (antworten: Record<string, unknown[] | Error>) =>
    ladePersonen([18, 19], {
      ...ZEIT,
      abwesenheitenAller: true,
      quelle: quelle(antworten),
    });

  it('403 auf die Mitglieder = „verborgen“ (dauerhaft), 403 auf die Abwesenheiten = „nicht sichtbar“', async () => {
    const stand = await lade({
      '/groups/18/members': new ApiError(403, 'nein'),
      [ABW(19)]: new ApiError(403, 'nein'),
    });
    expect(da(stand.get(18))).toMatchObject({ mitglieder: 'verborgen', abwesenheiten: [] });
    expect(da(stand.get(19))).toMatchObject({ abwesenheiten: 'nichtSichtbar' });
  });

  it('Zeitüberschreitung (504) einer Gruppe: Fehler NUR dieser Gruppe, „Nochmal“ lohnt, die andere bleibt', async () => {
    const stand = await lade({
      '/groups/18/members': new ApiError(504, 'Zeitüberschreitung'),
      '/groups/19/members': [mitglied(5)],
    });
    expect(stand.get(18)).toMatchObject({ art: 'fehler', nochmal: true });
    expect(da(stand.get(19)).mitglieder).toHaveLength(1);
  });

  it('5xx bei den Abwesenheiten: auch die Mitglieder derselben Gruppe stehen als Fehler (nichts Halbes behaupten)', async () => {
    const stand = await lade({
      '/groups/18/members': [mitglied(5)],
      [ABW(18)]: new ApiError(502, 'weg'),
    });
    expect(stand.get(18)).toMatchObject({ art: 'fehler', nochmal: true });
  });

  it('Netzfehler (kein ApiError) und Drosselung (429) sind vorübergehend, nicht „verborgen“', async () => {
    const netz = await lade({ '/groups/18/members': new TypeError('Failed to fetch') });
    expect(netz.get(18)).toMatchObject({ art: 'fehler', nochmal: true });
    const bremse = await lade({ '/groups/19/members': new ChurchToolsBremst(5000) });
    expect(bremse.get(19)).toMatchObject({ art: 'fehler', nochmal: true });
  });

  it('ein anderer 4xx (z. B. 404, Gruppe gelöscht) zeigt die Meldung von ChurchTools, ebenfalls mit „Nochmal“', async () => {
    const stand = await lade({ '/groups/18/members': new ApiError(404, 'Gruppe gibt es nicht') });
    expect(stand.get(18)).toEqual({ art: 'fehler', text: 'Gruppe gibt es nicht', nochmal: true });
  });

  it('401 (abgemeldet) gilt für alles: es wird geworfen, nicht jede Gruppe als Fehler gezeigt', async () => {
    await expect(lade({ '/groups/19/members': new ApiError(401, 'ab') })).rejects.toMatchObject({
      status: 401,
    });
  });

  it('keine Namen oder IDs von Personen in console.*', async () => {
    const spione = (['log', 'info', 'warn', 'error', 'debug'] as const).map((n) =>
      vi.spyOn(console, n).mockImplementation(() => {}),
    );
    await lade({
      '/groups/18/members': [mitglied(5, 'Anna Gans')],
      [ABW(18)]: new ApiError(504, 'Zeitüberschreitung'),
    });
    for (const s of spione) expect(s).not.toHaveBeenCalled();
  });
});

describe('CT_QUELLE – wie die Listen wirklich geholt werden', () => {
  it('Mitglieder: ctAlleSeiten (alle Seiten) – die Seitenteilung ist Sache des Bausteins', async () => {
    vi.resetModules();
    const alle = vi.fn(() => Promise.resolve([{ personId: 1 }]));
    vi.doMock('@ui/ct/verbindung', () => ({
      ctAlleSeiten: alle,
      ctAnfrage: vi.fn(),
      ctDaten: vi.fn(),
    }));
    const { CT_QUELLE: q } = await import('./ladePersonen');
    expect(await q.liste('/groups/18/members')).toEqual([{ personId: 1 }]);
    expect(alle).toHaveBeenCalledWith('/groups/18/members');
    vi.doUnmock('@ui/ct/verbindung');
  });

  it('Abwesenheiten ohne Seitenteilung: eine Abfrage ohne limit; mit mehreren Seiten werden alle geholt', async () => {
    vi.resetModules();
    const anfrage = vi.fn();
    const alle = vi.fn(() => Promise.resolve([{ id: 1 }, { id: 2 }]));
    vi.doMock('@ui/ct/verbindung', () => ({
      ctAlleSeiten: alle,
      ctAnfrage: anfrage,
      ctDaten: vi.fn(),
    }));
    const { CT_QUELLE: q } = await import('./ladePersonen');
    const pfad = '/groups/18/absences?from=2026-12-01&to=2027-01-01';

    anfrage.mockResolvedValueOnce({ data: [{ id: 1 }], meta: { pagination: { lastPage: 1 } } });
    expect(await q.liste(pfad)).toEqual([{ id: 1 }]);
    expect(alle).not.toHaveBeenCalled();
    expect(anfrage).toHaveBeenCalledWith(pfad);

    anfrage.mockResolvedValueOnce({ data: [{ id: 1 }], meta: { pagination: { lastPage: 3 } } });
    expect(await q.liste(pfad)).toEqual([{ id: 1 }, { id: 2 }]);
    expect(alle).toHaveBeenCalledWith(pfad, 200);

    // Keine Liste ist kein „nichts eingetragen“.
    anfrage.mockResolvedValueOnce({ data: null });
    await expect(q.liste(pfad)).rejects.toMatchObject({ status: 502 });
    anfrage.mockResolvedValueOnce(null);
    await expect(q.liste(pfad)).rejects.toMatchObject({ status: 502 });
    vi.doUnmock('@ui/ct/verbindung');
  });

  it('Rechte: `/permissions/internal/groups`', async () => {
    vi.resetModules();
    const daten = vi.fn(() => Promise.resolve({ '18': {} }));
    vi.doMock('@ui/ct/verbindung', () => ({
      ctAlleSeiten: vi.fn(),
      ctAnfrage: vi.fn(),
      ctDaten: daten,
    }));
    const { CT_QUELLE: q } = await import('./ladePersonen');
    expect(await q.rechte()).toEqual({ '18': {} });
    expect(daten).toHaveBeenCalledWith('/permissions/internal/groups');
    vi.doUnmock('@ui/ct/verbindung');
  });
});

describe('ladePersonen – die Leitung (E5c-6, „Vertretung suchen“: Kopie an die Leitung)', () => {
  const rollen = rollenAus([
    { id: 15, name: 'Mitarbeiter', isLeader: false },
    { id: 16, name: 'Leiter', isLeader: true },
    { id: 17, name: 'Co-Leiter', nameTranslated: 'Co-Leiter', isLeader: true },
  ]);
  const mitRolle = (personId: number, rolle: number, extra: Record<string, unknown> = {}) => ({
    ...mitglied(personId),
    groupTypeRoleId: rolle,
    ...extra,
  });
  const MIT = [
    mitRolle(5, 15),
    mitRolle(6, 16),
    mitRolle(7, 17),
    mitRolle(8, 16, { memberEndDate: '2026-01-01' }), // war Leiter, ist beendet
    mitRolle(9, 16, { groupMemberStatus: 'requested' }), // nur angefragt
    mitRolle(6, 16), // dieselbe Person doppelt
  ];

  it('mit Rollen: die aktiven Mitglieder mit Leitungsrolle, einmal', async () => {
    const q = quelle({ '/groups/18/members': MIT });
    const stand = await ladePersonen([18], {
      ...ZEIT,
      abwesenheitenAller: true,
      quelle: q,
      rollen,
    });
    expect(da(stand.get(18)).leitung).toEqual([6, 7]);
  });

  it('ohne Rollen fehlt das Feld ganz – „keine Leitung“ wäre gelogen (die Ansicht „Personen“ braucht sie nicht)', async () => {
    const q = quelle({ '/groups/18/members': MIT });
    const stand = await ladePersonen([18], { ...ZEIT, abwesenheitenAller: true, quelle: q });
    expect(da(stand.get(18))).not.toHaveProperty('leitung');
  });

  it('Mitglieder nicht sichtbar (403): keine Leitung angegeben', async () => {
    const q = quelle({ '/groups/18/members': new ApiError(403, 'nein') });
    const stand = await ladePersonen([18], {
      ...ZEIT,
      abwesenheitenAller: true,
      quelle: q,
      rollen,
    });
    expect(da(stand.get(18)).mitglieder).toBe('verborgen');
    expect(da(stand.get(18))).not.toHaveProperty('leitung');
  });
});
