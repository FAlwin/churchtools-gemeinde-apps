import { describe, expect, it } from 'vitest';
import { nachbau } from './einteilen.testutil';
import { KAT, MODUL, speicher } from './entwuerfe.testutil';
import type { PersonenAntworten } from './personenAntworten';
import type { GruppenStand, PersonenDaten } from './personenDaten';
import type { RohPlatz, RohTermin } from './termine';
import { zeile } from './zeile.testutil';
import {
  alleAntwortenLesen,
  antwortenZusammen,
  eigeneAntwortenSchreiben,
  vertretungenZusammen,
  vertretungMarkieren,
  type Antworten,
  type Vertretung,
} from './verfuegbarkeit';
import {
  abwesendAm,
  absageKommentar,
  eingeteiltAus,
  gesuchtGilt,
  leitungAus,
  leitungMail,
  offeneVertretungen,
  schilder,
  uebernehmen,
  vertretungBetreff,
  vertretungMail,
  vorschlaege,
} from './vertretung';

const HEUTE = '2026-11-21';
const TAG = '2026-12-13';
const TERMIN = 246;
const GESANG = 9;
const TON = 6;
const GRUPPE = 4; // Dienstgruppe Musik
const ANNA = 46;
const BEN = 47;
const FINN = 48;
const CLARA = 49;

const person = (id: number, name: string) => ({ id, name, bild: null, initialen: '' });
const NAMEN: Record<number, string> = {
  46: 'Anna Test',
  47: 'Ben Test',
  48: 'Finn Test',
  49: 'Clara Test',
  50: 'David Test',
  51: 'Ella Test',
  52: 'Greta Test',
  53: 'Hanna Test',
  54: 'Ida Test',
};
const MITGLIEDER = Object.entries(NAMEN).map(([id, name]) => person(Number(id), name));
const dienstName = (id: number) => (id === GESANG ? 'Gesang' : id === TON ? 'Ton' : undefined);

/** Antworten und Markierungen so, wie der Speicher sie erzeugt und liest (Schreiben → Lesen → Zusammenführen). */
async function gelesen(
  schreiber: { person: number; antworten: Antworten }[],
  markierungen: { person: number; vertretung: Vertretung }[] = [],
  sichtbar = true,
): Promise<PersonenAntworten> {
  const { port } = speicher();
  for (const s of schreiber)
    await eigeneAntwortenSchreiben(port, MODUL, [KAT], s.person, s.antworten, HEUTE);
  for (const m of markierungen) {
    const r = await vertretungMarkieren(
      port,
      MODUL,
      [KAT],
      m.person,
      { terminId: TERMIN, vertretung: m.vertretung },
      HEUTE,
    );
    expect(r).toMatchObject({ ok: true });
  }
  const r = await alleAntwortenLesen(port, MODUL, KAT);
  if (!r.ok) throw new Error('Lesen scheitert');
  const je = new Map([[KAT, r.wert]]);
  return {
    jePerson: antwortenZusammen(je),
    vertretungen: vertretungenZusammen(je),
    sichtbar: sichtbar ? new Set([GRUPPE]) : new Set(),
  };
}

const a = (
  z: 'ja' | 'vielleicht',
  extra: { notiz?: string; dienste?: number[] } = {},
): Antworten => ({
  [String(TERMIN)]: { a: z, tag: TAG, ...extra },
});

const basis = {
  gruppeId: GRUPPE,
  terminId: TERMIN,
  dienstId: GESANG,
  dienstName,
  ichId: ANNA,
  eingeteilt: new Set<number>(),
  abwesend: new Set<number>(),
};

