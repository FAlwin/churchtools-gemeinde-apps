// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { Segment } from './Segment';

afterEach(cleanup);

describe('Segment', () => {
  const options = [
    { value: 'a', label: 'Eins' },
    { value: 'b', label: 'Zwei' },
    { value: 'c', label: 'Drei' },
  ];

  it('rendert alle Optionen', () => {
    render(<Segment value="a" options={options} onChange={() => {}} />);
    expect(screen.getByText('Eins')).toBeTruthy();
    expect(screen.getByText('Zwei')).toBeTruthy();
    expect(screen.getByText('Drei')).toBeTruthy();
  });

  it('meldet die gewählte Option beim Klick', () => {
    const onChange = vi.fn();
    render(<Segment value="a" options={options} onChange={onChange} />);
    fireEvent.click(screen.getByText('Zwei'));
    expect(onChange).toHaveBeenCalledWith('b');
  });

  /**
   * 02.10.2026: Die Kopie in den Abwesenheiten hatte `aria-pressed` und einen Gruppennamen, der
   * Baustein nicht. Seit sie ihn nutzt, muss er beides können – sonst verlören die Abwesenheiten es.
   */
  it('meldet Screenreadern Gruppe und gewählte Option', () => {
    render(<Segment ariaLabel="Zeitraum" value="b" options={options} onChange={() => {}} />);
    expect(screen.getByRole('group', { name: 'Zeitraum' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Zwei' }).getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByRole('button', { name: 'Eins' }).getAttribute('aria-pressed')).toBe('false');
  });

  it('nimmt einen Zähler in der Beschriftung mit', () => {
    render(
      <Segment
        value="a"
        onChange={() => {}}
        options={[
          { value: 'a', label: 'Termine' },
          {
            value: 'b',
            label: (
              <>
                Einträge<span>3</span>
              </>
            ),
          },
        ]}
      />,
    );
    expect(screen.getByRole('button', { name: /^Einträge\s*3$/ })).toBeTruthy();
  });
});
