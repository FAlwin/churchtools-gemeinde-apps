import type { ReactNode } from 'react';
import { Screen, Scroll } from './Screen';
import { SeitenKopf } from './SeitenKopf';
import { VollbildKnopf } from './VollbildKnopf';

interface SeitenGeruestProps {
  /** Die große Überschrift am Anfang des Inhalts – mit `stattTitel` nur für Screenreader. */
  titel: string;
  /**
   * Was an der Stelle der großen Überschrift steht: der Haupt-Wähler der Seite (Kommende/Vergangene, die Suche …).
   *
   * Für die Seiten hinter einem Reiter (Termine, Lieder, Abwesenheiten, Mehr): Dort wiederholte die Überschrift nur den markierten
   * Reiter (Alwin, 28.10.2026: „die Überschriften sind doppelt gemoppelt“). Die ChurchTools-App macht es bei
   * „Kalender“ und „Beiträge“ ebenso – oben steht der Wähler, keine Überschrift. Die Knöpfe (Vollbild) stehen rechts
   * daneben in derselben Zeile.
   */
  stattTitel?: ReactNode;
  /** Zweite Zeile darunter, z. B. Wochentag und Uhrzeit eines Ablaufs. */
  unterzeile?: string;
  /** Zurück links in der Knopfreihe. Ohne sie (und ohne `aktionen`) gibt es keine Knopfreihe. */
  zurueck?: () => void;
  /** Wohin „zurück" führt („Termine") – steht auf dem Knopf („← Termine"). */
  zurueckLabel?: string;
  /** Knöpfe rechts im Seitenkopf (`KopfKnopf`: Teilen, Bearbeiten …). */
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
 * Aufbau (bewusst für iOS 26/27, siehe `client/index.html`): Der Kopf (`SeitenKopf`) steht **im Inhalt** und
 * scrollt mit weg – Titel, Zurück und Knöpfe im ChurchTools-Stil (Scheibe S, 26.10.2026). Bis dahin schwebten runde
 * Knöpfe über dem Inhalt (`KnopfReihe`); Alwin: „sieht eher wie eine iOS-App aus“.
 */
export function SeitenGeruest({
  titel,
  stattTitel,
  unterzeile,
  zurueck,
  zurueckLabel,
  aktionen,
  onNeuLaden,
  children,
  ueberlagerung,
}: SeitenGeruestProps) {
  // Der Vollbild-Knopf (nur Erweiterung) steht auf JEDER Seite ganz rechts im Kopf – an einer Stelle, damit man ihn
  // zum Ein- und Ausschalten immer am selben Ort findet (Entwurf mit Alwin, 08.10.2026).
  return (
    <Screen>
      <Scroll onRefresh={onNeuLaden}>
        <SeitenKopf
          titel={titel}
          stattTitel={stattTitel}
          unterzeile={unterzeile}
          zurueck={zurueck}
          zurueckLabel={zurueckLabel}
          aktionen={
            <>
              {aktionen}
              <VollbildKnopf />
            </>
          }
        />
        {children}
      </Scroll>
      {ueberlagerung}
    </Screen>
  );
}
