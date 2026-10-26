/**
 * **Lesen: Sitzungen, Protokolle, Aufgaben einer Gruppe** (Bauplan Protokolle S3-1). Die Regeln stehen in
 * `@shared/protokolle/sitzungen` (Zusammenführen) und `@shared/protokolle/speicher` (Kopf + Teile); hier wird nur
 * bei ChurchTools gelesen. Gemessen: `protokolle-planung/docs/messung-s3-1-2026-10-23.md`.
 *
 * **Vorübergehend ist nicht leer:** Jeder Fehler wird geworfen – mit einer Ausnahme, die gemessen ist: Darf die
 * Person die Gruppentreffen nicht sehen (403, je nach Gruppentyp), fehlen nur die Treffen, und das wird gemeldet
 * (`treffenNichtFreigegeben`) statt einer stillen Lücke.
 */
import { werteLesen } from '@shared/ct/modulDaten';
import { tagAusIso } from '@shared/ct/zeit';
import { plusTage } from '@shared/ct/datum';
import { mapLimit } from '@shared/ct/mapLimit';
import { istEinstellung } from '@shared/protokolle/einrichten';
import type { ProtokollGruppe } from '@shared/protokolle/gruppen';
import type { Aufgabe } from '@shared/protokolle/aufgaben';
import { aufgabenWerte } from './aufgabenSchreiben';
import {
  istKopf,
  istTeil,
  wertInhalt,
  type ProtokollKopf,
  type ProtokollTeil,
} from '@shared/protokolle/speicher';
import {
  antwortAus,
  sitzungenOrdnen,
  type Anfrage,
  type Sitzung,
  type Termin,
  type Treffen,
} from '@shared/protokolle/sitzungen';
import { modulPort } from '@ui/ct/modulPort';
import { ctDaten, KeinSpeicherRecht } from '@ui/ct/verbindung';

/** Wie weit „Kommend“ in die Zukunft schaut. */
export const KOMMEND_TAGE = 180;
/** Höchstens so viele Anfragen gleichzeitig, wenn je Termin die Besprechungsanfragen gelesen werden (#300). */
const GLEICHZEITIG = 4;

export interface GruppenSitzungen {
  kommend: Sitzung[];
  protokolle: Sitzung[];
  /** Alle Teile – zum Öffnen eines Protokolls (`dokumentAusTeilen`). */
  teile: ProtokollTeil[];
  /** Kalender der Gruppe aus der Einstellung – `null`: keiner gewählt (dann kommen keine Termine). */
  kalender: number | null;
  /** ChurchTools zeigt dieser Person die Gruppentreffen nicht (403) – „Kommend“ ist dann nur der Kalender. */
  treffenNichtFreigegeben: boolean;
}

interface TerminRoh {
  base?: { id: number; title: string; calendar?: { id: number } };
  appointment?: { base?: { id: number; title: string; calendar?: { id: number } } };
  calculated?: { startDate?: string };
}

/** Kommende Termine im Kalender – nur die mit Besprechungsanfrage (Alwin, 23.10.2026), samt den Antworten. */
async function termineMitAnfrage(kalender: number, von: string, bis: string): Promise<Termin[]> {
  const roh =
    (await ctDaten<TerminRoh[]>(
      `/calendars/appointments?calendar_ids[]=${kalender}&from=${von}&to=${bis}`,
    )) ?? [];
  const alle: Omit<Termin, 'anfragen'>[] = [];
  for (const r of roh) {
    const b = r.base ?? r.appointment?.base;
    const beginn = r.calculated?.startDate;
    if (b && beginn) alle.push({ kalender, id: b.id, titel: b.title, beginn });
  }
  // Je Termin einmal fragen (die Liste zeigt es nicht – gemessen); eine Serie hat dieselbe ID → einmal genügt.
  const anfragen = new Map<number, Anfrage[]>();
  await mapLimit([...new Set(alle.map((t) => t.id))], GLEICHZEITIG, async (id) => {
    const liste =
      (await ctDaten<AnfrageRoh[]>(`/calendars/${kalender}/appointments/${id}/meetingrequests`)) ??
      [];
    if (Array.isArray(liste) && liste.length)
      anfragen.set(
        id,
        liste.map((a) => ({
          person: Number(a.person?.domainIdentifier ?? a.inviteeId),
          antwort: antwortAus(a.state),
        })),
      );
  });
  return alle.flatMap((t) => {
    const a = anfragen.get(t.id);
    return a ? [{ ...t, anfragen: a }] : [];
  });
}

