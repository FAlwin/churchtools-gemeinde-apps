/**
 * **Welche Rechte eine eingerichtete Gruppe braucht** (Bauplan Sitzungen S1/S2) – die eine Stelle für die
 * Verwaltung („Gruppe einrichten“) und für die Prüfung beim Start.
 *
 * Gemessen (16.10. und S0 am 22.10.2026):
 * - Rechte hängen an „Rolle X in Gruppe Y“ (`group_role`, ID aus `GET /groups/{id}/roles` → `id`) und folgen
 *   Rollenwechseln sofort. **Setzen darf nur ein Admin.**
 * - Die Nummern der Rechte sind **je Modul verschieden** → aus `GET /permissions/definitions` nach Schlüssel.
 * - `PUT` **ergänzt nur**; entzogen wird per `DELETE {authId, dataId}`. Ein entzogenes Recht wirkt weiter,
 *   **bis irgendein `PUT` folgt** → nach dem Entziehen ein vorhandenes Recht erneut setzen (`nachschieben`).
 * - Versteckte Gruppen: ihre Mitglieder sehen die Gruppe nur mit „versteckte Gruppe sehen“ (10119) an der Rolle.
 * - Vorlagen lesen nur Nutzende eingerichteter Gruppen (Alwin, 22.10.2026) → Recht an deren Rollen.
 *
 * **Was hier ausgerichtet wird:** die Rechte auf UNSERE Kategorien (vollständig: hinzufügen und entziehen).
 * Kalenderrecht und 10119 werden nur **ergänzt**, nie entzogen – sie können auch aus anderen Gründen gesetzt
 * worden sein, und wir wissen nicht, ob wir sie vergeben haben.
 */

export type Stufe = 'keine' | 'mitglied' | 'leitung';

export const STUFEN: { wert: Stufe; text: string }[] = [
  { wert: 'keine', text: 'Kein Zugriff' },
  { wert: 'mitglied', text: 'Lesen + eigene To-Dos' },
  { wert: 'leitung', text: 'Leitung' },
];

/** Gruppenintern „versteckte Gruppe sehen“ (gemessen 16.10.2026; steht nicht in den Definitionen). */
export const VERSTECKTE_GRUPPE_SEHEN = 10119;

export interface RechteNummern {
  kategorieSehen: number;
  datenSehen: number;
  datenAnlegen: number;
  datenAendern: number;
  datenLoeschen: number;
  kalenderSehen: number;
  kalenderBearbeiten: number;
}

interface Definitionen {
  modules?: { key?: unknown; permissions?: { authId?: unknown; key?: unknown }[] }[];
}

/**
 * Die Nummern aus `GET /permissions/definitions` (ausgepackt). `null`, wenn ein Recht fehlt – dann ist das
 * Modul nicht (richtig) installiert, und es wird nichts gesetzt.
 */
export function rechteNummernAus(
  definitionen: unknown,
  modulKuerzel: string,
): RechteNummern | null {
  const module = (definitionen as Definitionen | null)?.modules ?? [];
  const nummer = (modul: string, schluessel: string): number | null => {
    const m = module.find((x) => x.key === modul);
    const r = m?.permissions?.find((p) => p.key === schluessel);
    return typeof r?.authId === 'number' ? r.authId : null;
  };
  const n = {
    kategorieSehen: nummer(modulKuerzel, 'view custom category'),
    datenSehen: nummer(modulKuerzel, 'view custom data'),
    datenAnlegen: nummer(modulKuerzel, 'create custom data'),
    datenAendern: nummer(modulKuerzel, 'edit custom data'),
    datenLoeschen: nummer(modulKuerzel, 'delete custom data'),
    kalenderSehen: nummer('churchcal', 'view category'),
    kalenderBearbeiten: nummer('churchcal', 'edit category'),
  };
  return Object.values(n).every((v) => v !== null) ? (n as RechteNummern) : null;
}

export interface Recht {
  /** `group_role`-ID (Rolle in genau dieser Gruppe). */
  rolle: number;
  authId: number;
  /** Kategorie- bzw. Kalender-ID; `null` bei Rechten ohne Daten (10119). */
  dataId: number | null;
}

