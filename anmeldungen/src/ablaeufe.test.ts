import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as V from '@ui/ct/verbindung';
import { ApiError, NichtUebernommen } from '@ui/ct/fehler';
import * as E from './einrichten';
import * as R from './rundmail';
import { SYSTEMFELDER } from '@shared/anmeldung/formular';
import { neueEinstellungen } from '@shared/anmeldung/vorlagen';
import { ablaeufeEinrichten, ablaeufeLesen, absenderAus } from './ablaeufe';

/**
 * Abläufe schreiben (A9-1) gegen nachgestellte Routinen – so, wie am 24.10.2026 gemessen: `POST /routines` hängt die
 * Routine über `domainContext` an die Gruppe, `PATCH` nimmt die ganze Schrittliste, Schritte ohne Nummer werden neu
 * angelegt. Danach wird nachgelesen; `schlucken` lässt ChurchTools „200“ sagen und nichts speichern.
 */
vi.mock('@ui/ct/verbindung', () => ({ ctAnfrage: vi.fn(), ctDaten: vi.fn() }));
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
}

const PLATZHALTER = new Map<string, string>([
  ...SYSTEMFELDER.map((f, i): [string, string] => [f.name, `{{{groupMemberField.f${i}}}}`]),
  ['Wartelistenplatz', '{{{groupMember.waitinglistPosition}}}'],
]);

let routinen: Map<number, Routine>;
let naechste: number;
let standardMail: boolean;
let schlucken: boolean;
let aufrufe: string[];

beforeEach(() => {
  routinen = new Map();
  naechste = 12;
  standardMail = true;
  schlucken = false;
  aufrufe = [];
  ei.systemfelderNachziehen.mockResolvedValue(neueEinstellungen('kinder'));
  ei.teilnehmerRolle.mockResolvedValue(32);
  ru.platzhalterLaden.mockResolvedValue(PLATZHALTER);
  ct.ctDaten.mockImplementation(async (pfad: string) => {
    if (pfad === '/groups/165')
      return { name: 'Kinderfreizeit', settings: { sendDefaultSignUpMail: standardMail } };
    if (pfad === '/groups/165/members/routines')
      return [...routinen.values()].map((r) => ({
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
      };
      routinen.set(r.id, r);
      return { data: { id: r.id } };
    }
    const m = /^\/routines\/(\d+)$/.exec(pfad);
    if (methode === 'PATCH' && m) {
      // Nur die Routine wird verschluckt – so prüft der Test das Nachlesen der Routine, nicht das der Standard-Mail.
      if (schlucken) return null;
      const r = routinen.get(Number(m[1]))!;
      r.isEnabled = !!body.isEnabled;
      r.steps = (body.steps as Partial<Schritt>[]).map((s) => ({
        ...(s as Schritt),
        id: s.id ?? 100 + naechste++,
      }));
      return null;
    }
    if (methode === 'PATCH' && pfad === '/groups/165') {
      standardMail = body.sendDefaultSignUpMail as boolean;
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
