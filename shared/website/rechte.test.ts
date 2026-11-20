import { describe, expect, it } from 'vitest';
import {
  datenRechteNummernAus,
  rechteVergleichen,
  type DatenRechteNummern,
  type Recht,
} from '../ct/rollenRechte';
import {
  MODUL_KUERZEL,
  rechteHinweis,
  sollRechte,
  stufeAus,
  stufenAus,
  verwaltetVon,
  vorschlag,
  wahlAus,
  type Kategorien,
} from './rechte';

/** Aufbau wie `GET /permissions/definitions` (Test-Instanz, Modul `website`; Nummern aus Messung W3b-0). */
const DEFINITIONEN = {
  modules: [
    {
      key: MODUL_KUERZEL,
      permissions: [
        { authId: 2080, key: 'view' },
        { authId: 2081, key: 'view custom category' },
        { authId: 2085, key: 'view custom data' },
        { authId: 2086, key: 'create custom data' },
        { authId: 2087, key: 'edit custom data' },
        { authId: 2088, key: 'delete custom data' },
      ],
    },
  ],
};
const N = datenRechteNummernAus(DEFINITIONEN, MODUL_KUERZEL) as DatenRechteNummern;
const KAT: Kategorien = { entwuerfe: 104, veroeffentlicht: 107 };
const E = KAT.entwuerfe;
const V = KAT.veroeffentlicht;
const r = (rolle: number, authId: number, dataId: number | null = null): Recht => ({
  rolle,
  authId,
  dataId,
});
const soll = (stufe: 'keine' | 'redakteur' | 'leitung', rolle = 1) =>
  sollRechte([{ rolle, stufe }], KAT, N);
const hat = (rechte: Recht[], authId: number, dataId: number | null) =>
  rechte.some((x) => x.authId === authId && x.dataId === dataId);

describe('sollRechte', () => {
  it('Kein Zugriff: nichts', () => {
    expect(soll('keine')).toEqual([]);
  });

  it('Redakteur: Modul sehen; Entwürfe sehen/anlegen/ändern/löschen; Veröffentlicht NUR sehen', () => {
    const s = soll('redakteur');
    expect(hat(s, N.modulSehen, null)).toBe(true);
    for (const a of [
      N.kategorieSehen,
      N.datenSehen,
      N.datenAnlegen,
      N.datenAendern,
      N.datenLoeschen,
    ])
      expect(hat(s, a, E)).toBe(true);
    expect(hat(s, N.kategorieSehen, V)).toBe(true);
    expect(hat(s, N.datenSehen, V)).toBe(true);
    for (const a of [N.datenAnlegen, N.datenAendern, N.datenLoeschen])
      expect(hat(s, a, V)).toBe(false);
    expect(s).toHaveLength(1 + 5 + 2);
  });

  it('Leitung: wie Redakteur, dazu Veröffentlicht anlegen/ändern/löschen', () => {
    const s = soll('leitung');
    for (const a of [N.datenAnlegen, N.datenAendern, N.datenLoeschen]) {
      expect(hat(s, a, V)).toBe(true);
      expect(hat(s, a, E)).toBe(true);
    }
    expect(s).toHaveLength(1 + 5 + 5);
    // Redakteur ist eine Teilmenge der Leitung.
    const red = soll('redakteur').map((x) => `${x.authId}:${x.dataId}`);
    const lei = new Set(s.map((x) => `${x.authId}:${x.dataId}`));
    expect(red.every((k) => lei.has(k))).toBe(true);
  });

  it('jede Rolle bekommt ihr eigenes Soll; rolle steht an jedem Recht', () => {
    const s = sollRechte(
      [
        { rolle: 1, stufe: 'leitung' },
        { rolle: 2, stufe: 'redakteur' },
        { rolle: 3, stufe: 'keine' },
      ],
      KAT,
      N,
    );
    expect(new Set(s.map((x) => x.rolle))).toEqual(new Set([1, 2]));
    expect(s.filter((x) => x.rolle === 2)).toHaveLength(8);
    expect(s.filter((x) => x.rolle === 1)).toHaveLength(11);
  });
});

