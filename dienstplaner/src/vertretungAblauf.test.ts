import { describe, expect, it } from 'vitest';
import { absagenNachZusage } from '@shared/dienstplan/antworten';
import { nachbau } from '@shared/dienstplan/einteilen.testutil';
import type { RohPlatz } from '@shared/dienstplan/termine';
import type { Vertretung } from '@shared/dienstplan/verfuegbarkeit';
import type { Vorschlag } from '@shared/dienstplan/vertretung';
import { ApiError } from '@ui/ct/fehler';
import type { MailAuftrag } from './erinnernSenden';
import {
  mailsErneut,
  mailsFertig,
  mailZiele,
  offeneMails,
  unklareMails,
  vertretungSuchen,
  type Ablaufschritte,
  type VertretungsAuftrag,
} from './vertretungAblauf';

const ANNA = 46;
const BEN = 47;
const FINN = 48;
const LEITUNG = 1;
const TERMIN = 246;

const person = (id: number, name: string) => ({ id, name, bild: null, initialen: '' });
const vorschlag = (personId: number, name: string, a: Vorschlag['a'] = 'ja'): Vorschlag => ({
  personId,
  name,
  a,
  notiz: null,
});
const auftrag = (extra: Partial<VertretungsAuftrag> = {}): VertretungsAuftrag => ({
  termin: { id: TERMIN, name: 'Gottesdienst', tag: '2026-12-13', uhrzeit: '10:00' },
  dienst: { id: 9, name: 'Gesang', index: 1 },
  ich: { id: ANNA, name: 'Anna Test' },
  gefragt: [vorschlag(BEN, 'Ben Test'), vorschlag(FINN, 'Finn Test', 'vielleicht')],
  leitung: [person(LEITUNG, 'Alwin Friesen')],
  nachricht: 'Bin krank',
  ...extra,
});

const annasPlatz = (extra: Partial<RohPlatz> = {}): RohPlatz => ({
  id: 700,
  serviceId: 9,
  index: 1,
  personId: ANNA,
  name: 'Anna Test',
  isAccepted: true,
  ...extra,
});

/**
 * Die Schritte mit einem nachgebauten ChurchTools für die Absage (der echte Kern `absagenNachZusage`) und einem Protokoll, in
 * dem man die REIHENFOLGE sieht. `mailAntwort` bestimmt, was `/events/send` je Aufruf tut.
 */
function schritte(
  o: {
    markieren?: () => Promise<{ ok: true } | { ok: false; text: string }>;
    schreibenFehler?: number | null;
    mailAntwort?: (a: MailAuftrag, nr: number) => unknown;
    platz?: RohPlatz;
  } = {},
) {
  const log: string[] = [];
  const { ct, port } = nachbau([o.platz ?? annasPlatz()]);
  ct.schreibenFehler = o.schreibenFehler;
  const mails: MailAuftrag[] = [];
  const marker: Vertretung[] = [];
  const s: Ablaufschritte = {
    markieren: (v: Vertretung) => {
      log.push('markieren');
      marker.push(v);
      return (o.markieren ?? (() => Promise.resolve({ ok: true as const })))();
    },
    absagen: (kommentar) => {
      log.push('absagen');
      return absagenNachZusage(port, { eventId: TERMIN, serviceId: 9, index: 1 }, ANNA, kommentar);
    },
    senden: (a) => {
      log.push(`mail:${a.recipients.join(',')}`);
      mails.push(a);
      const nr = mails.length;
      return Promise.resolve(
        (
          o.mailAntwort ??
          ((m: MailAuftrag) => ({
            data: { sentRecipientIds: m.recipients, rejectedRecipientIds: [] },
          }))
        )(a, nr),
      );
    },
    link: () => 'https://ct.test/ccm/dienstplaner/#/',
    jetzt: () => '2026-11-21T10:00:00.000Z',
  };
  return { s, log, ct, mails, marker };
}

