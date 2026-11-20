// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { KopfKnopf, KopfLink, KopfZurueck } from './KopfKnopf';
import { HANDY_BREITE } from './useMedienAbfrage';

/** Seitenkopf im ChurchTools-Stil (Scheibe S, 26.10.2026): Knöpfe mit Rahmen, Symbol und Beschriftung. */
describe('KopfKnopf', () => {
  it('zeigt die Beschriftung; der ausführliche Titel ist der Name für Screenreader', () => {
    const onClick = vi.fn();
    render(
      <KopfKnopf
        onClick={onClick}
        label="Teilen"
        title="Alle Lieder als PDF teilen"
        symbol={<b>T</b>}
      />,
    );
    const knopf = screen.getByRole('button', { name: 'Alle Lieder als PDF teilen' });
    expect(knopf.textContent).toBe('TTeilen');
    fireEvent.click(knopf);
    expect(onClick).toHaveBeenCalledOnce();
  });

  it('Hauptaktion und „gilt gerade“ unterscheiden sich; aktiv ist für Screenreader gedrückt', () => {
    render(
      <>
        <KopfKnopf onClick={vi.fn()} label="Bearbeiten" haupt symbol={<b>B</b>} />
        <KopfKnopf onClick={vi.fn()} label="Öffnen" aktiv symbol={<b>O</b>} />
      </>,
    );
    expect(screen.getByRole('button', { name: 'Bearbeiten' }).className).toMatch(/haupt/);
    const offen = screen.getByRole('button', { name: 'Öffnen' });
    expect(offen.className).toMatch(/aktiv/);
    expect(offen.getAttribute('aria-pressed')).toBe('true');
  });

  it('klein (Plus in der Matrix-Zeile): nur das Symbol, eigene Größe, Name bleibt', () => {
    render(<KopfKnopf onClick={vi.fn()} label="Eintrag hinzufügen" neu klein symbol={<b>+</b>} />);
    const knopf = screen.getByRole('button', { name: 'Eintrag hinzufügen' });
    expect(knopf.textContent).toBe('+');
    expect(knopf.className).toMatch(/klein/);
    expect(knopf.className).toMatch(/neu/);
  });

  it('`zahl` (Büroklammer, T2a): neben dem Symbol, auch als `nurSymbol`; der Name kommt aus dem Titel', () => {
    render(
      <KopfKnopf
        onClick={vi.fn()}
        label="Dateien"
        title="Dateien zum Termin (3)"
        nurSymbol
        zahl={3}
        symbol={<b>📎</b>}
      />,
    );
    const knopf = screen.getByRole('button', { name: 'Dateien zum Termin (3)' });
    expect(knopf.textContent).toBe('📎3');
    expect(knopf.className).toMatch(/mitZahl/);
  });

  it('nur Symbol (Vollbild): keine sichtbare Beschriftung, Name bleibt', () => {
    render(<KopfKnopf onClick={vi.fn()} label="Vollbild" nurSymbol symbol={<b>V</b>} />);
    expect(screen.getByRole('button', { name: 'Vollbild' }).textContent).toBe('V');
  });

  it('`symbolHinten`: erst das Wort, dann das Symbol („Weiter ›“, Fußleiste B3)', () => {
    render(<KopfKnopf onClick={vi.fn()} label="Weiter" symbolHinten symbol={<b>›</b>} />);
    expect(screen.getByRole('button', { name: 'Weiter' }).textContent).toBe('Weiter›');
    cleanup();
    render(<KopfKnopf onClick={vi.fn()} label="Zurück" symbol={<b>‹</b>} />);
    expect(screen.getByRole('button', { name: 'Zurück' }).textContent).toBe('‹Zurück');
  });
});

