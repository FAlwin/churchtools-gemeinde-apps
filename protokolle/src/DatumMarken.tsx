import { useState } from 'react';
import { tagPunkt } from '@shared/ct/datum';
import { tagDazu, tagWeg } from '@shared/protokolle/terminWiederholung';
import { ZeilenKnopf } from '@ui/bedienung/ZeilenKnopf';
import { Icon } from '@ui/icons/icons';
import styles from './TerminFormular.module.scss';

/**
 * **Gewählte Tage als kleine Marken** („27.11.2026 ✕“) mit einem „+“, das eine Datumswahl öffnet – „Weitere Termine“ und
 * „Ausnahmen“ im Fenster „In Kalender eintragen“ (W15-1, wie im ChurchTools-Dialog). Die Liste hält der Aufrufer.
 */
export function DatumMarken({
  titel,
  tage,
  onAendern,
  deaktiviert,
}: {
  /** Name der Gruppe für Vorleser („Weitere Termine“). */
  titel: string;
  tage: readonly string[];
  onAendern: (tage: string[]) => void;
  deaktiviert?: boolean;
}) {
  const [offen, setOffen] = useState(false);
  return (
    <div className={styles.marken}>
      {tage.map((t) => (
        <span key={t} className={styles.marke}>
          {tagPunkt(t)}
          <ZeilenKnopf
            label={`${titel}: ${tagPunkt(t)} entfernen`}
            disabled={deaktiviert}
            onClick={() => onAendern(tagWeg(tage, t))}
          >
            <Icon name="x" size={14} stroke={2.4} />
          </ZeilenKnopf>
        </span>
      ))}
      {offen ? (
        <input
          type="date"
          className={`${styles.eingabe} ${styles.markenDatum}`}
          aria-label={`${titel}: Datum wählen`}
          autoFocus
          onChange={(ev) => {
            if (!ev.target.value) return;
            onAendern(tagDazu(tage, ev.target.value));
            setOffen(false);
          }}
          onBlur={() => setOffen(false)}
        />
      ) : (
        <ZeilenKnopf
          label={`${titel}: Datum hinzufügen`}
          disabled={deaktiviert}
          onClick={() => setOffen(true)}
        >
          <Icon name="plus" size={14} stroke={2.4} />
        </ZeilenKnopf>
      )}
    </div>
  );
}
