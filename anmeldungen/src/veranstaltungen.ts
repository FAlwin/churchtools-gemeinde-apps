/**
 * **Die Veranstaltungen der eigenen Gruppen aus ChurchTools lesen** (A2, #480). Was daraus wird
 * (Einteilung, Stand, Hinweise), entscheidet `shared/anmeldung/uebersicht.ts`; hier wird nur geholt.
 *
 * Abfragen, gemessen an der Test-Instanz (12.10.2026):
 * - `GET /groups/hierarchies` – einmal, für alle lesbar: welche Untergruppen es gibt, auch die man nicht
 *   sehen darf (→ „für dich nicht freigegeben“ statt „keine“);
 * - `GET /groups/{id}/children` – je eigene Gruppe: sichtbare Untergruppen samt Status und **voller**
 *   Beschreibung (darin unsere Einstellungen), auch Entwürfe; ohne Rechte leer;
 * - `GET /groups?ids[]=…` – einmal für alle Veranstaltungen: Plätze, Anmeldezeitraum, Warteliste;
 * - `GET /groups/{id}/members` – je **anstehender** Veranstaltung: Belegung, Warteliste, „bezahlt“; dazu je vergangener
 *   mit erreichtem Löschdatum (A9-4) – und für die ohne Anmeldungen der Lösch-Probelauf (`darfEndgueltigLoeschen`);
 * - `GET /groups/{id}/members/routines` – je freigegebener Veranstaltung (A9-5): fehlen die Abläufe?
 * Listen mit Seiten (`members`, `groups`: 10 je Seite) über `ctAlleSeiten`.
 */
import { ctAlleSeiten, ctDaten } from '@ui/ct/verbindung';
import { ApiError } from '@ui/ct/fehler';
import { mapLimit } from '@shared/ct/mapLimit';
import { heuteImKalender } from '@shared/ct/zeit';
import type { MeineGruppe } from '@shared/ct/gruppen';
import { einstellungenLesen, type OeffentlicheEinstellungen } from '@shared/anmeldung/formular';
import {
  abgelaufen,
  aufmerksamkeit,
  belegungAus,
  einteilen,
  istVeranstaltung,
  phaseVon,
  veranstaltungAus,
  verborgeneUntergruppen,
  type Belegung,
  type Einteilung,
  type Hinweis,
  type KaputteVeranstaltung,
  type Veranstaltung,
  type VeranstaltungDetails,
  type VeranstaltungRoh,
} from '@shared/anmeldung/uebersicht';

import { ablaeufeFehlen } from './ablaeufe';
import {
  anmeldungenIn,
  darfAblaeufeEinrichten,
  darfEndgueltigLoeschen,
  leitungsRollen,
  reparieren,
} from './einrichten';
import { loeschDatum } from '@shared/anmeldung/termin';
/** Gleichzeitige Anfragen – schont ChurchTools (#300), die Bremse in der Verbindung greift zusätzlich. */
const PARALLEL = 3;

export interface Uebersicht {
  einteilung: Einteilung;
  hinweise: Hinweis[];
  /** Je eigener Gruppe: Veranstaltungen, die nicht vorbei sind. */
  offen: Map<number, number>;
  /** Je eigener Gruppe: Untergruppen, die man nicht sehen darf. */
  verborgen: Map<number, number>;
}

interface KindRoh {
  title?: string;
  domainIdentifier?: string | number;
  domainAttributes?: { note?: string | null; groupStatusId?: number; groupTypeId?: number };
}

interface GruppeRoh {
  id: number;
  settings?: {
    maxMembers?: number | null;
    signUpOpeningDate?: string | null;
    signUpClosingDate?: string | null;
    allowWaitinglist?: boolean;
  };
}

function detailsAus(g: GruppeRoh | undefined): VeranstaltungDetails {
  const s = g?.settings ?? {};
  return {
    maxPlaetze: typeof s.maxMembers === 'number' ? s.maxMembers : null,
    anmeldungAb: s.signUpOpeningDate ?? null,
    anmeldungBis: s.signUpClosingDate ?? null,
    warteliste: s.allowWaitinglist === true,
  };
}

