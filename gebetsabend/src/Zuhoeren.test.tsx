// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { ApiError } from '@ui/ct/fehler';
import { tagKurz } from '@shared/ct/datum';
import { gemeindeZeitzone, tagAusIso, uhrText } from '@shared/ct/zeit';
import { VDO_BASIS } from '@shared/gebetsabend/links';
import { NACHFRAGEN_MS, PLAYER_TEXT } from '@shared/gebetsabend/zuhoeren';
import { neuerZugang, type Zugang } from '@shared/gebetsabend/zugang';
import { TECHNIK_TEXT } from '@shared/gebetsabend/technik';
import * as L from './lesen';
import { Zuhoeren } from './Zuhoeren';

vi.mock('./lesen', async (orig) => ({
  ...(await orig<typeof import('./lesen')>()),
  ladeZugang: vi.fn(),
}));
const laden = vi.mocked(L.ladeZugang);

const HERKUNFT = new URL(VDO_BASIS).origin;
/** Geprüft wird mit erzeugten Zugängen, nicht mit abgeschriebenen Werten. */
const laeuft = (): Zugang => neuerZugang(true, '2026-11-12T18:32:00.000Z');

/** Eine Meldung von VDO.Ninja nachstellen – aus dem echten iframe der Seite oder von woanders. */
function melden(daten: unknown, opt: { herkunft?: string; vonPlayer?: boolean } = {}) {
  const iframe = document.querySelector('iframe');
  act(() => {
    window.dispatchEvent(
      new MessageEvent('message', {
        data: daten,
        origin: opt.herkunft ?? HERKUNFT,
        source: opt.vonPlayer === false ? window : (iframe?.contentWindow ?? null),
      }),
    );
  });
}

async function nachfrage() {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(NACHFRAGEN_MS);
  });
}

beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
});

async function zeigen(z: Zugang | null) {
  laden.mockResolvedValue(z);
  render(<Zuhoeren modul={29} kategorie={77} name="Helene Wiebe" />);
  await act(async () => {
    await vi.advanceTimersByTimeAsync(0);
  });
}

