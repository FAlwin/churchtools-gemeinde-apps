/**
 * **Filter der Terminliste** (Alwin, 05.11.2026, Entwurf A1) – die Regeln, ohne React.
 *
 * Anlass: Für einen spontanen Ablauf zum Frauentreff musste Alwin unter Mehr → Verwaltung die Einstellung „Termine
 * ohne Ablauf“ umstellen – für die ganze Gemeinde. Jetzt wählt jede Person in der Terminliste selbst, je Kalender:
 * - **zeigen** (Häkchen): Termine aus diesem Kalender stehen in der Liste – ohne Häkchen auch die mit Ablauf nicht;
 * - **auch ohne Ablauf** (eingerückt): dazu die Termine, die noch keinen Ablauf haben, mit „Anlegen“. Nur in
 *   Kalendern, in denen man Abläufe anlegen darf (`darfAblaufImKalender`).
 *
 * Gemerkt auf dem Gerät (`devicePrefs`), einen Gemeinde-Standard gibt es nicht mehr. Wer noch nichts gewählt hat,
 * startet mit dem, was die Verwaltung früher für alle eingestellt hatte (`SiteConfig.ablaufAnlegen`), damit nach dem
 * Update niemandem die Gottesdienste ohne Ablauf verschwinden.
 */
import type { AblaufAnlegenRegel, Kalender, Service } from '@shared/types/index';
import { kalenderIdsAus, kalenderSichtbar, kalenderZumFiltern } from '@shared/ct/kalenderFilter';

export interface KalenderFilter {
  /** Ausgeblendete Kalender – ihre Termine stehen gar nicht in der Liste. */
  aus: number[];
  /** Kalender, aus denen auch Termine ohne Ablauf kommen. */
  ohneAblauf: number[];
}

/** Ein Kalender, wie ihn der Filter zeigt. */
export interface FilterKalender {
  id: number;
  name: string;
  /** Darf man hier Abläufe anlegen? Nur dann gibt es „auch ohne Ablauf“. */
  ohneAblaufMoeglich: boolean;
}

/** Ein gespeicherter Filter, geprüft – `null`, wenn er nicht die erwartete Form hat. */
export function kalenderFilterAus(roh: unknown): KalenderFilter | null {
  if (typeof roh !== 'object' || roh === null) return null;
  const r = roh as Record<string, unknown>;
  if (!Array.isArray(r.aus) || !Array.isArray(r.ohneAblauf)) return null;
  return { aus: kalenderIdsAus(r.aus), ohneAblauf: kalenderIdsAus(r.ohneAblauf) };
}

/** Solange nichts gemerkt ist: nichts ausgeblendet, „auch ohne Ablauf“ wie früher in der Verwaltung eingestellt. */
export function startFilter(frueher: AblaufAnlegenRegel | undefined): KalenderFilter {
  return { aus: [], ohneAblauf: kalenderIdsAus(frueher?.kalenderIds) };
}

/** Steht dieser Termin in der Liste? Ein Termin ohne bekannten Kalender (ältere Server) immer – `kalenderSichtbar`. */
export function terminSichtbar(s: Service, filter: KalenderFilter): boolean {
  return kalenderSichtbar(s.kalenderId, filter.aus);
}

/**
 * Aus welchen Kalendern Termine ohne Ablauf geholt werden: gewählt, nicht ausgeblendet und mit dem Recht dazu – sortiert,
 * damit dieselbe Wahl dieselbe Abfrage ist.
 */
export function kalenderOhneAblauf(
  filter: KalenderFilter,
  darfImKalender: (id: number) => boolean,
): number[] {
  return filter.ohneAblauf
    .filter((id) => !filter.aus.includes(id) && darfImKalender(id))
    .sort((a, b) => a - b);
}

/**
 * Welche Kalender im Filter stehen: die der Termine in der Liste, die, in denen man Abläufe anlegen darf, und die
 * ausgeblendeten (sonst ließe sich ein Kalender ohne sichtbaren Termin nie wieder einschalten). Namen aus ChurchTools;
 * fehlen sie (offline, noch nicht geladen), steht die Nummer da.
 */
export function kalenderImFilter(
  termine: readonly Service[],
  alleKalender: readonly Kalender[] | undefined,
  filter: KalenderFilter,
  darfImKalender: (id: number) => boolean,
): FilterKalender[] {
  const namen = new Map((alleKalender ?? []).map((k) => [k.id, k.name]));
  return kalenderZumFiltern(
    [
      ...termine.flatMap((s) => (s.kalenderId === undefined ? [] : [s.kalenderId])),
      ...(alleKalender ?? []).filter((k) => darfImKalender(k.id)).map((k) => k.id),
    ],
    (id) => namen.get(id),
    filter.aus,
  ).map((k) => ({ ...k, ohneAblaufMoeglich: darfImKalender(k.id) }));
}

/** Kalender ein- oder ausblenden. */
export function kalenderUmschalten(filter: KalenderFilter, aus: number[]): KalenderFilter {
  return { ...filter, aus: [...new Set(aus)] };
}

/** „auch ohne Ablauf“ für einen Kalender umschalten. */
export function ohneAblaufUmschalten(filter: KalenderFilter, id: number): KalenderFilter {
  return {
    ...filter,
    ohneAblauf: filter.ohneAblauf.includes(id)
      ? filter.ohneAblauf.filter((x) => x !== id)
      : [...filter.ohneAblauf, id],
  };
}
