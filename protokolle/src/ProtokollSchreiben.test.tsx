// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { BLOCKNOTE_DOKUMENT } from '@shared/protokolle/dokument.testdaten';
import {
  sperreVon,
  teileBauen,
  type ProtokollKopf,
  type ProtokollTeil,
} from '@shared/protokolle/speicher';
import type { Sitzung } from '@shared/protokolle/sitzungen';
import * as M from './mitglieder';
import * as S from './schreiben';
import * as A from './aufgabenSchreiben';
import * as W from './mitarbeitWerte';
import * as P from './planen';
import * as AW from './anwesenheitSchreiben';
import { neueAufgabe } from '@shared/protokolle/aufgaben';
import { neuerToDoVorschlag } from '@shared/protokolle/todoVorschlag';
import {
  annehmen,
  neuerVorschlag,
  vorschlagBloecke,
  zielVon,
  type Vorschlag,
} from '@shared/protokolle/vorschlaege';
import * as V from './vorschlaegeSchreiben';
import * as BS from './beitragSchreiben';
import { Unklar } from '@ui/ct/fehler';
import * as LO from './loeschen';
import { ProtokollSchreiben } from './ProtokollSchreiben';
import type { FestePunkteWert } from './festePunkteKontext';

/** Der Bildschirm „Protokoll schreiben“ (S4-1) – Schreiben bei ChurchTools und der Editor sind Attrappen. */
// Was der Editor über `einfuegen` bekam (S5-4) – es steht danach in seinem Dokument.
const E = vi.hoisted(() => ({
  einfuegen: vi.fn(),
  zusatz: [] as unknown[],
  ersetzt: [] as unknown[],
  // Der Kontext der festen Punkte, wie die Blöcke ihn sehen (W16: `darfHaken`).
  feste: null as FestePunkteWert | null,
}));
// Vorschläge in „Mitarbeit“: die Regel wird auf den gespeicherten Stand angewendet, wie bei ChurchTools.
const VS = vi.hoisted(() => ({ stand: new Map<string, unknown>() }));
vi.mock('./vorschlaegeSchreiben', () => ({
  vorschlagSchreiben: vi.fn((_o: unknown, id: string, f: (v: unknown) => unknown) => {
    const neu = f(VS.stand.get(id));
    VS.stand.set(id, neu);
    return Promise.resolve(neu);
  }),
}));
vi.mock('./schreiben', () => ({
  freigeben: vi.fn(),
  protokollLesen: vi.fn(),
  schreibenUebernehmen: vi.fn(),
  speichern: vi.fn(),
  sperreFreigeben: vi.fn(() => Promise.resolve(true)),
  sperreNehmen: vi.fn(),
  treffenVerknuepfen: vi.fn(() => Promise.resolve()),
}));
vi.mock('./planen', () => ({ treffenAnlegen: vi.fn(() => Promise.resolve(88)) }));
// „Löschen“ (W6): das Löschen selbst als Attrappe – was es tut, prüft `loeschen.test.ts`.
vi.mock('./loeschen', async (orig) => ({
  ...(await orig<typeof import('./loeschen')>()),
  protokollLoeschen: vi.fn(),
}));
// Freigabe (S6-1): Anwesenheit lesen und Treffen abschließen als Attrappen.
vi.mock('./anwesenheitSchreiben', async (orig) => ({
  ...(await orig<typeof import('./anwesenheitSchreiben')>()),
  anwesenheitLesen: vi.fn(() =>
    Promise.resolve({
      abgeschlossen: false,
      begonnen: true,
      personen: [
        { person: 1, name: 'Alwin Friesen', status: 'da' },
        { person: 19, name: 'Spike Musiker', status: 'offen' },
      ],
    }),
  ),
  treffenAbschliessen: vi.fn(() => Promise.resolve()),
}));
// Beitrag in der Gruppe (S6-2): ob es geht und der Schritt als Attrappen – sonst: in dieser Gruppe nicht.
const BT = vi.hoisted(() => ({ schritt: vi.fn(() => Promise.resolve()) }));
vi.mock('./beitragSchreiben', () => ({
  beitragMoeglich: vi.fn(() => Promise.resolve(false)),
  beitragSchritt: vi.fn(() => BT.schritt),
}));
vi.mock('./aufgabenSchreiben', () => ({
  aufgabenWerte: vi.fn(() => Promise.resolve([])),
  aufgabenSchreiben: vi.fn(() => Promise.resolve([])),
  aufgabeAendern: vi.fn(),
}));
// „Mitarbeit“ wird beim Öffnen einmal gelesen – To-Dos und Vorschläge (S5-4).
vi.mock('./mitarbeitWerte', async (orig) => ({
  ...(await orig<typeof import('./mitarbeitWerte')>()),
  mitarbeitRoh: vi.fn(() => Promise.resolve([])),
}));
// „Teilen / PDF“ (S6-3b): das Blatt festhalten statt zeichnen – jsdom kann kein pdf.js.
const BLAETTER = vi.hoisted(() => [] as unknown[]);
vi.mock('@ui/teilen/protokollPdf', () => ({
  protokollPdf: vi.fn(async (b: unknown) => {
    BLAETTER.push(b);
    const { jsPDF } = await import('jspdf');
    return new jsPDF();
  }),
}));
vi.mock('@ui/teilen/pdfSeiten', () => ({
  renderPdfToCanvases: vi.fn(() => Promise.resolve([])),
  renderPdfSeite: vi.fn(() => Promise.reject(new Error('jsdom'))),
}));
// „Mit KI füllen“ (S8-2): die Personenliste als Attrappe – Johann ist auch Mitglied (siehe `./mitglieder` unten).
vi.mock('./kiPersonen', () => ({
  ladePersonen: vi.fn(() =>
    Promise.resolve([
      { id: 7, vorname: 'Johann', nachname: 'Becker' },
      { id: 8, vorname: 'Viktor', nachname: 'Neumann' },
    ]),
  ),
}));
vi.mock('./mitglieder', () => ({
  ladeGruppenMitglieder: vi.fn(() => Promise.resolve([{ id: 7, name: 'Johann' }])),
}));
// Der Editor als Attrappe: zeigt, ob er bearbeitbar ist, meldet auf Knopfdruck eine Eingabe und reicht den Kontext
// der Aufgaben durch (wie die Blöcke ihn sehen).
vi.mock('./DokumentEditor', async () => {
  const { useContext, useImperativeHandle } = await import('react');
  const { AufgabenKontext } = await import('./aufgabenKontext');
  const { FestePunkteKontext } = await import('./festePunkteKontext');
  return {
    DokumentEditor: ({
      bearbeitbar,
      onAenderung,
      griff,
    }: {
      bearbeitbar: boolean;
      onAenderung: (d: unknown[]) => void;
      griff: { current: unknown };
    }) => {
      const k = useContext(AufgabenKontext);
      const feste = useContext(FestePunkteKontext);
      E.feste = feste;
      useImperativeHandle(griff, () => ({
        dokument: () => [...MIT_AUFGABE, ...E.zusatz],
        ersetzen: (d: unknown) => E.ersetzt.push(d),
        einfuegen: (b: unknown[], vor: string | null) => {
          E.einfuegen(b, vor);
          E.zusatz.push(...b);
        },
        einfuegungen: (liste: { bloecke: unknown[]; vor: string | null }[]) => {
          for (const f of liste) {
            E.einfuegen(f.bloecke, f.vor);
            E.zusatz.push(...f.bloecke);
          }
        },
      }));
      return (
        <div>
          <span data-testid="editor">{bearbeitbar ? 'bearbeitbar' : 'nur lesen'}</span>
          <button type="button" onClick={() => onAenderung(MIT_AUFGABE)}>
            tippen
          </button>
          <button
            type="button"
            onClick={() => k?.aendern('t1', 'Beamer', (a) => ({ ...a, wer: [7] }))}
          >
            wer
          </button>
          <span data-testid="todos">{k ? [...k.todos.keys()].join(',') : 'kein Kontext'}</span>
          <span data-testid="mitglieder">{k ? JSON.stringify(k.mitglieder) : ''}</span>
          <button type="button" onClick={() => void feste?.treffenAnlegen?.()}>
            treffen anlegen
          </button>
          <span data-testid="treffen">{String(feste?.treffen ?? 'kein Treffen')}</span>
        </div>
      );
    },
  };
});

const MIT_AUFGABE = [
  { id: 'h', type: 'heading', props: { level: 1 }, content: 'Punkt', children: [] },
  {
    id: 'a',
    type: 'aufgabe',
    props: { aufgabe: 't1' },
    content: [{ type: 'text', text: 'Beamer', styles: {} }],
    children: [],
  },
  // Ein früheres Protokoll (K3b-2) – damit „Öffnen“ aus dem Fenster auch nach dem Tippen geprüft werden kann.
  { id: 'v', type: 'verweis', props: { art: 'letztes-protokoll' }, children: [] },
];

