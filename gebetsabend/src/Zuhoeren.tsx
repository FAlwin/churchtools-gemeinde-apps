import { useCallback, useEffect, useRef, useState } from 'react';
import { FehlerKasten } from '@ui/erweiterung/ErweiterungsSeite';
import { fehlerMeldung, type Fehlermeldung } from '@ui/ct/fehlerMeldung';
import { Icon } from '@ui/icons/icons';
import { KopfKnopf } from '@ui/bedienung/KopfKnopf';
import { uhrText } from '@shared/ct/zeit';
import { ERLAUBNIS_ZUHOERER, VDO_HERKUNFT, zuhoererLink } from '@shared/gebetsabend/links';
import {
  istVdoMeldung,
  meldungAus,
  naechsterZustand,
  PEGEL_AN,
  type PlayerZustand,
} from '@shared/gebetsabend/zustand';
import {
  nachNachfrage,
  HINWEIS_TIPPEN,
  NACHFRAGEN_MS,
  PLAYER_GUT,
  PLAYER_TEXT,
  vorStart,
} from '@shared/gebetsabend/zuhoeren';
import type { Zugang } from '@shared/gebetsabend/zugang';
import { TECHNIK_TEXT } from '@shared/gebetsabend/technik';
import { ladeZugang } from './lesen';
import { ZustandZeile } from './ZustandZeile';
import styles from './Zuhoeren.module.scss';

interface Props {
  modul: number;
  /** ID der Kategorie „Zugang“. */
  kategorie: number;
  /** Vor- und Nachname – kommt beim Sender als Name an („Wer hört zu?“, G4). */
  name: string;
  /**
   * Sendet DIESES Gerät gerade (Technik, G3)? Dann kein Zuhören hier – der Ton liefe wieder ins Mikrofon. Ein offener
   * Player schließt sich.
   */
  sendetHier?: boolean;
  /** Zählt hoch, wenn die Technik auf diesem Gerät gespeichert hat – dann sofort nachfragen statt nach bis zu 20 s. */
  aktualisiert?: number;
}

type Laden = { art: 'laedt' } | { art: 'fehler'; fehler: Fehlermeldung } | { art: 'da' };

/**
 * **Zuhören** (Bauplan Gebetsabend G2, Entwurf v2): ein großer Knopf, danach der Player ohne VDO.Ninja-Bedienung
 * (bis auf den Wiedergabe-Knopf, falls der Browser das Abspielen sperrt – `links.ts`).
 *
 * - Vor dem Zuhören zählt der Merker „läuft seit“; ohne ihn steht „Noch keine Übertragung“ da, und die Seite fragt
 *   alle 20 s nach – kein Neuladen nötig.
 * - Beim Zuhören zählt der Player (VDO.Ninja-Meldungen, nur aus dem eigenen iframe von vdo.ninja). Startet die Technik
 *   neu, lädt der Player die neuen Daten; beendet sie, schließt er sich.
 * - **Vorübergehend ist nicht beendet:** Scheitert eine Nachfrage, bleibt alles, wie es ist.
 * - **Vollbild und Bild-in-Bild** kommen aus der Steuerleiste des Geräts im Bild (`&videocontrols`, `links.ts`) – am
 *   iPhone Apples eigener Player, auch in der ChurchTools-PWA. Eine eigene Großansicht (bis 05.11.2026) entfällt.
 * - Das iframe entsteht erst beim Tippen. Am iPhone reicht das nicht immer: Safari sperrt das Abspielen im fremden
 *   iframe, bis man dort selbst tippt (05.11.2026) – daher der Hinweis unter dem Bild.
 */
