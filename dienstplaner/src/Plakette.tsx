import type { ReactNode } from 'react';
import { Etikett } from '@ui/bedienung/Etikett';
import { Icon } from '@ui/icons/icons';
import styles from './Plakette.module.scss';

/**
 * **Eine Plakette für einen Dienst**: zugesagt (grün, Haken), angefragt (blau, „?“) oder abgesagt (grau).
 * Termine-Liste und Startseite zeigen dieselben – hier steht, wie sie aussehen. Klein (Termine-Liste) bewusst ohne Fläche
 * (Alwin, 14.10.2026: getönte Pillen sahen neben den Filter-Knöpfen selbst wie Knöpfe aus); groß ist ein `Etikett`.
 */
export function Plakette({
  art,
  gross = false,
  children,
}: {
  art: 'zugesagt' | 'angefragt' | 'abgesagt';
  gross?: boolean;
  children: ReactNode;
}) {
  const inhalt = (
    <>
      {art === 'zugesagt' && <Icon name="check" size={13} />}
      {art === 'angefragt' && <span aria-hidden="true">?</span>}
      <span>{children}</span>
    </>
  );
  // Groß („Du: …“ auf der Startseite) ist ein Etikett (R9): zugesagt grün, angefragt blau, abgesagt grau.
  if (gross)
    return (
      <Etikett ton={art === 'zugesagt' ? 'gruen' : art === 'angefragt' ? 'blau' : 'neutral'}>
        {inhalt}
      </Etikett>
    );
  return <span className={`${styles.plakette} ${styles[art]}`}>{inhalt}</span>;
}
