/**
 * **Wer an einem Punkt zuständig ist** (Alwin, 02.11.2026, Entwurf „Ablauf mit Info-Spalten“ Bild 5 C): hinter den
 * Kreisen rechts in der Zeile. Alle Personen mit ihrem Dienst, offene Dienste rot – vorher war „+3“ nicht antippbar.
 * Nur zum Ansehen: kein Knopf unten, das X schließt.
 */
import type { AblaufZeile } from '@shared/ct/ablaufZeile';
import { Sheet } from '../fenster/Sheet';
import styles from './ZustaendigeFenster.module.scss';

export function ZustaendigeFenster({
  punkt,
  onClose,
}: {
  punkt: AblaufZeile;
  onClose: () => void;
}) {
  return (
    <Sheet title={`Zuständig · ${punkt.title}`} onClose={onClose} knoepfe={null}>
      <ul className={styles.liste}>
        {punkt.responsible.map((e, i) => (
          <li key={i} className={styles.zeile}>
            {e.open ? (
              <>
                <span className={styles.offen}>{e.label}</span>
                <span className={styles.dienst}>offen</span>
              </>
            ) : (
              <>
                <span className={styles.name}>{e.label}</span>
                {e.dienst && <span className={styles.dienst}>{e.dienst}</span>}
              </>
            )}
          </li>
        ))}
      </ul>
    </Sheet>
  );
}
