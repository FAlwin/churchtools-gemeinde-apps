/**
 * Texte des Plätze-Fachs (E4-5-3) – eigene Datei, damit `PlaetzeFach.tsx` nur die Komponente exportiert
 * (Fast Refresh).
 */
import type { AnzahlErgebnis } from '@shared/dienstplan/anzahl';

/** „1 Platz“ / „3 Plätze“ – eine Stelle für Meldung und Vorlage. */
export const plaetzeText = (n: number): string => `${n} ${n === 1 ? 'Platz' : 'Plätze'}`;

/** Was ein Fehlschlag in Worten heißt (Gründe aus `anzahl.ts`). */
export function anzahlFehlerText(r: Extract<AnzahlErgebnis, { ok: false }>): string {
  switch (r.grund) {
    case 'konflikt':
      return `Jemand hat die Zahl eben geändert – jetzt ${r.jetzt ?? '?'}. Nichts geändert.`;
    case 'belegt':
      return 'Belegte Plätze lassen sich nicht wegnehmen – erst die Person zurückziehen.';
    case 'weg':
      return 'Den Termin gibt es nicht mehr.';
    case 'kein-recht':
      return 'ChurchTools erlaubt dir nicht, die Plätze dieses Termins zu ändern.';
    case 'abgemeldet':
      return 'Nicht mehr bei ChurchTools angemeldet – Seite neu laden.';
    case 'voruebergehend':
      return 'ChurchTools antwortet gerade nicht – nicht bestätigt. Bitte gleich noch einmal.';
    case 'nicht-angekommen':
      return 'ChurchTools hat es angenommen, nachgelesen steht aber die alte Zahl da.';
  }
}

/**
 * „Hier liegt ein Entwurf – erst senden oder entfernen.“ – der Satz der **Sperre** (nur wo die Entwürfe der Gruppe nicht
 * umgetragen werden dürfen, `plaetzeGrenze`).
 */
export const sperreText = (entwuerfe: number): string =>
  `${entwuerfe === 1 ? 'Hier liegt ein Entwurf' : `Hier liegen ${entwuerfe} Entwürfe`} – erst senden oder entfernen.`;

/**
 * Nach einer geglückten Änderung der Platzzahl: Was mit den Entwürfen geschah, wenn etwas offen blieb – sonst `null`.
 * Die Platzzahl IST dann schon geändert; der Planer lädt neu (Plan und Entwürfe).
 */
export function mitnehmenText(r: Extract<AnzahlErgebnis, { ok: true }>): string | null {
  const e = r.entwuerfe;
  if (!e) return null;
  if (e.unklar) {
    return `${plaetzeText(r.anzahl)} gespeichert – ob Entwürfe mitgehen müssen, ließ sich nicht prüfen. Bitte die Seite neu laden.`;
  }
  if (e.offen === 0) return null;
  return `${plaetzeText(r.anzahl)} gespeichert – ${e.offen === 1 ? '1 Entwurf konnte' : `${e.offen} Entwürfe konnten`} nicht mitgehen und ${e.offen === 1 ? 'liegt' : 'liegen'} noch am alten Platz. Bitte neu laden.`;
}
