// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, cleanup, fireEvent, act } from '@testing-library/react';
import { StrictMode } from 'react';
import type { AgendaItem } from '@shared/types/index';
import { AgendaFullView } from './AgendaFullView';
import { HINWEIS_MS } from '../hooks/useKurzerHinweis';

/**
 * #198: Diese Ansicht lag in `Setlist.tsx` und war damit ungetestet – obwohl sie das ist, worauf
 * im Gottesdienst geschaut wird.
 *
 * Zwei Dinge sind hier heikel und deshalb festgehalten:
 *  - Die **Lied-Nummer** beim Antippen. Sie zählt nur LIEDER, nicht alle Ablaufpunkte. Stimmt sie
 *    nicht, landet man beim falschen Chart – mitten im Gottesdienst.
 *  - **Entfernte Punkte** dürfen nicht kommentarlos verschwinden – auch die nicht, die der Server
 *    nicht kennt (#178). Seit 12.10.2026 nennt sie ein Hinweis unten, statt sie zerfallen zu lassen.
 */
function item(over: Partial<AgendaItem> = {}): AgendaItem {
  return {
    id: 1,
    title: 'Punkt',
    time: null,
    durationMin: null,
    note: '',
    isHeader: false,
    song: null,
    responsible: [],
    responsibleText: '',
    ...over,
  } as unknown as AgendaItem;
}

/** Ein Lied-Punkt (hat ein `song`). */
function songItem(id: number, title: string): AgendaItem {
  return item({ id, title, song: { title, songId: id, arrangementId: id } as never });
}

afterEach(cleanup);

describe('AgendaFullView – Zeilen', () => {
  it('zeigt Überschriften als eigenes Band', () => {
    render(
      <AgendaFullView
        items={[item({ id: 1, title: 'Lobpreis', isHeader: true })]}
        eventId={1}
        onSelect={vi.fn()}
      />,
    );
    expect(screen.getByText('Lobpreis')).toBeTruthy();
  });

  it('zeigt Uhrzeit, Dauer, Notiz und Zuständige', () => {
    render(
      <AgendaFullView
        items={[
          item({
            id: 1,
            title: 'Begrüßung',
            time: '10:00',
            durationMin: 5,
            note: 'Kurz halten',
            responsible: [{ label: 'Anna', open: false }] as never,
          }),
        ]}
        eventId={1}
        onSelect={vi.fn()}
      />,
    );
    expect(screen.getByText('10:00')).toBeTruthy();
    expect(screen.getByText('5 Min')).toBeTruthy();
    expect(screen.getByText('Kurz halten')).toBeTruthy();
    expect(screen.getByText('Anna')).toBeTruthy();
  });

  it('eine in ChurchTools ausgeblendete Uhrzeit bleibt leer', () => {
    const { container } = render(
      <AgendaFullView items={[item({ time: null })]} eventId={1} onSelect={vi.fn()} />,
    );
    expect(container.textContent).not.toMatch(/\d{2}:\d{2}/);
  });
});

describe('AgendaFullView – meldet, dass sie steht', () => {
  it('meldet „sichtbar" erst nach dem Einhängen und „weg" beim Aushängen (fürs Gesehen-Merken)', () => {
    // Die Ablaufseite wird nachgeladen; die Daten kamen vorher an und galten schon als gesehen, bevor
    // die Ansicht sie zeigen konnte (12.10.2026). Gemerkt werden darf erst nach diesem Signal.
    const onSichtbar = vi.fn();
    const { unmount } = render(
      <AgendaFullView
        items={[item({ id: 1 })]}
        eventId={1}
        onSelect={vi.fn()}
        onSichtbar={onSichtbar}
      />,
    );
    expect(onSichtbar).toHaveBeenLastCalledWith(true);
    unmount();
    expect(onSichtbar).toHaveBeenLastCalledWith(false);
  });
});

