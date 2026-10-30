#!/usr/bin/env node
/**
 * **Release-Beschreibung je App** (30.10.2026, Alwin zur Release-Seite von v2.38.0: „ganz schön wild und beinhaltet
 * alle Apps … wenn ich einen Release einer App mache, sollen auch nur die Features dieser einen App oder Erweiterung da
 * erscheinen“). Vorher hängte GitHub per `generate_release_notes` jeden PR seit dem letzten Tag an – egal welcher App.
 *
 *   node scripts/release-notizen.mjs --app musik-app --tag v2.38.0
 *   node scripts/release-notizen.mjs --app organigramm --tag organigramm-v0.1.1 [--vorher organigramm-v0.1.0]
 *
 * Neu ist, was es beim Tag gibt und beim vorigen Tag derselben App noch nicht gab – gezählt in Abschnitten
 * („### Neu (…)“ samt Text) aus `CHANGELOG.md` UND `changelog.d/`. Beides zählt, weil die Erweiterungen auch
 * zwischen zwei Musik-App-Versionen veröffentlicht werden; dann stehen ihre Einträge noch als Datei in
 * `changelog.d/`. Wandert ein Eintrag später ins CHANGELOG, bleibt sein Text gleich und er gilt nicht als neu.
 *
 * Gezeigt wird ein Abschnitt, wenn seine Überschrift die App nennt oder alle betrifft („alle Apps“, „alle
 * Erweiterungen“, „gemeinsam“) – „Intern“ nie. Dass jeder neue Eintrag eine App nennt, prüft
 * `changelog-sammeln.mjs --pruefen` mit `ueberschriftFehler` von hier.
 */
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const WURZEL = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/** Wie eine Überschrift die App nennt. Schlüssel = `--app`, wie das Kürzel der Erweiterung. */
export const APPS = {
  'musik-app': /Musik-App/,
  dienstplaner: /Dienstplaner/,
  anmeldungen: /Anmeldung/,
  organigramm: /Organigramm/,
  protokolle: /Protokolle/,
};
const ALLE = /alle Apps|alle Erweiterungen|gemeinsam/;

/** Was die Gemeinden sehen, in dieser Reihenfolge. „Hinzugefügt“ ist die alte Schreibweise für „Neu“. */
const GEZEIGT = {
  Neu: 'Neu',
  Hinzugefügt: 'Neu',
  Geändert: 'Geändert',
  Behoben: 'Behoben',
  Entfernt: 'Entfernt',
  Sicherheit: 'Sicherheit',
};
/** Was nur fürs Team ist – braucht keine App. */
const NUR_INTERN = ['Intern', 'Doku', 'Geprüft'];

/** `### Neu (Protokolle, S7-1)` → { art: 'Neu', zusatz: 'Protokolle, S7-1' } */
function zerlegen(kopf) {
  const m = /^###\s+(\S+)\s*(?:\((.*)\))?/.exec(kopf);
  return { art: m?.[1] ?? '', zusatz: m?.[2] ?? '' };
}

/** Was an einer Überschrift fehlt, damit der Eintrag in der richtigen Release-Beschreibung landet. */
export function ueberschriftFehler(kopf) {
  const { art, zusatz } = zerlegen(kopf);
  if (NUR_INTERN.includes(art)) return null;
  if (!(art in GEZEIGT))
    return `„${kopf}“: Art „${art}“ unbekannt – erlaubt sind ${[...Object.keys(GEZEIGT), ...NUR_INTERN].join(', ')}`;
  if (!Object.values(APPS).some((r) => r.test(zusatz)) && !ALLE.test(zusatz))
    return `„${kopf}“: In der Klammer fehlt die App (Musik-App, Dienstplaner, Anmeldungen, Organigramm, Protokolle – oder „alle Apps“), sonst landet der Eintrag in keiner Release-Beschreibung`;
  return null;
}

