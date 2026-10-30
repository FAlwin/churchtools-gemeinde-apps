import { describe, expect, it } from 'vitest';
import { ablaufZeileAus, punktStand } from './ablaufZeile';
import { pendingAgendaFields } from './agendaItemChanges';
import {
  ABLAUF_ABGESCHLOSSEN,
  ABLAUF_VERWEIGERT,
  PUNKT_GEAENDERT,
  punktAendern,
  type CtSchreiber,
  type SchreibAuftrag,
} from './schreibKern';
import type { CtAgenda, CtAgendaItem } from './typen';

/**
 * **Infos je Dienstgruppe** (E6-4, Entwurf `e6-infos-spalten.html`, Alwin 30.10.2026). Die Attrappe verhält sich wie in
 * E6-4-0 gemessen (22.10.2026): `PUT …/items/{id}/servicegroups/{gruppe}` `{note}` legt an und ändert, `DELETE` löscht,
 * nur Leerzeichen nähme ChurchTools mit 400 nicht an; abgeschlossen → 403.
 */
const PUNKT: CtAgendaItem = {
  id: 7,
  title: 'Begrüßung',
  type: 'normal',
  note: '',
  duration: 300,
  responsible: { text: '' },
  serviceGroupNotes: [
    { serviceGroupId: 3, note: 'Mikro 1 an' },
    { serviceGroupId: 4, note: '' },
  ],
};

class Fehler extends Error {
  constructor(
    public status: number,
    m: string,
  ) {
    super(m);
  }
}

function attrappe(o: { gesperrt?: boolean } = {}) {
  let punkt: CtAgendaItem = structuredClone(PUNKT);
  const geschrieben: string[] = [];
  const s: CtSchreiber = {
    agenda: () =>
      Promise.resolve<CtAgenda>({ isLocked: o.gesperrt, items: [structuredClone(punkt)] }),
    song: () => Promise.reject(new Error('nicht gebraucht')),
    vorlage: () => Promise.reject(new Error('nicht gebraucht')),
    fehler: (status, meldung) => new Fehler(status, meldung),
    schreibe: (pfad: string, a: SchreibAuftrag) => {
      geschrieben.push(`${a.method} ${pfad}${a.json ? ' ' + JSON.stringify(a.json) : ''}`);
      if (o.gesperrt) return Promise.reject(new Error(ABLAUF_VERWEIGERT));
      const g = /\/servicegroups\/(\d+)$/.exec(pfad);
      if (g) {
        const gruppe = Number(g[1]);
        const rest = (punkt.serviceGroupNotes ?? []).filter((n) => n.serviceGroupId !== gruppe);
        const note = (a.json as { note?: string } | undefined)?.note;
        punkt = {
          ...punkt,
          serviceGroupNotes:
            a.method === 'PUT' && note ? [...rest, { serviceGroupId: gruppe, note }] : rest,
        };
      } else if (a.method === 'PUT') {
        punkt = { ...punkt, ...(a.json as Partial<CtAgendaItem>), id: punkt.id };
      }
      return Promise.resolve(null);
    },
  };
  return {
    s,
    geschrieben,
    /** Ein anderes Gerät ändert die Info der Gruppe dazwischen. */
    fremd: (gruppe: number, note: string) => {
      const rest = (punkt.serviceGroupNotes ?? []).filter((n) => n.serviceGroupId !== gruppe);
      punkt = { ...punkt, serviceGroupNotes: [...rest, { serviceGroupId: gruppe, note }] };
    },
    punkt: () => punkt,
  };
}

describe('Infos je Dienstgruppe lesen (E6-4)', () => {
  it('die Zeile trägt die Infos mit Text – leere fallen weg, ohne Infos fehlt das Feld', () => {
    expect(ablaufZeileAus(PUNKT, 1, 'Europe/Berlin').infos).toEqual([
      { gruppeId: 3, text: 'Mikro 1 an' },
    ]);
    expect('infos' in ablaufZeileAus({ ...PUNKT, serviceGroupNotes: [] }, 1, 'Europe/Berlin')).toBe(
      false,
    );
  });

  it('der Stand beim Öffnen enthält die Infos (für den Vergleich beim Speichern)', () => {
    expect(punktStand(ablaufZeileAus(PUNKT, 1, 'Europe/Berlin')).infos).toEqual({
      3: 'Mikro 1 an',
    });
  });
});

