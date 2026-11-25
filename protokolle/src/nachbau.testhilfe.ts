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
 *
 * Anwesenheit (S5-3, gemessen 05.11.2026): `GET …/meetings/{m}/members` liefert je Mitglied (`teilnehmer`) den Status
 * (`unsure`, solange nichts eingetragen ist); `POST /groups/{g}/checkin/{p}` = anwesend, `DELETE …/members/{p}` mit
 * `{status}` (ohne: `absent`). Jeder Eintrag setzt `hasEditingStarted` am Treffen. `teilnahmeSchlucken` antwortet 200
 * und speichert nichts.
 *
 * Termin-Vorlagen und Tags (W15-1, gemessen 23.11.2026): `GET /calendars/appointments/templates` liefert `vorlagen`,
 * `POST` legt eine an (mit `id`; `vorlagenSchlucken` sagt 201 und speichert nichts, `vorlagenFehler` antwortet mit einem
 * Fehler – `angelegt` heißt: trotzdem gespeichert, `vorlagenLesenFehler` lässt das Lesen mit 500 scheitern); `GET /tags/appointment`
 * liefert `tags`. `terminRumpf` ist der zuletzt gesendete Rumpf des `POST …/appointments`.
 *
 * Ressourcen und Buchungen (W15-2, gemessen 23.11.2026): `GET /resources` und `GET /resourcetypes` liefern `ressourcen` und
 * `ressourcenTypen`; `POST …/appointments` mit `bookings` legt je Eintrag eine Buchung an – **die Antwort enthält sie nicht**,
 * erst `GET /bookings?resource_ids[]=…&from&to` zeigt sie (`booking.base.appointment.id`). `buchungenSchlucken` nennt Ressourcen, bei
 * denen ChurchTools „201“ sagt und nichts bucht; `buchungenLesenFehler` lässt `GET /bookings` mit 500 scheitern.
 *
 * Events und Eventvorlagen (W15-3, gemessen 23.11.2026): `GET /eventtemplates` liefert `eventVorlagen` (`id`, `templateName`);
 * `POST …/appointments` mit `events: [{startDate, eventTemplateId?}]` legt je Eintrag ein Event an – **die Antwort enthält
 * sie nicht**, erst `GET /events?from&to` zeigt sie (`appointmentId`, `startDate`). `eventsSchlucken` nennt `startDate`s, bei
 * denen ChurchTools „201“ sagt und nichts anlegt; `eventsLesenFehler` lässt `GET /events` mit 500 scheitern; `eventsAnfrage`
 * ist der Suchtext der letzten Anfrage.
 *
 * Anmeldung (W15-5, gemessen 25.11.2026): `GET /group/grouptypes` liefert `gruppenTypen`; `POST …/appointments` mit
 * `signup {signupGroupTypeId, signupDaysForwardNo, …}` speichert es am Termin (`GET` zeigt es) und legt **sofort** je
 * Einzeltermin zwischen heute und heute + Tage im Voraus eine Gruppe „<Titel> – TT.MM.JJJJ, HH:MM“ (Ortszeit der Gemeinde: `gemeindeZeitzone()` – der Test setzt sie mit `merkeGemeindeZeitzone`) an –
 * sie steht in `gruppen`, `GET /groups?group_type_ids[]=…` liest sie, der Termin löschen nimmt sie mit. `signupSchlucken`:
 * ChurchTools sagt „201“ und speichert `signup` nicht; `gruppenSchlucken`: legt keine Gruppen an; `gruppenLesenFehler`: das
 * Lesen der Gruppen eines Typs scheitert (500). Wöchentliche Serien (`repeatId` 7, `repeatUntil`) kennt der Nachbau.
 *
 * Beiträge (S6-2, gemessen 11.11.2026): `GET /post/groups` nennt die Gruppen aus `beitragsGruppen` (`type: postPossible`);
 * `POST /posts` legt an und liefert die ID, `GET /posts/{id}` liest nach (404, wenn es ihn nicht gibt).
 * `beitragFehler` antwortet dem `POST` mit einem Fehler – `angelegt` heißt: trotzdem angelegt; `beitragLesenFehler`
 * lässt das Nachlesen mit diesem Status scheitern, `beitragSchlucken` sagt 201 mit ID und legt nichts an.
 */