describe('vorschlaege – wen Anna fragen kann', () => {
  it('Abschnitte Ja · Vielleicht · Ohne Antwort; Notiz dabei; nicht Anna, nicht Eingeteilte, nicht Nein/abwesend, nicht „nur andere Dienste“', async () => {
    const antworten = await gelesen([
      { person: ANNA, antworten: a('ja') }, // sie selbst
      { person: BEN, antworten: a('ja') },
      { person: FINN, antworten: a('ja', { notiz: 'nur bis 12 Uhr', dienste: [GESANG] }) },
      { person: CLARA, antworten: a('vielleicht', { notiz: 'falls niemand sonst kann' }) },
      { person: 52, antworten: a('ja', { dienste: [TON] }) }, // Greta: Ja, aber nur für Ton
      { person: 53, antworten: a('ja') }, // Hanna: Ja, aber abwesend (das ist das Nein)
      { person: 54, antworten: { '999': { a: 'ja', tag: TAG } } }, // Ida: Antwort zu einem ANDEREN Termin
    ]);
    const r = vorschlaege({
      ...basis,
      mitglieder: MITGLIEDER,
      antworten,
      eingeteilt: new Set([51]), // Ella ist am Tag schon eingeteilt
      abwesend: new Set([53]),
    });
    expect(r.art).toBe('liste');
    if (r.art !== 'liste') return;
    expect(r.ja.map((v) => [v.name, v.notiz])).toEqual([
      ['Ben Test', null],
      ['Finn Test', 'nur bis 12 Uhr'],
    ]);
    expect(r.vielleicht.map((v) => [v.name, v.notiz])).toEqual([
      ['Clara Test', 'falls niemand sonst kann'],
    ]);
    // David (keine Antwort) und Ida (nur zu einem anderen Termin) – „ohne Antwort zu DIESEM Termin“.
    expect(r.ohne.map((v) => v.name)).toEqual(['David Test', 'Ida Test']);
    expect(r.ohne.every((v) => v.a === null)).toBe(true);
    const alle = [...r.ja, ...r.vielleicht, ...r.ohne].map((v) => v.personId);
    for (const draussen of [ANNA, 51, 52, 53]) expect(alle).not.toContain(draussen);
  });

  it('eine Person in zwei Teams steht nur einmal da', async () => {
    const r = vorschlaege({
      ...basis,
      mitglieder: [person(BEN, 'Ben Test'), person(BEN, 'Ben Test')],
      antworten: await gelesen([{ person: BEN, antworten: a('ja') }]),
    });
    expect(r).toMatchObject({ art: 'liste', ja: [{ personId: BEN }] });
    expect(r.art === 'liste' && r.ja).toHaveLength(1);
  });

  it('Antworten nicht lesbar: nur das Team, keine Einordnung – „ohne Antwort“ wäre geraten; Abwesende fehlen trotzdem', async () => {
    const antworten = await gelesen([{ person: BEN, antworten: a('ja') }], [], false);
    const r = vorschlaege({
      ...basis,
      mitglieder: [person(BEN, 'Ben Test'), person(CLARA, 'Clara Test'), person(53, 'Hanna Test')],
      antworten,
      abwesend: new Set([53]),
    });
    expect(r).toEqual({
      art: 'ohneAntworten',
      team: [
        { personId: BEN, name: 'Ben Test', a: null, notiz: null },
        { personId: CLARA, name: 'Clara Test', a: null, notiz: null },
      ],
    });
  });
});

const stand = (o: Partial<Extract<GruppenStand, { art: 'da' }>> = {}): GruppenStand => ({
  art: 'da',
  mitglieder: [person(ANNA, 'Anna Test'), person(BEN, 'Ben Test'), person(FINN, 'Finn Test')],
  abwesenheiten: [],
  ...o,
});

