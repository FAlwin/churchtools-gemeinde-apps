// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, onTestFinished, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { ApiError } from '@ui/ct/fehler';
import { App } from './App';
import { ladeStart, type Start } from './start';
import * as L from './lesen';
import { ladeVorlaufOderStandard } from './todoHinweis';
import { neueAufgabe, statusSetzen, type Aufgabe } from '@shared/protokolle/aufgaben';
import type { Vorlauf } from '@shared/protokolle/hinweis';

vi.mock('./start', () => ({ ladeStart: vi.fn() }));
vi.mock('./Verwaltung', () => ({
  Verwaltung: ({ onVorlauf }: { onVorlauf?: (v: 'aus') => void }) => (
    <div>
      <p>VERWALTUNG</p>
      <button type="button" onClick={() => onVorlauf?.('aus')}>
        VORLAUF AUS
      </button>
    </div>
  ),
}));
vi.mock('./Sitzungen', () => ({
  Sitzungen: ({
    auswahl,
  }: {
    auswahl?: { gruppe: number; sitzung?: string; punkt?: string | null } | null;
  }) => (
    <p>
      SITZUNGEN{' '}
      {auswahl
        ? `${auswahl.gruppe}/${auswahl.sitzung ?? '-'}${auswahl.punkt ? `#${auswahl.punkt}` : ''}`
        : 'ohne Auswahl'}
    </p>
  ),
}));
vi.mock('./lesen', () => ({
  ladeUebersicht: vi.fn(() => Promise.resolve([])),
  ladeAufgaben: vi.fn(() => Promise.resolve([])),
}));
vi.mock('./todoHinweis', () => ({ ladeVorlaufOderStandard: vi.fn(() => Promise.resolve(3)) }));
vi.mock('./mitglieder', () => ({
  ladeGruppenMitglieder: vi.fn(() => Promise.resolve('verborgen')),
}));
vi.mock('./useToDoEinstellungen', async (orig) =>
  (await import('./ohneAbgleich.testutil')).ohneAbgleich(orig),
);
vi.mock('./Suche', () => ({
  Suche: ({
    begriff,
    onTreffer,
  }: {
    begriff: string;
    onTreffer: (g: number, s: string, p: string | null) => void;
  }) => (
    <div>
      <p>SUCHE „{begriff}“</p>
      <button type="button" onClick={() => onTreffer(7, 'p:okt', 'pkt-2')}>
        TREFFER
      </button>
    </div>
  ),
}));
const laden = vi.mocked(ladeStart);

const START: Start = {
  id: 1,
  vorname: 'Alwin',
  nachname: 'Friesen',
  gemeinde: 'ECG Donrath',
  modul: 20,
  darfVerwalten: false,
  kalenderSchreiben: [],
  vorlagenSchreiben: [],
  tagsVerwalten: false,
  ressourcenBuchen: [],
  ressourcenVerwalten: [],
  eventsAnlegen: [],
  eventsAendern: [],
  gruppentypenAnlegen: [],
  schreibbar: [],
  gruppen: [
    { id: 11, name: 'Leitungsteam', lage: 'eingerichtet', protokolle: 60, mitarbeit: 61 },
    { id: 7, name: 'Jugendleitung', lage: 'unvollstaendig', protokolle: 70, mitarbeit: null },
  ],
};

beforeEach(() => {
  laden.mockResolvedValue(START);
  window.location.hash = '';
});

