/**
 * **Die Antworten aus „Verfügbarkeit“ für die Ansicht „Personen“ laden** (Bauplan E5c-3). Der Speicher liegt je
 * **Dienstgruppe** in einer Kategorie (`antwortenSchublade`), ein Wert je Person (Regeln und Messwerte in
 * `@shared/dienstplan/verfuegbarkeit`). Hier werden **alle Personen** einer Kategorie gelesen (`alleAntwortenLesen`) und
 * über die Kategorien zusammengeführt – mit derselben Regel wie bei den eigenen Antworten (`antwortenZusammen`, neuester
 * `stand`).
 *
 * Gelesen werden nur die Dienstgruppen, die der Aufrufer nennt (die planbaren, deren Dienste im Raster stehen – und
 * für „Vertretung suchen“ (E5c-6) die **eigenen**; fremde Antworten zeigt die App sonst nur Planern). Mit den Antworten kommen
 * die gesuchten Vertretungen (`vertretungen`, aus demselben Wert). Zum Lesen genügt das Recht **„sehen“** auf die Kategorie (nicht „bereit“).
 *
 * **Die Zweige einzeln – vorübergehend ist nicht ungültig:**
 * - **Kategorie fehlt oder kein Recht „sehen“ / ChurchTools verweigert das Lesen** = die Dienstgruppe ist **nicht sichtbar**
 *   (dauerhaft, kein Wiederholen) – der Block sagt es, es erscheint keine Farbe.
 * - **401** (abgemeldet) **wirft**.
 * - **alles andere** (Netz, Zeitüberschreitung, 5xx, gebremst) **wirft** ebenfalls – und zwar für das Ganze: Ein halbes
 *   Ergebnis wäre „Antworten fehlen“, von „keine Antworten“ nicht zu unterscheiden. `useLaden` mit `behalten` hält dann die
 *   bisherigen Antworten und zeigt den Fehler mit „Nochmal versuchen“.
 * Keine Namen oder IDs von Personen in `console.*`.
 */
import { kategorieAusListe, kategorienLesen } from '@shared/ct/modulDaten';
import { mapLimit } from '@shared/ct/mapLimit';
import type { Dienstgruppe } from '@shared/ct/dienstgruppen';
import type { ModulRechte } from '@shared/ct/modulRechte';
import { modulRechteAus, type EntwurfPort } from '@shared/dienstplan/entwuerfe';
import { KEINE_ANTWORTEN, type PersonenAntworten } from '@shared/dienstplan/personenAntworten';
import {
  alleAntwortenLesen,
  antwortenSchublade,
  antwortenZusammen,
  fertigZusammen,
  vertretungenZusammen,
  type StandAntworten,
  type VerfuegbarkeitGrund,
} from '@shared/dienstplan/verfuegbarkeit';
import { modulId, port } from './ladeEntwuerfe';
import { MODUL_KUERZEL } from './start';

/** Was die Ansicht zum Laden braucht – `Planen` bekommt es von der App (mit den planbaren Dienstgruppen aus dem Start). */
export type AntwortenLader = (dienstgruppenIds: readonly number[]) => Promise<PersonenAntworten>;

/** So viele Kategorien gleichzeitig – ChurchTools bremst sonst (HTTP 429). */
export const GLEICHZEITIG = 3;

/**
 * Der Kern ohne Netz-Technik (Tests reichen einen nachgebauten Speicher herein): Rechte und Kategorie-Liste sind schon da.
 * **Wirft** bei 401 und bei jeder vorübergehenden Störung (s. oben).
 */
export async function antwortenLesen(
  p: EntwurfPort,
  modul: number,
  rechte: ModulRechte,
  kategorien: readonly { id: number; shorty: string }[],
  gruppen: readonly Dienstgruppe[],
): Promise<PersonenAntworten> {
  const zeilen = [...new Map(gruppen.map((g) => [g.id, g])).values()].flatMap((gruppe) => {
    const kategorie = kategorieAusListe(kategorien, antwortenSchublade(gruppe).kuerzel);
    // Zum Lesen genügt „sehen“ – nicht „bereit“ (das wäre sehen + ändern + löschen).
    return kategorie !== null && rechte.sehen.includes(kategorie) ? [{ gruppe, kategorie }] : [];
  });

  const jeKategorie = new Map<number, ReadonlyMap<number, StandAntworten>>();
  const sichtbar = new Set<number>();
  const gescheitert: VerfuegbarkeitGrund[] = [];
  await mapLimit(zeilen, GLEICHZEITIG, async ({ gruppe, kategorie }) => {
    const r = await alleAntwortenLesen(p, modul, kategorie);
    if (r.ok) {
      jeKategorie.set(kategorie, r.wert);
      sichtbar.add(gruppe.id);
    } else if (r.grund !== 'kein-recht') {
      gescheitert.push(r.grund); // 'kein-recht': die Gruppe bleibt unsichtbar – dauerhaft, kein Fehler
    }
  });
  if (gescheitert.includes('abgemeldet'))
    throw p.fehler(401, 'Du bist bei ChurchTools nicht mehr angemeldet.');
  if (gescheitert.length > 0) throw p.fehler(503, 'ChurchTools antwortet gerade nicht.');
  return {
    jePerson: antwortenZusammen(jeKategorie),
    sichtbar,
    vertretungen: vertretungenZusammen(jeKategorie),
    fertig: fertigZusammen(jeKategorie),
  };
}

/**
 * Lädt die Antworten der Personen für diese Dienstgruppen. Die Rechte jedes Mal frisch (wie bei den Entwürfen: wer eine
 * Schublade eben eingerichtet hat, hat erst jetzt Rechte darauf). Verweigert ChurchTools schon die Rechte oder die Liste der
 * Kategorien, sieht man nichts – ohne Fehler. Ohne Dienstgruppen gibt es nichts zu lesen und keinen Netzaufruf.
 */
export async function ladeAntworten(gruppen: readonly Dienstgruppe[]): Promise<PersonenAntworten> {
  if (gruppen.length === 0) return KEINE_ANTWORTEN;
  try {
    const modul = await modulId();
    const [rechteRoh, liste] = await Promise.all([
      port.daten<Record<string, unknown> | null>('/permissions/global'),
      kategorienLesen(port, modul),
    ]);
    const rechte = modulRechteAus(rechteRoh?.[MODUL_KUERZEL]);
    return await antwortenLesen(port, modul, rechte, liste, gruppen);
  } catch (e) {
    if (port.istKeinRecht(e)) return KEINE_ANTWORTEN; // verweigert = dauerhaft nicht sichtbar
    throw e;
  }
}
