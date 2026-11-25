import { describe, expect, it } from 'vitest';
import { ApiError } from '@ui/ct/fehler';
import type { RoutinenSchritt } from '@shared/ct/routinen';
import {
  abgleichen,
  austretenWennFertig,
  eintragen,
  eintragenText,
  fehlendeNachtragen,
  gruppeLeeren,
  startVorbereiten,
} from './abfrageAutomatikLauf';
import { EINR, GRUPPE, hilfsgruppe, R_LEITER, R_TEILNEHMER } from './abfrageAutomatik.testutil';

/**
 * **Die Automatik einer Abfrage – der Ablauf** (R-5b) gegen eine nachgebaute Hilfsgruppe: Start (Gruppe leer? Schritte
 * ersetzen und nachlesen, Teilnehmer eintragen und nachlesen), Leeren, Abgleich (nur austragen), Austritt beim Antworten.
 * Die Zweige einzeln: kein Recht ≠ Aussetzer; nur die Rolle „Teilnehmer“ zählt.
 */
const SCHRITTE: RoutinenSchritt[] = [
  { actionKey: 'special:wait', isEnabled: true, actionData: { untilDate: '2027-02-03' } },
  {
    actionKey: 'send-member-email',
    isEnabled: true,
    actionData: { subject: 'x', body: '<p>x</p>', addSignOutUrl: false, senderId: 7 },
  },
  { actionKey: 'remove-member', isEnabled: true, actionData: {} },
];
const ANNA = { id: 5, name: 'Anna' };
const BEN = { id: 8, name: 'Ben' };
const CARLA = { id: 11, name: 'Carla' };
const tn = (person: number) => ({ person, rolle: R_TEILNEHMER });

