/**
 * **Was aus einem Termin-Baustein geworden ist** (W14) – ein Wert je Baustein in der Kategorie „Mitarbeit“ der Gruppe, nicht
 * im Protokoll: Freigegebene Protokolle bleiben unangetastet (sie sind schreibgeschützt, und ein Entwurf hat Schreibsperren).
 * Wie die To-Dos und die Vorschläge schreiben dort alle, die in der Gruppe Mitarbeit schreiben dürfen; wer wirklich
 * in den Kalender darf, entscheidet ChurchTools beim Anlegen.
 *
 * - Der **Schlüssel** (`id`) ist aus Protokoll und Block-ID gebaut: ein Wert je Baustein, ein zweiter Versuch findet den
 *   ersten vor. Zwei Werte mit derselben ID (abgebrochenes Anlegen) → der mit der kleinsten Wert-ID gilt (`derArt`).
 * - **Nie hart löschen:** „Nicht eintragen“ rückgängig machen heißt `offen`, kein Löschen. Wird das Protokoll gelöscht
 *   (W6) oder ein Termin-Baustein aus dem Protokoll entfernt, bekommt sein Stand den Vermerk `geloescht`
 *   (`terminStandNach`) – in „Mitarbeit“ darf niemand Werte löschen (S0, `sollRechte`), also bleibt der Wert, aber als
 *   Rest erkennbar. Steht der Baustein wieder im Protokoll (Rückgängig), fällt der Vermerk weg – wie bei den To-Dos
 *   (`aufgabenAbgleich`).
 * - **Ein Eintrag im Kalender wird von „Nicht eintragen“ und „Wieder anzeigen“ nie überschrieben** (`wennNochOffen`):
 *   Hat eine zweite Person den Termin inzwischen eingetragen, steht er in ChurchTools – der Vermerk bleibt.
 */
export type TerminAusgang = 'offen' | 'nichtEintragen' | 'imKalender';

export interface TerminStand {
  art: 'termin-stand';
  fassung: 1;
  id: string;
  gruppe: number;
  /** Protokoll (Kopf-ID) und Block-ID des Termin-Bausteins. */
  sitzung: string;
  block: string;
  stand: TerminAusgang;
  /** Nur bei `imKalender`: der Termin in ChurchTools – dazu Name und Zeit für die Anzeige („Gemeindekalender“, „ganztägig“). */
  kalender: { kalender: number; id: number; name: string; zeit: string } | null;
  von: number;
  /** ISO-Zeit. */
  am: string;
  /** Das Protokoll wurde gelöscht (W6) oder der Baustein steht nicht mehr darin – wer, wann. Fehlt bei allen anderen. */
  geloescht?: { von: number; am: string };
}

/** Der Schlüssel des Stands zu einem Baustein – auch die Zeilen-ID der Liste. */
export const terminStandId = (sitzung: string, block: string): string =>
  `termin-${sitzung}-${block}`;

export function istTerminStand(x: unknown): x is TerminStand {
  const s = x as Partial<TerminStand> | null;
  if (!s || s.art !== 'termin-stand' || s.fassung !== 1) return false;
  const k = s.kalender;
  return (
    typeof s.id === 'string' &&
    typeof s.gruppe === 'number' &&
    typeof s.sitzung === 'string' &&
    typeof s.block === 'string' &&
    (s.stand === 'offen' || s.stand === 'nichtEintragen' || s.stand === 'imKalender') &&
    typeof s.von === 'number' &&
    typeof s.am === 'string' &&
    (s.stand !== 'imKalender' ||
      (!!k &&
        typeof k.kalender === 'number' &&
        typeof k.id === 'number' &&
        typeof k.name === 'string' &&
        typeof k.zeit === 'string')) &&
    (k === null || k === undefined || typeof k === 'object') &&
    (s.geloescht === undefined ||
      (!!s.geloescht && typeof s.geloescht.von === 'number' && typeof s.geloescht.am === 'string'))
  );
}

/**
 * **Der Stand eines gelöschten Protokolls** (W6): derselbe Stand, dazu `geloescht`. Ein schon vermerkter bleibt, wie er
 * ist – ein zweiter Versuch schreibt nichts doppelt.
 */
export function terminStandGeloescht(s: TerminStand, von: number, am: string): TerminStand {
  return s.geloescht ? s : { ...s, geloescht: { von, am } };
}

/** **Der Baustein steht wieder im Protokoll** (Rückgängig): derselbe Stand ohne `geloescht`. Ohne Vermerk bleibt er, wie er ist. */
export function terminStandWiederDa(s: TerminStand): TerminStand {
  if (!s.geloescht) return s;
  const { geloescht: _weg, ...rest } = s;
  return rest;
}

/**
 * **Was aus einem Stand werden soll, wenn das Protokoll so aussieht** – die EINE Regel für Speichern und Löschen.
 * `bloecke` = die Termin-Bausteine im Dokument (Block-IDs aus `ableiten`), `null` = das Protokoll ist gelöscht (W6).
 * - Baustein nicht (mehr) im Protokoll → als gelöscht vermerkt (`terminStandGeloescht`);
 * - Baustein (wieder) da → ohne Vermerk (`terminStandWiederDa`) – auch nach einem Speichern, das den Vermerk geschrieben
 *   hat und danach scheiterte (der Abgleich läuft vor dem Protokoll).
 * Unverändert → **derselbe** Stand (gleiche Referenz) – dann wird nichts geschrieben. Stände anderer Sitzungen prüft der
 * Aufrufer vorher (`sitzung`).
 */
export function terminStandNach(
  s: TerminStand,
  bloecke: ReadonlySet<string> | null,
  von: number,
  am: string,
): TerminStand {
  return bloecke?.has(s.block) ? terminStandWiederDa(s) : terminStandGeloescht(s, von, am);
}

export interface TerminZiel {
  gruppe: number;
  sitzung: string;
  block: string;
}

/** Ein neuer Stand für einen Baustein (noch ohne Verlauf – der Stand ist die ganze Auskunft). */
export function neuerTerminStand(
  z: TerminZiel,
  stand: TerminAusgang,
  kalender: TerminStand['kalender'],
  von: number,
  am: string,
): TerminStand {
  return {
    art: 'termin-stand',
    fassung: 1,
    id: terminStandId(z.sitzung, z.block),
    gruppe: z.gruppe,
    sitzung: z.sitzung,
    block: z.block,
    stand,
    kalender: stand === 'imKalender' ? kalender : null,
    von,
    am,
  };
}

/**
 * **Den Stand nur setzen, solange der Termin nicht schon im Kalender steht.** `imKalender` bleibt, wie es ist – wer
 * gleichzeitig „Nicht eintragen“ wählt, löscht den Vermerk eines Termins nicht, der in ChurchTools schon existiert.
 */
export function wennNochOffen(alt: TerminStand, neu: TerminStand): TerminStand {
  return alt.stand === 'imKalender' ? alt : neu;
}

/** Die Stände einer Liste nach Schlüssel. */
export function standNachId(liste: readonly TerminStand[]): Map<string, TerminStand> {
  return new Map(liste.map((s) => [s.id, s]));
}
