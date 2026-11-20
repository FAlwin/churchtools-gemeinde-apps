/**
 * **Rechte an Gruppenrollen** (`/permissions/group_role/{rolle}`) – der gemeinsame Baustein für alle Erweiterungen, die beim
 * Einrichten Rechte an die Rollen einer Gruppe vergeben: Protokolle (S2) und Website (W3b-1). Bis 20.11.2026 stand er
 * mitten in `shared/protokolle/einrichten.ts`; die Website hätte ihn sonst ein zweites Mal nachgebaut (Regel-Dopplung).
 *
 * **Was hier steht (die Mechanik, nicht die Stufen):** das Recht als Wert (`Recht`), Lesen der Zeilen, der Rumpf für `PUT`/
 * `DELETE`, die Nummern der Daten-Rechte eines Moduls aus `/permissions/definitions`, „wer darf setzen“, **Soll gegen Ist**
 * (setzen, entziehen, nachschieben) und der Ablauf dazu mit Nachlesen. **Was nicht:** welche Rechte eine Stufe bedeutet
 * (`sollRechte` je Erweiterung) und **welche Kategorien der Erweiterung gehören** – das kommt als `verwaltet` herein.
 *
 * **Bewusst nicht hier:** die Rechte an **Gruppenart-Rollen** (`group_type_role`, `shared/ct/gruppenart.ts`) – dort wird
 * nur ergänzt, nie entzogen, und der Schlüssel kennt keine Rolle; die Nummern-Suche (`modulRechtAus`) und der Schlüssel
 * (`rechtSchluessel`) kommen von dort und werden hier benutzt, nicht ein zweites Mal geschrieben.
 *
 * Gemessen (16.10. und S0 am 22.10.2026, Protokolle):
 * - Rechte hängen an „Rolle X in Gruppe Y“ (`group_role`, ID aus `GET /groups/{id}/roles` → `id`) und folgen Rollenwechseln
 *   sofort. **Setzen darf nur ein Admin** (`churchcore: administer persons`); ein Mitglied bekommt 403.
 * - Die Nummern der Rechte sind **je Modul verschieden** → aus `GET /permissions/definitions` nach Schlüssel.
 * - `PUT` **ergänzt nur**; entzogen wird per `DELETE {authId, dataId}`. Ein entzogenes Recht wirkt weiter, **bis irgendein
 *   `PUT` folgt** → nach dem Entziehen ein vorhandenes Recht erneut setzen (`nachschieben`). Der Zwischenspeicher gilt für
 *   alle Rollen: ein `PUT` an einer **anderen** Rolle leert ihn ebenso sofort (gemessen S2-1, 22.10.2026).
 * - Ein `204` ist kein Beleg (Lehre vom 11.08.2026) – darum liest `rechteAusrichten` nach.
 */
import { ctId } from './ctId';
import { modulRechtAus, rechtSchluessel as schluesselOhneRolle } from './gruppenart';
import type { ModulPort } from './modulDaten';

export interface Recht {
  /** `group_role`-ID (Rolle in genau dieser Gruppe). */
  rolle: number;
  authId: number;
  /** Kategorie- bzw. Kalender-ID; `null` bei Rechten ohne Daten (z. B. „versteckte Gruppe sehen“). */
  dataId: number | null;
}

/** Eindeutiger Schlüssel eines Rechts an einer Rolle – der Schlüssel ohne Rolle aus `gruppenart.ts`, mit der Rolle davor. */
export const rechtSchluessel = (r: Recht): string => `${r.rolle}:${schluesselOhneRolle(r)}`;

/** Die Nummern der Rechte, die jedes Modul mit Speicher hat (Kategorien und Daten, je Modul verschieden). */
export interface DatenRechteNummern {
  /** Das Modul überhaupt sehen (Menüpunkt) – ohne Daten. */
  modulSehen: number;
  kategorieSehen: number;
  datenSehen: number;
  datenAnlegen: number;
  datenAendern: number;
  datenLoeschen: number;
}

