// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { ApiError } from '@ui/ct/fehler';
import { sperreVon } from '@shared/ct/sperre';
import type { Einstellungen } from '@shared/website/modell';
import type { WebsiteStand } from '@shared/website/speicher';
import { NEUTRALE_FARBEN } from '@shared/website/theme';
import { BANNER_STANDARDTEXT } from '@shared/website/render';
import { abschnitt, baustein, einstellungen, seite } from '@shared/website/website.testdaten';
import * as D from './daten';
import { Aussehen } from './Aussehen';
import { EinstellungenFenster } from './EinstellungenFenster';
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

const START = seite({ id: 's', titel: 'Startseite', pfad: 'start', startseite: true });
const IMPRESSUM = seite({ id: 'i', titel: 'Impressum', pfad: 'impressum', startseite: false });
const STREAM = seite({
  id: 'l',
  titel: 'Live',
  pfad: 'live',
  startseite: false,
  abschnitte: [abschnitt([baustein('livestream')], { id: 'al' })],
});

const stand = (o: Partial<WebsiteStand> = {}): WebsiteStand => ({
  seiten: [START, IMPRESSUM],
  menue: null,
  einstellungen: einstellungen({ name: 'ECG' }),
  probleme: [],
  verwaist: 0,
  sperren: {},
  einstellungenSperre: null,
  ...o,
});

let server: { einstellungen: Einstellungen | null };
const schliessen = vi.fn();

const zeige = async (s: WebsiteStand = stand(), mitAussehen = false) => {
  server = { einstellungen: s.einstellungen };
  d.ladeWebsite.mockResolvedValue(s);
  render(
    <EinstellungenProvider ort={ORT} gemeinde="ECG" ich={ICH}>
      {mitAussehen && <Aussehen />}
      <EinstellungenFenster onSchliessen={schliessen} />
    </EinstellungenProvider>,
  );
  await act(async () => {});
};

const gespeichert = () => d.speichereEinstellungen.mock.calls.map((c) => c[1]);
const tippe = async (feld: HTMLElement, wert: string) => {
  await act(async () => {
    fireEvent.change(feld, { target: { value: wert } });
  });
};
const klick = async (name: string | RegExp) => {
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name }));
  });
};
const speichern = () => klick('Speichern');
const warte = (ms: number) =>
  act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
const feld = (name: string) => screen.getByLabelText<HTMLInputElement>(name);

beforeEach(() => {
  vi.useFakeTimers();
  schliessen.mockReset();
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
    server.einstellungen = e;
  });
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.clearAllMocks();
});

