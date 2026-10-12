/**
 * **Nur zum Entwickeln** (`npm run dev -w anmeldungen`, dann `…/ccm/anmeldungen/?demo`): spielt die
 * ChurchTools-Antworten nach, die an der Test-Instanz gemessen wurden (12.10.2026), damit die Seite ohne
 * Instanz zu sehen ist. `?demo=leer` zeigt „keine Gruppen", `?demo=fehler` den Fehlerfall. Wird nie
 * mitgebaut (siehe `main.tsx`).
 */
const DATEN: Record<string, unknown> = {
  '/api/whoami': { data: { id: 1, firstName: 'Alwin' } },
  '/api/persons/1/groups': {
    data: [
      {
        group: { title: 'Technik', domainIdentifier: '7' },
        groupTypeRoleId: 15,
        groupMemberStatus: 'active',
      },
      {
        group: { title: 'Lobpreisteam', domainIdentifier: '9' },
        groupTypeRoleId: 16,
        groupMemberStatus: 'active',
      },
      {
        group: { title: 'Gemeindeessen', domainIdentifier: '20' },
        groupTypeRoleId: 17,
        groupMemberStatus: 'active',
      },
    ],
  },
  '/api/group/roles': {
    data: [
      { id: 16, name: 'Leiter', isLeader: true },
      { id: 17, name: 'Co-Leiter', isLeader: true },
      { id: 15, name: 'Mitarbeiter', isLeader: false },
    ],
  },
  '/api/info': { siteName: 'Evangeliumschristen- Gemeinde e.V.' },
};

export function demoStarten(fall: string): void {
  // ChurchTools gibt der Erweiterung einen Behälter mit fester Höhe (gemessen 07.10.2026); auf der nackten
  // Entwicklerseite übernimmt das `body`, sonst hätte die App die Höhe 0.
  document.body.style.cssText = 'margin: 0; height: 100vh;';
  window.fetch = (input) => {
    const pfad = new URL(
      typeof input === 'string' ? input : input instanceof URL ? input.href : input.url,
    ).pathname;
    if (fall === 'fehler' && pfad.endsWith('/groups'))
      return Promise.resolve(new Response('{}', { status: 502 }));
    const daten = fall === 'leer' && pfad.endsWith('/groups') ? { data: [] } : DATEN[pfad];
    return Promise.resolve(
      daten === undefined
        ? new Response('{}', { status: 404 })
        : new Response(JSON.stringify(daten), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          }),
    );
  };
}
