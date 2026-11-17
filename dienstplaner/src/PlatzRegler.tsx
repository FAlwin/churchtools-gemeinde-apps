import { sperreText } from './plaetzeTexte';
import type { PlaetzeZeile } from './PlaetzeFach';
import eigen from './PlaetzeFach.module.scss';

/**
 * **− Zahl +** für einen Dienst – der Regler des Plätze-Fachs (`PlaetzeFach`) und des Fensters in „Personen“
 * (`PlatzFenster`, P2c) sind dasselbe Stück. − geht nicht unter die Belegten, + hat keine Obergrenze; **liegt an diesem
 * Dienst und Termin ein Entwurf, sind beide gesperrt** (`sperreText`: ChurchTools nummeriert die Plätze beim Ändern neu,
 * ein Entwurf fände seinen Platz nicht mehr – gemessen 15.10.2026).
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
  return (
    <>
      <button
        type="button"
        className={eigen.rund}
        disabled={beschaeftigt || n <= z.belegt || z.entwuerfe > 0}
        aria-label={`${z.name}: ein Platz weniger`}
        title={z.entwuerfe > 0 ? sperreText(z.entwuerfe) : undefined}
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
        disabled={beschaeftigt || z.entwuerfe > 0}
        aria-label={`${z.name}: ein Platz mehr`}
        title={z.entwuerfe > 0 ? sperreText(z.entwuerfe) : undefined}
        onClick={() => onSetze(n + 1)}
      >
        +
      </button>
    </>
  );
}
