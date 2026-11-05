// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import * as A from '@shared/gebetsabend/ablage';
import { ERLAUBNIS_SENDER, senderLink, VDO_HERKUNFT } from '@shared/gebetsabend/links';
import { beendet, TECHNIK_TEXT } from '@shared/gebetsabend/technik';
import { NACHFRAGEN_MS } from '@shared/gebetsabend/zuhoeren';
import { istGueltigeId, neuerZugang, type Zugang } from '@shared/gebetsabend/zugang';
import type { Start } from './start';
import { Technik } from './Technik';

vi.mock('@shared/gebetsabend/ablage', async (orig) => ({
  ...(await orig<typeof import('@shared/gebetsabend/ablage')>()),
  zugangLesen: vi.fn(),
  zugangSpeichern: vi.fn(),
}));
const lesen = vi.mocked(A.zugangLesen);
const speichern = vi.mocked(A.zugangSpeichern);

const START: Start = {
  ichId: 7,
  vorname: 'Jakob',
  name: 'Jakob Penner',
  gemeinde: 'ECG',
  modul: 29,
  einrichtung: { zugang: 77, einstellungen: 80 },
  darfAnlegen: false,
  technik: true,
  einstellungenAendern: true,
};

/** Geprüft wird mit erzeugten Zugängen, nicht mit abgeschriebenen Werten. */
const laeuft = (): Zugang => neuerZugang(true, '2026-11-12T18:30:00.000Z');
const stand = (inhalt: Zugang | null, version: number | null = 3) => ({
  ok: true as const,
  stand: { version, inhalt },
});

let gesendet: Zugang | null = null;
const geaendert = vi.fn();

/** Wie `App.tsx`: Die Seite hält, ob DIESES Gerät sendet. */
function Seite({ anfang = null }: { anfang?: Zugang | null }) {
  const [g, setG] = useState<Zugang | null>(anfang);
  gesendet = g;
  return (
    <Technik
      start={START}
      kategorie={77}
      gesendet={g}
      onGesendet={setG}
      onGeaendert={geaendert}
      onEinstellungen={() => undefined}
    />
  );
}

async function zeigen(z: Zugang | null, anfang: Zugang | null = null) {
  lesen.mockResolvedValue(stand(z));
  render(<Seite anfang={anfang} />);
  await act(async () => {
    await vi.advanceTimersByTimeAsync(0);
  });
}

async function nachfrage() {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(NACHFRAGEN_MS);
  });
}

async function tippen(name: RegExp) {
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name }));
    await vi.advanceTimersByTimeAsync(0);
  });
}

beforeEach(() => {
  vi.useFakeTimers();
  lesen.mockReset();
  speichern.mockReset();
  geaendert.mockReset();
  gesendet = null;
});
afterEach(() => {
  vi.useRealTimers();
});

