import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as V from '@ui/ct/verbindung';
import * as E from './einrichten';
import { ApiError } from '@ui/ct/fehler';
import { absagePlan, nachrueckPlan } from '@shared/anmeldung/bewegung';
import { anmeldungenAus, type MitgliedRoh } from '@shared/anmeldung/liste';
import { STICHTAG, e, mitglieder, stand } from '@shared/anmeldung/liste.testdaten';
import { absagenLassen, nachrueckenLassen } from './bewegung';

/**
 * Nachrücken und Absagen schreiben (A7-3) gegen ein nachgestelltes ChurchTools – so, wie es am 19.10.2026 gemessen
 * wurde: PATCH ändert nur, was geschickt wird; DELETE entfernt (danach 404); PUT nimmt mit Feldern wieder auf.
 */
vi.mock('@ui/ct/verbindung', () => ({ ctAnfrage: vi.fn(), ctDaten: vi.fn() }));
vi.mock('./einrichten', async (original) => ({
  ...(await original<typeof import('./einrichten')>()),
  anmeldungVon: vi.fn(),
  speichereAnmeldung: vi.fn(),
}));
const ct = vi.mocked(V);
const ei = vi.mocked(E);

const HEUTE = '2026-10-19';
const JONAS = 10;
const LENA = 11;
let gruppe: Map<number, MitgliedRoh>;
/** ChurchTools tut so, als ob – übernimmt aber nichts (Status bzw. Entfernen). */
let schlucken = false;
/** Nur das Entfernen geht ins Leere (alles andere wirkt). */
let keinLoeschen = false;
/** Nur der neue Status geht ins Leere. */
let keinStatus = false;

function laden(roh: MitgliedRoh[]) {
  gruppe = new Map(roh.map((m) => [m.personId!, structuredClone(m)]));
}
const feld = (personId: number, id: number) =>
  gruppe.get(personId)?.fields?.find((f) => Number(f.id) === id)?.value ?? null;

beforeEach(() => {
  schlucken = false;
  keinLoeschen = false;
  keinStatus = false;
  ct.ctDaten.mockImplementation(async (pfad: string) => {
    const m = gruppe.get(Number(/members\/(\d+)/.exec(pfad)![1]));
    if (!m) throw new ApiError(404, 'nicht gefunden');
    return structuredClone(m);
  });
  ct.ctAnfrage.mockImplementation(async (pfad: string, init?: RequestInit) => {
    const pid = Number(/members\/(\d+)/.exec(pfad)![1]);
    const body = init?.body ? (JSON.parse(String(init.body)) as Record<string, unknown>) : {};
    if (schlucken) return null;
    if (init?.method === 'DELETE') {
      if (!keinLoeschen) gruppe.delete(pid);
    } else if (init?.method === 'PUT') {
      // Wie gemessen (28.10.2026): nur anlegen, nie überschreiben; Ändern geht über PATCH.
      if (body.only_add !== true)
        throw new Error('PUT ohne only_add – Ändern per PUT ist veraltet');
      if (gruppe.has(pid)) throw new ApiError(403, 'Die Person ist bereits in der Gruppe');
      gruppe.set(pid, {
        personId: pid,
        groupTypeRoleId: body.groupTypeRoleId as number,
        groupMemberStatus: body.groupMemberStatus as string,
        waitinglistPosition: (body.waitinglistPosition as number) ?? null,
        fields: Object.entries((body.fields ?? {}) as Record<string, unknown>).map(
          ([id, value]) => ({
            id: Number(id),
            value,
          }),
        ),
      });
    } else {
      const m = gruppe.get(pid);
      if (!m) throw new ApiError(404, 'nicht in der Gruppe');
      if (body.groupMemberStatus && !keinStatus)
        m.groupMemberStatus = body.groupMemberStatus as string;
      for (const [id, w] of Object.entries((body.fields ?? {}) as Record<string, unknown>)) {
        const wert = typeof w === 'boolean' ? (w ? '1' : '0') : w;
        const f = m.fields!.find((y) => Number(y.id) === Number(id));
        if (f) f.value = wert;
        else m.fields!.push({ id: Number(id), value: wert });
      }
    }
    return null;
  });
  ei.anmeldungVon.mockResolvedValue({ maxPlaetze: 10, warteliste: true, ab: null, bis: null });
  ei.speichereAnmeldung.mockResolvedValue();
});

const anmeldung = (x = e()) => anmeldungenAus(x, stand([...gruppe.values()]), STICHTAG)[0];

