import type { SVGProps } from 'react';
import {
  HOEHE,
  kantenPfad,
  SCHALTER,
  schalterStummel,
  type Anordnung,
  type LageKnoten,
  type SichtKnoten,
} from '@shared/organigramm/ansichten';
import { fett, ZEILEN_EINZUG, type KastenZeile } from './messung';
import styles from './Diagramm.module.scss';

type GruppenEigenschaften = SVGProps<SVGGElement>;

interface Props {
  anordnung: Anordnung;
  kuerzen: (k: SichtKnoten, breite: number) => string;
  /** Was unter dem Namen steht (O7b-6) – ohne Angabe nur der Name. */
  zeilen?: (k: SichtKnoten) => KastenZeile[];
  /**
   * Was ein Kästchen einer Gruppe zum Klicken braucht (Bildschirm); `null` = dieses Kästchen nicht (Präsentation: nur die
   * Bereiche). Fehlt es, ist das Bild nur zum Ansehen (PDF).
   */
  knoten?: (lage: LageKnoten) => GruppenEigenschaften | null;
  /** Die runden +/− – nur am Bildschirm; auf Papier gibt es nichts zu klappen. */
  schalter?: (lage: LageKnoten) => GruppenEigenschaften;
}

const ZEILEN_STIL: Record<KastenZeile['art'], string> = {
  rolle: styles.rolle,
  person: styles.person,
  zahl: styles.zahl,
  hinweis: styles.hinweis,
};

/**
 * **Das Bild eines Diagramms** (O7b): Linien, Kästchen und – am Bildschirm – die runden +/−. Gemeinsam für das Diagramm
 * im Reiter (O7b-3) und die PDF (O7b-4), damit Papier und Bildschirm gleich aussehen. Die Gemeinde selbst ist keine
 * Gruppe und öffnet nichts.
 */
export function DiagrammBild({ anordnung, kuerzen, zeilen, knoten, schalter }: Props) {
  return (
    <>
      {anordnung.kanten.map((k, i) => (
        <path key={i} className={styles.kante} d={kantenPfad(k)} />
      ))}
      {/* Auf Papier fehlt das +/− – dort führt die Linie bis ans Kästchen. */}
      {!schalter &&
        anordnung.knoten.map((lage) => {
          const stummel = schalterStummel(lage);
          return stummel ? (
            <path
              key={'l' + lage.knoten.schluessel}
              className={styles.kante}
              d={kantenPfad(stummel)}
            />
          ) : null;
        })}
      {anordnung.knoten.map((lage) => {
        const { knoten: k, x, y, breite, hoehe } = lage;
        const stil = k.ebene === 0 ? styles.spitze : fett(k) ? styles.fett : '';
        const klick = k.id === null || !knoten ? null : knoten(lage);
        const darunter = zeilen?.(k) ?? [];
        return (
          <g
            key={k.schluessel}
            className={`${styles.knoten}${klick ? ' ' + styles.klickbar : ''} ${stil}`}
            {...klick}
          >
            <title>{k.name}</title>
            <rect x={x} y={y} width={breite} height={hoehe} rx={6} />
            <text x={x + breite / 2} y={y + HOEHE / 2}>
              {kuerzen(k, breite)}
            </text>
            {darunter.length > 0 && (
              <line
                className={styles.trenn}
                x1={x + 8}
                x2={x + breite - 8}
                y1={y + HOEHE}
                y2={y + HOEHE}
              />
            )}
            {darunter.map((z, i) => (
              <text key={i} className={ZEILEN_STIL[z.art]} x={x + ZEILEN_EINZUG} y={y + z.y}>
                {z.text}
              </text>
            ))}
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
