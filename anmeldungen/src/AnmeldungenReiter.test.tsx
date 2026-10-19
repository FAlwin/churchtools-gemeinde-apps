// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { AnmeldungenReiter, type MitgliederZustand } from './AnmeldungenReiter';
import { STICHTAG, absage, dazu, e, mitglieder, stand } from '@shared/anmeldung/liste.testdaten';

/**
 * Reiter „Anmeldungen“ (A7-1). Die Daten kommen aus dem, was das Formular schreibt (`liste.testdaten.ts`); gerechnet
 * wird in `shared/anmeldung/liste.ts` (dort getestet) – hier nur, was man sieht und anklickt.
 */
function zeigen(zustand: MitgliederZustand | null, max: number | null = 10, entwurf = false) {
  const onNeuLaden = vi.fn();
  render(
    <AnmeldungenReiter
      e={e()}
      maxPlaetze={max}
      entwurf={entwurf}
      zustand={zustand}
      stichtag={STICHTAG}
      onNeuLaden={onNeuLaden}
    />,
  );
  return onNeuLaden;
}
const fertig = (
  roh = mitglieder('AAAAAA', [true, false], 10),
  verlauf = [dazu(10, '2026-10-17')],
) => ({ art: 'fertig', stand: { ...stand(roh, verlauf), verlaufGekuerzt: false } }) as const;

describe('Reiter Anmeldungen', () => {
  it('Zahlen, Hinweis „frei, aber jemand wartet“, eine Zeile je Anmeldung', () => {
    zeigen(fertig());
    expect(screen.getByText('1 von 10')).toBeTruthy();
    expect(screen.getByText(/9 Plätze frei – 1 wartet\./)).toBeTruthy();
    expect(screen.getByText(/Als Nächste wartet Lena Beispiel \(seit 17\.10\.\)/)).toBeTruthy();
    const zeile = screen.getByRole('button', { name: /Maria Beispiel/ });
    expect(zeile.textContent).toMatch(/AAAAAA.*Jonas 9.*Lena 7.*Warteliste 1.*6,00 €.*offen/);
  });

  it('kein Hinweis, wenn niemand wartet oder alles voll ist', () => {
    zeigen(fertig(mitglieder('AAAAAA', [true, true], 10)));
    expect(screen.queryByText(/warten?\./)).toBeNull();
    cleanup();
    // Voll (1 von 1), eine wartet – ChurchTools hat recht, niemand kann nachrücken.
    zeigen(fertig(), 1);
    expect(screen.getByText('kein Platz frei')).toBeTruthy();
    expect(screen.queryByText(/Als Nächste wartet/)).toBeNull();
  });

  it('Klick öffnet das Fenster: einmal oben mit Unterschrift, je Person die Antworten', () => {
    zeigen(fertig());
    fireEvent.click(screen.getByRole('button', { name: /Maria Beispiel/ }));
    expect(screen.getByText('Für die ganze Anmeldung · gilt für Jonas, Lena')).toBeTruthy();
    expect(screen.getByRole('img', { name: 'Unterschrift' })).toBeTruthy();
    expect(screen.getByText('✓ Maria Beispiel, 17.10.2026')).toBeTruthy();
    expect(screen.getByText('Jonas Beispiel, 9')).toBeTruthy();
    expect(screen.getByText('Nüsse')).toBeTruthy();
    expect(screen.getAllByText('Warteliste 1').length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole('button', { name: 'Schließen' }));
    expect(screen.queryByText(/Für die ganze Anmeldung/)).toBeNull();
  });

  it('Filter Warteliste, Abgesagt und Suche', () => {
    const [jonas, lena] = mitglieder('AAAAAA', [true, false], 10);
    zeigen(fertig([lena], [absage(jonas, '2026-10-18', 10)]));
    fireEvent.click(screen.getByRole('button', { name: /^Warteliste/ }));
    expect(screen.getByRole('button', { name: /1 · Lena Beispiel/ })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /^Abgesagt/ }));
    const ab = screen.getByText('Jonas Beispiel').closest('li')!;
    expect(within(ab).getByText(/am 18\.10\. selbst abgesagt/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /^Alle/ }));
    fireEvent.change(screen.getByRole('searchbox', { name: 'Name suchen' }), {
      target: { value: 'xyz' },
    });
    expect(screen.getByText('Niemand mit „xyz“ gefunden.')).toBeTruthy();
  });

  it('Entwurf, ohne Recht, Fehler mit „Nochmal“', () => {
    zeigen(null, 10, true);
    expect(screen.getByText('Noch keine Anmeldungen.')).toBeTruthy();
    cleanup();
    zeigen({ art: 'verboten' });
    expect(screen.getByText(/Mitglieder dieser Gruppe sehen darf/)).toBeTruthy();
    cleanup();
    const neu = zeigen({ art: 'fehler', text: 'ChurchTools antwortet gerade nicht.' });
    fireEvent.click(screen.getByRole('button', { name: 'Nochmal' }));
    expect(neu).toHaveBeenCalled();
  });
});
