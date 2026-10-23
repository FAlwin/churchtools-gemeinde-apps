import { describe, it, expect, vi } from 'vitest';
import { ablaufZeileAus, punktStand } from '@shared/ct/ablaufZeile';
import {
  ablaufUmsortieren,
  punktAendern,
  punktLoeschen,
  punktWiederherstellen,
  weglassenSetzen,
  type CtSchreiber,
  type GeloeschterPunkt,
  type SchreibAuftrag,
} from '@shared/ct/schreibKern';
import type { CtAgendaItem } from '@shared/ct/typen';

/**
 * **„Rückgängig" nach dem Löschen** und die **Notizen je Dienstgruppe** (Alwin, 12.10.2026).
 *
 * Der Ablauf hier ist ein kleines ChurchTools im Speicher, das sich so verhält, wie an der Test-Instanz
 * gemessen (12.10.2026):
 *  - `POST …/agenda/items` hängt hinten an und antwortet mit `{ data: { id } }`,
 *  - `PUT …/agenda` sortiert nach der Liste und setzt die Beginn-Grenze,
 *  - `PUT …/agenda/items/{id}` **ersetzt** die Felder – ohne `serviceGroupNotes` sind sie danach leer.
 * Vorlauf (`isBeforeEvent`) leitet es wie ChurchTools aus `eventStartPosition` ab.
 */
function fakeCt(start: Partial<CtAgendaItem>[], eventStartPosition = 0) {
  let items: CtAgendaItem[] = start.map((i, k) => ({
    id: k + 1,
    title: `Punkt ${k + 1}`,
    type: 'text',
    note: '',
    duration: 0,
    responsible: { text: '' },
    serviceGroupNotes: [],
    ...i,
  }));
  let esp = eventStartPosition;
  let naechsteId = 100;
  /** An Termin 1 weggelassen (Auge) – wie gemessen: `startTimes['1']` ist dann `null`. */
  const weg = new Set<number>();
  /** Wenn gesetzt: Das Anlegen meldet Erfolg, legt aber nichts an. */
  let anlegenLuegt = false;
  let lesefehler = 0;

  const ordne = () => {
    items.forEach((it, k) => {
      it.position = k;
      it.isBeforeEvent = k < esp;
    });
  };
  ordne();

  const felderAus = (b: Record<string, unknown>): Partial<CtAgendaItem> => ({
    title: String(b.title ?? ''),
    type: String(b.type ?? 'text'),
    note: typeof b.note === 'string' ? b.note : '',
    duration: typeof b.duration === 'number' ? b.duration : 0,
    responsible: { text: typeof b.responsible === 'string' ? b.responsible : '' },
    serviceGroupNotes: (b.serviceGroupNotes as CtAgendaItem['serviceGroupNotes']) ?? [],
    ...(typeof b.arrangementId === 'number'
      ? { song: { songId: 1, arrangementId: b.arrangementId } as CtAgendaItem['song'] }
      : {}),
  });

  const schreibe = vi.fn((pfad: string, a: SchreibAuftrag): Promise<unknown> => {
    const body = (a.json ?? {}) as Record<string, unknown>;
    const einzel = /\/agenda\/items\/(\d+)$/.exec(pfad);
    const auge = /\/agenda\/items\/(\d+)\/(hide|unhide)$/.exec(pfad);
    if (a.method === 'POST' && auge) {
      const id = Number(auge[1]);
      if (auge[2] === 'hide') weg.add(id);
      else weg.delete(id);
      return Promise.resolve(null);
    }
    if (a.method === 'DELETE' && einzel) {
      items = items.filter((i) => i.id !== Number(einzel[1]));
      ordne();
      return Promise.resolve(null);
    }
    if (a.method === 'POST' && pfad.endsWith('/agenda/items')) {
      const id = naechsteId++;
      if (!anlegenLuegt) items.push({ id, ...felderAus(body) } as CtAgendaItem);
      ordne();
      return Promise.resolve({ data: { id } });
    }
    if (a.method === 'PUT' && einzel) {
      const it = items.find((i) => i.id === Number(einzel[1]))!;
      // Wie ChurchTools: ersetzt – was fehlt, ist danach leer.
      Object.assign(it, felderAus(body));
      if (!('arrangementId' in body)) delete it.song;
      return Promise.resolve({ data: it });
    }
    if (a.method === 'PUT' && pfad.endsWith('/agenda')) {
      const liste = body.items as { id: number }[] | undefined;
      if (liste) items = liste.map((x) => items.find((i) => i.id === x.id)!);
      if (typeof body.eventStartPosition === 'number') esp = body.eventStartPosition;
      ordne();
      return Promise.resolve(null);
    }
    return Promise.reject(new Error(`unerwartet: ${a.method} ${pfad}`));
  });

  const s: CtSchreiber = {
    agenda: () => {
      if (lesefehler > 0) {
        lesefehler--;
        return Promise.reject(new Error('Netz weg'));
      }
      return Promise.resolve({
        calendarId: 1,
        eventStartPosition: esp,
        items: structuredClone(items).map((i) => ({
          ...i,
          startTimes: { '1': weg.has(i.id) ? null : '2026-10-25T09:00:00Z' },
        })),
      });
    },
    song: () => Promise.reject(new Error('nicht gebraucht')),
    vorlage: () => Promise.reject(new Error('nicht gebraucht')),
    schreibe,
    fehler: (status, meldung) => Object.assign(new Error(meldung), { status }),
  };
  return {
    s,
    schreibe,
    ids: () => items.map((i) => i.id),
    item: (id: number) => items.find((i) => i.id === id),
    titelVorlauf: () => items.map((i) => `${i.title}${i.isBeforeEvent ? '*' : ''}`),
    anlegenLuegt: () => (anlegenLuegt = true),
    lesefehler: (n: number) => (lesefehler = n),
    weggelassen: () => items.filter((i) => weg.has(i.id)).map((i) => i.title),
  };
}