/** Eine Besprechungsanfrage, wie ChurchTools sie liefert (gemessen S3-3: `person.domainIdentifier`, `state`). */
interface AnfrageRoh {
  person?: { domainIdentifier?: string };
  inviteeId?: number;
  state?: string;
}

/** Gruppentreffen ab heute; abgesagte zählen nicht. `null` = nicht freigegeben (403). */
async function treffenLesen(gruppe: number, von: string, bis: string): Promise<Treffen[] | null> {
  try {
    const roh =
      (await ctDaten<{ id: number; startDate: string; isCanceled?: boolean }[]>(
        `/groups/${gruppe}/meetings?start_date=${von}&end_date=${bis}`,
      )) ?? [];
    return roh.filter((t) => !t.isCanceled).map((t) => ({ id: t.id, beginn: t.startDate }));
  } catch (e) {
    if (e instanceof KeinSpeicherRecht) return null;
    throw e;
  }
}

/**
 * **Die Sitzungen einer Gruppe** – Protokolle aus dem Speicher, Termine (mit Besprechungsanfrage) und Treffen.
 * `zeitzone` = die der Gemeinde (Standard: die des Geräts, wie im Dienstplaner).
 */
export async function ladeSitzungen(
  modul: number,
  gruppe: Pick<ProtokollGruppe, 'id' | 'protokolle'>,
  zeitzone = Intl.DateTimeFormat().resolvedOptions().timeZone,
  jetzt = new Date(),
): Promise<GruppenSitzungen> {
  const koepfe: ProtokollKopf[] = [];
  const teile: ProtokollTeil[] = [];
  let kalender: number | null = null;
  if (gruppe.protokolle !== null) {
    for (const w of await werteLesen(modulPort, modul, gruppe.protokolle)) {
      const x = wertInhalt(w);
      if (istKopf(x)) koepfe.push(x);
      else if (istTeil(x)) teile.push(x);
      else if (istEinstellung(x) && x.gruppe === gruppe.id) kalender = x.kalender;
    }
  }
  // „Heute“ in derselben Zeitzone wie die Sitzungen – sonst wäre kurz vor Mitternacht ein Tag verschoben.
  const heute = tagAusIso(jetzt.toISOString(), zeitzone);
  const bis = plusTage(heute, KOMMEND_TAGE);
  const [termine, treffen] = await Promise.all([
    kalender === null ? Promise.resolve([]) : termineMitAnfrage(kalender, heute, bis),
    treffenLesen(gruppe.id, heute, bis),
  ]);
  return {
    ...sitzungenOrdnen({ termine, treffen: treffen ?? [], koepfe, heute, zeitzone }),
    teile,
    kalender,
    treffenNichtFreigegeben: treffen === null,
  };
}

/** **Die Aufgaben einer Gruppe** (gelöschte nicht). Ohne Mitarbeit-Kategorie: keine. Gelesen über `aufgabenWerte`. */
export async function ladeAufgaben(
  modul: number,
  gruppe: Pick<ProtokollGruppe, 'mitarbeit'>,
): Promise<Aufgabe[]> {
  if (gruppe.mitarbeit === null) return [];
  return (await aufgabenWerte({ modul, kategorie: gruppe.mitarbeit }))
    .map((x) => x.aufgabe)
    .filter((a) => !a.geloescht);
}

export interface GruppenUebersicht {
  gruppe: ProtokollGruppe;
  sitzungen: GruppenSitzungen;
  aufgaben: Aufgabe[];
}

/**
 * **Alles für die Startseite** (S3-3): Sitzungen und Aufgaben jeder Gruppe, höchstens zwei Gruppen gleichzeitig.
 * Scheitert eine Gruppe, wird geworfen – lieber „Erneut versuchen“ als eine Startseite, der still eine Gruppe fehlt.
 */
export async function ladeUebersicht(
  modul: number,
  gruppen: readonly ProtokollGruppe[],
  zeitzone = Intl.DateTimeFormat().resolvedOptions().timeZone,
  jetzt = new Date(),
): Promise<GruppenUebersicht[]> {
  const ergebnis = new Map<number, GruppenUebersicht>();
  await mapLimit([...gruppen], 2, async (gruppe) => {
    const [sitzungen, aufgaben] = await Promise.all([
      ladeSitzungen(modul, gruppe, zeitzone, jetzt),
      ladeAufgaben(modul, gruppe),
    ]);
    ergebnis.set(gruppe.id, { gruppe, sitzungen, aufgaben });
  });
  return gruppen.map((g) => ergebnis.get(g.id)!);
}
