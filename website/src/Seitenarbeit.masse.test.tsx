// @vitest-environment jsdom
/**
 * W3c-3 in der Seitenarbeit: Spaltenbreite und Abstand per Ziehen. Die Rechenregeln prüft `shared/website/bearbeiten.test.ts`, die
 * Form der Nachrichten `nachricht.test.ts`, das Ziehen selbst `ebene.masse.test.ts`; hier geht es um den Weg: Nachricht → Prüfung →
 * Schlange → Speichern, um Rückgängig und um Rechte und Sperre.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { sperreVon } from '@shared/ct/sperre';
import { seiteGleich } from '@shared/website/bearbeiten';
import type { Menue, Seite } from '@shared/website/modell';
import type { WebsiteStand } from '@shared/website/speicher';
import { abschnitt, baustein, menue, seite, spalte } from '@shared/website/website.testdaten';
import * as D from './daten';
import { Seitenarbeit } from './Seitenarbeit';

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

/** a0: eine Spalte · a1: zwei Spalten (1-1) mit Text links und Trenner rechts · a2: drei Spalten. */
const START = seite({
  id: 's',
  titel: 'Start',
  pfad: 'start',
  abschnitte: [
    abschnitt([baustein('ueberschrift', { id: 'u', text: 'Willkommen' })], { id: 'a0' }),
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
      aufteilung: '1-1-1',
      spalten: [0, 1, 2].map((n) => spalte([baustein('text', { id: `x${n}` })], { id: `y${n}` })),
    }),
  ],
});
const MENUE = menue([]);
const stand = (o: Partial<WebsiteStand> = {}): WebsiteStand => ({
  seiten: [START],
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
const rahmen = () => screen.getByTitle<HTMLIFrameElement>('Vorschau: Start');
const aus = (rest: Record<string, unknown>) =>
  act(async () => {
    window.dispatchEvent(
      new MessageEvent('message', {
        data: { websiteEditor: true, ...rest },
        source: rahmen().contentWindow,
      }),
    );
  });
const speicherte = () => d.speichereSeite.mock.calls.map((c) => c[1]);
const gespeichert = async (n: number) => {
  await waitFor(() => expect(d.speichereSeite).toHaveBeenCalledTimes(n));
  await screen.findByText('Gespeichert');
};
const zurueck = () => screen.getByRole('button', { name: /Letzte Änderung rückgängig/ });
const wieder = () =>
  screen.getByRole('button', { name: /Rückgängig gemachte Änderung wiederholen/ });
/** Die Bausteine mit ihren Stellen – ändert sich beim Ziehen der Maße nie. */
const bausteine = (s: Seite) =>
  s.abschnitte.map((a) => a.spalten.map((sp) => sp.bausteine.map((b) => b.id)));

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
  vi.clearAllMocks();
});

