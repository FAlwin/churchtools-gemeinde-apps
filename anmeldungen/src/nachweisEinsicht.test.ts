import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as V from '@ui/ct/verbindung';
import { NichtUebernommen } from '@ui/ct/fehler';
import { plusTage } from '@shared/ct/datum';
import { _vergissGemeindeZeitzone, heuteImKalender, merkeGemeindeZeitzone } from '@shared/ct/zeit';
import {
  ERGEBNIS_EINTRAG,
  ERGEBNIS_OHNE,
  NACHWEIS_AUFGABE_ERNEUT,
  NACHWEIS_AUFGABE_ERSTE,
  NACHWEIS_FELDER,
  nachweisNotiz,
  type NachweisEinstellungen,
} from '@shared/anmeldung/nachweise';
import { nachweisGueltigBis, plusJahre } from '@shared/anmeldung/nachweisStand';
import { EinsichtTeilweise, einsichtFesthalten, einsichtNachziehen } from './nachweisEinsicht';
import { nachweisPersonenLesen, type NachweisPerson } from './nachweisPersonen';
import { nachweiseSeiteLaden } from './nachweisArten';
import { FalschesNachweisCt } from './nachweisArten.testutil';

/**
 * Einsicht festhalten und Nachziehen (N2b) gegen ein nachgestelltes ChurchTools. „Heute“ ist der echte Kalendertag der
 * Gemeinde (die Seite liest ihn selbst); alle Tage werden daraus gerechnet. Soll-Werte aus den Erzeugern
 * (`nachweisGueltigBis`, `NACHWEIS_FELDER`), nicht aus abgeschriebenen Literalen. Die Wartezeit ist eine eingespritzte
 * Funktion – kein Test wartet wirklich.
 */
vi.mock('@ui/ct/verbindung', () => ({
  ctAnfrage: vi.fn(),
  ctDaten: vi.fn(),
  ctAlleSeiten: vi.fn(),
  istUeberlastet: () => false,
}));
const ct = vi.mocked(V);

let falsch: FalschesNachweisCt;
const HEUTE = heuteImKalender();
const E: NachweisEinstellungen = { gueltigJahre: 3, ab: 'ausstellung', betreff: 'B', text: 'T' };
const TEILNEHMER = 53;
const AUSGESTELLT = plusTage(HEUTE, -8);
const BIS = plusJahre(AUSGESTELLT, 3);

beforeEach(() => {
  merkeGemeindeZeitzone({ timezone: 'Europe/Berlin' });
  falsch = new FalschesNachweisCt().mitArt();
  falsch.serverHeute = HEUTE;
  ct.ctDaten.mockReset().mockImplementation((pfad: string) => falsch.holen(pfad));
  ct.ctAlleSeiten.mockReset().mockImplementation((pfad: string) => falsch.alleSeiten(pfad));
  ct.ctAnfrage.mockReset().mockImplementation(async (pfad: string, opt?: unknown) => {
    const o = (opt ?? {}) as { method?: string; body?: string };
    const kopf = o.method ?? 'GET';
    if (kopf === 'GET') return { data: await falsch.holen(pfad) };
    return await falsch.schicken(
      pfad,
      kopf,
      typeof o.body === 'string' ? JSON.parse(o.body) : undefined,
    );
  });
});
afterEach(() => _vergissGemeindeZeitzone());

function art(e: NachweisEinstellungen = E, felderUmgekehrt = false) {
  const g = falsch.gruppeAnlegen('Nachweis: Führungszeugnis', nachweisNotiz(e));
  const felder = NACHWEIS_FELDER.map((f, i) => ({
    id: 500 + i,
    name: f.name,
    fieldTypeCode: f.fieldTypeCode,
    securityLevel: 4,
    useInRegistrationForm: false,
    requiredInRegistrationForm: false,
    ...('optionen' in f
      ? { options: f.optionen.map((o, j) => ({ id: String(335 + j * 3), name: o })) }
      : {}),
  }));
  falsch.felder.set(g.id, felderUmgekehrt ? felder.reverse() : felder);
  return g;
}
const dabei = (g: number, personId: number, titel = `Person ${personId}`) =>
  falsch.mitgliedSetzen(g, { personId, title: titel, groupTypeRoleId: TEILNEHMER });
