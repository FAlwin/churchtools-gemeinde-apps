/**
 * **Nur zum Entwickeln** (`npm run dev -w gebetsabend`, dann `…/ccm/gebetsabend/?demo`): spielt die
 * ChurchTools-Antworten nach, in der Form, die an der Test-Instanz gemessen wurde (Messung S0/G0, 05.11.2026), damit
 * die Seite ohne Instanz zu sehen ist. Wird nie mitgebaut (`main.tsx`). Fälle:
 *  - `?demo` – Admin, noch nicht eingerichtet; „Einrichten“ legt die Kategorien im Browser-Speicher an.
 *  - `?demo=zuhoerer` – Mitglied, eingerichtet, die Übertragung **läuft**, nächster Termin aus dem Kalender. Der
 *    Player lädt die echte VDO.Ninja-Seite mit einer erfundenen StreamID – er wartet also („beginnt gleich“).
 *  - `?demo=aus` – wie `zuhoerer`, aber noch keine Übertragung.
 *  - `?demo=technik` – wie `aus`, gehört zur Technik: „Übertragung starten“ schreibt in den Browser-Speicher, der
 *    Sender öffnet die echte VDO.Ninja-Seite (Kamera-Abfrage). Zahnrad → Einstellungen mit erfundenen Kalendern.
 *  - `?demo=mitglied` – Mitglied, sieht keine Kategorie (Rechte fehlen).
 *  - `?demo=fehler` – ChurchTools antwortet nicht.
 */
import { KATEGORIE_EINSTELLUNGEN, KATEGORIE_ZUGANG } from '@shared/gebetsabend/einrichten';
import { neuerZugang, ZUGANG_DOKUMENT } from '@shared/gebetsabend/zugang';
import { EINSTELLUNGEN_DOKUMENT } from '@shared/gebetsabend/einstellungen';
import type { Dokumentart } from '@shared/ct/versionierterWert';

/** Ein gespeichertes Dokument, wie `dokumentSpeichern` es schreibt (`@shared/ct/versionierterWert`). */
const dokument = (art: Dokumentart, inhalt: unknown) =>
  JSON.stringify({
    ...art,
    version: 1,
    zeit: new Date().toISOString(),
    von: { personId: 1, name: 'Demo' },
    inhalt,
  });

const MODUL = 30;
const ZUGANG = 74;
const EINSTELLUNGEN = 75;
const KALENDER = 1;

/** Der nächste Donnerstag, 19:30 Uhr deutscher Winterzeit (18:30 UTC). */
function naechsterDonnerstag(): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + ((4 - d.getUTCDay() + 7) % 7 || 7));
  return `${d.toISOString().slice(0, 10)}T18:30:00Z`;
}

export function demoStarten(fall: string): void {
  // ChurchTools gibt der Erweiterung einen Behälter mit fester Höhe (gemessen 07.10.2026); auf der nackten
  // Entwicklerseite übernimmt das `body`, sonst hätte die App die Höhe 0.
  document.body.style.cssText = 'margin: 0; height: 100vh;';
  const eingerichtet = ['zuhoerer', 'aus', 'technik'].includes(fall);
  const kategorien: { id: number; shorty: string; name: string }[] = eingerichtet
    ? [
        { id: ZUGANG, shorty: KATEGORIE_ZUGANG.kuerzel, name: KATEGORIE_ZUGANG.name },
        {
          id: EINSTELLUNGEN,
          shorty: KATEGORIE_EINSTELLUNGEN.kuerzel,
          name: KATEGORIE_EINSTELLUNGEN.name,
        },
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
        'create custom data': [ZUGANG, EINSTELLUNGEN],
        'edit custom data': [ZUGANG, EINSTELLUNGEN],
        'delete custom data': [ZUGANG, EINSTELLUNGEN],
      }),
    },
  });
  const zugang = neuerZugang(true, new Date(Date.now() - 12 * 60_000).toISOString());
  // Die Werte der Kategorien – im Speicher, damit Starten, Beenden und Einstellungen in der Demo wirken.
  const werte = new Map<number, { id: number; dataCategoryId: number; value: string }[]>([
    [
      ZUGANG,
      eingerichtet
        ? [
            {
              id: 1,
              dataCategoryId: ZUGANG,
              value: dokument(
                ZUGANG_DOKUMENT,
                fall === 'zuhoerer' ? zugang : { ...zugang, laeuftSeit: null },
              ),
            },
          ]
        : [],
    ],
    [
      EINSTELLUNGEN,
      [
        {
          id: 2,
          dataCategoryId: EINSTELLUNGEN,
          value: dokument(EINSTELLUNGEN_DOKUMENT, { kalender: KALENDER, suchwort: 'Gebet' }),
        },
      ],
    ],
  ]);
  let naechsteId = 10;
  const beginn = naechsterDonnerstag();

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
        kategorien.push({ id: ZUGANG + kategorien.length, shorty: k.shorty, name: k.name });
        return antwort(kategorien.at(-1), 201);
      }
      return antwort(kategorien);
    }
    const wertePfad =
      /^\/custommodules\/\d+\/customdatacategories\/(\d+)\/customdatavalues(?:\/(\d+))?$/.exec(
        pfad,
      );
    if (wertePfad) {
      const liste = werte.get(Number(wertePfad[1])) ?? [];
      const rumpf =
        typeof init?.body === 'string' ? (JSON.parse(init.body) as { value: string }) : null;
      if (method === 'POST' && rumpf) {
        liste.push({ id: naechsteId++, dataCategoryId: Number(wertePfad[1]), value: rumpf.value });
        werte.set(Number(wertePfad[1]), liste);
        return antwort(liste.at(-1), 201);
      }
      if (method === 'PUT' && rumpf) {
        const w = liste.find((x) => x.id === Number(wertePfad[2]));
        if (!w) return antwort(null, 404);
        w.value = rumpf.value;
        return antwort(w);
      }
      return antwort(liste);
    }
    if (pfad === '/calendars')
      return antwort([
        { id: KALENDER, name: 'Sonstige Veranstaltung' },
        { id: 2, name: 'Gottesdienst' },
      ]);
    if (pfad === '/calendars/appointments')
      return antwort([
        { base: { id: 501, title: 'Gemeindeversammlung' }, calculated: { startDate: beginn } },
        {
          base: { id: 502, title: 'Gebetsabend' },
          calculated: { startDate: beginn, endDate: beginn.replace('18:30', '20:00') },
        },
      ]);
    return antwort(null, 404);
  };
}
