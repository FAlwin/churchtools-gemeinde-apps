import { describe, expect, it } from 'vitest';
import type { CtAbsence } from '../ct/typen';
import { tagAusIso } from '../ct/zeit';
import {
  abwesenheitAendern,
  abwesenheitAnlegen,
  abwesenheitLoeschen,
  ctAbwesenheiten,
  gruendeAus,
  meineAbwesenheiten,
  pruefen,
  zuAbwesenheit,
  type AbwesenheitPort,
  type CtRumpf,
} from './abwesenheiten';

const ICH = 19;
const ANDERE = 1;
const TZ = 'Europe/Berlin';
const ABWESEND = { id: 1, name: 'absent.reason.absence', nameTranslated: 'Abwesend' };
const URLAUB = { id: 2, name: 'absent.reason.vacation', nameTranslated: 'Urlaub' };
const GRUENDE = [
  { ...ABWESEND, sortKey: 2 },
  { ...URLAUB, sortKey: 1 },
  { id: 3, name: 'absent.reason.sick', nameTranslated: 'Krank', sortKey: 0 },
];

/**
 * **ChurchTools nachgebaut, wie am 04.11.2026 gemessen** (als Spike): Doppel werden angelegt; mit Uhrzeit dürfen keine
 * Tage mit (400); `PUT` ersetzt ganz (ohne Kommentar → leer); `DELETE` antwortet immer gleich, auch ohne Wirkung;
 * fremde IDs sind über den eigenen Pfad „nicht gefunden“.
 */
function nachbau(
  opt: { loeschenOhneWirkung?: boolean; antwortOhneId?: boolean; einerWirft?: number } = {},
) {
  let naechste = 100;
  const daten = new Map<number, { personId: number; a: CtAbsence }>();
  const aufrufe: string[] = [];
  const grund = (id: number) => GRUENDE.find((g) => g.id === id)!;
  const ausRumpf = (id: number, r: CtRumpf): CtAbsence => {
    if ('startDate' in r && 'startTime' in r)
      throw Object.assign(new Error('400'), { status: 400 });
    const mitZeit = 'startTime' in r;
    return {
      id,
      startDate: mitZeit ? tagAusIso(r.startTime, TZ) : r.startDate,
      endDate: mitZeit ? tagAusIso(r.endTime, TZ) : r.endDate,
      startTime: mitZeit ? r.startTime : null,
      endTime: mitZeit ? r.endTime : null,
      comment: r.comment ?? '',
      absenceReason: grund(r.absenceReasonId),
    };
  };
  const port: AbwesenheitPort = {
    async liste(p, von, bis) {
      aufrufe.push(`GET ${p} ${von}..${bis}`);
      // Gemessen: Bei Einträgen MIT Uhrzeit gilt `to` als Mitternacht am Anfang des Tages – ein Fenster am Tag `bis`
      // fehlt. Ganztägige kommen bis einschließlich `bis`.
      return [...daten.values()]
        .filter(
          (d) =>
            d.personId === p &&
            (d.a.startTime
              ? Date.parse(d.a.startTime) < Date.parse(`${bis}T00:00:00Z`) &&
                Date.parse(d.a.endTime!) > Date.parse(`${von}T00:00:00Z`)
              : d.a.endDate >= von && d.a.startDate <= bis),
        )
        .map((d) => ({ ...d.a }));
    },
    async einer(p, id) {
      aufrufe.push(`GET ${p}/${id}`);
      if (opt.einerWirft && aufrufe.some((x) => x.startsWith('DELETE')))
        throw Object.assign(new Error('weg'), { status: opt.einerWirft });
      const d = daten.get(id);
      return d && d.personId === p ? { ...d.a } : null;
    },
    async anlegen(p, r) {
      aufrufe.push(`POST ${p}`);
      const a = ausRumpf(naechste++, r);
      daten.set(a.id, { personId: p, a });
      return opt.antwortOhneId ? { data: { ok: true } } : { data: a };
    },
    async ersetzen(p, id, r) {
      aufrufe.push(`PUT ${p}/${id}`);
      const d = daten.get(id);
      if (!d || d.personId !== p) throw Object.assign(new Error('404'), { status: 404 });
      const a = ausRumpf(id, r);
      daten.set(id, { personId: p, a });
      return { data: a };
    },
    async loeschen(p, id) {
      aufrufe.push(`DELETE ${p}/${id}`);
      const d = daten.get(id);
      if (!opt.loeschenOhneWirkung && d && d.personId === p) daten.delete(id);
    },
    async stammdaten() {
      return { absenceReasons: GRUENDE };
    },
  };
  const lege = (personId: number, a: Omit<CtAbsence, 'id'>) => {
    const id = naechste++;
    daten.set(id, { personId, a: { id, ...a } });
    return id;
  };
  return { port, daten, aufrufe, lege };
}

