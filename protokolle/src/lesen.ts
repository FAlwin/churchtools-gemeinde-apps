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
import { gemeindeZeitzone, heuteImKalender, tagAusIso } from '@shared/ct/zeit';
import { plusTage } from '@shared/ct/datum';
import { mapLimit } from '@shared/ct/mapLimit';
import { istEinstellung, type PunkteVonMitgliedern } from '@shared/protokolle/einrichten';
import type { ProtokollGruppe } from '@shared/protokolle/gruppen';
import { istAufgabe, type Aufgabe } from '@shared/protokolle/aufgaben';
import { istVorschlag, type Vorschlag } from '@shared/protokolle/vorschlaege';
import { derArt, mitarbeitRoh } from './mitarbeitWerte';
import {
  istKopf,
  istTeil,
  wertInhalt,
  type ProtokollKopf,
  type ProtokollTeil,
} from '@shared/protokolle/speicher';
import { zeitAusTermin } from '@shared/protokolle/bearbeiten';
import {
  minute,
  sitzungenOrdnen,
  type Anfrage,
  type Sitzung,
  type Termin,
  type Treffen,
} from '@shared/protokolle/sitzungen';
import { ApiError } from '@ui/ct/fehler';
import { modulPort } from '@ui/ct/modulPort';
import { ctDaten, KeinSpeicherRecht } from '@ui/ct/verbindung';
import { anfragenLesen, terminLaden } from './termin';

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
  /** Punkte von Mitgliedern (Einstellung, S5-4): vorschlagen oder direkt eintragen. Ohne Einstellung: vorschlagen. */
  punkte: PunkteVonMitgliedern;
  /** ChurchTools zeigt dieser Person die Gruppentreffen nicht (403) – „Kommend“ ist dann nur der Kalender. */
  treffenNichtFreigegeben: boolean;
}

interface TerminRoh {
  base?: { id: number; title: string; calendar?: { id: number } };
  appointment?: { base?: { id: number; title: string; calendar?: { id: number } } };
  calculated?: { startDate?: string; endDate?: string };
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
    const ende = r.calculated?.endDate;
    if (b && beginn)
      alle.push({ kalender, id: b.id, titel: b.title, beginn, ...(ende ? { ende } : {}) });
  }
  // Je Termin einmal fragen (die Liste zeigt es nicht – gemessen); eine Serie hat dieselbe ID → einmal genügt.
  const anfragen = new Map<number, Anfrage[]>();
  await mapLimit([...new Set(alle.map((t) => t.id))], GLEICHZEITIG, async (id) => {
    const liste = await anfragenLesen({ kalender, id });
    if (liste.length)
      anfragen.set(
        id,
        liste.map(({ person, antwort }) => ({ person, antwort })),
      );
  });
  return alle.flatMap((t) => {
    const a = anfragen.get(t.id);
    return a ? [{ ...t, anfragen: a }] : [];
  });
}

/**
 * **Termine hinter dem Lesefenster, an denen ein Protokoll hängt** (geplant oder begonnen) – sonst kämen solche
 * Sitzungen ohne Einladungen und Zusagen (Kasten „Nächste Sitzung“, Startseite; bemerkt beim Prüfen von K2b in der
 * Test-Instanz 29.10.2026). Je Termin einmal gelesen; ein gelöschter Termin (404) fällt weg, alles andere wird geworfen
 * wie beim Kalender. Was schon im Fenster liegt (gleiche ID, gleiche Minute), kommt nicht doppelt.
 */
async function termineJenseits(
  koepfe: readonly ProtokollKopf[],
  bis: string,
  zeitzone: string,
  imFenster: readonly Termin[],
): Promise<Termin[]> {
  const hinten = koepfe.filter(
    (k) => k.termin !== null && k.status !== 'frei' && tagAusIso(k.beginn, zeitzone) > bis,
  );
  const gelesen = new Map<
    string,
    { roh: Awaited<ReturnType<typeof terminLaden>>; anfragen: Anfrage[] } | null
  >();
  const schluessel = (t: { kalender: number; id: number }) => `${t.kalender}:${t.id}`;
  await mapLimit(
    [...new Map(hinten.map((k) => [schluessel(k.termin!), k.termin!])).values()],
    GLEICHZEITIG,
    async (t) => {
      try {
        const [roh, anfragen] = await Promise.all([terminLaden(t), anfragenLesen(t)]);
        gelesen.set(schluessel(t), {
          roh,
          anfragen: anfragen.map(({ person, antwort }) => ({ person, antwort })),
        });
      } catch (e) {
        if (e instanceof ApiError && e.status === 404) gelesen.set(schluessel(t), null);
        else throw e;
      }
    },
  );
  const da = new Set(imFenster.map((t) => `${t.kalender}:${t.id}:${minute(t.beginn)}`));
  return hinten.flatMap((k) => {
    const g = gelesen.get(schluessel(k.termin!));
    if (!g?.anfragen.length) return [];
    const zeit = zeitAusTermin(g.roh, k.beginn);
    if (da.has(`${k.termin!.kalender}:${k.termin!.id}:${minute(zeit.beginn)}`)) return [];
    return [
      {
        kalender: k.termin!.kalender,
        id: k.termin!.id,
        titel: typeof g.roh.title === 'string' ? g.roh.title : k.titel,
        ...zeit,
        anfragen: g.anfragen,
      },
    ];
  });
}

