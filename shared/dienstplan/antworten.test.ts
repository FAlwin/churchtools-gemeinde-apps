import { describe, expect, it } from 'vitest';
import {
  absagen,
  antwortSchluessel,
  letzteAus,
  mitAntworten,
  rueckgaengig,
  RUECKGAENGIG_MS,
  zusagen,
  type Antwort,
} from './antworten';
import { mein, zeile } from './zeile.testutil';
import type { PlatzOrt } from './einteilen';
import { Fehler, nachbau } from './einteilen.testutil';
import type { RohPlatz } from './termine';

/** Spike (19) ist für Gesang (Dienst 9, Platz 1) am Termin 166 angefragt – wie in der Messung vom 03.11.2026. */
const ICH = 19;
const GESANG: PlatzOrt = { eventId: 166, serviceId: 9, index: 1 };
const platz = (id: number, extra: Partial<RohPlatz> = {}): RohPlatz => ({
  id,
  serviceId: 9,
  index: 1,
  personId: ICH,
  name: 'Spike',
  isAccepted: false,
  ...extra,
});
const leer = (id: number): RohPlatz => platz(id, { personId: null, name: null });

describe('zusagen', () => {
  it('accept auf die frisch gelesene ID, ohne Kommentar; neue ID zurück, Rückgängig mit ihr', async () => {
    const { ct, port } = nachbau([platz(753)]);
    const r = await zusagen(port, GESANG, ICH);
    expect(r).toEqual({ ok: true, platzId: 900, geschriebenAuf: 753 });
    expect(ct.geschrieben).toEqual([
      { pfad: '/events/166/servicerequests/753/accept', method: 'POST', json: { comment: null } },
    ]);
    expect(letzteAus('zugesagt', r)).toEqual({ art: 'zugesagt', id: 900 });
  });

  it('schon zugesagt (z. B. in der ChurchTools-App): Erfolg ohne Schreiben – dann gibt es nichts zurückzunehmen', async () => {
    const { ct, port } = nachbau([platz(753, { isAccepted: true })]);
    const r = await zusagen(port, GESANG, ICH);
    expect(r).toEqual({ ok: true, platzId: 753 });
    expect(ct.geschrieben).toEqual([]);
    expect(letzteAus('zugesagt', r)).toBeNull();
  });

  it('Anfrage inzwischen zurückgezogen oder anders vergeben: Konflikt, nichts geschrieben', async () => {
    for (const ist of [leer(753), platz(753, { personId: 46, name: 'Anna' })]) {
      const { ct, port } = nachbau([ist]);
      expect(await zusagen(port, GESANG, ICH)).toMatchObject({ ok: false, grund: 'konflikt' });
      expect(ct.geschrieben).toEqual([]);
    }
  });

  it('kein Recht (403) → kein-recht; Antwort verloren, aber angekommen → nachgelesen, Erfolg', async () => {
    const a = nachbau([platz(753)]);
    a.ct.schreibenFehler = 403;
    expect(await zusagen(a.port, GESANG, ICH)).toEqual({ ok: false, grund: 'kein-recht' });
    const b = nachbau([platz(753)]);
    b.ct.schreibenFehler = null;
    b.ct.trotzdemSchreiben = true;
    expect(await zusagen(b.port, GESANG, ICH)).toEqual({
      ok: true,
      platzId: 900,
      geschriebenAuf: 753,
    });
  });
});

