import { describe, it, expect } from 'vitest';
import { agendaItemWritePayload, vorlaufUmschalten } from './agendaPayload.js';
import type { CtAgendaItem } from './ctTypes.js';

/**
 * #212: Der riskanteste Schreibpfad des Projekts. ChurchTools ignoriert ein verschachteltes
 * `song`-Objekt und stuft den Punkt dann **unwiderruflich auf `text`** herab – die Lied-Verknüpfung
 * wäre weg. Diese Tests nageln fest, dass die Verknüpfung als top-level `arrangementId` mitgeht
 * und `type: 'song'` erhalten bleibt. Seit #200 läuft JEDES Speichern eines Lied-Punkts hier durch.
 */
const songItem = (over: Partial<CtAgendaItem> = {}): CtAgendaItem =>
  ({
    id: 1,
    title: 'Lied',
    type: 'song',
    note: 'Bitte langsam',
    duration: 240,
    isBeforeEvent: false,
    responsible: { text: '[Musik]' },
    song: { songId: 42, arrangementId: 77, title: 'Du großer Gott' },
    ...over,
  }) as CtAgendaItem;

const textItem = (over: Partial<CtAgendaItem> = {}): CtAgendaItem =>
  ({
    id: 2,
    title: 'Begrüßung',
    type: 'text',
    note: '',
    duration: 600,
    isBeforeEvent: false,
    responsible: { text: 'Willi' },
    song: null,
    ...over,
  }) as CtAgendaItem;

describe('agendaItemWritePayload – Lied-Verknüpfung bewahren', () => {
  it('Titel-Änderung an einem Lied-Punkt behält arrangementId UND type song (#200)', () => {
    const p = agendaItemWritePayload(songItem(), { title: 'Lobpreis 1' });
    expect(p.title).toBe('Lobpreis 1');
    expect(p.type).toBe('song');
    expect(p.arrangementId).toBe(77); // top-level – sonst Herabstufung auf text!
  });

  it('ohne Änderungen bleibt der Punkt exakt wie er ist (wichtig beim Umsortieren)', () => {
    const p = agendaItemWritePayload(songItem());
    expect(p).toMatchObject({
      title: 'Lied',
      type: 'song',
      note: 'Bitte langsam',
      duration: 240,
      responsible: '[Musik]',
      arrangementId: 77,
    });
    expect(p.position).toBeUndefined(); // nur beim Reorder gesetzt
  });

  it('jede andere Feld-Änderung lässt die Verknüpfung unberührt', () => {
    for (const over of [
      { note: 'neu' },
      { responsible: '[Predigt]' },
      { durationSec: 300 },
      { position: 3 },
    ]) {
      const p = agendaItemWritePayload(songItem(), over);
      expect(p.type, JSON.stringify(over)).toBe('song');
      expect(p.arrangementId, JSON.stringify(over)).toBe(77);
    }
  });
});

describe('agendaItemWritePayload – Verknüpfen und Aufheben', () => {
  it('arrangementId hebt einen Text-Punkt auf type song an', () => {
    const p = agendaItemWritePayload(textItem(), { arrangementId: 99 });
    expect(p.type).toBe('song');
    expect(p.arrangementId).toBe(99);
  });

  it('unlink macht type text OHNE arrangementId', () => {
    const p = agendaItemWritePayload(songItem(), { unlink: true });
    expect(p.type).toBe('text');
    expect(p.arrangementId).toBeUndefined();
  });

  it('unlink + neuer Titel: beides zusammen (Verknüpfung lösen und umbenennen)', () => {
    const p = agendaItemWritePayload(songItem(), { unlink: true, title: 'Instrumental' });
    expect(p.type).toBe('text');
    expect(p.title).toBe('Instrumental');
    expect(p.arrangementId).toBeUndefined();
  });

  it('unlink schlägt eine gleichzeitig übergebene arrangementId', () => {
    const p = agendaItemWritePayload(songItem(), { unlink: true, arrangementId: 99 });
    expect(p.type).toBe('text');
    expect(p.arrangementId).toBeUndefined();
  });
});

