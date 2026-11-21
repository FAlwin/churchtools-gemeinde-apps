/**
 * **Der Verlauf einer offenen Seite: Rückgängig und Wiederholen** (Bauplan Website W3c-2) – **rein**, ohne etwas zu speichern oder zu
 * zeichnen. Ein Schritt ist das Paar „Seite vorher, Seite nachher“ (Verschieben, Einfügen, Kopieren, Löschen, übernommener Text,
 * ein Fenster mit „Fertig“). Der Verlauf gilt für **diese Seite in dieser Sitzung**: Er lebt in `Seitenarbeit`, die je Seite neu
 * entsteht (`key`), und wird dort geleert, wenn der gespeicherte Stand von außen ersetzt wird.
 *
 * **Nichts Fremdes überschreiben:** Rückgängig geht nur, wenn die Seite **genau so** aussieht wie nach dem Schritt (`nachher`) –
 * bei Wiederholen wie vor dem Schritt (`vorher`). Hat jemand anderes inzwischen gespeichert (und ist der Stand neu geladen), passt
 * das nicht mehr: Der Verlauf wird verworfen (`fremd`), und der Aufrufer sagt es dem Menschen.
 */
import { seiteGleich } from '@shared/website/bearbeiten';
import type { Seite } from '@shared/website/modell';

export interface Schritt {
  vorher: Seite;
  nachher: Seite;
}

export interface Verlauf {
  /** Was sich rückgängig machen lässt – der letzte Schritt liegt zuletzt. */
  zurueck: readonly Schritt[];
  /** Was sich wiederholen lässt – der nächste Schritt liegt zuletzt. */
  vor: readonly Schritt[];
}

export const LEERER_VERLAUF: Verlauf = { zurueck: [], vor: [] };

/** So viele Schritte bleiben höchstens im Gedächtnis (die ältesten fallen weg). */
export const MAX_SCHRITTE = 100;

/** Ein neuer Schritt. Ändert er nichts, zählt er nicht; ein neuer Schritt löscht, was man hätte wiederholen können. */
export function verlaufMerken(v: Verlauf, vorher: Seite, nachher: Seite): Verlauf {
  if (seiteGleich(vorher, nachher)) return v;
  return { zurueck: [...v.zurueck, { vorher, nachher }].slice(-MAX_SCHRITTE), vor: [] };
}

export type Gang =
  | { art: 'ok'; seite: Seite; verlauf: Verlauf }
  /** Nichts zu tun. */
  | { art: 'leer' }
  /** Die Seite sieht nicht mehr aus wie nach dem Schritt – der Verlauf ist verworfen, nichts wird überschrieben. */
  | { art: 'fremd'; verlauf: Verlauf };

/** Den letzten Schritt rückgängig machen: die Seite wie vorher. */
export function verlaufZurueck(v: Verlauf, aktuell: Seite): Gang {
  const s = v.zurueck.at(-1);
  if (!s) return { art: 'leer' };
  if (!seiteGleich(aktuell, s.nachher)) return { art: 'fremd', verlauf: LEERER_VERLAUF };
  return {
    art: 'ok',
    seite: s.vorher,
    verlauf: { zurueck: v.zurueck.slice(0, -1), vor: [...v.vor, s] },
  };
}

/** Den nächsten Schritt wiederholen: die Seite wie nachher. */
export function verlaufVor(v: Verlauf, aktuell: Seite): Gang {
  const s = v.vor.at(-1);
  if (!s) return { art: 'leer' };
  if (!seiteGleich(aktuell, s.vorher)) return { art: 'fremd', verlauf: LEERER_VERLAUF };
  return {
    art: 'ok',
    seite: s.nachher,
    verlauf: { zurueck: [...v.zurueck, s], vor: v.vor.slice(0, -1) },
  };
}
