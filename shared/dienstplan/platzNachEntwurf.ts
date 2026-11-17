/**
 * **Was am Platz gilt – mit Entwürfen** (Wunsch 5, Scheibe P2a-2, Alwin 16.11.2026: „Entwürfe zählen mit“).
 *
 * Zwei Regeln, je **eine** Stelle:
 *
 * 1. **Gilt der Platz als frei?** (`platzGiltFrei`, `zaehleFrei`) – Aus ihr rechnen alle Zahlen „N frei“ der Matrix:
 *    Termin-Kopf, Füllbalken, Datumsleiste und Handy-Zettel (`terminStand`), die Gruppenzeile (`gruppenFrei`) und in
 *    „Personen“ die Fußzeile „Noch offen“. Ein **gültiger** Entwurf zählt schon wie das, was er bewirken wird:
 *    Person oder Gast auf einem freien Platz → besetzt; „Zurückziehen“ auf einem belegten Platz → frei; eine Person
 *    durch eine andere ersetzt → bleibt besetzt. Ein **veralteter** Entwurf zählt nicht (am Platz gilt ChurchTools).
 * 2. **Wer steht am Platz?** – das beantwortet `platzPerson` (`fokus.ts`) mit derselben Gültigkeitsregel; daraus rechnen
 *    „Einsätze“ in „Personen“ und der Fokus. Beide Funktionen müssen zusammen passen (Test `platzNachEntwurf.test.ts`).
 *
 * **Bewusst ohne Entwürfe** zählt, was an ChurchTools geht oder im Teilen/PDF steht („Wir suchen noch …“): ein Entwurf ist
 * dort noch nicht verbindlich. Diese Stellen rufen `zaehleFrei` ohne Entwurfs-Suche – das steht dann sichtbar im Code.
 *
 * Nur Typ-Importe aus `plan.ts` (`plan.ts` selbst ruft diese Datei auf).
 */
import type { EntwurfZiel } from './entwuerfe';
import type { PlanPlatz, PlanZeile } from './plan';

/** Der Entwurf an einem Platz – wie `Sicht.entwurf` ihn liefert (mit „veraltet“); nur, was die Regel braucht. */
export type PlatzEntwurfMin = { entwurf: { ziel: EntwurfZiel }; veraltet: boolean } | null;

/** Wie die Matrix einen Entwurf für Spalte, Zeile und Platz kennt (`Sicht.entwurf`, `entwurfAmPlatz`). */
export type EntwurfSuche = (spalte: number, zeile: PlanZeile, platz: PlanPlatz) => PlatzEntwurfMin;

/** Gilt dieser Platz als frei – nach ChurchTools, bei einem gültigen Entwurf nach dem Entwurf? */
export function platzGiltFrei(p: PlanPlatz, entwurf: PlatzEntwurfMin): boolean {
  if (entwurf && !entwurf.veraltet) return entwurf.entwurf.ziel.art === 'frei';
  return p.art === 'frei';
}

/**
 * Wie viele Plätze einer Zelle als frei gelten. Ohne `entwurf` zählt nur ChurchTools (Teilen/PDF, Senden); mit der Suche
 * für diese Zelle (`(p) => sicht.entwurf(spalte, zeile, p)`) zählen gültige Entwürfe mit.
 */
export function zaehleFrei(
  zelle: readonly PlanPlatz[],
  entwurf?: (p: PlanPlatz) => PlatzEntwurfMin,
): number {
  return zelle.filter((p) => platzGiltFrei(p, entwurf?.(p) ?? null)).length;
}
