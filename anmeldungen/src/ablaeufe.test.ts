import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as V from '@ui/ct/verbindung';
import { ApiError, NichtUebernommen } from '@ui/ct/fehler';
import * as E from './einrichten';
import * as R from './rundmail';
import { SYSTEMFELDER } from '@shared/anmeldung/formular';
import { OHNE_EIGENEN_TEXT } from '@shared/anmeldung/ablaeufe';
import { neueEinstellungen } from '@shared/anmeldung/vorlagen';
import {
  LoeschdatumVorbei,
  ablaeufeAbgleichen,
  ablaeufeEinrichten,
  ablaeufeLesen,
  absenderAus,
  vorschauPerson,
} from './ablaeufe';

/**
 * Abläufe schreiben (A9-1) gegen nachgestellte Routinen – so, wie am 24.10.2026 gemessen: `POST /routines` hängt die
 * Routine über `domainContext` an die Gruppe, `PATCH` nimmt die ganze Schrittliste, Schritte ohne Nummer werden neu
 * angelegt. Danach wird nachgelesen; `schlucken` lässt ChurchTools „200“ sagen und nichts speichern.
 */
vi.mock('@ui/ct/verbindung', () => ({
  ctAnfrage: vi.fn(),
  ctDaten: vi.fn(),
  ctAlleSeiten: vi.fn(),
}));
vi.mock('./einrichten', async (original) => ({
  ...(await original<typeof import('./einrichten')>()),
  systemfelderNachziehen: vi.fn(),
  teilnehmerRolle: vi.fn(),
}));
vi.mock('./rundmail', async (original) => ({
  ...(await original<typeof import('./rundmail')>()),
  platzhalterLaden: vi.fn(),
}));
const ct = vi.mocked(V);
const ei = vi.mocked(E);
const ru = vi.mocked(R);

interface Schritt {
  id: number;
  actionKey: string;
  isEnabled: boolean;
  actionData: Record<string, unknown>;
}
interface Routine {
  id: number;
  name: string;
  isEnabled: boolean;
  steps: Schritt[];
  rolle: number;
  status: string;
  /** Gruppe der Routine – fehlt = 165. */
  gruppe?: number;
  description?: string | null;
}

const PLATZHALTER = new Map<string, string>([
  ...SYSTEMFELDER.map((f, i): [string, string] => [f.name, `{{{groupMemberField.f${i}}}}`]),
  ['Wartelistenplatz', '{{{groupMember.waitinglistPosition}}}'],
  ['Check-in-Code (QR-Code)', '{{{groupMember.checkInCodeQr}}}'],
]);

let routinen: Map<number, Routine>;
let naechste: number;
let standardMail: boolean;
/** Check-in der Gruppe und ob ChurchTools dazu eine eigene Code-Mail schickt (Vorgabe: ja). */
let checkin: boolean;
let codeMail: boolean;
/** Gemessen 26.10.2026: Check-in an, während die Code-Mail an ist → Mail an alle schon Angemeldeten. */
let codeMailsAnBestehende: number;
/** ChurchTools sagt 200 zum Check-in, übernimmt ihn aber nicht. */
let checkinSchlucken: boolean;
let schlucken: boolean;
/** ChurchTools übernimmt die Schritte, ignoriert aber die Beschreibung. */
let beschreibungSchlucken: boolean;
let aufrufe: string[];
/** Was jeder PATCH an eine Routine geschickt hat. */
let routinenPatches: Record<string, unknown>[];

/**
 * Läufe einer Routine (A9-3a), wie am 28.10.2026 gemessen: Abgeschlossene erreichen neue Schritte nicht; `restart:
 * ['finished']` läuft von vorn (ausgeschaltete Mail wird übersprungen); Warten bis heute oder früher läuft sofort durch,
 * auch für schon Wartende, sobald das Datum gespeichert ist; einen Schritt mit Wartenden nimmt ChurchTools nur mit
 * `finish` weg (sonst 422).
 */
interface Lauf {
  routine: number;
  person: string;
  status: 'finished' | 'waiting';
  schritt: number | null;
}
const HEUTE = '2026-10-28';
let laeufe: Lauf[];
let mailsAnLaeufe: string[];
let entfernt: string[];
let restartFehler: boolean;
/** ChurchTools übernimmt die Mail, verliert aber Warten und Entfernen. */
let warteSchlucken: boolean;
/** ChurchTools behält beim Warten das alte Datum. */
let datumSchlucken: boolean;
/** Anmeldeschluss der Gruppe (`signUpClosingDate`) – `null`: keiner. */
let anmeldeschluss: string | null;
/** ChurchTools sagt 200 zum Anmeldeschluss, übernimmt ihn aber nicht. */
let schlussSchlucken: boolean;
/**
 * Löschdaten, die in eine Routine geschrieben wurden, während die Anmeldung an diesem Tag noch offen war – dann bekäme eine
 * neue Anmeldung die Bestätigung und wäre sofort entfernt (gemessen 28.10.2026). Muss immer leer bleiben.
 */
