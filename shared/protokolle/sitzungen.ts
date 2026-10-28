/**
 * **Die Sitzungen einer Gruppe** (Bauplan Protokolle S3-1) – aus drei Quellen zusammengeführt:
 * - **Termine** im Kalender der Gruppe, aber nur solche **mit Besprechungsanfrage** (Alwin, 23.10.2026: im Kalender
 *   stehen auch andere Termine). Ob ein Termin eine hat, zeigt ChurchTools nur je Termin
 *   (`…/appointments/{id}/meetingrequests`, gemessen S3-1) – das Filtern macht der Leser, hier kommen nur die
 *   passenden an;
 * - **Gruppentreffen** der Gruppe;
 * - **Protokoll-Köpfe** aus dem Speicher (sie verweisen auf Termin und Treffen, sobald S5 sie anlegt).
 *
 * „Kommend“ und „Protokolle“ wie im Entwurf 7: kommend ist alles, was noch nicht freigegeben ist – geplante und
 * begonnene Protokolle (egal wann) und Termine/Treffen ab heute ohne Protokoll. „Protokolle“ sind die freigegebenen,
 * neueste zuerst.
 */
import { tagAusIso } from '../ct/zeit';
import type { ProtokollKopf } from './speicher';

/** Die Antwort einer Person auf die Besprechungsanfrage (S3-3). */
export type Antwort = 'zugesagt' | 'abgesagt' | 'vielleicht' | 'offen';

export interface Anfrage {
  person: number;
  antwort: Antwort;
}

/**
 * ChurchTools-Zustand einer Besprechungsanfrage → unsere Antwort. `accepted | declined | pending | tentative` laut
 * OpenAPI der Test-Instanz (23.10.2026), `accepted` auch gemessen; Unbekanntes zählt als „offen“.
 */
export function antwortAus(state: unknown): Antwort {
  if (state === 'accepted') return 'zugesagt';
  if (state === 'declined') return 'abgesagt';
  if (state === 'tentative') return 'vielleicht';
  return 'offen';
}

export interface Termin {
  kalender: number;
  id: number;
  titel: string;
  /** Beginn, ISO (bei Serien der berechnete Beginn dieses Termins). */
  beginn: string;
  /** Ende, ISO – für die Dauer der nächsten Sitzung (S5-2). */
  ende?: string;
  /** Die Besprechungsanfragen – nur Termine mit mindestens einer kommen hier an. */
  anfragen: Anfrage[];
}

export interface Treffen {
  id: number;
  beginn: string;
}

export interface Sitzung {
  /** Stabil für die Liste: Kopf-ID, sonst Termin, sonst Treffen. */
  schluessel: string;
  beginn: string;
  /** Ende aus dem Termin (ISO) – fehlt ohne Termin. */
  ende?: string;
  titel: string;
  termin: { kalender: number; id: number } | null;
  treffen: number | null;
  kopf: ProtokollKopf | null;
  /** Besprechungsanfragen des Termins (leer ohne Termin). */
  anfragen: Anfrage[];
}

/** Gleicher Beginn auf die Minute – so gehören Termin und Treffen derselben Sitzung zusammen. */
export const minute = (iso: string): string => new Date(iso).toISOString().slice(0, 16);

/**
 * **Gehört dieser Protokoll-Kopf zu der Sitzung?** – gleiches Gruppentreffen, oder gleicher Termin. Bei einem
 * **Serientermin** (`serie`: dieselbe Termin-ID kommt mehrfach vor) zusätzlich zum selben Beginn – sonst hinge jede Woche
 * der Serie am selben Protokoll (gefunden beim Bau von S5-1). Ein einzelner Termin bleibt auch verschoben bei seinem
 * Protokoll. Die eine Stelle dafür: `sitzungenOrdnen` und „Protokoll beginnen“ (dort `serie` = sicherheitshalber ja).
 */
export function gehoertZu(
  kopf: Pick<ProtokollKopf, 'termin' | 'treffen' | 'beginn'>,
  s: { beginn: string; termin: { kalender: number; id: number } | null; treffen: number | null },
  serie = true,
): boolean {
  if (s.treffen !== null && kopf.treffen === s.treffen) return true;
  return (
    s.termin !== null &&
    kopf.termin?.kalender === s.termin.kalender &&
    kopf.termin.id === s.termin.id &&
    (!serie || minute(kopf.beginn) === minute(s.beginn))
  );
}

