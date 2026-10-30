// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { BLOCKNOTE_DOKUMENT } from '@shared/protokolle/dokument.testdaten';
import { sperreVon, type ProtokollKopf } from '@shared/protokolle/speicher';
import type { Sitzung } from '@shared/protokolle/sitzungen';
import * as M from './mitglieder';
import * as S from './schreiben';
import * as A from './aufgabenSchreiben';
import { neueAufgabe } from '@shared/protokolle/aufgaben';
import { ProtokollSchreiben } from './ProtokollSchreiben';

/** Der Bildschirm „Protokoll schreiben“ (S4-1) – Schreiben bei ChurchTools und der Editor sind Attrappen. */
vi.mock('./schreiben', () => ({
  protokollLesen: vi.fn(),
  schreibenUebernehmen: vi.fn(),
  speichern: vi.fn(),
  sperreFreigeben: vi.fn(() => Promise.resolve(true)),
  sperreNehmen: vi.fn(),
}));
vi.mock('./aufgabenSchreiben', () => ({
  aufgabenWerte: vi.fn(() => Promise.resolve([])),
  aufgabenSchreiben: vi.fn(() => Promise.resolve([])),
  aufgabeAendern: vi.fn(),
}));
vi.mock('./mitglieder', () => ({
  ladeGruppenMitglieder: vi.fn(() => Promise.resolve([{ id: 7, name: 'Johann' }])),
}));
// Der Editor als Attrappe: zeigt, ob er bearbeitbar ist, meldet auf Knopfdruck eine Eingabe und reicht den Kontext
// der Aufgaben durch (wie die Blöcke ihn sehen).
vi.mock('./DokumentEditor', async () => {
  const { useContext, useImperativeHandle } = await import('react');
  const { AufgabenKontext } = await import('./aufgabenKontext');
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
      useImperativeHandle(griff, () => ({
        dokument: () => MIT_AUFGABE,
        ersetzen: () => undefined,
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
      dokument: [...BLOCKNOTE_DOKUMENT, { id: 't', type: 'table', content: [] }],
    });
    zeige();
    expect(await screen.findByText(/noch nicht bearbeiten kann \(table\)/)).toBeTruthy();
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
    vi.mocked(A.aufgabenWerte).mockResolvedValueOnce([
      {
        wert: 1,
        aufgabe: neueAufgabe({
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

  it('Mitgliederliste verborgen: im festen Punkt steht bei eigenen To-Dos trotzdem der eigene Name (S7-2a)', async () => {
    vi.mocked(M.ladeGruppenMitglieder).mockResolvedValueOnce('verborgen');
    vi.mocked(A.aufgabenWerte).mockResolvedValueOnce([
      {
        wert: 1,
        aufgabe: neueAufgabe({
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
