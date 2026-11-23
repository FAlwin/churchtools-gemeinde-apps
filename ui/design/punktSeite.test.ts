import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { WURZEL } from './quelltexte.testutil';

/**
 * **Die Punkt-Seite** (Ablauf, P1 – Alwin 22.11.2026): überall dieselbe Seite wie in der ChurchTools-App. jsdom rechnet
 * kein Stylesheet, also hält dieser Wächter die zwei Regeln an der Quelle fest: Der Inhalt steht breit in **Lesebreite**
 * (720 px, mittig), und die Beschriftung über dem Wert gilt erst **ab dem Handy** (≤ 759 px) – breit bleibt sie daneben.
 */
const scss = readFileSync(join(WURZEL, 'ui/ablauf/PunktAnsicht.module.scss'), 'utf8');
const block = (kopf: RegExp): string => {
  const m = kopf.exec(scss);
  if (!m) return '';
  let tiefe = 0;
  for (let i = scss.indexOf('{', m.index); i < scss.length; i++) {
    if (scss[i] === '{') tiefe++;
    if (scss[i] === '}' && --tiefe === 0) return scss.slice(m.index, i + 1);
  }
  return '';
};

describe('Punkt-Seite: Stildatei', () => {
  it('Lesebreite 720 px, mittig', () => {
    const b = block(/\.lesebreite\s*\{/);
    expect(b).toMatch(/max-width:\s*720px/);
    expect(b).toMatch(/margin:\s*0 auto/);
  });

  it('Beschriftung über dem Wert nur im Handy-Bereich, daneben (150 px) sonst', () => {
    expect(block(/\.lab\s*\{/)).toMatch(/width:\s*150px/);
    const handy = block(/@media \(max-width: 759px\)\s*\{/);
    expect(handy).toMatch(/flex-direction:\s*column/);
    expect(handy).toMatch(/\.lab\s*\{[^}]*width:\s*auto/);
    expect(block(/\.zeile\s*\{/)).not.toMatch(/flex-direction:\s*column/);
  });
});
