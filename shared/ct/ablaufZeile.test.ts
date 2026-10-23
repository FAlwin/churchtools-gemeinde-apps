import { describe, it, expect } from 'vitest';
import type { CtAgendaItem } from './typen';
import {
  ablaufUhrzeit,
  ablaufZeileAus,
  beginnStelle,
  itemLabel,
  itemTitleParts,
  istWeggelassen,
} from './ablaufZeile';

/** Regeln der Anzeige-Bezeichnung (#200) – gelten in Liste, Vollansicht und Dialogen gleich. */
describe('itemTitleParts', () => {
  it('ohne Lied: nur der eigene Titel', () => {
    expect(itemTitleParts({ title: 'Begrüßung', song: null })).toEqual({
      title: 'Begrüßung',
      songName: null,
    });
  });

  it('mit Lied und eigenem Titel: beides (CT-Format)', () => {
    expect(itemTitleParts({ title: 'Lied', song: { title: 'Du großer Gott' } })).toEqual({
      title: 'Lied',
      songName: 'Du großer Gott',
    });
  });

  it('leerer Titel: der Liedname wird die Bezeichnung', () => {
    expect(itemTitleParts({ title: '   ', song: { title: 'Würdig ist das Lamm' } })).toEqual({
      title: 'Würdig ist das Lamm',
      songName: null,
    });
  });

  it('Titel gleich Liedname: keine Dopplung', () => {
    expect(
      itemTitleParts({ title: 'Ruft zu dem Herrn', song: { title: 'Ruft zu dem Herrn' } }),
    ).toEqual({ title: 'Ruft zu dem Herrn', songName: null });
  });

  it('Dopplung wird auch bei abweichender Groß-/Kleinschreibung und Rand-Leerzeichen erkannt', () => {
    expect(
      itemTitleParts({ title: ' du GROSSER gott ', song: { title: 'Du grosser Gott' } }),
    ).toEqual({ title: 'Du grosser Gott', songName: null });
  });

  it('Titel wird für die Anzeige getrimmt', () => {
    expect(
      itemTitleParts({ title: '  Lobpreis 1  ', song: { title: 'Ruft zu dem Herrn' } }),
    ).toEqual({ title: 'Lobpreis 1', songName: 'Ruft zu dem Herrn' });
  });
});

describe('itemLabel', () => {
  it('verbindet Titel und Liedname mit Gedankenstrich', () => {
    expect(itemLabel({ title: 'Lied', song: { title: 'Du großer Gott' } })).toBe(
      'Lied – Du großer Gott',
    );
  });

  it('nur der Titel, wenn der Liedname nichts hinzufügt', () => {
    expect(itemLabel({ title: 'Predigt', song: null })).toBe('Predigt');
    expect(itemLabel({ title: '', song: { title: 'Würdig ist das Lamm' } })).toBe(
      'Würdig ist das Lamm',
    );
  });
});

/** #423 – aus `client/src/utils/vorlauf.test.ts` hierher (E6-1a). */
const punkt = (id: number, vorBeginn: boolean) => ({ id, vorBeginn });

describe('beginnStelle', () => {
  it('ohne Vorlauf keine Linie', () => {
    expect(beginnStelle([punkt(1, false), punkt(2, false)])).toBe(-1);
  });

  it('vor dem ersten Punkt nach dem Vorlauf', () => {
    expect(beginnStelle([punkt(1, true), punkt(2, true), punkt(3, false)])).toBe(2);
  });

  it('sind alle Punkte Vorlauf, steht sie am Ende', () => {
    expect(beginnStelle([punkt(1, true), punkt(2, true)])).toBe(2);
  });

  it('„entfernt"-Platzhalter ziehen die Linie nicht vor sich', () => {
    // Ein Platzhalter zwischen Vorlauf und Gottesdienst: Die Linie gehört vor den echten Punkt.
    const zeilen = [punkt(1, true), { removed: true }, punkt(3, false)];
    expect(beginnStelle(zeilen)).toBe(2);
  });

  it('leerer Ablauf: keine Linie', () => {
    expect(beginnStelle([])).toBe(-1);
  });
});

