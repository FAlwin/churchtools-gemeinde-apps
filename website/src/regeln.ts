/**
 * **Kleine Regeln der Bearbeiten-Oberfläche** (Bauplan Website W3a-2) – in einer Datei ohne Bauteile, damit die Fenster nur
 * Bauteile ausgeben (sonst baut Vite die Seite bei jeder Änderung ganz neu auf) und die Tests sie ohne Oberfläche prüfen.
 */
import {
  BAUSTEIN_TYPEN,
  istReservierterAnker,
  SLUG,
  type BausteinTyp,
  type Link,
} from '@shared/website/modell';
import { VORLAGEN, type Vorlage } from '@shared/website/vorlagen';

/** Wie oft die eigene Sperre erneuert wird (Lebenszeichen) – weit unter `SPERRE_MINUTEN`. */
export const LEBENSZEICHEN_MS = 60_000;

/** „vor 3 Minuten“ – wie lange das letzte Lebenszeichen einer Sperre her ist (für die Rückfrage beim Übernehmen). */
export function lebenszeichenAlter(seit: string, jetzt: Date): string {
  const min = Math.floor((jetzt.getTime() - new Date(seit).getTime()) / 60_000);
  if (!Number.isFinite(min) || min < 1) return 'vor weniger als einer Minute';
  return min === 1 ? 'vor einer Minute' : `vor ${min} Minuten`;
}

/**
 * Was die Person im Editor darf (aus ihrem Zugang, `@shared/website/zugang`): „Eigenes HTML“ einfügen/ändern (E-W12) und das
 * **Menü** ändern (E-W22) – beides nur Leitung und Admin, nie ein Redakteur. Die Regel der Oberfläche, nicht der Schutz der Daten.
 */
export type Rechte = { html: boolean; menue: boolean };

/** Die Vorlagen, die diese Person sieht: „Eigenes HTML“ nur mit dem Recht dafür (E-W12). */
export function sichtbareVorlagen(rechte: Rechte): readonly Vorlage[] {
  return VORLAGEN.filter((v) => v.name !== 'html' || rechte.html);
}

/** Die Typen, die diese Person hinzufügen darf: „Eigenes HTML“ nur mit dem Recht dafür. */
export function waehlbareTypen(rechte: Rechte): readonly BausteinTyp[] {
  return BAUSTEIN_TYPEN.filter((t) => t !== 'html' || rechte.html);
}

/** Die Adresse einer Seite, wie sie beim Tippen entsteht: Kleinbuchstaben, alles Übrige zu Bindestrichen. */
export const pfadEingabe = (roh: string): string => roh.toLowerCase().replace(/[^a-z0-9-]+/g, '-');

/** Die Meldung zu einer Sprungmarke – leer, wenn sie in Ordnung ist (oder keine). */
export function ankerMeldung(anker: string, andere: readonly string[]): string {
  if (anker === '') return '';
  if (!SLUG.test(anker) || anker.length > 60)
    return 'Nur Kleinbuchstaben, Ziffern und Bindestriche (z. B. „gottesdienst“).';
  if (istReservierterAnker(anker))
    return 'Dieser Name ist von der Seite selbst belegt („inhalt“ und alles mit „w-“ am Anfang).';
  if (andere.includes(anker))
    return 'Diese Sprungmarke hat auf dieser Seite schon ein anderer Abschnitt.';
  return '';
}

/** Wert der Zielwahl eines Knopfs: `seite:<id>`, `anker:<name>` oder `extern`. */
export function zielWert(z: Link): string {
  return z.art === 'seite'
    ? `seite:${z.seiteId}`
    : z.art === 'anker'
      ? `anker:${z.anker}`
      : 'extern';
}

/**
 * Das Ziel zu einem gewählten `zielWert`. Wer „Andere Adresse“ wählt, behält eine schon eingetippte Adresse; sonst beginnt sie
 * mit `neueUrl` (bei Knöpfen die Beispieladresse, in der Fußzeile leer – dort muss sie eingetragen werden).
 */
export function zielAusWert(wert: string, alt: Link | null, neueUrl: string): Link {
  const [art, ...rest] = wert.split(':');
  const v = rest.join(':');
  if (art === 'seite') return { art: 'seite', seiteId: v };
  if (art === 'anker') return { art: 'anker', anker: v };
  return alt?.art === 'extern' ? alt : { art: 'extern', url: neueUrl };
}

/** Das Objekt ohne dieses (optionale) Feld – damit ein leeres Feld gar nicht erst im Baustein steht. */
export function ohneFeld<T extends object, K extends keyof T>(o: T, feld: K): Omit<T, K> {
  const kopie = { ...o };
  delete kopie[feld];
  return kopie;
}