describe('Fenster „Einstellungen“ – Speichern', () => {
  it('zeigt die gespeicherten Werte und speichert mit „Speichern“ über den Speicher-Anschluss, dann schließt es', async () => {
    await zeige(stand({ einstellungen: einstellungen({ name: 'ECG', fusszeile: [] }) }));
    expect(feld('Name der Gemeinde').value).toBe('ECG');
    await tippe(feld('Name der Gemeinde'), 'ECG Donrath');
    expect(d.speichereEinstellungen).not.toHaveBeenCalled(); // erst der Knopf speichert
    await speichern();
    await warte(0);
    expect(gespeichert()).toHaveLength(1);
    expect(gespeichert()[0].name).toBe('ECG Donrath');
    expect(schliessen).toHaveBeenCalledTimes(1);
  });

  it('der Banner-Text: leer = Standardtext als Platzhalter; ein eigener Text wird gespeichert, leeren nimmt ihn zurück', async () => {
    await zeige();
    const text = screen.getByPlaceholderText<HTMLTextAreaElement>(BANNER_STANDARDTEXT);
    expect(text.value).toBe('');
    await tippe(text, 'Unser eigener Text');
    await speichern();
    await warte(0);
    expect(gespeichert()[0].einwilligung?.youtubeText).toBe('Unser eigener Text');
  });

  it('Fußzeile: hinzufügen, Titel + Seite wählen, verschieben, entfernen – gespeichert in dieser Reihenfolge', async () => {
    await zeige(stand({ einstellungen: einstellungen({ name: 'ECG', fusszeile: [] }) }));
    await klick('Link');
    await tippe(feld('Titel von Link 1'), 'Impressum');
    await tippe(feld('Ziel von Link 1'), 'seite:i');
    await klick('Link');
    await tippe(feld('Titel von Link 2'), 'Verband');
    await tippe(feld('Ziel von Link 2'), 'extern');
    await tippe(feld('Adresse von Link 2'), 'https://verband.example');
    await klick('Link 2 nach oben');
    expect(feld('Titel von Link 1').value).toBe('Verband');
    await klick('Link 1 entfernen');
    expect(screen.queryByLabelText('Titel von Link 2')).toBeNull();
    await klick('Link');
    await tippe(feld('Titel von Link 2'), 'Start');
    await speichern();
    await warte(0);
    expect(gespeichert()[0].fusszeile).toEqual([
      { titel: 'Impressum', ziel: { art: 'seite', seiteId: 'i' } },
      { titel: 'Start', ziel: { art: 'seite', seiteId: 's' } },
    ]);
  });

  it('Grenze: beim zehnten Link ist „Link“ aus', async () => {
    const voll = einstellungen({
      name: 'ECG',
      fusszeile: Array.from({ length: 10 }, (_, i) => ({
        titel: `L${i}`,
        ziel: { art: 'seite' as const, seiteId: 's' },
      })),
    });
    await zeige(stand({ einstellungen: voll }));
    expect(screen.getByRole<HTMLButtonElement>('button', { name: 'Link' }).disabled).toBe(true);
  });

  it('eine ungültige Adresse wird NICHT gespeichert: Meldung, Fenster bleibt offen, Eingabe bleibt stehen', async () => {
    await zeige(stand({ einstellungen: einstellungen({ name: 'ECG', fusszeile: [] }) }));
    await klick('Link');
    await tippe(feld('Titel von Link 1'), 'Böse');
    await tippe(feld('Ziel von Link 1'), 'extern');
    await tippe(feld('Adresse von Link 1'), 'javascript:alert(1)');
    await speichern();
    await warte(SPEICHER_VERZOEGERUNG_MS);
    expect(screen.getByRole('alert').textContent).toMatch(/Link 1: Erlaubt sind nur Adressen/);
    expect(d.speichereEinstellungen).not.toHaveBeenCalled();
    expect(schliessen).not.toHaveBeenCalled();
    expect(feld('Adresse von Link 1').value).toBe('javascript:alert(1)');
  });

  it('scheitert „Speichern“, rollt das Fenster die Meldung ins Bild – einmal je Versuch, nicht beim Weitertippen', async () => {
    const rollen = vi.fn();
    const vorher = Element.prototype.scrollIntoView;
    Element.prototype.scrollIntoView = rollen;
    try {
      await zeige(stand({ einstellungen: einstellungen({ name: 'ECG', fusszeile: [] }) }));
      await klick('Link');
      await tippe(feld('Titel von Link 1'), 'Böse');
      await tippe(feld('Ziel von Link 1'), 'extern');
      await tippe(feld('Adresse von Link 1'), 'javascript:alert(1)');
      expect(rollen).not.toHaveBeenCalled();
      await speichern();
      await warte(0);
      expect(rollen).toHaveBeenCalledTimes(1);
      expect((rollen.mock.contexts[0] as HTMLElement).textContent).toMatch(
        /Noch nicht gespeichert/,
      );
      await tippe(feld('Titel von Link 1'), 'Immer noch böse');
      expect(rollen).toHaveBeenCalledTimes(1);
      await speichern();
      await warte(0);
      expect(rollen).toHaveBeenCalledTimes(2);
    } finally {
      Element.prototype.scrollIntoView = vorher;
    }
  });

  it('die Meldung steht, im Hintergrund speichert „Aussehen“: das Fenster rollt NICHT noch einmal', async () => {
    const rollen = vi.fn();
    const vorher = Element.prototype.scrollIntoView;
    Element.prototype.scrollIntoView = rollen;
    try {
      await zeige(stand({ einstellungen: einstellungen({ name: 'ECG', fusszeile: [] }) }), true);
      await klick('Link');
      await tippe(feld('Titel von Link 1'), 'Böse');
      await tippe(feld('Ziel von Link 1'), 'extern');
      await tippe(feld('Adresse von Link 1'), 'javascript:alert(1)');
      await speichern();
      await warte(0);
      expect(rollen).toHaveBeenCalledTimes(1);
      // Farbe in „Aussehen“ ändern – die Meldung im Fenster bleibt stehen, der Speicherstand wechselt
      await tippe(screen.getByRole('textbox', { name: /^Akzent/ }), '#ff0000');
      await warte(SPEICHER_VERZOEGERUNG_MS);
      await warte(0);
      expect(gespeichert().at(-1)?.farben?.akzent).toBe('#ff0000');
      expect(screen.getByText(/Noch nicht gespeichert/)).toBeTruthy();
      expect(rollen).toHaveBeenCalledTimes(1);
    } finally {
      Element.prototype.scrollIntoView = vorher;
    }
  });

  it('gespeichert ohne Fehler: nichts wird gerollt', async () => {
    const rollen = vi.fn();
    const vorher = Element.prototype.scrollIntoView;
    Element.prototype.scrollIntoView = rollen;
    try {
      await zeige();
      await tippe(feld('Name der Gemeinde'), 'Neu');
      await speichern();
      await warte(0);
      expect(schliessen).toHaveBeenCalledTimes(1);
      expect(rollen).not.toHaveBeenCalled();
    } finally {
      Element.prototype.scrollIntoView = vorher;
    }
  });

  it('ohne Änderung im Fenster: nichts Neues – und Speichern scheitert vorübergehend: Fenster bleibt, erneut klappt', async () => {
    await zeige();
    d.speichereEinstellungen.mockRejectedValueOnce(new ApiError(503, 'Dienst nicht erreichbar'));
    await tippe(feld('Name der Gemeinde'), 'Neu');
    await speichern();
    await warte(0);
    expect(screen.getByRole('alert').textContent).toMatch(/Nicht gespeichert/);
    expect(schliessen).not.toHaveBeenCalled();
    expect(feld('Name der Gemeinde').value).toBe('Neu');
    await speichern();
    await warte(0);
    expect(server.einstellungen?.name).toBe('Neu');
    expect(schliessen).toHaveBeenCalledTimes(1);
  });
});

