import { describe, expect, it } from 'vitest';
import { ableiten, type Block } from './dokument';
import type { ProtokollKopf } from './speicher';
import { sitzungenOrdnen, type Termin } from './sitzungen';
import {
  abgelehntAm,
  abgelehntNoch,
  abgelehntSichtbar,
  ablehnen,
  annehmen,
  aufsNaechsteMal,
  bereichOffen,
  darfAendern,
  einfuegeStelle,
  imProtokoll,
  istVorschlag,
  NAECHSTE,
  neuerVorschlag,
  offeneFuer,
  SchonEntschieden,
  schonImDokument,
  uebernommenFuer,
  vorschlaegeOrdnen,
  vorschlagAendern,
  vorschlagBloecke,
  zielSitzung,
  zielVon,
  zumEinfuegen,
  zurueckziehen,
  type Vorschlag,
} from './vorschlaege';

const ZONE = 'Europe/Berlin';
const HEUTE = '2026-11-06';
const ANNA = { person: 7, name: 'Anna Wiens' };
const LEITUNG = { person: 1, name: 'Alwin Friesen' };
const AM = '2026-11-06T10:00:00Z';

const termin = (id: number, beginn: string): Termin => ({
  kalender: 4,
  id,
  titel: 'Leitungssitzung',
  beginn,
  anfragen: [{ person: 1, antwort: 'zugesagt' }],
});
const kopf = (teil: Partial<ProtokollKopf>): ProtokollKopf => ({
  art: 'protokoll',
  fassung: 1,
  sitzung: 'p1',
  titel: 'Leitungssitzung',
  status: 'entwurf',
  beginn: '2026-11-11T18:00:00Z',
  termin: { kalender: 4, id: 11 },
  treffen: null,
  freigabe: null,
  sperre: null,
  stand: 'x',
  ...teil,
});
// Die Sitzungen so, wie die App sie bekommt – aus `sitzungenOrdnen`, nicht von Hand.
const kommend = (q: { termine?: Termin[]; koepfe?: ProtokollKopf[] }) =>
  sitzungenOrdnen({
    termine: q.termine ?? [],
    treffen: [],
    koepfe: q.koepfe ?? [],
    heute: HEUTE,
    zeitzone: ZONE,
  }).kommend;
const T11 = termin(11, '2026-11-11T18:00:00Z');
const T12 = termin(12, '2026-12-09T18:00:00Z');

const vorschlag = (teil: Partial<Parameters<typeof neuerVorschlag>[0]> = {}): Vorschlag =>
  neuerVorschlag({
    id: 'v1',
    gruppe: 194,
    titel: 'Beamer-Halterung',
    text: '',
    ziel: NAECHSTE,
    ich: ANNA,
    am: AM,
    ...teil,
  });

describe('Vorschlag anlegen und erkennen', () => {
  it('neu ist offen, mit Namen und Verlauf; Titel und Text getrimmt', () => {
    const v = vorschlag({ titel: '  Thema  ', text: ' Text ' });
    expect(v).toMatchObject({
      art: 'vorschlag',
      stand: 'offen',
      titel: 'Thema',
      text: 'Text',
      von: 7,
      name: 'Anna Wiens',
      grund: '',
      sitzung: null,
    });
    expect(v.verlauf).toEqual([{ am: AM, von: 7, name: 'Anna Wiens', art: 'angelegt' }]);
    expect(istVorschlag(v)).toBe(true);
  });

  it('erkennt fremde Werte nicht als Vorschlag (To-Do, kaputtes Ziel)', () => {
    expect(istVorschlag({ ...vorschlag(), art: 'aufgabe' })).toBe(false);
    expect(istVorschlag({ ...vorschlag(), ziel: { art: 'sitzung' } })).toBe(false);
    expect(istVorschlag({ ...vorschlag(), stand: 'weg' })).toBe(false);
    expect(istVorschlag(null)).toBe(false);
  });
});

