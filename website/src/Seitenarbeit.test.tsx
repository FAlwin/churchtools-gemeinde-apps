// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { ApiError } from '@ui/ct/fehler';
import { sperreVon } from '@shared/ct/sperre';
import type { Menue, Seite } from '@shared/website/modell';
import type { WebsiteStand } from '@shared/website/speicher';
import { VORLAGEN } from '@shared/website/vorlagen';
import { abschnitt, baustein, menue, seite, spalte } from '@shared/website/website.testdaten';
import * as D from './daten';
import { LEBENSZEICHEN_MS } from './regeln';
import { Seitenarbeit } from './Seitenarbeit';

vi.mock('./daten', () => ({
  speichereSeite: vi.fn(),
  speichereMenue: vi.fn(),
  beginneBearbeiten: vi.fn(),
  beendeBearbeiten: vi.fn(),
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
  rechte: { html: true },
  onGespeichert: vi.fn(),
  onOffen: vi.fn(),
  onLoeschen: vi.fn(),
  ...o,
});

const rahmen = (titel = 'Start') => screen.getByTitle<HTMLIFrameElement>(`Vorschau: ${titel}`);
const doc = (titel = 'Start') => rahmen(titel).getAttribute('srcdoc') ?? '';
/** Wo steht ein Text im Inhalt der Seite? (Nicht im Stylesheet davor.) */
const pos = (text: string) => doc().indexOf(text, doc().indexOf('<main'));

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

describe('Leistenaktionen: nach oben, unten, kopieren – sofort gespeichert', () => {
  it('„nach unten“ tauscht die Abschnitte, speichert die ganze Seite und zeigt „Gespeichert“', async () => {
    render(<Seitenarbeit {...props()} />);
    await aus({ was: 'runter', i: 0 });
    await waitFor(() => expect(d.speichereSeite).toHaveBeenCalledTimes(1));
    expect(speicherte()[0].abschnitte.map((a) => a.id)).toEqual(['a1', 'a0']);
    await screen.findByText('Gespeichert');
    // Die Vorschau zeigt die neue Reihenfolge (der zweite Abschnitt steht oben)
    expect(pos('zweiter Block')).toBeLessThan(pos('Willkommen'));
  });

  it('„kopieren“: die Kopie steht darunter, mit neuen Kennungen', async () => {
    render(<Seitenarbeit {...props()} />);
    await aus({ was: 'kopieren', i: 0 });
    await waitFor(() => expect(d.speichereSeite).toHaveBeenCalledTimes(1));
    const s = speicherte()[0];
    expect(s.abschnitte).toHaveLength(3);
    expect(s.abschnitte[1].id).not.toBe('a0');
    expect(s.abschnitte[1].spalten[0].bausteine[0].id).not.toBe('u');
  });

  it('die Sperre wird VOR dem ersten Handgriff genommen – und vor dem Schreiben noch einmal geprüft', async () => {
    const reihenfolge: string[] = [];
    d.beginneBearbeiten.mockImplementation(async () => {
      reihenfolge.push('sperre');
      return { art: 'ok', seite: server.seite, menue: server.menue };
    });
    d.speichereSeite.mockImplementation(async (_o, s) => {
      reihenfolge.push('speichern');
      server.seite = s;
    });
    render(<Seitenarbeit {...props()} />);
    await aus({ was: 'runter', i: 0 });
    await screen.findByText('Gespeichert');
    expect(reihenfolge).toEqual(['sperre', 'sperre', 'speichern']);
  });

  it('am Rand passiert nichts Schlimmes: „nach oben“ beim ersten Abschnitt speichert dieselbe Reihenfolge', async () => {
    render(<Seitenarbeit {...props()} />);
    await aus({ was: 'hoch', i: 0 });
    await waitFor(() => expect(d.beginneBearbeiten).toHaveBeenCalled());
    await screen.findByText('Gespeichert');
    expect(speicherte().every((s) => s.abschnitte.map((a) => a.id).join() === 'a0,a1')).toBe(true);
  });
});

describe('Löschen: immer erst nach Rückfrage', () => {
  it('die Nachricht „löschen“ öffnet NUR das Bestätigungsfenster – gelöscht und gespeichert wird nichts', async () => {
    render(<Seitenarbeit {...props()} />);
    await aus({ was: 'loeschen', i: 0 });
    const dialog = await screen.findByRole('alertdialog');
    expect(within(dialog).getByText('Abschnitt löschen?')).toBeTruthy();
    expect(d.speichereSeite).not.toHaveBeenCalled();
    expect(doc()).toContain('Willkommen'); // der Abschnitt steht noch da
  });

  it('Abbrechen löscht nichts', async () => {
    render(<Seitenarbeit {...props()} />);
    await aus({ was: 'loeschen', i: 0 });
    fireEvent.click(
      within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Abbrechen' }),
    );
    expect(screen.queryByRole('alertdialog')).toBeNull();
    expect(d.speichereSeite).not.toHaveBeenCalled();
    expect(doc()).toContain('Willkommen');
  });

  it('erst „Löschen“ im Bestätigungsfenster entfernt den Abschnitt und speichert', async () => {
    render(<Seitenarbeit {...props()} />);
    await aus({ was: 'loeschen', i: 0 });
    fireEvent.click(
      within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Löschen' }),
    );
    await waitFor(() => expect(d.speichereSeite).toHaveBeenCalledTimes(1));
    expect(speicherte()[0].abschnitte.map((a) => a.id)).toEqual(['a1']);
    expect(doc()).not.toContain('Willkommen');
  });

  it('eine GEFÄLSCHTE Nachricht (anderes Fenster) löst nicht einmal das Bestätigungsfenster aus', async () => {
    render(<Seitenarbeit {...props()} />);
    await act(async () => {
      window.dispatchEvent(
        new MessageEvent('message', {
          data: { websiteEditor: true, was: 'loeschen', i: 0 },
          source: window,
        }),
      );
    });
    expect(screen.queryByRole('alertdialog')).toBeNull();
    expect(d.beginneBearbeiten).not.toHaveBeenCalled();
  });
});

describe('Abschnitt einfügen', () => {
  it('zeigt die Vorlagen als Kacheln; eine Wahl fügt den Abschnitt an der Stelle ein und speichert', async () => {
    render(<Seitenarbeit {...props()} />);
    await aus({ was: 'einfuegen', i: 1 });
    const fenster = await screen.findByRole('dialog');
    expect(within(fenster).getByText('Abschnitt einfügen')).toBeTruthy();
    for (const v of VORLAGEN) expect(within(fenster).getByText(v.titel)).toBeTruthy();
    fireEvent.click(within(fenster).getByText('Drei Spalten'));
    await waitFor(() => expect(d.speichereSeite).toHaveBeenCalledTimes(1));
    const s = speicherte()[0];
    expect(s.abschnitte).toHaveLength(3);
    expect(s.abschnitte[1].vorlage).toBe('drei-spalten');
    expect(s.abschnitte.map((a) => a.id)[0]).toBe('a0');
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('„Eigenes HTML“ gibt es nur mit dem Recht dafür', async () => {
    render(<Seitenarbeit {...props({ rechte: { html: false } })} />);
    await aus({ was: 'einfuegen', i: 0 });
    const fenster = await screen.findByRole('dialog');
    expect(within(fenster).queryByText('Eigenes HTML')).toBeNull();
    expect(within(fenster).getByText(/nur für die Leitung/)).toBeTruthy();
  });

  it('in einer leeren Seite: Stelle 0', async () => {
    const leer = seite({ id: 'l', titel: 'Leer', pfad: 'leer', startseite: false });
    server.seite = leer;
    render(<Seitenarbeit {...props({ seite: leer, stand: stand({ seiten: [START, leer] }) })} />);
    await aus({ was: 'einfuegen', i: 0 }, 'Leer');
    fireEvent.click(within(await screen.findByRole('dialog')).getByText('Text'));
    await waitFor(() => expect(d.speichereSeite).toHaveBeenCalledTimes(1));
    expect(speicherte()[0].abschnitte).toHaveLength(1);
  });
});

describe('Abschnitt gestalten', () => {
  const oeffnen = async () => {
    await aus({ was: 'gestalten', i: 1 });
    return screen.findByRole('dialog');
  };
  const gruppe = (fenster: HTMLElement, name: string) =>
    within(within(fenster).getAllByRole('group', { name })[0]);

  it('Änderungen wirken sofort in der Vorschau – gespeichert wird erst mit „Fertig“', async () => {
    render(<Seitenarbeit {...props()} />);
    const f = await oeffnen();
    const vorher = doc();
    fireEvent.click(gruppe(f, 'Abstand oben und unten').getByRole('button', { name: 'Groß' }));
    expect(doc()).not.toBe(vorher);
    expect(doc()).toContain('w-abschnitt--abstand-gross');
    expect(d.speichereSeite).not.toHaveBeenCalled();
    fireEvent.click(within(f).getByRole('button', { name: 'Fertig' }));
    await waitFor(() => expect(d.speichereSeite).toHaveBeenCalledTimes(1));
    expect(speicherte()[0].abschnitte[1].gestaltung.abstand).toBe('gross');
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });

  it('„Abbrechen“ stellt den Stand vor dem Öffnen wieder her – in der Vorschau und im Modell, nichts wird gespeichert', async () => {
    render(<Seitenarbeit {...props()} />);
    const f = await oeffnen();
    const vorher = doc();
    fireEvent.click(gruppe(f, 'Abstand oben und unten').getByRole('button', { name: 'Groß' }));
    fireEvent.click(within(f).getByRole('button', { name: 'Hauptfarbe' }));
    fireEvent.click(gruppe(f, 'Breite').getByRole('button', { name: 'Ganze Breite' }));
    expect(doc()).not.toBe(vorher);
    fireEvent.click(within(f).getByRole('button', { name: 'Abbrechen' }));
    expect(doc()).toBe(vorher);
    expect(d.speichereSeite).not.toHaveBeenCalled();
    // … und auch ein späteres Speichern trägt den alten Stand: nach „Abbrechen“ eine Leistenaktion
    await aus({ was: 'kopieren', i: 1 });
    await waitFor(() => expect(d.speichereSeite).toHaveBeenCalledTimes(1));
    expect(speicherte()[0].abschnitte[1].gestaltung).toEqual(START.abschnitte[1].gestaltung);
  });

  it('das X und Escape wirken wie „Abbrechen“ (Escape = Klick daneben tut nichts: Änderungen gehen nicht aus Versehen verloren)', async () => {
    render(<Seitenarbeit {...props()} />);
    const f = await oeffnen();
    const vorher = doc();
    fireEvent.click(gruppe(f, 'Abstand oben und unten').getByRole('button', { name: 'Groß' }));
    fireEvent.click(within(f).getByRole('button', { name: 'Fenster schließen' }));
    expect(doc()).toBe(vorher);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('WENIGER Spalten: die Inhalte rutschen in die letzte, nichts geht verloren – auch im gespeicherten Stand', async () => {
    render(<Seitenarbeit {...props()} />);
    const f = await oeffnen();
    fireEvent.click(within(f).getByRole('button', { name: 'Eine' }));
    expect(doc()).toContain('zweiter Block'); // der Text der ersten Spalte ist noch in der Vorschau
    fireEvent.click(within(f).getByRole('button', { name: 'Fertig' }));
    await waitFor(() => expect(d.speichereSeite).toHaveBeenCalledTimes(1));
    const a = speicherte()[0].abschnitte[1];
    expect(a.aufteilung).toBe('1');
    expect(a.spalten).toHaveLength(1);
    expect(a.spalten[0].bausteine.map((b) => b.id)).toEqual(['t2', 't3']);
  });

  it('Sprungmarke: ungültige oder doppelte Eingabe zeigt die Meldung im Fenster und sperrt „Fertig“ – das Modell bleibt unberührt', async () => {
    render(<Seitenarbeit {...props()} />);
    const f = await oeffnen();
    const feld = within(f).getByLabelText('Sprungmarke (optional)');
    fireEvent.change(feld, { target: { value: 'Groß geschrieben' } });
    expect(within(f).getByText(/Nur Kleinbuchstaben/)).toBeTruthy();
    expect(within(f).getByRole('button', { name: 'Fertig' })).toHaveProperty('disabled', true);
    fireEvent.change(feld, { target: { value: 'inhalt' } });
    expect(within(f).getByText(/von der Seite selbst belegt/)).toBeTruthy();
    fireEvent.change(feld, { target: { value: 'gottesdienst' } });
    expect(within(f).getByRole('button', { name: 'Fertig' })).toHaveProperty('disabled', false);
    fireEvent.click(within(f).getByRole('button', { name: 'Fertig' }));
    await waitFor(() => expect(d.speichereSeite).toHaveBeenCalledTimes(1));
    expect(speicherte()[0].abschnitte[1].gestaltung.anker).toBe('gottesdienst');
  });

  it('eine Sprungmarke, die ein anderer Abschnitt schon hat, wird abgewiesen', async () => {
    const mitAnker = {
      ...START,
      abschnitte: [
        {
          ...START.abschnitte[0],
          gestaltung: { ...START.abschnitte[0].gestaltung, anker: 'oben' },
        },
        START.abschnitte[1],
      ],
    };
    server.seite = mitAnker;
    render(
      <Seitenarbeit
        {...props({ seite: mitAnker, stand: stand({ seiten: [mitAnker, IMPRESSUM] }) })}
      />,
    );
    const f = await oeffnen();
    fireEvent.change(within(f).getByLabelText('Sprungmarke (optional)'), {
      target: { value: 'oben' },
    });
    expect(within(f).getByText(/schon ein anderer Abschnitt/)).toBeTruthy();
  });

  it('Foto-Hintergrund: der Platzhalter ist klar beschriftet, „Abdunkeln“ wirkt', async () => {
    render(<Seitenarbeit {...props()} />);
    const f = await oeffnen();
    fireEvent.click(within(f).getByRole('button', { name: 'Foto' }));
    expect(within(f).getByText(/Platzhalter-Bild/)).toBeTruthy();
    fireEvent.change(within(f).getByLabelText(/Abdunkeln/), { target: { value: '70' } });
    fireEvent.click(within(f).getByRole('button', { name: 'Fertig' }));
    await waitFor(() => expect(d.speichereSeite).toHaveBeenCalledTimes(1));
    expect(speicherte()[0].abschnitte[1].gestaltung.hintergrund).toMatchObject({
      art: 'bild',
      abdunkeln: 70,
    });
  });
});

describe('Prüfung vor dem Speichern: Ungültiges wird nie gespeichert', () => {
  it('ein Baustein mit ungültigem Inhalt: „Fertig“ zeigt die Meldung IM Fenster, das Fenster bleibt, gespeichert wird nichts', async () => {
    render(<Seitenarbeit {...props()} />);
    await aus({ was: 'baustein', i: 0, j: 0, k: 0 });
    const f = await screen.findByRole('dialog');
    fireEvent.change(within(f).getByLabelText('Text'), { target: { value: '' } });
    fireEvent.click(within(f).getByRole('button', { name: 'Fertig' }));
    const meldung = await within(f).findByRole('alert');
    expect(meldung.textContent).toMatch(/Abschnitt 1 › Spalte 1 › Baustein 1 › Text/);
    expect(screen.getByRole('dialog')).toBeTruthy();
    expect(d.speichereSeite).not.toHaveBeenCalled();
    // Wieder gültig machen: jetzt geht es
    fireEvent.change(within(f).getByLabelText('Text'), { target: { value: 'Neu' } });
    fireEvent.click(within(f).getByRole('button', { name: 'Fertig' }));
    await waitFor(() => expect(d.speichereSeite).toHaveBeenCalledTimes(1));
  });

  it('ein Knopf mit unerlaubter Adresse (javascript:) wird abgewiesen, nichts gespeichert', async () => {
    const mitKnopf = seite({
      ...START,
      abschnitte: [abschnitt([baustein('knoepfe', { id: 'k' })], { id: 'a0' })],
    });
    server.seite = mitKnopf;
    render(
      <Seitenarbeit
        {...props({ seite: mitKnopf, stand: stand({ seiten: [mitKnopf, IMPRESSUM] }) })}
      />,
    );
    await aus({ was: 'baustein', i: 0, j: 0, k: 0 });
    const f = await screen.findByRole('dialog');
    fireEvent.change(within(f).getByLabelText('Ziel von Knopf 1'), { target: { value: 'extern' } });
    fireEvent.change(within(f).getByLabelText('Adresse von Knopf 1'), {
      target: { value: 'javascript:alert(1)' },
    });
    expect(within(f).getByText(/Erlaubt sind nur Adressen/)).toBeTruthy();
    fireEvent.click(within(f).getByRole('button', { name: 'Fertig' }));
    await within(f).findAllByRole('alert');
    expect(d.speichereSeite).not.toHaveBeenCalled();
  });

  it('eine Kopie, die die Grenze der Seite sprengen würde (50 Abschnitte), wird abgelehnt mit Hinweis – die Seite bleibt, wie sie war', async () => {
    const voll = seite({
      ...START,
      abschnitte: Array.from({ length: 50 }, (_, n) =>
        abschnitt([baustein('trenner', { id: `t${n}` })], { id: `a${n}` }),
      ),
    });
    server.seite = voll;
    render(
      <Seitenarbeit {...props({ seite: voll, stand: stand({ seiten: [voll, IMPRESSUM] }) })} />,
    );
    await aus({ was: 'kopieren', i: 0 });
    expect(await screen.findByText(/Das geht so nicht/)).toBeTruthy();
    expect(d.speichereSeite).not.toHaveBeenCalled();
  });
});

describe('Baustein bearbeiten, hinzufügen, entfernen', () => {
  it('ein Klick auf den Baustein öffnet ihn mit seinem Namen; Änderungen sind sofort sichtbar, „Fertig“ speichert', async () => {
    render(<Seitenarbeit {...props()} />);
    await aus({ was: 'baustein', i: 0, j: 0, k: 0 });
    const f = await screen.findByRole('dialog');
    expect(within(f).getByText('Überschrift', { selector: 'div' })).toBeTruthy();
    fireEvent.change(within(f).getByLabelText('Text'), { target: { value: 'Hallo Welt' } });
    expect(doc()).toContain('Hallo Welt');
    fireEvent.click(within(f).getByRole('button', { name: 'Fertig' }));
    await waitFor(() => expect(d.speichereSeite).toHaveBeenCalledTimes(1));
    expect(speicherte()[0].abschnitte[0].spalten[0].bausteine[0]).toMatchObject({
      text: 'Hallo Welt',
    });
  });

  it('„Abbrechen“ stellt den Baustein wieder her', async () => {
    render(<Seitenarbeit {...props()} />);
    await aus({ was: 'baustein', i: 0, j: 0, k: 0 });
    const f = await screen.findByRole('dialog');
    const vorher = doc();
    fireEvent.change(within(f).getByLabelText('Text'), { target: { value: 'Geändert' } });
    fireEvent.click(within(f).getByRole('button', { name: 'Abbrechen' }));
    expect(doc()).toBe(vorher);
    expect(d.speichereSeite).not.toHaveBeenCalled();
  });

  it('„Entfernen“ fragt nach; Abbrechen behält den Baustein, „Entfernen“ löscht ihn – und zwar wie er VOR dem Bearbeiten war', async () => {
    render(<Seitenarbeit {...props()} />);
    await aus({ was: 'baustein', i: 0, j: 0, k: 1 });
    const f = await screen.findByRole('dialog');
    fireEvent.click(within(f).getByRole('button', { name: 'Entfernen' }));
    const frage = await screen.findByRole('alertdialog');
    expect(within(frage).getByText('Baustein entfernen?')).toBeTruthy();
    expect(d.speichereSeite).not.toHaveBeenCalled();
    fireEvent.click(within(frage).getByRole('button', { name: 'Abbrechen' }));
    expect(screen.getByRole('dialog')).toBeTruthy(); // zurück im Baustein-Fenster
    fireEvent.click(screen.getByRole('button', { name: 'Entfernen' }));
    fireEvent.click(
      within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Entfernen' }),
    );
    await waitFor(() => expect(d.speichereSeite).toHaveBeenCalledTimes(1));
    expect(speicherte()[0].abschnitte[0].spalten[0].bausteine.map((b) => b.id)).toEqual(['u']);
  });

  it('„+ Baustein“: die Typen zur Auswahl, der neue ist ein Platzhalter, wird gespeichert und gleich zum Bearbeiten geöffnet', async () => {
    render(<Seitenarbeit {...props()} />);
    await aus({ was: 'baustein-neu', i: 1, j: 1 });
    const f = await screen.findByRole('dialog');
    expect(within(f).getByText('Baustein hinzufügen')).toBeTruthy();
    fireEvent.click(within(f).getByRole('button', { name: 'Trenner' }));
    await waitFor(() => expect(d.speichereSeite).toHaveBeenCalledTimes(1));
    const bs = speicherte()[0].abschnitte[1].spalten[1].bausteine;
    expect(bs).toHaveLength(2);
    expect(bs[1]).toMatchObject({ typ: 'trenner', art: 'linie' });
    // gleich zum Bearbeiten offen
    expect(await screen.findByRole('button', { name: 'Fertig' })).toBeTruthy();
    expect(screen.getByRole('group', { name: 'Art' })).toBeTruthy();
  });

  it('„Eigenes HTML“ ohne Recht: weder hinzufügen noch ändern – nur der Hinweis, kein „Fertig“', async () => {
    const mitHtml = seite({
      ...START,
      abschnitte: [abschnitt([baustein('html', { id: 'h' })], { id: 'a0' })],
    });
    server.seite = mitHtml;
    render(
      <Seitenarbeit
        {...props({
          seite: mitHtml,
          stand: stand({ seiten: [mitHtml, IMPRESSUM] }),
          rechte: { html: false },
        })}
      />,
    );
    await aus({ was: 'baustein', i: 0, j: 0, k: 0 });
    const f = await screen.findByRole('dialog');
    expect(within(f).getByText(/nur die Leitung/)).toBeTruthy();
    expect(within(f).queryByRole('button', { name: 'Fertig' })).toBeNull();
    expect(within(f).queryByRole('textbox')).toBeNull();
    fireEvent.click(within(f).getByRole('button', { name: 'Fenster schließen' }));
    await aus({ was: 'baustein-neu', i: 0, j: 0 });
    expect(
      within(await screen.findByRole('dialog')).queryByRole('button', { name: 'Eigenes HTML' }),
    ).toBeNull();
  });
});

describe('Seite einstellen', () => {
  const oeffnen = async () => {
    fireEvent.click(screen.getByRole('button', { name: 'Seite einstellen' }));
    return screen.findByRole('dialog');
  };

  it('Titel, Beschreibung und Menü: „Fertig“ speichert Seite und Menü (erst die Seite, dann das Menü)', async () => {
    const reihenfolge: string[] = [];
    d.speichereSeite.mockImplementation(async (_o, s) => {
      reihenfolge.push('seite');
      server.seite = s;
    });
    d.speichereMenue.mockImplementation(async (_o, m) => {
      reihenfolge.push('menue');
      server.menue = m;
    });
    render(<Seitenarbeit {...props()} />);
    const f = await oeffnen();
    fireEvent.change(within(f).getByLabelText('Titel'), { target: { value: 'Willkommen!' } });
    fireEvent.change(within(f).getByLabelText(/Beschreibung/), {
      target: { value: 'Für Suchmaschinen' },
    });
    fireEvent.click(within(f).getByRole('checkbox', { name: 'Im Menü zeigen' }));
    fireEvent.click(within(f).getByRole('button', { name: 'Fertig' }));
    await waitFor(() => expect(reihenfolge).toEqual(['seite', 'menue']));
    expect(speicherte()[0]).toMatchObject({
      titel: 'Willkommen!',
      beschreibung: 'Für Suchmaschinen',
    });
    expect(d.speichereMenue.mock.calls[0][1].eintraege.map((e) => e.titel)).toEqual([
      'Impressum',
      'Willkommen!',
    ]);
  });

  it('Reihenfolge im Menü: hoch/runter – gespeichert wird das Menü, die Seite bleibt unberührt (nicht neu geschrieben)', async () => {
    const zwei = menue([
      { titel: 'A', ziel: { art: 'seite', seiteId: 'i' } },
      { titel: 'B', ziel: { art: 'seite', seiteId: 's' } },
    ]);
    server.menue = zwei;
    render(<Seitenarbeit {...props({ stand: stand({ menue: zwei }) })} />);
    const f = await oeffnen();
    fireEvent.click(within(f).getByRole('button', { name: '„B“ nach oben' }));
    fireEvent.click(within(f).getByRole('button', { name: 'Fertig' }));
    await waitFor(() => expect(d.speichereMenue).toHaveBeenCalledTimes(1));
    expect(d.speichereMenue.mock.calls[0][1].eintraege.map((e) => e.titel)).toEqual(['B', 'A']);
    expect(d.speichereSeite).not.toHaveBeenCalled();
  });

  it('eine Adresse, die eine andere Seite schon hat, wird abgewiesen; die Startseite hat immer „/“', async () => {
    server.seite = IMPRESSUM;
    render(<Seitenarbeit {...props({ seite: IMPRESSUM, stand: stand() })} />);
    const f = await oeffnen();
    fireEvent.change(within(f).getByLabelText('Adresse'), { target: { value: 'start' } });
    expect(within(f).getByText('Diese Adresse hat schon eine andere Seite.')).toBeTruthy();
    cleanup();
    // Zweiter Teil: Startseite
    const startseite = { ...START, startseite: true };
    server.seite = startseite;
    render(
      <Seitenarbeit
        {...props({ seite: startseite, stand: stand({ seiten: [startseite, IMPRESSUM] }) })}
      />,
    );
    const g = await oeffnen();
    expect(within(g).getByLabelText('Adresse')).toHaveProperty('disabled', true);
    expect(within(g).getByLabelText('Adresse')).toHaveProperty('value', '/');
  });

  it('eine vergebene Adresse: Meldung und gesperrtes „Fertig“', async () => {
    const zweite = seite({ id: 'z', titel: 'Zweite', pfad: 'zweite', startseite: false });
    server.seite = zweite;
    render(
      <Seitenarbeit
        {...props({ seite: zweite, stand: stand({ seiten: [START, zweite, IMPRESSUM] }) })}
      />,
    );
    const f = await oeffnen();
    fireEvent.change(within(f).getByLabelText('Adresse'), { target: { value: 'impressum' } });
    expect(within(f).getByText('Diese Adresse hat schon eine andere Seite.')).toBeTruthy();
    expect(within(f).getByRole('button', { name: 'Fertig' })).toHaveProperty('disabled', true);
  });

  it('„Seite löschen“ im Fenster übergibt an die Seitenliste (das Bestätigungsfenster gehört ihr)', async () => {
    const onLoeschen = vi.fn();
    render(<Seitenarbeit {...props({ onLoeschen })} />);
    const f = await oeffnen();
    fireEvent.click(within(f).getByRole('button', { name: 'Seite löschen' }));
    expect(onLoeschen).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(d.speichereSeite).not.toHaveBeenCalled();
  });

  it('„Abbrechen“ verwirft alles – nichts wird gespeichert', async () => {
    render(<Seitenarbeit {...props()} />);
    const f = await oeffnen();
    fireEvent.change(within(f).getByLabelText('Titel'), { target: { value: 'Anders' } });
    fireEvent.click(within(f).getByRole('button', { name: 'Abbrechen' }));
    expect(d.speichereSeite).not.toHaveBeenCalled();
    expect(screen.getByText('Start')).toBeTruthy();
  });
});

/** Ein Versprechen, das der Test von Hand erfüllt. */
function offen<T>() {
  let ja!: (v: T) => void;
  let nein!: (e: unknown) => void;
  const p = new Promise<T>((a, b) => {
    ja = a;
    nein = b;
  });
  return { p, ja, nein };
}

describe('Speichern eins nach dem anderen', () => {
  it('Änderungen während einer laufenden Speicherung: nie zwei gleichzeitig, danach der neueste Stand', async () => {
    let gleichzeitig = 0;
    let hoechstens = 0;
    const tore: ReturnType<typeof offen<void>>[] = [];
    d.speichereSeite.mockImplementation(async (_o, s) => {
      gleichzeitig++;
      hoechstens = Math.max(hoechstens, gleichzeitig);
      const tor = offen<void>();
      tore.push(tor);
      await tor.p;
      gleichzeitig--;
      server.seite = s;
    });
    render(<Seitenarbeit {...props()} />);
    await aus({ was: 'runter', i: 0 });
    await waitFor(() => expect(tore).toHaveLength(1));
    await aus({ was: 'kopieren', i: 0 }); // die zweite Änderung, während die erste noch läuft
    await aus({ was: 'kopieren', i: 0 });
    expect(d.speichereSeite).toHaveBeenCalledTimes(1);
    await act(async () => tore[0].ja());
    await waitFor(() => expect(tore).toHaveLength(2));
    await act(async () => tore[1].ja());
    await screen.findByText('Gespeichert');
    expect(hoechstens).toBe(1);
    expect(speicherte().at(-1)!.abschnitte).toHaveLength(4); // beide Kopien sind im letzten Stand
  });
});

describe('Ein vorübergehender Fehler zerstört nichts', () => {
  it('503 beim Speichern: „Nicht gespeichert“, die Änderung bleibt in der Vorschau – „Erneut versuchen“ speichert denselben Stand', async () => {
    d.speichereSeite.mockRejectedValueOnce(new ApiError(503, 'x'));
    render(<Seitenarbeit {...props()} />);
    await aus({ was: 'runter', i: 0 });
    const meldung = await screen.findByRole('alert');
    expect(meldung.textContent).toMatch(/Nicht gespeichert/);
    expect(meldung.textContent).toMatch(/antwortet gerade nicht/);
    expect(screen.getByText('Nicht gespeichert')).toBeTruthy(); // und oben in der Leiste
    // Der Stand im Browser steht noch: die neue Reihenfolge ist zu sehen
    expect(pos('zweiter Block')).toBeLessThan(pos('Willkommen'));
    fireEvent.click(screen.getByRole('button', { name: 'Erneut versuchen' }));
    await screen.findByText('Gespeichert');
    expect(d.speichereSeite).toHaveBeenCalledTimes(2);
    expect(speicherte()[1]).toEqual(speicherte()[0]);
    expect(speicherte()[1].abschnitte.map((a) => a.id)).toEqual(['a1', 'a0']);
  });

  it('nach einem Fehler bleibt man auf der Seite (onOffen bleibt wahr) – erst nach dem Speichern wieder frei', async () => {
    d.speichereSeite.mockRejectedValueOnce(new ApiError(504, 'x'));
    const onOffen = vi.fn();
    render(<Seitenarbeit {...props({ onOffen })} />);
    await aus({ was: 'runter', i: 0 });
    await screen.findByRole('button', { name: 'Erneut versuchen' });
    expect(onOffen.mock.calls.at(-1)).toEqual([true]);
    fireEvent.click(screen.getByRole('button', { name: 'Erneut versuchen' }));
    await screen.findByText('Gespeichert');
    expect(onOffen.mock.calls.at(-1)).toEqual([false]);
  });

  it('ein Fehler beim Nehmen der Sperre (ChurchTools antwortet nicht): nichts ändert sich, Hinweis mit der Meldung', async () => {
    d.beginneBearbeiten.mockRejectedValueOnce(new ApiError(503, 'x'));
    render(<Seitenarbeit {...props()} />);
    await aus({ was: 'runter', i: 0 });
    expect(await screen.findByText(/antwortet gerade nicht/)).toBeTruthy();
    expect(d.speichereSeite).not.toHaveBeenCalled();
    expect(pos('Willkommen')).toBeLessThan(pos('zweiter Block')); // alte Reihenfolge
    // Der nächste Versuch klappt
    await aus({ was: 'runter', i: 0 });
    await screen.findByText('Gespeichert');
  });

  it('ein halb gelungener Versuch (Seite geschrieben, dann Fehler) ist beim Wiederholen KEIN „inzwischen von jemand anderem geändert“', async () => {
    d.speichereSeite.mockImplementationOnce(async (_o, s) => {
      server.seite = s; // angekommen …
      throw new ApiError(502, 'x'); // … aber das Nachlesen scheiterte
    });
    render(<Seitenarbeit {...props()} />);
    await aus({ was: 'runter', i: 0 });
    await screen.findByRole('button', { name: 'Erneut versuchen' });
    fireEvent.click(screen.getByRole('button', { name: 'Erneut versuchen' }));
    await screen.findByText('Gespeichert');
    expect(screen.queryByText(/inzwischen von jemand anderem/)).toBeNull();
  });
});

describe('Gleichzeitiges Bearbeiten: die Sperre', () => {
  const fremdeSperre = (minuten = 1) => sperreVon(ANDERER, new Date(Date.now() - minuten * 60_000));

  it('beim Öffnen von jemand anderem gesperrt: Hinweis mit Namen, nur ansehen – keine Ebene, „Seite einstellen“ gesperrt, nichts reagiert', async () => {
    render(<Seitenarbeit {...props({ stand: stand({ sperren: { s: fremdeSperre() } }) })} />);
    expect(screen.getByText(/Gerade bearbeitet von Jonas Peters/)).toBeTruthy();
    expect(doc()).not.toMatch(/websiteEditor|b-werk/);
    expect(screen.getByRole('button', { name: 'Seite einstellen' })).toHaveProperty(
      'disabled',
      true,
    );
    await aus({ was: 'runter', i: 0 });
    expect(d.beginneBearbeiten).not.toHaveBeenCalled();
    expect(d.speichereSeite).not.toHaveBeenCalled();
  });

  it('eine verlassene Sperre (über zehn Minuten) zeigt keinen Hinweis', () => {
    render(<Seitenarbeit {...props({ stand: stand({ sperren: { s: fremdeSperre(11) } }) })} />);
    expect(screen.queryByText(/Gerade bearbeitet von/)).toBeNull();
    expect(doc()).toMatch(/websiteEditor/);
  });

  it('dieselbe Person in einem anderen Fenster: eigener Text', () => {
    const s = sperreVon({ ...ICH, fenster: 'anderes' }, new Date());
    render(<Seitenarbeit {...props({ stand: stand({ sperren: { s } }) })} />);
    expect(screen.getByText(/in einem anderen Fenster von dir/)).toBeTruthy();
  });

  it('die Sperre wird erst beim Handgriff geprüft: fremd gesperrt → Hinweis, es wird NICHT gespeichert', async () => {
    d.beginneBearbeiten.mockResolvedValue({ art: 'gesperrt', sperre: fremdeSperre() });
    render(<Seitenarbeit {...props()} />);
    await aus({ was: 'runter', i: 0 });
    expect(await screen.findByText(/Gerade bearbeitet von Jonas Peters/)).toBeTruthy();
    expect(d.speichereSeite).not.toHaveBeenCalled();
    expect(pos('Willkommen')).toBeLessThan(pos('zweiter Block'));
  });

  it('„Erneut prüfen“: ist die Sperre frei geworden, geht es weiter', async () => {
    d.beginneBearbeiten.mockResolvedValueOnce({ art: 'gesperrt', sperre: fremdeSperre() });
    render(<Seitenarbeit {...props()} />);
    await aus({ was: 'runter', i: 0 });
    fireEvent.click(await screen.findByRole('button', { name: 'Erneut prüfen' }));
    await waitFor(() => expect(screen.queryByText(/Gerade bearbeitet von/)).toBeNull());
    expect(doc()).toMatch(/websiteEditor/);
  });

  it('wird die Sperre WÄHREND des Bearbeitens übernommen, wird das Speichern abgewiesen: nichts geschrieben, Änderung bleibt sichtbar, „Neu laden“ bietet den gespeicherten Stand an', async () => {
    render(<Seitenarbeit {...props()} />);
    await aus({ was: 'runter', i: 0 });
    await screen.findByText('Gespeichert');
    d.speichereSeite.mockClear();
    // inzwischen hat jemand die Sperre übernommen
    d.beginneBearbeiten.mockResolvedValue({ art: 'gesperrt', sperre: fremdeSperre() });
    await aus({ was: 'kopieren', i: 0 });
    expect(await screen.findByText(/Gerade bearbeitet von Jonas Peters/)).toBeTruthy();
    expect(d.speichereSeite).not.toHaveBeenCalled();
  });

  it('vor JEDEM Speichern wird die Sperre geprüft: ist sie weg, schreibt das Speichern nichts', async () => {
    const tor = offen<unknown>();
    let nr = 0;
    d.beginneBearbeiten.mockImplementation(async () => {
      nr++;
      if (nr === 1) return { art: 'ok', seite: server.seite, menue: server.menue }; // Sperre nehmen
      await tor.p; // … und beim Speichern ist sie weg
      return { art: 'gesperrt', sperre: fremdeSperre() };
    });
    render(<Seitenarbeit {...props()} />);
    await aus({ was: 'runter', i: 0 });
    await waitFor(() => expect(nr).toBe(2));
    await act(async () => tor.ja(undefined));
    await screen.findByText(/Nicht gespeichert/);
    expect(d.speichereSeite).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Neu laden' })).toBeTruthy();
  });

  it('hat jemand die Seite inzwischen GEÄNDERT, wird nicht darüber geschrieben – Hinweis, „Neu laden“ übernimmt seinen Stand', async () => {
    const seinStand = { ...START, titel: 'Seine Fassung' };
    render(<Seitenarbeit {...props()} />);
    await aus({ was: 'runter', i: 0 });
    await screen.findByText('Gespeichert');
    d.speichereSeite.mockClear();
    server.seite = seinStand; // der andere hat gespeichert (unsere Sperre war verfallen)
    await aus({ was: 'kopieren', i: 0 });
    expect(await screen.findByText(/inzwischen von jemand anderem geändert/)).toBeTruthy();
    expect(d.speichereSeite).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Neu laden' }));
    await waitFor(() => expect(screen.getByTitle('Vorschau: Seine Fassung')).toBeTruthy());
    expect(screen.queryByText(/inzwischen von jemand anderem/)).toBeNull();
  });

  it('beim ersten Handgriff: die Seite war schon geändert → neu geladen, die Aktion wird NICHT auf dem alten Bild ausgeführt', async () => {
    server.seite = { ...START, titel: 'Seine Fassung' };
    render(<Seitenarbeit {...props()} />);
    await aus({ was: 'runter', i: 0 });
    expect(await screen.findByText(/ist neu geladen/)).toBeTruthy();
    expect(screen.getByTitle('Vorschau: Seine Fassung')).toBeTruthy();
    expect(d.speichereSeite).not.toHaveBeenCalled();
  });

  it('Lebenszeichen: solange die Seite offen ist, wird die Sperre erneuert; ein Aussetzer macht nichts kaputt', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    render(<Seitenarbeit {...props()} />);
    await aus({ was: 'runter', i: 0 });
    await vi.waitFor(() => expect(screen.getByText('Gespeichert')).toBeTruthy());
    const vorher = d.beginneBearbeiten.mock.calls.length;
    d.beginneBearbeiten.mockRejectedValueOnce(new ApiError(503, 'x'));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(LEBENSZEICHEN_MS);
    });
    expect(d.beginneBearbeiten.mock.calls.length).toBe(vorher + 1);
    expect(screen.queryByText(/Gerade bearbeitet von/)).toBeNull();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(LEBENSZEICHEN_MS);
    });
    expect(d.beginneBearbeiten.mock.calls.length).toBe(vorher + 2);
    // Und: Übernimmt jemand die Sperre, zeigt das nächste Lebenszeichen es
    d.beginneBearbeiten.mockResolvedValueOnce({ art: 'gesperrt', sperre: fremdeSperre() });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(LEBENSZEICHEN_MS);
    });
    expect(screen.getByText(/Gerade bearbeitet von Jonas Peters/)).toBeTruthy();
  });

  it('es gibt kein Lebenszeichen, solange nichts bearbeitet wurde (nichts gesperrt)', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    render(<Seitenarbeit {...props()} />);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(LEBENSZEICHEN_MS * 3);
    });
    expect(d.beginneBearbeiten).not.toHaveBeenCalled();
  });

  it('beim Verlassen wird die eigene Sperre freigegeben – und nur, wenn man sie hat', async () => {
    const a = render(<Seitenarbeit {...props()} />);
    a.unmount();
    expect(d.beendeBearbeiten).not.toHaveBeenCalled();
    const b = render(<Seitenarbeit {...props()} />);
    await aus({ was: 'runter', i: 0 });
    await screen.findByText('Gespeichert');
    b.unmount();
    expect(d.beendeBearbeiten).toHaveBeenCalledTimes(1);
    expect(d.beendeBearbeiten).toHaveBeenCalledWith(ORT, 's', ICH);
  });

  it('schlägt das Freigeben fehl, merkt man nichts davon (die Sperre verfällt von selbst)', async () => {
    d.beendeBearbeiten.mockRejectedValue(new ApiError(503, 'x'));
    const b = render(<Seitenarbeit {...props()} />);
    await aus({ was: 'runter', i: 0 });
    await screen.findByText('Gespeichert');
    expect(() => b.unmount()).not.toThrow();
  });
});

describe('Gespeichert wird an die Seitenliste gemeldet', () => {
  it('nach dem Speichern bekommt die Liste Seite und Menü – ohne neu zu lesen', async () => {
    const onGespeichert = vi.fn();
    render(<Seitenarbeit {...props({ onGespeichert })} />);
    await aus({ was: 'runter', i: 0 });
    await waitFor(() => expect(onGespeichert).toHaveBeenCalledTimes(1));
    expect(onGespeichert.mock.calls[0][0].abschnitte.map((a: { id: string }) => a.id)).toEqual([
      'a1',
      'a0',
    ]);
  });
});
