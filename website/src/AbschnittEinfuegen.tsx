import { Sheet } from '@ui/fenster/Sheet';
import type { Vorlage } from '@shared/website/vorlagen';
import { sichtbareVorlagen, type Rechte } from './regeln';
import styles from './Fenster.module.scss';

/** Das kleine Bild einer Vorlage: Spalten mit Textzeilen und Bildflächen (nur Andeutung, kein Vorschaubild). */
function Schema({ name }: { name: string }) {
  const text = (
    <div>
      <i className={styles.stark} />
      <i />
      <i />
    </div>
  );
  const bild = (fuell = false) => (
    <div>
      <i className={`${styles.block}${fuell ? ' ' + styles.fuell : ''}`} />
    </div>
  );
  const inhalt = (() => {
    switch (name) {
      case 'start-schriftzug':
        return (
          <div>
            <i style={{ width: '40%', alignSelf: 'center' }} />
            <i className={styles.stark} style={{ width: '90%', alignSelf: 'center' }} />
            <i style={{ width: '50%', alignSelf: 'center' }} />
          </div>
        );
      case 'start-foto-flaeche':
        return (
          <>
            {text}
            {bild(true)}
          </>
        );
      case 'start-foto-hintergrund':
        return bild(true);
      case 'text-bild':
      case 'termine':
      case 'livestream':
      case 'kontakt':
        return (
          <>
            {text}
            {bild()}
          </>
        );
      case 'bild-text':
        return (
          <>
            {bild()}
            {text}
          </>
        );
      case 'drei-spalten':
        return (
          <>
            {text}
            {text}
            {text}
          </>
        );
      case 'galerie':
        return (
          <>
            {bild()}
            {bild()}
            {bild()}
          </>
        );
      default:
        return text;
    }
  })();
  return (
    <div className={styles.schema} aria-hidden="true">
      {inhalt}
    </div>
  );
}

/**
 * **Fenster „Abschnitt einfügen“** (W3a-2, Entwurf w3-v1): Die Vorlagen als Kacheln mit kleinem Schema-Bild. Eine Vorlage ist
 * nur ein Erzeuger (`vorlagen.ts`); gewählt wird sie hier, eingefügt vom Editor.
 */
export function AbschnittEinfuegen({
  rechte,
  onWahl,
  onClose,
}: {
  rechte: Rechte;
  onWahl: (vorlage: Vorlage) => void;
  onClose: () => void;
}) {
  return (
    <Sheet title="Abschnitt einfügen" onClose={onClose} knoepfe={null} breit>
      <div className={styles.vorlagen}>
        {sichtbareVorlagen(rechte).map((v) => (
          <button key={v.name} type="button" className={styles.vorlage} onClick={() => onWahl(v)}>
            <Schema name={v.name} />
            <strong>{v.titel}</strong>
            <span>{v.beschreibung}</span>
          </button>
        ))}
      </div>
      {!rechte.html && <p className={styles.unterText}>„Eigenes HTML“ ist nur für die Leitung.</p>}
    </Sheet>
  );
}
