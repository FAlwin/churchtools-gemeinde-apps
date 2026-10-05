import type { AgendaItem } from '@shared/types/index';
import type { AgendaItemUpdate } from '../services/churchtoolsApi';

/**
 * Vorgemerkte Lied-Verknüpfung: Im Bearbeiten-Dialog wird NICHTS sofort geschrieben – auch
 * Verknüpfen und Aufheben warten auf „Speichern".
 */
export type LinkState =
  | { kind: 'keep' }
  | { kind: 'unlink' }
  | { kind: 'link'; arrangementId: number; name: string };

/** Der Bearbeitungsstand des Dialogs (Rohwerte aus den Eingabefeldern). */
export interface AgendaItemDraft {
  title: string;
  /** Rohtext des Dauer-Feldes – leer bedeutet „keine Angabe". */
  duration: string;
  responsible: string;
  note: string;
  link: LinkState;
}

/**
 * Was der Bearbeiten-Dialog beim Speichern schreiben würde (#215, vorher in `ItemActionSheet`).
 *
 * Warum ausgelagert: Die Regeln hier sind Geschäftslogik, keine Darstellung – und mindestens zwei
 * davon sind alles andere als offensichtlich (leeres Dauer-Feld → `0`, leerer Titel wird gar nicht
 * geschrieben). In der Komponente liefen sie zudem bei **jedem Render** und waren nicht prüfbar.
 */
export function pendingAgendaFields(item: AgendaItem, draft: AgendaItemDraft): AgendaItemUpdate {
  const fields: AgendaItemUpdate = {};
  if (draft.link.kind === 'link') fields.arrangementId = draft.link.arrangementId;
  if (draft.link.kind === 'unlink') fields.unlink = true;
  // Titel gilt für ALLE Punkte – auch für Lieder (#200): ChurchTools führt den Titel des
  // Ablaufpunkts unabhängig vom verknüpften Lied und zeigt beides an. Ein leerer Titel wird
  // NICHT geschrieben (ChurchTools braucht eine Bezeichnung).
  const title = draft.title.trim();
  if (title && title !== item.title) fields.title = title;

  const duration = durationTarget(draft.duration, item.durationMin);
  if (duration !== undefined) fields.durationMin = duration;

  if (draft.responsible !== item.responsibleText) fields.responsible = draft.responsible.trim();
  if (draft.note !== item.note) fields.note = draft.note.trim();
  return fields;
}

/** Ist die eingegebene Dauer verwendbar? (Leer = „keine Angabe" und damit gültig.) */
export function isDurationValid(raw: string): boolean {
  if (raw.trim() === '') return true;
  const n = Number(raw);
  return Number.isInteger(n) && n >= 0;
}

/**
 * Die zu schreibende Dauer – oder `undefined`, wenn sich nichts geändert hat.
 *
 * Das Leeren des Feldes bedeutet „Dauer entfernen" und wird als **0** geschrieben: ChurchTools
 * kennt kein „keine Dauer", 0 Minuten blendet sie faktisch aus. Stand vorher schon keine Dauer
 * (oder bereits 0) im Punkt, wird nichts geschrieben.
 */
export function durationTarget(raw: string, current: number | null): number | undefined {
  if (!isDurationValid(raw)) return undefined;
  if (raw.trim() !== '') {
    const n = Number(raw);
    return n !== current ? n : undefined;
  }
  return current != null && current !== 0 ? 0 : undefined;
}

/** Was der Dialog „Neuer Eintrag" anlegt (Alwin, 05.10.2026: derselbe Dialog wie Bearbeiten). */
export type PunktArt = 'lied' | 'text' | 'ueberschrift';

/** Ein neuer Ablaufpunkt, wie ihn `POST …/agenda/items` des eigenen Servers annimmt. */
export interface NeuerAgendaPunkt {
  type: 'header' | 'text' | 'song';
  title?: string;
  arrangementId?: number;
  responsible?: string;
  note?: string;
  /** Dauer in Minuten (UI-Einheit); der Server rechnet in ChurchTools-Sekunden um. */
  durationMin?: number;
}

/**
 * Der neue Punkt aus dem Dialog – oder `null`, solange er nicht angelegt werden kann.
 *
 * - **Lied:** braucht ein gewähltes Lied. Ohne eigenen Titel heißt der Punkt wie das Lied – so war
 *   es auch im alten „Lied hinzufügen".
 * - **Text:** braucht einen Titel.
 * - **Überschrift:** nur der Titel; Dauer, Zuständige und Notiz kennt eine Überschrift nicht.
 *
 * Leere Felder werden **weggelassen**, nicht als `""` geschickt: ChurchTools soll seine Vorgaben
 * behalten. Eine ungültige Dauer macht den Punkt ungültig, statt still verloren zu gehen.
 */
export function neuerAgendaPunkt(art: PunktArt, draft: AgendaItemDraft): NeuerAgendaPunkt | null {
  const title = draft.title.trim();
  if (!isDurationValid(draft.duration)) return null;
  if (art === 'ueberschrift') return title ? { type: 'header', title } : null;

  const punkt: NeuerAgendaPunkt = { type: art === 'lied' ? 'song' : 'text' };
  if (art === 'lied') {
    if (draft.link.kind !== 'link') return null;
    punkt.arrangementId = draft.link.arrangementId;
    punkt.title = title || draft.link.name;
  } else {
    if (!title) return null;
    punkt.title = title;
  }
  const dauer = draft.duration.trim();
  if (dauer !== '') punkt.durationMin = Number(dauer);
  if (draft.responsible.trim()) punkt.responsible = draft.responsible.trim();
  if (draft.note.trim()) punkt.note = draft.note.trim();
  return punkt;
}
