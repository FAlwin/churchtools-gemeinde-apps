/**
 * **Nur zum Entwickeln** (`npm run dev -w dienstplaner`, dann `…/ccm/dienstplaner/?demo`): spielt die
 * ChurchTools-Antworten nach, in der Form, die an der Test-Instanz gemessen wurde (12. und 13.10.2026),
 * damit die Seite ohne Instanz zu sehen ist. `?demo=mitglied` zeigt jemanden ohne Planer-Recht,
 * `?demo=fehler` den Fehlerfall. Wird nie mitgebaut (siehe `main.tsx`).
 */
const PLANER = {
  view: true,
  'view servicegroup': [1, 3, 4],
  'edit servicegroup': [3, 4],
  'edit agenda': [1, 2, 3, 4, 5],
  'manage absent': true,
};
const MITGLIED = {
  view: false,
  'view servicegroup': [],
  'edit servicegroup': [],
  'edit agenda': [],
  'manage absent': false,
};

/** Ein Zeitpunkt `tage` nach heute um `uhr` (UTC), damit die Demo nie veraltet. */
function zeit(tage: number, uhr: string): string {
  const d = new Date(Date.now() + tage * 86_400_000);
  return `${d.toISOString().slice(0, 10)}T${uhr}:00Z`;
}

/** Plätze wie gemessen (Live, 13.10.2026): frei = ohne Namen; `isAccepted` = zugesagt. */
const platz = (
  serviceId: number,
  personId: number | null,
  name: string | null,
  isAccepted = false,
) => ({
  serviceId,
  personId,
  name,
  isAccepted,
});

const TERMINE = [
  {
    id: 101,
    name: 'Gottesdienst',
    startDate: zeit(4, '08:00'),
    endDate: zeit(4, '10:00'),
    eventServices: [
      platz(6, 1, 'Alwin', true),
      platz(7, null, null),
      platz(9, 1, 'Alwin'),
      platz(9, 19, 'Spike', true),
    ],
  },
  {
    id: 102,
    name: 'Gebetsabend',
    startDate: zeit(7, '17:00'),
    endDate: zeit(7, '18:30'),
    eventServices: [platz(6, 19, 'Spike', true)],
  },
  {
    id: 103,
    name: 'Gottesdienst',
    startDate: zeit(11, '08:00'),
    endDate: zeit(11, '10:00'),
    eventServices: [platz(6, null, null), platz(7, null, null), platz(9, 19, 'Spike')],
  },
  {
    id: 104,
    name: 'Gemeindeversammlung',
    startDate: zeit(16, '17:00'),
    endDate: zeit(16, '19:00'),
    isCanceled: true,
    eventServices: [],
  },
  {
    id: 105,
    name: 'Gebetsabend',
    startDate: zeit(21, '17:00'),
    endDate: zeit(21, '18:30'),
    eventServices: [platz(7, 1, 'Alwin', true)],
  },
  {
    id: 106,
    name: 'Gottesdienst',
    startDate: zeit(39, '09:00'),
    endDate: zeit(39, '11:00'),
    eventServices: [platz(6, 19, 'Spike', true), platz(7, 1, 'Alwin', true), platz(9, null, null)],
  },
];

/**
 * „Wer kann?“ in der Form, die E4-0 gemessen hat (`possiblepersons`): Punkte mit Begründungen, Auslastung je
 * Monat, Abwesenheit mit Grund, Dienste am selben Tag. Ben hat einen „Hat zuvor abgesagt“-Abzug – der darf
 * ihn nicht nach unten schieben (Alwin, 14.10.2026).
 */
function werKannDemo(eventId: number): unknown {
  const t = TERMINE.find((x) => x.id === eventId);
  const monat = (t?.startDate ?? zeit(0, '08:00')).slice(0, 7);
  const person = (id: number, vorname: string, nachname: string) => ({
    title: `${vorname} ${nachname}`,
    domainIdentifier: String(id),
    domainAttributes: { firstName: vorname, lastName: nachname },
  });
  const k = (
    p: ReturnType<typeof person>,
    o: { score?: number; hints?: object[]; monat?: number; abwesend?: string; amTag?: string[] },
  ) => ({
    person: p,
    score: o.score ?? 0,
    scoreHints: o.hints ?? [],
    monthlyUtilization: o.monat ? { [monat]: o.monat } : {},
    absences: o.abwesend
      ? [{ absenceReason: { nameTranslated: o.abwesend }, comment: 'privat – wird nicht gezeigt' }]
      : [],
    servicesOnSameDay: (o.amTag ?? []).map((serviceName) => ({ eventService: { serviceName } })),
    servicesPreviouslyDeclined: [],
  });
  return {
    data: [
      k(person(46, 'Anna', 'Klassen'), { score: -3, monat: 1 }),
      k(person(49, 'Ben', 'Wiebe'), {
        score: -500,
        hints: [
          {
            score: -500,
            reason: 'service.previously-declined',
            nameTranslated: 'Hat zuvor abgesagt',
          },
        ],
      }),
      k(person(52, 'Clara', 'Dyck'), { score: -9, monat: 3 }),
      k(person(55, 'David', 'Penner'), { score: -1000, abwesend: 'Urlaub' }),
      k(person(1, 'Alwin', 'Friesen'), { score: -253, monat: 1, amTag: ['Ton'] }),
      k(person(19, 'Spike', 'Musiker'), { score: -6, monat: 2 }),
    ],
  };
}

