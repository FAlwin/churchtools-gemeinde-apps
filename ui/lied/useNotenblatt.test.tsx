// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

/**
 * Der gemeinsame Notenblatt-Hook (04.09.2026) – für „Neues Lied" UND „Stammdaten ändern".
 *
 * Geprüft wird, woher der Starttext kommt und was Speichern tut. Die Fälle mit Ergebnis-Nachziehen
 * stehen in `useNeuesLied.test.tsx`; hier nur die Mechanik, die beide teilen.
 */
const notenblattSpeichern = vi.fn();
const notenblattLesen = vi.fn();
// Der Liedzugriff der App (LW1b-2) als Attrappe – was die Musik-App danach neu lädt, prüft musikLiedZugriff.test.
const nachAenderung = vi.fn();
const zugriff = {
  notenblattSpeichern: (...a: unknown[]) => notenblattSpeichern(...a),
  notenblattLesen: (...a: unknown[]) => notenblattLesen(...a),
  nachAenderung,
} as unknown as import('./liedZugriff').LiedZugriff;
const { LiedZugriffKontext } = await import('./liedZugriff');

const { useNotenblatt } = await import('./useNotenblatt');

const ZIEL = { songId: 77, arrangementId: 500 };
const VORLAGE = { title: 'Treu', key: 'E', ccli: '5841527' };

function starte(ziel: typeof ZIEL | null = ZIEL) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const hook = renderHook(() => useNotenblatt(ziel), {
    wrapper: ({ children }) => (
      <QueryClientProvider client={qc}>
        <LiedZugriffKontext.Provider value={zugriff}>{children}</LiedZugriffKontext.Provider>
      </QueryClientProvider>
    ),
  });
  return { ...hook, qc };
}

beforeEach(() => {
  vi.clearAllMocks();
  notenblattSpeichern.mockResolvedValue([]);
  notenblattLesen.mockResolvedValue('{title: Treu}\n[E]Vorhanden');
});

describe('useNotenblatt – der Starttext', () => {
  it('ohne Blatt (bekannt) kommt das Gerüst – und das Blatt wird NICHT abgefragt', async () => {
    const { result } = starte();
    const text = await result.current.text(VORLAGE, false);
    expect(text).toContain('{title: Treu}');
    expect(text).toContain('{key: E}');
    expect(text).toContain('{ccli: 5841527}');
    expect(notenblattLesen).not.toHaveBeenCalled();
  });

  it('mit Blatt kommt genau dieses', async () => {
    const { result } = starte();
    expect(await result.current.text(VORLAGE, true)).toBe('{title: Treu}\n[E]Vorhanden');
    expect(notenblattLesen).toHaveBeenCalledWith(77, 500);
  });

  it('unbekannt (Stammdaten-Blatt): nachsehen – leer heißt Gerüst', async () => {
    // Das Stammdaten-Blatt weiß nicht, ob ein Blatt existiert. `null` = nachsehen.
    notenblattLesen.mockResolvedValue(null);
    const { result } = starte();
    const text = await result.current.text(VORLAGE, null);
    expect(notenblattLesen).toHaveBeenCalledTimes(1);
    expect(text).toContain('{title: Treu}');
  });

  it('ohne Ziel gibt es nichts – und keinen Aufruf', async () => {
    const { result } = starte(null);
    expect(await result.current.text(VORLAGE, null)).toBe('');
    expect(notenblattLesen).not.toHaveBeenCalled();
  });
});

describe('useNotenblatt – Speichern', () => {
  it('schreibt das Original und verwirft den Chart-Cache dieses Liedes', async () => {
    const { result, qc } = starte();
    expect(await result.current.speichern('{title: Treu}\n[E]Neu')).toBe(true);
    expect(notenblattSpeichern).toHaveBeenCalledWith(77, 500, '{title: Treu}\n[E]Neu');
    // Das Blatt hat sich geändert – die App lädt ihre Liedblätter neu (Musik-App: `liedblaetter(77)`).
    expect(nachAenderung).toHaveBeenCalledWith(qc, {
      art: 'notenblatt',
      songId: 77,
    });
    expect(result.current.fehler).toBeNull();
  });

  it('ein Fehlschlag nennt den Grund vom Server und meldet false', async () => {
    notenblattSpeichern.mockRejectedValue(
      new Error('Keine Berechtigung, Dateien in ChurchTools zu speichern.'),
    );
    const { result } = starte();
    expect(await result.current.speichern('x')).toBe(false);
    await waitFor(() => expect(result.current.fehler).toContain('Keine Berechtigung'));
  });

  it('ohne Ziel wird nichts geschrieben', async () => {
    const { result } = starte(null);
    expect(await result.current.speichern('x')).toBe(false);
    expect(notenblattSpeichern).not.toHaveBeenCalled();
  });
});
