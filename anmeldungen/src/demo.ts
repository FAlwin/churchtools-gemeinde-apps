/**
 * **Nur zum Entwickeln** (`npm run dev -w anmeldungen`, dann `…/ccm/anmeldungen/?demo`): spielt ChurchTools
 * nach – in der Form, die an der Test-Instanz gemessen wurde (12.10.2026) –, damit die Seite ohne Instanz
 * zu sehen und zu bedienen ist. Seit A3 merkt sich die Demo auch, was geschrieben wird (Anlegen,
 * Einrichten, Termine), bis die Seite neu geladen wird. `?demo=leer` zeigt „keine Gruppen",
 * `?demo=fehler` den Fehlerfall, `?demo=einrichten` die Erweiterung vor dem Einrichten (keine Formular-Adresse), `?demo=admin` einen Gruppen-Admin (verschieben, endgültig löschen). Wird nie mitgebaut (siehe `main.tsx`).
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
  mehr: Partial<OeffentlicheEinstellungen> = {},
): string {
  return einstellungenAlsText({
    ...neueEinstellungen('einfach'),
    termin: { beginn, ende, ort, terminId: null },
    preis: { grundpreis, alter: [], anpassungen: [], extras: [] },
    ctFelder: bezahlt ? { bezahlt } : {},
    ...mehr,
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
  /** Beim Verschieben: die neue Obergruppe, bis die alte entfernt ist (`PUT`, dann `DELETE` parents). */
  neuParent?: number;
  status: number;
  note: string;
  settings: Record<string, unknown>;
  felder: { id: number; name: string; [k: string]: unknown }[];
  /** Titelbild (A5). */
  bild?: string;
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

/**
 * **Bedingungen in der Demo** (F1e, 16.11.2026): Die Lobpreisfreizeit fragt im Kontakt „Bist du im Team?“, je Person
 * „Bereich“ („Technik“ nur fürs Team) und „Team-Erfahrung“ (nur fürs Team). Die Familie Beispiel (Anmelde-Nr. DEMO01)
 * verstößt dagegen – so, als hätte jemand in ChurchTools von Hand etwas eingetragen. Damit zeigt die Nachprüfung zwei
 * Befunde. Tom Muster (DEMO02) ist im Team – bei ihm zeigt „Person dazu“ die Fragen fürs Team.
 */
