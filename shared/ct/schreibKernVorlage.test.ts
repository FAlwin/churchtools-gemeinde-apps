import { describe, expect, it } from 'vitest';
import {
  ABLAUF_ABGESCHLOSSEN,
  ABLAUF_VERWEIGERT,
  VORLAGE_GESPERRT,
  VORLAGE_VERWEIGERT,
  ablaufUmsortieren,
  merkzettelAus,
  punktAendern,
  punktAnlegen,
  punktLoeschen,
  punktWiederherstellen,
  vorBeginnSetzen,
  type AblaufZiel,
  type CtSchreiber,
  type SchreibAuftrag,
} from './schreibKern';
import type { CtAgenda, CtAgendaItem } from './typen';

/**
 * **Der Schreib-Kern mit Ablaufvorlagen als Ziel** (E10-V1). Eine Vorlage verhält sich wie der Ablauf eines Termins
 * (gemessen E10-0, 17.11.2026) – darum läuft jede Prüfung für beide Ziele durch dieselbe Attrappe: Gleiche Aufrufe,
 * nur der Pfad (`/events/…/agenda` bzw. `/agendatemplates/…`) und die Stelle zum Lesen (`agenda` bzw. `vorlage`)
 * unterscheiden sich. Damit prüft der Test die Behauptung „ein Kern, kein Nachbau“ statt einzelner Literale.
 */
class Fehler extends Error {
  constructor(
    public status: number,
    m: string,
  ) {
    super(m);
  }
}

const PUNKTE = (): CtAgendaItem[] => [
  { id: 10, title: 'Ankommen', type: 'text', position: 0, duration: 300 },
  { id: 11, title: 'Lobpreis', type: 'header', position: 1 },
  {
    id: 12,
    title: 'Begrüßung',
    type: 'text',
    position: 2,
    duration: 120,
    serviceGroupNotes: [{ serviceGroupId: 3, note: 'Mikro 1' }],
  },
  { id: 13, title: 'Predigt', type: 'text', position: 3 },
];

interface Aufruf {
  method: string;
  pfad: string;
  json?: Record<string, unknown>;
}

function attrappe(o: { gesperrt?: boolean; verweigern?: boolean; grenze?: number } = {}) {
  const items = PUNKTE();
  const gelesen = { agenda: 0, vorlage: 0 };
  const geschrieben: Aufruf[] = [];
  const s: CtSchreiber = {
    agenda: () => {
      gelesen.agenda++;
      return Promise.resolve<CtAgenda>({
        id: 1,
        items: structuredClone(items),
        eventStartPosition: o.grenze ?? 0,
        calendarId: 2,
        isLocked: o.gesperrt,
      });
    },
    vorlage: () => {
      gelesen.vorlage++;
      return Promise.resolve({
        id: 5,
        name: 'Sonntag',
        calendarId: 2,
        items: structuredClone(items),
        eventStartPosition: o.grenze ?? 0,
        isLocked: o.gesperrt,
      });
    },
    song: () => Promise.reject(new Error('nicht gebraucht')),
    schreibe: (pfad: string, a: SchreibAuftrag) => {
      geschrieben.push({ method: a.method, pfad, json: a.json as Record<string, unknown> });
      if (o.verweigern) return Promise.reject(new Error(a.verweigert));
      // Ein neuer Punkt steht danach hinten (wie in ChurchTools), mit der ID 99.
      if (a.method === 'POST' && pfad.endsWith('/items')) {
        const j = a.json as { title?: string; type?: string };
        items.push({ id: 99, title: j.title ?? '', type: j.type, position: items.length });
        return Promise.resolve({ data: { id: 99 } });
      }
      return Promise.resolve(null);
    },
    fehler: (status, meldung) => new Fehler(status, meldung),
  };
  return { s, items, gelesen, geschrieben };
}

/** Beide Ziele: Zahl = Termin 166, Objekt = Vorlage 5. */
const ZIELE: { name: string; ziel: AblaufZiel; basis: string; liest: 'agenda' | 'vorlage' }[] = [
  { name: 'Termin', ziel: 166, basis: '/events/166/agenda', liest: 'agenda' },
  { name: 'Vorlage', ziel: { vorlageId: 5 }, basis: '/agendatemplates/5', liest: 'vorlage' },
];
const ANDERE = { agenda: 'vorlage', vorlage: 'agenda' } as const;

