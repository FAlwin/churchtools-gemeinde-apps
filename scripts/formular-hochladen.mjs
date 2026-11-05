#!/usr/bin/env node
/**
 * **Das Formular-Paket auf den Webspace der Gemeinde laden** (Alwin, 15.10.2026: Zugangsdaten im
 * „Mac-Schlüsselbund“). Verschlüsselt per FTPS mit `curl` (auf jedem Mac vorhanden).
 *
 * Die Zugangsdaten stehen **nur im macOS-Schlüsselbund** – nie im Repo, nie auf der Kommandozeile, nie in einer
 * Ausgabe. Einmal anlegen (fragt nach dem Passwort):
 *
 *   security add-internet-password -s <FTP-Server> -a <FTP-Benutzer> -r "ftp " -w
 *
 * Aufruf (nichts davon ist geheim; ECG: siehe docs/betrieb/ANMELDUNGEN.md):
 *
 *   ANMELDUNG_FTP_SERVER=<FTP-Server> ANMELDUNG_FORMULAR_ADRESSE=https://anmeldung.… \
 *   ANMELDUNG_CT_INSTANZEN=<instanz>.church.tools,test-<instanz>.church.tools npm run formular:hochladen
 *
 * `ANMELDUNG_CT_INSTANZEN` (#843): die ChurchTools-Instanzen, die das Formular ansprechen darf – kommagetrennt. Das
 * Skript schreibt daraus `instanzen.json` neben `index.html` (vor ihr hochgeladen) und liest sie im Netz nach. Aus
 * derselben Liste entsteht die `.htaccess` mit den Sicherheits-Headern (#849, `htaccessAus`); ob der Webspace sie
 * anwendet, prüft das Skript am Antwort-Header der Seite.
 *
 * Optional `ANMELDUNG_EINBETTEN` (#849): wo das Formular eingebettet werden darf, z. B.
 * `https://gemeinde.de,https://*.gemeinde.de` – leer = nur auf der eigenen Seite.
 *
 * Optional `ANMELDUNG_FTP_ORDNER` (Ordner im FTP-Zugang, Standard: dessen Wurzel) und `ANMELDUNG_FTP_BENUTZER` –
 * Pflicht, sobald es für denselben Server mehrere Einträge im Schlüsselbund gibt (z. B. Website und Formular), sonst
 * nähme `security` irgendeinen davon.
 *
 * **Reihenfolge, damit nie eine halbe Seite online ist:** erst die neuen Dateien unter `assets/`, dann
 * `index.html` – sie verweist auf die neuen Dateien –, dann wird die Seite **im Netz nachgeprüft** (lädt sie genau
 * die eben hochgeladenen Dateien, antworten alle?), und erst danach werden alte Dateien gelöscht. Scheitert ein
 * Schritt vorher, bleibt die bisherige Seite, wie sie war.
 */
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

