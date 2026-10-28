// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { ableiten, type Block } from '@shared/protokolle/dokument';
import { teileBauen, type ProtokollKopf, type ProtokollTeil } from '@shared/protokolle/speicher';
import type { Sitzung } from '@shared/protokolle/sitzungen';
import { STANDARD_VORLAGEN } from '@shared/protokolle/vorlagen';
import * as B from './beginnen';
import * as V from './vorlagen';
import { ProtokollBeginnen } from './ProtokollBeginnen';
import { SitzungAnsicht } from './SitzungAnsicht';

/** Fenster „Protokoll beginnen“ und der Einstieg dazu (S5-1) – Schreiben und Vorlagen sind Attrappen. */
vi.mock('./beginnen', () => ({ protokollBeginnen: vi.fn() }));
vi.mock('./vorlagen', () => ({ ladeVorlagen: vi.fn() }));

const beginnen = vi.mocked(B.protokollBeginnen);

const t = (text: string) => [{ type: 'text', text, styles: {} }];
const ALT_DOK: Block[] = [
  { id: 'p', type: 'heading', props: { level: 1 }, content: t('Finanzen'), children: [] },
  { id: 'x', type: 'paragraph', content: t('Notiz'), children: [] },
];
const alt = teileBauen(ALT_DOK, 'okt');
const ALT: Sitzung = {
  schluessel: 'p:okt',
  titel: 'Leitungssitzung',
  beginn: '2026-10-14T17:00:00Z',
  termin: null,
  treffen: null,
  anfragen: [],
  kopf: {
    art: 'protokoll',
    fassung: 1,
    sitzung: 'okt',
    titel: 'Leitungssitzung',
    status: 'frei',
    beginn: '2026-10-14T17:00:00Z',
    termin: null,
    treffen: null,
    freigabe: { von: 1, am: '2026-10-15T08:00:00Z' },
    sperre: null,
    stand: alt.stand,
  } satisfies ProtokollKopf,
};
const TEILE = alt.werte.map((w) => JSON.parse(w) as ProtokollTeil);
const NEU: Sitzung = {
  schluessel: 't:4:114',
  titel: 'Gebetsabend',
  beginn: '2026-10-28T18:00:00Z',
  termin: { kalender: 4, id: 114 },
  treffen: null,
  anfragen: [],
  kopf: null,
};

const zeige = (protokolle: Sitzung[] = [ALT], onBegonnen = vi.fn()) => {
  render(
    <ProtokollBeginnen
      sitzung={NEU}
      gruppeId={194}
      modul={24}
      kategorie={62}
      mitarbeit={65}
      protokolle={protokolle}
      teile={TEILE}
      ich={{ person: 1 }}
      zeitzone="Europe/Berlin"
      onBegonnen={onBegonnen}
      onClose={vi.fn()}
    />,
  );
  return onBegonnen;
};
const gedrueckt = () =>
  screen.getAllByRole('button', { pressed: true }).map((b) => b.querySelector('b')?.textContent);

beforeEach(() => {
  beginnen.mockReset();
  vi.mocked(V.ladeVorlagen).mockResolvedValue({
    kategorie: 68,
    vorlagen: STANDARD_VORLAGEN.map((vorlage, i) => ({ wert: 500 + i, vorlage })),
  });
});

