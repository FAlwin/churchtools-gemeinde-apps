/**
 * **Nur zum Entwickeln** (`npm run dev -w protokolle`, dann `…/ccm/protokolle/?demo`): spielt die
 * ChurchTools-Antworten nach, in der Form, die an der Test-Instanz gemessen wurde (16.10. und 22.10.2026),
 * damit die Seite ohne Instanz zu sehen ist. Fälle: `?demo` (Admin; versteckte, eingerichtete Gruppe + nicht
 * eingerichtete), `?demo=mitglied` (kein Admin, also keine Verwaltung), `?demo=leer` (in keiner Gruppe),
 * `?demo=ohne-modul` (Erweiterung nicht installiert), `?demo=fehler` (ChurchTools antwortet nicht),
 * `?demo=einrichten-fehler` (Rechte setzen scheitert vorübergehend). Wird nie mitgebaut (siehe `main.tsx`).
 *
 * Die Verwaltung (S2-2) schreibt hier in einen Speicher im Browser: Kategorien, Werte und Rechte bleiben bis
 * zum Neuladen – so lässt sich „Gruppe einrichten“ durchklicken.
 */
import { kategorieName } from '@shared/protokolle/gruppen';
import { kuerzelMitarbeit, kuerzelProtokolle, KUERZEL_VORLAGEN } from '@shared/protokolle/speicher';

const MODUL = 20;
/** Schlüssel der Rechte wie gemessen (Modul 24, S2-1); die Nummern sind nur für die Demo. */
const RECHTE = ['view', 'view custom category', 'create custom category', 'edit custom category'];
const DATEN = ['view custom data', 'create custom data', 'edit custom data', 'delete custom data'];

const mitglied = (id: number, title: string, rolle = 8) => ({
  group: { domainIdentifier: String(id), title, domainAttributes: { note: null } },
  groupTypeRoleId: rolle,
  groupMemberStatus: 'active',
  memberEndDate: null,
});

interface Speicher {
  kategorien: { id: number; shorty: string; name: string; customModuleId: number }[];
  werte: Map<number, { id: number; dataCategoryId: number; value: string }[]>;
  rechte: Map<number, Set<string>>;
  naechste: number;
}

function speicherAnlegen(fall: string): Speicher {
  const k = (id: number, shorty: string, name: string) => ({
    id,
    shorty,
    name,
    customModuleId: MODUL,
  });
  return {
    kategorien:
      fall === 'leer'
        ? []
        : [
            k(60, kuerzelProtokolle(11), kategorieName('Protokolle', 'Leitungsteam')),
            k(61, kuerzelMitarbeit(11), kategorieName('Mitarbeit', 'Leitungsteam')),
            k(70, kuerzelProtokolle(7), kategorieName('Protokolle', 'Jugendleitung')),
            k(5, KUERZEL_VORLAGEN, 'Vorlagen'),
          ],
    werte: new Map(),
    rechte: new Map(),
    naechste: 100,
  };
}

const ROLLEN: Record<number, { id: number; nameTranslated: string; isLeader: boolean }[]> = {
  7: [
    { id: 701, nameTranslated: 'Leiter', isLeader: true },
    { id: 702, nameTranslated: 'Mitarbeiter', isLeader: false },
    { id: 703, nameTranslated: 'Teilnehmer', isLeader: false },
  ],
  11: [
    { id: 1101, nameTranslated: 'Leiter', isLeader: true },
    { id: 1102, nameTranslated: 'Teilnehmer', isLeader: false },
  ],
  19: [
    { id: 1901, nameTranslated: 'Leiter', isLeader: true },
    { id: 1902, nameTranslated: 'Teilnehmer', isLeader: false },
  ],
};

type Antwort = { status: number; data?: unknown } | null;

