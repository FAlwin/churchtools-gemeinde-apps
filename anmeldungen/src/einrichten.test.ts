import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { _bremseLoesen, _vergissCsrf } from '@ui/ct/verbindung';
import { ApiError } from '@ui/ct/fehler';
import {
  EINSTELLUNGEN_KENNUNG,
  SYSTEMFELDER,
  HINWEIS_SATZ,
  einstellungenLesen,
  sicherungLesen,
  standardFormular,
} from '@shared/anmeldung/formular';
import {
  NichtUebernommen,
  aendereEinstellungen,
  aenderePreise,
  anmeldungenZahl,
  bildEntfernen,
  bildHochladen,
  einstellungenVon,
  kopfVon,
  anmeldenVorbereiten,
  anmeldeBedingungen,
  leitungsKandidaten,
  logoEntfernen,
  logoHochladen,
  logoListe,
  anlegenMoeglich,
  freigeben,
  kalenderListe,
  kopiereVeranstaltung,
  legeTerminAn,
  legeVeranstaltungAn,
  speichereAnmeldung,
  speichereBezahlung,
  STATUS,
  archivListe,
  loeschenEndgueltig,
  setzeStatus,
  teamVon,
  umbenennen,
  verschieben,
  wiederherstellen,
} from './einrichten';
import {
  feldEntfernen,
  feldSpeichern,
  felderAnlegen,
  feldEinordnen,
  feldTypAendern,
} from './formularFelder';
import type { Feld } from '@shared/anmeldung/formular';
import { EMPFOHLEN } from '@shared/anmeldung/baukasten';
import { LOGO_KENNUNG } from '@shared/anmeldung/uebersicht';

/**
 * Anlegen und Einrichten (A3, #486) gegen eine nachgestellte ChurchTools-Instanz, die sich merkt, was
 * geschrieben wurde – so verhalten wie gemessen: flache Felder in `PATCH /groups`, verschachtelte still
 * ignoriert, Kopie mit NEUEN Feldnummern. `schlucken` lässt ChurchTools „200“ sagen und nichts speichern.
 */
interface G {
  id: number;
  name: string;
  parent: number;
  typ: number;
  status: number;
  note: string;
  settings: Record<string, unknown>;
  felder: { id: number; name: string; note?: string | null; [k: string]: unknown }[];
  bild?: string;
  eltern: number[];
}

let gruppen: Map<number, G>;
let naechste: number;
let schlucken: Set<string>;
/** Neue Spalten: liefert `true` → ChurchTools legt sie mit anderem Namen an (nicht übernommen, A6-2b). */
let schluckeNach: (() => boolean) | null = null;
let termine: Map<number, Record<string, unknown>>;
let aufrufe: string[];
/** Mitglieder je Gruppe; `403`/`502` = so antwortet ChurchTools auf `/members`. */
interface Mitglied {
  groupMemberStatus: string;
  personId?: number;
  groupTypeRoleId?: number;
  person?: { domainAttributes?: { firstName?: string; lastName?: string } };
  fields?: { id: number; value: unknown }[];
}
let mitglieder: Map<number, Mitglied[] | 403 | 502>;
/** Wie ChurchTools: Antwortmöglichkeiten ohne ID bekommen eine neue (gemessen A5). */
let naechsteOption = 1;
const mitIds = (o: unknown) =>
  Array.isArray(o)
    ? (o as { id?: string; name: string }[]).map((x) => ({
        id: x.id ?? String(naechsteOption++),
        name: x.name,
      }))
    : o;

