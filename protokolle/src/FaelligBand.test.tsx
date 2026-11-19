// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { neueAufgabe } from '@shared/protokolle/aufgaben';
import { faellige, type Vorlauf } from '@shared/protokolle/hinweis';
import { FaelligBand } from './FaelligBand';

afterEach(cleanup);

const HEUTE = '2026-11-19';
const todo = (id: string, bis: string) =>
  neueAufgabe({ id, gruppe: 11, sitzung: null, text: id, wer: [1], bis, von: 1, am: 'x' });
const zeigen = (liste: ReturnType<typeof todo>[], vorlauf: Vorlauf | null, onZu = vi.fn()) => {
  render(
    <FaelligBand
      faellige={vorlauf === null ? null : faellige(liste, 1, HEUTE, vorlauf)}
      vorlauf={vorlauf}
      heute={HEUTE}
      onZuToDos={onZu}
    />,
  );
  return onZu;
};
const band = () => screen.queryByRole('region', { name: 'Fällige To-Dos' });

describe('FaelligBand', () => {
  it('überfällig: rot, fetter Anfang, Singular', () => {
    zeigen([todo('a', '2026-11-10')], 3);
    expect(band()!.getAttribute('data-art')).toBe('rot');
    expect(band()!.querySelector('b')!.textContent).toBe('1 To-Do überfällig');
  });

  it('überfällig und bald fällig: Plural, beides in einer Zeile', () => {
    zeigen([todo('a', '2026-11-10'), todo('b', '2026-11-11'), todo('c', '2026-11-21')], 3);
    expect(band()!.textContent).toContain('2 To-Dos überfällig, 1 bis Sa, 21.11. fällig');
  });

  it('nur bald fällig: ruhig (nicht rot), Zeitraum bei mehreren Fristen', () => {
    zeigen([todo('a', '2026-11-20'), todo('b', '2026-11-24')], 7);
    expect(band()!.getAttribute('data-art')).toBe('ruhig');
    expect(band()!.textContent).toContain('2 To-Dos in den nächsten 7 Tagen fällig');
  });

  it('nichts fällig, „Aus“, noch nicht gelesen: kein Band', () => {
    zeigen([todo('a', '2027-01-01')], 3);
    expect(band()).toBeNull();
    cleanup();
    zeigen([todo('a', '2026-11-10')], 'aus');
    expect(band()).toBeNull();
    cleanup();
    zeigen([todo('a', '2026-11-10')], null);
    expect(band()).toBeNull();
  });

  it('„Zu meinen To-Dos“ ruft den Weg in den Reiter', () => {
    const onZu = zeigen([todo('a', '2026-11-10')], 3);
    fireEvent.click(screen.getByRole('button', { name: /Zu meinen To-Dos/ }));
    expect(onZu).toHaveBeenCalledTimes(1);
  });
});
