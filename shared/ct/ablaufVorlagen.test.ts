import { describe, expect, it } from 'vitest';
import { agendaItemWritePayload } from './agendaPayload';
import {
  VORLAGE_GEAENDERT,
  VORLAGE_NAME_MAX,
  ablaufAlsVorlage,
  vorlageAnlegen,
  vorlageErsetzen,
  vorlageLoeschen,
  vorlageNameFehler,
  vorlagePunkteAus,
  vorlageUmbenennen,
} from './ablaufVorlagen';
import { VORLAGE_GESPERRT, VORLAGE_VERWEIGERT, type CtSchreiber } from './schreibKern';
import type { CtAblaufVorlage, CtAgenda, CtAgendaItem } from './typen';

/**
 * **Vorgänge an der Vorlage als Ganzem** (E10-V1). Die Attrappe verhält sich, wie am 17.11.2026 gemessen (E10-0):
 * `POST` legt mit allen Punkten an und gibt `{ data: { id } }` zurück, `PUT` mit `items` ersetzt die ganze Liste, ohne
 * `items` bleiben die Punkte, `DELETE` löscht (204). Dazu die Störfälle: ChurchTools meldet Erfolg und schreibt nichts
 * (Lehre vom 11.08.2026), schreibt nur einen Teil, verweigert (403), die Vorlage ist gesperrt.
 */
class Fehler extends Error {
  constructor(
    public status: number,
    m: string,
  ) {
    super(m);
  }
}

interface Gespeichert {
  name: string;
  calendarId: number | null;
  items: CtAgendaItem[];
  eventStartPosition: number;
  modified: string;
  gesperrt: boolean;
}

interface Aufruf {
  method: string;
  pfad: string;
  json?: Record<string, unknown>;
}

/** Ein Punkt, wie ChurchTools ihn aus einem Schreib-Payload macht – und beim Lesen wieder herausgibt. */
function gelesenAus(j: Record<string, unknown>, id: number, position: number): CtAgendaItem {
  const arrangementId = typeof j.arrangementId === 'number' ? j.arrangementId : undefined;
  return {
    id,
    position,
    title: String(j.title),
    type: String(j.type),
    note: typeof j.note === 'string' ? j.note : '',
    duration: typeof j.duration === 'number' ? j.duration : 0,
    responsible: { text: typeof j.responsible === 'string' ? j.responsible : '' },
    serviceGroupNotes: (j.serviceGroupNotes as CtAgendaItem['serviceGroupNotes']) ?? [],
    ...(arrangementId
      ? {
          song: {
            songId: 1,
            arrangementId,
            title: String(j.title),
            arrangement: 'Standard',
            key: null,
            bpm: null,
          },
        }
      : {}),
  };
}

/** Der Ablauf eines Termins mit Vorlauf, Lied mit und ohne Arrangement, `normal`-Punkt, Überschrift mit Infos, Auge. */
const TERMIN: CtAgenda = {
  id: 70,
  calendarId: 2,
  eventStartPosition: 2,
  items: [
    {
      id: 1,
      position: 0,
      title: 'Ankommen',
      type: 'text',
      note: 'Musik läuft',
      duration: 300,
      isBeforeEvent: true,
      responsible: { text: '[Moderation]' },
      serviceGroupNotes: [{ serviceGroupId: 3, note: 'Mikro 1 an' }],
    },
    { id: 2, position: 1, title: 'Technik-Check', type: 'text', isBeforeEvent: true },
    {
      id: 3,
      position: 2,
      title: 'Lobpreis',
      type: 'header',
      duration: 60,
      isBeforeEvent: false,
      serviceGroupNotes: [{ serviceGroupId: 3, note: 'wird verworfen' }],
    },
    {
      id: 4,
      position: 3,
      title: 'Großer Gott',
      type: 'song',
      duration: 240,
      song: {
        songId: 9,
        arrangementId: 31,
        title: 'Großer Gott',
        arrangement: 'Standard',
        key: 'G',
        bpm: 80,
      },
    },
    { id: 5, position: 4, title: 'Ohne Arrangement', type: 'song' },
    { id: 6, position: 5, title: 'Begrüßung', type: 'normal', duration: 120 },
    {
      id: 7,
      position: 6,
      title: 'Predigt',
      type: 'text',
      startTimes: { '166': null },
    },
  ],
};

