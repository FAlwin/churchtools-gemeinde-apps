/**
 * **Nur zum Entwickeln** (`npm run dev -w organigramm`, dann `…/ccm/organigramm/?demo`): spielt die
 * ChurchTools-Antworten nach, in der Form, die gemessen wurde (Live 19.10.2026, Test-Instanz 22.10.2026),
 * damit die Seite ohne Instanz zu sehen ist. `?demo=mitglied` zeigt jemanden ohne Gruppen-Admin-Recht (zwei
 * Gruppen ohne Leserecht), `?demo=wackel` eine Gruppe, deren Mitglieder vorübergehend nicht laden, `?demo=fehler`
 * den Fehlerfall beim Start. Wird nie mitgebaut (siehe `main.tsx`). Keine echten Namen.
 *
 * Seit O5 auch schreibend: Umhängen, Lösen und Anlegen verändern die Gruppen und die Hierarchie dieser Sitzung,
 * mit den gemessenen Antworten (400 „schon gesetzt“, 204 beim Lösen, 201 mit ID beim Anlegen). Neu laden setzt zurück.
 */
const gruppe = (id: number, name: string, groupTypeId: number, color: string | null) => ({
  id,
  name,
  information: { groupTypeId, groupStatusId: 1, color },
});

const GRUPPEN: ReturnType<typeof gruppe>[] = [
  gruppe(10, 'Gottesdienst', 2, 'lime'),
  gruppe(6, 'Predigt', 2, 'lime'),
  gruppe(9, 'Musikteam', 2, 'lime'),
  gruppe(7, 'Technik', 2, 'lime'),
  gruppe(12, 'Stream', 2, 'gray'),
  gruppe(15, 'Tontechnik', 2, 'gray'),
  gruppe(47, 'Café Team', 2, 'lime'),
  gruppe(49, 'Café Team 1', 2, 'lime'),
  gruppe(11, 'Leitungsteam', 2, 'lime'),
  gruppe(24, 'Gemeinsam werden', 2, 'orange'),
  gruppe(37, 'Bibelarbeit', 7, 'violet'),
  gruppe(34, 'Ankündigungen', 9, 'teal'),
];

// Erfundene Personen; Rollen wie gemessen: 16 Leiter, 17 Co-Leiter, 15 Mitarbeiter, 39 leader (Verteiler)
const NAMEN = [
  'Alex Bauer',
  'Bea Christ',
  'Chris Dorn',
  'Dana Eck',
  'Eli Fuchs',
  'Fynn Graf',
  'Gina Horn',
  'Hugo Ilg',
  'Ida Jung',
  'Jan Kranz',
  'Kim Lenz',
  'Lea Moos',
];
const m = (personId: number, groupTypeRoleId: number) => ({
  personId,
  person: {
    title: NAMEN[personId - 1],
    initials: NAMEN[personId - 1]
      .split(' ')
      .map((w) => w[0])
      .join(''),
    imageUrl: null,
  },
  groupTypeRoleId,
  groupMemberStatus: 'active',
});
const MITGLIEDER: Record<number, ReturnType<typeof m>[]> = {
  10: [m(1, 16), m(2, 16)],
  6: [m(2, 16), m(3, 15), m(4, 15)],
  9: [m(1, 16), m(5, 17), m(6, 15), m(7, 15), m(8, 15)],
  7: [m(1, 16), m(9, 15), m(10, 15)],
  12: [m(1, 16), m(9, 15), m(11, 15)],
  15: [m(1, 16), m(10, 15)],
  47: [m(12, 16), m(4, 15), m(6, 15)],
  11: [m(1, 16), m(2, 17), m(3, 15)],
  24: [m(5, 16), m(8, 15)],
  37: [m(3, 16)],
  34: [m(2, 39), m(4, 15), m(5, 15), m(6, 15)],
  // Kim (11) hat bei Café Team 1 angefragt – „offene Anfrage“
  49: [m(12, 16), m(4, 15), { ...m(11, 15), groupMemberStatus: 'requested' }],
};

// Termine: 26 Sonntage zurück, 12 voraus. Alex (1) dient fast jeden Sonntag, Jan (10) nie; freie Plätze kommen.
const TAG = 86_400_000;
const sonntag = (wochen: number) =>
  new Date(Date.now() + wochen * 7 * TAG).toISOString().slice(0, 10) + 'T08:00:00Z';