function json(status: number, body: unknown): Response {
  return new Response(status === 204 ? null : JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function ct() {
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
    const url = new URL(String(input));
    const pfad = url.pathname.replace(/^\/api/, '');
    const m = (init?.method ?? 'GET').toUpperCase();
    const body =
      typeof init?.body === 'string' ? (JSON.parse(init.body) as Record<string, unknown>) : {};
    aufrufe.push(`${m} ${pfad}${'note' in body ? ' [note]' : ''}`);
    if (pfad === '/csrftoken') return json(200, { data: 't' });
    if (m === 'GET' && pfad === '/group/grouptypes')
      return json(200, {
        data: [
          { id: 2, name: 'Dienst' },
          { id: 5, name: 'Anmeldung' },
        ],
      });
    if (m === 'GET' && pfad === '/permissions/global')
      return json(200, { data: { churchdb: {}, churchcal: { 'edit category': [1] } } });
    let r = /^\/permissions\/internal\/groups\/(\d+)$/.exec(pfad);
    if (r) return json(200, { data: { churchdb: { '+create group': r[1] === '7' ? [5] : 0 } } });
    if (m === 'GET' && pfad === '/calendars')
      return json(200, {
        data: [
          { id: 2, name: 'Gottesdienst' },
          { id: 1, name: 'Sonstige Veranstaltung' },
        ],
      });
    if (m === 'POST' && pfad === '/groups') {
      const id = naechste++;
      gruppen.set(id, {
        id,
        name: String(body.name),
        parent: Number(body.parentGroupId),
        typ: Number(body.groupTypeId),
        status: Number(body.groupStatusId),
        note: '',
        settings: {},
        felder: [],
        eltern: [Number(body.parentGroupId)],
      });
      return json(201, { data: { id } });
    }
    r = /^\/groups\/(\d+)\/duplicate$/.exec(pfad);
    if (r && m === 'POST') {
      const q = gruppen.get(Number(r[1]))!;
      const id = naechste++;
      gruppen.set(id, {
        ...q,
        id,
        name: String(body.newName),
        status: 2,
        settings: { ...q.settings },
        felder: q.felder.map((f) => ({ ...f, id: f.id + 1000 })),
      });
      return json(201, { data: { id } });
    }
    if (m === 'GET' && pfad === '/groups' && url.searchParams.has('group_status_ids[]')) {
      const st = Number(url.searchParams.get('group_status_ids[]'));
      const typ = Number(url.searchParams.get('group_type_ids[]'));
      const data = [...gruppen.values()]
        .filter((g) => g.status === st && g.typ === typ)
        .map((g) => ({
          id: g.id,
          name: g.name,
          information: { note: g.note, groupStatusId: g.status, imageUrl: g.bild ?? null },
        }));
      return json(200, { data, meta: { pagination: { lastPage: 1 } } });
    }
    r = /^\/groups\/(\d+)\/parents(?:\/(\d+))?$/.exec(pfad);
    if (r) {
      const g = gruppen.get(Number(r[1]))!;
      const p = Number(r[2]);
      if (m === 'PUT') g.eltern = [...g.eltern, p];
      if (m === 'DELETE') g.eltern = g.eltern.filter((x) => x !== p);
      if (m !== 'GET') return json(m === 'PUT' ? 201 : 204, {});
      return json(200, {
        data: g.eltern.map((x) => ({
          title: x === 7 ? 'Technik' : `Team ${x}`,
          domainIdentifier: String(x),
        })),
      });
    }
    if (m === 'GET' && pfad === '/group/roles')
      return json(200, {
        data: [
          { id: 32, groupTypeId: 5, type: 'participant' },
          { id: 35, groupTypeId: 5, type: 'leader', isLeader: true },
        ],
      });
    r = /^\/groups\/(\d+)\/members\/(\d+)$/.exec(pfad);
    if (r && m === 'PUT') {
      const gid = Number(r[1]);
      const liste = mitglieder.get(gid);
      const alt = Array.isArray(liste) ? liste : [];
      const neu = {
        personId: Number(r[2]),
        groupTypeRoleId: Number(body.groupTypeRoleId),
        groupMemberStatus: String(body.groupMemberStatus),
        person: { domainAttributes: { firstName: `P${r[2]}`, lastName: 'Test' } },
      };
      if (!schlucken.has('LEITUNG'))
        mitglieder.set(gid, [...alt.filter((x) => x.personId !== neu.personId), neu]);
      return json(200, { data: neu });
    }
    r = /^\/publicgroups\/(\d+)$/.exec(pfad);
    if (r && m === 'GET') {
      const g = gruppen.get(Number(r[1]));
      if (!g || g.settings.visibility !== 'public' || g.status !== 1) return json(403, {});
      const liste = mitglieder.get(g.id);
      const nm = (g.settings.newMember ?? {}) as Record<string, unknown>;
      return json(200, {
        data: {
          signUpConditions: {
            groupIsActive: true,
            groupHasLeader: Array.isArray(liste) && liste.some((x) => x.groupTypeRoleId === 35),
            newPersonStatusIsSet: typeof nm.statusId === 'number',
            newPersonStationIsSet: typeof nm.campusId === 'number',
            newPersonDepartmentIsSet: typeof nm.departmentId === 'number',
            canSignUp: false,
          },
        },
      });
    }
    r = /^\/groups\/(\d+)\/members$/.exec(pfad);
    if (r) {
      const m = mitglieder.get(Number(r[1])) ?? [];
      if (typeof m === 'number') return json(m, { message: 'nein' });
      return json(200, { data: m, meta: { pagination: { lastPage: 1 } } });
    }
    r = /^\/files\/groupimage\/(\d+)$/.exec(pfad);
    if (r) {
      const g = gruppen.get(Number(r[1]))!;
      if (m === 'DELETE') g.bild = undefined;
      else if (!schlucken.has('BILD')) g.bild = 'https://ct.test/images/1/abc';
      return json(m === 'DELETE' ? 204 : 200, { data: [{ imageUrl: g.bild }] });
    }
    r = /^\/groups\/(\d+)\/memberfields\/group\/(\d+)$/.exec(pfad);
    if (r) {
      const g = gruppen.get(Number(r[1]))!;
      const f = g.felder.find((x) => x.id === Number(r![2]));
      if (!f) return json(404, {});
      if (m === 'DELETE') {
        g.felder = g.felder.filter((x) => x !== f);
        return json(204, {});
      }
      if (!schlucken.has('FELD'))
        Object.assign(f, body, 'options' in body ? { options: mitIds(body.options) } : {});
      return json(200, { data: f });
    }
    r = /^\/groups\/(\d+)\/memberfields\/group$/.exec(pfad);
    if (r && m === 'POST') {
      const g = gruppen.get(Number(r[1]))!;
      const id = naechste++;
      g.felder.push({
        ...body,
        id,
        name: schluckeNach?.() ? 'etwas anderes' : String(body.name),
        note: null,
        options: mitIds(body.options),
      });
      return json(201, { data: { id } });
    }
    r = /^\/groups\/(\d+)\/memberfields$/.exec(pfad);
    if (r) {
      const g = gruppen.get(Number(r[1]))!;
      return json(200, { data: g.felder.map((f) => ({ type: 'group', field: f })) });
    }
    r = /^\/groups\/(\d+)$/.exec(pfad);
    if (r) {
      const g = gruppen.get(Number(r[1]));
      if (!g) return json(404, {});
      if (m === 'DELETE') {
        if (!schlucken.has('DELETE')) gruppen.delete(g.id);
        return json(204, {});
      }
      if (m === 'PATCH' && !schlucken.has('PATCH')) {
        for (const [k, v] of Object.entries(body)) {
          if (k === 'note') g.note = String(v);
          else if (k === 'name') g.name = String(v);
          else if (k === 'groupStatusId') g.status = Number(v);
          else if (k === 'visibility' && schlucken.has('SICHTBAR')) continue;
          // Gemessen 14.10.2026: verschachtelt still ignoriert, flach gespeichert (unter `newMember`).
          else if (k === 'newMember') continue;
          else if (/^newPerson(Status|Campus|Department)Id$/.test(k)) {
            if (schlucken.has('VORGABEN')) continue;
            const feld = {
              newPersonStatusId: 'statusId',
              newPersonCampusId: 'campusId',
              newPersonDepartmentId: 'departmentId',
            }[k]!;
            g.settings.newMember = { ...(g.settings.newMember as object), [feld]: v };
          } else if (k !== 'information') g.settings[k] = v; // verschachtelt: still ignoriert (gemessen)
        }
      }
      return json(200, {
        data: {
          id: g.id,
          name: g.name,
          information: {
            note: g.note,
            groupStatusId: g.status,
            groupTypeId: g.typ,
            imageUrl: g.bild ?? '',
          },
          settings: g.settings,
        },
      });
    }
    r = /^\/calendars\/(\d+)\/appointments$/.exec(pfad);
    if (r && m === 'POST') {
      const id = naechste++;
      termine.set(
        id,
        schlucken.has('TERMIN') ? { ...body, startDate: '2000-01-01T00:00:00Z' } : body,
      );
      return json(201, { data: { id } });
    }
    r = /^\/calendars\/(\d+)\/appointments\/(\d+)$/.exec(pfad);
    if (r)
      return json(200, {
        data: { appointment: { base: { id: Number(r[2]), ...termine.get(Number(r[2])) } } },
      });
    return json(404, { message: `nicht nachgestellt: ${m} ${pfad}` });
  });
}