describe('AgendaFullView – Lied antippen', () => {
  it('zählt beim Antippen nur LIEDER, nicht alle Punkte', () => {
    const onSelect = vi.fn();
    render(
      <AgendaFullView
        items={[
          item({ id: 1, title: 'Begrüßung' }), // kein Lied
          songItem(2, 'Erstes Lied'),
          item({ id: 3, title: 'Predigt' }), // kein Lied
          songItem(4, 'Zweites Lied'),
        ]}
        eventId={1}
        onSelect={onSelect}
      />,
    );
    screen.getByText('Zweites Lied').closest('button')!.click();
    expect(onSelect).toHaveBeenCalledWith(1); // zweites LIED = Index 1
  });

  it('Punkte ohne Lied sind nicht antippbar', () => {
    const { container } = render(
      <AgendaFullView items={[item({ title: 'Predigt' })]} eventId={1} onSelect={vi.fn()} />,
    );
    expect(container.querySelectorAll('button')).toHaveLength(0);
  });
});

/** Der Hinweis unten (12.10.2026, Variante C) – `null`, wenn keiner da ist. */
function hinweis(): string | null {
  return screen.queryByRole('status')?.textContent ?? null;
}

/** Die Zeile eines Punkts samt Schildchen. */
function zeile(titel: string): string {
  return screen.getByText(titel).closest('div')!.parentElement!.textContent ?? '';
}

