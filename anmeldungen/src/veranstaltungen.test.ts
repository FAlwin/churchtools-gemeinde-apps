import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { _bremseLoesen, _vergissCsrf } from '@ui/ct/verbindung';
import { ApiError } from '@ui/ct/fehler';
import {
  einstellungenAlsText,
  EINSTELLUNGEN_KENNUNG,
  type OeffentlicheEinstellungen,
  sicherungTeile,
  einstellungenLesen,
} from '@shared/anmeldung/formular';
import type { MeineGruppe } from '@shared/ct/gruppen';
import { neueEinstellungen } from '@shared/anmeldung/vorlagen';
import { ladeUebersicht } from './veranstaltungen';

/**
 * Lesen der Veranstaltungen (A2, #480) gegen eine nachgestellte ChurchTools-Instanz. Die Antworten haben
 * die Form, die an der Test-Instanz gemessen wurde (12.10.2026): `children` mit voller Beschreibung in
 * `domainAttributes.note`, `members` mit `fields[].value` '1'/'0', Seiten über `meta.pagination`.
 */
const JETZT = new Date('2026-10-12T10:00:00Z');

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function beschreibung(beginn: string | null, bezahlt?: number): string {
  const e: OeffentlicheEinstellungen = {
    ...neueEinstellungen('einfach'),
    termin: beginn ? { beginn, ende: null, ort: 'Saal', terminId: null } : null,
    preis: {
      ...neueEinstellungen('einfach').preis,
      grundpreis: { art: 'fest', betragCent: 1200, gilt: 'person', auswahlName: '', optionen: [] },
    },
    ctFelder: bezahlt ? { bezahlt } : {},
  };
  return einstellungenAlsText(e);
}

const kind = (id: number, title: string, note: string, groupStatusId = 1, groupTypeId = 5) => ({
  title,
  domainIdentifier: String(id),
  domainAttributes: { note, groupStatusId, groupTypeId },
});

const mitglied = (status: string, bezahlt?: string, rolle = 32) => ({
  groupMemberStatus: status,
  groupTypeRoleId: rolle,
  fields: bezahlt === undefined ? [] : [{ id: 73, name: 'Bezahlt', value: bezahlt }],
});

type Antworten = Record<string, (init?: RequestInit) => Response>;

/** Antwortet nach Pfad ohne `limit`/`page`; zählt, welche Pfade gefragt wurden. */
function ct(antworten: Antworten): string[] {
  const gefragt: string[] = [];
  vi.spyOn(globalThis, 'fetch').mockImplementation((input, init) => {
    const url = new URL(String(input));
    url.searchParams.delete('limit');
    url.searchParams.delete('page');
    const pfad = decodeURIComponent(url.pathname.replace(/^\/api/, '') + url.search);
    gefragt.push(pfad);
    const a = antworten[pfad];
    return Promise.resolve(a ? a(init) : json(404, { message: `nicht nachgestellt: ${pfad}` }));
  });
  return gefragt;
}

const seite = (data: unknown[]) => json(200, { data, meta: { pagination: { lastPage: 1 } } });

const LOBPREIS: MeineGruppe = { id: 9, name: 'Lobpreisteam', leitung: true };
const TECHNIK: MeineGruppe = { id: 7, name: 'Technik', leitung: false };

function standard(): Antworten {
  return {
    '/groups/hierarchies': () =>
      json(200, {
        data: [
          { groupId: 9, children: [40, 43, 46, 99] },
          { groupId: 7, children: [52, 60] },
        ],
      }),
    '/groups/9/children': () =>
      json(200, {
        data: [
          kind(40, 'Lobpreisabend', beschreibung('2026-11-01T19:00')),
          kind(43, 'Workshop', beschreibung('2026-12-05T10:00'), 2),
          kind(46, 'Freizeit', beschreibung('2026-11-20T18:00', 73)),
          kind(99, 'Bandprobe', 'Wir proben donnerstags.', 1, 2),
        ],
      }),
    '/groups/7/children': () =>
      json(200, { data: [kind(52, 'Grundkurs', beschreibung('2026-09-19T10:00'))] }),
    '/groups?ids[]=40&ids[]=43&ids[]=46&ids[]=52': () =>
      seite([
        { id: 40, settings: { maxMembers: 6, signUpOpeningDate: '2026-10-01T00:00:00Z' } },
        { id: 43, settings: { maxMembers: 20 } },
        { id: 46, settings: { maxMembers: 20, signUpOpeningDate: '2026-09-15T00:00:00Z' } },
        { id: 52, settings: { maxMembers: 10 } },
      ]),
    // #623: Die Leitung (Rolle 35) zählt nicht als Teilnehmer – wie bei ChurchTools selbst.
    '/group/roles': () =>
      json(200, {
        data: [
          { id: 32, groupTypeId: 5, type: 'participant', isLeader: false },
          { id: 35, groupTypeId: 5, type: 'leader', isLeader: true },
        ],
      }),
    '/groups/40/members': () =>
      seite([
        mitglied('active', undefined, 35),
        ...Array.from({ length: 5 }, () => mitglied('active')),
        mitglied('waiting'),
        mitglied('waiting'),
      ]),
    '/groups/46/members': () =>
      seite([mitglied('active', '1'), mitglied('active', '0'), mitglied('active', '0')]),
  };
}