const SG = [{ serviceGroupId: 3, note: 'Für die Technik: Mikro 2' }];

describe('Löschen merkt sich, was „Rückgängig" braucht', () => {
  it('alle Felder in ChurchTools-Einheiten – Dauer in Sekunden, nicht gerundet', async () => {
    const ct = fakeCt([
      { title: 'Begrüßung' },
      {
        title: 'Lied',
        type: 'song',
        duration: 330,
        note: 'leise',
        responsible: { text: '[Musik]' },
        serviceGroupNotes: SG,
        song: { songId: 7, arrangementId: 70 } as CtAgendaItem['song'],
      },
    ]);
    const g = await punktLoeschen(ct.s, 1, 2);
    expect(g).toEqual({
      felder: {
        type: 'song',
        title: 'Lied',
        note: 'leise',
        duration: 330,
        responsible: '[Musik]',
        serviceGroupNotes: SG,
        arrangementId: 70,
      },
      nachId: 1,
      vorBeginn: false,
      weggelassen: false,
    });
    expect(ct.ids()).toEqual([1]);
  });

  it('eine Art, die ChurchTools beim Anlegen nicht kennt, wird ein Textpunkt (sonst scheitert das Zurückholen)', async () => {
    const ct = fakeCt([{ title: 'Alt', type: 'normal' }]);
    expect((await punktLoeschen(ct.s, 1, 1))?.felder.type).toBe('text');
  });

  it('war der Punkt schon weg, gibt es nichts zurückzuholen', async () => {
    const ct = fakeCt([{ title: 'A' }]);
    await expect(punktLoeschen(ct.s, 1, 99)).resolves.toBeNull();
  });

  it('lässt sich der Ablauf vorher nicht lesen, wird trotzdem gelöscht – nur ohne Rückgängig', async () => {
    const ct = fakeCt([{ title: 'A' }, { title: 'B' }]);
    ct.lesefehler(1);
    await expect(punktLoeschen(ct.s, 1, 2)).resolves.toBeNull();
    expect(ct.ids()).toEqual([1]);
  });
});

