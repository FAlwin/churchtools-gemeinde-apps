import { useMemo } from 'react';
import { gemeindeZeitzone } from '@shared/ct/zeit';
import type { Seite } from '@shared/website/modell';
import { vorschauHtml, VORSCHAU_SANDBOX, type VorschauStand } from './vorschauHtml';
import styles from './Vorschau.module.scss';

export type Ansicht = 'computer' | 'handy';

/**
 * **Die Vorschau** (Bauplan Website W3a-1): die Seite, wie der echte Renderer sie ausgibt, in einem abgeschotteten
 * `iframe` (`vorschau.ts` erklärt Sandbox und Adressen). Umschalter „Computer | Handy“ = ganze Breite oder ein Rahmen von
 * 390 px.
 */
export function Vorschau({
  seite,
  stand,
  gemeinde,
  ansicht,
}: {
  seite: Seite;
  stand: VorschauStand;
  gemeinde: string | null;
  ansicht: Ansicht;
}) {
  const html = useMemo(
    () => vorschauHtml(seite, stand, gemeinde, gemeindeZeitzone()),
    [seite, stand, gemeinde],
  );
  return (
    <div className={`${styles.buehne}${ansicht === 'handy' ? ' ' + styles.handy : ''}`}>
      <iframe
        className={styles.rahmen}
        title={`Vorschau: ${seite.titel}`}
        sandbox={VORSCHAU_SANDBOX}
        srcDoc={html}
      />
    </div>
  );
}
