import { describe, expect, it } from 'vitest';
import {
  ABLAUF_INZWISCHEN_GEAENDERT,
  GELOEST_OHNE_NEUEN,
  ablaufBestandLesen,
  ablaufNeuAufsetzen,
  standAus,
  verbundeneTermine,
  type AblaufStand,
} from './ablaufNeu';
import { ABLAUF_ABGESCHLOSSEN, type CtSchreiber, type SchreibAuftrag } from './schreibKern';
import type { CtAgenda, CtEvent } from './typen';

/**
 * „Neu aufsetzen“ (E6-5b, #691). Die Attrappe verhält sich wie an der Test-Instanz gemessen (E6-5b-0 Teil 1–3):
 * Vorlage/Kopie auf einen bestehenden Ablauf ersetzen still mit **neuen** Punkt-IDs, `items: []` leert, ein geteilter
 * Ablauf ist für alle verbundenen Termine derselbe, `DELETE` löst nur die Verbindung, abgeschlossen → 403.
 */
class Fehler extends Error {
  constructor(
    public status: number,
    m: string,
  ) {
    super(m);
  }
}

interface Ablauf {
  titel: string[];
  ids: number[];
  gesperrt: boolean;
  geaendert: string;
}

class FakeCt {
  ablaeufe = new Map<number, Ablauf>();
  /** Termin → Ablauf-ID: Zeigen zwei Termine auf denselben, ist er geteilt. */
  zuordnung = new Map<number, number>();
  vorlagen = new Map<number, string[]>([
    [28, ['Ankommen', 'Lobpreis', 'Begrüßung', 'Lied', 'Predigt']],
  ]);
  termine = new Map<number, string>([
    [166, 'Gottesdienst'],
    [171, 'Gottesdienst (2. Teil)'],
    [142, 'Gottesdienst früher'],
  ]);
  geschrieben: { pfad: string; auftrag: SchreibAuftrag }[] = [];
  /** ChurchTools meldet Erfolg, tut aber nichts (Lehre 11.08.2026). */
  wirkungslos = false;
  /** Das Anlegen nach dem Lösen scheitert. */
  anlegenScheitert = false;
  /** Der Kalender, den `GET …/agenda` nennt (`null`: keiner). */
  ablaufKalender: number | null = 2;
  private naechsteId = 1000;
  private uhr = 0;

  ablaufAnlegen(eventId: number, titel: string[], gesperrt = false): number {
    const id = 70 + this.ablaeufe.size;
    this.ablaeufe.set(id, {
      titel,
      ids: titel.map(() => this.naechsteId++),
      gesperrt,
      geaendert: this.stempel(),
    });
    this.zuordnung.set(eventId, id);
    return id;
  }

  teilen(ziel: number, quelle: number): void {
    this.zuordnung.set(ziel, this.zuordnung.get(quelle)!);
  }

  titelVon(eventId: number): string[] | null {
    const id = this.zuordnung.get(eventId);
    return id === undefined ? null : this.ablaeufe.get(id)!.titel;
  }

  private stempel(): string {
    return `2026-10-23T10:00:${String(this.uhr++).padStart(2, '0')}Z`;
  }

  private agenda(eventId: number): CtAgenda {
    const aid = this.zuordnung.get(eventId);
    if (aid === undefined) throw new Fehler(404, 'kein Ablauf');
    const a = this.ablaeufe.get(aid)!;
    const verbunden = [...this.zuordnung].filter(([, x]) => x === aid).map(([t]) => t);
    return {
      id: aid,
      isLocked: a.gesperrt,
      calendarId: this.ablaufKalender ?? undefined,
      meta: { modifiedDate: a.geaendert },
      items: a.ids.map((id, k) => ({
        id,
        title: a.titel[k],
        startTimes: Object.fromEntries(verbunden.map((t) => [String(t), '2027-01-10T09:00:00Z'])),
      })),
    };
  }

