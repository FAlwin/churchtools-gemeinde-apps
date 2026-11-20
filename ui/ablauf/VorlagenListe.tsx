/**
 * **Die Liste der Ablaufvorlagen, nach Kalender gruppiert** (E10-V3a, Entwurf `e10-vorlagen.html` Abschnitt 1): je
 * Kalender ein Band mit dem Namen (rechts die Zahl der Vorlagen – oder, wo man sie nicht bearbeiten darf, „nur ansehen“
 * mit Schloss), darunter je Vorlage eine Zeile „Name · N Punkte · N vor Beginn · geändert TT.MM.“ mit Pfeil.
 *
 * Nur die Darstellung: Laden, Fehler, „Neue Vorlage“ und das Recht stehen beim Aufrufer (`VorlagenBereich`). „Nur
 * ansehen“ steht am Kalender statt an jeder Zeile – so ist sofort klar, warum dort kein Stift erscheint.
 */
import type { VorlagenGruppe } from '@shared/ct/ablaufVorlagenListe';
import { Icon } from '../icons/icons';
import { Etikett } from '../bedienung/Etikett';
import { vorlagenMeta } from './vorlagenMeta';
import styles from './VorlagenListe.module.scss';

export function VorlagenListe({
  gruppen,
  darfIn,
  onOeffnen,
}: {
  gruppen: readonly VorlagenGruppe[];
  /** Darf man in diesem Kalender Vorlagen bearbeiten (`darfVorlageBearbeiten`)? Sonst „nur ansehen“. */
  darfIn: (kalenderId: number | null) => boolean;
  onOeffnen: (vorlageId: number) => void;
}) {
  if (gruppen.length === 0) {
    return (
      <p className={styles.leer}>
        Noch keine Vorlage. Lege eine an oder speichere den Ablauf eines Termins als Vorlage.
      </p>
    );
  }
  return (
    // `data-tour`: Ziel der Einführung der Musik-App (`TOUR_VORLAGEN`); andere Apps ignorieren das Attribut.
    <div className={styles.karte} data-tour="vorlagen-liste">
      {gruppen.map((g) => (
        <section key={g.kalenderId ?? 'ohne'} aria-label={g.kalender}>
          <div className={styles.band}>
            <h3>{g.kalender}</h3>
            {darfIn(g.kalenderId) ? (
              <span className={styles.zahl}>
                {g.vorlagen.length === 1 ? '1 Vorlage' : `${g.vorlagen.length} Vorlagen`}
              </span>
            ) : (
              <Etikett title="Du darfst in diesem Kalender Vorlagen nur ansehen">
                <Icon name="lock" size={12} stroke={2.2} /> nur ansehen
              </Etikett>
            )}
          </div>
          {g.vorlagen.map((v) => (
            <button
              key={v.id}
              type="button"
              className={styles.zeile}
              onClick={() => onOeffnen(v.id)}
            >
              <span className={styles.kachel} aria-hidden="true">
                <Icon name="grid" size={18} stroke={2} />
              </span>
              <span className={styles.text}>
                <b>{v.name}</b>
                <small>{vorlagenMeta(v)}</small>
              </span>
              <Icon name="chev-right" size={18} className={styles.pfeil} />
            </button>
          ))}
        </section>
      ))}
    </div>
  );
}
