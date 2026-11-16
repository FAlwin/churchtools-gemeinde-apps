// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { heuteImKalender } from '@shared/ct/zeit';
import {
  GRUNDWERTE,
  sommerferienAus,
  wechseljahre,
  type Wechseljahr,
} from '@shared/organigramm/gruppenwechsel';
import { einrichtungAus, type Einrichtung } from '@shared/organigramm/gruppenwechselEinrichtung';
import type { OrgRechte } from '@shared/organigramm/rechte';
import type { KjDaten, KjZugang } from '@shared/organigramm/gruppenwechselSicht';
import { KinderJugend } from './KinderJugend';
import { ladeFerien, ladeKjDaten } from './ladeKinderJugend';
import { ladeRegelStand, type RegelStand } from './ladeRegelStand';
import type { Start } from './start';

vi.mock('./ladeKinderJugend', () => ({ ladeFerien: vi.fn(), ladeKjDaten: vi.fn() }));
vi.mock('./ladeRegelStand', () => ({ ladeRegelStand: vi.fn() }));
const ferienLaden = vi.mocked(ladeFerien);
const kjLaden = vi.mocked(ladeKjDaten);
const regelLaden = vi.mocked(ladeRegelStand);

const FISCHE = 50;
const JUNGSCHAR = 51;
const WECHSEL = 52;

/** Die Sommerferien in den nächsten drei Jahren: Das nächste Wechseljahr ist immer das Jahr nach heute (Phase „ruhig“). */
const JAHR = Number(heuteImKalender().slice(0, 4)) + 1;
const FERIEN = sommerferienAus(
  [0, 1, 2].map((i) => ({
    titel: `Sommerferien NRW ${JAHR + i}`,
    beginn: `${JAHR + i}-07-19`,
    ende: `${JAHR + i}-08-31`,
  })),
  GRUNDWERTE.ferienStichwort,
);
const JAHRE: Wechseljahr[] = wechseljahre(FERIEN, GRUNDWERTE);

const einrichtung = (): Einrichtung =>
  einrichtungAus({
    einstellung: {
      ...GRUNDWERTE,
      stufen: [
        { gruppeId: FISCHE, name: 'Fische', abAlter: 7 },
        { gruppeId: JUNGSCHAR, name: 'Jungschar', abAlter: 10 },
      ],
    },
    bereichGruppeId: 53,
    wechselGruppen: [{ vonGruppeId: FISCHE, nachGruppeId: JUNGSCHAR, gruppeId: WECHSEL }],
  })!;

const DATEN: KjDaten = {
  gruppen: new Map([
    [FISCHE, { art: 'sichtbar', mitglieder: [] }],
    [JUNGSCHAR, { art: 'sichtbar', mitglieder: [] }],
    [WECHSEL, { art: 'sichtbar', mitglieder: [] }],
  ]),
  geburtstage: new Map(),
};

const rechte = (rechteVerwalten: boolean): OrgRechte => ({
  // „Berechtigungen verwalten“ – NICHT „Gruppen verwalten“: Das zweite gibt hier nichts frei (O9-F8).
  gruppenVerwalten: true,
  rechteVerwalten,
  anlegbareTypen: [],
  bearbeitbareGruppen: [],
  bearbeitbareTypen: [],
  mitgliederAlle: false,
  mitgliederGruppen: [],
  mitgliederTypen: [],
});
// Nur, was der Reiter vom Start liest: Rollen, Gruppen und Rechte.
const START = { rollen: [], gruppen: [] } as unknown as Start;
const BEREICH: KjZugang = { art: 'bereich' };
const LEITUNG: KjZugang = { art: 'leitung', stufen: [FISCHE] };

const onAbgemeldet = () => {};

/** Regeln, die bis zu diesem Jahr lückenlos eingetragen sind. */
const regelBis = (bis: number): RegelStand => ({
  art: 'da',
  staende: JAHRE.map((j) => ({
    jahr: j.jahr,
    stand: j.jahr <= bis ? { art: 'eingetragen' } : { art: 'fehlt' },
  })),
  bis,
});