describe('absagen', () => {
  it('decline mit Grund (getrimmt); der Platz ist frei, der Grund hängt dort; Rückgängig mit der alten ID', async () => {
    const { ct, port } = nachbau([platz(753)]);
    const r = await absagen(port, GESANG, ICH, '  bin im Urlaub ');
    expect(ct.geschrieben).toEqual([
      {
        pfad: '/events/166/servicerequests/753/decline',
        method: 'POST',
        json: { comment: 'bin im Urlaub' },
      },
    ]);
    expect(r).toEqual({ ok: true, platzId: 900, geschriebenAuf: 753 });
    expect(ct.plaetze[0]).toMatchObject({ personId: null, name: null, comment: 'bin im Urlaub' });
    expect(letzteAus('abgesagt', r)).toEqual({ art: 'abgesagt', id: 753 });
  });

  it('ohne Grund → comment null', async () => {
    const { ct, port } = nachbau([platz(753)]);
    await absagen(port, GESANG, ICH, '   ');
    expect(ct.geschrieben[0].json).toEqual({ comment: null });
  });

  it('nur eine offene Anfrage: eine Zusage sagt man hier nicht ab (Konflikt, nichts geschrieben)', async () => {
    const { ct, port } = nachbau([platz(753, { isAccepted: true })]);
    expect(await absagen(port, GESANG, ICH, '')).toMatchObject({ ok: false, grund: 'konflikt' });
    expect(ct.geschrieben).toEqual([]);
  });

  it('der Planer hat den Platz gleich neu vergeben: trotzdem abgesagt – ich stehe nicht mehr da', async () => {
    const { ct, port } = nachbau([platz(753)]);
    const r = absagen(port, GESANG, ICH, '');
    // Nach dem Schreiben trägt jemand Anna ein (decline → frei → neu vergeben).
    const schreibe = port.schreibe.bind(port);
    port.schreibe = async (p, a) => {
      await schreibe(p, a);
      ct.plaetze[0] = { ...ct.plaetze[0], personId: 46, name: 'Anna' };
    };
    expect(await r).toMatchObject({ ok: true });
  });

  it('ohne Recht auf den Dienst ist der freie Platz danach unsichtbar: trotzdem abgesagt, Rückgängig mit der alten ID', async () => {
    const { ct, port } = nachbau([platz(753)]);
    ct.nurSichtbarFuer = ICH;
    const r = await absagen(port, GESANG, ICH, 'krank');
    expect(r).toEqual({ ok: true, platzId: 753, geschriebenAuf: 753 });
    expect(ct.geschrieben).toHaveLength(1);
    expect(letzteAus('abgesagt', r)).toEqual({ art: 'abgesagt', id: 753 });
  });

  it('unsichtbar heißt nur „Platz fehlt im lesbaren Termin“ – ist der Termin weg (404), bleibt es weg', async () => {
    const { ct, port } = nachbau([platz(753)]);
    ct.nurSichtbarFuer = ICH;
    const lesen = port.termin.bind(port);
    let n = 0;
    port.termin = (id) => (++n === 2 ? Promise.reject(new Fehler(404)) : lesen(id));
    expect(await absagen(port, GESANG, ICH, '')).toEqual({ ok: false, grund: 'weg' });
  });

  it('Absagen nicht erlaubt (403) → kein-recht', async () => {
    const { ct, port } = nachbau([platz(753)]);
    ct.schreibenFehler = 403;
    expect(await absagen(port, GESANG, ICH, '')).toEqual({ ok: false, grund: 'kein-recht' });
  });
});

describe('rückgängig', () => {
  it('nach einer Zusage: undo mit der ID der Zusage, ich bin wieder angefragt', async () => {
    const { ct, port } = nachbau([platz(753)]);
    const z = await zusagen(port, GESANG, ICH);
    const r = await rueckgaengig(port, GESANG, ICH, letzteAus('zugesagt', z)!);
    expect(ct.geschrieben.at(-1)).toEqual({
      pfad: '/events/166/servicerequests/900/undo',
      method: 'POST',
      json: { personId: ICH },
    });
    expect(r).toMatchObject({ ok: true, platzId: 900 });
    expect(ct.plaetze[0]).toMatchObject({ personId: ICH, isAccepted: false });
  });

  it('nach einer Absage: undo mit der URSPRÜNGLICHEN ID, nicht dem neuen leeren Platz', async () => {
    const { ct, port } = nachbau([platz(753)]);
    const a = await absagen(port, GESANG, ICH, 'krank');
    const r = await rueckgaengig(port, GESANG, ICH, letzteAus('abgesagt', a)!);
    expect(ct.geschrieben.at(-1)?.pfad).toBe('/events/166/servicerequests/753/undo');
    expect(r).toMatchObject({ ok: true, platzId: 753 });
    expect(ct.plaetze[0]).toMatchObject({ id: 753, personId: ICH, isAccepted: false });
  });

  it('ohne Recht auf den Dienst: nach einer Absage ist der Platz unsichtbar – undo trotzdem, danach wieder angefragt', async () => {
    const { ct, port } = nachbau([platz(753)]);
    ct.nurSichtbarFuer = ICH;
    const a = await absagen(port, GESANG, ICH, 'krank');
    const r = await rueckgaengig(port, GESANG, ICH, letzteAus('abgesagt', a)!);
    expect(ct.geschrieben.at(-1)).toEqual({
      pfad: '/events/166/servicerequests/753/undo',
      method: 'POST',
      json: { personId: ICH },
    });
    expect(r).toMatchObject({ ok: true, platzId: 753 });
    expect(ct.plaetze[0]).toMatchObject({ id: 753, personId: ICH, isAccepted: false });
  });

  it('ohne Recht, nach einer Absage zu spät (400) → zu-spaet; nach einer ZUSAGE ist unsichtbar weiterhin weg', async () => {
    const a = nachbau([platz(753)]);
    a.ct.nurSichtbarFuer = ICH;
    const ab = await absagen(a.port, GESANG, ICH, '');
    a.ct.undoZuSpaet = true;
    expect(await rueckgaengig(a.port, GESANG, ICH, letzteAus('abgesagt', ab)!)).toEqual({
      ok: false,
      grund: 'zu-spaet',
    });
    // Zusage, danach hat der Planer einen anderen eingetragen: Den Platz sieht man nicht mehr – nichts schreiben.
    const b = nachbau([platz(753)]);
    b.ct.nurSichtbarFuer = ICH;
    const z = await zusagen(b.port, GESANG, ICH);
    b.ct.plaetze[0] = { ...b.ct.plaetze[0], personId: 46, name: 'Anna' };
    const n = b.ct.geschrieben.length;
    expect(await rueckgaengig(b.port, GESANG, ICH, letzteAus('zugesagt', z)!)).toEqual({
      ok: false,
      grund: 'weg',
    });
    expect(b.ct.geschrieben).toHaveLength(n);
  });

  it('nach zehn Minuten (400) → zu-spaet, nichts verändert', async () => {
    const { ct, port } = nachbau([platz(753)]);
    const z = await zusagen(port, GESANG, ICH);
    ct.undoZuSpaet = true;
    expect(await rueckgaengig(port, GESANG, ICH, letzteAus('zugesagt', z)!)).toEqual({
      ok: false,
      grund: 'zu-spaet',
    });
    expect(ct.plaetze[0]).toMatchObject({ isAccepted: true });
  });

  it('der freie Platz ist schon neu vergeben: Konflikt, kein undo', async () => {
    const { ct, port } = nachbau([platz(753)]);
    const a = await absagen(port, GESANG, ICH, '');
    ct.plaetze[0] = { ...ct.plaetze[0], personId: 46, name: 'Anna' };
    const n = ct.geschrieben.length;
    expect(await rueckgaengig(port, GESANG, ICH, letzteAus('abgesagt', a)!)).toMatchObject({
      ok: false,
      grund: 'konflikt',
    });
    expect(ct.geschrieben).toHaveLength(n);
  });
});