describe('abwesendAm, eingeteiltAus, leitungAus', () => {
  const termin = { beginn: `${TAG}T08:00:00Z`, ende: `${TAG}T09:30:00Z`, tag: TAG };
  const abw = (personId: number, von: string, bis: string) => ({
    id: personId,
    personId,
    grund: 'Urlaub',
    startDate: von,
    endDate: bis,
    startTime: null,
    endTime: null,
  });

  it('abwesend ist, wen eine Abwesenheit am Termin deckt (decktTermin) – und ob man es überhaupt weiß', () => {
    const daten: PersonenDaten = new Map([
      [9, stand({ abwesenheiten: [abw(BEN, TAG, TAG), abw(FINN, '2026-12-14', '2026-12-20')] })],
    ]);
    expect(abwesendAm(daten, [9], termin)).toEqual({ personen: new Set([BEN]), bekannt: true });
    // Nicht sichtbar / nicht geladen / Fehler: man WEISS es nicht – nie als „niemand abwesend“ ausgeben.
    for (const s of [
      new Map([[9, stand({ abwesenheiten: 'nichtSichtbar' })]]),
      new Map([[9, { art: 'fehler', text: 'x', nochmal: true }]]),
      new Map<number, GruppenStand>(),
    ])
      expect(abwesendAm(s, [9], termin).bekannt).toBe(false);
  });

  it('eingeteilt: zugesagt und angefragt zählen; frei, Gast, „Namen verbergen“ nicht', () => {
    const t = (platz: RohPlatz[]): RohTermin => ({ id: 1, startDate: '', eventServices: platz });
    expect(
      eingeteiltAus([
        t([
          { serviceId: 9, personId: BEN, name: 'Ben', isAccepted: true },
          { serviceId: 6, personId: FINN, name: 'Finn', isAccepted: false },
          { serviceId: 9, personId: null, name: null },
          { serviceId: 9, personId: null, name: 'Lea (Gast)', isAccepted: true },
          { serviceId: 9, personId: -2, name: 'Versteckt', isAccepted: true },
          { serviceId: 9, personId: CLARA, name: null },
        ]),
      ]),
    ).toEqual(new Set([BEN, FINN]));
  });

  it('Leitung: nur Mitglieder mit Leitungsrolle, ohne die ausgenommenen, nach Namen', () => {
    const daten: PersonenDaten = new Map([
      [9, stand({ leitung: [FINN, ANNA, 99] })], // 99 ist nicht Mitglied (Rolle ohne Person) – fällt weg
      [10, stand({ leitung: [BEN], mitglieder: [person(BEN, 'Ben Test')] })],
    ]);
    expect(leitungAus(daten, [9, 10, 9], new Set([ANNA])).map((p) => p.name)).toEqual([
      'Ben Test',
      'Finn Test',
    ]);
    // Ohne Rollen im Stand (`leitung` fehlt) gibt es keine Leitung – nicht „alle“.
    expect(leitungAus(new Map([[9, stand()]]), [9], new Set())).toEqual([]);
  });
});

describe('Texte', () => {
  it('Absage-Kommentar nennt die Gefragten, ohne sie nur „Vertretung gesucht“', () => {
    expect(absageKommentar(['Ben Test', 'Finn Test'])).toBe(
      'Vertretung gesucht – gefragt: Ben Test, Finn Test',
    );
    expect(absageKommentar([])).toBe('Vertretung gesucht');
  });

  it('Betreff: Dienst und Tag kurz', () => {
    expect(vertretungBetreff('Gesang', TAG)).toBe('Vertretung gesucht: Gesang am So, 13.12.');
  });

  it('Mail an Gefragte: Vorname, Termin, Antwort-Satz, Nachricht maskiert, Knopf, „Gefragt wurden auch“', () => {
    const body = vertretungMail({
      empfaenger: 'Ben Test',
      von: 'Anna Test',
      dienst: 'Gesang',
      termin: { name: 'Gottesdienst', tag: TAG, uhrzeit: '10:00' },
      antwort: 'ja',
      nachricht: 'Bin krank <b>bitte</b>\nDanke & Gruß',
      andere: ['Finn Test'],
      link: 'https://ct.test/ccm/dienstplaner/#/',
    });
    expect(body).toContain('Hallo Ben,');
    expect(body).toContain(
      'Anna Test kann am <b>Sonntag, 13. Dezember (Gottesdienst, 10:00 Uhr)</b>',
    );
    expect(body).toContain('Du hast für den Tag „Ja“ gesagt.');
    expect(body).toContain('Bin krank &lt;b&gt;bitte&lt;/b&gt;<br>Danke &amp; Gruß');
    expect(body).not.toContain('<b>bitte</b>');
    expect(body).toContain('href="https://ct.test/ccm/dienstplaner/#/"');
    expect(body).toContain('Im Dienstplaner übernehmen');
    expect(body).toContain('Gefragt wurden auch: Finn Test.');
    // Ohne Antwort entfällt der Satz, ohne Nachricht der Absatz, ohne andere der Zusatz.
    const kahl = vertretungMail({
      empfaenger: 'David Test',
      von: 'Anna Test',
      dienst: 'Gesang',
      termin: { name: 'Gottesdienst', tag: TAG, uhrzeit: '10:00' },
      antwort: null,
      nachricht: '  ',
      andere: [],
      link: 'x',
    });
    expect(kahl).not.toContain('Du hast für den Tag');
    expect(kahl).not.toContain('„');
    expect(kahl).not.toContain('Gefragt wurden auch');
  });

  it('Mail an die Leitung: wer sucht, wer gefragt wurde, Kopie-Hinweis', () => {
    const body = leitungMail({
      empfaenger: 'Alwin Friesen',
      von: 'Anna Test',
      dienst: 'Gesang',
      termin: { name: 'Gottesdienst', tag: TAG, uhrzeit: '10:00' },
      gefragt: ['Ben Test', 'Finn Test'],
      nachricht: '',
      link: 'x',
    });
    expect(body).toContain('Hallo Alwin,');
    expect(body).toContain('Gefragt wurden: Ben Test, Finn Test.');
    expect(body).toContain('Das ist eine Kopie für dich.');
  });
});

