/**
 * Die Antwort der **alten** ChurchTools-Schnittstelle (`POST /index.php?q=churchservice/ajax`) lesen –
 * für beide Auslieferungen (#335, Phase 3b-2). Stand bis dahin in `server/src/services/ctAjax.ts`.
 *
 * Die Schnittstelle ist **undokumentiert und intern**; sie kann sich mit einem ChurchTools-Update ohne
 * Ankündigung ändern. Deshalb steht das Auswerten an genau einer Stelle. Geholt wird beim Aufrufer
 * (Server: `ctAjax`, Browser: `ctRuntime.ctAltAnfrage`, beide mit CSRF-Token und
 * `X-Requested-With`; aus dem Browser gemessen 07.10.2026, ohne Token → 401).
 */

export interface AjaxMeldungen {
  /** 401/403 – ChurchTools verweigert. */
  verweigert?: string;
  /** Anderer HTTP-Fehlschlag; bekommt den Statuscode angehängt. */
  abgelehnt?: string;
  /** Antwort war kein lesbares JSON (typisch: abgelaufene Sitzung → HTML-Anmeldeseite). */
  unlesbar?: string;
  /** `status` war nicht `success` und ChurchTools nannte keinen Grund. */
  fehlgeschlagen?: string;
  /**
   * Die **innere** Nutzlast war kein lesbares JSON – ein anderer Fall als `unlesbar`. Bei SongSelect ist
   * das der Unterschied zwischen „ChurchTools klemmt" und „CCLI klemmt".
   */
  innenUnlesbar?: string;
}

/** Die Meldungen mit ihren Vorgaben. */
export function ajaxMeldungen(m: AjaxMeldungen = {}): Required<AjaxMeldungen> {
  return {
    verweigert: m.verweigert ?? 'Keine Berechtigung für diese ChurchTools-Funktion.',
    abgelehnt: m.abgelehnt ?? 'ChurchTools hat die Anfrage abgelehnt',
    unlesbar: m.unlesbar ?? 'ChurchTools lieferte keine lesbare Antwort.',
    fehlgeschlagen: m.fehlgeschlagen ?? 'Die ChurchTools-Anfrage ist fehlgeschlagen.',
    innenUnlesbar: m.innenUnlesbar ?? 'Die Antwort von ChurchTools war nicht lesbar.',
  };
}

/**
 * Die Nutzlast aus dem Rumpf einer erfolgreichen HTTP-Antwort (200). Wirft (über `fehler`, Status 502)
 * bei unlesbarem Rumpf, `status !== 'success'` oder unlesbarer innerer Nutzlast.
 *
 * **Drei gemessene Formen von `data`** – alle kommen wirklich vor:
 *  - SongSelect-Suche und -Abfrage: `data` ist eine **Zeichenkette** mit der CCLI-Antwort darin.
 *  - SongSelect-Herunterladen: `data` ist ein Objekt `{ success, content }`, und erst `content` ist
 *    die Zeichenkette.
 *  - `getMasterData`: `data` ist direkt ein **Objekt** (Kategorien, Dienste, …).
 */
export function ajaxNutzlast(
  rumpf: string,
  meldungen: Required<AjaxMeldungen>,
  fehler: (status: number, meldung: string) => Error,
): unknown {
  let aussen: { status?: string; data?: unknown; message?: string };
  try {
    aussen = JSON.parse(rumpf) as typeof aussen;
  } catch {
    // Kommt vor, wenn die Sitzung abgelaufen ist: Dann liefert das alte Modul eine Anmeldeseite.
    throw fehler(502, meldungen.unlesbar);
  }
  if (aussen.status !== 'success') {
    throw fehler(502, aussen.message ?? meldungen.fehlgeschlagen);
  }
  const innen: unknown =
    typeof aussen.data === 'object' && aussen.data !== null && 'content' in aussen.data
      ? aussen.data.content
      : aussen.data;
  if (typeof innen !== 'string') return innen;
  try {
    return JSON.parse(innen);
  } catch {
    throw fehler(502, meldungen.innenUnlesbar);
  }
}
