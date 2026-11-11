import { useState } from 'react';
import { Sheet } from '@ui/fenster/Sheet';
import { FensterKnopf } from '@ui/fenster/FensterKnopf';
import { Icon } from '@ui/icons/icons';
import { fehlerMeldung } from '@ui/ct/fehlerMeldung';
import type { Hinweis } from '@shared/protokolle/freigabe';
import felder from './Fensterfelder.module.scss';
import styles from './Freigabe.module.scss';

/** Was nach dem Freigeben noch scheitern kann – das Protokoll ist dann trotzdem frei. */
export interface FreigabeFolge {
  /** Gruppentreffen abschließen; fehlt, wenn es keins gibt. */
  treffen?: () => Promise<void>;
}

/**
 * **Fenster „Protokoll freigeben?“** (S6-1, Entwurf `s6-freigabe-pdf-v1`): Hinweise (rot = einen Blick wert, grün =
 * Zusammenfassung) mit „Ansehen“, ein Satz, was passiert, und „Freigeben“. Freigeben geht trotz Hinweisen.
 *
 * `onFreigeben` schreibt das Protokoll frei und liefert, was danach noch zu tun ist (Treffen abschließen). Scheitert so
 * ein Folgeschritt, bleibt das Fenster offen: „Das Protokoll ist freigegeben – …“ mit „Nochmal versuchen“.
 */
export function FreigabeFenster({
  hinweise,
  zusammenfassung,
  mitTreffen,
  laedt,
  onAnsehen,
  onFreigeben,
  onFertig,
  onClose,
}: {
  hinweise: readonly Hinweis[];
  zusammenfassung: string;
  /** Gibt es ein Gruppentreffen, das abgeschlossen wird? */
  mitTreffen: boolean;
  /** Die Hinweise werden noch gelesen (Anwesenheit aus ChurchTools). */
  laedt: boolean;
  onAnsehen: (ziel: string) => void;
  onFreigeben: () => Promise<FreigabeFolge>;
  /** Freigegeben und alles erledigt (oder bewusst so gelassen) – das Fenster geht zu. */
  onFertig: () => void;
  onClose: () => void;
}) {
  const [laeuft, setLaeuft] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);
  // Freigegeben, aber das Treffen ließ sich nicht abschließen.
  const [rest, setRest] = useState<{ treffen: () => Promise<void>; fehler: string } | null>(null);

  const folge = async (treffen: () => Promise<void>) => {
    try {
      await treffen();
      onFertig();
    } catch (e) {
      setRest({ treffen, fehler: fehlerMeldung(e).text });
      setLaeuft(false);
    }
  };

  const freigeben = async () => {
    setLaeuft(true);
    setFehler(null);
    let f: FreigabeFolge;
    try {
      f = await onFreigeben();
    } catch (e) {
      setFehler(fehlerMeldung(e).text);
      setLaeuft(false);
      return;
    }
    if (f.treffen) await folge(f.treffen);
    else onFertig();
  };

  if (rest)
    return (
      <Sheet
        title="Protokoll freigegeben"
        onClose={onFertig}
        cancelLabel="Schließen"
        beschaeftigt={laeuft}
        knoepfe={
          <FensterKnopf
            disabled={laeuft}
            onClick={() => {
              setLaeuft(true);
              void folge(rest.treffen);
            }}
          >
            {laeuft ? 'Wird versucht …' : 'Nochmal versuchen'}
          </FensterKnopf>
        }
      >
        <p className={styles.info}>
          Das Protokoll ist freigegeben. Das <b>Gruppentreffen</b> ließ sich aber nicht abschließen:{' '}
          {rest.fehler}
        </p>
        <p className={felder.leise}>
          Ohne Abschluss lässt sich die Anwesenheit in ChurchTools noch ändern. Du kannst es später
          auch dort abschließen.
        </p>
      </Sheet>
    );

  return (
    <Sheet
      title="Protokoll freigeben?"
      onClose={onClose}
      beschaeftigt={laeuft}
      knoepfe={
        <FensterKnopf disabled={laeuft || laedt} onClick={() => void freigeben()}>
          <Icon name="stempel" size={18} /> {laeuft ? 'Wird freigegeben …' : 'Freigeben'}
        </FensterKnopf>
      }
    >
      <ul className={styles.hinweise} aria-label="Hinweise">
        {laedt && (
          <li>
            <span className={styles.zeichen} />
            <span className={styles.text}>Hinweise werden geladen …</span>
          </li>
        )}
        {hinweise.map((h) => (
          <li key={h.art} className={styles.warn}>
            <span className={styles.zeichen}>!</span>
            <span className={styles.text}>
              {h.text}
              {h.einzeln.length > 0 && <small>{h.einzeln.join(' · ')}</small>}
              {h.ziel && (
                <button type="button" className={styles.ansehen} onClick={() => onAnsehen(h.ziel!)}>
                  Ansehen
                </button>
              )}
            </span>
          </li>
        ))}
        <li className={styles.ok}>
          <span className={styles.zeichen}>✓</span>
          <span className={styles.text}>{zusammenfassung}</span>
        </li>
      </ul>
      <p className={styles.info}>
        Danach ist das Protokoll <b>fest</b>.
        {mitTreffen && (
          <>
            {' '}
            Das <b>Gruppentreffen wird abgeschlossen</b> – die Anwesenheit lässt sich dann nicht
            mehr ändern.
          </>
        )}{' '}
        To-Dos bleiben abhakbar. Die Leitung kann die Freigabe zurücknehmen.
      </p>
      {fehler && (
        <p className={felder.fehler} role="alert">
          {fehler}
        </p>
      )}
    </Sheet>
  );
}
