import { minusErlaubt, plaetzeGrenze, plusErlaubt } from './plaetzeGrenze';
import type { PlaetzeZeile } from './PlaetzeFach';
import eigen from './PlaetzeFach.module.scss';

/**
 * **− Zahl +** für einen Dienst – der Regler des Plätze-Fachs (`PlaetzeFach`) und des Fensters in „Personen“
 * (`PlatzFenster`, P2c) sind dasselbe Stück. − geht nicht unter die Belegten und die Entwürfe auf freien Plätzen, + hat
 * keine Obergrenze – auch mit Entwürfen (19.11.2026: der Dienstplaner trägt sie nach der Änderung selbst auf die neuen
 * Nummern um). **Gesperrt** sind beide nur, wo die Entwürfe der Gruppe nicht umgetragen werden dürfen. Die Grenzen rechnet
 * `plaetzeGrenze` – eine Stelle für Regler und Hinweise.
 */
export function PlatzRegler({
  z,
  n,
  laeuft,
  beschaeftigt,
  onSetze,
}: {
  z: PlaetzeZeile;
  /** Die Zahl, wie das Fenster sie gerade kennt. */
  n: number;
  laeuft: boolean;
  beschaeftigt: boolean;
  onSetze: (neu: number) => void;
}) {
  const grenze = plaetzeGrenze(z, n);
  return (
    <>
      <button
        type="button"
        className={eigen.rund}
        disabled={beschaeftigt || !minusErlaubt(grenze, n)}
        aria-label={`${z.name}: ein Platz weniger`}
        title={grenze.hinweis ?? undefined}
        onClick={() => onSetze(n - 1)}
      >
        −
      </button>
      <span className={eigen.zahl} aria-label={`${z.name}: ${n} Plätze`}>
        {laeuft ? '…' : n}
      </span>
      <button
        type="button"
        className={eigen.rund}
        disabled={beschaeftigt || !plusErlaubt(grenze)}
        aria-label={`${z.name}: ein Platz mehr`}
        title={grenze.art === 'gesperrt' ? grenze.hinweis : undefined}
        onClick={() => onSetze(n + 1)}
      >
        +
      </button>
    </>
  );
}
