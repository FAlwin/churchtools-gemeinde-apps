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

describe('useAppNav – Direktlink aus dem Dienstplaner (E6-O O4)', () => {
  const hashSetzen = (h: string) => window.history.replaceState(null, '', `/app/${h}`);

  it('#/termin/5/punkt/9: Blatt im Ablauf dieses Termins, Ziel-Punkt 9 – vor dem gemerkten Stand', () => {
    gespeichert.nav = {
      tab: 'lieder',
      view: { type: 'chart', source: 'lieder' },
      serviceId: 77,
      songIndex: 3,
      libSel: { songId: 1 },
      savedAt: Date.now(),
    };
    hashSetzen('#/termin/5/punkt/9');
    const { result } = nav([DIENST]);
    expect(result.current.view).toEqual({ type: 'chart', source: 'setlist' });
    expect(result.current.service).toBe(DIENST);
    expect(result.current.zielPunkt).toBe(9);
    act(() => result.current.zielErreicht());
    expect(result.current.zielPunkt).toBeNull();
  });

  it('der Direktlink verschwindet aus der Adresse – ein Neuladen springt nicht wieder hin', () => {
    hashSetzen('#/termin/5/punkt/9');
    nav([DIENST]);
    expect(window.location.hash).toBe('');
    expect(window.location.pathname).toBe('/app/');
  });

  it('Termin nicht in der Liste: zurück zur Übersicht, kein Ziel mehr', () => {
    hashSetzen('#/termin/5/punkt/9');
    const { result } = nav([]);
    expect(result.current.view).toBeNull();
    expect(result.current.zielPunkt).toBeNull();
  });

  it('ohne Direktlink: wie bisher der gemerkte Stand, kein Ziel', () => {
    hashSetzen('');
    const { result } = nav([DIENST]);
    expect(result.current.view).toBeNull();
    expect(result.current.zielPunkt).toBeNull();
  });
});
