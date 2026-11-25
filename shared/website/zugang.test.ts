import { describe, expect, it } from 'vitest';
import {
  bereicheFuerNeueSeite,
  bereichVon,
  darfAussehenUndMenue,
  darfEigenesHtml,
  darfFreigeben,
  istAdmin,
  leitetEtwas,
  leitetGruppe,
  leitetWebsite,
  meineGruppenIds,
  ohneBereich,
  schreibtIn,
  siehtBereich,
  sichtbareSeiten,
  WEBSITE_LEITUNG,
  WEBSITE_REDAKTEUR,
  zugangFuer,
} from './zugang';
import { MODUL_KUERZEL } from './rechte';

const mitglied = (
  gruppe: number,
  rolle: number,
  status = 'active',
  ende: string | null = null,
) => ({
  group: { domainIdentifier: String(gruppe), title: `Gruppe ${gruppe}` },
  groupTypeRoleId: rolle,
  groupMemberStatus: status,
  memberEndDate: ende,
});
const ROLLEN = [
  { id: 2, isLeader: true },
  { id: 3, isLeader: false },
];

describe('istAdmin', () => {
  it('Admin ist, wer „Gruppen verwalten“ hat (`churchdb → administer groups`)', () => {
    expect(istAdmin({ churchdb: { 'administer groups': true } })).toBe(true);
    expect(istAdmin({ churchdb: { 'administer groups': false } })).toBe(false);
    expect(istAdmin({ churchdb: {} })).toBe(false);
  });

  it('fehlende oder fremde Rechteantwort: kein Admin', () => {
    expect(istAdmin(null)).toBe(false);
    expect(istAdmin(undefined)).toBe(false);
    expect(istAdmin({})).toBe(false);
    expect(istAdmin({ churchcore: { 'administer groups': true } })).toBe(false);
    expect(istAdmin({ churchdb: { 'administer groups': 'true' } })).toBe(false);
  });
});

describe('leitetGruppe', () => {
  it('Leitung der gewählten Gruppe: ja', () => {
    expect(leitetGruppe([mitglied(7, 2)], ROLLEN, 7)).toBe(true);
  });

  it('Mitarbeiter (Rolle ohne Leitung) der Gruppe: nein', () => {
    expect(leitetGruppe([mitglied(7, 3)], ROLLEN, 7)).toBe(false);
  });

  it('Leitung einer ANDEREN Gruppe: nein', () => {
    expect(leitetGruppe([mitglied(9, 2)], ROLLEN, 7)).toBe(false);
  });

  it('nicht mehr aktive oder beendete Mitgliedschaft zählt nicht', () => {
    expect(leitetGruppe([mitglied(7, 2, 'requested')], ROLLEN, 7)).toBe(false);
    expect(leitetGruppe([mitglied(7, 2, 'active', '2026-01-01')], ROLLEN, 7)).toBe(false);
  });

  it('Rolle unbekannt (nicht in der Rollenliste): keine Leitung – lieber eine zu wenig', () => {
    expect(leitetGruppe([mitglied(7, 99)], ROLLEN, 7)).toBe(false);
  });

  it('keine Mitgliedschaften oder keine Rollen: nein', () => {
    expect(leitetGruppe(null, ROLLEN, 7)).toBe(false);
    expect(leitetGruppe([mitglied(7, 2)], null, 7)).toBe(false);
    expect(leitetGruppe([], [], 7)).toBe(false);
  });
});

/** Der Block des Moduls in `GET /permissions/global`, wie ChurchTools ihn liefert (gemessen W3b-0: `create custom data: [104, 107]`). */
const global = (schreiben: Record<string, unknown>) => ({
  [MODUL_KUERZEL]: { view: true, ...schreiben },
});
const schreibt = (ids: number[]) =>
  global({
    'create custom data': ids,
    'edit custom data': ids,
    'delete custom data': ids,
  });

