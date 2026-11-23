// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import { teileBauen, type ProtokollKopf, type ProtokollTeil } from '@shared/protokolle/speicher';
import type { Block } from '@shared/protokolle/dokument';
import type { Sitzung } from '@shared/protokolle/sitzungen';
import * as S from './schreiben';
import { SitzungAnsicht } from './SitzungAnsicht';

/** Die Lese-Ansicht einer Sitzung – hier das Mitlesen eines Entwurfs (W16). Lesen bei ChurchTools ist eine Attrappe. */
vi.mock('./schreiben', () => ({ protokollLesen: vi.fn() }));
const lesen = vi.mocked(S.protokollLesen);

const absatz = (id: string, text: string): Block => ({
  id,
  type: 'paragraph',
  props: {},
  content: [{ type: 'text', text, styles: {} }],
  children: [],
});
const DOK = [absatz('a', 'Erster Satz.')];
const DOK2 = [absatz('a', 'Erster Satz.'), absatz('b', 'Zweiter Satz, eben getippt.')];
// Die gespeicherten Teile von DOK – der Stand im Kopf muss zu ihnen passen (Prüfsumme).
const GEBAUT = teileBauen(DOK, 's1');
const TEILE = GEBAUT.werte.map((w) => JSON.parse(w) as ProtokollTeil);
const KOPF: ProtokollKopf = {
  art: 'protokoll',
  fassung: 1,
  sitzung: 's1',
  titel: 'Festplanung',
  status: 'entwurf',
  beginn: '2026-11-23T17:00:00Z',
  termin: null,
  treffen: null,
  freigabe: null,
  sperre: null,
  stand: GEBAUT.stand,
};
const sitzung = (kopf: ProtokollKopf): Sitzung =>
  ({ schluessel: 'p:s1', titel: kopf.titel, beginn: kopf.beginn, kopf }) as unknown as Sitzung;

const ORT = { modul: 24, kategorie: 62 };
const zeige = (kopf = KOPF, mitlesen: typeof ORT | null = ORT) =>
  render(
    <SitzungAnsicht
      sitzung={sitzung(kopf)}
      gruppe="Festplanung"
      gruppeId={7}
      protokolle={[]}
      teile={TEILE}
      aufgaben={[]}
      zeitzone="Europe/Berlin"
      onZurueck={() => undefined}
      mitlesen={mitlesen ?? undefined}
    />,
  );

let verdeckt = false;
beforeEach(() => {
  vi.useFakeTimers();
  verdeckt = false;
  Object.defineProperty(document, 'hidden', { configurable: true, get: () => verdeckt });
  lesen.mockResolvedValue({ kopf: KOPF, dokument: DOK });
});
afterEach(() => {
  vi.useRealTimers();
});
const warten = (ms = 0) => act(() => vi.advanceTimersByTimeAsync(ms));

describe('SitzungAnsicht – Mitlesen (W16)', () => {
  it('ein Entwurf liest sich alle 10 s nach – der neue Text erscheint von selbst, nichts baut sich neu auf', async () => {
    zeige();
    const erster = screen.getByText('Erster Satz.');
    expect(screen.queryByText(/Zweiter Satz/)).toBeNull();
    lesen.mockResolvedValue({ kopf: { ...KOPF, stand: 'b' }, dokument: DOK2 });
    await warten(9_999);
    expect(lesen).not.toHaveBeenCalled();
    await warten(1);
    expect(lesen).toHaveBeenCalledWith({ modul: 24, kategorie: 62, sitzung: 's1' });
    expect(screen.getByText('Zweiter Satz, eben getippt.')).toBeTruthy();
    // Der schon stehende Absatz ist derselbe Knoten – die Seite springt nicht.
    expect(screen.getByText('Erster Satz.')).toBe(erster);
  });

  it('freigegebene Protokolle werden nicht nachgeladen', async () => {
    zeige({ ...KOPF, status: 'frei' });
    await warten(60_000);
    expect(lesen).not.toHaveBeenCalled();
  });

  it('wird der Entwurf inzwischen freigegeben, zeigt die Ansicht das – und hört auf', async () => {
    zeige();
    lesen.mockResolvedValue({
      kopf: {
        ...KOPF,
        status: 'frei',
        stand: 'c',
        freigabe: { von: 1, name: 'Alwin Friesen', am: '2026-11-23T19:00:00Z' },
      } as ProtokollKopf,
      dokument: DOK2,
    });
    await warten(10_000);
    expect(screen.queryByText('Entwurf – noch nicht freigegeben')).toBeNull();
    expect(screen.getByText('Zweiter Satz, eben getippt.')).toBeTruthy();
    await warten(60_000);
    expect(lesen).toHaveBeenCalledTimes(1);
  });

  it('Fenster verdeckt: Pause', async () => {
    zeige();
    verdeckt = true;
    document.dispatchEvent(new Event('visibilitychange'));
    await warten(60_000);
    expect(lesen).not.toHaveBeenCalled();
  });

  it('gerade nicht vollständig lesbar oder Fehler: der bisherige Text bleibt stehen, ohne Meldung', async () => {
    zeige();
    lesen.mockResolvedValueOnce({ kopf: { ...KOPF, stand: 'b' }, dokument: null });
    lesen.mockRejectedValueOnce(new Error('503'));
    await warten(20_000);
    expect(lesen).toHaveBeenCalledTimes(2);
    expect(screen.getByText('Erster Satz.')).toBeTruthy();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('ohne Ort (`mitlesen` fehlt) wird nichts nachgeladen', async () => {
    zeige(KOPF, null);
    await warten(60_000);
    expect(lesen).not.toHaveBeenCalled();
  });
});
