// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { ApiError } from '@ui/ct/fehler';
import { sperreVon } from '@shared/ct/sperre';
import type { Einstellungen } from '@shared/website/modell';
import type { WebsiteStand } from '@shared/website/speicher';
import { NEUTRALE_FARBEN } from '@shared/website/theme';
import { abschnitt, baustein, einstellungen, seite } from '@shared/website/website.testdaten';
import * as D from './daten';
import { Aussehen, CSS_VORSCHAU_MS } from './Aussehen';
import { EinstellungenProvider } from './EinstellungenQuelle';
import { SPEICHER_VERZOEGERUNG_MS } from './einstellungenKontext';

vi.mock('./daten', () => ({
  ladeWebsite: vi.fn(),
  speichereEinstellungen: vi.fn(),
  beginneEinstellungen: vi.fn(),
  uebernimmEinstellungen: vi.fn(),
  beendeEinstellungen: vi.fn(),
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
    abschnitt([baustein('ueberschrift', { id: 'u', text: 'Willkommen' })], { id: 'a0' }),
  ],
});
const IMPRESSUM = seite({ id: 'i', titel: 'Impressum', pfad: 'impressum', startseite: false });

const stand = (o: Partial<WebsiteStand> = {}): WebsiteStand => ({
  seiten: [START, IMPRESSUM],
  menue: null,
  einstellungen: null,
  probleme: [],
  verwaist: 0,
  sperren: {},
  einstellungenSperre: null,
  ...o,
});

/** Was „der Server“ gerade hat – die Mocks lesen und schreiben darin. */
let server: { einstellungen: Einstellungen | null };
/** Die Reihenfolge der Zugriffe, wie der Speicher sie sieht. */
let log: string[];

const zeige = async (s: WebsiteStand = stand()) => {
  server = { einstellungen: s.einstellungen };
  d.ladeWebsite.mockResolvedValue(s);
  render(
    <EinstellungenProvider ort={ORT} gemeinde="ECG" ich={ICH}>
      <Aussehen />
    </EinstellungenProvider>,
  );
  await act(async () => {});
};

const srcdoc = (titel = 'Start') =>
  screen.getByTitle<HTMLIFrameElement>(`Vorschau: ${titel}`).getAttribute('srcdoc') ?? '';
const hexFeld = (name: RegExp) => screen.getByRole<HTMLInputElement>('textbox', { name });
const HAUPT = /^Hauptfarbe(?! dunkel)/;
const TEXT_FARBE = /^Text(?!sch)/;
const waehler = (name: string) =>
  screen.getByLabelText<HTMLInputElement>(name, { selector: 'input[type=color]' });
const auswahl = (name: string) =>
  screen.getByLabelText<HTMLSelectElement>(name, { selector: 'select' });
const cssFeld = () =>
  screen.getByLabelText<HTMLTextAreaElement>('Eigenes CSS', { selector: 'textarea' });
const gespeichert = () => d.speichereEinstellungen.mock.calls.map((c) => c[1]);

/** Etwas tippen/wählen und die Zeit weiterlaufen lassen (die Sperre wird erst nach `await` genommen). */
const tippe = async (feld: HTMLElement, wert: string) => {
  await act(async () => {
    fireEvent.change(feld, { target: { value: wert } });
  });
};
const warte = (ms: number) =>
  act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });

beforeEach(() => {
  vi.useFakeTimers();
  log = [];
  server = { einstellungen: null };
  d.beginneEinstellungen.mockImplementation(async () => {
    log.push('beginne');
    return { art: 'ok', einstellungen: server.einstellungen };
  });
  d.uebernimmEinstellungen.mockImplementation(async () => ({
    art: 'ok',
    einstellungen: server.einstellungen,
  }));
  d.beendeEinstellungen.mockImplementation(async () => {
    log.push('beende');
  });
  d.speichereEinstellungen.mockImplementation(async (_o, e) => {
    log.push('speichere');
    server.einstellungen = e;
  });
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.clearAllMocks();
});

