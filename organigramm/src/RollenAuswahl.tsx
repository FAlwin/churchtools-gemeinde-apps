import { useRef } from 'react';
import { Icon } from '@ui/icons/icons';
import { useAufklapp } from '@ui/bedienung/useAufklapp';
import { useMenueImBild } from '@ui/bedienung/useMenueImBild';
import type { RollenWahl } from '@shared/organigramm/personen';
import { rollenKnopfText } from './kastenPersonen';
import styles from './SpitzenAuswahl.module.scss';

/**
 * **„Welche Rollen“** (#915, Entwurf abgenommen 12.11.2026): ein Häkchen je Rolle, so benannt wie in ChurchTools, dazu
 * „Alle“ und „Nur Leitung“. Gemerkt werden die ABGEWÄHLTEN Namen – eine neue Rolle in ChurchTools ist so von selbst
 * zu sehen. Eine Stelle für Reiter, Präsentation und PDF.
 */
export function RollenAuswahl({
  rollen,
  aus,
  onAus,
  feldKlasse,
}: {
  rollen: readonly RollenWahl[];
  aus: ReadonlySet<string>;
  onAus: (aus: Set<string>) => void;
  /** Das Aussehen des Felds kommt von der Stelle (Leiste im Reiter bzw. Fenster). */
  feldKlasse: string;
}) {
  const { offen, setOffen, rahmen } = useAufklapp();
  const menue = useRef<HTMLDivElement>(null);
  useMenueImBild(menue, offen);
  const text = rollenKnopfText(rollen, aus);

  const umschalten = (name: string, an: boolean) => {
    const neu = new Set(aus);
    if (an) neu.delete(name);
    else neu.add(name);
    onAus(neu);
  };

  return (
    <span className={styles.rahmen} ref={rahmen}>
      <button
        type="button"
        className={`${feldKlasse} ${styles.knopf}`}
        aria-haspopup="true"
        aria-expanded={offen}
        aria-label={`Welche Rollen: ${text}`}
        onClick={() => setOffen(!offen)}
      >
        <span className={styles.name}>{text}</span>
        <Icon name="chev-down" size={14} />
      </button>
      {offen && (
        <div
          className={`${styles.menue} ${styles.schmal}`}
          ref={menue}
          role="group"
          aria-label="Welche Rollen"
        >
          {rollen.length === 0 ? (
            <p className={styles.leer}>Noch keine Rollen geladen</p>
          ) : (
            <div className={styles.liste}>
              {rollen.map((r) => (
                <label key={r.name} className={styles.haken}>
                  <input
                    type="checkbox"
                    checked={!aus.has(r.name)}
                    onChange={(e) => umschalten(r.name, e.target.checked)}
                  />
                  {r.name}
                </label>
              ))}
            </div>
          )}
          <div className={styles.fuss}>
            <button type="button" className={styles.kurz} onClick={() => onAus(new Set())}>
              Alle
            </button>
            {rollen.some((r) => r.leitung) && (
              <button
                type="button"
                className={styles.kurz}
                onClick={() => onAus(new Set(rollen.filter((r) => !r.leitung).map((r) => r.name)))}
              >
                Nur Leitung
              </button>
            )}
          </div>
        </div>
      )}
    </span>
  );
}
