/**
 * Die Hinweisleiste über dem Ablauf (Alwin, 12.10.2026): „Ablauf aktualisiert · 1 neu · 2 geändert",
 * darunter jeder entfernte Punkt durchgestrichen. Ersetzt das Aufleuchten und das Zerfallen (#161) –
 * das Zerfallen fotografierte mit `html2canvas` die ganze Seite ab und ließ die ChurchTools-Erweiterung
 * hängen. Ruhig, ohne Bewegung, zum Wegklicken; kommt eine neue Änderung, erscheint sie wieder.
 */
import { useState } from 'react';
import { Icon } from '@ui/icons/icons';
import { hatAenderungen, type AblaufAenderungen } from '../utils/ablaufAenderungen';
import styles from '../pages/Setlist.module.scss';

export function AblaufHinweis({ aenderungen }: { aenderungen: AblaufAenderungen }) {
  // Weggeklickt gilt für genau diesen Stand – ändert sich etwas, zeigt die Leiste den neuen.
  const stand = JSON.stringify(aenderungen);
  const [weggeklickt, setWeggeklickt] = useState<string | null>(null);
  if (!hatAenderungen(aenderungen) || weggeklickt === stand) return null;

  const teile = [
    aenderungen.neu > 0 ? `${aenderungen.neu} neu` : '',
    aenderungen.geaendert > 0 ? `${aenderungen.geaendert} geändert` : '',
  ].filter(Boolean);
  return (
    <div className={styles.aenderungsLeiste} role="status">
      <div className={styles.aenderungsKopf}>
        <Icon name="refresh" size={15} stroke={2.2} />
        <span>
          <strong>Ablauf aktualisiert</strong>
          {teile.map((t) => ` · ${t}`).join('')}
        </span>
        <button
          type="button"
          className={styles.aenderungsZu}
          aria-label="Hinweis schließen"
          onClick={() => setWeggeklickt(stand)}
        >
          <Icon name="x" size={15} stroke={2.2} />
        </button>
      </div>
      {aenderungen.entfernt.map((titel, i) => (
        <div key={i} className={styles.aenderungsEntfernt}>
          Entfernt: <s>{titel}</s>
        </div>
      ))}
    </div>
  );
}