describe('ablaufUhrzeit (E6-1a) – „Auge“ und Zeitzone der Gemeinde', () => {
  const p = (o: Partial<CtAgendaItem>): CtAgendaItem => ({ id: 1, title: 'P', ...o });
  it('maßgeblich ist startTimes[termin], in Ortszeit', () => {
    const item = p({
      start: '2026-10-25T08:00:00Z',
      startTimes: { '148': '2026-10-25T09:05:00Z' },
    });
    expect(ablaufUhrzeit(item, 148, 'Europe/Berlin')).toBe('10:05');
  });
  it('startTimes[termin] = null → ausgeblendet (Auge): keine Uhrzeit, obwohl `start` gefüllt ist', () => {
    const item = p({ start: '2026-10-25T09:05:00Z', startTimes: { '148': null } });
    expect(ablaufUhrzeit(item, 148, 'Europe/Berlin')).toBeNull();
  });
  it('ohne startTimes gilt start; ohne alles oder unlesbar: null', () => {
    expect(ablaufUhrzeit(p({ start: '2026-01-15T09:05:00Z' }), 1, 'Europe/Berlin')).toBe('10:05');
    expect(ablaufUhrzeit(p({}), 1, 'Europe/Berlin')).toBeNull();
    expect(ablaufUhrzeit(p({ start: 'keine-zeit' }), 1, 'Europe/Berlin')).toBeNull();
  });
  it('die Zeitzone der Gemeinde zählt, nicht fest Berlin (#414)', () => {
    const item = p({ startTimes: { '1': '2026-10-25T09:05:00Z' } });
    expect(ablaufUhrzeit(item, 1, 'Europe/London')).toBe('09:05');
    expect(ablaufUhrzeit(item, 1, 'Europe/Berlin')).toBe('10:05');
  });
});

describe('ablaufZeileAus (E6-1a)', () => {
  it('Felder wie die Musik-App sie zeigt – Dauer in Minuten, Lied nur mit Namen', () => {
    const z = ablaufZeileAus(
      {
        id: 7,
        title: 'Lied',
        type: 'song',
        note: 'leise',
        duration: 270,
        isBeforeEvent: true,
        startTimes: { '148': '2026-10-25T08:55:00Z' },
        responsible: {
          text: '[Musik]',
          persons: [{ service: '[Musik]', person: { title: 'Ella' } }],
        },
        song: {
          songId: 1,
          arrangementId: 2,
          title: 'Way Maker',
          arrangement: 'D',
          key: 'D',
          bpm: null,
        },
      },
      148,
      'Europe/Berlin',
    );
    expect(z).toEqual({
      id: 7,
      title: 'Lied',
      type: 'song',
      isHeader: false,
      responsible: [{ label: 'Ella', open: false, kuerzel: 'E' }],
      responsibleText: '[Musik]',
      // Tonart und Tempo für die Lied-Karte (E6-O1); den Autor liefert der Ablauf nicht.
      song: { title: 'Way Maker', arrangementId: 2, originalKey: 'D', bpm: null },
      time: '09:55',
      vorBeginn: true,
      durationMin: 5,
      note: 'leise',
      weggelassen: false,
    });
  });
  it('Überschrift; ohne Dauer → null', () => {
    const z = ablaufZeileAus(
      { id: 1, title: 'Lobpreis', type: 'header', duration: 0 },
      1,
      'Europe/Berlin',
    );
    expect([z.isHeader, z.durationMin, z.song]).toEqual([true, null, null]);
  });
});

describe('istWeggelassen (E6-3b) – das Auge an diesem Termin', () => {
  const punkt = (startTimes?: Record<string, string | null>): CtAgendaItem => ({
    id: 1,
    title: 'Abkündigungen',
    start: '2026-10-18T08:30:00Z',
    startTimes,
  });

  it('`startTimes[termin]` ist null → weggelassen (gemessen E6-3-0)', () => {
    expect(istWeggelassen(punkt({ '7': null }), 7)).toBe(true);
    expect(ablaufZeileAus(punkt({ '7': null }), 7, 'Europe/Berlin')).toMatchObject({
      weggelassen: true,
      time: null,
    });
  });

  it('mit Uhrzeit → nicht weggelassen', () => {
    expect(istWeggelassen(punkt({ '7': '2026-10-18T08:30:00Z' }), 7)).toBe(false);
  });

  it('nur an einem ANDEREN Termin weggelassen (geteilter Ablauf) → hier nicht', () => {
    expect(istWeggelassen(punkt({ '8': null, '7': '2026-10-18T08:30:00Z' }), 7)).toBe(false);
    expect(istWeggelassen(punkt({ '8': null }), 7)).toBe(false);
  });

  it('ohne `startTimes` (ältere Antwort) → nicht weggelassen', () => {
    expect(istWeggelassen(punkt(), 7)).toBe(false);
  });
});