describe('startVorbereiten – (a) Gruppe leer? (b) Schritte ersetzen und nachlesen', () => {
  it('leere Gruppe: Schritte ersetzt, nachgelesen (Art + Datum), Rolle der Routine geliefert', async () => {
    const { w, a } = hilfsgruppe();
    const v = await startVorbereiten(a, EINR, SCHRITTE);
    expect(v).toEqual({ art: 'bereit', rolle: R_TEILNEHMER });
    expect(w.log).toEqual([`PATCH /routines/60`]);
    expect(w.patches[0]).toEqual({ isEnabled: true, steps: SCHRITTE });
    expect(w.schritte.map((s) => s.actionKey)).toEqual([
      'special:wait',
      'send-member-email',
      'remove-member',
    ]);
  });

  it('ist die Gruppe NICHT leer: Stopp mit Namen und „Gruppe leeren“, es wird nichts geschrieben', async () => {
    const { w, a } = hilfsgruppe({ mitglieder: [tn(5), tn(8)] });
    const v = await startVorbereiten(a, EINR, SCHRITTE);
    expect(v).toMatchObject({ art: 'gestoppt', leeren: true, nochmal: false });
    expect((v as { text: string }).text).toContain('Reste einer früheren Abfrage');
    expect((v as { text: string }).text).toContain('Person 5, Person 8');
    expect(w.log).toEqual([]);
  });

  it('Leiter aus früheren Probe-Einrichtungen blockieren den Start nicht – nur Teilnehmer zählen', async () => {
    const { w, a } = hilfsgruppe({ mitglieder: [{ person: 1, rolle: R_LEITER }] });
    expect(await startVorbereiten(a, EINR, SCHRITTE)).toMatchObject({ art: 'bereit' });
    expect(w.log).toEqual(['PATCH /routines/60']);
  });

  it('403 beim Lesen: kein Recht → ohne Automatik starten (nichts geschrieben)', async () => {
    const { w, a } = hilfsgruppe();
    w.stoerung.wirft = { [`GET /groups/${GRUPPE}/members`]: new ApiError(403, 'verboten') };
    expect(await startVorbereiten(a, EINR, SCHRITTE)).toMatchObject({ art: 'ohneAutomatik' });
    expect(w.log).toEqual([]);
  });

  it('403 beim Ersetzen der Schritte: kein Recht → ohne Automatik (die Gruppe war leer)', async () => {
    const { w, a } = hilfsgruppe();
    w.stoerung.wirft = { 'PATCH /routines/60': new ApiError(403, 'verboten') };
    expect(await startVorbereiten(a, EINR, SCHRITTE)).toMatchObject({ art: 'ohneAutomatik' });
  });

  it('Aussetzer (503) oder Netzfehler beim Lesen: STOPP, nichts geschrieben – nie „ohne Automatik“', async () => {
    for (const fehler of [new ApiError(503, 'ct'), new TypeError('Failed to fetch')]) {
      const { w, a } = hilfsgruppe();
      w.stoerung.wirft = { [`GET /groups/${GRUPPE}/members`]: fehler };
      const v = await startVorbereiten(a, EINR, SCHRITTE);
      expect(v).toMatchObject({ art: 'gestoppt', nochmal: true, leeren: false });
      expect(w.log).toEqual([]);
    }
  });

  it('Aussetzer beim Ersetzen: gestoppt, die Meldung sagt „nicht gestartet“', async () => {
    const { w, a } = hilfsgruppe();
    w.stoerung.wirft = { 'PATCH /routines/60': new ApiError(503, 'ct') };
    const v = await startVorbereiten(a, EINR, SCHRITTE);
    expect(v).toMatchObject({ art: 'gestoppt', nochmal: true });
    expect((v as { text: string }).text).toContain('nicht gestartet');
  });

  it('ChurchTools sagt 200 und übernimmt die Schritte nicht → Stopp (nachgelesen steht etwas anderes da)', async () => {
    const { w, a } = hilfsgruppe({
      schritte: [{ actionKey: 'remove-member', actionData: {} }],
    });
    w.stoerung.schluckeSchritte = true;
    const v = await startVorbereiten(a, EINR, SCHRITTE);
    expect(v).toMatchObject({ art: 'gestoppt', nochmal: true });
    expect((v as { text: string }).text).toContain('nicht übernommen');
  });

  it('nur Art und Datum werden verglichen – ein anderes Datum ist ein Fehler, ein umformatierter Mailtext nicht', async () => {
    const { w, a } = hilfsgruppe();
    const echt = a.port.holen.bind(a.port);
    // ChurchTools gibt die Schritte mit anderem HTML zurück, aber gleichen Arten und Daten.
    a.port.holen = ((pfad: string) =>
      echt(pfad).then((r) =>
        pfad.endsWith('/routines')
          ? (
              r as {
                routine: { steps: { actionKey: string; actionData: Record<string, unknown> }[] };
              }[]
            ).map((z) => ({
              ...z,
              routine: {
                ...z.routine,
                steps: z.routine.steps.map((s) =>
                  s.actionKey === 'send-member-email'
                    ? { ...s, actionData: { ...s.actionData, body: '<div>normalisiert</div>' } }
                    : s,
                ),
              },
            }))
          : r,
      )) as typeof a.port.holen;
    expect(await startVorbereiten(a, EINR, SCHRITTE)).toMatchObject({ art: 'bereit' });
    const falsch: RoutinenSchritt[] = [
      { actionKey: 'special:wait', isEnabled: true, actionData: { untilDate: '2027-02-04' } },
      ...SCHRITTE.slice(1),
    ];
    w.stoerung.schluckeSchritte = true;
    expect(await startVorbereiten(a, EINR, falsch)).toMatchObject({ art: 'gestoppt' });
  });

  it('die Routine fehlt in der Gruppe: es kann nichts verschickt werden – start ohne Automatik, Hinweis „neu einrichten“, nichts geschrieben', async () => {
    const { w, a } = hilfsgruppe({ routineVorhanden: false });
    const v = await startVorbereiten(a, EINR, SCHRITTE);
    expect(v).toMatchObject({ art: 'ohneAutomatik' });
    expect((v as { text: string }).text).toContain('neu einrichten');
    expect(w.log).toEqual([]);
  });

  it('die Hilfsgruppe ist in ChurchTools gelöscht (404): ohne Automatik, nicht gesperrt – das „Abfragen und Erinnern per Hand gehen trotzdem“ gilt', async () => {
    const { w, a } = hilfsgruppe();
    w.stoerung.wirft = {
      [`GET /groups/${GRUPPE}/members/routines`]: new ApiError(404, 'weg'),
    };
    const v = await startVorbereiten(a, EINR, SCHRITTE);
    expect(v).toMatchObject({ art: 'ohneAutomatik' });
    expect((v as { text: string }).text).toContain('Hilfsgruppe gibt es in ChurchTools nicht mehr');
    expect(w.log).toEqual([]);
  });

  it('die Routine verschwindet zwischen Lesen und Ersetzen (404 beim PATCH): ebenfalls ohne Automatik', async () => {
    const { w, a } = hilfsgruppe();
    w.stoerung.wirft = { 'PATCH /routines/60': new ApiError(404, 'weg') };
    expect(await startVorbereiten(a, EINR, SCHRITTE)).toMatchObject({ art: 'ohneAutomatik' });
  });
});

