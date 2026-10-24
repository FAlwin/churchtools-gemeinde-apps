// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BLOCKNOTE_DOKUMENT } from '@shared/protokolle/dokument.testdaten';
import { neueAufgabe, statusSetzen } from '@shared/protokolle/aufgaben';
import type { Block } from '@shared/protokolle/dokument';
import { ProtokollAnsicht } from './ProtokollAnsicht';

const text = (t: string, styles = {}) => ({ type: 'text', text: t, styles });

describe('ProtokollAnsicht (S3-2) – das echte BlockNote-Dokument', () => {
  it('Tagesordnungspunkte nummeriert, Formatierung, Zitat, Link', () => {
    const { container } = render(<ProtokollAnsicht dokument={BLOCKNOTE_DOKUMENT} />);
    const punkte = [...container.querySelectorAll('h3')].map((h) => h.textContent);
    expect(punkte).toEqual(['1.Andacht & Gebet', '2.Termine & Gemeindeleben']);
    expect(screen.getByText('Peter:').tagName).toBe('STRONG');
    expect(screen.getByText('Römer 12, 9–13').tagName).toBe('EM');
    expect(container.querySelector('h4')?.textContent).toBe('Zwischenüberschrift');
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
  });

  it('Markiertes (Hintergrundfarbe aus dem Editor) erscheint als Markierung', () => {
    const markiert: Block[] = [
      { id: 'm', type: 'paragraph', content: [text('wichtig', { backgroundColor: 'yellow' })] },
    ];
    render(<ProtokollAnsicht dokument={markiert} />);
    expect(screen.getByText('wichtig').closest('mark')).not.toBeNull();
  });

  it('leeres Dokument: ein Satz', () => {
    render(<ProtokollAnsicht dokument={[]} />);
    expect(screen.getByText('Das Protokoll ist noch leer.')).toBeTruthy();
  });
});
