// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { churchToolsThema, folgeChurchToolsThema } from './thema';

let geraetDunkel = false;
const hoerer = new Set<() => void>();
let aufhoeren: (() => void) | null = null;

beforeEach(() => {
  geraetDunkel = false;
  hoerer.clear();
  document.body.className = '';
  delete document.documentElement.dataset.theme;
  delete document.documentElement.dataset.dunkel;
  vi.stubGlobal('matchMedia', () => ({
    get matches() {
      return geraetDunkel;
    },
    addEventListener: (_: string, f: () => void) => hoerer.add(f),
    removeEventListener: (_: string, f: () => void) => hoerer.delete(f),
  }));
});
afterEach(() => {
  aufhoeren?.();
  aufhoeren = null;
  vi.unstubAllGlobals();
});

/** Der MutationObserver meldet sich erst nach dem laufenden Schritt. */
const gleich = () => new Promise((r) => setTimeout(r, 0));

describe('Hell/dunkel wie ChurchTools', () => {
  it('liest die Klasse an <body> – nicht das Gerät', () => {
    geraetDunkel = true;
    document.body.className = 'cts fa-width-auto light';
    expect(churchToolsThema()).toBe('light');
    aufhoeren = folgeChurchToolsThema();
    expect(document.documentElement.dataset.theme).toBe('light');
    expect(document.documentElement.dataset.dunkel).toBe('churchtools');
  });

  it('ChurchTools dunkel → dunkel, und zieht mit, wenn ChurchTools umschaltet', async () => {
    document.body.className = 'cts dark';
    aufhoeren = folgeChurchToolsThema();
    expect(document.documentElement.dataset.theme).toBe('dark');
    document.body.className = 'cts light';
    await gleich();
    expect(document.documentElement.dataset.theme).toBe('light');
  });

  it('außerhalb von ChurchTools (keine Klasse) → wie das Gerät, auch beim Umschalten', () => {
    geraetDunkel = true;
    aufhoeren = folgeChurchToolsThema();
    expect(document.documentElement.dataset.theme).toBe('dark');
    geraetDunkel = false;
    hoerer.forEach((f) => f());
    expect(document.documentElement.dataset.theme).toBe('light');
  });
});
