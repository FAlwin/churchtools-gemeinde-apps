/**
 * **Was unter dem Namen einer Gruppe steht** (O7b-6) – EINE Regel für die Kästchen im Diagramm und die Zeilen der Liste.
 * Die Rollen kommen aus `kastenRollen`; hier kommt nur die Sichtregel dazu, dieselbe wie in der Präsentation: Wo
 * ChurchTools die Mitglieder nicht zeigt, steht „Mitglieder nicht sichtbar“ – ehrlich statt leer. Eine Gruppe ohne
 * sichtbare Mitglieder (oft eine Obergruppe) zeigt nichts, ebenso alles, solange die Mitglieder noch laden.
 */
import type { Rolle } from '@shared/organigramm/mitglieder';
import {
  hoechstens,
  kastenRollen,
  OHNE_GRENZE,
  type PersonenGrenze,
  type PersonenStufe,
  type PersonenWahl,
  type RollenGruppe,
  type RollenWahl,
} from '@shared/organigramm/personen';
import type { MitgliederDaten, MitgliederStand } from './ladeMitglieder';

export type KastenInhalt =
  /** `ausgeblendet`: was der Rollenfilter wegnimmt – steht klein darunter (#915, Alwin 12.11.2026). */
  | { art: 'rollen'; gruppen: RollenGruppe[]; ausgeblendet?: string }
  | { art: 'hinweis'; text: string };

/** „Mitarbeiter (6), Teilnehmer (2) ausgeblendet“ – die abgewählten Rollen dieser Gruppe mit ihrer Zahl. */
const ausgeblendetText = (weg: readonly RollenGruppe[]) =>
  `${weg.map((g) => `${g.rolle} (${g.namen.length})`).join(', ')} ausgeblendet`;

export function kastenInhalt(
  stand: MitgliederStand | undefined,
  wahl: PersonenStufe,
  rollen: ReadonlyMap<number, Rolle>,
  name: (personId: number) => string,
  aus: ReadonlySet<string> = new Set(),
): KastenInhalt | null {
  if (wahl === 'aus' || !stand) return null;
  if (stand.art === 'verborgen') return { art: 'hinweis', text: 'Mitglieder nicht sichtbar' };
  if (stand.art === 'fehler') return { art: 'hinweis', text: 'Mitglieder gerade nicht ladbar' };
  const alle = kastenRollen(stand.mitglieder, rollen, name, wahl);
  const gruppen = alle.filter((g) => !aus.has(g.rolle));
  const weg = alle.filter((g) => aus.has(g.rolle));
  if (!weg.length) return gruppen.length ? { art: 'rollen', gruppen } : null;
  // Ist alles abgewählt, bleibt nur der Hinweis – sonst stünde die Gruppe da, als hätte sie niemanden.
  return gruppen.length
    ? { art: 'rollen', gruppen, ausgeblendet: ausgeblendetText(weg) }
    : { art: 'hinweis', text: ausgeblendetText(weg) };
}

/**
 * Was unter dem Namen JEDER Gruppe steht – EINE Stelle für Reiter, Präsentation und PDF (O7b-6b). Neu rechnen, wenn sich
 * Mitglieder, Rollen, Wahl oder Grenze ändern (die Kästchen werden dann neu gemessen). Die eigene Wahl gilt höchstens
 * so weit, wie die Grenze der Gruppe reicht (#915 C).
 */
export function personenInhalt(
  mitglieder: MitgliederDaten | null,
  rollen: ReadonlyMap<number, Rolle>,
  wahl: PersonenWahl,
  aus?: ReadonlySet<string>,
  grenze: PersonenGrenze = OHNE_GRENZE,
): (id: number) => KastenInhalt | null {
  const name = (p: number) => mitglieder?.personen.get(p)?.name ?? '';
  return (id) =>
    kastenInhalt(mitglieder?.je.get(id), hoechstens(wahl, grenze(id)), rollen, name, aus);
}

/**
 * Das Häkchen „Personen“ im PDF (Alwin, 29.10.2026): zeigt die Stufe aus dem Reiter – steht der auf „Aus“, die Rollen.
 */
export const pdfPersonenWahl = (reiter: PersonenWahl): Exclude<PersonenWahl, 'aus'> =>
  reiter === 'aus' ? 'rollen' : reiter;

/** „Alle“ oder „3 von 5“ auf dem Knopf „Welche Rollen“ – gezählt nur die Rollen, die gerade angeboten werden. */
export function rollenKnopfText(rollen: readonly RollenWahl[], aus: ReadonlySet<string>): string {
  const gezeigt = rollen.filter((r) => !aus.has(r.name)).length;
  return gezeigt === rollen.length ? 'Alle' : `${gezeigt} von ${rollen.length}`;
}

/** „Welche Rollen“ (#915) – was Reiter, Präsentation und PDF dafür brauchen. */
export interface RollenFilter {
  /** Die Rollen zum Anhaken (`rollenZurWahl`). */
  rollen: readonly RollenWahl[];
  /** Die abgewählten Rollennamen – leer heißt alle. */
  aus: ReadonlySet<string>;
  onAus: (aus: Set<string>) => void;
}
