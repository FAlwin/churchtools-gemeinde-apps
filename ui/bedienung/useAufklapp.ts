import { useEffect, useRef, useState } from 'react';

/**
 * **Ein Menü unter einem Knopf** – auf, zu, schließen bei Tipp daneben oder Escape. Eine Stelle für
 * Filter- und Zeitraum-Knopf (14.10.2026) und „+ … hinzufügen“ (`OptionWaehlen`, S2 – baute die Mechanik zunächst
 * ein zweites Mal), damit sie nicht mehrfach entsteht. `rahmen` kommt an das
 * Element, das Knopf und Menü umschließt – ein Tipp darin schließt nicht. Steht das Menü woanders (an `body`, damit
 * keine Karte es abschneidet – Plus an der Ablauf-Zeile, 30.10.2026), kommt `menue` an das Menü: Ein Tipp dort
 * schließt ebenfalls nicht, sonst ginge es zu, bevor die Wahl ankommt.
 */
export function useAufklapp() {
  const [offen, setOffen] = useState(false);
  const rahmen = useRef<HTMLDivElement>(null);
  const menue = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!offen) return;
    const weg = (e: PointerEvent) => {
      const ziel = e.target as Node;
      if (menue.current?.contains(ziel)) return;
      if (rahmen.current && !rahmen.current.contains(ziel)) setOffen(false);
    };
    const taste = (e: KeyboardEvent) => e.key === 'Escape' && setOffen(false);
    document.addEventListener('pointerdown', weg);
    document.addEventListener('keydown', taste);
    return () => {
      document.removeEventListener('pointerdown', weg);
      document.removeEventListener('keydown', taste);
    };
  }, [offen]);

  return { offen, setOffen, rahmen, menue };
}
