// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { KeinSpeicherRecht } from '@ui/ct/verbindung';
import type { ProtokollGruppe } from '@shared/protokolle/gruppen';
import type { Sitzung } from '@shared/protokolle/sitzungen';
import { teileBauen, type ProtokollKopf, type ProtokollTeil } from '@shared/protokolle/speicher';
import { STANDARD_VORLAGEN } from '@shared/protokolle/vorlagen';
import * as B from './beginnen';
import * as L from './lesen';
import * as P from './planen';
import * as V from './vorlagen';
import { ProtokollNeu } from './ProtokollNeu';
import { Startseite } from './Startseite';

/** „Neues Protokoll“ ohne Termin (K2a) – Lesen, Vorlagen und Schreiben sind Attrappen. */
vi.mock('./beginnen', () => ({ protokollBeginnen: vi.fn() }));
vi.mock('./vorlagen', () => ({ ladeVorlagen: vi.fn() }));
vi.mock('./planen', async (orig) => ({
  ...(await orig<typeof import('./planen')>()),
  treffenAnlegen: vi.fn(),
}));
vi.mock('./lesen', async (orig) => ({
  ...(await orig<typeof import('./lesen')>()),
  ladeSitzungen: vi.fn(),
  ladeUebersicht: vi.fn(() => Promise.resolve([])),
}));

afterEach(cleanup);

const beginnen = vi.mocked(B.protokollBeginnen);
const treffen = vi.mocked(P.treffenAnlegen);
const ZONE = 'Europe/Berlin';
const JETZT = new Date('2026-10-29T10:00:00Z');
const GRUPPEN: ProtokollGruppe[] = [
  { id: 11, name: 'Leitungsteam', lage: 'eingerichtet', protokolle: 60, mitarbeit: 61 },
  { id: 7, name: 'Jugendleitung', lage: 'eingerichtet', protokolle: 70, mitarbeit: null },
];

const t = (text: string) => [{ type: 'text', text, styles: {} }];
const alt = teileBauen(
  [{ id: 'p', type: 'heading', props: { level: 1 }, content: t('Finanzen'), children: [] }],
  'okt',
);
const kopf = (teil: Partial<ProtokollKopf>): ProtokollKopf => ({
  art: 'protokoll',
  fassung: 1,
  sitzung: 'okt',
  titel: 'Leitungssitzung',
  status: 'frei',
  beginn: '2026-10-14T17:30:00Z',
  termin: null,
  treffen: null,
  freigabe: { von: 1, am: '2026-10-15T08:00:00Z' },
  sperre: null,
  stand: alt.stand,
  ...teil,
});
const sitzung = (k: ProtokollKopf): Sitzung => ({
  schluessel: `p:${k.sitzung}`,
  beginn: k.beginn,
  titel: k.titel,
  termin: k.termin,
  treffen: k.treffen,
  kopf: k,
  anfragen: [],
});
const OKT = sitzung(kopf({}));
const SEPT = sitzung(kopf({ sitzung: 'sept', beginn: '2026-09-30T17:30:00Z', stand: 'x' }));
const daten = (protokolle: Sitzung[], kommend: Sitzung[] = []): L.GruppenSitzungen => ({
  kommend,
  protokolle,
  teile: alt.werte.map((w) => JSON.parse(w) as ProtokollTeil),
  kalender: null,
  treffenNichtFreigegeben: false,
});

const zeige = (gruppen = GRUPPEN.slice(0, 1)) => {
  const onAngelegt = vi.fn();
  render(
    <ProtokollNeu
      modul={24}
      gruppen={gruppen}
      ich={{ person: 1 }}
      zeitzone={ZONE}
      jetzt={JETZT}
      onAngelegt={onAngelegt}
      onClose={vi.fn()}
    />,
  );
  return onAngelegt;
};
const anlegen = () => screen.getByRole('button', { name: 'Anlegen' });
const bereit = () => waitFor(() => expect((anlegen() as HTMLButtonElement).disabled).toBe(false));

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(V.ladeVorlagen).mockResolvedValue({
    kategorie: 68,
    vorlagen: STANDARD_VORLAGEN.map((vorlage, i) => ({ wert: 500 + i, vorlage })),
  });
  vi.mocked(L.ladeSitzungen).mockResolvedValue(daten([SEPT, OKT]));
  beginnen.mockResolvedValue({ art: 'ok', sitzung: 'neu', hinweis: null });
  treffen.mockResolvedValue(27);
});

