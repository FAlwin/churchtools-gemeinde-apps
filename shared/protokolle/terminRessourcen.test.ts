import { describe, expect, it } from 'vitest';
import { eintragVorbelegung, ganztaegigWechseln } from './termine';
import { eintragZusatz } from './terminFelder';
import {
  begrenzeLauf,
  buchungenAufRechte,
  buchungHinzu,
  buchungRumpf,
  buchungsHinweis,
  buchungUmschalten,
  gemeinsamerStatus,
  LAUF_VORGABE,
  LAUF_VORSCHLAEGE,
  NACHLAUF_MAX,
  ressourceText,
  ressourcenAus,
  statusFuer,
  statusFuerAlle,
  VORLAUF_MAX,
  type Buchung,
  type Ressource,
} from './terminRessourcen';
import { nachlaufZeit, vorlaufZeit } from './terminRessourcenZeit';

/** Der Reiter „Ressourcen“ (W15-2): Regeln ohne ChurchTools. */
const SAAL: Ressource = { id: 1, name: 'Saal', typId: 10, typ: 'Raum', anzahl: 1 };
const eintrag = (extra = {}) => ({
  ...eintragVorbelegung({ text: 'Heiligabend, 16 Uhr', datum: '2026-11-23' }, 4),
  ...extra,
});
const buchung = (extra: Partial<Buchung> = {}): Buchung => ({
  ressource: 1,
  vorlauf: 15,
  nachlauf: 15,
  status: 1,
  menge: 1,
  ...extra,
});

describe('Vorgaben und Grenzen', () => {
  it('ganztägig wie in ChurchTools: Vorgabe 0/0, beide Zeiten ab 00:00 des Tages (gemessen 23.11.2026)', () => {
    const e = eintragVorbelegung({ text: 'Bibeltag', datum: '2026-11-26' }, 4);
    expect([e.ganztaegig, e.vorlauf, e.nachlauf]).toEqual([true, 0, 0]);
    expect(vorlaufZeit(e, 0)).toBe('26.11.2026 00:00');
    expect(nachlaufZeit(e, 0)).toBe('26.11.2026 00:00');
  });
  it('„Ganztägig“ umschalten: Vorgabe wechselt mit, selbst Eingetipptes bleibt, Tabelle unberührt', () => {
    const e = eintrag({ buchungen: [buchung({ vorlauf: 15 })] });
    const an = ganztaegigWechseln(e, true);
    expect([an.ganztaegig, an.vorlauf, an.nachlauf, an.buchungen[0].vorlauf]).toEqual([
      true,
      0,
      0,
      15,
    ]);
    expect([ganztaegigWechseln(an, false).vorlauf, ganztaegigWechseln(an, false).nachlauf]).toEqual(
      [15, 15],
    );
    const eigen = ganztaegigWechseln({ ...e, vorlauf: 60 }, true);
    expect([eigen.vorlauf, eigen.nachlauf]).toEqual([60, 0]);
  });

  it('Vorgabe 15/15 wie in ChurchTools; die Vorschläge; Grenzen der Schnittstelle', () => {
    const e = eintrag();
    expect([e.vorlauf, e.nachlauf, e.buchungen]).toEqual([LAUF_VORGABE, LAUF_VORGABE, []]);
    expect(LAUF_VORGABE).toBe(15);
    expect(LAUF_VORSCHLAEGE).toEqual([0, 15, 30, 45, 60, 90, 120, 180, 240]);
    expect([VORLAUF_MAX, NACHLAUF_MAX]).toEqual([20160, 1440]);
  });

  it('begrenzeLauf: ganze Zahl von 0 bis zur Grenze', () => {
    expect(begrenzeLauf(-5, 100)).toBe(0);
    expect(begrenzeLauf(12.9, 100)).toBe(12);
    expect(begrenzeLauf(5000, 1440)).toBe(1440);
    expect(begrenzeLauf(Number.NaN, 1440)).toBe(0);
  });
});

