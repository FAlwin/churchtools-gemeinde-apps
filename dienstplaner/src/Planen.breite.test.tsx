// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { planAus } from '@shared/dienstplan/plan';
import { DIENST_SPALTE, SPALTENBREITE } from '@shared/dienstplan/fenster';
import type { RohTermin } from '@shared/dienstplan/termine';
import { startFuer } from './start.testutil';
import { Planen } from './Planen';

/**
 * **S/M/L ist die Spaltenbreite – fest, ohne Strecken** (Alwin, 28.10.2026: „S/M kein Unterschied“; „Die Ansicht ist
 * einfach nach eigenen Vorlieben“). Vorher wurden die Spalten auf die volle Breite gezogen: S und M sahen fast gleich
 * aus und gar nicht verschieden, wenn alle Termine passten. Hier mit einer echten Breite (1100 px) – ohne sie zeigt die
 * Matrix alle Termine, und das Strecken griff in den übrigen Tests nie.
 */
vi.mock('./useBreite', () => ({ useBreite: () => [() => {}, 1100] }));

const START = startFuer();
// Zwei Termine – viel weniger, als in 1100 px passen: genau der Fall, in dem früher gestreckt wurde.
const ROH = [
  { id: 1, name: 'Gottesdienst', startDate: '2026-11-01T09:00:00Z' },
  { id: 2, name: 'Gebetsabend', startDate: '2026-11-04T18:00:00Z' },
].map((t) => ({
  ...t,
  eventServices: [{ serviceId: 6, personId: null, name: null }],
})) as RohTermin[];
const PLAN = planAus(ROH, {
  ichId: 1,
  dienste: START.dienste,
  dienstgruppen: START.dienstgruppen,
  zeitzone: 'Europe/Berlin',
  planbar: () => true,
  ganzSichtbar: () => true,
});

function zeige(breite: 's' | 'm' | 'l') {
  localStorage.setItem('dienstplaner.planen.ansicht', JSON.stringify({ breite }));
  render(
    <Planen
      zustand={{ art: 'fertig', zeilen: [], plan: PLAN, wochen: 8 }}
      handy={false}
      onNochmal={() => {}}
      onMehr={() => {}}
      mehrMoeglich={false}
      ladeZeitraum={() => new Promise<never>(() => {})}
      heute="2026-10-28"
    />,
  );
  return screen.getByRole('table');
}

beforeEach(() => localStorage.clear());
afterEach(cleanup);

describe('Matrix: S/M/L mit fester Spaltenbreite (28.10.2026)', () => {
  it.each(['s', 'm', 'l'] as const)('%s: Spalten so breit wie gewählt, nicht gestreckt', (b) => {
    const tabelle = zeige(b);
    expect(tabelle.style.getPropertyValue('--cw')).toBe(`${SPALTENBREITE[b]}px`);
    expect(tabelle.style.width).toBe(`${DIENST_SPALTE + 2 * SPALTENBREITE[b]}px`);
  });
});
