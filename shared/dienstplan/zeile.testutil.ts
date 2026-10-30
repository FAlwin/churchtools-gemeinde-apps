import type { TerminZeile } from './termine';
import type { Plan } from './plan';

/**
 * Eine Terminzeile für Tests – alle Felder mit ruhigen Vorgaben, `extra` überschreibt. Eine Stelle für
 * alle Tests des Dienstplaners, damit ein neues Feld nicht in jedem Test nachgetragen werden muss.
 */
export function zeile(
  id: number,
  name: string,
  tag: string,
  extra: Partial<TerminZeile> = {},
): TerminZeile {
  return {
    id,
    name,
    beginn: `${tag}T08:00:00Z`,
    ende: `${tag}T09:30:00Z`,
    tag,
    uhrzeit: '10:00',
    abgesagt: false,
    meine: [],
    geplant: 0,
    frei: 0,
    freiNachGruppe: {},
    team: [],
    ...extra,
  };
}

/** Ein leerer Plan – für Tests, die nur die Liste brauchen. */
export const LEERER_PLAN: Plan = { spalten: [], gruppen: [] };
