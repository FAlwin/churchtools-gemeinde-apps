/**
 * **Besprechungsanfragen zum Termin** (W15-4, Reiter „Besprechungsanfragen“ im Fenster „In Kalender eintragen“) – die Regeln
 * ohne ChurchTools. Gemessen 25.11.2026 (`protokolle-planung/docs/messung-w15-0-2026-11-23.md`, „Nachtrag W15-4“).
 *
 * - Den Reiter gibt es **nur bei Gruppenkalendern** (`type: 'group'` in `GET /calendars`).
 * - **Kandidaten** (`GET /calendars/{id}/meetingrequest/candidates`): derselbe Mensch kommt mehrfach vor (einmal ohne Gruppe,
 *   einmal je Gruppe als `groupMember`) → **nach Personen-ID entdoppeln**, der Eintrag mit Gruppenname gewinnt (wie CT).
 * - Wer anlegt und sich einlädt, hat sofort zugesagt und bekommt keine Mail (`einladungsmail.ts`).
 */

/** Eine Person, die angefragt werden kann. */
export interface Kandidat {
  id: number;
  name: string;
  /** Die Gruppe, über die sie in der Liste steht (klein unter dem Namen) – oder `undefined`. */
  gruppe?: string;
}

interface KandidatRoh {
  groupName?: unknown;
  person?: { title?: unknown; domainType?: unknown; domainIdentifier?: unknown } | null;
}

/** Die Kandidaten aus der Antwort: nur Personen, nach ID entdoppelt, nach Namen sortiert. */
export function kandidatenAus(roh: unknown): Kandidat[] {
  const nachId = new Map<number, Kandidat>();
  for (const k of (Array.isArray(roh) ? roh : []) as (KandidatRoh | null)[]) {
    const p = k?.person;
    if (p?.domainType !== 'person') continue;
    const id = Number(p.domainIdentifier);
    if (!Number.isInteger(id) || id <= 0) continue;
    const gruppe =
      typeof k?.groupName === 'string' && k.groupName.trim() ? k.groupName.trim() : undefined;
    const da = nachId.get(id);
    if (da && (da.gruppe || !gruppe)) continue;
    nachId.set(id, {
      id,
      name: typeof p.title === 'string' && p.title.trim() ? p.title.trim() : `Person ${id}`,
      ...(gruppe ? { gruppe } : {}),
    });
  }
  return [...nachId.values()].sort((a, b) => a.name.localeCompare(b.name, 'de'));
}

/** Das Suchfeld „Nach Name oder Gruppe suchen …“: Groß-/Kleinschreibung egal, alle Wörter müssen vorkommen. */
export function kandidatenFiltern(liste: readonly Kandidat[], suche: string): Kandidat[] {
  const woerter = suche.toLocaleLowerCase('de').split(/\s+/).filter(Boolean);
  if (!woerter.length) return [...liste];
  return liste.filter((k) => {
    const text = `${k.name} ${k.gruppe ?? ''}`.toLocaleLowerCase('de');
    return woerter.every((w) => text.includes(w));
  });
}

/**
 * **Wer wirklich angefragt wird:** ich (immer, sobald der Schalter an ist und ich unter den Kandidaten stehe – abwählen
 * geht nicht, wie in CT) plus die Gewählten, die es unter den Kandidaten gibt. Jede Person einmal, in der Reihenfolge der Liste.
 */
export function angefragte(
  kandidaten: readonly Kandidat[],
  gewaehlt: ReadonlySet<number>,
  ich: number,
): number[] {
  return kandidaten.filter((k) => k.id === ich || gewaehlt.has(k.id)).map((k) => k.id);
}

/**
 * **Was nach dem Anlegen zu den Anfragen zu sagen ist** – `null`, wenn alle da sind. `fehlend` sind die Personen ohne
 * Anfrage am neuen Termin; `unklar` heißt: das Nachlesen selbst ist gescheitert (dann wissen wir es nicht – nicht „fehlt“,
 * vorübergehend ist nicht ungültig).
 */
export function anfrageHinweis(
  ergebnis: { fehlend: readonly number[]; unklar: boolean },
  name: (id: number) => string,
): string | null {
  if (ergebnis.unklar)
    return 'Ob die Besprechungsanfragen angekommen sind, ließ sich nicht nachlesen. Bitte am Termin in ChurchTools nachsehen und bei Bedarf nachholen – der Termin selbst steht im Kalender.';
  if (!ergebnis.fehlend.length) return null;
  const liste = ergebnis.fehlend.map(name).join(', ');
  return `Nicht angefragt hat ChurchTools: ${liste}. Das lässt sich am Termin in ChurchTools nachholen. Der Termin selbst steht im Kalender.`;
}
