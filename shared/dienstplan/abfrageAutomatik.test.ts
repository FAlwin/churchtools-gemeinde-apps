import { describe, expect, it } from 'vitest';
import {
  einrichtenPlan,
  gruppenIdsDerDienste,
  hilfsgruppenBeschreibung,
  hilfsgruppenName,
  istHilfsgruppenTyp,
  istUnsereRoutine,
  personenIdsAusRecht,
  planerListe,
  routinenName,
  PLANER_GRUPPENRECHTE,
  abfrageRoutinenSchritte,
  gruppenRechteAus,
  rechtDataIdsAus,
  type EinrichtenIst,
  type GruppenRecht,
} from './abfrageAutomatik';
import { STANDARD_PLAN, type Abfrage, type Erinnerungsplan } from './abfragen';
import { mailFuer } from './abfrageMail';
import { plusTage } from '../ct/datum';

/** **Erinnerungen in ChurchTools einrichten – die Regeln** (R-5a): Namen, Planer-Liste, Soll gegen Ist. */
describe('Namen', () => {
  it('Gruppe, Routine und Beschreibung nennen die Dienstgruppe', () => {
    expect(hilfsgruppenName('Musik')).toBe('Dienstplaner: Antwort fehlt – Musik');
    expect(routinenName('Musik')).toBe('Dienstplaner: Erinnerungen Musik');
    const b = hilfsgruppenBeschreibung('Musik');
    expect(b).toContain('Musik');
    expect(b).toContain('trägt Personen ein und wieder aus');
  });

  it('nur der Gruppentyp „Dienstplaner“ passt (Leerzeichen am Rand egal)', () => {
    expect(istHilfsgruppenTyp('Dienstplaner')).toBe(true);
    expect(istHilfsgruppenTyp(' Dienstplaner ')).toBe(true);
    for (const x of ['dienstplaner', 'Dienstplaner 2', 'Dienst', null, 5])
      expect(istHilfsgruppenTyp(x)).toBe(false);
  });

  it('unsere Routine erkennt man am Namen – gegen die Erzeuger', () => {
    expect(istUnsereRoutine(routinenName('Technik'))).toBe(true);
    expect(istUnsereRoutine('Gruppenwechsel X: aufräumen')).toBe(false);
    expect(istUnsereRoutine(undefined)).toBe(false);
  });
});

describe('Planer-Liste', () => {
  it('beide Quellen, sortiert, ohne Doppel', () => {
    expect(planerListe({ recht: [5, 2, 9], leitungen: [9, 3, 2] })).toEqual([2, 3, 5, 9]);
  });

  it('jede Quelle allein zählt; beide leer = niemand', () => {
    expect(planerListe({ recht: [4], leitungen: [] })).toEqual([4]);
    expect(planerListe({ recht: [], leitungen: [7] })).toEqual([7]);
    expect(planerListe({ recht: [], leitungen: [] })).toEqual([]);
  });

  it('die Gruppen der Dienste: nur die der Dienstgruppe, jede einmal (Kamera teilt eine)', () => {
    const dienste = [
      { dienstgruppeId: 4, gruppenIds: [21, 22] },
      { dienstgruppeId: 4, gruppenIds: [22] },
      { dienstgruppeId: 3, gruppenIds: [30] },
      { dienstgruppeId: null, gruppenIds: [99] },
    ];
    expect(gruppenIdsDerDienste(dienste, 4)).toEqual([21, 22]);
    expect(gruppenIdsDerDienste(dienste, 3)).toEqual([30]);
    expect(gruppenIdsDerDienste(dienste, 8)).toEqual([]);
  });

  it('die Antwort des Rechts wird in der gemessenen Form streng gelesen: eine halbe Liste ist keine Liste', () => {
    // Gemessen 25.11.2026 (Test-Instanz), nach dem Auspacken von `data`.
    const antwort = (personIds: unknown, dataId: unknown = 4) => ({
      authId: 305,
      selections: [{ dataId, personIds }],
    });
    expect(personenIdsAusRecht(antwort([1, 19]), 4)).toEqual([1, 19]);
    expect(personenIdsAusRecht(antwort([]), 4)).toEqual([]);
    // Nur der Eintrag DIESER Dienstgruppe zählt.
    expect(personenIdsAusRecht(antwort([1], 3), 4)).toBeNull();
    for (const roh of [
      null,
      {},
      'x',
      [1, 2],
      { selections: 'x' },
      antwort('x'),
      antwort([1, null]),
      antwort([0]),
      antwort([1.5]),
      antwort([true]),
    ])
      expect(personenIdsAusRecht(roh, 4)).toBeNull();
  });
});

