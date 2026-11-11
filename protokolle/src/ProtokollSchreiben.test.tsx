// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
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
import {
  annehmen,
  neuerVorschlag,
  vorschlagBloecke,
  zielVon,
  type Vorschlag,
} from '@shared/protokolle/vorschlaege';
import * as V from './vorschlaegeSchreiben';
import { ProtokollSchreiben } from './ProtokollSchreiben';

/** Der Bildschirm „Protokoll schreiben“ (S4-1) – Schreiben bei ChurchTools und der Editor sind Attrappen. */
// Was der Editor über `einfuegen` bekam (S5-4) – es steht danach in seinem Dokument.
const E = vi.hoisted(() => ({ einfuegen: vi.fn(), zusatz: [] as unknown[] }));
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
      useImperativeHandle(griff, () => ({
        dokument: () => [...MIT_AUFGABE, ...E.zusatz],
        ersetzen: () => undefined,
        einfuegen: (b: unknown[], vor: string | null) => {
          E.einfuegen(b, vor);
          E.zusatz.push(...b);
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

const zeige = (onZurueck = vi.fn(), onBearbeiten?: () => void) => {
  const props = {
    onBearbeiten,
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
  const r = render(<ProtokollSchreiben {...props} ich={{ person: 1, name: 'Alwin' }} />);
  // Die Liste dahinter zeichnet neu und reicht dabei neue Objekte herein – das darf den Editor nicht neu laden.
  const neuZeichnen = () =>
    r.rerender(<ProtokollSchreiben {...props} ich={{ person: 1, name: 'Alwin' }} />);
  return { ...r, neuZeichnen };
};

beforeEach(() => {
  lesen.mockResolvedValue({ kopf: KOPF, dokument: DOK });
  E.zusatz.length = 0;
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
    fireEvent.click(screen.getAllByRole('button', { name: 'Nächstes Mal' })[0]);
    await waitFor(() => expect(stand('v1').ziel).toEqual({ art: 'naechste', nach: SITZ.beginn }));
    fireEvent.click(screen.getAllByRole('button', { name: 'Ablehnen' })[0]);
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
});
