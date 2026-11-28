/**
 * **Der Ablauf als Liste – wie die ChurchTools-App** (Bauplan E6-O1, Entwurf `e6-optik-entwurf.html`, abgenommen
 * 23.10.2026; vorher Karten wie in der Musik-App, E6-1b). Eine Liste mit feinen Linien: links Uhrzeit fett, Dauer klein
 * darunter; Titel, darunter die Zuständigen grau, Notiz und die Lied-Karte; rechts die Kreise (Foto oder Kürzel).
 * Überschriften und „Beginn“ als graue Balken, Lieder mit blauem Streifen. Die Musik-App macht Lieder antippbar
 * (→ Charts) und setzt Schildchen „neu/geändert“. Die Regeln einer Zeile stehen in `@shared/ct/ablaufZeile`.
 */
import { Fragment, type ReactNode } from 'react';
import { beginnStelle, itemLabel, itemTitleParts, type AblaufZeile } from '@shared/ct/ablaufZeile';
import type { InfoGruppe } from '@shared/types/index';
import { Etikett } from '../bedienung/Etikett';
import { HANDY_BREITE, useMedienAbfrage } from '../bedienung/useMedienAbfrage';
import {
  BeginnLinie,
  AblaufEndeLinie,
  ItemTitle,
  Kuerzel,
  LiedKarte,
  ResponsibleLine,
  WeggelassenHinweis,
  ZeitText,
} from './AblaufTeile';
import { InfoTabelle } from './InfoTabelle';
import { infoText, type SpaltenSicht } from './infoTabellenRegeln';
import { liedKarteLeer } from './liedMeta';
import styles from './AblaufListe.module.scss';

/**
 * Uhrzeit fett, Dauer klein darunter (Variante 1) – eine Stelle für Ansicht und Bearbeiten-Liste. `schnitt` („Ø 8:10“,
 * Dienstplaner L4-4, A8): noch leiser darunter – nur beim Bearbeiten, wo man realistisch plant.
 */
