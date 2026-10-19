import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Icon } from '@ui/icons/icons';
import { fehlerMeldung } from './zustand';
import v from './VeranstaltungSeite.module.scss';

/**
 * **Was zuletzt geändert wurde – mit „Rückgängig“** (Alwin, 13.10.2026: „immer mit Warnungen und
 * Rückgängig-Knöpfen“). Eine Leiste für die ganze Erweiterung: Sie steht oben über der Seite und bleibt
 * auch nach einem Seitenwechsel stehen (nach dem Archivieren springt die Seite zur Übersicht). Es gibt
 * immer nur die letzte Änderung zurück. `rueckgaengig: null` = nicht umkehrbar (endgültig gelöscht).
 */
export interface Aenderung {
  text: string;
  rueckgaengig: (() => Promise<void>) | null;
}

/** Der Ablauf von „Rückgängig“ – EINE Stelle für die Leiste und für die Zeile im Fenster. */
function useRueckgaengig(aenderung: Aenderung, onRueckgaengig: () => void) {
  const [stand, setStand] = useState<'bereit' | 'arbeitet' | 'erledigt'>('bereit');
  const [fehler, setFehler] = useState<string | null>(null);

  async function zurueck() {
    if (!aenderung.rueckgaengig) return;
    setStand('arbeitet');
    setFehler(null);
    try {
      await aenderung.rueckgaengig();
      setStand('erledigt');
      onRueckgaengig();
    } catch (e) {
      setFehler(fehlerMeldung(e).text);
      setStand('bereit');
    }
  }
  return { stand, fehler, zurueck };
}

export function RueckgaengigLeiste({
  aenderung,
  onRueckgaengig,
  onSchliessen,
}: {
  aenderung: Aenderung;
  /** Nach erfolgreichem Rückgängig – die offene Seite lädt neu. */
  onRueckgaengig: () => void;
  onSchliessen: () => void;
}) {
  const { stand, fehler, zurueck } = useRueckgaengig(aenderung, onRueckgaengig);

  return (
    <div className={v.leiste} role="status">
      <span>
        {stand === 'erledigt' ? 'Rückgängig gemacht.' : aenderung.text}
        {fehler && <span className={v.leisteFehler}> {fehler}</span>}
      </span>
      {aenderung.rueckgaengig && stand !== 'erledigt' && (
        <button
          type="button"
          className={v.leisteKnopf}
          disabled={stand === 'arbeitet'}
          onClick={zurueck}
        >
          {stand === 'arbeitet' ? 'Wird rückgängig gemacht …' : 'Rückgängig'}
        </button>
      )}
      <button
        type="button"
        className={v.leisteZu}
        aria-label="Hinweis schließen"
        onClick={onSchliessen}
      >
        <Icon name="x" size={16} />
      </button>
    </div>
  );
}

/**
 * **„Rückgängig“ im Fenster** (Alwin, 19.10.2026: „Rückgängig bitte immer bei modalen im modal direkt rein“) – die
 * Leiste unten liegt hinter einem offenen Fenster; der erste Klick darauf schloss nur das Fenster. Änderungen in einem
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
  const { stand, fehler, zurueck } = useRueckgaengig(aenderung, onRueckgaengig);
  // Die Zeile kann weit unten im Fenster entstehen (Knopf an einer Person) – sie soll zu sehen sein. In geschweiften
  // Klammern: Chrome 152 gibt bei `scrollIntoView` ein Promise zurück – als Rückgabe des Effekts hielt React es für
  // die Aufräum-Funktion und stürzte ab, sobald die Zeile verschwand (19.10.2026, „Mail schreiben“ → weiße Seite).
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    ref.current?.scrollIntoView?.({ block: 'nearest' });
  }, []);
  return (
    <div ref={ref} className={v.imFenster} role="status">
      <span>
        {stand === 'erledigt' ? 'Rückgängig gemacht.' : aenderung.text}
        {fehler && <span className={v.leisteFehler}> {fehler}</span>}
      </span>
      {stand !== 'erledigt' && zusatz}
      {aenderung.rueckgaengig && stand !== 'erledigt' && (
        <button
          type="button"
          className={v.leisteKnopf}
          disabled={stand === 'arbeitet'}
          onClick={zurueck}
        >
          {stand === 'arbeitet' ? 'Wird rückgängig gemacht …' : 'Rückgängig'}
        </button>
      )}
    </div>
  );
}