describe('Zuhoeren', () => {
  it('ohne Übertragung: kein Player, Knopf aus – und sobald die Technik startet, geht er an (ohne Neuladen)', async () => {
    await zeigen({ ...laeuft(), laeuftSeit: null });
    expect(screen.getByText('Noch keine Übertragung')).toBeTruthy();
    expect(screen.getByRole('button', { name: /Gebetsabend zuhören/ })).toHaveProperty(
      'disabled',
      true,
    );
    expect(document.querySelector('iframe')).toBeNull();

    laden.mockResolvedValue(laeuft());
    await nachfrage();
    expect(screen.getByRole('button', { name: /Gebetsabend zuhören/ })).toHaveProperty(
      'disabled',
      false,
    );
  });

  it('ein Tippen öffnet den Player mit Name und ohne VDO.Ninja-Bedienung', async () => {
    const z = laeuft();
    await zeigen(z);
    fireEvent.click(screen.getByRole('button', { name: /Gebetsabend zuhören/ }));
    const src = new URL(document.querySelector('iframe')!.src);
    expect(src.searchParams.get('view')).toBe(z.streamId);
    expect(src.searchParams.get('label')).toBe('Helene Wiebe');
    expect(src.searchParams.has('cleanish')).toBe(true);
    expect(screen.getByText(PLAYER_TEXT.verbindet)).toBeTruthy();
  });

  it('Meldungen aus dem eigenen Player ändern den Zustand – fremde Herkunft oder fremdes Fenster nicht', async () => {
    await zeigen(laeuft());
    fireEvent.click(screen.getByRole('button', { name: /Gebetsabend zuhören/ }));
    melden({ action: 'new-audio-track-added', value: true }, { herkunft: 'https://boese.example' });
    melden({ action: 'new-audio-track-added', value: true }, { vonPlayer: false });
    expect(screen.getByText(PLAYER_TEXT.verbindet)).toBeTruthy();
    melden({ action: 'new-audio-track-added', value: true });
    expect(screen.getByText(PLAYER_TEXT.ton)).toBeTruthy();
  });

  it('vorübergehender Fehler beim Nachfragen schließt den laufenden Player NICHT', async () => {
    await zeigen(laeuft());
    fireEvent.click(screen.getByRole('button', { name: /Gebetsabend zuhören/ }));
    laden.mockRejectedValue(new ApiError(504, 'Zeitüberschreitung'));
    await nachfrage();
    await nachfrage();
    expect(document.querySelector('iframe')).not.toBeNull();
  });

  it('Technik startet neu → Player lädt die neuen Daten; Technik beendet → Player zu, „beendet“', async () => {
    await zeigen(laeuft());
    fireEvent.click(screen.getByRole('button', { name: /Gebetsabend zuhören/ }));
    const neu = laeuft();
    laden.mockResolvedValue(neu);
    await nachfrage();
    expect(new URL(document.querySelector('iframe')!.src).searchParams.get('view')).toBe(
      neu.streamId,
    );

    laden.mockResolvedValue({ ...neu, laeuftSeit: null });
    await nachfrage();
    expect(document.querySelector('iframe')).toBeNull();
    expect(screen.getByText(/Die Übertragung ist beendet/)).toBeTruthy();
  });

  it('„Nicht mehr zuhören“ schließt den Player, der Knopf ist wieder da', async () => {
    await zeigen(laeuft());
    fireEvent.click(screen.getByRole('button', { name: /Gebetsabend zuhören/ }));
    fireEvent.click(screen.getByRole('button', { name: /Nicht mehr zuhören/ }));
    expect(document.querySelector('iframe')).toBeNull();
    expect(screen.getByRole('button', { name: /Gebetsabend zuhören/ })).toBeTruthy();
  });

  it('Vollbild und Bild-in-Bild aus der Apple-Leiste im Bild – kein eigener Vollbild-Knopf mehr', async () => {
    await zeigen(laeuft());
    fireEvent.click(screen.getByRole('button', { name: /Gebetsabend zuhören/ }));
    const iframe = document.querySelector('iframe')!;
    expect(new URL(iframe.src).searchParams.has('videocontrols')).toBe(true);
    // Ohne diese Erlaubnis bietet die Leiste im fremden iframe kein Vollbild bzw. Bild-in-Bild an.
    expect((iframe.getAttribute('allow') ?? '').split(';').map((t) => t.trim())).toEqual(
      expect.arrayContaining(['fullscreen', 'picture-in-picture']),
    );
    expect(iframe.hasAttribute('allowfullscreen')).toBe(true);
    expect(screen.queryByRole('button', { name: /Großansicht|Vollbild/ })).toBeNull();
  });

  it('„Nur Ton“: keine Bild-Leiste, kein Vollbild-Knopf', async () => {
    await zeigen({ ...laeuft(), mitBild: false });
    fireEvent.click(screen.getByRole('button', { name: /Gebetsabend zuhören/ }));
    expect(new URL(document.querySelector('iframe')!.src).searchParams.has('videocontrols')).toBe(
      false,
    );
    expect(screen.queryByRole('button', { name: /Großansicht|Vollbild/ })).toBeNull();
  });

  it('auf dem Gerät, das sendet: kein Zuhören (Ton liefe ins Mikrofon) – ein offener Player schließt sich', async () => {
    laden.mockResolvedValue(laeuft());
    const { rerender } = render(<Zuhoeren modul={29} kategorie={77} name="Helene Wiebe" />);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    fireEvent.click(screen.getByRole('button', { name: /Gebetsabend zuhören/ }));
    expect(document.querySelector('iframe')).not.toBeNull();
    rerender(<Zuhoeren modul={29} kategorie={77} name="Helene Wiebe" sendetHier />);
    expect(document.querySelector('iframe')).toBeNull();
    expect(screen.queryByRole('button', { name: /Gebetsabend zuhören/ })).toBeNull();
    expect(screen.getByText(TECHNIK_TEXT.nichtHierZuhoeren)).toBeTruthy();
    // Sendet das Gerät nicht mehr, kommt der alte Player NICHT von selbst zurück (er hinge an alten Daten).
    rerender(<Zuhoeren modul={29} kategorie={77} name="Helene Wiebe" />);
    expect(document.querySelector('iframe')).toBeNull();
    expect(screen.getByRole('button', { name: /Gebetsabend zuhören/ })).toBeTruthy();
  });

  it('hat die Technik hier gespeichert, fragt die Seite SOFORT nach – nicht erst nach 20 s', async () => {
    laden.mockResolvedValue(null);
    const { rerender } = render(<Zuhoeren modul={29} kategorie={77} name="Helene Wiebe" />);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(laden).toHaveBeenCalledTimes(1);
    laden.mockResolvedValue(laeuft());
    rerender(<Zuhoeren modul={29} kategorie={77} name="Helene Wiebe" aktualisiert={1} />);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(laden).toHaveBeenCalledTimes(2);
    expect(screen.getByRole('button', { name: /Gebetsabend zuhören/ })).toHaveProperty(
      'disabled',
      false,
    );
  });

  it('der nächste Termin steht oben in der Karte wie „Als Nächstes“ – ohne Termin schlicht „Gebetsabend“', async () => {
    laden.mockResolvedValue(laeuft());
    const { rerender } = render(<Zuhoeren modul={29} kategorie={77} name="Helene Wiebe" />);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(screen.getByRole('region', { name: 'Gebetsabend' })).toBeTruthy();
    expect(screen.queryByText(/Als Nächstes/)).toBeNull();
    rerender(
      <Zuhoeren
        modul={29}
        kategorie={77}
        name="Helene Wiebe"
        termin={{ id: 1, titel: 'Gebetsabend im Saal', beginn: '2026-11-12T18:30:00Z', ende: null }}
      />,
    );
    const karte = screen.getByRole('region', { name: 'Gebetsabend im Saal' });
    expect(karte.textContent).toMatch(/^Als Nächstes · /);
    // Erwartung aus denselben Erzeugern – die CI läuft in UTC, hier in Deutschland (sonst 18:30 statt 19:30).
    const beginn = '2026-11-12T18:30:00Z';
    expect(karte.textContent).toContain(
      `${tagKurz(tagAusIso(beginn, gemeindeZeitzone()))} · ${uhrText(beginn)} Uhr`,
    );
    expect(within(karte).getByRole('button', { name: /Gebetsabend zuhören/ })).toBeTruthy();
  });

  it('scheitert schon das erste Laden, steht der Fehler da (nicht „keine Übertragung“)', async () => {
    laden.mockRejectedValue(new ApiError(502, 'kaputt'));
    render(<Zuhoeren modul={29} kategorie={77} name="Helene Wiebe" />);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(screen.queryByText('Noch keine Übertragung')).toBeNull();
    expect(screen.getByRole('alert')).toBeTruthy();
  });
});
