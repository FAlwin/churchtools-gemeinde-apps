import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { _bremseLoesen, _vergissCsrf } from '@ui/ct/verbindung';
import { ApiError } from '@ui/ct/fehler';
import { einstellungenLesen, standardFormular } from '@shared/anmeldung/formular';
import {
  NichtUebernommen,
  aendereEinstellungen,
  aenderePreise,
  anmeldungenZahl,
  anlegenMoeglich,
  freigeben,
  kalenderListe,
  kopiereVeranstaltung,
  legeTerminAn,
  legeVeranstaltungAn,
  speichereAnmeldung,
  speichereBezahlung,
} from './einrichten';

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
  felder: { id: number; name: string }[];
}

let gruppen: Map<number, G>;
let naechste: number;
let schlucken: Set<string>;
let termine: Map<number, Record<string, unknown>>;
let aufrufe: string[];
/** Mitglieder je Gruppe; `403`/`502` = so antwortet ChurchTools auf `/members`. */
let mitglieder: Map<number, { groupMemberStatus: string }[] | 403 | 502>;

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function ct() {
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
    const url = new URL(String(input));
    const pfad = url.pathname.replace(/^\/api/, '');
    const m = (init?.method ?? 'GET').toUpperCase();
    const body = init?.body ? (JSON.parse(String(init.body)) as Record<string, unknown>) : {};
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
        felder: q.felder.map((f) => ({ id: f.id + 1000, name: f.name })),
      });
      return json(201, { data: { id } });
    }
    r = /^\/groups\/(\d+)\/members$/.exec(pfad);
    if (r) {
      const m = mitglieder.get(Number(r[1])) ?? [];
      if (typeof m === 'number') return json(m, { message: 'nein' });
      return json(200, { data: m, meta: { pagination: { lastPage: 1 } } });
    }
    r = /^\/groups\/(\d+)\/memberfields\/group$/.exec(pfad);
    if (r && m === 'POST') {
      const g = gruppen.get(Number(r[1]))!;
      const id = naechste++;
      g.felder.push({ id, name: String(body.name) });
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
      if (m === 'PATCH' && !schlucken.has('PATCH')) {
        for (const [k, v] of Object.entries(body)) {
          if (k === 'note') g.note = String(v);
          else if (k === 'groupStatusId') g.status = Number(v);
          else if (k !== 'information') g.settings[k] = v; // verschachtelt: still ignoriert (gemessen)
        }
      }
      return json(200, {
        data: {
          id: g.id,
          name: g.name,
          information: { note: g.note, groupStatusId: g.status, groupTypeId: g.typ },
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
  termine = new Map();
  aufrufe = [];
  mitglieder = new Map();
  vi.stubGlobal('window', {
    settings: { base_url: 'https://ct.test/' },
    location: { origin: 'https://ct.test' },
  });
  ct();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

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
    expect(Object.keys(e.ctFelder).sort()).toEqual(
      ['aufschluesselung', 'auswahl', 'betrag', 'bezahlt', 'bezahltAm', 'extras'].sort(),
    );
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
    g.note = g.note.replace(
      '"termin":null',
      '"termin":{"beginn":"2026-11-15T12:00","ende":null,"ort":"Saal","terminId":5}',
    );
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
      gruppeId: 91,
      zeitzone: 'Europe/Berlin',
    });
    expect(t.startDate).toBe('2026-11-15T11:00:00Z');
    expect(termine.get(t.id)).toMatchObject({
      link: 'https://falwin.github.io/churchtools-gemeinde-apps/#ct.test/91',
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
        gruppeId: 1,
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
        hilfe: 'x'.repeat(390),
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
