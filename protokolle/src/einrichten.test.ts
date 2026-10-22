import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ApiError, NichtUebernommen } from '@ui/ct/fehler';
import { STANDARD_VORLAGEN } from '@shared/protokolle/vorlagen';
import { gruppeEinrichten, ladeGruppe, ladeVerwaltung, type Wahl } from './einrichten';
import {
  kategorieVon,
  LEITER,
  MODUL,
  N,
  nachbauEnde,
  nachbauStarten,
  rechteVon,
  schl,
  TEILNEHMER,
  type Nachbau,
} from './nachbau.testhilfe';

/** Einrichten (S2-1/S2-2) gegen die nachgestellte ChurchTools-Instanz (`nachbau.testhilfe.ts`). */
let ct: Nachbau;
beforeEach(() => {
  ct = nachbauStarten();
});
afterEach(nachbauEnde);

const von = (rolle: number): string[] => rechteVon(ct, rolle);

const GRUPPE = { id: 194, name: 'Technik', versteckt: false };
const WAHL: Wahl = {
  rollen: [
    { rolle: LEITER, stufe: 'leitung' },
    { rolle: TEILNEHMER, stufe: 'mitglied' },
  ],
  punkte: 'vorschlagen',
  kalender: 4,
};
const kat = (shorty: string): number => kategorieVon(ct, shorty);
const einstellungen = (): unknown[] =>
  (ct.werte.get(kat('protokolle-g194')) ?? [])
    .map((w) => JSON.parse(w.value) as { art: string })
    .filter((x) => x.art === 'einstellung');

describe('gruppeEinrichten', () => {
  it('erstes Einrichten: Kategorien, Rechte je Stufe, Einstellung, drei Standard-Vorlagen', async () => {
    const e = await gruppeEinrichten(MODUL, GRUPPE, WAHL);
    expect(ct.kategorien.map((k) => [k.shorty, k.name])).toEqual([
      ['protokolle-g194', 'Protokolle · Technik'],
      ['mitarbeit-g194', 'Mitarbeit · Technik'],
      ['vorlagen', 'Vorlagen'],
    ]);
    const [p, mi, vo] = [kat('protokolle-g194'), kat('mitarbeit-g194'), kat('vorlagen')];
    expect(von(TEILNEHMER)).toEqual(
      [
        schl(N.view, null),
        ...[p, mi, vo].flatMap((k) => [schl(N.kat, k), schl(N.dat, k)]),
        schl(N.anl, mi),
        schl(N.aend, mi),
        schl(403, 4),
      ].sort(),
    );
    expect(von(LEITER)).toEqual(
      expect.arrayContaining([schl(N.aend, p), schl(N.loe, p), schl(404, 4)]),
    );
    expect(einstellungen()).toEqual([e]);
    expect(e).toMatchObject({ gruppe: 194, punkte: 'vorschlagen', kalender: 4 });
    const vorlagen = (ct.werte.get(vo) ?? []).map(
      (w) => (JSON.parse(w.value) as { name: string }).name,
    );
    expect(vorlagen).toEqual(STANDARD_VORLAGEN.map((v) => v.name));
  });

  it('versteckte Gruppe: jede Rolle mit Zugriff bekommt „versteckte Gruppe sehen“ (10119)', async () => {
    await gruppeEinrichten(MODUL, { ...GRUPPE, versteckt: true }, WAHL);
    expect(von(TEILNEHMER)).toContain(schl(10119, null));
    expect(von(LEITER)).toContain(schl(10119, null));
  });

  it('erneut einrichten mit Herabstufung: entzieht, schiebt danach ein PUT nach, ändert die Einstellung', async () => {
    await gruppeEinrichten(MODUL, GRUPPE, WAHL);
    const p = kat('protokolle-g194');
    ct.aufrufe = [];
    await gruppeEinrichten(MODUL, GRUPPE, {
      ...WAHL,
      rollen: [
        { rolle: LEITER, stufe: 'mitglied' },
        { rolle: TEILNEHMER, stufe: 'keine' },
      ],
      punkte: 'direkt',
    });
    expect(von(LEITER)).not.toContain(schl(N.aend, p));
    expect(von(TEILNEHMER).filter((s) => /^20(61|65|66|67):/.test(s))).toEqual([]);
    // Nach dem letzten DELETE muss noch ein PUT kommen – sonst wirkt der Entzug weiter (S0, S2-1).
    const rechteAufrufe = ct.aufrufe.filter((a) => /^(PUT|DELETE) \/permissions/.test(a));
    expect(rechteAufrufe.some((a) => a.startsWith('DELETE'))).toBe(true);
    const letztesDelete = rechteAufrufe.map((a) => a.startsWith('DELETE')).lastIndexOf(true);
    expect(rechteAufrufe.slice(letztesDelete + 1).some((a) => a.startsWith('PUT'))).toBe(true);
    // Eine Einstellung, geändert – nicht eine zweite daneben.
    expect(einstellungen()).toEqual([expect.objectContaining({ punkte: 'direkt' })]);
  });

  it('Herabstufen/Kalender weg: selbst gesetzte Kalender-Rechte gehen, von Hand gesetzte bleiben', async () => {
    ct.rechte.set(LEITER, new Set([schl(403, 4)])); // von Hand, vor dem Einrichten
    await gruppeEinrichten(MODUL, GRUPPE, WAHL);
    expect(von(LEITER)).toContain(schl(404, 4));
    expect(von(TEILNEHMER)).toContain(schl(403, 4));
    await gruppeEinrichten(MODUL, GRUPPE, {
      ...WAHL,
      rollen: [
        { rolle: LEITER, stufe: 'leitung' },
        { rolle: TEILNEHMER, stufe: 'keine' },
      ],
      kalender: null,
    });
    expect(von(TEILNEHMER)).not.toContain(schl(403, 4));
    expect(von(LEITER)).not.toContain(schl(404, 4));
    expect(von(LEITER)).toContain(schl(403, 4)); // von Hand – bleibt
    expect(einstellungen()).toEqual([expect.objectContaining({ vergeben: [] })]);
  });

  it('Rolle fehlt in der neuen Wahl (z. B. gelöscht): ihre selbst gesetzten Kalender-Rechte gehen trotzdem', async () => {
    await gruppeEinrichten(MODUL, GRUPPE, WAHL);
    await gruppeEinrichten(MODUL, GRUPPE, {
      ...WAHL,
      rollen: [{ rolle: LEITER, stufe: 'leitung' }],
    });
    expect(von(TEILNEHMER)).not.toContain(schl(403, 4));
  });

  it('Vorlagen schon da: keine zweiten Standard-Vorlagen', async () => {
    await gruppeEinrichten(MODUL, GRUPPE, WAHL);
    await gruppeEinrichten(MODUL, { id: 11, name: 'Gemeindeleitung', versteckt: true }, WAHL);
    expect(ct.werte.get(kat('vorlagen'))).toHaveLength(STANDARD_VORLAGEN.length);
  });

  it('ChurchTools sagt 204, setzt aber nichts: NichtUebernommen – und KEINE Einstellung („eingerichtet“)', async () => {
    ct.schlucken.add(`PUT ${schl(N.dat, 50)}`); // Daten sehen auf „Protokolle“ (erste Kategorie, ID 50)
    await expect(gruppeEinrichten(MODUL, GRUPPE, WAHL)).rejects.toBeInstanceOf(NichtUebernommen);
    expect(einstellungen()).toEqual([]);
  });

  it('Einstellung mit 201 quittiert, aber nicht gespeichert: NichtUebernommen statt „eingerichtet“', async () => {
    ct.schluckeWert = (v) => v.includes('"einstellung"');
    await expect(gruppeEinrichten(MODUL, GRUPPE, WAHL)).rejects.toThrow(
      'die Einstellung der Gruppe',
    );
  });

  it('ein nicht übernommener Entzug wird ebenso gemeldet', async () => {
    await gruppeEinrichten(MODUL, GRUPPE, WAHL);
    ct.schlucken.add(`DELETE ${schl(N.aend, kat('protokolle-g194'))}`);
    await expect(
      gruppeEinrichten(MODUL, GRUPPE, { ...WAHL, rollen: [{ rolle: LEITER, stufe: 'mitglied' }] }),
    ).rejects.toBeInstanceOf(NichtUebernommen);
  });

  it('vorübergehender Fehler beim Setzen: wirft, schreibt keine Einstellung, löscht nichts', async () => {
    ct.fehlerBei = { methode: 'PUT', status: 503 };
    await expect(gruppeEinrichten(MODUL, GRUPPE, WAHL)).rejects.toBeInstanceOf(ApiError);
    expect(ct.aufrufe.some((a) => a.startsWith('DELETE'))).toBe(false);
    expect(einstellungen()).toEqual([]);
  });

  it('Modul ohne Rechte-Definitionen: 404, es wird nichts angelegt', async () => {
    ct.definitionen = { modules: [] };
    await expect(gruppeEinrichten(MODUL, GRUPPE, WAHL)).rejects.toMatchObject({ status: 404 });
    expect(ct.aufrufe.filter((a) => !a.startsWith('GET'))).toEqual([]);
  });
});

