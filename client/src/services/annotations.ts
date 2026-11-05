/**
 * Server-Synchronisierung der Anmerkungen (Striche + Textfelder + Zoom) PRO KONTO.
 * localStorage bleibt der schnelle Arbeits-/Offline-Cache; dieser Layer spiegelt vom/zum Server:
 *  - pullAnnotations(): Server → localStorage (beim Öffnen einer Setlist)
 *  - pushField(): localStorage-Änderung → Server (gebündelt/debounced, Feld-Merge)
 *  - migrateLocalAnnotations(): einmalig bestehende Geräte-Anmerkungen aufs Konto hochladen
 *
 *  - resumePendingAnnotations(): beim Start nachholen, was beim letzten Mal nicht durchging (#256)
 *
 * **Zwei Ebenen der Absicherung gegen verlorene Anmerkungen:** Innerhalb einer Sitzung wird ein
 * fehlgeschlagener Upload zurückgelegt und wiederholt (#245); über einen App-Neustart hinweg trägt der
 * Merker `worship_anno_pending_v1` in localStorage die offenen Schlüssel (#256). Beide Wege schützen
 * dieselbe Stelle: `pullAnnotations` darf eine Seite mit ausstehendem Upload NICHT überschreiben.
 */
import { apiFetch } from './api';
import { istExtension } from './ctRuntime';
import { verwaisteEntfernen } from './verwaisteEintraege';
import { holeAnmerkungen, schreibeAnmerkung } from './personenAblage';
import { createPendingKeys } from './pendingKeys';
import { onAppHidden } from './appHidden';
import { erstelleSchreibSchlange } from './schreibSchlange';
import {
  ANNO_DRAW_NS,
  ANNO_ZOOM_NS,
  ANNO_KEY_RE,
  normalizeAnnoKey as normalizeKey,
  songIdOfAnnoKey,
} from '@shared/keys/index';
import type { AnnotationText, GespeicherterZoom, PageAnnotation } from '@shared/types/index';
import { jsonOderNull, lokalSchreiben } from '../utils/lokalSpeicher';
import { ohneTextSuffix, textSchluessel } from '../utils/annotationKeys';
import { versionKopien } from '../utils/versionMigration';

// Namensräume und Grammatik aus @shared/keys – EINZIGE Quelle für Client und Server (#250).
const DRAW = ANNO_DRAW_NS;
const ZOOM = ANNO_ZOOM_NS;
const MIGRATED_FLAG = 'worship_anno_migrated_v1';
// Die Grammatik liegt in @shared/keys (#250) – hier nur re-exportiert, damit Bestandsimporte
// (`services/annotations`.KEY_RE) weiter funktionieren.
export const KEY_RE = ANNO_KEY_RE;

// Anmerkungs-Typen (AnnotationText, PageAnnotation) kommen aus @shared/types – einzige Quelle
// für Client + Server, damit beim Server-Roundtrip kein Feld verloren geht.

/**
 * Der Transportweg – **die Weiche** zwischen Server-Variante und ChurchTools-Extension (#334).
 *
 * Nur das Holen und Schreiben unterscheidet sich; Warteschlange, Wiederholen und Nachholen in dieser
 * Datei gelten für beide Wege. In der Extension liegen die Anmerkungen in den Personen-Dateien
 * (`personenAblage.ts`). `keepalive` gibt es dort nicht: Browser begrenzen solche Anfragen auf 64 KB,
 * eine Zeichnung ist größer – sie wird über den Merker beim nächsten Start nachgeholt (#256).
 */
const weg = istExtension
  ? {
      holen: holeAnmerkungen,
      schreiben: (key: string, body: PageAnnotation): Promise<unknown> =>
        schreibeAnmerkung(key, body),
    }
  : {
      holen: (songIds: number[]) =>
        apiFetch<Record<string, PageAnnotation>>(`/api/annotations?songs=${songIds.join(',')}`),
      schreiben: (key: string, body: PageAnnotation, keepalive = false): Promise<unknown> =>
        apiFetch(`/api/annotations/${encodeURIComponent(key)}`, {
          method: 'PUT',
          body: JSON.stringify(body),
          // keepalive: Request überlebt das Backgrounding der Seite (App-Wechsel/Schließen).
          ...(keepalive ? { keepalive: true } : {}),
        }),
    };