/**
 * Einstellungen aus der Sicherung (A5) – fehlt die Sicherung oder darf man die Felder nicht lesen (403), bleibt
 * die Veranstaltung ein Hinweis „lässt sich nicht lesen“; alles andere kann vorübergehend sein → werfen.
 */
async function ausSicherung(id: number): Promise<OeffentlicheEinstellungen | null> {
  try {
    return await reparieren(id);
  } catch (e) {
    if (e instanceof ApiError && e.status === 403) return null;
    throw e;
  }
}

/**
 * Lädt die Übersicht. **Wirft** bei vorübergehenden Fehlern – eine halbe Übersicht sähe aus wie eine
 * ganze („keine Veranstaltungen“, „nichts zu zahlen“). Einzige Ausnahme: Darf man die Anmeldungen
 * einer Veranstaltung nicht sehen (403), steht sie ohne Belegung da.
 */
export async function ladeUebersicht(
  gruppen: MeineGruppe[],
  jetzt = new Date(),
  /** Gruppenart „Anmeldung“ – erkennt Veranstaltungen, deren Einstellungen in ChurchTools überschrieben wurden (A5). */
  artId: number | null = null,
): Promise<Uebersicht> {
  const heute = heuteImKalender(jetzt);
  const kinderJeGruppe = new Map<number, VeranstaltungRoh[]>();

  const [hierarchie] = await Promise.all([
    ctDaten<{ groupId?: number; children?: number[] }[] | null>('/groups/hierarchies'),
    mapLimit(gruppen, PARALLEL, async (g) => {
      const kinder = (await ctDaten<KindRoh[] | null>(`/groups/${g.id}/children`)) ?? [];
      kinderJeGruppe.set(
        g.id,
        kinder.map((k) => ({
          id: Number(k.domainIdentifier),
          name: (k.title ?? '').trim(),
          gruppeId: g.id,
          statusId: Number(k.domainAttributes?.groupStatusId),
          beschreibung: k.domainAttributes?.note ?? '',
          typId: k.domainAttributes?.groupTypeId,
        })),
      );
    }),
  ]);

  // Liegt eine Veranstaltung unter zwei eigenen Gruppen, zählt sie einmal (bei der ersten).
  const kandidaten = new Map<number, VeranstaltungRoh>();
  for (const g of gruppen) {
    for (const k of kinderJeGruppe.get(g.id) ?? []) {
      if (Number.isInteger(k.id) && istVeranstaltung(k, artId) && !kandidaten.has(k.id)) {
        kandidaten.set(k.id, k);
      }
    }
  }

  // Jede Beschreibung genau einmal lesen; was sich nicht lesen lässt, wird zum Hinweis.
  const lesbar: { r: VeranstaltungRoh; e: OeffentlicheEinstellungen }[] = [];
  const kaputt: KaputteVeranstaltung[] = [];
  for (const r of kandidaten.values()) {
    const e = einstellungenLesen(r.beschreibung) ?? (await ausSicherung(r.id));
    if (e) lesbar.push({ r, e });
    else kaputt.push({ id: r.id, name: r.name, gruppeId: r.gruppeId });
  }

  const details = new Map<number, GruppeRoh>();
  if (lesbar.length > 0) {
    const ids = lesbar.map(({ r }) => `ids[]=${r.id}`).join('&');
    for (const g of await ctAlleSeiten<GruppeRoh>(`/groups?${ids}`)) details.set(g.id, g);
  }

  // Mitglieder nur, wo es etwas zu zählen gibt: anstehend – und vergangen mit erreichtem Löschdatum (A9-4, D3: sind die
  // Anmeldungen weg, bleibt endgültig löschen). Entwürfe haben keine, sonst braucht Vergangenes keine.
  const belegung = new Map<number, Belegung | null>();
  const abgelaufenKandidat = ({ r, e }: (typeof lesbar)[number]) => {
    const datum = loeschDatum(e);
    return phaseVon(r.statusId, e.termin, heute) === 'vorbei' && datum !== null && datum <= heute;
  };
  const zuZaehlen = lesbar.filter(
    (x) => phaseVon(x.r.statusId, x.e.termin, heute) === 'anstehend' || abgelaufenKandidat(x),
  );
  const leitung = zuZaehlen.length ? await leitungsRollen() : new Set<number>();
  await mapLimit(zuZaehlen, PARALLEL, async ({ r, e: einstellungen }) => {
    try {
      const mitglieder = await ctAlleSeiten<Parameters<typeof belegungAus>[0][number]>(
        `/groups/${r.id}/members`,
        200,
      );
      belegung.set(r.id, belegungAus(mitglieder, einstellungen, leitung, heute));
    } catch (e) {
      // Kein Recht ist dauerhaft und betrifft nur diese Zeile; alles andere kann vorübergehend sein → werfen.
      if (e instanceof ApiError && e.status === 403) belegung.set(r.id, null);
      else throw e;
    }
  });

  const liste: Veranstaltung[] = [];
  for (const { r, e } of lesbar) {
    const v = veranstaltungAus(
      r,
      detailsAus(details.get(r.id)),
      belegung.get(r.id) ?? null,
      heute,
      jetzt,
      e,
    );
    if (v) liste.push(v);
  }

  const kinderLaut = new Map<number, number[]>();
  for (const h of hierarchie ?? []) {
    if (typeof h.groupId === 'number') kinderLaut.set(h.groupId, h.children ?? []);
  }
  const verborgen = new Map<number, number>();
  const offen = new Map<number, number>();
  for (const g of gruppen) {
    const sichtbar = (kinderJeGruppe.get(g.id) ?? []).map((k) => k.id);
    verborgen.set(g.id, verborgeneUntergruppen(kinderLaut.get(g.id) ?? [], sichtbar));
    offen.set(g.id, liste.filter((v) => v.gruppeId === g.id && v.phase !== 'vorbei').length);
  }

  // D4: Wer darf endgültig löschen? Der Probelauf von ChurchTools sagt es je Veranstaltung (nur für die abgelaufenen).
  const loeschbar = new Set<number>();
  await mapLimit(
    liste.filter((v) => abgelaufen(v, heute)),
    PARALLEL,
    async (v) => {
      if (await darfEndgueltigLoeschen(v.id)) loeschbar.add(v.id);
    },
  );

  // A9-5 (F1): Freigegeben, aber ohne Abläufe? Dann schickt ChurchTools seine Standard-Mail und löscht nie. Vergangene nur,
  // solange noch jemand angemeldet ist – sonst gibt es nichts mehr zu löschen. Darf man die Routinen nicht lesen (403),
  // fehlt der Hinweis eben; anderes kann vorübergehend sein – auch dann lieber ohne Hinweis als ohne Übersicht.
  const freigegeben = new Set(lesbar.filter(({ r }) => r.statusId === 1).map(({ r }) => r.id));
  const einrichten = new Map<number, boolean>();
  await mapLimit(
    liste.filter((v) => freigegeben.has(v.id) && !abgelaufen(v, heute)),
    PARALLEL,
    async (v) => {
      try {
        if (!(await ablaeufeFehlen(v.id))) return;
        if (v.phase === 'vorbei' && (await anmeldungenIn(v.id)) === 0) return;
        einrichten.set(v.id, await darfAblaeufeEinrichten(v.id));
      } catch (e) {
        if (!(e instanceof ApiError && e.status === 403))
          console.warn(`Abläufe von ${v.id} nicht gelesen`, e);
      }
    },
  );

  const leitungIn = new Set(gruppen.filter((g) => g.leitung).map((g) => g.id));
  return {
    einteilung: einteilen(liste),
    hinweise: aufmerksamkeit(liste, kaputt, leitungIn, heute, loeschbar, einrichten),
    offen,
    verborgen,
  };
}