describe('errechnete Uhrzeit', () => {
  it('Beginn minus Vorlauf, Ende plus Nachlauf – wie in CT „23.11.2026 13:45“', () => {
    const e = eintrag({
      ganztaegig: false,
      tag: '2026-11-23',
      von: '14:00',
      endTag: '2026-11-23',
      bis: '16:00',
    });
    expect(vorlaufZeit(e, 15)).toBe('23.11.2026 13:45');
    expect(nachlaufZeit(e, 15)).toBe('23.11.2026 16:15');
  });

  it('über Mitternacht und mehrtägig: Ende zählt vom Enddatum', () => {
    const e = eintrag({
      ganztaegig: false,
      tag: '2026-11-23',
      von: '00:10',
      endTag: '2026-11-24',
      bis: '23:50',
    });
    expect(vorlaufZeit(e, 30)).toBe('22.11.2026 23:40');
    expect(nachlaufZeit(e, 30)).toBe('25.11.2026 00:20');
  });

  it('0 Minuten = Beginn und Ende selbst; ein Fehler im Datum oder in der Uhrzeit = leer', () => {
    const e = eintrag({
      ganztaegig: false,
      tag: '2026-11-23',
      von: '14:00',
      endTag: '2026-11-23',
      bis: '16:00',
    });
    expect(vorlaufZeit(e, 0)).toBe('23.11.2026 14:00');
    expect(vorlaufZeit({ ...e, tag: '' }, 15)).toBe('');
    expect(nachlaufZeit({ ...e, bis: '' }, 15)).toBe('');
  });
});

describe('ressourcenAus', () => {
  const ressourcen = [
    { id: 3, name: 'Bus', resourceTypeId: 12, quantity: 1 },
    { id: 2, name: 'Küche', resourceTypeId: 10, quantity: 1 },
    { id: 1, name: 'Saal', resourceTypeId: 10, quantity: 1 },
    { id: 5, name: 'Stühle', resourceTypeId: 11, quantity: 80 },
    { id: 9, name: 'Fremd', resourceTypeId: 10, quantity: 1 },
    { id: 7, name: '', resourceTypeId: 10 },
  ];
  const typen = [
    { id: 10, nameTranslated: 'Raum' },
    { id: 11, nameTranslated: 'Gegenstand' },
    { id: 12, nameTranslated: 'Fahrzeug' },
  ];

  it('nur die buchbaren, nach Typ und Namen sortiert, mit Anzahl', () => {
    const r = ressourcenAus(ressourcen, typen, new Set([1, 2, 3, 5, 7]));
    expect(r.map((x) => `${x.typ}/${x.name}/${x.anzahl}`)).toEqual([
      'Fahrzeug/Bus/1',
      'Gegenstand/Stühle/80',
      'Raum/Küche/1',
      'Raum/Saal/1',
    ]);
  });

  it('„Saal · Raum“ – Name und Typ; ohne Typ nur der Name', () => {
    expect(ressourceText(SAAL)).toBe('Saal · Raum');
    expect(ressourceText({ name: 'Saal', typ: '' })).toBe('Saal');
  });

  it('ohne Rechte oder ohne lesbare Antwort: keine Ressourcen', () => {
    expect(ressourcenAus(ressourcen, typen, new Set())).toEqual([]);
    expect(ressourcenAus(null, null, new Set([1]))).toEqual([]);
  });
});

describe('Buchungen', () => {
  it('hinzufügen: Vorlauf/Nachlauf der Vorgabe, „Wartet“, jede Ressource nur einmal', () => {
    const eine = buchungHinzu([], SAAL, { vorlauf: 30, nachlauf: 45 });
    expect(eine).toEqual([buchung({ vorlauf: 30, nachlauf: 45 })]);
    expect(buchungHinzu(eine, SAAL, { vorlauf: 99, nachlauf: 99 })).toEqual(eine);
  });

  it('Status: nur mit Verwalten-Recht wählbar, sonst immer „Wartet“ (1)', () => {
    expect(statusFuer(2, true)).toBe(2);
    expect(statusFuer(3, true)).toBe(3);
    expect(statusFuer(2, false)).toBe(1);
    expect(statusFuer(3, false)).toBe(1);
    expect(statusFuer(7, true)).toBe(1);
  });

  it('auf die Rechte beschränken: nur buchbare, einmal je Ressource, Status nach Recht, Zeiten in den Grenzen', () => {
    const r = buchungenAufRechte(
      [
        buchung({ ressource: 1, status: 2, vorlauf: 99_999 }),
        buchung({ ressource: 2, status: 3 }),
        buchung({ ressource: 1 }),
        buchung({ ressource: 8 }),
      ],
      new Set([1, 2]),
      new Set([1]),
    );
    expect(r).toEqual([
      buchung({ ressource: 1, status: 2, vorlauf: VORLAUF_MAX }),
      buchung({ ressource: 2, status: 1 }),
    ]);
  });

  it('Rumpf: `quantity` nur bei mehr als einem Stück', () => {
    expect(buchungRumpf(buchung({ vorlauf: 150, nachlauf: 60, status: 2 }))).toEqual({
      resourceId: 1,
      leadTimeMinutes: 150,
      afterwardMinutes: 60,
      statusId: 2,
    });
    expect(buchungRumpf(buchung({ menge: 40 }))).toMatchObject({ quantity: 40 });
  });

  it('der Eintrag gibt die Buchungen als Zusatzfeld weiter – ohne Buchungen fehlt es', () => {
    expect(eintragZusatz(eintrag(), false)).not.toHaveProperty('buchungen');
    expect(eintragZusatz(eintrag({ buchungen: [buchung()] }), false).buchungen).toEqual([
      buchung(),
    ]);
  });
});

