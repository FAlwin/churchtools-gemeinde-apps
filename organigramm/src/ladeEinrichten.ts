/**
 * **Was das Fenster „Gruppenwechsel einrichten“ zusätzlich liest** (Bauplan O9-5c-2) – nur lesen, nie schreiben:
 *
 * - `GET /calendars` – die Kalender, aus denen der Ferienkalender gewählt wird,
 * - `GET /group/grouptypes` – gibt es den Gruppentyp „Gruppenwechsel“?,
 * - `GET /dynamicgroups/{id}/ruleset` – die Regeln der gewählten Stufen-Gruppen (fremde Regeln = Stopp).
 *
 * **Nichts davon wirft:** 401 ist hier fehlendes Recht, kein Abmelden (wie `ladeEinrichtungStand`); 403, Netz, 5xx und eine
 * Antwort in unbekannter Gestalt sind „nicht gelesen“ – **vorübergehend ist nicht ungültig**, daraus wird nie „keine
 * Regeln“ oder „den Typ gibt es nicht“. Nur 404 beim Regel-Abruf heißt „keine Regeln“ (`regelnLesen`). Die Regeln werden
 * gedrosselt gelesen (vier Gruppen gleichzeitig, sonst antwortet ChurchTools mit 429).
 */
import { ctDaten } from '@ui/ct/verbindung';
import { mapLimit } from '@shared/ct/mapLimit';
import type { Gelesen, RegelRoh } from '@shared/organigramm/einrichtungStand';
import { istWechselTyp } from '@shared/organigramm/einrichtungPlan';
import { regelnLesen } from './ladeEinrichtungStand';

type Holen = <T>(pfad: string) => Promise<T>;

const GLEICHZEITIG = 4;
const NICHT: { ok: false } = { ok: false };

/** Die Namen der Kalender, die man sieht – eine Antwort, die keine Liste ist, zählt als nicht gelesen. */
export async function ladeKalenderNamen(holen: Holen = ctDaten): Promise<Gelesen<string[]>> {
  try {
    const roh = await holen<unknown>('/calendars');
    if (!Array.isArray(roh)) return NICHT;
    const namen = (roh as { name?: unknown }[]).flatMap((k) =>
      typeof k.name === 'string' && k.name.trim() !== '' ? [k.name] : [],
    );
    return { ok: true, wert: [...new Set(namen)] };
  } catch {
    return NICHT;
  }
}

/** Gibt es einen Gruppentyp „Gruppenwechsel“? (Feld `name`, nicht die Übersetzung.) */
export async function ladeTypVorhanden(holen: Holen = ctDaten): Promise<Gelesen<boolean>> {
  try {
    const roh = await holen<unknown>('/group/grouptypes');
    if (!Array.isArray(roh)) return NICHT;
    return { ok: true, wert: (roh as { name?: unknown }[]).some((t) => istWechselTyp(t.name)) };
  } catch {
    return NICHT;
  }
}

/** Die Regeln der gewählten Stufen-Gruppen. */
export async function ladeRegelnDerStufen(
  gruppeIds: readonly number[],
  holen: Holen = ctDaten,
): Promise<Map<number, Gelesen<readonly RegelRoh[]>>> {
  const aus = new Map<number, Gelesen<readonly RegelRoh[]>>();
  await mapLimit([...new Set(gruppeIds)], GLEICHZEITIG, async (id) => {
    aus.set(id, await regelnLesen(holen, id));
  });
  return aus;
}