describe('App (S1)', () => {
  it('„Hallo …“ nur auf Start (R8) – auf „To-Dos“ nicht', async () => {
    window.location.hash = '#/todos';
    render(<App />);
    await screen.findByRole('button', { name: /^To-Dos/ });
    expect(screen.queryByRole('heading', { name: 'Hallo Alwin' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Start' }));
    expect(await screen.findByRole('heading', { name: 'Hallo Alwin' })).toBeTruthy();
  });

  it('zeigt Gruß, App-Name (ohne Gemeinde) und die Gruppen mit ihrem Stand', async () => {
    render(<App />);
    expect(await screen.findByRole('heading', { name: 'Hallo Alwin' })).toBeTruthy();
    expect(screen.getByText('Protokolle')).toBeTruthy();
    expect(screen.queryByText(/ECG Donrath/)).toBeNull();
    const liste = screen.getByRole('list');
    const zeilen = within(liste)
      .getAllByRole('listitem')
      .map((z) => z.textContent);
    expect(zeilen).toEqual(['Leitungsteameingerichtet', 'Jugendleitungunvollständig eingerichtet']);
    expect(screen.getByText(/Fehlt eine Gruppe\? Ein Admin richtet sie ein/)).toBeTruthy();
  });

  it('ohne Gruppen: ein klarer Satz statt einer leeren Liste', async () => {
    laden.mockResolvedValue({ ...START, gruppen: [] });
    render(<App />);
    expect(
      await screen.findByText('Du bist in keiner Gruppe, die hier Protokolle führen kann.'),
    ).toBeTruthy();
    expect(screen.queryByRole('list')).toBeNull();
  });

  it('auch ohne Gruppen: der Hinweis, wie eine fehlende Gruppe dazukommt', async () => {
    laden.mockResolvedValue({ ...START, gruppen: [] });
    render(<App />);
    expect(await screen.findByText(/Fehlt eine Gruppe\?/)).toBeTruthy();
  });

  it('vorübergehender Fehler: „Erneut versuchen“ lädt neu – nicht „keine Gruppen“', async () => {
    laden.mockRejectedValueOnce(new ApiError(503, 'ChurchTools antwortet gerade nicht.'));
    render(<App />);
    const knopf = await screen.findByRole('button', { name: 'Erneut versuchen' });
    expect(screen.queryByText(/keiner Gruppe/)).toBeNull();
    fireEvent.click(knopf);
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Hallo Alwin' })).toBeTruthy());
    expect(laden).toHaveBeenCalledTimes(2);
  });

  // Wie in allen Erweiterungen (`ui/ct/fehlerMeldung.ts`): 404 zeigt die Meldung von ChurchTools bzw. der
  // Modulsuche; „Erneut versuchen“ bleibt (nach dem Hochladen der Erweiterung hilft es).
  it('Erweiterung fehlt (404): sagt das, statt „keine Gruppen“ zu zeigen', async () => {
    laden.mockRejectedValue(
      new ApiError(404, 'Die Erweiterung „Protokolle“ ist in ChurchTools nicht zu finden.'),
    );
    render(<App />);
    expect(
      await screen.findByText('Die Erweiterung „Protokolle“ ist in ChurchTools nicht zu finden.'),
    ).toBeTruthy();
    expect(screen.queryByText(/keiner Gruppe/)).toBeNull();
  });

  it('kein Admin: Reiter Start · Sitzungen, kein „Einstellungen“ – und #/verwaltung führt zum Start', async () => {
    window.location.hash = '#/verwaltung';
    render(<App />);
    expect(await screen.findByRole('heading', { name: 'Hallo Alwin' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Sitzungen' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Einstellungen' })).toBeNull();
    expect(screen.queryByText('VERWALTUNG')).toBeNull();
  });

  it('Admin: Reiter Start · Einstellungen; „Einstellungen“ zeigt die Verwaltung ohne Gruß', async () => {
    laden.mockResolvedValue({ ...START, darfVerwalten: true });
    render(<App />);
    fireEvent.click(await screen.findByRole('button', { name: 'Einstellungen' }));
    expect(await screen.findByText('VERWALTUNG')).toBeTruthy();
    expect(window.location.hash).toBe('#/verwaltung');
    expect(screen.queryByRole('heading', { name: 'Hallo Alwin' })).toBeNull();
  });

  it('„Sitzungen“ zeigt die Sitzungen ohne Gruß', async () => {
    render(<App />);
    fireEvent.click(await screen.findByRole('button', { name: 'Sitzungen' }));
    expect(await screen.findByText('SITZUNGEN ohne Auswahl')).toBeTruthy();
    expect(window.location.hash).toBe('#/sitzungen');
    expect(screen.queryByRole('heading', { name: 'Hallo Alwin' })).toBeNull();
  });

  it('S3-3: eine Gruppe auf der Startseite öffnet „Sitzungen“ mit dieser Gruppe', async () => {
    render(<App />);
    fireEvent.click(await screen.findByRole('button', { name: /Jugendleitung/ }));
    expect(await screen.findByText('SITZUNGEN 7/-')).toBeTruthy();
    expect(window.location.hash).toBe('#/sitzungen');
  });

  it('S3-3: über den Reiter zurück und wieder hin – die alte Auswahl gilt nicht mehr', async () => {
    render(<App />);
    fireEvent.click(await screen.findByRole('button', { name: /Jugendleitung/ }));
    await screen.findByText('SITZUNGEN 7/-');
    fireEvent.click(screen.getByRole('button', { name: 'Start' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Sitzungen' }));
    expect(await screen.findByText('SITZUNGEN ohne Auswahl')).toBeTruthy();
  });

  it('B2: Rechner – die Lupe sitzt rechts neben den unterstrichenen Reitern; Handy – neben dem App-Namen, Reiter unten', async () => {
    breite(false);
    const { unmount } = render(<App />);
    const lupe = await screen.findByRole('button', { name: 'Suchen' });
    const nav = screen.getByRole('navigation', { name: 'Bereiche' });
    expect(nav.nextElementSibling).toBe(lupe);
    expect(nav.closest('header')).not.toBeNull();
    unmount();
    breite(true);
    render(<App />);
    const handyLupe = await screen.findByRole('button', { name: 'Suchen' });
    expect(handyLupe.closest('header')).not.toBeNull();
    expect(screen.getByRole('navigation', { name: 'Bereiche' }).closest('header')).toBeNull();
  });

  it('S3-4b: die Lupe klappt die Suche auf – sie ersetzt den Inhalt, der Gruß verschwindet', async () => {
    render(<App />);
    fireEvent.click(await screen.findByRole('button', { name: 'Suchen' }));
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'beamer' } });
    expect(screen.getByText('SUCHE „beamer“')).toBeTruthy();
    expect(screen.queryByRole('heading', { name: 'Hallo Alwin' })).toBeNull();
    expect(screen.queryByText(/Deine Gruppen/)).toBeNull();
  });

  it('S3-4b: ✕ führt zurück – der Begriff ist beim nächsten Öffnen leer', async () => {
    render(<App />);
    fireEvent.click(await screen.findByRole('button', { name: 'Suchen' }));
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'beamer' } });
    fireEvent.click(screen.getByRole('button', { name: 'Suche schließen' }));
    expect(await screen.findByRole('heading', { name: 'Hallo Alwin' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Suchen' }));
    expect(screen.getByText('SUCHE „“')).toBeTruthy();
  });

  it('S3-4b: ein Reiter schließt die Suche', async () => {
    render(<App />);
    fireEvent.click(await screen.findByRole('button', { name: 'Suchen' }));
    fireEvent.click(screen.getByRole('button', { name: 'Sitzungen' }));
    expect(await screen.findByText('SITZUNGEN ohne Auswahl')).toBeTruthy();
    expect(screen.queryByRole('searchbox')).toBeNull();
  });

  it('S3-4b: ein Treffer öffnet „Sitzungen“ mit Gruppe, Sitzung und Punkt – die Suche ist zu', async () => {
    render(<App />);
    fireEvent.click(await screen.findByRole('button', { name: 'Suchen' }));
    fireEvent.click(screen.getByRole('button', { name: 'TREFFER' }));
    expect(await screen.findByText('SITZUNGEN 7/p:okt#pkt-2')).toBeTruthy();
    expect(window.location.hash).toBe('#/sitzungen');
    expect(screen.queryByRole('searchbox')).toBeNull();
  });
});

describe('Direktlink auf eine Sitzung (S6-2, „Protokoll öffnen“ im Beitrag)', () => {
  it('öffnet „Sitzungen“ mit Gruppe und Sitzung; die Adresse geht auf den Reiter zurück, der Pfad bleibt', async () => {
    window.history.replaceState(null, '', '/ccm/protokolle/#/sitzungen/7/ab%20c');
    // Wie in ChurchTools: `<base href>` zeigt auf die Instanz – ein nacktes `#/…` landete dort.
    const basis = document.createElement('base');
    basis.href = '/';
    document.head.append(basis);
    onTestFinished(() => {
      basis.remove();
      window.history.replaceState(null, '', '/');
    });
    render(<App />);
    expect(await screen.findByText('SITZUNGEN 7/p:ab c')).toBeTruthy();
    expect(window.location.hash).toBe('#/sitzungen');
    expect(window.location.pathname).toBe('/ccm/protokolle/');
    expect(screen.queryByRole('heading', { name: 'Hallo Alwin' })).toBeNull();
  });

  it('auch bei schon offener App (Link angeklickt, während sie läuft)', async () => {
    render(<App />);
    await screen.findByRole('heading', { name: 'Hallo Alwin' });
    window.location.hash = '#/sitzungen/11/s9';
    expect(await screen.findByText('SITZUNGEN 11/p:s9')).toBeTruthy();
    expect(window.location.hash).toBe('#/sitzungen');
  });
});

/** `matchMedia` wie im Browser: `handy` = schmaler als 760 px. */
function breite(handy: boolean) {
  vi.stubGlobal('matchMedia', (q: string) => ({
    matches: handy && q.includes('max-width: 759px'),
    media: q,
    addEventListener: () => {},
    removeEventListener: () => {},
  }));
}

describe('Hinweis auf fällige To-Dos: Zähler am Reiter und Band', () => {
  // Heute: Do, 19.11.2026. Ich (1) habe ein überfälliges und ein am 21.11. fälliges To-Do (bei 3 Tagen) sowie ein
  // spätes, ein erledigtes und ein fremdes – gezählt werden genau die beiden ersten.
  const todo = (id: string, bis: string, x: Partial<Aufgabe> = {}): Aufgabe => ({
    ...neueAufgabe({ id, gruppe: 11, sitzung: null, text: id, wer: [1], bis, von: 1, am: 'x' }),
    ...x,
  });
  const MEINE = [
    todo('ueber', '2026-11-10'),
    todo('bald', '2026-11-21'),
    todo('spaet', '2026-12-24'),
    statusSetzen(todo('fertig', '2026-11-10'), 'erledigt', 1, 'x'),
    todo('fremd', '2026-11-10', { wer: [2] }),
  ];
  const leer = {
    kommend: [],
    protokolle: [],
    teile: [],
    kalender: null,
    punkte: 'vorschlagen' as const,
    treffenNichtFreigegeben: false,
  };
  const uebersicht = (aufgaben: Aufgabe[]): L.GruppenUebersicht[] =>
    START.gruppen.map((g, i) => ({
      gruppe: g,
      sitzungen: leer,
      todoVorschlaege: [],
      aufgaben: i === 0 ? aufgaben : [],
    }));
  const vorlauf = (v: Vorlauf) => vi.mocked(ladeVorlaufOderStandard).mockResolvedValue(v);

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-11-19T10:00:00Z'));
    vi.mocked(L.ladeUebersicht).mockResolvedValue(uebersicht(MEINE));
    vi.mocked(L.ladeAufgaben).mockImplementation((_m, g) =>
      Promise.resolve(g.mitarbeit === 61 ? MEINE : []),
    );
    vorlauf(3);
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it('Computer: roter Zähler 2 am Reiter „To-Dos“ (Klartext als Name), Band auf der Startseite', async () => {
    breite(false);
    render(<App />);
    const reiter = await screen.findByRole('button', { name: 'To-Dos, 2 fällig' });
    expect(reiter.querySelector('[data-zaehler]')!.textContent).toBe('2');
    const band = await screen.findByRole('region', { name: 'Fällige To-Dos' });
    expect(band.textContent).toContain('1 To-Do überfällig, 1 bis Sa, 21.11. fällig');
  });

  it('Handy: derselbe Zähler unten in der Reiterleiste, auf jeder Seite', async () => {
    breite(true);
    render(<App />);
    const unten = await screen.findByRole('navigation', { name: 'Bereiche' });
    await within(unten).findByRole('button', { name: 'To-Dos, 2 fällig' });
    fireEvent.click(within(unten).getByRole('button', { name: 'Sitzungen' }));
    await screen.findByText('SITZUNGEN ohne Auswahl');
    expect(within(unten).getByRole('button', { name: 'To-Dos, 2 fällig' })).toBeTruthy();
  });

  it('Start oder To-Dos zuerst: kein zusätzlicher Abruf der To-Dos – die Seite liefert sie', async () => {
    render(<App />);
    await screen.findByRole('button', { name: 'To-Dos, 2 fällig' });
    expect(L.ladeAufgaben).not.toHaveBeenCalled();
  });

  it('zuerst auf „Termine“ (Direktlink): die To-Dos kommen aus der Übersicht des Reiters – kein zweiter Abruf', async () => {
    window.location.hash = '#/termine';
    render(<App />);
    await screen.findByRole('button', { name: 'To-Dos, 2 fällig' });
    expect(L.ladeUebersicht).toHaveBeenCalledTimes(1);
    expect(L.ladeAufgaben).not.toHaveBeenCalled();
  });

  it('zuerst auf „Sitzungen“ (Direktlink): einmal leicht je Gruppe, dann steht der Zähler da', async () => {
    window.location.hash = '#/sitzungen';
    render(<App />);
    await screen.findByText('SITZUNGEN ohne Auswahl');
    await screen.findByRole('button', { name: 'To-Dos, 2 fällig' });
    expect(L.ladeAufgaben).toHaveBeenCalledTimes(2);
    expect(L.ladeUebersicht).not.toHaveBeenCalled();
  });

  it('der leichte Abruf scheitert: kein Zähler, nichts bricht', async () => {
    window.location.hash = '#/sitzungen';
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.mocked(L.ladeAufgaben).mockRejectedValue(new ApiError(503, 'weg'));
    render(<App />);
    await screen.findByText('SITZUNGEN ohne Auswahl');
    await waitFor(() => expect(warn).toHaveBeenCalled());
    expect(screen.getByRole('button', { name: 'To-Dos' })).toBeTruthy();
    warn.mockRestore();
  });

  it('„Aus“: weder Zähler noch Band', async () => {
    vorlauf('aus');
    render(<App />);
    await screen.findByRole('heading', { name: 'Hallo Alwin' });
    await waitFor(() => expect(L.ladeUebersicht).toHaveBeenCalled());
    expect(
      screen.getByRole('button', { name: 'To-Dos' }).querySelector('[data-zaehler]'),
    ).toBeNull();
    expect(screen.queryByRole('region', { name: 'Fällige To-Dos' })).toBeNull();
  });

  it('„Nur überfällig“: Zähler 1 (das bald fällige zählt nicht), Band ohne „bald“', async () => {
    vorlauf('ueberfaellig');
    render(<App />);
    await screen.findByRole('button', { name: 'To-Dos, 1 fällig' });
    const band = await screen.findByRole('region', { name: 'Fällige To-Dos' });
    expect(band.textContent).toContain('1 To-Do überfällig');
    expect(band.textContent).not.toContain('21.11.');
  });

  it('nichts fällig: kein Zähler, kein Band', async () => {
    vi.mocked(L.ladeUebersicht).mockResolvedValue(uebersicht([todo('spaet', '2026-12-24')]));
    render(<App />);
    await screen.findByRole('heading', { name: 'Hallo Alwin' });
    await waitFor(() => expect(L.ladeUebersicht).toHaveBeenCalled());
    expect(
      screen.getByRole('button', { name: 'To-Dos' }).querySelector('[data-zaehler]'),
    ).toBeNull();
    expect(screen.queryByRole('region', { name: 'Fällige To-Dos' })).toBeNull();
  });

  it('der Zähler folgt dem neuen Stand: im Reiter „To-Dos“ erledigt → Start zeigt weniger', async () => {
    render(<App />);
    await screen.findByRole('button', { name: 'To-Dos, 2 fällig' });
    vi.mocked(L.ladeUebersicht).mockResolvedValue(
      uebersicht([statusSetzen(MEINE[0], 'erledigt', 1, 'x'), ...MEINE.slice(1)]),
    );
    fireEvent.click(screen.getByRole('button', { name: 'To-Dos, 2 fällig' }));
    await screen.findByRole('button', { name: 'To-Dos, 1 fällig' });
  });

  it('Admin ändert den Vorlauf in den Einstellungen: Zähler und Band richten sich sofort danach', async () => {
    laden.mockResolvedValue({ ...START, darfVerwalten: true });
    render(<App />);
    await screen.findByRole('button', { name: 'To-Dos, 2 fällig' });
    fireEvent.click(screen.getByRole('button', { name: 'Einstellungen' }));
    fireEvent.click(await screen.findByRole('button', { name: 'VORLAUF AUS' }));
    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: 'To-Dos' }).querySelector('[data-zaehler]'),
      ).toBeNull(),
    );
    fireEvent.click(screen.getByRole('button', { name: 'Start' }));
    await screen.findByRole('heading', { name: 'Hallo Alwin' });
    expect(screen.queryByRole('region', { name: 'Fällige To-Dos' })).toBeNull();
  });
});
