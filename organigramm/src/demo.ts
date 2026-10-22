/**
 * **Nur zum Entwickeln** (`npm run dev -w organigramm`, dann `…/ccm/organigramm/?demo`): spielt die
 * ChurchTools-Antworten nach, in der Form, die gemessen wurde (Live 19.10.2026, Test-Instanz 22.10.2026),
 * damit die Seite ohne Instanz zu sehen ist. `?demo=mitglied` zeigt jemanden ohne Gruppen-Admin-Recht,
 * `?demo=fehler` den Fehlerfall. Wird nie mitgebaut (siehe `main.tsx`). Keine echten Namen.
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
    '/api/group/roles': { data: [{ id: 16, name: 'Leiter', isLeader: true }] },
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
