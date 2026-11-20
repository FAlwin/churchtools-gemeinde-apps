// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { ApiError } from '@ui/ct/fehler';
import { sperreVon } from '@shared/ct/sperre';
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

const START = seite({
  id: 's',
  titel: 'Start',
  pfad: 'start',
  abschnitte: [
    abschnitt(
      [baustein('ueberschrift', { id: 'u', text: 'Willkommen' }), baustein('text', { id: 't' })],
      {
        id: 'a0',
      },
    ),
    abschnitt([], {
      id: 'a1',
      aufteilung: '1-1',
      spalten: [
        spalte([baustein('text', { id: 't2', markdown: 'zweiter Block' })], { id: 'sp0' }),
        spalte([baustein('trenner', { id: 't3' })], { id: 'sp1' }),
      ],
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

/** Was „der Server“ gerade hat – die Mocks lesen und schreiben darin. */
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
const doc = (titel = 'Start') => rahmen(titel).getAttribute('srcdoc') ?? '';

/** Eine Nachricht, wie das iframe sie schickt. */
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

/** Das Feld, das getippt wird (wie das iframe es meldet), und dann der Text. */
const tippen = (stelle: Record<string, unknown>, titel = 'Start') =>
  aus({ was: 'tippen', ...stelle }, titel);
const UEBERSCHRIFT = { i: 0, j: 0, k: 0, feld: 'text', n: 0 };
const TEXT_FELD = { i: 0, j: 0, k: 1, feld: 'markdown', n: 0 };
const bausteinDe = (s: Seite, i: number, j: number, k: number) =>
  s.abschnitte[i].spalten[j].bausteine[k];

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

describe('Text direkt tippen: übernehmen, speichern', () => {
  it('der getippte Text einer Überschrift wird in die Seite übernommen und über die Schlange gespeichert', async () => {
    render(<Seitenarbeit {...props()} />);
    await tippen(UEBERSCHRIFT);
    await aus({ was: 'text', ...UEBERSCHRIFT, wert: 'Herzlich willkommen' });
    await waitFor(() => expect(d.speichereSeite).toHaveBeenCalledTimes(1));
    expect(bausteinDe(speicherte()[0], 0, 0, 0)).toMatchObject({
      typ: 'ueberschrift',
      text: 'Herzlich willkommen',
    });
    await screen.findByText('Gespeichert');
    expect(doc()).toContain('Herzlich willkommen'); // die Vorschau zeigt, was gespeichert wurde
  });

  it('Text mit Auszeichnung: Markdown mit Escape wird gespeichert, die Vorschau zeigt genau den getippten Text', async () => {
    render(<Seitenarbeit {...props()} />);
    await tippen(TEXT_FELD);
    await aus({
      was: 'text',
      ...TEXT_FELD,
      bloecke: [{ art: 'p', laeufe: [{ t: 'Sterne * und ' }, { t: 'fett', fett: true }] }],
    });
    await waitFor(() => expect(d.speichereSeite).toHaveBeenCalledTimes(1));
    expect(bausteinDe(speicherte()[0], 0, 0, 1)).toMatchObject({
      markdown: 'Sterne \\* und **fett**',
    });
    expect(doc()).toContain('Sterne * und <strong>fett</strong>');
  });

  it('die Sperre wird schon beim ERSTEN Tippen genommen, nicht erst beim Übernehmen', async () => {
    render(<Seitenarbeit {...props()} />);
    await tippen(UEBERSCHRIFT);
    await waitFor(() => expect(d.beginneBearbeiten).toHaveBeenCalledTimes(1));
    expect(d.speichereSeite).not.toHaveBeenCalled();
  });

  it('die Vorschau wird nach jedem übernommenen Text neu gezeichnet (ein neues iframe)', async () => {
    render(<Seitenarbeit {...props()} />);
    const vorher = rahmen();
    await tippen(UEBERSCHRIFT);
    await aus({ was: 'text', ...UEBERSCHRIFT, wert: 'Anders' });
    await waitFor(() => expect(rahmen()).not.toBe(vorher));
  });

  it('ein ungültiger Text (leere Überschrift) wird NICHT übernommen: nichts gespeichert, ruhiger Hinweis, Vorschau zeigt den alten Stand', async () => {
    render(<Seitenarbeit {...props()} />);
    const vorher = rahmen();
    await tippen(UEBERSCHRIFT);
    await aus({ was: 'text', ...UEBERSCHRIFT, wert: '   ' });
    expect(await screen.findByText(/Das geht so nicht/)).toBeTruthy();
    expect(d.speichereSeite).not.toHaveBeenCalled();
    expect(doc()).toContain('Willkommen');
    expect(rahmen()).not.toBe(vorher); // neu gezeichnet: das iframe zeigt wieder den gespeicherten Text
  });

  it('zu langer Text (Schema): abgelehnt, nichts gespeichert', async () => {
    render(<Seitenarbeit {...props()} />);
    await tippen(UEBERSCHRIFT);
    await aus({ was: 'text', ...UEBERSCHRIFT, wert: 'x'.repeat(201) });
    expect(await screen.findByText(/Das geht so nicht/)).toBeTruthy();
    expect(d.speichereSeite).not.toHaveBeenCalled();
  });

  it('eine Formatierung, die sich nicht genau schreiben lässt: abgelehnt mit Hinweis, der Text bleibt', async () => {
    render(<Seitenarbeit {...props()} />);
    await tippen(TEXT_FELD);
    await aus({
      was: 'text',
      ...TEXT_FELD,
      bloecke: [
        {
          art: 'p',
          laeufe: [
            { t: 'a', kursiv: true },
            { t: 'b', fett: true },
          ],
        },
      ],
    });
    expect(await screen.findByText(/lassen sich im Text nicht speichern/)).toBeTruthy();
    expect(d.speichereSeite).not.toHaveBeenCalled();
  });

  it('Speichern scheitert (503): „Nicht gespeichert“ bleibt sichtbar, der Text bleibt in der Vorschau – „Erneut versuchen“ speichert ihn', async () => {
    d.speichereSeite.mockRejectedValueOnce(new ApiError(503, 'x'));
    render(<Seitenarbeit {...props()} />);
    await tippen(UEBERSCHRIFT);
    await aus({ was: 'text', ...UEBERSCHRIFT, wert: 'Neu getippt' });
    const meldung = await screen.findByRole('alert');
    expect(meldung.textContent).toMatch(/Nicht gespeichert/);
    expect(screen.getByText('Nicht gespeichert')).toBeTruthy();
    expect(doc()).toContain('Neu getippt');
    fireEvent.click(screen.getByRole('button', { name: 'Erneut versuchen' }));
    await screen.findByText('Gespeichert');
    expect(bausteinDe(speicherte()[1], 0, 0, 0)).toMatchObject({ text: 'Neu getippt' });
  });

  it('der Text eines nicht tippbaren Bausteins (Trenner) und „Eigenes HTML“ kommt nie an', async () => {
    const mitHtml = seite({
      id: 's',
      titel: 'Start',
      pfad: 'start',
      abschnitte: [abschnitt([baustein('html', { id: 'h' }), baustein('trenner', { id: 'x' })])],
    });
    server.seite = mitHtml;
    render(<Seitenarbeit {...props({ seite: mitHtml, stand: stand({ seiten: [mitHtml] }) })} />);
    for (const k of [0, 1]) {
      await tippen({ i: 0, j: 0, k, feld: 'text', n: 0 });
      await aus({ was: 'text', i: 0, j: 0, k, feld: 'text', n: 0, wert: 'Böse' });
    }
    expect(d.beginneBearbeiten).not.toHaveBeenCalled();
    expect(d.speichereSeite).not.toHaveBeenCalled();
    expect(doc()).not.toContain('Böse');
  });

  it('ein Text ohne vorheriges „tippen“ (gefälscht) wird ignoriert', async () => {
    render(<Seitenarbeit {...props()} />);
    await aus({ was: 'text', ...UEBERSCHRIFT, wert: 'Gefälscht' });
    expect(d.beginneBearbeiten).not.toHaveBeenCalled();
    expect(d.speichereSeite).not.toHaveBeenCalled();
  });
});

describe('Fremd gesperrt: nur ansehen', () => {
  it('keine Schicht im iframe, also kein Tippen, keine Leisten; Nachrichten (auch „tippen“ und „text“) bewirken nichts', async () => {
    const fremd = sperreVon(ANDERER, new Date(Date.now() - 60_000));
    render(<Seitenarbeit {...props({ stand: stand({ sperren: { s: fremd } }) })} />);
    expect(doc()).not.toMatch(/websiteEditor|b-werk|class="b-ueber"|contenteditable/);
    await tippen(UEBERSCHRIFT);
    await aus({ was: 'text', ...UEBERSCHRIFT, wert: 'Fremd' });
    expect(d.beginneBearbeiten).not.toHaveBeenCalled();
    expect(d.speichereSeite).not.toHaveBeenCalled();
    expect(doc()).not.toContain('Fremd');
  });

  it('nimmt jemand anderes die Sperre, während man beginnt zu tippen: der Text wird nicht übernommen, der Grund steht da', async () => {
    d.beginneBearbeiten.mockResolvedValue({
      art: 'gesperrt',
      sperre: sperreVon(ANDERER, new Date()),
    });
    render(<Seitenarbeit {...props()} />);
    const vorher = rahmen();
    await tippen(UEBERSCHRIFT);
    await aus({ was: 'text', ...UEBERSCHRIFT, wert: 'Zu spät' });
    expect(await screen.findByText(/Gerade bearbeitet von Jonas Peters/)).toBeTruthy();
    expect(doc()).not.toMatch(/websiteEditor/); // jetzt nur noch ansehen: die Schicht ist weg, das Getippte steht nicht mehr da
    expect(rahmen()).toBe(vorher); // (dasselbe iframe, mit neuem Inhalt)
    expect(d.speichereSeite).not.toHaveBeenCalled();
    expect(doc()).not.toContain('Zu spät');
  });
});

describe('Ohne Sperre wird der Text nicht übernommen – und nicht still behalten', () => {
  it('ChurchTools antwortet nicht (503) beim Tippen UND beim Übernehmen: nichts gespeichert, Hinweis, die Vorschau zeigt wieder den alten Text', async () => {
    d.beginneBearbeiten.mockRejectedValue(new ApiError(503, 'x'));
    render(<Seitenarbeit {...props()} />);
    const vorher = rahmen();
    await tippen(UEBERSCHRIFT);
    await aus({ was: 'text', ...UEBERSCHRIFT, wert: 'Geht nicht' });
    expect(await screen.findByText(/antwortet gerade nicht/)).toBeTruthy();
    expect(d.speichereSeite).not.toHaveBeenCalled();
    expect(rahmen()).not.toBe(vorher); // neu gezeichnet: das iframe zeigt wieder den gespeicherten Text
    expect(doc()).toContain('Willkommen');
    expect(doc()).not.toContain('Geht nicht');
  });
});

describe('Rollen: was die Schicht anbietet', () => {
  it('Redakteure (ohne Eigenes HTML) bekommen die Einstellung `darfHtml: false`, Leitung `true`', () => {
    render(<Seitenarbeit {...props({ rechte: { html: false, menue: false } })} />);
    expect(doc()).toContain('"darfHtml":false');
    cleanup();
    render(<Seitenarbeit {...props({ rechte: { html: true, menue: true } })} />);
    expect(doc()).toContain('"darfHtml":true');
  });

  it('Text tippen darf auch ein Redakteur', async () => {
    render(<Seitenarbeit {...props({ rechte: { html: false, menue: false } })} />);
    await tippen(UEBERSCHRIFT);
    await aus({ was: 'text', ...UEBERSCHRIFT, wert: 'Vom Redakteur' });
    await waitFor(() => expect(d.speichereSeite).toHaveBeenCalledTimes(1));
    expect(bausteinDe(speicherte()[0], 0, 0, 0)).toMatchObject({ text: 'Vom Redakteur' });
  });
});