describe('Nachricht „aufteilung“: übernehmen und speichern', () => {
  it('ändert nur die Aufteilung dieses Abschnitts – Spalten und Bausteine bleiben, wo sie sind', async () => {
    render(<Seitenarbeit {...props()} />);
    await aus({ was: 'aufteilung', i: 1, aufteilung: '2-1' });
    await gespeichert(1);
    const neu = speicherte()[0];
    expect(neu.abschnitte[1].aufteilung).toBe('2-1');
    expect(neu.abschnitte[0]).toEqual(START.abschnitte[0]);
    expect(neu.abschnitte[2]).toEqual(START.abschnitte[2]);
    expect(bausteine(neu)).toEqual(bausteine(START));
    expect(neu.abschnitte[1].spalten.map((s) => s.id)).toEqual(['sp0', 'sp1']);
    // die Vorschau zeigt die neue Aufteilung
    expect(rahmen().getAttribute('srcdoc')).toContain('w-spalten--2-1');
  });

  it('eine Aufteilung mit anderer Spaltenzahl, die gleiche Aufteilung, ein fehlender Abschnitt: nichts wird gespeichert', async () => {
    render(<Seitenarbeit {...props()} />);
    await aus({ was: 'aufteilung', i: 1, aufteilung: '1-1-1' }); // andere Spaltenzahl: schon die Prüfung der Nachricht
    await aus({ was: 'aufteilung', i: 1, aufteilung: '1' });
    await aus({ was: 'aufteilung', i: 2, aufteilung: '1-1' }); // a2 hat drei Spalten
    await aus({ was: 'aufteilung', i: 1, aufteilung: '1-1' }); // gilt schon
    await aus({ was: 'aufteilung', i: 9, aufteilung: '2-1' });
    await aus({ was: 'aufteilung', i: 1, aufteilung: '5-1' });
    expect(d.speichereSeite).not.toHaveBeenCalled();
    expect((zurueck() as HTMLButtonElement).disabled).toBe(true);
  });

  it('Rückgängig und Wiederholen', async () => {
    render(<Seitenarbeit {...props()} />);
    await aus({ was: 'aufteilung', i: 1, aufteilung: '1-2' });
    await gespeichert(1);
    expect((zurueck() as HTMLButtonElement).disabled).toBe(false);
    fireEvent.click(zurueck());
    await gespeichert(2);
    expect(seiteGleich(speicherte()[1], START)).toBe(true);
    fireEvent.click(wieder());
    await gespeichert(3);
    expect(speicherte()[2].abschnitte[1].aufteilung).toBe('1-2');
  });
});

describe('Nachricht „abstand“: übernehmen und speichern', () => {
  it('ändert nur den Abstand dieses Abschnitts – der Rest der Gestaltung bleibt', async () => {
    render(<Seitenarbeit {...props()} />);
    await aus({ was: 'abstand', i: 1, abstand: 'gross' });
    await gespeichert(1);
    const neu = speicherte()[0];
    expect(neu.abschnitte[1].gestaltung).toEqual({
      ...START.abschnitte[1].gestaltung,
      abstand: 'gross',
    });
    expect(neu.abschnitte[0]).toEqual(START.abschnitte[0]);
    expect(neu.abschnitte[2]).toEqual(START.abschnitte[2]);
    expect(bausteine(neu)).toEqual(bausteine(START));
    expect(rahmen().getAttribute('srcdoc')).toContain('w-abschnitt--abstand-gross');
  });

  it('unbekannte Stufe, dieselbe Stufe, Abschnitt gibt es nicht: nichts wird gespeichert', async () => {
    render(<Seitenarbeit {...props()} />);
    await aus({ was: 'abstand', i: 1, abstand: 'riesig' });
    await aus({ was: 'abstand', i: 1, abstand: START.abschnitte[1].gestaltung.abstand });
    await aus({ was: 'abstand', i: 9, abstand: 'klein' });
    expect(d.speichereSeite).not.toHaveBeenCalled();
  });

  it('Rückgängig und Wiederholen', async () => {
    render(<Seitenarbeit {...props()} />);
    await aus({ was: 'abstand', i: 0, abstand: 'klein' });
    await gespeichert(1);
    fireEvent.click(zurueck());
    await gespeichert(2);
    expect(seiteGleich(speicherte()[1], START)).toBe(true);
    fireEvent.click(wieder());
    await gespeichert(3);
    expect(speicherte()[2].abschnitte[0].gestaltung.abstand).toBe('klein');
  });

  it('beides hintereinander sind zwei Schritte, die man einzeln zurücknimmt', async () => {
    render(<Seitenarbeit {...props()} />);
    await aus({ was: 'aufteilung', i: 1, aufteilung: '2-1' });
    await gespeichert(1);
    await aus({ was: 'abstand', i: 1, abstand: 'klein' });
    await waitFor(() => expect(d.speichereSeite).toHaveBeenCalledTimes(2));
    await screen.findByText('Gespeichert');
    fireEvent.click(zurueck());
    await waitFor(() => expect(d.speichereSeite).toHaveBeenCalledTimes(3));
    expect(speicherte()[2].abschnitte[1].aufteilung).toBe('2-1');
    expect(speicherte()[2].abschnitte[1].gestaltung.abstand).toBe(
      START.abschnitte[1].gestaltung.abstand,
    );
    await screen.findByText('Gespeichert');
    fireEvent.click(zurueck());
    await waitFor(() => expect(d.speichereSeite).toHaveBeenCalledTimes(4));
    expect(seiteGleich(speicherte()[3], START)).toBe(true);
  });
});