/**
 * Die Nummern aus `GET /permissions/definitions` (ausgepackt). `null`, wenn ein Recht fehlt – dann ist das Modul nicht
 * (richtig) installiert, und es wird nichts gesetzt.
 */
export function datenRechteNummernAus(
  definitionen: unknown,
  modulKuerzel: string,
): DatenRechteNummern | null {
  const n = {
    modulSehen: modulRechtAus(definitionen, modulKuerzel, 'view'),
    kategorieSehen: modulRechtAus(definitionen, modulKuerzel, 'view custom category'),
    datenSehen: modulRechtAus(definitionen, modulKuerzel, 'view custom data'),
    datenAnlegen: modulRechtAus(definitionen, modulKuerzel, 'create custom data'),
    datenAendern: modulRechtAus(definitionen, modulKuerzel, 'edit custom data'),
    datenLoeschen: modulRechtAus(definitionen, modulKuerzel, 'delete custom data'),
  };
  return Object.values(n).every((v) => v !== null) ? (n as DatenRechteNummern) : null;
}

/** Ist das ein Daten-Recht (Kategorie sehen, Daten sehen/anlegen/ändern/löschen) an einer der `kategorien`? */
export function istDatenRechtAn(
  r: Recht,
  n: DatenRechteNummern,
  kategorien: ReadonlySet<number>,
): boolean {
  const datenRechte = [
    n.kategorieSehen,
    n.datenSehen,
    n.datenAnlegen,
    n.datenAendern,
    n.datenLoeschen,
  ];
  return datenRechte.includes(r.authId) && r.dataId !== null && kategorien.has(r.dataId);
}

/**
 * Rechte einer Rolle aus `GET /permissions/group_role/{rolle}` (ausgepackt). Mehrere `dataId` zu einem Recht kommen als
 * eigene Zeilen (gemessen 16.10.2026); fehlt `dataId`, gilt es ohne Daten.
 */
export function rechteAus(rolle: number, zeilen: unknown): Recht[] {
  if (!Array.isArray(zeilen)) return [];
  const out: Recht[] = [];
  for (const z of zeilen as { authId?: unknown; dataId?: unknown; type?: unknown }[]) {
    if (typeof z.authId !== 'number' || (z.type !== undefined && z.type !== 'grant')) continue;
    out.push({ rolle, authId: z.authId, dataId: typeof z.dataId === 'number' ? z.dataId : null });
  }
  return out;
}

/** Der Rumpf für `PUT`/`DELETE /permissions/group_role/{rolle}`. */
export function rechtRumpf(r: Recht): { authId: number; dataId?: number[] } {
  return r.dataId === null ? { authId: r.authId } : { authId: r.authId, dataId: [r.dataId] };
}

/** **Wer Rechte setzen darf**: wer in ChurchTools Rechte vergeben darf (`churchcore: administer persons`). */
export function darfVerwalten(globaleRechte: unknown): boolean {
  const cc = (globaleRechte as { churchcore?: Record<string, unknown> } | null)?.churchcore;
  return cc?.['administer persons'] === true;
}

/**
 * **Soll gegen Ist.** `ist` = alle Rechte der betroffenen Rollen heute. Entzogen wird nur, was `verwaltet` als „gehört uns“
 * erkennt (die Erweiterung sagt, welche Kategorien ihre sind) – alles andere, was von Hand gesetzt wurde, bleibt.
 *
 * `nachschieben`: ein Recht, das nach dem Entziehen erneut gesetzt wird, damit ChurchTools seinen Zwischenspeicher leert
 * (S0; welche Rolle, ist gleich – S2-1). `null`, wenn nichts entzogen wird. Bleibt nach dem Entziehen gar kein Recht
 * übrig, wird „Modul sehen“ (`modulSehen`) an die erste betroffene Rolle gesetzt: Das schadet nicht – ohne Kategorie-Rechte
 * sieht sie nichts – und wird nie entzogen.
 */
