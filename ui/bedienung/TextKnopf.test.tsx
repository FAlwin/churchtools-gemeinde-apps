// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { TextKnopf } from './TextKnopf';

afterEach(cleanup);

describe('TextKnopf (R2 still, B4)', () => {
  it('ein Knopf mit seinem Wort; Klick ruft den Aufrufer', () => {
    const f = vi.fn();
    render(<TextKnopf onClick={f}>Alle Termine zeigen</TextKnopf>);
    fireEvent.click(screen.getByRole('button', { name: 'Alle Termine zeigen' }));
    expect(f).toHaveBeenCalledTimes(1);
  });

  it('gesperrt tut er nichts', () => {
    const f = vi.fn();
    render(
      <TextKnopf onClick={f} disabled>
        Weitere Wochen laden
      </TextKnopf>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Weitere Wochen laden' }));
    expect(f).not.toHaveBeenCalled();
  });
});
