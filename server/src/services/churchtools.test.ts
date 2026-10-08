import { describe, it, expect } from 'vitest';
import { extractSessionCookie } from './ctAuth.js';
import { computeTeamNotesAllowed, parseCapabilities } from './ctCapabilities.js';
import { fileIdFromUrl } from './ctFiles.js';
import type { NoteRolePerm } from '@shared/types/index';

describe('fileIdFromUrl', () => {
  it('liest die id aus einer ChurchTools-Download-URL', () => {
    expect(fileIdFromUrl('https://x.church.tools/?q=public/filedownload&id=4711')).toBe(4711);
  });
  it('liest die id auch, wenn sie der erste Parameter ist', () => {
    expect(fileIdFromUrl('https://x.church.tools/?id=12&q=x')).toBe(12);
  });
  it('liefert null, wenn keine id enthalten ist', () => {
    expect(fileIdFromUrl('https://x.church.tools/datei.pdf')).toBeNull();
  });
});

describe('extractSessionCookie', () => {
  const resWithCookies = (cookies: string[]): Response => {
    const headers = new Headers();
    for (const c of cookies) headers.append('set-cookie', c);
    return { headers } as unknown as Response;
  };

  it('extrahiert das ChurchTools_-Session-Cookie (name=value, ohne Attribute)', () => {
    const res = resWithCookies(['ChurchTools_abc=xyz123; Path=/; HttpOnly; SameSite=Lax']);
    expect(extractSessionCookie(res)).toBe('ChurchTools_abc=xyz123');
  });

  it('ignoriert fremde Cookies', () => {
    const res = resWithCookies(['other_session=1; Path=/']);
    expect(extractSessionCookie(res)).toBeNull();
  });

  it('pickt das ChurchTools-Cookie aus mehreren Set-Cookie-Headern', () => {
    const res = resWithCookies(['foo=bar; Path=/', 'ChurchTools_sess=token99; HttpOnly']);
    expect(extractSessionCookie(res)).toBe('ChurchTools_sess=token99');
  });
});