describe('eintragen – (d) Teilnehmer, nachgelesen', () => {
  it('trägt alle als Teilnehmer ein (aktiv) und liest nach', async () => {
    const { w, a } = hilfsgruppe();
    const r = await eintragen(a, EINR, R_TEILNEHMER, [ANNA, BEN]);
    expect(r).toMatchObject({ eingetragen: [ANNA, BEN], fehlen: [], unklar: false });
    expect(w.log).toEqual(['PUT /groups/50/members/5', 'PUT /groups/50/members/8']);
    expect(a.mitgliedAnlegen).toHaveBeenCalledWith(GRUPPE, 5, {
      groupTypeRoleId: R_TEILNEHMER,
      groupMemberStatus: 'active',
    });
    expect(w.mitglieder.every((m) => m.rolle === R_TEILNEHMER)).toBe(true);
  });

  it('Teilfehler: die anderen werden trotzdem eingetragen, die Fehlenden stehen NACHGELESEN in „fehlen“', async () => {
    const { w, a } = hilfsgruppe();
    w.stoerung.wirft = { 'PUT /groups/50/members/8': new ApiError(503, 'ct') };
    const r = await eintragen(a, EINR, R_TEILNEHMER, [ANNA, BEN, CARLA]);
    expect(r.eingetragen).toEqual([ANNA, CARLA]);
    expect(r.fehlen).toEqual([BEN]);
    expect(eintragenText(r, 3)).toContain('Eingetragen sind 2 von 3; es fehlen: Ben');
  });

  it('ein Erfolg ohne Beleg zählt nicht: meldet ChurchTools „ok“, trägt aber nicht ein, steht die Person in „fehlen“', async () => {
    const { w, a } = hilfsgruppe();
    w.stoerung.tragNichtEin = new Set([8]);
    const r = await eintragen(a, EINR, R_TEILNEHMER, [ANNA, BEN]);
    expect(r.fehlen).toEqual([BEN]);
  });

  it('ein Planer, der noch Leiter ist (frühere Probe-Einrichtung): nicht umgestellt, mit Namen gemeldet', async () => {
    const { w, a } = hilfsgruppe({ mitglieder: [{ person: 5, rolle: R_LEITER }] });
    const r = await eintragen(a, EINR, R_TEILNEHMER, [ANNA, BEN]);
    expect(r.fehlen).toEqual([ANNA]);
    expect(r.alsLeiter).toEqual([ANNA]);
    expect(eintragenText(r, 2)).toContain('Anna steht als Leiter in der Gruppe');
    expect(w.mitglieder.find((m) => m.person === 5)?.rolle).toBe(R_LEITER);
  });

  it('die Mitgliederliste lässt sich nicht nachlesen: „unklar“ – niemand wird als eingetragen behauptet', async () => {
    const { w, a } = hilfsgruppe();
    // Das Eintragen selbst geht, erst das Nachlesen scheitert.
    a.port.liste = () => Promise.reject(new TypeError('Failed to fetch'));
    const r = await eintragen(a, EINR, R_TEILNEHMER, [ANNA]);
    expect(r).toMatchObject({ unklar: true, eingetragen: [], fehlen: [ANNA] });
    expect(w.mitglieder).toHaveLength(1);
    expect(eintragenText(r, 1)).toContain('ließ sich nicht nachlesen');
  });
});