describe('agendaItemWritePayload – position und Standardwerte', () => {
  it('position wird nur gesetzt, wenn sie übergeben wurde', () => {
    expect(agendaItemWritePayload(textItem(), { position: 0 }).position).toBe(0); // auch 0!
    expect(agendaItemWritePayload(textItem()).position).toBeUndefined();
  });

  it('fehlende Felder werden zu leeren Standardwerten (CT verlangt sie)', () => {
    const bare = { id: 3, title: 'X', type: 'text', song: null } as unknown as CtAgendaItem;
    const p = agendaItemWritePayload(bare);
    expect(p).toMatchObject({ note: '', duration: 0, responsible: '', isBeforeEvent: false });
  });

  it('Überschrift behält ihren Typ', () => {
    const header = textItem({ type: 'header', title: 'Lobpreis' });
    expect(agendaItemWritePayload(header, { title: 'Anbetung' })).toMatchObject({
      type: 'header',
      title: 'Anbetung',
    });
  });

  it('Dauer 0 wird übernommen (Dauer entfernen), nicht als „fehlend" behandelt', () => {
    expect(agendaItemWritePayload(songItem(), { durationSec: 0 }).duration).toBe(0);
  });
});

/**
 * #423: Der Vorlauf ist in ChurchTools eine Grenze (`eventStartPosition`), kein Feld je Punkt. Seit 30.10.2026 (Alwin)
 * wechselt beim Umschalten nur DIESER Punkt die Seite: Er rückt an die Grenze, die Grenze um eins. Gemessen 05.10.2026:
 * Punkte mit `position` < Grenze sind Vorlauf.
 */
describe('vorlaufUmschalten – nur der eine Punkt wechselt die Seite', () => {
  const ablauf = (n: number) => Array.from({ length: n }, (_, k) => ({ id: k + 1, position: k }));

  it('an: der Punkt rückt direkt über „Beginn“, alle anderen bleiben auf ihrer Seite', () => {
    // Vorlauf: 1. Punkt 4 einschalten → 1, 4 Vorlauf; 2, 3, 5 bleiben Gottesdienst.
    expect(vorlaufUmschalten(ablauf(5), 1, 4, true)).toEqual({
      reihenfolge: [1, 4, 2, 3, 5],
      grenze: 2,
    });
  });

  it('aus: der Punkt rückt direkt unter „Beginn“, die übrigen Vorlauf-Punkte bleiben Vorlauf', () => {
    // Vorlauf: 1, 2, 3. Punkt 1 ausschalten → 2, 3 Vorlauf, 1 erster Punkt des Gottesdienstes.
    expect(vorlaufUmschalten(ablauf(5), 3, 1, false)).toEqual({
      reihenfolge: [2, 3, 1, 4, 5],
      grenze: 2,
    });
  });

  it('an ohne Vorlauf: der Punkt wird der einzige Vorlauf-Punkt, ganz oben', () => {
    expect(vorlaufUmschalten(ablauf(4), 0, 3, true)).toEqual({
      reihenfolge: [3, 1, 2, 4],
      grenze: 1,
    });
  });

  it('aus, wenn alles Vorlauf ist: der Punkt wird der einzige Punkt des Gottesdienstes, ganz unten', () => {
    expect(vorlaufUmschalten(ablauf(4), 4, 2, false)).toEqual({
      reihenfolge: [1, 3, 4, 2],
      grenze: 3,
    });
  });

  it('steht der Punkt schon an der Grenze, rückt nur sie (kein Umsortieren)', () => {
    expect(vorlaufUmschalten(ablauf(5), 1, 2, true)).toEqual({ reihenfolge: null, grenze: 2 });
    expect(vorlaufUmschalten(ablauf(5), 3, 3, false)).toEqual({ reihenfolge: null, grenze: 2 });
  });

  it('steht schon so oder fehlt: nichts zu schreiben (null)', () => {
    expect(vorlaufUmschalten(ablauf(5), 2, 1, true)).toBeNull(); // schon Vorlauf
    expect(vorlaufUmschalten(ablauf(5), 2, 3, false)).toBeNull(); // erster nach der Grenze
    expect(vorlaufUmschalten(ablauf(5), 2, 99, true)).toBeNull();
  });

  it('ohne position zählt der Listenplatz', () => {
    expect(vorlaufUmschalten([{ id: 7 }, { id: 8 }], 0, 8, true)).toEqual({
      reihenfolge: [8, 7],
      grenze: 1,
    });
  });
});