let offenBeimLoeschen: string[];

function laufWeiter(r: Routine, l: Lauf, ab: number) {
  for (const s of r.steps.slice(ab)) {
    if (s.actionKey === 'send-member-email') {
      if (s.isEnabled) mailsAnLaeufe.push(l.person);
    } else if (s.actionKey === 'special:wait') {
      if (String(s.actionData.untilDate) > HEUTE) {
        l.status = 'waiting';
        l.schritt = s.id;
        return;
      }
    } else if (s.actionKey === 'remove-member') {
      entfernt.push(l.person);
      laeufe = laeufe.filter((x) => x !== l);
      return;
    }
  }
  l.status = 'finished';
  l.schritt = null;
}

beforeEach(() => {
  routinen = new Map();
  naechste = 12;
  standardMail = true;
  checkin = false;
  codeMail = true;
  codeMailsAnBestehende = 0;
  checkinSchlucken = false;
  schlucken = false;
  beschreibungSchlucken = false;
  aufrufe = [];
  routinenPatches = [];
  laeufe = [];
  mailsAnLaeufe = [];
  entfernt = [];
  restartFehler = false;
  warteSchlucken = false;
  datumSchlucken = false;
  anmeldeschluss = null;
  schlussSchlucken = false;
  offenBeimLoeschen = [];
  ct.ctAlleSeiten.mockImplementation(async (pfad: string) => {
    const m = /^\/routines\/(\d+)\/runs$/.exec(pfad);
    if (!m) throw new Error(`unerwartet: ${pfad}`);
    return laeufe.filter((l) => l.routine === Number(m[1])).map((l) => ({ status: l.status }));
  });
  ei.systemfelderNachziehen.mockResolvedValue(neueEinstellungen('kinder'));
  ei.teilnehmerRolle.mockResolvedValue(32);
  ru.platzhalterLaden.mockResolvedValue(PLATZHALTER);
  ct.ctDaten.mockImplementation(async (pfad: string) => {
    if (pfad === '/groups/165')
      return {
        name: 'Kinderfreizeit',
        settings: {
          sendDefaultSignUpMail: standardMail,
          qrCodeCheckin: checkin,
          qrCodeCheckinAutomaticEmail: codeMail,
          signUpClosingDate: anmeldeschluss,
        },
      };
    const g = /^\/groups\/(\d+)\/members\/routines$/.exec(pfad);
    if (g)
      return [...routinen.values()]
        .filter((r) => (r.gruppe ?? 165) === Number(g[1]))
        .map((r) => ({
          id: r.id,
          groupTypeRoleId: r.rolle,
          groupMemberStatus: r.status,
          routine: structuredClone(r),
        }));
    const m = /^\/routines\/(\d+)$/.exec(pfad);
    if (m) return structuredClone(routinen.get(Number(m[1])));
    throw new Error(`unerwartet: ${pfad}`);
  });
  ct.ctAnfrage.mockImplementation(async (pfad: string, init?: RequestInit) => {
    const methode = init?.method ?? 'GET';
    aufrufe.push(`${methode} ${pfad}`);
    const body = JSON.parse(String(init?.body ?? '{}')) as Record<string, unknown>;
    if (methode === 'POST' && pfad === '/routines') {
      const c = body.domainContext as { groupTypeRoleId: number; groupMemberStatus: string };
      const r: Routine = {
        id: naechste++,
        name: String(body.name),
        isEnabled: !!body.isEnabled,
        steps: [],
        rolle: c.groupTypeRoleId,
        status: c.groupMemberStatus,
        gruppe: (body.domainContext as { groupId: number }).groupId,
        description: null,
      };
      routinen.set(r.id, r);
      return { data: { id: r.id } };
    }
    const m = /^\/routines\/(\d+)$/.exec(pfad);
    if (methode === 'PATCH' && m) {
      // Nur die Routine wird verschluckt – so prüft der Test das Nachlesen der Routine, nicht das der Standard-Mail.
      if (schlucken) return null;
      routinenPatches.push(body);
      const r = routinen.get(Number(m[1]))!;
      // Gemessen 26.10.2026: ohne `description` im PATCH bleibt sie stehen.
      if ('description' in body && !beschreibungSchlucken)
        r.description = body.description as string | null;
      if ('isEnabled' in body) r.isEnabled = !!body.isEnabled;
      if ('restart' in body) {
        if (restartFehler) throw new ApiError(502, 'x');
        for (const l of laeufe.filter((x) => x.routine === r.id && x.status === 'finished'))
          laufWeiter(r, l, 0);
      }
      if (!('steps' in body)) return null;
      let neu = (body.steps as Partial<Schritt>[]).map((s) => ({
        ...(s as Schritt),
        id: s.id ?? 100 + naechste++,
      }));
      for (const w of neu.filter((s) => s.actionKey === 'special:wait')) {
        const tag = String(w.actionData.untilDate);
        // Offen ist die Anmeldung am Löschtag, wenn sie keinen Schluss hat oder er (in UTC) erst an diesem Tag liegt.
        if (anmeldeschluss === null || anmeldeschluss.slice(0, 10) >= tag)
          offenBeimLoeschen.push(tag);
      }
      if (warteSchlucken) neu = neu.filter((s) => s.actionKey === 'send-member-email');
      if (datumSchlucken)
        neu = neu.map((s) => {
          const alt = r.steps.find((x) => x.id === s.id);
          return alt && s.actionKey === 'special:wait' ? { ...s, actionData: alt.actionData } : s;
        });
      const beenden = (body.finish as number[] | undefined) ?? [];
      const wartend = laeufe.filter((l) => l.routine === r.id && l.status === 'waiting');
      for (const l of wartend)
        if (!neu.some((s) => s.id === l.schritt)) {
          if (!beenden.includes(l.schritt!)) throw new ApiError(422, 'orphaned runs');
          l.status = 'finished';
          l.schritt = null;
        }
      r.steps = neu;
      for (const l of laeufe.filter((x) => x.routine === r.id && x.status === 'waiting')) {
        const i = neu.findIndex((s) => s.id === l.schritt);
        if (String(neu[i].actionData.untilDate) <= HEUTE) laufWeiter(r, l, i + 1);
      }
      return null;
    }
    if (methode === 'PATCH' && pfad === '/groups/165') {
      if ('sendDefaultSignUpMail' in body) standardMail = body.sendDefaultSignUpMail as boolean;
      if ('signUpClosingDate' in body && !schlussSchlucken)
        anmeldeschluss = body.signUpClosingDate as string | null;
      if ('qrCodeCheckinAutomaticEmail' in body)
        codeMail = body.qrCodeCheckinAutomaticEmail as boolean;
      if ('qrCodeCheckin' in body && !checkinSchlucken) {
        const an = body.qrCodeCheckin as boolean;
        // Ein Aufruf wirkt als Ganzes: Code-Mail schon aus → beim Einschalten keine Mails.
        if (an && !checkin && codeMail) codeMailsAnBestehende++;
        checkin = an;
      }
      return null;
    }
    throw new Error(`unerwartet: ${methode} ${pfad}`);
  });
});