function daten(fall: string): Record<string, unknown> {
  return {
    '/api/whoami': { data: { id: 1, firstName: fall === 'mitglied' ? 'Spike' : 'Alwin' } },
    '/api/persons/1/groups': {
      data: [
        {
          group: { title: 'Technik', domainIdentifier: '7' },
          groupTypeRoleId: 16,
          groupMemberStatus: 'active',
        },
        {
          group: { title: 'Lobpreisteam', domainIdentifier: '9' },
          groupTypeRoleId: 15,
          groupMemberStatus: 'active',
        },
      ],
    },
    '/api/group/roles': {
      data: [
        { id: 16, name: 'Leiter', isLeader: true },
        { id: 15, name: 'Mitarbeiter', isLeader: false },
      ],
    },
    '/api/info': { siteName: 'Evangeliumschristen- Gemeinde e.V.' },
    '/api/permissions/global': {
      data: {
        churchcore: { 'administer persons': fall !== 'mitglied' },
        churchservice: fall === 'mitglied' ? MITGLIED : PLANER,
      },
    },
    // Ablauf nur am ersten Termin – die anderen zeigen „Noch kein Ablauf“ (ChurchTools: 404).
    '/api/events/101/agenda': {
      data: {
        items: [
          { id: 1, type: 'header', title: 'Ankommen' },
          { id: 2, type: 'song', title: 'Halleluja', song: { title: 'Halleluja' } },
          { id: 3, type: 'song', title: 'Treu', song: { title: 'Treu' } },
          { id: 4, type: 'normal', title: 'Predigt' },
        ],
      },
    },
    // Abwesend am Tag der offenen Anfrage (Gesang, erster Gottesdienst) – die Startseite warnt.
    '/api/persons/1/absences': {
      data: [
        { id: 1, startDate: zeit(4, '00:00').slice(0, 10), endDate: zeit(4, '00:00').slice(0, 10) },
        {
          id: 2,
          startDate: zeit(30, '00:00').slice(0, 10),
          endDate: zeit(33, '00:00').slice(0, 10),
        },
      ],
    },
    '/api/services': {
      data: [
        { id: 6, name: 'Ton', serviceGroupId: 3, groupIds: [7] },
        { id: 7, name: 'Licht', serviceGroupId: 3, groupIds: [7] },
        { id: 9, name: 'Gesang', serviceGroupId: 4, groupIds: [9] },
      ],
    },
    '/api/servicegroups': {
      data: [
        { id: 1, name: 'Programm', nameTranslated: 'Programm', sortKey: 10 },
        { id: 3, name: 'Technik', nameTranslated: 'Technik', sortKey: 30 },
        { id: 4, name: 'Musik', nameTranslated: 'Musik', sortKey: 40 },
      ],
    },
  };
}

/** Wie ChurchTools: nur Termine ab `from` (Tag) und vor `to` (Tag, ausgeschlossen) – sonst stimmt „Oktober“ nicht. */
function termineVonBis(von: string | null, bis: string | null) {
  return TERMINE.filter(
    (t) => (!von || t.startDate.slice(0, 10) >= von) && (!bis || t.startDate.slice(0, 10) < bis),
  );
}

/**
 * Der Speicher der Erweiterung (Entwürfe, E4-3) – wie gemessen: Kategorien je Modul, Werte als Text, wer
 * eine Kategorie anlegt, bekommt sofort alle Rechte darauf. Musik hat schon eine Schublade mit einem
 * Entwurf von Spike; für Technik zeigt „Einrichten“, wie es beim ersten Mal aussieht.
 */
