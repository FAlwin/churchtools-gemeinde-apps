// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { ApiError } from '@ui/ct/fehler';
import type { ProtokollGruppe } from '@shared/protokolle/gruppen';
import type { Block } from '@shared/protokolle/dokument';
import { teileBauen, type ProtokollKopf, type ProtokollTeil } from '@shared/protokolle/speicher';
import type { Sitzung } from '@shared/protokolle/sitzungen';
import { neueAufgabe } from '@shared/protokolle/aufgaben';
import * as L from './lesen';
import { HOECHSTENS, Suche } from './Suche';

vi.mock('./lesen', async (orig) => ({
  ...(await orig<typeof import('./lesen')>()),
  ladeUebersicht: vi.fn(),
}));
const m = vi.mocked(L);

const GRUPPEN: ProtokollGruppe[] = [
  { id: 11, name: 'Leitungsteam', lage: 'eingerichtet', protokolle: 60, mitarbeit: 61 },
  { id: 7, name: 'Jugendleitung', lage: 'eingerichtet', protokolle: 70, mitarbeit: 71 },
];

const t = (text: string) => [{ type: 'text', text, styles: {} }];
const block = (id: string, type: string, text: string, props?: Record<string, unknown>): Block => ({
  id,
  type,
  ...(props ? { props } : {}),
  content: t(text),
  children: [],
});

/** Ein freigegebenes Protokoll im echten Speicherformat. */
function frei(
  sitzung: string,
  beginn: string,
  dokument: Block[],
): { s: Sitzung; teile: ProtokollTeil[] } {
  const { stand, werte } = teileBauen(dokument, sitzung);
  const kopf: ProtokollKopf = {
    art: 'protokoll',
    fassung: 1,
    sitzung,
    titel: 'Leitungssitzung',
    status: 'frei',
    beginn,
    termin: null,
    treffen: null,
    freigabe: { von: 1, am: beginn },
    sperre: null,
    stand,
  };
  return {
    s: {
      schluessel: `p:${sitzung}`,
      beginn,
      titel: 'Leitungssitzung',
      termin: null,
      treffen: null,
      kopf,
      anfragen: [],
    },
    teile: werte.map((w) => JSON.parse(w) as ProtokollTeil),
  };
}

const OKT = frei('okt', '2026-10-14T17:00:00Z', [
  block('p1', 'heading', 'Technik', { level: 1 }),
  block('a1', 'paragraph', 'Der alte Beamer fällt aus.'),
  block('b1', 'beschluss', 'Zweites Beamer-Angebot wird angenommen.'),
  block('p2', 'heading', 'Freizeit', { level: 1 }),
  block('b2', 'beschluss', 'Gemeindefreizeit im Hunsrück.'),
  block('t1', 'termin', 'Anmeldung öffnet', { datum: '2027-01-15' }),
]);
const JUG = frei('jug', '2026-10-02T16:00:00Z', [
  block('j1', 'heading', 'Räume', { level: 1 }),
  block('e1', 'beschluss', 'Jugendraum wird gestrichen.'),
]);
const ohne = { kommend: [], kalender: 4, treffenNichtFreigegeben: false };
const UEBERSICHT: L.GruppenUebersicht[] = [
  {
    gruppe: GRUPPEN[0],
    sitzungen: { ...ohne, protokolle: [OKT.s], teile: OKT.teile },
    aufgaben: [
      neueAufgabe({
        id: 'x9',
        gruppe: 11,
        sitzung: 'weg',
        text: 'Beamer-Kabel kaufen',
        wer: [1],
        von: 1,
        am: '2026-10-14T18:00:00Z',
      }),
    ],
  },
  {
    gruppe: GRUPPEN[1],
    sitzungen: { ...ohne, protokolle: [JUG.s], teile: JUG.teile },
    aufgaben: [],
  },
];

const onTreffer = vi.fn();
const zeigen = (begriff = '', gruppen = GRUPPEN) =>
  render(<Suche modul={24} gruppen={gruppen} begriff={begriff} onTreffer={onTreffer} />);
const liste = () =>
  within(screen.getByRole('region'))
    .queryAllByRole('listitem')
    .map((z) => z.textContent);
/**
 * Wartet, bis die Treffer geladen sind. Die Überschrift allein genügt nicht: Sie steht schon über „Wird geladen …“ –
 * unter Last war die Liste danach noch leer (28.10.2026).
 */
async function geladen(kopf: string) {
  await screen.findByRole('heading', { name: kopf });
  await waitFor(() => expect(screen.queryByText('Wird geladen …')).toBeNull());
}
const gedrueckt = (gruppe: string) =>
  within(screen.getByRole('group', { name: gruppe }))
    .getAllByRole('button')
    .filter((b) => b.getAttribute('aria-pressed') === 'true')
    .map((b) => b.textContent);

beforeEach(() => {
  vi.clearAllMocks();
  m.ladeUebersicht.mockResolvedValue(UEBERSICHT);
});

