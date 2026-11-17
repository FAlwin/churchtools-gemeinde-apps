import { describe, expect, it } from 'vitest';
import { vorlageAnlegen, vorlagePunkteAus, vorlaufAnzahl } from './ablaufVorlagen';
import { vorlagenAus } from './ablaufAnlegen';
import {
  OHNE_KALENDER,
  vorlageZeilenAus,
  vorlagenListeAus,
  vorlagenStandAus,
} from './ablaufVorlagenListe';
import type { CtSchreiber } from './schreibKern';
import type { CtAblaufVorlage, CtAgenda, CtAgendaItem } from './typen';

/**
 * Die Vorlagen-Liste (E10-V3a). Die Eingabe kommt von den **Erzeugern**: `vorlagePunkteAus` macht aus dem Ablauf eines
 * Termins die Punkte und die Grenze einer Vorlage – so, wie sie in ChurchTools landen –, `vorlageAnlegen` schreibt über
 * den Schreib-Kern. Handgeschriebene Vorlagen gibt es nur für die Ränder (kein Kalender, kein Stand).
 */
const punkt = (id: number, titel: string, extra: Partial<CtAgendaItem> = {}): CtAgendaItem => ({
  id,
  position: id,
  title: titel,
  type: 'normal',
  duration: 300,
  note: '',
  ...extra,
});

/** Ein Termin-Ablauf mit zwei Punkten vor dem Beginn. */
const ABLAUF: CtAgenda = {
  id: 1,
  items: [punkt(0, 'Aufbau'), punkt(1, 'Soundcheck'), punkt(2, 'Begrüßung'), punkt(3, 'Predigt')],
  eventStartPosition: 2,
};

/** Eine Vorlage, wie ChurchTools sie aus dem Ablauf macht. */
function vorlageAus(id: number, name: string, kalender: number | null, stand?: string) {
  const { items, eventStartPosition } = vorlagePunkteAus(ABLAUF);
  const v: CtAblaufVorlage = {
    id,
    name,
    calendarId: kalender,
    eventStartPosition,
    items: items.map((it, k) => ({ id: k + 1, position: k, ...it }) as unknown as CtAgendaItem),
    ...(stand ? { meta: { modifiedDate: stand } } : {}),
  };
  return v;
}

