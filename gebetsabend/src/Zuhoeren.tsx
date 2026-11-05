import { useCallback, useEffect, useRef, useState } from 'react';
import { FehlerKasten } from '@ui/erweiterung/ErweiterungsSeite';
import { fehlerMeldung, type Fehlermeldung } from '@ui/ct/fehlerMeldung';
import { Icon } from '@ui/icons/icons';
import { KopfKnopf } from '@ui/bedienung/KopfKnopf';
import { useVollbild } from '@ui/bedienung/useVollbild';
import { uhrText } from '@shared/ct/zeit';
import { ERLAUBNIS_ZUHOERER, VDO_BASIS, zuhoererLink } from '@shared/gebetsabend/links';
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
import { ladeZugang } from './lesen';
import styles from './Zuhoeren.module.scss';

const VDO_HERKUNFT = new URL(VDO_BASIS).origin;

interface Props {
  modul: number;
  /** ID der Kategorie „Zugang“. */
  kategorie: number;
  /** Vor- und Nachname – kommt beim Sender als Name an („Wer hört zu?“, G4). */
  name: string;
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
 * - **Vollbild** über den gemeinsamen Baustein; am iPhone (kein Vollbild für Seiten) die **Großansicht**: dieselbe
 *   Bühne legt sich per CSS über die Seite. Das iframe wird dabei nicht umgehängt – ein umgehängtes iframe lädt neu,
 *   und Bild und Ton brächen ab.
 * - Das iframe entsteht erst beim Tippen. Am iPhone reicht das nicht immer: Safari sperrt das Abspielen im fremden
 *   iframe, bis man dort selbst tippt (05.11.2026) – daher der Hinweis unter dem Bild.
 */
export function Zuhoeren({ modul, kategorie, name }: Props) {
  const [laden, setLaden] = useState<Laden>({ art: 'laedt' });
  const [zugang, setZugang] = useState<Zugang | null>(null);
  /** Womit der Player geladen ist – `null` = er ist zu. */
  const [gehoert, setGehoert] = useState<Zugang | null>(null);
  const [player, setPlayer] = useState<PlayerZustand>('verbindet');
  const [beendet, setBeendet] = useState(false);
  const fenster = useRef<HTMLIFrameElement>(null);
  const buehne = useRef<HTMLDivElement>(null);
  const vollbild = useVollbild(buehne, { ersatz: true });
  const { art: vollbildArt, an: vollbildAn, beenden: vollbildBeenden } = vollbild;
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
            vollbildBeenden();
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
    [modul, kategorie, vollbildBeenden],
  );

  useEffect(() => {
    nachfragen(true);
    const t = window.setInterval(() => nachfragen(false), NACHFRAGEN_MS);
    return () => window.clearInterval(t);
  }, [nachfragen]);

  useEffect(() => {
    const hoeren = (e: MessageEvent) => {
      if (!istVdoMeldung(e, fenster.current?.contentWindow, VDO_HERKUNFT)) return;
      const m = meldungAus(e.data);
      if (m) setPlayer((z) => naechsterZustand(z, m));
    };
    window.addEventListener('message', hoeren);
    return () => window.removeEventListener('message', hoeren);
  }, []);

  // Großansicht (iPhone): Escape schließt sie wie das echte Vollbild – für Tastaturen am iPad.
  useEffect(() => {
    if (vollbildArt !== 'ersatz' || !vollbildAn) return;
    const taste = (e: KeyboardEvent) => {
      if (e.key === 'Escape') vollbildBeenden();
    };
    window.addEventListener('keydown', taste);
    return () => window.removeEventListener('keydown', taste);
  }, [vollbildArt, vollbildAn, vollbildBeenden]);

  const aufhoeren = () => {
    vollbildBeenden();
    setGehoert(null);
  };

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
  return (
    <section className={styles.karte} aria-label="Zuhören">
      {gehoert ? (
        <>
          <Zustand gut={PLAYER_GUT[player]}>
            {gehoert.laeuftSeit ? `Läuft seit ${uhrText(gehoert.laeuftSeit)} Uhr` : 'Läuft'}
          </Zustand>
          <div
            ref={buehne}
            className={
              vollbildAn
                ? `${styles.buehne} ${vollbildArt === 'ersatz' ? styles.grossansicht : styles.vollbild}`
                : styles.buehne
            }
          >
            <iframe
              key={`${gehoert.streamId}-${gehoert.mitBild ? 'bild' : 'ton'}`}
              ref={fenster}
              className={gehoert.mitBild ? styles.player : `${styles.player} ${styles.nurTon}`}
              title="Übertragung des Gebetsabends"
              src={zuhoererLink(gehoert, name)}
              allow={ERLAUBNIS_ZUHOERER}
              onLoad={() => fenster.current?.contentWindow?.postMessage(PEGEL_AN, VDO_HERKUNFT)}
            />
            {vollbildAn && (
              <button type="button" className={styles.schliessen} onClick={vollbildBeenden}>
                <Icon name="x" />
                Schließen
              </button>
            )}
          </div>
          <p className={styles.leise}>{PLAYER_TEXT[player]}</p>
          <p className={styles.text}>{HINWEIS_TIPPEN}</p>
          <p className={styles.leise}>Der Ton läuft auch weiter, wenn du das Handy sperrst.</p>
          <p className={styles.leise}>Die Technik sieht, dass du zuhörst.</p>
          <div className={styles.rechts}>
            {gehoert.mitBild && vollbild.kann && (
              <KopfKnopf
                raster
                label={vollbildArt === 'ersatz' ? 'Großansicht' : 'Vollbild'}
                symbol={<Icon name="vollbild" />}
                onClick={vollbild.umschalten}
              />
            )}
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
          <Zustand gut={vor.art === 'laeuft'}>
            {vor.art === 'laeuft'
              ? `Läuft seit ${uhrText(vor.seit)} Uhr`
              : 'Noch keine Übertragung'}
          </Zustand>
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

function Zustand({ gut, children }: { gut: boolean; children: string }) {
  return (
    <p className={gut ? `${styles.zustand} ${styles.an}` : styles.zustand} role="status">
      <span className={styles.punkt} aria-hidden="true" />
      {children}
    </p>
  );
}