function speicherDemo(fall: string) {
  const kategorien = [{ id: 40, shorty: 'dienstplaner-entwuerfe-4', name: 'Entwürfe Musik' }];
  const spike = {
    art: 'dienstplaner-entwurf',
    fassung: 1,
    ort: { eventId: 106, serviceId: 9, index: null },
    ziel: { art: 'person', personId: 46, name: 'Anna Test' },
    modus: 'anfrage',
    gesehen: { art: 'frei' },
    von: { personId: 19, name: 'Spike' },
    zeit: zeit(0, '07:00'),
    version: 1,
  };
  // Veraltet (E4-3-3): eingetragen, als Gesang am Termin 103 frei war – inzwischen ist dort Spike angefragt.
  const veraltet = {
    ...spike,
    ort: { eventId: 103, serviceId: 9, index: null },
    ziel: { art: 'person', personId: 47, name: 'Finn Test' },
    von: { personId: 1, name: 'Alwin' },
  };
  const werte = new Map<number, { id: number; dataCategoryId: number; value: string }[]>([
    [
      40,
      [
        { id: 400, dataCategoryId: 40, value: JSON.stringify(spike) },
        { id: 401, dataCategoryId: 40, value: JSON.stringify(veraltet) },
      ],
    ],
  ]);
  let naechste = 500;
  const ids = () => kategorien.map((k) => k.id);
  const rechte = () =>
    fall === 'mitglied'
      ? {}
      : {
          view: true,
          'create custom category': true,
          'view custom category': ids(),
          'view custom data': ids(),
          'create custom data': ids(),
          'edit custom data': ids(),
          'delete custom data': ids(),
        };
  /** Antwort auf eine Anfrage an den Speicher – `undefined`, wenn sie nicht dorthin geht. */
  const anfrage = (
    methode: string,
    pfad: string,
    rumpf: unknown,
  ): { status: number; data?: unknown } | undefined => {
    if (pfad === '/api/custommodules') {
      return {
        status: 200,
        data: [
          { id: 10, shorty: 'musik-app', name: 'Musik App' },
          { id: 16, shorty: 'dienstplaner', name: 'Dienstplaner' },
        ],
      };
    }
    if (pfad === '/api/custommodules/16/customdatacategories') {
      if (methode === 'GET') return { status: 200, data: kategorien };
      const r = rumpf as { name: string; shorty: string };
      const k = { id: naechste++, shorty: r.shorty, name: r.name };
      kategorien.push(k);
      werte.set(k.id, []);
      return { status: 201, data: k };
    }
    const m =
      /^\/api\/custommodules\/16\/customdatacategories\/(\d+)\/customdatavalues(?:\/(\d+))?$/.exec(
        pfad,
      );
    if (!m) return undefined;
    const liste = werte.get(Number(m[1]));
    if (!liste) return { status: 404 };
    if (methode === 'GET') return { status: 200, data: liste };
    if (methode === 'POST') {
      const w = {
        id: naechste++,
        dataCategoryId: Number(m[1]),
        value: (rumpf as { value: string }).value,
      };
      liste.push(w);
      return { status: 201, data: w };
    }
    const i = liste.findIndex((w) => w.id === Number(m[2]));
    if (i < 0) return { status: 404 };
    if (methode === 'PUT') liste[i] = { ...liste[i], value: (rumpf as { value: string }).value };
    else liste.splice(i, 1);
    return { status: methode === 'PUT' ? 200 : 204 };
  };
  return { anfrage, rechte };
}

export function demoStarten(fall: string): void {
  // ChurchTools gibt der Erweiterung einen Behälter mit fester Höhe (gemessen 07.10.2026); auf der nackten
  // Entwicklerseite übernimmt das `body`, sonst hätte die App die Höhe 0.
  document.body.style.cssText = 'margin: 0; height: 100vh;';
  const antworten = daten(fall);
  const speicher = speicherDemo(fall);
  const mitDienstplanerRechten = (roh: unknown) => {
    const r = roh as { data: Record<string, unknown> };
    return { data: { ...r.data, dienstplaner: speicher.rechte() } };
  };
  window.fetch = (input, init) => {
    const url = new URL(
      typeof input === 'string' ? input : input instanceof URL ? input.href : input.url,
    );
    const methode = init?.method ?? 'GET';
    const s = speicher.anfrage(
      methode,
      url.pathname,
      typeof init?.body === 'string' ? (JSON.parse(init.body) as unknown) : undefined,
    );
    if (s) {
      return Promise.resolve(
        new Response(s.status === 204 ? null : JSON.stringify({ data: s.data ?? null }), {
          status: s.status,
          headers: { 'Content-Type': 'application/json' },
        }),
      );
    }
    if (url.pathname === '/api/csrftoken') {
      return Promise.resolve(new Response(JSON.stringify({ data: 'demo' }), { status: 200 }));
    }
    if (fall === 'fehler' && url.pathname.endsWith('/servicegroups')) {
      return Promise.resolve(new Response('{}', { status: 502 }));
    }
    const werKann = /^\/api\/events\/(\d+)\/services\/\d+\/possiblepersons$/.exec(url.pathname);
    const d = werKann
      ? werKannDemo(Number(werKann[1]))
      : url.pathname === '/api/events'
        ? { data: termineVonBis(url.searchParams.get('from'), url.searchParams.get('to')) }
        : url.pathname === '/api/permissions/global'
          ? mitDienstplanerRechten(antworten[url.pathname])
          : antworten[url.pathname];
    return Promise.resolve(
      d === undefined
        ? new Response('{}', { status: 404 })
        : new Response(JSON.stringify(d), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          }),
    );
  };
}
