// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { KopfKnopf, KopfZurueck } from './KopfKnopf';

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
