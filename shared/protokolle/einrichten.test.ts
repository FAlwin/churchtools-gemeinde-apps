import { describe, expect, it } from 'vitest';
import {
  abweichungen,
  ausrichten,
  darfVerwalten,
  istEinstellung,
  vergebenNachher,
  rechteAus,
  rechteNummernAus,
  rechtRumpf,
  sollRechte,
  VERSTECKTE_GRUPPE_SEHEN,
  type Einrichtung,
  type RechteNummern,
} from './einrichten';

/**
 * Aufbau wie die echte Antwort von `GET /permissions/definitions` (Test-Instanz, 16.10.2026: Block des Moduls
 * `dienstplaner`, hier unter dem Kürzel `protokolle`; Kalender-Rechte 403/404 aus `churchcal`).
 */
const DEFINITIONEN = {
  modules: [
    {
      key: 'churchcal',
      name: 'Kalender',
      permissions: [
        { authId: 403, key: 'view category', valueType: 'multiple' },
        { authId: 404, key: 'edit category', valueType: 'multiple' },
      ],
    },
    {
      key: 'protokolle',
      name: 'Protokolle',
      permissions: [
        { authId: 2090, key: 'view', valueType: 'boolean' },
        { authId: 2091, key: 'view custom category', valueType: 'multiple' },
        { authId: 2092, key: 'create custom category', valueType: 'boolean' },
        { authId: 2093, key: 'edit custom category', valueType: 'multiple' },
        { authId: 2094, key: 'delete custom category', valueType: 'multiple' },
        { authId: 2095, key: 'view custom data', valueType: 'multiple' },
        { authId: 2096, key: 'create custom data', valueType: 'multiple' },
        { authId: 2097, key: 'edit custom data', valueType: 'multiple' },
        { authId: 2098, key: 'delete custom data', valueType: 'multiple' },
      ],
    },
  ],
};

const N = rechteNummernAus(DEFINITIONEN, 'protokolle') as RechteNummern;

const EINRICHTUNG: Einrichtung = {
  rollen: [
    { rolle: 72, stufe: 'leitung' },
    { rolle: 71, stufe: 'mitglied' },
    { rolle: 75, stufe: 'keine' },
  ],
  kategorien: { protokolle: 60, mitarbeit: 61, vorlagen: 5 },
  kalender: 15,
  versteckt: true,
};

describe('rechteNummernAus', () => {
  it('findet die Nummern nach Schlüssel', () => {
    expect(N).toEqual({
      modulSehen: 2090,
      kategorieSehen: 2091,
      datenSehen: 2095,
      datenAnlegen: 2096,
      datenAendern: 2097,
      datenLoeschen: 2098,
      kalenderSehen: 403,
      kalenderBearbeiten: 404,
    });
  });
  it('gibt null, wenn das Modul fehlt – dann wird nichts gesetzt', () => {
    expect(rechteNummernAus(DEFINITIONEN, 'anderes')).toBeNull();
    expect(rechteNummernAus(null, 'protokolle')).toBeNull();
  });
});

describe('sollRechte', () => {
  const soll = sollRechte(EINRICHTUNG, N);
  const von = (rolle: number): string[] =>
    soll.filter((r) => r.rolle === rolle).map((r) => `${r.authId}:${r.dataId}`);

  it('Leitung: lesen überall, schreiben Protokolle + Mitarbeit, Kalender bearbeiten, versteckte Gruppe sehen', () => {
    expect(von(72).sort()).toEqual(
      [
        '2090:null',
        '2091:60',
        '2095:60',
        '2091:61',
        '2095:61',
        '2091:5',
        '2095:5',
        '2096:61',
        '2097:61',
        '2096:60',
        '2097:60',
        '2098:60',
        '403:15',
        '404:15',
        `${VERSTECKTE_GRUPPE_SEHEN}:null`,
      ].sort(),
    );
  });
  it('Mitglied: Protokolle nur lesen, Mitarbeit schreiben, Kalender nur sehen', () => {
    const m = von(71);
    expect(m).toContain('2090:null'); // ohne „Modul sehen“ kein Menüpunkt
    expect(m).toContain('2095:60');
    expect(m).not.toContain('2096:60');
    expect(m).not.toContain('2097:60');
    expect(m).toContain('2097:61');
    expect(m).toContain('403:15');
    expect(m).not.toContain('404:15');
  });
  it('niemand bekommt „Daten löschen“ in Mitarbeit (nie hart löschen)', () => {
    expect(soll.some((r) => r.authId === N.datenLoeschen && r.dataId === 61)).toBe(false);
  });
  it('Kein Zugriff: gar nichts', () => {
    expect(von(75)).toEqual([]);
  });
  it('ohne Kalender und nicht versteckt: keine Kalender- und keine 10119-Rechte', () => {
    const s = sollRechte({ ...EINRICHTUNG, kalender: null, versteckt: false }, N);
    expect(
      s.some((r) => r.authId === 403 || r.authId === 404 || r.authId === VERSTECKTE_GRUPPE_SEHEN),
    ).toBe(false);
  });
});

