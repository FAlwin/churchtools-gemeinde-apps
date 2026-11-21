/**
 * **Die Zeichen der Aufzählung** (W11, Alwin 21.11.2026) – überall dieselben: Ebene 1 „•“, Ebene 2 „◦“, Ebene 3 und
 * tiefer „–“. Vorher gab es drei Regeln: der Editor • ◦ ▪ (BlockNote), die Lese-Ansicht Browser-Standard
 * (Scheibe/Kreis/Quadrat), das PDF immer „•“.
 *
 * EINE Quelle: das PDF ruft `aufzaehlungsZeichen` selbst; Editor und Lese-Ansicht stellen die Zeichen in SCSS ein
 * (`DokumentEditor.scss`, `ProtokollAnsicht.module.scss`) und können die Funktion nicht importieren – darum prüft
 * `ui/design/aufzaehlungsZeichen.test.ts`, dass beide Dateien dieselben Zeichen tragen.
 */

/** Die Zeichen der Ebenen 1, 2 und ab 3 (tiefer bleibt es beim Strich). */
export const AUFZAEHLUNG = ['•', '◦', '–'] as const;

/** Das Zeichen einer Aufzählung auf der Ebene `ebene` (0 = oberste). Ungültiges zählt als oberste. */
export function aufzaehlungsZeichen(ebene: number): string {
  const i = Number.isFinite(ebene) ? Math.max(0, Math.floor(ebene)) : 0;
  return AUFZAEHLUNG[Math.min(i, AUFZAEHLUNG.length - 1)];
}
