// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { ablaufZeileAus, type AblaufZeile } from '@shared/ct/ablaufZeile';
import type { CtAgendaItem } from '@shared/ct/typen';
import { AblaufAnzeige } from './AblaufAnzeige';

/**
 * **„Ablauf zeigen“** (E6b-1, Entwurf `e6b-anzeige.html`): ruhig im Vollbild – Uhr, Titel, alle Punkte mit Zeit, Dauer,
 * Zuständigen und den Infos der gewählten Gruppen; nichts verstellbar, Schrift passt sich an, Bildschirm bleibt an. Die
 * Zeilen kommen aus dem echten `ablaufZeileAus`.
 */
const z = (item: Partial<CtAgendaItem> & { id: number; title: string }): AblaufZeile =>
  ablaufZeileAus(item, 7, 'Europe/Berlin');

const ZEILEN = [
  z({
    id: 1,
    title: 'Soundcheck',
    isBeforeEvent: true,
    start: '2026-11-01T08:30:00Z',
    duration: 1800,
    serviceGroupNotes: [{ serviceGroupId: 3, note: 'Mikros prüfen' }],
  }),
  z({ id: 2, title: 'Lobpreis', type: 'header' }),
  z({
    id: 3,
    title: 'Lied',
    type: 'song',
    song: { title: 'Treu' } as never,
    start: '2026-11-01T09:00:00Z',
    duration: 240,
    serviceGroupNotes: [{ serviceGroupId: 4, note: 'Intro leise' }],
  }),
  z({
    id: 4,
    title: 'Abkündigungen',
    start: '2026-11-01T09:04:00Z',
    startTimes: { '7': null },
  }),
  z({
    id: 5,
    title: 'Predigt',
    start: '2026-11-01T09:04:00Z',
    duration: 1800,
    responsible: {
      text: '[Predigt]',
      persons: [{ service: '[Predigt]', person: { title: 'Clara Test' } }],
    },
  }),
];

function zeige(o: { infoGruppen?: { id: number; name: string }[]; tag?: string } = {}) {
  const onSchliessen = vi.fn();
  render(
    <AblaufAnzeige
      titel="Gottesdienst"
      tag={o.tag ?? '2026-11-01'}
      beginn="10:00"
      ende="11:30"
      zeilen={ZEILEN}
      infoGruppen={o.infoGruppen ?? [{ id: 3, name: 'Technik' }]}
      zeitzone="Europe/Berlin"
      onSchliessen={onSchliessen}
    />,
  );
  return { onSchliessen, anzeige: screen.getByRole('dialog', { name: 'Ablauf: Gottesdienst' }) };
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-11-01T08:47:00Z')); // 09:47 in Berlin
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  Reflect.deleteProperty(document, 'fullscreenEnabled');
});