describe('ausrichten', () => {
  const soll = sollRechte(EINRICHTUNG, N);

  it('erstes Einrichten: alles setzen, nichts entziehen', () => {
    const a = ausrichten(soll, [], EINRICHTUNG, N);
    expect(a.setzen).toEqual(soll);
    expect(a.entziehen).toEqual([]);
    expect(a.nachschieben).toBeNull();
  });

  it('Rolle herabgestuft: entzieht nur Rechte auf unsere Kategorien und schiebt ein Recht nach', () => {
    const ist = [
      ...soll,
      { rolle: 71, authId: N.datenAendern, dataId: 60 }, // war vorher Leitung
      { rolle: 71, authId: 404, dataId: 15 }, // Kalender bearbeiten – aus anderem Grund? bleibt
      { rolle: 71, authId: N.datenAendern, dataId: 33 }, // fremde Kategorie (Dienstplaner) – bleibt
    ];
    const a = ausrichten(soll, ist, EINRICHTUNG, N);
    expect(a.setzen).toEqual([]);
    expect(a.entziehen).toEqual([{ rolle: 71, authId: N.datenAendern, dataId: 60 }]);
    expect(a.nachschieben).not.toBeNull();
    expect(a.entziehen).not.toContainEqual(a.nachschieben);
  });

  it('Gruppe ganz auf „Kein Zugriff“: alles Eigene weg, nachschieben fällt auf ein verbleibendes fremdes Recht', () => {
    const nichts: Einrichtung = {
      ...EINRICHTUNG,
      rollen: EINRICHTUNG.rollen.map((r) => ({ ...r, stufe: 'keine' as const })),
    };
    const ist = [...soll, { rolle: 72, authId: N.datenSehen, dataId: 33 }];
    const a = ausrichten(sollRechte(nichts, N), ist, nichts, N);
    expect(a.entziehen.every((r) => [60, 61, 5].includes(r.dataId as number))).toBe(true);
    expect(a.entziehen.length).toBeGreaterThan(0);
    expect(a.nachschieben).not.toBeNull();
    expect(a.entziehen).not.toContainEqual(a.nachschieben);
  });

  it('bleibt gar kein Recht übrig: schiebt „Modul sehen“ an der ersten betroffenen Rolle nach', () => {
    const nichts: Einrichtung = {
      ...EINRICHTUNG,
      rollen: EINRICHTUNG.rollen.map((r) => ({ ...r, stufe: 'keine' as const })),
    };
    const ist = [
      { rolle: 71, authId: N.datenSehen, dataId: 60 },
      { rolle: 72, authId: N.datenAendern, dataId: 60 },
    ];
    const a = ausrichten(sollRechte(nichts, N), ist, nichts, N);
    expect(a.entziehen).toEqual(ist);
    expect(a.nachschieben).toEqual({ rolle: 71, authId: N.modulSehen, dataId: null });
  });

  it('„Modul sehen“ wird nie entzogen – es kann auch aus anderem Grund gesetzt sein', () => {
    const nichts: Einrichtung = { ...EINRICHTUNG, rollen: [{ rolle: 71, stufe: 'keine' }] };
    const a = ausrichten([], [{ rolle: 71, authId: N.modulSehen, dataId: null }], nichts, N);
    expect(a.entziehen).toEqual([]);
  });
});

describe('Zusatzrechte (Kalender, 10119): nur selbst gesetzte werden entzogen', () => {
  const ohneKalender: Einrichtung = { ...EINRICHTUNG, kalender: null, versteckt: false };
  const kal = { rolle: 71, authId: 403, dataId: 15 };
  const versteckt = { rolle: 71, authId: VERSTECKTE_GRUPPE_SEHEN, dataId: null };

  it('von der Verwaltung gesetzt (in `vergeben`): wird beim Wechsel entzogen', () => {
    const a = ausrichten(sollRechte(ohneKalender, N), [kal, versteckt], ohneKalender, N, [
      kal,
      versteckt,
    ]);
    expect(a.entziehen).toEqual([kal, versteckt]);
  });

  it('von Hand gesetzt (nicht in `vergeben`): bleibt', () => {
    const a = ausrichten(sollRechte(ohneKalender, N), [kal, versteckt], ohneKalender, N, []);
    expect(a.entziehen).toEqual([]);
  });

  it('vergebenNachher: gerade gesetzte und früher gesetzte Zusatzrechte im Soll – keine von Hand', () => {
    const soll = sollRechte(EINRICHTUNG, N);
    const zusatz = soll.filter((r) => [403, 404, VERSTECKTE_GRUPPE_SEHEN].includes(r.authId));
    // zusatz[0] war schon von Hand da – also nicht in `setzen` und nicht gemerkt.
    const gesetzt = zusatz.slice(1);
    expect(vergebenNachher(soll, gesetzt, [], N)).toEqual(gesetzt);
    // früher gesetzt, heute schon da (also nicht in `setzen`) – bleibt gemerkt
    expect(vergebenNachher(soll, [], gesetzt, N)).toEqual(gesetzt);
    // Datenrechte zählen nie als Zusatzrecht, auch wenn sie gerade gesetzt wurden
    expect(vergebenNachher(soll, soll, [], N)).toEqual(zusatz);
  });

  it('nicht mehr im Soll: fällt aus `vergeben` heraus', () => {
    expect(vergebenNachher(sollRechte(ohneKalender, N), [], [kal], N)).toEqual([]);
  });
});

