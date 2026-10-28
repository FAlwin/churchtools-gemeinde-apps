import { describe, expect, it } from 'vitest';
import { untenWerte, type UntenMessung } from './appHeight';

/**
 * **Die Regel für den unteren Rand** gegen die echten Messungen vom 29.10.2026 (Messkasten auf Staging, Alwins iPhone
 * 402×874, iOS 18.7) – die Werte unten sind abgelesen, nicht ausgedacht.
 */
const IPHONE = { iphone: true, langeSeite: 874 };

describe('untenWerte', () => {
  it('unsere installierte App: innerHeight ist schon die volle Höhe – kein Zuschlag, Strich = Safe-Area', () => {
    const m: UntenMessung = {
      ...IPHONE,
      standalone: true,
      hochkant: true,
      innerHeight: 874,
      bildschirmHoehe: 874,
      safeAreaUnten: 34,
    };
    // Vorher: html = 874 + 34 = 908, die App ragte 34 pt unter die Kante.
    expect(untenWerte(m)).toEqual({ zuschlag: 0, homeStrich: 34 });
  });

  it('ChurchTools-App vom Home-Bildschirm: iOS meldet 0, der Strich liegt trotzdem über dem Inhalt', () => {
    const m: UntenMessung = {
      ...IPHONE,
      standalone: true,
      hochkant: true,
      innerHeight: 812, // + Statusleiste 62 = 874
      bildschirmHoehe: 874,
      safeAreaUnten: 0,
    };
    expect(untenWerte(m)).toEqual({ zuschlag: 0, homeStrich: 34 });
  });

  it('wie bis Juni beobachtet: innerHeight ohne den Strich – dann bleibt der Zuschlag', () => {
    const m: UntenMessung = {
      ...IPHONE,
      standalone: true,
      hochkant: true,
      innerHeight: 840,
      bildschirmHoehe: 874,
      safeAreaUnten: 34,
    };
    expect(untenWerte(m)).toEqual({ zuschlag: 34, homeStrich: 34 });
  });

  it('quer: 21 pt für den Strich, wenn iOS ihn nicht meldet', () => {
    const m: UntenMessung = {
      ...IPHONE,
      standalone: true,
      hochkant: false,
      innerHeight: 402,
      bildschirmHoehe: 402,
      safeAreaUnten: 0,
    };
    expect(untenWerte(m).homeStrich).toBe(21);
  });

  it('kein Strich, wo keiner ist: im Browser, auf dem iPhone SE, am Rechner', () => {
    const basis = { standalone: true, hochkant: true, safeAreaUnten: 0 };
    // Safari-Tab: nicht standalone.
    expect(
      untenWerte({
        ...basis,
        ...IPHONE,
        standalone: false,
        innerHeight: 700,
        bildschirmHoehe: 874,
      }),
    ).toEqual({ zuschlag: 0, homeStrich: 0 });
    // iPhone SE (Home-Taste, lange Seite 667).
    expect(
      untenWerte({
        ...basis,
        iphone: true,
        langeSeite: 667,
        innerHeight: 647,
        bildschirmHoehe: 667,
      }).homeStrich,
    ).toBe(0);
    // Installiert am Rechner / Android: kein iPhone.
    expect(
      untenWerte({
        ...basis,
        iphone: false,
        langeSeite: 900,
        innerHeight: 860,
        bildschirmHoehe: 900,
      }).homeStrich,
    ).toBe(0);
  });

  it('ChurchTools-App mit eigener Leiste unten (Seite endet über dem Strich): kein Zuschlag erfunden', () => {
    const m: UntenMessung = {
      ...IPHONE,
      standalone: true,
      hochkant: true,
      innerHeight: 778, // Statusleiste 62 + 34 unten ausgespart
      bildschirmHoehe: 874,
      safeAreaUnten: 0,
    };
    expect(untenWerte(m).homeStrich).toBe(0);
  });
});