describe('schreibtIn (aus den EIGENEN Rechten)', () => {
  it('liest, wo die Person anlegen, ändern UND löschen darf', () => {
    expect(schreibtIn(schreibt([104, 107]))).toEqual([104, 107]);
    expect(schreibtIn(schreibt([104]))).toEqual([104]);
  });

  it('nur anlegen (ohne ändern/löschen) zählt nicht – Speichern bräche mittendrin ab', () => {
    expect(
      schreibtIn(
        global({
          'create custom data': [104, 107],
          'edit custom data': [104],
          'delete custom data': [104, 107],
        }),
      ),
    ).toEqual([104]);
  });

  it('kein Block des Moduls, fremdes Modul, leere Antwort: keine', () => {
    expect(schreibtIn({})).toEqual([]);
    expect(schreibtIn(null)).toEqual([]);
    expect(schreibtIn({ protokolle: { 'create custom data': [104] } })).toEqual([]);
  });
});

/** Die Website wie eingerichtet – Gruppen-, Kategorie- und Rollen-IDs bewusst verschieden (Messung W3b-4-0). */
const WEBSITE = { gruppe: 344, entwuerfe: 104, veroeffentlicht: 107 };
const zugang = (
  admin: boolean,
  schreibt: number[],
  website:
    | typeof WEBSITE
    | { gruppe: number; entwuerfe: number | null; veroeffentlicht: number | null }
    | null = WEBSITE,
  meineGruppen: number[] = [344],
) => zugangFuer({ admin, schreibt, website, untergruppen: [], meineGruppen });

describe('zugangFuer (ohne Untergruppen – wie bis W3b-4a)', () => {
  it('Admin → Leitung der Website, hat Vorrang vor allem (auch ohne Rechte und vor der Einrichtung)', () => {
    expect(zugang(true, [])).toEqual(WEBSITE_LEITUNG);
    expect(zugang(true, [104, 107])).toEqual(WEBSITE_LEITUNG);
    expect(zugang(true, [], null)).toEqual(WEBSITE_LEITUNG);
  });

  it('schreibt in Entwürfe UND Veröffentlicht → Leitung der Website', () => {
    expect(zugang(false, [104, 107])).toEqual(WEBSITE_LEITUNG);
  });

  it('schreibt nur in Entwürfe, Mitglied der Website → Redakteur der Website', () => {
    expect(zugang(false, [104])).toEqual(WEBSITE_REDAKTEUR);
  });

  it('keine Rechte → keiner', () => {
    expect(zugang(false, [])).toBeNull();
  });

  it('Rechte an FREMDEN Kategorien zählen nicht', () => {
    expect(zugang(false, [1, 2, 3, 999])).toBeNull();
    expect(zugang(false, [999, 104])).toEqual(WEBSITE_REDAKTEUR);
  });

  it('nur in „Veröffentlicht“ schreiben (ohne Entwürfe): kein Zugang – der Editor arbeitet in Entwürfen', () => {
    expect(zugang(false, [107])).toBeNull();
  });

  it('nicht eingerichtet (keine Kategorien): nur der Admin', () => {
    expect(zugang(false, [104, 107], null)).toBeNull();
    expect(
      zugang(false, [104], { gruppe: 344, entwuerfe: null, veroeffentlicht: null }),
    ).toBeNull();
    expect(zugang(false, [104], { gruppe: 344, entwuerfe: 104, veroeffentlicht: null })).toEqual(
      WEBSITE_REDAKTEUR,
    );
  });
});

describe('Was ein Zugang darf (E-W12, E-W22)', () => {
  it('Eigenes HTML: Admin und Leitung, nie ein Redakteur oder wer keinen Zugang hat', () => {
    expect(darfEigenesHtml(WEBSITE_LEITUNG)).toBe(true);
    expect(darfEigenesHtml(WEBSITE_REDAKTEUR)).toBe(false);
    expect(darfEigenesHtml(null)).toBe(false);
  });

  it('Aussehen, Einstellungen und Menü: Admin und Leitung, nie ein Redakteur', () => {
    expect(darfAussehenUndMenue(WEBSITE_LEITUNG)).toBe(true);
    expect(darfAussehenUndMenue(WEBSITE_REDAKTEUR)).toBe(false);
    expect(darfAussehenUndMenue(null)).toBe(false);
  });
});

