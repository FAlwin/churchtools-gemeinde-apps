import { describe, expect, it } from 'vitest';
import type { Wert } from '../ct/modulDaten';
import { Fehler, nachbau } from './einteilen.testutil';
import { KAT, MODUL, speicher } from './entwuerfe.testutil';
import { inhaltAusWerten, ortSchluessel, type Entwurf } from './entwuerfe';
import { sende, zielAus, type SendeEintrag, type SendeErgebnis } from './senden';
import type { RohPlatz } from './termine';

// Ein Termin (7) mit drei freien Plätzen: Ton, Licht und Gesang 1.
const PLAETZE: RohPlatz[] = [
  { id: 1, serviceId: 6, index: null, personId: null, name: null },
  { id: 2, serviceId: 7, index: null, personId: null, name: null },
  { id: 3, serviceId: 9, index: 1, personId: null, name: null },
];

const entwurf = (serviceId: number, x: Partial<Entwurf> = {}): Entwurf => ({
  ort: { eventId: 7, serviceId, index: serviceId === 9 ? 1 : null },
  ziel: { art: 'person', personId: 46, name: 'Anna Test' },
  modus: 'anfrage',
  gesehen: { art: 'frei' },
  von: { personId: 1, name: 'Alwin' },
  zeit: '2026-10-15T08:00:00.000Z',
  version: 1,
  ...x,
});
const wert = (id: number, e: Entwurf): Wert => ({
  id,
  dataCategoryId: KAT,
  value: JSON.stringify({ art: 'dienstplaner-entwurf', fassung: 1, ...e }),
});

/** ChurchTools und Schublade zusammen, mit den Entwürfen darin. */
function aufbau(entwuerfe: Entwurf[], plaetze = PLAETZE) {
  const c = nachbau(plaetze);
  const sp = speicher(entwuerfe.map((e, i) => wert(100 + i, e)));
  const eintraege: SendeEintrag[] = entwuerfe.map((e) => ({ entwurf: e, kategorie: KAT }));
  const anschluss = { dienst: c.port, entwurf: sp.port, modul: MODUL };
  const platz = (serviceId: number) => c.ct.plaetze.find((p) => p.serviceId === serviceId)!;
  const offen = () => [...inhaltAusWerten(sp.s.werte).je.keys()];
  return { c, sp, eintraege, anschluss, platz, offen };
}

describe('zielAus', () => {
  it('Anfrage → angefragt, direkt → zugesagt, Gast → Name', () => {
    expect(zielAus(entwurf(6))).toEqual({ art: 'anfrage', personId: 46 });
    expect(zielAus(entwurf(6, { modus: 'direkt' }))).toEqual({ art: 'zusage', personId: 46 });
    expect(zielAus(entwurf(6, { ziel: { art: 'gast', name: 'Max' }, modus: 'direkt' }))).toEqual({
      art: 'gast',
      name: 'Max',
    });
  });
});

