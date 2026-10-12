/**
 * **Der Name der Gemeinde** aus ChurchTools (`GET /api/info` → `siteName`, gemessen 07.10.2026, auch
 * ohne Anmeldung; an der Test-Instanz 3.137.1 am 12.10.2026: „Evangeliumschristen- Gemeinde e.V."). Für
 * alle Erweiterungen (#474) – vorher nur in `client/src/services/ctLesen.ts`.
 *
 * `null`, wenn keiner drinsteht: Was dann gilt, entscheidet die App (Musik-App: ihr Standardname).
 */
export function gemeindeNameAus(info: unknown): string | null {
  const name = (info as { siteName?: unknown } | null | undefined)?.siteName;
  return typeof name === 'string' && name.trim() !== '' ? name.trim() : null;
}
