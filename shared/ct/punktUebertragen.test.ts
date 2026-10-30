import { describe, expect, it } from 'vitest';
import {
  ABLAUF_GETEILT,
  PUNKT_FEHLT,
  kopieBleibt,
  nichtGeloescht,
  punktUebertragen,
  teilenAblauf,
  uebertragenZuruecknehmen,
} from './punktUebertragen';
import { ABLAUF_ABGESCHLOSSEN, type CtSchreiber, type SchreibAuftrag } from './schreibKern';
import type { CtAgenda, CtAgendaItem } from './typen';

/**
 * Punkt zwischen Terminen verschieben/kopieren (E6-6b). Die Attrappe verhält sich wie an der Test-Instanz gemessen
 * (12.10. und E6-6-0, 23.10.2026): `POST …/agenda/items` hängt hinten an und antwortet `{ data: { id } }`, `PUT …/agenda`
 * sortiert und setzt die Beginn-Grenze (eine Platznummer), das Auge gilt je Termin, abgeschlossen → 403. Zwei Termine
 * können sich **einen** Ablauf teilen (dann tragen die Punkte beide `startTimes`-Schlüssel).
 */
interface Ablauf {
  id: number;
  items: CtAgendaItem[];
  esp: number;
  gesperrt: boolean;
  /** Je Termin weggelassene Punkte. */
  weg: Map<number, Set<number>>;
}

class Fehler extends Error {
  constructor(
    public status: number,
    m: string,
  ) {
    super(m);
  }
}

class FakeCt {
  ablaeufe = new Map<number, Ablauf>();
  /** Termin → Ablauf. */
  zuordnung = new Map<number, Ablauf>();
  geschrieben: string[] = [];
  anlegenLuegt = false;
  /** Löschen in diesem Termin scheitert (500). */
  loeschenScheitertIn: number | null = null;
  /** Anlegen in diesem Termin scheitert (500). */
  anlegenScheitertIn: number | null = null;
  private naechsteId = 500;

  ablauf(termin: number, titel: string[], esp = 0, gesperrt = false): Ablauf {
    const a: Ablauf = {
      id: 70 + this.ablaeufe.size,
      items: titel.map((t) => ({
        id: this.naechsteId++,
        title: t,
        type: 'text',
        note: '',
        duration: 300,
        responsible: { text: '' },
        serviceGroupNotes: [],
      })),
      esp,
      gesperrt,
      weg: new Map(),
    };
    this.ablaeufe.set(a.id, a);
    this.zuordnung.set(termin, a);
    return a;
  }

  teilen(ziel: number, quelle: number): void {
    this.zuordnung.set(ziel, this.zuordnung.get(quelle)!);
  }

  /** Titel mit `*` für Vorlauf und `(weg)` für weggelassen. */
  titel(termin: number): string[] {
    const a = this.zuordnung.get(termin)!;
    return a.items.map(
      (i, k) => `${i.title}${k < a.esp ? '*' : ''}${a.weg.get(termin)?.has(i.id) ? ' (weg)' : ''}`,
    );
  }

  item(termin: number, titel: string): CtAgendaItem | undefined {
    return this.zuordnung.get(termin)!.items.find((i) => i.title === titel);
  }

  private lesen(termin: number): CtAgenda {
    const a = this.zuordnung.get(termin);
    if (!a) throw new Fehler(404, 'kein Ablauf');
    const verbunden = [...this.zuordnung].filter(([, x]) => x === a).map(([t]) => t);
    return {
      id: a.id,
      isLocked: a.gesperrt,
      calendarId: 2,
      eventStartPosition: a.esp,
      items: structuredClone(a.items).map((i, k) => ({
        ...i,
        position: k,
        isBeforeEvent: k < a.esp,
        startTimes: Object.fromEntries(
          verbunden.map((t) => [
            String(t),
            a.weg.get(t)?.has(i.id) ? null : '2027-01-10T09:00:00Z',
          ]),
        ),
      })),
    };
  }