describe('Farben', () => {
  it('ohne gespeicherte Einstellungen gelten die neutralen Farben, in der Vorschau und in den Feldern', async () => {
    await zeige();
    expect(hexFeld(HAUPT).value).toBe(''); // nicht gesetzt, nur die Vorgabe
    expect(waehler('Hauptfarbe').value).toBe(NEUTRALE_FARBEN.haupt);
    expect(srcdoc()).toContain(`--farbe-haupt:${NEUTRALE_FARBEN.haupt}`);
    expect(d.speichereEinstellungen).not.toHaveBeenCalled();
  });

  it('eine neue Hex-Farbe: die Vorschau zeichnet SOFORT, gespeichert wird nach der Verzögerung – alle Pflichtfarben zusammen', async () => {
    await zeige();
    await tippe(hexFeld(HAUPT), '#112233');
    expect(srcdoc()).toContain('--farbe-haupt:#112233');
    expect(d.speichereEinstellungen).not.toHaveBeenCalled();
    await warte(SPEICHER_VERZOEGERUNG_MS);
    expect(gespeichert()).toHaveLength(1);
    expect(gespeichert()[0].farben).toEqual({ ...NEUTRALE_FARBEN, haupt: '#112233' });
    expect(screen.getByText('Gespeichert')).toBeTruthy();
  });

  it('der Farbwähler speichert genauso', async () => {
    await zeige();
    await tippe(waehler('Akzent'), '#ff0000');
    await warte(SPEICHER_VERZOEGERUNG_MS);
    expect(gespeichert()[0].farben?.akzent).toBe('#ff0000');
    expect(hexFeld(/^Akzent/).value).toBe('#ff0000');
  });

  it('viele Änderungen kurz nacheinander (Ziehen im Farbwähler): EIN Speichern mit dem letzten Stand', async () => {
    await zeige();
    for (const f of ['#111111', '#222222', '#333333']) {
      await tippe(waehler('Akzent'), f);
      await warte(100);
    }
    expect(d.speichereEinstellungen).not.toHaveBeenCalled();
    await warte(SPEICHER_VERZOEGERUNG_MS);
    expect(gespeichert()).toHaveLength(1);
    expect(gespeichert()[0].farben?.akzent).toBe('#333333');
  });

  it('ein UNGÜLTIGER Hex-Wert wird nicht übernommen: nichts gespeichert, Vorschau unverändert, das Feld springt zurück', async () => {
    await zeige();
    const feld = hexFeld(HAUPT);
    for (const roh of ['xyz', '#12', '#12345', 'rot']) {
      await tippe(feld, roh);
      fireEvent.blur(feld);
      expect(feld.value, roh).toBe('');
    }
    await warte(SPEICHER_VERZOEGERUNG_MS * 2);
    expect(d.speichereEinstellungen).not.toHaveBeenCalled();
    expect(srcdoc()).toContain(`--farbe-haupt:${NEUTRALE_FARBEN.haupt}`);
  });

  it('die dunkle Hauptfarbe: leeres Feld = ableiten (Wert wird zurückgenommen)', async () => {
    await zeige(
      stand({
        einstellungen: einstellungen({ farben: { ...NEUTRALE_FARBEN, hauptTief: '#001122' } }),
      }),
    );
    expect(srcdoc()).toContain('--farbe-haupt-tief:#001122');
    await tippe(hexFeld(/^Hauptfarbe dunkel/), '');
    await warte(SPEICHER_VERZOEGERUNG_MS);
    expect(gespeichert()[0].farben?.hauptTief).toBeUndefined();
    expect(srcdoc()).toContain('color-mix(');
    expect(screen.getByText(/wird aus der Hauptfarbe abgeleitet/)).toBeTruthy();
  });

  it('ist die dunkle Hauptfarbe eigens gesetzt, steht der Ableitungs-Hinweis nicht mehr da', async () => {
    await zeige(
      stand({
        einstellungen: einstellungen({ farben: { ...NEUTRALE_FARBEN, hauptTief: '#001122' } }),
      }),
    );
    expect(screen.queryByText(/wird aus der Hauptfarbe abgeleitet/)).toBeNull();
    expect(hexFeld(/^Hauptfarbe dunkel/).value).toBe('#001122');
  });
});