const reihe = () => falsch.aufrufe.map((a) => `${a.methode} ${a.pfad}`);
const lesen = async (g: number, e: NachweisEinstellungen = E) =>
  (await nachweisPersonenLesen({ id: g, einstellungen: e }, TEILNEHMER))!;
const feld = (g: number, personId: number, name: string) => {
  const f = falsch.felder.get(g)!.find((x) => x.name === name)!;
  return falsch.mitglieder
    .get(g)!
    .find((m) => m.personId === personId)!
    .fields.find((x) => x.id === f.id)?.value;
};
const aufgaben = (g: number) => falsch.aufgaben.get(g) ?? [];
const sofort = () => vi.fn(() => Promise.resolve());

const eingabe = (
  g: { id: number },
  person: NachweisPerson,
  extra: Partial<Parameters<typeof einsichtFesthalten>[0]> = {},
) => ({
  art: { id: g.id, einstellungen: E },
  person,
  eingesehenAm: HEUTE,
  ausgestelltAm: AUSGESTELLT,
  ergebnis: 'ohne' as const,
  heute: HEUTE,
  ...extra,
});

/** Eine Person mit offener „Einsicht nehmen“ (vor 10 Tagen angelegt). */
async function ersteEinsicht() {
  const g = art();
  dabei(g.id, 10, 'Paula Messnull');
  falsch.aufgabeSetzen(g.id, {
    personId: 10,
    createdDate: `${plusTage(HEUTE, -10)}T10:00:00Z`,
  });
  return { g, person: (await lesen(g.id))[0] };
}

describe('Lesen: die offene Aufgabe trägt Nummer, Titel, Anlagetag und Fälligkeit', () => {
  it('Fälligkeit ist die wirksame (nach dem Verschieben), nicht die ursprüngliche', async () => {
    const g = art();
    dabei(g.id, 10);
    falsch.aufgabeSetzen(g.id, {
      personId: 10,
      title: NACHWEIS_AUFGABE_ERNEUT,
      createdDate: '2026-11-02T10:00:00Z',
      dueDate: '2026-12-01',
      effectiveDueDate: '2029-10-20',
    });
    const [p] = await lesen(g.id);
    expect(p.aufgabe).toEqual({
      id: aufgaben(g.id)[0].id,
      titel: NACHWEIS_AUFGABE_ERNEUT,
      angelegt: '2026-11-02',
      faellig: '2029-10-20',
      seit: '2026-11-02',
    });
  });
});

