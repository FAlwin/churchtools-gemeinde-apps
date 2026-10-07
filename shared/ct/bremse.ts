/**
 * Die Bremse gegen die Überlastung von ChurchTools (#300) – was Server und Extension teilen (#335).
 *
 * Im Server bündelt der Prozess alle Geräte; in der Extension spricht jedes Gerät ChurchTools selbst an.
 * Gleich bleibt, wie eine Drosselung (429) gelesen wird und wie lange danach Ruhe ist.
 */

/** Sperrfrist nach einer Drosselung, wenn ChurchTools selbst keine nennt – lang genug zum Erholen. */
export const STANDARD_SPERRE_MS = 120_000;

/**
 * `Retry-After` lesen – beide erlaubten Formen (#300): Sekunden als Zahl **oder** ein HTTP-Datum.
 * `undefined`, wenn der Kopf fehlt oder unbrauchbar ist; nie ein negativer Wert.
 */
export function parseRetryAfter(header: string | null, now = Date.now()): number | undefined {
  if (!header) return undefined;
  const sekunden = Number(header.trim());
  if (Number.isFinite(sekunden)) return Math.max(0, sekunden * 1000);
  const datum = Date.parse(header);
  if (Number.isNaN(datum)) return undefined;
  return Math.max(0, datum - now);
}