describe('Rechte, Sperre, Quelle', () => {
  it('Redakteure dürfen beides – es sind Maße dieser Seite, kein Aussehen der ganzen Website', async () => {
    render(<Seitenarbeit {...props({ rechte: { html: false, menue: false } })} />);
    await aus({ was: 'aufteilung', i: 1, aufteilung: '2-1' });
    await gespeichert(1);
    await aus({ was: 'abstand', i: 1, abstand: 'klein' });
    await waitFor(() => expect(d.speichereSeite).toHaveBeenCalledTimes(2));
  });

  it('fremd gesperrt gibt es keine Ebene (also keine Griffe) – auch eine Nachricht ändert dann nichts', async () => {
    const sperre = sperreVon(ANDERER, new Date(Date.now() - 60_000));
    render(<Seitenarbeit {...props({ stand: stand({ sperren: { s: sperre } }) })} />);
    // Die Ebene (Skript mit seiner Konfiguration) hängt nur an der bearbeitbaren Vorschau – in der gesperrten fehlt sie samt den Griffen.
    expect(rahmen().getAttribute('srcdoc')).not.toContain('"aufteilungen"');
    await aus({ was: 'aufteilung', i: 1, aufteilung: '2-1' });
    await aus({ was: 'abstand', i: 1, abstand: 'klein' });
    expect(d.speichereSeite).not.toHaveBeenCalled();
    expect(d.beginneBearbeiten).not.toHaveBeenCalled();
  });

  it('ohne Sperre (jemand anderes war schneller) wird nichts gespeichert', async () => {
    d.beginneBearbeiten.mockResolvedValue({
      art: 'gesperrt',
      sperre: sperreVon(ANDERER, new Date()),
    } as never);
    render(<Seitenarbeit {...props()} />);
    await aus({ was: 'aufteilung', i: 1, aufteilung: '2-1' });
    await aus({ was: 'abstand', i: 1, abstand: 'klein' });
    expect(d.speichereSeite).not.toHaveBeenCalled();
  });

  it('die Nachricht aus einem anderen Fenster ändert nichts', async () => {
    render(<Seitenarbeit {...props()} />);
    await act(async () => {
      window.dispatchEvent(
        new MessageEvent('message', {
          data: { websiteEditor: true, was: 'aufteilung', i: 1, aufteilung: '2-1' },
          source: window,
        }),
      );
      window.dispatchEvent(
        new MessageEvent('message', {
          data: { websiteEditor: true, was: 'abstand', i: 1, abstand: 'klein' },
          source: window,
        }),
      );
    });
    expect(d.speichereSeite).not.toHaveBeenCalled();
  });

  it('ein Klick auf die Pille ohne Ziehen schickt „gestalten“ – und das öffnet das Fenster, ohne etwas zu ändern', async () => {
    render(<Seitenarbeit {...props()} />);
    await aus({ was: 'gestalten', i: 1 });
    await screen.findByRole('dialog');
    expect(d.speichereSeite).not.toHaveBeenCalled();
  });

  it('am Handy bekommt die Vorschau keine Maß-Griffe', () => {
    render(<Seitenarbeit {...props({ ansicht: 'handy' })} />);
    // im Skript sind die Griffe nur am Computer angelegt (`voll`); der Modus steht in der Konfiguration
    expect(rahmen().getAttribute('srcdoc')).toContain('"modus":"handy"');
    expect(rahmen().getAttribute('srcdoc')).toContain('"aufteilungen"'); // die Konfiguration kommt aus dem Modell
  });
});