const platz = (serviceId: number, personId: number | null) => ({
  serviceId,
  personId,
  name: personId ? NAMEN[personId - 1] : null,
  isAccepted: true,
});
const TERMINE = Array.from({ length: 38 }, (_, i) => {
  const w = i - 26;
  const vorbei = w < 0;
  return {
    id: 500 + i,
    name: 'Gottesdienst',
    startDate: sonntag(w),
    endDate: sonntag(w),
    eventServices: [
      platz(6, vorbei || w < 2 ? 1 : null),
      platz(8, vorbei && i % 3 === 0 ? 11 : null),
      platz(4, vorbei && i % 2 === 0 ? 5 : null),
      platz(1, vorbei ? (i % 2 ? 2 : 3) : null),
      platz(13, vorbei ? 12 : null),
    ],
  };
});

const HIERARCHIE = [
  { groupId: 10, parents: [], children: [6, 9, 7] },
  { groupId: 7, parents: [10], children: [12, 15] },
  { groupId: 47, parents: [], children: [49] },
  { groupId: 11, parents: [], children: [24] },
];

/** Obergruppen je Gruppe – die veränderliche Fassung von `HIERARCHIE` (O5). */
const ELTERN = new Map<number, number[]>();
for (const h of HIERARCHIE)
  for (const k of h.children) ELTERN.set(k, [...(ELTERN.get(k) ?? []), h.groupId]);

function hierarchie() {
  return GRUPPEN.map((g) => ({
    groupId: g.id,
    parents: ELTERN.get(g.id) ?? [],
    children: [...ELTERN].filter(([, e]) => e.includes(g.id)).map(([k]) => k),
  })).filter((h) => h.parents.length || h.children.length);
}

