import { describe, expect, it } from 'vitest';
import { untenWerte, type UntenMessung } from './appHeight';

/**
 * **Die Regel für den unteren Rand** gegen die echten Messungen vom 29.10.2026 (Messkasten auf Staging, Alwins iPhone
 * 402×874, iOS 18.7) – die Werte unten sind abgelesen, nicht ausgedacht.
 */
const IPHONE = { iphone: true, langeSeite: 874 };
const PWA = {
  ...IPHONE,
  standalone: true,
  hochkant: true,
  bildschirmHoehe: 874,
  safeAreaUnten: 34,
};

describe('untenWerte', () => {
  it('installierte App, Messung 1: innerHeight 874 – volle Höhe, nicht 874 + 34', () => {
    const m: UntenMessung = { ...PWA, innerHeight: 874, grosseHoehe: 874 };
    // Bis zum 29.10.: html = 874 + 34 = 908, die App ragte 34 pt unter die Kante.
    expect(untenWerte(m)).toEqual({ hoehe: 874, homeStrich: 34 });
  });

  it('installierte App, Messung 2 nach Neustart: innerHeight nur 812 – trotzdem volle Höhe', () => {
    const m: UntenMessung = { ...PWA, innerHeight: 812, grosseHoehe: 874 };
    // Mit `innerHeight` endete die App bei 812, darunter 62 pt leer (Alwin: „Fußzeile deutlich zu hoch“).
    expect(untenWerte(m)).toEqual({ hoehe: 874, homeStrich: 34 });
  });

  it('ChurchTools-App vom Home-Bildschirm: Höhe wie gemeldet, Strich 34 obwohl iOS 0 meldet', () => {
    const m: UntenMessung = {
      ...IPHONE,
      standalone: true,
      hochkant: true,
      innerHeight: 812, // + Statusleiste 62 = 874
      bildschirmHoehe: 874,
      safeAreaUnten: 0,
      grosseHoehe: 812,
    };
    expect(untenWerte(m)).toEqual({ hoehe: 812, homeStrich: 34 });
  });

  it('wie im Juni beobachtet: innerHeight ohne den Strich, große Höhe ebenso – Strich kommt dazu', () => {
    const m: UntenMessung = { ...PWA, innerHeight: 840, grosseHoehe: 840 };
    expect(untenWerte(m).hoehe).toBe(874);
  });

  it('beim Drehen hängt die große Höhe am alten Wert – dann gilt innerHeight', () => {
    const m: UntenMessung = {
      ...IPHONE,
      standalone: true,
      hochkant: false,
      innerHeight: 402,
      bildschirmHoehe: 402,
      safeAreaUnten: 21,
      grosseHoehe: 874, // noch hochkant
    };
    expect(untenWerte(m)).toEqual({ hoehe: 402, homeStrich: 21 });
  });

  it('quer in der ChurchTools-App: 21 pt für den Strich', () => {
    const m: UntenMessung = {
      ...IPHONE,
      standalone: true,
      hochkant: false,
      innerHeight: 402,
      bildschirmHoehe: 402,
      safeAreaUnten: 0,
      grosseHoehe: 402,
    };
    expect(untenWerte(m).homeStrich).toBe(21);
  });

  it('kein Strich und innerHeight, wo keine App vom Home-Bildschirm läuft oder kein Strich ist', () => {
    const basis = { standalone: true, hochkant: true, safeAreaUnten: 0 };
    // Safari-Tab: nicht standalone – die große Höhe (Leisten eingeklappt) zählt NICHT, sonst läge Inhalt darunter.
    expect(
      untenWerte({
        ...basis,
        ...IPHONE,
        standalone: false,
        innerHeight: 700,
        bildschirmHoehe: 874,
        grosseHoehe: 780,
      }),
    ).toEqual({ hoehe: 700, homeStrich: 0 });
    // iPhone SE (Home-Taste, lange Seite 667).
    expect(
      untenWerte({
        ...basis,
        iphone: true,
        langeSeite: 667,
        innerHeight: 647,
        bildschirmHoehe: 667,
        grosseHoehe: 647,
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
        grosseHoehe: 860,
      }).homeStrich,
    ).toBe(0);
  });

  it('ChurchTools-App mit eigener Leiste unten (Seite endet über dem Strich): kein Strich erfunden', () => {
    const m: UntenMessung = {
      ...IPHONE,
      standalone: true,
      hochkant: true,
      innerHeight: 778, // Statusleiste 62 + 34 unten ausgespart
      bildschirmHoehe: 874,
      safeAreaUnten: 0,
      grosseHoehe: 778,
    };
    expect(untenWerte(m)).toEqual({ hoehe: 778, homeStrich: 0 });
  });
});