function antwort(
  fall: string,
  s: Speicher,
  methode: string,
  pfad: string,
  rumpf: Record<string, unknown>,
): Antwort {
  if (fall === 'fehler' && pfad.endsWith('/customdatacategories')) return { status: 502 };
  if (pfad === '/api/csrftoken') return { status: 200, data: 'demo' };
  if (pfad === '/api/whoami') return { status: 200, data: { id: 1, firstName: 'Alwin' } };
  if (pfad === '/api/info')
    return { status: 200, data: { siteName: 'Evangeliumschristen-Gemeinde e.V.' } };
  if (pfad === '/api/permissions/global')
    return {
      status: 200,
      data: { churchcore: { 'administer persons': fall !== 'mitglied' } },
    };
  if (pfad === '/api/group/roles')
    return {
      status: 200,
      data: [
        { id: 8, isLeader: false },
        { id: 9, isLeader: true },
      ],
    };
  // Das Leitungsteam ist versteckt: es fehlt hier (S0, 403) und kommt nur über die Kategorien.
  if (pfad === '/api/persons/1/groups')
    return {
      status: 200,
      data: fall === 'leer' ? [] : [mitglied(19, 'Technik-Team', 9), mitglied(7, 'Jugendleitung')],
    };
  if (pfad === '/api/groups')
    return {
      status: 200,
      data: [
        { id: 7, name: 'Jugendleitung', settings: { isHidden: false } },
        { id: 11, name: 'Leitungsteam', settings: { isHidden: true } },
        { id: 19, name: 'Technik-Team', settings: { isHidden: false } },
      ],
    };
  const rollen = /^\/api\/groups\/(\d+)\/roles$/.exec(pfad);
  if (rollen) return { status: 200, data: ROLLEN[Number(rollen[1])] ?? [] };
  if (pfad === '/api/calendars')
    return {
      status: 200,
      data: [
        { id: 4, name: 'Gemeindeleitung' },
        { id: 2, name: 'Gottesdienst' },
      ],
    };
  if (pfad === '/api/permissions/definitions')
    return {
      status: 200,
      data: {
        modules: [
          {
            key: 'churchcal',
            permissions: [
              { authId: 403, key: 'view category' },
              { authId: 404, key: 'edit category' },
            ],
          },
          {
            key: 'protokolle',
            permissions: [...RECHTE, ...DATEN].map((key, i) => ({ authId: 2060 + i, key })),
          },
        ],
      },
    };
  const recht = /^\/api\/permissions\/group_role\/(\d+)$/.exec(pfad);
  if (recht) {
    const rolle = Number(recht[1]);
    const set = s.rechte.get(rolle) ?? new Set<string>();
    s.rechte.set(rolle, set);
    if (methode === 'GET')
      return {
        status: 200,
        data: [...set].map((x) => {
          const [authId, dataId] = x.split(':');
          return {
            authId: Number(authId),
            dataId: dataId === '-' ? null : Number(dataId),
            type: 'grant',
          };
        }),
      };
    if (fall === 'einrichten-fehler') return { status: 503 };
    const schluessel = `${String(rumpf.authId)}:${(rumpf.dataId as number[] | undefined)?.[0] ?? '-'}`;
    if (methode === 'PUT') set.add(schluessel);
    if (methode === 'DELETE') set.delete(schluessel);
    return { status: 204 };
  }
  if (pfad === '/api/custommodules')
    return {
      status: 200,
      data:
        fall === 'ohne-modul'
          ? [{ id: 10, shorty: 'musik-app' }]
          : [
              { id: 10, shorty: 'musik-app' },
              { id: MODUL, shorty: 'protokolle' },
            ],
    };
  if (pfad === `/api/custommodules/${MODUL}/customdatacategories`) {
    if (methode === 'POST') {
      s.kategorien.push({
        id: s.naechste++,
        shorty: String(rumpf.shorty),
        name: String(rumpf.name),
        customModuleId: MODUL,
      });
      return { status: 201, data: {} };
    }
    return { status: 200, data: s.kategorien };
  }
  const wert =
    /^\/api\/custommodules\/\d+\/customdatacategories\/(\d+)\/customdatavalues(?:\/(\d+))?$/.exec(
      pfad,
    );
  if (wert) {
    const kategorie = Number(wert[1]);
    const liste = s.werte.get(kategorie) ?? [];
    s.werte.set(kategorie, liste);
    if (methode === 'POST')
      liste.push({ id: s.naechste++, dataCategoryId: kategorie, value: String(rumpf.value) });
    const w = liste.find((x) => x.id === Number(wert[2]));
    if (methode === 'PUT' && w) w.value = String(rumpf.value);
    return { status: methode === 'POST' ? 201 : 200, data: methode === 'GET' ? liste : {} };
  }
  return null;
}

export function demoStarten(fall: string): void {
  // ChurchTools gibt der Erweiterung einen Behälter mit fester Höhe; auf der nackten Entwicklerseite übernimmt
  // das `body`, sonst hätte die App die Höhe 0.
  document.body.style.cssText = 'margin: 0; height: 100vh;';
  const speicher = speicherAnlegen(fall);
  window.fetch = async (input, init) => {
    const url = new URL(
      typeof input === 'string' ? input : input instanceof URL ? input.href : input.url,
    );
    const methode = (init?.method ?? 'GET').toUpperCase();
    const rumpf =
      typeof init?.body === 'string' ? (JSON.parse(init.body) as Record<string, unknown>) : {};
    // Schreiben dauert in ChurchTools spürbar (Einrichten ~10 s) – etwas davon, damit „Wird eingerichtet …“ zu sehen ist.
    if (methode !== 'GET') await new Promise((r) => setTimeout(r, 40));
    const a = antwort(fall, speicher, methode, url.pathname, rumpf);
    if (!a) return new Response('{"message":"Nicht im Demo"}', { status: 404 });
    // `/info` kommt von ChurchTools ohne die Hülle `{ data: … }` (gemessen, `shared/ct/info.ts`).
    const daten = url.pathname === '/api/info' ? a.data : { data: a.data ?? null };
    return new Response(a.status === 204 ? null : JSON.stringify(daten), {
      status: a.status,
      headers: { 'Content-Type': 'application/json' },
    });
  };
}
