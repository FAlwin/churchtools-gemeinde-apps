/**
 * **Was in ChurchTools zur Einrichtung des Gruppenwechsels steht** (Bauplan O9-5c) – nur lesen, nie schreiben. Das Urteil
 * („stimmt es?“) fällt `shared/organigramm/einrichtungStand.ts`; hier wird nur gelesen:
 *
 * - `GET /groups/{wechselGruppe}/roles` – die Rollen des Gruppentyps (Leiter, Teilnehmer),
 * - `GET /permissions/group_type_role/{rolle}` – die gruppeninternen Rechte der beiden Rollen am Typ,
 * - `GET /dynamicgroups/{id}/ruleset` und `…/status` – für Stufen und Wechsel-Gruppen,
 * - `GET /groups/{wechselGruppe}/members/routines` – die Aufräum-Routine.
 *
 * Die Rechte und die Regeln darf nur lesen, wer „Berechtigungen verwalten“ hat (O9-F8) – der Aufrufer fragt sonst gar
 * nicht erst. **Nichts davon wirft:** 401 ist hier fehlendes Recht, kein Abmelden (sonst würde ein Gruppen-Admin ohne
 * dieses Recht abgemeldet, Vorbild `ladeRegelStand`); 403, Netz, 5xx und eine Antwort in unbekannter Gestalt sind
 * „nicht lesbar“ – **vorübergehend ist nicht ungültig**, daraus wird nie „fehlt“. Nur `404` beim Regel-Abruf heißt „keine
 * Regeln“ (gemessen 16.11.2026).
 *
 * Gedrosselt (vier gleichzeitig): Es sind je Wechsel-Gruppe mehrere Abfragen, ChurchTools antwortet sonst mit 429.
 */
import { ctDaten } from '@ui/ct/verbindung';
import { ApiError } from '@ui/ct/fehler';
import { mapLimit } from '@shared/ct/mapLimit';
import {
  rollenAus,
  type EinrichtungDaten,
  type Gelesen,
  type GruppenRegelStand,
  type RechtRoh,
  type RegelRoh,
  type RolleRoh,
  type RoutineRoh,
} from '@shared/organigramm/einrichtungStand';
import type { Einrichtung } from '@shared/organigramm/gruppenwechselEinrichtung';

const GLEICHZEITIG = 4;
type Holen = <T>(pfad: string) => Promise<T>;

const NICHT: { ok: false } = { ok: false };

/** Eine Liste lesen: eine Antwort, die keine Liste ist, zählt als nicht gelesen (nie als „leere Liste“). */
async function liste<T>(holen: Holen, pfad: string): Promise<Gelesen<readonly T[]>> {
  try {
    const roh = await holen<unknown>(pfad);
    if (Array.isArray(roh)) return { ok: true, wert: roh as T[] };
    return NICHT;
  } catch {
    return NICHT;
  }
}

/** Der Status einer dynamischen Gruppe – als Text oder als Feld `dynamicGroupStatus`/`status` in einem Objekt. */
export function statusAus(roh: unknown): string | null {
  if (typeof roh === 'string' && roh !== '') return roh;
  if (roh && typeof roh === 'object') {
    const r = roh as { dynamicGroupStatus?: unknown; status?: unknown };
    for (const v of [r.dynamicGroupStatus, r.status])
      if (typeof v === 'string' && v !== '') return v;
  }
  return null;
}

/**
 * Die Regeln einer dynamischen Gruppe. 404 = keine Regeln (kein Fehler); die Liste kann auch in `dynamicGroupRuleSet`
 * stecken. Alles andere (403, Netz, 5xx, unbekannte Gestalt) ist „nicht gelesen“. Eine Stelle für den Stand der
 * Einrichtung und für „Fremde Regeln“ im Fenster „Einrichten“ (O9-5c-2).
 */
export async function regelnLesen(holen: Holen, id: number): Promise<Gelesen<readonly RegelRoh[]>> {
  try {
    const roh = await holen<unknown>(`/dynamicgroups/${id}/ruleset`);
    if (Array.isArray(roh)) return { ok: true, wert: roh as RegelRoh[] };
    const innen = (roh as { dynamicGroupRuleSet?: unknown } | null)?.dynamicGroupRuleSet;
    return Array.isArray(innen) ? { ok: true, wert: innen as RegelRoh[] } : NICHT;
  } catch (x) {
    return x instanceof ApiError && x.status === 404 ? { ok: true, wert: [] } : NICHT;
  }
}

async function gruppenStand(holen: Holen, id: number): Promise<GruppenRegelStand> {
  const [regeln, status] = await Promise.all([
    regelnLesen(holen, id),
    (async (): Promise<Gelesen<string>> => {
      try {
        const s = statusAus(await holen<unknown>(`/dynamicgroups/${id}/status`));
        return s === null ? NICHT : { ok: true, wert: s };
      } catch {
        return NICHT;
      }
    })(),
  ]);
  return { regeln, status };
}

export async function ladeEinrichtungStand(
  e: Einrichtung,
  holen: Holen = ctDaten,
): Promise<EinrichtungDaten> {
  const wechsel = [...new Set(e.wechselGruppen.map((w) => w.gruppeId))];
  const alle = [...new Set([...e.einstellung.stufen.map((s) => s.gruppeId), ...wechsel])];
  const rollen = new Map<number, Gelesen<readonly RolleRoh[]>>();
  const routinen = new Map<number, Gelesen<readonly RoutineRoh[]>>();
  const gruppen = new Map<number, GruppenRegelStand>();

  await mapLimit(wechsel, GLEICHZEITIG, async (id) => {
    rollen.set(id, await liste<RolleRoh>(holen, `/groups/${id}/roles`));
    routinen.set(id, await liste<RoutineRoh>(holen, `/groups/${id}/members/routines`));
  });
  await mapLimit(alle, GLEICHZEITIG, async (id) => {
    gruppen.set(id, await gruppenStand(holen, id));
  });

  // Die Rechte hängen am Typ, nicht an der Gruppe: Es genügt die erste Wechsel-Gruppe, deren Rollen sich lesen lassen.
  // (Haben die Gruppen verschiedene Typen, sagt das die Zeile „Gruppentyp“.)
  let leiter: Gelesen<readonly RechtRoh[]> = NICHT;
  let teilnehmer: Gelesen<readonly RechtRoh[]> = NICHT;
  for (const id of wechsel) {
    const r = rollen.get(id);
    if (!r || !r.ok) continue;
    const typRollen = rollenAus(r.wert);
    if (typRollen.leiter === null || typRollen.teilnehmer === null) continue;
    [leiter, teilnehmer] = await Promise.all([
      liste<RechtRoh>(holen, `/permissions/group_type_role/${typRollen.leiter}`),
      liste<RechtRoh>(holen, `/permissions/group_type_role/${typRollen.teilnehmer}`),
    ]);
    break;
  }
  return { rollen, rechte: { leiter, teilnehmer }, gruppen, routinen };
}
