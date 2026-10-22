/**
 * **Der Ablauf als Liste – wie in der Musik-App** (Bauplan E6-1b; vorher fest in `client/src/components/AgendaFullView.tsx`).
 * Jeder Punkt eine Karte mit Uhrzeit, Bezeichnung, Notiz und Zuständigen, Abschnitte als Band, die Linie „Beginn“
 * nach dem Vorlauf. Die Musik-App macht Lieder antippbar (→ Charts) und setzt Schildchen „neu/geändert“; der
 * Dienstplaner zeigt die Dauer neben der Zeit (Alwin, 17.10.2026). Die Regeln einer Zeile stehen in
 * `@shared/ct/ablaufZeile`.
 */
import { Fragment, type ReactNode } from 'react';
import { beginnStelle, type AblaufZeile } from '@shared/ct/ablaufZeile';
import {
  BeginnLinie,
  ItemTitle,
  ResponsibleLine,
  WeggelassenHinweis,
  ZeitText,
} from './AblaufTeile';
import styles from './AblaufListe.module.scss';

export function AblaufListe({
  zeilen,
  beginn,
  dauerNebenZeit = false,
  onLied,
  schild,
  kopf,
}: {
  zeilen: readonly AblaufZeile[];
  /** Uhrzeit des Veranstaltungsbeginns („10:00“) für die Linie nach dem Vorlauf (#423). */
  beginn?: string;
  /** Dauer neben der Uhrzeit statt rechts am Titel (Dienstplaner). */
  dauerNebenZeit?: boolean;
  /** Lied-Zeilen antippbar machen (Musik-App: zu den Charts) – mit der Nummer des Lieds im Ablauf. */
  onLied?: (liedIndex: number) => void;
  /** Ein Schildchen am Punkt („neu“, „geändert“) – Musik-App. */
  schild?: (id: number) => string | null;
  /** Steht als Erstes in der Liste (Musik-App: der Hinweis „Ablauf geändert“) – mit denselben Abständen. */
  kopf?: ReactNode;
}) {
  const sichtbar = zeilen.filter((z) => !z.removed);
  // Die Linie „Beginn“ vor dem ersten Punkt nach dem Vorlauf (#423) – nur, wenn es Vorlauf gibt.
  const stelle = beginnStelle(sichtbar);
  let liedIndex = -1;

  const zeile = (item: AblaufZeile) => {
    const tagText = schild?.(item.id) ?? null;
    const tag = tagText && <span className={styles.aenderungsTag}>{tagText}</span>;
    const vl =
      (item.vorBeginn ? ` ${styles.vorlauf}` : '') +
      (item.weggelassen ? ` ${styles.weggelassen}` : '');
    const weg = item.weggelassen && <WeggelassenHinweis />;
    if (item.isHeader) {
      return (
        <div key={item.id} className={`${styles.sectionBand}${vl}`}>
          {(item.time || item.weggelassen) && (
            <span className={styles.bandTime}>
              <ZeitText item={item} />
            </span>
          )}
          {item.title}
          {tag}
          {weg}
        </div>
      );
    }
    const dauer = item.durationMin ? `${item.durationMin} Min` : null;
    const zeit = dauerNebenZeit ? (
      <div className={`${styles.flowTime} ${styles.zeitMitDauer}`}>
        <span>
          <ZeitText item={item} />
        </span>
        {dauer && <span className={styles.zeitDauer}>{dauer}</span>}
      </div>
    ) : (
      <div className={styles.flowTime}>
        <ZeitText item={item} />
      </div>
    );
    const inhalt = (
      <div className={styles.flowBody}>
        <div className={styles.flowHead}>
          <ItemTitle item={item} />
          {item.song && <span className={styles.flowSongTag}>🎵</span>}
          {tag}
          {weg}
          {!dauerNebenZeit && dauer && <span className={styles.flowDur}>{dauer}</span>}
        </div>
        {item.note && <div className={styles.flowNote}>{item.note}</div>}
        <ResponsibleLine entries={item.responsible} />
      </div>
    );
    if (item.song && onLied) {
      liedIndex += 1;
      const idx = liedIndex;
      return (
        <button
          key={item.id}
          className={`${styles.flowRowBtn} ${styles.songRow}${vl}`}
          data-tour={idx === 0 ? 'setlist-song' : undefined}
          onClick={() => onLied(idx)}
        >
          {zeit}
          {inhalt}
        </button>
      );
    }
    return (
      <div
        key={item.id}
        className={`${styles.flowRow}${item.song ? ` ${styles.songRow}` : ''}${vl}`}
      >
        {zeit}
        {inhalt}
      </div>
    );
  };

  return (
    <div className={styles.flowList}>
      {kopf}
      {sichtbar.map((item, i) => (
        <Fragment key={item.id}>
          {i === stelle && <BeginnLinie zeit={beginn} />}
          {zeile(item)}
        </Fragment>
      ))}
      {stelle === sichtbar.length && <BeginnLinie zeit={beginn} />}
    </div>
  );
}