describe('ProtokollBeginnen', () => {
  it('bietet Vorlagen, „Wie letztes Mal“ (mit Datum und Punkten) und „Leer“ – vorbelegt ist „Wie letztes Mal“', async () => {
    zeige();
    await screen.findByText('Leitungssitzung');
    expect(screen.getByText('Tagesordnung vom 14.10.2026: Finanzen')).toBeTruthy();
    expect(screen.getByText('Leer')).toBeTruthy();
    expect(gedrueckt()).toEqual(['Wie letztes Mal']);
  });

  it('ohne früheres Protokoll: kein „Wie letztes Mal“, vorbelegt die erste Vorlage', async () => {
    zeige([]);
    await screen.findByText('Leitungssitzung');
    expect(screen.queryByText('Wie letztes Mal')).toBeNull();
    expect(gedrueckt()).toEqual([STANDARD_VORLAGEN[0].name]);
  });

  it('„Beginnen“ legt das Protokoll mit der gewählten Vorlage an und öffnet es', async () => {
    beginnen.mockResolvedValue({ art: 'ok', sitzung: 'neu', hinweis: null });
    const onBegonnen = zeige();
    fireEvent.click(await screen.findByText('Teamtreffen'));
    fireEvent.click(screen.getByRole('button', { name: 'Beginnen' }));
    await waitFor(() => expect(onBegonnen).toHaveBeenCalledWith('neu'));
    const q = beginnen.mock.calls[0][0];
    const team = STANDARD_VORLAGEN.find((v) => v.name === 'Teamtreffen')!;
    expect(ableiten(q.dokument).punkte.map((p) => p.titel)).toEqual(
      ableiten(team.bloecke).punkte.map((p) => p.titel),
    );
    expect(q).toMatchObject({
      kategorie: 62,
      mitarbeit: { modul: 24, kategorie: 65 },
      gruppe: 194,
      von: 1,
    });
  });

  it('„Wie letztes Mal“ übernimmt die Tagesordnung des letzten Protokolls, nicht seine Notizen', async () => {
    beginnen.mockResolvedValue({ art: 'ok', sitzung: 'neu', hinweis: null });
    zeige();
    await screen.findByText('Leitungssitzung');
    fireEvent.click(screen.getByRole('button', { name: 'Beginnen' }));
    await waitFor(() => expect(beginnen).toHaveBeenCalled());
    expect(beginnen.mock.calls[0][0].dokument.map((b) => b.type)).toEqual(['heading']);
  });

  it('schon begonnen: sagt es und öffnet auf Wunsch das andere Protokoll', async () => {
    beginnen.mockResolvedValue({ art: 'schon', sitzung: 'fremd' });
    const onBegonnen = zeige();
    await screen.findByText('Leitungssitzung');
    fireEvent.click(screen.getByRole('button', { name: 'Beginnen' }));
    expect(await screen.findByText(/Inzwischen hat jemand anderes/)).toBeTruthy();
    expect(onBegonnen).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Protokoll öffnen' }));
    expect(onBegonnen).toHaveBeenCalledWith('fremd');
  });

  it('Fehler: Fenster bleibt offen und sagt warum', async () => {
    beginnen.mockRejectedValue(new Error('ChurchTools hat das neue Protokoll nicht übernommen.'));
    const onBegonnen = zeige();
    await screen.findByText('Leitungssitzung');
    fireEvent.click(screen.getByRole('button', { name: 'Beginnen' }));
    expect(await screen.findByRole('alert')).toBeTruthy();
    expect(onBegonnen).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Beginnen' })).toBeTruthy();
  });
});

describe('Einstieg in der Sitzungsansicht', () => {
  const ansicht = (sitzung: Sitzung, onBeginnen?: () => void) =>
    render(
      <SitzungAnsicht
        sitzung={sitzung}
        gruppe="Leitungsteam"
        gruppeId={194}
        protokolle={[]}
        teile={[]}
        aufgaben={[]}
        zeitzone="Europe/Berlin"
        onBeginnen={onBeginnen}
        onZurueck={vi.fn()}
      />,
    );

  it('ohne Protokoll und für die Leitung: „Protokoll beginnen“', () => {
    const onBeginnen = vi.fn();
    ansicht(NEU, onBeginnen);
    fireEvent.click(screen.getByRole('button', { name: 'Protokoll beginnen' }));
    expect(onBeginnen).toHaveBeenCalled();
  });

  it('wer nicht schreiben darf, sieht keinen Knopf, sondern den Hinweis auf die Leitung', () => {
    ansicht(NEU);
    expect(screen.queryByRole('button', { name: 'Protokoll beginnen' })).toBeNull();
    expect(screen.getByText(/Die Leitung beginnt es/)).toBeTruthy();
  });

  it('bei einem freigegebenen Protokoll gibt es nichts zu beginnen', () => {
    ansicht(ALT, vi.fn());
    expect(screen.queryByRole('button', { name: 'Protokoll beginnen' })).toBeNull();
  });
});