/** Die Dateien unter `assets/`, auf die eine `index.html` verweist. */
export function assetsAus(html) {
  return [...html.matchAll(/(?:src|href)="\.?\/?assets\/([^"?#]+)[^"]*"/g)].map((m) => m[1]);
}

/** Was unter `assets/` liegt, aber nicht mehr gebraucht wird. */
export function alteAssets(vorhanden, neu) {
  const behalten = new Set(neu);
  return vorhanden.filter((n) => n && n !== '.' && n !== '..' && !behalten.has(n));
}

/**
 * **Fremde Dateien im Zielordner** – alles außer unserem Paket (`index.html`, `assets`). Ist die Liste nicht leer,
 * wird NICHTS hochgeladen: Gemessen 15.10.2026 landet der Haupt-FTP-Zugang einer Website direkt im WordPress-Ordner –
 * eine `index.html` dort hätte Vorrang vor `index.php` und legte die ganze Website lahm.
 */
export function fremdeDateien(liste, o = {}) {
  // `instanzen.json` gehört dazu (#843) – sonst bräche jedes Hochladen nach dem ersten an der eigenen Liste ab.
  const unsere = new Set([
    'index.html',
    'assets',
    'instanzen.json',
    'instanzen.beispiel.json',
    // Die Vorlage der Sicherheits-Header für andere Gemeinden (#849).
    'htaccess.beispiel',
    '.',
    '..',
    '',
  ]);
  // Eine `.htaccess` ist nur unsere, wenn sie mit unserem Kopf beginnt (`htaccessUnsere`, gelesen in `main`) – sonst
  // ist es z. B. die der Website (WordPress), und hier wird nichts hochgeladen (#849).
  return liste
    .map((n) => n.trim())
    .filter((n) => (n === '.htaccess' ? !o.htaccessUnsere : !unsere.has(n)));
}

/**
 * **Der Inhalt von `instanzen.json`** aus `ANMELDUNG_CT_INSTANZEN` (#843): kommagetrennt, klein geschrieben, ohne
 * Doppelte. Ob ein Eintrag ein gültiger Rechnername ist, entscheidet das Formular selbst (`erlaubteInstanzenAus`) –
 * hier wird nur abgewiesen, was sicher keiner ist (Schema, Pfad), damit ein Tippfehler nicht erst im Netz auffällt.
 */
export function instanzenListe(wert) {
  const liste = [
    ...new Set(
      String(wert ?? '')
        .split(',')
        .map((x) => x.trim().toLowerCase())
        .filter(Boolean),
    ),
  ];
  const kaputt = liste.filter((x) => /[/:\s]/.test(x));
  if (liste.length === 0 || kaputt.length)
    throw new Error(
      `ANMELDUNG_CT_INSTANZEN braucht Rechnernamen wie „gemeinde.church.tools“, kommagetrennt${kaputt.length ? ` – nicht „${kaputt.join('“, „')}“` : ''}.`,
    );
  return liste;
}

/**
 * **Wo das Formular eingebettet werden darf** (`ANMELDUNG_EINBETTEN`, #849): Adressen wie `https://gemeinde.de` oder
 * `https://*.gemeinde.de`, kommagetrennt. Leer = nirgends außer auf der eigenen Seite.
 */
export function einbettenListe(wert) {
  const liste = String(wert ?? '')
    .split(',')
    .map((x) => x.trim().toLowerCase())
    .filter(Boolean);
  const kaputt = liste.filter((x) => !/^https:\/\/(\*\.)?[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(x));
  if (kaputt.length)
    throw new Error(
      `ANMELDUNG_EINBETTEN braucht Adressen wie „https://gemeinde.de“ oder „https://*.gemeinde.de“ – nicht „${kaputt.join('“, „')}“.`,
    );
  return [...new Set(liste)];
}

/**
 * **Die `.htaccess` des Formulars** (#849): Sicherheits-Header, die der Webspace mitschickt. Die ChurchTools-Instanzen
 * kommen aus derselben Liste wie `instanzen.json` – eine Quelle, zwei Dateien. Was das Formular wirklich lädt: eigene
 * Skripte, Stile und Schriften (fontsource), Daten und Bilder von der Instanz (Gruppenbild, Logo unter `/images/…`).
 * `'unsafe-inline'` nur für Stile: React setzt `style`-Angaben direkt am Element (Farben der Gestaltung).
 *
 * `<IfModule>`: Fehlt `mod_headers`, wird die Datei nicht zum Fehler 500 – ob die Header ankommen, prüft `main` im Netz.
 */
/** Die erste Zeile jeder `.htaccess`, die dieses Skript schreibt – daran erkennt es seine eigene wieder. */
export const HTACCESS_KOPF =
  '# Sicherheits-Header des Anmeldeformulars (#849) – erzeugt von scripts/formular-hochladen.mjs (htaccessAus).';

/** Ist diese `.htaccess` von uns? Eine fremde (Website, Hoster) wird nie überschrieben. */
export function istUnsereHtaccess(text) {
  return typeof text === 'string' && text.startsWith(HTACCESS_KOPF);
}

export function htaccessAus(instanzen, einbetten = []) {
  const ct = instanzen.map((i) => `https://${i}`).join(' ');
  const csp = [
    "default-src 'self'",
    "script-src 'self'",
    "style-src 'self' 'unsafe-inline'",
    `img-src 'self' data: blob: ${ct}`,
    "font-src 'self'", // Schriften als eigene Dateien (ui/design/schrift.ts)
    `connect-src 'self' ${ct}`,
    `frame-ancestors ${["'self'", ...einbetten].join(' ')}`,
    "base-uri 'self'",
    "form-action 'self'",
    "object-src 'none'",
  ].join('; ');
  return [
    HTACCESS_KOPF,
    '# connect-src/img-src: die ChurchTools-Instanzen aus instanzen.json; frame-ancestors: wo es eingebettet werden darf.',
    '<IfModule mod_headers.c>',
    `  Header always set Content-Security-Policy "${csp}"`,
    '  Header always set Referrer-Policy "strict-origin-when-cross-origin"',
    '  Header always set X-Content-Type-Options "nosniff"',
    '</IfModule>',
    '',
  ].join('\n');
}

/** Eine `curl`-Konfiguration mit den Zugangsdaten – sie geht über die Standardeingabe, nicht in die Befehlszeile. */
export function curlKonfig(benutzer, passwort) {
  const sicher = (s) => s.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
  return `user = "${sicher(benutzer)}:${sicher(passwort)}"\n`;
}

/** Ordner im FTP-Zugang als Pfad mit `/` am Anfang und Ende. */
export function ordnerPfad(o) {
  const t = (o ?? '').trim().replace(/^\/+|\/+$/g, '');
  return t ? `/${t}/` : '/';
}

function zugangAusSchluesselbund(server, gewuenscht) {
  const lies = (args) =>
    execFileSync('security', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  const wer = gewuenscht ? ['-a', gewuenscht] : [];
  let info;
  try {
    info = lies(['find-internet-password', '-s', server, ...wer]);
  } catch {
    throw new Error(
      `Im Schlüsselbund gibt es keinen Eintrag für „${server}“${gewuenscht ? ` mit „${gewuenscht}“` : ''}. Einmal anlegen:\n` +
        `  security add-internet-password -s ${server} -a ${gewuenscht ?? '<FTP-Benutzer>'} -r "ftp " -w`,
    );
  }
  const benutzer = /"acct"<blob>="([^"]*)"/.exec(info)?.[1];
  if (!benutzer) throw new Error(`Der Schlüsselbund-Eintrag für „${server}“ hat keinen Benutzer.`);
  const passwort = lies(['find-internet-password', '-s', server, '-a', benutzer, '-w']).replace(
    /\n$/,
    '',
  );
  return { benutzer, passwort };
}

/** Eine Datei lesen – `null`, wenn es sie nicht gibt (curl 78 / FTP 550). Jeder andere Fehler wirft. */
function ladeOderNichts(konfig, url) {
  const r = spawnSync(
    'curl',
    ['--silent', '--show-error', '--ssl-reqd', '--max-time', '60', '-K', '-', url],
    {
      input: konfig,
      encoding: 'utf8',
    },
  );
  if (r.status === 0) return r.stdout;
  if (r.status === 78) return null;
  throw new Error(`curl ${url}: ${r.stderr.trim()}`);
}

/** `curl` mit den Zugangsdaten über die Standardeingabe. Wirft bei Fehlern – mit der Meldung von curl, ohne Passwort. */
function curl(konfig, args) {
  const r = spawnSync(
    'curl',
    ['--silent', '--show-error', '--ssl-reqd', '--max-time', '120', '-K', '-', ...args],
    {
      input: konfig,
      encoding: 'utf8',
    },
  );
  if (r.status !== 0)
    throw new Error(`curl ${args.filter((a) => !a.startsWith('-')).join(' ')}: ${r.stderr.trim()}`);
  return r.stdout;
}

async function main() {
  const server = process.env.ANMELDUNG_FTP_SERVER;
  const adresse = process.env.ANMELDUNG_FORMULAR_ADRESSE;
  if (!server || !adresse || !process.env.ANMELDUNG_CT_INSTANZEN) {
    console.error(
      'Bitte ANMELDUNG_FTP_SERVER, ANMELDUNG_FORMULAR_ADRESSE und ANMELDUNG_CT_INSTANZEN setzen (siehe Kopf dieser Datei).',
    );
    process.exit(2);
  }
  const instanzen = instanzenListe(process.env.ANMELDUNG_CT_INSTANZEN);
  const einbetten = einbettenListe(process.env.ANMELDUNG_EINBETTEN);
  const wurzel = join(dirname(fileURLToPath(import.meta.url)), '..', 'formular', 'dist');
  const html = readFileSync(join(wurzel, 'index.html'), 'utf8');
  const neu = assetsAus(html);
  const gebaut = readdirSync(join(wurzel, 'assets'));
  if (neu.length === 0 || neu.some((n) => !gebaut.includes(n)))
    throw new Error('formular/dist passt nicht zusammen – erst „npm run build -w formular“.');

  const { benutzer, passwort } = zugangAusSchluesselbund(
    server,
    process.env.ANMELDUNG_FTP_BENUTZER,
  );
  const k = curlKonfig(benutzer, passwort);
  const basis = `ftp://${server}${ordnerPfad(process.env.ANMELDUNG_FTP_ORDNER)}`;

  // 0. Nur in einen Ordner, in dem höchstens unser eigenes Paket liegt (siehe `fremdeDateien`).
  let ziel;
  try {
    ziel = curl(k, ['--list-only', basis]).split(/\r?\n/);
  } catch {
    throw new Error(
      `Den Ordner ${basis} gibt es (noch) nicht – erst die Subdomain mit ihrem Ordner anlegen.`,
    );
  }
  // Eine vorhandene `.htaccess` muss unsere sein (#849) – auch wenn die Liste sie nicht zeigt (viele FTP-Server
  // verbergen Punkt-Dateien). Eine fremde wird nie überschrieben.
  const htaccessVorher = ladeOderNichts(k, `${basis}.htaccess`);
  if (htaccessVorher !== null && !istUnsereHtaccess(htaccessVorher))
    throw new Error(
      `Im Ordner ${basis} liegt eine fremde .htaccess – das ist nicht der Ordner des Formulars. Nichts hochgeladen.`,
    );
  const fremd = fremdeDateien(ziel, { htaccessUnsere: htaccessVorher !== null });
  if (fremd.length)
    throw new Error(
      `Im Ordner ${basis} liegen fremde Dateien (${fremd.slice(0, 5).join(', ')}${fremd.length > 5 ? ' …' : ''}) – ` +
        'das ist nicht der Ordner des Formulars. Nichts hochgeladen. ANMELDUNG_FTP_ORDNER prüfen.',
    );

  // 1. Die Liste der Instanzen und die neuen Dateien, 2. index.html zuletzt.
  const listeDatei = join(mkdtempSync(join(tmpdir(), 'formular-')), 'instanzen.json');
  writeFileSync(listeDatei, `${JSON.stringify(instanzen)}\n`);
  curl(k, ['-T', listeDatei, `${basis}instanzen.json`]);
  console.log(`hochgeladen: instanzen.json (${instanzen.join(', ')})`);
  const htaccessDatei = join(dirname(listeDatei), '.htaccess');
  writeFileSync(htaccessDatei, htaccessAus(instanzen, einbetten));
  curl(k, ['-T', htaccessDatei, `${basis}.htaccess`]);
  console.log('hochgeladen: .htaccess (Sicherheits-Header)');
  for (const n of gebaut) {
    curl(k, ['--ftp-create-dirs', '-T', join(wurzel, 'assets', n), `${basis}assets/${n}`]);
    console.log(`hochgeladen: assets/${n}`);
  }
  curl(k, ['-T', join(wurzel, 'index.html'), `${basis}index.html`]);
  console.log('hochgeladen: index.html');

  // 3. Im Netz nachprüfen – erst wenn die Seite genau die neuen Dateien lädt, ist es geschafft.
  const url = adresse.endsWith('/') ? adresse : `${adresse}/`;
  const r = await fetch(`${url}?stand=${Date.now()}`, { cache: 'no-store' });
  const online = assetsAus(await r.text());
  // Die Sicherheits-Header (#849): Ein „hochgeladen“ beweist nicht, dass der Webspace die .htaccess auch anwendet.
  const csp = r.headers.get('content-security-policy') ?? '';
  if (!instanzen.every((i) => csp.includes(`https://${i}`)))
    throw new Error(
      `${url} schickt die Sicherheits-Header nicht (Content-Security-Policy: „${csp || 'fehlt'}“) – wertet der Webspace .htaccess aus (mod_headers)?`,
    );
  if (!r.ok || online.join() !== neu.join())
    throw new Error(
      `Die Seite ${url} liefert noch nicht die neue Fassung (HTTP ${r.status}, ${online.join(', ')}).`,
    );
  for (const n of neu) {
    const a = await fetch(`${url}assets/${n}`, { method: 'HEAD', cache: 'no-store' });
    if (!a.ok) throw new Error(`assets/${n} antwortet mit HTTP ${a.status}.`);
  }
  // Nachlesen statt glauben: Liefert der Webspace genau die eben geschriebene Liste?
  const l = await fetch(`${url}instanzen.json?stand=${Date.now()}`, { cache: 'no-store' });
  const onlineListe = l.ok ? await l.json().catch(() => null) : null;
  if (JSON.stringify(onlineListe) !== JSON.stringify(instanzen))
    throw new Error(
      `${url}instanzen.json liefert nicht die neue Liste (HTTP ${l.status}, ${JSON.stringify(onlineListe)}).`,
    );
  console.log(
    `geprüft: ${url} lädt ${neu.join(', ')}; instanzen.json = ${instanzen.join(', ')}; Sicherheits-Header da`,
  );

  // 4. Erst jetzt alte Dateien löschen.
  const liste = curl(k, ['--list-only', `${basis}assets/`]).split(/\r?\n/);
  for (const n of alteAssets(liste, gebaut)) {
    curl(k, [
      '--list-only',
      '-Q',
      `DELE ${ordnerPfad(process.env.ANMELDUNG_FTP_ORDNER).slice(1)}assets/${n}`,
      `${basis}`,
    ]);
    console.log(`gelöscht: assets/${n}`);
  }
  console.log('Fertig.');
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main().catch((e) => {
    console.error(`Abgebrochen: ${e instanceof Error ? e.message : String(e)}`);
    process.exit(1);
  });
}
