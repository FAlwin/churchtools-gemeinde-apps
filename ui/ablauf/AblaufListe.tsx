/**
 * **Der Ablauf als Liste – wie die ChurchTools-App** (Bauplan E6-O1, Entwurf `e6-optik-entwurf.html`, abgenommen
 * 23.10.2026; vorher Karten wie in der Musik-App, E6-1b). Eine Liste mit feinen Linien: links Uhrzeit fett, Dauer klein
 * darunter; Titel, darunter die Zuständigen grau, Notiz und die Lied-Karte; rechts die Kreise (Foto oder Kürzel).
 * Überschriften und „Beginn“ als graue Balken, Lieder mit blauem Streifen. Die Musik-App macht Lieder antippbar
 * (→ Charts) und setzt Schildchen „neu/geändert“. Die Regeln einer Zeile stehen in `@shared/ct/ablaufZeile`.
 */
import { Fragment, type ReactNode } from 'react';
import { ablaufEnde, beginnStelle, itemTitleParts, type AblaufZeile } from '@shared/ct/ablaufZeile';
import type { InfoGruppe } from '@shared/types/index';
import { HANDY_BREITE, useMedienAbfrage } from '../bedienung/useMedienAbfrage';
import {
  BeginnLinie,
  EndeLinie,
  ItemTitle,
  Kuerzel,
  LiedKarte,
  ResponsibleLine,
  WeggelassenHinweis,
  ZeitText,
} from './AblaufTeile';
import styles from './AblaufListe.module.scss';

/** Uhrzeit fett, Dauer klein darunter (Variante 1) – eine Stelle für Ansicht und Bearbeiten-Liste. */
export function ZeitSpalte({
  item,
}: {
  item: Pick<AblaufZeile, 'time' | 'weggelassen' | 'durationMin'>;
}) {
  return (
    <div className={styles.flowTime}>
      <span>
        <ZeitText item={item} />
      </span>
      {item.durationMin ? <span className={styles.zeitDauer}>{item.durationMin} Min</span> : null}
    </div>
  );
}

/**
 * Titel, Zuständige, Notiz, Lied-Karte – was Ansicht und Bearbeiten-Liste in der Mitte einer Zeile zeigen. **Schmal**
 * (Matrix, E6-6a – Entwurf `e6-6-entwurf-2.html`): nur der Titel samt Liedname, höchstens zwei Zeilen; Zuständige, Notiz
 * und Lied-Karte passen nicht in eine Matrix-Spalte.
 */
export function ZeilenInhalt({
  item,
  tag,
  schmal = false,
  infoZeilen = [],
}: {
  item: AblaufZeile;
  tag?: ReactNode;
  schmal?: boolean;
  /** Am Handy: die gewählten Gruppen als Zeile „Technik: …“ unter dem Punkt (E6-4, Entwurf Bild 2). */
  infoZeilen?: readonly InfoGruppe[];
}) {
  if (schmal) {
    return (
      <div className={styles.schmalTitel}>
        <ItemTitle item={item} />
      </div>
    );
  }
  // Heißt der Punkt wie sein Lied (oder hat keinen eigenen Titel), steht der Liedname schon in der Titelzeile.
  const liedImTitel = !!item.song && itemTitleParts(item).songName === null;
  return (
    <>
      <div className={styles.flowHead}>
        <ItemTitle item={item} ohneLiedname={!!item.song} />
        {tag}
        {item.weggelassen && <WeggelassenHinweis />}
      </div>
      <ResponsibleLine entries={item.responsible} />
      {item.note && <div className={styles.flowNote}>{item.note}</div>}
      {infoZeilen.map((g) => {
        const text = infoText(item, g.id);
        return text ? (
          <div key={g.id} className={styles.infoZeile}>
            <b>{g.name}:</b> {text}
          </div>
        ) : null;
      })}
      {item.song && <LiedKarte song={item.song} ohneTitel={liedImTitel} />}
    </>
  );
}

/** Die Info einer Gruppe an einem Punkt – leer, wenn es keine gibt. */
function infoText(item: Pick<AblaufZeile, 'infos'>, gruppe: number): string {
  return item.infos?.find((i) => i.gruppeId === gruppe)?.text ?? '';
}