const DEMO_SPALTEN = {
  nr: 74,
  kontakt: 75,
  auswahl: 76,
  team: 78,
  bereich: 79,
  erfahrung: 80,
  // F3: der Text der freien Antwort „Anderer Bereich“ in seiner zweiten Spalte.
  'bereich.frei': 81,
};
function mitBedingungen(
  f: OeffentlicheEinstellungen['formular'],
): OeffentlicheEinstellungen['formular'] {
  const frage = (
    id: string,
    typ: 'janein' | 'radio' | 'text' | 'schritt',
    text: string,
    antworten: string[] = [],
  ) => ({
    id,
    art: 'eigen' as const,
    typ,
    frage: text,
    hilfe: '',
    zustand: 'freiwillig' as const,
    antworten,
  });
  const imTeam = {
    modus: 'eine' as const,
    regeln: [{ feld: 'team', op: 'ist' as const, wert: 'Ja' }],
  };
  return {
    anmeldung: [
      ...f.anmeldung.slice(0, -1),
      // F2: Das Formular blättert – „Mitarbeit“ (Team-Frage + Personen), dann „Team“ nur für Mitarbeitende.
      frage('s-mit', 'schritt', 'Mitarbeit'),
      frage('team', 'janein', 'Bist du im Team?'),
      ...f.anmeldung.slice(-1),
    ],
    person: [
      ...f.person,
      {
        ...frage('bereich', 'radio', 'Bereich', ['Küche', 'Technik']),
        antwortBed: { Technik: { ...imTeam, art: 'grau' as const, grund: 'nur fürs Team' } },
        frei: { name: 'Anderer Bereich', textfeld: 'auf' as const },
      },
      { ...frage('s-team', 'schritt', 'Team'), bed: imTeam },
      { ...frage('erfahrung', 'text', 'Team-Erfahrung'), bed: imTeam },
    ],
  };
}
const DEMO_FELDER = [
  { id: 73, name: 'Bezahlt' },
  { id: 74, name: 'Anmelde-Nr.' },
  { id: 75, name: 'Angemeldet von' },
  { id: 76, name: 'Zimmer' },
  {
    id: 78,
    name: 'Bist du im Team?',
    fieldTypeCode: 'radioselect',
    options: [
      { id: 781, name: 'Ja' },
      { id: 782, name: 'Nein' },
    ],
  },
  {
    id: 79,
    name: 'Bereich',
    fieldTypeCode: 'radioselect',
    options: [
      { id: 791, name: 'Küche' },
      { id: 792, name: 'Technik' },
      { id: 793, name: 'Anderer Bereich' },
    ],
  },
  { id: 80, name: 'Team-Erfahrung' },
  { id: 81, name: 'Bereich (Anderer Bereich)' },
];
const DEMO_PERSONEN = [
  {
    id: 901,
    firstName: 'Maria',
    lastName: 'Beispiel',
    email: 'maria@beispiel.test',
    birthday: '1988-04-12',
  },
  { id: 902, firstName: 'Jonas', lastName: 'Beispiel', email: null, birthday: '2014-06-01' },
  {
    id: 903,
    firstName: 'Tom',
    lastName: 'Muster',
    email: 'tom@muster.test',
    birthday: '1979-09-30',
  },
  // Zum Finden bei „Person dazu“ (noch in keiner Veranstaltung).
  { id: 904, firstName: 'Anna', lastName: 'Muster', email: null, birthday: '2012-03-08' },
];
const familie = (seit: string) => ({
  data: [
    // Maria: nicht im Team, aber „Technik“ (nur fürs Team).
    [
      901,
      { 73: '0', 74: 'DEMO01', 75: 'Maria Beispiel', 76: '4-Bett-Zimmer', 78: '782', 79: '792' },
    ],
    // Jonas: „Team-Erfahrung“ beantwortet – die Frage käme nur fürs Team. Bereich: freie Antwort „Fotos“ (F3).
    [902, { 73: '0', 74: 'DEMO01', 79: '793', 80: 'drei Jahre', 81: 'Fotos' }],
    // Tom (DEMO02): im Team, alles erlaubt – für „Person dazu“ mit der Kontakt-Antwort „Ja“.
    [
      903,
      {
        73: '0',
        74: 'DEMO02',
        75: 'Tom Muster',
        76: '2-Bett-Zimmer',
        78: '781',
        79: '792',
        80: 'Leitung Technik',
      },
    ],
  ].map(([id, werte]) => {
    const p = DEMO_PERSONEN.find((x) => x.id === id)!;
    return {
      personId: p.id,
      person: { domainAttributes: { firstName: p.firstName, lastName: p.lastName } },
      groupTypeRoleId: 15,
      groupMemberStatus: 'active',
      memberStartDate: seit,
      fields: Object.entries(werte as Record<string, string>).map(([f, value]) => ({
        id: Number(f),
        value,
      })),
    };
  }),
  meta: { pagination: { lastPage: 1 } },
});

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
              { name: '4-Bett-Zimmer', preisCent: 6552, kontingent: 8, belegt: 0, personenJe: 0 },
              { name: '2-Bett-Zimmer', preisCent: 8900, kontingent: 4, belegt: 0, personenJe: 0 },
            ],
          },
          73,
          // A4: alle Preis-Bausteine und eine Bankverbindung, damit „Probe rechnen“ etwas zu tun hat.
          {
            preis: {
              grundpreis: {
                art: 'auswahl',
                betragCent: 0,
                gilt: 'person',
                auswahlName: 'Zimmer',
                optionen: [
                  {
                    name: '4-Bett-Zimmer',
                    preisCent: 6552,
                    kontingent: 8,
                    belegt: 0,
                    personenJe: 0,
                  },
                  {
                    name: '2-Bett-Zimmer',
                    preisCent: 8900,
                    kontingent: 4,
                    belegt: 0,
                    personenJe: 0,
                  },
                ],
              },
              alter: [
                { von: 0, bis: 2, art: 'frei', wert: 0 },
                { von: 3, bis: 11, art: 'prozent', wert: 50 },
              ],
              anpassungen: [
                {
                  art: 'rabatt',
                  bezeichnung: 'Frühbucher',
                  bedingung: 'fruehbucher',
                  bis: tag(10).slice(0, 10),
                  abKind: 2,
                  einheit: 'euro',
                  wert: 500,
                  gilt: 'person',
                },
              ],
              extras: [{ bezeichnung: 'Bettwäsche leihen', preisCent: 800, gilt: 'person' }],
            },
            formular: mitBedingungen(neueEinstellungen('freizeit').formular),
            ctFelder: { bezahlt: 73, ...DEMO_SPALTEN },
            bezahlung: {
              kontoinhaber: 'Gemeinde e.V. (Beispiel)',
              iban: 'DE89370400440532013000',
              bic: '',
              fristTage: 14,
              zweck: 'Lobpreisfreizeit [Nachname]',
            },
          },
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
  46: familie(tag(-5).slice(0, 10)),
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
  if (fall === 'einrichten') DATEN.werte = [];
  const gruppen = demoGruppen();
  gruppen.get(46)!.felder = DEMO_FELDER.map((f) => ({ ...f }));
  const antwort = (daten: unknown, status = 200) =>
    Promise.resolve(
      // 204 hat keinen Inhalt – sonst wirft `Response`.
      new Response(status === 204 ? null : JSON.stringify(daten), {
        status,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
  const gruppeRoh = (id: number, x: G) => ({
    id,
    name: x.name,
    information: {
      note: x.note,
      groupStatusId: x.status,
      groupTypeId: 5,
      imageUrl: x.bild ?? null,
    },
    settings: x.settings,
  });
  // Archivierte Gruppen stehen weder in `children` noch in `hierarchies` (gemessen 13.10.2026).
  const kinderVon = (p: number) => [...gruppen].filter(([, x]) => x.parent === p && x.status !== 3);
  const TEAMS: Record<number, string> = { 7: 'Technik', 9: 'Lobpreisteam' };

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
      // `?demo=admin`: Gruppen-Admin (darf verschieben und endgültig löschen).
      const churchdb = fall === 'admin' ? { 'administer groups': true } : {};
      return antwort({ data: { churchdb, churchcal: { 'edit category': [1] } } });
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
          domainAttributes: { note: x.note, groupStatusId: x.status, groupTypeId: 5 },
        })),
      });
    }
    if (pfad === '/groups' && m === 'GET' && url.searchParams.has('group_status_ids[]')) {
      const status = Number(url.searchParams.get('group_status_ids[]'));
      return antwort({
        data: [...gruppen]
          .filter(([, x]) => x.status === status)
          .map(([id, x]) => gruppeRoh(id, x)),
        meta: { pagination: { lastPage: 1 } },
      });
    }
    r = /^\/groups\/(\d+)\/parents(?:\/(\d+))?$/.exec(pfad);
    if (r) {
      const x = gruppen.get(Number(r[1]));
      if (!x) return antwort({}, 404);
      if (fall !== 'admin' && m !== 'GET') return antwort({ message: 'Forbidden' }, 403);
      const p = Number(r[2]);
      if (m === 'PUT') x.neuParent = p;
      if (m === 'DELETE' && x.parent === p && x.neuParent) {
        x.parent = x.neuParent;
        x.neuParent = undefined;
      }
      return antwort(
        m === 'GET'
          ? { data: [{ title: TEAMS[x.parent] ?? 'Team', domainIdentifier: String(x.parent) }] }
          : {},
        m === 'PUT' ? 201 : m === 'DELETE' ? 204 : 200,
      );
    }
    // Personensuche (Anmeldung von Hand): findet die Demo-Personen am Vor- oder Nachnamen.
    if (pfad === '/search') {
      const q = (url.searchParams.get('query') ?? '').toLowerCase();
      return antwort({
        data: DEMO_PERSONEN.filter((p) =>
          q.split(/\s+/).every((w) => `${p.firstName} ${p.lastName}`.toLowerCase().includes(w)),
        ).map((p) => ({ domainType: 'person', domainIdentifier: String(p.id) })),
      });
    }
    if (pfad === '/persons' && m === 'GET' && url.searchParams.has('ids[]')) {
      const ids = url.searchParams.getAll('ids[]').map(Number);
      return antwort({ data: DEMO_PERSONEN.filter((p) => ids.includes(p.id)) });
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
        felder: q.felder.map((f) => ({ ...f, id: f.id + 1000 })),
      });
      return antwort({ data: { id } }, 201);
    }
    // Antwortmöglichkeiten bekommen IDs wie in ChurchTools (A5).
    const mitIds = (o: unknown) =>
      Array.isArray(o)
        ? (o as { id?: string; name: string }[]).map((x) => ({
            id: x.id ?? String(naechste++),
            name: x.name,
          }))
        : o;
    r = /^\/groups\/(\d+)\/memberfields\/group\/(\d+)$/.exec(pfad);
    if (r) {
      const x = gruppen.get(Number(r[1]))!;
      const feld = x.felder.find((f) => f.id === Number(r![2]));
      if (!feld) return antwort({}, 404);
      if (m === 'DELETE') {
        x.felder = x.felder.filter((f) => f !== feld);
        return antwort({}, 204);
      }
      Object.assign(feld, body, 'options' in body ? { options: mitIds(body.options) } : {});
      return antwort({ data: feld });
    }
    r = /^\/files\/groupimage\/(\d+)$/.exec(pfad);
    if (r) {
      const x = gruppen.get(Number(r[1]))!;
      if (m === 'DELETE') {
        x.bild = undefined;
        return antwort({}, 204);
      }
      const datei = (init?.body as FormData | undefined)?.get('files[]');
      x.bild = datei instanceof Blob ? URL.createObjectURL(datei) : undefined;
      return antwort({ data: [{ imageUrl: x.bild }] });
    }
    r = /^\/groups\/(\d+)\/memberfields(\/group)?$/.exec(pfad);
    if (r) {
      const x = gruppen.get(Number(r[1]))!;
      if (m === 'POST') {
        const id = naechste++;
        x.felder.push({
          ...body,
          id,
          name: String(body.name),
          note: null,
          options: mitIds(body.options),
        });
        return antwort({ data: { id } }, 201);
      }
      return antwort({ data: x.felder.map((f) => ({ type: 'group', field: f })) });
    }
    // Verlauf (Anmeldetag, Absagen, A7): in der Demo leer – ohne ihn brach der Bereich „Anmeldungen“ mit 404 ab.
    if (/^\/groups\/\d+\/members\/history$/.test(pfad)) return antwort({ data: [] });
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
      if (m === 'DELETE') {
        if (fall !== 'admin') return antwort({ message: 'Forbidden' }, 403);
        gruppen.delete(id);
        return antwort({}, 204);
      }
      if (m === 'PATCH') {
        for (const [k, v] of Object.entries(body)) {
          if (k === 'note') x.note = String(v);
          else if (k === 'name') x.name = String(v);
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
    // Datenbereich der Erweiterung (A6-2): die Einstellungen der Gemeinde. Vorbelegt mit einer Formular-
    // Adresse, damit die Startseite zu sehen ist; `?demo=einrichten` zeigt den Zustand davor.
    // Stammdaten für die Vorgaben neuer Personen (gemessen 14.10.2026 in der Test-Instanz).
    if (pfad === '/statuses')
      return antwort({
        data: [
          { id: 2, name: 'status.potential', nameTranslated: 'Interessent', isMember: false },
          { id: 3, name: 'status.member', nameTranslated: 'Mitglied', isMember: true },
        ],
      });
    if (pfad === '/campuses') return antwort({ data: [{ id: 0, name: 'Zentrale' }] });
    if (pfad === '/departments') return antwort({ data: [{ id: 1, name: 'Gemeindeliste' }] });
    if (pfad === '/config')
      return antwort({
        data: { access_control_allow_origins: '["https://anmeldung.beispiel.de"]' },
      });
    if (pfad === '/custommodules') return antwort({ data: [{ id: 7, shorty: 'anmeldungen' }] });
    if (pfad === '/custommodules/7/customdatacategories') {
      if (m === 'POST') {
        DATEN.kategorien.push({ id: 50, shorty: String(body.shorty) });
        return antwort({ data: { id: 50 } }, 201);
      }
      return antwort({ data: DATEN.kategorien });
    }
    r = /^\/custommodules\/7\/customdatacategories\/50\/customdatavalues(?:\/(\d+))?$/.exec(pfad);
    if (r) {
      if (m === 'POST')
        DATEN.werte.push({ id: naechste++, dataCategoryId: 50, value: String(body.value) });
      if (m === 'PUT') {
        const w = DATEN.werte.find((x) => x.id === Number(r[1]));
        if (w) w.value = String(body.value);
      }
      return antwort({ data: m === 'GET' ? DATEN.werte : {} }, m === 'POST' ? 201 : 200);
    }
    return antwort({}, 404);
  };
}

/** Was die Demo im Datenbereich der Erweiterung hält (`?demo=einrichten`: noch nichts). */
const DATEN: {
  kategorien: { id: number; shorty: string }[];
  werte: { id: number; dataCategoryId: number; value: string }[];
} = {
  kategorien: [{ id: 50, shorty: 'anmeldungen-einstellungen' }],
  werte: [
    {
      id: 1,
      dataCategoryId: 50,
      value: JSON.stringify({
        art: 'anmeldungen-einstellungen',
        fassung: 1,
        neuePersonen: { statusId: 2, campusId: 0, departmentId: 1 },
        formularAdresse: 'https://anmeldung.beispiel.de/',
      }),
    },
  ],
};
