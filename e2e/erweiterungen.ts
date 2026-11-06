/**
 * **Die Erweiterungen im E2E-Lauf** (#845) – EINE Liste für die Dev-Server in `playwright.config.ts` und die
 * Rauchtests. Eigene Ports (528x), nicht die der Entwicklung (5176, 5178 …): Lokal laufen dort oft Dev-Server anderer
 * Arbeitskopien. Läuft auf einem dieser Ports doch ein Server aus einem anderen Ordner (etwa der E2E-Lauf einer
 * anderen Arbeitskopie), bricht der Lauf ab, statt still dessen Stand zu testen (`scripts/fremde-server.mjs`).
 */
export const ERWEITERUNGEN = [
  { app: 'anmeldungen', port: 5281 },
  { app: 'dienstplaner', port: 5282 },
  { app: 'organigramm', port: 5283 },
  { app: 'protokolle', port: 5284 },
  { app: 'gebetsabend', port: 5285 },
] as const;

export type Erweiterung = (typeof ERWEITERUNGEN)[number]['app'];

/** Adresse einer Erweiterung im Demo-Modus – `fall` wählt die Demo-Daten (`<app>/src/demo.ts`). */
export function demoAdresse(app: Erweiterung, fall = ''): string {
  const { port } = ERWEITERUNGEN.find((e) => e.app === app)!;
  return `http://localhost:${port}/ccm/${app}/?demo${fall ? `=${fall}` : ''}`;
}
