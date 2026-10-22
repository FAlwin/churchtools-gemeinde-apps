// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { ablaufZeileAus, punktStand, type AblaufZeile } from '@shared/ct/ablaufZeile';
import { useAblaufBearbeiten, verlangtNeuLaden, type AblaufAktionen } from './useAblaufBearbeiten';

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

function Harness({ aktionen, items = ITEMS }: { aktionen: AblaufAktionen; items?: AblaufZeile[] }) {
  const b = useAblaufBearbeiten({
    aktiv: true,
    bereit: true,
    items,
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
  setWeggelassen: vi.fn(() => Promise.resolve()),
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

describe('Auge in der Bearbeiten-Liste (E6-3b)', () => {
  const weg = ablaufZeileAus(
    { id: 5, title: 'Abkündigungen', type: 'normal', startTimes: { '7': null } },
    7,
    'Europe/Berlin',
  );

  it('die weggelassene Zeile steht grau mit Hinweis – wie in der Ansicht', () => {
    render(<Harness aktionen={aktionen()} items={[zeile(1, 'Begrüßung'), weg]} />);
    const liste = screen.getByTestId('liste');
    const zeileWeg = screen.getByText('Abkündigungen').closest('div[class*="flowRow"]')!;
    expect(zeileWeg.className).toMatch(/weggelassen/);
    expect(liste.textContent?.match(/an diesem Termin weggelassen/g)).toHaveLength(1);
  });

  it('der Schalter im Punkt-Fenster geht als `setWeggelassen` an die Aktionen – mit der ID des Punkts', async () => {
    const a = aktionen();
    render(<Harness aktionen={a} items={[weg]} />);
    fireEvent.click(screen.getByRole('button', { name: 'Bearbeiten' }));
    fireEvent.click(screen.getByRole('button', { name: /An diesem Termin weglassen/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Speichern' }));
    await waitFor(() => expect(a.setWeggelassen).toHaveBeenCalledWith(5, false));
  });
});

describe('Konflikt-Schutz in der Liste (E6-3c)', () => {
  it('Speichern schickt den Stand beim Öffnen als `gesehen`; „Trotzdem“ schickt keinen', async () => {
    const konflikt = Object.assign(new Error('Dieser Punkt wurde eben woanders geändert.'), {
      status: 412,
    });
    const a = aktionen({
      update: vi
        .fn<AblaufAktionen['update']>()
        .mockRejectedValueOnce(konflikt)
        .mockResolvedValue(undefined),
    });
    render(<Harness aktionen={a} />);
    fireEvent.click(screen.getByRole('button', { name: 'Bearbeiten' }));
    fireEvent.change(screen.getByPlaceholderText('Titel'), { target: { value: 'Willkommen' } });
    fireEvent.click(screen.getByRole('button', { name: 'Speichern' }));
    await screen.findByRole('alert');
    expect(a.update).toHaveBeenLastCalledWith(1, { title: 'Willkommen' }, punktStand(ITEMS[0]));
    fireEvent.click(screen.getByRole('button', { name: 'Trotzdem speichern' }));
    await waitFor(() =>
      expect(a.update).toHaveBeenLastCalledWith(1, { title: 'Willkommen' }, undefined),
    );
  });

  it('gleich wieder geöffnet: das Fenster zeigt das eben Gespeicherte und schickt es als `gesehen` – kein Konflikt mit sich selbst', async () => {
    const a = aktionen();
    render(<Harness aktionen={a} />);
    fireEvent.click(screen.getByRole('button', { name: 'Bearbeiten' }));
    fireEvent.change(screen.getByPlaceholderText('Optionale Notiz…'), {
      target: { value: 'leise' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Speichern' }));
    await waitFor(() => expect(a.update).toHaveBeenCalledTimes(1));
    // Der Server-Stand (items) ist noch der alte – das Neu-Lesen kommt erst später.
    fireEvent.click(screen.getByRole('button', { name: 'Bearbeiten' }));
    expect(screen.getByPlaceholderText('Optionale Notiz…')).toHaveProperty('value', 'leise');
    fireEvent.change(screen.getByPlaceholderText('Titel'), { target: { value: 'Willkommen' } });
    fireEvent.click(screen.getByRole('button', { name: 'Speichern' }));
    await waitFor(() => expect(a.update).toHaveBeenCalledTimes(2));
    expect(vi.mocked(a.update).mock.calls[1][2]).toMatchObject({ note: 'leise' });
  });

  it('`verlangtNeuLaden`: 404, 409, 412, 423 ja – 403, 500 und Netzfehler nein', () => {
    for (const status of [404, 409, 412, 423]) expect(verlangtNeuLaden({ status })).toBe(true);
    for (const status of [403, 500]) expect(verlangtNeuLaden({ status })).toBe(false);
    expect(verlangtNeuLaden(new Error('Netz weg'))).toBe(false);
    expect(verlangtNeuLaden(null)).toBe(false);
  });
});
