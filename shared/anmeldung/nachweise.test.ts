import { describe, expect, it } from 'vitest';
import { STUFE_NACHWEIS } from './felder';
import {
  ERGEBNIS_EINTRAG,
  ERGEBNIS_OHNE,
  NACHWEIS_ABLAUF_NAME,
  NACHWEIS_FELDER,
  NACHWEIS_HINWEIS_SATZ,
  NACHWEIS_LEITER_RECHTE,
  NACHWEIS_VERWEIS,
  gleicherGruppenName,
  nachweisAblaufErkannt,
  nachweisAblaufStimmt,
  nachweisEinstellungenFehler,
  nachweisEinstellungenLesen,
  nachweisFeldAnlage,
  nachweisGruppenName,
  nachweisGueltigText,
  nachweisMail,
  nachweisNameAus,
  nachweisNameFehler,
  nachweisNotiz,
  nachweisSchritte,
  nachweisSichtbarerText,
  type NachweisEinstellungen,
  type NachweisSchrittRoh,
} from './nachweise';

const E: NachweisEinstellungen = {
  gueltigJahre: 3,
  ab: 'ausstellung',
  betreff: 'Bitte Führungszeugnis beantragen',
  text: 'Hallo [Vorname],\n\nbitte beantrage ein Führungszeugnis.',
};
const ART = { name: 'Führungszeugnis', ...E };

describe('Rechte der Leiter-Rolle', () => {
  it('genau fünf: Infos, Mitglieder, Felder sehen und bearbeiten, Follow-ups', () => {
    expect(NACHWEIS_LEITER_RECHTE.map((r) => r.authId).sort()).toEqual(
      [10101, 10102, 10110, 10126, 10133].sort(),
    );
  });

  it('die Stufe der Felder-Rechte ist die der Felder – eine Quelle', () => {
    for (const authId of [10126, 10133])
      expect(NACHWEIS_LEITER_RECHTE.find((r) => r.authId === authId)?.dataId).toBe(STUFE_NACHWEIS);
    for (const f of NACHWEIS_FELDER)
      expect(nachweisFeldAnlage(f).securityLevel).toBe(STUFE_NACHWEIS);
  });

  it('Infos und Mitglieder sehen mit Stufe 1, Follow-ups ohne Stufe', () => {
    const r = (id: number) => NACHWEIS_LEITER_RECHTE.find((x) => x.authId === id);
    expect(r(10102)?.dataId).toBe(1);
    expect(r(10101)?.dataId).toBe(1);
    expect(r(10110)?.dataId).toBeNull();
  });
});

describe('Name der Gruppe', () => {
  it('Präfix davor und wieder weg – groß/klein egal', () => {
    expect(nachweisGruppenName('  JuLeiCa ')).toBe('Nachweis: JuLeiCa');
    expect(nachweisNameAus('Nachweis: JuLeiCa')).toBe('JuLeiCa');
    expect(nachweisNameAus('nachweis:   JuLeiCa')).toBe('JuLeiCa');
    expect(nachweisNameAus('Etwas anderes')).toBe('Etwas anderes');
  });
  it('gleich: ohne Rand und Groß/Klein', () => {
    expect(gleicherGruppenName(' Nachweis: X ', 'nachweis: x')).toBe(true);
    expect(gleicherGruppenName('Nachweis: X', 'Nachweis: Y')).toBe(false);
  });
  it('leerer oder zu langer Name wird abgewiesen', () => {
    expect(nachweisNameFehler('  ')).toMatch(/Namen/);
    expect(nachweisNameFehler('x'.repeat(81))).toMatch(/zu lang/);
    expect(nachweisNameFehler('Führungszeugnis')).toBeNull();
  });
});

describe('Felder', () => {
  it('Eingesehen am, Ausgestellt am (Datum), Ergebnis (Auswahl mit den zwei Antworten) – nicht im Anmeldeformular', () => {
    const a = NACHWEIS_FELDER.map((f) => nachweisFeldAnlage(f));
    expect(a.map((x) => [x.name, x.fieldTypeCode])).toEqual([
      ['Eingesehen am', 'date'],
      ['Ausgestellt am', 'date'],
      ['Ergebnis', 'radioselect'],
    ]);
    expect(a.every((x) => !x.useInRegistrationForm && !x.requiredInRegistrationForm)).toBe(true);
    expect(a[2].options).toEqual([{ name: ERGEBNIS_OHNE }, { name: ERGEBNIS_EINTRAG }]);
    expect(ERGEBNIS_OHNE).toBe('Keine Eintragung, die einer Mitarbeit entgegensteht');
    expect(ERGEBNIS_EINTRAG).toBe('Eintragung – Rücksprache mit der Leitung nötig');
    expect(a[0]).not.toHaveProperty('options');
  });
});

