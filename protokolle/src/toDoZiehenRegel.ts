/** Die Regel zum Ziehen in der To-Do-Übersicht (S7-3) – rein, ohne Oberfläche; benutzt von `ToDoZiehen.tsx`. */
import { arrayMove } from '@dnd-kit/sortable';

/** Was eine Karte bzw. Spalte beim Ziehen über sich weiß. */
export interface Daten {
  art: 'karte' | 'spalte';
  spalte: string;
}

/** Was beim Loslassen geschieht – rein, damit es ohne Zieh-Simulation prüfbar ist. */
export type Loslassen =
  | { art: 'ablegen'; karte: string; von: string; nach: string }
  | { art: 'umordnen'; spalte: string; karte: string; vor: string | null }
  | null;

export function loslassen(q: {
  karte: string;
  von: Daten | null;
  ueber: Daten | null;
  /** Die ID dessen, worüber losgelassen wurde (Karte oder `spalte:…`). */
  ueberId: string | null;
  zwischen: boolean;
  manuell: boolean;
  spalten: ReadonlyMap<string, readonly string[]>;
}): Loslassen {
  const { karte, von, ueber, ueberId } = q;
  if (!von || !ueber || ueberId === null) return null;
  if (ueber.spalte !== von.spalte)
    return q.zwischen ? { art: 'ablegen', karte, von: von.spalte, nach: ueber.spalte } : null;
  if (!q.manuell || ueber.art !== 'karte' || ueberId === karte) return null;
  const reihe = [...(q.spalten.get(von.spalte) ?? [])];
  if (!reihe.includes(karte) || !reihe.includes(ueberId)) return null;
  const neu = arrayMove(reihe, reihe.indexOf(karte), reihe.indexOf(ueberId));
  return { art: 'umordnen', spalte: von.spalte, karte, vor: neu[neu.indexOf(karte) + 1] ?? null };
}
