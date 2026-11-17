import { describe, expect, it } from 'vitest';
import { alsGeloescht, neueAufgabe } from './aufgaben';
import {
  aufgabenAusProtokoll,
  eingeladeneMitMail,
  gesperrtText,
  loeschbar,
  NICHT_RUECKGAENGIG,
  statusWort,
  terminZusatz,
  todosUeberschrift,
  treffenZusatz,
  unterbrochenText,
} from './loeschen';

const am = '2026-11-17T10:00:00Z';
const aufgabe = (id: string, sitzung: string | null, gruppe = 194) =>
  neueAufgabe({ id, gruppe, sitzung, text: `To-Do ${id}`, von: 1, am });

describe('aufgabenAusProtokoll – welche To-Dos „aus diesem Protokoll“ sind', () => {
  it('nur die der Sitzung; ohne Sitzung und aus anderen Sitzungen nicht', () => {
    const liste = [aufgabe('a', 's1'), aufgabe('b', 's2'), aufgabe('c', null), aufgabe('d', 's1')];
    expect(aufgabenAusProtokoll(liste, 's1').map((a) => a.id)).toEqual(['a', 'd']);
  });

  it('bereits gelöschte zählen nicht mit – die Zahl im Fenster und das Mitlöschen meinen dasselbe', () => {
    const liste = [aufgabe('a', 's1'), alsGeloescht(aufgabe('b', 's1'), 1, am)];
    expect(aufgabenAusProtokoll(liste, 's1').map((a) => a.id)).toEqual(['a']);
  });

  it('auf Wunsch nur einer Gruppe', () => {
    const liste = [aufgabe('a', 's1', 194), aufgabe('b', 's1', 7)];
    expect(aufgabenAusProtokoll(liste, 's1', 7).map((a) => a.id)).toEqual(['b']);
  });
});

describe('eingeladeneMitMail', () => {
  it('alle außer dem, der löscht – jede Person einmal', () => {
    expect(eingeladeneMitMail([1, 19, 7, 19], 1)).toBe(2);
    expect(eingeladeneMitMail([1], 1)).toBe(0);
    expect(eingeladeneMitMail([], 1)).toBe(0);
  });
});

describe('Texte der Rückfrage', () => {
  it('Status heißt in der Rückfrage wie in der Liste', () => {
    expect(statusWort('frei')).toBe('freigegeben');
    expect(statusWort('entwurf')).toBe('Entwurf');
    expect(statusWort('geplant')).toBe('geplant');
  });

  it('löschbar sind Entwurf und freigegeben – ein bloß geplantes Protokoll nicht', () => {
    expect(loeschbar('entwurf')).toBe(true);
    expect(loeschbar('frei')).toBe(true);
    expect(loeschbar('geplant')).toBe(false);
    expect(loeschbar(undefined)).toBe(false);
  });

  it('der Satz „nicht rückgängig“ ist da', () => {
    expect(NICHT_RUECKGAENGIG).toBe('Das lässt sich nicht rückgängig machen.');
  });

  it('Termin: Zahl der Eingeladenen, Einzahl, niemand, Serie (still)', () => {
    expect(terminZusatz({ eingeladene: 3, serie: false })).toBe(
      '3 Eingeladene bekommen die Mail „Termin gelöscht“.',
    );
    expect(terminZusatz({ eingeladene: 1, serie: false })).toBe(
      'Eine Person bekommt die Mail „Termin gelöscht“.',
    );
    expect(terminZusatz({ eingeladene: 0, serie: false })).toContain('keine Mail');
    // Bei einer Serie zählt die Zahl nicht: Es fällt nur dieser Tag heraus, ohne Mail.
    const serie = terminZusatz({ eingeladene: 5, serie: true });
    expect(serie).toContain('Nur diese Sitzung');
    expect(serie).toContain('Ohne Mail');
    expect(serie).not.toContain('5');
  });

  it('Gruppentreffen: nur ein abgeschlossenes hat etwas zu verlieren', () => {
    expect(treffenZusatz(true)).toBe('Abgeschlossen – die Anwesenheit geht mit verloren.');
    expect(treffenZusatz(false)).toBeNull();
  });

  it('Überschrift der To-Dos mit Zahl', () => {
    expect(todosUeberschrift(3)).toBe('To-Dos aus diesem Protokoll (3)');
  });
});

describe('Meldungen, wenn es nicht glatt durchläuft', () => {
  it('unterbrochen: was erledigt ist, was offen ist, warum – und dass nichts doppelt geschieht', () => {
    const t = unterbrochenText({
      erledigt: ['todos'],
      offen: ['termin', 'protokoll'],
      grund: 'ChurchTools antwortet gerade nicht.',
    });
    expect(t).toContain('Schon erledigt: To-Dos als gelöscht vermerkt.');
    expect(t).toContain('Noch offen: der Termin, das Protokoll.');
    expect(t).toContain('ChurchTools antwortet gerade nicht.');
    expect(t).toContain('nichts doppelt');
  });

  it('unterbrochen ohne Erledigtes: sagt, dass noch nichts gelöscht wurde', () => {
    const t = unterbrochenText({ erledigt: [], offen: ['protokoll'], grund: 'Fehler.' });
    expect(t).toContain('Bisher wurde nichts gelöscht.');
    expect(t).not.toContain('Schon erledigt');
  });

  it('gesperrt: wer schreibt – und das eigene andere Fenster', () => {
    expect(gesperrtText({ von: 19, name: 'Peter' }, 1)).toContain('Peter schreibt gerade');
    expect(gesperrtText({ von: 1, name: 'Alwin' }, 1)).toContain(
      'Du schreibst in einem anderen Fenster',
    );
    expect(gesperrtText({ von: 19, name: 'Peter' }, 1, ['termin'])).toContain(
      'Schon erledigt: Termin gelöscht.',
    );
  });
});
