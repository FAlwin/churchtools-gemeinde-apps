/**
 * **Wer darf was – die Rechte der Website an den Gruppenrollen** (Bauplan Website W3b-1, E-W19, E-W21). Die Mechanik
 * (Rechte lesen, Soll gegen Ist, Entziehen, Nachschieben, Nachlesen) steht in `shared/ct/rollenRechte.ts` – wie bei den
 * Protokollen; hier nur, was die Website ausmacht: **die Stufen und was sie in ChurchTools bedeuten**.
 *
 * **Stufen je Rolle der Gruppe „Website“:** Kein Zugriff · Redakteur · Leitung.
 *
 * | Stufe     | Modul | Entwürfe (`entwuerfe-g<ID>`)            | Veröffentlicht (`veroeffentlicht-g<ID>`) |
 * |-----------|-------|------------------------------------------|-------------------------------------------|
 * | Redakteur | sehen | Kategorie sehen · Daten sehen/anlegen/ändern/löschen | **nur** Kategorie sehen + Daten sehen |
 * | Leitung   | sehen | wie Redakteur                            | dazu anlegen/ändern/löschen               |
 *
 * **Online geht technisch nur, was eine Leitung in „Veröffentlicht“ schreibt** (der Bau-Dienst liest nur diese Kategorie);
 * Redakteure lesen „Veröffentlicht“, damit die Oberfläche später „online / geändert seit der Freigabe“ zeigen kann
 * (gemessen W3b-0, 20.11.2026: lesen `200`, schreiben `401`).
 *
 * **Die Stufe wird nicht zusätzlich gespeichert.** ChurchTools-Rechte sind die einzige Quelle: `stufeAus` leitet die Stufe
 * aus den gelesenen Rechten ab. Ein Mischzustand (von Hand verändert) zeigt sich als „weicht ab“ – nie still als eine der
 * drei Stufen.
 *
 * **Entzogen wird nur, was auf UNSERE zwei Kategorien zeigt** (`verwaltetVon`); alles andere an der Rolle bleibt.
 */
import {
  istDatenRechtAn,
  rechteVergleichen,
  type DatenRechteNummern,
  type GruppenRolle,
  type Recht,
} from '../ct/rollenRechte';

/** Kürzel des Moduls – danach heißen die Rechte in `/permissions/definitions` und der Block in `/permissions/global`. */
export const MODUL_KUERZEL = 'website';

export type Stufe = 'keine' | 'redakteur' | 'leitung';

export const STUFEN: { wert: Stufe; text: string }[] = [
  { wert: 'keine', text: 'Kein Zugriff' },
  { wert: 'redakteur', text: 'Redakteur' },
  { wert: 'leitung', text: 'Leitung' },
];

/** Die Stufe als Wort („Redakteur“) – für Meldungen. */
export const stufenText = (s: Stufe): string => STUFEN.find((x) => x.wert === s)?.text ?? s;

/** Die beiden Kategorien der Website (IDs aus ChurchTools). */
export interface Kategorien {
  entwuerfe: number;
  veroeffentlicht: number;
}

/** Die Wahl des Admins: Stufe je Rolle (`group_role`-ID). */
export interface RollenStufe {
  rolle: number;
  stufe: Stufe;
}

/**
 * **Vorschlag** für eine Gruppe, in der noch nichts gesetzt ist (E-W21): Rollen mit Leiter-Kennzeichen = Leitung, alle
 * anderen = Redakteur. (Der Gruppentyp „Dienst“ hat Leiter, Co-Leiter, Mitarbeiter, Coach, Organisator – gemessen.)
 */
export function vorschlag(rollen: readonly GruppenRolle[]): RollenStufe[] {
  return rollen.map((r) => ({ rolle: r.id, stufe: r.leitung ? 'leitung' : 'redakteur' }));
}

/** **Das Soll** – welche Rechte die Rollen nach dem Einrichten haben müssen. */
export function sollRechte(
  rollen: readonly RollenStufe[],
  kat: Kategorien,
  n: DatenRechteNummern,
): Recht[] {
  const out: Recht[] = [];
  for (const { rolle, stufe } of rollen) {
    if (stufe === 'keine') continue;
    const add = (authId: number, dataId: number | null): void => {
      out.push({ rolle, authId, dataId });
    };
    add(n.modulSehen, null);
    // Entwürfe: lesen und schreiben (Teile neu anlegen, alte löschen – darum auch „löschen“).
    add(n.kategorieSehen, kat.entwuerfe);
    add(n.datenSehen, kat.entwuerfe);
    add(n.datenAnlegen, kat.entwuerfe);
    add(n.datenAendern, kat.entwuerfe);
    add(n.datenLoeschen, kat.entwuerfe);
    // Veröffentlicht: alle lesen, nur die Leitung schreibt.
    add(n.kategorieSehen, kat.veroeffentlicht);
    add(n.datenSehen, kat.veroeffentlicht);
    if (stufe === 'leitung') {
      add(n.datenAnlegen, kat.veroeffentlicht);
      add(n.datenAendern, kat.veroeffentlicht);
      add(n.datenLoeschen, kat.veroeffentlicht);
    }
  }
  return out;
}

