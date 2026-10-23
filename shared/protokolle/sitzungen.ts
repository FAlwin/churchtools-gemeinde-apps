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

export interface Termin {
  kalender: number;
  id: number;
  titel: string;
  /** Beginn, ISO (bei Serien der berechnete Beginn dieses Termins). */
  beginn: string;
}

export interface Treffen {
  id: number;
  beginn: string;
}

export interface Sitzung {
  /** Stabil für die Liste: Kopf-ID, sonst Termin, sonst Treffen. */
  schluessel: string;
  beginn: string;
  titel: string;
  termin: { kalender: number; id: number } | null;
  treffen: number | null;
  kopf: ProtokollKopf | null;
}

/** Gleicher Beginn auf die Minute – so gehören Termin und Treffen derselben Sitzung zusammen. */
const minute = (iso: string): string => new Date(iso).toISOString().slice(0, 16);

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
  }));
  const zuKopf = (pruefen: (s: Sitzung) => boolean): Sitzung | undefined =>
    sitzungen.find((s) => s.kopf && pruefen(s));

  for (const t of q.termine) {
    const da =
      zuKopf((s) => s.termin?.kalender === t.kalender && s.termin.id === t.id) ??
      sitzungen.find((s) => !s.termin && minute(s.beginn) === minute(t.beginn));
    if (da) {
      da.termin ??= { kalender: t.kalender, id: t.id };
      if (!da.kopf) da.titel = t.titel;
      continue;
    }
    sitzungen.push({
      schluessel: `t:${t.kalender}:${t.id}:${t.beginn}`,
      beginn: t.beginn,
      titel: t.titel,
      termin: { kalender: t.kalender, id: t.id },
      treffen: null,
      kopf: null,
    });
  }
  for (const t of q.treffen) {
    const da =
      zuKopf((s) => s.treffen === t.id) ??
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