/**
 * Sync wieder einschalten – MUSS nach jeder erfolgreichen Anmeldung passieren (#211). Ohne das
 * blieb der Abgleich nach einem automatischen Abmelden für den Rest der Seiten-Lebensdauer aus:
 * Anmerkungen wurden dann nur noch lokal gespeichert und gingen geräteübergreifend still verloren.
 */
export function resetSync(): void {
  schlange.einschalten();
}

/** localStorage-Key → Server-Eintrags-Schlüssel (song<id>_v<version>_<seite>). */
function serverKeyOf(lsKey: string): string {
  return ohneTextSuffix(lsKey.replace(DRAW, '').replace(ZOOM, ''));
}

// ── Pull: Server → localStorage ──────────────────────────────
/** Holt alle Anmerkungen des Kontos zu diesen Liedern und spiegelt sie in localStorage. */
export async function pullAnnotations(songIds: number[]): Promise<void> {
  if (schlange.istAus() || songIds.length === 0) return;
  try {
    const data = await weg.holen(songIds);
    // Seiten mit wartender, gerade hochladender oder laut Merker (nach einem Neustart, #256) noch fehlender
    // lokaler Änderung NICHT überschreiben – sonst gehen frische Anmerkungen an den alten Server-Stand verloren.
    const geschuetzt = schlange.schutz();
    for (const [key, a] of Object.entries(data)) {
      if (geschuetzt(key)) continue;
      // `lokalSchreiben` wirft nie (#457): Ein voller Gerätespeicher bräche sonst den ganzen Abgleich ab.
      if (a.strokes) lokalSchreiben(DRAW + key, a.strokes);
      else localStorage.removeItem(DRAW + key);
      if (a.texts && a.texts.length)
        lokalSchreiben(textSchluessel(DRAW + key), JSON.stringify(a.texts));
      else localStorage.removeItem(textSchluessel(DRAW + key));
      if (a.zoom) lokalSchreiben(ZOOM + key, JSON.stringify(a.zoom));
      else localStorage.removeItem(ZOOM + key);
    }
    // Ganz geleerte Seiten (anderes Gerät, Erweiterung) auch hier entfernen – Regel und Schutz dort.
    verwaisteEntfernen({
      kontoSchluessel: (ls) =>
        ls.startsWith(DRAW) || ls.startsWith(ZOOM) ? serverKeyOf(ls) : null,
      liedVon: songIdOfAnnoKey,
      songIds,
      aufDemKonto: (key) => key in data,
      geschuetzt,
      freigegeben: localStorage.getItem(MIGRATED_FLAG) !== null,
    });
  } catch (e) {
    schlange.fehlerBewerten(e);
  }
}

// ── Ausstehende Uploads: überleben das Schließen der App (#256) ──────────────
/**
 * Schlüssel, deren Upload noch aussteht – **in localStorage**, damit er einen App-Neustart übersteht.
 *
 * Vorher lebte die Warteschlange nur im Speicher: Zeichnete jemand offline und wurde die App danach
 * beendet, war beim nächsten Start nicht mehr bekannt, dass etwas fehlt – der erste `pullAnnotations`
 * spiegelte den älteren Server-Stand über den lokalen und der Strich verschwand sichtbar.
 *
 * Gespeichert werden nur die SCHLÜSSEL; die Anmerkung selbst liegt ohnehin im localStorage.
 */
// Der Mechanismus liegt in `pendingKeys.ts` – die Einstellungen brauchen ihn genauso (#275).
const pendingStore = createPendingKeys('worship_anno_pending_v1');

/**
 * Die Anmerkung eines Schlüssels aus dem localStorage zusammensetzen.
 *
 * Von der Wiederaufnahme UND der einmaligen Migration genutzt – vorher baute die Migration das
 * gleiche Objekt selbst zusammen (dieselbe Fehlerklasse, die dieses Projekt mehrfach getroffen hat).
 */
function annotationFromStorage(key: string): PageAnnotation | null {
  const out: PageAnnotation = {};
  const strokes = localStorage.getItem(DRAW + key);
  if (strokes) out.strokes = strokes;
  const texts = jsonOderNull<AnnotationText[]>(localStorage.getItem(textSchluessel(DRAW + key)));
  if (texts && texts.length) out.texts = texts;
  const zoom = jsonOderNull<GespeicherterZoom>(localStorage.getItem(ZOOM + key));
  if (zoom) out.zoom = zoom;
  return Object.keys(out).length > 0 ? out : null;
}

