// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { ablaufZeileAus, type AblaufZeile } from '@shared/ct/ablaufZeile';
import type { CtAgendaItem } from '@shared/ct/typen';
import { AblaufListe } from './AblaufListe';
import { usePunktAnsicht } from './usePunktAnsicht';

/**
 * **Der Punkt zum Ansehen** (B8, E16/E19/E20/E21, P1): überall eine eigene Seite (breit in Lesebreite, mit ← →), derselbe Inhalt. Die
 * Zeilen kommen aus dem echten `ablaufZeileAus`, damit der Test dieselben Regeln sieht wie die Apps.
 */
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const handy = (an: boolean) =>
  vi.stubGlobal('matchMedia', () => ({
    matches: an,
    addEventListener: () => {},
    removeEventListener: () => {},
  }));

const z = (item: Partial<CtAgendaItem> & { id: number; title: string }): AblaufZeile =>
  ablaufZeileAus(item, 7, 'Europe/Berlin');

const GRUPPEN = [
  { id: 3, name: 'Technik' },
  { id: 4, name: 'Musik' },
];

const ZEILEN: AblaufZeile[] = [
  z({ id: 1, title: 'Countdown', start: '2026-11-08T08:55:00Z', duration: 300 }),
  z({ id: 2, title: 'Eventstart', type: 'header' }),
  z({
    id: 3,
    title: 'Lied',
    type: 'song',
    song: { title: 'Halleluja', songId: 9, arrangementId: 8, key: 'G', bpm: 120 } as never,
    start: '2026-11-08T09:00:00Z',
    duration: 240,
  }),
  z({
    id: 4,
    title: 'Begrüßung',
    start: '2026-11-08T09:04:00Z',
    duration: 180,
    note: 'Gäste willkommen heißen',
    responsible: {
      persons: [
        { service: '[Moderation]', person: { title: 'Ben Test', initials: 'BT' } },
        { service: '[Ton]' },
      ],
    },
    serviceGroupNotes: [
      { serviceGroupId: 3, note: 'Mikro 2 an' },
      { serviceGroupId: 4, note: '' },
    ],
  }),
];

function Seite({
  onLied,
  zeilen = ZEILEN,
}: {
  onLied?: (i: number, p: AblaufZeile) => void;
  zeilen?: AblaufZeile[];
}) {
  const a = usePunktAnsicht({ zeilen, infoGruppen: GRUPPEN, onLied });
  return (
    <>
      <AblaufListe zeilen={zeilen} onLied={onLied} onPunkt={a.oeffnen} />
      {a.ueberlagerung}
    </>
  );
}

const oeffne = (titel: string) => fireEvent.click(screen.getByRole('button', { name: titel }));

