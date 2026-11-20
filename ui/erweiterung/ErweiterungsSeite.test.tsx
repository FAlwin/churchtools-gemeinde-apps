// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { ErweiterungsSeite, type Bereiche } from './ErweiterungsSeite';

/**
 * **Die Reiter der Erweiterungen kommen aus EINER Stelle** (R4/E4/R7, „Ruhige Bedienung“ B2): am Rechner unterstrichen
 * unter dem App-Namen, die Lupe rechts daneben; am Handy unten in der Leiste, die Lupe neben dem App-Namen.
 */
afterEach(cleanup);

type Id = 'start' | 'planen';
const zustand = { art: 'fertig', vorname: 'Alwin', gemeinde: null } as const;
const bereiche = (onWechsel: (id: Id) => void = () => {}): Bereiche<Id> => ({
  reiter: [
    { id: 'start', label: 'Start', icon: 'home' },
    { id: 'planen', label: 'Planen', icon: 'calendar' },
  ],
  aktiv: 'start',
  onWechsel,
});
const lupe = <button type="button">Lupe</button>;

describe('ErweiterungsSeite: Bereiche und Lupe', () => {
  it('Rechner: Reiter im Kopf, unterstrichen (kein Umschalter), Lupe in derselben Zeile rechts', () => {
    const wechsel = vi.fn();
    render(
      <ErweiterungsSeite
        zustand={zustand}
        app="Test"
        bereiche={bereiche(wechsel)}
        lupe={lupe}
        onNochmal={() => {}}
      >
        <p>Inhalt</p>
      </ErweiterungsSeite>,
    );
    const nav = screen.getByRole('navigation', { name: 'Bereiche' });
    expect(nav.closest('header')).not.toBeNull();
    expect(screen.queryByRole('group', { name: 'Bereiche' })).toBeNull();
    // Die Lupe steht im selben Elternelement wie die Leiste (der Reiterzeile), nach ihr.
    expect(nav.parentElement).toBe(screen.getByRole('button', { name: 'Lupe' }).parentElement);
    expect(nav.nextElementSibling).toBe(screen.getByRole('button', { name: 'Lupe' }));
    fireEvent.click(within(nav).getByRole('button', { name: 'Planen' }));
    expect(wechsel).toHaveBeenCalledWith('planen');
  });

  it('Handy: Leiste unten (nicht im Kopf), Lupe neben dem App-Namen', () => {
    render(
      <ErweiterungsSeite
        zustand={zustand}
        app="Test"
        bereiche={bereiche()}
        handy
        lupe={lupe}
        onNochmal={() => {}}
      >
        <p>Inhalt</p>
      </ErweiterungsSeite>,
    );
    const nav = screen.getByRole('navigation', { name: 'Bereiche' });
    expect(nav.closest('header')).toBeNull();
    expect(nav.closest('main')).toBeNull();
    const knopf = screen.getByRole('button', { name: 'Lupe' });
    expect(knopf.closest('header')).not.toBeNull();
    expect(knopf.parentElement?.contains(screen.getByText('Test'))).toBe(true);
  });

  it('ohne Reiter: Lupe neben dem App-Namen, keine Leiste', () => {
    render(<ErweiterungsSeite zustand={zustand} app="Test" lupe={lupe} onNochmal={() => {}} />);
    expect(screen.queryByRole('navigation')).toBeNull();
    expect(
      screen
        .getByRole('button', { name: 'Lupe' })
        .parentElement?.contains(screen.getByText('Test')),
    ).toBe(true);
  });
});

