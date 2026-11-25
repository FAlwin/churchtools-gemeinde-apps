/**
 * **Abfragen und Erinnerungsplan je Dienstgruppe – lesen und speichern** (Bauplan R-1, 25.11.2026). Ein Dokument je
 * Dienstgruppe (`art: 'dienstplaner-abfragen-<Dienstgruppen-ID>'`, Fassung 1) in der vorhandenen Kategorie „Einstellungen“
 * (`EINSTELLUNGEN_KATEGORIE` aus `liveEinstellungen.ts` – keine neue Ablage, keine neuen Rechte). Inhalt und Regeln:
 * `abfragen.ts`.
 *
 * **Nie ins Betriebsart-Dokument schreiben:** Dessen Schema (`einstellungenAus`) wirft fremde Felder beim Speichern weg.
 * Eigene `art` je Dienstgruppe – `versionierterWert` filtert beim Lesen nach `art`, die anderen Werte der Kategorie
 * (Betriebsart, Abfragen anderer Dienstgruppen) bleiben unberührt.
 *
 * Hausregeln wie `einstellungenLesen`/`einstellungenSpeichern`:
 *  - **Ohne Wert, ohne Kategorie oder bei unbekannter Form gilt der Standard** (kein eigener Plan, keine Abfrage).
 *  - **Ein Lesefehler ist ein eigenes Ergebnis** (`fehler`), kein „kein Wert“ – wer ihn sieht, speichert nicht.
 *  - **Geschrieben wird nie automatisch wiederholt**, erfolgreich ist erst, was nachgelesen dasteht.
 *
 * ChurchTools schützt nur die ganze Kategorie: **Wer eine Abfrage anlegen darf, prüft die Oberfläche** (Planer dieser
 * Dienstgruppe), hier steht nur die Regel für das ChurchTools-Recht an der Kategorie.
 */
import { kategorieSicherstellen, kategorieSuchen } from '../ct/modulDaten';
import {
  dokumentLesen,
  dokumentSpeichern,
  type Dokumentart,
  type SpeicherErgebnis,
  type SpeicherGrund,
  type VersionPort,
  type Versioniert,
} from '../ct/versionierterWert';
import { abfragenAus, type AbfragenInhalt } from './abfragen';
import { EINSTELLUNGEN_KATEGORIE } from './liveEinstellungen';

export const ABFRAGEN_FASSUNG = 1;

/** Die Art des Dokuments einer Dienstgruppe. */
export const abfragenArt = (dienstgruppeId: number): Dokumentart => ({
  art: `dienstplaner-abfragen-${dienstgruppeId}`,
  fassung: ABFRAGEN_FASSUNG,
});

export const ABFRAGEN_VERWEIGERT =
  'Die Abfragen dürfen nur Planer ändern – und wer in ChurchTools die Kategorie „Einstellungen“ des Dienstplaners bearbeiten darf.';

/** Der Inhalt, wenn nichts Lesbares dasteht: kein eigener Plan (= Standard), keine Abfrage, nicht eingerichtet. */
export const standardInhalt = (): AbfragenInhalt => ({
  plan: null,
  abfragen: [],
  einrichtung: null,
});

/** Was beim Lesen herauskommt. `inhalt` gilt **immer** (Standard, wenn nichts Lesbares dasteht). */
export interface AbfragenStand {
  inhalt: AbfragenInhalt;
  /** Der gespeicherte Wert samt Version – `null`: es gibt keinen (oder er war nicht zu lesen, dann steht `fehler` da). */
  gespeichert: Versioniert<AbfragenInhalt> | null;
  /** Der Wert war da, hatte aber nicht das erwartete Format – es gilt der Standard; Speichern ersetzt ihn. */
  unlesbar: boolean;
  /** Nicht lesbar (abgemeldet, kein Recht, vorübergehend) – dann gilt der Standard und es darf nicht gespeichert werden. */
  fehler: SpeicherGrund | null;
}

const standard = (teil: Partial<AbfragenStand> = {}): AbfragenStand => ({
  inhalt: standardInhalt(),
  gespeichert: null,
  unlesbar: false,
  fehler: null,
  ...teil,
});

function grundAus(p: VersionPort, e: unknown): SpeicherGrund {
  if (p.istAbgemeldet(e)) return 'abgemeldet';
  if (p.istKeinRecht(e)) return 'kein-recht';
  return 'voruebergehend';
}

/**
 * **Frisch lesen.** Die ID des Moduls kommt als Funktion (`modul`), weil die Suche nach ihr selbst scheitern kann – auch das
 * ist dann ein Lesefehler und kein „kein Wert“. Keine Kategorie (noch nie gespeichert – oder ChurchTools zeigt sie einem
 * nicht) = Standard.
 */
export async function abfragenLesen(
  p: VersionPort,
  modul: () => Promise<number>,
  dienstgruppeId: number,
): Promise<AbfragenStand> {
  let modulId: number;
  let kategorie: number | null;
  try {
    modulId = await modul();
    kategorie = await kategorieSuchen(p, modulId, EINSTELLUNGEN_KATEGORIE.kuerzel);
  } catch (e) {
    return standard({ fehler: grundAus(p, e) });
  }
  if (kategorie === null) return standard();
  const l = await dokumentLesen<unknown>(p, modulId, kategorie, abfragenArt(dienstgruppeId));
  if (!l.ok) return standard({ fehler: l.grund });
  if (l.daten === null) return standard();
  const inhalt = abfragenAus(l.daten.inhalt);
  return inhalt
    ? { inhalt, gespeichert: { ...l.daten, inhalt }, unlesbar: false, fehler: null }
    : standard({ gespeichert: { ...l.daten, inhalt: standardInhalt() }, unlesbar: true });
}

/**
 * **Speichern.** `erwartet` ist die gesehene Version (`null` = es gab keinen Wert). Steht inzwischen eine andere da, wird
 * nichts überschrieben (`konflikt`). Die Kategorie wird bei Bedarf angelegt (nur Admins) und danach nachgesehen.
 * Geschrieben wird nur, was `abfragenAus` wieder lesen würde – sonst wäre das Gespeicherte beim nächsten Lesen „unlesbar“.
 */
export async function abfragenSpeichern(
  p: VersionPort,
  modul: () => Promise<number>,
  dienstgruppeId: number,
  neu: AbfragenInhalt,
  von: { personId: number; name: string },
  erwartet: number | null,
): Promise<SpeicherErgebnis<AbfragenInhalt>> {
  if (abfragenAus(neu) === null) throw new Error('Ungültiger Inhalt für die Abfragen.');
  let modulId: number;
  let kategorie: number;
  try {
    modulId = await modul();
    kategorie = await kategorieSicherstellen(
      p,
      modulId,
      EINSTELLUNGEN_KATEGORIE,
      ABFRAGEN_VERWEIGERT,
    );
  } catch (e) {
    return { ok: false, grund: grundAus(p, e) };
  }
  return dokumentSpeichern(
    p,
    modulId,
    kategorie,
    abfragenArt(dienstgruppeId),
    neu,
    von,
    erwartet,
    ABFRAGEN_VERWEIGERT,
  );
}
