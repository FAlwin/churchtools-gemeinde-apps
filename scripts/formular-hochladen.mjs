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
 *   ANMELDUNG_FTP_SERVER=<FTP-Server> ANMELDUNG_FORMULAR_ADRESSE=https://anmeldung.… npm run formular:hochladen
 *
 * Optional `ANMELDUNG_FTP_ORDNER` (Ordner im FTP-Zugang, Standard: dessen Wurzel).
 *
 * **Reihenfolge, damit nie eine halbe Seite online ist:** erst die neuen Dateien unter `assets/`, dann
 * `index.html` – sie verweist auf die neuen Dateien –, dann wird die Seite **im Netz nachgeprüft** (lädt sie genau
 * die eben hochgeladenen Dateien, antworten alle?), und erst danach werden alte Dateien gelöscht. Scheitert ein
 * Schritt vorher, bleibt die bisherige Seite, wie sie war.
 */
import { execFileSync, spawnSync } from 'node:child_process';
import { readdirSync, readFileSync } from 'node:fs';
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

function zugangAusSchluesselbund(server) {
  const lies = (args) =>
    execFileSync('security', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  let info;
  try {
    info = lies(['find-internet-password', '-s', server]);
  } catch {
    throw new Error(
      `Im Schlüsselbund gibt es keinen Eintrag für „${server}“. Einmal anlegen:\n` +
        `  security add-internet-password -s ${server} -a <FTP-Benutzer> -r "ftp " -w`,
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
  if (!server || !adresse) {
    console.error(
      'Bitte ANMELDUNG_FTP_SERVER und ANMELDUNG_FORMULAR_ADRESSE setzen (siehe Kopf dieser Datei).',
    );
    process.exit(2);
  }
  const wurzel = join(dirname(fileURLToPath(import.meta.url)), '..', 'formular', 'dist');
  const html = readFileSync(join(wurzel, 'index.html'), 'utf8');
  const neu = assetsAus(html);
  const gebaut = readdirSync(join(wurzel, 'assets'));
  if (neu.length === 0 || neu.some((n) => !gebaut.includes(n)))
    throw new Error('formular/dist passt nicht zusammen – erst „npm run build -w formular“.');

  const { benutzer, passwort } = zugangAusSchluesselbund(server);
  const k = curlKonfig(benutzer, passwort);
  const basis = `ftp://${server}${ordnerPfad(process.env.ANMELDUNG_FTP_ORDNER)}`;

  // 1. Neue Dateien, 2. index.html zuletzt.
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
  if (!r.ok || online.join() !== neu.join())
    throw new Error(
      `Die Seite ${url} liefert noch nicht die neue Fassung (HTTP ${r.status}, ${online.join(', ')}).`,
    );
  for (const n of neu) {
    const a = await fetch(`${url}assets/${n}`, { method: 'HEAD', cache: 'no-store' });
    if (!a.ok) throw new Error(`assets/${n} antwortet mit HTTP ${a.status}.`);
  }
  console.log(`geprüft: ${url} lädt ${neu.join(', ')}`);

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
