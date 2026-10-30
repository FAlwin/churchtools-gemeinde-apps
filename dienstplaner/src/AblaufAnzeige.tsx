import { Fragment, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { BodyPortal } from '@ui/fenster/BodyPortal';
import { Icon } from '@ui/icons/icons';
import { KopfKnopf } from '@ui/bedienung/KopfKnopf';
import { useVollbild } from '@ui/bedienung/useVollbild';
import { useWakeLock } from '@ui/bedienung/useWakeLock';
import { beginnStelle, itemTitleParts, type AblaufZeile } from '@shared/ct/ablaufZeile';
import { tagKurz, tagLang } from '@shared/ct/datum';
import { ortszeitAus } from '@shared/ct/zeit';
import type { InfoGruppe } from '@shared/types/index';
import styles from './AblaufAnzeige.module.scss';

/** Größte und kleinste Schrift der Liste (px) – darunter wird gescrollt statt unleserlich (Bauplan E6b). */
const GROSS = 26;
const KLEIN = 13;

/** Tag und Uhrzeit jetzt, in der Zeitzone der Gemeinde. */
function jetztIn(zeitzone: string): { tag: string; uhr: string } {
  const lokal = ortszeitAus(new Date().toISOString(), zeitzone);
  return { tag: lokal.slice(0, 10), uhr: lokal.slice(11, 16) };
}

/** Die laufende Uhr – alle 10 Sekunden nachgesehen, damit die Minute rechtzeitig umspringt. */
function useJetzt(zeitzone: string): { tag: string; uhr: string } {
  const [jetzt, setJetzt] = useState(() => jetztIn(zeitzone));
  useEffect(() => {
    const id = window.setInterval(() => setJetzt(jetztIn(zeitzone)), 10_000);
    return () => window.clearInterval(id);
  }, [zeitzone]);
  return jetzt;
}

/**
 * **„Ablauf zeigen“** (Bauplan E6b-1, Entwurf `e6b-anzeige.html`, Alwin 30.10.2026): der Ablauf ruhig im Vollbild – „wie
 * ein Hintergrundbild am Handy“. Oben links die Uhr (Gemeinde-Zeit) mit dem heutigen Tag, rechts Titel, Beginn und Ende;
 * darunter alle Punkte mit Zeit, Dauer, Titel, Zuständigen und den Infos der unter „Spalten“ gewählten Gruppen.
 * **Nichts hervorgehoben, nichts verstellbar.** Die Schrift passt sich an, damit alles auf einen Blick passt (einspaltig,
 * höchstens 1100 px); reicht es selbst klein nicht, wird gescrollt. Farben folgen dem Thema von ChurchTools (hell oder
 * dunkel). Nur „Vollbild“ (wo der Browser es kann) und „Schließen“; der Bildschirm bleibt an.
 */
export function AblaufAnzeige({
  titel,
  tag,
  beginn,
  ende,
  zeilen,
  infoGruppen,
  zeitzone,
  onSchliessen,
}: {
  titel: string;
  /** Tag des Termins (`JJJJ-MM-TT`, Gemeinde-Zeit). */
  tag: string;
  /** „10:00“. */
  beginn: string;
  /** „11:30“ – fehlt, wenn ChurchTools kein Ende nennt. */
  ende: string | null;
  zeilen: readonly AblaufZeile[];
  /** Die unter „Spalten“ gewählten Gruppen – ihre Infos stehen unter dem Punkt. */
  infoGruppen: readonly InfoGruppe[];
  zeitzone: string;
  onSchliessen: () => void;
}) {
  const wurzel = useRef<HTMLDivElement>(null);
  const liste = useRef<HTMLDivElement>(null);
  const vollbild = useVollbild(wurzel);
  const { umschalten: vollbildUmschalten } = vollbild;
  const jetzt = useJetzt(zeitzone);
  const [schrift, setSchrift] = useState(GROSS);
  const [scrollt, setScrollt] = useState(false);
  useWakeLock(true);
  const wach = typeof navigator !== 'undefined' && 'wakeLock' in navigator;

  // Weggelassene Punkte finden an diesem Termin nicht statt; Platzhalter gehören nur in die Bearbeiten-Liste.
  const punkte = zeilen.filter((z) => !z.removed && !z.weggelassen);
  const stelle = beginnStelle(punkte);

  function schliessen(): void {
    vollbild.beenden();
    onSchliessen();
  }

  useEffect(() => {
    wurzel.current?.focus();
    const taste = (ev: KeyboardEvent) => {
      if (ev.altKey || ev.ctrlKey || ev.metaKey) return;
      if (ev.key === 'f' || ev.key === 'F') vollbildUmschalten();
      else if (ev.key === 'Escape') {
        // Im Vollbild beendet der Browser selbst das Vollbild – nicht zusätzlich schließen.
        if (document.fullscreenElement) return;
        onSchliessen();
      } else return;
      ev.preventDefault();
    };
    window.addEventListener('keydown', taste);
    return () => window.removeEventListener('keydown', taste);
  }, [vollbildUmschalten, onSchliessen]);

  // Schrift einpassen: von groß nach klein, bis die Liste ohne Scrollen passt – sonst bei KLEIN scrollen.
  useLayoutEffect(() => {
    const einpassen = () => {
      const el = liste.current;
      if (!el) return;
      let groesse = GROSS;
      el.style.fontSize = `${groesse}px`;
      while (groesse > KLEIN && el.scrollHeight > el.clientHeight + 1) {
        groesse -= 1;
        el.style.fontSize = `${groesse}px`;
      }
      setSchrift(groesse);
      setScrollt(el.scrollHeight > el.clientHeight + 1);
    };
    einpassen();
    // Neu einpassen, wenn sich die Fläche der Liste ändert (Fenster, Vollbild, Handy gedreht) – gemessen an der Liste
    // selbst, nicht am Fenster: Beim Drehen stellt sich der Kopf erst danach um (gestapelt ↔ nebeneinander).
    if (typeof ResizeObserver === 'undefined' || !liste.current) return;
    let breite = liste.current.clientWidth;
    let hoehe = liste.current.clientHeight;
    const beobachter = new ResizeObserver(() => {
      const el = liste.current;
      if (!el || (el.clientWidth === breite && el.clientHeight === hoehe)) return;
      breite = el.clientWidth;
      hoehe = el.clientHeight;
      einpassen();
    });
    beobachter.observe(liste.current);
    return () => beobachter.disconnect();
  }, [zeilen, infoGruppen]);

  const kopfZeile = [
    tag !== jetzt.tag ? tagKurz(tag) : null,
    `Beginn ${beginn}`,
    ende ? `Ende ca. ${ende}` : null,
  ]
    .filter(Boolean)
    .join(' · ');

  const punkt = (z: AblaufZeile) => {
    if (z.isHeader) {
      return (
        <div key={z.id} className={styles.band}>
          {z.title}
        </div>
      );
    }
    const { title, songName } = itemTitleParts(z);
    const wer = z.responsible.map((r) => r.label).join(', ');
    return (
      <div key={z.id} className={`${styles.punkt}${z.vorBeginn ? ` ${styles.vor}` : ''}`}>
        <div className={styles.zeit}>
          {z.time ?? ''}
          {z.durationMin ? <small>{z.durationMin} Min</small> : null}
        </div>
        <div>
          <b>{title}</b>
          {songName && <span className={styles.lied}> – {songName}</span>}
          {wer && <span className={styles.wer}>{wer}</span>}
          {infoGruppen.map((g) => {
            const text = z.infos?.find((i) => i.gruppeId === g.id)?.text;
            return text ? (
              <span key={g.id} className={styles.info}>
                <i>{g.name}:</i> {text}
              </span>
            ) : null;
          })}
        </div>
      </div>
    );
  };

  return (
    <BodyPortal>
      <div
        ref={wurzel}
        className={styles.anzeige}
        role="dialog"
        aria-modal="true"
        aria-label={`Ablauf: ${titel}`}
        tabIndex={-1}
      >
        <div className={styles.oben}>
          <div>
            <div className={styles.uhr}>{jetzt.uhr}</div>
            <div className={styles.datum}>{tagLang(jetzt.tag)}</div>
          </div>
          <div className={styles.titel}>
            <b>{titel}</b>
            <span>{kopfZeile}</span>
          </div>
        </div>

        <div
          ref={liste}
          className={`${styles.liste}${scrollt ? ` ${styles.scrollt}` : ''}`}
          style={{ fontSize: `${schrift}px` }}
          data-schrift={schrift}
        >
          {punkte.map((z, i) => (
            <Fragment key={z.id}>
              {i === stelle && <div className={styles.beginn}>Beginn {beginn}</div>}
              {punkt(z)}
            </Fragment>
          ))}
          {stelle === punkte.length && <div className={styles.beginn}>Beginn {beginn}</div>}
        </div>

        <div className={styles.unten}>
          <span className={wach ? styles.wach : undefined}>
            {wach ? 'Bildschirm bleibt an' : ''}
          </span>
          <span className={styles.knoepfe}>
            {vollbild.kann && (
              <KopfKnopf
                onClick={vollbildUmschalten}
                label={vollbild.an ? 'Vollbild beenden' : 'Vollbild'}
                symbol={<Icon name={vollbild.an ? 'vollbild-aus' : 'vollbild'} size={16} />}
              />
            )}
            <KopfKnopf
              onClick={schliessen}
              label="Schließen"
              symbol={<Icon name="x" size={16} />}
            />
          </span>
        </div>
      </div>
    </BodyPortal>
  );
}