describe.each(ZIELE)('Schreib-Kern, Ziel: $name', ({ ziel, basis, liest }) => {
  const nurDort = (g: { agenda: number; vorlage: number }) => {
    expect(g[liest], `gelesen über ${liest}`).toBeGreaterThan(0);
    expect(g[ANDERE[liest]], `nicht über ${ANDERE[liest]}`).toBe(0);
  };
  const verweigert = typeof ziel === 'number' ? ABLAUF_VERWEIGERT : VORLAGE_VERWEIGERT;

  it('ablaufUmsortieren: PUT auf den Basis-Pfad, frisch gelesen, Vorlage mit Name und Kalender', async () => {
    const t = attrappe();
    await ablaufUmsortieren(t.s, ziel, [11, 10, 12, 13]);
    nurDort(t.gelesen);
    expect(t.geschrieben).toHaveLength(1);
    const [w] = t.geschrieben;
    expect([w.method, w.pfad]).toEqual(['PUT', basis]);
    const liste = w.json!.items as { id: number; position: number; title: string }[];
    expect(liste.map((i) => [i.id, i.position])).toEqual([
      [11, 0],
      [10, 1],
      [12, 2],
      [13, 3],
    ]);
    if (typeof ziel === 'number') expect(w.json).not.toHaveProperty('name');
    else expect(w.json).toMatchObject({ name: 'Sonntag', calendarId: 2 });
  });

  it('ablaufUmsortieren: andere Punkte als im Ablauf → 409, nichts geschrieben', async () => {
    const t = attrappe();
    await expect(ablaufUmsortieren(t.s, ziel, [10, 11, 12])).rejects.toMatchObject({
      status: 409,
    });
    expect(t.geschrieben).toEqual([]);
  });

  it('punktAnlegen am Ende: ein POST auf …/items, ohne weiteres Lesen', async () => {
    const t = attrappe();
    await punktAnlegen(t.s, ziel, { type: 'text', title: 'Neu', durationMin: 5 });
    expect(t.geschrieben).toEqual([
      {
        method: 'POST',
        pfad: `${basis}/items`,
        json: { type: 'text', title: 'Neu', duration: 300 },
      },
    ]);
    expect(t.gelesen).toEqual({ agenda: 0, vorlage: 0 });
  });

  it('punktAnlegen an eine Stelle: nachgelesen, umsortiert (PUT auf den Basis-Pfad)', async () => {
    const t = attrappe();
    await punktAnlegen(t.s, ziel, { type: 'text', title: 'Neu', nachId: 10 });
    nurDort(t.gelesen);
    expect(t.geschrieben.map((w) => [w.method, w.pfad])).toEqual([
      ['POST', `${basis}/items`],
      ['PUT', basis],
    ]);
    const liste = t.geschrieben[1].json!.items as { id: number }[];
    expect(liste.map((i) => i.id)).toEqual([10, 99, 11, 12, 13]);
  });

  it('punktAnlegen vor Beginn: die Grenze wird mit Name/Kalender nachgezogen', async () => {
    const t = attrappe({ grenze: 1 });
    await punktAnlegen(t.s, ziel, { type: 'text', title: 'Neu', nachId: 10, vorBeginn: true });
    const grenze = t.geschrieben.at(-1)!;
    expect([grenze.method, grenze.pfad]).toEqual(['PUT', basis]);
    expect(grenze.json).toMatchObject({ calendarId: 2, eventStartPosition: 2 });
    expect(grenze.json).not.toHaveProperty('items');
    if (typeof ziel !== 'number') expect(grenze.json).toMatchObject({ name: 'Sonntag' });
  });

  it('punktAendern: PUT auf …/items/{id} mit dem vollen Punkt (Infos bleiben), Infos je Gruppe einzeln', async () => {
    const t = attrappe();
    await punktAendern(t.s, ziel, 12, { title: 'Begrüßung neu', infos: { 3: '', 4: 'Licht an' } });
    nurDort(t.gelesen);
    expect(t.geschrieben.map((w) => [w.method, w.pfad])).toEqual([
      ['PUT', `${basis}/items/12`],
      ['DELETE', `${basis}/items/12/servicegroups/3`],
      ['PUT', `${basis}/items/12/servicegroups/4`],
    ]);
    expect(t.geschrieben[0].json).toMatchObject({
      title: 'Begrüßung neu',
      duration: 120,
      serviceGroupNotes: [{ serviceGroupId: 3, note: 'Mikro 1' }],
    });
    expect(t.geschrieben[2].json).toEqual({ note: 'Licht an' });
  });

  it('punktAendern: Punkt fehlt → 404', async () => {
    const t = attrappe();
    await expect(punktAendern(t.s, ziel, 77, { title: 'x' })).rejects.toMatchObject({
      status: 404,
    });
  });

  it('punktLoeschen: DELETE auf …/items/{id}, Merkzettel mit Stelle', async () => {
    const t = attrappe();
    const m = await punktLoeschen(t.s, ziel, 12);
    nurDort(t.gelesen);
    expect(t.geschrieben).toEqual([
      { method: 'DELETE', pfad: `${basis}/items/12`, json: undefined },
    ]);
    expect(m).toMatchObject({
      nachId: 11,
      weggelassen: false,
      felder: { title: 'Begrüßung', duration: 120 },
    });
  });

  it('punktLoeschen im Vorlauf: die Grenze rückt mit (PUT auf den Basis-Pfad)', async () => {
    const t = attrappe({ grenze: 2 });
    await punktLoeschen(t.s, ziel, 10);
    const grenze = t.geschrieben.at(-1)!;
    expect([grenze.method, grenze.pfad]).toEqual(['PUT', basis]);
    expect(grenze.json).toMatchObject({ eventStartPosition: 1 });
    if (typeof ziel !== 'number') expect(grenze.json).toMatchObject({ name: 'Sonntag' });
  });

  it('punktWiederherstellen: POST, nachgelesen, an die alte Stelle geschoben', async () => {
    const t = attrappe();
    const m = (await punktLoeschen(t.s, ziel, 11))!;
    t.geschrieben.length = 0;
    t.gelesen.agenda = t.gelesen.vorlage = 0;
    const id = await punktWiederherstellen(t.s, ziel, m);
    expect(id).toBe(99);
    nurDort(t.gelesen);
    expect(t.geschrieben.map((w) => [w.method, w.pfad])).toEqual([
      ['POST', `${basis}/items`],
      ['PUT', basis],
    ]);
  });

  it('Lied ohne Arrangement: Umsortieren, Zurückholen und Anlegen schicken arrangementId: null (sonst 400)', async () => {
    const t = attrappe();
    t.items.push({ id: 14, title: 'Lied offen', type: 'song', position: 4 });
    await ablaufUmsortieren(t.s, ziel, [14, 10, 11, 12, 13]);
    const liste = t.geschrieben[0].json!.items as Record<string, unknown>[];
    expect(liste[0]).toMatchObject({ id: 14, type: 'song', arrangementId: null });

    const u = attrappe();
    u.items.push({ id: 14, title: 'Lied offen', type: 'song', position: 4 });
    const m = (await punktLoeschen(u.s, ziel, 14))!;
    u.geschrieben.length = 0;
    await punktWiederherstellen(u.s, ziel, m);
    expect(u.geschrieben[0].json).toMatchObject({ type: 'song', arrangementId: null });

    const v = attrappe();
    await punktAnlegen(v.s, ziel, { type: 'song', title: 'Lied' });
    expect(v.geschrieben[0].json).toMatchObject({ type: 'song', arrangementId: null });
  });

  it('vorBeginnSetzen: erst umsortieren, dann nur die Grenze', async () => {
    const t = attrappe({ grenze: 1 });
    await vorBeginnSetzen(t.s, ziel, 12, true);
    nurDort(t.gelesen);
    expect(t.geschrieben.map((w) => [w.method, w.pfad])).toEqual([
      ['PUT', basis],
      ['PUT', basis],
    ]);
    expect(t.geschrieben[1].json).toMatchObject({ eventStartPosition: 2 });
    expect(t.geschrieben[1].json).not.toHaveProperty('items');
  });

  it('verweigert ChurchTools das Schreiben und der Ablauf ist nicht gesperrt: die Meldung des Ziels', async () => {
    const t = attrappe({ verweigern: true });
    await expect(punktAendern(t.s, ziel, 12, { title: 'x' })).rejects.toThrow(verweigert);
  });

  it('ist der Ablauf gesperrt: 423 mit der Meldung des Ziels', async () => {
    const t = attrappe({ verweigern: true, gesperrt: true });
    await expect(punktAendern(t.s, ziel, 12, { title: 'x' })).rejects.toMatchObject({
      status: 423,
      message: typeof ziel === 'number' ? ABLAUF_ABGESCHLOSSEN : VORLAGE_GESPERRT,
    });
  });
});