describe('Ausrichten (Soll gegen Ist) – nur UNSERE Kategorien', () => {
  const verwaltet = verwaltetVon(KAT, N);

  it('entzieht Veröffentlicht-Schreiben bei der Herabstufung Leitung → Redakteur, nichts sonst', () => {
    const ist = [
      ...soll('leitung'),
      r(1, N.datenAnlegen, 999), // fremde Kategorie von Hand
      r(1, 10119), // Zusatzrecht von Hand
    ];
    const p = rechteVergleichen(soll('redakteur'), ist, verwaltet, N.modulSehen);
    expect(p.setzen).toEqual([]);
    expect(p.entziehen.map((x) => [x.authId, x.dataId])).toEqual([
      [N.datenAnlegen, V],
      [N.datenAendern, V],
      [N.datenLoeschen, V],
    ]);
    expect(p.nachschieben).not.toBeNull();
  });

  it('„Kein Zugriff“ entzieht beide Kategorien, lässt „Modul sehen“ und Fremdes stehen', () => {
    const ist = [...soll('redakteur'), r(1, N.datenSehen, 999)];
    const p = rechteVergleichen(soll('keine'), ist, verwaltet, N.modulSehen);
    expect(p.entziehen.every((x) => x.dataId === E || x.dataId === V)).toBe(true);
    expect(p.entziehen).toHaveLength(7);
    expect(p.entziehen.some((x) => x.authId === N.modulSehen)).toBe(false);
    expect(p.entziehen.some((x) => x.dataId === 999)).toBe(false);
  });

  it('Hochstufen Redakteur → Leitung setzt nur das Fehlende', () => {
    const p = rechteVergleichen(soll('leitung'), soll('redakteur'), verwaltet, N.modulSehen);
    expect(p.setzen).toHaveLength(3);
    expect(p.entziehen).toEqual([]);
    expect(p.nachschieben).toBeNull();
  });
});

describe('stufeAus – die Stufe kommt aus den Rechten (nichts wird zusätzlich gespeichert)', () => {
  it.each(['keine', 'redakteur', 'leitung'] as const)(
    'Rechte der Stufe „%s“ ergeben diese Stufe',
    (st) => {
      expect(stufeAus(1, soll(st), KAT, N)).toBe(st);
    },
  );

  it('Rechte anderer Rollen zählen nicht', () => {
    expect(stufeAus(1, soll('leitung', 2), KAT, N)).toBe('keine');
    expect(stufeAus(2, [...soll('redakteur', 1), ...soll('leitung', 2)], KAT, N)).toBe('leitung');
  });

  it('nur fremde Rechte an der Rolle: Kein Zugriff', () => {
    expect(stufeAus(1, [r(1, N.modulSehen), r(1, N.datenSehen, 999), r(1, 10119)], KAT, N)).toBe(
      'keine',
    );
  });

  it('Mischzustand: Redakteur mit zusätzlichem Schreiben in Veröffentlicht, aber ohne Entwürfe-Löschen → weicht ab', () => {
    const ist = soll('leitung').filter((x) => !(x.authId === N.datenLoeschen && x.dataId === E));
    expect(stufeAus(1, ist, KAT, N)).toBe('abweicht');
  });

  it('Mischzustand: Leitung, der ein Leserecht an Veröffentlicht fehlt → weicht ab', () => {
    const ist = soll('leitung').filter((x) => !(x.authId === N.datenSehen && x.dataId === V));
    expect(stufeAus(1, ist, KAT, N)).toBe('abweicht');
  });

  it('Mischzustand: Redakteur mit überzähligem Anlegen in Veröffentlicht (nur das) → Leitung wäre unvollständig → weicht ab', () => {
    expect(stufeAus(1, [...soll('redakteur'), r(1, N.datenAnlegen, V)], KAT, N)).toBe('abweicht');
  });

  it('nur in „Veröffentlicht“ schreiben, in Entwürfen nichts → weicht ab (keine Leitung geraten)', () => {
    expect(
      stufeAus(1, [r(1, N.modulSehen), r(1, N.datenAnlegen, V), r(1, N.kategorieSehen, V)], KAT, N),
    ).toBe('abweicht');
  });

  it('„Modul sehen“ fehlt bei sonst vollständigen Redakteur-Rechten → weicht ab', () => {
    expect(
      stufeAus(
        1,
        soll('redakteur').filter((x) => x.authId !== N.modulSehen),
        KAT,
        N,
      ),
    ).toBe('abweicht');
  });

  it('stufenAus liefert je Rolle eine Zeile, auch ohne Rechte', () => {
    expect(stufenAus([1, 2, 3], [...soll('leitung', 1), ...soll('redakteur', 2)], KAT, N)).toEqual([
      { rolle: 1, stufe: 'leitung' },
      { rolle: 2, stufe: 'redakteur' },
      { rolle: 3, stufe: 'keine' },
    ]);
  });
});