describe('Datenblock der Einstellungen', () => {
  it('schreiben → lesen gibt dasselbe zurück', () => {
    expect(nachweisEinstellungenLesen(nachweisNotiz(E))).toEqual(E);
  });

  it('der sichtbare Text bleibt, eigener Text von Hand wird nicht überschrieben', () => {
    expect(nachweisSichtbarerText(nachweisNotiz(E))).toBe(NACHWEIS_HINWEIS_SATZ);
    const eigen = nachweisNotiz(E, 'Das ist unser Führungszeugnis.');
    expect(nachweisSichtbarerText(eigen)).toBe('Das ist unser Führungszeugnis.');
    // Änderung: die Zeile wird ersetzt, der Text bleibt
    const neu = nachweisNotiz({ ...E, gueltigJahre: 5 }, nachweisSichtbarerText(eigen));
    expect(nachweisEinstellungenLesen(neu)?.gueltigJahre).toBe(5);
    expect(neu.startsWith('Das ist unser Führungszeugnis.')).toBe(true);
    expect(neu.split(NACHWEIS_VERWEIS).length).toBe(2);
  });

  it('keine, altes, fremdes oder kaputtes Format → null, wirft nicht', () => {
    expect(nachweisEinstellungenLesen(null)).toBeNull();
    expect(nachweisEinstellungenLesen('')).toBeNull();
    expect(nachweisEinstellungenLesen('Nur Text')).toBeNull();
    expect(nachweisEinstellungenLesen('[anmeldung]: #v2:AAAA')).toBeNull();
    expect(nachweisEinstellungenLesen(`${NACHWEIS_VERWEIS}kaputt!!`)).toBeNull();
    expect(nachweisEinstellungenLesen(`${NACHWEIS_VERWEIS}AAAA`)).toBeNull();
    expect(nachweisEinstellungenLesen('[nachweis]: #v9:AAAA')).toBeNull();
  });

  it('gültiger Aufbau, aber falsche Werte (Jahre 0) → null', () => {
    const gut = nachweisNotiz(E);
    expect(nachweisEinstellungenLesen(gut)).not.toBeNull();
    expect(() => nachweisNotiz({ ...E, gueltigJahre: 0 })).toThrow();
  });

  it('prüft Jahre, Betreff, Text und unbekannte Platzhalter', () => {
    expect(nachweisEinstellungenFehler(E)).toBeNull();
    expect(nachweisEinstellungenFehler({ ...E, gueltigJahre: 0 })).toMatch(/Gültigkeit/);
    expect(nachweisEinstellungenFehler({ ...E, gueltigJahre: 11 })).toMatch(/Gültigkeit/);
    expect(nachweisEinstellungenFehler({ ...E, betreff: ' ' })).toMatch(/Betreff/);
    expect(nachweisEinstellungenFehler({ ...E, text: '' })).toMatch(/Text/);
    expect(nachweisEinstellungenFehler({ ...E, text: 'Hallo [Spitzname]' })).toMatch(
      /\[Spitzname\]/,
    );
  });

  it('Gültigkeit als Text', () => {
    expect(nachweisGueltigText({ gueltigJahre: 3, ab: 'ausstellung' })).toBe(
      '3 Jahre ab Ausstellung',
    );
    expect(nachweisGueltigText({ gueltigJahre: 1, ab: 'einsicht' })).toBe('1 Jahr ab Einsicht');
  });
});

describe('Mail der Aufforderung', () => {
  it('[Vorname] wird zum Platzhalter von ChurchTools, Absätze werden HTML', () => {
    const m = nachweisMail(E);
    expect(m.html).toContain('{{person.firstName}}');
    expect(m.html).toContain('<p>');
    expect(m.unbekannt).toEqual([]);
    expect(m.betreff).toBe(E.betreff);
  });
  it('„{{“ im Betreff wird entschärft', () => {
    expect(nachweisMail({ ...E, betreff: 'Hallo {{x}}' }).betreff).toBe('Hallo { {x}}');
  });
});

