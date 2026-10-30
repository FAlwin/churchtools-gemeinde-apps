/** Die Regel zum Ziehen in der To-Do-Übersicht (S7-3) – rein, ohne Oberfläche; benutzt von `ToDoZiehen.tsx`. */
import { arrayMove } from '@dnd-kit/sortable';

/**
 * Was eine Karte bzw. Spalte beim Ziehen über sich weiß. Eine Karte trägt ihren To-Do-Schlüssel in `karte` – nicht in
 * der Zieh-Kennung: Ein To-Do mit zwei Zuständigen steht **nach Person in zwei Spalten**; mit derselben Kennung hielt das
 * Ziehen die Karte in Alwins Spalte für die in Spikes, und Umordnen trug Spike aus (Test-Instanz 30.10.2026).
 */
export interface Daten {
  art: 'karte' | 'spalte';
  spalte: string;
  karte?: string;
}

/** Die Zieh-Kennung einer Karte – je Spalte eindeutig. */
export const ziehId = (spalte: string, karte: string): string => `${spalte}|${karte}`;

/** Was beim Loslassen geschieht – rein, damit es ohne Zieh-Simulation prüfbar ist. */
export type Loslassen =
  | { art: 'ablegen'; karte: string; von: string; nach: string }
  | { art: 'umordnen'; spalte: string; karte: string; vor: string | null }
  | null;

export function loslassen(q: {
  /** Die gezogene Karte. */
  von: Daten | null;
  /** Worüber losgelassen wurde – eine Karte oder eine Spalte. */
  ueber: Daten | null;
  zwischen: boolean;
  manuell: boolean;
  spalten: ReadonlyMap<string, readonly string[]>;
}): Loslassen {
  const { von, ueber } = q;
  const karte = von?.karte;
  if (!von || !karte || !ueber) return null;
  if (ueber.spalte !== von.spalte)
    return q.zwischen ? { art: 'ablegen', karte, von: von.spalte, nach: ueber.spalte } : null;
  if (!q.manuell || ueber.art !== 'karte' || !ueber.karte || ueber.karte === karte) return null;
  const reihe = [...(q.spalten.get(von.spalte) ?? [])];
  if (!reihe.includes(karte) || !reihe.includes(ueber.karte)) return null;
  const neu = arrayMove(reihe, reihe.indexOf(karte), reihe.indexOf(ueber.karte));
  return { art: 'umordnen', spalte: von.spalte, karte, vor: neu[neu.indexOf(karte) + 1] ?? null };
}
