import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { relative } from 'node:path';
import { dateien, ORDNER, WURZEL } from './quelltexte.testutil';

/**
 * **Höchstens ein Reiter „Einstellungen“, immer der letzte, nur Einstellungen** (R13, „Ruhige Bedienung“, 20.11.2026).
 *
 * Bis dahin hießen die Reiter für Einstellungen in jeder App anders – „Mehr“ in der Musik-App (mit einer Arbeitsseite
 * darin: den Ablaufvorlagen), „Verwaltung“ in den Protokollen, „Einstellungen“ im Organigramm, den Anmeldungen und im
 * Gebetsabend. Die ChurchTools Dev Platform sieht je Erweiterung eine Einstellungsseite vor; so heißt sie überall gleich
 * und steht an derselben Stelle. Arbeitsseiten gehören in den Reiter, zu dem sie fachlich gehören (meist ins „⋯“).
 *
 * Geprüft wird der Quelltext der Reiter-Listen (Objekte mit `label` UND `icon`, z. B. `{ id: 'start', label: 'Start',
 * icon: 'home' }`):
 *  (a) kein Reiter heißt „Mehr“ oder „Verwaltung“ – das ist der Einstellungen-Reiter unter altem Namen;
 *  (b) steht in einer Liste ein Reiter „Einstellungen“, ist er der letzte darin.
 * `ErweiterungsSeite` hängt ihren Einstellungen-Reiter selbst hinten an (dort eigener Test); die Musik-App ordnet ihre
 * Reiter in `App.tsx` – dort muss `mehr` (heißt „Einstellungen“) das letzte `tabs.push` sein.
 */
const VERBOTEN = new Set(['Mehr', 'Verwaltung']);
// Ein Reiter: ein Objekt (ohne verschachtelte Klammern) mit `label: '…'` und `icon: '…'`, in beliebiger Reihenfolge.
const OBJEKT = /\{[^{}]*\}/g;

interface ReiterFund {
  label: string;
  zeile: number;
  start: number;
  ende: number;
}

export function reiterIn(text: string): ReiterFund[] {
  const out: ReiterFund[] = [];
  for (const m of text.matchAll(OBJEKT)) {
    const label = /\blabel:\s*'([^']+)'/.exec(m[0]);
    if (!label || !/\bicon:\s*'[^']+'/.test(m[0])) continue;
    out.push({
      label: label[1],
      zeile: text.slice(0, m.index).split('\n').length,
      start: m.index,
      ende: m.index + m[0].length,
    });
  }
  return out;
}

/** Reiter, die unmittelbar hintereinander stehen (nur Komma und Leerraum dazwischen) = eine Liste. */
export function listen(text: string): ReiterFund[][] {
  const out: ReiterFund[][] = [];
  for (const r of reiterIn(text)) {
    const letzte = out[out.length - 1];
    const davor = letzte?.[letzte.length - 1];
    if (davor && /^\s*,\s*$/.test(text.slice(davor.ende, r.start))) letzte.push(r);
    else out.push([r]);
  }
  return out;
}

/** Fundstellen (`Zeile: Text`) gegen R13 – leer, wenn alles stimmt. */
export function verstoesse(text: string): string[] {
  const funde: string[] = [];
  for (const r of reiterIn(text)) {
    if (VERBOTEN.has(r.label)) funde.push(`${r.zeile}: Reiter „${r.label}“ heißt „Einstellungen“`);
  }
  for (const liste of listen(text)) {
    const pos = liste.findIndex((r) => r.label === 'Einstellungen');
    if (pos !== -1 && pos !== liste.length - 1)
      funde.push(`${liste[pos].zeile}: „Einstellungen“ ist nicht der letzte Reiter`);
  }
  return funde;
}

/** Die Dateien aller Apps, in denen Reiter-Listen stehen können (ohne Tests). */
function quellen(): string[] {
  return ORDNER.flatMap((o) => dateien(o, /\.(ts|tsx)$/)).filter((p) => !/\.test\.tsx?$/.test(p));
}

describe('Einstellungen-Reiter (R13)', () => {
  it('kein Reiter heißt „Mehr“ oder „Verwaltung“, und „Einstellungen“ steht in jeder Liste zuletzt', () => {
    const funde = quellen().flatMap((p) =>
      verstoesse(readFileSync(p, 'utf8')).map((f) => `${relative(WURZEL, p)}:${f}`),
    );
    expect(funde).toEqual([]);
  });

  it('Gegenprobe: erkennt die alten Reiter (Musik-App „Mehr“, Protokolle „Verwaltung“) und ein „Einstellungen“ mitten in der Liste', () => {
    expect(verstoesse("mehr: { label: 'Mehr', icon: 'cog-fill' },")).toHaveLength(1);
    expect(verstoesse("{ id: 'verwaltung', label: 'Verwaltung', icon: 'regler' }")).toHaveLength(1);
    const mitte = `[
      { id: 'a', label: 'Start', icon: 'home' },
      { id: 'e', label: 'Einstellungen', icon: 'zahnrad' },
      { id: 'b', label: 'Sitzungen', icon: 'calendar' },
    ]`;
    expect(verstoesse(mitte)).toEqual(['3: „Einstellungen“ ist nicht der letzte Reiter']);
    // Ein Knopf-Objekt ohne Symbol ist kein Reiter; ein Menüeintrag „Mehr“ ohne `icon` auch nicht.
    expect(verstoesse("{ label: 'Mehr', onClick: f }")).toEqual([]);
    expect(
      verstoesse("{ label: 'Mehr', icon: 'x' }, { label: 'Start', icon: 'home' }"),
    ).toHaveLength(1);
  });

  it('Musik-App: der Reiter „Einstellungen“ (ID `mehr`) ist der letzte Reiter in `App.tsx`', () => {
    const app = readFileSync(`${WURZEL}client/src/App.tsx`, 'utf8');
    const pushes = [...app.matchAll(/tabs\.push\('(\w+)'\)/g)].map((m) => m[1]);
    expect(pushes.at(-1)).toBe('mehr');
    const meta = readFileSync(`${WURZEL}client/src/components/TabBar.tsx`, 'utf8');
    expect(meta).toMatch(/mehr:\s*\{\s*label:\s*'Einstellungen'/);
  });

  it('`ErweiterungsSeite` hängt „Einstellungen“ hinten an die Reiter der App', () => {
    const text = readFileSync(`${WURZEL}ui/erweiterung/ErweiterungsSeite.tsx`, 'utf8');
    const reiterListe = /const reiter: Reiter<string>\[\] = \[([\s\S]*?)\n {2}\];/.exec(text);
    expect(reiterListe).not.toBeNull();
    const teile = reiterListe![1];
    expect(teile.indexOf('bereiche?.reiter')).toBeGreaterThanOrEqual(0);
    expect(teile.indexOf("label: 'Einstellungen'")).toBeGreaterThan(
      teile.indexOf('bereiche?.reiter'),
    );
  });

  it('Protokolle: der Einstellungen-Reiter (ID `verwaltung`) steht in `ALLE_REITER` zuletzt', () => {
    const text = readFileSync(`${WURZEL}protokolle/src/reiter.ts`, 'utf8');
    const liste = listen(text).find((l) => l.some((r) => r.label === 'Einstellungen'));
    expect(liste?.at(-1)?.label).toBe('Einstellungen');
  });
});