const markierung = (extra: Partial<Vertretung> = {}): Vertretung => ({
  dienst: GESANG,
  gefragt: [BEN, FINN],
  seit: '2026-11-21T10:00:00.000Z',
  tag: TAG,
  name: 'Anna Test',
  gefragtNamen: ['Ben Test', 'Finn Test'],
  ...extra,
});

describe('gilt „Vertretung gesucht“ noch?', () => {
  const ok = { tag: TAG, heute: HEUTE, abgesagt: false, freiePlaetze: 1 };

  it('nur mit freiem Platz, nicht vergangen, nicht abgesagt – die Markierung allein reicht nie', () => {
    expect(gesuchtGilt(ok)).toBe(true);
    expect(gesuchtGilt({ ...ok, freiePlaetze: 0 })).toBe(false); // jemand hat übernommen
    expect(gesuchtGilt({ ...ok, tag: '2026-11-20' })).toBe(false);
    expect(gesuchtGilt({ ...ok, tag: HEUTE })).toBe(true); // heute zählt noch
    expect(gesuchtGilt({ ...ok, abgesagt: true })).toBe(false);
  });

  it('Schilder in Planen: Hinweis mit Namen; höchstens so viele wie freie Plätze; ohne Gefragte nur „hat abgesagt“', async () => {
    const m = await gelesen([], [{ person: ANNA, vertretung: markierung() }]);
    const o = {
      vertretungen: m.vertretungen,
      terminId: TERMIN,
      dienstId: GESANG,
      tag: TAG,
      heute: HEUTE,
      abgesagt: false,
      freiePlaetze: 1,
    };
    expect(schilder(o)).toEqual([
      { hinweis: 'Anna Test hat abgesagt · gefragt: Ben Test, Finn Test' },
    ]);
    expect(schilder({ ...o, freiePlaetze: 0 })).toEqual([]);
    expect(schilder({ ...o, dienstId: TON })).toEqual([]);
    expect(schilder({ ...o, terminId: 1 })).toEqual([]);
    const ohne = await gelesen(
      [],
      [{ person: ANNA, vertretung: markierung({ gefragt: [], gefragtNamen: [] }) }],
    );
    expect(schilder({ ...o, vertretungen: ohne.vertretungen })).toEqual([
      { hinweis: 'Anna Test hat abgesagt' },
    ]);
  });
});

