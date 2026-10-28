// @vitest-environment jsdom
import { useEffect, type ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import type { ProtokollGruppe } from '@shared/protokolle/gruppen';
import type { Sitzung } from '@shared/protokolle/sitzungen';
import { teileBauen, type ProtokollKopf, type ProtokollTeil } from '@shared/protokolle/speicher';
import { Unklar } from '@ui/ct/fehler';
import * as L from './lesen';
import * as M from './mitglieder';
import * as P from './planen';
import { SitzungFestlegen } from './SitzungFestlegen';
import { Sitzungen } from './Sitzungen';

/** Fenster „Nächste Sitzung festlegen“ / „Neue Sitzung“ und seine Einstiege (S5-2) – Schreiben und Lesen sind Attrappen. */
vi.mock('./planen', async (orig) => ({
  ...(await orig<typeof import('./planen')>()),
  sitzungFestlegen: vi.fn(),
}));
vi.mock('./mitglieder', () => ({ ladeGruppenMitglieder: vi.fn() }));
vi.mock('./lesen', async (orig) => ({
  ...(await orig<typeof import('./lesen')>()),
  ladeSitzungen: vi.fn(),
  ladeAufgaben: vi.fn(),
}));
// Der Editor als Attrappe: zählt, wie oft er geöffnet wird, und zeigt den Kasten „Nächste Sitzung“.
const editorGeoeffnet = vi.fn();
vi.mock('./ProtokollSchreiben', () => ({
  ProtokollSchreiben: ({ naechste }: { naechste?: ReactNode }) => {
    useEffect(() => {
      editorGeoeffnet();
    }, []);
    return <div data-testid="editor">{naechste}</div>;
  },
}));

const festlegen = vi.mocked(P.sitzungFestlegen);
const ZONE = 'Europe/Berlin';
const JETZT = new Date('2026-10-28T12:00:00Z');
const PERSONEN = [
  { id: 1, name: 'Alwin Friesen', bild: null, initialen: 'AF' },
  { id: 19, name: 'Spike Musiker', bild: null, initialen: 'SM' },
  { id: 23, name: 'Daniel Schmidt', bild: null, initialen: 'DS' },
];

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
  stand: 'x',
  ...teil,
});
const sitzung = (k: ProtokollKopf, teil: Partial<Sitzung> = {}): Sitzung => ({
  schluessel: `p:${k.sitzung}`,
  beginn: k.beginn,
  titel: k.titel,
  termin: k.termin,
  treffen: k.treffen,
  kopf: k,
  anfragen: [],
  ...teil,
});
const OKT_DOK = teileBauen(
  [{ id: 'p', type: 'heading', props: { level: 1 }, content: [], children: [] }],
  'okt',
);
const SEPT = sitzung(kopf({ sitzung: 'sept', beginn: '2026-09-30T17:30:00Z' }), {
  ende: '2026-09-30T19:00:00Z',
});
const OKT = sitzung(kopf({ stand: OKT_DOK.stand }), { ende: '2026-10-14T19:00:00Z' });

const fenster = (q: Partial<Parameters<typeof SitzungFestlegen>[0]> = {}) => {
  const onFestgelegt = vi.fn();
  render(
    <SitzungFestlegen
      art="naechste"
      gruppe={{ id: 194, name: 'Leitungsteam' }}
      modul={24}
      kategorie={62}
      kalender={4}
      sitzungen={[SEPT, OKT]}
      bis={OKT}
      ich={{ person: 1 }}
      zeitzone={ZONE}
      jetzt={JETZT}
      onFestgelegt={onFestgelegt}
      onClose={vi.fn()}
      {...q}
    />,
  );
  return onFestgelegt;
};
const knopf = (name: RegExp | string) => screen.getByRole('button', { name });
const geladen = () => screen.findByRole('list', { name: 'Einladen' });

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(M.ladeGruppenMitglieder).mockResolvedValue(PERSONEN);
});

