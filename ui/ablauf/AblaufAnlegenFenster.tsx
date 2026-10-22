import { useState, type ReactNode } from 'react';
import type { AblaufQuelle, AblaufVorlage } from '@shared/types/index';
import { startQuelle } from '@shared/ct/ablaufVorschlaege';
import { Sheet } from '../fenster/Sheet';
import { Icon, type IconName } from '../icons/icons';
import styles from './AblaufAnlegenFenster.module.scss';

/** So viele frühere Veranstaltungen stehen zuerst da; der Rest hinter „Weitere anzeigen". */
const ERSTE_VORSCHLAEGE = 3;

/** Ein früherer Termin, dessen Ablauf sich kopieren lässt – so, wie das Fenster ihn zeigt. */
export interface KopieVorschlag {
  id: number;
  /** z. B. „18. Okt · Gottesdienst“. */
  titel: string;
  /** z. B. „3 Lieder“ oder „7 Punkte“. */
  meta: string;
}

interface Props {
  /** Für welchen Termin – eine Zeile unter dem Titel (Text oder, wie in der Musik-App, aus Stücken). */
  fuer: ReactNode;
  /** Die Vorlagen in der Reihenfolge, in der sie stehen sollen (`vorlagenFuer`). */
  vorlagen: { liste: AblaufVorlage[]; laedt: boolean; fehler: boolean };
  /** Frühere Termine mit Ablauf, jüngster zuerst (`kopieVorschlaege`). */
  vorschlaege: KopieVorschlag[];
  /** Was steht, wenn es keine Vorschläge gibt (die Apps suchen an verschiedenen Orten). */
  keineVorschlaege: string;
  /** Legt an; wirft bei Fehler – die Meldung steht dann im Fenster. */
  onAnlegen: (quelle: AblaufQuelle) => Promise<void>;
  onClose: () => void;
}

/**
 * **Ablauf anlegen** (Alwin, 13.10.2026): aus einer Vorlage, wie eine frühere Veranstaltung oder leer. Vorausgewählt
 * ist die erste Vorlage („Vorlage zuerst", `startQuelle`). Seit E6-5a ein gemeinsamer Baustein: Musik-App und
 * Dienstplaner geben Vorlagen und Vorschläge herein; die Regel, die vorher und nachher in ChurchTools nachliest, steht
 * in `@shared/ct/ablaufAnlegen`.
 */
export function AblaufAnlegenFenster({
  fuer,
  vorlagen,
  vorschlaege,
  keineVorschlaege,
  onAnlegen,
  onClose,
}: Props) {
  const [gewaehlt, setGewaehlt] = useState<AblaufQuelle | null>(null);
  const [alleVorschlaege, setAlleVorschlaege] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);
  const [laeuft, setLaeuft] = useState(false);

  // Bis jemand wählt, gilt der Vorschlag – er kann sich ändern, wenn die Vorlagen nachkommen.
  const quelle = gewaehlt ?? startQuelle(vorlagen.liste, vorschlaege);
  const sichtbareVorschlaege = alleVorschlaege
    ? vorschlaege
    : vorschlaege.slice(0, ERSTE_VORSCHLAEGE);

  function waehle(q: AblaufQuelle) {
    setGewaehlt(q);
    setFehler(null);
  }

  async function bestaetigen() {
    setFehler(null);
    setLaeuft(true);
    try {
      await onAnlegen(quelle);
    } catch (e) {
      setFehler(e instanceof Error ? e.message : 'Ablauf anlegen fehlgeschlagen.');
    } finally {
      setLaeuft(false);
    }
  }

  return (
    <Sheet title="Ablauf anlegen" onClose={onClose}>
      <p className={styles.fuer}>{fuer}</p>

      <div className={styles.optionen}>
        <Option
          icon="grid"
          titel="Aus einer Vorlage"
          an={quelle.art === 'vorlage'}
          onWaehle={() =>
            vorlagen.liste[0] && waehle({ art: 'vorlage', vorlageId: vorlagen.liste[0].id })
          }
          hinweis={
            vorlagen.laedt
              ? 'Vorlagen werden geladen …'
              : vorlagen.fehler
                ? 'Die Vorlagen ließen sich nicht laden.'
                : vorlagen.liste.length === 0
                  ? 'In ChurchTools gibt es noch keine Ablauf-Vorlage.'
                  : undefined
          }
        >
          {quelle.art === 'vorlage' &&
            vorlagen.liste.map((v) => (
              <Eintrag
                key={v.id}
                an={quelle.vorlageId === v.id}
                onWaehle={() => waehle({ art: 'vorlage', vorlageId: v.id })}
                titel={v.name}
                meta={v.punkte === 1 ? '1 Punkt' : `${v.punkte} Punkte`}
              />
            ))}
        </Option>

        <Option
          icon="calendar"
          titel="Wie eine frühere"
          an={quelle.art === 'kopie'}
          onWaehle={() => vorschlaege[0] && waehle({ art: 'kopie', eventId: vorschlaege[0].id })}
          hinweis={vorschlaege.length === 0 ? keineVorschlaege : undefined}
        >
          {quelle.art === 'kopie' && (
            <>
              {sichtbareVorschlaege.map((s) => (
                <Eintrag
                  key={s.id}
                  an={quelle.eventId === s.id}
                  onWaehle={() => waehle({ art: 'kopie', eventId: s.id })}
                  titel={s.titel}
                  meta={s.meta}
                />
              ))}
              {!alleVorschlaege && vorschlaege.length > ERSTE_VORSCHLAEGE && (
                <button className={styles.mehr} onClick={() => setAlleVorschlaege(true)}>
                  Weitere anzeigen
                </button>
              )}
            </>
          )}
        </Option>

        <Option
          icon="plus"
          titel="Leer"
          an={quelle.art === 'leer'}
          onWaehle={() => waehle({ art: 'leer' })}
          hinweis={quelle.art === 'leer' ? 'Die Punkte fügst du danach hinzu.' : undefined}
        />
      </div>

      {fehler && (
        <p className={styles.fehler} role="alert">
          {fehler}
        </p>
      )}

      <button className={styles.anlegen} onClick={() => void bestaetigen()} disabled={laeuft}>
        {laeuft ? 'Wird angelegt …' : 'Anlegen'}
      </button>
    </Sheet>
  );
}

function Option({
  icon,
  titel,
  an,
  hinweis,
  onWaehle,
  children,
}: {
  icon: IconName;
  titel: string;
  an: boolean;
  hinweis?: string;
  onWaehle: () => void;
  children?: ReactNode;
}) {
  return (
    <div className={`${styles.option}${an ? ' ' + styles.an : ''}`}>
      <button className={styles.kopf} aria-pressed={an} onClick={onWaehle}>
        <Icon name={icon} size={20} stroke={2} className={styles.icon} />
        <span className={styles.titel}>{titel}</span>
      </button>
      {hinweis && <p className={styles.hinweis}>{hinweis}</p>}
      {children && <div className={styles.eintraege}>{children}</div>}
    </div>
  );
}

function Eintrag({
  titel,
  meta,
  an,
  onWaehle,
}: {
  titel: string;
  meta: string;
  an: boolean;
  onWaehle: () => void;
}) {
  return (
    <button className={styles.eintrag} aria-pressed={an} onClick={onWaehle}>
      <span className={`${styles.punkt}${an ? ' ' + styles.punktAn : ''}`} aria-hidden="true" />
      <span className={styles.eintragTitel}>{titel}</span>
      <span className={styles.eintragMeta}>{meta}</span>
    </button>
  );
}
