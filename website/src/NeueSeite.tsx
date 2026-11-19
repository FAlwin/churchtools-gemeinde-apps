import { useState } from 'react';
import { Sheet } from '@ui/fenster/Sheet';
import { FensterKnopf } from '@ui/fenster/FensterKnopf';
import { fehlerMeldung, type Fehlermeldung } from '@ui/ct/fehlerMeldung';
import type { Seite } from '@shared/website/modell';
import { freierPfad, neueLeereSeite, pfadAusTitel } from '@shared/website/seitenListe';
import { neueId } from './ids';
import styles from './Fenster.module.scss';

/**
 * **Fenster „Neue Seite“** (Bauplan Website W3a-1): ein Titel, der Pfad (die Adresse der Seite) entsteht daraus von selbst
 * – ist er schon vergeben, kommt `-2` dahinter. Die Seite ist zunächst leer; sie landet in den Entwürfen.
 */
export function NeueSeite({
  seiten,
  speichern,
  onAngelegt,
  onClose,
}: {
  seiten: readonly Seite[];
  /** Schreibt die Seite in den Speicher (wirft bei einem Fehler). */
  speichern: (seite: Seite) => Promise<void>;
  onAngelegt: (seite: Seite) => void;
  onClose: () => void;
}) {
  const [titel, setTitel] = useState('');
  const [laeuft, setLaeuft] = useState(false);
  const [fehler, setFehler] = useState<Fehlermeldung | null>(null);
  const bereit = titel.trim() !== '' && !laeuft;
  const pfad = freierPfad(
    pfadAusTitel(titel),
    seiten.map((s) => s.pfad),
  );

  const anlegen = async () => {
    if (!bereit) return;
    setLaeuft(true);
    setFehler(null);
    const seite = neueLeereSeite(titel, seiten, neueId);
    try {
      await speichern(seite);
      onAngelegt(seite);
    } catch (e) {
      setLaeuft(false);
      setFehler(fehlerMeldung(e));
    }
  };

  return (
    <Sheet
      title="Neue Seite"
      onClose={onClose}
      beschaeftigt={laeuft}
      knoepfe={
        <FensterKnopf disabled={!bereit} onClick={() => void anlegen()}>
          {laeuft ? 'Wird angelegt …' : 'Anlegen'}
        </FensterKnopf>
      }
    >
      <label className={styles.feld}>
        <span>Titel der Seite</span>
        <input
          className={styles.eingabe}
          value={titel}
          maxLength={150}
          autoFocus
          disabled={laeuft}
          placeholder="z. B. Unsere Gruppen"
          onChange={(e) => setTitel(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') void anlegen();
          }}
        />
      </label>
      <p className={styles.leise}>
        Adresse der Seite: <code>/{titel.trim() === '' ? '…' : pfad}/</code> – sie entsteht aus dem
        Titel. Die Seite ist zuerst leer; Inhalte kommen im nächsten Schritt.
      </p>
      {fehler && (
        <p className={styles.fehler} role="alert">
          {fehler.text}
        </p>
      )}
    </Sheet>
  );
}
