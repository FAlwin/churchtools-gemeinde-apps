// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import { Werkzeugzeile } from './Werkzeugzeile';

afterEach(cleanup);

describe('Werkzeugzeile (R5/R12, B3)', () => {
  it('drei Bereiche in der Reihenfolge links, Mitte, rechts – in einer Zeile mit dem Namen „Werkzeuge“', () => {
    render(
      <Werkzeugzeile
        links={<button type="button">Ansicht</button>}
        mitte={<button type="button">Zeitraum</button>}
        rechts={<button type="button">Filter</button>}
      />,
    );
    const zeile = screen.getByRole('toolbar', { name: 'Werkzeuge' });
    expect(
      within(zeile)
        .getAllByRole('button')
        .map((b) => b.textContent),
    ).toEqual(['Ansicht', 'Zeitraum', 'Filter']);
  });

  it('ohne Mitte gibt es keinen leeren Mittelbereich', () => {
    const { container } = render(<Werkzeugzeile links={<i>a</i>} rechts={<i>b</i>} />);
    expect(container.firstElementChild?.children).toHaveLength(2);
  });

  it('Handy: dieselben Bereiche, nur mit der Handy-Klasse (zweizeilig, Rahmen am Knopf)', () => {
    const rechner = render(<Werkzeugzeile mitte={<i>m</i>} />);
    const klasseRechner = rechner.container.firstElementChild?.className;
    cleanup();
    const handy = render(<Werkzeugzeile mitte={<i>m</i>} handy />);
    expect(handy.container.firstElementChild?.className).not.toBe(klasseRechner);
    expect(handy.container.firstElementChild?.children).toHaveLength(3);
  });
});