export function sitzungenOrdnen(q: {
  termine: readonly Termin[];
  treffen: readonly Treffen[];
  koepfe: readonly ProtokollKopf[];
  /** Heutiger Tag in der Zeitzone der Gemeinde, `JJJJ-MM-TT`. */
  heute: string;
  zeitzone: string;
}): { kommend: Sitzung[]; protokolle: Sitzung[] } {
  const sitzungen: Sitzung[] = q.koepfe.map((k) => ({
    schluessel: `p:${k.sitzung}`,
    beginn: k.beginn,
    titel: k.titel,
    termin: k.termin,
    treffen: k.treffen,
    kopf: k,
    anfragen: [],
  }));
  const zuKopf = (pruefen: (s: Sitzung) => boolean): Sitzung | undefined =>
    sitzungen.find((s) => s.kopf && pruefen(s));

  const anzahl = (t: Termin) =>
    q.termine.filter((x) => x.kalender === t.kalender && x.id === t.id).length;
  for (const t of q.termine) {
    const termin = { beginn: t.beginn, termin: { kalender: t.kalender, id: t.id }, treffen: null };
    const da =
      zuKopf((s) => gehoertZu(s.kopf!, termin, anzahl(t) > 1)) ??
      sitzungen.find((s) => !s.termin && minute(s.beginn) === minute(t.beginn));
    if (da) {
      da.termin ??= { kalender: t.kalender, id: t.id };
      if (!da.kopf) da.titel = t.titel;
      if (t.ende) da.ende = t.ende;
      da.anfragen = t.anfragen;
      continue;
    }
    sitzungen.push({
      schluessel: `t:${t.kalender}:${t.id}:${t.beginn}`,
      beginn: t.beginn,
      ...(t.ende ? { ende: t.ende } : {}),
      titel: t.titel,
      termin: { kalender: t.kalender, id: t.id },
      treffen: null,
      kopf: null,
      anfragen: t.anfragen,
    });
  }
  for (const t of q.treffen) {
    const da =
      zuKopf((s) => gehoertZu(s.kopf!, { beginn: t.beginn, termin: null, treffen: t.id })) ??
      sitzungen.find((s) => s.treffen === null && minute(s.beginn) === minute(t.beginn));
    if (da) {
      da.treffen ??= t.id;
      continue;
    }
    sitzungen.push({
      schluessel: `g:${t.id}`,
      beginn: t.beginn,
      titel: 'Gruppentreffen',
      termin: null,
      treffen: t.id,
      kopf: null,
      anfragen: [],
    });
  }

  const zeit = (s: Sitzung): number => Date.parse(s.beginn);
  const kommend = sitzungen
    .filter((s) => (s.kopf ? s.kopf.status !== 'frei' : tagAusIso(s.beginn, q.zeitzone) >= q.heute))
    .sort((a, b) => zeit(a) - zeit(b));
  const protokolle = sitzungen
    .filter((s) => s.kopf?.status === 'frei')
    .sort((a, b) => zeit(b) - zeit(a));
  return { kommend, protokolle };
}

/** Meine Antwort auf die Besprechungsanfrage – `null`, wenn ich nicht eingeladen bin (oder es keinen Termin gibt). */
export function meineAntwort(s: Pick<Sitzung, 'anfragen'>, ich: number): Antwort | null {
  return s.anfragen.find((a) => a.person === ich)?.antwort ?? null;
}

export interface GruppenSitzung {
  gruppe: { id: number; name: string };
  sitzung: Sitzung;
}

/**
 * **Nächste Sitzungen über alle Gruppen** (Startseite, S3-3): was ab heute ansteht und noch nicht freigegeben ist,
 * früheste zuerst. Ein begonnenes Protokoll von gestern gehört nicht hierher (es steht unter „Sitzungen“).
 */
export function naechsteSitzungen(
  jeGruppe: readonly { gruppe: { id: number; name: string }; kommend: readonly Sitzung[] }[],
  heute: string,
  zeitzone: string,
): GruppenSitzung[] {
  return jeGruppe
    .flatMap((g) =>
      g.kommend
        .filter((s) => tagAusIso(s.beginn, zeitzone) >= heute)
        .map((sitzung) => ({ gruppe: g.gruppe, sitzung })),
    )
    .sort((a, b) => Date.parse(a.sitzung.beginn) - Date.parse(b.sitzung.beginn));
}
