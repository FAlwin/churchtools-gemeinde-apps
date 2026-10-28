// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { SeitenGeruest } from './SeitenGeruest';
import { KopfKnopf } from '@ui/bedienung/KopfKnopf';

const schalter = vi.hoisted(() => ({ vollbildKnopf: false }));
vi.mock('../services/funktionen', async (original) => ({
  funktionen: {
    ...(await original<typeof import('../services/funktionen')>()).funktionen,
    get vollbildKnopf() {
      return schalter.vollbildKnopf;
    },
  },
}));

/**
 * **Das gemeinsame Gerüst aller Bildschirme** (22.09.2026, Wunsch Alwin: „bitte alles gleich mit
 * dem Header und den sachen").
 *
 * Geprüft wird das, was vorher jede Seite selbst zusammengesetzt hat und worin sie auseinanderliefen:
 * die Überschrift im Inhalt, die Leiste nur dort, wo es etwas anzutippen gibt, und – am wichtigsten –
 * dass die Überlagerung NEBEN dem Scroll-Bereich liegt. Läge sie darin, scrollten der Plus-Knopf der
 * Abwesenheiten und die Speichern-Leiste mit weg.
 */
function scrollBereich(container: HTMLElement): HTMLElement {
  const el = container.querySelector('[class*="scroll"]');
  if (!el) throw new Error('Scroll-Bereich nicht gefunden');
  return el as HTMLElement;
}

describe('SeitenGeruest', () => {
  it('setzt den Titel als Überschrift in den Inhalt', () => {
    const { container } = render(<SeitenGeruest titel="Termine">Liste</SeitenGeruest>);
    const titel = screen.getByRole('heading', { name: 'Termine' });
    expect(scrollBereich(container).contains(titel)).toBe(true);
  });

  it('zeigt ohne Zurück und ohne Aktionen gar keine Leiste', () => {
    render(<SeitenGeruest titel="Mehr">Inhalt</SeitenGeruest>);
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('zeigt die Leiste mit Zurück und Aktionen', () => {
    const zurueck = vi.fn();
    render(
      <SeitenGeruest
        titel="Ablauf"
        unterzeile="Sonntag, 5. Oktober · 10:00"
        zurueck={zurueck}
        zurueckLabel="Termine"
        aktionen={<button>Teilen</button>}
      >
        Inhalt
      </SeitenGeruest>,
    );
    expect(screen.getByRole('button', { name: /Termine/ })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Teilen' })).toBeTruthy();
    expect(screen.getByText('Sonntag, 5. Oktober · 10:00')).toBeTruthy();
  });

  /**
   * **Seitenkopf im ChurchTools-Stil** (Scheibe S, 26.10.2026): Zurück und Aktionen stehen in einer Karte IM Inhalt
   * (sie scrollen mit, wie in ChurchTools); „Zurück“ zeigt sein Ziel als Text („← Termine“) und heißt für
   * Screenreader „Zurück zu Termine“. Vorher schwebten runde Knöpfe neben dem Scroll-Bereich.
   */
  it('setzt Zurück und Aktionen in eine Kopfkarte im Inhalt, Zurück mit Ziel als Text', () => {
    const { container } = render(
      <SeitenGeruest
        titel="Ablauf"
        zurueck={() => {}}
        zurueckLabel="Termine"
        aktionen={<button>Teilen</button>}
      >
        Inhalt
      </SeitenGeruest>,
    );
    const zurueck = screen.getByRole('button', { name: 'Zurück zu Termine' });
    expect(zurueck.textContent).toBe('Termine');
    expect(scrollBereich(container).contains(zurueck)).toBe(true);
    const karte = zurueck.closest('[class*="karte"]');
    expect(karte).not.toBeNull();
    expect(karte!.contains(screen.getByRole('button', { name: 'Teilen' }))).toBe(true);
    expect(karte!.contains(screen.getByRole('heading', { name: 'Ablauf' }))).toBe(true);
  });

  it('hängt die Überlagerung neben den Scroll-Bereich, nicht hinein', () => {
    const { container } = render(
      <SeitenGeruest titel="Abwesenheiten" ueberlagerung={<button>Zeitraum eintragen</button>}>
        Inhalt
      </SeitenGeruest>,
    );
    const plus = screen.getByRole('button', { name: 'Zeitraum eintragen' });
    expect(scrollBereich(container).contains(plus)).toBe(false);
  });

  it('gibt das Neuladen an den Scroll-Bereich weiter', () => {
    const { container } = render(
      <SeitenGeruest titel="Lieder" onNeuLaden={() => Promise.resolve()}>
        Inhalt
      </SeitenGeruest>,
    );
    // Der Zug-Anzeiger hängt NEBEN dem Scroll-Bereich (feste Stelle, unter dem Unschärfe-Band von
    // iOS) – ohne onNeuLaden gäbe es ihn gar nicht.
    const zug = container.querySelector('[class*="pullIndicator"]');
    expect(zug).not.toBeNull();
    expect(scrollBereich(container).contains(zug)).toBe(false);
  });
});

/**
 * Der Vollbild-Knopf der Erweiterung steht auf JEDER Seite an derselben Stelle – ganz rechts oben,
 * nach den Knöpfen der Seite (Alwin, 08.10.2026: „bei Terminen gibt es ihn nicht, bei Mehr nicht").
 */
describe('SeitenGeruest – Vollbild-Knopf', () => {
  it('Erweiterung: auch auf einer Seite ohne eigene Knöpfe (Termine, Mehr)', () => {
    schalter.vollbildKnopf = true;
    render(<SeitenGeruest titel="Mehr">Inhalt</SeitenGeruest>);
    expect(screen.getByTitle('Vollbild')).toBeTruthy();
    schalter.vollbildKnopf = false;
  });

  // Alwin, 09.10.2026: „jetzt stehen die Überschriften extrem tief" – der Knopf allein macht aus einer Übersicht
  // keine Detailansicht: Titel und Vollbild in EINER Zeile, ohne Karte; erst Zurück bringt die Kopfkarte.
  it('der Vollbild-Knopf allein macht keine Kopfkarte – Zurück schon', () => {
    schalter.vollbildKnopf = true;
    render(<SeitenGeruest titel="Termine">Inhalt</SeitenGeruest>);
    expect(screen.getByRole('heading', { name: 'Termine' }).closest('[class*="karte"]')).toBeNull();
    render(
      <SeitenGeruest titel="Ablauf" zurueck={vi.fn()}>
        Inhalt
      </SeitenGeruest>,
    );
    expect(
      screen.getByRole('heading', { name: 'Ablauf' }).closest('[class*="karte"]'),
    ).not.toBeNull();
    schalter.vollbildKnopf = false;
  });

  it('Erweiterung: ganz rechts, nach den Knöpfen der Seite', () => {
    schalter.vollbildKnopf = true;
    render(
      <SeitenGeruest
        titel="Ablauf"
        zurueck={vi.fn()}
        aktionen={<KopfKnopf onClick={vi.fn()} label="Teilen" symbol={<b>T</b>} />}
      >
        Inhalt
      </SeitenGeruest>,
    );
    const knoepfe = screen.getAllByRole('button').map((b) => b.getAttribute('title'));
    expect(knoepfe.at(-1)).toBe('Vollbild');
    schalter.vollbildKnopf = false;
  });
});