describe('ablaeufeEinrichten', () => {
  it('legt Platz (aktiv) und Warteliste (wartend) für die Teilnehmerrolle an, beide an; danach Standard-Mail aus', async () => {
    await ablaeufeEinrichten(165, 7);
    const liste = [...routinen.values()];
    expect(liste.map((r) => [r.name, r.rolle, r.status, r.isEnabled])).toEqual([
      ['Anmeldungen: Platz', 32, 'active', true],
      ['Anmeldungen: Warteliste', 32, 'waiting', true],
    ]);
    const mail = (r: Routine) => r.steps[0].actionData;
    expect(liste.map((r) => mail(r).subject)).toEqual([
      'Kinderfreizeit: Anmeldung bestätigt',
      'Kinderfreizeit: Warteliste',
    ]);
    expect(liste.every((r) => mail(r).senderId === 7 && mail(r).addSignOutUrl === false)).toBe(
      true,
    );
    expect(standardMail).toBe(false);
    // Erst die Routinen, dann die Standard-Mail aus – nie ein Moment ganz ohne Mail.
    expect(aufrufe.at(-1)).toBe('PATCH /groups/165');
    // Das Feld „Link zur Anmeldung“ wird vorher angelegt.
    expect(ei.systemfelderNachziehen).toHaveBeenCalledWith(165);
  });

  it('noch einmal (Text geändert): keine neue Routine, der Mail-Schritt behält seine Nummer', async () => {
    await ablaeufeEinrichten(165, 7);
    const vorher = [...routinen.values()].map((r) => [r.id, r.steps[0].id]);
    await ablaeufeEinrichten(165, 9);
    expect(routinen.size).toBe(2);
    expect([...routinen.values()].map((r) => [r.id, r.steps[0].id])).toEqual(vorher);
    expect([...routinen.values()].every((r) => r.steps[0].actionData.senderId === 9)).toBe(true);
  });

  it('eigene Routine aus ChurchTools an derselben Stelle: bleibt unangetastet, Standard-Mail bleibt an', async () => {
    routinen.set(5, {
      id: 5,
      name: 'Willkommen (von Hand)',
      isEnabled: true,
      steps: [],
      rolle: 32,
      status: 'active',
    });
    await expect(ablaeufeEinrichten(165, 7)).rejects.toMatchObject({ status: 409 });
    expect(routinen.get(5)!.name).toBe('Willkommen (von Hand)');
    expect(aufrufe.some((a) => a === 'PATCH /routines/5')).toBe(false);
    expect(standardMail).toBe(true);
  });

  it('ChurchTools sagt 200, übernimmt die Routine aber nicht: Fehler, Standard-Mail bleibt an', async () => {
    routinen.set(12, {
      id: 12,
      name: 'Anmeldungen: Platz',
      isEnabled: false,
      steps: [],
      rolle: 32,
      status: 'active',
    });
    schlucken = true;
    await expect(ablaeufeEinrichten(165, 7)).rejects.toBeInstanceOf(NichtUebernommen);
    expect(standardMail).toBe(true);
  });

  it('fehlt ein Platzhalter (Feld in ChurchTools weg): nichts geschrieben, Meldung nennt das Feld', async () => {
    const ohne = new Map(PLATZHALTER);
    ohne.delete('Link zur Anmeldung');
    ru.platzhalterLaden.mockResolvedValue(ohne);
    const f = await ablaeufeEinrichten(165, 7).catch((x: unknown) => x);
    expect(f).toBeInstanceOf(ApiError);
    expect((f as ApiError).message).toContain('Link zur Anmeldung');
    expect(aufrufe).toEqual([]);
  });
});

