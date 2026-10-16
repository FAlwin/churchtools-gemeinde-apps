// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import { CtSymbol } from './CtSymbol';
import { hatChurchToolsSymbole } from './ctSchrift';

/** `document.fonts` wie in ChurchTools (gemessen 16.10.2026) – jsdom hat es nicht. */
const schriften = (familien: string[]) =>
  Object.defineProperty(document, 'fonts', {
    configurable: true,
    value: {
      forEach: (fn: (f: { family: string }) => void) =>
        familien.forEach((family) => fn({ family })),
    },
  });

afterEach(() => {
  cleanup();
  delete (document as { fonts?: unknown }).fonts;
});

describe('CtSymbol (E5-2)', () => {
  it('in ChurchTools: das Font-Awesome-Zeichen von ChurchTools (`fas fa-magic`), nichts kopiert', () => {
    schriften(['Font Awesome 7 Brands', '"Font Awesome Pro"', 'Lato']);
    expect(hatChurchToolsSymbole()).toBe(true);
    const { container } = render(<CtSymbol name="magic" size={14} />);
    expect(container.querySelector('i')?.className).toBe('fas fa-magic');
    expect(container.querySelector('svg')).toBeNull();
  });

  it('ohne `document.fonts` (Demo im Test): Ersatzsymbol', () => {
    expect(hatChurchToolsSymbole()).toBe(false);
  });

  it('nur die Brands-Schrift reicht nicht; ohne Schrift das Ersatzsymbol', () => {
    schriften(['Font Awesome 7 Brands']);
    expect(hatChurchToolsSymbole()).toBe(false);
    const { container } = render(<CtSymbol name="pen" size={14} />);
    expect(container.querySelector('i')).toBeNull();
    expect(container.querySelector('svg')).toBeTruthy();
  });
});
