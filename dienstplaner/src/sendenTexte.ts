/**
 * Texte und Regeln des Senden-Fachs (E4-4-2) – eigene Datei, damit `SendenFach.tsx` nur die Komponente
 * exportiert (Fast Refresh).
 */
import type { Entwurf } from '@shared/dienstplan/entwuerfe';
import type { SendeErgebnis } from '@shared/dienstplan/senden';

/** Was beim Senden passiert – „Anfrage an Anna“, „Direkt zuteilen: David“, „Gast eintragen: Max“. */
export function aktionText(e: Entwurf): string {
  if (e.ziel.art === 'gast') return `Gast eintragen: ${e.ziel.name}`;
  return e.modus === 'direkt' ? `Direkt zuteilen: ${e.ziel.name}` : `Anfrage an ${e.ziel.name}`;
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
      e.ziel.art === 'gast'
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