/**
 * Beim Start: Uploads nachholen, die beim letzten Mal nicht durchgingen (#256).
 *
 * MUSS vor dem ersten `pullAnnotations` laufen – sonst überschreibt der Pull genau die Seiten, die
 * hier noch hochzuladen sind. Ein Schlüssel ohne lokale Daten (Anmerkung wurde inzwischen gelöscht)
 * wird nur aus dem Merker entfernt.
 */
export async function resumePendingAnnotations(): Promise<void> {
  if (schlange.istAus()) return;
  for (const key of pendingStore.read()) {
    const body = annotationFromStorage(key);
    if (!body) {
      pendingStore.unmark(key);
      continue;
    }
    schlange.einreihen(key, body);
  }
  await schlange.abschicken();
}

// ── Push: localStorage-Änderung → Server (gebündelt) ─────────
/**
 * Meldet dem Nutzer, dass eine Anmerkung NICHT gespeichert werden konnte (#245). Registriert wird der
 * Handler in `App.tsx` (Toast) – wie der Zwilling für die Einstellungen (#213).
 */
let syncErrorHandler: ((msg: string) => void) | null = null;
export function setAnnotationsSyncErrorHandler(fn: ((msg: string) => void) | null): void {
  syncErrorHandler = fn;
}

/**
 * Warteschlange, Wiederholen, Merker und Fehlerzweige liegen in `schreibSchlange.ts` – EIN Baustein mit
 * `userSettings.ts` (#846). Die Anmerkungen gehen **je Seite** hoch.
 *
 * Zurücklegen nach einem Fehlschlag (#245) feldweise, und **neuere Werte gewinnen**: Hat der Nutzer während des
 * laufenden Requests weiter gezeichnet, steht das neue `strokes` schon in der Warteschlange – es darf nicht vom
 * alten überschrieben werden. Ergänzt werden nur Felder, die inzwischen NICHT neu gesetzt wurden.
 */
const schlange = erstelleSchreibSchlange<PageAnnotation>({
  merker: pendingStore,
  schreiben: (stapel, keepalive) => {
    const [[key, body]] = stapel; // je Seite ein Stapel mit genau einem Eintrag
    return weg.schreiben(key, body, keepalive);
  },
  buendeln: 'je-schluessel',
  zusammenfuehren: (neuer, fehlgeschlagen) => ({ ...fehlgeschlagen, ...neuer }),
  melden: (meldung) => syncErrorHandler?.(meldung),
});

/** Alle noch ausstehenden Uploads SOFORT abschicken – beim Verlassen/Backgrounding der App.
 *  Ohne das friert iOS die 600-ms-Debounce-Timer ein und ein gerade gesetzter Zoom erreicht
 *  den Server nie („Zoom bleibt nicht gespeichert" nach App-Neustart). */
export function flushPendingAnnotations(): void {
  schlange.jetztAbschicken();
}

onAppHidden(flushPendingAnnotations);

/** Eine Feld-Änderung (strokes/texts/zoom) einer Seite zum Server schreiben (debounced, Feld-Merge). */
export function pushField(lsKey: string, field: keyof PageAnnotation, value: unknown): void {
  const key = serverKeyOf(lsKey);
  if (!KEY_RE.test(key)) return; // nur Lied-Seiten synchronisieren (Dokumente bleiben lokal)
  schlange.vormerken(key, (bisher) => ({ ...bisher, [field]: value }));
}

