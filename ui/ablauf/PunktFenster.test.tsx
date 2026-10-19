// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { ablaufZeileAus } from '@shared/ct/ablaufZeile';
import type { CtAgendaItem } from '@shared/ct/typen';
import { PunktFenster } from './PunktFenster';

/**
 * Das Punkt-Fenster als gemeinsamer Baustein (E6-2b-2). Die Musik-App steckt ihre Liedwahl ein (geprüft in
 * `client/src/components/ItemActionSheet.test.tsx`); hier zählt der Vertrag: **ohne** Liedwahl nur anzeigen
 * (Dienstplaner, „Lieder nur anzeigen"), **mit** Liedwahl füllt sie im Lied-Modus das Fenster und ihre Wahl wird
 * erst mit „Speichern" geschrieben.
 */
afterEach(cleanup);

const zeile = (item: Partial<CtAgendaItem>) =>
  ablaufZeileAus({ id: 1, title: 'Lied', duration: 300, ...item }, 7, 'Europe/Berlin');

function zeige(
  item = zeile({ song: { title: 'Treu' } as never }),
  liedWahl?: Parameters<typeof PunktFenster>[0]['liedWahl'],
) {
  const onUpdate = vi.fn().mockResolvedValue(undefined);
  const onClose = vi.fn();
  render(
    <PunktFenster
      item={item}
      onClose={onClose}
      onUpdate={onUpdate}
      vorBeginn={false}
      onSetVorBeginn={vi.fn().mockResolvedValue(undefined)}
      services={[]}
      onRequestDelete={vi.fn()}
      liedWahl={liedWahl}
    />,
  );
  return { onUpdate, onClose };
}

describe('PunktFenster ohne Liedwahl (Dienstplaner)', () => {
  it('zeigt das Lied nur an – kein „Lied verknüpfen", kein „Verknüpfung aufheben"', () => {
    zeige();
    expect(screen.getByText('Treu')).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Lied verknüpfen/ })).toBeNull();
    expect(screen.queryByRole('button', { name: /Verknüpfung aufheben/ })).toBeNull();
  });

  it('ohne Lied gibt es gar kein Feld „Lied"; die übrigen Felder werden gesammelt geschrieben', async () => {
    const { onUpdate, onClose } = zeige(zeile({ title: 'Predigt' }));
    expect(screen.queryByText('Lied', { selector: 'span' })).toBeNull();
    fireEvent.change(screen.getByPlaceholderText('z. B. 5'), { target: { value: '30' } });
    fireEvent.click(screen.getByRole('button', { name: 'Speichern' }));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(onUpdate).toHaveBeenCalledWith({ durationMin: 30 });
  });
});

describe('PunktFenster mit Liedwahl (Musik-App)', () => {
  it('„Lied verknüpfen" öffnet die Liedwahl; ihre Wahl ist vorgemerkt und geht mit „Speichern" raus', async () => {
    const { onUpdate } = zeige(zeile({ title: 'Lied' }), ({ onGewaehlt }) => (
      <button onClick={() => onGewaehlt(30, 'Halleluja')}>Halleluja wählen</button>
    ));
    fireEvent.click(screen.getByRole('button', { name: /Lied verknüpfen/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Halleluja wählen' }));
    expect(screen.getByText('Wird beim Speichern verknüpft.')).toBeTruthy();
    expect(onUpdate).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Speichern' }));
    await waitFor(() => expect(onUpdate).toHaveBeenCalledWith({ arrangementId: 30 }));
  });

  it('„Abbrechen" in der Liedwahl führt zurück, ohne etwas vorzumerken', () => {
    zeige(zeile({ title: 'Lied' }), ({ onAbbrechen }) => (
      <button onClick={onAbbrechen}>zurück</button>
    ));
    fireEvent.click(screen.getByRole('button', { name: /Lied verknüpfen/ }));
    fireEvent.click(screen.getByRole('button', { name: 'zurück' }));
    expect(screen.getByRole('button', { name: /Lied verknüpfen/ })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Speichern' })).toHaveProperty('disabled', true);
  });
});
