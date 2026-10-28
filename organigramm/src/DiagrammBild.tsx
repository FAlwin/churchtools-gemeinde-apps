import type { SVGProps } from 'react';
import {
  HOEHE,
  kantenPfad,
  SCHALTER,
  type Anordnung,
  type LageKnoten,
  type SichtKnoten,
} from '@shared/organigramm/ansichten';
import { fett } from './messung';
import styles from './Diagramm.module.scss';

type GruppenEigenschaften = SVGProps<SVGGElement>;

interface Props {
  anordnung: Anordnung;
  kuerzen: (k: SichtKnoten, breite: number) => string;
  /** Was ein Kästchen einer Gruppe zum Klicken braucht (Bildschirm). Fehlt es, ist das Bild nur zum Ansehen (Druck). */
  knoten?: (lage: LageKnoten) => GruppenEigenschaften;
  /** Die runden +/− – nur am Bildschirm; auf Papier gibt es nichts zu klappen. */
  schalter?: (lage: LageKnoten) => GruppenEigenschaften;
}

/**
 * **Das Bild eines Diagramms** (O7b): Linien, Kästchen und – am Bildschirm – die runden +/−. Gemeinsam für das Diagramm
 * im Reiter (O7b-3) und den Druck (O7b-4), damit Papier und Bildschirm gleich aussehen. Die Gemeinde selbst ist keine
 * Gruppe und öffnet nichts.
 */
export function DiagrammBild({ anordnung, kuerzen, knoten, schalter }: Props) {
  return (
    <>
      {anordnung.kanten.map((k, i) => (
        <path key={i} className={styles.kante} d={kantenPfad(k)} />
      ))}
      {anordnung.knoten.map((lage) => {
        const { knoten: k, x, y, breite } = lage;
        const stil = k.ebene === 0 ? styles.spitze : fett(k) ? styles.fett : '';
        const klick = k.id === null || !knoten ? null : knoten(lage);
        return (
          <g
            key={k.schluessel}
            className={`${styles.knoten}${klick ? ' ' + styles.klickbar : ''} ${stil}`}
            {...klick}
          >
            <title>{k.name}</title>
            <rect x={x} y={y} width={breite} height={HOEHE} rx={6} />
            <text x={x + breite / 2} y={y + HOEHE / 2}>
              {kuerzen(k, breite)}
            </text>
          </g>
        );
      })}
      {schalter &&
        anordnung.knoten.map((lage) =>
          lage.schalter ? (
            <g key={'s' + lage.knoten.schluessel} className={styles.schalter} {...schalter(lage)}>
              <circle cx={lage.schalter.x} cy={lage.schalter.y} r={SCHALTER} />
              <text x={lage.schalter.x} y={lage.schalter.y}>
                {lage.knoten.offen ? '−' : lage.knoten.kinderZahl}
              </text>
            </g>
          ) : null,
        )}
    </>
  );
}
