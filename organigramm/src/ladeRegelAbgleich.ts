/**
 * **Abgleich der Regeln in ChurchTools mit „eingetragen bis“** (Bauplan O9-4, nur für Admins): je Wechsel-Gruppe die
 * Regel-Liste lesen (`GET /dynamicgroups/{id}/ruleset`, gemessen 16.11.2026 als Admin; wer „Berechtigungen verwalten“
 * nicht hat, bekommt 403 – für ihn wird deshalb gar nicht erst gefragt) und mit dem vergleichen, was `kinderFenster`
 * für diese Jahre erzeugt (`regelAbweichungen`).
 *
 * Abgemeldet (401) wirft – das gilt für die ganze Seite. **Vorübergehend ist nicht ungültig:** Jeder andere Fehler
 * (Netz, 502, 403) heißt „ließ sich gerade nicht prüfen“ – nichts wird geändert, gelöscht oder als Abweichung verbucht.
 */
import { ctDaten } from '@ui/ct/verbindung';
import { ApiError } from '@ui/ct/fehler';
import {
  uebergaenge,
  wechselGruppenName,
  type Wechseljahr,
} from '@shared/organigramm/gruppenwechsel';
import { wechselGruppeAb, type Einrichtung } from '@shared/organigramm/gruppenwechselEinrichtung';
import { regelAbweichungen, type RegelAbweichung } from '@shared/organigramm/wechseltage';

export interface RegelAbgleich {
  abweichungen: RegelAbweichung[];
  /** Die Übergänge, deren Regeln sich nicht lesen ließen („Fische → Jungschar“). */
  nichtPruefbar: string[];
}

export async function ladeRegelAbgleich(
  e: Einrichtung,
  /** Die Jahre, die geprüft werden: das aktuelle Wechseljahr und alle späteren, die der Ferienkalender kennt. */
  jahre: readonly Wechseljahr[],
  eingetragenBis: number,
  holen: <T>(pfad: string) => Promise<T> = ctDaten,
): Promise<RegelAbgleich> {
  const aus: RegelAbgleich = { abweichungen: [], nichtPruefbar: [] };
  await Promise.all(
    uebergaenge(e.einstellung).map(async (u) => {
      const w = wechselGruppeAb(e, u.von.gruppeId);
      // Ohne Wechsel-Gruppe gibt es für diesen Übergang keine Regeln, die stimmen könnten oder nicht.
      if (!w) return;
      try {
        const regeln = await holen<unknown>(`/dynamicgroups/${w.gruppeId}/ruleset`);
        // Gar keine Antwort ist kein „leere Regel-Liste“ – sonst stünde bei jedem Aussetzer „fehlt“ da.
        if (regeln === null || regeln === undefined) {
          aus.nichtPruefbar.push(wechselGruppenName(u));
          return;
        }
        aus.abweichungen.push(...regelAbweichungen(u, w.gruppeId, jahre, eingetragenBis, regeln));
      } catch (x) {
        if (x instanceof ApiError && x.status === 401) throw x;
        aus.nichtPruefbar.push(wechselGruppenName(u));
      }
    }),
  );
  // Reihenfolge der Antworten ist Zufall – in der Reihenfolge der Übergänge anzeigen.
  const reihenfolge = uebergaenge(e.einstellung).map(wechselGruppenName);
  aus.abweichungen.sort(
    (a, b) =>
      reihenfolge.indexOf(a.uebergang) - reihenfolge.indexOf(b.uebergang) || a.jahr - b.jahr,
  );
  aus.nichtPruefbar.sort((a, b) => reihenfolge.indexOf(a) - reihenfolge.indexOf(b));
  return aus;
}
