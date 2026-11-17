import { useState } from 'react';
import { Sheet } from '@ui/fenster/Sheet';
import { FensterKnopf } from '@ui/fenster/FensterKnopf';
import { GastFeld } from './GastFeld';
import { GAST_HINWEIS, gastNameAus } from './gastName';
import styles from './WerKann.module.scss';
import eigen from './PersonenRaster.module.scss';

/**
 * **„Gast eintragen“ in der Gäste-Zeile von „Personen“** (P2d, Entwurf `e9-p2-eintragen.html` Fall 8): ein Fenster mit dem
 * Namensfeld (dieselbe Regel und derselbe Text wie „Jemand ohne ChurchTools-Konto“ in „Wer kann?“ – `GastFeld`). Ist der
 * Dienst voll, steht darunter der Satz „… ist voll“ samt „Platz dazunehmen“ – der Hauptknopf heißt dann „Platz dazunehmen (n)“
 * (wie im Fenster „Dienst voll“ der Personen, P2c). Enter sendet. Das Anlegen macht der Aufrufer.
 */
export function GastFenster({
  titel,
  unter,
  voll = null,
  onEintragen,
  onClose,
}: {
  /** „Gast eintragen – Ton · Fr, 20.11.“ */
  titel: string;
  /** „Jugendabend · 19:00 Uhr“ */
  unter: string;
  /** Der Dienst ist voll: der Satz dazu, der Hinweis auf den neuen Platz und die Platzzahl danach. */
  voll?: { text: string; hinweis: string; neu: number } | null;
  /** Legt den Gast an – der Aufrufer schließt das Fenster. */
  onEintragen: (name: string) => void;
  onClose: () => void;
}) {
  const [name, setName] = useState('');
  const gueltig = gastNameAus(name);
  const los = () => {
    if (gueltig) onEintragen(gueltig);
  };
  return (
    <Sheet
      title={titel}
      onClose={onClose}
      knoepfe={
        <FensterKnopf disabled={gueltig === null} onClick={los}>
          {voll ? `Platz dazunehmen (${voll.neu})` : 'Als Entwurf eintragen'}
        </FensterKnopf>
      }
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          los();
        }}
      >
        <p className={styles.unter}>{unter}</p>
        <p className={styles.hinweis}>{GAST_HINWEIS}</p>
        <div className={eigen.gastFensterFeld}>
          <GastFeld wert={name} onChange={setName} autoFocus />
        </div>
        {voll && (
          <>
            <p className={eigen.gastVoll}>{voll.text} Platz dazunehmen und eintragen?</p>
            <p className={eigen.dazuHinweis}>{voll.hinweis}</p>
          </>
        )}
      </form>
    </Sheet>
  );
}