describe('Einsicht festhalten: Reihenfolge Felder → erledigen → verschieben', () => {
  it('neue Einsicht bei „Einsicht nehmen“: PATCH, complete, postpone – und alles steht danach in ChurchTools', async () => {
    const { g, person } = await ersteEinsicht();
    const alt = aufgaben(g.id)[0];
    const erg = await einsichtFesthalten(eingabe(g, person), { warte: sofort() });
    const neu = aufgaben(g.id).find((a) => a.title === NACHWEIS_AUFGABE_ERNEUT)!;
    expect(reihe()).toEqual([
      `PATCH /groups/${g.id}/members/10`,
      `POST /followups/${alt.id}/complete`,
      `POST /followups/${neu.id}/postpone`,
    ]);
    expect(falsch.aufrufe[2].json).toEqual({ dueDate: BIS });
    expect(alt.doneDate).not.toBeNull();
    expect(neu.effectiveDueDate).toBe(BIS);
    expect(feld(g.id, 10, NACHWEIS_FELDER[0].name)).toBe(HEUTE);
    expect(feld(g.id, 10, NACHWEIS_FELDER[1].name)).toBe(AUSGESTELLT);
    expect(erg).toMatchObject({
      neu: true,
      erledigt: NACHWEIS_AUFGABE_ERSTE,
      verschoben: true,
      nachziehen: false,
      gueltigBis: BIS,
    });
    expect(erg.text).toBe(
      `Einsicht bei Paula Messnull festgehalten – gültig bis ${BIS.slice(8)}.${BIS.slice(5, 7)}.${BIS.slice(0, 4)}.`,
    );
  });

  it('die Felder werden nach NAMEN zugeordnet (andere Reihenfolge, andere Nummern) und das Ergebnis als Options-Nummer geschrieben', async () => {
    const g = art(E, true);
    dabei(g.id, 10);
    const [p] = await lesen(g.id);
    await einsichtFesthalten(eingabe(g, p, { ergebnis: 'eintrag' }), { warte: sofort() });
    const nr = (name: string) => falsch.felder.get(g.id)!.find((f) => f.name === name)!.id;
    expect(falsch.aufrufe[0].json).toEqual({
      fields: {
        [nr(NACHWEIS_FELDER[0].name)]: HEUTE,
        [nr(NACHWEIS_FELDER[1].name)]: AUSGESTELLT,
        [nr(NACHWEIS_FELDER[2].name)]: falsch.optionsNummer(
          g.id,
          NACHWEIS_FELDER[2].name,
          ERGEBNIS_EINTRAG,
        ),
      },
    });
    // Und „ohne“ ist eine andere Nummer.
    await einsichtFesthalten(eingabe(g, p), { warte: sofort() });
    expect(feld(g.id, 10, NACHWEIS_FELDER[2].name)).toBe(
      falsch.optionsNummer(g.id, NACHWEIS_FELDER[2].name, ERGEBNIS_OHNE),
    );
  });

  it('ohne „Ausgestellt am“ (Art ab Einsicht): das Feld wird geleert', async () => {
    const e: NachweisEinstellungen = { ...E, ab: 'einsicht' };
    const g = art(e);
    dabei(g.id, 10);
    const [p] = await lesen(g.id, e);
    await einsichtFesthalten(
      { ...eingabe(g, p, { ausgestelltAm: null }), art: { id: g.id, einstellungen: e } },
      { warte: sofort() },
    );
    const nr = falsch.felder.get(g.id)!.find((f) => f.name === NACHWEIS_FELDER[1].name)!.id;
    expect((falsch.aufrufe[0].json as { fields: Record<number, unknown> }).fields[nr]).toBeNull();
  });

  it('scheitern die Felder, passiert nichts weiter – kein complete, kein postpone', async () => {
    const { g, person } = await ersteEinsicht();
    falsch.scheitert = [{ muster: 'PATCH /groups', status: 503 }];
    await expect(einsichtFesthalten(eingabe(g, person), { warte: sofort() })).rejects.toMatchObject(
      {
        status: 503,
      },
    );
    expect(reihe()).toEqual([`PATCH /groups/${g.id}/members/10`]);
    expect(aufgaben(g.id)[0].doneDate).toBeNull();
  });

  it('ein 200 für die Felder, das nichts übernimmt: NichtUebernommen, nichts weiter', async () => {
    const { g, person } = await ersteEinsicht();
    falsch.ignoriere = ['PATCH /groups'];
    await expect(
      einsichtFesthalten(eingabe(g, person), { warte: sofort() }),
    ).rejects.toBeInstanceOf(NichtUebernommen);
    expect(reihe()).toEqual([`PATCH /groups/${g.id}/members/10`]);
  });
});

