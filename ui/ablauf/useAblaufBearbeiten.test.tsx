// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { ablaufZeileAus, type AblaufZeile } from '@shared/ct/ablaufZeile';
import { useAblaufBearbeiten, type AblaufAktionen } from './useAblaufBearbeiten';

/**
 * Die Bearbeiten-Liste als Baustein (E6-2b-3). Die Wege der Musik-App prüfen `Setlist.*.test.tsx` und die E2E-Tests;
 * hier der Teil, den es vorher zweimal verschieden gab: **Zurückrollen nach einem Fehler – ohne „entfernt"-Platzhalter**
 * (#161). Bis E6-2b-3 rollten Ziehen und Löschen auf den Stand MIT Platzhaltern zurück, dann stand ein längst
 * entfernter Punkt plötzlich wieder in der Bearbeiten-Liste.
 */
afterEach(cleanup);

const zeile = (id: number, title: string): AblaufZeile =>
  ablaufZeileAus({ id, title, type: 'normal' }, 7, 'Europe/Berlin');
const ITEMS: AblaufZeile[] = [
  zeile(1, 'Begrüßung'),
  { ...zeile(2, 'Weg (entfernt)'), removed: true },
];

function Harness({ aktionen }: { aktionen: AblaufAktionen }) {
  const b = useAblaufBearbeiten({
    aktiv: true,
    bereit: true,
    items: ITEMS,
    beginn: '10:00',
    abgeschlossen: false,
    sperrHinweis: 'gesperrt',
    aktionen,
    dienste: [],
  });
  return (
    <>
      <div data-testid="liste">{b.liste}</div>
      {b.ueberlagerung}
    </>
  );
}

const aktionen = (over: Partial<AblaufAktionen> = {}): AblaufAktionen => ({
  reorder: vi.fn(() => Promise.resolve()),
  remove: vi.fn(() => Promise.resolve(null)),
  restore: vi.fn(() => Promise.resolve()),
  update: vi.fn(() => Promise.resolve()),
  setVorBeginn: vi.fn(() => Promise.resolve()),
  add: vi.fn(() => Promise.resolve()),
  ...over,
});

describe('useAblaufBearbeiten', () => {
  it('„entfernt"-Platzhalter stehen nie in der Bearbeiten-Liste – auch nicht nach einem gescheiterten Löschen', async () => {
    const a = aktionen({ remove: vi.fn(() => Promise.reject(new Error('Keine Berechtigung'))) });
    render(<Harness aktionen={a} />);
    const liste = screen.getByTestId('liste');
    expect(liste.textContent).toContain('Begrüßung');
    expect(liste.textContent).not.toContain('Weg (entfernt)');

    fireEvent.click(screen.getByRole('button', { name: 'Bearbeiten' }));
    fireEvent.click(screen.getByRole('button', { name: /Eintrag löschen/ }));
    fireEvent.click(screen.getByRole('button', { name: /^Löschen$/ }));
    expect(a.remove).toHaveBeenCalledWith(1);

    expect(await screen.findByText('Keine Berechtigung')).toBeTruthy();
    // Zurückgerollt: „Begrüßung" ist wieder da, der Platzhalter NICHT.
    expect(liste.textContent).toContain('Begrüßung');
    expect(liste.textContent).not.toContain('Weg (entfernt)');
  });

  it('ein Schreibfehler geht auch an `beiFehler` (Musik-App: bei 423 die Termine neu holen)', async () => {
    const fehler = new Error('abgeschlossen');
    const beiFehler = vi.fn();
    const a = aktionen({ remove: vi.fn(() => Promise.reject(fehler)) });
    function MitBeiFehler() {
      const b = useAblaufBearbeiten({
        aktiv: true,
        bereit: true,
        items: ITEMS,
        beginn: '10:00',
        abgeschlossen: false,
        sperrHinweis: 'gesperrt',
        aktionen: a,
        dienste: [],
        beiFehler,
      });
      return (
        <>
          {b.liste}
          {b.ueberlagerung}
        </>
      );
    }
    render(<MitBeiFehler />);
    fireEvent.click(screen.getByRole('button', { name: 'Bearbeiten' }));
    fireEvent.click(screen.getByRole('button', { name: /Eintrag löschen/ }));
    fireEvent.click(screen.getByRole('button', { name: /^Löschen$/ }));
    await waitFor(() => expect(beiFehler).toHaveBeenCalledWith(fehler));
  });
});