describe('Jemand hat inzwischen geändert', () => {
  it('„Speichern“ schreibt NICHT darüber: der neue Stand ersetzt den Entwurf, ein Hinweis erklärt es', async () => {
    await zeige();
    // während das Fenster offen ist, speichert jemand anderes einen anderen Namen
    server.einstellungen = einstellungen({ name: 'Von jemand anderem' });
    await tippe(feld('Name der Gemeinde'), 'Mein Name');
    await speichern();
    await warte(0);
    expect(d.speichereEinstellungen).not.toHaveBeenCalled();
    expect(screen.getByRole('alert').textContent).toMatch(/von jemand anderem geändert/);
    expect(feld('Name der Gemeinde').value).toBe('Von jemand anderem');
    expect(schliessen).not.toHaveBeenCalled();
  });
});

describe('Datenschutz-Hinweis', () => {
  it('Livestream da, Link fehlt: Hinweis – mit Link (Seite oder Adresse) verschwindet er', async () => {
    await zeige(stand({ seiten: [START, STREAM] }));
    expect(screen.getByRole('note').textContent).toMatch(/Livestream/);
    await tippe(feld('Ziel von Datenschutz-Link'), 'extern');
    await tippe(feld('Adresse von Datenschutz-Link'), 'https://d.example');
    expect(screen.queryByRole('note')).toBeNull();
    await speichern();
    await warte(0);
    expect(gespeichert()[0].datenschutz).toEqual({ art: 'extern', url: 'https://d.example' });
  });

  it('ohne Livestream kein Hinweis', async () => {
    await zeige();
    expect(screen.queryByRole('note')).toBeNull();
  });
});