/** Text in Abschnitte „### …“ samt Rumpf schneiden; `#`/`##`-Überschriften beenden einen Abschnitt. */
export function abschnitte(text) {
  const raus = [];
  let akt = null;
  for (const zeile of text.split('\n')) {
    if (/^###\s/.test(zeile)) {
      akt = { kopf: zeile.trim(), zeilen: [] };
      raus.push(akt);
    } else if (/^#{1,2}\s/.test(zeile)) akt = null;
    else if (akt) akt.zeilen.push(zeile);
  }
  return raus.map(({ kopf, zeilen }) => ({ kopf, rumpf: zeilen.join('\n').trim() }));
}

const schluessel = (a) => `${a.kopf}\n${a.rumpf}`.replace(/\s+/g, ' ').trim();

export function gehoertZu(abschnitt, app) {
  const { art, zusatz } = zerlegen(abschnitt.kopf);
  if (!(art in GEZEIGT) || !abschnitt.rumpf) return false;
  return APPS[app].test(zusatz) || ALLE.test(zusatz);
}

/** Die Beschreibung: Abschnitte von `jetzt`, die es in `vorher` nicht gab, nach Art gruppiert. Leer → ''. */
export function notizen(jetzt, vorher, app) {
  if (!APPS[app])
    throw new Error(`Unbekannte App „${app}“ – erlaubt: ${Object.keys(APPS).join(', ')}`);
  const alt = new Set(vorher.map(schluessel));
  const gesehen = new Set();
  const gruppen = new Map(Object.values(GEZEIGT).map((g) => [g, []]));
  for (const a of jetzt) {
    const s = schluessel(a);
    if (alt.has(s) || gesehen.has(s) || !gehoertZu(a, app)) continue;
    gesehen.add(s);
    gruppen.get(GEZEIGT[zerlegen(a.kopf).art]).push(a.rumpf);
  }
  return [...gruppen]
    .filter(([, r]) => r.length)
    .map(([g, r]) => `### ${g}\n\n${r.join('\n\n')}`)
    .join('\n\n');
}

/** Der vorige stabile Tag derselben App (gleiches Präfix, ohne „-rc…“), älter als `tag`. */
export function vorigerTag(tag, tags) {
  const m = /^(.*?)v(\d+)\.(\d+)\.(\d+)/.exec(tag);
  if (!m) throw new Error(`Tag „${tag}“ ist nicht <Präfix>vX.Y.Z.`);
  const [, praefix] = m;
  const zahl = (t) => /^v(\d+)\.(\d+)\.(\d+)$/.exec(t.slice(praefix.length))?.slice(1).map(Number);
  const ich = m.slice(2).map(Number);
  const kleiner = (a, b) => a[0] - b[0] || a[1] - b[1] || a[2] - b[2];
  return tags
    .filter((t) => t.startsWith(praefix) && t !== tag)
    .map((t) => ({ t, z: zahl(t) }))
    .filter(({ z }) => z && kleiner(z, ich) < 0)
    .sort((a, b) => kleiner(b.z, a.z))[0]?.t;
}

const git = (...args) => execFileSync('git', args, { cwd: WURZEL, encoding: 'utf8' });

/** Alle Abschnitte aus CHANGELOG.md und changelog.d/ beim Stand `ref`. */
function abschnitteBei(ref) {
  const dateien = git('ls-tree', '--name-only', ref, 'changelog.d/')
    .split('\n')
    .filter((n) => n.endsWith('.md') && !n.endsWith('/README.md'));
  return ['CHANGELOG.md', ...dateien].flatMap((d) => abschnitte(git('show', `${ref}:${d}`)));
}

function main() {
  const argv = process.argv.slice(2);
  const wert = (n) => {
    const i = argv.indexOf(n);
    return i >= 0 ? argv[i + 1] : undefined;
  };
  const app = wert('--app');
  const tag = wert('--tag');
  if (!app || !tag) throw new Error('Aufruf: --app <app> --tag <tag> [--vorher <tag>]');
  const vorher =
    wert('--vorher') ?? vorigerTag(tag, git('tag', '--list').split('\n').filter(Boolean));
  const text = notizen(abschnitteBei(tag), vorher ? abschnitteBei(vorher) : [], app);
  const seit = vorher ? ` seit ${vorher}` : '';
  console.log(
    `## Was sich geändert hat${seit}\n\n${text || '_Keine sichtbaren Änderungen – nur Internes._'}`,
  );
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  try {
    main();
  } catch (e) {
    console.error(`Abgebrochen: ${e instanceof Error ? e.message : String(e)}`);
    process.exit(1);
  }
}
