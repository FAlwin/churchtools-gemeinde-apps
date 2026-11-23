// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { WEBSITE_LEITUNG } from '@shared/website/zugang';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { ApiError } from '@ui/ct/fehler';
import { einrichtungAus, kategorienFuer } from '@shared/website/einrichten';
import type { Einstellungen, Menue, Seite } from '@shared/website/modell';
import {
  abschnitt,
  baustein,
  einstellungen,
  seite,
  spalte,
} from '@shared/website/website.testdaten';
import * as D from './daten';
import { App } from './App';
import type { Start } from './start';
import * as S from './start';

/**
 * **W3a-3c: Die Vorschau im Reiter „Seiten“ zeigt sofort, was das Fenster „Einstellungen“ gespeichert hat.** Hier läuft das
 * echte Zusammenspiel: `App` → `Seiten` (Vorschau) und `EinstellungenProvider` + Fenster; nur der Speicher-Anschluss
 * (`./daten`) und der Start sind ersetzt. Der „Server“ ist EIN Objekt, aus dem alles liest.
 */
vi.mock('./start', () => ({ ladeStart: vi.fn() }));
vi.mock('./daten', () => ({
  ladeWebsite: vi.fn(),
  speichereSeite: vi.fn(),
  loescheSeite: vi.fn(),
  speichereMenue: vi.fn(),
  beginneBearbeiten: vi.fn(),
  beendeBearbeiten: vi.fn(),
  uebernimmBearbeitung: vi.fn(),
  speichereEinstellungen: vi.fn(),
  beginneEinstellungen: vi.fn(),
  uebernimmEinstellungen: vi.fn(),
  beendeEinstellungen: vi.fn(),
}));
const d = vi.mocked(D);
const ladeStart = vi.mocked(S.ladeStart);

const einrichtung = einrichtungAus(
  kategorienFuer(7, 'Website').map((k, i) => ({ id: 20 + i, shorty: k.kuerzel, name: k.name })),
);
const START = seite({
  id: 's',
  titel: 'Start',
  pfad: 'start',
  startseite: true,
  abschnitte: [
    abschnitt([baustein('ueberschrift', { id: 'u', text: 'Willkommen' })], { id: 'a0' }),
    abschnitt([], {
      id: 'a1',
      spalten: [spalte([baustein('text', { id: 't', markdown: 'zweiter Block' })], { id: 'sp1' })],
    }),
  ],
});

let server: {
  seite: Seite;
  /** Weitere Seiten, die jemand anderes inzwischen angelegt hat – `ladeWebsite` liefert sie mit. */
  fremd: Seite[];
  menue: Menue | null;
  einstellungen: Einstellungen | null;
};
/** Lesen scheitert, solange das gesetzt ist (nur `ladeWebsite`). */
let leseFehler = false;
let schreibFehler = false;

const rahmen = () => screen.getByTitle<HTMLIFrameElement>('Vorschau: Start');
const doc = () => rahmen().getAttribute('srcdoc') ?? '';
const pos = (text: string) => doc().indexOf(text, doc().indexOf('<main'));
const aus = (rest: Record<string, unknown>) =>
  act(async () => {
    window.dispatchEvent(
      new MessageEvent('message', {
        data: { websiteEditor: true, ...rest },
        source: rahmen().contentWindow,
      }),
    );
  });
const klick = async (name: string | RegExp) => {
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name }));
  });
};
const warte = (ms: number) =>
  act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });

/** App öffnen, Reiter „Seiten“ ist offen. */
async function zeige() {
  render(<App />);
  await act(async () => {});
  await act(async () => {});
  rahmen();
}
/** Fenster „Einstellungen“ öffnen und den Namen ändern – ohne zu speichern. */
async function nameTippen(wert: string) {
  await klick('Einstellungen');
  await act(async () => {});
  await act(async () => {
    fireEvent.change(screen.getByLabelText('Name der Gemeinde'), { target: { value: wert } });
  });
}

beforeEach(() => {
  vi.useFakeTimers();
  leseFehler = false;
  schreibFehler = false;
  server = {
    seite: START,
    fremd: [],
    menue: null,
    einstellungen: einstellungen({ name: 'ECG Alt', fusszeile: [] }),
  };
  ladeStart.mockResolvedValue({
    ichId: 1,
    vorname: 'Helene',
    name: 'Helene Wiebe',
    gemeinde: 'ECG',
    modul: 7,
    einrichtung,
    stand: 'fertig',
    admin: false,
    zugang: WEBSITE_LEITUNG,
    darfRechteSetzen: false,
    leitungOhneRechte: false,
  } satisfies Start);
  d.ladeWebsite.mockImplementation(async () => {
    if (leseFehler) throw new ApiError(503, 'weg');
    return {
      seiten: [server.seite, ...server.fremd],
      menue: server.menue,
      einstellungen: server.einstellungen,
      probleme: [],
      verwaist: 0,
      sperren: {},
      einstellungenSperre: null,
      status: {},
      staende: [],
    };
  });
  d.beginneBearbeiten.mockImplementation(async () => ({
    art: 'ok',
    seite: server.seite,
    menue: server.menue,
  }));
  d.beendeBearbeiten.mockResolvedValue(undefined);
  d.speichereSeite.mockImplementation(async (_o, s) => {
    server.seite = s;
  });
  d.speichereMenue.mockResolvedValue(undefined);
  d.beginneEinstellungen.mockImplementation(async () => ({
    art: 'ok',
    einstellungen: server.einstellungen,
  }));
  d.uebernimmEinstellungen.mockImplementation(async () => ({
    art: 'ok',
    einstellungen: server.einstellungen,
  }));
  d.beendeEinstellungen.mockResolvedValue(undefined);
  d.speichereEinstellungen.mockImplementation(async (_o, e) => {
    if (schreibFehler) throw new ApiError(503, 'weg');
    server.einstellungen = e;
  });
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.clearAllMocks();
});