describe('Nur für Vorlagen anders (gemessen E10-0)', () => {
  const VORLAGE: AblaufZiel = { vorlageId: 5 };

  it('„Weglassen“ (Auge) gibt es bei einer Vorlage nicht: 400, vor jedem Schreiben', async () => {
    const t = attrappe();
    await expect(
      punktAnlegen(t.s, VORLAGE, { type: 'text', title: 'x', weggelassen: true }),
    ).rejects.toMatchObject({ status: 400 });
    expect(t.geschrieben).toEqual([]);
  });

  it('beim Termin bleibt „weglassen“ wie bisher: angelegt, dann hide', async () => {
    const t = attrappe();
    await punktAnlegen(t.s, 166, { type: 'text', title: 'x', weggelassen: true });
    expect(t.geschrieben.map((w) => [w.method, w.pfad])).toEqual([
      ['POST', '/events/166/agenda/items'],
      ['POST', '/events/166/agenda/items/99/hide'],
    ]);
  });

  it('der Merkzettel einer Vorlage hat nie „weggelassen“ – beim Termin schon', () => {
    const agenda: CtAgenda = {
      items: [{ id: 1, title: 'A', type: 'text', startTimes: { '166': null } }],
    };
    expect(merkzettelAus(agenda, 166, 1)?.weggelassen).toBe(true);
    expect(merkzettelAus(agenda, { vorlageId: 5 }, 1)?.weggelassen).toBe(false);
  });

  it('Infos an einer Überschrift (anlegen): 400 statt still nichts zu speichern, nichts geschrieben', async () => {
    const t = attrappe();
    await expect(
      punktAnlegen(t.s, VORLAGE, { type: 'header', title: 'Lobpreis', infos: { 3: 'Hinweis' } }),
    ).rejects.toMatchObject({
      status: 400,
      message: 'Überschriften haben in Vorlagen keine Infos je Dienstgruppe.',
    });
    expect(t.geschrieben).toEqual([]);
  });

  it('Infos an einer Überschrift (ändern): 400 – leere Infos (löschen) und andere Punkte bleiben erlaubt', async () => {
    const t = attrappe();
    await expect(punktAendern(t.s, VORLAGE, 11, { infos: { 3: 'Hinweis' } })).rejects.toMatchObject(
      { status: 400 },
    );
    expect(t.geschrieben).toEqual([]);
    await punktAendern(t.s, VORLAGE, 11, { infos: { 3: '  ' } });
    expect(t.geschrieben.map((w) => [w.method, w.pfad])).toEqual([
      ['DELETE', '/agendatemplates/5/items/11/servicegroups/3'],
    ]);
    await punktAendern(t.s, VORLAGE, 12, { infos: { 3: 'Hinweis' } });
    expect(t.geschrieben.at(-1)).toMatchObject({
      method: 'PUT',
      pfad: '/agendatemplates/5/items/12/servicegroups/3',
    });
  });

  it('beim Termin-Ablauf bleiben Infos an Überschriften unverändert erlaubt (dort nicht gemessen)', async () => {
    const t = attrappe();
    await punktAnlegen(t.s, 166, { type: 'header', title: 'Lobpreis', infos: { 3: 'Hinweis' } });
    expect(t.geschrieben[0].json).toMatchObject({
      type: 'header',
      serviceGroupNotes: [{ serviceGroupId: 3, note: 'Hinweis' }],
    });
    await punktAendern(t.s, 166, 11, { infos: { 3: 'Hinweis' } });
    expect(t.geschrieben.at(-1)).toMatchObject({
      method: 'PUT',
      pfad: '/events/166/agenda/items/11/servicegroups/3',
    });
  });
});