const AUTH = { sehen: 1104, bearbeiten: 1112 } as const;
const haben = (...k: GruppenRecht[]) => new Set<GruppenRecht>(k);

describe('Rechte der Planer', () => {
  it('die zwei Rechte sind „Gruppe inkl. Mitglieder sehen“ und „Mitgliedschaften einer Gruppe bearbeiten“ (churchgroup)', () => {
    expect(PLANER_GRUPPENRECHTE.map((r) => [r.modul, r.recht])).toEqual([
      ['churchgroup', 'view group'],
      ['churchgroup', 'edit group memberships of group'],
    ]);
  });

  it('gelesen wird je Hilfsgruppe: dataId = Gruppe, eine Liste davon, oder -1 (alle)', () => {
    const zeilen = [
      { authId: 1104, dataId: 50 },
      { authId: 1112, dataId: [49, 50] },
      { authId: 1104, dataId: 77 },
    ];
    expect(gruppenRechteAus(zeilen, AUTH, 50)).toEqual(haben('sehen', 'bearbeiten'));
    // Andere Gruppe: weder 50 noch -1 → nichts.
    expect(gruppenRechteAus(zeilen, AUTH, 99)).toEqual(haben());
    expect(gruppenRechteAus([{ authId: 1112, dataId: -1 }], AUTH, 99)).toEqual(haben('bearbeiten'));
    // Fremde Rechte zählen nicht.
    expect(gruppenRechteAus([{ authId: 305, dataId: 50 }], AUTH, 50)).toEqual(haben());
  });

  it('eine Antwort in unbekannter Gestalt ist „nicht lesbar“ (null) – nie „hat nichts“', () => {
    for (const roh of [null, {}, 'x', { data: [] }, 5]) {
      expect(gruppenRechteAus(roh, AUTH, 50)).toBeNull();
      expect(rechtDataIdsAus(roh, 1104)).toBeNull();
    }
  });

  it('alle Nummern eines Rechts – damit ein ersetzendes PUT auffällt', () => {
    const zeilen = [
      { authId: 1104, dataId: 50 },
      { authId: 1104, dataId: [51, 52] },
      { authId: 1112, dataId: 53 },
    ];
    expect([...(rechtDataIdsAus(zeilen, 1104) ?? [])].sort()).toEqual([50, 51, 52]);
  });
});