describe('vertretungSuchen – der Ablauf von „Absagen und fragen“', () => {
  it('Reihenfolge: Markierung → Absage → Mails (erst die Gefragten, dann die Leitung); jeder Schritt wartet auf den vorigen', async () => {
    const { s, log, ct } = schritte();
    const r = await vertretungSuchen(auftrag(), s);
    expect(log).toEqual(['markieren', 'absagen', `mail:${BEN}`, `mail:${FINN}`, `mail:${LEITUNG}`]);
    expect(r.art).toBe('abgesagt');
    // Die Absage ist wirklich geschehen: Annas Platz ist frei und trägt den Kommentar mit den Namen.
    expect(ct.plaetze[0]).toMatchObject({
      personId: null,
      comment: 'Vertretung gesucht – gefragt: Ben Test, Finn Test',
    });
  });

  it('Markierung trägt Namen, Gefragte, Dienst, Tag und Zeitpunkt', async () => {
    const { s, marker } = schritte();
    await vertretungSuchen(auftrag(), s);
    expect(marker).toEqual([
      {
        dienst: 9,
        gefragt: [BEN, FINN],
        seit: '2026-11-21T10:00:00.000Z',
        tag: '2026-12-13',
        index: 1,
        name: 'Anna Test',
        gefragtNamen: ['Ben Test', 'Finn Test'],
      },
    ]);
  });

  it('scheitert die Markierung: NICHTS wird abgesagt, NICHTS verschickt – der Grund steht im Ergebnis', async () => {
    const { s, log, ct, mails } = schritte({
      markieren: () => Promise.resolve({ ok: false, text: 'Speicher nicht eingerichtet.' }),
    });
    const r = await vertretungSuchen(auftrag(), s);
    expect(r).toEqual({ art: 'nichtAbgesagt', text: 'Speicher nicht eingerichtet.' });
    expect(log).toEqual(['markieren']);
    expect(ct.geschrieben).toEqual([]);
    expect(mails).toEqual([]);
  });

  it('scheitert die Absage: keine Mail – und der Text sagt, was gewiss ist und was nicht', async () => {
    const konflikt = schritte({ platz: annasPlatz({ personId: 99, name: 'Jemand anderes' }) });
    const k = await vertretungSuchen(auftrag(), konflikt.s);
    expect(k).toMatchObject({ art: 'nichtAbgesagt' });
    expect(k.art === 'nichtAbgesagt' && k.text).toMatch(/inzwischen geändert/);
    expect(konflikt.mails).toEqual([]);

    const kein = schritte({ schreibenFehler: 403 });
    const r403 = await vertretungSuchen(auftrag(), kein.s);
    expect(r403.art === 'nichtAbgesagt' && r403.text).toMatch(/niemand gefragt/);
    expect(kein.mails).toEqual([]);

    // Vorübergehend: NICHT behaupten, es sei nichts abgesagt – es ist nicht bestätigt.
    const weg = schritte({ schreibenFehler: 503 });
    const r503 = await vertretungSuchen(auftrag(), weg.s);
    expect(r503.art === 'nichtAbgesagt' && r503.text).toMatch(/nicht bestätigt/);
    expect(r503.art === 'nichtAbgesagt' && r503.text).not.toMatch(/nichts abgesagt/);
    expect(weg.mails).toEqual([]);
  });

  it('jede Mail ist eine eigene, zum Termin, mit Pflichtfeldern, Betreff, Knopf – an Gefragte und, mit „Kopie:“, an die Leitung', async () => {
    const { s, mails } = schritte();
    await vertretungSuchen(auftrag(), s);
    expect(mails.map((m) => m.recipients)).toEqual([[BEN], [FINN], [LEITUNG]]);
    for (const m of mails) {
      expect(m.eventIds).toEqual([TERMIN]);
      expect(m.appendAgendaButton).toBe(false);
      expect(m.files).toEqual([]);
      expect(m.sendCopyToMe).toBe(false);
      expect(m.body).toContain('href="https://ct.test/ccm/dienstplaner/#/"');
    }
    expect(mails[0].subject).toBe('Vertretung gesucht: Gesang am So, 13.12.');
    expect(mails[0].body).toContain('Du hast für den Tag „Ja“ gesagt.');
    expect(mails[0].body).toContain('Gefragt wurden auch: Finn Test.');
    expect(mails[1].body).toContain('Du hast für den Tag „Vielleicht“ gesagt.');
    expect(mails[2].subject).toBe('Kopie: Vertretung gesucht: Gesang am So, 13.12.');
    expect(mails[2].body).toContain('Das ist eine Kopie für dich.');
  });

  it('niemand angehakt: nur absagen – keine Mail, auch keine Kopie an die Leitung; das Schild trotzdem (Markierung ohne Namen)', async () => {
    const { s, log, marker, ct } = schritte();
    const r = await vertretungSuchen(auftrag({ gefragt: [] }), s);
    expect(log).toEqual(['markieren', 'absagen']);
    expect(r).toMatchObject({ art: 'abgesagt', mails: { ziele: [] } });
    expect(marker[0]).toMatchObject({ gefragt: [], gefragtNamen: [] });
    expect(ct.plaetze[0].comment).toBe('Vertretung gesucht');
  });

  it('Leitung bekommt nur eine Kopie, wenn sie nicht ohnehin gefragt wird – und nie Anna selbst', () => {
    const z = mailZiele(
      auftrag({
        leitung: [person(BEN, 'Ben Test'), person(ANNA, 'Anna Test'), person(LEITUNG, 'Alwin')],
      }),
    );
    expect(z.map((x) => [x.personId, x.rolle])).toEqual([
      [BEN, 'gefragt'],
      [FINN, 'gefragt'],
      [LEITUNG, 'leitung'],
    ]);
  });

  describe('Mails scheitern – abgesagt ist abgesagt, ehrlich gesagt', () => {
    it('vorübergehender Fehler bei der zweiten Mail: hält an, nichts wird wiederholt, die dritte nicht versucht', async () => {
      const { s, log } = schritte({
        mailAntwort: (m, nr) => {
          if (nr === 2) throw new ApiError(503, 'gerade nicht');
          return { data: { sentRecipientIds: m.recipients, rejectedRecipientIds: [] } };
        },
      });
      const r = await vertretungSuchen(auftrag(), s);
      expect(r.art).toBe('abgesagt');
      if (r.art !== 'abgesagt') return;
      expect(log).toEqual(['markieren', 'absagen', `mail:${BEN}`, `mail:${FINN}`]);
      expect(r.mails.ergebnisse.get(BEN)?.art).toBe('verschickt');
      expect(r.mails.ergebnisse.get(FINN)?.art).toBe('unklar');
      expect(r.mails.ergebnisse.has(LEITUNG)).toBe(false);
      expect(r.mails.angehalten).toMatch(/Finn Test/);
      expect(unklareMails(r.mails).map((z) => z.personId)).toEqual([FINN]);
      expect(offeneMails(r.mails).map((z) => z.personId)).toEqual([FINN, LEITUNG]);
      expect(mailsFertig(r.mails)).toBe(false);
    });

    it('„Erneut senden“ schickt NUR an die, die noch keine Mail haben – nie noch einmal an die schon Versorgten', async () => {
      let gescheitert = true;
      const { s, mails } = schritte({
        mailAntwort: (m, nr) => {
          if (gescheitert && nr === 2) throw new ApiError(503, 'gerade nicht');
          return { data: { sentRecipientIds: m.recipients, rejectedRecipientIds: [] } };
        },
      });
      const r = await vertretungSuchen(auftrag(), s);
      if (r.art !== 'abgesagt') throw new Error('abgesagt erwartet');
      gescheitert = false;
      const davor = mails.length;
      const neu = await mailsErneut(auftrag(), r.mails, s);
      expect(mails.slice(davor).map((m) => m.recipients)).toEqual([[FINN], [LEITUNG]]);
      expect(mailsFertig(neu)).toBe(true);
      expect(neu.angehalten).toBeNull();
      // Ben steht weiter als verschickt da und bekam keine zweite.
      expect(mails.filter((m) => m.recipients[0] === BEN)).toHaveLength(1);
    });

    it('ohne Mail-Adresse (422 oder „abgelehnt“): kein Anhalten, nicht erneut versucht, aber gemeldet', async () => {
      const { s, mails } = schritte({
        mailAntwort: (m) =>
          m.recipients[0] === BEN
            ? { data: { sentRecipientIds: [], rejectedRecipientIds: [BEN] } }
            : { data: { sentRecipientIds: m.recipients, rejectedRecipientIds: [] } },
      });
      const r = await vertretungSuchen(auftrag(), s);
      if (r.art !== 'abgesagt') throw new Error('abgesagt erwartet');
      expect(r.mails.ergebnisse.get(BEN)?.art).toBe('ohneMail');
      expect(mails).toHaveLength(3); // es ging weiter
      expect(mailsFertig(r.mails)).toBe(true); // Wiederholen ändert an der fehlenden Adresse nichts
      expect(offeneMails(r.mails)).toEqual([]);
    });

    it('ChurchTools lässt den Absender nicht mailen (403): angehalten mit dem Grund, keine weitere Mail', async () => {
      const { s, log } = schritte({
        mailAntwort: () => {
          throw new ApiError(403, 'nein');
        },
      });
      const r = await vertretungSuchen(auftrag(), s);
      if (r.art !== 'abgesagt') throw new Error('abgesagt erwartet');
      expect(log).toEqual(['markieren', 'absagen', `mail:${BEN}`]);
      expect(r.mails.angehalten).toMatch(/nicht, Mails zu Terminen zu schicken/);
    });

    it('ein 200 ohne Bestätigung für die Person zählt nicht als verschickt', async () => {
      const { s } = schritte({ mailAntwort: () => ({ data: {} }) });
      const r = await vertretungSuchen(auftrag(), s);
      if (r.art !== 'abgesagt') throw new Error('abgesagt erwartet');
      expect(r.mails.ergebnisse.get(BEN)?.art).toBe('unklar');
    });
  });

  it('Netzfehler beim Absagen mit trotzdem angekommener Absage: nachgelesen, also weiter mit den Mails (nie doppelt absagen)', async () => {
    const { s, ct, log } = schritte({ schreibenFehler: null });
    ct.trotzdemSchreiben = true;
    const r = await vertretungSuchen(auftrag(), s);
    expect(r.art).toBe('abgesagt');
    expect(ct.geschrieben).toHaveLength(1);
    expect(log.filter((x) => x === 'absagen')).toHaveLength(1);
  });
});
