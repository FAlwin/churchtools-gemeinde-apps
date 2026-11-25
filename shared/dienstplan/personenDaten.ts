/**
 * **Was die Ansicht „Personen“ von ChurchTools braucht** (Wunsch 5, Scheibe P1) – nur das Auswerten, geholt wird beim
 * Aufrufer (`dienstplaner/src/ladePersonen.ts`). Gemessen 13.11.2026 (Live, nur lesen, P0):
 *
 * - `GET /groups/{id}/members` – Mitglieder je CT-Gruppe eines Dienstes (`Dienst.gruppenIds`); ausgewertet mit
 *   `mitgliederAus` wie im Organigramm (nur aktive, nicht beendete).
 * - `GET /groups/{id}/absences?from&to` – die Abwesenheiten **aller Mitglieder** einer Gruppe in einer Abfrage; auch
 *   solche, die vor `from` beginnen. Felder `id`, `person{domainIdentifier}`, `absenceReason`, `startDate`, `startTime`,
 *   `endDate`, `endTime`.
 * - **Recht:** Gruppen-Abwesenheiten sieht, wer global `churchservice['manage absent']` hat (`DienstRechte.
 *   abwesenheitenAller`) **oder** in der Gruppe `churchservice['+view absence']` (`/permissions/internal/groups`).
 *   Ohne Recht liefert ChurchTools still eine **leere** Liste – deshalb wird das Recht vorher geprüft und „nicht
 *   sichtbar“ gesagt statt leerer Zellen.
 */
import { ctId } from '../ct/ctId';
import { gruppenMitRecht } from '../ct/gruppenRechteListe';
import type { Dienst } from '../ct/dienste';
import type { Person } from '../organigramm/mitglieder';

/** Eine Abwesenheit eines Mitglieds – nur, was die Ansicht braucht. */
export interface GruppenAbwesenheit {
  id: number;
  personId: number;
  /** `absenceReason.nameTranslated` (ChurchTools liefert es deutsch), `null` ohne Grund. */
  grund: string | null;
  startDate: string;
  endDate: string;
  startTime: string | null;
  endTime: string | null;
}

/**
 * Was zu einer CT-Gruppe geladen ist.
 * - `da`: die Antwort ist da. `mitglieder: 'verborgen'` = 403, man darf die Mitglieder nicht sehen; `abwesenheiten:
 *   'nichtSichtbar'` = das Recht fehlt (oder 403) – beides **dauerhaft**, nichts zum Wiederholen.
 * - `fehler`: vorübergehend (Netz, Zeitüberschreitung, 5xx, gebremst) – `nochmal` sagt, ob „Nochmal versuchen“ lohnt.
 */
export type GruppenStand =
  | {
      art: 'da';
      mitglieder: Person[] | 'verborgen';
      abwesenheiten: GruppenAbwesenheit[] | 'nichtSichtbar';
      /**
       * Die Mitglieder mit einer Leitungs-Rolle (`Rolle.leitung`, E5c-6 „Vertretung suchen“: die Kopie geht an die Leitung) –
       * nur gesetzt, wenn der Lader die Rollen kannte (`ladePersonen` mit `rollen`); sonst fehlt es (nicht „keine Leitung“).
       */
      leitung?: number[];
    }
  | { art: 'fehler'; text: string; nochmal: boolean };

/** Je CT-Gruppen-ID. */
export type PersonenDaten = ReadonlyMap<number, GruppenStand>;

/** Die Abwesenheiten aus der rohen Antwort – Einträge ohne Person, ID oder Tage fallen weg; eine ID zählt einmal. */
export function abwesenheitenAus(roh: readonly unknown[] | null | undefined): GruppenAbwesenheit[] {
  const je = new Map<number, GruppenAbwesenheit>();
  for (const r of roh ?? []) {
    if (!r || typeof r !== 'object') continue;
    const a = r as {
      id?: unknown;
      person?: { domainIdentifier?: unknown } | null;
      absenceReason?: { nameTranslated?: unknown } | null;
      startDate?: unknown;
      endDate?: unknown;
      startTime?: unknown;
      endTime?: unknown;
    };
    const id = ctId(a.id);
    const personId = ctId(a.person?.domainIdentifier);
    if (id === null || personId === null) continue;
    if (typeof a.startDate !== 'string' || typeof a.endDate !== 'string') continue;
    const grund =
      typeof a.absenceReason?.nameTranslated === 'string'
        ? a.absenceReason.nameTranslated.trim()
        : '';
    je.set(id, {
      id,
      personId,
      grund: grund || null,
      startDate: a.startDate.slice(0, 10),
      endDate: a.endDate.slice(0, 10),
      startTime: typeof a.startTime === 'string' && a.startTime !== '' ? a.startTime : null,
      endTime: typeof a.endTime === 'string' && a.endTime !== '' ? a.endTime : null,
    });
  }
  return [...je.values()];
}

/**
 * Die CT-Gruppen, in denen man `+view absence` hat – aus `/permissions/internal/groups` (Schlüssel = Gruppen-ID, darin
 * der Block `churchservice`). Alles, was nicht ausdrücklich `true` ist, zählt als „kein Recht“.
 */
export function gruppenMitAbwesenheitsRecht(roh: unknown): Set<number> {
  return gruppenMitRecht(roh, 'churchservice', '+view absence');
}

/** Alle CT-Gruppen der Dienste, jede einmal – in der Reihenfolge, in der sie zuerst vorkommen. */
export function gruppenDerDienste(dienste: readonly Dienst[]): number[] {
  return [...new Set(dienste.flatMap((d) => d.gruppenIds))];
}