describe('SitzungFestlegen', () => {
  it('vorbelegt wie die letzte Sitzung; alle Mitglieder eingeladen; Mail-Hinweis ohne einen selbst', async () => {
    fenster();
    await geladen();
    expect(screen.getByLabelText<HTMLInputElement>('Titel').value).toBe('Leitungssitzung');
    // Abstand der letzten beiden (14 Tage) ab dem 14.10. – der 28.10. ist heute, also frühestens morgen: 11.11.
    expect(screen.getByLabelText<HTMLInputElement>('Datum').value).toBe('2026-11-11');
    expect(screen.getByLabelText<HTMLInputElement>('Uhrzeit').value).toBe('19:30');
    expect(screen.getByLabelText<HTMLSelectElement>(/^Dauer/).value).toBe('90');
    expect(screen.getAllByRole('checkbox').every((c) => (c as HTMLInputElement).checked)).toBe(
      true,
    );
    expect(screen.getByRole('note').textContent).toBe(
      'Die Einladung geht sofort per Mail an 2 Personen.',
    );
    expect(screen.getByText('du – sagst gleich zu')).toBeTruthy();
  });

  it('schon vorbei: „Festlegen“ ist gesperrt und das Fenster sagt warum', async () => {
    fenster({ jetzt: new Date('2026-10-28T19:00:00Z') });
    await geladen();
    fireEvent.change(screen.getByLabelText('Datum'), { target: { value: '2026-10-28' } });
    expect((knopf('Festlegen und einladen') as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText(/in der Zukunft/)).toBeTruthy();
  });

  it('Abwählen zählt mit; ohne andere Eingeladene heißt der Knopf nur „Festlegen“ und es gibt keinen Mail-Hinweis', async () => {
    fenster({ jetzt: new Date('2026-10-28T08:00:00Z') });
    await geladen();
    fireEvent.click(screen.getByRole('checkbox', { name: /Spike/ }));
    expect(screen.getByRole('note').textContent).toMatch(/an 1 Person\.$/);
    fireEvent.click(screen.getByRole('checkbox', { name: /Daniel/ }));
    expect(screen.queryByRole('note')).toBeNull();
    expect(knopf('Festlegen')).toBeTruthy();
  });

  it('„Festlegen und einladen“ schickt Zeitraum in UTC und die Eingeladenen; danach festgelegt', async () => {
    festlegen.mockResolvedValue({
      sitzung: 'neu',
      termin: { kalender: 4, id: 150 },
      treffen: 18,
      fehlend: [],
      hinweise: [],
    });
    const onFestgelegt = fenster({ jetzt: new Date('2026-10-28T08:00:00Z') });
    await geladen();
    fireEvent.change(screen.getByLabelText('Datum'), { target: { value: '2026-11-11' } });
    fireEvent.click(screen.getByRole('checkbox', { name: /Daniel/ }));
    fireEvent.click(knopf('Festlegen und einladen'));
    await waitFor(() => expect(onFestgelegt).toHaveBeenCalledWith('neu'));
    expect(festlegen.mock.calls[0][0]).toMatchObject({
      gruppe: 194,
      kalender: 4,
      kategorie: 62,
      titel: 'Leitungssitzung',
      beginn: '2026-11-11T18:30:00Z',
      ende: '2026-11-11T20:00:00Z',
      eingeladen: [1, 19],
    });
  });

  it('Hinweise (Treffen fehlt, Einladung fehlt): das Fenster sagt es, „Fertig“ schließt', async () => {
    festlegen.mockResolvedValue({
      sitzung: 'neu',
      termin: { kalender: 4, id: 150 },
      treffen: null,
      fehlend: [23],
      hinweise: ['Das Gruppentreffen wurde nicht angelegt.'],
    });
    const onFestgelegt = fenster({ jetzt: new Date('2026-10-28T08:00:00Z') });
    await geladen();
    fireEvent.click(knopf('Festlegen und einladen'));
    expect(
      await screen.findByText(/Nicht eingeladen hat ChurchTools: Daniel Schmidt/),
    ).toBeTruthy();
    expect(screen.getByText('Das Gruppentreffen wurde nicht angelegt.')).toBeTruthy();
    expect(onFestgelegt).not.toHaveBeenCalled();
    fireEvent.click(knopf('Fertig'));
    expect(onFestgelegt).toHaveBeenCalledWith('neu');
  });

  it('Fehler: Fenster bleibt offen und sagt warum', async () => {
    festlegen.mockRejectedValue(new Unklar(P.UNKLAR));
    const onFestgelegt = fenster({ jetzt: new Date('2026-10-28T08:00:00Z') });
    await geladen();
    fireEvent.click(knopf('Festlegen und einladen'));
    expect((await screen.findByRole('alert')).textContent).toMatch(/im Kalender nachsehen/);
    expect(onFestgelegt).not.toHaveBeenCalled();
  });

  it('zur selben Zeit gibt es schon eine Sitzung: gesperrt, mit Hinweis', async () => {
    const belegt = sitzung(
      kopf({ sitzung: 'nov', status: 'geplant', beginn: '2026-11-11T18:30:00Z' }),
    );
    fenster({ sitzungen: [SEPT, OKT, belegt], jetzt: new Date('2026-10-28T08:00:00Z') });
    await geladen();
    expect(screen.getByRole('alert').textContent).toMatch(/schon eine Sitzung/);
    expect((knopf('Festlegen und einladen') as HTMLButtonElement).disabled).toBe(true);
  });

  it('„Neue Sitzung“: vorbelegt wie die letzte, die schon war – nicht nach einer schon geplanten', async () => {
    const maerz = sitzung(
      kopf({
        sitzung: 'maerz',
        status: 'geplant',
        beginn: '2027-03-17T17:00:00Z',
        titel: 'Klausur',
      }),
    );
    fenster({ art: 'neu', bis: null, sitzungen: [SEPT, OKT, maerz] });
    await geladen();
    expect(screen.getByLabelText<HTMLInputElement>('Datum').value).toBe('2026-11-11');
    expect(screen.getByLabelText<HTMLInputElement>('Titel').value).toBe('Leitungssitzung');
  });

  it('Mitglieder nicht sichtbar: ohne Einladung, mit Hinweis', async () => {
    vi.mocked(M.ladeGruppenMitglieder).mockResolvedValue('verborgen');
    fenster({ jetzt: new Date('2026-10-28T08:00:00Z') });
    expect(await screen.findByText(/ohne Einladung angelegt/)).toBeTruthy();
    expect(knopf('Festlegen')).toBeTruthy();
  });
});

describe('Einstiege (S5-2)', () => {
  const GRUPPE: ProtokollGruppe = {
    id: 11,
    name: 'Leitungsteam',
    lage: 'eingerichtet',
    protokolle: 60,
    mitarbeit: 61,
  };
  const ENTWURF = sitzung(
    kopf({ sitzung: 'entwurf', status: 'entwurf', beginn: '2026-10-28T18:30:00Z', freigabe: null }),
  );
  const daten = (kommend: Sitzung[], kalender: number | null = 4): L.GruppenSitzungen => ({
    kommend,
    protokolle: [OKT],
    teile: OKT_DOK.werte.map((w) => JSON.parse(w) as ProtokollTeil),
    kalender,
    treffenNichtFreigegeben: false,
  });
  const liste = (schreibbar: number[] = [60], auswahl: string | undefined = undefined) =>
    render(
      <Sitzungen
        ich={{ person: 1, name: 'Alwin' }}
        modul={24}
        gruppen={[GRUPPE]}
        schreibbar={schreibbar}
        auswahl={auswahl ? { gruppe: 11, sitzung: auswahl } : null}
      />,
    );

  beforeEach(() => {
    vi.mocked(L.ladeSitzungen).mockResolvedValue(daten([]));
    vi.mocked(L.ladeAufgaben).mockResolvedValue([]);
  });

  it('„Neue Sitzung“ nur für die Leitung und nur mit Kalender', async () => {
    const { unmount } = liste();
    expect(await screen.findByRole('button', { name: 'Neue Sitzung' })).toBeTruthy();
    unmount();
    liste([]);
    await screen.findByText('Keine kommenden Sitzungen.');
    expect(screen.queryByRole('button', { name: 'Neue Sitzung' })).toBeNull();
  });

  it('ohne Kalender kein „Neue Sitzung“', async () => {
    vi.mocked(L.ladeSitzungen).mockResolvedValue(daten([], null));
    liste();
    await screen.findByText(/noch kein Kalender gewählt/);
    expect(screen.queryByRole('button', { name: 'Neue Sitzung' })).toBeNull();
  });

  it('„Neue Sitzung“ festgelegt: Liste lädt neu und öffnet die neue Sitzung', async () => {
    const neu = sitzung(
      kopf({ sitzung: 'neu', status: 'geplant', beginn: '2026-11-11T18:30:00Z', freigabe: null }),
    );
    festlegen.mockResolvedValue({
      sitzung: 'neu',
      termin: { kalender: 4, id: 150 },
      treffen: 18,
      fehlend: [],
      hinweise: [],
    });
    liste();
    fireEvent.click(await screen.findByRole('button', { name: 'Neue Sitzung' }));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText('Leitungsteam · außerordentlich')).toBeTruthy();
    await within(dialog).findByRole('list', { name: 'Einladen' });
    vi.mocked(L.ladeSitzungen).mockResolvedValue(daten([neu]));
    fireEvent.click(within(dialog).getByRole('button', { name: 'Festlegen und einladen' }));
    expect(
      await screen.findByText('Das Protokoll ist geplant, aber noch nicht begonnen.'),
    ).toBeTruthy();
  });

  it('freigegebenes Protokoll: „Nächste Sitzung“ zeigt die kommende, ohne Knopf', async () => {
    const naechste = sitzung(
      kopf({ sitzung: 'nov', status: 'geplant', beginn: '2026-11-11T18:30:00Z', freigabe: null }),
      {
        anfragen: [
          { person: 1, antwort: 'zugesagt' },
          { person: 19, antwort: 'offen' },
        ],
      },
    );
    vi.mocked(L.ladeSitzungen).mockResolvedValue(daten([naechste]));
    liste([60], 'p:okt');
    // Die Uhrzeit hängt an der Zeitzone des Geräts (Tests: UTC) – geprüft wird der Tag.
    expect(await screen.findByText(/^Mi, 11\.11\.2026 · /)).toBeTruthy();
    expect(screen.getByText(/Einladung an 2 · 1 zugesagt/)).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Nächste Sitzung festlegen' })).toBeNull();
  });

  it('freigegebenes Protokoll ohne nächste Sitzung: „Noch nicht festgelegt“, auch für die Leitung kein Knopf', async () => {
    liste([60], 'p:okt');
    expect(await screen.findByText('Noch nicht festgelegt.')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Nächste Sitzung festlegen' })).toBeNull();
  });

  it('im Editor: festlegen lädt still nach – der Editor bleibt offen und zeigt die neue Sitzung', async () => {
    const neu = sitzung(
      kopf({ sitzung: 'neu', status: 'geplant', beginn: '2026-11-25T18:30:00Z', freigabe: null }),
    );
    festlegen.mockResolvedValue({
      sitzung: 'neu',
      termin: { kalender: 4, id: 150 },
      treffen: 18,
      fehlend: [],
      hinweise: [],
    });
    vi.mocked(L.ladeSitzungen).mockResolvedValue(daten([ENTWURF]));
    liste([60], 'p:entwurf');
    const editor = await screen.findByTestId('editor');
    fireEvent.click(within(editor).getByRole('button', { name: 'Nächste Sitzung festlegen' }));
    const dialog = await screen.findByRole('dialog');
    await within(dialog).findByRole('list', { name: 'Einladen' });
    vi.mocked(L.ladeSitzungen).mockResolvedValue(daten([ENTWURF, neu]));
    fireEvent.click(within(dialog).getByRole('button', { name: 'Festlegen und einladen' }));
    // Im Editor selbst (nicht in der Liste dahinter) – und der Editor wurde dafür nicht neu geöffnet.
    await waitFor(() =>
      expect(within(screen.getByTestId('editor')).getByText(/^Mi, 25\.11\.2026 · /)).toBeTruthy(),
    );
    expect(screen.queryByText('Wird geladen …')).toBeNull();
    expect(editorGeoeffnet).toHaveBeenCalledTimes(1);
  });
});
