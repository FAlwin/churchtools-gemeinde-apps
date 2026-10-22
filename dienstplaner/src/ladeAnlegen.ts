/**
 * **Was das Fenster „Ablauf anlegen“ im Dienstplaner braucht** (Bauplan E6-5a): die Ablauf-Vorlagen und frühere
 * Termine mit Ablauf für „Wie eine frühere“. Die Regeln (welche Vorlagen zuerst, welche Termine in welcher
 * Reihenfolge) stehen in `@shared/ct/ablaufVorschlaege` – dieselben wie in der Musik-App.
 *
 * Die Musik-App nimmt die früheren Termine aus ihrer geladenen Liste. Der Dienstplaner hat in der Termin-Ansicht
 * keine solche Liste; er liest die Termine der Wochen davor und fragt nur die jüngsten nach ihrem Ablauf (je eine
 * Abfrage, höchstens `PRUEFEN` und vier gleichzeitig) – E6-0: je Ablauf ~0,23 s.
 */
import type { AblaufVorlage } from '@shared/types/index';
import type { CtAblaufVorlage, CtAgenda } from '@shared/ct/typen';
import { vorlagenAus } from '@shared/ct/ablaufAnlegen';
import { kopieVorschlaege } from '@shared/ct/ablaufVorschlaege';
import { kalenderVon } from '@shared/ct/ablaufRecht';
import { kachel, plusTage } from '@shared/ct/datum';
import { tagAusIso } from '@shared/ct/zeit';
import { mapLimit } from '@shared/ct/mapLimit';
import type { KopieVorschlag } from '@ui/ablauf/AblaufAnlegenFenster';
import { ApiError } from '@ui/ct/fehler';
import { ctDaten } from '@ui/ct/verbindung';
import { ladeAblauf } from './ladeBeiwerk';

/** So weit zurück wird gesucht. */
export const WOCHEN_ZURUECK = 12;
/** So viele Vorschläge höchstens. */
export const VORSCHLAEGE = 5;
/** So viele Termine werden höchstens nach ihrem Ablauf gefragt. */
const PRUEFEN = 10;

/** Die Ablauf-Vorlagen, nach Namen sortiert. Wirft, wenn keine Liste kommt. */
export async function ladeVorlagen(): Promise<AblaufVorlage[]> {
  const roh = await ctDaten<unknown>('/agendatemplates');
  if (!Array.isArray(roh)) throw new ApiError(502, 'ChurchTools hat die Vorlagen nicht geliefert.');
  return vorlagenAus(roh as CtAblaufVorlage[]);
}

interface RohTermin {
  id: number;
  name?: string;
  startDate: string;
  calendar?: { domainIdentifier?: unknown };
}

/**
 * Frühere Termine **mit Ablauf** zum Kopieren, jüngster zuerst: aus demselben Kalender, in den `WOCHEN_ZURUECK`
 * Wochen vor dem Termin. Ein Termin, dessen Ablauf sich gerade nicht lesen lässt, fällt weg – er wäre ohnehin keine
 * sichere Vorlage.
 */
export async function ladeKopieVorschlaege(
  ziel: { id: number; beginn: string; tag: string; kalenderId: number | null },
  zeitzone: string,
): Promise<KopieVorschlag[]> {
  const von = plusTage(ziel.tag, -7 * WOCHEN_ZURUECK);
  // `to` zählt bei ChurchTools nicht mit (E0) – der Tag des Termins selbst reicht als Grenze.
  const roh = await ctDaten<unknown>(`/events?from=${von}&to=${plusTage(ziel.tag, 1)}`);
  if (!Array.isArray(roh)) throw new ApiError(502, 'ChurchTools hat die Termine nicht geliefert.');
  const termine = (roh as RohTermin[]).map((t) => ({
    id: t.id,
    start: t.startDate,
    kalenderId: kalenderVon(t),
    name: t.name ?? 'Termin',
  }));
  const kandidaten = kopieVorschlaege(
    { id: ziel.id, start: ziel.beginn, kalenderId: ziel.kalenderId },
    termine,
  ).slice(0, PRUEFEN);
  const ablaeufe = new Map<number, CtAgenda>();
  await mapLimit(kandidaten, 4, async (t) => {
    try {
      const a = await ladeAblauf(t.id);
      if (a) ablaeufe.set(t.id, a);
    } catch {
      /* nicht lesbar → kein Vorschlag */
    }
  });
  return kandidaten
    .filter((t) => ablaeufe.has(t.id))
    .slice(0, VORSCHLAEGE)
    .map((t) => {
      const k = kachel(tagAusIso(t.start, zeitzone));
      const n = ablaeufe.get(t.id)?.items.length ?? 0;
      return {
        id: t.id,
        titel: `${k.tag}. ${k.monat} · ${t.name}`,
        meta: n === 0 ? 'leer' : n === 1 ? '1 Punkt' : `${n} Punkte`,
      };
    });
}