describe('Einsicht festhalten: Fehler beim Erledigen sind vorübergehend, nichts geht kaputt', () => {
  it('complete scheitert (503): Felder bleiben, Meldung sagt es; der zweite Versuch erledigt – ohne Doppel', async () => {
    const { g, person } = await ersteEinsicht();
    falsch.scheitert = [{ muster: '/complete', status: 503 }];
    const fehler = await einsichtFesthalten(eingabe(g, person), { warte: sofort() }).catch(
      (x) => x,
    );
    expect(fehler).toBeInstanceOf(EinsichtTeilweise);
    expect((fehler as Error).message).toContain('gespeichert');
    expect((fehler as Error).message).toContain('Einsicht nehmen');
    expect(feld(g.id, 10, NACHWEIS_FELDER[0].name)).toBe(HEUTE);
    expect(aufgaben(g.id)[0].doneDate).toBeNull();
    // Noch einmal – dieselbe (veraltete) Person wie im offenen Fenster.
    falsch.scheitert = [];
    const erg = await einsichtFesthalten(eingabe(g, person), { warte: sofort() });
    expect(erg.verschoben).toBe(true);
    expect(aufgaben(g.id).filter((a) => a.title === NACHWEIS_AUFGABE_ERNEUT)).toHaveLength(1);
    expect(aufgaben(g.id)[0].doneDate).not.toBeNull();
  });

  it('complete antwortet 200, erledigt aber nichts: EinsichtTeilweise (nachgelesen)', async () => {
    const { g, person } = await ersteEinsicht();
    falsch.ignoriere = ['/complete'];
    await expect(
      einsichtFesthalten(eingabe(g, person), { warte: sofort() }),
    ).rejects.toBeInstanceOf(EinsichtTeilweise);
    expect(reihe().some((r) => r.includes('/postpone'))).toBe(false);
  });

  it('die Aufgaben lassen sich gerade nicht lesen (503): EinsichtTeilweise, die Felder stehen', async () => {
    const { g, person } = await ersteEinsicht();
    falsch.aufgabenLesenScheitert = 503;
    await expect(
      einsichtFesthalten(eingabe(g, person), { warte: sofort() }),
    ).rejects.toBeInstanceOf(EinsichtTeilweise);
    expect(feld(g.id, 10, NACHWEIS_FELDER[2].name)).toBeDefined();
    expect(reihe()).toEqual([`PATCH /groups/${g.id}/members/10`]);
  });

  it('war die Aufgabe schon erledigt (Abbruch nach dem Erledigen), wird sie nicht noch einmal erledigt', async () => {
    const { g, person } = await ersteEinsicht();
    await einsichtFesthalten(eingabe(g, person), { warte: sofort() });
    const vorher = reihe().filter((r) => r.includes('/complete')).length;
    await einsichtFesthalten(eingabe(g, person), { warte: sofort() });
    expect(reihe().filter((r) => r.includes('/complete')).length).toBe(vorher);
  });
});