// ── Migration: bestehende Geräte-Anmerkungen einmalig aufs Konto ──
/** Lädt vorhandene lokale Anmerkungen einmalig aufs Konto (danach gesetzter Merker). */
export async function migrateLocalAnnotations(): Promise<void> {
  if (schlange.istAus() || localStorage.getItem(MIGRATED_FLAG)) return;
  // Alle Ebenen-Schlüssel im Speicher finden; die Anmerkung selbst baut `annotationFromStorage`
  // (dieselbe Funktion wie bei der Wiederaufnahme – nicht ein zweites Mal zusammengesetzt, #256).
  // Die ORIGINAL-Schlüssel sammeln (so, wie sie im Speicher stehen) – gelesen wird darunter, und
  // erst beim Hochladen wird auf das aktuelle Schema gehoben. Umgekehrt fände `annotationFromStorage`
  // nichts: Bei einem Altbestand liegen die Daten unter `song12_3`, nicht unter `song12_voriginal_3`.
  const found = new Set<string>();
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (!k) continue;
    if (k.startsWith(DRAW)) {
      found.add(ohneTextSuffix(k.slice(DRAW.length)));
    } else if (k.startsWith(ZOOM)) {
      const base = k.slice(ZOOM.length);
      if (/^p\d+$/.test(base)) continue; // alte seiten-globale Zoom-Keys ignorieren
      found.add(base);
    }
  }
  const entries: Record<string, PageAnnotation> = {};
  for (const raw of found) {
    const body = annotationFromStorage(raw);
    if (!body) continue;
    const ziel = normalizeKey(raw);
    // Sollten Alt- und Neuschlüssel derselben Seite beide existieren, gewinnt Feld für Feld der
    // zuerst gefundene – die Felder werden zusammengelegt statt einander zu verwerfen.
    entries[ziel] = { ...body, ...(entries[ziel] ?? {}) };
  }
  // Nur gültige Lied-Schlüssel hochladen (Dokument-Anmerkungen bleiben lokal).
  const keys = Object.keys(entries).filter((k) => KEY_RE.test(k));
  // Netzbedingter Fehlschlag = später nochmal versuchen. Der Merker darf dann NICHT fallen (#246):
  // Der Vorgang läuft genau einmal pro Gerät – wurde er bei schlechtem Netz „erledigt", landen die
  // bestehenden Geräte-Anmerkungen NIE auf dem Konto, still und ohne Meldung. Vorher wurde der
  // Merker bedingungslos gesetzt und nur 401 brach vorzeitig ab.
  let retryLater = false;
  // Pro Schlüssel hochladen (kleine Requests, einmaliger Vorgang).
  for (const key of keys) {
    try {
      await weg.schreiben(key, entries[key]);
    } catch (e) {
      const art = schlange.fehlerBewerten(e);
      // Kein Recht / nicht angemeldet → Merker NICHT setzen, mit dem Recht bzw. der Anmeldung wird es nachgeholt.
      if (art === 'kein-recht' || art === 'abgemeldet') return;
      // Zu groß fürs Konto (gemeldet): ein erneuter Versuch scheitert genauso → diesen Schlüssel endgültig
      // überspringen (lokal bleibt er erhalten) und den Vorgang trotzdem abschließen.
      if (art === 'zu-gross') continue;
      retryLater = true; // Netz-/Serverfehler → nächster Start versucht es erneut
    }
  }
  if (!retryLater) lokalSchreiben(MIGRATED_FLAG, '1');
}

// ── Umbenannte Version: Anmerkungen mitnehmen ─────────────────
/**
 * **Die eigenen Anmerkungen einer Version auf ihren neuen Schlüssel mitnehmen** (30.10.2026).
 *
 * Ein neuer Versionsname ist ein neuer Schlüssel (`versionAendern` in `shared/ct/notenblaetter.ts`). Die Anmerkungen
 * lagen danach unter dem alten und waren unsichtbar – auf jedem Gerät. Die Einstellungen nimmt seit #812
 * `einstellungenMitnehmen` mit; hier dasselbe für Striche, Texte und Zoom.
 *
 * Welche Schlüssel dazugehören, entscheidet `versionKopien` – dieselbe Regel wie beim Schlüssel-Umzug vom 07.10.2026
 * (kopieren, nicht umbenennen; was unter dem neuen Schlüssel schon steht, gewinnt). Nur der EIGENE Namensraum geht
 * mit; die Team-Ansicht spiegelt fremde Notizen und holt sie selbst neu. Auf das Konto geht es über `pushField` –
 * denselben Weg wie jeder Strich, also mit Warteschlange, Merker über den Neustart und Wiederholen.
 *
 * Gibt die Zahl der Seiten zurück, die mitgenommen wurden.
 */
export function anmerkungenMitnehmen(songId: number, alt: string, neu: string): number {
  if (alt === neu) return 0;
  const vorhanden: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k) vorhanden.push(k);
  }
  const eigene = versionKopien(vorhanden, songId, alt, neu).filter(
    ({ von }) => von.startsWith(DRAW) || von.startsWith(ZOOM),
  );
  const seiten = new Set<string>();
  for (const { von, nach } of eigene) {
    const wert = localStorage.getItem(von);
    if (wert !== null && lokalSchreiben(nach, wert)) seiten.add(serverKeyOf(nach));
  }
  for (const key of seiten) {
    const body = annotationFromStorage(key);
    if (!body) continue;
    for (const [feld, wert] of Object.entries(body)) {
      pushField(DRAW + key, feld as keyof PageAnnotation, wert);
    }
  }
  return seiten.size;
}
