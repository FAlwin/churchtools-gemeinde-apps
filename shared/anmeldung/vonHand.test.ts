import { describe, expect, it } from 'vitest';
import { anmeldungenAus, type MitgliedRoh } from './liste';
import { nachpruefen, pruefMitgliederAus } from './nachpruefung';
import { pruefeAntworten } from './formular';
import { FELDER, HEUTE, NR, STICHTAG, e, stand } from './liste.testdaten';
import { CT_MIT_NR } from './liste.testdaten';
import { antworten } from './senden.testdaten';
import { anmeldungAufbauen, unterschriftAufPapier } from './senden';
import { bescheidMail } from './bewegung';
import { handFelder, handFormular, handPlatz, handStart, mitUnterschrift } from './vonHand';

/**
 * Anmeldung von Hand (A7-4a). Geschrieben wird mit derselben Regel wie im Formular; die Liste und die Nachprüfung lesen
 * es danach so, als hätte sich die Familie selbst angemeldet.
 */
const JONAS = 10;
const ein = (x: ReturnType<typeof e>) => {
  const a = antworten();
  a.personen = a.personen.slice(0, 1);
  return { x, a };
};

/** Was ChurchTools nach dem `PUT` mit diesen Feldern als Mitglied liefert. */
function mitglied(felder: Record<number, string>, status: 'active' | 'waiting'): MitgliedRoh {
  return {
    personId: JONAS,
    person: { domainAttributes: { firstName: 'Jonas', lastName: 'Beispiel' } },
    groupTypeRoleId: 32,
    groupMemberStatus: status,
    waitinglistPosition: status === 'waiting' ? 1 : null,
    memberStartDate: HEUTE,
    fields: Object.entries(felder).map(([id, value]) => ({ id: Number(id), value })),
  };
}

describe('Felder', () => {
  it('dieselben Felder wie das Formular – nur die gezeichnete Unterschrift fehlt', () => {
    const { x, a } = ein(e());
    const hand = handFelder(x, a, { option: 0, extras: [] }, HEUTE, FELDER, {
      nr: 'HAND01',
      mitPlatz: true,
      papier: null,
    });
    const formular = anmeldungAufbauen(x, a, { option: 0, extras: [] }, HEUTE, CT_MIT_NR, {
      nr: 'HAND01',
      mitPlatz: [true],
    }).forms[0].form.filter((f) => f.type === 'custom');
    const sign = x.ctFelder.sign;
    const daten = x.ctFelder['sign.daten'];
    expect(hand).toEqual(
      Object.fromEntries(
        formular
          .filter((f) => Number(f.id) !== sign && Number(f.id) !== daten)
          .map((f) => [Number(f.id), f.value]),
      ),
    );
    expect(hand[x.ctFelder.betrag]).toBe('6,00 €');
    expect(hand[NR]).toBe('HAND01');
  });

  it('Unterschrift auf Papier: vermerkt mit Name und Tag, ohne Striche', () => {
    const { x, a } = ein(e());
    delete a.anmeldung.sign;
    const papier = unterschriftAufPapier('Alwin Friesen', '2026-10-22');
    expect(papier).toBe('✓ auf Papier – vermerkt von Alwin Friesen, 22.10.2026');
    const hand = handFelder(x, a, { option: 0, extras: [] }, HEUTE, FELDER, {
      nr: 'HAND01',
      mitPlatz: true,
      papier,
    });
    expect([hand[x.ctFelder.sign], hand[x.ctFelder['sign.daten']]]).toEqual([papier, undefined]);
    // Ohne Papier bleibt die Unterschrift leer.
    expect(
      handFelder(x, a, { option: 0, extras: [] }, HEUTE, FELDER, {
        nr: 'HAND01',
        mitPlatz: true,
        papier: null,
      })[x.ctFelder.sign],
    ).toBeUndefined();
  });

  it('Warteliste → Betrag 0 mit Zeile „Warteliste“; Liste und Nachprüfung lesen es wie eine Formular-Anmeldung', () => {
    const { x, a } = ein(e());
    const felder = handFelder(x, a, { option: 0, extras: [] }, HEUTE, FELDER, {
      nr: 'HAND02',
      mitPlatz: false,
      papier: null,
    });
    expect([felder[x.ctFelder.betrag], felder[x.ctFelder.aufschluesselung]]).toEqual([
      '0,00 €',
      'Jonas Beispiel: Warteliste – Betrag folgt beim Nachrücken',
    ]);
    const roh = [mitglied(felder, 'waiting')];
    const [l] = anmeldungenAus(x, stand(roh), STICHTAG);
    expect([l.nr, l.wer, l.personen[0].status]).toEqual(['HAND02', 'Maria Beispiel', 'wartet']);
    const n = nachpruefen(x, pruefMitgliederAus(x, stand(roh)), { belegt: 0, wartend: 1, max: 10 });
    expect(n.betraege).toEqual([]);

    const mitPlatz = handFelder(x, a, { option: 0, extras: [] }, HEUTE, FELDER, {
      nr: 'HAND03',
      mitPlatz: true,
      papier: null,
    });
    const roh2 = [mitglied(mitPlatz, 'active')];
    expect(anmeldungenAus(x, stand(roh2), STICHTAG)[0].betragCent).toBe(600);
    expect(
      nachpruefen(x, pruefMitgliederAus(x, stand(roh2)), { belegt: 1, wartend: 0, max: 10 })
        .betraege,
    ).toEqual([]);
  });
});