describe('Platzhalter der Hex-Felder (Abnahme W3a-3a)', () => {
  it('ohne gespeicherte Farben zeigen die Felder die geltenden neutralen Werte – ohne dass etwas gespeichert wird', async () => {
    await zeige();
    expect(hexFeld(HAUPT).placeholder).toBe(NEUTRALE_FARBEN.haupt);
    expect(hexFeld(/^Akzent/).placeholder).toBe(NEUTRALE_FARBEN.akzent);
    expect(hexFeld(/^Hintergrund/).placeholder).toBe(NEUTRALE_FARBEN.grund);
    expect(hexFeld(/^Sanft/).placeholder).toBe(NEUTRALE_FARBEN.sanft);
    expect(hexFeld(TEXT_FARBE).placeholder).toBe(NEUTRALE_FARBEN.text);
    // Nur die Farbe als Platzhalter (im schmalen Feld würde mehr abgeschnitten); „abgeleitet“ steht in der Unterzeile.
    expect(hexFeld(/^Hauptfarbe dunkel/).placeholder).toMatch(/^#[0-9a-f]{6}$/);
    expect(screen.getByText(/wird aus der Hauptfarbe abgeleitet/)).toBeTruthy();
    for (const f of [HAUPT, /^Akzent/, TEXT_FARBE]) expect(hexFeld(f).value).toBe('');
    await warte(SPEICHER_VERZOEGERUNG_MS * 2);
    expect(d.speichereEinstellungen).not.toHaveBeenCalled();
    expect(d.beginneEinstellungen).not.toHaveBeenCalled();
  });
});

describe('Seitenwahl der Vorschau', () => {
  it('heißt die Startseite „Startseite“, steht es nicht doppelt da', async () => {
    await zeige(
      stand({ seiten: [seite({ id: 's', titel: 'Startseite', pfad: 'start' }), IMPRESSUM] }),
    );
    const optionen = [...auswahl('Seite in der Vorschau').options].map((o) => o.textContent);
    expect(optionen).toEqual(['Startseite', 'Impressum']);
  });

  it('heißt sie anders, bekommt sie den Zusatz', async () => {
    await zeige(
      stand({ seiten: [seite({ id: 's', titel: 'Willkommen', pfad: 'start' }), IMPRESSUM] }),
    );
    const optionen = [...auswahl('Seite in der Vorschau').options].map((o) => o.textContent);
    expect(optionen).toEqual(['Willkommen (Startseite)', 'Impressum']);
  });
});

describe('Kontrast-Hinweis (E-W18)', () => {
  it('zu heller Text auf dem Hintergrund: ein ruhiger Hinweis erscheint – und das Speichern geht trotzdem', async () => {
    await zeige();
    expect(screen.queryByRole('note')).toBeNull();
    await tippe(hexFeld(TEXT_FARBE), '#eeeeee');
    const hinweis = screen.getAllByRole('note');
    expect(hinweis.length).toBeGreaterThan(0);
    expect(hinweis[0].textContent).toMatch(/Text auf Hintergrund: Kontrast \d,\d : 1/);
    expect(hinweis[0].textContent).toMatch(/trotzdem speichern/);
    await warte(SPEICHER_VERZOEGERUNG_MS);
    expect(gespeichert()[0].farben?.text).toBe('#eeeeee');
  });

  it('der Hinweis verschwindet, sobald der Kontrast reicht', async () => {
    await zeige();
    await tippe(hexFeld(TEXT_FARBE), '#eeeeee');
    expect(screen.getAllByRole('note').length).toBeGreaterThan(0);
    await tippe(hexFeld(TEXT_FARBE), '#1a1a1a');
    expect(screen.queryByRole('note')).toBeNull();
  });

  it('jeder Hinweis steht genau einmal, gesammelt unter „Text“ – nicht zusätzlich an der Fläche', async () => {
    await zeige();
    await tippe(hexFeld(/^Sanft/), '#333333');
    const zeile = (name: RegExp) => hexFeld(name).parentElement as HTMLElement;
    expect(screen.getAllByRole('note')).toHaveLength(1);
    expect(within(zeile(TEXT_FARBE)).getAllByRole('note')).toHaveLength(1);
    expect(within(zeile(TEXT_FARBE)).getByRole('note').textContent).toMatch(/Text auf Sanft/);
    expect(within(zeile(/^Sanft/)).queryByRole('note')).toBeNull();
    expect(within(zeile(/^Hintergrund/)).queryByRole('note')).toBeNull();
  });

  it('zwei Probleme → zwei Hinweise, beide unter „Text“', async () => {
    await zeige();
    await tippe(hexFeld(TEXT_FARBE), '#dddddd');
    const zeile = (name: RegExp) => hexFeld(name).parentElement as HTMLElement;
    expect(screen.getAllByRole('note')).toHaveLength(2);
    expect(within(zeile(TEXT_FARBE)).getAllByRole('note')).toHaveLength(2);
  });
});

describe('Schriften', () => {
  it('die erste Wahl gilt für Text und Überschriften, wird gespeichert und die Vorschau lädt nur diese Schrift', async () => {
    await zeige();
    const feld = auswahl('Text');
    // gruppiert nach Art
    expect([...feld.querySelectorAll('optgroup')].map((g) => g.label)).toEqual([
      'Ohne Serifen',
      'Mit Serifen',
      'Auffällig',
      'Handschrift',
      'Eigene',
    ]);
    await tippe(feld, 'Lora');
    await warte(SPEICHER_VERZOEGERUNG_MS);
    expect(gespeichert()[0].schriften).toEqual({
      text: { art: 'auswahl', name: 'Lora' },
      ueberschrift: { art: 'auswahl', name: 'Lora' },
    });
    expect(srcdoc()).toContain("font-family:'Lora'");
  });

  it('die Handschrift-Zeile lässt sich getrennt wählen und wieder auf „wie die Überschriften“ stellen', async () => {
    await zeige();
    await tippe(auswahl('Text'), 'Inter');
    await tippe(auswahl('Handschrift-Zeile'), 'Caveat');
    await warte(SPEICHER_VERZOEGERUNG_MS);
    expect(gespeichert().at(-1)?.schriften?.akzent).toEqual({ art: 'auswahl', name: 'Caveat' });
    await tippe(auswahl('Handschrift-Zeile'), '');
    await warte(SPEICHER_VERZOEGERUNG_MS);
    expect(gespeichert().at(-1)?.schriften?.akzent).toBeUndefined();
  });

  it('„Eigene Schrift …“ zeigt nur den Hinweis zum Hochladen – nichts wird geändert oder gespeichert', async () => {
    await zeige();
    await tippe(auswahl('Text'), '__eigene');
    expect(screen.getByText(/mit dem Hochladen der Bilder hoch/)).toBeTruthy();
    await warte(SPEICHER_VERZOEGERUNG_MS * 2);
    expect(d.speichereEinstellungen).not.toHaveBeenCalled();
    expect(d.beginneEinstellungen).not.toHaveBeenCalled();
  });
});

describe('Eigenes CSS und Logo', () => {
  it('das Vorschau-CSS folgt verzögert, gespeichert wird nach der Speicher-Verzögerung', async () => {
    await zeige();
    await tippe(cssFeld(), '.w-fuss{color:red}');
    expect(srcdoc()).not.toContain('.w-fuss{color:red}');
    await warte(CSS_VORSCHAU_MS);
    expect(srcdoc()).toContain('.w-fuss{color:red}');
    expect(d.speichereEinstellungen).not.toHaveBeenCalled();
    await warte(SPEICHER_VERZOEGERUNG_MS);
    expect(gespeichert()[0].eigenesCss).toBe('.w-fuss{color:red}');
  });

  it('mehr als 20.000 Zeichen: Meldung, NICHTS wird geschrieben', async () => {
    await zeige();
    await tippe(cssFeld(), 'x'.repeat(20_001));
    expect(screen.getByRole('alert').textContent).toMatch(/Noch nicht gespeichert/);
    await warte(SPEICHER_VERZOEGERUNG_MS * 2);
    expect(d.speichereEinstellungen).not.toHaveBeenCalled();
    // wieder kürzer: die Meldung geht, es wird gespeichert
    await tippe(cssFeld(), '.a{}');
    expect(screen.queryByText(/Noch nicht gespeichert/)).toBeNull();
    await warte(SPEICHER_VERZOEGERUNG_MS);
    expect(gespeichert()).toHaveLength(1);
  });

  it('das Logo: das vorhandene wird genannt, „Ändern“ ist ein Hinweis auf das Hochladen der Bilder', async () => {
    await zeige(stand({ einstellungen: einstellungen({ logo: { id: 'logo-1' } }) }));
    const karte = screen.getByRole('region', { name: 'Logo' });
    expect(within(karte).getByText('Ein Logo ist hinterlegt.')).toBeTruthy();
    expect(within(karte).getByText(/Hochladen der Bilder/)).toBeTruthy();
    expect(within(karte).queryByRole('button')).toBeNull();
  });
});

describe('Vorschau', () => {
  it('zeigt die Startseite; eine andere Seite ist wählbar', async () => {
    await zeige();
    expect(srcdoc('Start')).toContain('Willkommen');
    const wahl = screen.getByLabelText('Seite in der Vorschau');
    await tippe(wahl, 'i');
    expect(screen.getByTitle('Vorschau: Impressum')).toBeTruthy();
  });

  it('ohne Seite: ein Hinweis statt einer leeren Vorschau', async () => {
    await zeige(stand({ seiten: [] }));
    expect(screen.getByText(/Noch keine Seite/)).toBeTruthy();
  });
});

describe('Sperre – derselbe Ablauf wie bei den Seiten', () => {
  const fremd = () => sperreVon(ANDERER, new Date());

  it('die Sperre wird VOR dem ersten Handgriff genommen, und vor dem Schreiben noch einmal geprüft', async () => {
    await zeige();
    await tippe(hexFeld(HAUPT), '#112233');
    expect(log).toEqual(['beginne']);
    await warte(SPEICHER_VERZOEGERUNG_MS);
    expect(log).toEqual(['beginne', 'beginne', 'speichere']);
  });

  it('fremd gesperrt: alle Felder aus, der Grund steht da – nichts wird geschrieben', async () => {
    await zeige(stand({ einstellungenSperre: fremd() }));
    expect(screen.getByText(/Das Aussehen bearbeitet gerade Jonas Peters/)).toBeTruthy();
    // die Felder liegen in einem abgeschalteten `fieldset` – `:disabled` gilt für alle darin
    for (const f of [hexFeld(HAUPT), auswahl('Text'), cssFeld(), waehler('Akzent')])
      expect(f.matches(':disabled')).toBe(true);
    expect(d.speichereEinstellungen).not.toHaveBeenCalled();
  });

  it('„Bearbeitung übernehmen“ (nach der Rückfrage) schaltet die Felder frei', async () => {
    await zeige(stand({ einstellungenSperre: fremd() }));
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Bearbeitung übernehmen' }));
    });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Übernehmen' }));
    });
    expect(d.uebernimmEinstellungen).toHaveBeenCalledTimes(1);
    expect(hexFeld(HAUPT).matches(':disabled')).toBe(false);
  });

  it('wird beim ersten Handgriff „gesperrt“ gemeldet (jemand war schneller): die Änderung wird NICHT übernommen', async () => {
    await zeige();
    d.beginneEinstellungen.mockResolvedValueOnce({ art: 'gesperrt', sperre: fremd() });
    await tippe(hexFeld(HAUPT), '#112233');
    expect(screen.getByText(/Das Aussehen bearbeitet gerade Jonas Peters/)).toBeTruthy();
    expect(srcdoc()).toContain(`--farbe-haupt:${NEUTRALE_FARBEN.haupt}`);
    await warte(SPEICHER_VERZOEGERUNG_MS);
    expect(d.speichereEinstellungen).not.toHaveBeenCalled();
  });

  it('hat jemand inzwischen etwas geändert: es wird nicht darüber geschrieben, der gespeicherte Stand wird geladen', async () => {
    await zeige();
    server.einstellungen = einstellungen({ name: 'Von jemand anderem' });
    await tippe(hexFeld(HAUPT), '#112233');
    expect(
      screen.getByText(/inzwischen von jemand anderem geändert und ist neu geladen/),
    ).toBeTruthy();
    expect(srcdoc()).toContain(`--farbe-haupt:${NEUTRALE_FARBEN.haupt}`);
    await warte(SPEICHER_VERZOEGERUNG_MS);
    expect(d.speichereEinstellungen).not.toHaveBeenCalled();
  });

  it('Änderung zwischen Sperre und Schreiben (Abweisung beim Speichern): „Nicht gespeichert“, Neu laden holt den Stand', async () => {
    await zeige();
    await tippe(hexFeld(HAUPT), '#112233');
    server.einstellungen = einstellungen({ name: 'Von jemand anderem' });
    await warte(SPEICHER_VERZOEGERUNG_MS);
    expect(d.speichereEinstellungen).not.toHaveBeenCalled();
    expect(screen.getByText('Nicht gespeichert')).toBeTruthy();
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Neu laden' }));
    });
    expect(hexFeld(HAUPT).value).toBe('');
  });

  it('dieselben Einstellungen in anderer Feldreihenfolge sind NICHT „von jemand anderem geändert“', async () => {
    const e = einstellungen({ farben: { ...NEUTRALE_FARBEN } });
    await zeige(stand({ einstellungen: e }));
    // der Server liefert dieselben Werte, nur die Schlüssel stehen anders (wie nach dem Lesen mit dem Schema)
    const umgekehrt = (x: unknown): unknown =>
      x && typeof x === 'object' && !Array.isArray(x)
        ? Object.fromEntries(
            Object.entries(x)
              .reverse()
              .map(([k, v]) => [k, umgekehrt(v)]),
          )
        : x;
    server.einstellungen = umgekehrt(e) as Einstellungen;
    expect(JSON.stringify(server.einstellungen)).not.toBe(JSON.stringify(e));
    await tippe(hexFeld(HAUPT), '#112233');
    await warte(SPEICHER_VERZOEGERUNG_MS);
    expect(gespeichert()).toHaveLength(1);
  });

  it('beim Verlassen mit noch wartender Änderung: erst gespeichert, DANN die Sperre freigegeben', async () => {
    await zeige();
    const { unmount } = { unmount: () => cleanup() };
    await tippe(hexFeld(HAUPT), '#112233');
    log.length = 0;
    unmount();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10);
    });
    expect(gespeichert()).toHaveLength(1);
    expect(log.at(-1)).toBe('beende');
    expect(log.indexOf('speichere')).toBeLessThan(log.indexOf('beende'));
  });

  it('beim Verlassen ohne offene Änderung: die Sperre wird sofort freigegeben', async () => {
    await zeige();
    await tippe(hexFeld(HAUPT), '#112233');
    await warte(SPEICHER_VERZOEGERUNG_MS);
    log.length = 0;
    cleanup();
    await act(async () => {});
    expect(log).toEqual(['beende']);
  });
});