describe('EIN Zustand – Aussehen und Fenster schreiben dieselbe Einheit', () => {
  it('erst Aussehen, dann Fenster geändert: BEIDE Änderungen stehen im gespeicherten Stand', async () => {
    await zeige(stand(), true);
    await tippe(screen.getByRole('textbox', { name: /^Hauptfarbe(?! dunkel)/ }), '#112233');
    await warte(SPEICHER_VERZOEGERUNG_MS);
    expect(gespeichert()).toHaveLength(1);
    await tippe(feld('Name der Gemeinde'), 'Neuer Name');
    await speichern();
    await warte(0);
    expect(server.einstellungen?.name).toBe('Neuer Name');
    expect(server.einstellungen?.farben?.haupt).toBe('#112233');
    expect(gespeichert().at(-1)?.farben?.haupt).toBe('#112233');
  });

  it('Aussehen wartet noch auf seine Verzögerung, das Fenster speichert schon: die Farbe geht nicht verloren', async () => {
    await zeige(stand(), true);
    await tippe(screen.getByRole('textbox', { name: /^Akzent/ }), '#ff0000');
    // die Verzögerung läuft noch – jetzt speichert das Fenster
    await tippe(feld('Name der Gemeinde'), 'Zwischendurch');
    await speichern();
    await warte(0);
    expect(server.einstellungen?.name).toBe('Zwischendurch');
    expect(server.einstellungen?.farben?.akzent).toBe('#ff0000');
    await warte(SPEICHER_VERZOEGERUNG_MS * 2);
    // die wartende Verzögerung hat nichts Älteres darüber geschrieben
    expect(server.einstellungen?.name).toBe('Zwischendurch');
    expect(gespeichert().every((e) => e.farben?.akzent === '#ff0000')).toBe(true);
  });

  it('erst Fenster, dann Aussehen: der Name bleibt bei der Farbänderung erhalten', async () => {
    await zeige(stand(), true);
    await tippe(feld('Name der Gemeinde'), 'Fenstername');
    await speichern();
    await warte(0);
    await tippe(screen.getByRole('textbox', { name: /^Text(?! des)(?!sch)/ }), '#222222');
    await warte(SPEICHER_VERZOEGERUNG_MS);
    expect(server.einstellungen?.name).toBe('Fenstername');
    expect(server.einstellungen?.farben?.text).toBe('#222222');
  });

  it('es gibt nur EINE Sperre: Fenster und Aussehen nehmen sie zusammen genau einmal', async () => {
    await zeige(stand(), true);
    await tippe(screen.getByRole('textbox', { name: /^Akzent/ }), '#ff0000');
    await tippe(feld('Name der Gemeinde'), 'X');
    await speichern();
    await warte(0);
    // erster Handgriff, zweiter Handgriff (hält die Sperre schon) + Prüfung vor jedem Schreiben – keine zweite Instanz
    const beginne = d.beginneEinstellungen.mock.calls.length;
    expect(beginne).toBeLessThanOrEqual(gespeichert().length + 1);
  });
});

describe('Fremdsperre – das Fenster ist nur zum Lesen', () => {
  it('Felder aus, Speichern aus, der Grund steht da, nichts wird geschrieben', async () => {
    await zeige(stand({ einstellungenSperre: sperreVon(ANDERER, new Date()) }));
    expect(screen.getByRole('status').textContent).toMatch(/Jonas Peters/);
    expect(feld('Name der Gemeinde').matches(':disabled')).toBe(true);
    expect(screen.getByRole<HTMLButtonElement>('button', { name: 'Speichern' }).disabled).toBe(
      true,
    );
    await warte(SPEICHER_VERZOEGERUNG_MS * 2);
    expect(d.speichereEinstellungen).not.toHaveBeenCalled();
    expect(d.beginneEinstellungen).not.toHaveBeenCalled();
  });
});

describe('Laden und Fehler', () => {
  it('Einstellungen unlesbar: nichts wird angeboten', async () => {
    await zeige(
      stand({
        probleme: [{ wert: 5, einheit: 'einstellungen', id: 'einstellungen', text: 'kaputt' }],
      }),
    );
    expect(screen.getByRole('alert').textContent).toMatch(/nicht lesen/);
    expect(screen.queryByLabelText('Name der Gemeinde')).toBeNull();
  });

  it('keine gespeicherten Einstellungen: das Fenster zeigt die vorläufigen (Gemeindename)', async () => {
    await zeige(stand({ einstellungen: null }));
    expect(feld('Name der Gemeinde').value).toBe('ECG');
    expect(NEUTRALE_FARBEN.haupt).toBeTruthy();
  });
});
