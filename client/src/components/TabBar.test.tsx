// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
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

  it('die Reiter sind dieselben, mit und ohne Namen (letzter bleibt „Einstellungen“, R13)', () => {
    render(<TabBar oben active="termine" tabs={[...tabs]} onChange={() => {}} />);
    const namen = screen.getAllByRole('button').map((b) => b.textContent);
    expect(namen).toEqual(['Termine', 'Lieder', 'Einstellungen']);
  });
});

describe('TabBar: der aktive Reiter noch einmal (Ablaufvorlagen bei „Termine“ schließen)', () => {
  const tabs = ['termine', 'lieder', 'mehr'] as const;

  it('Tipp auf den schon aktiven Reiter meldet `onErneut` mit seiner ID – und KEIN `onChange`', () => {
    const onChange = vi.fn();
    const onErneut = vi.fn();
    render(
      <TabBar oben active="termine" tabs={[...tabs]} onChange={onChange} onErneut={onErneut} />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Termine' }));
    expect(onErneut).toHaveBeenCalledExactlyOnceWith('termine');
    expect(onChange).not.toHaveBeenCalled();
  });

  it('Tipp auf einen anderen Reiter meldet `onChange`, nicht `onErneut`', () => {
    const onChange = vi.fn();
    const onErneut = vi.fn();
    render(
      <TabBar oben active="termine" tabs={[...tabs]} onChange={onChange} onErneut={onErneut} />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Einstellungen' }));
    expect(onChange).toHaveBeenCalledExactlyOnceWith('mehr');
    expect(onErneut).not.toHaveBeenCalled();
  });
});
