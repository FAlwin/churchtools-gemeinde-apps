import type { SiteConfig } from '@shared/types/index';
import type { Verwaltung } from '../hooks/useVerwaltung';
import { KATEGORIE_NAME } from '../services/ctEinstellungen';
import { funktionen } from '../services/funktionen';
import styles from '../pages/Settings.module.scss';

/**
 * Die Zeilen der Verwaltung im Tab „Mehr" – nur für Admins (#407: aus `pages/Settings.tsx`
 * herausgelöst). Jede Zeile öffnet ein Fenster aus `VerwaltungFenster`. Was es in dieser Auslieferung
 * (noch) nicht gibt, fehlt – eine Einstellung ohne Wirkung wäre ein toter Knopf (`funktionen.ts`).
 */
export function VerwaltungZeilen({ site, v }: { site: SiteConfig; v: Verwaltung }) {
  return (
    <div className={styles.group}>
      <div className={styles.groupHdr}>Verwaltung</div>
      <div className={styles.cardList}>
        {funktionen.gemeindeName && (
          <button className={`${styles.setRow} ${styles.tappable}`} onClick={v.openOrg}>
            <span className={styles.setLabel}>Organisation / Name</span>
            <span className={styles.setValue}>{site.orgName}</span>
          </button>
        )}
        <button className={`${styles.setRow} ${styles.tappable}`} onClick={v.openLinks}>
          <span className={styles.setLabel}>Links verwalten</span>
          <span className={styles.setValue}>
            {site.links.length === 0
              ? 'keine'
              : `${site.links.length} ${site.links.length === 1 ? 'Link' : 'Links'}`}
          </span>
        </button>
        <button className={`${styles.setRow} ${styles.tappable}`} onClick={v.openAnsicht}>
          <span className={styles.setLabel}>Liedblatt: Standard-Ansicht</span>
          <span className={styles.setValue}>
            {site.standardAnsicht === 'dokument' ? 'PDF zuerst' : 'Akkorde'}
          </span>
        </button>
        {funktionen.abwesenheiten && (
          <button className={`${styles.setRow} ${styles.tappable}`} onClick={v.openTerminArten}>
            <span className={styles.setLabel}>Abwesenheiten: Termin-Arten</span>
            <span className={styles.setValue}>
              {(site.terminArten ?? []).length === 0
                ? 'kein Filter'
                : `${(site.terminArten ?? []).length} ${(site.terminArten ?? []).length === 1 ? 'Art' : 'Arten'}`}
            </span>
          </button>
        )}
        {funktionen.teamNotizen && (
          <button className={`${styles.setRow} ${styles.tappable}`} onClick={v.openNotes}>
            <span className={styles.setLabel}>Anmerkungen</span>
            <span className={styles.setValue}>
              {site.musicianGroupIds.length === 0
                ? 'aus'
                : `${site.musicianGroupIds.length} ${site.musicianGroupIds.length === 1 ? 'Gruppe' : 'Gruppen'}`}
            </span>
          </button>
        )}
      </div>
      {funktionen.einstellungenInChurchTools && (
        <p className={styles.installHint}>
          Damit alle diese Einstellungen bekommen, brauchen sie in ChurchTools für die Musik App die
          Rechte „view custom category" und „view custom data" für „{KATEGORIE_NAME}".
        </p>
      )}
    </div>
  );
}
