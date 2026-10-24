// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { ConfirmDialog } from './ConfirmDialog';
import { FensterKnopf } from './FensterKnopf';
import { Sheet } from './Sheet';

/**
 * „Passt nicht nebeneinander → untereinander“ (Alwin, F3 #726). jsdom kennt kein Layout – darum spielt der Test die
 * Breiten nach: Nebeneinander gemessen (`data-messen`) braucht die Zeile `breit` Pixel, Platz hat sie 400.
 */
function breiteNachspielen(breit: number) {
  vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(400);
  vi.spyOn(HTMLElement.prototype, 'scrollWidth', 'get').mockImplementation(function (
    this: HTMLElement,
  ) {
    return this.hasAttribute('data-messen') ? breit : 400;
  });
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const fussVon = (knopf: string) => screen.getByRole('button', { name: knopf }).parentElement!;

describe('useKnopfZeile', () => {
  it('Sheet: zu breit nebeneinander → untereinander (`data-stapel`), das Messen hinterlässt nichts', () => {
    breiteNachspielen(520);
    render(
      <Sheet title="T" onClose={vi.fn()} knoepfe={<FensterKnopf>„Treu" verwenden</FensterKnopf>}>
        <p>Inhalt</p>
      </Sheet>,
    );
    const fuss = fussVon('„Treu" verwenden');
    expect(fuss.hasAttribute('data-stapel')).toBe(true);
    expect(fuss.hasAttribute('data-messen')).toBe(false);
  });

  it('Sheet: passt nebeneinander → bleibt rechts unten nebeneinander', () => {
    breiteNachspielen(300);
    render(
      <Sheet title="T" onClose={vi.fn()} knoepfe={<FensterKnopf>Speichern</FensterKnopf>}>
        <p>Inhalt</p>
      </Sheet>,
    );
    expect(fussVon('Speichern').hasAttribute('data-stapel')).toBe(false);
  });

  it('wird eine Beschriftung länger, misst die Zeile neu', async () => {
    // Nebeneinander so breit wie 10 px je Zeichen – „Speichern“ passt, die lange Fassung nicht.
    vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(400);
    vi.spyOn(HTMLElement.prototype, 'scrollWidth', 'get').mockImplementation(function (
      this: HTMLElement,
    ) {
      return this.hasAttribute('data-messen') ? (this.textContent?.length ?? 0) * 10 : 400;
    });
    const fenster = (text: string) => (
      <Sheet
        title="T"
        onClose={vi.fn()}
        cancelLabel={null}
        knoepfe={<FensterKnopf>{text}</FensterKnopf>}
      >
        <p>Inhalt</p>
      </Sheet>
    );
    const { rerender } = render(fenster('Speichern'));
    expect(fussVon('Speichern').hasAttribute('data-stapel')).toBe(false);
    rerender(fenster('Wird gespeichert und an alle 47 Personen geschickt …'));
    await waitFor(() =>
      expect(
        fussVon('Wird gespeichert und an alle 47 Personen geschickt …').hasAttribute('data-stapel'),
      ).toBe(true),
    );
  });

  it('ConfirmDialog: dieselbe Regel', () => {
    breiteNachspielen(520);
    render(
      <ConfirmDialog
        title="Löschen?"
        message="Wirklich?"
        confirmLabel="Löschen"
        zweit={{ label: 'Nur für diesen Termin neu', onClick: vi.fn() }}
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />,
    );
    expect(fussVon('Löschen').hasAttribute('data-stapel')).toBe(true);
  });
});
