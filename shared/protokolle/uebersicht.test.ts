import { describe, expect, it } from 'vitest';
import { alsGeloescht, neueAufgabe, statusSetzen, type Aufgabe } from './aufgaben';
import {
  einteilen,
  langeErledigt,
  sichtbarFuer,
  zustaendigFuer,
  type ToDoEintrag,
} from './uebersicht';

const HEUTE = '2026-10-30';
const aufgabe = (id: string, t: Partial<Aufgabe> = {}): Aufgabe => ({
  ...neueAufgabe({ id, gruppe: 11, sitzung: null, text: id, von: 1, am: '2026-10-01T10:00:00Z' }),
  ...t,
});
const erledigt = (id: string, am: string, t: Partial<Aufgabe> = {}) =>
  statusSetzen(aufgabe(id, t), 'erledigt', 1, am);
const LT = { id: 11, name: 'Leitungsteam' };
const ein = (a: Aufgabe): ToDoEintrag => ({ aufgabe: a, gruppe: LT });

describe('sichtbarFuer', () => {
  const meins = aufgabe('m', { wer: [19] });
  const fremd = aufgabe('f', { wer: [23] });
  const extern = aufgabe('x', { extern: 'Hausmeister Becker' });
  const niemand = aufgabe('n');
  it('Leitung: alle (außer gelöschte)', () => {
    for (const a of [meins, fremd, extern, niemand])
      expect(sichtbarFuer(a, { ich: 1, leitung: true })).toBe(true);
    expect(sichtbarFuer(alsGeloescht(fremd, 1, 'x'), { ich: 1, leitung: true })).toBe(false);
  });
  it('Mitglied: eigene und die ohne Zuständigen – nicht fremde, nicht nur Externe', () => {
    const q = { ich: 19, leitung: false };
    expect([meins, fremd, extern, niemand].map((a) => sichtbarFuer(a, q))).toEqual([
      true,
      false,
      false,
      true,
    ]);
  });
  it('Mitglied: ein angelegtes, aber anderen gegebenes To-Do sieht es nicht (Frage 3)', () => {
    expect(sichtbarFuer(aufgabe('a', { wer: [23] }), { ich: 19, leitung: false })).toBe(false);
  });
});

describe('zustaendigFuer', () => {
  it.each<[Partial<Aufgabe>, string]>([
    [{ wer: [1, 23] }, 'ich'],
    [{ wer: [23] }, 'andere'],
    [{ extern: 'Becker' }, 'andere'],
    [{ extern: '  ' }, 'niemand'],
    [{}, 'niemand'],
  ])('%o → %s', (t, erwartet) => {
    expect(zustaendigFuer(aufgabe('a', t), 1)).toBe(erwartet);
  });
});

describe('langeErledigt', () => {
  it('erledigt vor mehr als 30 Tagen: ja; genau 30 Tage: nein; offen: nein', () => {
    expect(langeErledigt(erledigt('a', '2026-09-29T08:00:00Z'), HEUTE)).toBe(true);
    expect(langeErledigt(erledigt('b', '2026-09-30T08:00:00Z'), HEUTE)).toBe(false);
    expect(langeErledigt(aufgabe('c'), HEUTE)).toBe(false);
  });
  it('erledigt ohne Verlaufseintrag (alter Stand): zählt als alt', () => {
    expect(langeErledigt(aufgabe('d', { status: 'erledigt' }), HEUTE)).toBe(true);
  });
});

describe('einteilen', () => {
  const ue = aufgabe('über', { wer: [23], bis: '2026-10-20' });
  const arb = statusSetzen(aufgabe('arb', { wer: [1, 31] }), 'arbeit', 1, '2026-10-25T08:00:00Z');
  const off = aufgabe('off', { wer: [1], bis: '2026-11-10' });
  const ext = aufgabe('ext', { extern: 'Hausmeister Becker' });
  const nie = aufgabe('nie');
  const erl = erledigt('erl', '2026-10-26T08:00:00Z', { wer: [23] });
  const alle = [ue, arb, off, ext, nie, erl].map(ein);
  const namen = new Map([
    [1, 'Alwin Friesen'],
    [23, 'Johann Becker'],
    [31, 'Maria Klein'],
  ]);

  it('nach Status: Überfällig · In Arbeit · Offen · Erledigt, leere fehlen', () => {
    const b = einteilen(alle, { nach: 'status', heute: HEUTE, ich: 1, namen });
    expect(b.map((x) => [x.titel, x.eintraege.map((e) => e.aufgabe.id)])).toEqual([
      ['Überfällig', ['über']],
      ['In Arbeit', ['arb']],
      ['Offen', ['off', 'ext', 'nie']],
      ['Erledigt', ['erl']],
    ]);
    expect(einteilen([ein(off)], { nach: 'status', heute: HEUTE, ich: 1, namen })).toHaveLength(1);
  });

  it('nach Person: ich zuerst, dann nach Namen; Externe und ohne Zuständige zuletzt; je Bereich das Dringendste oben', () => {
    const b = einteilen(alle, { nach: 'person', heute: HEUTE, ich: 1, namen });
    expect(b.map((x) => [x.titel, x.eintraege.map((e) => e.aufgabe.id)])).toEqual([
      ['Alwin Friesen (du)', ['arb', 'off']],
      ['Johann Becker', ['über', 'erl']],
      ['Maria Klein', ['arb']],
      ['Außerhalb der Gruppe', ['ext']],
      ['Noch niemand zuständig', ['nie']],
    ]);
  });

  it('nach Person: ich zuerst, auch wenn mein Name alphabetisch hinten steht', () => {
    const b = einteilen(alle, { nach: 'person', heute: HEUTE, ich: 31, namen });
    expect(b.map((x) => x.titel).slice(0, 3)).toEqual([
      'Maria Klein (du)',
      'Alwin Friesen',
      'Johann Becker',
    ]);
  });

  it('nach Person: unbekannter Name → „Person <ID>“; die Gruppe bleibt am Eintrag', () => {
    const fremd = { aufgabe: aufgabe('z', { wer: [99] }), gruppe: { id: 194, name: 'Technik' } };
    const b = einteilen([fremd], { nach: 'person', heute: HEUTE, ich: 1, namen });
    expect(b[0]).toMatchObject({ titel: 'Person 99', eintraege: [fremd] });
  });
});
