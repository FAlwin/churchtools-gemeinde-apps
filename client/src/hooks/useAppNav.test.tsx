// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import type { Service } from '@shared/types/index';

const gespeichert = vi.hoisted((): { nav: unknown } => ({ nav: null }));
vi.mock('../utils/navStorage', () => ({
  loadNav: () => gespeichert.nav,
  saveNav: vi.fn(),
  clearNav: vi.fn(),
}));

import { useAppNav } from './useAppNav';

/**
 * Die Wiederherstellung nach einem Kaltstart (useAppNav). Alwin, 09.10.2026: „Lieder lassen sich
 * nicht aus der Liedliste öffnen – kurz auf, dann zurück", nur in der Test-Instanz. Ursache: Der
 * gemerkte Gottesdienst stand nicht (mehr) in der Terminliste, und die Suche danach lief bei JEDEM
 * Ansichtswechsel erneut – beim Öffnen eines Lieds aus der Liederliste setzte sie die Ansicht zurück.
 */
const DIENST = { id: 5 } as Service;
function nav(services: Service[]) {
  return renderHook(() =>
    useAppNav({ isAuthenticated: true, isAuthLoading: false, services, servicesLoading: false }),
  );
}

beforeEach(() => {
  gespeichert.nav = null;
});

describe('useAppNav – Wiederherstellung', () => {
  it('gemerkter Gottesdienst fehlt: ein Lied aus der Liederliste bleibt trotzdem offen', () => {
    gespeichert.nav = {
      tab: 'lieder',
      view: null,
      serviceId: 5,
      songIndex: 0,
      libSel: null,
      savedAt: Date.now(),
    };
    const { result } = nav([]);
    act(() => result.current.setView({ type: 'chart', source: 'lieder' }));
    expect(result.current.view).toEqual({ type: 'chart', source: 'lieder' });
  });

  it('Kaltstart mitten in einem Lied der Liederliste: bleibt offen, auch wenn der Gottesdienst fehlt', () => {
    gespeichert.nav = {
      tab: 'lieder',
      view: { type: 'chart', source: 'lieder' },
      serviceId: 5,
      songIndex: 0,
      libSel: { songId: 1 },
      savedAt: Date.now(),
    };
    const { result } = nav([]);
    expect(result.current.view).toEqual({ type: 'chart', source: 'lieder' });
  });

  it('wiederhergestellter Ablauf, Gottesdienst gefunden → wird ausgewählt', () => {
    gespeichert.nav = {
      tab: 'termine',
      view: { type: 'setlist' },
      serviceId: 5,
      songIndex: 0,
      libSel: null,
      savedAt: Date.now(),
    };
    const { result } = nav([DIENST]);
    expect(result.current.service?.id).toBe(5);
    expect(result.current.view).toEqual({ type: 'setlist' });
  });

  it('wiederhergestellter Ablauf, Gottesdienst weg → zurück zur Übersicht statt Lade-Schirm', () => {
    gespeichert.nav = {
      tab: 'termine',
      view: { type: 'setlist' },
      serviceId: 5,
      songIndex: 0,
      libSel: null,
      savedAt: Date.now(),
    };
    const { result } = nav([]);
    expect(result.current.view).toBeNull();
  });
});
