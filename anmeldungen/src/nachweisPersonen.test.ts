import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as V from '@ui/ct/verbindung';
import { ApiError } from '@ui/ct/fehler';
import { _vergissGemeindeZeitzone, merkeGemeindeZeitzone } from '@shared/ct/zeit';
import {
  ERGEBNIS_EINTRAG,
  ERGEBNIS_OHNE,
  NACHWEIS_FELDER,
  nachweisNotiz,
  type NachweisEinstellungen,
} from '@shared/anmeldung/nachweise';
import { antragVorgabe } from '@shared/anmeldung/nachweisAntrag';
import { nachweisPersonenLesen, personenMitStand } from './nachweisPersonen';
import { nachweisArtenLesen, nachweisEinstieg, nachweiseSeiteLaden } from './nachweisArten';
import { FalschesNachweisCt } from './nachweisArten.testutil';

/**
 * Der Stand je Person lesen (N2a) gegen ein nachgestelltes ChurchTools. Felder, Optionen und Aufgaben sind so gebaut, wie die
 * Test-Instanz am 20.11.2026 geantwortet hat: Felder MIT Namen, „Ergebnis“ als Nummer der Option, Aufgaben samt erledigter.
 */
vi.mock('@ui/ct/verbindung', () => ({
  ctAnfrage: vi.fn(),
  ctDaten: vi.fn(),
  ctAlleSeiten: vi.fn(),
}));
const ct = vi.mocked(V);

let falsch: FalschesNachweisCt;

const E: NachweisEinstellungen = {
  gueltigJahre: 3,
  ab: 'ausstellung',
  betreff: 'Betreff',
  text: 'Hallo [Vorname]',
};
const E_ANTRAG: NachweisEinstellungen = { ...E, antrag: antragVorgabe('ECG Donrath') };
const TEILNEHMER = 53;
const LEITER = 56;
const OHNE_ADMIN = { churchcore: { 'view birthdays': true }, churchdb: { 'view alldata': true } };

beforeEach(() => {
  // Die Uhr der Gemeinde: wie ChurchTools meldet (nicht die des Geräts, die im Test UTC ist).
  merkeGemeindeZeitzone({ timezone: 'Europe/Berlin' });
  falsch = new FalschesNachweisCt().mitArt();
  ct.ctDaten.mockReset().mockImplementation((pfad: string) => falsch.holen(pfad));
  ct.ctAlleSeiten.mockReset().mockImplementation((pfad: string) => falsch.alleSeiten(pfad));
  ct.ctAnfrage.mockReset();
});
afterEach(() => _vergissGemeindeZeitzone());

/** Eine Art mit ihren drei Feldern (Optionen mit Nummern) und den Teilnehmern, wie die Erweiterung sie anlegt. */
function art(e: NachweisEinstellungen | null = E, name = 'Nachweis: Führungszeugnis') {
  const g = falsch.gruppeAnlegen(name, e ? nachweisNotiz(e) : null);
  falsch.felder.set(
    g.id,
    NACHWEIS_FELDER.map((f, i) => ({
      id: 500 + i,
      name: f.name,
      fieldTypeCode: f.fieldTypeCode,
      securityLevel: 4,
      useInRegistrationForm: false,
      requiredInRegistrationForm: false,
      ...('optionen' in f
        ? { options: f.optionen.map((o, j) => ({ id: String(335 + j * 3), name: o })) }
        : {}),
    })),
  );
  return g;
}
const dabei = (g: number, personId: number, titel: string, extra = {}) =>
  falsch.mitgliedSetzen(g, { personId, title: titel, groupTypeRoleId: TEILNEHMER, ...extra });
const person = (id: number, extra: Partial<Parameters<typeof falsch.personen.set>[1]> = {}) =>
  falsch.personen.set(id, {
    id,
    firstName: 'P',
    lastName: String(id),
    birthday: '1990-01-01',
    street: 'Hauptstr. 4',
    zip: '53797',
    city: 'Lohmar',
    ...extra,
  });

