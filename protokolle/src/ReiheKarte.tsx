import { useContext } from 'react';
import { Icon } from '@ui/icons/icons';
import { TextKnopf } from '@ui/bedienung/TextKnopf';
import { datumText } from '@shared/ct/datum';
import { zeilenSortiert } from '@shared/protokolle/themenreihe';
import { ReiheKontext } from './themenreiheKontext';
import styles from './ReiheKarte.module.scss';

/**
 * **Der Baustein „Reihe“** – im Editor (`ReiheBlock`) und in der Lese-Ansicht dieselbe Karte: Name der Reihe, eine Zeile
 * je Abend (Datum, Event, Thema, Wer, Bibelstelle, Notiz) – **nur lesend**; bearbeitet wird in Fenstern. Darunter die stillen
 * Wörter „Bearbeiten“ und „In Events übertragen“ für alle, die im Protokoll schreiben dürfen (`darfBauen`). Auch bei einem
 * freigegebenen Protokoll: Die Reihe liegt in „Mitarbeit“, nicht im Protokoll, und Events ordnet man meist erst danach zu.
 */
export function ReiheKarte({ reiheId }: { reiheId: string }) {
  const k = useContext(ReiheKontext);
  const r = k?.reihen.get(reiheId);
  const kopf = (name: string) => (
    <div className={styles.kopf}>
      <span className={styles.zeichen}>
        <Icon name="liste" size={18} />
      </span>
      <b className={styles.name}>{name}</b>
    </div>
  );
  if (!k) return <div className={styles.karte}>{kopf('Reihe')}</div>;
  if (!r) {
    return (
      <div className={styles.karte}>
        {kopf('Reihe')}
        {k.stand === 'fehler' ? (
          <p className={styles.hinweis} role="alert">
            Die Reihe ließ sich nicht laden.{' '}
            <TextKnopf onClick={k.neuLaden}>Erneut versuchen</TextKnopf>
          </p>
        ) : k.stand === 'fertig' ? (
          <p className={styles.hinweis}>Diese Reihe gibt es nicht (mehr).</p>
        ) : (
          <p className={styles.hinweis}>Die Reihe wird geladen …</p>
        )}
      </div>
    );
  }
  const zeilen = zeilenSortiert(r.zeilen);
  return (
    <div className={styles.karte} aria-label={`Reihe ${r.name}`}>
      {kopf(r.name)}
      {zeilen.length === 0 ? (
        <p className={styles.hinweis}>Noch keine Abende.</p>
      ) : (
        <table className={styles.tabelle}>
          <thead>
            <tr>
              <th>Abend</th>
              <th>Thema</th>
              <th>Wer</th>
              <th>Bibelstelle</th>
              <th>Notiz</th>
            </tr>
          </thead>
          <tbody>
            {zeilen.map((z) => (
              <tr key={z.id}>
                <td>
                  <b>{z.datum ? datumText(z.datum) : 'ohne Datum'}</b>
                  <div>
                    {z.eventId !== null ? (
                      <span className={styles.event}>
                        <Icon name="calendar" size={14} />
                        {z.eventTitel || `Event ${z.eventId}`}
                      </span>
                    ) : (
                      <span className={`${styles.event} ${styles.ohneEvent}`}>Kein Event</span>
                    )}
                  </div>
                </td>
                <td>{z.thema || <span className={styles.leer}>–</span>}</td>
                <td>{z.wer?.name || <span className={styles.leer}>–</span>}</td>
                <td>{z.bibelstelle || <span className={styles.leer}>–</span>}</td>
                <td>{z.notiz || <span className={styles.leer}>–</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {k.darfBauen && (
        <div className={styles.fuss}>
          <TextKnopf onClick={() => k.bearbeiten(reiheId)}>Bearbeiten</TextKnopf>
          <TextKnopf onClick={() => k.uebertragen(reiheId)}>In Events übertragen</TextKnopf>
        </div>
      )}
    </div>
  );
}
