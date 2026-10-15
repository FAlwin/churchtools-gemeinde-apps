/**
 * Texte und Regeln des Senden-Fachs (E4-4-2) – eigene Datei, damit `SendenFach.tsx` nur die Komponente
 * exportiert (Fast Refresh).
 */
import type { Belegung } from '@shared/dienstplan/einteilen';
import type { Entwurf, EntwurfZiel } from '@shared/dienstplan/entwuerfe';
import type { SendeErgebnis } from '@shared/dienstplan/senden';

/**
 * Was beim Senden passiert – „Anfrage an Anna“, „Direkt zuteilen: David“, „Gast eintragen: Max“; an einem belegten
 * Platz (E4-5) „Zurückziehen: Ben“ bzw. „Anfrage an Greta statt Anna“. `bisher`: wer jetzt dort steht.
 */
export function aktionText(e: Entwurf, bisher: string | null = null): string {
  if (e.ziel.art === 'frei') return bisher ? `Zurückziehen: ${bisher}` : 'Zurückziehen';
  const statt = e.gesehen.art !== 'frei' && bisher ? ` statt ${bisher}` : '';
  if (e.ziel.art === 'gast') return `Gast eintragen: ${e.ziel.name}${statt}`;
  return e.modus === 'direkt'
    ? `Direkt zuteilen: ${e.ziel.name}${statt}`
    : `Anfrage an ${e.ziel.name}${statt}`;
}

/**
 * **Was die bisherige Person mitbekommt**, wenn sie zurückgezogen oder ersetzt wird – gemessen 15.10.2026
 * (E4-5-0): Zurückziehen → **nichts**, Ersetzen → Push „Dienstaustragung – Du wurdest … ausgetragen“. Gäste
 * bekommen nie etwas. Eine Stelle für das Fenster am Platz, das Entwurfs-Fach und das Senden-Fach.
 */
export function bisherHinweis(
  ziel: EntwurfZiel,
  gesehen: Belegung,
  bisher: string | null,
): { text: string; warnung: boolean } | null {
  return wegHinweis(ziel.art === 'frei' ? 'zurueckziehen' : 'ersetzen', gesehen, bisher);
}

/** Dasselbe nach dem Weg – für das Fenster am Platz, das beide Wege zur Wahl stellt. */
export function wegHinweis(
  weg: 'zurueckziehen' | 'ersetzen',
  gesehen: Belegung,
  bisher: string | null,
): { text: string; warnung: boolean } | null {
  if (gesehen.art === 'frei' || gesehen.art === 'gast' || !bisher) return null;
  if (weg === 'zurueckziehen') {
    return {
      text: `ChurchTools sagt ${bisher} nicht Bescheid – sag es am besten selbst.`,
      warnung: true,
    };
  }
  return { text: `${bisher} bekommt von ChurchTools „Du wurdest … ausgetragen“.`, warnung: false };
}

/** Diese Gründe lohnen „Erneut senden“; die anderen brauchen erst einen Blick in die Matrix. */
const WIEDERHOLBAR = new Set(['voruebergehend', 'nicht-angekommen', 'abgemeldet']);
export const wiederholbar = (r: SendeErgebnis | undefined): boolean =>
  r !== undefined &&
  (r.art === 'nicht-versucht' || (r.art === 'nicht-gesendet' && WIEDERHOLBAR.has(r.grund)));

/** Das Ergebnis einer Zeile in Worten (die Fälle aus dem Schreibkern, E4-1). */
export function ergebnisText(r: SendeErgebnis, e: Entwurf): string {
  if (r.art === 'gesendet') {
    const was =
      e.ziel.art === 'frei'
        ? 'zurückgezogen'
        : e.ziel.art === 'gast'
          ? 'als Gast eingetragen'
          : e.modus === 'direkt'
            ? 'direkt zugeteilt'
            : 'angefragt';
    return r.entwurfBlieb
      ? `${was} – der Entwurf blieb stehen und lässt sich in der Matrix verwerfen`
      : was;
  }
  if (r.art === 'nicht-versucht') return 'Nicht versucht – der Entwurf bleibt.';
  switch (r.grund) {
    case 'konflikt':
      return 'Inzwischen steht dort jemand anderes (in ChurchTools eingetragen). Nicht gesendet – der Entwurf ist jetzt veraltet.';
    case 'entwurf-geaendert':
      return 'Ein anderer Planer hat den Entwurf eben geändert. Nicht gesendet – bitte in der Matrix ansehen.';
    case 'weg':
      return 'Den Platz oder Termin gibt es nicht mehr. Nicht gesendet.';
    case 'kein-recht':
      return 'ChurchTools erlaubt dir hier das Einteilen nicht. Nicht gesendet.';
    case 'abgemeldet':
      return 'Nicht mehr bei ChurchTools angemeldet – Seite neu laden, dann erneut senden.';
    case 'voruebergehend':
      return 'ChurchTools antwortet gerade nicht – nicht bestätigt. Der Entwurf bleibt.';
    case 'nicht-angekommen':
      return 'ChurchTools hat es angenommen, nachgelesen steht es aber nicht da. Der Entwurf bleibt.';
  }
}