const lesen = vi.mocked(S.protokollLesen);
const uebernehmen = vi.mocked(S.schreibenUebernehmen);

const DOK = [{ id: 'h', type: 'heading', props: { level: 1 }, content: 'Punkt', children: [] }];
const KOPF: ProtokollKopf = {
  art: 'protokoll',
  fassung: 1,
  sitzung: 's1',
  titel: 'Leitungssitzung',
  status: 'entwurf',
  beginn: '2026-10-24T17:00:00Z',
  termin: null,
  treffen: null,
  freigabe: null,
  sperre: null,
  stand: 'a',
};
const SITZUNG = {
  schluessel: 'p:s1',
  titel: 'Leitungssitzung',
  beginn: '2026-10-24T17:00:00Z',
  kopf: KOPF,
} as unknown as Sitzung;

const zeige = (onZurueck = vi.fn(), onBearbeiten?: () => void, onGeloescht?: () => void) => {
  const props = {
    onBearbeiten,
    onGeloescht,
    sitzung: SITZUNG,
    gruppe: 'Leitungsteam',
    gruppeId: 194,
    modul: 24,
    kategorie: 62,
    mitarbeit: 65,
    protokolle: [],
    teile: [],
    zeitzone: 'Europe/Berlin',
    onZurueck,
  };
  const r = render(<ProtokollSchreiben leitung {...props} ich={{ person: 1, name: 'Alwin' }} />);
  // Die Liste dahinter zeichnet neu und reicht dabei neue Objekte herein – das darf den Editor nicht neu laden.
  const neuZeichnen = () =>
    r.rerender(<ProtokollSchreiben leitung {...props} ich={{ person: 1, name: 'Alwin' }} />);
  return { ...r, neuZeichnen };
};

beforeEach(() => {
  lesen.mockResolvedValue({ kopf: KOPF, dokument: DOK });
  E.zusatz.length = 0;
  E.ersetzt.length = 0;
  VS.stand.clear();
});

