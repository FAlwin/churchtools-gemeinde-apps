import { Icon } from '@ui/icons/icons';
import { naechsterStatus, statusText, type AufgabenStatus } from '@shared/protokolle/aufgaben';
import { Marke } from './Marke';
import styles from './StatusMarke.module.scss';

const ZEICHEN = { offen: 'kreis', arbeit: 'kreis-halb', erledigt: 'kreis-haken' } as const;
const ART = { offen: 'leise', arbeit: 'info', erledigt: 'gut' } as const;
const gross = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);

/**
 * **Der Status eines To-Dos als Marke mit Zeichen und Wort** („◐ In Arbeit“) – für die To-Do-Übersicht (Bauplan S7,
 * Alwin 30.10.2026: „Der Status in der Karte sollte die Zeichen haben, nicht einfach nur so Schalter“). Zeichen wie der
 * `StatusKreis` im Protokoll, Farben wie die `Marke` (grau offen, blau in Arbeit, grün erledigt). Antippen schaltet
 * weiter: offen → in Arbeit → erledigt → offen; ohne `onWechsel` nur Anzeige.
 */
export function StatusMarke({
  status,
  onWechsel,
  beschaeftigt = false,
}: {
  status: AufgabenStatus;
  onWechsel?: (neu: AufgabenStatus) => void;
  beschaeftigt?: boolean;
}) {
  const naechster = naechsterStatus(status);
  return (
    <button
      type="button"
      className={styles.knopf}
      disabled={!onWechsel || beschaeftigt}
      aria-busy={beschaeftigt || undefined}
      aria-label={`Status: ${gross(statusText(status))}${onWechsel ? ` – antippen für „${gross(statusText(naechster))}“` : ''}`}
      onClick={() => onWechsel?.(naechster)}
    >
      <Marke art={ART[status]}>
        <span className={styles.innen}>
          <Icon name={ZEICHEN[status]} size={16} />
          {gross(statusText(status))}
        </span>
      </Marke>
    </button>
  );
}
