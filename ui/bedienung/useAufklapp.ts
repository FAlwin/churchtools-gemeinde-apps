import { useEffect, useRef, useState } from 'react';

/**
 * **Ein Menü unter einem Knopf** – auf, zu, schließen bei Tipp daneben oder Escape. Eine Stelle für
 * Filter- und Zeitraum-Knopf (14.10.2026) und „+ … hinzufügen“ (`OptionWaehlen`, S2 – baute die Mechanik zunächst
 * ein zweites Mal), damit sie nicht mehrfach entsteht. `rahmen` kommt an das
 * Element, das Knopf und Menü umschließt – ein Tipp darin schließt nicht.
 */
export function useAufklapp() {
  const [offen, setOffen] = useState(false);
  const rahmen = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!offen) return;
    const weg = (e: PointerEvent) => {
      if (rahmen.current && !rahmen.current.contains(e.target as Node)) setOffen(false);
    };
    const taste = (e: KeyboardEvent) => e.key === 'Escape' && setOffen(false);
    document.addEventListener('pointerdown', weg);
    document.addEventListener('keydown', taste);
    return () => {
      document.removeEventListener('pointerdown', weg);
      document.removeEventListener('keydown', taste);
    };
  }, [offen]);

  return { offen, setOffen, rahmen };
}