describe('Einzelansicht – breit (iPad/Rechner): dieselbe Seite wie am Handy', () => {
  it('zeigt ALLE Infos des Punkts: Uhrzeit, Dauer, Zuständige, Bemerkung und die Infos je Gruppe (E21)', () => {
    handy(false);
    render(<Seite />);
    oeffne('„Begrüßung“ ansehen');
    const f = screen.getByRole('dialog', { name: 'Begrüßung' });
    const t = f.textContent ?? '';
    expect(t).toContain('Position 3/3');
    expect(t).toContain('10:04 – 10:07');
    expect(t).toContain('3 Minuten');
    expect(t).toContain('Ben Test');
    expect(t).toContain('Moderation');
    // Offener Dienst: rot mit „offen“ – wie in der Liste.
    expect(t).toContain('Ton ?');
    expect(t).toContain('Gäste willkommen heißen');
    // Nur Gruppen MIT Text – „Musik“ ist leer.
    expect(t).toContain('Technik');
    expect(t).toContain('Mikro 2 an');
    expect(t).not.toContain('Musik');
    // Eine Seite, kein Fenster: „‹ Ablauf“ statt X, Davor/Danach statt ‹ › oben.
    expect(within(f).queryByRole('button', { name: 'Fenster schließen' })).toBeNull();
    expect(within(f).getByRole('button', { name: /Ablauf/ })).toBeTruthy();
    expect(within(f).getByRole('button', { name: 'Davor' })).toBeTruthy();
    expect(within(f).queryByRole('button', { name: 'Voriger Punkt' })).toBeNull();
  });

  it('der Inhalt steht in Lesebreite (eigener Rahmen um Titel und Feldliste), die Leiste Davor/Danach daneben, nicht darin', () => {
    handy(false);
    render(<Seite />);
    oeffne('„Begrüßung“ ansehen');
    const f = screen.getByRole('dialog', { name: 'Begrüßung' });
    const lese = f.querySelector('[class*="lesebreite"]');
    expect(lese).toBeTruthy();
    expect(within(lese as HTMLElement).getByRole('heading', { name: 'Begrüßung' })).toBeTruthy();
    expect(within(lese as HTMLElement).getByTestId('punkt-inhalt')).toBeTruthy();
    expect(within(lese as HTMLElement).queryByRole('button', { name: 'Davor' })).toBeNull();
  });

  it('das Lied: Karte mit Tonart und Tempo; Tipp führt zum Lied (und schließt die Ansicht)', () => {
    handy(false);
    const onLied = vi.fn();
    render(<Seite onLied={onLied} />);
    oeffne('„Lied – Halleluja“ ansehen');
    const f = screen.getByRole('dialog');
    expect(f.textContent).toContain('G · 120 bpm');
    fireEvent.click(within(f).getByRole('button', { name: /Halleluja/ }));
    expect(onLied).toHaveBeenCalledWith(0, expect.objectContaining({ id: 3 }));
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('Position zählt nur Punkte, keine Überschriften – Davor/Danach blättern; am Rand ist der Knopf gesperrt', () => {
    handy(false);
    render(<Seite />);
    oeffne('„Countdown“ ansehen');
    expect(screen.getByRole('button', { name: 'Davor' })).toHaveProperty('disabled', true);
    fireEvent.click(screen.getByRole('button', { name: 'Danach' }));
    // Die Überschrift „Eventstart“ wird übersprungen: nach dem Countdown kommt das Lied.
    expect(screen.getByRole('dialog', { name: 'Lied – Halleluja' }).textContent).toContain(
      'Position 2/3',
    );
    fireEvent.click(screen.getByRole('button', { name: 'Danach' }));
    expect(screen.getByRole('dialog', { name: 'Begrüßung' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Danach' })).toHaveProperty('disabled', true);
    fireEvent.click(screen.getByRole('button', { name: 'Davor' }));
    expect(screen.getByRole('dialog', { name: 'Lied – Halleluja' })).toBeTruthy();
    // Blättern ist EINE Seite, kein Stapel.
    expect(screen.getAllByRole('dialog')).toHaveLength(1);
  });

  it('Davor/Danach nennen wie die ChurchTools-App auch die Zuständigen des Nachbarn (27.11.2026)', () => {
    handy(false);
    render(<Seite />);
    oeffne('„Lied – Halleluja“ ansehen');
    // Danach: Begrüßung mit Ben Test und dem offenen Dienst „Ton“; davor: Countdown ohne Zuständige – keine leere Zeile.
    expect(screen.getByRole('button', { name: 'Danach' }).textContent).toContain('Ben Test, Ton');
    const davor = screen.getByRole('button', { name: 'Davor' });
    expect(davor.textContent).toContain('Countdown');
    expect(davor.querySelectorAll('span')).toHaveLength(3);
  });

  it('← → blättern wie Davor/Danach, am Rand tut die Taste nichts', () => {
    handy(false);
    render(<Seite />);
    oeffne('„Countdown“ ansehen');
    fireEvent.keyDown(document, { key: 'ArrowLeft' });
    expect(screen.getByRole('dialog', { name: 'Countdown' })).toBeTruthy();
    fireEvent.keyDown(document, { key: 'ArrowRight' });
    expect(screen.getByRole('dialog', { name: 'Lied – Halleluja' })).toBeTruthy();
    fireEvent.keyDown(document, { key: 'ArrowRight' });
    expect(screen.getByRole('dialog', { name: 'Begrüßung' })).toBeTruthy();
    fireEvent.keyDown(document, { key: 'ArrowRight' });
    expect(screen.getByRole('dialog', { name: 'Begrüßung' })).toBeTruthy();
    fireEvent.keyDown(document, { key: 'ArrowLeft' });
    expect(screen.getByRole('dialog', { name: 'Lied – Halleluja' })).toBeTruthy();
  });

  it('← → blättern NICHT, solange der Fokus in einem Eingabefeld liegt (Cursor bewegen)', () => {
    handy(false);
    render(
      <>
        <input aria-label="Suche" />
        <Seite />
      </>,
    );
    oeffne('„Countdown“ ansehen');
    const feld = screen.getByRole('textbox', { name: 'Suche' });
    fireEvent.keyDown(feld, { key: 'ArrowRight' });
    expect(screen.getByRole('dialog', { name: 'Countdown' })).toBeTruthy();
    // Mit Umschalt/Befehl gehört die Taste dem Browser (Textauswahl, Verlauf).
    fireEvent.keyDown(document, { key: 'ArrowRight', metaKey: true });
    expect(screen.getByRole('dialog', { name: 'Countdown' })).toBeTruthy();
    fireEvent.keyDown(document, { key: 'ArrowRight' });
    expect(screen.getByRole('dialog', { name: 'Lied – Halleluja' })).toBeTruthy();
  });

  it('Escape und „‹ Ablauf“ schließen', () => {
    handy(false);
    render(<Seite />);
    oeffne('„Begrüßung“ ansehen');
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).toBeNull();
    oeffne('„Begrüßung“ ansehen');
    fireEvent.click(screen.getByRole('button', { name: /Ablauf/ }));
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('verschwindet der offene Punkt aus dem Stand, ist die Ansicht zu – keine Geisterseite, kein Absturz', () => {
    handy(false);
    const { rerender } = render(<Seite />);
    oeffne('„Begrüßung“ ansehen');
    expect(screen.getByRole('dialog', { name: 'Begrüßung' })).toBeTruthy();
    rerender(<Seite zeilen={ZEILEN.filter((z) => z.id !== 4)} />);
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.queryByRole('button', { name: '„Begrüßung“ ansehen' })).toBeNull();
  });

  it('bleibt der Punkt, aber ein Punkt davor fällt weg: die Ansicht zeigt weiter denselben Punkt, Position zählt neu', () => {
    handy(false);
    const { rerender } = render(<Seite />);
    oeffne('„Begrüßung“ ansehen');
    expect(screen.getByRole('dialog', { name: 'Begrüßung' }).textContent).toContain('Position 3/3');
    rerender(<Seite zeilen={ZEILEN.filter((z) => z.id !== 1)} />);
    const f = screen.getByRole('dialog', { name: 'Begrüßung' });
    expect(f.textContent).toContain('Position 2/2');
    expect(screen.getAllByRole('dialog')).toHaveLength(1);
  });
});

describe('Einzelansicht – Handy: dieselbe Seite', () => {
  it('„‹ Ablauf“, „Position 3/3“, derselbe Inhalt, Davor/Danach mit Zeit und Titel des Nachbarn', () => {
    handy(true);
    render(<Seite />);
    oeffne('„Begrüßung“ ansehen');
    const s = screen.getByRole('dialog', { name: 'Begrüßung' });
    // Keine Sheet-Fußzeile, kein X – eine Seite mit Zurück.
    expect(within(s).queryByRole('button', { name: 'Fenster schließen' })).toBeNull();
    expect(s.textContent).toContain('Position 3/3');
    // DERSELBE Inhalt wie im Fenster (E19).
    expect(s.textContent).toContain('10:04 – 10:07');
    expect(s.textContent).toContain('Mikro 2 an');
    expect(s.textContent).toContain('Gäste willkommen heißen');
    const davor = within(s).getByRole('button', { name: 'Davor' });
    expect(davor.textContent).toContain('10:00 · 4 min');
    expect(davor.textContent).toContain('Lied – Halleluja');
    // Letzter Punkt: „Danach“ gesperrt und leer.
    expect(within(s).getByRole('button', { name: 'Danach' })).toHaveProperty('disabled', true);
    fireEvent.click(davor);
    const lied = screen.getByRole('dialog', { name: 'Lied – Halleluja' });
    expect(lied.textContent).toContain('Position 2/3');
    // Am anderen Rand: „Davor“ gesperrt.
    fireEvent.click(within(lied).getByRole('button', { name: 'Davor' }));
    const erster = screen.getByRole('dialog', { name: 'Countdown' });
    expect(within(erster).getByRole('button', { name: 'Davor' })).toHaveProperty('disabled', true);
    expect(within(erster).getByRole('button', { name: 'Danach' }).textContent).toContain(
      'Halleluja',
    );
  });

  it('„‹ Ablauf“ führt zurück zur Liste', () => {
    handy(true);
    render(<Seite />);
    oeffne('„Begrüßung“ ansehen');
    fireEvent.click(screen.getByRole('button', { name: /Ablauf/ }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.getByText('Begrüßung')).toBeTruthy();
  });
});

describe('Tipp-Ziele in der Liste (E20)', () => {
  it('Lied-Karte → Lied, Punkt → Einzelansicht; ein Punkt ohne Lied hat nur das zweite Ziel', () => {
    handy(false);
    const onLied = vi.fn();
    const onPunkt = vi.fn();
    render(<AblaufListe zeilen={ZEILEN} onLied={onLied} onPunkt={onPunkt} />);
    // Die Überschrift ist kein Ziel; drei Punkte → drei Flächen.
    expect(screen.getAllByRole('button', { name: /ansehen$/ })).toHaveLength(3);
    fireEvent.click(screen.getByRole('button', { name: '„Lied – Halleluja“ ansehen' }));
    expect(onPunkt).toHaveBeenCalledWith(expect.objectContaining({ id: 3 }));
    expect(onLied).not.toHaveBeenCalled();
    fireEvent.click(screen.getByText('Halleluja').closest('button')!);
    expect(onLied).toHaveBeenCalledWith(0, expect.objectContaining({ id: 3 }));
    expect(onPunkt).toHaveBeenCalledTimes(1);
    // Kein Knopf im Knopf: die Karte steckt nicht in der Fläche des Punkts.
    expect(
      screen.getByText('Halleluja').closest('button')!.closest('[class*="punktFlaeche"]'),
    ).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: '„Countdown“ ansehen' }));
    expect(onPunkt).toHaveBeenLastCalledWith(expect.objectContaining({ id: 1 }));
  });

  it('die Einführung („Tippe die Lied-Karte …“) zeigt auf die Lied-Karte, nicht auf die ganze Zeile', () => {
    handy(false);
    const { container } = render(
      <AblaufListe zeilen={ZEILEN} onLied={vi.fn()} onPunkt={vi.fn()} />,
    );
    const ziele = container.querySelectorAll('[data-tour="setlist-song"]');
    expect(ziele).toHaveLength(1);
    expect(ziele[0]).toBe(screen.getByText('Halleluja').closest('button'));
  });

  it('ohne `onPunkt` bleibt es wie vorher: bei Liedern ist der ganze Punkt der Knopf zum Lied', () => {
    handy(false);
    const onLied = vi.fn();
    render(<AblaufListe zeilen={ZEILEN} onLied={onLied} />);
    // Nur der Lied-Punkt und die Kreise der Begrüßung sind Knöpfe – kein „ansehen“-Ziel.
    expect(screen.queryByRole('button', { name: /ansehen$/ })).toBeNull();
    expect(screen.getAllByRole('button')).toHaveLength(2);
    // Auch die Uhrzeit gehört zum Knopf – wie vorher.
    fireEvent.click(screen.getByText('10:00'));
    expect(onLied).toHaveBeenCalledWith(0, expect.anything());
  });

  it('Lied ohne Ton, Tempo und Autor, Punkt heißt wie das Lied: die Karte ist der Weg zum Liedblatt, die Fläche der Punkt', () => {
    handy(false);
    const onLied = vi.fn();
    const onPunkt = vi.fn();
    const nurLied = [
      z({
        id: 5,
        title: 'Halleluja',
        type: 'song',
        song: { title: 'Halleluja', songId: 9, arrangementId: 8 } as never,
        start: '2026-11-08T09:00:00Z',
        duration: 240,
      }),
    ];
    render(<AblaufListe zeilen={nurLied} onLied={onLied} onPunkt={onPunkt} />);
    // Die Karte ist der einzige Knopf mit dem Liednamen – ohne sie gäbe es keinen Weg zum Liedblatt.
    fireEvent.click(screen.getByRole('button', { name: 'Halleluja' }));
    expect(onLied).toHaveBeenCalledWith(0, expect.objectContaining({ id: 5 }));
    expect(onPunkt).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: '„Halleluja“ ansehen' }));
    expect(onPunkt).toHaveBeenCalledWith(expect.objectContaining({ id: 5 }));
    expect(onLied).toHaveBeenCalledTimes(1);
  });
});
