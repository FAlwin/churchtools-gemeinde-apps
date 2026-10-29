/**
 * **Was unter dem Namen einer Gruppe steht** (O7b-6) – EINE Regel für die Kästchen im Diagramm und die Zeilen der Liste.
 * Die Rollen kommen aus `kastenRollen`; hier kommt nur die Sichtregel dazu, dieselbe wie in der Präsentation: Wo
 * ChurchTools die Mitglieder nicht zeigt, steht „Mitglieder nicht sichtbar“ – ehrlich statt leer. Eine Gruppe ohne
 * sichtbare Mitglieder (oft eine Obergruppe) zeigt nichts, ebenso alles, solange die Mitglieder noch laden.
 */
import type { Rolle } from '@shared/organigramm/mitglieder';
import { kastenRollen, type PersonenWahl, type RollenGruppe } from '@shared/organigramm/personen';
import type { MitgliederDaten, MitgliederStand } from './ladeMitglieder';

export type KastenInhalt =
  | { art: 'rollen'; gruppen: RollenGruppe[] }
  | { art: 'hinweis'; text: string };

export function kastenInhalt(
  stand: MitgliederStand | undefined,
  wahl: PersonenWahl,
  rollen: ReadonlyMap<number, Rolle>,
  name: (personId: number) => string,
): KastenInhalt | null {
  if (wahl === 'aus' || !stand) return null;
  if (stand.art === 'verborgen') return { art: 'hinweis', text: 'Mitglieder nicht sichtbar' };
  if (stand.art === 'fehler') return { art: 'hinweis', text: 'Mitglieder gerade nicht ladbar' };
  const gruppen = kastenRollen(stand.mitglieder, rollen, name, wahl);
  return gruppen.length ? { art: 'rollen', gruppen } : null;
}

/**
 * Was unter dem Namen JEDER Gruppe steht – EINE Stelle für Reiter, Präsentation und PDF (O7b-6b). Neu rechnen, wenn sich
 * Mitglieder, Rollen oder Wahl ändern (die Kästchen werden dann neu gemessen).
 */
export function personenInhalt(
  mitglieder: MitgliederDaten | null,
  rollen: ReadonlyMap<number, Rolle>,
  wahl: PersonenWahl,
): (id: number) => KastenInhalt | null {
  const name = (p: number) => mitglieder?.personen.get(p)?.name ?? '';
  return (id) => kastenInhalt(mitglieder?.je.get(id), wahl, rollen, name);
}

/**
 * Das Häkchen „Personen“ im PDF (Alwin, 29.10.2026): zeigt die Stufe aus dem Reiter – steht der auf „Aus“, die Rollen.
 */
export const pdfPersonenWahl = (reiter: PersonenWahl): Exclude<PersonenWahl, 'aus'> =>
  reiter === 'aus' ? 'rollen' : reiter;