const ganzTag = (von: string, bis: string, extra: Partial<CtAbsence> = {}) => ({
  startDate: von,
  endDate: bis,
  startTime: null,
  endTime: null,
  comment: '',
  absenceReason: ABWESEND,
  ...extra,
});

describe('gruendeAus', () => {
  it('sortiert wie ChurchTools, Namen deutsch, „Abwesend“ vorgewählt (nicht der erste – das wäre „Krank“)', () => {
    expect(gruendeAus({ absenceReasons: GRUENDE })).toEqual([
      { id: 3, name: 'Krank', standard: false },
      { id: 2, name: 'Urlaub', standard: false },
      { id: 1, name: 'Abwesend', standard: true },
    ]);
  });

  it('ohne „Abwesend“ ist der erste vorgewählt; ohne `nameTranslated` wird der Schlüssel lesbar', () => {
    expect(
      gruendeAus({
        absenceReasons: [
          { id: 5, name: 'Freizeit', sortKey: 1 },
          { id: 2, name: 'absent.reason.vacation', sortKey: 0 },
        ],
      }),
    ).toEqual([
      { id: 2, name: 'Urlaub', standard: true },
      { id: 5, name: 'Freizeit', standard: false },
    ]);
  });

  it('keine Liste → keine Gründe', () => {
    expect(gruendeAus(null)).toEqual([]);
    expect(gruendeAus({ absenceReasons: {} })).toEqual([]);
  });
});

describe('zuAbwesenheit', () => {
  it('blendet ein altes „[Musikteam]“ aus und nimmt den deutschen Namen von ChurchTools', () => {
    expect(
      zuAbwesenheit({
        id: 7,
        ...ganzTag('2027-03-10', '2027-03-11', {
          comment: '[Musikteam] Familienfeier',
          absenceReason: URLAUB,
        }),
      }),
    ).toMatchObject({ id: 7, comment: 'Familienfeier', reason: 'Urlaub', reasonId: 2 });
  });
});

describe('pruefen', () => {
  const tag = { startDate: '2027-03-10', endDate: '2027-03-11', reasonId: 1 };

  it('mit Uhrzeit gehen NUR die Uhrzeiten mit – Tage dazu lehnt ChurchTools ab (gemessen 04.11.2026)', () => {
    const p = pruefen(
      { ...tag, startTime: '2027-03-14T08:30:00Z', endTime: '2027-03-14T10:30:00Z' },
      TZ,
    );
    expect(p).toEqual({
      ok: true,
      rumpf: {
        startTime: '2027-03-14T08:30:00Z',
        endTime: '2027-03-14T10:30:00Z',
        absenceReasonId: 1,
        comment: '',
      },
      tage: { startDate: '2027-03-14', endDate: '2027-03-14' },
    });
  });

  it('die Tage einer Uhrzeit sind die in der Gemeinde (0:30 Uhr am 15. ist `23:30Z` des 14.)', () => {
    const p = pruefen(
      { ...tag, startTime: '2027-03-14T23:30:00Z', endTime: '2027-03-15T01:00:00Z' },
      TZ,
    );
    expect(p.ok && p.tage).toEqual({ startDate: '2027-03-15', endDate: '2027-03-15' });
  });

  it('ganztägig: Tage, Grund, Kommentar getrimmt', () => {
    expect(pruefen({ ...tag, comment: '  Urlaub  ' }, TZ)).toMatchObject({
      ok: true,
      rumpf: {
        startDate: '2027-03-10',
        endDate: '2027-03-11',
        absenceReasonId: 1,
        comment: 'Urlaub',
      },
    });
  });

  it.each([
    [{ ...tag, endDate: '2027-03-09' }, 'Das Ende liegt vor dem Anfang.'],
    [{ ...tag, startDate: '10.03.2027' }, 'Bitte ein gültiges Datum wählen.'],
    [{ ...tag, endDate: '2028-03-11' }, 'Ein Zeitraum darf höchstens ein Jahr lang sein.'],
    [{ ...tag, startTime: '2027-03-14T08:30:00Z' }, 'Zu einer Uhrzeit gehören Anfang und Ende.'],
    [
      { ...tag, startTime: '2027-03-14T10:30:00Z', endTime: '2027-03-14T08:30:00Z' },
      'Das Ende liegt vor dem Anfang.',
    ],
    [{ ...tag, comment: 'x'.repeat(256) }, 'Der Kommentar darf höchstens 255 Zeichen lang sein.'],
  ])('%o → „%s“', (neu, text) => {
    expect(pruefen(neu, TZ)).toEqual({ ok: false, text });
  });
});

