// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BLOCKNOTE_DOKUMENT } from '@shared/protokolle/dokument.testdaten';
import { neueAufgabe, statusSetzen } from '@shared/protokolle/aufgaben';
import type { Block } from '@shared/protokolle/dokument';
import { farbWert } from './farben';
import { ProtokollAnsicht } from './ProtokollAnsicht';

const text = (t: string, styles = {}) => ({ type: 'text', text: t, styles });

/** jsdom schreibt Farben im `style` als `rgb(…)` – `#e03e3e` → `rgb(224, 62, 62)`. */
const hexAlsRgb = (hex: string) => {
  const n = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  return `rgb(${n.join(', ')})`;
};

describe('ProtokollAnsicht (S3-2) – das echte BlockNote-Dokument', () => {
  it('Tagesordnungspunkte nummeriert, Formatierung, Zitat, Link', () => {
    const { container } = render(<ProtokollAnsicht dokument={BLOCKNOTE_DOKUMENT} />);
    const punkte = [...container.querySelectorAll('h3')].map((h) => h.textContent);
    expect(punkte).toEqual(['1.Andacht & Gebet', '2.Termine & Gemeindeleben']);
    expect(screen.getByText('Peter:').tagName).toBe('STRONG');
    expect(screen.getByText('Römer 12, 9–13').tagName).toBe('EM');
    // Überschrift 2 ist seit K3b ein Unterpunkt mit Nummer.
    expect(container.querySelector('h4')?.textContent).toBe('2.1Zwischenüberschrift');
    expect(container.querySelector('blockquote')?.textContent).toBe('Ein Zitat');
    const link = screen.getByRole('link', { name: 'Link' });
    expect(link.getAttribute('href')).toBe('https://example.org');
    expect(link.getAttribute('rel')).toContain('noopener');
  });

  it('Unterpunkte bleiben verschachtelt – auch eine nummerierte Liste in einer Aufzählung', () => {
    const { container } = render(<ProtokollAnsicht dokument={BLOCKNOTE_DOKUMENT} />);
    const tief = container.querySelector('ul > li > ul > li > ol > li');
    expect(tief?.textContent).toBe('Ganz tief');
  });
});