function attrappe(
  o: {
    /** ChurchTools meldet Erfolg, schreibt aber nichts. */
    wirkungslos?: boolean;
    /** Beim Anlegen/Ersetzen kommt nur ein Teil der Punkte an. */
    nurErste?: number;
    /** Die Antwort auf `POST` nennt keine ID. */
    ohneId?: boolean;
    /** Das Nachlesen der Vorlage scheitert (Aussetzer). */
    lesenScheitert?: boolean;
    /** Löschen scheitert. */
    loeschenScheitert?: boolean;
    verweigern?: boolean;
  } = {},
) {
  const vorlagen = new Map<number, Gespeichert>();
  const geschrieben: Aufruf[] = [];
  let naechsteId = 130;
  let uhr = 0;
  const stempel = () => `2026-11-17T10:00:${String(uhr++).padStart(2, '0')}Z`;
  const ablaufListe = (liste: unknown, abLaufId: number): CtAgendaItem[] => {
    const alle = (liste as Record<string, unknown>[]).map((j, k) => gelesenAus(j, abLaufId + k, k));
    return o.nurErste === undefined ? alle : alle.slice(0, o.nurErste);
  };

  const s: CtSchreiber = {
    agenda: () => Promise.resolve(structuredClone(TERMIN)),
    song: () => Promise.reject(new Error('nicht gebraucht')),
    vorlage: (id): Promise<CtAblaufVorlage> => {
      if (o.lesenScheitert) return Promise.reject(new Fehler(503, 'nicht erreichbar'));
      const v = vorlagen.get(id);
      if (!v) return Promise.reject(new Fehler(404, 'nicht gefunden'));
      return Promise.resolve({
        id,
        name: v.name,
        calendarId: v.calendarId,
        items: structuredClone(v.items),
        eventStartPosition: v.eventStartPosition,
        meta: { modifiedDate: v.modified },
        isLocked: v.gesperrt,
      });
    },
    schreibe: (pfad, a) => {
      const json = a.json as Record<string, unknown> | undefined;
      geschrieben.push({ method: a.method, pfad, json });
      if (o.verweigern) return Promise.reject(new Error(a.verweigert));
      if (a.method === 'POST' && pfad === '/agendatemplates') {
        const id = naechsteId++;
        if (!o.wirkungslos) {
          vorlagen.set(id, {
            name: String(json!.name),
            calendarId: json!.calendarId as number,
            items: ablaufListe(json!.items, id * 100),
            eventStartPosition: Number(json!.eventStartPosition),
            modified: stempel(),
            gesperrt: false,
          });
        }
        return Promise.resolve(o.ohneId ? { data: {} } : { data: { id } });
      }
      const m = /^\/agendatemplates\/(\d+)$/.exec(pfad);
      if (!m) return Promise.reject(new Fehler(500, `unbekannt: ${pfad}`));
      const id = Number(m[1]);
      const v = vorlagen.get(id);
      if (a.method === 'DELETE') {
        if (o.loeschenScheitert) return Promise.reject(new Fehler(500, a.fehler));
        if (!v && !a.okBei404) return Promise.reject(new Fehler(404, 'weg'));
        vorlagen.delete(id);
        return Promise.resolve(null);
      }
      if (!v) return Promise.reject(new Fehler(404, 'weg'));
      if (v.gesperrt) return Promise.reject(new Error(a.verweigert));
      if (o.wirkungslos) return Promise.resolve(null);
      v.name = String(json!.name);
      v.calendarId = (json!.calendarId as number | null) ?? v.calendarId;
      if (json!.items !== undefined) {
        v.items = ablaufListe(json!.items, id * 100 + 50);
        v.eventStartPosition = Number(json!.eventStartPosition ?? v.eventStartPosition);
      }
      v.modified = stempel();
      return Promise.resolve(null);
    },
    fehler: (status, meldung) => new Fehler(status, meldung),
  };

  /** Legt eine Vorlage direkt an (ohne Aufruf), z. B. die, die ersetzt werden soll. */
  const vorhanden = (id: number, teil: Partial<Gespeichert> = {}) =>
    vorlagen.set(id, {
      name: 'Sonntag',
      calendarId: 2,
      items: [gelesenAus({ title: 'Alt', type: 'text' }, id * 100, 0)],
      eventStartPosition: 0,
      modified: stempel(),
      gesperrt: false,
      ...teil,
    });
  return { s, vorlagen, geschrieben, vorhanden };
}