describe('Speichern scheitert', () => {
  it('vorübergehend (503): „Nicht gespeichert“, die Änderung bleibt stehen, „Erneut versuchen“ klappt', async () => {
    await zeige();
    d.speichereEinstellungen.mockRejectedValueOnce(new ApiError(503, 'Dienst nicht erreichbar'));
    await tippe(hexFeld(HAUPT), '#112233');
    await warte(SPEICHER_VERZOEGERUNG_MS);
    expect(screen.getByText('Nicht gespeichert')).toBeTruthy();
    expect(srcdoc()).toContain('--farbe-haupt:#112233');
    expect(hexFeld(HAUPT).value).toBe('#112233');
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Erneut versuchen' }));
    });
    expect(gespeichert()).toHaveLength(2);
    expect(screen.getByText('Gespeichert')).toBeTruthy();
    expect(server.einstellungen?.farben?.haupt).toBe('#112233');
  });
});

describe('Nicht lesbare Einstellungen', () => {
  it('werden gemeldet und NICHT überschrieben: kein Formular, kein Speichern', async () => {
    await zeige(
      stand({
        probleme: [
          {
            wert: 5,
            einheit: 'einstellungen',
            id: 'einstellungen',
            text: 'Der Wert 5 ist beschädigt.',
          },
        ],
      }),
    );
    expect(
      screen.getByText('Die gespeicherten Einstellungen lassen sich nicht lesen'),
    ).toBeTruthy();
    expect(screen.getByText('Der Wert 5 ist beschädigt.')).toBeTruthy();
    expect(screen.queryByRole('region', { name: 'Farben' })).toBeNull();
    expect(d.beginneEinstellungen).not.toHaveBeenCalled();
  });

  it('ein Problem mit etwas anderem (einer Seite) sperrt das Aussehen nicht', async () => {
    await zeige(
      stand({
        probleme: [{ wert: 6, einheit: 'seite', id: 'x', text: 'Seite x ist beschädigt.' }],
      }),
    );
    expect(screen.getByRole('region', { name: 'Farben' })).toBeTruthy();
  });
});