describe('sende', () => {
  it('Anfrage, direkt und Gast: eingeteilt, nachgelesen – danach (und erst danach) sind die Entwürfe weg', async () => {
    const a = aufbau([
      entwurf(6),
      entwurf(7, { modus: 'direkt' }),
      entwurf(9, { ziel: { art: 'gast', name: 'Max' } }),
    ]);
    // Reihenfolge prüfen: Beim ersten Löschen eines Entwurfs muss dessen Platz schon eingeteilt sein.
    let tonBeimLoeschen: unknown = 'nicht gelöscht';
    a.sp.s.vorher = (auftrag) => {
      if (auftrag.method === 'DELETE' && tonBeimLoeschen === 'nicht gelöscht') {
        tonBeimLoeschen = a.platz(6).personId;
      }
    };
    const r = await sende(a.eintraege, a.anschluss);
    expect(r).toEqual([{ art: 'gesendet' }, { art: 'gesendet' }, { art: 'gesendet' }]);
    expect(tonBeimLoeschen).toBe(46);
    expect(
      [a.platz(6), a.platz(7), a.platz(9)].map((p) => [p.personId, p.name, p.isAccepted]),
    ).toEqual([
      [46, 'Person 46', false],
      [46, 'Person 46', true],
      [null, 'Max', true],
    ]);
    expect(a.offen()).toEqual([]);
  });

  it('Fortschritt: `melde` nach jedem Eintrag, in Reihenfolge', async () => {
    const a = aufbau([entwurf(6), entwurf(7)]);
    const gemeldet: [number, SendeErgebnis][] = [];
    await sende(a.eintraege, a.anschluss, (i, e) => gemeldet.push([i, e]));
    expect(gemeldet).toEqual([
      [0, { art: 'gesendet' }],
      [1, { art: 'gesendet' }],
    ]);
  });

  it('Platz in ChurchTools inzwischen belegt → nicht gesendet (Konflikt, mit „jetzt“), nichts überschrieben; die anderen gehen weiter', async () => {
    const a = aufbau(
      [entwurf(6), entwurf(7)],
      [
        { id: 1, serviceId: 6, index: null, personId: 50, name: 'Clara', isAccepted: false },
        PLAETZE[1],
      ],
    );
    const r = await sende(a.eintraege, a.anschluss);
    expect(r).toEqual([
      { art: 'nicht-gesendet', grund: 'konflikt', jetzt: { art: 'anfrage', personId: 50 } },
      { art: 'gesendet' },
    ]);
    expect(a.platz(6).personId).toBe(50);
    expect(a.offen()).toEqual([ortSchluessel(entwurf(6).ort)]);
  });

  it('Entwurf inzwischen von einem anderen Planer geändert → nicht gesendet, kein Schreiben in ChurchTools', async () => {
    const a = aufbau([entwurf(6, { version: 2 })]);
    const r = await sende([{ entwurf: entwurf(6, { version: 1 }), kategorie: KAT }], a.anschluss);
    expect(r).toEqual([{ art: 'nicht-gesendet', grund: 'entwurf-geaendert' }]);
    expect(a.c.ct.geschrieben).toEqual([]);
  });

  it('abgemeldet → anhalten: der Rest wird gar nicht erst versucht und bleibt Entwurf', async () => {
    const a = aufbau([entwurf(6), entwurf(7), entwurf(9)]);
    a.c.ct.lesenFehler = [401];
    const gemeldet: number[] = [];
    const r = await sende(a.eintraege, a.anschluss, (i) => gemeldet.push(i));
    expect(r).toEqual([
      { art: 'nicht-gesendet', grund: 'abgemeldet' },
      { art: 'nicht-versucht' },
      { art: 'nicht-versucht' },
    ]);
    expect(gemeldet).toEqual([0]);
    expect(a.offen()).toHaveLength(3);
  });

  it('vorübergehend (z. B. Drosselung) → anhalten; nie ein zweiter Schreibversuch', async () => {
    const a = aufbau([entwurf(6), entwurf(7)]);
    a.c.ct.schreibenFehler = 429;
    const r = await sende(a.eintraege, a.anschluss);
    expect(r).toEqual([
      { art: 'nicht-gesendet', grund: 'voruebergehend', jetzt: { art: 'frei' } },
      { art: 'nicht-versucht' },
    ]);
    expect(a.c.ct.geschrieben).toHaveLength(1);
    expect(a.offen()).toHaveLength(2);
  });

  it('vorübergehend, aber doch angekommen → gesendet (nachgelesen), Entwurf weg', async () => {
    const a = aufbau([entwurf(6)]);
    a.c.ct.schreibenFehler = 504;
    a.c.ct.trotzdemSchreiben = true;
    expect(await sende(a.eintraege, a.anschluss)).toEqual([{ art: 'gesendet' }]);
    expect(a.offen()).toEqual([]);
  });

  it('kein Recht bzw. Platz weg → nicht gesendet, aber weitermachen', async () => {
    const a = aufbau([entwurf(6), entwurf(8), entwurf(7)]);
    a.c.ct.lesenFehler = [403];
    const r = await sende(a.eintraege, a.anschluss);
    expect(r).toEqual([
      { art: 'nicht-gesendet', grund: 'kein-recht' },
      { art: 'nicht-gesendet', grund: 'weg' }, // Dienst 8 gibt es am Termin nicht
      { art: 'gesendet' },
    ]);
  });

  it('Entfernen des Entwurfs scheitert nach dem Einteilen → trotzdem gesendet, „Entwurf blieb“', async () => {
    const a = aufbau([entwurf(6)]);
    a.sp.s.vorher = (auftrag) => {
      if (auftrag.method === 'DELETE') throw new Fehler(503);
    };
    expect(await sende(a.eintraege, a.anschluss)).toEqual([
      { art: 'gesendet', entwurfBlieb: 'voruebergehend' },
    ]);
    expect(a.platz(6).personId).toBe(46);
    expect(a.offen()).toHaveLength(1);
  });

  it('die Schublade wird einmal gelesen, nicht je Eintrag; nicht lesbar → nicht gesendet, vorübergehend hält an', async () => {
    const a = aufbau([entwurf(6), entwurf(7)]);
    let gelesen = 0;
    const daten = a.sp.port.daten.bind(a.sp.port);
    a.sp.port.daten = <T>(pfad: string) => {
      gelesen++;
      return daten<T>(pfad);
    };
    await sende(a.eintraege, a.anschluss);
    // Einmal vorab für die Fassungen, danach je Entwurf zweimal beim Entfernen (frisch lesen, nachlesen).
    expect(gelesen).toBe(1 + 2 * 2);

    const b = aufbau([entwurf(6), entwurf(7)]);
    b.sp.s.lesenWirft = new Fehler(502);
    expect(await sende(b.eintraege, b.anschluss)).toEqual([
      { art: 'nicht-gesendet', grund: 'voruebergehend' },
      { art: 'nicht-versucht' },
    ]);
    expect(b.c.ct.geschrieben).toEqual([]);
  });

  it('Schublade meldet „kein Recht“ bzw. „abgemeldet“ → genau das; bei „abgemeldet“ wird angehalten', async () => {
    const a = aufbau([entwurf(6), entwurf(7)]);
    a.sp.s.lesenWirft = new Fehler(403);
    expect(await sende(a.eintraege, a.anschluss)).toEqual([
      { art: 'nicht-gesendet', grund: 'kein-recht' },
      { art: 'nicht-gesendet', grund: 'kein-recht' },
    ]);
    const b = aufbau([entwurf(6), entwurf(7)]);
    b.sp.s.lesenWirft = new Fehler(401);
    expect(await sende(b.eintraege, b.anschluss)).toEqual([
      { art: 'nicht-gesendet', grund: 'abgemeldet' },
      { art: 'nicht-versucht' },
    ]);
    expect([...a.c.ct.geschrieben, ...b.c.ct.geschrieben]).toEqual([]);
  });
});