beforeEach(() => {
  _vergissCsrf();
  _bremseLoesen();
  vi.stubGlobal('window', {
    settings: { base_url: 'https://ct.test/' },
    location: { origin: 'https://ct.test' },
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('ladeUebersicht', () => {
  it('teilt ein, zählt Belegung und meldet, was Aufmerksamkeit braucht', async () => {
    ct(standard());
    const u = await ladeUebersicht([LOBPREIS, TECHNIK], JETZT);
    expect(u.einteilung.anstehend.map((v) => [v.name, v.anmeldung, v.belegung])).toEqual([
      ['Lobpreisabend', 'offen', { aktiv: 5, wartend: 2, unbezahlt: null }],
      ['Freizeit', 'offen', { aktiv: 3, wartend: 0, unbezahlt: 2 }],
    ]);
    expect(u.einteilung.entwuerfe.map((v) => v.name)).toEqual(['Workshop']);
    expect(u.einteilung.vorbei.map((v) => v.name)).toEqual(['Grundkurs']);
    expect(u.hinweise.map((h) => h.art)).toEqual(['nachruecken', 'zahlungen', 'freigabe']);
    expect(u.offen).toEqual(
      new Map([
        [9, 3],
        [7, 0],
      ]),
    );
  });

  it('fremde Untergruppen zählen nicht als Veranstaltung', async () => {
    const a = standard();
    a['/groups?ids[]=40&ids[]=43&ids[]=46'] = a['/groups?ids[]=40&ids[]=43&ids[]=46&ids[]=52'];
    ct(a);
    const u = await ladeUebersicht([LOBPREIS], JETZT);
    const alle = [...u.einteilung.anstehend, ...u.einteilung.entwuerfe, ...u.einteilung.vorbei];
    expect(alle.map((v) => v.id)).not.toContain(99);
  });

  it('Mitglieder nur für anstehende Veranstaltungen – nicht für Entwürfe und Vergangenes', async () => {
    const gefragt = ct(standard());
    await ladeUebersicht([LOBPREIS, TECHNIK], JETZT);
    expect(gefragt.filter((p) => p.endsWith('/members')).sort()).toEqual([
      '/groups/40/members',
      '/groups/46/members',
    ]);
  });

  it('nicht freigegeben: Untergruppen laut Hierarchie, die man nicht sehen darf', async () => {
    ct(standard());
    const u = await ladeUebersicht([LOBPREIS, TECHNIK], JETZT);
    // Technik: 60 gibt es laut Hierarchie, sichtbar ist nur 52.
    expect(u.verborgen).toEqual(
      new Map([
        [9, 0],
        [7, 1],
      ]),
    );
  });

  it('kaputte Einstellungen werden zum Hinweis, nicht stillschweigend weggelassen', async () => {
    const a = standard();
    a['/groups/7/children'] = () =>
      json(200, { data: [kind(52, 'Grundkurs', EINSTELLUNGEN_KENNUNG + '{kaputt')] });
    // Keine Sicherung in den Feldern (A5) → bleibt ein Hinweis.
    a['/groups/52/memberfields'] = () => json(200, { data: [] });
    a['/groups?ids[]=40&ids[]=43&ids[]=46'] = a['/groups?ids[]=40&ids[]=43&ids[]=46&ids[]=52'];
    ct(a);
    const u = await ladeUebersicht([LOBPREIS, TECHNIK], JETZT);
    expect(u.hinweise[0]).toEqual({ art: 'kaputt', id: 52, name: 'Grundkurs', gruppeId: 7 });
  });

  it('Beschreibung in ChurchTools überschrieben → an der Gruppenart erkannt und aus der Sicherung repariert (A5)', async () => {
    const a = standard();
    const richtig = beschreibung('2026-11-19T10:00', 73);
    let note = 'Treffpunkt: Technikraum.'; // so hat der ChurchTools-Editor gespeichert
    let sicherung = sicherungTeile(richtig)![0];
    a['/groups/7/children'] = () => json(200, { data: [kind(52, 'Grundkurs', note)] });
    a['/groups/52'] = (init) => {
      if (init?.method === 'PATCH') note = String(JSON.parse(String(init.body)).note);
      return json(200, { data: { id: 52, name: 'Grundkurs', information: { note } } });
    };
    a['/groups/52/memberfields'] = () =>
      json(200, { data: [{ type: 'group', field: { id: 73, name: 'Bezahlt', note: sicherung } }] });
    a['/groups/52/memberfields/group/73'] = (init) => {
      sicherung = String(JSON.parse(String(init!.body)).note);
      return json(200, { data: {} });
    };
    a['/groups/52/members'] = () => seite([]);
    a['/csrftoken'] = () => json(200, { data: 't' });
    ct(a);
    // Ohne Gruppenart wäre sie keine Veranstaltung (nur ein Text) – mit ihr wird sie erkannt und repariert.
    const u = await ladeUebersicht([LOBPREIS, TECHNIK], JETZT, 5);
    expect(u.einteilung.anstehend.some((v) => v.id === 52)).toBe(true);
    expect(note.startsWith('Treffpunkt: Technikraum.\n\n[anmeldung]: #v2:')).toBe(true);
    expect(einstellungenLesen(note)).toEqual(einstellungenLesen(richtig));
  });

  it('eine fremde Untergruppe ohne Einstellungen, aber anderer Gruppenart, bleibt außen vor', async () => {
    const a = standard();
    a['/groups/7/children'] = () =>
      json(200, { data: [kind(52, 'Grundkurs', 'Nur ein Text.', 1, 2)] });
    a['/groups?ids[]=40&ids[]=43&ids[]=46'] = a['/groups?ids[]=40&ids[]=43&ids[]=46&ids[]=52'];
    ct(a);
    const u = await ladeUebersicht([LOBPREIS, TECHNIK], JETZT, 5);
    expect(u.hinweise.some((h) => h.art === 'kaputt')).toBe(false);
  });

  it('Anmeldungen ohne Recht (403): die Veranstaltung steht da, nur ohne Belegung', async () => {
    const a = standard();
    a['/groups/40/members'] = () =>
      json(403, { message: 'Forbidden', messageKey: 'error.forbidden.view' });
    a['/whoami'] = () => json(200, { data: { id: 1 } });
    ct(a);
    const u = await ladeUebersicht([LOBPREIS, TECHNIK], JETZT);
    expect(u.einteilung.anstehend.find((v) => v.id === 40)?.belegung).toBeNull();
  });

  it('ChurchTools antwortet nicht (502) → Fehler statt einer halben Übersicht', async () => {
    const a = standard();
    a['/groups/46/members'] = () => json(502, {});
    ct(a);
    await expect(ladeUebersicht([LOBPREIS, TECHNIK], JETZT)).rejects.toBeInstanceOf(ApiError);
  });

  it('dieselbe Veranstaltung unter zwei eigenen Gruppen zählt einmal', async () => {
    const a = standard();
    a['/groups/7/children'] = () =>
      json(200, { data: [kind(40, 'Lobpreisabend', beschreibung('2026-11-01T19:00'))] });
    a['/groups?ids[]=40&ids[]=43&ids[]=46'] = a['/groups?ids[]=40&ids[]=43&ids[]=46&ids[]=52'];
    ct(a);
    const u = await ladeUebersicht([LOBPREIS, TECHNIK], JETZT);
    expect(u.einteilung.anstehend.filter((v) => v.id === 40)).toHaveLength(1);
    // …und zwar bei der ersten eigenen Gruppe (Lobpreisteam), nicht der zweiten.
    expect(u.einteilung.anstehend.find((v) => v.id === 40)?.gruppeId).toBe(9);
  });

  it('keine eigenen Gruppen → leere Übersicht, ohne Detail-Abfrage', async () => {
    const gefragt = ct(standard());
    const u = await ladeUebersicht([], JETZT);
    expect(u.einteilung).toEqual({ anstehend: [], entwuerfe: [], vorbei: [] });
    expect(gefragt).toEqual(['/groups/hierarchies']);
  });
});
