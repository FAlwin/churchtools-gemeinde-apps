import { describe, expect, it, vi } from 'vitest';
import { ApiError } from '@ui/ct/fehler';
import { ChurchToolsBremst, KeinSpeicherRecht } from '@ui/ct/verbindung';
import type { Empfaenger } from '@shared/dienstplan/erinnern';
import {
  erinnernSenden,
  listenAus,
  type MailAuftrag,
  type MailErgebnis,
  type MailSender,
} from './erinnernSenden';

/**
 * E5c-5 „Erinnern“: der Versand. Jeder Zweig einzeln – hier kann eine Mail doppelt oder gar nicht rausgehen. Nichts geht
 * an ChurchTools: `senden` ist ein Spion, die Fehler sind die echten Klassen der Verbindung (`ApiError`, `KeinSpeicherRecht`,
 * `ChurchToolsBremst`), so wie `ctAnfrage` sie wirft.
 */
const e = (personId: number, name: string, ...terminIds: number[]): Empfaenger => ({
  personId,
  name,
  gruppen: ['Musik'],
  termine: terminIds.map((terminId) => ({
    terminId,
    tag: '2026-12-06',
    name: 'Gottesdienst',
    uhrzeit: '10:00',
  })),
});
const ANNA = e(5, 'Anna Gans', 1, 3);
const BEN = e(8, 'Ben Kunz', 2);
const CLARA = e(11, 'Clara Neu', 1, 2, 3);
const DREI = [ANNA, BEN, CLARA];
const inhalt = (x: Empfaenger) => ({ subject: 'Betreff', body: `Hallo ${x.name}` });
const ok = (...ids: number[]) => ({ data: { sentRecipientIds: ids, rejectedRecipientIds: [] } });

/** Ein Sender, der je Aufruf die nächste Antwort liefert (Wert = Rumpf, Fehler = wirft). */
function sender(...antworten: unknown[]) {
  const aufrufe: MailAuftrag[] = [];
  const senden: MailSender = (a) => {
    aufrufe.push(a);
    const r = antworten[aufrufe.length - 1];
    return r instanceof Error ? Promise.reject(r) : Promise.resolve(r);
  };
  return { senden, aufrufe };
}
const art = (l: { ergebnisse: Map<number, MailErgebnis> }, id: number) => l.ergebnisse.get(id)?.art;

describe('Erfolg und Auftrag', () => {
  it('je Person EIN Aufruf, nacheinander, mit ihren Terminen, nur ihr als Empfänger, Betreff und Text der Funktion', async () => {
    const s = sender(ok(5), ok(8), ok(11));
    const melde = vi.fn();
    const lauf = await erinnernSenden({
      empfaenger: DREI,
      inhalt,
      kopie: false,
      senden: s.senden,
      melde,
    });
    expect(s.aufrufe).toEqual([
      {
        eventIds: [1, 3],
        recipients: [5],
        subject: 'Betreff',
        body: 'Hallo Anna Gans',
        sendCopyToMe: false,
        appendAgendaButton: false,
        files: [],
      },
      {
        eventIds: [2],
        recipients: [8],
        subject: 'Betreff',
        body: 'Hallo Ben Kunz',
        sendCopyToMe: false,
        appendAgendaButton: false,
        files: [],
      },
      {
        eventIds: [1, 2, 3],
        recipients: [11],
        subject: 'Betreff',
        body: 'Hallo Clara Neu',
        sendCopyToMe: false,
        appendAgendaButton: false,
        files: [],
      },
    ]);
    expect([5, 8, 11].map((id) => art(lauf, id))).toEqual([
      'verschickt',
      'verschickt',
      'verschickt',
    ]);
    expect(lauf.angehalten).toBeNull();
    expect(melde.mock.calls.map((c) => c[0])).toEqual([5, 8, 11]);
  });

  it('Erfolg erst, wenn die Person in sentRecipientIds steht – auch wenn der Rumpf ohne „data“ kommt', async () => {
    const s = sender({ sentRecipientIds: [5], rejectedRecipientIds: [] });
    const lauf = await erinnernSenden({
      empfaenger: [ANNA],
      inhalt,
      kopie: false,
      senden: s.senden,
    });
    expect(art(lauf, 5)).toBe('verschickt');
    expect(listenAus(ok(1, 2)).gesendet).toEqual(new Set([1, 2]));
    expect(listenAus({ sentRecipientIds: ['7'] }).gesendet).toEqual(new Set([7])); // Zahl als Text
    expect(listenAus(null).gesendet.size).toBe(0);
  });

  it('eine Person, die ChurchTools nicht nennt, ist NICHT verschickt: 200 ohne Bestätigung = unklar, angehalten', async () => {
    const s = sender({ data: { sentRecipientIds: [99], rejectedRecipientIds: [] } });
    const lauf = await erinnernSenden({ empfaenger: DREI, inhalt, kopie: false, senden: s.senden });
    expect(art(lauf, 5)).toBe('unklar');
    expect(lauf.angehalten?.grund).toBe('unklar');
    expect(lauf.angehalten?.bei).toBe(5);
    expect(s.aufrufe).toHaveLength(1);
    expect(lauf.ergebnisse.has(8)).toBe(false);
  });
});

