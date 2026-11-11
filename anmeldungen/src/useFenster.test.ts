// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { anmeldungenAus, type ListenAnmeldung } from '@shared/anmeldung/liste';
import type { Mail } from '@shared/anmeldung/bewegung';
import { STICHTAG, dazu, e, mitglieder, stand } from '@shared/anmeldung/liste.testdaten';
import type { Aenderung } from './Rueckgaengig';
import type { FensterMeldung } from './AnmeldungAnsehen';
import { useFenster } from './useFenster';

/**
 * `useFenster` (#845, 4c-3) – was die Fenster des Reiters „Anmeldungen“ führt und in der Oberfläche nur mühsam zu
 * sehen ist. Die Abläufe selbst (Von Hand, Zurückholen, Absagen …) prüft `AnmeldungenReiter.test.tsx`.
 */
const liste = (): ListenAnmeldung[] =>
  anmeldungenAus(
    e(),
    stand(mitglieder('AAAAAA', [true, true], 10), [dazu(10, '2026-10-17')]),
    STICHTAG,
  );

function mit(start: Partial<Parameters<typeof useFenster>[0]> = {}) {
  const onGespeichert = vi.fn();
  const props = {
    liste: liste(),
    darf: true,
    mitBestaetigung: false,
    startRundmail: false,
    onGespeichert,
    ...start,
  };
  const r = renderHook((p: Parameters<typeof useFenster>[0]) => useFenster(p), {
    initialProps: props,
  });
  return { ...r, props, onGespeichert };
}

const fertigMit = (nr: string, hinweis?: string) => ({
  nr,
  aenderung: { text: 'Eingetragen.' } as unknown as Aenderung,
  mail: { betreff: 'Anmeldung' } as unknown as Mail,
  hinweis,
});

describe('useFenster', () => {
  it('„Person dazu“ zurück: Von Hand geht zu, die Anmeldung auf – ohne Anmeldung einfach zu', () => {
    const { result, props } = mit();
    const x = props.liste[0];
    act(() => result.current.setVonHand({ dazu: x }));
    act(() => result.current.zurDazuAnmeldung(x));
    expect(result.current.vonHand).toBeNull();
    expect(result.current.fensterX).toBe(x);
    act(() => result.current.oeffnen(null));
    act(() => result.current.setVonHand({ dazu: null }));
    act(() => result.current.zurDazuAnmeldung(null));
    expect(result.current.vonHand).toBeNull();
    expect(result.current.fensterX).toBeNull();
  });

  it('nach einer Absage aus der Liste gefallen: das Fenster bleibt – aber nur, solange „Rückgängig“ ansteht', () => {
    const { result, props, rerender } = mit();
    const x = props.liste[0];
    act(() => result.current.oeffnen(x.schluessel));
    act(() =>
      result.current.setMeldung({ aenderung: {} as Aenderung, mail: null } as FensterMeldung),
    );
    rerender({ ...props, liste: [] });
    expect(result.current.fensterX).toBe(x);
    expect(result.current.ausgewaehlt).toBeUndefined();
    // Ohne Meldung (etwa nach dem Schließen und erneuten Öffnen) ist nichts mehr da, das stehen bleiben müsste.
    act(() => result.current.setMeldung(null));
    expect(result.current.fensterX).toBeNull();
  });

  it('„fertig“ nach Von Hand: die Anmeldung öffnet ohne alte Rückfrage, mit Hinweis und Mail, und lädt neu', () => {
    const { result, props, onGespeichert } = mit();
    const x = props.liste[0];
    act(() => result.current.oeffnen(x.schluessel, { art: 'ab', personId: 10 }));
    expect(result.current.startModus).toEqual({ art: 'ab', personId: 10 });
    act(() => result.current.fertig(fertigMit(x.schluessel, 'Die Person bleibt in ChurchTools.')));
    expect(result.current.startModus).toBeNull();
    expect(result.current.meldung).toMatchObject({
      hinweis: 'Die Person bleibt in ChurchTools.',
      mail: { betreff: 'Anmeldung' },
    });
    expect(result.current.fensterX).toBe(x);
    expect(onGespeichert).toHaveBeenCalledTimes(1);
  });

  it('Rundmail aus dem Hinweis: erst, wenn die Liste da ist – und genau einmal', () => {
    const { result, props, rerender } = mit({ startRundmail: true, liste: [] });
    expect(result.current.rundmail).toBe(false);
    rerender({ ...props, liste: liste() });
    expect(result.current.rundmail).toBe(true);
    act(() => result.current.setRundmail(false));
    // Neu geladen (z. B. nach einer Änderung) – die Rundmail geht nicht von selbst wieder auf.
    rerender({ ...props, liste: [] });
    rerender({ ...props, liste: liste() });
    expect(result.current.rundmail).toBe(false);
  });
});
