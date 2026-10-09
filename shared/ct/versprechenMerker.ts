/**
 * **Ein Versprechen merken – und bei einem Fehlschlag wieder vergessen** (#463).
 *
 * Die Erweiterung fragt manches nur einmal je Sitzung der Seite (die eigene Modul-ID, die
 * Lied-Stammdaten, das CSRF-Token) oder kurz gemerkt (Statistik, fremde Ablagen). Gemerkt wird das
 * **Versprechen**, nicht das Ergebnis: Fragen drei Stellen gleichzeitig, läuft nur EIN Abruf.
 *
 * Diese Mechanik stand fünfmal von Hand da (`ctLesen` zweimal, `ctModulDaten`, `ctRuntime`,
 * `ctTeilen`) – und die Kopien wichen schon voneinander ab: Nur eine hatte den **Wächter**, der beim
 * Vergessen prüft, ob der Eintrag noch DERSELBE ist. Ohne ihn löscht ein spät scheiterndes altes
 * Versprechen einen inzwischen neueren, guten Eintrag (`ctTeilen`). Deshalb liegt sie hier einmal:
 *
 * - **Fehlschlag wird nicht gemerkt** – vorübergehend ist nicht ungültig; der nächste Aufruf fragt neu.
 * - **`behalten`** – manche Ergebnisse sind „kein Fehler, aber auch nichts wert" (CSRF-Token `null`):
 *   Die werden ebenfalls nicht gemerkt.
 * - **Immer mit Wächter** – vergessen wird nur der eigene Eintrag.
 *
 * Werte mit Verfallszeit (nicht Versprechen) gehören in `ttlMemo.ts`; einen teuren Lauf mit Sperrfrist
 * nach einer Drosselung regelt `gebuendelterLauf.ts`.
 */
export interface VersprechenMerker<T> {
  /** Das gemerkte Versprechen zu `schluessel` – oder `laden()` starten und merken. */
  hole(schluessel: string | number, laden: () => Promise<T>): Promise<T>;
  /** Einen Eintrag vergessen; ohne Schlüssel alle. */
  vergiss(schluessel?: string | number): void;
}

export function merkeVersprechen<T>(
  opts: {
    /** So lange gilt ein Eintrag (ms). Ohne Angabe: bis er vergessen wird. */
    ttlMs?: number;
    /** `false` → dieses Ergebnis nicht merken (z. B. ein leeres Token). */
    behalten?: (wert: T) => boolean;
  } = {},
): VersprechenMerker<T> {
  const ttlMs = opts.ttlMs ?? Infinity;
  const eintraege = new Map<string, { at: number; versprechen: Promise<T> }>();

  function vergissWennNochMeins(schluessel: string, versprechen: Promise<T>): void {
    if (eintraege.get(schluessel)?.versprechen === versprechen) eintraege.delete(schluessel);
  }

  return {
    hole(schluessel, laden) {
      const k = String(schluessel);
      const da = eintraege.get(k);
      if (da && Date.now() - da.at < ttlMs) return da.versprechen;
      const versprechen = laden();
      eintraege.set(k, { at: Date.now(), versprechen });
      versprechen.then(
        (wert) => {
          if (opts.behalten && !opts.behalten(wert)) vergissWennNochMeins(k, versprechen);
        },
        () => vergissWennNochMeins(k, versprechen),
      );
      return versprechen;
    },
    vergiss(schluessel) {
      if (schluessel === undefined) eintraege.clear();
      else eintraege.delete(String(schluessel));
    },
  };
}