  schreiber(): CtSchreiber {
    return {
      agenda: (t) => new Promise<CtAgenda>((ok) => ok(this.lesen(t))),
      song: () => Promise.reject(new Error('nicht gebraucht')),
      vorlage: () => Promise.reject(new Error('nicht gebraucht')),
      schreibe: (pfad: string, auftrag: SchreibAuftrag) => {
        this.geschrieben.push(`${auftrag.method} ${pfad}`);
        const termin = Number(/^\/events\/(\d+)\//.exec(pfad)![1]);
        const a = this.zuordnung.get(termin)!;
        if (a.gesperrt) return Promise.reject(new Fehler(403, auftrag.verweigert));
        const body = (auftrag.json ?? {}) as Record<string, unknown>;
        const einzel = /\/agenda\/items\/(\d+)$/.exec(pfad);
        const auge = /\/agenda\/items\/(\d+)\/(hide|unhide)$/.exec(pfad);
        if (auge) {
          const w = a.weg.get(termin) ?? new Set<number>();
          if (auge[2] === 'hide') w.add(Number(auge[1]));
          else w.delete(Number(auge[1]));
          a.weg.set(termin, w);
          return Promise.resolve(null);
        }
        if (auftrag.method === 'DELETE' && einzel) {
          if (this.loeschenScheitertIn === termin) return Promise.reject(new Fehler(500, 'kaputt'));
          a.items = a.items.filter((i) => i.id !== Number(einzel[1]));
          return Promise.resolve(null);
        }
        if (auftrag.method === 'POST' && pfad.endsWith('/agenda/items')) {
          if (this.anlegenScheitertIn === termin) return Promise.reject(new Fehler(500, 'kaputt'));
          const id = this.naechsteId++;
          if (!this.anlegenLuegt) {
            a.items.push({
              id,
              title: String(body.title),
              type: String(body.type),
              note: typeof body.note === 'string' ? body.note : '',
              duration: typeof body.duration === 'number' ? body.duration : 0,
              responsible: { text: typeof body.responsible === 'string' ? body.responsible : '' },
              serviceGroupNotes:
                (body.serviceGroupNotes as CtAgendaItem['serviceGroupNotes']) ?? [],
              ...(typeof body.arrangementId === 'number'
                ? { song: { songId: 1, arrangementId: body.arrangementId } as CtAgendaItem['song'] }
                : {}),
            });
          }
          return Promise.resolve({ data: { id } });
        }
        if (auftrag.method === 'PUT' && pfad.endsWith('/agenda')) {
          const liste = body.items as { id: number }[] | undefined;
          if (liste) a.items = liste.map((x) => a.items.find((i) => i.id === x.id)!);
          if (typeof body.eventStartPosition === 'number') a.esp = body.eventStartPosition;
          return Promise.resolve(null);
        }
        return Promise.reject(new Error(`unerwartet: ${auftrag.method} ${pfad}`));
      },
      fehler: (status, meldung) => new Fehler(status, meldung),
    };
  }
}

const QUELLE = 186;
const ZIEL = 189;

/** Quelle: Ankommen (Vorlauf), Begrüßung, Lied, Predigt. Ziel: Gebet (Vorlauf), Way Maker, Segen. */
function zweiTermine() {
  const ct = new FakeCt();
  const q = ct.ablauf(QUELLE, ['Ankommen', 'Begrüßung', 'Lied', 'Predigt'], 1);
  ct.ablauf(ZIEL, ['Gebet', 'Way Maker', 'Segen'], 1);
  const lied = q.items[2];
  Object.assign(lied, {
    type: 'song',
    note: 'leise',
    duration: 420,
    responsible: { text: '[Leitung]' },
    serviceGroupNotes: [{ serviceGroupId: 3, note: 'Mikro 2' }],
    song: { songId: 1, arrangementId: 11 },
  });
  const id = (termin: number, titel: string) => ct.item(termin, titel)!.id;
  return { ct, s: ct.schreiber(), id };
}

describe('Punkt in einen anderen Termin verschieben (E6-6b)', () => {
  it('landet hinter dem gewählten Punkt, mit allen Feldern – und ist im alten Termin weg', async () => {
    const { ct, s, id } = zweiTermine();
    await punktUebertragen(s, 'verschieben', QUELLE, id(QUELLE, 'Lied'), ZIEL, {
      nachId: id(ZIEL, 'Way Maker'),
      vorBeginn: false,
    });
    expect(ct.titel(ZIEL)).toEqual(['Gebet*', 'Way Maker', 'Lied', 'Segen']);
    expect(ct.titel(QUELLE)).toEqual(['Ankommen*', 'Begrüßung', 'Predigt']);
    expect(ct.item(ZIEL, 'Lied')).toMatchObject({
      type: 'song',
      note: 'leise',
      duration: 420,
      responsible: { text: '[Leitung]' },
      serviceGroupNotes: [{ serviceGroupId: 3, note: 'Mikro 2' }],
      song: { arrangementId: 11 },
    });
  });

  it('erst im Ziel anlegen, dann im alten Termin löschen', async () => {
    const { ct, s, id } = zweiTermine();
    const alt = id(QUELLE, 'Begrüßung');
    await punktUebertragen(s, 'verschieben', QUELLE, alt, ZIEL, { nachId: null, vorBeginn: true });
    const anlegen = ct.geschrieben.indexOf(`POST /events/${ZIEL}/agenda/items`);
    const loeschen = ct.geschrieben.indexOf(`DELETE /events/${QUELLE}/agenda/items/${alt}`);
    expect(anlegen).toBeGreaterThanOrEqual(0);
    expect(loeschen).toBeGreaterThan(anlegen);
  });

  it('meldet das Anlegen Erfolg, ohne anzulegen, bleibt der alte Termin unberührt', async () => {
    const { ct, s, id } = zweiTermine();
    ct.anlegenLuegt = true;
    await expect(
      punktUebertragen(s, 'verschieben', QUELLE, id(QUELLE, 'Lied'), ZIEL, {
        nachId: null,
        vorBeginn: true,
      }),
    ).rejects.toMatchObject({ status: 502 });
    expect(ct.titel(QUELLE)).toEqual(['Ankommen*', 'Begrüßung', 'Lied', 'Predigt']);
    expect(ct.geschrieben.some((g) => g.startsWith('DELETE'))).toBe(false);
  });

  it('scheitert das Anlegen, wird im alten Termin nichts gelöscht', async () => {
    const { ct, s, id } = zweiTermine();
    ct.anlegenScheitertIn = ZIEL;
    await expect(
      punktUebertragen(s, 'verschieben', QUELLE, id(QUELLE, 'Lied'), ZIEL, {
        nachId: null,
        vorBeginn: true,
      }),
    ).rejects.toThrow('kaputt');
    expect(ct.titel(QUELLE)).toContain('Lied');
  });

  it('scheitert nur das Löschen, sagt die Meldung, dass er jetzt doppelt steht', async () => {
    const { ct, s, id } = zweiTermine();
    ct.loeschenScheitertIn = QUELLE;
    await expect(
      punktUebertragen(s, 'verschieben', QUELLE, id(QUELLE, 'Lied'), ZIEL, {
        nachId: null,
        vorBeginn: true,
      }),
    ).rejects.toMatchObject({ status: 500, message: nichtGeloescht('Lied') });
    expect(ct.titel(ZIEL)).toContain('Lied*');
    expect(ct.titel(QUELLE)).toContain('Lied');
  });

  it('Kopieren lässt den Punkt im alten Termin stehen', async () => {
    const { ct, s, id } = zweiTermine();
    const u = await punktUebertragen(s, 'kopieren', QUELLE, id(QUELLE, 'Lied'), ZIEL, {
      nachId: id(ZIEL, 'Segen'),
      vorBeginn: false,
    });
    expect(ct.titel(ZIEL)).toEqual(['Gebet*', 'Way Maker', 'Segen', 'Lied']);
    expect(ct.titel(QUELLE)).toEqual(['Ankommen*', 'Begrüßung', 'Lied', 'Predigt']);
    expect(u.zurueck).toBeNull();
  });
});

describe('Vorlauf und Auge im Ziel', () => {
  it('ganz vorne in den Vorlauf: die Grenze rückt mit, der bisherige Vorlauf-Punkt bleibt drin (#700)', async () => {
    const { ct, s, id } = zweiTermine();
    await punktUebertragen(s, 'verschieben', QUELLE, id(QUELLE, 'Ankommen'), ZIEL, {
      nachId: null,
      vorBeginn: true,
    });
    expect(ct.titel(ZIEL)).toEqual(['Ankommen*', 'Gebet*', 'Way Maker', 'Segen']);
    // Und in der Quelle zieht die Grenze nach – sonst rutschte „Begrüßung“ in den Vorlauf.
    expect(ct.titel(QUELLE)).toEqual(['Begrüßung', 'Lied', 'Predigt']);
  });

  it('direkt hinter die Beginn-Linie: nicht im Vorlauf, die Grenze bleibt', async () => {
    const { ct, s, id } = zweiTermine();
    await punktUebertragen(s, 'kopieren', QUELLE, id(QUELLE, 'Begrüßung'), ZIEL, {
      nachId: id(ZIEL, 'Gebet'),
      vorBeginn: false,
    });
    expect(ct.titel(ZIEL)).toEqual(['Gebet*', 'Begrüßung', 'Way Maker', 'Segen']);
  });

  it('ans Ende des Vorlaufs (hinter den letzten Vorlauf-Punkt): im Vorlauf', async () => {
    const { ct, s, id } = zweiTermine();
    await punktUebertragen(s, 'kopieren', QUELLE, id(QUELLE, 'Begrüßung'), ZIEL, {
      nachId: id(ZIEL, 'Gebet'),
      vorBeginn: true,
    });
    expect(ct.titel(ZIEL)).toEqual(['Gebet*', 'Begrüßung*', 'Way Maker', 'Segen']);
  });

  it('ein im alten Termin weggelassener Punkt steht im Ziel sichtbar', async () => {
    const { ct, s, id } = zweiTermine();
    await s.schreibe(`/events/${QUELLE}/agenda/items/${id(QUELLE, 'Lied')}/hide`, {
      method: 'POST',
      verweigert: '',
      fehler: '',
    });
    await punktUebertragen(s, 'verschieben', QUELLE, id(QUELLE, 'Lied'), ZIEL, {
      nachId: null,
      vorBeginn: true,
    });
    expect(ct.titel(ZIEL)).toContain('Lied*');
  });
});

describe('Wohin nicht', () => {
  it('geteilter Ablauf → 409, nichts geschrieben', async () => {
    const { ct, s, id } = zweiTermine();
    ct.teilen(ZIEL, QUELLE);
    await expect(
      punktUebertragen(s, 'verschieben', QUELLE, id(QUELLE, 'Lied'), ZIEL, {
        nachId: null,
        vorBeginn: true,
      }),
    ).rejects.toMatchObject({ status: 409, message: ABLAUF_GETEILT });
    expect(ct.geschrieben).toEqual([]);
  });

  it('Ziel abgeschlossen → 423, nichts geschrieben', async () => {
    const { ct, s, id } = zweiTermine();
    ct.zuordnung.get(ZIEL)!.gesperrt = true;
    await expect(
      punktUebertragen(s, 'kopieren', QUELLE, id(QUELLE, 'Lied'), ZIEL, {
        nachId: null,
        vorBeginn: true,
      }),
    ).rejects.toMatchObject({ status: 423, message: ABLAUF_ABGESCHLOSSEN });
    expect(ct.geschrieben).toEqual([]);
  });

  it('Quelle abgeschlossen: Verschieben → 423 vor dem Anlegen; Kopieren geht', async () => {
    const { ct, s, id } = zweiTermine();
    ct.zuordnung.get(QUELLE)!.gesperrt = true;
    const ablage = { nachId: null, vorBeginn: true };
    await expect(
      punktUebertragen(s, 'verschieben', QUELLE, id(QUELLE, 'Lied'), ZIEL, ablage),
    ).rejects.toMatchObject({ status: 423 });
    expect(ct.geschrieben).toEqual([]);
    await punktUebertragen(s, 'kopieren', QUELLE, id(QUELLE, 'Lied'), ZIEL, ablage);
    expect(ct.titel(ZIEL)).toContain('Lied*');
  });

  it('Punkt inzwischen weg → 404', async () => {
    const { s } = zweiTermine();
    await expect(
      punktUebertragen(s, 'verschieben', QUELLE, 9999, ZIEL, { nachId: null, vorBeginn: true }),
    ).rejects.toMatchObject({ status: 404, message: PUNKT_FEHLT });
  });

  it('teilenAblauf erkennt den geteilten Ablauf auch ohne Ablauf-ID (startTimes)', () => {
    const punkt = { id: 1, title: 'x', startTimes: { [QUELLE]: 'a', [ZIEL]: 'a' } };
    expect(teilenAblauf({ items: [punkt] }, QUELLE, { items: [punkt] }, ZIEL)).toBe(true);
    expect(teilenAblauf({ items: [punkt] }, QUELLE, { items: [] }, 999)).toBe(false);
  });
});

describe('Rückgängig nach dem Übertragen (Alwin, 29.10.2026)', () => {
  it('Verschieben: wieder an der alten Stelle im alten Termin – samt Vorlauf und Auge –, im Ziel weg', async () => {
    const { ct, s, id } = zweiTermine();
    await s.schreibe(`/events/${QUELLE}/agenda/items/${id(QUELLE, 'Ankommen')}/hide`, {
      method: 'POST',
      verweigert: '',
      fehler: '',
    });
    const u = await punktUebertragen(s, 'verschieben', QUELLE, id(QUELLE, 'Ankommen'), ZIEL, {
      nachId: id(ZIEL, 'Segen'),
      vorBeginn: false,
    });
    ct.geschrieben = [];
    await uebertragenZuruecknehmen(s, u, 'Ankommen');
    expect(ct.titel(QUELLE)).toEqual(['Ankommen* (weg)', 'Begrüßung', 'Lied', 'Predigt']);
    expect(ct.titel(ZIEL)).toEqual(['Gebet*', 'Way Maker', 'Segen']);
    // Erst zurückholen, dann im Ziel löschen – wie beim Übertragen.
    const anlegen = ct.geschrieben.indexOf(`POST /events/${QUELLE}/agenda/items`);
    const loeschen = ct.geschrieben.indexOf(`DELETE /events/${ZIEL}/agenda/items/${u.neuId}`);
    expect(anlegen).toBeGreaterThanOrEqual(0);
    expect(loeschen).toBeGreaterThan(anlegen);
  });

  it('Kopieren: nur die Kopie im Ziel löschen', async () => {
    const { ct, s, id } = zweiTermine();
    const u = await punktUebertragen(s, 'kopieren', QUELLE, id(QUELLE, 'Lied'), ZIEL, {
      nachId: null,
      vorBeginn: true,
    });
    await uebertragenZuruecknehmen(s, u, 'Lied');
    expect(ct.titel(ZIEL)).toEqual(['Gebet*', 'Way Maker', 'Segen']);
    expect(ct.titel(QUELLE)).toEqual(['Ankommen*', 'Begrüßung', 'Lied', 'Predigt']);
  });

  it('scheitert das Zurückholen, bleibt der Punkt im Ziel stehen', async () => {
    const { ct, s, id } = zweiTermine();
    const u = await punktUebertragen(s, 'verschieben', QUELLE, id(QUELLE, 'Lied'), ZIEL, {
      nachId: null,
      vorBeginn: true,
    });
    ct.anlegenScheitertIn = QUELLE;
    await expect(uebertragenZuruecknehmen(s, u, 'Lied')).rejects.toThrow('kaputt');
    expect(ct.titel(ZIEL)).toContain('Lied*');
  });

  it('scheitert danach nur das Löschen im Ziel, sagt die Meldung es', async () => {
    const { ct, s, id } = zweiTermine();
    const u = await punktUebertragen(s, 'verschieben', QUELLE, id(QUELLE, 'Lied'), ZIEL, {
      nachId: null,
      vorBeginn: true,
    });
    ct.loeschenScheitertIn = ZIEL;
    await expect(uebertragenZuruecknehmen(s, u, 'Lied')).rejects.toMatchObject({
      message: kopieBleibt('Lied'),
    });
    expect(ct.titel(QUELLE)).toContain('Lied');
  });
});
