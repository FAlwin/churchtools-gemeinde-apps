/**
 * **Die Website im Speicher der Erweiterung** – die dünne Hülle der Oberfläche um `@shared/website/speicher` (dort stehen
 * Aufbau, Lesen und die Reihenfolge beim Schreiben) und `@shared/website/sperre` (wer bearbeitet gerade). Hier nur: der
 * Anschluss dieser Erweiterung (`modulPort`) und die Kategorie „Entwürfe“. Gelesen und geschrieben wird bis W3b nur dort;
 * „Veröffentlicht“ folgt mit der Freigabe.
 */
import { modulPort } from '@ui/ct/modulPort';
import type { Schreiber, Sperre } from '@shared/ct/sperre';
import {
  EINSTELLUNGEN_ID,
  einstellungenSpeichern,
  menueSpeichern,
  seiteLoeschen,
  seiteSpeichern,
  websiteAusWerten,
  websiteLesen,
  type SpeicherOrt,
  type WebsiteStand,
} from '@shared/website/speicher';
import {
  bearbeitungBeenden,
  bearbeitungBeginnen,
  bearbeitungUebernehmen,
} from '@shared/website/sperre';
import type { BeginnErgebnis } from '@shared/website/sperre';
import type { Einstellungen, Menue, Seite } from '@shared/website/modell';

export interface EntwurfsOrt {
  modul: number;
  /** Die Kategorie „Entwürfe“. */
  kategorie: number;
}

const ort = (o: EntwurfsOrt): SpeicherOrt => ({ p: modulPort, ...o });

export const ladeWebsite = (o: EntwurfsOrt): Promise<WebsiteStand> =>
  websiteLesen(modulPort, o.modul, o.kategorie);
export const speichereSeite = (o: EntwurfsOrt, seite: Seite) => seiteSpeichern(ort(o), seite);
export const loescheSeite = (o: EntwurfsOrt, id: string) => seiteLoeschen(ort(o), id);
export const speichereMenue = (o: EntwurfsOrt, menue: Menue) => menueSpeichern(ort(o), menue);

/**
 * Was beim Beginnen (oder Erneuern) des Bearbeitens herauskommt: die Sperre gehört uns – dann mit der **frisch gelesenen**
 * Seite und dem frischen Menü (der Editor sieht daran, ob jemand sie inzwischen geändert hat) – oder jemand anderes
 * bearbeitet.
 */
export type Beginn =
  | { art: 'ok'; seite: Seite | null; menue: Menue | null }
  | { art: 'gesperrt'; sperre: Sperre };

export async function beginneBearbeiten(
  o: EntwurfsOrt,
  seiteId: string,
  ich: Schreiber,
): Promise<Beginn> {
  return beginnAus(await bearbeitungBeginnen(ort(o), seiteId, ich), seiteId);
}

/** „Hier weiterbearbeiten“ / „Bearbeitung übernehmen“: die Sperre bewusst wegnehmen – sonst wie `beginneBearbeiten`. */
export async function uebernimmBearbeitung(
  o: EntwurfsOrt,
  seiteId: string,
  ich: Schreiber,
): Promise<Beginn> {
  return beginnAus(await bearbeitungUebernehmen(ort(o), seiteId, ich), seiteId);
}

function beginnAus(r: BeginnErgebnis, seiteId: string): Beginn {
  if (r.art === 'gesperrt') return r;
  const frisch = websiteAusWerten(r.werte);
  return {
    art: 'ok',
    seite: frisch.seiten.find((s) => s.id === seiteId) ?? null,
    menue: frisch.menue,
  };
}

/** Die eigene Sperre freigeben – „so gut es geht“: der Aufrufer fängt Fehler ab (die Sperre verfällt dann von selbst). */
export const beendeBearbeiten = (o: EntwurfsOrt, seiteId: string, ich: Schreiber) =>
  bearbeitungBeenden(ort(o), seiteId, ich);

// ── Einstellungen (Aussehen, W3a-3) ──────────────────────────────────────────────────────────────────────────────────────

/** Die Sperre der Einstellungen: derselbe Ablauf wie bei den Seiten (`sperre.ts`), nur mit festem Ziel. */
const EINSTELLUNGEN_ZIEL = { einheit: 'einstellungen', id: EINSTELLUNGEN_ID } as const;

export const speichereEinstellungen = (o: EntwurfsOrt, e: Einstellungen) =>
  einstellungenSpeichern(ort(o), e);

/** Wie `Beginn`, nur für die Einstellungen: `null` heißt „noch nichts gespeichert“ (dann gilt der Anfang). */
export type EinstellungenBeginn =
  | { art: 'ok'; einstellungen: Einstellungen | null }
  | { art: 'gesperrt'; sperre: Sperre };

function einstellungenBeginn(r: BeginnErgebnis): EinstellungenBeginn {
  if (r.art === 'gesperrt') return r;
  return { art: 'ok', einstellungen: websiteAusWerten(r.werte).einstellungen };
}

export async function beginneEinstellungen(
  o: EntwurfsOrt,
  ich: Schreiber,
): Promise<EinstellungenBeginn> {
  return einstellungenBeginn(await bearbeitungBeginnen(ort(o), EINSTELLUNGEN_ZIEL, ich));
}

export async function uebernimmEinstellungen(
  o: EntwurfsOrt,
  ich: Schreiber,
): Promise<EinstellungenBeginn> {
  return einstellungenBeginn(await bearbeitungUebernehmen(ort(o), EINSTELLUNGEN_ZIEL, ich));
}

export const beendeEinstellungen = (o: EntwurfsOrt, ich: Schreiber) =>
  bearbeitungBeenden(ort(o), EINSTELLUNGEN_ZIEL, ich);
