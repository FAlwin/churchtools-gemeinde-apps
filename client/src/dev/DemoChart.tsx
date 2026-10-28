import type { SetlistSong } from '@shared/types/index';
import { ChordChart } from '../pages/ChordChart';

/**
 * NUR Entwicklung (?demo=chart): mountet ChordChart mit mehreren Testliedern (ohne CT-Login),
 * um den durchgehenden 2-up-Seitenstrom (Querformat) und die PDF-Liedansicht zu prüfen.
 */

function song(id: number, title: string, key: string, chordpro: string): SetlistSong {
  return {
    id,
    arrangementId: id,
    // Zwei Arrangements, damit die Vorführung zeigt, was im Alltag der interessante Fall ist:
    // Bei genau einem erscheint die Angabe absichtlich nicht.
    arrangementName: 'Akustik',
    arrangementCount: 2,
    title,
    author: 'Demo',
    originalKey: key,
    targetKey: key,
    bpm: 72,
    timeSig: '4/4',
    ccli: null,
    chordpro,
    versions: [],
    documents: [],
  };
}

const SONGS: SetlistSong[] = [
  song(
    999001,
    'Großer Gott wir loben dich',
    'G',
    `{title: Großer Gott wir loben dich}
{comment: Vers 1}
[G]Großer Gott, wir [D]loben dich,
[Em]Herr, wir [C]preisen deine [G]Stärke.
{comment: Refrain}
[C]Halleluja, [G]singt dem Herrn,
[D]preist ihn, alle [Em]Welt.`,
  ),
  song(
    999002,
    'Welch ein Freund ist unser Jesus',
    'G',
    `{title: Welch ein Freund ist unser Jesus}
{comment: Vers 1}
[G]Welch ein Freund ist unser Jesus, [C]o wie hoch ist er erhöht.
[G]Er hat uns mit Gott versöhnet [C]und vertritt uns im Gebet.
{comment: Vers 2}
[G]Wenn des Feindes Macht uns drohet [C]und manch Sturm rings um uns weht,
[G]brauchen wir uns nicht zu fürchten, [C]stehn wir gläubig im Gebet.`,
  ),
  song(
    999003,
    'Treu',
    'E',
    `{title: Treu}
{comment: Vers}
[E]Du bleibst an meiner Seite [F#m7]du schämst dich nicht für mich
[A]Du weißt ich bin untreu [B]und dennoch gehst du nicht
{comment: Chorus}
[E]Du bist treu Herr [A]an jedem neuen Tag
[E]Du bist treu Herr [F#m7]auch wenn ich ver - sag [B]`,
  ),
];

/**
 * `?demo=chart&lied=lang`: ein Lied über zwei A4-Seiten – sechs Teile à neun Zeilen, der letzte springt auf
 * Seite 2. Auf der Rolle liegt die Lücke am Ende von Seite 1 dann über dem sechsten Teil (#615, Lasso). In
 * Vers 3 steht nach der vierten Zeile ein Weiterschalt-Punkt `----` (#609, Pedal).
 */
const LANG: SetlistSong[] = [
  song(
    999009,
    'Langes Lied',
    'C',
    Array.from(
      { length: 6 },
      (_, n) =>
        `{comment: Vers ${n + 1}}\n${Array.from({ length: 9 }, (_z, z) =>
          n === 2 && z === 4 ? '----\n[C]Zeile mit [G]Text' : '[C]Zeile mit [G]Text',
        ).join('\n')}`,
    ).join('\n'),
  ),
];

export function DemoChart() {
  const lang = new URLSearchParams(window.location.search).get('lied') === 'lang';
  return (
    <ChordChart
      songs={lang ? LANG : SONGS}
      startIndex={0}
      kopf={{ titel: 'Demo – Liedblatt', zurueckZiel: 'Ablauf' }}
      onBack={() => undefined}
      canEditSong
    />
  );
}
