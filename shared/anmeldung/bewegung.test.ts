import { describe, expect, it } from 'vitest';
import { absagePlan, bescheidMail, mailtoLink, nachrueckPlan } from './bewegung';
import { anmeldungenAus, type ListenAnmeldung } from './liste';
import { nachpruefen, pruefMitgliederAus } from './nachpruefung';
import { e, mitglieder, stand, STICHTAG } from './liste.testdaten';
import type { MitgliedRoh } from './liste';
import type { OeffentlicheEinstellungen } from './formular';

/**
 * Nachrücken und Absagen planen (A7-3). Die Anmeldung kommt aus dem, was das Formular schreibt (`liste.testdaten.ts`:
 * zwei Kinder, 6 € je Kind mit Platz); die Pläne werden danach „geschrieben“ und mit Liste und Nachprüfung nachgelesen –
 * so prüft der Test, dass Plan, Liste und Nachprüfung dieselbe Regel haben.
 */
const HEUTE = '2026-10-19';
const JONAS = 10;
const LENA = 11;

function anmeldung(x: OeffentlicheEinstellungen, roh: MitgliedRoh[]): ListenAnmeldung {
  return anmeldungenAus(x, stand(roh), STICHTAG)[0];
}

/** Schreibt Felder bei einer Person der Testdaten – wie `PATCH /groups/{id}/members/{personId}`. */
function setze(roh: MitgliedRoh[], personId: number, felder: Record<number, string | null>) {
  const m = roh.find((y) => y.personId === personId)!;
  for (const [id, wert] of Object.entries(felder)) {
    const f = m.fields!.find((y) => Number(y.id) === Number(id));
    if (f) f.value = wert;
    else m.fields!.push({ id: Number(id), value: wert });
  }
}

describe('Nachrücken', () => {
  it('Lena wartet, Jonas hat Platz → eigene Zahlung über 6 €; danach stimmt die Nachprüfung', () => {
    const x = e();
    const roh = mitglieder('AAAAAA', [true, false], JONAS);
    const a = anmeldung(x, roh);
    const plan = nachrueckPlan(
      x,
      a,
      LENA,
      { belegt: 1, max: 10, wartende: [{ personId: LENA, name: 'Lena Beispiel' }] },
      HEUTE,
    );
    expect([plan.neuesMax, plan.vorher, plan.zahlung?.art, plan.zahlung?.betragCent]).toEqual([
      null,
      [],
      'eigene',
      600,
    ]);
    expect(plan.zahlung?.aufschluesselung.split('\n')[0]).toBe('Nachgerückt am 19.10.2026');

    // „Geschrieben“: Lena aktiv, mit eigener Zahlung.
    roh.find((y) => y.personId === LENA)!.groupMemberStatus = 'active';
    setze(roh, LENA, {
      [x.ctFelder.betrag]: '6,00 €',
      [x.ctFelder.aufschluesselung]: plan.zahlung!.aufschluesselung,
    });
    const nachher = anmeldung(x, roh);
    expect(nachher.zahlungen.map((z) => [z.name, z.wofuer, z.betragCent, z.offen])).toEqual([
      ['Jonas', 'anmeldung', 600, true],
      ['Lena', 'nachgerueckt', 600, true],
    ]);
    expect(nachher.betragCent).toBe(1200);
    // Jonas bleibt die erste Person (Kontakt, Unterschrift) – Lenas eigene Zahlung ändert daran nichts.
    expect(nachher.zahlungBei).toBe(JONAS);
    // Auch wenn ChurchTools Lena vor Jonas liefert.
    expect(anmeldung(x, [...roh].reverse()).zahlungBei).toBe(JONAS);
    const n = nachpruefen(x, pruefMitgliederAus(x, stand(roh)), {
      belegt: 2,
      wartend: 0,
      max: 10,
    });
    expect(n.betraege).toEqual([]);
  });

  it('voll → Plätze danach um eins mehr; wer vorher dran wäre, steht im Plan', () => {
    const x = e();
    const a = anmeldung(x, mitglieder('AAAAAA', [true, false], JONAS));
    const plan = nachrueckPlan(
      x,
      a,
      LENA,
      {
        belegt: 10,
        max: 10,
        wartende: [
          { personId: 99, name: 'Max Lang' },
          { personId: LENA, name: 'Lena Beispiel' },
        ],
      },
      HEUTE,
    );
    expect([plan.neuesMax, plan.vorher]).toEqual([11, ['Max Lang']]);
  });

  it('alle warteten → die Nachgerückte trägt die Zahlung der Anmeldung (neu gerechnet)', () => {
    const x = e();
    const a = anmeldung(x, mitglieder('AAAAAA', [false, false], JONAS));
    expect(a.zahlungBei).toBe(JONAS);
    const plan = nachrueckPlan(x, a, JONAS, { belegt: 0, max: 10, wartende: [] }, HEUTE);
    expect(plan.zahlung).toMatchObject({ art: 'anmeldung', personId: JONAS, betragCent: 600 });
    expect(plan.zahlung!.aufschluesselung).toMatch(
      /Gesamt: 6,00 €\nLena Beispiel: Warteliste – Betrag folgt beim Nachrücken\nJonas Beispiel: nachgerückt am 19\.10\.2026$/,
    );
  });

  it('kostenlos → keine Zahlung; wer nicht wartet, kann nicht nachrücken', () => {
    const x = e();
    x.preis.grundpreis.betragCent = 0;
    const a = anmeldung(x, mitglieder('AAAAAA', [true, false], JONAS));
    expect(
      nachrueckPlan(x, a, LENA, { belegt: 1, max: null, wartende: [] }, HEUTE).zahlung,
    ).toBeNull();
    expect(() =>
      nachrueckPlan(x, a, JONAS, { belegt: 1, max: null, wartende: [] }, HEUTE),
    ).toThrow();
  });
});

