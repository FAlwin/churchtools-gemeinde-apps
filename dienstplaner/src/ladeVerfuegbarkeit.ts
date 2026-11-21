/**
 * **„Wann kann ich?“ – Ja/Vielleicht laden und speichern** (Bauplan E5c-1c): der Browser-Teil zum Speicher-Kern
 * `@shared/dienstplan/verfuegbarkeit` (Regeln und Messwerte dort). Eine Kategorie je **eigener** Dienstgruppe
 * (`eigeneDienstgruppen` in `start.ts`); gelesen und geschrieben wird über alle Kategorien, die **bereit** sind
 * (sehen, ändern und löschen erlaubt – `schubladenStand`, dieselbe Regel wie bei den Entwürfen).
 *
 * Zwei Grundsätze:
 * - **Lesen schlägt fehl → nicht schreiben.** Wer auf einem unbekannten Stand schreibt, überschreibt fremde Arbeit
 *   (die Antworten stehen als Ganzes in einem Wert). Dann sind Ja/Vielleicht gesperrt, „Nein“ geht weiter.
 * - **Vorübergehend ist nicht „kein Recht“.** Die Meldung unterscheidet je Dienstgruppe, warum es nicht ging.
 */
import { kategorieAusListe, kategorienLesen, kategorieSicherstellen } from '@shared/ct/modulDaten';
import type { Dienstgruppe } from '@shared/ct/dienstgruppen';
import {
  modulRechteAus,
  schubladenStand,
  type EntwurfPort,
  type SchubladenStand,
} from '@shared/dienstplan/entwuerfe';
import {
  antwortenSchublade,
  eigeneAntwortenLesen,
  eigeneAntwortenSchreiben,
  type Antworten,
  type VerfuegbarkeitGrund,
  type Vertretungen,
} from '@shared/dienstplan/verfuegbarkeit';
import type { ModulRechte } from '@shared/ct/modulRechte';
import { modulId, port } from './ladeEntwuerfe';
import { MODUL_KUERZEL } from './start';

export interface EigeneSchublade {
  gruppe: Dienstgruppe;
  /** `null` = nicht zu sehen (fehlt oder kein Recht – ChurchTools unterscheidet das nicht). */
  kategorie: number | null;
  stand: SchubladenStand;
}

export interface Verfuegbarkeit {
  modul: number;
  /** Eine Zeile je eigener Dienstgruppe. */
  gruppen: EigeneSchublade[];
  /** Die Kategorien, in die geschrieben werden kann (und aus denen gelesen wird). */
  bereit: number[];
  /** Die eigenen gespeicherten Antworten; leer, wenn nichts da ist oder nichts gelesen werden konnte. */
  antworten: Antworten;
  /** Die eigenen gesuchten Vertretungen (E5c-6); leer, wenn keine da ist oder nichts gelesen werden konnte. */
  vertretungen: Vertretungen;
  /** Lesen ging schief – dann steht `antworten` für nichts, und es wird nicht geschrieben. */
  lesefehler: VerfuegbarkeitGrund | null;
}

/** Ohne eigene Dienstgruppe gibt es nichts zu lesen – und keinen Netzaufruf. */
export const KEINE_VERFUEGBARKEIT: Verfuegbarkeit = {
  modul: 0,
  gruppen: [],
  bereit: [],
  antworten: {},
  vertretungen: {},
  lesefehler: null,
};

/**
 * Der Kern ohne Netz-Technik (Tests reichen einen nachgebauten Speicher herein): Stand je Dienstgruppe aus Rechten und
 * Kategorie-Liste, dann die eigenen Antworten aus allen bereiten Kategorien.
 */
export async function verfuegbarkeitLesen(
  p: EntwurfPort,
  modul: number,
  rechte: ModulRechte,
  kategorien: readonly { id: number; shorty: string }[],
  gruppen: readonly Dienstgruppe[],
  person: number,
): Promise<Verfuegbarkeit> {
  const zeilen = gruppen.map((gruppe): EigeneSchublade => {
    const kategorie = kategorieAusListe(kategorien, antwortenSchublade(gruppe).kuerzel);
    return { gruppe, kategorie, stand: schubladenStand(rechte, kategorie) };
  });
  const bereit = zeilen
    .filter((z) => z.stand === 'bereit' && z.kategorie !== null)
    .map((z) => z.kategorie as number);
  if (bereit.length === 0) {
    return { modul, gruppen: zeilen, bereit, antworten: {}, vertretungen: {}, lesefehler: null };
  }
  const r = await eigeneAntwortenLesen(p, modul, bereit, person);
  if (!r.ok)
    return { modul, gruppen: zeilen, bereit, antworten: {}, vertretungen: {}, lesefehler: r.grund };
  return {
    modul,
    gruppen: zeilen,
    bereit,
    antworten: r.wert.antworten,
    vertretungen: r.wert.vertretungen,
    lesefehler: null,
  };
}

/**
 * Lädt für die Person die Lage von „Wann kann ich?“. **Wirft**, wenn schon das Modul oder die Liste der Kategorien
 * nicht lesbar ist – der Aufrufer sperrt dann Ja/Vielleicht. Die Rechte jedes Mal frisch (wie bei den Entwürfen: wer
 * eine Schublade eben eingerichtet hat, hat erst jetzt Rechte darauf).
 */