describe('ProtokollAnsicht – eigene Blöcke und Sicherheit', () => {
  const dok: Block[] = [
    { id: 'p1', type: 'heading', props: { level: 1 }, content: [text('Finanzen')], children: [] },
    { id: 'b1', type: 'beschluss', content: [text('Budget freigegeben')], children: [] },
    {
      id: 'a1',
      type: 'aufgabe',
      props: { aufgabe: 'x1' },
      content: [text('Angebot holen')],
      children: [],
    },
    {
      id: 't1',
      type: 'termin',
      props: { datum: '2026-11-14' },
      content: [text('Arbeitseinsatz')],
      children: [],
    },
    { id: 'v1', type: 'verweis', props: { art: 'offene-aufgaben' }, children: [] },
    {
      id: 'c1',
      type: 'checkListItem',
      props: { checked: true },
      content: [text('Erledigt')],
      children: [],
    },
    { id: 'u1', type: 'irgendwasNeues', content: [text('Unbekannter Block')], children: [] },
    {
      id: 'l1',
      type: 'paragraph',
      content: [{ type: 'link', href: 'javascript:alert(1)', content: [text('Böse')] }],
      children: [],
    },
    {
      id: 'l2',
      type: 'paragraph',
      content: [{ type: 'link', href: 'mailto:kasse@gemeinde.de', content: [text('Kasse')] }],
      children: [],
    },
  ];
  const aufgabe = statusSetzen(
    neueAufgabe({
      id: 'x1',
      gruppe: 1,
      sitzung: 's',
      text: 'Angebot holen',
      bis: '2026-11-01',
      von: 1,
      am: '2026-10-20T10:00:00Z',
    }),
    'arbeit',
    1,
    '2026-10-21T10:00:00Z',
  );

  it('Beschluss, Aufgabe mit Stand aus „Mitarbeit“, Termin mit Datum, fester Punkt, Häkchen', () => {
    render(<ProtokollAnsicht dokument={dok} aufgaben={[aufgabe]} />);
    expect(screen.getByText('Beschluss')).toBeTruthy();
    expect(screen.getByText('Budget freigegeben')).toBeTruthy();
    expect(screen.getByText('in Arbeit · bis 01.11.2026')).toBeTruthy();
    expect(screen.getByText('14.11.2026')).toBeTruthy();
    expect(screen.getByText(/offenen To-Dos der Gruppe/)).toBeTruthy();
    expect(screen.getByText('☑')).toBeTruthy();
  });

  it('ein unbekannter Block zeigt seinen Text – nichts geht verloren', () => {
    render(<ProtokollAnsicht dokument={dok} />);
    expect(screen.getByText('Unbekannter Block')).toBeTruthy();
  });

  it('`javascript:`-Adressen werden kein Link', () => {
    render(<ProtokollAnsicht dokument={dok} />);
    expect(screen.getByText('Böse').closest('a')).toBeNull();
    // Mail-Adressen bleiben Links (#849: dieselbe Regel wie vorher, jetzt aus `sichererLink`).
    expect(screen.getByText('Kasse').closest('a')?.getAttribute('href')).toBe(
      'mailto:kasse@gemeinde.de',
    );
  });

  it('Markiertes erscheint in der Farbe des Editors – Hintergrund und Schrift (K3a)', () => {
    const markiert: Block[] = [
      {
        id: 'm',
        type: 'paragraph',
        content: [
          text('wichtig', { backgroundColor: 'yellow' }),
          text('rot', { textColor: 'red' }),
          text('blau hinterlegt', { backgroundColor: 'blue' }),
          text('unbekannt', { backgroundColor: 'neonpink', textColor: 'default' }),
        ],
      },
    ];
    render(<ProtokollAnsicht dokument={markiert} />);
    const stil = (t: string) => screen.getByText(t).closest('span')?.getAttribute('style') ?? '';
    expect(stil('wichtig')).toContain(
      `background-color: ${farbWert('yellow', 'hintergrund', 'light')}`,
    );
    expect(stil('rot')).toContain(`color: ${hexAlsRgb(farbWert('red', 'schrift', 'light')!)}`);
    expect(stil('blau hinterlegt')).toContain(
      `background-color: ${hexAlsRgb(farbWert('blue', 'hintergrund', 'light')!)}`,
    );
    expect(stil('unbekannt')).toBe('');
  });

  it('dunkel: die Farben aus BlockNotes dunkler Tabelle (K3a)', () => {
    document.documentElement.dataset.theme = 'dark';
    try {
      render(
        <ProtokollAnsicht
          dokument={[
            { id: 'm', type: 'paragraph', content: [text('rot', { backgroundColor: 'red' })] },
          ]}
        />,
      );
      expect(screen.getByText('rot').closest('span')?.getAttribute('style')).toContain(
        hexAlsRgb(farbWert('red', 'hintergrund', 'dark')!),
      );
      expect(farbWert('red', 'hintergrund', 'dark')).not.toBe(
        farbWert('red', 'hintergrund', 'light'),
      );
    } finally {
      delete document.documentElement.dataset.theme;
    }
  });

  it('Unterpunkte mit Nummer und Sprungmarke für die Suche; „Überschrift“ ohne Nummer (K3b)', () => {
    const h = (id: string, level: number) => ({
      id,
      type: 'heading',
      props: { level },
      content: [text(id)],
    });
    const { container } = render(
      <ProtokollAnsicht
        dokument={[h('Fest', 1), h('Aufbau', 2), h('Zelte', 4), h('Notiz', 3)]}
        markiert="Zelte"
      />,
    );
    expect(
      [...container.querySelectorAll('h3, h4, h5')].map((x) => [x.tagName, x.textContent, x.id]),
    ).toEqual([
      ['H3', '1.Fest', 'punkt-Fest'],
      ['H4', '1.1Aufbau', 'punkt-Aufbau'],
      ['H4', '1.1.1Zelte', 'punkt-Zelte'],
      ['H5', 'Notiz', ''],
    ]);
    expect(container.querySelector('#punkt-Zelte')?.className).toContain('markiert');
  });

  it('leeres Dokument: ein Satz', () => {
    render(<ProtokollAnsicht dokument={[]} />);
    expect(screen.getByText('Das Protokoll ist noch leer.')).toBeTruthy();
  });
});