describe('Personen einer Nachweis-Art lesen', () => {
  it('liest die Felder nach NAMEN und das Ergebnis als Option: Nummer → Name', async () => {
    const g = art();
    dabei(g.id, 10, 'Anna Eins');
    dabei(g.id, 11, 'Ben Zwei');
    dabei(g.id, 12, 'Cleo Drei');
    falsch.feldSetzen(g.id, 10, NACHWEIS_FELDER[0].name, '2026-11-03');
    falsch.feldSetzen(g.id, 10, NACHWEIS_FELDER[1].name, '2026-10-20');
    falsch.feldSetzen(
      g.id,
      10,
      NACHWEIS_FELDER[2].name,
      falsch.optionsNummer(g.id, NACHWEIS_FELDER[2].name, ERGEBNIS_EINTRAG),
    );
    falsch.feldSetzen(
      g.id,
      11,
      NACHWEIS_FELDER[2].name,
      falsch.optionsNummer(g.id, NACHWEIS_FELDER[2].name, ERGEBNIS_OHNE),
    );
    const l = (await nachweisPersonenLesen({ id: g.id, einstellungen: E }, TEILNEHMER))!;
    expect(l.map((p) => p.name)).toEqual(['Anna Eins', 'Ben Zwei', 'Cleo Drei']);
    expect(l[0]).toMatchObject({
      personId: 10,
      eingesehenAm: '2026-11-03',
      ausgestelltAm: '2026-10-20',
      ergebnis: 'eintrag',
      aufgabe: null,
    });
    expect(l[1]).toMatchObject({ ergebnis: 'ohne', eingesehenAm: null, ausgestelltAm: null });
    // Nichts eingetragen: leer, nicht „ohne“.
    expect(l[2].ergebnis).toBeNull();
  });

  it('die Nummer der Option kommt aus der Gruppe: eine fremde Nummer ist kein Ergebnis', async () => {
    const g = art();
    dabei(g.id, 10, 'Anna Eins');
    falsch.feldSetzen(g.id, 10, NACHWEIS_FELDER[2].name, '999');
    const l = (await nachweisPersonenLesen({ id: g.id, einstellungen: E }, TEILNEHMER))!;
    expect(l[0].ergebnis).toBeNull();
  });

  it('Leiter stehen nicht in der Liste, inaktive Mitglieder ebenfalls', async () => {
    const g = art();
    dabei(g.id, 10, 'Anna Eins');
    falsch.mitgliedSetzen(g.id, { personId: 7, title: 'Lea Leitung', groupTypeRoleId: LEITER });
    dabei(g.id, 11, 'Ben Weg', { groupMemberStatus: 'to_delete' });
    dabei(g.id, 12, 'Cleo Wartet', { groupMemberStatus: 'requested' });
    const l = (await nachweisPersonenLesen({ id: g.id, einstellungen: E }, TEILNEHMER))!;
    expect(l.map((p) => p.personId)).toEqual([10]);
  });

  it('offene Aufgaben: der Tag der Anlage in der Uhr der Gemeinde; erledigte und fremde zählen nicht', async () => {
    const g = art();
    for (const id of [10, 11, 12, 13]) dabei(g.id, id, `P ${id}`);
    // 23:30 UTC am 19.11. ist in Berlin schon der 20.11.
    falsch.aufgabeSetzen(g.id, { personId: 10, createdDate: '2026-11-19T23:30:00Z' });
    falsch.aufgabeSetzen(g.id, {
      personId: 11,
      doneDate: '2026-11-01',
      createdDate: '2026-10-01T10:00:00Z',
    });
    falsch.aufgabeSetzen(g.id, {
      personId: 12,
      title: 'Kaffee kochen',
      createdDate: '2026-10-01T10:00:00Z',
    });
    falsch.aufgabeSetzen(g.id, {
      personId: 13,
      title: 'Erneut einsehen',
      createdDate: '2026-11-02T10:00:00Z',
    });
    const l = (await nachweisPersonenLesen({ id: g.id, einstellungen: E }, TEILNEHMER))!;
    expect(l.map((p) => p.aufgabe)).toEqual([
      { seit: '2026-11-20' },
      null,
      null,
      { seit: '2026-11-02' },
    ]);
  });

  it('Aufgabe ohne Anlagedatum: der Beginn der Mitgliedschaft; mehrere offene: die älteste – in jeder Reihenfolge', async () => {
    const g = art();
    dabei(g.id, 10, 'Anna Eins', { memberStartDate: '2026-10-05' });
    dabei(g.id, 11, 'Ben Zwei');
    dabei(g.id, 12, 'Cleo Drei');
    falsch.aufgabeSetzen(g.id, { personId: 10, createdDate: null });
    // Ben: erst die neuere, dann die ältere; Cleo: erst die ältere, dann die neuere.
    falsch.aufgabeSetzen(g.id, { personId: 11, createdDate: '2026-11-10T10:00:00Z' });
    falsch.aufgabeSetzen(g.id, {
      personId: 11,
      title: 'Erneut einsehen',
      createdDate: '2026-11-01T10:00:00Z',
    });
    falsch.aufgabeSetzen(g.id, { personId: 12, createdDate: '2026-11-01T10:00:00Z' });
    falsch.aufgabeSetzen(g.id, {
      personId: 12,
      title: 'Erneut einsehen',
      createdDate: '2026-11-10T10:00:00Z',
    });
    const l = (await nachweisPersonenLesen({ id: g.id, einstellungen: E }, TEILNEHMER))!;
    expect(l[0].aufgabe).toEqual({ seit: '2026-10-05' });
    expect(l[1].aufgabe).toEqual({ seit: '2026-11-01' });
    expect(l[2].aufgabe).toEqual({ seit: '2026-11-01' });
  });

  it('die Felder werden nach ihrem NAMEN gefunden, nicht nach einer Nummer (ChurchTools nummeriert je Gruppe)', async () => {
    const g = art();
    dabei(g.id, 10, 'Anna Eins');
    falsch.feldSetzen(g.id, 10, NACHWEIS_FELDER[0].name, '2026-11-03');
    // Die Mitglieder-Antwort trägt andere Nummern als die Felddefinition – nur der Name verbindet beide.
    const echt = ct.ctAlleSeiten.getMockImplementation()!;
    ct.ctAlleSeiten.mockImplementation(async (pfad: string, limit?: number) => {
      const liste = (await echt(pfad, limit)) as { fields?: { id: number }[] }[];
      return liste.map((m) => ({
        ...m,
        fields: m.fields?.map((f) => ({ ...f, id: f.id + 7000 })),
      }));
    });
    const l = (await nachweisPersonenLesen({ id: g.id, einstellungen: E }, TEILNEHMER))!;
    expect(l[0].eingesehenAm).toBe('2026-11-03');
  });

  it('Mitglieder nicht lesbar (403): null, nicht „niemand“ – ebenso die Aufgaben', async () => {
    const g = art();
    falsch.ohneMitgliederRecht.add(g.id);
    expect(await nachweisPersonenLesen({ id: g.id, einstellungen: E }, TEILNEHMER)).toBeNull();
    falsch.ohneMitgliederRecht.clear();
    falsch.ohneAufgabenRecht.add(g.id);
    expect(await nachweisPersonenLesen({ id: g.id, einstellungen: E }, TEILNEHMER)).toBeNull();
  });

  it('ein vorübergehender Fehler (500/503) wirft – bei Mitgliedern, Aufgaben und Personen', async () => {
    const g = art(E_ANTRAG);
    dabei(g.id, 10, 'Anna Eins');
    const lesen = () => nachweisPersonenLesen({ id: g.id, einstellungen: E_ANTRAG }, TEILNEHMER);
    for (const teil of ['/members', '/followups', '/persons?']) {
      ct.ctAlleSeiten.mockImplementation(async (pfad: string) => {
        if (teil === '/members' && pfad.includes(teil)) throw new ApiError(500, 'weg');
        return await falsch.alleSeiten(pfad);
      });
      ct.ctDaten.mockImplementation(async (pfad: string) => {
        if (teil !== '/members' && pfad.includes(teil)) throw new ApiError(503, 'weg');
        return await falsch.holen(pfad);
      });
      await expect(lesen(), teil).rejects.toBeInstanceOf(ApiError);
    }
  });

  it('Profil (Geburtstag, Adresse) nur bei Arten mit Antrag gelesen', async () => {
    const g = art(E_ANTRAG);
    dabei(g.id, 10, 'Anna Eins');
    person(10, { birthday: null, city: '' });
    const l = (await nachweisPersonenLesen({ id: g.id, einstellungen: E_ANTRAG }, TEILNEHMER))!;
    expect(l[0].profil).toEqual({
      geburtstag: null,
      strasse: 'Hauptstr. 4',
      plz: '53797',
      ort: null,
    });

    const h = art(E, 'Nachweis: JuLeiCa');
    dabei(h.id, 10, 'Anna Eins');
    ct.ctDaten.mockClear();
    const m = (await nachweisPersonenLesen({ id: h.id, einstellungen: E }, TEILNEHMER))!;
    expect(m[0].profil).toBeNull();
    expect(ct.ctDaten.mock.calls.some(([p]) => String(p).startsWith('/persons?'))).toBe(false);
  });

  it('Profil nicht lesbar (403): kein Hinweis, aber der Rest steht (kein falscher Alarm)', async () => {
    const g = art(E_ANTRAG);
    dabei(g.id, 10, 'Anna Eins');
    falsch.ohnePersonenRecht = true;
    const l = (await nachweisPersonenLesen({ id: g.id, einstellungen: E_ANTRAG }, TEILNEHMER))!;
    expect(l).toHaveLength(1);
    expect(l[0].profil).toBeNull();
  });

  it('ohne Teilnehmer-Rolle (nicht gefunden): niemand', async () => {
    const g = art();
    dabei(g.id, 10, 'Anna Eins');
    expect(await nachweisPersonenLesen({ id: g.id, einstellungen: E }, null)).toEqual([]);
  });

  it('personenMitStand: sortiert (wer dich braucht zuerst) und mit „Gültig bis“; nicht sichtbar → null', async () => {
    const g = art(E_ANTRAG);
    dabei(g.id, 10, 'Zoe Gültig');
    dabei(g.id, 11, 'Anna Fehlt');
    falsch.feldSetzen(g.id, 10, NACHWEIS_FELDER[0].name, '2026-11-03');
    falsch.feldSetzen(g.id, 10, NACHWEIS_FELDER[1].name, '2026-10-20');
    falsch.aufgabeSetzen(g.id, { personId: 11, createdDate: '2026-09-01T10:00:00Z' });
    person(10);
    person(11, { street: null });
    const personen = await nachweisPersonenLesen({ id: g.id, einstellungen: E_ANTRAG }, TEILNEHMER);
    const l = personenMitStand({ einstellungen: E_ANTRAG, personen }, '2026-11-20')!;
    expect(l.map((p) => [p.name, p.stand.art, p.gueltigBis, p.luecke])).toEqual([
      ['Anna Fehlt', 'fehlt', null, 'Antrag unvollständig: Adresse fehlt'],
      ['Zoe Gültig', 'gueltig', '2029-10-20', null],
    ]);
    expect(personenMitStand({ einstellungen: E, personen: null }, '2026-11-20')).toBeNull();
  });
});