export function ZeitSpalte({
  item,
  schnitt = null,
}: {
  item: Pick<AblaufZeile, 'time' | 'weggelassen' | 'durationMin'>;
  schnitt?: string | null;
}) {
  return (
    <div className={styles.flowTime}>
      <span>
        <ZeitText item={item} />
      </span>
      {item.durationMin ? <span className={styles.zeitDauer}>{item.durationMin} Min</span> : null}
      {schnitt ? (
        <span className={styles.zeitSchnitt} title="Durchschnitt aus den bisherigen Terminen">
          {schnitt}
        </span>
      ) : null}
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
  vorlage = false,
  onLiedKarte,
  liedKarteTour,
}: {
  item: AblaufZeile;
  tag?: ReactNode;
  /**
   * Die Lied-Karte ist ein eigener Knopf (B8, E20): Tipp auf die Karte öffnet das Liedblatt, der Rest der Zeile die
   * Einzelansicht des Punkts. Ohne: die Karte ist nur Anzeige (Bearbeiten-Liste, Matrix).
   */
  onLiedKarte?: () => void;
  /** Ziel der Einführung an der Lied-Karte (`setlist-song`: „Tippe die Lied-Karte …“) – nicht an der ganzen Zeile. */
  liedKarteTour?: string;
  schmal?: boolean;
  /** Eine Zeile in einer Ablaufvorlage (E10-V3a): Platzhalter neutral statt rot – `ResponsibleLine`. */
  vorlage?: boolean;
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
  // Ist die Karte der Knopf zum Liedblatt (B8, E20) und stünde sie leer da (Titel = Liedname, keine Angaben), nimmt sie den
  // Titel selbst auf – sonst gäbe es für dieses Lied keinen Weg zum Liedblatt mehr.
  const karteAlsTitel = !!onLiedKarte && !!item.song && liedKarteLeer(item.song, liedImTitel);
  return (
    <>
      <div className={styles.flowHead}>
        {!karteAlsTitel && <ItemTitle item={item} ohneLiedname={!!item.song} />}
        {tag}
        {item.weggelassen && <WeggelassenHinweis />}
      </div>
      <ResponsibleLine
        entries={item.responsible}
        vorlage={vorlage ? { text: item.responsibleText } : undefined}
      />
      {item.note && <div className={styles.flowNote}>{item.note}</div>}
      {infoZeilen.map((g) => {
        const text = infoText(item, g.id);
        return text ? (
          <div key={g.id} className={styles.infoZeile}>
            <b>{g.name}:</b> {text}
          </div>
        ) : null;
      })}
      {item.song &&
        (onLiedKarte ? (
          <button
            type="button"
            className={styles.liedKnopf}
            data-tour={liedKarteTour}
            onClick={onLiedKarte}
          >
            <LiedKarte song={item.song} ohneTitel={liedImTitel && !karteAlsTitel} />
          </button>
        ) : (
          <LiedKarte song={item.song} ohneTitel={liedImTitel} />
        ))}
    </>
  );
}

export function AblaufListe({
  zeilen,
  beginn,
  onLied,
  onPunkt,
  schild,
  kopf,
  schmal = false,
  mitEnde = false,
  infoSpalten = [],
  fotos = false,
  vorlage = false,
}: {
  zeilen: readonly AblaufZeile[];
  /** Uhrzeit des Veranstaltungsbeginns („10:00“) für den Balken nach dem Vorlauf (#423). */
  beginn?: string;
  /**
   * Lied-Zeilen antippbar machen – mit der Nummer des Lieds im Ablauf (Musik-App: zu den Charts) und dem Punkt selbst
   * (Dienstplaner: Lied-Ansicht, E6-O O4).
   */
  onLied?: (liedIndex: number, punkt: AblaufZeile) => void;
  /**
   * Den Punkt antippbar machen – öffnet die **Einzelansicht** (`PunktAnsicht`, B8/E20). Mit `onLied` teilen sich die
   * Zeile: Tipp auf die **Lied-Karte** → `onLied`, Tipp auf den Punkt (alles andere außer den Kreisen) → `onPunkt`.
   * Ohne `onPunkt` bleibt es, wie es war: bei Liedern ist der ganze Punkt der Knopf zu `onLied`. Nicht in der schmalen Form.
   */
  onPunkt?: (punkt: AblaufZeile) => void;
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
  /**
   * Fotos in den Kreisen – nur in ChurchTools selbst (Erweiterungen). Die Musik-App auf dem eigenen Server zeigt
   * Kürzel (Alwin, 02.11.2026: „in der eigenen App nur Initialen“; dort blockt ohnehin die Sicherheitsregel fremde Bilder).
   */
  fotos?: boolean;
  /**
   * Der Ablauf einer **Ablaufvorlage** (E10-V3a): Platzhalter neutral; Infos je Gruppe wie am Termin. Uhrzeiten gibt es
   * von selbst keine – `ablaufZeileAus` mit Termin 0 liefert `time: null` und nichts „weggelassen“; der Balken „Beginn“
   * bleibt ohne `beginn` ohne Zeit.
   */
  vorlage?: boolean;
}) {
  const handy = useMedienAbfrage(HANDY_BREITE);
  const infos = schmal ? [] : infoSpalten;
  const alsSpalten = !handy && infos.length > 0;
  const sichtbar = zeilen.filter((z) => !z.removed);
  // Der Balken „Beginn“ vor dem ersten Punkt nach dem Vorlauf (#423) – nur, wenn es Vorlauf gibt.
  const stelle = beginnStelle(sichtbar);
  let liedIndex = -1;

  const zeile = (item: AblaufZeile, sicht?: SpaltenSicht) => {
    const tagText = schild?.(item.id) ?? null;
    const tag = tagText && <Etikett ton="blau">{tagText}</Etikett>;
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
    const punkt = (
      <>
        <ZeitSpalte item={item} />
        <div className={styles.flowBody}>
          <ZeilenInhalt
            item={item}
            tag={tag}
            schmal={schmal}
            infoZeilen={alsSpalten ? [] : infos}
            vorlage={vorlage}
          />
        </div>
      </>
    );
    let punktTeil: ReactNode;
    const tippbar = !!onPunkt && !schmal;
    if (item.song && onLied) liedIndex += 1;
    const idx = liedIndex;
    if (tippbar) {
      // Zwei Ziele (E20): die Lied-Karte → Liedblatt, der Rest des Punkts → Einzelansicht. Der Punkt ist ein Knopf, der
      // HINTER dem Inhalt liegt (`punktTipp`) – so steckt der Knopf der Karte nicht in einem Knopf.
      const karte = item.song && onLied ? () => onLied(idx, item) : undefined;
      punktTeil = (
        <div className={`${styles.punktInhalt} ${styles.punktTipp}`}>
          <button
            type="button"
            className={styles.punktFlaeche}
            aria-label={`„${itemLabel(item)}“ ansehen`}
            onClick={() => onPunkt(item)}
          />
          <ZeitSpalte item={item} />
          <div className={styles.flowBody}>
            <ZeilenInhalt
              item={item}
              tag={tag}
              infoZeilen={alsSpalten ? [] : infos}
              vorlage={vorlage}
              onLiedKarte={karte}
              liedKarteTour={karte && idx === 0 ? 'setlist-song' : undefined}
            />
          </div>
        </div>
      );
    } else if (item.song && onLied) {
      // Nur der Punkt ist der Knopf zu den Charts – die Kreise daneben sind ein eigener Knopf (kein Knopf im Knopf).
      punktTeil = (
        <button
          type="button"
          className={styles.punktKnopf}
          data-tour={idx === 0 ? 'setlist-song' : undefined}
          onClick={() => onLied(idx, item)}
        >
          {punkt}
        </button>
      );
    } else {
      punktTeil = <div className={styles.punktInhalt}>{punkt}</div>;
    }
    // In einer Spalte, die gerade nicht zu sehen ist, steht etwas zu diesem Punkt → ein Schildchen, das dorthin scrollt.
    const verdeckt =
      alsSpalten && sicht ? infos.filter((g) => infoText(item, g.id) && sicht.verdeckt(g.id)) : [];
    return (
      <div
        key={item.id}
        className={`${styles.flowRow}${item.song ? ` ${styles.songRow}` : ''}${vl}`}
      >
        <div className={styles.punktZelle}>
          {punktTeil}
          {!schmal && (
            <Kuerzel entries={item.responsible} fotos={fotos} titel={item.title} aufklappbar />
          )}
          {verdeckt.length > 0 && (
            <div className={styles.verdeckt}>
              {verdeckt.map((g) => (
                <button
                  key={g.id}
                  type="button"
                  className={styles.verdecktKnopf}
                  onClick={() => sicht?.zeige(g.id)}
                >
                  {g.name} ›
                </button>
              ))}
            </div>
          )}
        </div>
        {alsSpalten &&
          infos.map((g) => {
            const text = infoText(item, g.id);
            return (
              <div key={g.id} className={`${styles.infoZelle}${text ? '' : ` ${styles.infoLeer}`}`}>
                {text || '–'}
              </div>
            );
          })}
      </div>
    );
  };

  const reihen = (sicht?: SpaltenSicht) => (
    <>
      {sichtbar.map((item, i) => (
        <Fragment key={item.id}>
          {i === stelle && <BeginnLinie zeit={beginn} />}
          {zeile(item, sicht)}
        </Fragment>
      ))}
      {stelle === sichtbar.length && <BeginnLinie zeit={beginn} />}
      {mitEnde && <AblaufEndeLinie zeilen={sichtbar} beginn={beginn} />}
    </>
  );

  if (!alsSpalten) {
    return (
      <div className={`${styles.flowList}${schmal ? ` ${styles.schmal}` : ''}`}>
        {kopf}
        {reihen()}
      </div>
    );
  }

  // Die Spalten als Tabelle – Raster, Kopfzeile und Scrollen in `InfoTabelle` (auch die Bearbeiten-Liste nutzt sie).
  return (
    <InfoTabelle infos={infos} zeilen={sichtbar} vorKopf={kopf}>
      {(sicht) => reihen(sicht)}
    </InfoTabelle>
  );
}