describe('mitAntworten – zehn Minuten lang sichtbar, mit „Rückgängig“', () => {
  const ort = { serviceId: 9, index: 1 };
  const gesang = mein('Gesang', false, { ort });
  const antwort = (art: 'zugesagt' | 'abgesagt', seit: number): Antwort => ({
    art,
    seit,
    letzte: { art, id: 900 },
    mein: gesang,
  });
  const JETZT = 1_000_000_000;

  it('eine Zusage hängt am Dienst (zugesagt), solange sie jünger als zehn Minuten ist', () => {
    const z = [zeile(166, 'Gottesdienst', '2027-01-10', { meine: [gesang] })];
    const m = new Map([[antwortSchluessel(166, ort), antwort('zugesagt', JETZT - 60_000)]]);
    expect(mitAntworten(z, m, JETZT)[0].meine).toEqual([
      { ...gesang, zugesagt: true, antwort: antwort('zugesagt', JETZT - 60_000) },
    ]);
    expect(mitAntworten(z, m, JETZT + RUECKGAENGIG_MS)[0].meine).toEqual([gesang]);
  });

  it('eine Absage bleibt sichtbar, auch wenn die neu geladenen Termine den Dienst nicht mehr kennen', () => {
    const z = [zeile(166, 'Gottesdienst', '2027-01-10', { meine: [] })];
    const m = new Map([[antwortSchluessel(166, ort), antwort('abgesagt', JETZT)]]);
    expect(mitAntworten(z, m, JETZT)[0].meine).toEqual([
      { ...gesang, zugesagt: false, antwort: antwort('abgesagt', JETZT) },
    ]);
  });

  it('nur der passende Termin und Platz – andere bleiben, wie sie sind', () => {
    const ton = mein('Ton', false, { ort: { serviceId: 6, index: null } });
    const z = [
      zeile(166, 'Gottesdienst', '2027-01-10', { meine: [ton, gesang] }),
      zeile(167, 'Gebetsabend', '2027-01-12', { meine: [gesang] }),
    ];
    const m = new Map([[antwortSchluessel(166, ort), antwort('zugesagt', JETZT)]]);
    const r = mitAntworten(z, m, JETZT);
    expect(r[0].meine.map((d) => [d.dienst, d.zugesagt, !!d.antwort])).toEqual([
      ['Ton', false, false],
      ['Gesang', true, true],
    ]);
    expect(r[1]).toBe(z[1]);
  });
});