describe('ablaeufeLesen', () => {
  it('vor dem Einrichten: nichts an, Standard-Mail an', async () => {
    expect(await ablaeufeLesen(165)).toEqual({
      platz: false,
      warte: false,
      standardMail: true,
      absender: null,
      absenderId: null,
      eigen: { platz: OHNE_EIGENEN_TEXT, warte: OHNE_EIGENEN_TEXT },
      qr: false,
      loeschDatum: null,
      anmeldeschluss: null,
    });
  });
  it('nach dem Einrichten: beide an, Standard-Mail aus, Absender aus ChurchTools', async () => {
    await ablaeufeEinrichten(165, 7);
    // ChurchTools liefert den Absender als Person mit Namen (gemessen: `sender.title`).
    for (const r of routinen.values()) r.steps[0].actionData.sender = { title: 'Anna Leitung' };
    expect(await ablaeufeLesen(165)).toEqual({
      platz: true,
      warte: true,
      standardMail: false,
      absender: 'Anna Leitung',
      absenderId: 7,
      eigen: { platz: OHNE_EIGENEN_TEXT, warte: OHNE_EIGENEN_TEXT },
      qr: false,
      loeschDatum: null,
      anmeldeschluss: null,
    });
  });
  it('abgeschaltet (z. B. beim Archivieren) oder fremd: zählt nicht als eingerichtet', async () => {
    await ablaeufeEinrichten(165, 7);
    const r = (name: string) => [...routinen.values()].find((x) => x.name === name)!;
    r('Anmeldungen: Platz').isEnabled = false;
    r('Anmeldungen: Warteliste').name = 'anders';
    const s = await ablaeufeLesen(165);
    expect([s.platz, s.warte]).toEqual([false, false]);
  });
});

describe('absenderAus (A9-1)', () => {
  it('wer freigibt, wenn er zur gewählten Leitung gehört – sonst die erste gewählte', () => {
    expect(absenderAus(new Set([4, 7]), 7)).toBe(7);
    expect(absenderAus(new Set([4, 9]), 7)).toBe(4);
    expect(absenderAus(new Set([4]), null)).toBe(4);
  });
  it('ohne Leitung: Fehler mit Satz statt Absturz', () => {
    expect(() => absenderAus(new Set(), 7)).toThrow('mindestens eine Person');
  });
});