describe('Wiederherstellen', () => {
  it('kommt an dieselbe Stelle zurück, mit allen Feldern', async () => {
    const ct = fakeCt([
      { title: 'A' },
      { title: 'B', note: 'n', duration: 300, serviceGroupNotes: SG },
      { title: 'C' },
    ]);
    const g = (await punktLoeschen(ct.s, 1, 2))!;
    await punktWiederherstellen(ct.s, 1, g);
    expect(ct.titelVorlauf()).toEqual(['A', 'B', 'C']);
    const neu = ct.item(ct.ids()[1])!;
    expect(neu).toMatchObject({ note: 'n', duration: 300, serviceGroupNotes: SG });
  });

  it('stand er ganz vorne, kommt er ganz nach vorne', async () => {
    const ct = fakeCt([{ title: 'A' }, { title: 'B' }]);
    await punktWiederherstellen(ct.s, 1, (await punktLoeschen(ct.s, 1, 1))!);
    expect(ct.titelVorlauf()).toEqual(['A', 'B']);
  });

  it('ist der Vorgänger inzwischen auch weg, landet er am Ende', async () => {
    const ct = fakeCt([{ title: 'A' }, { title: 'B' }, { title: 'C' }]);
    const g = (await punktLoeschen(ct.s, 1, 2))!;
    await punktLoeschen(ct.s, 1, 1);
    await punktWiederherstellen(ct.s, 1, g);
    expect(ct.titelVorlauf()).toEqual(['C', 'B']);
  });

  it('löscht man einen Vorlauf-Punkt, rückt die Grenze mit – sonst rutschte der Gottesdienst in den Vorlauf', async () => {
    // Gemessen 12.10.2026: ChurchTools lässt `eventStartPosition` beim Löschen stehen (wie dieser Nachbau).
    const ct = fakeCt([{ title: 'A' }, { title: 'B' }, { title: 'C' }, { title: 'D' }], 2);
    await punktLoeschen(ct.s, 1, 2);
    expect(ct.titelVorlauf()).toEqual(['A*', 'C', 'D']);
    // Ein Gottesdienst-Punkt lässt die Grenze in Ruhe.
    await punktLoeschen(ct.s, 1, 4);
    expect(ct.titelVorlauf()).toEqual(['A*', 'C']);
  });

  it('ein Vorlauf-Punkt wird wieder Vorlauf, ein Gottesdienst-Punkt nicht', async () => {
    // A, B laufen vor dem Beginn (Grenze 2).
    const ct = fakeCt([{ title: 'A' }, { title: 'B' }, { title: 'C' }, { title: 'D' }], 2);
    expect(ct.titelVorlauf()).toEqual(['A*', 'B*', 'C', 'D']);
    await punktWiederherstellen(ct.s, 1, (await punktLoeschen(ct.s, 1, 2))!);
    expect(ct.titelVorlauf()).toEqual(['A*', 'B*', 'C', 'D']);
    await punktWiederherstellen(ct.s, 1, (await punktLoeschen(ct.s, 1, 3))!);
    expect(ct.titelVorlauf()).toEqual(['A*', 'B*', 'C', 'D']);
  });

  it('der erste oder mittlere Vorlauf-Punkt zurück: die übrigen bleiben im Vorlauf (#700)', async () => {
    // Die Grenze ist eine Platznummer (gemessen E6-6-0): Wer vor ihr einfügt, schob die anderen hinaus.
    const ct = fakeCt([{ title: 'A' }, { title: 'B' }, { title: 'C' }, { title: 'D' }], 2);
    await punktWiederherstellen(ct.s, 1, (await punktLoeschen(ct.s, 1, 1))!);
    expect(ct.titelVorlauf()).toEqual(['A*', 'B*', 'C', 'D']);

    const drei = fakeCt([{ title: 'A' }, { title: 'B' }, { title: 'C' }, { title: 'D' }], 3);
    await punktWiederherstellen(drei.s, 1, (await punktLoeschen(drei.s, 1, 2))!);
    expect(drei.titelVorlauf()).toEqual(['A*', 'B*', 'C*', 'D']);
  });

  it('eine Überschrift wird nur mit Art und Titel angelegt (ChurchTools kennt dort nichts weiter)', async () => {
    const ct = fakeCt([{ title: 'Lobpreis', type: 'header' }]);
    await punktWiederherstellen(ct.s, 1, (await punktLoeschen(ct.s, 1, 1))!);
    const post = ct.schreibe.mock.calls.find(([, a]) => a.method === 'POST')!;
    expect(post[1].json).toEqual({ type: 'header', title: 'Lobpreis' });
  });

  it('meldet ChurchTools Erfolg, ohne dass der Punkt da ist, ist das ein Fehler (Lehre 11.08.2026)', async () => {
    const ct = fakeCt([{ title: 'A' }, { title: 'B' }]);
    const g = (await punktLoeschen(ct.s, 1, 2))!;
    ct.anlegenLuegt();
    await expect(punktWiederherstellen(ct.s, 1, g)).rejects.toMatchObject({ status: 502 });
  });

  it('steht er schon richtig, wird nicht umsortiert', async () => {
    const ct = fakeCt([{ title: 'A' }, { title: 'B' }]);
    const g = (await punktLoeschen(ct.s, 1, 2))!;
    ct.schreibe.mockClear();
    await punktWiederherstellen(ct.s, 1, g);
    const umsortiert = ct.schreibe.mock.calls.filter(
      ([p, a]) => a.method === 'PUT' && p.endsWith('/agenda') && 'items' in (a.json as object),
    );
    expect(umsortiert).toHaveLength(0);
  });
});

