// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { pedalRichtung } from './pedalTasten';

describe('pedalRichtung – was ein Pedal sendet', () => {
  it.each(['ArrowRight', 'ArrowDown', 'PageDown', ' '])('„%s" heißt weiter', (key) => {
    expect(pedalRichtung({ key })).toBe(1);
  });

  it.each(['ArrowLeft', 'ArrowUp', 'PageUp'])('„%s" heißt zurück', (key) => {
    expect(pedalRichtung({ key })).toBe(-1);
  });

  it('Umschalt+Leertaste heißt zurück (wie im Browser)', () => {
    expect(pedalRichtung({ key: ' ', shiftKey: true })).toBe(-1);
  });

  it('andere Tasten: nichts', () => {
    expect(pedalRichtung({ key: 'a' })).toBeNull();
    expect(pedalRichtung({ key: 'Enter' })).toBeNull();
  });
});

describe('pedalRichtung – wann bewusst nichts passiert', () => {
  it('gedrückt gehalten: kein Dauerlauf durch den Ablauf', () => {
    expect(pedalRichtung({ key: 'ArrowRight', repeat: true })).toBeNull();
    expect(pedalRichtung({ key: ' ', repeat: true })).toBeNull();
  });

  it('mit Strg/⌘/Alt: das sind Kürzel, kein Pedal', () => {
    expect(pedalRichtung({ key: 'ArrowRight', metaKey: true })).toBeNull();
    expect(pedalRichtung({ key: 'ArrowLeft', ctrlKey: true })).toBeNull();
    expect(pedalRichtung({ key: 'ArrowDown', altKey: true })).toBeNull();
  });

  it('in Eingabefeldern bewegt die Taste den Cursor, nicht das Blatt', () => {
    for (const tag of ['input', 'textarea', 'select']) {
      expect(pedalRichtung({ key: 'ArrowRight', target: document.createElement(tag) })).toBeNull();
    }
    const editierbar = document.createElement('span');
    Object.defineProperty(editierbar, 'isContentEditable', { value: true });
    expect(pedalRichtung({ key: ' ', target: editierbar })).toBeNull();
  });

  it('Leertaste auf einem Knopf: der Knopf löst aus – kein zweiter Schritt dazu', () => {
    expect(pedalRichtung({ key: ' ', target: document.createElement('button') })).toBeNull();
    const rolle = document.createElement('div');
    rolle.setAttribute('role', 'button');
    expect(pedalRichtung({ key: ' ', target: rolle })).toBeNull();
    // Pfeiltasten lösen einen Knopf nicht aus – die bleiben Pedal.
    expect(pedalRichtung({ key: 'ArrowDown', target: document.createElement('button') })).toBe(1);
  });
});