describe('ladeVerwaltung / ladeGruppe', () => {
  it('ohne Admin-Recht: darf nicht, und es werden keine Gruppen gelesen', async () => {
    ct.admin = false;
    expect(await ladeVerwaltung(MODUL)).toEqual({ darf: false, gruppen: [], kalender: [] });
    expect(ct.aufrufe).toEqual(['GET /permissions/global']);
  });

  it('Admin: alle Gruppen nach Namen, versteckt markiert, eingerichtet nur mit beiden Kategorien', async () => {
    await gruppeEinrichten(MODUL, GRUPPE, WAHL);
    ct.kategorien.push({ id: 99, shorty: 'protokolle-g11', name: 'Protokolle · Gemeindeleitung' });
    const v = await ladeVerwaltung(MODUL);
    expect(v.gruppen).toEqual([
      { id: 11, name: 'Gemeindeleitung', versteckt: true, eingerichtet: false },
      { id: 194, name: 'Technik', versteckt: false, eingerichtet: true },
    ]);
    expect(v.kalender).toEqual([{ id: 4, name: 'Gemeindeleitung' }]);
  });

  it('ladeGruppe: aktive Rollen und die gespeicherte Einstellung', async () => {
    expect((await ladeGruppe(MODUL, 194)).einstellung).toBeNull();
    const e = await gruppeEinrichten(MODUL, GRUPPE, WAHL);
    const g = await ladeGruppe(MODUL, 194);
    expect(g.rollen).toEqual([
      { id: LEITER, name: 'Leiter', leitung: true },
      { id: TEILNEHMER, name: 'Teilnehmer', leitung: false },
    ]);
    expect(g.einstellung).toEqual(e);
  });
});