describe('KopfKnopf – stille Stufe (R2, B1)', () => {
  const still = (extra: Record<string, unknown> = {}) => {
    render(<KopfKnopf onClick={vi.fn()} label="Filter" still symbol={<b>F</b>} {...extra} />);
    return screen.getByRole('button', { name: 'Filter' });
  };

  it('`still` trägt die stille Klasse und keine der lauten Stufen', () => {
    const knopf = still();
    expect(knopf.className).toMatch(/still/);
    expect(knopf.className).not.toMatch(/haupt|neu|gefahr|aktiv|offen/);
    cleanup();
  });

  it('ohne `still` kein stiller Knopf', () => {
    render(<KopfKnopf onClick={vi.fn()} label="Filter" symbol={<b>F</b>} />);
    expect(screen.getByRole('button', { name: 'Filter' }).className).not.toMatch(/still/);
    cleanup();
  });

  it('verträgt sich mit `nurSymbol`: nur das Symbol, Name bleibt', () => {
    const knopf = still({ nurSymbol: true });
    expect(knopf.className).toMatch(/still/);
    expect(knopf.className).toMatch(/nurSymbol/);
    expect(knopf.textContent).toBe('F');
    cleanup();
  });

  it('verträgt sich mit `menuOffen`, `offen` und `aktiv` – beide Klassen stehen, das Menü ist für Screenreader offen', () => {
    const knopf = still({ menuOffen: true, offen: true });
    expect(knopf.className).toMatch(/still/);
    expect(knopf.className).toMatch(/offen/);
    expect(knopf.getAttribute('aria-expanded')).toBe('true');
    cleanup();
    const gilt = still({ aktiv: true });
    expect(gilt.className).toMatch(/still/);
    expect(gilt.className).toMatch(/aktiv/);
    expect(gilt.getAttribute('aria-pressed')).toBe('true');
    cleanup();
  });

  it('`pfeil`: ein Pfeil nach unten hinter dem Wort – „Neu ⌄“ (B6); ohne `pfeil` kein zweites Symbol', () => {
    render(<KopfKnopf onClick={vi.fn()} label="Neu" neu pfeil symbol={<i data-testid="plus" />} />);
    const knopf = screen.getByRole('button', { name: 'Neu' });
    expect(knopf.querySelector('svg')).toBeTruthy();
    // Reihenfolge: Symbol, Wort, Pfeil.
    expect([...knopf.children].map((c) => c.tagName)).toEqual(['I', 'SPAN', 'svg']);
    cleanup();
    render(<KopfKnopf onClick={vi.fn()} label="Neu" neu symbol={<i />} />);
    expect(screen.getByRole('button', { name: 'Neu' }).querySelector('svg')).toBeNull();
  });

  it('Widerspruch: `still` mit `haupt`/`neu`/`gefahr` – der Typ verbietet es, zur Laufzeit gewinnt die lautere Stufe', () => {
    // Der Typ verbietet die Mischung – diese Zeilen kompilieren nur, solange er es tut (`tsc -p ui` im Build).
    // @ts-expect-error – `still` und `haupt` schließen sich im Typ aus
    void (<KopfKnopf onClick={vi.fn()} label="X" still haupt symbol={<b>X</b>} />);
    // @ts-expect-error – `still` und `neu` schließen sich im Typ aus
    void (<KopfKnopf onClick={vi.fn()} label="X" still neu symbol={<b>X</b>} />);
    // @ts-expect-error – `still` und `gefahr` schließen sich im Typ aus
    void (<KopfKnopf onClick={vi.fn()} label="X" still gefahr symbol={<b>X</b>} />);
    for (const stufe of ['haupt', 'neu', 'gefahr'] as const) {
      // Zur Laufzeit trotzdem gesetzt (über einen Cast): die lautere Stufe gewinnt.
      const props = { still: true, [stufe]: true } as unknown as { still: true };
      render(<KopfKnopf onClick={vi.fn()} label="X" {...props} symbol={<b>X</b>} />);
      const knopf = screen.getByRole('button', { name: 'X' });
      expect(knopf.className).toMatch(new RegExp(stufe));
      expect(knopf.className).not.toMatch(/still/);
      cleanup();
    }
  });

  it('R12: am Handy bekommt der stille Knopf einen Rahmen – in derselben Grenze wie `HANDY_BREITE`', () => {
    const scss = readFileSync(
      resolve(process.cwd(), '../ui/bedienung/KopfKnopf.module.scss'),
      'utf8',
    );
    const grenze = /\(max-width:\s*(\d+)px\)/.exec(HANDY_BREITE)?.[1];
    expect(grenze).toBeDefined();
    const block = new RegExp(
      `@media \\(max-width: ${grenze}px\\) \\{\\s*\\.knopf\\.still \\{[^}]*border-color: var\\(--border\\)`,
    );
    expect(scss).toMatch(block);
  });
});

describe('KopfZurueck', () => {
  it('„← Termine“: Ziel als Text, Name „Zurück zu Termine“', () => {
    const onClick = vi.fn();
    render(<KopfZurueck onClick={onClick} ziel="Termine" />);
    const knopf = screen.getByRole('button', { name: 'Zurück zu Termine' });
    expect(knopf.textContent).toBe('Termine');
    fireEvent.click(knopf);
    expect(onClick).toHaveBeenCalledOnce();
  });

  it('ohne Ziel heißt er „Zurück“', () => {
    render(<KopfZurueck onClick={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Zurück' }).textContent).toBe('Zurück');
  });
});

describe('KopfLink', () => {
  it('ein Verweis, der genauso aussieht wie die Knöpfe daneben – Symbol und Beschriftung, dieselben Klassen', () => {
    render(
      <>
        <KopfKnopf onClick={vi.fn()} label="Bearbeiten" symbol={<b>B</b>} />
        <KopfLink href="https://ct.example/ccm/musik-app/" label="Musik-App" symbol={<b>M</b>} />
      </>,
    );
    const link = screen.getByRole('link', { name: 'Musik-App' });
    expect(link.getAttribute('href')).toBe('https://ct.example/ccm/musik-app/');
    expect(link.textContent).toBe('MMusik-App');
    expect(link.className).toBe(screen.getByRole('button', { name: 'Bearbeiten' }).className);
    cleanup();
  });

  it('still (B7): dieselben Klassen wie der stille Knopf daneben', () => {
    render(
      <>
        <KopfKnopf still onClick={vi.fn()} label="Mehr" symbol={<b>M</b>} />
        <KopfLink still href="https://ct.example/g/5" label="In ChurchTools" symbol={<b>C</b>} />
      </>,
    );
    expect(screen.getByRole('link', { name: 'In ChurchTools' }).className).toBe(
      screen.getByRole('button', { name: 'Mehr' }).className,
    );
    cleanup();
  });
});
