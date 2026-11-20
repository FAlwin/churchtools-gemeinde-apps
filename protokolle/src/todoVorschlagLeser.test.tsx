// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import { faellige, faelligZahl } from '@shared/protokolle/hinweis';
import { heuteImKalender } from '@shared/ct/zeit';
import { neueAufgabe, type Aufgabe } from '@shared/protokolle/aufgaben';
import { neuerToDoVorschlag } from '@shared/protokolle/todoVorschlag';
import { gruppeEinrichten } from './einrichten';
import * as M from './mitglieder';
import {
  kategorieVon,
  LEITER,
  MODUL,
  nachbauEnde,
  nachbauStarten,
  TEILNEHMER,
  werteVon,
  type Nachbau,
} from './nachbau.testhilfe';
import { Startseite } from './Startseite';
import { ToDos } from './ToDos';
import type { AufgabenStand } from './useFaellige';

/**
 * **Jeder Leser der To-Do-Liste lässt Vorschläge weg** (W9b) – mit den echten Lesern (`ladeUebersicht`) gegen die
 * nachgestellte ChurchTools-Instanz und den echten Oberflächen. Ein Vorschlag ohne Zuständige wäre sonst in jeder Mitglieder-
 * Sicht als „Das mache ich“ aufgetaucht, einer mit Zuständigem (kaputte Daten) als „meine offenen To-Dos“ und im Hinweis.
 * Ich bin Person 1 (Mitarbeiter).
 */
vi.mock('./mitglieder', () => ({ ladeGruppenMitglieder: vi.fn() }));
vi.mock('./useToDoEinstellungen', async (orig) =>
  (await import('./ohneAbgleich.testutil')).ohneAbgleich(orig),
);

let ct: Nachbau;
const ICH = { person: 1, name: 'Alwin Friesen' };
const PETER = { person: 19, name: 'Peter Wiens' };
const HEUTE = heuteImKalender();
const AM = '2026-11-18T10:00:00.000Z';

const gruppe = () => ({
  id: 194,
  name: 'Technik',
  lage: 'eingerichtet' as const,
  protokolle: kategorieVon(ct, 'protokolle-g194'),
  mitarbeit: kategorieVon(ct, 'mitarbeit-g194'),
});
const ablegen = (a: Aufgabe) =>
  werteVon(ct, gruppe().mitarbeit).push({ id: ct.naechste++, value: JSON.stringify(a) });

beforeEach(async () => {
  vi.clearAllMocks();
  localStorage.clear();
  ct = nachbauStarten();
  await gruppeEinrichten(
    MODUL,
    { id: 194, name: 'Technik', versteckt: false },
    {
      rollen: [
        { rolle: LEITER, stufe: 'leitung' },
        { rolle: TEILNEHMER, stufe: 'mitglied' },
      ],
      punkte: 'vorschlagen',
      kalender: null,
    },
  );
  vi.mocked(M.ladeGruppenMitglieder).mockResolvedValue([
    { id: 1, name: 'Alwin Friesen', bild: null, initialen: 'AF' },
    { id: 19, name: 'Peter Wiens', bild: null, initialen: 'PW' },
  ]);
  // Ein echtes To-Do (meins), ein To-Do ohne Zuständigen, ein Vorschlag von Peter ohne Zuständige – und ein „Vorschlag“
  // mit mir als Zuständigem und Frist heute (kaputte Daten): Er darf nirgends als To-Do zählen.
  ablegen(
    neueAufgabe({
      id: 't1',
      gruppe: 194,
      sitzung: null,
      text: 'Echtes To-Do',
      wer: [1],
      bis: HEUTE,
      von: 7,
      am: AM,
    }),
  );
  ablegen(
    neueAufgabe({
      id: 't2',
      gruppe: 194,
      sitzung: null,
      text: 'Noch ohne Zuständigen',
      von: 7,
      am: AM,
    }),
  );
  ablegen(
    neuerToDoVorschlag({
      id: 'v1',
      gruppe: 194,
      text: 'Vorschlag von Peter',
      bis: null,
      warum: '',
      von: PETER,
      am: AM,
    }),
  );
  ablegen({
    ...neuerToDoVorschlag({
      id: 'v2',
      gruppe: 194,
      text: 'Vorschlag mit Zuständigem',
      bis: HEUTE,
      warum: '',
      von: ICH,
      am: AM,
    }),
    wer: [1],
  });
});
afterEach(() => {
  cleanup();
  nachbauEnde();
});

describe('Leser: Vorschläge sind keine To-Dos', () => {
  it('Reiter „To-Dos“, Mitglieder-Sicht: nicht in der Liste, kein „Das mache ich“ für einen Vorschlag', async () => {
    const onAufgaben = vi.fn();
    render(
      <ToDos
        modul={MODUL}
        ich={ICH}
        gruppen={[gruppe()]}
        schreibbar={[]}
        onSitzung={vi.fn()}
        onAufgaben={onAufgaben}
      />,
    );
    const liste = await screen.findByRole('region', { name: 'To-Dos' });
    expect(within(liste).getByText('Echtes To-Do')).toBeTruthy();
    expect(within(liste).getByText('Noch ohne Zuständigen')).toBeTruthy();
    expect(within(liste).queryByText(/Vorschlag/)).toBeNull();
    // Genau ein „Das mache ich“: das To-Do ohne Zuständigen – nicht der Vorschlag von Peter.
    expect(screen.getAllByRole('button', { name: 'Das mache ich' })).toHaveLength(1);
    // Der eigene Vorschlag steht nur im Bereich „Vorgeschlagen“.
    const b = screen.getByRole('region', { name: 'Vorgeschlagen' });
    expect(within(b).getByText('Vorschlag mit Zuständigem')).toBeTruthy();
    expect(within(b).queryByText('Vorschlag von Peter')).toBeNull();
    // Der Zähler am Reiter bekommt nur To-Dos.
    await waitFor(() => expect(onAufgaben).toHaveBeenCalled());
    const stand = onAufgaben.mock.calls.at(-1)![0] as AufgabenStand[];
    expect(stand.flatMap((s) => s.aufgaben.map((a) => a.id)).sort()).toEqual(['t1', 't2']);
  });

  it('Startseite: „Meine offenen To-Dos“ und der Zähler ohne Vorschläge; der Hinweis auf Fälliges zählt sie nicht', async () => {
    const onAufgaben = vi.fn();
    render(
      <Startseite
        modul={MODUL}
        ich={ICH}
        gruppen={[gruppe()]}
        onSitzung={vi.fn()}
        onGruppe={vi.fn()}
        onAlleToDos={vi.fn()}
        onAufgaben={onAufgaben}
      />,
    );
    const meine = (await screen.findByRole('heading', { name: 'Meine offenen To-Dos' })).closest(
      'section',
    )!;
    expect(within(meine).getByText('Echtes To-Do')).toBeTruthy();
    expect(within(meine).queryByText(/Vorschlag/)).toBeNull();
    await waitFor(() => expect(onAufgaben).toHaveBeenCalled());
    const stand = onAufgaben.mock.calls.at(-1)![0] as AufgabenStand[];
    expect(stand.flatMap((s) => s.aufgaben.map((a) => a.id)).sort()).toEqual(['t1', 't2']);
    // Hinweis/Zähler am Reiter: gerechnet aus genau diesem Stand – heute fällig ist nur das echte To-Do.
    expect(
      faelligZahl(
        faellige(
          stand.flatMap((s) => s.aufgaben),
          1,
          HEUTE,
          3,
        ),
      ),
    ).toBe(1);
  });
});
