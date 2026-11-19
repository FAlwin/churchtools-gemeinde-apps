import { useState } from 'react';
import { FensterKnopf } from '@ui/fenster/FensterKnopf';
import { Sheet } from '@ui/fenster/Sheet';
import type { Empfaenger } from '@shared/dienstplan/erinnern';
import type { MailErgebnis, MailLauf } from './erinnernSenden';
import styles from './ErinnernFenster.module.scss';

const namen = (liste: readonly Empfaenger[]) => liste.map((e) => e.name).join(', ');

/**
 * **Das Fenster „Erinnern“ während und nach dem Senden** (Entwurf `e5c-5-erinnern.html`): Fortschritt, dann entweder
 * „N Mails verschickt“ – oder, wenn es angehalten hat, was verschickt ist, was nicht, und „An die übrigen senden“.
 *
 * **Nichts doppelt:** „An die übrigen“ sendet nur, wer noch nicht erinnert ist. Wer **unklar** ist (ChurchTools antwortete
 * nicht – die Mail könnte rausgegangen sein), steht in der Liste, ist aber **nicht vorgewählt**; wer von ChurchTools
 * ausdrücklich abgelehnt wurde, ist vorgewählt (sicher nicht verschickt). Bei „abgemeldet“ und „kein Recht“ gibt es den
 * Knopf nicht – ein zweiter Versuch träfe dieselbe Wand.
 */
export function ErinnernErgebnis({
  laeuft,
  ziel,
  ergebnisse,
  angehalten,
  onNochmal,
  onClose,
}: {
  laeuft: boolean;
  /** Alle, an die gesendet werden sollte – beim ersten Mal festgehalten. */
  ziel: readonly Empfaenger[];
  ergebnisse: ReadonlyMap<number, MailErgebnis>;
  angehalten: MailLauf['angehalten'];
  /** Sendet nur diese (die übrigen). */
  onNochmal: (liste: Empfaenger[]) => void;
  onClose: () => void;
}) {
  const art = (e: Empfaenger) => ergebnisse.get(e.personId)?.art;
  const verschickt = ziel.filter((e) => art(e) === 'verschickt');
  const ohneMail = ziel.filter((e) => art(e) === 'ohneMail');
  // Übrig: noch nicht versucht, von ChurchTools abgelehnt oder unklar – nur die ersten beiden sind vorgewählt.
  const uebrige = ziel.filter((e) => {
    const a = art(e);
    return a === undefined || a === 'abgelehnt' || a === 'unklar';
  });
  // `null` = noch nichts angefasst: vorgewählt sind alle außer den unklaren (Wirkung: `angehakt`).
  const [angefasst, setAngefasst] = useState<Set<number> | null>(null);
  const angehakt = (e: Empfaenger) => (angefasst ? angefasst.has(e.personId) : art(e) !== 'unklar');
  const umschalten = (e: Empfaenger) => {
    const aktuell = new Set(uebrige.filter(angehakt).map((x) => x.personId));
    if (aktuell.has(e.personId)) aktuell.delete(e.personId);
    else aktuell.add(e.personId);
    setAngefasst(aktuell);
  };
  const nochmal = uebrige.filter(angehakt);
  // Auch ohne Anhalten kann etwas offen sein: ein zweiter Lauf lief durch, aber eine unklare Person bleibt unklar.
  const nichtErledigt = uebrige.length > 0;
  const kannWeiter =
    nichtErledigt && angehalten?.grund !== 'keinRecht' && angehalten?.grund !== 'abgemeldet';
  const unklare = ziel.filter((e) => art(e) === 'unklar');
  const sage =
    angehalten?.text ??
    `Bei ${namen(unklare)} ist unklar, ob die Mail rausging – bitte nicht einfach noch einmal senden.`;

  if (laeuft) {
    const fertig = ziel.filter((e) => ergebnisse.has(e.personId)).length;
    return (
      <Sheet
        title={`Wird gesendet … ${fertig} von ${ziel.length}`}
        onClose={onClose}
        beschaeftigt
        einblenden={false}
        knoepfe={null}
      >
        <div className={styles.fortschritt} aria-hidden>
          <i style={{ width: `${(100 * fertig) / Math.max(1, ziel.length)}%` }} />
        </div>
        <p className={styles.hinweis}>Bitte warten – das Fenster nicht schließen.</p>
      </Sheet>
    );
  }

  if (!nichtErledigt && !angehalten) {
    return (
      <Sheet
        title="Erinnert"
        onClose={onClose}
        einblenden={false}
        cancelLabel={null}
        knoepfe={<FensterKnopf onClick={onClose}>Fertig</FensterKnopf>}
      >
        <div className={`${styles.erfolg} ${verschickt.length > 0 ? styles.gut : styles.halb}`}>
          <b>
            {verschickt.length === 1
              ? '1 Mail verschickt.'
              : `${verschickt.length} Mails verschickt.`}
          </b>{' '}
          {namen(verschickt)}
          {verschickt.length > 0 ? '.' : ''}
        </div>
        {ohneMail.length > 0 && (
          <p className={styles.hinweis}>
            Nicht erinnert: {namen(ohneMail)} (keine Mail-Adresse in ChurchTools).
          </p>
        )}
        <p className={styles.hinweis}>
          ChurchTools verschickt im Hintergrund – die Mails kommen meist innerhalb weniger Minuten
          an.
        </p>
      </Sheet>
    );
  }

  return (
    <Sheet
      title="Erinnern – nur zum Teil"
      onClose={onClose}
      einblenden={false}
      cancelLabel="Später"
      knoepfe={
        kannWeiter ? (
          <FensterKnopf onClick={() => onNochmal(nochmal)} disabled={nochmal.length === 0}>
            {nochmal.length === 1
              ? 'An die 1 übrige senden'
              : `An die ${nochmal.length} übrigen senden`}
          </FensterKnopf>
        ) : null
      }
    >
      <div className={`${styles.erfolg} ${styles.halb}`} role="alert">
        <b>
          {verschickt.length} von {ziel.length} verschickt.
        </b>{' '}
        {sage}
      </div>
      {verschickt.length > 0 && (
        <>
          <h3 className={styles.titel}>Verschickt</h3>
          <p className={styles.hinweis}>{namen(verschickt)}</p>
        </>
      )}
      {ohneMail.length > 0 && (
        <>
          <h3 className={styles.titel}>Nicht erinnert – keine Mail-Adresse</h3>
          <p className={styles.hinweis}>{namen(ohneMail)}</p>
        </>
      )}
      {uebrige.length > 0 && (
        <>
          <h3 className={styles.titel}>Noch nicht erinnert</h3>
          <ul className={styles.liste} aria-label="Noch nicht erinnert">
            {uebrige.map((e) => (
              <li key={e.personId} className={styles.zeile}>
                {kannWeiter && (
                  <input
                    type="checkbox"
                    className={styles.haken}
                    checked={angehakt(e)}
                    aria-label={`${e.name} erinnern`}
                    onChange={() => umschalten(e)}
                  />
                )}
                <span className={styles.wer}>
                  <b>{e.name}</b>
                  {art(e) === 'unklar' && (
                    <small className={styles.warnung}>
                      Bei {e.name} ist unklar, ob die Mail rausging – nicht vorgewählt.
                    </small>
                  )}
                  {art(e) === 'abgelehnt' && (
                    <small className={styles.warnung}>
                      ChurchTools hat die Mail nicht genommen.
                    </small>
                  )}
                </span>
              </li>
            ))}
          </ul>
        </>
      )}
    </Sheet>
  );
}