describe('Absagen', () => {
  it('Lena (mit Platz) sagt ab → Zahlung der Anmeldung 12 € → 6 €, Zeile in der Aufschlüsselung', () => {
    const x = e();
    const plan = absagePlan(
      x,
      anmeldung(x, mitglieder('AAAAAA', [true, true], JONAS)),
      LENA,
      HEUTE,
    );
    expect(plan.uebergabeAn).toBeNull();
    expect(plan.haupt).toMatchObject({
      personId: JONAS,
      betragCent: 600,
      vorherCent: 1200,
      rueckzahlungCent: 0,
    });
    expect(plan.haupt!.aufschluesselung.split('\n').at(-1)).toBe(
      'Abgesagt am 19.10.2026: Lena Beispiel – Zahlung der Anmeldung jetzt 6,00 €',
    );
  });

  it('schon bezahlt → Rückzahlung steht dabei', () => {
    const x = e();
    const a = anmeldung(x, mitglieder('AAAAAA', [true, true], JONAS, { bezahlt: true }));
    const plan = absagePlan(x, a, LENA, HEUTE);
    expect(plan.haupt?.rueckzahlungCent).toBe(600);
    expect(plan.haupt!.aufschluesselung).toMatch(/Rückzahlung 6,00 € offen$/);
  });

  it('die erste Person sagt ab → Übergabe an die nächste, mit neuer Zahlung', () => {
    const x = e();
    const plan = absagePlan(
      x,
      anmeldung(x, mitglieder('AAAAAA', [true, true], JONAS)),
      JONAS,
      HEUTE,
    );
    expect([plan.uebergabeAn, plan.haupt?.personId, plan.haupt?.betragCent]).toEqual([
      LENA,
      LENA,
      600,
    ]);
  });

  it('wer wartet, sagt ab → Betrag bleibt, die Zeile „Warteliste“ bekommt ihre Absage; die letzte Person (bezahlt) → alles zurück', () => {
    const x = e();
    const wartend = absagePlan(
      x,
      anmeldung(x, mitglieder('AAAAAA', [true, false], JONAS)),
      LENA,
      HEUTE,
    ).haupt!;
    expect([wartend.personId, wartend.betragCent, wartend.vorherCent]).toEqual([JONAS, 600, 600]);
    expect(wartend.aufschluesselung.split('\n').slice(-2)).toEqual([
      'Lena Beispiel: Warteliste – Betrag folgt beim Nachrücken',
      'Abgesagt am 19.10.2026: Lena Beispiel',
    ]);
    // Ohne gemeldeten Betrag wird nichts geschrieben (sonst stünde dort plötzlich „0,00 €“).
    const ohneBetrag = mitglieder('AAAAAA', [true, false], JONAS);
    setze(ohneBetrag, JONAS, { [x.ctFelder.betrag]: null });
    expect(absagePlan(x, anmeldung(x, ohneBetrag), LENA, HEUTE).haupt).toBeNull();
    const roh = mitglieder('AAAAAA', [true, true], JONAS, { bezahlt: true });
    const nurJonas = roh.filter((y) => y.personId === JONAS);
    const plan = absagePlan(x, anmeldung(x, nurJonas), JONAS, HEUTE);
    expect([plan.letzte, plan.haupt, plan.rueckzahlungOhneRestCent]).toEqual([true, null, 1200]);
  });

  it('nach dem Absagen stimmt die Nachprüfung (geschrieben wie geplant)', () => {
    const x = e();
    const roh = mitglieder('AAAAAA', [true, true], JONAS);
    const plan = absagePlan(x, anmeldung(x, roh), LENA, HEUTE);
    const rest = roh.filter((y) => y.personId !== LENA);
    setze(rest, JONAS, {
      [x.ctFelder.betrag]: '6,00 €',
      [x.ctFelder.aufschluesselung]: plan.haupt!.aufschluesselung,
    });
    const n = nachpruefen(x, pruefMitgliederAus(x, stand(rest)), {
      belegt: 1,
      wartend: 0,
      max: 10,
    });
    expect(n.betraege).toEqual([]);
  });
});