describe('Soll gegen Ist', () => {
  const leer: EinrichtenIst = {
    gruppe: false,
    routine: false,
    eingetragen: false,
    rechte: new Map(),
  };
  const alles: EinrichtenIst = {
    gruppe: true,
    routine: true,
    eingetragen: true,
    rechte: new Map([1, 2, 3].map((p) => [p, haben('sehen', 'bearbeiten')])),
  };

  it('nichts da → alles anlegen, jedem Planer beide Rechte', () => {
    expect(einrichtenPlan([3, 1, 2], leer)).toEqual({
      gruppeAnlegen: true,
      routineAnlegen: true,
      einrichtungSchreiben: true,
      rechteNachtragen: [1, 2, 3].map((personId) => ({
        personId,
        fehlt: ['sehen', 'bearbeiten'],
      })),
      nichtsZuTun: false,
    });
  });

  it('alles da → nichts zu tun', () => {
    expect(einrichtenPlan([1, 2, 3], alles)).toMatchObject({
      gruppeAnlegen: false,
      routineAnlegen: false,
      einrichtungSchreiben: false,
      rechteNachtragen: [],
      nichtsZuTun: true,
    });
  });

  it('einem Planer fehlt eines der zwei Rechte → nur dieses, nur er', () => {
    const rechte = new Map(alles.rechte);
    rechte.set(2, haben('sehen'));
    const p = einrichtenPlan([1, 2, 3], { ...alles, rechte });
    expect(p.rechteNachtragen).toEqual([{ personId: 2, fehlt: ['bearbeiten'] }]);
    expect(p.nichtsZuTun).toBe(false);
  });

  it('ein Planer ohne jeden Eintrag → beide fehlen', () => {
    const p = einrichtenPlan([1, 9], {
      ...alles,
      rechte: new Map([[1, haben('sehen', 'bearbeiten')]]),
    });
    expect(p.rechteNachtragen).toEqual([{ personId: 9, fehlt: ['sehen', 'bearbeiten'] }]);
  });

  it('die Gruppe fehlt → auch die Routine; Rechte einer alten Gruppe zählen nicht', () => {
    const p = einrichtenPlan([1, 2], { ...alles, gruppe: false, routine: true });
    expect(p).toMatchObject({ gruppeAnlegen: true, routineAnlegen: true });
    expect(p.rechteNachtragen.map((r) => r.personId)).toEqual([1, 2]);
  });

  it('nur die Routine fehlt → nur sie, die Rechte bleiben', () => {
    expect(einrichtenPlan([1, 2, 3], { ...alles, routine: false })).toMatchObject({
      gruppeAnlegen: false,
      routineAnlegen: true,
      einrichtungSchreiben: true,
      rechteNachtragen: [],
    });
  });

  it('Gruppe und Routine stehen, das Dokument kennt sie noch nicht → nur das Dokument', () => {
    expect(einrichtenPlan([1, 2, 3], { ...alles, eingetragen: false })).toMatchObject({
      gruppeAnlegen: false,
      routineAnlegen: false,
      einrichtungSchreiben: true,
      nichtsZuTun: false,
    });
  });

  it('Rechte von Personen, die keine Planer (mehr) sind, werden nie angefasst: der Plan kennt sie nicht', () => {
    const rechte = new Map(alles.rechte);
    rechte.set(8, haben('sehen', 'bearbeiten'));
    expect(einrichtenPlan([1], { ...alles, rechte })).toMatchObject({
      rechteNachtragen: [],
      nichtsZuTun: true,
    });
  });
});

