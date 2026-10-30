/**
 * **Was der Dienstplaner aus den globalen ChurchTools-Rechten liest** (`GET /permissions/global`,
 * Bauplan E2). Gemessen an der Test-Instanz (08. und 13.10.2026): Die Rechte im Block `churchservice`
 * sind Listen von IDs – `edit servicegroup: [1,3,4]` (Dienstgruppen), `edit agenda: [1,…,5]`
 * (Kalender) –, `manage absent` ist ja/nein. Ein Mitglied ohne Sonderrecht hat überall `[]`/`false`.
 *
 * **Das ist nur der globale Teil.** Planen darf außerdem, wer die ChurchTools-Gruppe des Dienstes
 * leitet oder Admin des Termins ist (gemessen 08.10.2026) – zusammen in `darfDienstPlanen`.
 *
 * Gelesen wird über dieselben Regeln wie die Rechte der Musik-App (`rechte.ts`): leere Antwort =
 * Aussetzer (wirft), Listen über `idsAusRecht`.
 */
import { dienstgruppenAus, type Dienstgruppe } from './dienstgruppen';
import type { InfoGruppe } from '../types/index';
import { idsAusRecht, rechteAntwortPruefen } from './rechte';

export interface DienstRechte {
  /**
   * Dienstgruppen, die man laut globalem Recht bearbeiten (= planen) darf. `null` = ChurchTools nennt
   * das Recht ohne Aufzählung → alle; dann nicht selbst eingrenzen.
   */
  planbareDienstgruppen: number[] | null;
  /** Dienstgruppen, die man ganz sehen darf (`view servicegroup`); `null` = alle. */
  sichtbareDienstgruppen: number[] | null;
  /** Kalender, in denen man Abläufe bearbeiten darf (`edit agenda`); `null` = alle. */
  ablaufKalender: number[] | null;
  /** Abwesenheiten aller sehen und pflegen (`manage absent`). */
  abwesenheitenAller: boolean;
}

export function dienstRechteAus(
  data: Record<string, Record<string, unknown>> | null | undefined,
  fehler: (status: number, meldung: string) => Error,
): DienstRechte {
  rechteAntwortPruefen(data, fehler);
  const cs = data.churchservice ?? {};
  return {
    planbareDienstgruppen: idsAusRecht(cs['edit servicegroup']),
    sichtbareDienstgruppen: idsAusRecht(cs['view servicegroup']),
    ablaufKalender: idsAusRecht(cs['edit agenda']),
    abwesenheitenAller: cs['manage absent'] === true,
  };
}

/** Darf man laut globalem Recht diese Dienstgruppe planen? Dieselbe Regel für Anzeige und Senden. */
export function darfDienstgruppePlanen(rechte: DienstRechte, dienstgruppeId: number): boolean {
  return (
    rechte.planbareDienstgruppen === null || rechte.planbareDienstgruppen.includes(dienstgruppeId)
  );
}

/**
 * **Darf man diesen Dienst planen?** – die eine Regel für Anzeige, Zählen und (ab E4) Senden. Gemessen
 * an der Test-Instanz (08.10.2026, E0 §2): einteilen darf, wer
 * 1. die Dienstgruppe global bearbeiten darf (`darfDienstgruppePlanen`), **oder**
 * 2. eine der ChurchTools-Gruppen des Dienstes **leitet** (`groupIds` am Dienst; bei der ECG hat jeder Dienst
 *    eine, gemessen 13.10.2026), **oder**
 * 3. Admin dieses Termins ist (`terminAdmin`, je Termin).
 */
export function darfDienstPlanen(
  rechte: DienstRechte,
  dienst: { dienstgruppeId: number | null; gruppenIds: number[] },
  geleiteteGruppen: ReadonlySet<number>,
  terminAdmin = false,
): boolean {
  if (terminAdmin) return true;
  if (dienst.dienstgruppeId !== null && darfDienstgruppePlanen(rechte, dienst.dienstgruppeId))
    return true;
  return dienst.gruppenIds.some((g) => geleiteteGruppen.has(g));
}

/**
 * **Liefert ChurchTools die Plätze dieses Dienstes vollständig?** Gemessen an der Test-Instanz (13.10.2026,
 * Prüfung mit drei Rollen): ChurchTools gibt alle Plätze eines Dienstes heraus, wenn die Dienstgruppe für
 * alle sichtbar ist (`viewAll`), wenn man sie sehen oder bearbeiten darf, oder wenn man eine
 * ChurchTools-Gruppe des Dienstes leitet. Sonst kommen nur die **eigenen** Einträge – eine Matrix daraus
 * zeigte die übrigen Plätze als „nicht vorgesehen“, und „Wer wie oft?“ ließe Leute aus. Termin-Admin zählt
 * hier nicht: Die Matrix-Zeile reicht über viele Termine.
 */
