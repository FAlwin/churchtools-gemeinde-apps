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