describe('Ablauf-Anzeige (E6b-1)', () => {
  it('Uhr und Tag in Gemeinde-Zeit, rechts Titel, Beginn und Ende', () => {
    const { anzeige } = zeige();
    expect(within(anzeige).getByText('09:47')).toBeTruthy();
    expect(within(anzeige).getByText('Sonntag, 1. November')).toBeTruthy();
    expect(within(anzeige).getByText('Gottesdienst')).toBeTruthy();
    expect(within(anzeige).getByText('Beginn 10:00 · Ende ca. 11:30')).toBeTruthy();
  });

  it('ein anderer Tag als heute: sein Datum steht vorne dabei', () => {
    const { anzeige } = zeige({ tag: '2026-11-08' });
    expect(within(anzeige).getByText('So, 08.11. · Beginn 10:00 · Ende ca. 11:30')).toBeTruthy();
  });

  it('Punkte mit Zeit, Dauer, Titel samt Lied und Zuständigen; Abschnitt als Band; „Beginn“ nach dem Vorlauf', () => {
    const { anzeige } = zeige();
    const text = anzeige.textContent ?? '';
    expect(text).toContain('09:3030 Min');
    expect(within(anzeige).getByText('Lobpreis')).toBeTruthy();
    expect(within(anzeige).getByText(/Treu/)).toBeTruthy();
    expect(within(anzeige).getByText('Clara Test')).toBeTruthy();
    expect(text.indexOf('Soundcheck')).toBeLessThan(text.indexOf('Beginn 10:00Lobpreis'));
  });

  it('an diesem Termin weggelassene Punkte stehen nicht da', () => {
    const { anzeige } = zeige();
    expect(within(anzeige).queryByText('Abkündigungen')).toBeNull();
  });

  it('nur die Infos der gewählten Gruppen', () => {
    const { anzeige } = zeige();
    expect(within(anzeige).getByText(/Mikros prüfen/)).toBeTruthy();
    expect(within(anzeige).queryByText(/Intro leise/)).toBeNull();
    cleanup();
    const zwei = zeige({ infoGruppen: [] }).anzeige;
    expect(within(zwei).queryByText(/Mikros prüfen/)).toBeNull();
  });

  it('nichts verstellbar: nur „Schließen“ (Vollbild nur, wo der Browser es kann); Escape schließt auch', () => {
    const { anzeige, onSchliessen } = zeige();
    expect(
      within(anzeige)
        .getAllByRole('button')
        .map((b) => b.textContent),
    ).toEqual(['Schließen']);
    fireEvent.click(within(anzeige).getByRole('button', { name: 'Schließen' }));
    expect(onSchliessen).toHaveBeenCalledTimes(1);
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onSchliessen).toHaveBeenCalledTimes(2);
  });

  it('wo der Browser es kann: „Vollbild“, auch mit Taste F', () => {
    Object.defineProperty(document, 'fullscreenEnabled', { value: true, configurable: true });
    const anfordern = vi.fn(() => Promise.resolve());
    HTMLElement.prototype.requestFullscreen = anfordern;
    try {
      const { anzeige } = zeige();
      fireEvent.click(within(anzeige).getByRole('button', { name: 'Vollbild' }));
      fireEvent.keyDown(window, { key: 'f' });
      expect(anfordern).toHaveBeenCalledTimes(2);
    } finally {
      Reflect.deleteProperty(HTMLElement.prototype, 'requestFullscreen');
    }
  });

  it('der Bildschirm bleibt an, solange die Anzeige offen ist', async () => {
    const freigeben = vi.fn(() => Promise.resolve());
    const anfordern = vi.fn(() =>
      Promise.resolve({
        release: freigeben,
        addEventListener: () => {},
      } as unknown as WakeLockSentinel),
    );
    vi.stubGlobal('navigator', { ...navigator, wakeLock: { request: anfordern } });
    const { anzeige } = zeige();
    expect(anfordern).toHaveBeenCalledWith('screen');
    expect(within(anzeige).getByText('Bildschirm bleibt an')).toBeTruthy();
    await Promise.resolve();
    cleanup();
    await Promise.resolve();
    expect(freigeben).toHaveBeenCalled();
  });

  describe('Schrift passt sich an', () => {
    // jsdom rechnet kein Layout: Die Liste ist 300 hoch, ihr Inhalt 15 × Schriftgröße.
    beforeEach(() => {
      Object.defineProperty(HTMLElement.prototype, 'clientHeight', {
        configurable: true,
        get(this: HTMLElement) {
          return this.dataset.schrift !== undefined ? 300 : 0;
        },
      });
    });
    afterEach(() => {
      Reflect.deleteProperty(HTMLElement.prototype, 'clientHeight');
      Reflect.deleteProperty(HTMLElement.prototype, 'scrollHeight');
    });
    const inhalt = (je: number) =>
      Object.defineProperty(HTMLElement.prototype, 'scrollHeight', {
        configurable: true,
        get(this: HTMLElement) {
          return this.dataset.schrift !== undefined ? je * parseFloat(this.style.fontSize) : 0;
        },
      });

    it('so groß wie möglich, ohne zu scrollen', () => {
      inhalt(15); // passt bei 20 px (300)
      const { anzeige } = zeige();
      const liste = anzeige.querySelector('[data-schrift]') as HTMLElement;
      expect(liste.dataset.schrift).toBe('20');
      expect(liste.className).not.toMatch(/scrollt/);
    });

    it('kurzer Ablauf: höchstens 26 px', () => {
      inhalt(5);
      const liste = zeige().anzeige.querySelector('[data-schrift]') as HTMLElement;
      expect(liste.dataset.schrift).toBe('26');
    });

    it('selbst bei 13 px zu lang: dann scrollen statt unleserlich', () => {
      inhalt(40);
      const liste = zeige().anzeige.querySelector('[data-schrift]') as HTMLElement;
      expect(liste.dataset.schrift).toBe('13');
      expect(liste.className).toMatch(/scrollt/);
    });
  });
});