describe('Einsicht festhalten: „Erneut einsehen“ nachziehen', () => {
  it('erscheint erst beim 3. Hinsehen: es wird gewartet, dann verschoben', async () => {
    const { g, person } = await ersteEinsicht();
    falsch.erneutNachLesen = 2;
    const warte = sofort();
    const erg = await einsichtFesthalten(eingabe(g, person), { warte, pauseMs: 1000 });
    expect(warte.mock.calls).toEqual([[1000], [1000]]);
    expect(erg.verschoben).toBe(true);
    expect(aufgaben(g.id).find((a) => a.title === NACHWEIS_AUFGABE_ERNEUT)!.effectiveDueDate).toBe(
      BIS,
    );
  });

  it('erscheint nie: nach 5 Blicken kein Fehler, der Hinweis sagt „beim nächsten Öffnen“', async () => {
    const { g, person } = await ersteEinsicht();
    falsch.erneutNie = true;
    const warte = sofort();
    const erg = await einsichtFesthalten(eingabe(g, person), { warte });
    expect(warte).toHaveBeenCalledTimes(4);
    expect(erg).toMatchObject({
      verschoben: false,
      nachziehen: true,
      erledigt: NACHWEIS_AUFGABE_ERSTE,
    });
    expect(erg.text).toContain('beim nächsten Öffnen nachgezogen');
    expect(reihe().some((r) => r.includes('/postpone'))).toBe(false);
  });

  it('nach „Erneut einsehen“ kommt die nächste erst morgen: kein Warten, kein Verschieben, Hinweis', async () => {
    const g = art();
    dabei(g.id, 10, 'Mia Muster');
    falsch.feldSetzen(g.id, 10, NACHWEIS_FELDER[0].name, plusTage(HEUTE, -1000));
    falsch.aufgabeSetzen(g.id, {
      personId: 10,
      title: NACHWEIS_AUFGABE_ERNEUT,
      createdDate: `${plusTage(HEUTE, -20)}T10:00:00Z`,
    });
    const [p] = await lesen(g.id);
    const warte = sofort();
    const erg = await einsichtFesthalten(eingabe(g, p), { warte });
    expect(warte).not.toHaveBeenCalled();
    expect(erg).toMatchObject({ neu: true, erledigt: NACHWEIS_AUFGABE_ERNEUT, nachziehen: true });
    expect(reihe().some((r) => r.includes('/postpone'))).toBe(false);
  });

  it('Berichtigung: nichts wird erledigt, die offene „Erneut einsehen“ bekommt das neue Datum', async () => {
    const g = art();
    dabei(g.id, 10, 'Mia Muster');
    // Einsicht vor 20 Tagen; „Erneut einsehen“ ist danach angelegt (vor 10 Tagen) → eine Berichtigung erledigt sie nicht.
    falsch.feldSetzen(g.id, 10, NACHWEIS_FELDER[0].name, plusTage(HEUTE, -20));
    falsch.aufgabeSetzen(g.id, {
      personId: 10,
      title: NACHWEIS_AUFGABE_ERNEUT,
      createdDate: `${plusTage(HEUTE, -10)}T10:00:00Z`,
      dueDate: plusTage(HEUTE, 500),
    });
    const [p] = await lesen(g.id);
    const erg = await einsichtFesthalten(eingabe(g, p, { eingesehenAm: plusTage(HEUTE, -20) }), {
      warte: sofort(),
    });
    expect(reihe().some((r) => r.includes('/complete'))).toBe(false);
    expect(aufgaben(g.id)[0].doneDate).toBeNull();
    expect(aufgaben(g.id)[0].effectiveDueDate).toBe(BIS);
    expect(erg).toMatchObject({ neu: false, erledigt: null, verschoben: true });
    expect(erg.text).toBe('Angaben bei Mia Muster berichtigt.');
  });

  it('Einsicht vor der Anforderung bei offener „Einsicht nehmen“: erledigt sie (Zeugnis schon früher gesehen)', async () => {
    const { g, person } = await ersteEinsicht();
    // Die Aufgabe wurde vor 10 Tagen angelegt; auch eine Einsicht vor 20 Tagen erledigt sie.
    const erg = await einsichtFesthalten(
      eingabe(g, person, { eingesehenAm: plusTage(HEUTE, -20) }),
      {
        warte: sofort(),
      },
    );
    expect(reihe().filter((r) => r.includes('/complete'))).toHaveLength(1);
    expect(erg).toMatchObject({ neu: true, erledigt: NACHWEIS_AUFGABE_ERSTE });
  });

  it('Berichtigung am Tag der Einsicht („Erneut einsehen“ am selben Tag angelegt): nichts wird erledigt (Demo-Fund 20.11.2026)', async () => {
    const g = art();
    dabei(g.id, 10, 'Jonas Weber');
    // Wie in ChurchTools: Einsicht festgehalten vor 17 Tagen, „Erneut einsehen“ am selben Tag angelegt; jetzt nur das
    // Ergebnis ändern (Rücksprache → keine Eintragung).
    falsch.feldSetzen(g.id, 10, NACHWEIS_FELDER[0].name, plusTage(HEUTE, -17));
    falsch.aufgabeSetzen(g.id, {
      personId: 10,
      title: NACHWEIS_AUFGABE_ERNEUT,
      createdDate: `${plusTage(HEUTE, -17)}T10:00:00Z`,
      dueDate: plusTage(HEUTE, 500),
    });
    const [p] = await lesen(g.id);
    const erg = await einsichtFesthalten(eingabe(g, p, { eingesehenAm: plusTage(HEUTE, -17) }), {
      warte: sofort(),
    });
    expect(reihe().some((r) => r.includes('/complete'))).toBe(false);
    expect(aufgaben(g.id)[0].doneDate).toBeNull();
    expect(erg).toMatchObject({ neu: false, erledigt: null });
  });

  it('Gültig bis heute oder früher: nie verschieben – auslassen ist kein Fehler', async () => {
    const { g, person } = await ersteEinsicht();
    const alt = plusJahre(plusTage(HEUTE, -1), -3);
    const erg = await einsichtFesthalten(eingabe(g, person, { ausgestelltAm: alt }), {
      warte: sofort(),
    });
    expect(nachweisGueltigBis(E, { eingesehenAm: HEUTE, ausgestelltAm: alt })).toBe(
      plusTage(HEUTE, -1),
    );
    expect(reihe().filter((r) => r.includes('/postpone'))).toEqual([]);
    expect(reihe().filter((r) => r.includes('/complete'))).toHaveLength(1);
    expect(erg).toMatchObject({ verschoben: false, nachziehen: false });
  });

  it('postpone antwortet 200, das Datum bleibt alt: nachgelesen, EinsichtTeilweise', async () => {
    const { g, person } = await ersteEinsicht();
    falsch.ignoriere = ['/postpone'];
    const fehler = await einsichtFesthalten(eingabe(g, person), { warte: sofort() }).catch(
      (x) => x,
    );
    expect(fehler).toBeInstanceOf(EinsichtTeilweise);
    expect((fehler as Error).message).toContain('Erneut einsehen');
    expect((fehler as Error).message).toContain('erledigt');
  });

  it('postpone scheitert vorübergehend (504): Meldung, der zweite Versuch setzt das Datum', async () => {
    const { g, person } = await ersteEinsicht();
    falsch.scheitert = [{ muster: '/postpone', status: 504 }];
    await expect(
      einsichtFesthalten(eingabe(g, person), { warte: sofort() }),
    ).rejects.toBeInstanceOf(EinsichtTeilweise);
    falsch.scheitert = [];
    const erg = await einsichtFesthalten(eingabe(g, person), { warte: sofort() });
    expect(erg.verschoben).toBe(true);
    expect(aufgaben(g.id).filter((a) => a.title === NACHWEIS_AUFGABE_ERNEUT)).toHaveLength(1);
  });
});

