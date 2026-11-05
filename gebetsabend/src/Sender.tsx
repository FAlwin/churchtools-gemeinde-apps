import { useEffect, useRef } from 'react';
import { ERLAUBNIS_SENDER, senderLink, VDO_HERKUNFT } from '@shared/gebetsabend/links';
import { istVdoMeldung, meldungAus, type Meldung } from '@shared/gebetsabend/zustand';
import type { Zugang } from '@shared/gebetsabend/zugang';
import karte from './Zuhoeren.module.scss';
import styles from './Technik.module.scss';

/**
 * **Der Sender auf diesem Gerät** (Bauplan Gebetsabend G3/G4): das VDO.Ninja-iframe. Seine Meldungen gehen an
 * `onMeldung` – daraus wird „Wer hört zu?“ (`WerHoertZu.tsx`), das seit Entwurf v4 als eigene Karte neben dem Bild
 * steht. Meldungen zählen nur aus DIESEM iframe und von `https://vdo.ninja` (`istVdoMeldung`) – sonst könnte eine
 * fremde Seite Zuhörer vortäuschen.
 */
export function Sender({ zugang, onMeldung }: { zugang: Zugang; onMeldung: (m: Meldung) => void }) {
  const fenster = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    const hoeren = (e: MessageEvent) => {
      if (!istVdoMeldung(e, fenster.current?.contentWindow, VDO_HERKUNFT)) return;
      const m = meldungAus(e.data);
      if (m) onMeldung(m);
    };
    window.addEventListener('message', hoeren);
    return () => window.removeEventListener('message', hoeren);
  }, [onMeldung]);

  return (
    <iframe
      ref={fenster}
      className={zugang.mitBild ? karte.player : `${karte.player} ${styles.senderTon}`}
      title="Sender des Gebetsabends"
      src={senderLink(zugang)}
      allow={ERLAUBNIS_SENDER}
    />
  );
}
