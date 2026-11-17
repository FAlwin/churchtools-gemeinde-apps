// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { _bremseLoesen, _vergissCsrf } from '@ui/ct/verbindung';
import { demoStarten } from './demo';
import { ladeSitzungen } from './lesen';

/** W4: In `?demo` teilen Leitungsteam (11) und Technik-Team (19) den Kalender 4 – der Fall ist dort zu sehen. */
const MODUL = 20;
const echtesFetch = window.fetch;
const ZONE = 'Europe/Berlin';

beforeEach(() => {
  _vergissCsrf();
  _bremseLoesen();
  (window as { settings?: { base_url?: string } }).settings = { base_url: 'https://ct.test/' };
  demoStarten('x');
});
afterEach(() => {
  window.fetch = echtesFetch;
  delete (window as { settings?: unknown }).settings;
  vi.restoreAllMocks();
});

const titel = async (gruppe: number, protokolle: number) =>
  (await ladeSitzungen(MODUL, { id: gruppe, protokolle }, ZONE)).kommend.flatMap((s) =>
    s.termin && !s.kopf ? [s.titel] : [],
  );

describe('Demo: zwei Gruppen, ein Kalender', () => {
  it('Technik-Treffen (Gruppentreffen nur im Technik-Team) fehlt im Leitungsteam, Teamabend steht in beiden', async () => {
    const leitung = await titel(11, 60);
    const technik = await titel(19, 80);
    expect(leitung).not.toContain('Technik-Treffen');
    expect(technik).toContain('Technik-Treffen');
    expect(leitung).toContain('Teamabend');
    expect(technik).toContain('Teamabend');
    // Umgekehrt: die Leitungssitzung hat ihr Treffen im Leitungsteam.
    expect(technik).not.toContain('Leitungssitzung');
  });
});