describe('nachrueckenLassen', () => {
  it('Lena rückt nach – aktiv, eigene Zahlung offen', async () => {
    const x = e();
    laden(mitglieder('AAAAAA', [true, false], JONAS, { bezahlt: true }));
    const plan = nachrueckPlan(x, anmeldung(x), LENA, { belegt: 1, max: 10, wartende: [] }, HEUTE);
    await nachrueckenLassen(165, x, plan);
    expect(gruppe.get(LENA)!.groupMemberStatus).toBe('active');
    expect([feld(LENA, x.ctFelder.betrag), feld(LENA, x.ctFelder.bezahlt)]).toEqual([
      '6,00 €',
      '0',
    ]);
    // Die Zahlung der Anmeldung (bei Jonas, bezahlt) bleibt.
    expect(feld(JONAS, x.ctFelder.bezahlt)).toBe('1');
    expect(ei.speichereAnmeldung).not.toHaveBeenCalled();
  });

  it('voll → erst die Plätze erhöhen', async () => {
    const x = e();
    laden(mitglieder('AAAAAA', [true, false], JONAS));
    const plan = nachrueckPlan(x, anmeldung(x), LENA, { belegt: 10, max: 10, wartende: [] }, HEUTE);
    await nachrueckenLassen(165, x, plan);
    expect(ei.speichereAnmeldung).toHaveBeenCalledWith(
      165,
      expect.objectContaining({ maxPlaetze: 11 }),
    );
  });

  it('der Platz wird nicht übernommen → Fehler, und die Zahlung kommt wieder weg', async () => {
    const x = e();
    laden(mitglieder('AAAAAA', [true, false], JONAS));
    const plan = nachrueckPlan(x, anmeldung(x), LENA, { belegt: 1, max: 10, wartende: [] }, HEUTE);
    keinStatus = true;
    await expect(nachrueckenLassen(165, x, plan)).rejects.toThrow(
      /das Nachrücken nicht übernommen/,
    );
    expect([gruppe.get(LENA)!.groupMemberStatus, feld(LENA, x.ctFelder.betrag)]).toEqual([
      'waiting',
      null,
    ]);
  });
});

describe('absagenLassen', () => {
  it('Lena sagt ab: Zahlung bei Jonas neu, Lena weg; Rückgängig holt sie mit allen Antworten zurück', async () => {
    const x = e();
    laden(mitglieder('AAAAAA', [true, true], JONAS));
    const lenaVorher = structuredClone(gruppe.get(LENA)!);
    const zurueck = await absagenLassen(165, x, absagePlan(x, anmeldung(x), LENA, HEUTE));
    expect(gruppe.has(LENA)).toBe(false);
    expect(feld(JONAS, x.ctFelder.betrag)).toBe('6,00 €');
    await zurueck();
    expect(gruppe.get(LENA)!.groupMemberStatus).toBe('active');
    expect(feld(LENA, x.ctFelder.foto)).toBe(
      lenaVorher.fields!.find((f) => Number(f.id) === x.ctFelder.foto)!.value,
    );
    expect(feld(JONAS, x.ctFelder.betrag)).toBe('12,00 €');
  });

  it('die erste Person sagt ab → Kontakt, Unterschrift, Zahlung gehen an die nächste', async () => {
    const x = e();
    laden(mitglieder('AAAAAA', [true, true], JONAS, { bezahlt: true }));
    const unterschrift = feld(JONAS, x.ctFelder['sign.daten']);
    const zurueck = await absagenLassen(165, x, absagePlan(x, anmeldung(x), JONAS, HEUTE));
    expect([
      feld(LENA, x.ctFelder.kontakt),
      feld(LENA, x.ctFelder['sign.daten']),
      feld(LENA, x.ctFelder.bezahlt),
      feld(LENA, x.ctFelder.betrag),
    ]).toEqual(['Maria Beispiel', unterschrift, '1', '6,00 €']);
    expect(anmeldung(x).zahlungBei).toBe(LENA);
    // Rückgängig: Jonas zurück, Lenas Felder wie vorher (leer).
    await zurueck();
    expect([feld(JONAS, x.ctFelder.kontakt), feld(LENA, x.ctFelder.kontakt)]).toEqual([
      'Maria Beispiel',
      null,
    ]);
  });

  it('wer wartet, kommt auf denselben Platz zurück', async () => {
    const x = e();
    laden(mitglieder('AAAAAA', [true, false], JONAS));
    const zurueck = await absagenLassen(165, x, absagePlan(x, anmeldung(x), LENA, HEUTE));
    await zurueck();
    expect([gruppe.get(LENA)!.groupMemberStatus, gruppe.get(LENA)!.waitinglistPosition]).toEqual([
      'waiting',
      1,
    ]);
  });

  it('Entfernen nicht übernommen → Fehler statt „abgesagt“', async () => {
    const x = e();
    laden(mitglieder('AAAAAA', [true, true], JONAS));
    const plan = absagePlan(x, anmeldung(x), LENA, HEUTE);
    keinLoeschen = true;
    await expect(absagenLassen(165, x, plan)).rejects.toThrow(/die Absage nicht übernommen/);
    // Lena ist noch da – und die neue Zahlung bei Jonas wieder weg: nichts halb geändert.
    expect(gruppe.has(LENA)).toBe(true);
    expect(feld(JONAS, x.ctFelder.betrag)).toBe('12,00 €');
  });
});