beforeEach(() => {
  _vergissCsrf();
  _bremseLoesen();
  gruppen = new Map();
  naechste = 100;
  schlucken = new Set();
  schluckeNach = null;
  termine = new Map();
  aufrufe = [];
  mitglieder = new Map();
  naechsteOption = 1;
  vi.stubGlobal('window', {
    settings: { base_url: 'https://ct.test/' },
    location: { origin: 'https://ct.test' },
  });
  ct();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

/** Text, der sich kaum packen lässt (Zufall mit festem Startwert) – für „zu lang“ trotz Packen. */
function unpackbar(n: number, start: number): string {
  let x = start + 1;
  let t = '';
  while (t.length < n) {
    x = (x * 1103515245 + 12345) % 2147483648;
    t += String.fromCharCode(33 + (x % 90));
  }
  return t;
}

describe('legeVeranstaltungAn', () => {
  it('Entwurf vom Typ „Anmeldung“ unter dem Team, mit Systemfeldern und deren Nummern', async () => {
    const id = await legeVeranstaltungAn({
      name: 'Gemeindeessen',
      teamId: 7,
      artId: 5,
      vorlage: 'kinder',
    });
    const g = gruppen.get(id)!;
    expect(g).toMatchObject({ parent: 7, typ: 5, status: 2 });
    expect(g.settings.emailVerificationMode).toBe('existing');
    const e = einstellungenLesen(g.note)!;
    expect(e.wer).toBe('kinder');
    // Gegen die Liste selbst – jedes Systemfeld wird angelegt, auch „Angemeldet von“ (A6-2).
    expect(Object.keys(e.ctFelder).sort()).toEqual(SYSTEMFELDER.map((f) => f.id).sort());
    expect(g.felder.find((f) => f.id === e.ctFelder.bezahlt)?.name).toBe('Bezahlt');
  });

  it('die Beschreibung steht VOR den Feldern – sonst bliebe bei einem Fehler eine unsichtbare Gruppe', async () => {
    await legeVeranstaltungAn({ name: 'X', teamId: 7, artId: 5, vorlage: 'einfach' });
    // Gemeint ist die BESCHREIBUNG – ein anderes PATCH (Anmeldemodus) davor genügt nicht.
    const ersteBeschreibung = aufrufe.findIndex(
      (a) => a.startsWith('PATCH /groups/') && a.endsWith('[note]'),
    );
    const erstesFeld = aufrufe.findIndex((a) => a.includes('/memberfields/group'));
    expect(ersteBeschreibung).toBeGreaterThan(-1);
    expect(ersteBeschreibung).toBeLessThan(erstesFeld);
  });

  it('ChurchTools sagt „200“, speichert aber nicht → Fehler statt „angelegt“', async () => {
    schlucken.add('PATCH');
    await expect(
      legeVeranstaltungAn({ name: 'X', teamId: 7, artId: 5, vorlage: 'einfach' }),
    ).rejects.toBeInstanceOf(NichtUebernommen);
  });
});

describe('kopiereVeranstaltung', () => {
  it('Kopie: Feldnummern neu zugeordnet, Termin geleert, Entwurf', async () => {
    const quelle = await legeVeranstaltungAn({
      name: 'Essen 2026',
      teamId: 7,
      artId: 5,
      vorlage: 'einfach',
    });
    const g = gruppen.get(quelle)!;
    const e = einstellungenLesen(g.note)!;
    await aendereEinstellungen(quelle, (x) => ({
      ...x,
      termin: { beginn: '2026-11-15T12:00', ende: null, ort: 'Saal', terminId: 5 },
    }));
    expect(einstellungenLesen(g.note)?.termin).not.toBeNull();
    const kopie = await kopiereVeranstaltung(quelle, 'Essen 2027');
    const k = einstellungenLesen(gruppen.get(kopie)!.note)!;
    expect(k.termin).toBeNull();
    expect(k.ctFelder.bezahlt).toBe(e.ctFelder.bezahlt + 1000);
    expect(gruppen.get(kopie)!.status).toBe(2);
  });
});

describe('Einrichten', () => {
  it('Zeitraum, Plätze, Warteliste flach geschickt und nachgelesen', async () => {
    const id = await legeVeranstaltungAn({ name: 'X', teamId: 7, artId: 5, vorlage: 'einfach' });
    await speichereAnmeldung(id, {
      maxPlaetze: 30,
      warteliste: true,
      ab: '2026-10-20T00:00:00Z',
      bis: null,
    });
    expect(gruppen.get(id)!.settings).toMatchObject({
      maxMembers: 30,
      allowWaitinglist: true,
      signUpOpeningDate: '2026-10-20T00:00:00Z',
    });
  });
  it('nicht übernommen → Fehler', async () => {
    const id = await legeVeranstaltungAn({ name: 'X', teamId: 7, artId: 5, vorlage: 'einfach' });
    schlucken.add('PATCH');
    await expect(
      speichereAnmeldung(id, { maxPlaetze: 30, warteliste: true, ab: null, bis: null }),
    ).rejects.toBeInstanceOf(NichtUebernommen);
    await expect(freigeben(id)).rejects.toBeInstanceOf(NichtUebernommen);
  });
  it('freigeben: Status 1, nachgelesen', async () => {
    const id = await legeVeranstaltungAn({ name: 'X', teamId: 7, artId: 5, vorlage: 'einfach' });
    await freigeben(id);
    expect(gruppen.get(id)!.status).toBe(1);
  });
});

describe('Rechte und Kalender', () => {
  it('anlegen nur unter Teams mit „Anmeldung“ in +create group', async () => {
    expect(await anlegenMoeglich([9, 7])).toEqual({ artId: 5, teamIds: [7] });
  });
  it('Kalender: alle sichtbar, schreiben nur mit edit category; nach Namen sortiert', async () => {
    expect(await kalenderListe()).toEqual([
      { id: 2, name: 'Gottesdienst', schreiben: false },
      { id: 1, name: 'Sonstige Veranstaltung', schreiben: true },
    ]);
  });
  it('neuer Termin: Ortszeit → UTC, mit Link zur Anmeldung, nachgelesen', async () => {
    const t = await legeTerminAn({
      kalenderId: 1,
      titel: 'Gemeindeessen',
      beginn: '2026-11-15T12:00',
      ende: '2026-11-15T14:00',
      ort: 'Saal',
      link: 'https://anmeldung.beispiel.de/#ct.test/91',
      zeitzone: 'Europe/Berlin',
    });
    expect(t.startDate).toBe('2026-11-15T11:00:00Z');
    expect(termine.get(t.id)).toMatchObject({
      link: 'https://anmeldung.beispiel.de/#ct.test/91',
      address: { meetingAt: 'Saal' },
      isInternal: false,
    });
  });
  it('Termin angelegt, aber anders gespeichert → Fehler', async () => {
    schlucken.add('TERMIN');
    await expect(
      legeTerminAn({
        kalenderId: 1,
        titel: 'X',
        beginn: '2026-11-15T12:00',
        ende: '2026-11-15T14:00',
        ort: '',
        link: null,
        zeitzone: 'Europe/Berlin',
      }),
    ).rejects.toBeInstanceOf(NichtUebernommen);
  });
});

describe('Preise und Bezahlung (A4)', () => {
  const zimmer = (belegt4: number) => ({
    art: 'auswahl' as const,
    betragCent: 0,
    gilt: 'person' as const,
    auswahlName: 'Zimmer',
    optionen: [
      { name: '4-Bett', preisCent: 6552, kontingent: 8, belegt: belegt4 },
      { name: '2-Bett', preisCent: 8900, kontingent: 4, belegt: 2 },
    ],
  });

  it('neue Veranstaltung: Verwendungszweck mit ihrem Namen, noch ohne Konto', async () => {
    const id = await legeVeranstaltungAn({
      name: 'Gemeindeessen',
      teamId: 7,
      artId: 5,
      vorlage: 'einfach',
    });
    const b = einstellungenLesen(gruppen.get(id)!.note)!.bezahlung;
    expect(b.zweck).toBe('Gemeindeessen [Nachname]');
    expect(b.iban).toBe('');
  });

  it('Preise ändern: auf die FRISCH gelesenen Preise, „belegt“ bleibt (über den Namen), nachgelesen', async () => {
    const id = await legeVeranstaltungAn({ name: 'X', teamId: 7, artId: 5, vorlage: 'freizeit' });
    await aendereEinstellungen(id, (e) => ({ ...e, preis: { ...e.preis, grundpreis: zimmer(5) } }));
    // Inzwischen hat jemand anderes ein Extra gespeichert – das Fenster weiß davon nichts.
    await aendereEinstellungen(id, (e) => ({
      ...e,
      preis: {
        ...e.preis,
        extras: [{ bezeichnung: 'Bettwäsche', preisCent: 800, gilt: 'person' }],
      },
    }));
    // Das Fenster ändert den Preis und dreht die Reihenfolge der Optionen um; „belegt“ kennt es nicht (0).
    await aenderePreise(id, (p) => ({
      ...p,
      grundpreis: {
        ...p.grundpreis,
        optionen: [
          { name: '2-Bett', preisCent: 9000, kontingent: 4, belegt: 0 },
          { name: '4-Bett', preisCent: 6552, kontingent: 8, belegt: 0 },
          { name: 'Neu', preisCent: 5000, kontingent: 0, belegt: 0 },
        ],
      },
    }));
    const p = einstellungenLesen(gruppen.get(id)!.note)!.preis;
    expect(p.grundpreis.optionen.map((o) => [o.name, o.preisCent, o.belegt])).toEqual([
      ['2-Bett', 9000, 2],
      ['4-Bett', 6552, 5],
      ['Neu', 5000, 0],
    ]);
    expect(p.extras).toHaveLength(1);
  });

  it('ungültige Preise → Meldung von pruefeRegeln, und es wird NICHTS geschrieben', async () => {
    const id = await legeVeranstaltungAn({ name: 'X', teamId: 7, artId: 5, vorlage: 'einfach' });
    const vorher = gruppen.get(id)!.note;
    const patchVorher = aufrufe.filter((a) => a.startsWith('PATCH')).length;
    const fehler = await aenderePreise(id, (p) => ({
      ...p,
      alter: [
        { von: 0, bis: 5, art: 'frei', wert: 0 },
        { von: 3, bis: 11, art: 'prozent', wert: 50 },
      ],
    })).catch((e: unknown) => e);
    expect(fehler).toBeInstanceOf(ApiError);
    expect((fehler as ApiError).status).toBe(422);
    expect((fehler as ApiError).message).toContain('überschneiden');
    expect(gruppen.get(id)!.note).toBe(vorher);
    expect(aufrufe.filter((a) => a.startsWith('PATCH')).length).toBe(patchVorher);
  });

  it('Bezahlung: IBAN ohne Leerzeichen gespeichert; falsche IBAN wird nicht geschrieben', async () => {
    const id = await legeVeranstaltungAn({ name: 'X', teamId: 7, artId: 5, vorlage: 'einfach' });
    const b = {
      kontoinhaber: ' Gemeinde e.V. ',
      iban: 'de89 3704 0044 0532 0130 00',
      bic: 'cobadeff',
      fristTage: 10,
      zweck: ' X [Nachname] ',
    };
    await speichereBezahlung(id, b);
    expect(einstellungenLesen(gruppen.get(id)!.note)!.bezahlung).toEqual({
      kontoinhaber: 'Gemeinde e.V.',
      iban: 'DE89370400440532013000',
      bic: 'COBADEFF',
      fristTage: 10,
      zweck: 'X [Nachname]',
    });
    const vorher = gruppen.get(id)!.note;
    await expect(
      speichereBezahlung(id, { ...b, iban: 'DE89370400440532013001' }),
    ).rejects.toMatchObject({ status: 422 });
    expect(gruppen.get(id)!.note).toBe(vorher);
  });

  it('zu lange Einstellungen → sagt das (413), nicht „ChurchTools antwortet gerade nicht“', async () => {
    const id = await legeVeranstaltungAn({ name: 'X', teamId: 7, artId: 5, vorlage: 'einfach' });
    const lang = standardFormular();
    lang.person.push(
      ...Array.from({ length: 20 }, (_, i) => ({
        id: `l${i}`,
        art: 'eigen' as const,
        typ: 'textarea' as const,
        frage: `Frage ${i}`,
        // Ungleichmäßiger Text – gleichförmiger würde sich so gut packen, dass er hineinpasst (A5).
        hilfe: unpackbar(390, i),
        zustand: 'freiwillig' as const,
        antworten: [],
      })),
    );
    const e = await aendereEinstellungen(id, (x) => ({ ...x, formular: lang })).catch(
      (err: unknown) => err,
    );
    expect(e).toBeInstanceOf(ApiError);
    expect((e as ApiError).status).toBe(413);
    expect((e as ApiError).message).toContain('erlaubt sind 5000');
    // Und eine ungültige Angabe (zu langer Name eines Extras) → 422 mit eigener Meldung.
    const z = await aendereEinstellungen(id, (x) => ({
      ...x,
      preis: {
        ...x.preis,
        extras: [{ bezeichnung: 'x'.repeat(81), preisCent: 0, gilt: 'person' }],
      },
    })).catch((err: unknown) => err);
    expect((z as ApiError).status).toBe(422);
  });

  it('Zahl der Anmeldungen: angemeldet + Warteliste; 403 → unbekannt; 502 → Fehler (vorübergehend)', async () => {
    mitglieder.set(91, [
      { groupMemberStatus: 'active' },
      { groupMemberStatus: 'active' },
      { groupMemberStatus: 'waiting' },
      { groupMemberStatus: 'to_delete' },
    ]);
    expect(await anmeldungenZahl(91)).toBe(3);
    expect(await anmeldungenZahl(92)).toBe(0);
    mitglieder.set(93, 403);
    expect(await anmeldungenZahl(93)).toBeNull();
    mitglieder.set(94, 502);
    await expect(anmeldungenZahl(94)).rejects.toBeInstanceOf(ApiError);
  });
});

describe('Freigeben macht die Anmeldung für Gäste lesbar (A6-1, #542)', () => {
  it('freigeben setzt visibility public – auch über setzeStatus (Verwalten, Rückgängig); Entwurf fasst sie nicht an', async () => {
    const id = await legeVeranstaltungAn({ name: 'X', teamId: 7, artId: 5, vorlage: 'einfach' });
    expect(gruppen.get(id)!.settings.visibility).toBeUndefined();
    await freigeben(id);
    expect(gruppen.get(id)!.settings.visibility).toBe('public');
    gruppen.get(id)!.settings.visibility = 'restricted';
    await setzeStatus(id, STATUS.entwurf);
    expect(gruppen.get(id)!.settings.visibility).toBe('restricted');
    await setzeStatus(id, STATUS.freigegeben);
    expect(gruppen.get(id)!.settings.visibility).toBe('public');
  });
  it('übernimmt ChurchTools die Sichtbarkeit nicht, sagt es das (statt „freigegeben“ zu melden)', async () => {
    const id = await legeVeranstaltungAn({ name: 'X', teamId: 7, artId: 5, vorlage: 'einfach' });
    schlucken.add('SICHTBAR');
    await expect(freigeben(id)).rejects.toMatchObject({
      message: expect.stringMatching(/Freigabe für Gäste/),
    });
  });
});

describe('Verwalten (A4-Nachtrag)', () => {
  const neu = () => legeVeranstaltungAn({ name: 'Essen', teamId: 7, artId: 5, vorlage: 'einfach' });

  it('umbenennen: getrimmt und nachgelesen; leer → abgelehnt; nicht übernommen → Fehler', async () => {
    const id = await neu();
    await umbenennen(id, '  Gemeindeessen  ');
    expect(gruppen.get(id)!.name).toBe('Gemeindeessen');
    await expect(umbenennen(id, '  ')).rejects.toMatchObject({ status: 422 });
    schlucken.add('PATCH');
    await expect(umbenennen(id, 'Anders')).rejects.toBeInstanceOf(NichtUebernommen);
  });

  it('Status: freigeben, zurück zum Entwurf, archivieren – jeweils nachgelesen', async () => {
    const id = await neu();
    for (const st of [STATUS.freigegeben, STATUS.entwurf, STATUS.archiviert]) {
      await setzeStatus(id, st);
      expect(gruppen.get(id)!.status).toBe(st);
    }
    schlucken.add('PATCH');
    await expect(setzeStatus(id, STATUS.entwurf)).rejects.toThrow('den Entwurf-Status');
  });

  it('verschieben: erst das neue Team dazu, dann das alte weg – nie ohne Team', async () => {
    const id = await neu();
    await verschieben(id, 7, 9);
    const schritte = aufrufe.filter((a) => a.includes('/parents/'));
    expect(schritte).toEqual([`PUT /groups/${id}/parents/9`, `DELETE /groups/${id}/parents/7`]);
    expect(gruppen.get(id)!.eltern).toEqual([9]);
    expect(await teamVon(id)).toEqual({ id: 9, name: 'Team 9' });
  });

  it('Archiv: nur archivierte Veranstaltungen (Art „Anmeldung“, mit Einstellungen), nach Namen', async () => {
    const a = await legeVeranstaltungAn({
      name: 'Zelten',
      teamId: 7,
      artId: 5,
      vorlage: 'einfach',
    });
    const b = await legeVeranstaltungAn({
      name: 'Ausflug',
      teamId: 7,
      artId: 5,
      vorlage: 'einfach',
    });
    await neu(); // bleibt Entwurf
    await setzeStatus(a, STATUS.archiviert);
    await setzeStatus(b, STATUS.archiviert);
    gruppen.get(b)!.note = 'irgendeine Beschreibung'; // keine Einstellungen → keine Veranstaltung
    const c = await legeVeranstaltungAn({ name: 'Basar', teamId: 7, artId: 5, vorlage: 'einfach' });
    await setzeStatus(c, STATUS.archiviert);
    expect((await archivListe(5)).map((x) => [x.name, x.team])).toEqual([
      ['Basar', 'Technik'],
      ['Zelten', 'Technik'],
    ]);
  });

  it('endgültig löschen: nur aus dem Archiv; danach muss die Gruppe weg sein', async () => {
    const id = await neu();
    await expect(loeschenEndgueltig(id)).rejects.toMatchObject({ status: 409 });
    expect(gruppen.has(id)).toBe(true);
    await setzeStatus(id, STATUS.archiviert);
    schlucken.add('DELETE');
    await expect(loeschenEndgueltig(id)).rejects.toBeInstanceOf(NichtUebernommen);
    schlucken.delete('DELETE');
    await loeschenEndgueltig(id);
    expect(gruppen.has(id)).toBe(false);
  });

  it('wiederherstellen: schreibt Name, Einstellungen, Plätze und Status zurück – nur was sich unterscheidet', async () => {
    const id = await neu();
    const vorher = {
      name: gruppen.get(id)!.name,
      statusId: gruppen.get(id)!.status,
      einstellungen: einstellungenLesen(gruppen.get(id)!.note)!,
      anmeldung: { maxPlaetze: null, warteliste: false, ab: null, bis: null },
    };
    await umbenennen(id, 'Anders');
    await aenderePreise(id, (p) => ({
      ...p,
      extras: [{ bezeichnung: 'Kaffee', preisCent: 200, gilt: 'person' }],
    }));
    await speichereAnmeldung(id, { maxPlaetze: 30, warteliste: true, ab: null, bis: null });
    await setzeStatus(id, STATUS.archiviert);
    aufrufe = [];
    await wiederherstellen(id, vorher);
    const g = gruppen.get(id)!;
    expect(g.name).toBe('Essen');
    expect(g.status).toBe(STATUS.entwurf);
    expect(einstellungenLesen(g.note)!.preis.extras).toEqual([]);
    expect(g.settings).toMatchObject({ maxMembers: null, allowWaitinglist: false });
    // Und ein zweites Mal: alles gleich → kein Schreibaufruf mehr.
    aufrufe = [];
    await wiederherstellen(id, vorher);
    expect(aufrufe.filter((a) => !a.startsWith('GET'))).toEqual([]);
  });

  it('Verwendungszweck folgt dem Namen: beim Kopieren und beim Umbenennen (und zurück)', async () => {
    const quelle = await legeVeranstaltungAn({
      name: 'Freizeit 2026',
      teamId: 7,
      artId: 5,
      vorlage: 'freizeit',
    });
    const kopie = await kopiereVeranstaltung(quelle, 'Freizeit 2027');
    expect(einstellungenLesen(gruppen.get(kopie)!.note)!.bezahlung.zweck).toBe(
      'Freizeit 2027 [Nachname]',
    );
    await umbenennen(kopie, 'Sommerfreizeit 2027');
    expect(einstellungenLesen(gruppen.get(kopie)!.note)!.bezahlung.zweck).toBe(
      'Sommerfreizeit 2027 [Nachname]',
    );
    await umbenennen(kopie, 'Freizeit 2027');
    expect(einstellungenLesen(gruppen.get(kopie)!.note)!.bezahlung.zweck).toBe(
      'Freizeit 2027 [Nachname]',
    );
    // Die Quelle bleibt, wie sie war.
    expect(einstellungenLesen(gruppen.get(quelle)!.note)!.bezahlung.zweck).toBe(
      'Freizeit 2026 [Nachname]',
    );
  });
});

describe('Speicherformat: unsichtbar, gesichert, repariert (A5)', () => {
  const neu = () =>
    legeVeranstaltungAn({ name: 'Essen', teamId: 7, artId: 5, vorlage: 'freizeit' });
  const notizen = (id: number) => gruppen.get(id)!.felder.map((f) => f.note);

  it('in „Infos“ steht nur der Hinweissatz; die Sicherung steht in den Systemfeldern', async () => {
    const id = await neu();
    const g = gruppen.get(id)!;
    expect(g.note.split('\n')[0]).toBe(HINWEIS_SATZ);
    expect(sicherungLesen(notizen(id))).toEqual(einstellungenLesen(g.note));
  });

  it('jemand bearbeitet die Beschreibung in ChurchTools → beim Öffnen aus der Sicherung repariert, sein Text bleibt', async () => {
    const id = await neu();
    const vorher = einstellungenLesen(gruppen.get(id)!.note);
    gruppen.get(id)!.note = 'Treffpunkt ist der Parkplatz.'; // so speichert der ChurchTools-Editor
    expect(await einstellungenVon(id)).toEqual(vorher);
    const g = gruppen.get(id)!;
    expect(g.note.startsWith('Treffpunkt ist der Parkplatz.\n\n[anmeldung]: #v2:')).toBe(true);
    expect(einstellungenLesen(g.note)).toEqual(vorher);
  });

  it('ohne Sicherung lässt sich nichts reparieren → „lassen sich nicht lesen“', async () => {
    const id = await neu();
    gruppen.get(id)!.note = 'überschrieben';
    for (const f of gruppen.get(id)!.felder) f.note = null;
    await expect(einstellungenVon(id)).rejects.toMatchObject({ status: 422 });
  });

  it('altes, sichtbares Format → beim Öffnen gleich ins neue umgestellt', async () => {
    const id = await neu();
    const e = einstellungenLesen(gruppen.get(id)!.note)!;
    gruppen.get(id)!.note = EINSTELLUNGEN_KENNUNG + JSON.stringify(e);
    expect(await einstellungenVon(id)).toEqual(e);
    expect(gruppen.get(id)!.note.split('\n')[0]).toBe(HINWEIS_SATZ);
  });

  it('nimmt ChurchTools die Sicherung nicht an → Fehler statt „gespeichert“', async () => {
    const id = await neu();
    schlucken.add('FELD');
    await expect(aendereEinstellungen(id, (e) => ({ ...e, loeschfristMonate: 7 }))).rejects.toThrow(
      'die Sicherung der Einstellungen',
    );
  });
});

describe('Formularfelder in ChurchTools (A5)', () => {
  const neu = () => legeVeranstaltungAn({ name: 'Essen', teamId: 7, artId: 5, vorlage: 'einfach' });
  const feld = (extra: Partial<Feld> = {}): Feld => ({
    id: 'f1',
    art: 'eigen',
    typ: 'select',
    frage: 'T-Shirt-Größe',
    hilfe: '',
    zustand: 'freiwillig',
    antworten: ['S', 'M', 'L'],
    ...extra,
  });
  const ctFeld = (id: number, feldId: string) => {
    const e = einstellungenLesen(gruppen.get(id)!.note)!;
    return gruppen.get(id)!.felder.find((f) => f.id === e.ctFelder[feldId])!;
  };

  it('Vorlage anlegen: Telefon, Bemerkungen, Allergien werden Spalten – Stufe 3, Pflicht wie im Formular', async () => {
    const id = await legeVeranstaltungAn({
      name: 'Kindertag',
      teamId: 7,
      artId: 5,
      vorlage: 'kinder',
    });
    await felderAnlegen(id);
    const tel = ctFeld(id, 'tel');
    expect(tel).toMatchObject({
      name: 'Telefon',
      securityLevel: 3,
      requiredInRegistrationForm: true,
    });
    expect(ctFeld(id, 'allergy')).toMatchObject({ useInRegistrationForm: true, securityLevel: 3 });
    // Name, E-Mail, Geburtsdatum stehen an der Person – keine Spalte.
    const e = einstellungenLesen(gruppen.get(id)!.note)!;
    expect(e.ctFelder.name ?? e.ctFelder.mail ?? e.ctFelder.birth).toBeUndefined();
    // Zweimal aufrufen legt nichts doppelt an.
    const anzahl = gruppen.get(id)!.felder.length;
    aufrufe = [];
    await felderAnlegen(id);
    expect(gruppen.get(id)!.felder).toHaveLength(anzahl);
    // … und rührt vorhandene Spalten nicht an (kein Schreibaufruf an den Feldern).
    expect(aufrufe.filter((a) => !a.startsWith('GET') && a.includes('/memberfields'))).toEqual([]);
  });

  it('A6-2b Kinder-Vorlage: Erziehungsberechtigte (lesbar) und Unterschrift in zwei Spalten, beide Pflicht', async () => {
    const id = await legeVeranstaltungAn({
      name: 'Kindertag',
      teamId: 7,
      artId: 5,
      vorlage: 'kinder',
    });
    await felderAnlegen(id);
    expect(ctFeld(id, 'eltern')).toMatchObject({
      name: 'Erziehungsberechtigte',
      fieldTypeCode: 'textarea',
      requiredInRegistrationForm: true,
    });
    expect(ctFeld(id, 'sign')).toMatchObject({
      name: 'Unterschrift',
      fieldTypeCode: 'text',
      requiredInRegistrationForm: true,
    });
    expect(ctFeld(id, 'sign.daten')).toMatchObject({
      name: 'Unterschrift (Daten)',
      fieldTypeCode: 'textarea',
      useInRegistrationForm: true,
      requiredInRegistrationForm: true,
      securityLevel: 3,
    });
    // Ausschalten nimmt beide Spalten aus dem Anmeldeformular – die Spalten (und Antworten) bleiben.
    await feldEntfernen(id, 'sign');
    expect(ctFeld(id, 'sign').useInRegistrationForm).toBe(false);
    expect(ctFeld(id, 'sign.daten').useInRegistrationForm).toBe(false);
  });

  it('A6-2b: nimmt ChurchTools die Spalte für die Striche nicht an → Fehler, Einstellungen unverändert', async () => {
    const id = await neu();
    const sign = EMPFOHLEN.find((x) => x.id === 'sign')!.feld;
    const vorher = gruppen.get(id)!.note;
    let n = 0;
    // Die erste Spalte (lesbar) geht durch, die zweite (Striche) wird still geschluckt.
    schluckeNach = () => ++n > 1;
    await expect(feldSpeichern(id, 'anmeldung', sign)).rejects.toBeInstanceOf(NichtUebernommen);
    schluckeNach = null;
    expect(gruppen.get(id)!.note).toBe(vorher);
  });

  it('neue Frage: Spalte mit Antworten angelegt, ins Formular vor die Bemerkungen', async () => {
    const id = await neu();
    const e = await feldSpeichern(id, 'anmeldung', feld());
    expect(ctFeld(id, 'f1')).toMatchObject({ name: 'T-Shirt-Größe', fieldTypeCode: 'select' });
    expect((ctFeld(id, 'f1').options as { name: string }[]).map((o) => o.name)).toEqual([
      'S',
      'M',
      'L',
    ]);
    const ids = e.formular.anmeldung.map((f) => f.id);
    expect(ids.indexOf('f1')).toBe(ids.indexOf('note') - 1);
  });

  it('Antwort umbenennen behält die ID (Wahl bleibt); eine gewählte entfernte Antwort wird nur verborgen', async () => {
    const id = await neu();
    await feldSpeichern(id, 'anmeldung', feld());
    const opt = () => ctFeld(id, 'f1').options as { id: string; name: string }[];
    const [s, m, l] = opt();
    const ctId = ctFeld(id, 'f1').id;
    mitglieder.set(id, [{ groupMemberStatus: 'active', fields: [{ id: ctId, value: l.id }] }]);
    // M → Medium (gleiche ID), L entfernt (aber gewählt), XL neu
    const e = await feldSpeichern(id, 'anmeldung', feld({ antworten: ['S', 'Medium', 'XL'] }), [
      { text: 'S', altId: s.id },
      { text: 'Medium', altId: m.id },
      { text: 'XL' },
    ]);
    expect(opt().map((o) => [o.id, o.name])).toEqual([
      [s.id, 'S'],
      [m.id, 'Medium'],
      [expect.any(String), 'XL'],
      [l.id, 'L'],
    ]);
    expect(e.formular.anmeldung.find((f) => f.id === 'f1')?.verborgen).toEqual(['L']);
  });

  it('Feld entfernen: ohne Antworten gelöscht, mit Antworten nur ausgeblendet', async () => {
    const id = await neu();
    await feldSpeichern(id, 'anmeldung', feld());
    await feldSpeichern(
      id,
      'person',
      feld({ id: 'f2', typ: 'text', frage: 'Lieblingslied', antworten: [] }),
    );
    const ct2 = ctFeld(id, 'f2').id;
    mitglieder.set(id, [
      { groupMemberStatus: 'active', fields: [{ id: ct2, value: 'Amazing Grace' }] },
    ]);
    expect(await feldEntfernen(id, 'f1')).toEqual({ art: 'geloescht' });
    expect(gruppen.get(id)!.felder.some((f) => f.name === 'T-Shirt-Größe')).toBe(false);
    expect(await feldEntfernen(id, 'f2')).toEqual({ art: 'ausgeblendet', antworten: 1 });
    const g = gruppen.get(id)!;
    expect(g.felder.find((f) => f.id === ct2)).toMatchObject({ useInRegistrationForm: false });
    expect(einstellungenLesen(g.note)!.formular.person.find((f) => f.id === 'f2')?.zustand).toBe(
      'aus',
    );
  });

  it('gleicher Name wie ein Systemfeld oder eine andere Frage → eindeutig mit (2)', async () => {
    const id = await neu();
    await feldSpeichern(
      id,
      'person',
      feld({ id: 'f3', typ: 'text', frage: 'Betrag', antworten: [] }),
    );
    expect(ctFeld(id, 'f3').name).toBe('Betrag (2)');
  });

  it('ungültiges Formular (Auswahl mit nur einer Antwort) → nichts in ChurchTools angelegt', async () => {
    const id = await neu();
    const vorher = gruppen.get(id)!.felder.length;
    await expect(
      feldSpeichern(id, 'anmeldung', feld({ antworten: ['nur eine'] })),
    ).rejects.toMatchObject({
      status: 422,
    });
    expect(gruppen.get(id)!.felder).toHaveLength(vorher);
  });

  const ids = (id: number) => {
    const f = einstellungenLesen(gruppen.get(id)!.note)!.formular;
    return { anmeldung: f.anmeldung.map((x) => x.id), person: f.person.map((x) => x.id) };
  };

  it('Verschieben (Baukasten): nur die Einstellungen, auch in den anderen Bereich', async () => {
    const id = await neu();
    await feldSpeichern(id, 'anmeldung', feld());
    const ctVorher = gruppen.get(id)!.felder.length;
    await feldEinordnen(id, 'f1', 'anmeldung', 'tel');
    expect(ids(id).anmeldung).toEqual(['name', 'mail', 'f1', 'tel', 'note', 'price', 'priv']);
    await feldEinordnen(id, 'f1', 'person', null);
    expect(ids(id).anmeldung).not.toContain('f1');
    expect(ids(id).person.at(-1)).toBe('f1');
    expect(gruppen.get(id)!.felder).toHaveLength(ctVorher);
  });

  it('Ablegen an einer Stelle: neues Feld vor `vorId`, Spalte angelegt', async () => {
    const id = await neu();
    await feldSpeichern(id, 'anmeldung', feld(), undefined, 'tel');
    expect(ids(id).anmeldung).toEqual(['name', 'mail', 'f1', 'tel', 'note', 'price', 'priv']);
    expect(ctFeld(id, 'f1').name).toBe('T-Shirt-Größe');
  });

  it('empfohlenes Feld (Anschrift) einfügen und wieder herausnehmen: Spalte bleibt, nur ausgeschaltet', async () => {
    const id = await neu();
    const anschrift = EMPFOHLEN.find((x) => x.id === 'addr')!.feld;
    await feldSpeichern(id, 'anmeldung', anschrift, undefined, null);
    expect(ids(id).anmeldung).toEqual(['name', 'mail', 'tel', 'addr', 'note', 'price', 'priv']);
    expect(ctFeld(id, 'addr')).toMatchObject({ name: 'Anschrift', useInRegistrationForm: true });
    expect(await feldEntfernen(id, 'addr')).toEqual({ art: 'ausgeblendet', antworten: 0 });
    expect(ctFeld(id, 'addr')).toMatchObject({ useInRegistrationForm: false });
    expect(
      einstellungenLesen(gruppen.get(id)!.note)!.formular.anmeldung.find((f) => f.id === 'addr')
        ?.zustand,
    ).toBe('aus');
  });

  it('ausgeschaltetes Feld an eine Stelle ziehen → eingeschaltet UND dorthin verschoben', async () => {
    const id = await neu();
    const foto = einstellungenLesen(gruppen.get(id)!.note)!.formular.person.find(
      (f) => f.id === 'foto',
    )!;
    expect(foto.zustand).toBe('aus');
    await feldSpeichern(id, 'person', { ...foto, zustand: 'freiwillig' }, undefined, 'allergy');
    expect(ids(id).person).toEqual(['pname', 'birth', 'foto', 'allergy']);
    expect(ctFeld(id, 'foto')).toMatchObject({ useInRegistrationForm: true });
  });

  it('Fragetyp ändern: ohne Antworten neue Spalte mit neuem Typ; mit Antworten abgelehnt, nichts geändert', async () => {
    const id = await neu();
    await feldSpeichern(id, 'anmeldung', feld());
    const alt = ctFeld(id, 'f1');
    expect(alt.fieldTypeCode).toBe('select');
    await feldTypAendern(id, feld({ typ: 'radio' }));
    const neuesFeld = ctFeld(id, 'f1');
    expect(neuesFeld.id).not.toBe(alt.id);
    expect(neuesFeld.fieldTypeCode).toBe('radioselect');
    expect(gruppen.get(id)!.felder.some((f) => f.id === alt.id)).toBe(false);
    mitglieder.set(id, [
      { groupMemberStatus: 'active', fields: [{ id: neuesFeld.id, value: 'x' }] },
    ]);
    const vorher = gruppen.get(id)!.note;
    await expect(feldTypAendern(id, feld({ typ: 'select' }))).rejects.toMatchObject({
      status: 409,
    });
    expect(ctFeld(id, 'f1').id).toBe(neuesFeld.id);
    expect(gruppen.get(id)!.note).toBe(vorher);
  });

  it('Name, E-Mail, Datenschutz lassen sich nicht entfernen', async () => {
    const id = await neu();
    await expect(feldEntfernen(id, 'mail')).rejects.toMatchObject({ status: 422 });
  });

  it('nimmt ChurchTools das Feld nicht an → Fehler, Formular unverändert', async () => {
    const id = await neu();
    await feldSpeichern(id, 'anmeldung', feld());
    const vorher = gruppen.get(id)!.note;
    schlucken.add('FELD');
    await expect(feldSpeichern(id, 'anmeldung', feld({ frage: 'Größe' }))).rejects.toBeInstanceOf(
      NichtUebernommen,
    );
    expect(gruppen.get(id)!.note).toBe(vorher);
  });
});

describe('Titelbild (A5)', () => {
  const bild = () => new File(['x'], 'bild.png', { type: 'image/png' });
  it('hochladen (Feld files[]), nachgelesen; entfernen', async () => {
    const id = await legeVeranstaltungAn({ name: 'X', teamId: 7, artId: 5, vorlage: 'einfach' });
    expect(await bildHochladen(id, bild())).toBe('https://ct.test/images/1/abc');
    expect((await kopfVon(id)).bildUrl).toBe('https://ct.test/images/1/abc');
    await bildEntfernen(id);
    expect((await kopfVon(id)).bildUrl).toBeNull();
  });
  it('kein Bild oder zu groß → abgelehnt, bevor etwas hochgeladen wird; nicht übernommen → Fehler', async () => {
    const id = await legeVeranstaltungAn({ name: 'X', teamId: 7, artId: 5, vorlage: 'einfach' });
    await expect(
      bildHochladen(id, new File(['x'], 'a.pdf', { type: 'application/pdf' })),
    ).rejects.toMatchObject({ status: 422 });
    const gross = new File([new Uint8Array(9 * 1024 * 1024)], 'gross.jpg', { type: 'image/jpeg' });
    await expect(bildHochladen(id, gross)).rejects.toMatchObject({ status: 413 });
    expect(aufrufe.some((a) => a.includes('groupimage'))).toBe(false);
    schlucken.add('BILD');
    await expect(bildHochladen(id, bild())).rejects.toBeInstanceOf(NichtUebernommen);
  });
});

describe('Eigenes Logo (14.10.2026)', () => {
  const logo = (name = 'Jugend.png') => new File(['x'], name, { type: 'image/png' });
  it('Hilfsgruppe: gleich archiviert, Art und Team wie die Veranstaltung, mit Kennung; danach in der Liste', async () => {
    const id = await legeVeranstaltungAn({ name: 'X', teamId: 7, artId: 5, vorlage: 'einfach' });
    const l = await logoHochladen(id, logo());
    expect(l).toEqual({ id: l.id, name: 'Jugend', url: 'https://ct.test/images/1/abc' });
    const g = gruppen.get(l.id)!;
    expect(g).toMatchObject({ name: 'Logo: Jugend', typ: 5, status: STATUS.archiviert, parent: 7 });
    expect(g.note.startsWith(LOGO_KENNUNG)).toBe(true);
    // Nie als Entwurf angelegt: kein PATCH auf den Status.
    expect(aufrufe.filter((a) => a === `PATCH /groups/${l.id}`)).toEqual([]);
    expect(await logoListe(id)).toEqual([l]);
    // Und weder im Archiv der Veranstaltungen noch als Veranstaltung.
    expect((await archivListe(5)).map((a) => a.id)).not.toContain(l.id);
  });
  it('Liste: nur Logo-Gruppen mit Bild – archivierte Veranstaltungen nicht', async () => {
    const id = await legeVeranstaltungAn({ name: 'X', teamId: 7, artId: 5, vorlage: 'einfach' });
    await setzeStatus(id, STATUS.archiviert);
    await bildHochladen(id, logo());
    expect(await logoListe(id)).toEqual([]);
  });
  it('Bild nicht übernommen → die halbe Gruppe wird wieder entfernt, Fehler kommt an', async () => {
    const id = await legeVeranstaltungAn({ name: 'X', teamId: 7, artId: 5, vorlage: 'einfach' });
    const vorher = gruppen.size;
    schlucken.add('BILD');
    await expect(logoHochladen(id, logo())).rejects.toBeInstanceOf(NichtUebernommen);
    expect(gruppen.size).toBe(vorher);
  });
  it('kein Bild → abgelehnt, bevor eine Gruppe entsteht', async () => {
    const id = await legeVeranstaltungAn({ name: 'X', teamId: 7, artId: 5, vorlage: 'einfach' });
    const vorher = gruppen.size;
    await expect(
      logoHochladen(id, new File(['x'], 'a.pdf', { type: 'application/pdf' })),
    ).rejects.toMatchObject({ status: 422 });
    expect(gruppen.size).toBe(vorher);
  });
  it('entfernen: nur Logo-Gruppen, nachgeprüft', async () => {
    const id = await legeVeranstaltungAn({ name: 'X', teamId: 7, artId: 5, vorlage: 'einfach' });
    const l = await logoHochladen(id, logo());
    await expect(logoEntfernen(id)).rejects.toMatchObject({ status: 409 });
    expect(gruppen.has(id)).toBe(true);
    schlucken.add('DELETE');
    await expect(logoEntfernen(l.id)).rejects.toBeInstanceOf(NichtUebernommen);
    schlucken.delete('DELETE');
    await logoEntfernen(l.id);
    expect(gruppen.has(l.id)).toBe(false);
  });
});

describe('Anmelden vorbereiten (A6-2, #548)', () => {
  const V = { statusId: 2, campusId: 0, departmentId: 1 };
  async function alteVeranstaltung() {
    // Wie vor A6-2 angelegt: ohne „Angemeldet von“.
    const id = await legeVeranstaltungAn({ name: 'X', teamId: 7, artId: 5, vorlage: 'einfach' });
    const g = gruppen.get(id)!;
    const e = einstellungenLesen(g.note)!;
    g.felder = g.felder.filter((f) => f.id !== e.ctFelder.kontakt);
    delete e.ctFelder.kontakt;
    await aendereEinstellungen(id, () => e);
    return id;
  }

  it('ergänzt fehlende Systemfelder, setzt Leitung und Vorgaben (flach) – danach nimmt ChurchTools an', async () => {
    const id = await alteVeranstaltung();
    expect(await anmeldeBedingungen(id)).toEqual([
      'Die Veranstaltung ist für Gäste nicht lesbar (nicht freigegeben oder nicht öffentlich).',
    ]);
    await anmeldenVorbereiten(id, [1, 4], V);
    await freigeben(id);
    expect(await anmeldeBedingungen(id)).toEqual([]);
    const e = einstellungenLesen(gruppen.get(id)!.note)!;
    expect(gruppen.get(id)!.felder.find((f) => f.id === e.ctFelder.kontakt)?.name).toBe(
      'Angemeldet von',
    );
    expect(gruppen.get(id)!.settings.newMember).toEqual(V);
    // Nur das Fehlende angelegt: jedes Systemfeld genau einmal, die alten Nummern bleiben.
    for (const name of ['Betrag', 'Bezahlt', 'Angemeldet von'])
      expect(
        gruppen.get(id)!.felder.filter((f) => f.name === name),
        name,
      ).toHaveLength(1);
  });

  it('übernimmt ChurchTools die Vorgaben nicht → Fehler statt „freigegeben“', async () => {
    const id = await legeVeranstaltungAn({ name: 'X', teamId: 7, artId: 5, vorlage: 'einfach' });
    schlucken.add('VORGABEN');
    await expect(anmeldenVorbereiten(id, [1], V)).rejects.toThrow(/Vorgaben/);
  });

  it('vor dem Vorbereiten fehlen Leitung und Vorgaben – in Worten', async () => {
    const id = await legeVeranstaltungAn({ name: 'X', teamId: 7, artId: 5, vorlage: 'einfach' });
    await freigeben(id);
    expect(await anmeldeBedingungen(id)).toEqual([
      'Die Gruppe hat keine Leitung.',
      'Für neue Personen fehlt der Status.',
      'Für neue Personen fehlt der Standort.',
      'Für neue Personen fehlt der Bereich.',
    ]);
  });

  it('übernimmt ChurchTools die Leitung nicht → Fehler statt „freigegeben“', async () => {
    const id = await legeVeranstaltungAn({ name: 'X', teamId: 7, artId: 5, vorlage: 'einfach' });
    schlucken.add('LEITUNG');
    await expect(anmeldenVorbereiten(id, [1], V)).rejects.toThrow(/Leitung/);
  });

  it('ohne Leitung → abgelehnt, bevor etwas geschrieben wird', async () => {
    const id = await legeVeranstaltungAn({ name: 'X', teamId: 7, artId: 5, vorlage: 'einfach' });
    aufrufe.length = 0;
    await expect(anmeldenVorbereiten(id, [], V)).rejects.toMatchObject({ status: 422 });
    expect(aufrufe.filter((a) => !a.startsWith('GET'))).toEqual([]);
  });

  it('Leitungs-Kandidaten: Team und Gruppe zusammen, wer schon Leitung ist, markiert', async () => {
    const id = await legeVeranstaltungAn({ name: 'X', teamId: 7, artId: 5, vorlage: 'einfach' });
    mitglieder.set(7, [
      {
        personId: 4,
        groupMemberStatus: 'active',
        person: { domainAttributes: { firstName: 'Bea', lastName: 'Team' } },
      },
      {
        personId: 1,
        groupMemberStatus: 'active',
        person: { domainAttributes: { firstName: 'Alwin', lastName: 'F' } },
      },
    ]);
    await anmeldenVorbereiten(id, [1], V);
    // Nach Namen sortiert; die Angaben der Gruppe (hier „P1 Test“) überschreiben die des Teams.
    expect(await leitungsKandidaten(id)).toEqual([
      { personId: 4, name: 'Bea Team', leitung: false },
      { personId: 1, name: 'P1 Test', leitung: true },
    ]);
  });
});