describe('Schritte des Ablaufs', () => {
  const s = nachweisSchritte(ART, 7);
  const folge = (x: (typeof s)[number]) => x.actionData as Record<string, unknown>;

  it('Reihenfolge: Mail, Einladung, Folgeaufgabe, Wiederholen (Folgeaufgabe + Warten)', () => {
    expect(s.map((x) => x.actionKey)).toEqual([
      'send-member-email',
      'invite-member',
      'create-follow-up',
      'special:repeat',
    ]);
    expect(s[3].children?.map((x) => x.actionKey)).toEqual(['create-follow-up', 'special:wait']);
    expect(s.every((x) => x.isEnabled)).toBe(true);
  });

  it('Mail: Betreff, Text, Absender, ohne Abmelde-Link, ohne Anhang', () => {
    const d = folge(s[0]);
    const m = nachweisMail(E);
    expect(d).toMatchObject({
      subject: m.betreff,
      body: m.html,
      senderId: 7,
      addSignOutUrl: false,
      attachmentIds: [],
      skipIfEmailAddressMissing: false,
      templateId: null,
    });
  });

  it('Einladung hat keine actionData', () => {
    expect(s[1].actionData).toBeNull();
  });

  it('Folgeaufgabe „Einsicht nehmen“: 14 Tage, weiter erst wenn erledigt', () => {
    expect(folge(s[2])).toEqual({
      title: 'Einsicht nehmen',
      description: 'Führungszeugnis einsehen',
      color: 'yellow',
      icon: 'handshake',
      origin: 'routine',
      continuationType: 'when-completed',
      duration: { numDays: 14 },
      successGroupId: null,
      successGroupMemberStatus: null,
      successGroupOfGroupTypeId: null,
      successRoleId: null,
    });
  });

  it('Wiederholen: numYears = Gültigkeit der Art, dazu Warten 1 Tag', () => {
    for (const jahre of [1, 3, 10]) {
      const x = nachweisSchritte({ ...ART, gueltigJahre: jahre }, 7)[3].children!;
      expect(folge(x[0])).toMatchObject({
        title: 'Erneut einsehen',
        duration: { numYears: jahre },
      });
      expect(folge(x[1])).toEqual({ duration: { numDays: 1 } });
    }
  });

  it('beim Anlegen keine Nummern', () => {
    const alle = JSON.stringify(s);
    expect(alle).not.toContain('"id"');
    expect(alle).not.toContain('specId');
  });

  describe('Ändern', () => {
    /** So liefert ChurchTools den Ablauf zurück: Nummern an jedem Schritt, specId an den Folgeaufgaben. */
    const gelesen = (): NachweisSchrittRoh[] => {
      const neu = JSON.parse(JSON.stringify(nachweisSchritte(ART, 7))) as NachweisSchrittRoh[];
      neu[0].id = 11;
      neu[1].id = 12;
      neu[2].id = 13;
      neu[2].specId = 101;
      neu[3].id = 14;
      neu[3].children![0].id = 15;
      neu[3].children![0].specId = 102;
      neu[3].children![1].id = 16;
      return neu;
    };

    it('behält id und specId jedes Schritts, auch der Kinder', () => {
      const n = nachweisSchritte({ ...ART, gueltigJahre: 5 }, 7, gelesen());
      expect(n.map((x) => x.id)).toEqual([11, 12, 13, 14]);
      expect(n[2].specId).toBe(101);
      expect(n[3].children?.map((x) => x.id)).toEqual([15, 16]);
      expect(n[3].children?.[0].specId).toBe(102);
      expect(folge(n[3].children![0])).toMatchObject({ duration: { numYears: 5 } });
    });

    it('behält, was ChurchTools in actionData sonst noch kennt', () => {
      const alt = gelesen();
      alt[2].actionData = { ...alt[2].actionData, specId: 555, fremd: 'bleibt' };
      const n = nachweisSchritte(ART, 7, alt);
      expect(folge(n[2])).toMatchObject({ specId: 555, fremd: 'bleibt', title: 'Einsicht nehmen' });
    });

    it('Name und Betreff ändern sich mit', () => {
      const n = nachweisSchritte({ ...ART, name: 'JuLeiCa', betreff: 'Neu' }, 9, gelesen());
      expect(folge(n[0])).toMatchObject({ subject: 'Neu', senderId: 9 });
      expect(folge(n[2]).description).toBe('JuLeiCa einsehen');
    });

    it('andere Form in ChurchTools (Schritt dazugebaut): keine Nummern übernommen, Form nicht erkannt', () => {
      const alt = gelesen();
      alt.splice(1, 0, { id: 99, actionKey: 'send-member-email' });
      expect(nachweisAblaufErkannt(alt)).toBe(false);
      expect(JSON.stringify(nachweisSchritte(ART, 7, alt))).not.toContain('"id"');
    });

    it('die erwartete Form wird erkannt, ein leerer Ablauf nicht', () => {
      expect(nachweisAblaufErkannt(gelesen())).toBe(true);
      expect(nachweisAblaufErkannt([])).toBe(false);
    });
  });

  describe('Nachlesen', () => {
    it('stimmt, wenn der Ablauf so dasteht (auch mit Nummern, numDays: null daneben und anderem HTML)', () => {
      const da = JSON.parse(JSON.stringify(nachweisSchritte(ART, 7))) as NachweisSchrittRoh[];
      da[3].children![0].actionData = {
        ...da[3].children![0].actionData,
        duration: { numDays: null, numYears: 3 },
      };
      da[0].actionData = { ...da[0].actionData, body: '<div>anders verpackt</div>' };
      expect(nachweisAblaufStimmt(da, ART, 7)).toBe(true);
    });

    it('stimmt nicht bei anderem Absender, anderen Jahren, anderem Betreff oder fehlendem Schritt', () => {
      const da = nachweisSchritte(ART, 7) as NachweisSchrittRoh[];
      expect(nachweisAblaufStimmt(da, ART, 8)).toBe(false);
      expect(nachweisAblaufStimmt(da, { ...ART, gueltigJahre: 4 }, 7)).toBe(false);
      expect(nachweisAblaufStimmt(da, { ...ART, betreff: 'Anders' }, 7)).toBe(false);
      expect(nachweisAblaufStimmt(da.slice(0, 3), ART, 7)).toBe(false);
    });
  });
});

it('der Name des Ablaufs ist fest – daran erkennt die Erweiterung ihren eigenen', () => {
  expect(NACHWEIS_ABLAUF_NAME).toBe('Nachweise: Aufforderung und Einsicht');
});