describe('Eigener Text (A9-2a)', () => {
  const eigen = {
    betreff: 'Du bist dabei!',
    absatz: 'Bitte Schlafsack mitbringen.',
    gruss: 'Anna',
  };
  const platzRoutine = () => [...routinen.values()].find((r) => r.status === 'active')!;
  const warteRoutine = () => [...routinen.values()].find((r) => r.status === 'waiting')!;

  it('gespeichert in der Beschreibung der Routine, in der Mail eingesetzt, nachgelesen', async () => {
    await ablaeufeEinrichten(165, 7, { platz: eigen });
    expect(JSON.parse(platzRoutine().description!)).toEqual({ v: 1, ...eigen });
    expect(platzRoutine().steps[0].actionData.subject).toBe('Du bist dabei!');
    expect(String(platzRoutine().steps[0].actionData.body)).toContain(
      '<p>Bitte Schlafsack mitbringen.</p>',
    );
    // Die Warteliste bekam nichts Eigenes – und keine Beschreibung.
    expect(warteRoutine().description).toBeNull();
    expect((await ablaeufeLesen(165)).eigen.platz).toEqual(eigen);
  });

  it('neu schreiben ohne neuen Text (Termin geändert …): Beschreibung bleibt, Mail behält den eigenen Text', async () => {
    await ablaeufeEinrichten(165, 7, { platz: eigen });
    routinenPatches = [];
    await ablaeufeEinrichten(165, 9);
    expect(routinenPatches.every((b) => !('description' in b))).toBe(true);
    expect(JSON.parse(platzRoutine().description!)).toEqual({ v: 1, ...eigen });
    expect(String(platzRoutine().steps[0].actionData.body)).toContain(
      'Bitte Schlafsack mitbringen.',
    );
  });

  it('Kopie („Wie eine frühere Veranstaltung“): neue Routinen bekommen den eigenen Text der Vorlage', async () => {
    routinen.set(5, {
      id: 5,
      name: 'Anmeldungen: Platz',
      isEnabled: true,
      steps: [],
      rolle: 32,
      status: 'active',
      gruppe: 90,
      description: JSON.stringify({ v: 1, ...eigen }),
    });
    ei.systemfelderNachziehen.mockResolvedValue({ ...neueEinstellungen('kinder'), kopieVon: 90 });
    await ablaeufeEinrichten(165, 7);
    const neu = [...routinen.values()].find((r) => r.gruppe === 165 && r.status === 'active')!;
    expect(JSON.parse(neu.description!)).toEqual({ v: 1, ...eigen });
    expect(neu.steps[0].actionData.subject).toBe('Du bist dabei!');
    // Die Vorlage selbst bleibt unberührt.
    expect(routinen.get(5)!.steps).toEqual([]);
  });

  it('zu lang → 422, bevor etwas geschrieben wird', async () => {
    const f = await ablaeufeEinrichten(165, 7, {
      platz: { ...eigen, absatz: 'x'.repeat(1000) },
    }).catch((x: unknown) => x);
    expect(f).toMatchObject({ status: 422 });
    expect(aufrufe).toEqual([]);
  });

  it('ChurchTools speichert die Beschreibung nicht → Fehler statt „gespeichert“', async () => {
    await ablaeufeEinrichten(165, 7);
    // Schritte (Betreff, Text) kommen an, nur die Beschreibung nicht – das muss das Nachlesen der Beschreibung finden.
    beschreibungSchlucken = true;
    await expect(ablaeufeEinrichten(165, 7, { platz: eigen })).rejects.toBeInstanceOf(
      NichtUebernommen,
    );
  });
});

describe('ablaeufeAbgleichen (A9-2a)', () => {
  it('passt alles: nichts geschrieben', async () => {
    await ablaeufeEinrichten(165, 7);
    aufrufe = [];
    await ablaeufeAbgleichen(165);
    expect(aufrufe).toEqual([]);
  });

  it('Einstellungen geändert (Kontakt): neu geschrieben – mit Absender und eigenem Text von dort', async () => {
    await ablaeufeEinrichten(165, 9, {
      warte: { betreff: '', absatz: 'Wir melden uns.', gruss: '' },
    });
    const e = { ...neueEinstellungen('kinder'), kontakt: 'neu@x.de' };
    ei.systemfelderNachziehen.mockResolvedValue(e);
    // Wie gemessen: Den Absender liefert ChurchTools als Nummer im Schritt.
    const stand = await ablaeufeAbgleichen(165);
    const body = (s: string) =>
      String([...routinen.values()].find((r) => r.status === s)!.steps[0].actionData.body);
    expect(body('active')).toContain('neu@x.de');
    expect(body('waiting')).toContain('Wir melden uns.');
    expect([...routinen.values()].every((r) => r.steps[0].actionData.senderId === 9)).toBe(true);
    expect(stand.platz && stand.warte).toBe(true);
  });

  it('abgeschaltet (archiviert) oder nicht eingerichtet: nichts geschrieben', async () => {
    expect((await ablaeufeAbgleichen(165)).platz).toBe(false);
    await ablaeufeEinrichten(165, 7);
    // Die Warteliste abgeschaltet (z. B. in ChurchTools von Hand) – der Absender aus „Platz“ ist noch da, der Abgleich
    // darf sie trotzdem nicht wieder einschalten.
    [...routinen.values()].find((r) => r.status === 'waiting')!.isEnabled = false;
    ei.systemfelderNachziehen.mockResolvedValue({
      ...neueEinstellungen('kinder'),
      kontakt: 'neu@x.de',
    });
    aufrufe = [];
    await ablaeufeAbgleichen(165);
    expect(aufrufe).toEqual([]);
  });
});

describe('vorschauPerson (A9-2a)', () => {
  it('erste Person mit passendem Status – sonst der Absender (dann ohne Betrag, Nr., Link)', async () => {
    ct.ctAlleSeiten.mockResolvedValue([
      { personId: 1, groupTypeRoleId: 35, groupMemberStatus: 'active' },
      { personId: 40, groupTypeRoleId: 32, groupMemberStatus: 'waiting' },
      { personId: 41, groupTypeRoleId: 32, groupMemberStatus: 'active' },
    ]);
    expect(await vorschauPerson(165, 'platz', 7)).toEqual({ personId: 41, echt: true });
    expect(await vorschauPerson(165, 'warte', 7)).toEqual({ personId: 40, echt: true });
    ct.ctAlleSeiten.mockResolvedValue([]);
    expect(await vorschauPerson(165, 'platz', 7)).toEqual({ personId: 7, echt: false });
  });
});