describe('offeneVertretungen – „Für dich offen“ auf der Startseite', () => {
  const zeilen = [
    zeile(TERMIN, 'Gottesdienst', TAG, { freieDienste: [GESANG] }),
    zeile(300, 'Gebetsabend', '2026-12-20', { freieDienste: [] }),
  ];
  const o = (extra: Record<string, unknown> = {}) => ({
    zeilen,
    eigeneDienste: new Set([GESANG]),
    ichId: BEN,
    dienstName,
    heute: HEUTE,
    ...extra,
  });

  it('jeder aus dem Team sieht sie – auch wer nicht gefragt wurde –, mit Name und Dienst', async () => {
    const m = await gelesen([], [{ person: ANNA, vertretung: markierung() }]);
    // Clara wurde NICHT gefragt (gefragt: Ben, Finn) und sieht sie trotzdem.
    for (const ich of [BEN, CLARA]) {
      const r = offeneVertretungen(o({ vertretungen: m.vertretungen, ichId: ich }));
      expect(r.map((g) => [g.name, g.dienst, g.terminId, g.gefragt])).toEqual([
        ['Anna Test', 'Gesang', TERMIN, [BEN, FINN]],
      ]);
    }
  });

  it('nicht für Anna selbst, nicht außerhalb des Teams, nicht ohne freien Platz, nicht an abgesagten oder vergangenen Terminen', async () => {
    const m = await gelesen([], [{ person: ANNA, vertretung: markierung() }]);
    const v = m.vertretungen;
    expect(offeneVertretungen(o({ vertretungen: v, ichId: ANNA }))).toEqual([]);
    expect(offeneVertretungen(o({ vertretungen: v, eigeneDienste: new Set([TON]) }))).toEqual([]);
    // Übernommen: am Termin ist kein Platz des Dienstes mehr frei – die Markierung allein reicht nicht.
    expect(
      offeneVertretungen(
        o({ vertretungen: v, zeilen: [zeile(TERMIN, 'Gottesdienst', TAG, { freieDienste: [] })] }),
      ),
    ).toEqual([]);
    expect(
      offeneVertretungen(
        o({
          vertretungen: v,
          zeilen: [zeile(TERMIN, 'Gottesdienst', TAG, { freieDienste: [GESANG], abgesagt: true })],
        }),
      ),
    ).toEqual([]);
    expect(offeneVertretungen(o({ vertretungen: v, heute: '2026-12-14' }))).toEqual([]);
    // Termin nicht geladen.
    expect(offeneVertretungen(o({ vertretungen: v, zeilen: [] }))).toEqual([]);
    expect(offeneVertretungen(o({ vertretungen: undefined }))).toEqual([]);
  });
});

