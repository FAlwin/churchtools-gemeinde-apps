import { useState } from 'react';
import { FehlerKasten } from '@ui/erweiterung/ErweiterungsSeite';
import { fehlerMeldung, type Fehlermeldung } from '@ui/ct/fehlerMeldung';
import { KopfKnopf } from '@ui/bedienung/KopfKnopf';
import { Icon } from '@ui/icons/icons';
import { einrichtungsStand } from '@shared/gebetsabend/einrichten';
import type { Start } from './start';
import { einrichten } from './einrichten';
import styles from './Einrichtung.module.scss';

interface Props {
  start: Start;
  /** Nach dem Einrichten neu laden – die Seite liest die Kategorien dann frisch aus ChurchTools. */
  onEingerichtet: () => void;
}

/**
 * **Noch nicht eingerichtet** (Bauplan Gebetsabend G1). Wer Kategorien anlegen darf, richtet hier mit einem Knopf ein;
 * alle anderen sehen den Hinweis. Danach vergibt die Verwaltung die Rechte (`docs/betrieb/GEBETSABEND.md`). Ist alles
 * eingerichtet, zeigt die Seite statt dieser Karte das Zuhören (`App.tsx`).
 */
export function Einrichtung({ start, onEingerichtet }: Props) {
  const [laeuft, setLaeuft] = useState(false);
  const [fehler, setFehler] = useState<Fehlermeldung | null>(null);
  const stand = einrichtungsStand(start.einrichtung, start.darfAnlegen);

  const los = () => {
    setLaeuft(true);
    setFehler(null);
    einrichten(start.modul).then(
      () => {
        setLaeuft(false);
        onEingerichtet();
      },
      (e: unknown) => {
        setLaeuft(false);
        setFehler(fehlerMeldung(e));
      },
    );
  };

  return (
    <section className={styles.karte} aria-labelledby="einrichtung-titel">
      <h2 id="einrichtung-titel">Gebetsabend</h2>
      {stand === 'einrichten' && (
        <>
          <p>Der Gebetsabend ist noch nicht eingerichtet.</p>
          <p className={styles.leise}>
            Beim Einrichten legt die Erweiterung zwei Bereiche für ihre Daten an: „Zugang“ und
            „Einstellungen“. Danach vergibst du die Rechte für die Mitglieder und die Technik.
          </p>
          <div className={styles.knoepfe}>
            {/* `raster`: auch am Handy mit Wort – ein Haken allein sagt nicht, was der Knopf tut. */}
            <KopfKnopf
              haupt
              raster
              label={laeuft ? 'Wird eingerichtet …' : 'Einrichten'}
              symbol={<Icon name="check" />}
              disabled={laeuft}
              onClick={los}
            />
          </div>
          {fehler && <FehlerKasten fehler={fehler} onNochmal={los} />}
        </>
      )}
      {stand === 'fehlt' && (
        <p>
          Der Gebetsabend ist noch nicht eingerichtet, oder dir fehlt das Recht dazu. Bitte wende
          dich an die Verwaltung deiner Gemeinde.
        </p>
      )}
    </section>
  );
}
