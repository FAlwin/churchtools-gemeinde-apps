import { describe, expect, it } from 'vitest';
import { abgesagteIds, anmeldungenAus, antwortZeilen, listenZahlen } from './liste';
import { unterschriftLesen } from './unterschrift';
import { STRICHE } from './senden.testdaten';
import { BEZAHLT, STICHTAG, absage, dazu, e, mitglieder, stand } from './liste.testdaten';

/**
 * Liste der Anmeldungen (A7-1). Die Mitglieder entstehen aus dem, was das Formular schickt (`liste.testdaten.ts` über
 * `anmeldungAufbauen`) – nicht aus handgeschriebenen Feldern: So prüft der Test, dass die Liste liest, was das Formular
 * schreibt.
 */
describe('Eine Anmeldung, zwei Kinder (wie das Formular sie schreibt)', () => {
  it('eine Zeile: Kontakt, Nr., erste Person zuerst, Alter am ersten Tag, Betrag', () => {
    const [x] = anmeldungenAus(e(), stand(mitglieder('AAAAAA', [true, true], 10)), STICHTAG);
    expect([x.wer, x.nr, x.email, x.betragCent, x.zahlungOffen, x.bezahlt]).toEqual([
      'Maria Beispiel',
      'AAAAAA',
      'maria@beispiel.test',
      1200,
      true,
      false,
    ]);
    expect(x.personen.map((p) => [p.vor, p.alter, p.status])).toEqual([
      ['Jonas', 9, 'aktiv'],
      ['Lena', 7, 'aktiv'],
    ]);
  });

  it('Antworten: einmal oben (Erziehungsberechtigte, Unterschrift mit Strichen), je Person (Auswahl als Text)', () => {
    const x = e();
    const [a] = anmeldungenAus(x, stand(mitglieder('AAAAAA', [true, true], 10)), STICHTAG);
    const oben = antwortZeilen(x.formular.anmeldung, a.einmal, x.ctFelder);
    expect(oben.find((z) => z.frage === 'Erziehungsberechtigte')?.text).toMatch(
      /^Maria Beispiel, 0151 111\nTom Beispiel/,
    );
    const sign = oben.find((z) => z.striche);
    expect(sign?.text).toBe('✓ Maria Beispiel, 17.10.2026');
    expect(unterschriftLesen(sign!.striche!)).toEqual(unterschriftLesen(STRICHE));
    const [jonas, lena] = a.personen.map((p) =>
      antwortZeilen(x.formular.person, p.werte, x.ctFelder),
    );
    expect(jonas.map((z) => [z.frage, z.text])).toContainEqual([
      'Dürfen Fotos veröffentlicht werden?',
      'Ja',
    ]);
    expect(lena.map((z) => [z.frage, z.text])).toContainEqual([
      'Dürfen Fotos veröffentlicht werden?',
      'Nein',
    ]);
    expect(lena.some((z) => z.frage.startsWith('Allergien'))).toBe(false);
  });

  it('zweites Kind auf der Warteliste: Betrag nur für das erste, Zahlen', () => {
    const x = e();
    const liste = anmeldungenAus(x, stand(mitglieder('AAAAAA', [true, false], 10)), STICHTAG);
    expect(liste[0].betragCent).toBe(600);
    expect(liste[0].personen.map((p) => [p.vor, p.status, p.warteplatz])).toEqual([
      ['Jonas', 'aktiv', null],
      ['Lena', 'wartet', 1],
    ]);
    expect(listenZahlen(x, liste)).toEqual({
      belegt: 1,
      wartend: 1,
      anmeldungen: 1,
      kostet: true,
      offenCent: 600,
      offen: 1,
      eingegangenCent: 0,
    });
  });

  it('bezahlt (bei der ersten Person) → nicht offen, eingegangen', () => {
    const x = e();
    const liste = anmeldungenAus(
      x,
      stand(mitglieder('AAAAAA', [true, true], 10, { bezahlt: true })),
      STICHTAG,
    );
    expect([liste[0].bezahlt, liste[0].bezahltAm, liste[0].zahlart, liste[0].zahlungOffen]).toEqual(
      [true, '2026-10-18', 'Bar', false],
    );
    // Geschrieben wird bei der ersten Person (A7-2).
    expect(liste[0].zahlungBei).toBe(10);
    expect(listenZahlen(x, liste)).toMatchObject({ offen: 0, offenCent: 0, eingegangenCent: 1200 });
  });
});

