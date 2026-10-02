import type { ReactNode } from 'react';
import { KnopfReihe } from './KnopfReihe';
import { Screen, Scroll } from './Screen';
import { GrosseUeberschrift } from './GrosseUeberschrift';

interface SeitenGeruestProps {
  /** Die große Überschrift am Anfang des Inhalts. */
  titel: string;
  /** Zweite Zeile darunter, z. B. Wochentag und Uhrzeit eines Ablaufs. */
  unterzeile?: string;
  /** Zurück links in der Knopfreihe. Ohne sie (und ohne `aktionen`) gibt es keine Knopfreihe. */
  zurueck?: () => void;
  /** Wohin „zurück" führt („Termine") – für Screenreader; sichtbar ist nur der runde Pfeil. */
  zurueckLabel?: string;
  /** Runde Knöpfe rechts (`RundKnopf`: Teilen, Bearbeiten …). */
  aktionen?: ReactNode;
  /**
   * „Runterziehen zum Aktualisieren".
   *
   * **Der Rückgabetyp ist Absicht und der eigentliche Fix vom 22.09.2026.** Die Abwesenheiten
   * übergaben hier eine Funktion, die zwei Abrufe mit `void` startete und selbst nichts zurückgab –
   * die Anzeige war deshalb sofort wieder weg, während im Hintergrund noch geladen wurde. Mit
   * `Promise<unknown>` kann das nicht mehr passieren: Eine Funktion ohne Rückgabe wird vom Compiler
   * abgelehnt. Wer mehrere Abfragen neu lädt, gibt `Promise.all([...])` zurück.
   */
  onNeuLaden?: () => Promise<unknown>;
  /** Der scrollende Inhalt der Seite. */
  children: ReactNode;
  /**
   * Alles, was ÜBER dem Inhalt schwebt und nicht mitscrollt: Plus-Knopf, Speichern-Leiste,
   * Dialoge, Meldungen. Steht als Geschwister neben dem Scroll-Bereich, nicht darin.
   */
  ueberlagerung?: ReactNode;
}

/**
 * Das gemeinsame Gerüst aller Bildschirme: Kopf, Scrollen, Neuladen (22.09.2026).
 *
 * Alwin: „bitte alles gleich mit dem Header und den sachen. und schön mit komponenten arbeiten" –
 * vorher setzte jede Seite dasselbe Muster selbst zusammen (`Screen` + `Scroll` + `GrosseUeberschrift`),
 * und genau dort liefen die Fassungen auseinander: Bei den Abwesenheiten wartete das Neuladen nicht
 * auf die Daten, bei den Terminen blitzte es nur auf. Das ist die Fehlerklasse „dieselbe Regel an
 * mehreren Stellen" – deshalb gibt es sie jetzt nur noch **einmal**, hier.
 *
 * Aufbau (bewusst für iOS 26/27, siehe `client/index.html`): Der Titel steht **groß im Inhalt** und
 * scrollt mit weg, oben gibt es keine farbige Fläche. Gibt es etwas anzutippen (Zurück, Teilen …),
 * schweben runde Knöpfe direkt unter dem Unschärfe-Band (`KnopfReihe`, 02.10.2026) und bleiben beim
 * Scrollen stehen; die Überschrift rückt um ihre Höhe nach unten.
 */
export function SeitenGeruest({
  titel,
  unterzeile,
  zurueck,
  zurueckLabel,
  aktionen,
  onNeuLaden,
  children,
  ueberlagerung,
}: SeitenGeruestProps) {
  const mitKnoepfen = Boolean(zurueck || aktionen);
  return (
    <Screen>
      <Scroll onRefresh={onNeuLaden}>
        <GrosseUeberschrift unterzeile={unterzeile} unterKnoepfen={mitKnoepfen}>
          {titel}
        </GrosseUeberschrift>
        {children}
      </Scroll>
      {/* Nach dem Scroll-Bereich, damit die Knöpfe über dem durchlaufenden Inhalt liegen. */}
      {mitKnoepfen && (
        <KnopfReihe zurueck={zurueck} zurueckLabel={zurueckLabel} aktionen={aktionen} />
      )}
      {ueberlagerung}
    </Screen>
  );
}
