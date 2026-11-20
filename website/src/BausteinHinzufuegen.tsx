import { Sheet } from '@ui/fenster/Sheet';
import type { BausteinTyp } from '@shared/website/modell';
import { waehlbareTypen, type Rechte } from './regeln';
import { BAUSTEIN_NAMEN } from './texte';
import styles from './Fenster.module.scss';

/** **Fenster „Baustein hinzufügen“** (W3a-2): die Typen zur Auswahl; der neue Baustein kommt als Platzhalter (`neuerBaustein`). */
export function BausteinHinzufuegen({
  rechte,
  onWahl,
  onClose,
}: {
  rechte: Rechte;
  onWahl: (typ: BausteinTyp) => void;
  onClose: () => void;
}) {
  return (
    <Sheet title="Baustein hinzufügen" onClose={onClose} knoepfe={null} mittel>
      <div className={styles.kacheln}>
        {waehlbareTypen(rechte).map((t) => (
          <button key={t} type="button" className={styles.kachel} onClick={() => onWahl(t)}>
            {BAUSTEIN_NAMEN[t]}
          </button>
        ))}
      </div>
      {!rechte.html && <p className={styles.unterText}>„Eigenes HTML“ ist nur für die Leitung.</p>}
    </Sheet>
  );
}
