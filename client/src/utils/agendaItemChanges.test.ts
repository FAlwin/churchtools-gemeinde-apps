import { describe, it, expect } from 'vitest';
import type { AgendaItem } from '@shared/types/index';
import {
  pendingAgendaFields,
  durationTarget,
  isDurationValid,
  neuerAgendaPunkt,
  type AgendaItemDraft,
} from './agendaItemChanges';

/**
 * #215: Diese Regeln lagen in `ItemActionSheet` und liefen bei jedem Render. Wichtig sind vor allem
 * die beiden nicht offensichtlichen: Ein geleertes Dauer-Feld wird als **0** geschrieben (CT kennt
 * kein „keine Dauer"), und ein leerer Titel wird gar nicht erst geschickt – CT braucht eine
 * Bezeichnung, und ein leerer Titel würde den Punkt im Ablauf namenlos machen.
 */
function item(over: Partial<AgendaItem> = {}): AgendaItem {
  return {
    id: 1,
    title: 'Lied',
    durationMin: 5,
    responsibleText: 'Anna',
    note: 'Notiz',
    isHeader: false,
    song: null,
    ...over,
  } as unknown as AgendaItem;
}

function draft(over: Partial<AgendaItemDraft> = {}): AgendaItemDraft {
  return {
    title: 'Lied',
    duration: '5',
    responsible: 'Anna',
    note: 'Notiz',
    link: { kind: 'keep' },
    ...over,
  };
}

describe('pendingAgendaFields – nur echte Änderungen', () => {
  it('ohne Änderung wird nichts geschrieben', () => {
    expect(pendingAgendaFields(item(), draft())).toEqual({});
  });

  it('geänderter Titel wird getrimmt übernommen', () => {
    expect(pendingAgendaFields(item(), draft({ title: '  Vorspiel  ' }))).toEqual({
      title: 'Vorspiel',
    });
  });

  it('ein Titel, der sich nur in Leerzeichen unterscheidet, ist keine Änderung', () => {
    expect(pendingAgendaFields(item({ title: 'Lied' }), draft({ title: 'Lied  ' }))).toEqual({});
  });

  it('LEERER Titel wird nicht geschrieben (ChurchTools braucht eine Bezeichnung)', () => {
    expect(pendingAgendaFields(item(), draft({ title: '   ' }))).toEqual({});
  });

  it('Zuständig und Bemerkung werden getrimmt geschrieben', () => {
    expect(pendingAgendaFields(item(), draft({ responsible: ' Ben ', note: ' Neu ' }))).toEqual({
      responsible: 'Ben',
      note: 'Neu',
    });
  });

  it('Lied verknüpfen und Verknüpfung aufheben', () => {
    expect(
      pendingAgendaFields(item(), draft({ link: { kind: 'link', arrangementId: 77, name: 'X' } })),
    ).toEqual({ arrangementId: 77 });
    expect(pendingAgendaFields(item(), draft({ link: { kind: 'unlink' } }))).toEqual({
      unlink: true,
    });
  });

  it('sammelt mehrere Änderungen in EINEM Update', () => {
    const fields = pendingAgendaFields(
      item(),
      draft({ title: 'Neu', duration: '9', note: 'Anders' }),
    );
    expect(fields).toEqual({ title: 'Neu', durationMin: 9, note: 'Anders' });
  });
});

describe('durationTarget – „Dauer entfernen" heißt 0', () => {
  it('geänderte Dauer wird übernommen', () => {
    expect(durationTarget('9', 5)).toBe(9);
  });

  it('gleiche Dauer ist keine Änderung', () => {
    expect(durationTarget('5', 5)).toBeUndefined();
  });

  it('Feld leeren schreibt 0 – ChurchTools kennt kein „keine Dauer"', () => {
    expect(durationTarget('', 5)).toBe(0);
  });

  it('leeres Feld bei bereits fehlender oder 0-Dauer schreibt nichts', () => {
    expect(durationTarget('', null)).toBeUndefined();
    expect(durationTarget('', 0)).toBeUndefined();
  });

  it('ungültige Eingaben schreiben nichts', () => {
    expect(durationTarget('abc', 5)).toBeUndefined();
    expect(durationTarget('-3', 5)).toBeUndefined();
    expect(durationTarget('2.5', 5)).toBeUndefined();
  });
});

describe('isDurationValid', () => {
  it('leer ist gültig (= keine Angabe)', () => {
    expect(isDurationValid('')).toBe(true);
    expect(isDurationValid('   ')).toBe(true);
  });

  it('ganze Zahlen ab 0 sind gültig', () => {
    expect(isDurationValid('0')).toBe(true);
    expect(isDurationValid('45')).toBe(true);
  });

  it('negative, gebrochene und nicht-numerische Werte sind ungültig', () => {
    expect(isDurationValid('-1')).toBe(false);
    expect(isDurationValid('2.5')).toBe(false);
    expect(isDurationValid('abc')).toBe(false);
  });
});

/** „Neuer Eintrag" (05.10.2026): was angelegt wird – und wann noch nichts. */
describe('neuerAgendaPunkt', () => {
  const leer = {
    title: '',
    duration: '',
    responsible: '',
    note: '',
    link: { kind: 'keep' } as const,
  };
  const lied = { kind: 'link', arrangementId: 30, name: 'Treu' } as const;

  it('Programmpunkt mit Lied wird ein Lied-Punkt – ohne eigenen Titel heißt er wie das Lied', () => {
    expect(neuerAgendaPunkt('programmpunkt', { ...leer, link: lied })).toEqual({
      type: 'song',
      title: 'Treu',
      arrangementId: 30,
    });
  });

  it('Programmpunkt mit Lied und eigenem Titel behält den Titel', () => {
    expect(
      neuerAgendaPunkt('programmpunkt', { ...leer, title: ' Einsingen ', link: lied })?.title,
    ).toBe('Einsingen');
  });

  it('Programmpunkt ohne Lied braucht einen Titel; leere Felder werden weggelassen', () => {
    expect(neuerAgendaPunkt('programmpunkt', leer)).toBeNull();
    expect(
      neuerAgendaPunkt('programmpunkt', { ...leer, title: 'Begrüßung', responsible: '  ' }),
    ).toEqual({ type: 'text', title: 'Begrüßung' });
  });

  it('Dauer, Zuständige und Notiz gehen mit', () => {
    expect(
      neuerAgendaPunkt('programmpunkt', {
        ...leer,
        title: 'Predigt',
        duration: '30',
        responsible: ' [Predigt] ',
        note: 'kurz',
      }),
    ).toEqual({
      type: 'text',
      title: 'Predigt',
      durationMin: 30,
      responsible: '[Predigt]',
      note: 'kurz',
    });
  });

  it('eine ungültige Dauer macht den Punkt ungültig, statt still verloren zu gehen', () => {
    expect(
      neuerAgendaPunkt('programmpunkt', { ...leer, title: 'Predigt', duration: '2,5' }),
    ).toBeNull();
  });

  it('Überschrift: nur der Titel – auch ein vorgemerktes Lied und andere Felder bleiben weg', () => {
    expect(
      neuerAgendaPunkt('ueberschrift', {
        ...leer,
        title: 'Lobpreis',
        duration: '5',
        note: 'x',
        link: lied,
      }),
    ).toEqual({ type: 'header', title: 'Lobpreis' });
  });
});
