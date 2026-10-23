import { useEffect, useRef, type ReactNode } from 'react';
import { useAenderungZurueck, type Aenderung } from './aenderung';
import styles from './Rueckgaengig.module.scss';

/**
 * **„Rückgängig“ im Fenster** (Alwin, 19.10.2026: „Rückgängig bitte immer bei modalen im modal direkt rein“) – eine
 * Leiste unten läge hinter einem offenen Fenster; der erste Klick darauf schloss nur das Fenster. Änderungen in einem
 * Fenster zeigen ihr „Rückgängig“ deshalb hier, im Fenster selbst.
 */
export function RueckgaengigImFenster({
  aenderung,
  onRueckgaengig,
  zusatz,
}: {
  aenderung: Aenderung;
  /** Nach erfolgreichem Rückgängig – neu laden. */
  onRueckgaengig: () => void;
  /** Ein weiterer Knopf neben „Rückgängig“ (A7-3: „Mail schreiben“) – nicht mehr nach dem Rückgängigmachen. */
  zusatz?: ReactNode;
}) {
  const { stand, fehler, zurueck } = useAenderungZurueck(aenderung, onRueckgaengig);
  // Die Zeile kann weit unten im Fenster entstehen (Knopf an einer Person) – sie soll zu sehen sein. In geschweiften
  // Klammern: Chrome 152 gibt bei `scrollIntoView` ein Promise zurück – als Rückgabe des Effekts hielt React es für
  // die Aufräum-Funktion und stürzte ab, sobald die Zeile verschwand (19.10.2026, „Mail schreiben“ → weiße Seite).
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    ref.current?.scrollIntoView?.({ block: 'nearest' });
  }, []);
  return (
    <div ref={ref} className={styles.imFenster} role="status">
      <span>
        {stand === 'erledigt' ? 'Rückgängig gemacht.' : aenderung.text}
        {fehler && <span className={styles.fehler}> {fehler}</span>}
      </span>
      {stand !== 'erledigt' && zusatz}
      {aenderung.rueckgaengig && stand !== 'erledigt' && (
        <button
          type="button"
          className={styles.knopf}
          disabled={stand === 'arbeitet'}
          onClick={zurueck}
        >
          {stand === 'arbeitet' ? 'Wird rückgängig gemacht …' : 'Rückgängig'}
        </button>
      )}
    </div>
  );
}
