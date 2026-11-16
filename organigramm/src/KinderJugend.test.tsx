// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
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
import { ladeRegelAbgleich } from './ladeRegelAbgleich';
import type { Start } from './start';

vi.mock('./ladeKinderJugend', () => ({ ladeFerien: vi.fn(), ladeKjDaten: vi.fn() }));
vi.mock('./ladeRegelAbgleich', () => ({ ladeRegelAbgleich: vi.fn() }));
const ferienLaden = vi.mocked(ladeFerien);
const kjLaden = vi.mocked(ladeKjDaten);
const abgleichLaden = vi.mocked(ladeRegelAbgleich);

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

const einrichtung = (eingetragenBis?: number): Einrichtung =>
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
    ...(eingetragenBis === undefined ? {} : { eingetragenBis }),
  })!;

const DATEN: KjDaten = {
  gruppen: new Map([
    [FISCHE, { art: 'sichtbar', mitglieder: [] }],
    [JUNGSCHAR, { art: 'sichtbar', mitglieder: [] }],
    [WECHSEL, { art: 'sichtbar', mitglieder: [] }],
  ]),
  geburtstage: new Map(),
};

const rechte = (gruppenVerwalten: boolean): OrgRechte => ({
  gruppenVerwalten,
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

function zeigen(o: { bis?: number; zugang?: KjZugang; admin?: boolean } = {}) {
  const start = { ...START, rechte: rechte(o.admin ?? false) };
  return render(
    <KinderJugend
      start={start}
      einrichtung={einrichtung(o.bis)}
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
  abgleichLaden.mockReset();
  abgleichLaden.mockResolvedValue({ abweichungen: [], nichtPruefbar: [] });
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
    zeigen({ zugang: LEITUNG });
    await screen.findByRole('button', { name: 'Meine Gruppe' });
    expect(screen.queryByRole('button', { name: 'Wechseltage' })).toBeNull();
    expect(screen.queryByRole('heading', { name: 'Wechseltage' })).toBeNull();
  });

  it('öffnet die Seite mit der Tabelle der Jahre aus dem Ferienkalender', async () => {
    zeigen({ bis: JAHR + 1 });
    fireEvent.click(await screen.findByRole('button', { name: 'Wechseltage' }));
    expect(screen.getByRole('heading', { name: 'Wechseltage' })).toBeTruthy();
    expect(screen.getByRole('cell', { name: String(JAHR) })).toBeTruthy();
    expect(screen.getByRole('cell', { name: String(JAHR + 2) })).toBeTruthy();
    expect(screen.getAllByText('eingetragen')).toHaveLength(2);
    expect(screen.getByText('fehlt noch')).toBeTruthy();
  });

  it('Admin: die Regeln in ChurchTools werden abgefragt, Bereichsleitung ohne Admin-Recht: nicht', async () => {
    const { unmount } = zeigen({ bis: JAHR + 1, admin: true });
    fireEvent.click(await screen.findByRole('button', { name: 'Wechseltage' }));
    expect(abgleichLaden).toHaveBeenCalledTimes(1);
    unmount();
    abgleichLaden.mockClear();
    zeigen({ bis: JAHR + 1, admin: false });
    fireEvent.click(await screen.findByRole('button', { name: 'Wechseltage' }));
    expect(abgleichLaden).not.toHaveBeenCalled();
  });

  it('verliert man die Bereichs-Zugehörigkeit, während die Seite offen ist, zeigt sie sich nicht mehr', async () => {
    // Dieselbe Einrichtung und derselbe Start: Sonst lädt der Reiter neu und die Tabelle fehlt aus dem falschen Grund.
    const e = einrichtung(JAHR + 1);
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

describe('Hinweis „läuft aus“ in der Übersicht', () => {
  it('nur noch das nächste Jahr eingetragen: kurzer gelber Hinweis mit Verweis auf „Wechseltage“', async () => {
    zeigen({ bis: JAHR });
    expect(await screen.findByText('Wechseltage fehlen bald.')).toBeTruthy();
    expect(
      screen.getByText(`Eingetragen sind sie nur noch bis ${JAHR}. Mehr unter „Wechseltage“.`),
    ).toBeTruthy();
  });

  it('das nächste Jahr fehlt schon: „Ab … fehlen Wechseltage“', async () => {
    zeigen({ bis: JAHR - 1 });
    expect(await screen.findByText(`Ab ${JAHR} fehlen Wechseltage.`)).toBeTruthy();
  });

  it.each([
    ['genug eingetragen', JAHR + 1],
    ['nicht bekannt', undefined],
  ])('%s: kein Hinweis', async (_, bis) => {
    zeigen({ bis });
    await screen.findByRole('heading', { name: 'Übersicht' });
    expect(screen.queryByText(/fehlen bald|fehlen Wechseltage/)).toBeNull();
  });

  it('Leitungen sehen ihn nicht (sie haben keine Übersicht)', async () => {
    zeigen({ bis: JAHR, zugang: LEITUNG });
    await screen.findByRole('button', { name: 'Meine Gruppe' });
    expect(screen.queryByText('Wechseltage fehlen bald.')).toBeNull();
  });
});
