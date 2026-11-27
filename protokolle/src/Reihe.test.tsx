// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { BLOCK, type Block } from '@shared/protokolle/dokument';
import type { ProtokollGruppe } from '@shared/protokolle/gruppen';
import {
  abschnitt,
  neueThemenreihe,
  neueZeile,
  vorschau,
  type Themenreihe,
} from '@shared/protokolle/themenreihe';
import { ProtokollAnsicht } from './ProtokollAnsicht';
import { ReiheAnbieter } from './ReiheAnbieter';
import { hervorgehoben } from './reiheHervorheben';
import { ReiheUebertragenFenster } from './ReiheUebertragenFenster';
import type { UebertragenPort } from './reiheUebertragen';
import { ReiheBasis, type ReiheBasisWert } from './themenreiheKontext';
import * as Schreiben from './themenreiheSchreiben';

vi.mock('./themenreiheSchreiben', async (orig) => ({
  ...(await orig<typeof import('./themenreiheSchreiben')>()),
  ladeThemenreihen: vi.fn(),
}));
vi.mock('./mitglieder', () => ({ ladeGruppenMitglieder: vi.fn(() => Promise.resolve([])) }));
afterEach(cleanup);

const reihe: Themenreihe = neueThemenreihe({
  id: 'r1',
  gruppe: 11,
  name: 'Jona',
  von: 1,
  am: 'x',
  zeilen: [
    { ...neueZeile('a', '2027-01-13'), eventId: 10, eventTitel: 'Jugendabend', thema: 'Weglaufen' },
    { ...neueZeile('b', '2027-01-20'), eventId: 11, eventTitel: 'Jugendabend', thema: 'Fisch' },
    { ...neueZeile('c', '2027-01-27'), thema: 'Chance' },
  ],
});
const GRUPPE: ProtokollGruppe = {
  id: 11,
  name: 'Leitungsteam',
  lage: 'eingerichtet',
  protokolle: 60,
  mitarbeit: 61,
};
const basis = (schreibbar: number[]): ReiheBasisWert => ({
  modul: 24,
  gruppen: [GRUPPE],
  schreibbar,
  ich: { person: 1, name: 'Alwin' },
  eventKalender: [4],
});
const DOK: Block[] = [{ id: 'b1', type: BLOCK.themenreihe, props: { reihe: 'r1' } }];
const anzeigen = (b: ReiheBasisWert | null, dok: Block[] = DOK) =>
  render(
    <ReiheBasis.Provider value={b}>
      <ReiheAnbieter gruppeId={11} dokument={dok}>
        <ProtokollAnsicht dokument={dok} />
      </ReiheAnbieter>
    </ReiheBasis.Provider>,
  );

beforeEach(() => vi.mocked(Schreiben.ladeThemenreihen).mockReset());

