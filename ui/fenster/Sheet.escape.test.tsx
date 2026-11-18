// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render } from '@testing-library/react';
import { Sheet } from './Sheet';
import { ConfirmDialog } from './ConfirmDialog';
import { FensterKnopf } from './FensterKnopf';

/**
 * Escape am `Sheet` (18.11.2026, Fund bei der Abnahme P2c/P2d: Plätze- und Gast-Fenster schlossen nicht mit Escape –
 * nur `ConfirmDialog` hörte). Escape wirkt wie der Klick daneben, und von übereinanderliegenden Fenstern schließt nur
 * das oberste.
 */
afterEach(cleanup);

const esc = () => fireEvent.keyDown(document, { key: 'Escape' });
const knoepfe = <FensterKnopf onClick={() => {}}>Speichern</FensterKnopf>;

describe('Sheet – Escape', () => {
  it('schließt das Fenster wie der Klick daneben', () => {
    const onClose = vi.fn();
    render(
      <Sheet title="Plätze" onClose={onClose} knoepfe={knoepfe}>
        <p>Inhalt</p>
      </Sheet>,
    );
    esc();
    expect(onClose).toHaveBeenCalledTimes(1);
    fireEvent.keyDown(document, { key: 'Enter' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('nimmt `onHintergrund` – ein Fenster mit ungespeicherten Änderungen bleibt offen', () => {
    const onClose = vi.fn();
    const onHintergrund = vi.fn();
    render(
      <Sheet title="Infos" onClose={onClose} onHintergrund={onHintergrund} knoepfe={knoepfe}>
        <p>Inhalt</p>
      </Sheet>,
    );
    esc();
    expect(onHintergrund).toHaveBeenCalledTimes(1);
    expect(onClose).not.toHaveBeenCalled();
  });

  it('auch im alten Aufbau ohne Knöpfe', () => {
    const onClose = vi.fn();
    render(
      <Sheet title="Alt" onClose={onClose}>
        <p>Inhalt</p>
      </Sheet>,
    );
    esc();
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('tut nichts, solange etwas läuft – und schließt auch nicht das Fenster darunter', () => {
    const unten = vi.fn();
    const oben = vi.fn();
    render(
      <>
        <Sheet title="Unten" onClose={unten} knoepfe={knoepfe}>
          <p>Unten</p>
        </Sheet>
        <Sheet title="Oben" onClose={oben} knoepfe={knoepfe} beschaeftigt>
          <p>Oben</p>
        </Sheet>
      </>,
    );
    esc();
    expect(oben).not.toHaveBeenCalled();
    expect(unten).not.toHaveBeenCalled();
  });

  it('Rückfrage über dem Fenster: Escape schließt nur die Rückfrage, das nächste dann das Fenster', () => {
    const onClose = vi.fn();
    const onCancel = vi.fn();
    const { rerender } = render(
      <Sheet title="Plätze" onClose={onClose} knoepfe={knoepfe}>
        <p>Inhalt</p>
      </Sheet>,
    );
    rerender(
      <Sheet title="Plätze" onClose={onClose} knoepfe={knoepfe}>
        <ConfirmDialog
          title="Gesang ist voll"
          message="Platz dazunehmen?"
          confirmLabel="Platz dazunehmen"
          harmlos
          onConfirm={() => {}}
          onCancel={onCancel}
        />
      </Sheet>,
    );
    esc();
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onClose).not.toHaveBeenCalled();

    rerender(
      <Sheet title="Plätze" onClose={onClose} knoepfe={knoepfe}>
        <p>Inhalt</p>
      </Sheet>,
    );
    esc();
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('Meldung ohne Abbrechen über dem Fenster: Escape rutscht nicht zum Fenster durch', () => {
    const onClose = vi.fn();
    const { rerender } = render(
      <Sheet title="Senden" onClose={onClose} knoepfe={knoepfe}>
        <p>Inhalt</p>
      </Sheet>,
    );
    rerender(
      <Sheet title="Senden" onClose={onClose} knoepfe={knoepfe}>
        <ConfirmDialog
          title="Gesendet"
          message="Alles angekommen."
          confirmLabel="OK"
          cancelLabel={null}
          harmlos
          onConfirm={() => {}}
          onCancel={() => {}}
        />
      </Sheet>,
    );
    esc();
    expect(onClose).not.toHaveBeenCalled();
  });

  it('nach dem Schließen hört das Fenster nicht mehr hin', () => {
    const onClose = vi.fn();
    const { unmount } = render(
      <Sheet title="Plätze" onClose={onClose} knoepfe={knoepfe}>
        <p>Inhalt</p>
      </Sheet>,
    );
    unmount();
    esc();
    expect(onClose).not.toHaveBeenCalled();
  });
});