describe('abwesenheitAnlegen', () => {
  const neu = { startDate: '2027-03-10', endDate: '2027-03-11', reasonId: 1, comment: 'Urlaub' };

  it('legt an und gibt zurück, was ChurchTools gespeichert hat – ohne Kennzeichen im Kommentar', async () => {
    const ct = nachbau();
    const r = await abwesenheitAnlegen(ct.port, ICH, neu, TZ);
    expect(r).toMatchObject({
      ok: true,
      neu: true,
      absence: { startDate: '2027-03-10', comment: 'Urlaub' },
    });
    expect([...ct.daten.values()].map((d) => d.a.comment)).toEqual(['Urlaub']);
  });

  it('denselben Zeitraum gibt es schon (auch in ChurchTools gemacht, ohne Kennzeichen) → nichts geschrieben', async () => {
    const ct = nachbau();
    const id = ct.lege(ICH, ganzTag('2027-03-10', '2027-03-11', { comment: 'in CT' }));
    const r = await abwesenheitAnlegen(ct.port, ICH, neu, TZ);
    expect(r).toMatchObject({ ok: true, neu: false, absence: { id } });
    expect(ct.aufrufe.filter((a) => a.startsWith('POST'))).toEqual([]);
  });

  it('9 Uhr und 11 Uhr am selben Tag sind zwei Einträge; derselbe Termin zweimal ist einer', async () => {
    const ct = nachbau();
    const um9 = { ...neu, startTime: '2027-03-14T08:00:00Z', endTime: '2027-03-14T09:30:00Z' };
    const um11 = { ...neu, startTime: '2027-03-14T10:00:00Z', endTime: '2027-03-14T11:30:00Z' };
    await abwesenheitAnlegen(ct.port, ICH, um9, TZ);
    await abwesenheitAnlegen(ct.port, ICH, um11, TZ);
    // `+01:00` meint denselben Zeitpunkt wie `Z` – kein zweiter Eintrag.
    const nochmal = await abwesenheitAnlegen(
      ct.port,
      ICH,
      { ...um9, startTime: '2027-03-14T09:00:00+01:00', endTime: '2027-03-14T10:30:00+01:00' },
      TZ,
    );
    expect(nochmal).toMatchObject({ ok: true, neu: false });
    expect(ct.daten.size).toBe(2);
  });

  it('ein Fenster am selben Tag wird gefunden, obwohl ChurchTools es bei `to` = Tag nicht liefert (gemessen)', async () => {
    const ct = nachbau();
    const um9 = { ...neu, startTime: '2027-03-14T08:00:00Z', endTime: '2027-03-14T09:30:00Z' };
    const erst = await abwesenheitAnlegen(ct.port, ICH, um9, TZ);
    const nochmal = await abwesenheitAnlegen(ct.port, ICH, um9, TZ);
    expect(nochmal).toMatchObject({
      ok: true,
      neu: false,
      absence: { id: erst.ok && erst.absence.id },
    });
    expect(ct.daten.size).toBe(1);
  });

  it('ein ganztägiger Eintrag ist kein Doppel eines Fensters am selben Tag', async () => {
    const ct = nachbau();
    ct.lege(ICH, ganzTag('2027-03-14', '2027-03-14'));
    const r = await abwesenheitAnlegen(
      ct.port,
      ICH,
      { ...neu, startTime: '2027-03-14T08:00:00Z', endTime: '2027-03-14T09:30:00Z' },
      TZ,
    );
    expect(r).toMatchObject({ ok: true, neu: true });
  });

  it('Antwort ohne Eintrag → `unklar`, und es wird NICHT noch einmal geschickt', async () => {
    const ct = nachbau({ antwortOhneId: true });
    expect(await abwesenheitAnlegen(ct.port, ICH, neu, TZ)).toEqual({ ok: false, grund: 'unklar' });
    expect(ct.aufrufe.filter((a) => a.startsWith('POST'))).toHaveLength(1);
  });

  it('ungültig → nichts gelesen, nichts geschrieben', async () => {
    const ct = nachbau();
    const r = await abwesenheitAnlegen(ct.port, ICH, { ...neu, endDate: '2027-03-01' }, TZ);
    expect(r).toEqual({ ok: false, grund: 'ungueltig', text: 'Das Ende liegt vor dem Anfang.' });
    expect(ct.aufrufe).toEqual([]);
  });
});