import { vi } from 'vitest';
import { gemeindeZeitzone, heuteImKalender, ortszeitAus } from '@shared/ct/zeit';
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
  /** Kalender wie `GET /calendars` (W15-4: `type` – nur `group` hat den Reiter „Besprechungsanfragen“). */
  kalender: { id: number; name: string; type: string }[];
  /** Einträge wie `GET /calendars/{id}/meetingrequest/candidates` (W15-4, gemessen 25.11.2026). */
  kandidaten: Record<string, unknown>[];
  /** `GET …/meetingrequest/candidates` scheitert (500). */
  kandidatenFehler: boolean;
  /** `GET …/appointments/{id}/meetingrequests` scheitert (500). */
  anfragenLesenFehler: boolean;
  /** Mails, die ChurchTools verschickt hätte (K2b). */
  mails: { person: number; art: 'neu' | 'geaendert' | 'geloescht' | 'serie-geloescht' }[];
  teilenFehler: AnlegeFehler | null;
  terminAendernFehler: AnlegeFehler | null;
  terminFehler: AnlegeFehler | null;
  /** `GET` eines einzelnen Termins scheitert (500). */
  terminLesenFehler: boolean;
  /** Der Rumpf des letzten `POST /calendars/{id}/appointments` – wie gesendet (W15-1). */
  terminRumpf: Record<string, unknown> | null;
  /** Termin-Vorlagen wie ChurchTools sie liefert (W15-1). */
  vorlagen: Record<string, unknown>[];
  vorlagenFehler: AnlegeFehler | null;
  vorlagenSchlucken: boolean;
  vorlagenLesenFehler: boolean;
  /** Vorhandene Termin-Tags. */
  tags: { id: number; name: string }[];
  /** Ressourcen und Typen wie `GET /resources`, `GET /resourcetypes` (W15-2). */
  ressourcen: Record<string, unknown>[];
  ressourcenTypen: Record<string, unknown>[];
  /** Angelegte Buchungen (je Ressource und Termin). */
  buchungen: { resourceId: number; appointmentId: number; statusId: unknown; quantity: unknown }[];
  /** Für diese Ressourcen bucht ChurchTools trotz „201“ nichts. */
  buchungenSchlucken: Set<number>;
  /** `GET /bookings` liefert nur die veraltete Form `base` statt `booking.base`. */
  buchungenAlteForm?: boolean;
  /** `GET /bookings` scheitert (500). */
  buchungenLesenFehler: boolean;
  /** Der Suchtext der letzten Anfrage an `GET /bookings`. */
  buchungenAnfrage: string | null;
  /** Eventvorlagen wie `GET /eventtemplates` (W15-3). */
  eventVorlagen: Record<string, unknown>[];
  /** Angelegte Events (je Termin und Beginn). */
  events: { id: number; appointmentId: number; startDate: string; eventTemplateId: unknown }[];
  /** Für diese Beginne (`startDate`) legt ChurchTools trotz „201“ kein Event an. */
  eventsSchlucken: Set<string>;
  /** `GET /events` scheitert (500). */
  eventsLesenFehler: boolean;
  /** Der Suchtext der letzten Anfrage an `GET /events`. */
  eventsAnfrage: string | null;
  /** Gruppentypen wie `GET /group/grouptypes` (W15-5). */
  gruppenTypen: { id: number; name: string; nameTranslated?: string }[];
  /** `GET /group/grouptypes` scheitert (500). */
  gruppenTypenFehler: boolean;
  /** Gruppen – auch die, die ChurchTools für Anmeldungen anlegt (`terminId`) – wie `GET /groups?group_type_ids[]=…`. */
  gruppen: { id: number; name: string; groupTypeId: number; terminId?: number }[];
  /** `GET /groups?group_type_ids[]=…` scheitert (500). */
  gruppenLesenFehler: boolean;
  /** ChurchTools sagt „201“ und legt für `signup` keine Gruppen an. */
  gruppenSchlucken: boolean;
  /** ChurchTools sagt „201“ und speichert `signup` nicht am Termin. */
  signupSchlucken: boolean;
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
      numGuests?: number | null;
      pollResult?: unknown;
      hasEditingStarted?: boolean;
    }[]
  >;
  treffenVerboten: boolean;
  /** Nur diese Gruppen: Gruppentreffen lesen → 403 (ChurchTools-„verboten“) bzw. mit diesem Status (W4: andere Gruppe). */
  treffenVerbotenFuer: Set<number>;
  treffenLesenFehlerFuer: Map<number, number>;
  /** Nur diese Kategorien: Werte lesen → 403 (ChurchTools-„verboten“) bzw. mit diesem Status (W4: andere Gruppe). */
  werteVerbotenFuer: Set<number>;
  werteLesenFehlerFuer: Map<number, number>;
  /** Die Liste der Kategorien lesen → mit diesem Status (W4: andere Gruppen finden). */
  kategorienLesenFehler: number | null;
  /** `PUT` am Treffen sagt 200, ändert aber nichts (S6-1: Abschließen muss nachgelesen werden). */
  treffenSchlucken: boolean;
  /** `DELETE` am Treffen sagt 204, löscht aber nichts (W6: Löschen muss nachgelesen werden). */
  treffenLoeschenSchlucken: boolean;
  /** Die Mitglieder, die jedes Gruppentreffen kennt (S5-3). */
  teilnehmer: { person: number; vor: string; nach: string }[];
  /** Anwesenheit je Treffen: Person → `present` / `absent` / `unsure`. */
  teilnahme: Map<number, Map<number, string>>;
  teilnahmeSchlucken: boolean;
  /** Zuletzt angefragter Zeitraum der Termine (`from`/`to`) – zum Prüfen. */
  terminAnfrage: string | null;
  definitionen: unknown;
  /** Gruppen, in denen man Beiträge schreiben darf (S6-2). */
  beitragsGruppen: number[];
  beitraege: {
    id: number;
    groupId: number;
    title: string;
    content: string;
    visibility: unknown;
    commentsActive: unknown;
  }[];
  beitragFehler: AnlegeFehler | null;
  beitragLesenFehler: number | null;
  beitragSchlucken: boolean;
  /** ChurchTools speichert den Beitrag mit anderem Titel (z. B. gekürzt). */
  beitragTitelAnders: boolean;
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
    kalender: [{ id: 4, name: 'Gemeindeleitung', type: 'group' }],
    kandidaten: [],
    kandidatenFehler: false,
    anfragenLesenFehler: false,
    mails: [],
    teilenFehler: null,
    terminAendernFehler: null,
    terminFehler: null,
    terminLesenFehler: false,
    terminRumpf: null,
    ressourcen: [],
    ressourcenTypen: [],
    buchungen: [],
    buchungenSchlucken: new Set(),
    buchungenLesenFehler: false,
    buchungenAnfrage: null,
    eventVorlagen: [],
    events: [],
    eventsSchlucken: new Set(),
    eventsLesenFehler: false,
    eventsAnfrage: null,
    vorlagen: [],
    vorlagenFehler: null,
    vorlagenSchlucken: false,
    vorlagenLesenFehler: false,
    tags: [],
    gruppenTypen: [],
    gruppenTypenFehler: false,
    gruppen: [],
    gruppenLesenFehler: false,
    gruppenSchlucken: false,
    signupSchlucken: false,
    anfrageVerschluckt: new Set(),
    treffenFehler: null,
    treffen: new Map(),
    treffenVerboten: false,
    treffenVerbotenFuer: new Set(),
    treffenLesenFehlerFuer: new Map(),
    werteVerbotenFuer: new Set(),
    werteLesenFehlerFuer: new Map(),
    kategorienLesenFehler: null,
    teilnehmer: [
      { person: 1, vor: 'Alwin', nach: 'Friesen' },
      { person: 19, vor: 'Spike', nach: 'Musiker' },
    ],
    teilnahme: new Map(),
    teilnahmeSchlucken: false,
    treffenSchlucken: false,
    treffenLoeschenSchlucken: false,
    terminAnfrage: null,
    definitionen: DEFINITIONEN,
    beitragsGruppen: [],
    beitraege: [],
    beitragFehler: null,
    beitragLesenFehler: null,
    beitragSchlucken: false,
    beitragTitelAnders: false,
  };
  // In Node ein schmales `window`; in jsdom (Komponenten-Tests, S5-3) bleibt das echte – sonst fehlte React alles
  // außer der Adresse – und bekommt nur die Adresse von ChurchTools.
  if (typeof document === 'undefined')
    vi.stubGlobal('window', {
      settings: { base_url: 'https://ct.test/' },
      location: { origin: 'https://ct.test' },
    });
  else (window as { settings?: { base_url?: string } }).settings = { base_url: 'https://ct.test/' };
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
    if (pfad === '/group/grouptypes')
      return s.gruppenTypenFehler
        ? json(500, { message: 'weg' })
        : json(200, { data: s.gruppenTypen });
    if (pfad === '/groups' && adresse.searchParams.has('group_type_ids[]')) {
      if (s.gruppenLesenFehler) return json(500, { message: 'weg' });
      const typen = adresse.searchParams.getAll('group_type_ids[]').map(Number);
      return json(200, {
        data: s.gruppen.filter((g) => typen.includes(g.groupTypeId)),
        meta: { pagination: { lastPage: 1 } },
      });
    }
    if (pfad === '/groups')
      return json(200, {
        data: [
          { id: 194, name: 'Technik', settings: { isHidden: false } },
          { id: 11, name: 'Gemeindeleitung', settings: { isHidden: true } },
        ],
        meta: { pagination: { lastPage: 1 } },
      });
    if (pfad === '/calendars') return json(200, { data: s.kalender });
    if (/^\/calendars\/\d+\/meetingrequest\/candidates$/.test(pfad))
      return s.kandidatenFehler ? json(500, { message: 'weg' }) : json(200, { data: s.kandidaten });
    if (pfad === '/calendars/appointments') {
      const kal = adresse.searchParams.getAll('calendar_ids[]').map(Number);
      s.terminAnfrage = `${adresse.searchParams.get('from')}..${adresse.searchParams.get('to')}`;
      return json(200, {
        data: s.termine
          .filter((t) => kal.includes(t.kalender))
          .flatMap((t) =>
            // Wie ChurchTools nur im gefragten Zeitraum (`from` bis `to`) – die Liste sieht nicht weiter.
            vorkommen(t)
              .filter(
                (v) =>
                  tagVon(v.beginn) >= (adresse.searchParams.get('from') ?? '') &&
                  tagVon(v.beginn) <= (adresse.searchParams.get('to') ?? '9999'),
              )
              .map((v) => ({
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
    if (pfad === '/post/groups')
      return json(200, {
        data: s.beitragsGruppen.map((g) => ({
          group: { domainIdentifier: String(g), title: `Gruppe ${g}` },
          type: 'postPossible',
        })),
      });
    if (pfad === '/posts' && m === 'POST') {
      const id = s.naechste++;
      const f = s.beitragFehler;
      if ((!f || f.angelegt) && !s.beitragSchlucken)
        s.beitraege.push({
          id,
          groupId: Number(body.groupId),
          title: s.beitragTitelAnders ? String(body.title).slice(0, 10) : String(body.title),
          content: String(body.content),
          visibility: body.visibility,
          commentsActive: body.commentsActive,
        });
      return f ? fehlerAntwort(f) : json(201, { data: { id } });
    }
    const einB = /^\/posts\/(\d+)$/.exec(pfad);
    if (einB && m === 'GET') {
      if (s.beitragLesenFehler) return json(s.beitragLesenFehler, { message: 'weg' });
      const b = s.beitraege.find((x) => x.id === Number(einB[1]));
      return b ? json(200, { data: b }) : json(404, { message: 'Nicht gefunden' });
    }
    if (pfad === '/calendars/appointments/templates') {
      if (m === 'GET')
        return s.vorlagenLesenFehler
          ? json(500, { message: 'weg' })
          : json(200, { data: s.vorlagen });
      if (m === 'POST') {
        const id = s.naechste++;
        const f = s.vorlagenFehler;
        if ((!f || f.angelegt) && !s.vorlagenSchlucken) s.vorlagen.push({ ...body, id });
        return f ? fehlerAntwort(f) : json(201, { data: { id } });
      }
    }
    if (pfad === '/tags/appointment') return json(200, { data: s.tags });
    if (pfad === '/resources') return json(200, { data: s.ressourcen });
    if (pfad === '/resourcetypes') return json(200, { data: s.ressourcenTypen });
    if (pfad === '/bookings') {
      s.buchungenAnfrage = decodeURIComponent(adresse.search);
      if (s.buchungenLesenFehler) return json(500, { message: 'weg' });
      const ress = adresse.searchParams.getAll('resource_ids[]').map(Number);
      return json(200, {
        data: s.buchungen
          .filter((b) => ress.includes(b.resourceId))
          .map((b) => {
            const base = {
              id: b.appointmentId * 10,
              appointment: { id: b.appointmentId },
              statusId: b.statusId,
            };
            // Gemessen 23.11.2026: `booking.base` (neu) – `base` nur noch als veralteter Doppelgänger, den es irgendwann
            // nicht mehr gibt. Der Nachbau liefert das Neue; `buchungenAlteForm` nur das Alte.
            return s.buchungenAlteForm ? { base } : { booking: { base } };
          }),
      });
    }
    if (pfad === '/eventtemplates') return json(200, { data: s.eventVorlagen });
    if (pfad === '/events') {
      s.eventsAnfrage = decodeURIComponent(adresse.search);
      if (s.eventsLesenFehler) return json(500, { message: 'weg' });
      return json(200, {
        data: s.events.map((x) => ({
          id: x.id,
          name: 'Event',
          appointmentId: x.appointmentId,
          startDate: x.startDate,
          isCanceled: false,
        })),
      });
    }
    const neuT = /^\/calendars\/(\d+)\/appointments$/.exec(pfad);
    if (neuT && m === 'POST') {
      s.terminRumpf = body;
      const id = s.naechste++;
      const f = s.terminFehler;
      if (!f || f.angelegt)
        for (const b of (body.bookings as Record<string, unknown>[] | undefined) ?? [])
          if (!s.buchungenSchlucken.has(Number(b.resourceId)))
            s.buchungen.push({
              resourceId: Number(b.resourceId),
              appointmentId: id,
              statusId: b.statusId,
              quantity: b.quantity,
            });
      if (!f || f.angelegt)
        for (const x of (body.events as
          | { startDate: string; eventTemplateId?: unknown }[]
          | undefined) ?? [])
          if (!s.eventsSchlucken.has(x.startDate))
            s.events.push({
              id: s.naechste++,
              appointmentId: id,
              startDate: x.startDate,
              eventTemplateId: x.eventTemplateId,
            });
      // ChurchTools mailt beim Anlegen jeder eingeladenen Person außer mir sofort „Neue Besprechungsanfrage“ (K2b).
      if (!f || f.angelegt)
        for (const a of (body.meetingrequests as { inviteeId: number }[] | undefined) ?? [])
          if (a.inviteeId !== 1 && !s.anfrageVerschluckt.has(a.inviteeId))
            s.mails.push({ person: a.inviteeId, art: 'neu' });
      const signup = body.signup as Record<string, number> | undefined;
      if (!f || f.angelegt) {
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
          // Wöchentliche Serien (W15-5) und die gespeicherte Anmeldung – GET zeigt sie so wie ChurchTools.
          ...(body.repeatId === 7
            ? { repeatId: 7, felder: { repeatUntil: body.repeatUntil ?? null } }
            : {}),
        });
        const termin = s.termine[s.termine.length - 1];
        if (signup && !s.signupSchlucken)
          termin.felder = {
            ...termin.felder,
            signup: {
              signupGroupTypeId: signup.signupGroupTypeId ?? null,
              signupDaysForwardNo: signup.signupDaysForwardNo ?? null,
              signupTemplateGroupId: signup.signupTemplateGroupId ?? null,
              signupDaysArchiveGroupNo: signup.signupDaysArchiveGroupNo ?? null,
              singupDaysForwardNo: signup.signupDaysForwardNo ?? null,
            },
          };
        // ChurchTools legt SOFORT je Einzeltermin zwischen heute und heute + Tage im Voraus eine Gruppe an (gemessen).
        if (signup && !s.gruppenSchlucken) {
          const heute = heuteImKalender();
          const bis = new Date(Date.parse(heute) + (signup.signupDaysForwardNo ?? 0) * 86_400_000)
            .toISOString()
            .slice(0, 10);
          for (const v of vorkommen(termin)) {
            const ort = ortszeitAus(v.beginn, gemeindeZeitzone()); // JJJJ-MM-TTTHH:MM
            const tag = ort.slice(0, 10);
            if (tag < heute || tag > bis) continue;
            s.gruppen.push({
              id: s.naechste++,
              name: `${String(body.title)} – ${tag.split('-').reverse().join('.')}, ${ort.slice(11, 16)}`,
              groupTypeId: Number(signup.signupGroupTypeId),
              terminId: id,
            });
          }
        }
      }
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
        // Gemessen 25.11.2026: Termin löschen löscht die Anmelde-Gruppen mit.
        s.gruppen = s.gruppen.filter((g) => g.terminId !== t.id);
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
      if (s.anfragenLesenFehler) return json(500, { message: 'weg' });
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
    // Anwesenheit (S5-3).
    const leute = /^\/groups\/(\d+)\/meetings\/(\d+)\/members$/.exec(pfad);
    if (leute && m === 'GET') {
      const stand = s.teilnahme.get(Number(leute[2]));
      // Seitenweise wie andere ChurchTools-Listen (#480): ohne `limit` 10 je Seite.
      const limit = Number(adresse.searchParams.get('limit') ?? 10);
      const seite = Number(adresse.searchParams.get('page') ?? 1);
      return json(200, {
        meta: {
          count: s.teilnehmer.length,
          pagination: { lastPage: Math.max(1, Math.ceil(s.teilnehmer.length / limit)) },
        },
        data: s.teilnehmer.slice((seite - 1) * limit, seite * limit).map((t) => ({
          personId: t.person,
          status: stand?.get(t.person) ?? 'unsure',
          member: {
            personId: t.person,
            person: {
              title: `${t.vor} ${t.nach}`,
              domainAttributes: { firstName: t.vor, lastName: t.nach },
            },
          },
        })),
      });
    }
    const checkin = /^\/groups\/(\d+)\/checkin\/(\d+)$/.exec(pfad);
    const austragen = /^\/groups\/(\d+)\/meetings\/(\d+)\/members\/(\d+)$/.exec(pfad);
    if ((checkin && m === 'POST') || (austragen && m === 'DELETE')) {
      if (s.treffenVerboten)
        return json(403, { message: 'Forbidden', messageKey: 'error.forbidden.edit' });
      const g = Number((checkin ?? austragen)![1]);
      const id = checkin ? Number(body.groupMeetingId) : Number(austragen![2]);
      const person = Number(checkin ? checkin[2] : austragen![3]);
      const t = (s.treffen.get(g) ?? []).find((x) => x.id === id);
      if (!t) return json(404, { message: 'weg' });
      // Gemessen S6-0 (11.11.2026): abgeschlossen = Anwesenheit gesperrt.
      if (t.isCompleted)
        return json(400, {
          message: 'Group meeting is completed',
          translatedMessage: 'Das Treffen ist abgeschlossen',
        });
      if (!s.teilnahmeSchlucken) {
        const stand = s.teilnahme.get(id) ?? new Map<number, string>();
        stand.set(
          person,
          checkin ? 'present' : typeof body.status === 'string' ? body.status : 'absent',
        );
        s.teilnahme.set(id, stand);
        t.hasEditingStarted = true;
      }
      return json(200, { data: {} });
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
        if (!s.treffenLoeschenSchlucken) liste.splice(liste.indexOf(t), 1);
        return json(204, null);
      }
      // Wie gemessen (16.10., 29.10. + S6-0 11.11.2026): ohne `isCanceled`/`isCompleted`/`startDate` 400; was fehlt
      // (Kommentar, Gäste, Rückmeldung), wird geleert.
      if (
        typeof body.isCanceled !== 'boolean' ||
        typeof body.isCompleted !== 'boolean' ||
        typeof body.startDate !== 'string' ||
        !body.startDate
      )
        return json(400, { message: 'validation' });
      if (s.treffenSchlucken) return json(200, { data: t });
      t.startDate = body.startDate;
      t.isCanceled = body.isCanceled;
      t.isCompleted = body.isCompleted;
      t.comment = typeof body.comment === 'string' ? body.comment : null;
      t.numGuests = typeof body.numGuests === 'number' ? body.numGuests : null;
      t.pollResult = body.pollResult ?? null;
      return json(200, { data: t });
    }
    if (tr) {
      if (s.treffenVerboten || s.treffenVerbotenFuer.has(Number(tr[1])))
        return json(403, { message: 'Forbidden to see group', messageKey: 'error.forbidden.view' });
      const fehler = s.treffenLesenFehlerFuer.get(Number(tr[1]));
      if (fehler) return json(fehler, { message: 'weg' });
      // Wie gemessen (28.10.2026): `end_date` zählt nicht mit.
      const von = adresse.searchParams.get('start_date') ?? '';
      const bis = adresse.searchParams.get('end_date') ?? '9999';
      return json(200, {
        data: (s.treffen.get(Number(tr[1])) ?? []).filter(
          (t) => t.startDate.slice(0, 10) >= von && t.startDate.slice(0, 10) < bis,
        ),
      });
    }
    // Rollen jeder Gruppe (das Einrichten liest sie seit dem Security-Review frisch, auch für andere Gruppen-IDs).
    if (/^\/groups\/\d+\/roles$/.test(pfad))
      return json(200, {
        data: [
          // `groupTypeRoleId` = die Rolle, wie sie an der Mitgliedschaft steht (W16: `typ` in der Einstellung).
          {
            id: LEITER,
            nameTranslated: 'Leiter',
            isLeader: true,
            isActive: true,
            groupTypeRoleId: 16,
          },
          {
            id: TEILNEHMER,
            nameTranslated: 'Teilnehmer',
            isLeader: false,
            isActive: true,
            groupTypeRoleId: 15,
          },
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
      if (s.kategorienLesenFehler) return json(s.kategorienLesenFehler, { message: 'weg' });
      return json(200, { data: s.kategorien });
    }
    const w =
      /^\/custommodules\/\d+\/customdatacategories\/(\d+)\/customdatavalues(?:\/(\d+))?$/.exec(
        pfad,
      );
    if (w) {
      if (m === 'GET' && s.werteVerbotenFuer.has(Number(w[1])))
        return json(403, { message: 'Forbidden', messageKey: 'error.forbidden.view' });
      const werteFehler = m === 'GET' ? s.werteLesenFehlerFuer.get(Number(w[1])) : undefined;
      if (werteFehler) return json(werteFehler, { message: 'weg' });
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
  if (typeof document !== 'undefined') delete (window as { settings?: unknown }).settings;
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
