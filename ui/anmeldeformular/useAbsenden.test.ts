// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { neueEinstellungen } from '@shared/anmeldung/vorlagen';
import type { Antworten } from '@shared/anmeldung/formular';
import type { PlatzStand } from '@shared/anmeldung/oeffentlich';
import { musterAntworten } from './daten';
import { useAbsenden, usePlaetze } from './useAbsenden';

/**
 * `usePlaetze` und `useAbsenden` (#845, 4d-2) – was das Formular sonst nur mittelbar zeigt. Die Abläufe mit echtem
 * Abschicken prüfen `AnmeldeFormular.test.tsx` und `formular/src/senden.test.tsx`.
 */
const HEUTE = '2026-10-13';
const ansicht = () => ({
  basis: 'https://ct.test',
  name: 'Kindertag',
  gemeinde: null,
  einstellungen: neueEinstellungen('kinder'),
  freiePlaetze: 5,
  warteliste: false,
});

describe('usePlaetze', () => {
  it('im Baukasten kommt keine Person dazu – und es wird nicht nachgefragt', async () => {
    const nachfragen = vi.fn<() => Promise<PlatzStand>>();
    const setAntworten = vi.fn();
    const { result } = renderHook(() =>
      usePlaetze({
        ansicht: ansicht(),
        baukasten: true,
        plaetzeNachfragen: nachfragen,
        antworten: { anmeldung: {}, personen: [{}] },
        setAntworten,
      }),
    );
    await act(() => result.current.hinzufuegen());
    expect(nachfragen).not.toHaveBeenCalled();
    expect(setAntworten).not.toHaveBeenCalled();
  });

  it('zweimal schnell getippt, während noch nachgefragt wird → einmal nachgefragt, eine Person dazu', async () => {
    let antworten: (s: PlatzStand) => void = () => {};
    const nachfragen = vi.fn(() => new Promise<PlatzStand>((r) => (antworten = r)));
    const setAntworten = vi.fn();
    const { result } = renderHook(() =>
      usePlaetze({
        ansicht: ansicht(),
        baukasten: false,
        plaetzeNachfragen: nachfragen,
        antworten: { anmeldung: {}, personen: [{}] },
        setAntworten,
      }),
    );
    let erste!: Promise<void>;
    act(() => {
      erste = result.current.hinzufuegen();
    });
    expect(result.current.fragtNach).toBe(true);
    await act(() => result.current.hinzufuegen());
    await act(async () => {
      antworten({ freiePlaetze: 5, warteliste: false });
      await erste;
    });
    expect(nachfragen).toHaveBeenCalledTimes(1);
    expect(setAntworten).toHaveBeenCalledTimes(1);
  });
});

describe('useAbsenden', () => {
  // „einfach“: die Musterantworten füllen alles aus, was Pflicht ist (bei Kindern fehlten die Eltern).
  const e = neueEinstellungen('einfach');
  /** Die Musterantworten, mit Haken beim Datenschutz – sonst hielte die Prüfung vorher an. */
  const ausgefuellt = (): Antworten => {
    const a = musterAntworten(e, HEUTE);
    return { ...a, anmeldung: { ...a.anmeldung, priv: true } };
  };
  const mit = (onAbsenden?: Parameters<typeof useAbsenden>[0]['onAbsenden'], echt = false) =>
    renderHook(() =>
      useAbsenden({
        e,
        antworten: ausgefuellt(),
        option: 0,
        extras: [],
        preis: { ausgebucht: false },
        echt,
        baukasten: false,
        onAbsenden,
      }),
    );

  it('Vorschau: nichts geschickt, das Ergebnis nennt die eingetragene Mail', async () => {
    const { result } = mit();
    await act(() => result.current.absenden());
    expect(result.current.fehler).toEqual([]);
    expect(result.current.fertig?.mail).toBe(ausgefuellt().anmeldung.mail);
    expect(result.current.fertig?.mail).toBeTruthy();
  });

  it('„Noch einmal“ scheitert → die Meldung steht da, das bisherige Ergebnis bleibt', async () => {
    const onAbsenden = vi.fn().mockRejectedValue(new Error('ChurchTools antwortet gerade nicht.'));
    const { result } = mit(onAbsenden, true);
    const bisher = {
      personen: [{ index: 0, name: 'Lena', ergebnis: 'offen' as const }],
      mail: 'x@y.test',
    };
    act(() => result.current.setFertig(bisher));
    await act(() => result.current.nochmal([0]));
    expect(result.current.nochmalFehler).toBe('ChurchTools antwortet gerade nicht.');
    expect(result.current.fertig).toBe(bisher);
    expect(result.current.sendet).toBe(false);
  });
});