describe('Fragen', () => {
  it('ohne Datenschutz-Häkchen und Unterschrift; Name, Geburtstag, E-Mail aus ChurchTools', () => {
    const x = e();
    expect(mitUnterschrift(x.formular)).toBe(true);
    const f = handFormular(x.formular);
    expect(
      [...f.anmeldung, ...f.person].some((y) => y.typ === 'privacy' || y.typ === 'price'),
    ).toBe(false);
    // Am Telefon hat nicht jede Familie eine E-Mail-Adresse.
    expect(f.anmeldung.find((y) => y.typ === 'email')?.zustand).toBe('freiwillig');
    expect(mitUnterschrift(f)).toBe(false);
    const start = handStart(x, {
      vor: 'Jonas',
      nach: 'Beispiel',
      geburtstag: '2017-05-01',
      email: 'maria@beispiel.test',
    });
    expect(start.personen[0]).toMatchObject({
      pname: { vor: 'Jonas', nach: 'Beispiel' },
      birth: '2017-05-01',
    });
    // Kinder-Event: Angemeldet von füllen die Eltern aus – bis dahin fehlt es.
    expect(pruefeAntworten(f, start)).toContain('anmeldung.name.vor');
    const fertig = {
      ...start,
      anmeldung: {
        ...start.anmeldung,
        name: { vor: 'Maria', nach: 'Beispiel' },
        tel: '0151 111',
        eltern: antworten().anmeldung.eltern,
      },
      personen: [{ ...start.personen[0], foto: 'Ja' }],
    };
    expect(pruefeAntworten(f, fertig)).toEqual([]);
  });
});

describe('Platz', () => {
  const lage = { belegt: 5, max: 10, wartende: 0, warteliste: true };
  it('frei und niemand wartet → Platz', () => {
    expect(handPlatz(lage, false)).toMatchObject({
      status: 'active',
      neuesMax: null,
      wuerdeWarten: false,
    });
  });
  it('jemand wartet → hinten an, auch bei freien Plätzen; trotzdem → Platz ohne mehr Plätze', () => {
    const l = { ...lage, wartende: 2 };
    expect(handPlatz(l, false)).toMatchObject({ status: 'waiting', warteplatz: 3 });
    expect(handPlatz(l, true)).toMatchObject({
      status: 'active',
      neuesMax: null,
      wuerdeWarten: true,
    });
  });
  it('voll → Warteliste; trotzdem → Plätze um eins mehr; ohne Warteliste geht es nur mit mehr Plätzen', () => {
    const voll = { ...lage, belegt: 10 };
    expect(handPlatz(voll, false)).toMatchObject({ status: 'waiting', warteplatz: 1 });
    expect(handPlatz(voll, true)).toMatchObject({ status: 'active', neuesMax: 11 });
    expect(handPlatz({ ...voll, warteliste: false }, false)).toMatchObject({
      status: 'active',
      neuesMax: 11,
      nurMitPlatz: true,
    });
  });
  it('unbegrenzt → Platz', () => {
    expect(handPlatz({ ...lage, max: null, belegt: 99 }, false).status).toBe('active');
  });
});

describe('Mail', () => {
  it('Platz: Betrag mit Bankdaten und Anmelde-Nr.; Warteliste: Platz in der Warteliste, ohne Betrag', () => {
    const x = e();
    x.bezahlung = { ...x.bezahlung, kontoinhaber: 'Gemeinde e.V.', iban: 'XXTEST', fristTage: 0 };
    const basis = {
      art: 'angemeldet' as const,
      veranstaltung: 'Kinderfreizeit',
      x: { email: 'maria@beispiel.test', wer: 'Maria Beispiel', nr: 'HAND01' },
      person: { vor: 'Jonas', nach: 'Beispiel' },
      rueckzahlungCent: 0,
      heute: '2026-10-22',
    };
    const platz = bescheidMail(x, { ...basis, betragCent: 600, warteplatz: null });
    expect(platz.betreff).toBe('Kinderfreizeit: Anmeldung für Jonas');
    expect(platz.text).toMatch(
      /angemeldet – Jonas ist dabei\.\n\nEure Anmelde-Nr\.: HAND01\n\nBitte überweise 6,00 €:/,
    );
    const warte = bescheidMail(x, { ...basis, betragCent: 0, warteplatz: 2 });
    expect(warte.betreff).toBe('Kinderfreizeit: Anmeldung für Jonas (Warteliste)');
    expect(warte.text).toMatch(/Warteliste \(Platz 2\)/);
    expect(warte.text).not.toMatch(/überweise/);
  });
});
