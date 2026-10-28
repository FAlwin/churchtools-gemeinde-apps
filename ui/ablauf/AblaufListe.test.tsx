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
  it('Lieder antippbar mit ihrer Nummer im Ablauf (Musik-App) und dem Punkt selbst (Dienstplaner, E6-O O4)', () => {
    const onLied = vi.fn();
    render(<AblaufListe zeilen={ZEILEN} beginn="10:00" onLied={onLied} />);
    const lieder = screen.getAllByRole('button');
    expect(lieder.map((b) => b.textContent)).toEqual([
      expect.stringContaining('Treu'),
      expect.stringContaining('Halleluja'),
    ]);
    fireEvent.click(lieder[1]);
    expect(onLied).toHaveBeenCalledWith(
      1,
      expect.objectContaining({ song: expect.objectContaining({ title: 'Halleluja' }) }),
    );
  });

  it('beide Apps gleich (E6-O1): die Dauer steht in der Zeitspalte unter der Uhrzeit; ohne onLied keine Knöpfe', () => {
    render(<AblaufListe zeilen={ZEILEN} beginn="10:00" />);
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

describe('an diesem Termin weggelassen (E6-3b)', () => {
  it('grau, „—“ statt der Uhrzeit und der Hinweis – auch bei einer Überschrift', () => {
    render(
      <AblaufListe
        zeilen={[
          z({ id: 1, title: 'Predigt', startTimes: { '7': '2026-10-18T08:00:00Z' } }),
          z({ id: 2, title: 'Abkündigungen', duration: 300, startTimes: { '7': null } }),
          z({ id: 3, title: 'Gebet', type: 'header', startTimes: { '7': null } }),
        ]}
      />,
    );
    const zeile = screen.getByText('Abkündigungen').closest('div[class*="flowRow"]')!;
    expect(zeile.className).toMatch(/weggelassen/);
    expect(zeile.textContent).toContain('—');
    expect(zeile.textContent).toContain('an diesem Termin weggelassen');
    const band = screen.getByText('Gebet').closest('div')!;
    expect(band.className).toMatch(/weggelassen/);
    expect(band.textContent).toContain('an diesem Termin weggelassen');
    // Der gezeigte Punkt bleibt, wie er war.
    const predigt = screen.getByText('Predigt').closest('div[class*="flowRow"]')!;
    expect(predigt.className).not.toMatch(/weggelassen/);
    expect(predigt.textContent).toContain('10:00');
    expect(screen.getAllByText('an diesem Termin weggelassen')).toHaveLength(2);
  });
});

describe('wie die ChurchTools-App (E6-O1)', () => {
  it('Lied: Titelzeile ohne Liedname, die Lied-Karte nennt Lied, Tonart · Tempo · Autor (was bekannt ist)', () => {
    const mitAutor = {
      ...z({
        id: 3,
        title: 'Lied',
        type: 'song',
        song: { title: 'Treu', key: 'A', bpm: 75 } as never,
      }),
    };
    mitAutor.song = { ...mitAutor.song!, author: 'Uwe Peters' };
    const ohne = z({ id: 4, title: 'Lied', type: 'song', song: { title: 'Halleluja' } as never });
    render(<AblaufListe zeilen={[mitAutor, ohne]} />);
    expect(screen.getByText('A · 75 bpm · Uwe Peters')).toBeTruthy();
    expect(screen.getByText('Treu')).toBeTruthy();
    // Ohne Tonart, Tempo und Autor nur der Liedname – keine leere Zeile mit Punkten.
    const karte = screen.getByText('Halleluja').parentElement!;
    expect(karte.textContent).toBe('Halleluja');
    // Der Titel trägt den Liednamen nicht noch einmal („Lied – Treu“ wäre doppelt).
    expect(screen.queryByText(/Lied – /)).toBeNull();
  });

  it('Kreise rechts: Foto, sonst Kürzel; ab drei Personen „+N“; offene Dienste nicht im Kreis, aber rot in der Zeile', () => {
    const zeile = z({
      id: 9,
      title: 'Musik',
      responsible: {
        persons: [
          {
            service: '[Musik]',
            person: { title: 'Anna Feld', initials: 'AF', imageUrl: 'https://ct.test/bild.jpg' },
          },
          { service: '[Musik]', person: { title: 'Lea Fromm', initials: 'LF' } },
          { service: '[Musik]', person: { title: 'Ida Roth' } },
          { service: '[Gesang]' },
        ],
      },
    });
    const { container } = render(<AblaufListe zeilen={[zeile]} />);
    const bild = container.querySelector('img')!;
    expect(bild.getAttribute('src')).toBe('https://ct.test/bild.jpg');
    expect(screen.getByText('LF')).toBeTruthy();
    // Ida Roth hat kein Kürzel von ChurchTools – gebildet wird es trotzdem, steht aber hinter „+1“.
    expect(screen.getByText('+1')).toBeTruthy();
    expect(screen.getByText(/Gesang \?/)).toBeTruthy();
    expect(container.textContent).toContain('Anna Feld');
  });

  it('heißt der Punkt wie sein Lied: Name nur einmal – die Karte nennt dann nur Tonart · Tempo, ohne sie fehlt sie', () => {
    const gleich = z({
      id: 5,
      title: 'Treu',
      type: 'song',
      song: { title: 'Treu', key: 'G', bpm: 70 } as never,
    });
    const ohneAlles = z({ id: 6, title: '', type: 'song', song: { title: 'Halleluja' } as never });
    const { container } = render(<AblaufListe zeilen={[gleich, ohneAlles]} />);
    expect(screen.getAllByText('Treu')).toHaveLength(1);
    // Nur EINE Karte (Treu mit Tonart · Tempo) – für Halleluja wäre sie leer und fällt weg.
    expect(container.querySelectorAll('[class*="liedKarte"]')).toHaveLength(1);
    expect(screen.getByText('G · 70 bpm')).toBeTruthy();
    expect(screen.getAllByText('Halleluja')).toHaveLength(1);
  });

  it('schmal (Matrix, E6-6a): Uhrzeit, Dauer und Titel samt Liedname – ohne Zuständige, Kreise, Notiz und Lied-Karte', () => {
    const zeilen = [
      z({
        id: 9,
        title: 'Musik',
        note: 'mit Chor',
        responsible: {
          persons: [{ service: '[Musik]', person: { title: 'Lea Fromm', initials: 'LF' } }],
        },
      }),
      z({ id: 10, title: 'Lied', type: 'song', song: { title: 'Treu', key: 'G' } as never }),
    ];
    const { container } = render(<AblaufListe zeilen={zeilen} schmal />);
    expect(screen.getByText('Musik')).toBeTruthy();
    expect(screen.getByText('Treu')).toBeTruthy();
    expect(screen.queryByText('LF')).toBeNull();
    expect(screen.queryByText(/Lea Fromm/)).toBeNull();
    expect(screen.queryByText('mit Chor')).toBeNull();
    expect(container.querySelectorAll('[class*="liedKarte"]')).toHaveLength(0);
    // Gegenprobe ohne `schmal`: dieselben Zeilen zeigen alles.
    cleanup();
    render(<AblaufListe zeilen={zeilen} />);
    expect(screen.getByText('LF')).toBeTruthy();
    expect(screen.getByText('mit Chor')).toBeTruthy();
  });

  it('„Beginn“ ist ein Balken mit der Uhrzeit rechts – weiter als Trenner erkennbar', () => {
    render(<AblaufListe zeilen={ZEILEN} beginn="10:00" />);
    const balken = screen.getByRole('separator', { name: 'Beginn 10:00' });
    expect(balken.textContent).toBe('Beginn10:00');
  });
});
