/**
 * **Nur zum Entwickeln** (`npm run dev -w anmeldungen`, dann `…/ccm/anmeldungen/?demo`): spielt ChurchTools
 * nach – in der Form, die an der Test-Instanz gemessen wurde (12.10.2026) –, damit die Seite ohne Instanz
 * zu sehen und zu bedienen ist. Seit A3 merkt sich die Demo auch, was geschrieben wird (Anlegen,
 * Einrichten, Termine), bis die Seite neu geladen wird. `?demo=leer` zeigt „keine Gruppen",
 * `?demo=fehler` den Fehlerfall. Wird nie mitgebaut (siehe `main.tsx`).
 *
 * Die Beschreibungen entstehen mit `einstellungenAlsText` – wie im Betrieb.
 */
import { einstellungenAlsText, type OeffentlicheEinstellungen } from '@shared/anmeldung/formular';
import { neueEinstellungen } from '@shared/anmeldung/vorlagen';

function beschreibung(
  beginn: string,
  ende: string | null,
  ort: string,
  grundpreis: OeffentlicheEinstellungen['preis']['grundpreis'],
  bezahlt?: number,
): string {
  return einstellungenAlsText({
    ...neueEinstellungen('einfach'),
    termin: { beginn, ende, ort, terminId: null },
    preis: { grundpreis, alter: [], anpassungen: [], extras: [] },
    ctFelder: bezahlt ? { bezahlt } : {},
  });
}

const fest = (betragCent: number) => ({
  art: 'fest' as const,
  betragCent,
  gilt: 'person' as const,
  auswahlName: '',
  optionen: [],
});

/** Ein Tag relativ zu heute, damit die Demo nie veraltet. */
function tag(abHeute: number, uhr = '19:00'): string {
  const d = new Date(Date.now() + abHeute * 86_400_000);
  return `${d.toISOString().slice(0, 10)}T${uhr}`;
}
const utc = (lokal: string) => new Date(lokal).toISOString().replace('.000Z', 'Z');

interface G {
  name: string;
  parent: number;
  status: number;
  note: string;
  settings: Record<string, unknown>;
  felder: { id: number; name: string }[];
}

let naechste = 500;

function g(
  name: string,
  parent: number,
  note: string,
  settings: Record<string, unknown>,
  status = 1,
): G {
  return { name, parent, status, note, settings, felder: [{ id: 73, name: 'Bezahlt' }] };
}

function demoGruppen(): Map<number, G> {
  return new Map([
    [
      40,
      g('Lobpreisabend', 9, beschreibung(tag(20), null, 'Gemeindesaal', fest(0)), {
        maxMembers: 6,
        allowWaitinglist: true,
        signUpOpeningDate: utc(tag(-11)),
        signUpClosingDate: utc(tag(18)),
      }),
    ],
    [
      43,
      g(
        'Worship-Workshop',
        9,
        beschreibung(tag(54, '10:00'), null, 'Gemeindesaal', fest(1500), 73),
        { maxMembers: 20 },
        2,
      ),
    ],
    [
      46,
      g(
        'Lobpreisfreizeit',
        9,
        beschreibung(
          tag(39, '18:00'),
          tag(41, '13:00'),
          'Haus Lutzenberg',
          {
            art: 'auswahl',
            betragCent: 0,
            gilt: 'person',
            auswahlName: 'Zimmer',
            optionen: [
              { name: '4-Bett-Zimmer', preisCent: 6552, kontingent: 8, belegt: 0 },
              { name: '2-Bett-Zimmer', preisCent: 8900, kontingent: 4, belegt: 0 },
            ],
          },
          73,
        ),
        {
          maxMembers: 20,
          allowWaitinglist: true,
          signUpOpeningDate: utc(tag(-27)),
          signUpClosingDate: utc(tag(29)),
        },
      ),
    ],
    [
      49,
      g('Technik-Schulung', 7, beschreibung(tag(-23, '10:00'), null, 'Technikraum', fest(0)), {
        maxMembers: 10,
      }),
    ],
    [
      52,
      g(
        'Tontechnik-Grundkurs',
        7,
        beschreibung(tag(33, '09:30'), null, 'Gemeindesaal', fest(1200), 73),
        { maxMembers: 12, signUpOpeningDate: utc(tag(8)) },
      ),
    ],
  ]);
}