// ── Bereiche (W3b-4b, E-W31) ─────────────────────────────────────────────────────────────────────────────────────────────
// Realistisch und VERSCHIEDEN (Messung W3b-4-0): Website 344 (Entwürfe 104, Veröffentlicht 107), Jugend 347 (Kategorie 117),
// Technik 348 (Kategorie 118); 349 ist eine Untergruppe, die nicht eingerichtet ist (keine Kategorie).
const UNTER = [
  { gruppe: 347, kategorie: 117 },
  { gruppe: 348, kategorie: 118 },
];
const mit = (schreibt: number[], meineGruppen: number[], admin = false) =>
  zugangFuer({ admin, schreibt, website: WEBSITE, untergruppen: UNTER, meineGruppen });

describe('zugangFuer mit Untergruppen (W3b-4b)', () => {
  it('Leitung der Website (schreibt 104 + 107): alles – auch wenn sie zusätzlich in einer Untergruppe ist', () => {
    expect(mit([104, 107], [])).toEqual(WEBSITE_LEITUNG);
    expect(mit([104, 107, 117], [347])).toEqual(WEBSITE_LEITUNG);
    expect(mit([], [], true)).toEqual(WEBSITE_LEITUNG);
  });

  it('Leitung einer Untergruppe (schreibt 104 + 117, nicht 107): sieht und leitet nur Jugend', () => {
    expect(mit([104, 117], [347])).toEqual({ sieht: [347], leitet: [347] });
    // Auch ohne Mitgliedschaft (Rechte über eine andere Rolle): Was sie leitet, sieht sie.
    expect(mit([104, 117], [])).toEqual({ sieht: [347], leitet: [347] });
    expect(mit([104, 117, 118], [])).toEqual({ sieht: [347, 348], leitet: [347, 348] });
  });

  it('Leitung einer Untergruppe, zugleich Mitglied der Website: sieht alle Seiten, leitet nur Jugend', () => {
    expect(mit([104, 117], [344, 347])).toEqual({ sieht: 'alle', leitet: [347] });
  });

  it('Redakteur: welcher Bereich, sagen die Mitgliedschaften – die Website geht vor', () => {
    expect(mit([104], [344])).toEqual(WEBSITE_REDAKTEUR);
    expect(mit([104], [347])).toEqual({ sieht: [347], leitet: [] });
    expect(mit([104], [347, 348])).toEqual({ sieht: [347, 348], leitet: [] });
    // Website geht vor: Mitglied der Website UND von Jugend sieht alle Seiten.
    expect(mit([104], [347, 344])).toEqual(WEBSITE_REDAKTEUR);
  });

  it('Redakteur in keiner der Gruppen (oder nur in einer NICHT eingerichteten Untergruppe): ohne Bereich – sieht keine Seiten', () => {
    for (const gruppen of [[], [349], [999]]) {
      const z = mit([104], gruppen);
      expect(z).toEqual({ sieht: [], leitet: [] });
      expect(ohneBereich(z)).toBe(true);
      expect(sichtbareSeiten([{ bereich: undefined }, { bereich: 347 }], z)).toEqual([]);
    }
    expect(ohneBereich(WEBSITE_REDAKTEUR)).toBe(false);
    expect(ohneBereich({ sieht: [347], leitet: [] })).toBe(false);
    expect(ohneBereich(null)).toBe(false);
  });

  it('schreibt nur in die Kategorie einer Untergruppe, nicht in Entwürfe: kein Zugang (der Editor arbeitet in Entwürfen)', () => {
    expect(mit([117], [347])).toBeNull();
  });

  it('die Kategorie-ID zählt, nicht die Gruppen-ID: wer in „347“ schreiben dürfte (es gibt keine Kategorie 347), leitet nichts', () => {
    expect(mit([104, 347], [347])).toEqual({ sieht: [347], leitet: [] });
  });
});

