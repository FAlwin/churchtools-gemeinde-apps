/**
 * **Nur zum Entwickeln** (`npm run dev -w organigramm`, dann `…/ccm/organigramm/?demo`): spielt die
 * ChurchTools-Antworten nach, in der Form, die gemessen wurde (Live 19.10.2026, Test-Instanz 22.10.2026),
 * damit die Seite ohne Instanz zu sehen ist. `?demo=mitglied` zeigt jemanden ohne Gruppen-Admin-Recht (zwei
 * Gruppen ohne Leserecht), `?demo=wackel` eine Gruppe, deren Mitglieder vorübergehend nicht laden, `?demo=fehler`
 * den Fehlerfall beim Start. Wird nie mitgebaut (siehe `main.tsx`). Keine echten Namen.
 */
const gruppe = (id: number, name: string, groupTypeId: number, color: string | null) => ({
  id,
  name,
  information: { groupTypeId, groupStatusId: 1, color },
});

const GRUPPEN = [
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
  49: [m(12, 16), m(4, 15)],
  11: [m(1, 16), m(2, 17), m(3, 15)],
  24: [m(5, 16), m(8, 15)],
  37: [m(3, 16)],
  34: [m(2, 39), m(4, 15), m(5, 15), m(6, 15)],
};

const HIERARCHIE = [
  { groupId: 10, parents: [], children: [6, 9, 7] },
  { groupId: 7, parents: [10], children: [12, 15] },
  { groupId: 47, parents: [], children: [49] },
  { groupId: 11, parents: [], children: [24] },
];

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
    '/api/groups': { data: GRUPPEN, meta: { pagination: { lastPage: 1 } } },
    '/api/groups/hierarchies': { data: HIERARCHIE },
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
  window.fetch = (input) => {
    const url = new URL(
      typeof input === 'string' ? input : input instanceof URL ? input.href : input.url,
    );
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