export async function ladeVerfuegbarkeit(
  gruppen: readonly Dienstgruppe[],
  person: number,
): Promise<Verfuegbarkeit> {
  if (gruppen.length === 0) return KEINE_VERFUEGBARKEIT;
  const modul = await modulId();
  const [rechteRoh, liste] = await Promise.all([
    port.daten<Record<string, unknown> | null>('/permissions/global'),
    kategorienLesen(port, modul),
  ]);
  const rechte = modulRechteAus(rechteRoh?.[MODUL_KUERZEL]);
  return verfuegbarkeitLesen(port, modul, rechte, liste, gruppen, person);
}

/** Der Hinweis oben auf der Seite, wenn Ja/Vielleicht nicht geht – `null`, wenn es geht. */
export function verfuegbarkeitHinweis(v: Verfuegbarkeit): string | null {
  if (v.lesefehler) return 'Ja/Vielleicht geht gerade nicht: ' + grundSatz(v.lesefehler);
  if (v.bereit.length > 0) return null;
  if (v.gruppen.length === 0) {
    return 'Ja/Vielleicht gibt es für dich noch nicht, weil du in keiner Dienstgruppe bist – Nein geht schon.';
  }
  return 'Ja/Vielleicht ist für deine Dienstgruppen noch nicht eingerichtet – Nein geht schon.';
}

/** Die Dienstgruppen, für die man den Speicher selbst einrichten darf (nur wenn sonst nichts bereit ist). */
export function einrichtbareGruppen(v: Verfuegbarkeit): Dienstgruppe[] {
  if (v.bereit.length > 0 || v.lesefehler) return [];
  return v.gruppen.filter((z) => z.stand === 'einrichtbar').map((z) => z.gruppe);
}

/** Warum Speichern oder Lesen nicht ging – in Worten (auch für „Vertretung suchen“, E5c-6). */
export function grundSatz(g: VerfuegbarkeitGrund): string {
  switch (g) {
    case 'abgemeldet':
      return 'Du bist bei ChurchTools nicht mehr angemeldet. Bitte die Seite neu laden.';
    case 'kein-recht':
      return 'ChurchTools erlaubt es dir nicht. Bitte die Gemeinde-Verwaltung nach dem Recht fragen.';
    case 'voruebergehend':
      return 'ChurchTools antwortet gerade nicht. Nichts verloren – bitte gleich noch einmal versuchen.';
    case 'nicht-angekommen':
      return 'ChurchTools hat es nicht übernommen. Bitte noch einmal versuchen.';
    case 'zu-gross':
      return 'Es sind zu viele Antworten für einen Eintrag.';
  }
}

export type SpeichernErgebnis = { ok: true } | { ok: false; text: string };

/**
 * Die vollständige Antworten-Karte in alle bereiten Kategorien schreiben (Kern: `eigeneAntwortenSchreiben`, nacheinander,
 * nichts wird wiederholt, Erfolg ist erst, was nachgelesen dasteht). **Ehrlich je Dienstgruppe**: Gelang nur ein Teil,
 * steht da, für welche Gruppe nicht und warum.
 */
export async function verfuegbarkeitSpeichern(
  p: EntwurfPort,
  v: Verfuegbarkeit,
  person: number,
  antworten: Antworten,
  heute: string,
): Promise<SpeichernErgebnis> {
  if (v.lesefehler || v.bereit.length === 0) {
    return { ok: false, text: verfuegbarkeitHinweis(v) ?? 'Ja/Vielleicht geht gerade nicht.' };
  }
  const ergebnisse = await eigeneAntwortenSchreiben(p, v.modul, v.bereit, person, antworten, heute);
  const fehler = ergebnisse.flatMap((e) => (e.ok ? [] : [e]));
  if (fehler.length === 0) return { ok: true };
  const name = (kategorie: number): string =>
    v.gruppen.find((z) => z.kategorie === kategorie)?.gruppe.name ?? 'deine Dienstgruppe';
  const teile = fehler.map(
    (e) => `Für „${name(e.kategorie)}“ nicht gespeichert: ${grundSatz(e.grund)}`,
  );
  const teilweise = fehler.length < ergebnisse.length;
  return {
    ok: false,
    text: (teilweise ? 'Ja/Vielleicht nur zum Teil gespeichert. ' : '') + teile.join(' '),
  };
}

export function speichereVerfuegbarkeit(
  v: Verfuegbarkeit,
  person: number,
  antworten: Antworten,
  heute: string,
): Promise<SpeichernErgebnis> {
  return verfuegbarkeitSpeichern(port, v, person, antworten, heute);
}

const VERWEIGERT_ANLEGEN =
  'ChurchTools erlaubt dir nicht, Kategorien anzulegen. Das kann die Gemeinde-Verwaltung einrichten.';

/**
 * Die Speicher für die Antworten einrichten (nur wer Kategorien anlegen darf; wer sie anlegt, bekommt sofort alle
 * Rechte darauf). Nacheinander; `kategorieSicherstellen` legt nur an, was (sichtbar) noch fehlt, und sieht danach nach.
 * Wirft beim ersten Fehlschlag – die übrigen werden dann nicht versucht.
 */
export async function richteAntwortenEin(gruppen: readonly Dienstgruppe[]): Promise<void> {
  const modul = await modulId();
  for (const g of gruppen) {
    await kategorieSicherstellen(port, modul, antwortenSchublade(g), VERWEIGERT_ANLEGEN);
  }
}
