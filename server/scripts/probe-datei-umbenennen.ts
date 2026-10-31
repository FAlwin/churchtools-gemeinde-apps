/**
 * Erkundung: Kann ChurchTools eine **Datei am Arrangement umbenennen**? (Entwurf „Auswahl, Anzeige & Dateien“, Alwin
 * 30.10.2026: „wäre gut, wenn man die hochgeladenen Dateien irgendwo direkt umbenennen könnte“.)
 *
 * Lesend lässt sich das nicht klären. Dieser Durchgang lädt eine kleine Textdatei an ein Testlied, versucht mehrere
 * naheliegende Wege zum Umbenennen und **liest nach jedem Versuch die Liste neu** – ein 2xx allein beweist nichts
 * (`PATCH /files/<id> {securityLevelId}` antwortete schon einmal 204 und änderte nichts, `plan-extension.md`). Danach
 * wird geprüft, ob der Inhalt noch stimmt, und die Testdatei wieder gelöscht – auch das wird nachgelesen.
 *
 * Aufruf (im Repo-Ordner mit `.env.churchtools-test`):
 *   npx tsx server/scripts/probe-datei-umbenennen.ts --lied 27 --ja-ich-will
 *
 * Zwei Sperren wie in `probe-songwrite.ts`: nur mit der eigenen Test-Datei, nie gegen dieselbe Adresse wie Live.
 * Bricht beim ersten 429 ab (#300). Tokens werden nie ausgegeben.
 */
import { config } from 'dotenv';

config();
config({ path: '.env.churchtools-test' });

const LIVE = (process.env.CHURCHTOOLS_BASE_URL ?? '').replace(/\/$/, '');
const BASE = (process.env.CHURCHTOOLS_TEST_BASE_URL ?? '').replace(/\/$/, '');
const TOKEN = process.env.CHURCHTOOLS_TEST_LOGIN_TOKEN ?? '';

if (!BASE || !TOKEN) {
  console.error('✗ Kein Test-Zugang (.env.churchtools-test) – Abbruch.');
  process.exit(1);
}
if (LIVE && BASE.toLowerCase() === LIVE.toLowerCase()) {
  console.error('⛔ Die Test-Adresse ist die Live-Instanz – Abbruch.');
  process.exit(1);
}
if (!process.argv.includes('--ja-ich-will')) {
  console.error('Schreibt in der Test-Instanz. Aufruf mit --lied <id> --ja-ich-will');
  process.exit(1);
}
const liedArg = process.argv[process.argv.indexOf('--lied') + 1];
const LIED = Number(liedArg);
if (!Number.isInteger(LIED) || LIED <= 0) {
  console.error('✗ --lied <id> fehlt.');
  process.exit(1);
}

const PAUSE_MS = 500;
let csrf = '';

interface Antwort {
  status: number;
  json: unknown;
  text: string;
}

async function anfrage(
  method: string,
  pfad: string,
  body?: BodyInit,
  typ?: string,
): Promise<Antwort> {
  await new Promise((r) => setTimeout(r, PAUSE_MS));
  const headers: Record<string, string> = {
    Authorization: `Login ${TOKEN}`,
    Accept: 'application/json',
  };
  // Mit dem Login-Token im Kopf liefert `/api/csrftoken` `null` (gemessen 31.10.2026) – dann ohne.
  if (csrf) headers['CSRF-Token'] = csrf;
  if (typ) headers['Content-Type'] = typ;
  const res = await fetch(`${BASE}${pfad}`, { method, headers, body });
  if (res.status === 429) {
    console.error('\n⛔ ChurchTools drosselt (429) – Abbruch.');
    process.exit(1);
  }
  const text = await res.text();
  let json: unknown = null;
  try {
    json = JSON.parse(text) as unknown;
  } catch {
    /* kein JSON */
  }
  return { status: res.status, json, text: text.slice(0, 300).replace(/\s+/g, ' ') };
}

interface Datei {
  id?: number;
  name: string;
  fileUrl: string;
  [k: string]: unknown;
}

async function dateien(arrId: number): Promise<Datei[]> {
  const a = await anfrage('GET', `/api/files/song_arrangement/${arrId}`);
  return ((a.json as { data?: Datei[] } | null)?.data ?? []) as Datei[];
}

const idAus = (d: Datei): number | null =>
  typeof d.id === 'number' ? d.id : Number(/[?&]id=(\d+)/.exec(d.fileUrl)?.[1] ?? NaN) || null;