describe('Mail', () => {
  it('nachgerückt: Betrag, Frist, Bankdaten, Verwendungszweck mit Nachnamen; Link mit Empfänger', () => {
    const x = e();
    x.bezahlung = { ...x.bezahlung, kontoinhaber: 'Gemeinde e.V.', iban: 'XXTEST', fristTage: 14 };
    x.kontakt = 'freizeit@gemeinde.test';
    const a = anmeldung(x, mitglieder('AAAAAA', [true, false], JONAS));
    const m = bescheidMail(x, {
      art: 'nachgerueckt',
      veranstaltung: 'Kinderfreizeit',
      x: a,
      person: { vor: 'Lena', nach: 'Beispiel' },
      betragCent: 600,
      rueckzahlungCent: 0,
      heute: HEUTE,
    });
    expect(m.an).toBe('maria@beispiel.test');
    expect(m.betreff).toBe('Kinderfreizeit: Lena hat einen Platz');
    expect(m.text).toMatch(/^Hallo Maria Beispiel,\n/);
    expect(m.text).toMatch(
      /Bitte überweise 6,00 € bis zum 02\.11\.2026:\nKontoinhaber: Gemeinde e\.V\./,
    );
    expect(m.text).toMatch(
      /Verwendungszweck: Beispiel\n\nBei Fragen: freizeit@gemeinde\.test\n\nViele Grüße$/,
    );
    expect(mailtoLink(m)).toMatch(
      /^mailto:maria%40beispiel\.test\?subject=Kinderfreizeit%3A%20Lena/,
    );
  });

  it('ohne Bankverbindung ein Satz statt Kontodaten; abgesagt mit Rückzahlung', () => {
    const x = e();
    const a = anmeldung(x, mitglieder('AAAAAA', [true, true], JONAS));
    const basis = {
      veranstaltung: 'Kinderfreizeit',
      x: a,
      person: { vor: 'Lena', nach: 'Beispiel' },
      heute: HEUTE,
    };
    expect(
      bescheidMail(x, { ...basis, art: 'nachgerueckt', betragCent: 600, rueckzahlungCent: 0 }).text,
    ).toMatch(/Der Betrag: 6,00 €\. Wie ihr bezahlt, sagen wir euch noch\./);
    const ab = bescheidMail(x, { ...basis, art: 'abgesagt', betragCent: 0, rueckzahlungCent: 600 });
    expect(ab.betreff).toBe('Kinderfreizeit: Absage für Lena');
    expect(ab.text).toMatch(/Bereits bezahlte 6,00 € überweisen wir euch zurück\./);
  });
});