describe('Was ein Zugang mit Bereich darf (W3b-4b)', () => {
  const JUGEND_LEITUNG = { sieht: [347], leitet: [347] };
  const JUGEND_REDAKTEUR = { sieht: [347], leitet: [] };

  it('freigeben: Website-Leitung überall, Untergruppen-Leitung nur ihr Bereich, Redakteur nie', () => {
    expect(darfFreigeben(WEBSITE_LEITUNG, null)).toBe(true);
    expect(darfFreigeben(WEBSITE_LEITUNG, 347)).toBe(true);
    expect(darfFreigeben(JUGEND_LEITUNG, 347)).toBe(true);
    expect(darfFreigeben(JUGEND_LEITUNG, 348)).toBe(false);
    expect(darfFreigeben(JUGEND_LEITUNG, null)).toBe(false);
    expect(darfFreigeben(JUGEND_REDAKTEUR, 347)).toBe(false);
    expect(darfFreigeben(WEBSITE_REDAKTEUR, null)).toBe(false);
    expect(darfFreigeben(null, null)).toBe(false);
  });

  it('Aussehen, Einstellungen, Menü, eigenes HTML, Startseite, Bereich: nur Website-Leitung – nie die Leitung einer Untergruppe', () => {
    for (const z of [JUGEND_LEITUNG, { sieht: 'alle' as const, leitet: [347] }]) {
      expect(darfAussehenUndMenue(z)).toBe(false);
      expect(darfEigenesHtml(z)).toBe(false);
      expect(leitetWebsite(z)).toBe(false);
      expect(leitetEtwas(z)).toBe(true);
    }
    expect(leitetWebsite(WEBSITE_LEITUNG)).toBe(true);
    expect(leitetEtwas(WEBSITE_REDAKTEUR)).toBe(false);
    expect(leitetEtwas(JUGEND_REDAKTEUR)).toBe(false);
  });

  it('sichtbar: Untergruppen sehen nur Seiten ihrer Bereiche, die Website alle; ohne Feld gehört die Seite der Website', () => {
    const seiten = [
      { id: 'w', bereich: undefined },
      { id: 'j', bereich: 347 },
      { id: 't', bereich: 348 },
    ];
    expect(sichtbareSeiten(seiten, JUGEND_REDAKTEUR).map((s) => s.id)).toEqual(['j']);
    expect(sichtbareSeiten(seiten, WEBSITE_REDAKTEUR).map((s) => s.id)).toEqual(['w', 'j', 't']);
    expect(sichtbareSeiten(seiten, null)).toEqual([]);
    expect(bereichVon({})).toBeNull();
    expect(bereichVon({ bereich: 347 })).toBe(347);
    expect(siehtBereich(JUGEND_LEITUNG, null)).toBe(false);
  });

  it('neue Seite: wer alle sieht, legt für die Website an; sonst für seine Untergruppe(n)', () => {
    expect(bereicheFuerNeueSeite(WEBSITE_LEITUNG)).toEqual([null]);
    expect(bereicheFuerNeueSeite(WEBSITE_REDAKTEUR)).toEqual([null]);
    expect(bereicheFuerNeueSeite(JUGEND_REDAKTEUR)).toEqual([347]);
    expect(bereicheFuerNeueSeite({ sieht: [347, 348], leitet: [] })).toEqual([347, 348]);
  });

  it('eigene Gruppen kommen aus `meineGruppen`: nur aktive, nicht beendete Mitgliedschaften', () => {
    expect(
      meineGruppenIds(
        [
          mitglied(344, 15),
          mitglied(347, 15, 'requested'),
          mitglied(348, 15, 'active', '2026-01-01'),
        ],
        [],
      ),
    ).toEqual([344]);
  });
});
