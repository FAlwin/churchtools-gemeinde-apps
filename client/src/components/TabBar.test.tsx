// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { APP_NAME, TabBar } from './TabBar';

afterEach(cleanup);

describe('TabBar: App-Name (R8/E24, „Ruhige Bedienung“ B8c)', () => {
  const tabs = ['termine', 'lieder', 'mehr'] as const;

  it('oben (iPad/Rechner) steht der App-Name klein über den Reitern', () => {
    render(<TabBar oben active="termine" tabs={[...tabs]} onChange={() => {}} />);
    expect(screen.getByText(APP_NAME)).toBeTruthy();
    expect(APP_NAME).toBe('Musik-App');
  });

  it('am Handy (Reiter unten) gibt es keinen Namen – die Seite beginnt gleich mit ihrem Kopf', () => {
    render(<TabBar active="termine" tabs={[...tabs]} onChange={() => {}} />);
    expect(screen.queryByText(APP_NAME)).toBeNull();
  });

  it('die Reiter sind dieselben, mit und ohne Namen (letzter bleibt „Mehr“)', () => {
    render(<TabBar oben active="termine" tabs={[...tabs]} onChange={() => {}} />);
    const namen = screen.getAllByRole('button').map((b) => b.textContent);
    expect(namen).toEqual(['Termine', 'Lieder', 'Mehr']);
  });
});