describe('ProtokollNeu', () => {
  it('vorbelegt wie „Neue Sitzung“; „Wie letztes Mal“ auch, wenn die Protokolle nach den Vorlagen ankommen', async () => {
    let fertig: (d: L.GruppenSitzungen) => void = () => undefined;
    vi.mocked(L.ladeSitzungen).mockReturnValue(new Promise((r) => (fertig = r)));
    zeige();
    // Erst die Vorlagen …
    await waitFor(() => expect(V.ladeVorlagen).toHaveBeenCalled());
    await new Promise((r) => setTimeout(r, 0));
    // … dann die Sitzungen der Gruppe.
    fertig(daten([SEPT, OKT]));
    await screen.findByLabelText('Titel');
    expect(screen.getByLabelText<HTMLInputElement>('Titel').value).toBe('Leitungssitzung');
    expect(screen.getByLabelText<HTMLInputElement>('Datum').value).toBe('2026-11-11');
    expect(screen.getByLabelText<HTMLInputElement>('Uhrzeit').value).toBe('19:30');
    await waitFor(() =>
      expect(
        screen
          .getAllByRole('button', { pressed: true })
          .map((b) => b.querySelector('b')?.textContent),
      ).toEqual(['Wie letztes Mal']),
    );
    expect(screen.getByText(/Leitungsteam · ohne Termin/)).toBeTruthy();
  });

  it('„Anlegen“: Protokoll ohne Termin und ohne Treffen, dann öffnen', async () => {
    const onAngelegt = zeige();
    await bereit();
    fireEvent.click(anlegen());
    await waitFor(() => expect(onAngelegt).toHaveBeenCalledWith(11, 'neu'));
    expect(treffen).not.toHaveBeenCalled();
    expect(beginnen.mock.calls[0][0]).toMatchObject({
      kategorie: 60,
      mitarbeit: { modul: 24, kategorie: 61 },
      gruppe: 11,
      von: 1,
      sitzung: {
        titel: 'Leitungssitzung',
        beginn: '2026-11-11T18:30:00Z',
        termin: null,
        treffen: null,
        kopf: null,
      },
    });
  });

  it('auch nachträglich (in der Vergangenheit) – das ist kein Fehler wie bei „Neue Sitzung“', async () => {
    zeige();
    await bereit();
    fireEvent.change(screen.getByLabelText('Datum'), { target: { value: '2026-10-21' } });
    expect((anlegen() as HTMLButtonElement).disabled).toBe(false);
    expect(screen.queryByText(/Zukunft/)).toBeNull();
  });

  it('mit Gruppentreffen: erst das Treffen, dann das Protokoll damit; ein zweiter Versuch legt kein zweites Treffen an', async () => {
    beginnen.mockRejectedValueOnce(new Error('weg'));
    const onAngelegt = zeige();
    await bereit();
    fireEvent.click(screen.getByRole('checkbox', { name: /Gruppentreffen anlegen/ }));
    fireEvent.click(anlegen());
    expect(await screen.findByRole('alert')).toBeTruthy();
    fireEvent.click(anlegen());
    await waitFor(() => expect(onAngelegt).toHaveBeenCalledWith(11, 'neu'));
    expect(treffen).toHaveBeenCalledTimes(1);
    expect(treffen).toHaveBeenCalledWith(11, '2026-11-11T18:30:00Z', '2026-11-11T20:30:00Z', ZONE);
    expect(beginnen.mock.calls[1][0].sitzung.treffen).toBe(27);
  });

  it('kein Recht auf Gruppentreffen: sagt es und legt kein Protokoll an', async () => {
    treffen.mockRejectedValue(new KeinSpeicherRecht('verboten'));
    zeige();
    await bereit();
    fireEvent.click(screen.getByRole('checkbox', { name: /Gruppentreffen anlegen/ }));
    fireEvent.click(anlegen());
    expect((await screen.findByRole('alert')).textContent).toMatch(/Ohne das Häkchen geht es/);
    expect(beginnen).not.toHaveBeenCalled();
  });

  it('zur selben Zeit gibt es schon eine Sitzung: gesperrt, mit Hinweis', async () => {
    const geplant = sitzung(
      kopf({ sitzung: 'nov', status: 'geplant', beginn: '2026-11-11T18:30:00Z', freigabe: null }),
    );
    vi.mocked(L.ladeSitzungen).mockResolvedValue(daten([SEPT, OKT], [geplant]));
    zeige();
    expect((await screen.findByRole('alert')).textContent).toMatch(/schon eine Sitzung/);
    expect((anlegen() as HTMLButtonElement).disabled).toBe(true);
  });

  it('andere Gruppe gewählt: deren Sitzungen, angelegt in dieser Gruppe (ohne Mitarbeit: ohne To-Dos)', async () => {
    const onAngelegt = zeige(GRUPPEN);
    await bereit();
    fireEvent.change(screen.getByLabelText('Gruppe'), { target: { value: '7' } });
    await waitFor(() =>
      expect(L.ladeSitzungen).toHaveBeenLastCalledWith(24, GRUPPEN[1], ZONE, JETZT),
    );
    await bereit();
    fireEvent.click(anlegen());
    await waitFor(() => expect(onAngelegt).toHaveBeenCalledWith(7, 'neu'));
    expect(beginnen.mock.calls[0][0]).toMatchObject({ kategorie: 70, mitarbeit: null, gruppe: 7 });
  });
});

describe('Einstieg auf der Startseite', () => {
  const start = (schreibbar: number[]) =>
    render(
      <Startseite
        modul={24}
        ich={1}
        gruppen={GRUPPEN}
        schreibbar={schreibbar}
        onSitzung={vi.fn()}
        onGruppe={vi.fn()}
      />,
    );

  it('nur, wer irgendwo schreiben darf; das Fenster bietet nur diese Gruppen', async () => {
    start([]);
    expect(screen.queryByRole('button', { name: /Neues Protokoll/ })).toBeNull();
    cleanup();
    start([60]);
    fireEvent.click(screen.getByRole('button', { name: /Neues Protokoll/ }));
    const fenster = await screen.findByRole('dialog');
    expect(within(fenster).queryByLabelText('Gruppe')).toBeNull();
    expect(await within(fenster).findByText(/Leitungsteam · ohne Termin/)).toBeTruthy();
  });
});
