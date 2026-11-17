// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { Person } from '@shared/organigramm/mitglieder';
import { Einladeliste } from './Planungsfelder';

afterEach(cleanup);

const p = (id: number, name: string): Person => ({
  id,
  name,
  bild: null,
  initialen: name.slice(0, 2),
});
const LISTE = [p(1, 'Alwin Friesen'), p(2, 'Johann Becker'), p(3, 'Spike Musiker')];

const zeige = (gewaehlt: number[], mitAlle?: boolean) => {
  const onChange = vi.fn();
  render(
    <Einladeliste
      liste={LISTE}
      gewaehlt={new Set(gewaehlt)}
      onChange={onChange}
      gesperrt={false}
      ich={1}
      mitAlle={mitAlle}
    />,
  );
  return onChange;
};

describe('Einladeliste', () => {
  it('ohne `mitAlle` (Einladungen) gibt es keinen Schalter „Alle“', () => {
    zeige([1]);
    expect(screen.queryByRole('checkbox', { name: /Alle/ })).toBeNull();
    expect(screen.getAllByRole('checkbox')).toHaveLength(3);
  });

  it('mit `mitAlle`: „Alle (3)“ oben; an wählt alle, aus wählt ab', () => {
    const an = zeige([1], true);
    const alle = screen.getByRole<HTMLInputElement>('checkbox', { name: 'Alle (3)' });
    expect(alle.checked).toBe(false);
    fireEvent.click(alle);
    expect([...an.mock.calls[0][0]].sort()).toEqual([1, 2, 3]);
    cleanup();
    const aus = zeige([1, 2, 3], true);
    const alle2 = screen.getByRole<HTMLInputElement>('checkbox', { name: 'Alle (3)' });
    expect(alle2.checked).toBe(true);
    fireEvent.click(alle2);
    expect([...aus.mock.calls[0][0]]).toEqual([]);
  });

  it('nur eine Person in der Liste: kein Schalter', () => {
    render(
      <Einladeliste
        liste={[LISTE[0]]}
        gewaehlt={new Set()}
        onChange={vi.fn()}
        gesperrt={false}
        ich={1}
        mitAlle
      />,
    );
    expect(screen.queryByRole('checkbox', { name: /Alle/ })).toBeNull();
  });
});
