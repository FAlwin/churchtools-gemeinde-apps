import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';

/**
 * **Was ausgeliefert wird** (#849): die GitHub-Actions, die Images und Releases schreiben, und das Docker-Image selbst.
 * Beides hängt nicht am App-Code – deshalb eine eigene Dauerprüfung, damit es nicht still wieder aufweicht.
 */
const wurzel = new URL('..', import.meta.url);
const lies = (pfad) => readFileSync(new URL(pfad, wurzel), 'utf8');

/** Jede fremde Action, die nicht auf einen Commit festgelegt ist – als „Datei: uses-Zeile“. */
export function ungepinnt(dateien) {
  const funde = [];
  for (const [name, text] of dateien) {
    for (const zeile of text.split('\n')) {
      const m = /^\s*-?\s*uses:\s*([^\s#]+)/.exec(zeile);
      if (!m || m[1].startsWith('./') || m[1].startsWith('actions/')) continue;
      // Ein Tag (`@v7`) lässt sich vom Herausgeber verschieben – ein Commit nicht. Die Version steht als Kommentar dabei.
      if (!/@[0-9a-f]{40}$/.test(m[1]) || !/#\s*v\d/.test(zeile))
        funde.push(`${name}: ${zeile.trim()}`);
    }
  }
  return funde;
}

describe('GitHub-Actions mit Schreibrechten auf Commits festgelegt (#849)', () => {
  it('jede fremde Action steht auf einem Commit-SHA mit Versions-Kommentar', () => {
    const ordner = new URL('.github/workflows/', wurzel);
    const dateien = readdirSync(ordner)
      .filter((n) => n.endsWith('.yml'))
      .map((n) => [n, readFileSync(new URL(n, ordner), 'utf8')]);
    expect(dateien.length).toBeGreaterThan(0);
    expect(ungepinnt(dateien)).toEqual([]);
  });

  it('erkennt ein Tag (Gegenprobe gegen einen Test, der nichts finden kann)', () => {
    expect(ungepinnt([['x.yml', '      - uses: docker/login-action@v4']])).toHaveLength(1);
    expect(
      ungepinnt([['x.yml', `      uses: docker/login-action@${'a'.repeat(40)}`]]),
    ).toHaveLength(1); // ohne Versions-Kommentar
    expect(
      ungepinnt([['x.yml', `      uses: docker/login-action@${'a'.repeat(40)} # v4.8.0`]]),
    ).toEqual([]);
    expect(ungepinnt([['x.yml', '      - uses: actions/checkout@v5']])).toEqual([]);
  });
});

describe('Docker-Image: Laufzeit ohne Entwickler-Pakete (#849)', () => {
  it('zwei Stufen, die Laufzeit installiert nur Laufzeit-Abhängigkeiten', () => {
    const d = lies('Dockerfile');
    expect(d.match(/^FROM /gm)).toHaveLength(2);
    const laufzeit = d.slice(d.lastIndexOf('\nFROM '));
    expect(laufzeit).toMatch(/npm ci --omit=dev/);
    expect(laufzeit).toMatch(/COPY --from=bau \/app\/client\/dist/);
  });

  it('tsx ist eine Laufzeit-Abhängigkeit des Servers – er startet damit', () => {
    const p = JSON.parse(lies('server/package.json'));
    expect(p.scripts.start).toMatch(/^tsx /);
    expect(p.dependencies.tsx).toBeDefined();
    expect(p.devDependencies?.tsx).toBeUndefined();
  });
});