describe('AgendaFullView – Hinweis und Schildchen statt Aufleuchten und Zerfallen (12.10.2026)', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('nennt einen vom Server gemeldeten entfernten Punkt – als Zeile steht er NICHT da', () => {
    const { container } = render(
      <AgendaFullView
        items={[
          item({ id: 1, title: 'Bleibt' }),
          { id: 9, title: 'Weg damit', removed: true } as unknown as AgendaItem,
        ]}
        eventId={1}
        onSelect={vi.fn()}
      />,
    );
    expect(hinweis()).toContain('Ablauf aktualisiert');
    expect(hinweis()).toContain('Entfernt: Weg damit');
    const ohneHinweis = (container.textContent ?? '').replace(hinweis() ?? '', '');
    expect(ohneHinweis).not.toContain('Weg damit');
  });

  it('zählt neu und geändert getrennt und zeigt das passende Schildchen', () => {
    render(
      <AgendaFullView
        items={[
          item({ id: 1, title: 'Begrüßung' }),
          item({ id: 2, title: 'Gebet', changed: true, neu: true }),
          item({ id: 3, title: 'Predigt', changed: true, neu: false }),
        ]}
        eventId={1}
        onSelect={vi.fn()}
      />,
    );
    expect(hinweis()).toContain('Ablauf aktualisiert · 1 neu · 1 geändert');
    expect(zeile('Gebet')).toContain('neu');
    expect(zeile('Predigt')).toContain('geändert');
    expect(zeile('Begrüßung')).not.toMatch(/neu|geändert/);
  });

  it('ohne Änderungen gibt es keinen Hinweis', () => {
    render(<AgendaFullView items={[item({ id: 1 })]} eventId={1} onSelect={vi.fn()} />);
    expect(hinweis()).toBeNull();
  });

  it('Hinweis und Schildchen verschwinden zusammen – „nur ein kurzer Hinweis und fertig"', () => {
    render(
      <AgendaFullView
        items={[item({ id: 2, title: 'Gebet', changed: true, neu: true })]}
        eventId={1}
        onSelect={vi.fn()}
      />,
    );
    act(() => void vi.advanceTimersByTime(HINWEIS_MS - 1));
    expect(hinweis()).not.toBeNull();
    expect(zeile('Gebet')).toContain('neu');
    act(() => void vi.advanceTimersByTime(1));
    expect(hinweis()).toBeNull();
    expect(zeile('Gebet')).not.toContain('neu');
  });

  it('ein Abruf ohne Neuigkeiten (Markierungen nach dem Merken entfernt) schließt den Hinweis NICHT vorzeitig', () => {
    const { rerender } = render(
      <AgendaFullView
        items={[
          item({ id: 1, title: 'A' }),
          item({ id: 2, title: 'Gebet', changed: true, neu: true }),
        ]}
        eventId={1}
        onSelect={vi.fn()}
      />,
    );
    act(() => void vi.advanceTimersByTime(1000));
    // Derselbe Ablauf ohne Markierungen – so sieht der gespeicherte Stand nach dem Gesehen-Merken aus.
    rerender(
      <AgendaFullView
        items={[item({ id: 1, title: 'A' }), item({ id: 2, title: 'Gebet' })]}
        eventId={1}
        onSelect={vi.fn()}
      />,
    );
    expect(hinweis()).toContain('1 neu');
    expect(zeile('Gebet')).toContain('neu');
    act(() => void vi.advanceTimersByTime(HINWEIS_MS - 1000));
    expect(hinweis()).toBeNull();
  });

  it('bei der nächsten Änderung trägt nur der neue Punkt ein Schildchen, nicht der von vorhin', () => {
    const { rerender } = render(
      <AgendaFullView
        items={[item({ id: 1, title: 'A', changed: true, neu: true })]}
        eventId={1}
        onSelect={vi.fn()}
      />,
    );
    // Der nächste Abruf: A ist inzwischen als gesehen gemerkt, B kam dazu.
    rerender(
      <AgendaFullView
        items={[item({ id: 1, title: 'A' }), item({ id: 2, title: 'B', changed: true, neu: true })]}
        eventId={1}
        onSelect={vi.fn()}
      />,
    );
    expect(zeile('B')).toContain('neu');
    expect(zeile('A')).not.toContain('neu');
    expect(hinweis()).toContain('1 neu');
  });

  it('kommt etwas dazu, erscheint der Hinweis wieder – derselbe Stand nicht noch einmal', () => {
    const a = [item({ id: 1, title: 'A', changed: true, neu: true })];
    const { rerender } = render(<AgendaFullView items={a} eventId={1} onSelect={vi.fn()} />);
    act(() => void vi.advanceTimersByTime(HINWEIS_MS));
    rerender(<AgendaFullView items={[...a]} eventId={1} onSelect={vi.fn()} />);
    expect(hinweis()).toBeNull();
    rerender(
      <AgendaFullView
        items={[...a, item({ id: 3, title: 'Drei', changed: true, neu: true })]}
        eventId={1}
        onSelect={vi.fn()}
      />,
    );
    expect(hinweis()).toContain('2 neu');
  });

  it('merkt selbst, wenn ein zuvor gezeigter Punkt verschwindet (#178)', () => {
    // Punkte, die nach dem Gesehen-Stand hinzukamen und wieder gelöscht wurden, kennt der Server
    // nicht – er meldet für sie keinen Platzhalter. Die Ansicht muss das selbst bemerken.
    const vorher = [item({ id: 1, title: 'Bleibt' }), item({ id: 2, title: 'Verschwindet' })];
    const { rerender } = render(<AgendaFullView items={vorher} eventId={1} onSelect={vi.fn()} />);
    expect(hinweis()).toBeNull();
    rerender(
      <AgendaFullView items={[item({ id: 1, title: 'Bleibt' })]} eventId={1} onSelect={vi.fn()} />,
    );
    expect(hinweis()).toContain('Entfernt: Verschwindet');
  });

  it('auch unter StrictMode (doppeltes Rendern im Dev-Build) kommen Schildchen und Hinweis an', () => {
    // Im Browser gefunden (12.10.2026): Der Abgleich lief über einen Ref, der beim ersten der beiden
    // Durchläufe schon umgestellt war – der zweite sah „nichts Neues" und verwarf das Ergebnis.
    const a = [item({ id: 1, title: 'A' })];
    const { rerender } = render(
      <StrictMode>
        <AgendaFullView items={a} eventId={1} onSelect={vi.fn()} />
      </StrictMode>,
    );
    rerender(
      <StrictMode>
        <AgendaFullView
          items={[...a, item({ id: 4, title: 'Kollekte', changed: true, neu: true })]}
          eventId={1}
          onSelect={vi.fn()}
        />
      </StrictMode>,
    );
    expect(zeile('Kollekte')).toContain('neu');
    expect(hinweis()).toContain('1 neu');
  });

  it('ein Terminwechsel meldet NICHTS (die Punkte gehören zu einem anderen Termin)', () => {
    const { rerender } = render(
      <AgendaFullView
        items={[item({ id: 1, title: 'Termin A' })]}
        eventId={1}
        onSelect={vi.fn()}
      />,
    );
    rerender(
      <AgendaFullView
        items={[item({ id: 5, title: 'Termin B' })]}
        eventId={2}
        onSelect={vi.fn()}
      />,
    );
    expect(hinweis()).toBeNull();
  });

  it('ein Terminwechsel nimmt die Schildchen des alten Termins nicht mit', () => {
    const { rerender } = render(
      <AgendaFullView
        items={[item({ id: 1, title: 'A', changed: true, neu: true })]}
        eventId={1}
        onSelect={vi.fn()}
      />,
    );
    rerender(
      <AgendaFullView items={[item({ id: 1, title: 'A' })]} eventId={2} onSelect={vi.fn()} />,
    );
    expect(zeile('A')).not.toContain('neu');
  });

  it('ein zurückgeholter Punkt gilt nicht mehr als entfernt', () => {
    const zwei = [item({ id: 1, title: 'Eins' }), item({ id: 2, title: 'Zwei' })];
    const { rerender } = render(<AgendaFullView items={zwei} eventId={1} onSelect={vi.fn()} />);
    rerender(
      <AgendaFullView items={[item({ id: 1, title: 'Eins' })]} eventId={1} onSelect={vi.fn()} />,
    );
    expect(hinweis()).toContain('Entfernt: Zwei');
    rerender(<AgendaFullView items={[...zwei]} eventId={1} onSelect={vi.fn()} />);
    expect(hinweis()).toBeNull();
  });
});

