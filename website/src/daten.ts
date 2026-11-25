/**
 * **Die Website im Speicher der Erweiterung** – die dünne Hülle der Oberfläche um `@shared/website/speicher` (dort stehen
 * Aufbau, Lesen und die Reihenfolge beim Schreiben) und `@shared/website/sperre` (wer bearbeitet gerade). Hier nur: der
 * Anschluss dieser Erweiterung (`modulPort`) und die Kategorie „Entwürfe“. **Seit W3b-2** kommt „Veröffentlicht“ dazu: Gelesen
 * wird es von allen Rollen (Online-Stand), geschrieben nur von der Leitung (Freigeben, Offline nehmen) – die Regeln dafür
 * stehen in `@shared/website/freigabe` und `status`.
 */
import { modulPort } from '@ui/ct/modulPort';
import { ApiError } from '@ui/ct/fehler';
import { werteLesen } from '@shared/ct/modulDaten';
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
import { mailAnAusWerten, mailSchalterSetzen } from '@shared/website/mailWerte';
import type { Einstellungen, Menue, Seite } from '@shared/website/modell';
import {
  alleFreigeben,
  gibFrei,
  onlineKategorien,
  onlineSicht,
  seiteEntfernen,
  type AlleErgebnis,
  type Freigegeben,
  type OnlineKategorie,
  type OnlineSicht,
  type Ziel,
} from '@shared/website/freigabe';
import type { UntergruppenKategorie } from '@shared/website/einrichten';
import {
  statusEntfernen,
  statusSetzen,
  type SeitenStatus,
  type StatusEingabe,
} from '@shared/website/status';

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

// ── Freigabe (W3b-2) ──────────────────────────────────────────────────────────────────────────────────────────────────

/** Die Kategorien der Website – für alles, was Entwurf und Online-Stand zusammen braucht. */
export interface FreigabeKategorien {
  modul: number;
  entwuerfe: number;
  /** „Veröffentlicht“ der Website. */
  veroeffentlicht: number;
  /** „Veröffentlicht“ der eingerichteten Untergruppen, die die Person sieht (W3b-4b) – fehlt: keine. */
  untergruppen?: readonly UntergruppenKategorie[];
}

const freigabeOrt = (o: FreigabeKategorien) => ({ p: modulPort, ...o });
const entwurfsOrtVon = (o: FreigabeKategorien): SpeicherOrt => ({
  p: modulPort,
  modul: o.modul,
  kategorie: o.entwuerfe,
});

/**
 * **Der Online-Stand aller Bereiche** (W3b-4b): jede Veröffentlicht-Kategorie, die die Person kennt, gelesen wie jede andere.
 * **Eine Kategorie ohne Leserecht ist kein Fehler** (`401`/`403` → sie fehlt in der Liste); jeder andere Fehler wirft – der
 * Online-Stand ist dann „unbekannt“, nicht „leer“.
 */
export async function ladeOnline(o: FreigabeKategorien): Promise<OnlineKategorie[]> {
  const gelesen = await Promise.all(
    onlineKategorien(freigabeOrt(o)).map(async (k) => {
      try {
        return { ...k, stand: await websiteLesen(modulPort, o.modul, k.kategorie) };
      } catch (e) {
        // Kein Leserecht (nicht „abgemeldet“ – das unterscheidet `istKeinRecht` schon): die Kategorie fehlt einfach.
        if (modulPort.istKeinRecht(e) || (e instanceof ApiError && e.status === 403)) return null;
        throw e;
      }
    }),
  );
  return gelesen.filter((k): k is OnlineKategorie => k !== null);
}

/** Entwurf und Online-Stand zusammen – für Reiter „Freigaben“ und Zähler. */
export interface FreigabeDaten {
  entwurf: WebsiteStand;
  /** Der Online-Stand je Bereich (`onlineSicht`). */
  online: OnlineSicht;
}

/** Entwurf und Online-Stand zusammen – für den Reiter „Freigaben“ und den Zähler. Scheitert eines, scheitert das Ganze. */
export async function ladeFreigaben(o: FreigabeKategorien): Promise<FreigabeDaten> {
  const [entwurf, online] = await Promise.all([
    websiteLesen(modulPort, o.modul, o.entwuerfe),
    ladeOnline(o),
  ]);
  return { entwurf, online: onlineSicht(entwurf, online) };
}

export const setzeStatus = (
  o: FreigabeKategorien,
  seiteId: string,
  eingabe: StatusEingabe,
  ich: Schreiber,
): Promise<SeitenStatus> => statusSetzen(entwurfsOrtVon(o), seiteId, eingabe, ich);

export const entferneStatus = (o: FreigabeKategorien, seiteId: string) =>
  statusEntfernen(entwurfsOrtVon(o), seiteId);

export const gebeFrei = (o: FreigabeKategorien, ziel: Ziel): Promise<Freigegeben> =>
  gibFrei(freigabeOrt(o), ziel.einheit, ziel.id);

export const entferneSeiteUndOnline = (
  o: FreigabeKategorien,
  seiteId: string,
  bereich: number | null,
) => seiteEntfernen(freigabeOrt(o), seiteId, bereich);

export const gebeAllesFrei = (
  o: FreigabeKategorien,
  ziele: readonly Ziel[],
  beiFortschritt?: (geschafft: number, von: number) => void,
): Promise<AlleErgebnis> => alleFreigeben(freigabeOrt(o), ziele, beiFortschritt);

// ── Mails im Freigabe-Weg (W3b-3) ────────────────────────────────────────────────────────────────────────────────────────

/** Sind die Mails im Freigabe-Weg an? Kein Wert = an (`mailWerte.ts`). Wirft bei jedem Lesefehler – nie „an“ aus einem Aussetzer. */
export const ladeMailAn = async (o: EntwurfsOrt): Promise<boolean> =>
  mailAnAusWerten(await werteLesen(modulPort, o.modul, o.kategorie));

/** Den Schalter setzen: sofort, als eigener Wert in „Entwürfe“ (nicht in der Einheit „Einstellungen“), nachgelesen. */
export const setzeMailAn = (o: EntwurfsOrt, an: boolean) => mailSchalterSetzen(ort(o), an);
