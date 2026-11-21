/**
 * **Mitglieder und Abwesenheiten für die Ansicht „Personen“ laden** (Wunsch 5, Scheibe P1). Je CT-Gruppe der gezeigten
 * Dienste (`Dienst.gruppenIds`, jede Gruppe einmal – Kamera Saal/Studio/Mobil teilen sich eine) zwei Abfragen:
 * `GET /groups/{id}/members` (alle Seiten) und `GET /groups/{id}/absences?from&to` (die Abwesenheiten **aller**
 * Mitglieder in einer Abfrage). Gemessen 13.11.2026 (P0): alle 16 Gruppen × 2 = 32 Abfragen parallel 342 ms.
 * Höchstens `GLEICHZEITIG` zugleich – ChurchTools bremst sonst (HTTP 429), und danach trifft es alles andere.
 *
 * **Das Recht vorher prüfen:** Ohne `churchservice['+view absence']` in der Gruppe (und ohne globales `manage absent`)
 * liefert ChurchTools still eine **leere** Liste – das sähe aus wie „niemand ist abwesend“. Darum wird die Abfrage dann
 * gar nicht erst gestellt, der Stand heißt `nichtSichtbar` (`/permissions/internal/groups`, einmal für alle).
 *
 * **Die Zweige einzeln – vorübergehend ist nicht ungültig:**
 * - **401** (abgemeldet) gilt für alles und wird geworfen.
 * - **403** auf die Mitglieder = `verborgen`, auf die Abwesenheiten = `nichtSichtbar` – dauerhaft, kein Wiederholen.
 * - **alles andere** (Netz, Zeitüberschreitung, 5xx, gebremst) = Stand `fehler` **nur dieser Gruppe**: Hinweis und
 *   „Nochmal versuchen“ im betroffenen Block, der Rest bleibt stehen.
 * Keine Namen oder IDs von Personen in `console.*`.
 */
import { ctAlleSeiten, ctAnfrage, ctDaten } from '@ui/ct/verbindung';
import { ApiError } from '@ui/ct/fehler';
import { fehlerMeldung } from '@ui/ct/fehlerMeldung';
import { mapLimit } from '@shared/ct/mapLimit';
import { plusTage } from '@shared/ct/datum';
import {
  istLeitung,
  mitgliederAus,
  type Rolle,
  type RohMitglied,
} from '@shared/organigramm/mitglieder';
import {
  abwesenheitenAus,
  gruppenMitAbwesenheitsRecht,
  type GruppenStand,
  type PersonenDaten,
} from '@shared/dienstplan/personenDaten';

/** So viele Gruppen gleichzeitig – wie im Organigramm (`ladeMitglieder`). */
export const GLEICHZEITIG = 4;

/** Was die Ansicht zum Laden braucht – `Planen` bekommt es von der App (mit dem Recht aus dem Start). */
export type PersonenLader = (
  gruppenIds: readonly number[],
  von: string,
  bis: string,
) => Promise<PersonenDaten>;

/** Der Anschluss an ChurchTools – austauschbar für Tests. */
export interface PersonenQuelle {
  /** Eine Liste mit allen Seiten (`/groups/{id}/members`, `/groups/{id}/absences?…`). */
  liste: (pfad: string) => Promise<unknown[]>;
  /** `/permissions/internal/groups` (Rechte in allen Gruppen). */
  rechte: () => Promise<unknown>;
}

/**
 * Abwesenheiten kommen laut Messung ohne Seitenteilung (196 auf einmal) – also erst ohne `limit` fragen (ein `limit` über
 * 200 lehnt ChurchTools bei anderen Listen mit 400 ab) und nur blättern, wenn die Antwort `meta.pagination` mit mehr als
 * einer Seite meldet. **Keine Liste ist kein „nichts eingetragen“** – sonst sähe ein Aussetzer wie ein leerer Kalender aus.
 */
async function abwesenheitenListe(pfad: string): Promise<unknown[]> {
  const erste = await ctAnfrage<{
    data?: unknown;
    meta?: { pagination?: { lastPage?: number } };
  } | null>(pfad);
  if (!erste || !Array.isArray(erste.data)) {
    throw new ApiError(502, 'ChurchTools hat die Abwesenheiten nicht als Liste geliefert.');
  }
  const letzte = erste.meta?.pagination?.lastPage;
  return typeof letzte === 'number' && letzte > 1 ? ctAlleSeiten<unknown>(pfad, 200) : erste.data;
}

export const CT_QUELLE: PersonenQuelle = {
  liste: (pfad) => (pfad.includes('/absences?') ? abwesenheitenListe(pfad) : ctAlleSeiten(pfad)),
  rechte: () => ctDaten<unknown>('/permissions/internal/groups'),
};

