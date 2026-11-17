// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import type { WerVorschau } from '@shared/organigramm/einrichtungVorschau';
import type { Wechseljahr } from '@shared/organigramm/gruppenwechsel';
import { WerTabelle } from './WerTabelle';

const JAHR: Wechseljahr = {
  jahr: 2027,
  stichtag: '2027-09-30',
  wechseltag: '2027-09-12',
  ankuendigung: '2027-08-29',
  aufnahmeBis: '2027-09-19',
};
const wer = (ohneGeburtstag: number): WerVorschau => ({
  jahre: [{ jahr: JAHR, zahlen: [1] }],
  uebergaenge: ['Schäfchen → Fische'],
  namen: [[]],
  ohneGeburtstag,
  nichtGelesen: [],
});
const zeigen = (n: number) =>
  render(<WerTabelle wer={{ art: 'da', daten: wer(n) }} jahre={[JAHR]} />);

describe('WerTabelle – Kinder ohne Geburtstag', () => {
  afterEach(cleanup);

  it('Einzahl: „1 Kind … wechselt“ und „Es steht unter …“', () => {
    zeigen(1);
    expect(screen.getByText(/1 Kind ohne Geburtstag wechselt\s+nie von selbst\./)).toBeTruthy();
    expect(screen.getByText(/Es steht unter „Daten pflegen“\./)).toBeTruthy();
    expect(screen.queryByText(/Sie stehen/)).toBeNull();
  });

  it('Mehrzahl: „3 Kinder … wechseln“ und „Sie stehen unter …“', () => {
    zeigen(3);
    expect(screen.getByText(/3 Kinder ohne Geburtstag wechseln\s+nie von selbst\./)).toBeTruthy();
    expect(screen.getByText(/Sie stehen unter „Daten pflegen“\./)).toBeTruthy();
    expect(screen.queryByText(/Es steht/)).toBeNull();
  });
});