describe('vorlagenListeAus', () => {
  it('gruppiert nach Kalender mit dem Namen aus /calendars, Kalender und Vorlagen nach Namen', () => {
    const roh = [
      vorlageAus(3, 'Jugendabend', 2),
      vorlageAus(2, 'Gottesdienst mit Abendmahl', 1),
      vorlageAus(1, 'Familiengottesdienst', 1),
    ];
    const liste = vorlagenListeAus(
      roh,
      [
        { id: 2, name: 'Jugend' },
        { id: 1, name: 'Gottesdienst' },
      ],
      'Europe/Berlin',
    );
    expect(liste.map((g) => g.kalender)).toEqual(['Gottesdienst', 'Jugend']);
    expect(liste[0].vorlagen.map((v) => v.name)).toEqual([
      'Familiengottesdienst',
      'Gottesdienst mit Abendmahl',
    ]);
  });

  it('nimmt Id, Name, Kalender und Punktzahl von vorlagenAus – kein zweiter Weg von roh zu Vorlage', () => {
    const roh = [vorlageAus(5, 'Gottesdienst', 1), { id: null } as unknown as CtAblaufVorlage];
    const basis = vorlagenAus(roh);
    const [g] = vorlagenListeAus(roh, [{ id: 1, name: 'G' }], 'Europe/Berlin');
    expect(g.vorlagen).toHaveLength(basis.length);
    expect(g.vorlagen[0]).toMatchObject(basis[0]);
  });

  it('zählt den Vorlauf mit derselben Regel wie beim Speichern einer Vorlage', () => {
    const v = vorlageAus(5, 'Gottesdienst', 1);
    // Der Erzeuger hat die Grenze aus dem Ablauf gezählt: zwei Punkte liefen vor dem Beginn.
    expect(v.eventStartPosition).toBe(2);
    const [g] = vorlagenListeAus([v], [{ id: 1, name: 'G' }], 'Europe/Berlin');
    expect(g.vorlagen[0]).toMatchObject({ punkte: 4, vorlauf: 2 });
    expect(g.vorlagen[0].vorlauf).toBe(vorlaufAnzahl(v));
  });

  it('der Vorlauf ist nie größer als die Punktzahl, auch bei einer zu großen Grenze', () => {
    const v = { ...vorlageAus(5, 'Alles davor', 1), eventStartPosition: 99 };
    const [g] = vorlagenListeAus([v], [{ id: 1, name: 'G' }], 'Europe/Berlin');
    expect(g.vorlagen[0].vorlauf).toBe(4);
  });

  it('der Tag der Änderung in der Ortszeit der Gemeinde (kurz nach Mitternacht gehört schon zum nächsten Tag)', () => {
    const v = vorlageAus(5, 'Gottesdienst', 1, '2026-11-11T23:30:00Z');
    const [g] = vorlagenListeAus([v], [{ id: 1, name: 'G' }], 'Europe/Berlin');
    expect(g.vorlagen[0].geaendert).toBe('2026-11-12');
  });

  it('ohne Stand kein Tag, ohne Kalender ein Band „Ohne Kalender“ ganz unten, unbekannter Kalender als Nummer', () => {
    const roh = [
      vorlageAus(1, 'Frei', null),
      vorlageAus(2, 'Fremd', 9),
      vorlageAus(3, 'Zuhause', 1),
    ];
    const liste = vorlagenListeAus(roh, [{ id: 1, name: 'Gottesdienst' }], 'Europe/Berlin');
    expect(liste.map((g) => g.kalender)).toEqual(['Gottesdienst', 'Kalender 9', OHNE_KALENDER]);
    expect(liste[2].kalenderId).toBeNull();
    expect(liste[0].vorlagen[0].geaendert).toBeNull();
  });

  it('der Stand bringt alle Kalender mit – auch einen ohne Vorlage (dort muss sich die erste anlegen lassen)', () => {
    const stand = vorlagenStandAus(
      [vorlageAus(1, 'Gottesdienst', 1)],
      [
        { id: 2, name: 'Jugend' },
        { id: 1, name: 'Gottesdienst' },
      ],
      'Europe/Berlin',
    );
    expect(stand.kalender.map((k) => k.name)).toEqual(['Gottesdienst', 'Jugend']);
    expect(stand.gruppen).toHaveLength(1);
  });

  it('der Stand bringt alle Kalender mit – auch einen ohne Vorlage (dort muss sich die erste anlegen lassen)', () => {
    const stand = vorlagenStandAus(
      [vorlageAus(1, 'Gottesdienst', 1)],
      [
        { id: 2, name: 'Jugend' },
        { id: 1, name: 'Gottesdienst' },
      ],
      'Europe/Berlin',
    );
    expect(stand.kalender.map((k) => k.name)).toEqual(['Gottesdienst', 'Jugend']);
    expect(stand.gruppen).toHaveLength(1);
  });

  it('keine Vorlagen oder Antwort ohne Liste: leer', () => {
    expect(vorlagenListeAus([], [], 'Europe/Berlin')).toEqual([]);
    expect(vorlagenListeAus(null, undefined, 'Europe/Berlin')).toEqual([]);
  });

  it('eine mit dem Kern angelegte, leere Vorlage steht mit 0 Punkten in der Liste', async () => {
    // Der Erzeuger: `vorlageAnlegen` schreibt und liest nach – ChurchTools als Attrappe.
    const gespeichert: CtAblaufVorlage[] = [];
    const s: CtSchreiber = {
      agenda: () => Promise.reject(new Error('nicht gebraucht')),
      song: () => Promise.reject(new Error('nicht gebraucht')),
      vorlage: (id) => {
        const v = gespeichert.find((x) => x.id === id);
        return v ? Promise.resolve(v) : Promise.reject(new Error('404'));
      },
      schreibe: (_pfad, auftrag) => {
        const j = auftrag.json as { name: string; calendarId: number };
        gespeichert.push({ id: 7, name: j.name, calendarId: j.calendarId, items: [] });
        return Promise.resolve({ data: { id: 7 } });
      },
      fehler: (status, meldung) => Object.assign(new Error(meldung), { status }),
    };
    const id = await vorlageAnlegen(s, { name: '  Gebetsabend ', kalenderId: 4 });
    const [g] = vorlagenListeAus(gespeichert, [{ id: 4, name: 'Gebet' }], 'Europe/Berlin');
    expect(g.vorlagen).toEqual([
      expect.objectContaining({
        id,
        name: 'Gebetsabend',
        punkte: 0,
        vorlauf: 0,
        geaendert: null,
      }),
    ]);
  });
});

describe('vorlageZeilenAus', () => {
  it('keine Uhrzeit und nichts weggelassen – auch wenn ChurchTools an einem Punkt ein `start` mitgibt', () => {
    const v = vorlageAus(5, 'Gottesdienst', 1);
    const mitStart = {
      ...v,
      items: v.items!.map((i) => ({
        ...i,
        start: '2026-11-01T09:00:00Z',
        startTimes: { '0': null },
      })),
    };
    const zeilen = vorlageZeilenAus(mitStart);
    expect(zeilen).toHaveLength(4);
    expect(zeilen.every((z) => z.time === null && z.weggelassen === false)).toBe(true);
    // Dauer und Vorlauf bleiben: Das sind die Dinge, die eine Vorlage hat.
    expect(zeilen.map((z) => z.durationMin)).toEqual([5, 5, 5, 5]);
    expect(zeilen.map((z) => z.vorBeginn)).toEqual([false, false, false, false]);
  });

  it('der Vorlauf kommt aus `isBeforeEvent` – wie ChurchTools ihn aus der Grenze ableitet', () => {
    const v: CtAblaufVorlage = {
      id: 1,
      items: [
        punkt(0, 'Aufbau', { isBeforeEvent: true }),
        punkt(1, 'Begrüßung', { isBeforeEvent: false }),
      ],
    };
    expect(vorlageZeilenAus(v).map((z) => z.vorBeginn)).toEqual([true, false]);
  });

  it('eine Vorlage ohne Punkte: keine Zeilen', () => {
    expect(vorlageZeilenAus({})).toEqual([]);
  });
});
