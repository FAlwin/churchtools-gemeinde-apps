/**
 * **Einen Ablaufpunkt in einen anderen Termin übertragen** – verschieben oder kopieren (Bauplan E6-6b, Entwurf
 * `e6-6-entwurf-2.html` Bild 3, abgenommen 28.10.2026). ChurchTools kennt kein „verschieben“; gemessen E6-6-0
 * (23.10.2026): Merkzettel wie beim Löschen → im Ziel anlegen (`punktWiederherstellen` liest nach, sortiert an die
 * Stelle, setzt den Vorlauf) → **erst dann** im alten Termin löschen. So geht nie ein Punkt verloren: Scheitert das
 * Anlegen, ist im alten Termin nichts passiert; scheitert nur das Löschen, steht er doppelt da – und die Meldung sagt
 * es.
 *
 * „Rückgängig“ (Alwin, 29.10.2026: wie beim Löschen) nimmt es in derselben Reihenfolge zurück: erst im alten Termin
 * wieder anlegen, dann die Kopie im Ziel löschen.
 */
import {
  ABLAUF_ABGESCHLOSSEN,
  merkzettelAus,
  punktLoeschen,
  punktWiederherstellen,
  type CtSchreiber,
  type GeloeschterPunkt,
} from './schreibKern';
import { verbundeneTermine } from './ablaufNeu';
import type { CtAgenda } from './typen';

export type UebertragArt = 'verschieben' | 'kopieren';

/** Wo der Punkt im Ziel landet: hinter `nachId` (`null` = ganz vorne), im Vorlauf oder nicht. */
export interface Ablage {
  nachId: number | null;
  vorBeginn: boolean;
}

/** Was „Rückgängig“ braucht. */
export interface Uebertragen {
  art: UebertragArt;
  quelleId: number;
  zielId: number;
  /** Der neue Punkt im Ziel. */
  neuId: number;
  /** Beim Verschieben: der Punkt, wie er im alten Termin stand (Stelle, Vorlauf, Auge); beim Kopieren `null`. */
  zurueck: GeloeschterPunkt | null;
}

export const PUNKT_FEHLT =
  'Diesen Punkt gibt es im alten Termin nicht mehr. Der Ablauf ist neu geladen.';
export const ABLAUF_GETEILT =
  'Beide Termine teilen sich denselben Ablauf – der Punkt steht dort schon.';

/** Die Meldung, wenn nach dem Anlegen im Ziel das Löschen im alten Termin scheitert. */
export function nichtGeloescht(titel: string): string {
  return `„${titel}“ steht jetzt in beiden Terminen: Im neuen ist er angelegt, im alten ließ er sich nicht löschen. Bitte dort von Hand löschen.`;
}

/** Die Meldung, wenn „Rückgängig“ nach dem Zurückholen die Kopie im Ziel nicht löschen kann. */
export function kopieBleibt(titel: string): string {
  return `„${titel}“ steht wieder im alten Termin, im neuen ließ er sich nicht löschen. Bitte dort von Hand löschen.`;
}

/**
 * Teilen sich die beiden Termine **einen** Ablauf? Dann wäre „verschieben“ nur ein Umsortieren – die Matrix bietet das
 * Ablegen dort nicht an (Entwurf E6-6 Bild 3). Erkennbar an derselben Ablauf-ID oder an den `startTimes`-Schlüsseln
 * (`verbundeneTermine`, dieselbe Regel wie „Neu aufsetzen“). Eine Stelle für Matrix und Kern.
 */
export function teilenAblauf(
  quelle: CtAgenda,
  quelleId: number,
  ziel: CtAgenda,
  zielId: number,
): boolean {
  if (quelle.id !== undefined && quelle.id === ziel.id) return true;
  return verbundeneTermine(quelle, quelleId).includes(zielId);
}

function statusVon(e: unknown): number {
  const status = (e as { status?: unknown } | null)?.status;
  return typeof status === 'number' ? status : 500;
}

/**
 * Überträgt Punkt `itemId` aus Termin `quelleId` nach Termin `zielId`. Beide Abläufe werden **frisch** gelesen – der
 * Stand des Geräts kann veraltet sein. Abgeschlossen (Ziel, beim Verschieben auch die Quelle) → 423, bevor irgendetwas
 * geschrieben wird; geteilt → 409; Punkt inzwischen weg → 404.
 */
export async function punktUebertragen(
  s: CtSchreiber,
  art: UebertragArt,
  quelleId: number,
  itemId: number,
  zielId: number,
  ablage: Ablage,
): Promise<Uebertragen> {
  const quelle = await s.agenda(quelleId);
  const zettel = merkzettelAus(quelle, quelleId, itemId);
  if (!zettel) throw s.fehler(404, PUNKT_FEHLT);
  const ziel = await s.agenda(zielId);
  if (teilenAblauf(quelle, quelleId, ziel, zielId)) throw s.fehler(409, ABLAUF_GETEILT);
  // Vorher prüfen: Erst nach dem Anlegen am Abschluss der Quelle zu scheitern, ließe den Punkt doppelt stehen.
  if (ziel.isLocked || (art === 'verschieben' && quelle.isLocked)) {
    throw s.fehler(423, ABLAUF_ABGESCHLOSSEN);
  }

  // Das Auge gilt je Termin (gemessen E6-6-0): Im Ziel steht der Punkt sichtbar.
  const neuId = await punktWiederherstellen(s, zielId, {
    ...zettel,
    nachId: ablage.nachId,
    vorBeginn: ablage.vorBeginn,
    weggelassen: false,
  });
  if (art === 'kopieren') return { art, quelleId, zielId, neuId, zurueck: null };

  let zurueck: GeloeschterPunkt | null;
  try {
    zurueck = await punktLoeschen(s, quelleId, itemId);
  } catch (e) {
    throw s.fehler(statusVon(e), nichtGeloescht(zettel.felder.title));
  }
  return { art, quelleId, zielId, neuId, zurueck };
}

/**
 * „Rückgängig“: beim Verschieben erst im alten Termin an der alten Stelle wieder anlegen, **dann** im Ziel löschen;
 * beim Kopieren nur die Kopie löschen. Scheitert das Zurückholen, bleibt der Punkt im Ziel stehen.
 */
export async function uebertragenZuruecknehmen(
  s: CtSchreiber,
  u: Uebertragen,
  titel: string,
): Promise<void> {
  if (!u.zurueck) {
    await punktLoeschen(s, u.zielId, u.neuId);
    return;
  }
  await punktWiederherstellen(s, u.quelleId, u.zurueck);
  try {
    await punktLoeschen(s, u.zielId, u.neuId);
  } catch (e) {
    throw s.fehler(statusVon(e), kopieBleibt(titel));
  }
}
