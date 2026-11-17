// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { geplanterKopf } from '@shared/protokolle/planen';
import type { Sitzung } from '@shared/protokolle/sitzungen';
import type { ProtokollGruppe } from '@shared/protokolle/gruppen';
import { BLOCKNOTE_DOKUMENT } from '@shared/protokolle/dokument.testdaten';
import { teileBauen, type ProtokollTeil } from '@shared/protokolle/speicher';
import * as B from './bearbeiten';
import * as L from './lesen';
import * as LO from './loeschen';
import { Sitzungen } from './Sitzungen';

/** „Protokoll löschen“ (W6) in der Liste der Sitzungen: Einstieg aus Ansicht und Editor, danach zurück zur Liste mit Hinweis. */
vi.mock('./bearbeiten', async (orig) => ({
  ...(await orig<typeof import('./bearbeiten')>()),
  terminStand: vi.fn(),
}));
vi.mock('./lesen', async (orig) => ({
  ...(await orig<typeof import('./lesen')>()),
  ladeSitzungen: vi.fn(),
  ladeMitarbeit: vi.fn(() => Promise.resolve({ aufgaben: [], vorschlaege: [] })),
}));
vi.mock('./loeschen', async (orig) => ({
  ...(await orig<typeof import('./loeschen')>()),
  protokollLoeschen: vi.fn(),
}));
// Der Editor als Attrappe: nur „Löschen“ – was er sonst tut, prüft `ProtokollSchreiben.test.tsx`.
vi.mock('./ProtokollSchreiben', () => ({
  ProtokollSchreiben: ({
    sitzung,
    onGeloescht,
  }: {
    sitzung: { titel: string };
    onGeloescht?: () => void;
  }) => (
    <div data-testid="editor">
      <h2>{sitzung.titel}</h2>
      {onGeloescht && (
        <button type="button" onClick={onGeloescht}>
          editor-geloescht
        </button>
      )}
    </div>
  ),
}));

afterEach(cleanup);

const BEGINN = '2027-05-26T17:30:00Z';
const GRUPPE: ProtokollGruppe = {
  id: 194,
  name: 'Technik',
  lage: 'eingerichtet',
  protokolle: 62,
  mitarbeit: 63,
};
const frei = teileBauen(BLOCKNOTE_DOKUMENT, 's1');
const kopf = (status: 'geplant' | 'entwurf' | 'frei') => ({
  ...geplanterKopf({ titel: 'Leitungssitzung', beginn: BEGINN, termin: null, treffen: null }, 's1'),
  status,
  stand: frei.stand,
  ...(status === 'frei' ? { freigabe: { von: 1, am: '2027-05-27T08:00:00Z' } } : {}),
});
const sitzung = (status: 'geplant' | 'entwurf' | 'frei' | null): Sitzung => ({
  schluessel: 'p:s1',
  beginn: BEGINN,
  titel: 'Leitungssitzung',
  termin: null,
  treffen: null,
  kopf: status ? kopf(status) : null,
  anfragen: [],
});
const teile = frei.werte.map((w) => JSON.parse(w) as ProtokollTeil);
const laden = (kommend: Sitzung[], protokolle: Sitzung[] = []) =>
  vi.mocked(L.ladeSitzungen).mockResolvedValue({
    kommend,
    protokolle,
    teile,
    kalender: 4,
    treffenNichtFreigegeben: false,
    punkte: 'vorschlagen',
  });
const zeige = (schreibbar: number[], auswahl?: { gruppe: number; sitzung: string }) =>
  render(
    <Sitzungen
      modul={24}
      gruppen={[GRUPPE]}
      ich={{ person: 1, name: 'Alwin' }}
      schreibbar={schreibbar}
      auswahl={auswahl ?? null}
    />,
  );

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(B.terminStand).mockRejectedValue(new Error('nicht gebraucht'));
  vi.mocked(LO.protokollLoeschen).mockResolvedValue({ art: 'ok' });
});

describe('Protokoll löschen in der Liste', () => {
  it('Leitung, freigegebenes Protokoll: Rückfrage → gelöscht → zurück zur Liste mit Hinweis; die Sitzung steht dann „ohne Protokoll“ da', async () => {
    laden([], [sitzung('frei')]);
    zeige([62]);
    fireEvent.click(await screen.findByText(/freigegeben am/));
    fireEvent.click(await screen.findByRole('button', { name: 'Protokoll löschen' }));
    const fenster = await screen.findByRole('dialog', { name: 'Protokoll löschen?' });
    expect(within(fenster).getByText('Leitungssitzung · 26.05.2027 · freigegeben')).toBeTruthy();
    // Nach dem Löschen liest die Liste neu – die Sitzung (Termin/Treffen blieben) ohne Kopf.
    laden([{ ...sitzung(null), termin: { kalender: 4, id: 70 } }], []);
    fireEvent.click(within(fenster).getByRole('button', { name: 'Löschen' }));

    expect(await screen.findByText('Protokoll gelöscht')).toBeTruthy();
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(await screen.findByRole('heading', { name: 'Kommend' })).toBeTruthy();
    await waitFor(() =>
      expect(screen.getByText('Leitungssitzung', { selector: 'b' })).toBeTruthy(),
    );
    expect(screen.queryByText(/freigegeben am/)).toBeNull();
    expect(L.ladeSitzungen).toHaveBeenCalledTimes(2);
    expect(vi.mocked(LO.protokollLoeschen).mock.calls[0][0]).toMatchObject({
      ort: { modul: 24, kategorie: 62, sitzung: 's1' },
      gruppe: 194,
      mitarbeit: { modul: 24, kategorie: 63 },
    });
  });

  it('Entwurf im Editor: „Löschen“ des Editors führt zurück zur Liste mit Hinweis', async () => {
    laden([sitzung('entwurf')]);
    zeige([62], { gruppe: 194, sitzung: 'p:s1' });
    laden([]);
    fireEvent.click(await screen.findByRole('button', { name: 'editor-geloescht' }));
    expect(await screen.findByText('Protokoll gelöscht')).toBeTruthy();
    expect(screen.queryByTestId('editor')).toBeNull();
    expect(await screen.findByRole('heading', { name: 'Kommend' })).toBeTruthy();
  });

  it('Mitglieder (nicht die Leitung): weder in der Ansicht noch im Editor ein „Löschen“', async () => {
    laden([], [sitzung('frei')]);
    zeige([]);
    fireEvent.click(await screen.findByText(/freigegeben am/));
    await screen.findByRole('heading', { name: /Leitungssitzung/ });
    expect(screen.queryByRole('button', { name: 'Protokoll löschen' })).toBeNull();
  });

  it('ein bloß geplantes Protokoll hat keinen „Löschen“-Knopf', async () => {
    laden([sitzung('geplant')]);
    zeige([62]);
    fireEvent.click(await screen.findByText('Leitungssitzung', { selector: 'b' }));
    await screen.findByText(/Das Protokoll ist geplant/);
    expect(screen.queryByRole('button', { name: 'Protokoll löschen' })).toBeNull();
  });
});
