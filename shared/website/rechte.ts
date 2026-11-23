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
 * **Entzogen wird nur, was auf UNSERE Kategorien zeigt** (`verwaltetVon`); alles andere an der Rolle bleibt.
 *
 * **Untergruppen (W3b-4a, E-W28):** Jede eingerichtete Untergruppe hat ihre eigene `veroeffentlicht-g<Untergruppe>`
 * (`kat.untergruppen`); Entwürfe teilen sich alle (E-W19).
 *
 * | Rollen der …      | Stufe     | Entwürfe | Veröffentlicht der Website | Veröffentlicht der Untergruppe (je eigene) |
 * |-------------------|-----------|----------|-----------------------------|---------------------------------------------|
 * | Website           | Redakteur | schreiben| lesen                       | **alle** lesen                              |
 * | Website           | Leitung   | schreiben| schreiben                   | **alle** schreiben                          |
 * | Untergruppe       | Redakteur | schreiben| lesen (Messung W3b-4-0: neu)| nur die eigene lesen                        |
 * | Untergruppe       | Leitung   | schreiben| lesen                       | nur die eigene schreiben                    |
 *
 * Eine Rolle einer Untergruppe schreibt **nie** in „Veröffentlicht“ der Website oder einer anderen Untergruppe. Das Soll aller
 * Rollen der Website kommt aus EINER Funktion (`sollRechte`, mit `unter` für eine Untergruppe) – nicht aus zwei Nachbauten.
 */
import {
  istDatenRechtAn,
  rechteVergleichen,
  type DatenRechteNummern,
  type GruppenRolle,
  type Recht,
} from '../ct/rollenRechte';
import type { UntergruppenKategorie } from './einrichten';

export type { UntergruppenKategorie };

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