describe('Vorbelegung (E-W21)', () => {
  const ROLLEN = [
    { id: 10, name: 'Leiter', leitung: true },
    { id: 11, name: 'Co-Leiter', leitung: true },
    { id: 12, name: 'Mitarbeiter', leitung: false },
    { id: 13, name: 'Coach', leitung: false },
  ];

  it('Rollen mit Leiter-Kennzeichen = Leitung, alle anderen = Redakteur', () => {
    expect(vorschlag(ROLLEN)).toEqual([
      { rolle: 10, stufe: 'leitung' },
      { rolle: 11, stufe: 'leitung' },
      { rolle: 12, stufe: 'redakteur' },
      { rolle: 13, stufe: 'redakteur' },
    ]);
  });

  it('wahlAus: gesetzte Stufen aus ChurchTools, bei „weicht ab“ und „kein Zugriff“ …', () => {
    const w = wahlAus(ROLLEN, [
      { rolle: 10, stufe: 'redakteur' },
      { rolle: 11, stufe: 'abweicht' },
      { rolle: 12, stufe: 'keine' },
    ]);
    expect(w).toEqual([
      { rolle: 10, stufe: 'redakteur' },
      { rolle: 11, stufe: 'leitung' }, // weicht ab → Vorschlag
      { rolle: 12, stufe: 'keine' }, // bewusst „keine“ bleibt stehen
      { rolle: 13, stufe: 'redakteur' }, // unbekannt → Vorschlag
    ]);
  });
});

describe('rechteHinweis (Prüfung beim Start)', () => {
  const ROLLEN = [
    { id: 1, name: 'Leiter', leitung: true },
    { id: 2, name: 'Mitarbeiter', leitung: false },
  ];

  it('alles stimmt: kein Hinweis', () => {
    expect(
      rechteHinweis(ROLLEN, [
        { rolle: 1, stufe: 'leitung' },
        { rolle: 2, stufe: 'redakteur' },
      ]),
    ).toBeNull();
  });

  it('nur manche Rollen haben Rechte, die anderen bewusst keine: kein Hinweis', () => {
    expect(
      rechteHinweis(ROLLEN, [
        { rolle: 1, stufe: 'leitung' },
        { rolle: 2, stufe: 'keine' },
      ]),
    ).toBeNull();
  });

  it('weicht eine Rolle ab: Hinweis mit ihrem Namen', () => {
    expect(
      rechteHinweis(ROLLEN, [
        { rolle: 1, stufe: 'leitung' },
        { rolle: 2, stufe: 'abweicht' },
      ]),
    ).toEqual({ art: 'abweicht', rollen: ['Mitarbeiter'] });
  });

  it('keine Rolle hat Rechte: Hinweis „nichts“', () => {
    expect(
      rechteHinweis(ROLLEN, [
        { rolle: 1, stufe: 'keine' },
        { rolle: 2, stufe: 'keine' },
      ]),
    ).toEqual({ art: 'nichts' });
  });
});