describe('abwesenheitAendern', () => {
  it('ändert DENSELBEN Eintrag (gleiche ID), ohne Grund im Wunsch bleibt der bisherige', async () => {
    const ct = nachbau();
    const id = ct.lege(ICH, ganzTag('2027-03-10', '2027-03-11', { absenceReason: URLAUB }));
    const r = await abwesenheitAendern(
      ct.port,
      ICH,
      id,
      { startDate: '2027-03-10', endDate: '2027-03-12', comment: 'länger' },
      TZ,
    );
    expect(r).toMatchObject({ ok: true, absence: { id, endDate: '2027-03-12', reason: 'Urlaub' } });
    expect(ct.daten.size).toBe(1);
    expect(ct.aufrufe.filter((a) => a.startsWith('POST') || a.startsWith('DELETE'))).toEqual([]);
  });

  it('nur der Kommentar ändert sich → die Uhrzeit bleibt (sonst würde aus dem Vormittag ein ganzer Tag)', async () => {
    const ct = nachbau();
    const id = ct.lege(ICH, {
      ...ganzTag('2027-03-14', '2027-03-14'),
      startTime: '2027-03-14T08:00:00Z',
      endTime: '2027-03-14T09:30:00Z',
    });
    const r = await abwesenheitAendern(
      ct.port,
      ICH,
      id,
      { startDate: '2027-03-14', endDate: '2027-03-14', comment: 'Arzt' },
      TZ,
    );
    expect(r).toMatchObject({
      ok: true,
      absence: {
        startTime: '2027-03-14T08:00:00Z',
        endTime: '2027-03-14T09:30:00Z',
        comment: 'Arzt',
      },
    });
  });

  it('wandern die Tage, entfällt die Uhrzeit (ganztägig)', async () => {
    const ct = nachbau();
    const id = ct.lege(ICH, {
      ...ganzTag('2027-03-14', '2027-03-14'),
      startTime: '2027-03-14T08:00:00Z',
      endTime: '2027-03-14T09:30:00Z',
    });
    const r = await abwesenheitAendern(
      ct.port,
      ICH,
      id,
      { startDate: '2027-03-14', endDate: '2027-03-15' },
      TZ,
    );
    expect(r).toMatchObject({ ok: true, absence: { startTime: null, endDate: '2027-03-15' } });
  });

  it('ein altes „[Musikteam]“ fällt beim Ändern weg', async () => {
    const ct = nachbau();
    const id = ct.lege(ICH, ganzTag('2027-03-10', '2027-03-10', { comment: '[Musikteam] Feier' }));
    await abwesenheitAendern(
      ct.port,
      ICH,
      id,
      { startDate: '2027-03-10', endDate: '2027-03-10', comment: 'Feier' },
      TZ,
    );
    expect(ct.daten.get(id)!.a.comment).toBe('Feier');
  });

  it('gibt es nicht (mehr) oder gehört jemand anderem → `weg`, nichts geschrieben', async () => {
    const ct = nachbau();
    const fremd = ct.lege(ANDERE, ganzTag('2027-03-10', '2027-03-10'));
    const wunsch = { startDate: '2027-03-10', endDate: '2027-03-11' };
    expect(await abwesenheitAendern(ct.port, ICH, fremd, wunsch, TZ)).toEqual({
      ok: false,
      grund: 'weg',
    });
    expect(await abwesenheitAendern(ct.port, ICH, 9999, wunsch, TZ)).toEqual({
      ok: false,
      grund: 'weg',
    });
    expect(ct.aufrufe.filter((a) => a.startsWith('PUT'))).toEqual([]);
    expect(ct.daten.get(fremd)!.a.endDate).toBe('2027-03-10');
  });

  it('auf einen Zeitraum, den ein ANDERER eigener Eintrag belegt → `doppel`; auf den eigenen nicht', async () => {
    const ct = nachbau();
    const a = ct.lege(ICH, ganzTag('2027-03-10', '2027-03-10'));
    ct.lege(ICH, ganzTag('2027-03-12', '2027-03-12'));
    expect(
      await abwesenheitAendern(
        ct.port,
        ICH,
        a,
        { startDate: '2027-03-12', endDate: '2027-03-12' },
        TZ,
      ),
    ).toEqual({ ok: false, grund: 'doppel' });
    expect(
      await abwesenheitAendern(
        ct.port,
        ICH,
        a,
        { startDate: '2027-03-10', endDate: '2027-03-10', comment: 'nur Text' },
        TZ,
      ),
    ).toMatchObject({ ok: true });
  });
});