/**
 * #423: Zwischen Vorlauf (Soundcheck, Gebet) und Veranstaltung steht die Linie „Beginn · 10:00 Uhr" –
 * nur, wenn es Vorlauf gibt.
 */
describe('AgendaFullView – Linie „Beginn" nach dem Vorlauf (#423)', () => {
  it('steht zwischen dem letzten Vorlauf-Punkt und dem ersten Punkt des Gottesdienstes', () => {
    render(
      <AgendaFullView
        items={[
          item({ id: 1, title: 'Soundcheck', time: '09:00', vorBeginn: true }),
          item({ id: 2, title: 'Begrüßung', time: '10:00', vorBeginn: false }),
        ]}
        eventId={1}
        beginn="10:00"
        onSelect={vi.fn()}
      />,
    );
    const linie = screen.getByRole('separator', { name: 'Beginn 10:00' });
    // Seit E6-O1 ein Balken wie in der ChurchTools-App: „Beginn“ links, die Uhrzeit rechts.
    expect(linie.textContent).toBe('Beginn10:00');
    const vorher = screen.getByText('Soundcheck');
    const nachher = screen.getByText('Begrüßung');
    // DOM-Reihenfolge: Soundcheck → Linie → Begrüßung.
    expect(vorher.compareDocumentPosition(linie) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(linie.compareDocumentPosition(nachher) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('ohne Vorlauf keine Linie', () => {
    render(
      <AgendaFullView
        items={[item({ id: 1, title: 'Begrüßung', vorBeginn: false })]}
        eventId={1}
        beginn="10:00"
        onSelect={vi.fn()}
      />,
    );
    expect(screen.queryByRole('separator')).toBeNull();
  });

  it('die Lied-Nummer zählt trotz Linie nur Lieder', () => {
    const onSelect = vi.fn();
    render(
      <AgendaFullView
        items={[
          { ...songItem(1, 'Einsingen'), vorBeginn: true },
          item({ id: 2, title: 'Begrüßung' }),
          songItem(3, 'Way Maker'),
        ]}
        eventId={1}
        beginn="10:00"
        onSelect={onSelect}
      />,
    );
    fireEvent.click(screen.getByText('Way Maker'));
    expect(onSelect).toHaveBeenCalledWith(1);
  });
});