describe('vorlageNameFehler', () => {
  it('leer, nur Leerzeichen und zu lang werden abgelehnt – 100 Zeichen sind erlaubt', () => {
    expect(vorlageNameFehler('')).toMatch(/Namen/);
    expect(vorlageNameFehler('   ')).toMatch(/Namen/);
    expect(vorlageNameFehler('x'.repeat(VORLAGE_NAME_MAX + 1))).toMatch(/höchstens 100/);
    expect(vorlageNameFehler('x'.repeat(VORLAGE_NAME_MAX))).toBeNull();
    // Gezählt wird nach dem Trimmen – Leerzeichen am Rand machen ihn nicht zu lang.
    expect(vorlageNameFehler(` ${'x'.repeat(VORLAGE_NAME_MAX)} `)).toBeNull();
  });
});

describe('vorlagePunkteAus', () => {
  const { items, eventStartPosition } = vorlagePunkteAus(TERMIN);

  it('je Punkt der volle Schreib-Payload des Erzeugers – ohne id, position, isBeforeEvent', () => {
    for (const [k, it] of TERMIN.items.entries()) {
      const p = agendaItemWritePayload(it);
      // Gegen den Erzeuger: alles, was der Schreib-Payload für den Punkt sagt, steht auch hier (Überschriften kürzer).
      if (items[k].type !== 'header') {
        expect(items[k]).toMatchObject({
          title: p.title,
          note: p.note,
          duration: p.duration,
          responsible: p.responsible,
          serviceGroupNotes: p.serviceGroupNotes,
        });
      }
      expect(items[k]).not.toHaveProperty('id');
      expect(items[k]).not.toHaveProperty('position');
      expect(items[k]).not.toHaveProperty('isBeforeEvent');
    }
  });

  it('Textpunkt mit Zuständigkeit, Notiz und Info je Dienstgruppe', () => {
    expect(items[0]).toEqual({
      type: 'text',
      title: 'Ankommen',
      note: 'Musik läuft',
      duration: 300,
      responsible: '[Moderation]',
      serviceGroupNotes: [{ serviceGroupId: 3, note: 'Mikro 1 an' }],
    });
  });

  it('Überschrift: nur Typ, Titel, Dauer – keine Infos (ChurchTools verwürfe sie still)', () => {
    expect(items[2]).toEqual({ type: 'header', title: 'Lobpreis', duration: 60 });
  });

  it('Lied mit Arrangement: arrangementId als Zahl; ohne Arrangement: das Feld mit null (sonst 400)', () => {
    expect(items[3]).toMatchObject({ type: 'song', title: 'Großer Gott', arrangementId: 31 });
    expect(items[4]).toMatchObject({
      type: 'song',
      title: 'Ohne Arrangement',
      arrangementId: null,
    });
    expect(items[4]).toHaveProperty('arrangementId');
  });

  it('`normal` wird zum Textpunkt – das Anlegen kennt nur Überschrift, Lied, Text', () => {
    expect(items[5]).toMatchObject({ type: 'text', title: 'Begrüßung' });
    for (const i of items) expect(['header', 'song', 'text']).toContain(i.type);
  });

  it('ein weggelassener Punkt (Auge) kommt mit – das Auge gilt nur für einen Termin', () => {
    expect(items).toHaveLength(TERMIN.items.length);
    expect(items[6]).toMatchObject({ type: 'text', title: 'Predigt' });
  });

  it('die Grenze zählt die Vorlauf-Punkte (position unter eventStartPosition)', () => {
    expect(eventStartPosition).toBe(2);
  });

  it('die Grenze gilt nach Platznummer: Punkte ohne position zählen mit ihrem Listenplatz', () => {
    const ohnePosition: CtAgenda = {
      eventStartPosition: 1,
      items: [
        { id: 1, title: 'A', type: 'text' },
        { id: 2, title: 'B', type: 'text' },
      ],
    };
    expect(vorlagePunkteAus(ohnePosition).eventStartPosition).toBe(1);
  });

  it('eine Grenze größer als die Anzahl wird begrenzt, keine Grenze ist 0, ein leerer Ablauf 0', () => {
    expect(vorlagePunkteAus({ ...TERMIN, eventStartPosition: 99 }).eventStartPosition).toBe(7);
    expect(vorlagePunkteAus({ ...TERMIN, eventStartPosition: undefined }).eventStartPosition).toBe(
      0,
    );
    expect(vorlagePunkteAus({ items: [], eventStartPosition: 5 })).toEqual({
      items: [],
      eventStartPosition: 0,
    });
  });
});

