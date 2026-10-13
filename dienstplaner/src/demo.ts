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
    '/api/events': { data: TERMINE },
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

export function demoStarten(fall: string): void {
  // ChurchTools gibt der Erweiterung einen Behälter mit fester Höhe (gemessen 07.10.2026); auf der nackten
  // Entwicklerseite übernimmt das `body`, sonst hätte die App die Höhe 0.
  document.body.style.cssText = 'margin: 0; height: 100vh;';
  const antworten = daten(fall);
  window.fetch = (input) => {
    const url = new URL(
      typeof input === 'string' ? input : input instanceof URL ? input.href : input.url,
    );
    if (fall === 'fehler' && url.pathname.endsWith('/servicegroups')) {
      return Promise.resolve(new Response('{}', { status: 502 }));
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