describe('Was das Punkt-Fenster schreiben würde (E6-4)', () => {
  const zeile = ablaufZeileAus(PUNKT, 1, 'Europe/Berlin');
  const entwurf = (infos: Record<number, string>) => ({
    title: zeile.title,
    duration: '5',
    responsible: '',
    note: '',
    link: { kind: 'keep' as const },
    infos,
  });

  it('nur geänderte Gruppen, ohne Rand-Leerzeichen; geleert = löschen; unverändert = nichts', () => {
    expect(pendingAgendaFields(zeile, entwurf({ 3: 'Mikro 1 an', 4: '' }))).toEqual({});
    expect(pendingAgendaFields(zeile, entwurf({ 3: ' Mikro 1 an ', 4: '' }))).toEqual({});
    expect(pendingAgendaFields(zeile, entwurf({ 3: 'Mikro 2', 4: '  Intro leise ' }))).toEqual({
      infos: { 3: 'Mikro 2', 4: 'Intro leise' },
    });
    expect(pendingAgendaFields(zeile, entwurf({ 3: '   ' }))).toEqual({ infos: { 3: '' } });
  });
});

describe('Infos je Dienstgruppe schreiben (E6-4)', () => {
  const gesehen = punktStand(ablaufZeileAus(PUNKT, 1, 'Europe/Berlin'));

  it('nur Infos: je Gruppe einzeln – der Punkt selbst wird nicht geschrieben', async () => {
    const a = attrappe();
    await punktAendern(a.s, 1, 7, { infos: { 3: 'Mikro 2', 4: 'Intro leise' } }, gesehen);
    expect(a.geschrieben).toEqual([
      'PUT /events/1/agenda/items/7/servicegroups/3 {"note":"Mikro 2"}',
      'PUT /events/1/agenda/items/7/servicegroups/4 {"note":"Intro leise"}',
    ]);
    expect(a.punkt().serviceGroupNotes).toEqual([
      { serviceGroupId: 3, note: 'Mikro 2' },
      { serviceGroupId: 4, note: 'Intro leise' },
    ]);
  });

  it('leer oder nur Leerzeichen → löschen (ChurchTools nähme es mit 400 nicht an)', async () => {
    const a = attrappe();
    await punktAendern(a.s, 1, 7, { infos: { 3: '  ' } }, gesehen);
    expect(a.geschrieben).toEqual(['DELETE /events/1/agenda/items/7/servicegroups/3']);
    expect(a.punkt().serviceGroupNotes).toEqual([{ serviceGroupId: 4, note: '' }]);
  });

  it('Titel und Info zusammen: erst der Punkt, dann die Info', async () => {
    const a = attrappe();
    await punktAendern(a.s, 1, 7, { title: 'Willkommen', infos: { 3: 'Mikro 2' } }, gesehen);
    expect(a.geschrieben.map((g) => g.split(' ').slice(0, 2).join(' '))).toEqual([
      'PUT /events/1/agenda/items/7',
      'PUT /events/1/agenda/items/7/servicegroups/3',
    ]);
  });

  it('dieselbe Info inzwischen woanders geändert → 412, nichts geschrieben; „Trotzdem speichern“ schreibt', async () => {
    const a = attrappe();
    a.fremd(3, 'Mikro 3');
    await expect(
      punktAendern(a.s, 1, 7, { infos: { 3: 'Mikro 2' } }, gesehen),
    ).rejects.toMatchObject({ status: 412, message: PUNKT_GEAENDERT });
    expect(a.geschrieben).toEqual([]);
    await punktAendern(a.s, 1, 7, { infos: { 3: 'Mikro 2' } });
    expect(a.punkt().serviceGroupNotes).toContainEqual({ serviceGroupId: 3, note: 'Mikro 2' });
  });

  it('eine ANDERE Gruppe inzwischen geändert → kein Konflikt', async () => {
    const a = attrappe();
    a.fremd(4, 'Band leise');
    await punktAendern(a.s, 1, 7, { infos: { 3: 'Mikro 2' } }, gesehen);
    expect(a.geschrieben).toEqual([
      'PUT /events/1/agenda/items/7/servicegroups/3 {"note":"Mikro 2"}',
    ]);
  });

  it('abgeschlossen → 423 wie beim Punkt', async () => {
    const a = attrappe({ gesperrt: true });
    await expect(punktAendern(a.s, 1, 7, { infos: { 3: 'x' } }, gesehen)).rejects.toMatchObject({
      status: 423,
      message: ABLAUF_ABGESCHLOSSEN,
    });
  });
});