export function Zuhoeren({ modul, kategorie, name, sendetHier = false, aktualisiert = 0 }: Props) {
  const [laden, setLaden] = useState<Laden>({ art: 'laedt' });
  const [zugang, setZugang] = useState<Zugang | null>(null);
  /** Womit der Player geladen ist – `null` = er ist zu. */
  const [gehoert, setGehoert] = useState<Zugang | null>(null);
  const [player, setPlayer] = useState<PlayerZustand>('verbindet');
  const [beendet, setBeendet] = useState(false);
  const fenster = useRef<HTMLIFrameElement>(null);
  const gehoertRef = useRef<Zugang | null>(null);
  useEffect(() => {
    gehoertRef.current = gehoert;
  }, [gehoert]);

  const nachfragen = useCallback(
    (erstesMal: boolean) => {
      ladeZugang(modul, kategorie).then(
        (z) => {
          setZugang(z);
          setLaden({ art: 'da' });
          const offen = gehoertRef.current;
          if (!offen) return;
          const was = nachNachfrage(offen, z);
          if (was === 'neu' && z) {
            setGehoert(z);
            setPlayer('verbindet');
          } else if (was === 'beendet') {
            setGehoert(null);
            setBeendet(true);
          }
        },
        (e: unknown) => {
          // Nur das erste Laden zeigt den Fehler; später bleibt der letzte Stand (vorübergehend ≠ beendet).
          if (erstesMal) setLaden({ art: 'fehler', fehler: fehlerMeldung(e) });
        },
      );
    },
    [modul, kategorie],
  );

  useEffect(() => {
    nachfragen(true);
    const t = window.setInterval(() => nachfragen(false), NACHFRAGEN_MS);
    return () => window.clearInterval(t);
  }, [nachfragen]);

  useEffect(() => {
    if (aktualisiert > 0) nachfragen(false);
  }, [aktualisiert, nachfragen]);

  useEffect(() => {
    if (sendetHier) setGehoert(null);
  }, [sendetHier]);

  useEffect(() => {
    const hoeren = (e: MessageEvent) => {
      if (!istVdoMeldung(e, fenster.current?.contentWindow, VDO_HERKUNFT)) return;
      const m = meldungAus(e.data);
      if (m) setPlayer((z) => naechsterZustand(z, m));
    };
    window.addEventListener('message', hoeren);
    return () => window.removeEventListener('message', hoeren);
  }, []);

  const aufhoeren = () => setGehoert(null);

  const zuhoeren = () => {
    if (!zugang) return;
    setBeendet(false);
    setPlayer('verbindet');
    setGehoert(zugang);
  };

  if (laden.art === 'laedt') return <p className={styles.leise}>Wird geladen …</p>;
  if (laden.art === 'fehler')
    return <FehlerKasten fehler={laden.fehler} onNochmal={() => nachfragen(true)} />;

  const vor = vorStart(zugang);
  if (sendetHier)
    return (
      <section className={styles.karte} aria-label="Zuhören">
        <ZustandZeile gut={vor.art === 'laeuft'}>
          {vor.art === 'laeuft' ? `Läuft seit ${uhrText(vor.seit)} Uhr` : 'Noch keine Übertragung'}
        </ZustandZeile>
        <p className={styles.text}>{TECHNIK_TEXT.nichtHierZuhoeren}</p>
      </section>
    );
  return (
    <section className={styles.karte} aria-label="Zuhören">
      {gehoert ? (
        <>
          <ZustandZeile gut={PLAYER_GUT[player]}>
            {gehoert.laeuftSeit ? `Läuft seit ${uhrText(gehoert.laeuftSeit)} Uhr` : 'Läuft'}
          </ZustandZeile>
          <iframe
            key={`${gehoert.streamId}-${gehoert.mitBild ? 'bild' : 'ton'}`}
            ref={fenster}
            className={gehoert.mitBild ? styles.player : `${styles.player} ${styles.nurTon}`}
            title="Übertragung des Gebetsabends"
            src={zuhoererLink(gehoert, name)}
            allow={ERLAUBNIS_ZUHOERER}
            allowFullScreen
            onLoad={() => fenster.current?.contentWindow?.postMessage(PEGEL_AN, VDO_HERKUNFT)}
          />
          <p className={styles.leise}>{PLAYER_TEXT[player]}</p>
          <p className={styles.text}>{HINWEIS_TIPPEN}</p>
          <p className={styles.leise}>Der Ton läuft auch weiter, wenn du das Handy sperrst.</p>
          <p className={styles.leise}>Die Technik sieht, dass du zuhörst.</p>
          <div className={styles.rechts}>
            <KopfKnopf
              raster
              label="Nicht mehr zuhören"
              symbol={<Icon name="x" />}
              onClick={aufhoeren}
            />
          </div>
        </>
      ) : (
        <>
          <ZustandZeile gut={vor.art === 'laeuft'}>
            {vor.art === 'laeuft'
              ? `Läuft seit ${uhrText(vor.seit)} Uhr`
              : 'Noch keine Übertragung'}
          </ZustandZeile>
          {vor.art === 'aus' && (
            <p className={styles.text}>
              {beendet
                ? 'Die Übertragung ist beendet. Danke fürs Mitbeten!'
                : 'Die Übertragung beginnt kurz vor dem Gebetsabend. Lass diese Seite einfach offen – sie merkt von selbst, wenn es losgeht.'}
            </p>
          )}
          <button
            type="button"
            className={styles.gross}
            disabled={vor.art !== 'laeuft'}
            onClick={zuhoeren}
          >
            <Icon name="play" />
            Gebetsabend zuhören
          </button>
        </>
      )}
    </section>
  );
}
