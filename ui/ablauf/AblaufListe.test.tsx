// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { ablaufZeileAus, type AblaufZeile } from '@shared/ct/ablaufZeile';
import type { CtAgendaItem } from '@shared/ct/typen';
import { AblaufListe } from './AblaufListe';

/**
 * Der Ablauf als Liste – ein Baustein für Musik-App und Dienstplaner (E6-1b). Die Zeilen kommen aus dem echten
 * `ablaufZeileAus`, damit der Test dieselben Regeln sieht wie die Apps.
 */
afterEach(cleanup);

const z = (item: Partial<CtAgendaItem> & { id: number; title: string }): AblaufZeile =>
  ablaufZeileAus(item, 7, 'Europe/Berlin');

const ZEILEN = [
  z({
    id: 1,
    title: 'Soundcheck',
    isBeforeEvent: true,
    start: '2026-10-18T07:30:00Z',
    duration: 1800,
  }),
  z({ id: 2, title: 'Ankommen', type: 'header', start: '2026-10-18T08:00:00Z' }),
  z({
    id: 3,
    title: 'Lied',
    type: 'song',
    song: { title: 'Treu' } as never,
    start: '2026-10-18T08:05:00Z',
    duration: 300,
  }),
  z({
    id: 4,
    title: 'Lied',
    type: 'song',
    song: { title: 'Halleluja' } as never,
    start: '2026-10-18T08:10:00Z',
  }),
  z({ id: 5, title: 'Predigt', start: '2026-10-18T08:15:00Z', startTimes: { '7': null } }),
];

describe('AblaufListe', () => {
  it('Musik-App: Dauer rechts am Titel; Lieder antippbar mit ihrer Nummer im Ablauf', () => {
    const onLied = vi.fn();
    render(<AblaufListe zeilen={ZEILEN} beginn="10:00" onLied={onLied} />);
    const lieder = screen.getAllByRole('button');
    expect(lieder.map((b) => b.textContent)).toEqual([
      expect.stringContaining('Treu'),
      expect.stringContaining('Halleluja'),
    ]);
    fireEvent.click(lieder[1]);
    expect(onLied).toHaveBeenCalledWith(1);
    // Dauer nicht in der Zeit-Spalte
    expect(screen.getByText('10:05').textContent).toBe('10:05');
    expect(screen.getByText('5 Min')).toBeTruthy();
  });

  it('Dienstplaner: Dauer neben der Zeit; ohne onLied keine Knöpfe', () => {
    render(<AblaufListe zeilen={ZEILEN} beginn="10:00" dauerNebenZeit />);
    expect(screen.queryAllByRole('button')).toHaveLength(0);
    expect(screen.getByText('10:05').parentElement!.textContent).toBe('10:055 Min');
    expect(screen.getByText('09:30').parentElement!.textContent).toBe('09:3030 Min');
  });

  it('Linie „Beginn“ nach dem Vorlauf; ausgeblendete Zeit (Auge) bleibt leer; Entfernte fehlen; Schildchen', () => {
    const { container } = render(
      <AblaufListe
        zeilen={[...ZEILEN, { ...z({ id: 6, title: 'Weg' }), removed: true }]}
        beginn="10:00"
        schild={(id) => (id === 5 ? 'neu' : null)}
      />,
    );
    const text = container.textContent;
    expect(text.indexOf('Beginn')).toBeGreaterThan(text.indexOf('Soundcheck'));
    expect(text.indexOf('Beginn')).toBeLessThan(text.indexOf('Ankommen'));
    expect(screen.queryByText('Weg')).toBeNull();
    expect(screen.getByText('neu')).toBeTruthy();
    expect(screen.queryByText('10:15')).toBeNull();
  });
});
