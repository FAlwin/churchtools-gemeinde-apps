import { Icon } from '@ui/icons/icons';
import styles from './ChordEditor.module.scss';
import { ANDERE, TEILE, type Einfuegen } from '../utils/einfuegen';

interface Props {
  offen: boolean;
  umschalten: () => void;
  waehlen: (e: Einfuegen) => void;
}

// Knöpfe rund um den Text nehmen ihm den Fokus nicht – sonst ginge am iPad die Tastatur zu.
const ohneFokus = (e: React.MouseEvent) => e.preventDefault();

/**
 * **Menü „Einfügen“** (Lied-Editor L6, Variante B – Alwin, 24.10.2026): ersetzt das Format-Menü. Oben die Teile,
 * darunter der Pedal-Halt, abgesetzt „Nur für andere Programme“.
 */
export function EinfuegenMenue({ offen, umschalten, waehlen }: Props) {
  return (
    <div className={styles.dd}>
      <button
        type="button"
        className={styles.ddBtn}
        onMouseDown={ohneFokus}
        onClick={umschalten}
        aria-expanded={offen}
      >
        Einfügen
        <Icon name="chev-down" size={16} stroke={2} />
      </button>
      {offen && (
        <div className={`${styles.ddPanel} ${styles.ddPanelWide}`}>
          <div className={styles.ddKopf}>Neuer Teil</div>
          <div className={styles.ddTeile}>
            {TEILE.map((name) => (
              <button
                key={name}
                type="button"
                className={styles.ddFormat}
                onMouseDown={ohneFokus}
                onClick={() => waehlen({ art: 'teil', name })}
              >
                <span className={styles.ddFormatLabel}>{name}</span>
              </button>
            ))}
          </div>
          <div className={styles.ddTrenner} />
          <button
            type="button"
            className={styles.ddFormat}
            onMouseDown={ohneFokus}
            onClick={() => waehlen({ art: 'pedal' })}
          >
            <span className={styles.ddFormatLabel}>Pedal-Halt</span>
            <code className={styles.ddFormatTag}>----</code>
          </button>
          <div className={styles.ddTrenner} />
          <div className={styles.ddKopf}>Nur für andere Programme</div>
          <p className={styles.ddHinweis}>
            Wirkt nicht in dieser App. Kapo stellst du am Blatt ein.
          </p>
          {ANDERE.map((a) => (
            <button
              key={a.tag}
              type="button"
              className={styles.ddFormat}
              onMouseDown={ohneFokus}
              onClick={() => waehlen({ art: 'anderes', tag: a.tag, mitWert: a.mitWert })}
            >
              <span className={styles.ddFormatLabel}>{a.label}</span>
              <code className={styles.ddFormatTag}>{a.tag}</code>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