  private ersetzen(eventId: number, titel: string[]): void {
    const aid = this.zuordnung.get(eventId);
    if (aid === undefined) {
      this.ablaufAnlegen(eventId, titel);
      return;
    }
    const a = this.ablaeufe.get(aid)!;
    a.titel = titel;
    a.ids = titel.map(() => this.naechsteId++);
    a.geaendert = this.stempel();
  }

  schreiber(): CtSchreiber {
    return {
      // Wirft `agenda` (404), wird das Versprechen damit abgelehnt.
      agenda: (id) => new Promise<CtAgenda>((ok) => ok(this.agenda(id))),
      song: () => Promise.reject(new Error('nicht gebraucht')),
      vorlage: (id) => Promise.resolve({ id, items: this.vorlagen.get(id) ?? [] }),
      schreibe: (pfad, auftrag) => {
        this.geschrieben.push({ pfad, auftrag });
        const m = /^\/events\/(\d+)\/agenda(?:\?(template_id|event_id)=(\d+))?$/.exec(pfad);
        if (!m) return Promise.reject(new Fehler(500, `unbekannt: ${pfad}`));
        const eventId = Number(m[1]);
        const aid = this.zuordnung.get(eventId);
        if (aid !== undefined && this.ablaeufe.get(aid)!.gesperrt) {
          return Promise.reject(new Fehler(403, auftrag.verweigert));
        }
        if (this.wirkungslos) return Promise.resolve(null);
        if (auftrag.method === 'DELETE') {
          this.zuordnung.delete(eventId);
          return Promise.resolve(null);
        }
        if (aid === undefined && this.anlegenScheitert)
          return Promise.reject(new Fehler(500, auftrag.fehler));
        const titel =
          m[2] === 'template_id'
            ? (this.vorlagen.get(Number(m[3])) ?? [])
            : m[2] === 'event_id'
              ? [...(this.titelVon(Number(m[3])) ?? [])]
              : (auftrag.json as { items?: unknown[] }).items
                ? []
                : aid === undefined
                  ? []
                  : this.ablaeufe.get(aid)!.titel;
        this.ersetzen(eventId, titel);
        return Promise.resolve(null);
      },
      fehler: (st, m) => new Fehler(st, m),
    };
  }

  leser() {
    const s = this.schreiber();
    return {
      agenda: s.agenda,
      termin: (id: number): Promise<CtEvent> => {
        const name = this.termine.get(id);
        if (!name) return Promise.reject(new Fehler(403, 'nicht sichtbar'));
        return Promise.resolve({
          id,
          name,
          startDate: '2027-01-10T11:00:00Z',
          endDate: '2027-01-10T12:00:00Z',
        });
      },
    };
  }
}

/** Was die Nachfrage gezeigt hätte – über den Erzeuger, nicht hingeschrieben. */
async function gesehenVon(ct: FakeCt, eventId: number): Promise<AblaufStand> {
  return standAus(await ablaufBestandLesen(ct.leser(), eventId, 'Europe/Berlin'));
}

const VORLAGE = { art: 'vorlage', vorlageId: 28 } as const;
const GEBET = ['Gebet', 'Segen'];

describe('verbundeneTermine', () => {
  it('liest die anderen Termine aus den startTimes-Schlüsseln – ohne den eigenen, aufsteigend', () => {
    const ct = new FakeCt();
    ct.ablaufAnlegen(171, GEBET);
    ct.teilen(166, 171);
    ct.teilen(180, 171);
    return ct
      .schreiber()
      .agenda(171)
      .then((a) => expect(verbundeneTermine(a, 171)).toEqual([166, 180]));
  });

  it('ein leerer geteilter Ablauf ist nicht erkennbar (gemessen: ChurchTools nennt die Termine nicht)', () => {
    expect(verbundeneTermine({ items: [] }, 166)).toEqual([]);
  });
});