/** **Was der Website gehört (und darum entzogen werden darf):** Daten-Rechte an UNSEREN zwei Kategorien. */
export function verwaltetVon(kat: Kategorien, n: DatenRechteNummern): (r: Recht) => boolean {
  const unsere = new Set([kat.entwuerfe, kat.veroeffentlicht]);
  return (r) => istDatenRechtAn(r, n, unsere);
}

/**
 * **Die Stufe einer Rolle, abgeleitet aus ihren Rechten** (`ist` = alle Rechte dieser einen Rolle):
 * - keine Daten-Rechte an unseren Kategorien → `keine`;
 * - sonst: schreibt sie in „Veröffentlicht“ → `leitung`, sonst `redakteur` – **aber nur, wenn die Rechte genau dem Soll dieser
 *   Stufe entsprechen** (nichts fehlt, nichts Überzähliges an unseren Kategorien, „Modul sehen“ ist da); sonst `abweicht`.
 *
 * `abweicht` heißt: Die Oberfläche zeigt „weicht ab“, bis ein Admin „Rechte setzen“ drückt. Bewusst nicht „die nächste
 * Stufe“ geraten – eine Rolle, die in „Veröffentlicht“ schreiben darf, aber in „Entwürfe“ nicht, ist keine Leitung.
 */
export function stufeAus(
  rolle: number,
  ist: readonly Recht[],
  kat: Kategorien,
  n: DatenRechteNummern,
): Stufe | 'abweicht' {
  const verwaltet = verwaltetVon(kat, n);
  const eigene = ist.filter((r) => r.rolle === rolle);
  if (!eigene.some(verwaltet)) return 'keine';
  const schreibtVeroeffentlicht = eigene.some(
    (r) =>
      r.dataId === kat.veroeffentlicht &&
      (r.authId === n.datenAnlegen || r.authId === n.datenAendern || r.authId === n.datenLoeschen),
  );
  const stufe: Stufe = schreibtVeroeffentlicht ? 'leitung' : 'redakteur';
  const soll = sollRechte([{ rolle, stufe }], kat, n);
  const p = rechteVergleichen(soll, eigene, verwaltet, n.modulSehen);
  return p.setzen.length === 0 && p.entziehen.length === 0 ? stufe : 'abweicht';
}

/** Eine Rolle mit der Stufe, die ChurchTools heute zeigt. */
export interface RolleIst {
  rolle: number;
  stufe: Stufe | 'abweicht';
}

/** Die Stufen aller Rollen, abgeleitet aus den Rechten (`ist` = Rechte aller dieser Rollen). */
export function stufenAus(
  rollen: readonly number[],
  ist: readonly Recht[],
  kat: Kategorien,
  n: DatenRechteNummern,
): RolleIst[] {
  return rollen.map((rolle) => ({ rolle, stufe: stufeAus(rolle, ist, kat, n) }));
}

/** Was „Wer darf was“ als Wahl vorbelegt: die Stufe aus den Rechten; bei „weicht ab“ der Vorschlag der Rolle. */
export function wahlAus(rollen: readonly GruppenRolle[], ist: readonly RolleIst[]): RollenStufe[] {
  const v = vorschlag(rollen);
  return v.map((r) => {
    const heute = ist.find((x) => x.rolle === r.rolle)?.stufe;
    return heute && heute !== 'abweicht' ? { rolle: r.rolle, stufe: heute } : r;
  });
}

/**
 * **Was beim Start dem Admin auffällt** (Muster der Protokolle, die Rechte beim Start prüfen):
 * - `nichts`: keine Rolle hat Rechte an der Website – noch nicht eingerichtet;
 * - `abweicht`: mindestens eine Rolle weicht vom Soll ihrer Stufe ab (von Hand verändert, oder ein früherer Versuch ist
 *   mittendrin gescheitert) – die Namen der Rollen stehen dabei;
 * - `null`: alles in Ordnung.
 */
export function rechteHinweis(
  rollen: readonly GruppenRolle[],
  ist: readonly RolleIst[],
): { art: 'nichts' } | { art: 'abweicht'; rollen: string[] } | null {
  const stufen = rollen.map((r) => ({ r, s: ist.find((x) => x.rolle === r.id)?.stufe ?? 'keine' }));
  const abweichend = stufen.filter((x) => x.s === 'abweicht').map((x) => x.r.name);
  if (abweichend.length > 0) return { art: 'abweicht', rollen: abweichend };
  if (stufen.every((x) => x.s === 'keine')) return { art: 'nichts' };
  return null;
}
