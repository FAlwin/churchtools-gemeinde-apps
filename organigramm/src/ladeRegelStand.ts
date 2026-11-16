/**
 * **Welche Wechseltage in den Regeln von ChurchTools stehen** (Bauplan O9-4, O9-F8: die Regeln sind die einzige Quelle,
 * es gibt kein Speicher-Feld). Je Wechsel-Gruppe `GET /dynamicgroups/{id}/ruleset`, dann `jahrStaende` gegen den
 * Erzeuger. Nur für Leute mit „Berechtigungen verwalten“ – der Aufrufer fragt sonst gar nicht erst.
 *
 * Gemessen 16.11.2026 (Test-Instanz): 200 → Regel-Liste; **404 „dynamic group ruleset … not found“ = keine Regeln**
 * (kein Fehler: alle Jahre „fehlt“); wer das Recht nicht hat, bekommt **401** – **hier ist das kein „abgemeldet“**
 * (sonst würde ein Gruppen-Admin ohne das Recht abgemeldet), sondern „nicht prüfbar“. Ebenso 403, Netz und 5xx:
 * Vorübergehend ist nicht ungültig – nichts wird behauptet, nichts verändert.
 */
import { ctDaten } from '@ui/ct/verbindung';
import { ApiError } from '@ui/ct/fehler';
import { uebergaenge, type Wechseljahr } from '@shared/organigramm/gruppenwechsel';
import { wechselGruppeAb, type Einrichtung } from '@shared/organigramm/gruppenwechselEinrichtung';
import {
  jahrStaende,
  regelnReichenBis,
  type GruppenRegeln,
  type JahrStand,
} from '@shared/organigramm/wechseltage';

export type RegelStand =
  | { art: 'nichtPruefbar' }
  | {
      art: 'da';
      staende: { jahr: number; stand: JahrStand }[];
      /** Bis wohin die Regeln lückenlos reichen (ab dem nächsten Wechsel). */
      bis: number;
    };

export async function ladeRegelStand(
  e: Einrichtung,
  /** Die Jahre, die geprüft werden: das aktuelle Wechseljahr und alle späteren, die der Ferienkalender kennt. */
  jahre: readonly Wechseljahr[],
  /** Das Jahr des nächsten Wechsels (= das aktuelle Wechseljahr des Reiters). */
  naechstesJahr: number,
  holen: <T>(pfad: string) => Promise<T> = ctDaten,
): Promise<RegelStand> {
  // Ohne Wechsel-Gruppe gibt es für diesen Übergang keine Regeln, die stimmen könnten oder nicht.
  const mit = uebergaenge(e.einstellung).flatMap((u) => {
    const w = wechselGruppeAb(e, u.von.gruppeId);
    return w ? [{ u, gruppeId: w.gruppeId }] : [];
  });
  if (mit.length === 0) return { art: 'nichtPruefbar' };
  try {
    const gruppen: GruppenRegeln[] = await Promise.all(
      mit.map(async ({ u, gruppeId }) => {
        try {
          const regeln = await holen<unknown>(`/dynamicgroups/${gruppeId}/ruleset`);
          // Gar keine Antwort ist keine „leere Regel-Liste“ – sonst stünde bei jedem Aussetzer „fehlt noch“ da.
          if (regeln === null || regeln === undefined) throw new Error('keine Antwort');
          return { uebergang: u, regeln };
        } catch (x) {
          // 404 heißt: Für diese Gruppe gibt es keine Regeln.
          if (x instanceof ApiError && x.status === 404) return { uebergang: u, regeln: [] };
          throw x;
        }
      }),
    );
    const staende = jahrStaende(gruppen, jahre);
    return { art: 'da', staende, bis: regelnReichenBis(staende, naechstesJahr) };
  } catch {
    return { art: 'nichtPruefbar' };
  }
}
