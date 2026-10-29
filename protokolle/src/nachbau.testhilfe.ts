/**
 * **Eine nachgestellte ChurchTools-Instanz für die Tests der Protokolle** (S2-1, gemeinsam seit S2-3) – sie merkt
 * sich, was gesetzt wurde, und verhält sich wie gemessen: `PUT` ergänzt Rechte, `DELETE` entzieht, Zeilen je
 * `dataId`, Kategorien mit `shorty`, Werte je Kategorie. `schlucken` lässt ChurchTools „204“ sagen und nichts
 * speichern (bei Werten: `PUT WERT`, `DELETE WERT`); `schluckeWert` dasselbe für neue Werte; `fehlerBei` antwortet jeder Anfrage dieser Art mit einem Fehler.
 *
 * Termine und Gruppentreffen anlegen (S5-2, gemessen 28.10.2026): Person 1 legt an und hat sofort zugesagt, die anderen
 * sind offen. `terminFehler`/`treffenFehler` antworten mit einem Fehler – `angelegt` heißt: trotzdem angelegt (eine
 * unklare Antwort). `ctVerbot` macht daraus ein ChurchTools-„verboten“ (mit `messageKey`).
 *
 * Termine ändern und löschen (K2b, gemessen 29.10.2026): `PUT` ersetzt die Grundfelder (was fehlt, ist weg); **mit**
 * `meetingrequests` gleicht er die Eingeladenen ab und setzt bei neuer Zeit die Zusagen zurück. Jede Mail landet in
 * `mails` (Person 1 ändert und bekommt keine). `terminAendernFehler` antwortet dem `PUT`/`DELETE` mit einem Fehler –
 * `angelegt` heißt: trotzdem ausgeführt.
 *
 * Serien (K2b-2, gemessen 29.10.2026): wöchentlich (`repeatId` 7) bis `repeatUntil`, ohne `exceptions` – die Termine
 * stehen einzeln in der Liste und als `calculatedDates` am Termin. Teilen (`POST …/appointments/{id}` mit `splitDate`):
 * `splitUntilEnd: false` setzt die Ausnahme, `true` endet die Serie am Vortag (am ersten Termin: 422); der neue Termin
 * hat keine Einladungen – außer mit `meetingrequests`, dann mailt ChurchTools „geändert“ (irreführend, gemessen). Löschen einer Serie mailt „Terminserie gelöscht“. Bleibt nur ein Termin übrig, wird
 * daraus ein Einzeltermin. `teilenFehler` wie `terminFehler`.
 */
import { vi } from 'vitest';
import { _bremseLoesen, _vergissCsrf } from '@ui/ct/verbindung';

export const MODUL = 24;
export const N = { view: 2060, kat: 2061, dat: 2065, anl: 2066, aend: 2067, loe: 2068 };
export const DEFINITIONEN = {
  modules: [
    {
      key: 'churchcal',
      permissions: [
        { authId: 403, key: 'view category' },
        { authId: 404, key: 'edit category' },
      ],
    },
    {
      key: 'protokolle',
      permissions: [
        { authId: N.view, key: 'view' },
        { authId: N.kat, key: 'view custom category' },
        { authId: N.dat, key: 'view custom data' },
        { authId: N.anl, key: 'create custom data' },
        { authId: N.aend, key: 'edit custom data' },
        { authId: N.loe, key: 'delete custom data' },
      ],
    },
  ],
};
export const LEITER = 2126;
export const TEILNEHMER = 2123;

export const schl = (authId: number, dataId: number | null | undefined): string =>
  `${authId}:${dataId ?? '-'}`;

export interface AnlegeFehler {
  status: number;
  angelegt: boolean;
  ctVerbot?: boolean;
}