describe('vorlageAnlegen', () => {
  it('ein POST mit getrimmtem Namen und Kalender, nachgelesen; liefert die ID', async () => {
    const t = attrappe();
    const id = await vorlageAnlegen(t.s, { name: '  Familiengottesdienst ', kalenderId: 2 });
    expect(t.geschrieben).toEqual([
      {
        method: 'POST',
        pfad: '/agendatemplates',
        json: {
          name: 'Familiengottesdienst',
          calendarId: 2,
          series: null,
          eventStartPosition: 0,
          items: [],
        },
      },
    ]);
    expect(t.vorlagen.get(id)?.name).toBe('Familiengottesdienst');
  });

  it('leerer Name → 400, nichts geschrieben', async () => {
    const t = attrappe();
    await expect(vorlageAnlegen(t.s, { name: '  ', kalenderId: 2 })).rejects.toMatchObject({
      status: 400,
    });
    expect(t.geschrieben).toEqual([]);
  });

  it('zu langer Name → 400, nichts geschrieben', async () => {
    const t = attrappe();
    await expect(
      vorlageAnlegen(t.s, { name: 'x'.repeat(VORLAGE_NAME_MAX + 1), kalenderId: 2 }),
    ).rejects.toMatchObject({ status: 400 });
    expect(t.geschrieben).toEqual([]);
  });

  it('ChurchTools meldet Erfolg, die Vorlage ist aber nicht zu lesen → 502 (Erfolg ist kein Beleg)', async () => {
    const t = attrappe({ wirkungslos: true });
    await expect(vorlageAnlegen(t.s, { name: 'Neu', kalenderId: 2 })).rejects.toMatchObject({
      status: 502,
    });
  });

  it('Antwort ohne ID → 502', async () => {
    const t = attrappe({ ohneId: true });
    await expect(vorlageAnlegen(t.s, { name: 'Neu', kalenderId: 2 })).rejects.toMatchObject({
      status: 502,
    });
  });

  it('ohne Recht: die Meldung der Vorlage', async () => {
    const t = attrappe({ verweigern: true });
    await expect(vorlageAnlegen(t.s, { name: 'Neu', kalenderId: 2 })).rejects.toThrow(
      VORLAGE_VERWEIGERT,
    );
  });
});

describe('vorlageUmbenennen', () => {
  it('PUT ohne items – mit Name und Kalender; die Punkte bleiben', async () => {
    const t = attrappe();
    t.vorhanden(5);
    await vorlageUmbenennen(t.s, 5, ' Neuer Name ');
    expect(t.geschrieben).toEqual([
      {
        method: 'PUT',
        pfad: '/agendatemplates/5',
        json: { name: 'Neuer Name', calendarId: 2 },
      },
    ]);
    expect(t.geschrieben[0].json).not.toHaveProperty('items');
    expect(t.vorlagen.get(5)?.name).toBe('Neuer Name');
    expect(t.vorlagen.get(5)?.items).toHaveLength(1);
  });

  it('ungültiger Name → 400, nichts gelesen oder geschrieben', async () => {
    const t = attrappe();
    t.vorhanden(5);
    await expect(vorlageUmbenennen(t.s, 5, '')).rejects.toMatchObject({ status: 400 });
    expect(t.geschrieben).toEqual([]);
  });

  it('gesperrte Vorlage → 423, nichts geschrieben', async () => {
    const t = attrappe();
    t.vorhanden(5, { gesperrt: true });
    await expect(vorlageUmbenennen(t.s, 5, 'Neu')).rejects.toMatchObject({
      status: 423,
      message: VORLAGE_GESPERRT,
    });
    expect(t.geschrieben).toEqual([]);
  });

  it('ohne Recht (403, nicht gesperrt): die Meldung der Vorlage', async () => {
    const t = attrappe({ verweigern: true });
    t.vorhanden(5);
    await expect(vorlageUmbenennen(t.s, 5, 'Neu')).rejects.toThrow(VORLAGE_VERWEIGERT);
  });

  it('Vorlage nicht lesbar: der Fehler des Lesens, nichts geschrieben', async () => {
    const t = attrappe();
    await expect(vorlageUmbenennen(t.s, 5, 'Neu')).rejects.toMatchObject({ status: 404 });
    expect(t.geschrieben).toEqual([]);
  });
});

