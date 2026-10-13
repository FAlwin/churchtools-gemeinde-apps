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
import { idsAusRecht, rechteAntwortPruefen } from './rechte';

export interface DienstRechte {
  /**
   * Dienstgruppen, die man laut globalem Recht bearbeiten (= planen) darf. `null` = ChurchTools nennt
   * das Recht ohne Aufzählung → alle; dann nicht selbst eingrenzen.
   */
  planbareDienstgruppen: number[] | null;
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
