import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { relative } from 'node:path';
import { dateien, ORDNER, WURZEL } from './quelltexte.testutil';

/**
 * **Eine Uhr: die der Gemeinde** (#847, Entscheidung in `docs/entwicklung/entscheidungen.md`). Bis zum 05.11.2026
 * bestimmte gut ein Dutzend Dateien die Zeitzone selbst – je Datei `Intl…resolvedOptions().timeZone`, fest
 * `'Europe/Berlin'` als Vorgabe, `toLocaleString` ohne Zeitzone (nimmt still die des Geräts) und „heute“ als
 * `tagAusIso(new Date().toISOString(), …)`. In Deutschland fällt keine davon auf, deshalb hält dieser Test sie fest:
 * Die Zeitzone kommt aus `gemeindeZeitzone()`, „heute“ aus `heuteImKalender()`, Anzeigen aus `uhrText`/
 * `datumUhrText` (alles `shared/ct/zeit.ts`).
 */
const AUSNAHMEN: Record<string, string> = {
  'shared/ct/zeit.ts': 'die eine Stelle',
  'server/src/config.ts': 'Vorgabe für ZEITZONE – der Server reicht sie ausdrücklich weiter',
};

/** Was in einer Datei gegen die eine Uhr verstößt – als „Zeile  Grund“. */
export function verstoesse(text: string): string[] {
  const funde: string[] = [];
  const zeile = (i: number) => text.slice(0, i).split('\n').length;
  const regeln: [RegExp, string][] = [
    [/resolvedOptions\(\)\.timeZone/g, 'Zeitzone des Geräts – gemeindeZeitzone()'],
    [/["']Europe\/Berlin["']/g, 'feste Zeitzone – gemeindeZeitzone()'],
    [
      /tagAusIso\((?:new Date\(\)|jetzt)\.toISOString\(\)/g,
      '„heute“ nachgebaut – heuteImKalender()',
    ],
    [/\.getFullYear\(\)/g, 'Kalender des Geräts – heuteImKalender()'],
    [/Date\.parse\(`\$\{\w+\}T\d{2}:00:00Z`\)\s*\+/g, 'Tage nachgerechnet – plusTage()'],
  ];
  for (const [re, grund] of regeln) {
    for (const m of text.matchAll(re)) funde.push(`${zeile(m.index)}  ${grund}`);
  }
  for (const m of text.matchAll(/new Intl\.DateTimeFormat\(([^)]*)\)/g)) {
    if (!m[1].includes('timeZone'))
      funde.push(`${zeile(m.index)}  Intl ohne timeZone – uhrText/datumUhrText`);
  }
  // `toLocaleString` gibt es auch für Zahlen – gezählt wird es nur mit Datumsfeldern.
  for (const m of text.matchAll(/\.toLocale(Date|Time)?String\(([^)]*)\)/g)) {
    const datum = m[1] !== undefined || /day|hour|minute|month|weekday/.test(m[2]);
    if (datum && !m[2].includes('timeZone'))
      funde.push(`${zeile(m.index)}  toLocale…String ohne timeZone – uhrText/datumUhrText`);
  }
  return funde;
}

describe('Eine Uhr: die der Gemeinde (#847)', () => {
  it('keine eigene Zeitzone, kein eigenes „heute“, keine Anzeige in Gerätezeit', () => {
    const funde: string[] = [];
    for (const ordner of [...ORDNER, 'shared']) {
      for (const datei of dateien(ordner, /\.(ts|tsx)$/)) {
        const rel = relative(WURZEL, datei);
        if (rel in AUSNAHMEN || /\.test\.tsx?$|testutil|testdaten/.test(rel)) continue;
        for (const f of verstoesse(readFileSync(datei, 'utf8'))) funde.push(`${rel}:${f}`);
      }
    }
    expect(funde).toEqual([]);
  });

  it('erkennt jede Form (Gegenprobe gegen einen Test, der nichts finden kann)', () => {
    expect(verstoesse('const z = Intl.DateTimeFormat().resolvedOptions().timeZone;')).toHaveLength(
      1,
    );
    expect(verstoesse("zeitzone = 'Europe/Berlin',")).toHaveLength(1);
    expect(verstoesse('heute={tagAusIso(new Date().toISOString(), zeitzone)}')).toHaveLength(1);
    expect(verstoesse('const j = d.getFullYear();')).toHaveLength(1);
    expect(
      verstoesse(
        'new Date(Date.parse(`${tag}T00:00:00Z`) + 86_400_000).toISOString().slice(0, 10)',
      ),
    ).toHaveLength(1);
    expect(verstoesse("new Intl.DateTimeFormat('de-DE', {\n  day: '2-digit',\n})")).toHaveLength(1);
    expect(verstoesse("am.toLocaleString('de-DE', { hour: '2-digit' })")).toHaveLength(1);
    expect(verstoesse("d.toLocaleDateString('de-DE')")).toHaveLength(1);
    // Erlaubt: mit Zeitzone, und Zahlen.
    expect(verstoesse("new Intl.DateTimeFormat('de-DE', { timeZone: z })")).toEqual([]);
    expect(verstoesse("n.toLocaleString('de-DE', { maximumFractionDigits: 2 })")).toEqual([]);
  });

  it('jede Ausnahme gibt es noch – sonst wäre sie nur ein Loch', () => {
    for (const rel of Object.keys(AUSNAHMEN)) {
      expect(() => readFileSync(`${WURZEL}/${rel}`, 'utf8')).not.toThrow();
    }
  });
});