describe('Zu welcher Sitzung gehört er?', () => {
  it('„Nächste Sitzung“ ohne festgelegte → null; sobald eine festgelegt ist → diese', () => {
    expect(zielSitzung(vorschlag(), [], HEUTE, ZONE)).toBeNull();
    const k = kommend({ termine: [T11, T12] });
    expect(zielSitzung(vorschlag(), k, HEUTE, ZONE)?.termin?.id).toBe(11);
  });

  it('eine bestimmte Sitzung bleibt auch nach dem Beginnen des Protokolls dieselbe', () => {
    const vorher = kommend({ termine: [T11, T12] });
    const v = vorschlag({ ziel: zielVon(vorher[1]) });
    expect(zielSitzung(v, vorher, HEUTE, ZONE)?.termin?.id).toBe(12);
    const nachher = kommend({
      termine: [T11, T12],
      koepfe: [kopf({ sitzung: 'p12', beginn: T12.beginn, termin: { kalender: 4, id: 12 } })],
    });
    expect(zielSitzung(v, nachher, HEUTE, ZONE)?.kopf?.sitzung).toBe('p12');
  });

  it('fällt die Sitzung weg (abgesagt), rutscht er zur nächsten danach', () => {
    const v = vorschlag({ ziel: zielVon(kommend({ termine: [T11, T12] })[0]) });
    expect(zielSitzung(v, kommend({ termine: [T12] }), HEUTE, ZONE)?.termin?.id).toBe(12);
    expect(zielSitzung(v, [], HEUTE, ZONE)).toBeNull();
  });

  it('„Nächste Sitzung“ landet nicht in einem begonnenen Protokoll von gestern', () => {
    const k = kommend({
      termine: [T11],
      koepfe: [kopf({ sitzung: 'alt', beginn: '2026-11-05T18:00:00Z', termin: null })],
    });
    expect(k[0].kopf?.sitzung).toBe('alt');
    expect(zielSitzung(vorschlag(), k, HEUTE, ZONE)?.termin?.id).toBe(11);
  });

  it('für das Protokoll von gestern ausdrücklich gewählt → bleibt dort', () => {
    const k = kommend({
      termine: [T11],
      koepfe: [kopf({ sitzung: 'alt', beginn: '2026-11-05T18:00:00Z', termin: null })],
    });
    const v = vorschlag({ ziel: zielVon(k[0]) });
    expect(zielSitzung(v, k, HEUTE, ZONE)?.kopf?.sitzung).toBe('alt');
  });
});

describe('Stände', () => {
  const k = kommend({ termine: [T11, T12] });

  it('ändern und zurückziehen nur solange offen', () => {
    const v = vorschlag();
    const g = vorschlagAendern(v, { titel: 'Neu', text: 'x', ziel: zielVon(k[1]) }, ANNA, AM);
    expect(g).toMatchObject({ titel: 'Neu', text: 'x', stand: 'offen' });
    expect(g.verlauf.at(-1)?.art).toBe('geaendert');
    expect(zurueckziehen(g, ANNA, AM).stand).toBe('zurueckgezogen');
    const ab = ablehnen(v, ' Nicht jetzt ', LEITUNG, AM);
    expect(ab).toMatchObject({ stand: 'abgelehnt', grund: 'Nicht jetzt' });
    expect(() => vorschlagAendern(ab, { titel: 'x', text: '', ziel: NAECHSTE }, ANNA, AM)).toThrow(
      SchonEntschieden,
    );
    expect(() => zurueckziehen(ab, ANNA, AM)).toThrow(SchonEntschieden);
    expect(() => ablehnen(ab, '', LEITUNG, AM)).toThrow(SchonEntschieden);
  });

  it('darfAendern: nur wer vorschlug, nur offen', () => {
    const v = vorschlag();
    expect(darfAendern(v, 7)).toBe(true);
    expect(darfAendern(v, 1)).toBe(false);
    expect(darfAendern(ablehnen(v, '', LEITUNG, AM), 7)).toBe(false);
  });

  it('annehmen merkt die Sitzung vor; „Nächstes Mal“ schiebt hinter sie und macht ihn wieder offen', () => {
    const an = annehmen(vorschlag(), k[0], LEITUNG, AM);
    expect(an.stand).toBe('angenommen');
    expect(zielSitzung(an, k, HEUTE, ZONE)).toBe(k[0]);
    const weiter = aufsNaechsteMal(an, k[0], LEITUNG, AM);
    expect(weiter.stand).toBe('offen');
    expect(zielSitzung(weiter, k, HEUTE, ZONE)).toBe(k[1]);
    // Hinter der letzten festgelegten: „Nächste Sitzung“ (noch nicht festgelegt).
    expect(zielSitzung(aufsNaechsteMal(weiter, k[1], LEITUNG, AM), k, HEUTE, ZONE)).toBeNull();
  });

  it('im Protokoll vermerken ist beim zweiten Mal ohne Wirkung', () => {
    const v = imProtokoll(vorschlag(), 'p1', LEITUNG, AM);
    expect(v).toMatchObject({ stand: 'imProtokoll', sitzung: 'p1' });
    expect(imProtokoll(v, 'p1', LEITUNG, '2026-11-07T00:00:00Z')).toBe(v);
  });
});

