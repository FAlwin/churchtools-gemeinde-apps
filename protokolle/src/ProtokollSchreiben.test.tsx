// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { BLOCKNOTE_DOKUMENT } from '@shared/protokolle/dokument.testdaten';
import { sperreVon, type ProtokollKopf } from '@shared/protokolle/speicher';
import type { Sitzung } from '@shared/protokolle/sitzungen';
import * as S from './schreiben';
import { ProtokollSchreiben } from './ProtokollSchreiben';

/** Der Bildschirm „Protokoll schreiben“ (S4-1) – Schreiben bei ChurchTools und der Editor sind Attrappen. */
vi.mock('./schreiben', () => ({
  protokollLesen: vi.fn(),
  schreibenUebernehmen: vi.fn(),
  speichern: vi.fn(),
  sperreFreigeben: vi.fn(() => Promise.resolve(true)),
  sperreNehmen: vi.fn(),
}));
vi.mock('./DokumentEditor', () => ({
  DokumentEditor: ({ bearbeitbar }: { bearbeitbar: boolean }) => (
    <div data-testid="editor">{bearbeitbar ? 'bearbeitbar' : 'nur lesen'}</div>
  ),
}));

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

const zeige = (onZurueck = vi.fn()) => {
  const props = {
    sitzung: SITZUNG,
    gruppe: 'Leitungsteam',
    modul: 24,
    kategorie: 62,
    aufgaben: [],
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
});
