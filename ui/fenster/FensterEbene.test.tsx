// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { BEREICH_ATTRIBUT } from '../erweiterung/cssBereich';
import { ConfirmDialog } from './ConfirmDialog';
import { Sheet } from './Sheet';
import { AuswahlFenster } from '../bedienung/OptionWaehlen';

/**
 * **Jedes Fenster liegt ganz oben** (Alwin am iPhone, 20.11.2026: in „Wann kann ich?“ lag das schwebende Plus über dem
 * Fenster). Ursache war nicht die Zahl, sondern der Ort im DOM: Ein Fenster in einem Kasten mit eigenem Stapel
 * (`position: sticky; z-index: 2`) ist mit seinen 100 dort eingesperrt. jsdom rechnet keine Stapel – also prüft der Test den
 * Ort: Das Fenster hängt in `#root`, aber NICHT in dem Kasten, aus dem es aufgerufen wurde.
 */
let wurzel: HTMLElement;
beforeEach(() => {
  wurzel = document.createElement('div');
  wurzel.id = 'root';
  document.body.appendChild(wurzel);
});
afterEach(() => {
  cleanup();
  wurzel.remove();
});

/** Ein Kasten, der einen Stapel aufmacht – wie die klebende Leiste in „Wann kann ich?“. */
function Kasten({ children }: { children: React.ReactNode }) {
  return (
    <div data-testid="kasten" style={{ position: 'sticky', zIndex: 2 }}>
      {children}
    </div>
  );
}
const inKasten = (el: HTMLElement) => screen.getByTestId('kasten').contains(el);

describe('FensterEbene – Fenster hängen unter #root, nie im Inhalt', () => {
  const faelle: [string, React.ReactElement, string][] = [
    [
      'Sheet im ChurchTools-Aufbau',
      <Sheet title="Zeitraum eintragen" onClose={() => {}} knoepfe={null}>
        <p>Inhalt</p>
      </Sheet>,
      'dialog',
    ],
    [
      'Sheet im alten Aufbau',
      <Sheet title="Alt" onClose={() => {}}>
        <p>Inhalt</p>
      </Sheet>,
      '',
    ],
    [
      'ConfirmDialog',
      <ConfirmDialog
        title="Löschen?"
        message="Wirklich?"
        confirmLabel="Löschen"
        onConfirm={() => {}}
        onCancel={() => {}}
      />,
      'alertdialog',
    ],
    [
      'AuswahlFenster (⋯, Ansicht, Neu)',
      <AuswahlFenster
        titel="Mehr"
        optionen={[{ label: 'Teilen', onClick: () => {} }]}
        onClose={() => {}}
      />,
      'dialog',
    ],
  ];

  it.each(faelle)('%s: in #root, außerhalb des Kastens', (_n, fenster, rolle) => {
    render(<Kasten>{fenster}</Kasten>, {
      container: wurzel.appendChild(document.createElement('div')),
    });
    const dialog = rolle ? screen.getByRole(rolle) : screen.getByText('Inhalt').parentElement!;
    expect(inKasten(dialog)).toBe(false);
    expect(wurzel.contains(dialog)).toBe(true);
    // Die Fenster-Ebene ist ein DIREKTES Kind von #root – kein Stapel dazwischen.
    expect(dialog.closest('[data-fenster-ebene]')?.parentElement).toBe(wurzel);
  });

  it('mehrere Fenster teilen sich EINE Ebene, das spätere liegt darüber (Reihenfolge des Öffnens)', () => {
    render(
      <>
        <Sheet title="Eins" onClose={() => {}} knoepfe={null}>
          <p>a</p>
        </Sheet>
        <ConfirmDialog
          title="Zwei"
          message="m"
          confirmLabel="Ja"
          onConfirm={() => {}}
          onCancel={() => {}}
        />
      </>,
      { container: wurzel.appendChild(document.createElement('div')) },
    );
    expect(wurzel.querySelectorAll('[data-fenster-ebene]')).toHaveLength(1);
    const ebene = wurzel.querySelector('[data-fenster-ebene]')!;
    const rollen = [...ebene.querySelectorAll('[role=dialog],[role=alertdialog]')].map((e) =>
      e.getAttribute('role'),
    );
    expect(rollen).toEqual(['dialog', 'alertdialog']);
  });

  it('ohne #root (Tests, andere Seiten) hängt es an `body`, im App-Bereich', () => {
    wurzel.remove();
    render(
      <Kasten>
        <Sheet title="Allein" onClose={() => {}} knoepfe={null}>
          <p>x</p>
        </Sheet>
      </Kasten>,
    );
    const dialog = screen.getByRole('dialog');
    expect(inKasten(dialog)).toBe(false);
    expect(dialog.closest(`[${BEREICH_ATTRIBUT}]`)?.parentElement).toBe(document.body);
    document.body.appendChild(wurzel); // damit afterEach aufräumen kann
  });
});
