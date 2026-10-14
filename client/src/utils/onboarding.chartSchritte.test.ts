import { describe, expect, it } from 'vitest';
import { CHART_STEPS, chartSchritte } from './onboarding';

/** Die Einführung darf im Scroll-Modus (#551) nichts erklären, was dort nicht geht. */
describe('chartSchritte', () => {
  it('beim Blättern: unverändert', () => {
    expect(chartSchritte(false)).toBe(CHART_STEPS);
  });

  it('beim Scrollen: erster Schritt erklärt Scrollen, kein Wischen zur Seite und kein Zoomen', () => {
    const schritte = chartSchritte(true);
    expect(schritte).toHaveLength(CHART_STEPS.length);
    expect(schritte[0].title).toBe('Scrollen');
    expect(schritte[0].body).not.toMatch(/seitwärts|zoom/i);
    expect(schritte[0].selector).toBe(CHART_STEPS[0].selector);
    expect(schritte.slice(1)).toEqual(CHART_STEPS.slice(1));
  });
});
