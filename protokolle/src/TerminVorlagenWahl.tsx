import type { TerminVorlage } from '@shared/protokolle/terminVorlagen';
import { TextKnopf } from '@ui/bedienung/TextKnopf';
import { Icon } from '@ui/icons/icons';
import type { Fehlermeldung } from '@ui/ct/fehlerMeldung';
import styles from './TerminFormular.module.scss';

/** Der Satz im grünen Kasten – wörtlich aus ChurchTools. */
export const VORLAGEN_HINWEIS =
  'Mit Vorlagen stellst du einheitliche Bezeichnungen sicher und sparst viel Zeit beim Erstellen deiner Termine.';

interface Props {
  kalenderName: string;
  /** Nur die Vorlagen des gewählten Kalenders. */
  vorlagen: readonly TerminVorlage[];
  /** `null` = „Ohne Vorlage“. */
  gewaehlt: number | null;
  onWaehlen: (v: TerminVorlage | null) => void;
  laedt: boolean;
  fehler: Fehlermeldung | null;
  onNeu: () => void;
  deaktiviert: boolean;
}

/**
 * **Die Spalte „Termin-Vorlagen <Kalender>“** links im Fenster (am Handy eine Auswahl oben): grüner Hinweis, darunter
 * „Ohne Vorlage“ und die Vorlagen des gewählten Kalenders. Wie im ChurchTools-Dialog „Termin erstellen“ (W15-1).
 */
export function TerminVorlagenWahl({ handy, ...p }: Props & { handy: boolean }) {
  const gewaehlt = p.vorlagen.some((v) => v.id === p.gewaehlt) ? p.gewaehlt : null;
  if (handy) {
    return (
      <>
        <label className={styles.vorlagenAuswahl}>
          <span>Termin-Vorlage</span>
          <select
            className={styles.eingabe}
            value={gewaehlt ?? ''}
            disabled={p.deaktiviert}
            onChange={(ev) =>
              p.onWaehlen(p.vorlagen.find((v) => v.id === Number(ev.target.value)) ?? null)
            }
          >
            <option value="">Ohne Vorlage</option>
            {p.vorlagen.map((v) => (
              <option key={v.id} value={v.id}>
                {v.titel}
              </option>
            ))}
          </select>
        </label>
        {p.fehler && (
          <p className={styles.leise}>
            Die Vorlagen konnten nicht geladen werden.{' '}
            <TextKnopf onClick={p.onNeu}>Vorlagen noch einmal laden</TextKnopf>
          </p>
        )}
      </>
    );
  }
  return (
    <aside className={styles.vorlagen} aria-label="Termin-Vorlagen">
      <h3 className={styles.vorlagenKopf}>Termin-Vorlagen {p.kalenderName}</h3>
      <p className={styles.vorlagenHinweis}>
        <Icon name="check" size={16} stroke={2.2} />
        <span>{VORLAGEN_HINWEIS}</span>
      </p>
      <ul className={styles.vorlagenListe} role="radiogroup" aria-label="Termin-Vorlage">
        {[null, ...p.vorlagen].map((v) => (
          <li key={v?.id ?? 'ohne'}>
            <label className={styles.vorlage}>
              <input
                type="radio"
                name="termin-vorlage"
                checked={gewaehlt === (v?.id ?? null)}
                disabled={p.deaktiviert}
                onChange={() => p.onWaehlen(v)}
              />
              <span>{v ? v.titel : 'Ohne Vorlage'}</span>
            </label>
          </li>
        ))}
      </ul>
      {p.laedt && <p className={styles.leise}>Vorlagen werden geladen …</p>}
      {p.fehler && (
        <>
          <p className={styles.leise}>Die Vorlagen konnten nicht geladen werden.</p>
          <TextKnopf onClick={p.onNeu}>Vorlagen noch einmal laden</TextKnopf>
        </>
      )}
    </aside>
  );
}