describe('Suche (S3-4b)', () => {
  it('ohne Begriff: „Beschlüsse“ gewählt – alle Beschlüsse aller Gruppen, neueste zuerst', async () => {
    zeigen();
    await geladen('Alle Beschlüsse');
    expect(gedrueckt('Art')).toEqual(['Beschlüsse']);
    expect(liste()).toEqual([
      '14OKTZweites Beamer-Angebot wird angenommen.BeschlussLeitungsteam · Leitungssitzung · 1. Technik',
      '14OKTGemeindefreizeit im Hunsrück.BeschlussLeitungsteam · Leitungssitzung · 2. Freizeit',
      '2OKTJugendraum wird gestrichen.BeschlussJugendleitung · Leitungssitzung · 1. Räume',
    ]);
    expect(m.ladeUebersicht).toHaveBeenCalledWith(24, GRUPPEN, expect.any(String));
  });

  it('mit Begriff: „Alles“ gewählt, Fundstellen markiert – auch das To-Do ohne Protokoll', async () => {
    zeigen('beamer');
    await geladen('Treffer');
    expect(gedrueckt('Art')).toEqual(['Alles']);
    expect(liste()).toEqual([
      '14OKTDer alte Beamer fällt aus.ProtokolltextLeitungsteam · Leitungssitzung · 1. Technik',
      '14OKTZweites Beamer-Angebot wird angenommen.BeschlussLeitungsteam · Leitungssitzung · 1. Technik',
      'Beamer-Kabel kaufenTo-DoLeitungsteam · offen',
    ]);
    expect([...document.querySelectorAll('mark')].map((x) => x.textContent)).toEqual([
      'Beamer',
      'Beamer',
      'Beamer',
    ]);
  });

  it('eine gewählte Art gilt – auch wenn sich der Begriff ändert', async () => {
    const { rerender } = zeigen('beamer');
    await geladen('Treffer');
    fireEvent.click(screen.getByRole('button', { name: 'Beschlüsse' }));
    expect(liste()).toHaveLength(1);
    rerender(<Suche modul={24} gruppen={GRUPPEN} begriff="" onTreffer={onTreffer} />);
    expect(gedrueckt('Art')).toEqual(['Beschlüsse']);
    rerender(<Suche modul={24} gruppen={GRUPPEN} begriff="hunsrück" onTreffer={onTreffer} />);
    expect(gedrueckt('Art')).toEqual(['Beschlüsse']);
  });

  it('Filter nach Gruppe; bei nur einer Gruppe keine Gruppen-Knöpfe', async () => {
    zeigen();
    await geladen('Alle Beschlüsse');
    fireEvent.click(screen.getByRole('button', { name: 'Jugendleitung' }));
    expect(liste()).toHaveLength(1);
    expect(gedrueckt('Gruppe')).toEqual(['Jugendleitung']);
  });

  it('nur eine Gruppe: keine Gruppen-Knöpfe', async () => {
    zeigen('', [GRUPPEN[0]]);
    await geladen('Alle Beschlüsse');
    expect(screen.queryByRole('group', { name: 'Gruppe' })).toBeNull();
  });

  it('Termin mit Datum vorn', async () => {
    zeigen();
    await geladen('Alle Beschlüsse');
    fireEvent.click(screen.getByRole('button', { name: 'Termine' }));
    expect(liste()).toEqual([
      '14OKT15.01.2027 – Anmeldung öffnetTerminLeitungsteam · Leitungssitzung · 2. Freizeit',
    ]);
  });

  it('ein Tipp öffnet die Sitzung am Tagesordnungspunkt; ein To-Do ohne Protokoll ist kein Knopf', async () => {
    zeigen('beamer');
    fireEvent.click(await screen.findByRole('button', { name: /Angebot wird angenommen/ }));
    expect(onTreffer).toHaveBeenCalledWith(11, 'p:okt', 'p1');
    expect(screen.queryByRole('button', { name: /Kabel kaufen/ })).toBeNull();
  });

  it('Protokolltext ohne Begriff: ein Satz statt einer Liste', async () => {
    zeigen();
    await geladen('Alle Beschlüsse');
    fireEvent.click(screen.getByRole('button', { name: 'Protokolltext' }));
    expect(screen.getByText(/Gib oben einen Suchbegriff ein/)).toBeTruthy();
    expect(liste()).toEqual([]);
  });

  it('nichts gefunden: ein Satz', async () => {
    zeigen('xyz');
    expect(await screen.findByText('Nichts gefunden.')).toBeTruthy();
  });

  it(`höchstens ${HOECHSTENS} Treffer – mit Hinweis, wie viele es sind`, async () => {
    const viele = frei(
      'viele',
      '2026-10-20T17:00:00Z',
      Array.from({ length: HOECHSTENS + 5 }, (_, i) =>
        block(`v${i}`, 'beschluss', `Beschluss ${i}`),
      ),
    );
    m.ladeUebersicht.mockResolvedValue([
      {
        gruppe: GRUPPEN[0],
        sitzungen: { ...ohne, protokolle: [viele.s], teile: viele.teile },
        aufgaben: [],
      },
    ]);
    zeigen('', [GRUPPEN[0]]);
    await geladen('Alle Beschlüsse');
    expect(liste()).toHaveLength(HOECHSTENS);
    expect(
      screen.getByText(`Die ersten ${HOECHSTENS} von ${HOECHSTENS + 5}`, { exact: false }),
    ).toBeTruthy();
  });

  it('vorübergehender Fehler: „Erneut versuchen“ – nicht „Noch keine Beschlüsse“', async () => {
    m.ladeUebersicht.mockRejectedValueOnce(new ApiError(503, 'weg'));
    zeigen();
    fireEvent.click(await screen.findByRole('button', { name: 'Erneut versuchen' }));
    expect(screen.queryByText(/Noch keine Beschlüsse/)).toBeNull();
    expect(await screen.findByText('Gemeindefreizeit im Hunsrück.')).toBeTruthy();
    expect(m.ladeUebersicht).toHaveBeenCalledTimes(2);
  });
});
