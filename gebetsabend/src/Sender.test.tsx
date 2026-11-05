// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { act, render, screen, within } from '@testing-library/react';
import { uhrText } from '@shared/ct/zeit';
import { ERLAUBNIS_SENDER, senderLink, VDO_HERKUNFT } from '@shared/gebetsabend/links';
import { WER_HOERT_TEXT } from '@shared/gebetsabend/werHoert';
import { neuerZugang } from '@shared/gebetsabend/zugang';
import { Sender } from './Sender';

const zugang = neuerZugang(true, '2026-11-12T18:30:00.000Z');

/** Eine Meldung in der Form von VDO.Ninja – aus dem echten iframe der Seite oder von woanders. */
function melden(daten: unknown, opt: { herkunft?: string; vonSender?: boolean } = {}) {
  const iframe = document.querySelector('iframe');
  act(() => {
    window.dispatchEvent(
      new MessageEvent('message', {
        data: daten,
        origin: opt.herkunft ?? VDO_HERKUNFT,
        source: opt.vonSender === false ? window : (iframe?.contentWindow ?? null),
      }),
    );
  });
}
const kommt = (uuid: string, label?: string) => {
  melden({ action: 'push-connection', value: true, UUID: uuid });
  if (label !== undefined) melden({ action: 'push-connection-info', value: { label }, UUID: uuid });
};
const namen = () =>
  within(screen.getByRole('list', { name: 'Wer hört zu?' }))
    .getAllByRole('listitem')
    .map((li) => li.textContent);

describe('Sender', () => {
  it('lädt den Sender-Link mit Kamera/Mikrofon-Erlaubnis; ohne Zuhörer „Noch hört niemand zu.“', () => {
    render(<Sender zugang={zugang} />);
    const iframe = document.querySelector('iframe')!;
    expect(iframe.src).toBe(senderLink(zugang));
    expect(iframe.getAttribute('allow')).toBe(ERLAUBNIS_SENDER);
    expect(screen.getByText(WER_HOERT_TEXT.niemand)).toBeTruthy();
    expect(screen.getByRole('heading', { name: /Wer hört zu\? 0/ })).toBeTruthy();
  });

  it('Zuhörer kommen und gehen – mit Name, Zahl und „seit“', () => {
    render(<Sender zugang={zugang} />);
    kommt('a', 'Maria Klassen');
    kommt('b', 'Helene Wiebe');
    expect(screen.getByRole('heading', { name: /Wer hört zu\? 2/ })).toBeTruthy();
    expect(namen()[0]).toContain('Helene Wiebe');
    expect(namen()[1]).toContain('Maria Klassen');
    expect(namen()[0]).toMatch(new RegExp(`seit ${uhrText(new Date().toISOString())} Uhr`));
    melden({ action: 'push-connection', value: false, UUID: 'a' });
    expect(namen()).toHaveLength(1);
    expect(screen.getByRole('heading', { name: /Wer hört zu\? 1/ })).toBeTruthy();
  });

  it('ohne Namen (weitergegebener Link) → „Ohne Namen“, je Verbindung gezählt', () => {
    render(<Sender zugang={zugang} />);
    kommt('a');
    kommt('b', '');
    expect(namen()).toHaveLength(1);
    expect(namen()[0]).toContain(WER_HOERT_TEXT.ohneName);
    expect(namen()[0]).toContain('2 Verbindungen');
    expect(screen.getByRole('heading', { name: /Wer hört zu\? 2/ })).toBeTruthy();
  });

  it('Meldungen von fremder Herkunft oder aus einem anderen Fenster zählen NICHT', () => {
    render(<Sender zugang={zugang} />);
    melden(
      { action: 'push-connection', value: true, UUID: 'x' },
      { herkunft: 'https://boese.example' },
    );
    melden({ action: 'push-connection', value: true, UUID: 'y' }, { vonSender: false });
    expect(screen.getByText(WER_HOERT_TEXT.niemand)).toBeTruthy();
  });
});
