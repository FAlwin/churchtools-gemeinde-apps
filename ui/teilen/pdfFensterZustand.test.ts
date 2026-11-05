// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import { jsPDF } from 'jspdf';
import { useGebautesPdf } from './pdfFensterZustand';

/** Der PDF-Bau der Teilen-Fenster der Blätter (E8; #845: seit Scheibe 3 über `useLaden`). */
describe('useGebautesPdf', () => {
  it('baut das PDF zum Blatt: erst „baut“, dann fertig', async () => {
    const doc = new jsPDF();
    const { result } = renderHook(() => useGebautesPdf('blatt', () => Promise.resolve(doc)));
    expect(result.current.stand).toEqual({ art: 'baut' });
    await waitFor(() => expect(result.current.stand).toEqual({ art: 'fertig', doc }));
  });

  it('lässt es sich nicht bauen: „fehler“, nicht ewig „baut“', async () => {
    const { result } = renderHook(() =>
      useGebautesPdf('blatt', () => Promise.reject(new Error('jsPDF'))),
    );
    await waitFor(() => expect(result.current.stand).toEqual({ art: 'fehler' }));
  });

  it('ein neues Blatt setzt „geladen“ zurück – die Vorschau des alten zählt nicht', async () => {
    const { result, rerender } = renderHook(
      ({ blatt }: { blatt: string }) => useGebautesPdf(blatt, () => Promise.resolve(new jsPDF())),
      { initialProps: { blatt: 'a' } },
    );
    act(() => result.current.setGeladen(true));
    expect(result.current.geladen).toBe(true);
    rerender({ blatt: 'b' });
    await waitFor(() => expect(result.current.geladen).toBe(false));
  });
});