describe('ErweiterungsSeite: Kopf (R8/E24, „Ruhige Bedienung“ B8b)', () => {
  const gemeindeZustand = { art: 'fertig', vorname: 'Alwin', gemeinde: 'ECG Donrath' } as const;

  it('oben steht nur der App-Name – ohne Gemeindenamen', () => {
    render(<ErweiterungsSeite zustand={gemeindeZustand} app="Test" onNochmal={() => {}} />);
    expect(screen.getByText('Test')).toBeTruthy();
    expect(screen.queryByText(/ECG Donrath/)).toBeNull();
  });

  it('„Hallo …“ nur, wenn der erste Reiter aktiv ist; `gruss={false}` sperrt es auch dort', () => {
    const { rerender } = render(
      <ErweiterungsSeite zustand={zustand} app="Test" bereiche={bereiche()} onNochmal={() => {}} />,
    );
    expect(screen.getByRole('heading', { name: 'Hallo Alwin' })).toBeTruthy();

    rerender(
      <ErweiterungsSeite
        zustand={zustand}
        app="Test"
        bereiche={{ ...bereiche(), aktiv: 'planen' }}
        onNochmal={() => {}}
      />,
    );
    expect(screen.queryByRole('heading', { name: 'Hallo Alwin' })).toBeNull();

    rerender(
      <ErweiterungsSeite
        zustand={zustand}
        app="Test"
        bereiche={bereiche()}
        gruss={false}
        onNochmal={() => {}}
      />,
    );
    expect(screen.queryByRole('heading', { name: 'Hallo Alwin' })).toBeNull();
  });

  it('Tipp auf den schon gewählten Reiter wechselt noch einmal dorthin (Rückweg aus Unterseiten, wie vor B2)', () => {
    const wechsel = vi.fn();
    const oeffnen = vi.fn();
    render(
      <ErweiterungsSeite
        zustand={zustand}
        app="Test"
        bereiche={bereiche(wechsel)}
        einstellungen={{ onOeffnen: oeffnen, offen: false }}
        onNochmal={() => {}}
      />,
    );
    const nav = screen.getByRole('navigation', { name: 'Bereiche' });
    fireEvent.click(within(nav).getByRole('button', { name: 'Start' }));
    expect(wechsel).toHaveBeenCalledWith('start');
    expect(oeffnen).not.toHaveBeenCalled();
  });

  it('Einstellungen: letzter Reiter, öffnet das Fenster der App und wechselt keinen Bereich', () => {
    const wechsel = vi.fn();
    const oeffnen = vi.fn();
    render(
      <ErweiterungsSeite
        zustand={zustand}
        app="Test"
        bereiche={bereiche(wechsel)}
        einstellungen={{ onOeffnen: oeffnen }}
        onNochmal={() => {}}
      />,
    );
    const nav = screen.getByRole('navigation', { name: 'Bereiche' });
    const namen = within(nav)
      .getAllByRole('button')
      .map((b) => b.textContent);
    expect(namen).toEqual(['Start', 'Planen', 'Einstellungen']);
    fireEvent.click(within(nav).getByRole('button', { name: 'Einstellungen' }));
    expect(oeffnen).toHaveBeenCalledOnce();
    expect(wechsel).not.toHaveBeenCalled();
    // Ein anderer Reiter wechselt weiter ganz normal.
    fireEvent.click(within(nav).getByRole('button', { name: 'Planen' }));
    expect(wechsel).toHaveBeenCalledWith('planen');
  });

  it('Einstellungen: hervorgehoben, solange das Fenster offen ist; der Bereich dahinter ist es dann nicht', () => {
    render(
      <ErweiterungsSeite
        zustand={zustand}
        app="Test"
        bereiche={bereiche()}
        einstellungen={{ onOeffnen: () => {}, offen: true }}
        onNochmal={() => {}}
      />,
    );
    const nav = screen.getByRole('navigation', { name: 'Bereiche' });
    expect(
      within(nav).getByRole('button', { name: 'Einstellungen' }).getAttribute('aria-pressed'),
    ).toBe('true');
    expect(within(nav).getByRole('button', { name: 'Start' }).getAttribute('aria-pressed')).toBe(
      'false',
    );
  });

  it('Einstellungen ohne weitere Reiter: ein einzelner Start-Reiter davor (`startName`), „Hallo …“ bleibt', () => {
    render(
      <ErweiterungsSeite
        zustand={zustand}
        app="Test"
        startName="Organigramm"
        einstellungen={{ onOeffnen: () => {} }}
        onNochmal={() => {}}
      />,
    );
    const nav = screen.getByRole('navigation', { name: 'Bereiche' });
    expect(
      within(nav)
        .getAllByRole('button')
        .map((b) => b.textContent),
    ).toEqual(['Organigramm', 'Einstellungen']);
    expect(screen.getByRole('heading', { name: 'Hallo Alwin' })).toBeTruthy();
  });

  it('ohne Einstellungen kein zusätzlicher Reiter (kein Recht = kein Reiter)', () => {
    render(
      <ErweiterungsSeite zustand={zustand} app="Test" bereiche={bereiche()} onNochmal={() => {}} />,
    );
    expect(screen.queryByRole('button', { name: 'Einstellungen' })).toBeNull();
    expect(screen.queryByRole('navigation')).not.toBeNull();
    cleanup();
    render(<ErweiterungsSeite zustand={zustand} app="Test" onNochmal={() => {}} />);
    expect(screen.queryByRole('navigation')).toBeNull();
  });

  it('Handy: Einstellungen steht als letzter Reiter unten in der Leiste', () => {
    render(
      <ErweiterungsSeite
        zustand={zustand}
        app="Test"
        bereiche={bereiche()}
        einstellungen={{ onOeffnen: () => {} }}
        handy
        onNochmal={() => {}}
      />,
    );
    const nav = screen.getByRole('navigation', { name: 'Bereiche' });
    expect(nav.closest('header')).toBeNull();
    const knoepfe = within(nav).getAllByRole('button');
    expect(knoepfe[knoepfe.length - 1].textContent).toBe('Einstellungen');
  });
});
