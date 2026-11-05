/**
 * **Nur zum Entwickeln** (`npm run dev -w gebetsabend`, dann `…/ccm/gebetsabend/?demo`): spielt die
 * ChurchTools-Antworten nach, in der Form, die an der Test-Instanz gemessen wurde (Messung S0/G0, 05.11.2026), damit
 * die Seite ohne Instanz zu sehen ist. Fälle: `?demo` (Admin, noch nicht eingerichtet – „Einrichten“ legt die
 * Kategorien im Browser-Speicher an), `?demo=technik` (eingerichtet, gehört zur Technik), `?demo=mitglied`
 * (Mitglied, sieht keine Kategorie), `?demo=fehler` (ChurchTools antwortet nicht). Wird nie mitgebaut (`main.tsx`).
 */
import { KATEGORIE_EINSTELLUNGEN, KATEGORIE_ZUGANG } from '@shared/gebetsabend/einrichten';

const MODUL = 30;

export function demoStarten(fall: string): void {
  // ChurchTools gibt der Erweiterung einen Behälter mit fester Höhe (gemessen 07.10.2026); auf der nackten
  // Entwicklerseite übernimmt das `body`, sonst hätte die App die Höhe 0.
  document.body.style.cssText = 'margin: 0; height: 100vh;';
  const kategorien: { id: number; shorty: string; name: string }[] =
    fall === 'technik'
      ? [
          { id: 74, shorty: KATEGORIE_ZUGANG.kuerzel, name: KATEGORIE_ZUGANG.name },
          { id: 75, shorty: KATEGORIE_EINSTELLUNGEN.kuerzel, name: KATEGORIE_EINSTELLUNGEN.name },
        ]
      : [];
  const admin = fall === '' || fall === 'technik';
  const rechte = () => ({
    churchcore: {},
    gebetsabend: {
      view: true,
      'create custom category': admin,
      'view custom data': kategorien.map((k) => k.id),
      ...(fall === 'technik' && {
        'create custom data': [74, 75],
        'edit custom data': [74, 75],
        'delete custom data': [74, 75],
      }),
    },
  });

  const antwort = (daten: unknown, status = 200) =>
    Promise.resolve(
      new Response(JSON.stringify({ data: daten }), {
        status,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

  window.fetch = (input, init) => {
    const url = new URL(
      typeof input === 'string' ? input : input instanceof URL ? input.href : input.url,
    );
    const pfad = url.pathname.replace(/^.*\/api/, '');
    const method = init?.method ?? 'GET';
    if (fall === 'fehler' && pfad === '/custommodules') return antwort(null, 502);
    if (pfad === '/csrftoken') return antwort('demo-csrf');
    if (pfad === '/whoami') return antwort({ id: 1, firstName: 'Helene', lastName: 'Wiebe' });
    if (pfad === '/persons/1/groups' || pfad === '/group/roles') return antwort([]);
    if (pfad === '/info') return antwort({ shortName: 'Demo-Gemeinde' });
    if (pfad === '/config') return antwort({});
    if (pfad === '/permissions/global') return antwort(rechte());
    if (pfad === '/custommodules') return antwort([{ id: MODUL, shorty: 'gebetsabend' }]);
    if (pfad === `/custommodules/${MODUL}/customdatacategories`) {
      if (method === 'POST' && typeof init?.body === 'string') {
        const k = JSON.parse(init.body) as { shorty: string; name: string };
        kategorien.push({ id: 74 + kategorien.length, shorty: k.shorty, name: k.name });
        return antwort(kategorien.at(-1), 201);
      }
      return antwort(kategorien);
    }
    return antwort(null, 404);
  };
}