export function siehtDienstGanz(
  rechte: DienstRechte,
  dienst: { dienstgruppeId: number | null; gruppenIds: number[] },
  gruppeFuerAlle: boolean,
  geleiteteGruppen: ReadonlySet<number>,
): boolean {
  if (gruppeFuerAlle) return true;
  const gid = dienst.dienstgruppeId;
  if (gid !== null && siehtDienstgruppe(rechte, { id: gid, fuerAlle: gruppeFuerAlle })) return true;
  return darfDienstPlanen(rechte, dienst, geleiteteGruppen);
}

/**
 * **Sieht man diese Dienstgruppe?** – der Kern von `siehtDienstGanz`, ohne die Gruppenleitung eines einzelnen Dienstes:
 * „für alle sichtbar“ (`viewAll`), oder man darf sie sehen (`view servicegroup`) oder bearbeiten (`edit servicegroup`).
 * Danach filtert ChurchTools auch die Gruppen-Infos eines Ablaufpunkts (`serviceGroupNotes`, gemessen 22.10.2026:
 * Spike mit Sicht nur auf Technik bekam Programm (`viewAll`) und Technik, nicht Musik).
 */
export function siehtDienstgruppe(
  rechte: Pick<DienstRechte, 'sichtbareDienstgruppen' | 'planbareDienstgruppen'>,
  gruppe: { id: number; fuerAlle: boolean },
): boolean {
  if (gruppe.fuerAlle) return true;
  if (rechte.sichtbareDienstgruppen === null || rechte.sichtbareDienstgruppen.includes(gruppe.id)) {
    return true;
  }
  return rechte.planbareDienstgruppen === null || rechte.planbareDienstgruppen.includes(gruppe.id);
}

/**
 * **Sieht man alle Dienstgruppen?** Wenn nicht, löscht man beim Ändern oder Umsortieren eines Ablaufpunkts unbemerkt die
 * Gruppen-Infos, die man nicht sieht: `PUT …/agenda/items/{id}` ersetzt sie, und man kann nur mitschicken, was
 * ChurchTools einem gezeigt hat (gemessen 22.10.2026, `messung-2026-10-07.md` E6-4-0). Musik-App und Dienstplaner
 * zeigen dann einen Hinweis.
 */
export function siehtAlleDienstgruppen(
  rechte: Pick<DienstRechte, 'sichtbareDienstgruppen' | 'planbareDienstgruppen'>,
  gruppen: readonly { id: number; fuerAlle: boolean }[],
): boolean {
  return gruppen.every((g) => siehtDienstgruppe(rechte, g));
}

/**
 * **Die Dienstgruppen, deren Infos man sieht** (E6-4) – in der Reihenfolge der Gemeinde, nur Nummer und Name. Dieselbe
 * Regel, nach der ChurchTools die Infos eines Punkts filtert (`siehtDienstgruppe`). Eine Stelle für Dienstplaner und
 * Musik-App.
 */
export function infoGruppen(
  rechte: Pick<DienstRechte, 'sichtbareDienstgruppen' | 'planbareDienstgruppen'>,
  gruppen: readonly Dienstgruppe[],
): InfoGruppe[] {
  return gruppen.filter((g) => siehtDienstgruppe(rechte, g)).map(({ id, name }) => ({ id, name }));
}

/**
 * `siehtAlleDienstgruppen` und `infoGruppen` aus den Rohantworten (`/permissions/global`, `/servicegroups`) – für die
 * Rechte der Musik-App (Server und Erweiterung, eine Stelle). `undefined`, wenn die Dienstgruppen nicht als Liste
 * kamen: Dann ist es unbekannt, und die Rechte scheitern daran nicht (vorübergehend ist nicht ungültig).
 */
export function dienstgruppenSichtAus(
  rechteRoh: Record<string, Record<string, unknown>>,
  dienstgruppenRoh: unknown,
): { siehtAlle: boolean; infoGruppen: InfoGruppe[] } | undefined {
  if (!Array.isArray(dienstgruppenRoh)) return undefined;
  const rechte = dienstRechteAus(rechteRoh, (_status, meldung) => new Error(meldung));
  const gruppen = dienstgruppenAus(dienstgruppenRoh);
  return {
    siehtAlle: siehtAlleDienstgruppen(rechte, gruppen),
    infoGruppen: infoGruppen(rechte, gruppen),
  };
}
