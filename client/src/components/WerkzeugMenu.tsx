import type { ReactNode } from 'react';
import styles from '../pages/ChordChart.module.scss';

export interface Werkzeug {
  /** Stabiler Schlüssel – auch für Tests. */
  id: string;
  label: string;
  symbol: ReactNode;
  onClick: () => void;
}

/**
 * **Das Werkzeuge-Menü des Liedblatts** (02.10.2026, Alwin: „Ein Knopf für alles").
 *
 * Vorher standen Aussehen, Tempo, Zoom zurücksetzen, Notizen von … und Anmerken als eigene Knöpfe
 * oben rechts – im Unschärfe-Band von iOS 26/27, und sie nahmen dem Liedtitel den Platz. Jetzt
 * öffnet sie ein runder Knopf. Welche Einträge es gibt, entscheidet der Aufrufer (`ChartHeader`
 * kennt die Bedingungen); hier steht nur, wie sie aussehen.
 *
 * Gleiche Bausteine wie die übrigen Liedblatt-Menüs (`scrim`, `appMenu`, `mmItem`) – ein Tipp
 * daneben schließt, die Position hängt an `--chart-kopf-unten`.
 */
export function WerkzeugMenu({
  werkzeuge,
  onClose,
}: {
  werkzeuge: Werkzeug[];
  onClose: () => void;
}) {
  return (
    <>
      <div className={styles.scrim} onClick={onClose} />
      <div
        className={`${styles.appMenu} ${styles.werkzeugMenu}`}
        role="menu"
        aria-label="Werkzeuge"
      >
        {werkzeuge.map((w) => (
          <button
            key={w.id}
            type="button"
            role="menuitem"
            className={styles.mmItem}
            onClick={w.onClick}
          >
            <span>{w.label}</span>
            <span className={styles.werkzeugSymbol} aria-hidden="true">
              {w.symbol}
            </span>
          </button>
        ))}
      </div>
    </>
  );
}