export function AblaufListe({
  zeilen,
  beginn,
  onLied,
  schild,
  kopf,
  schmal = false,
  mitEnde = false,
  infoSpalten = [],
}: {
  zeilen: readonly AblaufZeile[];
  /** Uhrzeit des Veranstaltungsbeginns („10:00“) für den Balken nach dem Vorlauf (#423). */
  beginn?: string;
  /**
   * Lied-Zeilen antippbar machen – mit der Nummer des Lieds im Ablauf (Musik-App: zu den Charts) und dem Punkt selbst
   * (Dienstplaner: Lied-Ansicht, E6-O O4).
   */
  onLied?: (liedIndex: number, punkt: AblaufZeile) => void;
  /** Ein Schildchen am Punkt („neu“, „geändert“) – Musik-App. */
  schild?: (id: number) => string | null;
  /** Steht als Erstes in der Liste (Musik-App: der Hinweis „Ablauf geändert“) – mit denselben Abständen. */
  kopf?: ReactNode;
  /** Die schmale Form für eine Matrix-Spalte (E6-6a): nur Uhrzeit, Dauer und Titel – ohne Zuständige und Kürzel. */
  schmal?: boolean;
  /** Unter dem letzten Punkt den Balken „Ende“ mit der Uhrzeit (Matrix, 29.10.2026). */
  mitEnde?: boolean;
  /**
   * Die gewählten Dienstgruppen (Knopf „Spalten“, E6-4): am Rechner je eine Spalte rechts wie im ChurchTools-Ablaufplan,
   * am Handy eine Zeile unter dem Punkt. Nicht in der schmalen Form (Matrix: keine Infos, Entwurf Bild 4 A).
   */
  infoSpalten?: readonly InfoGruppe[];
}) {
  const handy = useMedienAbfrage(HANDY_BREITE);
  const infos = schmal ? [] : infoSpalten;
  const alsSpalten = !handy && infos.length > 0;
  const sichtbar = zeilen.filter((z) => !z.removed);
  const ende = mitEnde ? ablaufEnde(sichtbar) : null;
  // Der Balken „Beginn“ vor dem ersten Punkt nach dem Vorlauf (#423) – nur, wenn es Vorlauf gibt.
  const stelle = beginnStelle(sichtbar);
  let liedIndex = -1;

  const zeile = (item: AblaufZeile) => {
    const tagText = schild?.(item.id) ?? null;
    const tag = tagText && <span className={styles.aenderungsTag}>{tagText}</span>;
    const vl =
      (item.vorBeginn ? ` ${styles.vorlauf}` : '') +
      (item.weggelassen ? ` ${styles.weggelassen}` : '');
    if (item.isHeader) {
      return (
        <div key={item.id} className={`${styles.sectionBand}${vl}`}>
          {item.title}
          {tag}
          {item.weggelassen && <WeggelassenHinweis />}
        </div>
      );
    }
    const inhalt = (
      <>
        <ZeitSpalte item={item} />
        <div className={styles.flowBody}>
          <ZeilenInhalt
            item={item}
            tag={tag}
            schmal={schmal}
            infoZeilen={alsSpalten ? [] : infos}
          />
        </div>
        {!schmal && <Kuerzel entries={item.responsible} />}
        {alsSpalten &&
          infos.map((g) => {
            const text = infoText(item, g.id);
            return (
              <div key={g.id} className={`${styles.infoZelle}${text ? '' : ` ${styles.infoLeer}`}`}>
                {text || '–'}
              </div>
            );
          })}
      </>
    );
    if (item.song && onLied) {
      liedIndex += 1;
      const idx = liedIndex;
      return (
        <button
          key={item.id}
          className={`${styles.flowRow} ${styles.flowRowBtn} ${styles.songRow}${vl}`}
          data-tour={idx === 0 ? 'setlist-song' : undefined}
          onClick={() => onLied(idx, item)}
        >
          {inhalt}
        </button>
      );
    }
    return (
      <div
        key={item.id}
        className={`${styles.flowRow}${item.song ? ` ${styles.songRow}` : ''}${vl}`}
      >
        {inhalt}
      </div>
    );
  };

  return (
    <div className={`${styles.flowList}${schmal ? ` ${styles.schmal}` : ''}`}>
      {kopf}
      {alsSpalten && (
        <div className={styles.infoKopf} aria-hidden="true">
          <span className={styles.infoKopfPunkt}>Punkt</span>
          {infos.map((g) => (
            <span key={g.id} className={styles.infoKopfZelle}>
              {g.name}
            </span>
          ))}
        </div>
      )}
      {sichtbar.map((item, i) => (
        <Fragment key={item.id}>
          {i === stelle && <BeginnLinie zeit={beginn} />}
          {zeile(item)}
        </Fragment>
      ))}
      {stelle === sichtbar.length && <BeginnLinie zeit={beginn} />}
      {ende && <EndeLinie zeit={ende} />}
    </div>
  );
}