const mitglieder = (aktiv: (string | null)[], wartend = 0) => ({
  data: [
    ...aktiv.map((b) => ({
      groupMemberStatus: 'active',
      fields: b === null ? [] : [{ id: 73, name: 'Bezahlt', value: b }],
    })),
    ...Array.from({ length: wartend }, () => ({ groupMemberStatus: 'waiting', fields: [] })),
  ],
  meta: { pagination: { lastPage: 1 } },
});

const MITGLIEDER: Record<number, unknown> = {
  40: mitglieder([null, null, null, null, null], 2),
  46: mitglieder(['1', '0', '0', '0']),
  52: mitglieder(['0', '0']),
};

const TERMINE: Record<string, unknown>[] = [
  {
    id: 801,
    title: 'Gemeindeessen',
    startDate: utc(tag(34, '12:00')),
    endDate: utc(tag(34, '14:00')),
    address: { name: 'Gemeindesaal', city: 'Lohmar' },
  },
  {
    id: 802,
    title: 'Gemeindefreizeit',
    startDate: utc(tag(60, '17:00')),
    endDate: utc(tag(62, '13:00')),
    address: { name: 'Haus Lutzenberg' },
  },
];

export function demoStarten(fall: string): void {
  // ChurchTools gibt der Erweiterung einen Behälter mit fester Höhe (gemessen 07.10.2026); auf der nackten
  // Entwicklerseite übernimmt das `body`, sonst hätte die App die Höhe 0.
  document.body.style.cssText = 'margin: 0; height: 100vh;';
  const gruppen = demoGruppen();
  const antwort = (daten: unknown, status = 200) =>
    Promise.resolve(
      new Response(JSON.stringify(daten), {
        status,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
  const gruppeRoh = (id: number, x: G) => ({
    id,
    name: x.name,
    information: { note: x.note, groupStatusId: x.status, groupTypeId: 5 },
    settings: x.settings,
  });
  const kinderVon = (p: number) => [...gruppen].filter(([, x]) => x.parent === p);

  window.fetch = (input, init) => {
    const url = new URL(
      typeof input === 'string' ? input : input instanceof URL ? input.href : input.url,
    );
    const pfad = url.pathname.replace(/^\/api/, '');
    const m = (init?.method ?? 'GET').toUpperCase();
    // Die Verbindung schickt JSON immer als Text (`ui/ct/verbindung.ts`).
    const body =
      typeof init?.body === 'string' ? (JSON.parse(init.body) as Record<string, unknown>) : {};
    if (fall === 'fehler' && pfad.endsWith('/children')) return antwort({}, 502);
    if (pfad === '/csrftoken') return antwort({ data: 'demo' });
    if (pfad === '/whoami') return antwort({ data: { id: 1, firstName: 'Alwin' } });
    if (pfad === '/info') return antwort({ siteName: 'Evangeliumschristen- Gemeinde e.V.' });
    if (pfad === '/persons/1/groups') {
      const team = (title: string, id: number, rolle: number) => ({
        group: { title, domainIdentifier: String(id) },
        groupTypeRoleId: rolle,
        groupMemberStatus: 'active',
      });
      return antwort({
        data: fall === 'leer' ? [] : [team('Technik', 7, 15), team('Lobpreisteam', 9, 16)],
      });
    }
    if (pfad === '/group/roles') {
      return antwort({
        data: [
          { id: 16, name: 'Leiter', isLeader: true },
          { id: 15, name: 'Mitarbeiter', isLeader: false },
        ],
      });
    }
    if (pfad === '/group/grouptypes') {
      return antwort({
        data: [
          { id: 2, name: 'Dienst' },
          { id: 5, name: 'Anmeldung' },
        ],
      });
    }
    if (pfad === '/groups/hierarchies') {
      return antwort({
        data: [9, 7].map((p) => ({ groupId: p, children: kinderVon(p).map(([id]) => id) })),
      });
    }
    if (pfad === '/permissions/global') {
      return antwort({ data: { churchdb: {}, churchcal: { 'edit category': [1] } } });
    }
    let r = /^\/permissions\/internal\/groups\/(\d+)$/.exec(pfad);
    if (r) {
      const id = Number(r[1]);
      // Wie bei Alwin: Leitung im Lobpreisteam (darf anlegen und einrichten), Mitglied in Technik.
      const leitung = id === 9 || gruppen.get(id)?.parent === 9;
      return antwort({
        data: {
          churchdb: {
            '+create group': id === 9 ? [5] : 0,
            '+edit group infos': leitung,
            '+edit group basic settings': leitung,
          },
        },
      });
    }
    r = /^\/groups\/(\d+)\/children$/.exec(pfad);
    if (r) {
      return antwort({
        data: kinderVon(Number(r[1])).map(([id, x]) => ({
          title: x.name,
          domainIdentifier: String(id),
          domainAttributes: { note: x.note, groupStatusId: x.status },
        })),
      });
    }
    if (pfad === '/groups' && m === 'GET') {
      const ids = url.searchParams.getAll('ids[]').map(Number);
      return antwort({
        data: ids.filter((id) => gruppen.has(id)).map((id) => gruppeRoh(id, gruppen.get(id)!)),
        meta: { pagination: { lastPage: 1 } },
      });
    }
    if (pfad === '/groups' && m === 'POST') {
      const id = naechste++;
      gruppen.set(id, {
        name: String(body.name),
        parent: Number(body.parentGroupId),
        status: 2,
        note: '',
        settings: {},
        felder: [],
      });
      return antwort({ data: { id } }, 201);
    }
    r = /^\/groups\/(\d+)\/duplicate$/.exec(pfad);
    if (r) {
      const q = gruppen.get(Number(r[1]))!;
      const id = naechste++;
      gruppen.set(id, {
        ...q,
        name: String(body.newName),
        status: 2,
        settings: { ...q.settings },
        felder: q.felder.map((f) => ({ id: f.id + 1000, name: f.name })),
      });
      return antwort({ data: { id } }, 201);
    }
    r = /^\/groups\/(\d+)\/memberfields(\/group)?$/.exec(pfad);
    if (r) {
      const x = gruppen.get(Number(r[1]))!;
      if (m === 'POST') {
        const id = naechste++;
        x.felder.push({ id, name: String(body.name) });
        return antwort({ data: { id } }, 201);
      }
      return antwort({ data: x.felder.map((f) => ({ type: 'group', field: f })) });
    }
    r = /^\/groups\/(\d+)\/members$/.exec(pfad);
    if (r) {
      return antwort(
        MITGLIEDER[Number(r[1])] ?? { data: [], meta: { pagination: { lastPage: 0 } } },
      );
    }
    r = /^\/groups\/(\d+)$/.exec(pfad);
    if (r) {
      const id = Number(r[1]);
      const x = gruppen.get(id);
      if (!x) return antwort({}, 404);
      if (m === 'PATCH') {
        for (const [k, v] of Object.entries(body)) {
          if (k === 'note') x.note = String(v);
          else if (k === 'groupStatusId') x.status = Number(v);
          else x.settings[k] = v;
        }
      }
      return antwort({ data: gruppeRoh(id, x) });
    }
    if (pfad === '/calendars') {
      return antwort({
        data: [
          { id: 2, name: 'Gottesdienst' },
          { id: 1, name: 'Sonstige Veranstaltung' },
        ],
      });
    }
    if (pfad === '/calendars/appointments')
      return antwort({ data: TERMINE.map((t) => ({ base: t })) });
    r = /^\/calendars\/(\d+)\/appointments$/.exec(pfad);
    if (r && m === 'POST') {
      const ort = (body.address as { meetingAt?: string } | null)?.meetingAt ?? null;
      const t = { ...body, id: naechste++, address: { name: ort } };
      TERMINE.push(t);
      return antwort({ data: { id: t.id } }, 201);
    }
    r = /^\/calendars\/(\d+)\/appointments\/(\d+)$/.exec(pfad);
    if (r) {
      const id = Number(r[2]);
      return antwort({ data: { appointment: { base: TERMINE.find((t) => t.id === id) } } });
    }
    return antwort({}, 404);
  };
}