describe('Routine-Schritte', () => {
  const abfrage = (t: Partial<Abfrage> = {}): Abfrage => ({
    id: 'a1',
    von: '2027-03-01',
    bis: '2027-03-31',
    frist: '2027-02-05',
    oeffnen: '2027-01-20',
    termine: [1, 2],
    gestartet: { personId: 7, name: 'Alwin', zeit: '2027-01-20T10:00:00Z' },
    beendet: null,
    ...t,
  });
  const LINK = 'https://ct.example/ccm/dienstplan/#/abwesenheiten?abfrage=4';
  const schritte = (heute: string, a: Abfrage = abfrage(), plan: Erinnerungsplan = STANDARD_PLAN) =>
    abfrageRoutinenSchritte({
      plan,
      abfrage: a,
      heute,
      dienstgruppe: 'Musik',
      link: LINK,
      senderId: 7,
    });
  const arten = (heute: string, a?: Abfrage, plan?: Erinnerungsplan) =>
    schritte(heute, a, plan).map((s) =>
      s.actionKey === 'special:wait'
        ? `warten ${(s.actionData as { untilDate: string }).untilDate}`
        : s.actionKey === 'send-member-email'
          ? 'mail'
          : 'austragen',
    );

  it('heute ist der Öffnen-Tag: die erste Mail ohne Warten, dann je Tag warten + Mail, am Ende warten + austragen', () => {
    // Standardplan: Öffnen 20.01., 2 Tage vor der Frist 03.02., Frist 05.02., danach 06.–08.02.
    expect(arten('2027-01-20')).toEqual([
      'mail',
      'warten 2027-02-03',
      'mail',
      'warten 2027-02-05',
      'mail',
      'warten 2027-02-06',
      'mail',
      'warten 2027-02-07',
      'mail',
      'warten 2027-02-08',
      'mail',
      'warten 2027-03-01',
      'austragen',
    ]);
  });

  it('Start vor dem Öffnen: vorn „warten bis Öffnen“, wenn der Öffnen-Tag keine Mail hat', () => {
    const plan: Erinnerungsplan = { punkte: [{ art: 'frist' }], mail: null };
    expect(arten('2027-01-10', abfrage(), plan)).toEqual([
      'warten 2027-01-20',
      'warten 2027-02-05',
      'mail',
      'warten 2027-03-01',
      'austragen',
    ]);
  });

  it('Start vor dem Öffnen, Öffnen ist Mail-Tag: warten + Mail, kein doppeltes Warten', () => {
    expect(arten('2027-01-10').slice(0, 3)).toEqual([
      'warten 2027-01-20',
      'mail',
      'warten 2027-02-03',
    ]);
  });

  it('ohne Erinnerungstage bleibt das Ende: warten bis Beginn, austragen', () => {
    expect(arten('2027-01-20', abfrage(), { punkte: [], mail: null })).toEqual([
      'warten 2027-03-01',
      'austragen',
    ]);
    // Öffnet erst später: vorn trotzdem das Warten (ohne Mail), damit nichts vorher läuft.
    expect(arten('2027-01-10', abfrage(), { punkte: [], mail: null })).toEqual([
      'warten 2027-01-20',
      'warten 2027-03-01',
      'austragen',
    ]);
  });

  it('Gegenprobe-Regel: nie ein Warten auf einen Tag, der nicht nach heute liegt – für jeden Starttag', () => {
    for (let n = 0; n < 45; n++) {
      const heute = plusTage('2027-01-15', n);
      // Öffnen am Starttag oder später; Frist/Von bleiben fest – sonst ist die Abfrage nicht startbar.
      const a = abfrage({ oeffnen: heute > '2027-02-04' ? '2027-02-04' : heute });
      if (heute > a.frist) continue;
      for (const s of schritte(heute, a))
        if (s.actionKey === 'special:wait' && 'untilDate' in s.actionData)
          expect(s.actionData.untilDate > heute).toBe(true);
    }
  });

  it('ein Zeitraum, der schon begonnen hat (von <= heute): kein Warten auf von – nie ein Warten auf einen Tag, der nicht nach heute liegt', () => {
    const a = abfrage({ von: '2027-01-20', frist: '2027-01-19', oeffnen: '2027-01-10' });
    const s = schritte('2027-01-20', a, { punkte: [], mail: null });
    expect(s.map((x) => x.actionKey)).toEqual(['remove-member']);
  });

  it('Reihenfolge der Wartetage ist aufsteigend (die Tage kommen aus erinnerungsTage)', () => {
    const tage = schritte('2027-01-10').flatMap((s) =>
      s.actionKey === 'special:wait' && 'untilDate' in s.actionData ? [s.actionData.untilDate] : [],
    );
    expect(tage).toEqual([...tage].sort());
  });

  it('die Mail kommt aus mailFuer – mit dem Link der Dienstgruppe, Absender, ohne Abmelde-Link, Adresse optional', () => {
    const a = abfrage();
    const m = mailFuer(STANDARD_PLAN, a, 'Musik', LINK);
    const mails = schritte('2027-01-20', a).filter((s) => s.actionKey === 'send-member-email');
    expect(mails.length).toBeGreaterThan(0);
    for (const s of mails)
      expect(s).toEqual({
        actionKey: 'send-member-email',
        isEnabled: true,
        actionData: {
          subject: m.betreff,
          body: m.html,
          addSignOutUrl: false,
          senderId: 7,
          skipIfEmailAddressMissing: true,
        },
      });
    expect(m.html).toContain(LINK);
  });

  it('ein eigener Mailtext kommt in die Schritte (plan.mail)', () => {
    const plan: Erinnerungsplan = {
      punkte: [{ art: 'frist' }],
      mail: { betreff: 'Hallo {gruppe}', text: 'Hi {vorname}' },
    };
    const mail = schritte('2027-01-10', abfrage(), plan).find(
      (s) => s.actionKey === 'send-member-email',
    );
    expect((mail?.actionData as { subject: string }).subject).toBe('Hallo Musik');
  });
});
