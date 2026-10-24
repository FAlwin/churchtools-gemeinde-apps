/**
 * **Nur zum Entwickeln** (`npm run dev -w organigramm`, dann `…/ccm/organigramm/?demo`): spielt die
 * ChurchTools-Antworten nach, in der Form, die gemessen wurde (Live 19.10.2026, Test-Instanz 22.10.2026),
 * damit die Seite ohne Instanz zu sehen ist. `?demo=mitglied` zeigt jemanden ohne Gruppen-Admin-Recht (zwei
 * Gruppen ohne Leserecht), `?demo=wackel` eine Gruppe, deren Mitglieder vorübergehend nicht laden, `?demo=fehler`
 * den Fehlerfall beim Start, `?demo=konflikt` einen gleichzeitigen Plan-Schreiber (O7). Wird nie mitgebaut (siehe `main.tsx`). Keine echten Namen.
 *
 * Seit O5 auch schreibend: Umhängen, Lösen und Anlegen verändern die Gruppen und die Hierarchie dieser Sitzung,
 * mit den gemessenen Antworten (400 „schon gesetzt“, 204 beim Lösen, 201 mit ID beim Anlegen). Seit O6 ebenso
 * Mitglieder (aufnehmen, Rolle, beenden per `memberEndDate`), Rechte je Gruppe und die Personensuche. Neu laden setzt
 * zurück.
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
  memberEndDate: null as string | null,
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
const MITGLIEDER: Record<number, ReturnType<typeof m>[] | undefined> = {
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

// Archivierte Gruppen liefert ChurchTools weder in der Liste noch in der Hierarchie (Messung O7-3, 24.10.2026).
const archiviert = (g: (typeof GRUPPEN)[number]) => g.information.groupStatusId === 3;

function hierarchie() {
  const da = new Set(GRUPPEN.filter((g) => !archiviert(g)).map((g) => g.id));
  return GRUPPEN.filter((g) => da.has(g.id))
    .map((g) => ({
      groupId: g.id,
      parents: (ELTERN.get(g.id) ?? []).filter((p) => da.has(p)),
      children: [...ELTERN].filter(([k, e]) => da.has(k) && e.includes(g.id)).map(([k]) => k),
    }))
    .filter((h) => h.parents.length || h.children.length);
}

const json = (d: unknown, status = 200) =>
  new Response(d === null ? null : JSON.stringify(d), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

/** Die schreibenden und die davon abhängigen lesenden Antworten (O5) – `undefined`, wenn es keine davon ist. */
function struktur(
  method: string,
  pfad: string,
  body: unknown,
  suche: URLSearchParams,
): Response | undefined {
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
    if (method === 'PATCH' && g) {
      // Umbau (O7-3): Name bzw. Status, wie gemessen – auch ein leerer Name wird angenommen.
      const f = (body ?? {}) as { name?: string; groupStatusId?: number };
      if (f.name !== undefined) g.name = f.name;
      if (f.groupStatusId !== undefined) g.information.groupStatusId = f.groupStatusId;
      return json({ data: g });
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
  // ── Mitglieder (O6) ──
  const einer = /^\/api\/groups\/(\d+)\/members\/(\d+)$/.exec(pfad);
  if (einer) {
    const [g, p] = [Number(einer[1]), Number(einer[2])];
    const liste = (MITGLIEDER[g] ??= []);
    const x = liste.find((y) => y.personId === p);
    if (method === 'GET') return x ? json({ data: x }) : json({}, 404);
    if (method === 'DELETE') {
      if (x) liste.splice(liste.indexOf(x), 1);
      return json(null, 204);
    }
    if (method === 'PUT') {
      const f = (body ?? {}) as Record<string, unknown>;
      const neu = x ?? { ...m(p, 15), groupMemberStatus: 'active' };
      if ('groupTypeRoleId' in f) neu.groupTypeRoleId = f.groupTypeRoleId as number;
      if ('groupMemberStatus' in f) neu.groupMemberStatus = f.groupMemberStatus as string;
      if ('memberEndDate' in f) neu.memberEndDate = f.memberEndDate as string | null;
      if (!x) liste.push(neu);
      return json({ data: neu });
    }
  }
  if (method !== 'GET') return undefined;
  // Rechte je Gruppe: Admin bekommt sie global; als Mitglied leitet Alex nur Technik (7) – aufnehmen und Rolle ja,
  // austragen nein (wie gemessen an der Leitung von Lobpreisteam).
  if (/^\/api\/permissions\/internal\/groups\/\d+$/.test(pfad)) {
    const leitet = pfad.endsWith('/7');
    return json({
      data: {
        churchdb: {
          '+add person': leitet,
          '+edit group memberships': leitet,
          '+remove from group': false,
        },
      },
    });
  }
  if (pfad === '/api/search') {
    const q = (suche.get('query') ?? '').toLowerCase();
    return json({
      data: NAMEN.flatMap((n, i) =>
        n.toLowerCase().includes(q)
          ? [{ domainType: 'person', domainIdentifier: String(i + 1), title: n }]
          : [],
      ),
    });
  }
  if (pfad === '/api/persons') {
    return json({
      data: NAMEN.map((n, i) => ({
        id: i + 1,
        firstName: n.split(' ')[0],
        lastName: n.split(' ')[1],
      })),
    });
  }
  const liste = /^\/api\/groups\/(\d+)\/members$/.exec(pfad);
  if (liste) {
    return json({
      data: MITGLIEDER[Number(liste[1])] ?? [],
      meta: { pagination: { lastPage: 1 } },
    });
  }
  if (pfad === '/api/groups') {
    const status = suche.get('group_status_ids[]');
    return json({
      data: GRUPPEN.filter((g) =>
        status === null ? !archiviert(g) : g.information.groupStatusId === Number(status),
      ),
      meta: { pagination: { lastPage: 1 } },
    });
  }
  if (pfad === '/api/groups/hierarchies') return json({ data: hierarchie() });
  return undefined;
}

// ── Speicher der Erweiterung (O7): der Plan „neue Gliederung“ ──
const MODUL = 16;
const KATEGORIEN: { id: number; shorty: string; name: string; customModuleId: number }[] = [];
const WERTE: { id: number; dataCategoryId: number; value: string }[] = [];
let naechsteId = 500;
let beaWarSchon = false;

/**
 * Modul, Kategorien und Werte wie gemessen (O0 §6). `?demo=konflikt`: Beim ersten Ändern des Plans speichert „Bea“
 * gleichzeitig – ChurchTools nimmt beides an, nachgelesen steht Beas Fassung da (so prüft man den Konflikt-Hinweis).
 */
function erweiterung(
  fall: string,
  method: string,
  pfad: string,
  body: unknown,
): Response | undefined {
  if (pfad === '/api/custommodules') {
    return json({ data: [{ id: MODUL, shorty: 'organigramm', name: 'Organigramm' }] });
  }
  if (pfad === `/api/custommodules/${MODUL}/customdatacategories`) {
    if (method === 'POST') {
      const d = body as { shorty: string; name: string };
      KATEGORIEN.push({ id: naechsteId++, shorty: d.shorty, name: d.name, customModuleId: MODUL });
      return json({ data: {} }, 201);
    }
    return json({ data: KATEGORIEN });
  }
  const wert =
    /^\/api\/custommodules\/\d+\/customdatacategories\/(\d+)\/customdatavalues(?:\/(\d+))?$/.exec(
      pfad,
    );
  if (!wert) return undefined;
  const kategorie = Number(wert[1]);
  const w = WERTE.find((x) => x.id === Number(wert[2]));
  const roh = (body as { value?: unknown } | null)?.value;
  const value = typeof roh === 'string' ? roh : '';
  if (method === 'POST') {
    WERTE.push({ id: naechsteId++, dataCategoryId: kategorie, value });
    return json({ data: {} }, 201);
  }
  if (method === 'PUT' && w) {
    if (fall === 'konflikt' && !beaWarSchon) {
      beaWarSchon = true;
      const alt = JSON.parse(w.value) as { version: number; inhalt: { namen: object } };
      w.value = JSON.stringify({
        ...alt,
        version: alt.version + 1,
        zeit: new Date().toISOString(),
        von: { personId: 2, name: 'Bea' },
        inhalt: { ...alt.inhalt, namen: { ...alt.inhalt.namen, '47': 'Café' } },
      });
      return json({ data: {} });
    }
    w.value = value;
    return json({ data: {} });
  }
  if (method === 'DELETE') {
    if (w) WERTE.splice(WERTE.indexOf(w), 1);
    return json(null, 204);
  }
  return json({ data: WERTE.filter((x) => x.dataCategoryId === kategorie) });
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
        // Rollen gehören zu einem Gruppentyp (gemessen O6): Dienst 2, Verteiler 9, Veranstaltung 7
        {
          id: 15,
          name: 'Mitarbeiter',
          nameTranslated: 'Mitarbeiter',
          isLeader: false,
          sortKey: 0,
          groupTypeId: 2,
          isDefault: true,
        },
        {
          id: 16,
          name: 'Leiter',
          nameTranslated: 'Leiter',
          isLeader: true,
          sortKey: 1,
          groupTypeId: 2,
        },
        {
          id: 17,
          name: 'Co-Leiter',
          nameTranslated: 'Co-Leiter',
          isLeader: true,
          sortKey: 2,
          groupTypeId: 2,
        },
        {
          id: 39,
          name: 'leader',
          nameTranslated: 'Leiter',
          isLeader: true,
          sortKey: 1,
          groupTypeId: 9,
        },
        {
          id: 40,
          name: 'member',
          nameTranslated: 'Empfänger',
          isLeader: false,
          sortKey: 0,
          groupTypeId: 9,
          isDefault: true,
        },
        {
          id: 41,
          name: 'Teilnehmer',
          nameTranslated: 'Teilnehmer',
          isLeader: false,
          sortKey: 0,
          groupTypeId: 7,
          isDefault: true,
        },
        {
          id: 42,
          name: 'Leiter',
          nameTranslated: 'Leiter',
          isLeader: true,
          sortKey: 1,
          groupTypeId: 7,
        },
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
          { id: 3, name: 'archived', nameTranslated: 'Archiviert' },
        ],
      },
    },
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
      const s =
        struktur(method, url.pathname, body, url.searchParams) ??
        erweiterung(fall, method, url.pathname, body);
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