describe('fehlendeNachtragen – nur die, die beim Start fehlten', () => {
  it('trägt genau diese ein; wer sich selbst ausgetragen hat, kommt NICHT wieder hinein', async () => {
    // Anna und Carla stehen drin; Ben fehlte beim Start. Wer sich zwischendurch ausgetragen hat, steht nicht in der Liste.
    const { w, a } = hilfsgruppe({ mitglieder: [tn(5), tn(11)] });
    const r = await fehlendeNachtragen(a, EINR, [BEN]);
    expect('art' in r).toBe(false);
    expect(w.log).toEqual(['PUT /groups/50/members/8']);
    expect(w.mitglieder.map((m) => m.person).sort((x, y) => x - y)).toEqual([5, 8, 11]);
  });

  it('Routine nicht lesbar → Fehlertext, niemand eingetragen', async () => {
    const { w, a } = hilfsgruppe();
    w.stoerung.wirft = { [`GET /groups/${GRUPPE}/members/routines`]: new ApiError(503, 'ct') };
    expect(await fehlendeNachtragen(a, EINR, [BEN])).toMatchObject({ art: 'fehler' });
    expect(w.log).toEqual([]);
  });
});

describe('gruppeLeeren (auch für „Abfrage beenden“)', () => {
  it('trägt alle Teilnehmer aus und liest nach – Leiter bleiben', async () => {
    const { w, a } = hilfsgruppe({ mitglieder: [tn(5), tn(8), { person: 1, rolle: R_LEITER }] });
    expect(await gruppeLeeren(a, EINR)).toEqual({ art: 'leer', ausgetragen: 2 });
    expect(w.mitglieder).toEqual([{ person: 1, rolle: R_LEITER }]);
    expect(w.log).toEqual(['DELETE /groups/50/members/5', 'DELETE /groups/50/members/8']);
  });

  it('steht nachgelesen noch jemand da, ist es kein Erfolg – mit Namen', async () => {
    const { w, a } = hilfsgruppe({ mitglieder: [tn(5), tn(8)] });
    w.stoerung.tragNichtAus = new Set([8]);
    const r = await gruppeLeeren(a, EINR);
    expect(r).toMatchObject({ art: 'rest' });
    expect((r as { text: string }).text).toContain('Person 8');
  });

  it('Hilfsgruppe oder Routine gelöscht: nichts auszutragen – das Beenden hängt nicht daran', async () => {
    const ohneRoutine = hilfsgruppe({ routineVorhanden: false, mitglieder: [tn(5)] });
    expect(await gruppeLeeren(ohneRoutine.a, EINR)).toEqual({ art: 'leer', ausgetragen: 0 });
    expect(ohneRoutine.w.log).toEqual([]);
    const ohneGruppe = hilfsgruppe();
    ohneGruppe.w.stoerung.wirft = {
      [`GET /groups/${GRUPPE}/members/routines`]: new ApiError(404, 'weg'),
    };
    expect(await gruppeLeeren(ohneGruppe.a, EINR)).toEqual({ art: 'leer', ausgetragen: 0 });
  });

  it('ein Aussetzer (nicht 404) hält das Beenden dagegen auf', async () => {
    const { w, a } = hilfsgruppe({ mitglieder: [tn(5)] });
    w.stoerung.wirft = {
      [`GET /groups/${GRUPPE}/members/routines`]: new ApiError(503, 'ct'),
    };
    expect(await gruppeLeeren(a, EINR)).toMatchObject({ art: 'fehler' });
  });

  it('nicht lesbar: nichts ausgetragen', async () => {
    const { w, a } = hilfsgruppe({ mitglieder: [tn(5)] });
    w.stoerung.wirft = { [`GET /groups/${GRUPPE}/members`]: new ApiError(503, 'ct') };
    expect(await gruppeLeeren(a, EINR)).toMatchObject({ art: 'fehler' });
    expect(w.log).toEqual([]);
  });
});