describe('Ohne Mail-Adresse: weiter mit der nächsten', () => {
  it('rejectedRecipientIds (200) = nicht erinnert, kein Anhalten', async () => {
    const s = sender({ data: { sentRecipientIds: [], rejectedRecipientIds: [5] } }, ok(8), ok(11));
    const lauf = await erinnernSenden({ empfaenger: DREI, inhalt, kopie: false, senden: s.senden });
    expect([5, 8, 11].map((id) => art(lauf, id))).toEqual(['ohneMail', 'verschickt', 'verschickt']);
    expect(lauf.angehalten).toBeNull();
    expect(s.aufrufe).toHaveLength(3);
  });

  it('422 (niemand mit Mail-Adresse) = diese Person nicht erinnert, weiter', async () => {
    const s = sender(new ApiError(422, 'Keine Empfänger'), ok(8), ok(11));
    const lauf = await erinnernSenden({ empfaenger: DREI, inhalt, kopie: false, senden: s.senden });
    expect([5, 8, 11].map((id) => art(lauf, id))).toEqual(['ohneMail', 'verschickt', 'verschickt']);
    expect(lauf.angehalten).toBeNull();
  });
});

describe('Anhalten – die Zweige einzeln', () => {
  const lauf = (fehler: unknown) => {
    const s = sender(ok(5), fehler, ok(11));
    return erinnernSenden({ empfaenger: DREI, inhalt, kopie: false, senden: s.senden }).then(
      (l) => ({ l, s }),
    );
  };

  it('Netzfehler (kein ApiError): Ben ist unklar, Clara wird NICHT versucht, Anna bleibt verschickt, nichts wiederholt', async () => {
    const { l, s } = await lauf(new TypeError('Failed to fetch'));
    expect([5, 8].map((id) => art(l, id))).toEqual(['verschickt', 'unklar']);
    expect(l.ergebnisse.has(11)).toBe(false);
    expect(s.aufrufe).toHaveLength(2);
    expect(l.angehalten?.grund).toBe('unklar');
    expect(l.angehalten?.bei).toBe(8);
    expect(l.angehalten?.text).toContain('Bei Ben Kunz ist unklar, ob die Mail rausging');
  });

  it.each([
    [
      'Zeitüberschreitung 504',
      new ApiError(504, 'ChurchTools antwortet nicht (Zeitüberschreitung).'),
    ],
    ['gebremst (ChurchToolsBremst, 503)', new ChurchToolsBremst(5000)],
    ['429', new ApiError(429, 'zu viele')],
    ['500', new ApiError(500, 'Fehler')],
    ['502', new ApiError(502, 'Bad Gateway')],
    ['408', new ApiError(408, 'Timeout')],
  ])('%s: unklar, angehalten, nichts wiederholt', async (_n, fehler) => {
    const { l, s } = await lauf(fehler);
    expect(art(l, 8)).toBe('unklar');
    expect(l.angehalten?.grund).toBe('unklar');
    expect(s.aufrufe).toHaveLength(2);
  });

  it('401: abgemeldet – angehalten, die Person ist abgelehnt (sicher nicht verschickt), Text wie überall', async () => {
    const { l } = await lauf(new ApiError(401, 'Bei ChurchTools nicht mehr angemeldet.'));
    expect(art(l, 8)).toBe('abgelehnt');
    expect(l.angehalten?.grund).toBe('abgemeldet');
    expect(l.angehalten?.text).toContain('nicht mehr angemeldet');
  });

  it('403 und fehlendes Recht (KeinSpeicherRecht): „ChurchTools erlaubt dir nicht …“, dauerhaft, angehalten', async () => {
    for (const f of [new ApiError(403, 'Forbidden'), new KeinSpeicherRecht('egal')]) {
      const { l } = await lauf(f);
      expect(art(l, 8)).toBe('abgelehnt');
      expect(l.angehalten?.grund).toBe('keinRecht');
      expect(l.angehalten?.text).toBe(
        'ChurchTools erlaubt dir nicht, Mails zu Terminen zu schicken.',
      );
    }
  });

  it('anderes 4xx (z. B. 400): abgelehnt (sicher nicht verschickt), angehalten', async () => {
    const { l } = await lauf(new ApiError(400, 'Bad Request'));
    expect(art(l, 8)).toBe('abgelehnt');
    expect(l.angehalten?.grund).toBe('abgelehnt');
    expect(l.angehalten?.text).toContain('Ben Kunz');
  });

  it('das Anhalten gilt ab der ersten Störung – schon bei der ersten Person bleibt der Rest unversucht', async () => {
    const s = sender(new ApiError(504, 'x'));
    const l = await erinnernSenden({ empfaenger: DREI, inhalt, kopie: false, senden: s.senden });
    expect([...l.ergebnisse.keys()]).toEqual([5]);
    expect(s.aufrufe).toHaveLength(1);
  });
});

