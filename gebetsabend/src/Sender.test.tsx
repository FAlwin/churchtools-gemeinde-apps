// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { act, render } from '@testing-library/react';
import { ERLAUBNIS_SENDER, senderLink, VDO_HERKUNFT } from '@shared/gebetsabend/links';
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

describe('Sender', () => {
  it('lädt den Sender-Link mit Kamera/Mikrofon-Erlaubnis', () => {
    render(<Sender zugang={zugang} onMeldung={() => undefined} />);
    const iframe = document.querySelector('iframe')!;
    expect(iframe.src).toBe(senderLink(zugang));
    expect(iframe.getAttribute('allow')).toBe(ERLAUBNIS_SENDER);
  });

  it('reicht Meldungen aus dem eigenen iframe weiter – mit UUID', () => {
    const meldung = vi.fn();
    render(<Sender zugang={zugang} onMeldung={meldung} />);
    melden({ action: 'push-connection', value: true, UUID: 'a' });
    expect(meldung).toHaveBeenCalledWith({ action: 'push-connection', value: true, uuid: 'a' });
  });

  it('Meldungen von fremder Herkunft oder aus einem anderen Fenster zählen NICHT', () => {
    const meldung = vi.fn();
    render(<Sender zugang={zugang} onMeldung={meldung} />);
    melden(
      { action: 'push-connection', value: true, UUID: 'x' },
      { herkunft: 'https://boese.example' },
    );
    melden({ action: 'push-connection', value: true, UUID: 'y' }, { vonSender: false });
    expect(meldung).not.toHaveBeenCalled();
  });
});