function zeigen(o: { zugang?: KjZugang; recht?: boolean } = {}) {
  const start = { ...START, rechte: rechte(o.recht ?? false) };
  return render(
    <KinderJugend
      start={start}
      einrichtung={einrichtung()}
      zugang={o.zugang ?? BEREICH}
      onAbgemeldet={onAbgemeldet}
    />,
  );
}

beforeEach(() => {
  ferienLaden.mockReset();
  ferienLaden.mockResolvedValue({ art: 'da', jahre: JAHRE, ferien: FERIEN });
  kjLaden.mockReset();
  kjLaden.mockResolvedValue({ art: 'da', daten: DATEN, rechte: new Map() });
  regelLaden.mockReset();
  regelLaden.mockResolvedValue(regelBis(JAHR + 1));
});
afterEach(cleanup);

describe('Unterreiter „Wechseltage“', () => {
  it('Bereichsleitung und Admins sehen ihn – neben „Übersicht“ und „Daten pflegen“', async () => {
    zeigen({ zugang: BEREICH });
    expect(await screen.findByRole('button', { name: 'Wechseltage' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Übersicht' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Daten pflegen' })).toBeTruthy();
  });

  it('Leitungen einer Stufe sehen ihn nicht', async () => {
    zeigen({ zugang: LEITUNG, recht: true });
    await screen.findByRole('button', { name: 'Meine Gruppe' });
    expect(screen.queryByRole('button', { name: 'Wechseltage' })).toBeNull();
    expect(screen.queryByRole('heading', { name: 'Wechseltage' })).toBeNull();
  });

  it('mit dem Recht „Berechtigungen verwalten“: Tabelle mit Spalte „In den Regeln“ aus den Regeln', async () => {
    zeigen({ recht: true });
    fireEvent.click(await screen.findByRole('button', { name: 'Wechseltage' }));
    expect(screen.getByRole('heading', { name: 'Wechseltage' })).toBeTruthy();
    expect(screen.getByRole('cell', { name: String(JAHR) })).toBeTruthy();
    expect(screen.getByRole('cell', { name: String(JAHR + 2) })).toBeTruthy();
    expect(await screen.findAllByText('eingetragen')).toHaveLength(2);
    expect(screen.getByText('fehlt noch')).toBeTruthy();
  });

  it('Regeln werden mit dem aktuellen Wechseljahr und den späteren Jahren abgefragt – einmal, beim Laden', async () => {
    zeigen({ recht: true });
    await screen.findByRole('button', { name: 'Wechseltage' });
    expect(regelLaden).toHaveBeenCalledTimes(1);
    const [, jahre, naechstes] = regelLaden.mock.calls[0];
    expect(jahre.map((j) => j.jahr)).toEqual([JAHR, JAHR + 1, JAHR + 2]);
    expect(naechstes).toBe(JAHR);
  });

  it('ohne das Recht (auch als Gruppen-Admin!): keine Abfrage, keine Spalte', async () => {
    zeigen({ recht: false });
    fireEvent.click(await screen.findByRole('button', { name: 'Wechseltage' }));
    expect(regelLaden).not.toHaveBeenCalled();
    expect(screen.getByRole('cell', { name: String(JAHR) })).toBeTruthy();
    expect(screen.queryByRole('columnheader', { name: 'In den Regeln' })).toBeNull();
    expect(screen.queryByText(/eingetragen|fehlt noch/)).toBeNull();
  });

  it('Regeln nicht prüfbar (z. B. 401 ohne Recht): „nicht prüfbar“, weder Abmelden noch Erinnerung', async () => {
    regelLaden.mockResolvedValue({ art: 'nichtPruefbar' });
    const abgemeldet = vi.fn();
    render(
      <KinderJugend
        start={{ ...START, rechte: rechte(true) }}
        einrichtung={einrichtung()}
        zugang={BEREICH}
        onAbgemeldet={abgemeldet}
      />,
    );
    fireEvent.click(await screen.findByRole('button', { name: 'Wechseltage' }));
    expect(await screen.findAllByText('nicht prüfbar')).toHaveLength(3);
    expect(abgemeldet).not.toHaveBeenCalled();
    expect(screen.queryByText(/fehlen/)).toBeNull();
  });

  it('verliert man die Bereichs-Zugehörigkeit, während die Seite offen ist, zeigt sie sich nicht mehr', async () => {
    // Dieselbe Einrichtung und derselbe Start: Sonst lädt der Reiter neu und die Tabelle fehlt aus dem falschen Grund.
    const e = einrichtung();
    const start = { ...START, rechte: rechte(false) };
    const { rerender } = render(
      <KinderJugend start={start} einrichtung={e} zugang={BEREICH} onAbgemeldet={onAbgemeldet} />,
    );
    fireEvent.click(await screen.findByRole('button', { name: 'Wechseltage' }));
    expect(screen.getByRole('table')).toBeTruthy();
    rerender(
      <KinderJugend start={start} einrichtung={e} zugang={LEITUNG} onAbgemeldet={onAbgemeldet} />,
    );
    expect(screen.queryByRole('table')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Wechseltage' })).toBeNull();
  });

  it('beim Wechsel zurück zur Übersicht ist die Seite weg', async () => {
    zeigen();
    fireEvent.click(await screen.findByRole('button', { name: 'Wechseltage' }));
    fireEvent.click(screen.getByRole('button', { name: 'Übersicht' }));
    expect(screen.queryByRole('table')).toBeNull();
    expect(screen.getByRole('heading', { name: 'Übersicht' })).toBeTruthy();
  });
});

describe('Hinweis „läuft aus“ in der Übersicht (nur mit dem Recht)', () => {
  it('Regeln reichen nur bis zum nächsten Jahr: kurzer gelber Hinweis mit Verweis auf „Wechseltage“', async () => {
    regelLaden.mockResolvedValue(regelBis(JAHR));
    zeigen({ recht: true });
    expect(await screen.findByText('Wechseltage fehlen bald.')).toBeTruthy();
    expect(
      screen.getByText(`Die Regeln reichen nur noch bis ${JAHR}. Mehr unter „Wechseltage“.`),
    ).toBeTruthy();
  });

  it('das nächste Jahr fehlt schon: „Ab … fehlen Wechseltage in den Regeln“', async () => {
    regelLaden.mockResolvedValue(regelBis(JAHR - 1));
    zeigen({ recht: true });
    expect(await screen.findByText(`Ab ${JAHR} fehlen Wechseltage in den Regeln.`)).toBeTruthy();
  });

  it('genug in den Regeln: kein Hinweis', async () => {
    zeigen({ recht: true });
    await screen.findByRole('heading', { name: 'Übersicht' });
    await act(async () => {});
    expect(screen.queryByText(/fehlen/)).toBeNull();
  });

  it('nicht prüfbar: kein Hinweis', async () => {
    regelLaden.mockResolvedValue({ art: 'nichtPruefbar' });
    zeigen({ recht: true });
    await screen.findByRole('heading', { name: 'Übersicht' });
    await act(async () => {});
    expect(screen.queryByText(/fehlen/)).toBeNull();
  });

  it('ohne das Recht kein Hinweis – selbst wenn die Regeln auslaufen würden', async () => {
    regelLaden.mockResolvedValue(regelBis(JAHR - 1));
    zeigen({ recht: false });
    await screen.findByRole('heading', { name: 'Übersicht' });
    await act(async () => {});
    expect(screen.queryByText(/fehlen/)).toBeNull();
  });

  it('Leitungen sehen ihn nicht (sie haben keine Übersicht)', async () => {
    regelLaden.mockResolvedValue(regelBis(JAHR));
    zeigen({ zugang: LEITUNG, recht: true });
    await screen.findByRole('button', { name: 'Meine Gruppe' });
    expect(screen.queryByText('Wechseltage fehlen bald.')).toBeNull();
  });
});
