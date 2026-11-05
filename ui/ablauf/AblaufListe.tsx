/**
 * **Der Ablauf als Liste – wie die ChurchTools-App** (Bauplan E6-O1, Entwurf `e6-optik-entwurf.html`, abgenommen
 * 23.10.2026; vorher Karten wie in der Musik-App, E6-1b). Eine Liste mit feinen Linien: links Uhrzeit fett, Dauer klein
 * darunter; Titel, darunter die Zuständigen grau, Notiz und die Lied-Karte; rechts die Kreise (Foto oder Kürzel).
 * Überschriften und „Beginn“ als graue Balken, Lieder mit blauem Streifen. Die Musik-App macht Lieder antippbar
 * (→ Charts) und setzt Schildchen „neu/geändert“. Die Regeln einer Zeile stehen in `@shared/ct/ablaufZeile`.
 */
import { Fragment, useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
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
  fotos = false,
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
  /**
   * Fotos in den Kreisen – nur in ChurchTools selbst (Erweiterungen). Die Musik-App auf dem eigenen Server zeigt
   * Kürzel (Alwin, 02.11.2026: „in der eigenen App nur Initialen“; dort blockt ohnehin die Sicherheitsregel fremde Bilder).
   */
  fotos?: boolean;
}) {
  const handy = useMedienAbfrage(HANDY_BREITE);
  const infos = schmal ? [] : infoSpalten;
  const alsSpalten = !handy && infos.length > 0;
  const sichtbar = zeilen.filter((z) => !z.removed);
  const ende = mitEnde ? ablaufEnde(sichtbar) : null;
  // Der Balken „Beginn“ vor dem ersten Punkt nach dem Vorlauf (#423) – nur, wenn es Vorlauf gibt.
  const stelle = beginnStelle(sichtbar);
  const sicht = useSpaltenSicht(alsSpalten ? infos.length : 0);
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
    const punkt = (
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
      </>
    );
    let punktTeil: ReactNode;
    if (item.song && onLied) {
      liedIndex += 1;
      const idx = liedIndex;
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
    const verdeckt = alsSpalten
      ? infos.filter((g) => infoText(item, g.id) && sicht.verdeckt(g.id))
      : [];
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
                  onClick={() => sicht.zeige(g.id)}
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

  const reihen = (
    <>
      {kopf}
      {alsSpalten && (
        <div className={styles.infoKopf}>
          {/* „Eintrag“ wie beim Hinzufügen und im Termin-Blatt (Alwin 05.11.2026), nicht mehr „Punkt“. */}
          <span className={`${styles.infoKopfPunkt} ${styles.punktZelle}`}>Eintrag</span>
          {infos.map((g, i) => {
            const n = sichtbar.filter((z) => infoText(z, g.id)).length;
            return (
              <span key={g.id} ref={sicht.kopfRef(i, g.id)} className={styles.infoKopfZelle}>
                {g.name}
                {n > 0 && <span className={styles.infoKopfZahl}> · {n}</span>}
              </span>
            );
          })}
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
    </>
  );

  if (!alsSpalten) {
    return <div className={`${styles.flowList}${schmal ? ` ${styles.schmal}` : ''}`}>{reihen}</div>;
  }

  /**
   * **Die Spalten als Tabelle** (Alwin, 02.11.2026, Entwurf „Ablauf mit Info-Spalten“ Bild 1+2): ein Raster für alle
   * Zeilen – jede Zeile übernimmt es (`subgrid`), damit die Spalten fluchten. Eine Spalte ist so breit wie ihr Inhalt,
   * höchstens `SPALTE_MAX`; der Punkt behält mindestens `PUNKT_MIN`. Reicht der Platz nicht, scrollt alles rechts vom
   * Punkt waagerecht, der Punkt bleibt stehen. Vorher hatte jede Spalte fest 150 px – bei sechs Spalten brach der Punkt
   * Wort für Wort um, und Zeilen mit schmalerem Punkt verrutschten.
   */
  const mindestBreite =
    PUNKT_MIN +
    infos.reduce(
      (summe, g) => summe + (sichtbar.some((z) => infoText(z, g.id)) ? SPALTE_MIN : LEER_MIN),
      0,
    );
  return (
    <div className={styles.tabelleRahmen}>
      <div className={styles.tabelleScroll} ref={sicht.rahmenRef} onScroll={sicht.messen}>
        <div
          className={`${styles.flowList} ${styles.tabelle}`}
          style={{
            gridTemplateColumns: `minmax(${PUNKT_MIN}px, 1fr) repeat(${infos.length}, fit-content(${SPALTE_MAX}px))`,
            minWidth: mindestBreite,
          }}
        >
          {reihen}
        </div>
      </div>
      {sicht.rechtsMehr && (
        <span className={styles.weiterRechts} aria-hidden="true">
          ›
        </span>
      )}
    </div>
  );
}

/**
 * Der Punkt behält mindestens so viel Breite (px) – Zeit, Titel, Namen, Kreise und Lied bleiben lesbar. Mit 300 px
 * brachen am iPad hochkant die Namen einzeln um und die Lied-Karte wurde abgeschnitten (Durchklick 02.11.2026).
 */
const PUNKT_MIN = 380;
/** Breiter wird eine Info-Spalte nicht; längerer Text bricht um. */
const SPALTE_MAX = 280;
/** So viel Platz plant die Tabelle für eine Spalte mit Text ein, bevor sie waagerecht scrollt … */
const SPALTE_MIN = 160;
/** … und so viel für eine leere (nur ihr Name im Kopf). */
const LEER_MIN = 90;

/**
 * Was beim waagerechten Scrollen zu sehen ist: Spalten, die rechts (oder links unter dem stehenden Punkt) verdeckt sind,
 * und ob rechts noch etwas kommt. Gemessen an den Spaltenköpfen; ohne Maße (Tests, erster Lauf) gilt alles als sichtbar.
 */
function useSpaltenSicht(anzahl: number) {
  const rahmen = useRef<HTMLDivElement | null>(null);
  const koepfe = useRef(new Map<number, HTMLElement>());
  const [stand, setStand] = useState<{ verdeckt: ReadonlySet<number>; rechtsMehr: boolean }>({
    verdeckt: new Set(),
    rechtsMehr: false,
  });

  const messen = useCallback(() => {
    const r = rahmen.current;
    if (!r) return;
    const punktBreite = r.querySelector<HTMLElement>(`.${styles.infoKopfPunkt}`)?.offsetWidth ?? 0;
    const links = r.scrollLeft + punktBreite;
    const rechts = r.scrollLeft + r.clientWidth;
    const verdeckt = new Set<number>();
    for (const [id, el] of koepfe.current) {
      if (el.offsetLeft + el.offsetWidth > rechts + 1 || el.offsetLeft < links - 1)
        verdeckt.add(id);
    }
    const rechtsMehr = r.scrollWidth - r.clientWidth - r.scrollLeft > 1;
    setStand((alt) =>
      alt.rechtsMehr === rechtsMehr &&
      alt.verdeckt.size === verdeckt.size &&
      [...verdeckt].every((id) => alt.verdeckt.has(id))
        ? alt
        : { verdeckt, rechtsMehr },
    );
  }, []);

  useEffect(() => {
    if (anzahl === 0) return;
    messen();
    window.addEventListener('resize', messen);
    return () => {
      window.removeEventListener('resize', messen);
    };
  }, [anzahl, messen]);

  return {
    rahmenRef: rahmen,
    messen,
    rechtsMehr: stand.rechtsMehr,
    verdeckt: (id: number) => stand.verdeckt.has(id),
    kopfRef: (_i: number, id: number) => (el: HTMLElement | null) => {
      if (el) koepfe.current.set(id, el);
      else koepfe.current.delete(id);
    },
    /** Die Spalte ins Bild holen – rechts neben den stehenden Punkt. */
    zeige: (id: number) => {
      const r = rahmen.current;
      const el = koepfe.current.get(id);
      if (!r || !el) return;
      const punktBreite =
        r.querySelector<HTMLElement>(`.${styles.infoKopfPunkt}`)?.offsetWidth ?? 0;
      r.scrollTo?.({ left: Math.max(0, el.offsetLeft - punktBreite), behavior: 'smooth' });
    },
  };
}