export interface Nachbau {
  rechte: Map<number, Set<string>>;
  kategorien: { id: number; shorty: string; name: string }[];
  werte: Map<number, { id: number; value: string }[]>;
  naechste: number;
  aufrufe: string[];
  admin: boolean;
  schlucken: Set<string>;
  schluckeWert: ((value: string) => boolean) | null;
  fehlerBei: { methode: string; status: number } | null;
  /** Termine je Kalender mit ihren Besprechungsanfragen (Person + ChurchTools-Zustand, gemessen S3-3). */
  termine: {
    kalender: number;
    id: number;
    titel: string;
    beginn: string;
    ende?: string;
    anfragen: { person: number; state: string; id?: number }[];
    /** Weitere Grundfelder (Untertitel, Beschreibung, Ort …) und Wiederholung – wie gelesen. */
    felder?: Record<string, unknown>;
    repeatId?: number;
  }[];
  /** Mails, die ChurchTools verschickt hätte (K2b). */
  mails: { person: number; art: 'neu' | 'geaendert' | 'geloescht' | 'serie-geloescht' }[];
  teilenFehler: AnlegeFehler | null;
  terminAendernFehler: AnlegeFehler | null;
  terminFehler: AnlegeFehler | null;
  /** `GET` eines einzelnen Termins scheitert (500). */
  terminLesenFehler: boolean;
  /** Diese Personen nimmt ChurchTools beim Anlegen nicht als eingeladen an. */
  anfrageVerschluckt: Set<number>;
  treffenFehler: AnlegeFehler | null;
  /** Gruppentreffen je Gruppe; `treffenVerboten` = ChurchTools antwortet 403 (Gruppentyp, S2-4). */
  treffen: Map<
    number,
    {
      id: number;
      startDate: string;
      isCanceled?: boolean;
      isCompleted?: boolean;
      comment?: string | null;
    }[]
  >;
  treffenVerboten: boolean;
  /** Zuletzt angefragter Zeitraum der Termine (`from`/`to`) – zum Prüfen. */
  terminAnfrage: string | null;
  definitionen: unknown;
}

