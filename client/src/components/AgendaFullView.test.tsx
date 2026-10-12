// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import type { AgendaItem } from '@shared/types/index';
import { AgendaFullView } from './AgendaFullView';

/**
 * #198: Diese Ansicht lag in `Setlist.tsx` und war damit ungetestet – obwohl sie das ist, worauf
 * im Gottesdienst geschaut wird.
 *
 * Zwei Dinge sind hier heikel und deshalb festgehalten:
 *  - Die **Lied-Nummer** beim Antippen. Sie zählt nur LIEDER, nicht alle Ablaufpunkte. Stimmt sie
 *    nicht, landet man beim falschen Chart – mitten im Gottesdienst.
 *  - **Entfernte Punkte** dürfen nicht kommentarlos verschwinden – auch die nicht, die der Server
 *    nicht kennt (#178). Seit 12.10.2026 nennt sie die Hinweisleiste oben, statt sie zerfallen zu lassen.
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

/** Die Hinweisleiste über dem Ablauf (12.10.2026) – `null`, wenn keine da ist. */
function leiste(): string | null {
  return screen.queryByRole('status')?.textContent ?? null;
}

describe('AgendaFullView – Hinweisleiste statt Aufleuchten und Zerfallen (12.10.2026)', () => {
  it('nennt einen vom Server gemeldeten entfernten Punkt – als Zeile steht er NICHT mehr da', () => {
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
    expect(leiste()).toContain('Ablauf aktualisiert');
    expect(leiste()).toContain('Entfernt: Weg damit');
    // Außerhalb der Leiste taucht der Titel nicht auf.
    const ohneLeiste = (container.textContent ?? '').replace(leiste() ?? '', '');
    expect(ohneLeiste).not.toContain('Weg damit');
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
    expect(leiste()).toContain('Ablauf aktualisiert · 1 neu · 1 geändert');
    const zeile = (t: string) => screen.getByText(t).closest('div')!.parentElement!.textContent;
    expect(zeile('Gebet')).toContain('neu');
    expect(zeile('Predigt')).toContain('geändert');
    expect(zeile('Begrüßung')).not.toMatch(/neu|geändert/);
  });

  it('ohne Änderungen gibt es keine Leiste', () => {
    render(<AgendaFullView items={[item({ id: 1 })]} eventId={1} onSelect={vi.fn()} />);
    expect(leiste()).toBeNull();
  });

  it('merkt selbst, wenn ein zuvor gezeigter Punkt verschwindet (#178)', () => {
    // Punkte, die erst nach dem Betreten hinzukamen und wieder gelöscht wurden, stehen NICHT in der
    // „gesehen"-Basislinie des Servers – er meldet für sie keinen Platzhalter. Die Ansicht muss das
    // selbst bemerken, sonst verschwindet die Zeile kommentarlos.
    const vorher = [item({ id: 1, title: 'Bleibt' }), item({ id: 2, title: 'Verschwindet' })];
    const { rerender } = render(<AgendaFullView items={vorher} eventId={1} onSelect={vi.fn()} />);
    expect(leiste()).toBeNull();
    rerender(
      <AgendaFullView items={[item({ id: 1, title: 'Bleibt' })]} eventId={1} onSelect={vi.fn()} />,
    );
    expect(leiste()).toContain('Entfernt: Verschwindet');
  });

  it('ein lokal bemerkter entfernter Punkt bleibt in der Leiste stehen (zerfällt nicht mehr)', () => {
    vi.useFakeTimers();
    try {
      const vorher = [item({ id: 1, title: 'Bleibt' }), item({ id: 2, title: 'Weg' })];
      const { rerender } = render(<AgendaFullView items={vorher} eventId={1} onSelect={vi.fn()} />);
      rerender(
        <AgendaFullView
          items={[item({ id: 1, title: 'Bleibt' })]}
          eventId={1}
          onSelect={vi.fn()}
        />,
      );
      vi.advanceTimersByTime(5 * 60_000);
      // Ein neuer Stand vom Server (neues Array) darf ihn nicht vergessen lassen.
      rerender(
        <AgendaFullView
          items={[item({ id: 1, title: 'Bleibt' })]}
          eventId={1}
          onSelect={vi.fn()}
        />,
      );
      expect(leiste()).toContain('Entfernt: Weg');
    } finally {
      vi.useRealTimers();
    }
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
    expect(leiste()).toBeNull();
  });

  it('ein rückgängig gemachter Punkt verschwindet wieder aus der Leiste', () => {
    const zwei = [item({ id: 1, title: 'Eins' }), item({ id: 2, title: 'Zwei' })];
    const { rerender } = render(<AgendaFullView items={zwei} eventId={1} onSelect={vi.fn()} />);
    rerender(
      <AgendaFullView items={[item({ id: 1, title: 'Eins' })]} eventId={1} onSelect={vi.fn()} />,
    );
    expect(leiste()).toContain('Entfernt: Zwei');

    // Wieder da (z. B. „Rückgängig" oder in ChurchTools zurückgeholt) → nicht mehr als entfernt gemeldet.
    rerender(<AgendaFullView items={[...zwei]} eventId={1} onSelect={vi.fn()} />);
    expect(leiste()).toBeNull();
  });

  it('weggeklickt bleibt sie weg – bis eine neue Änderung kommt', () => {
    const a = [item({ id: 1, title: 'Eins', changed: true, neu: true }), item({ id: 2 })];
    const { rerender } = render(<AgendaFullView items={a} eventId={1} onSelect={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Hinweis schließen' }));
    expect(leiste()).toBeNull();
    // Gleicher Stand neu geladen → bleibt zu.
    rerender(<AgendaFullView items={[...a]} eventId={1} onSelect={vi.fn()} />);
    expect(leiste()).toBeNull();
    // Etwas Neues → wieder da.
    rerender(
      <AgendaFullView
        items={[...a, item({ id: 3, title: 'Drei', changed: true, neu: true })]}
        eventId={1}
        onSelect={vi.fn()}
      />,
    );
    expect(leiste()).toContain('2 neu');
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
    expect(linie.textContent).toBe('Beginn · 10:00');
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
