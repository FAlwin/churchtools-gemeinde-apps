import { useEffect, useRef, useState, type ReactNode } from 'react';
import { uhrText } from '@shared/ct/zeit';
import { ERLAUBNIS_SENDER, senderLink, VDO_HERKUNFT } from '@shared/gebetsabend/links';
import {
  KEINE_VERBINDUNGEN,
  verbindungenNach,
  WER_HOERT_TEXT,
  zuhoererListe,
  type Verbindungen,
} from '@shared/gebetsabend/werHoert';
import { istVdoMeldung, meldungAus } from '@shared/gebetsabend/zustand';
import type { Zugang } from '@shared/gebetsabend/zugang';
import karte from './Zuhoeren.module.scss';
import styles from './Technik.module.scss';

/**
 * **Der Sender auf diesem Gerät und „Wer hört zu?“** (Bauplan Gebetsabend G3/G4): das VDO.Ninja-iframe und darunter
 * die Liste aus seinen Meldungen (`@shared/gebetsabend/werHoert`). Meldungen zählen nur aus DIESEM iframe und von
 * `https://vdo.ninja` (`istVdoMeldung`) – sonst könnte eine fremde Seite Zuhörer vortäuschen.
 *
 * Die Technik setzt einen `key` je Zugang und „Sender neu starten“: Ein neuer Sender beginnt mit leerer Liste, die
 * Zuhörer melden sich bei ihm von selbst neu an.
 */
export function Sender({ zugang, mitte }: { zugang: Zugang; mitte?: ReactNode }) {
  const fenster = useRef<HTMLIFrameElement>(null);
  const [verbindungen, setVerbindungen] = useState<Verbindungen>(KEINE_VERBINDUNGEN);

  useEffect(() => {
    const hoeren = (e: MessageEvent) => {
      if (!istVdoMeldung(e, fenster.current?.contentWindow, VDO_HERKUNFT)) return;
      const m = meldungAus(e.data);
      if (m) setVerbindungen((v) => verbindungenNach(v, m, new Date().toISOString()));
    };
    window.addEventListener('message', hoeren);
    return () => window.removeEventListener('message', hoeren);
  }, []);

  const { liste, zahl } = zuhoererListe(verbindungen);
  return (
    <>
      <iframe
        ref={fenster}
        className={zugang.mitBild ? karte.player : `${karte.player} ${styles.senderTon}`}
        title="Sender des Gebetsabends"
        src={senderLink(zugang)}
        allow={ERLAUBNIS_SENDER}
      />
      {mitte}
      <h3 className={styles.werKopf}>
        Wer hört zu? <span className={styles.anzahl}>{zahl}</span>
      </h3>
      {liste.length > 0 ? (
        <ul className={styles.liste} aria-label="Wer hört zu?">
          {liste.map((z) => (
            <li key={z.name ?? ''}>
              <span className={z.name ? styles.name : `${styles.name} ${styles.ohneName}`}>
                {z.name ?? WER_HOERT_TEXT.ohneName}
              </span>
              {z.geraete > 1 && (
                <span className={styles.geraete}>
                  {z.name ? `${z.geraete} Geräte` : `${z.geraete} Verbindungen`}
                </span>
              )}
              <span className={styles.seit}>seit {uhrText(z.seit)} Uhr</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className={karte.leise}>{WER_HOERT_TEXT.niemand}</p>
      )}
      <p className={karte.leise}>{WER_HOERT_TEXT.hinweis}</p>
    </>
  );
}
