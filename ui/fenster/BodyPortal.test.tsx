// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { BEREICH_ATTRIBUT } from '../erweiterung/cssBereich';
import { BodyPortal } from './BodyPortal';

afterEach(cleanup);

describe('BodyPortal', () => {
  it('hängt an `body`, im App-Bereich (sonst fehlen dort Farben und Grundregeln – E6-6b)', () => {
    render(
      <table>
        <tbody>
          <tr>
            <td>
              <BodyPortal>
                <span>Fenster</span>
              </BodyPortal>
            </td>
          </tr>
        </tbody>
      </table>,
    );
    const el = screen.getByText('Fenster');
    expect(el.closest('table')).toBeNull();
    expect(el.closest(`[${BEREICH_ATTRIBUT}]`)?.parentElement).toBe(document.body);
  });
});