describe('abgleichen – nur austragen, nie eintragen', () => {
  it('trägt aus, wer nicht mehr offen ist; lässt die Offenen stehen; trägt niemanden ein', async () => {
    const { w, a } = hilfsgruppe({ mitglieder: [tn(5), tn(8), tn(11)] });
    // Offen sind laut Rechnung Anna (5) und Dora (99, nicht in der Gruppe – Nachzügler!).
    const r = await abgleichen(a, EINR, new Set([5, 99]));
    expect(r).toEqual({ art: 'ok', ausgetragen: 2, drin: 1 });
    expect(w.mitglieder.map((m) => m.person)).toEqual([5]);
    expect(w.log).toEqual(['DELETE /groups/50/members/8', 'DELETE /groups/50/members/11']);
    expect(a.mitgliedAnlegen).not.toHaveBeenCalled();
  });

  it('sind alle noch offen, passiert nichts', async () => {
    const { w, a } = hilfsgruppe({ mitglieder: [tn(5), tn(8)] });
    expect(await abgleichen(a, EINR, new Set([5, 8]))).toEqual({
      art: 'ok',
      ausgetragen: 0,
      drin: 2,
    });
    expect(w.log).toEqual([]);
  });

  it('Lesefehler: nichts wird ausgetragen', async () => {
    const { w, a } = hilfsgruppe({ mitglieder: [tn(5), tn(8)] });
    w.stoerung.wirft = { [`GET /groups/${GRUPPE}/members`]: new ApiError(503, 'ct') };
    expect(await abgleichen(a, EINR, new Set())).toEqual({ art: 'fehler' });
    expect(w.log).toEqual([]);
  });

  it('Leiter aus früheren Probe-Einrichtungen werden nicht ausgetragen', async () => {
    const { w, a } = hilfsgruppe({ mitglieder: [tn(5), { person: 1, rolle: R_LEITER }] });
    await abgleichen(a, EINR, new Set());
    expect(w.mitglieder).toEqual([{ person: 1, rolle: R_LEITER }]);
  });
});

describe('austretenWennFertig – Austritt beim Antworten', () => {
  it('Mitglied (Teilnehmer): trägt sich selbst aus und liest nach', async () => {
    const { w, a } = hilfsgruppe({ mitglieder: [tn(5), tn(8)] });
    expect(await austretenWennFertig(a, EINR, 5)).toBe('ausgetragen');
    expect(w.log).toEqual(['DELETE /groups/50/members/5']);
    expect(w.mitglieder.map((m) => m.person)).toEqual([8]);
  });

  it('kein Mitglied: nichts geschrieben', async () => {
    const { w, a } = hilfsgruppe({ mitglieder: [tn(8)] });
    expect(await austretenWennFertig(a, EINR, 5)).toBe('nichts');
    expect(w.log).toEqual([]);
  });

  it('Rollen nicht lesbar (ungemessen für Mitarbeitende): der Austritt geschieht trotzdem', async () => {
    const { w, a } = hilfsgruppe({ mitglieder: [tn(5)] });
    w.stoerung.wirft = { 'GET /group/roles': new ApiError(403, 'verboten') };
    expect(await austretenWennFertig(a, EINR, 5)).toBe('ausgetragen');
    expect(w.log).toEqual(['DELETE /groups/50/members/5']);
  });

  it('Leiter (frühere Probe-Einrichtung) trägt sich nicht aus', async () => {
    const { w, a } = hilfsgruppe({ mitglieder: [{ person: 5, rolle: R_LEITER }] });
    expect(await austretenWennFertig(a, EINR, 5)).toBe('nichts');
    expect(w.log).toEqual([]);
  });

  it('Fehler leise: ein Aussetzer wirft nicht und lässt alles stehen; trägt ChurchTools nicht aus, ist es „fehler“', async () => {
    const aus = hilfsgruppe({ mitglieder: [tn(5)] });
    aus.w.stoerung.wirft = { 'DELETE /groups/50/members/5': new ApiError(503, 'ct') };
    expect(await austretenWennFertig(aus.a, EINR, 5)).toBe('fehler');
    expect(aus.w.mitglieder).toHaveLength(1);
    const lese = hilfsgruppe({ mitglieder: [tn(5)] });
    lese.w.stoerung.wirft = { 'GET /groups/50/members/5': new TypeError('Failed to fetch') };
    expect(await austretenWennFertig(lese.a, EINR, 5)).toBe('fehler');
    expect(lese.w.log).toEqual([]);
    const still = hilfsgruppe({ mitglieder: [tn(5)] });
    still.w.stoerung.tragNichtAus = new Set([5]);
    expect(await austretenWennFertig(still.a, EINR, 5)).toBe('fehler');
  });
});
