import { useState } from 'react';
import { SITE_CONFIG_GRENZEN, type SiteConfig } from '@shared/types/index';
import { Icon } from '@ui/icons/icons';
import { FensterKnopf } from '@ui/fenster/FensterKnopf';
import { Sheet } from '@ui/fenster/Sheet';
import { Spinner } from './Spinner';
import { useKalender, useUpdateSiteConfig } from '../hooks/useSiteConfig';
import { sameIdSet } from '../utils/adminDrafts';
import { speicherFehler } from '../utils/speicherFehler';
import styles from '../pages/Settings.module.scss';

/**
 * Verwaltung → **„Termine ohne Ablauf"** (Alwin, 13.10.2026): aus welchen Kalendern Veranstaltungen
 * ohne Ablauf in der Terminliste erscheinen – mit „Ablauf anlegen". Dazu ein Suchwort, weil bei der ECG
 * Gottesdienst und Gebetsabend im selben Kalender liegen. Die Regel steht in `@shared/ct/ablaufAnlegen`
 * (`brauchtAblauf`). Zeichnet sein Fenster selbst, damit „Speichern“ unten rechts steht (E6-O F3, #726).
 */
export function AblaufAnlegenManager({ site, onClose }: { site: SiteConfig; onClose: () => void }) {
  const gespeichert = site.ablaufAnlegen ?? { kalenderIds: [], suchwort: '' };
  const [kalenderIds, setKalenderIds] = useState<number[]>(gespeichert.kalenderIds);
  const [suchwort, setSuchwort] = useState(gespeichert.suchwort);
  const kalender = useKalender(true);
  const update = useUpdateSiteConfig();

  const geaendert =
    !sameIdSet(kalenderIds, gespeichert.kalenderIds) ||
    suchwort.trim() !== gespeichert.suchwort.trim();

  function umschalten(id: number) {
    setKalenderIds((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]));
  }

  function speichern() {
    update.mutate(
      { ...site, ablaufAnlegen: { kalenderIds, suchwort: suchwort.trim() } },
      { onSuccess: onClose },
    );
  }

  return (
    <Sheet
      title="Termine ohne Ablauf"
      onClose={onClose}
      knoepfe={
        geaendert ? (
          <FensterKnopf onClick={speichern} disabled={update.isPending}>
            {update.isPending
              ? 'Wird gespeichert …'
              : kalenderIds.length === 0
                ? 'Speichern (Funktion aus)'
                : 'Speichern'}
          </FensterKnopf>
        ) : null
      }
    >
      <p className={styles.sheetHint}>
        Veranstaltungen aus diesen Kalendern erscheinen in der Terminliste auch dann, wenn sie noch
        <strong> keinen Ablauf</strong> haben – mit „Ablauf anlegen“. Termine mit Ablauf stehen wie
        bisher drin, egal aus welchem Kalender.
      </p>
      {kalender.isLoading && <Spinner />}
      {kalender.isError && (
        <div className={styles.orgErr}>Kalender konnten nicht geladen werden.</div>
      )}
      {kalender.data && (
        <div className={styles.cardList}>
          {kalender.data.map((k) => {
            const an = kalenderIds.includes(k.id);
            return (
              <button
                key={k.id}
                className={`${styles.setRow} ${styles.tappable}`}
                role="checkbox"
                aria-checked={an}
                onClick={() => umschalten(k.id)}
              >
                <span className={styles.setLabel}>{k.name}</span>
                <span className={`${styles.checkbox}${an ? ' ' + styles.checkboxOn : ''}`}>
                  {an && <Icon name="check" size={14} />}
                </span>
              </button>
            );
          })}
        </div>
      )}
      <p className={styles.sheetHint}>
        <strong>Nur mit diesem Wort im Namen</strong> (freiwillig, z. B. „Gottesdienst“) – für
        Kalender, in denen auch andere Termine liegen.
      </p>
      <input
        className={styles.orgInput}
        value={suchwort}
        maxLength={SITE_CONFIG_GRENZEN.terminArtSuchwort}
        placeholder="Leer = alle Termine der gewählten Kalender"
        aria-label="Suchwort im Terminnamen"
        autoCapitalize="off"
        onChange={(e) => setSuchwort(e.target.value)}
      />
      {update.isError && <div className={styles.orgErr}>{speicherFehler(update.error)}</div>}
    </Sheet>
  );
}
