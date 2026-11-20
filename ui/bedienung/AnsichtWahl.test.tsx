// @vitest-environment jsdom
import { useState } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { AnsichtWahl } from './AnsichtWahl';

afterEach(cleanup);

const OPTIONEN = [
  { value: 'matrix', label: 'Matrix' },
  { value: 'raster', label: 'Personen' },
  { value: 'wer', label: 'Wer wie oft?' },
] as const;

function Halter({ handy }: { handy: boolean }) {
  const [v, setV] = useState<(typeof OPTIONEN)[number]['value']>('matrix');
  return <AnsichtWahl value={v} options={[...OPTIONEN]} onChange={setV} handy={handy} />;
}

describe('AnsichtWahl (R4/E9, B3)', () => {
  it('Rechner: der Umschalter mit allen drei Ansichten, die gewählte gedrückt', () => {
    render(<Halter handy={false} />);
    const gruppe = within(screen.getByRole('group', { name: 'Ansicht' }));
    expect(gruppe.getAllByRole('button').map((b) => b.textContent)).toEqual([
      'Matrix',
      'Personen',
      'Wer wie oft?',
    ]);
    fireEvent.click(gruppe.getByRole('button', { name: 'Personen' }));
    expect(gruppe.getByRole('button', { name: 'Personen' }).getAttribute('aria-pressed')).toBe(
      'true',
    );
  });

  it('Handy: ein Knopf mit dem Wort der gewählten Ansicht; ein Tipp klappt die Ansichten auf, die Wahl schließt', () => {
    render(<Halter handy />);
    expect(screen.queryByRole('group', { name: 'Ansicht' })).toBeNull();
    const knopf = screen.getByRole('button', { name: 'Ansicht: Matrix' });
    expect(knopf.textContent).toBe('Matrix');
    fireEvent.click(knopf);
    const blatt = screen.getByRole('dialog', { name: 'Ansicht' });
    expect(within(blatt).getByRole('button', { name: 'Matrix' }).getAttribute('aria-current')).toBe(
      'true',
    );
    fireEvent.click(within(blatt).getByRole('button', { name: 'Wer wie oft?' }));
    expect(screen.queryByRole('dialog', { name: 'Ansicht' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Ansicht: Wer wie oft?' })).toBeTruthy();
  });
});
