import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { WURZEL } from './quelltexte.testutil';

/**
 * **Ein leeres Datumsfeld bleibt am iPad eine Zeile hoch** (Alwin am iPad, 26.11.2026: Von/Bis im Liederheft als flache
 * Striche). iOS zeigt in einem leeren Datumsfeld nichts; ohne Inhalt fiel das Feld auf Rand und Polster zusammen, sobald
 * keine feste Höhe griff. Das Layout prüft jsdom nicht – gemessen wurde im iPad-Simulator (Liederheft leer 18 → 35 px,
 * Dienstplaner-Abfrage 18 → 36 px). Diese Prüfung hält die Regel im gemeinsamen Baustein fest.
 */
const mixins = readFileSync(join(WURZEL, 'ui/design/_mixins.scss'), 'utf8');

describe('Datumsfeld', () => {
  it('der Datumswert ist mindestens eine Zeile hoch – im Baustein, nicht je Stelle', () => {
    const baustein = mixins.slice(
      mixins.indexOf('@mixin datumsfeld'),
      mixins.indexOf('@mixin eingabefeld'),
    );
    expect(baustein).toMatch(/&::-webkit-date-and-time-value\s*\{[^}]*min-height:\s*1lh;/);
  });
});