export function rechteVergleichen(
  soll: readonly Recht[],
  ist: readonly Recht[],
  verwaltet: (r: Recht) => boolean,
  modulSehen: number,
): { setzen: Recht[]; entziehen: Recht[]; nachschieben: Recht | null } {
  const sollSet = new Set(soll.map(rechtSchluessel));
  const istSet = new Set(ist.map(rechtSchluessel));
  const setzen = soll.filter((r) => !istSet.has(rechtSchluessel(r)));
  const entziehen = ist.filter((r) => verwaltet(r) && !sollSet.has(rechtSchluessel(r)));
  const bleibt = [
    ...soll,
    ...ist.filter((r) => !entziehen.some((x) => rechtSchluessel(x) === rechtSchluessel(r))),
  ];
  if (!entziehen.length) return { setzen, entziehen, nachschieben: null };
  const ersatz: Recht = { rolle: entziehen[0].rolle, authId: modulSehen, dataId: null };
  return { setzen, entziehen, nachschieben: bleibt[0] ?? ersatz };
}

/**
 * **Hat ChurchTools übernommen, was ausgerichtet werden sollte?** `nachher` = frisch gelesene Rechte der Rollen.
 * Geprüft wird das ganze Soll (nicht nur das gerade Gesetzte) und jeder Entzug. Leer heißt: übernommen – ein 204 allein ist
 * kein Beleg (Lehre vom 11.08.2026).
 */
export function abweichungen(
  soll: readonly Recht[],
  entzogen: readonly Recht[],
  nachher: readonly Recht[],
): { fehlt: Recht[]; nochDa: Recht[] } {
  const da = new Set(nachher.map(rechtSchluessel));
  return {
    fehlt: soll.filter((r) => !da.has(rechtSchluessel(r))),
    nochDa: entzogen.filter((r) => da.has(rechtSchluessel(r))),
  };
}

// ── Lesen und Schreiben bei ChurchTools ────────────────────────────────────────────────────────────────────────────

/**
 * Die Rechte dieser Rollen, frisch aus ChurchTools. Ein Fehler beim Lesen wird geworfen – **nie** als „keine Rechte“
 * ausgelegt (vorübergehend ist nicht leer): Sonst würde das Ausrichten alles „fehlende“ neu setzen oder ein Nachlesen
 * einen Fehlschlag verschweigen.
 */
export async function rechteDerRollen(
  port: Pick<ModulPort, 'daten'>,
  rollen: readonly number[],
): Promise<Recht[]> {
  const listen = await Promise.all(
    rollen.map(async (r) => rechteAus(r, await port.daten(`/permissions/group_role/${r}`))),
  );
  return listen.flat();
}

/** Ein Recht an einer Rolle setzen (`PUT`) oder entziehen (`DELETE`). */
export async function rechtSchreiben(
  port: Pick<ModulPort, 'schreibe'>,
  methode: 'PUT' | 'DELETE',
  r: Recht,
  verweigert: string,
): Promise<void> {
  await port.schreibe(`/permissions/group_role/${r.rolle}`, {
    method: methode,
    json: rechtRumpf(r),
    verweigert,
  });
}

/** Was `rechteAusrichten` getan hat – und was beim Nachlesen noch abweicht (leer = ChurchTools hat alles übernommen). */
export interface Ausgerichtet {
  plan: { setzen: Recht[]; entziehen: Recht[]; nachschieben: Recht | null };
  fehlt: Recht[];
  nochDa: Recht[];
}

/**
 * **Die Rechte der Rollen auf das Soll bringen – jeder Schritt nachgelesen.** Reihenfolge: Ist lesen → setzen → entziehen →
 * nachschieben (sonst wirkt ein Entzug weiter) → nachlesen. Erneut aufrufen ist gefahrlos (Soll gegen Ist), auch nach einem
 * Abbruch mittendrin.
 *
 * Ein Fehler bei einem Schreibaufruf **bricht ab und wird geworfen** – nichts wird zurückgenommen (vorübergehend ist nicht
 * ungültig: Was gesetzt ist, bleibt; der nächste Versuch ergänzt den Rest). Ob ChurchTools das Gesetzte wirklich übernommen
 * hat, steht danach in `fehlt`/`nochDa`; **der Aufrufer wirft daraus seine `NichtUebernommen`-Meldung** (die Fehlerklassen
 * der Oberfläche gehören nicht in `shared/`).
 *
 * `rollen`: **alle** Rollen, deren Rechte gelesen werden – auch eine, die heute nicht mehr im Soll steht (ihr Entzug gehört
 * dazu).
 */