describe('Karte „Vorschläge“ (W8c: nur Offene)', () => {
  it('ordnet die offenen nach Sitzung, dann „Nächste Sitzung“ – alles Entschiedene steht nicht darin', () => {
    const k = kommend({ termine: [T11, T12] });
    const a = vorschlag({ id: 'a', ziel: zielVon(k[1]) });
    const b = vorschlag({ id: 'b' });
    const c = aufsNaechsteMal(vorschlag({ id: 'c' }), k[1], LEITUNG, AM);
    const d = zurueckziehen(vorschlag({ id: 'd' }), ANNA, AM);
    const e = ablehnen(vorschlag({ id: 'e', ziel: zielVon(k[0]) }), 'nein', LEITUNG, AM);
    const f = annehmen(vorschlag({ id: 'f' }), k[0], LEITUNG, AM);
    const g = imProtokoll(vorschlag({ id: 'g', ziel: zielVon(k[0]) }), 'p1', LEITUNG, AM);
    const o = vorschlaegeOrdnen([a, b, c, d, e, f, g], k, HEUTE, ZONE);
    expect(
      o.gruppen.map((x) => [x.sitzung?.termin?.id ?? null, x.vorschlaege.map((v) => v.id)]),
    ).toEqual([
      [11, ['b']],
      [12, ['a']],
      [null, ['c']],
    ]);
  });
});

describe('Übernommene (Marke an der Sitzung)', () => {
  const k = kommend({ termine: [T11, T12], koepfe: [kopf({})] });

  it('zählt vorgemerkte (angenommen) und schon eingefügte (im Protokoll) der Sitzung – sonst nichts', () => {
    const an = annehmen(vorschlag({ id: 'a' }), k[0], LEITUNG, AM);
    const imP = imProtokoll(vorschlag({ id: 'i', ziel: zielVon(k[0]) }), 'p1', LEITUNG, AM);
    const andere = annehmen(vorschlag({ id: 'x' }), k[1], LEITUNG, AM);
    const offen = vorschlag({ id: 'o' });
    const weg = ablehnen(vorschlag({ id: 'w', ziel: zielVon(k[0]) }), '', LEITUNG, AM);
    const liste = [an, imP, andere, offen, weg];
    expect(uebernommenFuer(liste, k[0], k, HEUTE, ZONE)).toBe(2);
    expect(uebernommenFuer(liste, k[1], k, HEUTE, ZONE)).toBe(1);
  });

  it('„Nächstes Mal“ nimmt die Übernahme zurück: er zählt nicht mehr, steht wieder bei den Offenen', () => {
    const an = annehmen(vorschlag({ id: 'a' }), k[0], LEITUNG, AM);
    const weiter = aufsNaechsteMal(an, k[0], LEITUNG, AM);
    expect(uebernommenFuer([weiter], k[0], k, HEUTE, ZONE)).toBe(0);
    expect(vorschlaegeOrdnen([weiter], k, HEUTE, ZONE).gruppen[0].vorschlaege).toEqual([weiter]);
  });
});