/**
 * Gruppentreffen von `von` bis einschließlich `bis` (`JJJJ-MM-TT`); abgesagte zählen nicht. `null` = nicht freigegeben
 * (403). ChurchTools zählt `end_date` **nicht** mit (gemessen 28.10.2026: `start_date` = `end_date` liefert nichts) –
 * deshalb wird ein Tag weiter gefragt. Die eine Stelle dafür: „Kommend“ und das Nachlesen in S5-2 (`planen.ts`).
 */
export async function treffenLesen(
  gruppe: number,
  von: string,
  bis: string,
): Promise<Treffen[] | null> {
  try {
    const roh =
      (await ctDaten<{ id: number; startDate: string; isCanceled?: boolean }[]>(
        `/groups/${gruppe}/meetings?start_date=${von}&end_date=${plusTage(bis, 1)}`,
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
  zeitzone = gemeindeZeitzone(),
  jetzt = new Date(),
): Promise<GruppenSitzungen> {
  const koepfe: ProtokollKopf[] = [];
  const teile: ProtokollTeil[] = [];
  let kalender: number | null = null;
  let punkte: PunkteVonMitgliedern = 'vorschlagen';
  if (gruppe.protokolle !== null) {
    for (const w of await werteLesen(modulPort, modul, gruppe.protokolle)) {
      const x = wertInhalt(w);
      if (istKopf(x)) koepfe.push(x);
      else if (istTeil(x)) teile.push(x);
      else if (istEinstellung(x) && x.gruppe === gruppe.id) {
        kalender = x.kalender;
        punkte = x.punkte;
      }
    }
  }
  // „Heute“ in derselben Zeitzone wie die Sitzungen – sonst wäre kurz vor Mitternacht ein Tag verschoben.
  const heute = heuteImKalender(jetzt, zeitzone);
  const bis = plusTage(heute, KOMMEND_TAGE);
  const [imFenster, treffen] = await Promise.all([
    kalender === null ? Promise.resolve([]) : termineMitAnfrage(kalender, heute, bis),
    treffenLesen(gruppe.id, heute, bis),
  ]);
  const termine = [...imFenster, ...(await termineJenseits(koepfe, bis, zeitzone, imFenster))];
  return {
    ...sitzungenOrdnen({ termine, treffen: treffen ?? [], koepfe, heute, zeitzone }),
    teile,
    kalender,
    punkte,
    treffenNichtFreigegeben: treffen === null,
  };
}

/**
 * **Was in „Mitarbeit“ steht** – To-Dos (gelöschte nicht) und Vorschläge (S5-4), **einmal** gelesen. Ohne
 * Mitarbeit-Kategorie: nichts.
 */
export async function ladeMitarbeit(
  modul: number,
  gruppe: Pick<ProtokollGruppe, 'mitarbeit'>,
): Promise<{ aufgaben: Aufgabe[]; vorschlaege: Vorschlag[] }> {
  if (gruppe.mitarbeit === null) return { aufgaben: [], vorschlaege: [] };
  const roh = await mitarbeitRoh({ modul, kategorie: gruppe.mitarbeit });
  return {
    aufgaben: derArt(roh, istAufgabe)
      .map((w) => w.x)
      .filter((a) => !a.geloescht),
    vorschlaege: derArt(roh, istVorschlag).map((w) => w.x),
  };
}

/** **Die Aufgaben einer Gruppe** (gelöschte nicht) – aus `ladeMitarbeit`. */
export async function ladeAufgaben(
  modul: number,
  gruppe: Pick<ProtokollGruppe, 'mitarbeit'>,
): Promise<Aufgabe[]> {
  return (await ladeMitarbeit(modul, gruppe)).aufgaben;
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
  zeitzone = gemeindeZeitzone(),
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