describe('meineAbwesenheiten', () => {
  it('nach Tag, am selben Tag nach Uhrzeit – ganztägig zuerst', async () => {
    const ct = nachbau();
    const um11 = ct.lege(ICH, {
      ...ganzTag('2027-03-14', '2027-03-14'),
      startTime: '2027-03-14T10:00:00Z',
      endTime: '2027-03-14T11:30:00Z',
    });
    const um9 = ct.lege(ICH, {
      ...ganzTag('2027-03-14', '2027-03-14'),
      startTime: '2027-03-14T08:00:00Z',
      endTime: '2027-03-14T09:30:00Z',
    });
    const ganz = ct.lege(ICH, ganzTag('2027-03-14', '2027-03-14'));
    const frueher = ct.lege(ICH, ganzTag('2027-03-13', '2027-03-14'));
    const liste = await meineAbwesenheiten(ct.port, ICH, '2027-03-13', '2027-03-14');
    expect(liste.map((a) => a.id)).toEqual([frueher, ganz, um9, um11]);
  });
});

describe('ctAbwesenheiten', () => {
  it('liest einen Tag weiter, gibt aber nur zurück, was in `von`..`bis` liegt', async () => {
    const ct = nachbau();
    const fenster = ct.lege(ICH, {
      ...ganzTag('2027-03-14', '2027-03-14'),
      startTime: '2027-03-14T08:00:00Z',
      endTime: '2027-03-14T09:30:00Z',
    });
    const amTag = ct.lege(ICH, ganzTag('2027-03-14', '2027-03-14'));
    ct.lege(ICH, ganzTag('2027-03-15', '2027-03-15'));
    const liste = await ctAbwesenheiten(ct.port, ICH, '2027-03-14', '2027-03-14');
    expect(liste.map((a) => a.id).sort()).toEqual([fenster, amTag].sort());
    expect(ct.aufrufe).toEqual([`GET ${ICH} 2027-03-14..2027-03-15`]);
  });

  it('der Tag danach stimmt auch über den Monats- und Jahreswechsel', async () => {
    const ct = nachbau();
    await ctAbwesenheiten(ct.port, ICH, '2027-12-01', '2027-12-31');
    await ctAbwesenheiten(ct.port, ICH, '2028-02-01', '2028-02-28');
    expect(ct.aufrufe).toEqual([
      `GET ${ICH} 2027-12-01..2028-01-01`,
      `GET ${ICH} 2028-02-01..2028-02-29`,
    ]);
  });
});

describe('abwesenheitLoeschen', () => {
  it('löscht und liest nach', async () => {
    const ct = nachbau();
    const id = ct.lege(ICH, ganzTag('2027-03-10', '2027-03-10'));
    expect(await abwesenheitLoeschen(ct.port, ICH, id)).toEqual({ ok: true, schonWeg: false });
    expect(ct.daten.has(id)).toBe(false);
    expect(ct.aufrufe).toEqual([`GET ${ICH}/${id}`, `DELETE ${ICH}/${id}`, `GET ${ICH}/${id}`]);
  });

  it('schon weg → fertig, ohne zu löschen', async () => {
    const ct = nachbau();
    expect(await abwesenheitLoeschen(ct.port, ICH, 9999)).toEqual({ ok: true, schonWeg: true });
    expect(ct.aufrufe.filter((a) => a.startsWith('DELETE'))).toEqual([]);
  });

  it('ChurchTools meldet Erfolg, der Eintrag steht aber noch → `nicht-geloescht` (das 204 lügt, gemessen)', async () => {
    const ct = nachbau({ loeschenOhneWirkung: true });
    const id = ct.lege(ICH, ganzTag('2027-03-10', '2027-03-10'));
    expect(await abwesenheitLoeschen(ct.port, ICH, id)).toEqual({
      ok: false,
      grund: 'nicht-geloescht',
    });
  });

  it('das Nachlesen scheitert vorübergehend → Fehler, NICHT „gelöscht“', async () => {
    const ct = nachbau({ einerWirft: 503 });
    const id = ct.lege(ICH, ganzTag('2027-03-10', '2027-03-10'));
    await expect(abwesenheitLoeschen(ct.port, ICH, id)).rejects.toMatchObject({ status: 503 });
  });
});
