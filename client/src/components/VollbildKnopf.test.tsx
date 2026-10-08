// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';

const schalter = vi.hoisted(() => ({ vollbildKnopf: false }));
vi.mock('../services/funktionen', async (original) => ({
  funktionen: {
    ...(await original<typeof import('../services/funktionen')>()).funktionen,
    get vollbildKnopf() {
      return schalter.vollbildKnopf;
    },
  },
}));

import { VollbildKnopf } from './VollbildKnopf';
import { setzeAppVollbild } from '../hooks/useAppVollbild';

afterEach(() => act(() => setzeAppVollbild(false)));

/** Der Knopf in Liederliste und Ablauf – nur in der Erweiterung (dort gibt es die ChurchTools-Leiste). */
describe('VollbildKnopf', () => {
  it('Homescreen-App: kein Knopf', () => {
    schalter.vollbildKnopf = false;
    const { container } = render(<VollbildKnopf />);
    expect(container.innerHTML).toBe('');
  });

  it('Erweiterung: „Vollbild" → nach dem Tipp „Vollbild beenden"', () => {
    schalter.vollbildKnopf = true;
    render(<VollbildKnopf />);
    fireEvent.click(screen.getByTitle('Vollbild'));
    expect(screen.getByTitle('Vollbild beenden')).toBeTruthy();
  });
});