describe('parseCapabilities', () => {
  // Leere/ungültige Antwort = Aussetzer → wirft, damit der Client neu versucht (statt „keine Rechte").
  it('wirft bei komplett leerer Antwort', () => {
    expect(() => parseCapabilities({})).toThrow();
  });
  it('wirft bei null/undefined', () => {
    expect(() => parseCapabilities(null)).toThrow();
    expect(() => parseCapabilities(undefined)).toThrow();
  });

  // Antwort vorhanden, aber kein churchservice-Block = Nutzer hat wirklich keine Lieder-/Ablauf-
  // Rechte → false-Werte, KEIN Wurf.
  it('liefert false ohne Wurf, wenn andere Module da sind aber churchservice fehlt', () => {
    const caps = parseCapabilities({ churchcore: { 'administer settings': [] } });
    expect(caps.canViewSongs).toBe(false);
    expect(caps.canViewAgendas).toBe(false);
  });

  /**
   * #444: ChurchTools schickt IMMER alle Module, auch leer (gemessen 08.10.2026, Testperson „Spike",
   * hier gekürzt und mit geleerten Event-Rechten). Ob die Antwort echt ist, zeigt ein anderes gesetztes
   * Recht – beim Aussetzer aus #99 war nichts gesetzt.
   */
  const ECHT_OHNE_EVENTS = {
    churchcore: { 'administer settings': false, 'view links': [] },
    churchdb: { view: false, 'security level person': [1], 'security level view own data': [2] },
    churchcal: { view: false, 'view category': [1, 2, 3] },
    churchservice: {
      view: false,
      'view agenda': [],
      'view songcategory': [],
      'edit songcategory': [],
      'use ccli': false,
    },
    'musik-app-test': { view: true, 'view custom data': [12, 15] },
  };

  it('#444: echte Antwort ohne Lieder und Abläufe → keineLiedRechte', () => {
    const caps = parseCapabilities(ECHT_OHNE_EVENTS);
    expect(caps.canViewSongs).toBe(false);
    expect(caps.canViewAgendas).toBe(false);
    expect(caps.keineLiedRechte).toBe(true);
  });

  it('#444: alle Module da, aber nichts gesetzt (Aussetzer) → NICHT keineLiedRechte', () => {
    const leer = Object.fromEntries(
      Object.entries(ECHT_OHNE_EVENTS).map(([modul, rechte]) => [
        modul,
        Object.fromEntries(
          Object.entries(rechte).map(([k, v]) => [k, Array.isArray(v) ? [] : false]),
        ),
      ]),
    );
    expect(parseCapabilities(leer).keineLiedRechte).toBe(false);
  });

  it('#444: mit Lied-Rechten ist keineLiedRechte nie gesetzt', () => {
    const mit = {
      ...ECHT_OHNE_EVENTS,
      churchservice: { ...ECHT_OHNE_EVENTS.churchservice, 'view songcategory': [0] },
    };
    expect(parseCapabilities(mit).keineLiedRechte).toBe(false);
  });

  it('erkennt vorhandene Lieder-/Ablauf-Rechte (Arrays mit IDs)', () => {
    const caps = parseCapabilities({
      churchservice: { 'view songcategory': [1, 2], 'view agenda': [5] },
    });
    expect(caps.canViewSongs).toBe(true);
    expect(caps.canViewAgendas).toBe(true);
  });

  it('wertet leere Rechte-Arrays im churchservice als „nein"', () => {
    const caps = parseCapabilities({
      churchservice: { 'view songcategory': [], 'view agenda': [] },
    });
    expect(caps.canViewSongs).toBe(false);
    expect(caps.canViewAgendas).toBe(false);
  });

  // Admin (churchcore:administer persons) darf alles – auch ohne explizite Kategorie-/Kalender-Rechte.
  it('gibt Admins Zugriff, auch bei leeren Kategorie-/Kalender-Rechten', () => {
    const caps = parseCapabilities({
      churchcore: { 'administer persons': [1] },
      churchservice: { 'view songcategory': [], 'view agenda': [] },
    });
    expect(caps.isAdmin).toBe(true);
    expect(caps.canViewSongs).toBe(true);
    expect(caps.canViewAgendas).toBe(true);
  });

  // Nur Musiker sollen die Statistik sehen (Alwin, 08.10.2026) – also das eigene Recht, ohne Ableitung.
  it('Song-Statistik: nur mit `view song statistics`, nicht aus Ablauf- oder Admin-Rechten', () => {
    const mit = parseCapabilities({ churchservice: { 'view song statistics': true } });
    expect(mit.canViewSongStatistics).toBe(true);
    const ohne = parseCapabilities({
      churchcore: { 'administer persons': [1] },
      churchservice: {
        'view agenda': [5],
        'view songcategory': [1],
        'view song statistics': false,
      },
    });
    expect(ohne.canViewSongStatistics).toBe(false);
  });
});

describe('computeTeamNotesAllowed', () => {
  const MUSIKTEAM = 9;
  // Rollen im Musikteam: 15 Mitarbeiter, 16 Leiter, 19 Organisator.
  const freigabe: NoteRolePerm[] = [{ groupId: MUSIKTEAM, roles: [16, 19] }];

  it('ohne Rollen-Freigabe darf niemand (leer = niemand, kein „alle")', () => {
    expect(computeTeamNotesAllowed([{ groupId: MUSIKTEAM, roleId: 16 }], [MUSIKTEAM], [])).toBe(
      false,
    );
  });

  it('freigegebene Rolle darf Team-Notizen nutzen', () => {
    expect(
      computeTeamNotesAllowed([{ groupId: MUSIKTEAM, roleId: 19 }], [MUSIKTEAM], freigabe),
    ).toBe(true);
  });

  it('nicht freigegebene Rolle darf nichts', () => {
    // Mitarbeiter (15) ist nicht freigegeben.
    expect(
      computeTeamNotesAllowed([{ groupId: MUSIKTEAM, roleId: 15 }], [MUSIKTEAM], freigabe),
    ).toBe(false);
  });

  it('Mitgliedschaft in NICHT gewählter Gruppe zählt nicht', () => {
    expect(
      computeTeamNotesAllowed(
        [{ groupId: 42, roleId: 16 }],
        [MUSIKTEAM],
        [{ groupId: 42, roles: [16] }],
      ),
    ).toBe(false);
  });

  it('mehrere Mitgliedschaften: eine Freigabe genügt', () => {
    expect(
      computeTeamNotesAllowed(
        [
          { groupId: MUSIKTEAM, roleId: 15 }, // nicht freigegeben
          { groupId: 5, roleId: 3 }, // Technik-Rolle freigegeben
        ],
        [MUSIKTEAM, 5],
        [
          { groupId: MUSIKTEAM, roles: [16, 19] },
          { groupId: 5, roles: [3] },
        ],
      ),
    ).toBe(true);
  });
});