describe('Verlauf: Anmeldetag und Absagen', () => {
  it('Anmeldetag aus dem Verlauf – nicht das Eintrittsdatum (beim Nachrücken neu gesetzt)', () => {
    const st = stand(mitglieder('AAAAAA', [true, true], 10), [
      dazu(10, '2026-10-17'),
      dazu(11, '2026-10-17'),
    ]);
    expect(st.mitglieder.map((m) => m.angemeldetAm)).toEqual(['2026-10-17', '2026-10-17']);
    // Ohne Verlauf bleibt nur das Eintrittsdatum.
    expect(stand(mitglieder('AAAAAA', [true, true], 10)).mitglieder[0].angemeldetAm).toBe(
      '2026-10-19',
    );
  });

  it('die erste Person hat abgesagt → das Einmalige kommt aus dem Verlauf, Absage dabei', () => {
    const x = e();
    const [jonas, lena] = mitglieder('AAAAAA', [true, true], 10);
    const st = stand(
      [lena],
      [dazu(10, '2026-10-17'), dazu(11, '2026-10-17'), absage(jonas, '2026-10-18', 10)],
    );
    expect(abgesagteIds([absage(jonas, '2026-10-18', 10)], [lena])).toEqual([10]);
    const [a] = anmeldungenAus(x, st, STICHTAG);
    expect([a.wer, a.betragCent, a.einmalAusVerlauf, a.personen.map((p) => p.vor)]).toEqual([
      'Maria Beispiel',
      1200,
      true,
      ['Lena'],
    ]);
    // Die Zahlung steht bei niemandem mehr in der Gruppe – nicht still bei Lena schreiben (A7-2).
    expect(a.zahlungBei).toBeNull();
    expect(a.abgesagt.map((b) => [b.name, b.am, b.selbst, b.warVorher])).toEqual([
      ['Jonas Beispiel', '2026-10-18', true, 'aktiv'],
    ]);
    expect(antwortZeilen(x.formular.anmeldung, a.einmal, x.ctFelder).some((z) => z.striche)).toBe(
      true,
    );
  });

  it('vom Team entfernt; wer danach wieder dabei ist, gilt nicht als abgesagt', () => {
    const [jonas, lena] = mitglieder('AAAAAA', [true, true], 10);
    const st = stand(
      [jonas],
      [absage(lena, '2026-10-18', 1), absage(jonas, '2026-10-18', 1), dazu(10, '2026-10-19')],
    );
    expect(st.absagen.map((b) => [b.personId, b.selbst])).toEqual([[11, false]]);
  });
});

describe('Sonderfälle', () => {
  it('ohne Anmelde-Nr. (vor dem 17.10.2026): jede Person für sich', () => {
    const liste = anmeldungenAus(e(), stand(mitglieder(undefined, [true, true], 10)), STICHTAG);
    expect(liste.map((x) => [x.schluessel, x.nr, x.personen.length, x.betragCent])).toEqual([
      // Gleicher Tag → nach Namen: „Lena Beispiel“ vor „Maria Beispiel“ (Kontakt der ersten Person).
      ['p11', null, 1, null],
      ['p10', null, 1, 1200],
    ]);
  });

  it('Leitung zählt nicht; nicht angekreuzt ist keine Antwort', () => {
    const roh = mitglieder('AAAAAA', [true, true], 10);
    roh.push({ ...roh[0], personId: 1, groupTypeRoleId: 35 });
    const st = stand(roh);
    expect(st.mitglieder.map((m) => m.personId)).toEqual([10, 11]);
    expect(st.mitglieder[0].werte[BEZAHLT]).toBeUndefined();
  });

  it('kostenlos → nie „Zahlung offen“', () => {
    const x = e();
    x.preis.grundpreis.betragCent = 0;
    const liste = anmeldungenAus(x, stand(mitglieder('AAAAAA', [true, true], 10)), STICHTAG);
    expect([liste[0].zahlungOffen, listenZahlen(x, liste).kostet]).toEqual([false, false]);
  });
});