describe('ReiheAnbieter und Karte', () => {
  it('lädt die Reihen erst, wenn das Dokument einen Reihe-Block hat', async () => {
    vi.mocked(Schreiben.ladeThemenreihen).mockResolvedValue([reihe]);
    anzeigen(basis([60]), [{ id: 'p', type: 'paragraph' }]);
    await new Promise((r) => setTimeout(r, 20));
    expect(Schreiben.ladeThemenreihen).not.toHaveBeenCalled();
  });

  it('zeigt die Reihe nach dem Laden – Knöpfe nur, wer im Protokoll schreiben darf', async () => {
    vi.mocked(Schreiben.ladeThemenreihen).mockResolvedValue([reihe]);
    const a = anzeigen(basis([60]));
    expect(await screen.findByText('Weglaufen')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Bearbeiten' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'In Events übertragen' })).toBeTruthy();
    expect(Schreiben.ladeThemenreihen).toHaveBeenCalledTimes(1);
    a.unmount();
    anzeigen(basis([99]));
    expect(await screen.findByText('Weglaufen')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Bearbeiten' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'In Events übertragen' })).toBeNull();
  });

  it('eine Reihe, die es nicht gibt, wird nicht endlos nachgeladen', async () => {
    vi.mocked(Schreiben.ladeThemenreihen).mockResolvedValue([]);
    anzeigen(basis([60]));
    expect(await screen.findByText('Diese Reihe gibt es nicht (mehr).')).toBeTruthy();
    await new Promise((r) => setTimeout(r, 30));
    expect(Schreiben.ladeThemenreihen).toHaveBeenCalledTimes(1);
  });

  it('ein Fehler beim Laden zeigt „Erneut versuchen“ – nicht „gibt es nicht“', async () => {
    vi.mocked(Schreiben.ladeThemenreihen).mockRejectedValueOnce(new Error('503'));
    vi.mocked(Schreiben.ladeThemenreihen).mockResolvedValue([reihe]);
    anzeigen(basis([60]));
    fireEvent.click(await screen.findByRole('button', { name: 'Erneut versuchen' }));
    expect(await screen.findByText('Weglaufen')).toBeTruthy();
  });

  it('ohne Rahmen (kein Start) bleibt nur der Titel – und nichts wird geladen', () => {
    anzeigen(null);
    expect(screen.getByText('Reihe')).toBeTruthy();
    expect(Schreiben.ladeThemenreihen).not.toHaveBeenCalled();
  });

  it('„Bearbeiten“ öffnet das Fenster „Reihe“ mit Name und Abenden', async () => {
    vi.mocked(Schreiben.ladeThemenreihen).mockResolvedValue([reihe]);
    anzeigen(basis([60]));
    fireEvent.click(await screen.findByRole('button', { name: 'Bearbeiten' }));
    expect(await screen.findByDisplayValue('Jona')).toBeTruthy();
    expect(screen.getByDisplayValue('Weglaufen')).toBeTruthy();
    expect(screen.getByText('Abend 3')).toBeTruthy();
  });
});

describe('Fenster gehen mit der frisch gelesenen Reihe auf', () => {
  it('„Bearbeiten“ liest die Reihe neu – ein veralteter Stand führt nicht in eine Sackgasse', async () => {
    vi.mocked(Schreiben.ladeThemenreihen).mockResolvedValueOnce([reihe]);
    vi.mocked(Schreiben.ladeThemenreihen).mockResolvedValue([
      { ...reihe, name: 'Jona von jemand anderem' },
    ]);
    anzeigen(basis([60]));
    fireEvent.click(await screen.findByRole('button', { name: 'Bearbeiten' }));
    expect(await screen.findByDisplayValue('Jona von jemand anderem')).toBeTruthy();
    expect(Schreiben.ladeThemenreihen).toHaveBeenCalledTimes(2);
  });

  it('scheitert das frische Lesen (503), geht das Fenster mit dem bekannten Stand auf', async () => {
    vi.mocked(Schreiben.ladeThemenreihen)
      .mockResolvedValueOnce([reihe])
      .mockRejectedValueOnce(new Error('503'));
    anzeigen(basis([60]));
    fireEvent.click(await screen.findByRole('button', { name: 'Bearbeiten' }));
    expect(await screen.findByDisplayValue('Jona')).toBeTruthy();
  });
});

describe('hervorgehoben', () => {
  it('markiert bei „neu“ den ganzen Abschnitt, bei „geändert“ nur, was abweicht', () => {
    const neu = vorschau(reihe, 0, { text: 'Hand', darf: true });
    const teile = hervorgehoben(neu);
    expect(
      teile
        .filter((t) => t.neu)
        .map((t) => t.text)
        .join(''),
    ).toBe(`${abschnitt(reihe, 0)}`);
    expect(teile.map((t) => t.text).join('')).toBe(neu.neuerText);

    const geaendert = vorschau(reihe, 0, {
      text: abschnitt({ ...reihe, zeilen: reihe.zeilen.map((z) => ({ ...z, thema: 'alt' })) }, 0),
      darf: true,
    });
    const g = hervorgehoben(geaendert);
    expect(g.filter((t) => t.neu).map((t) => t.text.trim())).toEqual(['Thema: Weglaufen']);
    expect(g.map((t) => t.text).join('')).toBe(geaendert.neuerText);
  });
});

describe('ReiheUebertragenFenster', () => {
  const port = (): UebertragenPort & { geschrieben: number[] } => {
    const geschrieben: number[] = [];
    return {
      geschrieben,
      event: vi.fn(async (id: number) => ({
        name: 'Jugendabend',
        startDate: '2027-01-13T18:30:00Z',
        description: '',
        calendar: { domainIdentifier: id === 11 ? '9' : '4' },
      })),
      speichern: vi.fn(async (id: number) => {
        geschrieben.push(id);
        return { ok: true as const, text: 'x' };
      }),
    };
  };

  it('zeigt neu / darfst du nicht / ohne Event, überträgt nur die Gewählten nacheinander und meldet das Ergebnis', async () => {
    const p = port();
    render(
      <ReiheUebertragenFenster
        reihe={reihe}
        rechte={{ kalender: [4], ich: 1 }}
        port={p}
        onClose={() => {}}
      />,
    );
    const los = await screen.findByRole('button', { name: '1 Event übertragen' });
    expect(screen.getByText('darfst du nicht')).toBeTruthy();
    expect(screen.getByText('ohne Event')).toBeTruthy();
    expect(screen.getByText('neu')).toBeTruthy();
    fireEvent.click(los);
    await waitFor(() => expect(screen.getByText('übertragen')).toBeTruthy());
    expect(p.geschrieben).toEqual([10]);
    expect(screen.getByRole('button', { name: 'Fertig' })).toBeTruthy();
  });

  it('ein Häkchen weg: das Event wird nicht geschrieben', async () => {
    const p = port();
    render(
      <ReiheUebertragenFenster
        reihe={reihe}
        rechte={{ kalender: [4], ich: 1 }}
        port={p}
        onClose={() => {}}
      />,
    );
    await screen.findByRole('button', { name: '1 Event übertragen' });
    fireEvent.click(screen.getByRole('checkbox', { name: /13\.01\.2027/ }));
    expect(
      screen.getByRole('button', { name: '0 Events übertragen' }).hasAttribute('disabled'),
    ).toBe(true);
    expect(p.speichern).not.toHaveBeenCalled();
  });

  it('ein Fehler bei einem Event: „nicht übertragen, bitte noch einmal“ und „Neu lesen“ statt „Fertig“', async () => {
    const p = port();
    vi.mocked(p.speichern).mockRejectedValue(new TypeError('Failed to fetch'));
    render(
      <ReiheUebertragenFenster
        reihe={reihe}
        rechte={{ kalender: [4], ich: 1 }}
        port={p}
        onClose={() => {}}
      />,
    );
    fireEvent.click(await screen.findByRole('button', { name: '1 Event übertragen' }));
    expect(await screen.findByText('nicht übertragen, bitte noch einmal')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Neu lesen' })).toBeTruthy();
  });
});