const json = (d: unknown, status = 200) =>
  new Response(d === null ? null : JSON.stringify(d), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

/** Die schreibenden und die davon abhängigen lesenden Antworten (O5) – `undefined`, wenn es keine davon ist. */
function struktur(method: string, pfad: string, body: unknown): Response | undefined {
  const eltern = /^\/api\/groups\/(\d+)\/parents\/(\d+)$/.exec(pfad);
  if (eltern) {
    const [id, p] = [Number(eltern[1]), Number(eltern[2])];
    const jetzt = ELTERN.get(id) ?? [];
    if (method === 'PUT') {
      if (jetzt.includes(p)) {
        return json(
          {
            message: 'Die Gruppe ist bereits als Obergruppe gesetzt.',
            messageKey: 'group.reference.already.exists',
          },
          400,
        );
      }
      ELTERN.set(id, [...jetzt, p]);
      return json({ data: null }, 201);
    }
    if (method === 'DELETE') {
      ELTERN.set(
        id,
        jetzt.filter((x) => x !== p),
      );
      return json(null, 204);
    }
  }
  const parents = /^\/api\/groups\/(\d+)\/parents$/.exec(pfad);
  if (parents && method === 'GET') {
    return json({
      data: (ELTERN.get(Number(parents[1])) ?? []).map((p) => ({ domainIdentifier: String(p) })),
    });
  }
  const eine = /^\/api\/groups\/(\d+)$/.exec(pfad);
  if (eine) {
    const id = Number(eine[1]);
    const g = GRUPPEN.find((x) => x.id === id);
    if (method === 'DELETE') {
      if (g) GRUPPEN.splice(GRUPPEN.indexOf(g), 1);
      ELTERN.delete(id);
      return json(null, 204);
    }
    return g ? json({ data: g }) : json({}, 404);
  }
  if (pfad === '/api/groups' && method === 'POST') {
    const d = body as { name: string; groupTypeId: number; parentGroupId: number };
    const id = Math.max(100, ...GRUPPEN.map((x) => x.id)) + 1;
    GRUPPEN.push(gruppe(id, d.name, d.groupTypeId, null));
    ELTERN.set(id, [d.parentGroupId]);
    return json({ data: { id } }, 201);
  }
  if (method !== 'GET') return undefined;
  if (pfad === '/api/groups') return json({ data: GRUPPEN, meta: { pagination: { lastPage: 1 } } });
  if (pfad === '/api/groups/hierarchies') return json({ data: hierarchie() });
  const mitglieder = /^\/api\/groups\/(\d+)\/members$/.exec(pfad);
  if (mitglieder && !(Number(mitglieder[1]) in MITGLIEDER)) {
    return json({ data: [], meta: { pagination: { lastPage: 1 } } });
  }
  return undefined;
}

function daten(fall: string): Record<string, unknown> {
  const admin = fall !== 'mitglied';
  return {
    '/api/whoami': { data: { id: 1, firstName: 'Alex' } },
    '/api/persons/1/groups': {
      data: [
        {
          group: { title: 'Technik', domainIdentifier: '7' },
          groupTypeRoleId: 16,
          groupMemberStatus: 'active',
        },
      ],
    },
    '/api/group/roles': {
      data: [
        { id: 15, name: 'Mitarbeiter', nameTranslated: 'Mitarbeiter', isLeader: false, sortKey: 0 },
        { id: 16, name: 'Leiter', nameTranslated: 'Leiter', isLeader: true, sortKey: 1 },
        { id: 17, name: 'Co-Leiter', nameTranslated: 'Co-Leiter', isLeader: true, sortKey: 2 },
        { id: 39, name: 'leader', nameTranslated: 'Leiter', isLeader: true, sortKey: 1 },
      ],
    },
    '/api/services': {
      data: [
        { id: 1, name: 'Predigt', serviceGroupId: 5, groupIds: [6] },
        { id: 4, name: 'Musik', serviceGroupId: 4, groupIds: [9] },
        { id: 6, name: 'Ton', serviceGroupId: 3, groupIds: [15] },
        { id: 8, name: 'Video Regie', serviceGroupId: 3, groupIds: [12] },
        { id: 11, name: 'Licht', serviceGroupId: 3, groupIds: [7] },
        { id: 13, name: 'Café', serviceGroupId: 6, groupIds: [47, 49] },
      ],
    },
    ...Object.fromEntries(
      Object.entries(MITGLIEDER).map(([id, liste]) => [
        `/api/groups/${id}/members`,
        { data: liste, meta: { pagination: { lastPage: 1 } } },
      ]),
    ),
    '/api/info': { siteName: 'Beispielgemeinde' },
    '/api/csrftoken': { data: 'demo' },
    '/api/person/masterdata': {
      data: {
        groupStatuses: [
          { id: 1, name: 'active', nameTranslated: 'Aktiv' },
          { id: 2, name: 'pending', nameTranslated: 'Entwurf' },
        ],
      },
    },
    '/api/groups': { data: GRUPPEN, meta: { pagination: { lastPage: 1 } } },
    '/api/events': { data: TERMINE },
    '/api/group/grouptypes': {
      data: [
        { id: 1, name: 'Kleingruppe', color: 'sky' },
        { id: 2, name: 'Dienst', color: 'lime' },
        { id: 7, name: 'Veranstaltung', color: 'amber' },
        { id: 9, name: 'Verteiler', color: 'teal' },
      ],
    },
    '/api/permissions/global': {
      data: {
        churchcore: { 'administer persons': admin },
        churchdb: admin
          ? {
              'administer groups': true,
              'create groups of grouptype': [1, 2, 7, 9],
              'edit group': GRUPPEN.map((g) => g.id),
            }
          : { 'administer groups': false, 'create groups of grouptype': [], 'edit group': [] },
      },
    },
  };
}

export function demoStarten(fall: string): void {
  // ChurchTools gibt der Erweiterung einen Behälter mit fester Höhe (gemessen 07.10.2026); auf der nackten
  // Entwicklerseite übernimmt das `body`, sonst hätte die App die Höhe 0.
  document.body.style.cssText = 'margin: 0; height: 100vh;';
  const antworten = daten(fall);
  window.fetch = (input, init) => {
    const url = new URL(
      typeof input === 'string' ? input : input instanceof URL ? input.href : input.url,
    );
    const method = init?.method ?? 'GET';
    if (fall === 'fehler' && url.pathname.endsWith('/groups/hierarchies')) {
      return Promise.resolve(new Response('{}', { status: 502 }));
    }
    // Ohne Leserecht antwortet ChurchTools bei Mitgliedern mit 403 (gemessen 19.10.2026)
    if (fall === 'mitglied' && /\/groups\/(12|49)\/members$/.test(url.pathname)) {
      return Promise.resolve(new Response('{}', { status: 403 }));
    }
    if (fall === 'wackel' && url.pathname.endsWith('/groups/47/members')) {
      return Promise.resolve(new Response('{}', { status: 503 }));
    }
    if (fall !== 'fehler') {
      const body: unknown = typeof init?.body === 'string' ? JSON.parse(init.body) : null;
      const s = struktur(method, url.pathname, body);
      if (s) return Promise.resolve(s);
    }
    const d = antworten[url.pathname];
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