describe('Nachziehen beim Öffnen der Seite', () => {
  /** Eine Art mit sechs Personen – nur die erste soll verschoben werden. */
  function welt() {
    const g = art();
    const gesehen = (id: number, tage = -30) => {
      dabei(g.id, id, `Person ${id}`);
      falsch.feldSetzen(g.id, id, NACHWEIS_FELDER[0].name, plusTage(HEUTE, tage));
      falsch.feldSetzen(g.id, id, NACHWEIS_FELDER[1].name, AUSGESTELLT);
    };
    const erneut = (id: number, angelegt: number, faellig: string | null) =>
      falsch.aufgabeSetzen(g.id, {
        personId: id,
        title: NACHWEIS_AUFGABE_ERNEUT,
        createdDate: `${plusTage(HEUTE, angelegt)}T10:00:00Z`,
        dueDate: faellig,
      });
    // 10: soll verschoben werden (Einsicht -30, Aufgabe -5, Fälligkeit weicht ab)
    gesehen(10);
    erneut(10, -5, plusTage(HEUTE, 700));
    // 11: Fälligkeit stimmt schon
    gesehen(11);
    erneut(11, -5, BIS);
    // 12: die Einsicht hat diese Aufgabe erledigt (Einsicht nach Anlage) – nicht anfassen
    gesehen(12, -2);
    erneut(12, -5, plusTage(HEUTE, 700));
    // 13: offene „Einsicht nehmen“ – nur „Erneut einsehen“ wird verschoben
    gesehen(13);
    falsch.aufgabeSetzen(g.id, { personId: 13, createdDate: `${plusTage(HEUTE, -5)}T10:00:00Z` });
    // 14: Gültig bis ist heute – nie verschieben
    dabei(g.id, 14);
    falsch.feldSetzen(g.id, 14, NACHWEIS_FELDER[0].name, plusTage(HEUTE, -30));
    falsch.feldSetzen(g.id, 14, NACHWEIS_FELDER[1].name, plusJahre(HEUTE, -3));
    erneut(14, -5, plusTage(HEUTE, 700));
    // 15: noch keine Einsicht
    dabei(g.id, 15);
    erneut(15, -5, plusTage(HEUTE, 700));
    return g;
  }

  it('verschiebt nur die richtige Person, erledigt nie etwas', async () => {
    const g = welt();
    const personen = await lesen(g.id);
    const n = await einsichtNachziehen({ einstellungen: E }, personen, HEUTE);
    expect(n).toBe(1);
    expect(falsch.aufrufe.map((a) => `${a.methode} ${a.pfad}`)).toEqual([
      `POST /followups/${aufgaben(g.id).find((a) => a.personId === 10)!.id}/postpone`,
    ]);
    expect(falsch.aufrufe[0].json).toEqual({ dueDate: BIS });
    expect(aufgaben(g.id).every((a) => a.doneDate === null)).toBe(true);
  });

  it('ein Fehler bei einer Person blockiert nichts: die nächste wird trotzdem versucht, nichts wird geworfen', async () => {
    const g = welt();
    dabei(g.id, 20);
    falsch.feldSetzen(g.id, 20, NACHWEIS_FELDER[0].name, plusTage(HEUTE, -30));
    falsch.feldSetzen(g.id, 20, NACHWEIS_FELDER[1].name, AUSGESTELLT);
    falsch.aufgabeSetzen(g.id, {
      personId: 20,
      title: NACHWEIS_AUFGABE_ERNEUT,
      createdDate: `${plusTage(HEUTE, -5)}T10:00:00Z`,
      dueDate: plusTage(HEUTE, 700),
    });
    falsch.scheitert = [{ muster: '/postpone', status: 503 }];
    const n = await einsichtNachziehen({ einstellungen: E }, await lesen(g.id), HEUTE);
    expect(n).toBe(0);
    expect(falsch.aufrufe.filter((a) => a.pfad.includes('/postpone'))).toHaveLength(2);
  });

  it('die Seite lädt: zieht nach und liest danach einmal neu (die neue Fälligkeit steht da)', async () => {
    const g = welt();
    const s = await nachweiseSeiteLaden();
    const p10 = s.arten[0].personen!.find((p) => p.personId === 10)!;
    expect(p10.aufgabe?.faellig).toBe(BIS);
    expect(falsch.aufrufe.filter((a) => a.pfad.includes('/postpone'))).toHaveLength(1);
    // Zweites Öffnen: nichts mehr zu tun.
    falsch.aufrufe = [];
    await nachweiseSeiteLaden();
    expect(falsch.aufrufe).toEqual([]);
    expect(g.id).toBeGreaterThan(0);
  });

  it('die Seite lädt trotz Fehler beim Nachziehen', async () => {
    welt();
    falsch.scheitert = [{ muster: '/postpone', status: 500 }];
    const s = await nachweiseSeiteLaden();
    expect(s.arten[0].personen).toHaveLength(6);
  });

  it('wer die Mitglieder nicht sehen darf (personen null), bekommt nichts verschoben', async () => {
    const g = welt();
    falsch.ohneMitgliederRecht.add(g.id);
    const s = await nachweiseSeiteLaden();
    expect(s.arten[0].personen).toBeNull();
    expect(falsch.aufrufe).toEqual([]);
  });

  it('eine Art, die nicht deine ist (kein Admin, keine Leitung), wird nicht angefasst', async () => {
    welt();
    falsch.global = { churchcore: { 'view birthdays': true }, churchdb: { 'view alldata': true } };
    const s = await nachweiseSeiteLaden();
    expect(s.arten).toEqual([]);
    expect(falsch.aufrufe).toEqual([]);
  });
});
