import { Icon } from '@ui/icons/icons';
import { tagPunkt } from '@shared/ct/datum';
import { VERWEIS_TEXT } from './anzeige';
// Dieselben Marken wie in der Lese-Ansicht – Aufgabe, Beschluss und Termin sehen beim Schreiben aus wie beim Lesen.
import styles from './ProtokollAnsicht.module.scss';

/**
 * **Wie die eigenen Blöcke im Editor aussehen** (S4-1) – die Darstellung zu den Blockarten aus `editorSchema.ts`. In
 * S4-1 halten sie nur ihre Daten fest; Wer/Bis, Datum wählen und die Liste der offenen To-Dos kommen in S4-2/S4-3.
 * `contentRef` ist die Stelle, an der BlockNote den bearbeitbaren Text einhängt.
 */
interface Inhalt {
  contentRef: (el: HTMLElement | null) => void;
}

export function AufgabeBlock({ contentRef }: Inhalt) {
  return (
    <div className={`${styles.marke} ${styles.aufgabe}`}>
      <span contentEditable={false}>
        <Icon name="clock" size={16} />
      </span>
      <div className={styles.markeText} ref={contentRef} />
    </div>
  );
}

export function BeschlussBlock({ contentRef }: Inhalt) {
  return (
    <div className={`${styles.marke} ${styles.beschluss}`}>
      <b contentEditable={false}>Beschluss</b>
      <div className={styles.markeText} ref={contentRef} />
    </div>
  );
}

export function TerminBlock({
  block,
  contentRef,
}: Inhalt & { block: { props: { datum: string } } }) {
  return (
    <div className={`${styles.marke} ${styles.termin}`}>
      <span contentEditable={false}>
        <Icon name="calendar" size={16} />
      </span>
      {/^\d{4}-\d{2}-\d{2}$/.test(block.props.datum) && (
        <b contentEditable={false}>{tagPunkt(block.props.datum)}</b>
      )}
      <div className={styles.markeText} ref={contentRef} />
    </div>
  );
}

export function VerweisBlock({ block }: { block: { props: { art: string } } }) {
  return <p className={styles.verweis}>{VERWEIS_TEXT[block.props.art] ?? 'Fester Punkt'}</p>;
}