describe('mehrere auf einmal (27.11.2026)', () => {
  const BEAMER: Ressource = { id: 2, name: 'Beamer', typId: 11, typ: 'Gegenstand', anzahl: 1 };
  const vorgabe = { vorlauf: 30, nachlauf: 0 };

  it('Häkchen setzen fügt mit den Vorgaben hinzu, Häkchen weg nimmt nur diese Buchung heraus', () => {
    const zwei = buchungUmschalten(buchungUmschalten([], SAAL, vorgabe), BEAMER, vorgabe);
    expect(zwei.map((b) => b.ressource)).toEqual([1, 2]);
    expect(zwei[1]).toEqual(buchung({ ressource: 2, vorlauf: 30, nachlauf: 0 }));
    expect(buchungUmschalten(zwei, SAAL, vorgabe)).toEqual([zwei[1]]);
  });

  it('Status für alle: nur verwaltbare Ressourcen, die anderen bleiben „Wartet“', () => {
    const vorher = [
      buchung({ ressource: 1 }),
      buchung({ ressource: 2, status: 3 }),
      buchung({ ressource: 5 }),
    ];
    const nachher = statusFuerAlle(vorher, 2, new Set([1, 2]));
    expect(nachher.map((b) => b.status)).toEqual([2, 2, 1]);
  });

  it('gemeinsamer Status: nur über die verwaltbaren, null bei verschiedenen oder keinem', () => {
    const verwaltbar = new Set([1, 2]);
    const gleich = [
      buchung({ ressource: 1, status: 2 }),
      buchung({ ressource: 2, status: 2 }),
      buchung({ ressource: 5 }),
    ];
    expect(gemeinsamerStatus(gleich, verwaltbar)).toBe(2);
    expect(
      gemeinsamerStatus([...gleich.slice(0, 1), buchung({ ressource: 2, status: 3 })], verwaltbar),
    ).toBeNull();
    expect(gemeinsamerStatus([buchung({ ressource: 5 })], verwaltbar)).toBeNull();
  });
});

describe('buchungsHinweis', () => {
  const namen = (id: number) => (id === 1 ? 'Saal' : `Ressource ${id}`);

  it('alles gebucht: kein Hinweis', () => {
    expect(buchungsHinweis({ fehlend: [], unklar: false }, namen)).toBeNull();
  });

  it('eine oder mehrere fehlen: mit Namen und „in ChurchTools nachbuchen“', () => {
    expect(buchungsHinweis({ fehlend: [1], unklar: false }, namen)).toMatch(
      /„Saal“ wurde nicht gebucht.*nachbuchen/,
    );
    expect(buchungsHinweis({ fehlend: [1, 5], unklar: false }, namen)).toMatch(
      /Saal, Ressource 5.*nachbuchen/,
    );
  });

  it('unklar ist nicht „fehlt“: eigene Meldung, ohne Behauptung, es sei nicht gebucht', () => {
    const t = buchungsHinweis({ fehlend: [], unklar: true }, namen);
    expect(t).toMatch(/nicht nachlesen/);
    expect(t).not.toMatch(/wurde nicht gebucht|wurden nicht gebucht/);
  });
});
