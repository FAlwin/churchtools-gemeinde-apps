// @vitest-environment jsdom
/**
 * W3c-2 in der Seitenarbeit: Verschieben (Ziehen) und Rückgängig/Wiederholen. Die Rechenregeln selbst prüft
 * `shared/website/bearbeiten.test.ts`; hier geht es um den Weg: Nachricht → Prüfung → Schlange → Speichern, und um den Verlauf.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { sperreVon } from '@shared/ct/sperre';
import {
  abschnittVerschiebenNach,
  bausteinVerschieben,
  seiteGleich,
} from '@shared/website/bearbeiten';
import type { Menue, Seite } from '@shared/website/modell';
import type { WebsiteStand } from '@shared/website/speicher';
import { abschnitt, baustein, menue, seite, spalte } from '@shared/website/website.testdaten';
import * as D from './daten';
import { LEBENSZEICHEN_MS } from './regeln';
import { Seitenarbeit } from './Seitenarbeit';
import { SEITEN_TEXTE } from './sperrTexte';

vi.mock('./daten', () => ({
  speichereSeite: vi.fn(),
  speichereMenue: vi.fn(),
  beginneBearbeiten: vi.fn(),
  beendeBearbeiten: vi.fn(),
  uebernimmBearbeitung: vi.fn(),
}));
const d = vi.mocked(D);

const ORT = { modul: 7, kategorie: 20 };
const ICH = { person: 1, name: 'Helene Wiebe', fenster: 'f1' };
const ANDERER = { person: 2, name: 'Jonas Peters', fenster: 'g1' };

const START = seite({
  id: 's',
  titel: 'Start',
  pfad: 'start',
  abschnitte: [
    abschnitt(
      [baustein('ueberschrift', { id: 'u', text: 'Willkommen' }), baustein('text', { id: 't' })],
      { id: 'a0' },
    ),
    abschnitt([], {
      id: 'a1',
      aufteilung: '1-1',
      spalten: [
        spalte([baustein('text', { id: 't2', markdown: 'zweiter Block' })], { id: 'sp0' }),
        spalte([baustein('trenner', { id: 't3' })], { id: 'sp1' }),
      ],
    }),
    abschnitt([], {
      id: 'a2',
      spalten: [spalte([baustein('html', { id: 'h' })], { id: 'sp9' })],
    }),
  ],
});
const IMPRESSUM = seite({ id: 'i', titel: 'Impressum', pfad: 'impressum', startseite: false });
const MENUE = menue([{ titel: 'Impressum', ziel: { art: 'seite', seiteId: 'i' } }]);

const stand = (o: Partial<WebsiteStand> = {}): WebsiteStand => ({
  seiten: [START, IMPRESSUM],
  menue: MENUE,
  einstellungen: null,
  probleme: [],
  verwaist: 0,
  sperren: {},
  einstellungenSperre: null,
  status: {},
  staende: [],
  ...o,
});
let server: { seite: Seite; menue: Menue | null };

const props = (o: Partial<Parameters<typeof Seitenarbeit>[0]> = {}) => ({
  seite: START,
  stand: stand(),
  ort: ORT,
  ich: ICH,
  gemeinde: 'ECG',
  ansicht: 'computer' as const,
  onAnsicht: vi.fn(),
  rechte: { html: true, menue: true },
  onGespeichert: vi.fn(),
  onOffen: vi.fn(),
  onLoeschen: vi.fn(),
  ...o,
});
const rahmen = (titel = 'Start') => screen.getByTitle<HTMLIFrameElement>(`Vorschau: ${titel}`);
const aus = (rest: Record<string, unknown>, titel = 'Start') =>
  act(async () => {
    window.dispatchEvent(
      new MessageEvent('message', {
        data: { websiteEditor: true, ...rest },
        source: rahmen(titel).contentWindow,
      }),
    );
  });
const speicherte = () => d.speichereSeite.mock.calls.map((c) => c[1]);
const ids = (s: Seite) => s.abschnitte.map((a) => a.id);

const abschnittNach = (von: number, nach: number) =>
  aus({ was: 'verschieben', art: 'abschnitt', von, nach });
const baustNach = (von: [number, number, number], nach: [number, number, number]) =>
  aus({
    was: 'verschieben',
    art: 'baustein',
    von: { i: von[0], j: von[1], k: von[2] },
    nach: { i: nach[0], j: nach[1], k: nach[2] },
  });
const zurueck = () => screen.getByRole('button', { name: /Letzte Änderung rückgängig/ });
const wieder = () =>
  screen.getByRole('button', { name: /Rückgängig gemachte Änderung wiederholen/ });
const gespeichert = async (n: number) => {
  await waitFor(() => expect(d.speichereSeite).toHaveBeenCalledTimes(n));
  await screen.findByText('Gespeichert');
};
const strgZ = (ziel: EventTarget = window, init: KeyboardEventInit = {}) =>
  act(async () => {
    ziel.dispatchEvent(
      new KeyboardEvent('keydown', {
        key: 'z',
        ctrlKey: true,
        bubbles: true,
        cancelable: true,
        ...init,
      }),
    );
  });

beforeEach(() => {
  server = { seite: START, menue: MENUE };
  d.beginneBearbeiten.mockImplementation(async () => ({
    art: 'ok',
    seite: server.seite,
    menue: server.menue,
  }));
  d.beendeBearbeiten.mockResolvedValue(undefined);
  d.speichereSeite.mockImplementation(async (_o, s) => {
    server.seite = s;
  });
  d.speichereMenue.mockImplementation(async (_o, m) => {
    server.menue = m;
  });
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.clearAllMocks();
});

describe('Nachricht „verschieben“: übernehmen und speichern', () => {
  it('Abschnitt: genau das Ergebnis der Rechenregel wird gespeichert', async () => {
    render(<Seitenarbeit {...props()} />);
    await abschnittNach(0, 3);
    await gespeichert(1);
    expect(seiteGleich(speicherte()[0], abschnittVerschiebenNach(START, 0, 3))).toBe(true);
    expect(ids(speicherte()[0])).toEqual(['a1', 'a2', 'a0']);
  });

  it('Baustein in eine andere Spalte und in einen anderen Abschnitt', async () => {
    render(<Seitenarbeit {...props()} />);
    await baustNach([0, 0, 1], [1, 1, 0]);
    await gespeichert(1);
    expect(
      seiteGleich(
        speicherte()[0],
        bausteinVerschieben(START, { i: 0, j: 0, k: 1 }, { i: 1, j: 1, k: 0 }),
      ),
    ).toBe(true);
    expect(speicherte()[0].abschnitte[1].spalten[1].bausteine.map((b) => b.id)).toEqual([
      't',
      't3',
    ]);
  });

  it('„bleibt, wo er ist“ und Stellen, die es nicht gibt: nichts wird gespeichert', async () => {
    render(<Seitenarbeit {...props()} />);
    await baustNach([0, 0, 0], [0, 0, 1]);
    await baustNach([0, 0, 0], [9, 0, 0]); // gefälscht: schon die Prüfung der Nachricht lässt sie fallen
    await abschnittNach(1, 2);
    await abschnittNach(1, 99);
    expect(d.speichereSeite).not.toHaveBeenCalled();
  });

  it('fremd gesperrt gibt es keine Bearbeiten-Ebene – auch eine Nachricht verschiebt dann nichts', async () => {
    const sperre = sperreVon(ANDERER, new Date(Date.now() - 60_000));
    render(<Seitenarbeit {...props({ stand: stand({ sperren: { s: sperre } }) })} />);
    await abschnittNach(0, 3);
    expect(d.speichereSeite).not.toHaveBeenCalled();
    expect(d.beginneBearbeiten).not.toHaveBeenCalled();
    expect((zurueck() as HTMLButtonElement).disabled).toBe(true);
  });

  it('„Eigenes HTML“: die Leitung darf es verschieben, ein Redakteur nicht – auch nicht mit einer gefälschten Nachricht', async () => {
    const { unmount } = render(
      <Seitenarbeit {...props({ rechte: { html: false, menue: false } })} />,
    );
    await baustNach([2, 0, 0], [0, 0, 0]);
    await screen.findByText(/Eigenes HTML kann nur die Leitung verschieben/);
    expect(d.speichereSeite).not.toHaveBeenCalled();
    // anderer Baustein: erlaubt
    await baustNach([0, 0, 1], [2, 0, 0]);
    await gespeichert(1);
    unmount();
    vi.clearAllMocks();
    server = { seite: START, menue: MENUE };
    render(<Seitenarbeit {...props()} />);
    await baustNach([2, 0, 0], [0, 0, 0]);
    await gespeichert(1);
    expect(speicherte()[0].abschnitte[0].spalten[0].bausteine[0].id).toBe('h');
  });

  it('die Nachricht aus einem anderen Fenster verschiebt nichts', async () => {
    render(<Seitenarbeit {...props()} />);
    await act(async () => {
      window.dispatchEvent(
        new MessageEvent('message', {
          data: { websiteEditor: true, was: 'verschieben', art: 'abschnitt', von: 0, nach: 3 },
          source: window,
        }),
      );
    });
    expect(d.speichereSeite).not.toHaveBeenCalled();
  });
});

describe('Rückgängig und Wiederholen', () => {
  it('ohne Änderung sind beide Knöpfe aus; nach dem Verschieben geht „Rückgängig“, nach dem Zurücknehmen „Wiederholen“', async () => {
    render(<Seitenarbeit {...props()} />);
    expect((zurueck() as HTMLButtonElement).disabled).toBe(true);
    expect((wieder() as HTMLButtonElement).disabled).toBe(true);
    await abschnittNach(0, 3);
    await gespeichert(1);
    expect((zurueck() as HTMLButtonElement).disabled).toBe(false);
    expect((wieder() as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(zurueck());
    await gespeichert(2);
    expect(seiteGleich(speicherte()[1], START)).toBe(true);
    expect((zurueck() as HTMLButtonElement).disabled).toBe(true);
    expect((wieder() as HTMLButtonElement).disabled).toBe(false);
    fireEvent.click(wieder());
    await gespeichert(3);
    expect(ids(speicherte()[2])).toEqual(['a1', 'a2', 'a0']);
  });

  it('Reihenfolge: zwei Schritte, zweimal zurück, einmal vor – und ein neuer Schritt löscht das Wiederholen', async () => {
    render(<Seitenarbeit {...props()} />);
    await abschnittNach(0, 3); // a1 a2 a0
    await gespeichert(1);
    await abschnittNach(2, 0); // a0 a1 a2
    await waitFor(() => expect(d.speichereSeite).toHaveBeenCalledTimes(2));
    await screen.findByText('Gespeichert');
    fireEvent.click(zurueck());
    await waitFor(() => expect(d.speichereSeite).toHaveBeenCalledTimes(3));
    expect(ids(speicherte()[2])).toEqual(['a1', 'a2', 'a0']);
    await screen.findByText('Gespeichert');
    fireEvent.click(zurueck());
    await waitFor(() => expect(d.speichereSeite).toHaveBeenCalledTimes(4));
    expect(seiteGleich(speicherte()[3], START)).toBe(true);
    await screen.findByText('Gespeichert');
    fireEvent.click(wieder());
    await waitFor(() => expect(d.speichereSeite).toHaveBeenCalledTimes(5));
    expect(ids(speicherte()[4])).toEqual(['a1', 'a2', 'a0']);
    await screen.findByText('Gespeichert');
    await abschnittNach(0, 2); // neuer Schritt
    await waitFor(() => expect(d.speichereSeite).toHaveBeenCalledTimes(6));
    expect((wieder() as HTMLButtonElement).disabled).toBe(true);
  });

  it('Kopieren, Löschen (nach der Rückfrage) und Einfügen lassen sich zurücknehmen', async () => {
    render(<Seitenarbeit {...props()} />);
    await aus({ was: 'kopieren', i: 0 });
    await gespeichert(1);
    expect(speicherte()[0].abschnitte).toHaveLength(4);
    fireEvent.click(zurueck());
    await gespeichert(2);
    expect(seiteGleich(speicherte()[1], START)).toBe(true);
    // löschen
    await aus({ was: 'loeschen', i: 1 });
    fireEvent.click(
      within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Löschen' }),
    );
    await waitFor(() => expect(d.speichereSeite).toHaveBeenCalledTimes(3));
    expect(speicherte()[2].abschnitte).toHaveLength(2);
    await screen.findByText('Gespeichert');
    fireEvent.click(zurueck());
    await waitFor(() => expect(d.speichereSeite).toHaveBeenCalledTimes(4));
    expect(seiteGleich(speicherte()[3], START)).toBe(true);
  });

  it('der übernommene getippte Text ist ein Schritt', async () => {
    render(<Seitenarbeit {...props()} />);
    const stelle = { i: 0, j: 0, k: 0, feld: 'text', n: 0 };
    await aus({ was: 'tippen', ...stelle });
    await aus({ was: 'text', ...stelle, wert: 'Herzlich willkommen' });
    await gespeichert(1);
    fireEvent.click(zurueck());
    await gespeichert(2);
    expect(seiteGleich(speicherte()[1], START)).toBe(true);
  });

  it('beim Seitenwechsel ist der Verlauf leer (die Seite entsteht neu)', async () => {
    const { rerender } = render(<Seitenarbeit key="s" {...props()} />);
    await abschnittNach(0, 3);
    await gespeichert(1);
    expect((zurueck() as HTMLButtonElement).disabled).toBe(false);
    rerender(<Seitenarbeit key="i" {...props({ seite: IMPRESSUM })} />);
    expect((zurueck() as HTMLButtonElement).disabled).toBe(true);
    // und zurück: auch die erste Seite fängt neu an
    rerender(<Seitenarbeit key="s2" {...props()} />);
    expect((zurueck() as HTMLButtonElement).disabled).toBe(true);
  });

  it('hat jemand anderes inzwischen gespeichert, wird NICHT darüber geschrieben', async () => {
    render(<Seitenarbeit {...props()} />);
    await abschnittNach(0, 3);
    await gespeichert(1);
    // Jonas speichert eine andere Fassung
    const fremd = abschnittVerschiebenNach(server.seite, 2, 0);
    server.seite = fremd;
    fireEvent.click(zurueck());
    await screen.findByText(SEITEN_TEXTE.veraendert);
    expect(d.speichereSeite).toHaveBeenCalledTimes(1); // nur der erste Schritt – Rückgängig hat nichts geschrieben
    expect(server.seite).toBe(fremd);
  });

  it('wurde der gespeicherte Stand beim Handgriff neu geladen, ist der Verlauf weg und der Hinweis steht da', async () => {
    render(<Seitenarbeit {...props()} />);
    await abschnittNach(0, 3);
    await gespeichert(1);
    // Sperre verloren und von jemand anderem mit neuem Stand genommen: der nächste Handgriff liest neu
    server.seite = abschnittVerschiebenNach(server.seite, 2, 0);
    d.beginneBearbeiten.mockImplementation(async () => ({
      art: 'ok',
      seite: server.seite,
      menue: server.menue,
    }));
    fireEvent.click(zurueck());
    await waitFor(() => expect(d.beginneBearbeiten).toHaveBeenCalled());
    expect(server.seite).not.toBe(START);
    expect(d.speichereSeite).toHaveBeenCalledTimes(1);
  });

  it('Strg+Z auf der Seite macht zurück, Umschalt+Strg+Z vor – aber nicht in einem Eingabefeld und nicht bei offenem Fenster', async () => {
    render(<Seitenarbeit {...props()} />);
    await abschnittNach(0, 3);
    await gespeichert(1);
    // im Eingabefeld: nichts
    const feld = document.createElement('input');
    document.body.appendChild(feld);
    await strgZ(feld);
    expect(d.speichereSeite).toHaveBeenCalledTimes(1);
    const bearbeitbar = document.createElement('div');
    bearbeitbar.contentEditable = 'true';
    document.body.appendChild(bearbeitbar);
    Object.defineProperty(bearbeitbar, 'isContentEditable', { value: true });
    await strgZ(bearbeitbar);
    expect(d.speichereSeite).toHaveBeenCalledTimes(1);
    // bei offenem Fenster: nichts
    await aus({ was: 'gestalten', i: 0 });
    await strgZ(document.body);
    expect(d.speichereSeite).toHaveBeenCalledTimes(1);
    fireEvent.click(await screen.findByRole('button', { name: 'Abbrechen' }));
    // auf der Seite: zurück
    await strgZ(document.body);
    await waitFor(() => expect(d.speichereSeite).toHaveBeenCalledTimes(2));
    expect(seiteGleich(speicherte()[1], START)).toBe(true);
    await screen.findByText('Gespeichert');
    await strgZ(document.body, { shiftKey: true });
    await waitFor(() => expect(d.speichereSeite).toHaveBeenCalledTimes(3));
    expect(ids(speicherte()[2])).toEqual(['a1', 'a2', 'a0']);
  });

  it('die Nachricht „rueckgaengig“ aus der Vorschau (Taste im iframe) wirkt wie der Knopf', async () => {
    render(<Seitenarbeit {...props()} />);
    await abschnittNach(0, 3);
    await gespeichert(1);
    await aus({ was: 'rueckgaengig' });
    await waitFor(() => expect(d.speichereSeite).toHaveBeenCalledTimes(2));
    await screen.findByText('Gespeichert');
    await aus({ was: 'wiederholen' });
    await waitFor(() => expect(d.speichereSeite).toHaveBeenCalledTimes(3));
  });

  it('ein Fenster mit „Fertig“ ist ein Schritt', async () => {
    render(<Seitenarbeit {...props()} />);
    await aus({ was: 'gestalten', i: 0 });
    const f = await screen.findByRole('dialog');
    fireEvent.click(
      within(within(f).getAllByRole('group', { name: 'Abstand oben und unten' })[0]).getByRole(
        'button',
        { name: 'Groß' },
      ),
    );
    fireEvent.click(within(f).getByRole('button', { name: 'Fertig' }));
    await gespeichert(1);
    expect((zurueck() as HTMLButtonElement).disabled).toBe(false);
    fireEvent.click(zurueck());
    await gespeichert(2);
    expect(seiteGleich(speicherte()[1], START)).toBe(true);
  });

  it('„Seite einstellen“ mit „Fertig“ leert den Verlauf (Titel und Menü gehen nicht zurück, die Schritte davor passen nicht mehr)', async () => {
    render(<Seitenarbeit {...props()} />);
    await abschnittNach(0, 3);
    await gespeichert(1);
    expect((zurueck() as HTMLButtonElement).disabled).toBe(false);
    fireEvent.click(screen.getByRole('button', { name: 'Seite einstellen' }));
    const f = await screen.findByRole('dialog');
    fireEvent.change(within(f).getByLabelText('Titel'), { target: { value: 'Willkommen!' } });
    fireEvent.click(within(f).getByRole('button', { name: 'Fertig' }));
    await waitFor(() => expect(d.speichereSeite).toHaveBeenCalledTimes(2));
    expect((zurueck() as HTMLButtonElement).disabled).toBe(true);
  });

  it('wird der gespeicherte Stand bewusst übernommen („Bearbeitung übernehmen“), beginnt der Verlauf neu', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    render(<Seitenarbeit {...props()} />);
    await abschnittNach(0, 3);
    await vi.waitFor(() => expect(screen.getByText('Gespeichert')).toBeTruthy());
    expect((zurueck() as HTMLButtonElement).disabled).toBe(false);
    // ein anderes Fenster nimmt die Sperre …
    d.beginneBearbeiten.mockResolvedValue({
      art: 'gesperrt',
      sperre: sperreVon(ANDERER, new Date()),
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(LEBENSZEICHEN_MS);
    });
    // … und wir übernehmen sie zurück: der gespeicherte Stand ersetzt die Arbeitskopie
    d.uebernimmBearbeitung.mockResolvedValue({
      art: 'ok',
      seite: server.seite,
      menue: server.menue,
    });
    fireEvent.click(screen.getByRole('button', { name: 'Bearbeitung übernehmen' }));
    fireEvent.click(screen.getByRole('button', { name: 'Übernehmen' }));
    await vi.waitFor(() => expect(d.uebernimmBearbeitung).toHaveBeenCalled());
    await vi.waitFor(() => expect(screen.queryByRole('button', { name: 'Übernehmen' })).toBeNull());
    expect((zurueck() as HTMLButtonElement).disabled).toBe(true);
  });

  it('am Handy gibt es die Knöpfe nicht', () => {
    render(<Seitenarbeit {...props({ ansicht: 'handy' })} />);
    expect(screen.queryByRole('button', { name: /Letzte Änderung rückgängig/ })).toBeNull();
  });
});