describe('ablaufBestandLesen', () => {
  it('Punkte in Reihenfolge, Änderungsstempel und die verbundenen Termine mit Namen und Ortszeit', async () => {
    const ct = new FakeCt();
    ct.ablaufAnlegen(166, GEBET);
    ct.teilen(171, 166);
    const b = await ablaufBestandLesen(ct.leser(), 166, 'Europe/Berlin');
    expect(b.punkte).toHaveLength(2);
    expect(b.geaendert).toMatch(/^2026-10-23/);
    expect(b.verbunden).toEqual([
      { id: 171, name: 'Gottesdienst (2. Teil)', beginn: '2027-01-10T12:00' },
    ]);
  });

  it('ein verbundener Termin, der sich nicht lesen lässt, steht ohne Namen da – genannt wird er trotzdem', async () => {
    const ct = new FakeCt();
    ct.ablaufAnlegen(166, GEBET);
    ct.teilen(999, 166);
    expect((await ablaufBestandLesen(ct.leser(), 166, 'Europe/Berlin')).verbunden).toEqual([
      { id: 999, name: null, beginn: null },
    ]);
  });
});

describe('ablaufNeuAufsetzen', () => {
  it('aus einer Vorlage: ersetzt die Punkte, nachgelesen', async () => {
    const ct = new FakeCt();
    ct.ablaufAnlegen(166, GEBET);
    await ablaufNeuAufsetzen(ct.schreiber(), 166, 2, VORLAGE, await gesehenVon(ct, 166), false);
    expect(ct.titelVon(166)).toEqual(['Ankommen', 'Lobpreis', 'Begrüßung', 'Lied', 'Predigt']);
    expect(ct.geschrieben.map((g) => [g.auftrag.method, g.pfad])).toEqual([
      ['PUT', '/events/166/agenda?template_id=28'],
    ]);
  });

  it('wie ein anderer Termin: event_id, die Zahl kommt aus der Quelle', async () => {
    const ct = new FakeCt();
    ct.ablaufAnlegen(166, GEBET);
    ct.ablaufAnlegen(142, ['A', 'B', 'C']);
    await ablaufNeuAufsetzen(
      ct.schreiber(),
      166,
      2,
      { art: 'kopie', eventId: 142 },
      await gesehenVon(ct, 166),
      false,
    );
    expect(ct.titelVon(166)).toEqual(['A', 'B', 'C']);
    expect(ct.geschrieben[0].pfad).toBe('/events/166/agenda?event_id=142');
  });

  it('leer: PUT mit items: [] – der Ablauf bleibt, die Punkte sind weg', async () => {
    const ct = new FakeCt();
    ct.ablaufAnlegen(166, GEBET);
    await ablaufNeuAufsetzen(
      ct.schreiber(),
      166,
      2,
      { art: 'leer' },
      await gesehenVon(ct, 166),
      false,
    );
    expect(ct.titelVon(166)).toEqual([]);
    expect(ct.geschrieben[0]).toMatchObject({
      pfad: '/events/166/agenda',
      auftrag: { json: { items: [] } },
    });
  });

  it('seit der Nachfrage geändert (Punkt dazu, anderer Stempel, Verbindung, weg) → 412, nichts geschrieben', async () => {
    const faelle: ((ct: FakeCt, g: AblaufStand) => AblaufStand)[] = [
      (_ct, g) => ({ ...g, punkte: [...g.punkte, 1] }),
      (_ct, g) => ({ ...g, geaendert: '2026-10-23T09:59:59Z' }),
      (ct, g) => (ct.teilen(171, 166), g),
      (ct, g) => (ct.zuordnung.delete(166), g),
    ];
    for (const fall of faelle) {
      const ct = new FakeCt();
      ct.ablaufAnlegen(166, GEBET);
      const gesehen = fall(ct, await gesehenVon(ct, 166));
      await expect(
        ablaufNeuAufsetzen(ct.schreiber(), 166, 2, VORLAGE, gesehen, false),
      ).rejects.toMatchObject({
        status: 412,
        message: ABLAUF_INZWISCHEN_GEAENDERT,
      });
      expect(ct.geschrieben).toEqual([]);
    }
  });

  it('ohne Änderungsstempel zählen Punkte und Verbindung – ein fehlender Stempel ist kein Konflikt', async () => {
    const ct = new FakeCt();
    ct.ablaufAnlegen(166, GEBET);
    const gesehen = { ...(await gesehenVon(ct, 166)), geaendert: null };
    await ablaufNeuAufsetzen(ct.schreiber(), 166, 2, VORLAGE, gesehen, false);
    expect(ct.titelVon(166)).toHaveLength(5);
  });

  it('abgeschlossen → 423, nichts geschrieben', async () => {
    const ct = new FakeCt();
    ct.ablaufAnlegen(166, GEBET, true);
    await expect(
      ablaufNeuAufsetzen(ct.schreiber(), 166, 2, VORLAGE, await gesehenVon(ct, 166), false),
    ).rejects.toMatchObject({ status: 423, message: ABLAUF_ABGESCHLOSSEN });
    expect(ct.geschrieben).toEqual([]);
  });

  it('Kopie aus sich selbst oder aus einem verbundenen Termin → 400, nichts geschrieben', async () => {
    const ct = new FakeCt();
    ct.ablaufAnlegen(166, GEBET);
    ct.teilen(171, 166);
    const gesehen = await gesehenVon(ct, 166);
    for (const eventId of [166, 171]) {
      await expect(
        ablaufNeuAufsetzen(ct.schreiber(), 166, 2, { art: 'kopie', eventId }, gesehen, false),
      ).rejects.toMatchObject({ status: 400 });
    }
    expect(ct.geschrieben).toEqual([]);
  });

  it('ChurchTools meldet Erfolg, ändert aber nichts → 502 statt „ersetzt“', async () => {
    const ct = new FakeCt();
    ct.ablaufAnlegen(166, GEBET);
    const gesehen = await gesehenVon(ct, 166);
    ct.wirkungslos = true;
    await expect(
      ablaufNeuAufsetzen(ct.schreiber(), 166, 2, VORLAGE, gesehen, false),
    ).rejects.toMatchObject({
      status: 502,
    });
    await expect(
      ablaufNeuAufsetzen(ct.schreiber(), 166, 2, { art: 'leer' }, gesehen, false),
    ).rejects.toMatchObject({ status: 502 });
  });

  it('gleich viele Punkte vorher wie in der Vorlage, aber nichts ersetzt → 502 (die Zahl allein belegt nichts)', async () => {
    const ct = new FakeCt();
    ct.ablaufAnlegen(166, ['1', '2', '3', '4', '5']);
    const gesehen = await gesehenVon(ct, 166);
    ct.wirkungslos = true;
    await expect(
      ablaufNeuAufsetzen(ct.schreiber(), 166, 2, VORLAGE, gesehen, false),
    ).rejects.toMatchObject({
      status: 502,
    });
  });

  describe('geteilter Ablauf', () => {
    it('für alle: ein Schreiben, beide Termine haben danach die neuen Punkte', async () => {
      const ct = new FakeCt();
      ct.ablaufAnlegen(166, GEBET);
      ct.teilen(171, 166);
      await ablaufNeuAufsetzen(ct.schreiber(), 166, 2, VORLAGE, await gesehenVon(ct, 166), false);
      expect(ct.titelVon(166)).toHaveLength(5);
      expect(ct.titelVon(171)).toEqual(ct.titelVon(166));
      expect(ct.geschrieben.map((g) => g.auftrag.method)).toEqual(['PUT']);
    });

    it('nur für diesen Termin: erst lösen (DELETE), dann eigener Ablauf – der andere behält den alten', async () => {
      const ct = new FakeCt();
      ct.ablaufAnlegen(166, GEBET);
      ct.teilen(171, 166);
      await ablaufNeuAufsetzen(ct.schreiber(), 166, 2, VORLAGE, await gesehenVon(ct, 166), true);
      expect(ct.titelVon(171)).toEqual(GEBET);
      expect(ct.titelVon(166)).toHaveLength(5);
      expect(ct.zuordnung.get(166)).not.toBe(ct.zuordnung.get(171));
      expect(ct.geschrieben.map((g) => [g.auftrag.method, g.pfad])).toEqual([
        ['DELETE', '/events/166/agenda'],
        ['PUT', '/events/166/agenda?template_id=28'],
      ]);
    });

    it('nur für diesen Termin, leer: eigener leerer Ablauf, der andere behält seine Punkte', async () => {
      const ct = new FakeCt();
      ct.ablaufAnlegen(166, GEBET);
      ct.teilen(171, 166);
      await ablaufNeuAufsetzen(
        ct.schreiber(),
        166,
        2,
        { art: 'leer' },
        await gesehenVon(ct, 166),
        true,
      );
      expect(ct.titelVon(166)).toEqual([]);
      expect(ct.titelVon(171)).toEqual(GEBET);
    });

    it('scheitert das Anlegen nach dem Lösen, sagt die Meldung es ehrlich – der andere Termin behält seinen', async () => {
      const ct = new FakeCt();
      ct.ablaufAnlegen(166, GEBET);
      ct.teilen(171, 166);
      const gesehen = await gesehenVon(ct, 166);
      ct.anlegenScheitert = true;
      await expect(
        ablaufNeuAufsetzen(ct.schreiber(), 166, 2, VORLAGE, gesehen, true),
      ).rejects.toMatchObject({
        status: 502,
        message: GELOEST_OHNE_NEUEN,
      });
      expect(ct.titelVon(166)).toBeNull();
      expect(ct.titelVon(171)).toEqual(GEBET);
    });

    it('nur für diesen Termin ohne Kalender des Termins: der des Ablaufs gilt', async () => {
      const ct = new FakeCt();
      ct.ablaufAnlegen(166, GEBET);
      ct.teilen(171, 166);
      await ablaufNeuAufsetzen(ct.schreiber(), 166, null, VORLAGE, await gesehenVon(ct, 166), true);
      expect(ct.titelVon(166)).toHaveLength(5);
      expect(ct.geschrieben[1].auftrag.json).toEqual({ calendarId: 2 });
    });

    it('nur für diesen Termin ganz ohne Kalender → 400 VOR dem Lösen, nichts geschrieben', async () => {
      const ct = new FakeCt();
      ct.ablaufAnlegen(166, GEBET);
      ct.teilen(171, 166);
      ct.ablaufKalender = null;
      await expect(
        ablaufNeuAufsetzen(ct.schreiber(), 166, null, VORLAGE, await gesehenVon(ct, 166), true),
      ).rejects.toMatchObject({ status: 400 });
      expect(ct.geschrieben).toEqual([]);
      expect(ct.titelVon(166)).toEqual(GEBET);
    });

    it('ersetzen braucht keinen Kalender (gemessen) – auch ohne jeden geht es', async () => {
      const ct = new FakeCt();
      ct.ablaufAnlegen(166, GEBET);
      ct.ablaufKalender = null;
      await ablaufNeuAufsetzen(
        ct.schreiber(),
        166,
        null,
        VORLAGE,
        await gesehenVon(ct, 166),
        false,
      );
      expect(ct.titelVon(166)).toHaveLength(5);
    });

    it('`nurDieser` ohne Verbindung: ganz normales Ersetzen, kein DELETE', async () => {
      const ct = new FakeCt();
      ct.ablaufAnlegen(166, GEBET);
      await ablaufNeuAufsetzen(ct.schreiber(), 166, 2, VORLAGE, await gesehenVon(ct, 166), true);
      expect(ct.geschrieben.map((g) => g.auftrag.method)).toEqual(['PUT']);
    });
  });
});