describe('abweichungen', () => {
  const soll = sollRechte(EINRICHTUNG, N);
  const weg = { rolle: 71, authId: N.datenAendern, dataId: 60 };
  it('alles übernommen: nichts fehlt, nichts ist noch da', () => {
    expect(abweichungen(soll, [weg], soll)).toEqual({ fehlt: [], nochDa: [] });
  });
  it('prüft das ganze Soll, nicht nur das gerade Gesetzte', () => {
    const ohne = soll.slice(1);
    expect(abweichungen(soll, [], ohne).fehlt).toEqual([soll[0]]);
  });
  it('meldet einen Entzug, den ChurchTools nicht übernommen hat', () => {
    expect(abweichungen(soll, [weg], [...soll, weg]).nochDa).toEqual([weg]);
  });
});

describe('darfVerwalten', () => {
  it('nur mit „administer persons“ (wie gemessen: Alwin ja, Spike nein)', () => {
    expect(darfVerwalten({ churchcore: { 'administer persons': true } })).toBe(true);
    expect(darfVerwalten({ churchcore: { 'administer persons': false } })).toBe(false);
    expect(darfVerwalten({ churchcore: {} })).toBe(false);
    expect(darfVerwalten(null)).toBe(false);
  });
});

describe('istEinstellung', () => {
  const gut = {
    art: 'einstellung',
    fassung: 1,
    gruppe: 194,
    rollen: [{ rolle: 2126, stufe: 'leitung' }],
    punkte: 'vorschlagen',
    kalender: null,
  };
  it('erkennt die eigene Einstellung', () => {
    expect(istEinstellung(gut)).toBe(true);
    expect(istEinstellung({ ...gut, kalender: 4, punkte: 'direkt' })).toBe(true);
    expect(istEinstellung({ ...gut, vergeben: [{ rolle: 1, authId: 403, dataId: 4 }] })).toBe(true);
  });
  it('lehnt Fremdes und Kaputtes ab', () => {
    expect(istEinstellung(null)).toBe(false);
    expect(istEinstellung({ ...gut, art: 'aufgabe' })).toBe(false);
    expect(istEinstellung({ ...gut, fassung: 2 })).toBe(false);
    expect(istEinstellung({ ...gut, rollen: [{ rolle: 1, stufe: 'chef' }] })).toBe(false);
    expect(istEinstellung({ ...gut, punkte: 'egal' })).toBe(false);
    expect(istEinstellung({ ...gut, vergeben: [{ rolle: 1 }] })).toBe(false);
  });
});

describe('rechteAus / rechtRumpf', () => {
  it('liest die Zeilen wie gemessen (eine Zeile je dataId) und lässt Entzüge weg', () => {
    const zeilen = [
      { domainType: 'group_role', domainId: 2007, authId: 2031, dataId: 42, type: 'grant' },
      { domainType: 'group_role', domainId: 2007, authId: 10119, dataId: null, type: 'grant' },
      { domainType: 'group_role', domainId: 2007, authId: 2035, dataId: 42, type: 'revoke' },
    ];
    expect(rechteAus(2007, zeilen)).toEqual([
      { rolle: 2007, authId: 2031, dataId: 42 },
      { rolle: 2007, authId: 10119, dataId: null },
    ]);
    expect(rechteAus(1, null)).toEqual([]);
  });
  it('baut den Rumpf wie gemessen', () => {
    expect(rechtRumpf({ rolle: 1, authId: 2031, dataId: 42 })).toEqual({
      authId: 2031,
      dataId: [42],
    });
    expect(rechtRumpf({ rolle: 1, authId: 10119, dataId: null })).toEqual({ authId: 10119 });
  });
});
