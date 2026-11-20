// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { Etikett, type EtikettTon } from './Etikett';

afterEach(cleanup);

describe('Etikett (R9: eine Form, vier Farben)', () => {
  it('zeigt den Text; der Titel erscheint beim Darüberfahren', () => {
    render(<Etikett title="Du darfst hier nur lesen">nur ansehen</Etikett>);
    const e = screen.getByText('nur ansehen');
    expect(e.getAttribute('title')).toBe('Du darfst hier nur lesen');
  });

  it('jeder Ton hat seine eigene Klasse, die Form (Grundklasse) ist bei allen gleich', () => {
    const toene: EtikettTon[] = ['neutral', 'blau', 'gruen', 'rot'];
    const klassen = toene.map((t) => {
      render(<Etikett ton={t}>{t}</Etikett>);
      return screen.getByText(t).className.split(/\s+/);
    });
    // Die erste Klasse (Form) ist überall dieselbe …
    expect(new Set(klassen.map((k) => k[0])).size).toBe(1);
    // … die vollständigen Klassenlisten unterscheiden sich je Ton.
    expect(new Set(klassen.map((k) => k.join(' '))).size).toBe(4);
    // Der Standard ist neutral.
    cleanup();
    render(<Etikett>x</Etikett>);
    expect(screen.getByText('x').className).toBe(klassen[0].join(' '));
  });
});