function json(status: number, body: unknown): Response {
  return new Response(status === 204 ? null : JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

/** Startet den Nachbau (in `beforeEach`); `nachbauEnde` in `afterEach`. */
export function nachbauStarten(): Nachbau {
  _vergissCsrf();
  _bremseLoesen();
  const s: Nachbau = {
    rechte: new Map(),
    kategorien: [],
    werte: new Map(),
    naechste: 50,
    aufrufe: [],
    admin: true,
    schlucken: new Set(),
    schluckeWert: null,
    fehlerBei: null,
    termine: [],
    mails: [],
    teilenFehler: null,
    terminAendernFehler: null,
    terminFehler: null,
    terminLesenFehler: false,
    anfrageVerschluckt: new Set(),
    treffenFehler: null,
    treffen: new Map(),
    treffenVerboten: false,
    terminAnfrage: null,
    definitionen: DEFINITIONEN,
  };
  vi.stubGlobal('window', {
    settings: { base_url: 'https://ct.test/' },
    location: { origin: 'https://ct.test' },
  });
  const antwort = (input: string | URL | Request, init: RequestInit | undefined): Response => {
    const tagVon = (iso: string) => iso.slice(0, 10);
    // Die Termine eines Eintrags – bei einer wöchentlichen Serie jede Woche bis `repeatUntil`, ohne Ausnahmen.
    const vorkommen = (t: Nachbau['termine'][number]): { beginn: string; ende?: string }[] => {
      if (!t.repeatId) return [{ beginn: t.beginn, ...(t.ende ? { ende: t.ende } : {}) }];
      const bis = typeof t.felder?.repeatUntil === 'string' ? t.felder.repeatUntil : '9999-12-31';
      const ohne = new Set(
        ((t.felder?.exceptions as { date: string }[] | undefined) ?? []).map((e) => e.date),
      );
      const dauer = t.ende ? Date.parse(t.ende) - Date.parse(t.beginn) : 0;
      const liste: { beginn: string; ende?: string }[] = [];
      for (let ms = Date.parse(t.beginn), n = 0; n < 60; ms += 7 * 86_400_000, n++) {
        const b = new Date(ms).toISOString().replace('.000Z', 'Z');
        if (tagVon(b) > bis) break;
        if (!ohne.has(tagVon(b)))
          liste.push({
            beginn: b,
            ...(t.ende ? { ende: new Date(ms + dauer).toISOString().replace('.000Z', 'Z') } : {}),
          });
      }
      return liste;
    };
    // Bleibt von einer Serie nur ein Termin, wird sie ein Einzeltermin (gemessen 29.10.2026, `repeatId` 0).
    const normalisieren = (t: Nachbau['termine'][number]) => {
      const v = vorkommen(t);
      if (!t.repeatId || v.length !== 1) return;
      t.repeatId = 0;
      t.beginn = v[0].beginn;
      if (v[0].ende) t.ende = v[0].ende;
      t.felder = { ...t.felder, repeatUntil: null, repeatFrequency: null, exceptions: [] };
    };
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    const adresse = new URL(url);
    const pfad = adresse.pathname.replace(/^\/api/, '');
    const m = (init?.method ?? 'GET').toUpperCase();
    const body =
      typeof init?.body === 'string' ? (JSON.parse(init.body) as Record<string, unknown>) : {};
    s.aufrufe.push(`${m} ${pfad}`);
    if (pfad === '/csrftoken') return json(200, { data: 't' });
    if (s.fehlerBei && s.fehlerBei.methode === m)
      return json(s.fehlerBei.status, { message: 'weg' });
    if (pfad === '/permissions/global')
      return json(200, { data: { churchcore: { 'administer persons': s.admin } } });
    if (pfad === '/permissions/definitions') return json(200, { data: s.definitionen });
    if (pfad === '/groups')
      return json(200, {
        data: [
          { id: 194, name: 'Technik', settings: { isHidden: false } },
          { id: 11, name: 'Gemeindeleitung', settings: { isHidden: true } },
        ],
        meta: { pagination: { lastPage: 1 } },
      });
    if (pfad === '/calendars') return json(200, { data: [{ id: 4, name: 'Gemeindeleitung' }] });
    if (pfad === '/calendars/appointments') {
      const kal = adresse.searchParams.getAll('calendar_ids[]').map(Number);
      s.terminAnfrage = `${adresse.searchParams.get('from')}..${adresse.searchParams.get('to')}`;
      return json(200, {
        data: s.termine
          .filter((t) => kal.includes(t.kalender))
          .flatMap((t) =>
            vorkommen(t).map((v) => ({
              base: { id: t.id, title: t.titel, calendar: { id: t.kalender } },
              calculated: { startDate: v.beginn, ...(v.ende ? { endDate: v.ende } : {}) },
            })),
          ),
      });
    }
    const fehlerAntwort = (f: AnlegeFehler) =>
      json(
        f.status,
        f.ctVerbot
          ? { message: 'Forbidden', messageKey: 'error.forbidden.edit' }
          : { message: 'weg' },
      );
    const neuT = /^\/calendars\/(\d+)\/appointments$/.exec(pfad);
    if (neuT && m === 'POST') {
      const id = s.naechste++;
      const f = s.terminFehler;
      if (!f || f.angelegt)
        s.termine.push({
          kalender: Number(neuT[1]),
          id,
          titel: String(body.title),
          beginn: String(body.startDate),
          ende: String(body.endDate),
          anfragen: ((body.meetingrequests as { inviteeId: number }[] | undefined) ?? [])
            .filter((a) => !s.anfrageVerschluckt.has(a.inviteeId))
            .map((a) => ({
              person: a.inviteeId,
              state: a.inviteeId === 1 ? 'accepted' : 'pending',
            })),
        });
      return f ? fehlerAntwort(f) : json(201, { data: { id } });
    }
    const einT = /^\/calendars\/(\d+)\/appointments\/(\d+)$/.exec(pfad);
    if (einT && m === 'GET') {
      if (s.terminLesenFehler) return json(500, { message: 'weg' });
      const t = s.termine.find((x) => x.id === Number(einT[2]));
      return t
        ? json(200, {
            data: {
              appointment: {
                id: t.id,
                title: t.titel,
                startDate: t.beginn,
                ...(t.ende ? { endDate: t.ende } : {}),
                isInternal: false,
                repeatId: t.repeatId ?? 0,
                signup: null,
                ...t.felder,
              },
              calculatedDates: vorkommen(t).map((v) => ({
                startDate: v.beginn,
                ...(v.ende ? { endDate: v.ende } : {}),
              })),
            },
          })
        : json(404, { message: 'weg' });
    }
    if (einT && m === 'POST') {
      // Teilen (K2b-2): der neue Termin aus dem Rumpf, die alte Serie verliert den Tag bzw. endet am Vortag.
      const t = s.termine.find((x) => x.id === Number(einT[2]));
      if (!t) return json(404, { message: 'weg' });
      const tag = String(body.splitDate);
      if (body.splitUntilEnd === true && tag <= tagVon(t.beginn))
        return json(422, { message: 'Series cannot be split on or before start date.' });
      const f = s.teilenFehler;
      const id = s.naechste++;
      if (!f || f.angelegt) {
        t.felder ??= {};
        if (body.splitUntilEnd === true)
          t.felder.repeatUntil = new Date(Date.parse(tag) - 86_400_000).toISOString().slice(0, 10);
        else
          t.felder.exceptions = [
            ...((t.felder.exceptions as { date: string }[] | undefined) ?? []),
            { date: tag },
          ];
        const {
          title,
          startDate,
          endDate,
          repeatId,
          splitDate: _d,
          splitUntilEnd: _u,
          meetingrequests,
          isInternal: _i,
          ...rest
        } = body;
        // Mit Liste lädt ChurchTools ein – und mailt über die ALTE Serie („Wöchentlicher Termin … geändert“, gemessen).
        const liste = ((meetingrequests as { inviteeId: number }[] | undefined) ?? []).map(
          (a) => a.inviteeId,
        );
        for (const p of liste) if (p !== 1) s.mails.push({ person: p, art: 'geaendert' });
        s.termine.push({
          kalender: t.kalender,
          id,
          titel: String(title),
          beginn: String(startDate),
          ende: String(endDate),
          anfragen: liste.map((p) => ({
            person: p,
            state: p === 1 ? 'accepted' : 'pending',
            id: s.naechste++,
          })),
          felder: rest,
          repeatId: typeof repeatId === 'number' ? repeatId : 0,
        });
        normalisieren(t);
        normalisieren(s.termine[s.termine.length - 1]);
      }
      return f ? fehlerAntwort(f) : json(200, { data: { id } });
    }
    if (einT && (m === 'PUT' || m === 'DELETE')) {
      const t = s.termine.find((x) => x.id === Number(einT[2]));
      if (!t) return json(404, { message: 'weg' });
      const f = s.terminAendernFehler;
      if (f && !f.angelegt) return fehlerAntwort(f);
      const andere = <A extends { person: number }>(liste: A[]) =>
        liste.filter((a) => a.person !== 1);
      if (m === 'DELETE') {
        s.termine.splice(s.termine.indexOf(t), 1);
        for (const a of andere(t.anfragen))
          s.mails.push({ person: a.person, art: t.repeatId ? 'serie-geloescht' : 'geloescht' });
        return f ? fehlerAntwort(f) : json(204, null);
      }
      const zeitNeu = body.startDate !== t.beginn || body.endDate !== t.ende;
      const titelNeu = body.title !== t.titel;
      const { title, startDate, endDate, repeatId, meetingrequests, ...rest } = body;
      t.titel = String(title);
      t.beginn = String(startDate);
      t.ende = String(endDate);
      t.repeatId = typeof repeatId === 'number' ? repeatId : 0;
      // Wie gemessen: Was im `PUT` fehlt, ist danach leer.
      t.felder = rest;
      delete t.felder.isInternal;
      normalisieren(t);
      if (Array.isArray(meetingrequests)) {
        const soll = (meetingrequests as { inviteeId: number }[]).map((x) => x.inviteeId);
        for (const a of andere(t.anfragen.filter((x) => !soll.includes(x.person))))
          s.mails.push({ person: a.person, art: 'geloescht' });
        t.anfragen = t.anfragen.filter((x) => soll.includes(x.person));
        for (const a of andere(t.anfragen))
          if (zeitNeu || titelNeu) {
            s.mails.push({ person: a.person, art: 'geaendert' });
            if (zeitNeu) a.state = 'pending';
          }
        for (const p of soll)
          if (!t.anfragen.some((x) => x.person === p)) {
            t.anfragen.push({
              person: p,
              state: p === 1 ? 'accepted' : 'pending',
              id: s.naechste++,
            });
            if (p !== 1) s.mails.push({ person: p, art: 'neu' });
          }
      }
      return f ? fehlerAntwort(f) : json(200, { data: {} });
    }
    const eineAnfr = /^\/calendars\/(\d+)\/appointments\/(\d+)\/meetingrequests\/(\d+)$/.exec(pfad);
    if (eineAnfr && m === 'DELETE') {
      const t = s.termine.find((x) => x.id === Number(eineAnfr[2]));
      const i = (t?.anfragen ?? []).findIndex((x, n) => (x.id ?? n + 1) === Number(eineAnfr[3]));
      if (!t || i < 0) return json(404, { message: 'weg' });
      const [a] = t.anfragen.splice(i, 1);
      if (a.person !== 1) s.mails.push({ person: a.person, art: 'geloescht' });
      return json(204, null);
    }
    const anfr = /^\/calendars\/(\d+)\/appointments\/(\d+)\/meetingrequests$/.exec(pfad);
    if (anfr && m === 'POST') {
      const t = s.termine.find((x) => x.id === Number(anfr[2]));
      if (!t) return json(404, { message: 'weg' });
      const p = Number(body.inviteeId);
      t.anfragen.push({ person: p, state: p === 1 ? 'accepted' : 'pending', id: s.naechste++ });
      if (p !== 1) s.mails.push({ person: p, art: 'neu' });
      return json(201, { data: {} });
    }
    if (anfr) {
      const t = s.termine.find((x) => x.id === Number(anfr[2]));
      return json(200, {
        data: (t?.anfragen ?? []).map((x, i) => ({
          id: x.id ?? i + 1,
          person: { domainIdentifier: String(x.person) },
          state: x.state,
        })),
      });
    }
    const tr = /^\/groups\/(\d+)\/meetings$/.exec(pfad);
    if (tr && m === 'POST') {
      const f = s.treffenFehler;
      const liste = s.treffen.get(Number(tr[1])) ?? [];
      s.treffen.set(Number(tr[1]), liste);
      const id = s.naechste++;
      if (!f || f.angelegt) liste.push({ id, startDate: String(body.startDate) });
      return f ? fehlerAntwort(f) : json(201, { data: { id } });
    }
    const einTr = /^\/groups\/(\d+)\/meetings\/(\d+)$/.exec(pfad);
    if (einTr) {
      if (s.treffenVerboten)
        return json(403, { message: 'Forbidden', messageKey: 'error.forbidden.edit' });
      const liste = s.treffen.get(Number(einTr[1])) ?? [];
      const t = liste.find((x) => x.id === Number(einTr[2]));
      if (!t) return json(404, { message: 'weg' });
      if (m === 'GET') return json(200, { data: t });
      if (m === 'DELETE') {
        liste.splice(liste.indexOf(t), 1);
        return json(204, null);
      }
      // Wie gemessen (16.10. + 29.10.2026): ohne `isCanceled`/`isCompleted` 400; ein fehlender Kommentar wird geleert.
      if (typeof body.isCanceled !== 'boolean' || typeof body.isCompleted !== 'boolean')
        return json(400, { message: 'validation' });
      t.startDate = String(body.startDate);
      t.isCanceled = body.isCanceled;
      t.isCompleted = body.isCompleted;
      t.comment = typeof body.comment === 'string' ? body.comment : null;
      return json(200, { data: t });
    }
    if (tr) {
      if (s.treffenVerboten)
        return json(403, { message: 'Forbidden to see group', messageKey: 'error.forbidden.view' });
      // Wie gemessen (28.10.2026): `end_date` zählt nicht mit.
      const von = adresse.searchParams.get('start_date') ?? '';
      const bis = adresse.searchParams.get('end_date') ?? '9999';
      return json(200, {
        data: (s.treffen.get(Number(tr[1])) ?? []).filter(
          (t) => t.startDate.slice(0, 10) >= von && t.startDate.slice(0, 10) < bis,
        ),
      });
    }
    if (pfad === '/groups/194/roles')
      return json(200, {
        data: [
          { id: LEITER, nameTranslated: 'Leiter', isLeader: true, isActive: true },
          { id: TEILNEHMER, nameTranslated: 'Teilnehmer', isLeader: false, isActive: true },
          { id: 9, nameTranslated: 'Alt', isActive: false },
        ],
      });
    const r = /^\/permissions\/group_role\/(\d+)$/.exec(pfad);
    if (r) {
      const rolle = Number(r[1]);
      const set = s.rechte.get(rolle) ?? new Set<string>();
      s.rechte.set(rolle, set);
      if (m === 'GET')
        return json(200, {
          data: [...set].map((x) => {
            const [a, d] = x.split(':');
            return { authId: Number(a), dataId: d === '-' ? null : Number(d), type: 'grant' };
          }),
        });
      const k = schl(body.authId as number, (body.dataId as number[] | undefined)?.[0]);
      if (s.schlucken.has(`${m} ${k}`)) return json(204, null);
      if (m === 'PUT') set.add(k);
      if (m === 'DELETE') set.delete(k);
      return json(204, null);
    }
    if (pfad === `/custommodules/${MODUL}/customdatacategories`) {
      if (m === 'POST') {
        s.kategorien.push({
          id: s.naechste++,
          shorty: String(body.shorty),
          name: String(body.name),
        });
        return json(201, { data: {} });
      }
      return json(200, { data: s.kategorien });
    }
    const w =
      /^\/custommodules\/\d+\/customdatacategories\/(\d+)\/customdatavalues(?:\/(\d+))?$/.exec(
        pfad,
      );
    if (w) {
      const liste = s.werte.get(Number(w[1])) ?? [];
      s.werte.set(Number(w[1]), liste);
      if (m === 'GET') return json(200, { data: liste });
      const wert = liste.find((x) => x.id === Number(w[2]));
      if (m === 'POST' && s.schluckeWert?.(String(body.value))) return json(201, { data: {} });
      if (m === 'POST') liste.push({ id: s.naechste++, value: String(body.value) });
      if (m === 'PUT' && wert && !s.schlucken.has('PUT WERT')) wert.value = String(body.value);
      if (m === 'DELETE' && wert && !s.schlucken.has('DELETE WERT'))
        liste.splice(liste.indexOf(wert), 1);
      if ((m === 'PUT' || m === 'DELETE') && !wert) return json(404, { message: 'weg' });
      return json(m === 'POST' ? 201 : m === 'DELETE' ? 204 : 200, { data: {} });
    }
    return json(404, { message: `nicht nachgestellt: ${m} ${pfad}` });
  };
  vi.spyOn(globalThis, 'fetch').mockImplementation((input, init) =>
    Promise.resolve(antwort(input, init)),
  );
  return s;
}

export function nachbauEnde(): void {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
}

/** Die Rechte einer Rolle, sortiert (`authId:dataId`). */
export const rechteVon = (s: Nachbau, rolle: number): string[] =>
  [...(s.rechte.get(rolle) ?? [])].sort();

/** Die Kategorie-ID zu einem Kürzel. */
export const kategorieVon = (s: Nachbau, shorty: string): number =>
  s.kategorien.find((k) => k.shorty === shorty)!.id;

/** Die Werte-Liste einer Kategorie – wird angelegt, falls noch nichts darin steht. */
export const werteVon = (s: Nachbau, kategorie: number): { id: number; value: string }[] => {
  const liste = s.werte.get(kategorie) ?? [];
  s.werte.set(kategorie, liste);
  return liste;
};
