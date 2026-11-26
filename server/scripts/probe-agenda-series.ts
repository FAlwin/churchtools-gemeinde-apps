/**
 * Erkundungs-Skript: **Löscht der Dienstplaner beim Speichern die Predigtserie?**
 *
 * Seit dem App-Update vom 26.11.2026 kann man in der ChurchTools-App am Ablauf eine „Predigtserie“
 * setzen (Feld `series` am Ablauf). Der Dienstplaner und die Musik-App schreiben den GANZEN Ablauf an
 * zwei Stellen per `PUT /events/{id}/agenda` neu – ohne `series`:
 *   - Umsortieren (`ablaufUmsortieren`): Rumpf `{ items }`,
 *   - Grenze „Eventstart“ verschieben: Rumpf `{ calendarId, eventStartPosition }`.
 * Ob ChurchTools ein fehlendes `series` als „leeren“ liest, ist nicht dokumentiert – das misst dieses Skript.
 *
 * Ablauf (nur mit `--ja-ich-will`, sonst nur lesend):
 *   1. Ablauf lesen, alte Serie merken.
 *   2. Serie setzen (`PUT` mit `series` + unveränderten Punkten) – nachlesen.
 *   3. Umsortieren-Rumpf wie der Dienstplaner (gleiche Reihenfolge, also keine echte Änderung) – nachlesen.
 *   4. Grenze-Rumpf wie der Dienstplaner (gleiche Grenze) – nachlesen.
 *   5. Alte Serie wiederherstellen – nachlesen.
 * Reihenfolge und Grenze bleiben die ganze Zeit gleich; nur `series` wird angefasst und zurückgesetzt.
 *
 * NUR gegen die Test-Instanz (`.env.churchtools-test`), zwei Sperren wie in `probe-songwrite.ts`.
 *
 * Aufruf:
 *   npx tsx server/scripts/probe-agenda-series.ts                      # Termine mit Ablauf auflisten
 *   TEST_EVENT_ID=123 npx tsx server/scripts/probe-agenda-series.ts    # Ablauf lesend zeigen
 *   TEST_EVENT_ID=123 npx tsx server/scripts/probe-agenda-series.ts --ja-ich-will
 *   TEST_VORLAGE_ID=28 npx tsx server/scripts/probe-agenda-series.ts --ja-ich-will   # dasselbe für eine Vorlage
 *
 * Bei einer **Vorlage** sind es die Rümpfe von `ablaufUmsortieren`/Grenze (mit `ablaufKopf` = Name + Kalender),
 * `vorlageUmbenennen` (`{ name, calendarId }`) und `vorlageErsetzen` (`{ name, calendarId, eventStartPosition, items }`).
 */
import { config } from 'dotenv';
import { agendaItemWritePayload } from '../../shared/ct/agendaPayload';
import type { CtAgendaItem } from '../../shared/ct/typen';

config();
config({ path: '.env.churchtools-test' });

const LIVE = (process.env.CHURCHTOOLS_BASE_URL ?? '').replace(/\/$/, '');
const BASE = (process.env.CHURCHTOOLS_TEST_BASE_URL ?? '').replace(/\/$/, '');
const TOKEN = process.env.CHURCHTOOLS_TEST_LOGIN_TOKEN ?? '';
const EVENT_ID = Number(process.env.TEST_EVENT_ID ?? '');
const VORLAGE_ID = Number(process.env.TEST_VORLAGE_ID ?? '');
const SCHREIBEN = process.argv.includes('--ja-ich-will');

if (!BASE || !TOKEN) {
  console.error('✗ Kein Test-Zugang (.env.churchtools-test) – Abbruch.');
  process.exit(1);
}
if (LIVE && BASE.toLowerCase() === LIVE.toLowerCase()) {
  console.error('⛔ Test-Adresse = Live-Adresse – Abbruch.');
  process.exit(1);
}

interface Ablauf {
  series?: string | null;
  calendarId?: number;
  eventStartPosition?: number;
  items: CtAgendaItem[];
  [k: string]: unknown;
}

