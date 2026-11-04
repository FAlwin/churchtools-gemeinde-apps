// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { ABSENCES_KEY, useAbsencesRefresh } from './useAvailability';

/**
 * #177: Nach Anlegen oder Löschen muss die eigene Liste neu geholt werden – sonst zeigt der Termin
 * weiter „Kann nicht", obwohl die Abmeldung längst in ChurchTools steht. Die Termine selbst ändern
 * sich durch eine Abwesenheit nicht und werden NICHT verworfen (sie kosten einen ChurchTools-Aufruf).
 * Wann neu geholt wird (auch nach einem Fehlschlag), prüft die Seite (`pages/Availability.test.tsx`).
 */
let qc: QueryClient;
const wrapper = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider client={qc}>{children}</QueryClientProvider>
);

beforeEach(() => {
  qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
});

describe('useAbsencesRefresh', () => {
  it('verwirft die eigene Liste, die Termine nicht', async () => {
    const spy = vi.spyOn(qc, 'invalidateQueries');
    const { result } = renderHook(() => useAbsencesRefresh(), { wrapper });
    await act(async () => {
      await result.current();
    });
    expect(spy).toHaveBeenCalledWith({ queryKey: [...ABSENCES_KEY, 'mine'] });
    expect(spy).not.toHaveBeenCalledWith(
      expect.objectContaining({ queryKey: [...ABSENCES_KEY, 'events'] }),
    );
  });
});