describe('Seite und Einstieg: wer was sieht', () => {
  it('Admin sieht die Personen aller Arten', async () => {
    const a = art(E, 'Nachweis: A');
    const b = art(E, 'Nachweis: B');
    dabei(a.id, 10, 'Anna Eins');
    dabei(b.id, 11, 'Ben Zwei');
    const s = await nachweiseSeiteLaden();
    expect(s.arten.map((x) => [x.name, x.personen?.map((p) => p.name)])).toEqual([
      ['A', ['Anna Eins']],
      ['B', ['Ben Zwei']],
    ]);
  });

  it('Vertrauensperson (kein Admin) sieht nur die Arten, die sie leitet', async () => {
    falsch.global = OHNE_ADMIN;
    const meine = art(E, 'Nachweis: Meine');
    const fremde = art(E, 'Nachweis: Fremde');
    falsch.mitgliedSetzen(meine.id, {
      personId: falsch.ichId,
      title: 'Lea Leitung',
      groupTypeRoleId: LEITER,
    });
    dabei(meine.id, 10, 'Anna Eins');
    dabei(fremde.id, 11, 'Ben Zwei');
    const s = await nachweiseSeiteLaden();
    const nach = Object.fromEntries(
      s.arten.map((x) => [x.name, x.personen?.map((p) => p.name) ?? null]),
    );
    expect(nach).toEqual({ Meine: ['Anna Eins'], Fremde: null });
  });

  it('Admin, aber die Mitglieder einer Art nicht lesbar (403): personen null, die anderen stehen', async () => {
    const a = art(E, 'Nachweis: A');
    const b = art(E, 'Nachweis: B');
    falsch.ohneMitgliederRecht.add(a.id);
    dabei(b.id, 11, 'Ben Zwei');
    const s = await nachweiseSeiteLaden();
    expect(s.arten.map((x) => x.personen === null)).toEqual([true, false]);
  });

  it('die Seite wirft bei einem vorübergehenden Fehler (Fehlerkasten statt leerer Zahlen)', async () => {
    const g = art();
    ct.ctDaten.mockImplementation(async (pfad: string) => {
      if (pfad.includes(`/groups/${g.id}/followups`)) throw new ApiError(503, 'weg');
      return await falsch.holen(pfad);
    });
    await expect(nachweiseSeiteLaden()).rejects.toMatchObject({ status: 503 });
  });

  it('Startseite: Arten samt Personen für Leitung; die Gruppe einer anderen Leitung bleibt ohne Personen', async () => {
    falsch.global = OHNE_ADMIN;
    const meine = art(E, 'Nachweis: Meine');
    const fremde = art(E, 'Nachweis: Fremde');
    dabei(meine.id, 10, 'Anna Eins');
    dabei(fremde.id, 11, 'Ben Zwei');
    const e = (await nachweisEinstieg(new Set([meine.id])))!;
    expect(e.darfEinrichten).toBe(false);
    expect(e.arten.map((x) => [x.name, x.personen?.length ?? null])).toEqual([
      ['Fremde', null],
      ['Meine', 1],
    ]);
  });

  it('Startseite: scheitert nur das Lesen der Personen, bleibt der Einstieg – ohne Zahlen, nie ein Fehler', async () => {
    const g = art();
    ct.ctDaten.mockImplementation(async (pfad: string) => {
      if (pfad.includes(`/groups/${g.id}/followups`)) throw new ApiError(500, 'weg');
      return await falsch.holen(pfad);
    });
    expect(await nachweisEinstieg(new Set())).toEqual({ darfEinrichten: true, arten: [] });
  });

  it('nachweisArtenLesen bleibt unverändert (ohne Personen)', async () => {
    art();
    const l = await nachweisArtenLesen(11);
    expect(l[0]).not.toHaveProperty('personen');
  });
});