/**
 * Die Gruppen laden. **Wirft nur bei 401** – jede andere Störung steht im `GruppenStand` der Gruppe. `von`/`bis`
 * (`YYYY-MM-DD`, `bis` eingeschlossen) sind der geladene Zeitraum der Matrix; ChurchTools zählt `to` nicht mit, also
 * wird ein Tag dazugerechnet (wie bei den Terminen).
 */
export async function ladePersonen(
  gruppenIds: readonly number[],
  o: {
    von: string;
    bis: string;
    /** Global `churchservice['manage absent']` (`DienstRechte.abwesenheitenAller`) – dann sieht man alle Gruppen. */
    abwesenheitenAller: boolean;
    quelle?: PersonenQuelle;
    /**
     * Die Rollen (`/group/roles`, `rollenAus`) – nur wenn die Leitung gebraucht wird („Vertretung suchen“, E5c-6): dann steht
     * sie im Stand der Gruppe (`leitung`). Ohne: kein Feld, die Ansicht „Personen“ braucht sie nicht.
     */
    rollen?: ReadonlyMap<number, Rolle>;
  },
): Promise<Map<number, GruppenStand>> {
  const quelle = o.quelle ?? CT_QUELLE;
  const stand = new Map<number, GruppenStand>();
  if (gruppenIds.length === 0) return stand;

  // Das Recht je Gruppe, einmal für alle. Nur nötig ohne das globale.
  let recht: Set<number> | null = null;
  let rechteFehler: { text: string; nochmal: boolean } | null = null;
  if (!o.abwesenheitenAller) {
    try {
      recht = gruppenMitAbwesenheitsRecht(await quelle.rechte());
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) throw e;
      if (e instanceof ApiError && e.status >= 400 && e.status < 500 && e.status !== 429) {
        recht = new Set(); // ausdrücklich verweigert oder unbekannt: kein Recht – dauerhaft
      } else {
        rechteFehler = fehlerMeldung(e); // vorübergehend: nichts behaupten, Wiederholen anbieten
      }
    }
  }

  const abgemeldet: { fehler: ApiError | null } = { fehler: null };
  await mapLimit([...new Set(gruppenIds)], GLEICHZEITIG, async (id) => {
    if (abgemeldet.fehler) return;
    if (rechteFehler) {
      stand.set(id, { art: 'fehler', ...rechteFehler });
      return;
    }
    const sehen = o.abwesenheitenAller || recht?.has(id) === true;
    const abfrage = `/groups/${id}/absences?from=${o.von}&to=${plusTage(o.bis, 1)}`;
    const [mitglieder, abwesenheiten] = await Promise.allSettled([
      quelle.liste(`/groups/${id}/members`),
      sehen ? quelle.liste(abfrage) : Promise.resolve(null),
    ]);
    for (const r of [mitglieder, abwesenheiten]) {
      if (r.status === 'rejected' && r.reason instanceof ApiError && r.reason.status === 401)
        abgemeldet.fehler = r.reason;
    }
    if (abgemeldet.fehler) return;

    const verweigert = (r: PromiseSettledResult<unknown>) =>
      r.status === 'rejected' && r.reason instanceof ApiError && r.reason.status === 403;
    const gescheitert = [mitglieder, abwesenheiten].find(
      (r): r is PromiseRejectedResult => r.status === 'rejected' && !verweigert(r),
    );
    if (gescheitert) {
      stand.set(id, { art: 'fehler', ...fehlerMeldung(gescheitert.reason) });
      return;
    }
    stand.set(id, {
      art: 'da',
      ...(o.rollen && mitglieder.status === 'fulfilled'
        ? { leitung: leitungIds(mitglieder.value as RohMitglied[], o.rollen) }
        : {}),
      mitglieder:
        mitglieder.status === 'fulfilled'
          ? aktivePersonen(mitglieder.value as RohMitglied[])
          : 'verborgen',
      abwesenheiten:
        abwesenheiten.status === 'fulfilled' && abwesenheiten.value !== null
          ? abwesenheitenAus(abwesenheiten.value)
          : 'nichtSichtbar',
    });
  });
  if (abgemeldet.fehler) throw abgemeldet.fehler;
  return stand;
}

/** Die aktiven Mitglieder einer Gruppe, deren Rolle Leitung ist (`istLeitung`, wie im Organigramm), ohne Doppelte. */
function leitungIds(roh: RohMitglied[], rollen: ReadonlyMap<number, Rolle>): number[] {
  const { mitglieder } = mitgliederAus(roh);
  return [
    ...new Set(mitglieder.filter((m) => istLeitung(rollen, m.rolleId)).map((m) => m.personId)),
  ];
}

/** Die aktiven Mitglieder einer Gruppe als Personen (wie im Organigramm: `mitgliederAus`), ohne Doppelte. */
function aktivePersonen(roh: RohMitglied[]) {
  const { mitglieder, personen } = mitgliederAus(roh);
  const aktiv = new Set(mitglieder.map((m) => m.personId));
  return [...new Map(personen.filter((p) => aktiv.has(p.id)).map((p) => [p.id, p])).values()];
}
