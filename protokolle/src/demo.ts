/**
 * **Nur zum Entwickeln** (`npm run dev -w protokolle`, dann `…/ccm/protokolle/?demo`): spielt die
 * ChurchTools-Antworten nach, in der Form, die an der Test-Instanz gemessen wurde (16.10. und 22.10.2026),
 * damit die Seite ohne Instanz zu sehen ist. Fälle: `?demo` (versteckte, eingerichtete Gruppe + nicht
 * eingerichtete), `?demo=leer` (in keiner Gruppe), `?demo=ohne-modul` (Erweiterung nicht installiert),
 * `?demo=fehler` (ChurchTools antwortet nicht). Wird nie mitgebaut (siehe `main.tsx`).
 */
import { kategorieName } from '@shared/protokolle/gruppen';
import { kuerzelMitarbeit, kuerzelProtokolle, KUERZEL_VORLAGEN } from '@shared/protokolle/speicher';

const MODUL = 20;

const mitglied = (id: number, title: string, rolle = 8) => ({
  group: { domainIdentifier: String(id), title, domainAttributes: { note: null } },
  groupTypeRoleId: rolle,
  groupMemberStatus: 'active',
  memberEndDate: null,
});

function antwort(fall: string, pfad: string): { status: number; data?: unknown } | null {
  if (fall === 'fehler' && pfad.endsWith('/customdatacategories')) return { status: 502 };
  if (pfad === '/api/whoami') return { status: 200, data: { id: 1, firstName: 'Alwin' } };
  if (pfad === '/api/info')
    return { status: 200, data: { siteName: 'Evangeliumschristen-Gemeinde e.V.' } };
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
  if (pfad === `/api/custommodules/${MODUL}/customdatacategories`)
    return {
      status: 200,
      data:
        fall === 'leer'
          ? []
          : [
              {
                id: 60,
                shorty: kuerzelProtokolle(11),
                name: kategorieName('Protokolle', 'Leitungsteam'),
                customModuleId: MODUL,
              },
              {
                id: 61,
                shorty: kuerzelMitarbeit(11),
                name: kategorieName('Mitarbeit', 'Leitungsteam'),
                customModuleId: MODUL,
              },
              {
                id: 70,
                shorty: kuerzelProtokolle(7),
                name: kategorieName('Protokolle', 'Jugendleitung'),
                customModuleId: MODUL,
              },
              { id: 5, shorty: KUERZEL_VORLAGEN, name: 'Vorlagen', customModuleId: MODUL },
            ],
    };
  if (pfad === '/api/csrftoken') return { status: 200, data: 'demo' };
  return null;
}

export function demoStarten(fall: string): void {
  // ChurchTools gibt der Erweiterung einen Behälter mit fester Höhe; auf der nackten Entwicklerseite übernimmt
  // das `body`, sonst hätte die App die Höhe 0.
  document.body.style.cssText = 'margin: 0; height: 100vh;';
  window.fetch = (input) => {
    const url = new URL(
      typeof input === 'string' ? input : input instanceof URL ? input.href : input.url,
    );
    const a = antwort(fall, url.pathname);
    if (!a) return Promise.resolve(new Response('{"message":"Nicht im Demo"}', { status: 404 }));
    // `/info` kommt von ChurchTools ohne die Hülle `{ data: … }` (gemessen, `shared/ct/info.ts`).
    const rumpf = url.pathname === '/api/info' ? a.data : { data: a.data ?? null };
    return Promise.resolve(
      new Response(a.status === 204 ? null : JSON.stringify(rumpf), {
        status: a.status,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
  };
}