describe('Notizen je Dienstgruppe (gemessen 12.10.2026)', () => {
  it('Bearbeiten eines Punkts lässt sie stehen – ChurchTools hätte sie ohne das Feld geleert', async () => {
    const ct = fakeCt([{ title: 'Predigt', serviceGroupNotes: SG }]);
    await punktAendern(ct.s, 1, 1, { title: 'Predigt (lang)' });
    expect(ct.item(1)).toMatchObject({ title: 'Predigt (lang)', serviceGroupNotes: SG });
  });

  it('auch Umsortieren schickt sie mit', async () => {
    const ct = fakeCt([{ title: 'A', serviceGroupNotes: SG }, { title: 'B' }]);
    const g = (await punktLoeschen(ct.s, 1, 2))!;
    await punktWiederherstellen(ct.s, 1, { ...g, nachId: null } satisfies GeloeschterPunkt);
    const sortiert = ct.schreibe.mock.calls.find(
      ([p, a]) => a.method === 'PUT' && p.endsWith('/agenda') && 'items' in (a.json as object),
    )!;
    const liste = (sortiert[1].json as { items: { id: number; serviceGroupNotes: unknown }[] })
      .items;
    expect(liste.find((i) => i.id === 1)?.serviceGroupNotes).toEqual(SG);
  });
});

