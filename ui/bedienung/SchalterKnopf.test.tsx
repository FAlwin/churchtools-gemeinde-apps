// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { SchalterKnopf } from './SchalterKnopf';

describe('SchalterKnopf', () => {
  it('die ganze Zeile ist der Knopf: Name, aria-pressed, ein Tipp meldet sich', () => {
    const klick = vi.fn();
    const { rerender } = render(
      <SchalterKnopf an={false} onClick={klick}>
        JuLeiCa
      </SchalterKnopf>,
    );
    const knopf = screen.getByRole('button', { name: 'JuLeiCa' });
    expect(knopf.getAttribute('aria-pressed')).toBe('false');
    fireEvent.click(knopf);
    expect(klick).toHaveBeenCalledTimes(1);
    rerender(
      <SchalterKnopf an onClick={klick}>
        JuLeiCa
      </SchalterKnopf>,
    );
    expect(screen.getByRole('button', { name: 'JuLeiCa' }).getAttribute('aria-pressed')).toBe(
      'true',
    );
  });

  it('gesperrt: kein Klick', () => {
    const klick = vi.fn();
    render(
      <SchalterKnopf an={false} disabled onClick={klick}>
        Halb
      </SchalterKnopf>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Halb' }));
    expect(klick).not.toHaveBeenCalled();
  });
});