describe('Check-in-Code (A9-2b)', () => {
  const body = (s: string) =>
    String([...routinen.values()].find((r) => r.status === s)!.steps[0].actionData.body);

  it('an: Check-in an und eigene Code-Mail aus in einem Aufruf – keine Mails an schon Angemeldete', async () => {
    await ablaeufeEinrichten(165, 7, undefined, true);
    expect([checkin, codeMail, codeMailsAnBestehende]).toEqual([true, false, 0]);
    expect(body('active')).toContain('groupMember.checkInCodeQr');
    expect(body('waiting')).not.toContain('groupMember.checkInCodeQr');
    expect((await ablaeufeLesen(165)).qr).toBe(true);
  });

  it('aus: Check-in aus, der Code verschwindet aus der Bestätigung', async () => {
    await ablaeufeEinrichten(165, 7, undefined, true);
    await ablaeufeEinrichten(165, 7, undefined, false);
    expect(checkin).toBe(false);
    expect(body('active')).not.toContain('groupMember.checkInCodeQr');
    expect((await ablaeufeLesen(165)).qr).toBe(false);
  });

  it('ohne Angabe (Freigeben, Abgleich): bleibt, wie es in ChurchTools steht – aus wird nicht angefasst', async () => {
    await ablaeufeEinrichten(165, 7);
    expect(checkin).toBe(false);
    expect(codeMail).toBe(true);
    expect(body('active')).not.toContain('groupMember.checkInCodeQr');
  });

  it('ChurchTools übernimmt den Check-in nicht → Fehler statt „gespeichert“', async () => {
    checkinSchlucken = true;
    await expect(ablaeufeEinrichten(165, 7, undefined, true)).rejects.toBeInstanceOf(
      NichtUebernommen,
    );
  });

  it('Abgleich: in ChurchTools eingeschaltet (Code-Mail an) → Code in die Bestätigung, Code-Mail aus', async () => {
    await ablaeufeEinrichten(165, 7);
    checkin = true; // jemand schaltet den Check-in in ChurchTools ein – dort ist die Code-Mail vorgegeben
    const stand = await ablaeufeAbgleichen(165);
    expect(stand.qr).toBe(true);
    expect(codeMail).toBe(false);
    expect(body('active')).toContain('groupMember.checkInCodeQr');
    aufrufe = [];
    await ablaeufeAbgleichen(165);
    expect(aufrufe).toEqual([]);
  });

  it('Abgleich: Code steht schon in der Mail, aber in ChurchTools ist die Code-Mail wieder an → wieder aus', async () => {
    await ablaeufeEinrichten(165, 7, undefined, true);
    codeMail = true;
    await ablaeufeAbgleichen(165);
    expect(codeMail).toBe(false);
  });

  it('Abgleich: in ChurchTools ausgeschaltet → Code verschwindet aus der Bestätigung', async () => {
    await ablaeufeEinrichten(165, 7, undefined, true);
    checkin = false;
    await ablaeufeAbgleichen(165);
    expect(body('active')).not.toContain('groupMember.checkInCodeQr');
  });
});