async function ruf(
  method: string,
  pfad: string,
  csrf = '',
  body?: unknown,
): Promise<{ status: number; json: unknown }> {
  await new Promise((r) => setTimeout(r, 400));
  const res = await fetch(`${BASE}/api${pfad}`, {
    method,
    headers: {
      Authorization: `Login ${TOKEN}`,
      Accept: 'application/json',
      'Content-Type': 'application/json',
      ...(csrf ? { 'CSRF-Token': csrf } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (res.status === 429) {
    console.error('⛔ 429 – Abbruch.');
    process.exit(1);
  }
  const text = await res.text();
  let json: unknown = text.slice(0, 300);
  try {
    json = JSON.parse(text) as unknown;
  } catch {
    /* Text bleibt */
  }
  return { status: res.status, json };
}

async function ablaufLesen(id: number): Promise<Ablauf> {
  const r = await ruf('GET', `/events/${id}/agenda`);
  if (r.status !== 200) throw new Error(`Ablauf lesen: ${r.status} ${JSON.stringify(r.json)}`);
  return (r.json as { data: Ablauf }).data;
}

function stand(a: Ablauf): string {
  return `series=${JSON.stringify(a.series ?? null)} · grenze=${a.eventStartPosition} · punkte=${a.items
    .map((i) => i.id)
    .join(',')}`;
}

async function auflisten(): Promise<void> {
  // Auch vergangene Termine: In der Test-Instanz haben oft nur die einen Ablauf – und sie stören niemanden.
  const von = new Date(Date.now() - 120 * 864e5);
  const bis = new Date(von.getTime() + 240 * 864e5);
  const tag = (d: Date) => d.toISOString().slice(0, 10);
  const r = await ruf('GET', `/events?from=${tag(von)}&to=${tag(bis)}`);
  const termine =
    (r.json as { data?: { id: number; name: string; startDate: string }[] }).data ?? [];
  console.log(`${termine.length} Termine (120 Tage zurück, 120 voraus). Mit Ablauf:`);
  for (const t of termine) {
    const a = await ruf('GET', `/events/${t.id}/agenda`);
    if (a.status === 200) console.log(`  ${t.id}  ${t.startDate.slice(0, 16)}  ${t.name}`);
  }
}

async function vorlageLesen(id: number): Promise<Ablauf> {
  const r = await ruf('GET', `/agendatemplates/${id}`);
  if (r.status !== 200) throw new Error(`Vorlage lesen: ${r.status} ${JSON.stringify(r.json)}`);
  return (r.json as { data: Ablauf }).data;
}

async function vorlageMessen(id: number): Promise<void> {
  const v0 = await vorlageLesen(id);
  const name = typeof v0.name === 'string' ? v0.name : '';
  console.log('0 vorher:        ', stand(v0), `· name=${JSON.stringify(name)}`);
  if (!SCHREIBEN) return;
  const csrf = ((await ruf('GET', '/csrftoken')).json as { data?: string }).data ?? '';
  const punkte = () =>
    v0.items.map((it, i) => ({ id: it.id, ...agendaItemWritePayload(it, { position: i }) }));
  const kopf = { name, calendarId: v0.calendarId };
  const pfad = `/agendatemplates/${id}`;
  const schritte: [string, Record<string, unknown>][] = [
    [
      '1 Serie setzen: ',
      { ...kopf, series: `Probe-Serie ${new Date().toISOString().slice(11, 19)}`, items: punkte() },
    ],
    ['2 Umsortieren:  ', { ...kopf, items: punkte() }],
    ['3 Grenze:       ', { ...kopf, eventStartPosition: v0.eventStartPosition ?? 0 }],
    ['4 Umbenennen:   ', { ...kopf }],
    [
      '5 Ersetzen:     ',
      { ...kopf, eventStartPosition: v0.eventStartPosition ?? 0, items: punkte() },
    ],
    ['6 Zurücksetzen: ', { ...kopf, series: v0.series ?? null, items: punkte() }],
  ];
  for (const [text, rumpf] of schritte) {
    const r = await ruf('PUT', pfad, csrf, rumpf);
    const nach = await vorlageLesen(id);
    console.log(`${text} PUT ${r.status}`, stand(nach), `· name=${JSON.stringify(nach.name)}`);
  }
}

async function main(): Promise<void> {
  if (VORLAGE_ID) return vorlageMessen(VORLAGE_ID);
  if (!EVENT_ID) return auflisten();

  const a0 = await ablaufLesen(EVENT_ID);
  console.log('Felder am Ablauf:', Object.keys(a0).join(', '));
  console.log('0 vorher:        ', stand(a0));
  if (!SCHREIBEN) return;

  const csrf = ((await ruf('GET', '/csrftoken')).json as { data?: string }).data ?? '';
  const punkte = () =>
    a0.items.map((it, i) => ({ id: it.id, ...agendaItemWritePayload(it, { position: i }) }));
  const probe = `Probe-Serie ${new Date().toISOString().slice(11, 19)}`;

  let r = await ruf('PUT', `/events/${EVENT_ID}/agenda`, csrf, {
    calendarId: a0.calendarId,
    series: probe,
    items: punkte(),
  });
  console.log(`1 Serie setzen:   PUT ${r.status}`);
  console.log('                 ', stand(await ablaufLesen(EVENT_ID)));

  // Genau der Rumpf von `ablaufUmsortieren` für einen Termin (kein Kopf, nur die Liste).
  r = await ruf('PUT', `/events/${EVENT_ID}/agenda`, csrf, { items: punkte() });
  console.log(`2 Umsortieren:    PUT ${r.status}`);
  console.log('                 ', stand(await ablaufLesen(EVENT_ID)));

  // Genau der Rumpf beim Verschieben der Grenze (`ablaufKopf` + `eventStartPosition`), Grenze unverändert.
  r = await ruf('PUT', `/events/${EVENT_ID}/agenda`, csrf, {
    calendarId: a0.calendarId,
    eventStartPosition: a0.eventStartPosition ?? 0,
  });
  console.log(`3 Grenze:         PUT ${r.status}`);
  console.log('                 ', stand(await ablaufLesen(EVENT_ID)));

  r = await ruf('PUT', `/events/${EVENT_ID}/agenda`, csrf, {
    calendarId: a0.calendarId,
    series: a0.series ?? null,
    items: punkte(),
  });
  console.log(`4 Zurücksetzen:   PUT ${r.status}`);
  console.log('                 ', stand(await ablaufLesen(EVENT_ID)));
}

main().catch((e: unknown) => {
  console.error('✗', e instanceof Error ? e.message : e);
  process.exit(1);
});
