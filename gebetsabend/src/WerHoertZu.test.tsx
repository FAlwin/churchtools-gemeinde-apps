// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { uhrText } from '@shared/ct/zeit';
import {
  KEINE_VERBINDUNGEN,
  verbindungenNach,
  WER_HOERT_TEXT,
  type Verbindungen,
} from '@shared/gebetsabend/werHoert';
import { WerHoertZu } from './WerHoertZu';

const JETZT = '2026-11-12T18:31:00.000Z';

/** Verbindungen so, wie sie aus den Meldungen des Senders entstehen – mit dem Erzeuger, nicht von Hand. */
function aus(...wer: [uuid: string, label?: string][]): Verbindungen {
  return wer.reduce<Verbindungen>((v, [uuid, label]) => {
    const da = verbindungenNach(v, { action: 'push-connection', value: true, uuid }, JETZT);
    return label === undefined
      ? da
      : verbindungenNach(da, { action: 'push-connection-info', value: { label }, uuid }, JETZT);
  }, KEINE_VERBINDUNGEN);
}

const zeilen = () =>
  within(screen.getByRole('list', { name: 'Wer hört zu?' }))
    .getAllByRole('listitem')
    .map((li) => li.textContent);
const kopf = () =>
  screen.getByRole('region', { name: 'Wer hört zu?' }).firstElementChild!.textContent;

describe('WerHoertZu', () => {
  it('ohne Zuhörer: Zahl 0 und „Noch hört niemand zu.“', () => {
    render(<WerHoertZu verbindungen={KEINE_VERBINDUNGEN} />);
    expect(kopf()).toBe('Wer hört zu?0');
    expect(screen.getByText(WER_HOERT_TEXT.niemand)).toBeTruthy();
  });

  it('Personen A–Z mit Kreis (Initialen) und „seit“; zwei Geräte einer Person zählen einmal', () => {
    render(
      <WerHoertZu
        verbindungen={aus(['a', 'Maria Klassen'], ['b', 'Helene Wiebe'], ['c', 'Maria Klassen'])}
      />,
    );
    expect(kopf()).toBe('Wer hört zu?2');
    const [helene, maria] = zeilen();
    expect(helene).toBe(`HWHelene Wiebeseit ${uhrText(JETZT)} Uhr`);
    expect(maria).toBe(`MKMaria Klassenseit ${uhrText(JETZT)} Uhr · 2 Geräte`);
  });

  it('ohne Namen (weitergegebener Link): „Ohne Namen“, je Verbindung gezählt', () => {
    render(<WerHoertZu verbindungen={aus(['a'], ['b', ''])} />);
    expect(kopf()).toBe('Wer hört zu?2');
    expect(zeilen()).toEqual([
      `?${WER_HOERT_TEXT.ohneName}seit ${uhrText(JETZT)} Uhr · 2 Verbindungen`,
    ]);
  });
});
