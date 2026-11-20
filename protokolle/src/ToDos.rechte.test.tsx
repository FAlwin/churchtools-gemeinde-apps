// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { modusSetzen, neueAufgabe, type Aufgabe } from '@shared/protokolle/aufgaben';
import type { ProtokollGruppe } from '@shared/protokolle/gruppen';
import * as L from './lesen';
import * as M from './mitglieder';
import * as S from './aufgabenSchreiben';
import { ToDos } from './ToDos';

/**
 * Rechte in der To-Do-Übersicht (W9a): Was ein Mitglied an Karte und Zeile bedienen kann – abhaken nur, wo `toDoRechte` es
 * erlaubt, „Das mache ich“ nur bei To-Dos ohne Zuständigen. Der Schreibweg (`aufgabeAendern`) ist eine Attrappe, die die
 * Änderung auf den Stand anwendet, den die Seite zeigt – wie ChurchTools auf den frisch gelesenen.
 */
vi.mock('./lesen', async (orig) => ({
  ...(await orig<typeof import('./lesen')>()),
  ladeUebersicht: vi.fn(),
}));
vi.mock('./mitglieder', () => ({ ladeGruppenMitglieder: vi.fn() }));
vi.mock('./useToDoEinstellungen', async (orig) =>
  (await import('./ohneAbgleich.testutil')).ohneAbgleich(orig),
);
vi.mock('./aufgabenSchreiben', async (orig) => ({
  ...(await orig<typeof import('./aufgabenSchreiben')>()),
  aufgabeAendern: vi.fn(),
}));

const LT: ProtokollGruppe = {
  id: 11,
  name: 'Leitungsteam',
  lage: 'eingerichtet',
  protokolle: 60,
  mitarbeit: 61,
};
const AM = '2026-11-20T08:00:00Z';
const aufgabe = (id: string, t: Partial<Aufgabe> = {}): Aufgabe => ({
  ...neueAufgabe({ id, gruppe: 11, sitzung: null, text: id, wer: [1], von: 1, am: AM }),
  ...t,
});
const EIGEN = aufgabe('Raum prüfen');
const GETEILT = aufgabe('Beamer', { wer: [1, 23] });
const GETEILT_JEDER = modusSetzen(aufgabe('Abwesenheiten', { wer: [1, 23] }), true, 1, AM);
const OHNE = aufgabe('Plakate', { wer: [] });
const ALLE = [EIGEN, GETEILT, GETEILT_JEDER, OHNE];

const uebersicht = (l: Aufgabe[]): L.GruppenUebersicht[] => [
  {
    gruppe: LT,
    sitzungen: {
      kommend: [],
      protokolle: [],
      teile: [],
      kalender: 4,
      treffenNichtFreigegeben: false,
      punkte: 'vorschlagen',
    },
    aufgaben: l,
  },
];
const zeige = (schreibbar: number[]) =>
  render(
    <ToDos
      modul={24}
      ich={{ person: 1, name: 'Alwin' }}
      gruppen={[LT]}
      schreibbar={schreibbar}
      onSitzung={vi.fn()}
    />,
  );
const zeile = (t: string) => screen.getByText(t).closest('li')!;
const gespeichert = (i = 0) => {
  const [, id, aendern] = vi.mocked(S.aufgabeAendern).mock.calls[i];
  return aendern(ALLE.find((a) => a.id === id)!);
};

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  vi.mocked(L.ladeUebersicht).mockResolvedValue(uebersicht(ALLE));
  vi.mocked(M.ladeGruppenMitglieder).mockResolvedValue([
    { id: 1, name: 'Alwin Friesen', bild: null, initialen: 'AF' },
    { id: 23, name: 'Johann Becker', bild: null, initialen: 'JB' },
  ]);
  vi.mocked(S.aufgabeAendern).mockImplementation((_o, id, aendern) =>
    Promise.resolve(aendern(ALLE.find((a) => a.id === id)!)),
  );
});
afterEach(cleanup);

describe('To-Do-Übersicht: Mitglied (W9a)', () => {
  it('ohne Zuständigen: statt Haken „Das mache ich“ – ein Tipp trägt nur mich ein', async () => {
    zeige([]);
    await screen.findByText('Plakate');
    const z = zeile('Plakate');
    expect(within(z).queryByRole('button', { name: /Status/ })).toBeNull();
    fireEvent.click(within(z).getByRole('button', { name: 'Das mache ich' }));
    await waitFor(() => expect(S.aufgabeAendern).toHaveBeenCalledTimes(1));
    expect(gespeichert()).toMatchObject({ wer: [1] });
  });

  it('die anderen To-Dos haben kein „Das mache ich“ – und eigene und geteilte lassen sich abhaken', async () => {
    zeige([]);
    await screen.findByText('Raum prüfen');
    expect(screen.getAllByRole('button', { name: 'Das mache ich' })).toHaveLength(1);
    fireEvent.click(within(zeile('Raum prüfen')).getByRole('button', { name: /Status: offen/ }));
    await waitFor(() => expect(S.aufgabeAendern).toHaveBeenCalledTimes(1));
    expect(gespeichert(0)).toMatchObject({ status: 'erledigt' });
    fireEvent.click(within(zeile('Beamer')).getByRole('button', { name: /Status: offen/ }));
    await waitFor(() => expect(S.aufgabeAendern).toHaveBeenCalledTimes(2));
    expect(gespeichert(1)).toMatchObject({ status: 'erledigt' });
  });

  it('Jeder für sich: der Haken setzt meinen Teil', async () => {
    zeige([]);
    await screen.findByText('Abwesenheiten');
    fireEvent.click(within(zeile('Abwesenheiten')).getByRole('button', { name: /mein Teil/ }));
    await waitFor(() => expect(S.aufgabeAendern).toHaveBeenCalledTimes(1));
    expect(Object.keys(gespeichert().fertig ?? {})).toEqual(['1']);
  });

  it('Leitung: sieht kein „Das mache ich“ – sie kann das To-Do ohne Zuständigen abhaken', async () => {
    zeige([60]);
    await screen.findByText('Plakate');
    expect(screen.queryByRole('button', { name: 'Das mache ich' })).toBeNull();
    expect(within(zeile('Plakate')).getByRole('button', { name: /Status: offen/ })).toBeTruthy();
  });

  it('ein To-Do, das inzwischen jemand anderes übernommen hat: der Schreibweg lehnt ab, die Seite zeigt den Grund', async () => {
    zeige([]);
    await screen.findByText('Plakate');
    // Schreiben läuft über `toDoAendern` – hier meldet die Attrappe, was ChurchTools nach dem Frisch-Lesen vorfände.
    vi.mocked(S.aufgabeAendern).mockImplementation((_o, _id, aendern) => {
      try {
        return Promise.resolve(aendern({ ...OHNE, wer: [23] }));
      } catch (e) {
        return Promise.reject(e instanceof Error ? e : new Error('?'));
      }
    });
    fireEvent.click(within(zeile('Plakate')).getByRole('button', { name: 'Das mache ich' }));
    expect(await screen.findByRole('alert')).toBeTruthy();
    expect(screen.getByRole('alert').textContent).toMatch(/gehört jemand anderem/);
    // und das To-Do steht wieder ohne Zuständigen da
    expect(within(zeile('Plakate')).getByRole('button', { name: 'Das mache ich' })).toBeTruthy();
  });
});
