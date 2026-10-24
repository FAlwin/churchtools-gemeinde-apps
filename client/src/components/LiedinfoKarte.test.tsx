// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import type { ArrangementAnsicht, LiedStammdatenAnsicht } from '@shared/types/index';
import { LiedinfoKarte } from './LiedinfoKarte';
import { liedinfoStart, type LiedinfoQuelle } from '../utils/liedinfoFormular';

/** Lied-Editor L4 (23.10.2026): Liedinfo – Hinweis am Feld, übernehmen, nur lesen. */
const LIED: LiedStammdatenAnsicht = {
  songId: 1,
  name: 'Treu',
  author: 'Gerster',
  ccli: null,
  copyright: null,
  categoryId: 1,
};
const ARR: ArrangementAnsicht = {
  id: 1,
  name: 'Standard',
  isDefault: true,
  key: 'E',
  tempo: null,
  beat: null,
  duration: null,
  description: null,
  source: null,
  sourceReference: null,
  dateien: 1,
};
const DATEI = '{title: Treu}\n{artist: Tobias Gerster}\n{tempo: 72}';

function zeige(darf = true) {
  const quelle: LiedinfoQuelle = { lied: LIED, arrangement: ARR, darf };
  const { formular, vergleich } = liedinfoStart(quelle, DATEI);
  const aendern = vi.fn();
  render(<LiedinfoKarte formular={formular} vergleich={vergleich} darf={darf} aendern={aendern} />);
  return { aendern };
}

describe('LiedinfoKarte', () => {
  it('Abweichung: Hinweis mit dem Datei-Wert, „übernehmen“ legt ihn ins Feld', () => {
    const { aendern } = zeige();
    expect(screen.getByLabelText('Interpret / Autor')).toHaveProperty('value', 'Gerster');
    expect(screen.getByText('Tobias Gerster')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'übernehmen' }));
    expect(aendern.mock.calls[0][0].lied.author).toBe('Tobias Gerster');
  });

  it('vorbelegt aus dem Notenblatt – mit Hinweis, woher der Wert kommt', () => {
    zeige();
    expect(screen.getByLabelText('Tempo')).toHaveProperty('value', '72');
    expect(screen.getByText('Tempo: aus dem Notenblatt übernommen')).toBeTruthy();
  });

  it('Dreierzeile: Hinweise zu Tempo und Takt nennen ihr Feld (Test-Instanz 24.10.2026)', () => {
    const quelle: LiedinfoQuelle = { lied: LIED, arrangement: { ...ARR, beat: '4/4' }, darf: true };
    const { formular, vergleich } = liedinfoStart(quelle, `${DATEI}\n{time: 3/4}`);
    render(<LiedinfoKarte formular={formular} vergleich={vergleich} darf aendern={vi.fn()} />);
    expect(screen.getByText('Tempo: aus dem Notenblatt übernommen')).toBeTruthy();
    expect(screen.getByText(/Takt im Notenblatt:/).textContent).toContain('3/4');
    expect(screen.queryByText('Aus dem Notenblatt übernommen')).toBeNull();
  });

  it('gleicher Wert: kein Hinweis', () => {
    zeige();
    // Titel steht gleich in Datei und ChurchTools.
    expect(screen.getAllByRole('button', { name: 'übernehmen' })).toHaveLength(1);
  });

  it('ohne Recht: nur lesen, nichts vorbelegt, kein „übernehmen“', () => {
    zeige(false);
    expect(screen.getByText(/Nur ansehen/)).toBeTruthy();
    expect(screen.getByLabelText('Titel')).toHaveProperty('readOnly', true);
    expect(screen.getByLabelText('Tempo')).toHaveProperty('value', '');
    expect(screen.queryByRole('button', { name: 'übernehmen' })).toBeNull();
  });
});