describe('Abgelehnt: 7 Tage sichtbar (W8c)', () => {
  // Ortszeit Berlin (Winter, +1): 23:30 UTC am 4.11. ist schon der 5.11.
  const abgelehnt = (am: string, id = 'v1', ich = ANNA) =>
    ablehnen(vorschlag({ id, ich }), 'Passt nicht', LEITUNG, am);

  it('abgelehntAm: der Zeitpunkt des Ablehnens – nur bei abgelehnten', () => {
    const v = abgelehnt('2026-11-04T10:00:00Z');
    expect(abgelehntAm(v)).toBe('2026-11-04T10:00:00Z');
    expect(abgelehntAm(vorschlag())).toBeNull();
  });

  it('abgelehntNoch: am Tag des Ablehnens 7, danach je Tag eins weniger, nach dem 6. Tag 0', () => {
    const v = abgelehnt('2026-11-04T10:00:00Z');
    const noch = (heute: string) => abgelehntNoch(v, heute, ZONE);
    expect([
      noch('2026-11-04'),
      noch('2026-11-05'),
      noch('2026-11-09'),
      noch('2026-11-10'),
      noch('2026-11-11'),
      noch('2026-11-20'),
    ]).toEqual([7, 6, 2, 1, 0, 0]);
  });

  it('rechnet in Ortszeit der Gemeinde, nicht in UTC', () => {
    const v = abgelehnt('2026-11-04T23:30:00Z'); // 5.11. 00:30 Berlin
    expect(abgelehntNoch(v, '2026-11-05', ZONE)).toBe(7);
    expect(abgelehntNoch(v, '2026-11-05', 'UTC')).toBe(6);
  });

  it('abgelehntNoch: ohne lesbares Datum oder nicht abgelehnt → 0', () => {
    expect(abgelehntNoch(vorschlag(), HEUTE, ZONE)).toBe(0);
    expect(abgelehntNoch(abgelehnt('kaputt'), HEUTE, ZONE)).toBe(0);
  });

  it('sichtbar nur für den Vorschlagenden und die Leitung', () => {
    const v = abgelehnt('2026-11-04T10:00:00Z');
    const sicht = (ich: number, leitung: boolean) =>
      abgelehntSichtbar([v], ich, leitung, HEUTE, ZONE).map((x) => x.id);
    expect(sicht(7, false)).toEqual(['v1']); // der Vorschlagende
    expect(sicht(1, true)).toEqual(['v1']); // die Leitung
    expect(sicht(9, false)).toEqual([]); // ein anderes Mitglied
  });

  it('nach 7 Tagen weg; Offene, Übernommene und Zurückgezogene gehören nie in die Gruppe', () => {
    const alt = abgelehnt('2026-10-28T10:00:00Z', 'alt'); // 9 Tage her
    const neu = abgelehnt('2026-11-05T10:00:00Z', 'neu');
    const andere = [
      vorschlag({ id: 'o' }),
      annehmen(vorschlag({ id: 'a' }), kommend({ termine: [T11] })[0], LEITUNG, AM),
      zurueckziehen(vorschlag({ id: 'z' }), ANNA, AM),
    ];
    expect(abgelehntSichtbar([alt, neu, ...andere], 7, true, HEUTE, ZONE).map((x) => x.id)).toEqual(
      ['neu'],
    );
  });

  it('ausgeblendete (×) fehlen – nur diese; neueste zuerst', () => {
    const a = abgelehnt('2026-11-02T10:00:00Z', 'a');
    const b = abgelehnt('2026-11-05T10:00:00Z', 'b');
    const c = abgelehnt('2026-11-03T10:00:00Z', 'c');
    expect(abgelehntSichtbar([a, b, c], 7, true, HEUTE, ZONE).map((x) => x.id)).toEqual([
      'b',
      'c',
      'a',
    ]);
    expect(abgelehntSichtbar([a, b, c], 7, true, HEUTE, ZONE, ['c']).map((x) => x.id)).toEqual([
      'b',
      'a',
    ]);
  });

  it('gespeichert bleibt er: ablehnen löscht nichts, nur die Anzeige filtert', () => {
    const alt = abgelehnt('2026-10-01T10:00:00Z');
    expect(alt.stand).toBe('abgelehnt');
    expect(abgelehntSichtbar([alt], 7, true, HEUTE, ZONE)).toEqual([]);
  });
});

