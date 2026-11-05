import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { relative } from 'node:path';
import { dateien, ORDNER, WURZEL } from './quelltexte.testutil';

/**
 * **Mitgliedschaften nur über `ui/ct/mitglieder.ts`** (#848). Die Regel – anlegen per `PUT` mit `only_add`, ändern per
 * `PATCH`, 404 = nicht dabei – stand bis zum 05.11.2026 an sechs Schreibstellen, dazu viermal das Lesen. Wer die
 * Adresse einer einzelnen Mitgliedschaft selbst baut, baut die Regel nach: Ändern per `PUT` ist veraltet und löscht
 * Kommentar und Enddatum (#759). Listen (`/members`, `/members/history`, `/members/routines`) und die Anwesenheit
 * (`/meetings/{m}/members/{p}`) sind andere Endpunkte und bleiben erlaubt.
 */
const BAUSTEIN = 'ui/ct/mitglieder.ts';

/** Eine einzelne Mitgliedschaft als Adresse: `/groups/${…}/members/${…}`. */
export function einzelAdressen(text: string): number[] {
  return [...text.matchAll(/\/groups\/\$\{[^}]+\}\/members\/\$\{/g)].map(
    (m) => text.slice(0, m.index).split('\n').length,
  );
}

describe('Mitgliedschaften nur über den Baustein (#848)', () => {
  it('niemand sonst spricht /groups/{g}/members/{p} an', () => {
    const funde: string[] = [];
    for (const ordner of [...ORDNER, 'shared']) {
      for (const datei of dateien(ordner, /\.(ts|tsx)$/)) {
        const rel = relative(WURZEL, datei);
        if (rel === BAUSTEIN || /\.test\.tsx?$|testutil|testhilfe|demo/.test(rel)) continue;
        for (const z of einzelAdressen(readFileSync(datei, 'utf8'))) funde.push(`${rel}:${z}`);
      }
    }
    expect(funde).toEqual([]);
  });

  it('erkennt die Adresse (Gegenprobe gegen einen Test, der nichts finden kann)', () => {
    expect(einzelAdressen('ctAnfrage(`/groups/${id}/members/${personId}`, {')).toHaveLength(1);
    expect(einzelAdressen('`/groups/${g}/members`')).toEqual([]);
    expect(einzelAdressen('`/groups/${g}/members/routines`')).toEqual([]);
    expect(einzelAdressen('`/groups/${g}/meetings/${m}/members/${p}`')).toEqual([]);
  });

  it('der Baustein selbst ist da und baut die Adresse', () => {
    expect(einzelAdressen(readFileSync(`${WURZEL}/${BAUSTEIN}`, 'utf8'))).toHaveLength(1);
  });
});