describe('ProtokollSchreiben', () => {
  it('öffnet den Entwurf bearbeitbar – einmal, auch wenn die Liste dahinter neu zeichnet', async () => {
    const { neuZeichnen } = zeige();
    expect(await screen.findByText('bearbeitbar')).toBeTruthy();
    neuZeichnen();
    neuZeichnen();
    await waitFor(() => expect(lesen).toHaveBeenCalledTimes(1));
    expect(lesen).toHaveBeenCalledWith({ modul: 24, kategorie: 62, sitzung: 's1' });
  });

  it('„Bearbeiten“ im Kopf nur, wenn gereicht (Leitung) – für die eigene Sitzung des Entwurfs', async () => {
    const onBearbeiten = vi.fn();
    const r = zeige(vi.fn(), onBearbeiten);
    fireEvent.click(await screen.findByRole('button', { name: /Sitzung bearbeiten/ }));
    expect(onBearbeiten).toHaveBeenCalled();
    r.unmount();
    zeige();
    await screen.findByText(/Entwurf – noch nicht freigegeben/);
    expect(screen.queryByRole('button', { name: /Sitzung bearbeiten/ })).toBeNull();
  });

  it('schreibt jemand anderes: Hinweis, nur lesen, Übernehmen mit Rückfrage', async () => {
    const johann = sperreVon({ person: 7, name: 'Johann', fenster: 'j' }, new Date());
    lesen.mockResolvedValue({ kopf: { ...KOPF, sperre: johann }, dokument: DOK });
    uebernehmen.mockResolvedValue({ art: 'ok', kopf: KOPF, dokument: DOK });
    zeige();
    expect(await screen.findByText('Johann schreibt gerade.')).toBeTruthy();
    expect(screen.getByTestId('editor').textContent).toBe('nur lesen');
    fireEvent.click(screen.getByRole('button', { name: 'Schreiben übernehmen' }));
    expect(uebernehmen).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Übernehmen' }));
    await waitFor(() => expect(screen.getByTestId('editor').textContent).toBe('bearbeitbar'));
    expect(uebernehmen).toHaveBeenCalledTimes(1);
  });

  it('ich selbst in einem anderen Fenster: eigener Hinweis', async () => {
    const ich = sperreVon({ person: 1, name: 'Alwin', fenster: 'anderes' }, new Date());
    lesen.mockResolvedValue({ kopf: { ...KOPF, sperre: ich }, dokument: DOK });
    zeige();
    expect(await screen.findByText(/in einem anderen Fenster/)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Hier weiterschreiben' })).toBeTruthy();
  });

  it('freigegeben: nur lesen, ohne Editor', async () => {
    lesen.mockResolvedValue({ kopf: { ...KOPF, status: 'frei' }, dokument: DOK });
    zeige();
    expect(await screen.findByText(/freigegeben und lässt sich nicht mehr ändern/)).toBeTruthy();
    expect(screen.queryByTestId('editor')).toBeNull();
  });

  it('Blöcke, die der Editor nicht kennt: nur lesen – sonst gingen sie beim Speichern verloren', async () => {
    lesen.mockResolvedValue({
      kopf: KOPF,
      // Ein Bild – kennt BlockNote, unser Editor nicht (die Tabelle kennt er seit K3a).
      dokument: [...BLOCKNOTE_DOKUMENT, { id: 'i', type: 'image', props: { url: 'x' } }],
    });
    zeige();
    expect(await screen.findByText(/noch nicht bearbeiten kann \(image\)/)).toBeTruthy();
    expect(screen.queryByTestId('editor')).toBeNull();
  });

  it('Lesefehler: Fehlerkasten statt leerem Editor', async () => {
    lesen.mockRejectedValue(new Error('Zeitüberschreitung'));
    zeige();
    expect(await screen.findByRole('button', { name: /erneut/i })).toBeTruthy();
    expect(screen.queryByTestId('editor')).toBeNull();
  });

  it('Speichern gleicht vorher die To-Dos ab – geplant aus dem Text des Protokolls (S4-2)', async () => {
    vi.mocked(S.sperreNehmen).mockResolvedValue({ art: 'ok', kopf: KOPF });
    vi.mocked(S.speichern).mockImplementation(async (_o, _i, _s, _d, _j, vorher) => {
      await vorher?.();
      return { art: 'ok', kopf: { ...KOPF, stand: 'b' } };
    });
    zeige();
    fireEvent.click(await screen.findByRole('button', { name: 'tippen' }));
    await waitFor(() => expect(A.aufgabenSchreiben).toHaveBeenCalled());
    expect(vi.mocked(A.aufgabenSchreiben).mock.calls[0][0]).toEqual({ modul: 24, kategorie: 65 });
    const planen = vi.mocked(A.aufgabenSchreiben).mock.calls[0][1];
    const plan = planen([]);
    expect(plan.anlegen.map((a) => [a.id, a.text, a.gruppe, a.sitzung])).toEqual([
      ['t1', 'Beamer', 194, 's1'],
    ]);
  });

  it('Wer/Bis/Status gehen direkt ins To-Do (aufgabeAendern) und erscheinen sofort', async () => {
    vi.mocked(A.aufgabeAendern).mockImplementation((_o, _id, f, anlegen) =>
      Promise.resolve(f(anlegen())),
    );
    zeige();
    fireEvent.click(await screen.findByRole('button', { name: 'wer' }));
    expect(screen.getByTestId('todos').textContent).toBe('t1');
    await waitFor(() => expect(A.aufgabeAendern).toHaveBeenCalledTimes(1));
    const [ort, id] = vi.mocked(A.aufgabeAendern).mock.calls[0];
    expect([ort, id]).toEqual([{ modul: 24, kategorie: 65 }, 't1']);
  });

  it('„Lesen“ zeigt die Lese-Ansicht mit den festen Punkten – der Editor bleibt ausgeblendet bestehen (S4-3a)', async () => {
    vi.mocked(W.mitarbeitRoh).mockResolvedValueOnce([
      {
        wert: 1,
        x: neueAufgabe({
          id: 'frueher',
          gruppe: 194,
          sitzung: 'alt',
          text: 'Beamer von früher',
          von: 1,
          am: '2026-10-01T10:00:00Z',
        }),
      },
    ]);
    lesen.mockResolvedValue({
      kopf: KOPF,
      dokument: [
        ...DOK,
        { id: 'v', type: 'verweis', props: { art: 'offene-aufgaben' }, children: [] },
      ],
    });
    zeige();
    await screen.findByText('bearbeitbar');
    fireEvent.click(screen.getByRole('button', { name: 'Lesen' }));
    expect(screen.getByText('Beamer von früher')).toBeTruthy();
    expect(screen.getByTestId('editor').closest('[hidden]')).not.toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Schreiben' }));
    expect(screen.getByTestId('editor').closest('[hidden]')).toBeNull();
    expect(screen.queryByText('Beamer von früher')).toBeNull();
  });

  it('„Öffnen“ im Fenster eines früheren Protokolls: erst Sperre lösen wie bei „Zurück“, dann dorthin (K3b-2)', async () => {
    const alt = teileBauen(
      [{ id: 'x', type: 'heading', props: { level: 1 }, content: 'Alt', children: [] }],
      'alt',
    );
    const ALT = {
      schluessel: 'p:alt',
      titel: 'Leitungssitzung',
      beginn: '2026-10-14T17:00:00Z',
      kopf: {
        ...KOPF,
        sitzung: 'alt',
        status: 'frei',
        beginn: '2026-10-14T17:00:00Z',
        stand: alt.stand,
      },
    } as unknown as Sitzung;
    lesen.mockResolvedValue({
      kopf: KOPF,
      dokument: [
        ...DOK,
        { id: 'v', type: 'verweis', props: { art: 'letztes-protokoll' }, children: [] },
      ],
    });
    const onZurueck = vi.fn();
    const onZuSitzung = vi.fn();
    render(
      <ProtokollSchreiben
        leitung
        sitzung={SITZUNG}
        gruppe="Leitungsteam"
        gruppeId={194}
        modul={24}
        kategorie={62}
        mitarbeit={65}
        protokolle={[ALT]}
        teile={alt.werte.map((w) => JSON.parse(w) as ProtokollTeil)}
        zeitzone="Europe/Berlin"
        ich={{ person: 1, name: 'Alwin' }}
        onZurueck={onZurueck}
        onZuSitzung={onZuSitzung}
      />,
    );
    await screen.findByText('bearbeitbar');
    // Erst tippen: Das nimmt die Sperre – die muss „Öffnen“ wieder lösen.
    vi.mocked(S.sperreNehmen).mockResolvedValue({ art: 'ok', kopf: KOPF });
    vi.mocked(S.speichern).mockResolvedValue({ art: 'ok', kopf: { ...KOPF, stand: 'b' } });
    fireEvent.click(screen.getByRole('button', { name: 'tippen' }));
    await screen.findByText(/gespeichert/);
    vi.mocked(S.sperreFreigeben).mockClear();
    fireEvent.click(screen.getByRole('button', { name: 'Lesen' }));
    fireEvent.click(screen.getByRole('button', { name: 'Ansehen' }));
    fireEvent.click(screen.getByRole('button', { name: 'Öffnen' }));
    await waitFor(() => expect(onZuSitzung).toHaveBeenCalledWith(ALT, true));
    expect(S.sperreFreigeben).toHaveBeenCalled();
    expect(onZurueck).not.toHaveBeenCalled();
  });

  it('„Öffnen“ abgebrochen („Hierbleiben“): das spätere „Zurück“ führt zur Liste, nicht zum früheren Protokoll', async () => {
    const alt = teileBauen(
      [{ id: 'x', type: 'heading', props: { level: 1 }, content: 'Alt', children: [] }],
      'alt',
    );
    const ALT = {
      schluessel: 'p:alt',
      titel: 'Leitungssitzung',
      beginn: '2026-10-14T17:00:00Z',
      kopf: {
        ...KOPF,
        sitzung: 'alt',
        status: 'frei',
        beginn: '2026-10-14T17:00:00Z',
        stand: alt.stand,
      },
    } as unknown as Sitzung;
    lesen.mockResolvedValue({
      kopf: KOPF,
      dokument: [
        ...DOK,
        { id: 'v', type: 'verweis', props: { art: 'letztes-protokoll' }, children: [] },
      ],
    });
    const onZurueck = vi.fn();
    const onZuSitzung = vi.fn();
    render(
      <ProtokollSchreiben
        leitung
        sitzung={SITZUNG}
        gruppe="Leitungsteam"
        gruppeId={194}
        modul={24}
        kategorie={62}
        mitarbeit={65}
        protokolle={[ALT]}
        teile={alt.werte.map((w) => JSON.parse(w) as ProtokollTeil)}
        zeitzone="Europe/Berlin"
        ich={{ person: 1, name: 'Alwin' }}
        onZurueck={onZurueck}
        onZuSitzung={onZuSitzung}
      />,
    );
    await screen.findByText('bearbeitbar');
    // Erst tippen: Das nimmt die Sperre – die muss „Öffnen“ wieder lösen.
    vi.mocked(S.sperreNehmen).mockResolvedValue({ art: 'ok', kopf: KOPF });
    vi.mocked(S.speichern).mockResolvedValue({ art: 'ok', kopf: { ...KOPF, stand: 'b' } });
    fireEvent.click(screen.getByRole('button', { name: 'tippen' }));
    await screen.findByText(/gespeichert/);
    // Jetzt scheitert das Speichern: „Öffnen“ fragt, ob man trotzdem gehen will – man bleibt.
    vi.mocked(S.speichern).mockRejectedValue(new Error('Netz weg'));
    fireEvent.click(screen.getByRole('button', { name: 'tippen' }));
    fireEvent.click(screen.getByRole('button', { name: 'Lesen' }));
    fireEvent.click(screen.getByRole('button', { name: 'Ansehen' }));
    fireEvent.click(screen.getByRole('button', { name: 'Öffnen' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Hierbleiben' }));
    // Später „Zurück“ und „Trotzdem verlassen“: zur Liste.
    fireEvent.click(screen.getByRole('button', { name: /Sitzungen/ }));
    fireEvent.click(await screen.findByRole('button', { name: 'Trotzdem verlassen' }));
    await waitFor(() => expect(onZurueck).toHaveBeenCalled());
    expect(onZuSitzung).not.toHaveBeenCalled();
  });

  it('„Gruppentreffen anlegen“ (S5-3): anlegen, mit dem Protokoll verknüpfen – danach kennt der Kontext es', async () => {
    zeige();
    await screen.findByText('bearbeitbar');
    expect(screen.getByTestId('treffen').textContent).toBe('kein Treffen');
    fireEvent.click(screen.getByRole('button', { name: 'treffen anlegen' }));
    await waitFor(() => expect(screen.getByTestId('treffen').textContent).toBe('88'));
    expect(P.treffenAnlegen).toHaveBeenCalledWith(
      194,
      SITZUNG.beginn,
      SITZUNG.beginn,
      'Europe/Berlin',
    );
    expect(S.treffenVerknuepfen).toHaveBeenCalledWith(
      { modul: 24, kategorie: 62, sitzung: 's1' },
      88,
    );
  });

  it('To-Do-Vorschläge (W9b) sind keine To-Dos: der feste Punkt „Offen von früher“ zeigt sie nicht', async () => {
    vi.mocked(W.mitarbeitRoh).mockResolvedValueOnce([
      {
        wert: 1,
        x: neueAufgabe({
          id: 'frueher',
          gruppe: 194,
          sitzung: 'alt',
          text: 'Beamer von früher',
          von: 1,
          am: '2026-10-01T10:00:00Z',
        }),
      },
      {
        wert: 2,
        x: neuerToDoVorschlag({
          id: 'vorschlag',
          gruppe: 194,
          text: 'Nur ein Vorschlag',
          bis: null,
          warum: '',
          von: { person: 19, name: 'Peter Wiens' },
          am: '2026-10-02T10:00:00Z',
        }),
      },
    ]);
    lesen.mockResolvedValue({
      kopf: KOPF,
      dokument: [
        ...DOK,
        { id: 'v', type: 'verweis', props: { art: 'offene-aufgaben' }, children: [] },
      ],
    });
    zeige();
    await screen.findByText('bearbeitbar');
    fireEvent.click(screen.getByRole('button', { name: 'Lesen' }));
    expect(screen.getByText('Beamer von früher')).toBeTruthy();
    expect(screen.queryByText('Nur ein Vorschlag')).toBeNull();
  });

  it('Mitgliederliste verborgen: im festen Punkt steht bei eigenen To-Dos trotzdem der eigene Name (S7-2a)', async () => {
    vi.mocked(M.ladeGruppenMitglieder).mockResolvedValueOnce('verborgen');
    vi.mocked(W.mitarbeitRoh).mockResolvedValueOnce([
      {
        wert: 1,
        x: neueAufgabe({
          id: 'frueher',
          gruppe: 194,
          sitzung: 'alt',
          text: 'Beamer von früher',
          wer: [1],
          von: 7,
          am: '2026-10-01T10:00:00Z',
        }),
      },
    ]);
    lesen.mockResolvedValue({
      kopf: KOPF,
      dokument: [
        ...DOK,
        { id: 'v', type: 'verweis', props: { art: 'offene-aufgaben' }, children: [] },
      ],
    });
    zeige();
    await screen.findByText('bearbeitbar');
    fireEvent.click(screen.getByRole('button', { name: 'Lesen' }));
    expect(screen.getByText('Beamer von früher').closest('li')!.textContent).toMatch(/Alwin/);
  });

  it('Mitgliederliste lässt sich nicht laden: die Blöcke sehen „verborgen“, nicht ewig „werden geladen“', async () => {
    vi.mocked(M.ladeGruppenMitglieder).mockRejectedValueOnce(new TypeError('Failed to fetch'));
    zeige();
    await screen.findByText('bearbeitbar');
    await waitFor(() => expect(screen.getByTestId('mitglieder').textContent).toBe('"verborgen"'));
  });

  it('„Lesen“ nach dem Tippen speichert sofort – nicht erst nach der Pause', async () => {
    vi.mocked(S.sperreNehmen).mockResolvedValue({ art: 'ok', kopf: KOPF });
    vi.mocked(S.speichern).mockClear();
    vi.mocked(S.speichern).mockResolvedValue({ art: 'ok', kopf: { ...KOPF, stand: 'b' } });
    zeige();
    // Die erste Eingabe nimmt die Sperre und speichert gleich; die zweite wartet die Pause (3 s) ab …
    fireEvent.click(await screen.findByRole('button', { name: 'tippen' }));
    await waitFor(() => expect(S.speichern).toHaveBeenCalledTimes(1));
    await screen.findByText(/gespeichert/);
    fireEvent.click(screen.getByRole('button', { name: 'tippen' }));
    expect(screen.getByText('Änderungen …')).toBeTruthy();
    // … „Lesen“ wartet nicht: gespeichert, bevor die Pause um wäre.
    fireEvent.click(screen.getByRole('button', { name: 'Lesen' }));
    await waitFor(() => expect(S.speichern).toHaveBeenCalledTimes(2), { timeout: 1000 });
  });
});

describe('Vorschläge beim Schreiben (S5-4)', () => {
  const AM = '2026-10-20T10:00:00Z';
  // Vollständig wie aus `sitzungenOrdnen` – ein Ziel ohne `termin`/`treffen` wäre kein gültiger Vorschlag.
  const SITZ: Sitzung = { ...SITZUNG, termin: null, treffen: null, anfragen: [] };
  const vorschlag = (id: string, teil: Partial<Vorschlag> = {}): Vorschlag => ({
    ...neuerVorschlag({
      id,
      gruppe: 194,
      titel: `Thema ${id}`,
      text: '',
      ziel: zielVon(SITZ),
      ich: { person: 19, name: 'Peter Wiens' },
      am: AM,
    }),
    ...teil,
  });
  const ablegen = (...v: Vorschlag[]) => {
    for (const x of v) VS.stand.set(x.id, x);
    vi.mocked(W.mitarbeitRoh).mockResolvedValueOnce(v.map((x, i) => ({ wert: i + 1, x })));
  };
  const zeigeMit = (direkt: boolean) =>
    render(
      <ProtokollSchreiben
        leitung
        sitzung={SITZ}
        gruppe="Leitungsteam"
        gruppeId={194}
        modul={24}
        kategorie={62}
        mitarbeit={65}
        protokolle={[]}
        teile={[]}
        zeitzone="Europe/Berlin"
        kommend={[SITZ]}
        direkt={direkt}
        vollerName="Alwin Friesen"
        onZurueck={vi.fn()}
        ich={{ person: 1, name: 'Alwin' }}
      />,
    );
  const gespeichert = () => {
    vi.mocked(S.sperreNehmen).mockResolvedValue({ art: 'ok', kopf: KOPF });
    vi.mocked(S.speichern).mockResolvedValue({ art: 'ok', kopf: { ...KOPF, stand: 'b' } });
  };
  const stand = (id: string) => VS.stand.get(id) as Vorschlag;

  it('„Direkt eintragen“: offene Vorschläge kommen beim Öffnen hinein, werden gespeichert, DANN vermerkt', async () => {
    gespeichert();
    ablegen(vorschlag('v1'), vorschlag('v2', { stand: 'abgelehnt' }));
    zeigeMit(true);
    expect(await screen.findByText(/Ein Vorschlag wurde als Punkt am Ende eingefügt/)).toBeTruthy();
    expect(E.einfuegen).toHaveBeenCalledTimes(1);
    expect(E.einfuegen).toHaveBeenCalledWith(vorschlagBloecke(vorschlag('v1')), null);
    // Gespeichert wurde das Dokument MIT dem Punkt – erst danach steht „im Protokoll“.
    expect(vi.mocked(S.speichern).mock.calls[0][3].map((b) => b.id)).toContain('vorschlag-v1');
    expect(stand('v1')).toMatchObject({ stand: 'imProtokoll', sitzung: 's1' });
    expect(stand('v2').stand).toBe('abgelehnt');
    // Kein Kasten bei „Direkt eintragen“.
    expect(screen.queryByRole('region', { name: 'Vorschläge' })).toBeNull();
  });

  it('steht der Punkt schon drin (Vermerken scheiterte letztes Mal): nicht noch einmal, nur vermerkt', async () => {
    gespeichert();
    E.zusatz.push(...vorschlagBloecke(vorschlag('v1')));
    ablegen(vorschlag('v1'));
    zeigeMit(true);
    await waitFor(() => expect(stand('v1').stand).toBe('imProtokoll'));
    expect(E.einfuegen).not.toHaveBeenCalled();
    expect(S.speichern).not.toHaveBeenCalled();
  });

  it('Speichern scheitert: der Vorschlag bleibt offen – beim nächsten Öffnen wird er erkannt', async () => {
    vi.mocked(S.sperreNehmen).mockResolvedValue({ art: 'ok', kopf: KOPF });
    vi.mocked(S.speichern).mockRejectedValue(new Error('Netz weg'));
    ablegen(vorschlag('v1'));
    zeigeMit(true);
    expect(
      await screen.findByText(/noch nicht gespeichert – der Vorschlag steht schon drin/),
    ).toBeTruthy();
    expect(E.einfuegen).toHaveBeenCalledTimes(1);
    expect(V.vorschlagSchreiben).not.toHaveBeenCalled();
    expect(stand('v1').stand).toBe('offen');
    // „Direkt eintragen“ entscheidet nicht – auch jetzt, wo er noch offen ist, kein „Übernehmen“.
    expect(screen.queryByRole('button', { name: 'Übernehmen' })).toBeNull();
  });

  it('„Vorschlagen“: offene stehen im Kasten, angenommene kommen gleich hinein; „Übernehmen“ fügt ein und vermerkt', async () => {
    gespeichert();
    const an = annehmen(vorschlag('v2'), SITZ, { person: 1, name: 'Alwin Friesen' }, AM);
    ablegen(vorschlag('v1'), an);
    zeigeMit(false);
    const kasten = await screen.findByRole('region', { name: 'Vorschläge' });
    await waitFor(() => expect(stand('v2').stand).toBe('imProtokoll'));
    expect(E.einfuegen).toHaveBeenCalledTimes(1);
    expect(kasten.textContent).toContain('Thema v1');
    expect(kasten.textContent).not.toContain('Thema v2');
    // Kurzform (W8c): Die Knöpfe stehen erst im aufgeklappten Vorschlag.
    expect(screen.queryByRole('button', { name: 'Übernehmen' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /Thema v1/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Übernehmen' }));
    await waitFor(() => expect(stand('v1').stand).toBe('imProtokoll'));
    expect(E.einfuegen).toHaveBeenCalledTimes(2);
    expect(stand('v1').verlauf.at(-1)).toMatchObject({ art: 'imProtokoll', name: 'Alwin Friesen' });
    await waitFor(() => expect(screen.queryByRole('region', { name: 'Vorschläge' })).toBeNull());
  });

  it('„Nächstes Mal“ und „Ablehnen“ (mit Begründung) im Kasten', async () => {
    gespeichert();
    ablegen(vorschlag('v1'), vorschlag('v2'));
    zeigeMit(false);
    await screen.findByRole('region', { name: 'Vorschläge' });
    fireEvent.click(screen.getByRole('button', { name: /Thema v1/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Nächstes Mal' }));
    await waitFor(() => expect(stand('v1').ziel).toEqual({ art: 'naechste', nach: SITZ.beginn }));
    fireEvent.click(screen.getByRole('button', { name: /Thema v2/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Ablehnen' }));
    fireEvent.change(await screen.findByPlaceholderText(/Klären wir im Gemeinderat/), {
      target: { value: 'Nicht jetzt' },
    });
    fireEvent.click(screen.getAllByRole('button', { name: 'Ablehnen' }).at(-1)!);
    await waitFor(() =>
      expect(stand('v2')).toMatchObject({ stand: 'abgelehnt', grund: 'Nicht jetzt' }),
    );
    expect(E.einfuegen).not.toHaveBeenCalled();
  });
});

describe('Freigeben (S6-1)', () => {
  const MIT_TREFFEN = { ...KOPF, treffen: 15 };
  const zeigeFrei = (onFreigegeben = vi.fn()) => {
    render(
      <ProtokollSchreiben
        leitung
        sitzung={{ ...SITZUNG, kopf: MIT_TREFFEN }}
        gruppe="Leitungsteam"
        gruppeId={194}
        modul={24}
        kategorie={62}
        mitarbeit={65}
        protokolle={[]}
        teile={[]}
        zeitzone="Europe/Berlin"
        vollerName="Alwin Friesen"
        onFreigegeben={onFreigegeben}
        onZurueck={vi.fn()}
        ich={{ person: 1, name: 'Alwin' }}
      />,
    );
    return onFreigegeben;
  };
  const oeffnen = async () => {
    fireEvent.click(await screen.findByRole('button', { name: 'Protokoll freigeben' }));
    return screen.findByRole('dialog');
  };
  const freigabeKlick = async () => {
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /^Freigeben$/ })).toHaveProperty('disabled', false),
    );
    fireEvent.click(screen.getByRole('button', { name: /^Freigeben$/ }));
  };

  beforeEach(() => {
    lesen.mockResolvedValue({ kopf: MIT_TREFFEN, dokument: DOK });
    vi.mocked(S.sperreNehmen).mockResolvedValue({ art: 'ok', kopf: MIT_TREFFEN });
    vi.mocked(S.speichern).mockResolvedValue({ art: 'ok', kopf: MIT_TREFFEN });
  });

  it('Fenster mit Hinweisen; Freigeben schreibt frei (voller Name), schließt das Treffen ab, dann zum Lesen', async () => {
    vi.mocked(S.freigeben).mockResolvedValue({
      art: 'ok',
      kopf: { ...MIT_TREFFEN, status: 'frei' },
    });
    const fertig = zeigeFrei();
    const d = await oeffnen();
    expect(await within(d).findByText('Anwesenheit: 1 noch offen – geprüft?')).toBeTruthy();
    expect(within(d).getByText('Spike Musiker')).toBeTruthy();
    expect(within(d).getByText(/Gruppentreffen wird abgeschlossen/)).toBeTruthy();
    await freigabeKlick();
    await waitFor(() => expect(fertig).toHaveBeenCalled());
    const [ort, , , , wer] = vi.mocked(S.freigeben).mock.calls[0];
    expect(ort).toEqual({ modul: 24, kategorie: 62, sitzung: 's1' });
    expect(wer).toEqual({ person: 1, name: 'Alwin Friesen' });
    expect(AW.treffenAbschliessen).toHaveBeenCalledWith(194, 15);
  });

  it('Freigeben schreibt die frisch gelesene Anwesenheit als Schnappschuss ins Protokoll (W16)', async () => {
    vi.mocked(S.freigeben).mockResolvedValue({
      art: 'ok',
      kopf: { ...MIT_TREFFEN, status: 'frei' },
    });
    E.zusatz.push({ id: 'anw', type: 'verweis', props: { art: 'anwesenheit' }, children: [] });
    const fertig = zeigeFrei();
    const d = await oeffnen();
    await within(d).findByText('Anwesenheit: 1 noch offen – geprüft?');
    await freigabeKlick();
    await waitFor(() => expect(fertig).toHaveBeenCalled());
    const anw = vi.mocked(S.freigeben).mock.calls[0][3].find((b) => b.id === 'anw');
    expect(JSON.parse(String(anw?.props?.schnappschuss))).toEqual({
      personen: [
        { person: 1, name: 'Alwin Friesen', status: 'da' },
        { person: 19, name: 'Spike Musiker', status: 'offen' },
      ],
    });
  });

  it('Treffen lässt sich nicht abschließen: „freigegeben“ mit „Nochmal versuchen“ – klappt es dann, weiter', async () => {
    vi.mocked(S.freigeben).mockResolvedValue({
      art: 'ok',
      kopf: { ...MIT_TREFFEN, status: 'frei' },
    });
    vi.mocked(AW.treffenAbschliessen).mockRejectedValueOnce(new Error('weg'));
    const fertig = zeigeFrei();
    await oeffnen();
    await freigabeKlick();
    expect(await screen.findByText(/Das Protokoll ist freigegeben/)).toBeTruthy();
    expect(fertig).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Nochmal versuchen' }));
    await waitFor(() => expect(fertig).toHaveBeenCalled());
    expect(AW.treffenAbschliessen).toHaveBeenCalledTimes(2);
    expect(S.freigeben).toHaveBeenCalledTimes(1);
  });

  it('abgewiesen (jemand anderes schreibt): Meldung im Fenster, nicht freigegeben, Treffen bleibt', async () => {
    vi.mocked(S.freigeben).mockResolvedValue({
      art: 'gesperrt',
      sperre: sperreVon({ person: 7, name: 'Johann', fenster: 'j' }, new Date()),
    });
    const fertig = zeigeFrei();
    await oeffnen();
    await freigabeKlick();
    expect(await screen.findByText(/Johann schreibt gerade/)).toBeTruthy();
    expect(fertig).not.toHaveBeenCalled();
    expect(AW.treffenAbschliessen).not.toHaveBeenCalled();
  });

  it('schreibt jemand anderes: kein „Freigeben“', async () => {
    const johann = sperreVon({ person: 7, name: 'Johann', fenster: 'j' }, new Date());
    lesen.mockResolvedValue({ kopf: { ...MIT_TREFFEN, sperre: johann }, dokument: DOK });
    zeigeFrei();
    await screen.findByText('Johann schreibt gerade.');
    expect(screen.queryByRole('button', { name: 'Protokoll freigeben' })).toBeNull();
  });

  describe('Beitrag in der Gruppe (S6-2)', () => {
    const frei = () =>
      vi.mocked(S.freigeben).mockResolvedValue({
        art: 'ok',
        kopf: { ...MIT_TREFFEN, status: 'frei' },
      });
    const haekchen = (d: HTMLElement) =>
      within(d).findByRole('checkbox', { name: /In der Gruppe Bescheid geben/ });

    it('darf man schreiben: Häkchen an, Vorschau; Freigeben erstellt den Beitrag mit Link auf die Sitzung', async () => {
      frei();
      vi.mocked(BS.beitragMoeglich).mockResolvedValueOnce(true);
      const fertig = zeigeFrei();
      const d = await oeffnen();
      expect(await haekchen(d)).toHaveProperty('checked', true);
      expect(within(d).getByText(/Ein Beitrag in „Leitungsteam“ von dir/)).toBeTruthy();
      expect(within(d).getByText('Protokoll vom 24.10.2026 ist freigegeben')).toBeTruthy();
      expect(
        within(d).getByText('Das Protokoll „Leitungssitzung“ vom Sa, 24.10.2026 ist freigegeben.'),
      ).toBeTruthy();
      await freigabeKlick();
      await waitFor(() => expect(fertig).toHaveBeenCalled());
      expect(BS.beitragMoeglich).toHaveBeenCalledWith(194);
      const [gruppe, b] = vi.mocked(BS.beitragSchritt).mock.calls[0];
      expect(gruppe).toBe(194);
      expect(b.titel).toBe('Protokoll vom 24.10.2026 ist freigegeben');
      expect(b.link).toMatch(/\/ccm\/protokolle\/#\/sitzungen\/194\/s1$/);
      expect(BT.schritt).toHaveBeenCalledTimes(1);
      expect(AW.treffenAbschliessen).toHaveBeenCalledTimes(1);
    });

    it('Häkchen aus: kein Beitrag, Vorschau weg', async () => {
      frei();
      vi.mocked(BS.beitragMoeglich).mockResolvedValueOnce(true);
      const fertig = zeigeFrei();
      const d = await oeffnen();
      fireEvent.click(await haekchen(d));
      expect(within(d).queryByText('Protokoll vom 24.10.2026 ist freigegeben')).toBeNull();
      await freigabeKlick();
      await waitFor(() => expect(fertig).toHaveBeenCalled());
      expect(BS.beitragSchritt).not.toHaveBeenCalled();
    });

    it('darf man nicht schreiben: kein Häkchen, keine Vorschau, kein Beitrag', async () => {
      frei();
      const fertig = zeigeFrei();
      const d = await oeffnen();
      await waitFor(() =>
        expect(screen.getByRole('button', { name: /^Freigeben$/ })).toHaveProperty(
          'disabled',
          false,
        ),
      );
      expect(within(d).queryByRole('checkbox')).toBeNull();
      expect(within(d).queryByText(/ist freigegeben$/)).toBeNull();
      await freigabeKlick();
      await waitFor(() => expect(fertig).toHaveBeenCalled());
      expect(BS.beitragSchritt).not.toHaveBeenCalled();
    });

    it('ließ es sich nicht prüfen: kein Häkchen, Freigeben geht', async () => {
      frei();
      vi.mocked(BS.beitragMoeglich).mockRejectedValueOnce(new Error('weg'));
      const fertig = zeigeFrei();
      const d = await oeffnen();
      await freigabeKlick();
      await waitFor(() => expect(fertig).toHaveBeenCalled());
      expect(within(d).queryByRole('checkbox')).toBeNull();
      expect(BS.beitragSchritt).not.toHaveBeenCalled();
    });

    it('„Freigeben“ wartet, bis klar ist, ob ein Beitrag geht', async () => {
      frei();
      let ja!: (x: boolean) => void;
      vi.mocked(BS.beitragMoeglich).mockReturnValueOnce(new Promise((r) => (ja = r)));
      zeigeFrei();
      const d = await oeffnen();
      await within(d).findByText('Anwesenheit: 1 noch offen – geprüft?');
      expect(screen.getByRole('button', { name: /^Freigeben$/ })).toHaveProperty('disabled', true);
      ja(true);
      await haekchen(d);
      expect(screen.getByRole('button', { name: /^Freigeben$/ })).toHaveProperty('disabled', false);
    });

    it('Beitrag scheitert: „freigegeben“ mit „Nochmal versuchen“ – das wiederholt nur den Beitrag, nicht das Treffen', async () => {
      frei();
      vi.mocked(BS.beitragMoeglich).mockResolvedValueOnce(true);
      BT.schritt.mockRejectedValueOnce(new Error('weg'));
      const fertig = zeigeFrei();
      await oeffnen();
      await freigabeKlick();
      expect(await screen.findByText(/ließ sich aber nicht erstellen/)).toBeTruthy();
      expect(fertig).not.toHaveBeenCalled();
      fireEvent.click(screen.getByRole('button', { name: 'Nochmal versuchen' }));
      await waitFor(() => expect(fertig).toHaveBeenCalled());
      expect(BT.schritt).toHaveBeenCalledTimes(2);
      expect(AW.treffenAbschliessen).toHaveBeenCalledTimes(1);
      expect(S.freigeben).toHaveBeenCalledTimes(1);
    });

    it('Treffen und Beitrag scheitern: beide genannt; ist die Antwort zum Beitrag unklar, wiederholt „Nochmal“ nur das Treffen', async () => {
      frei();
      vi.mocked(BS.beitragMoeglich).mockResolvedValueOnce(true);
      vi.mocked(AW.treffenAbschliessen).mockRejectedValueOnce(new Error('weg'));
      BT.schritt.mockRejectedValueOnce(new Unklar('Bitte in der Gruppe nachsehen.'));
      const fertig = zeigeFrei();
      await oeffnen();
      await freigabeKlick();
      expect(await screen.findByText(/ließ sich aber nicht abschließen/)).toBeTruthy();
      expect(screen.getByText(/Bitte in der Gruppe nachsehen/)).toBeTruthy();
      fireEvent.click(screen.getByRole('button', { name: 'Nochmal versuchen' }));
      await waitFor(() => expect(fertig).toHaveBeenCalled());
      expect(AW.treffenAbschliessen).toHaveBeenCalledTimes(2);
      expect(BT.schritt).toHaveBeenCalledTimes(1);
    });

    it('nur der Beitrag unklar: kein „Nochmal versuchen“, nur „Schließen“', async () => {
      frei();
      vi.mocked(BS.beitragMoeglich).mockResolvedValueOnce(true);
      BT.schritt.mockRejectedValueOnce(new Unklar('Bitte in der Gruppe nachsehen.'));
      const fertig = zeigeFrei();
      await oeffnen();
      await freigabeKlick();
      expect(await screen.findByText(/Bitte in der Gruppe nachsehen/)).toBeTruthy();
      expect(screen.queryByRole('button', { name: 'Nochmal versuchen' })).toBeNull();
      fireEvent.click(screen.getByRole('button', { name: 'Schließen' }));
      expect(fertig).toHaveBeenCalled();
      expect(BT.schritt).toHaveBeenCalledTimes(1);
    });
  });
});

describe('Teilen / PDF im Editor (S6-3b)', () => {
  it('teilt, was im Editor steht – auch noch nicht Gespeichertes; Entwurf, Mitglieder nicht noch einmal gelesen', async () => {
    BLAETTER.length = 0;
    vi.mocked(S.sperreNehmen).mockResolvedValue({ art: 'ok', kopf: KOPF });
    vi.mocked(S.speichern).mockResolvedValue({ art: 'ok', kopf: { ...KOPF, stand: 'b' } });
    vi.mocked(M.ladeGruppenMitglieder).mockClear();
    render(
      <ProtokollSchreiben
        leitung
        sitzung={SITZUNG}
        gruppe="Leitungsteam"
        gruppeId={194}
        modul={24}
        kategorie={62}
        mitarbeit={65}
        protokolle={[]}
        teile={[]}
        zeitzone="Europe/Berlin"
        ich={{ person: 1, name: 'Alwin' }}
        teilen={{
          gemeinde: 'ECG Donrath',
          ich: { person: 1, name: 'Alwin Friesen' },
          naechste: null,
        }}
        onZurueck={vi.fn()}
      />,
    );
    await screen.findByText('bearbeitbar');
    fireEvent.click(screen.getByRole('button', { name: 'tippen' }));
    fireEvent.click(screen.getByRole('button', { name: /Teilen \/ PDF/ }));
    expect(await screen.findByRole('dialog', { name: 'Protokoll teilen' })).toBeTruthy();
    expect(await screen.findByText(/Protokoll Leitungsteam 2026-10-24 ENTWURF\.pdf/)).toBeTruthy();
    const b = BLAETTER.at(-1) as { entwurf: boolean; teile: unknown[] };
    expect(b.entwurf).toBe(true);
    expect(JSON.stringify(b.teile)).toContain('Beamer');
    expect(M.ladeGruppenMitglieder).toHaveBeenCalledTimes(1);
  });

  it('ohne Teilen-Rahmen kein Knopf', async () => {
    zeige();
    await screen.findByText('bearbeitbar');
    expect(screen.queryByRole('button', { name: /Teilen \/ PDF/ })).toBeNull();
  });
});

describe('Mit KI füllen (S8-2)', () => {
  const KI = { name: /Mit KI füllen/ };
  // Mit „Bearbeiten“, damit die Knopfreihe im Kopf auch ohne Schreibrecht da ist – sonst fehlte der Knopf nur, weil die ganze
  // Reihe fehlt, und die Prüfung „kein Knopf“ bewiese nichts.
  const zeigeKi = () =>
    render(
      <ProtokollSchreiben
        leitung
        onBearbeiten={vi.fn()}
        sitzung={SITZUNG}
        gruppe="Leitungsteam"
        gruppeId={194}
        modul={24}
        kategorie={62}
        mitarbeit={65}
        protokolle={[]}
        teile={[]}
        zeitzone="Europe/Berlin"
        onZurueck={vi.fn()}
        ich={{ person: 1, name: 'Alwin' }}
      />,
    );

  beforeEach(() => {
    vi.mocked(S.sperreNehmen).mockResolvedValue({ art: 'ok', kopf: KOPF });
    vi.mocked(S.speichern).mockResolvedValue({ art: 'ok', kopf: { ...KOPF, stand: 'b' } });
    E.einfuegen.mockClear();
  });

  it('der Knopf steht im Kopf eines Entwurfs, wenn man schreiben darf – zwischen Freigeben und Bearbeiten', async () => {
    const onBearbeiten = vi.fn();
    render(
      <ProtokollSchreiben
        leitung
        onBearbeiten={onBearbeiten}
        sitzung={SITZUNG}
        gruppe="Leitungsteam"
        gruppeId={194}
        modul={24}
        kategorie={62}
        mitarbeit={65}
        protokolle={[]}
        teile={[]}
        zeitzone="Europe/Berlin"
        onZurueck={vi.fn()}
        ich={{ person: 1, name: 'Alwin' }}
      />,
    );
    const ki = await screen.findByRole('button', KI);
    const namen = [...ki.parentElement!.querySelectorAll('button')].map((b) =>
      b.getAttribute('aria-label'),
    );
    expect(namen[0]).toBe('Protokoll freigeben');
    expect(namen[1]).toMatch(/Mit KI füllen/);
    expect(namen[2]).toMatch(/Sitzung bearbeiten/);
  });

  it('schreibt jemand anderes: kein Knopf', async () => {
    const johann = sperreVon({ person: 7, name: 'Johann', fenster: 'j' }, new Date());
    lesen.mockResolvedValue({ kopf: { ...KOPF, sperre: johann }, dokument: DOK });
    zeigeKi();
    await screen.findByText('Johann schreibt gerade.');
    expect(screen.queryByRole('button', KI)).toBeNull();
  });

  it('freigegeben (Lese-Ansicht): kein Knopf', async () => {
    lesen.mockResolvedValue({ kopf: { ...KOPF, status: 'frei' }, dokument: DOK });
    zeigeKi();
    await screen.findByText(/freigegeben und lässt sich nicht mehr ändern/);
    expect(screen.queryByRole('button', KI)).toBeNull();
  });

  it('„Lesen“ im Editor: der Knopf geht weg (der Editor ist dann ausgeblendet)', async () => {
    zeigeKi();
    await screen.findByRole('button', KI);
    fireEvent.click(screen.getByRole('button', { name: 'Lesen' }));
    expect(screen.queryByRole('button', KI)).toBeNull();
  });

  it('der ganze Weg im Editor: Fenster auf, Antwort, Übernehmen → einfuegen am Editor, Fenster zu, Meldung, Speichern angestoßen', async () => {
    // Punkt 1 des Dokuments ist ein fester Punkt (Verweis) – ein zweiter Punkt nimmt die Stichpunkte auf.
    E.zusatz.push({
      id: 'h9',
      type: 'heading',
      props: { level: 1 },
      content: [{ type: 'text', text: 'Zweiter Punkt', styles: {} }],
      children: [],
    });
    zeigeKi();
    fireEvent.click(await screen.findByRole('button', KI));
    const tx = await screen.findByLabelText('Transkript');
    fireEvent.change(tx, { target: { value: 'Johann Becker bringt den Beamer mit.' } });
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /Auftrag kopieren/ })).toHaveProperty(
        'disabled',
        false,
      ),
    );
    // Johann ist Mitglied der Gruppe (Attrappe `./mitglieder`) – sein Platzhalter macht ihn zum Zuständigen.
    fireEvent.click(screen.getByRole('button', { name: 'Weiter: Antwort einfügen' }));
    fireEvent.change(await screen.findByLabelText('Antwort der KI'), {
      target: {
        value: JSON.stringify({
          punkte: [{ nr: '2', stichpunkte: ['[Person 1] bringt den Beamer mit.'] }],
        }),
      },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Vorschau ansehen' }));
    expect(await screen.findByText('→ 2. Zweiter Punkt')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Ausgewählte übernehmen (1)' }));
    expect(E.einfuegen).toHaveBeenCalledTimes(1);
    const [bloecke, vor] = E.einfuegen.mock.calls[0] as [
      { type: string; content: { text: string }[] }[],
      string | null,
    ];
    expect(vor).toBeNull();
    expect(bloecke[0].type).toBe('bulletListItem');
    expect(bloecke[0].content[0].text).toBe('Johann Becker bringt den Beamer mit.');
    await waitFor(() => expect(screen.queryByLabelText('Transkript')).toBeNull());
    expect(
      await screen.findByText(/1 Eintrag übernommen – das Protokoll speichert automatisch/),
    ).toBeTruthy();
    // Die Änderung wird gespeichert (Sperre nehmen + speichern), nicht nur gemeldet.
    await waitFor(() => expect(vi.mocked(S.speichern)).toHaveBeenCalled());
  });
});

describe('Protokoll löschen im Editor (W6)', () => {
  const loeschen = vi.mocked(LO.protokollLoeschen);
  const bereit = () => screen.findByRole('button', { name: 'Protokoll löschen' });
  const rueckfrage = () => screen.getByRole('dialog', { name: 'Protokoll löschen?' });
  const loeschenKnopf = () =>
    within(rueckfrage()).getByRole('button', { name: /^(Löschen|Nochmal)/ });

  beforeEach(() => {
    loeschen.mockReset();
    loeschen.mockResolvedValue({ art: 'ok' });
    vi.mocked(S.sperreNehmen).mockResolvedValue({ art: 'ok', kopf: KOPF });
    vi.mocked(S.speichern).mockResolvedValue({ art: 'ok', kopf: { ...KOPF, stand: 'b' } });
  });

  it('der Knopf steht im Kopf, wenn „Löschen“ gereicht wird (Leitung) – sonst gibt es ihn nicht', async () => {
    const r = zeige(vi.fn(), undefined, vi.fn());
    fireEvent.click(await bereit());
    expect(rueckfrage()).toBeTruthy();
    r.unmount();
    zeige();
    await screen.findByText(/Entwurf – noch nicht freigegeben/);
    expect(screen.queryByRole('button', { name: 'Protokoll löschen' })).toBeNull();
  });

  it('Löschen: mit dem Schreib-Fenster dieses Editors (seine Sperre steht nicht im Weg), dann zurück zur Liste', async () => {
    const onGeloescht = vi.fn();
    zeige(vi.fn(), undefined, onGeloescht);
    await screen.findByText('bearbeitbar');
    fireEvent.click(await bereit());
    fireEvent.click(loeschenKnopf());
    await waitFor(() => expect(onGeloescht).toHaveBeenCalledTimes(1));
    const plan = loeschen.mock.calls[0][0];
    expect(plan.ort).toEqual({ modul: 24, kategorie: 62, sitzung: 's1' });
    expect(plan.ich).toMatchObject({ person: 1, name: 'Alwin' });
    expect(plan.ich.fenster).toBeTruthy();
    expect(plan.mitarbeit).toEqual({ modul: 24, kategorie: 65 });
  });

  it('der Editor schreibt nicht mehr, sobald gelöscht wird: ein laufendes Speichern wird abgewartet, dann erst gelöscht', async () => {
    let fertig!: () => void;
    vi.mocked(S.speichern).mockImplementation(
      () =>
        new Promise((r) => {
          fertig = () => r({ art: 'ok', kopf: { ...KOPF, stand: 'b' } });
        }),
    );
    zeige(vi.fn(), undefined, vi.fn());
    fireEvent.click(await screen.findByRole('button', { name: 'tippen' }));
    await waitFor(() => expect(S.speichern).toHaveBeenCalledTimes(1));
    fireEvent.click(await bereit());
    fireEvent.click(loeschenKnopf());
    await new Promise((r) => setTimeout(r, 30));
    expect(loeschen).not.toHaveBeenCalled(); // das Speichern läuft noch
    fertig();
    await waitFor(() => expect(loeschen).toHaveBeenCalledTimes(1));
  });

  it('Löschen scheitert und das Fenster wird abgebrochen: der Editor speichert danach wieder', async () => {
    loeschen.mockRejectedValue(new Error('Netz'));
    zeige(vi.fn(), undefined, vi.fn());
    fireEvent.click(await bereit());
    fireEvent.click(loeschenKnopf());
    await within(rueckfrage()).findByRole('alert');
    fireEvent.click(within(rueckfrage()).getByRole('button', { name: 'Abbrechen' }));
    expect(screen.queryByRole('dialog', { name: 'Protokoll löschen?' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'tippen' }));
    await waitFor(() => expect(S.speichern).toHaveBeenCalled());
  });

  it('nach dem Löschen speichert der Editor nicht mehr und gibt keine Sperre frei (es gibt keinen Kopf mehr)', async () => {
    const onGeloescht = vi.fn();
    const r = zeige(vi.fn(), undefined, onGeloescht);
    fireEvent.click(await screen.findByRole('button', { name: 'tippen' }));
    await waitFor(() => expect(S.speichern).toHaveBeenCalled());
    vi.mocked(S.sperreFreigeben).mockClear();
    vi.mocked(S.speichern).mockClear();
    fireEvent.click(await bereit());
    fireEvent.click(loeschenKnopf());
    await waitFor(() => expect(onGeloescht).toHaveBeenCalled());
    r.unmount();
    // Das Aufräumen beim Schließen läuft asynchron (`jetzt()`, dann `sperreFreigeben`) – kurz warten, sonst misst der Test zu früh.
    await new Promise((x) => setTimeout(x, 30));
    expect(S.sperreFreigeben).not.toHaveBeenCalled();
    expect(S.speichern).not.toHaveBeenCalled();
  });
});

/**
 * **Mitlesen im Editor** (W16): alle 10 s, solange jemand anderes schreibt oder niemand schreibt und man selbst nichts
 * geändert hat – nie, solange man selbst schreibt; Pause bei verdecktem Fenster. Fake-Timer: Mit echten Timern bewiese
 * ein Test nichts über den Takt.
 */
describe('ProtokollSchreiben – Mitlesen (W16)', () => {
  let verdeckt = false;
  beforeEach(() => {
    vi.useFakeTimers();
    verdeckt = false;
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => verdeckt });
  });
  afterEach(() => {
    vi.useRealTimers();
  });
  // Die Attrappen antworten sofort – es reicht, die anstehenden Versprechen abzuarbeiten.
  const warten = (ms = 0) => act(() => vi.advanceTimersByTimeAsync(ms));
  const johann = () => sperreVon({ person: 7, name: 'Johann', fenster: 'j' }, new Date());
  const DOK2 = [{ id: 'h2', type: 'heading', props: { level: 1 }, content: 'Neu', children: [] }];

  it('jemand anderes schreibt: alle 10 s frisch gelesen, der neue Text kommt in denselben Editor', async () => {
    lesen.mockResolvedValue({ kopf: { ...KOPF, sperre: johann() }, dokument: DOK });
    zeige();
    await warten();
    const editor = screen.getByTestId('editor');
    expect(editor.textContent).toBe('nur lesen');
    expect(lesen).toHaveBeenCalledTimes(1);
    lesen.mockResolvedValue({ kopf: { ...KOPF, stand: 'b', sperre: johann() }, dokument: DOK2 });
    await warten(9_999);
    expect(lesen).toHaveBeenCalledTimes(1);
    await warten(1);
    expect(lesen).toHaveBeenCalledTimes(2);
    expect(E.ersetzt).toEqual([DOK2]);
    // Derselbe Editor (nicht neu aufgebaut, kein „Wird geladen“) – sonst spränge die Seite nach oben.
    expect(screen.getByTestId('editor')).toBe(editor);
    expect(screen.getByText('Johann schreibt gerade.')).toBeTruthy();
    expect(screen.getByText(/aktualisiert sich alle 10 Sekunden/)).toBeTruthy();
    // Gleicher Stand beim nächsten Mal: nichts ersetzt.
    await warten(10_000);
    expect(lesen).toHaveBeenCalledTimes(3);
    expect(E.ersetzt).toHaveLength(1);
  });

  it('Fenster verdeckt: kein Lesen – beim Zurückkommen sofort', async () => {
    lesen.mockResolvedValue({ kopf: { ...KOPF, sperre: johann() }, dokument: DOK });
    zeige();
    await warten();
    verdeckt = true;
    document.dispatchEvent(new Event('visibilitychange'));
    await warten(60_000);
    expect(lesen).toHaveBeenCalledTimes(1);
    verdeckt = false;
    document.dispatchEvent(new Event('visibilitychange'));
    await warten();
    expect(lesen).toHaveBeenCalledTimes(2);
  });

  it('niemand schreibt, man selbst hat nichts geändert: fängt jemand an, sieht man es von selbst', async () => {
    zeige();
    await warten();
    expect(screen.getByTestId('editor').textContent).toBe('bearbeitbar');
    lesen.mockResolvedValue({ kopf: { ...KOPF, stand: 'b', sperre: johann() }, dokument: DOK2 });
    await warten(10_000);
    expect(lesen).toHaveBeenCalledTimes(2);
    expect(E.ersetzt).toEqual([DOK2]);
    expect(screen.getByText('Johann schreibt gerade.')).toBeTruthy();
    expect(screen.getByTestId('editor').textContent).toBe('nur lesen');
  });

  it('man schreibt selbst: kein Mitlesen', async () => {
    vi.mocked(S.sperreNehmen).mockResolvedValue({ art: 'ok', kopf: { ...KOPF, stand: 'x' } });
    vi.mocked(S.speichern).mockResolvedValue({ art: 'ok', kopf: { ...KOPF, stand: 'y' } });
    zeige();
    await warten();
    fireEvent.click(screen.getByText('tippen'));
    await warten(5_000); // Sperre genommen und gespeichert
    const bisher = lesen.mock.calls.length;
    await warten(60_000);
    expect(lesen).toHaveBeenCalledTimes(bisher);
    expect(E.ersetzt).toHaveLength(0);
  });

  it('neuer Stand, aber gerade nicht vollständig lesbar: nichts übernommen – beim nächsten Mal schon', async () => {
    lesen.mockResolvedValue({ kopf: { ...KOPF, sperre: johann() }, dokument: DOK });
    zeige();
    await warten();
    lesen.mockResolvedValue({ kopf: { ...KOPF, stand: 'b', sperre: johann() }, dokument: null });
    await warten(10_000);
    expect(E.ersetzt).toHaveLength(0);
    lesen.mockResolvedValue({ kopf: { ...KOPF, stand: 'b', sperre: johann() }, dokument: DOK2 });
    await warten(10_000);
    // Hätte der erste Abruf den Stand „b“ schon übernommen, gälte der Text jetzt als bekannt und käme nie an.
    expect(E.ersetzt).toEqual([DOK2]);
  });
});

/**
 * **„Schreibt mit“ im Editor** (W16): schreibt den Entwurf, füllt mit KI, übernimmt Vorschläge – aber kein Freigeben, kein
 * Löschen, kein Ablehnen, und in „Offene To-Dos“ nur die Haken eines Mitarbeiters (W9). Jeweils mit der Leitung als Gegenstück.
 */
describe('Schreibt mit (W16)', () => {
  const SITZ: Sitzung = { ...SITZUNG, termin: null, treffen: null, anfragen: [] };
  const zeigeAls = (leitung: boolean) => {
    const v = neuerVorschlag({
      id: 'v1',
      gruppe: 194,
      titel: 'Thema v1',
      text: '',
      ziel: zielVon(SITZ),
      ich: { person: 19, name: 'Peter Wiens' },
      am: '2026-10-20T10:00:00Z',
    });
    VS.stand.set('v1', v);
    vi.mocked(W.mitarbeitRoh).mockResolvedValueOnce([{ wert: 1, x: v }]);
    return render(
      <ProtokollSchreiben
        leitung={leitung}
        sitzung={SITZ}
        gruppe="Leitungsteam"
        gruppeId={194}
        modul={24}
        kategorie={62}
        mitarbeit={65}
        protokolle={[]}
        teile={[]}
        zeitzone="Europe/Berlin"
        kommend={[SITZ]}
        onGeloescht={vi.fn()}
        onZurueck={vi.fn()}
        ich={{ person: 1, name: 'Alwin' }}
      />,
    );
  };

  it('kein Freigeben und kein Löschen – „Mit KI füllen“ schon', async () => {
    const r = zeigeAls(false);
    expect(await screen.findByRole('button', { name: /Mit KI füllen/ })).toBeTruthy();
    expect(screen.getByTestId('editor').textContent).toBe('bearbeitbar');
    expect(screen.queryByRole('button', { name: 'Protokoll freigeben' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Protokoll löschen' })).toBeNull();
    r.unmount();
    zeigeAls(true);
    expect(await screen.findByRole('button', { name: 'Protokoll freigeben' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Protokoll löschen' })).toBeTruthy();
  });

  it('Vorschläge: übernehmen und aufs nächste Mal ja, ablehnen nur die Leitung', async () => {
    const aufklappen = async () =>
      fireEvent.click(await screen.findByRole('button', { name: /Thema v1/ }));
    const r = zeigeAls(false);
    await aufklappen();
    expect(screen.getByRole('button', { name: 'Übernehmen' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Nächstes Mal' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Ablehnen' })).toBeNull();
    r.unmount();
    zeigeAls(true);
    await aufklappen();
    expect(screen.getByRole('button', { name: 'Ablehnen' })).toBeTruthy();
  });

  it('„Offene To-Dos“: abhaken nur, was ein Mitarbeiter darf – die Leitung alles', async () => {
    const fremd = neueAufgabe({
      id: 'f',
      gruppe: 194,
      sitzung: 'alt',
      text: 'Fremd',
      von: 7,
      am: '2026-10-01T10:00:00Z',
    });
    const eigen = { ...fremd, id: 'e', wer: [1] };
    const anderer = { ...fremd, id: 'a', wer: [7] };
    const darf = () => E.feste?.darfHaken;
    const r = zeigeAls(false);
    await screen.findByTestId('editor');
    expect(darf()?.(eigen)).toBe(true);
    expect(darf()?.(anderer)).toBe(false);
    r.unmount();
    zeigeAls(true);
    await screen.findByTestId('editor');
    expect(darf()).toBeUndefined(); // Leitung: alle
  });
});
