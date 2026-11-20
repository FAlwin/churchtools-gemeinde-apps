/**
 * **Welche Rechte eine eingerichtete Gruppe braucht** (Bauplan Protokolle S1/S2) – die eine Stelle für die
 * Verwaltung („Gruppe einrichten“) und für die Prüfung beim Start.
 *
 * **Die Mechanik** (Recht, Nummern, Soll gegen Ist, Entziehen, Nachschieben, Nachlesen, `darfVerwalten`) steht seit
 * 20.11.2026 in `shared/ct/rollenRechte.ts` – hier nur, was die Protokolle ausmacht: Stufen, Soll je Stufe und die
 * Zusatzrechte. Gemessen (16.10. und S0 am 22.10.2026; Messwerte zur Mechanik dort):
 * - Versteckte Gruppen: ihre Mitglieder sehen die Gruppe nur mit „versteckte Gruppe sehen“ (10119) an der Rolle.
 * - Anwesenheit (S5-3, gemessen 05.11.2026): gruppenintern „Gruppentreffen pflegen“ = 10124, „Gruppentreffen
 *   durchführen“ = 10111 – beide an die Leitung (Dienst- und Kleingruppen-Leiter haben sie schon über den Gruppentyp,
 *   andere Gruppentypen nicht).
 * - Vorlagen lesen nur Nutzende eingerichteter Gruppen (Alwin, 22.10.2026) → Recht an deren Rollen.
 *
 * **Was hier ausgerichtet wird:** die Rechte auf UNSERE Kategorien (vollständig: hinzufügen und entziehen).
 * **Zusatzrechte** (Kalender, 10119, Gruppentreffen) werden nur dann entzogen, wenn die Verwaltung sie **selbst gesetzt** hat –
 * das merkt sich die Einstellung der Gruppe (`vergeben`, Alwin 22.10.2026). Was vorher schon von Hand da war,
 * wird nie gemerkt und darum nie entzogen.
 */

import { modulRechtAus } from '../ct/gruppenart';
import {
  datenRechteNummernAus,
  istDatenRechtAn,
  rechtSchluessel,
  rechteVergleichen,
  type DatenRechteNummern,
  type Recht,
} from '../ct/rollenRechte';

export type Stufe = 'keine' | 'mitglied' | 'leitung';

export const STUFEN: { wert: Stufe; text: string }[] = [
  { wert: 'keine', text: 'Kein Zugriff' },
  { wert: 'mitglied', text: 'Lesen + eigene To-Dos' },
  { wert: 'leitung', text: 'Leitung' },
];

/** Gruppenintern „versteckte Gruppe sehen“ (gemessen 16.10.2026; steht nicht in den Definitionen). */
export const VERSTECKTE_GRUPPE_SEHEN = 10119;

/** Gruppenintern „Gruppentreffen pflegen“ und „… durchführen“ (gemessen 05.11.2026, `messung-s5-3`). */
export const GRUPPENTREFFEN_PFLEGEN = 10124;
export const GRUPPENTREFFEN_DURCHFUEHREN = 10111;

/** Die Nummern der Protokolle: die Daten-Rechte des Moduls und die Kalender-Rechte (`churchcal`, je Instanz anders). */
export interface RechteNummern extends DatenRechteNummern {
  kalenderSehen: number;
  kalenderBearbeiten: number;
}

/**
 * Die Nummern aus `GET /permissions/definitions` (ausgepackt). `null`, wenn ein Recht fehlt – dann ist das
 * Modul nicht (richtig) installiert, und es wird nichts gesetzt.
 */
export function rechteNummernAus(
  definitionen: unknown,
  modulKuerzel: string,
): RechteNummern | null {
  const daten = datenRechteNummernAus(definitionen, modulKuerzel);
  const kalenderSehen = modulRechtAus(definitionen, 'churchcal', 'view category');
  const kalenderBearbeiten = modulRechtAus(definitionen, 'churchcal', 'edit category');
  if (!daten || kalenderSehen === null || kalenderBearbeiten === null) return null;
  return { ...daten, kalenderSehen, kalenderBearbeiten };
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
    add(rolle, n.modulSehen, null);
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
      // Anwesenheit eintragen und Gruppentreffen anlegen (S5-3).
      add(rolle, GRUPPENTREFFEN_PFLEGEN, null);
      add(rolle, GRUPPENTREFFEN_DURCHFUEHREN, null);
    }
    if (e.kalender !== null) {
      add(rolle, n.kalenderSehen, e.kalender);
      if (stufe === 'leitung') add(rolle, n.kalenderBearbeiten, e.kalender);
    }
    if (e.versteckt) add(rolle, VERSTECKTE_GRUPPE_SEHEN, null);
  }
  return out;
}

/**
 * **Was die Protokolle verwalten (und darum entziehen dürfen):** Daten-Rechte an UNSEREN Kategorien, dazu die
 * Zusatzrechte, die die Verwaltung früher selbst gesetzt hat (`vergeben`). Das `verwaltet` für `rechteAusrichten`.
 */
export function verwaltetVon(
  e: Pick<Einrichtung, 'kategorien'>,
  n: RechteNummern,
  vergeben: readonly Recht[] = [],
): (r: Recht) => boolean {
  const unsere = new Set([e.kategorien.protokolle, e.kategorien.mitarbeit, e.kategorien.vorlagen]);
  const selbstGesetzt = new Set(vergeben.map(rechtSchluessel));
  return (r) => istDatenRechtAn(r, n, unsere) || selbstGesetzt.has(rechtSchluessel(r));
}

