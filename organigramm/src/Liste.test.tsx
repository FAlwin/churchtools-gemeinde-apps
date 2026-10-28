// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { anfangsOffen, sichtbarerBaum } from '@shared/organigramm/ansichten';
import type { Knoten } from '@shared/organigramm/gruppen';
import { Liste } from './Liste';

const g = (id: number, name: string, kinder: Knoten[] = []): Knoten => ({
  gruppe: { id, name, typId: 2, statusId: 1, farbe: null },
  kinder,
});
const BAUM = [
  g(10, 'Gottesdienst', [g(7, 'Technik', [g(12, 'Stream'), g(15, 'Ton')]), g(8, 'Predigt')]),
  g(47, 'Café'),
];

afterEach(cleanup);

function zeigen(offen = anfangsOffen(BAUM)) {
  const onUmklappen = vi.fn();
  const onGruppe = vi.fn();
  render(
    <Liste
      sicht={sichtbarerBaum(BAUM, 'ECG', null, offen)}
      onUmklappen={onUmklappen}
      onGruppe={onGruppe}
    />,
  );
  return { onUmklappen, onGruppe };
}

describe('Liste (O7b-2)', () => {
  it('Gemeinde oben, Bereiche offen, darunter zu – mit Zahl der Untergruppen', () => {
    zeigen();
    const namen = screen.getAllByRole('listitem').map((li) => li.firstElementChild?.textContent);
    expect(namen).toEqual(['ECG', 'Gottesdienst', 'Technik2 Untergruppen', 'Predigt', 'Café']);
    expect(screen.queryByText('Stream')).toBeNull();
  });

  it('Pfeil klappt über den Schlüssel (Pfad) auf und zu; nur an Gruppen mit Untergruppen', () => {
    const { onUmklappen } = zeigen();
    const pfeil = screen.getByRole('button', { name: 'Technik aufklappen' });
    expect(pfeil.getAttribute('aria-expanded')).toBe('false');
    fireEvent.click(pfeil);
    expect(onUmklappen).toHaveBeenCalledWith('10/7');
    fireEvent.click(screen.getByRole('button', { name: 'Gottesdienst zuklappen' }));
    expect(onUmklappen).toHaveBeenLastCalledWith('10');
    expect(screen.queryByRole('button', { name: /Predigt (auf|zu)klappen/ })).toBeNull();
  });

  it('Klick auf eine Gruppe öffnet sie; die Gemeinde ist keine Gruppe und kein Knopf', () => {
    const { onGruppe } = zeigen();
    fireEvent.click(screen.getByRole('button', { name: 'Predigt' }));
    expect(onGruppe).toHaveBeenCalledWith(8);
    expect(screen.queryByRole('button', { name: 'ECG' })).toBeNull();
  });

  it('eine Untergruppe heißt „1 Untergruppe“', () => {
    zeigen(new Set());
    expect(screen.getByText('2 Untergruppen')).toBeTruthy();
    cleanup();
    render(
      <Liste
        sicht={sichtbarerBaum([g(1, 'A', [g(2, 'B')])], 'ECG', null, new Set(['gemeinde']))}
        onUmklappen={vi.fn()}
        onGruppe={vi.fn()}
      />,
    );
    expect(screen.getByText('1 Untergruppe')).toBeTruthy();
  });
});