describe('Fenster „Einstellungen“ über dem Reiter „Seiten“', () => {
  it('Name gespeichert → die Vorschau zeigt ihn sofort, ohne Reiterwechsel und ohne Neuladen', async () => {
    await zeige();
    expect(doc()).toContain('ECG Alt');
    await nameTippen('ECG Donrath');
    await klick('Speichern');
    await warte(0);
    expect(d.speichereEinstellungen).toHaveBeenCalledTimes(1);
    expect(doc()).toContain('ECG Donrath');
    expect(doc()).not.toContain('ECG Alt');
    // Im Reiter „Seiten“ ist die ganze Zeit derselbe Rahmen geblieben (kein „lädt …“ dazwischen).
    expect(screen.queryByText('Die Seiten werden geladen …')).toBeNull();
  });

  it('Fußzeile gespeichert → auch sie steht sofort in der Vorschau', async () => {
    await zeige();
    await klick('Einstellungen');
    await act(async () => {});
    await klick('Link');
    await act(async () => {
      fireEvent.change(screen.getByLabelText('Titel von Link 1'), {
        target: { value: 'Kontaktseite' },
      });
    });
    await klick('Speichern');
    await warte(0);
    expect(doc()).toContain('Kontaktseite');
  });

  it('scheitert das Nachlesen: die alte Vorschau bleibt, ein leiser Hinweis steht da – gespeichert ist es trotzdem', async () => {
    await zeige();
    await nameTippen('ECG Donrath');
    leseFehler = true;
    await klick('Speichern');
    await warte(0);
    expect(server.einstellungen?.name).toBe('ECG Donrath'); // der Server hat es
    expect(doc()).toContain('ECG Alt'); // die Vorschau nicht verworfen, nichts abgestürzt
    expect(screen.getByText(/zeigt noch die alten Einstellungen/)).toBeTruthy();
    // Der nächste Speicherstand liest wieder – und der Hinweis verschwindet.
    leseFehler = false;
    await nameTippen('ECG Donrath 2');
    await klick('Speichern');
    await warte(0);
    expect(doc()).toContain('ECG Donrath 2');
    expect(screen.queryByText(/zeigt noch die alten Einstellungen/)).toBeNull();
  });

  it('eine offene Seiten-Bearbeitung mit ungespeicherter Änderung bleibt beim Nachlesen erhalten', async () => {
    // Das Speichern der Seite hängt – die Änderung ist also nur in der Arbeitskopie.
    d.speichereSeite.mockImplementation(() => new Promise(() => {}));
    await zeige();
    await aus({ was: 'verschieben', art: 'abschnitt', von: 0, nach: 2 });
    await warte(0);
    expect(pos('zweiter Block')).toBeLessThan(pos('Willkommen'));
    const begonnen = d.beginneBearbeiten.mock.calls.length;
    await nameTippen('ECG Donrath');
    await klick('Speichern');
    await warte(0);
    expect(doc()).toContain('ECG Donrath');
    // Die Seite ist weiter so, wie sie in Arbeit war (nicht auf den Stand des Servers zurückgesetzt) …
    expect(pos('zweiter Block')).toBeLessThan(pos('Willkommen'));
    // … und ihre Bearbeitung wurde nicht neu begonnen oder beendet.
    expect(d.beginneBearbeiten).toHaveBeenCalledTimes(begonnen);
    expect(d.beendeBearbeiten).not.toHaveBeenCalled();
  });

  it('ersetzt NUR die Einstellungen: eine Seite, die inzwischen jemand anderes angelegt hat, taucht nicht plötzlich auf', async () => {
    await zeige();
    server.fremd = [seite({ id: 'x', titel: 'Fremde Seite', pfad: 'fremd', startseite: false })];
    await nameTippen('ECG Donrath');
    await klick('Speichern');
    await warte(0);
    expect(doc()).toContain('ECG Donrath');
    expect(screen.queryByText('Fremde Seite')).toBeNull();
  });

  it('scheitert das Speichern im Fenster, wird nicht nachgelesen – und die Vorschau bleibt', async () => {
    await zeige();
    await nameTippen('ECG Donrath');
    const vorher = d.ladeWebsite.mock.calls.length;
    schreibFehler = true;
    await klick('Speichern');
    await warte(0);
    expect(d.speichereEinstellungen).toHaveBeenCalled();
    expect(d.ladeWebsite).toHaveBeenCalledTimes(vorher);
    expect(doc()).toContain('ECG Alt');
    expect(screen.queryByText(/zeigt noch die alten Einstellungen/)).toBeNull();
  });

  it('ein Öffnen des Reiters liest nicht doppelt: ohne Speichern kein Nachlesen', async () => {
    await zeige();
    const vorher = d.ladeWebsite.mock.calls.length;
    await warte(5000);
    expect(d.ladeWebsite).toHaveBeenCalledTimes(vorher);
  });
});