/**
 * **Soll gegen Ist** für die Rollen der Gruppe. `ist` = alle Rechte, die diese Rollen heute haben
 * (`GET /permissions/group_role/{rolle}`). Entzogen wird nur, was auf UNSERE Kategorien zeigt (`verwaltetVon`).
 * Die Rechnung selbst (Setzen, Entziehen, Nachschieben) steht in `rechteVergleichen`.
 */
export function ausrichten(
  soll: readonly Recht[],
  ist: readonly Recht[],
  e: Pick<Einrichtung, 'kategorien'>,
  n: RechteNummern,
  /** Zusatzrechte, die die Verwaltung früher selbst gesetzt hat (aus der Einstellung). */
  vergeben: readonly Recht[] = [],
): { setzen: Recht[]; entziehen: Recht[]; nachschieben: Recht | null } {
  return rechteVergleichen(soll, ist, verwaltetVon(e, n, vergeben), n.modulSehen);
}

/**
 * Kalender-Rechte, „versteckte Gruppe sehen“ und die Gruppentreffen-Rechte – die Rechte, die auch aus anderem Grund
 * gesetzt sein können.
 */
export function istZusatzrecht(r: Recht, n: RechteNummern): boolean {
  return (
    r.authId === n.kalenderSehen ||
    r.authId === n.kalenderBearbeiten ||
    r.authId === VERSTECKTE_GRUPPE_SEHEN ||
    r.authId === GRUPPENTREFFEN_PFLEGEN ||
    r.authId === GRUPPENTREFFEN_DURCHFUEHREN
  );
}

/**
 * **Die Merkliste `vergeben` prüfen, bevor sie zählt** (Security-Review 16.11.2026). Sie steht in der Einstellung in
 * „Protokolle · Gruppe“ – die darf die **Leitung** beschreiben (in ChurchTools jeden Eintrag der Kategorie). Ungeprüft
 * würde ein untergeschobener Eintrag beim nächsten „Einrichten“ mit der Sitzung des **Admins** entzogen, auch an Rollen
 * anderer Gruppen. Es bleibt nur, was das Einrichten selbst vergeben haben kann (`sollRechte`):
 * - ein **Zusatzrecht** (`istZusatzrecht`),
 * - an einer **Rolle dieser Gruppe** (`rollenDerGruppe` frisch aus ChurchTools, nicht aus der Einstellung),
 * - Kalenderrechte nur an einem der `kalender` (alter oder neuer Kalender der Gruppe), alle übrigen ohne Daten.
 * Was eine Leitung danach noch erreichen kann, betrifft nur Zusatzrechte der eigenen Gruppe.
 */
export function vergebenPruefen(
  vergeben: readonly Recht[],
  rollenDerGruppe: readonly number[],
  kalender: readonly (number | null)[],
  n: RechteNummern,
): Recht[] {
  const rollen = new Set(rollenDerGruppe);
  const kalenderIds = new Set(kalender.filter((k): k is number => k !== null));
  const istKalenderRecht = (r: Recht): boolean =>
    r.authId === n.kalenderSehen || r.authId === n.kalenderBearbeiten;
  return vergeben.filter(
    (r) =>
      rollen.has(r.rolle) &&
      istZusatzrecht(r, n) &&
      (istKalenderRecht(r) ? r.dataId !== null && kalenderIds.has(r.dataId) : r.dataId === null),
  );
}

/**
 * **Welche Zusatzrechte die Verwaltung nach diesem Einrichten selbst gesetzt hat:** die im Soll, die sie gerade
 * gesetzt hat oder schon früher gesetzt hatte. Eins, das vorher schon da war (von Hand), zählt nicht.
 */
export function vergebenNachher(
  soll: readonly Recht[],
  setzen: readonly Recht[],
  vergeben: readonly Recht[],
  n: RechteNummern,
): Recht[] {
  const gesetzt = new Set([...setzen, ...vergeben].map(rechtSchluessel));
  return soll.filter((r) => istZusatzrecht(r, n) && gesetzt.has(rechtSchluessel(r)));
}

export type PunkteVonMitgliedern = 'vorschlagen' | 'direkt';

/**
 * **Die Einstellung einer Gruppe** – ein Wert in ihrer Kategorie „Protokolle“. Sie ist zugleich der Vermerk
 * „eingerichtet“: geschrieben wird sie erst, wenn alle Rechte gesetzt und nachgelesen sind.
 */
export interface GruppenEinstellung {
  art: 'einstellung';
  fassung: 1;
  gruppe: number;
  /** Stufe je Rolle (`group_role`-ID); fehlende Rollen gelten als „Kein Zugriff“. */
  rollen: { rolle: number; stufe: Stufe }[];
  punkte: PunkteVonMitgliedern;
  kalender: number | null;
  /**
   * Zusatzrechte (Kalender, 10119, Gruppentreffen), die die Verwaltung selbst gesetzt hat – nur diese entzieht sie wieder.
   * Fehlt bei Einstellungen von vor S2-2 (dann: keine).
   */
  vergeben?: Recht[];
}

export function istEinstellung(x: unknown): x is GruppenEinstellung {
  const e = x as Partial<GruppenEinstellung> | null;
  return (
    !!e &&
    e.art === 'einstellung' &&
    e.fassung === 1 &&
    typeof e.gruppe === 'number' &&
    Array.isArray(e.rollen) &&
    e.rollen.every((r) => typeof r?.rolle === 'number' && STUFEN.some((s) => s.wert === r.stufe)) &&
    (e.punkte === 'vorschlagen' || e.punkte === 'direkt') &&
    (e.kalender === null || typeof e.kalender === 'number') &&
    (e.vergeben === undefined ||
      (Array.isArray(e.vergeben) &&
        e.vergeben.every(
          (r) =>
            typeof r?.rolle === 'number' &&
            typeof r.authId === 'number' &&
            (r.dataId === null || typeof r.dataId === 'number'),
        )))
  );
}