export async function rechteAusrichten(
  port: Pick<ModulPort, 'daten' | 'schreibe'>,
  a: {
    rollen: readonly number[];
    soll: readonly Recht[];
    /** Was der Erweiterung gehört und deshalb entzogen werden darf. */
    verwaltet: (r: Recht) => boolean;
    modulSehen: number;
    /** Meldung bei fehlendem Recht (ChurchTools 401/403 beim Schreiben). */
    verweigert: string;
  },
): Promise<Ausgerichtet> {
  const ist = await rechteDerRollen(port, a.rollen);
  const plan = rechteVergleichen(a.soll, ist, a.verwaltet, a.modulSehen);
  for (const r of plan.setzen) await rechtSchreiben(port, 'PUT', r, a.verweigert);
  for (const r of plan.entziehen) await rechtSchreiben(port, 'DELETE', r, a.verweigert);
  // Ohne dieses PUT wirkt ein Entzug unbestimmt lange weiter (S0, S2-1) – auch ein entzogenes Leserecht.
  if (plan.nachschieben) await rechtSchreiben(port, 'PUT', plan.nachschieben, a.verweigert);
  const { fehlt, nochDa } = abweichungen(
    a.soll,
    plan.entziehen,
    await rechteDerRollen(port, a.rollen),
  );
  return { plan, fehlt, nochDa };
}

/** Eine Rolle der Gruppe, wie ChurchTools sie liefert (`GET /groups/{id}/roles`) – nur was hier zählt. */
export interface RolleRoh {
  id?: unknown;
  name?: unknown;
  nameTranslated?: unknown;
  isLeader?: unknown;
  isActive?: unknown;
}

/** Eine Rolle der Gruppe, wie die Oberfläche sie braucht. */
export interface GruppenRolle {
  /** `group_role`-ID – daran hängen die Rechte. */
  id: number;
  name: string;
  /** Leiter-Kennzeichen in ChurchTools (Leiter, Co-Leiter) – Grundlage der Vorbelegung „Leitung“. */
  leitung: boolean;
}

/** Alle Rollen der Gruppe, wie ChurchTools sie liefert (auch inaktive) – für die Oberfläche und fürs Einrichten. */
export function rollenLesen(
  port: Pick<ModulPort, 'daten'>,
  gruppe: number,
): Promise<RolleRoh[] | null> {
  return port.daten<RolleRoh[] | null>(`/groups/${gruppe}/roles`);
}

/** Die **aktiven** Rollen als Auswahl für die Oberfläche (inaktive Rollen gibt es dort nicht). Zeilen ohne ID fallen weg. */
export function gruppenRollenAus(roh: readonly RolleRoh[] | null): GruppenRolle[] {
  return (roh ?? []).flatMap((r) => {
    const id = ctId(r.id);
    if (id === null || r.isActive === false) return [];
    const name = [r.nameTranslated, r.name].find((t) => typeof t === 'string' && t !== '');
    return [
      { id, name: typeof name === 'string' ? name : `Rolle ${id}`, leitung: r.isLeader === true },
    ];
  });
}

/** Die `group_role`-IDs aus `GET /groups/{id}/roles` – Zeilen ohne lesbare ID fallen weg (auch inaktive Rollen: ihre Rechte gehören mit gelesen). */
export function rollenIdsAus(rollen: readonly { id?: unknown }[] | null): number[] {
  return (rollen ?? []).map((r) => ctId(r.id)).filter((x): x is number => x !== null);
}
