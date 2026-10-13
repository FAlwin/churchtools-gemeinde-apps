import { useState } from 'react';
import type { AblaufQuelle, Service } from '@shared/types/index';
import { Sheet } from '@ui/fenster/Sheet';
import { Icon, type IconName } from '@ui/icons/icons';
import { useAblaufAnlegen, useAblaufVorlagen } from '../hooks/useServices';
import { kopieVorschlaege, startQuelle, vorlagenFuer } from '../utils/ablaufVorschlaege';
import { liedAnzahl } from '../utils/songFilter';
import styles from './AblaufAnlegenFenster.module.scss';
import knopf from './NewSongSheet.module.scss';

/** So viele frühere Veranstaltungen stehen zuerst da; der Rest hinter „Weitere anzeigen". */
const ERSTE_VORSCHLAEGE = 3;

interface Props {
  /** Die Veranstaltung ohne Ablauf. */
  termin: Service;
  /** Termine MIT Ablauf (die normale Liste) – daraus kommen die Vorschläge für „Wie eine frühere". */
  mitAblauf: Service[];
  onClose: () => void;
  /** Nach dem Anlegen – der Aufrufer öffnet den neuen Ablauf. */
  onAngelegt: (termin: Service) => void;
}

/**
 * **Ablauf anlegen** (Alwin, 13.10.2026): aus einer Vorlage, wie eine frühere Veranstaltung oder leer.
 * Vorausgewählt ist die erste Vorlage („Vorlage zuerst"). Die Regel, die vorher und nachher in
 * ChurchTools nachliest, steht in `@shared/ct/ablaufAnlegen`.
 */
export function AblaufAnlegenFenster({ termin, mitAblauf, onClose, onAngelegt }: Props) {
  const vorlagenQuery = useAblaufVorlagen(true);
  const anlegen = useAblaufAnlegen();
  const vorlagen = vorlagenFuer(vorlagenQuery.data ?? [], termin.kalenderId);
  const vorschlaege = kopieVorschlaege(termin, mitAblauf);
  const [gewaehlt, setGewaehlt] = useState<AblaufQuelle | null>(null);
  const [alleVorschlaege, setAlleVorschlaege] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);

  // Bis jemand wählt, gilt der Vorschlag – er kann sich ändern, wenn die Vorlagen nachkommen.
  const quelle = gewaehlt ?? startQuelle(vorlagen, vorschlaege);
  const sichtbareVorschlaege = alleVorschlaege
    ? vorschlaege
    : vorschlaege.slice(0, ERSTE_VORSCHLAEGE);

  function waehle(q: AblaufQuelle) {
    setGewaehlt(q);
    setFehler(null);
  }

  async function bestaetigen() {
    if (termin.kalenderId === undefined) {
      setFehler('Der Kalender dieser Veranstaltung ist unbekannt. Bitte die Liste neu laden.');
      return;
    }
    setFehler(null);
    try {
      await anlegen.mutateAsync({ eventId: termin.id, kalenderId: termin.kalenderId, quelle });
      onAngelegt(termin);
    } catch (e) {
      setFehler(e instanceof Error ? e.message : 'Ablauf anlegen fehlgeschlagen.');
    }
  }

  return (
    <Sheet title="Ablauf anlegen" onClose={onClose}>
      <p className={styles.fuer}>
        {termin.name} · {termin.weekday.slice(0, 2)} {termin.day}. {termin.month} · {termin.time}
      </p>

      <div className={styles.optionen}>
        <Option
          icon="grid"
          titel="Aus einer Vorlage"
          an={quelle.art === 'vorlage'}
          onWaehle={() => vorlagen[0] && waehle({ art: 'vorlage', vorlageId: vorlagen[0].id })}
          hinweis={
            vorlagenQuery.isLoading
              ? 'Vorlagen werden geladen …'
              : vorlagenQuery.isError
                ? 'Die Vorlagen ließen sich nicht laden.'
                : vorlagen.length === 0
                  ? 'In ChurchTools gibt es noch keine Ablauf-Vorlage.'
                  : undefined
          }
        >
          {quelle.art === 'vorlage' &&
            vorlagen.map((v) => (
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
          hinweis={
            vorschlaege.length === 0
              ? 'Keine frühere Veranstaltung mit Ablauf in der Terminliste.'
              : undefined
          }
        >
          {quelle.art === 'kopie' && (
            <>
              {sichtbareVorschlaege.map((s) => (
                <Eintrag
                  key={s.id}
                  an={quelle.eventId === s.id}
                  onWaehle={() => waehle({ art: 'kopie', eventId: s.id })}
                  titel={`${s.day}. ${s.month} · ${s.name}`}
                  meta={s.songCount > 0 ? liedAnzahl(s.songCount) : 'ohne Lieder'}
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

      <button
        className={`${knopf.primaryWide} ${styles.anlegen}`}
        onClick={() => void bestaetigen()}
        disabled={anlegen.isPending}
      >
        {anlegen.isPending ? 'Wird angelegt …' : 'Anlegen'}
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
  children?: React.ReactNode;
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