/** Die Kategorien der Website (IDs aus ChurchTools). */
export interface Kategorien {
  entwuerfe: number;
  veroeffentlicht: number;
  /**
   * Die Veröffentlicht-Kategorien aller **eingerichteten** Untergruppen (W3b-4a). Gehören zum Soll der Website-Rollen und zu
   * dem, was entzogen werden darf. Fehlt das Feld, gibt es keine.
   */
  untergruppen?: readonly UntergruppenKategorie[];
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

/**
 * **Das Soll** – welche Rechte die Rollen nach dem Einrichten haben müssen. `unter` fehlt: die Rollen gehören zur Gruppe
 * „Website“ (sie lesen bzw. schreiben auch in **allen** `kat.untergruppen`). `unter` gesetzt: die Rollen gehören zu dieser
 * Untergruppe (Entwürfe schreiben, Veröffentlicht der Website lesen, die eigene Kategorie lesen bzw. als Leitung schreiben).
 */
export function sollRechte(
  rollen: readonly RollenStufe[],
  kat: Kategorien,
  n: DatenRechteNummern,
  unter?: UntergruppenKategorie,
): Recht[] {
  const out: Recht[] = [];
  for (const { rolle, stufe } of rollen) {
    if (stufe === 'keine') continue;
    const add = (authId: number, dataId: number | null): void => {
      out.push({ rolle, authId, dataId });
    };
    const lesen = (k: number): void => {
      add(n.kategorieSehen, k);
      add(n.datenSehen, k);
    };
    const schreiben = (k: number): void => {
      add(n.datenAnlegen, k);
      add(n.datenAendern, k);
      add(n.datenLoeschen, k);
    };
    add(n.modulSehen, null);
    // Entwürfe: lesen und schreiben (Teile neu anlegen, alte löschen – darum auch „löschen“).
    lesen(kat.entwuerfe);
    schreiben(kat.entwuerfe);
    // Veröffentlicht der Website: alle lesen (auch Untergruppen – Messung W3b-4-0), nur die Leitung der Website schreibt.
    lesen(kat.veroeffentlicht);
    if (unter) {
      // Untergruppe: nur die eigene Kategorie, nie die einer anderen.
      lesen(unter.kategorie);
      if (stufe === 'leitung') schreiben(unter.kategorie);
      continue;
    }
    if (stufe === 'leitung') schreiben(kat.veroeffentlicht);
    // Website: alle Untergruppen lesen, die Leitung schreibt in alle.
    for (const u of kat.untergruppen ?? []) {
      lesen(u.kategorie);
      if (stufe === 'leitung') schreiben(u.kategorie);
    }
  }
  return out;
}

/**
 * **Was der Website gehört (und darum entzogen werden darf):** Daten-Rechte an UNSEREN Kategorien – Entwürfe, Veröffentlicht
 * der Website und die Veröffentlicht-Kategorien **aller** eingerichteten Untergruppen.
 */
export function verwaltetVon(kat: Kategorien, n: DatenRechteNummern): (r: Recht) => boolean {
  const unsere = new Set([
    kat.entwuerfe,
    kat.veroeffentlicht,
    ...(kat.untergruppen ?? []).map((u) => u.kategorie),
  ]);
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
  /** Die Rolle gehört zu dieser Untergruppe (W3b-4a) – dann zählt das Schreiben in IHRE Kategorie als Leitung. */
  unter?: UntergruppenKategorie,
): Stufe | 'abweicht' {
  const verwaltet = verwaltetVon(kat, n);
  const eigene = ist.filter((r) => r.rolle === rolle);
  if (!eigene.some(verwaltet)) return 'keine';
  const leitungsKategorie = unter ? unter.kategorie : kat.veroeffentlicht;
  const schreibtVeroeffentlicht = eigene.some(
    (r) =>
      r.dataId === leitungsKategorie &&
      (r.authId === n.datenAnlegen || r.authId === n.datenAendern || r.authId === n.datenLoeschen),
  );
  const stufe: Stufe = schreibtVeroeffentlicht ? 'leitung' : 'redakteur';
  const soll = sollRechte([{ rolle, stufe }], kat, n, unter);
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
  unter?: UntergruppenKategorie,
): RolleIst[] {
  return rollen.map((rolle) => ({ rolle, stufe: stufeAus(rolle, ist, kat, n, unter) }));
}

/**
 * **Die heutigen Stufen der Website-Rollen – zum Nachziehen** (W3b-4a): Wird eine Untergruppe eingerichtet, müssen die Rollen
 * der Website ihre neue Kategorie lesen bzw. schreiben, **mit den Stufen, die sie heute haben** (nicht neu vorbelegt). Die Stufe
 * kommt dabei nur aus Entwürfe und Veröffentlicht der Website – fehlende Rechte an den Untergruppen machen sie nicht zu
 * „weicht ab“ (die sollen ja gerade nachgezogen werden). Eine Rolle, die schon dort abweicht (von Hand verändert), wird **nicht**
 * angefasst: Raten wäre falsch, der Hinweis „Rechte weichen ab“ bleibt stehen.
 */
export function stufenZumNachziehen(
  rollen: readonly number[],
  ist: readonly Recht[],
  kat: Kategorien,
  n: DatenRechteNummern,
): RollenStufe[] {
  const kern: Kategorien = { entwuerfe: kat.entwuerfe, veroeffentlicht: kat.veroeffentlicht };
  return stufenAus(rollen, ist, kern, n).flatMap((r) =>
    r.stufe === 'abweicht' ? [] : [{ rolle: r.rolle, stufe: r.stufe }],
  );
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

/** Eine Untergruppe, wie „Wer darf was“ und die Prüfung beim Start sie sehen (W3b-4a). */
export interface UntergruppeStand {
  gruppe: number;
  name: string;
  /** Ihre Veröffentlicht-Kategorie – `null`: noch nicht eingerichtet. */
  kategorie: number | null;
  rollen: GruppenRolle[];
  /** Die Stufen aus den Rechten (leer, solange nicht eingerichtet). */
  ist: RolleIst[];
}

/** Was an einer Untergruppe auffällt: noch nicht eingerichtet, oder Rollen, deren Rechte abweichen. */
export type UntergruppenHinweis =
  | { name: string; art: 'nicht-eingerichtet' }
  | { name: string; art: 'abweicht'; rollen: string[] };

/**
 * **Die Untergruppen beim Start** (W3b-4a): nicht eingerichtet → Hinweis; eingerichtet, aber eine Rolle weicht ab → Hinweis mit
 * den Rollen. Eine eingerichtete Untergruppe, in der alle Rollen „Kein Zugriff“ haben, ist eine Entscheidung des Admins, kein
 * Hinweis.
 */
export function untergruppenHinweise(
  untergruppen: readonly UntergruppeStand[],
): UntergruppenHinweis[] {
  return untergruppen.flatMap((u): UntergruppenHinweis[] => {
    if (u.kategorie === null) return [{ name: u.name, art: 'nicht-eingerichtet' }];
    const h = rechteHinweis(u.rollen, u.ist);
    return h?.art === 'abweicht' ? [{ name: u.name, art: 'abweicht', rollen: h.rollen }] : [];
  });
}

/** Der Hinweis beim Start für die ganze Website: der der Gruppe „Website“ und die der Untergruppen. */
export type WebsiteHinweis =
  | (NonNullable<ReturnType<typeof rechteHinweis>> & { untergruppen?: UntergruppenHinweis[] })
  | { art: 'untergruppen'; untergruppen: UntergruppenHinweis[] };

/** Fügt beides zusammen – `null`, wenn nichts auffällt. Die Untergruppen stehen nur dabei, wenn es zu ihnen etwas gibt. */
export function websiteHinweis(
  website: ReturnType<typeof rechteHinweis>,
  untergruppen: readonly UntergruppenHinweis[],
): WebsiteHinweis | null {
  if (untergruppen.length === 0) return website;
  if (!website) return { art: 'untergruppen', untergruppen: [...untergruppen] };
  return { ...website, untergruppen: [...untergruppen] };
}
