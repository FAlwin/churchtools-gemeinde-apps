#!/usr/bin/env node
/**
 * **CHANGELOG-Einträge als Dateien je PR** (22.10.2026, Alwin: die Extrarunden beim Mergen „sind schon
 * ärgerlich“). Vorher schrieb jeder PR ganz oben unter `## [Unreleased]` in `CHANGELOG.md` – mit mehreren
 * Sitzungen gleichzeitig hieß jeder fremde Merge einen Konflikt im eigenen PR, also neu abgleichen und die CI
 * erneut abwarten. Jetzt legt jeder PR seinen Eintrag als eigene Datei in `changelog.d/` ab; erst beim
 * Release führt dieses Skript sie in `CHANGELOG.md` zusammen.
 *
 *   node scripts/changelog-sammeln.mjs                                   Vorschau: was käme in den Release
 *   node scripts/changelog-sammeln.mjs --pruefen                         nur die Einträge prüfen
 *   node scripts/changelog-sammeln.mjs --version 2.38.0 [--datum JJJJ-MM-TT]
 *                                                                        in CHANGELOG.md eintragen, Dateien löschen
 *
 * Reihenfolge: der zuletzt hinzugefügte Eintrag zuerst (wie bisher oben in `[Unreleased]`) – nach dem
 * Commit, mit dem die Datei kam, sonst nach dem Dateidatum.
 */
import {
  existsSync,
  readdirSync,
  readFileSync,
  statSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ueberschriftFehler } from './release-notizen.mjs';

const WURZEL = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const EINTRAG_DIR = path.join(WURZEL, 'changelog.d');
const CHANGELOG = path.join(WURZEL, 'CHANGELOG.md');

/** Was an einem Eintrag nicht stimmt – leer, wenn alles passt. */
export function eintragFehler(name, text) {
  const t = text.trim();
  if (!t) return [`${name}: leer`];
  const fehler = [];
  if (!t.startsWith('### '))
    fehler.push(`${name}: muss mit einer Überschrift „### Neu (…)“ o. Ä. beginnen`);
  if (/^#{1,2} /m.test(t))
    fehler.push(`${name}: keine Überschriften mit # oder ## – die setzt der Release`);
  // Die App in der Klammer entscheidet, in welcher Release-Beschreibung der Eintrag steht (30.10.2026).
  for (const kopf of t.match(/^###\s.*$/gm) ?? []) {
    const f = ueberschriftFehler(kopf.trim());
    if (f) fehler.push(`${name}: ${f}`);
  }
  return fehler;
}

/** Neuester zuerst; bei gleicher Zeit nach Namen, damit das Ergebnis nicht vom Zufall abhängt. */
export function ordnen(eintraege) {
  return [...eintraege].sort((a, b) => b.zeit - a.zeit || a.name.localeCompare(b.name));
}

/**
 * Den Release in den CHANGELOG-Text setzen: direkt unter `## [Unreleased]` die neue Versions-Überschrift,
 * darunter die Einträge – und darunter, was schon unter `[Unreleased]` stand (aus der Zeit vor den Dateien),
 * das damit ebenfalls zu dieser Version gehört.
 */
export function zusammenfuehren(changelog, eintraege, { version, datum }) {
  const kopf = '## [Unreleased]\n';
  const i = changelog.indexOf(kopf);
  if (i < 0) throw new Error('In CHANGELOG.md fehlt „## [Unreleased]“.');
  const vor = changelog.slice(0, i + kopf.length);
  const rest = changelog.slice(i + kopf.length).replace(/^\n+/, '');
  const teile = ordnen(eintraege).map((e) => e.text.trim());
  const block = [`## [${version}] – ${datum}`, ...teile].join('\n\n');
  return `${vor}\n${block}\n\n${rest}`;
}

function eintraegeLesen() {
  if (!existsSync(EINTRAG_DIR)) return [];
  return readdirSync(EINTRAG_DIR)
    .filter((n) => n.endsWith('.md') && n !== 'README.md')
    .map((name) => {
      const datei = path.join(EINTRAG_DIR, name);
      let zeit = statSync(datei).mtimeMs / 1000;
      try {
        const git = execFileSync(
          'git',
          ['log', '--diff-filter=A', '--format=%ct', '-1', '--', datei],
          { cwd: WURZEL, encoding: 'utf8' },
        ).trim();
        if (git) zeit = Number(git);
      } catch {
        /* kein Git – dann das Dateidatum */
      }
      return { name, datei, zeit, text: readFileSync(datei, 'utf8') };
    });
}

function main() {
  const argv = process.argv.slice(2);
  const wert = (n) => {
    const i = argv.indexOf(n);
    return i >= 0 ? argv[i + 1] : undefined;
  };
  const eintraege = eintraegeLesen();
  const fehler = eintraege.flatMap((e) => eintragFehler(e.name, e.text));
  if (fehler.length) {
    console.error(`✗ ${fehler.length} Problem(e) in changelog.d/:\n  - ${fehler.join('\n  - ')}`);
    process.exit(1);
  }
  if (argv.includes('--pruefen')) {
    console.log(`✓ ${eintraege.length} Eintrag/Einträge in changelog.d/ in Ordnung.`);
    return;
  }
  const version = wert('--version');
  if (!version) {
    if (eintraege.length === 0) console.log('Keine Einträge in changelog.d/.');
    for (const e of ordnen(eintraege)) console.log(`── ${e.name}\n${e.text.trim()}\n`);
    return;
  }
  if (!/^\d+\.\d+\.\d+$/.test(version)) throw new Error(`Version „${version}“ ist nicht X.Y.Z.`);
  const datum = wert('--datum') ?? new Date().toISOString().slice(0, 10);
  writeFileSync(
    CHANGELOG,
    zusammenfuehren(readFileSync(CHANGELOG, 'utf8'), eintraege, { version, datum }),
  );
  for (const e of eintraege) unlinkSync(e.datei);
  console.log(
    `✓ ${eintraege.length} Eintrag/Einträge unter [${version}] – ${datum} eingetragen, Dateien gelöscht.`,
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