describe('Kopie an mich: nur einmal', () => {
  it('sendCopyToMe nur im ersten Aufruf', async () => {
    const s = sender(ok(5), ok(8), ok(11));
    const l = await erinnernSenden({ empfaenger: DREI, inhalt, kopie: true, senden: s.senden });
    expect(s.aufrufe.map((a) => a.sendCopyToMe)).toEqual([true, false, false]);
    expect(l.kopieAngefordert).toBe(true);
  });

  it('ein Aufruf, der nichts verschickt (422, abgelehnt-Liste), verbraucht die Kopie nicht', async () => {
    const s = sender(
      new ApiError(422, 'x'),
      { data: { sentRecipientIds: [], rejectedRecipientIds: [8] } },
      ok(11),
    );
    const l = await erinnernSenden({ empfaenger: DREI, inhalt, kopie: true, senden: s.senden });
    expect(s.aufrufe.map((a) => a.sendCopyToMe)).toEqual([true, true, true]);
    expect(l.kopieAngefordert).toBe(true);
  });

  it('ein unklarer Aufruf verbraucht sie (die Kopie könnte schon raus sein): „An die übrigen“ fordert keine zweite', async () => {
    const s1 = sender(new ApiError(504, 'x'));
    const l1 = await erinnernSenden({
      empfaenger: [ANNA, BEN],
      inhalt,
      kopie: true,
      senden: s1.senden,
    });
    expect(s1.aufrufe[0].sendCopyToMe).toBe(true);
    expect(l1.kopieAngefordert).toBe(true);
    // Zweiter Lauf: das Fenster reicht `kopie: false`, weil `kopieAngefordert` schon gilt.
    const s2 = sender(ok(8));
    await erinnernSenden({
      empfaenger: [BEN],
      inhalt,
      kopie: !l1.kopieAngefordert,
      senden: s2.senden,
    });
    expect(s2.aufrufe[0].sendCopyToMe).toBe(false);
  });

  it('ohne Wunsch nie', async () => {
    const s = sender(ok(5), ok(8));
    const l = await erinnernSenden({
      empfaenger: [ANNA, BEN],
      inhalt,
      kopie: false,
      senden: s.senden,
    });
    expect(s.aufrufe.every((a) => !a.sendCopyToMe)).toBe(true);
    expect(l.kopieAngefordert).toBe(true); // „nichts mehr anzufordern“
  });
});

describe('Nichts doppelt: „An die übrigen“ schickt nur die übrigen', () => {
  it('ein zweiter Lauf mit den übrigen berührt die schon verschickten nicht', async () => {
    const s1 = sender(ok(5), new ApiError(503, 'x'));
    const l1 = await erinnernSenden({ empfaenger: DREI, inhalt, kopie: false, senden: s1.senden });
    // Übrig: wer kein Ergebnis hat (Clara); Ben ist unklar und wird vom Fenster nicht vorgewählt.
    const uebrig = DREI.filter((x) => !l1.ergebnisse.has(x.personId));
    expect(uebrig.map((x) => x.name)).toEqual(['Clara Neu']);
    const s2 = sender(ok(11));
    const l2 = await erinnernSenden({
      empfaenger: uebrig,
      inhalt,
      kopie: false,
      senden: s2.senden,
    });
    expect(s2.aufrufe.map((a) => a.recipients)).toEqual([[11]]);
    expect(l2.angehalten).toBeNull();
  });
});
