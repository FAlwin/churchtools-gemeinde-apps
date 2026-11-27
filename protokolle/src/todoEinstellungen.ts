/**
 * **Die Einstellungen der To-Do-Übersicht** (S7-1, S7-3) – Ansicht (Liste | Board), Einteilung (Status | Person | Fälligkeit),
 * Filter, Sortierung und meine Reihenfolge („Manuell“). Eine Stelle für alle, damit sie zusammen gemerkt werden
 * (Alwin 30.10.2026: „alles je Benutzer“). Prüfen, was gelesen wird: Gemerktes kann von Hand verändert sein.
 */
import { texte } from '@ui/bedienung/geraet';
import type { Ansicht, Einteilung, Sortierung } from '@shared/protokolle/uebersicht';

export interface Aus {
  gruppen: string[];
  zustaendig: string[];
}

export interface ToDoEinstellungen {
  ansicht: Ansicht;
  nach: Einteilung;
  aus: Aus;
  sortierung: Sortierung;
  /** Meine Reihenfolge (Schlüssel `gruppe:id`), über alle Spalten – nur bei „Manuell“ benutzt. */
  reihenfolge: string[];
  /**
   * Gruppen, die der Reiter „Sitzungen“ in „Alle Gruppen“ ausblendet (Gruppen-IDs als Text). Eine **eigene** Einstellung –
   * nicht `aus.gruppen` der To-Dos (Alwin 27.11.2026). Liegt in derselben Personen-Datei, damit sie auf allen Geräten gilt.
   */
  sitzungenAus: string[];
}

export const VORGABE: ToDoEinstellungen = {
  ansicht: 'liste',
  nach: 'status',
  aus: { gruppen: [], zustaendig: [] },
  sortierung: 'dringlichkeit',
  reihenfolge: [],
  sitzungenAus: [],
};

const SORTIERUNGEN: readonly Sortierung[] = ['dringlichkeit', 'bis', 'alpha', 'manuell'];

/** Je Feld prüfen; Unlesbares → Vorgabe dieses Felds (ein kaputtes Feld kostet nicht die anderen). */
export const pruefen: { [K in keyof ToDoEinstellungen]: (roh: unknown) => ToDoEinstellungen[K] } = {
  ansicht: (x) => (x === 'board' ? 'board' : 'liste'),
  nach: (x) => (x === 'person' || x === 'frist' ? x : 'status'),
  aus: (x) => {
    const o = (x ?? {}) as Record<string, unknown>;
    return { gruppen: texte(o.gruppen), zustaendig: texte(o.zustaendig) };
  },
  sortierung: (x) => (SORTIERUNGEN.includes(x as Sortierung) ? (x as Sortierung) : 'dringlichkeit'),
  // Höchstens 2000 Einträge – eine Reihenfolge, die endlos wächst, gehört nicht in die Datei.
  reihenfolge: (x) => texte(x).slice(-2000),
  sitzungenAus: (x) => texte(x),
};