describe('vorlageLoeschen', () => {
  it('DELETE, die Vorlage ist weg', async () => {
    const t = attrappe();
    t.vorhanden(5);
    await vorlageLoeschen(t.s, 5);
    expect(t.geschrieben.map((w) => [w.method, w.pfad])).toEqual([
      ['DELETE', '/agendatemplates/5'],
    ]);
    expect(t.vorlagen.has(5)).toBe(false);
  });

  it('schon weg ist kein Fehler', async () => {
    const t = attrappe();
    await expect(vorlageLoeschen(t.s, 5)).resolves.toBeUndefined();
  });

  it('ohne Recht: die Meldung der Vorlage', async () => {
    const t = attrappe({ verweigern: true });
    t.vorhanden(5);
    await expect(vorlageLoeschen(t.s, 5)).rejects.toThrow(VORLAGE_VERWEIGERT);
  });
});

describe('ablaufAlsVorlage', () => {
  it('ein POST mit allen Punkten und der Grenze – und die Vorlage hat danach dieselben Punkte', async () => {
    const t = attrappe();
    const id = await ablaufAlsVorlage(t.s, 166, { name: ' Aus dem Termin ', kalenderId: 2 });
    expect(t.geschrieben).toHaveLength(1);
    const { method, pfad, json } = t.geschrieben[0];
    expect([method, pfad]).toEqual(['POST', '/agendatemplates']);
    expect(json).toMatchObject({
      name: 'Aus dem Termin',
      calendarId: 2,
      series: null,
      eventStartPosition: 2,
    });
    // Gegen den Erzeuger, nicht gegen ein Literal.
    expect(json!.items).toEqual(vorlagePunkteAus(TERMIN).items);
    const gespeichert = t.vorlagen.get(id)!;
    expect(gespeichert.items.map((i) => i.title)).toEqual(TERMIN.items.map((i) => i.title));
  });

  it('die Vorlage steht in sich stimmig da: aus ihr gelesen ergibt sich dieselbe Punkteliste', async () => {
    const t = attrappe();
    const id = await ablaufAlsVorlage(t.s, 166, { name: 'Aus dem Termin', kalenderId: 2 });
    const v = t.vorlagen.get(id)!;
    expect(vorlagePunkteAus({ items: v.items, eventStartPosition: v.eventStartPosition })).toEqual(
      vorlagePunkteAus(TERMIN),
    );
  });

  it('ungültiger Name → 400, nichts geschrieben', async () => {
    const t = attrappe();
    await expect(ablaufAlsVorlage(t.s, 166, { name: '', kalenderId: 2 })).rejects.toMatchObject({
      status: 400,
    });
    expect(t.geschrieben).toEqual([]);
  });

  it('Punktzahl weicht ab → die eigene Vorlage wird gelöscht und es kommt 502', async () => {
    const t = attrappe({ nurErste: 3 });
    await expect(ablaufAlsVorlage(t.s, 166, { name: 'Halb', kalenderId: 2 })).rejects.toMatchObject(
      { status: 502, message: expect.stringContaining('entfernt') },
    );
    expect(t.geschrieben.map((w) => [w.method, w.pfad])).toEqual([
      ['POST', '/agendatemplates'],
      ['DELETE', '/agendatemplates/130'],
    ]);
    expect(t.vorlagen.size).toBe(0);
  });

  it('Punktzahl weicht ab und das Löschen scheitert → 502, die Meldung sagt, dass sie noch da ist', async () => {
    const t = attrappe({ nurErste: 3, loeschenScheitert: true });
    await expect(ablaufAlsVorlage(t.s, 166, { name: 'Halb', kalenderId: 2 })).rejects.toMatchObject(
      { status: 502, message: expect.stringContaining('löschen') },
    );
  });

  it('Vorlage nach dem POST nicht lesbar (Aussetzer) → 502, aber NICHTS gelöscht', async () => {
    const t = attrappe({ lesenScheitert: true });
    await expect(ablaufAlsVorlage(t.s, 166, { name: 'Neu', kalenderId: 2 })).rejects.toMatchObject({
      status: 502,
    });
    expect(t.geschrieben.map((w) => w.method)).toEqual(['POST']);
  });

  it('Antwort ohne ID → 502, nichts gelöscht (es gibt nichts Eigenes, das man benennen könnte)', async () => {
    const t = attrappe({ ohneId: true });
    await expect(ablaufAlsVorlage(t.s, 166, { name: 'Neu', kalenderId: 2 })).rejects.toMatchObject({
      status: 502,
    });
    expect(t.geschrieben.map((w) => w.method)).toEqual(['POST']);
  });

  it('ohne Recht: die Meldung der Vorlage', async () => {
    const t = attrappe({ verweigern: true });
    await expect(ablaufAlsVorlage(t.s, 166, { name: 'Neu', kalenderId: 2 })).rejects.toThrow(
      VORLAGE_VERWEIGERT,
    );
  });
});

