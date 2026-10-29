import type { ReactNode, Ref } from 'react';
import {
  EINRUECKEN,
  flaeche,
  FUSS,
  KOPF,
  namenX,
  RAND,
  PERSON_GROESSE,
  PERSON_ZEILE,
  personenX,
  ROLLE_GROESSE,
  ZEILE,
  type ListenZeile,
  type Papier,
} from './blatt';
import { fett } from './messung';
import styles from './Blatt.module.scss';

export interface BlattKopf {
  /** „Organigramm“. */
  titel: string;
  /** Gemeinde, beim Ausschnitt mit dessen Namen: „Beispielgemeinde · Gottesdienst“. */
  unter: string;
  /** „Stand 28.10.2026“. */
  stand: string;
  /** PNG als Daten-Adresse – oder nichts. */
  logo: string | null;
  /** Links unten auf jeder Seite. */
  fuss: string;
}

interface Props {
  papier: Papier;
  kopf: BlattKopf;
  nr: number;
  von: number;
  /** Nicht die gerade gezeigte Seite – bleibt im Dokument, damit sie in die PDF kommt. */
  verborgen?: boolean;
  svgRef?: Ref<SVGSVGElement>;
  children: ReactNode;
}

/** Abstand vom Logo zum Titel und Größe des Logos (mm). */
const LOGO = 13;
const NEBEN_LOGO = 17;

/**
 * **Eine Seite der Organigramm-PDF** (O7b-4, Entwurf `o7b-4-pdf-v1.html`): oben Logo, „Organigramm“, Gemeinde und
 * Stand, unten Gemeinde und Seitenzahl, dazwischen der Inhalt. Ein SVG in Millimetern – die Vorschau im Fenster, und
 * genau dieses Bild wird zur PDF (`svgSeitenPdf`). Immer hell, auch im Dunkelmodus: Es ist Papier.
 */
export function BlattSeite({ papier, kopf, nr, von, verborgen, svgRef, children }: Props) {
  const { breite: w, hoehe: h } = papier;
  const tx = kopf.logo ? RAND + NEBEN_LOGO : RAND;
  return (
    <svg
      ref={svgRef}
      className={verborgen ? `${styles.seite} ${styles.verborgen}` : styles.seite}
      viewBox={`0 0 ${w} ${h}`}
      role="img"
      aria-label={`${kopf.titel} · ${kopf.unter}, Seite ${nr} von ${von}`}
    >
      <rect className={styles.grund} x={0} y={0} width={w} height={h} />
      {kopf.logo && (
        <image
          href={kopf.logo}
          x={RAND}
          y={RAND - 1}
          width={LOGO}
          height={LOGO}
          preserveAspectRatio="xMidYMid meet"
        />
      )}
      <text className={styles.titel} x={tx} y={RAND + 5}>
        {kopf.titel}
      </text>
      <text className={styles.unter} x={tx} y={RAND + 10.5}>
        {kopf.unter}
      </text>
      <text className={`${styles.stand} ${styles.rechts}`} x={w - RAND} y={RAND + 5}>
        {kopf.stand}
      </text>
      <line
        className={styles.linie}
        x1={RAND}
        y1={RAND + KOPF - 6}
        x2={w - RAND}
        y2={RAND + KOPF - 6}
      />
      {children}
      <text className={styles.fuss} x={RAND} y={h - RAND + FUSS - 8}>
        {kopf.fuss}
      </text>
      <text className={`${styles.fuss} ${styles.rechts}`} x={w - RAND} y={h - RAND + FUSS - 8}>
        Seite {nr} von {von}
      </text>
    </svg>
  );
}

/** Die Zeilen einer Listen-Seite: eingerückt, mit Linien je Ebene wie die Liste im Reiter. */
export function ListenInhalt({
  papier,
  zeilen,
}: {
  papier: Papier;
  zeilen: readonly ListenZeile[];
}) {
  const f = flaeche(papier);
  let y = f.y;
  return (
    <>
      {zeilen.map((z) => {
        const oben = y;
        const hoehe = z.art === 'gruppe' ? ZEILE : PERSON_ZEILE;
        y += hoehe;
        const linien = z.art === 'gruppe' ? z.tiefe : z.linien;
        const striche = Array.from({ length: linien }, (_, l) => {
          const x = f.x + l * EINRUECKEN + 2;
          return (
            <line key={l} className={styles.listeLinie} x1={x} y1={oben} x2={x} y2={oben + hoehe} />
          );
        });
        if (z.art === 'person') {
          const x = personenX(f, z.tiefe);
          return (
            <g key={z.schluessel}>
              {striche}
              {z.rolle && (
                <text className={styles.listeRolle} fontSize={ROLLE_GROESSE} x={x} y={oben + 3.1}>
                  {z.rolle}
                </text>
              )}
              <text
                className={
                  z.kursiv ? `${styles.listePerson} ${styles.listeKursiv}` : styles.listePerson
                }
                fontSize={PERSON_GROESSE}
                x={x + z.ab}
                y={oben + 3.1}
              >
                {z.text}
              </text>
            </g>
          );
        }
        const k = z.knoten;
        const stil = k.ebene === 0 ? styles.listeSpitze : fett(k) ? styles.listeFett : '';
        return (
          <g key={k.schluessel}>
            {striche}
            <text className={`${styles.listeName} ${stil}`} x={namenX(f, z.tiefe)} y={oben + 4.6}>
              {k.name}
            </text>
          </g>
        );
      })}
    </>
  );
}