describe('uebernehmen – einen freien Platz selbst übernehmen', () => {
  const ICH = 47;
  const platz = (id: number, extra: Partial<RohPlatz> = {}): RohPlatz => ({
    id,
    serviceId: GESANG,
    index: 1,
    personId: null,
    name: null,
    isAccepted: false,
    permissions: { enterSelfIfFree: true },
    ...extra,
  });
  const besetzt = (id: number, extra: Partial<RohPlatz> = {}) =>
    platz(id, { personId: ANNA, name: 'Anna Test', isAccepted: true, ...extra });
  const ziel = { eventId: TERMIN, serviceId: GESANG, ichId: ICH };

  it('PUT auf den frisch gelesenen freien Platz, nachgelesen: ich stehe zugesagt dort', async () => {
    const { ct, port } = nachbau([platz(700)]);
    expect(await uebernehmen(port, ziel)).toEqual({ ok: true });
    expect(ct.geschrieben).toEqual([
      {
        pfad: `/persons/${ICH}/servicerequests/700`,
        method: 'PUT',
        json: { isAccepted: true },
      },
    ]);
    expect(ct.plaetze[0]).toMatchObject({ personId: ICH, isAccepted: true });
  });

  it('nimmt den freien Platz des Dienstes – nicht den eines anderen Dienstes, nicht den besetzten', async () => {
    const { ct, port } = nachbau([
      besetzt(700),
      platz(701, { serviceId: TON, index: null }),
      platz(702, { index: 2 }),
    ]);
    expect(await uebernehmen(port, ziel)).toEqual({ ok: true });
    expect(ct.geschrieben.map((g) => g.pfad)).toEqual([`/persons/${ICH}/servicerequests/702`]);
  });

  it('kein Platz des Dienstes mehr frei: „besetzt“ (schon übernommen), nichts geschrieben', async () => {
    const { ct, port } = nachbau([besetzt(700)]);
    expect(await uebernehmen(port, ziel)).toEqual({ ok: false, grund: 'besetzt' });
    expect(ct.geschrieben).toEqual([]);
  });

  it('ich stehe schon zugesagt dort (z. B. gerade schon übernommen): Erfolg ohne Schreiben', async () => {
    const { ct, port } = nachbau([besetzt(700, { personId: ICH, name: 'Ben Test' })]);
    expect(await uebernehmen(port, ziel)).toEqual({ ok: true });
    expect(ct.geschrieben).toEqual([]);
  });

  it('enterSelfIfFree false: kein-recht, ohne es zu versuchen; fehlt die Angabe, entscheidet ChurchTools (403 → kein-recht)', async () => {
    const a = nachbau([platz(700, { permissions: { enterSelfIfFree: false } })]);
    expect(await uebernehmen(a.port, ziel)).toEqual({ ok: false, grund: 'kein-recht' });
    expect(a.ct.geschrieben).toEqual([]);

    const b = nachbau([platz(700, { permissions: null })]);
    b.ct.selbstEintragenVerboten = true;
    expect(await uebernehmen(b.port, ziel)).toEqual({ ok: false, grund: 'kein-recht' });
    expect(b.ct.geschrieben).toHaveLength(1); // versucht, ChurchTools hat verweigert
  });

  it('403 beim Schreiben (Recht fehlt trotz Angabe): kein-recht, der Platz bleibt frei', async () => {
    const { ct, port } = nachbau([platz(700)]);
    ct.selbstEintragenVerboten = true;
    expect(await uebernehmen(port, ziel)).toEqual({ ok: false, grund: 'kein-recht' });
    expect(ct.plaetze[0].personId).toBeNull();
  });

  it('401 beim Lesen oder Schreiben: abgemeldet; Termin weg (404): weg', async () => {
    const lesen = nachbau([platz(700)]);
    lesen.ct.lesenFehler.push(401);
    expect(await uebernehmen(lesen.port, ziel)).toEqual({ ok: false, grund: 'abgemeldet' });
    const schreiben = nachbau([platz(700)]);
    schreiben.ct.schreibenFehler = 401;
    expect(await uebernehmen(schreiben.port, ziel)).toEqual({ ok: false, grund: 'abgemeldet' });
    const weg = nachbau([platz(700)]);
    weg.ct.lesenFehler.push(404);
    expect(await uebernehmen(weg.port, ziel)).toEqual({ ok: false, grund: 'weg' });
  });

  it('vorübergehend (keine Antwort, 503): nicht bestätigt, nichts wiederholt – aber angekommen? dann nachgelesen Erfolg', async () => {
    const a = nachbau([platz(700)]);
    a.ct.schreibenFehler = null;
    expect(await uebernehmen(a.port, ziel)).toEqual({ ok: false, grund: 'voruebergehend' });
    expect(a.ct.geschrieben).toHaveLength(1);
    const b = nachbau([platz(700)]);
    b.ct.schreibenFehler = 503;
    b.ct.trotzdemSchreiben = true;
    expect(await uebernehmen(b.port, ziel)).toEqual({ ok: true });
    const c = nachbau([platz(700)]);
    c.ct.lesenFehler.push(503);
    expect(await uebernehmen(c.port, ziel)).toEqual({ ok: false, grund: 'voruebergehend' });
    expect(c.ct.geschrieben).toEqual([]);
  });

  it('jemand war schneller (zwischen Lesen und Schreiben besetzt): „besetzt“, der andere bleibt stehen', async () => {
    const { ct, port } = nachbau([platz(700)]);
    ct.dazwischen = () => {
      ct.plaetze[0] = besetzt(777, { personId: FINN, name: 'Finn Test' });
    };
    expect(await uebernehmen(port, ziel)).toEqual({ ok: false, grund: 'besetzt' });
    expect(ct.plaetze[0]).toMatchObject({ personId: FINN });
  });

  it('ChurchTools sagt ja, nachgelesen steht dort niemand: nicht-angekommen – kein Erfolg', async () => {
    const { ct, port } = nachbau([platz(700)]);
    port.schreibe = (pfad, auftrag) => {
      ct.geschrieben.push({ pfad, method: auftrag.method, json: auftrag.json });
      return Promise.resolve(); // 200, aber nichts geändert
    };
    expect(await uebernehmen(port, ziel)).toEqual({ ok: false, grund: 'nicht-angekommen' });
  });
});