describe('Bereich „Vorschläge“: offen oder zu', () => {
  it('ohne gemerkte Wahl: offen, wenn es Offene gibt – sonst zu', () => {
    expect(bereichOffen(null, 2)).toBe(true);
    expect(bereichOffen(null, 0)).toBe(false);
  });
  it('eine gemerkte Wahl gilt immer', () => {
    expect(bereichOffen(false, 2)).toBe(false);
    expect(bereichOffen(true, 0)).toBe(true);
  });
});

describe('Beim Schreiben', () => {
  const k = kommend({ termine: [T11, T12], koepfe: [kopf({})] });
  const s = k[0];

  it('„Vorschlagen“: nur angenommene kommen hinein, offene stehen im Kasten', () => {
    const offen = vorschlag({ id: 'o' });
    const an = annehmen(vorschlag({ id: 'a' }), s, LEITUNG, AM);
    const fremd = vorschlag({ id: 'x', ziel: zielVon(k[1]) });
    expect(zumEinfuegen([offen, an, fremd], s, false, k, HEUTE, ZONE).map((v) => v.id)).toEqual([
      'a',
    ]);
    expect(offeneFuer([offen, an, fremd], s, k, HEUTE, ZONE).map((v) => v.id)).toEqual(['o']);
  });

  it('„Direkt eintragen“: auch die offenen, in der Reihenfolge des Vorschlagens', () => {
    const spaet = vorschlag({ id: 's', am: '2026-11-06T12:00:00Z' });
    const frueh = vorschlag({ id: 'f', am: '2026-11-05T12:00:00Z' });
    const weg = ablehnen(vorschlag({ id: 'w' }), '', LEITUNG, AM);
    expect(zumEinfuegen([spaet, frueh, weg], s, true, k, HEUTE, ZONE).map((v) => v.id)).toEqual([
      'f',
      's',
    ]);
  });

  const punkt = (id: string, titel: string): Block => ({
    id,
    type: 'heading',
    props: { level: 1 },
    content: [{ type: 'text', text: titel, styles: {} }],
    children: [],
  });

  it('vor „Verschiedenes“, sonst ans Ende (Unterpunkt „Verschiedenes“ zählt nicht)', () => {
    expect(einfuegeStelle([punkt('a', 'Andacht'), punkt('v', ' Verschiedenes ')])).toBe('v');
    expect(
      einfuegeStelle([
        punkt('a', 'Andacht'),
        { ...punkt('u', 'Verschiedenes'), props: { level: 2 } },
      ]),
    ).toBeNull();
    expect(einfuegeStelle([punkt('a', 'Verschiedenes und mehr')])).toBeNull();
  });

  it('die Blöcke ergeben einen Tagesordnungspunkt mit Vermerk und werden wiedererkannt', () => {
    const v = vorschlag({ text: 'Angebot liegt vor.' });
    const bl = vorschlagBloecke(v);
    const a = ableiten([punkt('a', 'Andacht'), ...bl]);
    expect(a.punkte.map((p) => p.titel)).toEqual(['Andacht', 'Beamer-Halterung']);
    expect(bl[1].content).toEqual([
      { type: 'text', text: 'vorgeschlagen von Anna Wiens', styles: { italic: true } },
    ]);
    expect(schonImDokument([punkt('a', 'Andacht'), ...bl], v)).toBe(true);
    expect(schonImDokument([{ ...punkt('a', 'Andacht'), children: bl }], v)).toBe(true);
    expect(schonImDokument([punkt('a', 'Andacht')], v)).toBe(false);
  });
});