describe('vorlageErsetzen', () => {
  it('ein PUT mit Name und Kalender der Vorlage, Grenze und ganzer Liste – danach nachgelesen', async () => {
    const t = attrappe();
    t.vorhanden(5);
    await vorlageErsetzen(t.s, 5, 166);
    expect(t.geschrieben).toHaveLength(1);
    const { method, pfad, json } = t.geschrieben[0];
    expect([method, pfad]).toEqual(['PUT', '/agendatemplates/5']);
    expect(json).toMatchObject({ name: 'Sonntag', calendarId: 2, eventStartPosition: 2 });
    expect(json!.items).toEqual(vorlagePunkteAus(TERMIN).items);
    expect(t.vorlagen.get(5)?.items.map((i) => i.title)).toEqual(TERMIN.items.map((i) => i.title));
  });

  it('`gesehen` stimmt mit dem frischen Stand überein → wird ersetzt', async () => {
    const t = attrappe();
    t.vorhanden(5, { modified: '2026-11-17T09:00:00Z' });
    await expect(vorlageErsetzen(t.s, 5, 166, '2026-11-17T09:00:00Z')).resolves.toBeUndefined();
  });

  it('`gesehen` weicht ab → 412, nichts geschrieben', async () => {
    const t = attrappe();
    t.vorhanden(5, { modified: '2026-11-17T09:05:00Z' });
    await expect(vorlageErsetzen(t.s, 5, 166, '2026-11-17T09:00:00Z')).rejects.toMatchObject({
      status: 412,
      message: VORLAGE_GEAENDERT,
    });
    expect(t.geschrieben).toEqual([]);
  });

  it('gesperrt → 423, nichts geschrieben', async () => {
    const t = attrappe();
    t.vorhanden(5, { gesperrt: true });
    await expect(vorlageErsetzen(t.s, 5, 166)).rejects.toMatchObject({
      status: 423,
      message: VORLAGE_GESPERRT,
    });
    expect(t.geschrieben).toEqual([]);
  });

  it('ohne Recht (403, nicht gesperrt): die Meldung der Vorlage', async () => {
    const t = attrappe({ verweigern: true });
    t.vorhanden(5);
    await expect(vorlageErsetzen(t.s, 5, 166)).rejects.toThrow(VORLAGE_VERWEIGERT);
  });

  it('ChurchTools meldet Erfolg und ersetzt nichts → 502, und die Vorlage wird NICHT gelöscht', async () => {
    const t = attrappe({ wirkungslos: true });
    t.vorhanden(5);
    await expect(vorlageErsetzen(t.s, 5, 166)).rejects.toMatchObject({ status: 502 });
    expect(t.geschrieben.map((w) => w.method)).toEqual(['PUT']);
    expect(t.vorlagen.has(5)).toBe(true);
  });

  it('nur ein Teil der Punkte angekommen → 502', async () => {
    const t = attrappe({ nurErste: 3 });
    t.vorhanden(5);
    await expect(vorlageErsetzen(t.s, 5, 166)).rejects.toMatchObject({
      status: 502,
      message: expect.stringContaining('nicht vollständig'),
    });
  });

  it('gleiche Punktzahl, aber andere Titelfolge → 502 (nicht nur gezählt)', async () => {
    const t = attrappe();
    t.vorhanden(5);
    const lesen = t.s.vorlage;
    let nachher = false;
    t.s.schreibe = ((alt) => (pfad, a) => {
      nachher = true;
      return alt(pfad, a);
    })(t.s.schreibe);
    t.s.vorlage = async (id) => {
      const v = await lesen(id);
      // Nach dem Schreiben kommt dieselbe Anzahl zurück, aber vertauscht.
      return nachher ? { ...v, items: [...(v.items ?? [])].reverse() } : v;
    };
    await expect(vorlageErsetzen(t.s, 5, 166)).rejects.toMatchObject({ status: 502 });
  });
});