describe('Löschen (A9-3a)', () => {
  /** Einstellungen mit Termin – Ende `ende`, Frist `monate`. */
  const mitTermin = (ende: string, monate = 3) => {
    const e = {
      ...neueEinstellungen('kinder'),
      termin: { beginn: `${ende}T10:00`, ende: `${ende}T18:00`, ort: '', terminId: 1 },
      loeschfristMonate: monate,
    };
    ei.systemfelderNachziehen.mockResolvedValue(e);
    return e;
  };
  const routine = (status: string) => [...routinen.values()].find((x) => x.status === status)!;
  const schritte = (status: string) => routine(status).steps.map((s) => s.actionKey);
  const ZONE = 'Europe/Berlin';
  const optionen = { heute: HEUTE, zeitzone: ZONE };
  // Wächter für alle Fälle hier: Nie steht ein Löschdatum in einer Routine, während die Anmeldung an dem Tag noch offen ist.
  afterEach(() => expect(offenBeimLoeschen).toEqual([]));

  it('mit Termin: beide Routinen warten bis Ende + Frist und entfernen dann; Lesen zeigt das Datum', async () => {
    mitTermin('2026-11-15');
    await ablaeufeEinrichten(165, 7, undefined, undefined, optionen);
    for (const s of ['active', 'waiting']) {
      expect(schritte(s)).toEqual(['send-member-email', 'special:wait', 'remove-member']);
      expect(routine(s).steps[1].actionData.untilDate).toBe('2027-02-15');
    }
    expect((await ablaeufeLesen(165)).loeschDatum).toBe('2027-02-15');
  });

  it('schon Angemeldete (abgeschlossene Läufe) kommen ohne Mail ins Warten; die Mail ist danach wieder an', async () => {
    await ablaeufeEinrichten(165, 7, undefined, undefined, optionen);
    laeufe = [
      { routine: routine('active').id, person: 'Lena', status: 'finished', schritt: null },
      { routine: routine('waiting').id, person: 'Paul', status: 'finished', schritt: null },
    ];
    mitTermin('2026-11-15');
    await ablaeufeEinrichten(165, 7, undefined, undefined, optionen);
    expect(laeufe.map((l) => [l.person, l.status])).toEqual([
      ['Lena', 'waiting'],
      ['Paul', 'waiting'],
    ]);
    expect(mailsAnLaeufe).toEqual([]);
    expect([routine('active'), routine('waiting')].every((r) => r.steps[0].isEnabled)).toBe(true);
  });

  it('ohne abgeschlossene Läufe wird nichts neu gestartet (die Mail bleibt durchgehend an)', async () => {
    mitTermin('2026-11-15');
    await ablaeufeEinrichten(165, 7, undefined, undefined, optionen);
    expect(routinenPatches.some((b) => 'restart' in b)).toBe(false);
    expect(
      routinenPatches.every(
        (b) => !('steps' in b) || (b.steps as { isEnabled: boolean }[])[0].isEnabled,
      ),
    ).toBe(true);
  });

  it('scheitert der Neustart, wird die Mail trotzdem wieder eingeschaltet', async () => {
    await ablaeufeEinrichten(165, 7, undefined, undefined, optionen);
    laeufe = [{ routine: routine('active').id, person: 'Lena', status: 'finished', schritt: null }];
    mitTermin('2026-11-15');
    restartFehler = true;
    await expect(ablaeufeEinrichten(165, 7, undefined, undefined, optionen)).rejects.toMatchObject({
      status: 502,
    });
    expect(routine('active').steps[0].isEnabled).toBe(true);
  });

  it('neues Datum heute oder früher: erst Rückfrage (nichts geschrieben), mit Bestätigung wird sofort entfernt', async () => {
    mitTermin('2026-11-15');
    await ablaeufeEinrichten(165, 7, undefined, undefined, optionen);
    laeufe = [
      {
        routine: routine('active').id,
        person: 'Lena',
        status: 'waiting',
        schritt: routine('active').steps[1].id,
      },
    ];
    mitTermin('2026-07-28'); // + 3 Monate = heute
    routinenPatches = [];
    const f = await ablaeufeEinrichten(165, 7, undefined, undefined, optionen).catch(
      (x: unknown) => x,
    );
    expect(f).toBeInstanceOf(LoeschdatumVorbei);
    expect((f as LoeschdatumVorbei).datum).toBe('2026-10-28');
    expect(routinenPatches).toEqual([]);
    expect(entfernt).toEqual([]);
    expect(anmeldeschluss).toBe('2027-02-14T22:59:00Z');
    await ablaeufeEinrichten(165, 7, undefined, undefined, {
      ...optionen,
      loeschenBestaetigt: true,
    });
    expect(entfernt).toEqual(['Lena']);
    // Die Anmeldung ist mit zu – wer jetzt käme, bekäme sonst „Du bist dabei!“ und wäre sofort wieder weg.
    expect(anmeldeschluss).toBe('2026-10-27T22:59:00Z');
  });

  it('steht das erreichte Datum schon so in ChurchTools, fragt es nicht noch einmal', async () => {
    mitTermin('2026-07-28');
    await ablaeufeEinrichten(165, 7, undefined, undefined, {
      ...optionen,
      loeschenBestaetigt: true,
    });
    await expect(
      ablaeufeEinrichten(165, 9, undefined, undefined, optionen),
    ).resolves.toBeUndefined();
  });

  it('Termin entfernt: Warten und Entfernen fallen weg, Wartende werden beendet statt entfernt', async () => {
    mitTermin('2026-11-15');
    await ablaeufeEinrichten(165, 7, undefined, undefined, optionen);
    laeufe = [
      {
        routine: routine('active').id,
        person: 'Lena',
        status: 'waiting',
        schritt: routine('active').steps[1].id,
      },
    ];
    ei.systemfelderNachziehen.mockResolvedValue(neueEinstellungen('kinder'));
    await ablaeufeEinrichten(165, 7, undefined, undefined, optionen);
    expect(schritte('active')).toEqual(['send-member-email']);
    expect(laeufe.map((l) => l.status)).toEqual(['finished']);
    expect(entfernt).toEqual([]);
  });

  it('ChurchTools übernimmt Warten und Entfernen nicht → Fehler statt „gespeichert“', async () => {
    mitTermin('2026-11-15');
    warteSchlucken = true;
    await expect(ablaeufeEinrichten(165, 7, undefined, undefined, optionen)).rejects.toBeInstanceOf(
      NichtUebernommen,
    );
  });

  it('ChurchTools behält das alte Datum → Fehler statt „gespeichert“', async () => {
    mitTermin('2026-11-15');
    await ablaeufeEinrichten(165, 7, undefined, undefined, optionen);
    mitTermin('2026-11-15', 6);
    datumSchlucken = true;
    await expect(ablaeufeEinrichten(165, 7, undefined, undefined, optionen)).rejects.toBeInstanceOf(
      NichtUebernommen,
    );
  });

  it('Abgleich: nur die Frist geändert (die Mail bleibt gleich) → das Datum zieht trotzdem mit', async () => {
    mitTermin('2026-11-15');
    await ablaeufeEinrichten(165, 7, undefined, undefined, optionen);
    mitTermin('2026-11-15', 6);
    const stand = await ablaeufeAbgleichen(165, HEUTE, ZONE);
    expect(stand.loeschDatum).toBe('2027-05-15');
  });

  it('Abgleich: Termin verschoben → das Datum zieht mit', async () => {
    mitTermin('2026-11-15');
    await ablaeufeEinrichten(165, 7, undefined, undefined, optionen);
    mitTermin('2026-12-05');
    const stand = await ablaeufeAbgleichen(165, HEUTE, ZONE);
    expect(stand.loeschDatum).toBe('2027-03-05');
    expect(routine('waiting').steps[1].actionData.untilDate).toBe('2027-03-05');
  });

  it('Abgleich: neues Datum heute oder früher → nichts geschrieben, nur der Hinweis (E3)', async () => {
    mitTermin('2026-11-15');
    await ablaeufeEinrichten(165, 7, undefined, undefined, optionen);
    laeufe = [
      {
        routine: routine('active').id,
        person: 'Lena',
        status: 'waiting',
        schritt: routine('active').steps[1].id,
      },
    ];
    mitTermin('2026-06-01');
    routinenPatches = [];
    const stand = await ablaeufeAbgleichen(165, HEUTE, ZONE);
    expect(stand.loeschenOffen).toBe('2026-09-01');
    expect(stand.loeschDatum).toBe('2027-02-15');
    expect(routinenPatches).toEqual([]);
    expect(entfernt).toEqual([]);
  });

  describe('Anmeldeschluss vor dem Löschdatum (Fund der echten Prüfung)', () => {
    it('ohne Anmeldeschluss: schließt am Tag vor dem Löschdatum um 23:59 Ortszeit; Lesen zeigt ihn', async () => {
      mitTermin('2026-11-15');
      await ablaeufeEinrichten(165, 7, undefined, undefined, optionen);
      expect(anmeldeschluss).toBe('2027-02-14T22:59:00Z');
      expect((await ablaeufeLesen(165)).anmeldeschluss).toBe('2027-02-14T22:59:00Z');
    });

    it('ein späterer Anmeldeschluss wird vorgezogen (Sommerzeit: 21:59 UTC), ein früherer bleibt unberührt', async () => {
      mitTermin('2026-05-20'); // + 3 Monate = 20.08., Vortag in der Sommerzeit
      anmeldeschluss = '2026-09-01T21:59:00Z';
      await ablaeufeEinrichten(165, 7, undefined, undefined, {
        ...optionen,
        heute: '2026-05-01',
      });
      expect(anmeldeschluss).toBe('2026-08-19T21:59:00Z');
      mitTermin('2026-11-15');
      anmeldeschluss = '2026-11-10T22:59:00Z';
      aufrufe = [];
      await ablaeufeEinrichten(165, 7, undefined, undefined, optionen);
      expect(anmeldeschluss).toBe('2026-11-10T22:59:00Z');
      // Genau ein PATCH an die Gruppe: Standard-Mail aus – der Anmeldeschluss wird nicht angefasst.
      expect(aufrufe.filter((a) => a === 'PATCH /groups/165')).toHaveLength(1);
    });

    it('ohne Termin (kein Löschdatum) bleibt eine offene Anmeldung offen', async () => {
      await ablaeufeEinrichten(165, 7, undefined, undefined, optionen);
      expect(anmeldeschluss).toBeNull();
    });

    it('ChurchTools übernimmt den Anmeldeschluss nicht → Fehler, bevor ein Löschdatum geschrieben ist', async () => {
      mitTermin('2026-11-15');
      schlussSchlucken = true;
      await expect(
        ablaeufeEinrichten(165, 7, undefined, undefined, optionen),
      ).rejects.toBeInstanceOf(NichtUebernommen);
      expect(routinenPatches).toEqual([]);
    });

    it('Abgleich: Anmeldung wieder geöffnet (Schluss leer oder zu spät) → der Abgleich zieht ihn wieder vor', async () => {
      mitTermin('2026-11-15');
      await ablaeufeEinrichten(165, 7, undefined, undefined, optionen);
      anmeldeschluss = null;
      const stand = await ablaeufeAbgleichen(165, HEUTE, ZONE);
      expect(anmeldeschluss).toBe('2027-02-14T22:59:00Z');
      expect(stand.anmeldeschluss).toBe('2027-02-14T22:59:00Z');
      anmeldeschluss = '2027-02-15T22:59:00Z';
      await ablaeufeAbgleichen(165, HEUTE, ZONE);
      expect(anmeldeschluss).toBe('2027-02-14T22:59:00Z');
    });
  });
});