export interface Einrichtung {
  rollen: { rolle: number; stufe: Stufe }[];
  kategorien: { protokolle: number; mitarbeit: number; vorlagen: number };
  /** Kalender der Gruppe für die Sitzungstermine – `null`, solange keiner gewählt ist. */
  kalender: number | null;
  versteckt: boolean;
}

/** **Das Soll** – welche Rechte die Rollen nach dem Einrichten haben müssen. */
export function sollRechte(e: Einrichtung, n: RechteNummern): Recht[] {
  const out: Recht[] = [];
  const add = (rolle: number, authId: number, dataId: number | null): void => {
    out.push({ rolle, authId, dataId });
  };
  const { protokolle, mitarbeit, vorlagen } = e.kategorien;
  for (const { rolle, stufe } of e.rollen) {
    if (stufe === 'keine') continue;
    for (const k of [protokolle, mitarbeit, vorlagen]) {
      add(rolle, n.kategorieSehen, k);
      add(rolle, n.datenSehen, k);
    }
    // Mitarbeit: To-Dos abhaken, Notizen, Vorschläge – alle, die Zugriff haben. Kein „löschen“: wir löschen nie hart.
    add(rolle, n.datenAnlegen, mitarbeit);
    add(rolle, n.datenAendern, mitarbeit);
    if (stufe === 'leitung') {
      add(rolle, n.datenAnlegen, protokolle);
      add(rolle, n.datenAendern, protokolle);
      add(rolle, n.datenLoeschen, protokolle); // alte Teile nach dem Speichern aufräumen (Bauplan 3.3)
    }
    if (e.kalender !== null) {
      add(rolle, n.kalenderSehen, e.kalender);
      if (stufe === 'leitung') add(rolle, n.kalenderBearbeiten, e.kalender);
    }
    if (e.versteckt) add(rolle, VERSTECKTE_GRUPPE_SEHEN, null);
  }
  return out;
}

const schluessel = (r: Recht): string => `${r.rolle}:${r.authId}:${r.dataId ?? '-'}`;

/**
 * **Soll gegen Ist** für die Rollen der Gruppe. `ist` = alle Rechte, die diese Rollen heute haben
 * (`GET /permissions/group_role/{rolle}`). Entzogen wird nur, was auf UNSERE Kategorien zeigt.
 *
 * `nachschieben`: ein Recht, das nach dem Entziehen erneut gesetzt wird, damit ChurchTools seinen
 * Zwischenspeicher leert (S0). `null`, wenn nichts entzogen wird – oder wenn danach keins mehr übrig ist; dann
 * muss der Aufrufer ein anderes vorhandenes Recht nehmen und das melden.
 */
export function ausrichten(
  soll: readonly Recht[],
  ist: readonly Recht[],
  e: Pick<Einrichtung, 'kategorien'>,
  n: RechteNummern,
): { setzen: Recht[]; entziehen: Recht[]; nachschieben: Recht | null } {
  const unsere = new Set([e.kategorien.protokolle, e.kategorien.mitarbeit, e.kategorien.vorlagen]);
  const datenRechte = new Set([
    n.kategorieSehen,
    n.datenSehen,
    n.datenAnlegen,
    n.datenAendern,
    n.datenLoeschen,
  ]);
  const verwaltet = (r: Recht): boolean =>
    datenRechte.has(r.authId) && r.dataId !== null && unsere.has(r.dataId);

  const sollSet = new Set(soll.map(schluessel));
  const istSet = new Set(ist.map(schluessel));
  const setzen = soll.filter((r) => !istSet.has(schluessel(r)));
  const entziehen = ist.filter((r) => verwaltet(r) && !sollSet.has(schluessel(r)));
  const bleibt = [
    ...soll,
    ...ist.filter((r) => !entziehen.some((x) => schluessel(x) === schluessel(r))),
  ];
  return { setzen, entziehen, nachschieben: entziehen.length ? (bleibt[0] ?? null) : null };
}

/**
 * Rechte einer Rolle aus `GET /permissions/group_role/{rolle}` (ausgepackt). Mehrere `dataId` zu einem Recht
 * kommen als eigene Zeilen (gemessen 16.10.2026); fehlt `dataId`, gilt es ohne Daten.
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