async function main(): Promise<void> {
  const c = await fetch(`${BASE}/api/csrftoken`, {
    headers: { Authorization: `Login ${TOKEN}`, Accept: 'application/json' },
  });
  csrf = ((await c.json()) as { data?: string | null }).data ?? '';

  const lied = await anfrage('GET', `/api/songs/${LIED}`);
  const arr = (
    lied.json as { data?: { name?: string; arrangements?: { id: number; name: string }[] } }
  )?.data;
  const arrId = arr?.arrangements?.[0]?.id;
  if (!arrId) throw new Error(`Lied ${LIED} hat kein Arrangement (HTTP ${lied.status})`);
  console.log(
    `Lied ${LIED} „${arr?.name}“ · Arrangement #${arrId} „${arr?.arrangements?.[0]?.name}“`,
  );

  // 1) Hochladen
  const stempel = new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-');
  const altName = `ZZZ-Messung-${stempel}.txt`;
  const INHALT = `Messung Umbenennen ${stempel}`;
  const form = new FormData();
  form.append('files[]', new Blob([INHALT], { type: 'text/plain' }), altName);
  const hoch = await anfrage('POST', `/api/files/song_arrangement/${arrId}`, form);
  console.log(`\n1) Hochladen: HTTP ${hoch.status}`);
  const nachHoch = (await dateien(arrId)).find((d) => d.name === altName);
  if (!nachHoch)
    throw new Error('Testdatei nach dem Hochladen NICHT in der Liste – Abbruch, nichts gelöscht.');
  const id = idAus(nachHoch);
  console.log(
    `   in der Liste: ja · id=${id} · Felder: ${Object.keys(nachHoch).sort().join(', ')}`,
  );
  if (!id) throw new Error('keine ID ermittelbar – Abbruch.');

  /**
   * Ab hier liegt eine Testdatei in der Instanz – **das Aufräumen läuft deshalb in `finally`**. Beim ersten Lauf
   * (31.10.2026) brach Schritt 3 ab und die Datei blieb liegen; sie wurde von Hand gelöscht und nachgelesen.
   */
  let neuerName: string | null = null;
  try {
    neuerName = await umbenennenUndPruefen(arrId, id, nachHoch, INHALT);
  } finally {
    // 4) Aufräumen – und nachlesen
    const weg = await anfrage('DELETE', `/api/files/${id}`);
    const rest = (await dateien(arrId)).filter(
      (d) => idAus(d) === id || d.name === altName || (neuerName !== null && d.name === neuerName),
    );
    console.log(
      `\n4) Löschen: HTTP ${weg.status} · danach noch da: ${rest.length ? '⚠️ JA – bitte von Hand löschen: ' + rest.map((d) => d.name).join(', ') : 'nein ✅'}`,
    );
  }
  console.log(
    `\nErgebnis: ${neuerName ? `Umbenennen geht direkt (${neuerName}).` : 'Kein direkter Weg gefunden – Umbenennen = neu hochladen, nachlesen, alte löschen.'}`,
  );
}

async function umbenennenUndPruefen(
  arrId: number,
  id: number,
  nachHoch: Datei,
  INHALT: string,
): Promise<string | null> {
  // 2) Umbenennen – mehrere Wege, nach jedem nachlesen
  const versuche: [string, string, () => BodyInit, string?][] = [
    [
      'PATCH',
      `/api/files/${id}`,
      () => JSON.stringify({ name: 'ZZZ-umbenannt-patch-name.txt' }),
      'application/json',
    ],
    [
      'PUT',
      `/api/files/${id}`,
      () => JSON.stringify({ name: 'ZZZ-umbenannt-put-name.txt' }),
      'application/json',
    ],
    [
      'PATCH',
      `/api/files/${id}`,
      () => JSON.stringify({ filename: 'ZZZ-umbenannt-patch-filename.txt' }),
      'application/json',
    ],
  ];
  let neuerName: string | null = null;
  for (const [method, pfad, body, typ] of versuche) {
    const ziel = JSON.parse(String(body())) as { name?: string; filename?: string };
    const soll = ziel.name ?? ziel.filename ?? '';
    const a = await anfrage(method, pfad, body(), typ);
    const liste = await dateien(arrId);
    const jetzt = liste.find((d) => idAus(d) === id);
    const geklappt = jetzt?.name === soll;
    console.log(
      `\n2) ${method} ${pfad} ${JSON.stringify(ziel)} → HTTP ${a.status} · Name danach: ${jetzt?.name ?? '(Datei weg!)'} · ${geklappt ? '✅ UMBENANNT' : '✗ nicht umbenannt'}`,
    );
    if (!geklappt) console.log(`   Antwort: ${a.text}`);
    if (geklappt) {
      neuerName = soll;
      break;
    }
  }

  // 3) Inhalt nach dem Umbenennen – über eine SITZUNG wie die App im Browser. Mit dem Token im Kopf leitet der
  // Download endlos auf sich selbst weiter (gemessen 31.10.2026, auch bei nicht umbenannten Dateien).
  const vorLoeschen = (await dateien(arrId)).find((d) => idAus(d) === id);
  if (vorLoeschen) {
    const w = await fetch(`${BASE}/api/whoami?login_token=${encodeURIComponent(TOKEN)}`, {
      redirect: 'manual',
    });
    const cookie = w.headers
      .getSetCookie()
      .map((c) => c.split(';')[0])
      .join('; ');
    const r = await fetch(vorLoeschen.fileUrl, { headers: { Cookie: cookie } });
    const inhalt = await r.text();
    console.log(
      `\n3) Inhalt nach dem Versuch: HTTP ${r.status} · ${inhalt === INHALT ? 'unverändert ✅' : `ANDERS: ${inhalt.slice(0, 80)}`} · fileUrl gleich: ${vorLoeschen.fileUrl === nachHoch.fileUrl}`,
    );
  }
  return neuerName;
}

main().catch((e) => {
  console.error(`\n✗ ${(e as Error).message}`);
  process.exit(1);
});