describe('Technik', () => {
  it('„Übertragung starten“: neuer Zugang mit gesehener Version → gespeichert → erst dann sendet dieses Gerät', async () => {
    await zeigen(null);
    speichern.mockImplementation((_p, _m, _k, z) => Promise.resolve(stand(z, 4)));
    fireEvent.click(screen.getByRole('button', { name: 'Nur Ton' }));
    await tippen(/Übertragung starten/);

    expect(speichern).toHaveBeenCalledOnce();
    const [, modul, kategorie, z, von, erwartet] = speichern.mock.calls[0];
    expect([modul, kategorie, erwartet]).toEqual([29, 77, 3]);
    expect(von).toEqual({ personId: 7, name: 'Jakob Penner' });
    expect(z.mitBild).toBe(false);
    expect(z.laeuftSeit).toBeTruthy();
    expect(istGueltigeId(z.streamId)).toBe(true);
    expect(gesendet).toEqual(z);
    expect(geaendert).toHaveBeenCalledOnce();
    const iframe = document.querySelector('iframe')!;
    expect(iframe.src).toBe(senderLink(z));
    expect(iframe.getAttribute('allow')).toBe(ERLAUBNIS_SENDER);
  });

  it('Speichern scheitert vorübergehend → KEIN Sender, Meldung „nicht gestartet“', async () => {
    await zeigen(null);
    speichern.mockResolvedValue({ ok: false, grund: 'voruebergehend' });
    await tippen(/Übertragung starten/);
    expect(gesendet).toBeNull();
    expect(document.querySelector('iframe')).toBeNull();
    expect(screen.getByRole('alert').textContent).toContain('nicht gestartet');
  });

  it('ein anderes Gerät war schneller (Konflikt) → nichts gestartet, dessen Übertragung steht da', async () => {
    await zeigen(null);
    const anderes = laeuft();
    speichern.mockResolvedValue({
      ok: false,
      grund: 'konflikt',
      jetzt: { version: 4, inhalt: anderes },
    });
    await tippen(/Übertragung starten/);
    expect(gesendet).toBeNull();
    expect(screen.getByText(TECHNIK_TEXT.woanders)).toBeTruthy();
    expect(screen.getByRole('alert').textContent).toContain('nichts überschrieben');
  });

  it('läuft, aber nicht von hier (neu geladen) → startet NICHT von selbst; „Sender hier starten“ nimmt dieselben Daten', async () => {
    const z = laeuft();
    await zeigen(z);
    expect(document.querySelector('iframe')).toBeNull();
    expect(screen.getByText(TECHNIK_TEXT.woanders)).toBeTruthy();
    await tippen(/Sender hier starten/);
    expect(gesendet).toEqual(z);
    expect(speichern).not.toHaveBeenCalled();
    expect(document.querySelector('iframe')!.src).toBe(senderLink(z));
  });

  it('„Sender neu starten“ lädt das iframe neu – gleiches Passwort, nichts gespeichert', async () => {
    const z = laeuft();
    await zeigen(z, z);
    const vorher = document.querySelector('iframe');
    await tippen(/Sender neu starten/);
    const nachher = document.querySelector('iframe');
    expect(nachher).not.toBe(vorher);
    expect(nachher!.src).toBe(senderLink(z));
    expect(speichern).not.toHaveBeenCalled();
  });

  it('„Sender neu starten“ beginnt „Wer hört zu?“ leer – die Zuhörer melden sich beim neuen Sender neu an', async () => {
    const z = laeuft();
    await zeigen(z, z);
    act(() => {
      window.dispatchEvent(
        new MessageEvent('message', {
          data: { action: 'push-connection-info', value: { label: 'Maria Klassen' }, UUID: 'a' },
          origin: VDO_HERKUNFT,
          source: document.querySelector('iframe')!.contentWindow,
        }),
      );
    });
    expect(screen.getByText('Maria Klassen')).toBeTruthy();
    await tippen(/Sender neu starten/);
    expect(screen.queryByText('Maria Klassen')).toBeNull();
  });

  it('„Übertragung beenden“ fragt nach; „Beenden“ speichert ohne „läuft seit“ und stoppt den Sender', async () => {
    const z = laeuft();
    await zeigen(z, z);
    speichern.mockImplementation((_p, _m, _k, neu) => Promise.resolve(stand(neu, 4)));
    await tippen(/Übertragung beenden/);
    expect(speichern).not.toHaveBeenCalled();
    await tippen(/^Beenden$/);
    expect(speichern.mock.calls[0][3]).toEqual(beendet(z));
    expect(speichern.mock.calls[0][5]).toBe(3);
    expect(gesendet).toBeNull();
    expect(screen.getByText('Nicht gestartet')).toBeTruthy();
    expect(screen.queryByRole('alertdialog')).toBeNull();
  });

  it('Beenden scheitert → Fenster bleibt offen, Meldung IM Fenster, Sender läuft weiter', async () => {
    const z = laeuft();
    await zeigen(z, z);
    speichern.mockResolvedValue({ ok: false, grund: 'voruebergehend' });
    await tippen(/Übertragung beenden/);
    await tippen(/^Beenden$/);
    expect(gesendet).toEqual(z);
    const fenster = screen.getByRole('alertdialog');
    expect(fenster.textContent).toContain('nicht beendet');
  });

  it('anderes Gerät startet neu (neue Daten) → hier hört der Sender auf, mit Hinweis', async () => {
    const z = laeuft();
    await zeigen(z, z);
    lesen.mockResolvedValue(stand(laeuft(), 4));
    await nachfrage();
    expect(gesendet).toBeNull();
    expect(document.querySelector('iframe')).toBeNull();
    expect(screen.getByRole('alert').textContent).toBe(TECHNIK_TEXT.senderWeg);
  });

  it('vorübergehender Fehler beim Nachfragen ändert NICHTS – der Sender läuft weiter', async () => {
    const z = laeuft();
    await zeigen(z, z);
    lesen.mockResolvedValue({ ok: false, grund: 'voruebergehend' });
    await nachfrage();
    expect(gesendet).toEqual(z);
    expect(document.querySelector('iframe')).not.toBeNull();
  });

  it('scheitert schon das erste Laden, steht der Fehler da – kein Start-Knopf', async () => {
    lesen.mockResolvedValue({ ok: false, grund: 'voruebergehend' });
    render(<Seite />);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(screen.queryByRole('button', { name: /Übertragung starten/ })).toBeNull();
    expect(screen.getByText(/ChurchTools antwortet gerade nicht/)).toBeTruthy();
  });
});