describe('Auge – an diesem Termin weglassen (E6-3b, #652)', () => {
  it('schreibt hide bzw. unhide an diesem Termin', async () => {
    const ct = fakeCt([{ title: 'A' }, { title: 'B' }]);
    await weglassenSetzen(ct.s, 1, 2, true);
    expect(ct.weggelassen()).toEqual(['B']);
    expect(ct.schreibe).toHaveBeenLastCalledWith(
      '/events/1/agenda/items/2/hide',
      expect.objectContaining({ method: 'POST' }),
    );
    await weglassenSetzen(ct.s, 1, 2, false);
    expect(ct.weggelassen()).toEqual([]);
    expect(ct.schreibe).toHaveBeenLastCalledWith(
      '/events/1/agenda/items/2/unhide',
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('steht schon so → kein Schreibvorgang', async () => {
    const ct = fakeCt([{ title: 'A' }]);
    await weglassenSetzen(ct.s, 1, 1, false);
    expect(ct.schreibe).not.toHaveBeenCalled();
  });

  it('Punkt inzwischen weg → 404, nichts geschrieben', async () => {
    const ct = fakeCt([{ title: 'A' }]);
    await expect(weglassenSetzen(ct.s, 1, 99, true)).rejects.toMatchObject({ status: 404 });
    expect(ct.schreibe).not.toHaveBeenCalled();
  });

  it('„Rückgängig“ nach dem Löschen holt das Weglassen mit zurück (vorher ging es verloren)', async () => {
    const ct = fakeCt([{ title: 'A' }, { title: 'B' }, { title: 'C' }]);
    await weglassenSetzen(ct.s, 1, 2, true);
    const zettel = (await punktLoeschen(ct.s, 1, 2))!;
    expect(zettel.weggelassen).toBe(true);
    await punktWiederherstellen(ct.s, 1, zettel);
    expect(ct.weggelassen()).toEqual(['B']);
    expect(ct.titelVorlauf()).toEqual(['A', 'B', 'C']);
  });

  it('ein gezeigter Punkt kommt gezeigt zurück – kein hide', async () => {
    const ct = fakeCt([{ title: 'A' }, { title: 'B' }]);
    const zettel = (await punktLoeschen(ct.s, 1, 2))!;
    expect(zettel.weggelassen).toBe(false);
    await punktWiederherstellen(ct.s, 1, zettel);
    expect(ct.weggelassen()).toEqual([]);
    expect(ct.schreibe.mock.calls.some(([p]) => p.endsWith('/hide'))).toBe(false);
  });
});

describe('Nicht still überschreiben (E6-3c, #659)', () => {
  /** Was das Fenster gesehen hätte – über denselben Weg wie die Oberfläche. */
  const gesehen = (it: CtAgendaItem) => punktStand(ablaufZeileAus(it, 1, 'Europe/Berlin'));

  it('nichts geändert → schreibt', async () => {
    const ct = fakeCt([{ title: 'A' }, { title: 'B', note: 'n' }]);
    await punktAendern(ct.s, 1, 2, { title: 'B2' }, gesehen(ct.item(2)!));
    expect(ct.item(2)?.title).toBe('B2');
  });

  it('dasselbe Feld woanders geändert → 412, nichts geschrieben', async () => {
    const ct = fakeCt([{ title: 'A' }, { title: 'B' }]);
    const alt = gesehen(ct.item(2)!);
    ct.item(2)!.title = 'B von außen';
    await expect(punktAendern(ct.s, 1, 2, { title: 'B2' }, alt)).rejects.toMatchObject({
      status: 412,
    });
    expect(ct.schreibe).not.toHaveBeenCalled();
    expect(ct.item(2)?.title).toBe('B von außen');
  });

  it('ein ANDERES Feld woanders geändert → schreibt, die fremde Änderung bleibt', async () => {
    const ct = fakeCt([{ title: 'A' }, { title: 'B' }]);
    const alt = gesehen(ct.item(2)!);
    ct.item(2)!.note = 'von außen';
    await punktAendern(ct.s, 1, 2, { title: 'B2' }, alt);
    expect(ct.item(2)).toMatchObject({ title: 'B2', note: 'von außen' });
  });

  it('jedes geschriebene Feld wird verglichen: Zuständig, Dauer, Notiz, Lied', async () => {
    const faelle: [Partial<CtAgendaItem>, Parameters<typeof punktAendern>[3]][] = [
      [{ responsible: { text: '[Ton]' } }, { responsible: '[Licht]' }],
      [{ duration: 600 }, { durationMin: 7 }],
      [{ note: 'außen' }, { note: 'meins' }],
      [{ song: { songId: 1, arrangementId: 9 } as CtAgendaItem['song'] }, { arrangementId: 5 }],
      [{ song: { songId: 1, arrangementId: 9 } as CtAgendaItem['song'] }, { unlink: true }],
    ];
    for (const [aussen, aenderung] of faelle) {
      const ct = fakeCt([{ title: 'A', duration: 300 }]);
      const alt = gesehen(ct.item(1)!);
      Object.assign(ct.item(1)!, aussen);
      await expect(punktAendern(ct.s, 1, 1, aenderung, alt)).rejects.toMatchObject({ status: 412 });
    }
  });

  it('Lied: gleicher Name, anderes Arrangement ist ein anderes Lied → 412', async () => {
    const lied = (arrangementId: number) =>
      ({ songId: 1, arrangementId, title: 'Treu' }) as CtAgendaItem['song'];
    const ct = fakeCt([{ title: 'Lied', type: 'song', song: lied(9) }]);
    const alt = gesehen(ct.item(1)!);
    ct.item(1)!.song = lied(10);
    await expect(punktAendern(ct.s, 1, 1, { arrangementId: 11 }, alt)).rejects.toMatchObject({
      status: 412,
    });
  });

  it('die Dauer wird wie in der Zeile gerundet verglichen – 270 s sind „5 Min“, kein Konflikt mit sich selbst', async () => {
    const ct = fakeCt([{ title: 'A', duration: 270 }]);
    await punktAendern(ct.s, 1, 1, { durationMin: 6 }, gesehen(ct.item(1)!));
    expect(ct.item(1)?.duration).toBe(360);
  });

  it('„Trotzdem speichern“ (ohne gesehen) schreibt auch bei Konflikt', async () => {
    const ct = fakeCt([{ title: 'A' }]);
    ct.item(1)!.title = 'von außen';
    await punktAendern(ct.s, 1, 1, { title: 'meins' });
    expect(ct.item(1)?.title).toBe('meins');
  });

  it('Reihenfolge: gleich wie gesehen → schreibt; woanders umsortiert → 412; ohne gesehen → schreibt', async () => {
    const ct = fakeCt([{ title: 'A' }, { title: 'B' }, { title: 'C' }]);
    await ablaufUmsortieren(ct.s, 1, [2, 1, 3], [1, 2, 3]);
    expect(ct.ids()).toEqual([2, 1, 3]);
    await expect(ablaufUmsortieren(ct.s, 1, [3, 2, 1], [1, 2, 3])).rejects.toMatchObject({
      status: 412,
    });
    expect(ct.ids()).toEqual([2, 1, 3]);
    await ablaufUmsortieren(ct.s, 1, [3, 2, 1]);
    expect(ct.ids()).toEqual([3, 2, 1]);
  });
});
